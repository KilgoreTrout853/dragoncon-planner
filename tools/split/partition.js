/* The partition check: is what is under src/ now the same program as one file
   at an earlier commit, cut up?

   node tools/split/partition.js <commit> [path-at-that-commit]
     commit   the commit the slice started from
     path     defaults to src/app.js

   Every top-level statement of the old file must exist, with identical source
   text, in exactly one module now. The ones that differ are printed: they
   should be the ones changed on purpose (an assignment that became a call),
   and nothing else. Names that are new, and names declared twice, are printed
   too. Then the same question by line: which non-blank lines of the old file
   are gone, and which lines now under src/ were not in it. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { study } from "./scope.js";
import { ROOT, SRC } from "./repo.js";

const [commit, oldPath = "src/app.js"] = process.argv.slice(2).filter(a => !a.startsWith("--"));
if (!commit) { console.error("usage: node tools/split/partition.js <commit> [path-at-that-commit]"); process.exit(1); }
const old = execFileSync("git", ["show", `${commit}:${oldPath}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 });
const files = fs.readdirSync(SRC).filter(f => f.endsWith(".js") && f !== "main.js").sort();
const texts = Object.fromEntries(files.map(f => [f, fs.readFileSync(path.join(SRC, f), "utf8")]));

/* statements, not declarators: `let a = 1, b = 2` is one piece of text */
const statements = (code, file) => {
  const seen = new Map();
  for (const d of study(code).declarations) {
    const key = d.statementLine;
    if (!seen.has(key)) seen.set(key, { file, names: [], text: d.text });
    seen.get(key).names.push(...d.names);
  }
  return [...seen.values()];
};
const was = statements(old, `${oldPath}@${commit}`);
const now = files.flatMap(f => statements(texts[f], f));

const home = new Map();
for (const s of now) for (const n of s.names) { if (home.has(n)) console.log(`DECLARED TWICE: ${n}, in ${home.get(n).file} and ${s.file}`); home.set(n, s); }
let same = 0;
const changed = [], missing = [];
for (const s of was) {
  const homes = new Set(s.names.map(n => home.get(n)));
  if (homes.size !== 1 || homes.has(undefined)) { missing.push(s.names.join(",")); continue; }
  const [at] = homes;
  if (at.text === s.text) same++; else changed.push(`${s.names.join(",")} (${at.file}: ${s.text.split("\n").length} lines -> ${at.text.split("\n").length})`);
}
const oldNames = new Set(was.flatMap(s => s.names));
console.log(`${was.length} statements (${oldNames.size} names) in ${oldPath} at ${commit}`);
console.log(`  identical text in exactly one module now: ${same}`);
console.log(`  changed (${changed.length}): ${changed.join("; ") || "none"}`);
console.log(`  missing or split across modules (${missing.length}): ${missing.join("; ") || "none"}`);
console.log(`  new names: ${now.flatMap(s => s.names.filter(n => !oldNames.has(n)).map(n => `${n} (${s.file})`)).join(", ") || "none"}`);
const per = {};
for (const s of now) for (const n of s.names) if (oldNames.has(n)) per[s.file] = (per[s.file] || 0) + 1;
console.log("  old names per module now: " + Object.entries(per).map(([f, n]) => `${f} ${n}`).join(", "));

const bag = text => { const m = new Map(); for (const l of text.split("\n")) { const t = l.trimEnd(); if (t.trim()) m.set(t, (m.get(t) || 0) + 1); } return m; };
const a = bag(old), b = bag(Object.values(texts).join("\n"));
const lost = [], gained = [];
for (const [l, n] of a) for (let i = (b.get(l) || 0); i < n; i++) lost.push(l);
for (const [l, n] of b) for (let i = (a.get(l) || 0); i < n; i++) gained.push(l);
console.log(`\nnon-blank lines: ${[...a.values()].reduce((x, y) => x + y, 0)} then, ${[...b.values()].reduce((x, y) => x + y, 0)} now; ${lost.length} gone, ${gained.length} new`);
if (process.argv.includes("--lines")) {
  console.log("\ngone:"); lost.forEach(l => console.log("  - " + l.slice(0, 160)));
  console.log("\nnew:"); gained.forEach(l => console.log("  + " + l.slice(0, 160)));
} else console.log("(--lines prints them)");
