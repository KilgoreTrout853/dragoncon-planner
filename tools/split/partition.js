/* The partition check: is what is under src/ now the same program as one file
   at an earlier commit, cut up?

   node tools/split/partition.js <commit> [path-at-that-commit] [--lines] [--handlers]
     commit      the commit the slice started from
     path        defaults to src/app.js
     --lines     print the lines that are gone and the lines that are new
     --handlers  list the handlers found identical, not only count them

   Every top-level statement of the old file must exist, with identical source
   text, in exactly one module now. The ones that differ are printed: they
   should be the ones changed on purpose (an assignment that became a call),
   and nothing else. Names that are new, and names declared twice, are printed
   too. Then the same question by line: which non-blank lines of the old file
   are gone, and which lines now under src/ were not in it.

   Then boot()'s handlers, which no statement check can see because they are
   closures inside one statement. Every registration boot() made at that commit
   must still be made, in the same order, on the same target, for the same
   event, with the same options. A handler that was inline then and is a name
   now must be a top-level function somewhere under src/ whose parameters and
   body are those of the closure, byte for byte once the closure's extra
   indentation is taken off - only the `function name(e) {` frame is new. The
   ones that differ are printed: they should be the ones changed on purpose. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parse, study } from "./scope.js";
import { bodyOf, registrationsOf } from "./handlers.js";
import { ROOT, SRC, readLF, rootFile } from "./repo.js";

const argv = process.argv.slice(2);
const rootAt = argv.indexOf("--root");
const [commit, oldPath = "src/app.js"] = argv.filter((a, i) => !a.startsWith("--") && !(rootAt >= 0 && i === rootAt + 1));
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
/* a name is new if nothing under src/ declared it at that commit - not merely
   absent from the one file being cut up: the modules of an earlier slice were
   already there */
const srcThen = execFileSync("git", ["ls-tree", "--name-only", `${commit}:src`], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(f => f.endsWith(".js"));
const existed = new Set(srcThen.flatMap(f => [...study(execFileSync("git", ["show", `${commit}:src/${f}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 })).declared.keys()]));
console.log(`${was.length} statements (${oldNames.size} names) in ${oldPath} at ${commit}`);
console.log(`  identical text in exactly one module now: ${same}`);
console.log(`  changed (${changed.length}): ${changed.join("; ") || "none"}`);
console.log(`  missing or split across modules (${missing.length}): ${missing.join("; ") || "none"}`);
console.log(`  new names: ${now.flatMap(s => s.names.filter(n => !existed.has(n)).map(n => `${n} (${s.file})`)).join(", ") || "none"}`);
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

/* ---- boot()'s handlers ------------------------------------------------ */
let then;
try { then = registrationsOf(old).registrations; } catch (e) { then = null; }
if (then) {
  const root = rootFile();
  const today = registrationsOf(readLF(root)).registrations;
  /* every top-level function under src/, by name, with its parameters and body */
  const functions = new Map();
  for (const f of files) {
    const code = texts[f];
    for (const st of parse(code).body) {
      const s = st.type === "ExportNamedDeclaration" && st.declaration ? st.declaration : st;
      if (s.type === "FunctionDeclaration") functions.set(s.id.name, { file: f, async: !!s.async, params: s.params.map(p => code.slice(p.start, p.end)).join(", "), body: bodyOf(s, code) });
    }
  }
  const where = r => (r.kind === "listener" ? `${r.target} "${r.event}"${r.options ? " " + r.options : ""}` : r.kind === "promise" ? `${r.target}.${r.event}()` : r.kind === "observer" ? `new ${r.event}` : `${r.kind}${r.event ? " " + r.event : ""}`);
  console.log(`\nboot()'s registrations: ${then.length} then, ${today.length} now (${path.basename(root)})`);
  const out = { same: 0, identical: [], differs: [], inline: 0, order: [] };
  for (let i = 0; i < Math.max(then.length, today.length); i++) {
    const a1 = then[i], b1 = today[i];
    if (!a1 || !b1) { out.order.push(`#${i + 1}: ${a1 ? "gone: " + where(a1) : "added: " + where(b1)}`); continue; }
    if (where(a1) !== where(b1)) { out.order.push(`#${i + 1}: was ${where(a1)}, is ${where(b1)}`); continue; }
    out.same++;
    if (!a1.handler.inline) { if (a1.handler.name !== b1.handler.name) out.differs.push(`#${i + 1} ${where(a1)}: handler was ${a1.handler.name}, is ${b1.handler.name || "inline"}`); continue; }
    if (b1.handler.inline) { out.inline++; if (a1.handler.body !== b1.handler.body) out.differs.push(`#${i + 1} ${where(a1)}: still inline, and its body changed`); continue; }
    const fn = functions.get(b1.handler.name);
    if (!fn) { out.differs.push(`#${i + 1} ${where(a1)}: now ${b1.handler.name}, which is not a top-level function under src/`); continue; }
    const ok = fn.body === a1.handler.body && fn.params === a1.handler.params && fn.async === a1.handler.async;
    (ok ? out.identical : out.differs).push(`#${i + 1} ${where(a1)} -> ${b1.handler.name} (${fn.file})${ok ? "" : fn.params !== a1.handler.params ? ": parameters differ" : ": body differs"}`);
  }
  console.log(`  same place, target, event and options: ${out.same} of ${then.length}${out.order.length ? "" : " - the order is kept"}`);
  out.order.forEach(x => console.log("    ORDER " + x));
  console.log(`  handlers that were closures and are named functions now, body identical: ${out.identical.length}`);
  if (process.argv.includes("--handlers")) out.identical.forEach(x => console.log("    = " + x));
  console.log(`  still inline in boot(): ${out.inline}`);
  console.log(`  differ (${out.differs.length}): ${out.differs.length ? "" : "none"}`);
  out.differs.forEach(x => console.log("    ! " + x));
}
