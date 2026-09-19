import MiniSearch from "minisearch";
import { dayOf, esc, fmt, fmtMins, fmtShort, minutesBetween, pad, toDate } from "./util.js";
import { loadJSON, readSession, saveJSON, writeSession } from "./storage.js";
import { IS_IOS, isStandalone } from "./platform.js";
import { BUILD, deviceLine, devMarkHTML } from "./build.js";
/* ==================================================================
   Data & constants
   ================================================================== */
const CON_DAYS = ["2026-09-02","2026-09-03","2026-09-04","2026-09-05","2026-09-06","2026-09-07"];
const DAY_LABEL = {"2026-09-02":"Wed","2026-09-03":"Thu","2026-09-04":"Fri","2026-09-05":"Sat","2026-09-06":"Sun","2026-09-07":"Mon"};
const DAY_LONG = {"2026-09-02":"Wednesday","2026-09-03":"Thursday","2026-09-04":"Friday","2026-09-05":"Saturday","2026-09-06":"Sunday","2026-09-07":"Monday"};
const HOTEL_ORDER = ["Marriott","Hyatt","Hilton","Courtland Grand","Westin","AmericasMart","Hardy Ivy Park","Streaming","Other","Unknown"];
const HOTEL_VAR = {"Marriott":"Marriott","Hyatt":"Hyatt","Hilton":"Hilton","Courtland Grand":"Courtland","Westin":"Westin","AmericasMart":"Mart","Hardy Ivy Park":"Hardy","Streaming":"Streaming","Other":"Other","Unknown":"Other"};
const HOTEL_SHORT = {"Courtland Grand":"Courtland","AmericasMart":"Mart","Hardy Ivy Park":"Hardy Ivy"};
/* Streaming and the offsite venues share one chip. Neither is a con hotel,
   both wear the same grey, and together they are under 3% of the schedule.
   The data keeps them apart: a stream has no walk, an offsite venue does. */
const HOTEL_GROUP = {"Streaming":"Other","Other":"Other","Unknown":"Other"};
// Rough walking minutes between venues at con pace. Edit freely. Same venue = 5 (room changes, elevators).
const WALK = {
  "Marriott|Hyatt":8, "Marriott|Hilton":7, "Hyatt|Hilton":12,
  "Marriott|Courtland Grand":10, "Hilton|Courtland Grand":8, "Hyatt|Courtland Grand":15,
  "Westin|Hyatt":8, "Westin|Marriott":12, "Westin|Hilton":15, "Westin|Courtland Grand":18,
  "AmericasMart|Hyatt":7, "AmericasMart|Marriott":12, "AmericasMart|Westin":8, "AmericasMart|Hilton":15, "AmericasMart|Courtland Grand":18,
  "Hardy Ivy Park|Marriott":5, "Hardy Ivy Park|Hilton":4, "Hardy Ivy Park|Hyatt":10, "Hardy Ivy Park|Courtland Grand":8, "Hardy Ivy Park|Westin":12, "Hardy Ivy Park|AmericasMart":12,
};
const LEAVE_BUFFER_MIN = 10;   /* slack on every leave-by: lifts, crowds, one wrong turn */
const NOISE_TRACKS = new Set(["Epic Photos","Video Room"]);
const isNoise = ev => NOISE_TRACKS.has(ev.track) || /^photo session/i.test(ev.title);

/* Con vocabulary. If an event mentions any phrase in a group, every phrase in the group becomes searchable for it.
   Add your own lines freely; lowercase, no punctuation needed. */
const SYNONYMS = [
  ["symphony", "orchestra", "philharmonic", "concert", "classical music"],
  ["marvel", "mcu", "avengers", "x-men", "xmen", "spider-man", "spiderman", "daredevil", "deadpool", "wolverine"],
  ["batman", "superman", "justice league", "gotham", "dc comics", "wonder woman"],
  ["star trek", "trek", "starfleet", "tng", "ds9", "voyager", "strange new worlds", "klingon", "trekkie"],
  ["star wars", "mandalorian", "jedi", "sith", "andor", "skywalker", "lightsaber"],
  ["d&d", "dnd", "dungeons & dragons", "dungeons and dragons", "ttrpg", "tabletop rpg", "role-playing", "roleplaying", "pathfinder", "dungeon master", "5e", "ddal", "adventurers league"],
  ["skeptrack", "skeptics", "skeptic"],
  ["whedon", "firefly", "buffy", "angel", "serenity"],
  ["brit", "british", "brittrack", "doctor who"],
  ["filk", "filk music", "filking"],
  ["larp", "live-action roleplaying", "live action roleplaying"],
  ["warhammer", "40k", "40,000", "miniatures", "minis", "wargame", "wargaming"],
  ["lord of the rings", "lotr", "tolkien", "hobbit", "middle-earth", "rings of power"],
  ["game of thrones", "westeros", "house of the dragon", "targaryen"],
  ["doctor who", "dr who", "tardis", "whovian", "dalek"],
  ["anime", "manga", "shonen", "otaku"],
  ["cosplay", "costume", "costuming", "costumer", "masquerade"],
  ["space", "nasa", "astronomy", "astronaut", "rocket", "planetary", "spaceflight", "jpl", "telescope", "exoplanet", "orbit", "mars", "moon landing"],
  ["science", "physics", "biology", "chemistry", "stem", "scientist"],
  ["video game", "video games", "video gaming", "videogame", "esports", "arcade", "console", "gamer", "playstation", "xbox", "nintendo", "steam"],
  ["board game", "board games", "boardgame", "tabletop", "card game", "deck-building"],
  ["horror", "scary", "slasher", "zombie", "zombies", "haunted"],
  ["rick and morty", "rick & morty"],
  ["writing", "writers", "writer", "author", "authors", "novel", "publishing", "manuscript", "worldbuilding"],
  ["comics", "comic book", "comic books", "graphic novel"],
  ["puppet", "puppets", "puppetry", "puppet slam"],
  ["burlesque", "18+", "adults only", "after dark", "late night", "adult"],
  ["kids", "children", "family", "all ages", "young"],
  ["wrestling", "wrestlers", "wrestle"],
  ["karaoke", "sing-along", "singalong", "sing along"],
  ["signing", "autograph", "autographs"],
  ["photo op", "photo session", "photos with"],
  ["music", "band", "dj", "dance party", "rave", "live music", "musicians"],
  ["filk", "folk music"],
  ["buffy", "firefly", "whedon", "angel"],
  ["stargate", "sg-1"],
  ["battlestar", "bsg", "galactica"],
  ["pokemon", "pokémon"],
  ["zelda", "mario", "nintendo"],
  ["ghostbusters", "ghostbuster"],
  ["lego", "brick", "bricks"],
  ["harry potter", "potter", "hogwarts", "wizarding world"],
  ["alien", "aliens", "predator", "xenomorph"],
  ["godzilla", "kaiju"],
  ["stranger things", "hawkins"],
  ["expanse", "rocinante", "belter"],
  ["fantasy", "high fantasy", "epic fantasy", "urban fantasy"],
  ["romance", "romantasy", "paranormal romance"],
  ["young adult", "ya"],
  ["podcast", "podcasting", "podcasters"],
  ["contest", "competition", "tournament", "championship"],
  ["dance", "dancing", "ball"],
];
const STOPWORDS = new Set(["a","an","the","and","or","of","in","on","at","to","for","with","from","by","is","are","be","stuff","things","thing","something","anything","some","any","my","me","i","about","into","all",
  /* Question words. "what is at the westin" is a hotel filter with noise
     around it, not five search terms. */
  "what","whats","where","when","who","which","there","happening","going","find","show",
  /* Sentence scaffolding. "how" is the costly one: as a prefix it reaches
     Howl's Moving Castle, which is nobody's idea of a match for "how to". */
  "how","can","do","does","should","will","want","wanna","gonna"]);
const KIND_LABELS = {qa: "Celebrity Q&A", panel: "Fan panel", screening: "Screening", workshop: "Workshop", signing: "Signing", photo: "Photo op", contest: "Contest", performance: "Performance", party: "Party", gaming: "Gaming", reading: "Reading", tour: "Tour", other: "Other"};
let index = null;
/* Set while a query is typed before the index exists; run when it does. */
let pendingQuery = false;
const SEARCH_PLACEHOLDER = "Search titles, guests, fandoms, words";
/* Boot timings, ms since navigation, for the times "is it faster" needs a
   number: data parsed, first screen drawn, index built, suggestions built. */
const BOOT = {parsed: 0, rendered: 0, indexed: 0, suggested: 0, indexAtRender: null};
const processTerm = (term) => {
  const t = term.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return t.length < 2 || STOPWORDS.has(t) ? null : t;
};
function aliasesFor(ev, text) {
  const out = [];
  for (const g of SYNONYMS) if (g.some(m => text.includes(m))) out.push(...g);
  return out.join(" ");
}

const settings = loadJSON("dc26.settings", {crowd: 1.3, hideNoise: true});
let picks = new Set(loadJSON("dc26.picks", []));
let events = [], byId = new Map(), tracks = [], hotels = [], hotelChips = [];
let fromNetwork = null, servedOffline = false;
let meta = {};
const state = {
  tab: "now", sheetId: null, sheetHotel: null, mineView: loadJSON("dc26.mineView", "timeline"),
  now: {hotel: "All", limit: 80},
  map: {day: null},                       /* null: follow the clock */
  explore: {q: "", page: null, scroll: 0, showPast: false, expanded: {}, active: null},
  following: {layout: loadJSON("dc26.followingLayout", "interest"), expanded: {}, showPast: {}, open: loadJSON("dc26.followingOpen", true)},
  browse: {q: "", day: null, prevDay: null, hotel: "All", type: "All", track: "All", fandom: "All", kind: "All", showHidden: false, showPast: false, noToday: false, todayScoped: false, hideNoise: settings.hideNoise, page: 1},
};
const PAGE = 150;

/* Everything that scrolls the page goes through here, because the page is
   not the scroller - main is (see the CSS). jsdom has no scrollTo on
   elements, so fall back to scrollTop. */
const scroller = document.querySelector("main");
const pageScrollTop = () => scroller.scrollTop || 0;
function pageScrollTo(top, smooth) {
  const y = Math.max(0, top || 0);
  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (typeof scroller.scrollTo === "function") scroller.scrollTo({top: y, left: 0, behavior: smooth && !reduce ? "smooth" : "auto"});
  else scroller.scrollTop = y;
}
function pageScrollBy(dy) { scroller.scrollTop = pageScrollTop() + dy; }

/* ==================================================================
   Helpers
   ================================================================== */
/* What each pick looked like when it was starred, so a later refresh can say
   what changed. The rows alone would show the new time, or nothing at all,
   and the reader would find out at the door. */
let pickInfo = loadJSON("dc26.pickInfo", {}) || {};
let pickNews = loadJSON("dc26.pickNews", []) || [];
const snapshotOf = e => ({title: e.title, start: e.start, location: e.location || ""});
function savePicks() {
  saveJSON("dc26.picks", [...picks]);
  const info = {};
  picks.forEach(id => { const e = byId.get(id); if (e) info[id] = snapshotOf(e); else if (pickInfo[id]) info[id] = pickInfo[id]; });
  pickInfo = info;
  saveJSON("dc26.pickInfo", pickInfo);
}
function savePickNews() { saveJSON("dc26.pickNews", pickNews); }
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

/* ==================================================================
   Follows. A pick is one event; a follow is a standing interest - a
   track, a fandom, a topic, or a person - that keeps producing events
   as the schedule changes. Stored in the order they were added,
   because the Following feed presents them that way.
   ================================================================== */
const FOLLOW_KINDS = ["track", "fandom", "topic", "person"];
let follows = (loadJSON("dc26.follows", []) || [])
  .filter(f => f && FOLLOW_KINDS.includes(f.kind) && typeof f.key === "string" && f.key);
const followId = f => `${f.kind}:${f.key}`;
function saveFollows() { saveJSON("dc26.follows", follows.map(f => ({kind: f.kind, key: f.key}))); }
function isFollowing(kind, key) { return follows.some(f => f.kind === kind && f.key === key); }
function toggleFollow(kind, key) {
  const i = follows.findIndex(f => f.kind === kind && f.key === key);
  if (i >= 0) follows.splice(i, 1); else follows.push({kind, key});
  saveFollows();
  return i < 0;                       // true when it is now followed
}

/* events is already in start order and filter preserves it, so these come
   back chronological without re-sorting. */
function eventsFor(follow) {
  if (!follow || !follow.key) return [];
  const key = follow.key;
  switch (follow.kind) {
    case "track":  return events.filter(e => (e.tracks || []).includes(key));
    case "fandom": return events.filter(e => ((e.tags || {}).fandoms || []).includes(key));
    case "topic":  return events.filter(e => ((e.tags || {}).topics || []).includes(key));
    case "person": {
      /* Someone's photo sessions are half the reason to follow them, so the
         hide-photo-sessions setting deliberately does not apply here. */
      const lower = key.toLowerCase();
      return events.filter(e => (e.speakers || []).some(p => (p.name || "").toLowerCase() === lower));
    }
    default: return [];
  }
}
/* The source marks offsite venues with a leading "O ": "O Joystick Gamebar".
   The scraper now drops it; this covers data scraped before it did. */
function cleanRoom(hotel, room) {
  return hotel === "Other" ? String(room || "").replace(/^O\s+/, "") : room;
}
/* "Hilton · 313-314": the hotel first, so a line reads where before which
   room. A stream is "Streaming"; an offsite venue is itself - the cleaned
   room, else the location without its O marker, else "Offsite"; a blank
   room leaves the hotel alone. The parts are spans so the row chip can
   shorten the room and never the hotel. */
function placeHTML(ev) {
  if (ev.hotel === "Streaming") return `<span class="rh">Streaming</span>`;
  if (ev.hotel === "Other") {
    const venue = (ev.room && ev.room !== "Other" ? ev.room : cleanRoom("Other", ev.location)) || "Offsite";
    return `<span class="rr">${esc(venue === "Other" ? "Offsite" : venue)}</span>`;
  }
  if (!ev.hotel || ev.hotel === "Unknown") return `<span class="rr">${esc(ev.room || ev.location || "Location TBA")}</span>`;
  const room = String(ev.room || "").trim();
  return `<span class="rh">${esc(hotelShort(ev.hotel))}</span>${room ? ` · <span class="rr">${esc(room)}</span>` : ""}`;
}
function walkMin(a, b) {
  if (!a || !b || a === "Streaming" || b === "Streaming") return 0;
  if (a === b) return Math.round(5 * settings.crowd);
  const base = WALK[`${a}|${b}`] ?? WALK[`${b}|${a}`] ?? 12;
  return Math.round(base * settings.crowd);
}
/* "unknown" and untagged are not celebrities - absence of evidence isn't
   evidence, so they drop out when the toggle is on. */
const isCeleb = e => !!(e.tags && e.tags.guests === "celebrity");
const CELEB_BADGE = `<span class="celeb" title="Celebrity guest">Celebrity</span>`;
const hotelShort = h => HOTEL_SHORT[h] || h;
const hotelVar = h => `--h-${HOTEL_VAR[h] || "Other"}`;
const hotelGroup = h => HOTEL_GROUP[h] || h;
/* A chip value is a venue or a group of them; "All" is everything. */
const hotelMatches = (e, v) => v === "All" || e.hotel === v || hotelGroup(e.hotel) === v;

