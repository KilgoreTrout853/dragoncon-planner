# tools/split

The tools the module split is done with (`docs/SPLIT-MANIFEST.md`). They made
the leaves slice as scratch scripts; they are kept here so the next slice does
not have to rebuild them. Working tools for a job that ends: the docs slice
decides whether they stay. Nothing here ships - the build never sees `tools/`.

Run from the repo root, with Node and `npm ci` done. They read `src/`; only
`move.js --write` and `imports.js --write` change anything.

| file | what it is |
|---|---|
| `scope.js` | The parser: a scope-aware read of one module's text (Vite's `parseAst`, then a walk with a scope stack), giving for every top-level declaration what it reads while the module is imported, what it reads later, and what it assigns. `freeOf(node)` and `localsOf(fn)` do the same for one function: its free names, and the names declared inside it. The other tools import it. |
| `parse.js` | The parser's command line: `node tools/split/parse.js [file] [--deps] [--json out.json]`. Every top-level declaration by line, under the file's own banners; `--json` is what a manifest's tables are generated from. |
| `handlers.js` | `boot()`, read: `node tools/split/handlers.js [--at <commit>] [--md] [--json out.json]`. Every registration in source order - listener, interval, frame, observer, promise - with its target, event and options; and for each handler written inline, the `boot()`-locals it closes over and the module-level names it reads and assigns. `--md` is the manifest's registrations table. |
| `where.js` | `node tools/split/where.js name ...` - the line ranges those names occupy in the root file now, comments attached, with the lines at each edge, so a cut is looked at before it is made. |
| `move.js` | The mover: `node tools/split/move.js spec.js [--write]`. Cuts blocks out of the root file by line range and pastes them into a new module; a segment `{ handler: n, name: "onX" }` lifts registration n's inline closure out of `boot()` into a named function and leaves the name behind. Refuses unless the new file's names and imports are exactly the manifest's, a lifted closure closes over nothing local to `boot()`, and `boot()` still registers what it did in the order it did. The spec format is in its header. |
| `imports.js` | `node tools/split/imports.js [--write]` - rewrites the root file's import lines from what it references now. Run after a move's hand edits. |
| `partition.js` | The partition check: `node tools/split/partition.js <commit> [--lines] [--handlers]`. Every top-level statement of the root file at that commit must exist, byte for byte, in exactly one module now; then `boot()`'s registrations must be the same ones in the same order, and every closure that has become a named function must have the same parameters and the same body, its extra indentation aside. What differs is printed. |
| `repo.js` | Paths, the root file, and the module order - which is read from `tests/rules/imports.test.js`, so there is one list. |

The root file is `src/boot.js` when there is one and `src/app.js` until then;
`--root <file>` overrides.

One move, in order: `where.js` for the ranges and `handlers.js` for the
registration numbers; the hand edits the manifest names (a `render()` that
becomes `requestRender()`, an assignment that becomes a call) made in the root
first; write the spec; `move.js spec.js` (dry run), then `--write`;
`imports.js --write`; `npm run lint && npm test`; commit. At the end of a
slice, `partition.js <base commit>`.
