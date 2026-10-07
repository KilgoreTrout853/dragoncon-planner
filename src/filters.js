/* The filter sheet (W13, with W8's topic axes and W7's flags; DECISIONS
   #70, #71, #77; docs/screens/contract.md, section 3, as built): Search's
   filters in a sheet panel, #panel-filters, opened by the Filters button
   beside the box. The hotel chips, the Fandom and Track selects, the four
   topic axes two by two, the Type control, the kind chips, Getting in - cost,
   sign-up, audience and sold out, two by two - and the toggle that hides
   photo sessions and video-room screenings. A tap changes state.browse at
   once - there is no Apply - and fillFilters() writes what the panel says in
   place, the pressed chips and the count on its main button, so focus stays
   on the control tapped; the list behind is drawn again only when the sheet
   closes.

   One value per filter, and the last one set wins (#71). The sheet shows
   what is in effect: "hilton" in the box, the Hilton is pressed. A tap on a
   dimension a word holds takes the word out of the query, as its chip's x
   does, then sets the value tapped. A word typed replaces the sheet's value
   for its dimension once the box is left - settleWords(), as the box loses
   focus and as the sheet opens - so nothing is kept unshown and nothing
   comes back when the word goes. Until then the word wins, as
   activeFilters() has it, and inEffect() - what the badge counts and the
   chips under the box name - leaves out a dimension a word holds.

   A place of the Map's (#98) is a filter the sheet does not set: one chip
   under the box in the hotel's stead, counted once, and in the panel the
   place's venue pressed with one line of words under the Hotel chips,
   "Only Hanover F". It leaves by its chip's x, by Clear and with the hotel:
   another hotel's chip takes it off, and a tap on its own venue, pressed,
   takes the place alone - one step wider - and a second tap is All.

   The panel's element is the sheet's; this draws it and nothing else. The
   handlers are dispatch.js's. A leaf. */
import { esc } from "./util.js";
import { settings, state } from "./state.js";
import { hotelGroup, hotelShort } from "./venues.js";
import { AXES, events, hotelChips, isNoise, tagsOf, topWorks, tracks, worksById } from "./data.js";
import { axisLabel, browseResults, dropPhrase, GETTING_IN, KIND_LABELS, parseQuery, passesGettingIn, placeInEffect, placeTitle, placeWords } from "./search.js";
import { chipHTML } from "./ui.js";

const TYPE_LABELS = {All: "All", panel: "Panels", gaming: "Gaming"};
const AXIS_NAMES = {medium: "Medium", genre: "Genre", craft: "Craft", subject: "Subject"};
const AXIS_IDS = {medium: "filterMedium", genre: "filterGenre", craft: "filterCraft", subject: "filterSubject"};
/* Getting in (W7; #77): each select's name, its first option, and its fixed
   options in order - an option is there at 0, so a value a word in the box
   holds always has its option to show. The third of an option says whether
   it names something an event has, and so carries its count; one that takes
   things away says no number, since the list hides photo sessions and the
   main button's count is the true one. A chip under the box says the
   option's own words. */
const GETTING_IN_SELECTS = {
  cost: {id: "filterCost", name: "Cost", first: "Any cost", options: [["no", "No extra fee", false], ["yes", "Extra fee", true]]},
  signup: {id: "filterSignup", name: "Sign-up", first: "Any sign-up", options: [["no", "No sign-up", false], ["yes", "Sign-up", true]]},
  audience: {id: "filterAudience", name: "Audience", first: "Any audience", options: [["kids", "Kids", true], ["no-adult", "No 18+", false], ["adult", "18+", true]]},
  soldOut: {id: "filterSoldOut", name: "Sold out", first: "Sold out or not", options: [["no", "Not sold out", false]]},
};
const gettingInLabel = (dim, value) => (GETTING_IN_SELECTS[dim].options.find(o => o[0] === value) || [value, value])[1];
/* The thirteen filters the sheet sets, in its order; the toggle is not one. */
const FILTERS = ["hotel", "work", "track", ...AXES, "type", "kind", ...GETTING_IN];

/* The dimensions a word in the box holds, and the value it holds each at:
   the query read as the list will read it. */
const heldByQuery = () => parseQuery(state.browse.q).filters;
const hasTags = () => events.some(e => Object.keys(tagsOf(e)).length > 0);

