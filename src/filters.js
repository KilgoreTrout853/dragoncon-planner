/* The filter sheet (W13, with W8's topic axes; DECISIONS #70, #71;
   docs/screens/contract.md, section 3, as built): Search's filters in a
   sheet panel, #panel-filters, opened by the Filters button beside the box.
   The hotel chips, the Fandom and Track selects, the four topic axes two by
   two, the Type control, the kind chips, and the toggle that hides photo
   sessions and video-room screenings. A tap changes state.browse at once -
   there is no Apply - and fillFilters() writes what the panel says in place,
   the pressed chips and the count on its main button, so focus stays on the
   control tapped; the list behind is drawn again only when the sheet closes.

   One value per filter, and the last one set wins (#71). The sheet shows
   what is in effect: "hilton" in the box, the Hilton is pressed. A tap on a
   dimension a word holds takes the word out of the query, as its chip's x
   does, then sets the value tapped. A word typed replaces the sheet's value
   for its dimension once the box is left - settleWords(), as the box loses
   focus and as the sheet opens - so nothing is kept unshown and nothing
   comes back when the word goes. Until then the word wins, as
   activeFilters() has it, and inEffect() - what the badge counts and the
   chips under the box name - leaves out a dimension a word holds. The
   panel's element is the sheet's; this draws it and nothing else. The
   handlers are dispatch.js's. A leaf. */
import { esc } from "./util.js";
import { settings, state } from "./state.js";
import { hotelShort } from "./venues.js";
import { AXES, events, hotelChips, isNoise, tagsOf, topWorks, tracks, worksById } from "./data.js";
import { axisLabel, browseResults, dropPhrase, KIND_LABELS, parseQuery } from "./search.js";
import { chipHTML } from "./ui.js";

const TYPE_LABELS = {All: "All", panel: "Panels", gaming: "Gaming"};
const AXIS_NAMES = {medium: "Medium", genre: "Genre", craft: "Craft", subject: "Subject"};
const AXIS_IDS = {medium: "filterMedium", genre: "filterGenre", craft: "filterCraft", subject: "filterSubject"};
/* The nine filters the sheet sets, in its order; the toggle is not one. */
const FILTERS = ["hotel", "work", "track", ...AXES, "type", "kind"];

/* The dimensions a word in the box holds, and the value it holds each at:
   the query read as the list will read it. */
const heldByQuery = () => parseQuery(state.browse.q).filters;
const hasTags = () => events.some(e => Object.keys(tagsOf(e)).length > 0);

/* What the sheet has set that is in effect, in the sheet's order: the badge
   counts these, and the chips under the box name them. A dimension a word
   holds is the word's chip's while the box is still being typed in. */
function inEffect() {
  const b = state.browse, held = heldByQuery(), out = [];
  const add = (dim, label) => { if (b[dim] !== "All" && held[dim] === undefined) out.push({dim, label}); };
  add("hotel", hotelShort(b.hotel));
  add("work", (worksById.get(b.work) || {}).name || b.work);
  add("track", b.track);
  AXES.forEach(a => add(a, axisLabel(`${a}:${b[a]}`)));
  add("type", TYPE_LABELS[b.type] || b.type);
  add("kind", KIND_LABELS[b.kind] || b.kind);
  return out;
}

/* A word typed replaces the sheet's value for its dimension (#71), once the
   box is left and as the sheet opens - never a keystroke, since "photo" on
   the way to "photoshoot" holds Kind until the next letter. Nothing shown
   changes, the word winning already, so nothing is drawn. */
function settleWords() {
  const held = heldByQuery();
  FILTERS.forEach(d => { if (held[d] !== undefined) state.browse[d] = "All"; });
}
/* The words that hold a dimension, out of the query as their chips' x takes
   them: until none does, since a second word ("hilton hyatt") holds it once
   the first is gone. */
function dropWords(dim) {
  for (let chip; (chip = parseQuery(state.browse.q).chips.find(c => c.dim === dim));) {
    const was = state.browse.q;
    state.browse.q = dropPhrase(was, chip.src);
    if (state.browse.q === was) return;
  }
}

/* Clear's reach: the nine filters, and the toggle back to Settings'
   default. Not the day, nor the query. */
const clearable = () => FILTERS.some(d => state.browse[d] !== "All") || state.browse.hideNoise !== settings.hideNoise;
function clearFilters() {
  FILTERS.forEach(d => { state.browse[d] = "All"; });
  state.browse.hideNoise = settings.hideNoise;
  state.browse.page = 1;
}
/* One filter set from the panel, the last one set winning: a word that
   holds the dimension comes out of the query first. A second tap on the
   hotel in effect - the word's or the sheet's - is All again, as the hotel
   row's was. */
function setFilter(dim, value) {
  if (!FILTERS.includes(dim)) return;
  const held = heldByQuery()[dim], was = held !== undefined ? held : state.browse[dim];
  if (held !== undefined) dropWords(dim);
  state.browse[dim] = dim === "hotel" && was === value ? "All" : value;
  state.browse.page = 1;
}

/* What the panel was opened with, so that closing can tell whether anything
   changed: if it did, the list starts from its top. */
let openedWith = "";
const snapshot = () => JSON.stringify([...FILTERS.map(d => state.browse[d]), state.browse.hideNoise]);
const filtersChanged = () => snapshot() !== openedWith;

