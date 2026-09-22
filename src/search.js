/* Search: the vocabulary an event is indexed under, the two MiniSearch
   indexes, and the reading of a query - which words are filters, what is left
   to rank by, and the ranking. It reads state.browse and writes to it (the
   parsed query, the today scope), and stamps _hit and _section on the events
   it returns. Building the indexes in idle time is loading.js's, and drawing
   the results is browse.js's. */
import MiniSearch from "minisearch";
import { dayOf } from "./util.js";
import { state } from "./state.js";
import { conDayKey, conEnded, DAY_LONG, isPast, now } from "./time.js";
import { hotelMatches, hotelShort } from "./venues.js";
import { AXES, byId, events, isNoise, linkedWorks, linksTo, personName, worksById } from "./data.js";

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
/* The only place an axis slug becomes a label. Where v1 had a topic for the
   value, the label is that topic's name (docs/discover/schema-v2.md, From
   TOPICS to v2); audience has one value that is a topic of its own. */
const AXIS_LABELS = {
  medium: {tv: "TV", film: "Film", books: "Literature", comics: "Comics", animation: "Animation", anime: "Anime",
    music: "Music", "podcast-web": "Podcasting", "video-games": "Video Games", tabletop: "Tabletop"},
  genre: {fantasy: "Fantasy", "sci-fi": "Sci-Fi", horror: "Horror", comedy: "Comedy", superhero: "Superhero", romance: "Romance"},
  craft: {writing: "Writing", costuming: "Costuming", "props-making": "Props & Making", art: "Art",
    photography: "Cosplay Photography", puppetry: "Puppetry", performance: "Performance"},
  subject: {science: "Science", space: "Space", tech: "Tech", history: "History", politics: "Politics",
    skepticism: "Skepticism", paranormal: "Paranormal", fitness: "Fitness", food: "Food", community: "Community",
    "fandom-culture": "Fandom Culture"},
  audience: {kids: "Kids"},
};
/* "genre:horror" is "Horror"; a key with no label shows its value. */
function axisLabel(key) {
  const i = String(key).indexOf(":"), axis = key.slice(0, i), value = key.slice(i + 1);
  return (AXIS_LABELS[axis] || {})[value] || value;
}
/* The labels of an event's four axes, which is what v1 called its topics. */
const axisLabelsOf = e => AXES.flatMap(a => ((e.tags || {})[a] || []).map(v => axisLabel(`${a}:${v}`)));
/* The names of what an event is about, and of everything above it. */
const workNamesOf = e => [...linkedWorks(e)].map(id => (worksById.get(id) || {}).name).filter(Boolean);
let index = null;

const SEARCH_PLACEHOLDER = "Search titles, guests, fandoms, words";

const processTerm = (term) => {
  const t = term.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return t.length < 2 || STOPWORDS.has(t) ? null : t;
};
function aliasesFor(ev, text) {
  const out = [];
  for (const g of SYNONYMS) if (g.some(m => text.includes(m))) out.push(...g);
  return out.join(" ");
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
    const fandoms = workNamesOf(e).join(" "), topics = axisLabelsOf(e).join(" ");
    const kind = tg.kind ? `${tg.kind} ${KIND_LABELS[tg.kind] || ""}` : "";
    const text = [e.title, e.description, (e.tracks || []).join(" "), fandoms, topics, kind, e.location].join(" ").toLowerCase();
    /* The registry's other names for those works, beside the con's vocabulary. */
    const registry = [...linkedWorks(e)].flatMap(id => { const w = worksById.get(id); return w ? [...(w.aliases || []), ...(w.terms || [])] : []; });
    return {id: e.id, title: e.title, description: e.description || "", speakers: e._people || "", tracks: (e.tracks || []).join(" "),
      fandoms, kind, topics, aliases: [aliasesFor(e, text), ...registry].filter(Boolean).join(" "), location: e.location || ""};
  }));
}
/* A second, tiny index: one document per name, so we can suggest whole
   names rather than fragments of event text. */
let suggestIndex = null, suggestDocs = [];
function buildSuggestIndex() {
  /* Two counts per name. A celebrity's dozen entries are mostly photo
     sessions, which are hidden by default - a chip promising 12 that yields
     2 is worse than no number at all. */
  /* People are counted by id and shown by their display name; works and axis
     labels share one row, by name, as fandoms and topics did. */
  const people = new Map(), topics = new Map();
  const bump = (m, key, name, quiet) => {
    if (name.length <= 2) return;
    const c = m.get(key) || {name, all: 0, visible: 0};
    c.all++; if (!quiet) c.visible++;
    m.set(key, c);
  };
  events.forEach(e => {
    const quiet = isNoise(e);
    new Set((e.people || []).map(p => p.id)).forEach(id => bump(people, id, personName(id).trim(), quiet));
    /* Kids was one of v1's topics, so it is a chip here as it was, though
       audience is not an axis and stays out of the index's topics field. */
    const kids = (e.tags || {}).audience === "kids" ? [axisLabel("audience:kids")] : [];
    new Set([...workNamesOf(e), ...axisLabelsOf(e), ...kids]).forEach(t => bump(topics, t.trim(), t.trim(), quiet));
  });
  const doc = (group, prefix) => ([key, c]) => ({id: `${prefix}:${key}`, key, name: c.name, all: c.all, visible: c.visible, group});
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

function passesFilters(e) {
  const f = activeFilters(), tg = e.tags || {};
  return (f.day === "All" || e._cd === f.day) &&
    hotelMatches(e, f.hotel) &&
    (f.type === "All" || e.type === f.type) &&
    (f.track === "All" || (e.tracks || []).includes(f.track)) &&
    (f.work === "All" || linksTo(e, f.work)) &&
    (f.kind === "All" || tg.kind === f.kind) &&
    (!f.adultOnly || tg.audience === "mature") &&
    (!f.hideAdult || tg.audience !== "mature") &&
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
    work: b.work,
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

export {
  STOPWORDS, KIND_LABELS, AXIS_LABELS, axisLabel, index, SEARCH_PLACEHOLDER, processTerm, buildIndex, suggestDocs,
  buildSuggestIndex, suggestionsFor, expandQuery, tokenise, stripPhrase, parseQuery,
  activeFilters, termQuality, browseResults,
};
