/* The Search tab, which the code calls browse: the box and the Filters
   button beside it, the day chips, the chips under them, the rows, and the
   debounce that keeps typing from redrawing 2,000 nodes a keystroke. What a
   query means and how it is ranked is search.js's; this is the drawing of
   it, the cast group after the list among it (#85). The filters themselves are the filter sheet's (filters.js, #70). */
import { esc, fmtShort } from "./util.js";
import { state } from "./state.js";
import { CON_DAYS, conDayKey, DAY_LABEL, DAY_LONG, FIRST_FULL_DAY, now } from "./time.js";
import { events, isNoise, worksById } from "./data.js";
import { browseCast, browseResults, index, processTerm, SEARCH_PLACEHOLDER, suggestDocs, suggestionsFor } from "./search.js";
import { chipHTML, rowHTML } from "./ui.js";
import { inEffect } from "./filters.js";
import { chipRowsRestore, chipRowsSnapshot } from "./scroll.js";

const PAGE = 150;

/* Two rows of chips under the box: who, and what. */
function suggestHTML() {
  const q = state.browse.q.trim();
  const active = /^".+"$/.test(q) ? q.slice(1, -1) : null;
  if (active) {
    return `<div class="chips suggest-row"><button class="chip suggest on" data-act="unsuggest"
      aria-pressed="true" aria-label="Clear ${esc(active)}">${esc(active)} <span aria-hidden="true">&times;</span></button></div>`;
  }
  const s = suggestionsFor(q);
  if (!s.people.length && !s.topics.length) return "";
  const row = (label, items) => items.length
    ? `<div class="chips suggest-row"><span class="suggest-label">${label}</span>${items.map(i =>
        `<button class="chip suggest" data-act="suggest" data-name="${esc(i.name)}">${esc(i.name)} <span class="n">${i.count}</span></button>`).join("")}</div>`
    : "";
  return row("People", s.people) + row("Fandoms &amp; topics", s.topics);
}

/* When nothing matched a word literally, every result is a guess at what was
   meant - "drag" only reaches "dragons" by prefix. Ranking cannot fix that,
   but pretending to be confident about it is the part that misleads. */
function noExactMatchHTML(results) {
  if (!state.browse.q.trim() || !results.length) return "";
  const ranked = results.filter(e => e._hit);
  if (!ranked.length || ranked.some(e => e._hit.exact)) return "";
  const raw = (state.browse.parsed && state.browse.parsed.residual) || "";
  const shown = (/^".+"$/.test(raw) ? raw.slice(1, -1) : raw).trim();
  if (!shown) return "";
  /* A prefix and a typo are different failures and deserve different words:
     "philharmonic" does not start with "philharmonc". */
  const typed = shown.toLowerCase().split(/[\s\p{P}]+/u).map(processTerm).filter(Boolean);
  const byPrefix = ranked.some(e => (e._hit.terms || []).some(m => typed.some(t => m.startsWith(t) && m !== t)));
  const how = byPrefix ? "showing words that start with it" : "showing close spellings";
  return `<div class="no-exact">No exact match for <b>${esc(shown)}</b> &mdash; ${how}.</div>`;
}

/* Searching a person by name and quietly dropping their photo sessions is
   the wrong default when the name is the whole query - say what was held
   back and offer it, rather than hiding it twice. */
function hiddenForQueryHTML(results) {
  const b = state.browse;
  if (!b.q.trim() || b.showHidden || !b.hideNoise) return "";
  const raw = (b.parsed && b.parsed.residual) || "";
  const name = /^".+"$/.test(raw) ? raw.slice(1, -1) : raw.trim();
  if (!name) return "";
  /* Only for a person: a bare word like "photo" is already handled by the
     kind override, and we don't want this line on every search. */
  const person = suggestDocs.find(d => d.group === "people" && d.name.toLowerCase() === name.toLowerCase());
  if (!person) return "";
  const shown = new Set(results.map(e => e.id));
  const hidden = events.filter(e => isNoise(e) && !shown.has(e.id)
    && (e.people || []).some(p => p.id === person.key));
  if (!hidden.length) return "";
  const word = hidden.length === 1 ? "session" : "sessions";
  return `<div class="hidden-note">${hidden.length} photo ${word} hidden &middot; <button data-act="show-hidden">show</button></div>`;
}

