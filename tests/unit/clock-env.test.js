// @vitest-environment node
/* The build's guard on the default moment it carries (DECISIONS #99):
   dcNowFromEnv() in build/vite-dc.js reads DC_NOW - a date and time with no
   offset, or nothing - and dcClock() defines __DC_NOW__ from it, "" where
   it is unset. That the build runs it is tests/build.test.js's. New tests,
   not rows of tests/PORT-LEDGER.md. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { dcClock, dcNowFromEnv } from "../../build/vite-dc.js";

const env = value => ({ DC_NOW: value });

describe("dcNowFromEnv", () => {
  it("unset, or blank: no default moment", () => {
    expect(dcNowFromEnv({})).toBe("");
    expect(dcNowFromEnv(env(""))).toBe("");
    expect(dcNowFromEnv(env("  "))).toBe("");
  });
  it("a date and time to the minute, or to the second, trimmed", () => {
    expect(dcNowFromEnv(env("2026-09-01T10:00"))).toBe("2026-09-01T10:00");
    expect(dcNowFromEnv(env(" 2026-09-01T10:00:30 "))).toBe("2026-09-01T10:00:30");
    expect(dcNowFromEnv(env("2028-02-29T23:59"))).toBe("2028-02-29T23:59");
  });
  it("an offset is refused: the default is the phone's own wall time, as every time of the schedule is", () => {
    for (const value of ["2026-09-01T10:00-04:00", "2026-09-01T10:00:00-04:00", "2026-09-01T10:00Z", "2026-09-01T14:00+00:00"]) {
      expect(() => dcNowFromEnv(env(value)), value).toThrow(/DC_NOW is a date and time with no offset/);
    }
  });
  it("another shape is refused", () => {
    for (const value of ["tuesday", "2026-09-01", "10:00", "2026-09-01 10:00", "2026-9-1T10:00", "2026-09-01T10", "1788400800000", "now"]) {
      expect(() => dcNowFromEnv(env(value)), value).toThrow(/DC_NOW is a date and time/);
    }
  });
  it("a date that is no date is refused, which one engine would read as another day and another as none", () => {
    for (const value of ["2026-02-31T10:00", "2026-02-29T10:00", "2026-13-01T10:00", "2026-09-00T10:00", "2026-09-01T24:00", "2026-09-01T10:60", "2026-09-01T10:00:60"]) {
      expect(() => dcNowFromEnv(env(value)), value).toThrow(/DC_NOW is a date and time/);
    }
  });
  it("the refusal names what it was given", () => {
    expect(() => dcNowFromEnv(env("tuesday"))).toThrow(/"tuesday"/);
  });
});

describe("dcClock's define", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("unset, the page holds an empty string: the real clock", () => {
    vi.stubEnv("DC_NOW", "");
    expect(dcClock().config()).toEqual({ define: { __DC_NOW__: '""' } });
  });
  it("set, the page holds the moment as it was given", () => {
    vi.stubEnv("DC_NOW", "2026-09-01T10:00");
    expect(dcClock().config()).toEqual({ define: { __DC_NOW__: '"2026-09-01T10:00"' } });
  });
  it("a bad one is refused as the config is read, before any work is done", () => {
    vi.stubEnv("DC_NOW", "2026-09-01T10:00-04:00");
    expect(() => dcClock().config()).toThrow(/DC_NOW/);
  });
});
