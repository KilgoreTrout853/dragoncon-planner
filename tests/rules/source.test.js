// @vitest-environment node
/* Rules over the source text: what nothing in a page can show. Two are left
   of the five the smoke harness had. ESLint took the other three, as
   selectors under no-restricted-syntax in eslint.config.js: the clock rule
   when src/time.js became a module, and the scrolling and hostname rules,
   [780] and [1989], in the docs slice. [1240] goes when Playwright arrives;
   [1728] stays. They read every module under src/, one after another in name
   order. The number in brackets is the harness line the rule came from
   (tests/PORT-LEDGER.md). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = fs.readdirSync(path.join(ROOT, "src")).filter(f => f.endsWith(".js")).sort()
  .map(f => fs.readFileSync(path.join(ROOT, "src", f), "utf8").replace(/\r\n/g, "\n")).join("\n");
const template = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

describe("src/", () => {
  /* Guards the star-anchoring fix, which is togglePick() in src/shell.js. Its
     behaviour test ([53], tests/page/now.test.js) cannot fail in jsdom, which
     has no layout; both retire when Playwright arrives (DECISIONS #24). */
  it("togglePick keeps the anchoring signature the star fix gave it [1240]", () => {
    expect(src).toMatch(/function togglePick\(id, anchor\)/);
  });

  /* Stays a rule test: what a template literal holds is not worth a custom
     ESLint rule. Larger text works because every size is in rem. */
  it("no inline pixel font size hides in a template [1728]", () => {
    expect(src + template).not.toMatch(/style="font-size:\d+px/);
  });
});
