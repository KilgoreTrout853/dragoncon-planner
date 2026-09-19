// @vitest-environment node
/* Rules over the source text: what the smoke harness asserted with a regex
   over the page's script and nothing in a page can show. They read every
   module under src/, one after another in name order. Each one names what is
   to replace it. The number in brackets is the harness line it came from
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
  /* Replaced in PR 5 by ESLint: no-restricted-properties on window.scrollTo,
     scrollBy, scrollY and pageYOffset. main is the scroller, not the page. */
  it("no code scrolls the window directly [780]", () => {
    expect(src).not.toMatch(/window\.scroll(To|By)\(|window\.scrollY|pageYOffset/);
  });

  /* Guards the star-anchoring fix; its behaviour test (53) cannot fail in
     jsdom - both retire when Playwright arrives. */
  it("togglePick keeps the anchoring signature the star fix gave it [1240]", () => {
    expect(src).toMatch(/function togglePick\(id, anchor\)/);
  });

  /* Stays a rule test after PR 5: what a template literal holds is not worth
     a custom ESLint rule. Larger text works because every size is in rem. */
  it("no inline pixel font size hides in a template [1728]", () => {
    expect(src + template).not.toMatch(/style="font-size:\d+px/);
  });

  /* Replaced in PR 5 by ESLint: no-restricted-properties on location.host,
     hostname and origin. The stamp decides the channel, never the address. */
  it("nothing in the page decides by hostname [1989]", () => {
    expect(src).not.toMatch(/location\.(host|hostname|origin)\b/);
  });
});
