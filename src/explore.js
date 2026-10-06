import { esc, fmtShort } from "./util.js";
import { state } from "./state.js";
import { conDayKey, conEnded, DAY_LONG, isPast, now } from "./time.js";
import { AXES, byId, castEvents, events, isCeleb, knownFor, linkedWorks, NOISE_TRACKS, personName, tagsOf, topWorks } from "./data.js";
import { picks } from "./picks.js";
import { canFollow, eventsFor, FOLLOW_KINDS, followId, follows, isFollowing, isMuted, KIND_NOUN, mutes } from "./follows.js";
import { axisLabel } from "./search.js";
import { forYou, labelFor } from "./foryou.js";
import { rowHTML } from "./ui.js";
import { pageScrollTo, pageScrollTop, revealChip, scroller } from "./scroll.js";
import { requestRender } from "./bus.js";

/* ---- Explore ------------------------------------------------------- */

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
    const tg = tagsOf(e);
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
/* A page opened by a tap: a tile, a Following chip or a Because-you-starred
   tile on the grid, or a person's name or a chip on an event's sheet
   (DECISIONS #63, #75). Two things follow the draw, which the bus makes
   then and there.
   The way back, "← Explore", is to the grid where it was: its scroll is
   taken only where the screen under the tap is the grid itself. From
   another tab's sheet, or from an Explore page, what the grid last held
   stays - its top, if it was never left.
   And keyboard and screen-reader focus lands on the page's heading (#66),
   the page staying at its top: what was tapped is gone, redrawn away or
   hidden with its tab. Here, on arrival, and never in the page's draw,
   which Follow and the folds ask for again. */
