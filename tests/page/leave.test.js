/* Where you are, and when to leave: leaveInfo, currentLocation, and what the
   hero, the mini-bar and the map's card say. The number in brackets is the
   harness line the assertion came from (tests/PORT-LEDGER.md).

   The leave-by strings are checked against the formula, worked out here -
   the next pick's start, less the walk, less ten minutes - and not against
   the app's own leaveInfo, so a wrong buffer shows up as a wrong time on the
   hero card. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

const BUFFER_MIN = 10;                                 // DECISIONS #6: the slack on every leave-by

describe("where you are, and when to leave", () => {
  let page, app, handle, state, at, today;
  const onMap = e => !!app.MAP_HOTELS[e.hotel] && !e.cancelled;
  const setPicks = ids => handle.picks.set(ids);
  const ringFor = m => (m >= 60 ? `${Math.floor(m / 60)}h` : `${m}min`);

  /* what the three surfaces say for the picks in play */
  function read() {
    state.tab = "now"; handle.render();
    const h = document.querySelector("#view-now .hero"), txt = (root, sel) => ((root && root.querySelector(sel)) || { textContent: "" }).textContent.trim();
    const r = { leave: h ? txt(h, ".hleave") : null, walkLine: h ? txt(h, ".hwalk") : null, ring: h ? h.querySelector(".ring .num").textContent.trim() : null,
      late: !!(h && h.classList.contains("late")), room: h ? txt(h, ".hroom").replace(/\s+/g, " ") : null };
    state.tab = "browse"; handle.render();
    const bar = document.getElementById("minibar");
    r.bar = bar.hidden ? null : bar.querySelector(".mb-when").textContent.trim();
    r.barRoom = bar.hidden ? null : bar.querySelector(".mb-room").textContent.replace(/\s+/g, " ").trim();
    state.tab = "map"; state.map.day = null; handle.render();
    const w = document.querySelector("#view-map .nc-when");
    r.when = w ? w.textContent.trim() : null; r.whenCls = w ? w.className : "";
    r.cardRoom = txt(document.querySelector("#view-map .next-card"), ".nc-where").replace(/\s+/g, " ");
    r.nextRing = !!document.querySelector("#view-map .map-ring.next"); r.nowRing = !!document.querySelector("#view-map .map-ring.now");
    return r;
  }

  beforeAll(async () => {
    page = await bootPage();
    ({ app, handle } = page);
    state = handle.state;
    at = handle.now(); today = app.conDayKey(at);
  }, 30000);
  afterAll(() => page.cleanup());

  describe("leaveInfo", () => {
    it("leave-by = start - walk - buffer [125]", () => {
      const next = handle.events.find(e => e._s > at && e.hotel !== "Marriott" && e.hotel !== "Streaming");
      const info = app.leaveInfo("Marriott", next, at);
      expect(Math.round((next._s - info.leaveBy) / 60000)).toBe(info.walk + BUFFER_MIN);
    });
    it("no leave-by for a next pick in the hotel you are already in [126]", () => {
      const same = app.leaveInfo("Marriott", handle.events.find(e => e._s > at && e.hotel === "Marriott"), at);
      expect(same.leaveBy).toBe(null);
    });
  });

  /* location is a fact or nothing: the hotel of a pick that is on now, never a guess from one that ended */
  describe("currentLocation", () => {
    afterAll(() => setPicks([]));

    it("currentLocation is the hotel of the pick that is on now [145]", () => {
      const onNow = handle.events.find(e => e._s <= at && at < e._e && e.hotel !== "Streaming");
      setPicks([onNow.id]);
      expect(app.currentLocation(at)).toBe(onNow.hotel);
    });
    it("a pick that ended says nothing about where you are [146]", () => {
      const ended = handle.events.filter(e => e._e <= at && app.conDayKey(e._s) === today && e.hotel !== "Streaming").sort((x, y) => y._e - x._e)[0];
      setPicks([ended.id]);
      expect(app.currentLocation(at)).toBe(null);
    });
    it("and nothing picked is nowhere [147]", () => {
      setPicks([]);
      expect(app.currentLocation(at)).toBe(null);
    });
    /* The sample fixture has no stream on at 1:05 PM, so the harness ran this
       with nothing picked and said so in its message. currentLocation takes
       the moment as an argument: ask it about a minute when a stream is on. */
    it("a stream that is on says nothing either: you could be anywhere [148]", () => {
      const stream = handle.events.find(e => e.hotel === "Streaming");
      const during = new Date(stream._s.getTime() + 60000);
      setPicks([stream.id]);
      expect(during < stream._e).toBe(true);
      expect(app.currentLocation(during)).toBe(null);
    });
  });

  describe("no guessing: the hero, the mini-bar and the map, with and without a pick on now", () => {
    let prev, next, nextSame, on, noLoc, sameHotel, noPrev, onNow, minsToStart, minsToEnd, walk, expectLeave;

    beforeAll(() => {
      prev = handle.events.find(e => e._e <= at && app.conDayKey(e._s) === today && onMap(e));
      /* far enough out that the leave-by is a time, not "leave now" */
      next = handle.events.find(e => e._s > new Date(at.getTime() + 45 * 60000) && app.conDayKey(e._s) === today && onMap(e) && e.hotel !== prev.hotel);
      nextSame = handle.events.find(e => e._s > at && app.conDayKey(e._s) === today && onMap(e) && e.hotel === prev.hotel);
      on = handle.events.find(e => e._s <= at && at < e._e && onMap(e) && e.hotel !== next.hotel);
      minsToStart = Math.round((next._s - at) / 60000); minsToEnd = Math.round((on._e - at) / 60000);
      walk = app.walkMin(prev.hotel, next.hotel);

      setPicks([prev.id, next.id]); noLoc = read();
      noLoc.info = app.leaveInfo(app.currentLocation(at), next, at);
      setPicks([prev.id, nextSame.id]); sameHotel = read();
      setPicks([next.id]); noPrev = read();
      setPicks([on.id, next.id]); onNow = read();

      const leaveBy = new Date(next._s.getTime() - (app.walkMin(on.hotel, next.hotel) + BUFFER_MIN) * 60000);
      expectLeave = { bar: `leave by ${app.fmtShort(leaveBy)}`, full: `leave ${app.hotelPhrase(on.hotel)} by ${app.fmtShort(leaveBy)}`, late: at >= leaveBy };
    });
    afterAll(() => { setPicks([]); state.tab = "now"; handle.render(); });

    it("with nothing on, leaveInfo gives no leave-by, only a walk estimate from the previous pick [186]", () => {
      expect(noLoc.info.leaveBy).toBe(null);
      expect(noLoc.info.estimate.walk).toBe(walk);
      expect(noLoc.info.estimate.label).toBe(`~${walk} min from ${app.hotelPhrase(prev.hotel)}`);
    });
    it("the hero has no leave-by line [188]", () => {
      expect(noLoc.leave).toBe(`starts ${app.fmtShort(next._s)}`);
      expect(noLoc.late).toBe(false);
    });
    it("its ring counts down to the start [190]", () => {
      expect(noLoc.ring).toBe(ringFor(minsToStart));
    });
    it("the walk estimate is a line under it [191, the page half]", () => {
      expect(noLoc.walkLine).toBe(`~${walk} min from ${app.hotelPhrase(prev.hotel)}`);
    });
    it("the mini-bar counts down [192]", () => {
      expect(noLoc.bar).toBe(`in ${app.fmtMins(minsToStart)}`);
    });
    it("the map's card counts down to the start and the map keeps the next ring [193]", () => {
      expect(noLoc.when).toBe(`${app.fmtShort(next._s)} · in ${app.fmtMins(minsToStart)}`);
      expect(noLoc.whenCls).not.toMatch(/leave/);
      expect(noLoc.nextRing).toBe(true);
      expect(noLoc.nowRing).toBe(false);
    });
    it("no walk estimate when the previous pick was in the same hotel [195]", () => {
      expect(sameHotel.walkLine).toBe("");
      expect(sameHotel.leave).toMatch(/^starts /);
    });
    it("and none without a previous pick today [196]", () => {
      expect(noPrev.walkLine).toBe("");
      expect(noPrev.leave).toMatch(/^starts /);
    });

    it("with a pick on, the hero says leave the hotel you are in, by the start less the walk less ten minutes, and its ring runs to the end [197]", () => {
      expect(expectLeave.late, "the fixture pair leaves time to spare").toBe(false);
      expect(onNow.leave).toBe(expectLeave.full);
      expect(onNow.ring).toBe(ringFor(minsToEnd));
    });
    it("the mini-bar says leave by [199]", () => {
      expect(onNow.bar).toBe(expectLeave.bar);
    });
    it("and the map's card says so too, with both rings [200]", () => {
      expect(onNow.when).toBe(expectLeave.full);
      expect(onNow.whenCls).toMatch(/leave/);
      expect(onNow.nextRing).toBe(true);
      expect(onNow.nowRing).toBe(true);
    });
  });

  describe("the hero, the mini-bar and the map card use the Hotel · Room convention", () => {
    let on, next, got;
    beforeAll(() => {
      on = handle.events.find(e => e._s <= at && at < e._e && app.MAP_HOTELS[e.hotel] && e.room);
      next = handle.events.find(e => e._s > at && app.conDayKey(e._s) === today && app.MAP_HOTELS[e.hotel] && e.room && e.hotel !== on.hotel);
      setPicks([on.id, next.id]);
      got = read();
    });
    afterAll(() => { setPicks([]); state.tab = "now"; handle.render(); });

    it("the hero's room line reads hotel, dot, room [1876]", () => {
      expect(got.room).toBe(`${app.hotelShort(on.hotel)} · ${on.room}`);
    });
    it("and so does the mini-bar [1877]", () => {
      expect(got.barRoom).toBe(`${app.hotelShort(next.hotel)} · ${next.room}`);
    });
    it("and the map's card, which used to put the room first [1878]", () => {
      expect(got.cardRoom).toBe(`${app.hotelShort(next.hotel)} · ${next.room}`);
    });
  });
});
