/* Crew everywhere (ROADMAP tentpole 5, step 5a; DECISIONS #10, #62, #64, #66;
   docs/screens/contract.md, sections 2, 6, 7 and 11): who's going on an
   event's sheet, Your crew right now on Now, the crew counted per hotel on
   the Map - people, not picks - and the sync redraw that reaches them: a
   crew's change pulled draws Now, the Map and Plans, the crew panel and an
   open event's who's-going line, in place, and never Search or Explore
   alone. Now and the Map give focus back to what had it through every
   redraw and every minute's tick.
   Against the fake backend, tests/helpers/backend.js, at the harness's
   Saturday, 1:05 PM. New tests, not rows of tests/PORT-LEDGER.md, so their
   titles carry no harness line.

   The sample's Saturday, as the scenes below use it:
     s0294 Westin 1:00-3:00 PM, Artemis: Bridge Crew Open Play
     s0230 Hilton 1:00-2:30 PM, Q&A: Pathfinder 2026
     s0243 Westin 1:00-2:00 PM;  s0305 the Mart 1:00-2:00 PM
     s0590 Hilton 2:30 PM;  s0376 Hyatt 2:30 PM, Writing Villains Readers Love to Hate
     s0221 Streaming 2:30 PM, Making a Living Off of Being Creative!;  s0298 the Mart 2:30 PM
     s0263 Hyatt 4:00 PM;  s0349 Westin 4:00 PM;  s0253 Marriott 4:00 PM;  s0254, s0257 Hilton 4:00 PM
     s0260 Westin 7:00 PM;  s0228 Hyatt 10:00 AM, over;  s0304 Marriott 10:00 AM, over
   and s0439, Sunday 10:00 AM at the Mart. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { fakeBackend } from "../helpers/backend.js";
import { mutationsDuring } from "../helpers/act.js";
import { YY } from "../../src/season.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(here, "..", "sample-events.json"), "utf8"));
const css = fs.readFileSync(path.join(here, "..", "..", "src", "styles.css"), "utf8").replace(/\r\n/g, "\n");
const SATURDAY = "2026-09-05T13:05";
const KEY = name => `dc${YY}.${name}`;
const read = name => JSON.parse(window.localStorage.getItem(KEY(name)));
const seed = (name, value) => window.localStorage.setItem(KEY(name), JSON.stringify(value));
const iso = ms => new Date(ms).toISOString();
function signIn(fake, user) {
  const s = fake.issue(user.id);
  seed("session", { access_token: s.access_token, refresh_token: s.refresh_token,
    user: { id: user.id, email: user.email || "", is_anonymous: user.is_anonymous } });
}
const gets = (fake, table) => fake.requests.filter(r => r.method === "GET" && r.path.startsWith(`/rest/v1/${table}?`));
/* A crewmate's star, or an unstar a second later than anything before it. */
const pick = (fake, user, id, picked = true) => fake.write(user.id, "picks", { event_id: id, picked, changed_at: iso(Date.now() + (picked ? 0 : 1000)) });

const el = id => document.getElementById(id);
const words = node => (node ? node.textContent.replace(/\s+/g, " ").trim() : "");
const tapTab = tab => document.querySelector(`.nav button[data-tab="${tab}"]`).click();
function press(node) { node.focus(); node.click(); }
const escape = () => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
const typeIn = (box, value, from, to) => { box.focus(); box.value = value; box.dispatchEvent(new Event("input", { bubbles: true })); box.setSelectionRange(from, to); };
const before = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

const now = () => el("view-now");
const crewTitle = () => [...now().querySelectorAll(".section-title")].find(t => words(t) === "Your crew right now") || null;
const lines = () => [...now().querySelectorAll(".crew-now")].map(b => words(b));
const lineOf = user => el(`crewNow-${user.id}`);
const crewPill = hotel => document.querySelector(`#view-map .map-crew[data-hotel="${hotel}"]`);
const crewPills = () => Object.fromEntries([...document.querySelectorAll("#view-map .map-crew")].map(g => [g.dataset.hotel, words(g)]));
const blockOf = hotel => document.querySelector(`#view-map .map-hotel[data-hotel="${hotel}"]`);
const num = (node, attr) => Number(node.getAttribute(attr));

/* A crew of the reader and the given crewmates, the reader signed in and
   their own stars on the server, booted on Saturday afternoon. */
async function crewScene({ mates, mine = [], theirs = {}, data, now: at }) {
  const fake = fakeBackend();
  const ada = fake.held("ada@example.test");
  const people = Object.fromEntries(mates.map(([key, name]) => [key, fake.held(`${key}@example.test`)]));
  const crew = fake.crew({ name: "The crew", creator: ada.id, members: [[ada.id, "Ada"], ...mates.map(([key, name]) => [people[key].id, name])] });
  for (const id of mine) pick(fake, ada, id);
  for (const [key, events] of Object.entries(theirs)) for (const id of events) pick(fake, people[key], id);
  signIn(fake, ada);
  seed("syncStamp", { user: ada.id, picks: null, follows: null });
  const page = await bootPage({ backend: fake, data, ...(at ? { now: at } : {}) });
  await page.app.syncSettled();
  const run = async () => { await page.app.runSync(); await page.app.syncSettled(); };
  return { page, app: page.app, handle: page.handle, fake, ada, crew, run, ...people };
}