/* ==================================================================
   Time. Every read of the current moment goes through now() - the header
   clock, the Now tab, leave-by, the search folds, the nudge snooze, the
   ICS stamp - so one override moves all of them together. Elapsed-time
   measurements (a drag's speed, the scroll-spy hold, boot timings) are
   stopwatch reads and use performance.now() instead.

   ?now=2026-09-05T14:15 in the URL simulates that moment; an offset is
   honoured (2026-09-05T14:15:00-04:00). The override is kept for the tab's
   session, so a reload or the update pill lands on the same moment, and
   is cleared from Settings or the chip in the header. A simulated clock
   stands still: the tick redraws, but the minute never changes.

   The con's bounds live here too, because the phase of the con - before,
   live, ended - is a question about the clock.
   ================================================================== */
const CON = {
  year: 2026,
  /* The first listed event's start and the last one's end, as the data
     has them: local time, like every time in the app. */
  start: toDate("2026-09-02T18:00"),
  end: toDate("2026-09-07T19:00"),
};
const DATA_URL = `data/${CON.year}/events.json`;
/* Per channel: the next site shares this origin, and sessionStorage with it,
   so a clock simulated there must not follow the reader to the live site in
   the same tab. */
const TIME_OVERRIDE_KEY = `dc26.timeOverride${BUILD.channel ? "." + BUILD.channel : ""}`;
let timeOverride = null;                     // a Date, or null for the wall clock
const parseMoment = raw => { const d = raw ? new Date(raw) : null; return d && !isNaN(d) ? d : null; };

function now() { return timeOverride ? new Date(timeOverride.getTime()) : new Date(); }
const isSimulated = () => timeOverride !== null;

/* The URL wins over the session, so a pasted link means what it says; with
   no ?now= the session's override, if any, carries on. */
function initTimeOverride() {
  const fromUrl = new URLSearchParams(location.search).get("now");
  const raw = fromUrl !== null ? fromUrl : readSession(TIME_OVERRIDE_KEY);
  timeOverride = parseMoment(raw);
  writeSession(TIME_OVERRIDE_KEY, timeOverride ? raw : null);
}
/* value: an ISO date-time, or null for the real clock. The URL is kept in
   step so a reload lands on the same moment - only "+" is encoded, so the
   address stays readable - and the hash (an explore deep link) is left
   alone. The day chips follow the clock again until tapped. */
function setTimeOverride(value) {
  timeOverride = parseMoment(value);
  writeSession(TIME_OVERRIDE_KEY, timeOverride ? value : null);
  const rest = location.search.replace(/^\?/, "").split("&").filter(p => p && !p.startsWith("now="));
  const parts = timeOverride ? rest.concat("now=" + value.replace(/\+/g, "%2B")) : rest;
  history.replaceState(null, "", location.pathname + (parts.length ? "?" + parts.join("&") : "") + location.hash);
  state.browse.day = null;
  state.map.day = null;
  render();
  updateFresh();                             // "refreshed 2 h ago" is relative to the clock too
}
/* What the datetime-local input in Settings shows for the override. */
const localInputValue = d => `${dayOf(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/* before | live | ended. The bounds are the con's own: a moment at the very
   end is still live. */
function conPhase(at = now()) { return at < CON.start ? "before" : at > CON.end ? "ended" : "live"; }
const conEnded = () => conPhase() === "ended";
/* Once the con is over nothing is "already happened" in a useful sense - the
   whole schedule is - and folding all of it away would hide every result. */
const isPast = (e, at) => e._e <= at && conPhase(at) !== "ended";

/* ==================================================================
   Loading
   ================================================================== */
async function load(data) {
  if (!data) {
    try {
      const r = await fetch(DATA_URL, {cache: "no-cache"});
      if (!r.ok) throw new Error(r.status);
      data = await r.json();
      fromNetwork = true;
    } catch (e) {
      /* Only reached with no worker at all: with one installed, a cached
         response resolves normally and the worker reports offline by message
         instead. This is the plain-browser, no-signal path. */
      try {
        const cached = await caches.match(DATA_URL, {ignoreSearch: true});
        if (cached) { data = await cached.json(); fromNetwork = false; }
      } catch (e2) { /* no Cache API: fall through to the empty state */ }
      if (!data) {
      document.getElementById("view-now").innerHTML =
        `<div class="empty"><b>No schedule data yet.</b><br>${DATA_URL} is missing or unreadable. Run <code>python scraper.py</code> in this folder, then reload.</div>`;
      return;
      }
    }
  }
  meta = data;
  events = (data.events || []).filter(e => e.start).map(e => {
    const s = toDate(e.start), en = e.end ? toDate(e.end) : new Date(s.getTime() + 60 * 60000);
    const people = (e.speakers || []).map(p => p.name).join(" ");
    const room = cleanRoom(e.hotel, e.room);
    /* _cd is the con day: it runs to 5am, so a 1am panel belongs to the night
       before. Every list, chip and header uses it; only the sheet and the
       calendar export state the calendar date. */
    return {...e, room, _s: s, _e: en, _cd: conDayKey(s), _people: people};
  });
  events.sort((a, b) => a._s - b._s || a.title.localeCompare(b.title));
  byId = new Map(events.map(e => [e.id, e]));
  tracks = [...new Set(events.map(e => e.track).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  hotels = HOTEL_ORDER.filter(h => events.some(e => e.hotel === h));
  hotelChips = [...new Set(hotels.map(hotelGroup))];
  servedOffline = fromNetwork === false;
  BOOT.parsed = performance.now();
  buildCatalogue();
  applyExploreHash();          // a pasted #explore= link lands on its page
  reconcilePicks();            // picks that vanished or moved since they were starred
  updateFresh();
  render();                    // the first screen, before any index exists
  BOOT.rendered = performance.now();
  BOOT.indexAtRender = !!index;
  scheduleIndexBuild();
}

/* The search index is the slowest step of boot - about two seconds for
   3,500 events on a laptop, longer on a phone - and the first screen does
   not need it. So the tab on screen draws first and the index follows in
   idle time; the suggestion index (people and fandoms, for the chips under
   the search box) after that. A query typed before the index exists is
   held, and runs the moment it can. */
const idle = fn => (window.requestIdleCallback ? requestIdleCallback(fn, {timeout: 2000}) : setTimeout(fn, 0));
function scheduleIndexBuild() {
  idle(() => {
    buildIndex();
    BOOT.indexed = performance.now();
    indexReady();
    idle(() => {
      buildSuggestIndex();
      BOOT.suggested = performance.now();
      if (state.tab === "browse" && state.browse.q.trim()) queueBrowseRender();   // the suggestion chips can show now
    });
  });
}
function indexReady() {
  const box = document.getElementById("q");
  if (box) { box.placeholder = SEARCH_PLACEHOLDER; box.classList.remove("indexing"); }
  if (pendingQuery) { pendingQuery = false; if (state.tab === "browse") queueBrowseRender(); }
}

function buildIndex() {
  index = new MiniSearch({
    fields: ["title", "fandoms", "speakers", "aliases", "tracks", "kind", "topics", "description", "location"],
    storeFields: [], processTerm,
    /* Prefix matching on a two- or three-letter term is mostly noise - "ai"
       would reach every word starting "ai". Short terms must match exactly;
       the suggestion index keeps its own prefix rule and is unaffected. */
    searchOptions: {processTerm, prefix: t => t.length >= 4, fuzzy: t => t.length > 4 ? 0.2 : false, combineWith: "OR",
      boost: {title: 5, fandoms: 4, speakers: 3, aliases: 2, tracks: 2, kind: 2, topics: 2, description: 1, location: 1}},
  });
  index.addAll(events.map(e => {
    const tg = e.tags || {};
    const fandoms = (tg.fandoms || []).join(" "), topics = (tg.topics || []).join(" ");
    const kind = tg.kind ? `${tg.kind} ${KIND_LABELS[tg.kind] || ""}` : "";
    const text = [e.title, e.description, (e.tracks || []).join(" "), fandoms, topics, kind, e.location].join(" ").toLowerCase();
    return {id: e.id, title: e.title, description: e.description || "", speakers: e._people, tracks: (e.tracks || []).join(" "),
      fandoms, kind, topics, aliases: aliasesFor(e, text), location: e.location || ""};
  }));
}
/* A second, tiny index: one document per name, so we can suggest whole
   names rather than fragments of event text. */
let suggestIndex = null, suggestDocs = [];
function buildSuggestIndex() {
  /* Two counts per name. A celebrity's dozen entries are mostly photo
     sessions, which are hidden by default - a chip promising 12 that yields
     2 is worse than no number at all. */
  const people = new Map(), topics = new Map();
  const bump = (m, n, quiet) => {
    if (n.length <= 2) return;
    const c = m.get(n) || {all: 0, visible: 0};
    c.all++; if (!quiet) c.visible++;
    m.set(n, c);
  };
  events.forEach(e => {
    const quiet = isNoise(e);
    (e.speakers || []).forEach(p => bump(people, (p && p.name || "").trim(), quiet));
    const tg = e.tags || {};
    [...(tg.fandoms || []), ...(tg.topics || [])].forEach(t => bump(topics, String(t || "").trim(), quiet));
  });
  const doc = (group, prefix) => ([name, c]) => ({id: `${prefix}:${name}`, name, all: c.all, visible: c.visible, group});
  suggestDocs = [
    ...[...people].map(doc("people", "p")),
    ...[...topics].map(doc("topics", "t")),
  ];
  suggestIndex = new MiniSearch({
    fields: ["name"], storeFields: ["name", "all", "visible", "group"], processTerm,
    searchOptions: {processTerm, prefix: true, fuzzy: false, combineWith: "AND"},
  });
  suggestIndex.addAll(suggestDocs);
}

/* autoSuggest completes the words typed; each completion is then resolved
   back to whole names, because a chip saying "fillion" is no use. */
function suggestionsFor(raw) {
  const q = String(raw || "").trim();
  if (!suggestIndex || q.length < 2) return {people: [], topics: []};
  const seen = new Set(), hits = [];
  const take = res => res.forEach(r => { if (!seen.has(r.id)) { seen.add(r.id); hits.push(r); } });
  take(suggestIndex.search(q, {prefix: true, fuzzy: false, combineWith: "AND"}));
  for (const s of suggestIndex.autoSuggest(q, {fuzzy: false}).slice(0, 6)) {
    if (s.suggestion.toLowerCase() === q.toLowerCase()) continue;
    take(suggestIndex.search(s.suggestion, {prefix: true, fuzzy: false, combineWith: "AND"}));
  }
  const useVisible = state.browse.hideNoise;
  const n = h => useVisible ? h.visible : h.all;
  const pick = group => hits.filter(h => h.group === group && n(h) > 0)
    .sort((a, b) => n(b) - n(a) || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map(h => ({name: h.name, count: n(h)}));
  const out = {people: pick("people"), topics: pick("topics")};
  /* Once the box already holds exactly one of these, the row is just noise. */
  const exact = n => n.toLowerCase() === q.replace(/^"|"$/g, "").toLowerCase();
  if (out.people.some(x => exact(x.name)) || out.topics.some(x => exact(x.name))) return {people: [], topics: []};
  return out;
}

function fandomCounts() {
  const m = new Map();
  events.forEach(e => (e.tags && e.tags.fandoms || []).forEach(f => m.set(f, (m.get(f) || 0) + 1)));
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
function updateFresh() {
  const el = document.getElementById("fresh");
  if (!meta.generated_at) { el.textContent = ""; return; }
  /* After the con the copy is final; how long ago it was refreshed stops
     being the question. Under a simulated clock the copy can postdate the
     moment shown - "-1020 min ago" - so then it is named by when, not how
     long. */
  let fresh;
  if (conEnded()) fresh = `final<span class="word"> schedule</span>`;
  else {
    const at = toDate(meta.generated_at), ago = minutesBetween(at, now());
    const f = m => m < 60 ? `${m} min` : m < 48 * 60 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
    fresh = ago < 0 ? `<span class="word">refreshed </span>${DAY_LABEL[dayOf(at)] || ""} ${fmtShort(at)}`
                    : `<span class="word">refreshed </span>${f(ago)} ago`;
  }
  el.innerHTML = ` &middot; ${events.length.toLocaleString("en-US")} events &middot; ${fresh}`
    + (servedOffline ? " &middot; offline copy" : "");
  syncHeaderHeight();          // this line is what changes the header's height
}

/* ==================================================================
   Rendering
   ================================================================== */
/* Chip rows scroll sideways, and a render rebuilds them from scratch - which
   used to snap every row back to its left edge, so the chip just tapped at
   the far end vanished. Remember where each named row was and put it back. */
function chipRowsSnapshot() {
  const m = {};
  document.querySelectorAll(".chips[data-row]").forEach(el => { if (el.scrollLeft) m[el.dataset.row] = el.scrollLeft; });
  return m;
}
function chipRowsRestore(m) {
  document.querySelectorAll(".chips[data-row]").forEach(el => { if (m[el.dataset.row]) el.scrollLeft = m[el.dataset.row]; });
}
/* Bring one chip fully into its row: the one just tapped, or on Explore the
   one that just became current. Only ever moves the row sideways, and only
   as far as it has to; the row is otherwise the reader's to scroll. */
function revealChip(chip) {
  const row = chip && chip.closest(".chips");
  if (!row) return;
  const pad = 14, r = chip.getBoundingClientRect(), R = row.getBoundingClientRect();
  let dx = 0;
  if (r.left < R.left + pad) dx = r.left - R.left - pad;
  else if (r.right > R.right - pad) dx = r.right - R.right + pad;
  if (!dx) return;
  const left = Math.max(0, row.scrollLeft + dx);
  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (typeof row.scrollTo === "function") row.scrollTo({left, behavior: reduce ? "auto" : "smooth"}); else row.scrollLeft = left;
}


/* ---- Map ---------------------------------------------------------- */
/* The venues' real positions at one scale - about 0.54 px per metre, the
   Hyatt's centre at (150, 250) - so the distances mean something: the
   Hyatt and the Marriott nearly touch, the Hilton is a real walk, the
   Westin sits south-east of the Mart just west of Peachtree, and the
   Marriott-Hilton bridge crosses Courtland St, as it does in life. Keys
   are the walk table's names, so counts, rings and routes join up by
   hotel. Streams and offsite venues have no place here. */
const MAP_W = 380;
/* The frame: the viewBox is cropped to the drawing, with the same inset
   around it that the card below uses as padding (about 14 px at phone
   width). Block coordinates stay as they are; only the frame, the streets
   and their labels are placed against it. */
const MAP_VIEW = {x: -3, y: 111, w: 385, h: 305};
const MAP_STREETS = {Peachtree: 110, Courtland: 296};
const MAP_HOTELS = {
  "AmericasMart":    {x: 12,  y: 216, w: 72, h: 64},
  "Westin":          {x: 48,  y: 332, w: 60, h: 56},
  "Hyatt":           {x: 120, y: 222, w: 60, h: 56},
  "Marriott":        {x: 190, y: 222, w: 60, h: 56},
  "Hilton":          {x: 307, y: 222, w: 60, h: 56},
  "Courtland Grand": {x: 300, y: 347, w: 60, h: 56},
  "Hardy Ivy Park":  {x: 117, y: 124, w: 60, h: 24, park: true},
};
/* Each pair is left-to-right or top-to-bottom. None crosses Peachtree. */
const MAP_BRIDGES = [["AmericasMart", "Westin"], ["Hyatt", "Marriott"], ["Marriott", "Hilton"]];

/* "Search the Hyatt on Saturday": hotels take "the", the park does not. */
const hotelPhrase = h => h === "Hardy Ivy Park" ? h : `the ${hotelShort(h)}`;
/* The user's picks in one hotel on one con day, in time order (events is). */
const mapPicksAt = (hotel, day) => events.filter(e => picks.has(e.id) && e.hotel === hotel && e._cd === day);
function mapCounts(day) {
  const counts = {};
  events.forEach(e => { if (picks.has(e.id) && e._cd === day && MAP_HOTELS[e.hotel]) counts[e.hotel] = (counts[e.hotel] || 0) + 1; });
  return counts;
}
/* A gold pill on the block's top-right corner; none at all when zero. A
   wide pill on a block at the right edge is pulled in to stay on the map. */
function mapPillSVG(hotel, b, n) {
  if (!n) return "";
  const w = n > 9 ? 30 : 22, h = 18, cx = Math.min(b.x + b.w - 2, MAP_W - 2 - w / 2), cy = b.y + 2;
  return `<g class="map-pill" data-hotel="${esc(hotel)}" data-count="${n}"><rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}"/><text x="${cx}" y="${cy}">${n}</text></g>`;
}
function hotelSheetHTML(hotel, day) {
  const rows = mapPicksAt(hotel, day), dayName = DAY_LONG[day] || day;
  const count = rows.length ? `${rows.length} pick${rows.length === 1 ? "" : "s"}` : "no picks";
  const body = rows.length
    ? `<div class="ev-body"><ul class="list compact">${rows.map(ev => rowHTML(ev, {list: "map"})).join("")}</ul></div>`
    : `<div class="ev-body"><p style="color:var(--muted)">No picks here on ${esc(dayName)}.</p>
        <div class="rowbtns"><button class="btn quiet" data-act="map-search" data-hotel="${esc(hotel)}" data-day="${day}">Search ${esc(hotelPhrase(hotel))} on ${esc(dayName)}</button></div></div>`;
  return `<div class="ev-head"><h2 id="sheetTitleHotel">${esc(hotel)}</h2><div class="ev-when">${esc(dayName)} &middot; ${count}</div></div>
    ${body}
    <div class="ev-actions"><button class="btn" id="closeSheetHotel">Done</button></div>`;
}

