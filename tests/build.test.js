// @vitest-environment node
/* The build's contract (DECISIONS #15, #23, #49, #94): what `vite build` leaves in
   the output folder, stamped and unstamped. Cases 1-4 are build.py's old
   tests; 5-6 pin the shape the deploy and the build smoke depend on; the
   year's cases follow, and a build for a year whose schedule the repo does
   not hold yet, in a temporary copy. Each case runs the real CLI into a temp
   folder, so this is slow by unit-test standards - a second or so a build.
   The level drawings' module is asked of the plugin itself (DECISIONS #94),
   on staged folders no built page could show, and one real build shows a
   borrow refused.

   Below them, the checks of the build output that came from the old smoke
   harness, one for one (the number in brackets is its line;
   tests/PORT-LEDGER.md), and
   the "dist boots" smoke: the built page, run for real in a JSDOM of its own,
   unstamped and then stamped with a channel, which every key it keeps
   carries (DECISIONS #39); and last, stamped and given a backend, signing
   in by email against a fake of the Auth server (#53). */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { dcYear, drawingsYear } from "../build/vite-dc.js";
import { CODE, fakeBackend } from "./helpers/backend.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VITE = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "dc-build-"));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

let n = 0;
/* env always names both stamps, the year and the backend, so a DC_CHANNEL, a
   DC_YEAR or a DC_SUPABASE_URL in the caller's shell cannot leak in. root: a
   temporary copy to build, with the repo's own vite.config.js; the repo
   itself where there is none. */