/* What is narrowing the list, in one row, and a tap takes one back off:
   what the query was read as, then what the filter sheet set that is in
   effect (#70). A long label is cut short on screen; the button's name
   carries it whole. */
const removableHTML = (attrs, label, name) =>
  `<button class="chip parsed" ${attrs} aria-label="${esc(name)}"><span class="chip-label">${esc(label)}</span> <span aria-hidden="true">&times;</span></button>`;
function parsedChipsHTML(set) {
  const chips = (state.browse.parsed && state.browse.parsed.chips) || [];
  const today = state.browse.todayScoped ? removableHTML(`data-act="unparse-today"`, "Today", "Show the whole con instead of today") : "";
  if (!chips.length && !today && !set.length) return "";
  return `<div class="chips parsed-chips" data-row="parsed" role="group" aria-label="Filters in effect">${today}${chips.map(c =>
    removableHTML(`data-act="unparse" data-src="${esc(c.src)}"`, c.label, `Remove ${c.label} filter`)).join("")}${set.map(f =>
    removableHTML(`data-act="unfilter" data-dim="${f.dim}"`, f.label, `Remove ${f.label} filter`)).join("")}</div>`;
}

/* The Filters button: its badge counts the sheet's filters in effect, and
   its name says so. The button is built once, with the box; a redraw writes
   only these. */
const filtersName = n => (n ? `Filters, ${n} set` : "Filters");
function syncFiltersButton(n) {
  const btn = document.getElementById("filtersBtn"), badge = document.getElementById("filtersBadge");
  badge.hidden = n === 0;
  badge.textContent = n ? String(n) : "";
  btn.setAttribute("aria-label", filtersName(n));
}

/* ---- Browse ------------------------------------------------------- */