/* What today's overlay is made of, computed once per render: the on-now and
   next picks, where the reader is, and the hero's leave-by. Null on any day
   but the one the clock is in. */
function mapNowState(day) {
  const at = now();
  if (day !== conDayKey(at)) return null;
  const model = nowModel(at), next = model.upcoming[0] || null, from = currentLocation(at);
  return {now: at, onNow: model.onNowEv, next, from, info: leaveInfo(from, next, at)};
}
/* A solid gold ring on the hotel of the pick that is on now, a pulsing one on
   the hotel of the next pick. A next pick off the map gets no ring. */
function mapRingsSVG(st) {
  if (!st) return "";
  const ring = (h, cls) => {
    const b = MAP_HOTELS[h];
    if (!b) return "";
    const pad = cls === "next" ? 7 : 4;
    return `<rect class="map-ring ${cls}" data-hotel="${esc(h)}" x="${b.x - pad}" y="${b.y - pad}" width="${b.w + 2 * pad}" height="${b.h + 2 * pad}" rx="${(b.park ? 6 : 10) + pad}"/>`;
  };
  return (st.onNow ? ring(st.onNow.hotel, "now") : "") + (st.next ? ring(st.next.hotel, "next") : "");
}
/* The card under the map: the next pick, as the hero sees it - the same
   nowModel, the same leaveInfo. It shows whichever day the map has selected,
   because it is about now, not about the day being looked at. With nothing
   left today it shows the first pick of the next con day; with no picks at
   all, how to get one. */
function mapCardState() {
  const at = now(), model = nowModel(at), today = conDayKey(at);
  const next = model.upcoming[0] || null;
  const later = next ? null : (events.find(e => picks.has(e.id) && e._s > at && conDayKey(e._s) > today) || null);
  const from = currentLocation(at);
  return {now: at, onNow: model.onNowEv, next, later, from, info: next ? leaveInfo(from, next, at) : null};
}
function mapCardHTML(cs) {
  if (conEnded()) return "";                 // nothing is next any more
  const {now, onNow, next, later, info} = cs;
  const onLine = onNow ? `<button class="next-on" data-hero="${esc(onNow.id)}">On now: <b>${esc(onNow.title)}</b> &middot; ends ${fmtShort(onNow._e)} &middot; ${esc(onNow.hotel === "Other" ? (onNow.room || "offsite") : hotelShort(onNow.hotel))}</button>` : "";
  const ev = next || later;
  if (!ev) return onLine + `<div class="next-card empty">Star things in Search and your next pick shows here.</div>`;
  let label = "", when, cls = "";
  if (!next) {
    const dayKey = conDayKey(ev._s), tomorrow = conDayKey(new Date(now.getTime() + 24 * 3600000));
    label = `<div class="nc-label">${dayKey === tomorrow ? "Tomorrow" : esc(DAY_LONG[dayKey] || dayKey)}</div>`;
    when = fmtShort(ev._s);
  } else if (info && info.leaveBy && info.walk > 0) {
    /* A leave-by only for a walk that exists: a stream has nowhere to go. */
    const here = onNow && onNow.hotel === "Other" ? esc(onNow.room || "here") : esc(hotelPhrase(info.from));
    cls = info.late ? " leave late" : " leave";
    when = info.late ? `leave ${here} now` : `leave ${here} by ${fmtShort(info.leaveBy)}`;
  } else {
    when = `${fmtShort(ev._s)} &middot; in ${fmtMins(minutesBetween(now, ev._s))}`;
  }
  const walk = next && info && info.estimate ? `<div class="nc-walk">${esc(info.estimate.label)}</div>` : "";
  return onLine + `<button class="next-card" data-hero="${esc(ev.id)}" style="--h:var(${hotelVar(ev.hotel)})">${label}<div class="nc-title">${esc(ev.title)}</div><div class="nc-where">${placeHTML(ev)}</div><div class="nc-when${cls}">${when}</div>${walk}</button>`;
}
const offLineHTML = off => off ? `<div class="map-offmap">${off} pick${off === 1 ? "" : "s"} streaming or offsite</div>` : "";
/* Picks that day at venues the map does not draw: streams and offsite. */
const mapOffMapCount = day => events.filter(e => picks.has(e.id) && e._cd === day && !MAP_HOTELS[e.hotel]).length;

