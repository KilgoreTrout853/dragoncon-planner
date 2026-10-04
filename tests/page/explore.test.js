/* Explore: the grid of things to follow, their pages, and the suggestions drawn
   from the reader's own picks. The number in brackets is the harness line the
   assertion came from (tests/PORT-LEDGER.md). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { fakeBackend } from "../helpers/backend.js";
import { typeInto } from "../helpers/act.js";
import { YY } from "../../src/season.js";

const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "styles.css"), "utf8").replace(/\r\n/g, "\n");

describe("Explore", () => {
  let page, app, handle, state;
  const el = id => document.getElementById(id);
  const view = () => el("view-explore");
  const grid = () => { handle.follows.set([]); state.tab = "explore"; state.explore.page = null; state.explore.q = ""; handle.render(); };

  beforeAll(async () => { page = await bootPage(); ({ app, handle } = page); state = handle.state; }, 30000);
  afterAll(() => page.cleanup());

  describe("because you starred: suggestions drawn from the reader's own picks", () => {
    let none, one, afterFollow, noise, track;
    beforeAll(() => {
      const tiles = () => { const sec = el("suggested"); return sec ? [...sec.querySelectorAll(".tile")].map(t => t.dataset.explore) : null; };
      handle.picks.set([]); state.explore.expanded = {}; grid();
      none = !!el("suggested");
      const ev = handle.events.find(e => (e.tracks || []).some(t => !app.NOISE_TRACKS.has(t)));
      track = ev.tracks.filter(t => !app.NOISE_TRACKS.has(t))[0];
      handle.picks.set([ev.id]); handle.render();
      const sec = el("suggested");
      one = { shown: !!sec, title: sec.querySelector(".section-title").textContent.replace(/\s+/g, " ").trim(), tiles: tiles(),
        aboveFilter: !!(sec.compareDocumentPosition(el("exploreQ")) & Node.DOCUMENT_POSITION_FOLLOWING) };
      app.toggleFollow("track", track); handle.render();
      afterFollow = tiles() || [];
      handle.follows.set([]);
      const screening = handle.events.find(e => app.NOISE_TRACKS.has(e.track) && !(e.people || []).length);
      handle.picks.set([screening.id]); handle.render();
      noise = !!el("suggested");
      handle.picks.set([]); handle.render();
    });

    it("with nothing starred there is no suggestions strip [701]", () => {
      expect(none).toBe(false);
    });
    it("one pick brings a strip headed by the count [702]", () => {
      expect(one.shown).toBe(true);
      expect(one.title).toMatch(/^Because you starred 1 thing\b/);
    });
    it("it offers the pick's track [703]", () => {
      expect(one.tiles).toContain("track:" + track);
    });
    it("and sits above the filter box [704]", () => {
      expect(one.aboveFilter).toBe(true);
    });
    it("following it takes it off the strip [705]", () => {
      expect(afterFollow).not.toContain("track:" + track);
    });
    it("a starred screening with no guest suggests nothing [706]", () => {
      expect(noise).toBe(false);
    });
  });

  describe("a starred event about a work suggests the works above it too", () => {
    let tiles;
    beforeAll(() => {
      const andor = handle.events.find(e => ((e.tags || {}).works || []).some(w => w.id === "andor"));
      handle.follows.set([]); handle.picks.set([andor.id]); state.tab = "explore"; state.explore.page = null; handle.render();
      tiles = [...el("suggested").querySelectorAll(".tile")].map(t => ({ key: t.dataset.explore, name: t.querySelector(".tile-name").textContent }));
      handle.picks.set([]); handle.render();
    });

    it("Andor, and Star Wars above it, each by name", () => {
      expect(tiles).toContainEqual({ key: "work:andor", name: "Andor" });
      expect(tiles).toContainEqual({ key: "work:star-wars", name: "Star Wars" });
    });
  });

  describe("step 2: the grid", () => {
    const ORDER = ["Tracks", "Fandoms", "Topics", "Guests", "Panelists"];
    let seen;
    beforeAll(() => { grid(); seen = [...view().querySelectorAll(".section-title")].map(t => t.textContent.replace(/\s+/g, " ").trim().split(" ")[0]); });

    /* the fixture's two celebrity events have nobody on them, so Guests is
       correctly absent here; all five are checked against the real schedule */
    it("the sections that have content render [1011]", () => {
      expect(seen.length).toBeGreaterThanOrEqual(3);
    });
    it("and are named from the five sections [1012]", () => {
      seen.forEach(name => expect(ORDER).toContain(name));
    });
    it("in the order Tracks, Fandoms, Topics, Guests, Panelists [1013]", () => {
      expect(seen).toEqual(ORDER.filter(o => seen.includes(o)));
    });
    it("an empty section is skipped rather than shown empty [1014]", () => {
      expect(app.getCatalogue().guest).toHaveLength(0);
      expect(seen).not.toContain("Guests");
    });
    it("fandom tiles need 3+ events [1015]", () => {
      expect(app.getCatalogue().fandom.every(f => f.count >= 3)).toBe(true);
    });
    it("tracks run A to Z [1016]", () => {
      const names = app.getCatalogue().track.filter(t => !app.NOISE_TRACKS.has(t.key)).map(t => t.key);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });
    it("with the photo and video-room tracks last [1018]", () => {
      const tracks = app.getCatalogue().track, n = tracks.filter(t => app.NOISE_TRACKS.has(t.key)).length;
      expect(n).toBeGreaterThan(0);
      expect(tracks.slice(-n).every(t => app.NOISE_TRACKS.has(t.key))).toBe(true);
    });
    it("fandoms stay sorted by count [1020]", () => {
      const counts = app.getCatalogue().fandom.map(f => f.count);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
    });
    it("panelists run A to Z [1022]", () => {
      const names = app.getCatalogue().panelist.map(p => p.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });
    it("guests and panelists together are everyone followable [1024]", () => {
      const cat = app.getCatalogue();
      expect(cat.guest.length + cat.panelist.length).toBe(cat.person.length);
    });
    it("each tile shows a count [1027]", () => {
      expect(view().querySelector(".tile").textContent).toMatch(/\d/);
    });
  });

  describe("each section opens with its head and a Show all", () => {
    let sections, tracks, box;
    beforeAll(() => {
      grid();
      sections = {}; let cur = null;
      [...el("exploreGrid").children].forEach(node => {
        if (node.classList.contains("section-title")) { cur = node.id.replace("explore-", ""); sections[cur] = { tiles: 0, all: null }; }
        else if (cur && node.classList.contains("tiles")) sections[cur].tiles += node.querySelectorAll(".tile").length;
        else if (cur && node.dataset && node.dataset.act === "explore-all") sections[cur].all = node.textContent.trim();
      });
      tracks = app.getCatalogue().track.length;
      box = el("exploreQ");
    });

    it("Tracks opens with its head [1037]", () => {
      expect(sections.track.tiles).toBe(Math.min(app.EXPLORE_HEAD, tracks));
    });
    it("and offers Show all [1038]", () => {
      expect(tracks <= app.EXPLORE_HEAD || sections.track.all === "Show all " + tracks).toBe(true);
    });
    it("no section shows more than its head to start [1039]", () => {
      Object.values(sections).forEach(s => expect(s.tiles).toBeLessThanOrEqual(app.EXPLORE_HEAD));
    });
    it("the fixture has enough tracks to fold [1042]", () => {
      expect(document.querySelector('#exploreGrid [data-act="explore-all"][data-section="track"]')).toBeTruthy();
    });
    it("Show all opens every track and the button goes [1048]", () => {
      document.querySelector('#exploreGrid [data-act="explore-all"][data-section="track"]').click();
      let tiles = 0;
      for (let node = el("explore-track").nextElementSibling; node && !node.classList.contains("section-title"); node = node.nextElementSibling) {
        if (node.classList.contains("tiles")) tiles += node.querySelectorAll(".tile").length;
      }
      expect(tiles).toBe(tracks);
      expect(document.querySelector('#exploreGrid [data-act="explore-all"][data-section="track"]')).toBe(null);
    });
    it("without rebuilding the filter box [1049]", () => {
      expect(el("exploreQ")).toBe(box);
    });
    it("and the choice holds for this visit [1050]", () => {
      expect(state.explore.expanded.track).toBe(true);
    });

    describe("the jump bar under the filter box", () => {
      const jumps = () => [...document.querySelectorAll('#view-explore .controls-sticky [data-act="explore-jump"]')];
      const pressed = () => [...document.querySelectorAll('#view-explore [data-act="explore-jump"]')].filter(b => b.getAttribute("aria-pressed") === "true").map(b => b.dataset.section);

      it("a jump chip per rendered section, in order [1053]", () => {
        expect(jumps().length).toBeGreaterThanOrEqual(3);
        expect(jumps().map(b => b.dataset.section)).toEqual(Object.keys(sections));
      });
      it("each chip carries its count [1054]", () => {
        expect(document.querySelector('#view-explore .controls-sticky [data-act="explore-jump"] .n')).toBeTruthy();
      });
      /* The harness replaced pageScrollTo. The app scrolls main, and prefers
         main's own scrollTo when it has one: jsdom does not, so give it one. */
      it("tapping a chip scrolls to its section [1058]", () => {
        const main = document.querySelector("main"), calls = [];
        main.scrollTo = options => calls.push(options);
        jumps()[jumps().length - 1].click();
        delete main.scrollTo;
        expect(calls).toHaveLength(1);
        expect(calls[0].top).toBeGreaterThanOrEqual(0);
        expect(state.tab).toBe("explore");
      });
      it("a tapped chip is pressed at once, and only it [1061]", () => {
        expect(pressed()).toEqual([jumps()[jumps().length - 1].dataset.section]);
      });
      it("a render marks exactly one chip from the headers' positions [1070]", () => {
        state.explore.active = null; app.renderExplore();
        expect(pressed()).toHaveLength(1);
        state.explore.expanded = {}; app.renderExplore();
      });
    });
  });

  describe("the filter narrows tiles, not events", () => {
    let all;
    const names = () => [...view().querySelectorAll(".tile-name")].map(n => n.textContent);
    beforeAll(() => { grid(); state.explore.expanded = {}; app.renderExplore(); all = view().querySelectorAll(".tile").length; });

    it("the filter narrows the tiles [1077]", () => {
      state.explore.q = "cost"; app.renderExplore();
      expect(names().length).toBeGreaterThan(0);
      expect(names().length).toBeLessThan(all);
    });
    it("to those whose name matches [1078]", () => {
      names().forEach(n => expect(n).toMatch(/cost/i));
      state.explore.q = ""; app.renderExplore();
    });
    it("typing in the filter keeps the same input element [1083]", () => {
      const box = el("exploreQ");
      typeInto(box, "cost");
      expect(el("exploreQ")).toBe(box);
    });
    it("and narrows the tiles [1085]", () => {
      expect(names().length).toBeGreaterThan(0);
      names().forEach(n => expect(n).toMatch(/cost/i));
    });
    it("clearing it brings everything back [1087]", () => {
      typeInto(el("exploreQ"), "");
      expect(state.explore.q).toBe("");
      expect(view().querySelectorAll(".tile")).toHaveLength(all);
    });
  });

  describe("a tile opens its page", () => {
    let track;
    beforeAll(() => { grid(); track = app.getCatalogue().track[0].key; app.openExplorePage("track", track); });
    afterAll(() => { handle.follows.set([]); });

    it("the tile opens its page [1092]", () => {
      expect(view().querySelector(".eh-name").textContent).toBe(track);
    });
    it("labelled with its kind [1093]", () => {
      expect(view().querySelector(".eh-kind").textContent).toBe("Track");
    });
    it("and its total count [1094]", () => {
      expect(view().querySelector(".eh-count").textContent).toMatch(/\d+ events?/);
    });
    it("events are grouped under day headers [1095]", () => {
      expect(view().querySelector(".day-head")).toBeTruthy();
    });
    it("with standard rows [1096]", () => {
      expect(view().querySelectorAll(".row").length).toBeGreaterThan(0);
    });
    it("that carry a star [1097]", () => {
      expect(view().querySelector(".row .star")).toBeTruthy();
    });
    it("the page offers Follow [1100]", () => {
      expect(view().querySelector(".follow-btn").textContent.trim()).toBe("Follow");
    });
    it("which becomes Following [1102]", () => {
      view().querySelector(".follow-btn").click();
      expect(view().querySelector(".follow-btn").textContent.trim()).toBe("Following");
    });
    it("and the follow is recorded [1103]", () => {
      expect(app.isFollowing("track", track)).toBe(true);
    });
    it("the page is deep-linked [1105]", () => {
      expect(window.location.hash).toMatch(/explore=/);
    });
    it("and the link parses back [1106]", () => {
      expect(app.readExploreHash()).toEqual({ kind: "track", key: track });
    });
    it("back returns to the grid [1109]", () => {
      document.querySelector('[data-act="explore-back"]').click();
      expect(state.explore.page).toBeFalsy();
    });
    it("and clears the deep link [1110]", () => {
      expect(window.location.hash).not.toMatch(/explore=/);
    });
    it("the followed tile carries a mark [1111]", () => {
      expect(view().querySelectorAll(".tile.on")).toHaveLength(1);
    });
  });

  describe("the detail sheet offers a way through to a person", () => {
    let seeAll, ev;
    beforeAll(() => {
      state.tab = "browse"; handle.render();
      ev = handle.events.find(e => (e.people || []).length > 0);
      handle.openSheet("event", ev.id);
      seeAll = document.querySelector("#panel-event .ev-people .who-name");
    });
    afterAll(() => { state.explore.page = null; app.setExploreHash(null); state.tab = "now"; handle.render(); });

    it("the detail sheet makes a speaker's name the way to their page, and offers no See all [1118]", () => {
      expect(seeAll).toBeTruthy();
      expect(seeAll.textContent).toBe(ev.people[0].name);
      expect(document.querySelector("#panel-event .see-all")).toBe(null);
    });
    it("pointing at that person's page [1119]", () => {
      expect(seeAll.dataset.explore).toBe("person:" + ev.people[0].id);
    });
    it("and tapping it lands on the person page [1121]", () => {
      seeAll.click();
      expect(state.tab).toBe("explore");
      expect(state.explore.page.kind).toBe("person");
    });
    it("with the sheet closed behind it [1123]", () => {
      expect(el("sheetWrap").hidden).toBe(true);
    });
  });

  /* A page opened by a tap (DECISIONS #66, #75): where keyboard focus lands,
     and where "← Explore" then lands the grid. jsdom keeps a scroller's
     scrollTop as it is set, which is all these ask of it. New tests, not rows
     of tests/PORT-LEDGER.md. */
  describe("a page opened by a tap", () => {
    let ev, track;
    const main = () => document.querySelector("main");
    const heading = () => view().querySelector(".eh-name");
    const back = () => document.querySelector('[data-act="explore-back"]').click();
    const fresh = () => { handle.closeSheet(); handle.picks.set([]); state.explore.expanded = {}; state.explore.scroll = 0; main().scrollTop = 0; grid(); };

    beforeAll(() => {
      fresh();
      ev = handle.events.find(e => (e.people || []).length > 0 && (e.tracks || []).length > 0 && e._s > handle.now());
      track = app.getCatalogue().track[0].key;
    });
    afterAll(() => { app.setExploreHash(null); fresh(); });

    describe("keyboard and screen-reader focus lands on its heading", () => {
      it("which can take focus, and is no stop on the way through the page", () => {
        app.openExplorePage("track", track);
        expect(heading().getAttribute("tabindex")).toBe("-1");
        expect(document.activeElement).toBe(heading());
        back();
      });
      it("from a tile on the grid, the page at its top", () => {
        const tile = view().querySelector("#exploreGrid .tile");
        tile.focus(); tile.click();
        expect(state.explore.page).toBeTruthy();
        expect(document.activeElement).toBe(heading());
        expect(app.pageScrollTop()).toBe(0);
        back();
      });
      it("from a Following chip", () => {
        handle.follows.set([{ kind: "track", key: track }]); handle.render();
        const chip = view().querySelector(".follow-chips .fc-name");
        chip.focus(); chip.click();
        expect(state.explore.page).toEqual({ kind: "track", key: track });
        expect(document.activeElement).toBe(heading());
        back();
        handle.follows.set([]); handle.render();
      });
      it("from a Because-you-starred tile", () => {
        handle.picks.set([handle.events.find(e => (e.tracks || []).some(t => !app.NOISE_TRACKS.has(t))).id]); handle.render();
        const tile = el("suggested").querySelector(".tile");
        tile.focus(); tile.click();
        expect(state.explore.page).toBeTruthy();
        expect(document.activeElement).toBe(heading());
        back();
        handle.picks.set([]); handle.render();
      });
      it("from a person's name on an event's sheet, over another tab: the sheet's close gives focus to the row, the tab change hides the row, and the heading has it", () => {
        state.tab = "browse"; handle.render();
        handle.openSheet("event", ev.id);
        document.querySelector("#panel-event .who-name").click();
        expect([el("sheetWrap").hidden, state.tab, state.explore.page.kind]).toEqual([true, "explore", "person"]);
        expect(document.activeElement).toBe(heading());
        expect(app.pageScrollTop()).toBe(0);
        back();
      });
      it("and from a chip on an event's sheet", () => {
        state.tab = "browse"; handle.render();
        handle.openSheet("event", ev.id);
        document.querySelector("#panel-event .tag-tap").click();
        expect([el("sheetWrap").hidden, state.tab, state.explore.page]).toEqual([true, "explore", { kind: "track", key: ev.tracks[0] }]);
        expect(document.activeElement).toBe(heading());
        back();
      });
      it("on arrival, and never when the page is drawn again: Follow and a redraw leave focus alone", () => {
        grid();
        app.openExplorePage("track", track);
        const follow = view().querySelector(".follow-btn");
        follow.focus(); follow.click();
        expect(app.isFollowing("track", track)).toBe(true);
        expect(document.activeElement).not.toBe(heading());
        handle.render();
        expect(document.activeElement).not.toBe(heading());
        back();
        handle.follows.set([]); handle.render();
      });
      it("its ring shows for a keyboard's arrival and not for a tap's, as a sheet's heading does", () => {
        expect(css).toMatch(/\n\.explore-head \.eh-name:focus:not\(:focus-visible\) \{ outline: none; \}/);
        expect(css).toMatch(/\n\.sheet-panel h2:focus:not\(:focus-visible\) \{ outline: none; \}/);
      });
    });

    describe("the way back, \"← Explore\": the grid where it was", () => {
      it("the grid's scroll is taken where the screen under the tap is the grid itself: a tile", () => {
        grid(); main().scrollTop = 300;
        view().querySelector("#exploreGrid .tile").click();
        expect([state.explore.scroll, app.pageScrollTop()]).toEqual([300, 0]);
        back();
        expect([state.explore.page, app.pageScrollTop()]).toEqual([null, 300]);
      });
      it("from another tab's sheet, what the grid last held stays: Search's scroll is not the grid's", () => {
        state.tab = "browse"; handle.render(); main().scrollTop = 900;
        handle.openSheet("event", ev.id);
        document.querySelector("#panel-event .who-name").click();
        expect([state.tab, state.explore.scroll, app.pageScrollTop()]).toEqual(["explore", 300, 0]);
        back();
        expect(app.pageScrollTop()).toBe(300);
      });
      it("from an Explore page - a chip on the sheet of one of its rows - it stays too", () => {
        grid(); main().scrollTop = 300;
        app.openExplorePage("person", ev.people[0].id);
        expect(state.explore.scroll).toBe(300);
        main().scrollTop = 150;
        view().querySelector(".row .row-main").click();
        expect(el("panel-event").hidden).toBe(false);
        document.querySelector("#panel-event .tag-tap").click();
        expect([state.explore.page.kind, state.explore.scroll, app.pageScrollTop()]).toEqual(["track", 300, 0]);
        back();
        expect(app.pageScrollTop()).toBe(300);
      });
      it("from a sheet over the grid itself - a row of the Following feed - it is taken, as from a tile", () => {
        handle.follows.set([{ kind: "track", key: ev.tracks[0] }]); state.tab = "explore"; state.explore.page = null; handle.render();
        main().scrollTop = 420;
        view().querySelector("#following .row .row-main").click();
        expect(el("panel-event").hidden).toBe(false);
        document.querySelector("#panel-event .tag-tap").click();
        expect([state.tab, state.explore.scroll, app.pageScrollTop()]).toEqual(["explore", 420, 0]);
        back();
        expect(app.pageScrollTop()).toBe(420);
        handle.follows.set([]); handle.render();
      });
      it("and the grid never left is at its top: from another tab's sheet, \"← Explore\" lands there", () => {
        fresh();
        state.tab = "browse"; handle.render(); main().scrollTop = 900;
        handle.openSheet("event", ev.id);
        document.querySelector("#panel-event .tag-tap").click();
        expect([state.tab, state.explore.scroll]).toEqual(["explore", 0]);
        back();
        expect(app.pageScrollTop()).toBe(0);
      });
    });
  });

  /* The filter box is built once (DECISIONS #80): the first draw of the grid
     makes it, and every later one writes around it. A tap here is a click(),
     which moves no focus - as an iPhone moves none to a tapped button - so
     the box still has the keyboard through the draw the tap asks for. New
     tests, not rows of tests/PORT-LEDGER.md. */
  describe("the filter box is built once: a draw of the grid writes around it", () => {
    let track, node;
    const box = () => el("exploreQ");
    const jump = () => view().querySelector('[data-act="explore-jump"]');
    const act = name => view().querySelector(`[data-act="${name}"]`);
    const kinds = of => [...of.children].map(c => `${c.tagName.toLowerCase()}${c.id ? `#${c.id}` : ""}.${c.className.split(" ").join(".")}`);
    /* Text typed, the caret left inside it, and the box holding focus. */
    const typing = (text, from, to) => { box().focus(); typeInto(box(), text); box().setSelectionRange(from, to); };
    const kept = (text, from, to) => {
      expect(box()).toBe(node);
      expect(document.activeElement).toBe(node);
      expect([node.value, node.selectionStart, node.selectionEnd]).toEqual([text, from, to]);
    };
    /* A whole draw of the grid, seen by what it replaced: the jump chips,
       which typing's own draw leaves alone. */
    const drawn = during => { const chip = jump(); during(); return !chip.isConnected && jump() !== null && jump() !== chip; };
    const plain = () => Object.assign(state.following, { open: true, layout: "interest", expanded: {}, showPast: {} });
    const reader = (follows, picks) => {
      handle.closeSheet(); handle.picks.set(picks); handle.follows.set(follows); plain();
      state.tab = "explore"; state.explore.page = null; state.explore.q = ""; state.explore.expanded = {};
      handle.render();
    };

    beforeAll(() => {
      /* a track whose feed has a Show more and an Already happened */
      const at = handle.now();
      track = app.getCatalogue().track.find(t => {
        const all = app.eventsFor({ kind: "track", key: t.key }), left = all.filter(e => !app.isPast(e, at)).length;
        return left > 8 && left < all.length;
      }).key;
      reader([{ kind: "track", key: track }], []);
      node = box();
    });
    afterAll(() => { document.activeElement.blur(); reader([], []); });

    it("a whole draw, with text typed and the caret inside it: the same node, with its focus, its caret and its text", () => {
      typing("star", 1, 2);
      expect(drawn(() => handle.render())).toBe(true);
      kept("star", 1, 2);
      expect(state.explore.q).toBe("star");
    });
    it("a return to the page draws it whole too", () => {
      expect(drawn(() => app.onVisibleRender())).toBe(true);
      kept("star", 1, 2);
    });
    it("the Following heading tapped, folded and open again", () => {
      expect(drawn(() => act("fol-toggle").click())).toBe(true);
      expect([state.following.open, el("folBody").hidden]).toEqual([false, true]);
      kept("star", 1, 2);
      expect(drawn(() => act("fol-toggle").click())).toBe(true);
      expect([state.following.open, el("folBody").hidden]).toEqual([true, false]);
      kept("star", 1, 2);
    });
    it("By time tapped, and By interest", () => {
      expect(drawn(() => act("fol-time").click())).toBe(true);
      expect([state.following.layout, view().querySelector("#following .time-head") !== null]).toEqual(["time", true]);
      kept("star", 1, 2);
      expect(drawn(() => act("fol-interest").click())).toBe(true);
      expect([state.following.layout, view().querySelector("#following .time-head")]).toEqual(["interest", null]);
      kept("star", 1, 2);
    });
    it("Show more tapped on a follow's events", () => {
      const rows = view().querySelectorAll("#following .row").length;
      expect(drawn(() => act("fol-more").click())).toBe(true);
      expect(act("fol-more")).toBe(null);
      expect(view().querySelectorAll("#following .row").length).toBeGreaterThan(rows);
      kept("star", 1, 2);
    });
    it("Already happened tapped", () => {
      expect(act("fol-past").getAttribute("aria-expanded")).toBe("false");
      expect(drawn(() => act("fol-past").click())).toBe(true);
      expect(act("fol-past").getAttribute("aria-expanded")).toBe("true");
      kept("star", 1, 2);
    });
    it("a star tapped on a Following row", () => {
      const star = view().querySelector("#following .row .star:not([disabled])"), id = star.closest(".row").dataset.id;
      expect(drawn(() => star.click())).toBe(true);
      expect(handle.picks.get().has(id)).toBe(true);
      expect(view().querySelector(`#following .row[data-id="${id}"] .star`).getAttribute("aria-pressed")).toBe("true");
      expect(kinds(view())).toEqual(["section#following.following", "div.controls.controls-sticky", "div#exploreGrid."]);
      kept("star", 1, 2);
    });
    it("and an unfollow, which takes Following from above it and puts Because you starred there", () => {
      expect(drawn(() => view().querySelector('#following [data-act="unfollow"]').click())).toBe(true);
      expect([handle.follows.get().length, el("following")]).toEqual([0, null]);
      expect(kinds(view())).toEqual(["section#suggested.suggested", "div.controls.controls-sticky", "div#exploreGrid."]);
      kept("star", 1, 2);
    });
    it("the box's value follows the filter when something else sets it, and a draw writes to the box only then", () => {
      const own = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value"), writes = [];
      Object.defineProperty(node, "value", { configurable: true, get() { return own.get.call(this); }, set(text) { writes.push(text); own.set.call(this, text); } });
      handle.render();
      expect(writes).toEqual([]);                            // the two agree, as they do while the reader types
      state.explore.q = "cost"; handle.render();
      expect(writes).toEqual(["cost"]);
      handle.render();
      expect(writes).toEqual(["cost"]);
      delete node.value;
      expect([box(), node.value]).toEqual([node, "cost"]);
      const names = [...view().querySelectorAll("#exploreGrid .tile-name")].map(n => n.textContent);
      expect(names.length).toBeGreaterThan(0);
      names.forEach(n => expect(n).toMatch(/cost/i));
    });
    it("a page replaces the view, the box with it, and the way back builds the grid anew: another box, with the text kept", () => {
      view().querySelector("#exploreGrid .tile").click();
      expect([state.explore.page !== null, box(), node.isConnected]).toEqual([true, null, false]);
      document.querySelector('[data-act="explore-back"]').click();
      expect(state.explore.page).toBe(null);
      expect(box()).not.toBe(node);
      expect([box().value, state.explore.q]).toEqual(["cost", "cost"]);
      node = box();
      typing("cos", 1, 2);
      expect(drawn(() => handle.render())).toBe(true);
      kept("cos", 1, 2);
    });
    it("the view's children are the same kinds in the same order after a draw as before it, Following first, and the jump chips the sticky block's own child", () => {
      reader([{ kind: "track", key: track }], [handle.events.find(e => (e.tracks || []).some(t => !app.NOISE_TRACKS.has(t) && t !== track)).id]);
      node = box();
      const before = kinds(view());
      expect(before).toEqual(["section#following.following", "section#suggested.suggested", "div.controls.controls-sticky", "div#exploreGrid."]);
      expect(drawn(() => handle.render())).toBe(true);
      expect(kinds(view())).toEqual(before);
      expect(view().firstElementChild).toBe(el("following"));
      expect(kinds(node.parentElement)).toEqual(["input#exploreQ.search", "div.chips.explore-jump"]);
      expect(box()).toBe(node);
    });
    /* The view as draws around the box leave it, beside the view as one
       whole draw makes it: emptied, the view has no box, and the next draw
       builds it whole. Each state is reached from the one before it. */
    it("its markup is what one whole draw would write, byte for byte, in every state: a stranger's, follows and picks, Following folded, by time, picks alone, a section opened", () => {
      const pick = [...handle.picks.get()], follow = [{ kind: "track", key: track }];
      const bothWays = change => {
        change(); handle.render();
        const around = view().innerHTML;
        view().innerHTML = ""; handle.render();
        return [around === view().innerHTML, around.length > 500];
      };
      view().innerHTML = ""; reader([], []);                 // a box built with nothing in it
      expect(pick.length).toBe(1);
      const states = {
        "follows and picks": () => { handle.follows.set(follow); handle.picks.set(pick); },
        "Following folded": () => { state.following.open = false; },
        "by time": () => { state.following.open = true; state.following.layout = "time"; },
        "picks alone": () => { handle.follows.set([]); plain(); },
        "a stranger": () => { handle.picks.set([]); },
        "a section opened": () => { state.explore.expanded.track = true; },
        "and closed": () => { state.explore.expanded = {}; },
      };
      for (const [name, change] of Object.entries(states)) expect(bothWays(change), name).toEqual([true, true]);
    });
    it("but for the box's value attribute, which stays as the box was built: its text is its value", () => {
      const less = html => html.replace(/ value="[^"]*"/, "");
      view().innerHTML = ""; reader([], []);
      state.explore.q = "cost"; handle.render();
      const around = view().innerHTML, built = box().getAttribute("value");
      expect([box().value, built]).toEqual(["cost", ""]);
      view().innerHTML = ""; handle.render();
      expect([box().value, box().getAttribute("value")]).toEqual(["cost", "cost"]);
      expect(around).not.toBe(view().innerHTML);
      expect(less(around)).toBe(less(view().innerHTML));
    });
  });

  /* The harness replaced revealChip and recorded its calls. The chip is
     revealed by scrolling its own row: give the row and the chip rects that put
     the chip off the edge, and watch the row. */
  it("on Explore a chip is revealed when it becomes current, and only then [817]", () => {
    grid();
    const row = view().querySelector(".chips.explore-jump"), calls = [];
    row.scrollTo = options => calls.push(options);
    row.getBoundingClientRect = () => ({ left: 0, right: 300, top: 0, bottom: 40, width: 300, height: 40 });
    row.querySelectorAll('[data-act="explore-jump"]').forEach(chip => { chip.getBoundingClientRect = () => ({ left: 400, right: 480, top: 0, bottom: 40, width: 80, height: 40 }); });
    app.markActiveSection(null);
    app.markActiveSection("topic"); app.markActiveSection("topic"); app.markActiveSection("track");
    expect(calls).toHaveLength(2);                           // once for topic, once for track; the repeat moved nothing
    calls.forEach(c => expect(c.left).toBeGreaterThan(0));
    delete row.scrollTo; delete row.getBoundingClientRect;   // a draw keeps the row (DECISIONS #80), so its stand-ins go by hand
    handle.render();
  });
});

