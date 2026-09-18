/* The Now tab: the empty state, the hero card, today's plan, the minute tick,
   a cancelled event. The number in brackets is the harness line the assertion
   came from (tests/PORT-LEDGER.md). One boot at Saturday 1:05 PM; each block
   sets the picks it needs and leaves none behind. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

describe("the Now tab", () => {
  let page, app, handle, state;
  const view = () => document.getElementById("view-now");
  const setPicks = ids => { handle.picks.set(ids); handle.render(); };

  beforeAll(async () => {
    page = await bootPage();
    ({ app, handle } = page);
    state = handle.state;
  }, 30000);
  afterAll(() => page.cleanup());

  describe("with nothing starred", () => {
    it("empty picks state on Now [30]", () => {
      expect(view().textContent).toContain("Nothing picked");
    });
    it("Now shows events around 1 PM [32]", () => {
      expect(view().querySelectorAll(".row").length).toBeGreaterThan(0);
    });
    it("first group is 'On now' [33]", () => {
      expect(view().querySelector(".time-head").textContent).toBe("On now");
    });
  });

  describe("starring from the list", () => {
    it("badge counts 1 pick [37]", () => {
      view().querySelector(".row .star").click();
      expect(document.getElementById("mineBadge").textContent).toBe("1");
    });
    it("pick persisted to localStorage [38, and 219, 1246]", () => {
      expect(JSON.parse(window.localStorage.getItem("dc26.picks"))).toHaveLength(1);
    });

    /* The first pick inserts the hero card above the list, which used to shove
       the rows down by 200px; togglePick measures the tapped row and puts it
       back. */
    describe("the tapped row stays under the finger", () => {
      let drift, picked;
      beforeAll(() => {
        setPicks([]);
        const rows = view().querySelectorAll('.row[data-list="around"]');
        const tapped = rows[2], neighbourId = rows[4].dataset.id;
        const before = rows[4].getBoundingClientRect().top;
        app.togglePick(tapped.dataset.id, tapped);
        const again = view().querySelector(`.row[data-list="around"][data-id="${CSS.escape(neighbourId)}"]`);
        drift = again ? Math.round(again.getBoundingClientRect().top - before) : null;
        picked = handle.picks.get().size;
      });

      it("starring adds exactly one pick [52]", () => {
        expect(picked).toBe(1);
      });
      /* This cannot fail without layout: every rect in jsdom is 0, so the drift
         is 0 by construction. It still runs the measure-and-restore path. The
         rule that guards the fix is 1240 in tests/rules/source.test.js; both
         retire when Playwright arrives. */
      it("starring does not shift neighbouring rows [53]", () => {
        expect(drift).not.toBe(null);
        expect(Math.abs(drift)).toBeLessThanOrEqual(2);
      });
    });
  });

  describe("step 2: the hero card", () => {
    let hero;
    beforeAll(() => {
      setPicks([view().querySelector(".row").dataset.id]);
      hero = view().querySelector(".hero");
    });

    it("hero card renders for the next pick [109]", () => {
      expect(hero).toBeTruthy();
    });
    it("hero has an SVG countdown ring [110]", () => {
      expect(hero.querySelector(".ring svg circle.prog")).toBeTruthy();
    });
    it("ring dashoffset within its circumference [113]", () => {
      const prog = hero.querySelector(".ring circle.prog");
      const dash = parseFloat(prog.getAttribute("stroke-dasharray")), off = parseFloat(prog.getAttribute("stroke-dashoffset"));
      expect(dash).toBeGreaterThan(0);
      expect(off).toBeGreaterThanOrEqual(0);
      expect(off).toBeLessThanOrEqual(dash + 0.5);
    });
    it("hero kicker reads On now or Your next [114]", () => {
      expect(hero.querySelector(".hkicker").textContent).toMatch(/On now|Your next/);
    });
    it("hero room uses the hotel hue [115]", () => {
      expect(hero.querySelector(".hroom").getAttribute("style") || "").toMatch(/var\(--h-/);
    });
  });

  describe("no six-pick cap", () => {
    let planned;
    beforeAll(() => {
      const at = handle.now();
      setPicks(handle.events.filter(e => e._e > at).slice(0, 9).map(e => e.id));
      planned = handle.events.filter(e => handle.picks.get().has(e.id) && e._e > at).length;
    });
    afterAll(() => { handle.closeSheet(); setPicks([]); });

    it("more than six picks in play [210]", () => {
      expect(planned).toBeGreaterThan(6);
    });
    it("all picks render, no 6-cap [211]", () => {
      const rows = view().querySelectorAll(".list.compact .row[data-list='next']").length;
      expect(rows + 1).toBeGreaterThanOrEqual(planned);
    });
    it("remaining picks render as a compact list [212]", () => {
      expect(view().querySelector(".list.compact")).toBeTruthy();
    });
    it("tapping the hero opens the event sheet [215]", () => {
      view().querySelector(".hero").click();
      expect(document.getElementById("sheetWrap").hidden).toBe(false);
      expect(document.getElementById("panel-event").hidden).toBe(false);
    });
  });

  describe("the minute tick patches; it does not rebuild", () => {
    const upcoming = n => { const at = handle.now(); return handle.events.filter(e => e._e > at).slice(0, n).map(e => e.id); };
    afterAll(() => setPicks([]));

    describe("a tick with nothing new", () => {
      let rows, hero;
      beforeAll(() => {
        handle.picks.set(upcoming(5));
        state.tab = "now"; app.renderNow();
        rows = [...view().querySelectorAll(".row")];
        hero = view().querySelector(".hero");
        app.tickNow();
      });

      it("the Now tab had rows to disturb [590]", () => {
        expect(rows.length).toBeGreaterThan(0);
      });
      it("a tick with nothing new leaves every row node in place [591]", () => {
        const after = [...view().querySelectorAll(".row")];
        expect(after).toHaveLength(rows.length);
        expect(after.every((node, i) => node === rows[i])).toBe(true);
      });
      it("and leaves the hero card alone too [592]", () => {
        expect(view().querySelector(".hero")).toBe(hero);
      });
    });

    /* The harness compared the internal lastNowSig before and after. What a
       full render does is observable: the nodes are new ones. */
    it("a tick that finds the plan changed falls back to a full render [602]", () => {
      handle.picks.set([]);
      state.tab = "now"; app.renderNow();
      const rowBefore = view().querySelector(".row");
      expect(view().querySelector(".hero")).toBe(null);
      handle.picks.set(upcoming(3));
      app.tickNow();
      expect(view().querySelector(".hero")).toBeTruthy();
      expect(view().querySelector(".row")).not.toBe(rowBefore);
    });
  });

  /* The clock is Saturday 1:05 PM. Sunday picks must not become the hero. */
  describe("Now is about today: a Sunday pick seen from Saturday is not \"your next\"", () => {
    let sun, satLater, satOn;
    beforeAll(() => {
      const at = handle.now(), today = app.conDayKey(at), real = e => e.hotel !== "Streaming";
      sun = handle.events.filter(e => app.conDayKey(e._s) === "2026-09-06" && e._s > at && real(e));
      satLater = handle.events.filter(e => app.conDayKey(e._s) === today && e._s > at && real(e));
      satOn = handle.events.find(e => e._s <= at && at < e._e && real(e));
      state.tab = "now";
    });
    afterAll(() => setPicks([]));

    describe("with only Sunday picks", () => {
      beforeAll(() => setPicks([sun[0].id, sun[1].id]));

      it("with only Sunday picks, Saturday's Now has no hero [627]", () => {
        expect(view().querySelector(".hero")).toBe(null);
      });
      it("it says so, and names the day of the next pick [628]", () => {
        const empty = view().querySelector(".empty").textContent;
        expect(empty).toMatch(/Nothing picked for later today/);
        expect(empty).toMatch(/Sunday/);
      });
      it("and shows that pick as one row, labelled Sun [630]", () => {
        const row = view().querySelector('.row[data-list="next"]');
        expect(row.dataset.id).toBe(sun[0].id);
        expect(row.querySelector(".t .day").textContent).toBe("Sun");
      });
      it("there is no 'Rest of your day' for a day with nothing in it [632]", () => {
        expect(view().textContent).not.toMatch(/Rest of your day/);
      });
      it("and the mini-bar agrees: nothing today [633]", () => {
        expect(document.getElementById("minibar").hidden).toBe(true);
      });
    });

    describe("with Saturday picks too", () => {
      beforeAll(() => setPicks([sun[0].id, satLater[0].id, satLater[1].id]));

      it("with Saturday picks too, the hero is today's next [634]", () => {
        expect(view().querySelector(".hero").dataset.hero).toBe(satLater[0].id);
      });
      it("the rest of the day is today's only [635]", () => {
        expect([...view().querySelectorAll('.row[data-list="next"]')].map(r => r.dataset.id)).toEqual([satLater[1].id]);
      });
      it("and the count is today's, not every pick [636]", () => {
        expect(view().querySelector(".section-title .count").textContent).toBe("2 today");
      });
    });

    it("an on-now hero does not tell you to leave for a Sunday event [637]", () => {
      setPicks([satOn.id, sun[0].id]);
      const hero = view().querySelector(".hero");
      expect(hero.querySelector(".hkicker").textContent).toBe("On now");
      expect((hero.querySelector(".hthen") || { textContent: "" }).textContent).not.toMatch(/leave by/);
    });
  });

  /* The harness read heroHTML's source for the word "follows". What that
     guards is observable: a follow alone never makes a hero. */
  it("the hero card knows nothing about follows: a followed track with events later today, and no picks, makes no hero [1244]", () => {
    const at = handle.now(), today = app.conDayKey(at);
    const later = handle.events.find(e => e._s > at && app.conDayKey(e._s) === today && (e.tracks || []).length);
    handle.follows.set([{ kind: "track", key: later.tracks[0] }]);
    setPicks([]);
    state.tab = "now"; handle.render();
    expect(app.eventsFor({ kind: "track", key: later.tracks[0] }).some(e => e._s > at)).toBe(true);
    expect(view().querySelector(".hero")).toBe(null);
    handle.follows.set([]);
    handle.render();
  });

  describe("a cancelled event says so, not just a strike-through", () => {
    let ev, row, sheetTag;
    beforeAll(() => {
      /* an event in the "on now and in the next hour" list: a pick would become the hero card, which is not a row */
      const at = handle.now();
      ev = handle.events.find(e => e._e > at && e._s <= new Date(at.getTime() + 3600000) && !app.isNoise(e) && e.hotel !== "Streaming");
      ev.cancelled = true;
      state.tab = "now"; state.now.hotel = "All";
      setPicks([]);
      row = view().querySelector(`.row[data-list="around"][data-id="${CSS.escape(ev.id)}"]`);
      handle.openSheet("event", ev.id);
      sheetTag = !!document.querySelector("#panel-event .ev-head .cancelled-tag");
      handle.closeSheet();
    });
    afterAll(() => { ev.cancelled = false; handle.render(); });

    it("the probe found its row in the on-now list [908]", () => {
      expect(row).toBeTruthy();
    });
    it("a cancelled event's row is struck through [909]", () => {
      expect(row.classList.contains("cancelled")).toBe(true);
    });
    it("and carries a Cancelled label [910]", () => {
      expect(row.querySelector(".cancelled-tag")).toBeTruthy();
    });
    it("and the sheet says Cancelled under the room [911]", () => {
      expect(sheetTag).toBe(true);
    });
  });
});
