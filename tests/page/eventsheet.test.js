/* The event's sheet (DECISIONS #74; docs/screens/contract.md, section 7, as
   built): the head - the title, when, the place and the level, Cancelled or
   Removed, the facts, the other sessions, Starred by - the body that scrolls
   - the description, the people, the chips - and the foot - the overlap line
   and the actions. The sample has no part, no play, no people block and no
   cancelled or removed event, so this copy of it adds a made Saturday: a
   workshop with five more sessions, four picks that overlap it and two that
   do not, a game with every flag, a panel of five with a people block that
   gives two of them a line, and a stream with nothing to say. What the panel
   measures on a phone is layout, which jsdom does not do: the rules are
   pinned at the end, and the browser check holds the rest. New tests, not
   rows of tests/PORT-LEDGER.md. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(fs.readFileSync(path.join(HERE, "..", "sample-events.json"), "utf8"));
const css = fs.readFileSync(path.join(HERE, "..", "..", "src", "styles.css"), "utf8").replace(/\r\n/g, "\n");

const made = (id, day, start, end, more = {}) => ({
  id, source_id: id, title: id, type: "panel", day: `2026-09-0${day}`, start: `2026-09-0${day}T${start}`, end: `2026-09-0${day}T${end}`,
  duration_min: 60, hotel: "Hilton", room: "201", rooms: ["201"], level: "l2", location: "Hilton 201", place: "Hilton 201", track: "", tracks: [],
  speakers: [], people: [], facets: {}, tags: {audience: "all"}, description: `What ${id} is about.`, cancelled: false, ...more,
});
const person = (id, name, role) => ({id, name, role, src: "speakers"});
const ERIN = [person("erin-gray", "Erin Gray", "Moderator")];
const taiChi = (id, day, start, end, more = {}) => made(id, day, start, end, {
  title: "Tai Chi with Erin Gray", room: "404-405", rooms: ["404-405"], level: "l4", track: "Workshops", tracks: ["Workshops"], people: ERIN,
  facets: {cost: "extra", repeat_key: "tai chi with erin gray"}, tags: {audience: "all", guests: "celebrity"}, ...more,
});
const MADE = [
  taiChi("x-main", 5, "14:30", "15:30"),
  taiChi("x-thu", 3, "16:00", "17:00"),
  taiChi("x-fri", 4, "16:00", "17:00"),
  taiChi("x-late", 6, "00:30", "01:30"),                       // after midnight: Saturday's night
  taiChi("x-sun", 6, "14:30", "15:30", {hotel: "Hyatt", room: "Inman", level: "acc"}),
  taiChi("x-mon", 7, "10:00", "11:00"),
  taiChi("x-off", 6, "18:00", "19:00", {cancelled: true}),
  made("x-o1", 5, "14:00", "15:00", {title: "Overlap One"}),
  made("x-o2", 5, "14:30", "15:30", {title: "Overlap Two <b>&</b>"}),
  made("x-o3", 5, "14:45", "15:15", {title: "Overlap Three"}),
  made("x-o4", 5, "15:00", "16:00", {title: "Overlap Four"}),
  made("x-touch", 5, "15:30", "16:30", {title: "Only Touches"}),
  made("x-gone", 5, "14:30", "15:30", {title: "A Cancelled Pick", cancelled: true}),
  made("x-game", 5, "18:00", "20:00", {title: "The Long Game", type: "gaming", hotel: "Hyatt", room: "Kennesaw", level: "acc",
    facets: {sold_out: true, signup: true, min_age: 13, part: 2}, tags: {audience: "kids", play: {format: "one-shot", level: "beginner"}}}),
  made("x-panel", 5, "19:00", "20:00", {title: "A Panel of Five", hotel: "Marriott", room: "Atrium Ballroom", level: "atrium", track: "Space", tracks: ["Space", "Science"],
    people: [person("p-ann", "Ann", "Speaker"), person("p-bo", "Bo Lined", "Moderator"), person("p-cy", "Cy", "Panelist"), person("p-dee", "Dee Lined", "Judge"), person("p-eve", "Eve <i>", "(Alt: )")]}),
  made("x-bare", 5, "21:00", "22:00", {title: "Nothing To Say", hotel: "Streaming", room: "", level: null, description: ""}),
  made("x-mature", 5, "22:00", "23:00", {title: "After Dark", tags: {audience: "mature"}, tracks: ["Late Night"], track: "Late Night"}),
];
const BLOCK = [{id: "p-bo", name: "Bo Lined", known_for: "Voice of the ship in Deep Space <Nine>"}, {id: "p-dee", name: "Dee Lined", known_for: "Wrote the book."}];
const data = {...sample, people: BLOCK, events: [...sample.events, ...MADE]};

const el = id => document.getElementById(id);
const words = node => (node ? node.textContent.replace(/\s+/g, " ").trim() : "");
const panel = () => el("panel-event");
const part = selector => panel().querySelector(selector);
const parts = selector => [...panel().querySelectorAll(selector)];
const press = node => node.dispatchEvent(new MouseEvent("click", {bubbles: true, cancelable: true}));
const escape = () => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true, cancelable: true}));

describe("the event's sheet", () => {
  let page, app, handle, state;
  const open = id => { handle.closeSheet(); handle.openSheet("event", id); };
  const pick = ids => { handle.picks.set(ids); handle.render(); };
  const facts = () => parts(".ev-facts > *").map(words);
  const overlap = () => parts("#sheetOverlap > *").map(words);

  beforeAll(async () => {
    page = await bootPage({data});
    ({app, handle} = page);
    state = handle.state;
  }, 30000);
  afterAll(() => page.cleanup());

  describe("its parts", () => {
    it("are three: a head and a foot that never scroll, and the body between them", () => {
      open("x-main");
      expect([...panel().children].map(c => c.className)).toEqual(["ev-head", "ev-body", "ev-foot"]);
      expect([...part(".ev-foot").children].map(c => c.id || c.className)).toEqual(["sheetOverlap", "ev-actions"]);
      expect([...part(".ev-actions").children].map(c => c.id)).toEqual(["sheetStar", "sheetICS", "closeSheetEvent"]);
    });
    it("the head in one order: the title, when, the place, the level, the facts, the other sessions, Starred by", () => {
      expect([...part(".ev-head").children].map(c => c.id || c.className)).toEqual(
        ["sheetTitleEvent", "ev-when", "ev-room", "ev-level", "ev-facts", "ev-sessions", "sheetGoing"]);
      expect(words(part(".ev-when"))).toBe("Saturday, 2:30 PM to 3:30 PM · 1 h");
      expect(words(part(".ev-room"))).toBe("Hilton · 404-405");
    });
    it("Cancelled after the level and before the facts, as Removed is", () => {
      open("x-off");
      expect([...part(".ev-head").children].map(c => c.id || c.className || words(c))).toEqual(
        ["sheetTitleEvent", "ev-when", "ev-room", "ev-level", "Cancelled", "ev-facts", "ev-sessions", "sheetGoing"]);
    });
    it("the body in one order: the description, the people, the chips", () => {
      open("x-panel");
      expect([...part(".ev-body").children].map(c => c.className || c.tagName)).toEqual(["P", "ev-people", "tagline"]);
      expect(parts(".tagline .tag").map(words)).toEqual(["Space", "Science"]);
    });
    it("an event with nothing more to say: the title, when and the place; No description; the actions", () => {
      open("x-bare");
      expect([...part(".ev-head").children].map(c => c.id || c.className)).toEqual(["sheetTitleEvent", "ev-when", "ev-room", "sheetGoing"]);
      expect([...part(".ev-body").children].map(words)).toEqual(["No description."]);
      expect(el("sheetOverlap").innerHTML).toBe("");
    });
  });

  describe("the level, under the place", () => {
    it("is the level's full name, in the hotel's hue", () => {
      open("x-main");
      expect(words(part(".ev-level"))).toBe("4th Floor");
      expect(part(".ev-level").getAttribute("style")).toBe(part(".ev-room").getAttribute("style"));
      expect(part(".ev-level").getAttribute("style")).toMatch(/--h-Hilton/);
      open("x-game");
      expect(words(part(".ev-level"))).toBe("Atlanta Conference Center (LL3)");
    });
    it("is its own line: the place's words are as a row says them", () => {
      expect(words(part(".ev-room"))).toBe("Hyatt · Kennesaw");
      expect(part(".ev-room .ev-level")).toBe(null);
    });
    it("is left off where the room already says it, and where the event has none", () => {
      open("x-panel");
      expect(words(part(".ev-room"))).toBe("Marriott · Atrium Ballroom");
      expect(part(".ev-level")).toBe(null);
      open("s0001");
      expect(words(part(".ev-room"))).toBe("Mart Building 3, Floor 1");
      expect(part(".ev-level")).toBe(null);
      open("x-bare");
      expect(part(".ev-level")).toBe(null);
    });
  });

  describe("the facts line", () => {
    it("says Celebrity first, the pill, then the row's flags in the row's words", () => {
      open("x-main");
      expect(facts()).toEqual(["Celebrity", "Extra fee"]);
      expect(part(".ev-facts > :first-child").matches(".celeb")).toBe(true);
    });
    it("then what a row does not carry: the part and a game's format", () => {
      open("x-game");
      expect(facts()).toEqual(["Sold out", "Sign-up", "13+", "Kids", "Part 2", "One-shot game, beginners welcome"]);
      expect(parts(".ev-facts .fact").map(words)).toEqual(["Part 2", "One-shot game, beginners welcome"]);
    });
    it("the flags are the row's own, in its order", () => {
      const row = document.createElement("ul");
      row.innerHTML = app.rowHTML(app.byId.get("x-game"), {list: "test"});
      expect(parts(".ev-facts .flag").map(words)).toEqual([...row.querySelectorAll(".flags .flag")].map(words));
    });
    it("Sold out alone in the warning colour", () => {
      expect(parts(".ev-facts .warn").map(words)).toEqual(["Sold out"]);
    });
    it("the age is on it, and no longer a chip: 18+ for a mature audience, else the listing's minimum", () => {
      open("x-mature");
      expect(facts()).toEqual(["18+"]);
      expect(parts(".tagline .tag").map(words)).toEqual(["Late Night"]);
      expect(part(".tag.adult")).toBe(null);
      expect(part(".ev-facts .warn")).toBe(null);
      open("s0044");
      expect(facts()).toEqual(["18+"]);
    });
    it("is not there with nothing to say", () => {
      open("x-o1");
      expect(part(".ev-facts")).toBe(null);
    });
  });

  describe("the other sessions", () => {
    const links = () => parts(".ev-sessions .ev-link");
    it("Also runs: each by its con day's label and its start, only those not yet started, in start order", () => {
      open("x-main");
      expect(words(part(".ev-sessions"))).toBe("Also runs Sat 12:30 AM · Sun 2:30 PM · Mon 10:00 AM");
      expect(links().map(b => b.dataset.event)).toEqual(["x-late", "x-sun", "x-mon"]);
    });
    it("a session after midnight takes the night it belongs to, as a row does", () => {
      expect(app.byId.get("x-late").day).toBe("2026-09-06");
      expect(words(links()[0])).toBe("Sat 12:30 AM");
    });
    it("each is a button named for what it is, and the dot between them is not read out", () => {
      expect(links().map(b => b.getAttribute("aria-label"))).toEqual(["Also runs Sat 12:30 AM", "Also runs Sun 2:30 PM", "Also runs Mon 10:00 AM"]);
      expect(parts(".ev-sessions .dot").every(d => d.getAttribute("aria-hidden") === "true")).toBe(true);
    });
    it("the sessions already started are left out, of the line and of its count (#75)", () => {
      for (const id of ["x-main", "x-late", "x-sun", "x-mon"]) {
        open(id);
        expect(links().map(b => b.dataset.event), id).not.toContain("x-thu");
        expect(links().map(b => b.dataset.event), id).not.toContain("x-fri");
        expect(words(part(".ev-sessions")), id).not.toMatch(/Thu|Fri/);
      }
      open("x-mon");
      expect(words(part(".ev-sessions"))).toBe("Also runs Sat 2:30 PM · Sat 12:30 AM · Sun 2:30 PM");
    });
    it("three are named, then how many more of those still to come, in plain words, not a tap", () => {
      open("x-thu");
      expect(words(part(".ev-sessions"))).toBe("Also runs Sat 2:30 PM · Sat 12:30 AM · Sun 2:30 PM and 1 more");
      expect(links().map(b => b.dataset.event)).toEqual(["x-main", "x-late", "x-sun"]);
      expect(links()).toHaveLength(3);
      expect(parts(".ev-sessions button").map(words)).not.toContain("and 1 more");
    });
    it("a cancelled session is in no list, and its own sheet lists its live sessions still to come", () => {
      for (const id of ["x-main", "x-thu", "x-mon"]) { open(id); expect(links().map(b => b.dataset.event), id).not.toContain("x-off"); }
      open("x-off");
      expect(words(part(".ev-sessions"))).toBe("Also runs Sat 2:30 PM · Sat 12:30 AM · Sun 2:30 PM and 1 more");
    });
    it("no line where there is no other session", () => {
      open("x-o1");
      expect(part(".ev-sessions")).toBe(null);
    });
    it("and none where no session is left to come: the clock as the panel is drawn decides, and after the con no sheet has the line", () => {
      handle.closeSheet();
      handle.setTimeOverride("2026-09-07T10:00");
      for (const id of ["x-main", "x-thu", "x-off", "x-mon"]) { handle.openSheet("event", id); expect(part(".ev-sessions"), id).toBe(null); handle.closeSheet(); }
      handle.setTimeOverride("2026-09-08T12:00");
      handle.openSheet("event", "x-main");
      expect(part(".ev-sessions")).toBe(null);
      expect([...part(".ev-head").children].map(c => c.id || c.className)).toEqual(["sheetTitleEvent", "ev-when", "ev-room", "ev-level", "ev-facts", "sheetGoing"]);
      handle.closeSheet();
      handle.setTimeOverride("2026-09-05T13:05");
    });
    it("a tap opens that session's sheet in this one's place, focus on its heading", () => {
      open("x-main");
      const head = part(".ev-head");
      press(links()[1]);
      expect(el("sheetWrap").hidden).toBe(false);
      expect(state.sheetId).toBe("x-sun");
      expect(part(".ev-head")).not.toBe(head);
      expect(words(part(".ev-when"))).toBe("Sunday, 2:30 PM to 3:30 PM · 1 h");
      expect(words(part(".ev-room"))).toBe("Hyatt · Inman");
      expect(document.activeElement).toBe(el("sheetTitleEvent"));
      expect(el("sheet").getAttribute("aria-labelledby")).toBe("sheetTitleEvent");
    });
    it("and Done, the backdrop and Escape then close to the screen underneath, focus on what opened the first sheet", () => {
      handle.closeSheet();
      pick(["x-main"]);
      state.mineView = "list"; state.tab = "plans"; state.plans.day = "2026-09-05"; handle.render();
      const row = () => document.querySelector('#view-plans .row[data-id="x-main"] .row-main');
      for (const close of [() => press(el("closeSheetEvent")), () => press(el("sheetBack")), escape]) {
        row().focus();
        press(row());
        press(links()[0]);
        expect(state.sheetId).toBe("x-late");
        close();
        expect(el("sheetWrap").hidden).toBe(true);
        expect(state.sheetId).toBe(null);
        expect(document.activeElement).toBe(row());
      }
      pick([]);
      state.tab = "now"; handle.render();
    });
  });

  describe("the overlap line", () => {
    const region = () => el("sheetOverlap");
    it("is always in the foot, a polite live region, and empty with nothing to overlap", () => {
      pick([]);
      open("x-main");
      expect(region().parentElement).toBe(part(".ev-foot"));
      expect(region().getAttribute("role")).toBe("status");
      expect(region().innerHTML).toBe("");
      expect(region().className).toBe("ev-overlap");
    });
    it("on an event that is not a pick: Would overlap, its title and its time as a range, quietly", () => {
      pick(["x-o1"]);
      open("x-main");
      expect(overlap()).toEqual(["Would overlap Overlap One 2:00–3:00 PM"]);
      expect(region().classList.contains("is")).toBe(false);
    });
    it("on a pick: Overlaps, as a warning", () => {
      pick(["x-main", "x-o1"]);
      open("x-main");
      expect(overlap()).toEqual(["Overlaps Overlap One 2:00–3:00 PM"]);
      expect(region().classList.contains("is")).toBe(true);
    });
    it("a second pick takes a block of its own, and a third: and, in start order", () => {
      pick(["x-main", "x-o3", "x-o1"]);
      open("x-main");
      expect(overlap()).toEqual(["Overlaps Overlap One 2:00–3:00 PM", "and Overlap Three 2:45–3:15 PM"]);
      pick(["x-o4", "x-o3", "x-o1"]);
      open("x-main");
      expect(overlap()).toEqual(["Would overlap Overlap One 2:00–3:00 PM", "and Overlap Three 2:45–3:15 PM", "and Overlap Four 3:00–4:00 PM"]);
    });
    it("three at most, then how many more, in plain words", () => {
      pick(["x-main", "x-o1", "x-o2", "x-o3", "x-o4"]);
      open("x-main");
      expect(overlap()).toEqual(["Overlaps Overlap One 2:00–3:00 PM", "and Overlap Two <b>&</b> 2:30–3:30 PM", "and Overlap Three 2:45–3:15 PM", "and 1 more"]);
      expect(parts("#sheetOverlap button")).toHaveLength(3);
      expect(part("#sheetOverlap .ov-more").matches("button")).toBe(false);
      expect(part("#sheetOverlap b")).toBe(null);
    });
    it("each block is one tap: the words and the title on its first line, the time on its second", () => {
      const block = part("#overlap-x-o1");
      expect(block.matches("button.ev-clash[data-event='x-o1']")).toBe(true);
      expect([...block.children].map(c => c.className)).toEqual(["ov-line", "ov-when"]);
      expect(words(block.querySelector(".ov-line"))).toBe("Overlaps Overlap One");
      expect(words(block.querySelector(".ov-title"))).toBe("Overlap One");
      expect(words(block.querySelector(".ov-when"))).toBe("2:00–3:00 PM");
    });
    it("a pick that only touches it, and a cancelled pick, are in no line: the row's rule", () => {
      pick(["x-main", "x-touch", "x-gone"]);
      open("x-main");
      expect(overlap()).toEqual([]);
      expect(app.overlapsOf(app.byId.get("x-main"))).toEqual([]);
    });
    it("a cancelled event has no line, picked or not", () => {
      pick(["x-main", "x-o1", "x-gone"]);
      open("x-gone");
      expect(overlap()).toEqual([]);
      pick(["x-main", "x-o1"]);
      open("x-gone");
      expect(overlap()).toEqual([]);
    });
    it("says what the row's flag says, of the same picks", () => {
      pick(["x-main", "x-o1", "x-o3"]);
      open("x-main");
      expect(parts("#sheetOverlap .ov-title").map(words)).toEqual(app.overlapsOf(app.byId.get("x-main")).map(e => e.title));
    });
    it("a tap on a block opens that pick's sheet in this one's place, which names this one back", () => {
      press(part("#overlap-x-o3"));
      expect(state.sheetId).toBe("x-o3");
      expect(words(el("sheetTitleEvent"))).toBe("Overlap Three");
      expect(document.activeElement).toBe(el("sheetTitleEvent"));
      expect(overlap()).toEqual(["Overlaps Overlap One 2:00–3:00 PM", "and Tai Chi with Erin Gray 2:30–3:30 PM"]);
    });
  });

  describe("the star's tap writes in place", () => {
    it("Would overlap becomes Overlaps at once, and back, in the region that was there", () => {
      pick(["x-o1"]);
      open("x-main");
      const region = el("sheetOverlap"), star = el("sheetStar");
      press(star);
      expect(handle.picks.get().has("x-main")).toBe(true);
      expect(el("sheetOverlap")).toBe(region);
      expect(overlap()).toEqual(["Overlaps Overlap One 2:00–3:00 PM"]);
      expect(region.classList.contains("is")).toBe(true);
      press(star);
      expect(handle.picks.get().has("x-main")).toBe(false);
      expect(overlap()).toEqual(["Would overlap Overlap One 2:00–3:00 PM"]);
      expect(region.classList.contains("is")).toBe(false);
    });
    it("the star is the same button, pressed and named anew, and focus stays on it", () => {
      const star = el("sheetStar");
      star.focus();
      press(star);
      expect(el("sheetStar")).toBe(star);
      expect([star.getAttribute("aria-pressed"), star.getAttribute("aria-label"), star.textContent]).toEqual(["true", "Remove from my schedule", "★"]);
      expect(document.activeElement).toBe(star);
      press(star);
      expect([star.getAttribute("aria-pressed"), star.getAttribute("aria-label"), star.textContent]).toEqual(["false", "Add to my schedule", "☆"]);
      expect(document.activeElement).toBe(star);
    });
    it("nothing else is drawn again: the head and the body are the nodes they were, and the body keeps its scroll", () => {
      const head = part(".ev-head"), body = part(".ev-body"), actions = part(".ev-actions"), done = el("closeSheetEvent");
      body.scrollTop = 40;
      press(el("sheetStar"));
      expect([part(".ev-head"), part(".ev-body"), part(".ev-actions"), el("closeSheetEvent")]).toEqual([head, body, actions, done]);
      expect(body.scrollTop).toBe(40);
      press(el("sheetStar"));
    });
    it("the pick is kept as it is made", () => {
      press(el("sheetStar"));
      expect(JSON.parse(window.localStorage.getItem("dc26.picks"))).toContain("x-main");
      press(el("sheetStar"));
      expect(JSON.parse(window.localStorage.getItem("dc26.picks"))).not.toContain("x-main");
    });
  });

  describe("a redraw while it is open fills the same three in place", () => {
    it("picks changed elsewhere: the star follows, where it stood stale before, and the line with it", () => {
      pick([]);
      open("x-main");
      const star = el("sheetStar"), region = el("sheetOverlap"), head = part(".ev-head");
      star.focus();
      pick(["x-main", "x-o1"]);
      expect(el("sheetStar")).toBe(star);
      expect(star.getAttribute("aria-pressed")).toBe("true");
      expect(el("sheetOverlap")).toBe(region);
      expect(overlap()).toEqual(["Overlaps Overlap One 2:00–3:00 PM"]);
      expect(part(".ev-head")).toBe(head);
      expect(document.activeElement).toBe(star);
      pick(["x-o1"]);
      expect(star.getAttribute("aria-pressed")).toBe("false");
      expect(overlap()).toEqual(["Would overlap Overlap One 2:00–3:00 PM"]);
    });
    it("nothing is written where nothing changed", () => {
      const block = part("#overlap-x-o1");
      handle.render();
      expect(part("#overlap-x-o1")).toBe(block);
    });
    it("focus on an overlapped pick that is still listed stays on it; on one that has gone, it goes to the heading", () => {
      pick(["x-o1", "x-o3"]);
      part("#overlap-x-o3").focus();
      pick(["x-o1", "x-o3", "x-o4"]);
      expect(document.activeElement).toBe(part("#overlap-x-o3"));
      pick(["x-o1"]);
      expect(part("#overlap-x-o3")).toBe(null);
      expect(document.activeElement).toBe(el("sheetTitleEvent"));
    });
    it("a sheet that is closed is left alone", () => {
      handle.closeSheet();
      const was = panel().innerHTML;
      pick(["x-main", "x-o1", "x-o3"]);
      expect(panel().innerHTML).toBe(was);
      pick([]);
    });
  });

  describe("the people", () => {
    const names = () => parts(".who-name");
    it("stand under a small With, a list that the label names", () => {
      open("x-panel");
      expect(words(part(".ev-label"))).toBe("With");
      expect(part(".who-list").getAttribute("aria-labelledby")).toBe(part(".ev-label").id);
      expect(parts(".who-list > li")).toHaveLength(5);
    });
    it("a name is the tap to that person's page, and there is no See all", () => {
      expect(names().every(b => b.matches("button"))).toBe(true);
      expect(names().map(b => b.dataset.explore).sort()).toEqual(["person:p-ann", "person:p-bo", "person:p-cy", "person:p-dee", "person:p-eve"]);
      expect(part(".see-all")).toBe(null);
      expect(words(part(".ev-people"))).not.toMatch(/See all/);
    });
    it("a person with a known-for line has a line of their own, the name and under it the line; they come first, in the listing's order", () => {
      const lined = parts(".who.lined");
      expect(lined.map(li => words(li.querySelector(".who-name")))).toEqual(["Bo Lined", "Dee Lined"]);
      expect(lined.map(li => words(li.querySelector(".who-line")))).toEqual(["Voice of the ship in Deep Space <Nine>", "Wrote the book."]);
      expect(parts(".who-list > li").slice(0, 2)).toEqual(lined);
      expect(part(".who-line").querySelector("*")).toBe(null);
    });
    it("everyone else shares one line, their names after commas, opening and", () => {
      const rest = parts(".who-list > li:not(.lined)");
      expect(rest.map(words)).toEqual(["and Ann,", "Cy,", "Eve <i> (alt: )"]);
      expect(part(".who-list i")).toBe(null);
    });
    it("a role other than Speaker or Panelist follows the name in lower case, with no parentheses of ours", () => {
      expect(parts(".who-role").map(words)).toEqual(["moderator", "judge", "(alt: )"]);
      expect(words(parts(".who.lined")[0])).toBe("Bo Lined moderator Voice of the ship in Deep Space <Nine>");
      expect(parts(".who-name .who-role")).toEqual([]);
    });
    it("with no line for anyone, the people are one line of names, with no and", () => {
      open("x-main");
      expect(parts(".who.lined")).toEqual([]);
      expect(parts(".who-list > li").map(words)).toEqual(["Erin Gray moderator"]);
      open("s0376");
      expect(parts(".who-list > li").map(words)).toEqual(["Gail Z. Martin moderator,", "K.D. Edwards,", "Keith R. A. DeCandido"]);
    });
    it("no label and no list where the listing names no one", () => {
      open("x-o1");
      expect(part(".ev-people")).toBe(null);
    });
    it("a tap on a name lands on that person's Explore page, the sheet closed behind it", () => {
      open("x-panel");
      press(names().find(b => words(b) === "Dee Lined"));
      expect(el("sheetWrap").hidden).toBe(true);
      expect([state.tab, state.explore.page]).toEqual(["explore", {kind: "person", key: "p-dee"}]);
      state.explore.page = null; app.setExploreHash(null); state.tab = "now"; handle.render();
    });
  });

  describe("a removed pick, unstarred in its sheet", () => {
    it("loses its star, which cannot be tapped again, and focus goes to the heading", async () => {
      await page.cleanup();
      const withRemoved = {...data, events: data.events.map(e => (e.id === "x-o1" ? {...e, removed: true} : e))};
      page = await bootPage({data: withRemoved});
      ({app, handle} = page);
      state = handle.state;
      pick(["x-o1", "x-main"]);
      open("x-o1");
      const star = el("sheetStar"), head = part(".ev-head");
      expect(overlap()).toEqual([]);
      star.focus();
      press(star);
      expect(handle.picks.get().has("x-o1")).toBe(false);
      expect(el("sheetStar")).toBe(star);
      expect(star.disabled).toBe(true);
      expect(part(".ev-head")).toBe(head);
      expect(document.activeElement).toBe(el("sheetTitleEvent"));
      open("x-main");
      expect(overlap()).toEqual([]);
      handle.closeSheet();
      pick([]);
    });
  });

  describe("a drag on the panel", () => {
    const touch = target => ({target, touches: [{clientY: 100}]});
    const dragging = () => el("sheetBack").classList.contains("dragging");
    const sized = (node, scroll, client) => { for (const [k, v] of [["scrollHeight", scroll], ["clientHeight", client]]) Object.defineProperty(node, k, {configurable: true, value: v}); };
    it("dismisses, as on any panel, while the panel does not scroll", () => {
      open("x-main");
      app.onSheetTouchStart(touch(el("sheetTitleEvent")));
      expect(dragging()).toBe(true);
      app.onSheetTouchCancel();
    });
    it("scrolls it, and does not dismiss, once the panel is taller than its room - as the crew panel's does", () => {
      sized(panel(), 700, 520);
      app.onSheetTouchStart(touch(el("sheetTitleEvent")));
      expect(dragging()).toBe(false);
      app.onSheetTouchStart(touch(el("sheetStar")));
      expect(dragging()).toBe(false);
      delete panel().scrollHeight; delete panel().clientHeight;
    });
    it("and one that starts in the body scrolls the body, as before", () => {
      app.onSheetTouchStart(touch(part(".ev-body p")));
      expect(dragging()).toBe(false);
      handle.closeSheet();
    });
  });
});

/* Layout is the browser's; these hold the declarations it is made of. */
describe("the event sheet's rules", () => {
  const rule = selector => {
    const at = css.indexOf(`\n${selector} {`);
    return at < 0 ? "" : css.slice(at, css.indexOf("}", at) + 1);
  };
  const px = (text, name) => Number((new RegExp(`${name}:\\s*(\\d+)px`).exec(text) || [])[1]);

  it("the sheet is at most 86% of the screen: the panel's cap is that, less the sheet's own 53px and the inset", () => {
    expect(rule("#panel-event")).toMatch(/max-height: calc\(86vh - 53px - var\(--safe-bottom\)\); max-height: calc\(86dvh - 53px - var\(--safe-bottom\)\);/);
  });
  it("and 53px is the sheet's border, its padding above, the gap under the grip and its padding below", () => {
    const sheet = rule(".sheet");
    expect(sheet).toMatch(/border: 1px solid var\(--line\); border-bottom: 0;/);
    expect(sheet).toMatch(/padding: 16px 16px calc\(20px \+ var\(--safe-bottom\)\); display: grid; gap: 16px;/);
    expect(rule(".sheet-grip")).toMatch(/height: 4px;[^}]*margin: -4px auto 0;/);
    expect(1 + 16 + 16 + 20).toBe(53);
  });
  it("the panel is a column whose head and foot keep their height, and which scrolls as one when it must", () => {
    expect(rule("#panel-event")).toMatch(/display: flex; flex-direction: column;/);
    expect(rule("#panel-event")).toMatch(/overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y;/);
    expect(rule("#panel-event > *")).toMatch(/flex: none;/);
  });
  it("the body takes what is left and scrolls, never under 4.5rem, and its old cap is off in this panel alone", () => {
    expect(rule("#panel-event > .ev-body")).toMatch(/flex: 0 1 auto; min-height: 4\.5rem; max-height: none;/);
    expect(css).toMatch(/\n\.ev-body \{ display: grid; gap: 12px; max-height: 48vh; overflow-y: auto;/);
  });
  it("nothing in the body widens it: a grid item's own minimum is off", () => {
    expect(rule("#panel-event > .ev-body > *")).toMatch(/min-width: 0;/);
    expect(rule(".ev-foot")).toMatch(/grid-template-columns: minmax\(0, 1fr\);/);
    expect(rule(".ev-overlap")).toMatch(/grid-template-columns: minmax\(0, 1fr\);/);
  });
  it("the foot is pinned to the panel's foot, over whatever scrolls under it", () => {
    expect(rule("#panel-event > .ev-foot")).toMatch(/position: sticky; bottom: 0; background: var\(--surface\);/);
  });
  it("a tap that is words is 44px tall and at least 44 wide (#66)", () => {
    const tap = rule(".ev-link, .who-name");
    expect([px(tap, "min-height"), px(tap, "min-width")]).toEqual([44, 44]);
    expect(tap).toMatch(/display: inline-flex; align-items: center;/);
  });
  it("an overlapped pick is one block of 44px, its first line cut and never wrapped", () => {
    expect(px(rule(".ev-clash"), "min-height")).toBe(44);
    expect(rule(".ev-clash")).toMatch(/display: block; width: 100%;/);
    expect(rule(".ev-clash .ov-line")).toMatch(/display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;/);
    expect(rule(".ev-clash .ov-when")).toMatch(/display: block;/);
  });
  it("the overlap line shows nothing while it is empty, is quiet before the star and a warning on a pick", () => {
    expect(rule(".ev-overlap:empty")).toMatch(/border: 0; padding: 0; margin: 0;/);
    expect(rule(".ev-overlap")).toMatch(/color: var\(--muted\);/);
    expect(rule(".ev-overlap.is")).toMatch(/color: var\(--warn\);/);
  });
  it("Sold out alone is the warning colour on the facts line, and the line may wrap", () => {
    expect(rule(".ev-facts .flag.warn")).toMatch(/color: var\(--warn\);/);
    expect(rule(".ev-facts")).toMatch(/flex-wrap: wrap;/);
  });
  it("a known-for line wraps, and a lined person is a block: the rules that styled See all and the 18+ chip are gone", () => {
    expect(rule(".who-list .who")).toMatch(/display: inline;/);
    expect(rule(".who-list .who.lined")).toMatch(/display: block;/);
    expect(css).not.toMatch(/\.see-all\b/);
    expect(css).not.toMatch(/\.tag\.adult\b/);
    expect(css).not.toMatch(/\.ev-people \.who\b/);
    expect(css).not.toMatch(/\.ev-people span\b/);
  });
  it("the sizes are in rem, so Larger text scales them", () => {
    for (const selector of [".ev-level", ".ev-facts", ".ev-sessions", ".ev-overlap", ".ev-label"]) expect(rule(selector), selector).toMatch(/font-size: [\d.]+rem/);
  });
});