describe("the gate: a crew's change pulled draws Now, the Map, Plans, the crew panel and an open event, and never Search or Explore alone", () => {
  let s;
  beforeAll(async () => {
    s = await crewScene({ mates: [["bo", "Bo"], ["cy", "Cy"], ["dee", "Dee"]], mine: ["s0294"], theirs: { bo: ["s0590"] } });
  }, 30000);
  afterAll(() => s.page.cleanup());

  it("on Now: a crewmate's star pulled is drawn there, with no tap", async () => {
    expect(s.handle.state.tab).toBe("now");
    expect(lines()).toEqual(["Bo · 2:30 PM Ask a NASA Scientist: The Road to Mars · Hilton"]);
    pick(s.fake, s.cy, "s0230");
    await s.run();
    expect(lines()).toEqual(["Cy · on now Q&A: Pathfinder 2026 · Hilton", "Bo · 2:30 PM Ask a NASA Scientist: The Road to Mars · Hilton"]);
  });
  it("on the Map: the crew's count, with no tap", async () => {
    tapTab("map");
    expect(crewPill("Hyatt")).toBe(null);
    pick(s.fake, s.dee, "s0376");
    await s.run();
    expect(words(crewPill("Hyatt"))).toBe("1");
  });
  it("on Plans: the crew's day, with no tap", async () => {
    tapTab("plans");
    await s.app.syncSettled();
    pick(s.fake, s.dee, "s0263");
    await s.run();
    expect(el("view-plans").querySelector(`.row[data-id="s0263"][data-list="crew:${s.dee.id}"]`)).not.toBe(null);
  });
  it("the crew panel open over Search: its members refilled", async () => {
    tapTab("browse");
    s.app.openSheet("crew", "manage");
    s.fake.rename(s.crew, s.cy.id, "Cyrus");
    await s.run();
    expect([...el("crewMembers").children].map(li => words(li))).toContain("Cyrus Remove");
    s.app.closeSheet();
  });
  it("the crew panel closed again - its panel's markup left behind the closed sheet - is no gate: Explore draws nothing", async () => {
    expect(el("sheetWrap").hidden).toBe(true);
    expect(el("panel-crew").hidden).toBe(false);
    tapTab("explore");
    const box = el("exploreQ");
    typeIn(box, "tre", 1, 2);
    pick(s.fake, s.bo, "s0304");
    await s.run();
    expect(el("exploreQ")).toBe(box);
    expect([box.value, box.selectionStart, box.selectionEnd]).toEqual(["tre", 1, 2]);
  });
  it("an event's sheet open over Search: its who's-going line, in place - the sheet not drawn again, focus where it was - and Search's box as typed", async () => {
    tapTab("browse");
    const q = el("q");
    typeIn(q, "dar", 1, 2);
    s.app.openSheet("event", "s0590");
    expect(words(el("sheetGoing"))).toBe("Going: Bo");
    const head = el("panel-event").firstElementChild, star = el("sheetStar");
    star.focus();
    pick(s.fake, s.cy, "s0590");
    await s.run();
    expect(words(el("sheetGoing"))).toBe("Going: Bo, Cyrus");
    expect(el("panel-event").firstElementChild).toBe(head);
    expect(document.activeElement).toBe(star);
    escape();
    expect(el("q")).toBe(q);
    expect(q.value).toBe("dar");
  });
  it("an event's sheet open over Explore: Explore is drawn again behind it, and its filter box keeps the text typed in it", async () => {
    tapTab("explore");
    const box = el("exploreQ");
    typeIn(box, "sta", 3, 3);
    s.app.openSheet("event", "s0590");
    pick(s.fake, s.dee, "s0590");
    await s.run();
    expect(words(el("sheetGoing"))).toBe("Going: Bo, Cyrus, Dee");
    expect(el("exploreQ")).not.toBe(box);
    expect(el("exploreQ").value).toBe("sta");
    expect(s.handle.state.explore.q).toBe("sta");
    escape();
    expect(el("exploreQ").value).toBe("sta");
  });
  it("Search alone: nothing drawn, and its box keeps its text, its focus and its caret", async () => {
    tapTab("browse");
    await s.page.until(() => s.app.index, 10000, "the search index");
    const q = el("q");
    typeIn(q, "dark", 1, 3);
    s.handle.render();                        // the typing's own draw, now rather than after its pause
    q.setSelectionRange(1, 3);
    const marker = el("browseRest").firstElementChild;
    pick(s.fake, s.bo, "s0263");
    await s.run();
    expect(el("browseRest").firstElementChild).toBe(marker);
    expect(document.activeElement).toBe(q);
    expect([q.value, q.selectionStart, q.selectionEnd]).toEqual(["dark", 1, 3]);
  });
  it("Explore alone: nothing drawn, and its filter box keeps its text, its focus and its caret", async () => {
    tapTab("explore");
    const box = el("exploreQ");
    typeIn(box, "star", 1, 2);
    pick(s.fake, s.bo, "s0349");
    await s.run();
    expect(el("exploreQ")).toBe(box);
    expect(document.activeElement).toBe(box);
    expect([box.value, box.selectionStart, box.selectionEnd]).toEqual(["star", 1, 2]);
  });
  it("the crews forgotten - another tab signed out - take the section off Now, with no tap, and the counts off the Map", async () => {
    tapTab("now");
    expect(crewTitle()).not.toBe(null);
    window.localStorage.removeItem(KEY("session"));
    await s.run();
    expect(crewTitle()).toBe(null);
    expect(now().querySelector(".crew-now")).toBe(null);
    tapTab("map");
    expect(document.querySelector("#view-map .map-crew")).toBe(null);
    expect(blockOf("Hyatt").getAttribute("aria-label")).toBe("Hyatt: no picks on Saturday");
  });
});

