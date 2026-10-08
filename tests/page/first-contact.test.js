/* The first-contact pass (DECISIONS #101; docs/screens/contract.md, sections
   2, 5 and 6): what a stranger meets before anything is starred, and the top
   of Plans. The empty states name Explore beside Search; the Map's card with
   no pick says a hotel can be tapped, and says no such thing over a next
   pick; on Plans' top nothing is gold, Timeline | List is a segment under
   the two actions, and with no crew the rung is its own card's; and the
   crew panel's Done is quiet where the step has a main button of its own.
   The banner's words are tests/page/banner.test.js's.
   With no backend, and against the fake one, tests/helpers/backend.js. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { fakeBackend } from "../helpers/backend.js";
import { YY } from "../../src/season.js";

const fixture = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sample-events.json"), "utf8"));
const SATURDAY = "2026-09-05T13:05", AFTER_THE_CON = "2026-09-20T12:00";
/* Saturday's events still to start at 1:05 PM, in start order, each at a place the Map draws. */
const LATER = fixture.events.filter(e => e.start > "2026-09-05T14" && e.start < "2026-09-05T20" && /^(Hyatt|Marriott|Hilton|Westin)$/.test(e.hotel)).sort((a, b) => a.start.localeCompare(b.start)).map(e => e.id);
const HINT = "Tap a hotel to see its floors. Star things in Explore or Search and your next pick shows here.";

const el = id => document.getElementById(id);
const view = name => el(`view-${name}`);
const plans = () => view("plans");
const words = node => (node ? node.textContent.replace(/\s+/g, " ").trim() : "");
const tapTab = tab => document.querySelector(`.nav button[data-tab="${tab}"]`).click();
const seed = (name, value) => window.localStorage.setItem(`dc${YY}.${name}`, JSON.stringify(value));
/* Plans' top as it stands: each control above the plan, in the page's own
   order, by what it says and how it looks - gold, quiet, or a segment's. */
function top() {
  const plan = plans().querySelector(".tl-day, .list, .empty, .crew-person");
  const above = node => !plan || !!(node.compareDocumentPosition(plan) & Node.DOCUMENT_POSITION_FOLLOWING);
  return [...plans().querySelectorAll("button, select")].filter(above).map(b => {
    const look = b.closest(".seg") ? "segment" : b.classList.contains("quiet") ? "quiet" : b.classList.contains("btn") ? "gold" : b.tagName.toLowerCase();
    return `${words(b)}: ${look}${b.getAttribute("aria-pressed") === "true" ? ", pressed" : ""}`;
  });
}
const gold = () => top().filter(said => /: gold/.test(said));

