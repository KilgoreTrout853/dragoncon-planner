/* What the reader has chosen: the settings that persist, and the state of the
   screen - which tab, which filters, what is open. Both are read from storage
   once, as the module is imported; whoever changes a setting saves it. They
   are consts whose properties change, so any module may write to them. */
import { loadJSON } from "./storage.js";

const settings = loadJSON("dc26.settings", {crowd: 1.3, hideNoise: true});
const state = {
  tab: "now", sheetId: null, sheetHotel: null, mineView: loadJSON("dc26.mineView", "timeline"),
  now: {hotel: "All", limit: 80},
  map: {day: null},                       /* null: follow the clock */
  explore: {q: "", page: null, scroll: 0, showPast: false, expanded: {}, active: null},
  following: {layout: loadJSON("dc26.followingLayout", "interest"), expanded: {}, showPast: {}, open: loadJSON("dc26.followingOpen", true)},
  browse: {q: "", day: null, prevDay: null, hotel: "All", type: "All", track: "All", fandom: "All", kind: "All", showHidden: false, showPast: false, noToday: false, todayScoped: false, hideNoise: settings.hideNoise, page: 1},
};

export { settings, state };
