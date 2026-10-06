/* In place of a pick (W2; DECISIONS #90): under the picks-changed notice, on
   Now and on Plans' My day, a fold for each change that vacated time, and
   in it the few events that start in that time - and the hold that keeps
   them still while the reader stays on the tab. What is offered is
   foryou.js's inPlace(), which tests/unit/foryou.test.js holds; the news and
   the times are pick-news.test.js's. The situation arrives as it does on a
   phone: picks, snapshots and an old line of news in storage, and a boot
   against a copy of the sample that has moved on. New tests: no harness
   line.

   The news, in its order, at Saturday 1:05 PM:
     0  a line stored before this, with no time recorded
     1  s0254 Q&A: Sandman Panel, Hilton, Sat 4:00-5:00 PM - cancelled
     2  s0450 Cyberpunk Roundtable - moved to Sun 10:00 AM; it was Sun 4:00-5:00 PM
     3  s0268 Fan Panel: Pathfinder Retrospective - another room, the same time
     4  s0302 Screening: Dune Retrospective, Westin, Sat 5:30-6:30 PM - removed
     5  Hazbin Hotel Cast, Hilton, Sun 1:00-2:00 PM - gone
   Nothing scores for this reader, so a fold's rows are those in the vacated
   building first, then by start, then by id. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { YY } from "../../src/season.js";
import { bootPage } from "../helpers/page.js";

const sample = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sample-events.json"), "utf8"));
const SATURDAY = "2026-09-05T13:05";
const of = id => sample.events.find(e => e.id === id);
const snapshot = e => ({ title: e.title, start: e.start, location: e.location || "", end: e.end, hotel: e.hotel });
const seed = (key, value) => window.localStorage.setItem(`dc${YY}.${key}`, JSON.stringify(value));
const stored = key => JSON.parse(window.localStorage.getItem(`dc${YY}.${key}`));
const words = node => (node ? node.textContent.replace(/\s+/g, " ").trim() : null);
const view = name => document.getElementById(`view-${name}`);
const tapTab = tab => document.querySelector(`.nav button[data-tab="${tab}"]`).click();
const before = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

/* The folds of a tab, each by its entry: its button, whether it is open, and
   the ids of its rows. */
const folds = tab => [...view(tab).querySelectorAll(".divider.fold.in-place")].map(div => {
  const button = div.querySelector("button"), list = div.nextElementSibling && div.nextElementSibling.matches("ul.list") ? div.nextElementSibling : null;
  return { entry: Number(button.dataset.fold), button, open: button.getAttribute("aria-expanded") === "true", list, rows: list ? [...list.querySelectorAll(".row")].map(r => r.dataset.id) : [] };
});
const fold = (tab, entry) => folds(tab).find(f => f.entry === entry) || null;
const entries = tab => folds(tab).map(f => f.entry);
const opened = tab => folds(tab).filter(f => f.open).map(f => f.entry);
function press(node) { node.focus(); node.click(); }

const CANCELLED = "s0254", MOVED = "s0450", ROOM = "s0268", REMOVED = "s0302";
const data = { ...sample, events: sample.events.map(e => (e.id === CANCELLED ? { ...e, cancelled: true, title: `CANCELLED: ${e.title}` } : e.id === REMOVED ? { ...e, removed: true } : e)) };
const OLD = { kind: "moved", title: "An older change", was: "Fri 1:00 PM, Hilton Salon", now: "Fri 2:30 PM, Hilton Salon" };
const HILTON_AT_4 = ["s0223", "s0257", "s0267"];

