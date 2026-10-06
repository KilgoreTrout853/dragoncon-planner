/* In place of a pick (W2; DECISIONS #90): under the picks-changed notice, on
   Now and on Plans' My day, a fold for each change that vacated time - a
   pick cancelled, removed, gone, or moved to a new start - and, open, the
   few events that start in that time. What is offered is foryou.js's,
   inPlace(); the news and the time each entry vacated are picks.js's; this
   is what is drawn, and what is held while the reader looks at it. now.js
   and plans.js put it after pickNewsHTML(), and it stands after ui.js,
   whose row it draws.

   It holds still, by For you's rule (#87). What the folds hold is worked out
   when the tab is drawn from somewhere else and kept in state.inPlace while
   the reader stays on it: a star, a fold opened or shut, the minute's tick,
   a sheet closed and a pull's redraw draw it as it was, a starred row
   starred in its place, so nothing tapped in it leaves from under the
   finger (#86). shell.js lets it go at a draw of another tab, a tap on the
   nav, a new moment and a return to the app; OK lets it go here, since the
   hold is of the news it was worked out from; and a fresh page has none.
   Worked out again, a starred event is a pick and what overlaps it is
   barred: a time it fills has no row left, so no fold, and its line in the
   notice stays until OK. Which folds are open goes with the hold. A hold
   with no fold is never kept: with no row on screen there is nothing to
   hold still. */
import { esc } from "./util.js";
import { state } from "./state.js";
import { now } from "./time.js";
import { byId } from "./data.js";
import { newsWhen, pickNews } from "./picks.js";
import { inPlace } from "./foryou.js";
import { reasonSaid, rowHTML } from "./ui.js";

/* The folds: one for each entry of the news that vacated time and has a row
   to offer, in the news's order - {entry, rows, open}, the entry by its
   place in the news. */
function inPlaceFolds(tab) {
  const held = state.inPlace;
  if (held && held.news === pickNews && held.folds.length) return held.folds;
  const at = now(), folds = [];
  pickNews.forEach((n, entry) => {
    const rows = n.vacated ? inPlace(n.vacated, at) : [];
    if (rows.length) folds.push({entry, rows, open: false});
  });
  state.inPlace = {tab, news: pickNews, folds};
  return folds;
}

/* A fold is the app's (.divider.fold): its button 44px tall or more, named
   by what it says - "In place of Star Trek Science, Sat 5:30 PM (3)", the
   title and the day the notice's own, the count its rows - and shut until
   tapped. Its id is the tab's and the entry's, so focus comes back to the
   fold tapped and not to the first (#66). Open, its rows are For you's: the
   reason on line 3, the track unsaid where the reason names it, and no day
   on the row; a row that scored nothing says no reason. A row's list names
   the tab and the entry: togglePick() finds the row it keeps under the
   finger by its list, and the other tab, hidden, may still hold the same
   event in the same fold. */
function inPlaceHTML(tab) {
  return inPlaceFolds(tab).map(({entry, rows, open}) => {
    const n = pickNews[entry], list = `in-place:${tab}:${entry}`;
    const row = ({id, reason}) => { const ev = byId.get(id); return ev ? rowHTML(ev, {list, ...reasonSaid(ev, reason)}) : ""; };
    return `<div class="divider fold in-place"><button id="inPlace-${tab}-${entry}" data-act="in-place" data-fold="${entry}" aria-expanded="${open}">In place of ${esc(n.title)}, ${esc(newsWhen(n.vacated.start))} (${rows.length}) <span aria-hidden="true">${open ? "▾" : "▸"}</span></button></div>${
      open ? `<ul class="list">${rows.map(row).join("")}</ul>` : ""}`;
  }).join("");
}

/* A fold's tap (dispatch.js): open or shut, its rows as they were. */
function toggleInPlace(entry) {
  const fold = state.inPlace && state.inPlace.folds.find(f => f.entry === entry);
  if (fold) fold.open = !fold.open;
}

export { inPlaceHTML, toggleInPlace };
