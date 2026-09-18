/* The build's contract (DECISIONS #15, #23): what `vite build` leaves in the
   output folder, stamped and unstamped. Cases 1-4 are build.py's old tests;
   5-7 pin the shape the smoke harness and the deploy depend on. Each case
   runs the real CLI into a temp folder, so this is slow by unit-test
   standards - a second or so a build. */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
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
});
