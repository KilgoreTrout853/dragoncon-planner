/* Where are these names in the root file NOW, with the comments attached above
   them? Line numbers go stale at every move, so ranges are found fresh each
   time. Consecutive declarations with only blank lines between them become one
   range, and the lines at each edge are printed, so every cut can be looked at
   before it is made - a banner that belongs to what stays, a comment that
   describes something else.

   node tools/split/where.js name1 name2 ... [--root app.js] */
import { study } from "./scope.js";
import { readLF, rootFile } from "./repo.js";

const args = process.argv.slice(2);
const rootAt = args.indexOf("--root");
const want = args.filter((a, i) => !a.startsWith("--") && !(rootAt >= 0 && i === rootAt + 1));
const code = readLF(rootFile());
const L = code.split("\n");                                   // L[n - 1] is line n
const { declarations } = study(code);

const isBlank = n => L[n - 1].trim() === "";
/* the first line of the comment block that ends on line n, or 0 if line n does not end one */
function commentStart(n) {
  const t = L[n - 1].trim();
  if (t.startsWith("//")) return n;
  if (!t.endsWith("*/")) return 0;
  for (let i = n; i >= 1; i--) if (L[i - 1].includes("/*")) return L[i - 1].trim().startsWith("/*") ? i : 0;
  return 0;
}

const ranges = [];
for (const name of want) {
  const d = declarations.find(x => x.names.includes(name));
  if (!d) throw new Error(`${name}: not a top-level name in the root file`);
  const sharing = declarations.filter(x => x.statementLine === d.statementLine).flatMap(x => x.names).filter(n => !want.includes(n));
  let from = d.statementLine;
  for (let c = commentStart(from - 1); from > 1 && c; c = commentStart(from - 1)) from = c;
  ranges.push({ from, to: d.statementEndLine, names: [name], sharing });
}
ranges.sort((a, b) => a.from - b.from);
const merged = [];
for (const r of ranges) {
  const last = merged[merged.length - 1];
  let onlyBlank = !!last;
  if (last) for (let n = last.to + 1; n < r.from; n++) if (!isBlank(n)) onlyBlank = false;
  if (last && (r.from <= last.to || onlyBlank)) { last.to = Math.max(last.to, r.to); last.names.push(...r.names); last.sharing.push(...r.sharing); }
  else merged.push({ ...r, names: [...r.names], sharing: [...r.sharing] });
}
const show = n => (n >= 1 && n <= L.length ? `${String(n).padStart(5)}| ${L[n - 1].slice(0, 110)}` : "");
for (const r of merged) {
  const also = [...new Set(r.sharing)];
  console.log(`\n[${r.from}, ${r.to}]  ${r.to - r.from + 1} lines  ${[...new Set(r.names)].join(" ")}${also.length ? `   !! the statement also declares: ${also.join(" ")}` : ""}`);
  console.log("   before " + show(r.from - 1));
  console.log("   first  " + show(r.from));
  if (r.to > r.from) console.log("   last   " + show(r.to));
  console.log("   after  " + show(r.to + 1));
}
console.log("\nsegments: " + JSON.stringify(merged.map(r => ({ lines: [r.from, r.to] }))));
