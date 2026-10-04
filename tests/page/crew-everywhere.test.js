/* Crew everywhere (ROADMAP tentpole 5, step 5a; DECISIONS #10, #62, #64, #66;
   docs/screens/contract.md, sections 2, 6, 7 and 11): who starred an
   event on its sheet, Your crew's picks right now on Now, the crew counted
   per hotel on
   the Map - people, not picks - and the sync redraw that reaches them: a
   crew's change pulled is a redraw on any tab (DECISIONS #80) - Now, the
   Map and Plans, the crew panel and an open event's who's-going line, in
   place - and Search and Explore are drawn again, each with its box
   kept. Now and the Map give focus back to what had it through every
   redraw and every minute's tick. And step 5c (contract, section 8): the
   hotel sheet's crew, Your crew's picks here, its lines Now's, refilled in place
   by a pull, on the day the sheet was drawn for.
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
/* What a whole draw of a tab replaces, and typing's own draw does not:
   Explore's first jump chip. And Search's first node under its box. A draw
   happened when the node kept from before is off the page and another
   stands in its place. */
const jumpChip = () => document.querySelector('#view-explore [data-act="explore-jump"]');
const listTop = () => el("browseRest").firstElementChild;
const replaced = (marker, again) => !marker.isConnected && again() !== null && again() !== marker;

const now = () => el("view-now");
const crewTitle = () => [...now().querySelectorAll(".section-title")].find(t => words(t) === "Your crew's picks right now") || null;
const lines = () => [...now().querySelectorAll(".crew-now")].map(b => words(b));
const lineOf = user => el(`crewNow-${user.id}`);
const crewPill = hotel => document.querySelector(`#view-map .map-crew[data-hotel="${hotel}"]`);
const crewPills = () => Object.fromEntries([...document.querySelectorAll("#view-map .map-crew")].map(g => [g.dataset.hotel, words(g)]));
const blockOf = hotel => document.querySelector(`#view-map .map-hotel[data-hotel="${hotel}"]`);
const num = (node, attr) => Number(node.getAttribute(attr));
const cssRule = selector => { const at = css.indexOf(`\n${selector} {`); return at < 0 ? "" : css.slice(at, css.indexOf("}", at)); };
/* Markup as the page holds it once parsed, to set beside what the page drew. */
const parsed = html => { const holder = document.createElement("div"); holder.innerHTML = html; return holder.innerHTML; };

/* The crew line on Now as it was before step 5c moved it to ui.js, word
   for word but for step 5d's "yours too" (#68) and the row's span that keeps
   the start on one line (#73): what Now must still draw. */
function crewLineBefore(app, mine, c) {
  const ev = c.ev, withYou = mine.has(ev.id) ? ` &middot; <span class="cn-with">yours too</span>` : "";
  return `<li><button class="crew-now" id="crewNow-${app.esc(c.user_id)}" data-hero="${app.esc(ev.id)}" aria-haspopup="dialog">
    <span class="cn-top"><b class="cn-who">${app.esc(c.display_name)}</b> &middot; <span class="cn-when">${c.on ? "on now" : app.fmtShort(ev._s)}</span>${withYou}</span>
    <span class="cn-what"><span class="cn-title">${app.esc(ev.title)}</span><span class="cn-where" style="--h:var(${app.hotelVar(ev.hotel)})">&nbsp;&middot; ${app.esc(app.placeShort(ev))}</span></span>
  </button></li>`;
}
/* Now's lines, as Now draws them and as the shared builder makes them, beside next's. */
function nowLinesAsBefore(s) {
  const at = s.app.now(), mine = s.handle.picks.get(), crew = s.app.crewRightNow(s.app.events, at, s.app.conDayKey(at)).slice(0, 4);
  for (const c of crew) {
    expect(s.app.crewLineHTML(`crewNow-${c.user_id}`, c.display_name, c.on ? "on now" : s.app.fmtShort(c.ev._s), c.ev, s.app.placeShort(c.ev)))
      .toBe(crewLineBefore(s.app, mine, c));
  }
  expect(now().querySelector(".crew-now-list").innerHTML).toBe(parsed(crew.map(c => crewLineBefore(s.app, mine, c)).join("")));
  return crew.length;
}

/* The hotel sheet (step 5c). */
const hotelPanel = () => el("panel-hotel");
const hereButtons = () => [...hotelPanel().querySelectorAll(".crew-now")];
const hereLines = () => hereButtons().map(b => words(b));
const hotelHead = () => words(hotelPanel().querySelector(".ev-when"));
const hereOf = (user, id) => el(`crewHere-${user.id}-${id}`);
const openHotel = hotel => blockOf(hotel).dispatchEvent(new MouseEvent("click", { bubbles: true }));
const tapDay = day => document.querySelector(`#view-map [data-chip="map-day"][data-value="${day}"]`).click();
/* What changes under a container while an awaited `during` runs. */
async function mutationsAcross(container, during) {
  const seen = [], observer = new MutationObserver(records => seen.push(...records));
  observer.observe(container, { childList: true, subtree: true, attributes: true, characterData: true });
  await during();
  seen.push(...observer.takeRecords());
  observer.disconnect();
  return seen;
}
/* next's hotel sheet before step 5c, word for word: what a sheet with none
   of the crew must still draw. */
