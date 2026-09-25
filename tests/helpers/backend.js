/* A fake of the Supabase backend, as far as the page talks to it
   (DECISIONS #53; docs/sync/contract.md, sections 1 and 5, as built), every
   request kept as it was sent, so a test pins exactly what the page asked
   for. Plain objects, not Response, so the built page's JSDOM can use it
   too. Anything it was not built to answer throws.

   The Auth server: anonymous sign-in, add, recover, verify, refresh and
   sign out, each answering with the status and error code the real server
   gives - checked against its source. One code for every address, CODE.

   PostgREST, over picks, follows, crews and crew_members: the upsert, which
   judges each row as the database's triggers do - the stamp clamped to the
   server's time plus five minutes, a row changed only by a strictly newer
   one, synced_at the server's on every accepted write - and refuses what
   the grants refuse, a user_id or a synced_at in the payload among them;
   the reads, narrowed as row-level security narrows them - one's own
   rows, and the picks of anyone who shares a crew of that year - ordered,
   filtered and paged as the page asks, at most maxRows a request; and the
   crews with their members. Checked against a real PostgREST, 14.5, on the
   CLI's local stack.

   Knobs a test sets: captcha (the project demands a captcha token),
   anonymousOff (anonymous sign-ins switched off), offline (the network is
   gone: true, or a test of each request), fail (a test of each request that
   returns {status, code} for the server to answer with, or nothing),
   defer (a test of each request: one it holds is not answered, nor acted
   on, until release()), onRequest (called with each request as it arrives
   - another tab, acting meanwhile), maxRows, and clockOffset (ms the
   server's clock is ahead of the test's). held(email) makes a user who already holds an address;
   issue(id) a session for a user, as another tab would hold it;
   refuse(token) makes the server refuse an access token as expired;
   revoke(token) kills a refresh token. write(user, table, row) is a write
   by another device or a crewmate, judged as the page's are; crew(...),
   join(...) and leave(...) make and change crews; rows(table) is what the
   server holds. */
export const CODE = "123456";

