/* The parser the split tools share: a scope-aware read of one module's text.

   study(code) parses with Vite's parseAst and walks every top-level statement
   with a scope stack - parameters, block and catch scopes, hoisted vars - so a
   local called now, pad, index or events is not mistaken for the module's own
   (CLAUDE.md 9). For each top-level declaration it records the names that are
   NOT bound locally - the module's own top-level names, its imports, globals:

     atImport   read while the module is being imported
     later      read inside a function body, so only when something calls it
     writes     assigned, with the line

   An initializer that is not itself a function may run the callbacks it
   contains during import (follows = load(...).filter(f => KINDS.includes(...))),
   so everything inside it counts as atImport. A parameter default is read at
   call time, so it counts as later. */
import { parseAst } from "vite";

export const patternIds = (p, out = []) => {
  if (!p) return out;
  switch (p.type) {
    case "Identifier": out.push(p.name); break;
    case "ObjectPattern": for (const q of p.properties) patternIds(q.type === "RestElement" ? q.argument : q.value, out); break;
    case "ArrayPattern": for (const q of p.elements) patternIds(q, out); break;
    case "AssignmentPattern": patternIds(p.left, out); break;
    case "RestElement": patternIds(p.argument, out); break;
  }
  return out;
};

/* var declarations hoist to the function; let, const, class and function
   declarations belong to the block they are written in */
const hoistedVars = (node, out) => {
  if (!node || typeof node.type !== "string") return;
  if (/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|ClassDeclaration|ClassExpression)$/.test(node.type)) return;
  if (node.type === "VariableDeclaration" && node.kind === "var") for (const d of node.declarations) patternIds(d.id, out);
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) for (const n of v) hoistedVars(n, out);
    else if (v && typeof v === "object") hoistedVars(v, out);
  }
};
const blockNames = (stmts, out = []) => {
  for (const st of stmts || []) {
    const s = st.type === "ExportNamedDeclaration" && st.declaration ? st.declaration : st;
    if (s.type === "VariableDeclaration" && s.kind !== "var") for (const d of s.declarations) patternIds(d.id, out);
    else if (s.type === "FunctionDeclaration" || s.type === "ClassDeclaration") out.push(s.id.name);
  }
  return out;
};

/* sink.read(name, deferred) and sink.write(name, deferred, pos), for names no local scope binds */
function walk(node, scopes, sink, depth) {
  if (!node || typeof node.type !== "string") return;
  const bound = (name, sc = scopes) => sc.some(s => s.has(name));
  const pattern = (p, isWrite, sc, d) => {
    if (!p) return;
    switch (p.type) {
      case "Identifier": if (isWrite && !bound(p.name, sc)) sink.write(p.name, d > 0, p.start); break;
      case "MemberExpression": walk(p, sc, sink, d); break;
      case "ObjectPattern":
        for (const q of p.properties) {
          if (q.type === "RestElement") pattern(q.argument, isWrite, sc, d);
          else { if (q.computed) walk(q.key, sc, sink, d); pattern(q.value, isWrite, sc, d); }
        }
        break;
      case "ArrayPattern": for (const q of p.elements) pattern(q, isWrite, sc, d); break;
      case "AssignmentPattern": pattern(p.left, isWrite, sc, d); walk(p.right, sc, sink, d); break;
      case "RestElement": pattern(p.argument, isWrite, sc, d); break;
      default: walk(p, sc, sink, d);
    }
  };
  switch (node.type) {
    case "Identifier": if (!bound(node.name)) sink.read(node.name, depth > 0); return;
    case "FunctionDeclaration": case "FunctionExpression": case "ArrowFunctionExpression": {
      const own = new Set();
      for (const p of node.params) patternIds(p).forEach(n => own.add(n));
      if (node.type === "FunctionExpression" && node.id) own.add(node.id.name);
      if (node.type !== "ArrowFunctionExpression") own.add("arguments");
      const inner = [...scopes, own];
      for (const p of node.params) pattern(p, false, inner, depth + 1);      // defaults run at call time
      if (node.body.type === "BlockStatement") {
        const vars = []; hoistedVars(node.body, vars); vars.forEach(n => own.add(n));
        blockNames(node.body.body).forEach(n => own.add(n));
        for (const st of node.body.body) walk(st, inner, sink, depth + 1);
      } else walk(node.body, inner, sink, depth + 1);
      return;
    }
    case "ClassDeclaration": case "ClassExpression": {
      if (node.superClass) walk(node.superClass, scopes, sink, depth);
      const own = new Set(); if (node.id) own.add(node.id.name);
      const inner = [...scopes, own];
      for (const m of node.body.body) {
        if (m.computed) walk(m.key, inner, sink, depth);
        if (m.value) walk(m.value, inner, sink, m.type === "PropertyDefinition" && !m.static ? depth + 1 : depth);
        if (m.type === "StaticBlock") for (const st of m.body) walk(st, inner, sink, depth);
      }
      return;
    }
    case "BlockStatement": case "StaticBlock": {
      const inner = [...scopes, new Set(blockNames(node.body))];
      for (const st of node.body) walk(st, inner, sink, depth);
      return;
    }
    case "ForStatement": case "ForInStatement": case "ForOfStatement": {
      const own = new Set(), head = node.type === "ForStatement" ? node.init : node.left;
      if (head && head.type === "VariableDeclaration" && head.kind !== "var") for (const d of head.declarations) patternIds(d.id).forEach(n => own.add(n));
      const inner = [...scopes, own];
      if (head) { if (head.type === "VariableDeclaration" || node.type === "ForStatement") walk(head, inner, sink, depth); else pattern(head, true, inner, depth); }
      if (node.type === "ForStatement") { walk(node.test, inner, sink, depth); walk(node.update, inner, sink, depth); } else walk(node.right, inner, sink, depth);
      walk(node.body, inner, sink, depth);
      return;
    }
    case "SwitchStatement": {
      walk(node.discriminant, scopes, sink, depth);
      const own = new Set(); for (const c of node.cases) blockNames(c.consequent).forEach(n => own.add(n));
      const inner = [...scopes, own];
      for (const c of node.cases) { walk(c.test, inner, sink, depth); for (const st of c.consequent) walk(st, inner, sink, depth); }
      return;
    }
    case "CatchClause": walk(node.body, [...scopes, new Set(patternIds(node.param))], sink, depth); return;
    case "VariableDeclaration": for (const d of node.declarations) { pattern(d.id, false, scopes, depth); if (d.init) walk(d.init, scopes, sink, depth); } return;
    case "AssignmentExpression":
      if (node.operator !== "=" && node.left.type === "Identifier" && !bound(node.left.name)) sink.read(node.left.name, depth > 0);
      pattern(node.left, true, scopes, depth); walk(node.right, scopes, sink, depth);
      return;
    case "UpdateExpression":
      if (node.argument.type === "Identifier") { if (!bound(node.argument.name)) { sink.read(node.argument.name, depth > 0); sink.write(node.argument.name, depth > 0, node.argument.start); } }
      else walk(node.argument, scopes, sink, depth);
      return;
    case "MemberExpression": walk(node.object, scopes, sink, depth); if (node.computed) walk(node.property, scopes, sink, depth); return;
    case "Property": if (node.computed) walk(node.key, scopes, sink, depth); walk(node.value, scopes, sink, depth); return;
    case "LabeledStatement": walk(node.body, scopes, sink, depth); return;
    case "BreakStatement": case "ContinueStatement": case "MetaProperty": case "ImportDeclaration": return;
    case "ExportNamedDeclaration": if (node.declaration) walk(node.declaration, scopes, sink, depth); return;
  }
  for (const [key, v] of Object.entries(node)) {
    if (key === "type" || key === "start" || key === "end") continue;
    if (Array.isArray(v)) for (const n of v) walk(n, scopes, sink, depth);
    else if (v && typeof v === "object" && typeof v.type === "string") walk(v, scopes, sink, depth);
  }
}

