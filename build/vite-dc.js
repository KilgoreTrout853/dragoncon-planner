/* The part of the build that is this project's own (DECISIONS #15, #23, #49).
   Two plugins.

   dcYear() names the year the client is built for, in the dev server, the
   build and Vitest alike: DC_YEAR, four digits, 2026 where it is unset
   (DECISIONS #49). It defines __DC_YEAR__, which src/season.js reads, and
   resolves the year's two data modules - virtual:season to
   data/<year>/season.json and virtual:venues to data/<year>/venues.json -
   to the files themselves, so Vite reads them as it reads any JSON import
   and the build inlines them. It refuses a year that is not four digits, a
   year whose two files are not there, and a season.json that names another
   year, so the define and the file cannot disagree.

   dcBuild() runs in closeBundle, after Vite and vite-plugin-singlefile have
   written dist/, and does two jobs:

   1. Fix up and stamp dist/index.html and dist/sw.js.
      Vite emits the inlined entry as <script type="module" crossorigin> in
      <head>. The page is written as a classic script at the end of <body> -
      it reads the DOM as it parses, and jsdom, which the build smoke runs
      the page in, does not run module scripts at all - so the element moves
      back there as a bare <script>.
      The inlined <style> loses the attributes and any marker comment Vite
      leaves on it: a bare <style> holding src/styles.css, minified.
      With DC_CHANNEL set, the channel and build id go into the two stamp
      metas and the channel into the worker's CHANNEL, exactly as build.py
      did. With no channel both stay empty and dist/sw.js is public/sw.js.

   2. Copy what the client reads from data/ into dist/data/, and nothing
      else: DATA_FILES, the year's schedule, an allowlist (DECISIONS #39).
      The schedule is fetched at run time, and is far too big to live in
      public/ twice; the frozen v1 file, the tag cache and the registries are
      the pipeline's, never the page's. A year with no schedule yet - before
      its season's first run past the ids stage - is refused before the build
      starts.

   Nothing here uses String.replace with file contents as the replacement
   text: the app contains "$&", which a replacement string would expand. */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHANNEL_RE = /^[a-z0-9-]*$/, BUILD_RE = /^[A-Za-z0-9._-]*$/, YEAR_RE = /^\d{4}$/;
const DEFAULT_YEAR = "2026";
const VITE_CSS_MARKER = "/*$vite$:1*/";
const DATA_FILES = year => [`data/${year}/events.v2.json`];
/* The year's two data modules, under the names src/ imports them by. */
const DATA_MODULES = {"virtual:season": "season.json", "virtual:venues": "venues.json"};

/* The year the client is built for: DC_YEAR, or the default where it is unset. */
export function dcYearFromEnv() {
  const year = (process.env.DC_YEAR || "").trim() || DEFAULT_YEAR;
  if (!YEAR_RE.test(year)) throw new Error(`build: a year is four digits, not ${JSON.stringify(year)}`);
  return year;
}

function gitShortSha(cwd) {
  try { return execFileSync("git", ["rev-parse", "--short", "HEAD"], {cwd, encoding: "utf8"}).trim(); }
  catch { return ""; }
}

const count = (text, needle) => text.split(needle).length - 1;

/* Swap one exact string for another, and refuse if it is not there exactly
   once - a stamp that silently did nothing is the failure this guards. */
function swapOnce(text, needle, replacement, what) {
  if (count(text, needle) !== 1) throw new Error(`build: could not ${what}: expected exactly one ${JSON.stringify(needle)}`);
  const at = text.indexOf(needle);
  return text.slice(0, at) + replacement + text.slice(at + needle.length);
}

