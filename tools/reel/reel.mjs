/* The teaser reel (DECISIONS #105): a film of the app's key features, about
   a minute long, recorded by script so that it can be recorded again
   whenever the app changes. A tool beside the app: it changes nothing a
   reader of the app sees, and no test or build runs it.

     npm --prefix tools/reel ci              once: ffmpeg, pinned (ffmpeg-static)
     node tools/reel/reel.mjs                the whole film, tools/out/reel/teaser.mp4
     node tools/reel/reel.mjs --beat 2       one beat alone, by number or by key;
                                             --beat 1,2 records both and joins them
     node tools/reel/reel.mjs --join         the eight clips on disk, joined again

   The storyboard is storyboard.mjs - the words, the moment, the cast and
   each beat's holds - the moves beats.mjs, the pictures cards.html and the
   ffmpeg compose.mjs. The title card stands over the Map's city as the
   build draws it, taken afresh at each run and kept in no file of the repo. Everything is written under tools/out/reel/, which git
   ignores: the build, each beat's frames, its clip and a still of it, the
   pictures, the film and report.json, the numbers.

   Chromium only. The frames are the browser's own, taken by
   Page.startScreencast over a CDP session, which is Chromium's; Playwright's
   recordVideo gives 402 px wide at 25 frames a second.

   What the page is: a build of its own, for the default year, with no
   channel, a default moment - DC_NOW, so no "simulated time" chip - and a
   backend it is told of that does not exist, tests/browser/harness.js
   BACKEND. This script answers that address itself, from
   tests/helpers/backend.js's fake, made afresh for each beat with the crew
   and its picks in it. Barlow comes from @fontsource/barlow-semi-condensed,
   the service worker is blocked, and a request to any other machine is
   refused and stops the run: nothing leaves this one.

   The size: the screen is 804x1624 at a device scale of 1, and the served
   page's viewport meta is rewritten to width=402 as this script serves it -
   index.html is not edited - so the page lays out as a 402x812 phone drawn
   twice the size, which is what the screencast sends. Each frame is kept
   with the moment it was drawn: a still screen is one frame with a long
   duration.

   It fails loudly: a cast id the schedule does not hold, a port that is
   taken, a face that is not Barlow, or a tap whose target is not there,
   named with its beat. */
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { BACKEND, MOTION, ROOT, SEASON, seed } from "../../tests/browser/harness.js";
import { fakeBackend } from "../../tests/helpers/backend.js";
import { BEATS, CAST, MOMENT, WORDS } from "./storyboard.mjs";
import { beats as MOVES } from "./beats.mjs";
import { beatClip, cardClip, facts, findFfmpeg, join, still } from "./compose.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, "tools", "out", "reel");
const BUILD = path.join(OUT, "build");
/* Not 4173 or 4174, the browser tests'. */
const PORT = 4183, ORIGIN = `http://localhost:${PORT}`;
const SCREEN = { width: 804, height: 1624 }, LAYOUT = { width: 402, height: 812 };
const CANVAS = { width: 1080, height: 1920 };
/* Where the phone's screen sits on the canvas, unscaled: the caption's band
   above it. r: its corners. */
const PHONE = { x: (CANVAS.width - SCREEN.width) / 2, y: 236, w: SCREEN.width, h: SCREEN.height, r: 56 };
const VIEWPORT_AS_BUILT = 'content="width=device-width, initial-scale=1, viewport-fit=cover"';
const VIEWPORT_FOR_FILM = `content="width=${LAYOUT.width}, viewport-fit=cover"`;
/* A gap between two frames this long or longer is a view standing still,
   not a move: the holds are several times it. */
const STILL_MS = 250;
const DOT = "reel-dot";

const say = words => console.log(words);
const stopwatch = () => performance.now();
/* The moment on the clock the browser stamps its frames by, in ms. */
const wall = () => performance.timeOrigin + performance.now();

