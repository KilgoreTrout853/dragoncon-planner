/* Share a day (W25; DECISIONS #69; docs/screens/contract.md, section 5): the
   button in My day's action strip, the share panel, and a ?day= link opened -
   the shared day, its stars, its way back from an event, its refusals. The
   sample's ids are given the shape 2026's have, 32 characters and
   near-sequential, since a token is the last eight of one. New tests, not
   rows of tests/PORT-LEDGER.md, so their titles carry no harness line. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { YEAR, YY } from "../../src/season.js";
import { bootPage } from "../helpers/page.js";
import { fakeBackend } from "../helpers/backend.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const sample = JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "sample-events.json"), "utf8"));
const longId = i => `6ecc75745a676d39f2300556${(0x239c0000 + i).toString(16)}`;
const base = { ...sample, events: sample.events.map((e, i) => ({ ...e, id: longId(i), source_id: longId(i) })) };
/* A day's events between 9 AM and 8 PM, one a start, in start order. */
function dayOf(day) {
  const seen = new Set();
  return base.events.filter(e => e.start >= `${day}T09` && e.start < `${day}T20` && e.end.startsWith(day)).sort((a, b) => a.start.localeCompare(b.start))
    .filter(e => !seen.has(e.start) && seen.add(e.start)).map(e => e.id);
}
const SAT = dayOf("2026-09-05"), FRI = dayOf("2026-09-04"), SUN = dayOf("2026-09-06");
const CANCELLED = SAT[3], REMOVED = SAT[4];
/* Fifteen of Saturday's, start ties and all; and an event with a person
   whose name is tapped, from any day - a link is read across the year. */
const LONG = base.events.filter(e => e.start >= "2026-09-05T09" && e.start < "2026-09-05T20").sort((a, b) => a.start.localeCompare(b.start)).slice(0, 15).map(e => e.id);
const WITH_PEOPLE = base.events.find(e => (e.people || []).some(p => p && p.name && p.id)).id;
/* Two of Saturday's that overlap, neither cancelled nor removed below. */
const CLASH = (() => {
  const sat = base.events.filter(e => e.start >= "2026-09-05T09" && e.start < "2026-09-05T20" && !["Streaming", "Other"].includes(e.hotel))
    .sort((a, b) => a.start.localeCompare(b.start));
  for (const a of sat) { const b = sat.find(e => e.id !== a.id && e.start >= a.start && e.start < a.end && ![SAT[3], SAT[4]].includes(e.id)); if (b && ![SAT[3], SAT[4]].includes(a.id)) return [a, b]; }
  return [];
})();
const data = { ...base, events: base.events.map(e => (e.id === CANCELLED ? { ...e, cancelled: true } : e.id === REMOVED ? { ...e, removed: true } : e)) };
const NOW = "2026-09-05T13:05";
const tail = id => id.slice(-8);
const dayQuery = (day, list, year = YEAR) => `day=${year}.${day}.${list.map(tail).join("-")}`;

const KEY = name => `dc${YY}.${name}`;
const el = id => document.getElementById(id);
const words = node => (node ? node.textContent.replace(/\s+/g, " ").trim() : "");
const shown = node => !!node && !node.hidden && !node.closest("[hidden]");
const tapTab = tab => document.querySelector(`.nav button[data-tab="${tab}"]`).click();
function press(node) { node.focus(); node.click(); }
const escape = () => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
const stub = (name, value) => Object.defineProperty(window.navigator, name, { value, configurable: true });
const everything = () => ({
  local: Object.fromEntries(Object.keys(window.localStorage).sort().map(k => [k, window.localStorage.getItem(k)])),
  session: Object.fromEntries(Object.keys(window.sessionStorage).sort().map(k => [k, window.sessionStorage.getItem(k)])),
});
const shareButton = () => document.querySelector('#view-plans [data-act="share-day"]');
const sharedRows = () => [...el("panel-shared").querySelectorAll(".row")];
const rowOf = id => el("panel-shared").querySelector(`.row[data-id="${id}"]`);

