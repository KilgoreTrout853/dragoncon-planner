# Architecture

What the system **is** as of the `next` branch, September 2026. Not what is
planned — that lives in DECISIONS.md, VISION.md and the roadmap. Update this
file in the same PR as any change that alters the shape described here.

## In one paragraph

A Python scraper turns the official Dragon Con app's web view into one JSON
file. A web app, built by Vite into a single HTML file, reads that JSON,
lets you search, star, and plan, and stores your picks in the browser. A
service worker keeps the app usable with no signal. GitHub Pages serves
it; there is no backend.

```
app.core-apps.com/dragoncon26          (official schedule, HTML)
        │  scraper.py  (fetch, parse, dedupe, carry tags over)
        ▼
data/2026/events.json  ◄── tag_events.py (Claude adds tags to untagged events)
        │  fetched by the page; cached by sw.js
        ▼
index.html + src/  ──vite build──►  dist/index.html  (the whole client, inlined)
        │                                   └──►  localStorage (picks, settings)
   GitHub Pages  (main → live site: the 2026 one-file app, served as-is;
                  next → dev site: the built dist/)
```

## Repo map

| Path | What it is |
|---|---|
| `index.html` | The Vite entry template: the page's head and body markup, a link to `src/styles.css` and the module entry. Not runnable as a static file. |
| `src/main.js` | The entry: imports `styles.css`, then calls `boot()` from `app.js`. |
| `src/app.js` | What is left of the one-file script, about 1,960 lines: every view, the shell, dispatch and `boot()`. Importing it declares them and looks up the elements the shell holds; `boot()` starts the app. It imports all fourteen leaf modules and no npm package. |
| `src/util.js`, `storage.js`, `platform.js`, `build.js`, `state.js`, `time.js`, `venues.js`, `data.js`, `picks.js`, `follows.js`, `ics.js`, `leave.js`, `search.js`, `ui.js` | The leaves: fourteen modules that need nothing from `app.js`. In that order, each imports only npm packages (`search.js` imports MiniSearch, pinned to 7.2.0) and the leaves before it, so there is no cycle; `tests/rules/imports.test.js` holds them to it. Five read storage, the document or `navigator` as they are imported: `platform`, `build`, `state`, `picks`, `follows`. `docs/SPLIT-MANIFEST.md` records what moved where, and why. |
| `src/styles.css` | All the CSS. |
| `public/` | Served and copied verbatim: `sw.js` (service worker: offline caching, schedule revalidation), `manifest.json`, `icon.svg`, `icon-*.png`, `og-image.png` (PWA install and link-preview assets), `.nojekyll`. |
| `vite.config.js`, `build/vite-dc.js` | The build: single-file output, and this project's own plugin (`dcBuild`) for the HTML fix-ups, the channel stamp and the `data/` copy. |
| `dist/` | Build output, not in git: `index.html` with the CSS and script inlined, the files from `public/`, and a copy of `data/`. |
| `data/2026/events.json` | The frozen 2026 schedule, ~3,460 events, ~3 MB. |
| `scraper.py` | Scrape → normalise → dedupe → write `events.json`. |
| `tag_events.py` | Add `tags` to untagged events via Claude. |
| `make_icons.py` | Renders the PNG icons and the preview image into `public/`. One-off; needs Pillow. |
| `tests/helpers/` | `page.js` boots the app in Vitest's jsdom for a page test; `act.js` is the few gestures the page tests share (type, tap, touch, watch for mutations). |
| `tests/page/` | Vitest, one file per part of the app: the source, booted in jsdom, driven through the DOM and `boot()`'s handle. |
| `tests/unit/` | Vitest: the pure exports of `src/app.js`, imported with no page. |
| `tests/rules/` | Vitest: rules over the text of `src/styles.css` and `src/app.js`. |
| `tests/real-data.test.js` | Vitest: search quality and Explore against the real `data/2026/events.json`. |
| `tests/build.test.js` | Vitest: what `vite build` leaves in the output folder, stamped and unstamped, and a smoke that boots the built page. The only test that executes `dist/`. |
| `tests/PORT-LEDGER.md` | Where each of the old smoke harness's 817 assertions went, and how. |
| `tests/test_parse.py` | Scraper parsing and dedupe unit tests. |
| `tests/sample-events.json` | 558 synthetic events: the fixture for the page tests and the build smoke. |
| `.github/workflows/scrape.yml` | Manual-trigger scrape (workflow_dispatch). Refuses a scrape with 0 events or a >20% drop; commits and pushes events.json to the branch it was run from. |
| `.github/workflows/ci.yml` | CI on every PR into `next` or `main` and every push to `next`: jobs `client` and `pipeline`. |
| `.github/dependabot.yml` | Monthly update PRs for GitHub Actions only. |
| `package.json`, `.nvmrc`, `eslint.config.js`, `vitest.config.js` | Client tooling: scripts `dev`, `build`, `preview`, `lint`, `test`; Node major; two ESLint rules; Vitest, with jsdom as its default environment. |
| `requirements.txt` | Pinned pipeline dependencies, plus pytest. |
| `.gitattributes` | Text files are LF in the index and on checkout. |
| `CLAUDE.md` | Standing rules for Claude Code sessions. |
| `docs/` | This file, DECISIONS.md and VISION.md. |

