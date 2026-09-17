import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { dcBuild } from "./build/vite-dc.js";

/* One inlined dist/index.html beside the files in public/ and a copy of data/
   (DECISIONS #23). The same build is deployed at two subpaths, so every URL
   in it is relative. */
export default defineConfig({
  base: "./",
  build: {
    target: "safari16.4",              // the iOS floor #20 implies; Android is never the floor
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    cssMinify: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,    // nothing is emitted as a separate file
    modulePreload: false,              // one script, nothing to preload, and no polyfill in front of the app
    /* Vite 8 bundles with Rolldown, which rewrites code even when Vite's own
       minify is off: constants are folded away (MAP_W vanished), locals are
       inlined, undefined becomes void 0, and top-level const/let become var.
       The page's top-level names are its test surface, so all of it is off -
       it takes all three settings - and dist/ holds the same program as
       src/, which tests/build.test.js checks tree against tree. */
    rolldownOptions: {
      treeshake: false,
      output: { minify: false, topLevelVar: false },
    },
  },
  /* Order matters: the inlining first, then this project's fix-ups. */
  plugins: [viteSingleFile(), dcBuild()],
});
