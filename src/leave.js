/* Where the reader is, as far as the app will say, and what that means for
   the next pick: a leave-by, a walk estimate, a gap too tight to make. The
   functions that need the moment take it as a parameter called now, so this
   module does not import now() - and must not: the parameter shadows it. */
import { minutesBetween } from "./util.js";
import { conDayKey } from "./time.js";
import { hotelPhrase, hotelShort, LEAVE_BUFFER_MIN, walkMin } from "./venues.js";
import { events } from "./data.js";
import { picks } from "./picks.js";

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

function nextPickInConDay(now) {
  const key = conDayKey(now);
  return events.find(e => picks.has(e.id) && e._s > now && conDayKey(e._s) === key) || null;
}

export { currentLocation, leaveInfo, gapHTML, nextPickInConDay };
