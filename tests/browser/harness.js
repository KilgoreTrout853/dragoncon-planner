/* The browser tests' harness (DECISIONS #81): what every spec under
   tests/browser/ opens the page with. Vitest's page is jsdom, which knows
   what is on the page and not where, nor how wide; these run the built page
   in real engines, Chromium and WebKit, at the three sizes the reviews use,
   as a phone - touch on - and measure where things are.

   What the page is: dist/, built afresh by serve.js for the default year
   with no channel and no backend. The service worker is blocked and the
   clock is ?now=. Nothing leaves this machine: the two requests the page
   makes of Google Fonts are answered from @fontsource/barlow-semi-condensed,
   a request anywhere else is refused and fails the test, and every test
   waits for Barlow's four weights and fails where one did not load, so no
   width is ever a fallback face's.

   What it is not: an iPhone. No iOS keyboard, no safe-area insets, no
   home-screen app, and IS_IOS is false in both engines - WebKit here is the
   engine on this machine, under its own name, not Safari on a phone. Those
   stay checks on a phone. Nor is it a test of the worker, of offline or of
   install, which are Delivery's (#24), nor a comparison of pictures.

   The states - the engines, the sizes, the clocks, the readers - live here
   and nowhere else: a new one is one line. Nothing waits by the clock. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, expect } from "@playwright/test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
/* The default year's, as the build's: its season file gives the zone every
   time on the page is read in, and its year the storage keys. */
const YEAR = 2026;
const SEASON = JSON.parse(fs.readFileSync(path.join(ROOT, "data", String(YEAR), "season.json"), "utf8"));
const PORT = 4173;
const ORIGIN = `http://localhost:${PORT}`;

/* ---- The states ---------------------------------------------------- */
const ENGINES = ["chromium", "webkit"];
const SIZES = [{ width: 375, height: 667 }, { width: 390, height: 664 }, { width: 402, height: 714 }];
const TABS = ["now", "browse", "explore", "map", "plans"];
/* standing: one of the two the standing checks walk every tab at. The
   chip's tests take all four: each is a clock of another width. */
const CLOCKS = [
  { name: "Saturday 1:05 PM", now: "2026-09-05T13:05", standing: true },
  { name: "Saturday 10:35 PM", now: "2026-09-05T22:35" },
  { name: "before the con, a Thursday at 10:00 AM", now: "2026-08-20T10:00", standing: true },
  { name: "the con's first day, Wednesday 12:00 PM", now: "2026-09-02T12:00" },
];
/* What a reader's phone holds, by the names src/build.js storageKey() keys:
   nine picks - two of Friday's, six of Saturday's, two of them at 1:00 PM,
   one of Sunday's - a work and a person followed, and two tracks muted, one
   of them the picks would have suggested and one with a long name, so the
   standing checks walk Explore with the Muted fold. */
const READERS = {
  "a stranger": {},
  "a reader with picks and follows": {
    picks: [
      "1e3995157984a4c0e6515a2ed62d4003", "1e3995157984a4c0e6515a2ed62d2026", "1e3995157984a4c0e6515a2ed62ec7eb",
      "1e3995157984a4c0e6515a2ed62cee23", "1e3995157984a4c0e6515a2ed6377bf5", "1e3995157984a4c0e6515a2ed62c9070",
      "1e3995157984a4c0e6515a2ed62daba8", "1e3995157984a4c0e6515a2ed62ce249", "1e3995157984a4c0e6515a2ed62ccf66",
    ],
    follows: [{ kind: "work", key: "star-trek" }, { kind: "person", key: "alan-tudyk" }],
    mutes: [{ kind: "track", key: "Main Programming" }, { kind: "track", key: "Live Performances - Hyatt Concourse" }],
  },
};

/* What a context starts with in localStorage, for test.use({storageState}):
   {name: value}, each under the key a build with no channel reads. */
function seed(storage) {
  const localStorage = Object.entries(storage).map(([name, value]) => ({ name: `dc${String(YEAR).slice(2)}.${name}`, value: JSON.stringify(value) }));
  return { cookies: [], origins: localStorage.length ? [{ origin: ORIGIN, localStorage }] : [] };
}

/* ---- Barlow, from this repo ---------------------------------------- */
const FAMILY = "Barlow Semi Condensed";
const WEIGHTS = [400, 500, 600, 700];
const FONT_DIR = path.join(ROOT, "node_modules", "@fontsource", "barlow-semi-condensed", "files");
const fontFile = weight => `barlow-semi-condensed-latin-${weight}-normal.woff2`;
const FONT_CSS = WEIGHTS.map(weight => `@font-face { font-family: '${FAMILY}'; font-style: normal; font-weight: ${weight}; font-display: swap; `
  + `src: url(https://fonts.gstatic.com/${fontFile(weight)}) format('woff2'); }`).join("\n");

