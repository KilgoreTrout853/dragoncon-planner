/* The walk between picks - walkEstimate(), connection() and the gap line -
   and what the hero, the mini-bar and the map's card say (DECISIONS #40): no
   leave-by anywhere, and nothing that says where the reader is. The number
   in brackets is the harness line the assertion came from
   (tests/PORT-LEDGER.md); a test written since carries none.

   The expected words are worked out here, from the pair's times, the walk
   and the ten-minute slack, and not read back from the app's own
   connection() or walkEstimate(), so a wrong band shows up as the wrong
   words on the hero card. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

const SLACK_MIN = 10;                         // the venues file's slack_min: the tight band (DECISIONS #40)
const minutes = (a, b) => Math.round((b - a) / 60000);
/* an overlap is the two picks' intersection: the earlier end less the later start */
const overlapOf = (a, b) => minutes(Math.max(a._s, b._s), Math.min(a._e, b._e));

/* gapHTML() as it stood before it read connection() - next at e8fbfe9,
   src/leave.js - word for word, with the slack it read then: the pin that
   the gap line still says what it said, but for a pair with no walk (a
   stream either side) that does not overlap, where it said "about 0 min.
   Tight but doable" and now says nothing, and for an overlap, which the two
   rows' flags say now (DECISIONS #73) and the gap line not at all. */
function gapBefore(prev, next, { walkMin, hotelShort }) {
  if (!prev || !next || prev._cd !== next._cd && minutes(prev._e, next._s) > 240) return "";
  const gap = minutes(prev._e, next._s);
  const walk = walkMin(prev.hotel, next.hotel);
  const move = prev.hotel !== next.hotel ? `${hotelShort(prev.hotel)} to ${hotelShort(next.hotel)}` : `same building`;
  if (next._s < prev._e) {
    const ov = minutes(next._s, prev._e);
    return `<div class="gap overlap">Overlaps the one above by ${ov} min</div>`;
  }
  if (gap < walk) return `<div class="gap tight">${gap} min to get there, ${move} is about ${walk} min at con pace</div>`;
  if (gap < walk + 10) return `<div class="gap">${gap} min gap, ${move} about ${walk} min. Tight but doable</div>`;
  return "";
}

