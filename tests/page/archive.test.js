/* Archive mode: after the con. The number in brackets is the harness line the
   assertion came from (tests/PORT-LEDGER.md). */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bootPage } from "../helpers/page.js";

const pickSix = events => events.filter(e => e._cd === "2026-09-04" || e._cd === "2026-09-05").filter((e, i) => i % 40 === 0).slice(0, 6).map(e => e.id);

describe("the morning after the last event", () => {
  let page, app, handle, state, text, archIds;
  const el = id => document.getElementById(id);
  const nowView = () => el("view-now");
  const setPicks = ids => { handle.picks.set(ids); handle.render(); };
  const archiveRows = () => [...document.querySelectorAll('#view-now .row[data-list="archive"]')];

  beforeAll(async () => {
    page = await bootPage();
    ({ app, handle, text } = page);
    state = handle.state;
    await page.until(() => app.BOOT.suggested > 0, 20000, "the search index");      // 1962 searches
    archIds = pickSix(handle.events);
    setPicks(archIds);
    state.tab = "now";
    handle.setTimeOverride("2026-09-08T09:00");
  }, 30000);
  afterAll(() => page.cleanup());

  it("the morning after the last event: ended [1937]", () => {
    expect(app.conPhase()).toBe("ended");
    expect(app.conEnded()).toBe(true);
  });
  it("the banner says the con has ended and points at the schedule [1939]", () => {
    expect(el("notice").hidden).toBe(false);
    expect(text("notice")).toMatch(/Dragon Con 2026 has ended/);
    expect(text("notice")).toMatch(/Now tab/);
  });
  it("with a dismiss button [1940]", () => {
    expect(document.querySelector('#notice [data-act="dismiss-archive"]')).toBeTruthy();
  });
  it("the Now tab has no hero, no on-now, no leave-by [1941]", () => {
    expect(nowView().querySelector(".hero")).toBe(null);
    expect(nowView().textContent).not.toMatch(/On now|Your next|\bleave\b.*\bby\b|leave now|In \d+ min/);
  });
  it("it is headed Your 2026 schedule [1942]", () => {
    expect(nowView().textContent).toMatch(/Your 2026 schedule/);
  });
  it("every pick is listed, in time order [1945]", () => {
    const want = handle.events.filter(e => handle.picks.get().has(e.id)).map(e => e.id);
    expect(archiveRows().map(r => r.dataset.id)).toEqual(want);
    expect(want).toHaveLength(6);
  });
  it("grouped by day [1948]", () => {
    const heads = [...nowView().querySelectorAll(".day-head")].map(h => h.textContent.trim());
    const want = [...new Set(handle.events.filter(e => handle.picks.get().has(e.id)).map(e => app.DAY_LONG[e._cd]))];
    expect(heads.length).toBeGreaterThan(1);
    expect(heads).toEqual(want);
  });
  it("no on-now list and no install nudge under it [1949]", () => {
    expect(nowView().querySelector(".time-head")).toBe(null);
    expect(nowView().textContent).not.toMatch(/next hour/);
    expect(el("nudge")).toBe(null);
  });
  it("unstarring from the archive list removes the row [1951]", () => {
    nowView().querySelector('.row[data-list="archive"] .star').click();
    expect(handle.picks.get().size).toBe(5);
    expect(archiveRows()).toHaveLength(5);
  });
  it("and starring brings it back [1953]", () => {
    setPicks(archIds);
    expect(archiveRows()).toHaveLength(6);
  });
  it("with no picks, an empty state that points at Search [1955]", () => {
    setPicks([]);
    expect(nowView().textContent).toMatch(/Nothing starred/);
    setPicks(archIds);
  });
  it("the header calls the copy final [1957]", () => {
    expect(text("fresh")).toMatch(/final/);
    expect(text("fresh")).not.toMatch(/refreshed/);
  });

  describe("on the other tabs", () => {
    it("no mini-bar on Search after the con [1959]", () => {
      state.tab = "browse"; handle.render();
      expect(el("minibar").hidden).toBe(true);
    });
    it("the banner is on every tab [1960]", () => {
      expect(el("notice").hidden).toBe(false);
    });
    it("search results have no Already happened fold: nothing is past when everything is [1962]", () => {
      Object.assign(state.browse, { q: "panel", day: "All", page: 1 }); handle.render();
      expect(document.querySelector('#view-browse [data-act="toggle-past"]')).toBe(null);
      expect(document.querySelectorAll("#view-browse .row").length).toBeGreaterThan(0);
    });
    it("and no Today scope [1963]", () => {
      expect(document.querySelector('#view-browse [data-act="unparse-today"]')).toBe(null);
    });
    it("the map has no next-pick card and no rings [1965]", () => {
      Object.assign(state.browse, { q: "", day: null, page: 1 }); state.tab = "map"; handle.render();
      for (const gone of [".next-card", ".next-on", ".map-ring"]) expect(document.querySelector(`#view-map ${gone}`), gone).toBe(null);
    });
    it("the map still counts picks by hotel on its day chips [1966]", () => {
      expect(document.querySelectorAll("#view-map .map-pill").length > 0 || app.mapDay() === "2026-09-03").toBe(true);
    });
    it("an Explore page lists everything plainly [1968]", () => {
      state.tab = "explore"; state.explore.page = { kind: "track", key: handle.events[0].tracks[0] }; handle.render();
      expect(document.querySelector('#view-explore [data-act="explore-past"]')).toBe(null);
      expect(el("view-explore").textContent).not.toMatch(/still to come|already happened/i);
    });
    it("Mine has no now-line, and export is still offered [1970]", () => {
      state.explore.page = null; state.tab = "mine"; handle.render();
      expect(document.querySelector("#view-mine .tl-now")).toBe(null);
      expect(document.querySelector('#view-mine [data-act="ics"]').disabled).toBe(false);
    });
  });

  describe("dismissing the banner", () => {
    it("dismissing hides the banner and remembers it for the year [1973]", () => {
      state.tab = "now"; handle.render();
      document.querySelector('#notice [data-act="dismiss-archive"]').click();
      expect(el("notice").hidden).toBe(true);
      expect(app.loadJSON("dc26.archiveNoticeDismissed", null)).toBe(2026);
    });
    it("and it stays dismissed [1975]", () => {
      state.tab = "browse"; handle.render(); state.tab = "now"; handle.render();
      expect(el("notice").hidden).toBe(true);
      window.localStorage.removeItem("dc26.archiveNoticeDismissed");
    });
  });

  it("the minute tick leaves the archive list alone [1978]", () => {
    app.tickNow();
    expect(archiveRows()).toHaveLength(6);
  });
  it("a minute before the end it is still live [1980]", () => {
    handle.setTimeOverride("2026-09-07T18:59");
    expect(nowView().textContent).toMatch(/next hour/);
    expect(el("notice").hidden).toBe(true);
  });
  it("and Saturday afternoon is live again [1984]", () => {
    handle.setTimeOverride("2026-09-05T13:05");
    state.tab = "now"; handle.render();
    expect(el("notice").hidden).toBe(true);
    expect(nowView().textContent).toMatch(/next hour/);
  });
});

/* The harness wrote timeOverride by hand and called the tick's parts. A
   simulated clock stands still, so the con can only end on a tick under the
   real clock: no ?now=, the system time a minute before the last event ends,
   and the app's own 60-second interval. */
describe("the con ends while the page is open", () => {
  let page;

  beforeAll(async () => {
    vi.useFakeTimers({ now: new Date("2026-09-07T18:59:00"), toFake: ["Date", "setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
    page = await bootPage({ now: null });
    page.handle.picks.set(pickSix(page.handle.events));
    page.handle.render();
  }, 30000);
  afterAll(async () => { await page.cleanup(); vi.useRealTimers(); });

  it("a minute after, the tick flips it to the archive with the banner [1982]", () => {
    const view = document.getElementById("view-now");
    expect(page.app.isSimulated()).toBe(false);
    expect(view.textContent).toMatch(/next hour/);
    expect(document.getElementById("notice").hidden).toBe(true);
    vi.advanceTimersByTime(2 * 60000);
    expect(view.textContent).toMatch(/Your 2026 schedule/);
    expect(document.getElementById("notice").hidden).toBe(false);
  });
});
