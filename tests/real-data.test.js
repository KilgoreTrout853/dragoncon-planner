/* Search quality and Explore against the real 2026 schedule: what only 3,459
   real events can say. The sample fixture is 558 synthetic ones; "does AND
   actually narrow this" means nothing there. The number in brackets is the
   harness line the assertion came from (tests/PORT-LEDGER.md). One boot, and a
   long wait for it: the index over the real schedule takes seconds in jsdom. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "./helpers/page.js";

describe("against the real schedule", () => {
  let page, app, handle, state;
  const has = (titles, fragment) => titles.some(t => t.toLowerCase().includes(fragment.toLowerCase()));
  const chronological = list => { const t = list.map(e => +e._s); return t.every((v, i) => i === 0 || v >= t[i - 1]); };

  /* run a query with the default filters and say what came back; it does not draw */
  function search(q, over = {}) {
    Object.assign(state.browse, { q, day: "All", hotel: "All", type: "All", track: "All", fandom: "All", kind: "All", showHidden: false, showPast: false, noToday: false, hideNoise: true, page: 1 }, over);
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
    /* the harness took the name from the internal suggestDocs; the busiest speaker outside the photo sessions is the same kind of person */
    let who, quoted;
    beforeAll(() => {
      const tally = {};
      handle.events.filter(e => !app.isNoise(e)).forEach(e => (e.speakers || []).forEach(p => { if (p.name) tally[p.name] = (tally[p.name] || 0) + 1; }));
      who = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
      quoted = search(`"${who}"`);
    });

    it("a tapped suggestion still returns results [2081]", () => {
      expect(quoted.total).toBeGreaterThan(0);
    });
    it("and nothing under a Looser divider [2082]", () => {
      expect(quoted.loose).toBe(0);
    });
    it("every result actually features them [2083]", () => {
      expect(quoted.results.every(e => (e.speakers || []).some(p => p.name === who))).toBe(true);
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
      expect(hiddenCount).toBe(handle.events.filter(e => app.isNoise(e) && (e.speakers || []).some(p => /alan tudyk/i.test(p.name))).length);
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
      handle.events.filter(app.isNoise).forEach(e => (e.speakers || []).forEach(p => { if (p.name) tally[p.name] = (tally[p.name] || 0) + 1; }));
      const name = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
      celeb = name ? { name, hidden: tally[name] } : null;
    });
    const theirs = () => app.eventsFor({ kind: "person", key: celeb.name });

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
    const celebrityGuest = name => handle.events.some(e => app.isCeleb(e) && (e.speakers || []).some(s => s.name === name));
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
        const ev = handle.events.find(e => app.isCeleb(e) && !app.isNoise(e) && (e.speakers || []).length === 1);
        guest = ev.speakers[0].name;
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
      expect(app.getCatalogue().fandom.length).toBeLessThan(distinct(e => (e.tags || {}).fandoms || []));
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
});