describe("under the picks-changed notice: a fold for each change that vacated time", () => {
  let page, app, handle;
  const PICKS = [CANCELLED, MOVED, ROOM, REMOVED, "ghost-1"];

  beforeAll(async () => {
    seed("picks", PICKS);
    seed("pickInfo", {
      [CANCELLED]: snapshot(of(CANCELLED)),
      [MOVED]: { ...snapshot(of(MOVED)), start: "2026-09-06T16:00", end: "2026-09-06T17:00" },
      [ROOM]: { ...snapshot(of(ROOM)), location: "Westin Somewhere Else" },
      [REMOVED]: snapshot(of(REMOVED)),
      "ghost-1": { title: "Hazbin Hotel Cast", start: "2026-09-06T13:00", location: "Hilton Salon", end: "2026-09-06T14:00", hotel: "Hilton" },
    });
    seed("pickNews", [OLD]);
    page = await bootPage({ data, now: SATURDAY });
    ({ app, handle } = page);
  }, 30000);
  afterAll(() => page.cleanup());

  it("the notice says all six, and four of them vacated time", () => {
    expect([...view("now").querySelectorAll(".pick-news li")].map(words)).toEqual([
      "An older change moved to Fri 2:30 PM, Hilton Salon. It was Fri 1:00 PM, Hilton Salon.",
      "Q&A: Sandman Panel was cancelled. It was Sat 4:00 PM, Hilton 313-314. It stays in Plans, marked.",
      "Cyberpunk Roundtable moved to Sun 10:00 AM, Courtland Grand Atlanta 3-4. It was Sun 4:00 PM, Courtland Grand Atlanta 3-4.",
      "Fan Panel: Pathfinder Retrospective moved to Sat 7:00 PM, Westin Chastain F. It was Sat 7:00 PM, Westin Somewhere Else.",
      "Screening: Dune Retrospective was removed from the schedule. It was Sat 5:30 PM, Westin Augusta 3. It stays in Plans, marked.",
      "Hazbin Hotel Cast was removed from the schedule. It was Sun 1:00 PM, Hilton Salon.",
    ]);
    expect(stored("pickNews").map(n => !!n.vacated)).toEqual([false, true, true, false, true, true]);
  });
  it("a fold for a cancelled, a moved, a removed and a gone pick, in the news's order - and none for a room alone, nor for a line stored before", () => {
    expect(folds("now").map(f => words(f.button))).toEqual([
      "In place of Q&A: Sandman Panel, Sat 4:00 PM (3) ▸",
      "In place of Cyberpunk Roundtable, Sun 4:00 PM (3) ▸",
      "In place of Screening: Dune Retrospective, Sat 5:30 PM (3) ▸",
      "In place of Hazbin Hotel Cast, Sun 1:00 PM (3) ▸",
    ]);
    expect(entries("now")).toEqual([1, 2, 4, 5]);
  });
  it("they stand under the notice's box and before whatever follows it, each shut until tapped", () => {
    const notice = view("now").querySelector(".pick-news"), all = folds("now");
    expect(notice.nextElementSibling).toBe(all[0].button.parentElement);
    expect(all[all.length - 1].button.parentElement.nextElementSibling).toBe(document.getElementById("nowHero"));
    expect(opened("now")).toEqual([]);
    expect(view("now").querySelector('.row[data-list^="in-place"]')).toBe(null);
  });
  it("each is the app's fold - a button that says whether it is open - with an id of its own, its arrow hidden from a screen reader", () => {
    for (const f of folds("now")) {
      expect([f.button.parentElement.className, f.button.dataset.act, f.button.id, f.button.getAttribute("aria-expanded")])
        .toEqual(["divider fold in-place", "in-place", `inPlace-now-${f.entry}`, "false"]);
      expect(f.button.querySelector('span[aria-hidden="true"]').textContent).toBe("▸");
    }
  });
  it("tapped, it opens to its rows - three, those in the vacated building first - and the others stay shut; focus is on the fold tapped", () => {
    press(fold("now", 1).button);
    expect(opened("now")).toEqual([1]);
    expect(fold("now", 1).rows).toEqual(HILTON_AT_4);
    expect(words(fold("now", 1).button)).toBe("In place of Q&A: Sandman Panel, Sat 4:00 PM (3) ▾");
    expect(document.activeElement).toBe(fold("now", 1).button);
    expect(HILTON_AT_4.map(id => [app.byId.get(id).hotel, app.byId.get(id).start])).toEqual(Array(3).fill(["Hilton", "2026-09-05T16:00"]));
  });
  it("a row is the app's row, with no day on it, and its list names the tab and the entry; one that scored nothing says no reason, and says its track", () => {
    for (const row of fold("now", 1).list.querySelectorAll(".row")) {
      expect(row.dataset.list).toBe("in-place:now:1");
      expect(row.querySelector(".day")).toBe(null);
      expect(row.querySelector(".status")).toBe(null);
      expect(words(row.querySelector(".track"))).toBe(app.byId.get(row.dataset.id).track);
      expect(row.querySelector(".star").getAttribute("aria-pressed")).toBe("false");
    }
  });
  it("tapped again, it shuts", () => {
    press(fold("now", 1).button);
    expect(opened("now")).toEqual([]);
    expect(fold("now", 1).list).toBe(null);
    press(fold("now", 1).button);
    expect(opened("now")).toEqual([1]);
  });

  describe("it holds still while the reader stays on the tab", () => {
    it("a star in it leaves the rows as they were, the starred one starred in its place", () => {
      fold("now", 1).list.querySelector('.row[data-id="s0257"] .star').click();
      expect(handle.picks.get().has("s0257")).toBe(true);
      expect(fold("now", 1).rows).toEqual(HILTON_AT_4);
      expect(opened("now")).toEqual([1]);
      const row = fold("now", 1).list.querySelector('.row[data-id="s0257"]');
      expect([row.classList.contains("mine"), row.querySelector(".star").getAttribute("aria-pressed")]).toEqual([true, "true"]);
      expect(words(fold("now", 1).button)).toMatch(/\(3\) ▾$/);
    });
    it("a draw of the same tab - a sheet closed, the page drawn again - keeps the rows and the open fold", () => {
      handle.openSheet("event", "s0223");
      handle.closeSheet();
      handle.render();
      expect([opened("now"), fold("now", 1).rows]).toEqual([[1], HILTON_AT_4]);
    });
    it("the minute's tick keeps them, though they started twenty minutes ago by then", () => {
      app.setOverride("2026-09-05T16:20");
      app.tickNow();
      expect(document.getElementById("nowHero").dataset.hero).toBe("s0257");          // the tick drew the tab again: the starred one is on
      expect([opened("now"), fold("now", 1).rows]).toEqual([[1], HILTON_AT_4]);
    });
    it("a new moment works it out again: the 4:00 PM events are no longer offered, so that fold is gone, and its line stays in the notice", () => {
      handle.setTimeOverride("2026-09-05T16:20");
      expect(entries("now")).toEqual([2, 4, 5]);
      expect(opened("now")).toEqual([]);
      expect(view("now").querySelectorAll(".pick-news li")).toHaveLength(6);
      expect(words(view("now").querySelector(".pick-news"))).toMatch(/Q&A: Sandman Panel was cancelled/);
    });
    it("and back at 1:05 PM the starred event is a pick: what overlaps it is barred, the time it fills has no fold, and the line is kept", () => {
      handle.setTimeOverride(SATURDAY);
      expect(entries("now")).toEqual([2, 4, 5]);
      expect(view("now").querySelectorAll(".pick-news li")).toHaveLength(6);
      handle.picks.set(PICKS.filter(id => id !== "ghost-1"));
      tapTab("now");
      expect(entries("now")).toEqual([1, 2, 4, 5]);
    });
    it("a tap on the nav lets it go, the tab already on: the folds are shut again", () => {
      press(fold("now", 2).button);
      expect(opened("now")).toEqual([2]);
      tapTab("now");
      expect(opened("now")).toEqual([]);
    });
    it("a return to the app lets it go", () => {
      press(fold("now", 2).button);
      document.dispatchEvent(new Event("visibilitychange"));
      expect(opened("now")).toEqual([]);
    });
    it("a draw of another tab lets it go: back on Now it is worked out again", () => {
      press(fold("now", 1).button);
      handle.follows.set([{ kind: "track", key: "Puppetry" }]);
      handle.render();
      expect(opened("now")).toEqual([1]);                                              // a follow from elsewhere, drawn on the same tab: as it was
      expect(fold("now", 1).list.querySelector(".status")).toBe(null);
      handle.state.tab = "browse";
      handle.render();
      handle.state.tab = "now";
      handle.render();
      expect(opened("now")).toEqual([]);
    });
  });

  describe("a reason, where a row has one", () => {
    it("is said as For you says it, the track left unsaid where the reason names it; a row beside it with none says its track", () => {
      press(fold("now", 1).button);
      const rows = [...fold("now", 1).list.querySelectorAll(".row")];
      expect(rows.map(r => r.dataset.id)).toEqual(HILTON_AT_4);                        // the Puppet Slam scores now, and was first already
      expect([words(rows[0].querySelector(".status")), rows[0].querySelector(".track")]).toEqual(["You follow Puppetry", null]);
      expect([rows[1].querySelector(".status"), words(rows[1].querySelector(".track"))]).toEqual([null, app.byId.get("s0257").track]);
    });
    it("and a row that scores comes first, whatever its building: the 5:30 PM Puppet Slam, at the Hilton, in place of a Westin pick", () => {
      press(fold("now", 4).button);
      expect(fold("now", 4).rows).toEqual(["s0250", "s0224", "s0275"]);
      expect(words(fold("now", 4).list.querySelector(".row .status"))).toBe("You follow Puppetry");
      handle.follows.set([]);
    });
  });

  describe("My day", () => {
    it("the same folds, worked out again and shut, under the notice and before the action strip", () => {
      tapTab("plans");
      expect(entries("plans")).toEqual([1, 2, 4, 5]);
      expect(opened("plans")).toEqual([]);
      const notice = view("plans").querySelector(".pick-news"), all = folds("plans");
      expect(notice.nextElementSibling).toBe(all[0].button.parentElement);
      expect(all[all.length - 1].button.parentElement.nextElementSibling.className).toBe("plans-actions");
      expect(all.map(f => f.button.id)).toEqual([1, 2, 4, 5].map(n => `inPlace-plans-${n}`));
    });
    it("opened, its rows' list names this tab - the other tab, hidden, still holds the same event in the same fold", () => {
      press(fold("plans", 1).button);
      expect(fold("plans", 1).rows).toEqual(HILTON_AT_4);
      expect(document.activeElement).toBe(fold("plans", 1).button);
      expect([...fold("plans", 1).list.querySelectorAll(".row")].map(r => r.dataset.list)).toEqual(Array(3).fill("in-place:plans:1"));
      expect(view("now").hidden).toBe(true);
      expect(view("now").querySelector('.row[data-id="s0223"]').dataset.list).toBe("in-place:now:1");
      expect(document.querySelectorAll('.row[data-id="s0223"][data-list="in-place:plans:1"]')).toHaveLength(1);
      expect(before(view("now").querySelector('.row[data-id="s0223"]'), fold("plans", 1).list)).toBe(true);
    });
    it("a star in it holds there too, through My day's own controls", () => {
      fold("plans", 1).list.querySelector('.row[data-id="s0267"] .star').click();
      view("plans").querySelector('[data-act="view-list"]').click();
      expect([opened("plans"), fold("plans", 1).rows]).toEqual([[1], HILTON_AT_4]);
      expect(fold("plans", 1).list.querySelector('.row[data-id="s0267"] .star').getAttribute("aria-pressed")).toBe("true");
      view("plans").querySelector('[data-act="view-timeline"]').click();
    });
    it("back on Now, that time is filled: no fold for it, and its line kept", () => {
      tapTab("now");
      expect(entries("now")).toEqual([2, 4, 5]);
      expect(view("now").querySelectorAll(".pick-news li")).toHaveLength(6);
    });
  });

  describe("OK", () => {
    it("takes the notice and every fold with it, on both tabs, and nothing is stored", () => {
      press(fold("now", 2).button);
      view("now").querySelector('[data-act="dismiss-news"]').click();
      expect(view("now").querySelector(".pick-news")).toBe(null);
      expect(folds("now")).toEqual([]);
      expect(view("now").querySelector('.row[data-list^="in-place"]')).toBe(null);
      expect(stored("pickNews")).toEqual([]);
      tapTab("plans");
      expect([view("plans").querySelector(".pick-news"), folds("plans")]).toEqual([null, []]);
    });
  });
});