const test = base.extend({
  /* Every test's, unasked: the stylesheet and the four files answered from
     the package, and anything else that is not the harness's own server
     refused, remembered and failed on. */
  alone: [async ({ context }, use) => {
    const asked = [];
    await context.route(url => url.origin !== ORIGIN, route => {
      const url = new URL(route.request().url());
      if (url.hostname === "fonts.googleapis.com") return route.fulfill({ contentType: "text/css", body: FONT_CSS });
      if (url.hostname === "fonts.gstatic.com") {
        return route.fulfill({ contentType: "font/woff2", body: fs.readFileSync(path.join(FONT_DIR, path.basename(url.pathname))) });
      }
      asked.push(url.href);
      return route.abort();
    });
    await use(asked);
    expect(asked, "the page asked another machine for something").toEqual([]);
  }, { auto: true }],
});

/* The four weights, loaded, or the test fails: each asked for by name, each
   answered by a face that loaded, and each a width the fallback does not
   give. */
async function barlow(page) {
  const got = await page.evaluate(async ({ family, weights }) => {
    const probe = document.createElement("span");
    probe.style.cssText = "position:fixed;visibility:hidden;white-space:nowrap;font-size:40px";
    probe.textContent = "Sat 1:05 PM 3,459 events refreshed";
    document.body.appendChild(probe);
    const out = {};
    for (const weight of weights) {
      let faces;
      try { faces = (await document.fonts.load(`${weight} 16px "${family}"`)).map(face => face.status); }
      catch (e) { faces = [`failed: ${e.message}`]; }
      probe.style.fontWeight = weight;
      probe.style.fontFamily = `"${family}", monospace`;
      const width = probe.getBoundingClientRect().width;
      probe.style.fontFamily = "monospace";
      out[weight] = { faces, differs: width !== probe.getBoundingClientRect().width };
    }
    probe.remove();
    await document.fonts.ready;
    return out;
  }, { family: FAMILY, weights: WEIGHTS });
  for (const weight of WEIGHTS) expect(got[weight], `Barlow ${weight} loaded, and is what is measured`).toEqual({ faces: ["loaded"], differs: true });
}

/* Two frames: what a draw queued for the next one has run. */
const settled = page => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));

/* The page, at a simulated moment - null for the real clock - once the
   schedule is in and Barlow is the face. hash: what follows the address,
   an Explore page's "#explore=kind:key". */
async function open(page, now, hash = "") {
  await page.goto((now ? `./?now=${now}` : "./") + hash);
  await expect(page.locator("#fresh")).not.toBeEmpty();
  await barlow(page);
  await settled(page);
}

/* A tab, by a tap on the bar: the page draws itself whole, and fits its
   header again with every face in. */
