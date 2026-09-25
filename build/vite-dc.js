/* The part of the build that is this project's own (DECISIONS #15, #23, #49,
   #53). Three plugins.

   dcYear() names the year the client is built for, in the dev server, the
   build and Vitest alike: DC_YEAR, four digits, 2026 where it is unset
   (DECISIONS #49). It defines __DC_YEAR__, which src/season.js reads, and
   resolves the year's two data modules - virtual:season to
   data/<year>/season.json and virtual:venues to data/<year>/venues.json -
   to the files themselves, so Vite reads them as it reads any JSON import
   and the build inlines them. It refuses a year that is not four digits, a
   year whose two files are not there, and a season.json that names another
   year, so the define and the file cannot disagree.

   dcBackend() names the backend the client talks to, in the dev server, the
   build and Vitest alike: DC_SUPABASE_URL and DC_SUPABASE_KEY, a Supabase
   project's address and its public key, both or neither (DECISIONS #51,
   #53). It defines __DC_SUPABASE_URL__ and __DC_SUPABASE_KEY__, which
   src/backend.js reads, each "" where they are unset: a build with no
   backend, whose page sends nothing anywhere but for the schedule. The key
   is inlined in a page anyone can read, so a secret key is refused - an
   sb_secret_ key, or a JWT whose role is service_role - and so is an
   address that is more than an origin, or not https but for http on this
   machine, and either of the two without the other.

   dcBuild() runs in closeBundle, after Vite and vite-plugin-singlefile have
   written dist/, and does two jobs:

   1. Fix up and stamp dist/index.html, dist/sw.js and dist/manifest.json.
      Vite emits the inlined entry as <script type="module" crossorigin> in
      <head>. The page is written as a classic script at the end of <body> -
      it reads the DOM as it parses, and jsdom, which the build smoke runs
      the page in, does not run module scripts at all - so the element moves
      back there as a bare <script>.
      The inlined <style> loses the attributes and any marker comment Vite
      leaves on it: a bare <style> holding src/styles.css, minified.
      With DC_CHANNEL set, the channel and build id go into the two stamp
      metas and the channel into the worker's CHANNEL, exactly as build.py
      did. For a year that is not the default, the year goes into the
      worker's YEAR, and into the page's name - "Dragon Con <year>" and
      "DC<yy>" in its title, its head's tags and the brand on Now - and the
      manifest's. With no channel and the default year, dist/sw.js is
      public/sw.js and dist/manifest.json is public/manifest.json.

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
const LOCAL_HTTP_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
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

/* The role a JWT names, or "" for a key that is not one. */
function jwtRole(key) {
  const parts = key.split(".");
  if (parts.length !== 3) return "";
  try { return String(JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role || ""); }
  catch { return ""; }
}

/* The backend the client is built for: {url, key}, both "" for none. The
   address loses any trailing slash; the error never repeats the key. */
export function dcBackendFromEnv(env = process.env) {
  const url = (env.DC_SUPABASE_URL || "").trim().replace(/\/+$/, ""), key = (env.DC_SUPABASE_KEY || "").trim();
  if (!url && !key) return {url: "", key: ""};
  if (!url || !key) throw new Error("build: DC_SUPABASE_URL and DC_SUPABASE_KEY go together: both for a backend, neither for none");
  let origin = "";
  try { origin = new URL(url).origin; } catch { /* not an address: refused below */ }
  if (origin !== url) throw new Error(`build: DC_SUPABASE_URL is a project's address and nothing more, not ${JSON.stringify(url)}`);
  if (!url.startsWith("https://") && !LOCAL_HTTP_RE.test(url)) throw new Error(`build: DC_SUPABASE_URL is https, or http on this machine, not ${JSON.stringify(url)}`);
  if (key.startsWith("sb_secret_") || jwtRole(key) === "service_role") throw new Error("build: DC_SUPABASE_KEY is a secret key; the page is public, and takes the public key alone");
  return {url, key};
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

/* The page's name, in its markup and never in its one script, which takes the
   year from the define: every "Dragon Con 2026" and "DC26" becomes the year's.
   A markup that no longer names the default year is refused, as a stamp that
   silently did nothing would be. The icons draw the year in pixels, which no
   stamp reaches (ROADMAP, Checklist). */
function stampPageYear(html, year) {
  const at = html.indexOf("<script>");
  let markup = html.slice(0, at);
  for (const [from, to] of [[`Dragon Con ${DEFAULT_YEAR}`, `Dragon Con ${year}`], [`DC${DEFAULT_YEAR.slice(2)}`, `DC${year.slice(2)}`]]) {
    if (!count(markup, from)) throw new Error(`build: could not stamp the year in index.html: no ${JSON.stringify(from)}`);
    markup = markup.split(from).join(to);
  }
  return markup + html.slice(at);
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

export function dcBackend() {
  return {
    name: "dc-backend",

    /* A bad pair is refused before any work is done. */
    config() {
      const {url, key} = dcBackendFromEnv();
      return {define: {__DC_SUPABASE_URL__: JSON.stringify(url), __DC_SUPABASE_KEY__: JSON.stringify(key)}};
    },
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
      const pagePath = path.join(outDir, "index.html"), swPath = path.join(outDir, "sw.js"), manifestPath = path.join(outDir, "manifest.json");
      const yearStamped = year !== DEFAULT_YEAR;
      let html = fixUpPage(fs.readFileSync(pagePath, "utf8"));
      if (channel) {
        html = swapOnce(html, '<meta name="dc-channel" content="">', `<meta name="dc-channel" content="${channel}">`, "stamp the channel in index.html");
        html = swapOnce(html, '<meta name="dc-build" content="">', `<meta name="dc-build" content="${build}">`, "stamp the build id in index.html");
      }
      if (yearStamped) html = stampPageYear(html, year);
      if (channel || yearStamped) {
        let sw = fs.readFileSync(swPath, "utf8");
        if (channel) sw = swapOnce(sw, 'const CHANNEL = "";', `const CHANNEL = "${channel}";`, "stamp the channel in sw.js");
        if (yearStamped) sw = swapOnce(sw, `const YEAR = "${DEFAULT_YEAR}";`, `const YEAR = "${year}";`, "stamp the year in sw.js");
        fs.writeFileSync(swPath, sw);
      }
      if (yearStamped) {
        let manifest = fs.readFileSync(manifestPath, "utf8");
        manifest = swapOnce(manifest, `"name": "Dragon Con ${DEFAULT_YEAR}"`, `"name": "Dragon Con ${year}"`, "stamp the year in manifest.json's name");
        manifest = swapOnce(manifest, `"short_name": "DC${DEFAULT_YEAR.slice(2)}"`, `"short_name": "DC${year.slice(2)}"`, "stamp the year in manifest.json's short name");
        fs.writeFileSync(manifestPath, manifest);
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
