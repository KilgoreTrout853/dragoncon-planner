import { YEAR } from "./season.js";
import { loadJSON, removeJSON, saveJSON } from "./storage.js";
import { storageKey } from "./build.js";
import { callBackendAsUser, hasBackend, storedSession } from "./backend.js";
import { plainMessage } from "./identity.js";
import {
  clearOutbox, drainNow, drainsSettled, holdDrains, outboxState, pendingKeys, releaseDrains, seedOutbox,
} from "./outbox.js";
import { applyPulledPicks, picks } from "./picks.js";
import { applyPulledFollows, followId, follows } from "./follows.js";
import { requestRender } from "./bus.js";

/* ==================================================================
   Sync (DECISIONS #53; docs/sync/contract.md, section 5): a run drains the
   outbox, then pulls what changed since the watermark - the reader's own
   picks and follows, and their crewmates' picks - and applies it. Picks and
   follows alone, one's own rows both ways: no settings, no view, no pickInfo
   or news. Nothing here without a backend and a session.

   A run starts after the load, on every return to the page -
   visibilitychange and pageshow, ungated - on online, and on the worker's
   word that the network answers; there is no timer. One run at a time, and
   a trigger during one asks for one more after it. The outbox drains on its
   own after a tap (outbox.js), and the pull that follows is the next
   trigger's: the pull is above the outbox, and nothing but render() calls
   upward (#29).

   The watermark is the server's synced_at, per table, under
   storageKey("syncStamp") as {user, picks, follows}; a pull reads from a
   minute before it, since a write can commit after a later stamp was read,
   and a row applied twice changes nothing. A row of the reader's own that a
   pending op holds is passed over, and the watermark stops at it, so it is
   read again once the op has drained. Supabase answers at most 1,000
   rows a request, so a read pages. The crews are read first, with their
   members, under storageKey("crew") - data alone; the crew screens are
   their own pull requests - and when a crew has gained anyone since the last
   run the picks are read whole, since a newcomer's picks are older than the
   watermark. Crewmates' picks go under storageKey("crewPicks"), by user and
   then event, and a departed member's are dropped.

   The owner: when the session's user is not the one the watermark was
   kept for - a mint, a recover, a sign-in in another tab - the outbox is
   started afresh for them with the whole local state as adds, which is
   also recover's union, and the watermark and the crew's two keys start
   again. With no session they are all forgotten, so the next sign-in, even
   as the same user, sends the whole plan again.
   ================================================================== */
const STAMP_KEY = storageKey("syncStamp"), CREW_KEY = storageKey("crew"), CREW_PICKS_KEY = storageKey("crewPicks");
const OVERLAP_MS = 60000, PAGE = 1000;

let running = null;      // the run in flight
let again = false;       // a trigger during it
let lastRun = null;      // {ok: true} or {error}: how the last run ended

/* Every trigger's one call, and the email step's after it sends a code and
   after it confirms one. */
function runSync() {
  if (!hasBackend) return Promise.resolve();
  if (running) { again = true; return running; }
  running = syncOnce().finally(() => {
    running = null;
    if (again) { again = false; runSync(); }
  });
  return running;
}

async function syncOnce() {
  try {
    const session = storedSession();
    if (!session) { forgetSync(); return; }
    const user = session.user.id;
    let stamp = loadJSON(STAMP_KEY, null);
    if (!stamp || stamp.user !== user) stamp = adopt(user);
    await drainNow();
    await pull(user, stamp);
    lastRun = {ok: true};
  } catch (e) {
    lastRun = {error: e};
    if (e.code === "session_lost") forgetSync();
  } finally {
    fillSyncStatus();
  }
}

/* A new owner: the whole local plan goes up as adds, and the watermark and
   the crew start again. */
function adopt(user) {
  seedOutbox(user, {picks: [...picks], follows: follows.map(followId)});
  const stamp = {user, picks: null, follows: null};
  saveJSON(STAMP_KEY, stamp);
  removeJSON(CREW_KEY);
  removeJSON(CREW_PICKS_KEY);
  return stamp;
}
/* No session: nothing of sync's is kept. */
function forgetSync() {
  clearOutbox();
  removeJSON(STAMP_KEY);
  removeJSON(CREW_KEY);
  removeJSON(CREW_PICKS_KEY);
  lastRun = null;
  fillSyncStatus();
}

/* Every row of a table newer than since, less the overlap - every row with
   no since - a page at a time. */