describe("the walk between picks, on the hero, the mini-bar and the map's card", () => {
  let page, app, handle, state, at, today;
  const said = [];
  const onMap = e => !!app.MAP_HOTELS[e.hotel] && !e.cancelled;
  const setPicks = ids => handle.picks.set(ids);
  const ringFor = m => (m >= 60 ? `${Math.floor(m / 60)}h` : `${m}min`);
  const f = d => app.fmtShort(d);

  /* what the three surfaces say for the picks in play, the gap line under
     the hero, which Rest of your day measures from it, and the overlap flag
     on the row there */
  function read() {
    state.tab = "now"; handle.render();
    const h = document.querySelector("#view-now .hero"), txt = (root, sel) => ((root && root.querySelector(sel)) || { textContent: "" }).textContent.trim();
    const gap = document.querySelector("#view-now .gap"), flag = document.querySelector('#view-now .row[data-list="next"] .flags .overlap');
    const r = { line: h ? txt(h, ".hwhen") : null, walkLine: h ? txt(h, ".hwalk") : null, ring: h ? h.querySelector(".ring .num").textContent.trim() : null,
      late: !!(h && h.classList.contains("late")), warn: !!(h && h.querySelector(".hthen.warn")), room: h ? txt(h, ".hroom").replace(/\s+/g, " ") : null,
      gap: gap ? { cls: gap.className, text: gap.textContent.trim() } : null, flag: flag ? flag.textContent.trim() : null };
    state.tab = "browse"; handle.render();
    const bar = document.getElementById("minibar");
    r.bar = bar.hidden ? null : bar.querySelector(".mb-when").textContent.trim();
    r.barRoom = bar.hidden ? null : bar.querySelector(".mb-room").textContent.replace(/\s+/g, " ").trim();
    r.barLate = bar.classList.contains("late");
    state.tab = "map"; state.map.day = null; handle.render();
    const card = document.querySelector("#view-map .next-card"), w = document.querySelector("#view-map .nc-when");
    r.when = w ? w.textContent.trim() : null; r.whenCls = w ? w.className : "";
    r.cardRoom = txt(card, ".nc-where").replace(/\s+/g, " "); r.cardWalk = txt(card, ".nc-walk");
    r.nextRing = !!document.querySelector("#view-map .map-ring.next"); r.nowRing = !!document.querySelector("#view-map .map-ring.now");
    said.push(r);
    return r;
  }

  /* A pick on now and a later one today, found in the fixture, in one
     building or two, their gap in the band asked for: "none", "tight" (under
     the walk and the slack), "cant" (under the walk) or "overlap". */
  function pairIn(band, sameBuilding = false) {
    const on = handle.events.filter(e => e._s <= at && at < e._e && onMap(e));
    const later = handle.events.filter(e => e._s > at && app.conDayKey(e._s) === today && onMap(e));
    for (const a of on) for (const b of later) {
      if ((a.hotel === b.hotel) !== sameBuilding) continue;
      const walk = app.walkMin(a.hotel, b.hotel), gap = minutes(a._e, b._s);
      const got = b._s < a._e ? "overlap" : gap < walk ? "cant" : gap < walk + SLACK_MIN ? "tight" : "none";
      if (got === band) return { on: a, next: b, walk, gap };
    }
    return null;
  }

  beforeAll(async () => {
    page = await bootPage();
    ({ app, handle } = page);
    state = handle.state;
    at = handle.now(); today = app.conDayKey(at);
  }, 30000);
  afterAll(() => page.cleanup());

  describe("no guessing: the hero, the mini-bar and the map, with and without a pick on now", () => {
    let prev, next, nextSame, on, noLoc, sameHotel, noPrev, onNow, minsToStart, minsToEnd, walk, onWalk, onGap;

    beforeAll(() => {
      prev = handle.events.find(e => e._e <= at && app.conDayKey(e._s) === today && onMap(e));
      next = handle.events.find(e => e._s > new Date(at.getTime() + 45 * 60000) && app.conDayKey(e._s) === today && onMap(e) && e.hotel !== prev.hotel);
      nextSame = handle.events.find(e => e._s > at && app.conDayKey(e._s) === today && onMap(e) && e.hotel === prev.hotel);
      /* a pick on in another building, with room to spare before the next: no band */
      on = handle.events.find(e => e._s <= at && at < e._e && onMap(e) && e.hotel !== next.hotel && minutes(e._e, next._s) >= app.walkMin(e.hotel, next.hotel) + SLACK_MIN);
      minsToStart = minutes(at, next._s); minsToEnd = minutes(at, on._e);
      walk = app.walkMin(prev.hotel, next.hotel);
      onWalk = app.walkMin(on.hotel, next.hotel); onGap = minutes(on._e, next._s);

      setPicks([prev.id, next.id]); noLoc = read();
      noLoc.estimate = app.walkEstimate(next);
      setPicks([prev.id, nextSame.id]); sameHotel = read();
      setPicks([next.id]); noPrev = read();
      setPicks([on.id, next.id]); onNow = read();
    });
    afterAll(() => { setPicks([]); state.tab = "now"; handle.render(); });

    it("with nothing on, walkEstimate gives the walk from the previous pick, as an estimate [186]", () => {
      expect(noLoc.estimate.walk).toBe(walk);
      expect(noLoc.estimate.label).toBe(`~${walk} min from ${app.hotelPhrase(prev.hotel)}`);
    });
    it("the hero has no leave-by line [188]", () => {
      expect(noLoc.line).toBe(`starts ${f(next._s)}`);
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
      expect(noLoc.when).toBe(`${f(next._s)} · in ${app.fmtMins(minsToStart)}`);
      expect(noLoc.whenCls).not.toMatch(/leave/);
      expect(noLoc.nextRing).toBe(true);
      expect(noLoc.nowRing).toBe(false);
    });
    it("no walk estimate when the previous pick was in the same hotel [195]", () => {
      expect(sameHotel.walkLine).toBe("");
      expect(sameHotel.line).toMatch(/^starts /);
    });
    it("and none without a previous pick today [196]", () => {
      expect(noPrev.walkLine).toBe("");
      expect(noPrev.line).toMatch(/^starts /);
    });

    it("with a pick on, the hero says when it ends, then where the next is, when, and the walk, and its ring runs to the end [197]", () => {
      expect(onGap, "the pick on leaves room to spare before the next").toBeGreaterThanOrEqual(onWalk + SLACK_MIN);
      expect(onNow.line).toBe(`ends ${f(on._e)} · then ${app.hotelShort(next.hotel)} at ${f(next._s)}, ~${onWalk} min walk`);
      expect(onNow.warn).toBe(false);
      expect(onNow.late).toBe(false);
      expect(onNow.ring).toBe(ringFor(minsToEnd));
    });
    it("with a pick on, the mini-bar still counts down to the next start [199]", () => {
      expect(onNow.bar).toBe(`in ${app.fmtMins(minsToStart)}`);
      expect(onNow.barLate).toBe(false);
    });
    it("and the map's card counts down too, with the walk from the pick on and both rings [200]", () => {
      expect(onNow.when).toBe(`${f(next._s)} · in ${app.fmtMins(minsToStart)}`);
      expect(onNow.whenCls).toBe("nc-when");
      expect(onNow.cardWalk).toBe(`~${onWalk} min from ${app.hotelPhrase(on.hotel)}`);
      expect(onNow.nextRing).toBe(true);
      expect(onNow.nowRing).toBe(true);
    });
  });

  /* The hero with a pick on takes the band connection() gives the pair, in
     the gap line's words, and the gap line under it - Rest of your day,
     measured from the hero - gives the same pair the same band, but for an
     overlap, which the next pick's row flags (DECISIONS #73). */
  describe("with a pick on, the hero takes the pair's band: the gap line's for a walk, the row's flag's for an overlap", () => {
    const got = {};
    const at2 = p => `ends ${f(p.on._e)} · then ${app.hotelShort(p.next.hotel)} at ${f(p.next._s)}`;
    beforeAll(() => {
      for (const [key, band, same] of [["tight", "tight"], ["cant", "cant"], ["overlap", "overlap"], ["sameCant", "cant", true], ["sameNone", "none", true]]) {
        const p = pairIn(band, same);
        if (!p) continue;
        setPicks([p.on.id, p.next.id]);
        got[key] = { ...p, r: read() };
      }
    });
    afterAll(() => setPicks([]));

    it("the fixture has a pair in each band, and two in one building", () => {
      expect(Object.keys(got).sort()).toEqual(["cant", "overlap", "sameCant", "sameNone", "tight"]);
    });
    it("under the walk and the slack: the gap, the walk and tight but doable, quiet", () => {
      const p = got.tight;
      expect(p.r.line).toBe(`${at2(p)}: ${p.gap} min gap, ~${p.walk} min walk. Tight but doable`);
      expect(p.r.warn).toBe(false);
    });
    it("under the walk: the minutes to get there and the walk, in warn", () => {
      const p = got.cant;
      expect(p.r.line).toBe(`${at2(p)}: ${p.gap} min to get there, ~${p.walk} min walk`);
      expect(p.r.warn).toBe(true);
    });
    it("overlapping: by how much, in warn", () => {
      const p = got.overlap;
      expect(p.r.line).toBe(`${at2(p)}: overlaps by ${overlapOf(p.on, p.next)} min`);
      expect(p.r.warn).toBe(true);
    });
    it("in one building, a gap under its own minutes is banded as between two", () => {
      const p = got.sameCant;
      expect(p.walk).toBe(app.walkMin(p.on.hotel, p.on.hotel));
      expect(p.r.line).toBe(`${at2(p)}: ${p.gap} min to get there, ~${p.walk} min walk`);
      expect(p.r.warn).toBe(true);
    });
    it("in one building with time to spare, only what is next: its building", () => {
      const p = got.sameNone;
      expect(p.r.line).toBe(`ends ${f(p.on._e)} · then ${app.hotelShort(p.next.hotel)} next`);
      expect(p.r.warn).toBe(false);
    });
    it("and the gap line under the hero gives each walk band the same, and says nothing of an overlap, which the next pick's row flags", () => {
      expect(got.tight.r.gap).toEqual({ cls: "gap", text: `${got.tight.gap} min gap, ${app.hotelShort(got.tight.on.hotel)} to ${app.hotelShort(got.tight.next.hotel)} about ${got.tight.walk} min. Tight but doable` });
      expect(got.cant.r.gap.cls).toBe("gap tight");
      expect(got.overlap.r.gap).toBe(null);
      expect(got.overlap.r.flag).toBe(`Overlaps ${got.overlap.on.title}`);
      expect([got.tight, got.cant, got.sameCant, got.sameNone].map(p => p.r.flag)).toEqual([null, null, null, null]);
      expect(got.sameCant.r.gap).toEqual({ cls: "gap tight", text: `${got.sameCant.gap} min to get there, same building is about ${got.sameCant.walk} min at con pace` });
      expect(got.sameNone.r.gap).toBe(null);
    });
  });

  /* A stream has no walk, so no connection: the hero says what is next by
     its title, and the mini-bar and the card its start alone. An overlap is
     time, not walking, and is said for a stream too: on the hero, and on
     the stream's row. */
  describe("a stream as the next pick", () => {
    let stream, after, overlapping;
    beforeAll(() => {
      stream = handle.events.find(e => e._s > at && app.conDayKey(e._s) === today && e.hotel === "Streaming");
      const before = handle.events.find(e => e._s <= at && at < e._e && onMap(e) && e._e <= stream._s);
      const across = handle.events.find(e => e._s <= at && at < e._e && onMap(e) && e._e > stream._s);
      setPicks([before.id, stream.id]); after = { on: before, r: read() };
      setPicks([across.id, stream.id]); overlapping = { on: across, r: read() };
    });
    afterAll(() => setPicks([]));

    it("after the pick on: the hero names it by its title, with no walk and no band", () => {
      expect(after.r.line).toBe(`ends ${f(after.on._e)} · then ${stream.title} next`);
      expect(after.r.warn).toBe(false);
      expect(after.r.gap).toBe(null);
    });
    it("the mini-bar and the map's card give its start alone: no walk, no next ring", () => {
      const mins = minutes(at, stream._s);
      expect(after.r.bar).toBe(`in ${app.fmtMins(mins)}`);
      expect(after.r.when).toBe(`${f(stream._s)} · in ${app.fmtMins(mins)}`);
      expect(after.r.cardWalk).toBe("");
      expect(after.r.nextRing).toBe(false);
    });
    it("overlapping the pick on: the hero says by how much, in warn, and the stream's row flags it, the gap line nothing", () => {
      const ov = overlapOf(overlapping.on, stream);
      expect(overlapping.r.line).toBe(`ends ${f(overlapping.on._e)} · then ${stream.title} at ${f(stream._s)}: overlaps by ${ov} min`);
      expect(overlapping.r.warn).toBe(true);
      expect(overlapping.r.flag).toBe(`Overlaps ${overlapping.on.title}`);
      expect(overlapping.r.gap).toBe(null);
    });
  });

  /* An overlap is the two picks' intersection, the earlier end less the
     later start: a short pick inside a long one overlaps by its own length,
     not by the time to the long one's end. The fixture has such a pair on
     Thursday; the clock moves to a minute after the long one starts. */
  describe("a pick inside the one that is on", () => {
    let pair, r;
    beforeAll(() => {
      const pad = n => String(n).padStart(2, "0"), all = handle.events.filter(onMap);
      for (const a of all) {
        const b = all.find(e => e.hotel !== a.hotel && e._cd === a._cd && e._s > new Date(a._s.getTime() + 60000) && e._e < a._e);
        if (b) { pair = { on: a, next: b }; break; }
      }
      const t = new Date(pair.on._s.getTime() + 60000);
      setPicks([pair.on.id, pair.next.id]);
      handle.setTimeOverride(`${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`);
      r = read();
    });
    afterAll(() => { setPicks([]); handle.setTimeOverride("2026-09-05T13:05"); });

    it("overlaps by its own length on the hero, not by the time to the end of the one that is on; its row flags it, the gap line nothing", () => {
      const own = minutes(pair.next._s, pair.next._e);
      expect(own).toBeLessThan(minutes(pair.next._s, pair.on._e));
      expect(r.line).toBe(`ends ${f(pair.on._e)} · then ${app.hotelShort(pair.next.hotel)} at ${f(pair.next._s)}: overlaps by ${own} min`);
      expect(r.warn).toBe(true);
      expect(r.flag).toBe(`Overlaps ${pair.on.title}`);
      expect(r.gap).toBe(null);
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

  it("nothing on the hero, the mini-bar or the map's card says leave, or is marked late, in any of these", () => {
    expect(said.length).toBeGreaterThanOrEqual(10);
    for (const r of said) {
      expect([r.line, r.walkLine, r.bar, r.when, r.cardWalk].join(" | ")).not.toMatch(/\bleave\b/i);
      expect([r.late, r.barLate, /late/.test(r.whenCls)]).toEqual([false, false, false]);
    }
  });

  /* Ruling on stop 1: gapHTML() reads its band from connection(), and its
     output is what it was, byte for byte, pinned here against the old code -
     but for two named exceptions: a pair with no walk that does not overlap,
     which said "about 0 min. Tight but doable" and says nothing now; and any
     overlap, a pick inside the one above among them, which the gap line said
     and says nothing of now: the two rows' flags say it (DECISIONS #73). Over
     every pair of the fixture's events a few hours apart, and, since the
     fixture's times are on the half hour and never make a tight pair in one
     building, over made pairs at every gap from a 40-minute overlap to 40
     minutes apart, and a half hour inside four. */
  it("the gap line says what it said before, over every nearby pair and every gap, but for a stream's pair that does not overlap, and any overlap", () => {
    const seen = new Set();
    let pairs = 0;
    const kind = (html, a, b) => {
      const same = a.hotel === b.hotel;
      if (!html) return "none";
      if (/to get there/.test(html)) return same ? "under the walk, one building" : "under the walk";
      return same ? "tight, one building" : "tight";
    };
    const compare = (a, b, name) => {
      pairs++;
      const before = gapBefore(a, b, app), now = app.gapHTML(a, b);
      if (!app.walkMin(a.hotel, b.hotel) && b._s >= a._e && before) {
        expect(now, name).toBe("");
        seen.add("a stream within the slack, now nothing");
        return;
      }
      if (b._s < a._e && before) {
        expect(before, name).toMatch(/^<div class="gap overlap">Overlaps the one above by \d+ min<\/div>$/);
        expect(now, name).toBe("");
        const stream = a.hotel === "Streaming" || b.hotel === "Streaming";
        seen.add(b._e < a._e ? "a pick inside the one above, now nothing" : stream ? "an overlap with a stream, now nothing" : "an overlap, now nothing");
        return;
      }
      expect(now, name).toBe(before);
      seen.add(kind(before, a, b));
    };
    const events = handle.events;
    events.forEach((a, i) => events.slice(i + 1, i + 60).forEach(b => compare(a, b, `${a.id} to ${b.id}`)));
    const day = "2026-09-05", made = (hotel, from, length) => {
      const _s = new Date(new Date(`${day}T13:00`).getTime() + from * 60000);
      return { hotel, _s, _e: new Date(_s.getTime() + length * 60000), _cd: day };
    };
    for (const [one, two] of [["Hyatt", "Hyatt"], ["Hyatt", "Hilton"], ["Hilton", "Streaming"], ["Streaming", "Hyatt"], ["Streaming", "Streaming"]]) {
      for (let gap = -40; gap <= 40; gap++) compare(made(one, 0, 60), made(two, 60 + gap, 60), `${one} to ${two}, ${gap} min apart`);
      compare(made(one, 0, 240), made(two, 60, 30), `${one} to ${two}, a half hour inside four`);
    }
    expect(pairs).toBeGreaterThan(20000);
    expect([...seen].sort()).toEqual(["a pick inside the one above, now nothing", "a stream within the slack, now nothing", "an overlap with a stream, now nothing",
      "an overlap, now nothing", "none", "tight", "tight, one building", "under the walk", "under the walk, one building"]);
  });
});
