// @vitest-environment node
/* The build's contract (DECISIONS #15, #23, #49): what `vite build` leaves in
   the output folder, stamped and unstamped. Cases 1-4 are build.py's old
   tests; 5-6 pin the shape the deploy and the build smoke depend on; the
   year's cases follow, and a build for a year whose schedule the repo does
   not hold yet, in a temporary copy. Each case runs the real CLI into a temp
   folder, so this is slow by unit-test standards - a second or so a build.

   Below them, the checks of the build output that came from the old smoke
   harness, one for one (the number in brackets is its line;
   tests/PORT-LEDGER.md), and
   the "dist boots" smoke: the built page, run for real in a JSDOM of its own,
   unstamped and then stamped with a channel, which every key it keeps
   carries (DECISIONS #39). */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VITE = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "dc-build-"));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

let n = 0;
/* env always names both stamps and the year, so a DC_CHANNEL or a DC_YEAR in
   the caller's shell cannot leak in. root: a temporary copy to build, with
   the repo's own vite.config.js; the repo itself where there is none. */
function build(env, root) {
  const out = path.join(TMP, `site-${++n}`);
  const args = root ? [VITE, "build", root, "--config", path.join(ROOT, "vite.config.js")] : [VITE, "build"];
  try {
    const stdout = execFileSync(process.execPath, [...args, "--outDir", out, "--logLevel", "warn"],
      { cwd: ROOT, env: { ...process.env, DC_CHANNEL: "", DC_BUILD: "", DC_YEAR: "", ...env }, encoding: "utf8", stdio: "pipe" });
    return { ok: true, out, stdout, stderr: "" };
  } catch (e) {
    return { ok: false, out, stdout: String(e.stdout || ""), stderr: String(e.stderr || "") };
  }
}
/* A temporary copy of the project for a year whose files the repo does not
   hold yet (DECISIONS #49): the page, src/ and public/ copied, node_modules
   linked, and data/<year>/ holding the given files, each written as it is
   given. fs.rm takes the link away and never walks into node_modules. */
function stage(year, files) {
  const root = path.join(TMP, `root-${++n}`);
  fs.mkdirSync(path.join(root, "data", year), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "index.html"), path.join(root, "index.html"));
  for (const dir of ["src", "public"]) fs.cpSync(path.join(ROOT, dir), path.join(root, dir), { recursive: true });
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(root, "node_modules"), "junction");
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(root, "data", year, name), text);
  return root;
}
const read = (...parts) => fs.readFileSync(path.join(...parts), "utf8");
const exists = (...parts) => fs.existsSync(path.join(...parts));
const SLOW = { timeout: 120_000 };
/* The worker's constants as it works them out: its text run with a stand-in
   self that registers nothing. */
