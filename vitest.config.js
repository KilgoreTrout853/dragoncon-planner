import { defineConfig } from "vitest/config";
import { dcYear } from "./build/vite-dc.js";

export default defineConfig({
  /* The year under test is DC_YEAR's, 2026 where it is unset, as it is for
     the build: its season.json and venues.json are the modules src/ imports,
     and __DC_YEAR__ is defined (DECISIONS #49). */
  plugins: [dcYear()],
  test: {
    /* Modules under src/ read the document as they are imported - the stamps,
       main, the sheet, the update pill - so the page tests and the unit tests
       both need one: jsdom is the default. The files that only
       read text or run the build say `// @vitest-environment node` at the top.
       pretendToBeVisual gives the page requestAnimationFrame and a
       visibilityState of "visible", as the harness's JSDOM had. */
    environment: "jsdom",
    environmentOptions: { jsdom: { pretendToBeVisual: true } },
    include: ["tests/*.test.js", "tests/unit/**/*.test.js", "tests/rules/**/*.test.js", "tests/page/**/*.test.js"],
  },
});
