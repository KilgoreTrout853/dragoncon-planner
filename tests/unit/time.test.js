/* The clock's pure parts: a con day, a duration, the phase of the con for a
   given moment. Anything that reads now() needs a booted page and is in
   tests/page/time.test.js. The number in brackets is the harness line the
   assertion came from (tests/PORT-LEDGER.md). */
import { describe, expect, it } from "vitest";
import { CON, conDayKey, conPhase } from "../../src/time.js";
import { fmtMins } from "../../src/util.js";

describe("a con day runs to 5 AM", () => {
  it("1am Sunday counts as Saturday's con day [247, and 493]", () => {
    expect(conDayKey(new Date("2026-09-06T01:00"))).toBe("2026-09-05");
  });
  it("11pm Saturday counts as Saturday [248]", () => {
    expect(conDayKey(new Date("2026-09-05T23:00"))).toBe("2026-09-05");
  });
  it("6am Sunday counts as Sunday [249]", () => {
    expect(conDayKey(new Date("2026-09-06T06:00"))).toBe("2026-09-06");
  });
});

describe("durations read as plans", () => {
  it("minutes over an hour read as hours [849]", () => {
    expect([fmtMins(45), fmtMins(60), fmtMins(310), fmtMins(120)]).toEqual(["45 min", "1 h", "5 h 10 min", "2 h"]);
  });
});

describe("the phase of the con", () => {
  const phase = at => conPhase(new Date(at));

  it("CON names the year and its bounds [1922]", () => {
    expect(CON.year).toBe(2026);
    expect(CON.start).toBeInstanceOf(Date);
    expect(CON.end).toBeInstanceOf(Date);
    expect(CON.start < CON.end).toBe(true);
  });
  it("before the first event: before [1923]", () => {
    expect(phase("2026-09-02T17:59")).toBe("before");
    expect(phase("2026-08-01T12:00")).toBe("before");
  });
  it("from the first start to the last end, inclusive: live [1924]", () => {
    expect(phase("2026-09-02T18:00")).toBe("live");
    expect(phase("2026-09-05T14:15")).toBe("live");
    expect(phase("2026-09-07T19:00")).toBe("live");
  });
  it("after the last event ends: ended [1925]", () => {
    expect(phase("2026-09-07T19:01")).toBe("ended");
    expect(phase("2026-12-25T12:00")).toBe("ended");
  });
});