/* ---- What was asked for -------------------------------------------- */
function asked(argv) {
  const args = { join: false, beats: null };
  for (let at = 0; at < argv.length; at++) {
    if (argv[at] === "--join") args.join = true;
    else if (argv[at] === "--beat" && argv[at + 1]) {
      args.beats = argv[++at].split(",").map(name => {
        const beat = BEATS.find(b => String(b.n) === name.trim() || b.key === name.trim());
        if (!beat) throw new Error(`reel: no beat "${name}". The beats: ${BEATS.map(b => `${b.n} ${b.key}`).join(", ")}.`);
        return beat;
      });
    } else throw new Error(`reel: what is "${argv[at]}"? The flags: --beat <number or key>[,...], --join.`);
  }
  return args;
}

/* ---- The cast, against the schedule -------------------------------- */
function castChecked() {
  const schedule = JSON.parse(fs.readFileSync(path.join(ROOT, "data", String(SEASON.year), "events.v2.json"), "utf8")).events;
  const byId = new Map(schedule.map(ev => [ev.id, ev])), wrong = [];
  for (const person of [CAST.reader, ...CAST.mates]) {
    for (const id of person.picks) {
      const ev = byId.get(id);
      if (!ev) wrong.push(`${person.name}: the schedule holds no event ${id}`);
      else if (ev.cancelled || ev.removed) wrong.push(`${person.name}: "${ev.title}" is cancelled`);
    }
  }
  if (wrong.length) throw new Error(`reel: the cast does not stand on data/${SEASON.year}/events.v2.json, so nothing was recorded:\n  ${wrong.join("\n  ")}`);
}

/* ---- The page: built, and served ----------------------------------- */
function build() {
  const env = { ...process.env, DC_YEAR: "", DC_CHANNEL: "", DC_BUILD: "", DC_EMAIL: "", DC_NOW: MOMENT, DC_SUPABASE_URL: BACKEND.url, DC_SUPABASE_KEY: BACKEND.key };
  execFileSync(process.execPath, [path.join(ROOT, "node_modules", "vite", "bin", "vite.js"), "build", "--logLevel", "warn", "--outDir", BUILD, "--emptyOutDir"],
    { cwd: ROOT, env, stdio: ["ignore", process.stderr, process.stderr] });
  const page = fs.readFileSync(path.join(BUILD, "index.html"), "utf8");
  if (!page.includes(VIEWPORT_AS_BUILT)) throw new Error("reel: the built page's viewport meta is not the one this script rewrites; see VIEWPORT_AS_BUILT.");
  if (!page.includes('<meta name="dc-channel" content="">')) throw new Error("reel: the build wears a channel, and so the dev-build mark.");
}

const answers = (port, host) => new Promise(resolve => {
  const socket = net.connect({ port, host });
  socket.once("connect", () => { socket.destroy(); resolve(true); });
  socket.once("error", () => resolve(false));
});
const TYPES = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml" };
async function serve() {
  if (await answers(PORT, "127.0.0.1") || await answers(PORT, "::1")) {
    throw new Error(`reel: port ${PORT} is taken. The reel serves its own build there and never uses a server it finds: stop what is listening on it and run again.`);
  }
  const server = http.createServer((request, response) => {
    const asks = decodeURIComponent(new URL(request.url, ORIGIN).pathname);
    const file = path.join(BUILD, asks.endsWith("/") ? asks + "index.html" : asks);
    if (!file.startsWith(BUILD + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
    let body = fs.readFileSync(file);
    if (path.basename(file) === "index.html") body = Buffer.from(body.toString("utf8").replace(VIEWPORT_AS_BUILT, VIEWPORT_FOR_FILM));
    response.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    response.end(body);
  });
  await new Promise((listening, failed) => { server.once("error", failed); server.listen(PORT, "localhost", listening); });
  return server;
}

/* ---- Barlow, from this repo, as the browser tests serve it ---------- */
const FAMILY = "Barlow Semi Condensed", WEIGHTS = [400, 500, 600, 700];
const FONT_DIR = path.join(ROOT, "node_modules", "@fontsource", "barlow-semi-condensed", "files");
const fontFile = weight => path.join(FONT_DIR, `barlow-semi-condensed-latin-${weight}-normal.woff2`);
const FONT_CSS = WEIGHTS.map(weight => `@font-face { font-family: '${FAMILY}'; font-style: normal; font-weight: ${weight}; font-display: swap; `
  + `src: url(https://fonts.gstatic.com/${path.basename(fontFile(weight))}) format('woff2'); }`).join("\n");
/* The four weights, loaded, and each a width the fallback does not give
   (harness.js barlow()), or the run stops. */
async function barlow(page, where) {
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
      out[weight] = faces.length === 1 && faces[0] === "loaded" && width !== probe.getBoundingClientRect().width;
    }
    probe.remove();
    await document.fonts.ready;
    return out;
  }, { family: FAMILY, weights: WEIGHTS });
  const missing = WEIGHTS.filter(weight => !got[weight]);
  if (missing.length) throw new Error(`reel: ${where}: Barlow ${missing.join(", ")} is not the face on the page.`);
}

