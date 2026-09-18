/* Offline, as far as a page can see it: what the service worker tells it, the
   update pill, the freshness line, and the check on coming back to the app.
   The number in brackets is the harness line the assertion came from
   (tests/PORT-LEDGER.md). What sw.js itself does is tests/build.test.js.

   The harness wrote servedOffline, pillDragged and lastScheduleCheck by hand
   and patched window.reloadNow. Here each situation arrives the way it does on
   a phone: a message from the worker, a finger on the pill, time passing. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bootPage } from "../helpers/page.js";
import { touch } from "../helpers/act.js";

describe("what the service worker tells the page", () => {
  let page, app, handle, reloads = 0;
  const el = id => document.getElementById(id);
  const fromWorker = data => page.sw.dispatchEvent(new MessageEvent("message", { data }));
  const fresh = () => el("fresh").textContent;

  beforeAll(async () => {
    page = await bootPage({ reload: () => { reloads++; } });
    ({ app, handle } = page);
    handle.state.tab = "browse"; handle.render();
  }, 30000);
  afterAll(() => page.cleanup());

  describe("the pill: shown by the worker's message, dismissed, and reloads on tap", () => {
    it("the update pill starts hidden [1337]", () => {
      expect(el("updatePill").hidden).toBe(true);
    });
    it("a schedule-updated message shows the pill [1339]", () => {
      fromWorker({ type: "schedule-updated" });
      expect(el("updatePill").hidden).toBe(false);
    });
    it("the pill says what tapping does [1340]", () => {
      expect(el("updatePill").textContent).toMatch(/tap to refresh/i);
    });
    it("showing the pill does not re-render the list [1344]", () => {
      const seen = [];
      const observer = new MutationObserver(records => seen.push(...records));
      observer.observe(el("view-browse"), { childList: true, subtree: true, attributes: true, characterData: true });
      fromWorker({ type: "schedule-updated" });
      seen.push(...observer.takeRecords());
      observer.disconnect();
      expect(document.querySelectorAll("#view-browse .row").length).toBeGreaterThan(0);
      expect(seen).toHaveLength(0);
    });
    it("tapping the pill reloads [1349]", () => {
      el("updatePill").click();
      expect(reloads).toBe(1);
    });
    it("a swipe does not trigger the reload [1352]", () => {
      const pill = el("updatePill"), before = reloads;
      touch(pill, "touchstart", { x: 100 });
      touch(pill, "touchmove", { x: 120 });                  // more than 6px: a drag, not a tap
      touch(pill, "touchend");
      pill.click();                                          // the click a browser sends after the touch
      expect(reloads).toBe(before);
    });
    it("the pill can be dismissed [1356]", () => {
      app.hideUpdatePill();
      expect(el("updatePill").hidden).toBe(true);
    });
  });

  describe("the freshness line marks a cached copy", () => {
    it("no offline marker while the network is fine [1360]", () => {
      expect(fresh()).not.toMatch(/offline copy/);
    });
    it("a cached copy is labelled [1371, and 1366]", () => {
      fromWorker({ type: "schedule-offline" });
      expect(fresh()).toMatch(/offline copy/);
    });
    it("the existing freshness line survives [1373]", () => {
      expect(fresh()).toMatch(/[\d,]+ events · refreshed/);
    });
    it("the marker clears when back online [1375, and 1368]", () => {
      fromWorker({ type: "schedule-online" });
      expect(fresh()).not.toMatch(/offline copy/);
    });
    it("with a worker, its schedule-updated message carries the new generated_at into the freshness text [1689]", () => {
      const before = fresh(), newer = "2026-09-05T12:05:00";     // an hour before the simulated 1:05 PM
      fromWorker({ type: "schedule-updated", generated_at: newer });
      expect(handle.meta.generated_at).toBe(newer);
      expect(fresh()).not.toBe(before);
      expect(fresh()).toMatch(/refreshed (60 min|1 h) ago/);
      expect(el("updatePill").hidden).toBe(false);
      app.hideUpdatePill();
    });
  });

  /* The harness matched `register("./sw.js").catch(err => … console.warn` in the source. */
  it("a failed registration is reported, not swallowed [1288]", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    page.sw.register = vi.fn(() => Promise.reject(new Error("no worker for you")));
    window.dispatchEvent(new Event("load"));
    await page.until(() => warn.mock.calls.length > 0, 2000, "the warning");
    expect(page.sw.register).toHaveBeenCalledWith("./sw.js");
    expect(warn.mock.calls[0].join(" ")).toMatch(/Offline support unavailable/);
    expect(warn.mock.calls[0].join(" ")).toMatch(/no worker for you/);
    warn.mockRestore();
  });
});

