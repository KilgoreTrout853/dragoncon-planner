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
   crews with their members and their tokens, the oldest first. The crews'
   three RPCs (docs/sync/contract.md, sections 3 and 8): create_crew and
   join_crew answer the crew, one object, and regenerate_invite the new
   token, a JSON string; their errors carry the status PostgREST gives each
   code - P0002 and 53400 are 500, 42501 403, 22023 and 23514 400. And the
   fourth, delete_my_account (DECISIONS #93), which takes no argument and
   answers 204 with no body: the caller's user goes, with their picks and
   follows, their place in every crew, their refresh tokens and any code
   waiting for them; a crew they made goes too if it holds no one else, and
   one that does stays with no creator. Their access tokens go on being
   read by PostgREST until refuse(token), as a real one is until it expires,
   as a deleted user's: the reads answer nothing, an upsert and a crew made
   or joined 409 23503, the foreign key's refusal, and the same call again
   204; the Auth server answers them 403 user_not_found, and their refresh
   400. And the two deletes,
   judged as the policies judge them: a member leaves, and the creator, while
   a member, removes anyone and deletes the crew, its memberships with it;
   anything else deletes nothing, and every delete answers 204 with no body,
   as row-level security does. And the one update, a member's own display
   name, by crew and user: any other column refused, 403 42501, as the grant
   refuses it; a name the table's check refuses, 400 23514; any row but the
   caller's own not changed, and the answer the same 204. Checked against a
   real PostgREST, 14.5, and the Auth server, on the CLI's local stack.

   Knobs a test sets: captcha (the project demands a captcha token),
   anonymousOff (anonymous sign-ins switched off), offline (the network is
   gone: true, or a test of each request), fail (a test of each request that
   returns {status, code} for the server to answer with, or nothing - a
   status of 204 alone answers with no body and acts on nothing, as
   row-level security answers a write it turned away),
   defer (a test of each request: one it holds is not answered, nor acted
   on, until release()), onRequest (called with each request as it arrives
   - another tab, acting meanwhile), maxRows, clockOffset (ms the
   server's clock is ahead of the test's) and flags (crew_size_cap, which
   join_crew reads; absent, a crew takes no one). held(email) makes a user who already holds an address;
   issue(id) a session for a user, as another tab would hold it;
   refuse(token) makes the server refuse an access token as expired;
   revoke(token) kills a refresh token. write(user, table, row) is a write
   by another device or a crewmate, judged as the page's are; crew(...),
   join(...), leave(...) and rename(...) make and change crews behind the
   page's back; erase(id) is delete_my_account called from another phone;
   rows(table) is what the server holds, "crews" among them. */
export const CODE = "123456";

export function fakeBackend({ url = "https://backend.test", key = "sb_publishable_test" } = {}) {
  const users = new Map(), access = new Map(), refresh = new Map(), codes = new Map(), refused = new Set(), gone = new Set();
  const requests = [];
  let n = 0;
  const tables = { picks: [], follows: [] }, crews = [], deferred = [];
  let lastStamp = 0;
  /* an invite as the server makes one: 22 url-safe characters */
  const newToken = () => `tok${String(++n).padStart(19, "0")}`;

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
  /* whose token a request carries, while the server still reads it; and
     that user, or for one since deleted a caller with their id and no row */
  function tokenOf(headers) {
    const token = String(headers.Authorization || "").replace(/^Bearer /, "");
    return access.has(token) && !refused.has(token) ? access.get(token) : null;
  }
  const signedIn = headers => users.get(tokenOf(headers)) || null;
  const caller = headers => { const id = tokenOf(headers); return users.get(id) || (gone.has(id) ? { id, gone: true } : null); };
  /* the Auth server's refusal of a token: one it cannot read, or one whose user is gone */
  const noUser = headers => (gone.has(tokenOf(headers)) ? fail(403, "user_not_found", "User from sub claim in JWT does not exist")
    : fail(403, "bad_jwt", "invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired"));
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
  /* the foreign key to auth.users, for a write as a user since deleted */
  const noSuchUser = (table, key) => restFail(409, "23503", `insert or update on table "${table}" violates foreign key constraint "${table}_${key}_fkey"`);
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
    if (user.gone) return noSuchUser(table, "user_id");
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

  /* The caller's crews of a year, the oldest first, with their tokens and
     their members embedded. */
  function readCrews(user, params, address) {
    const year = /^eq\.(\d+)$/.exec(params.get("year") || "");
    if (params.get("select") !== "id,name,creator,invite_token,crew_members(user_id,display_name)" || params.get("order") !== "created_at.asc,id.asc"
        || [...params.keys()].length !== 3 || !year) nothingAnswers("GET", address);
    const mine = crews.filter(c => c.year === Number(year[1]) && c.members.some(m => m.user_id === user.id))
      .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return answer(200, mine.map(c => ({ id: c.id, name: c.name, creator: c.creator, invite_token: c.invite_token,
      crew_members: c.members.map(m => ({ user_id: m.user_id, display_name: m.display_name })) })));
  }

  /* A crew as the database makes one: an id, its token, created_at the
     server's clock. */
  function makeCrew({ year, name, creator, members }) {
    const c = { id: `00000000-0000-4000-b000-${String(++n).padStart(12, "0")}`, year, name, invite_token: newToken(), creator,
      created_at: stamp(), members: members.map(([user_id, display_name]) => ({ user_id, display_name })) };
    crews.push(c);
    return c;
  }
  /* The crew as an RPC returns it: the table's row, one object. */
  const crewRow = c => ({ id: c.id, year: c.year, name: c.name, invite_token: c.invite_token, creator: c.creator, created_at: c.created_at });
  /* btrim(), which trims spaces alone, and the tables' checks: already
     trimmed, and 1 to max characters, counted by code point. */
  const btrim = v => String(v).replace(/^ +| +$/g, "");
  const fits = (v, max) => v === btrim(v) && [...v].length >= 1 && [...v].length <= max;
  const nameCheck = table => restFail(400, "23514", table === "crews" ? 'new row for relation "crews" violates check constraint "crews_name_check"'
    : 'new row for relation "crew_members" violates check constraint "crew_members_display_name_check"');

  /* delete_my_account(), and erase(): a crew the user made that holds no
     one else, then the user and what the foreign keys take with them - a
     crew that stays loses its creator. A user already gone: nothing. */
  function erase(id) {
    for (let at = crews.length - 1; at >= 0; at--) if (crews[at].creator === id && !crews[at].members.some(m => m.user_id !== id)) crews.splice(at, 1);
    if (!users.delete(id)) return;
    gone.add(id);
    for (const table of Object.keys(tables)) tables[table] = tables[table].filter(r => r.user_id !== id);
    for (const c of crews) {
      c.members = c.members.filter(m => m.user_id !== id);
      if (c.creator === id) c.creator = null;
    }
    for (const [token, user] of refresh) if (user === id) refresh.delete(token);
    for (const [email, sent] of codes) if (sent.id === id) codes.delete(email);
  }

  /* The four RPCs, each with the arguments its signature names and no
     others - delete_my_account with none, in an empty object or no body at
     all. A security definer's rules, not row-level security's:
     regenerate_invite asks only that the caller be the creator. */
  const ARGS = { create_crew: ["display_name", "name", "year"], join_crew: ["display_name", "token"], regenerate_invite: ["crew_id"], delete_my_account: [] };
  function rpc(name, user, params, body, address) {
    if (name === "delete_my_account" && body === undefined) body = {};
    if (!ARGS[name] || [...params.keys()].length || !body || Array.isArray(body) || Object.keys(body).sort().join() !== ARGS[name].join()) nothingAnswers("POST", address);
    if (name === "delete_my_account") {
      erase(user.id);
      return answer(204);
    }
    if (name === "create_crew") {
      if (!Number.isInteger(body.year) || body.year < 2026 || body.year > 2099) return restFail(400, "22023", `no such year: ${body.year}`);
      const crewName = btrim(body.name), displayName = btrim(body.display_name);
      if (!fits(crewName, 40)) return nameCheck("crews");
      if (user.gone) return noSuchUser("crews", "creator");
      if (!fits(displayName, 24)) return nameCheck("crew_members");
      return answer(200, crewRow(makeCrew({ year: body.year, name: crewName, creator: user.id, members: [[user.id, displayName]] })));
    }
    if (name === "join_crew") {
      const c = crews.find(x => x.invite_token === body.token);
      if (!c) return restFail(500, "P0002", "no crew has that invite");
      if (c.members.some(m => m.user_id === user.id)) return answer(200, crewRow(c));
      const cap = fake.flags && fake.flags.crew_size_cap;
      if (c.members.length >= (Number.isInteger(cap) ? cap : 0)) return restFail(500, "53400", "the crew is full");
      const displayName = btrim(body.display_name);
      if (!fits(displayName, 24)) return nameCheck("crew_members");
      if (user.gone) return noSuchUser("crew_members", "user_id");
      c.members.push({ user_id: user.id, display_name: displayName });
      return answer(200, crewRow(c));
    }
    const c = crews.find(x => x.id === body.crew_id && x.creator === user.id);
    if (!c) return restFail(403, "42501", "only the crew's creator can do that");
    c.invite_token = newToken();
    return answer(200, c.invite_token);
  }

  /* The two deletes, a row by its key, judged as the policies judge them: a
     crew and its members are read by its members alone, so the creator
     removes and deletes only while one; what the caller may not delete is
     not deleted, and the answer is the same 204. */
  function remove(table, user, params, address) {
    const eq = key => { const m = /^eq\.(.+)$/.exec(params.get(key) || ""); return m ? m[1] : null; };
    const keys = [...params.keys()].sort().join();
    if (table === "crew_members" && keys === "crew_id,user_id" && eq("crew_id") && eq("user_id")) {
      const c = crews.find(x => x.id === eq("crew_id")), target = eq("user_id");
      if (c && c.members.some(m => m.user_id === user.id) && (target === user.id || c.creator === user.id)) {
        c.members = c.members.filter(m => m.user_id !== target);
      }
      return answer(204);
    }
    if (table === "crews" && keys === "id" && eq("id")) {
      const at = crews.findIndex(x => x.id === eq("id"));
      if (at >= 0 && crews[at].creator === user.id && crews[at].members.some(m => m.user_id === user.id)) crews.splice(at, 1);
      return answer(204);
    }
    nothingAnswers("DELETE", address);
  }

  /* The update, a row of crew_members by its key: the grant reaches
     display_name alone, row-level security the caller's own row alone, and
     the table's check judges the name only on a row it changes. */
  function update(table, user, params, body, address) {
    const eq = key => { const m = /^eq\.(.+)$/.exec(params.get(key) || ""); return m ? m[1] : null; };
    if (table !== "crew_members" || [...params.keys()].sort().join() !== "crew_id,user_id" || !eq("crew_id") || !eq("user_id")
        || !body || Array.isArray(body) || !Object.keys(body).length) nothingAnswers("PATCH", address);
    if (Object.keys(body).some(k => k !== "display_name")) return restFail(403, "42501", "permission denied for table crew_members");
    if (typeof body.display_name !== "string") nothingAnswers("PATCH", address);
    const c = crews.find(x => x.id === eq("crew_id")), own = c && eq("user_id") === user.id ? c.members.find(m => m.user_id === user.id) : null;
    if (!own) return answer(204);
    if (!fits(body.display_name, 24)) return nameCheck("crew_members");
    own.display_name = body.display_name;
    return answer(204);
  }

  const fake = {
    url, key, requests, users,
    captcha: false, anonymousOff: false, offline: false, fail: null, defer: null, onRequest: null, maxRows: 1000, clockOffset: 0,
    flags: { crew_size_cap: 25 },
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
    rows: table => (table === "crews" ? crews.map(c => ({ ...c, members: c.members.map(m => ({ ...m })) })) : tables[table].map(r => ({ ...r }))),
    crew: ({ year = 2026, name = "Crew", creator, members }) => makeCrew({ year, name, creator, members }),
    join: (crew, userId, name) => { crew.members.push({ user_id: userId, display_name: name }); },
    leave: (crew, userId) => { crew.members = crew.members.filter(m => m.user_id !== userId); },
    rename: (crew, userId, name) => { crew.members.find(m => m.user_id === userId).display_name = name; },
    erase,
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
      if (failure && failure.status === 204) return answer(204);
      if (failure) return restFail(failure.status, failure.code || `http_${failure.status}`, failure.message || "refused");
      const user = caller(headers), table = address.pathname.slice("/rest/v1/".length), params = address.searchParams;
      if (!user) return restFail(401, "PGRST303", "JWT expired");
      if (init.method === "POST" && KEYS[table]) return upsert(table, user, params, headers, body, address);
      if (init.method === "GET" && KEYS[table]) return readRows(table, user, params, address);
      if (init.method === "GET" && table === "crews") return readCrews(user, params, address);
      if (init.method === "POST" && table.startsWith("rpc/")) return rpc(table.slice("rpc/".length), user, params, body, address);
      if (init.method === "DELETE") return remove(table, user, params, address);
      if (init.method === "PATCH") return update(table, user, params, body, address);
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
        if (!user) return noUser(headers);
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
        if (!user) return noUser(headers);
        access.delete(headers.Authorization.replace(/^Bearer /, ""));
        return answer(204);
      }
      default:
        throw new Error(`fakeBackend: nothing answers ${init.method} ${address.pathname}${address.search}`);
    }
  };
  return fake;
}
