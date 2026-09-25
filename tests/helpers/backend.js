/* A fake of the Supabase Auth server, as far as the page talks to it
   (DECISIONS #53; docs/sync/contract.md, section 1, as built): anonymous
   sign-in, add, recover, verify, refresh and sign out, each answering with
   the status and error code the real server gives - checked against its
   source - and every request kept as it was sent, so a test pins exactly
   what the page asked for. Plain objects, not Response, so the built page's
   JSDOM can use it too. One code for every address, CODE.

   Knobs a test sets: captcha (the project demands a captcha token),
   anonymousOff (anonymous sign-ins switched off), offline (the network is
   gone: true, or a test of each request) and onRequest (called with each
   request as it arrives - another tab, acting meanwhile); held(email)
   makes a user who already holds an address; issue(id) a session for a
   user, as another tab would hold it; refuse(token) makes the server
   refuse an access token as expired; revoke(token) kills a refresh
   token. */
export const CODE = "123456";

export function fakeBackend({ url = "https://backend.test", key = "sb_publishable_test" } = {}) {
  const users = new Map(), access = new Map(), refresh = new Map(), codes = new Map(), refused = new Set();
  const requests = [];
  let n = 0;

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

  const fake = {
    url, key, requests, users,
    captcha: false, anonymousOff: false, offline: false, onRequest: null,
    held: email => newUser(email, false),
    issue: id => session(users.get(id)),
    refuse: token => refused.add(token),
    revoke: token => refresh.delete(token),
    /* the requests to one path, method and path as the page wrote them */
    to: path => requests.filter(r => r.path === path),
  };

  fake.fetch = async (input, init = {}) => {
    const address = new URL(String(input));
    if (address.origin !== url) throw new Error(`fakeBackend: the page asked ${address.origin}, not the backend`);
    const headers = { ...(init.headers || {}) };
    const body = init.body === undefined ? undefined : JSON.parse(init.body);
    const request = { method: init.method || "GET", path: address.pathname + address.search, headers, body };
    requests.push(request);
    if (fake.onRequest) fake.onRequest(request);
    if (typeof fake.offline === "function" ? fake.offline(request) : fake.offline) throw new TypeError("Failed to fetch");
    if (headers.apikey !== key) return answer(401, { message: "Invalid API key" });
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
