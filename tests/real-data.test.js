/* Search quality and Explore against the real 2026 schedule: what only 3,459
   real events can say. The sample fixture is 558 synthetic ones; "does AND
   actually narrow this" means nothing there. The number in brackets is the
   harness line the assertion came from (tests/PORT-LEDGER.md). One boot, and a
   long wait for it: the index over the real schedule takes seconds in jsdom.
   The building's model is asked here too (DECISIONS #94), of this schedule
   and the level drawings a build for 2026 is given, 2027's. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import DRAWINGS from "virtual:drawings";
import { YEAR, YY } from "../src/season.js";
import { bootPage } from "./helpers/page.js";

describe("against the real schedule", () => {
  let page, app, handle, state;
  const has = (titles, fragment) => titles.some(t => t.toLowerCase().includes(fragment.toLowerCase()));
  const chronological = list => { const t = list.map(e => +e._s); return t.every((v, i) => i === 0 || v >= t[i - 1]); };

  /* run a query with the default filters and say what came back; it does not draw */
  function search(q, over = {}) {
    Object.assign(state.browse, { q, day: "All", hotel: "All", type: "All", track: "All", work: "All", kind: "All",
      cost: "All", signup: "All", audience: "All", soldOut: "All", showHidden: false, showPast: false, noToday: false, hideNoise: true, page: 1 }, over);
    const results = app.browseResults(), of = section => results.filter(e => e._section === section);
    return { results, total: results.length, main: of("main").length, loose: of("loose").length, past: of("past").length,
      topTitles: of("main").slice(0, 5).map(e => e.title), mainDays: of("main").map(e => e.day), mainEvents: of("main"),
      chips: (state.browse.parsed.chips || []).map(c => c.label), residual: state.browse.parsed.residual };
  }

  beforeAll(async () => {
    page = await bootPage({ fixture: "real" });
    ({ app, handle } = page);
    state = handle.state;
    await page.until(() => app.BOOT.suggested > 0, 110000, "the index over the real schedule");
  }, 120000);
  afterAll(() => page.cleanup(), 60000);

  describe("the con's bounds are the data's own", () => {
    it("CON.start is the first listed event's start [2029]", () => {
      expect(app.CON.start.getTime()).toBe(handle.events[0]._s.getTime());
    });
    it("CON.end is the last listed event's end [2030]", () => {
      expect(app.CON.end.getTime()).toBe(Math.max(...handle.events.map(e => e._e.getTime())));
    });
  });

  describe("past events sink below the fold; AND first, OR as the fallback", () => {
    let st;
    beforeAll(() => { st = search("star trek"); });

    it('"star trek": everything above the fold is still to come [2053]', () => {
      expect(st.main).toBeGreaterThan(0);
      expect(st.mainEvents.every(e => e._e > handle.now())).toBe(true);
    });
    it("no Friday events above the divider at Saturday 13:05 [2054]", () => {
      expect(st.mainDays).not.toContain("2026-09-04");
    });
    it("past matches are kept, below the fold [2055]", () => {
      expect(st.past).toBeGreaterThan(0);
    });
    it("a query with plenty of AND matches shows no Looser section [2058]", () => {
      expect(st.loose).toBe(0);
    });
    it('"board games" narrows under AND (it was about 1,300 under OR) [2060]', () => {
      expect(search("board games").main).toBeLessThan(900);
    });
    it('"board games" leads with real board-game rows [2061]', () => {
      expect(has(search("board games").topTitles, "board game")).toBe(true);
    });
    it("a thin query has few AND matches [2063]", () => {
      expect(search("xylophone quidditch").main).toBeLessThan(8);
    });
  });

  /* the sample fixture has no offsite rows, so only the real data can say so */
  it("the Other chip covers both the streams and the offsite venues [2073]", () => {
    const hotels = search("", { hotel: "Other", showPast: true, hideNoise: false }).results.map(e => e.hotel);
    expect(hotels.length).toBeGreaterThan(0);
    expect(hotels.every(h => h === "Streaming" || h === "Other")).toBe(true);
    expect(hotels).toContain("Streaming");
    expect(hotels).toContain("Other");
  });

  describe("the quoted suggestion path", () => {
    /* the harness took the name from the internal suggestDocs; the busiest person outside the photo sessions is the same kind of person */
    let who, quoted;
    beforeAll(() => {
      const tally = {};
      handle.events.filter(e => !app.isNoise(e)).forEach(e => (e.people || []).forEach(p => { tally[p.id] = (tally[p.id] || 0) + 1; }));
      who = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
      quoted = search(`"${app.personName(who)}"`);
    });

    it("a tapped suggestion still returns results [2081]", () => {
      expect(quoted.total).toBeGreaterThan(0);
    });
    it("and nothing under a Looser divider [2082]", () => {
      expect(quoted.loose).toBe(0);
    });
    it("every result actually features them [2083]", () => {
      expect(quoted.results.every(e => (e.people || []).some(p => p.id === who))).toBe(true);
    });
  });

  it('"trek" still leads with Trek events [2096]', () => {
    expect(has(search("trek").topTitles.slice(0, 3), "trek")).toBe(true);
  });

  describe("when nothing matched literally, say so rather than rank confidently", () => {
    const noteFor = q => {
      state.tab = "browse";
      Object.assign(state.browse, { q, day: "All", hotel: "All", track: "All", kind: "All", hideNoise: true, showHidden: false, showPast: false, page: 1 });
      handle.render();
      const note = document.querySelector(".no-exact");
      return note ? note.textContent.replace(/\s+/g, " ").trim() : "";
    };

    it('"drag" admits it matched nothing literally [2109]', () => {
      expect(noteFor("drag")).toMatch(/No exact match for/);
    });
    it("and says the results are prefixes [2110]", () => {
      expect(noteFor("drag")).toMatch(/start with it/);
    });
    it("a typo is described as a spelling miss, not a prefix [2112]", () => {
      expect(noteFor("philharmonc")).toMatch(/close spellings/);
    });
    it("a query that matched literally gets no note [2113]", () => {
      expect(noteFor("trek")).toBe("");
    });
    it("nor a multi-word one that did [2114]", () => {
      expect(noteFor("star trek")).toBe("");
    });
    it("nor a query that was all filters and never ranked [2115]", () => {
      expect(noteFor("kids")).toBe("");
    });
  });

  describe("d&d", () => {
    it('"dnd" leads with D&D events [2121]', () => {
      const top = search("dnd").topTitles.slice(0, 3);
      expect(has(top, "d&d") || has(top, "dungeons")).toBe(true);
    });
    it('"d&d" finds D&D sessions [2123]', () => {
      const dd = search("d&d");
      expect((dd.main > 0 && has(dd.topTitles, "d&d")) || has(dd.topTitles, "dungeons")).toBe(true);
    });
  });

  describe("kids means the Kids Track", () => {
    it("kids shows a Kids Track chip [2128]", () => {
      expect(search("kids").chips).toContain("Kids Track");
    });
    it('"kids" returns Kids Track only [2129]', () => {
      const kids = search("kids");
      expect(kids.main).toBeGreaterThan(0);
      expect(kids.mainEvents.every(e => (e.tracks || []).includes("Kids Track"))).toBe(true);
    });
    it("kids stacks with a day [2131]", () => {
      expect(search("kids saturday").chips).toEqual(expect.arrayContaining(["Saturday", "Kids Track"]));
    });
    it("and only returns that day [2132]", () => {
      const sat = search("kids saturday");
      expect(sat.main).toBeGreaterThan(0);
      expect(sat.mainDays.every(d => d === "2026-09-05")).toBe(true);
    });
  });

  describe("question words fall through to the filtered list", () => {
    let westin;
    beforeAll(() => { westin = search("what is at the westin"); });

    it("the hotel is still read out of the question [2136]", () => {
      expect(westin.chips).toContain("Westin");
    });
    /* the residual is still "what is at the": it is the terms that vanish once the stopwords are dropped */
    it("a question of only stopwords is not ranked [2140]", () => {
      expect(westin.results.every(e => !e._hit)).toBe(true);
    });
    it("every result is at the Westin [2142]", () => {
      expect(westin.results.every(e => e.hotel === "Westin")).toBe(true);
    });
    it("in time order within the section, not ranked [2145]", () => {
      expect(chronological(westin.results.filter(e => e._section === "main"))).toBe(true);
    });
    it("and the past run is chronological too [2147]", () => {
      expect(chronological(westin.results.filter(e => e._section === "past"))).toBe(true);
    });
  });

  describe("explicit kinds beat the hide toggle", () => {
    let person, hiddenCount;

    it('"photo op tudyk" returns the photo sessions [2152]', () => {
      const photo = search("photo op tudyk");
      expect(photo.main).toBeGreaterThan(0);
      expect(photo.mainEvents.every(app.isNoise)).toBe(true);
    });
    it("and they are the right person's [2153]", () => {
      expect(has(search("photo op tudyk").topTitles, "tudyk")).toBe(true);
    });
    it("a person search says what was held back [2156]", () => {
      person = search("alan tudyk");
      const note = app.hiddenForQueryHTML(person.results).replace(/<[^>]*>/g, "");
      expect(note).toMatch(/\d+ photo sessions hidden/);
      hiddenCount = parseInt(note, 10);
    });
    it("with the right count [2159]", () => {
      expect(hiddenCount).toBe(handle.events.filter(e => app.isNoise(e) && (e.people || []).some(p => p.id === "alan-tudyk")).length);
    });
    it("tapping show includes them [2161]", () => {
      expect(search("alan tudyk", { showHidden: true }).main).toBeGreaterThanOrEqual(hiddenCount);
    });
    it("which is more than were shown before [2162]", () => {
      expect(person.main).toBeLessThan(search("alan tudyk", { showHidden: true }).main);
    });
  });

  /* a person's photo sessions are the point of following them, so the hide setting must not apply (the fixture has no such person) */
  describe("follows keep a person's photo sessions", () => {
    let celeb;
    beforeAll(() => {
      const tally = {};
      handle.events.filter(app.isNoise).forEach(e => (e.people || []).forEach(p => { tally[p.id] = (tally[p.id] || 0) + 1; }));
      const id = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
      celeb = id ? { id, hidden: tally[id] } : null;
    });
    const theirs = () => app.eventsFor({ kind: "person", key: celeb.id });

    it("the schedule has someone with photo sessions [2173]", () => {
      expect(celeb).toBeTruthy();
    });
    it("a person follow keeps their photo sessions [2177]", () => {
      expect(theirs().filter(app.isNoise)).toHaveLength(celeb.hidden);
    });
    it("alongside their other events [2178]", () => {
      expect(theirs().length).toBeGreaterThan(celeb.hidden);
    });
    it("and the hide-photo-sessions setting does not change that [2181]", () => {
      const was = state.browse.hideNoise, all = theirs().length;
      state.browse.hideNoise = true;
      expect(theirs()).toHaveLength(all);
      state.browse.hideNoise = was;
    });
    it("a track follow returns exactly the track's events [2185]", () => {
      const tally = {}; handle.events.forEach(e => (e.tracks || []).forEach(t => { tally[t] = (tally[t] || 0) + 1; }));
      const track = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
      expect(app.eventsFor({ kind: "track", key: track })).toHaveLength(handle.events.filter(e => (e.tracks || []).includes(track)).length);
    });
  });

  describe("Explore against the real schedule: all five sections, correct counts", () => {
    const celebrityGuest = id => handle.events.some(e => app.isCeleb(e) && (e.people || []).some(p => p.id === id && p.src === "speakers"));
    const distinct = pick => new Set(handle.events.flatMap(pick)).size;
    beforeAll(() => { handle.follows.set([]); state.tab = "explore"; state.explore.page = null; state.explore.q = ""; handle.render(); });
    afterAll(() => { state.explore.page = null; app.setExploreHash(null); handle.follows.set([]); handle.picks.set([]); state.tab = "browse"; handle.render(); });

    it("all five sections render [2193]", () => {
      expect([...document.querySelectorAll("#view-explore .section-title")].map(t => t.textContent.trim().split(" ")[0]).join(",")).toBe("Tracks,Fandoms,Topics,Guests,Panelists");
    });
    it("every Guest is a celebrity guest [2194]", () => {
      expect(app.getCatalogue().guest.length).toBeGreaterThan(100);
      expect(app.getCatalogue().guest.every(p => celebrityGuest(p.key))).toBe(true);
    });
    it("and every Panelist has 5+ events [2197]", () => {
      expect(app.getCatalogue().panelist.every(p => p.count >= 5)).toBe(true);
    });
    it("Epic Photos no longer leads the tracks; Video Room comes last [2198]", () => {
      const tracks = app.getCatalogue().track;
      expect(tracks[0].key).not.toBe("Epic Photos");
      expect(tracks[tracks.length - 1].key).toBe("Video Room");
    });

    describe("a starred celebrity panel suggests its guest, not its photo sessions", () => {
      let guest, tiles;
      beforeAll(() => {
        const ev = handle.events.find(e => app.isCeleb(e) && !app.isNoise(e) && (e.people || []).length === 1 && e.people[0].src === "speakers");
        guest = ev.people[0].id;
        handle.picks.set([ev.id]); handle.render();
        tiles = [...document.querySelectorAll("#suggested .tile")].map(t => t.dataset.explore);
        handle.picks.set([]); handle.render();
      });

      it("a starred celebrity panel suggests its guest [2208]", () => {
        expect(tiles).toContain("person:" + guest);
      });
      it("and never the photo-session track [2209]", () => {
        expect(tiles).not.toContain("track:Epic Photos");
      });
    });

    it("every track gets a tile [2212]", () => {
      expect(app.getCatalogue().track).toHaveLength(distinct(e => e.tracks || []));
    });
    it("fandoms are limited to 3+ events [2214]", () => {
      expect(app.getCatalogue().fandom.every(f => f.count >= 3)).toBe(true);
    });
    it("which is fewer than all of them [2215]", () => {
      const reviewedWithAny = handle.meta.works.filter(w => w.reviewed && handle.events.some(e => app.linksTo(e, w.id)));
      expect(app.getCatalogue().fandom.length).toBeLessThan(reviewedWithAny.length);
    });
    it("people are listed [2217]", () => {
      expect(app.getCatalogue().person.length).toBeGreaterThan(0);
    });
    it("each person is either a celebrity guest or has 5+ events [2218]", () => {
      expect(app.getCatalogue().person.every(p => p.count >= 5 || celebrityGuest(p.key))).toBe(true);
    });
    it("the page count matches eventsFor [2226]", () => {
      const track = app.getCatalogue().track[0].key;
      app.openExplorePage("track", track);
      expect(document.querySelector("#view-explore .eh-count").textContent.startsWith(String(app.eventsFor({ kind: "track", key: track }).length))).toBe(true);
    });
  });

  describe("search-3 fix 1: a filter-only query means today", () => {
    let lateNight, party, today;
    const mainOf = r => r.results.filter(e => e._section === "main");
    beforeAll(() => { today = app.conDayKey(handle.now()); });

    it("late night is still read as a time band [2232]", () => {
      lateNight = search("late night");
      expect(lateNight.chips).toContain("Late night");
    });
    it("and with nothing left to rank, it scopes to today [2233]", () => {
      expect(state.browse.todayScoped).toBe(true);
    });
    it("every result belongs to today's con day [2235]", () => {
      expect(mainOf(lateNight).every(e => app.conDayKey(e._s) === today)).toBe(true);
    });
    it("nothing from Wednesday [2237]", () => {
      expect(lateNight.mainDays).not.toContain("2026-09-02");
    });
    it("anything dated tomorrow is after midnight, not a different day [2238]", () => {
      expect(mainOf(lateNight).filter(e => e.day !== today).every(e => e._s.getHours() < 5)).toBe(true);
    });
    it('"party" returns today\'s parties [2242]', () => {
      party = search("party");
      expect(party.main).toBeGreaterThan(0);
    });
    it("with earlier ones behind the fold [2243]", () => {
      expect(party.past).toBeGreaterThan(0);
    });
    it("and everything above the fold is still to come [2244]", () => {
      expect(mainOf(party).every(e => e._e > handle.now())).toBe(true);
    });
    it("a named day is still read [2248]", () => {
      expect(search("party friday").chips).toContain("Friday");
    });
    it("and turns the today scope off [2249]", () => {
      expect(state.browse.todayScoped).toBe(false);
    });
    it("a day chip turns it off too [2252]", () => {
      search("party", { day: "2026-09-06" });
      expect(state.browse.todayScoped).toBe(false);
    });
    it("and its day is the one used [2253]", () => {
      expect(app.browseResults().every(e => e._cd === "2026-09-06")).toBe(true);
    });

    describe("the Today chip widens it", () => {
      let widened;
      beforeAll(() => { widened = search("party", { noToday: true }); });

      it("removing the Today chip widens to the whole con [2256]", () => {
        expect(state.browse.todayScoped).toBe(false);
      });
      it("which finds more [2257]", () => {
        expect(widened.main).toBeGreaterThan(party.main);
      });
      it("across more than one day [2258]", () => {
        expect(new Set(widened.mainDays).size).toBeGreaterThan(1);
      });
      it("the Today chip is shown so it can be removed [2261]", () => {
        Object.assign(state.browse, { q: "party", day: "All", noToday: false, page: 1 }); state.tab = "browse"; handle.render();
        expect(document.querySelector("#view-browse .parsed-chips").textContent).toMatch(/Today/);
      });
      it("with a control to remove it [2262]", () => {
        expect(document.querySelector('#view-browse [data-act="unparse-today"]')).toBeTruthy();
      });
    });
  });

  describe("search-3 fix 2: stopwords and short-term prefix", () => {
    /* The harness read MiniSearch's private _options for the prefix rule. What
       the rule does shows in the hits: the index terms each one matched on. */
    const matchedTerms = q => search(q).results.filter(e => e._hit).flatMap(e => e._hit.terms);

    it("two letters do not prefix-match: every hit for 'ai' matched the word ai itself [2268]", () => {
      const terms = matchedTerms("ai");
      expect(terms.length).toBeGreaterThan(0);
      expect([...new Set(terms)]).toEqual(["ai"]);
    });
    it("nor three: every hit for 'mcu' matched mcu itself [2269]", () => {
      const terms = matchedTerms("mcu");
      expect(terms.length).toBeGreaterThan(0);
      expect([...new Set(terms)]).toEqual(["mcu"]);
    });
    it("four or more do: 'trek' also arrives by longer words that start with it [2270]", () => {
      expect(matchedTerms("trek").some(t => t.startsWith("trek") && t !== "trek")).toBe(true);
    });

    describe.each([["mcu", "mcu"], ["40k", "40k"], ["ai", "ai"], ["dnd", "dungeons"], ["trek", "trek"]])('"%s"', (q, want) => {
      it(`"${q}" still returns events [2274]`, () => {
        expect(search(q).main).toBeGreaterThan(0);
      });
      it(`"${q}" leads with ${want} events [2275]`, () => {
        expect(search(q).topTitles.slice(0, 3).some(t => new RegExp(want, "i").test(t))).toBe(true);
      });
    });
    it.each(["skeptrack", "filk", "larp"])('track aliases: "%s" finds something [2281]', q => {
      expect(search(q).total).toBeGreaterThan(0);
    });
  });

  /* DECISIONS #39: the client reads events.v2.json - works by id, rolled up
     through the works block; the four axes by label; a work's cast apart. */
  describe("the v2 file: works by id, axes by label, the cast apart", () => {
    const AXES = ["medium", "genre", "craft", "subject"];
    const axisValues = () => new Set(handle.events.flatMap(e => AXES.flatMap(a => ((e.tags || {})[a] || []).map(v => `${a}:${v}`))));
    const valueOf = key => [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
    afterAll(() => {
      state.explore.page = null; app.setExploreHash(null); handle.follows.set([]);
      state.browse.work = "All"; state.tab = "browse"; handle.render();
    });

    it("every axis value in the file has a label", () => {
      const values = [...axisValues()];
      expect(values.length).toBeGreaterThan(30);
      expect(values.filter(k => { const [a, v] = valueOf(k); return !(app.AXIS_LABELS[a] || {})[v]; })).toEqual([]);
      expect(app.AXIS_LABELS.audience.kids).toBe("Kids");
    });
    it("the Topics tiles are every axis value in the file and the kids audience, each shown by its label", () => {
      const topics = app.getCatalogue().topic;
      expect(topics.map(t => t.key).sort()).toEqual([...axisValues(), "audience:kids"].sort());
      expect(topics.every(t => t.name === app.axisLabel(t.key))).toBe(true);
    });
    it("a work's count is the events linksTo finds, for every work in the block", () => {
      const wrong = handle.meta.works.filter(w => (app.workCounts.get(w.id) || 0) !== handle.events.filter(e => app.linksTo(e, w.id)).length);
      expect(wrong.map(w => w.id)).toEqual([]);
    });
    it("and it takes in the events of the works under it", () => {
      const direct = handle.events.filter(e => (e.tags.works || []).some(w => w.id === "star-trek" && (w.via === "about" || w.via === "track")));
      expect(app.workCounts.get("star-trek")).toBeGreaterThan(direct.length);
    });
    it("only reviewed works get a tile", () => {
      expect(app.getCatalogue().fandom.every(t => app.worksById.get(t.key).reviewed === true)).toBe(true);
      expect(handle.meta.works.some(w => !w.reviewed && (app.workCounts.get(w.id) || 0) >= 3)).toBe(true);
    });

    /* The filter sheet's (#70), so opened from the Filters button. */
    describe("the Fandom select", () => {
      beforeAll(() => { state.tab = "browse"; Object.assign(state.browse, { q: "", day: "All", work: "All" }); handle.render(); document.getElementById("filtersBtn").click(); });
      afterAll(() => handle.closeSheet());

      it("lists the reviewed works with 3+ events, by id, each named with its count", () => {
        const options = [...document.querySelectorAll("#panel-filters #fandom option")].slice(1);
        expect(options.map(o => o.value)).toEqual(app.getCatalogue().fandom.map(t => t.key));
        expect(options.every(o => {
          const w = app.worksById.get(o.value), n = app.workCounts.get(o.value);
          return w.reviewed === true && n >= 3 && o.textContent === `${w.name} (${n})`;
        })).toBe(true);
      });
      it("choosing one keeps the events linked to it, or to anything under it", () => {
        const select = document.getElementById("fandom");
        select.value = "star-trek";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        expect(state.browse.work).toBe("star-trek");
        const found = search("", { work: "star-trek", hideNoise: false });
        expect(found.total).toBe(app.workCounts.get("star-trek"));
        expect(found.results.every(e => app.linksTo(e, "star-trek"))).toBe(true);
      });
      it("the sheet's main button counts the whole con in thousands, as the list holds it", () => {
        Object.assign(state.browse, { q: "", day: "All" });
        document.getElementById("filtersClear").click();
        const shown = handle.events.filter(e => !app.isNoise(e)).length;
        expect(shown).toBeGreaterThan(999);
        expect(document.getElementById("filtersShow").textContent).toBe(`Show ${shown.toLocaleString("en-US")} events`);
        expect(document.getElementById("filtersShow").textContent).toMatch(/^Show \d,\d{3} events$/);
      });
    });

    describe("Star Trek's page: the cast collapsed, its photo ops and signings behind a reveal", () => {
      let about, cast, quiet;
      const castButton = () => document.querySelector('#view-explore [data-act="explore-cast"]');
      const reveal = () => document.querySelector('#view-explore [data-act="explore-cast-noise"]');
      const rows = list => [...document.querySelectorAll(`#view-explore .row[data-list="${list}"]`)].map(r => r.dataset.id);
      beforeAll(() => {
        about = app.eventsFor({ kind: "work", key: "star-trek" }).map(e => e.id);
        cast = handle.events.filter(e => app.linksTo(e, "star-trek", ["credit"]) && !about.includes(e.id));
        quiet = cast.filter(e => ["photo", "signing"].includes(e.tags.kind)).map(e => e.id);
        state.explore.page = null;
        app.openExplorePage("work", "star-trek");
        state.explore.showPast = true; handle.render();
      });

      it("Star Trek has a cast group, part of it photo ops and signings", () => {
        expect(cast.length).toBeGreaterThan(quiet.length);
        expect(quiet.length).toBeGreaterThan(0);
      });
      it("the page's own count is the events about it or its track", () => {
        expect(document.querySelector("#view-explore .eh-count").textContent.startsWith(`${about.length} events`)).toBe(true);
      });
      it("the group is collapsed by default and says how many it holds", () => {
        expect(castButton().getAttribute("aria-expanded")).toBe("false");
        expect(castButton().textContent.trim()).toMatch(new RegExp(`^With the cast \\(${cast.length}\\)`));
        expect(rows("explore-cast")).toEqual([]);
      });
      it("opened, it lists the cast's events but the photo ops and signings, and offers those by count", () => {
        castButton().click();
        expect(castButton().getAttribute("aria-expanded")).toBe("true");
        expect(rows("explore-cast").sort()).toEqual(cast.map(e => e.id).filter(id => !quiet.includes(id)).sort());
        expect(reveal().textContent).toBe(`show photo ops and signings (${quiet.length})`);
      });
      it("the reveal adds them, and goes", () => {
        reveal().click();
        expect(rows("explore-cast").sort()).toEqual(cast.map(e => e.id).sort());
        expect(reveal()).toBe(null);
      });
      it("no event is in both lists", () => {
        expect(rows("explore").length).toBe(about.length);
        expect(rows("explore-cast").filter(id => rows("explore").includes(id))).toEqual([]);
      });
    });

    /* DECISIONS #85: the cast group a work's page has, in the Following feed
       and in Search. On the real file, since the fixture has no cast. New
       tests, not rows of tests/PORT-LEDGER.md. */
    describe("a followed fandom's block in Following ends with its cast, By interest alone", () => {
      let about, whole, cast, quiet;
      const QUIET = ["photo", "signing"];
      const fol = () => document.getElementById("following");
      const folds = () => [...fol().querySelectorAll('[data-act="fol-cast"]')];
      const reveal = () => fol().querySelector('[data-act="fol-cast-noise"]');
      const rows = list => [...fol().querySelectorAll(`.row[data-list="${list}"]`)].map(r => r.dataset.id);
      const feed = follows => {
        handle.follows.set(follows);
        Object.assign(state.following, { open: true, layout: "interest", expanded: {}, showPast: {}, showCast: {}, castNoise: {} });
        state.explore.page = null; state.tab = "explore"; handle.render();
      };
      beforeAll(() => {
        const at = handle.now();
        about = app.eventsFor({ kind: "work", key: "firefly" }).map(e => e.id);
        whole = handle.events.filter(e => app.linksTo(e, "firefly", ["credit"]) && !about.includes(e.id));
        cast = whole.filter(e => !app.isPast(e, at));
        quiet = cast.filter(e => QUIET.includes(e.tags.kind)).map(e => e.id);
        feed([{ kind: "work", key: "firefly" }, { kind: "track", key: "Trek Track" }, { kind: "person", key: "alan-tudyk" }, { kind: "axis", key: "genre:horror" }]);
      });
      afterAll(() => { handle.follows.set([]); state.following.layout = "interest"; });

      it("Firefly's cast has events that have passed and events to come, part of them photo ops and signings", () => {
        expect(cast.length).toBeGreaterThan(quiet.length);
        expect(quiet.length).toBeGreaterThan(0);
        expect(whole.length).toBeGreaterThan(cast.length);
      });
      it("only the fandom's block has the fold: none for a track, a person or a topic", () => {
        expect(folds().map(b => b.dataset.follow)).toEqual(["work:firefly"]);
      });
      it("shut, and its count is the cast's events still to come", () => {
        expect(folds()[0].getAttribute("aria-expanded")).toBe("false");
        expect(folds()[0].textContent.replace(/\s+/g, " ").trim()).toBe(`With the cast (${cast.length}) ▸`);
        expect(rows("folc:work:firefly")).toEqual([]);
        expect(reveal()).toBe(null);
      });
      it("it ends the block: after the block's Already happened, before the next follow's title", () => {
        const past = fol().querySelector('[data-act="fol-past"][data-follow="work:firefly"]');
        const next = [...fol().querySelectorAll(".section-title")][1];
        expect(past.compareDocumentPosition(folds()[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(folds()[0].compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(folds()[0].parentElement.nextElementSibling).toBe(next);
      });
      it("the block's own count and its rows are the events about the fandom, as they were", () => {
        const at = handle.now(), toCome = app.eventsFor({ kind: "work", key: "firefly" }).filter(e => !app.isPast(e, at)).map(e => e.id);
        expect(fol().querySelector(".section-title .count").textContent.replace(/\s+/g, " ").trim()).toBe(`Fandom · ${toCome.length} to come`);
        expect(rows("fol:work:firefly")).toEqual(toCome.slice(0, 8));
      });
      it("opened, its rows are the cast's events to come less the photo ops and signings, the day on each, and the button says how many those are", () => {
        folds()[0].click();
        expect(folds()[0].getAttribute("aria-expanded")).toBe("true");
        expect(state.following.showCast).toEqual({ "work:firefly": true });
        expect(rows("folc:work:firefly")).toEqual(cast.map(e => e.id).filter(id => !quiet.includes(id)));
        expect([...fol().querySelectorAll('.row[data-list="folc:work:firefly"]')].every(r => r.querySelector(".when-where .day"))).toBe(true);
        expect(reveal().textContent).toBe(`show photo ops and signings (${quiet.length})`);
        expect(reveal().dataset.follow).toBe("work:firefly");
      });
      it("the button adds them, and goes", () => {
        reveal().click();
        expect(rows("folc:work:firefly")).toEqual(cast.map(e => e.id));
        expect(reveal()).toBe(null);
        expect(state.following.castNoise).toEqual({ "work:firefly": true });
      });
      it("no event is both in the block's rows and in the group, with everything of the block shown", () => {
        state.following.expanded["work:firefly"] = true; state.following.showPast["work:firefly"] = true; handle.render();
        const own = [...rows("fol:work:firefly"), ...rows("folp:work:firefly")];
        expect(own.sort()).toEqual([...about].sort());
        expect(rows("folc:work:firefly").filter(id => own.includes(id))).toEqual([]);
      });
      it("a block with nothing left of its own still gets it", () => {
        const at = handle.now();
        const w = handle.meta.works.find(x => x.reviewed && !app.eventsFor({ kind: "work", key: x.id }).some(e => !app.isPast(e, at))
          && handle.events.some(e => app.linksTo(e, x.id, ["credit"]) && !app.linksTo(e, x.id) && !app.isPast(e, at)));
        expect(w).toBeTruthy();
        feed([{ kind: "work", key: w.id }]);
        expect(fol().querySelector(".empty").textContent).toBe("Nothing left today or later.");
        expect(folds().map(b => b.dataset.follow)).toEqual([`work:${w.id}`]);
      });
      it("no fold for a fandom with no cast event to come", () => {
        const w = app.topWorks().find(x => !handle.events.some(e => app.linksTo(e, x.id, ["credit"]) && !app.linksTo(e, x.id)));
        expect(w).toBeTruthy();
        feed([{ kind: "work", key: w.id }]);
        expect(fol().querySelectorAll(".row").length).toBeGreaterThan(0);
        expect(folds()).toEqual([]);
      });
      it("By time is as it was: no fold, and no cast event among its rows", () => {
        feed([{ kind: "work", key: "firefly" }]);
        state.following.showCast["work:firefly"] = true;
        fol().querySelector('[data-act="fol-time"]').click();
        state.following.showPast.__time = true; handle.render();
        expect(state.following.layout).toBe("time");
        expect(fol().querySelector('[data-act="fol-cast"], [data-act="fol-cast-noise"]')).toBe(null);
        expect(rows("foltime").sort()).toEqual([...about].sort());
        expect(rows("foltime").filter(id => whole.some(e => e.id === id))).toEqual([]);
      });
    });

    describe("Search with the Fandom filter set: the list, then its cast", () => {
      const rest = () => document.getElementById("browseRest");
      const fold = () => rest().querySelector('[data-act="browse-cast"]');
      const rows = list => [...rest().querySelectorAll(`.row[data-list="${list}"]`)].map(r => r.dataset.id);
      const draw = (q, over) => { const found = search(q, over); state.tab = "browse"; handle.render(); return found; };
      /* What the group should hold, asked the long way: the filters as they
         stand with the Fandom taken off, and the list's own scope and order. */
      const expected = work => {
        const at = handle.now(), today = state.browse.todayScoped ? app.conDayKey(at) : null;
        state.browse.work = "All";
        const list = handle.events.filter(e => app.linksTo(e, work, ["credit"]) && !app.linksTo(e, work) && app.passesFilters(e)
          && (!today || app.conDayKey(e._s) === today));
        state.browse.work = work;
        return [...list.filter(e => !app.isPast(e, at)), ...list.filter(e => app.isPast(e, at))].map(e => e.id);
      };
      const both = (q, over) => { const found = draw(q, over); return { found, want: expected(over.work), got: rows("browse-cast") }; };
      beforeAll(() => { state.browse.castOpen = true; });
      afterAll(() => { state.browse.castOpen = true; search(""); });

      it("all days: every cast event the other filters pass, what is to come by its start, then what has passed", () => {
        const { want, got } = both("", { work: "star-trek" });
        expect(want.length).toBeGreaterThan(3);
        expect(got).toEqual(want);
        const at = handle.now(), gone = got.map(id => app.isPast(handle.events.find(e => e.id === id), at));
        expect(gone).toContain(true);
        expect(gone).toContain(false);
        expect(gone.indexOf(true)).toBe(gone.lastIndexOf(false) + 1);
      });
      it("a fold after the list, open, saying how many it holds, its rows with the day on each", () => {
        expect(fold().getAttribute("aria-expanded")).toBe("true");
        expect(fold().textContent.replace(/\s+/g, " ").trim()).toBe(`With the cast (${rows("browse-cast").length}) ▾`);
        const list = rest().querySelector("ul.list");
        expect(list.compareDocumentPosition(fold()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(rest().lastElementChild.querySelectorAll('.row[data-list="browse-cast"]').length).toBe(rows("browse-cast").length);
        expect([...rest().querySelectorAll('.row[data-list="browse-cast"]')].every(r => r.querySelector(".when-where .day"))).toBe(true);
      });
      it("the title's count, the Filters badge and the sheet's Show count are the list's alone", () => {
        const n = handle.events.filter(app.passesFilters).length;
        expect(n).toBe(rows("browse").length);
        expect(rest().querySelector(".section-title .count").textContent).toBe(String(n));
        expect(document.getElementById("filtersBadge").textContent).toBe("1");
        handle.openSheet("filters");
        expect(document.getElementById("filtersShow").textContent).toBe(`Show ${n} events`);
        handle.closeSheet();
      });
      it("no event is in both the list and the group", () => {
        expect(rows("browse-cast").filter(id => rows("browse").includes(id))).toEqual([]);
        expect(rows("browse").every(id => app.linksTo(handle.events.find(e => e.id === id), "star-trek"))).toBe(true);
      });
      it("a tap shuts it and a tap opens it, kept while the list is drawn again", () => {
        fold().click();
        expect([state.browse.castOpen, fold().getAttribute("aria-expanded"), rows("browse-cast")]).toEqual([false, "false", []]);
        handle.render();
        expect(fold().getAttribute("aria-expanded")).toBe("false");
        fold().click();
        expect([state.browse.castOpen, fold().getAttribute("aria-expanded")]).toEqual([true, "true"]);
        expect(rows("browse-cast").length).toBeGreaterThan(0);
      });
      it("under a day chip it holds that day's alone", () => {
        const all = both("", { work: "star-trek" }).got;
        const { want, got } = both("", { work: "star-trek", day: "2026-09-06" });
        expect(got).toEqual(want);
        expect(got.length).toBeGreaterThan(0);
        expect(got.length).toBeLessThan(all.length);
        expect(got.every(id => handle.events.find(e => e.id === id)._cd === "2026-09-06")).toBe(true);
      });
      it("with the photo and video filter off it holds what that filter held back too", () => {
        const on = both("", { work: "star-trek" }).got;
        const { want, got } = both("", { work: "star-trek", hideNoise: false });
        expect(got).toEqual(want);
        expect(got.length).toBeGreaterThan(on.length);
      });
      it("with a filter of the sheet's set it holds what passes that filter", () => {
        const all = both("", { work: "star-trek" }).got;
        const { want, got } = both("", { work: "star-trek", hotel: "Marriott" });
        expect(got).toEqual(want);
        expect(got.length).toBeGreaterThan(0);
        expect(got.length).toBeLessThan(all.length);
        expect(got.every(id => handle.events.find(e => e.id === id).hotel === "Marriott")).toBe(true);
      });
      it("a word read as a filter keeps the group: \"sunday\", and Sunday's cast alone", () => {
        const { found, want, got } = both("sunday", { work: "star-trek" });
        expect(found.results.every(e => !e._hit)).toBe(true);
        expect(got).toEqual(want);
        expect(got.length).toBeGreaterThan(0);
        expect(got.every(id => handle.events.find(e => e.id === id)._cd === "2026-09-06")).toBe(true);
      });
      it("where the list is today's alone, so is the group", () => {
        const { want, got } = both("qa", { work: "star-trek", noToday: false, hideNoise: false });
        expect(state.browse.todayScoped).toBe(true);
        expect(got).toEqual(want);
        expect(got.length).toBeGreaterThan(0);
        expect(got.every(id => handle.events.find(e => e.id === id)._cd === "2026-09-05")).toBe(true);
        expect(both("qa", { work: "star-trek", noToday: true, hideNoise: false }).got.length).toBeGreaterThan(got.length);
      });
      it("with a word that ranks there is no group", () => {
        const found = draw("serenity", { work: "firefly" });
        expect(found.results.some(e => e._hit)).toBe(true);
        expect([fold(), app.browseCast(), rows("browse-cast")]).toEqual([null, [], []]);
      });
      it("with no Fandom set there is no group", () => {
        draw("", {});
        expect([fold(), app.browseCast(), rows("browse-cast")]).toEqual([null, [], []]);
        draw("sunday", {});
        expect([fold(), app.browseCast()]).toEqual([null, []]);
      });
      it("an empty list over a group says which list is empty, by the fandom's name, and the rest of the line as it was", () => {
        const pair = app.topWorks().flatMap(w => app.CON_DAYS.map(day => ({ w, day })))
          .find(({ w, day }) => { const { found, got } = both("", { work: w.id, day }); return !found.total && got.length; });
        expect(pair).toBeTruthy();
        draw("", { work: pair.w.id, day: pair.day });
        const empty = rest().querySelector(".empty");
        expect(empty.querySelector("b").textContent).toBe(`No events about ${pair.w.name}.`);
        expect(empty.textContent).toBe(`No events about ${pair.w.name}. Remove a filter above, or try another day or fewer words.`);
        expect(empty.compareDocumentPosition(fold()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(rest().querySelector(".section-title .count").textContent).toBe("0");
      });
      it("where the list and the group are both empty the line is as it was", () => {
        const pair = app.topWorks().flatMap(w => app.CON_DAYS.map(day => ({ w, day })))
          .find(({ w, day }) => { const { found, got } = both("", { work: w.id, day }); return !found.total && !got.length; });
        expect(pair).toBeTruthy();
        draw("", { work: pair.w.id, day: pair.day });
        expect(rest().querySelector(".empty").textContent).toBe("No matches. Remove a filter above, or try another day or fewer words.");
        expect(fold()).toBe(null);
      });
    });

    describe("what the index holds of a work, an axis and the audience", () => {
      const text = e => [e.title, e.description, ...(e.tracks || []), ...(e.people || []).map(p => p.name)].join(" ").toLowerCase();
      const found = (q, over = {}) => new Set(search(q, { hideNoise: false, noToday: true, ...over }).results.map(e => e.id));

      it("a work's name is in the index of the events about the works under it", () => {
        const lowerDecks = handle.events.filter(e => app.linksTo(e, "star-trek-lower-decks") && !/trek|starfleet|klingon/.test(text(e)));
        expect(lowerDecks.length).toBeGreaterThan(0);
        const hits = found("star trek");
        expect(lowerDecks.filter(e => !hits.has(e.id)).map(e => e.title)).toEqual([]);
      });
      it("and so are the registry's other names for it: DCEU finds every DC Comics event", () => {
        const dc = handle.events.filter(e => app.linksTo(e, "dc-comics"));
        expect(dc.some(e => !text(e).includes("dceu"))).toBe(true);
        const hits = found("dceu");
        expect(dc.filter(e => !hits.has(e.id)).map(e => e.title)).toEqual([]);
      });
      it("an axis is indexed by its label: 'literature' finds books events whose text never says it", () => {
        const books = handle.events.filter(e => (e.tags.medium || []).includes("books") && !text(e).includes("literature"));
        expect(books.length).toBeGreaterThan(0);
        const hits = found("literature");
        expect(books.filter(e => !hits.has(e.id)).map(e => e.title)).toEqual([]);
      });
      it("an unreviewed work is searchable, and offered as a suggestion", () => {
        const w = app.worksById.get("brandish");
        expect(w.reviewed).toBe(false);
        state.browse.hideNoise = false;
        expect(app.suggestionsFor("brandi").topics.map(t => t.name)).toContain(w.name);
      });
      it("Kids is still a suggestion, as the topic it was", () => {
        state.browse.hideNoise = false;
        expect(app.suggestionsFor("kid").topics.map(t => t.name)).toContain("Kids");
      });
      it('"18+" finds the 18+ events - a mature audience, a stated minimum of 17 or more, or the marker of the listing - and nothing else: 105', () => {
        const r = search("18+", { noToday: true, hideNoise: false });
        expect(r.total).toBe(105);
        expect(r.results.every(e => app.isAdult(e))).toBe(true);
        expect(handle.events.filter(e => app.isAdult(e))).toHaveLength(105);
      });
      it("in 2026 the three halves of that rule name the same 105: the mature audience holds every stated 17, 18 and 21 and every marker", () => {
        const mature = handle.events.filter(e => e.tags.audience === "mature");
        expect(mature).toHaveLength(105);
        expect(handle.events.filter(e => app.isAdult(e) && e.tags.audience !== "mature").map(e => e.title)).toEqual([]);
        expect(handle.events.filter(e => e.facets.min_age >= 17)).toHaveLength(28);
        expect(handle.events.filter(e => e.facets.mature)).toHaveLength(75);
      });
      it('"kids" keeps the 18+ ones out, though the Kids Track has one: 47 of its 48', () => {
        const kidsTrack = handle.events.filter(e => (e.tracks || []).includes("Kids Track"));
        expect(kidsTrack).toHaveLength(48);
        expect(kidsTrack.filter(e => app.isAdult(e)).map(e => e.title)).toEqual(["Grown-up Games: Warrior Cats, or Game of Thrones?"]);
        const r = search("kids", { noToday: true, hideNoise: false });
        expect(r.total).toBe(47);
        expect(r.results.some(e => app.isAdult(e))).toBe(false);
      });
      it.each(["kids 18+", "18+ kids", "adult kids", "kids adult"])('"%s": the explicit word wins, in either order - the one 18+ event of the Kids Track', q => {
        const r = search(q, { noToday: true, hideNoise: false });
        expect(r.results.map(e => e.title)).toEqual(["Grown-up Games: Warrior Cats, or Game of Thrones?"]);
      });
      /* DECISIONS #77: a row's 18+ asks isAdult(), which reads the listing's
         marker too. The rule a row had before, written out here, gives every
         one of 2026's events the flags it gives now. */
      it("every 2026 event's flags are what they were before the marker was read", () => {
        const before = e => {
          const f = e.facets || {}, audience = (e.tags || {}).audience, out = [];
          if (f.sold_out) out.push({ key: "sold_out", label: "Sold out" });
          if (f.cost) out.push({ key: "cost", label: "Extra fee" });
          if (f.signup) out.push({ key: "signup", label: "Sign-up" });
          if (f.min_age) out.push({ key: "age", label: `${f.min_age}+` });
          else if (audience === "mature") out.push({ key: "age", label: "18+" });
          if (audience === "kids") out.push({ key: "kids", label: "Kids" });
          return out;
        };
        expect(handle.events).toHaveLength(3459);
        expect(handle.events.filter(e => JSON.stringify(app.flagsOf(e)) !== JSON.stringify(before(e))).map(e => e.id)).toEqual([]);
        const ages = {};
        handle.events.forEach(e => app.flagsOf(e).filter(f => f.key === "age").forEach(f => { ages[f.label] = (ages[f.label] || 0) + 1; }));
        expect(ages).toEqual({ "18+": 88, "17+": 14, "21+": 2, "16+": 2, "13+": 1 });
        expect(app.flagsOf(handle.events.find(e => e.title === "Puppetry 101 - Adults")).map(f => f.label)).toEqual(["16+"]);
      });
      it("the sheet's facts line says a mature event's age - 18+, or the minimum its listing states - and no other event's", () => {
        const ages = () => [...document.querySelectorAll("#panel-event .ev-facts .flag")].map(f => f.textContent).filter(t => /^\d+\+$/.test(t));
        const mature = handle.events.filter(e => e.tags.audience === "mature");
        const plain = mature.find(e => !e.facets.min_age), stated = mature.find(e => e.facets.min_age === 21);
        const other = handle.events.find(e => e.tags.audience === "all" && !e.facets.min_age);
        handle.openSheet("event", plain.id);
        expect(ages()).toEqual(["18+"]);
        handle.openSheet("event", stated.id);
        expect(ages()).toEqual(["21+"]);
        handle.openSheet("event", other.id);
        expect(ages()).toEqual([]);
        expect(document.querySelector("#panel-event .tag.adult")).toBe(null);
        handle.closeSheet();
      });
    });

    describe("pages the tiles do not reach", () => {
      afterAll(() => { state.explore.page = null; app.setExploreHash(null); });

      it("an unreviewed work's page has no Follow button", () => {
        app.openExplorePage("work", "brandish");
        expect(document.querySelector("#view-explore .eh-name").textContent).toBe(app.worksById.get("brandish").name);
        expect(document.querySelector("#view-explore .follow-btn")).toBe(null);
      });
      it("a work with only a cast shows its cast group, and no 'No events'", () => {
        const w = handle.meta.works.find(x => x.reviewed && !app.workCounts.get(x.id) && handle.events.some(e => app.linksTo(e, x.id, ["credit"])));
        app.openExplorePage("work", w.id);
        expect(document.querySelector('#view-explore [data-act="explore-cast"]')).toBeTruthy();
        expect(document.querySelector("#view-explore").textContent).not.toMatch(/No events/);
      });
    });

    it("a link to an unreviewed work, or by v1's names, lands on the grid; one by id opens its page", () => {
      const unreviewed = handle.meta.works.find(w => !w.reviewed && (app.workCounts.get(w.id) || 0) > 0);
      const open = target => {
        window.location.hash = "#explore=" + encodeURIComponent(target);
        window.dispatchEvent(new Event("hashchange"));
        return state.explore.page;
      };
      for (const target of [`work:${unreviewed.id}`, "person:Nathan Fillion", "fandom:Star Trek", "topic:Horror"]) {
        expect(open(target), target).toBe(null);
      }
      expect(open("work:star-trek")).toEqual({ kind: "work", key: "star-trek" });
      expect(document.querySelector("#view-explore .eh-name").textContent).toBe("Star Trek");
      expect(open("axis:genre:horror")).toEqual({ kind: "axis", key: "genre:horror" });
      expect(document.querySelector("#view-explore .eh-name").textContent).toBe("Horror");
    });
  });

  /* The event sheet's entry points (DECISIONS #75): the counts the design
     was settled on, from the committed schedule. New tests, not rows of
     tests/PORT-LEDGER.md. */
  describe("the event sheet's entry points, on 2026's schedule", () => {
    let all, chips;
    const tally = (list, key) => list.reduce((by, x) => ({ ...by, [key(x)]: (by[key(x)] || 0) + 1 }), {});
    beforeAll(() => {
      state.explore.page = null; app.setExploreHash(null); state.tab = "now"; handle.render();
      all = [...app.byId.values()];
      chips = all.flatMap(e => app.chipsOf(e).map(c => ({ ...c, event: e.id })));
    });
    afterAll(() => { handle.closeSheet(); state.explore.page = null; app.setExploreHash(null); state.tab = "now"; handle.render(); });

    it("3,372 sheets make the place a tap: the 3,374 at the Map's eight places, less the two cancelled", () => {
      expect(all).toHaveLength(3459);
      expect(all.filter(e => app.MAP_HOTELS[e.hotel])).toHaveLength(3374);
      expect(tally(all.filter(e => !app.MAP_HOTELS[e.hotel]), e => e.hotel)).toEqual({ Streaming: 62, Other: 23 });
      expect(all.filter(e => e.cancelled).map(e => e.hotel)).toEqual(["Courtland Grand", "Courtland Grand"]);
      expect(all.filter(e => e.removed)).toEqual([]);
      expect(all.filter(e => app.onTheMap(e))).toHaveLength(3372);
      expect(tally(all.filter(e => app.onTheMap(e)), e => e.hotel)).toEqual({ "AmericasMart Building 3": 845, "AmericasMart Building 2": 188, Hilton: 739, Marriott: 607, Hyatt: 499, Westin: 309, "Courtland Grand": 149, "Hardy Ivy Park": 36 });
    });
    it("four of them name no room, so the tap is the hotel's name alone", () => {
      expect(all.filter(e => app.onTheMap(e) && !String(e.room || "").trim()).map(e => app.placeText(e)).sort()).toEqual(["Hyatt", "Hyatt", "Hyatt", "Westin"]);
    });
    it("every event's con day is one of the Map's day chips, so a focus always has a day to show", () => {
      expect(all.filter(e => !app.CON_DAYS.includes(e._cd)).map(e => e.id)).toEqual([]);
    });
    it("5,182 chips on 3,458 events: 3,483 track chips over 54 tracks, 1,699 work chips over 540 works", () => {
      const of = kind => chips.filter(c => c.kind === kind);
      expect([chips.length, new Set(chips.map(c => c.event)).size]).toEqual([5182, 3458]);
      expect([of("track").length, new Set(of("track").map(c => c.key)).size]).toEqual([3483, 54]);
      expect([of("work").length, new Set(of("work").map(c => c.key)).size]).toEqual([1699, 540]);
    });
    it("every track chip is a tap; of the work chips 1,455 are taps and 244 are plain: 64 unreviewed works, on 239 events", () => {
      const plain = chips.filter(c => !c.tap);
      expect(chips.filter(c => c.kind === "track" && !c.tap)).toEqual([]);
      expect([chips.filter(c => c.kind === "work" && c.tap).length, plain.length]).toEqual([1455, 244]);
      expect([new Set(plain.map(c => c.key)).size, new Set(plain.map(c => c.event)).size]).toEqual([64, 239]);
      expect(plain.every(c => c.kind === "work" && app.worksById.get(c.key).reviewed !== true)).toBe(true);
    });
    it("every chip that is a tap opens a page a link can open, with at least one event on it; 304 of those pages hold one event", () => {
      const pages = new Map(chips.filter(c => c.tap).map(c => [`${c.kind}:${c.key}`, c]));
      const sizes = [...pages.values()].map(c => app.eventsFor(c).length);
      expect(pages.size).toBe(54 + 476);
      expect([...pages.values()].every(c => app.canFollow(c.kind, c.key))).toBe(true);
      expect(Math.min(...sizes)).toBe(1);
      expect(sizes.filter(n => n === 1)).toHaveLength(304);
    });
    it("40 events draw two chips with the same words, a track and a work: Star Wars on 35, Artemis Spaceship Bridge Simulator on 5", () => {
      const twins = all.flatMap(e => { const seen = new Set(); return app.chipsOf(e).filter(c => seen.has(c.label) || !seen.add(c.label)).map(c => c.label); });
      expect(tally(twins, w => w)).toEqual({ "Star Wars": 35, "Artemis Spaceship Bridge Simulator": 5 });
    });
    it("a twin pair on a sheet: two buttons, two names, two pages", () => {
      const ev = all.find(e => { const c = app.chipsOf(e); return c.length === 2 && c[0].label === "Star Wars" && c[1].label === "Star Wars"; });
      handle.openSheet("event", ev.id);
      const taps = [...document.querySelectorAll("#panel-event .tagline .tag-tap")];
      expect(taps.map(b => [b.textContent, b.dataset.explore, b.getAttribute("aria-label")])).toEqual([["Star Wars", "track:Star Wars", "Star Wars, track"], ["Star Wars", "work:star-wars", "Star Wars, fandom"]]);
    });
    it("an unreviewed work's chip on a sheet: plain, and its tap does nothing", () => {
      const ev = all.find(e => app.chipsOf(e).some(c => c.key === "brandish"));
      handle.openSheet("event", ev.id);
      const plain = document.querySelector("#panel-event .tagline .tag.plain");
      expect([plain.tagName, plain.textContent, plain.closest("button")]).toEqual(["SPAN", app.worksById.get("brandish").name, null]);
      plain.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect([document.getElementById("sheetWrap").hidden, state.sheetId, state.tab]).toEqual([false, ev.id, "now"]);
    });
  });

  /* Getting in (DECISIONS #77): the counts its design was settled on, from
     the committed schedule. New tests, not rows of tests/PORT-LEDGER.md. */
  /* For you (W3; DECISIONS #87) on the real schedule: what scores and what
     is chosen, asked of foryou.js at a moment handed in. The reader is the
     design sketch's: nine picks, Star Trek and Sean Astin followed. */
  describe("For you, on 2026's schedule", () => {
    const SKETCH = ["6ecc75745a676d39f2300556239d62d0", "c32d19e7750818e0eb903f152ac43c0e", "c32d19e7750818e0eb903f152ad81594",
      "c32d19e7750818e0eb903f152ad84b6f", "1e3995157984a4c0e6515a2ed631ee27", "c32d19e7750818e0eb903f152ac06f6f",
      "c32d19e7750818e0eb903f152ac72ab7", "c32d19e7750818e0eb903f152ac14835", "6ecc75745a676d39f230055623a7291a"];
    const BEFORE = new Date("2026-08-28T10:00");
    const unmute = () => app.mutes.slice().forEach(m => app.toggleMute(m.kind, m.key));
    const says = r => `${r.reason.follow ? "You follow" : "Like your picks:"} ${r.reason.name}`;
    const sessionOf = e => (e.facets || {}).repeat_key || `title:${e.title}`;
    afterAll(() => { unmute(); handle.picks.set([]); handle.follows.set([]); });

    describe("the sketch's reader, before the con", () => {
      let rows, events, picked;
      beforeAll(() => {
        unmute(); handle.picks.set(SKETCH); handle.follows.set([{ kind: "work", key: "star-trek" }, { kind: "person", key: "sean-astin" }]);
        rows = app.forYou(BEFORE); events = rows.map(r => app.byId.get(r.id)); picked = SKETCH.map(id => app.byId.get(id));
      });

      it("the nine picks are the schedule's, and Dot R Steverson is on two of them", () => {
        expect(picked.every(Boolean)).toBe(true);
        expect(picked.filter(e => (e.people || []).some(p => p.id === "dot-r-steverson")).length).toBe(2);
      });
      it("eight rows, in time order, each with a reason that has a name", () => {
        expect(rows.length).toBe(8);
        expect(chronological(events)).toBe(true);
        rows.forEach(r => { expect(r.reason.name).toBeTruthy(); expect(r.score).toBeGreaterThan(0); });
      });
      it("by both ways of guessing: some by a follow, some by the picks", () => {
        expect([rows.some(r => r.reason.follow), rows.some(r => !r.reason.follow)]).toEqual([true, true]);
      });
      it("none a pick, and none another session of one", () => {
        const sessions = new Set(picked.map(sessionOf));
        events.forEach(e => { expect(SKETCH).not.toContain(e.id); expect(sessions.has(sessionOf(e)), e.title).toBe(false); });
      });
      it("none overlapping a pick, but a pick of more than four hours", () => {
        const blocking = picked.filter(p => p._e - p._s <= 240 * 60000);
        events.forEach(e => blocking.forEach(p => expect(e._s < p._e && p._s < e._e, `${e.title} / ${p.title}`).toBe(false)));
      });
      it("at most two rows say one reason, and no two are sessions of one thing", () => {
        const count = new Map();
        rows.forEach(r => count.set(says(r), (count.get(says(r)) || 0) + 1));
        expect(Math.max(...count.values())).toBeLessThanOrEqual(2);
        expect(new Set(events.map(sessionOf)).size).toBe(8);
      });
      it("no person is a reason by stars - no Dot R Steverson - and a person is one only by a follow", () => {
        rows.forEach(r => { if (r.reason.kind === "person") expect([r.reason.follow, r.reason.key]).toEqual([true, "sean-astin"]); });
        expect(rows.map(r => r.reason.key)).not.toContain("dot-r-steverson");
      });
      it("no photo op, no signing, nothing cancelled, nothing on the noise tracks alone", () => {
        events.forEach(e => {
          expect(["photo", "signing"]).not.toContain(app.tagsOf(e).kind);
          expect(!!e.cancelled).toBe(false);
          expect((e.tracks || []).length > 0 && e.tracks.every(t => app.NOISE_TRACKS.has(t))).toBe(false);
        });
      });
    });

    /* One Star Wars pick, nothing followed, at the minute before the one
       Andor event starts: it is then the first of Star Wars' events left. */
    describe("a muted fandom mutes the fandoms under it", () => {
      let andor, at;
      const starWars = e => app.linkedWorks(e).has("star-wars");
      const offered = () => app.forYou(at).map(r => app.byId.get(r.id));
      beforeAll(() => {
        andor = handle.events.find(e => app.linkedWorks(e).has("andor"));
        at = new Date(andor._s.getTime() - 60000);
        const pick = handle.events.find(e => starWars(e) && !app.linkedWorks(e).has("andor") && e._e <= at && !["photo", "signing"].includes(app.tagsOf(e).kind));
        handle.picks.set([pick.id]); handle.follows.set([]);
      });

      it("nothing muted: the Andor event is offered, for Star Wars, which it carries", () => {
        unmute();
        const rows = app.forYou(at);
        expect(rows.map(r => r.id)).toContain(andor.id);
        expect(rows.find(r => r.id === andor.id).reason).toEqual({ kind: "work", key: "star-wars", name: "Star Wars", follow: false });
      });
      it("Star Wars muted: no Andor event, and no Star Wars event", () => {
        unmute(); app.toggleMute("work", "star-wars");
        expect(offered().filter(starWars)).toEqual([]);
      });
      it("Andor muted: no Andor event, and Star Wars is still offered", () => {
        unmute(); app.toggleMute("work", "andor");
        const got = offered();
        expect(got.map(e => e.id)).not.toContain(andor.id);
        expect(got.filter(starWars).length).toBe(2);
      });
    });

    it("what the follows signal finds for a follow is what eventsFor() lists for it: every track, fandom, topic and person of the schedule", () => {
      unmute(); handle.picks.set([]);
      const cat = app.getCatalogue();
      const things = [...cat.track.map(t => ({ kind: "track", key: t.key })), ...cat.fandom.map(t => ({ kind: "work", key: t.key })),
        ...cat.topic.map(t => ({ kind: "axis", key: t.key })), ...cat.person.map(t => ({ kind: "person", key: t.key }))];
      expect(things.length).toBeGreaterThan(600);
      /* Twenty follows a profile: an event is found for a follow where the signal names that follow on it. */
      for (let i = 0; i < things.length; i += 20) {
        const some = things.slice(i, i + 20);
        handle.follows.set(some);
        const p = app.profile(), found = new Map(some.map(f => [`${f.kind}:${f.key}`, []]));
        handle.events.forEach(e => { const got = []; app.SIGNALS.follows(e, p, got); got.forEach(f => found.get(f.thing).push(e.id)); });
        some.forEach(f => expect(found.get(`${f.kind}:${f.key}`), `${f.kind}:${f.key}`).toEqual(app.eventsFor(f).map(e => e.id)));
      }
      handle.follows.set([]);
    });
  });

  /* The big ones (W16; DECISIONS #88) on the real schedule: Main
     Programming's celebrity events still to start, asked of foryou.js at a
     moment handed in, for a reader with nothing starred or followed. */
  describe("The big ones, on 2026's schedule", () => {
    const BEFORE = new Date("2026-08-28T10:00"), SATURDAY = new Date("2026-09-05T13:05"), AFTER = new Date("2026-09-09T12:00");
    const sessionOf = e => (e.facets || {}).repeat_key || `title:${e.title}`;
    const big = at => app.bigOnes(at).map(id => app.byId.get(id));
    const stranger = () => { app.mutes.slice().forEach(m => app.toggleMute(m.kind, m.key)); handle.picks.set([]); handle.follows.set([]); };
    beforeAll(stranger);
    afterAll(stranger);

    it("23 before the con, soonest first and then by id, and the first four", () => {
      const list = big(BEFORE);
      expect(list.length).toBe(23);
      expect(list.slice(0, 4).map(e => e.title)).toEqual(["WABE: Imagined Worlds, Real Nation \u2013 40 Years of Fandom & America at 250",
        "Dragon Con Wrestling", "The Rookie Cast", "The Life and Times of Sean Astin"]);
      expect(list.every((e, i) => i === 0 || +list[i - 1]._s < +e._s || (+list[i - 1]._s === +e._s && list[i - 1].id < e.id))).toBe(true);
    });
    it("12 at Saturday 1:05 PM, every one still to start, and the first two", () => {
      const list = big(SATURDAY);
      expect(list.length).toBe(12);
      expect(list.slice(0, 2).map(e => e.title)).toEqual(["The Rookie Guests", "Gina Torres - Big Damn Hero!"]);
      expect(list.every(e => e._s > SATURDAY)).toBe(true);
    });
    it("none once the con is over", () => {
      expect(big(AFTER)).toEqual([]);
    });
    it("each a celebrity event on Main Programming, none cancelled, none a photo op or a signing, and one session each", () => {
      for (const at of [BEFORE, SATURDAY]) {
        const list = big(at);
        list.forEach(e => {
          expect([e.tracks.includes("Main Programming"), app.isCeleb(e), !!e.cancelled], e.title).toEqual([true, true, false]);
          expect(["photo", "signing"]).not.toContain(app.tagsOf(e).kind);
        });
        expect(new Set(list.map(sessionOf)).size).toBe(list.length);
      }
    });
    it("the one event of the 24 left out before the con is a second session of one that is in", () => {
      const all = handle.events.filter(e => (e.tracks || []).includes("Main Programming") && app.isCeleb(e));
      const list = big(BEFORE), out = all.filter(e => !list.includes(e));
      expect([all.length, out.length]).toEqual([24, 1]);
      expect(list.map(sessionOf)).toContain(sessionOf(out[0]));
    });
    it("with one of them starred and nothing else, For you has no row for 16 of the 23, and for 9 of the 12", () => {
      const empty = at => {
        handle.picks.set([]);
        const none = big(at).filter(e => { handle.picks.set([e.id]); return app.forYou(at).length === 0; }).length;
        handle.picks.set([]);
        return none;
      };
      expect([empty(BEFORE), empty(SATURDAY)]).toEqual([16, 9]);
    });
  });

  describe("Getting in, on 2026's schedule", () => {
    const el = id => document.getElementById(id);
    const texts = id => [...el(id).options].map(o => o.textContent);
    const choose = (id, value) => { const s = el(id); s.value = value; s.dispatchEvent(new Event("change", { bubbles: true })); };
    const says = () => el("filtersShow").textContent;
    beforeAll(() => { handle.closeSheet(); state.explore.page = null; app.setExploreHash(null); state.tab = "browse"; search(""); handle.render(); el("filtersBtn").click(); });
    afterAll(() => { handle.closeSheet(); search(""); state.tab = "now"; handle.render(); });

    it("the options: a count on those that name something an event has - 214 with a fee, 112 with a sign-up, 88 for kids, 105 that are 18+", () => {
      expect(texts("filterCost")).toEqual(["Any cost", "No extra fee", "Extra fee (214)"]);
      expect(texts("filterSignup")).toEqual(["Any sign-up", "No sign-up", "Sign-up (112)"]);
      expect(texts("filterAudience")).toEqual(["Any audience", "Kids (88)", "No 18+", "18+ (105)"]);
      expect(texts("filterSoldOut")).toEqual(["Sold out or not", "Not sold out"]);
    });
    it("each value over every event: 3,245 with no fee and 214 with one; 3,347 with no sign-up and 112 with one; 88 for kids, 3,354 not 18+ and 105 that are; 3,440 not sold out", () => {
      const n = (dim, value) => handle.events.filter(e => app.passesGettingIn(e, dim, value)).length;
      expect(handle.events).toHaveLength(3459);
      expect([n("cost", "no"), n("cost", "yes"), n("signup", "no"), n("signup", "yes")]).toEqual([3245, 214, 3347, 112]);
      expect([n("audience", "kids"), n("audience", "no-adult"), n("audience", "adult"), n("soldOut", "no")]).toEqual([88, 3354, 105, 3440]);
    });
    it("Kids is the audience, not the Kids Track: 88 events, 47 of them in the track's 48", () => {
      const kids = handle.events.filter(e => app.passesGettingIn(e, "audience", "kids"));
      expect(kids.filter(e => (e.tracks || []).includes("Kids Track"))).toHaveLength(47);
      expect(kids.filter(e => app.isNoise(e))).toHaveLength(22);
    });
    it.each([
      ["filterCost", "no", "Show 2,839 events"], ["filterCost", "yes", "Show 214 events"],
      ["filterSignup", "no", "Show 2,941 events"], ["filterSignup", "yes", "Show 112 events"],
      ["filterAudience", "kids", "Show 66 events"], ["filterAudience", "no-adult", "Show 2,948 events"], ["filterAudience", "adult", "Show 105 events"],
      ["filterSoldOut", "no", "Show 3,034 events"],
    ])("%s at %s: the main button counts what the list holds with photo sessions hidden - %s", (id, value, words) => {
      choose(id, value);
      expect(says()).toBe(words);
      expect(app.browseResults()).toHaveLength(Number(words.replace(/\D/g, "")));
      choose(id, "All");
      expect(says()).toBe("Show 3,053 events");
    });
    it("each of the four agrees with a row's flags on every event, but for the one mature event whose listing states 16: 18+ under a row that says 16+", () => {
      const off = [];
      for (const e of handle.events) {
        const flags = app.flagsOf(e), has = key => flags.some(f => f.key === key), age = (flags.find(f => f.key === "age") || {}).label;
        if (app.passesGettingIn(e, "cost", "yes") !== has("cost")) off.push(["cost", e.title]);
        if (app.passesGettingIn(e, "signup", "yes") !== has("signup")) off.push(["signup", e.title]);
        if (app.passesGettingIn(e, "soldOut", "no") === has("sold_out")) off.push(["soldOut", e.title]);
        if (app.passesGettingIn(e, "audience", "kids") !== has("kids")) off.push(["kids", e.title]);
        if (app.passesGettingIn(e, "audience", "adult") !== (parseInt(age, 10) >= 17)) off.push(["18+", e.title, age]);
      }
      expect(off).toEqual([["18+", "Puppetry 101 - Adults", "16+"]]);
    });
    it("the two rows that say an age and are not 18+: a 13+ for kids and a 16+", () => {
      const aged = handle.events.filter(e => app.flagsOf(e).some(f => f.key === "age") && !app.isAdult(e));
      expect(aged.map(e => [e.title, app.flagsOf(e).map(f => f.label).join(", ")]).sort()).toEqual([
        ["Modded Kids Among Us in Real Life (Ages 13+)", "13+, Kids"], ["Troika: Slate & Chalcedony", "16+"]]);
    });
  });

  /* The building's model (DECISIONS #94) on the real files: 2027's level
     drawings, which a build for 2026 borrows, and 2026's schedule. The
     counts are the committed files': a level drawn or a room added moves
     them, and the pull request that does it says so here. New tests, not
     rows of tests/PORT-LEDGER.md. */
  describe("the building's model, on 2027's drawings and 2026's schedule", () => {
    const SAT = "2026-09-05";
    const DRAWN = ["Marriott", "Hyatt", "Hilton", "Courtland Grand", "Westin"], MART = ["AmericasMart Building 2", "AmericasMart Building 3"];
    const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "2027", "drawings");
    const tally = (list, key) => list.reduce((by, x) => ({ ...by, [key(x)]: (by[key(x)] || 0) + 1 }), {});
    const states = hotel => app.building(hotel).plates.map(p => (p.drawn ? "drawn" : p.inert ? "inert" : "not drawn"));

    it("a build for 2026 is given 2027's twenty drawings, each file's geometry and nothing else: 191 rooms and the Concourse", () => {
      const geometry = ["hotel", "level", "extent", "rooms", "composites", "groups", "open", "landmarks", "streets"];
      const files = fs.readdirSync(folder).filter(f => f.endsWith(".json")).sort().map(f => JSON.parse(fs.readFileSync(path.join(folder, f), "utf8")));
      expect([YEAR, fs.existsSync(path.join(folder, "..", "..", "2026", "drawings")), files.length]).toEqual([2026, false, 20]);
      expect(DRAWINGS.map(d => Object.keys(d))).toEqual(files.map(() => geometry));
      expect(DRAWINGS).toEqual(files.map(d => Object.fromEntries(geometry.map(key => [key, d[key]]))));
      expect(files.every(d => ["sources", "notes", "units", "north", "anchors"].every(key => key in d))).toBe(true);
      expect(DRAWINGS.flatMap(d => d.rooms)).toHaveLength(191);
      expect(DRAWINGS.flatMap(d => d.open.filter(a => "id" in a).map(a => [d.hotel, d.level, a.id]))).toEqual([["Hyatt", "exhibit", "Concourse"]]);
    });
    it("seven venues have a building, in the hotels' order; the park, the streams and the offsite venues have none", () => {
      expect(app.BUILDINGS).toEqual([...DRAWN, ...MART]);
      expect(["Hardy Ivy Park", "Streaming", "Other", "Unknown"].map(hotel => app.building(hotel))).toEqual([null, null, null, null]);
    });
    it("the plates, one a storey: the Marriott's 4, the Hyatt's 4, the Hilton's 5, the Courtland Grand's 3, the Westin's 5, and the Mart's 4 and 2, none of them drawn", () => {
      expect(Object.fromEntries(app.BUILDINGS.map(hotel => [hotel, states(hotel)]))).toEqual({
        Marriott: ["drawn", "drawn", "drawn", "drawn"],
        Hyatt: ["drawn", "drawn", "drawn", "inert"],
        Hilton: ["drawn", "drawn", "drawn", "drawn", "drawn"],
        "Courtland Grand": ["drawn", "drawn", "drawn"],
        Westin: ["drawn", "drawn", "drawn", "not drawn", "not drawn"],
        "AmericasMart Building 2": ["not drawn", "not drawn", "not drawn", "not drawn"],
        "AmericasMart Building 3": ["not drawn", "not drawn"],
      });
      expect(app.building("Westin").plates.slice(3).map(p => p.name)).toEqual(["12th Floor", "14th Floor"]);
      expect(app.BUILDINGS.flatMap(hotel => app.building(hotel).plates.flatMap(p => p.levels.map(level => level.id))).filter(id => id.includes("+"))).toEqual([]);
    });
    it("the Hyatt's Exhibit and Ballroom Levels each share a plate with a level of the International Tower, and its Lobby Level is inert", () => {
      const plates = app.building("Hyatt").plates;
      expect(plates.map(p => [p.key, p.short])).toEqual([["acc", "Conference Center"], ["exhibit+tower-ll2", "Exhibit Level + Intl Tower LL2"],
        ["ballroom+tower-ll1", "Ballroom Level + Intl Tower LL1"], ["lobby", "Lobby Level"]]);
      expect(plates.map(p => p.name).slice(1, 3)).toEqual(["Exhibit Level (LL2) + International Tower · LL2", "Ballroom Level (LL1) + International Tower · LL1"]);
      expect(plates.slice(1, 3).map(p => [...new Set(p.rooms.map(r => r.level))])).toEqual([["exhibit", "tower-ll2"], ["ballroom", "tower-ll1"]]);
      expect([plates[3].inert, plates[3].levels[0].rooms, app.levelEvents("Hyatt", "lobby")]).toEqual([true, [], []]);
    });
    it("each drawn venue's hull holds every corner of every room and open area, padded 10 ft, inside the venue's frame and the pad; the Mart's two buildings have none", () => {
      /* how far a point stands outside a ring, in feet: 0 where it is inside or on it. The ring's sense is its area's sign. */
      const outside = (hull, [x, y]) => {
        const next = i => hull[(i + 1) % hull.length], sense = Math.sign(hull.reduce((sum, a, i) => sum + a[0] * next(i)[1] - next(i)[0] * a[1], 0));
        return Math.max(0, ...hull.map((a, i) => -sense * ((next(i)[0] - a[0]) * (y - a[1]) - (next(i)[1] - a[1]) * (x - a[0])) / Math.hypot(next(i)[0] - a[0], next(i)[1] - a[1])));
      };
      const padded = r => {
        const t = r.rot * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
        return [[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([i, j]) => {
          const x = r.cx + i * r.w / 2 * c - j * r.h / 2 * s, y = r.cy + i * r.w / 2 * s + j * r.h / 2 * c;
          return [[x - 10, y - 10], [x + 10, y - 10], [x + 10, y + 10], [x - 10, y + 10]];
        });
      };
      for (const hotel of DRAWN) {
        const { hull, plates } = app.building(hotel), { w, h } = DRAWINGS.find(d => d.hotel === hotel).extent;
        const shapes = plates.flatMap(p => [...p.rooms, ...p.open]);
        expect(shapes.filter(r => padded(r).some(point => outside(hull, point) > 1e-6)).map(r => r.id || r.name), hotel).toEqual([]);
        expect(hull.filter(point => !shapes.some(r => padded(r).some(([x, y]) => Math.hypot(x - point[0], y - point[1]) < 1e-6))), hotel).toEqual([]);
        expect(hull.filter(([x, y]) => x < -10.05 || x > w + 10.05 || y < -10.05 || y > h + 10.05), hotel).toEqual([]);
        /* and no point of it lies on a side: two walls on one line, a rounding apart, are one side */
        const turn = i => { const [o, a, b] = [hull[i], hull[(i + 1) % hull.length], hull[(i + 2) % hull.length]]; return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); };
        expect(hull.map((_, i) => Math.abs(turn(i))).filter(t => t < 1e-6), hotel).toEqual([]);
      }
      expect(MART.map(hotel => app.building(hotel).hull)).toEqual([null, null]);
    });
    it("2,123 of the 3,459 events reach a room; 1,053 stop at a floor, 162 at the venue and 121 have no building; none stops at a level", () => {
      expect(handle.events).toHaveLength(3459);
      expect(tally(handle.events, e => app.depthOf(e).depth)).toEqual({ room: 2123, floor: 1053, venue: 162, nothing: 121 });
      expect(tally(handle.events.filter(e => app.depthOf(e).depth === "floor"), e => e.hotel)).toEqual({ "AmericasMart Building 3": 845, "AmericasMart Building 2": 188, Westin: 20 });
      expect(tally(handle.events.filter(e => app.depthOf(e).depth === "nothing"), e => e.hotel)).toEqual({ "Hardy Ivy Park": 36, Streaming: 62, Other: 23 });
    });
    it("a pick in International Hall South lights International 4 to 10, and each of the seven lists the hall's 318 events, booked as the hall", () => {
      const pick = handle.events.find(e => e.rooms.includes("International Hall South") && e._cd === SAT);
      const leaves = [10, 9, 8, 7, 6, 5, 4].map(n => `International ${n}`);
      expect(app.depthOf(pick)).toEqual({ depth: "room", plate: "international", level: "international", rooms: leaves });
      const row = app.dayLights("Marriott", SAT, new Set([pick.id]))[0];
      expect([row.key, row.picks, row.lit]).toEqual(["international", 1, leaves.map(id => ({ level: "international", id }))]);
      expect(leaves.map(id => tally(app.roomEvents("Marriott", "international", id), x => x.as))).toEqual(leaves.map(() => ({ "International Hall South": 318 })));
      expect(app.roomEvents("Marriott", "international", "International Hall South")).toEqual([]);
    });
    it("the Concourse is lit as a place: an open area with an id, on the Hyatt's Exhibit Level", () => {
      const pick = handle.events.find(e => e.rooms.includes("Concourse"));
      expect(app.depthOf(pick)).toEqual({ depth: "room", plate: "exhibit+tower-ll2", level: "exhibit", rooms: ["Concourse"] });
      const row = app.dayLights("Hyatt", pick._cd, new Set([pick.id]))[1];
      expect([row.key, row.picks, row.lit]).toEqual(["exhibit+tower-ll2", 1, [{ level: "exhibit", id: "Concourse" }]]);
      expect(app.roomEvents("Hyatt", "exhibit", "Concourse")).toHaveLength(30);
    });
    it("2026's two cancelled events are in their level's list, and are neither lit nor counted", () => {
      const off = handle.events.filter(e => e.cancelled);
      expect(off.map(e => [e.hotel, e.level, e._cd, app.depthOf(e).depth])).toEqual([["Courtland Grand", "f3", SAT, "room"], ["Courtland Grand", "f3", "2026-09-06", "room"]]);
      for (const e of off) {
        const listed = app.levelEvents(e.hotel, e.level), row = app.dayLights(e.hotel, e._cd, new Set([e.id]))[2];
        expect(listed).toContain(e);
        expect([row.key, row.picks, row.lit]).toEqual(["f3", 0, []]);
        expect(row.events).toBe(listed.filter(x => x._cd === e._cd).length - 1);
      }
    });
    it("a plate with no drawing has its day's count: on Saturday, 107 and 118 on the two floors of the Mart's Building 3", () => {
      expect(app.dayLights("AmericasMart Building 3", SAT, new Set()).map(row => [row.key, row.picks, row.lit, row.events])).toEqual([["f1", 0, [], 107], ["f2", 0, [], 118]]);
    });
    it("the lists hold the schedule: every event at a venue, and on each level every event that names it", () => {
      for (const hotel of app.BUILDINGS) {
        const at = handle.events.filter(e => e.hotel === hotel);
        expect(app.venueEvents(hotel), hotel).toEqual(at);
        for (const level of app.building(hotel).plates.flatMap(p => p.levels)) expect(app.levelEvents(hotel, level.id), `${hotel} ${level.id}`).toEqual(at.filter(e => e.level === level.id));
      }
      expect(app.venueEvents("Hardy Ivy Park")).toHaveLength(36);
    });
  });

  /* The stack (DECISIONS #95) on the real files: how each of the seven
     venues stands in the Map's frame, in the Map's own units, and the words
     a card's row says for a room on 2026's schedule. The numbers are the
     committed files': a level drawn or a venue's floors changed moves them,
     and the pull request that does it says so here. New tests, not rows of
     tests/PORT-LEDGER.md. */
  describe("the stack, on 2027's drawings and 2026's schedule", () => {
    /* The frame is the Map's own, read from the drawing it draws in: a frame that grows moves these numbers with it. */
    let drawn = null;
    const frame = () => {
      if (!drawn) { app.renderMap(); const [x, y, w, h] = document.querySelector("#view-map svg.map").getAttribute("viewBox").split(" ").map(Number); drawn = { x, y, w, h }; }
      return drawn;
    };
    const tenth = v => Math.round(v * 10) / 10;
    const laid = hotel => { const made = app.building(hotel); return app.stackLayout(made.hull || app.blockOutline(app.MAP_HOTELS[hotel]), made.plates.length, frame()); };
    const tally = (list, key) => list.reduce((by, x) => ({ ...by, [key(x)]: (by[key(x)] || 0) + 1 }), {});

    it("each venue's plates, their width and the strip under each: 40 everywhere but at the Hilton, whose five floors leave 31.7 at the least width a plate may have", () => {
      expect(app.BUILDINGS.map(hotel => [hotel, app.building(hotel).plates.length, tenth(laid(hotel).wide), tenth(laid(hotel).strip)])).toEqual([
        ["Marriott", 4, 312.7, 40], ["Hyatt", 4, 254.5, 40], ["Hilton", 5, 211.8, 31.7], ["Courtland Grand", 3, 300.2, 40], ["Westin", 5, 320.9, 40],
        ["AmericasMart Building 2", 4, 300.7, 40], ["AmericasMart Building 3", 2, 300.7, 40]]);
      expect(tenth(laid("Hilton").wide)).toBe(tenth(app.MIN_WIDE * frame().w));
      expect(frame()).toEqual({ x: -3, y: 111, w: 385, h: 305 });
    });
    it("every plate of every venue stands inside the frame's margins, clear of the way back", () => {
      const FRAME = frame();
      for (const hotel of app.BUILDINGS) {
        for (const box of laid(hotel).plates) {
          expect([box.x0 >= FRAME.x + app.MARGIN.l - 1e-6, box.x1 <= FRAME.x + FRAME.w - app.MARGIN.r + 1e-6, box.y0 >= FRAME.y + app.MARGIN.t - 1e-6, box.y1 <= FRAME.y + FRAME.h - app.MARGIN.b + 1e-6], hotel)
            .toEqual([true, true, true, true]);
        }
      }
    });
    it("the Mart's two buildings have no drawing: each plate is its block's own shape, 72 by 50 on the Map", () => {
      for (const hotel of ["AmericasMart Building 2", "AmericasMart Building 3"]) {
        expect([app.building(hotel).hull, app.blockOutline(app.MAP_HOTELS[hotel])]).toEqual([null, [[0, 0], [72, 0], [72, 50], [0, 50]]]);
      }
    });
    it("the words a card's row says for a room: of the 3,176 events on a building's level, 2,195 name rooms; 116 are a booth in one of the Mart's vendor halls, every one with words after its floor; and the 865 others, whose room only repeats their floor, say nothing", () => {
      const on = handle.events.filter(e => !!app.depthOf(e).plate), none = on.filter(e => !e.rooms.length), booths = none.filter(e => /Vendor Hall/.test(e.room));
      expect([on.length, on.length - none.length, booths.length, none.length - booths.length]).toEqual([3176, 2195, 116, 865]);
      expect(on.filter(e => e.rooms.length).every(e => app.roomWords(e) === e.rooms.join(" + "))).toBe(true);
      expect(booths.every(e => /^Mart2 Vendor Hall Floor [123] \S/.test(e.room) && app.roomWords(e).length > 0 && e.room.endsWith(` ${app.roomWords(e)}`) && !/Vendor Hall|Mart2/.test(app.roomWords(e)))).toBe(true);
      expect(tally(booths, e => e.level)).toEqual({ f1: 66, f2: 19, f3: 31 });
      const others = none.filter(e => !booths.includes(e));
      expect(others.every(e => app.roomWords(e) === "")).toBe(true);
      expect(tally(others, e => e.room)).toEqual({ "Mart Building 3, Floor 2": 463, "Mart Building 3, Floor 1": 382, "14th Floor": 12, "12th Floor": 8 });
    });
  });

  /* The level (DECISIONS #96) on the real files: the 18 level views as they
     stand in the Map's frame, in the Map's own units - each one's scale, how
     many of its rooms are too small to see, what its rooms are called at the
     fit - and that every room 2026's schedule reaches can be reached and
     selected. The numbers are the committed files' and the design's: a level
     drawn, a margin or the least label changed moves them, and the pull
     request that does it says so here. New tests, not rows of
     tests/PORT-LEDGER.md. */
  describe("the level, on 2027's drawings and 2026's schedule", () => {
    let drawn = null;
    const frame = () => {
      if (!drawn) { app.renderMap(); const [x, y, w, h] = document.querySelector("#view-map svg.map").getAttribute("viewBox").split(" ").map(Number); drawn = { x, y, w, h }; }
      return drawn;
    };
    const views = () => app.BUILDINGS.flatMap(hotel => app.building(hotel).plates.filter(p => p.drawn).map(plate => ({ hotel, plate, fit: app.levelFit(plate, frame()), places: app.levelPlaces(plate) })));
    const hundredth = v => Math.round(v * 100) / 100;

    it("18 level views of the 20 drawings: the Hyatt's five drawn levels are three plates, two of them shared - 191 rooms and the Concourse", () => {
      expect([DRAWINGS.length, views().length, views().filter(v => v.plate.levels.length > 1).map(v => v.plate.key)]).toEqual([20, 18, ["exhibit+tower-ll2", "ballroom+tower-ll1"]]);
      const rooms = new Set(views().flatMap(v => v.plate.rooms));
      expect([rooms.size, views().flatMap(v => v.places).filter(r => !rooms.has(r)).map(r => r.id)]).toEqual([191, ["Concourse"]]);
    });
    it("each view's scale, in the Map's units a foot, its places and how many are under 44 across at its fit: 178 of 192", () => {
      expect(views().map(v => [app.hotelShort(v.hotel), v.plate.key, hundredth(v.fit.scale), v.places.length, v.places.filter(r => app.isSmall(r, v.fit.scale)).length])).toEqual([
        ["Marriott", "international", 0.74, 13, 13], ["Marriott", "marquis", 0.53, 12, 11], ["Marriott", "lobby", 1.78, 6, 4], ["Marriott", "atrium", 0.7, 10, 8],
        ["Hyatt", "acc", 0.95, 20, 20], ["Hyatt", "exhibit+tower-ll2", 0.54, 25, 25], ["Hyatt", "ballroom+tower-ll1", 0.54, 10, 10],
        ["Hilton", "galleria", 0.78, 8, 8], ["Hilton", "l1", 0.42, 6, 6], ["Hilton", "l2", 0.56, 19, 19], ["Hilton", "l3", 0.63, 15, 15], ["Hilton", "l4", 1.54, 7, 7],
        ["Courtland", "f1", 0.98, 8, 6], ["Courtland", "f2", 0.88, 3, 3], ["Courtland", "f3", 1.26, 6, 2],
        ["Westin", "f6", 0.9, 10, 9], ["Westin", "f7", 0.95, 11, 10], ["Westin", "f8", 0.91, 3, 2]]);
      const all = views().flatMap(v => v.places.map(r => app.isSmall(r, v.fit.scale)));
      expect([all.length, all.filter(Boolean).length]).toEqual([192, 178]);
      expect(frame()).toEqual({ x: -3, y: 111, w: 385, h: 305 });
    });
    it("what its rooms are called at the fit: of the 191, a full name at 11 or more for 20, a full name under 11 for 27 that have no short one, a short name for 94 and no label for 50", () => {
      const said = v => {
        const names = app.shortNames(v.plate), count = [0, 0, 0, 0];
        for (const room of v.plate.rooms) { const label = app.roomLabel(room, names, v.fit.scale); count[!label ? 3 : label.short ? 2 : label.size >= app.FULL ? 0 : 1]++; }
        return count;
      };
      expect(views().map(v => [v.plate.key, ...said(v)])).toEqual([
        ["international", 0, 0, 13, 0], ["marquis", 0, 1, 6, 5], ["lobby", 6, 0, 0, 0], ["atrium", 4, 2, 3, 1],
        ["acc", 2, 3, 0, 15], ["exhibit+tower-ll2", 0, 0, 15, 9], ["ballroom+tower-ll1", 0, 0, 9, 1],
        ["galleria", 0, 0, 8, 0], ["l1", 0, 0, 0, 6], ["l2", 0, 7, 6, 6], ["l3", 0, 11, 0, 4], ["l4", 7, 0, 0, 0],
        ["f1", 0, 1, 5, 2], ["f2", 1, 2, 0, 0], ["f3", 0, 0, 6, 0], ["f6", 0, 0, 9, 1], ["f7", 0, 0, 11, 0], ["f8", 0, 0, 3, 0]]);
      expect(views().map(said).reduce((sum, c) => sum.map((n, i) => n + c[i]), [0, 0, 0, 0])).toEqual([20, 27, 94, 50]);
      expect([app.FULL, app.LEAST]).toEqual([11, 8]);
      /* And every label the level draws is one of these, with every open area's name that fits and every group's that is said: level.js says them all at once. */
      const drawn = views().map(v => app.levelLabels(v.plate, v.fit.scale));
      expect([drawn.reduce((n, l) => n + l.rooms.length, 0), drawn.reduce((n, l) => n + l.open.length, 0), drawn.reduce((n, l) => n + l.groups.length, 0), drawn.flatMap(l => l.landmarks).filter(l => l.name).length])
        .toEqual([141, 18, 28, 5]);
    });
    it("every level stands inside the frame's margins, clear of the way back - 20, 20, 72 and 30 of the Map's units - and as large as they allow", () => {
      const f = frame(), m = app.LEVEL_MARGIN;
      expect(m).toEqual({ l: 20, r: 20, t: 72, b: 30 });
      for (const v of views()) {
        const box = app.bounds([...v.plate.rooms, ...v.plate.open].flatMap(app.corners).map(([x, y]) => [v.fit.tx + v.fit.scale * x, v.fit.ty + v.fit.scale * y]));
        expect([box.x0 >= f.x + m.l - 1e-6, box.x1 <= f.x + f.w - m.r + 1e-6, box.y0 >= f.y + m.t - 1e-6, box.y1 <= f.y + f.h - m.b + 1e-6], `${v.hotel} ${v.plate.key}`).toEqual([true, true, true, true]);
        expect(Math.min(Math.abs(box.w - (f.w - m.l - m.r)), Math.abs(box.h - (f.h - m.t - m.b))), `${v.hotel} ${v.plate.key}`).toBeLessThan(1e-6);
      }
    });
    it("the zoom brings 177 of the 178 small places to 62 across, between 0.76 and 5.39 units a foot - the cap of 7 is never met on these drawings - and the Marriott's Atrium Ballroom C, 23 ft by 110, to where it fits the frame, 50 across (#98)", () => {
      const zooms = views().flatMap(v => v.places.filter(r => app.isSmall(r, v.fit.scale)).map(r => ({ r, v, z: app.zoomScale(r, v.fit.scale, frame()) })));
      expect([zooms.length, hundredth(Math.min(...zooms.map(x => x.z))), hundredth(Math.max(...zooms.map(x => x.z))), zooms.filter(x => x.z >= app.ZOOM_CAP).length]).toEqual([178, 0.76, 5.39, 0]);
      const short = zooms.filter(x => Math.abs(Math.min(x.r.w, x.r.h) * x.z - 62) > 1e-6);
      expect(short.map(x => [x.v.plate.key, x.r.id, hundredth(Math.min(x.r.w, x.r.h) * x.z), hundredth(Math.max(x.r.w, x.r.h) * x.z), x.z === app.zoomFits(x.r, frame())])).toEqual([["atrium", "Atrium Ballroom C", 50.39, 241, true]]);
      for (const { r, v, z } of zooms) expect(z > v.fit.scale, `${v.plate.key} ${r.id}`).toBe(true);
    });
    /* The zoom's one rule (#98), over every scale a level's camera can come
       to - a room's own zoom from the fit, and every room tapped after it,
       and after that, until no tap gives a new one - and every place at
       each. As built before it, 6 places stood larger than the frame after
       their level's smallest room: the Hyatt's Concourse, 733 across, its
       Grand Halls A to D, 323 down, and the Courtland Grand's Georgia
       Ballroom, 386 down. */
    it("by any order of taps no place of the 192 stands closer than it fits: inside the frame by 20, and out of the way back's corner - and the level's fit never has to hold a room out past that", () => {
      const f = frame(), EPS = 1e-6;
      let states = 0, eased = 0;
      for (const v of views()) {
        const reach = new Set([0]);
        for (let grew = true; grew;) {
          grew = false;
          for (const least of [...reach]) for (const r of v.places) {
            if (!least && !app.isSmall(r, v.fit.scale)) continue;                // from the fit, only a small room zooms
            const z = Number(app.zoomScale(r, v.fit.scale, f, least).toFixed(9));
            if (!reach.has(z)) { reach.add(z); grew = true; }
          }
        }
        const closest = Math.max(...reach);
        for (const r of v.places) {
          expect(app.zoomFits(r, f) >= v.fit.scale - EPS, `${v.plate.key} ${r.id}: the fit`).toBe(true);
          if (app.zoomScale(r, v.fit.scale, f, closest) < closest - EPS) eased++;
          for (const least of reach) {
            if (!least && !app.isSmall(r, v.fit.scale)) continue;
            const z = app.zoomScale(r, v.fit.scale, f, least), cam = app.cameraOn(r, z, f), box = app.bounds(app.corners(r).map(([x, y]) => [cam.tx + z * x, cam.ty + z * y]));
            states++;
            expect([box.x0 >= f.x + app.ZOOM_MARGIN - EPS, box.x1 <= f.x + f.w - app.ZOOM_MARGIN + EPS, box.y0 >= f.y + app.ZOOM_MARGIN - EPS, box.y1 <= f.y + f.h - app.ZOOM_MARGIN + EPS,
              box.x0 >= f.x + app.BACK_W - EPS || box.y0 >= f.y + app.BACK_H - EPS], `${v.plate.key} ${r.id} at ${z}`).toEqual([true, true, true, true, true]);
          }
        }
      }
      expect([states, eased]).toEqual([2158, 27]);
    });
    it("the largest of them, tapped after their level's smallest room: the Concourse as wide as the frame's margin leaves, the Georgia Ballroom as tall", () => {
      const f = frame(), closest = v => Math.max(...v.places.filter(r => app.isSmall(r, v.fit.scale)).map(r => app.zoomScale(r, v.fit.scale, f)));
      const after = (hotel, key, id) => { const v = views().find(x => x.hotel === hotel && x.plate.key === key), r = v.places.find(p => p.id === id), z = app.zoomScale(r, v.fit.scale, f, closest(v)); return [hundredth(closest(v)), hundredth(z), Math.round(r.w * z), Math.round(r.h * z)]; };
      expect([after("Hyatt", "exhibit+tower-ll2", "Concourse"), after("Hyatt", "exhibit+tower-ll2", "Grand Hall A"), after("Courtland Grand", "f1", "Georgia Ballroom")]).toEqual([[5.39, 2.54, 345, 127], [5.39, 4.02, 112, 241], [2.38, 1.49, 125, 241]]);
    });
    it("a place's own middle is its own: no room or identified open area of a level is painted over another's, so a tap on one selects it", () => {
      for (const v of views()) for (const r of v.places) expect(app.nearest(v.places, [r.cx, r.cy], 0), `${v.hotel} ${v.plate.key} ${r.id}`).toBe(r);
    });
    it("every room 2026's events reach - 2,123 of them at room depth, in 151 rooms - can be reached and selected: an arrival opens its level with the room selected, a button that says so", () => {
      const first = new Map();
      let at = 0;
      for (const ev of handle.events) {
        const d = app.depthOf(ev);
        if (d.depth !== "room") continue;
        at++;
        for (const id of d.rooms) if (!first.has(`${ev.hotel}|${d.level}|${id}`)) first.set(`${ev.hotel}|${d.level}|${id}`, ev);
      }
      expect([at, first.size]).toEqual([2123, 151]);
      const tab = state.tab;
      for (const [key, ev] of first) {
        const [hotel, level, id] = key.split("|");
        app.showOnMap(ev.id);
        const shape = [...document.querySelectorAll("#view-map .map-stack:not([hidden]) .plate.flat [data-room]")].find(n => n.dataset.level === level && n.dataset.room === id);
        expect([state.map.stack, state.map.level, state.map.rooms.some(r => r.level === level && r.id === id), !!shape && shape.getAttribute("role"), !!shape && shape.getAttribute("aria-pressed")], key)
          .toEqual([hotel, app.depthOf(ev).plate, true, "button", "true"]);
      }
      Object.assign(state.map, { focus: null, stack: null, plate: null, level: null, rooms: null, zoom: null });
      state.tab = tab; handle.render();
    }, 30000);          // 151 arrivals, each a draw of the whole page: seconds on a slow machine
    it("an arrival: 867 of the 2,123 are in one room alone, 843 of them small, where the camera goes to it; of the 1,256 in several, 358 name exactly a composite's rooms and are called by it, and none of them zooms", () => {
      const tally = { one: 0, small: 0, many: 0, composite: 0 };
      for (const ev of handle.events) {
        const d = app.depthOf(ev);
        if (d.depth !== "room") continue;
        const v = views().find(x => x.hotel === ev.hotel && x.plate.key === d.plate), rooms = d.rooms.map(id => ({ level: d.level, id }));
        if (rooms.length === 1) { tally.one++; if (app.isSmall(v.places.find(r => r.level === d.level && r.id === rooms[0].id), v.fit.scale)) tally.small++; continue; }
        tally.many++;
        if (app.namedTogether(rooms, v.plate) !== d.rooms.join(" + ")) tally.composite++;
      }
      expect(tally).toEqual({ one: 867, small: 843, many: 1256, composite: 358 });
      expect(handle.events.filter(e => app.depthOf(e).depth === "level")).toHaveLength(0);
    });
  });

  /* The place filter (DECISIONS #98) on the real schedule: every place the
     Map can select - each room and identified open area of a drawn level,
     each set of rooms an arrival leaves selected, each plate that takes a
     tap - on each con day: what the card under the map counts there beside
     the list Search draws for the place its head sends. The numbers are the
     committed files': a schedule, a drawing or the venues file changed moves
     them, and the pull request that does it says so here. New tests, not
     rows of tests/PORT-LEDGER.md. */
  describe("the place filter, on 2027's drawings and 2026's schedule", () => {
    const places = () => {
      const rooms = [], sets = new Map(), plates = [];
      for (const hotel of app.BUILDINGS) for (const plate of app.building(hotel).plates) {
        if (!plate.inert) plates.push({ hotel, levels: plate.levels.map(l => l.id), rooms: null });
        if (plate.drawn) for (const r of app.levelPlaces(plate)) rooms.push({ hotel, levels: [r.level], rooms: [r.id] });
      }
      for (const ev of handle.events) {
        const d = app.depthOf(ev);
        if (d.rooms && d.rooms.length > 1) sets.set(`${ev.hotel}|${d.level}|${d.rooms.join("+")}`, { hotel: ev.hotel, levels: [d.level], rooms: d.rooms });
      }
      return { rooms, sets: [...sets.values()], plates };
    };
    /* A place's events as the Map's card lists them: building.js's own lists, each event once. */
    const atCard = place => [...new Set(place.rooms ? place.rooms.flatMap(id => app.roomEvents(place.hotel, place.levels[0], id).map(at => at.ev)) : place.levels.flatMap(level => app.levelEvents(place.hotel, level)))];
    const reset = () => { app.clearFilters(); Object.assign(state.browse, { q: "", day: null, prevDay: null, place: null, page: 1 }); };

    it("259 places: 192 rooms and open areas, 41 sets of rooms an arrival leaves, 26 plates - and 41 of the rooms have nothing at all, so their head is no link", () => {
      const all = places(), flat = [...all.rooms, ...all.sets, ...all.plates];
      expect([all.rooms.length, all.sets.length, all.plates.length, flat.length]).toEqual([192, 41, 26, 259]);
      const none = flat.filter(place => app.placeLink(place, "2026-09-05") === null);
      expect([none.length, none.every(place => place.rooms && place.rooms.length === 1 && atCard(place).length === 0)]).toEqual([41, true]);
    });
    it("on each of the six con days Search's list for a place is the card's own list: its count of what is happening and, marked, what is cancelled - 16 of the 1,554 differ from the count, each by one cancelled event", () => {
      const all = places(), flat = [...all.rooms, ...all.sets, ...all.plates], days = app.CON_DAYS;
      const tally = { cells: 0, differ: 0, most: 0, everyDay: 0, longest: 0 }, where = new Set();
      for (const place of flat) {
        const card = atCard(place), happening = card.filter(app.happening);
        for (const day of days) {
          const count = happening.filter(e => e._cd === day).length, cancelled = card.filter(e => e._cd === day && !app.happening(e)).length, link = app.placeLink(place, day);
          tally.cells++;
          if (!happening.length) { expect(link, `${app.placeWords(place)} ${day}`).toBe(null); continue; }
          expect(link.day, `${app.placeWords(place)} ${day}`).toBe(count ? day : "All");
          if (!count) tally.everyDay++;
          app.setPlace(place, day);
          const list = app.browseResults();
          expect([list.length, list.map(e => e.id).sort()], `${app.placeWords(place)} ${day}`).toEqual([count + cancelled, card.filter(e => e._cd === day).map(e => e.id).sort()]);
          tally.longest = Math.max(tally.longest, list.length);
          if (cancelled) { tally.differ++; tally.most = Math.max(tally.most, cancelled); where.add(`${place.hotel} ${place.levels.join("+")}`); }
        }
      }
      reset();
      expect(tally).toEqual({ cells: 1554, differ: 16, most: 1, everyDay: 350, longest: 145 });
      expect([...where]).toEqual(["Courtland Grand f3"]);                       // two cancelled events of the Grand Ballroom's, Saturday's and Sunday's
    }, 30000);
    it("a photo room's list is all of it: the Marriott's International Hall South on Saturday, 119 photo sessions, where the hotel alone on that day hides every one", () => {
      const south = places().sets.find(place => app.placeTitle(place) === "International Hall South");
      app.setPlace(south, "2026-09-05");
      const list = app.browseResults();
      expect([app.placeWords(south), state.browse.hideNoise, list.length, list.every(app.isNoise), app.placeLink(south, "2026-09-05").name]).toEqual(["Marriott · International Hall South", true, 119, true, "All 119 events in International Hall South on Saturday, in Search"]);
      state.browse.place = null;
      expect(app.browseResults().filter(e => south.rooms.some(id => (e.rooms || []).includes(id) || (e.rooms || []).includes("International Hall South")))).toHaveLength(0);
      reset();
    });
    it("the longest words a chip holds are a whole ballroom's rooms, one by one: 123 letters", () => {
      const all = places(), longest = [...all.rooms, ...all.sets, ...all.plates].map(app.placeWords).sort((a, b) => b.length - a.length)[0];
      expect([longest.length, longest.startsWith("Courtland · Grand Ballroom A + Grand Ballroom B"), longest.endsWith("Grand Ballroom F")]).toEqual([123, true, true]);
    });
  });
});

/* In place of a pick (W2; DECISIONS #90) on the real schedule, by a boot of
   its own: the design sketch's reader - nine picks, Star Trek and Sean Astin
   followed - at Saturday 5:05 PM, against a copy of the schedule, made here
   in memory and never in data/, in which the source has cancelled Star Trek
   Science and moved Is NASA Still 'NASA'? to Monday at 11:00 AM. The
   snapshots are the events as starred. New tests: no harness line. */
describe("in place of a pick, on 2026's schedule: the sketch's reader at Saturday 5:05 PM", () => {
  const SKETCH = ["6ecc75745a676d39f2300556239d62d0", "c32d19e7750818e0eb903f152ac43c0e", "c32d19e7750818e0eb903f152ad81594",
    "c32d19e7750818e0eb903f152ad84b6f", "1e3995157984a4c0e6515a2ed631ee27", "c32d19e7750818e0eb903f152ac06f6f",
    "c32d19e7750818e0eb903f152ac72ab7", "c32d19e7750818e0eb903f152ac14835", "6ecc75745a676d39f230055623a7291a"];
  const SCIENCE = "c32d19e7750818e0eb903f152ac43c0e", NASA = "c32d19e7750818e0eb903f152ad84b6f", MASQUERADE = "c32d19e7750818e0eb903f152ac72ab7";
  const words = node => (node ? node.textContent.replace(/\s+/g, " ").trim() : null);
  const now = () => document.getElementById("view-now");
  const folds = () => [...now().querySelectorAll(".divider.fold.in-place button")];
  const rowsUnder = button => [...button.parentElement.nextElementSibling.querySelectorAll(".row")]
    .map(r => [words(r.querySelector(".title")), words(r.querySelector(".status")), words(r.querySelector(".track"))]);
  let page, app;

  beforeAll(async () => {
    const raw = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", String(YEAR), "events.v2.json"), "utf8"));
    const seed = (key, value) => window.localStorage.setItem(`dc${YY}.${key}`, JSON.stringify(value));
    seed("picks", SKETCH);
    seed("follows", [{ kind: "work", key: "star-trek" }, { kind: "person", key: "sean-astin" }]);
    seed("pickInfo", Object.fromEntries(raw.events.filter(e => SKETCH.includes(e.id)).map(e => [e.id, { title: e.title, start: e.start, location: e.location || "", end: e.end, hotel: e.hotel }])));
    const data = { ...raw, events: raw.events.map(e => (e.id === SCIENCE ? { ...e, cancelled: true, title: "CANCELLED: Star Trek Science" }
      : e.id === NASA ? { ...e, day: "2026-09-07", start: "2026-09-07T11:00", end: "2026-09-07T12:00" } : e)) };
    page = await bootPage({ data, now: "2026-09-05T17:05" });
    ({ app } = page);
    await page.until(() => app.BOOT.suggested > 0, 110000, "the index over the real schedule");
  }, 120000);
  afterAll(() => page.cleanup(), 60000);

  it("the notice says the two changes, the cancellation under the title it had", () => {
    expect([...now().querySelectorAll(".pick-news li")].map(words)).toEqual([
      "Star Trek Science was cancelled. It was Sat 5:30 PM, Hilton Galleria 2-3. It stays in Plans, marked.",
      "Is NASA Still 'NASA'? moved to Mon 11:00 AM, Hilton 212-214. It was Sun 4:00 PM, Hilton 212-214.",
    ]);
  });
  it("two folds, shut, each counting three", () => {
    expect(folds().map(b => [words(b), b.getAttribute("aria-expanded")])).toEqual([
      ["In place of Star Trek Science, Sat 5:30 PM (3) ▸", "false"],
      ["In place of Is NASA Still 'NASA'?, Sun 4:00 PM (3) ▸", "false"],
    ]);
  });
  it("in place of Star Trek Science: the Enterprise Q&A by the follow, then two of Main Programming's - a track and a topic of one name weigh as one reason, so Moon & Space Sustainability is not the third", () => {
    folds()[0].click();
    expect(rowsUnder(folds()[0])).toEqual([
      ["Star Trek Enterprise Q&A", "You follow Star Trek", "Trek Track"],
      ["Gina Torres - Big Damn Hero!", "Like your picks: Main Programming", null],
      ["Cosplay Photography 101", "Like your picks: Main Programming", null],
    ]);
    expect(app.inPlace({ start: "2026-09-05T17:30", end: "2026-09-05T18:30", hotel: "Hilton" }, app.now()).map(r => app.byId.get(r.id).title))
      .not.toContain("Moon & Space Sustainability");
  });
  it("in place of Is NASA Still 'NASA'?, moved: two by the follow and one like the picks, none of them over its new time on Monday", () => {
    folds()[1].click();
    expect(rowsUnder(folds()[1])).toEqual([
      ["Infinite Riker Games", "You follow Star Trek", "Trek Track"],
      ["A Golden Cage: Are We Already Part of the Borg?", "You follow Star Trek", "Trek Track"],
      ["Classic TV Table Read: Manimal", "Like your picks: TV", "American Sci-fi Classics"],
    ]);
  });
  it("every row starts in the hour its pick vacated", () => {
    const starts = button => [...button.parentElement.nextElementSibling.querySelectorAll(".row")].map(r => app.byId.get(r.dataset.id).start);
    expect(starts(folds()[0])).toEqual(Array(3).fill("2026-09-05T17:30"));
    expect(starts(folds()[1])).toEqual(Array(3).fill("2026-09-06T16:00"));
  });
  it("and Star Trek Science is no hero: nothing is picked for later today, and the next pick is Sunday's", () => {
    expect(document.getElementById("nowHero")).toBe(null);
    expect(words(now().querySelector(".empty"))).toBe("Nothing picked for later today. Your next pick is on Sunday.");
    expect(now().querySelector('.row[data-list="next"]').dataset.id).toBe(MASQUERADE);
  });
});