async function tab(page, name) {
  const button = page.locator(`nav button[data-tab="${name}"]`);
  await button.tap();
  await expect(button).toHaveAttribute("aria-current", "page");
  await expect(page.locator(`#view-${name}`)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await settled(page);
}

/* ---- What is read in the page -------------------------------------- */
/* Each function below is handed to page.evaluate(), so it runs in the page
   and can reach nothing in this file. */

/* The two standing checks, as check() below hands them the screen's width.
   selector: the controls to check, every one where it is not given.
   - sideways: main where it is wider than its box, and the page where it is
     wider than the screen - the width the project gives it, not the
     window's: Chromium as a phone zooms out to fit a page that is too wide,
     and its window is then as wide as the fault.
   - cut: every control that is shown and does not lie inside an ancestor
     that clips it - overflow hidden or clip - on each axis, up to the first
     ancestor that scrolls on that axis: what is past a scroller's edge is
     reached by scrolling, and is not cut. An ancestor clips only what it
     contains: a fixed box is held by the screen, or by an ancestor that
     transforms, and an absolute one by its nearest positioned ancestor. So a
     control in a fixed element is checked against what clips it up to that
     element and then against the screen, the last clip: html and body are
     overflow hidden. Half a px of tolerance. Each line names the control
     and the ancestor. */
function layout({ selector, width }) {
  const TOLERANCE = 0.5;
  const root = document.documentElement, main = document.querySelector("main");
  const name = el => {
    if (el === root) return "html";
    if (el === document.body) return "body";
    let said = el.tagName.toLowerCase();
    if (el.id) return `${said}#${el.id}`;
    if (typeof el.className === "string" && el.className.trim()) said += "." + el.className.trim().split(/\s+/).join(".");
    for (const attr of ["data-tab", "data-act", "data-chip", "data-value", "data-id", "name", "type", "aria-label"]) {
      if (el.hasAttribute(attr)) said += `[${attr}="${el.getAttribute(attr).slice(0, 40)}"]`;
    }
    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 30);
    return text ? `${said} "${text}"` : said;
  };

  const sideways = [];
  if (main.scrollWidth > main.clientWidth) sideways.push(`main is ${main.scrollWidth} px wide in ${main.clientWidth}`);
  for (const page of [root, document.body]) {
    if (page.scrollWidth > width) sideways.push(`${name(page)} is ${page.scrollWidth} px wide on a screen of ${width}`);
  }

  const shown = el => {
    if (el.type === "hidden" || !el.checkVisibility({ visibilityProperty: true })) return false;
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };
  /* What an ancestor clips to: its padding box. */
  const clipBox = el => {
    const box = el.getBoundingClientRect(), left = box.left + el.clientLeft, top = box.top + el.clientTop;
    return { left, top, right: left + el.clientWidth, bottom: top + el.clientHeight };
  };
  const clips = overflow => overflow === "hidden" || overflow === "clip";
  const scrolls = overflow => overflow === "auto" || overflow === "scroll";
  const holdsFixed = style => style.transform !== "none" || style.filter !== "none" || /paint|layout|strict|content/.test(style.contain)
    || /transform|filter/.test(style.willChange);
  const AXES = [["x", "left", "right", "overflowX"], ["y", "top", "bottom", "overflowY"]];
  const screen = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  const span = (box, lo, hi) => `${box[lo].toFixed(1)} to ${box[hi].toFixed(1)}`;

  const cut = [];
  let count = 0;
  for (const el of document.querySelectorAll(selector || "button, a[href], input, select, textarea")) {
    if (!shown(el)) continue;
    count++;
    const box = el.getBoundingClientRect(), open = { x: true, y: true };
    let position = getComputedStyle(el).position;
    for (let a = el.parentElement; a && (open.x || open.y); a = a.parentElement) {
      const style = getComputedStyle(a);
      if (position === "fixed" && !holdsFixed(style)) continue;
      if (position === "absolute" && style.position === "static" && !holdsFixed(style)) continue;
      position = style.position;
      const clip = clipBox(a);
      for (const [axis, lo, hi, overflow] of AXES) {
        if (!open[axis]) continue;
        /* html and body never scroll here; the screen below is their clip */
        if (a !== root && a !== document.body && scrolls(style[overflow])) open[axis] = false;
        else if (clips(style[overflow]) && (box[lo] < clip[lo] - TOLERANCE || box[hi] > clip[hi] + TOLERANCE)) {
          cut.push(`${name(el)} is cut on ${axis} by ${name(a)}: it runs ${span(box, lo, hi)}, in ${span(clip, lo, hi)}`);
          open[axis] = false;
        }
      }
    }
    for (const [axis, lo, hi] of AXES) {
      if (open[axis] && (box[lo] < screen[lo] - TOLERANCE || box[hi] > screen[hi] + TOLERANCE)) {
        cut.push(`${name(el)} is cut on ${axis} by the screen: it runs ${span(box, lo, hi)}, in ${span(screen, lo, hi)}`);
      }
    }
  }
  return { sideways, cut, count };
}

/* layout(), run in the page, for the screen this project gives it. */
const check = (page, selector) => page.evaluate(layout, { selector, width: page.viewportSize().width });

/* Whether a tap just inside the middle of each of a control's four edges
   lands on it: what is drawn there answers, and what an ellipsis dropped or
   another box covers does not. */
function answers(selector) {
  const el = document.querySelector(selector), box = el.getBoundingClientRect();
  const x = (box.left + box.right) / 2, y = (box.top + box.bottom) / 2;
  const at = (px, py) => { const hit = document.elementFromPoint(px, py); return !!hit && (hit === el || el.contains(hit)); };
  return { left: at(box.left + 1, y), right: at(box.right - 1, y), top: at(x, box.top + 1), bottom: at(x, box.bottom - 1) };
}

/* The chip's tap area, read as a finger meets it: down the chip's middle,
   every half px of the screen that answers to the chip - the first and the
   last, and whether every one between does - whether 2 px to either side
   of its box does, with the header's box,
   --hdr-h, and what the first px under the header answers to. */
function chipArea() {
  const chip = document.getElementById("simChip"), box = chip.getBoundingClientRect();
  const header = document.querySelector(".hdr"), hdr = header.getBoundingClientRect();
  const x = (box.left + box.right) / 2;
  let top = null, bottom = null, hits = 0;
  for (let y = 0; y <= window.innerHeight / 2; y += 0.5) {
    if (document.elementFromPoint(x, y) !== chip) continue;
    if (top === null) top = y;
    bottom = y;
    hits++;
  }
  const under = document.elementFromPoint(x, hdr.bottom + 0.5);
  const beside = px => document.elementFromPoint(px, (box.top + box.bottom) / 2) === chip;
  return {
    x, top, bottom, unbroken: top !== null && hits === (bottom - top) / 0.5 + 1,
    beside: { left: beside(box.left - 2), right: beside(box.right + 2) },
    header: { top: hdr.top, bottom: hdr.bottom, height: hdr.height },
    hdrH: document.documentElement.style.getPropertyValue("--hdr-h"),
    underHeader: { y: hdr.bottom + 0.5, inHeader: !!under && header.contains(under) },
  };
}

export { ROOT, SEASON, PORT, ORIGIN, ENGINES, SIZES, TABS, CLOCKS, READERS, seed, test, expect, open, tab, check, answers, chipArea };
