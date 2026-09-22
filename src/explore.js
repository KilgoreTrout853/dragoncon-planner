import { esc, fmtShort } from "./util.js";
import { state } from "./state.js";
import { conDayKey, conEnded, DAY_LONG, isPast, now } from "./time.js";
import { AXES, byId, CAST, events, isCeleb, linkedWorks, linksTo, NOISE_TRACKS, personName, topWorks, worksById } from "./data.js";
import { picks } from "./picks.js";
import { canFollow, eventsFor, FOLLOW_KINDS, followId, follows, isFollowing } from "./follows.js";
import { axisLabel } from "./search.js";
import { rowHTML } from "./ui.js";
import { pageScrollTo, pageScrollTop, revealChip, scroller } from "./scroll.js";
import { requestRender } from "./bus.js";

/* ---- Explore ------------------------------------------------------- */

/* The words the page uses for each kind of follow. A work is still a
   fandom and an axis value a topic, to the reader. */
const KIND_NOUN = {track: "Track", work: "Fandom", axis: "Topic", person: "Person"};

/* What a follow is called on screen: its key is an id. */
function labelFor(kind, key) {
  switch (kind) {
    case "work": return (worksById.get(key) || {}).name || key;
    case "axis": return axisLabel(key);
    case "person": return personName(key) || key;
    default: return key;
  }
}

/* Built once from the loaded schedule: everything you could follow, with how
   many events each carries. A work needs 3+ events, its own and those of the
   works under it, and a person's review, to be worth a tile; people need to
   be a celebrity guest or busy enough to be worth following. */
let catalogue = null;
function buildCatalogue() {
  const tally = (get) => {
    const m = new Map();
    events.forEach(e => (get(e) || []).forEach(k => { if (k) m.set(k, (m.get(k) || 0) + 1); }));
    return m;
  };
  const rank = (m, name) => [...m].map(([key, count]) => ({key, name: name(key), count}))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  /* A guest is someone the listing itself puts on a celebrity event; a
     panelist named only in the description's "Additional Panelists:" line is
     not made a guest by it. */
  const people = new Map(), celebs = new Set();
  events.forEach(e => {
    new Set((e.people || []).map(p => p.id)).forEach(id => people.set(id, (people.get(id) || 0) + 1));
    if (isCeleb(e)) (e.people || []).forEach(p => { if (p.src === "speakers") celebs.add(p.id); });
  });

  /* Tracks are looked up by name, so they go A to Z, with the two noise
     tracks last: sorted by count the page opened with Epic Photos, which
     Search hides by default. Fandoms and topics keep count order - there the
     number is the point. People split in two: guests by how busy they are,
     panelists A to Z, because "6 events" says nothing about a name you don't
     know. Both are still one kind of follow. */
  const byName = (a, b) => a.name.localeCompare(b.name);
  const person = rank(people, personName).filter(t => celebs.has(t.key) || t.count >= 5);
  const topics = tally(e => {
    const tg = e.tags || {};
    return AXES.flatMap(a => (tg[a] || []).map(v => `${a}:${v}`)).concat(tg.audience === "kids" ? ["audience:kids"] : []);
  });
  catalogue = {
    track: [...tally(e => e.tracks)].map(([key, count]) => ({key, name: key, count}))
      .sort((a, b) => (NOISE_TRACKS.has(a.key) - NOISE_TRACKS.has(b.key)) || byName(a, b)),
    fandom: topWorks().map(w => ({key: w.id, name: w.name, count: w.count})),
    topic: rank(topics, axisLabel),
    person,
    guest: person.filter(t => celebs.has(t.key)),
    panelist: person.filter(t => !celebs.has(t.key)).sort(byName),
  };
  return catalogue;
}
const getCatalogue = () => catalogue || buildCatalogue();

