/* The filter sheet (W13, with W8's topic axes and W7's flags; DECISIONS
   #70, #71, #77; docs/screens/contract.md, section 3, as built): Search's filters in a
   sheet panel, #panel-filters, opened by the Filters button beside the box.
   A tap changes state.browse at once and the panel's count with it, the
   list behind waiting for the sheet to close; the badge counts what the
   sheet set that is in effect, and each is a chip under the box. One value
   per filter, and the last one set wins: a tap in the sheet takes a word
   in the box out of the query, and a word typed takes the sheet's value
   for its dimension to All once the box is left. On a copy of the sample whose untagged events
   carry the four axes at counts that differ, so that each axis's filter and
   the options' order have something to tell apart, and whose every event
   carries what Getting in asks - a fee, a sign-up, sold out, an audience -
   at counts that differ too. New tests, not rows of tests/PORT-LEDGER.md. */
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
/* And an audience each, for Getting in (#77): mature where the listing
   states an age, as the pipeline has it, else kids one in six, mature one in
   ten, and the rest all. Every event takes a fee one in seven, a sign-up one
   in eleven and sold out one in twenty-three. */
const audienceFor = (i, e) => ((e.facets || {}).min_age ? "mature" : i % 6 === 2 ? "kids" : i % 10 === 3 ? "mature" : "all");
const facetsFor = (e, i) => ({ ...e.facets, ...(i % 7 === 0 ? { cost: "extra" } : {}), ...(i % 11 === 0 ? { signup: true } : {}), ...(i % 23 === 0 ? { sold_out: true } : {}) });
const data = { ...sample, events: sample.events
  .map(e => ("tags" in e || e.removed || n >= 150 ? e : { ...e, tags: { ...axesFor(n), audience: audienceFor(n++, e) } }))
  .map((e, i) => ({ ...e, facets: facetsFor(e, i) })) };
/* And a schedule where nothing asks anything: its tagged events alone, each
   for all ages and with no facets. */
const plain = { ...sample, events: sample.events.filter(e => "tags" in e && !e.removed).map(e => ({ ...e, facets: {}, tags: { ...e.tags, audience: "all" } })) };
/* And a schedule with no tags at all: a year's first days, before its first
   tag - and no Kids Track, so that the word "kids" holds a track it lacks. */
const kidsTrack = t => (t === "Kids Track" ? "Family Track" : t);
const untagged = { ...sample, events: sample.events.map(e => {
  const rest = { ...e, tracks: (e.tracks || []).map(kidsTrack), track: kidsTrack(e.track) };
  delete rest.tags;
  return rest;
}) };

const FILTERS = { q: "", day: "All", prevDay: null, hotel: "All", type: "All", track: "All", work: "All", kind: "All",
  medium: "All", genre: "All", craft: "All", subject: "All", cost: "All", signup: "All", audience: "All", soldOut: "All",
  showHidden: false, showPast: false, noToday: false, hideNoise: true, page: 1 };
const THIRTEEN = ["hotel", "kind", "type", "work", "track", "medium", "genre", "craft", "subject", "cost", "signup", "audience", "soldOut"];
/* Getting in's eight values (#77): the select, the filter, the value, the
   option's words and the chip's, and the events it keeps - said here from
   the events, not read back from the app. */
