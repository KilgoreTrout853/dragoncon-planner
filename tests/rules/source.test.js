// @vitest-environment node
/* Rules over the source text: what the smoke harness asserted with a regex
   over src/app.js and nothing in a page can show. Each one names what is to
   replace it. The number in brackets is the harness line it came from
   (tests/PORT-LEDGER.md). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = fs.readFileSync(path.join(ROOT, "src", "app.js"), "utf8").replace(/\r\n/g, "\n");
const template = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

describe("src/app.js", () => {
  /* Replaced in PR 5 by ESLint: no-restricted-properties on window.scrollTo,
     scrollBy, scrollY and pageYOffset. main is the scroller, not the page. */
  it("no code scrolls the window directly [780]", () => {
    expect(src.slice(src.indexOf("const PAGE = 150;"))).not.toMatch(/window\.scroll(To|By)\(|window\.scrollY|pageYOffset/);
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

  /* Replaced in PR 5 by ESLint: the no-restricted-syntax pair already in
     eslint.config.js, once src/time.js exists and src/app.js leaves that
     rule's ignores (DECISIONS #12). 1890 only located the section. */
  it("no bare new Date() or Date.now() outside the Time section [1892, and 1890]", () => {
    const from = src.indexOf("   Time. Every read"), to = src.indexOf("   Loading", from);
    expect(from).toBeGreaterThan(0);
    expect(to).toBeGreaterThan(from);
    const outside = src.slice(0, from) + src.slice(to);
    expect(outside).not.toMatch(/new Date\(\s*\)/);
    expect(outside).not.toMatch(/Date\.now\(/);
  });

  /* Replaced in PR 5 by ESLint: no-restricted-properties on location.host,
     hostname and origin. The stamp decides the channel, never the address. */
  it("nothing in the page decides by hostname [1989]", () => {
    expect(src).not.toMatch(/location\.(host|hostname|origin)\b/);
  });
});