/* What the grid shows, in order. id names the list; kind is the follow. */
const EXPLORE_SECTIONS = [
  {id: "track", kind: "track", label: "Tracks"},
  {id: "fandom", kind: "work", label: "Fandoms"},
  {id: "topic", kind: "axis", label: "Topics"},
  {id: "guest", kind: "person", label: "Guests"},
  {id: "panelist", kind: "person", label: "Panelists"},
];
/* 657 tiles is thirty phone screens. Each section opens with its head and
   a Show all; the filter box is the way to reach the tail by name. */
const EXPLORE_HEAD = 12;

/* Only the explore part of the hash is ours to rewrite; anything else in
   it is left exactly as it was. */
function setExploreHash(value) {
  const rest = location.hash.replace(/^#/, "").split("&").filter(x => x && !x.startsWith("explore="));
  const parts = value ? rest.concat("explore=" + encodeURIComponent(value)) : rest;
  const h = parts.join("&");
  history.replaceState(null, "", h ? "#" + h : location.pathname + location.search);
}
function readExploreHash() {
  const m = location.hash.match(/explore=([^&]+)/);
  if (!m) return null;
  const raw = decodeURIComponent(m[1]);
  const i = raw.indexOf(":");
  if (i <= 0) return null;
  const kind = raw.slice(0, i), key = raw.slice(i + 1);
  /* A link names an id the schedule offers, or it lands on the grid: an old
     link by name, or to a work nobody has reviewed, opens no page. */
  return FOLLOW_KINDS.includes(kind) && key && canFollow(kind, key) ? {kind, key} : null;
}
function openExplorePage(kind, key, keepScroll) {
  if (!keepScroll) state.explore.scroll = pageScrollTop();
  state.explore.page = {kind, key};
  state.explore.showPast = false;
  state.explore.showCast = false;
  state.explore.castNoise = false;
  state.tab = "explore";
  setExploreHash(`${kind}:${key}`);
  requestRender();
  pageScrollTo(0);
}
function closeExplorePage() {
  state.explore.page = null;
  setExploreHash(null);
  requestRender();
  pageScrollTo(state.explore.scroll || 0);
}

function tileHTML(kind, item) {
  const on = isFollowing(kind, item.key);
  return `<button class="tile${on ? " on" : ""}" data-explore="${esc(kind + ":" + item.key)}">
    <span class="tile-name">${esc(item.name || item.key)}</span>
    <span class="tile-meta">${on ? `<span class="tile-mark" aria-label="Following">&#9679;</span>` : ""}${item.count}</span>
  </button>`;
}

function exploreSectionsHTML() {
  const cat = getCatalogue();
  const q = state.explore.q.trim().toLowerCase();
  const match = list => q ? list.filter(t => (t.name || t.key).toLowerCase().includes(q)) : list;
  let html = "", any = false;
  for (const sec of EXPLORE_SECTIONS) {
    const items = match(cat[sec.id] || []);
    if (!items.length) continue;
    /* A filter shows every match; otherwise the head, until Show all. */
    const open = !!q || !!state.explore.expanded[sec.id];
    const shown = open ? items : items.slice(0, EXPLORE_HEAD);
    html += `<div class="section-title" id="explore-${sec.id}">${sec.label} <span class="count">${items.length}</span></div>`;
    /* Nothing followed yet, so no Following section to point at: say where it will appear. */
    if (!any && !follows.length) html += `<div class="hint">Follow a track, fandom or person and it'll show up here.</div>`;
    any = true;
    html += `<div class="tiles">${shown.map(i => tileHTML(sec.kind, i)).join("")}</div>`;
    if (shown.length < items.length) {
      html += `<button class="btn quiet more" data-act="explore-all" data-section="${sec.id}">Show all ${items.length}</button>`;
    }
  }
  if (!any) html += `<div class="empty"><b>Nothing matches.</b> Try fewer letters.</div>`;
  return html;
}

