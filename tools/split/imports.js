/* Rewrite the root file's import lines from what it references NOW. A move can
   leave an earlier line importing a name the root file no longer uses, and a
   hand edit can add a use; nothing else in the repo notices either until
   no-unused-vars does. One import per module, in the order, names sorted,
   wrapped like the export list when long; the minisearch line stays while
   MiniSearch is still referenced.

   node tools/split/imports.js [--write] [--root app.js] */
import fs from "node:fs";
import path from "node:path";
import { study } from "./scope.js";
import { SRC, byName, moduleOrder, readLF, rootFile, wrapNames } from "./repo.js";

const root = rootFile();
const text = readLF(root);
const s = study(text);
/* the imports are the first statements of the file, and nothing sits between them */
const end = s.imports.length ? Math.max(...s.imports.map(i => i.end)) : 0;
const head = text.slice(0, end), body = text.slice(end).replace(/^\n/, "");
if (study(body).imports.length) throw new Error("an import sits below other code in the root file");
if (head.replace(/import[\s\S]*?from\s*"[^"]+";|import\s*"[^"]+";/g, "").trim()) throw new Error("something other than imports sits among the root file's imports");

const rest = study(body);
const free = new Set([...rest.reads, ...rest.writes.map(w => w.name)].filter(n => !rest.declared.has(n)));
const out = [], assigned = [];
if (free.has("MiniSearch")) out.push(`import MiniSearch from "minisearch";`);
for (const m of moduleOrder()) {
  const f = path.join(SRC, `${m}.js`);
  if (!fs.existsSync(f) || f === root) continue;
  const exported = study(readLF(f)).exported;
  for (const w of rest.writes) if (exported.includes(w.name)) assigned.push(`${w.name} (${m})`);
  const used = exported.filter(n => free.has(n)).sort(byName);
  if (!used.length) continue;
  const one = `import { ${used.join(", ")} } from "./${m}.js";`;
  out.push(one.length <= 110 ? one : `import {\n${wrapNames(used)}\n} from "./${m}.js";`);
}
const next = out.join("\n");
console.log(next);
console.log(next === head ? "-> the root file already has exactly these" : "-> differs from what the root file has");
if (assigned.length) console.log("!! the root file ASSIGNS an imported name: " + [...new Set(assigned)].join(", "));
if (next !== head && process.argv.includes("--write")) { fs.writeFileSync(root, next + "\n" + body); console.log("WRITTEN"); }
