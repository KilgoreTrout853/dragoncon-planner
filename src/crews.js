import { YEAR } from "./season.js";
import { loadJSON, readSession, removeJSON, saveJSON, writeSession } from "./storage.js";
import { storageKey } from "./build.js";
import { BackendError, callBackendAsUser, hasBackend, storedSession } from "./backend.js";
import { ensureUser, plainMessage } from "./identity.js";

/* ==================================================================
   Crews, the client's layer (DECISIONS #10, #50, #56; docs/sync/contract.md,
   section 8): the reader's crews and their crewmates' picks as the last pull
   kept them, the seven things a reader can do to a crew, the invite link, and
   what the crew screens draw from. No screen here: the crew header and the
   crew's day are plans.js's, the crew panel and who's going sheet.js's, the
   Now tab's crew section now.js's and the Map's crew count map.js's (#62).

   The two keys are this module's, and sync writes them through it, as the
   pull writes picks and follows through applyPulledPicks(): the crews under
   storageKey("crew") and the crewmates' picks, by user and then event, under
   storageKey("crewPicks"). Both are read at every call, never as the module
   is imported.

   An action is one request made as the user, and returns the server's
   answer. It writes nothing on the phone - the next pull brings what
   changed - so a failure leaves local state as it was by construction
   (#51). The two that may need a user, create and join, mint one first:
   the first tap that needs one (section 1). None runs a sync; the screen's
   handler does, after the action, as the email step's does. Who may do what
   is the policies' to hold: the client refuses what they would refuse only
   as a courtesy, to say why before a request is spent on it.
   ================================================================== */
const CREW_KEY = storageKey("crew"), CREW_PICKS_KEY = storageKey("crewPicks"), JOIN_KEY = storageKey("join");

/* The reader's crews of the year, as the last pull kept them, the oldest
   first: [{id, name, creator, invite_token, members: [{user_id,
   display_name}]}]. */
function myCrews() {
  const crews = loadJSON(CREW_KEY, []);
  return Array.isArray(crews) ? crews : [];
}
const crewPicksKept = () => loadJSON(CREW_PICKS_KEY, {}) || {};
const reader = () => { const session = storedSession(); return session ? session.user.id : null; };
function isCreator(crew) { const user = reader(); return !!(user && crew && crew.creator === user); }

/* Everyone the reader shares a crew with, by id. */
const matesOf = (crews, user) => new Set(crews.flatMap(c => (c.members || []).map(m => m.user_id)).filter(id => id !== user));

/* The pull's (sync.js): whether the crews it read hold anyone the kept ones
   do not - a newcomer, whose picks are older than the watermark, so the
   picks are read whole. */
function crewGained(crews, user) {
  const before = matesOf(myCrews(), user);
  return [...matesOf(crews, user)].some(id => !before.has(id));
}
/* The two keys as a screen draws them, so that the same crews read twice
   compare equal: each crew's members by id - the pull reads them in no
   order - and each crewmate's stars alone, by id. */
const byFirst = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
const drawnAs = (crews, theirs) => JSON.stringify([
  crews.map(c => [c.id, c.name, c.creator, c.invite_token, (c.members || []).map(m => [m.user_id, m.display_name]).sort(byFirst)]),
  Object.entries(theirs).map(([id, going]) => [id, Object.keys(going).filter(e => going[e] === true).sort()]).filter(([, stars]) => stars.length).sort(byFirst),
]);
const NOTHING_DRAWN = drawnAs([], {});
/* And its write, with the rest of what it applies: the crews as it read
   them, and the crewmates' picks - a departed member's all dropped, a
   crewmate's star kept and an unstar taking it out. The reader's own rows
   are the picks' (applyPulledPicks()). Whether a screen would draw anything
   differently now, as applyPulledPicks() says of the picks. */
