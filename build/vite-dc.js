/* The part of the build that is this project's own (DECISIONS #15, #23).
   It runs in closeBundle, after Vite and vite-plugin-singlefile have written
   dist/, and does two jobs:

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

   2. Copy data/ into dist/data/. The schedule is fetched at run time, and is
      far too big to live in public/ twice.

   Nothing here uses String.replace with file contents as the replacement
   text: the app contains "$&", which a replacement string would expand. */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHANNEL_RE = /^[a-z0-9-]*$/, BUILD_RE = /^[A-Za-z0-9._-]*$/;
const VITE_CSS_MARKER = "/*$vite$:1*/";

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

export function dcBuild() {
  let root = "", outDir = "", channel = "", build = "";
  return {
    name: "dc-build",
    apply: "build",
    enforce: "post",

    /* Refuse a bad stamp before any work is done. */
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(root, config.build.outDir);
      channel = (process.env.DC_CHANNEL || "").trim();
      if (!CHANNEL_RE.test(channel)) throw new Error(`build: a channel is lowercase letters, digits and dashes, not ${JSON.stringify(channel)}`);
      build = channel ? ((process.env.DC_BUILD || "").trim() || gitShortSha(root)) : "";
      if (!BUILD_RE.test(build)) throw new Error(`build: a build id is letters, digits, dots and dashes, not ${JSON.stringify(build)}`);
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

      fs.cpSync(path.join(root, "data"), path.join(outDir, "data"), {recursive: true});
      console.log(`dc-build: channel=${channel || "(none)"} build=${build || "(none)"}`);
    },
  };
}