describe("who's going (W22): a line on the event's sheet", () => {
  let s;
  const data = structuredClone(fixture);
  for (const e of data.events) {
    if (e.id === "s0257") e.removed = true;
    if (e.id === "s0254") e.cancelled = true;
  }
  const going = id => { s.app.openSheet("event", id); const line = el("sheetGoing"); return [words(line), line.hidden]; };
  beforeAll(async () => {
    s = await crewScene({
      data,
      mates: [["bo", "Bo"], ["cy", "Cy"], ["dee", "Dee"], ["eve", "Eve"], ["fay", "Fay"], ["zo", "Zo <i>&\"'"]],
      mine: ["s0590"],
      theirs: {
        bo: ["s0590", "s0376", "s0263", "s0349", "s0257", "s0254"], cy: ["s0376", "s0263", "s0349"], dee: ["s0376", "s0263", "s0349"],
        eve: ["s0263", "s0349"], fay: ["s0349"], zo: ["s0349", "s0260"],
      },
    });
  }, 30000);
  afterAll(() => s.page.cleanup());

  it("no one: the line is there, empty and hidden", () => {
    expect(going("s0228")).toEqual(["", true]);
    expect(el("sheetGoing").closest(".ev-head")).not.toBe(null);
  });
  it("one, two and three by name; then three and how many more, with no comma", () => {
    expect(going("s0590")).toEqual(["Going: Bo", false]);
    expect(going("s0376")).toEqual(["Going: Bo, Cy, Dee", false]);
    expect(going("s0263")).toEqual(["Going: Bo, Cy, Dee and 1 more", false]);
    expect(going("s0349")).toEqual(["Going: Bo, Cy, Dee and 3 more", false]);
  });
  it("never the reader, whose own star says so", () => {
    expect(s.handle.picks.get().has("s0590")).toBe(true);
    expect(going("s0590")[0]).toBe("Going: Bo");
  });
  it("a name is someone's own text: escaped", () => {
    expect(going("s0260")).toEqual(["Going: Zo <i>&\"'", false]);
    expect(el("sheetGoing").querySelector("i")).toBe(null);
  });
  it("a removed event has none, though a crewmate's picks hold it; a cancelled one has its line", () => {
    expect(going("s0257")).toEqual(["", true]);
    expect(going("s0254")).toEqual(["Going: Bo", false]);
  });
  it("a star in the sheet draws it again, the line with it", () => {
    going("s0376");
    el("sheetStar").click();
    expect(words(el("sheetGoing"))).toBe("Going: Bo, Cy, Dee");
    el("sheetStar").click();
  });
  it("pulled while it is open: the line changes in place, focus stays where it was, and the last unstar hides it", async () => {
    going("s0228");
    const head = el("panel-event").firstElementChild, star = el("sheetStar");
    star.focus();
    pick(s.fake, s.eve, "s0228");
    await s.run();
    expect([words(el("sheetGoing")), el("sheetGoing").hidden]).toEqual(["Going: Eve", false]);
    expect(el("panel-event").firstElementChild).toBe(head);
    expect(document.activeElement).toBe(star);
    pick(s.fake, s.eve, "s0228", false);
    await s.run();
    expect([words(el("sheetGoing")), el("sheetGoing").hidden]).toEqual(["", true]);
    expect(document.activeElement).toBe(star);
    s.app.closeSheet();
  });
});

