/* The walk between picks, and what it means for the plan: the walk estimate
   from the pick before, the tight-connection flag between two picks in a
   row - an overlap, a gap shorter than the walk, or one shorter than the walk
   and the slack (DECISIONS #40) - and every pick a pick overlaps across the
   plan (#73). Facts about the plan, never about the
   reader: nothing here says where anyone is, or when to leave. The function
   that needs the moment takes it as a parameter called now, so this module
   does not import now() - and must not: the parameter shadows it. */
import { minutesBetween } from "./util.js";
import { conDayKey } from "./time.js";
import { hotelPhrase, hotelShort, SLACK_MIN, walkMin } from "./venues.js";
import { byId, events } from "./data.js";
import { picks } from "./picks.js";

/* The pick before this one in the same con day, if any. */
function previousPick(next) {
  let prev = null;
  for (const e of events) {
    if (e._s >= next._s) break;
    if (picks.has(e.id) && e._cd === next._cd) prev = e;
  }
  return prev;
}

/* The walk estimate: from the pick before this one today, when that was in
   another building - the walk at the crowd factor with no slack, so it reads
   as an estimate ("~12 min from the Westin"), not an instruction. Null with
   no pick before it today, in the same building, or with a stream either
   side, which has no walk. */
function walkEstimate(next) {
  const prev = next ? previousPick(next) : null;
  const walk = prev && prev.hotel !== next.hotel ? walkMin(prev.hotel, next.hotel) : 0;
  if (!walk) return null;
  const where = prev.hotel === "Other" ? (prev.room || "offsite") : hotelPhrase(prev.hotel);
  return {walk, from: prev.hotel, label: `~${walk} min from ${where}`};
}

/* The tight-connection flag between two picks in a row (#40): the gap from
   the end of one to the start of the next, against the walk between them.
   An overlap is a band for any pair, a stream included: it is time, not
   walking, and it is the two picks' intersection, the earlier end less the
   later start, so a short pick inside a long one overlaps by its own
   length. This is the one computation of an overlap (#64). A pair with no
   walk - a stream either side - has no other band, and no connection:
   null. Otherwise the band is "cant", the gap under the walk; "tight",
   under the walk and the slack; or null. One building is walked at its own
   minutes, so a short gap inside it is flagged too. The hero, the gap line
   and overlapsOf() all read this, so the app holds one opinion about a
   pair. */
function connection(prev, next) {
  const walk = walkMin(prev.hotel, next.hotel), gap = minutesBetween(prev._e, next._s);
  if (next._s < prev._e) {
    return {walk, gap, band: "overlap", overlap: minutesBetween(Math.max(prev._s, next._s), Math.min(prev._e, next._e))};
  }
  if (!walk) return null;
  return {walk, gap, band: gap < walk ? "cant" : gap < walk + SLACK_MIN ? "tight" : null};
}

/* Every other pick a pick overlaps (W1; DECISIONS #73), in start order: over
   the whole plan, not the pick before, each pair asked of connection() with
   the earlier first - the longer first where two start together - so a row's
   flag and the hero hold one opinion. A cancelled or removed pick is not
   happening: it overlaps nothing and is in no other pick's list. [] for an
   event that is not a pick. */
function overlapsOf(ev) {
  if (!picks.has(ev.id) || ev.cancelled || ev.removed) return [];
  const out = [];
  for (const id of picks) {
    const p = byId.get(id);
    if (!p || id === ev.id || p.cancelled || p.removed) continue;
    const pFirst = p._s < ev._s || (+p._s === +ev._s && p._e > ev._e);
    const c = pFirst ? connection(p, ev) : connection(ev, p);
    if (c && c.band === "overlap") out.push(p);
  }
  return out.sort((a, b) => a._s - b._s || a.title.localeCompare(b.title));
}

/* The line between two rows: the pair's band in words, or nothing - nothing
   either for two picks more than four hours apart across a con day. */
function gapHTML(prev, next) {
  if (!prev || !next || prev._cd !== next._cd && minutesBetween(prev._e, next._s) > 240) return "";
  const c = connection(prev, next);
  if (!c || !c.band) return "";
  if (c.band === "overlap") return `<div class="gap overlap">Overlaps the one above by ${c.overlap} min</div>`;
  const move = prev.hotel !== next.hotel ? `${hotelShort(prev.hotel)} to ${hotelShort(next.hotel)}` : `same building`;
  if (c.band === "cant") return `<div class="gap tight">${c.gap} min to get there, ${move} is about ${c.walk} min at con pace</div>`;
  return `<div class="gap">${c.gap} min gap, ${move} about ${c.walk} min. Tight but doable</div>`;
}

function nextPickInConDay(now) {
  const key = conDayKey(now);
  return events.find(e => picks.has(e.id) && e._s > now && conDayKey(e._s) === key) || null;
}

export { walkEstimate, connection, overlapsOf, gapHTML, nextPickInConDay };
