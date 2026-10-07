/* The place filter (DECISIONS #98; docs/screens/contract.md, sections 3, 6
   and 11): the head of a plate's card and of a room's on the Map, one button
   to Search - which cards have it, what it is called, what its tap sets -
   and the place in Search: its list, which is the card's own, its one chip,
   the badge, the filter sheet's Hotel row and its line of words, each way
   the place leaves and each thing that only narrows it, and the Map as it
   was left behind it. The page is the sample schedule at Saturday 1:05 PM;
   where the sample lacks a thing - a cancelled event in a drawn room - a
   copy of it is handed to replaceSchedule(), as a refresh hands one. The
   place's own rules are tests/unit/place.test.js's, every place 2026's Map
   can select tests/real-data.test.js's, and what a phone draws of the head
   tests/browser/place.spec.js's. New tests, not rows of
   tests/PORT-LEDGER.md. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { tap, typeInto } from "../helpers/act.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = JSON.parse(fs.readFileSync(path.join(HERE, "..", "sample-events.json"), "utf8"));
const NOW = "2026-09-05T13:05", WED = "2026-09-02", THU = "2026-09-03", SAT = "2026-09-05", SUN = "2026-09-06";
const EXHIBIT = "exhibit+tower-ll2", MART3 = "AmericasMart Building 3";
/* The reader's Saturday pick in Grand Hall C, a small room of the Hyatt's
   Exhibit Level; a photo session booked as International Hall South, a
   composite of seven rooms of the Marriott's; and an event in the Hilton's
   209, 210 and 211, which no composite holds. */
const IN_EXHIBIT = "s0263", AS_SOUTH = "s0301", IN_THREE = "s0246";
const HALL_C = { hotel: "Hyatt", levels: ["exhibit"], rooms: ["Grand Hall C"] };
const FILTERS = ["hotel", "work", "track", "medium", "genre", "craft", "subject", "type", "kind", "cost", "signup", "audience", "soldOut"];