function exploreJumpHTML() {
  const cat = getCatalogue();
  return `<div class="chips explore-jump" data-row="explore-jump" aria-label="Jump to a section">${EXPLORE_SECTIONS.map(sec => {
    const n = (cat[sec.id] || []).length;
    return n ? `<button class="chip" data-act="explore-jump" data-section="${sec.id}" aria-pressed="${state.explore.active === sec.id}">${sec.label} <span class="n">${n}</span></button>` : "";
  }).join("")}</div>`;
}

/* Tracks, fandoms and guests behind the reader's own picks that they do not
   follow yet, derived on every render. A starred photo session says
   something about the guest, not the track, so the noise tracks stay out;
   only things with a tile of their own are offered, so each has a page. */
const SUGGEST_MAX = 6;
function suggestedFollows() {
  if (!picks.size) return [];
  const cat = getCatalogue();
  const lists = {track: cat.track, work: cat.fandom, person: cat.guest};
  const tally = new Map();
  const bump = (kind, key) => {
    if (!key || isFollowing(kind, key)) return;
    const item = lists[kind].find(t => t.key === key);
    if (!item) return;
    const id = `${kind}:${key}`;
    const rec = tally.get(id) || {kind, key, name: item.name, count: item.count, picks: 0};
    rec.picks++;
    tally.set(id, rec);
  };
  picks.forEach(id => {
    const e = byId.get(id);
    if (!e) return;
    (e.tracks || []).forEach(t => { if (!NOISE_TRACKS.has(t)) bump("track", t); });
    /* A pick about Andor is behind Star Wars too, as Star Wars' count says. */
    linkedWorks(e).forEach(w => bump("work", w));
    new Set((e.people || []).map(p => p.id)).forEach(p => bump("person", p));
  });
  return [...tally.values()]
    .sort((a, b) => b.picks - a.picks || b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, SUGGEST_MAX);
}
function suggestedHTML() {
  const items = suggestedFollows();
  if (!items.length) return "";
  const n = picks.size;
  return `<section class="suggested" id="suggested">
    <div class="section-title">Because you starred <span class="count">${n} thing${n === 1 ? "" : "s"}</span></div>
    <div class="hint">Tracks, fandoms and guests behind your picks that you don't follow yet.</div>
    <div class="tiles">${items.map(r => tileHTML(r.kind, r)).join("")}</div>
  </section>`;
}

function renderExploreGrid() {
  document.getElementById("view-explore").innerHTML = `${followingHTML()}${suggestedHTML()}
    <div class="controls controls-sticky">
      <input class="search" type="search" id="exploreQ" placeholder="Filter tracks, fandoms, topics, people"
        value="${esc(state.explore.q)}" autocomplete="off" aria-label="Filter what you can follow">
      ${exploreJumpHTML()}
    </div>
    <div id="exploreGrid">${exploreSectionsHTML()}</div>`;
  syncActiveSection();
}

/* The chip for the section on screen reads as pressed, like a day chip in
   Search. The section on screen is the last one whose header has passed
   the sticky block; above the first header nothing is pressed. */
function pickActiveSection(headers, line, atEnd) {
  /* The last section is usually too short to carry its header up to the
     line before the page runs out of scroll, so at the end it is current. */
  if (atEnd && headers.length) return headers[headers.length - 1].id;
  let active = null;
  for (const h of headers) if (h.top <= line) active = h.id;
  return active;
}
function activeExploreSection() {
  const box = document.querySelector("#view-explore .controls-sticky");
  if (!box) return null;
  const line = box.getBoundingClientRect().bottom + 1;
  const headers = EXPLORE_SECTIONS.map(sec => {
    const el = document.getElementById(`explore-${sec.id}`);
    return el ? {id: sec.id, top: el.getBoundingClientRect().top} : null;
  }).filter(Boolean);
  const atEnd = scroller.scrollHeight > scroller.clientHeight
    && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
  return pickActiveSection(headers, line, atEnd);
}
function markActiveSection(id) {
  const changed = state.explore.active !== id;
  state.explore.active = id;
  document.querySelectorAll('#view-explore [data-act="explore-jump"]')
    .forEach(b => b.setAttribute("aria-pressed", String(b.dataset.section === id)));
  if (changed && id) revealChip(document.querySelector(`#view-explore [data-act="explore-jump"][data-section="${id}"]`));
}
function syncActiveSection() {
  if (state.tab !== "explore" || state.explore.page) return;
  markActiveSection(activeExploreSection());
}
/* A tap marks its chip at once and holds it while the smooth scroll runs,
   so the chips passed on the way do not flicker through. The hold is a
   stopwatch, not a clock: a simulated time must not freeze it. */
