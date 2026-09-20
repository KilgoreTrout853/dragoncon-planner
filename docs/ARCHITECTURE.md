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
| `src/main.js` | The entry: imports `styles.css`, then calls `boot()` from `boot.js`. |
| `src/boot.js` | The root of the client: `boot()`, which wires the app and starts it, and nothing else. See Boot. |
| `src/dispatch.js`, `shell.js`, `loading.js`, `sheet.js` | The four modules above the views: the handlers that span modules; `render()` and what is on screen whatever the tab; loading, freshness and offline; the bottom sheet. |
| `src/now.js`, `browse.js`, `explore.js`, `map.js`, `mine.js` | The five views, one per tab (`browse` is the Search tab). |
| `src/scroll.js`, `bus.js` | The scroller and the header's measurement; how a module below the shell asks for a redraw. |
| `src/util.js`, `storage.js`, `platform.js`, `build.js`, `state.js`, `time.js`, `venues.js`, `data.js`, `picks.js`, `follows.js`, `ics.js`, `leave.js`, `search.js`, `ui.js` | The fourteen leaves: what everything else stands on. "The client: modules and their order" has a paragraph on each layer. |
| `src/styles.css` | All the CSS. |
| `public/` | Served and copied verbatim: `sw.js` (service worker: offline caching, schedule revalidation), `manifest.json`, `icon.svg`, `icon-*.png`, `og-image.png` (PWA install and link-preview assets), `.nojekyll`. |
| `vite.config.js`, `build/vite-dc.js` | The build: single-file output, and this project's own plugin (`dcBuild`) for the HTML fix-ups, the channel stamp and the `data/` copy. |
| `dist/` | Build output, not in git: `index.html` with the CSS and script inlined, the files from `public/`, and a copy of `data/`. |
| `data/2026/events.json` | The frozen 2026 schedule: 3,459 events, 2.7 MB. |
| `scraper.py` | Scrape → normalise → dedupe → write `events.json`. |
| `tag_events.py` | Add `tags` to untagged events via Claude. |
| `tag_census.py`, `docs/discover/` | A read-only census of the tags in `events.json` - coverage, fandoms, topics, people, title facets, recurrence - written to `docs/discover/census-2026.md`: evidence for the Discover design work, facts only. Standard library; it imports the taxonomy from `tag_events.py`, writes nothing under `data/`, and two runs give the same bytes. Not part of the pipeline: nothing runs it but a person. |
| `make_icons.py` | Renders the PNG icons and the preview image into `public/`. One-off; needs Pillow. |
| `tests/helpers/` | `page.js` boots the app in Vitest's jsdom for a page test; `act.js` is the few gestures the page tests share (type, tap, touch, watch for mutations). |
| `tests/page/` | Vitest, one file per part of the app: the source, booted in jsdom, driven through the DOM and `boot()`'s handle. |
| `tests/unit/` | Vitest: pure exports, imported by name from the module that holds them, with no page. |
| `tests/rules/` | Vitest: rules over the text of `src/styles.css` and of every module under `src/`, and over the module graph (`imports.test.js`). |
| `tests/real-data.test.js` | Vitest: search quality and Explore against the real `data/2026/events.json`. |
| `tests/build.test.js` | Vitest: what `vite build` leaves in the output folder, stamped and unstamped, and a smoke that boots the built page. The only test that executes `dist/`. |
| `tests/PORT-LEDGER.md` | Where each assertion of the old smoke harness went, and how. A record. |
| `tests/test_parse.py` | Scraper parsing and dedupe unit tests. |
| `tests/test_tag_census.py` | The census's pure functions and its repeatability, on an inline fixture; it never reads `data/`. |
| `tests/sample-events.json`, `tests/make_sample.py` | 558 synthetic events, the fixture for the page tests and the build smoke; and the seeded script that generates it (it imports `scraper`). |
| `.github/workflows/scrape.yml` | Manual-trigger scrape (workflow_dispatch). Refuses a scrape with 0 events or a >20% drop; commits and pushes events.json to the branch it was run from. |
| `.github/workflows/ci.yml` | CI on every PR into `next` or `main` and every push to `next`: jobs `client` and `pipeline`. |
| `.github/dependabot.yml` | Monthly update PRs for GitHub Actions only. |
| `package.json`, `.nvmrc`, `eslint.config.js`, `vitest.config.js` | Client tooling: scripts `dev`, `build`, `preview`, `lint`, `test`; Node 24; three ESLint rules; Vitest, with jsdom as its default environment. |
| `requirements.txt` | Pinned pipeline dependencies, plus pytest. Python 3.13. |
| `.gitattributes` | Text files are LF in the index and on checkout. |
| `CLAUDE.md` | Standing rules for Claude Code sessions. |
| `docs/` | This file, DECISIONS.md and VISION.md; ROADMAP.md, the order of the 2027 work by tentpole (DECISIONS #30); SPLIT-MANIFEST.md, the record of how the one-file script became the modules; and `discover/`: the census, above, and `schema-v2.md`, the design note for the registries and tags v2 (#31-#33), none of it built. |

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

## The client: modules and their order

One program in twenty-six modules under `src/`, and `main.js`, the entry.
The markup it drives is in `index.html` and the CSS in `src/styles.css`.

The modules stand in one order, which is the array `ORDER` in
`tests/rules/imports.test.js`, with `boot.js` as the root above it:

```
util  storage  platform  build  state  time  venues  data  picks  follows
ics  leave  search  ui                                 the fourteen leaves
scroll  bus
now  browse  explore  map  mine                        the five views
sheet  loading  shell  dispatch
                                                       boot.js, the root
```

A module imports only npm packages and the modules before it, reading left
to right and down; `boot.js` imports any of them, and only `main.js` imports
`boot.js`. So there is no cycle, and nothing below can import what is above
it.

**The leaves** need nothing from the modules after them. `util`: formatting
and date helpers. `storage`: `loadJSON()`, `saveJSON()` and their session
twins. `platform`: `IS_IOS`, `isStandalone()`. `build`: the stamp `BUILD`,
the dev-build mark, the device readout. `state`: `settings` and `state`.
`time`: `now()`, the override, `CON`, `conPhase()`, `conDayKey()`,
`effectiveNow()`. `venues`: hotel identity, the `WALK` table, the seating
buffer, `walkMin()`, `placeHTML()`. `data`: `DATA_URL`, the schedule as the
app holds it (`events`, `byId`, `meta`) and `replaceSchedule()`. `picks` and
`follows`: what the reader starred and follows. `ics`: the calendar export.
`leave`: leave-by. `search`: the two MiniSearch indexes (MiniSearch is an npm
dependency, pinned to 7.2.0), the reading of a query, the ranking. `ui`:
markup every view shares, `rowHTML()` and `chipHTML()`. Five read storage,
the document or `navigator` as they are imported: `platform`, `build`,
`state`, `picks`, `follows`.

**`scroll`** holds the scroller (`main`, not the page), the sideways chip
rows a redraw has to put back, `cssEsc`, and the header's measurement:
`syncHeaderHeight()`, which sets `--hdr-h`, what the sticky filters park
under, and `fitHeaderLine()`. `loading`, the `shell` and `boot()` all need
the measurement, so it sits below all three. It imports nothing, and looks
up `main` as it is imported. **`bus`** is how a module below the shell - a
view, the sheet, loading - asks for the whole page to be redrawn without
importing the shell: `requestRender()` calls the function `boot()`
registered with `setRenderer(render)`, synchronously, and throws if none is
registered. Only `render()` goes over it.

**The five views** each draw their own tab and nothing else; `render()` in
`shell.js` calls them, and none of them imports it. `now` also carries the
install nudge and the two listeners for the install prompt; `explore` the
scroll spy's listener. `map` imports `nowModel` from `now`, the one edge
between two views.

**`sheet`** is the bottom sheet: its three panels (Settings, an event, a
hotel) and what fills them, `openSheet()` and `closeSheet()`, the swipe that
dismisses it, and the handlers for the drag and the Settings controls.
`closeSheet()` asks for its redraw over the bus. It looks up the six sheet
elements as it is imported.

**`loading`** is loading, freshness and offline: `load()` and the idle index
build, `BOOT`, the header's freshness line (`updateFresh()`), the update
pill, `recheckSchedule()`, and the handlers for the pill, the worker's
messages and coming back to the app. It is below the shell, so it asks for
the first draw over the bus. It looks up `#updatePill` as it is imported.

**`shell`** is what is on screen whatever the tab: `render()`, which redraws
the page from `state` and is what the bus calls; the header's clock, the
notice and the mini-bar; `setTimeOverride()`; `togglePick()`; the iOS edge
guard; and the handlers for the tab bar, the mini-bar, the simulated-time
chip, larger text, and the redraw on coming back to the tab. It imports the
five views and `loading`; nothing below it imports it.

**`dispatch`** is the ten handlers whose bodies reach across modules: the
four delegated listeners on `main` (click, input, keydown, change), the
clicks inside the sheet's event and hotel panels, Apply and Clear for the
preview clock, the hash, and the minute tick. It declares nothing else. It
is last in the order, and only the root imports it.

**`boot.js`** is its imports and `boot()`. It holds no handler but one empty
`catch`, owns no `let`, reads nothing as it is imported, and exports `boot`
and nothing else.

The rules, in short (DECISIONS #29 has them with their reasons): a handler
lives in the module that owns the state it writes, or in `dispatch` when it
spans modules; a module that has to change another module's `let` calls a
function the owner exports for it, which is why `replacePicks()`,
`replaceSchedule()`, `setOverride()`, `takeInstallPrompt()`, `setReload()`
and their like exist; a module exports what another module imports from it
and what a test reaches by name, and nothing more; and a new module goes
into `ORDER` at the lowest place that satisfies its imports.

## Boot

`src/boot.js` exports `boot({events, reload})`. Importing it imports every
other module first, and runs nothing but declarations and the consts that
read `localStorage`, the DOM and `navigator`: in the leaves `IS_IOS`
(`platform`), `BUILD` (`build`), `settings` and `state` (`state`), `picks`
with its snapshots and news (`picks`) and `follows` (`follows`); in
`scroll.js`, `scroller`; in `sheet.js` the six sheet elements; in
`loading.js`, `updatePill`. `boot.js` itself reads nothing. That is why
`src/main.js` imports it after the markup exists. `main.js` then calls
`boot()`, once, with no options: the page fetches its own schedule.

`boot()` first registers `render()` on the bus, so that a module below the
shell can ask for a redraw; then it applies the saved text size, inserts the
dev-build mark, reads the time override, and registers every listener, timer
and observer in a fixed order, which is `boot()`'s own, top to bottom:
listeners on one element fire in the order they were added. It writes none
of them. Each handler is a named function, imported from the module that
owns the state it writes (`sheet`, `loading`, `shell`, `explore`, `now`), or
from `scroll` or `dispatch`. What `boot()` still holds inline is the four
conditions that decide whether a registration is made at all -
`document.fonts.ready`, `ResizeObserver`, `IS_IOS`, `serviceWorker` - and the
empty `catch`. Then it calls `load()`.

The two options are for tests: given `events`, `load()` uses it instead of
fetching and reaches the first render - over the bus, since `load()` is
below the shell - with no `await` on the way; `reload` replaces what
`reloadNow()` calls, because jsdom will not let `location.reload` be
replaced. From there: parse JSON → first render → index build (idle) →
suggestion index (idle). The timings are recorded in `BOOT`; `BUILD` is the
channel and build-id stamp, which the device readout shows.

`boot()` returns a handle, synchronously - state and operations, never
internals: `state`, `render`, `now`, `setTimeOverride`, `picks` and `follows`
(each `get`/`set`), `news` (`set`/`clear`), live `meta` and `events` getters,
`BOOT`, `reconcilePicks`, `recheckSchedule`, `openSheet`, `closeSheet`, and
`ready`, which is `load()`'s promise.

## What the client does

**Tabs:** `now`, `browse`, `explore`, `map`, `mine` are the `data-tab` ids
the code and `state.tab` use. The labels the user sees are Now, Search,
Explore, Map and Mine, in that order; only `browse` differs from its label.
Mine also carries the pick-count badge, hidden at zero. Rendering is a
single `render()` that redraws the active view from `state`.

**Time.** One `now()` function. A `?now=<ISO>` query parameter sets a
simulated clock, mirrored to `sessionStorage` (`dc26.timeOverride`, or
`dc26.timeOverride.<channel>` on a stamped build) so it survives navigation
but not a new tab. `isSimulated()` shows a chip. `conPhase()` returns
`before | live | ended` from `now()` and drives the pre-con banner, the
live Now tab, and archive mode. All of it is in `src/time.js`, the one file
ESLint lets read the clock: a bare `new Date()` or `Date.now()` anywhere
else under `src/` fails `npm run lint`.

**Picks.** A `Set` of event ids, persisted as `dc26.picks`. On load,
`reconcilePicks()` compares each pick against a stored snapshot: a pick
whose event vanished is dropped and reported; one whose time or room moved
is reported and re-snapshotted. The report (`dc26.pickNews`) shows on Now
and Mine until dismissed.

**Now tab.** Hero card for the current pick with a leave-by line when the
next pick is in another hotel (walk estimate + 10 min), then the rest of the
day's picks, then "On now" and upcoming groups. A minute tick re-renders
only what changed. Until the app is installed the tab opens with the install
nudge; after the con it is the record of the reader's picks.

**Mini-bar.** The shell's: the next pick and its leave-by, above the nav on
Search, Explore and Mine. Not on Now or Map, which say the same thing
themselves, and not once the con is over.

**Mine.** Timeline view by default (con day ends 5 AM), list view as an
option. Export to `.ics`, remove all.

**Map.** Schematic SVG of the host hotels, Peachtree and Courtland streets,
and the three skybridges. Per-hotel pick-count pills for the selected day; a
"next pick" card under the map. On the minute tick the map is redrawn when
its signature has changed - the day, the pick that is on, the next pick, the
counts - and otherwise only the card under it, when that has.

**Search.** The first render happens with no index; the search index is
built in idle time afterwards, then a suggestion index (guest names,
fandoms). Query intent parsing turns day/hotel/kind/time words into filters.

**Explore.** Everything that can be followed - tracks, fandoms, topics,
guests, panelists - as tiles with counts; a page for each, linkable as
`#explore=kind:key`; above the grid, a Following feed and suggestions drawn
from the reader's picks. The jump chips follow the scroll through a spy that
runs once per animation frame.

**The sheet.** One bottom sheet, three panels: Settings, an event's detail, a
hotel's picks for the day. Swipe down to dismiss.

**Stored keys.** Everything is `localStorage` but the last row.

| Key | Read in | Written in | What |
|---|---|---|---|
| `dc26.picks`, `dc26.pickInfo`, `dc26.pickNews` | `picks` | `picks` | Starred event ids; what each looked like when starred; the report of what changed |
| `dc26.follows` | `follows` | `follows` | What the reader follows |
| `dc26.settings` | `state` | `sheet` | Crowd factor, the default noise filter |
| `dc26.mineView`, `dc26.followingLayout`, `dc26.followingOpen` | `state` | `dispatch` | Timeline or list; the Following feed's layout, and whether it is folded |
| `dc26.bigtext` | `boot` | `shell` | Larger text. Its own key, so nothing that resets settings shrinks it; all sizes outside the map SVG are in `rem` |
| `dc26.archiveNoticeDismissed` | `shell` | `dispatch` | The year whose "has ended" notice was dismissed |
| `dc26.nudgeSnoozedUntil` | `now` | `dispatch` | When the install nudge may show again |
| `dc26.timeOverride[.<channel>]` (`sessionStorage`) | `time` | `time` | The simulated clock |

## Offline

`public/sw.js`, three strategies:

| Request | Strategy | Why |
|---|---|---|
| `index.html` | Network-first, 3 s timeout, fall back to cache; late responses still cached | A fix should land when there's signal; a slow tower must not block launch |
| `events.json` | Cache-first; revalidate in the background; notify the page only if `generated_at` changed | 2.7 MB on con wifi is the thing that makes the app feel broken |
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
out, builds it (Node setup, then `npm ci && npm run build`) with
`DC_CHANNEL=next` (no `DC_BUILD`, so the build id is the checkout's short
sha), publishes the output folder to its `gh-pages` branch as an orphan
commit (`peaceiris/actions-gh-pages`), and commits the deployed sha to
`deployed.txt` on its `main`. That commit is also what keeps GitHub from
disabling the schedule for inactivity. The source repo is public, so no
secret is involved. To deploy now rather than within ten minutes:
`gh workflow run deploy.yml -R KilgoreTrout853/dragoncon-planner-next`.

The live and dev sites share an origin; the channel stamp is what keeps
their caches and session keys apart (DECISIONS #15).

## Tests and lint

```
npm ci                        # once; Node major from .nvmrc
npm run lint                  # eslint .
npm test                      # vitest run: everything under tests/ that ends .test.js
pip install -r requirements.txt
python -m pytest tests/       # test_parse.py, test_tag_census.py
```

The client is tested by Vitest (DECISIONS #24), in four kinds of file.

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
simulated clock moved, fake timers around the app's own interval, an
animation frame queued by hand where the code waits for one (the scroll spy),
a MutationObserver where the claim is that nothing was redrawn.

**Unit tests** (`tests/unit/`) import pure exports by name, from the module
that holds them, with no page. They still run in jsdom, because a module
they reach may read the document as it is imported: `time.js` imports
`build.js`, which looks for the stamps.

**Rules** (`tests/rules/`) are regexes over the text of `src/styles.css` and
of every module under `src/`, read one after another: declarations a page
in jsdom cannot show, since jsdom computes no layout. Two source rules
remain: [1240], the signature of `togglePick()`, which goes when Playwright
arrives, and [1728], no inline pixel font size, which stays a rule; ESLint
took the others. `imports.test.js` reads the module graph instead: only
`main.js` imports `boot.js`, a module imports only npm packages and the
modules before it in the order, every file under `src/` has a place in it,
and only the root imports `dispatch.js`.

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
each assertion in the smoke harness it replaced (`tests/ui_smoke.cjs`,
removed 2026-09-18), saying where it went and how. A ported test's title
ends with the harness line it came from, in brackets; a test written since
carries none. The skipped tests are ledger rows that cannot run: three the
sample fixture never reaches ([366], [470], [499]) and a `catch` arm that
runs only when another test has already failed ([1283]). Each is an
`it.skip` whose title is the reason.

ESLint carries three rules and inherits nothing: `no-undef` and
`no-unused-vars` everywhere, and `no-restricted-syntax` under `src/`.
`no-undef` is what catches a name used in a module that does not import it;
`no-unused-vars` (arguments and caught errors exempt) catches the import
left behind when what it was for moved on. The third holds what were once
regexes over the source text, as selectors. Two are the #12 guard: a bare
`new Date()` and `Date.now()`, on every file under `src/` but `time.js`,
where `now()` lives. Four are about the page, on every file under `src/`:
nothing scrolls the window or reads how far it has scrolled (`window.scrollTo`
and `scrollBy` called, `window.scrollY`, `pageYOffset`), because `main` is
the scroller; and nothing reads `location.host`, `hostname` or `origin`,
because the stamp decides the channel, never the address (#15). A later
config object replaces an earlier one's options for a rule, so the config
gives the page's selectors for all of `src/` and gives them again, with the
clock's, for every file but `time.js`.

The Python test files are plain pytest modules; running one directly with
`python tests/test_parse.py` executes nothing.

## CI

`.github/workflows/ci.yml` runs all of the above on a clean Ubuntu runner
for every pull request into `next` or `main`, every push to `next`, and on
demand: job `client` (Node from `.nvmrc`, `npm ci`, lint, test) and job
`pipeline` (Python 3.13, `pip install`, pytest). `npm test` runs the build
itself, inside `tests/build.test.js`. The ruleset on `next` requires both
jobs to pass before a pull request can merge (DECISIONS #26), and it knows
them by their job ids: renaming either one un-gates the branch.

## Branches

- `main` — the frozen 2026 app, tagged `v2026-final`. Ruleset `main`,
  active: a pull request is required (no approvals), the branch cannot be
  deleted or force-pushed, and nobody bypasses it.
- `next` — development, and the repo's default branch for the off-season.
  Ruleset `next - PR only`, active: a pull request is required (no
  approvals), squash is the only merge method, the checks `client` and
  `pipeline` must pass, the branch cannot be deleted or force-pushed, and
  only the repository admin can bypass it.
- Feature branches target `next`. GitHub deletes a head branch when its pull
  request merges, and a squash commit takes the pull request's title (the
  commit's, when there is only one), with the branch's commit messages as
  its body.

## Sharp edges to know

- The scrape workflow pushes to the branch chosen in the Run workflow
  dropdown (default: the default branch, currently `next`), and its
  rebase-on-retry hard-codes `main`. Both branches are PR-only, and the
  workflow's token is not the admin the `next` ruleset lets through, so a
  run that has anything to commit fails at its push (DECISIONS #26). The
  2027 pipeline needs a path onto a branch before the cron returns. It also
  runs Python 3.12, where CI runs 3.13.
- Event ids belong to the source site (see pipeline).
- The module order is a test, not a convention (DECISIONS #29): a file under
  `src/` that is not in `ORDER`, or that imports a module after it, fails
  `npm test`. An importer can read another module's `let` and mutate what it
  holds but cannot assign it - the assignment throws when it runs, and the
  build refuses it - and a module below the shell that needs the whole page
  redrawn asks over the bus, because `render()` is above it. Only `render()`
  goes over the bus, which is why the two functions that measure the header
  are in `scroll.js`, not the shell: `updateFresh()`, in `loading.js`, calls
  one of them.
- `index.html`'s ids are an interface. `sheet.js` and `loading.js` look
  elements up by id as they are imported, and `scroll.js` looks up `main`:
  a renamed id is a `null` at import and a throw in `boot()`, in every page
  test.
- The root `index.html` is Vite's entry template, not a page. Serving the
  repo root with a static server does not run the app; use `npm run dev`,
  or build and serve `dist/` (`npm run preview`).
- The built page's one script is a classic script, not a module (`dcBuild`
  strips `type="module"`; see Build and deploy), so every top-level name in
  the bundle is a global: minified, a few hundred one- and two-letter
  `var`s and functions on `window`. With one script on the page nothing can
  collide, and the app never reads a global by name. It stops being
  harmless the day a second script shares the page - an error tracker, an
  analytics snippet, a client library from a CDN - or an inline handler is
  written into the template. The fix is an IIFE wrap in `dcBuild`, or
  shipping the module script and teaching the build smoke to run one.
  Either changes the bytes the worker serves, so it belongs with the
  `sw.js` and Playwright work (DECISIONS #24). `npm run dev` and the page
  tests run real modules and do not show it.
- `sw.js` cache version is bumped by hand. Any change to `public/sw.js`,
  a comment included, is a new worker for every installed client.
- The page makes one third-party request at run time: Google Fonts, for
  Barlow Semi Condensed (`index.html`). The worker caches it.
- No backend, no accounts, no sync: picks live on one device.
