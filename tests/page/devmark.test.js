/* The dev-build mark: only on a build stamped with a channel. The number in
   brackets is the harness line the assertion came from (tests/PORT-LEDGER.md).
   The stamps are the two metas the build writes; that the build writes them
   is tests/build.test.js. The channel is in every key the page keeps as well
   (DECISIONS #15, #39); the tests of that are new, not ledger rows, and their
   titles carry no bracket. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

/* Every key the app keeps in localStorage, each written the reader's own way:
   a star, the nudge's Not now, the news dismissed, a follow, the Following
   feed's layout and its fold, Mine's list view, the crowd factor, larger text,
   and the archive notice once the con is over. sessionStorage holds one, the
   simulated clock's, which the page writes as it boots. */
const LOCAL = ["archiveNoticeDismissed", "bigtext", "followingLayout", "followingOpen", "follows", "mineView",
  "nudgeSnoozedUntil", "pickInfo", "pickNews", "picks", "settings"];
function keepEverything({ handle }) {
  document.querySelector("#view-now .row .star").click();
  document.querySelector('#view-now [data-act="nudge-later"]').click();
  handle.news.clear();
  handle.follows.set([{ kind: "track", key: "Science" }]);
  document.querySelector('.nav button[data-tab="explore"]').click();
  document.querySelector('#following [data-act="fol-time"]').click();
  document.querySelector('#following [data-act="fol-toggle"]').click();
  document.querySelector('.nav button[data-tab="mine"]').click();
  document.querySelector('#view-mine [data-act="view-list"]').click();
  const crowd = document.getElementById("crowd");
  crowd.value = "1.5";
  crowd.dispatchEvent(new Event("input"));
  const big = document.getElementById("bigText");
  big.checked = true;
  big.dispatchEvent(new Event("change"));
  handle.setTimeOverride("2026-09-08T09:00");
  document.querySelector('#notice [data-act="dismiss-archive"]').click();
}
const kept = () => ({ local: Object.keys(window.localStorage).sort(), session: Object.keys(window.sessionStorage).sort() });

describe("an unstamped page", () => {
  let page, key;
  beforeAll(async () => { page = await bootPage(); key = page.app.TIME_OVERRIDE_KEY; }, 30000);
  afterAll(() => page.cleanup());

  it("unstamped, there is no mark and no channel [1988]", () => {
    expect(document.querySelector(".devmark")).toBe(null);
    expect(page.app.BUILD).toEqual({ channel: "", id: "" });
  });
  it("and the unstamped page keeps the plain key for its simulated clock [2002, merged into 2000]", () => {
    expect(key).toBe("dc26.timeOverride");
  });
  it("every key is storageKey()'s, and unstamped none carries a channel: each is dc26. and a name", () => {
    expect(page.app.storageKey("picks")).toBe("dc26.picks");
    keepEverything(page);
    expect(kept()).toEqual({ local: LOCAL.map(name => `dc26.${name}`).sort(), session: ["dc26.timeOverride"] });
  });
});

describe("a page stamped with a channel and a build id", () => {
  let page;
  beforeAll(async () => { page = await bootPage({ channel: "next", build: "abc1234" }); }, 30000);
  afterAll(() => page.cleanup());

  it("stamped with a channel, the mark reads dev build · next · build [1995]", () => {
    expect(document.querySelector(".devmark").textContent).toBe("dev build · next · abc1234");
  });
  it("it is decorative [1996, the page half]", () => {
    expect(document.querySelector(".devmark").getAttribute("aria-hidden")).toBe("true");
  });
  it("the device readout names the channel and build [1998]", () => {
    expect(page.app.deviceLine()).toMatch(/next build abc1234/);
  });
  it("and the page otherwise works as it does unstamped [1999]", () => {
    expect(page.text("clock")).toMatch(/^Sat 1:05 PM/);
    expect(document.querySelectorAll("#view-now .row").length).toBeGreaterThan(0);
  });
  it("a stamped page keeps its simulated clock under a key of its own, so it never follows the reader to the live site on the same origin [2000]", () => {
    expect(page.app.TIME_OVERRIDE_KEY).toBe("dc26.timeOverride.next");
    expect(window.sessionStorage.getItem("dc26.timeOverride.next")).toBe("2026-09-05T13:05");
    expect(window.sessionStorage.getItem("dc26.timeOverride")).toBe(null);
  });
  it("storageKey() puts the channel after the name: dc26.picks.next", () => {
    expect(page.app.storageKey("picks")).toBe("dc26.picks.next");
  });
  it("and everything the stamped page keeps, in either storage, ends .next", () => {
    keepEverything(page);
    expect(kept()).toEqual({ local: LOCAL.map(name => `dc26.${name}.next`).sort(), session: ["dc26.timeOverride.next"] });
  });
});

describe("a stamped page on the origin the live site shares", () => {
  /* What the live site keeps there, under the keys with no channel. */
  const LIVE = {
    "dc26.picks": JSON.stringify(["a-live-site-pick"]),
    "dc26.follows": JSON.stringify([{ kind: "track", key: "Science" }]),
    "dc26.settings": JSON.stringify({ crowd: 2.5, hideNoise: false }),
    "dc26.mineView": JSON.stringify("list"),
  };
  let page;
  beforeAll(async () => {
    for (const [key, value] of Object.entries(LIVE)) window.localStorage.setItem(key, value);
    page = await bootPage({ channel: "next", build: "abc1234" });
  }, 30000);
  afterAll(() => page.cleanup());

  it("reads none of it: no picks, no follows, the default settings and view", () => {
    expect(page.handle.picks.get().size).toBe(0);
    expect(page.handle.follows.get()).toEqual([]);
    expect(page.app.settings).toEqual({ crowd: 1.3, hideNoise: true });
    expect(page.handle.state.mineView).toBe("timeline");
  });
  it("keeps a star under its own key, and leaves the live site's keys as they were", () => {
    const star = document.querySelector("#view-now .row .star"), id = star.closest(".row").dataset.id;
    star.click();
    expect(JSON.parse(window.localStorage.getItem("dc26.picks.next"))).toEqual([id]);
    for (const [key, value] of Object.entries(LIVE)) expect(window.localStorage.getItem(key), key).toBe(value);
  });
});