/* Each axis's values by how many events carry them, then by label, as the
   Fandom select's works are ordered. */
function axisOptions(axis) {
  const counts = new Map();
  events.forEach(e => (tagsOf(e)[axis] || []).forEach(v => counts.set(v, (counts.get(v) || 0) + 1)));
  return [...counts].map(([v, n]) => ({value: v, label: axisLabel(`${axis}:${v}`), n}))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}
const option = (value, label, on) => `<option value="${esc(value)}"${on ? " selected" : ""}>${esc(label)}</option>`;

/* The panel, drawn as it opens, whole: each group what is in effect - the
   word's value where a word in the box holds it - and the count and Clear
   as they stand. */
function filtersHTML() {
  const b = state.browse, held = heldByQuery(), tagged = hasTags();
  const at = dim => (held[dim] !== undefined ? held[dim] : b[dim]);
  const chips = (dim, list) => list.map(([label, value]) => chipHTML(label, at(dim) === value, dim, value).replace("<button ", `<button type="button" `)).join("");
  const kinds = tagged ? Object.keys(KIND_LABELS).filter(k => events.some(e => tagsOf(e).kind === k)) : [];
  const noiseCount = events.filter(e => isNoise(e) && (b.day === "All" || e._cd === b.day)).length;
  const trackList = held.track !== undefined && !tracks.includes(held.track) ? [held.track, ...tracks] : tracks;
  const select = (id, dim, name, first, list) => `<select class="track" id="${id}" data-filter="${dim}" aria-label="${name}">${option("All", first, at(dim) === "All")}${list.map(o => option(o.value, o.label, at(dim) === o.value)).join("")}</select>`;
  const groups = [
    `<div class="filter-group" data-group="hotel" role="group" aria-labelledby="filterHotelLabel">
      <span class="filter-label" id="filterHotelLabel">Hotel</span>
      <div class="filter-chips">${chips("hotel", [["All", "All"], ...hotelChips.map(h => [hotelShort(h), h])])}</div></div>`,
    `<div class="filter-group" data-group="pick"><div class="filter-pair">${tagged
      ? select("fandom", "work", "Fandom", "Any fandom", topWorks().map(w => ({value: w.id, label: `${w.name} (${w.count})`}))) : ""}${
      select("track", "track", "Track", "All tracks", trackList.map(t => ({value: t, label: t})))}</div></div>`,
    tagged ? `<div class="filter-group" data-group="topics"><div class="filter-topics">${AXES.map(a =>
      select(AXIS_IDS[a], a, AXIS_NAMES[a], `Any ${a}`, axisOptions(a).map(o => ({value: o.value, label: `${o.label} (${o.n})`})))).join("")}</div></div>` : "",
    `<div class="filter-group" data-group="type"><div class="seg" role="group" aria-label="Type">${["All", "panel", "gaming"].map(t =>
      `<button type="button" data-chip="type" data-value="${t}" aria-pressed="${b.type === t}">${TYPE_LABELS[t]}</button>`).join("")}</div></div>`,
    tagged ? `<div class="filter-group" data-group="kind" role="group" aria-labelledby="filterKindLabel">
      <span class="filter-label" id="filterKindLabel">Kind</span>
      <div class="filter-chips">${chips("kind", [["Any kind", "All"], ...kinds.map(k => [KIND_LABELS[k], k])])}</div></div>` : "",
    `<div class="filter-group" data-group="noise"><label class="toggle"><input type="checkbox" id="hideNoise" ${b.hideNoise ? "checked" : ""}> Hide photo sessions and video-room screenings${noiseCount ? ` (${noiseCount})` : ""}</label></div>`,
  ];
  openedWith = snapshot();
  return `<h2 id="sheetTitleFilters" tabindex="-1">Filters</h2>
    <div class="filters-body" id="filtersBody">${groups.join("")}</div>
    <div class="filters-foot"><button class="btn" type="button" id="filtersShow">${showWords(browseResults().length)}</button><button class="btn quiet" type="button" id="filtersClear"${clearable() ? "" : " disabled"}>Clear</button></div>`;
}

/* The count the list will show once the sheet closes: Show 1 event, Show
   1,234 events, and at none words that say so, the button still closing. */
function showWords(n) {
  if (!n) return "No events match";
  return n === 1 ? "Show 1 event" : `Show ${n.toLocaleString("en-US")} events`;
}
/* After a tap: what the panel says, written into the nodes already there -
   the pressed chips, the selects, the toggle, Clear and the count. Each
   group says what is in effect, a word's value where one holds it. */
function fillFilters(panel) {
  const b = state.browse, held = heldByQuery();
  const at = dim => (held[dim] !== undefined ? held[dim] : b[dim]);
  for (const chip of panel.querySelectorAll("[data-chip]")) chip.setAttribute("aria-pressed", String(at(chip.dataset.chip) === chip.dataset.value));
  for (const sel of panel.querySelectorAll("select[data-filter]")) if (sel.value !== at(sel.dataset.filter)) sel.value = at(sel.dataset.filter);
  const noise = panel.querySelector("#hideNoise");
  if (noise) noise.checked = b.hideNoise;
  panel.querySelector("#filtersClear").disabled = !clearable();
  panel.querySelector("#filtersShow").textContent = showWords(browseResults().length);
}

export { inEffect, settleWords, filtersHTML, fillFilters, setFilter, clearFilters, filtersChanged };