function applyPulledCrews(crews, rows, user) {
  const theirs = crewPicksKept(), before = drawnAs(myCrews(), theirs);
  const mates = matesOf(crews, user);
  for (const id of Object.keys(theirs)) if (!mates.has(id)) delete theirs[id];
  for (const r of rows) {
    if (r.user_id === user || !mates.has(r.user_id)) continue;
    const going = theirs[r.user_id] || (theirs[r.user_id] = {});
    if (r.picked) going[r.event_id] = true; else delete going[r.event_id];
  }
  saveJSON(CREW_KEY, crews);
  saveJSON(CREW_PICKS_KEY, theirs);
  return drawnAs(crews, theirs) !== before;
}
/* A new owner, or no session: nothing of the crews is kept. Whether there
   was anything a screen drew. */
function forgetCrews() {
  const drew = drawnAs(myCrews(), crewPicksKept()) !== NOTHING_DRAWN;
  removeJSON(CREW_KEY);
  removeJSON(CREW_PICKS_KEY);
  return drew;
}

/* Each crewmate once - never the reader, whose own star already says they
   are going - with the display name the first crew that holds them gives. */
function crewmates() {
  const user = reader(), people = new Map();
  for (const crew of myCrews()) {
    for (const m of crew.members || []) {
      if (m.user_id !== user && !people.has(m.user_id)) people.set(m.user_id, {user_id: m.user_id, display_name: m.display_name});
    }
  }
  return [...people.values()].sort((a, b) => String(a.display_name).localeCompare(String(b.display_name)) || (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0));
}
/* Who's going: the crewmates whose picks hold the event, by name. */
function goingTo(eventId) {
  const theirs = crewPicksKept();
  return crewmates().filter(p => !!theirs[p.user_id] && theirs[p.user_id][eventId] === true).map(p => ({...p}));
}
/* One crewmate's stars, as the pull kept them: event ids. None for the
   reader, whose own are the picks, or for anyone the reader shares no crew
   with. */
function crewmatePicks(userId) {
  const going = crewPicksKept()[userId] || {};
  return Object.keys(going).filter(id => going[id] === true);
}
/* The reader's own row in a crew: {user_id, display_name}, the name that
   crew gives them, or null. */
function myMembership(crew) {
  const user = reader(), row = user && crew ? (crew.members || []).find(m => m.user_id === user) : null;
  return row ? {user_id: row.user_id, display_name: row.display_name} : null;
}
/* Your crew's picks right now (W23): each crewmate's pick on at `at`, else
   their next one today - today the con day `today`, anything still running
   counted in it, the rule Now's own hero keeps. The schedule is the
   caller's, data.js `events`, in start order and with no removed event,
   since this module comes before the schedule and the clock: a pick it
   does not hold is no one's. A cancelled pick is passed over, as Now's own
   hero passes over one (#90) - by its flag, asked here, since data.js's
   happening() stands after this module. What is left of a crewmate's day
   is in start order, so its first is the one on now where one is - of two,
   the earlier start - and else the next. [{user_id, display_name, ev,
   on}], by start - which puts every pick on now before every next one -
   and then as crewmates() orders them, by name; a crewmate with nothing
   left today is not there. */
function crewRightNow(schedule, at, today) {
  const theirs = crewPicksKept(), lines = [];
  for (const p of crewmates()) {
    const going = theirs[p.user_id];
    if (!going) continue;
    const ev = schedule.find(e => going[e.id] === true && !e.cancelled && e._e > at && (e._cd === today || e._s <= at));
    if (ev) lines.push({...p, ev, on: ev._s <= at});
  }
  return lines.sort((a, b) => a.ev._s - b.ev._s);
}
/* The overlay's map: every event a crewmate starred, to the same list. */
function crewmatesByEvent() {
  const theirs = crewPicksKept(), going = new Map();
  for (const p of crewmates()) {
    for (const [id, picked] of Object.entries(theirs[p.user_id] || {})) {
      if (picked !== true) continue;
      if (!going.has(id)) going.set(id, []);
      going.get(id).push({...p});
    }
  }
  return going;
}