const fc = e => e.facets || {};
const adult = e => (e.tags || {}).audience === "mature" || fc(e).min_age >= 17 || !!fc(e).mature;
const GETTING_IN = [
  ["filterCost", "cost", "no", "No extra fee", e => !fc(e).cost],
  ["filterCost", "cost", "yes", "Extra fee", e => !!fc(e).cost],
  ["filterSignup", "signup", "no", "No sign-up", e => !fc(e).signup],
  ["filterSignup", "signup", "yes", "Sign-up", e => !!fc(e).signup],
  ["filterAudience", "audience", "kids", "Kids", e => (e.tags || {}).audience === "kids"],
  ["filterAudience", "audience", "no-adult", "No 18+", e => !adult(e)],
  ["filterAudience", "audience", "adult", "18+", e => adult(e)],
  ["filterSoldOut", "soldOut", "no", "Not sold out", e => !fc(e).sold_out],
];
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
    it("the groups in order: Hotel, Fandom with Track, Topics, Type, Kind, Getting in, the toggle", () => {
      expect([...panel().querySelectorAll("[data-group]")].map(g => g.dataset.group)).toEqual(["hotel", "pick", "topics", "type", "kind", "entry", "noise"]);
    });
    it("Hotel, Kind and Getting in carry their small labels, which name their groups", () => {
      expect([...panel().querySelectorAll(".filter-label")].map(l => l.textContent)).toEqual(["Hotel", "Kind", "Getting in"]);
      for (const [group, label] of [["hotel", "Hotel"], ["kind", "Kind"], ["entry", "Getting in"]]) {
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
    it("takes every one of the thirteen back to All, and the toggle to Settings' default - not the day, nor the query", () => {
      reset({ q: "trek", day: "2026-09-05", hotel: "Hilton", kind: "panel", type: "panel", work: app.topWorks()[0].id, track: "Puppetry",
        medium: "tv", genre: "horror", craft: "writing", subject: "space", cost: "no", signup: "yes", audience: "kids", soldOut: "no", hideNoise: false });
      open();
      expect(el("filtersClear").disabled).toBe(false);
      const quiet = mutationsDuring(view(), () => el("filtersClear").click());
      expect(quiet).toHaveLength(0);
      expect(THIRTEEN.map(d => state.browse[d])).toEqual(THIRTEEN.map(() => "All"));
      expect(state.browse.hideNoise).toBe(app.settings.hideNoise);
      expect(state.browse).toMatchObject({ q: "trek", day: "2026-09-05" });
    });
    it("and the panel says so in place: the chips, the selects, the toggle, the count, Clear", () => {
      expect(fchip("hotel", "All").getAttribute("aria-pressed")).toBe("true");
      expect(fchip("type", "All").getAttribute("aria-pressed")).toBe("true");
      const selects = ["track", "filterMedium", "filterGenre", "filterCraft", "filterSubject", "filterCost", "filterSignup", "filterAudience", "filterSoldOut"];
      expect(selects.map(id => el(id).value)).toEqual(selects.map(() => "All"));
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
    it("counts all thirteen", () => {
      reset({ hotel: "Hilton", kind: "panel", type: "panel", work: "star-trek", track: "Puppetry", medium: "tv", genre: "horror", craft: "writing", subject: "space",
        cost: "no", signup: "no", audience: "no-adult", soldOut: "no" });
      expect(el("filtersBadge").textContent).toBe("13");
      expect(el("filtersBtn").getAttribute("aria-label")).toBe("Filters, 13 set");
    });
    it.each(GETTING_IN.map(g => [g[3], g[1], g[2]]))("'%s' counts as one", (label, dim, value) => {
      reset({ [dim]: value });
      expect(el("filtersBadge").textContent).toBe("1");
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
      expect(el("filterAudience").value).toBe("no-adult");
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
      expect(app.activeFilters()).toMatchObject({ track: "Kids Track", audience: "no-adult" });
      el("track").focus();
      choose("track", "Puppetry");
      expect(state.browse).toMatchObject({ q: "saturday", track: "Puppetry" });
      expect(app.activeFilters()).toMatchObject({ track: "Puppetry", audience: "All" });
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

  /* Getting in (DECISIONS #77): cost, sign-up, audience and sold out, four
     selects under one label after Kind and before the toggle, each All or
     one value, and set, cleared, counted and shown as every other filter. */
  describe("Getting in: cost, sign-up, audience and sold out", () => {
    beforeAll(() => { reset(); open(); });
    afterAll(() => reset());
    const group = () => panel().querySelector('[data-group="entry"]');
    const quiet = during => expect(mutationsDuring(view(), during)).toHaveLength(0);
    const every = pred => handle.events.filter(pred).length;
    const texts = id => [...el(id).options].map(o => [o.value, o.textContent]);
    const main = () => document.querySelector("main");

    it("one group, after Kind and before the toggle, under its small label, which names it", () => {
      const groups = [...panel().querySelectorAll("[data-group]")];
      expect(groups[groups.indexOf(group()) - 1].dataset.group).toBe("kind");
      expect(groups[groups.indexOf(group()) + 1].dataset.group).toBe("noise");
      expect(group().getAttribute("role")).toBe("group");
      const label = el(group().getAttribute("aria-labelledby"));
      expect([label.textContent, label.className, label.parentElement]).toEqual(["Getting in", "filter-label", group()]);
    });
    it("four selects two by two, in the topic axes' markup and classes, each with its own name", () => {
      const grid = group().querySelector(".filter-topics");
      expect([...grid.children].map(c => [c.tagName, c.className, c.id, c.dataset.filter, c.getAttribute("aria-label")])).toEqual([
        ["SELECT", "track", "filterCost", "cost", "Cost"], ["SELECT", "track", "filterSignup", "signup", "Sign-up"],
        ["SELECT", "track", "filterAudience", "audience", "Audience"], ["SELECT", "track", "filterSoldOut", "soldOut", "Sold out"]]);
      expect(grid.className).toBe(panel().querySelector('[data-group="topics"] > div').className);
      expect([...group().children].map(c => c.tagName)).toEqual(["SPAN", "DIV"]);
    });
    it("Cost: Any cost, No extra fee, Extra fee", () => {
      expect(texts("filterCost")).toEqual([["All", "Any cost"], ["no", "No extra fee"], ["yes", `Extra fee (${every(e => fc(e).cost)})`]]);
    });
    it("Sign-up: Any sign-up, No sign-up, Sign-up", () => {
      expect(texts("filterSignup")).toEqual([["All", "Any sign-up"], ["no", "No sign-up"], ["yes", `Sign-up (${every(e => fc(e).signup)})`]]);
    });
    it("Audience: Any audience, Kids, No 18+, 18+", () => {
      expect(texts("filterAudience")).toEqual([["All", "Any audience"], ["kids", `Kids (${every(e => tg(e).audience === "kids")})`], ["no-adult", "No 18+"], ["adult", `18+ (${every(adult)})`]]);
    });
    it("Sold out: Sold out or not, Not sold out - and no option that keeps only what is sold out", () => {
      expect(texts("filterSoldOut")).toEqual([["All", "Sold out or not"], ["no", "Not sold out"]]);
    });
    it("a count stands only on an option that names something an event has; one that takes things away says no number", () => {
      const options = [...group().querySelectorAll("option")].map(o => o.textContent);
      expect(options.filter(t => /\(\d[\d,]*\)$/.test(t)).map(t => t.replace(/ \(.*$/, ""))).toEqual(["Extra fee", "Sign-up", "Kids", "18+"]);
      expect(options.filter(t => /\d\)$/.test(t) === false)).toEqual(["Any cost", "No extra fee", "Any sign-up", "No sign-up", "Any audience", "No 18+", "Sold out or not", "Not sold out"]);
    });
    it("the count is over every event, the hidden photo sessions among them, and each of the four is its own", () => {
      const counts = [e => !!fc(e).cost, e => !!fc(e).signup, e => tg(e).audience === "kids", adult].map(every);
      expect(new Set(counts).size).toBe(4);
      expect(counts.every(k => k > 0)).toBe(true);
      expect(every(e => !!fc(e).cost)).toBeGreaterThan(counted(e => !!fc(e).cost));
      expect(texts("filterCost")[2][1]).toBe(`Extra fee (${every(e => !!fc(e).cost)})`);
    });
    it("the options that name a flag say the flag's own words", () => {
      expect(app.flagsOf({ facets: { cost: "extra", signup: true }, tags: { audience: "kids" } }).map(f => f.label)).toEqual(["Extra fee", "Sign-up", "Kids"]);
      expect(app.flagsOf({ tags: { audience: "mature" } }).map(f => f.label)).toEqual(["18+"]);
      expect([texts("filterCost")[2][1], texts("filterSignup")[2][1], texts("filterAudience")[1][1], texts("filterAudience")[3][1]].map(t => t.replace(/ \(.*$/, "")))
        .toEqual(["Extra fee", "Sign-up", "Kids", "18+"]);
    });
    it.each(GETTING_IN.map(g => [g[3], g]))("'%s' changes the state and the count at once, nothing behind drawn, and All takes it back", (label, [id, dim, value, , keeps]) => {
      quiet(() => choose(id, value));
      expect(state.browse[dim]).toBe(value);
      expect(el(id).value).toBe(value);
      expect(el(id).options[el(id).selectedIndex].textContent.replace(/ \(.*$/, "")).toBe(label);
      expect(counted(keeps)).toBeGreaterThan(0);
      expect(counted(keeps)).toBeLessThan(counted(() => true));
      expect(says()).toBe(showSays(counted(keeps)));
      expect(el("filtersClear").disabled).toBe(false);
      quiet(() => choose(id, "All"));
      expect(state.browse[dim]).toBe("All");
      expect(says()).toBe(showSays(counted(() => true)));
      expect(el("filtersClear").disabled).toBe(true);
    });
    it("a choice keeps focus on its select", () => {
      el("filterSignup").focus();
      choose("filterSignup", "yes");
      expect(document.activeElement).toBe(el("filterSignup"));
      choose("filterSignup", "All");
    });
    it("the two of a pair are each other's complement over the list", () => {
      const of = (id, value) => { choose(id, value); const k = app.browseResults().length; choose(id, "All"); return k; };
      const whole = counted(() => true);
      expect(of("filterCost", "no") + of("filterCost", "yes")).toBe(whole);
      expect(of("filterSignup", "no") + of("filterSignup", "yes")).toBe(whole);
      expect(of("filterAudience", "no-adult") + of("filterAudience", "adult")).toBe(whole);
    });
    it("every event passes each of the four exactly where its row's flags say so", () => {
      const off = [];
      for (const e of handle.events) {
        const flags = app.flagsOf(e), has = key => flags.some(f => f.key === key), age = (flags.find(f => f.key === "age") || {}).label;
        if (app.passesGettingIn(e, "cost", "yes") !== has("cost")) off.push(["cost", e.id]);
        if (app.passesGettingIn(e, "signup", "yes") !== has("signup")) off.push(["signup", e.id]);
        if (app.passesGettingIn(e, "soldOut", "no") === has("sold_out")) off.push(["soldOut", e.id]);
        if (app.passesGettingIn(e, "audience", "kids") !== has("kids")) off.push(["kids", e.id]);
        if (app.passesGettingIn(e, "audience", "adult") !== (parseInt(age, 10) >= 17)) off.push(["18+", e.id, age]);
      }
      expect(off).toEqual([]);
    });
    it("two together, and three: every one set must hold", () => {
      quiet(() => { choose("filterCost", "no"); choose("filterSoldOut", "no"); });
      expect(says()).toBe(showSays(counted(e => !fc(e).cost && !fc(e).sold_out)));
      quiet(() => choose("filterAudience", "no-adult"));
      expect(says()).toBe(showSays(counted(e => !fc(e).cost && !fc(e).sold_out && !adult(e))));
      choose("filterCost", "yes"); choose("filterSignup", "yes"); choose("filterAudience", "All");
      expect(says()).toBe(showSays(counted(e => fc(e).cost && fc(e).signup && !fc(e).sold_out)));
      ["filterCost", "filterSignup", "filterSoldOut"].forEach(id => choose(id, "All"));
    });
    it("all four set, beside a topic axis", () => {
      choose("filterCost", "no"); choose("filterSignup", "no"); choose("filterAudience", "kids"); choose("filterSoldOut", "no"); choose("filterMedium", "tv");
      const keeps = e => !fc(e).cost && !fc(e).signup && tg(e).audience === "kids" && !fc(e).sold_out && (tg(e).medium || []).includes("tv");
      expect(counted(keeps)).toBeGreaterThan(0);
      expect(says()).toBe(showSays(counted(keeps)));
    });
    it("beside a hotel and a day", () => {
      reset({ day: "2026-09-05", hotel: "Hilton" });
      open();
      const here = e => app.hotelGroup(e.hotel) === "Hilton" && e._cd === "2026-09-05";
      for (const [, [id, , value, , keeps]] of GETTING_IN.map(g => [g[3], g])) {
        choose(id, value);
        expect(says(), `${id} ${value}`).toBe(showSays(counted(e => here(e) && keeps(e))));
        choose(id, "All");
      }
      expect(says()).toBe(showSays(counted(here)));
    });
    it("the sheet closed: the list is the count's, every row an event the filter keeps", () => {
      reset();
      el("filtersBtn").focus();
      open();
      choose("filterCost", "yes");
      const said = says();
      expect(listDraws(() => el("filtersShow").click())).toBe(1);
      expect(said).toBe(showSays(counted(e => !!fc(e).cost)));
      expect(view().querySelector(".section-title .count").textContent).toBe(String(counted(e => !!fc(e).cost)));
      const rows = [...view().querySelectorAll(".row")].map(li => app.byId.get(li.dataset.id));
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every(e => fc(e).cost === "extra")).toBe(true);
      expect(document.activeElement).toBe(el("filtersBtn"));
    });
    it("a change of one is a change, so the list starts from its top; one taken back is none", () => {
      reset();
      main().scrollTop = 300;
      open();
      choose("filterSoldOut", "no");
      el("filtersShow").click();
      expect(main().scrollTop).toBe(0);
      reset();
      main().scrollTop = 300;
      open();
      choose("filterAudience", "adult");
      choose("filterAudience", "All");
      el("filtersShow").click();
      expect(main().scrollTop).toBe(300);
    });
    it("Clear: one of the four alone enables it, and it takes all four back to All", () => {
      reset();
      open();
      expect(el("filtersClear").disabled).toBe(true);
      choose("filterSoldOut", "no");
      expect(el("filtersClear").disabled).toBe(false);
      choose("filterCost", "yes"); choose("filterSignup", "yes"); choose("filterAudience", "kids");
      quiet(() => el("filtersClear").click());
      expect(["cost", "signup", "audience", "soldOut"].map(d => state.browse[d])).toEqual(["All", "All", "All", "All"]);
      expect(["filterCost", "filterSignup", "filterAudience", "filterSoldOut"].map(id => el(id).value)).toEqual(["All", "All", "All", "All"]);
      expect(says()).toBe(showSays(counted(() => true)));
      expect(el("filtersClear").disabled).toBe(true);
    });
    it("each is a chip under the box in the option's own words, after Kind, in the sheet's order", () => {
      reset({ kind: "performance", cost: "no", signup: "yes", audience: "adult", soldOut: "no" });
      expect(el("filtersBadge").textContent).toBe("5");
      expect(chipsUnder().map(c => c.getAttribute("aria-label"))).toEqual(["Remove Performance filter", "Remove No extra fee filter", "Remove Sign-up filter", "Remove 18+ filter", "Remove Not sold out filter"]);
      expect(chipsUnder().map(c => c.querySelector(".chip-label").textContent)).toEqual(["Performance", "No extra fee", "Sign-up", "18+", "Not sold out"]);
      expect(chipsUnder().map(c => [c.dataset.act, c.dataset.dim])).toEqual([["unfilter", "kind"], ["unfilter", "cost"], ["unfilter", "signup"], ["unfilter", "audience"], ["unfilter", "soldOut"]]);
    });
    it.each(GETTING_IN.map(g => [g[3], g[1], g[2]]))("the chip '%s', with no count in it", (label, dim, value) => {
      reset({ [dim]: value });
      expect(chipsUnder().map(c => [c.querySelector(".chip-label").textContent, c.getAttribute("aria-label")])).toEqual([[label, `Remove ${label} filter`]]);
    });
    it("a chip's x takes that one off, and focus goes to the chip in its place, else to the Filters button, never the box", () => {
      reset({ cost: "no", audience: "kids", soldOut: "no" });
      view().querySelector('[data-act="unfilter"][data-dim="cost"]').click();
      expect(state.browse).toMatchObject({ cost: "All", audience: "kids", soldOut: "no" });
      expect(document.activeElement.getAttribute("aria-label")).toBe("Remove Kids filter");
      view().querySelector('[data-act="unfilter"][data-dim="soldOut"]').click();
      expect(state.browse).toMatchObject({ audience: "kids", soldOut: "All" });
      expect(document.activeElement).toBe(el("filtersBtn"));
      view().querySelector('[data-act="unfilter"][data-dim="audience"]').click();
      expect(state.browse.audience).toBe("All");
      expect(view().querySelector(".parsed-chips")).toBe(null);
      expect(document.activeElement).toBe(el("filtersBtn"));
    });
    it("with one of them in effect and nothing found, the empty list says to remove a filter first", () => {
      reset({ q: "zzqxjv", soldOut: "no" });
      expect(view().querySelector(".empty").textContent).toBe("No matches. Remove a filter above, or try another day or fewer words.");
    });
  });

  /* The words already read hold the Audience (#71, #77): "18+" and "adult"
     at 18+; a kids word holds two dimensions, the track and the Audience at
     No 18+, with one chip. A tap on a dimension a word holds takes the word
     out whole. */
  describe("the words that hold the Audience", () => {
    const under = () => chipsUnder().filter(c => c.dataset.act !== "unparse-today").map(c => c.getAttribute("aria-label"));
    const box = () => el("q");
    const type = v => { box().focus(); typeInto(box(), v); };
    const kidsTrack = e => (e.tracks || []).includes("Kids Track");
    afterAll(() => { box().blur(); reset(); });

    it("the schedule has what these ask: Kids Track events that are 18+, and some that are not", () => {
      expect(counted(e => kidsTrack(e) && adult(e))).toBeGreaterThan(0);
      expect(counted(e => kidsTrack(e) && !adult(e))).toBeGreaterThan(0);
    });
    it.each(["18+", "adult"])("'%s' in the box: one chip, the word's, and the badge does not count it; the Audience shows 18+, and can be changed", word => {
      reset({ q: word, noToday: true });
      expect(under()).toEqual(["Remove 18+ filter"]);
      expect(view().querySelector('[data-act="unparse"]').dataset.src).toBe(word);
      expect(el("filtersBadge").hidden).toBe(true);
      open();
      expect(el("filterAudience").value).toBe("adult");
      expect(el("filterAudience").disabled).toBe(false);
      expect(says()).toBe(showSays(counted(adult)));
      expect(el("filtersClear").disabled).toBe(true);
    });
    it("a choice in the Audience over '18+' takes the word out and sets the value chosen; focus stays, nothing behind is drawn", () => {
      reset({ q: "trek 18+" });
      open();
      el("filterAudience").focus();
      expect(mutationsDuring(view(), () => choose("filterAudience", "kids"))).toHaveLength(0);
      expect(state.browse).toMatchObject({ q: "trek", audience: "kids" });
      expect(document.activeElement).toBe(el("filterAudience"));
      expect(el("filterAudience").value).toBe("kids");
      el("filtersShow").click();
      expect(el("q").value).toBe("trek");
      expect(under()).toEqual(["Remove Kids filter"]);
      expect(el("filtersBadge").textContent).toBe("1");
    });
    it("Any audience chosen over 'adult' takes the word out and leaves the Audience at All", () => {
      reset({ q: "adult" });
      open();
      choose("filterAudience", "All");
      expect(state.browse).toMatchObject({ q: "", audience: "All" });
      expect(says()).toBe(showSays(counted(() => true)));
    });
    it("'kids' holds two dimensions: the Track shows Kids Track and the Audience No 18+, under one chip, the track's", () => {
      reset({ q: "kids", noToday: true });
      expect(under()).toEqual(["Remove Kids Track filter"]);
      expect(el("filtersBadge").hidden).toBe(true);
      open();
      expect(el("track").value).toBe("Kids Track");
      expect(el("filterAudience").value).toBe("no-adult");
      expect(says()).toBe(showSays(counted(e => kidsTrack(e) && !adult(e))));
    });
    it("a choice in the Audience over 'kids' takes the word out whole, and the Kids Track with it", () => {
      reset({ q: "kids saturday" });
      open();
      el("filterAudience").focus();
      choose("filterAudience", "kids");
      expect(state.browse).toMatchObject({ q: "saturday", audience: "kids", track: "All" });
      expect(app.activeFilters()).toMatchObject({ track: "All", audience: "kids" });
      expect([el("track").value, el("filterAudience").value]).toEqual(["All", "kids"]);
      expect(document.activeElement).toBe(el("filterAudience"));
      expect(says()).toBe(showSays(counted(e => tg(e).audience === "kids" && e._cd === "2026-09-05")));
    });
    it("Any audience chosen over 'kids' leaves nothing of the word: the track is All too", () => {
      reset({ q: "kids" });
      open();
      choose("filterAudience", "All");
      expect(state.browse).toMatchObject({ q: "", audience: "All", track: "All" });
      expect(says()).toBe(showSays(counted(() => true)));
    });
    it.each(["kid", "family", "children"])("'%s' is held and taken out the same way", word => {
      reset({ q: word });
      open();
      expect([el("track").value, el("filterAudience").value]).toEqual(["Kids Track", "no-adult"]);
      choose("filterAudience", "adult");
      expect(state.browse).toMatchObject({ q: "", audience: "adult", track: "All" });
    });
    it.each(["kids 18+", "18+ kids", "adult kids", "kids adult"])("'%s': the explicit word wins, in either order - the Kids Track at 18+", q => {
      reset({ q, noToday: true });
      expect(under().sort()).toEqual(["Remove 18+ filter", "Remove Kids Track filter"]);
      open();
      expect([el("track").value, el("filterAudience").value]).toEqual(["Kids Track", "adult"]);
      expect(says()).toBe(showSays(counted(e => kidsTrack(e) && adult(e))));
    });
    it.each(["kids 18+", "18+ kids"])("'%s', a choice in the Audience: both words come out, since each holds it", q => {
      reset({ q });
      open();
      choose("filterAudience", "no-adult");
      expect(state.browse).toMatchObject({ q: "", audience: "no-adult", track: "All" });
      expect(app.activeFilters()).toMatchObject({ track: "All", audience: "no-adult" });
    });
    it.each(["kids 18+", "18+ kids"])("'%s', a choice in the Track: 'kids' comes out, and '18+' still holds the Audience", q => {
      reset({ q });
      open();
      choose("track", "Puppetry");
      expect(state.browse).toMatchObject({ q: "18+", track: "Puppetry", audience: "All" });
      expect(el("filterAudience").value).toBe("adult");
      expect(app.activeFilters()).toMatchObject({ track: "Puppetry", audience: "adult" });
    });
    it("Clear leaves the word, and the Audience still shows what it holds", () => {
      reset({ q: "18+", cost: "no" });
      open();
      el("filtersClear").click();
      expect(state.browse).toMatchObject({ q: "18+", cost: "All", audience: "All" });
      expect(el("filterAudience").value).toBe("adult");
    });
    it("while typing the word wins and the sheet's Audience is kept, uncounted; the box left, it goes to All and nothing comes back", () => {
      reset({ audience: "kids" });
      type("18+");
      app.browseResults();
      expect(state.browse.audience).toBe("kids");
      expect(app.activeFilters().audience).toBe("adult");
      expect(app.inEffect()).toEqual([]);
      box().blur();
      expect(state.browse.audience).toBe("All");
      type("");
      box().blur();
      app.browseResults();
      expect(app.activeFilters().audience).toBe("All");
    });
    it("'kids' typed over a track and an audience, and the box left: both go to All", () => {
      reset({ track: "Puppetry", audience: "adult" });
      type("kids");
      box().blur();
      expect(state.browse).toMatchObject({ track: "All", audience: "All" });
    });
    it("the sheet opened straight from typing settles the Audience before the panel draws: nothing left to Clear", () => {
      reset({ audience: "kids" });
      type("adult");
      expect(document.activeElement).toBe(box());
      open();
      expect(state.browse.audience).toBe("All");
      expect(el("filterAudience").value).toBe("adult");
      expect(el("filtersClear").disabled).toBe(true);
      handle.closeSheet();
    });
    it("no new word is read: 'free', 'sold out' and 'sign-up' hold nothing, and leave the sheet's four alone", () => {
      reset({ cost: "no", signup: "yes", audience: "kids", soldOut: "no" });
      type("free sold out sign-up hilton");
      box().blur();
      expect(app.parseQuery("free sold out sign-up").filters).toEqual({});
      expect(state.browse).toMatchObject({ cost: "no", signup: "yes", audience: "kids", soldOut: "no" });
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
    it("Getting in brings no rule of its own: its label is the small label's, its grid the topics', its selects the panel's", () => {
      expect(css).not.toMatch(/entry|filterCost|filterSignup|filterAudience|filterSoldOut|getting/i);
      expect(rule(".filter-label")).toMatch(/text-transform: uppercase/);
      expect(rule(".filter-topics")).toMatch(/grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
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
  it("and keeps the hotel chips, the Track select, the Type control, Getting in and the toggle", () => {
    expect([...panel().querySelectorAll("[data-group]")].map(g => g.dataset.group)).toEqual(["hotel", "pick", "type", "entry", "noise"]);
    expect(panel().querySelector(".filter-pair select").id).toBe("track");
  });
  it("Getting in is Cost, Sign-up and Sold out there, and no Audience: the fourth cell is empty", () => {
    expect([...panel().querySelectorAll('[data-group="entry"] .filter-topics > *')].map(c => c.getAttribute("aria-label"))).toEqual(["Cost", "Sign-up", "Sold out"]);
    expect(el("filterAudience")).toBe(null);
    expect(panel().querySelector('[data-filter="audience"]')).toBe(null);
  });
  it("an option is there at 0: the sample has no fee and no sign-up", () => {
    const texts = id => [...el(id).options].map(o => o.textContent);
    expect(texts("filterCost")).toEqual(["Any cost", "No extra fee", "Extra fee (0)"]);
    expect(texts("filterSignup")).toEqual(["Any sign-up", "No sign-up", "Sign-up (0)"]);
    expect(texts("filterSoldOut")).toEqual(["Sold out or not", "Not sold out"]);
  });
  it("and chosen, it keeps none: 'No events match'", () => {
    const pick = (id, value) => { el(id).value = value; el(id).dispatchEvent(new Event("change", { bubbles: true })); };
    pick("filterCost", "yes");
    expect(handle.state.browse.cost).toBe("yes");
    expect(el("filtersShow").textContent).toBe("No events match");
    pick("filterCost", "All");
    expect(el("filtersShow").textContent).toMatch(/^Show \d+ events$/);
  });
  it("'18+' asks no tags: the word finds the events whose listings state 18, with no select to show it", () => {
    const stated = handle.events.filter(e => (e.facets || {}).min_age >= 17 && !noise(e));
    expect(stated.length).toBeGreaterThan(0);
    handle.closeSheet();
    Object.assign(handle.state.browse, { q: "18+", day: "All", noToday: true });
    handle.render();
    expect(page.app.browseResults().map(e => e.id).sort()).toEqual(stated.map(e => e.id).sort());
    expect([...document.querySelectorAll("#view-browse .parsed-chips .chip")].map(c => c.getAttribute("aria-label"))).toEqual(["Remove 18+ filter"]);
    Object.assign(handle.state.browse, { q: "", noToday: false });
    handle.render();
    el("filtersBtn").click();
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

describe("Getting in on a schedule where no event has what its options name", () => {
  let page, handle;
  const el = id => document.getElementById(id);
  const texts = id => [...el(id).options].map(o => o.textContent);

  beforeAll(async () => {
    page = await bootPage({ data: plain });
    ({ handle } = page);
    handle.state.tab = "browse";
    Object.assign(handle.state.browse, { day: "All" });
    handle.render();
    el("filtersBtn").click();
  }, 30000);
  afterAll(() => page.cleanup());

  it("the options are fixed lists: each is there, at 0", () => {
    expect(handle.events.length).toBeGreaterThan(0);
    expect(texts("filterCost")).toEqual(["Any cost", "No extra fee", "Extra fee (0)"]);
    expect(texts("filterSignup")).toEqual(["Any sign-up", "No sign-up", "Sign-up (0)"]);
    expect(texts("filterAudience")).toEqual(["Any audience", "Kids (0)", "No 18+", "18+ (0)"]);
    expect(texts("filterSoldOut")).toEqual(["Sold out or not", "Not sold out"]);
  });
  it("so a word's value always has its option: '18+' in the box, the Audience shows 18+ and nothing matches", () => {
    handle.closeSheet();
    Object.assign(handle.state.browse, { q: "18+", noToday: true });
    handle.render();
    el("filtersBtn").click();
    expect(el("filterAudience").value).toBe("adult");
    expect(el("filterAudience").options[el("filterAudience").selectedIndex].textContent).toBe("18+ (0)");
    expect(el("filtersShow").textContent).toBe("No events match");
  });
  it("and 'kids' shows No 18+, which keeps every event of a track it holds", () => {
    handle.closeSheet();
    Object.assign(handle.state.browse, { q: "kids", noToday: true });
    handle.render();
    el("filtersBtn").click();
    expect(el("filterAudience").value).toBe("no-adult");
    expect(el("track").value).toBe("Kids Track");
  });
});

/* The Mart is two venues and one group (DECISIONS #91): one chip, "Mart", in
   the Mart's colour, for both buildings; and while Search's hotel is one
   building - its hotel sheet's Search sets that - the Hotel row has a chip
   for that building too. New tests, not rows of tests/PORT-LEDGER.md. */
describe("the Mart in the filters: one chip for its two buildings, and a building's own while Search holds it", () => {
  const B3 = "AmericasMart Building 3", B2 = "AmericasMart Building 2", HUE = "--h:var(--h-Mart)";
  let page, app, handle, state;
  const el = id => document.getElementById(id);
  const panel = () => el("panel-filters");
  const open = () => el("filtersBtn").click();
  const fchip = (kind, value) => panel().querySelector(`[data-chip="${kind}"][data-value="${value}"]`);
  const row = () => [...panel().querySelectorAll('[data-chip="hotel"]')];
  const pressed = () => row().filter(c => c.getAttribute("aria-pressed") === "true").map(c => c.dataset.value);
  const reset = (over = {}) => { if (!el("sheetWrap").hidden) handle.closeSheet(); state.tab = "browse"; Object.assign(state.browse, FILTERS, over); handle.render(); };
  const inMart = e => e.hotel === B3 || e.hotel === B2;
  const under = () => [...el("view-browse").querySelectorAll(".parsed-chips .chip-label")].map(c => c.textContent);

  beforeAll(async () => {
    page = await bootPage({ data: sample });
    ({ app, handle } = page);
    state = handle.state;
    await page.until(() => app.BOOT.indexed > 0, 20000, "the index");
    reset();
  }, 30000);
  afterAll(() => page.cleanup());

  it("one Mart chip, labelled Mart, in the Mart's colour - in the sheet and on Now - and none for a building", () => {
    expect(app.hotelChips.filter(h => /Mart/.test(h))).toEqual(["Mart"]);
    expect(css).toMatch(/\n\s*--h-Mart: #/);
    open();
    expect([fchip("hotel", "Mart").textContent, fchip("hotel", "Mart").getAttribute("style")]).toEqual(["Mart", HUE]);
    expect([fchip("hotel", B3), fchip("hotel", B2)]).toEqual([null, null]);
    handle.closeSheet();
    state.tab = "now"; handle.render();
    const onNow = [...document.querySelectorAll('#view-now [data-chip="now-hotel"]')].filter(c => /Mart/.test(c.dataset.value));
    expect(onNow.map(c => [c.dataset.value, c.textContent, c.getAttribute("style")])).toEqual([["Mart", "Mart", HUE]]);
  });
  it("the Mart chip keeps both buildings' events, and so does the word mart, whose chip says Mart", () => {
    const both = handle.events.filter(e => inMart(e) && !noise(e)).length;
    expect(new Set(handle.events.filter(inMart).map(e => e.hotel))).toEqual(new Set([B3, B2]));
    reset({ hotel: "Mart" });
    expect([app.browseResults().length, app.browseResults().every(inMart), under()]).toEqual([both, true, ["Mart"]]);
    for (const word of ["mart", "americasmart"]) {
      reset({ q: word, noToday: true });
      expect([app.browseResults().length, app.browseResults().every(inMart), under()], word).toEqual([both, true, ["Mart"]]);
    }
  });
  it("Search's hotel one building: the Hotel row gains that building's chip, Mart 2, pressed, straight after the Mart chip", () => {
    reset({ hotel: B2 });
    expect([under(), el("filtersBtn").getAttribute("aria-label")]).toEqual([["Mart 2"], "Filters, 1 set"]);
    open();
    const groups = app.hotelChips, at = groups.indexOf("Mart");
    expect(row().map(c => c.dataset.value)).toEqual(["All", ...groups.slice(0, at + 1), B2, ...groups.slice(at + 1)]);
    expect(pressed()).toEqual([B2]);
    expect([fchip("hotel", B2).textContent, fchip("hotel", B2).getAttribute("style")]).toEqual(["Mart 2", HUE]);
    expect(el("filtersShow").textContent).toBe(showSays(handle.events.filter(e => e.hotel === B2 && !noise(e)).length));
  });
  it("a second tap on it is All, by the row's rule - the chip still under the tap - and a third sets the building again", () => {
    const chip = fchip("hotel", B2);
    chip.click();
    expect([state.browse.hotel, pressed(), fchip("hotel", B2) === chip]).toEqual(["All", ["All"], true]);
    chip.click();
    expect([state.browse.hotel, pressed()]).toEqual([B2, [B2]]);
  });
  it("it goes when another value is set: unpressed at that tap, no chip moving under it, and gone from the row when the sheet is next drawn", () => {
    const before = row().map(c => c.dataset.value);
    fchip("hotel", "Mart").click();
    expect([state.browse.hotel, pressed(), row().map(c => c.dataset.value)]).toEqual(["Mart", ["Mart"], before]);
    el("filtersShow").click();
    expect(under()).toEqual(["Mart"]);
    open();
    expect(row().map(c => c.dataset.value)).toEqual(["All", ...app.hotelChips]);
    expect(pressed()).toEqual(["Mart"]);
    reset();
  });
  it("a group's own value, and All, add no chip", () => {
    for (const hotel of ["All", "Hilton", "Mart", "Other"]) {
      reset({ hotel });
      open();
      expect(row().map(c => c.dataset.value), hotel).toEqual(["All", ...app.hotelChips]);
    }
    reset();
  });
});
