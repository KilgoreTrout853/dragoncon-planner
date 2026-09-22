/* Follows: the model, and the Following section at the top of Explore. The
   number in brackets is the harness line the assertion came from
   (tests/PORT-LEDGER.md). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

const storedFollows = () => JSON.parse(window.localStorage.getItem("dc26.follows"));

describe("follows", () => {
  let page, app, handle, state;
  const el = id => document.getElementById(id);
  const ex = () => el("view-explore");
  const most = pick => { const tally = {}; handle.events.forEach(e => pick(e).forEach(k => { if (k) tally[k] = (tally[k] || 0) + 1; })); return Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || null; };

  beforeAll(async () => { page = await bootPage(); ({ app, handle } = page); state = handle.state; }, 30000);
  afterAll(() => page.cleanup());

  describe("step 1: the follow model", () => {
    beforeAll(() => handle.follows.set([]));
    afterAll(() => handle.follows.set([]));

    it("following returns true [953]", () => {
      expect(app.toggleFollow("track", "Trek Track")).toBe(true);
    });
    it("and it is now followed [954]", () => {
      expect(app.isFollowing("track", "Trek Track")).toBe(true);
    });
    it("it persisted [955]", () => {
      expect(storedFollows()).toHaveLength(1);
    });
    it("with its kind [956]", () => {
      expect(storedFollows()[0].kind).toBe("track");
    });
    it("and its exact key [957]", () => {
      expect(storedFollows()[0].key).toBe("Trek Track");
    });
    it("unfollowing returns false [958]", () => {
      expect(app.toggleFollow("track", "Trek Track")).toBe(false);
    });
    it("and it is gone [959]", () => {
      expect(app.isFollowing("track", "Trek Track")).toBe(false);
    });
    it("the removal persisted too [960]", () => {
      expect(storedFollows()).toHaveLength(0);
    });
    it("follows keep the order they were added [963]", () => {
      handle.follows.set([]);
      app.toggleFollow("axis", "subject:space"); app.toggleFollow("track", "Costuming"); app.toggleFollow("work", "rick-and-morty");
      expect(handle.follows.get().map(f => f.kind)).toEqual(["axis", "track", "work"]);
    });
    it("a follow has a stable id [964]", () => {
      expect(app.followId(handle.follows.get()[0])).toBe("axis:subject:space");
    });
  });

  describe("eventsFor, one kind at a time", () => {
    let track, work, axis, person;
    const aboutOrTrack = e => ((e.tags || {}).works || []).filter(w => w.via === "about" || w.via === "track");
    /* The works under a work, walked here from the file's block rather than by
       asking linksTo, which would test the code with itself. */
    const under = id => {
      const parent = new Map(handle.meta.works.map(w => [w.id, w.parent]));
      return new Set(handle.meta.works.map(w => w.id).filter(w => { for (let at = w; at; at = parent.get(at)) if (at === id) return true; return false; }));
    };
    beforeAll(() => {
      track = most(e => e.tracks || []); work = most(e => aboutOrTrack(e).map(w => w.id));
      axis = most(e => ["medium", "genre", "craft", "subject"].flatMap(a => ((e.tags || {})[a] || []).map(v => `${a}:${v}`)));
      person = most(e => (e.people || []).map(p => p.id));
    });

    it("a track follow finds its events [977]", () => {
      expect(app.eventsFor({ kind: "track", key: track }).length).toBeGreaterThan(0);
    });
    it("and only its events [978]", () => {
      expect(app.eventsFor({ kind: "track", key: track }).every(e => (e.tracks || []).includes(track))).toBe(true);
    });
    it("a fandom follow finds its events [983]", () => {
      expect(work).toBeTruthy();
      expect(app.eventsFor({ kind: "work", key: work }).length).toBeGreaterThan(0);
    });
    it("and only those [984]", () => {
      const ids = under(work);
      expect(app.eventsFor({ kind: "work", key: work }).every(e => aboutOrTrack(e).some(w => ids.has(w.id)))).toBe(true);
    });
    it("a work follow takes in the works under it, by about or track and never by a credit", () => {
      const ids = under("star-wars");
      expect(ids.has("andor")).toBe(true);
      const found = app.eventsFor({ kind: "work", key: "star-wars" });
      const expected = handle.events.filter(e => aboutOrTrack(e).some(w => ids.has(w.id)));
      expect(found.map(e => e.id)).toEqual(expected.map(e => e.id));
      expect(found.some(e => aboutOrTrack(e).some(w => w.id === "andor"))).toBe(true);
      expect(found.length).toBeGreaterThan(handle.events.filter(e => aboutOrTrack(e).some(w => w.id === "star-wars")).length);
    });
    it("a topic follow finds its events [988]", () => {
      expect(axis).toBeTruthy();
      expect(app.eventsFor({ kind: "axis", key: axis }).length).toBeGreaterThan(0);
    });
    it("a person follow finds their events [992]", () => {
      expect(person).toBeTruthy();
      expect(app.eventsFor({ kind: "person", key: person }).length).toBeGreaterThan(0);
    });
    it("and only theirs [993]", () => {
      expect(app.eventsFor({ kind: "person", key: person }).every(e => (e.people || []).some(p => p.id === person))).toBe(true);
    });
    it("an unknown key finds nothing [996]", () => {
      expect(app.eventsFor({ kind: "track", key: "No Such Track At All" })).toHaveLength(0);
    });
    it("and so does a malformed follow [997]", () => {
      expect(app.eventsFor(null)).toHaveLength(0);
      expect(app.eventsFor({ kind: "track" })).toHaveLength(0);
    });
    it("a follow's events come back in time order [999]", () => {
      const starts = app.eventsFor({ kind: "track", key: track }).map(e => +e._s);
      expect(starts).toEqual([...starts].sort((a, b) => a - b));
    });
  });

  describe("step 3: Following lives at the top of Explore", () => {
    let wanted;
    const fol = () => el("following");
    const folHead = () => (document.querySelector("#following .fol-head") || { textContent: "" }).textContent.replace(/\s+/g, " ").trim();
    const expanded = () => document.querySelector("#following .fol-head").getAttribute("aria-expanded");
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;

    beforeAll(() => {
      handle.follows.set([]); handle.picks.set([]);
      state.tab = "explore"; state.explore.page = null; state.explore.q = "";
      state.following.expanded = {}; state.following.showPast = {}; state.following.open = true;
      handle.render();
    });
    afterAll(() => { handle.follows.set([]); state.tab = "now"; handle.render(); });

    describe("with nothing followed", () => {
      it("with nothing followed there is no Following section [1133]", () => {
        expect(ex().querySelector(".following")).toBe(null);
      });
      it("and no empty state [1134]", () => {
        expect(ex().querySelector(".empty")).toBe(null);
      });
      it("Explore is just the grid [1135]", () => {
        expect(ex().querySelectorAll(".tile").length).toBeGreaterThan(0);
      });
      it("with a one-line hint [1137]", () => {
        expect(ex().querySelector(".hint").textContent.trim()).toBe("Follow a track, fandom or person and it'll show up here.");
      });
      it("sitting under the first section header [1139]", () => {
        expect(ex().querySelector(".section-title").nextElementSibling).toBe(ex().querySelector(".hint"));
      });
    });

    describe("following two things", () => {
      beforeAll(() => {
        wanted = [app.getCatalogue().track[0].key, app.getCatalogue().track[1].key];
        handle.follows.set([]);
        wanted.forEach(key => app.toggleFollow("track", key));
        handle.render();
      });

      it("following two things puts a Following section on Explore [1151]", () => {
        expect(fol()).toBeTruthy();
      });
      it("and the hint goes away [1152]", () => {
        expect(ex().querySelector(".hint")).toBe(null);
      });
      it("headed Following (2) [1153]", () => {
        expect(folHead()).toMatch(/^Following \(2\)/);
      });
      it("open to start [1154]", () => {
        expect(expanded()).toBe("true");
      });
      it("pinned above everything else [1155]", () => {
        expect(ex().firstElementChild).toBe(fol());
      });
      it("the tile filter box stays with the grid, below it [1158]", () => {
        expect(fol().compareDocumentPosition(el("exploreQ")) & FOLLOWING).toBeTruthy();
      });
      it("and so do the tiles [1159]", () => {
        expect(fol().compareDocumentPosition(ex().querySelector("#exploreGrid .tiles")) & FOLLOWING).toBeTruthy();
      });
      it("chips list the follows in order [1161]", () => {
        expect([...document.querySelectorAll("#following .fc-name")].map(c => c.textContent)).toEqual(wanted);
      });
      it("each chip has an unfollow control [1162]", () => {
        expect(document.querySelectorAll('#following .follow-chip [data-act="unfollow"]')).toHaveLength(2);
      });
      it("and there is a + chip at the end [1163]", () => {
        expect(document.querySelector("#following .fc-add")).toBeTruthy();
      });
      it("a chip links to its Explore page [1164]", () => {
        expect(document.querySelector("#following .fc-name").dataset.explore).toBe("track:" + wanted[0]);
      });
    });

    describe("by interest", () => {
      it("By interest is the default [1166]", () => {
        expect(state.following.layout).toBe("interest");
      });
      it("a section per follow inside Following [1168]", () => {
        expect(document.querySelectorAll("#following .section-title")).toHaveLength(2);
      });
      it("in follow order [1169]", () => {
        expect(document.querySelector("#following .section-title").textContent.trim().startsWith(wanted[0])).toBe(true);
      });
      it("each section shows at most eight to start [1171]", () => {
        expect(document.querySelector("#following .list").querySelectorAll(".row").length).toBeLessThanOrEqual(8);
      });
      it("and 'more' expands it [1176]", () => {
        const more = document.querySelector('#following [data-act="fol-more"]');
        expect(more, "the fixture's first tracks have more than eight events to come").toBeTruthy();
        const before = document.querySelectorAll("#following .row").length;
        more.click();
        expect(document.querySelectorAll("#following .row").length).toBeGreaterThan(before);
      });
    });

    describe("by time", () => {
      beforeAll(() => document.querySelector('[data-act="fol-time"]').click());

      it("the layout toggles [1180]", () => {
        expect(state.following.layout).toBe("time");
      });
      it("and persists [1181]", () => {
        expect(JSON.parse(window.localStorage.getItem("dc26.followingLayout"))).toBe("time");
      });
      it("by time lists each event once [1183]", () => {
        const ids = [...document.querySelectorAll("#following .row")].map(r => r.dataset.id);
        expect(ids.length).toBeGreaterThan(0);
        expect(new Set(ids).size).toBe(ids.length);
      });
      it("grouped under day headers [1184]", () => {
        expect(document.querySelectorAll("#following .day-head").length).toBeGreaterThan(0);
      });
      it("and hour headers [1185]", () => {
        expect(document.querySelectorAll("#following .time-head").length).toBeGreaterThan(0);
      });
      it("the grid is still there under it [1186]", () => {
        expect(document.querySelectorAll("#exploreGrid .tile").length).toBeGreaterThan(0);
      });
      it("starring works from Following [1193]", () => {
        const star = document.querySelector("#following .row .star"), id = star.closest(".row").dataset.id;
        const had = handle.picks.get().has(id);
        star.click();
        expect(handle.picks.get().has(id)).toBe(!had);
        handle.picks.set([]);
      });
    });

    describe("the + chip scrolls down to the grid instead of leaving the tab", () => {
      const calls = [];
      beforeAll(() => {
        /* the harness replaced pageScrollTo; the app scrolls main, through main's own scrollTo when it has one */
        const main = document.querySelector("main");
        main.scrollTo = options => calls.push(options);
        document.querySelector("#following .fc-add").click();
        delete main.scrollTo;
      });

      it("the + chip stays on the Explore grid [1200]", () => {
        expect(state.tab).toBe("explore");
        expect(state.explore.page).toBeFalsy();
      });
      it("and scrolls to the grid [1201]", () => {
        expect(calls).toHaveLength(1);
        expect(calls[0].top).toBeGreaterThanOrEqual(0);
      });
      it("with Following still open above it [1202]", () => {
        expect(fol()).toBeTruthy();
        expect(document.querySelector("#following .fc-name")).toBeTruthy();
      });
    });

    describe("fold it away, and it stays folded", () => {
      it("tapping the header closes Following [1205]", () => {
        document.querySelector("#following .fol-head").click();
        expect(expanded()).toBe("false");
      });
      it("hiding the feed [1206]", () => {
        expect(el("folBody").hidden).toBe(true);
      });
      it("chips and all [1207]", () => {
        expect(document.querySelector("#following .fc-name")).toBe(null);
      });
      it("the header still shows the count [1208]", () => {
        expect(folHead()).toMatch(/^Following \(2\)/);
      });
      it("and the grid is right there [1209]", () => {
        expect(document.querySelectorAll("#exploreGrid .tile").length).toBeGreaterThan(0);
      });
      it("closed is remembered [1210]", () => {
        expect(JSON.parse(window.localStorage.getItem("dc26.followingOpen"))).toBe(false);
      });
      it("and survives reloading the state [1212]", () => {
        state.following.open = app.loadJSON("dc26.followingOpen", true); handle.render();
        expect(expanded()).toBe("false");
      });
      it("tapping again reopens it [1214]", () => {
        document.querySelector("#following .fol-head").click();
        expect(expanded()).toBe("true");
      });
      it("and remembers that too [1215]", () => {
        expect(JSON.parse(window.localStorage.getItem("dc26.followingOpen"))).toBe(true);
      });
    });

    describe("unfollowing from a chip", () => {
      it("unfollowing from a chip removes its section [1220]", () => {
        document.querySelector('[data-act="fol-interest"]').click();
        const before = document.querySelectorAll("#following .section-title").length;
        document.querySelector('#following [data-act="unfollow"]').click();
        expect(document.querySelectorAll("#following .section-title")).toHaveLength(before - 1);
      });
      it("and the header count drops [1221]", () => {
        expect(folHead()).toMatch(/^Following \(1\)/);
      });
      it("and the follow itself [1222]", () => {
        expect(handle.follows.get()).toHaveLength(1);
      });
    });

    describe("a page deep link still works with Following present, and back brings it back", () => {
      it("a deep link opens its page [1227]", () => {
        window.location.hash = "#explore=" + encodeURIComponent("track:" + wanted[1]);
        window.dispatchEvent(new Event("hashchange"));
        expect(document.querySelector("#view-explore .eh-name").textContent).toBe(wanted[1]);
      });
      it("the page stands alone, without the Following section [1228]", () => {
        expect(fol()).toBe(null);
      });
      it("back returns to the grid with Following on top [1230]", () => {
        document.querySelector('[data-act="explore-back"]').click();
        expect(fol()).toBeTruthy();
        expect(folHead()).toMatch(/^Following \(1\)/);
      });
      it("the URL keeps the simulated clock and drops the page [1231]", () => {
        expect(window.location.hash).not.toMatch(/explore=/);
        expect(window.location.search).toMatch(/now=/);
      });
      it("unfollowing the last one removes the section [1234]", () => {
        document.querySelector('#following [data-act="unfollow"]').click();
        expect(fol()).toBe(null);
      });
      it("and the hint is back [1235]", () => {
        expect(ex().querySelector(".hint")).toBeTruthy();
      });
    });
  });
});