/* The invite link: the page's own address, its query ?join=<year>.<token> -
   the year, so that a build of another year refuses the link before any
   request. The address is read only to point the link back at the site the
   sharer is on; nothing is decided by it (#15). The sharer's ?now= and hash
   stay behind. "" for a crew with no token kept. */
function inviteLink(crew) {
  return crew && crew.invite_token ? new URL(`?join=${YEAR}.${encodeURIComponent(crew.invite_token)}`, location.href).href : "";
}
/* An invite from what the reader holds: the <year>.<token> a link carries in
   join=, as it was kept, or the whole link, pasted: an iPhone opens a link
   in the browser, not in the home-screen app, whose storage is its own, so
   that app's reader pastes one (contract, Open). The message a share sends
   is pasted whole too, the crew's name first and its link last, so the last
   join= is the one read: a name cannot stand in for the link. {year,
   token}, or null for anything else. */
function readInvite(text) {
  let value = String(text || "").trim();
  const inLink = [...value.matchAll(/[?&]join=([^&#\s]*)/g)].pop();
  if (inLink) {
    try { value = decodeURIComponent(inLink[1]); } catch (e) { return null; }
  }
  const found = /^(\d{4})\.([A-Za-z0-9_-]+)$/.exec(value);
  return found ? {year: Number(found[1]), token: found[2]} : null;
}
/* boot()'s, beside the time override: an invite in the address is kept for
   the tab's session until a screen takes it, so a reload before the join
   lands still has it, and is taken out of the address, ?now= and the hash
   left as they were. The address wins over what the session kept. With no
   backend it goes and nothing is kept: the 2026 app knows no crews. Nothing
   here joins; a screen does. */
function readJoinLink() {
  const value = new URLSearchParams(location.search).get("join");
  if (value === null) return;
  if (!hasBackend) writeSession(JOIN_KEY, null);
  else if (value.trim()) writeSession(JOIN_KEY, value.trim());
  const rest = location.search.replace(/^\?/, "").split("&").filter(p => p && p !== "join" && !p.startsWith("join="));
  /* The whole address with its query replaced, not the path and a query: a
     path that begins "//" would read as another host, and replaceState
     would throw at boot. */
  const address = new URL(location.href);
  address.search = rest.length ? "?" + rest.join("&") : "";
  history.replaceState(null, "", address.href);
}
function pendingJoin() { return readSession(JOIN_KEY) || ""; }
function takePendingJoin() {
  const invite = pendingJoin();
  writeSession(JOIN_KEY, null);
  return invite;
}

/* A name as the tables check it: trimmed, and 1 to max characters counted
   as Postgres counts them, by code point - an emoji is one. Refused before
   any request. */
function bounded(value, max, code) {
  const name = String(value || "").trim(), length = [...name].length;
  if (length < 1 || length > max) throw new BackendError(code);
  return name;
}
/* The reader and a crew as kept, for an action on it: who made it has to be
   known, so a crew the phone does not hold is refused. */
function kept(crewId) {
  const user = reader();
  if (!user) throw new BackendError("session_lost");
  const crew = myCrews().find(c => c.id === crewId);
  if (!crew) throw new BackendError("no_crew");
  return {user, crew};
}
const eq = value => `eq.${encodeURIComponent(value)}`;

/* A crew of the year, the reader its creator and first member. The crew as
   the server made it, its token with it. */
async function createCrew(name, displayName) {
  const body = {year: YEAR, name: bounded(name, 40, "bad_crew_name"), display_name: bounded(displayName, 24, "bad_display_name")};
  await ensureUser();
  return callBackendAsUser("/rest/v1/rpc/create_crew", {body});
}
/* Join by an invite, kept or pasted: the crew, or the crew as it was to a
   member already in it. */
async function joinCrew(invite, displayName) {
  const found = readInvite(invite);
  if (!found) throw new BackendError("bad_invite");
  if (found.year !== YEAR) throw new BackendError("other_year");
  const display_name = bounded(displayName, 24, "bad_display_name");
  await ensureUser();
  return callBackendAsUser("/rest/v1/rpc/join_crew", {body: {token: found.token, display_name}});
}
/* A new invite, the creator's alone; the old link joins nothing after it.
   The new token. */
async function newInvite(crewId) {
  const {user, crew} = kept(crewId);
  if (crew.creator !== user) throw new BackendError("not_creator");
  try { return await callBackendAsUser("/rest/v1/rpc/regenerate_invite", {body: {crew_id: crewId}}); }
  catch (e) { throw e.code === "42501" ? new BackendError("not_creator", e.status, e.message) : e; }
}
/* Leave: one's own membership. The creator cannot leave - the creator's
   Leave is Delete crew. */
async function leaveCrew(crewId) {
  const {user, crew} = kept(crewId);
  if (crew.creator === user) throw new BackendError("creator_leaves");
  return callBackendAsUser(`/rest/v1/crew_members?crew_id=${eq(crewId)}&user_id=${eq(user)}`, {method: "DELETE"});
}
/* Remove a member, the creator's alone; the creator removing themselves
   would be a leave. */
async function removeMember(crewId, userId) {
  const {user, crew} = kept(crewId);
  if (crew.creator !== user) throw new BackendError("not_creator");
  if (userId === user) throw new BackendError("creator_leaves");
  return callBackendAsUser(`/rest/v1/crew_members?crew_id=${eq(crewId)}&user_id=${eq(userId)}`, {method: "DELETE"});
}
/* Delete the crew, the creator's alone; its memberships go with it. */
async function deleteCrew(crewId) {
  const {user, crew} = kept(crewId);
  if (crew.creator !== user) throw new BackendError("not_creator");
  return callBackendAsUser(`/rest/v1/crews?id=${eq(crewId)}`, {method: "DELETE"});
}
/* The reader's own name in one crew, a member's alone: an update of their
   own row, found by the crew and the reader both - by the reader alone it
   would rename them in every crew they are in. Row-level security turns
   any other row away and answers 204 as it does for one it changed, so
   the pull, not the answer, says whether the name took. */
async function setMyName(crewId, displayName) {
  const {user, crew} = kept(crewId);
  if (!myMembership(crew)) throw new BackendError("not_member");
  const display_name = bounded(displayName, 24, "bad_display_name");
  return callBackendAsUser(`/rest/v1/crew_members?crew_id=${eq(crewId)}&user_id=${eq(user)}`, {method: "PATCH", body: {display_name}});
}

/* Every failure of a crew action in plain words: the RPCs' codes (contract,
   section 3, as built), this module's own, and identity's words for the
   rest - offline, the session, signing in. */
const CREW_PLAIN = {
  P0002: "That invite doesn't work any more - ask for a new link.",
  "53400": "That crew is full.",
  not_creator: "Only the crew's creator can do that.",
  bad_crew_name: "A crew's name is 1 to 40 characters.",
  bad_display_name: "Your name in the crew is 1 to 24 characters.",
  other_year: "That invite is for another year's con - ask for a new link.",
  bad_invite: "That doesn't look like an invite link.",
  creator_leaves: "You made this crew, so you can't leave it - you can delete it instead.",
  no_crew: "That crew isn't on this phone any more - it may have been deleted.",
  not_member: "You're not in this crew any more.",
};
function crewMessage(error) { return CREW_PLAIN[error && error.code] || plainMessage(error); }

export {
  myCrews, isCreator, crewGained, applyPulledCrews, forgetCrews, goingTo, crewmatePicks, myMembership, crewRightNow, crewmatesByEvent,
  inviteLink, readInvite, readJoinLink, pendingJoin, takePendingJoin,
  createCrew, joinCrew, newInvite, leaveCrew, removeMember, deleteCrew, setMyName, crewMessage,
};