describe("a hold with no fold is not kept", () => {
  let page, handle;
  const BLOCK = "s0257";                                                              // the Hilton, 4:00-5:00 PM: it overlaps everything in the hour

  beforeAll(async () => {
    seed("picks", [CANCELLED, BLOCK]);
    seed("pickInfo", { [CANCELLED]: snapshot(of(CANCELLED)), [BLOCK]: snapshot(of(BLOCK)) });
    page = await bootPage({ data, now: SATURDAY });
    ({ handle } = page);
  }, 30000);
  afterAll(() => page.cleanup());

  it("the hour is filled by another pick: the line, and no fold", () => {
    expect(view("now").querySelectorAll(".pick-news li")).toHaveLength(1);
    expect(folds("now")).toEqual([]);
  });
  it("that pick unstarred on the same tab: the fold is there at the next draw, since there was nothing on screen to hold still", () => {
    tapTab("plans");
    handle.state.mineView = "list";
    handle.render();
    expect(folds("plans")).toEqual([]);
    view("plans").querySelector(`.row[data-list="mine"][data-id="${BLOCK}"] .star`).click();
    expect(entries("plans")).toEqual([0]);
    expect(words(fold("plans", 0).button)).toBe("In place of Q&A: Sandman Panel, Sat 4:00 PM (3) ▸");
  });
});

describe("after the con", () => {
  let page;
  beforeAll(async () => {
    seed("picks", [CANCELLED]);
    seed("pickInfo", { [CANCELLED]: snapshot(of(CANCELLED)) });
    page = await bootPage({ data, now: "2026-09-08T10:00" });
  }, 30000);
  afterAll(() => page.cleanup());

  it("the record says the news, and offers nothing in place: nothing is left to start", () => {
    expect(view("now").querySelectorAll(".pick-news li")).toHaveLength(1);
    expect(folds("now")).toEqual([]);
  });
});