function hotelSheetBefore(app, mine, hotel, day) {
  const { esc, DAY_LONG, rowHTML, hotelPhrase } = app;
  const rows = app.events.filter(e => mine.has(e.id) && e.hotel === hotel && e._cd === day), dayName = DAY_LONG[day] || day;
  const count = rows.length ? `${rows.length} pick${rows.length === 1 ? "" : "s"}` : "no picks";
  const body = rows.length
    ? `<div class="ev-body"><ul class="list compact">${rows.map(ev => rowHTML(ev, {list: "map"})).join("")}</ul></div>`
    : `<div class="ev-body"><p style="color:var(--muted)">No picks here on ${esc(dayName)}.</p>
        <div class="rowbtns"><button class="btn quiet" data-act="map-search" data-hotel="${esc(hotel)}" data-day="${day}">Search ${esc(hotelPhrase(hotel))} on ${esc(dayName)}</button></div></div>`;
  return `<div class="ev-head"><h2 id="sheetTitleHotel" tabindex="-1">${esc(hotel)}</h2><div class="ev-when">${esc(dayName)} &middot; ${count}</div></div>
    ${body}
    <div class="ev-actions"><button class="btn" id="closeSheetHotel">Done</button></div>`;
}
/* Every hotel on every day, as next drew it - the string the sheet is built
   from, and the panel once opened on the Map's day. */
function hotelSheetsAsBefore(app, handle, skip = () => false) {
  for (const day of app.CON_DAYS) {
    for (const hotel of Object.keys(app.MAP_HOTELS)) {
      if (!skip(hotel, day)) expect(app.hotelSheetHTML(hotel, day), `${hotel}, ${day}`).toBe(hotelSheetBefore(app, handle.picks.get(), hotel, day));
    }
  }
}

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

