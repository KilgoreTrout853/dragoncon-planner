// @vitest-environment node
/* The build's contract (DECISIONS #15, #23): what `vite build` leaves in the
   output folder, stamped and unstamped. Cases 1-4 are build.py's old tests;
   5-7 pin the shape the deploy and the build smoke depend on. Each case
   runs the real CLI into a temp folder, so this is slow by unit-test
   standards - a second or so a build.

   Below them, the checks of the build output that came from the old smoke
   harness, one for one (the number in brackets is its line;
   tests/PORT-LEDGER.md), and
   the "dist boots" smoke: the built page, run for real in a JSDOM of its own. */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseAst } from "vite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VITE = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "dc-build-"));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

let n = 0;
/* env always names both stamps, so a DC_CHANNEL in the caller's shell cannot leak in */
function build(env) {
  const out = path.join(TMP, `site-${++n}`);
  try {
    const stdout = execFileSync(process.execPath, [VITE, "build", "--outDir", out, "--logLevel", "warn"],
      { cwd: ROOT, env: { ...process.env, DC_CHANNEL: "", DC_BUILD: "", ...env }, encoding: "utf8", stdio: "pipe" });
    return { ok: true, out, stdout, stderr: "" };
  } catch (e) {
    return { ok: false, out, stdout: String(e.stdout || ""), stderr: String(e.stderr || "") };
  }
}
const read = (...parts) => fs.readFileSync(path.join(...parts), "utf8");
const exists = (...parts) => fs.existsSync(path.join(...parts));
const SLOW = { timeout: 120_000 };

