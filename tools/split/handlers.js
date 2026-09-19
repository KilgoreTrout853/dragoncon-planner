/* boot() is the one function the split cannot move by line range: its
   handlers are closures, written inline as arguments. This reads it.

   registrationsOf(code) lists, in source order, every place boot() hands a
   function to something that will call it later - addEventListener,
   setInterval, setTimeout, requestAnimationFrame, an observer, a promise's
   then or catch - with the target, the event, the options and the handler:
   a name, or an inline function with its parameters, its body, the
   module-level names it reads and assigns, and the boot()-locals it closes
   over. A handler that closes over a boot()-local cannot move as it is.
   Only boot()'s own statements count: a registration inside a handler's body
   belongs to that body.

   node tools/split/handlers.js [--at <commit>] [--root app.js] [--md] [--json out.json] */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { freeOf, localsOf, parse } from "./scope.js";
import { ROOT, readLF, rootFile } from "./repo.js";

const isFn = n => n && /^(FunctionExpression|ArrowFunctionExpression)$/.test(n.type);

export function bootOf(ast) {
  for (const st of ast.body) {
    const s = st.type === "ExportNamedDeclaration" && st.declaration ? st.declaration : st;
    if (s.type === "FunctionDeclaration" && s.id.name === "boot") return s;
  }
  throw new Error("no top-level function boot() in this file");
}

/* a body's text with its common indentation removed: a closure inside boot()
   sits deeper than the same statements in a top-level function, and that is
   the only difference the partition rule allows */
export function normalBody(text) {
  const lines = text.replace(/^\s*\n/, "").replace(/\s+$/, "").split("\n");
  const indents = lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return lines.map(l => l.slice(Math.min(cut, l.match(/^ */)[0].length))).join("\n").trim();
}
export function bodyOf(fn, code) {
  if (fn.body.type !== "BlockStatement") return normalBody(code.slice(fn.body.start, fn.body.end)).replace(/;$/, "");
  const inner = code.slice(fn.body.start + 1, fn.body.end - 1);
  /* a one-line body: `{ a(); b(); }` - the statements, without the braces' padding */
  return normalBody(inner).replace(/;$/, "");
}

export function registrationsOf(code) {
  const ast = parse(code);
  const boot = bootOf(ast);
  const starts = [0];
  for (let i = 0; i < code.length; i++) if (code[i] === "\n") starts.push(i + 1);
  const lineOf = pos => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; } return lo + 1; };
  const text = n => code.slice(n.start, n.end);
  const locals = localsOf(boot);
  const topLevel = new Set();
  for (const st of ast.body) {
    const s = st.type === "ExportNamedDeclaration" && st.declaration ? st.declaration : st;
    if (s.type === "VariableDeclaration") for (const d of s.declarations) if (d.id.type === "Identifier") topLevel.add(d.id.name);
    if (s.type === "FunctionDeclaration" || s.type === "ClassDeclaration") topLevel.add(s.id.name);
    if (s.type === "ImportDeclaration") for (const sp of s.specifiers) topLevel.add(sp.local.name);
  }

  const found = [];
  const record = (node, kind, target, event, options, handler) => {
    const r = { kind, target, event, options, line: lineOf(node.start), start: node.start, end: node.end };
    if (handler && handler.type === "Identifier") r.handler = { name: handler.name };
    else if (isFn(handler)) {
      const free = freeOf(handler);
      const names = new Set([...free.reads, ...free.writes.map(w => w.name)]);
      r.handler = {
        inline: true, start: handler.start, end: handler.end, bodyStart: handler.body.start, bodyEnd: handler.body.end,
        line: lineOf(handler.start), endLine: lineOf(handler.end - 1),
        params: handler.params.map(text).join(", "), expression: handler.body.type !== "BlockStatement", async: !!handler.async,
        body: bodyOf(handler, code),
        closesOver: [...names].filter(n => locals.has(n)).sort(),
        reads: [...free.reads].filter(n => topLevel.has(n) && !locals.has(n)).sort(),
        writes: free.writes.filter(w => topLevel.has(w.name) && !locals.has(w.name)).map(w => ({ name: w.name, line: lineOf(w.pos) })),
      };
    } else r.handler = { other: handler ? text(handler) : "" };
    found.push(r);
  };
  const visit = node => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "CallExpression") {
      const c = node.callee, a = node.arguments;
      if (c.type === "MemberExpression" && !c.computed && c.property.name === "addEventListener") record(node, "listener", text(c.object), a[0] && a[0].value, a[2] ? text(a[2]) : "", a[1]);
      else if (c.type === "Identifier" && /^(setInterval|setTimeout)$/.test(c.name)) record(node, c.name === "setInterval" ? "interval" : "timeout", "", a[1] ? text(a[1]) : "", "", a[0]);
      else if (c.type === "Identifier" && c.name === "requestAnimationFrame") record(node, "frame", "", "", "", a[0]);
      else if (c.type === "MemberExpression" && !c.computed && /^(then|catch)$/.test(c.property.name) && a[0] && (isFn(a[0]) || a[0].type === "Identifier")) record(node, "promise", text(c.object), c.property.name, "", a[0]);
    }
    if (node.type === "NewExpression" && node.callee.type === "Identifier" && /Observer$/.test(node.callee.name)) record(node, "observer", "", node.callee.name, "", node.arguments[0]);
    for (const [key, v] of Object.entries(node)) {
      if (key === "type" || isFn(v)) continue;                       // a handler's body is its own business
      if (Array.isArray(v)) v.forEach(x => { if (!isFn(x)) visit(x); });
      else if (v && typeof v === "object") visit(v);
    }
  };
  visit(boot.body);
  /* a.then(f).catch(g) is two calls that start at the same place; the inner one ends first, and was written first */
  found.sort((x, y) => x.start - y.start || x.end - y.end);
  found.forEach((r, i) => { r.index = i + 1; });

  /* what boot() itself reads and assigns once every inline handler is gone:
     the same function with each handler's body emptied */
  const hollow = structuredClone(boot);
  const inline = new Set(found.filter(r => r.handler.inline).map(r => r.handler.start));
  const empty = node => {
    if (!node || typeof node !== "object") return;
    if (isFn(node) && inline.has(node.start)) { node.params = []; node.body = { type: "BlockStatement", body: [], start: node.body.start, end: node.body.end }; return; }
    for (const v of Object.values(node)) { if (Array.isArray(v)) v.forEach(empty); else empty(v); }
  };
  empty(hollow.body);
  const mine = freeOf(hollow);
  const own = {
    reads: [...mine.reads].filter(n => topLevel.has(n)).sort(),
    writes: mine.writes.filter(w => topLevel.has(w.name)).map(w => ({ name: w.name, line: lineOf(w.pos) })),
  };
  return { registrations: found, locals: [...locals].sort(), own, bootLine: lineOf(boot.start), bootEndLine: lineOf(boot.end - 1) };
}