function mapSVG(day, st = mapNowState(day), counts = mapCounts(day)) {
  const street = (name, x, faint) => `<line class="map-street${faint ? " faint" : ""}" data-street="${name}" x1="${x}" y1="${MAP_VIEW.y}" x2="${x}" y2="${MAP_VIEW.y + MAP_VIEW.h}"/>
    <text class="map-street-label" transform="translate(${x - 7} 212) rotate(-90)">${name} St</text>`;
  const bridges = MAP_BRIDGES.map(([a, b]) => {
    const A = MAP_HOTELS[a], B = MAP_HOTELS[b], beside = Math.abs(A.y - B.y) < A.h;
    const [x1, y1, x2, y2] = beside ? [A.x + A.w, A.y + A.h / 2, B.x, B.y + B.h / 2] : [A.x + A.w / 2, A.y + A.h, B.x + B.w / 2, B.y];
    return `<line class="map-bridge" data-bridge="${esc(a)}|${esc(b)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join("");
  const blocks = Object.entries(MAP_HOTELS).map(([h, b]) => { const n = counts[h] || 0, label = hotelShort(h).toUpperCase(); return `<g class="map-hotel${b.park ? " map-park" : ""}" data-hotel="${esc(h)}" role="button" tabindex="0" aria-label="${esc(h)}: ${n ? `${n} pick${n === 1 ? "" : "s"}` : "no picks"} on ${esc(DAY_LONG[day] || day)}" style="--h:var(${b.park ? "--park" : hotelVar(h)})">
    <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.park ? 6 : 10}"/>
    <text${label.length > 8 ? ' class="long"' : ""} x="${b.x + b.w / 2}" y="${b.y + b.h / 2}">${esc(label)}</text></g>`; }).join("");
  const pills = Object.entries(MAP_HOTELS).map(([h, b]) => mapPillSVG(h, b, counts[h])).join("");
  const rings = mapRingsSVG(st);
  return `<svg class="map" viewBox="${MAP_VIEW.x} ${MAP_VIEW.y} ${MAP_VIEW.w} ${MAP_VIEW.h}" role="group" aria-label="Schematic map of the con hotels, not to scale">
    <rect class="map-ground" x="${MAP_VIEW.x}" y="${MAP_VIEW.y}" width="${MAP_VIEW.w}" height="${MAP_VIEW.h}" rx="14"/>
    ${street("Peachtree", MAP_STREETS.Peachtree)}${street("Courtland", MAP_STREETS.Courtland, true)}
    ${bridges}${blocks}${rings}${pills}</svg>`;
}

/* The day the map shows: the one tapped, else the con day the clock is in,
   with the timeline's 5 AM boundary. Outside con week, Thursday. */
function mapDay() {
  if (state.map.day) return state.map.day;
  const d = conDayKey(now());
  return CON_DAYS.includes(d) ? d : "2026-09-03";
}

function renderMap() {
  const day = mapDay(), st = mapNowState(day), counts = mapCounts(day), off = mapOffMapCount(day), cs = mapCardState();
  const chips = CON_DAYS.map(d => chipHTML(DAY_LABEL[d], day === d, "map-day", d)).join("");
  document.getElementById("view-map").innerHTML = `<div class="controls controls-sticky"><div class="chips" data-row="map-day">${chips}</div></div>
    <div class="map-wrap" data-day="${day}">${mapSVG(day, st, counts)}<div class="map-under" id="mapUnder">${mapCardHTML(cs)}${offLineHTML(off)}</div></div>`;
  lastMapSig = mapSignature(day, st, counts);
  lastCardSig = mapCardSignature(cs, off);
}

/* The minute tick redraws only what changed. The SVG is redrawn when a ring
   or a pill would move - a redraw restarts the pulse on the next ring, so a
   quiet minute must leave it alone. The card is refreshed on its own when
   its words change, which "in 47 min" does every minute. */
let lastMapSig = null, lastCardSig = null;
function mapSignature(day, st, counts) {
  return JSON.stringify([day, st && st.onNow && st.onNow.id, st && st.next && st.next.id, counts]);
}
function mapCardSignature(cs, off) {
  const ev = cs.next || cs.later;
  return JSON.stringify([cs.onNow && cs.onNow.id, cs.next && cs.next.id, cs.later && cs.later.id, cs.from,
    cs.info && cs.info.leaveBy ? [String(cs.info.leaveBy), cs.info.late] : ev ? minutesBetween(cs.now, ev._s) : null,
    cs.info && cs.info.estimate ? cs.info.estimate.label : null, off]);
}
function tickMap() {
  const day = mapDay(), st = mapNowState(day), counts = mapCounts(day), off = mapOffMapCount(day), cs = mapCardState();
  if (mapSignature(day, st, counts) !== lastMapSig) {
    const rows = chipRowsSnapshot();
    renderMap();
    chipRowsRestore(rows);
    return true;
  }
  const csig = mapCardSignature(cs, off);
  if (csig === lastCardSig) return false;
  const under = document.getElementById("mapUnder");
  if (under) under.innerHTML = mapCardHTML(cs) + offLineHTML(off);
  lastCardSig = csig;
  return true;
}


function render() {
  cancelQueuedBrowseRender();
  updateClock();
  renderNotice();
  document.querySelectorAll(".nav button").forEach(b => b.dataset.tab === state.tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  document.getElementById("brand").hidden = state.tab !== "now";
  syncHeaderHeight();          // the brand comes and goes with the tab, and the spacers follow the header
  ["now", "browse", "explore", "map", "mine"].forEach(t => document.getElementById(`view-${t}`).hidden = t !== state.tab);
  const badge = document.getElementById("mineBadge");
  badge.hidden = picks.size === 0; badge.textContent = picks.size;
  if (!events.length) return;
  const rows = chipRowsSnapshot();
  if (state.tab === "now") renderNow();
  if (state.tab === "browse") renderBrowse();
  if (state.tab === "explore") renderExplore();
  if (state.tab === "map") renderMap();
  if (state.tab === "mine") renderMine();
  chipRowsRestore(rows);
  renderMiniBar();
}

function renderMiniBar() {
  const bar = document.getElementById("minibar");
  /* Not on Now, which is about the next pick already; not on the Map, whose
     caption says the same thing; and not once the con is over. */
  const at = now();
  const next = state.tab === "now" || state.tab === "map" || !events.length || conEnded() ? null : nextPickInConDay(at);
  if (!next) {
    bar.hidden = true;
    document.body.classList.remove("has-minibar");
    return;
  }
  const info = leaveInfo(currentLocation(at), next, at);
  const when = info && info.leaveBy
    ? (info.late ? "leave now" : `leave by ${fmtShort(info.leaveBy)}`)
    : `in ${fmtMins(minutesBetween(at, next._s))}`;
  bar.classList.toggle("late", !!(info && info.late));
  bar.innerHTML = `<span class="mb-body">
      <span class="mb-title">${esc(next.title)}</span>
      <span class="mb-room" style="--h:var(${hotelVar(next.hotel)})">${placeHTML(next)}</span>
    </span><span class="mb-when">${esc(when)}</span>`;
  bar.setAttribute("aria-label", `Next: ${next.title}, ${when}. Go to Now.`);
  bar.hidden = false;
  document.body.classList.add("has-minibar");
}

function updateClock() {
  const at = now();
  document.getElementById("clock").textContent = `${DAY_LABEL[dayOf(at)] || at.toLocaleDateString(undefined, {weekday: "short"})} ${fmtShort(at)}`;
  document.getElementById("simChip").hidden = !isSimulated();
  fitHeaderLine();
}

/* The header line must not clip: if it would, hide the word "refreshed"
   and measure again. jsdom reports no widths, so this is a no-op there. */
function fitHeaderLine() {
  const line = document.querySelector(".hdr-line");
  if (!line) return;
  line.classList.remove("tight", "tighter");
  if (line.scrollWidth > line.clientWidth) line.classList.add("tight");
  if (line.scrollWidth > line.clientWidth) line.classList.add("tighter");
}

function rowHTML(ev, opts = {}) {
  const s = fmt(ev._s), e = fmt(ev._e);
  const mine = picks.has(ev.id), open = state.sheetId === ev.id;
  const status = opts.status ? `<span class="status">${esc(opts.status)}</span>` : "";
  const cls = ["row", mine ? "mine" : "", open ? "open" : "", ev.cancelled ? "cancelled" : ""].filter(Boolean).join(" ");
  const hl = opts.terms ? highlighter(opts.terms) : (x => esc(x));
  const snippet = opts.terms ? snippetFor(ev, opts.terms) : "";
  return `<li class="${cls}" data-id="${esc(ev.id)}" data-list="${esc(opts.list || "")}">
    <div class="row-line">
      <button class="row-main" aria-haspopup="dialog">
        <div class="t">${opts.showDay ? `<span class="day">${DAY_LABEL[ev._cd] || ""}</span>` : ""}<span class="start">${s.t}<span class="ampm">${s.ap}</span></span><span class="end">to ${e.t} ${e.ap}</span></div>
        <div class="body">
          <div class="title">${hl(ev.title)}</div>
          <div class="meta">
            <span class="room" style="--h:var(${hotelVar(ev.hotel)})">${placeHTML(ev)}</span>
            ${ev.cancelled ? `<span class="cancelled-tag">Cancelled</span>` : ""}${status}${isCeleb(ev) ? CELEB_BADGE : ""}${(opts.labels || []).map(l => `<span class="flabel">${esc(l)}</span>`).join("")}<span class="track">${esc(ev.track || (ev.type === "gaming" ? "Gaming" : ""))}</span>
          </div>
          ${snippet ? `<div class="snippet">${snippet}</div>` : ""}
        </div>
      </button>
      <button class="star" aria-pressed="${mine}" aria-label="${mine ? "Remove from my schedule" : "Add to my schedule"}">${mine ? "★" : "☆"}</button>
    </div>
  </li>`;
}

function highlighter(terms) {
  const words = [...new Set(terms)].filter(t => t.length > 1).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return x => esc(x);
  const re = new RegExp(`(${words.join("|")})`, "gi");
  return x => esc(x).replace(re, "<mark>$1</mark>");
}
function snippetFor(ev, terms) {
  const d = ev.description || "";
  const words = [...new Set(terms)].filter(t => t.length > 1);
  let pos = -1;
  for (const w of words) { const i = d.toLowerCase().indexOf(w); if (i >= 0 && (pos < 0 || i < pos)) pos = i; }
  if (pos < 0) {
    const who = (ev.speakers || []).map(p => p.name).join(", ");
    if (who && words.some(w => who.toLowerCase().includes(w))) return `With ${highlighter(terms)(who)}`;
    return d ? esc(d.slice(0, 110)) + (d.length > 110 ? "…" : "") : "";
  }
  const start = Math.max(0, pos - 40), end = Math.min(d.length, pos + 100);
  return (start > 0 ? "…" : "") + highlighter(terms)(d.slice(start, end)) + (end < d.length ? "…" : "");
}

function gapHTML(prev, next) {
  if (!prev || !next || prev._cd !== next._cd && minutesBetween(prev._e, next._s) > 240) return "";
  const gap = minutesBetween(prev._e, next._s);
  const walk = walkMin(prev.hotel, next.hotel);
  const move = prev.hotel !== next.hotel ? `${hotelShort(prev.hotel)} to ${hotelShort(next.hotel)}` : `same building`;
  if (next._s < prev._e) {
    const ov = minutesBetween(next._s, prev._e);
    return `<div class="gap overlap">Overlaps the one above by ${ov} min</div>`;
  }
  if (gap < walk) return `<div class="gap tight">${gap} min to get there, ${move} is about ${walk} min at con pace</div>`;
  if (gap < walk + 10) return `<div class="gap">${gap} min gap, ${move} about ${walk} min. Tight but doable</div>`;
  return "";
}

/* A con day runs to 5am, so a 1am Sunday panel still belongs to Saturday. */
function conDayKey(d) { return dayOf(new Date(d.getTime() - 5 * 3600000)); }

function nextPickInConDay(now) {
  const key = conDayKey(now);
  return events.find(e => picks.has(e.id) && e._s > now && conDayKey(e._s) === key) || null;
}

/* ---- Where you are, and when to leave ------------------------------ */

/* The only place the app will claim you are: the hotel of a pick that is
   on right now. Nothing is inferred from where you were - a pick that has
   ended says nothing about where you went next, and a stream that is on
   could be watched from anywhere. Null otherwise; we can still show a
   start time, just not a leave-by. */
function currentLocation(now) {
  const on = events.find(e => picks.has(e.id) && e._s <= now && now < e._e);
  return on && on.hotel !== "Streaming" ? on.hotel : null;
}

/* The pick before this one in the same con day, if any. */
function previousPick(next) {
  let prev = null;
  for (const e of events) {
    if (e._s >= next._s) break;
    if (picks.has(e.id) && e._cd === next._cd) prev = e;
  }
  return prev;
}

/* A leave-by only when we know where you are - a pick is on now - and the
   next pick is somewhere else. Otherwise the start time, plus a walk
   estimate from wherever the previous pick today was, when that was a
   different building: the walk at the crowd factor with no buffer, so it
   reads as an estimate ("~12 min from the Westin"), not an instruction. */
function leaveInfo(from, next, now) {
  if (!next) return null;
  if (from && from !== next.hotel) {
    const walk = walkMin(from, next.hotel);
    const leaveBy = new Date(next._s.getTime() - (walk + LEAVE_BUFFER_MIN) * 60000);
    return {from, walk, leaveBy, late: now >= leaveBy, next, estimate: null};
  }
  const prev = previousPick(next);
  const walk = prev && prev.hotel !== next.hotel ? walkMin(prev.hotel, next.hotel) : 0;
  const where = prev && (prev.hotel === "Other" ? (prev.room || "offsite") : hotelPhrase(prev.hotel));
  const estimate = walk > 0 ? {walk, from: prev.hotel, label: `~${walk} min from ${where}`} : null;
  return {from, walk: null, leaveBy: null, late: false, next, estimate};
}

const RING_R = 26, RING_C = 2 * Math.PI * RING_R;
function ringHTML(fraction, minutes, late) {
  const f = Math.max(0, Math.min(1, fraction));
  const label = minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${Math.max(0, minutes)}`;
  return `<div class="ring"><svg width="62" height="62" viewBox="0 0 62 62" aria-hidden="true">
      <circle class="track-c" cx="31" cy="31" r="${RING_R}" fill="none" stroke-width="5"></circle>
      <circle class="prog" cx="31" cy="31" r="${RING_R}" fill="none" stroke-width="5" stroke-linecap="round"
        stroke-dasharray="${RING_C.toFixed(1)}" stroke-dashoffset="${(RING_C * (1 - f)).toFixed(1)}"></circle>
    </svg><div class="num">${label}<small>${minutes >= 60 ? "" : "min"}</small></div></div>`;
}

function heroHTML(ev, now, onNow, thenNext) {
  const from = currentLocation(now);
  let kicker, leaveLine = "", thenLine = "", target, windowStart, late = false;

  if (onNow) {
    kicker = "On now";
    target = ev._e;
    windowStart = ev._s;
    const info = leaveInfo(from, thenNext, now);
    if (info && info.leaveBy) {
      /* The one case with a leave-by: we know where you are because you
         are in something. Say which building. */
      late = info.late;
      const here = ev.hotel === "Other" ? esc(ev.room || "here") : esc(hotelPhrase(ev.hotel));
      leaveLine = `<div class="hleave">${late ? `leave ${here} now` : `leave ${here} by ${fmtShort(info.leaveBy)}`}</div>`;
      thenLine = `<div class="hthen">then: <b>${esc(hotelShort(thenNext.hotel))}</b> at ${fmtShort(thenNext._s)}</div>`;
    } else {
      leaveLine = `<div class="hleave">ends ${fmtShort(ev._e)}</div>`;
      if (info) thenLine = `<div class="hthen">then: ${esc(hotelShort(thenNext.hotel))} next</div>`;
    }
  } else {
    /* Nothing is on, so nowhere is known: no leave-by. The ring counts to
       the start, and the walk from the previous pick is offered as an
       estimate, not an instruction. */
    kicker = "Your next";
    const info = leaveInfo(from, ev, now);
    target = ev._s;
    windowStart = new Date(ev._s.getTime() - 60 * 60000);
    leaveLine = `<div class="hleave">starts ${fmtShort(ev._s)}</div>`;
    thenLine = info && info.estimate ? `<div class="hthen hwalk">${esc(info.estimate.label)}</div>` : "";
  }
  const total = Math.max(1, minutesBetween(windowStart, target));
  const leftMin = minutesBetween(now, target);

  return `<button class="hero${late ? " late" : ""}" data-hero="${esc(ev.id)}">
    ${ringHTML(leftMin / total, leftMin, late)}
    <div class="hbody">
      <div class="hkicker">${kicker}</div>
      <div class="htitle">${esc(ev.title)}</div>
      <div class="hroom" style="--h:var(${hotelVar(ev.hotel)})">${placeHTML(ev)}</div>
      ${leaveLine}${thenLine}
    </div>
  </button>`;
}

/* ---- Now ---------------------------------------------------------- */
/* Before the con the Now tab previews a sensible moment instead of an empty
   one. Shared so the minute tick sees the same clock as the render. After
   the con the tab is the archive, and this is not consulted. */
function effectiveNow() {
  const real = now();
  if (conPhase(real) === "before") {
    return {now: toDate("2026-09-03T10:00"),
      banner: `<b>Con starts Thursday.</b> Showing Thursday 10:00 AM as a preview. Use Settings to preview any other time.`};
  }
  return {now: real, banner: ""};
}

/* ---- The notice above the views ------------------------------------ */
/* After the con: that it is over, on every tab, until dismissed - once,
   and remembered for that year. Before it: the preview banner. Live:
   nothing. */
const ARCHIVE_NOTICE_KEY = "dc26.archiveNoticeDismissed";
const archiveNoticeDismissed = () => loadJSON(ARCHIVE_NOTICE_KEY, null) === CON.year;
function noticeHTML() {
  if (conEnded()) {
    return archiveNoticeDismissed() ? "" : `<b>Dragon Con ${CON.year} has ended.</b> Your starred events are on the Now tab as your ${CON.year} schedule.
    <div class="btns"><button class="btn quiet" data-act="dismiss-archive">OK</button></div>`;
  }
  return effectiveNow().banner;
}
let lastNoticeHTML = null;
function renderNotice() {
  const html = noticeHTML();
  if (html === lastNoticeHTML) return;       // the tick calls this every minute
  lastNoticeHTML = html;
  const el = document.getElementById("notice");
  el.hidden = !html;
  el.className = conEnded() ? "notice archive" : "notice";
  el.innerHTML = html;
}

/* ---- The Now tab after the con ------------------------------------- */
/* The record: every starred event, by con day, in time order. Rows work
   as they do anywhere, so the list can still be tidied. */
const ARCHIVE_SIG = "archive";
function archiveHTML() {
  const mine = events.filter(e => picks.has(e.id));
  let html = pickNewsHTML() + `<div class="section-title">Your ${CON.year} schedule <span class="count">${mine.length}</span></div>`;
  if (!mine.length) return html + `<div class="empty"><b>Nothing starred.</b> Star things in Search and they'll be listed here by day.</div>`;
  html += `<ul class="list">`;
  let lastDay = "";
  mine.forEach(ev => {
    if (ev._cd !== lastDay) { html += `<li class="day-head">${DAY_LONG[ev._cd] || ev._cd}</li>`; lastDay = ev._cd; }
    html += rowHTML(ev, {list: "archive"});
  });
  return html + `</ul>`;
}

/* What the Now tab would show, without building any of it.
   The plan is today's - the con day, which runs to 5am - because "your next"
   and "leave by" are about the next few hours, and a Saturday pick seen from
   Thursday was being announced as starting at 2:30 PM with no day on it.
   Anything still running past 5am counts as today too. A pick on a later
   day gets one line naming the day, so the tab never looks empty when the
   plan is not. */
function nowModel(now) {
  const horizon = new Date(now.getTime() + 60 * 60000);
  const today = conDayKey(now);
  const future = events.filter(e => picks.has(e.id) && e._e > now);
  const minePlan = future.filter(e => conDayKey(e._s) === today || e._s <= now);
  const later = minePlan.length ? null : (future.find(e => conDayKey(e._s) > today) || null);
  const onNowEv = minePlan.find(e => e._s <= now && now < e._e) || null;
  const upcoming = minePlan.filter(e => e._s > now);
  const heroEv = minePlan.length ? (onNowEv || upcoming[0]) : null;
  const rest = heroEv ? minePlan.filter(e => e !== heroEv) : [];
  const around = events.filter(e => e._e > now && e._s <= horizon
    && !(state.browse.hideNoise && isNoise(e))
    && hotelMatches(e, state.now.hotel));
  return {minePlan, later, onNowEv, upcoming, heroEv, rest, around, shown: around.slice(0, state.now.limit)};
}

const statusShown = (ev, now) => ev._s <= now || minutesBetween(now, ev._s) <= 90;

/* Everything that decides which elements exist. The clock is deliberately
   absent: a new minute changes the words, not the structure. */
function nowSignature(m, now, banner) {
  return [
    banner,
    m.heroEv ? m.heroEv.id : "-",
    m.later ? m.later.id : "-",
    pickNews.length,
    nudgeVisible() ? "nudge" : "-",
    m.onNowEv ? "on" : "next",
    m.rest.map(e => e.id + (statusShown(e, now) ? "!" : "")).join(","),
    m.around.length,
    m.shown.map(e => (e._s <= now ? "o" : "u") + e.id).join(","),
  ].join("|");
}
let lastNowSig = null;

function renderNow() {
  if (conEnded()) { lastNowSig = ARCHIVE_SIG; document.getElementById("view-now").innerHTML = archiveHTML(); return; }
  const {now, banner} = effectiveNow();
  const model = nowModel(now);
  lastNowSig = nowSignature(model, now, banner);
  const minePlan = model.minePlan;
  let mineHTML = nudgeHTML() + pickNewsHTML();
  if (minePlan.length) {
    const onNowEv = model.onNowEv, upcoming = model.upcoming, heroEv = model.heroEv;
    const thenNext = onNowEv ? upcoming[0] : null;
    mineHTML += heroHTML(heroEv, now, !!onNowEv, thenNext);
    const rest = model.rest;
    if (rest.length) {
      mineHTML += `<div class="section-title">Rest of your day <span class="count">${minePlan.length} today</span></div><ul class="list compact">`;
      rest.forEach((ev, i) => {
        const status = ev._s <= now ? `On now, ends ${fmtShort(ev._e)}` : `In ${minutesBetween(now, ev._s)} min`;
        mineHTML += gapHTML(i === 0 ? heroEv : rest[i - 1], ev) + rowHTML(ev, {list: "next", status: minutesBetween(now, ev._s) <= 90 || ev._s <= now ? status : ""});
      });
      mineHTML += `</ul>`;
    }
  } else if (model.later) {
    const day = DAY_LONG[conDayKey(model.later._s)] || model.later.day;
    mineHTML += `<div class="empty"><b>Nothing picked for later today.</b> Your next pick is on ${day}.</div>
      <ul class="list compact">${rowHTML(model.later, {list: "next", showDay: true})}</ul>`;
  } else {
    mineHTML += `<div class="empty"><b>Nothing picked for later today.</b> Star things in Search and they show up here with walk times.</div>`;
  }

  const around = model.around, shown = model.shown;
  let aroundHTML = `<div class="section-title">On now and in the next hour <span class="count">${around.length}</span></div>
    <div class="controls" style="padding-top:0"><div class="chips" data-row="now-hotel">${chipHTML("All", state.now.hotel === "All", "now-hotel")}${hotelChips.map(h => chipHTML(hotelShort(h), state.now.hotel === h, "now-hotel", h)).join("")}</div></div><ul class="list compact">`;
  let lastKey = "";
  shown.forEach(ev => {
    const key = ev._s <= now ? "on" : fmtShort(ev._s);
    if (key !== lastKey) { aroundHTML += `<li class="time-head">${key === "on" ? "On now" : "Starts " + key}</li>`; lastKey = key; }
    aroundHTML += rowHTML(ev, {list: "around"});
  });
  aroundHTML += `</ul>`;
  if (around.length > shown.length) aroundHTML += `<button class="btn quiet more" data-act="more-now">Show ${around.length - shown.length} more</button>`;
  if (!around.length) aroundHTML += `<div class="empty">Nothing on in this window${state.now.hotel !== "All" ? " at the " + hotelShort(state.now.hotel) : ""}.</div>`;
  document.getElementById("view-now").innerHTML = mineHTML + aroundHTML;
}

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
  const isPerson = suggestDocs.some(d => d.group === "people" && d.name.toLowerCase() === name.toLowerCase());
  if (!isPerson) return "";
  const lower = name.toLowerCase();
  const shown = new Set(results.map(e => e.id));
  const hidden = events.filter(e => isNoise(e) && !shown.has(e.id)
    && (e.speakers || []).some(p => (p.name || "").toLowerCase() === lower));
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

function chipHTML(label, on, kind, value, style) {
  const v = value ?? label;
  const cls = kind.endsWith("hotel") && v !== "All" ? `chip hotel` : `chip`;
  const st = kind.endsWith("hotel") && v !== "All" ? ` style="--h:var(${hotelVar(v)})"` : "";
  return `<button class="${cls}" data-chip="${kind}" data-value="${esc(v)}" aria-pressed="${on}"${st}>${esc(label)}</button>`;
}

/* ---- Browse ------------------------------------------------------- */
function passesFilters(e) {
  const f = activeFilters(), tg = e.tags || {};
  return (f.day === "All" || e._cd === f.day) &&
    hotelMatches(e, f.hotel) &&
    (f.type === "All" || e.type === f.type) &&
    (f.track === "All" || (e.tracks || []).includes(f.track)) &&
    (f.fandom === "All" || (tg.fandoms || []).includes(f.fandom)) &&
    (f.kind === "All" || tg.kind === f.kind) &&
    (!f.adultOnly || !!tg.adult) &&
    (!f.hideAdult || !tg.adult) &&
    (!f.time || inTimeBand(e, f.time)) &&
    (!f.hideNoise || !isNoise(e));
}
/* ==================================================================
   Query intent: "star trek saturday hilton" is three different asks.
   Pull the filter words out, search on what's left, and show what we
   took so the reader can put it back.
   ================================================================== */
const DAY_WORDS = {wed: 2, wednesday: 2, thu: 3, thur: 3, thurs: 3, thursday: 3, fri: 4, friday: 4,
  sat: 5, saturday: 5, sun: 6, sunday: 6, mon: 7, monday: 7};
const HOTEL_WORDS = {marriott: "Marriott", hyatt: "Hyatt", hilton: "Hilton", westin: "Westin",
  courtland: "Courtland Grand", sheraton: "Courtland Grand", mart: "AmericasMart", americasmart: "AmericasMart"};
const TIME_BANDS = {morning: [0, 12], afternoon: [12, 17], evening: [17, 21], "late night": [21, 29], late: [21, 29]};

/* Longest phrases first so "photo op" wins over "photo" and "late night"
   over "late". Each entry knows how to label itself and what text to strip. */
function queryRules() {
  const r = [];
  const add = (word, dim, value, label) => r.push({word, dim, value, label});
  Object.entries(DAY_WORDS).forEach(([w, dayNum]) => add(w, "day", `2026-09-0${dayNum}`, DAY_LONG[`2026-09-0${dayNum}`]));
  Object.entries(HOTEL_WORDS).forEach(([w, h]) => add(w, "hotel", h, hotelShort(h)));
  add("q&a", "kind", "qa", "Celebrity Q&A"); add("qa", "kind", "qa", "Celebrity Q&A");
  add("signing", "kind", "signing", "Signing");
  add("photo op", "kind", "photo", "Photo op"); add("photo", "kind", "photo", "Photo op");
  add("screening", "kind", "screening", "Screening");
  add("workshop", "kind", "workshop", "Workshop");
  add("party", "kind", "party", "Party");
  add("contest", "kind", "contest", "Contest");
  add("concert", "kind", "performance", "Performance"); add("performance", "kind", "performance", "Performance");
  add("gaming", "kind", "gaming", "Gaming"); add("game", "kind", "gaming", "Gaming");
  add("18+", "adult", true, "18+"); add("adult", "adult", true, "18+");
  /* Someone searching "kids" wants the Kids Track, not merely the absence of
     adult content - hiding 18+ is the lesser half of what they mean. */
  ["kids", "kid", "family", "children"].forEach(w => add(w, "kidstrack", true, "Kids Track"));
  Object.keys(TIME_BANDS).forEach(w => add(w, "time", w, w[0].toUpperCase() + w.slice(1)));
  add("today", "rel", "today", "Today");
  add("tonight", "rel", "tonight", "Tonight");
  add("tomorrow", "rel", "tomorrow", "Tomorrow");
  return r.sort((a, b) => b.word.length - a.word.length);
}
let QUERY_RULES = null;

/* Token matching, not regular expressions: the vocabulary contains "q&a"
   and "18+", and building patterns out of those invites escaping bugs. */
/* "d&d" survives tokenising as one token and matches nothing; the index
   holds "dungeons" and "dragons" as separate terms. Expand before searching
   so the shorthand people actually type reaches the words that were indexed. */
const QUERY_EXPANSIONS = [
  [/\bd\s*&\s*d\b/gi, "dungeons dragons"],
  [/\bdnd\b/gi, "dungeons dragons"],
  [/\bdungeons\b(?!\s+(?:and|&)?\s*dragons\b)/gi, "dungeons dragons"],
];
function expandQuery(text) {
  let out = String(text || "");
  for (const [re, to] of QUERY_EXPANSIONS) out = out.replace(re, to);
  return out.replace(/\s+/g, " ").trim();
}

function tokenise(text) { return String(text || "").toLowerCase().split(/[\s,]+/).filter(Boolean); }
function stripPhrase(tokens, phrase) {
  const want = phrase.split(" ");
  for (let i = 0; i + want.length <= tokens.length; i++) {
    if (want.every((w, j) => tokens[i + j] === w)) return tokens.slice(0, i).concat(tokens.slice(i + want.length));
  }
  return null;
}

function parseQuery(raw) {
  if (!QUERY_RULES) QUERY_RULES = queryRules();
  let tokens = tokenise(raw);
  const found = [], taken = new Set();
  for (const rule of QUERY_RULES) {
    if (taken.has(rule.dim) && rule.dim !== "rel") continue;
    const after = stripPhrase(tokens, rule.word);
    if (!after) continue;
    tokens = after;
    taken.add(rule.dim);
    found.push({...rule, src: rule.word});
  }
  const residual = tokens.join(" ");

  /* "gaming" alone is a filter; "gaming" inside a real query is a search
     word, unless a day or hotel is pinning it down. */
  const gi = found.findIndex(f => f.dim === "kind" && f.value === "gaming");
  if (gi >= 0 && residual && !found.some(f => f.dim === "day" || f.dim === "hotel" || f.dim === "rel")) {
    found.splice(gi, 1);
    /* Re-strip from the original so the word goes back where it was written,
       rather than being tacked on the end. */
    let keep = tokenise(raw);
    for (const f of found) { const a = stripPhrase(keep, f.word); if (a) keep = a; }
    return finishParse(keep.join(" "), found);
  }
  return finishParse(residual, found);
}

function finishParse(residual, found) {
  const filters = {};
  const chips = [];
  for (const f of found) {
    if (f.dim === "rel") {
      const base = conDayKey(now());
      let day = base;
      if (f.value === "tomorrow") {
        const d = new Date(`${base}T12:00`); d.setDate(d.getDate() + 1); day = dayOf(d);
      }
      filters.day = day;
      if (f.value === "tonight") filters.time = "evening";
      chips.push({dim: "day", label: f.label, src: f.src});
    } else if (f.dim === "kidstrack") {
      filters.track = "Kids Track";
      filters.adult = false;
      chips.push({dim: "track", label: f.label, src: f.src});
    } else {
      filters[f.dim] = f.value;
      chips.push({dim: f.dim, label: f.label, src: f.src});
    }
  }
  return {residual, filters, chips};
}

function inTimeBand(e, band) {
  const [lo, hi] = TIME_BANDS[band] || [];
  if (lo === undefined) return true;
  let h = e._s.getHours();
  if (h < 5) h += 24;                    // a 1am panel belongs to the night before
  return h >= lo && h < hi;
}

/* Chip filters still apply; a parsed word overrides the chip on its own
   dimension for as long as the word is in the box. */
function activeFilters() {
  const b = state.browse, f = (state.browse.parsed && state.browse.parsed.filters) || {};
  return {
    day: f.day !== undefined ? f.day : b.day,
    hotel: f.hotel !== undefined ? f.hotel : b.hotel,
    kind: f.kind !== undefined ? f.kind : b.kind,
    type: b.type,
    track: f.track !== undefined ? f.track : b.track,
    fandom: b.fandom,
    adultOnly: f.adult === true,
    /* Only a query word hides 18+ now ("kids"); the checkbox is gone. */
    hideAdult: f.adult === false,
    time: f.time,
    /* Asking for photo sessions or screenings outranks the setting that hides
       them; so does tapping their chip, and so does the reveal link. */
    hideNoise: b.hideNoise && !state.browse.showHidden
      && !["photo", "screening"].includes(f.kind !== undefined ? f.kind : b.kind),
  };
}

const LOOSE_THRESHOLD = 8;

/* How well one typed word matched: 1 if it matched an index term literally,
   otherwise how much of that term it actually covered. "drag" is 67% of
   "dragon" but only 44% of "dragoncon", and the shorter the fragment the
   weaker the evidence - which is what stops a four-letter prefix from
   ranking on the strength of somebody else's long title. */
function termQuality(t, matched, match) {
  if (match && match[t]) return 1;
  let best = 0;
  for (const m of matched) {
    if (!m.startsWith(t) && !t.startsWith(m)) continue;
    const r = Math.min(t.length, m.length) / Math.max(t.length, m.length);
    if (r > best) best = r;
  }
  return best;
}

/* Rank one pass of MiniSearch. coverage rewards matching more of what was
   typed; quality rewards matching it squarely rather than by a fragment. */
function collectHits(text, opts, queryTerms, seen) {
  const out = [];
  const n = queryTerms.length || 1;
  for (const h of index.search(text, opts)) {
    if (seen.has(h.id)) continue;
    const e = byId.get(h.id);
    if (!e || !passesFilters(e)) continue;
    seen.add(h.id);
    const coverage = new Set(h.queryTerms).size / n;
    const matched = h.match ? Object.keys(h.match) : [];
    const quality = queryTerms.reduce((acc, t) => acc + termQuality(t, matched, h.match), 0) / n;
    const exact = queryTerms.some(t => h.match && h.match[t]);
    e._hit = {score: h.score * (0.5 + coverage) * (1 + 0.5 * quality), terms: h.terms, exact};
    out.push(e);
  }
  out.sort((a, b) => b._hit.score - a._hit.score || a._s - b._s);
  return out;
}

function browseResults() {
  state.browse.parsed = parseQuery(state.browse.q);
  const raw = state.browse.parsed.residual;
  /* A tapped suggestion arrives quoted: match that name exactly rather than
     letting prefix and fuzzy drag in everyone with a similar surname. */
  const phrase = /^".+"$/.test(raw) ? raw.slice(1, -1) : null;
  const q = phrase === null ? expandQuery(raw) : raw;
  const queryTerms = [...new Set((phrase || q).split(/[\s\p{P}]+/u).map(processTerm).filter(Boolean))];

  /* Nothing left to rank by - either every word was a filter, or what remains
     is all stopwords ("what is at the westin"). Hand back the filtered set. */
  if (!q || !index || !queryTerms.length) {
    /* "late night" and "party" are questions about tonight, not about the
       whole weekend - so a query that resolved entirely to filters is scoped
       to today unless it named a day itself, or a day chip is set, or the
       reader took the Today chip off. After the con there is no today. */
    const b = state.browse;
    const parsedDay = b.parsed.filters.day;
    const scope = !!b.q.trim() && !parsedDay && b.day === "All" && !b.noToday && !conEnded();
    b.todayScoped = scope;
    let list = events.filter(passesFilters);
    if (scope) {
      const today = conDayKey(now());
      list = list.filter(e => conDayKey(e._s) === today);
    }
    list.sort((a, b2) => a._s - b2._s);
    const at = now(), up = [], gone = [];
    list.forEach(e => { e._hit = null; (isPast(e, at) ? gone : up).push(e); });
    up.forEach(e => e._section = "main");
    gone.forEach(e => e._section = "past");
    return up.concat(gone);
  }
  state.browse.todayScoped = false;

  const seen = new Set();
  let main, loose = [];
  if (phrase) {
    main = collectHits(phrase, {prefix: false, fuzzy: false, combineWith: "AND"}, queryTerms, seen);
  } else {
    /* Everything typed, then - only if that was too thin - anything typed.
       "board games" should not return all 1,300 events containing "games". */
    main = collectHits(q, {combineWith: "AND"}, queryTerms, seen);
    if (main.length < LOOSE_THRESHOLD) loose = collectHits(q, {combineWith: "OR"}, queryTerms, seen);
  }

  /* A search is a question about the whole con, so it crosses days - which
     means it turns up things that already finished. They stay, behind a fold. */
  const at = now();
  const upcoming = [], past = [];
  for (const e of main) (isPast(e, at) ? past : upcoming).push(e);
  const looseUpcoming = [], loosePast = [];
  for (const e of loose) (isPast(e, at) ? loosePast : looseUpcoming).push(e);

  upcoming.forEach(e => e._section = "main");
  looseUpcoming.forEach(e => e._section = "loose");
  const pastAll = past.concat(loosePast);
  pastAll.forEach(e => e._section = "past");
  return upcoming.concat(looseUpcoming, pastAll);
}

function renderBrowse() {
  const b = state.browse;
  if (b.day === null) { const d = conDayKey(now()); b.day = CON_DAYS.includes(d) ? d : "2026-09-03"; }
  const searching = !!b.q.trim();
  const results = browseResults();
  const shown = results.slice(0, PAGE * b.page);
  const noiseCount = events.filter(e => isNoise(e) && (b.day === "All" || e._cd === b.day)).length;
  const hasTags = events.some(e => e.tags);
  const fandoms = hasTags ? fandomCounts() : [];
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
      ${hasTags ? `<select class="track" id="fandom" aria-label="Fandom"><option value="All">Any fandom</option>${fandoms.map(([f, n]) => `<option value="${esc(f)}" ${b.fandom === f ? "selected" : ""}>${esc(f)} (${n})</option>`).join("")}</select>` : ""}
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

/* ---- Explore ------------------------------------------------------- */

const KIND_NOUN = {track: "Track", fandom: "Fandom", topic: "Topic", person: "Person"};

/* Built once from the loaded schedule: everything you could follow, with how
   many events each carries. Fandoms need 3+ to be worth a tile; people need
   to be a celebrity guest or busy enough to be worth following. */
let catalogue = null;
function buildCatalogue() {
  const tally = (get) => {
    const m = new Map();
    events.forEach(e => (get(e) || []).forEach(k => { if (k) m.set(k, (m.get(k) || 0) + 1); }));
    return m;
  };
  const rank = m => [...m].map(([key, count]) => ({key, count}))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  const people = new Map(), celebs = new Set();
  events.forEach(e => {
    (e.speakers || []).forEach(p => {
      const n = (p && p.name || "").trim();
      if (!n) return;
      people.set(n, (people.get(n) || 0) + 1);
      if (isCeleb(e)) celebs.add(n);
    });
  });

  /* Tracks are looked up by name, so they go A to Z, with the two noise
     tracks last: sorted by count the page opened with Epic Photos, which
     Search hides by default. Fandoms and topics keep count order - there the
     number is the point. People split in two: guests by how busy they are,
     panelists A to Z, because "6 events" says nothing about a name you don't
     know. Both are still one kind of follow. */
  const byName = (a, b) => a.key.localeCompare(b.key);
  const person = rank(people).filter(t => celebs.has(t.key) || t.count >= 5);
  catalogue = {
    track: [...tally(e => e.tracks)].map(([key, count]) => ({key, count}))
      .sort((a, b) => (NOISE_TRACKS.has(a.key) - NOISE_TRACKS.has(b.key)) || byName(a, b)),
    fandom: rank(tally(e => (e.tags || {}).fandoms)).filter(t => t.count >= 3),
    topic: rank(tally(e => (e.tags || {}).topics)),
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
  {id: "fandom", kind: "fandom", label: "Fandoms"},
  {id: "topic", kind: "topic", label: "Topics"},
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
  return FOLLOW_KINDS.includes(kind) && key ? {kind, key} : null;
}
function openExplorePage(kind, key, keepScroll) {
  if (!keepScroll) state.explore.scroll = pageScrollTop();
  state.explore.page = {kind, key};
  state.explore.showPast = false;
  state.tab = "explore";
  setExploreHash(`${kind}:${key}`);
  render();
  pageScrollTo(0);
}
function closeExplorePage() {
  state.explore.page = null;
  setExploreHash(null);
  render();
  pageScrollTo(state.explore.scroll || 0);
}

function tileHTML(kind, item) {
  const on = isFollowing(kind, item.key);
  return `<button class="tile${on ? " on" : ""}" data-explore="${esc(kind + ":" + item.key)}">
    <span class="tile-name">${esc(item.key)}</span>
    <span class="tile-meta">${on ? `<span class="tile-mark" aria-label="Following">&#9679;</span>` : ""}${item.count}</span>
  </button>`;
}

function exploreSectionsHTML() {
  const cat = getCatalogue();
  const q = state.explore.q.trim().toLowerCase();
  const match = list => q ? list.filter(t => t.key.toLowerCase().includes(q)) : list;
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
  const lists = {track: cat.track, fandom: cat.fandom, person: cat.guest};
  const tally = new Map();
  const bump = (kind, key) => {
    if (!key || isFollowing(kind, key)) return;
    const item = lists[kind].find(t => t.key === key);
    if (!item) return;
    const id = `${kind}:${key}`;
    const rec = tally.get(id) || {kind, key, count: item.count, picks: 0};
    rec.picks++;
    tally.set(id, rec);
  };
  picks.forEach(id => {
    const e = byId.get(id);
    if (!e) return;
    (e.tracks || []).forEach(t => { if (!NOISE_TRACKS.has(t)) bump("track", t); });
    ((e.tags || {}).fandoms || []).forEach(f => bump("fandom", f));
    (e.speakers || []).forEach(p => bump("person", (p && p.name || "").trim()));
  });
  return [...tally.values()]
    .sort((a, b) => b.picks - a.picks || b.count - a.count || a.key.localeCompare(b.key))
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

function renderExplorePage() {
  const {kind, key} = state.explore.page;
  const all = eventsFor({kind, key});
  const at = now();
  const upcoming = all.filter(e => !isPast(e, at)), past = all.filter(e => isPast(e, at));
  const on = isFollowing(kind, key);

  let html = `<div class="explore-head">
    <button class="back" data-act="explore-back" aria-label="Back to Explore">&#8592; Explore</button>
    <div class="eh-kind">${KIND_NOUN[kind] || kind}</div>
    <h2 class="eh-name">${esc(key)}</h2>
    <div class="eh-count">${all.length} event${all.length === 1 ? "" : "s"}${past.length ? ` &middot; ${upcoming.length} still to come` : ""}</div>
    <button class="btn follow-btn${on ? " on" : ""}" data-act="toggle-follow" aria-pressed="${on}">${on ? "Following" : "Follow"}</button>
  </div>`;

  const dayGroups = list => {
    let out = "", lastDay = "";
    list.forEach(ev => {
      if (ev._cd !== lastDay) { out += `<li class="day-head">${DAY_LONG[ev._cd] || ev._cd}</li>`; lastDay = ev._cd; }
      out += rowHTML(ev, {list: "explore"});
    });
    return out;
  };

  if (!all.length) {
    html += `<div class="empty"><b>No events.</b> Nothing in the schedule matches this any more.</div>`;
  } else {
    if (upcoming.length) html += `<ul class="list">${dayGroups(upcoming)}</ul>`;
    else html += `<div class="empty">Everything here has already happened.</div>`;
    if (past.length) {
      html += `<div class="divider fold"><button data-act="explore-past" aria-expanded="${state.explore.showPast}">Already happened (${past.length}) <span aria-hidden="true">${state.explore.showPast ? "▾" : "▸"}</span></button></div>`;
      if (state.explore.showPast) html += `<ul class="list">${dayGroups(past)}</ul>`;
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
      <button class="fc-name" data-explore="${esc(followId(f))}">${esc(f.key)}</button>
      <button class="fc-x" data-act="unfollow" data-follow="${esc(followId(f))}" aria-label="Unfollow ${esc(f.key)}">&times;</button>
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
    html += `<div class="section-title">${esc(f.key)} <span class="count">${KIND_NOUN[f.kind] || f.kind} &middot; ${upcoming.length} ${conEnded() ? "events" : "to come"}</span></div>`;
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
    if (!rec.labels.includes(f.key)) rec.labels.push(f.key);
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

/* ---- Mine --------------------------------------------------------- */
/* Side-by-side columns for anything that overlaps in time. Events are
   grouped into clusters that genuinely collide, and each cluster is
   given only as many columns as it actually needs. */
const HOUR_PX = 60;
function layoutColumns(list) {
  const sorted = [...list].sort((a, b) => a._s - b._s || a._e - b._e);
  const out = [];
  let cluster = [], clusterEnd = null;
  const flush = () => {
    if (!cluster.length) return;
    const colEnds = [];
    cluster.forEach(it => {
      let c = colEnds.findIndex(end => end <= it.ev._s.getTime());
      if (c === -1) { c = colEnds.length; colEnds.push(0); }
      colEnds[c] = it.ev._e.getTime();
      it.col = c;
    });
    cluster.forEach(it => it.cols = colEnds.length);
    out.push(...cluster);
    cluster = []; clusterEnd = null;
  };
  sorted.forEach(ev => {
    if (clusterEnd !== null && ev._s.getTime() >= clusterEnd) flush();
    cluster.push({ev, col: 0, cols: 1});
    clusterEnd = clusterEnd === null ? ev._e.getTime() : Math.max(clusterEnd, ev._e.getTime());
  });
  flush();
  return out;
}

function timelineDayHTML(dayKey, list, now) {
  const items = layoutColumns(list);
  const sorted = items.map(i => i.ev).sort((a, b) => a._s - b._s);
  const startMs = Math.min(...sorted.map(e => e._s.getTime()));
  const endMs = Math.max(...sorted.map(e => e._e.getTime()));
  const origin = new Date(startMs); origin.setMinutes(0, 0, 0);
  const last = new Date(endMs);
  if (last.getMinutes() || last.getSeconds()) { last.setMinutes(0, 0, 0); last.setHours(last.getHours() + 1); }
  const spanH = Math.max(1, Math.round((last - origin) / 3600000));
  const top = t => ((t - origin) / 60000) * (HOUR_PX / 60);

  let hours = "";
  for (let h = 0; h <= spanH; h++) {
    const at = new Date(origin.getTime() + h * 3600000);
    hours += `<div class="tl-hour" style="top:${h * HOUR_PX}px"><span>${fmtShort(at)}</span></div>`;
  }

  const blocks = items.map(({ev, col, cols}) => {
    const h = Math.max(24, top(ev._e.getTime()) - top(ev._s.getTime()) - 2);
    const w = 100 / cols;
    const long = h >= 150;
    return `<button class="tl-block${long ? " long" : ""}" data-hero="${esc(ev.id)}" style="top:${top(ev._s.getTime()).toFixed(1)}px;height:${h.toFixed(1)}px;left:${(col * w).toFixed(2)}%;width:calc(${w.toFixed(2)}% - 3px);--h:var(${hotelVar(ev.hotel)})">
      <span class="tb-title">${esc(ev.title)}</span>
      <span class="tb-room">${esc(ev.room || ev.location || "")}</span>
      ${long ? `<span class="tb-runs">runs to ${fmtShort(ev._e)}</span>` : ""}
    </button>`;
  }).join("");

  let links = "";
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], next = sorted[i];
    if (prev.hotel === next.hotel) continue;
    const walk = walkMin(prev.hotel, next.hotel);
    const gap = minutesBetween(prev._e, next._s);
    const y1 = top(prev._e.getTime()), y2 = top(next._s.getTime());
    const height = Math.max(18, y2 - y1);
    links += `<div class="tl-link${gap < walk ? " tight" : ""}" style="top:${Math.min(y1, y2).toFixed(1)}px;height:${height.toFixed(1)}px">
      <span>${walk} min</span></div>`;
  }

  const nowLine = conDayKey(now) === dayKey && now >= origin && now <= last
    ? `<div class="tl-now" style="top:${top(now.getTime()).toFixed(1)}px"></div>` : "";

  return `<div class="tl-day">
    <div class="day-head" style="padding-left:0">${DAY_LONG[dayKey] || dayKey} <span class="count" style="font-size:.875rem;color:var(--dim);font-weight:400">${list.length}</span></div>
    <div class="tl-grid" style="height:${spanH * HOUR_PX + 12}px">${hours}${links}${blocks}${nowLine}</div>
  </div>`;
}

function renderMineTimeline(mine, now) {
  const days = new Map();
  mine.forEach(ev => {
    const k = conDayKey(ev._s);
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(ev);
  });
  return [...days.keys()].sort().map(k => timelineDayHTML(k, days.get(k), now)).join("");
}

function renderMine() {
  const mine = events.filter(e => picks.has(e.id));
  let html = pickNewsHTML() + `<div class="mine-actions">
    <button class="btn" data-act="ics" ${mine.length ? "" : "disabled"}>Export to calendar</button>
    <button class="btn quiet" data-act="clear" ${mine.length ? "" : "disabled"}>Remove all</button>
  </div>`;
  if (mine.length) html += `<div class="view-toggle" role="group" aria-label="View">
    <button data-act="view-timeline" aria-pressed="${state.mineView === "timeline"}">Timeline</button>
    <button data-act="view-list" aria-pressed="${state.mineView === "list"}">List</button>
  </div>`;
  if (!mine.length) {
    html += `<div class="empty"><b>Nothing picked yet.</b> Star things in Search. They'll line up here by day with warnings when two picks overlap or the walk between hotels is too tight.</div>`;
  } else if (state.mineView === "timeline") {
    html += renderMineTimeline(mine, now());
  } else {
    html += `<ul class="list">`;
    let lastDay = "", prev = null;
    mine.forEach(ev => {
      if (ev._cd !== lastDay) { html += `<li class="day-head">${DAY_LONG[ev._cd] || ev._cd} <span class="count" style="font-size:.875rem;color:var(--dim);font-weight:400">${mine.filter(x => x._cd === ev._cd).length}</span></li>`; lastDay = ev._cd; prev = null; }
      html += gapHTML(prev, ev) + rowHTML(ev, {list: "mine"});
      prev = ev;
    });
    html += `</ul>`;
  }
  document.getElementById("view-mine").innerHTML = html;
  fitTimelineBlocks();
}

/* Measured, so it only acts where it has to; jsdom reports no heights and
   leaves every block alone. */
function fitTimelineBlocks() {
  document.querySelectorAll("#view-mine .tl-block").forEach(b => {
    b.classList.remove("tight", "tighter");
    if (b.scrollHeight > b.clientHeight + 1) b.classList.add("tight");
    if (b.scrollHeight > b.clientHeight + 1) b.classList.add("tighter");
  });
}

/* ==================================================================
   Calendar export (.ics)
   ================================================================== */
function icsEscape(s) { return String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
function fold(line) { const out = []; while (line.length > 74) { out.push(line.slice(0, 74)); line = " " + line.slice(74); } out.push(line); return out.join("\r\n"); }
function icsDate(d) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`; }
function exportICS() { downloadICS(events.filter(e => picks.has(e.id)), "dragoncon-2026-my-schedule.ics"); }
function exportEventICS(ev) {
  downloadICS([ev], `dragoncon-2026-${(ev.title || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "event"}.ics`);
}
function downloadICS(mine, filename) {
  const stamp = now().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//dragoncon-planner//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Dragon Con 2026",
    "BEGIN:VTIMEZONE", "TZID:America/New_York",
    "BEGIN:DAYLIGHT", "TZOFFSETFROM:-0500", "TZOFFSETTO:-0400", "TZNAME:EDT", "DTSTART:19700308T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:-0400", "TZOFFSETTO:-0500", "TZNAME:EST", "DTSTART:19701101T020000", "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU", "END:STANDARD",
    "END:VTIMEZONE"];
  mine.forEach(ev => {
    const who = (ev.speakers || []).map(p => p.name).join(", ");
    const desc = [ev.description, who ? `With: ${who}` : "", ev.track ? `Track: ${ev.track}` : ""].filter(Boolean).join("\n");
    lines.push("BEGIN:VEVENT", `UID:dc26-${ev.id}@dragoncon-planner`, `DTSTAMP:${stamp}`,
      `DTSTART;TZID=America/New_York:${icsDate(ev._s)}`, `DTEND;TZID=America/New_York:${icsDate(ev._e)}`,
      fold(`SUMMARY:${icsEscape(ev.title)}`), fold(`LOCATION:${icsEscape(ev.location)}`), fold(`DESCRIPTION:${icsEscape(desc)}`), "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n") + "\r\n"], {type: "text/calendar;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}

/* ==================================================================
   Events (the DOM kind)
   ================================================================== */

/* Starring changes what renders above the row you just tapped - the first
   pick inserts the whole hero card - which used to shove the list down by
   200px or more, so the next tap landed on whatever had slid into place.
   Keep the tapped row under the finger: measure it, re-render, put it back. */
function togglePick(id, anchor) {
  const wasTop = anchor ? anchor.getBoundingClientRect().top : null;
  const list = anchor ? anchor.dataset.list || "" : "";
  if (picks.has(id)) picks.delete(id); else picks.add(id);
  savePicks();
  render();
  if (wasTop === null) return;
  const sel = `.row[data-id="${cssEsc(id)}"]${list ? `[data-list="${cssEsc(list)}"]` : ""}`;
  const el = document.querySelector(sel);
  if (!el) return;
  const delta = el.getBoundingClientRect().top - wasTop;
  if (Math.abs(delta) > 1) pageScrollBy(delta);
}
const cssEsc = v => (window.CSS && CSS.escape) ? CSS.escape(v) : String(v);

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

/* Bottom sheet: one wrapper, three panels (settings, event, hotel) */
const sheetWrap = document.getElementById("sheetWrap");
const sheetEl = document.getElementById("sheet");
const panelSettings = document.getElementById("panel-settings");
const panelEvent = document.getElementById("panel-event");
const panelHotel = document.getElementById("panel-hotel");
let sheetScrollY = 0;

function fillSettings() {
  document.getElementById("crowd").value = settings.crowd;
  document.getElementById("crowdLabel").textContent = `${settings.crowd.toFixed(1)}x`;
  document.getElementById("noiseDefault").checked = settings.hideNoise;
  document.getElementById("bigText").checked = document.documentElement.classList.contains("bigtext");
  document.getElementById("previewTime").value = timeOverride ? localInputValue(timeOverride) : "";
  document.getElementById("walkTable").innerHTML = Object.entries(WALK).map(([k, v]) => `<tr><td>${esc(k.replace("|", " to "))}</td><td>${v}</td></tr>`).join("");
  document.getElementById("deviceLine").textContent = deviceLine();
}

function eventSheetHTML(ev) {
  const mine = picks.has(ev.id);
  const peopleRows = (ev.speakers || []).filter(p => p && p.name).map(p => ({
    name: p.name,
    label: p.role && p.role !== "Speaker" && p.role !== "Panelist" ? `${p.name} (${p.role.toLowerCase()})` : p.name,
  }));
  const dur = ev.duration_min ? (ev.duration_min >= 60 ? `${Math.floor(ev.duration_min / 60)} h${ev.duration_min % 60 ? ` ${ev.duration_min % 60} min` : ""}` : `${ev.duration_min} min`) : "";
  const chips = [...(ev.tracks || []), ...((ev.tags && ev.tags.fandoms) || [])];
  return `<div class="ev-head">
      <h2 id="sheetTitleEvent">${esc(ev.title)}</h2>
      <div class="ev-when">${DAY_LONG[ev.day] || ev.day}, ${fmtShort(ev._s)} to ${fmtShort(ev._e)}${dur ? ` &middot; ${dur}` : ""}${ev._cd !== ev.day ? ` &middot; ${DAY_LONG[ev._cd] || ev._cd} night` : ""}</div>
      <div class="ev-room" style="--h:var(${hotelVar(ev.hotel)})">${placeHTML(ev)}</div>
      ${ev.cancelled ? `<div><span class="cancelled-tag">Cancelled</span></div>` : ""}
      ${isCeleb(ev) ? `<div>${CELEB_BADGE}</div>` : ""}
    </div>
    <div class="ev-body">
      ${ev.description ? `<p>${esc(ev.description)}</p>` : `<p style="color:var(--muted)">No description.</p>`}
      ${peopleRows.length ? `<div class="ev-people">With ${peopleRows.map(p =>
        `<span class="who"><span>${esc(p.label)}</span> <button class="see-all" data-explore="person:${esc(p.name)}">See all</button></span>`).join(", ")}</div>` : ""}
      ${chips.length || (ev.tags && ev.tags.adult) ? `<div class="tagline">${chips.map(t => `<span class="tag">${esc(t)}</span>`).join("")}${ev.tags && ev.tags.adult ? `<span class="tag adult">18+</span>` : ""}</div>` : ""}
    </div>
    <div class="ev-actions">
      <button class="ev-star" id="sheetStar" aria-pressed="${mine}" aria-label="${mine ? "Remove from my schedule" : "Add to my schedule"}">${mine ? "★" : "☆"}</button>
      <button class="btn quiet" id="sheetICS">Add this to calendar</button>
      <button class="btn" id="closeSheetEvent">Done</button>
    </div>`;
}

function openSheet(kind = "settings", id = null) {
  if (kind === "event" && !byId.get(id)) return;
  if (kind === "hotel" && !MAP_HOTELS[id]) return;
  sheetScrollY = pageScrollTop();
  state.sheetId = kind === "event" ? id : null;
  state.sheetHotel = kind === "hotel" ? id : null;
  if (kind === "event") panelEvent.innerHTML = eventSheetHTML(byId.get(id));
  else if (kind === "hotel") panelHotel.innerHTML = hotelSheetHTML(id, mapDay());
  else fillSettings();
  panelSettings.hidden = kind !== "settings";
  panelEvent.hidden = kind !== "event";
  panelHotel.hidden = kind !== "hotel";
  sheetEl.setAttribute("aria-labelledby", {event: "sheetTitleEvent", hotel: "sheetTitleHotel"}[kind] || "sheetTitle");
  sheetEl.style.transform = "";
  sheetWrap.hidden = false;
}

function closeSheet() {
  sheetWrap.hidden = true;
  state.sheetId = null;
  state.sheetHotel = null;
  sheetEl.classList.remove("settling");
  sheetEl.style.transform = "";
  sheetBackEl.style.opacity = "";
  sheetBackEl.classList.remove("dragging");
  dragY = null;
  render();
  pageScrollTo(sheetScrollY);
}

/* Swipe down to dismiss.
   The sheet claims the gesture via touch-action, so the page behind it stays
   put; the backdrop fades with the drag so the sheet feels attached to it. */
const sheetBackEl = document.getElementById("sheetBack");
let dragY = null, dragT = 0, dragDy = 0;

function setDrag(dy) {
  dragDy = dy;
  sheetEl.style.transform = dy ? `translateY(${dy}px)` : "";
  const h = sheetEl.offsetHeight || 1;
  sheetBackEl.style.opacity = String(Math.max(0, 1 - (dy / h) * 0.9));
}
function settle(toClosed) {
  sheetEl.classList.add("settling");
  sheetBackEl.classList.remove("dragging");
  if (toClosed) {
    sheetEl.style.transform = `translateY(${sheetEl.offsetHeight}px)`;
    sheetBackEl.style.opacity = "0";
    const done = () => { sheetEl.removeEventListener("transitionend", done); closeSheet(); };
    sheetEl.addEventListener("transitionend", done);
    setTimeout(done, 320);            // belt and braces if the transition never fires
  } else {
    setDrag(0);
    setTimeout(() => sheetEl.classList.remove("settling"), 240);
  }
}

function applyExploreHash() {
  const target = readExploreHash();
  if (target) { state.tab = "explore"; state.explore.page = target; state.explore.showPast = false; }
  else if (state.explore.page) state.explore.page = null;
}

/* A minute changes the countdowns, not usually the list. Rebuilding the whole
   Now tab every 60s threw away and recreated every node under the reader's
   thumb; this redraws the hero and the "in N min" labels and leaves the rest
   alone, falling back to a full render the moment the structure really moves. */
function tickNow() {
  if (conEnded()) { if (lastNowSig !== ARCHIVE_SIG) renderNow(); return; }
  const {now, banner} = effectiveNow();
  const model = nowModel(now);
  const sig = nowSignature(model, now, banner);
  if (sig !== lastNowSig || !document.querySelector("#view-now .hero, #view-now .empty")) { renderNow(); return; }

  const view = document.getElementById("view-now");
  const heroEl = view.querySelector(".hero");
  if (heroEl && model.heroEv) {
    const holder = document.createElement("div");
    holder.innerHTML = heroHTML(model.heroEv, now, !!model.onNowEv, model.onNowEv ? model.upcoming[0] : null);
    const fresh = holder.firstElementChild;
    /* A countdown reading "2h" says the same thing a minute later; swapping the
       card anyway would drop a tap that happened to land on the tick. */
    if (fresh && fresh.outerHTML !== heroEl.outerHTML) heroEl.replaceWith(fresh);
  }
  model.rest.forEach(ev => {
    const el = view.querySelector(`.row[data-list="next"][data-id="${cssEsc(ev.id)}"] .status`);
    if (!el) return;
    el.textContent = ev._s <= now ? `On now, ends ${fmtShort(ev._e)}` : `In ${minutesBetween(now, ev._s)} min`;
  });
}

/* The sticky filters park directly under the header, whose height changes
   with the clock and the freshness line - measure it rather than guess. */
function syncHeaderHeight() {
  const h = document.querySelector(".hdr");
  if (h) document.documentElement.style.setProperty("--hdr-h", `${Math.round(h.getBoundingClientRect().height)}px`);
  fitHeaderLine();
}

/* ==================================================================
   Offline. The service worker keeps the app openable with no signal;
   this end only has to handle being told the schedule moved on.
   ================================================================== */
/* Installing is the point for someone who arrived from a chat link: the
   app works with no signal only once it is on the home screen. So the Now
   tab opens with a nudge until the app is installed, dismissible for a week
   at a time. No user-agent sniffing: one honest iOS message covers Safari
   and the in-app browsers, and Android gets the real install prompt when
   the browser offers one. */
const NUDGE_SNOOZE_MS = 7 * 24 * 3600 * 1000;
let installPrompt = null;
function nudgeVisible() {
  if (isStandalone()) return false;
  const until = loadJSON("dc26.nudgeSnoozedUntil", 0);
  return !(until && now().getTime() < until);
}
function nudgeCopy(ios, canPrompt) {
  if (ios) return {
    lead: "Add this to your home screen.",
    body: "In Safari: Share, then Add to Home Screen. If you opened this from a chat, tap the menu (the dots or the compass) and choose Open in Safari first. Once installed it works with no signal.",
    install: false,
  };
  if (canPrompt) return {lead: "Install this app.", body: "It opens like an app and works with no signal.", install: true};
  return {lead: "Add this to your home screen.", body: "From the menu (the three dots): Install app, or Add to Home screen. Once installed it works with no signal.", install: false};
}
function nudgeHTML() {
  if (!nudgeVisible()) return "";
  const c = nudgeCopy(IS_IOS, !!installPrompt);
  return `<div class="notice nudge" id="nudge"><b>${esc(c.lead)}</b> ${esc(c.body)}
    <div class="btns">${c.install ? `<button class="btn" data-act="nudge-install">Install app</button>` : ""}<button class="btn quiet" data-act="nudge-later">Not now</button></div></div>`;
}

/* main scrolls and bounces on its own; the page around it never scrolls,
   yet iOS will still rubber-band it when a drag lands on the header or the
   nav. Safari ignores overscroll-behavior for the page itself, so refuse
   those drags by hand. Touches that begin inside main, in the sheet, or on
   a control are left alone, and so is anything more sideways than vertical. */
const edgeTouch = {x: 0, y: 0, ignore: false};
function edgeTouchStart(e) {
  const t = e.touches && e.touches[0];
  if (!t) return;
  edgeTouch.x = t.clientX; edgeTouch.y = t.clientY;
  edgeTouch.ignore = !!(e.target && e.target.closest && e.target.closest("main, #sheetWrap, input, select, textarea"));
}
function edgeTouchMove(e) {
  if (edgeTouch.ignore || !e.touches || e.touches.length !== 1) return;
  const t = e.touches[0], dy = t.clientY - edgeTouch.y, dx = t.clientX - edgeTouch.x;
  if (Math.abs(dx) > Math.abs(dy)) return;
  const el = document.scrollingElement || document.documentElement;
  const atTop = el.scrollTop <= 0;
  const atBottom = el.scrollTop + window.innerHeight >= el.scrollHeight - 1;
  if ((dy > 0 && atTop) || (dy < 0 && atBottom)) e.preventDefault();
}

const updatePill = document.getElementById("updatePill");

function showUpdatePill() {
  /* Never re-render underneath someone mid-scroll: a schedule refresh that
     reshuffles rows while a thumb is moving costs them their place. Offer
     the reload, let them take it. */
  updatePill.classList.remove("settling");
  updatePill.style.transform = "";
  updatePill.style.opacity = "";
  updatePill.hidden = false;
}
function hideUpdatePill() {
  updatePill.hidden = true;
  updatePill.classList.remove("settling");
  updatePill.style.transform = "";
  updatePill.style.opacity = "";
}
/* Named so the smoke test can observe the intent; jsdom won't let
   location.reload be replaced. boot() takes a reload option for the same
   reason, and this is the one place it is called. */
let reload = () => location.reload();
function reloadNow() { reload(); }

/* Swipe it away if you'd rather keep reading. */
let pillY = null, pillDx = 0, pillDragged = false;

/* Coming back to the app after a while: check the schedule once, quietly.
   The service worker does the checking when there is one - a fetch of
   the schedule is served from cache and revalidated behind it, and the
   worker says if generated_at moved, which shows the pill above. Without
   a worker the fetch is real and we compare ourselves. Nothing re-renders
   under the reader either way; the pill offers the reload. Timers stop in
   the background too, so the freshness text is brought up to date first. */
const RECHECK_MS = 15 * 60000;
let lastScheduleCheck = 0;                   // boot() sets it: loading was a check
async function recheckSchedule() {
  updateFresh();
  if (now().getTime() - lastScheduleCheck < RECHECK_MS) return false;
  lastScheduleCheck = now().getTime();
  try {
    const r = await fetch(DATA_URL, {cache: "no-cache"});
    const viaWorker = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
    if (!viaWorker && r && r.ok) {
      const data = await r.json();
      if (data.generated_at && data.generated_at !== meta.generated_at) {
        meta.generated_at = data.generated_at;
        updateFresh();
        showUpdatePill();
      }
    }
  } catch (e) { /* no signal: nothing to say, the copy on screen stands */ }
  return true;
}

/* ==================================================================
   Boot. Everything above is declarations, and the consts that read storage
   and the DOM as the module is imported. Nothing else happens until boot()
   is called - once, by src/main.js - and then it happens in the order it
   always did: listeners on one element fire in the order they were added,
   so the statements below keep the file order they had when they ran as
   the script parsed.

   events: the schedule, already parsed. load() uses it instead of fetching,
   and still reaches the first render() with no await on the way.
   reload: what reloadNow() calls, for a caller that cannot replace
   location.reload. The option names are the contract; the locals are
   renamed because events and reload are the module's own names too.

   The handle is state and operations, never internals. ready is load()'s
   promise.
   ================================================================== */
export function boot({events: data, reload: reloadWith} = {}) {
  if (reloadWith) reload = reloadWith;

  document.documentElement.classList.toggle("bigtext", !!loadJSON("dc26.bigtext", false));
  document.body.insertAdjacentHTML("beforeend", devMarkHTML());
  initTimeOverride();

  scroller.addEventListener("scroll", () => {
    if (spyQueued) return;
    spyQueued = true;
    requestAnimationFrame(() => {
      spyQueued = false;
      if (performance.now() < spyHoldUntil) return;
      syncActiveSection();
    });
  }, {passive: true});

  document.querySelector(".nav").addEventListener("click", e => {
    const b = e.target.closest("button[data-tab]"); if (!b) return;
    state.tab = b.dataset.tab; render(); pageScrollTo(0);
  });

  document.querySelector("main").addEventListener("click", e => {
    const chip = e.target.closest("[data-chip]");
    if (chip) {
      const {chip: kind, value} = chip.dataset;
      if (kind === "now-hotel") { state.now.hotel = value; state.now.limit = 80; }
      else if (kind === "day") state.browse.day = value;
      else if (kind === "hotel") state.browse.hotel = state.browse.hotel === value ? "All" : value;
      else if (kind === "type") state.browse.type = value;
      else if (kind === "kind") state.browse.kind = value;
      else if (kind === "map-day") state.map.day = value;
      state.browse.page = 1; render();
      revealChip(document.querySelector(`.chips [data-chip="${kind}"][data-value="${cssEsc(value)}"]`));
      return;
    }
    const mapHotel = e.target.closest(".map-hotel, .map-pill");
    if (mapHotel) { openSheet("hotel", mapHotel.dataset.hotel); return; }
    const act = e.target.closest("[data-act]");
    if (act) {
      const a = act.dataset.act;
      if (a === "more-now") { state.now.limit += 100; render(); }
      if (a === "more-browse") { state.browse.page++; render(); }
      if (a === "ics") exportICS();
      if (a === "clear" && confirm("Remove everything from my schedule?")) { picks = new Set(); savePicks(); render(); }
      if (a === "suggest") {
        state.browse.q = `"${act.dataset.name}"`;
        state.browse.page = 1;
        if (state.browse.day !== "All") { state.browse.prevDay = state.browse.day; state.browse.day = "All"; }
        render();
        return;
      }
      if (a === "unsuggest") {
        state.browse.q = "";
        if (state.browse.prevDay) { state.browse.day = state.browse.prevDay; state.browse.prevDay = null; }
        state.browse.page = 1;
        render();
        return;
      }
      if (a === "toggle-past") { state.browse.showPast = !state.browse.showPast; render(); return; }
      if (a === "dismiss-news") { pickNews = []; savePickNews(); render(); return; }
      if (a === "dismiss-archive") { saveJSON(ARCHIVE_NOTICE_KEY, CON.year); render(); return; }
      if (a === "nudge-later") { saveJSON("dc26.nudgeSnoozedUntil", now().getTime() + NUDGE_SNOOZE_MS); render(); return; }
      if (a === "nudge-install") {
        if (installPrompt) { const p = installPrompt; installPrompt = null; p.prompt(); }
        return;
      }
      if (a === "explore-back") { closeExplorePage(); return; }
      if (a === "fol-add") { scrollToGrid(); return; }
      if (a === "explore-jump") {
        markActiveSection(act.dataset.section);
        spyHoldUntil = performance.now() + 700;
        scrollToExploreSection(act.dataset.section);
        return;
      }
      if (a === "explore-all") { state.explore.expanded[act.dataset.section] = true; renderExploreSections(); return; }
      if (a === "fol-toggle") {
        state.following.open = state.following.open === false;
        saveJSON("dc26.followingOpen", state.following.open);
        render();
        return;
      }
      if (a === "unfollow") {
        const raw = act.dataset.follow || "", i = raw.indexOf(":");
        if (i > 0) { toggleFollow(raw.slice(0, i), raw.slice(i + 1)); render(); }
        return;
      }
      if (a === "fol-interest" || a === "fol-time") {
        state.following.layout = a === "fol-time" ? "time" : "interest";
        saveJSON("dc26.followingLayout", state.following.layout);
        render();
        return;
      }
      if (a === "fol-more") { state.following.expanded[act.dataset.follow] = true; render(); return; }
      if (a === "fol-past") {
        const k = act.dataset.follow;
        state.following.showPast[k] = !state.following.showPast[k];
        render();
        return;
      }
      if (a === "explore-past") { state.explore.showPast = !state.explore.showPast; render(); return; }
      if (a === "toggle-follow") {
        const pg = state.explore.page;
        if (pg) { toggleFollow(pg.kind, pg.key); render(); }
        return;
      }
      if (a === "show-hidden") { state.browse.showHidden = true; state.browse.page = 1; render(); return; }
      if (a === "unparse-today") { state.browse.noToday = true; state.browse.page = 1; render(); return; }
      if (a === "unparse") {
        const stripped = stripPhrase(tokenise(state.browse.q), act.dataset.src || "");
        state.browse.q = (stripped || tokenise(state.browse.q)).join(" ");
        state.browse.page = 1;
        render();
        return;
      }
      if (a === "view-timeline" || a === "view-list") {
        state.mineView = a === "view-timeline" ? "timeline" : "list";
        saveJSON("dc26.mineView", state.mineView); render();
      }
      return;
    }
    const star = e.target.closest(".star");
    if (star) { const li = star.closest(".row"); togglePick(li.dataset.id, li); return; }
    const tile = e.target.closest("[data-explore]");
    if (tile) {
      const raw = tile.dataset.explore, i = raw.indexOf(":");
      if (i > 0) openExplorePage(raw.slice(0, i), raw.slice(i + 1));
      return;
    }
    const hero = e.target.closest("[data-hero]");
    if (hero) { openSheet("event", hero.dataset.hero); return; }
    const main = e.target.closest(".row-main");
    if (main) openSheet("event", main.closest(".row").dataset.id);
  });

  document.querySelector("main").addEventListener("input", e => {
    if (e.target.id === "exploreQ") { state.explore.q = e.target.value; renderExploreSections(); return; }
    if (e.target.id === "q") {
      const was = state.browse.q.trim(), now = e.target.value;
      state.browse.q = now;
      /* Both are answers to the last question, not standing preferences. */
      state.browse.showHidden = false;
      state.browse.showPast = false;
      state.browse.noToday = false;
      if (!was && now.trim()) { state.browse.prevDay = state.browse.day; state.browse.day = "All"; }
      else if (was && !now.trim() && state.browse.prevDay) { state.browse.day = state.browse.prevDay; state.browse.prevDay = null; }
      state.browse.page = 1;
      /* Rebuilding Browse costs ~120KB of HTML and 2,000 nodes. Doing that on
         every keystroke makes typing lag on a phone; the query itself is already
         recorded, so only the drawing waits. Before the index exists a query
         cannot run at all: hold it, and indexReady() queues it. */
      if (index || !now.trim()) queueBrowseRender(); else pendingQuery = true;
    }
  });
  /* The keyboard's return key reads Search and puts the keyboard away. */
  document.querySelector("main").addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target && e.target.id === "q") { e.preventDefault(); e.target.blur(); }
    const block = (e.key === "Enter" || e.key === " ") && e.target && e.target.closest && e.target.closest(".map-hotel");
    if (block) { e.preventDefault(); openSheet("hotel", block.dataset.hotel); }
  });
  document.querySelector("main").addEventListener("change", e => {
    if (e.target.id === "track") { state.browse.track = e.target.value; state.browse.page = 1; render(); }
    if (e.target.id === "fandom") { state.browse.fandom = e.target.value; state.browse.page = 1; render(); }
    if (e.target.id === "hideNoise") { state.browse.hideNoise = e.target.checked; state.browse.page = 1; render(); }
  });

  sheetEl.addEventListener("touchstart", e => {
    if (e.target.closest(".ev-body")) return;   // let the description scroll
    dragY = e.touches[0].clientY;
    dragT = performance.now();
    dragDy = 0;
    sheetEl.classList.remove("settling");
    sheetBackEl.classList.add("dragging");
  }, {passive: true});

  sheetEl.addEventListener("touchmove", e => {
    if (dragY === null) return;
    const dy = e.touches[0].clientY - dragY;
    setDrag(dy > 0 ? dy : dy / 4);              // slight resistance upward
  }, {passive: true});

  sheetEl.addEventListener("touchend", () => {
    if (dragY === null) return;
    const dy = dragDy, ms = performance.now() - dragT;
    dragY = null;
    /* Below about one frame we have no reliable velocity, so don't invent one -
       fall back to distance alone rather than treating a 30px nudge as a flick. */
    const v = ms >= 16 ? dy / ms : 0;
    const flicked = dy > 40 && v > 0.6;
    settle(dy > 70 || flicked);
  });

  sheetEl.addEventListener("touchcancel", () => { if (dragY !== null) { dragY = null; settle(false); } });

  panelEvent.addEventListener("click", e => {
    const seeAll = e.target.closest("[data-explore]");
    if (seeAll) {
      const raw = seeAll.dataset.explore, i = raw.indexOf(":");
      closeSheet();
      if (i > 0) openExplorePage(raw.slice(0, i), raw.slice(i + 1));
      return;
    }
    if (e.target.closest("#closeSheetEvent")) { closeSheet(); return; }
    const ev = byId.get(state.sheetId);
    if (!ev) return;
    if (e.target.closest("#sheetICS")) { exportEventICS(ev); return; }
    if (e.target.closest("#sheetStar")) {
      if (picks.has(ev.id)) picks.delete(ev.id); else picks.add(ev.id);
      savePicks();
      panelEvent.innerHTML = eventSheetHTML(ev);
    }
  });

  /* The hotel sheet: its rows work like rows anywhere, and an empty hotel
     offers the search that would fill it. */
  panelHotel.addEventListener("click", e => {
    const search = e.target.closest('[data-act="map-search"]');
    if (search) {
      const {hotel, day} = search.dataset;
      Object.assign(state.browse, {q: "", day, prevDay: null, hotel, page: 1, showHidden: false, showPast: false, noToday: false});
      state.tab = "browse";
      closeSheet();
      pageScrollTo(0);
      return;
    }
    if (e.target.closest("#closeSheetHotel")) { closeSheet(); return; }
    if (!state.sheetHotel) return;
    const star = e.target.closest(".star");
    if (star) {
      togglePick(star.closest(".row").dataset.id);
      panelHotel.innerHTML = hotelSheetHTML(state.sheetHotel, mapDay());
      return;
    }
    const main = e.target.closest(".row-main");
    if (main) openSheet("event", main.closest(".row").dataset.id);
  });

  document.getElementById("minibar").addEventListener("click", () => { state.tab = "now"; render(); pageScrollTo(0); });
  document.getElementById("settingsBtn").addEventListener("click", () => openSheet("settings"));
  document.getElementById("closeSheet").addEventListener("click", closeSheet);
  document.getElementById("sheetBack").addEventListener("click", closeSheet);
  document.getElementById("crowd").addEventListener("input", e => { settings.crowd = parseFloat(e.target.value); document.getElementById("crowdLabel").textContent = `${settings.crowd.toFixed(1)}x`; saveJSON("dc26.settings", settings); });
  document.getElementById("noiseDefault").addEventListener("change", e => { settings.hideNoise = e.target.checked; state.browse.hideNoise = settings.hideNoise; saveJSON("dc26.settings", settings); });
  /* Its own key, so nothing that resets settings ever shrinks someone's text.
     The header is re-measured because its line just changed height. */
  document.getElementById("bigText").addEventListener("change", e => {
    document.documentElement.classList.toggle("bigtext", e.target.checked);
    saveJSON("dc26.bigtext", e.target.checked);
    syncHeaderHeight();
    render();                    // the timeline re-measures its blocks at the new size
  });
  document.getElementById("applyPreview").addEventListener("click", () => { const v = document.getElementById("previewTime").value; closeSheet(); if (v) setTimeOverride(v); });
  document.getElementById("clearPreview").addEventListener("click", () => { closeSheet(); setTimeOverride(null); });
  document.getElementById("simChip").addEventListener("click", () => setTimeOverride(null));
  document.getElementById("resetPicks").addEventListener("click", () => { if (confirm("Remove everything from my schedule?")) { picks = new Set(); savePicks(); closeSheet(); } });

  window.addEventListener("hashchange", () => { applyExploreHash(); render(); });

  setInterval(() => {
    updateClock();
    renderNotice();              // the con can end on a tick
    if (state.tab === "now" && sheetWrap.hidden) tickNow();
    else if (state.tab === "map" && sheetWrap.hidden) { tickMap(); renderMiniBar(); }
    else renderMiniBar();
    updateFresh();
  }, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });

  /* Measure at the moments the header is known to change, not only through an
     observer: ResizeObserver is delivered on the rendering lifecycle, so a page
     that isn't painting - a background tab, a hidden view - never hears about
     it. The first measurement also lands before the freshness line has any
     text, which is 17px short. */
  requestAnimationFrame(syncHeaderHeight);
  window.addEventListener("resize", syncHeaderHeight);
  window.addEventListener("orientationchange", syncHeaderHeight);
  window.addEventListener("load", syncHeaderHeight);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncHeaderHeight).catch(() => {});
  if (window.ResizeObserver) {
    const hdr = document.querySelector(".hdr");
    if (hdr) new ResizeObserver(syncHeaderHeight).observe(hdr);
  }

  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installPrompt = e; if (state.tab === "now") render(); });
  window.addEventListener("appinstalled", () => { installPrompt = null; render(); });

  if (IS_IOS) {
    document.addEventListener("touchstart", edgeTouchStart, {passive: true});
    document.addEventListener("touchmove", edgeTouchMove, {passive: false});
    /* iOS 26 hands a home-screen web app a bottom inset of about 90px, nearly
       three times the home indicator, and draws nothing in the difference. Take
       the indicator's height and no more; Android's insets are real and stay. */
    document.documentElement.style.setProperty("--safe-bottom", "min(env(safe-area-inset-bottom, 0px), 34px)");
  }

  updatePill.addEventListener("click", () => { if (!pillDragged) reloadNow(); });

  updatePill.addEventListener("touchstart", e => {
    pillY = e.touches[0].clientX; pillDx = 0; pillDragged = false;
    updatePill.classList.remove("settling");
  }, {passive: true});
  updatePill.addEventListener("touchmove", e => {
    if (pillY === null) return;
    pillDx = e.touches[0].clientX - pillY;
    if (Math.abs(pillDx) > 6) pillDragged = true;
    updatePill.style.transform = `translateX(calc(-50% + ${pillDx}px))`;
    updatePill.style.opacity = String(Math.max(0, 1 - Math.abs(pillDx) / 160));
  }, {passive: true});
  updatePill.addEventListener("touchend", () => {
    if (pillY === null) return;
    const dx = pillDx; pillY = null;
    updatePill.classList.add("settling");
    if (Math.abs(dx) > 60) { updatePill.style.opacity = "0"; setTimeout(hideUpdatePill, 200); }
    else { updatePill.style.transform = "translateX(-50%)"; updatePill.style.opacity = "1"; }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", e => {
      const t = e.data && e.data.type;
      if (t === "schedule-updated") {
        /* The worker hands over the new generated_at; the header can say how
           fresh the waiting copy is while the pill offers it. */
        if (e.data.generated_at) { meta.generated_at = e.data.generated_at; updateFresh(); }
        showUpdatePill();
      }
      /* The worker serves the cached schedule and then checks the network. Its
         verdict arrives after the page has already rendered, so the freshness
         line is corrected in place rather than guessed at load. */
      if (t === "schedule-offline") { servedOffline = true; updateFresh(); }
      if (t === "schedule-online") { servedOffline = false; updateFresh(); }
    });
    window.addEventListener("load", () => {
      /* Don't swallow this. A worker that silently fails to register looks
         exactly like one that works until you turn the signal off. */
      navigator.serviceWorker.register("./sw.js").catch(err => {
        console.warn("Offline support unavailable:", err && err.message || err);
      });
    });
  }

  lastScheduleCheck = now().getTime();     // loading was a check

  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") recheckSchedule(); });
  window.addEventListener("pageshow", () => { recheckSchedule(); });

  const ready = load(data);
  return {
    state, render, now, setTimeOverride,
    picks: {get: () => picks, set: ids => { picks = new Set(ids); savePicks(); }},
    follows: {get: () => follows, set: list => { follows = [...list]; saveFollows(); }},
    news: {set: list => { pickNews = list; savePickNews(); }, clear: () => { pickNews = []; savePickNews(); }},
    get meta() { return meta; },
    get events() { return events; },
    BOOT, reconcilePicks, recheckSchedule, openSheet, closeSheet, ready,
  };
}

/* What is left of the test surface: the functions and consts still in this
   file that a test reaches by name - through the merged namespace the page
   helper builds (tests/helpers/page.js), or a unit test's import. A name
   leaves this list in the commit that moves it to a module of its own, which
   exports it from there. The lets are not here - a test reaches those
   through boot()'s handle - and nor is reloadNow, which the reload option
   replaces. */
export {
  activeFilters, browseResults, cleanRoom, closeSheet, conDayKey, conPhase, currentLocation,
  edgeTouchMove, edgeTouchStart, eventsFor, expandQuery, hiddenForQueryHTML, hideUpdatePill,
  indexReady, initTimeOverride, isFollowing, layoutColumns, leaveInfo, mapCardHTML, mapDay,
  markActiveSection, now, nowModel, nowSignature, nudgeCopy, openExplorePage, openSheet,
  pageScrollBy, pageScrollTo, parseQuery, pickActiveSection, placeHTML, queueBrowseRender,
  readExploreHash, recheckSchedule, reconcilePicks, render, renderBrowse, renderExplore,
  renderMap, renderMiniBar, renderNotice, renderNow, revealChip, saveFollows, savePickNews,
  savePicks, setDrag, setExploreHash, setTimeOverride, showUpdatePill, suggestionsFor,
  termQuality, tickMap, tickNow, toggleFollow, togglePick, updateClock, updateFresh, walkMin,

  BOOT, CON, CON_DAYS, conEnded, DAY_LONG, EXPLORE_HEAD, FOLLOW_KINDS, followId, getCatalogue,
  hotelGroup, hotelMatches, hotelPhrase, hotelShort, HOUR_PX, isCeleb, isNoise, isSimulated,
  LEAVE_BUFFER_MIN, MAP_HOTELS, NOISE_TRACKS, pageScrollTop, samePlace, SEARCH_DEBOUNCE_MS,
  SEARCH_PLACEHOLDER, settings, state, STOPWORDS, TIME_OVERRIDE_KEY, WALK,
};