let spyQueued = false, spyHoldUntil = 0;
/* What boot() registers on the scroller. A burst of scroll events gets one
   animation frame between them, and the frame marks the section on screen
   unless a tapped chip is holding the mark. */
function onScrollSpy() {
  if (spyQueued) return;
  spyQueued = true;
  requestAnimationFrame(() => {
    spyQueued = false;
    if (performance.now() < spyHoldUntil) return;
    syncActiveSection();
  });
}

/* Typing in the filter box redraws the tiles and nothing else. Rebuilding the
   whole view would replace the input mid-word, and take the keyboard with it. */
function renderExploreSections() {
  const grid = document.getElementById("exploreGrid");
  if (grid && !state.explore.page) grid.innerHTML = exploreSectionsHTML(); else renderExplore();
}

function smoothScrollTo(top) { pageScrollTo(top, true); }
/* "+ Follow more" used to switch tabs; the tiles are now on the same page,
   just below. Land the filter box where its sticky position would hold it. */
function scrollToGrid() {
  const box = document.querySelector("#view-explore .controls-sticky");
  if (!box) return;
  const hdr = parseFloat(document.documentElement.style.getPropertyValue("--hdr-h")) || 0;
  smoothScrollTo(box.getBoundingClientRect().top + pageScrollTop() - hdr);
}
/* A section header lands just under the sticky filter block. */
function scrollToExploreSection(id) {
  const el = document.getElementById(`explore-${id}`);
  const box = document.querySelector("#view-explore .controls-sticky");
  if (!el) return;
  const hdr = parseFloat(document.documentElement.style.getPropertyValue("--hdr-h")) || 0;
  const stickyH = box ? box.getBoundingClientRect().height : 0;
  smoothScrollTo(el.getBoundingClientRect().top + pageScrollTop() - hdr - stickyH);
}

/* The kinds a work's cast group keeps behind its own reveal. */
const CAST_QUIET = ["photo", "signing"];

