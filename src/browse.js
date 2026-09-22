/* The Search tab, which the code calls browse: the box, the chips under it,
   the rows, and the debounce that keeps typing from redrawing 2,000 nodes a
   keystroke. What a query means and how it is ranked is search.js's; this is
   the drawing of it. */
import { esc, fmtShort } from "./util.js";
import { state } from "./state.js";
import { CON_DAYS, conDayKey, DAY_LABEL, DAY_LONG, now } from "./time.js";
import { hotelShort } from "./venues.js";
import { events, hotelChips, isNoise, topWorks, tracks } from "./data.js";
import { browseResults, index, KIND_LABELS, processTerm, SEARCH_PLACEHOLDER, suggestDocs, suggestionsFor } from "./search.js";
import { chipHTML, rowHTML } from "./ui.js";
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

/* Show what the query was read as, and let the reader take it back off. */
function parsedChipsHTML() {
  const chips = (state.browse.parsed && state.browse.parsed.chips) || [];
  const today = state.browse.todayScoped
    ? `<button class="chip parsed" data-act="unparse-today" aria-label="Show the whole con instead of today">Today <span aria-hidden="true">&times;</span></button>`
    : "";
  if (!chips.length && !today) return "";
  return `<div class="chips parsed-chips" aria-label="Filters read from your search">${today}${chips.map(c =>
    `<button class="chip parsed" data-act="unparse" data-src="${esc(c.src)}" aria-label="Remove ${esc(c.label)} filter">${esc(c.label)} <span aria-hidden="true">&times;</span></button>`).join("")}</div>`;
}

/* ---- Browse ------------------------------------------------------- */

function renderBrowse() {
  const b = state.browse;
  if (b.day === null) { const d = conDayKey(now()); b.day = CON_DAYS.includes(d) ? d : "2026-09-03"; }
  const searching = !!b.q.trim();
  const results = browseResults();
  const shown = results.slice(0, PAGE * b.page);
  const noiseCount = events.filter(e => isNoise(e) && (b.day === "All" || e._cd === b.day)).length;
  const hasTags = events.some(e => e.tags);
  /* The Fandom select holds works, by id: the reviewed ones with 3+ events,
     their own and those of the works under them. */
  const works = hasTags ? topWorks() : [];
  const kindsPresent = hasTags ? Object.keys(KIND_LABELS).filter(k => events.some(e => e.tags && e.tags.kind === k)) : [];

  const dayChips = `${chipHTML("All days", b.day === "All", "day", "All")}${CON_DAYS.map(d => chipHTML(DAY_LABEL[d], b.day === d, "day", d)).join("")}`;
  const sticky = `<div class="controls controls-sticky">
    <input class="search${index ? "" : " indexing"}" type="search" id="q" placeholder="${index ? SEARCH_PLACEHOLDER : "indexing…"}" value="${esc(b.q)}" autocomplete="off" enterkeyhint="search">
    <div class="chips" data-row="day" id="dayChips">${dayChips}</div>
    </div>`;
  let html = `<div class="controls controls-rest">
    <div class="chips" data-row="hotel">${chipHTML("All", b.hotel === "All", "hotel")}${hotelChips.map(h => chipHTML(hotelShort(h), b.hotel === h, "hotel", h)).join("")}</div>
    ${hasTags ? `<div class="chips" data-row="kind">${chipHTML("Any kind", b.kind === "All", "kind", "All")}${kindsPresent.map(k => chipHTML(KIND_LABELS[k], b.kind === k, "kind", k)).join("")}</div>` : ""}
    ${suggestHTML()}
    ${parsedChipsHTML()}
    <div class="row-controls">
      <div class="seg" role="group" aria-label="Type">
        ${["All", "panel", "gaming"].map(t => `<button data-chip="type" data-value="${t}" aria-pressed="${b.type === t}">${{All: "All", panel: "Panels", gaming: "Gaming"}[t]}</button>`).join("")}
      </div>
      ${hasTags ? `<select class="track" id="fandom" aria-label="Fandom"><option value="All">Any fandom</option>${works.map(w => `<option value="${esc(w.id)}" ${b.work === w.id ? "selected" : ""}>${esc(w.name)} (${w.count})</option>`).join("")}</select>` : ""}
      <select class="track" id="track" aria-label="Track"><option value="All">All tracks</option>${tracks.map(t => `<option value="${esc(t)}" ${b.track === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
    </div>
    <label class="toggle"><input type="checkbox" id="hideNoise" ${b.hideNoise ? "checked" : ""}> Hide photo sessions and video-room screenings${noiseCount ? ` (${noiseCount})` : ""}</label>
  </div>
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
  if (!results.length) html += `<div class="empty"><b>No matches.</b> Try fewer or different words, another day, or turn off the photo/video filter.</div>`;
  if (results.length > shown.length) html += `<button class="btn quiet more" data-act="more-browse">Show ${Math.min(PAGE, results.length - shown.length)} more of ${results.length - shown.length}</button>`;
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
