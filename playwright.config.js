/* The browser tests (DECISIONS #81): `npm run test:browser`. Every spec under
   tests/browser/, in each engine at each size - a project apiece, named for
   both - against the page tests/browser/serve.js builds and serves. The
   states and what the harness is, and is not, are tests/browser/harness.js's. */
import os from "node:os";
import { defineConfig } from "@playwright/test";
import { ENGINES, ORIGIN, SEASON, SIZES } from "./tests/browser/harness.js";

export default defineConfig({
  testDir: "tests/browser",
  testMatch: "*.spec.js",
  globalSetup: "./tests/browser/serve.js",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  /* None, here or in CI: a retry would pass a test that fails one run in
     three. A failure keeps its trace instead. */
  retries: 0,
  /* Four at once at the most, and half the cores where that is fewer - a
     runner's two. With sixteen side by side on one machine WebKit's page
     stood still for seconds now and then, and a tap or a load timed out;
     with eight, and with four, it did not. */
  workers: Math.max(1, Math.min(4, Math.floor(os.availableParallelism() / 2))),
  /* How long a condition may take to come true, not a wait: ten seconds,
     for a slow runner. */
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `${ORIGIN}/`,
    /* A phone: touch, and a phone's viewport. */
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
    serviceWorkers: "block",
    /* The con's zone, the season file's: a time on the page reads the same
       on this machine and on a runner. */
    timezoneId: SEASON.tz,
    locale: "en-US",
    actionTimeout: 10000,
    trace: "retain-on-failure",
  },
  projects: ENGINES.flatMap(engine => SIZES.map(viewport => ({ name: `${engine}-${viewport.width}`, use: { browserName: engine, viewport } }))),
});
