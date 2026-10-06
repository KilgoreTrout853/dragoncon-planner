/* Picks: the events the reader has starred, what each looked like when it was
   starred, and the news of any that changed since. Read from storage as the
   module is imported; saved by whoever changes them. togglePick() is not
   here: it redraws and scrolls, so it is the shell's. */
import { dayOf, esc, fmtShort, toDate } from "./util.js";
import { loadJSON, saveJSON } from "./storage.js";
import { storageKey } from "./build.js";
import { DAY_LABEL, localInputValue } from "./time.js";
import { record } from "./outbox.js";
import { byId } from "./data.js";

let picks = new Set(loadJSON(storageKey("picks"), []));
/* The picks as last saved, which savePicks() compares the set with: each id
   gained or lost since is a change for the outbox (docs/sync/contract.md,
   section 5). Read with the picks, from what storage holds. */
let saved = new Set(picks);

/* What each pick looked like when it was starred, so a later refresh can say
   what changed. The rows alone would show the new time, or nothing at all,
   and the reader would find out at the door. */
let pickInfo = loadJSON(storageKey("pickInfo"), {}) || {};
let pickNews = loadJSON(storageKey("pickNews"), []) || [];
/* A snapshot is the event as last saved - keepPicks() writes every pick's
   again at every save - with its end and its building, which say what time
   a later change vacated (DECISIONS #90). removed and cancelled are written
   only where they are true - that the news has said so - so a snapshot taken
   before either existed reads the same. */
const snapshotOf = e => ({title: e.title, start: e.start, location: e.location || "", end: e.end || "", hotel: e.hotel || "",
  ...(e.removed ? {removed: true} : {}), ...(e.cancelled ? {cancelled: true} : {})});
function keepPicks() {
  saveJSON(storageKey("picks"), [...picks]);
  const info = {};
  picks.forEach(id => { const e = byId.get(id); if (e) info[id] = snapshotOf(e); else if (pickInfo[id]) info[id] = pickInfo[id]; });
  pickInfo = info;
  saveJSON(storageKey("pickInfo"), pickInfo);
}
/* The one door for a change to the picks: whoever changed the set calls it,
   and it tells the outbox what changed since the last save - a star an add,
   an unstar a tombstone - so no caller has to. A save that changed nothing
   records nothing. */
function savePicks() {
  const changes = [];
  picks.forEach(id => { if (!saved.has(id)) changes.push([id, true]); });
  saved.forEach(id => { if (!picks.has(id)) changes.push([id, false]); });
  saved = new Set(picks);
  keepPicks();
  record("picks", changes);
}
/* The reader's own rows a pull read, applied as the server has them. The
   saved copy moves with them, so the next save does not send them back.
   Returns whether the plan changed. */
function applyPulledPicks(rows) {
  let changed = false;
  for (const {event_id: id, picked} of rows) {
    if (picked) saved.add(id); else saved.delete(id);
    if (picked === picks.has(id)) continue;
    if (picked) picks.add(id); else picks.delete(id);
    changed = true;
  }
  if (changed) keepPicks();
  return changed;
}
function savePickNews() { saveJSON(storageKey("pickNews"), pickNews); }
/* "Hilton Salon" and "Hilton-Salon" are one room; a refresh that respells
   it is not a move. */