describe("Share a day: the button and the share panel", () => {
  let page, app, handle;
  const fetched = [];
  let realFetch;
  const setPicks = ids => { handle.picks.set(ids); handle.render(); };

  beforeAll(async () => {
    realFetch = globalThis.fetch;
    globalThis.fetch = (...args) => { fetched.push(String(args[0])); return realFetch(...args); };
    page = await bootPage({ data });
    ({ app, handle } = page);
    tapTab("plans");
  }, 30000);
  afterEach(() => { for (const name of ["share", "canShare", "clipboard"]) delete window.navigator[name]; });
  afterAll(async () => { await page.cleanup(); globalThis.fetch = realFetch; });

  it("beside Export in My day's strip, disabled with no pick", () => {
    setPicks([]);
    const strip = [...document.querySelectorAll("#view-plans .plans-actions .btn")].map(b => b.textContent.trim());
    expect(strip).toEqual(["Export to calendar", "Share a day"]);
    expect(shareButton().disabled).toBe(true);
  });
  it("disabled with only a cancelled pick, or only a removed one: there is nothing to share", () => {
    setPicks([CANCELLED]);
    expect(shareButton().disabled).toBe(true);
    setPicks([REMOVED]);
    expect(shareButton().disabled).toBe(true);
  });
  it("with nothing to share, the panel does not open, even asked for directly", () => {
    expect(handle.picks.get().has(REMOVED)).toBe(true);
    handle.openSheet("share");
    expect(el("sheetWrap").hidden).toBe(true);
  });
  it("live with a pick on the schedule, on a build with no backend", () => {
    setPicks([FRI[0], SAT[2], SAT[0], SAT[1], CANCELLED, REMOVED]);
    expect(app.hasBackend).toBe(false);
    expect(shareButton().disabled).toBe(false);
  });
  it("opens its panel: focus on the heading, a chip for each day that holds a pick, today's pressed", () => {
    press(shareButton());
    expect(shown(el("panel-share"))).toBe(true);
    expect(document.activeElement).toBe(el("sheetTitleShare"));
    expect(words(el("sheetTitleShare"))).toBe("Share a day");
    expect(el("sheet").getAttribute("aria-labelledby")).toBe("sheetTitleShare");
    const chips = [...el("panel-share").querySelectorAll("[data-chip]")];
    expect(chips.map(c => [words(c), c.getAttribute("aria-pressed")])).toEqual([["Fri", "false"], ["Sat", "true"]]);
    expect(el("panel-share").querySelector(".share-days").getAttribute("aria-label")).toBe("Day to share");
  });
  it("the message as it will be sent: the day's picks in start order, removed and cancelled left out, then the link", () => {
    const evs = [SAT[0], SAT[1], SAT[2]].map(id => app.byId.get(id));
    const link = `https://example.test/?${dayQuery("sat", [SAT[0], SAT[1], SAT[2]])}`;
    expect(el("shareText").value).toBe([
      "My Saturday at Dragon Con:",
      ...evs.map(e => `${app.fmtShort(e._s)}  ${e.title.replace(/\s+/g, " ").trim()} (${app.placeShort(e)})`),
      link,
    ].join("\n"));
    expect(el("shareText").value).not.toContain("now=");
  });
  it("the field is read-only, labelled Message, and as tall as its lines", () => {
    expect(el("shareText").readOnly).toBe(true);
    expect(el("shareText").closest("label").firstChild.textContent.trim()).toBe("Message");
    expect(el("shareText").rows).toBe(5);
  });
  it("with no Web Share on the phone, Copy alone", () => {
    expect([shown(el("shareSend")), shown(el("shareCopy"))]).toEqual([false, true]);
  });
  it("Copy: what the field holds, to the clipboard, and the words; nothing stored and no request", async () => {
    const copied = [], before = everything(), from = fetched.length;
    stub("clipboard", { writeText: text => { copied.push(text); return Promise.resolve(); } });
    press(el("shareCopy"));
    expect(copied).toEqual([el("shareText").value]);
    await page.until(() => words(el("shareNote")), 2000, "the words");
    expect(words(el("shareNote"))).toBe("Copied - paste it into any chat.");
    expect(everything()).toEqual(before);
    expect(fetched.length).toBe(from);
  });
  it("a clipboard that refuses, and none at all: the message selected in its field, and the words", async () => {
    stub("clipboard", { writeText: () => Promise.reject(new DOMException("no", "NotAllowedError")) });
    press(el("shareCopy"));
    await page.until(() => document.activeElement === el("shareText"), 2000, "the field selected");
    expect(words(el("shareNote"))).toBe("Couldn't copy - select the message above and copy it.");
    expect([el("shareText").selectionStart, el("shareText").selectionEnd]).toEqual([0, el("shareText").value.length]);
    delete window.navigator.clipboard;
    press(el("shareCopy"));
    expect(document.activeElement).toBe(el("shareText"));
    expect(words(el("shareNote"))).toBe("Couldn't copy - select the message above and copy it.");
  });
  it("Share, where the browser has it: the message as one text, nothing else; a cancel says nothing, a refusal selects it", async () => {
    const sent = [];
    stub("share", data => { sent.push(data); return Promise.resolve(); });
    press(el("panel-share").querySelector('[data-value="2026-09-05"]'));       // a chip draws the message again, and asks again whether Share can
    expect(shown(el("shareSend"))).toBe(true);
    press(el("shareSend"));
    expect(sent).toEqual([{ text: el("shareText").value }]);
    stub("share", () => Promise.reject(new DOMException("cancelled", "AbortError")));
    press(el("shareSend"));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(words(el("shareNote"))).toBe("");
    stub("share", () => Promise.reject(new DOMException("no", "NotAllowedError")));
    press(el("shareSend"));
    await page.until(() => document.activeElement === el("shareText"), 2000, "the field selected");
    expect(words(el("shareNote"))).toBe("Couldn't open sharing - the message is above; copy it from there.");
  });
  it("a chip: that day's message, the chip pressed, focus kept on it", () => {
    const fri = el("panel-share").querySelector('[data-value="2026-09-04"]');
    press(fri);
    expect(document.activeElement).toBe(fri);
    expect(fri.getAttribute("aria-pressed")).toBe("true");
    expect(el("panel-share").querySelector('[data-value="2026-09-05"]').getAttribute("aria-pressed")).toBe("false");
    expect(el("shareText").value.split("\n")[0]).toBe("My Friday at Dragon Con:");
    expect(el("shareText").value).toContain(`?${dayQuery("fri", [FRI[0]])}`);
  });
  it("Escape closes it, and focus is back on Share a day", () => {
    escape();
    expect(el("sheetWrap").hidden).toBe(true);
    expect(document.activeElement).toBe(shareButton());
  });
  it("Done closes it too", () => {
    press(shareButton());
    press(el("closeSheetShare"));
    expect(el("sheetWrap").hidden).toBe(true);
    expect(document.activeElement).toBe(shareButton());
  });
  it("opens on today if it holds a pick, else the next day that does; after the con, the first", () => {
    setPicks([FRI[0], SUN[0]]);
    press(shareButton());
    expect(el("panel-share").querySelector('[aria-pressed="true"]').dataset.value).toBe("2026-09-06");
    press(el("closeSheetShare"));
    handle.setTimeOverride("2026-09-20T12:00");
    tapTab("plans");
    press(shareButton());
    expect(el("panel-share").querySelector('[aria-pressed="true"]').dataset.value).toBe("2026-09-04");
    press(el("closeSheetShare"));
    handle.setTimeOverride(NOW);
  });
});