describe("your crew right now (W23): a section of Now, between the hero and Rest of your day", () => {
  let s;
  beforeAll(async () => {
    s = await crewScene({
      mates: [["bo", "Bo"], ["cy", "Cy"], ["dee", "Dee"], ["eve", "Eve"], ["fay", "Fay"], ["gus", "Gus"], ["hal", "Hal"]],
      mine: ["s0294", "s0376"],
      /* hal's s0027 is on at the preview's made-up moment, Thursday 10 AM */
      theirs: { bo: ["s0294"], cy: ["s0230", "s0590"], dee: ["s0376"], eve: ["s0221"], fay: ["s0349"], gus: ["s0304"], hal: ["s0439", "s0027"] },
    });
  }, 30000);
  afterAll(() => s.page.cleanup());

  it("between the hero and Rest of your day, and before On now and in the next hour", () => {
    const titles = [...now().querySelectorAll(".section-title")];
    const rest = titles.find(t => words(t).startsWith("Rest of your day")), around = titles.find(t => words(t).startsWith("On now and in the next hour"));
    expect(before(now().querySelector(".hero"), crewTitle())).toBe(true);
    expect(before(crewTitle(), rest)).toBe(true);
    expect(before(el("crewMore"), rest)).toBe(true);
    expect(before(rest, around)).toBe(true);
  });
  it("a line a crewmate: on now first, then by start, then by name; on now or the start, with you, the title and the place - four, then how many more", () => {
    expect(lines()).toEqual([
      "Bo · on now · with you Artemis: Bridge Crew Open Play · Westin",
      "Cy · on now Q&A: Pathfinder 2026 · Hilton",
      "Dee · 2:30 PM · with you Writing Villains Readers Love to Hate · Hyatt",
      "Eve · 2:30 PM Making a Living Off of Being Creative! · Streaming",
    ]);
    expect(words(el("crewMore"))).toBe("+1 more");
    expect(el("crewMore").getAttribute("aria-label")).toBe("+1 more of your crew, in Plans");
    expect(lineOf(s.fay)).toBe(null);
  });
  it("a crewmate whose picks today are over, or on another day, has no line", () => {
    expect([lineOf(s.gus), lineOf(s.hal)]).toEqual([null, null]);
  });
  it("each line is a button to its event's sheet, labelled by what it says, and \"with you\" is the reader's gold", () => {
    const bo = lineOf(s.bo);
    expect(bo.tagName).toBe("BUTTON");
    expect([bo.dataset.hero, bo.getAttribute("aria-haspopup")]).toEqual(["s0294", "dialog"]);
    expect(bo.querySelector(".cn-with").textContent).toBe("with you");
    expect(lineOf(s.cy).querySelector(".cn-with")).toBe(null);
    expect(css).toMatch(/\.crew-now \.cn-with \{[^}]*color: var\(--gold\)/);
  });
  it("a line opens its event's sheet, and Escape gives focus back to that line - not to the hero, on the same event", () => {
    press(lineOf(s.bo));
    expect(s.handle.state.sheetId).toBe("s0294");
    expect(document.activeElement).toBe(el("sheetTitleEvent"));
    escape();
    expect(document.activeElement).toBe(lineOf(s.bo));
  });
  it("a crew's change pulled draws it again, focus kept on the line that had it", async () => {
    const cy = lineOf(s.cy);
    cy.focus();
    pick(s.fake, s.gus, "s0263");
    await s.run();
    expect(lineOf(s.cy)).not.toBe(cy);
    expect(document.activeElement).toBe(lineOf(s.cy));
  });
  it("and on a row's star, a chip and the nudge's button: whatever had focus on Now has it again", async () => {
    const star = () => now().querySelector('.row[data-id="s0376"][data-list="next"] .star');
    star().focus();
    pick(s.fake, s.gus, "s0263", false);
    await s.run();
    expect(document.activeElement).toBe(star());
    const chip = () => now().querySelector('[data-chip="now-hotel"][data-value="All"]');
    chip().focus();
    pick(s.fake, s.hal, "s0263");
    await s.run();
    expect(document.activeElement).toBe(chip());
    const later = () => now().querySelector('[data-act="nudge-later"]');
    later().focus();
    pick(s.fake, s.gus, "s0254");
    await s.run();
    expect(document.activeElement).toBe(later());
    pick(s.fake, s.gus, "s0254", false);
    await s.run();
  });
  it("the hero's own refresh at the minute - its ring moved, nothing else - is written into it in place: focus never moves", () => {
    const hero = now().querySelector(".hero"), cy = lineOf(s.cy), ring = hero.querySelector(".prog").getAttribute("stroke-dashoffset");
    hero.focus();
    s.app.setOverride("2026-09-05T13:06");
    s.app.tickNow();
    expect(now().querySelector(".hero")).toBe(hero);
    expect(hero.querySelector(".prog").getAttribute("stroke-dashoffset")).not.toBe(ring);
    expect(lineOf(s.cy)).toBe(cy);
    expect(document.activeElement).toBe(hero);
    s.handle.setTimeOverride(SATURDAY);
  });
  it("the hero kept by its place: when the pick it shows ends at the tick, focus is on the hero that follows", () => {
    now().querySelector(".hero").focus();
    s.app.setOverride("2026-09-05T15:01");
    s.app.tickNow();
    expect(now().querySelector(".hero").dataset.hero).toBe("s0376");
    expect(document.activeElement).toBe(now().querySelector(".hero"));
    s.handle.setTimeOverride(SATURDAY);
  });
  it("a hero's sheet closed after its pick was unstarred there: focus on the hero that follows, never on a crewmate's line for that event", () => {
    press(now().querySelector(".hero"));
    expect(s.handle.state.sheetId).toBe("s0294");
    el("sheetStar").click();
    escape();
    expect(document.activeElement).toBe(now().querySelector(".hero"));
    expect(now().querySelector(".hero").dataset.hero).toBe("s0376");
    expect(lineOf(s.bo).dataset.hero).toBe("s0294");
    s.handle.picks.set(["s0294", "s0376"]);
    s.handle.render();
  });
  it("the tick draws Now again when only the crew has moved - a line added under it - and a quiet tick after it, nothing", () => {
    const kept = read("crewPicks"), hero = now().querySelector(".hero");
    seed("crewPicks", { ...kept, [s.gus.id]: { ...kept[s.gus.id], s0230: true } });
    s.app.tickNow();
    expect(lineOf(s.gus)).not.toBe(null);
    expect(now().querySelector(".hero")).not.toBe(hero);
    const drawn = lineOf(s.gus);
    s.app.tickNow();
    expect(lineOf(s.gus)).toBe(drawn);
    seed("crewPicks", kept);
    s.handle.render();
  });
  it("the minute tick: a line moves from next to on now, focus kept on it; a quiet minute draws nothing", () => {
    const dee = lineOf(s.dee);
    dee.focus();
    s.app.setOverride("2026-09-05T14:31");
    s.app.tickNow();
    expect(words(lineOf(s.dee))).toBe("Dee · on now · with you Writing Villains Readers Love to Hate · Hyatt");
    expect(lineOf(s.dee)).not.toBe(dee);
    expect(document.activeElement).toBe(lineOf(s.dee));
    expect(words(lineOf(s.cy))).toBe("Cy · on now Ask a NASA Scientist: The Road to Mars · Hilton");
    const settled = lineOf(s.dee);
    s.app.tickNow();
    expect(lineOf(s.dee)).toBe(settled);
  });
  it("and a pick that ends takes its line, or moves it on to the next", () => {
    s.app.setOverride("2026-09-05T15:31");
    s.app.tickNow();
    expect(lineOf(s.bo)).toBe(null);
    expect(words(lineOf(s.fay))).toBe("Fay · 4:00 PM Artemis: Bridge Crew Open Play · Westin");
    s.handle.setTimeOverride(SATURDAY);
  });
  it("+N more: Plans' crew's day on today, as a tap on Crew has it - saved, a sync run - with focus on the Crew segment", async () => {
    await s.app.syncSettled();
    s.handle.state.plans.day = "2026-09-04";
    const reads = gets(s.fake, "crews").length, main = document.querySelector("main");
    main.scrollTop = 300;
    press(el("crewMore"));
    expect(s.handle.state.tab).toBe("plans");
    expect(main.scrollTop).toBe(0);
    expect(el("plansViewCrew").getAttribute("aria-pressed")).toBe("true");
    expect(read("plansView")).toBe("crew");
    expect(s.handle.state.plans.day).toBe(null);
    expect([...el("view-plans").querySelectorAll('[data-chip="plans-day"][aria-pressed="true"]')].map(c => c.dataset.value)).toEqual(["2026-09-05"]);
    expect(document.activeElement).toBe(el("plansViewCrew"));
    await s.app.syncSettled();
    expect(gets(s.fake, "crews").length).toBe(reads + 1);
    expect(document.activeElement).toBe(el("plansViewCrew"));
    tapTab("now");
    await s.app.syncSettled();
  });
  it("exactly four: no more to show", async () => {
    pick(s.fake, s.hal, "s0263");
    await s.run();
    expect(words(el("crewMore"))).toBe("+2 more");
    pick(s.fake, s.fay, "s0349", false);
    pick(s.fake, s.hal, "s0263", false);
    await s.run();
    expect(lines().length).toBe(4);
    expect(el("crewMore")).toBe(null);
    pick(s.fake, s.fay, "s0349");
    await s.run();
  });
  it("no hero: after the line that says so - and after the reader's next pick, on another day", () => {
    const own = s.handle.picks.get();
    s.handle.picks.set([]);
    s.handle.render();
    expect(before(now().querySelector(".empty"), crewTitle())).toBe(true);
    s.handle.picks.set(["s0439"]);
    s.handle.render();
    expect(words(now().querySelector(".empty"))).toMatch(/Your next pick is on Sunday/);
    expect(before(now().querySelector('.row[data-id="s0439"]'), crewTitle())).toBe(true);
    s.handle.picks.set([...own]);
    s.handle.render();
  });
  it("only while the clock is inside the con: not in the preview before it - Wednesday's afternoon included - and not after it", () => {
    for (const moment of ["2026-09-01T12:00", "2026-09-02T17:00", "2026-09-20T12:00"]) {
      s.handle.setTimeOverride(moment);
      expect(crewTitle(), moment).toBe(null);
      expect(now().querySelector(".crew-now"), moment).toBe(null);
    }
    s.handle.setTimeOverride(SATURDAY);
    expect(crewTitle()).not.toBe(null);
  });
  it("nobody with anything left today: no section", () => {
    s.handle.setTimeOverride("2026-09-05T21:00");
    expect(crewTitle()).toBe(null);
    s.handle.setTimeOverride(SATURDAY);
  });
});

