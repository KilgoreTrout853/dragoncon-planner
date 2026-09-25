import { YEAR } from "./season.js";
import { loadJSON, removeJSON, saveJSON } from "./storage.js";
import { storageKey } from "./build.js";
import { callBackendAsUser, hasBackend, storedSession } from "./backend.js";
import { wallClock } from "./time.js";

/* ==================================================================
   The outbox (DECISIONS #53; docs/sync/contract.md, section 5): what the
   doors, savePicks() and saveFollows(), have changed and the server has not
   yet taken, and the drain that sends it. One op per changed key, by table -
   a pick by its event id, a follow by kind:key - each whether the key is on
   and a stamp from wallClock(), which no simulated clock moves; a later
   change to a key replaces the op before it. No session, no outbox: with
   none a change is recorded nowhere, and the whole local state goes up as
   adds once the email step signs in (sync.js). Kept under
   storageKey("outbox") as {user, ops}: whose ops they are, so that ops
   recorded for one user are never sent as another's.

   The drain is one upsert per table of every pending op, and the
   database's triggers judge each row by its stamp, so a replay or an older
   stamp changes nothing. Success clears the keys it sent, unless a newer op
   took a key's place meanwhile; a failure keeps them, and the drain tries
   again after 5 seconds, then 10, doubling to 5 minutes. Nothing is
   dropped. One drain at a time: a tap starts one - after a failure, not
   before its wait is up - and sync.js holds the drains while a pull reads
   and applies, so no pulled row lands on a change sent in between.
   ================================================================== */
const OUTBOX_KEY = storageKey("outbox");
const PREFER = "resolution=merge-duplicates,return=minimal";
const FIRST_WAIT_MS = 5000, LONGEST_WAIT_MS = 5 * 60000;
/* Where each table's upsert goes, and a row of it for an op. The user is the
   caller's by the column's default, never sent. */
const TABLES = {
  picks: {
    path: "/rest/v1/picks?on_conflict=user_id,year,event_id",
    row: (key, op) => ({year: YEAR, event_id: key, picked: op.on, changed_at: op.at}),
  },
  follows: {
    path: "/rest/v1/follows?on_conflict=user_id,year,kind,key",
    row: (key, op) => { const i = key.indexOf(":"); return {year: YEAR, kind: key.slice(0, i), key: key.slice(i + 1), followed: op.on, changed_at: op.at}; },
  },
};
const emptyOps = () => ({picks: {}, follows: {}});
/* The real clock, and never the same moment twice from this page: the
   server takes a change only with a stamp strictly newer than the row's,
   so two changes to a key in one millisecond must not tie. */
let lastAt = 0;
function stampNow() {
  lastAt = Math.max(wallClock().getTime(), lastAt + 1);
  return new Date(lastAt).toISOString();
}

/* The stored outbox, or null; ops of a table it lacks read as none. */
function readOutbox() {
  const box = loadJSON(OUTBOX_KEY, null);
  if (!box || typeof box.user !== "string" || !box.ops) return null;
  return {user: box.user, ops: {picks: box.ops.picks || {}, follows: box.ops.follows || {}}};
}
/* The session's user's ops, a fresh outbox where the stored one is someone
   else's, and null with no session. */
function currentOutbox() {
  const session = storedSession();
  if (!session) return null;
  const box = readOutbox();
  return box && box.user === session.user.id ? box : {user: session.user.id, ops: emptyOps()};
}

/* The doors' one call: each [key, on] of a table, a change the server
   should have. Nothing without a backend or a session. */
function record(table, changes) {
  if (!hasBackend || !changes.length) return;
  const box = currentOutbox();
  if (!box) return;
  const at = stampNow();
  for (const [key, on] of changes) box.ops[table][key] = {on, at};
  saveJSON(OUTBOX_KEY, box);
  soon();
}
/* A new owner's outbox: every key given, as an add stamped now. What sync.js
   writes when the session's user is not the one it last synced - a mint, a
   recover, a sign-in in another tab - so the whole local state goes up, and
   nothing the last owner left is sent as this one's. */
function seedOutbox(user, keys) {
  const at = stampNow(), ops = emptyOps();
  for (const table of Object.keys(ops)) for (const key of keys[table] || []) ops[table][key] = {on: true, at};
  saveJSON(OUTBOX_KEY, {user, ops});
  soon();
}
function clearOutbox() { removeJSON(OUTBOX_KEY); }

