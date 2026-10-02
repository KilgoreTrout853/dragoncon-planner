/* The filter sheet (W13, with W8's topic axes; DECISIONS #70;
   docs/screens/contract.md, section 3, as built): Search's filters in a
   sheet panel, #panel-filters, opened by the Filters button beside the box.
   A tap changes state.browse at once and the panel's count with it, the
   list behind waiting for the sheet to close; the badge counts what the
   sheet set that is in effect, and each is a chip under the box. One value
   per filter, and the last one set wins: a tap in the sheet takes a word
   in the box out of the query, and a word typed takes the sheet's value
   for its dimension to All once the box is left. On a copy of the sample whose untagged events
   carry the four axes at counts that differ, so that each axis's filter and
   the options' order have something to tell apart. New tests, not rows of
   tests/PORT-LEDGER.md. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { mutationsDuring, touch, typeInto } from "../helpers/act.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(fs.readFileSync(path.join(HERE, "..", "sample-events.json"), "utf8"));
const css = fs.readFileSync(path.join(HERE, "..", "..", "src", "styles.css"), "utf8");
const noise = e => ["Epic Photos", "Video Room"].includes(e.track) || /^photo session/i.test(e.title);

/* The first 150 untagged events take the axes: tv three in six, film two,
   books one; horror one in three, fantasy the rest; writing one in five;
   space one in two and tech one in ten. */
let n = 0;
const axesFor = i => ({
  medium: [i % 6 < 3 ? "tv" : i % 6 < 5 ? "film" : "books"],
  genre: [i % 3 === 0 ? "horror" : "fantasy"],
  craft: i % 5 === 0 ? ["writing"] : [],
  subject: i % 2 === 0 ? ["space"] : i % 10 === 1 ? ["tech"] : [],
});
const data = { ...sample, events: sample.events.map(e => ("tags" in e || e.removed || n >= 150 ? e : { ...e, tags: axesFor(n++) })) };
/* And a schedule with no tags at all: a year's first days, before its first
   tag - and no Kids Track, so that the word "kids" holds a track it lacks. */
const kidsTrack = t => (t === "Kids Track" ? "Family Track" : t);
const untagged = { ...sample, events: sample.events.map(e => {
  const rest = { ...e, tracks: (e.tracks || []).map(kidsTrack), track: kidsTrack(e.track) };
  delete rest.tags;
  return rest;
}) };

const FILTERS = { q: "", day: "All", prevDay: null, hotel: "All", type: "All", track: "All", work: "All", kind: "All",
  medium: "All", genre: "All", craft: "All", subject: "All", showHidden: false, showPast: false, noToday: false, hideNoise: true, page: 1 };
const NINE = ["hotel", "kind", "type", "work", "track", "medium", "genre", "craft", "subject"];
const showSays = k => (k === 0 ? "No events match" : k === 1 ? "Show 1 event" : `Show ${k.toLocaleString("en-US")} events`);

