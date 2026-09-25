import { loadJSON, removeJSON, saveJSON } from "./storage.js";
import { storageKey } from "./build.js";

/* ==================================================================
   The backend: the Supabase project the build names, and every request the
   page makes to it (DECISIONS #51, #53; docs/sync/contract.md, section 1,
   as built). DC_SUPABASE_URL and DC_SUPABASE_KEY, the project's address
   and its public key, reach it through the build - dcBackend(), in
   build/vite-dc.js. A build given neither has no backend: hasBackend is
   false, nothing here sends anything, and the app is the 2026 app.

   By fetch, with no library (#53): every request carries the public key,
   one made as the user carries the session's token too, and sync's
   upserts carry PostgREST's Prefer header (outbox.js). An answer
   that is not ok becomes a BackendError with the server's error code. The
   session is kept under storageKey("session") and read afresh at every
   use, so a tab never holds a token another tab has rotated away. It is
   refreshed only when the server refuses its token - never by the clock -
   and dropped only when the refresh itself is refused.
   ================================================================== */
const BACKEND_URL = __DC_SUPABASE_URL__, BACKEND_KEY = __DC_SUPABASE_KEY__;
const hasBackend = !!BACKEND_URL;
const SESSION_KEY = storageKey("session");

/* code: the server's error code, or one of the page's own - offline,
   no_backend, session_lost and the email step's; status: the HTTP status,
   0 where no answer came. */
class BackendError extends Error {
  constructor(code, status = 0, message = "") {
    super(message || code);
    this.name = "BackendError";
    this.code = code;
    this.status = status;
  }
}

/* The Auth server answers an error as {code, error_code, msg}, or as {code,
   message} when asked for its newer shape; PostgREST as {code, message}. */
const errorCode = (data, status) => (data && typeof data.code === "string" && data.code) || (data && data.error_code) || `http_${status}`;

/* The one door out: path is under the project's address, body is sent as
   JSON, token is the user's, for a request made as them, and prefer is
   PostgREST's Prefer header, for a request that needs one. */
async function callBackend(path, {method = "POST", body, token, prefer} = {}) {
  if (!hasBackend) throw new BackendError("no_backend");
  const headers = {apikey: BACKEND_KEY};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  if (prefer) headers.Prefer = prefer;
  let res;
  try { res = await fetch(BACKEND_URL + path, {method, headers, body: body === undefined ? undefined : JSON.stringify(body)}); }
  catch (e) { throw new BackendError("offline"); }
  let data = null;
  try { const text = await res.text(); data = text ? JSON.parse(text) : null; } catch (e) { /* no body, or not JSON */ }
  if (!res.ok) throw new BackendError(errorCode(data, res.status), res.status, data && (data.msg || data.message));
  return data;
}

/* The session as the server gave it, cut to what the app reads: the two
   tokens and who they are for. */
function storedSession() {
  const s = loadJSON(SESSION_KEY, null);
  return s && s.access_token && s.refresh_token && s.user && s.user.id ? s : null;
}
function keepSession(data) {
  if (!data || !data.access_token || !data.refresh_token || !data.user || !data.user.id) throw new BackendError("bad_session");
  const session = {access_token: data.access_token, refresh_token: data.refresh_token,
    user: {id: data.user.id, email: data.user.email || "", is_anonymous: !!data.user.is_anonymous}};
  saveJSON(SESSION_KEY, session);
  return session;
}
function dropSession() { removeJSON(SESSION_KEY); }

/* The server's refusal of the token itself: Auth's bad_jwt or
   session_not_found, or any 401 - PostgREST's for an expired token. */
const tokenRefused = e => e.status === 401 || (e.status === 403 && (e.code === "bad_jwt" || e.code === "session_not_found"));

/* A fresh session for one the server refused, shared by every request that
   meets the refusal while it is out. Refused itself - 400, 401, 403 or 404 -
   the session is lost and dropped; offline, rate-limited or a server's
   error, it is kept for the next try. If another tab refreshed first, its
   session is the one to use. */
let refreshing = null;
function refreshSession(refused) {
  if (!refreshing) {
    refreshing = callBackend("/auth/v1/token?grant_type=refresh_token", {body: {refresh_token: refused.refresh_token}})
      .then(keepSession, e => {
        const current = storedSession();
        if (current && current.refresh_token !== refused.refresh_token) return current;
        if ([400, 401, 403, 404].includes(e.status)) { dropSession(); throw new BackendError("session_lost", e.status); }
        throw e;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

/* A request made as the user: with the session's token, and once more with
   a fresh one if the server refuses it. */
async function callBackendAsUser(path, options = {}) {
  const session = storedSession();
  if (!session) throw new BackendError("session_lost");
  try { return await callBackend(path, {...options, token: session.access_token}); }
  catch (e) {
    if (!tokenRefused(e)) throw e;
    const current = storedSession();
    if (!current) throw new BackendError("session_lost");
    const fresh = current.access_token !== session.access_token ? current : await refreshSession(current);
    return callBackend(path, {...options, token: fresh.access_token});
  }
}

export { hasBackend, BackendError, callBackend, callBackendAsUser, storedSession, keepSession, dropSession };