describe("a stranger, on a build with no backend", () => {
  let page, handle;

  beforeAll(async () => {
    page = await bootPage({ now: SATURDAY });
    ({ handle } = page);
    handle.picks.set([]);
    handle.render();
  }, 30000);
  afterAll(() => page.cleanup());

  describe("the empty states name Explore beside Search", () => {
    it("Now, with nothing picked for later today", () => {
      tapTab("now");
      expect(words(view("now").querySelector(".empty"))).toBe("Nothing picked for later today. Star things in Explore or Search and they show up here with walk times.");
    });
    it("Plans, with nothing picked", () => {
      tapTab("plans");
      expect(words(plans().querySelector(".empty"))).toBe("Nothing picked yet. Star things in Explore or Search. They'll line up here by day with warnings when two picks overlap or the walk between hotels is too tight.");
    });
    it("the Map's card, which says first that a hotel can be tapped - words, and no tap of its own", () => {
      tapTab("map");
      const card = view("map").querySelector("#mapUnder .next-card");
      expect([card.tagName, card.className, words(card)]).toEqual(["DIV", "next-card empty", HINT]);
    });
    it("and Now after the con, the record with nothing in it", () => {
      handle.setTimeOverride(AFTER_THE_CON);
      tapTab("now");
      expect(words(view("now").querySelector(".empty"))).toBe("Nothing starred. Star things in Explore or Search and they'll be listed here by day.");
      handle.setTimeOverride(SATURDAY);
    });
    it("none of the four names Search alone", () => {
      const said = [];
      for (const tab of ["now", "plans", "map"]) { tapTab(tab); said.push(words(view(tab).querySelector(".empty, .next-card.empty"))); }
      expect(said.filter(s => /Star things in Explore or Search/.test(s))).toHaveLength(3);
      expect(said.filter(s => /in Search/.test(s))).toEqual([]);
    });
  });

  describe("the Map's card over a next pick says nothing of tapping a hotel", () => {
    it("a pick later today: the card is that pick's, a button, and the hint is nowhere on the tab", () => {
      handle.picks.set([LATER[0]]);
      tapTab("map");
      const card = el("mapNext");
      expect([card.tagName, card.dataset.hero]).toEqual(["BUTTON", LATER[0]]);
      expect(view("map").textContent).not.toMatch(/Tap a hotel/);
      expect(view("map").querySelector(".next-card.empty")).toBe(null);
    });
    it("unstarred again: the hint is back", () => {
      handle.picks.set([]);
      handle.render();
      expect(words(view("map").querySelector("#mapUnder .next-card"))).toBe(HINT);
    });
  });

  describe("the top of Plans", () => {
    it("no pick: the two actions, both quiet and both disabled, and no switch", () => {
      tapTab("plans");
      expect(top()).toEqual(["Export to calendar: quiet", "Share a day: quiet"]);
      expect([...plans().querySelectorAll(".plans-actions .btn")].map(b => b.disabled)).toEqual([true, true]);
      expect(plans().querySelector(".plans-view")).toBe(null);
    });
    it("with picks: the actions, quiet and live, then Timeline | List, a segment named View with Timeline pressed - and nothing gold", () => {
      handle.picks.set(LATER.slice(0, 3));
      handle.render();
      expect(top()).toEqual(["Export to calendar: quiet", "Share a day: quiet", "Timeline: segment, pressed", "List: segment"]);
      expect(gold()).toEqual([]);
      const view = plans().querySelector(".plans-view");
      expect([view.className, view.getAttribute("role"), view.getAttribute("aria-label")]).toEqual(["seg plans-seg plans-view", "group", "View"]);
      expect(view.previousElementSibling.className).toBe("plans-actions");
      expect(plans().querySelector(".view-toggle")).toBe(null);
    });
    it("a tap on List: the list, List pressed, and the switch where it was in the page", () => {
      plans().querySelector('[data-act="view-list"]').click();
      expect(top()).toEqual(["Export to calendar: quiet", "Share a day: quiet", "Timeline: segment", "List: segment, pressed"]);
      expect(plans().querySelector(".list")).not.toBe(null);
      expect(handle.state.mineView).toBe("list");
      plans().querySelector('[data-act="view-timeline"]').click();
      expect(handle.state.mineView).toBe("timeline");
    });
    it("a day's count is its class's, in My day's timeline and its list: no style of its own", () => {
      const counts = () => [...plans().querySelectorAll(".day-head .count")].map(c => [c.getAttribute("style"), c.textContent]);
      expect(counts()).toEqual([[null, "3"]]);
      plans().querySelector('[data-act="view-list"]').click();
      expect(counts()).toEqual([[null, "3"]]);
      plans().querySelector('[data-act="view-timeline"]').click();
    });
  });
});