describe("the filter sheet", () => {
  let page, app, handle, state;
  const el = id => document.getElementById(id);
  const view = () => el("view-browse");
  const panel = () => el("panel-filters");
  const open = () => el("filtersBtn").click();
  const fchip = (kind, value) => panel().querySelector(`[data-chip="${kind}"][data-value="${value}"]`);
  const choose = (id, value) => { const s = el(id); s.value = value; s.dispatchEvent(new Event("change", { bubbles: true })); };
  const says = () => el("filtersShow").textContent;
  const reset = (over = {}) => { if (!el("sheetWrap").hidden) handle.closeSheet(); state.tab = "browse"; Object.assign(state.browse, FILTERS, over); handle.render(); };
  /* What the list holds with no query and photo sessions hidden, worked out
     here from the events, not read back from the app. */
  const tg = e => e.tags || {};
  const counted = pred => handle.events.filter(e => pred(e) && !noise(e)).length;
  const chipsUnder = () => [...view().querySelectorAll(".parsed-chips .chip")];
  const browseRest = () => el("browseRest");
  const listDraws = during => mutationsDuring(browseRest(), during).filter(r => r.type === "childList" && r.target === browseRest()).length;

  beforeAll(async () => {
    page = await bootPage({ data });
    ({ app, handle } = page);
    state = handle.state;
    await page.until(() => app.BOOT.indexed > 0, 20000, "the index");
    reset();
  }, 30000);
  afterAll(() => page.cleanup());

  describe("the page: the box, the Filters button beside it, the day chips", () => {
    beforeAll(() => reset());

    it("the sticky block holds the box, the Filters button right of it, and the day chips", () => {
      const sticky = view().querySelector(".controls-sticky");
      expect([...sticky.querySelector(".search-row").children].map(c => c.id)).toEqual(["q", "filtersBtn"]);
      expect(sticky.querySelector("#dayChips [data-chip='day']")).toBeTruthy();
      expect(el("filtersBtn").textContent.trim()).toBe("Filters");
    });
    it("and none of the filters is on the page any more: no hotel, kind or type chip, no select, no toggle", () => {
      expect(view().querySelector('[data-chip="hotel"], [data-chip="kind"], [data-chip="type"], select, #hideNoise')).toBe(null);
    });
    it("the box is named for a screen reader, and its placeholder is the shorter one", () => {
      expect(el("q").getAttribute("aria-label")).toBe("Search the schedule");
      expect(["Search titles, guests, fandoms", "Titles, guests, fandoms"]).toContain(el("q").placeholder);
      expect(el("q").placeholder).toBe(app.SEARCH_PLACEHOLDER);
    });
    it("with nothing set and nothing typed, the results' title comes straight after the day chips", () => {
      expect(browseRest().firstElementChild.className).toBe("section-title");
    });
    it("the button says it opens a dialog, and with nothing set has no badge", () => {
      expect(el("filtersBtn").getAttribute("aria-haspopup")).toBe("dialog");
      expect(el("filtersBtn").getAttribute("aria-label")).toBe("Filters");
      expect(el("filtersBadge").hidden).toBe(true);
    });
  });

  describe("opening it", () => {
    beforeAll(() => { reset(); el("filtersBtn").focus(); open(); });
    afterAll(() => reset());

    it("shows the sheet with the filter panel alone", () => {
      expect(el("sheetWrap").hidden).toBe(false);
      expect(panel().hidden).toBe(false);
      expect([...document.querySelectorAll(".sheet-panel")].filter(p => !p.hidden).map(p => p.id)).toEqual(["panel-filters"]);
      expect(el("sheet").getAttribute("aria-labelledby")).toBe("sheetTitleFilters");
    });
    it("and another panel opened over it hides it", () => {
      handle.openSheet("settings");
      expect(panel().hidden).toBe(true);
      expect(el("panel-settings").hidden).toBe(false);
      handle.closeSheet();
      el("filtersBtn").focus();
      open();
    });
    it("focus goes to its heading (#66)", () => {
      expect(document.activeElement).toBe(el("sheetTitleFilters"));
      expect(el("sheetTitleFilters").textContent).toBe("Filters");
    });
    it("the groups in order: Hotel, Fandom with Track, Topics, Type, Kind, the toggle", () => {
      expect([...panel().querySelectorAll("[data-group]")].map(g => g.dataset.group)).toEqual(["hotel", "pick", "topics", "type", "kind", "noise"]);
    });
    it("Hotel and Kind carry their small labels, which name their groups", () => {
      for (const [group, label] of [["hotel", "Hotel"], ["kind", "Kind"]]) {
        const g = panel().querySelector(`[data-group="${group}"]`);
        expect(g.getAttribute("role")).toBe("group");
        expect(el(g.getAttribute("aria-labelledby")).textContent).toBe(label);
      }
    });
    it("the hotel chips: All, then each hotel the schedule has, wrapped", () => {
      expect([...panel().querySelectorAll('[data-chip="hotel"]')].map(c => c.dataset.value)).toEqual(["All", ...app.hotelChips]);
      expect(fchip("hotel", "All").closest(".filter-chips")).toBeTruthy();
    });
    it("the kind chips: Any kind, then each kind the schedule has", () => {
      const kinds = Object.keys(app.KIND_LABELS).filter(k => handle.events.some(e => tg(e).kind === k));
      expect([...panel().querySelectorAll('[data-chip="kind"]')].map(c => c.textContent)).toEqual(["Any kind", ...kinds.map(k => app.KIND_LABELS[k])]);
    });
    it("the Type control: All, Panels, Gaming", () => {
      const seg = panel().querySelector('[data-group="type"] .seg');
      expect(seg.getAttribute("aria-label")).toBe("Type");
      expect([...seg.querySelectorAll("button")].map(b => b.textContent)).toEqual(["All", "Panels", "Gaming"]);
    });
    it("Fandom and Track side by side, each with its first option", () => {
      const pair = panel().querySelector(".filter-pair");
      expect([...pair.querySelectorAll("select")].map(s => s.id)).toEqual(["fandom", "track"]);
      expect(el("fandom").options[0].textContent).toBe("Any fandom");
      expect(el("track").options[0].textContent).toBe("All tracks");
    });
    it("the four topic selects, two by two, each 'Any <axis>' and then its values by count, with the count", () => {
      const grid = panel().querySelector(".filter-topics");
      expect([...grid.querySelectorAll("select")].map(s => s.getAttribute("aria-label"))).toEqual(["Medium", "Genre", "Craft", "Subject"]);
      for (const [id, axis] of [["filterMedium", "medium"], ["filterGenre", "genre"], ["filterCraft", "craft"], ["filterSubject", "subject"]]) {
        const counts = new Map();
        handle.events.forEach(e => (tg(e)[axis] || []).forEach(v => counts.set(v, (counts.get(v) || 0) + 1)));
        const want = [...counts].map(([v, k]) => ({ v, label: app.axisLabel(`${axis}:${v}`), k }))
          .sort((a, b) => b.k - a.k || a.label.localeCompare(b.label));
        const options = [...el(id).options];
        expect(options[0].textContent).toBe(`Any ${axis}`);
        expect(options.slice(1).map(o => [o.value, o.textContent])).toEqual(want.map(w => [w.v, `${w.label} (${w.k})`]));
      }
    });
    it("the medium's order is by count: TV before Film before Literature", () => {
      expect([...el("filterMedium").options].slice(1, 4).map(o => o.value)).toEqual(["tv", "film", "books"]);
    });
    it("every control in it has a name", () => {
      const named = c => (c.getAttribute("aria-label") || c.textContent.trim() || (c.closest("label") || {}).textContent || "").trim();
      const controls = [...panel().querySelectorAll("button, select, input")];
      expect(controls.length).toBeGreaterThan(20);
      expect(controls.filter(c => !named(c)).map(c => c.outerHTML)).toEqual([]);
    });
    it("the main button counts what the list holds, and Clear has nothing to clear", () => {
      expect(says()).toBe(showSays(counted(() => true)));
      expect(el("filtersClear").disabled).toBe(true);
    });
  });

  describe("each control changes state.browse and the count at once, and nothing behind is drawn", () => {
    beforeAll(() => { reset(); open(); });
    afterAll(() => reset());
    const quiet = during => expect(mutationsDuring(view(), during)).toHaveLength(0);

    it("a hotel chip", () => {
      quiet(() => fchip("hotel", "Westin").click());
      expect(state.browse.hotel).toBe("Westin");
      expect(fchip("hotel", "Westin").getAttribute("aria-pressed")).toBe("true");
      expect(fchip("hotel", "All").getAttribute("aria-pressed")).toBe("false");
      expect(says()).toBe(showSays(counted(e => app.hotelGroup(e.hotel) === "Westin")));
    });
    it("the same hotel again is All", () => {
      quiet(() => fchip("hotel", "Westin").click());
      expect(state.browse.hotel).toBe("All");
      expect(fchip("hotel", "All").getAttribute("aria-pressed")).toBe("true");
    });
    it("a kind chip, and a second one replaces it: one value per filter", () => {
      quiet(() => fchip("kind", "performance").click());
      expect(state.browse.kind).toBe("performance");
      expect(says()).toBe(showSays(counted(e => tg(e).kind === "performance")));
      quiet(() => fchip("kind", "contest").click());
      expect(state.browse.kind).toBe("contest");
      expect(panel().querySelectorAll('[data-chip="kind"][aria-pressed="true"]')).toHaveLength(1);
      fchip("kind", "All").click();
    });
    it("the Type control", () => {
      quiet(() => fchip("type", "gaming").click());
      expect(state.browse.type).toBe("gaming");
      expect(says()).toBe(showSays(counted(e => e.type === "gaming")));
      fchip("type", "All").click();
      expect(state.browse.type).toBe("All");
    });
    it("the Fandom select", () => {
      const work = el("fandom").options[1].value;
      quiet(() => choose("fandom", work));
      expect(state.browse.work).toBe(work);
      expect(says()).toBe(showSays(counted(e => app.linksTo(e, work))));
      choose("fandom", "All");
    });
    it("the Track select", () => {
      quiet(() => choose("track", "Puppetry"));
      expect(state.browse.track).toBe("Puppetry");
      expect(says()).toBe(showSays(counted(e => (e.tracks || []).includes("Puppetry"))));
      choose("track", "All");
    });
    it.each([["filterMedium", "medium", "film"], ["filterGenre", "genre", "horror"], ["filterCraft", "craft", "writing"], ["filterSubject", "subject", "tech"]])(
      "the %s select", (id, axis, value) => {
        quiet(() => choose(id, value));
        expect(state.browse[axis]).toBe(value);
        expect(says()).toBe(showSays(counted(e => (tg(e)[axis] || []).includes(value))));
        choose(id, "All");
        expect(state.browse[axis]).toBe("All");
      });
    it("two axes together: both must hold", () => {
      quiet(() => { choose("filterMedium", "tv"); choose("filterGenre", "horror"); });
      expect(says()).toBe(showSays(counted(e => tg(e).medium?.includes("tv") && tg(e).genre?.includes("horror"))));
      choose("filterMedium", "All"); choose("filterGenre", "All");
    });
    it("the toggle", () => {
      quiet(() => el("hideNoise").click());
      expect(state.browse.hideNoise).toBe(false);
      expect(says()).toBe(showSays(handle.events.length));
      el("hideNoise").click();
      expect(state.browse.hideNoise).toBe(true);
    });
    it("one event: 'Show 1 event'", () => {
      expect(counted(e => tg(e).kind === "qa")).toBe(1);
      fchip("kind", "qa").click();
      expect(says()).toBe("Show 1 event");
      fchip("kind", "All").click();
    });
    it("none: 'No events match', and the button still closes the sheet", () => {
      choose("filterMedium", "books"); choose("filterGenre", "horror");
      expect(counted(e => tg(e).medium?.includes("books") && tg(e).genre?.includes("horror"))).toBe(0);
      expect(says()).toBe("No events match");
      expect(el("filtersShow").disabled).toBe(false);
      el("filtersShow").click();
      expect(el("sheetWrap").hidden).toBe(true);
    });
    it("and the empty list then says to remove a filter first", () => {
      expect(view().querySelector(".empty").textContent).toBe("No matches. Remove a filter above, or try another day or fewer words.");
    });
    it("with nothing of the sheet's set, the empty list's words are as they were", () => {
      reset({ q: "zzqxjv" });
      expect(app.browseResults()).toHaveLength(0);
      expect(view().querySelector(".empty").textContent).toBe("No matches. Try fewer or different words, another day, or turn off the photo/video filter.");
    });
  });

  describe("closing draws the list once, whichever way it closes, and gives focus back to Filters", () => {
    const westin = () => counted(e => app.hotelGroup(e.hotel) === "Westin");
    const ways = {
      "Show <n> events": () => el("filtersShow").click(),
      "the backdrop": () => el("sheetBack").click(),
      "Escape": () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })),
      "a swipe down on the heading": () => {
        const h = el("sheetTitleFilters");
        touch(h, "touchstart", { y: 100 });
        touch(h, "touchmove", { y: 300 });
        touch(h, "touchend", null);
        el("sheet").dispatchEvent(new Event("transitionend"));
      },
    };
    it.each(Object.keys(ways))("%s", way => {
      reset();
      el("filtersBtn").focus();
      open();
      fchip("hotel", "Westin").click();
      const said = says();
      expect(listDraws(ways[way])).toBe(1);
      expect(el("sheetWrap").hidden).toBe(true);
      expect(said).toBe(showSays(westin()));
      expect(view().querySelector(".section-title .count").textContent).toBe(String(westin()));
      const rooms = [...view().querySelectorAll(".row .room .rh")].map(r => r.textContent);
      expect(rooms.length).toBeGreaterThan(0);
      expect(new Set(rooms)).toEqual(new Set(["Westin"]));
      expect(document.activeElement).toBe(el("filtersBtn"));
    });
    /* settle() closes on the transition's end and again on its timer: let
       the timer's go by before the next describe. */
    afterAll(() => new Promise(r => setTimeout(r, 400)));
    it("a drag that starts in the panel's body scrolls it and leaves the sheet open", () => {
      reset();
      open();
      const chip = fchip("hotel", "Hilton");
      touch(chip, "touchstart", { y: 100 });
      touch(chip, "touchmove", { y: 300 });
      touch(chip, "touchend", null);
      expect(el("sheet").style.transform).toBe("");
      expect(el("sheetWrap").hidden).toBe(false);
      reset();
    });
  });

  describe("where the list stands after closing", () => {
    const main = () => document.querySelector("main");
    afterAll(() => reset());

    it("anything changed: the list from its top", () => {
      reset();
      main().scrollTop = 300;
      open();
      fchip("kind", "performance").click();
      el("filtersShow").click();
      expect(main().scrollTop).toBe(0);
    });
    it("nothing changed: where it was", () => {
      reset();
      main().scrollTop = 300;
      open();
      el("filtersShow").click();
      expect(main().scrollTop).toBe(300);
    });
    it("the toggle alone is a change", () => {
      reset();
      main().scrollTop = 300;
      open();
      el("hideNoise").click();
      el("filtersShow").click();
      expect(main().scrollTop).toBe(0);
    });
    it("a change taken back before closing is no change", () => {
      reset();
      main().scrollTop = 300;
      open();
      fchip("hotel", "Hyatt").click();
      fchip("hotel", "Hyatt").click();
      el("sheetBack").click();
      expect(main().scrollTop).toBe(300);
    });
  });

  describe("Clear", () => {
    afterAll(() => reset());

    it("with nothing set and the toggle at Settings' default, it is disabled", () => {
      reset();
      open();
      expect(state.browse.hideNoise).toBe(app.settings.hideNoise);
      expect(el("filtersClear").disabled).toBe(true);
    });
    it("the toggle alone off its default enables it", () => {
      el("hideNoise").click();
      expect(el("filtersClear").disabled).toBe(false);
      el("hideNoise").click();
      expect(el("filtersClear").disabled).toBe(true);
    });
    it("takes every one of the nine back to All, and the toggle to Settings' default - not the day, nor the query", () => {
      reset({ q: "trek", day: "2026-09-05", hotel: "Hilton", kind: "panel", type: "panel", work: app.topWorks()[0].id, track: "Puppetry",
        medium: "tv", genre: "horror", craft: "writing", subject: "space", hideNoise: false });
      open();
      expect(el("filtersClear").disabled).toBe(false);
      const quiet = mutationsDuring(view(), () => el("filtersClear").click());
      expect(quiet).toHaveLength(0);
      expect(NINE.map(d => state.browse[d])).toEqual(NINE.map(() => "All"));
      expect(state.browse.hideNoise).toBe(app.settings.hideNoise);
      expect(state.browse).toMatchObject({ q: "trek", day: "2026-09-05" });
    });
    it("and the panel says so in place: the chips, the selects, the toggle, the count, Clear", () => {
      expect(fchip("hotel", "All").getAttribute("aria-pressed")).toBe("true");
      expect(fchip("type", "All").getAttribute("aria-pressed")).toBe("true");
      expect(["track", "filterMedium", "filterGenre", "filterCraft", "filterSubject"].map(id => el(id).value)).toEqual(["All", "All", "All", "All", "All"]);
      expect(el("hideNoise").checked).toBe(true);
      expect(says()).toBe(showSays(app.browseResults().length));
      expect(el("filtersClear").disabled).toBe(true);
    });
    it("and takes the list back to its first page", () => {
      reset({ hotel: "Hilton", page: 3 });
      open();
      el("filtersClear").click();
      expect(state.browse.page).toBe(1);
      handle.closeSheet();
      expect(view().querySelectorAll(".row").length).toBeLessThanOrEqual(150);
    });
  });

  describe("the badge", () => {
    afterAll(() => reset());

    it("counts the sheet's filters in effect, and the button's name says how many", () => {
      reset();
      open();
      fchip("hotel", "Westin").click();
      fchip("kind", "performance").click();
      choose("filterMedium", "film");
      el("filtersShow").click();
      expect(el("filtersBadge").hidden).toBe(false);
      expect(el("filtersBadge").textContent).toBe("3");
      expect(el("filtersBtn").getAttribute("aria-label")).toBe("Filters, 3 set");
    });
    it("counts all nine", () => {
      reset({ hotel: "Hilton", kind: "panel", type: "panel", work: "star-trek", track: "Puppetry", medium: "tv", genre: "horror", craft: "writing", subject: "space" });
      expect(el("filtersBadge").textContent).toBe("9");
    });
    it("but not the day, the query's words, or the toggle", () => {
      reset({ q: "concert saturday westin", day: "2026-09-04", hideNoise: false });
      expect(view().querySelectorAll(".chip.parsed").length).toBeGreaterThan(0);
      expect(el("filtersBadge").hidden).toBe(true);
      expect(el("filtersBtn").getAttribute("aria-label")).toBe("Filters");
    });
    it("a redraw writes the badge alone: the box and the button are the same nodes", () => {
      const box = el("q"), btn = el("filtersBtn");
      reset({ hotel: "Hyatt" });
      expect(el("q")).toBe(box);
      expect(el("filtersBtn")).toBe(btn);
      expect(el("filtersBadge").textContent).toBe("1");
    });
  });

  describe("the chips under the box", () => {
    let work;
    beforeAll(() => { work = app.topWorks()[0]; });
    afterAll(() => reset());
    const under = () => chipsUnder().map(c => c.getAttribute("aria-label"));

    it("one row, labelled Filters in effect: the query's words first, then the sheet's, in the sheet's order", () => {
      reset({ q: "saturday", subject: "space", track: "Puppetry", hotel: "Westin", work: work.id, kind: "performance", type: "gaming", medium: "tv", genre: "horror", craft: "writing" });
      const row = view().querySelector(".parsed-chips");
      expect(row.getAttribute("role")).toBe("group");
      expect(row.getAttribute("aria-label")).toBe("Filters in effect");
      expect(under()).toEqual(["Remove Saturday filter", "Remove Westin filter", `Remove ${work.name} filter`, "Remove Puppetry filter",
        "Remove TV filter", "Remove Horror filter", "Remove Writing filter", "Remove Space filter", "Remove Gaming filter", "Remove Performance filter"]);
      expect(chipsUnder().map(c => c.querySelector(".chip-label").textContent).slice(1, 3)).toEqual(["Westin", work.name]);
    });
    it("a tap takes that one filter off, and focus goes to the chip that takes its place", () => {
      view().querySelector('[data-act="unfilter"][data-dim="hotel"]').click();
      expect(state.browse.hotel).toBe("All");
      expect(state.browse).toMatchObject({ kind: "performance", type: "gaming", medium: "tv" });
      expect(document.activeElement.getAttribute("aria-label")).toBe(`Remove ${work.name} filter`);
    });
    it("the last chip taken off gives focus to the Filters button, never the box", () => {
      view().querySelector('[data-act="unfilter"][data-dim="kind"]').click();
      expect(state.browse.kind).toBe("All");
      expect(document.activeElement).toBe(el("filtersBtn"));
    });
    it("a query's word taken off: focus to the chip in its place, and the word out of the box", () => {
      view().querySelector('[data-act="unparse"]').click();
      expect(state.browse.q).toBe("");
      expect(document.activeElement).not.toBe(el("q"));
      expect(document.activeElement.getAttribute("aria-label")).toBe(`Remove ${work.name} filter`);
    });
    it("the only chip taken off: focus to the Filters button", () => {
      reset({ hotel: "Hilton" });
      view().querySelector('[data-act="unfilter"]').click();
      expect(view().querySelector(".parsed-chips")).toBe(null);
      expect(document.activeElement).toBe(el("filtersBtn"));
    });
    it("Today, taken off, the same way", () => {
      reset({ q: "party", day: "All" });
      expect(state.browse.todayScoped).toBe(true);
      view().querySelector('[data-act="unparse-today"]').click();
      expect(state.browse.noToday).toBe(true);
      expect(document.activeElement.getAttribute("aria-label")).toBe("Remove Party filter");
    });
    it("a hotel is named as its chip in the sheet names it: the Courtland Grand, Courtland", () => {
      reset({ hotel: "Courtland Grand" });
      const c = view().querySelector('[data-act="unfilter"][data-dim="hotel"]');
      expect(c.querySelector(".chip-label").textContent).toBe("Courtland");
      expect(c.getAttribute("aria-label")).toBe("Remove Courtland filter");
    });
    it("a long label: the chip's name carries it whole", () => {
      reset({ track: "Role-Playing Games (Campaign)" });
      const c = view().querySelector('[data-act="unfilter"][data-dim="track"]');
      expect(c.getAttribute("aria-label")).toBe("Remove Role-Playing Games (Campaign) filter");
      expect(c.querySelector(".chip-label").textContent).toBe("Role-Playing Games (Campaign)");
    });
    it("the row keeps its place across a redraw", () => {
      reset({ q: "saturday", hotel: "Westin", kind: "performance", medium: "tv" });
      view().querySelector(".parsed-chips").scrollLeft = 90;
      handle.render();
      expect(view().querySelector(".parsed-chips").scrollLeft).toBe(90);
    });
  });

  /* One value per filter, and the last one set wins (DECISIONS #71): a tap
     in the sheet on a dimension a word in the box holds takes the word out of
     the query, as its chip's x does, and sets the value tapped. */
  describe("the last one set wins: a tap in the sheet over a word in the box", () => {
    const under = () => chipsUnder().filter(c => c.dataset.act !== "unparse-today").map(c => c.getAttribute("aria-label"));
    afterAll(() => reset());

    it("the sheet shows what is in effect, and no control that sets a filter is disabled or noted", () => {
      reset({ q: "hilton contest kids" });
      open();
      expect(fchip("hotel", "Hilton").getAttribute("aria-pressed")).toBe("true");
      expect(fchip("kind", "contest").getAttribute("aria-pressed")).toBe("true");
      expect(el("track").value).toBe("Kids Track");
      expect([...panel().querySelectorAll("button, select, input")].filter(c => c.id !== "filtersClear" && c.disabled).map(c => c.outerHTML)).toEqual([]);
      expect(panel().querySelector("[aria-describedby], .filter-held")).toBe(null);
      expect(panel().textContent).not.toMatch(/Set by your search/);
    });
    it("'star trek hilton', the Marriott tapped: the word comes out, the Marriott is set, focus stays on it, nothing behind is drawn", () => {
      reset({ q: "star trek hilton" });
      open();
      const chip = fchip("hotel", "Marriott");
      chip.focus();
      expect(mutationsDuring(view(), () => chip.click())).toHaveLength(0);
      expect(state.browse).toMatchObject({ q: "star trek", hotel: "Marriott" });
      expect(document.activeElement).toBe(chip);
      expect(chip.getAttribute("aria-pressed")).toBe("true");
      expect(fchip("hotel", "Hilton").getAttribute("aria-pressed")).toBe("false");
      expect(el("q").value).toBe("star trek hilton");
    });
    it("the sheet closed: the box shows the changed query, and under it the Marriott alone", () => {
      el("filtersShow").click();
      expect(el("q").value).toBe("star trek");
      expect(under()).toEqual(["Remove Marriott filter"]);
      expect(el("filtersBadge").textContent).toBe("1");
    });
    it("the count follows at once: 'hilton', the Marriott tapped, counts the Marriott's", () => {
      reset({ q: "hilton" });
      open();
      fchip("hotel", "Marriott").click();
      expect(state.browse.q).toBe("");
      expect(says()).toBe(showSays(counted(e => app.hotelGroup(e.hotel) === "Marriott")));
    });
    it("a second tap on the hotel in effect is All: 'hilton', the Hilton tapped", () => {
      reset({ q: "hilton" });
      open();
      fchip("hotel", "Hilton").click();
      expect(state.browse).toMatchObject({ q: "", hotel: "All" });
      expect(fchip("hotel", "All").getAttribute("aria-pressed")).toBe("true");
      expect(says()).toBe(showSays(counted(() => true)));
    });
    it("a kind word: 'contest', Performance tapped", () => {
      reset({ q: "contest" });
      open();
      const chip = fchip("kind", "performance");
      chip.focus();
      chip.click();
      expect(state.browse).toMatchObject({ q: "", kind: "performance" });
      expect(document.activeElement).toBe(chip);
      expect(fchip("kind", "contest").getAttribute("aria-pressed")).toBe("false");
      expect(says()).toBe(showSays(counted(e => tg(e).kind === "performance")));
    });
    it("the kind in effect tapped again: 'contest' in the box, Contest tapped - the word comes out and Contest stays set, only a hotel toggling", () => {
      reset({ q: "contest" });
      open();
      fchip("kind", "contest").click();
      expect(state.browse).toMatchObject({ q: "", kind: "contest" });
      expect(fchip("kind", "contest").getAttribute("aria-pressed")).toBe("true");
      fchip("kind", "contest").click();
      expect(state.browse.kind).toBe("contest");
    });
    it("'kids' holds Track: a choice in the select takes the word out, and with it the 18+ it hid", () => {
      reset({ q: "kids saturday" });
      open();
      expect(app.activeFilters()).toMatchObject({ track: "Kids Track", hideAdult: true });
      el("track").focus();
      choose("track", "Puppetry");
      expect(state.browse).toMatchObject({ q: "saturday", track: "Puppetry" });
      expect(app.activeFilters()).toMatchObject({ track: "Puppetry", hideAdult: false });
      expect(document.activeElement).toBe(el("track"));
      expect(el("track").value).toBe("Puppetry");
    });
    it("'photo' holds Kind: Contest tapped takes it out, and photo sessions are hidden again", () => {
      reset({ q: "photo" });
      open();
      expect(app.activeFilters()).toMatchObject({ kind: "photo", hideNoise: false });
      fchip("kind", "contest").click();
      expect(state.browse).toMatchObject({ q: "", kind: "contest" });
      expect(app.activeFilters()).toMatchObject({ kind: "contest", hideNoise: true });
      expect(says()).toBe(showSays(counted(e => tg(e).kind === "contest")));
    });
    it("'photo op', a phrase, comes out whole", () => {
      reset({ q: "trek photo op" });
      open();
      fchip("kind", "All").click();
      expect(state.browse).toMatchObject({ q: "trek", kind: "All" });
    });
    it("a second hotel word behind the first comes out too, so the hotel tapped is the one in effect", () => {
      reset({ q: "hilton hyatt" });
      open();
      fchip("hotel", "Marriott").click();
      expect(state.browse.q).toBe("");
      expect(app.activeFilters().hotel).toBe("Marriott");
    });
    it("Clear takes the sheet's filters back and leaves the query, its word still pressed", () => {
      reset({ q: "contest", hotel: "Westin" });
      open();
      el("filtersClear").click();
      expect(state.browse).toMatchObject({ q: "contest", kind: "All", hotel: "All" });
      expect(fchip("kind", "contest").getAttribute("aria-pressed")).toBe("true");
    });
  });

  /* And a word typed replaces the sheet's value for its dimension, once the
     box is left - the return key, the box losing focus, the sheet opening -
     never a keystroke: "photo" on the way to "photoshoot" is not a word. */
  describe("the last one set wins: a word typed over the sheet's value, once the box is left", () => {
    const under = () => chipsUnder().filter(c => c.dataset.act !== "unparse-today").map(c => c.getAttribute("aria-label"));
    const box = () => el("q");
    const type = v => { box().focus(); typeInto(box(), v); };
    const drawn = (label, want = true) => page.until(() => under().includes(label) === want, 5000, "the debounced draw");
    afterAll(() => { box().blur(); reset(); });

    it("while typing the word wins and the sheet's value is kept, unshown: 'hilton' over the Hyatt", async () => {
      reset({ hotel: "Hyatt" });
      type("hilton");
      await drawn("Remove Hilton filter");
      expect(under()).toEqual(["Remove Hilton filter"]);
      expect(el("filtersBadge").hidden).toBe(true);
      expect(state.browse.hotel).toBe("Hyatt");
      expect(app.activeFilters().hotel).toBe("Hilton");
    });
    it("the word deleted before the box is left: the Hyatt is still there", async () => {
      typeInto(box(), "");
      await drawn("Remove Hyatt filter");
      expect(state.browse.hotel).toBe("Hyatt");
      expect(el("filtersBadge").textContent).toBe("1");
    });
    it("'hilton' typed and the box left: the Hyatt goes to All, and nothing shown changes", async () => {
      typeInto(box(), "hilton");
      await drawn("Remove Hilton filter");
      expect(mutationsDuring(document.body, () => box().blur())).toHaveLength(0);
      expect(state.browse.hotel).toBe("All");
      expect(app.activeFilters().hotel).toBe("Hilton");
    });
    it("then the word deleted: the hotel is All, and nothing comes back", async () => {
      type("");
      await drawn("Remove Hilton filter", false);
      box().blur();
      expect(state.browse.hotel).toBe("All");
      expect(app.activeFilters().hotel).toBe("All");
      expect(under()).toEqual([]);
      expect(el("filtersBadge").hidden).toBe(true);
    });
    it.each([
      ["the box losing focus", () => el("q").blur()],
      ["the return key", () => el("q").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))],
      ["a change event, the box still focused", () => el("q").dispatchEvent(new Event("change", { bubbles: true }))],
    ])("each moment applies it: %s", (_, finish) => {
      reset({ kind: "performance" });
      type("contest");
      finish();
      expect(state.browse.kind).toBe("All");
      app.browseResults();
      expect(app.activeFilters().kind).toBe("contest");
      box().blur();
    });
    it("Kind = Workshop, 'photoshoot' typed through 'photo', the box left: Workshop still set and in effect", async () => {
      reset({ kind: "workshop" });
      type("photo");
      app.browseResults();
      expect(app.activeFilters().kind).toBe("photo");
      typeInto(box(), "photoshoot");
      box().blur();
      expect(state.browse.kind).toBe("workshop");
      app.browseResults();
      expect(app.activeFilters().kind).toBe("workshop");
      await drawn("Remove Workshop filter");
      expect(el("filtersBadge").textContent).toBe("1");
    });
    it("'gaming trivia' typed with a sheet kind set: the kind survives", () => {
      reset({ kind: "performance" });
      type("gaming");
      app.browseResults();
      expect(app.activeFilters().kind).toBe("gaming");
      typeInto(box(), "gaming trivia");
      box().blur();
      expect(state.browse.kind).toBe("performance");
      app.browseResults();
      expect(app.activeFilters().kind).toBe("performance");
    });
    it("'photo' typed over a kind and the box left: the kind is All", () => {
      reset({ kind: "performance" });
      type("photo");
      box().blur();
      expect(state.browse.kind).toBe("All");
    });
    it("'kids' typed over a track and the box left: the track is All, and stays All once the word is gone", () => {
      reset({ track: "Puppetry" });
      type("kids");
      box().blur();
      expect(state.browse.track).toBe("All");
      type("");
      box().blur();
      app.browseResults();
      expect(app.activeFilters().track).toBe("All");
    });
    it("a word that holds nothing the sheet sets leaves the sheet alone: 'saturday' over the Westin", () => {
      reset({ hotel: "Westin" });
      type("saturday");
      box().blur();
      expect(state.browse.hotel).toBe("Westin");
    });
    it("the sheet opened straight from typing applies it before the panel draws: nothing left to Clear", () => {
      reset({ hotel: "Hyatt" });
      type("hilton");
      expect(document.activeElement).toBe(box());
      open();
      expect(state.browse.hotel).toBe("All");
      expect(fchip("hotel", "Hilton").getAttribute("aria-pressed")).toBe("true");
      expect(fchip("hotel", "Hyatt").getAttribute("aria-pressed")).toBe("false");
      expect(el("filtersClear").disabled).toBe(true);
      handle.closeSheet();
    });
  });

  describe("a render while the panel is open", () => {
    afterAll(() => reset());

    it("leaves the panel alone: its focus and its scroll stay", () => {
      reset();
      open();
      const chip = fchip("kind", "contest");
      chip.focus();
      el("filtersBody").scrollTop = 40;
      expect(mutationsDuring(panel(), () => handle.render())).toHaveLength(0);
      expect(document.activeElement).toBe(chip);
      expect(el("filtersBody").scrollTop).toBe(40);
    });
  });

  describe("typing is unchanged: the sheet's filters hold under a query", () => {
    afterAll(() => reset());

    it("a query with a sheet filter set ranks inside it", async () => {
      reset({ kind: "performance" });
      typeInto(el("q"), "philharmonic");
      await page.until(() => view().querySelector("mark"), 5000, "the debounced draw");
      const results = app.browseResults();
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(e => tg(e).kind === "performance")).toBe(true);
    });
  });

  describe("#66 and the phone: the rules jsdom cannot show", () => {
    const rule = sel => { const i = css.indexOf(`${sel} {`); expect(i, sel).toBeGreaterThan(-1); return css.slice(i, css.indexOf("}", i)); };

    it("every control in the panel is 44px: the chips, the Type control, the selects, the toggle", () => {
      expect(rule("#panel-filters .chip")).toMatch(/height: 44px/);
      expect(rule("#panel-filters .seg button")).toMatch(/height: 44px/);
      expect(rule("#panel-filters select.track")).toMatch(/height: 44px/);
      expect(rule("#panel-filters .toggle")).toMatch(/min-height: 44px/);
      expect(css).toMatch(/\n\.btn \{[^}]*height: 46px/);
    });
    it("the Filters button is the box's height, 48px", () => {
      expect(rule(".search")).toMatch(/height: 48px/);
      expect(rule(".filters-btn")).toMatch(/height: 48px/);
    });
    it("the row under the box is 44px, its labels cut with an ellipsis", () => {
      expect(rule(".parsed-chips .chip")).toMatch(/height: 44px/);
      expect(rule(".parsed-chips .chip")).toMatch(/max-width: /);
      expect(rule(".chip.parsed .chip-label").match(/text-overflow: \w+/g).pop()).toBe("text-overflow: ellipsis");
      expect(rule(".chip.parsed .chip-label")).toMatch(/overflow: hidden/);
    });
    it("the panel's body scrolls on its own, a drag in it is a scroll, and the chips wrap", () => {
      expect(rule(".filters-body")).toMatch(/overflow-y: auto/);
      expect(rule(".filters-body")).toMatch(/touch-action: pan-y/);
      expect(rule(".filters-body")).toMatch(/max-height: calc\(100dvh - /);
      expect(rule(".filter-chips")).toMatch(/flex-wrap: wrap/);
    });
    it("its selects are 16px, so an iPhone does not zoom on one", () => {
      expect(rule("#sheet input, #sheet textarea, #sheet select")).toMatch(/font-size: 1rem/);
    });
  });
});