describe("your crew right now: removed and unknown picks skipped, offsite places named as the Map names them", () => {
  let s;
  const data = structuredClone(fixture);
  for (const e of data.events) {
    if (e.id === "s0243") e.removed = true;
    if (e.id === "s0305") Object.assign(e, { hotel: "Other", room: "O Joystick Gamebar" });
    if (e.id === "s0298") Object.assign(e, { hotel: "Other", room: "" });
    if (e.id === "s0230") e.cancelled = true;
    if (e.id === "s0349") e.title = "<i>Artemis</i> & \"friends\"";
  }
  beforeAll(async () => {
    s = await crewScene({ data, mates: [["bo", "Bo"], ["cy", "Cy"], ["dee", "Dee"], ["eve", "Eve"], ["fay", "Fay"], ["zo", "Zo <i>&\"'"]],
      theirs: { bo: ["s0243"], cy: ["no-such-event"], dee: ["s0305"], eve: ["s0298"], fay: ["s0230"], zo: ["s0349"] } });
  }, 30000);
  afterAll(() => s.page.cleanup());

  it("a removed pick and one this schedule does not hold give no line; an offsite one is named by its room, else offsite; a cancelled one stays, as the reader's own hero keeps one", () => {
    expect(lines()).toEqual([
      "Dee · on now Fan Panel: Cosplay Armor 101 · Joystick Gamebar",
      "Fay · on now Q&A: Pathfinder 2026 · Hilton",
      "Eve · 2:30 PM Q&A: Cyberpunk · offsite",
      "Zo <i>&\"' · 4:00 PM <i>Artemis</i> & \"friends\" · Westin",
    ]);
  });
  it("a crewmate's name and an event's title are someone's own text: escaped on the line", () => {
    expect(lineOf(s.zo).querySelector("i")).toBe(null);
    expect(lineOf(s.zo).querySelector(".cn-who").textContent).toBe("Zo <i>&\"'");
  });
  it("the Map's On now line names it the same way", () => {
    s.handle.picks.set(["s0305"]);
    tapTab("map");
    expect(words(document.querySelector("#view-map .next-on"))).toMatch(/· Joystick Gamebar$/);
    s.handle.picks.set([]);
    tapTab("now");
  });
});

