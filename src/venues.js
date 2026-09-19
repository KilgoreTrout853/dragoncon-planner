/* The venues: which hotels there are, what each is called on a chip, how they
   group, how long the walk between them is at con pace, and the slack added
   to every leave-by. These constants are what the venues file will hold
   (DECISIONS #27). The helpers beside them answer in the same terms: a room as
   it should read, a walk in minutes at the reader's crowd factor. */
import { esc } from "./util.js";
import { settings } from "./state.js";

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
