/* What the reader has chosen: the settings that persist, and the state of the
   screen - which tab, which filters, what is open. Both are read from storage
   once, as the module is imported; whoever changes a setting saves it. They
   are consts whose properties change, so any module may write to them. */
import { YY } from "./season.js";
import { loadJSON } from "./storage.js";

const settings = loadJSON(`dc${YY}.settings`, {crowd: 1.3, hideNoise: true});
const state = {
  tab: "now", sheetId: null, sheetHotel: null, mineView: loadJSON(`dc${YY}.mineView`, "timeline"),
  now: {hotel: "All", limit: 80},
  map: {day: null},                       /* null: follow the clock */
  explore: {q: "", page: null, scroll: 0, showPast: false, showCast: false, castNoise: false, expanded: {}, active: null},
  following: {layout: loadJSON(`dc${YY}.followingLayout`, "interest"), expanded: {}, showPast: {}, open: loadJSON(`dc${YY}.followingOpen`, true)},
  browse: {q: "", day: null, prevDay: null, hotel: "All", type: "All", track: "All", work: "All", kind: "All", showHidden: false, showPast: false, noToday: false, todayScoped: false, hideNoise: settings.hideNoise, page: 1},
};

export { settings, state };