function renderExplorePage() {
  const {kind, key} = state.explore.page;
  const all = eventsFor({kind, key});
  const at = now();
  const upcoming = all.filter(e => !isPast(e, at)), past = all.filter(e => isPast(e, at));
  const on = isFollowing(kind, key);
  /* A work's page ends with the events its cast is on - linked by a credit to
     the work or anything under it - that are not already in the list above. */
  const cast = kind === "work" ? events.filter(e => linksTo(e, key, CAST) && !linksTo(e, key)) : [];
  /* Nothing unreviewed is followable; a follow already made can still be undone here. */
  const button = on || canFollow(kind, key)
    ? `<button class="btn follow-btn${on ? " on" : ""}" data-act="toggle-follow" aria-pressed="${on}">${on ? "Following" : "Follow"}</button>`
    : "";

  let html = `<div class="explore-head">
    <button class="back" data-act="explore-back" aria-label="Back to Explore">&#8592; Explore</button>
    <div class="eh-kind">${KIND_NOUN[kind] || kind}</div>
    <h2 class="eh-name">${esc(labelFor(kind, key))}</h2>
    <div class="eh-count">${all.length} event${all.length === 1 ? "" : "s"}${past.length ? ` &middot; ${upcoming.length} still to come` : ""}</div>
    ${button}
  </div>`;

  const dayGroups = (list, name = "explore") => {
    let out = "", lastDay = "";
    list.forEach(ev => {
      if (ev._cd !== lastDay) { out += `<li class="day-head">${DAY_LONG[ev._cd] || ev._cd}</li>`; lastDay = ev._cd; }
      out += rowHTML(ev, {list: name});
    });
    return out;
  };

  if (!all.length && cast.length) {
    /* Only the cast: the group below is the page. */
  } else if (!all.length) {
    html += `<div class="empty"><b>No events.</b> Nothing in the schedule matches this any more.</div>`;
  } else {
    if (upcoming.length) html += `<ul class="list">${dayGroups(upcoming)}</ul>`;
    else html += `<div class="empty">Everything here has already happened.</div>`;
    if (past.length) {
      html += `<div class="divider fold"><button data-act="explore-past" aria-expanded="${state.explore.showPast}">Already happened (${past.length}) <span aria-hidden="true">${state.explore.showPast ? "▾" : "▸"}</span></button></div>`;
      if (state.explore.showPast) html += `<ul class="list">${dayGroups(past)}</ul>`;
    }
  }
  if (cast.length) {
    const open = !!state.explore.showCast;
    const quiet = cast.filter(e => CAST_QUIET.includes((e.tags || {}).kind));
    const shown = state.explore.castNoise ? cast : cast.filter(e => !CAST_QUIET.includes((e.tags || {}).kind));
    html += `<div class="divider fold"><button data-act="explore-cast" aria-expanded="${open}">With the cast (${cast.length}) <span aria-hidden="true">${open ? "▾" : "▸"}</span></button></div>`;
    if (open) {
      if (shown.length) html += `<ul class="list">${dayGroups(shown, "explore-cast")}</ul>`;
      if (quiet.length && !state.explore.castNoise) {
        html += `<button class="btn quiet more" data-act="explore-cast-noise">show photo ops and signings (${quiet.length})</button>`;
      }
    }
  }
  document.getElementById("view-explore").innerHTML = html;
}

function renderExplore() {
  if (state.explore.page) renderExplorePage(); else renderExploreGrid();
}

/* ---- Following (the top of Explore) --------------------------------- */
const FOLLOWING_PAGE = 8;

function followChipsHTML() {
  const chips = follows.map(f => `<span class="follow-chip">
      <button class="fc-name" data-explore="${esc(followId(f))}">${esc(labelFor(f.kind, f.key))}</button>
      <button class="fc-x" data-act="unfollow" data-follow="${esc(followId(f))}" aria-label="Unfollow ${esc(labelFor(f.kind, f.key))}">&times;</button>
    </span>`).join("");
  return `<div class="controls"><div class="chips follow-chips" data-row="follows">${chips}
    <button class="chip fc-add" data-act="fol-add">+ Follow more</button>
  </div></div>`;
}

function followingByInterest(now) {
  let html = "";
  follows.forEach(f => {
    const id = followId(f);
    const all = eventsFor(f);
    const upcoming = all.filter(e => !isPast(e, now)), past = all.filter(e => isPast(e, now));
    const expanded = !!state.following.expanded[id];
    const shown = expanded ? upcoming : upcoming.slice(0, FOLLOWING_PAGE);
    html += `<div class="section-title">${esc(labelFor(f.kind, f.key))} <span class="count">${KIND_NOUN[f.kind] || f.kind} &middot; ${upcoming.length} ${conEnded() ? "events" : "to come"}</span></div>`;
    if (!upcoming.length) {
      html += `<div class="empty">Nothing left today or later.</div>`;
    } else {
      html += `<ul class="list">${shown.map(ev => rowHTML(ev, {list: `fol:${id}`, showDay: true})).join("")}</ul>`;
      if (upcoming.length > shown.length) {
        html += `<button class="btn quiet more" data-act="fol-more" data-follow="${esc(id)}">Show ${upcoming.length - shown.length} more</button>`;
      }
    }
    if (past.length) {
      const open = !!state.following.showPast[id];
      html += `<div class="divider fold"><button data-act="fol-past" data-follow="${esc(id)}" aria-expanded="${open}">Already happened (${past.length}) <span aria-hidden="true">${open ? "▾" : "▸"}</span></button></div>`;
      if (open) html += `<ul class="list">${past.map(ev => rowHTML(ev, {list: `folp:${id}`, showDay: true})).join("")}</ul>`;
    }
  });
  return html;
}

