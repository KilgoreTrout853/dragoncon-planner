/* For you (W3; DECISIONS #87): a few events the reader has not starred that
   fit the gaps in their plan, each with the one thing that brought it. Two
   of the three parts are here - what scores and what is chosen - and the
   third, what is drawn, is explore.js's: nothing here is markup, and nothing
   reads the page, storage or the clock. The moment is a parameter, at.

   What scores is the signals, each its own small function: it takes an
   event and the reader's profile and adds what it found to the list it is
   handed - a thing, its weight, and whether it is a follow. A later way of
   guessing is one more of them. A thing is a follow's id, "kind:key": a
   track, a work, an axis value or a person.

   The index of the schedule - each event's things, and for each thing how
   rare it is and what the page calls it - is built once a schedule: it
   remembers the events it was made from, and replaceSchedule() makes new
   ones. A run makes little: a finding is made once a thing and shared by
   every event that carries it, and an event is weighed in one list used
   over again, since a phone runs this as the grid is drawn (#22). */
import { AXES, byId, events, isCeleb, linkedWorks, NOISE_TRACKS, personName, tagsOf, worksById } from "./data.js";
import { picks } from "./picks.js";
import { followId, follows, mutes } from "./follows.js";
import { connection } from "./walk.js";
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
const BIG_TRACK = "Main Programming";   // the track whose celebrity events are the big ones

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

/* An event's other sessions, for For you: its repeat key, or its title
   where it has none. Wider than sessionsOf(), which a sheet asks for the
   same line-up: here one session of anything is enough. */
const sessionKey = ev => (ev.facets || {}).repeat_key || `title:${ev.title}`;

/* The reader's profile (DECISIONS #32): what is followed, what is muted,
   and what the picks share - each thing enough picks carry, with how many,
   three at most. Never by stars: a person; a noise track; a work nobody has
   reviewed; an audience but Kids, the one that is a topic; a muted thing,
   which is never a reason; and a followed one, which the follow already
   says. With them, what a run reads of the index - each event's things,
   each thing's rarity and name - the findings made so far, a follow's and
   a pick's apart, and twins: what two of the things that weigh would both
   be called by a row, the track Space and the topic Space. And the picks
   that block: those happening, and not long ones, each with its two ends
   as numbers. */