describe("a crew's change pulled is a redraw on any tab: Now, the Map and Plans draw the crew, the crew panel and an open event are refilled in place, and Search and Explore are drawn again with their boxes kept", () => {
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
  it("the crew panel closed again - its panel's markup left behind the closed sheet: Explore is drawn again, and its filter box is the same node with its text, its focus and its caret", async () => {
    expect(el("sheetWrap").hidden).toBe(true);
    expect(el("panel-crew").hidden).toBe(false);
    tapTab("explore");
    const box = el("exploreQ");
    typeIn(box, "tre", 1, 2);
    const marker = jumpChip();
    pick(s.fake, s.bo, "s0304");
    await s.run();
    expect(replaced(marker, jumpChip)).toBe(true);
    expect(el("exploreQ")).toBe(box);
    expect(document.activeElement).toBe(box);
    expect([box.value, box.selectionStart, box.selectionEnd]).toEqual(["tre", 1, 2]);
    expect(el("sheetWrap").hidden).toBe(true);
  });
  it("an event's sheet open over Search: its who's-going line, in place - the sheet not drawn again, focus where it was - and Search's box as typed", async () => {
    tapTab("browse");
    const q = el("q");
    typeIn(q, "dar", 1, 2);
    s.app.openSheet("event", "s0590");
    expect(words(el("sheetGoing"))).toBe("Starred by Bo");
    const head = el("panel-event").firstElementChild, star = el("sheetStar");
    star.focus();
    pick(s.fake, s.cy, "s0590");
    await s.run();
    expect(words(el("sheetGoing"))).toBe("Starred by Bo, Cyrus");
    expect(el("panel-event").firstElementChild).toBe(head);
    expect(document.activeElement).toBe(star);
    escape();
    expect(el("q")).toBe(q);
    expect(q.value).toBe("dar");
  });
  it("an event's sheet open over Explore: Explore is drawn again behind it, and its filter box is the same node with its text and its caret - and has its focus again when the sheet closes", async () => {
    tapTab("explore");
    const box = el("exploreQ");
    typeIn(box, "sta", 1, 2);
    s.app.openSheet("event", "s0590");
    const marker = jumpChip();
    pick(s.fake, s.dee, "s0590");
    await s.run();
    expect(words(el("sheetGoing"))).toBe("Starred by Bo, Cyrus, Dee");
    expect(replaced(marker, jumpChip)).toBe(true);
    expect(el("exploreQ")).toBe(box);
    expect([box.value, box.selectionStart, box.selectionEnd]).toEqual(["sta", 1, 2]);
    expect(s.handle.state.explore.q).toBe("sta");
    escape();
    expect(el("exploreQ")).toBe(box);
    expect(document.activeElement).toBe(box);
    expect([box.value, box.selectionStart, box.selectionEnd]).toEqual(["sta", 1, 2]);
  });
  it("Search alone: drawn again, and its box is the same node with its text, its focus and its caret", async () => {
    tapTab("browse");
    await s.page.until(() => s.app.index, 10000, "the search index");
    const q = el("q");
    typeIn(q, "dark", 1, 3);
    s.handle.render();                        // the typing's own draw, now rather than after its pause
    q.setSelectionRange(1, 3);
    const marker = listTop();
    pick(s.fake, s.bo, "s0263");
    await s.run();
    expect(replaced(marker, listTop)).toBe(true);
    expect(el("q")).toBe(q);
    expect(document.activeElement).toBe(q);
    expect([q.value, q.selectionStart, q.selectionEnd]).toEqual(["dark", 1, 3]);
  });
  it("Explore alone: drawn again, and its filter box is the same node with its text, its focus and its caret", async () => {
    tapTab("explore");
    const box = el("exploreQ");
    typeIn(box, "star", 1, 2);
    const marker = jumpChip();
    pick(s.fake, s.bo, "s0349");
    await s.run();
    expect(replaced(marker, jumpChip)).toBe(true);
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

/* The crews forgotten ask for a redraw on any tab too (DECISIONS #80): with
   no session - another tab signed out - and at a change of owner - another
   tab signed in as someone else. Between the two the reader signs in again,
   and the pull brings the crew back. */
describe("the crews forgotten are a redraw on any tab: with no session, and at a change of owner, Explore and Search are drawn again with their boxes kept", () => {
  let s, zed;
  const crews = () => (read("crew") || []).length;
  const back = async () => { signIn(s.fake, s.ada); await s.run(); expect(crews()).toBe(1); };
  const onExplore = () => { tapTab("explore"); const box = el("exploreQ"); typeIn(box, "star", 1, 2); return [box, jumpChip()]; };
  const onSearch = async () => {
    tapTab("browse");
    await s.page.until(() => s.app.index, 10000, "the search index");
    const q = el("q");
    typeIn(q, "dark", 1, 3);
    s.handle.render();                        // the typing's own draw, now rather than after its pause
    q.setSelectionRange(1, 3);
    return [q, listTop()];
  };
  const kept = (box, id, text, from, to) => {
    expect(el(id)).toBe(box);
    expect(document.activeElement).toBe(box);
    expect([box.value, box.selectionStart, box.selectionEnd]).toEqual([text, from, to]);
  };

  beforeAll(async () => {
    s = await crewScene({ mates: [["bo", "Bo"]], theirs: { bo: ["s0590"] } });
    zed = s.fake.held("zed@example.test");
  }, 30000);
  afterAll(() => s.page.cleanup());

  it("no session, on Explore", async () => {
    expect(crews()).toBe(1);
    const [box, marker] = onExplore();
    window.localStorage.removeItem(KEY("session"));
    await s.run();
    expect(crews()).toBe(0);
    expect(replaced(marker, jumpChip)).toBe(true);
    kept(box, "exploreQ", "star", 1, 2);
  });
  it("a change of owner, on Search", async () => {
    await back();
    const [q, marker] = await onSearch();
    signIn(s.fake, zed);
    await s.run();
    expect([crews(), read("syncStamp").user]).toEqual([0, zed.id]);
    expect(replaced(marker, listTop)).toBe(true);
    kept(q, "q", "dark", 1, 3);
  });
  it("no session, on Search", async () => {
    await back();
    const [q, marker] = await onSearch();
    window.localStorage.removeItem(KEY("session"));
    await s.run();
    expect(crews()).toBe(0);
    expect(replaced(marker, listTop)).toBe(true);
    kept(q, "q", "dark", 1, 3);
  });
  it("a change of owner, on Explore", async () => {
    await back();
    const [box, marker] = onExplore();
    signIn(s.fake, zed);
    await s.run();
    expect([crews(), read("syncStamp").user]).toEqual([0, zed.id]);
    expect(replaced(marker, jumpChip)).toBe(true);
    kept(box, "exploreQ", "star", 1, 2);
  });
});

describe("who starred it (W22, who's going): a line on the event's sheet", () => {
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
    expect(going("s0590")).toEqual(["Starred by Bo", false]);
    expect(going("s0376")).toEqual(["Starred by Bo, Cy, Dee", false]);
    expect(going("s0263")).toEqual(["Starred by Bo, Cy, Dee and 1 more", false]);
    expect(going("s0349")).toEqual(["Starred by Bo, Cy, Dee and 3 more", false]);
  });
  it("never the reader, whose own star says so", () => {
    expect(s.handle.picks.get().has("s0590")).toBe(true);
    expect(going("s0590")[0]).toBe("Starred by Bo");
  });
  it("a name is someone's own text: escaped", () => {
    expect(going("s0260")).toEqual(["Starred by Zo <i>&\"'", false]);
    expect(el("sheetGoing").querySelector("i")).toBe(null);
  });
  it("a removed event has none, though a crewmate's picks hold it; a cancelled one has its line", () => {
    expect(going("s0257")).toEqual(["", true]);
    expect(going("s0254")).toEqual(["Starred by Bo", false]);
  });
  it("a star in the sheet writes the panel in place, the line as it stood", () => {
    going("s0376");
    const line = el("sheetGoing");
    el("sheetStar").click();
    expect(el("sheetGoing")).toBe(line);
    expect(words(el("sheetGoing"))).toBe("Starred by Bo, Cy, Dee");
    el("sheetStar").click();
  });
  it("pulled while it is open: the line changes in place, focus stays where it was, and the last unstar hides it", async () => {
    going("s0228");
    const head = el("panel-event").firstElementChild, star = el("sheetStar");
    star.focus();
    pick(s.fake, s.eve, "s0228");
    await s.run();
    expect([words(el("sheetGoing")), el("sheetGoing").hidden]).toEqual(["Starred by Eve", false]);
    expect(el("panel-event").firstElementChild).toBe(head);
    expect(document.activeElement).toBe(star);
    pick(s.fake, s.eve, "s0228", false);
    await s.run();
    expect([words(el("sheetGoing")), el("sheetGoing").hidden]).toEqual(["", true]);
    expect(document.activeElement).toBe(star);
    s.app.closeSheet();
  });
});

describe("your crew's picks right now (W23): a section of Now, between the hero and Rest of your day", () => {
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
  it("a line a crewmate: on now first, then by start, then by name; on now or the start, yours too, the title and the place - four, then how many more", () => {
    expect(lines()).toEqual([
      "Bo · on now · yours too Artemis: Bridge Crew Open Play · Westin",
      "Cy · on now Q&A: Pathfinder 2026 · Hilton",
      "Dee · 2:30 PM · yours too Writing Villains Readers Love to Hate · Hyatt",
      "Eve · 2:30 PM Making a Living Off of Being Creative! · Streaming",
    ]);
    expect(words(el("crewMore"))).toBe("+1 more");
    expect(el("crewMore").getAttribute("aria-label")).toBe("+1 more of your crew, in Plans");
    expect(lineOf(s.fay)).toBe(null);
  });
  it("each line's markup is as before ui.js built it for the hotel sheet, byte for byte but for its word - on now, next, yours too, a stream", () => {
    expect(nowLinesAsBefore(s)).toBe(4);
  });
  it("a crewmate whose picks today are over, or on another day, has no line", () => {
    expect([lineOf(s.gus), lineOf(s.hal)]).toEqual([null, null]);
  });
  it("each line is a button to its event's sheet, labelled by what it says, and \"yours too\" is the reader's gold", () => {
    const bo = lineOf(s.bo);
    expect(bo.tagName).toBe("BUTTON");
    expect([bo.dataset.hero, bo.getAttribute("aria-haspopup")]).toEqual(["s0294", "dialog"]);
    expect(bo.querySelector(".cn-with").textContent).toBe("yours too");
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
    expect(words(lineOf(s.dee))).toBe("Dee · on now · yours too Writing Villains Readers Love to Hate · Hyatt");
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

describe("your crew's picks right now: removed and unknown picks skipped, offsite places named as the Map names them", () => {
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
  it("and each line's markup as before, byte for byte - offsite, escaped, cancelled", () => {
    expect(nowLinesAsBefore(s)).toBe(4);
  });
  it("the Map's On now line names it the same way", () => {
    s.handle.picks.set(["s0305"]);
    tapTab("map");
    expect(words(document.querySelector("#view-map .next-on"))).toMatch(/· Joystick Gamebar$/);
    s.handle.picks.set([]);
    tapTab("now");
  });
});

describe("your crew's picks right now and the clock: the minute tick on the crew alone, and the con day past midnight", () => {
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
  it("the hotel sheet: next's markup for every hotel on every day, though a crewmate's picks are kept at the Hyatt and the Hilton", () => {
    hotelSheetsAsBefore(app, page.handle);
    tapTab("map");
    openHotel("Hilton");
    expect(hotelPanel().innerHTML).toBe(parsed(hotelSheetBefore(app, page.handle.picks.get(), "Hilton", "2026-09-05")));
    app.closeSheet();
  });
});

describe("the hotel sheet with a backend and no crew: next's markup", () => {
  let page;
  beforeAll(async () => {
    const fake = fakeBackend();
    const ada = fake.held("ada@example.test");
    for (const id of ["s0294", "s0376", "s0439"]) pick(fake, ada, id);
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    await page.app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("every hotel on every day, as next drew it, and the Hyatt's panel once opened", () => {
    expect(page.handle.picks.get().size).toBe(3);
    hotelSheetsAsBefore(page.app, page.handle);
    tapTab("map");
    openHotel("Hyatt");
    expect(hotelPanel().innerHTML).toBe(parsed(hotelSheetBefore(page.app, page.handle.picks.get(), "Hyatt", "2026-09-05")));
    page.app.closeSheet();
  });
});

describe("the hotel sheet's crew (step 5c): Your crew's picks here, under the reader's own picks", () => {
  let s;
  const SATURDAY_DAY = "2026-09-05";
  const data = structuredClone(fixture);
  for (const e of data.events) {
    if (e.id === "s0228") e.room = "";
    if (e.id === "s0281") e.removed = true;
    if (e.id === "s0332") e.cancelled = true;
    if (e.id === "s0347") e.title = "Q&A: <i>Pathfinder</i> & \"friends\"";
  }
  /* The Hyatt on Saturday: by start, then title - the schedule's order - and
     by name within one event, so at 4:00 PM Bo and Dee's Dune before Cy and
     Eve's Warhammer, the names interleaved and each event's lines together. */
  const HYATT = [
    "Fay · 10:00 AM Severance Retrospective",
    "Bo · 2:30 PM · yours too Writing Villains Readers Love to Hate · Centennial II-IV",
    "Bo · 4:00 PM Deep Dive: Dune Roundtable · Grand Hall C",
    "Dee · 4:00 PM Deep Dive: Dune Roundtable · Grand Hall C",
    "Cy · 4:00 PM Deep Dive: Warhammer 40K · Grand Hall C",
    "Eve · 4:00 PM Deep Dive: Warhammer 40K · Grand Hall C",
    "Zo <i>&\"' · 4:00 PM Q&A: <i>Pathfinder</i> & \"friends\" · Centennial I",
  ];
  beforeAll(async () => {
    s = await crewScene({
      data,
      mates: [["bo", "Bo"], ["cy", "Cy"], ["dee", "Dee"], ["eve", "Eve"], ["fay", "Fay"], ["gus", "Gus"], ["hal", "Hal"], ["zo", "Zo <i>&\"'"]],
      mine: ["s0294", "s0376"],
      theirs: {
        bo: ["s0376", "s0263", "s0281", "s0439"], cy: ["s0332", "s0230"], dee: ["s0263", "no-such-event"], eve: ["s0332"],
        fay: ["s0228"], hal: ["s0281", "no-such-event"], zo: ["s0347"],
      },
    });
    tapTab("map");
  }, 30000);
  afterAll(() => s.page.cleanup());

  it("under the reader's own rows, Your crew's picks here: a line a pick in the schedule's order, by name within one event - a crewmate with two picks in two lines", () => {
    openHotel("Hyatt");
    const body = hotelPanel().querySelector(".ev-body"), section = el("hotelCrew");
    expect(section.parentElement).toBe(body);
    expect(before(body.querySelector('.list .row[data-id="s0376"]'), section)).toBe(true);
    expect(section.firstElementChild.className).toBe("section-title");
    expect(words(section.firstElementChild)).toBe("Your crew's picks here");
    expect(hereLines()).toEqual(HYATT);
    expect([hereOf(s.bo, "s0376"), hereOf(s.bo, "s0263")].every(Boolean)).toBe(true);
  });
  it("the head: the day, the reader's own count, then how many of the crew - people, not picks", () => {
    expect(hotelHead()).toBe("Saturday · 1 pick · 6 of your crew");
    expect(words(crewPill("Hyatt"))).toBe("6");
  });
  it("yours too as on Now; the room, not the hotel, and the title alone with no room; a cancelled pick unmarked; names and titles escaped", () => {
    expect(hereOf(s.bo, "s0376").querySelector(".cn-with").textContent).toBe("yours too");
    expect(hereOf(s.bo, "s0263").querySelector(".cn-with")).toBe(null);
    const fay = hereOf(s.fay, "s0228");
    expect(fay.querySelector(".cn-where")).toBe(null);
    expect(words(fay.querySelector(".cn-what"))).toBe("Severance Retrospective");
    expect(hereOf(s.cy, "s0332").querySelector(".cancelled-tag")).toBe(null);
    expect(words(hereOf(s.cy, "s0332"))).not.toMatch(/Cancelled/);
    const zo = hereOf(s.zo, "s0347");
    expect(zo.querySelector("i")).toBe(null);
    expect([zo.querySelector(".cn-who").textContent, zo.querySelector(".cn-title").textContent]).toEqual(["Zo <i>&\"'", "Q&A: <i>Pathfinder</i> & \"friends\""]);
  });
  it("a removed pick and one this schedule does not hold are no one's: no line, and not counted", () => {
    expect(hereOf(s.bo, "s0281")).toBe(null);
    expect(hereOf(s.hal, "s0281")).toBe(null);
    expect(hereButtons().some(b => b.id.startsWith(`crewHere-${s.hal.id}`))).toBe(false);
    expect(hotelHead()).toMatch(/ 6 of your crew$/);
  });
  it("no pick of the reader's here: None of your own picks here, above the Search button, which stays; then the crew - and never on now: the sheet does not tick", () => {
    escape();
    openHotel("Hilton");
    expect(hotelHead()).toBe("Saturday · no picks · 1 of your crew");
    const body = hotelPanel().querySelector(".ev-body"), said = body.querySelector("p"), search = body.querySelector('[data-act="map-search"]');
    expect(words(said)).toBe("None of your own picks here on Saturday.");
    expect(words(search)).toBe("Search the Hilton on Saturday");
    expect(before(said, search)).toBe(true);
    expect(before(search, el("hotelCrew"))).toBe(true);
    expect(hereLines()).toEqual(["Cy · 1:00 PM Q&A: Pathfinder 2026 · Steps B"]);
    expect(lineOf(s.cy)).not.toBe(null);
    expect(words(lineOf(s.cy))).toMatch(/^Cy · on now /);
    escape();
  });
  it("the head's crew is the Map's pill, for every hotel on every day; where the pill has none, the sheet is next's", () => {
    const counted = [];
    for (const day of s.app.CON_DAYS) {
      tapDay(day);
      for (const hotel of Object.keys(s.app.MAP_HOTELS)) {
        const pill = crewPill(hotel), at = `${hotel}, ${day}`;
        if (pill) counted.push(at);
        openHotel(hotel);
        const crew = / · (\d+) of your crew$/.exec(hotelHead());
        expect(crew ? crew[1] : null, at).toBe(pill ? words(pill) : null);
        expect(el("hotelCrew") === null, at).toBe(pill === null);
        if (!pill) {
          expect(s.app.hotelSheetHTML(hotel, day), at).toBe(hotelSheetBefore(s.app, s.handle.picks.get(), hotel, day));
          expect(hotelPanel().innerHTML, at).toBe(parsed(hotelSheetBefore(s.app, s.handle.picks.get(), hotel, day)));
        }
        escape();
      }
    }
    expect(counted).toEqual(["Hyatt, 2026-09-05", "Hilton, 2026-09-05", "AmericasMart, 2026-09-06"]);
    tapDay(SATURDAY_DAY);
  });
  it("a line opens its event's sheet in the hotel's place, and closing it lands on the Map, focus on the hotel that opened the sheet", () => {
    blockOf("Hyatt").focus();
    openHotel("Hyatt");
    press(hereOf(s.bo, "s0376"));
    expect(s.handle.state.sheetId).toBe("s0376");
    expect([el("panel-event").hidden, el("panel-hotel").hidden]).toEqual([false, true]);
    expect(document.activeElement).toBe(el("sheetTitleEvent"));
    escape();
    expect(el("sheetWrap").hidden).toBe(true);
    expect(s.handle.state.tab).toBe("map");
    expect(document.activeElement).toBe(blockOf("Hyatt"));
  });
  it("each line's id is its crewmate's and its event's: unique, none of Now's, and what focus finds it by - never its event, which the Map's card behind shows too", () => {
    openHotel("Hyatt");
    const ids = [...document.querySelectorAll("[id]")].map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(el("view-now").hidden).toBe(true);
    expect(el("view-now").querySelectorAll('.crew-now[id^="crewNow-"]').length).toBeGreaterThan(0);
    for (const b of hereButtons()) expect(b.id.startsWith("crewHere-") && b.id.endsWith(`-${b.dataset.hero}`), b.id).toBe(true);
    expect(hereOf(s.bo, "s0376")).not.toBe(hereOf(s.bo, "s0263"));
    const bo = hereOf(s.bo, "s0376");
    expect(s.app.shownMatch('[data-hero="s0376"]')).toBe(el("mapNext"));
    expect(s.app.focusKey(bo)).toBe(`#${s.app.cssEsc(bo.id)}`);
    expect(s.app.shownMatch(s.app.focusKey(bo))).toBe(bo);
  });
  it("a pull refills it in place: a line added above the one with focus - its node and focus kept, the body and its scroll kept, the count moved", async () => {
    const dee = hereOf(s.dee, "s0263"), body = hotelPanel().querySelector(".ev-body"), title = el("sheetTitleHotel");
    dee.focus();
    body.scrollTop = 40;
    pick(s.fake, s.gus, "s0376");
    await s.run();
    expect(hereLines()).toEqual([HYATT[0], HYATT[1], "Gus · 2:30 PM · yours too Writing Villains Readers Love to Hate · Centennial II-IV", ...HYATT.slice(2)]);
    expect(hereOf(s.dee, "s0263")).toBe(dee);
    expect(document.activeElement).toBe(dee);
    expect(hotelPanel().querySelector(".ev-body")).toBe(body);
    expect(body.scrollTop).toBe(40);
    expect(el("sheetTitleHotel")).toBe(title);
    expect(hotelHead()).toBe("Saturday · 1 pick · 7 of your crew");
  });
  it("a line taken away while it has focus gives focus to the sheet's heading", async () => {
    hereOf(s.gus, "s0376").focus();
    pick(s.fake, s.gus, "s0376", false);
    await s.run();
    expect(hereOf(s.gus, "s0376")).toBe(null);
    expect(document.activeElement).toBe(el("sheetTitleHotel"));
    expect(hotelHead()).toBe("Saturday · 1 pick · 6 of your crew");
  });
  it("a crewmate renamed: their lines say the new name in place, and a line the new order moves keeps its node and has focus again", async () => {
    const dee = hereOf(s.dee, "s0263"), bo = hereOf(s.bo, "s0376");
    dee.focus();
    s.fake.rename(s.crew, s.bo.id, "Zed");
    await s.run();
    expect(hereLines().slice(1, 4)).toEqual([
      "Zed · 2:30 PM · yours too Writing Villains Readers Love to Hate · Centennial II-IV",
      "Dee · 4:00 PM Deep Dive: Dune Roundtable · Grand Hall C",
      "Zed · 4:00 PM Deep Dive: Dune Roundtable · Grand Hall C",
    ]);
    expect(hereOf(s.bo, "s0376")).toBe(bo);
    expect(hereOf(s.dee, "s0263")).toBe(dee);
    expect(document.activeElement).toBe(dee);
    s.fake.rename(s.crew, s.bo.id, "Bo");
    await s.run();
    expect(hereLines()).toEqual(HYATT);
  });
  it("a pull that changes nothing here draws nothing in the sheet - though it draws the Map behind it", async () => {
    hereOf(s.cy, "s0332").focus();
    const changes = await mutationsAcross(hotelPanel(), async () => { pick(s.fake, s.bo, "s0253"); await s.run(); });
    expect(words(crewPill("Marriott"))).toBe("1");
    expect(changes).toEqual([]);
    expect(document.activeElement).toBe(hereOf(s.cy, "s0332"));
    pick(s.fake, s.bo, "s0253", false);
    await s.run();
  });
  it("the reader's own unstar pulled: yours too follows it, while the reader's own row and count stay as drawn (ROADMAP, Flags)", async () => {
    s.fake.write(s.ada.id, "picks", { event_id: "s0376", picked: false, changed_at: iso(Date.now() + 5000) });
    await s.run();
    expect(s.handle.picks.get().has("s0376")).toBe(false);
    expect(words(hereOf(s.bo, "s0376"))).toBe("Bo · 2:30 PM Writing Villains Readers Love to Hate · Centennial II-IV");
    expect(hotelPanel().querySelector('.ev-body .list .row[data-id="s0376"]')).not.toBe(null);
    expect(hotelHead()).toBe("Saturday · 1 pick · 6 of your crew");
    s.fake.write(s.ada.id, "picks", { event_id: "s0376", picked: true, changed_at: iso(Date.now() + 10000) });
    await s.run();
    expect(s.handle.picks.get().has("s0376")).toBe(true);
    expect(hereOf(s.bo, "s0376").querySelector(".cn-with")).not.toBe(null);
    escape();
  });
  it("a hotel's sheet open over Explore: its crew drawn, Explore drawn again behind it, its filter box the same node with its text and its caret, and its focus again when the sheet closes - and with the crew gone, the sheet is next's again", async () => {
    tapTab("explore");
    const box = el("exploreQ");
    typeIn(box, "sta", 1, 2);
    s.app.openSheet("hotel", "Marriott");
    const marker = jumpChip();
    const drawn = hotelPanel().innerHTML;
    expect(drawn).toBe(parsed(hotelSheetBefore(s.app, s.handle.picks.get(), "Marriott", SATURDAY_DAY)));
    pick(s.fake, s.eve, "s0253");
    await s.run();
    expect(hotelHead()).toBe("Saturday · no picks · 1 of your crew");
    expect(words(hotelPanel().querySelector(".ev-body p"))).toBe("None of your own picks here on Saturday.");
    expect(hereLines()).toEqual(["Eve · 4:00 PM Fan Panel: Discworld · A601-A602"]);
    expect(before(hotelPanel().querySelector('[data-act="map-search"]'), el("hotelCrew"))).toBe(true);
    expect(replaced(marker, jumpChip)).toBe(true);
    expect(el("exploreQ")).toBe(box);
    expect([box.value, box.selectionStart, box.selectionEnd]).toEqual(["sta", 1, 2]);
    pick(s.fake, s.eve, "s0253", false);
    await s.run();
    expect(hotelPanel().innerHTML).toBe(drawn);
    escape();
    expect(document.activeElement).toBe(box);
    expect([box.value, box.selectionStart, box.selectionEnd]).toEqual(["sta", 1, 2]);
    tapTab("map");
  });
  it("#66: each line a button, 44px or taller, labelled by what it says, its focus ring inside it", () => {
    openHotel("Hyatt");
    expect(hereButtons().length).toBe(HYATT.length);
    for (const b of hereButtons()) {
      expect([b.tagName, b.className, b.getAttribute("aria-haspopup"), b.hasAttribute("aria-label")]).toEqual(["BUTTON", "crew-now", "dialog", false]);
      expect(words(b)).not.toBe("");
    }
    expect(cssRule(".crew-now")).toContain("min-height: 44px");
    expect(cssRule(".crew-now:focus-visible")).toContain("outline-offset: -3px");
    expect(css).not.toMatch(/\.hotel-crew[^{,]*\.crew-now/);
    /* jsdom lays nothing out: the section, a grid item of the body, must not
       widen the body's column to its lines' unwrapped titles. */
    expect(getComputedStyle(el("hotelCrew").parentElement).display).toBe("grid");
    expect(cssRule(".hotel-crew")).toContain("min-width: 0");
    escape();
  });

  /* jsdom lays nothing out, so the sheet's body and its crew section are
     given the places a phone would give them while `during` runs: the
     section 420 below the body's top, wherever the body has scrolled to. */
  function laidOut(during) {
    const real = Element.prototype.getBoundingClientRect;
    const rect = (top, height) => ({ top, bottom: top + height, left: 16, right: 359, width: 343, height, x: 16, y: top });
    Element.prototype.getBoundingClientRect = function () {
      if (this.matches("#panel-hotel .ev-body")) return rect(300, 390);
      if (this.id === "hotelCrew") return rect(300 + 420 - this.parentElement.scrollTop, 400);
      return real.call(this);
    };
    try { during(); } finally { Element.prototype.getBoundingClientRect = real; }
  }
  const bodyScroll = () => hotelPanel().querySelector(".ev-body").scrollTop;
  const tapSVG = node => node.dispatchEvent(new MouseEvent("click", { bubbles: true }));

  it("the crew's pill opens the hotel's sheet with Your crew's picks here brought to the top of its body (#63), focus on the heading", () => {
    laidOut(() => tapSVG(crewPill("Hyatt").querySelector("rect")));
    expect(s.handle.state.sheetHotel).toBe("Hyatt");
    expect(bodyScroll()).toBe(420);
    expect(document.activeElement).toBe(el("sheetTitleHotel"));
    escape();
  });
  /* The body fades at its top once there is more above it (DECISIONS #76),
     and the section's heading must stand clear of that band: the section
     stops short of the top by the deepest the band can be, which
     showHotelCrew() reads from the body's own scroll padding - the
     stylesheet's cap, 1.75rem and a fifth of the body's height. jsdom
     computes no scroll padding and no height, so the body is given both
     while `during` runs. */
  function padded(said, height, during) {
    const real = window.getComputedStyle, tall = Object.getOwnPropertyDescriptor(Element.prototype, "clientHeight");
    const isBody = node => !!node.matches && node.matches("#panel-hotel .ev-body");
    window.getComputedStyle = globalThis.getComputedStyle = (node, pseudo) => (isBody(node) ? { scrollPaddingTop: said } : real.call(window, node, pseudo));
    Object.defineProperty(Element.prototype, "clientHeight", { configurable: true, get() { return isBody(this) ? height : tall.get.call(this); } });
    try { laidOut(during); } finally {
      window.getComputedStyle = globalThis.getComputedStyle = real;
      Object.defineProperty(Element.prototype, "clientHeight", tall);
    }
  }
  it("and its heading lands clear of the band at the body's top: short of it by the cap, 1.75rem - 28px, 32.2 with Larger text", () => {
    for (const [said, landed] of [["min(28px, 20%)", 392], ["min(32.2px, 20%)", 387.8]]) {
      padded(said, 390, () => tapSVG(crewPill("Hyatt").querySelector("rect")));
      expect(bodyScroll()).toBe(landed);
      expect(document.activeElement).toBe(el("sheetTitleHotel"));
      escape();
    }
  });
  it("or by a fifth of the body's height, in a body so short that is less", () => {
    padded("min(28px, 20%)", 100, () => tapSVG(crewPill("Hyatt").querySelector("rect")));
    expect(bodyScroll()).toBe(400);
    escape();
    padded("min(28px, 20%)", 140, () => tapSVG(crewPill("Hyatt").querySelector("rect")));
    expect(bodyScroll()).toBe(392);
    escape();
  });
  it("by whichever the padding names alone, and by nothing where none is said", () => {
    for (const [said, landed] of [["28px", 392], ["10%", 381], ["auto", 420], ["", 420]]) {
      padded(said, 390, () => tapSVG(crewPill("Hyatt").querySelector("rect")));
      expect(bodyScroll()).toBe(landed);
      escape();
    }
  });
  it("the gold pill opens it at its top, as before", () => {
    laidOut(() => tapSVG(document.querySelector('#view-map .map-pill[data-hotel="Hyatt"] rect')));
    expect(s.handle.state.sheetHotel).toBe("Hyatt");
    expect(bodyScroll()).toBe(0);
    escape();
  });
  it("and the block at its top, tapped or by the keyboard's path", () => {
    laidOut(() => openHotel("Hyatt"));
    expect(s.handle.state.sheetHotel).toBe("Hyatt");
    expect(bodyScroll()).toBe(0);
    escape();
    blockOf("Hyatt").focus();
    laidOut(() => blockOf("Hyatt").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
    expect(s.handle.state.sheetHotel).toBe("Hyatt");
    expect(bodyScroll()).toBe(0);
    escape();
  });
  it("a crew pill left on the Map after another tab changed the crew's picks finds no section: the sheet opens at its top, and nothing throws", () => {
    const kept = read("crewPicks");
    seed("crewPicks", {});
    laidOut(() => tapSVG(crewPill("Hyatt").querySelector("rect")));
    expect(s.handle.state.sheetHotel).toBe("Hyatt");
    expect(el("hotelCrew")).toBe(null);
    expect(bodyScroll()).toBe(0);
    escape();
    seed("crewPicks", kept);
    s.handle.render();
    expect(words(crewPill("Hyatt"))).toBe("6");
  });
});

describe("the hotel sheet keeps the day it was drawn for: past 5 AM, a pull and a star stay on it", () => {
  let s;
  beforeAll(async () => {
    /* Sunday 4:50 AM is still Saturday's con day; at 5:10 the Map's day,
       with no chip tapped, is Sunday. Bo's pick is Sunday's at the Hyatt. */
    s = await crewScene({ now: "2026-09-06T04:50", mates: [["bo", "Bo"], ["cy", "Cy"]], mine: ["s0376"], theirs: { bo: ["s0399"] } });
    tapTab("map");
  }, 30000);
  afterAll(() => s.page.cleanup());

  it("a sheet opened with no day tapped stays on its day through a pull and a star after the clock passes 5 AM", async () => {
    expect(s.handle.state.map.day).toBe(null);
    openHotel("Hyatt");
    expect(hotelHead()).toBe("Saturday · 1 pick");
    s.app.setOverride("2026-09-06T05:10");
    expect(s.app.mapDay()).toBe("2026-09-06");
    pick(s.fake, s.cy, "s0263");
    await s.run();
    expect(hotelHead()).toBe("Saturday · 1 pick · 1 of your crew");
    expect(hereLines()).toEqual(["Cy · 4:00 PM Deep Dive: Dune Roundtable · Grand Hall C"]);
    hotelPanel().querySelector('.row[data-id="s0376"] .star').click();
    expect(s.handle.picks.get().has("s0376")).toBe(false);
    expect(hotelHead()).toBe("Saturday · no picks · 1 of your crew");
    expect(words(hotelPanel().querySelector(".ev-body p"))).toBe("None of your own picks here on Saturday.");
    expect(hereLines()).toEqual(["Cy · 4:00 PM Deep Dive: Dune Roundtable · Grand Hall C"]);
    escape();
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

describe("the crew's words (step 5d, #68): a star is a pick, not a whereabouts", () => {
  let s;
  beforeAll(async () => {
    s = await crewScene({ mates: [["bo", "Bo"], ["cy", "Cy"]], mine: ["s0376"], theirs: { bo: ["s0376", "s0263"], cy: ["s0230"] } });
  }, 30000);
  afterAll(() => s.page.cleanup());
  /* Everything a screen says: its words, and the labels, titles and hints
     its elements carry for a screen reader. */
  const said = root => [root.textContent, ...[...root.querySelectorAll("[aria-label], [title], [placeholder], [alt]")]
    .flatMap(n => ["aria-label", "title", "placeholder", "alt"].map(a => n.getAttribute(a) || ""))].join(" ");
  /* Whole words: the event's sheet says "With" over its people, and "With
     Young ..." is not "with you". */
  const NEVER = /\bgoing\b|\bwith you\b/i;

  it("no string the crew screens draw says a crewmate is going, or with you: Now, the Map, the hotel sheet, the event sheet, Plans' crew and the crew panel", () => {
    const screens = {};
    screens.now = said(now());
    expect(screens.now).toContain("Your crew's picks right now");
    expect(screens.now).toContain("yours too");
    tapTab("map");
    screens.map = said(el("view-map"));
    expect(screens.map).toContain("of your crew");
    openHotel("Hyatt");
    screens.hotel = said(hotelPanel());
    expect(screens.hotel).toContain("Your crew's picks here");
    escape();
    s.app.openSheet("event", "s0376");
    screens.event = said(el("panel-event"));
    expect(words(el("sheetGoing"))).toBe("Starred by Bo");
    s.app.closeSheet();
    tapTab("plans");
    press(el("plansViewCrew"));
    screens.plans = said(el("view-plans"));
    expect(screens.plans).toContain("Bo");
    s.app.openSheet("crew", "manage");
    screens.crewPanel = said(el("panel-crew"));
    s.app.closeSheet();
    for (const [screen, text] of Object.entries(screens)) expect(text, screen).not.toMatch(NEVER);
  });
});
