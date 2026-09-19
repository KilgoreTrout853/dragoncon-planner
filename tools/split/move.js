/* The mover: one module out of the root file, by block - cut and paste by line
   range or by a closure's own source range, never by name (CLAUDE.md 9).

   node tools/split/move.js <spec.js> [--write] [--root app.js]

   A spec is a module that default-exports:
     name      the new module, e.g. "scroll"
     header    the new file's header comment, or "" when the section's own
               banner travels and is the top of the file
     segments  in the order they appear in the new file; each is
                 { lines: [from, to] }               a block cut from the root file as it is NOW, verbatim
                 { lines: [from, to], drop: true }   cut and not pasted (a banner whose section is now empty)
                 { text: "..." }                     new text: a setter, the frame round a moved block
                 { handler: n, name: "onX" }         registration n of boot() (handlers.js prints them): the
                                                     inline closure becomes `function onX(params) { body }`,
                                                     its body dedented and otherwise untouched, and in the root
                                                     the closure is replaced by the name. comment: true takes
                                                     the comment block directly above the registration too.
               glue: true joins a segment to the next with no blank line
     names     the top-level names the new file must declare: the manifest's
               takes, plus any new functions
     exports   its export list; a name left out stays private
     imports   what the manifest says it imports: { util: ["esc"], npm: ["minisearch"] }

   Nothing is written unless every check passes and --write is given:
     - the new file's top-level names are exactly `names`
     - the imports computed from its text are exactly `imports`, and none is
       from a module later in the order
     - it assigns nothing it does not own
     - no handler it takes closes over a boot()-local
     - the root file no longer declares any of `names`, and uses none of them
       that the module keeps private
     - boot() registers what it registered, in the order it did
   The new file ends with one `export { ... }` list, as the root file does, so
   the pasted code is byte for byte what it was. The root file's own export
   list is pruned of what moved. Its import lines are NOT touched here: run
   imports.js after the hand edits. Assignments the root file still makes to a
   name that moved are listed; each becomes a call. */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { study } from "./scope.js";
import { registrationsOf } from "./handlers.js";
import { SRC, byName, moduleOrder, readLF, rootFile, wrapNames } from "./repo.js";

const stop = msg => { console.error("STOP: " + msg); process.exit(1); };
const specPath = process.argv[2];
if (!specPath || specPath.startsWith("--")) stop("usage: node tools/split/move.js <spec.js> [--write] [--root app.js]");
const spec = (await import(pathToFileURL(path.resolve(specPath)).href)).default;
const write = process.argv.includes("--write");
const ORDER = moduleOrder();
if (!ORDER.includes(spec.name)) stop(`${spec.name} is not in the order in tests/rules/imports.test.js`);

const root = rootFile();
const code = readLF(root);
const L = code.split("\n");
const lineStart = [0];
for (let i = 0; i < code.length; i++) if (code[i] === "\n") lineStart.push(i + 1);
const lineOf = pos => { let lo = 0, hi = lineStart.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStart[mid] <= pos) lo = mid; else hi = mid - 1; } return lo + 1; };
const takesHandlers = spec.segments.some(s => s.handler);
const regs = takesHandlers ? registrationsOf(code).registrations : [];

/* the comment block that ends on the line above n, if there is one: [from, to] */
function commentAbove(n) {
  let to = n - 1, from = 0;
  if (to < 1 || !L[to - 1].trim().endsWith("*/")) return null;
  for (let i = to; i >= 1; i--) if (L[i - 1].includes("/*")) { from = L[i - 1].trim().startsWith("/*") ? i : 0; break; }
  return from ? [from, to] : null;
}
const dedent = text => {
  const lines = text.split("\n");
  const cut = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
  return lines.map(l => l.slice(Math.min(cut, l.match(/^ */)[0].length)));
};