function renderBrowse() {
  const b = state.browse;
  if (b.day === null) { const d = conDayKey(now()); b.day = CON_DAYS.includes(d) ? d : FIRST_FULL_DAY; }
  const searching = !!b.q.trim();
  const results = browseResults(), cast = browseCast();
  const shown = results.slice(0, PAGE * b.page);
  const set = inEffect();

  const dayChips = `${chipHTML("All days", b.day === "All", "day", "All")}${CON_DAYS.map(d => chipHTML(DAY_LABEL[d], b.day === d, "day", d)).join("")}`;
  const sticky = `<div class="controls controls-sticky">
    <div class="search-row">
      <input class="search${index ? "" : " indexing"}" type="search" id="q" aria-label="Search the schedule" placeholder="${index ? SEARCH_PLACEHOLDER : "indexing…"}" value="${esc(b.q)}" autocomplete="off" enterkeyhint="search">
      <button class="filters-btn" type="button" id="filtersBtn" data-act="filters" aria-haspopup="dialog" aria-label="${filtersName(set.length)}">Filters<span class="filters-badge" id="filtersBadge"${set.length ? "" : " hidden"}>${set.length || ""}</span></button>
    </div>
    <div class="chips" data-row="day" id="dayChips">${dayChips}</div>
    </div>`;
  /* Under the box, and only when there is something to show: the
     suggestions, and what is narrowing the list. */
  const under = suggestHTML() + parsedChipsHTML(set);
  let html = `${under ? `<div class="controls controls-rest">${under}</div>` : ""}
  ${!index && b.q.trim() ? `<div class="empty indexing-note">Indexing the schedule&hellip; your search will run in a moment.</div>` : ""}
  <div class="section-title">${searching ? "Best matches first" : "Results"} <span class="count">${results.length}</span></div>
  ${noExactMatchHTML(results)}<ul class="list">`;

  let lastDay = "", lastTime = "", lastSection = "";
  shown.forEach(ev => {
    /* An all-filter query ("signing sunday") ranks nothing, so there are no
       hit terms to highlight - that is not the same as not searching. */
    if (searching) {
      if (ev._section !== lastSection) {
        lastSection = ev._section;
        if (lastSection === "loose") {
          html += `<li class="divider">Looser matches</li>`;
        } else if (lastSection === "past") {
          const n = results.filter(x => x._section === "past").length;
          html += `<li class="divider fold"><button data-act="toggle-past" aria-expanded="${b.showPast}">Already happened (${n}) <span aria-hidden="true">${b.showPast ? "▾" : "▸"}</span></button></li>`;
        }
      }
      if (lastSection === "past" && !b.showPast) return;
      html += rowHTML(ev, {list: "browse", showDay: true, terms: ev._hit ? ev._hit.terms : null});
      return;
    }
    if (b.day === "All" && ev._cd !== lastDay) { html += `<li class="day-head">${DAY_LONG[ev._cd] || ev._cd}</li>`; lastDay = ev._cd; lastTime = ""; }
    const t = fmtShort(ev._s);
    if (t !== lastTime) { html += `<li class="time-head">${t}</li>`; lastTime = t; }
    html += rowHTML(ev, {list: "browse"});
  });
  html += `</ul>`;
  html += hiddenForQueryHTML(results);
  /* With a filter of the sheet's in effect, the first thing to try is to take
     one off, and the chips to do it with are just above. Over a cast group
     the line says which list is empty: the fandom's own, by the name the
     filter sheet has for it. */
  const none = cast.length ? `No events about ${esc((worksById.get(b.work) || {}).name || b.work)}.` : "No matches.";
  if (!results.length) html += set.length
    ? `<div class="empty"><b>${none}</b> Remove a filter above, or try another day or fewer words.</div>`
    : `<div class="empty"><b>${none}</b> Try fewer or different words, another day, or turn off the photo/video filter.</div>`;
  if (results.length > shown.length) html += `<button class="btn quiet more" data-act="more-browse">Show ${Math.min(PAGE, results.length - shown.length)} more of ${results.length - shown.length}</button>`;
  /* The cast group (DECISIONS #85), last: after the list, its empty line and
     its Show more. A fold, open until tapped shut, its rows with the day on
     each under a list name of their own. The title's count, the Filters
     badge and the sheet's count are the list's alone. */
  if (cast.length) {
    html += `<div class="divider fold"><button data-act="browse-cast" aria-expanded="${b.castOpen}">With the cast (${cast.length}) <span aria-hidden="true">${b.castOpen ? "▾" : "▸"}</span></button></div>`;
    if (b.castOpen) html += `<ul class="list">${cast.map(ev => rowHTML(ev, {list: "browse-cast", showDay: true})).join("")}</ul>`;
  }
  /* The search box is never rebuilt once it exists. Replacing a focused
     input under an open iOS keyboard left the keyboard attached to a node
     that was gone, and dismissing it then landed in the Fandom select. Only
     what surrounds the box is redrawn; the box has its value kept in step
     for the times the query is set by a chip rather than by typing. */
  const view = document.getElementById("view-browse");
  const q = document.getElementById("q"), rest = document.getElementById("browseRest");
  if (q && rest) {
    if (q.value !== b.q) q.value = b.q;
    q.placeholder = index ? SEARCH_PLACEHOLDER : "indexing…";
    q.classList.toggle("indexing", !index);
    document.getElementById("dayChips").innerHTML = dayChips;
    syncFiltersButton(set.length);
    rest.innerHTML = html;
  } else {
    view.innerHTML = sticky + `<div id="browseRest">${html}</div>`;
  }
}

/* Long enough to swallow a burst of typing, short enough not to feel laggy.
   Chip and suggestion taps do not go through this; they draw at once. */
const SEARCH_DEBOUNCE_MS = 70;
let browseRenderTimer = null;
function queueBrowseRender() {
  clearTimeout(browseRenderTimer);
  browseRenderTimer = setTimeout(() => {
    browseRenderTimer = null;
    const rows = chipRowsSnapshot();
    renderBrowse();
    chipRowsRestore(rows);
  }, SEARCH_DEBOUNCE_MS);
}
/* Anything that redraws for another reason should not then redraw again. */
function cancelQueuedBrowseRender() { clearTimeout(browseRenderTimer); browseRenderTimer = null; }

export {
  hiddenForQueryHTML, renderBrowse, SEARCH_DEBOUNCE_MS, queueBrowseRender,
  cancelQueuedBrowseRender,
};
