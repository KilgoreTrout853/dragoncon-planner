/* Picks: the events the reader has starred, what each looked like when it was
   starred, and the news of any that changed since. Read from storage as the
   module is imported; saved by whoever changes them. togglePick() is not
   here: it redraws and scrolls, so it is the shell's. */
import { YY } from "./season.js";
import { dayOf, esc, fmtShort, toDate } from "./util.js";
import { loadJSON, saveJSON } from "./storage.js";
import { DAY_LABEL } from "./time.js";
import { byId } from "./data.js";

let picks = new Set(loadJSON(`dc${YY}.picks`, []));

/* What each pick looked like when it was starred, so a later refresh can say
   what changed. The rows alone would show the new time, or nothing at all,
   and the reader would find out at the door. */
let pickInfo = loadJSON(`dc${YY}.pickInfo`, {}) || {};
let pickNews = loadJSON(`dc${YY}.pickNews`, []) || [];
const snapshotOf = e => ({title: e.title, start: e.start, location: e.location || ""});
function savePicks() {
  saveJSON(`dc${YY}.picks`, [...picks]);
  const info = {};
  picks.forEach(id => { const e = byId.get(id); if (e) info[id] = snapshotOf(e); else if (pickInfo[id]) info[id] = pickInfo[id]; });
  pickInfo = info;
  saveJSON(`dc${YY}.pickInfo`, pickInfo);
}
function savePickNews() { saveJSON(`dc${YY}.pickNews`, pickNews); }
/* "Hilton Salon" and "Hilton-Salon" are one room; a refresh that respells
   it is not a move. */
const samePlace = (a, b) => String(a || "").toLowerCase().replace(/[^a-z0-9]+/g, "") === String(b || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
function whenWhere(x) {
  const d = toDate(x.start);
  return `${DAY_LABEL[dayOf(d)] || ""} ${fmtShort(d)}, ${x.location || "location TBA"}`.trim();
}
/* Compare each pick with its snapshot. A vanished event leaves the plan but
   stays in the news; a moved one stays in the plan and its snapshot moves
   with it, so it is reported once. The news keeps until it is dismissed. */
function reconcilePicks() {
  let changed = false;
  [...picks].forEach(id => {
    const was = pickInfo[id], e = byId.get(id);
    if (!e) {
      pickNews.push({kind: "gone", title: was ? was.title : "One of your picks", was: was ? whenWhere(was) : ""});
      picks.delete(id);
      changed = true;
      return;
    }
    if (was && (was.start !== e.start || !samePlace(was.location, e.location))) {
      pickNews.push({kind: "moved", title: e.title, was: whenWhere(was), now: whenWhere(e)});
      changed = true;
    }
  });
  if (changed) { savePicks(); savePickNews(); }
  else if ([...picks].some(id => !pickInfo[id])) savePicks();   // picks from before snapshots existed
}
function pickNewsHTML() {
  if (!pickNews.length) return "";
  const items = pickNews.map(n => n.kind === "gone"
    ? `<li><b>${esc(n.title)}</b> was removed from the schedule${n.was ? `. It was ${esc(n.was)}` : ""}.</li>`
    : `<li><b>${esc(n.title)}</b> moved to ${esc(n.now)}. It was ${esc(n.was)}.</li>`).join("");
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
  picks, pickNews, savePicks, savePickNews, samePlace, reconcilePicks, pickNewsHTML,
  replacePicks, replaceNews, clearNews,
};
