/* What the reader has chosen: the settings that persist, and the state of the
   screen - which tab, which filters, what is open. Both are read from storage
   once, as the module is imported; whoever changes a setting saves it. They
   are consts whose properties change, so any module may write to them. */
import { loadJSON } from "./storage.js";
import { storageKey } from "./build.js";

const settings = loadJSON(storageKey("settings"), {crowd: 1.3, hideNoise: true});
const state = {
  tab: "now", sheetId: null, sheetHotel: null, mineView: loadJSON(storageKey("mineView"), "timeline"),
  /* My day or the crew's: "mine" | "crew", or null while never tapped, when
     the day and the crews decide it as Plans draws (plans.js). */
  plansView: loadJSON(storageKey("plansView"), null),
  now: {hotel: "All", limit: 80},
  /* The Map's: the day a chip chose, null to follow the clock; its focus,
     the id of the event an event's sheet sent the reader here to find, null
     for none - in memory alone, and it carries its own day (map.js;
     DECISIONS #75); and the building view's - the venue whose stack is
     open, by its key, and the plate selected in it, by its key (#95); the
     plate whose level is open, by its key, the rooms selected in it, a
     list of {level, id}, and the room the camera is zoomed on, {level, id,
     scale} (#96) - each null for none, in memory alone and kept when the
     tab is left. A level open leaves no plate selected. */
  map: {day: null, focus: null, stack: null, plate: null, level: null, rooms: null, zoom: null},
  plans: {crew: null, day: null},         /* the crew shown, null the oldest; the crew's day, null the clock's */
  /* What stands in place of the picks that changed, under the notice on Now
     and on My day, while the reader stays on the tab - the tab, the news it
     was worked out from, and each fold's rows and whether it is open - null
     when it is to be worked out (inplace.js; DECISIONS #90). */
  inPlace: null,
  /* Explore's: mutedOpen is the grid's Muted fold, shut on every load (#84);
     forYou is For you's list while the reader stays on the grid - its rows
     and whether Show more was tapped - null when it is to be worked out
     (explore.js; #87); and under it, as zero, the zero state that stands
     in its place while it has no row (#88). */
  explore: {q: "", page: null, scroll: 0, showPast: false, showCast: false, castNoise: false, mutedOpen: false, forYou: null, expanded: {}, active: null},
  /* The Following feed's: by follow id, a block's Show more, its Already
     happened, and a fandom's cast - open, and its photo ops shown (#85).
     open is the fold as the reader stored it by a tap on the heading, true
     or false, and null while never stored, when For you decides it (#87). */
  following: {layout: loadJSON(storageKey("followingLayout"), "interest"), expanded: {}, showPast: {}, showCast: {}, castNoise: {},
    open: loadJSON(storageKey("followingOpen"), null)},
  /* Search's: the query, the day, and the filter sheet's thirteen, the four
     topic axes (W8, #70) and the four of Getting in (W7, #77) among them;
     castOpen is the cast group's fold, open until tapped shut (#85). */
  browse: {q: "", day: null, prevDay: null, hotel: "All", type: "All", track: "All", work: "All", kind: "All",
    medium: "All", genre: "All", craft: "All", subject: "All",
    cost: "All", signup: "All", audience: "All", soldOut: "All",
    showHidden: false, showPast: false, castOpen: true, noToday: false, todayScoped: false, hideNoise: settings.hideNoise, page: 1},
};

export { settings, state };
