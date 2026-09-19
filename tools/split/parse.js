/* The parser's command line: every top-level declaration of a module, by line,
   under the file's own section banners - what it reads while the module is
   imported, what it reads later, what it assigns.

   node tools/split/parse.js [file] [--deps] [--json out.json]
     file     defaults to src/app.js
     --deps   print the reads and writes under each declaration
     --json   write the whole study to a file, for a script to assign modules from */
import fs from "node:fs";
import path from "node:path";
import { study } from "./scope.js";
import { ROOT, SRC, readLF } from "./repo.js";

const args = process.argv.slice(2);
const jsonAt = args.indexOf("--json");
const jsonOut = jsonAt >= 0 ? args[jsonAt + 1] : null;
const deps = args.includes("--deps");
const given = args.find((a, i) => !a.startsWith("--") && !(jsonAt >= 0 && i === jsonAt + 1));
const file = given ? path.resolve(given) : path.join(SRC, "app.js");

const code = readLF(file);
const s = study(code);
const lines = code.split("\n");
const own = new Set(s.declared.keys());
const split = names => ({
  own: names.filter(n => own.has(n)),
  imported: names.filter(n => s.imported.has(n)),
  globals: names.filter(n => !own.has(n) && !s.imported.has(n)),
});

/* the ==== banners carry their title on the next line; the ---- ones carry it inline */
const banners = [];
lines.forEach((l, i) => {
  if (/^\/\* ={10,}/.test(l)) banners.push({ line: i + 1, title: "== " + (lines[i + 1] || "").trim() });
  else if (/^\/\* ---- /.test(l)) banners.push({ line: i + 1, title: l.replace(/^\/\* ---- /, "-- ").replace(/-* ?\*\/\s*$/, "").trim() });
});

const exported = new Set(s.exported);
const kinds = {};
let b = 0;
for (const d of s.declarations) {
  while (b < banners.length && banners[b].line <= d.line) { console.log(`\n### ${banners[b].line}: ${banners[b].title}`); b++; }
  kinds[d.kind] = (kinds[d.kind] || 0) + d.names.length;
  const where = `${d.line}${d.endLine !== d.line ? "-" + d.endLine : ""}`.padEnd(10);
  console.log(`${where} ${d.names.some(n => exported.has(n)) ? "E" : " "} ${d.kind.padEnd(8)} ${d.names.join(", ")}`);
  if (!deps) continue;
  const now = split(d.atImport.filter(n => !d.names.includes(n))), later = split(d.later.filter(n => !d.names.includes(n)));
  if (d.runsAtImport && (now.own.length || now.imported.length)) console.log(`             at import: ${[...now.own, ...now.imported.map(n => n + "*")].join(" ")}`);
  if (d.runsAtImport && now.globals.length) console.log(`             at import, globals: ${now.globals.join(" ")}`);
  const after = d.runsAtImport ? later : { own: [...now.own, ...later.own], imported: [...now.imported, ...later.imported] };
  if (after.own.length || after.imported.length) console.log(`             later: ${[...after.own, ...after.imported.map(n => n + "*")].join(" ")}`);
  if (d.writes.length) console.log(`             ASSIGNS: ${d.writes.map(w => `${w.name}@${w.line}`).join(" ")}`);
}
console.log(`\n${path.relative(ROOT, file)}: ${s.lines} lines, ${s.imports.length} import(s), ${s.declarations.reduce((t, d) => t + d.names.length, 0)} top-level names ${JSON.stringify(kinds)}, ${s.exported.length} exported${deps ? "   (* = imported)" : ""}`);

if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify({
    file: path.relative(ROOT, file).replace(/\\/g, "/"), lines: s.lines, imports: s.imports.map(({ source, names }) => ({ source, names })),
    exported: s.exported, declarations: s.declarations.map(d => { const rest = { ...d }; delete rest.text; return rest; }),
  }, null, 1));
  console.log("written: " + jsonOut);
}
