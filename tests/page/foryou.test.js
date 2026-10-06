/* For you, the first thing on Explore's grid (W3; DECISIONS #87): where it
   stands and what it says, the list held while the reader stays on the
   grid and worked out again when the grid is drawn from somewhere else,
   Following's fold under it, and the filter box kept through its taps
   (#80). What scores and what is chosen are tests/unit/foryou.test.js's; the
   real schedule's rows are tests/real-data.test.js's. On the sample, at the
   harness's Saturday afternoon. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { fakeBackend } from "../helpers/backend.js";
import { typeInto } from "../helpers/act.js";
import { YY } from "../../src/season.js";

const el = id => document.getElementById(id);
const view = () => el("view-explore");
const kinds = of => [...of.children].map(c => `${c.tagName.toLowerCase()}${c.id ? `#${c.id}` : ""}.${c.className.split(" ").join(".")}`);
const words = node => node.textContent.replace(/\s+/g, " ").trim();
const rowsOf = () => [...document.querySelectorAll("#foryou .row")];
const ids = () => rowsOf().map(r => r.dataset.id);
const more = () => document.querySelector('#foryou [data-act="foryou-more"]');
const folHead = () => document.querySelector("#following .fol-head");
const stored = name => JSON.parse(window.localStorage.getItem(`dc${YY}.${name}`));
const nav = tab => document.querySelector(`.nav button[data-tab="${tab}"]`).click();
const TRACK = key => ({ kind: "track", key });

describe("For you, at the top of Explore", () => {
  let page, app, handle, state, five, person;
  /* The grid drawn from somewhere else, for a reader: the list is worked out. */
  const reader = (follows, picks = []) => {
    handle.closeSheet(); handle.picks.set(picks); handle.follows.set(follows);
    Object.assign(state.explore, { page: null, q: "", forYou: null }); state.tab = "explore";
    handle.render();
  };
  const chosen = () => app.forYou(handle.now());

  beforeAll(async () => {
    page = await bootPage(); ({ app, handle } = page); state = handle.state;
    /* five tracks with three events or more still to start, and a person with some */
    const at = handle.now(), left = follow => app.eventsFor(follow).filter(e => e._s > at).length;
    five = app.getCatalogue().track.filter(t => !app.NOISE_TRACKS.has(t.key) && left(TRACK(t.key)) >= 3).slice(0, 5).map(t => t.key);
    person = app.getCatalogue().person.find(t => left({ kind: "person", key: t.key }) >= 3).key;
    expect(five.length).toBe(5);
  }, 30000);
  afterAll(() => page.cleanup());

  describe("who gets one", () => {
    it("a reader with no pick and no follow gets none: the grid's top is as it was, the hint line and all", () => {
      reader([]);
      expect(el("foryou")).toBe(null);
      expect(kinds(view())).toEqual(["div.controls.controls-sticky", "div#exploreGrid."]);
      expect(words(view().querySelector(".hint"))).toBe("Follow a track, fandom or person and it'll show up here.");
    });
    it("a reader with a follow that brings nothing gets none - never a heading over nothing - and Following stands first", () => {
      reader([{ kind: "work", key: "no-such-work" }]);
      expect(el("foryou")).toBe(null);
      expect(view().firstElementChild).toBe(el("following"));
    });
    it("nor does anyone once the con is over", () => {
      reader(five.map(TRACK));
      expect(el("foryou")).not.toBe(null);
      app.setTimeOverride("2026-09-09T12:00");
      expect([state.tab, el("foryou")]).toEqual(["explore", null]);
      app.setTimeOverride("2026-09-05T13:05");
      expect(el("foryou")).not.toBe(null);
    });
  });

  describe("where it stands and what it says", () => {
    beforeAll(() => reader(five.map(TRACK)));

    it("first above the sticky block, then Following, the sticky block and the grid", () => {
      expect(kinds(view())).toEqual(["section#foryou.foryou", "section#following.following", "div.controls.controls-sticky", "div#exploreGrid."]);
    });
    it("a heading that is no control, with the rows chosen counted, and one line under it", () => {
      const head = el("foryou").firstElementChild;
      expect([head.tagName, head.className, words(head)]).toEqual(["H2", "fy-head", "For you (8)"]);
      expect(el("foryou").querySelector("button.fy-head, .fy-head button, .fy-head[tabindex]")).toBe(null);
      expect(words(head.nextElementSibling)).toBe("From your follows and stars. Fits the gaps in your plan.");
      expect(head.nextElementSibling.className).toBe("fy-line");
    });
    it("the first four rows of what foryou.js chose, in time order, each of the list foryou", () => {
      const all = chosen();
      expect(all.length).toBe(8);
      expect(ids()).toEqual(all.slice(0, 4).map(r => r.id));
      const starts = ids().map(id => +app.byId.get(id)._s);
      expect(starts).toEqual([...starts].sort((a, b) => a - b));
      expect(rowsOf().map(r => r.dataset.list)).toEqual(["foryou", "foryou", "foryou", "foryou"]);
    });
    it("each says its day before its time, and its reason on line 3, in the status span", () => {
      const all = chosen();
      rowsOf().forEach((row, i) => {
        expect(words(row.querySelector(".when .day"))).toBe(app.DAY_LABEL[app.byId.get(all[i].id)._cd]);
        expect(words(row.querySelector(".flags .status"))).toBe(`You follow ${all[i].reason.name}`);
      });
    });
    it("then Show more, a quiet button, saying how many", () => {
      expect([words(more()), more().className, more().tagName]).toEqual(["Show 4 more", "btn quiet more", "BUTTON"]);
      expect(more().previousElementSibling).toBe(el("foryou").querySelector("ul.list"));
    });
    it("Show more opens the rest in place: the same list, all eight in time order, the count as it was and no button left", () => {
      const before = ids(), all = chosen().map(r => r.id);
      more().click();
      expect(ids()).toEqual(all);
      expect(ids().slice(0, 4)).toEqual(before);
      expect([more(), words(el("foryou").firstElementChild), state.explore.forYou.more]).toEqual([null, "For you (8)", true]);
    });
    it("a list of four or fewer has no Show more", () => {
      reader(five.slice(0, 2).map(TRACK));
      expect([rowsOf().length, more(), words(el("foryou").firstElementChild)]).toEqual([4, null, "For you (4)"]);
    });
  });

  describe("the reason and the row's track", () => {
    it("a reason that names the row's own track leaves the track unsaid; any other row says its track", () => {
      const seen = { unsaid: 0, said: 0 };
      for (const follows of [five.map(TRACK), [{ kind: "person", key: person }]]) {
        reader(follows);
        if (more()) more().click();
        const all = chosen();
        expect(all.length).toBeGreaterThan(0);
        rowsOf().forEach((row, i) => {
          const ev = app.byId.get(all[i].id), track = row.querySelector(".flags .track");
          if (all[i].reason.name === ev.track) { expect(track, ev.title).toBe(null); seen.unsaid++; }
          else if (ev.track) { expect(words(track), ev.title).toBe(ev.track); seen.said++; }
        });
      }
      expect(seen.unsaid).toBeGreaterThan(0);
      expect(seen.said).toBeGreaterThan(0);
    });
    it("a pick's reason reads Like your picks: and a follow's You follow", () => {
      const track = five[0], two = app.eventsFor(TRACK(track)).filter(e => e._s > handle.now()).slice(-2).map(e => e.id);
      reader([], two);
      const said = rowsOf().map(r => words(r.querySelector(".flags .status")));
      expect(said.length).toBeGreaterThan(0);
      expect(said).toContain(`Like your picks: ${track}`);
      said.forEach(s => expect(s).toMatch(/^Like your picks: /));
      reader([TRACK(track)], two);
      expect(rowsOf().map(r => words(r.querySelector(".flags .status")))).toContain(`You follow ${track}`);
    });
  });

  describe("it holds still while the reader stays on the grid", () => {
    let was;
    beforeAll(() => { reader(five.map(TRACK)); state.following.open = true; handle.render(); was = ids(); });
    afterAll(() => { state.following.open = null; });
    const held = () => { expect(ids()).toEqual(was); expect(words(el("foryou").firstElementChild)).toBe("For you (8)"); };

    it("a star on a For you row: the row stays where it was, starred, and the list is the list it was", () => {
      const row = rowsOf()[1], id = row.dataset.id;
      row.querySelector(".star").click();
      expect(handle.picks.get().has(id)).toBe(true);
      held();
      expect([rowsOf()[1].classList.contains("mine"), rowsOf()[1].querySelector(".star").getAttribute("aria-pressed")]).toEqual([true, "true"]);
      expect(chosen().map(r => r.id)).not.toContain(id);     // worked out now, it would be gone: a pick is not suggested
    });
    it("and unstarred there, it stays too", () => {
      const id = rowsOf()[1].dataset.id;
      rowsOf()[1].querySelector(".star").click();
      expect(handle.picks.get().has(id)).toBe(false);
      held();
      rowsOf()[1].querySelector(".star").click();
      expect(handle.picks.get().has(id)).toBe(true);
    });
    it("a row tapped opens its event's sheet, and the sheet closed draws the list as it was", () => {
      rowsOf()[2].querySelector(".row-main").click();
      expect([el("panel-event").hidden, state.sheetId]).toEqual([false, was[2]]);
      handle.closeSheet();
      held();
    });
    it("a fold, and a layout: Following's heading, By time, a block's Show more", () => {
      for (const act of ["fol-time", "fol-interest", "fol-more", "fol-toggle", "fol-toggle"]) {
        document.querySelector(`#following [data-act="${act}"]`).click();
        held();
      }
    });
    it("a follow chip's x: the follow goes, and its rows stay, reasons and all, until the grid is left", () => {
      const gone = five[0];
      document.querySelector(`#following [data-act="unfollow"][data-follow="track:${gone}"]`).click();
      expect(handle.follows.get().map(f => f.key)).not.toContain(gone);
      held();
      expect(rowsOf().map(r => words(r.querySelector(".flags .status")))).toContain(`You follow ${gone}`);
      expect(chosen().map(r => r.reason.name)).not.toContain(gone);
    });
    it("a draw nobody tapped for, as a pull's is: the picks and follows changed under it, the list as it was", () => {
      handle.picks.set([was[0], was[3]]); handle.follows.set(five.slice(2).map(TRACK)); handle.render();
      held();
      expect(rowsOf().map(r => r.classList.contains("mine"))).toEqual([true, false, false, true]);
    });
    it("the minute's tick draws nothing of it", () => {
      const node = el("foryou");
      app.onMinute();
      expect(el("foryou")).toBe(node);
    });
  });

  describe("and is worked out again when the grid is drawn from somewhere else", () => {
    /* Each starts from a list held with a row starred in it, which the list worked out anew leaves out. */
    let starred;
    const hold = () => {
      reader(five.map(TRACK));
      starred = rowsOf()[0].dataset.id;
      rowsOf()[0].querySelector(".star").click();
      expect(ids()).toContain(starred);
    };
    const anew = () => { expect(el("foryou")).not.toBe(null); expect(ids()).not.toContain(starred); expect(ids()).toEqual(chosen().slice(0, 4).map(r => r.id)); };

    it("another tab and back", () => {
      hold(); nav("plans");
      expect(state.explore.forYou).toBe(null);
      nav("explore"); anew();
    });
    it("a page and the way back", () => {
      hold();
      view().querySelector("#exploreGrid .tile").click();
      expect([!!state.explore.page, state.explore.forYou]).toEqual([true, null]);
      document.querySelector('[data-act="explore-back"]').click(); anew();
    });
    it("the Explore tab tapped again", () => { hold(); nav("explore"); anew(); });
    it("a return to the app", () => { hold(); app.onVisibleRender(); anew(); });
    it("a new moment on the clock: what has started by then is not offered", () => {
      hold();
      const later = "2026-09-06T09:00";
      app.setTimeOverride(later);
      expect(ids()).not.toContain(starred);
      ids().forEach(id => expect(+app.byId.get(id)._s).toBeGreaterThan(+new Date(later)));
      app.setTimeOverride("2026-09-05T13:05");
      anew();
    });
    it("Show more is shut again with a list worked out anew", () => {
      reader(five.map(TRACK)); more().click();
      expect(rowsOf().length).toBe(8);
      nav("explore");
      expect([rowsOf().length, words(more())]).toEqual([4, "Show 4 more"]);
    });
  });

  describe("an empty list is never kept", () => {
    it("no row on screen, a draw nobody tapped for brings the rows the reader now has", () => {
      reader([]);
      expect([el("foryou"), state.explore.forYou.rows]).toEqual([null, []]);
      handle.follows.set(five.map(TRACK)); handle.render();
      expect(ids()).toEqual(chosen().slice(0, 4).map(r => r.id));
      expect(rowsOf().length).toBe(4);
    });
    it("and from then it is held: the follows gone again, the rows stay", () => {
      const was = ids();
      handle.follows.set([]); handle.render();
      expect(ids()).toEqual(was);
    });
  });

  describe("Following's fold, for a reader who never stored a choice", () => {
    beforeAll(() => { window.localStorage.removeItem(`dc${YY}.followingOpen`); state.following.open = null; });
    const fold = () => [folHead().getAttribute("aria-expanded"), el("folBody").hidden, el("folBody").children.length > 0];

    it("is folded under a For you that has a row, the feed not built, and nothing is stored by the draw", () => {
      reader(five.map(TRACK));
      expect(el("foryou")).not.toBe(null);
      expect(fold()).toEqual(["false", true, false]);
      expect([state.following.open, stored("followingOpen")]).toEqual([null, null]);
      expect(words(folHead())).toBe("Following (5)▸");
    });
    it("is open where For you has no row", () => {
      reader([{ kind: "work", key: "no-such-work" }]);
      expect(el("foryou")).toBe(null);
      expect(fold()).toEqual(["true", false, true]);
      expect([state.following.open, stored("followingOpen")]).toEqual([null, null]);
    });
    it("a tap on the heading opens what is shown folded, and stores open", () => {
      reader(five.map(TRACK));
      folHead().click();
      expect(fold()).toEqual(["true", false, true]);
      expect([state.following.open, stored("followingOpen")]).toEqual([true, true]);
    });
    it("and from then on what is stored is what is shown: open under For you", () => {
      reader(five.map(TRACK));
      expect(el("foryou")).not.toBe(null);
      expect(fold()).toEqual(["true", false, true]);
    });
    it("a tap folds it and stores that, and it stays folded where For you has no row", () => {
      folHead().click();
      expect([state.following.open, stored("followingOpen")]).toEqual([false, false]);
      reader([{ kind: "work", key: "no-such-work" }]);
      expect(el("foryou")).toBe(null);
      expect(fold()).toEqual(["false", true, false]);
    });
    it("never stored and open, with no For you: a tap folds what is shown, and stores folded", () => {
      window.localStorage.removeItem(`dc${YY}.followingOpen`); state.following.open = null;
      reader([{ kind: "work", key: "no-such-work" }]);
      expect(fold()).toEqual(["true", false, true]);
      folHead().click();
      expect(fold()).toEqual(["false", true, false]);
      expect([state.following.open, stored("followingOpen")]).toEqual([false, false]);
      window.localStorage.removeItem(`dc${YY}.followingOpen`); state.following.open = null;
    });
  });

  describe("the filter box is kept through a For you tap (DECISIONS #80)", () => {
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
      reader(five.map(TRACK));
      node = box(); node.focus(); typeInto(node, "sci"); node.setSelectionRange(1, 2);
    });
    afterAll(() => { document.activeElement.blur(); state.explore.q = ""; });

    it("typing draws the tiles and leaves For you alone", () => {
      const section = el("foryou");
      typeInto(node, "sci"); node.setSelectionRange(1, 2);
      expect(el("foryou")).toBe(section);
      kept();
    });
    it("Show more draws the grid whole, and the box is the same node with its text, its focus and its caret", () => {
      expect(drawn(() => more().click())).toBe(true);
      expect(rowsOf().length).toBe(8);
      kept();
    });
    it("and a star on a For you row", () => {
      const star = rowsOf()[5].querySelector(".star");
      expect(drawn(() => star.click())).toBe(true);
      expect(rowsOf()[5].querySelector(".star").getAttribute("aria-pressed")).toBe("true");
      kept();
      expect(kinds(view())).toEqual(["section#foryou.foryou", "section#following.following", "div.controls.controls-sticky", "div#exploreGrid."]);
    });
  });
});