describe("the filter sheet on a schedule with no tags", () => {
  let page, handle;
  const el = id => document.getElementById(id);
  const panel = () => el("panel-filters");

  beforeAll(async () => {
    page = await bootPage({ data: untagged });
    ({ handle } = page);
    handle.state.tab = "browse";
    handle.render();
    el("filtersBtn").click();
  }, 30000);
  afterAll(() => page.cleanup());

  it("has no kind chips, no Fandom select and no topic selects", () => {
    expect(panel().querySelector('[data-group="kind"], [data-chip="kind"], #fandom, [data-group="topics"], select[data-filter="medium"]')).toBe(null);
  });
  it("and keeps the hotel chips, the Track select, the Type control and the toggle", () => {
    expect([...panel().querySelectorAll("[data-group]")].map(g => g.dataset.group)).toEqual(["hotel", "pick", "type", "noise"]);
    expect(panel().querySelector(".filter-pair select").id).toBe("track");
  });
  it("'kids' holds a track the schedule lacks: the select shows Kids Track, first, and can be changed", () => {
    handle.closeSheet();
    expect([...el("track").options].some(o => o.value === "Kids Track")).toBe(false);
    handle.state.browse.q = "kids";
    handle.render();
    el("filtersBtn").click();
    const sel = el("track");
    expect(sel.value).toBe("Kids Track");
    expect([...sel.options].map(o => o.value).slice(0, 2)).toEqual(["All", "Kids Track"]);
    expect(sel.disabled).toBe(false);
    sel.value = "All";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    expect(handle.state.browse.q).toBe("");
    expect(handle.state.browse.track).toBe("All");
  });
});