const workerConstants = text => new Function("self", `${text}\nreturn {CACHE_PREFIX, CACHE, DATA, SHELL};`)({ addEventListener() {} });
const until = async (holds, what, ms = 20_000) => {
  const deadline = performance.now() + ms;
  while (!holds()) {
    if (performance.now() > deadline) throw new Error(`the built page: ${what} did not happen within ${ms} ms`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};

describe("vite build", () => {
  const plain = build({});          // shared by the cases that only read an unstamped build

  it("stamps the page and the worker for a channel", SLOW, () => {
    const r = build({ DC_CHANNEL: "next", DC_BUILD: "abc1234" });
    expect(r.ok, r.stderr).toBe(true);
    const html = read(r.out, "index.html"), sw = read(r.out, "sw.js");
    expect(html).toContain('<meta name="dc-channel" content="next">');
    expect(html).toContain('<meta name="dc-build" content="abc1234">');
    expect(sw).toContain('const CHANNEL = "next";');
    expect(workerConstants(sw).CACHE).toBe("dc26-next-v6");              // the name is built from the stamps
    expect(exists(r.out, "data", "2026", "events.v2.json")).toBe(true);
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
    expect(read(plain.out, "sw.js")).toContain('const YEAR = "2026";');
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

  /* DECISIONS #49: DC_YEAR is four digits, and names a year whose season and
     venues files are there. */
  it("refuses a year that is not four digits", SLOW, () => {
    for (const year of ["27", "2O27", "20271"]) {
      const r = build({ DC_YEAR: year });
      expect(r.ok, year).toBe(false);
      expect(r.stderr + r.stdout, year).toMatch(/a year is four digits/);
    }
  });

  it("refuses a year with no season file", SLOW, () => {
    const r = build({ DC_YEAR: "2031" });
    expect(r.ok).toBe(false);
    expect(r.stderr + r.stdout).toMatch(/no data\/2031\/season\.json/);
    expect(exists(r.out, "index.html")).toBe(false);
  });

  /* 2027's schedule arrives with its season's first run past the ids stage;
     until then a build for it is made in a temporary copy, with the repo's
     2027 season and venues files and a stand-in schedule: six of the
     sample's Saturday events around 1 PM, untagged, moved to 2027's Saturday. */
  describe("a build for 2027, in a temporary copy", () => {
    const own = name => read(ROOT, "data", "2027", name);
    const sample = JSON.parse(read(ROOT, "tests", "sample-events.json"));
    const moved = s => s.replace("2026-09-05", "2027-09-04");
    const schedule = JSON.stringify({ ...sample, digest: "stand-in", works: [],
      events: sample.events.filter(e => !e.tags && !(e.tracks || []).some(t => /Epic Photos|Video Room/.test(t))
        && e.start >= "2026-09-05T12:00" && e.start <= "2026-09-05T14:00" && e.end.startsWith("2026-09-05")).slice(0, 6)
        .map(e => ({ ...e, day: moved(e.day), start: moved(e.start), end: moved(e.end) })) });

    it("refuses 2027 while it has no schedule, before building anything", SLOW, () => {
      const r = build({ DC_YEAR: "2027" }, stage("2027", { "season.json": own("season.json"), "venues.json": own("venues.json") }));
      expect(r.ok).toBe(false);
      expect(r.stderr + r.stdout).toMatch(/no data\/2027\/events\.v2\.json/);
      expect(exists(r.out, "index.html")).toBe(false);
    });

    it("refuses a season file that names another year", SLOW, () => {
      const r = build({ DC_YEAR: "2027" }, stage("2027", { "season.json": read(ROOT, "data", "2026", "season.json"), "venues.json": own("venues.json"), "events.v2.json": schedule }));
      expect(r.ok).toBe(false);
      expect(r.stderr + r.stdout).toMatch(/data\/2027\/season\.json names the year 2026/);
    });

    describe("with a schedule", () => {
      let r, html, markup;
      beforeAll(() => {
        r = build({ DC_YEAR: "2027" }, stage("2027", { "season.json": own("season.json"), "venues.json": own("venues.json"), "events.v2.json": schedule }));
        html = r.ok ? read(r.out, "index.html") : "";
        markup = html.slice(0, html.indexOf("<script>"));
      }, 120_000);

      it("builds", () => {
        expect(r.ok, r.stderr).toBe(true);
        expect(JSON.parse(schedule).events).toHaveLength(6);
      });
      it("copies the year's schedule from data/, and nothing else", () => {
        const listed = fs.readdirSync(path.join(r.out, "data"), { recursive: true }).map(f => String(f).split(path.sep).join("/")).sort();
        expect(listed).toEqual(["2027", "2027/events.v2.json"]);
        expect(read(r.out, "data", "2027", "events.v2.json")).toBe(schedule);
      });
      it("stamps the worker's year and nothing else: its cache, its schedule and its shell are 2027's", () => {
        const sw = read(r.out, "sw.js");
        expect(sw).toBe(read(ROOT, "public", "sw.js").replace('const YEAR = "2026";', 'const YEAR = "2027";'));
        const { CACHE, DATA, SHELL } = workerConstants(sw);
        expect([CACHE, DATA]).toEqual(["dc27-v6", "data/2027/events.v2.json"]);
        expect(SHELL).toContain("./data/2027/events.v2.json");
      });
      it("stamps the page's name - its title, its head's tags, the brand and the home-screen title", () => {
        expect(markup).toContain("<title>Dragon Con 2027 planner</title>");
        expect(markup).toContain('<meta property="og:title" content="Dragon Con 2027 planner">');
        expect(markup).toContain('<meta name="apple-mobile-web-app-title" content="DC27">');
        expect(markup).toContain('<div class="brand" id="brand">Dragon Con 2027</div>');
        expect(markup).not.toMatch(/2026|DC26/);
      });
      it("and the manifest's name, and nothing else in the manifest", () => {
        const manifest = JSON.parse(read(r.out, "manifest.json")), before = JSON.parse(read(ROOT, "public", "manifest.json"));
        expect([manifest.name, manifest.short_name]).toEqual(["Dragon Con 2027", "DC27"]);
        expect({ ...manifest, name: before.name, short_name: before.short_name }).toEqual(before);
      });

      /* The define, seen from inside: the page fetches, keys and reads its days by 2027. */
      describe("booted", () => {
        let dom;
        const fetched = [], errors = [];
        beforeAll(async () => {
          dom = new JSDOM(html, {
            runScripts: "dangerously", pretendToBeVisual: true, url: "https://example.test/?now=2027-09-04T13:05",
            beforeParse(window) {
              window.addEventListener("error", e => errors.push(e.message));
              window.fetch = url => { fetched.push(String(url)); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(schedule)) }); };
              const worker = new window.EventTarget();
              worker.register = () => Promise.resolve({});
              worker.controller = null;
              Object.defineProperty(window.navigator, "serviceWorker", { value: worker, configurable: true });
            },
          });
          await until(() => dom.window.document.querySelector("#view-now .row"), "the first screen");
        }, 60_000);
        afterAll(() => dom && dom.window.close());

        it("fetches the year's schedule", () => {
          expect(fetched[0]).toBe("data/2027/events.v2.json");
        });
        it("reads the clock by 2027's days", () => {
          expect(dom.window.document.getElementById("clock").textContent).toMatch(/^Sat 1:05 PM/);
        });
        it("keeps a star, and all it keeps, under dc27.", () => {
          const star = dom.window.document.querySelector("#view-now .row .star"), id = star.closest(".row").dataset.id;
          star.click();
          expect(JSON.parse(dom.window.localStorage.getItem("dc27.picks"))).toEqual([id]);
          expect(Object.keys(dom.window.localStorage).filter(k => !k.startsWith("dc27."))).toEqual([]);
          expect(Object.keys(dom.window.sessionStorage)).toEqual(["dc27.timeOverride"]);
        });
        it("offers 2027's days on Search", () => {
          const doc = dom.window.document;
          doc.querySelector('.nav button[data-tab="browse"]').click();
          expect([...doc.querySelectorAll("#dayChips .chip")].map(c => c.dataset.value))
            .toEqual(["All", "2027-09-01", "2027-09-02", "2027-09-03", "2027-09-04", "2027-09-05", "2027-09-06"]);
        });
        it("exports the calendar as 2027's: the file's name, the calendar's and each event's UID", async () => {
          const win = dom.window, doc = win.document, id = JSON.parse(win.localStorage.getItem("dc27.picks"))[0];
          let blob = null, name = "";
          win.URL.createObjectURL = b => { blob = b; return "blob:x"; };
          win.URL.revokeObjectURL = () => {};
          win.HTMLAnchorElement.prototype.click = function () { name = this.download; };
          doc.querySelector('.nav button[data-tab="mine"]').click();
          doc.querySelector('#view-mine [data-act="ics"]').click();
          const text = await blob.text();
          expect(name).toBe("dragoncon-2027-my-schedule.ics");
          expect(text).toContain("X-WR-CALNAME:Dragon Con 2027");
          expect(text).toContain(`UID:dc27-${id}@dragoncon-planner`);
        });
        it("no uncaught error fired", () => {
          expect(errors).toEqual([]);
        });
      });
    });
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

  it("the worker's schedule and shell name files the build ships, the schedule among them", SLOW, () => {
    const { DATA, SHELL } = workerConstants(read(plain.out, "sw.js"));
    expect(DATA).toBe("data/2026/events.v2.json");
    expect(SHELL).toContain("./data/2026/events.v2.json");
    SHELL.filter(p => p !== "./").forEach(p => expect(exists(plain.out, ...p.slice(2).split("/")), p).toBe(true));
  });

  it("copies from data/ the one file the client reads, and nothing else", SLOW, () => {
    const listed = fs.readdirSync(path.join(plain.out, "data"), { recursive: true }).map(f => String(f).split(path.sep).join("/")).sort();
    expect(listed).toEqual(["2026", "2026/events.v2.json"]);
    expect(fs.readFileSync(path.join(plain.out, "data", "2026", "events.v2.json")))
      .toEqual(fs.readFileSync(path.join(ROOT, "data", "2026", "events.v2.json")));
  });

  it("keeps the head's links to the public files relative", SLOW, () => {
    const head = read(plain.out, "index.html").split("</head>")[0];
    expect(head).toContain('<link rel="manifest" href="./manifest.json">');
    expect(head).toContain('<link rel="icon" href="./icon.svg" type="image/svg+xml">');
    expect(head).toContain('<link rel="apple-touch-icon" href="./icon-180.png">');
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

  /* The built script is minified: no whitespace to rely on, an `if` may be
     printed as `&&`, and a string literal as a template, so a quote is any
     of the three. */
  describe("the service worker registration, in the built script", () => {
    const html = () => read(plain.out, "index.html");

    it("the page registers ./sw.js by relative path, so its scope stays under /dragoncon-planner/ [1284]", () => {
      expect(html()).toMatch(/navigator\.serviceWorker\.register\(\s*["'`]\.\/sw\.js["'`]\s*\)/);
    });
    it("registration is guarded by a serviceWorker capability check [1286]", () => {
      expect(html()).toMatch(/["'`]serviceWorker["'`]\s*in\s*navigator/);
    });
  });

  describe("dist/sw.js", () => {
    const sw = () => read(plain.out, "sw.js");

    it("sw.js parses [1282]", () => {
      expect(() => new Function(sw())).not.toThrow();
    });
    it.skip("sw.js parses: the catch arm of 1282; it runs only when sw.js fails to parse, and then 1282 has already failed [1283]", () => {});
    it("the cache name is versioned (v6) under a prefix the build can stamp, and only this site's caches are cleared [1290]", () => {
      expect(sw()).toMatch(/const CHANNEL = "";/);
      expect(sw()).toMatch(/const YEAR = "2026";/);
      expect(sw()).toMatch(/const CACHE = `\$\{CACHE_PREFIX\}v6`;/);
      expect(sw()).toMatch(/OURS\.test\(n\) && n !== CACHE/);
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
    it("this site's older caches, of any year, are deleted on activate [1313]", () => {
      expect(sw()).toMatch(/OURS\.test\(n\) && n !== CACHE[\s\S]{0,80}caches\.delete/);
    });
    it("the html network race times out at 3s [1314]", () => {
      expect(sw()).toMatch(/HTML_TIMEOUT_MS\s*=\s*3000/);
    });
    it("the worker only announces an update when the digest changed, or generated_at where a copy has none [1315]", () => {
      expect(sw()).toMatch(/a\.digest && b\.digest \? a\.digest !== b\.digest : a\.generated_at !== b\.generated_at/);
      expect(sw()).toMatch(/if \(changed\(a, b\)\) \{\s*await tellClients\(\{type: "schedule-updated", digest: b\.digest, generated_at: b\.generated_at\}\)/);
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
    it("keeps a star under dc26.picks, and nothing it keeps carries a channel", () => {
      const win = dom.window, doc = win.document;
      doc.querySelector('.nav button[data-tab="now"]').click();
      const star = doc.querySelector("#view-now .row .star"), id = star.closest(".row").dataset.id;
      star.click();
      expect(JSON.parse(win.localStorage.getItem("dc26.picks"))).toEqual([id]);
      const keys = [...Object.keys(win.localStorage), ...Object.keys(win.sessionStorage)];
      expect(keys.filter(k => !/^dc26\.[A-Za-z]+$/.test(k))).toEqual([]);
    });
    it("no uncaught error fired", () => {
      expect(errors).toEqual([]);
    });
  });

  /* The channel is read as the page runs, from the stamp in its head
     (DECISIONS #15, #39): the stamped page is the unstamped one but for its
     two stamps, so no text in the build names a key, and it is the page,
     booted, that shows everything it keeps is under the channel. */
  describe("the built page, stamped with a channel, boots", () => {
    let stamped, dom;
    const errors = [];

    beforeAll(async () => {
      stamped = build({ DC_CHANNEL: "next", DC_BUILD: "abc1234" });
      if (!stamped.ok) return;
      const fixture = JSON.parse(read(ROOT, "tests", "sample-events.json"));
      dom = new JSDOM(read(stamped.out, "index.html"), {
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
    }, 120_000);
    afterAll(() => dom && dom.window.close());

    it("its page is the unstamped page's, script and all, but for the two stamps", () => {
      expect(stamped.ok, stamped.stderr).toBe(true);
      const unstamp = html => html
        .replace('<meta name="dc-channel" content="next">', '<meta name="dc-channel" content="">')
        .replace('<meta name="dc-build" content="abc1234">', '<meta name="dc-build" content="">');
      const page = read(stamped.out, "index.html");
      expect(page).not.toBe(read(plain.out, "index.html"));
      expect(unstamp(page)).toBe(read(plain.out, "index.html"));
    });
    it("keeps a star under dc26.picks.next, and never writes the key the live site keeps", () => {
      const win = dom.window, doc = win.document;
      const star = doc.querySelector("#view-now .row .star"), id = star.closest(".row").dataset.id;
      star.click();
      expect(JSON.parse(win.localStorage.getItem("dc26.picks.next"))).toEqual([id]);
      expect(win.localStorage.getItem("dc26.picks")).toBe(null);
    });
    it("and everything it keeps, in either storage, ends .next", () => {
      const win = dom.window;
      expect(Object.keys(win.localStorage).length).toBeGreaterThan(0);
      expect(Object.keys(win.localStorage).filter(k => !k.endsWith(".next"))).toEqual([]);
      expect(Object.keys(win.sessionStorage)).toEqual(["dc26.timeOverride.next"]);
    });
    it("no uncaught error fired", () => {
      expect(errors).toEqual([]);
    });
  });
});
