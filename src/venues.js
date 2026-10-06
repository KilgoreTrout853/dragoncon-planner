/* The venues: which hotels there are, what each is called on a chip, how they
   group, how long the walk between them is at con pace, and the slack the
   tight band allows. All of it is the year's venues file,
   data/<year>/venues.json (DECISIONS #27, #45, #49), which the build resolves
   as virtual:venues and inlines like any import. The helpers beside it answer
   in the same terms: a room as it should read, a level by its short name or
   its full one, a hotel's levels, a walk in minutes at the reader's crowd
   factor. */
import VENUES from "virtual:venues";
import { esc } from "./util.js";
import { settings } from "./state.js";

const HOTELS = [...VENUES.hotels].sort((a, b) => a.order - b.order);
const HOTEL_ORDER = HOTELS.map(h => h.hotel);
const HOTEL_VAR = Object.fromEntries(HOTELS.map(h => [h.hotel, h.var]));
const HOTEL_SHORT = Object.fromEntries(HOTELS.map(h => [h.hotel, h.short]));
/* Whether a hotel's room is the rest of the location or the whole of it: the
   Mart's two buildings' is the whole, "Mart Building 3, Floor 1" (#45, #91). */
const HOTEL_DISPLAY = Object.fromEntries(HOTELS.map(h => [h.hotel, h.display]));
/* Streaming and the offsite venues share one chip, their group Other. Neither
   is a con hotel, both wear the same grey, and together they are under 3% of
   the schedule. The data keeps them apart: a stream has no walk, an offsite
   venue does. */
const HOTEL_GROUP = Object.fromEntries(HOTELS.map(h => [h.hotel, h.group]));
/* A group's colour is its first hotel's, in the file's order: the Mart is a
   group of two buildings and no hotel of that name, and its chip wears
   their hue (#91). */
const GROUP_VAR = Object.fromEntries([...HOTELS].reverse().map(h => [h.group, h.var]));
/* Rough walking minutes between venues at con pace, keyed either way round;
   the same venue (room changes, elevators) and a pair the walk lacks have
   minutes of their own. */
const WALK = VENUES.walk;
const SAME_VENUE_MIN = VENUES.same_venue_min, UNKNOWN_PAIR_MIN = VENUES.unknown_pair_min;
/* The slack in the tight band (#40): lifts, crowds, one wrong turn. A gap
   shorter than the walk and the slack is tight but doable. The file calls
   it slack_min. */
const SLACK_MIN = VENUES.slack_min;
/* Each hotel's levels by id, to their short names (#72). */
const LEVEL_SHORT = new Map(HOTELS.map(h => [h.hotel, new Map((h.levels || []).map(lv => [lv.id, lv.short]))]));
/* And to their full names, which an event's sheet says (#74). */
const LEVEL_NAME = new Map(HOTELS.map(h => [h.hotel, new Map((h.levels || []).map(lv => [lv.id, lv.name]))]));
/* And a hotel's levels themselves, as the file has them, in its order, each
   with its storey (#72): what the building's model stacks (building.js,
   #94). None for a hotel the file lacks. */
const hotelLevels = hotel => [...((HOTELS.find(h => h.hotel === hotel) || {}).levels || [])].sort((a, b) => a.order - b.order);

/* The source marks offsite venues with a leading "O ": "O Joystick Gamebar".
   The scraper now drops it; this covers data scraped before it did. */
function cleanRoom(hotel, room) {
  return hotel === "Other" ? String(room || "").replace(/^O\s+/, "") : room;
}
/* "Hilton · 313-314": the hotel first, so a line reads where before which
   room. A hotel whose room is the whole location - its display "location",
   the Mart's buildings - is its room alone, "Mart Building 3, Floor 1",
   which names the hotel already (DECISIONS #73). A stream is "Streaming"; an offsite venue
   is itself - the cleaned room, else the location without its O marker,
   else "Offsite"; a blank room leaves the hotel alone. Its two parts, the
   hotel and the room, either of which may be "": placeHTML() and
   placeText() are both made of them, so the markup and the words cannot
   differ. */
