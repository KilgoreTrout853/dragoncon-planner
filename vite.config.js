import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { dcBackend, dcBuild, dcYear } from "./build/vite-dc.js";

/* One inlined dist/index.html beside the files in public/ and a copy of the
   one data file the client reads, for the year DC_YEAR names (DECISIONS #23,
   #39, #49), and talking to the backend DC_SUPABASE_URL and DC_SUPABASE_KEY
   name, or to none (#53). The same build is deployed at two subpaths, so
   every URL in it is relative. */
export default defineConfig({
  base: "./",
  build: {
    target: "safari16.4",              // the iOS floor #20 implies; Android is never the floor
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,    // nothing is emitted as a separate file
    modulePreload: false,              // one script, nothing to preload, and no polyfill in front of the app
  },
  /* Order matters: the year first, which names the data the page imports,
     and the backend; then the inlining; then this project's fix-ups. */
  plugins: [dcYear(), dcBackend(), viteSingleFile(), dcBuild()],
});
