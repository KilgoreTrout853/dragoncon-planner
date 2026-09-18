/* The Search tab (its id is still "browse"): filters, query intent, suggestions,
   ranking on the sample fixture, the debounce, and the box that is never
   rebuilt. The number in brackets is the harness line the assertion came from
   (tests/PORT-LEDGER.md). Ranking against the real schedule is
   tests/real-data.test.js. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bootPage } from "../helpers/page.js";
import { mutationsDuring, typeInto } from "../helpers/act.js";

const fixture = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sample-events.json"), "utf8"));
const VENUES = [...new Set(fixture.events.map(e => e.hotel))];
const FILTERS = { q: "", day: "All", prevDay: null, hotel: "All", type: "All", track: "All", fandom: "All", kind: "All", showHidden: false, showPast: false, noToday: false, hideNoise: false, page: 1 };

describe("Search", () => {
  let page, app, handle, state;
  const el = id => document.getElementById(id);
  const view = () => el("view-browse");
  const box = () => el("q");
  const tab = name => document.querySelector(`.nav button[data-tab="${name}"]`).click();
  const chip = (kind, value) => document.querySelector(`#view-browse [data-chip="${kind}"][data-value="${value}"]`);
  const reset = (over = {}) => { state.tab = "browse"; Object.assign(state.browse, FILTERS, over); handle.render(); };
  const search = (q, over = {}) => { reset({ q, ...over }); return app.browseResults(); };
  const drawn = () => page.until(() => !view().querySelector(".indexing-note") && view().querySelector(".row"), 5000, "the debounced draw");

  beforeAll(async () => {
    page = await bootPage();
    ({ app, handle } = page);
    state = handle.state;
    await page.until(() => app.BOOT.suggested > 0, 20000, "the search index");
  }, 30000);
  afterAll(() => page.cleanup());

  describe("search, the All days chip and a hotel chip", () => {
    beforeAll(() => tab("browse"));

    it("search filters to matches [268]", () => {
      typeInto(box(), "boroughs");
      const results = app.browseResults();
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThan(100);
      results.forEach(e => expect(e.title + " " + e.description).toMatch(/boroughs/i));
    });
    it("All days + query shows per-row day labels [271]", () => {
      chip("day", "All").click();
      expect(view().querySelectorAll(".t .day").length).toBeGreaterThan(1);
    });
    it("search cleared [274]", () => {
      typeInto(box(), "");
      expect(state.browse.q).toBe("");
    });
    it("hotel chip sets the filter [276]", async () => {
      await drawn();
      chip("hotel", "Westin").click();
      expect(state.browse.hotel).toBe("Westin");
    });
    it("hotel filter applies [277]", () => {
      [...view().querySelectorAll(".room")].forEach(r => expect(r.textContent).not.toMatch(/Marriott|Hilton|Hyatt/));
    });
  });

  describe("step 1: query intent parsing", () => {
    const P = q => { const p = app.parseQuery(q); return { residual: p.residual, filters: p.filters, chips: p.chips.map(c => c.label) }; };

    it('"star trek saturday hilton" searches only "star trek" [290]', () => {
      expect(P("star trek saturday hilton").residual).toBe("star trek");
    });
    it("day and hotel pulled out of the query [291]", () => {
      expect(P("star trek saturday hilton").filters).toMatchObject({ day: "2026-09-05", hotel: "Hilton" });
    });
    it("chips name what was taken [292]", () => {
      expect(P("star trek saturday hilton").chips).toEqual(["Saturday", "Hilton"]);
    });
    it("signing sunday is all filters [294]", () => {
      expect(P("signing sunday")).toMatchObject({ residual: "", filters: { kind: "signing", day: "2026-09-06" } });
    });
    it("tonight means today, evening [296]", () => {
      expect(P("tonight").filters).toMatchObject({ day: app.conDayKey(handle.now()), time: "evening" });
    });
    it("late night party is time + kind [298]", () => {
      expect(P("late night party")).toMatchObject({ residual: "", filters: { time: "late night", kind: "party" } });
    });
    it("bare 'gaming' filters by kind [300]", () => {
      expect(P("gaming").filters.kind).toBe("gaming");
    });
    it("'marriott gaming' filters by kind [301]", () => {
      expect(P("marriott gaming").filters.kind).toBe("gaming");
    });
    it("'board game night' keeps 'game' as a search word [303]", () => {
      expect(P("board game night").filters.kind).toBeUndefined();
    });
    it("the reverted word stays in place [304]", () => {
      expect(P("board game night").residual).toBe("board game night");
    });

    describe("an all-filter query returns the filtered set in time order", () => {
      /* the fixture has no Sunday signings, so use a pair it does have */
      let results;
      beforeAll(() => { results = search("concert saturday"); });

      it('"concert saturday" returns results [310]', () => {
        expect(results.length).toBeGreaterThan(0);
      });
      it("every result is a Saturday performance [311]", () => {
        results.forEach(e => { expect(e._cd).toBe("2026-09-05"); expect(e.tags && e.tags.kind).toBe("performance"); });
      });
      it("an all-filter query highlights nothing (no search terms) [312]", () => {
        expect(view().querySelector("mark")).toBe(null);
      });
      it("an all-filter query comes back in time order [314]", () => {
        const times = results.map(e => +new Date(e.start));
        expect(times).toEqual([...times].sort((a, b) => a - b));
      });
      it("two parsed chips render [317]", () => {
        expect(view().querySelectorAll(".chip.parsed")).toHaveLength(2);
      });
      it("removing a chip strips that word from the query [319]", () => {
        [...view().querySelectorAll(".chip.parsed")].find(c => /Saturday/.test(c.textContent)).click();
        expect(state.browse.q).not.toMatch(/saturday/i);
      });
      it("the rest of the query survives [320]", () => {
        expect(state.browse.q).toBe("concert");
      });
    });

    it("a parsed day overrides the day chip [323]", () => {
      reset({ day: "2026-09-04", q: "saturday" });
      expect(app.activeFilters().day).toBe("2026-09-05");
    });
    it("the chip takes over again once the word is gone [325]", () => {
      reset({ day: "2026-09-05", q: "" });
      expect(app.activeFilters().day).toBe("2026-09-05");
    });
  });

  describe("step 2: suggestions as you type", () => {
    const SG = q => { state.browse.q = q; const s = app.suggestionsFor(q); return { people: s.people.map(p => p.name), topics: s.topics.map(t => t.name), counts: s.people.map(p => p.count) }; };
    beforeAll(() => reset());
    afterAll(() => reset());

    it("one character suggests nothing [335]", () => {
      expect(SG("a")).toMatchObject({ people: [], topics: [] });
    });
    it("two characters start suggesting [337]", () => {
      const two = SG("ke");
      expect(two.people.length + two.topics.length).toBeGreaterThan(0);
    });
    it('"ka" suggests people [339, and 331, 332]', () => {
      expect(SG("ka").people.length).toBeGreaterThan(0);
    });
    it("at most five chips per row [340]", () => {
      expect(SG("ka").people.length).toBeLessThanOrEqual(5);
      expect(SG("ka").topics.length).toBeLessThanOrEqual(5);
    });
    it("people ranked by how many events match [341]", () => {
      const counts = SG("ka").counts;
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
    });
    it("suggestions are whole names, not fragments [342]", () => {
      SG("ka").people.forEach(name => expect(name.includes(" ") || /^[A-Z]/.test(name)).toBe(true));
    });
    it("topics are suggested too [344, and 333]", () => {
      expect(SG("rick").topics).toContain("Rick and Morty");
    });
    it("suggestion rows are labelled [348]", () => {
      reset({ q: "ka" });
      const labels = [...view().querySelectorAll(".suggest-label")].map(l => l.textContent.trim());
      expect(labels.some(l => /People/i.test(l) || /Fandoms/i.test(l))).toBe(true);
    });

    describe("tapping a chip searches that name exactly", () => {
      let target, exact;
      beforeAll(() => {
        reset({ q: "ka" });
        target = app.suggestionsFor("ka").people[0].name;
        view().querySelector(`[data-act="suggest"][data-name="${target}"]`).click();
        exact = app.browseResults();
      });

      it("tapping quotes the name [352]", () => {
        expect(state.browse.q).toBe(`"${target}"`);
      });
      it("the exact-phrase search returns results [354]", () => {
        expect(exact.length).toBeGreaterThan(0);
      });
      it("every result actually mentions the name [355]", () => {
        exact.forEach(e => expect(JSON.stringify([e.title, (e.tags || {}).fandoms, (e.tags || {}).topics, (e.speakers || []).map(p => p.name)]).toLowerCase()).toContain(target.toLowerCase()));
      });
      it("the chosen name shows as an active chip [358]", () => {
        expect(view().querySelector(".chip.suggest.on")).toBeTruthy();
      });
      it("the suggestion rows are hidden once a name is chosen [359]", () => {
        expect(view().querySelector('[data-act="suggest"]')).toBe(null);
      });
      it("clearing the active chip empties the query [361]", () => {
        view().querySelector('[data-act="unsuggest"]').click();
        expect(state.browse.q).toBe("");
      });
    });

    it.skip("the chip count drops when photo sessions are hidden: the sample fixture has no person whose suggestion count differs with photo sessions hidden (the harness's `if` was never true) [366]", () => {});
  });

  describe("step 3: the celebrity marker; the chip that filtered on it is gone", () => {
    beforeAll(() => reset());
    afterAll(() => { handle.closeSheet(); reset(); });

    it("the fixture has celebrity events [373]", () => {
      expect(handle.events.filter(app.isCeleb).length).toBeGreaterThan(0);
    });
    it("there is no Celebrity chip in the kind row [374]", () => {
      expect(view().querySelector('[data-chip="celebrity"]')).toBe(null);
    });
    it("the kind row lights exactly one chip [376]", () => {
      expect(view().querySelectorAll('.chips[data-row="kind"] [aria-pressed="true"]')).toHaveLength(1);
    });
    it("rows carry a celebrity marker [380]", () => {
      reset({ q: "NASA" });
      expect(view().querySelectorAll(".row .celeb").length).toBeGreaterThan(0);
    });
    it("the marker says what it means [381]", () => {
      view().querySelectorAll(".row .celeb").forEach(m => expect(m.textContent).toMatch(/celebrity/i));
    });
    it("only celebrity rows are marked [383]", () => {
      [...view().querySelectorAll(".row")].filter(r => r.querySelector(".celeb")).forEach(r => expect(app.isCeleb(handle.events.find(e => e.id === r.dataset.id))).toBe(true));
    });
    it("the detail sheet marks a celebrity event [388]", () => {
      handle.openSheet("event", handle.events.filter(app.isCeleb)[0].id);
      expect(document.querySelector("#panel-event .celeb")).toBeTruthy();
    });
    it("and does not mark a non-celebrity one [392]", () => {
      const plain = handle.events.find(e => e.tags && e.tags.guests !== "celebrity");
      expect(plain).toBeTruthy();
      handle.openSheet("event", plain.id);
      expect(document.querySelector("#panel-event .celeb")).toBe(null);
    });
  });

  describe("the venue chips", () => {
    let values, other;
    beforeAll(() => { reset({ hotel: "Westin" }); });
    afterAll(() => reset());

    it("tapping the same chip again clears the filter [400]", () => {
      chip("hotel", "Westin").click();
      expect(state.browse.hotel).toBe("All");
      values = [...view().querySelectorAll("[data-chip='hotel']")].map(c => c.dataset.value);
    });
    /* `hotels` is the app's own list; the venues here come from the fixture itself */
    it.each(VENUES)("every venue has a chip: %s [404]", venue => {
      expect(values).toContain(app.hotelGroup(venue));
    });
    it("one Other chip and no Streaming chip [405]", () => {
      expect(values).not.toContain("Streaming");
      expect(values.filter(v => v === "Other")).toHaveLength(1);
    });
    it("tapping Other shows streams and offsite venues together [410]", () => {
      chip("hotel", "Other").click();
      other = app.browseResults();
      expect(state.browse.hotel).toBe("Other");
      expect(other.length).toBeGreaterThan(0);
      other.forEach(e => expect(["Streaming", "Other"]).toContain(e.hotel));
    });
    it("streams are in it [412]", () => {
      expect(other.some(e => e.hotel === "Streaming")).toBe(true);
    });
    it("and so are the offsite venues, when the data has any [413]", () => {
      expect(!handle.events.some(e => e.hotel === "Other" && !app.isNoise(e)) || other.some(e => e.hotel === "Other")).toBe(true);
    });
    it("the Other chip reads as pressed [414]", () => {
      expect(chip("hotel", "Other").getAttribute("aria-pressed")).toBe("true");
    });
    it("the Now tab's venue row is the same set [416]", () => {
      state.tab = "now"; handle.render();
      const now = [...document.querySelectorAll('#view-now [data-chip="now-hotel"]')].map(c => c.dataset.value);
      state.tab = "browse"; handle.render();
      expect(now).not.toContain("Streaming");
      expect(now.filter(v => v === "Other")).toHaveLength(1);
      expect(now).toHaveLength(values.length);
    });
    it("tapping Other again clears it [418]", () => {
      chip("hotel", "Other").click();
      expect(state.browse.hotel).toBe("All");
    });
    it("photo sessions hidden by default [419]", () => {
      reset({ hideNoise: true, day: "2026-09-05" });
      expect([...view().querySelectorAll(".track")].some(t => t.textContent === "Epic Photos")).toBe(false);
    });
    it("photo sessions appear when toggle off [423]", () => {
      const before = app.browseResults().length;
      el("hideNoise").click();
      expect(app.browseResults().length).toBeGreaterThan(before);
      expect(app.browseResults().some(e => e.track === "Epic Photos")).toBe(true);
    });
  });

  describe("search quality: the real queries, on the sample fixture", () => {
    const top = query => { typeInto(box(), query); return app.browseResults().slice(0, 3).map(e => e.title); };
    beforeAll(() => { reset({ day: "2026-09-05", hideNoise: true }); });
    afterAll(() => reset());

    it("ranking: 'Video game costume contest' [516]", () => {
      expect(top("Video game costume contest")[0]).toMatch(/Video Game Cosplay Contest/);
    });
    it("typing widens to all days [517]", () => {
      expect(state.browse.day).toBe("All");
    });
    it("synonyms+stopwords: 'nerdy space stuff' [518]", () => {
      expect(top("nerdy space stuff")[0]).toMatch(/NASA/);
    });
    it("vocabulary: 'Symphony show' [519]", () => {
      expect(top("Symphony show")[0]).toMatch(/Philharmonic/);
    });
    it("'&' vs 'and': 'Rick and Morty' [520]", () => {
      expect(top("Rick and Morty")[0]).toMatch(/Rick & Morty/);
    });
    it("typo tolerance: 'philharmonc' [521]", () => {
      expect(top("philharmonc")[0]).toMatch(/Philharmonic/);
    });
    it("matches are highlighted [522]", async () => {
      await page.until(() => view().querySelector("mark"), 5000, "the debounced draw");
    });
    it("day label shown in relevance mode [523]", () => {
      expect(view().querySelector(".t .day")).toBeTruthy();
    });
    it("fandom select and kind chips render when tags exist [525]", () => {
      expect(el("fandom")).toBeTruthy();
      expect(document.querySelector('[data-chip="kind"]')).toBeTruthy();
    });
    it("clearing the query restores the day [526]", () => {
      top("");
      expect(state.browse.day).not.toBe("All");
    });

    describe("18+ and kinds", () => {
      let everything;
      beforeAll(async () => { await drawn(); chip("day", "All").click(); everything = app.browseResults().length; });

      it("there is no Hide 18+ toggle any more [529]", () => {
        expect(el("hideAdult")).toBe(null);
      });
      it("but the word kids still keeps 18+ out [531]", () => {
        state.browse.q = "kids"; state.browse.page = 1; app.renderBrowse();
        expect(app.browseResults().length).toBeGreaterThan(0);
        expect(app.browseResults().some(e => e.tags && e.tags.adult)).toBe(false);
      });
      it("and with it cleared everything is back [533]", () => {
        state.browse.q = ""; state.browse.day = "All"; state.browse.page = 1; app.renderBrowse();
        expect(app.browseResults()).toHaveLength(everything);
      });
      it("kind chip filters [535]", () => {
        chip("kind", "contest").click();
        expect(app.browseResults().every(e => e.tags.kind === "contest")).toBe(true);
      });
    });
  });

  /* The harness counted calls to a replaced renderBrowse and read the internal
     browseRenderTimer. Here a draw is what it is on the page - something under
     the tab changing - and the debounce is the app's own timer, on a faked clock. */
  describe("render cost: typing is debounced", () => {
    beforeAll(() => { reset(); vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }); });
    afterAll(() => { vi.useRealTimers(); reset(); });
    const type = text => { for (let i = 1; i <= text.length; i++) typeInto(box(), text.slice(0, i)); };

    it("typing eight characters draws nothing while you type [559]", () => {
      expect(mutationsDuring(view(), () => type("boroughs"))).toHaveLength(0);
    });
    it("the query itself was recorded immediately [565]", () => {
      expect(state.browse.q).toBe("boroughs");
    });
    it("the queued render eventually fires, and draws once you stop [563, and 564]", () => {
      expect(mutationsDuring(view(), () => vi.advanceTimersByTime(app.SEARCH_DEBOUNCE_MS - 1))).toHaveLength(0);
      expect(mutationsDuring(view(), () => vi.advanceTimersByTime(1)).length).toBeGreaterThan(0);
      expect(view().querySelectorAll(".row").length).toBeGreaterThan(0);
    });
    it("a render is pending after a keystroke: the keystroke alone draws nothing [569]", () => {
      expect(mutationsDuring(view(), () => typeInto(box(), "party"))).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(1);
    });
    it("and a direct render cancels it: it draws once, and the debounce then has nothing left to draw [571]", () => {
      expect(mutationsDuring(view(), () => handle.render()).length).toBeGreaterThan(0);
      expect(vi.getTimerCount()).toBe(0);
      expect(mutationsDuring(view(), () => vi.advanceTimersByTime(app.SEARCH_DEBOUNCE_MS * 3))).toHaveLength(0);
    });
    it("nine keystrokes draw once, after the last [1860]", () => {
      typeInto(box(), ""); vi.advanceTimersByTime(app.SEARCH_DEBOUNCE_MS);
      expect(mutationsDuring(view(), () => type("star trek"))).toHaveLength(0);
      const draws = mutationsDuring(view(), () => vi.advanceTimersByTime(app.SEARCH_DEBOUNCE_MS)).filter(r => r.type === "childList" && r.target.id === "browseRest");
      expect(draws).toHaveLength(1);                          // one innerHTML assignment, one record
    });
  });

  describe("chip rows keep their place across renders, and a tapped chip is brought into view", () => {
    beforeAll(() => reset());
    afterAll(() => reset());

    describe("a render rebuilds the row and puts it back", () => {
      let row, after;
      beforeAll(() => { row = view().querySelector('.chips[data-row="hotel"]'); row.scrollLeft = 120; handle.render(); after = view().querySelector('.chips[data-row="hotel"]'); });

      it("the Search chip rows are named [805]", () => {
        expect([...view().querySelectorAll(".chips[data-row]")].map(r => r.dataset.row).join(",")).toBe("day,hotel,kind");
      });
      it("a render rebuilds the row [806]", () => {
        expect(after).not.toBe(row);
      });
      it("and puts it back where it was [807]", () => {
        expect(after.scrollLeft).toBe(120);
      });
    });

    /* the harness looked for the three data-row names in the source */
    it("the Now, Explore and Following rows are named too [808]", () => {
      handle.follows.set([{ kind: "track", key: handle.events[0].tracks[0] }]);
      const rowsOn = name => { state.tab = name; state.explore.page = null; handle.render(); return [...document.querySelectorAll(`#view-${name} .chips[data-row]`)].map(r => r.dataset.row); };
      expect(rowsOn("now")).toContain("now-hotel");
      expect(rowsOn("explore")).toEqual(expect.arrayContaining(["explore-jump", "follows"]));
      handle.follows.set([]); reset();
    });

    /* The harness replaced revealChip with a recorder. What revealChip does is
       scroll the chip's own row: a render makes new nodes, so every row and
       chip is given a rect that puts the chip off the edge, and every element
       a scrollTo that says who was scrolled. */
    describe("a tapped chip is brought into view", () => {
      const calls = [];
      const had = Element.prototype.getBoundingClientRect;
      let mainTop;
      beforeAll(() => {
        Element.prototype.getBoundingClientRect = function () { return this.matches("[data-chip]") ? { left: 400, right: 480, top: 0, bottom: 40 } : { left: 0, right: 300, top: 0, bottom: 40 }; };
        Element.prototype.scrollTo = function (options) { calls.push({ on: this, options }); };
        mainTop = document.querySelector("main").scrollTop;
        chip("hotel", "Hilton").click();
      });
      afterAll(() => { Element.prototype.getBoundingClientRect = had; delete Element.prototype.scrollTo; });

      it("tapping a hotel chip brings that chip into view [813]", () => {
        expect(calls).toHaveLength(1);
        expect(calls[0].on).toBe(view().querySelector('.chips[data-row="hotel"]'));
        expect(calls[0].options.left).toBeGreaterThan(0);
      });
      it("and it shows pressed [814]", () => {
        expect(chip("hotel", "Hilton").getAttribute("aria-pressed")).toBe("true");
      });
      it("revealChip only moves the row sideways, never the page [820]", () => {
        expect(calls.some(c => c.on === document.querySelector("main"))).toBe(false);
        expect(calls[0].options.top).toBeUndefined();
        expect(document.querySelector("main").scrollTop).toBe(mainTop);
      });
    });
  });

  describe("the search box is never rebuilt under the keyboard", () => {
    let q;
    beforeAll(() => { reset({ day: "2026-09-05" }); q = box(); });
    afterAll(() => reset());

    it("the keyboard's return key reads Search [876]", () => {
      expect(q.getAttribute("enterkeyhint")).toBe("search");
    });
    it("typing redraws the results but keeps the same input element [879]", async () => {
      typeInto(q, "trek");
      await page.until(() => view().querySelector("mark"), 5000, "the debounced draw");
      expect(box()).toBe(q);
    });
    it("and the results did redraw [880]", () => {
      expect(view().querySelectorAll(".row").length).toBeGreaterThan(0);
    });
    it("a full render keeps it too [882]", () => {
      handle.render();
      expect(box()).toBe(q);
    });
    it("while the day chips did update, to All days for a query [883]", () => {
      expect(document.querySelector('#dayChips [data-chip="day"][data-value="All"]').getAttribute("aria-pressed")).toBe("true");
    });
    it("a query set by a chip shows in the same box [885]", () => {
      state.browse.q = '"Trek Track"'; app.renderBrowse();
      expect(box()).toBe(q);
      expect(q.value).toBe('"Trek Track"');
    });
    it("Enter puts the keyboard away by blurring the box [888]", () => {
      q.focus();
      expect(document.activeElement).toBe(q);
      q.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      expect(document.activeElement).not.toBe(q);
    });
    it("and clearing the query clears the box [890]", () => {
      state.browse.q = ""; state.browse.day = null; state.browse.page = 1; handle.render();
      expect(box().value).toBe("");
    });
  });

  describe("browse header: All first, and the key rows stay put", () => {
    let days, sticky;
    beforeAll(() => { reset(); tab("browse"); days = [...view().querySelectorAll('[data-chip="day"]')].map(c => c.dataset.value); sticky = view().querySelector(".controls-sticky"); });

    it('"All days" leads the day row [1251]', () => {
      expect(days[0]).toBe("All");
    });
    it("the hotel row still leads with All, so the two rows match [1253]", () => {
      expect(view().querySelector('[data-chip="hotel"]').dataset.value).toBe("All");
    });
    it("the six con days follow it, in order [1254]", () => {
      expect(days.slice(1)).toEqual(app.CON_DAYS);
    });
    it("the search box and day row share a sticky container [1258]", () => {
      expect(sticky).toBeTruthy();
    });
    it("the search box is inside it [1259]", () => {
      expect(sticky.querySelector("#q")).toBeTruthy();
    });
    it("the day chips are inside it [1260]", () => {
      expect(sticky.querySelector('[data-chip="day"]')).toBeTruthy();
    });
    it("the hotel row is not - it scrolls away [1261]", () => {
      expect(sticky.querySelector('[data-chip="hotel"]')).toBe(null);
    });
    it("nor the kind row [1262]", () => {
      expect(sticky.querySelector('[data-chip="kind"]')).toBe(null);
    });
  });

  describe("hotel names next to rooms", () => {
    let ev, row, sheet;
    const probe = e => { const d = document.createElement("div"); d.innerHTML = app.placeHTML(e); const part = sel => (d.querySelector(sel) ? d.querySelector(sel).textContent : null);
      return { text: d.textContent.replace(/\s+/g, " ").trim(), rh: part(".rh"), rr: part(".rr") }; };

    beforeAll(() => {
      const at = handle.now(), today = app.conDayKey(at);
      ev = handle.events.find(e => e.hotel === "Hilton" && e.room && e._s > at && app.conDayKey(e._s) === today);
      reset({ day: today, hotel: "Hilton" });
      const room = view().querySelector(`.row[data-id="${CSS.escape(ev.id)}"] .room`);
      row = { text: room.textContent.replace(/\s+/g, " ").trim(), rh: room.querySelector(".rh").textContent, rr: room.querySelector(".rr").textContent, style: room.getAttribute("style") };
      handle.openSheet("event", ev.id);
      const evRoom = document.querySelector("#panel-event .ev-room");
      sheet = { text: evRoom.textContent.replace(/\s+/g, " ").trim(), style: evRoom.getAttribute("style") };
      handle.closeSheet();
    });
    afterAll(() => reset());

    it("a row reads hotel, dot, room, in the hotel's hue [1819]", () => {
      expect(row).toMatchObject({ text: `Hilton · ${ev.room}`, rh: "Hilton", rr: ev.room });
      expect(row.style).toMatch(/--h-Hilton/);
    });
    it("and so does the detail sheet [1820]", () => {
      expect(sheet.text).toBe(`Hilton · ${ev.room}`);
      expect(sheet.style).toMatch(/--h-Hilton/);
    });
    it("a stream is just Streaming [1821]", () => {
      expect(probe(handle.events.find(e => e.hotel === "Streaming"))).toMatchObject({ text: "Streaming", rr: null });
    });
    it("an offsite venue is itself, with no hotel part [1822]", () => {
      expect(probe({ hotel: "Other", room: "Joystick Gamebar", location: "O Joystick Gamebar" })).toMatchObject({ text: "Joystick Gamebar", rh: null });
    });
    it("from the location, without its O marker, when the room is blank [1823]", () => {
      expect(probe({ hotel: "Other", room: "", location: "O Georgia Aquarium" }).text).toBe("Georgia Aquarium");
    });
    it("and Offsite when nothing names the venue [1824]", () => {
      expect(probe({ hotel: "Other", room: "Other", location: "Other" }).text).toBe("Offsite");
    });
    it("a blank room shows the hotel alone [1825]", () => {
      expect(probe({ hotel: "Hyatt", room: "", location: "" })).toMatchObject({ text: "Hyatt", rr: null });
    });
    it("no venue at all is Location TBA [1826]", () => {
      expect(probe({ hotel: "Unknown", room: "", location: "" }).text).toBe("Location TBA");
    });
  });
});