/* A choice stored before For you came is kept as it is: the key holds true
   or false, and what is stored is what is shown. */
describe("Following's fold, for a reader who stored a choice", () => {
  let page;
  const boot = async open => {
    window.localStorage.setItem(`dc${YY}.followingOpen`, JSON.stringify(open));
    page = await bootPage();
    const { app, handle } = page, at = handle.now();
    const tracks = app.getCatalogue().track.filter(t => !app.NOISE_TRACKS.has(t.key) && app.eventsFor(TRACK(t.key)).filter(e => e._s > at).length >= 3).slice(0, 2);
    handle.follows.set(tracks.map(t => TRACK(t.key)));
    nav("explore");
    return page;
  };

  it("stored open: open under a For you that has a row", async () => {
    const { handle } = await boot(true);
    expect([handle.state.following.open, el("foryou") !== null, folHead().getAttribute("aria-expanded"), el("folBody").hidden]).toEqual([true, true, "true", false]);
    await page.cleanup();
  }, 30000);
  it("stored folded: folded where For you has no row", async () => {
    const { handle } = await boot(false);
    handle.follows.set([{ kind: "work", key: "no-such-work" }]); nav("explore");
    expect([handle.state.following.open, el("foryou"), folHead().getAttribute("aria-expanded"), el("folBody").hidden]).toEqual([false, null, "false", true]);
    await page.cleanup();
    window.localStorage.removeItem(`dc${YY}.followingOpen`);
  }, 30000);
});

