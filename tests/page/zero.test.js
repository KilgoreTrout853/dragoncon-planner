/* The zero state, in For you's place on Explore's grid (W16; DECISIONS #88):
   who sees "Start here" and who "The big ones", what each says, four rows
   and Show all, and its hold - kept through a star in it, and worked out
   again by a follow or a pick from anywhere else, as an empty For you
   always was (#87). What is chosen is tests/unit/foryou.test.js's; the real
   schedule's list is tests/real-data.test.js's.

   The sample has no Main Programming track, so the page is booted on a
   copy of it changed here: seven celebrity events put on that track that
   are still to start at the harness's Saturday afternoon - six with no
   fandom and one about Andor, whose star alone gives For you a row - with a
   second session of the first of them and one that has already started. */
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { typeInto } from "../helpers/act.js";

const NOW = "2026-09-05T13:05", BIG = "Main Programming", NOISE = ["Epic Photos", "Video Room"];
const LINE = "Tap a star and the event goes on your plan. Follow a track, a fandom or a guest below, and its events show up here.";
const HINT = "Follow a track, fandom or person and it'll show up here.";
const NOTHING = { kind: "work", key: "no-such-work" }, ANDOR = { kind: "work", key: "andor" };

function sampleWithBigOnes() {
  const data = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "sample-events.json"), "utf8"));
  const plainTags = { kind: "panel", works: [], medium: [], genre: [], craft: [], subject: [], audience: "all" };
  const sessionOf = e => (e.facets || {}).repeat_key || `title:${e.title}`;
  const usable = e => !e.cancelled && !(e.tracks || []).some(t => NOISE.includes(t)) && !["photo", "signing"].includes((e.tags || {}).kind);
  const byStart = (a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id < b.id ? -1 : 1);
  const convert = e => { e.tracks = [BIG]; e.track = BIG; e.tags = { ...plainTags, ...(e.tags || {}), guests: "celebrity" }; return e; };
  const sessions = new Set();
  const fresh = e => !sessions.has(sessionOf(e)) && !!sessions.add(sessionOf(e));

  const toCome = data.events.filter(e => e.start > NOW && usable(e)).sort(byStart);
  const andor = convert(toCome.find(e => ((e.tags || {}).works || []).some(w => w.id === "andor") && fresh(e)));
  const plain = [];
  for (const e of toCome) if (plain.length < 6 && !e.tags && fresh(e)) plain.push(convert(e));
  const twin = convert(toCome.filter(e => !e.tags && !plain.includes(e) && e.start > plain[0].start).pop());
  plain[0].facets = { ...plain[0].facets, repeat_key: "zero-test-twice" };
  twin.facets = { ...twin.facets, repeat_key: "zero-test-twice" };
  const started = convert(data.events.find(e => e.start < NOW && e.day === "2026-09-05" && usable(e) && !e.tags));
  /* A pick from elsewhere that brings no For you row and suggests nothing; and one that brings For you some. */
  const quiet = data.events.find(e => (e.tracks || []).length && e.tracks.every(t => NOISE.includes(t)) && !e.tags && !(e.people || []).length);
  const andorElsewhere = data.events.find(e => e.start > NOW && e !== andor && ((e.tags || {}).works || []).some(w => w.id === "andor") && usable(e));
  return { data, andor: andor.id, plain: plain.map(e => e.id), twin: twin.id, started: started.id, quiet: quiet.id, andorElsewhere: andorElsewhere.id,
    all: [andor, ...plain].sort(byStart).map(e => e.id) };
}