describe("the top of Plans on a build with a backend, and the crew panel's Done", () => {
  const signIn = (fake, user) => {
    const s = fake.issue(user.id);
    seed("session", { access_token: s.access_token, refresh_token: s.refresh_token, user: { id: user.id, email: user.email || "", is_anonymous: user.is_anonymous } });
    seed("syncStamp", { user: user.id, picks: null, follows: null });
  };

  describe("no crew", () => {
    let page, app, handle, fake;

    beforeAll(async () => {
      fake = fakeBackend();
      signIn(fake, fake.held("ada@example.test"));
      page = await bootPage({ backend: fake, now: SATURDAY });
      ({ app, handle } = page);
      await app.syncSettled();
      handle.picks.set([]);
      tapTab("plans");
      await app.syncSettled();
    }, 30000);
    afterAll(() => page.cleanup());

    it("no pick: the rung's card first - its line and its two quiet buttons - then the two quiet actions, and nothing gold", () => {
      const rung = plans().firstElementChild;
      expect(rung.className).toBe("crew-head crew-rung");
      expect([...rung.children].map(c => c.tagName === "P" ? words(c) : c.className)).toEqual(["Start a crew, or paste an invite link.", "crew-rung-btns"]);
      expect(top()).toEqual(["Start a crew: quiet", "Join with a link: quiet", "Export to calendar: quiet", "Share a day: quiet"]);
      expect(gold()).toEqual([]);
    });
    it("with picks: the rung, the actions, then the view's switch, in that order", () => {
      handle.picks.set(LATER.slice(0, 2));
      handle.render();
      expect(top()).toEqual(["Start a crew: quiet", "Join with a link: quiet", "Export to calendar: quiet", "Share a day: quiet", "Timeline: segment, pressed", "List: segment"]);
      expect(gold()).toEqual([]);
      expect(el("plansViewMine")).toBe(null);
    });
    it("the crew panel's create step: Create is the gold one, and Done is quiet", () => {
      el("crewStartBtn").click();
      expect(words(el("sheetTitleCrew"))).toBe("Start a crew");
      expect([el("crewCreate").className, el("closeSheetCrew").className]).toEqual(["btn", "btn quiet"]);
      el("closeSheetCrew").click();
    });
    it("its join step: Join is the gold one, and Done is quiet", () => {
      el("crewJoinBtn").click();
      expect(words(el("sheetTitleCrew"))).toBe("Join a crew");
      expect([el("crewJoinSubmit").className, el("closeSheetCrew").className]).toEqual(["btn", "btn quiet"]);
      el("closeSheetCrew").click();
    });
  });

  describe("in a crew", () => {
    let page, app, fake;

    beforeAll(async () => {
      fake = fakeBackend();
      const [ada, bo] = ["ada", "bo"].map(n => fake.held(`${n}@example.test`));
      fake.crew({ name: "The crew", creator: ada.id, members: [[ada.id, "Ada"], [bo.id, "Bo"]] });
      for (const id of LATER.slice(0, 2)) fake.write(ada.id, "picks", { event_id: id, picked: true, changed_at: new Date(Date.parse("2026-09-01T12:00:00Z")).toISOString() });
      signIn(fake, ada);
      seed("picks", LATER.slice(0, 2));
      seed("plansView", "mine");
      page = await bootPage({ backend: fake, now: SATURDAY });
      ({ app } = page);
      await app.syncSettled();
      tapTab("plans");
      await app.syncSettled();
    }, 30000);
    afterAll(() => page.cleanup());

    it("My day: the crew's head as built, My day | Crew, the two quiet actions, then Timeline | List - two segments, the wide one first, and nothing gold", () => {
      expect(top()).toEqual(["Manage: quiet", "My day: segment, pressed", "Crew: segment", "Export to calendar: quiet", "Share a day: quiet", "Timeline: segment, pressed", "List: segment"]);
      expect(gold()).toEqual([]);
      expect([...plans().querySelectorAll(".seg")].map(s => s.className)).toEqual(["seg plans-seg", "seg plans-seg plans-view"]);
      expect(plans().firstElementChild.className).toBe("crew-head");
    });
    it("Crew: the crew's day has neither the actions nor the view's switch", () => {
      el("plansViewCrew").click();
      expect(top().slice(0, 3)).toEqual(["Manage: quiet", "My day: segment", "Crew: segment, pressed"]);
      expect([plans().querySelector(".plans-actions"), plans().querySelector(".plans-view")]).toEqual([null, null]);
      expect(gold()).toEqual([]);
      el("plansViewMine").click();
    });
    it("the crew panel's manage step has no main button of its own: Done is the gold one", () => {
      el("crewManageBtn").click();
      expect(words(el("sheetTitleCrew"))).toBe("The crew");
      expect(el("closeSheetCrew").className).toBe("btn");
      expect([...el("crewManage").querySelectorAll("button")].filter(b => b.classList.contains("btn") && !b.classList.contains("quiet") && !b.classList.contains("danger"))).toEqual([]);
      el("closeSheetCrew").click();
    });
  });
});