describe("your crew right now and the clock: the minute tick on the crew alone, and the con day past midnight", () => {
  let s;
  beforeAll(async () => {
    /* No picks of the reader's: no hero, no nudge - only the crew can move. */
    s = await crewScene({ now: "2026-09-05T14:29", mates: [["bo", "Bo"]], theirs: { bo: ["s0590", "s0424", "s0439"] } });
  }, 30000);
  afterAll(() => s.page.cleanup());

  it("a line going from next to on now redraws Now at the tick, when nothing else on the tab has moved", () => {
    const park = [...now().querySelectorAll('[data-chip="now-hotel"]')].find(c => /Hardy/.test(c.dataset.value));
    park.click();
    expect(now().querySelector(".list.compact .row")).toBe(null);
    expect(words(lineOf(s.bo))).toBe("Bo · 2:30 PM Ask a NASA Scientist: The Road to Mars · Hilton");
    s.app.setOverride("2026-09-05T14:30");
    s.app.tickNow();
    expect(words(lineOf(s.bo))).toBe("Bo · on now Ask a NASA Scientist: The Road to Mars · Hilton");
  });
  it("after midnight, still Saturday's con day: the next pick that night, not tomorrow morning's", () => {
    s.handle.setTimeOverride("2026-09-06T00:30");
    expect(words(lineOf(s.bo))).toMatch(/^Bo · 1:00 AM .* · Mart$/);
  });
});