/* A simulated clock stands still, which is why the harness wrote
   lastScheduleCheck to make time pass. recheckSchedule measures with now(),
   so moving the simulated clock is how time passes here. */
describe("polish 5: refresh on foreground", () => {
  let page, handle, calls, reply, realFetch, generatedAt;
  const back = () => document.dispatchEvent(new Event("visibilitychange"));
  const settle = () => new Promise(resolve => setTimeout(resolve, 20));

  beforeAll(async () => {
    page = await bootPage();
    ({ handle } = page);
    generatedAt = handle.meta.generated_at; reply = generatedAt; calls = [];
    realFetch = globalThis.fetch;
    globalThis.fetch = (url, options) => { calls.push([String(url), options && options.cache]); return Promise.resolve({ ok: true, json: () => Promise.resolve({ generated_at: reply, events: [] }) }); };
  }, 30000);
  afterAll(async () => { globalThis.fetch = realFetch; await page.cleanup(); });

  it("a return within 15 minutes of the last check asks for nothing [1682]", async () => {
    expect(document.visibilityState).toBe("visible");
    back(); await settle();
    expect(calls).toHaveLength(0);
  });
  it("after the interval, two visibility events in a row make one check, of data/2026/events.json with cache: no-cache [1683]", async () => {
    handle.setTimeOverride("2026-09-05T13:21");                  // sixteen minutes on
    back(); back(); await settle();
    expect(calls).toEqual([["data/2026/events.json", "no-cache"]]);
  });
  it("an unchanged schedule shows no pill and leaves the freshness alone [1684]", () => {
    expect(document.getElementById("updatePill").hidden).toBe(true);
    expect(handle.meta.generated_at).toBe(generatedAt);
  });

  describe("pageshow, with a newer schedule waiting", () => {
    let underMain;
    const newer = () => new Date(new Date(generatedAt).getTime() + 3600000).toISOString();

    beforeAll(async () => {
      handle.setTimeOverride("2026-09-05T13:37");                // another sixteen
      reply = newer();
      const seen = [];
      const observer = new MutationObserver(records => seen.push(...records));
      observer.observe(document.querySelector("main"), { childList: true, subtree: true, attributes: true, characterData: true });
      window.dispatchEvent(new Event("pageshow"));
      await page.until(() => !document.getElementById("updatePill").hidden, 2000, "the pill");
      seen.push(...observer.takeRecords());
      observer.disconnect();
      underMain = seen.length;
    });

    it("pageshow checks too, and a newer generated_at shows the pill and updates the freshness text [1685]", () => {
      expect(calls).toHaveLength(2);
      expect(document.getElementById("updatePill").hidden).toBe(false);
      expect(handle.meta.generated_at).toBe(newer());
      expect(document.getElementById("fresh").textContent).toMatch(/refreshed/);
    });
    /* the harness looked for render() in recheckSchedule's source */
    it("the check never re-renders under the reader; the pill offers the reload [1687]", () => {
      expect(document.querySelectorAll("main .row").length).toBeGreaterThan(0);
      expect(underMain).toBe(0);
    });
  });
});
