import { defineConfig } from "vitest/config";

export default defineConfig({
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
