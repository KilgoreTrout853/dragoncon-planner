/* Boots the app in Vitest's jsdom for a page test. The design, and why each
   step is where it is, is in tests/PORT-LEDGER.md ("Helper design").

   The modules under src/ read the page as they are imported - the meta
   stamps, <main>, the sheet, navigator.platform, matchMedia - so everything
   they read is in place before the import, and the import is fresh every
   time (vi.resetModules). Every module but the entry is imported and their
   exports are merged into one `app`, so a test reaches a name the same way
   wherever it lives. The window outlives the modules, so whatever boot()
   registers on it is recorded and cleanup() takes it off again.

   One boot per file, in beforeAll; tests run in file order and share the
   page, as the harness's sections did. A test that needs a different start -
   seeded storage, a stamp, no ?now= - cleans up and boots again. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { vi } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const FIXTURES = { sample: ["tests", "sample-events.json"], real: ["data", "2026", "events.v2.json"] };
const DEFAULT_NOW = "2026-09-05T13:05";            // the harness's Saturday afternoon

/* index.html is Vite's entry template: its module script and its stylesheet
   links are the build's business, not the page's. */
function template() {
  const html = read("index.html");
  const between = (open, close) => html.slice(html.indexOf(open) + open.length, html.indexOf(close));
  const strip = s => s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "").replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, "");
  return { head: strip(between("<head>", "</head>")), body: strip(between("<body>", "</body>")) };
}

let live = null;

export async function bootPage({ fixture = "sample", now = DEFAULT_NOW, channel = "", build = "", url, matchMedia, reload } = {}) {
  if (live) throw new Error("bootPage: a page is already live in this file; call its cleanup() first");
  const jsdom = globalThis.jsdom;
  if (!jsdom) throw new Error("bootPage needs Vitest's jsdom environment");
  const startUrl = window.location.href;

  /* markup, the stylesheet the built page inlines, the two stamps, the URL */
  const { head, body } = template();
  document.head.innerHTML = head;
  document.body.innerHTML = body;
  const style = document.createElement("style");
  style.textContent = read("src", "styles.css");
  document.head.appendChild(style);
  document.querySelector('meta[name="dc-channel"]').setAttribute("content", channel);
  document.querySelector('meta[name="dc-build"]').setAttribute("content", build);
  jsdom.reconfigure({ url: url || `https://example.test/${now ? `?now=${now}` : ""}` });

  /* what the module reads at import, and what boot() registers against */
  const had = { matchMedia: window.matchMedia, confirm: window.confirm };
  window.matchMedia = query => ({ matches: !!(matchMedia && matchMedia(query)), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.confirm = () => true;
  const sw = new EventTarget();
  sw.register = vi.fn(() => Promise.resolve({}));
  sw.controller = null;
  Object.defineProperty(window.navigator, "serviceWorker", { value: sw, configurable: true });

  /* the harness's last line: any uncaught error in the page fails the run */
  const errors = [];
  const onError = e => errors.push(e.error || e.message);
  window.addEventListener("error", onError);

  /* record what boot() registers on things that outlive the module */
  const listeners = [], intervals = [];
  const targets = [window, document, sw].map(target => ({ target, add: target.addEventListener }));
  targets.forEach(({ target, add }) => {
    target.addEventListener = function (type, fn, options) { listeners.push([target, type, fn, options]); return add.call(target, type, fn, options); };
  });
  const realSetInterval = globalThis.setInterval;
  globalThis.setInterval = (...args) => { const id = realSetInterval(...args); intervals.push(id); return id; };

  /* Every module under src/ except main.js, which is the entry: importing it
     calls boot() with no options. One getter per export, because a module may
     export a let and a copy of its value would go stale; a name exported
     twice is refused, since a test could not say which one it meant. */
  const app = {};
  let handle;
  try {
    vi.resetModules();
    const modules = import.meta.glob(["../../src/*.js", "!../../src/main.js"]);
    for (const [file, load] of Object.entries(modules)) {
      const loaded = await load();
      for (const name of Object.keys(loaded)) {
        if (name in app) throw new Error(`bootPage: two modules under src/ export ${name} (the second is ${file})`);
        Object.defineProperty(app, name, { enumerable: true, get: () => loaded[name] });
      }
    }
    handle = app.boot({ events: JSON.parse(read(...FIXTURES[fixture])), reload });
    await handle.ready;
  } finally {
    targets.forEach(({ target, add }) => { target.addEventListener = add; });
    globalThis.setInterval = realSetInterval;
  }

  const text = id => document.getElementById(id).textContent.replace(/\s+/g, " ").trim();
  async function until(holds, ms = 5000, what = "the condition") {
    const deadline = performance.now() + ms;
    for (;;) {
      const value = holds();
      if (value) return value;
      if (performance.now() > deadline) throw new Error(`until: ${what} did not hold within ${ms} ms`);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  async function cleanup() {
    if (live !== page) return;
    /* let the idle index build and any debounced draw finish against this
       page, not the next one; under fake timers the test has run them */
    if (!vi.isFakeTimers() && app.BOOT.parsed) {
      await until(() => app.BOOT.suggested > 0, 20000, "the index build");
      await new Promise(resolve => setTimeout(resolve, app.SEARCH_DEBOUNCE_MS + 30));
    }
    listeners.forEach(([target, type, fn, options]) => target.removeEventListener(type, fn, options));
    intervals.forEach(id => clearInterval(id));
    window.removeEventListener("error", onError);
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.matchMedia = had.matchMedia;
    window.confirm = had.confirm;
    delete window.navigator.serviceWorker;
    document.documentElement.removeAttribute("class");
    document.documentElement.removeAttribute("style");
    document.body.removeAttribute("class");
    jsdom.reconfigure({ url: startUrl });
    live = null;
    if (errors.length) throw new Error(`uncaught error in the page: ${errors.map(String).join("; ")}`);
  }

  const page = { window, document, app, handle, sw, text, until, cleanup };
  live = page;
  return page;
}