function fixUpPage(html) {
  /* the one script element: out of <head>, to the end of <body>, as <script> */
  const opens = html.match(/<script\b[^>]*>/g) || [];
  if (opens.length !== 1 || count(html, "</script>") !== 1) throw new Error(`build: expected one inlined script in dist/index.html, found ${opens.length}`);
  const start = html.indexOf(opens[0]), end = html.indexOf("</script>") + "</script>".length;
  if (start > html.indexOf("</head>")) throw new Error("build: the inlined script is not in <head>; Vite's output has changed shape");
  const code = html.slice(start + opens[0].length, end - "</script>".length);
  let rest = html.slice(0, start).replace(/[ \t]*$/, "") + html.slice(end).replace(/^\n/, "");
  const bodyEnd = rest.lastIndexOf("</body>");
  if (bodyEnd < 0) throw new Error("build: no </body> in dist/index.html");
  rest = rest.slice(0, bodyEnd).replace(/\n*$/, "\n\n") + "<script>" + code + "</script>\n" + rest.slice(bodyEnd);

  /* the one style element: a bare <style>, holding src/styles.css and no more */
  const styles = rest.match(/<style\b[^>]*>/g) || [];
  if (styles.length !== 1) throw new Error(`build: expected one inlined style in dist/index.html, found ${styles.length}`);
  rest = swapOnce(rest, styles[0], "<style>", "normalise the style tag");
  if (count(rest, VITE_CSS_MARKER + "</style>") === 1) rest = swapOnce(rest, VITE_CSS_MARKER + "</style>", "</style>", "strip Vite's CSS marker");
  return rest;
}

export function dcYear() {
  let year = "", files = {};
  return {
    name: "dc-year",
    enforce: "pre",

    /* A bad year is refused before any work is done. */
    config() {
      year = dcYearFromEnv();
      return {define: {__DC_YEAR__: year}};
    },

    configResolved(config) {
      files = Object.fromEntries(Object.entries(DATA_MODULES).map(([id, file]) => [id, path.join(config.root, "data", year, file)]));
      for (const file of Object.values(files)) {
        if (!fs.existsSync(file)) throw new Error(`build: no data/${year}/${path.basename(file)}: the year ${year} needs its season.json and venues.json`);
      }
      const named = JSON.parse(fs.readFileSync(files["virtual:season"], "utf8")).year;
      if (String(named) !== year) throw new Error(`build: data/${year}/season.json names the year ${named}, not ${year}`);
    },

    resolveId(id) { return files[id] || null; },
  };
}

export function dcBuild() {
  let root = "", outDir = "", channel = "", build = "", year = "";
  return {
    name: "dc-build",
    apply: "build",
    enforce: "post",

    /* Refuse a bad stamp, or a year with nothing to ship, before any work is done. */
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(root, config.build.outDir);
      channel = (process.env.DC_CHANNEL || "").trim();
      if (!CHANNEL_RE.test(channel)) throw new Error(`build: a channel is lowercase letters, digits and dashes, not ${JSON.stringify(channel)}`);
      build = channel ? ((process.env.DC_BUILD || "").trim() || gitShortSha(root)) : "";
      if (!BUILD_RE.test(build)) throw new Error(`build: a build id is letters, digits, dots and dashes, not ${JSON.stringify(build)}`);
      year = dcYearFromEnv();
      for (const file of DATA_FILES(year)) {
        if (!fs.existsSync(path.join(root, file))) throw new Error(`build: no ${file}: the year ${year} has no schedule to ship until its season's first run past the ids stage`);
      }
    },

    closeBundle(error) {
      if (error) return;
      const pagePath = path.join(outDir, "index.html"), swPath = path.join(outDir, "sw.js");
      let html = fixUpPage(fs.readFileSync(pagePath, "utf8"));
      if (channel) {
        html = swapOnce(html, '<meta name="dc-channel" content="">', `<meta name="dc-channel" content="${channel}">`, "stamp the channel in index.html");
        html = swapOnce(html, '<meta name="dc-build" content="">', `<meta name="dc-build" content="${build}">`, "stamp the build id in index.html");
        const sw = swapOnce(fs.readFileSync(swPath, "utf8"), 'const CHANNEL = "";', `const CHANNEL = "${channel}";`, "stamp the channel in sw.js");
        fs.writeFileSync(swPath, sw);
      }
      fs.writeFileSync(pagePath, html);

      for (const file of DATA_FILES(year)) {
        fs.mkdirSync(path.dirname(path.join(outDir, file)), {recursive: true});
        fs.copyFileSync(path.join(root, file), path.join(outDir, file));
      }
      console.log(`dc-build: year=${year} channel=${channel || "(none)"} build=${build || "(none)"}`);
    },
  };
}