describe("the place filter: from a card of the Map's to every event there, in Search", () => {
  let page, app, handle, state;
  const el = id => document.getElementById(id);
  const view = () => el("view-map");
  const svg = () => view().querySelector("svg.map");
  const words = node => (node ? node.textContent.replace(/\s+/g, " ").trim() : "");
  const block = hotel => svg().querySelector(`.map-hotel[data-hotel="${hotel}"]`);
  const shown = () => [...svg().querySelectorAll(".map-stacks > .map-stack")].filter(g => !g.hasAttribute("hidden"));
  const plate = key => [...shown()[0].querySelectorAll(".plate")].find(p => p.dataset.plate === key);
  const laid = () => shown()[0].querySelector(".plate.flat");
  const shape = id => [...laid().querySelectorAll("[data-room]")].find(r => r.dataset.room === id);
  const under = () => el("mapUnder");
  const card = () => el("mapRoom") || el("mapPlate");
  const head = () => under().querySelector(".pc-head");
  const dayChip = day => view().querySelector(`[data-chip="map-day"][data-value="${day}"]`);
  const navTo = tab => document.querySelector(`.nav button[data-tab="${tab}"]`).click();
  const browse = () => el("view-browse");
  const chips = () => [...browse().querySelectorAll(".parsed-chips .chip")];
  const placeChip = () => browse().querySelector('.parsed-chips [data-dim="place"]');
  const rowIds = () => [...browse().querySelectorAll("#browseRest .list .row")].map(r => r.dataset.id);
  const count = () => words(browse().querySelector(".section-title .count"));
  const badge = () => [el("filtersBadge").hidden, el("filtersBadge").textContent, el("filtersBtn").getAttribute("aria-label")];
  const panel = () => el("panel-filters");
  const hotelChip = value => [...panel().querySelectorAll('[data-chip="hotel"]')].find(c => c.dataset.value === value);
  const pressed = () => [...panel().querySelectorAll('[data-chip="hotel"][aria-pressed="true"]')].map(c => c.dataset.value);
  const only = () => { const line = panel().querySelector("#filterOnly"); return [line.hidden, words(line)]; };
  const openFilters = () => el("filtersBtn").click();
  const showing = () => words(panel().querySelector("#filtersShow"));
  /* The events at a place as the Map's card lists them - building.js's own
     lists, each event once - on a day, or on every day; by id, sorted. */
  const atCard = (place, day) => {
    const all = place.rooms ? place.rooms.flatMap(id => app.roomEvents(place.hotel, place.levels[0], id).map(at => at.ev)) : place.levels.flatMap(level => app.levelEvents(place.hotel, level));
    return [...new Set(all)].filter(e => day === "All" || e._cd === day).map(e => e.id).sort();
  };
  /* The city map at Saturday 1:05 PM, nothing open, Search as a fresh page has it. */
  const city = (ids = []) => {
    handle.closeSheet();
    app.setOverride(NOW);
    state.tab = "map";
    Object.assign(state.map, { day: null, focus: null, stack: null, plate: null, level: null, rooms: null, zoom: null });
    FILTERS.forEach(d => { state.browse[d] = "All"; });
    Object.assign(state.browse, { q: "", day: null, prevDay: null, place: null, showHidden: false, showPast: false, noToday: false, hideNoise: true, page: 1 });
    handle.picks.set(ids);
    handle.render();
  };
  const lift = hotel => tap(block(hotel).querySelector("rect"));
  const level = (hotel, key) => { lift(hotel); tap(plate(key).querySelector(".plate-hull")); };
  const room = id => tap(shape(id));
  /* A room's card, a floor's and an open level's, each from the city map. */
  const roomCard = (hotel, key, id) => { city(); level(hotel, key); room(id); };
  /* Rooms selected together, as an arrival leaves them, with the focus ended by the Map's own day chip: the room card's. */
  const arrival = id => { city(); app.showOnMap(id); dayChip(SAT).click(); };
  /* Search, by the head of Grand Hall C's card on Saturday. */
  const toSearch = () => { roomCard("Hyatt", EXHIBIT, "Grand Hall C"); head().click(); };
  const type = text => { typeInto(el("q"), text); handle.render(); };
  const leaveBox = () => { el("q").dispatchEvent(new FocusEvent("focusout", { bubbles: true })); handle.render(); };

  beforeAll(async () => {
    page = await bootPage();
    ({ app, handle } = page);
    state = handle.state;
    await page.until(() => app.BOOT.suggested > 0, 20000, "the search index");
    navTo("map");
  }, 30000);
  afterAll(() => page.cleanup());
  beforeEach(() => city());

  describe("the card's head", () => {
    it("a room's is one button: the small line, the name and the day's line in it, a chevron at its right that no screen reader meets - and the rows after it, each its own button", () => {
      roomCard("Hyatt", EXHIBIT, "Grand Hall C");
      const h = head();
      expect([h.tagName, h.id, h.getAttribute("type"), h.dataset.act, h.dataset.day, h.parentNode.id]).toEqual(["BUTTON", "mapAll", "button", "place-search", SAT, "mapRoom"]);
      expect([...h.querySelectorAll(".nc-label, .nc-title, .nc-when")].map(words)).toEqual(["Hyatt · Exhibit Level (LL2)", "Grand Hall C", "Saturday · 5 events"]);
      expect([...h.children].map(n => [n.className, n.getAttribute("aria-hidden")])).toEqual([["pc-words", null], ["pc-chevron", "true"]]);
      expect([[...el("mapRoom").children].map(n => n.className), [...under().querySelectorAll(".pc-row")].every(r => r.tagName === "BUTTON" && !h.contains(r)), h.querySelector("button, div")]).toEqual([["pc-head", "pc-rows"], true, null]);
    });
    it("its name says where it goes: every event there that day, by the card's own count, in Search", () => {
      roomCard("Hyatt", EXHIBIT, "Grand Hall C");
      expect(head().getAttribute("aria-label")).toBe("All 5 events in Grand Hall C on Saturday, in Search");
    });
    it("one event is said as one", () => {
      roomCard("Hyatt", "acc", "Roswell");
      dayChip(THU).click();
      expect([words(head().querySelector(".nc-when")), head().dataset.day, head().getAttribute("aria-label")]).toEqual(["Thursday · 1 event", THU, "The 1 event in Roswell on Thursday, in Search"]);
    });
    it("several rooms', as an arrival leaves them: a composite's by its own name, any other set one by one", () => {
      arrival(AS_SOUTH);
      expect([card().id, head().tagName, head().getAttribute("aria-label")]).toEqual(["mapRoom", "BUTTON", "All 4 events in International Hall South on Saturday, in Search"]);
      arrival(IN_THREE);
      expect([card().id, head().tagName, head().getAttribute("aria-label")]).toEqual(["mapRoom", "BUTTON", "All 7 events in 209 + 210 + 211 on Saturday, in Search"]);
    });
    it("a floor's, which has no drawing, and an open level's with no room selected - a shared plate's by both its levels", () => {
      city(); lift("Westin"); tap(plate("f12").querySelector(".plate-hull"));
      expect([card().id, head().tagName, head().parentNode.id, head().getAttribute("aria-label")]).toEqual(["mapPlate", "BUTTON", "mapPlate", "All 4 events in 12th Floor on Saturday, in Search"]);
      city(); level("Hyatt", EXHIBIT);
      expect([card().id, state.map.rooms, head().tagName, head().getAttribute("aria-label")]).toEqual(["mapPlate", null, "BUTTON", "All 9 events in Exhibit Level + Intl Tower LL2 on Saturday, in Search"]);
    });
    it("never the focused card's, the venue's line's or the city map's: none has a head, and none is a place", () => {
      city([IN_EXHIBIT]);
      expect([head(), under().querySelector('[data-act="place-search"]'), app.cardPlace()]).toEqual([null, null, null]);
      lift("Hyatt");
      expect([[...under().children].map(n => n.id || n.className), head(), under().querySelector('[data-act="place-search"]'), app.cardPlace()]).toEqual([["mapVenue", "map-hint"], null, null, null]);
      city(); app.showOnMap(IN_EXHIBIT);
      expect([[...under().children].map(n => n.id), state.map.rooms.map(r => r.id), head(), under().querySelector('[data-act="place-search"]'), app.cardPlace()]).toEqual([["mapNext"], ["Grand Hall C"], null, null, null]);
    });
    it("with nothing on the Map's day and something on others it is still the link, to every day", () => {
      roomCard("Hyatt", EXHIBIT, "Grand Hall C");
      dayChip(WED).click();
      expect([words(head().querySelector(".nc-when")), words(under().querySelector(".pc-none")), head().tagName, head().dataset.day, head().getAttribute("aria-label")])
        .toEqual(["Wednesday · no events", "Nothing here on Wednesday. 20 events on other days.", "BUTTON", "All", "All 20 events in Grand Hall C, on every day, in Search"]);
    });
    it("with nothing at all it is the same three lines and no button, with no chevron - a room's, and a drawn level's", () => {
      roomCard("Hyatt", "acc", "Piedmont");
      const h = head();
      expect([h.tagName, h.id, h.dataset.act, h.getAttribute("aria-label"), h.querySelector(".pc-chevron"), [...h.querySelectorAll(".nc-label, .nc-title, .nc-when")].map(words), under().querySelector("button")])
        .toEqual(["DIV", "", undefined, null, null, ["Hyatt · Atlanta Conference Center (LL3)", "Piedmont", "Saturday · no events"], null]);
      tap(h.querySelector(".nc-title"));
      expect([state.tab, state.browse.place]).toEqual(["map", null]);
      city(); level("Marriott", "lobby");
      expect([head().tagName, head().querySelector(".pc-chevron"), words(head().querySelector(".nc-title"))]).toEqual(["DIV", null, "Lobby Level"]);
    });
    it("a cancelled event there that day is in no count, and the name says it apart", () => {
      app.replaceSchedule({ ...SAMPLE, events: SAMPLE.events.map(e => (e.id === "s0332" ? { ...e, cancelled: true } : e)) });
      roomCard("Hyatt", EXHIBIT, "Grand Hall C");
      expect([words(head().querySelector(".nc-when")), head().getAttribute("aria-label")]).toEqual(["Saturday · 4 events", "All 4 events in Grand Hall C on Saturday, and 1 cancelled, in Search"]);
      app.replaceSchedule(SAMPLE);
    });
    it("it keeps keyboard focus through the minute's draw, and a row that had focus and has left the card hands it to the next row, not to the head", () => {
      roomCard("Hyatt", EXHIBIT, "Grand Hall C");
      head().focus();
      app.setOverride("2026-09-05T13:06");
      app.tickMap();
      expect(document.activeElement).toBe(head());
      const first = under().querySelector(".pc-row");
      first.focus();
      app.setOverride("2026-09-05T16:01");                  // the row's event has begun: it is On now, and the row after it is another
      app.tickMap();
      expect([document.activeElement !== head(), document.activeElement.classList.contains("pc-row")]).toEqual([true, true]);
    });
  });

  describe("the head's tap", () => {
    it("sets the place, the Map's day, no query and no other filter, the hotel the place's venue, and the last question's answers put back - and shows Search at its top", () => {
      roomCard("Hyatt", EXHIBIT, "Grand Hall C");
      FILTERS.forEach(d => { state.browse[d] = "x"; });
      Object.assign(state.browse, { q: "trek sunday", day: SUN, prevDay: WED, showHidden: true, showPast: true, noToday: true, page: 3 });
      document.querySelector("main").scrollTop = 240;
      head().click();
      const b = state.browse;
      expect([state.tab, b.place, b.day, b.q, b.prevDay, b.hotel, b.showHidden, b.showPast, b.noToday, b.page]).toEqual(["browse", HALL_C, SAT, "", null, "Hyatt", false, false, false, 1]);
      expect(FILTERS.filter(d => d !== "hotel").map(d => b[d])).toEqual(Array(12).fill("All"));
      expect([browse().hidden, view().hidden, el("q").value, document.querySelector("main").scrollTop, el("sheetWrap").hidden]).toEqual([false, true, "", 0, true]);
    });
    it("the toggle that hides photo sessions is left as it stands", () => {
      for (const hide of [true, false]) {
        roomCard("Hyatt", EXHIBIT, "Grand Hall C");
        state.browse.hideNoise = hide;
        head().click();
        expect(state.browse.hideNoise).toBe(hide);
      }
    });
    it("keyboard focus lands on the place's chip", () => {
      toSearch();
      expect([document.activeElement === placeChip(), placeChip().tagName]).toEqual([true, "BUTTON"]);
    });
    it("where the place has nothing on the Map's day, Search is on every day", () => {
      roomCard("Hyatt", EXHIBIT, "Grand Hall C");
      dayChip(WED).click();
      head().click();
      expect([state.tab, state.browse.day, state.browse.place, rowIds().length, count()]).toEqual(["browse", "All", HALL_C, 20, "20"]);
      expect([...browse().querySelectorAll('#dayChips [aria-pressed="true"]')].map(words)).toEqual(["All days"]);
    });
    it("each kind of card sends its own place: rooms of one level, or the levels of a plate", () => {
      const sent = () => { head().click(); return state.browse.place; };
      arrival(AS_SOUTH);
      expect(sent()).toEqual({ hotel: "Marriott", levels: ["international"], rooms: ["International 10", "International 9", "International 8", "International 7", "International 6", "International 5", "International 4"] });
      city(); lift("Westin"); tap(plate("f12").querySelector(".plate-hull"));
      expect(sent()).toEqual({ hotel: "Westin", levels: ["f12"], rooms: null });
      city(); level("Hyatt", EXHIBIT);
      expect(sent()).toEqual({ hotel: "Hyatt", levels: ["exhibit", "tower-ll2"], rooms: null });
    });
    it("the Map is left as it stands: its level, its room and its zoom", () => {
      roomCard("Hyatt", EXHIBIT, "Grand Hall C");
      const was = JSON.stringify(state.map);
      expect([state.map.level, state.map.rooms, !!state.map.zoom]).toEqual([EXHIBIT, [{ level: "exhibit", id: "Grand Hall C" }], true]);
      head().click();
      expect(JSON.stringify(state.map)).toBe(was);
    });
  });

  describe("Search's list is the card's own", () => {
    it("a room's on the day: the same events, each a row, and the title's count the list's", () => {
      toSearch();
      expect([rowIds().slice().sort(), count(), showingNone()]).toEqual([atCard(HALL_C, SAT), "5", null]);
      expect(atCard(HALL_C, SAT)).toHaveLength(5);
    });
    const showingNone = () => browse().querySelector(".empty");
    it("several rooms', a floor's and a shared plate's, both its levels' events", () => {
      const listed = () => { head().click(); return [rowIds().slice().sort(), rowIds().length]; };
      arrival(IN_THREE);
      expect(listed()).toEqual([atCard(state.browse.place, SAT), 7]);
      city(); lift("Westin"); tap(plate("f12").querySelector(".plate-hull"));
      expect(listed()).toEqual([atCard(state.browse.place, SAT), 4]);
      city(); level("Hyatt", EXHIBIT);
      expect(listed()).toEqual([atCard(state.browse.place, SAT), 9]);
    });
    it("a photo room's: every session listed, though the setting hides photo sessions - which without the place it still does", () => {
      arrival(AS_SOUTH);
      head().click();
      expect([state.browse.hideNoise, app.activeFilters().hideNoise, rowIds().slice().sort(), count()]).toEqual([true, false, atCard(state.browse.place, SAT), "4"]);
      expect(rowIds().every(id => app.isNoise(app.byId.get(id)))).toBe(true);
      state.browse.place = null;                             // the Marriott on Saturday, and no place
      handle.render();
      expect([app.activeFilters().hideNoise, rowIds().some(id => app.isNoise(app.byId.get(id)))]).toEqual([true, false]);
    });
    it("an event booked as a composite is at each of its leaves, as the card has it", () => {
      city(); level("Marriott", "international"); room("International 6");
      head().click();
      expect([state.browse.place.rooms, rowIds().includes(AS_SOUTH), rowIds().length]).toEqual([["International 6"], true, 4]);
    });
    it("a cancelled event is in the list, marked, and in no count of the card's", () => {
      app.replaceSchedule({ ...SAMPLE, events: SAMPLE.events.map(e => (e.id === "s0332" ? { ...e, cancelled: true } : e)) });
      toSearch();
      expect([rowIds().length, count(), rowIds().includes("s0332"), words(browse().querySelector('.row[data-id="s0332"]')).startsWith("Cancelled")]).toEqual([5, "5", true, true]);
      app.replaceSchedule(SAMPLE);
    });
  });

  describe("how Search shows it", () => {
    it("one chip under the box, by the place's words, with its x - and the venue is no second chip", () => {
      toSearch();
      expect(chips().map(c => [c.dataset.act, c.dataset.dim, words(c), c.getAttribute("aria-label")])).toEqual([["unfilter", "place", "Hyatt · Grand Hall C ×", "Remove Hyatt · Grand Hall C filter"]]);
      expect(browse().querySelector('.parsed-chips [data-dim="hotel"]')).toBe(null);
    });
    it("the badge on Filters counts it once", () => {
      toSearch();
      expect(badge()).toEqual([false, "1", "Filters, 1 set"]);
    });
    it("the chip's words for a composite, a shared plate and a floor of the Mart", () => {
      arrival(AS_SOUTH); head().click();
      expect(words(placeChip().querySelector(".chip-label"))).toBe("Marriott · International Hall South");
      city(); level("Hyatt", EXHIBIT); head().click();
      expect(words(placeChip().querySelector(".chip-label"))).toBe("Hyatt · Exhibit Level + Intl Tower LL2");
      city(); lift(MART3); tap(plate("f1").querySelector(".plate-hull")); head().click();
      expect(words(placeChip().querySelector(".chip-label"))).toBe("Mart 3 · 1st Floor");
    });
    it("in the filter sheet the place's venue is pressed, one line of words under the Hotel chips says the place, and the count is the list's", () => {
      toSearch();
      openFilters();
      const line = panel().querySelector("#filterOnly");
      expect([pressed(), only(), showing(), panel().querySelector("#filtersClear").disabled]).toEqual([["Hyatt"], [false, "Only Grand Hall C"], "Show 5 events", false]);
      expect([line.tagName, line.parentNode.dataset.group, line.previousElementSibling.className, line.querySelector("button, a, input, select")]).toEqual(["P", "hotel", "filter-chips", null]);
    });
    it("a building of the Mart is pressed by a chip of its own, and the line says a plate's and a composite's own words", () => {
      city(); lift(MART3); tap(plate("f1").querySelector(".plate-hull")); head().click();
      openFilters();
      expect([pressed(), words(hotelChip(MART3)), only()]).toEqual([[MART3], "Mart 3", [false, "Only 1st Floor"]]);
      arrival(AS_SOUTH); head().click(); openFilters();
      expect(only()).toEqual([false, "Only International Hall South"]);
      city(); level("Hyatt", EXHIBIT); head().click(); openFilters();
      expect(only()).toEqual([false, "Only Exhibit Level + Intl Tower LL2"]);
    });
    it("with no place the sheet has the line in it, hidden and empty", () => {
      city(); navTo("browse");
      openFilters();
      expect(only()).toEqual([true, ""]);
      tap(hotelChip("Hyatt"));
      expect(only()).toEqual([true, ""]);
    });
    it("the line that offers photo sessions held back is not shown while a place is set, which holds none back", () => {
      const who = app.personName(app.byId.get(AS_SOUTH).people[0].id);
      toSearch();
      type(`"${who}"`);
      expect([!!state.browse.place, browse().querySelector(".hidden-note")]).toEqual([true, null]);
      state.browse.place = null; state.browse.hotel = "All";
      handle.render();
      expect(words(browse().querySelector(".hidden-note"))).toMatch(/photo sessions? hidden/);
    });
  });

  describe("how a place leaves", () => {
    it("its chip's x: the place and the hotel both go, and focus goes to the Filters button", () => {
      toSearch();
      placeChip().click();
      expect([state.browse.place, state.browse.hotel, chips().length, badge()[0], document.activeElement === el("filtersBtn")]).toEqual([null, "All", 0, true, true]);
    });
    it("another hotel's chip in the sheet sets that hotel, and the place goes: the line with it", () => {
      toSearch();
      openFilters();
      tap(hotelChip("Hilton"));
      expect([state.browse.hotel, pressed(), only(), app.activeFilters().place]).toEqual(["Hilton", ["Hilton"], [true, ""], null]);
      panel().querySelector("#filtersShow").click();
      expect([state.browse.place, chips().map(words)]).toEqual([null, ["Hilton ×"]]);
    });
    it("a tap on its own venue, which is pressed, takes the place off and leaves the hotel, one step wider - the chip still pressed, the line gone, the count the hotel's; a second tap is All", () => {
      toSearch();
      openFilters();
      const hyatt = hotelChip("Hyatt");
      tap(hyatt);
      expect([state.browse.place, state.browse.hotel, pressed(), only(), hotelChip("Hyatt") === hyatt]).toEqual([null, "Hyatt", ["Hyatt"], [true, ""], true]);
      expect(showing()).toBe(`Show ${app.events.filter(e => e.hotel === "Hyatt" && e._cd === SAT && !app.isNoise(e)).length} events`);
      tap(hyatt);
      expect([state.browse.hotel, pressed()]).toEqual(["All", ["All"]]);
      panel().querySelector("#filtersShow").click();
      expect(chips().length).toBe(0);
    });
    it("the sheet closed after that one tap draws the list from its top, the hotel its chip", () => {
      toSearch();
      openFilters();
      tap(hotelChip("Hyatt"));
      document.querySelector("main").scrollTop = 120;
      panel().querySelector("#filtersShow").click();
      expect([chips().map(words), badge()[1], document.querySelector("main").scrollTop]).toEqual([["Hyatt ×"], "1", 0]);
    });
    it("a hotel word typed wins while the box holds it - the list the word's hotel, today's as a word alone is read, the place's chip not shown, the place kept; deleted before the box is left, the place is back; settled, it is gone with the hotel", () => {
      toSearch();
      type("hilton");
      expect([state.browse.place, chips().map(c => c.dataset.act), badge()[0], rowIds().every(id => app.byId.get(id).hotel === "Hilton"), rowIds().length > 5]).toEqual([HALL_C, ["unparse-today", "unparse"], true, true, true]);
      type("");
      expect([state.browse.place, chips().map(c => c.dataset.dim), rowIds().length]).toEqual([HALL_C, ["place"], 5]);
      type("hilton");
      leaveBox();
      expect([state.browse.place, state.browse.hotel, chips().map(c => c.dataset.act)]).toEqual([null, "All", ["unparse-today", "unparse"]]);
      type("");
      expect([state.browse.place, chips().length]).toEqual([null, 0]);
    });
    it("a word for its own hotel, settled, takes it off the same", () => {
      toSearch();
      type("hyatt");
      leaveBox();
      expect([state.browse.place, state.browse.hotel]).toEqual([null, "All"]);
    });
    it("the sheet's Clear", () => {
      toSearch();
      openFilters();
      panel().querySelector("#filtersClear").click();
      expect([state.browse.hotel, pressed(), only(), app.activeFilters().place, state.browse.place]).toEqual(["All", ["All"], [true, ""], null, null]);
    });
    it("the hotel sheet's own Search, for the same hotel: the hotel whole, on the sheet's day, as built - and another filter left as it stands", () => {
      toSearch();
      state.browse.kind = "panel";
      navTo("map");
      handle.openSheet("hotel", "Hyatt");
      const search = el("panel-hotel").querySelector('[data-act="map-search"]');
      expect([search.dataset.hotel, search.dataset.day]).toEqual(["Hyatt", SAT]);
      search.click();
      const b = state.browse;
      expect([state.tab, b.place, b.hotel, b.day, b.q, b.prevDay, b.page, b.showHidden, b.showPast, b.noToday, b.kind]).toEqual(["browse", null, "Hyatt", SAT, "", null, 1, false, false, false, "panel"]);
      expect(chips().map(c => c.dataset.dim)).toEqual(["hotel", "kind"]);
    });
    it("a new schedule with no event at the place: the place goes, with no error, and the hotel stays", () => {
      toSearch();
      app.replaceSchedule({ ...SAMPLE, events: SAMPLE.events.filter(e => !(e.hotel === "Hyatt" && (e.rooms || []).includes("Grand Hall C"))) });
      handle.render();
      expect([state.browse.place, state.browse.hotel, chips().map(c => c.dataset.dim), rowIds().length > 0]).toEqual([null, "Hyatt", ["hotel"], true]);
      app.replaceSchedule(SAMPLE);
    });
  });

  describe("what only narrows it", () => {
    it("a day chip: the place stays, and the list is that day's there", () => {
      toSearch();
      browse().querySelector(`[data-chip="day"][data-value="${SUN}"]`).click();
      expect([state.browse.place, state.browse.day, rowIds().slice().sort(), chips().map(c => c.dataset.dim)]).toEqual([HALL_C, SUN, atCard(HALL_C, SUN), ["place"]]);
      browse().querySelector('[data-chip="day"][data-value="All"]').click();
      expect([state.browse.place, rowIds().length]).toEqual([HALL_C, 20]);
    });
    it("a word typed: it ranks within the place, on every day while it is in the box", () => {
      toSearch();
      type("dune");
      const found = rowIds();
      expect([state.browse.place, state.browse.day, found.length > 0, found.every(id => atCard(HALL_C, "All").includes(id)), chips().map(c => c.dataset.dim)]).toEqual([HALL_C, "All", true, true, ["place"]]);
      type("");
      expect([state.browse.place, state.browse.day, rowIds().length]).toEqual([HALL_C, SAT, 5]);
    });
    it("another filter set in the sheet: both in effect, the badge at two", () => {
      toSearch();
      openFilters();
      tap([...panel().querySelectorAll('[data-chip="type"]')].find(c => c.dataset.value === "panel"));
      expect([state.browse.place, only()]).toEqual([HALL_C, [false, "Only Grand Hall C"]]);
      panel().querySelector("#filtersShow").click();
      expect([state.browse.place, chips().map(c => c.dataset.dim), badge()[1], rowIds().every(id => atCard(HALL_C, SAT).includes(id))]).toEqual([HALL_C, ["place", "type"], "2", true]);
      browse().querySelector('.parsed-chips [data-dim="type"]').click();
      expect([state.browse.place, chips().map(c => c.dataset.dim), rowIds().length]).toEqual([HALL_C, ["place"], 5]);
    });
    it("the list's own taps: a star, and a row to its sheet and back", () => {
      toSearch();
      browse().querySelector(".row .star").click();
      expect([state.browse.place, rowIds().length]).toEqual([HALL_C, 5]);
      browse().querySelector(".row .row-main").click();
      handle.closeSheet();
      expect([state.browse.place, chips().map(c => c.dataset.dim)]).toEqual([HALL_C, ["place"]]);
    });
  });

  describe("the way back", () => {
    it("is the tab bar's Map, as it was left: the level, the room and the zoom, the card the room's - and Search, come back to, still holds the place", () => {
      roomCard("Hyatt", EXHIBIT, "Grand Hall C");
      const zoom = { ...state.map.zoom }, cam = shown()[0].querySelector(".stack-cam").getAttribute("transform");
      head().click();
      navTo("map");
      expect([state.tab, state.map.stack, state.map.level, state.map.rooms, state.map.zoom]).toEqual(["map", "Hyatt", EXHIBIT, [{ level: "exhibit", id: "Grand Hall C" }], zoom]);
      expect([laid().dataset.plate, shape("Grand Hall C").getAttribute("aria-pressed"), shown()[0].querySelector(".stack-cam").getAttribute("transform") === cam, words(el("mapBack")), card().id, words(head().querySelector(".nc-title"))])
        .toEqual([EXHIBIT, "true", true, "← Whole level", "mapRoom", "Grand Hall C"]);
      navTo("browse");
      expect([state.browse.place, chips().map(c => c.dataset.dim)]).toEqual([HALL_C, ["place"]]);
    });
    it("Search has no way back of its own: no control in it names the Map", () => {
      toSearch();
      expect([...browse().querySelectorAll("button, a")].filter(c => /map/i.test(`${c.textContent} ${c.getAttribute("aria-label") || ""} ${c.dataset.act || ""}`))).toEqual([]);
    });
  });
});
