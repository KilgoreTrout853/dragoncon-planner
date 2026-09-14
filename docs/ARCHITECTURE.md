# Architecture

What the system **is** as of the `next` branch, September 2026. Not what is
planned — that lives in DECISIONS.md and the roadmap. Update this file in
the same PR as any change that alters the shape described here.

## In one paragraph

A Python scraper turns the official Dragon Con app's web view into one JSON
file. A single-file web app reads that JSON, lets you search, star, and
plan, and stores your picks in the browser. A service worker keeps the app
usable with no signal. GitHub Pages serves it; there is no backend.

```
app.core-apps.com/dragoncon26          (official schedule, HTML)
        │  scraper.py  (fetch, parse, dedupe, carry tags over)
        ▼
data/2026/events.json  ◄── tag_events.py (Claude adds tags to untagged events)
        │  fetched by the page; cached by sw.js
        ▼
index.html  (the whole client)  ──►  localStorage (picks, settings)
        │
   GitHub Pages  (main → live site;  next → dev site via build.py)
```

## Repo map

| Path | What it is |
|---|---|
| `index.html` | The entire client: markup, CSS, and JS in one file. |
| `sw.js` | Service worker. Offline caching, schedule revalidation. |
| `manifest.json`, `icon*.png`, `icon.svg`, `og-image.png` | PWA install and link-preview assets. |
| `data/2026/events.json` | The frozen 2026 schedule, ~3,460 events, ~3 MB. |
| `scraper.py` | Scrape → normalise → dedupe → write `events.json`. |
| `tag_events.py` | Add `tags` to untagged events via Claude. |
| `build.py` | Copy the site to an output folder and stamp a channel/build id. |
| `tests/ui_smoke.js` | jsdom smoke test of `index.html` + `sw.js`, plus search checks against real data. |
| `tests/test_parse.py` | Scraper parsing and dedupe unit tests. |
| `tests/test_build.py` | `build.py` stamping tests. |
| `tests/sample-events.json` | 558 synthetic events used by the smoke test. |
| `.github/workflows/scrape.yml` | Manual-trigger scrape (workflow_dispatch). Refuses a scrape with 0 events or a >20% drop; commits and pushes events.json to the branch it was run from. |
| `docs/` | This file and DECISIONS.md. |

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

One file. Everything below is in `index.html`.

**Tabs:** `now`, `browse`, `explore`, `map`, `mine` (internal ids; the
Browse tab's visible label is different `[verify]`). Rendering is a single
`render()` that redraws the active view from `state`.

**Time.** One `now()` function. A `?now=<ISO>` query parameter sets a
simulated clock, mirrored to `sessionStorage` (`dc26.timeOverride`, or
`dc26.timeOverride.<channel>` on a stamped build) so it survives navigation
but not a new tab. `isSimulated()` shows a chip. `conPhase()` returns
`preview | live | ended` from `now()` and drives the pre-con banner, the
live Now tab, and archive mode. The smoke test fails on any `new Date()` or
`Date.now()` outside the Time section.

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

**Boot order:** parse JSON → first render → index build (idle) → suggestion
index (idle). Timings are recorded in `BUILD`/`BOOT` for the device readout.

## Offline

`sw.js`, three strategies:

| Request | Strategy | Why |
|---|---|---|
| `index.html` | Network-first, 3 s timeout, fall back to cache; late responses still cached | A fix should land when there's signal; a slow tower must not block launch |
| `events.json` | Cache-first; revalidate in the background; notify the page only if `generated_at` changed | 3 MB on con wifi is the thing that makes the app feel broken |
| Fonts | Cache-first forever (opaque responses allowed) | Never change; a missing font is a visibly broken page |

Cache name is `dc26-v4` (or `dc26-<channel>-v4` on a stamped build). Bump
the version when `index.html` or `sw.js` changes; older caches under the
same prefix are deleted on activate. Install precaches the shell
individually so one failed fetch doesn't fail the install.

## Build and deploy

There is no build step for the live site: `main` is served as-is by GitHub
Pages at `kilgoretrout853.github.io/dragoncon-planner/`.

For the dev site, `build.py --out <dir>` copies the deployable files (no
tests, scripts, README, or `node_modules`), adds `.nojekyll`, and, when
`DC_CHANNEL` is set, stamps it into `<meta name="dc-channel">` and the
worker's `CHANNEL`, with `DC_BUILD` (default: short commit sha) into
`<meta name="dc-build">`. With no channel the output is byte-identical to
the source. A bad channel string is refused.

How the stamped output reaches the `dragoncon-planner-next` deploy repo and
its Pages site: `[verify — not in the sync; describe the workflow or manual
step here]`.

The live and dev sites share an origin; the channel stamp is what keeps
their caches and session keys apart (DECISIONS #15).

## Tests

```
node tests/ui_smoke.js        # needs: npm install (jsdom)
python tests/test_parse.py
python tests/test_build.py
```

`ui_smoke.js` loads `index.html` in jsdom with `?now=2026-09-05T13:05`,
drives the tabs, and asserts on both DOM state and the page source (CSS
rules, the Time-section rule, the SW registration). It ends with search
quality checks against the real `events.json`. `npm test` is still the
placeholder from `npm init` and does nothing `[fix]`.

There is no CI; tests run by hand.

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
- The client is one file; tests assert on its text. Any restructuring
  (the 2027 foundation work) will need those assertions rewritten.
- `sw.js` cache version is bumped by hand.
- No backend, no accounts, no sync: picks live on one device.
