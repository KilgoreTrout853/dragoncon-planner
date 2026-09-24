// @vitest-environment node
/* Rules over the source text: what nothing in a page can show. Two are left
   of the five the smoke harness had. ESLint took the other three, as
   selectors under no-restricted-syntax in eslint.config.js: the clock rule
   when src/time.js became a module, and the scrolling and hostname rules,
   [780] and [1989], in the docs slice. [1240] goes when Playwright arrives;
   [1728] stays. They read every module under src/, one after another in name
   order. The number in brackets is the harness line the rule came from
   (tests/PORT-LEDGER.md). Two more hold the year the build names (DECISIONS
   #49); they are new, not ledger rows, and their titles carry no bracket. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAst } from "vite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const files = fs.readdirSync(path.join(ROOT, "src")).filter(f => f.endsWith(".js")).sort();
const src = files.map(f => fs.readFileSync(path.join(ROOT, "src", f), "utf8").replace(/\r\n/g, "\n")).join("\n");
const template = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/* Every string a module writes - its string literals and the text of its
   templates - and none of its comments. Parsed, not matched. */
function strings(file) {
  const found = [];
  const visit = node => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "Literal" && typeof node.value === "string") found.push(node.value);
    if (node.type === "TemplateElement") found.push(node.value.cooked ?? node.value.raw);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  };
  visit(parseAst(fs.readFileSync(path.join(ROOT, "src", file), "utf8"), { lang: "js", sourceType: "module" }));
  return found;
}

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

  /* A storage key, a cache and a calendar event's UID carry the build's year
     as dc<YY>; one written as dc26 would carry 2026 into every year. */
  it("no dc26 is left in src/: what the app keeps is keyed by the build's year", () => {
    expect(src).not.toMatch(/dc26/);
  });

  /* The con's days are the season file's. A date written into a string is a
     date of one year; a comment may still name one as an example. */
  it("no date is written into a string in src/: the con's days come from the season file", () => {
    const dated = files.flatMap(f => strings(f).filter(s => /\d{4}-\d{2}-\d{2}/.test(s)).map(s => `${f}: ${JSON.stringify(s)}`));
    expect(dated).toEqual([]);
  });
});