/* 1. the pieces of the new file, and the edits to the root that go with them */
const lineCuts = [], swaps = [];                               // [from, to] in lines; { start, end, text } in characters
const pieces = [];
for (const s of spec.segments) {
  if (s.lines) {
    const [a, b] = s.lines;
    if (a > b || a < 1 || b > L.length) stop(`bad range ${a}-${b}`);
    lineCuts.push([a, b]);
    if (!s.drop) pieces.push({ text: L.slice(a - 1, b).join("\n"), glue: s.glue });
  } else if (s.handler) {
    const r = regs[s.handler - 1];
    if (!r) stop(`boot() has no registration ${s.handler}`);
    const h = r.handler;
    if (!h.inline) stop(`registration ${s.handler} already passes a name, ${h.name}`);
    if (h.closesOver.length) stop(`registration ${s.handler} closes over boot()-locals (${h.closesOver.join(", ")}) and cannot move as it is`);
    const open = `${h.async ? "async " : ""}function ${s.name}(${h.params}) {`;
    let text;
    if (h.expression) text = `${open} ${h.body}; }`;
    else {
      const inner = code.slice(h.bodyStart + 1, h.bodyEnd - 1);         // between the closure's own braces
      text = inner.includes("\n") ? `${open}\n${dedent(inner.replace(/^\s*\n/, "").replace(/\s+$/, "")).map(l => (l ? "  " + l : l)).join("\n")}\n}` : `${open} ${inner.trim()} }`;
    }
    const above = s.comment ? commentAbove(r.line) : null;
    if (s.comment && !above) stop(`registration ${s.handler}: no comment block directly above line ${r.line}`);
    if (above) { lineCuts.push(above); text = dedent(L.slice(above[0] - 1, above[1]).join("\n")).join("\n") + "\n" + text; }
    swaps.push({ start: h.start, end: h.end, text: s.name });
    pieces.push({ text, glue: s.glue });
  } else pieces.push({ text: s.text.replace(/\n+$/, ""), glue: s.glue });
}
lineCuts.sort((a, b) => a[0] - b[0]);
lineCuts.forEach(([a, b], i) => { if (i && a <= lineCuts[i - 1][1]) stop(`ranges overlap: ${lineCuts[i - 1]} and ${a}-${b}`); });
for (const w of swaps) for (const [a, b] of lineCuts) if (lineOf(w.start) <= b && lineOf(w.end) >= a) stop(`a handler and a line range overlap near line ${a}`);
const body = pieces.map((p, i) => p.text + (i === pieces.length - 1 ? "" : p.glue ? "\n" : "\n\n")).join("");

/* 2. what the new file needs from the modules that exist, and from npm */
const made = study(body);
const homes = new Map();                                       // exported name -> module
for (const m of ORDER) {
  const f = path.join(SRC, `${m}.js`);
  if (m !== spec.name && fs.existsSync(f)) for (const n of study(readLF(f)).exported) homes.set(n, m);
}
const needs = {};
for (const n of new Set([...made.reads, ...made.writes.map(w => w.name)])) {
  if (made.declared.has(n)) continue;
  if (n === "MiniSearch") (needs.npm = needs.npm || []).push("minisearch");
  else if (homes.has(n)) (needs[homes.get(n)] = needs[homes.get(n)] || []).push(n);
}
const foreign = made.writes.filter(w => !made.declared.has(w.name));
if (foreign.length) stop(`${spec.name} would assign a name it does not own: ${[...new Set(foreign.map(w => w.name))].join(" ")}`);
const normal = o => JSON.stringify(Object.entries(o || {}).map(([k, v]) => [k, [...v].sort(byName)]).sort(([a], [b]) => a.localeCompare(b)));
if (normal(needs) !== normal(spec.imports)) stop(`imports differ from the manifest\n  computed: ${normal(needs)}\n  manifest: ${normal(spec.imports)}`);
for (const m of Object.keys(needs)) if (m !== "npm" && ORDER.indexOf(m) >= ORDER.indexOf(spec.name)) stop(`${spec.name} would import ${m}, which is not before it in the order`);