function profile() {
  const {things, rare, name} = indexed();
  const followed = new Set(follows.map(followId)), muted = new Set(mutes.map(followId));
  const tally = new Map(), sessions = new Set(), blocking = [];
  picks.forEach(id => {
    const ev = byId.get(id);
    if (!ev) return;
    sessions.add(sessionKey(ev));
    const from = ev._s.getTime(), to = ev._e.getTime();
    if (!ev.cancelled && !ev.removed && to - from <= LONG_PICK_MIN * 60000) blocking.push({ev, from, to});
    /* A pick the source dropped is in byId and not in events, so not in the index. */
    for (const thing of things.get(id) || thingsOf(ev)) tally.set(thing, (tally.get(thing) || 0) + 1);
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
  const p = {things, rare, name, followed, muted, starred, sessions, blocking, made: [new Map(), new Map()], twins: new Set()};
  const said = new Set();
  for (const [follow, weighing] of [[true, followed], [false, starred.keys()]]) {
    for (const thing of weighing) { const says = saysOf(p, thing, follow); if (said.has(says)) p.twins.add(says); else said.add(says); }
  }
  return p;
}

/* What a row would say for a thing, less the name's markup: explore.js puts
   "You follow" or "Like your picks:" before the name. Two findings with
   one answer here read as one reason. */
const saysOf = (p, thing, follow) => `${follow ? "follow" : "stars"}:${p.name.get(thing) || keyOf(thing)}`;
/* A finding: a thing, a number of times its rarity, and whether it is a
   follow - with what a row would say for it, and whether another thing
   that weighs would be said the same. Made once a thing in a run, and
   shared by every event that carries the thing. */
function finding(p, thing, times, follow) {
  const says = saysOf(p, thing, follow), f = {thing, weight: times * (p.rare.get(thing) || 0), follow, says, twin: p.twins.has(says)};
  p.made[+follow].set(thing, f);
  return f;
}

/* The signals. Each adds what it found on an event to found. */
const SIGNALS = {
  /* A follow brings what Following lists for it, at three times its rarity. */
  follows(ev, p, found) {
    for (const thing of p.things.get(ev.id)) {
      if (p.followed.has(thing)) found.push(p.made[1].get(thing) || finding(p, thing, FOLLOW_WEIGHT, true));
    }
  },
  /* What the picks share: as many times its rarity as picks carry it. */
  stars(ev, p, found) {
    for (const thing of p.things.get(ev.id)) {
      const n = p.starred.get(thing);
      if (n) found.push(p.made[0].get(thing) || finding(p, thing, n, false));
    }
  },
};
const SIGNAL_LIST = Object.values(SIGNALS);

/* Of two findings, the heavier: by weight, then a follow, then the id. */
const heavier = (a, b) => a.weight > b.weight || (a.weight === b.weight && (a.follow > b.follow || (a.follow === b.follow && a.thing < b.thing)));
/* Of the things a row would name in the same words - the track Space and
   the topic Space - only the heavier counts: what reads as one reason
   weighs as one. */
const counts = (f, found) => !found.some(g => g !== f && g.says === f.says && heavier(g, f));

/* What all the signals found on an event, into the list handed in, and
   what it comes to: the sum of what counts. */
function weigh(ev, p, found) {
  found.length = 0;
  for (const signal of SIGNAL_LIST) signal(ev, p, found);
  let score = 0, twin = false;
  for (const f of found) { score += f.weight; twin = twin || f.twin; }
  if (!twin) return score;
  score = 0;
  for (const f of found) if (counts(f, found)) score += f.weight;
  return score;
}
/* And the same as a list of its own, heaviest first: the first is the
   reason. */
function foundOn(ev, p) {
  const found = [];
  weigh(ev, p, found);
  return found.sort((a, b) => heavier(a, b) ? -1 : 1);
}

/* Not a candidate, whatever it scores: a cancelled event; a photo op or a
   signing; one whose every track is a noise track; a session of a pick,
   and so a pick, which is one of its own; one that carries a muted thing,
   unless a follow brings it - a follow wins over a mute, and the fandoms
   under a muted fandom are muted with it, since an Andor event carries
   Star Wars; and one that overlaps a pick, where the pick is not a long
   one. An event that has started is passed over before it is scored.
   The overlap is walk.js connection()'s, the one computation of one (#64),
   asked as clashesOf() asks it - the earlier first, the longer where two
   start together - but only of the picks whose hours touch the event's:
   a reader with sixty picks is not asked sixty times a row. */
function barred(ev, found, p) {
  if (ev.cancelled || QUIET_KINDS.includes(tagsOf(ev).kind)) return true;
  const tracks = ev.tracks || [];
  if (tracks.length && tracks.every(t => NOISE_TRACKS.has(t))) return true;
  if (p.sessions.has(sessionKey(ev))) return true;
  if (p.muted.size && !found.some(f => f.follow) && p.things.get(ev.id).some(thing => p.muted.has(thing))) return true;
  const from = ev._s.getTime(), to = ev._e.getTime();
  for (const pick of p.blocking) {
    if (from > pick.to || pick.from > to) continue;
    const first = pick.from < from || (pick.from === from && pick.to > to);
    const c = first ? connection(pick.ev, ev) : connection(ev, pick.ev);
    if (c && c.band === "overlap") return true;
  }
  return false;
}

/* What is chosen, from the events that scored: best first, ties by start
   and then by id; at most two rows that say one reason; one session of
   anything; eight at most. Whether an event is barred, and what its reason
   is, are asked in this order and only until the list is full, so the plan
   is asked about the few at the top and not the schedule. */
function choose(ranked, p) {
  ranked.sort((a, b) => b.score - a.score || a.start - b.start || (a.ev.id < b.ev.id ? -1 : a.ev.id > b.ev.id ? 1 : 0));
  const chosen = [], said = new Map(), sessions = new Set();
  for (const {ev, score, start} of ranked) {
    if (chosen.length >= FOR_YOU_MAX) break;
    const session = sessionKey(ev);
    if (sessions.has(session)) continue;
    const found = foundOn(ev, p), says = found[0].says;
    if ((said.get(says) || 0) >= PER_REASON || barred(ev, found, p)) continue;
    said.set(says, (said.get(says) || 0) + 1);
    sessions.add(session);
    chosen.push({ev, score, start, reason: found[0]});
  }
  return chosen;
}

/* For you at a moment: the rows in time order, each {id, score, reason},
   the reason {kind, key, name, follow} - the one thing that weighed most.
   [] for a reader with no pick and no follow, and once nothing is left to
   start. */
function forYou(at) {
  if (!picks.size && !follows.length) return [];
  const p = profile(), ranked = [], found = [], moment = at.getTime();
  for (const ev of events) {
    const start = ev._s.getTime();
    if (start <= moment) continue;
    const score = weigh(ev, p, found);
    if (score > 0) ranked.push({ev, score, start});
  }
  return choose(ranked, p)
    .sort((a, b) => a.start - b.start || (a.ev.id < b.ev.id ? -1 : 1))
    .map(({ev, score, reason: f}) => ({id: ev.id, score, reason: {kind: kindOf(f.thing), key: keyOf(f.thing), name: p.name.get(f.thing), follow: f.follow}}));
}

/* The big ones (W16; DECISIONS #88), which stand where For you has no row:
   the celebrity events on Main Programming still to start at a moment,
   soonest first and then by id, as ids. Computed, never a list kept by
   hand. Out: a cancelled one; a photo op or a signing; one that carries a
   muted thing, as For you counts carrying - the fandoms under a muted
   fandom with it; and a second session of anything, by sessionKey() - a
   pick is a session already had, so a pick and its other sessions are out
   too. [] once nothing is left to start, and on a schedule with no such
   track. */
function bigOnes(at) {
  const moment = at.getTime(), {things} = indexed();
  const muted = new Set(mutes.map(followId)), sessions = new Set(), out = [];
  picks.forEach(id => { const ev = byId.get(id); if (ev) sessions.add(sessionKey(ev)); });
  const left = events.filter(ev => ev._s.getTime() > moment && !ev.cancelled && (ev.tracks || []).includes(BIG_TRACK) && isCeleb(ev)
    && !QUIET_KINDS.includes(tagsOf(ev).kind) && !things.get(ev.id).some(thing => muted.has(thing)));
  left.sort((a, b) => a._s - b._s || (a.id < b.id ? -1 : 1));
  for (const ev of left) {
    const session = sessionKey(ev);
    if (sessions.has(session)) continue;
    sessions.add(session);
    out.push(ev.id);
  }
  return out;
}

export { FOR_YOU_MAX, labelFor, rarity, profile, SIGNALS, forYou, BIG_TRACK, bigOnes };