const el = id => document.getElementById(id);
const view = () => el("view-explore");
const kinds = of => [...of.children].map(c => `${c.tagName.toLowerCase()}${c.id ? `#${c.id}` : ""}.${c.className.split(" ").join(".")}`);
const words = node => node.textContent.replace(/\s+/g, " ").trim();
const heads = () => [...document.querySelectorAll("#zero .fy-head")].map(words);
const rowsOf = () => [...document.querySelectorAll("#zero .row")];
const ids = () => rowsOf().map(r => r.dataset.id);
const rowOf = id => rowsOf().find(r => r.dataset.id === id);
const showAll = () => document.querySelector('#zero [data-act="zero-all"]');
const gridHint = () => document.querySelector("#exploreGrid .hint");
const nav = tab => document.querySelector(`.nav button[data-tab="${tab}"]`).click();
const GRID = ["div.controls.controls-sticky", "div#exploreGrid."];
const BOTH = ["h2.fy-head", "p.fy-line", "h2.fy-head", "ul.list", "button.btn.quiet.more"];
const BIG_ALONE = ["h2.fy-head", "ul.list", "button.btn.quiet.more"];

describe("the zero state, at the top of Explore", () => {
  let page, app, handle, state, fx;
  const unmuteAll = () => app.mutes.slice().forEach(m => app.toggleMute(m.kind, m.key));
  /* The grid drawn from somewhere else, for a reader: its top is worked out. */
  const reader = (follows = [], picks = [], mutes = []) => {
    handle.closeSheet(); unmuteAll(); handle.picks.set(picks); handle.follows.set(follows);
    mutes.forEach(([kind, key]) => expect(app.toggleMute(kind, key)).toBe(true));
    Object.assign(state.explore, { page: null, q: "", forYou: null }); state.tab = "explore";
    handle.render();
  };
  /* A draw nobody tapped for, as a pull's is: the reader changed under the grid. */
  const pulled = (follows, picks) => { handle.follows.set(follows); handle.picks.set(picks); handle.render(); };
  const big = () => app.bigOnes(handle.now());
  const forYou = () => app.forYou(handle.now());

  beforeAll(async () => {
    fx = sampleWithBigOnes();
    page = await bootPage({ data: fx.data });
    ({ app, handle } = page); state = handle.state;
  }, 30000);
  afterAll(() => page.cleanup());

  describe("the schedule made here", () => {
    it("has seven big ones still to start, in time order and then by id: no second session, and nothing that has started", () => {
      reader();
      expect(fx.all.length).toBe(7);
      expect(big()).toEqual(fx.all);
      expect(big()).not.toContain(fx.twin);
      expect(big()).not.toContain(fx.started);
      expect([app.byId.get(fx.twin), app.byId.get(fx.started)].map(e => [e.track, app.isCeleb(e)])).toEqual([[BIG, true], [BIG, true]]);
    });
    it("a star on one with no fandom gives For you no row, and a star on the Andor one gives it some", () => {
      reader([], [fx.plain[1]]);
      expect(forYou()).toEqual([]);
      reader([], [fx.andor]);
      expect(forYou().length).toBeGreaterThan(0);
      reader([], [fx.quiet]);
      expect(forYou()).toEqual([]);
      reader([], [fx.andorElsewhere]);
      expect(forYou().length).toBeGreaterThan(0);
    });
  });

  describe("who sees which part", () => {
    it("a stranger sees both, first on the grid: Start here and its line, then The big ones, four rows and Show all - and no For you", () => {
      reader();
      expect(kinds(view())).toEqual(["section#zero.foryou.zero", ...GRID]);
      expect(kinds(el("zero"))).toEqual(BOTH);
      expect(heads()).toEqual(["Start here", "The big ones (7)"]);
      expect(words(el("zero").querySelector(".fy-line"))).toBe(LINE);
      expect(ids()).toEqual(fx.all.slice(0, 4));
      expect(words(showAll())).toBe("Show all 7");
      expect(el("foryou")).toBe(null);
    });
    it("each heading is a heading and no control, the count beside the big ones' in For you's look", () => {
      expect(el("zero").querySelector("button.fy-head, .fy-head button, .fy-head[tabindex]")).toBe(null);
      expect([...el("zero").querySelectorAll(".fy-head")].map(h => h.tagName)).toEqual(["H2", "H2"]);
      expect(words(el("zero").querySelector(".fy-head .count"))).toBe("(7)");
    });
    it("each row is of the list big, and says its day before its time and its track", () => {
      rowsOf().forEach((row, i) => {
        const ev = app.byId.get(fx.all[i]);
        expect(row.dataset.list).toBe("big");
        expect(words(row.querySelector(".when .day"))).toBe(app.DAY_LABEL[ev._cd]);
        expect(words(row.querySelector(".flags .track"))).toBe(BIG);
      });
    });
    it("the grid's hint is gone for a stranger: Start here says it", () => {
      expect(view().querySelector(".hint")).toBe(null);
    });
    it("a mute alone leaves a stranger a stranger: both parts, with the Muted fold after them", () => {
      reader([], [], [["track", "Science"]]);
      expect(kinds(view())).toEqual(["section#zero.foryou.zero", "section#muted.muted", ...GRID]);
      expect(heads()).toEqual(["Start here", "The big ones (7)"]);
      expect(gridHint()).toBe(null);
    });
    it("and a muted thing is not offered: Star Wars muted, the Andor one is out", () => {
      reader([], [], [["work", "star-wars"]]);
      expect(heads()).toEqual(["Start here", "The big ones (6)"]);
      expect(big()).toEqual(fx.all.filter(id => id !== fx.andor));
      expect(words(showAll())).toBe("Show all 6");
    });
    it("a pick with an empty For you: the big ones alone, less the pick, and the grid's hint kept", () => {
      reader([], [fx.plain[1]]);
      expect(el("foryou")).toBe(null);
      expect(view().firstElementChild).toBe(el("zero"));
      expect(kinds(el("zero"))).toEqual(BIG_ALONE);
      expect(heads()).toEqual(["The big ones (6)"]);
      expect(big()).toEqual(fx.all.filter(id => id !== fx.plain[1]));
      expect(ids()).toEqual(big().slice(0, 4));
      expect(words(gridHint())).toBe(HINT);
      expect(gridHint().previousElementSibling.className).toBe("section-title");
    });
    it("a picked event is never a big one, nor is its other session", () => {
      reader([], [fx.plain[0]]);
      expect(heads()).toEqual(["The big ones (6)"]);
      showAll().click();
      expect(ids()).toEqual(fx.all.filter(id => id !== fx.plain[0]));
      expect(ids()).not.toContain(fx.twin);
    });
    it("two stars on Main Programming are a reason of For you's - a track from two picks - and For you takes the place", () => {
      reader([], [fx.plain[0], fx.plain[3]]);
      expect(forYou().length).toBeGreaterThan(0);
      expect([el("zero"), view().firstElementChild]).toEqual([null, el("foryou")]);
    });
    it("a follow with an empty For you: the big ones alone, Following after them and open, and no hint", () => {
      reader([NOTHING]);
      expect(kinds(view())).toEqual(["section#zero.foryou.zero", "section#following.following", ...GRID]);
      expect(kinds(el("zero"))).toEqual(BIG_ALONE);
      expect(heads()).toEqual(["The big ones (7)"]);
      expect([document.querySelector("#following .fol-head").getAttribute("aria-expanded"), el("folBody").hidden]).toEqual(["true", false]);
      expect(view().querySelector(".hint")).toBe(null);
    });
    it("in its place among what stands above the sticky block: before Following, Because you starred and the Muted fold", () => {
      reader([NOTHING], [fx.plain[1]], [["track", "Science"]]);
      expect(kinds(view())).toEqual(["section#zero.foryou.zero", "section#following.following", "section#suggested.suggested", "section#muted.muted", ...GRID]);
    });
    it("a reader whose For you has a row sees neither", () => {
      reader([ANDOR]);
      expect(forYou().length).toBeGreaterThan(0);
      expect([el("zero"), view().firstElementChild]).toEqual([null, el("foryou")]);
      reader([], [fx.andor]);
      expect([el("zero"), view().firstElementChild]).toEqual([null, el("foryou")]);
    });
    it("after the con nothing is left to start: a stranger sees Start here alone, and a reader with a pick nothing", () => {
      reader();
      app.setTimeOverride("2026-09-09T12:00");
      expect(state.tab).toBe("explore");
      expect(kinds(el("zero"))).toEqual(["h2.fy-head", "p.fy-line"]);
      expect([heads(), words(el("zero").querySelector(".fy-line")), gridHint()]).toEqual([["Start here"], LINE, null]);
      handle.picks.set([fx.quiet]); handle.render();
      expect([el("zero"), words(gridHint())]).toEqual([null, HINT]);
      handle.picks.set([]);
      app.setTimeOverride(NOW);
      expect(heads()).toEqual(["Start here", "The big ones (7)"]);
    });
  });

  describe("four rows and Show all", () => {
    it("Show all is a quiet button after the list, saying how many there are in all", () => {
      reader();
      expect([words(showAll()), showAll().className, showAll().tagName]).toEqual(["Show all 7", "btn quiet more", "BUTTON"]);
      expect(showAll().previousElementSibling).toBe(el("zero").querySelector("ul.list"));
    });
    it("it opens the rest in place: the same four first, all seven in order, the count as it was and no button left", () => {
      const before = ids();
      showAll().click();
      expect(ids()).toEqual(fx.all);
      expect(ids().slice(0, 4)).toEqual(before);
      expect([showAll(), heads(), state.explore.forYou.zero.all]).toEqual([null, ["Start here", "The big ones (7)"], true]);
    });
    it("and is kept through a draw, and through a star in it", () => {
      handle.render();
      expect(ids()).toEqual(fx.all);
      rowOf(fx.plain[5]).querySelector(".star").click();
      expect([ids(), showAll()]).toEqual([fx.all, null]);
    });
    it("it is shut again once the grid is drawn from somewhere else", () => {
      nav("explore");
      expect([rowsOf().length, words(showAll())]).toEqual([4, "Show all 6"]);
    });
    it("a list of four or fewer has no Show all", () => {
      reader();
      app.setTimeOverride(app.byId.get(fx.all[3]).start);
      const left = big();
      expect([left.length > 0, left.length <= 4]).toEqual([true, true]);
      expect([ids(), showAll(), heads()]).toEqual([left, null, ["Start here", `The big ones (${left.length})`]]);
      app.setTimeOverride(NOW);
    });
  });

  describe("it holds still through a star in it", () => {
    let was;
    beforeAll(() => { reader(); showAll().click(); was = ids(); });
    const held = () => {
      expect(ids()).toEqual(was);
      expect(heads()).toEqual(["Start here", "The big ones (7)"]);
      expect([el("foryou"), view().firstElementChild, gridHint()]).toEqual([null, el("zero"), null]);
    };
    const starred = id => [rowOf(id).classList.contains("mine"), rowOf(id).querySelector(".star").getAttribute("aria-pressed")];

    it("a star on a big one: the row stays where it was, starred, under Start here, and the list is the list it was", () => {
      const at = was.indexOf(fx.plain[2]);
      rowOf(fx.plain[2]).querySelector(".star").click();
      expect(handle.picks.get().has(fx.plain[2])).toBe(true);
      held();
      expect([ids().indexOf(fx.plain[2]), starred(fx.plain[2])]).toEqual([at, [true, "true"]]);
      expect(big()).not.toContain(fx.plain[2]);              // worked out now, it would be gone, and Start here with it
    });
    it("and unstarred there, it stays too", () => {
      rowOf(fx.plain[2]).querySelector(".star").click();
      expect(handle.picks.get().size).toBe(0);
      held();
      expect(starred(fx.plain[2])).toEqual([false, "false"]);
    });
    it("a star that gives For you a row: For you waits, and what is on screen stays", () => {
      rowOf(fx.andor).querySelector(".star").click();
      expect(forYou().length).toBeGreaterThan(0);
      held();
      expect(starred(fx.andor)).toEqual([true, "true"]);
    });
    it("a second star, and Because you starred arriving under it", () => {
      rowOf(fx.plain[4]).querySelector(".star").click();
      held();
      expect(el("zero").nextElementSibling).toBe(el("suggested"));
    });
    it("a row tapped opens its event's sheet, and the sheet closed draws the list as it was", () => {
      rowOf(fx.plain[1]).querySelector(".row-main").click();
      expect([el("panel-event").hidden, state.sheetId]).toEqual([false, fx.plain[1]]);
      handle.closeSheet();
      held();
    });
    it("a draw nobody tapped for that brings a pick of one of its rows, as another device's star is: held, that row starred in its place", () => {
      pulled([], [fx.andor, fx.plain[4], fx.plain[0]]);
      held();
      expect(starred(fx.plain[0])).toEqual([true, "true"]);
      pulled([], [fx.plain[0]]);
      held();
      expect([starred(fx.andor), starred(fx.plain[0])]).toEqual([[false, "false"], [true, "true"]]);
    });
    it("the minute's tick draws nothing of it", () => {
      const node = el("zero");
      app.onMinute();
      expect(el("zero")).toBe(node);
    });
  });

  describe("a follow, or a pick from anywhere else, works the top out again on the grid", () => {
    it("a follow a pull brings to a stranger's phone: For you stands first at that redraw, and the zero state is gone", () => {
      reader();
      expect(heads()).toEqual(["Start here", "The big ones (7)"]);
      pulled([ANDOR], []);
      expect([el("zero"), view().firstElementChild]).toEqual([null, el("foryou")]);
      expect(document.querySelectorAll("#foryou .row").length).toBeGreaterThan(0);
    });
    it("a follow that brings For you nothing: the big ones stay, Start here goes", () => {
      reader();
      pulled([NOTHING], []);
      expect([heads(), el("foryou")]).toEqual([["The big ones (7)"], null]);
    });
    it("a follow taken, with nothing else changed: worked out again too, and Start here is back", () => {
      pulled([], []);
      expect(heads()).toEqual(["Start here", "The big ones (7)"]);
    });
    it("a pick from anywhere else that brings For you nothing: the big ones stay, Start here goes and the grid's hint is back", () => {
      reader();
      pulled([], [fx.quiet]);
      expect([heads(), el("foryou"), words(gridHint())]).toEqual([["The big ones (7)"], null, HINT]);
    });
    it("that pick taken again: Start here is back, and the hint gone", () => {
      pulled([], []);
      expect([heads(), gridHint()]).toEqual([["Start here", "The big ones (7)"], null]);
    });
    it("a pick from anywhere else that brings For you a row: For you, at that redraw", () => {
      reader();
      pulled([], [fx.andorElsewhere]);
      expect([el("zero"), view().firstElementChild]).toEqual([null, el("foryou")]);
    });
    it("a pick from anywhere else taken and another made in one draw, as a pull can bring: worked out again, though the reader has as many picks as before", () => {
      reader([], [fx.quiet]);
      expect(heads()).toEqual(["The big ones (7)"]);
      pulled([], [fx.andorElsewhere]);
      expect([el("zero"), view().firstElementChild]).toEqual([null, el("foryou")]);
    });
    it("after a star in it, a pick from anywhere else: the big ones less the starred one, and no Start here", () => {
      reader();
      rowOf(fx.plain[1]).querySelector(".star").click();
      expect(heads()).toEqual(["Start here", "The big ones (7)"]);
      pulled([], [fx.plain[1], fx.quiet]);
      expect(heads()).toEqual(["The big ones (6)"]);
      expect(ids()).not.toContain(fx.plain[1]);
    });
    it("an unmute on the grid is neither: the list held stays, without what was muted, until the grid is left", () => {
      reader([], [], [["work", "star-wars"]]);
      expect(heads()).toEqual(["Start here", "The big ones (6)"]);
      document.querySelector('#muted [data-act="explore-muted"]').click();
      document.querySelector('#muted [data-act="unmute"]').click();
      expect([app.mutes.length, big().length]).toEqual([0, 7]);
      expect(heads()).toEqual(["Start here", "The big ones (6)"]);
      nav("explore");
      expect(heads()).toEqual(["Start here", "The big ones (7)"]);
    });
    it("worked out again on the grid, Show all stays as it was", () => {
      reader();
      showAll().click();
      pulled([NOTHING], []);
      expect([heads(), ids(), showAll()]).toEqual([["The big ones (7)"], fx.all, null]);
    });
  });

  describe("and when the grid is drawn from somewhere else", () => {
    /* Each starts from a stranger's zero state with one row starred in it,
       behind Show all where it is not one of the first four. */
    const hold = id => {
      reader();
      if (!rowOf(id)) showAll().click();
      rowOf(id).querySelector(".star").click();
      expect([heads(), ids()]).toContainEqual(["Start here", "The big ones (7)"]);
      expect(ids()).toContain(id);
    };
    const less = id => {
      expect(el("foryou")).toBe(null);
      expect(heads()).toEqual(["The big ones (6)"]);
      expect(ids()).toEqual(fx.all.filter(x => x !== id).slice(0, 4));
      expect(words(gridHint())).toBe(HINT);
    };

    it("another tab and back: the big ones less the star, without Start here", () => {
      hold(fx.plain[1]); nav("plans");
      expect(state.explore.forYou).toBe(null);
      nav("explore"); less(fx.plain[1]);
    });
    it("another tab and back, where the star gives For you a row: For you in its place", () => {
      hold(fx.andor); nav("plans"); nav("explore");
      expect([el("zero"), view().firstElementChild]).toEqual([null, el("foryou")]);
    });
    it("a page and the way back", () => {
      hold(fx.plain[1]);
      view().querySelector("#exploreGrid .tile").click();
      expect([!!state.explore.page, state.explore.forYou]).toEqual([true, null]);
      document.querySelector('[data-act="explore-back"]').click(); less(fx.plain[1]);
    });
    it("the Explore tab tapped again", () => { hold(fx.plain[1]); nav("explore"); less(fx.plain[1]); });
    it("a return to the app", () => { hold(fx.plain[1]); app.onVisibleRender(); less(fx.plain[1]); });
    it("a new moment on the clock: what has started by then is not listed, and a second session stands for a first that has", () => {
      hold(fx.plain[1]);
      const later = "2026-09-06T09:00", toCome = id => +app.byId.get(id)._s > +new Date(later);
      app.setTimeOverride(later);
      expect(heads().join()).not.toMatch(/Start here/);
      if (showAll()) showAll().click();
      expect(toCome(fx.plain[0])).toBe(false);
      expect(ids()).toEqual([...fx.all, fx.twin].filter(id => id !== fx.plain[1] && toCome(id)));
      expect(ids()).toContain(fx.twin);
      app.setTimeOverride(NOW);
      less(fx.plain[1]);
    });
  });

  describe("the filter box is kept through a tap in it (DECISIONS #80)", () => {
    let node;
    const box = () => el("exploreQ");
    const jump = () => view().querySelector('[data-act="explore-jump"]');
    const drawn = during => { const chip = jump(); during(); return !chip.isConnected && jump() !== null && jump() !== chip; };
    const kept = () => {
      expect(box()).toBe(node);
      expect(document.activeElement).toBe(node);
      expect([node.value, node.selectionStart, node.selectionEnd]).toEqual(["sci", 1, 2]);
    };
    beforeAll(() => {
      reader();
      node = box(); node.focus(); typeInto(node, "sci"); node.setSelectionRange(1, 2);
    });
    afterAll(() => { document.activeElement.blur(); state.explore.q = ""; reader(); });

    it("typing draws the tiles and leaves the zero state alone, and no hint comes with them for a stranger", () => {
      const section = el("zero");
      typeInto(node, "sci"); node.setSelectionRange(1, 2);
      expect([el("zero"), gridHint()]).toEqual([section, null]);
      expect(view().querySelectorAll("#exploreGrid .tile").length).toBeGreaterThan(0);
      kept();
    });
    it("Show all draws the grid whole, and the box is the same node with its text, its focus and its caret", () => {
      expect(drawn(() => showAll().click())).toBe(true);
      expect(rowsOf().length).toBe(7);
      kept();
    });
    it("and a star on a big one", () => {
      const star = rowOf(fx.plain[3]).querySelector(".star");
      expect(drawn(() => star.click())).toBe(true);
      expect(rowOf(fx.plain[3]).querySelector(".star").getAttribute("aria-pressed")).toBe("true");
      kept();
      expect(kinds(view())).toEqual(["section#zero.foryou.zero", "section#suggested.suggested", ...GRID]);
    });
  });
});