/* ---- command line ---------------------------------------------------- */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--at") >= 0 ? args[args.indexOf("--at") + 1] : null;
  const jsonOut = args.indexOf("--json") >= 0 ? args[args.indexOf("--json") + 1] : null;
  const file = rootFile();
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const code = at ? execFileSync("git", ["show", `${at}:${rel}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 }) : readLF(file);
  const { registrations, locals, own, bootLine, bootEndLine } = registrationsOf(code);
  const md = args.includes("--md");
  console.log(`boot() in ${rel}${at ? " at " + at : ""}: lines ${bootLine}-${bootEndLine}; its locals: ${locals.join(", ") || "none"}`);
  console.log(`${registrations.length} registrations, ${registrations.filter(r => r.handler.inline).length} with an inline handler\n`);
  for (const r of registrations) {
    const h = r.handler;
    const what = r.kind === "listener" ? `${r.target} "${r.event}"${r.options ? " " + r.options : ""}` : r.kind === "promise" ? `${r.target}.${r.event}()` : r.kind === "observer" ? `new ${r.event}` : `${r.kind}${r.event ? " " + r.event : ""}`;
    const how = h.inline ? `inline (${h.params || ""}) ${h.line === h.endLine ? "line " + h.line : `lines ${h.line}-${h.endLine}`}` : h.name ? `\`${h.name}\`` : h.other;
    if (md) console.log(`| ${r.index} | ${r.line} | ${what.replace(/\|/g, "\\|")} | ${how} |`);
    else {
      console.log(`${String(r.index).padStart(2)}. line ${r.line}  ${what}  <-  ${how}`);
      if (h.inline && h.closesOver.length) console.log(`      CLOSES OVER boot()-locals: ${h.closesOver.join(", ")}`);
      if (h.inline && h.writes.length) console.log(`      assigns: ${h.writes.map(w => `${w.name}@${w.line}`).join(" ")}`);
    }
  }
  const closing = registrations.filter(r => r.handler.inline && r.handler.closesOver.length);
  console.log(`\nhandlers that close over a boot()-local: ${closing.length ? closing.map(r => `#${r.index} (${r.handler.closesOver.join(", ")})`).join("; ") : "none"}`);
  console.log(`boot() itself, handlers aside, assigns: ${own.writes.map(w => `${w.name}@${w.line}`).join(" ") || "nothing"}`);
  if (jsonOut) { fs.writeFileSync(jsonOut, JSON.stringify({ file: rel, at, locals, own, registrations }, null, 1)); console.log("written: " + jsonOut); }
}