/* What the sheet has set that is in effect, in the sheet's order: the badge
   counts these, and the chips under the box name them. A dimension a word
   holds is the word's chip's while the box is still being typed in. A
   place in effect (#98) stands where the hotel would, one chip by its own
   words: it holds the hotel, and the venue is no second chip. */
function inEffect() {
  const b = state.browse, held = heldByQuery(), out = [];
  const add = (dim, label) => { if (b[dim] !== "All" && held[dim] === undefined) out.push({dim, label}); };
  const place = placeInEffect(held);
  if (place) out.push({dim: "place", label: placeWords(place)});
  else add("hotel", hotelShort(b.hotel));
  add("work", (worksById.get(b.work) || {}).name || b.work);
  add("track", b.track);
  AXES.forEach(a => add(a, axisLabel(`${a}:${b[a]}`)));
  add("type", TYPE_LABELS[b.type] || b.type);
  add("kind", KIND_LABELS[b.kind] || b.kind);
  GETTING_IN.forEach(d => add(d, gettingInLabel(d, b[d])));
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
   the first is gone. A chip names every dimension its word holds, so a tap
   on the Audience over "kids" takes the word out whole, and the Kids Track
   with it (#77). */
function dropWords(dim) {
  for (let chip; (chip = parseQuery(state.browse.q).chips.find(c => c.dims.includes(dim)));) {
    const was = state.browse.q;
    state.browse.q = dropPhrase(was, chip.src);
    if (state.browse.q === was) return;
  }
}

/* The place a card of the Map's sent (#98; dispatch.js): the place and the
   hotel it holds, the day - the Map's own, or All - no query and none of
   the other filters, so that the list is all of what is there; and the
   answers to the last question put back, as the hotel sheet's Search puts
   them. The toggle is left as it stands: a place outranks it. */
function setPlace(place, day) {
  FILTERS.forEach(d => { state.browse[d] = "All"; });
  Object.assign(state.browse, {q: "", day, prevDay: null, place, hotel: place.hotel, showHidden: false, showPast: false, noToday: false, page: 1});
}
/* A chip under the box taken off (dispatch.js): its filter back to All -
   and the place's chip takes the place and the hotel it holds, both. */
function takeOffFilter(dim) {
  if (dim === "place") Object.assign(state.browse, {place: null, hotel: "All"});
  else state.browse[dim] = "All";
}

/* Clear's reach: the thirteen filters - a place going with its hotel, where
   it is next read - and the toggle back to Settings' default. Not the day,
   nor the query. */
const clearable = () => FILTERS.some(d => state.browse[d] !== "All") || state.browse.hideNoise !== settings.hideNoise;
function clearFilters() {
  FILTERS.forEach(d => { state.browse[d] = "All"; });
  state.browse.hideNoise = settings.hideNoise;
  state.browse.page = 1;
}
/* One filter set from the panel, the last one set winning: a word that
   holds the dimension comes out of the query first. A second tap on the
   hotel in effect - the word's or the sheet's - is All again, as the hotel
   row's was. And with a place in effect (#98) a tap on its own venue, which
   is pressed, takes the place off and leaves the hotel, one step wider; any
   other hotel's chip sets that hotel, and the place goes with the one it
   held. */
function setFilter(dim, value) {
  if (!FILTERS.includes(dim)) return;
  const words = heldByQuery(), held = words[dim], was = held !== undefined ? held : state.browse[dim];
  const wider = dim === "hotel" && was === value && !!placeInEffect(words);
  if (held !== undefined) dropWords(dim);
  if (wider) state.browse.place = null;
  else state.browse[dim] = dim === "hotel" && was === value ? "All" : value;
  state.browse.page = 1;
}

/* What the panel was opened with, so that closing can tell whether anything
   changed: if it did, the list starts from its top. */
let openedWith = "";
const snapshot = () => JSON.stringify([...FILTERS.map(d => state.browse[d]), state.browse.hideNoise, state.browse.place]);
const filtersChanged = () => snapshot() !== openedWith;

/* Each axis's values by how many events carry them, then by label, as the
   Fandom select's works are ordered. */
function axisOptions(axis) {
  const counts = new Map();
  events.forEach(e => (tagsOf(e)[axis] || []).forEach(v => counts.set(v, (counts.get(v) || 0) + 1)));
  return [...counts].map(([v, n]) => ({value: v, label: axisLabel(`${axis}:${v}`), n}))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}
/* Getting in's options, each with its label as the select says it: the
   count, over every event as an axis's is, on the options that name
   something an event has. A schedule with no tags has no Audience. */
function gettingInOptions(tagged) {
  return GETTING_IN.filter(d => tagged || d !== "audience").map(d => ({dim: d, ...GETTING_IN_SELECTS[d],
    options: GETTING_IN_SELECTS[d].options.map(([value, label, has]) => ({value,
      label: has ? `${label} (${events.filter(e => passesGettingIn(e, d, value)).length})` : label}))}));
}
const option = (value, label, on) => `<option value="${esc(value)}"${on ? " selected" : ""}>${esc(label)}</option>`;
/* The line under the Hotel chips while a place is in effect (#98): words,
   no control - the place by its card's title's words. */
const onlySaid = place => (place ? `Only ${placeTitle(place)}` : "");

/* The panel, drawn as it opens, whole: each group what is in effect - the
   word's value where a word in the box holds it - and the count and Clear
   as they stand. */
function filtersHTML() {
  const b = state.browse, held = heldByQuery(), tagged = hasTags(), place = placeInEffect(held);
  const at = dim => (held[dim] !== undefined ? held[dim] : b[dim]);
  const chips = (dim, list) => list.map(([label, value]) => chipHTML(label, at(dim) === value, dim, value).replace("<button ", `<button type="button" `)).join("");
  const kinds = tagged ? Object.keys(KIND_LABELS).filter(k => events.some(e => tagsOf(e).kind === k)) : [];
  const noiseCount = events.filter(e => isNoise(e) && (b.day === "All" || e._cd === b.day)).length;
  const trackList = held.track !== undefined && !tracks.includes(held.track) ? [held.track, ...tracks] : tracks;
  /* The Hotel row: All, then a chip a group. While the hotel in effect is one
     venue of a group, which no chip's value is - a building of the Mart, set
     by its hotel sheet's Search (DECISIONS #91) - that venue has a chip of its
     own straight after its group's, pressed, as the Track select has a held
     track's option; like that option it stays, unpressed, until the panel is
     drawn again, so no chip moves under a tap. */
  const venue = at("hotel");
  const hotelList = [["All", "All"], ...hotelChips.flatMap(g => [[hotelShort(g), g], ...(!hotelChips.includes(venue) && hotelGroup(venue) === g ? [[hotelShort(venue), venue]] : [])])];
  const select = (id, dim, name, first, list) => `<select class="track" id="${id}" data-filter="${dim}" aria-label="${name}">${option("All", first, at(dim) === "All")}${list.map(o => option(o.value, o.label, at(dim) === o.value)).join("")}</select>`;
  const groups = [
    `<div class="filter-group" data-group="hotel" role="group" aria-labelledby="filterHotelLabel">
      <span class="filter-label" id="filterHotelLabel">Hotel</span>
      <div class="filter-chips">${chips("hotel", hotelList)}</div><p class="filter-only" id="filterOnly"${place ? "" : " hidden"}>${esc(onlySaid(place))}</p></div>`,
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
    `<div class="filter-group" data-group="entry" role="group" aria-labelledby="filterEntryLabel">
      <span class="filter-label" id="filterEntryLabel">Getting in</span>
      <div class="filter-topics">${gettingInOptions(tagged).map(g => select(g.id, g.dim, g.name, g.first, g.options)).join("")}</div></div>`,
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
   the pressed chips, the place's line, the selects, the toggle, Clear and
   the count. Each group says what is in effect, a word's value where one
   holds it. */
function fillFilters(panel) {
  const b = state.browse, held = heldByQuery(), place = placeInEffect(held), only = panel.querySelector("#filterOnly");
  const at = dim => (held[dim] !== undefined ? held[dim] : b[dim]);
  if (only.hidden === !!place) only.hidden = !place;
  if (only.textContent !== onlySaid(place)) only.textContent = onlySaid(place);
  for (const chip of panel.querySelectorAll("[data-chip]")) chip.setAttribute("aria-pressed", String(at(chip.dataset.chip) === chip.dataset.value));
  for (const sel of panel.querySelectorAll("select[data-filter]")) if (sel.value !== at(sel.dataset.filter)) sel.value = at(sel.dataset.filter);
  const noise = panel.querySelector("#hideNoise");
  if (noise) noise.checked = b.hideNoise;
  panel.querySelector("#filtersClear").disabled = !clearable();
  panel.querySelector("#filtersShow").textContent = showWords(browseResults().length);
}

export { inEffect, settleWords, filtersHTML, fillFilters, setFilter, setPlace, takeOffFilter, clearFilters, filtersChanged };
