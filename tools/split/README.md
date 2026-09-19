# tools/split

The tools the module split is done with (`docs/SPLIT-MANIFEST.md`). They made
the leaves slice as scratch scripts; they are kept here so the next slice does
not have to rebuild them. Working tools for a job that ends: the docs slice
decides whether they stay. Nothing here ships - the build never sees `tools/`.

Run from the repo root, with Node and `npm ci` done. They read `src/`; only
`move.js --write` and `imports.js --write` change anything.

| file | what it is |
|---|---|
| `scope.js` | The parser: a scope-aware read of one module's text (Vite's `parseAst`, then a walk with a scope stack), giving for every top-level declaration what it reads while the module is imported, what it reads later, and what it assigns. The other tools import it. |
| `parse.js` | The parser's command line: `node tools/split/parse.js [file] [--deps] [--json out.json]`. Every top-level declaration by line, under the file's own banners; `--json` is what a manifest's tables are generated from. |
| `where.js` | `node tools/split/where.js name ...` - the line ranges those names occupy in the root file now, comments attached, with the lines at each edge, so a cut is looked at before it is made. |
| `move.js` | The mover: `node tools/split/move.js spec.js [--write]`. Cuts blocks out of the root file by line range and pastes them into a new module; refuses unless the new file's names and imports are exactly the manifest's. The spec format is in its header. |
| `imports.js` | `node tools/split/imports.js [--write]` - rewrites the root file's import lines from what it references now. Run after a move's hand edits. |
| `partition.js` | The partition check: `node tools/split/partition.js <commit> [--lines]`. Every top-level statement of `src/app.js` at that commit must exist, byte for byte, in exactly one module now; what differs is printed. |
| `repo.js` | Paths, and the module order - which is read from `tests/rules/imports.test.js`, so there is one list. |

The root file is `src/app.js`; pass `--root boot.js` once it is renamed.

One move, in order: `where.js` for the ranges; write the spec; `move.js spec.js`
(dry run), then `--write`; the hand edits the mover lists (an assignment that
must become a call); `imports.js --write`; `npm run lint && npm test`; commit.
At the end of a slice, `partition.js <base commit>`.