/* The session's user's pending keys, by table: what a pull must not apply
   over. */
function pendingKeys() {
  const box = currentOutbox();
  return {picks: new Set(box ? Object.keys(box.ops.picks) : []), follows: new Set(box ? Object.keys(box.ops.follows) : [])};
}

let draining = null;     // the drain in flight
let again = false;       // a drain asked for while one was out, or held
let soonQueued = false;  // a tap's drain, queued for after the tap
let held = 0;            // the pulls holding the drains
let wait = 0;            // the wait after the last failure; 0 after a success
let retry = null;        // the timer that ends it
let lastError = null;    // the last drain's failure, until one succeeds
let emptied = 0;         // how many drains have left nothing waiting
let stopped = false;

/* A tap's drain: after the tap's own work, and never inside a failure's
   wait - the timer drains when that is up. */
function soon() {
  if (stopped || soonQueued || retry) return;
  soonQueued = true;
  queueMicrotask(() => { soonQueued = false; drain(); });
}

/* Send every pending op, one drain at a time. Resolves true when the server
   took them all or there was nothing to send, false when it did not. */
function drain() {
  if (stopped) return Promise.resolve(false);
  if (draining || held) { again = true; return draining || Promise.resolve(false); }
  again = false;
  draining = send().finally(() => {
    draining = null;
    if (again && !held && !retry) drain();
  });
  return draining;
}
/* A trigger's drain (sync.js): now, even inside a failure's wait. */
function drainNow() {
  clearTimeout(retry);
  retry = null;
  return drain();
}

async function send() {
  const session = storedSession(), box = readOutbox();
  if (!session || !box) return true;
  if (box.user !== session.user.id) { clearOutbox(); return true; }
  for (const table of Object.keys(TABLES)) {
    const ops = box.ops[table], keys = Object.keys(ops).sort();
    if (!keys.length) continue;
    try {
      await callBackendAsUser(TABLES[table].path, {body: keys.map(key => TABLES[table].row(key, ops[key])), prefer: PREFER});
    } catch (e) {
      failed(e);
      return false;
    }
    const after = readOutbox();
    if (after && after.user === box.user) {
      for (const key of keys) {
        const op = after.ops[table][key];
        if (op && op.on === ops[key].on && op.at === ops[key].at) delete after.ops[table][key];
      }
      saveJSON(OUTBOX_KEY, after);
    }
  }
  lastError = null;
  wait = 0;
  if (!outboxState().count) emptied++;
  return true;
}
/* Kept, and tried again when the wait is up; a lost session is sync.js's to
   forget, and waits for no timer. */
function failed(e) {
  lastError = e;
  if (e.code === "session_lost") return;
  wait = wait ? Math.min(wait * 2, LONGEST_WAIT_MS) : FIRST_WAIT_MS;
  clearTimeout(retry);
  retry = setTimeout(() => { retry = null; drain(); }, wait);
}

/* A pull holds the drains while it reads and applies: the one in flight
   finishes first, and none starts until it lets go. */
async function holdDrains() {
  held++;
  while (draining) await draining;
}
function releaseDrains() {
  held = Math.max(0, held - 1);
  if (!held && again && !retry) drain();
}

/* What the status lines say of the outbox: how many ops wait, the last
   drain's failure, and how many drains have left nothing waiting - so a
   line raised for what waited can tell, drawn later, that it all went. */
function outboxState() {
  const box = currentOutbox();
  return {count: box ? Object.keys(box.ops.picks).length + Object.keys(box.ops.follows).length : 0, error: lastError, emptied};
}
/* For a test: when no drain is queued or out. And stopping the drains for
   good, which a page test does as it cleans up, so no timer of this page
   drains into the next one's. */
async function drainsSettled() {
  while (soonQueued || draining) await (draining || Promise.resolve());
}
function stopDrains() {
  stopped = true;
  clearTimeout(retry);
  retry = null;
}

export {
  record, seedOutbox, clearOutbox, pendingKeys, drain, drainNow, holdDrains, releaseDrains, outboxState,
  drainsSettled, stopDrains,
};