/* ---- The backend that does not exist ------------------------------- */
/* The fake, with the reader, the crew and the crewmates' picks in it; the
   reader's own picks are the phone's, and the page's first sync sends them. */
async function backend() {
  const fake = fakeBackend(BACKEND);
  const signUp = async () => JSON.parse(await (await fake.fetch(`${BACKEND.url}/auth/v1/signup`, { method: "POST", headers: { apikey: BACKEND.key }, body: "{}" })).text());
  const reader = await signUp(), members = [[reader.user.id, CAST.reader.name]];
  for (const mate of CAST.mates) {
    const id = (await signUp()).user.id;
    members.push([id, mate.name]);
    for (const event_id of mate.picks) fake.write(id, "picks", { year: SEASON.year, event_id, picked: true, changed_at: CAST.stamped });
  }
  fake.crew({ year: SEASON.year, name: CAST.crew, creator: reader.user.id, members });
  fake.requests.length = 0;
  return { fake, session: { access_token: reader.access_token, refresh_token: reader.refresh_token, user: { id: reader.user.id, email: "", is_anonymous: true } } };
}

/* Everything the page asks of another address: Barlow and the backend are
   answered here, and anything else is refused and remembered. */
async function alone(context, fake, log) {
  await context.route(url => url.origin !== ORIGIN, async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === "fonts.googleapis.com") { log.answered++; return route.fulfill({ contentType: "text/css", body: FONT_CSS }); }
    if (url.hostname === "fonts.gstatic.com") { log.answered++; return route.fulfill({ contentType: "font/woff2", body: fs.readFileSync(path.join(FONT_DIR, path.basename(url.pathname))) }); }
    if (url.origin === BACKEND.url) {
      const cors = { "access-control-allow-origin": ORIGIN, "access-control-allow-headers": "apikey, authorization, content-type, prefer", "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE" };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      /* the fake reads the headers by the names the page wrote them under */
      const sent = request.headers(), headers = { apikey: sent.apikey };
      if (sent.authorization) headers.Authorization = sent.authorization;
      if (sent.prefer) headers.Prefer = sent.prefer;
      try {
        const answer = await fake.fetch(request.url(), { method: request.method(), headers, body: request.postData() ?? undefined });
        log.answered++;
        log.backend.push(`${request.method()} ${url.pathname} ${answer.status}`);
        return route.fulfill({ status: answer.status, headers: cors, contentType: "application/json", body: await answer.text() });
      } catch (e) {
        log.refused.push(`${request.method()} ${url.href}: ${e.message}`);
        return route.abort();
      }
    }
    log.refused.push(`${request.method()} ${url.href}`);
    return route.abort();
  });
}

/* ---- In the page: the dot, the eased scroll, the last scroll -------- */
/* Added before the page's own script. The app has no dot where a tap lands
   and gains none: this is the film's, a 44 px circle that fades in half a
   second, hung on <html> so that no redraw of the body takes it away. */
