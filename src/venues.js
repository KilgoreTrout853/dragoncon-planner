/* The venues: which hotels there are, what each is called on a chip, how they
   group, how long the walk between them is at con pace, and the slack added
   to every leave-by. All of it is the year's venues file,
   data/<year>/venues.json (DECISIONS #27, #45, #49), which the build resolves
   as virtual:venues and inlines like any import. The helpers beside it answer
   in the same terms: a room as it should read, a walk in minutes at the
   reader's crowd factor. */
import VENUES from "virtual:venues";
import { esc } from "./util.js";
import { settings } from "./state.js";

const HOTELS = [...VENUES.hotels].sort((a, b) => a.order - b.order);
const HOTEL_ORDER = HOTELS.map(h => h.hotel);
const HOTEL_VAR = Object.fromEntries(HOTELS.map(h => [h.hotel, h.var]));
const HOTEL_SHORT = Object.fromEntries(HOTELS.map(h => [h.hotel, h.short]));
/* Streaming and the offsite venues share one chip, their group Other. Neither
   is a con hotel, both wear the same grey, and together they are under 3% of
   the schedule. The data keeps them apart: a stream has no walk, an offsite
   venue does. */
const HOTEL_GROUP = Object.fromEntries(HOTELS.map(h => [h.hotel, h.group]));
/* Rough walking minutes between venues at con pace, keyed either way round;
   the same venue (room changes, elevators) and a pair the walk lacks have
   minutes of their own. */
const WALK = VENUES.walk;
const SAME_VENUE_MIN = VENUES.same_venue_min, UNKNOWN_PAIR_MIN = VENUES.unknown_pair_min;
/* The slack on every leave-by and in the tight band (#40): lifts, crowds, one
   wrong turn. The file calls it slack_min; the name here waits for Where
   things live. */
const LEAVE_BUFFER_MIN = VENUES.slack_min;

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
  if (a === b) return Math.round(SAME_VENUE_MIN * settings.crowd);
  const base = WALK[`${a}|${b}`] ?? WALK[`${b}|${a}`] ?? UNKNOWN_PAIR_MIN;
  return Math.round(base * settings.crowd);
}

const hotelShort = h => HOTEL_SHORT[h] || h;
const hotelVar = h => `--h-${HOTEL_VAR[h] || "Other"}`;
const hotelGroup = h => HOTEL_GROUP[h] || h;
/* A chip value is a venue or a group of them; "All" is everything. */
const hotelMatches = (e, v) => v === "All" || e.hotel === v || hotelGroup(e.hotel) === v;

/* "Search the Hyatt on Saturday": hotels take "the", the park does not. */
const hotelPhrase = h => h === "Hardy Ivy Park" ? h : `the ${hotelShort(h)}`;

export {
  HOTEL_ORDER, WALK, LEAVE_BUFFER_MIN, cleanRoom, placeHTML, walkMin, hotelShort, hotelVar,
  hotelGroup, hotelMatches, hotelPhrase,
};