describe("vite build", () => {
  const plain = build({});          // shared by the cases that only read an unstamped build

  it("stamps the page and the worker for a channel", SLOW, () => {
    const r = build({ DC_CHANNEL: "next", DC_BUILD: "abc1234" });
    expect(r.ok, r.stderr).toBe(true);
    const html = read(r.out, "index.html"), sw = read(r.out, "sw.js");
    expect(html).toContain('<meta name="dc-channel" content="next">');
    expect(html).toContain('<meta name="dc-build" content="abc1234">');
    expect(sw).toContain('const CHANNEL = "next";');
    expect(sw.replaceAll("dc26${", "")).not.toContain("dc26-v4");      // the name is built from the prefix
    expect(exists(r.out, "data", "2026", "events.json")).toBe(true);
    expect(exists(r.out, ".nojekyll")).toBe(true);
    for (const absent of ["tests", "src", "scraper.py", "README.md", "node_modules", "package.json"]) {
      expect(exists(r.out, absent), absent).toBe(false);
    }
  });

  it("leaves both stamps empty and the worker untouched with no channel", SLOW, () => {
    expect(plain.ok, plain.stderr).toBe(true);
    const html = read(plain.out, "index.html");
    expect(html).toContain('<meta name="dc-channel" content="">');
    expect(html).toContain('<meta name="dc-build" content="">');
    for (const f of ["sw.js", "manifest.json", "icon.svg"]) {
      expect(fs.readFileSync(path.join(plain.out, f)).equals(fs.readFileSync(path.join(ROOT, "public", f))), f).toBe(true);
    }
    expect(read(plain.out, "sw.js")).toContain('const CHANNEL = "";');
  });

  it("defaults the build id to the commit", SLOW, () => {
    const r = build({ DC_CHANNEL: "next" });
    expect(r.ok, r.stderr).toBe(true);
    const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
    expect(sha).not.toBe("");
    expect(read(r.out, "index.html")).toContain(`<meta name="dc-build" content="${sha}">`);
  });

  it("refuses a bad channel", SLOW, () => {
    const r = build({ DC_CHANNEL: "Next Site" });
    expect(r.ok).toBe(false);
    expect(r.stderr + r.stdout).toMatch(/channel/);
  });

  it("emits one classic script at the end of the body and no separate assets", SLOW, () => {
    const html = read(plain.out, "index.html");
    expect(html).not.toContain("<script src");
    expect(html).not.toMatch(/<script\b[^>]*\bsrc=/);
    expect(html).not.toContain('<link rel="stylesheet"');      // the webfont link, which stays, is written <link href=… rel=…>
    expect(html.match(/<script\b[^>]*>/g)).toEqual(["<script>"]);
    expect(html.match(/<style\b[^>]*>/g)).toEqual(["<style>"]);
    const open = html.indexOf("<script>"), close = html.indexOf("</script>");
    expect(open).toBeGreaterThan(html.indexOf("</head>"));
    expect(html.slice(html.indexOf("<body>"), open)).toContain('id="sheetWrap"');     // the last body element comes first
    expect(html.slice(close + "</script>".length).replace(/\s+/g, "")).toBe("</body></html>");
    expect(fs.readdirSync(plain.out).sort()).toEqual([".nojekyll", "data", "icon-180.png", "icon-192.png", "icon-512.png",
      "icon.svg", "index.html", "manifest.json", "og-image.png", "sw.js"]);
  });

  it("keeps the head's links to the public files relative", SLOW, () => {
    const head = read(plain.out, "index.html").split("</head>")[0];
    expect(head).toContain('<link rel="manifest" href="./manifest.json">');
    expect(head).toContain('<link rel="icon" href="./icon.svg" type="image/svg+xml">');
    expect(head).toContain('<link rel="apple-touch-icon" href="./icon-180.png">');
  });

  /* The page's top-level names are its test surface, and "zero behaviour
     change" is only checkable if the bundler changes nothing. Compare the
     bundled app with src/app.js tree against tree: formatting, quote style
     and comments do not count; a renamed binding, a folded constant or a
     const turned into var does. `let a, b` and `let a; let b` are the same. */
  it("bundles src/app.js as the same program, and src/styles.css byte for byte", SLOW, () => {
    const html = read(plain.out, "index.html");
    const css = html.slice(html.indexOf("<style>") + "<style>".length, html.indexOf("</style>"));
    expect(css === read(ROOT, "src", "styles.css")).toBe(true);

    const js = html.slice(html.indexOf("<script>") + "<script>".length, html.indexOf("</script>"));
    const from = js.indexOf("//#region src/app.js");
    expect(from).toBeGreaterThan(-1);
    const built = js.slice(from, js.indexOf("//#endregion", from));

    const strip = node => {
      if (Array.isArray(node)) return node.map(strip);
      if (!node || typeof node !== "object") return node;
      const out = {};
      for (const [k, v] of Object.entries(node)) {
        if (["start", "end", "loc", "range", "raw"].includes(k)) continue;
        out[k] = typeof v === "bigint" || v instanceof RegExp ? String(v) : strip(v);
      }
      if (node.type === "TemplateElement") out.value = { cooked: node.value.cooked };
      return out;
    };
    /* src/app.js exports boot() and its test surface. The bundle has one
       entry and nothing importing from it, so it prints the same
       declarations without the keyword and no export list. Unwrap and drop
       on the source side only: an export left in the bundle still fails. */
    const unexport = body => body
      .filter((st, i) => !(i === body.length - 1 && st.type === "ExportNamedDeclaration" && !st.declaration))
      .map(st => st.type === "ExportNamedDeclaration" && st.declaration ? st.declaration : st);
    const statements = (code, normalise = body => body) => normalise(parseAst(code, { lang: "js", sourceType: "module" }).body)
      .filter(st => st.type !== "ImportDeclaration")
      .flatMap(st => st.type === "VariableDeclaration" ? st.declarations.map(d => ({ ...st, declarations: [d] })) : [st])
      .map(st => JSON.stringify(strip(st)));

    const a = statements(read(ROOT, "src", "app.js"), unexport), b = statements(built);
    const firstDiff = a.findIndex((st, i) => st !== b[i]);
    expect(firstDiff === -1 ? "" : `statement ${firstDiff}: ${a[firstDiff].slice(0, 200)}`).toBe("");
    expect(b.length).toBe(a.length);
  });

  /* 1292, 1331 and 1332 (the manifest and apple-touch-icon links) and 1987
     (both stamps empty) are cases 6 and 2 above, which already assert them. */
  describe("the head of the built page", () => {
    const html = () => read(plain.out, "index.html");

    it("the page opts into drawing under the bars, which is why the header pads for them [752]", () => {
      expect(html()).toContain("viewport-fit=cover");
    });
    it("the iOS status bar is opaque: translucent leaves the web view short by its height on iOS 26 [753]", () => {
      expect(html()).toMatch(/apple-mobile-web-app-status-bar-style" content="black"/);
    });
    it("the home-screen title is DC26 [1293]", () => {
      expect(html()).toMatch(/<meta name="apple-mobile-web-app-title" content="DC26">/);
    });
    it.each(["og:title", "og:description", "og:image", "og:url", "og:type"])("the head carries %s [1295]", tag => {
      expect(html()).toMatch(new RegExp(`<meta property="${tag}" content="[^"]+">`));
    });
    it("og:image is an absolute URL on the Pages site [1297]", () => {
      expect(html()).toMatch(/<meta property="og:image" content="https:\/\/kilgoretrout853\.github\.io\/dragoncon-planner\/og-image\.png">/);
    });
    it("and the card is the large-image kind [1298]", () => {
      expect(html()).toMatch(/<meta name="twitter:card" content="summary_large_image">/);
    });
  });

  describe("the service worker registration, in the built script", () => {
    const html = () => read(plain.out, "index.html");

    it("the page registers ./sw.js by relative path, so its scope stays under /dragoncon-planner/ [1284]", () => {
      expect(html()).toMatch(/navigator\.serviceWorker\.register\(\s*["']\.\/sw\.js["']\s*\)/);
    });
    it("registration is guarded by a serviceWorker capability check [1286]", () => {
      expect(html()).toMatch(/if\s*\(\s*["']serviceWorker["']\s+in\s+navigator\s*\)/);
    });
  });

  describe("dist/sw.js", () => {
    const sw = () => read(plain.out, "sw.js");

    it("sw.js parses [1282]", () => {
      expect(() => new Function(sw())).not.toThrow();
    });
    it.skip("sw.js parses: the catch arm of 1282; it runs only when sw.js fails to parse, and then 1282 has already failed [1283]", () => {});
    it("the cache name is versioned (v4) under a prefix the build can stamp, and only that prefix is cleared [1290]", () => {
      expect(sw()).toMatch(/const CHANNEL = "";/);
      expect(sw()).toMatch(/const CACHE = `\$\{CACHE_PREFIX\}v4`;/);
      expect(sw()).toMatch(/n\.startsWith\(CACHE_PREFIX\) && n !== CACHE/);
    });
    it("the worker precaches the icons [1307]", () => {
      expect(sw()).toMatch(/SHELL = \[[^\]]*"\.\/icon-180\.png"[^\]]*"\.\/icon-512\.png"/);
    });
    it("the html fetch stores its response whenever it lands [1309]", () => {
      expect(sw()).toMatch(/function fetchAndCache\(request\)/);
      expect(sw().slice(sw().indexOf("function fetchAndCache"))).toMatch(/cache\.put\(request, res\.clone\(\)\)/);
    });
    it("and is kept alive past the response with waitUntil [1311]", () => {
      expect(sw()).toMatch(/const net = fetchAndCache\(request\);[\s\S]{0,120}event\.waitUntil\(net/);
    });
    it("while the race uses that same fetch rather than a second one [1312]", () => {
      expect(sw()).toMatch(/networkFirst\(request, net\)/);
    });
    it("older caches under this site's prefix are deleted on activate [1313]", () => {
      expect(sw()).toMatch(/startsWith\(CACHE_PREFIX\) && n !== CACHE[\s\S]{0,80}caches\.delete/);
    });
    it("the html network race times out at 3s [1314]", () => {
      expect(sw()).toMatch(/HTML_TIMEOUT_MS\s*=\s*3000/);
    });
    it("the worker only announces an update when generated_at actually changed [1315]", () => {
      expect(sw()).toMatch(/schedule-updated/);
      expect(sw()).toMatch(/generated_at !== /);
    });
    it("font requests are cached, opaque allowed [1317]", () => {
      expect(sw()).toMatch(/fonts\.gstatic\.com/);
      expect(sw()).toMatch(/opaque/);
    });
    it("the background revalidation is kept alive with waitUntil [1321]", () => {
      expect(sw()).toMatch(/event\.waitUntil\(update/);
    });
    it("and waitUntil is called synchronously in the fetch handler, before respondWith [1322]", () => {
      expect(sw().indexOf("event.waitUntil(update")).toBeGreaterThan(-1);
      expect(sw().indexOf("event.waitUntil(update")).toBeLessThan(sw().indexOf("event.respondWith(cachedDataOr"));
    });
    it("the version that could be killed mid-check is gone [1324]", () => {
      expect(sw()).not.toMatch(/staleWhileRevalidate/);
    });
    it("the worker reports offline when revalidation fails [1363]", () => {
      expect(sw()).toMatch(/catch \(e\) \{[\s\S]{0,500}?tellClients\(\{type: "schedule-offline"\}\)/);
    });
    it("the worker reports back online when it succeeds [1365]", () => {
      expect(sw()).toMatch(/schedule-online/);
    });
  });

  describe("the manifest and the icons", () => {
    const manifest = () => JSON.parse(read(plain.out, "manifest.json"));

    it("the manifest offers 192 and 512 PNGs, any and maskable [1301]", () => {
      const png = manifest().icons.filter(i => i.type === "image/png");
      expect(png.some(i => i.sizes === "192x192" && i.purpose === "any")).toBe(true);
      expect(png.some(i => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
    });
    it.each(["icon-180.png", "icon-192.png", "icon-512.png", "og-image.png"])("%s exists and is a PNG [1305]", file => {
      const bytes = fs.readFileSync(path.join(plain.out, file));
      expect(bytes.length).toBeGreaterThan(1000);
      expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    });
    it("manifest names the app [1327]", () => {
      expect(manifest().name).toBe("Dragon Con 2026");
      expect(manifest().short_name).toBe("DC26");
    });
    it("manifest is standalone from ./ [1328]", () => {
      expect(manifest().display).toBe("standalone");
      expect(manifest().start_url).toBe("./");
    });
    it("manifest colours match the app [1329]", () => {
      expect(manifest().background_color).toBe("#171A33");
      expect(manifest().theme_color).toBe("#171A33");
    });
    it("manifest points at the icon [1330]", () => {
      expect(manifest().icons.some(i => i.src === "./icon.svg")).toBe(true);
    });
    it("the icon file exists [1333]", () => {
      expect(exists(plain.out, "icon.svg")).toBe(true);
    });
  });

  /* What only the built artifact can prove: that the one classic script
     boots. Its own JSDOM, not Vitest's environment, running the page's
     script for real. Nothing hands it the schedule: fetch is stubbed to
     serve the sample fixture, so the page takes the path the live site
     takes. The error listener is the harness's last line. */
  describe("the built page boots", () => {
    let dom;
    const errors = [];
    const until = async (holds, what, ms = 20_000) => {
      const deadline = performance.now() + ms;
      while (!holds()) {
        if (performance.now() > deadline) throw new Error(`the built page: ${what} did not happen within ${ms} ms`);
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    };

    beforeAll(async () => {
      const fixture = JSON.parse(read(ROOT, "tests", "sample-events.json"));
      dom = new JSDOM(read(plain.out, "index.html"), {
        runScripts: "dangerously", pretendToBeVisual: true, url: "https://example.test/?now=2026-09-05T13:05",
        beforeParse(window) {
          window.addEventListener("error", e => errors.push(e.message));
          window.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(fixture) });
          const worker = new window.EventTarget();
          worker.register = () => Promise.resolve({});
          worker.controller = null;
          Object.defineProperty(window.navigator, "serviceWorker", { value: worker, configurable: true });
        },
      });
      await until(() => dom.window.document.querySelector("#view-now .row"), "the first screen");
    }, 60_000);
    afterAll(() => dom && dom.window.close());

    it("the first screen renders", () => {
      const doc = dom.window.document;
      expect(doc.getElementById("clock").textContent).toMatch(/^Sat 1:05 PM/);
      expect(doc.getElementById("fresh").textContent).toMatch(/[\d,]+ events · refreshed/);
      expect(doc.querySelectorAll("#view-now .row").length).toBeGreaterThan(0);
    });
    it("a search returns rows, once the bundled index has built", SLOW, async () => {
      const doc = dom.window.document;
      doc.querySelector('.nav button[data-tab="browse"]').click();
      const box = doc.getElementById("q");
      box.value = "trek";
      box.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      /* a <mark> is drawn only for a ranked hit, so it is the index answering, not the unfiltered list */
      await until(() => doc.querySelector("#view-browse .row mark"), "a highlighted search result");
      expect(doc.querySelectorAll("#view-browse .row").length).toBeGreaterThan(0);
    });
    it("no uncaught error fired", () => {
      expect(errors).toEqual([]);
    });
  });
});
