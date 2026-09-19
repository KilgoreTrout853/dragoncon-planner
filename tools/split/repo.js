/* Where things are, for the split tools, and the one ordered list of modules.
   The order is not kept here: tests/rules/imports.test.js holds it, because
   that is the rule that fails when it is broken, and the tools read it from
   there so the two cannot drift. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SRC = path.join(ROOT, "src");
export const byName = (a, b) => a.localeCompare(b, "en", { sensitivity: "base" });

/* the file being emptied: src/app.js until rest-2 renames it */
export function rootFile(argv = process.argv) {
  const at = argv.indexOf("--root");
  return path.join(SRC, at >= 0 ? argv[at + 1] : "app.js");
}

export function moduleOrder() {
  const test = fs.readFileSync(path.join(ROOT, "tests", "rules", "imports.test.js"), "utf8");
  const found = /const (?:LEAVES|ORDER) = \[([\s\S]*?)\];/.exec(test);
  if (!found) throw new Error("tests/rules/imports.test.js: no `const LEAVES = [...]` or `const ORDER = [...]` to read the module order from");
  return [...found[1].matchAll(/"([\w-]+)"/g)].map(m => m[1]);
}

/* names, wrapped the way app.js's export list is: two spaces in, a comma after each */
export function wrapNames(names, width = 97) {
  const out = []; let line = " ";
  for (const n of names) { if ((line + " " + n + ",").length > width) { out.push(line); line = " "; } line += " " + n + ","; }
  if (line.trim()) out.push(line);
  return out.join("\n");
}

export function readLF(file) {
  const text = fs.readFileSync(file, "utf8");
  if (text.includes("\r")) throw new Error(`${file} has CR line endings; the tools cut by line and expect LF`);
  return text;
}
