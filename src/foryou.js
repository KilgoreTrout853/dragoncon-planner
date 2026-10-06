/* For you (W3; DECISIONS #87): a few events the reader has not starred that
   fit the gaps in their plan, each with the one thing that brought it. Two
   of the three parts are here - what scores and what is chosen - and the
   third, what is drawn, is explore.js's: nothing here is markup, and nothing
   reads the page, storage or the clock. The moment is a parameter, at.

   What scores is the signals, each its own small function: it takes an
   event and the reader's profile and gives back what it found - a thing,
   its weight, and whether it is a follow. A later way of guessing is one
   more of them. A thing is a follow's id, "kind:key": a track, a work, an
   axis value or a person.

   The index of the schedule - each event's things, and for each thing how
   many events carry it, how rare that makes it and what the page calls it -
   is built once a schedule: it remembers the events it was made from, and
   replaceSchedule() makes new ones. */
import { AXES, byId, events, linkedWorks, NOISE_TRACKS, personName, tagsOf, worksById } from "./data.js";
import { picks } from "./picks.js";
import { followId, follows, mutes } from "./follows.js";
import { clashesOf } from "./walk.js";
import { axisLabel } from "./search.js";

const FOR_YOU_MAX = 8;        // rows at most
const PER_REASON = 2;         // rows that say one reason, at most
const FOLLOW_WEIGHT = 3;      // a follow weighs this many times its thing's rarity
const STAR_CAP = 3;           // and a thing the picks share at most this many
/* How many picks must carry a thing before it counts by stars: a fandom
   from one, a track or a topic from two. A person is not here, and never
   counts by stars: the schedule cannot tell a moderator from a guest. */
const STAR_MIN = {work: 1, track: 2, axis: 2};
const LONG_PICK_MIN = 240;    // a pick longer than this blocks nothing: nobody sits a whole one
const QUIET_KINDS = ["photo", "signing"];

/* What a follow is called on screen: its key is an id. */
function labelFor(kind, key) {
  switch (kind) {
    case "work": return (worksById.get(key) || {}).name || key;
    case "axis": return axisLabel(key);
    case "person": return personName(key) || key;
    default: return key;
  }
}
const kindOf = thing => thing.slice(0, thing.indexOf(":"));
const keyOf = thing => thing.slice(thing.indexOf(":") + 1);

/* Everything an event carries, each once: its tracks, the works it is about
   with every work above them (linkedWorks()), its axis values and its
   audience, and its people. What eventsFor() lists for a follow is exactly
   the events that carry the follow's id. */
function thingsOf(ev) {
  const tg = tagsOf(ev), out = new Set();
  (ev.tracks || []).forEach(t => out.add(`track:${t}`));
  linkedWorks(ev).forEach(w => out.add(`work:${w}`));
  AXES.forEach(a => (tg[a] || []).forEach(v => out.add(`axis:${a}:${v}`)));
  if (tg.audience) out.add(`axis:audience:${tg.audience}`);
  (ev.people || []).forEach(p => out.add(`person:${p.id}`));
  return [...out];
}

let index = null;
function indexed() {
  if (index && index.of === events) return index;
  const things = new Map(), count = new Map();
  for (const ev of events) {
    const list = thingsOf(ev);
    things.set(ev.id, list);
    for (const thing of list) count.set(thing, (count.get(thing) || 0) + 1);
  }
  /* Rarity: the log of the schedule over the events that carry the thing,
     so Main Programming counts for less than a small track. */
  const rare = new Map(), name = new Map();
  for (const [thing, n] of count) {
    rare.set(thing, Math.log(events.length / n));
    name.set(thing, labelFor(kindOf(thing), keyOf(thing)));
  }
  index = {of: events, things, rare, name};
  return index;
}
const rarity = thing => indexed().rare.get(thing) || 0;
/* A pick the source dropped is in byId and not in events, so not in the index. */
const carried = ev => indexed().things.get(ev.id) || thingsOf(ev);

/* An event's other sessions, for For you: its repeat key, or its title
   where it has none. Wider than sessionsOf(), which a sheet asks for the
   same line-up: here one session of anything is enough. */
const sessionKey = ev => (ev.facets || {}).repeat_key || `title:${ev.title}`;

/* The reader's profile (DECISIONS #32): what is followed, what is muted,
   and what the picks share - each thing enough picks carry, with how many,
   three at most. Never by stars: a person; a noise track; a work nobody has
   reviewed; an audience but Kids, the one that is a topic; a muted thing,
   which is never a reason; and a followed one, which the follow already
   says. */
function profile() {
  const followed = new Set(follows.map(followId)), muted = new Set(mutes.map(followId));
  const tally = new Map(), sessions = new Set();
  picks.forEach(id => {
    const ev = byId.get(id);
    if (!ev) return;
    sessions.add(sessionKey(ev));
    for (const thing of carried(ev)) tally.set(thing, (tally.get(thing) || 0) + 1);
  });
  const starred = new Map();
  for (const [thing, n] of tally) {
    const kind = kindOf(thing), key = keyOf(thing);
    if (!(n >= STAR_MIN[kind]) || followed.has(thing) || muted.has(thing)) continue;
    if (kind === "track" && NOISE_TRACKS.has(key)) continue;
    if (kind === "work" && (worksById.get(key) || {}).reviewed !== true) continue;
    if (kind === "axis" && key.startsWith("audience:") && key !== "audience:kids") continue;
    starred.set(thing, Math.min(n, STAR_CAP));
  }
  return {followed, muted, starred, sessions};
}

