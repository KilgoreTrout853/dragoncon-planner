/* The icons and the link preview, rendered from their drawings (DECISIONS
   #102). Run by hand, never by the build or CI:

     node tools/render-icons.mjs            into public/
     node tools/render-icons.mjs <folder>   into a folder of your own

   Three drawings, six PNGs:

     public/icon.svg                 icon-180.png, icon-192.png, icon-512.png
     tools/icons/icon-maskable.svg   icon-maskable-192.png, icon-maskable-512.png
     tools/icons/og-image.svg        og-image.png, 1200x630

   Each is drawn at its own size by the Chromium the browser tests drive
   (@playwright/test), not scaled from a larger one, and written RGB with no
   alpha. og-image.svg's words are set in Barlow Semi Condensed 700, which the
   drawing does not carry: the face comes from
   @fontsource/barlow-semi-condensed, and nothing is fetched.

   What this writes carries no credentials block, so the committed images are
   the design's own files until a drawing changes.

   It stops, writing nothing more, where a screenshot is not 8-bit RGB, where
   a page asked for anything off this machine, and where Barlow 700 is not
   the face the words were measured in - a fallback face would change the
   words without a sound. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "public"));
const FAMILY = "Barlow Semi Condensed";
const FONT = path.join(ROOT, "node_modules", "@fontsource", "barlow-semi-condensed", "files", "barlow-semi-condensed-latin-700-normal.woff2");

const ICON = path.join(ROOT, "public", "icon.svg");
const MASKABLE = path.join(ROOT, "tools", "icons", "icon-maskable.svg");
const PREVIEW = path.join(ROOT, "tools", "icons", "og-image.svg");
const JOBS = [
  { from: ICON, to: "icon-180.png", width: 180, height: 180 },
  { from: ICON, to: "icon-192.png", width: 192, height: 192 },
  { from: ICON, to: "icon-512.png", width: 512, height: 512 },
  { from: MASKABLE, to: "icon-maskable-192.png", width: 192, height: 192 },
  { from: MASKABLE, to: "icon-maskable-512.png", width: 512, height: 512 },
  { from: PREVIEW, to: "og-image.png", width: 1200, height: 630, words: true },
];

/* A PNG's header: its size, and whether it is 8-bit RGB - colour type 2,
   which has no alpha. */
function header(png) {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20), rgb: png[24] === 8 && png[25] === 2 };
}

/* Barlow 700, loaded and measured, as the browser tests' barlow() has it
   (tests/browser/harness.js): asked for by name, answered by a face that
   loaded, and a width the fallback does not give. */
async function barlow(page) {
  const got = await page.evaluate(async family => {
    const probe = document.createElement("span");
    probe.style.cssText = "position:fixed;visibility:hidden;white-space:nowrap;font-size:74px;font-weight:700";
    probe.textContent = "Dragon Con planner";
    document.body.appendChild(probe);
    let faces;
    try { faces = (await document.fonts.load(`700 74px "${family}"`)).map(face => face.status); }
    catch (e) { faces = [`failed: ${e.message}`]; }
    probe.style.fontFamily = `"${family}", monospace`;
    const width = probe.getBoundingClientRect().width;
    probe.style.fontFamily = "monospace";
    const differs = width !== probe.getBoundingClientRect().width;
    probe.remove();
    await document.fonts.ready;
    return { faces, differs };
  }, FAMILY);
  if (got.faces.length !== 1 || got.faces[0] !== "loaded" || !got.differs) {
    throw new Error(`render-icons: Barlow 700 is not the face the words are drawn in: ${JSON.stringify(got)}`);
  }
}

const face = `@font-face { font-family: "${FAMILY}"; font-style: normal; font-weight: 700; src: url(data:font/woff2;base64,${fs.readFileSync(FONT).toString("base64")}) format("woff2"); }`;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const { from, to, width, height, words } of JOBS) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const asked = [];
    page.on("request", request => { if (!request.url().startsWith("data:")) asked.push(request.url()); });
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${words ? face : ""}
      html, body { margin: 0; overflow: hidden; } svg { display: block; width: ${width}px; height: ${height}px; }
    </style>${fs.readFileSync(from, "utf8")}`);
    if (words) await barlow(page);
    const png = await page.screenshot({ type: "png" });
    await page.close();
    if (asked.length) throw new Error(`render-icons: ${to}: the page asked for ${asked.join(", ")}`);
    const is = header(png);
    if (!is.rgb || is.width !== width || is.height !== height) {
      throw new Error(`render-icons: ${to}: the screenshot is not ${width}x${height} 8-bit RGB: ${JSON.stringify(is)}`);
    }
    fs.writeFileSync(path.join(OUT, to), png);
    console.log(`wrote ${path.join(OUT, to)} (${width}x${height}, ${png.length.toLocaleString("en-US")} bytes)`);
  }
} finally {
  await browser.close();
}