function inPage(dotId) {
  const reel = window.__reel = { scrolled: 0 };
  window.addEventListener("scroll", () => { reel.scrolled = performance.now(); }, { capture: true, passive: true });
  window.addEventListener("touchstart", e => {
    for (const touch of e.changedTouches) {
      const dot = document.createElement("div");
      dot.style.cssText = `position:fixed;left:${touch.clientX - 22}px;top:${touch.clientY - 22}px;width:44px;height:44px;border-radius:50%;box-sizing:border-box;`
        + "background:rgba(243,239,228,.34);border:2px solid rgba(243,239,228,.75);pointer-events:none;z-index:2147483647";
      dot.setAttribute("aria-hidden", "true");
      document.documentElement.appendChild(dot);
      const fade = dot.animate([{ opacity: 1, transform: "scale(.7)" }, { opacity: .85, transform: "scale(1)", offset: .3 }, { opacity: 0, transform: "scale(1.12)" }], { duration: 500, easing: "ease-out" });
      fade.id = dotId;
      fade.finished.then(() => dot.remove(), () => dot.remove());
    }
  }, { capture: true, passive: true });
  reel.scroll = (selector, to, ms) => new Promise((done, failed) => {
    const el = document.querySelector(selector);
    if (!el) { failed(new Error(`no scroller ${selector}`)); return; }
    const from = el.scrollTop, end = Math.max(0, Math.min(to, el.scrollHeight - el.clientHeight)), began = performance.now();
    const eased = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = now => {
      const t = Math.min(1, (now - began) / ms);
      el.scrollTop = from + (end - from) * eased(t);
      if (t < 1) requestAnimationFrame(step); else done(end);
    };
    requestAnimationFrame(step);
  });
}

/* ---- The page's hands, for beats.mjs -------------------------------- */
function hands(page, beat, marks, began) {
  const named = target => (typeof target === "string" ? { selector: target, text: "" } : { text: "", ...target });
  const stop = words => new Error(`reel: beat ${beat.n} (${beat.key}): ${words}`);
  const h = {
    page,
    hold: ms => page.waitForTimeout(ms),
    /* A move's end: no set of the Map's playing (harness.js MOTION), no
       other animation or transition that ends still running, the dot's
       aside, and no scroll in the last sixth of a second; then two frames. */
    async settle() {
      try {
        await page.waitForFunction(({ motion, dot }) => {
          const moving = document.getAnimations().some(anim => anim.id !== dot && anim.playState === "running"
            && (anim.id === motion || !anim.effect || anim.effect.getComputedTiming().endTime !== Infinity));
          return !moving && performance.now() - window.__reel.scrolled > 160;
        }, { motion: MOTION, dot: DOT }, { polling: "raf", timeout: 8000 });
      } catch (e) { throw stop(`the page did not come to rest: ${e.message.split("\n")[0]}`); }
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    },
    async see(selector, what) {
      if (!await page.evaluate(sel => { const el = document.querySelector(sel); return !!el && el.checkVisibility({ visibilityProperty: true }); }, selector)) {
        throw stop(`${what} is not there: ${selector}`);
      }
    },
    text: selector => page.evaluate(sel => { const el = document.querySelector(sel); return el ? el.innerText || el.textContent || "" : ""; }, selector),
    /* A touch at a point of the target where the target itself answers:
       its middle first, then lower and to each side, since a floor's plate
       is under the one above it but for its strip. Of several matches, the
       first that answers: a tile can stand twice on a page, once off screen. */
    async tap(target, what) {
      const { selector, text } = named(target);
      const at = await page.evaluate(({ selector, text }) => {
        const found = [...document.querySelectorAll(selector)].filter(el => el.checkVisibility({ visibilityProperty: true }) && (el.textContent || "").trim().startsWith(text));
        for (const el of found) {
          const box = el.getBoundingClientRect();
          for (const fy of [0.5, 0.65, 0.8, 0.35, 0.2, 0.92]) {
            for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85]) {
              const x = box.left + box.width * fx, y = box.top + box.height * fy, hit = document.elementFromPoint(x, y);
              if (hit && (hit === el || el.contains(hit))) return { x, y };
            }
          }
        }
        return found.length ? { covered: true } : null;
      }, { selector, text });
      const called = text ? `${selector} "${text}"` : selector;
      if (!at) throw stop(`the tap's target is not there: ${what}: ${called}`);
      if (at.covered) throw stop(`the tap's target is not on screen, or is covered: ${what}: ${called}`);
      if (began.at !== null) marks.push({ what, ms: Math.round(stopwatch() - began.at) });
      await page.touchscreen.tap(at.x, at.y);
    },
    /* to: a top, "end", or {to: a selector, text, gap, at}: that element -
       the first whose words begin with the text, where one is given -
       brought to gap px under the scroller's own top, or, with at: {of,
       edge}, under that edge, "top" or "bottom", of another element: the
       header's foot, the tab bar's top. Or as near as it scrolls. */
    async scroll(scroller, to, ms) {
      const top = await page.evaluate(({ scroller, to }) => {
        const el = document.querySelector(scroller);
        if (!el) return null;
        if (to === "end") return el.scrollHeight - el.clientHeight;
        if (typeof to === "number") return to;
        const target = [...document.querySelectorAll(to.to)].find(found => (found.textContent || "").trim().startsWith(to.text || ""));
        const edge = to.at ? document.querySelector(to.at.of) : el;
        if (!target || !edge) return null;
        return el.scrollTop + target.getBoundingClientRect().top - edge.getBoundingClientRect()[to.at ? to.at.edge : "top"] - (to.gap || 0);
      }, { scroller, to });
      if (top === null) throw stop(`nothing to scroll to: ${scroller}, ${JSON.stringify(to)}`);
      await page.evaluate(([sel, y, time]) => window.__reel.scroll(sel, y, time), [scroller, top, ms]);
    },
    /* A menu set by value - the option whose words begin with these - and
       the change said as a tap would say it. */
    async choose(select, words) {
      const chose = await page.evaluate(({ select, words }) => {
        const el = document.querySelector(select), option = el && [...el.options].find(o => o.value === words || o.textContent.trim().startsWith(words));
        if (!option) return false;
        el.value = option.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }, { select, words });
      if (!chose) throw stop(`the menu ${select} has no "${words}"`);
    },
  };
  return h;
}