function openExplorePage(kind, key) {
  if (state.tab === "explore" && !state.explore.page) state.explore.scroll = pageScrollTop();
  state.explore.page = {kind, key};
  state.explore.showPast = false;
  state.explore.showCast = false;
  state.explore.castNoise = false;
  state.tab = "explore";
  setExploreHash(`${kind}:${key}`);
  requestRender();
  pageScrollTo(0);
  const name = document.querySelector("#view-explore .eh-name");
  if (name) name.focus({preventScroll: true});
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

/* The jump row's chips, which a draw writes into the row; the row itself is
   built once, with the filter box. */
function exploreJumpChipsHTML() {
  const cat = getCatalogue();
  return EXPLORE_SECTIONS.map(sec => {
    const n = (cat[sec.id] || []).length;
    return n ? `<button class="chip" data-act="explore-jump" data-section="${sec.id}" aria-pressed="${state.explore.active === sec.id}">${sec.label} <span class="n">${n}</span></button>` : "";
  }).join("");
}

/* Tracks, fandoms and guests behind the reader's own picks that they do not
   follow yet, derived on every render. A starred photo session says
   something about the guest, not the track, so the noise tracks stay out;
   only things with a tile of their own are offered, so each has a page.
   Nothing muted is offered (DECISIONS #84), and the next takes its place. */
const SUGGEST_MAX = 6;
function suggestedFollows() {
  if (!picks.size) return [];
  const cat = getCatalogue();
  const lists = {track: cat.track, work: cat.fandom, person: cat.guest};
  const tally = new Map();
  const bump = (kind, key) => {
    if (!key || isFollowing(kind, key) || isMuted(kind, key)) return;
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

/* The muted, in a fold after Because you starred (DECISIONS #84): shut on
   every load, and not there with nothing muted. Open, one row that scrolls
   sideways, a chip a mute in the follow chips' shape and never gold - gold
   is a follow's. The name opens the thing's page; the x unmutes. */
function mutedHTML() {
  if (!mutes.length) return "";
  const open = !!state.explore.mutedOpen;
  const chips = mutes.map(m => `<span class="follow-chip mute-chip">
      <button class="fc-name" data-explore="${esc(followId(m))}">${esc(labelFor(m.kind, m.key))}</button>
      <button class="fc-x" data-act="unmute" data-follow="${esc(followId(m))}" aria-label="Unmute ${esc(labelFor(m.kind, m.key))}">&times;</button>
    </span>`).join("");
  return `<section class="muted" id="muted">
    <div class="divider fold"><button data-act="explore-muted" aria-expanded="${open}">Muted (${mutes.length}) <span aria-hidden="true">${open ? "▾" : "▸"}</span></button></div>
    ${open ? `<div class="controls"><div class="chips mute-chips" data-row="mutes">${chips}</div></div>` : ""}
  </section>`;
}

/* For you (W3; DECISIONS #87), the first thing on the grid: a few events the
   reader has not starred, each with its reason on line 3, in time order with
   the day on each - four, and the rest behind Show more. What scores and
   what is chosen are foryou.js's; this is what is drawn. Not there with no
   row: never a heading over nothing.

   The list holds still while the reader looks at it. It is worked out when
   the grid is drawn from somewhere else - a load, another tab, the way back
   from a page, the Explore tab tapped again, a return to the app, a new
   moment on the clock (shell.js lets it go at each) - and kept in
   state.explore.forYou while the reader stays on the grid: a star, a fold,
   a chip's x, a pull's redraw draw it as it was, the starred row starred in
   its place, so nothing tapped in it leaves from under the finger (#86). An
   empty list is never kept: with no row on screen there is nothing to hold
   still, and a phone that has just signed in gets its rows at the pull's
   redraw. */
const FOR_YOU_HEAD = 4;
function forYouList() {
  const held = state.explore.forYou;
  if (held && held.rows.length) return held;
  return state.explore.forYou = {rows: forYou(now()), more: false};
}
function forYouHTML() {
  const {rows, more} = forYouList();
  if (!rows.length) return "";
  const shown = more ? rows : rows.slice(0, FOR_YOU_HEAD);
  /* A reason that names the row's own track leaves the track unsaid. */
  const row = ({id, reason}) => {
    const ev = byId.get(id);
    return ev ? rowHTML(ev, {list: "foryou", showDay: true, noTrack: reason.name === ev.track,
      status: `${reason.follow ? "You follow" : "Like your picks:"} ${reason.name}`}) : "";
  };
  return `<section class="foryou" id="foryou">
    <h2 class="fy-head">For you <span class="count">(${rows.length})</span></h2>
    <p class="fy-line">From your follows and stars. Fits the gaps in your plan.</p>
    <ul class="list">${shown.map(row).join("")}</ul>
    ${shown.length < rows.length ? `<button class="btn quiet more" data-act="foryou-more">Show ${rows.length - shown.length} more</button>` : ""}
  </section>`;
}

/* What stands above the sticky block: For you, when it has a row;
   Following, when anything is followed; Because you starred; and the Muted
   fold, when anything is muted. For you is worked out first: Following's
   fold asks whether it has a row. */
function exploreTopHTML() {
  const forYouTop = forYouHTML();
  return forYouTop + followingHTML(!!forYouTop) + suggestedHTML() + mutedHTML();
}

/* The filter box is built once (DECISIONS #80), as Search's is: the first
   draw of the grid makes the view whole, and every later one writes around
   the box - what stands above the sticky block taken out and written again
   at the view's start, the jump row's chips, and the tiles. Replacing a
   focused input took its focus, its caret and the next key typed, and on
   an iPhone left the keyboard on a node that was gone. The box's value is
   put in step with the filter only where the two differ, so a draw never
   writes to a box the reader is typing in. No element is added, moved or
   wrapped for this: the view's elements are what one whole draw would
   write, in the same order. A page replaces the view, the box with it,
   and the way back builds the grid anew, the text kept. */
function renderExploreGrid() {
  const view = document.getElementById("view-explore"), box = document.getElementById("exploreQ");
  if (box) {
    const sticky = box.parentElement;
    while (sticky.previousElementSibling) sticky.previousElementSibling.remove();
    view.insertAdjacentHTML("afterbegin", exploreTopHTML());
    if (box.value !== state.explore.q) box.value = state.explore.q;
    sticky.querySelector(".explore-jump").innerHTML = exploreJumpChipsHTML();
    document.getElementById("exploreGrid").innerHTML = exploreSectionsHTML();
  } else {
    view.innerHTML = `${exploreTopHTML()}
    <div class="controls controls-sticky">
      <input class="search" type="search" id="exploreQ" placeholder="Filter tracks, fandoms, topics, people"
        value="${esc(state.explore.q)}" autocomplete="off" aria-label="Filter what you can follow">
      <div class="chips explore-jump" data-row="explore-jump" aria-label="Jump to a section">${exploreJumpChipsHTML()}</div>
    </div>
    <div id="exploreGrid">${exploreSectionsHTML()}</div>`;
  }
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

/* Typing in the filter box, and Show all, draw the tiles and nothing else:
   nothing above them changes with either. The box is kept by any draw of
   the grid (renderExploreGrid()). */
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

/* The kinds a work's cast group keeps behind its own reveal, on its page and
   in the Following feed. */
const CAST_QUIET = ["photo", "signing"];
const isQuiet = e => CAST_QUIET.includes(tagsOf(e).kind);

function renderExplorePage() {
  const {kind, key} = state.explore.page;
  const all = eventsFor({kind, key});
  const at = now();
  const upcoming = all.filter(e => !isPast(e, at)), past = all.filter(e => isPast(e, at));
  const on = isFollowing(kind, key), muted = isMuted(kind, key), offered = canFollow(kind, key);
  /* A work's page ends with the events its cast is on - linked by a credit to
     the work or anything under it - that are not already in the list above. */
  const cast = kind === "work" ? castEvents(key) : [];
  /* Nothing unreviewed is followable; a follow already made can still be undone here. */
  const follow = on || offered
    ? `<button class="btn follow-btn${on ? " on" : ""}" data-act="toggle-follow" aria-pressed="${on}">${on ? "Following" : "Follow"}</button>`
    : "";
  /* Mute stands beside Follow, on one line with it (DECISIONS #84): there
     when the thing is muted or can be followed, so a mute already made can
     still be undone here. The quiet button, and never gold. A muted page
     says what a mute does in one line under the two, text and no control. */
  const mute = muted || offered
    ? `<button class="btn quiet mute-btn" data-act="toggle-mute" aria-pressed="${muted}">${muted ? "Muted" : "Mute"}</button>`
    : "";
  /* A person's known-for line, under the name, as the event's sheet says it
     (W42; DECISIONS #61, #74): the file's people block's, so only a reviewed
     person with a line has one. */
  const known = kind === "person" ? knownFor(key) : "";

  let html = `<div class="explore-head">
    <button class="back" data-act="explore-back" aria-label="Back to Explore">&#8592; Explore</button>
    <div class="eh-kind">${KIND_NOUN[kind] || kind}</div>
    <h2 class="eh-name" tabindex="-1">${esc(labelFor(kind, key))}</h2>
    ${known ? `<p class="eh-known">${esc(known)}</p>` : ""}
    <div class="eh-count">${all.length} event${all.length === 1 ? "" : "s"}${past.length ? ` &middot; ${upcoming.length} still to come` : ""}</div>
    ${follow || mute ? `<div class="eh-acts">${follow}${mute}</div>` : ""}
    ${muted ? `<p class="eh-muted">Not suggested to you. Still in Search, and here.</p>` : ""}
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
    const quiet = cast.filter(isQuiet);
    const shown = state.explore.castNoise ? cast : cast.filter(e => !isQuiet(e));
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

/* A followed fandom's block ends with its cast (DECISIONS #85): the events
   castEvents() gives that are still to come, behind a fold, shut until
   tapped. Open, its rows with the day on each, less the photo ops and
   signings, and the page's button for those, in the page's words. Open or
   shut, and the photo ops shown, are kept by follow. No fold where nothing
   is left to come; only a fandom has a cast. */
function followingCastHTML(id, key, now) {
  const cast = castEvents(key).filter(e => !isPast(e, now));
  if (!cast.length) return "";
  const open = !!state.following.showCast[id], all = !!state.following.castNoise[id];
  const quiet = cast.filter(isQuiet), shown = all ? cast : cast.filter(e => !isQuiet(e));
  let html = `<div class="divider fold"><button data-act="fol-cast" data-follow="${esc(id)}" aria-expanded="${open}">With the cast (${cast.length}) <span aria-hidden="true">${open ? "▾" : "▸"}</span></button></div>`;
  if (open) {
    if (shown.length) html += `<ul class="list">${shown.map(ev => rowHTML(ev, {list: `folc:${id}`, showDay: true})).join("")}</ul>`;
    if (quiet.length && !all) html += `<button class="btn quiet more" data-act="fol-cast-noise" data-follow="${esc(id)}">show photo ops and signings (${quiet.length})</button>`;
  }
  return html;
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
    if (f.kind === "work") html += followingCastHTML(id, f.key, now);
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
   carries a one-line hint instead. Closed, the feed is not built at all.
   The fold: what the reader stored by a tap on the heading is what is shown;
   while nothing was ever stored, Following is folded under a For you that
   has a row - For you is the sampler, this the complete list - and open
   where there is none (DECISIONS #87). */
function followingHTML(underForYou) {
  if (!follows.length) return "";
  const open = state.following.open ?? !underForYou;
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
