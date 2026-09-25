/* Picks: the events the reader has starred, what each looked like when it was
   starred, and the news of any that changed since. Read from storage as the
   module is imported; saved by whoever changes them. togglePick() is not
   here: it redraws and scrolls, so it is the shell's. */
import { dayOf, esc, fmtShort, toDate } from "./util.js";
import { loadJSON, saveJSON } from "./storage.js";
import { storageKey } from "./build.js";
import { DAY_LABEL } from "./time.js";
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
/* removed is written only where it is true - that the news has said so - so
   a snapshot taken before it existed reads the same. */
const snapshotOf = e => ({title: e.title, start: e.start, location: e.location || "", ...(e.removed ? {removed: true} : {})});
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
function whenWhere(x) {
  const d = toDate(x.start);
  return `${DAY_LABEL[dayOf(d)] || ""} ${fmtShort(d)}, ${x.location || "location TBA"}`.trim();
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
   - A pick whose event the source dropped stays in the plan, marked in Mine;
     its snapshot remembers it was reported (DECISIONS #49).
   - A moved one stays in the plan and its snapshot moves with it.
   The news keeps until it is dismissed. A survivor is checked once, whether
   it was a pick already or came by a merge, so two picks merged into one
   event say so twice and report the event once. */
function reconcilePicks() {
  let changed = false;
  const checked = new Set();
  const check = (e, was) => {
    if (checked.has(e.id)) return;
    checked.add(e.id);
    if (e.removed) {
      if (!(was && was.removed)) { pickNews.push({kind: "removed", title: e.title, was: whenWhere(was || e)}); changed = true; }
    } else if (was && (was.start !== e.start || !samePlace(was.location, e.location))) {
      pickNews.push({kind: "moved", title: e.title, was: whenWhere(was), now: whenWhere(e)});
      changed = true;
    }
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
      pickNews.push({kind: "gone", title: was.title, was: whenWhere(was)});
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
  removed: n => `<b>${esc(n.title)}</b> was removed from the schedule. It was ${esc(n.was)}. It stays in Mine, marked.`,
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
  picks, pickNews, savePicks, applyPulledPicks, savePickNews, samePlace, reconcilePicks, pickNewsHTML,
  replacePicks, replaceNews, clearNews,
};