describe("Share a day: a ?day= link opened", () => {
  let page, app, handle;
  /* A page booted at an address: ?now=, then the query given, then a hash. */
  async function arrive(query, { now = NOW, picks = [], backend, session, hash = "" } = {}) {
    if (picks.length) window.localStorage.setItem(KEY("picks"), JSON.stringify(picks));
    if (session) window.sessionStorage.setItem(KEY("join"), session);
    page = await bootPage({ data, backend, url: `https://example.test/?now=${now}${query ? `&${query}` : ""}${hash}` });
    ({ app, handle } = page);
    return page;
  }
  afterEach(async () => { if (page) await page.cleanup(); page = null; });

  it("opens its day over the tab the phase opens on: rows in start order, the reader's own stars, the heading focused", async () => {
    await arrive(dayQuery("sat", [SAT[2], SAT[0], SAT[1]]), { picks: [SAT[1]] });
    expect(handle.state.tab).toBe("now");
    expect(shown(el("panel-shared"))).toBe(true);
    expect(document.activeElement).toBe(el("sheetTitleShared"));
    expect(words(el("sheetTitleShared"))).toBe("Saturday, shared with you");
    expect(el("sheet").getAttribute("aria-labelledby")).toBe("sheetTitleShared");
    expect(sharedRows().map(r => r.dataset.id)).toEqual([SAT[0], SAT[1], SAT[2]]);
    expect(sharedRows().map(r => r.querySelector(".star").getAttribute("aria-pressed"))).toEqual(["false", "true", "false"]);
    expect(words(el("panel-shared"))).toContain("This list isn't saved: it goes when you close it. Star what you want to keep.");
    expect(el("sharedSkipped")).toBe(null);
  });
  it("in each phase, over Explore before the con and Now after it", async () => {
    for (const [now, tab] of [["2026-08-01T12:00", "explore"], ["2026-09-20T12:00", "now"]]) {
      await arrive(dayQuery("sat", [SAT[0]]), { now });
      expect(handle.state.tab).toBe(tab);
      expect(sharedRows().map(r => r.dataset.id)).toEqual([SAT[0]]);
      await page.cleanup();
      page = null;
    }
  });
  it("the address is cleaned after reading, ?now= and the hash left as they were", async () => {
    await arrive(dayQuery("sat", [SAT[0]]), { hash: "#top" });
    expect(window.location.href).toBe(`https://example.test/?now=${NOW}#top`);
  });
  it("nothing stored and no request, with a backend as without one", async () => {
    const fake = fakeBackend();
    await arrive(dayQuery("sat", [SAT[0], SAT[1]]), { backend: fake });
    await app.syncSettled();
    expect(shown(el("panel-shared"))).toBe(true);
    expect(fake.requests).toEqual([]);
    const kept = JSON.stringify(everything());
    for (const token of [tail(SAT[0]), tail(SAT[1]), "day="]) expect(kept).not.toContain(token);
  });
  it("on a build with no backend it opens all the same, and stores nothing", async () => {
    await arrive(dayQuery("sat", [SAT[0], SAT[1]]));
    expect(app.hasBackend).toBe(false);
    expect(sharedRows()).toHaveLength(2);
    expect(JSON.stringify(everything())).not.toContain(tail(SAT[0]));
  });
  it("a star works as anywhere: the pick made, the star pressed, focus left on it", async () => {
    await arrive(dayQuery("sat", [SAT[0], SAT[1]]));
    const star = rowOf(SAT[0]).querySelector(".star");
    press(star);
    expect(handle.picks.get().has(SAT[0])).toBe(true);
    expect(rowOf(SAT[0]).querySelector(".star")).toBe(star);
    expect(star.getAttribute("aria-pressed")).toBe("true");
    expect(rowOf(SAT[0]).classList.contains("mine")).toBe(true);
    expect(document.activeElement).toBe(star);
    expect(JSON.parse(window.localStorage.getItem(KEY("picks")))).toContain(SAT[0]);
    press(star);
    expect(handle.picks.get().has(SAT[0])).toBe(false);
    expect(star.getAttribute("aria-pressed")).toBe("false");
  });
  it("an event opened from it closes back to it - Done, Escape - its scroll put back and focus on the row", async () => {
    await arrive(dayQuery("sat", LONG));
    expect(sharedRows()).toHaveLength(15);
    const body = el("sharedBody");
    body.scrollTop = 120;
    press(rowOf(LONG[9]).querySelector(".row-main"));
    expect(shown(el("panel-event"))).toBe(true);
    expect(shown(el("panel-shared"))).toBe(false);
    expect(document.activeElement).toBe(el("sheetTitleEvent"));
    body.scrollTop = 0;                  // a browser loses a hidden scroller's place; jsdom keeps it
    press(el("closeSheetEvent"));
    expect(el("sheetWrap").hidden).toBe(false);
    expect(shown(el("panel-shared"))).toBe(true);
    expect(el("sharedBody")).toBe(body);
    expect(body.scrollTop).toBe(120);
    expect(document.activeElement).toBe(rowOf(LONG[9]).querySelector(".row-main"));
    expect(el("sheet").getAttribute("aria-labelledby")).toBe("sheetTitleShared");
    expect(handle.state.sheetId).toBe(null);
    press(rowOf(LONG[12]).querySelector(".row-main"));
    escape();
    expect(shown(el("panel-shared"))).toBe(true);
    expect(document.activeElement).toBe(rowOf(LONG[12]).querySelector(".row-main"));
    escape();
    expect(el("sheetWrap").hidden).toBe(true);
    expect(el("panel-shared").innerHTML).toBe("");
  });
  /* Until the gear PR (DECISIONS #92) a swipe closed twice where the
     transition ended - once at its end, once by the timer behind it - and
     the second close shut the shared day the first had gone back to. */
  it("and by a swipe down, where the transition ends and the timer follows it: the shared day stays, its list with it", async () => {
    await arrive(dayQuery("sat", LONG));
    press(rowOf(LONG[9]).querySelector(".row-main"));
    const head = el("sheetTitleEvent"), drag = (type, y) => { const e = new Event(type, { bubbles: true, cancelable: true }); e.touches = y === null ? [] : [{ clientX: 0, clientY: y }]; head.dispatchEvent(e); };
    drag("touchstart", 100);
    drag("touchmove", 300);
    drag("touchend", null);
    el("sheet").dispatchEvent(new Event("transitionend"));
    expect(shown(el("panel-shared"))).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(el("sheetWrap").hidden).toBe(false);
    expect(shown(el("panel-shared"))).toBe(true);
    expect(sharedRows()).toHaveLength(15);
    expect(document.activeElement).toBe(rowOf(LONG[9]).querySelector(".row-main"));
  });
  it("a star there puts the overlap flag on both rows of a clash at once, written in place, and either star takes it off", async () => {
    const [a, b] = CLASH;
    await arrive(dayQuery("sat", [a.id, b.id]));
    const main = rowOf(b.id).querySelector(".row-main"), star = rowOf(a.id).querySelector(".star");
    press(star);
    press(rowOf(b.id).querySelector(".star"));
    expect([words(rowOf(a.id).querySelector(".overlap")), words(rowOf(b.id).querySelector(".overlap"))]).toEqual([`Overlaps ${b.title}`, `Overlaps ${a.title}`]);
    expect(rowOf(b.id).querySelector(".row-main")).toBe(main);
    expect(document.activeElement).toBe(rowOf(b.id).querySelector(".star"));
    press(star);
    expect([rowOf(a.id).querySelector(".overlap"), rowOf(b.id).querySelector(".overlap")]).toEqual([null, null]);
  });
  it("a star in the event's sheet shows on the shared day's row once it is back", async () => {
    await arrive(dayQuery("sat", [SAT[0], SAT[1]]));
    press(rowOf(SAT[1]).querySelector(".row-main"));
    press(el("sheetStar"));
    expect(handle.picks.get().has(SAT[1])).toBe(true);
    press(el("closeSheetEvent"));
    expect(rowOf(SAT[1]).querySelector(".star").getAttribute("aria-pressed")).toBe("true");
  });
  it("a person's name, from an event opened there, closes both, and the list goes", async () => {
    await arrive(dayQuery("sat", [SAT[0], WITH_PEOPLE]));
    press(rowOf(WITH_PEOPLE).querySelector(".row-main"));
    press(el("panel-event").querySelector(".who-name"));
    expect(el("sheetWrap").hidden).toBe(true);
    expect(handle.state.explore.page.kind).toBe("person");
    expect(el("panel-shared").innerHTML).toBe("");
  });
  it("a chip, from an event opened there, closes both too, on its Explore page (#75)", async () => {
    await arrive(dayQuery("sat", [SAT[0], WITH_PEOPLE]));
    press(rowOf(WITH_PEOPLE).querySelector(".row-main"));
    press(el("panel-event").querySelector(".tag-tap"));
    expect(el("sheetWrap").hidden).toBe(true);
    expect([handle.state.tab, handle.state.explore.page.kind]).toEqual(["explore", "track"]);
    expect(el("panel-shared").innerHTML).toBe("");
  });
  it("the place, from an event opened there, closes both and opens the Map, focused on that event; the Map's card then opens the event alone", async () => {
    const there = SAT.find(id => id !== CANCELLED && id !== REMOVED && !["Streaming", "Other"].includes(data.events.find(e => e.id === id).hotel));
    await arrive(dayQuery("sat", [SAT[0], there]));
    press(rowOf(there).querySelector(".row-main"));
    press(el("sheetPlace"));
    expect(el("sheetWrap").hidden).toBe(true);
    expect([handle.state.tab, handle.state.map.focus]).toEqual(["map", there]);
    expect(el("panel-shared").innerHTML).toBe("");
    expect(document.activeElement).toBe(el("mapNext"));
    press(el("mapNext"));
    expect([shown(el("panel-event")), handle.state.sheetId]).toEqual([true, there]);
    press(el("closeSheetEvent"));
    expect([el("sheetWrap").hidden, handle.state.tab, handle.state.map.focus]).toEqual([true, "map", there]);
  });
  it("closed, it does not come back: Done, then an event from Now and its Done, close to Now", async () => {
    await arrive(dayQuery("sat", [SAT[0], SAT[1]]));
    press(el("closeSheetShared"));
    expect(el("sheetWrap").hidden).toBe(true);
    const row = document.querySelector("#view-now .row .row-main");
    press(row);
    expect(shown(el("panel-event"))).toBe(true);
    press(el("closeSheetEvent"));
    expect(el("sheetWrap").hidden).toBe(true);
    expect(shown(el("panel-shared"))).toBe(false);
  });
  it("another panel opening takes the shared day and its way back: Settings over it, or over its event, then an event, closes to the page", async () => {
    await arrive(dayQuery("sat", [SAT[0], SAT[1]]));
    handle.openSheet("settings");
    expect(el("panel-shared").innerHTML).toBe("");
    handle.openSheet("event", SAT[1]);
    handle.closeSheet();
    expect(el("sheetWrap").hidden).toBe(true);
    await page.cleanup();
    await arrive(dayQuery("sat", [SAT[0], SAT[1]]));
    press(rowOf(SAT[0]).querySelector(".row-main"));
    handle.openSheet("settings");
    handle.openSheet("event", SAT[1]);
    handle.closeSheet();
    expect(el("sheetWrap").hidden).toBe(true);
  });
  it("an event opened over that event keeps the way back: Done returns to the list, focus on the row that opened the first, and the list closes to the page", async () => {
    await arrive(dayQuery("sat", [SAT[0], SAT[1]]));
    const body = el("sharedBody");
    press(rowOf(SAT[0]).querySelector(".row-main"));
    handle.openSheet("event", SAT[1]);
    expect(handle.state.sheetId).toBe(SAT[1]);
    expect(document.activeElement).toBe(el("sheetTitleEvent"));
    press(el("closeSheetEvent"));
    expect(el("sheetWrap").hidden).toBe(false);
    expect(shown(el("panel-shared"))).toBe(true);
    expect(el("sharedBody")).toBe(body);
    expect(sharedRows().map(r => r.dataset.id)).toEqual([SAT[0], SAT[1]]);
    expect(document.activeElement).toBe(rowOf(SAT[0]).querySelector(".row-main"));
    expect(handle.state.sheetId).toBe(null);
    escape();
    expect(el("sheetWrap").hidden).toBe(true);
    expect(el("panel-shared").innerHTML).toBe("");
  });
  it("and a third over the second, by Escape, the same", async () => {
    await arrive(dayQuery("sat", [SAT[0], SAT[1], SAT[2]]));
    press(rowOf(SAT[1]).querySelector(".row-main"));
    handle.openSheet("event", SAT[0]);
    handle.openSheet("event", SAT[2]);
    escape();
    expect(shown(el("panel-shared"))).toBe(true);
    expect(document.activeElement).toBe(rowOf(SAT[1]).querySelector(".row-main"));
  });
  it("ids this schedule does not hold are skipped and counted in one line; a tail cut short is one of them, and a link ending in \"-\" says it was cut", async () => {
    await arrive(`day=${YEAR}.sat.${tail(SAT[0])}-deadbeef-0badf00d-${tail(SAT[1]).slice(0, 5)}`);
    expect(sharedRows().map(r => r.dataset.id)).toEqual([SAT[0]]);
    expect(words(el("sharedSkipped"))).toBe("3 events in the link aren't on this copy of the schedule - the link may have been cut short when it was copied.");
    await page.cleanup();
    await arrive(`day=${YEAR}.sat.${tail(SAT[0])}-deadbeef`);
    expect(words(el("sharedSkipped"))).toBe("1 event in the link isn't on this copy of the schedule.");
    await page.cleanup();
    await arrive(`day=${YEAR}.sat.${tail(SAT[0])}-`);
    expect(sharedRows().map(r => r.dataset.id)).toEqual([SAT[0]]);
    expect(words(el("sharedSkipped"))).toBe("The link may have been cut short when it was copied.");
    await page.cleanup();
    await arrive(`day=${YEAR}.sat.deadbeef`);
    expect(sharedRows()).toEqual([]);
    expect(words(el("panel-shared"))).toContain("Nothing in the link is on this copy of the schedule.");
  });
  it("a removed event shows as removed, with no star; a cancelled one is marked; another day's carries its day", async () => {
    await arrive(dayQuery("sat", [REMOVED, CANCELLED, FRI[0]]));
    expect(sharedRows().map(r => r.dataset.id)).toEqual([FRI[0], CANCELLED, REMOVED]);
    expect(words(rowOf(FRI[0]).querySelector(".day"))).toBe("Fri");
    expect(rowOf(CANCELLED).querySelector(".day")).toBe(null);
    expect(rowOf(REMOVED).querySelector(".removed-tag")).not.toBe(null);
    expect(rowOf(REMOVED).querySelector(".star").disabled).toBe(true);
    expect(rowOf(CANCELLED).querySelector(".cancelled-tag")).not.toBe(null);
    expect(rowOf(CANCELLED).querySelector(".star").disabled).toBe(false);
  });
  it("another year's link is refused in plain words", async () => {
    await arrive(dayQuery("sat", [SAT[0]], YEAR - 1));
    expect(words(el("sheetTitleShared"))).toBe("A shared day");
    expect(document.activeElement).toBe(el("sheetTitleShared"));
    expect(words(el("panel-shared"))).toContain(`That link is a day from Dragon Con ${YEAR - 1}, and this planner is ${YEAR}'s, so there's nothing of it to show.`);
    expect(sharedRows()).toEqual([]);
    press(el("closeSheetShared"));
    expect(el("sheetWrap").hidden).toBe(true);
  });
  it("a link that does not parse opens nothing of the schedule and says why: cut short when it was copied", async () => {
    for (const query of [`day=${YEAR}.sa`, "day=", `day=${YEAR}.tue.${tail(SAT[0])}`]) {
      await arrive(query);
      expect(words(el("sheetTitleShared"))).toBe("A shared day");
      expect(words(el("panel-shared"))).toContain("That link doesn't hold a day of the schedule. It was probably cut short when it was copied - ask for it again, or copy all of it.");
      expect(sharedRows()).toEqual([]);
      await page.cleanup();
      page = null;
    }
  });
  it("a join wins - an invite in the address, or one the session kept - and the day is dropped", async () => {
    await arrive(`join=${YEAR}.tokZ&${dayQuery("sat", [SAT[0]])}`, { backend: fakeBackend() });
    expect(shown(el("panel-crew"))).toBe(true);
    expect(shown(el("panel-shared"))).toBe(false);
    expect(el("panel-shared").innerHTML).toBe("");
    expect(window.location.search).toBe(`?now=${NOW}`);
    await page.cleanup();
    await arrive(dayQuery("sat", [SAT[0]]), { backend: fakeBackend(), session: `${YEAR}.tokZ` });
    expect(shown(el("panel-crew"))).toBe(true);
    expect(el("panel-shared").innerHTML).toBe("");
    expect(window.location.search).toBe(`?now=${NOW}`);
  });
  it("with no schedule loaded, nothing opens", async () => {
    window.localStorage.clear();
    page = await bootPage({ data: { ...data, events: [] }, url: `https://example.test/?now=${NOW}&${dayQuery("sat", [SAT[0]])}` });
    expect(el("sheetWrap").hidden).toBe(true);
  });
  it("Escape closes it, and with nothing that opened it, focus is left to the page", async () => {
    await arrive(dayQuery("sat", [SAT[0]]));
    escape();
    expect(el("sheetWrap").hidden).toBe(true);
    expect(el("panel-shared").contains(document.activeElement)).toBe(false);
  });
});

describe("the new controls are 44px tall and labelled (#66)", () => {
  const css = fs.readFileSync(path.join(ROOT, "src", "styles.css"), "utf8");
  const rule = selector => (css.match(new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`)) || [])[2] || "";
  it("the share panel's chips, My day's strip and its view toggle", () => {
    for (const [selector, height] of [[".share-days .chip", "height: 44px"], [".plans-actions .btn", "height: 44px"], [".plans-seg button", "height: 44px"], [".view-toggle button", "height: 44px"]]) {
      expect(rule(selector), selector).toContain(height);
    }
  });
  it("the share panel's buttons and the shared day's Done are .btn, 46px", () => {
    expect(rule(".btn")).toContain("height: 46px");
  });
  it("the message's field stops short of the screen, and scrolls on its own", () => {
    expect(rule("#shareText")).toMatch(/max-height: 40dvh/);
  });
  it("the shared day's list has more of the screen than an event's description", () => {
    expect(rule("#sharedBody")).toMatch(/max-height: 55dvh/);
  });
});