## The data pipeline

`scraper.py` fetches 12 day-list pages (6 days × panels and gaming), then
every event detail page in parallel with polite retries (403 is treated as
rate-limiting). Each event becomes:

```
id, type (panel|gaming), title, day, start, end, duration_min,
location, hotel, room, description, tracks[], track, speakers[], cancelled
```

Then, in this order:

1. **Tags carried over** from the previous `events.json`, matched by `id`.
2. **Dedupe.** Same normalised title + start + room collapses to one row. The
   smallest `id` survives; speakers and tracks are unioned; the longest
   description and any tags win; `cancelled` is sticky. Deterministic
   regardless of input order.
3. **Write** `{generated_at, changed_at, source, count, failures, events}`.
   `changed_at` only moves when the event list actually differs, and the
   service worker only announces an update when `generated_at` moves.

The `id` is the official site's hex id from the event URL. It is **not**
first-seen stable (DECISIONS #7).

`tag_events.py` batches untagged events to Claude Haiku (API key, or
`claude -p` on a subscription) and writes `tags: {fandoms[≤3], kind,
topics[≤3], adult, guests}` back. A `CANON` map folds fandom name variants
together. `--all` retags everything.

## The client

One script. Everything below is in `src/app.js`, which is still a single
file: importing it declares the app, and `boot()` starts it (see Boot
order). The markup it drives is in `index.html` and the CSS in
`src/styles.css`.

**Tabs:** `now`, `browse`, `explore`, `map`, `mine` are the `data-tab` ids
the code and `state.tab` use. The labels the user sees are Now, Search,
Explore, Map and Mine, in that order; only `browse` differs from its label.
Mine also carries the pick-count badge, hidden at zero. Rendering is a
single `render()` that redraws the active view from `state`.

**Time.** One `now()` function. A `?now=<ISO>` query parameter sets a
simulated clock, mirrored to `sessionStorage` (`dc26.timeOverride`, or
`dc26.timeOverride.<channel>` on a stamped build) so it survives navigation
but not a new tab. `isSimulated()` shows a chip. `conPhase()` returns
`preview | live | ended` from `now()` and drives the pre-con banner, the
live Now tab, and archive mode. `tests/rules/source.test.js` fails on any
`new Date()` or `Date.now()` outside the Time section.

**Picks.** A `Set` of event ids, persisted as `dc26.picks`. On load,
`reconcilePicks()` compares each pick against a stored snapshot: a pick
whose event vanished is dropped and reported; one whose time or room moved
is reported and re-snapshotted. The report (`dc26.pickNews`) shows on Now
and Mine until dismissed.

**Now tab.** Hero card for the current pick with a leave-by line when the
next pick is in another hotel (walk estimate + 10 min), a sticky next-up
mini-bar, then "On now" and upcoming groups. A minute tick re-renders only
what changed.

**Mine.** Timeline view by default (con day ends 5 AM), list view as an
option. Export to `.ics`, remove all.

**Map.** Schematic SVG of the host hotels, Peachtree and Courtland streets,
and the three skybridges. Per-hotel pick-count pills for the selected day; a
"next pick" card under the map. Redraws only when counts change.

**Search.** The first render happens with no index; the search index is
built in idle time afterwards, then a suggestion index (guest names,
fandoms). Query intent parsing turns day/hotel/kind/time words into filters.

**Other stored keys:** `dc26.bigtext` (larger-text toggle; all sizes outside
the map SVG are in `rem`), `dc26.archiveNoticeDismissed` (per year).

**Boot order.** `src/app.js` exports `boot({events, reload})`. Importing the
module runs nothing but its declarations and the consts that read
`localStorage` and the DOM (`settings`, `picks`, `state`, `scroller`, the
sheet elements, `updatePill`, `BUILD`, `IS_IOS`), which is why `src/main.js`
imports it after the markup exists. `main.js` then calls `boot()`, once,
with no options: the page fetches its own schedule. `boot()` applies the saved text
size, inserts the dev-build mark, reads the time override, registers every
listener, timer and observer in the order the one-file script did - listeners
on one element fire in the order they were added - and calls `load()`. The
two options are for tests: given `events`, `load()` uses it instead of
fetching and reaches the first render with no `await` on the way; `reload`
replaces what `reloadNow()` calls, because jsdom will not let
`location.reload` be replaced. From there: parse JSON → first
render → index build (idle) → suggestion index (idle). The timings are
recorded in `BOOT`; `BUILD` is the channel and build-id stamp, which the
device readout shows.

`boot()` returns a handle, synchronously - state and operations, never
internals: `state`, `render`, `now`, `setTimeOverride`, `picks` and `follows`
(each `get`/`set`), `news` (`set`/`clear`), live `meta` and `events` getters,
`BOOT`, `reconcilePicks`, `recheckSchedule`, `openSheet`, `closeSheet`, and
`ready`, which is `load()`'s promise. One `export` list at the end of the
file names the functions and consts the tests import by name (97 today, the
set the old smoke harness reached through `window.eval`): the inventory of
test coupling, pruned as functions move to modules of their own.

## Offline

`public/sw.js`, three strategies:

| Request | Strategy | Why |
|---|---|---|
| `index.html` | Network-first, 3 s timeout, fall back to cache; late responses still cached | A fix should land when there's signal; a slow tower must not block launch |
| `events.json` | Cache-first; revalidate in the background; notify the page only if `generated_at` changed | 3 MB on con wifi is the thing that makes the app feel broken |
| Fonts | Cache-first forever (opaque responses allowed) | Never change; a missing font is a visibly broken page |

Cache name is `dc26-v4` (or `dc26-<channel>-v4` on a stamped build). Bump
the version when the built page or `sw.js` changes; older caches under the
same prefix are deleted on activate. Install precaches the shell
individually so one failed fetch doesn't fail the install.

## Build and deploy

There is no build step for the live site: `main` is the 2026 one-file app,
served as-is by GitHub Pages at `kilgoretrout853.github.io/dragoncon-planner/`.

On `next` the client is built (DECISIONS #23). `npm run build` runs Vite
8, which bundles with Rolldown, and writes `dist/`:

- `index.html`, with `src/styles.css` and the bundled script inlined by
  `vite-plugin-singlefile`, so there are no hashed assets and the worker's
  `SHELL` list is what it was. `base` is `./`: every URL is relative,
  because the same build is deployed at two subpaths. `build.target` is
  `safari16.4`. The script and the CSS are minified, by Vite's defaults,
  and there is no source map.
- everything in `public/`, verbatim, and a copy of `data/`.

`build/vite-dc.js` (`dcBuild`) runs last, in `closeBundle`. Vite emits the
entry as `<script type="module" crossorigin>` in `<head>`; `dcBuild` moves
it to the end of `<body>` as a bare, classic `<script>`, because the app
reads the DOM as it is imported, and because the build smoke runs the page
in a JSDOM, which does not run module scripts. It
makes the inlined style a bare `<style>` holding `src/styles.css`,
minified. When `DC_CHANNEL` is set it stamps the channel into
`<meta name="dc-channel">` and the worker's `CHANNEL`, and `DC_BUILD`
(default: short commit sha) into `<meta name="dc-build">`; a bad channel
string fails the build before it starts. With no channel both stamps stay
empty and `dist/sw.js` is byte-identical to `public/sw.js`. Then it copies
`data/` into `dist/data/`.

`npm run dev` serves the unbuilt modules for development. It runs the app
as a real ES module - deferred, strict, no globals - which is not what
ships. The page tests run the source the same way; what ties them to what
ships is the dist smoke in `tests/build.test.js`: the built page boots.

The stamped output reaches the `dragoncon-planner-next` deploy repo through
that repo's own workflow (`.github/workflows/deploy.yml`), not through
anything here. Every ten minutes, and on `workflow_dispatch`, the workflow
compares the head of `next` (`git ls-remote`) with the sha in its
`deployed.txt`. When they differ, or the run was manual, it checks `next`
out, builds it with `DC_CHANNEL=next` (no `DC_BUILD`, so the build id is
the checkout's short sha), publishes the output folder to its `gh-pages`
branch as an orphan commit (`peaceiris/actions-gh-pages`),
and commits the deployed sha to `deployed.txt` on its `main`. That commit is
also what keeps GitHub from disabling the schedule for inactivity. The source
repo is public, so no secret is involved. To deploy now rather than within
ten minutes: `gh workflow run deploy.yml -R KilgoreTrout853/dragoncon-planner-next`.
The build command in that workflow is Node setup plus
`npm ci && npm run build`; it used to be `python build.py --out ../site`,
and `build.py` no longer exists.

The live and dev sites share an origin; the channel stamp is what keeps
their caches and session keys apart (DECISIONS #15).

## Tests

```
npm ci                        # once; Node major from .nvmrc
npm run lint                  # eslint .
npm test                      # vitest run: everything under tests/ that ends .test.js
pip install -r requirements.txt
python -m pytest tests/       # test_parse.py
```

The client is tested by Vitest (DECISIONS #24), in five kinds of file.

**Page tests** (`tests/page/`, one file per part of the app, and
`tests/real-data.test.js`) run the source, in the test's own realm. There
is no built page and no `window.eval`: `tests/helpers/page.js` puts
`index.html`'s markup and `src/styles.css` into Vitest's jsdom, sets the two
meta stamps and the URL (`?now=2026-09-05T13:05` unless the test says
otherwise), stubs `matchMedia` and a `navigator.serviceWorker` that is an
`EventTarget` with `register()`, then imports every module under `src/`
but the entry, fresh (`vi.resetModules()`, `import.meta.glob`; importing
`main.js` would boot the page), merges their exports into one `app` - a
getter per export, so an exported `let` stays live, and a throw if two
modules export one name - and calls `boot({events, reload})` with a fixture:
`tests/sample-events.json`, or the real schedule for `real-data`. A test
drives the page through the DOM, through the handle `boot()` returned, and
through `app`, wherever a name lives. The window outlives the modules, so
the helper records every listener and interval `boot()` registers and
`cleanup()` removes them; it also fails the file if the window saw an
uncaught error.
One boot per file, tests in file order; a test that needs a different start
(seeded storage, a stamp, an iPhone, no `?now=`) cleans up and boots again.
Internals are never assigned: a situation is produced the way it arises on a
phone - a `message` from the worker stub, storage seeded before the boot, the
simulated clock moved, fake timers around the app's own interval, a
MutationObserver where the claim is that nothing was redrawn.

**Unit tests** (`tests/unit/`) import pure exports by name, from the module
that holds them, with no page. They still run in jsdom, because a module
they reach may read the document as it is imported: `time.js` imports
`build.js`, which looks for the stamps.

**Rules** (`tests/rules/`) are regexes over the text of `src/styles.css` and
`src/app.js`: declarations a page in jsdom cannot show, since jsdom computes
no layout. Each source rule names what is to replace it (ESLint in PR 5, or
Playwright).

**`tests/build.test.js`** runs the real `vite build` into temp folders: a
stamped build, an unstamped one, the default build id, a refused channel,
the shape of the output (one classic `<script>` at the end of the body,
one `<style>`, no separate assets, relative links in the head), and checks
of `sw.js`, the manifest, the icons and the head. It ends with the one test
that executes `dist/`: the built page in a JSDOM of its own, `fetch` stubbed
to serve the sample fixture, asserting that the first screen renders, a
search returns rows and no uncaught error fired.

jsdom is Vitest's default environment; the files that only read text or run
the build opt out with a `// @vitest-environment node` docblock.

`tests/PORT-LEDGER.md` is the record of how this suite was made: one row for
each of the 817 assertions in the smoke harness it replaced
(`tests/ui_smoke.cjs`, removed 2026-09-18), saying where it went and how.
Every test title ends with the harness line it came from, in brackets.

ESLint carries two rules and inherits nothing: `no-undef` everywhere, and
under `src/` a ban on `new Date()` and `Date.now()` outside `src/time.js`.
`no-undef` is what catches a name that moved to another module without its
import. The clock rule runs on every file under `src/` but `time.js`, where
`now()` lives, and is the #12 guard; the Time-section rule in
`tests/rules/source.test.js` that stood in for it is gone.

The Python test files are plain pytest modules; running one directly with
`python tests/test_parse.py` executes nothing.

CI (`.github/workflows/ci.yml`) runs all of the above on a clean Ubuntu
runner for every pull request into `next` or `main`, every push to `next`,
and on demand: job `client` (npm ci, lint, test) and job `pipeline`
(pip install, pytest). Nothing requires those checks yet - the ruleset on
`next` is a repository setting (DECISIONS #26).

## Branches

- `main` — frozen 2026 app, tagged `v2026-final`, PR-only by ruleset.
- `next` — development, and the repo's default branch for the off-season.
- Feature branches target `next`.

## Sharp edges to know

- The scrape workflow pushes to the branch chosen in the Run workflow
  dropdown (default: the default branch, currently `next`), and its
  rebase-on-retry hard-codes `main`. Since `main` is PR-only, a run
  against `main` now fails at push. The 2027 pipeline needs a path onto
  `main` before the cron returns.
- Event ids belong to the source site (see pipeline).
- The client script is half split. Fourteen leaf modules are out; every
  view, the shell and `boot()` are still one file, `src/app.js`, with a
  45-name export list that exists for the tests. A leaf must never import
  `app.js` or a later leaf. An importer can read a leaf's `let` and mutate
  what it holds but cannot assign it, which is why `replacePicks()`,
  `replaceSchedule()`, `setOverride()` and their like exist (DECISIONS #24).
- The root `index.html` is a template now. Serving the repo root with a
  static server no longer runs the app; use `npm run dev`, or build and
  serve `dist/` (`npm run preview`).
- The deploy repo's build command has to be changed by hand, in that
  repo. Until it is, its workflow fails at `python build.py` and the dev
  site stays on the last deploy that had it.
- `sw.js` cache version is bumped by hand.
- No backend, no accounts, no sync: picks live on one device.