async function readAll(table, columns, order, since) {
  const after = since ? `&synced_at=gt.${encodeURIComponent(new Date(new Date(since).getTime() - OVERLAP_MS).toISOString())}` : "";
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await callBackendAsUser(`/rest/v1/${table}?select=${columns}&year=eq.${YEAR}${after}&order=synced_at.asc,${order}&limit=${PAGE}&offset=${offset}`, {method: "GET"});
    rows.push(...(page || []));
    if (!page || page.length < PAGE) return rows;
  }
}
/* The newest synced_at among the rows, as the server wrote it - the last
   watermark where there are none - but no later than the first row passed
   over for a pending op: once the op has drained, the next pull reads that
   row again and applies whichever stamp won, where a watermark past it
   would leave the phone holding a change the server turned away. */
function watermark(rows, passed, last) {
  let mark = last;
  for (const r of rows) if (!mark || new Date(r.synced_at) > new Date(mark)) mark = r.synced_at;
  for (const r of passed) if (new Date(r.synced_at) < new Date(mark)) mark = r.synced_at;
  return mark;
}
const matesOf = (crew, user) => new Set(crew.flatMap(c => c.members.map(m => m.user_id)).filter(id => id !== user));

/* Read, then apply, with the drains held throughout: the crews, the picks -
   whole if a crew gained anyone - and the follows; then, in one go with no
   wait between, the reader's own rows that no pending op holds, the
   crewmates' picks, and the watermark. */
async function pull(user, stamp) {
  await holdDrains();
  try {
    const crews = await callBackendAsUser(`/rest/v1/crews?select=id,name,creator,crew_members(user_id,display_name)&year=eq.${YEAR}`, {method: "GET"});
    const crew = (crews || []).map(c => ({id: c.id, name: c.name, creator: c.creator,
      members: (c.crew_members || []).map(m => ({user_id: m.user_id, display_name: m.display_name}))}));
    const mates = matesOf(crew, user), before = matesOf(loadJSON(CREW_KEY, []) || [], user);
    const gained = [...mates].some(id => !before.has(id));
    const pickRows = await readAll("picks", "user_id,event_id,picked,changed_at,synced_at", "user_id.asc,event_id.asc", gained ? null : stamp.picks);
    const followRows = await readAll("follows", "kind,key,followed,changed_at,synced_at", "kind.asc,key.asc", stamp.follows);

    const pending = pendingKeys(), own = pickRows.filter(r => r.user_id === user);
    const heldPicks = own.filter(r => pending.picks.has(r.event_id)), heldFollows = followRows.filter(r => pending.follows.has(`${r.kind}:${r.key}`));
    const picksChanged = applyPulledPicks(own.filter(r => !pending.picks.has(r.event_id)));
    const followsChanged = applyPulledFollows(followRows.filter(r => !pending.follows.has(`${r.kind}:${r.key}`)));
    const theirs = loadJSON(CREW_PICKS_KEY, {}) || {};
    for (const id of Object.keys(theirs)) if (!mates.has(id)) delete theirs[id];
    for (const r of pickRows) {
      if (r.user_id === user || !mates.has(r.user_id)) continue;
      const going = theirs[r.user_id] || (theirs[r.user_id] = {});
      if (r.picked) going[r.event_id] = true; else delete going[r.event_id];
    }
    saveJSON(CREW_KEY, crew);
    saveJSON(CREW_PICKS_KEY, theirs);
    saveJSON(STAMP_KEY, {user, picks: watermark(pickRows, heldPicks, stamp.picks), follows: watermark(followRows, heldFollows, stamp.follows)});
    if (picksChanged || followsChanged) requestRender();
  } finally {
    releaseDrains();
  }
}

/* The status line in Keep your plan, only with a session: synced, what is
   waiting, offline, or the last failure in plain words. */
function syncStatusText() {
  if (!hasBackend || !storedSession()) return "";
  const {count, error} = outboxState();
  const failure = error || (lastRun && lastRun.error);
  const waiting = `${count} change${count === 1 ? "" : "s"} waiting`;
  if (failure && failure.code === "offline") return count ? `Offline, ${waiting}` : "Offline, nothing waiting";
  if (failure) return failure.status >= 500 ? "The server had a problem. Your changes are safe on this phone, and will be sent again."
    : failure.status >= 400 ? "The server turned your changes away. They're kept on this phone, and will be sent again."
      : plainMessage(failure);
  if (count) return waiting;
  return lastRun && lastRun.ok ? "Synced just now" : "";
}
function fillSyncStatus() {
  const line = document.getElementById("keepSync");
  if (!line) return;
  const text = syncStatusText();
  line.hidden = !text;
  line.textContent = text;
}

/* What boot() registers: the load's run and every trigger's, and the
   worker's word that the network answers. */
function onSyncTrigger() { runSync(); }
function onSyncWorkerMessage(e) { if (e.data && e.data.type === "schedule-online") runSync(); }

/* For a test: when no run and no drain is under way. */
async function syncSettled() {
  do {
    while (running) await running;
    await drainsSettled();
  } while (running);
}

export { runSync, forgetSync, fillSyncStatus, onSyncTrigger, onSyncWorkerMessage, syncSettled };