export function study(code) {
  const ast = parseAst(code, { lang: "js", sourceType: "module" });
  const starts = [0];
  for (let i = 0; i < code.length; i++) if (code[i] === "\n") starts.push(i + 1);
  const lineOf = pos => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; } return lo + 1; };

  const declared = new Map(), imported = new Map(), exported = [], imports = [], declarations = [];
  for (const st of ast.body) {
    if (st.type === "ImportDeclaration") {
      imports.push({ source: st.source.value, names: st.specifiers.map(s => s.local.name), start: st.start, end: st.end });
      for (const s of st.specifiers) imported.set(s.local.name, st.source.value);
    } else if (st.type === "ExportNamedDeclaration" && !st.declaration) for (const s of st.specifiers) exported.push(s.local.name);
  }
  const reads = new Set(), writes = [];
  for (const st of ast.body) {
    if (st.type === "ImportDeclaration" || (st.type === "ExportNamedDeclaration" && !st.declaration)) continue;
    const s = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    const isVars = s.type === "VariableDeclaration";
    const kind = isVars ? s.kind : s.type === "FunctionDeclaration" ? "function" : s.type === "ClassDeclaration" ? "class" : s.type;
    /* one entry per declarator, so `let a = f(), b = 1` says which of the two reads f */
    const parts = isVars ? s.declarations.map(d => ({ node: d, names: patternIds(d.id), init: d.init })) : [{ node: s, names: s.id ? [s.id.name] : [] }];
    for (const part of parts) {
      const now = new Set(), later = new Set(), own = [];
      const sink = {
        read: (name, deferred) => { (deferred ? later : now).add(name); reads.add(name); },
        write: (name, deferred, pos) => { own.push({ name, line: lineOf(pos), atImport: !deferred }); writes.push({ name, line: lineOf(pos) }); },
      };
      if (isVars) { if (part.init) walk(part.init, [], sink, 0); } else walk(part.node, [], sink, 0);
      const runsAtImport = isVars && !!part.init && !/^(ArrowFunctionExpression|FunctionExpression|ClassExpression)$/.test(part.init.type);
      if (runsAtImport) for (const n of later) now.add(n);
      for (const n of part.names) declared.set(n, kind);
      if (st.type === "ExportNamedDeclaration") exported.push(...part.names);
      declarations.push({
        names: part.names, kind, exportedInline: st.type === "ExportNamedDeclaration",
        line: lineOf(isVars && parts.length === 1 ? st.start : part.node.start), endLine: lineOf(part.node.end - 1),
        statementLine: lineOf(st.start), statementEndLine: lineOf(st.end - 1),
        runsAtImport, atImport: [...now].sort(), later: [...later].filter(n => !now.has(n)).sort(), writes: own,
        text: code.slice(s.start, s.end),
      });
    }
  }
  return { declared, imported, imports, exported, declarations, reads, writes, lineOf, lines: starts.length };
}