describe("the Map: the crew counted per hotel - people, not picks", () => {
  let s;
  const FRIDAY_HYATT = fixture.events.find(e => e.start.startsWith("2026-09-04T1") && e.hotel === "Hyatt").id;
  const data = structuredClone(fixture);
  for (const e of data.events) {
    if (e.id === "s0257") e.removed = true;
    if (e.id === "s0254") e.cancelled = true;
  }
  beforeAll(async () => {
    s = await crewScene({
      data,
      mates: [["bo", "Bo"], ["cy", "Cy"], ["dee", "Dee"]],
      mine: ["s0294", "s0349", "s0439"],
      theirs: { bo: ["s0376", "s0263", "s0221", "s0257"], cy: ["s0228", FRIDAY_HYATT, "s0254"], dee: ["s0590"] },
    });
    tapTab("map");
  }, 30000);
  afterAll(() => s.page.cleanup());

  it("one count a hotel of the crewmates with a pick there that day: two picks are one person, a stream is on no hotel, a removed event is no one's, a cancelled one counts, and none at zero", () => {
    expect(crewPills()).toEqual({ Hyatt: "2", Hilton: "2" });
    expect(words(document.querySelector('#view-map .map-pill[data-hotel="Westin"]'))).toBe("2");
  });
  it("the hotel's label says how many of the crew; one with none says nothing of the crew - and the pill itself is hidden from screen readers", () => {
    expect(blockOf("Hyatt").getAttribute("aria-label")).toBe("Hyatt: no picks on Saturday, 2 of your crew");
    expect(blockOf("Hilton").getAttribute("aria-label")).toBe("Hilton: no picks on Saturday, 2 of your crew");
    expect(blockOf("Westin").getAttribute("aria-label")).toBe("Westin: 2 picks on Saturday");
    expect(crewPill("Hyatt").getAttribute("aria-hidden")).toBe("true");
  });
  it("on the block's bottom-right corner, ending 9 past it - under the park's, too short for it - drawn over the rings, and not a gold pill", async () => {
    const rect = crewPill("Hyatt").querySelector("rect"), block = blockOf("Hyatt").querySelector("rect");
    expect(num(rect, "x") + num(rect, "width")).toBe(num(block, "x") + num(block, "width") + 9);
    expect(num(rect, "y") + num(rect, "height") / 2).toBe(num(block, "y") + num(block, "height") - 2);
    expect(crewPill("Hyatt").classList.contains("map-pill")).toBe(false);
    expect(crewPill("Hyatt").querySelectorAll("circle, path").length).toBe(2);
    pick(s.fake, s.dee, "s0234");
    await s.run();
    const park = crewPill("Hardy Ivy Park").querySelector("rect"), lawn = blockOf("Hardy Ivy Park").querySelector("rect");
    expect(num(park, "y")).toBe(num(lawn, "y") + num(lawn, "height") - 2);
    pick(s.fake, s.dee, "s0234", false);
    await s.run();
    const order = [...document.querySelectorAll("#view-map svg.map > *")].map(n => n.getAttribute("class") || "");
    expect(order.findIndex(c => c.startsWith("map-ring"))).toBeLessThan(order.findIndex(c => c === "map-crew"));
  });
  it("another day's chip: that day's crew", () => {
    document.querySelector('#view-map [data-chip="map-day"][data-value="2026-09-04"]').click();
    expect(crewPills()).toEqual({ Hyatt: "1" });
    document.querySelector('#view-map [data-chip="map-day"][data-value="2026-09-05"]').click();
    expect(crewPills()).toEqual({ Hyatt: "2", Hilton: "2" });
  });
  it("a tap on it opens the hotel's sheet, as the gold pill's does", () => {
    crewPill("Hilton").querySelector("rect").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(s.handle.state.sheetHotel).toBe("Hilton");
    escape();
    expect(s.handle.state.sheetHotel).toBe(null);
  });
  it("a crew's change pulled draws it again, focus kept on the hotel that had it", async () => {
    const hyatt = blockOf("Hyatt");
    hyatt.focus();
    pick(s.fake, s.dee, "s0376");
    await s.run();
    expect(words(crewPill("Hyatt"))).toBe("3");
    expect(blockOf("Hyatt")).not.toBe(hyatt);
    expect(document.activeElement).toBe(blockOf("Hyatt"));
  });
  it("the minute tick: a redraw when the pick on now ends keeps focus on the hotel; the card's own refresh is written into it in place", () => {
    blockOf("Hyatt").focus();
    s.app.setOverride("2026-09-05T15:01");
    expect(s.app.tickMap()).toBe(true);
    expect(document.activeElement).toBe(blockOf("Hyatt"));
    const card = document.querySelector("#view-map .next-card"), svg = document.querySelector("#view-map svg.map");
    card.focus();
    s.app.setOverride("2026-09-05T15:02");
    expect(s.app.tickMap()).toBe(true);
    expect(document.querySelector("#view-map svg.map")).toBe(svg);
    expect(document.querySelector("#view-map .next-card")).toBe(card);
    expect(words(card)).toMatch(/in 58 min/);
    expect(document.activeElement).toBe(card);
    s.handle.setTimeOverride(SATURDAY);
  });
  it("the card kept by its place: when the event it shows changes, focus is on the card that follows - and a minute that changes nothing on it changes nothing", () => {
    document.querySelector("#view-map .next-card").focus();
    s.app.setOverride("2026-09-05T16:01");
    s.app.tickMap();
    expect(document.querySelector("#view-map .next-card").dataset.hero).toBe("s0439");
    expect(document.activeElement).toBe(document.querySelector("#view-map .next-card"));
    const under = el("mapUnder");
    const changes = mutationsDuring(under, () => { s.app.setOverride("2026-09-05T16:02"); s.app.tickMap(); });
    expect(changes).toEqual([]);
    s.handle.setTimeOverride(SATURDAY);
  });
  it("its signature takes the crew's counts: a count changed under it draws the map again at the tick, and a quiet tick nothing", () => {
    expect(s.app.tickMap()).toBe(false);
    const kept = read("crewPicks");
    seed("crewPicks", { ...kept, [s.dee.id]: { ...kept[s.dee.id], s0253: true } });
    expect(s.app.tickMap()).toBe(true);
    expect(words(crewPill("Marriott"))).toBe("1");
    expect(s.app.tickMap()).toBe(false);
    seed("crewPicks", kept);
    s.handle.render();
  });
  it("ten of the crew at the Hilton: a wider count, nine and ten apart, still inside the map", async () => {
    const more = Array.from({ length: 8 }, (_, i) => s.fake.held(`mate${i}@example.test`));
    for (const [i, mate] of more.entries()) { s.fake.join(s.crew, mate.id, `Mate ${i}`); pick(s.fake, mate, "s0590"); }
    await s.run();
    const rect = () => crewPill("Hilton").querySelector("rect");
    expect([words(crewPill("Hilton")), num(rect(), "width")]).toEqual(["10", 40]);
    expect(num(rect(), "x") + num(rect(), "width")).toBe(376);
    pick(s.fake, more[0], "s0590", false);
    await s.run();
    expect([words(crewPill("Hilton")), num(rect(), "width")]).toEqual(["9", 32]);
  });
});