function placeParts(ev) {
  if (ev.hotel === "Streaming") return {hotel: "Streaming", room: ""};
  if (ev.hotel === "Other") {
    const venue = (ev.room && ev.room !== "Other" ? ev.room : cleanRoom("Other", ev.location)) || "Offsite";
    return {hotel: "", room: venue === "Other" ? "Offsite" : venue};
  }
  if (!ev.hotel || ev.hotel === "Unknown") return {hotel: "", room: ev.room || ev.location || "Location TBA"};
  const room = String(ev.room || "").trim();
  if (room && HOTEL_DISPLAY[ev.hotel] === "location") return {hotel: "", room};
  return {hotel: hotelShort(ev.hotel), room};
}
/* The place as markup: the parts are spans so a line can shorten the room
   and never the hotel. */
function placeHTML(ev) {
  const {hotel, room} = placeParts(ev);
  return `${hotel ? `<span class="rh">${esc(hotel)}</span>` : ""}${hotel && room ? " · " : ""}${room ? `<span class="rr">${esc(room)}</span>` : ""}`;
}
/* And as words, for a label (DECISIONS #75): exactly the text of
   placeHTML(), "Hilton · 313-314". Text, not markup: the caller escapes
   it. */
function placeText(ev) {
  const {hotel, room} = placeParts(ev);
  return [hotel, room].filter(Boolean).join(" · ");
}
/* The level a row says after the room (DECISIONS #73): the level's short
   name, or "" where the event has no level, and where the room already says
   it - the room, case-folded, holding the short name less a trailing " Level"
   or " Floor". "Atrium Ballroom" is said to be on the Atrium Level;
   "Imperial Ballroom" is not said to be on the Marquis Level. */
function levelShort(ev) {
  const short = (ev.level && (LEVEL_SHORT.get(ev.hotel) || new Map()).get(ev.level)) || "";
  const said = short.replace(/ (Level|Floor)$/, "").toLowerCase();
  return short && !String(ev.room || "").toLowerCase().includes(said) ? short : "";
}
/* The level an event's sheet says under the place (DECISIONS #74): its full
   name, exactly where a row names the level - levelShort()'s two rules - so
   the sheet never says a level its room has said. "Atlanta Conference
   Center (LL3)", where the row says "Conference Center". */
const levelName = ev => (levelShort(ev) ? LEVEL_NAME.get(ev.hotel).get(ev.level) : "");
function walkMin(a, b) {
  if (!a || !b || a === "Streaming" || b === "Streaming") return 0;
  if (a === b) return Math.round(SAME_VENUE_MIN * settings.crowd);
  const base = WALK[`${a}|${b}`] ?? WALK[`${b}|${a}`] ?? UNKNOWN_PAIR_MIN;
  return Math.round(base * settings.crowd);
}

const hotelShort = h => HOTEL_SHORT[h] || h;
/* A place in a line of words, as the Map's On now line has always named it:
   the hotel's short name, and an offsite pick by its room, else "offsite".
   Text, not markup: the caller escapes it. Your crew's picks right now and
   the hero's next pick name a place the same way (DECISIONS #73). */
const placeShort = ev => (ev.hotel === "Other" ? ev.room || "offsite" : hotelShort(ev.hotel));
/* A hotel's colour variable, or a group's - a chip's value is either. */
const hotelVar = h => `--h-${HOTEL_VAR[h] || GROUP_VAR[h] || "Other"}`;
const hotelGroup = h => HOTEL_GROUP[h] || h;
/* A chip value is a venue or a group of them; "All" is everything. */
const hotelMatches = (e, v) => v === "All" || e.hotel === v || hotelGroup(e.hotel) === v;

/* "Search the Hyatt on Saturday": hotels take "the", the park does not, and
   neither do the Mart's buildings - "Search Mart 2 on Saturday", "~8 min
   from Mart 2" - which it knows by their group, Mart (#91). */
const hotelPhrase = h => (h === "Hardy Ivy Park" ? h : hotelGroup(h) === "Mart" ? hotelShort(h) : `the ${hotelShort(h)}`);

export {
  HOTEL_ORDER, WALK, SLACK_MIN, cleanRoom, placeHTML, placeText, placeShort, levelShort, levelName, walkMin, hotelShort, hotelVar,
  hotelGroup, hotelMatches, hotelPhrase, hotelLevels,
};