/* ---- One beat, recorded --------------------------------------------- */
const tag = beat => `${String(beat.n).padStart(2, "0")}-${beat.key}`;
const median = list => { const sorted = [...list].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0; };

/* The page, opened as the reader's phone, the backend made afresh behind
   it: the schedule in, Barlow the face, the first sync back with the crew.
   screen: its size and device scale - the film's, unless told. */
async function phone(browser, beat, log, { viewport = SCREEN, scale = 1 } = {}) {
  const { fake, session } = await backend();
  /* What the phone holds, by the names src/build.js storageKey() gives a
     build with no channel - harness.js seed() spells them: the session, the
     reader's picks, the install card put off, and Plans on My day. */
  const storage = { session, picks: CAST.reader.picks, nudgeSnoozedUntil: 4102444800000, plansView: "mine" };
  const context = await browser.newContext({
    viewport, deviceScaleFactor: scale, isMobile: true, hasTouch: true, serviceWorkers: "block",
    timezoneId: SEASON.tz, locale: "en-US", storageState: seed(storage, ORIGIN),
  });
  try {
    await alone(context, fake, log);
    await context.addInitScript(inPage, DOT);
    const page = await context.newPage();
    const faults = [];
    page.on("pageerror", e => faults.push(e.message));
    await page.goto(`${ORIGIN}/`);
    await page.waitForFunction(() => { const fresh = document.getElementById("fresh"); return !!fresh && fresh.textContent.trim() !== ""; });
    await barlow(page, `beat ${beat.n} (${beat.key})`);
    const laidOut = await page.evaluate(() => [window.innerWidth, window.innerHeight]);
    if (laidOut[0] !== LAYOUT.width || laidOut[1] !== LAYOUT.height) throw new Error(`reel: the page lays out ${laidOut.join("x")}, not ${LAYOUT.width}x${LAYOUT.height}.`);
    /* the first sync is back: the crew is on the phone */
    const crewKey = seed({ crew: 0 }, ORIGIN).origins[0].localStorage[0].name;
    await page.waitForFunction(([key, people]) => {
      try { const crews = JSON.parse(localStorage.getItem(key) || "[]"); return crews.length === 1 && crews[0].members.length === people; } catch (e) { return false; }
    }, [crewKey, CAST.mates.length + 1]);
    return { context, page, faults };
  } catch (e) {
    await context.close();
    throw e;
  }
}