/* 3. the new file */
const importLines = [];
if (needs.npm) importLines.push(`import MiniSearch from "minisearch";`);
for (const m of ORDER) if (needs[m]) { const one = `import { ${needs[m].sort(byName).join(", ")} } from "./${m}.js";`; importLines.push(one.length <= 110 ? one : `import {\n${wrapNames(needs[m])}\n} from "./${m}.js";`); }
const oneLine = `export { ${spec.exports.join(", ")} };`;
const exportBlock = spec.exports.length <= 6 && oneLine.length <= 100 ? oneLine : `export {\n${wrapNames(spec.exports)}\n};`;
const top = [...(spec.header ? [spec.header.replace(/\n+$/, "")] : []), ...(importLines.length ? [importLines.join("\n")] : [])];
const fileText = [...top, ...(top.length ? [""] : []), body, "", exportBlock, ""].join("\n");
const declared = [...study(fileText).declared.keys()].sort(byName), expected = [...spec.names].sort(byName);
if (JSON.stringify(declared) !== JSON.stringify(expected)) stop(`the new file's top-level names are not the manifest's\n  extra:   ${declared.filter(n => !expected.includes(n)).join(" ")}\n  missing: ${expected.filter(n => !declared.includes(n)).join(" ")}`);
for (const n of spec.exports) if (!declared.includes(n)) stop(`exports ${n}, which the file does not declare`);

/* 4. the root file: whole lines cut (a cut between two blank lines takes one of
   them), and each moved closure replaced, in place, by its new name */
const gone = new Set();
for (const [a, b] of lineCuts) {
  for (let n = a; n <= b; n++) gone.add(n);
  const blankBefore = a === 1 || L[a - 2].trim() === "" || gone.has(a - 1), blankAfter = b < L.length && L[b].trim() === "";
  if (blankBefore && blankAfter) gone.add(b + 1);
}
const edits = [...swaps];
for (const n of gone) edits.push({ start: lineStart[n - 1], end: n < lineStart.length ? lineStart[n] : code.length, text: "" });
edits.sort((a, b) => b.start - a.start);
let rest = code;
for (const e of edits) rest = rest.slice(0, e.start) + e.text + rest.slice(e.end);

/* its export list, pruned: groups separated by a blank line, each re-wrapped */
const moved = new Set(spec.names);
const listAt = rest.lastIndexOf("\nexport {\n");
if (listAt < 0) stop("the root file's export list was not found");
const listEnd = rest.indexOf("\n};", listAt);
const groups = rest.slice(listAt + "\nexport {\n".length, listEnd).split(/\n\s*\n/).map(g => g.split(",").map(s => s.trim()).filter(Boolean));
const pruned = groups.flat().filter(n => moved.has(n));
rest = rest.slice(0, listAt) + "\nexport {\n" + groups.map(g => wrapNames(g.filter(n => !moved.has(n)))).filter(Boolean).join("\n\n") + rest.slice(listEnd);

const after = study(rest);
const stillDeclared = [...moved].filter(n => after.declared.has(n));
if (stillDeclared.length) stop(`the root file still declares: ${stillDeclared.join(" ")}`);
const used = [...new Set([...after.reads, ...after.writes.map(w => w.name)])].filter(n => moved.has(n)).sort(byName);
const privateUsed = used.filter(n => !spec.exports.includes(n));
if (privateUsed.length) stop(`the root file still uses names the module keeps private: ${privateUsed.join(" ")}`);
const assigns = after.writes.filter(w => moved.has(w.name));
if (takesHandlers) {
  const now = registrationsOf(rest).registrations, where = r => `${r.kind}|${r.target}|${r.event}|${r.options}`;
  if (now.length !== regs.length || now.some((r, i) => where(r) !== where(regs[i]))) stop("boot() no longer registers what it did, in the order it did");
}

console.log(`${spec.name}.js: ${fileText.split("\n").length - 1} lines, ${declared.length} names; ${path.basename(root)} ${L.length - 1} -> ${rest.split("\n").length - 1} lines`);
console.log("imports:", importLines.join("  ").replace(/\n/g, " ") || "none");
console.log(`${path.basename(root)} will import:`, used.join(", ") || "nothing");
console.log("pruned from its export list:", pruned.join(" ") || "none");
console.log("exported for tests or later modules only:", spec.exports.filter(n => !used.includes(n)).join(" ") || "none");
if (takesHandlers) console.log("handlers lifted out of boot():", spec.segments.filter(s => s.handler).map(s => `#${s.handler} ${s.name}`).join(", "));
console.log("ASSIGNMENTS LEFT in the root file to a name that moved - each becomes a call:", assigns.length ? assigns.map(w => `${w.name}@${w.line}`).join(" ") : "none");
if (write) { fs.writeFileSync(path.join(SRC, `${spec.name}.js`), fileText); fs.writeFileSync(root, rest); console.log("WRITTEN - now the hand edits, then imports.js"); }
else console.log("(dry run)");
