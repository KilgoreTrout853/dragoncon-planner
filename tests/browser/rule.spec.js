/* The standing checks' rule, held on a page of its own (DECISIONS #81):
   harness.js layout() flags what is cut and nothing that is not. The real
   page shows only that nothing is flagged today; this shows the rule can
   still flag - a control cut by an ancestor, by a positioned one, by the
   screen - and still stops at a scroller. No schedule, no face: every box
   here has its size written on it. */
import { check, expect, test } from "./harness.js";

const PAGE = `<!doctype html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; }
  button { display: inline-block; width: 80px; height: 20px; margin: 0; padding: 0; border: 0; }
  [hidden] { display: none; }
  .clip { width: 100px; height: 40px; overflow: hidden; white-space: nowrap; }
  .scroller { width: 100px; height: 40px; overflow: auto; white-space: nowrap; }
  .bar { position: fixed; left: 0; right: 0; bottom: 0; height: 40px; }
</style>
<main>
  <div class="clip" id="plain"><button id="inside"></button><button id="cut"></button><button id="not-shown" hidden></button></div>
  <div class="scroller"><button id="first"></button><button id="past-a-scrollers-edge"></button></div>
  <div class="clip"><div class="scroller" style="width: 300px"><button id="past-a-scroller-in-a-clip" style="margin-left: 280px"></button></div></div>
  <div class="clip"><button id="absolute-held-by-the-page" style="position: absolute; left: 150px; top: 200px"></button></div>
  <div class="clip" id="positioned" style="position: relative"><button id="absolute-cut" style="position: absolute; left: 60px; top: 0"></button></div>
  <div class="clip" style="overflow: clip visible" id="clip-x"><button id="first-in-clip-x"></button><button id="cut-by-clip"></button></div>
</main>
<div class="bar"><button id="fixed-inside"></button><button id="fixed-past-the-screen" style="position: relative; left: 100vw"></button></div>`;

const flagged = cut => cut.map(line => /^(\S+) is cut on ([xy]) by (.+): it runs/.exec(line).slice(1).join(" "));

test("a control is flagged where an ancestor, or the screen, cuts it, and not past a scroller's edge", async ({ page }) => {
  await page.setContent(PAGE);
  const found = await check(page);
  /* every button but the one that is not shown */
  expect(found.count).toBe(11);
  expect(found.sideways).toEqual([]);
  expect(flagged(found.cut)).toEqual([
    "button#cut x div#plain",
    "button#absolute-cut x div#positioned",
    "button#cut-by-clip x div#clip-x",
    "button#fixed-past-the-screen x the screen",
  ]);
});

test("main wider than its box, and a page wider than the screen, scroll sideways", async ({ page }) => {
  await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
    <style>body { margin: 0; } main { width: 100px; overflow: auto; }</style>
    <main><div style="width: 300px; height: 10px"></div></main><div style="width: 200vw; height: 10px"></div>`);
  /* Chromium, as a phone, zooms out to fit, and its window is then as wide
     as the page: the screen's width is the project's. */
  const found = await check(page);
  expect(found.sideways.map(line => line.split(" is ")[0])).toEqual(["main", "html", "body"]);
});
