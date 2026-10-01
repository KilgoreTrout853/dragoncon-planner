import { YEAR } from "./season.js";
import { fmtShort } from "./util.js";
import { CON_DAYS, DAY_LABEL, DAY_LONG } from "./time.js";
import { placeShort } from "./venues.js";

/* ==================================================================
   Share a day (W25; DECISIONS #10, #50, #69): a day of the reader's picks
   as a link that needs no backend, and the message that carries it. Pure:
   the schedule, the picks, the day and the address are the caller's - the
   share panel and the shared day are sheet.js's - and nothing here reads
   the page, storage or the clock.

   The link is the page's own address with one query, and it lives on in
   people's messages, so its shape is a contract (#69):
     ?day=<year>.<day>.<token>-<token>-...
   <day> the con day's three letters, lower case - "sat" - and each token
   the last eight characters of an event's id, or the whole id where its
   eight are not unique in the year's schedule. An id may hold a "." (#43's
   <source_id>.<n>), so the tokens are joined by "-", which no id holds, no
   query encodes and no chat app formats. A token is resolved across the
   year, not the day: an event that moved to another day is still found.
   ================================================================== */
const TAIL = 8;
const MESSAGE_CAP = 1800;          // Discord refuses a message over 2,000
const LINK_CAP = 16384;            // past this a link is not read: about 1,800 picks
/* What an id may hold to travel in a link as it is: nothing a query would
   encode and no "-". Every id of a year's schedule is held to it by a test. */
const linkSafe = id => /^[0-9A-Za-z.]+$/.test(String(id));
const dayCode = day => (DAY_LABEL[day] || "").toLowerCase();
const tailOf = id => String(id).slice(-TAIL);

/* The picks a day shares: the reader's on that con day, in the schedule's
   order - start order - less what is removed or cancelled. */
function sharedPicks(schedule, picked, day) {
  return schedule.filter(e => picked.has(e.id) && e._cd === day && !e.removed && !e.cancelled);
}
/* The con days that hold one, in order. */
function shareableDays(schedule, picked) {
  const held = new Set(schedule.filter(e => picked.has(e.id) && !e.removed && !e.cancelled).map(e => e._cd));
  return CON_DAYS.filter(d => held.has(d));
}
/* The day the share panel opens on: today if it holds a pick, else the next
   day that does, else the first. */
function defaultShareDay(days, today) {
  return days.includes(today) ? today : days.find(d => d > today) || days[0] || null;
}

/* The events whose ids end with a token, found by the last eight characters
   of each: an index of the schedule, built once a call. */
function tailIndex(schedule) {
  const index = new Map();
  for (const e of schedule) {
    const tail = tailOf(e.id);
    if (!index.has(tail)) index.set(tail, []);
    index.get(tail).push(e);
  }
  return index;
}
/* A token's one event, or null for none or more than one. A token is at
   least eight characters: a shorter one is a tail cut short, whose ending is
   another event's. */
function resolveToken(token, index) {
  if (token.length < TAIL || !linkSafe(token)) return null;
  const found = (index.get(token.slice(-TAIL)) || []).filter(e => String(e.id).endsWith(token));
  return found.length === 1 ? found[0] : null;
}

/* The link for a day's picks, on the page's own address - `base`, the
   sharer's - with only this query: their ?now= and hash stay behind, as an
   invite's do. An id that cannot travel is left out. */
function dayLink(base, day, list, schedule) {
  const index = tailIndex(schedule);
  const tokens = list.filter(e => linkSafe(e.id)).map(e => {
    const tail = tailOf(e.id);
    return resolveToken(tail, index) === e ? tail : String(e.id);
  });
  return new URL(`?day=${YEAR}.${dayCode(day)}.${tokens.join("-")}`, base).href;
}

/* The message: plain text that stands on its own, then the link. A line a
   pick, its start, its title and its place as the Map's On now line names it.
   Over the cap, lines go from the end and one says how many; the link always
   carries every pick. */
function dayMessage(day, list, link) {
  const head = `My ${DAY_LONG[day] || day} at Dragon Con:`;
  const lines = list.map(e => `${fmtShort(e._s)}  ${String(e.title).replace(/\s+/g, " ").trim()} (${placeShort(e)})`);
  const text = shown => [head, ...lines.slice(0, shown), ...(shown < lines.length ? [`+${lines.length - shown} more in the link`] : []), link].join("\n");
  let shown = lines.length;
  while (shown > 0 && text(shown).length > MESSAGE_CAP) shown--;
  return text(shown);
}

/* A shared day from what the reader holds: the last day= in a link, or in a
   message pasted whole, or the bare value. {year, day, tokens, cut} - the
   day its three letters; cut, whether the last token is shorter than a tail
   or empty, a link ending in "-": either way it was likely cut short as it
   was copied - or null for anything that is not one. Only the first two
   dots part the fields, so a token may hold a ".". Never throws. */
function parseDayLink(text) {
  let value = String(text == null ? "" : text).trim();
  if (value.length > LINK_CAP) return null;
  const inLink = [...value.matchAll(/[?&]day=([^&#\s]*)/g)].pop();
  if (inLink) {
    try { value = decodeURIComponent(inLink[1]); } catch (e) { return null; }
  }
  const found = /^(\d{4})\.([A-Za-z]{3})\.(.*)$/.exec(value);
  if (!found) return null;
  const parts = found[3].split("-"), tokens = parts.filter(Boolean);
  return tokens.length ? {year: Number(found[1]), day: found[2].toLowerCase(), tokens, cut: parts[parts.length - 1].length < TAIL} : null;
}
/* And resolved against this copy of the schedule: {error: "bad"} for a link
   that is not one, or names no con day of the year; {error: "other_year",
   year} for another year's; else {day, events, skipped, cut} - the events
   in start order, each once, how many tokens found none or more than one,
   and parseDayLink()'s cut. */
function readSharedDay(text, schedule) {
  const link = parseDayLink(text);
  if (!link) return {error: "bad"};
  if (link.year !== YEAR) return {error: "other_year", year: link.year};
  const day = CON_DAYS.find(d => dayCode(d) === link.day);
  if (!day) return {error: "bad"};
  const index = tailIndex(schedule), found = new Set();
  let skipped = 0;
  for (const token of link.tokens) {
    const ev = resolveToken(token, index);
    if (ev) found.add(ev.id); else skipped++;
  }
  return {day, events: schedule.filter(e => found.has(e.id)), skipped, cut: link.cut};
}

export {
  linkSafe, sharedPicks, shareableDays, defaultShareDay, dayLink, dayMessage, parseDayLink, readSharedDay,
};