/* A real pull (docs/sync/contract.md, section 5), against the fake backend:
   the list with rows is kept through its redraw, and a phone that has just
   signed in, whose list was empty, gets its rows at the redraw. */
describe("For you through a pull of the reader's own picks and follows", () => {
  let page, app, handle, fake, ada, five;
  const iso = ms => new Date(ms).toISOString();
  const run = async () => { await app.runSync(); await app.syncSettled(); };

  beforeAll(async () => {
    fake = fakeBackend();
    ada = fake.held("ada@example.test");
    const s = fake.issue(ada.id);
    window.localStorage.setItem(`dc${YY}.session`, JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token,
      user: { id: ada.id, email: ada.email || "", is_anonymous: ada.is_anonymous } }));
    window.localStorage.setItem(`dc${YY}.syncStamp`, JSON.stringify({ user: ada.id, picks: null, follows: null }));
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    const at = handle.now();
    five = app.getCatalogue().track.filter(t => !app.NOISE_TRACKS.has(t.key) && app.eventsFor(TRACK(t.key)).filter(e => e._s > at).length >= 3).slice(0, 5).map(t => t.key);
    nav("explore");
  }, 30000);
  afterAll(() => page.cleanup());

  it("a phone with nothing shows no For you; the pull brings its follows, and the redraw brings For you with Following folded under it", async () => {
    expect([el("foryou"), el("following")]).toEqual([null, null]);
    five.forEach(key => fake.write(ada.id, "follows", { kind: "track", key, followed: true, changed_at: iso(Date.now()) }));
    await run();
    expect(handle.follows.get().length).toBe(5);
    expect(ids()).toEqual(app.forYou(handle.now()).slice(0, 4).map(r => r.id));
    expect([view().firstElementChild, el("foryou").nextElementSibling, el("folBody").hidden]).toEqual([el("foryou"), el("following"), true]);
  });
  it("a pick of one of its rows made on another device: the redraw draws the list as it was, that row starred in its place", async () => {
    const was = ids();
    fake.write(ada.id, "picks", { event_id: was[2], picked: true, changed_at: iso(Date.now()) });
    await run();
    expect(handle.picks.get().has(was[2])).toBe(true);
    expect(ids()).toEqual(was);
    expect(rowsOf().map(r => r.classList.contains("mine"))).toEqual([false, false, true, false]);
  });
});