/* A beat's setup, run: the page at rest after it, and no dot of its taps
   left fading - a frame is kept, and a picture taken, only once every one
   of them is gone. A move that stops the run says which beat it was. */
async function named(beat, work) {
  try { await work(); }
  catch (e) { throw String(e.message).startsWith("reel:") ? e : new Error(`reel: beat ${beat.n} (${beat.key}): ${e.message}`, { cause: e }); }
}
async function setUp(page, h, beat, moves, as = beat) {
  await h.settle();
  await named(beat, () => moves.setup(h, as));
  await h.settle();
  await page.waitForFunction(dot => !document.getAnimations().some(anim => anim.id === dot), DOT, { polling: "raf" });
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
}

/* The title card's picture: the Map's stage - the drawing's own box and
   nothing round it - as the beat the card stands over opens on it, from the
   page this run built, at four times a phone's pixels so that the card can
   draw it larger. One still frame: no dot, and the rings round the hotels
   as they stand before they pulse. */
async function stagePicture(browser, beat, log) {
  const over = BEATS.find(other => other.key === beat.over), moves = over && MOVES[over.key];
  if (!moves) throw new Error(`reel: beat ${beat.n} (${beat.key}) stands over "${beat.over}", which is no recorded beat.`);
  const { context, page, faults } = await phone(browser, beat, log, { viewport: LAYOUT, scale: 4 });
  try {
    await setUp(page, hands(page, beat, [], { at: null }), beat, moves, over);
    const stage = page.locator("#view-map svg:has(.map-city)");
    if (await stage.count() !== 1) throw new Error(`reel: beat ${beat.n} (${beat.key}): the Map's stage is not there: #view-map svg:has(.map-city)`);
    const file = path.join(OUT, "cards", "stage.png");
    await stage.screenshot({ path: file, type: "png", animations: "disabled" });
    if (faults.length) throw new Error(`reel: beat ${beat.n} (${beat.key}): the page threw: ${faults.join("; ")}`);
    return file;
  } finally {
    await context.close();
  }
}

async function record(browser, beat, log) {
  const moves = MOVES[beat.key];
  if (!moves) throw new Error(`reel: beat ${beat.n} (${beat.key}) has no moves in beats.mjs.`);
  const dir = path.join(OUT, "frames", tag(beat));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const { context, page, faults } = await phone(browser, beat, log);
  try {
    const marks = [], began = { at: null }, h = hands(page, beat, marks, began);
    await setUp(page, h, beat, moves);

    /* The frames: each acknowledged as it comes, so that the next is sent,
       and kept with the moment the browser drew it. */
    const cdp = await context.newCDPSession(page), frames = [], written = [];
    let sent = 0;
    cdp.on("Page.screencastFrame", frame => {
      cdp.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => {});
      const file = path.join(dir, `${String(sent++).padStart(5, "0")}.jpg`);
      frames.push({ file, at: frame.metadata.timestamp * 1000 });
      written.push(fs.promises.writeFile(file, Buffer.from(frame.data, "base64")));
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1 });
    await page.waitForFunction(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => done(true)))));
    for (let waited = 0; !frames.length && waited < 50; waited++) await page.waitForTimeout(20);
    if (!frames.length) throw new Error(`reel: beat ${beat.n} (${beat.key}): the browser sent no frame.`);
    /* the clip begins here: what was drawn before it is the first frame's */
    frames.splice(0, frames.length - 1);
    const start = wall();
    began.at = stopwatch();
    frames[0].at = start;
    await named(beat, () => moves.play(h, beat));
    const end = wall();
    await cdp.send("Page.stopScreencast");
    await Promise.all(written);
    await cdp.detach();
    if (faults.length) throw new Error(`reel: beat ${beat.n} (${beat.key}): the page threw: ${faults.join("; ")}`);

    const kept = frames.filter(frame => frame.at <= end);
    const timed = kept.map((frame, i) => ({ file: frame.file, ms: Math.max(1, (i + 1 < kept.length ? kept[i + 1].at : end) - frame.at) }));
    const size = jpegSize(fs.readFileSync(timed[0].file));
    if (size.width !== SCREEN.width || size.height !== SCREEN.height) throw new Error(`reel: beat ${beat.n} (${beat.key}): the frames are ${size.width}x${size.height}, not ${SCREEN.width}x${SCREEN.height}.`);
    /* a gap is a frame's own duration but the last's, which the clip's end cut */
    const gaps = timed.slice(0, -1).map(frame => frame.ms), moving = gaps.filter(ms => ms < STILL_MS);
    const numbers = {
      frames: timed.length, medianGapMs: Number(median(moving).toFixed(1)), worstGapMs: Number(Math.max(0, ...moving).toFixed(1)),
      gapsOver50Ms: moving.filter(ms => ms > 50).length, backend: [...log.backend], marks,
    };
    log.backend.length = 0;
    fs.writeFileSync(path.join(dir, "frames.json"), JSON.stringify({ beat: beat.n, key: beat.key, ...numbers, durationsMs: timed.map(frame => Number(frame.ms.toFixed(2))) }));
    return { timed, numbers };
  } finally {
    await context.close();
  }
}

