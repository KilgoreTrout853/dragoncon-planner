import { BackendError, callBackend, callBackendAsUser, dropSession, keepSession, storedSession } from "./backend.js";

/* ==================================================================
   Identity (DECISIONS #51, #53; docs/sync/contract.md, section 1): who the
   phone is to the backend, and the email step that keeps a plan. No user
   until the first tap that needs one; that tap mints an anonymous user,
   who is the device. The email step is one screen, one field and a
   six-digit code, for add and recover alike, and it is the one caller of
   ensureUser() until crews and notifications need a user too. Nothing here
   runs on load. Every request is backend.js's, and so is keeping the
   session; recover signs in and no more - carrying the plan up is sync's.
   ================================================================== */
let minting = null;     // the anonymous sign-in in flight, which every caller shares
let codeFor = null;     // {email, type} from a code sent until it is confirmed; the type says add or recover

/* The session, or a new anonymous user's: one sign-in request however many
   callers ask while it is out. */
function ensureUser() {
  const session = storedSession();
  if (session) return Promise.resolve(session);
  if (!minting) minting = callBackend("/auth/v1/signup", {body: {}}).then(keepSession).finally(() => { minting = null; });
  return minting;
}

/* Recover's request: true once the code is sent, false where no one holds
   the address. */
async function askForCode(email) {
  try { await callBackend("/auth/v1/otp", {body: {email, create_user: false}}); return true; }
  catch (e) { if (e.code === "otp_disabled") return false; throw e; }
}
/* Add's: true once the code is sent, false where someone else holds the
   address. */
async function askToAdd(email) {
  try { await callBackendAsUser("/auth/v1/user", {method: "PUT", body: {email}}); return true; }
  catch (e) { if (e.code === "email_exists") return false; throw e; }
}

/* Send a code by the door the address fits. With a session - an anonymous
   user's - the user gains the email in place: add; unless someone holds it
   already, and then the phone signs in as them: recover. With no session,
   recover; an address no one holds mints the anonymous user and adds it.
   One screen and one code for every case. A session lost on the way - an
   anonymous user the cleanup took - is gone, so the step goes once more,
   with none, and no more than once. Returns the address the code went to. */
async function sendCode(typed) {
  const email = String(typed || "").trim();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) throw new BackendError("bad_email");
  try { return await askByDoor(email); }
  catch (e) {
    if (e.code !== "session_lost") throw e;
    return askByDoor(email);
  }
}
async function askByDoor(email) {
  const session = storedSession();
  if (session && !session.user.is_anonymous) throw new BackendError("signed_in");
  codeFor = null;
  if (!session) {
    if (await askForCode(email)) return (codeFor = {email, type: "email"}).email;
    await ensureUser();
  }
  if (await askToAdd(email)) return (codeFor = {email, type: "email_change"}).email;
  if (await askForCode(email)) return (codeFor = {email, type: "email"}).email;
  throw new BackendError("otp_disabled");     // someone's a moment ago, and no one's now
}

/* The code, typed in. The session it earns replaces the phone's: the same
   user with the email added, or the user who holds the address. */
async function confirmCode(typed) {
  if (!codeFor) throw new BackendError("no_code");
  const token = String(typed || "").replace(/\s+/g, "");
  if (!/^\d{6,10}$/.test(token)) throw new BackendError("bad_code");
  const data = await callBackend("/auth/v1/verify", {body: {type: codeFor.type, email: codeFor.email, token}});
  codeFor = null;
  return keepSession(data);
}

/* Sign out, for a user signed in with an email and no one else: an
   anonymous user signed out could never come back. The session goes and
   nothing else - picks, follows and settings stay on the phone. The server
   is told, so the session dies there too, and the phone does not wait. */
function signOut() {
  const session = storedSession();
  if (!session || session.user.is_anonymous) return;
  dropSession();
  codeFor = null;
  callBackend("/auth/v1/logout?scope=local", {token: session.access_token}).catch(() => {});
}

/* Who the phone is signed in as: an email, or "" for no one and for an
   anonymous user. And where the last code went, while it waits. */
function signedInAs() { const s = storedSession(); return s && !s.user.is_anonymous ? s.user.email : ""; }
function codeSentTo() { return codeFor ? codeFor.email : ""; }

/* Every failure in plain words (#51: a network action fails visibly and
   leaves local state untouched). A captcha refusal is one of them: the app
   shows no widget until the project turns the captcha on (#53). */
const PLAIN = {
  offline: "Couldn't reach the server. Your plan is safe on this phone; try again when you have signal.",
  captcha_failed: "Signing in needs a check this app can't show yet. Please try again later.",
  anonymous_provider_disabled: "Signing in is switched off for now. Please try again later.",
  signup_disabled: "Signing in is switched off for now. Please try again later.",
  over_request_rate_limit: "Too many tries. Wait a few minutes, then try again.",
  over_email_send_rate_limit: "A code went to that address a moment ago. Wait a minute before asking for another.",
  otp_expired: "That code is wrong or has expired. Check it, or send a new one.",
  bad_code: "Enter the six-digit code from the email.",
  bad_email: "That doesn't look like an email address.",
  email_address_invalid: "That doesn't look like an email address.",
  email_address_not_authorized: "The server can't send a code to that address.",
  session_lost: "You were signed out. Enter your email to sign in again.",
};
function plainMessage(error) { return PLAIN[error && error.code] || "Something went wrong. Please try again."; }

export { ensureUser, sendCode, confirmCode, signOut, signedInAs, codeSentTo, plainMessage };