/* The harness saved four junk entries and then filtered them with a copy of
   the app's rule written into the test; the app's own loader never ran. It
   runs when the module is imported, so: junk in storage, then a boot. It
   judges a follow's shape, never whether the schedule knows its key, so v1's
   follows fall away and a follow of something with no events stays. */
describe("a boot with junk among the stored follows", () => {
  let page;
  const kept = [{ kind: "track", key: "Costuming" }, { kind: "work", key: "no-such-work" }];
  beforeAll(async () => {
    window.localStorage.setItem("dc26.follows", JSON.stringify([{ kind: "bogus", key: "x" }, { kind: "track" }, null, kept[0],
      { kind: "fandom", key: "Star Trek" }, { kind: "topic", key: "Space" }, { kind: "person", key: "Nathan Fillion" }, kept[1]]));
    page = await bootPage();
  }, 30000);
  afterAll(() => page.cleanup());

  it("malformed stored follows are dropped on load [966]", () => {
    expect(page.handle.follows.get()).toEqual(kept);
  });
  it("a follow of something with no events stays, and its page says nothing matches it", () => {
    page.handle.state.tab = "explore";
    page.handle.render();
    const chip = [...document.querySelectorAll("#following .fc-name")].find(b => b.dataset.explore === "work:no-such-work");
    expect(chip).toBeTruthy();
    chip.click();
    expect(document.querySelector("#view-explore .empty").textContent).toMatch(/Nothing in the schedule matches this any more/);
  });
});