/* A JPEG's size, from its frame header. */
function jpegSize(jpeg) {
  for (let at = 2; at < jpeg.length;) {
    const marker = jpeg[at + 1], length = jpeg.readUInt16BE(at + 2);
    if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) return { height: jpeg.readUInt16BE(at + 5), width: jpeg.readUInt16BE(at + 7) };
    at += 2 + length;
  }
  return { width: 0, height: 0 };
}

/* ---- The pictures, from cards.html ---------------------------------- */
function colours() {
  const css = fs.readFileSync(path.join(ROOT, "src", "styles.css"), "utf8"), out = {};
  for (const name of ["ink", "line", "text", "muted", "gold"]) {
    const found = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})\\b`).exec(css);
    if (!found) throw new Error(`reel: src/styles.css has no --${name}, and the cards are drawn in the app's own colours.`);
    out[name] = found[1];
  }
  return out;
}
async function pictures(browser, chosen, stage) {
  const dir = path.join(OUT, "cards");
  const page = await browser.newPage({ viewport: CANVAS, deviceScaleFactor: 1 });
  const asks = [];
  page.on("request", request => { if (!/^(data|file):/.test(request.url())) asks.push(request.url()); });
  await page.goto(pathToFileURL(path.join(HERE, "cards.html")).href);
  await page.addStyleTag({ content: WEIGHTS.map(weight => `@font-face { font-family: "${FAMILY}"; font-style: normal; font-weight: ${weight}; `
    + `src: url(data:font/woff2;base64,${fs.readFileSync(fontFile(weight)).toString("base64")}) format("woff2"); }`).join("\n") });
  await barlow(page, "the cards");
  const base = { colours: colours(), phone: PHONE }, made = {};
  const draw = async (name, spec, clear) => {
    await page.evaluate(picture => window.draw(picture).then(() => document.fonts.ready).then(() => true), { ...base, ...spec });
    made[name] = path.join(dir, `${name}.png`);
    await page.screenshot({ path: made[name], type: "png", omitBackground: !!clear });
  };
  await draw("frame", { kind: "frame" }, true);
  for (const beat of chosen) {
    if (beat.card === "title") {
      await draw(tag(beat), { kind: "title", name: WORDS.name, lines: WORDS.lines, picture: pathToFileURL(stage).href });
      /* each large line whole, on one line, inside the card */
      const cut = await page.evaluate(() => [...document.querySelectorAll(".lines div")].filter(line => { const box = line.getBoundingClientRect(); return box.left < 40 || box.right > 1040; }).map(line => line.textContent));
      if (cut.length) throw new Error(`reel: the title card's line does not fit the card: ${cut.join(" | ")}`);
      if (!await page.evaluate(() => { const img = document.querySelector(".behind img"); return !!img && img.complete && img.naturalWidth > 0; })) throw new Error("reel: the title card's picture did not load.");
    } else if (beat.card === "end") await draw(tag(beat), { kind: "end", ending: WORDS.ending, disclaimer: WORDS.disclaimer });
    else await draw(tag(beat), { kind: "ground", caption: beat.caption });
  }
  await page.close();
  if (asks.length) throw new Error(`reel: the cards asked for ${asks.join(", ")}`);
  return made;
}