describe("a build with no backend: none of it, whatever a build with one kept", () => {
  let page, app;
  beforeAll(async () => {
    const mate = "00000000-0000-4000-8000-000000000002";
    seed("session", { access_token: "x", refresh_token: "y", user: { id: "00000000-0000-4000-8000-000000000001", email: "", is_anonymous: true } });
    seed("crew", [{ id: "c1", name: "The crew", creator: "00000000-0000-4000-8000-000000000001", invite_token: "t",
      members: [{ user_id: "00000000-0000-4000-8000-000000000001", display_name: "Ada" }, { user_id: mate, display_name: "Bo" }] }]);
    seed("crewPicks", { [mate]: { s0230: true, s0376: true } });
    seed("picks", ["s0294"]);
    page = await bootPage();
    ({ app } = page);
  }, 30000);
  afterAll(() => page.cleanup());

  it("no section on Now, no crew on the Map, no one going on the sheet", () => {
    expect(crewTitle()).toBe(null);
    expect(now().querySelector(".crew-now")).toBe(null);
    tapTab("map");
    expect(document.querySelector("#view-map .map-crew")).toBe(null);
    expect(blockOf("Hyatt").getAttribute("aria-label")).toBe("Hyatt: no picks on Saturday");
    app.openSheet("event", "s0376");
    expect([words(el("sheetGoing")), el("sheetGoing").hidden]).toEqual(["", true]);
    app.closeSheet();
  });
});

describe("#66: 44px, labels, and contrast for the crew's count on the Map", () => {
  const rule = selector => { const at = css.indexOf(`\n${selector} {`); return at < 0 ? "" : css.slice(at, css.indexOf("}", at)); };
  /* WCAG's contrast, and the map's block fills as styles.css mixes them. */
  const token = name => new RegExp(`--${name}: (#[0-9A-Fa-f]{6})`).exec(css)[1];
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const mix = (hue, p) => rgb(token(hue)).map((v, i) => Math.round(v * p + rgb(token("surface"))[i] * (1 - p)));

  it("each line on Now and +N more are 44px or taller; the line's sizes follow Larger text", () => {
    expect(rule(".crew-now")).toContain("min-height: 44px");
    expect(rule(".crew-now:focus-visible")).toContain("outline-offset: -3px");
    expect(css).toMatch(/\n\.btn \{[^}]*height: 46px/);
    for (const part of [".crew-now .cn-top", ".crew-now .cn-what", ".ev-going"]) expect(rule(part), part).toMatch(/font-size: [\d.]+rem/);
  });
  it("the count is not gold: an outline of the light text on the darkest fill, its number in the map's own units", () => {
    expect(rule(".map-crew rect")).toMatch(/fill: var\(--ink\); stroke: var\(--text\)/);
    expect(rule(".map-crew text")).toMatch(/font-size: 11px[^}]*fill: var\(--text\)/);
    expect(rule(".map-crew circle, .map-crew path")).toContain("fill: var(--text)");
    expect(css).not.toMatch(/\.map-crew[^{]*\{[^}]*--gold/);
  });
  it("its number reads at 4.5:1 or more on its fill, and its outline at 3:1 or more against every block and the ground - the app's one theme", () => {
    const text = rgb(token("text"));
    expect(contrast(text, rgb(token("ink")))).toBeGreaterThanOrEqual(4.5);
    const grounds = [rgb(token("surface")), ...["Marriott", "Hyatt", "Hilton", "Courtland", "Westin", "Mart"].map(h => mix(`h-${h}`, 0.18)), mix("park", 0.12)];
    for (const fill of grounds) expect(contrast(text, fill)).toBeGreaterThanOrEqual(3);
  });
});