const samePlace = (a, b) => String(a || "").toLowerCase().replace(/[^a-z0-9]+/g, "") === String(b || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
/* A day and a time as the news says them, "Sat 5:30 PM": the calendar's day.
   The fold in place of a pick says the same (inplace.js). */
function newsWhen(start) {
  const d = toDate(start);
  return `${DAY_LABEL[dayOf(d)] || ""} ${fmtShort(d)}`.trim();
}
const whenWhere = x => `${newsWhen(x.start)}, ${x.location || "location TBA"}`.trim();
/* The time a change vacated (DECISIONS #90): the pick's old start, its old
   end and its old building, in the schedule's own wall-clock strings - a
   moment kept as a number would move against the schedule on a phone that
   changed zones between two refreshes. Only where the pick was happening:
   a snapshot that says cancelled or removed vacated its time when the news
   first said so, and vacates none again. `was` is the snapshot - absent for
   a pick that never had one, which reads as its event does - and `e` the
   event, absent for a pick that is gone. A snapshot from before this has no
   end and no building: its length is the event's own, else its start's
   minute alone, and its building the event's, else none. */
function vacatedBy(was, e) {
  if (was && (was.removed || was.cancelled)) return null;
  const from = was || e;
  const end = from.end || localInputValue(new Date(toDate(from.start).getTime() + (e ? e._e - e._s : 60000)));
  return {start: from.start, end, hotel: (was && was.hotel) || (e && e.hotel) || ""};
}
/* The event an id was merged into. When two ids collide, the ids stage keeps
   the smaller and lists the other in the survivor's was, through any chain
   of merges (DECISIONS #43). A merge is an exact match of title, start and
   room, so a pick on a merged id is a pick on the survivor, certainly. */
function mergedInto(id) {
  for (const e of byId.values()) if ((e.was || []).includes(id)) return e;
  return null;
}
/* Compare each pick with its snapshot, and report once what changed.
   - A pick whose id left the file for a merge moves to the survivor; any
     other with a snapshot leaves the plan, and stays in the news; one with
     none, which this schedule never showed, waits for it (below).
   - A pick whose event the source dropped stays in the plan, marked in Plans;
     its snapshot remembers it was reported (DECISIONS #49).
   - A pick whose event is cancelled stays in the plan, marked, and is news
     once, under the title its snapshot has: the source's gains "CANCELLED:"
     as it cancels. Its snapshot remembers that too (DECISIONS #90).
   - A pick that is back - its snapshot cancelled or removed, its event
     neither - is news, with the time and the place it has now.
   - A moved one stays in the plan and its snapshot moves with it.
   One line an event a refresh, the first of removed, cancelled, back and
   moved; a pick still cancelled or removed whose time or room changes makes
   none. An entry that vacated time - gone, removed, cancelled, or moved to
   a new start; a room alone vacates none - records it (vacatedBy()), for
   what is offered in its place. The news keeps until it is dismissed. A
   survivor is checked once, whether it was a pick already or came by a
   merge, so two picks merged into one event say so twice and report the
   event once. */
function reconcilePicks() {
  let changed = false;
  const checked = new Set();
  const vacated = (was, e) => { const time = vacatedBy(was, e); return time ? {vacated: time} : {}; };
  const check = (e, was) => {
    if (checked.has(e.id)) return;
    checked.add(e.id);
    let news = null;
    if (e.removed) {
      if (!(was && was.removed)) news = {kind: "removed", title: e.title, was: whenWhere(was || e), ...vacated(was, e)};
    } else if (e.cancelled) {
      if (!(was && was.cancelled)) news = {kind: "cancelled", title: (was || e).title, was: whenWhere(was || e), ...vacated(was, e)};
    } else if (was && (was.removed || was.cancelled)) {
      news = {kind: "back", title: e.title, now: whenWhere(e)};
    } else if (was && (was.start !== e.start || !samePlace(was.location, e.location))) {
      news = {kind: "moved", title: e.title, was: whenWhere(was), now: whenWhere(e), ...(was.start !== e.start ? vacated(was, e) : {})};
    }
    if (news) { pickNews.push(news); changed = true; }
  };
  [...picks].forEach(id => {
    const was = pickInfo[id], e = byId.get(id);
    if (e) { check(e, was); return; }
    const into = mergedInto(id);
    /* An id this copy of the schedule has never shown - no event has it or
       names it in its was, and it has no snapshot - is a pick made on
       another device against a newer schedule and pulled here
       (docs/sync/contract.md, section 5). It stays in the plan, unseen,
       until the schedule knows it: dropped as gone, its tombstone would
       unpick it on every device. */
    if (!into && !was) return;
    picks.delete(id);
    changed = true;
    if (!into) {
      pickNews.push({kind: "gone", title: was.title, was: whenWhere(was), ...vacated(was)});
      return;
    }
    pickNews.push({kind: "merged", title: was ? was.title : "One of your picks", now: into.title});
    picks.add(into.id);
    check(into, pickInfo[into.id]);
  });
  if (changed) { savePicks(); savePickNews(); }
  else if ([...picks].some(id => !pickInfo[id] && byId.has(id))) savePicks();   // picks from before snapshots existed
}
const NEWS = {
  gone: n => `<b>${esc(n.title)}</b> was removed from the schedule${n.was ? `. It was ${esc(n.was)}` : ""}.`,
  removed: n => `<b>${esc(n.title)}</b> was removed from the schedule. It was ${esc(n.was)}. It stays in Plans, marked.`,
  cancelled: n => `<b>${esc(n.title)}</b> was cancelled. It was ${esc(n.was)}. It stays in Plans, marked.`,
  back: n => `<b>${esc(n.title)}</b> is back on the schedule: ${esc(n.now)}.`,
  merged: n => `<b>${esc(n.title)}</b> is now listed as <b>${esc(n.now)}</b>.`,
  moved: n => `<b>${esc(n.title)}</b> moved to ${esc(n.now)}. It was ${esc(n.was)}.`,
};
function pickNewsHTML() {
  if (!pickNews.length) return "";
  const items = pickNews.map(n => `<li>${(NEWS[n.kind] || NEWS.moved)(n)}</li>`).join("");
  return `<div class="notice warn pick-news"><b>Your picks changed in the last schedule refresh.</b><ul>${items}</ul>
    <button class="btn quiet" data-act="dismiss-news">OK</button></div>`;
}

/* A module that imports picks and pickNews may read them, and add to or
   delete from them; it may not assign them. These are the assignments the
   rest of the app makes: the two "remove everything" paths and the handle's
   picks.set; the dismissed notice and the handle's news.clear; the handle's
   news.set, which keeps the list it is given and not a copy, as it always
   did. Saving and redrawing stay with the caller. */
function replacePicks(ids) { picks = new Set(ids); }
function replaceNews(list) { pickNews = list; }
function clearNews() { pickNews = []; }

export {
  picks, pickNews, savePicks, applyPulledPicks, savePickNews, samePlace, newsWhen, reconcilePicks, pickNewsHTML,
  replacePicks, replaceNews, clearNews,
};