/* ---- The run -------------------------------------------------------- */
async function main() {
  const args = asked(process.argv.slice(2));
  const chosen = args.join ? [] : args.beats || BEATS, whole = args.join || !args.beats;
  castChecked();
  const { ffmpeg, libx264 } = findFfmpeg();
  say(`ffmpeg: ${ffmpeg}\n  ${libx264}`);
  for (const sub of ["clips", "stills", "cards"]) fs.mkdirSync(path.join(OUT, sub), { recursive: true });
  const clipOf = beat => path.join(OUT, "clips", `${tag(beat)}.mp4`);
  const report = { moment: MOMENT, screen: SCREEN, layout: LAYOUT, beats: [], refused: [] };

  if (chosen.length) {
    /* the page is wanted by every recorded beat, and by a card that stands over one */
    const title = chosen.find(beat => beat.over);
    let server = null;
    const browser = await chromium.launch();
    try {
      if (title || chosen.some(beat => !beat.card)) {
        say(`building the reel's page, at ${MOMENT}, into ${path.relative(ROOT, BUILD)}`);
        build();
        server = await serve();
      }
      const log = { answered: 0, refused: report.refused, backend: [] };
      const stage = title ? await stagePicture(browser, title, log) : null;
      log.backend.length = 0;
      const made = await pictures(browser, chosen, stage);
      for (const beat of chosen) {
        const out = clipOf(beat);
        let seconds, numbers = {};
        if (beat.card) seconds = cardClip({ ffmpeg, picture: made[tag(beat)], seconds: beat.seconds, out });
        else {
          const shot = await record(browser, beat, log);
          numbers = shot.numbers;
          seconds = beatClip({ ffmpeg, ground: made[tag(beat)], frame: made.frame, frames: shot.timed, phone: PHONE, out });
        }
        still({ ffmpeg, clip: out, out: path.join(OUT, "stills", `${tag(beat)}.png`) });
        const { marks, backend: sent, ...counted } = numbers;
        report.beats.push({ beat: beat.n, key: beat.key, seconds: Number(seconds.toFixed(2)), ...counted, marks, backend: sent });
        say(`beat ${beat.n} ${beat.key}: ${seconds.toFixed(2)} s` + (beat.card ? ", a card" : `, ${numbers.frames} frames, median gap ${numbers.medianGapMs} ms, worst ${numbers.worstGapMs} ms while it moves`
          + (numbers.gapsOver50Ms ? `, ${numbers.gapsOver50Ms} over 50 ms` : "")));
      }
      report.answered = log.answered;
    } finally {
      await browser.close();
      if (server) await new Promise(closed => server.close(closed));
    }
    if (report.refused.length) throw new Error(`reel: the page asked another machine for something, and was refused:\n  ${report.refused.join("\n  ")}`);
  }

  const joined = whole ? BEATS : chosen.length > 1 ? chosen : null;
  if (joined) {
    const missing = joined.filter(beat => !fs.existsSync(clipOf(beat)));
    if (missing.length) throw new Error(`reel: no clip yet for ${missing.map(beat => `beat ${beat.n} (${beat.key})`).join(", ")}: record ${missing.length > 1 ? "them" : "it"} first.`);
    const film = path.join(OUT, whole ? "teaser.mp4" : `beats-${joined.map(beat => beat.n).join("-")}.mp4`);
    join({ ffmpeg, clips: joined.map(clipOf), out: film });
    report.film = { file: path.relative(ROOT, film), ...facts(ffmpeg, film) };
    say(`${report.film.file}: ${report.film.codec}, ${report.film.width}x${report.film.height}, ${report.film.fps} frames a second, ${report.film.pixels}, ${report.film.seconds.toFixed(2)} s`);
  }
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1) + "\n");
  if (report.answered) say(`nothing left this machine: ${report.answered} requests off the reel's own server answered here, none refused`);
}

try { await main(); }
catch (e) { console.error(e.message || e); process.exitCode = 1; }