/* The pull's redraw (DECISIONS #80; docs/sync/contract.md, section 5): the
   reader's own change made on another device asks for one on any tab, and
   Explore's box is kept through it. Against the fake backend,
   tests/helpers/backend.js. New tests, not rows of tests/PORT-LEDGER.md. */
describe("Explore's filter box through a pull of the reader's own picks and follows", () => {
  let page, app, handle, fake, ada, pickId, track;
  const el = id => document.getElementById(id);
  const jump = () => document.querySelector('#view-explore [data-act="explore-jump"]');
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
    const ev = handle.events.find(e => (e.tracks || []).some(t => !app.NOISE_TRACKS.has(t)));
    pickId = ev.id;
    track = ev.tracks.find(t => !app.NOISE_TRACKS.has(t));
    document.querySelector('.nav button[data-tab="explore"]').click();
  }, 30000);
  afterAll(() => page.cleanup());

  it("a pick made on another device, pulled while the reader types: Explore is drawn again with Because you starred above the box, and the box is the same node with its text, its focus and its caret", async () => {
    const box = el("exploreQ"), chip = jump();
    box.focus(); typeInto(box, "star"); box.setSelectionRange(1, 2);
    expect(el("suggested")).toBe(null);
    fake.write(ada.id, "picks", { event_id: pickId, picked: true, changed_at: iso(Date.now()) });
    await run();
    expect(handle.picks.get().has(pickId)).toBe(true);
    expect([chip.isConnected, jump() !== null, el("suggested") !== null]).toEqual([false, true, true]);
    expect(el("exploreQ")).toBe(box);
    expect(document.activeElement).toBe(box);
    expect([box.value, box.selectionStart, box.selectionEnd]).toEqual(["star", 1, 2]);
  });
  it("and a follow: Following stands first in the view, the box as it was", async () => {
    const box = el("exploreQ"), chip = jump();
    fake.write(ada.id, "follows", { kind: "track", key: track, followed: true, changed_at: iso(Date.now()) });
    await run();
    expect(handle.follows.get()).toEqual([{ kind: "track", key: track }]);
    expect([chip.isConnected, jump() !== null]).toEqual([false, true]);
    expect(el("view-explore").firstElementChild).toBe(el("following"));
    expect(el("exploreQ")).toBe(box);
    expect(document.activeElement).toBe(box);
    expect([box.value, box.selectionStart, box.selectionEnd]).toEqual(["star", 1, 2]);
  });
});
