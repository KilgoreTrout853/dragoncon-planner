/* The clock's pure parts: a con day, a duration, the phase of the con for a
   given moment. Anything that reads now() needs a booted page and is in
   tests/page/time.test.js. The number in brackets is the harness line the
   assertion came from (tests/PORT-LEDGER.md). The home clock's tests, at
   the foot, are new and carry none (DECISIONS #99): they import the module
   afresh for each build and each start, since it reads the build's default
   as it is imported. */
import { afterEach, describe, expect, it, vi } from "vitest";
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

/* The home clock (DECISIONS #99): what now() answers while the reader has
   set nothing - the build's default moment, DC_NOW's, or the real clock on
   a build with none. The order is the address, the session, the default,
   the real clock. A fresh module each time: home is the build's define,
   Vitest's global, as tests/helpers/page.js sets it; address and session as
   a tab holds them. */
describe("the home clock", () => {
  const DEFAULT = "2026-09-01T10:00", IN_ADDRESS = "2026-09-05T14:15", IN_SESSION = "2026-09-04T09:30";
  const KEY = "dc26.timeOverride";
  const ms = at => new Date(at).getTime();
  const had = Object.getOwnPropertyDescriptor(globalThis, "__DC_NOW__");
  const real = time => { const before = Date.now(), at = time.getTime(), after = Date.now(); return at >= before - 5 && at <= after + 5; };

  async function clock({ home = "", address = null, session = null } = {}) {
    Object.defineProperty(globalThis, "__DC_NOW__", { value: home, writable: true, configurable: true });
    globalThis.jsdom.reconfigure({ url: "https://example.test/" + (address ? "?now=" + address : "") });
    window.sessionStorage.clear();
    if (session) window.sessionStorage.setItem(KEY, session);
    vi.resetModules();
    const time = await import("../../src/time.js");
    time.initTimeOverride();
    return time;
  }
  afterEach(() => {
    vi.useRealTimers();
    window.sessionStorage.clear();
    globalThis.jsdom.reconfigure({ url: "https://example.test/" });
    if (had) Object.defineProperty(globalThis, "__DC_NOW__", had); else delete globalThis.__DC_NOW__;
  });

  describe("the order: the address, the session, the build's default, the real clock", () => {
    it("the address wins over the session and the default", async () => {
      const time = await clock({ home: DEFAULT, address: IN_ADDRESS, session: IN_SESSION });
      expect(time.now().getTime()).toBe(ms(IN_ADDRESS));
      expect(time.isSimulated()).toBe(true);
      expect(window.sessionStorage.getItem(KEY)).toBe(IN_ADDRESS);
    });
    it("the session wins over the default", async () => {
      const time = await clock({ home: DEFAULT, session: IN_SESSION });
      expect(time.now().getTime()).toBe(ms(IN_SESSION));
      expect(time.isSimulated()).toBe(true);
    });
    it("the default wins over the real clock, and is no simulated moment: nothing set, nothing kept", async () => {
      const time = await clock({ home: DEFAULT });
      expect(time.now().getTime()).toBe(ms(DEFAULT));
      expect(time.isSimulated()).toBe(false);
      expect(time.timeOverride).toBe(null);
      expect(window.sessionStorage.getItem(KEY)).toBe(null);
      expect(window.location.search).toBe("");
    });
    it("with none of the three, the real clock", async () => {
      const time = await clock();
      expect(real(time.now())).toBe(true);
      expect(time.isSimulated()).toBe(false);
    });
    it("on a build with no default the address still wins over the session, and the session over the real clock", async () => {
      expect((await clock({ address: IN_ADDRESS, session: IN_SESSION })).now().getTime()).toBe(ms(IN_ADDRESS));
      expect((await clock({ session: IN_SESSION })).now().getTime()).toBe(ms(IN_SESSION));
    });
    it("an address that names no moment sets none: the home clock, default or real", async () => {
      expect((await clock({ home: DEFAULT, address: "tuesday" })).now().getTime()).toBe(ms(DEFAULT));
      expect(real((await clock({ address: "tuesday" })).now())).toBe(true);
    });
  });

  it("a default that does not parse is no default: the real clock, and nothing says otherwise", async () => {
    for (const home of ["tuesday", "2026-13-45T99:99", " "]) {
      const time = await clock({ home });
      expect(real(time.now()), home).toBe(true);
      expect(time.homeMoment, home).toBe("");
      expect(time.isHomeMoment(DEFAULT), home).toBe(false);
    }
  });

  it("the home clock stands still on a build with a default, and runs on one with none", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: ms("2026-10-07T12:00") });
    const still = await clock({ home: DEFAULT });
    vi.advanceTimersByTime(90000);
    expect(still.now().getTime()).toBe(ms(DEFAULT));
    const running = await clock();
    const before = running.now().getTime();
    vi.advanceTimersByTime(90000);
    expect(running.now().getTime()).toBe(before + 90000);
  });

  it("each read is a copy: a caller that moves the date it was given does not move the clock", async () => {
    const time = await clock({ home: DEFAULT });
    time.now().setFullYear(2030);
    expect(time.now().getTime()).toBe(ms(DEFAULT));
  });

  describe("clearing the reader's own moment goes home", () => {
    it("to the default, on a build with one - the session and the address cleared", async () => {
      const time = await clock({ home: DEFAULT, address: IN_ADDRESS });
      expect(time.setOverride(null)).toBe(null);
      expect(time.now().getTime()).toBe(ms(DEFAULT));
      expect(time.isSimulated()).toBe(false);
      expect(window.sessionStorage.getItem(KEY)).toBe(null);
      expect(window.location.search).toBe("");
    });
    it("to the real clock, on a build with none", async () => {
      const time = await clock({ address: IN_ADDRESS });
      time.setOverride(null);
      expect(real(time.now())).toBe(true);
      expect(window.sessionStorage.getItem(KEY)).toBe(null);
      expect(window.location.search).toBe("");
    });
    it("and a moment set over a default is the reader's own: simulated, kept, in the address", async () => {
      const time = await clock({ home: DEFAULT });
      time.setOverride(IN_SESSION);
      expect(time.now().getTime()).toBe(ms(IN_SESSION));
      expect(time.isSimulated()).toBe(true);
      expect(window.sessionStorage.getItem(KEY)).toBe(IN_SESSION);
      expect(window.location.search).toBe("?now=" + IN_SESSION);
    });
  });

  it("wallClock() is the real clock on both kinds of build, whatever the default and the reader's moment", async () => {
    for (const start of [{ home: DEFAULT }, { home: DEFAULT, address: IN_ADDRESS }, {}, { address: IN_ADDRESS }]) {
      const time = await clock(start);
      expect(real(time.wallClock()), JSON.stringify(start)).toBe(true);
    }
  });

  it("the phase of the con reads the home clock: a default before the con is before", async () => {
    expect((await clock({ home: DEFAULT })).conPhase()).toBe("before");
    expect((await clock({ home: "2026-09-05T13:05" })).conPhase()).toBe("live");
  });

  describe("the default as Settings' field and the readout say it", () => {
    it("to the minute, and empty on a build with none", async () => {
      expect((await clock({ home: DEFAULT })).homeMoment).toBe(DEFAULT);
      expect((await clock({ home: "2026-09-01T10:00:30" })).homeMoment).toBe(DEFAULT);
      expect((await clock()).homeMoment).toBe("");
    });
    it("a value the field holds is the default where it says the same minute, and no other value is", async () => {
      const time = await clock({ home: "2026-09-01T10:00:30" });
      expect([DEFAULT, "2026-09-01T10:00:00", "2026-09-01T10:01", "2026-09-02T10:00", "", "tuesday"].map(time.isHomeMoment)).toEqual([true, true, false, false, false, false]);
      const none = await clock();
      expect([DEFAULT, ""].map(none.isHomeMoment)).toEqual([false, false]);
    });
  });
});