function build(env, root) {
  const out = path.join(TMP, `site-${++n}`);
  const args = root ? [VITE, "build", root, "--config", path.join(ROOT, "vite.config.js")] : [VITE, "build"];
  try {
    const stdout = execFileSync(process.execPath, [...args, "--outDir", out, "--logLevel", "warn"],
      { cwd: ROOT, env: { ...process.env, DC_CHANNEL: "", DC_BUILD: "", DC_YEAR: "", DC_SUPABASE_URL: "", DC_SUPABASE_KEY: "", DC_EMAIL: "", DC_NOW: "", ...env }, encoding: "utf8", stdio: "pipe" });
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
    expect(workerConstants(sw).CACHE).toBe("dc26-next-v7");              // the name is built from the stamps
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

  /* DECISIONS #53: the key is inlined in a public page. The guard's cases
     are tests/unit/backend-env.test.js's; this is the build running it. */
  it("refuses a secret key for the backend, before it writes anything", SLOW, () => {
    const r = build({ DC_SUPABASE_URL: "https://backend.test", DC_SUPABASE_KEY: "sb_secret_do-not-ship" });
    expect(r.ok).toBe(false);
    expect(r.stderr + r.stdout).toMatch(/secret key/);
    expect(r.stderr + r.stdout).not.toContain("sb_secret_do-not-ship");
    expect(exists(r.out, "index.html")).toBe(false);
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
        expect([CACHE, DATA]).toEqual(["dc27-v7", "data/2027/events.v2.json"]);
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
          doc.querySelector('.nav button[data-tab="plans"]').click();
          doc.querySelector('#view-plans [data-act="ics"]').click();
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

  /* The level drawings, the third data module (DECISIONS #94), which dcYear()
     makes of a folder of files: what it holds, and the year it is taken
     from. The cases are folders no built page could show, so the plugin's
     own hooks are called as Vite calls them, on data folders staged in the
     temp folder and, in two tests, on the repository's own:
     the repo's 2027 venues file under each year unless a test gives its
     own, a season file naming the year, and a drawings folder - its README,
     and each drawing under its file name - where a test gives one. The
     year's rule is asked on the cases of tests/drawings-year-cases.json,
     which tests/test_drawings.py asks of its own copy of the rule: one
     table, so that the two copies cannot be held to different cases. */
  describe("the level drawings, a data module", () => {
    const VENUES = JSON.parse(read(ROOT, "data", "2027", "venues.json")), SEASON = JSON.parse(read(ROOT, "data", "2027", "season.json"));
    const GEOMETRY = ["hotel", "level", "extent", "rooms", "composites", "groups", "open", "landmarks", "streets"];
    const rect = { cx: 100, cy: 100, w: 20, h: 20, rot: 0 };
    /* A drawing of the Hilton's 4th floor, with one of its rooms and every key a file has. */
    const drawing = (over = {}) => ({ hotel: "Hilton", level: "l4", units: "ft", north: "up", extent: { w: 460, h: 520 }, anchors: [{ name: "core", x: 1, y: 2 }],
      rooms: [{ id: "401", ...rect }], composites: [], groups: [], open: [], landmarks: [], streets: [], sources: ["a hotel's table"], notes: ["a guess, said so"], ...over });
    function staged(years) {
      const root = path.join(TMP, `data-${++n}`);
      for (const [year, { venues = VENUES, drawings }] of Object.entries(years)) {
        const dir = path.join(root, "data", year);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "venues.json"), JSON.stringify(venues));
        fs.writeFileSync(path.join(dir, "season.json"), JSON.stringify({ ...SEASON, year: Number(year) }));
        if (!drawings) continue;
        fs.mkdirSync(path.join(dir, "drawings"));
        fs.writeFileSync(path.join(dir, "drawings", "README.md"), "# drawings\n");
        for (const [file, d] of Object.entries(drawings)) fs.writeFileSync(path.join(dir, "drawings", file), JSON.stringify(d));
      }
      return root;
    }
    /* What src/ is given for virtual:drawings by a build of `root` for `year`: the hooks, in Vite's order. */
    function moduleFor(root, year) {
      vi.stubEnv("DC_YEAR", year);
      try {
        const plugin = dcYear();
        plugin.config();
        plugin.configResolved({ root });
        const code = plugin.load(plugin.resolveId("virtual:drawings")), list = JSON.parse(code.slice(15, -1));
        expect(code).toBe(`export default ${JSON.stringify(list)};`);
        return list;
      } finally {
        vi.unstubAllEnvs();
      }
    }
    /* And only as far as the config resolving: where a refusal has to come from, with nothing asking for the module. */
    function resolved(root, year) {
      vi.stubEnv("DC_YEAR", year);
      try {
        const plugin = dcYear();
        plugin.config();
        plugin.configResolved({ root });
      } finally {
        vi.unstubAllEnvs();
      }
    }
    const without = (hotel, level, room) => ({ ...VENUES, hotels: VENUES.hotels.map(h => (h.hotel !== hotel ? h
      : { ...h, levels: h.levels.map(lv => (lv.id !== level ? lv : { ...lv, rooms: lv.rooms.filter(r => r !== room) })) })) });

    describe("the year it is taken from", () => {
      const CASES = JSON.parse(read(ROOT, "tests", "drawings-year-cases.json"));
      /* A case's tree: a folder a name under data/ and, where files are named, its drawings folder - its README, and a file a name. */
      function tree(folders) {
        const root = path.join(TMP, `tree-${++n}`);
        for (const [name, files] of Object.entries(folders)) {
          fs.mkdirSync(path.join(root, "data", name), { recursive: true });
          if (!files) continue;
          fs.mkdirSync(path.join(root, "data", name, "drawings"));
          for (const file of ["README.md", ...files]) fs.writeFileSync(path.join(root, "data", name, "drawings", file), "{}");
        }
        return root;
      }
      it("the table holds the four cases: the year's own, a later year's, only an earlier year's, a README alone", () => {
        const four = ["the year's own drawings", "none of its own, and a later year's", "only an earlier year's: none", "README alone"];
        expect(four.map(part => CASES.filter(c => c.name.includes(part)).length)).toEqual([2, 2, 1, 3]);
      });
      it("the earliest later year, and the files by their names, whatever order the file system lists a folder in", () => {
        const years = tree({ 2026: null, 2027: ["b.json"], 2028: ["d.json"] });
        const files = staged({ 2027: { drawings: { "hilton-l1.json": drawing({ level: "l1", rooms: [{ id: "Crystal A", ...rect }] }), "hilton-l4.json": drawing() } } });
        const list = fs.readdirSync, spy = vi.spyOn(fs, "readdirSync").mockImplementation((...args) => list(...args).reverse());
        try {
          expect(list(path.join(years, "data")).reverse()).toEqual(fs.readdirSync(path.join(years, "data")));
          expect(drawingsYear(years, "2026")).toBe("2027");
          expect(moduleFor(files, "2027").map(d => d.level)).toEqual(["l1", "l4"]);
        } finally {
          spy.mockRestore();
        }
      });
      it.each(CASES)("$name", ({ year, from, tree: folders }) => {
        expect(drawingsYear(tree(folders), year)).toBe(from);
      });
      it("and the module follows the year: its own, a later year's, and an empty list where there is none", () => {
        const root = staged({ 2026: {}, 2027: { drawings: { "b.json": drawing(), "c.json": drawing() } }, 2028: { drawings: { "d.json": drawing() } }, 2029: {} });
        expect(["2026", "2027", "2028", "2029"].map(year => moduleFor(root, year).length)).toEqual([2, 2, 1, 0]);
        expect(moduleFor(staged({ 2026: {} }), "2026")).toEqual([]);
        expect(moduleFor(staged({ 2026: { drawings: {} }, 2027: { drawings: { "b.json": drawing() } } }), "2026")).toHaveLength(1);
      });
      it("in this repository: 2027's own for 2027, and 2027's for 2026, which has none", () => {
        expect([drawingsYear(ROOT, "2026"), drawingsYear(ROOT, "2027")]).toEqual(["2027", "2027"]);
        const borrowed = moduleFor(ROOT, "2026");
        expect(borrowed).toHaveLength(20);
        expect(borrowed).toEqual(moduleFor(ROOT, "2027"));
      });
    });

    describe("what it holds", () => {
      it("every drawing of the year, in the order of the files' names, and no file that does not end .json", () => {
        const root = staged({ 2027: { drawings: { "hilton-l4.json": drawing(), "hilton-l1.json": drawing({ level: "l1", rooms: [{ id: "Crystal A", ...rect }] }) } } });
        for (const other of ["hilton-l4.json.bak", "ids.jsonl", "notes.txt"]) fs.writeFileSync(path.join(root, "data", "2027", "drawings", other), "{");
        expect(fs.readdirSync(path.join(root, "data", "2027", "drawings"))).toHaveLength(6);
        expect(moduleFor(root, "2027").map(d => d.level)).toEqual(["l1", "l4"]);
        /* by code unit, as sort() has it, whatever order the file system lists in: a capital comes first */
        const mixed = staged({ 2027: { drawings: { "a.json": drawing({ level: "l1", rooms: [{ id: "Crystal A", ...rect }] }), "B.json": drawing() } } });
        expect(moduleFor(mixed, "2027").map(d => d.level)).toEqual(["l4", "l1"]);
      });
      it("a drawing's geometry and nothing else: no sources, notes, units, north or anchors", () => {
        const root = staged({ 2027: { drawings: { "hilton-l4.json": drawing({ landmarks: [{ kind: "elevator", name: "Lifts", x: 5, y: 6 }], streets: [{ name: "Baker Street NE", side: "N" }] }) } } });
        const [held] = moduleFor(root, "2027");
        expect(Object.keys(held)).toEqual(GEOMETRY);
        expect(held).toEqual({ hotel: "Hilton", level: "l4", extent: { w: 460, h: 520 }, rooms: [{ id: "401", ...rect }], composites: [], groups: [], open: [],
          landmarks: [{ kind: "elevator", name: "Lifts", x: 5, y: 6 }], streets: [{ name: "Baker Street NE", side: "N" }] });
      });
      it("the repository's twenty: none carries a key that is not geometry, and each file's geometry is whole", () => {
        const held = moduleFor(ROOT, "2026"), folder = path.join(ROOT, "data", "2027", "drawings");
        const files = fs.readdirSync(folder).filter(f => f.endsWith(".json")).sort().map(f => JSON.parse(read(folder, f)));
        expect(held.map(d => Object.keys(d))).toEqual(files.map(() => GEOMETRY));
        expect(held).toEqual(files.map(d => Object.fromEntries(GEOMETRY.map(key => [key, d[key]]))));
        expect(files.every(d => d.sources.length && Array.isArray(d.notes) && d.units === "ft" && d.north === "up" && Array.isArray(d.anchors))).toBe(true);
      });
      it("a file that is no JSON is refused by its name, a year's own or borrowed", () => {
        const cut = root => fs.writeFileSync(path.join(root, "data", "2027", "drawings", "hilton-l4.json"), JSON.stringify(drawing()).slice(0, 200));
        const own = staged({ 2027: { drawings: { "hilton-l4.json": drawing() } } }), lent = staged({ 2026: {}, 2027: { drawings: { "hilton-l4.json": drawing() } } });
        cut(own); cut(lent);
        expect(() => moduleFor(own, "2027")).toThrow(/^build: data\/2027\/drawings\/hilton-l4\.json is not a drawing: /);
        expect(() => moduleFor(lent, "2026")).toThrow(/^build: data\/2027\/drawings\/hilton-l4\.json is not a drawing: /);
      });
      it("and so is one that lacks a key of its geometry, or is no object at all", () => {
        const { composites, streets, ...lacking } = drawing();
        expect([composites, streets]).toEqual([[], []]);
        expect(() => moduleFor(staged({ 2027: { drawings: { "hilton-l4.json": lacking } } }), "2027")).toThrow(/^build: data\/2027\/drawings\/hilton-l4\.json is not a drawing: it has no composites, streets$/);
        expect(() => moduleFor(staged({ 2026: {}, 2027: { drawings: { "hilton-l4.json": lacking } } }), "2026")).toThrow(/hilton-l4\.json is not a drawing: it has no composites, streets$/);
        expect(() => moduleFor(staged({ 2027: { drawings: { "hilton-l4.json": null } } }), "2027")).toThrow(/is not a drawing: it has no hotel, level, extent, rooms, composites, groups, open, landmarks, streets$/);
      });
      it("a drawings that is a file and no folder holds no drawing", () => {
        const root = staged({ 2026: {}, 2027: { drawings: { "b.json": drawing() } } });
        fs.writeFileSync(path.join(root, "data", "2026", "drawings"), "not a folder");
        expect(drawingsYear(root, "2026")).toBe("2027");
        expect(moduleFor(root, "2026")).toHaveLength(1);
      });
      it("any other id is not the plugin's to answer for", () => {
        const plugin = dcYear();
        expect([plugin.resolveId("virtual:drawing"), plugin.resolveId("./drawings.js"), plugin.load("virtual:drawings"), plugin.load("\0virtual:venues")]).toEqual([null, null, null, null]);
      });
    });

    describe("a borrowed drawing is held to the building year's venues file", () => {
      const borrow = (venues, d) => staged({ 2026: { venues }, 2027: { drawings: { "hilton-l4.json": d } } });
      it("and is given where every id it names is there", () => {
        expect(moduleFor(borrow(VENUES, drawing({ open: [{ name: "Deck", ...rect }] })), "2026")).toHaveLength(1);
      });
      it.each([
        ["a room", drawing(), without("Hilton", "l4", "401"), /the room "401" of Hilton's level "l4"/],
        ["a composite", drawing({ composites: [{ id: "Fourth East", of: ["401"] }] }), VENUES, /the room "Fourth East" of Hilton's level "l4"/],
        ["a composite's leaf", drawing({ composites: [{ id: "402", of: ["401", "498"] }] }), VENUES, /the room "498" of Hilton's level "l4"/],
        ["a group's member", drawing({ groups: [{ name: "401-497", kind: "run", rooms: ["401", "497"], outline: rect }] }), VENUES, /the room "497" of Hilton's level "l4"/],
        ["an open area's id", drawing({ open: [{ name: "Deck", id: "Deck", ...rect }] }), VENUES, /the room "Deck" of Hilton's level "l4"/],
        ["a room of another level of the hotel", drawing({ rooms: [{ id: "Crystal A", ...rect }] }), VENUES, /the room "Crystal A" of Hilton's level "l4"/],
        ["its level", drawing({ level: "l9" }), VENUES, /names what data\/2026\/venues\.json lacks: Hilton's level "l9"$/],
        ["its hotel", drawing({ hotel: "Hilton Garden" }), VENUES, /names what data\/2026\/venues\.json lacks: the hotel "Hilton Garden"$/],
      ])("refused where the year's venues file lacks %s", (_, d, venues, said) => {
        const root = borrow(venues, d);
        expect(() => moduleFor(root, "2026")).toThrow(said);
        expect(() => moduleFor(root, "2026")).toThrow(/^build: data\/2027\/drawings\/hilton-l4\.json, borrowed for 2026, names what data\/2026\/venues\.json lacks: /);
      });
      it("as the config resolves, before anything asks for the module: nothing in the page does yet", () => {
        expect(() => resolved(borrow(without("Hilton", "l4", "401"), drawing()), "2026")).toThrow(/borrowed for 2026, names what data\/2026\/venues\.json lacks: the room "401"/);
        expect(() => resolved(borrow(VENUES, drawing()), "2026")).not.toThrow();
      });
      it("a year with no season file is refused for that, whatever is drawn", () => {
        expect(() => resolved(staged({ 2027: { drawings: { "hilton-l4.json": drawing() } } }), "2025")).toThrow(/no data\/2025\/season\.json/);
      });
      it("every stranger is named, each once", () => {
        const d = drawing({ rooms: [{ id: "498", ...rect }, { id: "499", ...rect }], groups: [{ name: "498-499", kind: "run", rooms: ["498", "499"], outline: rect }] });
        expect(() => moduleFor(borrow(VENUES, d), "2026")).toThrow(/lacks: the room "498" of Hilton's level "l4"; the room "499" of Hilton's level "l4"$/);
      });
      it("by the building year's file, not the lending year's", () => {
        const root = staged({ 2026: {}, 2027: { venues: without("Hilton", "l4", "401"), drawings: { "hilton-l4.json": drawing() } } });
        expect(moduleFor(root, "2026")).toHaveLength(1);
      });
      it("a year's own drawings are not the build's to hold: tests/test_drawings.py holds them", () => {
        const root = staged({ 2027: { drawings: { "hilton-l4.json": drawing({ rooms: [{ id: "499", ...rect }] }) } } });
        expect(moduleFor(root, "2027")).toHaveLength(1);
      });
      it("a real build is refused before it writes anything: 2026's venues file without the Concourse", SLOW, () => {
        /* a schedule too, so that nothing but the borrow is there to refuse */
        const root = stage("2026", { "season.json": read(ROOT, "data", "2026", "season.json"), "venues.json": JSON.stringify(without("Hyatt", "exhibit", "Concourse")),
          "events.v2.json": read(ROOT, "tests", "sample-events.json") });
        fs.cpSync(path.join(ROOT, "data", "2027", "drawings"), path.join(root, "data", "2027", "drawings"), { recursive: true });
        const r = build({}, root);
        expect(r.ok).toBe(false);
        expect(r.stderr + r.stdout).toMatch(/data\/2027\/drawings\/hyatt-exhibit\.json, borrowed for 2026, names what data\/2026\/venues\.json lacks: the room "Concourse" of Hyatt's level "exhibit"/);
        expect(exists(r.out, "index.html")).toBe(false);
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
    it("the cache name is versioned (v7) under a prefix the build can stamp, and only this site's caches are cleared [1290]", () => {
      expect(sw()).toMatch(/const CHANNEL = "";/);
      expect(sw()).toMatch(/const YEAR = "2026";/);
      expect(sw()).toMatch(/const CACHE = `\$\{CACHE_PREFIX\}v7`;/);
      expect(sw()).toMatch(/OURS\.test\(n\) && n !== CACHE/);
    });
    it("the worker precaches the icons [1307]", () => {
      expect(sw()).toMatch(/SHELL = \[[^\]]*"\.\/icon-180\.png"[^\]]*"\.\/icon-512\.png"/);
    });
    it("the html fetch stores its response whenever it lands [1309]", () => {
      expect(sw()).toMatch(/function fetchAndCache\(request\)/);
      expect(sw().slice(sw().indexOf("function fetchAndCache"))).toMatch(/cache\.put\(pageKey\(request\), res\.clone\(\)\)/);
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
    const errors = [], fetched = [];

    beforeAll(async () => {
      const fixture = JSON.parse(read(ROOT, "tests", "sample-events.json"));
      dom = new JSDOM(read(plain.out, "index.html"), {
        runScripts: "dangerously", pretendToBeVisual: true, url: "https://example.test/?now=2026-09-05T13:05",
        beforeParse(window) {
          window.addEventListener("error", e => errors.push(e.message));
          window.fetch = url => { fetched.push(String(url)); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(fixture) }); };
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
    it("built with no backend, it asks for nothing but the schedule, keeps no session and shows no Keep your plan (DECISIONS #53)", () => {
      const win = dom.window, doc = win.document;
      doc.getElementById("settingsBtn").click();
      expect(fetched.length).toBeGreaterThan(0);
      expect(fetched.filter(url => !url.endsWith("data/2026/events.v2.json"))).toEqual([]);
      expect(win.localStorage.getItem("dc26.session")).toBe(null);
      expect(doc.getElementById("keep").hidden).toBe(true);
      expect(doc.getElementById("keep").children.length).toBe(0);
      doc.getElementById("closeSheet").click();
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

  /* A build with a backend (DECISIONS #51, #53): the next site's, stamped and
     given the two constants. Nothing calls the backend on load; the email
     step, driven as a reader drives it, signs in against a fake of the
     backend (tests/helpers/backend.js) and keeps the session under the
     channel's key; and a star, once signed in, reaches the server as the
     user's pick (docs/sync/contract.md, section 5). */
  describe("the built page, stamped with a channel and given a backend, signs in by email", () => {
    let built, dom;
    const fake = fakeBackend(), errors = [];

    beforeAll(async () => {
      built = build({ DC_CHANNEL: "next", DC_BUILD: "abc1234", DC_SUPABASE_URL: fake.url, DC_SUPABASE_KEY: fake.key });
      if (!built.ok) return;
      const fixture = JSON.parse(read(ROOT, "tests", "sample-events.json"));
      dom = new JSDOM(read(built.out, "index.html"), {
        runScripts: "dangerously", pretendToBeVisual: true, url: "https://example.test/?now=2026-09-05T13:05",
        beforeParse(window) {
          window.addEventListener("error", e => errors.push(e.message));
          window.fetch = (url, init) => String(url).startsWith(fake.url) ? fake.fetch(url, init)
            : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(fixture) });
          const worker = new window.EventTarget();
          worker.register = () => Promise.resolve({});
          worker.controller = null;
          Object.defineProperty(window.navigator, "serviceWorker", { value: worker, configurable: true });
        },
      });
      await until(() => dom.window.document.querySelector("#view-now .row"), "the first screen");
    }, 120_000);
    afterAll(() => dom && dom.window.close());

    it("builds with the backend's address in the page, and boots without a word to it", () => {
      expect(built.ok, built.stderr).toBe(true);
      expect(read(built.out, "index.html")).toContain(fake.url);
      expect(fake.requests).toEqual([]);
    });
    it("the email step reaches signed in as the address, and the session is kept under dc26.session.next", async () => {
      const win = dom.window, doc = win.document;
      const submit = (form, field, value) => {
        doc.getElementById(field).value = value;
        doc.getElementById(form).dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
      };
      doc.getElementById("settingsBtn").click();
      expect(doc.getElementById("keep").hidden).toBe(false);
      submit("keepEmailForm", "keepEmail", "new@example.test");
      await until(() => !doc.getElementById("keepCodeForm").hidden, "the code form");
      submit("keepCodeForm", "keepCode", CODE);
      await until(() => !doc.getElementById("keepIn").hidden, "signed in");
      expect(doc.getElementById("keepWho").textContent).toBe("new@example.test");
      expect(JSON.parse(win.localStorage.getItem("dc26.session.next")).user).toMatchObject({ email: "new@example.test", is_anonymous: false });
      expect(win.localStorage.getItem("dc26.session")).toBe(null);
      expect(Object.keys(win.localStorage).filter(k => !k.endsWith(".next"))).toEqual([]);
      expect(fake.requests.filter(r => r.path.startsWith("/auth/")).map(r => `${r.method} ${r.path}`))
        .toEqual(["POST /auth/v1/otp", "POST /auth/v1/signup", "PUT /auth/v1/user", "POST /auth/v1/verify"]);
    });
    it("and syncs: a star reaches the server as the user's pick, and sync's keys end .next too", async () => {
      const win = dom.window, doc = win.document;
      const star = doc.querySelector("#view-now .row .star"), id = star.closest(".row").dataset.id;
      star.click();
      await until(() => fake.rows("picks").some(r => r.event_id === id), "the star at the server");
      const user = JSON.parse(win.localStorage.getItem("dc26.session.next")).user.id;
      expect(fake.rows("picks").find(r => r.event_id === id)).toMatchObject({ user_id: user, year: 2026, picked: true });
      expect(fake.requests.filter(r => r.method === "POST" && r.path.startsWith("/rest/v1/")).map(r => r.headers.Prefer))
        .toEqual(["resolution=merge-duplicates,return=minimal"]);
      expect(JSON.parse(win.localStorage.getItem("dc26.syncStamp.next")).user).toBe(user);
      expect(Object.keys(win.localStorage).filter(k => !k.endsWith(".next"))).toEqual([]);
    });
    it("no uncaught error fired", () => {
      expect(errors).toEqual([]);
    });
  });

  /* A build that carries its clock and leaves the email step off (DECISIONS
     #99): DC_NOW and DC_EMAIL. The guards' cases are tests/unit/'s -
     clock-env.test.js and backend-env.test.js - and these are the build
     running them, and the built page opened as a launch from the home
     screen opens it: its bare address, an empty session. */
  it("refuses a default moment that is no date and time, before it writes anything", SLOW, () => {
    const r = build({ DC_NOW: "tuesday" });
    expect(r.ok).toBe(false);
    expect(r.stderr + r.stdout).toMatch(/DC_NOW is a date and time/);
    expect(exists(r.out, "index.html")).toBe(false);
  });
  it("refuses the email step off on a build with no backend, before it writes anything", SLOW, () => {
    const r = build({ DC_EMAIL: "off" });
    expect(r.ok).toBe(false);
    expect(r.stderr + r.stdout).toMatch(/DC_EMAIL=off is for a build with a backend/);
    expect(exists(r.out, "index.html")).toBe(false);
  });

  describe("the built page, given a default moment, a backend and the email step off, opened at its bare address", () => {
    let built, dom;
    const fake = fakeBackend(), errors = [];
    const MOMENT = "2026-09-01T10:00";

    beforeAll(async () => {
      built = build({ DC_NOW: MOMENT, DC_EMAIL: "off", DC_SUPABASE_URL: fake.url, DC_SUPABASE_KEY: fake.key });
      if (!built.ok) return;
      const fixture = JSON.parse(read(ROOT, "tests", "sample-events.json"));
      dom = new JSDOM(read(built.out, "index.html"), {
        runScripts: "dangerously", pretendToBeVisual: true, url: "https://example.test/",
        beforeParse(window) {
          window.addEventListener("error", e => errors.push(e.message));
          window.fetch = (url, init) => String(url).startsWith(fake.url) ? fake.fetch(url, init)
            : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(fixture) });
          const worker = new window.EventTarget();
          worker.register = () => Promise.resolve({});
          worker.controller = null;
          Object.defineProperty(window.navigator, "serviceWorker", { value: worker, configurable: true });
        },
      });
      await until(() => dom.window.document.querySelector("#view-explore .tile, #view-explore .row"), "the first screen");
    }, 120_000);
    afterAll(() => dom && dom.window.close());

    const el = id => dom.window.document.getElementById(id);
    const said = id => el(id).textContent.replace(/\s+/g, " ").trim();

    it("builds", () => {
      expect(built.ok, built.stderr).toBe(true);
    });
    it("opens at the default moment, before the con: on Explore, the clock Tue 10:00 AM, and no chip", () => {
      expect(dom.window.document.querySelector('.nav button[aria-current="page"]').dataset.tab).toBe("explore");
      expect(said("clock")).toBe("Tue 10:00 AM");
      expect(el("simChip").hidden).toBe(true);
    });
    it("with nothing in the address or the session, and no banner on the tab it opens on", () => {
      expect(dom.window.location.search).toBe("");
      expect(Object.keys(dom.window.sessionStorage)).toEqual([]);
      expect(el("notice").hidden).toBe(true);
    });
    it("the header's line says the count alone: the schedule was refreshed after the moment it opens at", () => {
      expect(said("fresh")).toMatch(/^· [\d,]+ events$/);
    });
    it("Settings shows no Keep your plan, the field holds the default, and the readout says both", () => {
      el("settingsBtn").click();
      expect(el("keep").hidden).toBe(true);
      expect(el("keep").children.length).toBe(0);
      expect(el("previewTime").value).toBe(MOMENT);
      expect(said("deviceLine")).toMatch(/ · clock 2026-09-01T10:00 · email off · build /);
      el("closeSheet").click();
    });
    it("a time set in Settings shows the chip, and its tap goes back to the default, not to today", () => {
      el("settingsBtn").click();
      el("previewTime").value = "2026-09-05T13:05";
      el("applyPreview").click();
      expect(said("clock")).toBe("Sat 1:05 PM");
      expect(el("simChip").hidden).toBe(false);
      el("simChip").click();
      expect(said("clock")).toBe("Tue 10:00 AM");
      expect(el("simChip").hidden).toBe(true);
      expect(dom.window.location.search).toBe("");
    });
    it("nothing was asked of the backend, and no uncaught error fired", () => {
      expect(fake.requests).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
});