/* The harness set index and suggestIndex to null and read pendingQuery. The
   moment it was imitating is real: the page is up and the index is not. With
   the clock faked, the idle build waits until the test lets it run. */
describe("a query typed before the index is ready waits for it", () => {
  let page, app, handle, box;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    page = await bootPage();
    ({ app, handle } = page);
    Object.assign(handle.state.browse, FILTERS); handle.state.tab = "browse"; handle.render();
    box = document.getElementById("q");
  }, 30000);
  afterAll(async () => { await page.cleanup(); vi.useRealTimers(); });

  it("while the index builds the search box says so [1842, the page half]", () => {
    expect(app.BOOT.indexed).toBe(0);
    expect(box.placeholder).toBe("indexing…");
    expect(box.className).toMatch(/indexing/);
  });
  it("a query typed then is recorded and held, not run [1843]", () => {
    const waiting = vi.getTimerCount();
    typeInto(box, "boroughs");
    expect(handle.state.browse.q).toBe("boroughs");
    expect(vi.getTimerCount()).toBe(waiting);                       // no draw was queued: only the idle build is waiting
  });
  it("a render meanwhile shows the list with a note, not a false empty [1844]", () => {
    handle.render();
    expect(document.querySelector("#view-browse .indexing-note")).toBeTruthy();
    expect(document.querySelectorAll("#view-browse .row").length).toBeGreaterThan(0);
  });
  it("when the index is ready the held query is queued and the placeholder returns [1845]", () => {
    vi.runAllTimers();
    expect(app.BOOT.indexed).toBeGreaterThan(0);
    expect(box.placeholder).toBe(app.SEARCH_PLACEHOLDER);
    expect(box.className).not.toMatch(/indexing/);
  });
  it("and it runs once it can [1849]", () => {
    const results = app.browseResults();
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThan(100);
    results.forEach(e => expect(e.title + " " + e.description).toMatch(/boroughs/i));
    expect(document.querySelector("#view-browse .indexing-note")).toBe(null);
    expect(document.querySelectorAll("#view-browse .row mark").length).toBeGreaterThan(0);   // drawn from the index, not the unfiltered list
  });
});