/* The signals. NONE is what a signal gives back for most events, so that
   scoring the schedule makes a list only where something was found. */
const NONE = Object.freeze([]);
const SIGNALS = {
  /* A follow brings what Following lists for it, at three times its rarity. */
  follows(ev, p) {
    let out = NONE;
    for (const thing of carried(ev)) {
      if (!p.followed.has(thing)) continue;
      if (out === NONE) out = [];
      out.push({thing, weight: FOLLOW_WEIGHT * rarity(thing), follow: true});
    }
    return out;
  },
  /* What the picks share: as many times its rarity as picks carry it. */
  stars(ev, p) {
    let out = NONE;
    for (const thing of carried(ev)) {
      const n = p.starred.get(thing);
      if (!n) continue;
      if (out === NONE) out = [];
      out.push({thing, weight: n * rarity(thing), follow: false});
    }
    return out;
  },
};
const SIGNAL_LIST = Object.values(SIGNALS);

/* What a row would say for a finding, less the name's markup: explore.js
   puts "You follow" or "Like your picks:" before the name. Two findings
   with one answer here read as one reason. */
const saysOf = f => `${f.follow ? "follow" : "stars"}:${indexed().name.get(f.thing) || keyOf(f.thing)}`;
const heavier = (a, b) => a.weight > b.weight || (a.weight === b.weight && (a.follow > b.follow || (a.follow === b.follow && a.thing < b.thing)));

/* What all the signals found on an event, heaviest first, and of the
   things a row would name in the same words - the track Space and the
   topic Space - only the heavier: what reads as one reason weighs as one.
   The score is their sum and the reason the first. */
function foundOn(ev, p) {
  let found = NONE;
  for (const signal of SIGNAL_LIST) {
    const got = signal(ev, p);
    if (got !== NONE) found = found === NONE ? got : found.concat(got);
  }
  if (found.length < 2) return found;
  found.sort((a, b) => heavier(a, b) ? -1 : 1);
  const said = new Set();
  return found.filter(f => { const says = saysOf(f); return said.has(says) ? false : !!said.add(says); });
}

/* Not a candidate, whatever it scores: a cancelled event; a photo op or a
   signing; one whose every track is a noise track; another session of a
   pick; one that carries a muted thing, unless a follow brings it - a
   follow wins over a mute, and the fandoms under a muted fandom are muted
   with it, since an Andor event carries Star Wars; and one that overlaps a
   pick, where the pick is not a long one. A pick and an event that has
   started are passed over before they are scored. */
function barred(ev, found, p) {
  if (ev.cancelled || QUIET_KINDS.includes(tagsOf(ev).kind)) return true;
  const tracks = ev.tracks || [];
  if (tracks.length && tracks.every(t => NOISE_TRACKS.has(t))) return true;
  if (p.sessions.has(sessionKey(ev))) return true;
  if (p.muted.size && !found.some(f => f.follow) && carried(ev).some(thing => p.muted.has(thing))) return true;
  return clashesOf(ev).some(pick => pick._e - pick._s <= LONG_PICK_MIN * 60000);
}

/* What is chosen, from the events that scored: best first, ties by start
   and then by id; at most two rows that say one reason; one session of
   anything; eight at most. Whether an event is barred is asked in this
   order and only until the list is full, so the plan is asked about the few
   at the top and not the schedule. */
function choose(ranked, p) {
  ranked.sort((a, b) => b.score - a.score || a.ev._s - b.ev._s || (a.ev.id < b.ev.id ? -1 : a.ev.id > b.ev.id ? 1 : 0));
  const chosen = [], said = new Map(), sessions = new Set();
  for (const r of ranked) {
    if (chosen.length >= FOR_YOU_MAX) break;
    const says = saysOf(r.found[0]), session = sessionKey(r.ev);
    if ((said.get(says) || 0) >= PER_REASON || sessions.has(session) || barred(r.ev, r.found, p)) continue;
    said.set(says, (said.get(says) || 0) + 1);
    sessions.add(session);
    chosen.push(r);
  }
  return chosen;
}

/* For you at a moment: the rows in time order, each {id, score, reason},
   the reason {kind, key, name, follow} - the one thing that weighed most.
   [] for a reader with no pick and no follow, and once nothing is left to
   start. */
function forYou(at) {
  if (!picks.size && !follows.length) return [];
  const p = profile(), ranked = [];
  for (const ev of events) {
    if (ev._s <= at || picks.has(ev.id)) continue;
    const found = foundOn(ev, p);
    if (!found.length) continue;
    let score = 0;
    for (const f of found) score += f.weight;
    if (score > 0) ranked.push({ev, score, found});
  }
  return choose(ranked, p)
    .sort((a, b) => a.ev._s - b.ev._s || (a.ev.id < b.ev.id ? -1 : 1))
    .map(({ev, score, found: [f]}) => ({id: ev.id, score, reason: {kind: kindOf(f.thing), key: keyOf(f.thing), name: indexed().name.get(f.thing), follow: f.follow}}));
}

export { FOR_YOU_MAX, labelFor, rarity, profile, SIGNALS, forYou };