export function fakeBackend({ url = "https://backend.test", key = "sb_publishable_test" } = {}) {
  const users = new Map(), access = new Map(), refresh = new Map(), codes = new Map(), refused = new Set();
  const requests = [];
  let n = 0;
  const tables = { picks: [], follows: [] }, crews = [], deferred = [];
  let lastStamp = 0;

  const answer = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? "" : JSON.stringify(body)) });
  /* the Auth server's error, in the shape it answers a request with no API version */
  const fail = (status, code, msg) => answer(status, { code: status, error_code: code, msg });
  const holder = email => [...users.values()].find(u => !u.is_anonymous && u.email === email);
  function session(user) {
    const token = `access-${++n}`, renew = `refresh-${n}`;
    access.set(token, user.id);
    refresh.set(renew, user.id);
    return { access_token: token, token_type: "bearer", expires_in: 3600, refresh_token: renew,
      user: { id: user.id, aud: "authenticated", role: "authenticated", email: user.email, is_anonymous: user.is_anonymous } };
  }
  function signedIn(headers) {
    const token = String(headers.Authorization || "").replace(/^Bearer /, "");
    return access.has(token) && !refused.has(token) ? users.get(access.get(token)) : null;
  }
  const newUser = (email, anonymous) => { const user = { id: `00000000-0000-4000-a000-${String(++n).padStart(12, "0")}`, email, is_anonymous: anonymous }; users.set(user.id, user); return user; };

  /* PostgREST. The two synced tables, keyed as the database keys them; the
     columns each has; the conflict target its upsert must name. */
  const KEYS = { picks: ["event_id"], follows: ["kind", "key"] };
  const FLAG = { picks: "picked", follows: "followed" };
  const COLUMNS = { picks: ["user_id", "year", "event_id", "picked", "changed_at", "synced_at"],
    follows: ["user_id", "year", "kind", "key", "followed", "changed_at", "synced_at"] };
  const CONFLICT = { picks: "user_id,year,event_id", follows: "user_id,year,kind,key" };
  const serverNow = () => Date.now() + fake.clockOffset;
  /* a timestamptz as PostgREST writes one: microseconds and an offset */
  const pgTime = ms => new Date(ms).toISOString().replace("Z", "000+00:00");
  /* clock_timestamp(): the server's time, never the same twice */
  const stamp = () => { lastStamp = Math.max(serverNow(), lastStamp + 1); return pgTime(lastStamp); };
  /* PostgREST's error, as it answers every one */
  const restFail = (status, code, message) => answer(status, { code, details: null, hint: null, message });
  const sameKey = (table, a, b) => a.user_id === b.user_id && a.year === b.year && KEYS[table].every(k => a[k] === b[k]);
  /* The database's triggers on one row: the clamp, latest-wins, synced_at.
     True when it was inserted. */
  function judge(table, row) {
    const clamped = Math.min(Date.parse(row.changed_at), serverNow() + 5 * 60000);
    const incoming = { ...row, changed_at: pgTime(clamped) };
    const held = tables[table].find(r => sameKey(table, r, incoming));
    if (!held) { tables[table].push({ ...incoming, synced_at: stamp() }); return true; }
    if (clamped > Date.parse(held.changed_at)) Object.assign(held, { [FLAG[table]]: incoming[FLAG[table]], changed_at: incoming.changed_at, synced_at: stamp() });
    return false;
  }
  const sharesCrew = (a, b, year) => crews.some(c => c.year === year && c.members.some(m => m.user_id === a) && c.members.some(m => m.user_id === b));
  /* row-level security: one's own rows, and a crewmate's picks of the crew's year */
  const visible = (table, user, r) => r.user_id === user.id || (table === "picks" && sharesCrew(user.id, r.user_id, r.year));
  const nothingAnswers = (method, address) => { throw new Error(`fakeBackend: nothing answers ${method} ${address.pathname}${address.search}`); };

  /* The upsert: POST with the conflict target and, to merge, Prefer's
     resolution=merge-duplicates. Every column of the payload is in the
     statement's SET, so the grants refuse any but the key columns, the flag
     and changed_at: user_id and synced_at among them. */
  function upsert(table, user, params, headers, body, address) {
    if (params.get("on_conflict") !== CONFLICT[table] || [...params.keys()].length !== 1) nothingAnswers("POST", address);
    const rows = Array.isArray(body) ? body : [body];
    const allowed = ["year", ...KEYS[table], FLAG[table], "changed_at"];
    if (rows.some(r => Object.keys(r).some(k => !allowed.includes(k)))) return restFail(403, "42501", `permission denied for table ${table}`);
    const merge = /(^|,)resolution=merge-duplicates(,|$)/.test(headers.Prefer || "");
    for (const r of rows) {
      if (!Number.isInteger(r.year) || r.year < 2026 || r.year > 2099 || KEYS[table].some(k => typeof r[k] !== "string" || !r[k])
          || (table === "follows" && !["track", "work", "axis", "person"].includes(r.kind))) {
        return restFail(400, "23514", `new row for relation "${table}" violates check constraint`);
      }
      if (typeof r[FLAG[table]] !== "boolean" || isNaN(Date.parse(r.changed_at))) return restFail(400, "22P02", "invalid input syntax");
      if (!merge && tables[table].some(h => sameKey(table, h, { ...r, user_id: user.id }))) {
        return restFail(409, "23505", `duplicate key value violates unique constraint "${table}_pkey"`);
      }
    }
    let inserted = false;
    for (const r of rows) inserted = judge(table, { ...r, user_id: user.id }) || inserted;
    return answer(inserted ? 201 : 200);
  }

  /* A read of picks or follows: a year, perhaps synced_at after a moment,
     ordered, and a page of it; the columns the select names. */
  function readRows(table, user, params, address) {
    if ([...params.keys()].some(k => !["select", "year", "synced_at", "order", "limit", "offset"].includes(k))) nothingAnswers("GET", address);
    const year = /^eq\.(\d+)$/.exec(params.get("year") || ""), columns = (params.get("select") || "").split(",");
    if (!year || columns.some(c => !COLUMNS[table].includes(c))) nothingAnswers("GET", address);
    let rows = tables[table].filter(r => r.year === Number(year[1]) && visible(table, user, r));
    if (params.has("synced_at")) {
      const gt = /^gt\.(.+)$/.exec(params.get("synced_at")), since = gt ? Date.parse(gt[1]) : NaN;
      if (isNaN(since)) return restFail(400, "22007", `invalid input syntax for type timestamp with time zone: "${params.get("synced_at")}"`);
      rows = rows.filter(r => Date.parse(r.synced_at) > since);
    }
    for (const term of (params.get("order") || "").split(",").filter(Boolean).reverse()) {
      const [column, direction] = term.split(".");
      rows = [...rows].sort((a, b) => (a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0) * (direction === "desc" ? -1 : 1));
    }
    const offset = Number(params.get("offset") || 0), limit = Math.min(Number(params.get("limit") || fake.maxRows), fake.maxRows);
    return answer(200, rows.slice(offset, offset + limit).map(r => Object.fromEntries(columns.map(c => [c, r[c]]))));
  }

  /* The caller's crews of a year, with their members embedded. */
  function readCrews(user, params, address) {
    const year = /^eq\.(\d+)$/.exec(params.get("year") || "");
    if (params.get("select") !== "id,name,creator,crew_members(user_id,display_name)" || [...params.keys()].length !== 2 || !year) nothingAnswers("GET", address);
    const mine = crews.filter(c => c.year === Number(year[1]) && c.members.some(m => m.user_id === user.id));
    return answer(200, mine.map(c => ({ id: c.id, name: c.name, creator: c.creator,
      crew_members: c.members.map(m => ({ user_id: m.user_id, display_name: m.display_name })) })));
  }

  const fake = {
    url, key, requests, users,
    captcha: false, anonymousOff: false, offline: false, fail: null, defer: null, onRequest: null, maxRows: 1000, clockOffset: 0,
    release: () => { deferred.splice(0).forEach(resolve => resolve()); },
    held: email => newUser(email, false),
    issue: id => session(users.get(id)),
    refuse: token => refused.add(token),
    revoke: token => refresh.delete(token),
    /* the requests to one path, method and path as the page wrote them */
    to: path => requests.filter(r => r.path === path),
    /* another device's write, or a crewmate's, judged as the page's are */
    write: (userId, table, row) => {
      const whole = { year: 2026, ...row, user_id: userId };
      judge(table, whole);
      return { ...tables[table].find(r => sameKey(table, r, whole)) };
    },
    rows: table => tables[table].map(r => ({ ...r })),
    crew: ({ year = 2026, name = "Crew", creator, members }) => {
      const c = { id: `00000000-0000-4000-b000-${String(++n).padStart(12, "0")}`, year, name, creator,
        members: members.map(([user_id, display_name]) => ({ user_id, display_name })) };
      crews.push(c);
      return c;
    },
    join: (crew, userId, name) => { crew.members.push({ user_id: userId, display_name: name }); },
    leave: (crew, userId) => { crew.members = crew.members.filter(m => m.user_id !== userId); },
  };

  fake.fetch = async (input, init = {}) => {
    const address = new URL(String(input));
    if (address.origin !== url) throw new Error(`fakeBackend: the page asked ${address.origin}, not the backend`);
    const headers = { ...(init.headers || {}) };
    const body = init.body === undefined ? undefined : JSON.parse(init.body);
    const request = { method: init.method || "GET", path: address.pathname + address.search, headers, body };
    requests.push(request);
    if (fake.onRequest) fake.onRequest(request);
    if (fake.defer && fake.defer(request)) await new Promise(resolve => deferred.push(resolve));
    if (typeof fake.offline === "function" ? fake.offline(request) : fake.offline) throw new TypeError("Failed to fetch");
    if (headers.apikey !== key) return answer(401, { message: "Invalid API key" });
    if (address.pathname.startsWith("/rest/v1/")) {
      const failure = fake.fail && fake.fail(request);
      if (failure) return restFail(failure.status, failure.code || `http_${failure.status}`, failure.message || "refused");
      const user = signedIn(headers), table = address.pathname.slice("/rest/v1/".length), params = address.searchParams;
      if (!user) return restFail(401, "PGRST303", "JWT expired");
      if (init.method === "POST" && KEYS[table]) return upsert(table, user, params, headers, body, address);
      if (init.method === "GET" && KEYS[table]) return readRows(table, user, params, address);
      if (init.method === "GET" && table === "crews") return readCrews(user, params, address);
      nothingAnswers(init.method, address);
    }
    const captchaMissing = fake.captcha && !(body && body.gotrue_meta_security && body.gotrue_meta_security.captcha_token);

    switch (`${init.method} ${address.pathname}${address.search}`) {
      case "POST /auth/v1/signup": {
        if (captchaMissing) return fail(400, "captcha_failed", "captcha protection: request disallowed (no captcha_token found)");
        if (fake.anonymousOff) return fail(422, "anonymous_provider_disabled", "Anonymous sign-ins are disabled");
        return answer(200, session(newUser("", true)));
      }
      case "PUT /auth/v1/user": {
        const user = signedIn(headers);
        if (!user) return fail(403, "bad_jwt", "invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired");
        const other = holder(body.email);
        if (other && other.id !== user.id) return fail(422, "email_exists", "A user with this email address has already been registered");
        codes.set(body.email, { type: "email_change", id: user.id });
        return answer(200, { id: user.id, email: user.email, new_email: body.email, is_anonymous: user.is_anonymous });
      }
      case "POST /auth/v1/otp": {
        if (captchaMissing) return fail(400, "captcha_failed", "captcha protection: request disallowed (no captcha_token found)");
        const user = holder(body.email);
        if (!user && body.create_user === false) return fail(422, "otp_disabled", "Signups not allowed for otp");
        codes.set(body.email, { type: "email", id: user.id });
        return answer(200, {});
      }
      case "POST /auth/v1/verify": {
        const sent = codes.get(body.email);
        if (!sent || sent.type !== body.type || body.token !== CODE) return fail(403, "otp_expired", "Token has expired or is invalid");
        codes.delete(body.email);
        const user = users.get(sent.id);
        if (body.type === "email_change") Object.assign(user, { email: body.email, is_anonymous: false });
        return answer(200, session(user));
      }
      case "POST /auth/v1/token?grant_type=refresh_token": {
        const id = refresh.get(body.refresh_token);
        if (!id) return fail(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
        refresh.delete(body.refresh_token);
        return answer(200, session(users.get(id)));
      }
      case "POST /auth/v1/logout?scope=local": {
        const user = signedIn(headers);
        if (!user) return fail(403, "bad_jwt", "invalid JWT");
        access.delete(headers.Authorization.replace(/^Bearer /, ""));
        return answer(204);
      }
      default:
        throw new Error(`fakeBackend: nothing answers ${init.method} ${address.pathname}${address.search}`);
    }
  };
  return fake;
}