function followingByTime(now) {
  /* One row per event, however many follows brought it here - the labels say
     which, so a panel matched by two interests is not listed twice. */
  const seen = new Map();
  follows.forEach(f => eventsFor(f).forEach(e => {
    if (!seen.has(e.id)) seen.set(e.id, {ev: e, labels: []});
    const rec = seen.get(e.id);
    const label = labelFor(f.kind, f.key);
    if (!rec.labels.includes(label)) rec.labels.push(label);
  }));
  const rows = [...seen.values()].sort((a, b) => a.ev._s - b.ev._s);
  const upcoming = rows.filter(r => !isPast(r.ev, now)), past = rows.filter(r => isPast(r.ev, now));

  const group = list => {
    let out = "", lastDay = "", lastTime = "";
    list.forEach(({ev, labels}) => {
      const dk = conDayKey(ev._s);
      if (dk !== lastDay) { out += `<li class="day-head">${DAY_LONG[dk] || dk}</li>`; lastDay = dk; lastTime = ""; }
      const t = fmtShort(ev._s);
      if (t !== lastTime) { out += `<li class="time-head">${t}</li>`; lastTime = t; }
      out += rowHTML(ev, {list: "foltime", labels});
    });
    return out;
  };

  let html = "";
  if (!upcoming.length) html += `<div class="empty">Nothing left today or later from what you follow.</div>`;
  else html += `<ul class="list">${group(upcoming)}</ul>`;
  if (past.length) {
    const open = !!state.following.showPast.__time;
    html += `<div class="divider fold"><button data-act="fol-past" data-follow="__time" aria-expanded="${open}">Already happened (${past.length}) <span aria-hidden="true">${open ? "▾" : "▸"}</span></button></div>`;
    if (open) html += `<ul class="list">${group(past)}</ul>`;
  }
  return html;
}

/* Only there when there is something to show; with no follows the grid
   carries a one-line hint instead. Closed, the feed is not built at all. */
function followingHTML() {
  if (!follows.length) return "";
  const open = state.following.open !== false;
  let body = "";
  if (open) {
    const l = state.following.layout;
    body = followChipsHTML() + `<div class="view-toggle" role="group" aria-label="Layout">
      <button data-act="fol-interest" aria-pressed="${l === "interest"}">By interest</button>
      <button data-act="fol-time" aria-pressed="${l === "time"}">By time</button>
    </div>` + (l === "time" ? followingByTime(now()) : followingByInterest(now()));
  }
  return `<section class="following" id="following">
    <button class="fol-head" data-act="fol-toggle" aria-expanded="${open}" aria-controls="folBody">
      Following <span class="count">(${follows.length})</span><span class="caret" aria-hidden="true">${open ? "▾" : "▸"}</span>
    </button>
    <div id="folBody"${open ? "" : " hidden"}>${body}</div>
  </section>`;
}

function applyExploreHash() {
  const target = readExploreHash();
  if (target) {
    state.tab = "explore"; state.explore.page = target;
    state.explore.showPast = false; state.explore.showCast = false; state.explore.castNoise = false;
  }
  else if (state.explore.page) state.explore.page = null;
}

/* A tapped jump chip is heard by the delegated click handler, in dispatch,
   which starts the hold; and a module that imports a let may not assign it.
   This is that assignment. */
function holdSpyUntil(t) { spyHoldUntil = t; }

export {
  buildCatalogue, getCatalogue, EXPLORE_HEAD, setExploreHash, readExploreHash, openExplorePage,
  closeExplorePage, pickActiveSection, markActiveSection, onScrollSpy, renderExploreSections,
  scrollToGrid, scrollToExploreSection, renderExplore, applyExploreHash, holdSpyUntil,
};
