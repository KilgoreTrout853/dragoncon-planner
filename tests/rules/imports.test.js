// @vitest-environment node
/* The shape of the module graph under src/ (DECISIONS #23, #24;
   docs/SPLIT-MANIFEST.md). src/app.js is the root: it imports the others,
   and only main.js imports it. ORDER is the order the others may depend on
   one another in - the fourteen leaves, then scroll, the bus and the five
   views - each only on npm packages and on the modules before it, so there
   is no cycle to find. tools/split/ reads the order from here. These are
   new tests, not rows of tests/PORT-LEDGER.md, so their titles carry no
   harness line. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAst } from "vite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ORDER = ["util", "storage", "platform", "build", "state", "time", "venues", "data", "picks", "follows", "ics", "leave", "search", "ui",
  "scroll", "bus", "now", "browse", "explore", "map", "mine"];
const PACKAGES = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).dependencies || {});
const files = fs.readdirSync(path.join(ROOT, "src")).filter(f => f.endsWith(".js")).sort();

/* Every module a file names: import and export-from declarations, and
   import() wherever it appears. Parsed, not matched, so an import that runs
   over several lines is still one import. */
function specifiers(file) {
  const found = [];
  const visit = node => {
    if (!node || typeof node.type !== "string") return;
    if (/^(ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration)$/.test(node.type) && node.source) found.push(node.source.value);
    if (node.type === "ImportExpression") found.push(node.source.type === "Literal" ? node.source.value : "import() of a computed name");
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  };
  visit(parseAst(fs.readFileSync(path.join(ROOT, "src", file), "utf8"), { lang: "js", sourceType: "module" }));
  return found;
}

describe("the module graph under src/", () => {
  it("only main.js imports app.js", () => {
    expect(specifiers("main.js")).toContain("./app.js");
    const others = files.filter(f => f !== "main.js" && specifiers(f).some(s => /(^|\/)app\.js$/.test(s)));
    expect(others).toEqual([]);
  });

  it("a module imports only npm dependencies and the modules before it", () => {
    const offences = [];
    ORDER.forEach((name, at) => {
      if (!files.includes(`${name}.js`)) return;               // not moved out of app.js yet
      for (const s of specifiers(`${name}.js`)) {
        const local = /^\.\/([\w-]+)\.js$/.exec(s);
        const earlier = local && ORDER.indexOf(local[1]) >= 0 && ORDER.indexOf(local[1]) < at;
        if (!earlier && !PACKAGES.includes(s)) offences.push(`${name}.js imports ${s}`);
      }
    });
    expect(offences).toEqual([]);
  });

  it("every module under src/ is app.js, main.js or a module in the list", () => {
    const known = ["app.js", "main.js", ...ORDER.map(name => `${name}.js`)];
    expect(files.filter(f => !known.includes(f))).toEqual([]);
  });
});
