/* Explore: the grid of things to follow, their pages, and the suggestions drawn
   from the reader's own picks. The number in brackets is the harness line the
   assertion came from (tests/PORT-LEDGER.md). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { typeInto } from "../helpers/act.js";

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
      const screening = handle.events.find(e => app.NOISE_TRACKS.has(e.track) && !(e.speakers || []).length);
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

  describe("step 2: the grid", () => {
    const ORDER = ["Tracks", "Fandoms", "Topics", "Guests", "Panelists"];
    let seen;
    beforeAll(() => { grid(); seen = [...view().querySelectorAll(".section-title")].map(t => t.textContent.replace(/\s+/g, " ").trim().split(" ")[0]); });

    /* the fixture has no fandom with 3+ events, so that section is correctly
       absent here; all five are checked against the real schedule */
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
      expect(seen).not.toContain("Fandoms");
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
      const names = app.getCatalogue().panelist.map(p => p.key);
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
    let seeAll;
    beforeAll(() => {
      state.tab = "browse"; handle.render();
      handle.openSheet("event", handle.events.find(e => (e.speakers || []).length > 0).id);
      seeAll = document.querySelector("#panel-event .see-all");
    });
    afterAll(() => { state.explore.page = null; app.setExploreHash(null); state.tab = "now"; handle.render(); });

    it("the detail sheet offers See all beside a speaker [1118]", () => {
      expect(seeAll).toBeTruthy();
    });
    it("pointing at that person's page [1119]", () => {
      expect(seeAll.dataset.explore).toMatch(/^person:/);
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
    handle.render();
  });
});
