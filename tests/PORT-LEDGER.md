# Port ledger: tests/ui_smoke.cjs → Vitest

PR 4b, step one (DECISIONS #24). Every `assert(` call site in `tests/ui_smoke.cjs`, where it goes and how, so that nothing is lost
silently when the harness is replaced. Written against `next` at 79fb1dd; line numbers are the harness's. No test code exists yet and
no app code changes here.

How the numbers were made: the harness was parsed, not grepped. Each call site's condition was traced back through the harness's
own variables to what it reads (the page, a `window.eval`, the source text, the built files), and an instrumented copy of the harness
was run once to count how often each site executes. The classes are DECISIONS #24's. The rules came from the brief; the per-row
decisions that are not mechanical are written out in the last column.

**Classes.** (a) DOM behaviour. (b) a rule over source text: CSS, or lint-like. (c) a check of the build output. (d) an
implementation detail: a signature, a `toString()`, a window of source, a `typeof`. (e) a check that needs the real schedule.

**Mechanisms.** `import`: a pure export, no page. `handle`: a booted page, driven through the handle `boot()` returns (exports are
imported beside it). `dom`: a booted page, DOM only. `observe`: a MutationObserver on a container, asserting what did or did not
change. `provoke`: the situation is produced through the app's own mechanism rather than by assigning a variable. `rule`: a regex over
`src/styles.css` or `src/app.js`. `build`: over `dist/`.

**Dispositions.** `port`: as it is. `merge`: folded into the named line, with the reason. `rewrite`: what it observes instead.
`delete`: why, in a line.

## Totals

817 call sites; 848 assertions execute, because 8 sites sit in loops (404 ×8, 1295 ×5, 1305 ×4, 1631 ×4, 2266 ×9, 2274 ×5, 2275 ×5, 2281 ×3) and 4 never run on the sample fixture (366, 470, 499, 1283).

| class | call sites | executed | port | merge | rewrite | delete | live after |
|---|---:|---:|---:|---:|---:|---:|---:|
| (a) DOM behaviour | 613 | 628 | 559 | 11 | 43 | 0 | 602 |
| (b) CSS rule | 43 | 43 | 43 | 0 | 0 | 0 | 43 |
| (b) lint-like rule | 8 | 8 | 7 | 1 | 0 | 0 | 7 |
| (c) build output | 35 | 41 | 31 | 4 | 0 | 0 | 31 |
| (d) implementation detail | 44 | 44 | 0 | 4 | 25 | 15 | 25 |
| (e) real-data | 74 | 84 | 74 | 0 | 0 | 0 | 74 |
| **all** | **817** | **848** | **714** | **20** | **68** | **15** | **782** |

The arithmetic: 714 ported + 20 merged + 68 rewritten + 15 deleted = 817 call sites. 782 of them are still live assertions afterwards. Splitting the 12 compound rows (below) adds 12, so the Vitest files hold **794 assertion sites** against the harness's 817: 20 merged away, 15 deleted, 12 created by splitting.

### Against the brief's counts

The brief's counts are executed assertions, not call sites: (c) is 35 sites but 41 executions (1295 runs five times and 1305 four; 1283 is a catch arm that never runs), and 41 is the brief's number.

| class | brief | here (executed) | difference |
|---|---:|---:|---|
| (b) CSS | 48 | 43 | 8 more rows carry a CSS regex inside a compound assertion whose first claim is about the page; they are classed (a) here and split. The brief's 48 is consistent with counting five of them as CSS. Counting every row that touches CSS gives 51. |
| (b) lint-like | 8 | 8 | none. Three of the eight (375, 938, 1893) are greps for removed names, kept here because the brief's scheme files them as rules; see Deletes. |
| (c) | 41 | 41 | none |
| (d) | 41 | 44 | three more than the brief, which must class three of these as (a). I cannot tell which from the brief; the likeliest are 808 and 1461 (source text for an attribute the DOM shows) and 820 (the wording of a comment). |
| (a) + (e) | 710 | 712 | the remainder |

## Deletes

Every one is class (d). Nothing in (a) or (e) is deleted.

| line | message | why |
|---:|---|---|
| 25 | boot renders, then schedules the index | re-reads load()'s statement order; the behaviour is 23 (BOOT.indexAtRender === false, indexed after rendered) |
| 150 | nothing infers a location from a pick that ended, and no 90-minute window rem… | greps currentLocation's body for a 90-minute window that was removed; the behaviour is 146-148 (an ended pick, no picks and a stream all give null) |
| 258 | the map component is gone | `typeof venueMapHTML` is history; 259 is the observable half (no .venue-map renders) |
| 261 | the override code is gone | `typeof overrideLocation` is history; DECISIONS #5 is the record |
| 262 | the home base setting is gone | `typeof settings.homeBase` is history; 263 is the observable half (no #homeBase control) |
| 543 | browse renders are queued, not immediate | `typeof queueBrowseRender === 'function'` is existence by name; the behaviour is 559 and 564 |
| 575 | the tick has its own path | `typeof tickNow === 'function'` is existence by name; the behaviour is 591-592 and 602 |
| 576 | built on a model and a signature rather than a rebuild | `typeof nowSignature/nowModel` is existence by name; the behaviour is 591-592 (a quiet tick keeps every node) |
| 1239 | togglePick still exists | `typeof togglePick === 'function'` is existence by name; 52 stars through it |
| 1240 | with the anchoring signature the star fix gave it | matches togglePick's parameter list; the anchoring behaviour is 53 |
| 1688 | the interval is 15 minutes, on visibilitychange and pageshow | matches RECHECK_MS and two addEventListener calls in the text; the behaviour is 1682, 1683 and 1685 |
| 1879 | one helper serves rows, sheet, hero, mini-bar and card | a removed helper's name plus a count of placeHTML( call sites; the behaviour is 1819-1826 and 1876-1878 |
| 1882 | now() is the one clock; getNow is gone | `typeof getNow === 'undefined'` is history; DECISIONS #12 is the record and ESLint is the guard |
| 2087 | match quality is computed per term, from MiniSearch's match map | matches termQuality's parameter list; the behaviour is 2089-2094 |
| 2267 | the main index decides prefix per term | `typeof index._options.searchOptions.prefix` reads MiniSearch's private options; 2268-2270's rewrites are the behaviour |

Half a row more: **1541** keeps its DOM claim (no `.map-leave`, no `.map-route` in the SVG) and drops its grep of source and page for five removed names, which is history.

Delete candidates that are *not* deleted here, because the brief files them as lint-like rules and rules are ported: **375** (`celeb-chip`, `browse.celebrity`, `f.celebrity`), **938** (`foryou`), **1893** (`#now=`). Each is a grep for something that was removed, each has an observable half that stays (374; 936-937; 1898 and 1231), and nothing in PR 5 replaces them. Recommendation: delete all three.

## Handle-addition proposals

**None.** Every patch and every internal write has a provocation:

| what the harness did | what the test does instead | rows |
|---|---|---|
| `window.renderBrowse = counter` | MutationObserver on `#view-browse` while typing | 559, 1860 |
| `renderMap = counter` | MutationObserver on `#view-map` around `tickMap()` | 1612, 1614, 1789, 1794 |
| `revealChip = recorder` | stub the chip's and the row's rects, spy on the row's own `scrollTo` | 813, 817, 820 |
| `pageScrollTo = recorder` | give `main` a `scrollTo` spy; the app prefers it when it exists | 1058, 1201 |
| `isStandalone = () => true` | `bootPage({matchMedia})`, stubbed before import | 839 |
| `window.reloadNow = counter` | the `reload` option | 1349, 1352 |
| `index = null; suggestIndex = null` | a fresh boot under fake timers, before the timers run | 1842-1845 |
| `servedOffline = true / false` | `message` events on the `navigator.serviceWorker` stub | 1371, 1375 (+1366, 1368 merged in), 1339, 1689 |
| `timeOverride = new Date(…)` | no override, system time faked, the app's own 60-second interval | 1982 |
| `lastScheduleCheck = now() - 16 min` | `handle.setTimeOverride(+16 min)`: a simulated clock stands still, so moving it is how time passes | 1682-1685 |
| `pillDragged = true` | touchstart, touchmove > 6px, touchend on the pill, then click | 1352 |
| `pickInfo[id] = …` | seed `dc26.picks` and `dc26.pickInfo` in localStorage, then boot: `load()` reconciles | 736-746, 871 |
| `meta.generated_at = gen` (a restore) | not needed: each test boots its own page | 1682-1685 |

Internals that were only *read* go the same way: `suggestDocs` (331-333 merge into what they imply; 2081-2083 pick a speaker from `handle.events`), `hotels` (404, from `handle.events`), `byId` (`handle.events.find`), `browseRenderTimer` and `pendingQuery` (563, 569, 571, 1843-1845 observe the DOM), `lastNowSig` (602 observes the hero node), `pickNews.length` (the `.pick-news` list and `dc26.pickNews`).

One addition to the **helper**, not the handle: `bootPage` needs a `reload` option to pass through to `boot()`. The brief's signature does not list it and its own rule for reloadNow requires it.

## Not cleanly classifiable, and other things to decide

1. **Compound rows (11, plus 1860).** One `assert` makes claims of two or three kinds: 191, 1433, 1541, 1581, 1622, 1625, 1629, 1645, 1729, 1842, 1996. Each is classed by its first claim and split; the last column says where each half goes. 1860 also asserts `SEARCH_DEBOUNCE_MS === 70`, which moves to the unit file.
2. **An assertion that is not an `assert`.** Line 2286, `window.addEventListener("error", …)`, fails the run on any uncaught error in the page, for the whole run. It is not among the 817 and it must not be lost: `bootPage` records `error` and `unhandledrejection` on the window and `cleanup()` fails the test if there were any; the dist smoke asserts the same.
3. **Two rows that cannot fail.** 53 (starring does not shift rows): jsdom has no layout, every rect is 0, drift is 0 by construction. Ported, because it still proves the path runs; it proves nothing about anchoring. 1246: the condition is `length >= 0`. Merged into 38.
4. **One row that tests the test.** 966 saves junk follows, then filters them with a copy of the app's rule written inside the eval; the app's own loader never runs. Rewritten to seed storage and boot, which is an (a) row getting `rewrite` rather than `port`. The other (a) rewrites are all patches or internal writes.
5. **Four rows that never execute** on the sample fixture: 366, 470 and 499 sit behind an `if` the fixture does not satisfy (no person whose count differs with noise hidden; no pick of 152+ minutes; no tight pair five minutes apart in another hotel), and 1283 is a catch arm. Ported with their guards. A fixture that satisfies them is a separate decision.
6. **239 reads a computed style** (`getComputedStyle(bar).height === "48px"`). It works in the harness because the built page inlines the stylesheet. The helper therefore puts `src/styles.css` in a `<style>`; otherwise 239 becomes a rule over the CSS.
7. **Rows in `realDataChecks` that need no data**: 2089-2094 (`termQuality`), 2119-2120 (`expandQuery`), 2266 (`STOPWORDS`, ×9). Classed (a), mechanism `import`, in the unit file.
8. **908-911** set `cancelled = true` on an event object. Through `handle.events` that is the same object, so they port; it is data, not an internal.
9. **To confirm in step two, not assumed here:** that Vitest 5 still honours a per-file `// @vitest-environment jsdom` (otherwise two `projects` in `vitest.config.js`); that its jsdom environment keeps `pretendToBeVisual` on (`requestAnimationFrame`, and `document.visibilityState === "visible"`, which 1682-1685 depend on); that jsdom honours `{passive: false}` closely enough for 793's rewrite.

## Helper design: tests/helpers/page.js

```
bootPage({ fixture = "sample",          // "sample" → tests/sample-events.json, "real" → data/2026/events.json
           now = "2026-09-05T13:05",    // becomes ?now=…; null for no override (the clock is then the system's, real or faked)
           channel = "", build = "",    // the two meta stamps
           url,                          // overrides the whole URL (a #explore= deep link, a bare path)
           matchMedia,                   // query => boolean; default () => false
           reload } = {})                // passed through to boot(); an addition to the brief's signature
  → Promise<{ handle, app, window, document, sw, indexed, cleanup }>
```

In order, because `src/app.js` reads the page as it is imported:

1. **Markup.** `index.html` is read once per file. Its `<head>` (minus the module script and the stylesheet link) and its `<body>` go into the live document, and `src/styles.css` goes into one `<style>` (row 239).
2. **Stamps.** `<meta name="dc-channel">` and `<meta name="dc-build">` get `channel` and `build`. `BUILD` and `TIME_OVERRIDE_KEY` are consts read at import, so this precedes it.
3. **URL.** `jsdom.reconfigure({url})`; Vitest exposes its JSDOM instance as the global `jsdom`. Default `https://example.test/?now=2026-09-05T13:05`, the harness's.
4. **Stubs the module reads at import or that `boot()` registers against:** `window.matchMedia`; `navigator.serviceWorker`, an `EventTarget` with `register: vi.fn()` resolving and `controller: null`, returned as `sw` so a test can dispatch `message` or make `register` reject; `window.confirm = () => true`; `URL.createObjectURL` / `revokeObjectURL` and `HTMLAnchorElement.prototype.click` for the .ics rows. `requestIdleCallback`, `ResizeObserver`, `document.fonts` and `navigator.platform` are left as jsdom has them; the few tests that need them set them before calling `bootPage`.
5. **Storage is not cleared here.** A test that seeds `dc26.*` does it before `bootPage`; `cleanup()` clears it after.
6. **Bookkeeping.** `addEventListener` on `window`, `document` and the service-worker stub, and `setInterval`, are wrapped for the duration of `boot()` so `cleanup()` can undo exactly what it registered. The window outlives the module instance; without this a second boot in one file leaves the first boot's `visibilitychange`, `pageshow`, `hashchange` and minute tick firing against a dead module.
7. **Boot.** `vi.resetModules()`, `app = await import("../../src/app.js")`, `handle = app.boot({events, reload})`, `await handle.ready`. `events` is the parsed fixture, parsed once per file: `load()` copies each event, so the fixture object is never mutated.
8. **Return.** `handle`; `app`, the module namespace (the 97 exports); `window`, `document`; `sw`; `indexed()`, which resolves when `app.BOOT.suggested` is set (under fake timers the test runs them itself); `cleanup()`, also registered with `afterEach`: removes the recorded listeners and interval, clears both storages, resets the URL, restores the stubs, and fails the test if the window saw an `error` or an `unhandledrejection`.

`handle.ready` resolves after the first render and before any index exists, which is what 23 and 1842-1845 need. A test that wants search results awaits `indexed()`.

## File plan

Assertion sites are call sites that survive (port + rewrite) plus what splitting adds; merged rows count at their partner.

| file | sites | executed | fixture | environment | longer timeout |
|---|---:|---:|---|---|---|
| `tests/build.test.js` | 31 | 38 | none (builds into temp dirs) | node | yes, as now: 120 s a case |
| `tests/real-data.test.js` | 77 | 87 | real, booted once in beforeAll | jsdom | yes: the index over 3,459 events; the harness allowed 12 s. 60 s for the hook |
| `tests/rules/source.test.js` | 7 | 7 | none (reads src/app.js, index.html) | node |  |
| `tests/rules/styles.test.js` | 51 | 51 | none (reads src/styles.css) | node |  |
| `tests/ui/archive.test.js` | 26 | 26 | sample | jsdom |  |
| `tests/ui/boot.test.js` | 4 | 4 | sample | jsdom | no, but it waits for the sample index: watch it |
| `tests/ui/devmark.test.js` | 6 | 6 | sample | jsdom |  |
| `tests/ui/explore.test.js` | 53 | 53 | sample | jsdom |  |
| `tests/ui/follows.test.js` | 70 | 70 | sample | jsdom |  |
| `tests/ui/ics.test.js` | 4 | 4 | sample | jsdom |  |
| `tests/ui/leave.test.js` | 20 | 20 | sample | jsdom |  |
| `tests/ui/map.test.js` | 96 | 96 | sample | jsdom |  |
| `tests/ui/mine.test.js` | 21 | 21 | sample | jsdom |  |
| `tests/ui/minibar.test.js` | 17 | 17 | sample | jsdom |  |
| `tests/ui/now.test.js` | 34 | 34 | sample | jsdom |  |
| `tests/ui/nudge.test.js` | 6 | 6 | sample | jsdom |  |
| `tests/ui/offline.test.js` | 18 | 18 | sample | jsdom |  |
| `tests/ui/pick-news.test.js` | 11 | 11 | sample | jsdom |  |
| `tests/ui/search.test.js` | 114 | 121 | sample | jsdom | no, but it waits for the sample index: watch it |
| `tests/ui/settings.test.js` | 15 | 15 | sample | jsdom |  |
| `tests/ui/sheet.test.js` | 21 | 21 | sample | jsdom |  |
| `tests/ui/shell.test.js` | 35 | 38 | sample | jsdom |  |
| `tests/ui/time.test.js` | 24 | 24 | sample | jsdom |  |
| `tests/unit/misc.test.js` | 11 | 11 | none | jsdom |  |
| `tests/unit/query.test.js` | 10 | 18 | none | jsdom |  |
| `tests/unit/time.test.js` | 8 | 8 | none | jsdom |  |
| `tests/unit/venues.test.js` | 4 | 4 | none | jsdom |  |
| `tests/dist-boots.test.js` | 6 (new) | 6 | sample, served by a fetch stub | node (raw JSDOM) | yes: one vite build; 120 s |
| **total** | **794** + 6 new | | | | |

`tests/unit/*` import `src/app.js` with no page: the module's DOM consts come back `null`, which is harmless because nothing pure touches them. They still need jsdom, because the import itself calls `document.querySelector`. Anything that reads the clock, the schedule or the picks is `handle`, not `import`: outside `boot()` there is no `?now=`, and by the real clock the con has ended.

`tests/build.test.js` keeps its seven cases and gains the (c) rows; 1292, 1331 and 1987 merge into cases 6, 6 and 2, which already assert them. `npm run smoke`, its line in `ci.yml` and `tests/ui_smoke.cjs` go in the last PR of 4b, once every row here is green in its new home; `npm test` then carries everything.

## The "dist boots" smoke: tests/dist-boots.test.js

What only the built artifact can prove. Raw `JSDOM`, not Vitest's environment: `new JSDOM(html, {runScripts: "dangerously", pretendToBeVisual: true, url: "https://example.test/?now=2026-09-05T13:05", beforeParse(window) { … }})`, where `beforeParse` installs `window.fetch`, answering `data/2026/events.json` with the sample fixture, and an `error` listener. Nothing injects `window.DC_EVENTS`: the page takes the fetch path, as the live site does, and `src/main.js` drops its read of it in the same PR.

It asserts, on an unstamped build:

1. no `error` event and no unhandled rejection from parse to the end of the test (the harness's line 2286);
2. `fetch` was called once, with `data/2026/events.json` and `cache: "no-cache"`;
3. the first screen: `#clock` starts `Sat 1:05 PM`, `#fresh` matches `/[\d,]+ events · refreshed/`, `#view-now .row` is not empty;
4. `boot()` ran in the classic script: tapping the first star sets `#mineBadge` to 1 and writes `dc26.picks`;
5. the bundled MiniSearch works: typing `trek` into `#q` draws rows once the index has built.

And on the stamped build that `build.test.js` case 1 already makes:

6. `.devmark` reads `dev build · next · abc1234`: the stamp the build writes is the stamp the app reads, end to end.

It shares `build()` with `tests/build.test.js` through a small `tests/helpers/build.js`, at the cost of one more `vite build`.

## The ledger

One row per call site, in harness order, under the harness's own section comments. `×N`: the site runs N times in a loop.


### boot: the first screen draws before the search index exists

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 23 | a | the first render happened with no index; the index came … ms later and the su… | `ui/boot.test.js` | handle | port |
| 25 | d | boot renders, then schedules the index | `ui/boot.test.js` |  | **delete** re-reads load()'s statement order; the behaviour is 23 (BOOT.indexAtRender === false, indexed after rendered) |
| 26 | d | in idle time, with a plain timeout as the fallback, and the suggestion index … | `ui/boot.test.js` | provoke | **rewrite** stub window.requestIdleCallback before boot: it is called with {timeout: 2000}, and the index and the suggestion index arrive in two separate callbacks; with no stub (jsdom) the setTimeout fallback still builds both |
| 27 | a | clock shows preview time:  | `ui/boot.test.js` | dom | port |
| 28 | a | freshness line:  | `ui/boot.test.js` | dom | port |
| 30 | a | empty picks state on Now | `ui/now.test.js` | dom | port |
| 32 | a | Now shows events around 1 PM (… rows) | `ui/now.test.js` | dom | port |
| 33 | a | first group is 'On now' | `ui/now.test.js` | dom | port |
| 37 | a | badge counts 1 pick | `ui/now.test.js` | dom | port |
| 38 | a | pick persisted to localStorage | `ui/now.test.js` | dom | port |
| 52 | a | starring adds exactly one pick | `ui/now.test.js` | handle | port |
| 53 | a | starring does not shift neighbouring rows (drift …px) | `ui/now.test.js` | handle | port. jsdom has no layout, so drift is 0 by construction here as it was in the harness; kept because it still proves the re-render path does not throw and leaves one pick |
| 60 | a | row tap opens the sheet | `ui/sheet.test.js` | handle | port |
| 61 | a | event panel is shown | `ui/sheet.test.js` | dom | port |
| 62 | a | settings panel is hidden | `ui/sheet.test.js` | dom | port |
| 63 | a | sheet shows the tapped event's title | `ui/sheet.test.js` | dom | port |
| 64 | a | dialog is labelled by the event title | `ui/sheet.test.js` | dom | port |
| 65 | a | sheet shows the room | `ui/sheet.test.js` | dom | port |
| 66 | a | room is set in the hotel's hue | `ui/sheet.test.js` | dom | port |
| 67 | a | sheet shows day/time/duration | `ui/sheet.test.js` | dom | port |
| 70 | a | sheet star reflects an existing pick | `ui/sheet.test.js` | dom | port |
| 72 | a | sheet star unstars | `ui/sheet.test.js` | dom | port |
| 73 | a | unstar persisted | `ui/sheet.test.js` | dom | port |
| 75 | a | restar persisted | `ui/sheet.test.js` | dom | port |
| 82 | a | sheet exports exactly one VEVENT | `ui/ics.test.js` | dom | port |
| 83 | a | single-event ICS carries the Eastern timezone | `ui/ics.test.js` | dom | port |
| 84 | a | single-event ICS is the event from the sheet | `ui/ics.test.js` | dom | port |
| 88 | b css | the sheet declares touch-action: none | `rules/styles.test.js` | rule | port |
| 89 | b css | the description still scrolls (touch-action: pan-y) | `rules/styles.test.js` | rule | port |
| 90 | b css | the sheet animates when it settles | `rules/styles.test.js` | rule | port |
| 91 | b css | the settle animation is dropped under prefers-reduced-motion | `rules/styles.test.js` | rule | port |
| 96 | a | drag applies a transform | `ui/sheet.test.js` | handle | port |
| 98 | a | closing clears the drag transform | `ui/sheet.test.js` | handle | port |
| 99 | a | closing clears the backdrop fade | `ui/sheet.test.js` | dom | port |
| 100 | a | closing clears the settling class | `ui/sheet.test.js` | dom | port |
| 104 | a | backdrop tap closes the sheet | `ui/sheet.test.js` | dom | port |
| 105 | a | inline row expansion is gone | `ui/sheet.test.js` | dom | port |

### step 2: hero card, leave-by, ring, no 6-pick cap

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 109 | a | hero card renders for the next pick | `ui/now.test.js` | dom | port |
| 110 | a | hero has an SVG countdown ring | `ui/now.test.js` | dom | port |
| 113 | a | ring dashoffset within its circumference (…/…) | `ui/now.test.js` | dom | port |
| 114 | a | hero kicker reads On now or Your next | `ui/now.test.js` | dom | port |
| 115 | a | hero room uses the hotel hue | `ui/now.test.js` | dom | port |
| 116 | a | LEAVE_BUFFER_MIN is 10 | `unit/misc.test.js` | import | port |
| 125 | a | leave-by = start - walk - buffer (… = … + 10) | `ui/leave.test.js` | handle | port |
| 126 | a | no leave-by for a next pick in the hotel you are already in | `ui/leave.test.js` | handle | port |
| 145 | a | currentLocation is the hotel of the pick that is on now | `ui/leave.test.js` | handle | port |
| 146 | a | a pick that ended … minutes ago says nothing about where you are | `ui/leave.test.js` | handle | port |
| 147 | a | and nothing picked is nowhere | `ui/leave.test.js` | handle | port |
| 148 | a | chain.streamFound ? "a stream that is on says nothing either: you could be an… | `ui/leave.test.js` | handle | port |
| 150 | d | nothing infers a location from a pick that ended, and no 90-minute window rem… | `ui/leave.test.js` |  | **delete** greps currentLocation's body for a 90-minute window that was removed; the behaviour is 146-148 (an ended pick, no picks and a stream all give null) |

### no guessing: the hero, the mini-bar and the map, with and without a pick on now

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 186 | a | with nothing on, leaveInfo gives no leave-by, only a walk estimate from the p… | `ui/leave.test.js` | handle | port |
| 188 | a | the hero has no leave-by line (…) | `ui/leave.test.js` | handle | port |
| 190 | a | its ring counts down to the start (… for … min) | `ui/leave.test.js` | handle | port |
| 191 | a | the walk estimate is a muted line (…) | `ui/leave.test.js` | handle | port. split: handle half (the walk line's text) stays; the `.hero .hthen` colour → styles rule |
| 192 | a | the mini-bar counts down (…) | `ui/leave.test.js` | handle | port |
| 193 | a | the map's card counts down to the start and the map keeps the next ring (…) | `ui/leave.test.js` | handle | port |
| 195 | a | no walk estimate when the previous pick was in the same hotel | `ui/leave.test.js` | handle | port |
| 196 | a | and none without a previous pick today | `ui/leave.test.js` | handle | port |
| 197 | a | with a pick on, the hero says leave the hotel you are in, and its ring runs t… | `ui/leave.test.js` | handle | port |
| 199 | a | the mini-bar says leave by (…) | `ui/leave.test.js` | handle | port |
| 200 | a | and the map's card says so too, with both rings (…) | `ui/leave.test.js` | handle | port |
| 210 | a | more than six picks in play (…) | `ui/now.test.js` | handle | port |
| 211 | a | all picks render, no 6-cap (hero + … rows for … picks) | `ui/now.test.js` | handle | port |
| 212 | a | remaining picks render as a compact list | `ui/now.test.js` | dom | port |
| 215 | a | tapping the hero opens the event sheet | `ui/now.test.js` | dom | port |
| 219 | a | reset to one pick for later steps | `ui/now.test.js` |  | **merge** with 38: identical condition; it was scaffolding that re-checked a reset the next harness section relied on, and each ported test boots its own page |

### step 3: sticky next-up mini-bar

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 223 | a | mini-bar element exists | `ui/minibar.test.js` | dom | port |
| 224 | a | mini-bar is hidden on the Now tab | `ui/minibar.test.js` | dom | port |
| 232 | a | found a pick later in the same con day | `ui/minibar.test.js` | handle | port |
| 234 | a | mini-bar shows on Browse when a pick remains today | `ui/minibar.test.js` | dom | port |
| 235 | a | mini-bar names the next pick | `ui/minibar.test.js` | handle | port |
| 236 | a | mini-bar room uses the hotel hue | `ui/minibar.test.js` | dom | port |
| 238 | a | mini-bar says leave-by only while a pick is on (…: …) | `ui/minibar.test.js` | handle | port |
| 239 | a | mini-bar is 48px tall | `ui/minibar.test.js` | dom | port |
| 240 | a | body reserves room for the bar | `ui/minibar.test.js` | dom | port |
| 243 | a | tapping the mini-bar switches to Now | `ui/minibar.test.js` | handle | port |
| 244 | a | mini-bar hides again once Now is active | `ui/minibar.test.js` | dom | port |
| 247 | a | 1am Sunday counts as Saturday's con day | `unit/time.test.js` | import | port |
| 248 | a | 11pm Saturday counts as Saturday | `unit/time.test.js` | import | port |
| 249 | a | 6am Sunday counts as Sunday | `unit/time.test.js` | import | port |
| 253 | a | mini-bar stays hidden with no picks left today | `ui/minibar.test.js` | handle | port |

### the venue map is gone: hotel filtering is chips again

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 258 | d | the map component is gone | `ui/shell.test.js` |  | **delete** `typeof venueMapHTML` is history; 259 is the observable half (no .venue-map renders) |
| 259 | a | no map renders anywhere | `ui/shell.test.js` | dom | port |
| 260 | a | the hero card has no map | `ui/shell.test.js` |  | **merge** with 259: same claim, one selector narrower |
| 261 | d | the override code is gone | `ui/shell.test.js` |  | **delete** `typeof overrideLocation` is history; DECISIONS #5 is the record |
| 262 | d | the home base setting is gone | `ui/shell.test.js` |  | **delete** `typeof settings.homeBase` is history; 263 is the observable half (no #homeBase control) |
| 263 | a | no home base control in Settings | `ui/shell.test.js` | dom | port |
| 268 | a | search filters to matches (…) | `ui/search.test.js` | handle | port |
| 271 | a | All days + query shows per-row day labels | `ui/search.test.js` | dom | port |
| 274 | a | search cleared | `ui/search.test.js` | handle | port |
| 276 | a | hotel chip sets the filter | `ui/search.test.js` | handle | port |
| 277 | a | hotel filter applies | `ui/search.test.js` | dom | port |

### search step 1: query intent parsing

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 290 | a | "star trek saturday hilton" searches only "star trek" (got "…") | `ui/search.test.js` | handle | port |
| 291 | a | day and hotel pulled out of the query | `ui/search.test.js` | handle | port |
| 292 | a | chips name what was taken (…) | `ui/search.test.js` | handle | port |
| 294 | a | signing sunday is all filters | `ui/search.test.js` | handle | port |
| 296 | a | tonight means today, evening | `ui/search.test.js` | handle | port |
| 298 | a | late night party is time + kind | `ui/search.test.js` | handle | port |
| 300 | a | bare 'gaming' filters by kind | `ui/search.test.js` | handle | port |
| 301 | a | 'marriott gaming' filters by kind | `ui/search.test.js` | handle | port |
| 303 | a | 'board game night' keeps 'game' as a search word | `ui/search.test.js` | handle | port |
| 304 | a | the reverted word stays in place (got "…") | `ui/search.test.js` | handle | port |
| 310 | a | "concert saturday" returns results (…) | `ui/search.test.js` | handle | port |
| 311 | a | every result is a Saturday performance | `ui/search.test.js` | handle | port |
| 312 | a | an all-filter query highlights nothing (no search terms) | `ui/search.test.js` | dom | port |
| 314 | a | an all-filter query comes back in time order | `ui/search.test.js` | handle | port |
| 317 | a | two parsed chips render (…) | `ui/search.test.js` | dom | port |
| 319 | a | removing a chip strips that word from the query | `ui/search.test.js` | handle | port |
| 320 | a | the rest of the query survives (got "…") | `ui/search.test.js` | handle | port |
| 323 | a | a parsed day overrides the day chip | `ui/search.test.js` | handle | port |
| 325 | a | the chip takes over again once the word is gone | `ui/search.test.js` | handle | port |

### search step 2: suggestions as you type

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 331 | a | a name index was built (… names) | `ui/search.test.js` |  | **merge** with 339: suggestDocs is an internal; that a name index was built is what 339 observes (a two-letter query suggests people) |
| 332 | a | people are indexed | `ui/search.test.js` |  | **merge** with 339: people being indexed is what 339 observes |
| 333 | a | fandoms and topics are indexed | `ui/search.test.js` |  | **merge** with 344: topics being indexed is what 344 observes |
| 335 | a | one character suggests nothing | `ui/search.test.js` | handle | port |
| 337 | a | two characters start suggesting (…) | `ui/search.test.js` | handle | port |
| 339 | a | "ka" suggests people (…) | `ui/search.test.js` | handle | port |
| 340 | a | at most five chips per row | `ui/search.test.js` | handle | port |
| 341 | a | people ranked by how many events match (…) | `ui/search.test.js` | handle | port |
| 342 | a | suggestions are whole names, not fragments (…) | `ui/search.test.js` | handle | port |
| 344 | a | topics are suggested too (…) | `ui/search.test.js` | handle | port |
| 348 | a | suggestion rows are labelled (…) | `ui/search.test.js` | handle | port |
| 352 | a | tapping quotes the name (…) | `ui/search.test.js` | handle | port |
| 354 | a | the exact-phrase search returns results (…) | `ui/search.test.js` | handle | port |
| 355 | a | every result actually mentions … | `ui/search.test.js` | handle | port |
| 358 | a | the chosen name shows as an active chip | `ui/search.test.js` | dom | port |
| 359 | a | the suggestion rows are hidden once a name is chosen | `ui/search.test.js` | dom | port |
| 361 | a | clearing the active chip empties the query | `ui/search.test.js` | handle | port |
| 366 | a | the chip count drops when photo sessions are hidden (… <= …) | `ui/search.test.js` | handle | port. does not run on the sample fixture (guarded by an if); keep the guard or pick a fixture row that satisfies it |

### search step 3: the celebrity marker; the chip that filtered on it is gone

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 373 | a | the fixture has celebrity events (…) | `ui/search.test.js` | handle | port |
| 374 | a | there is no Celebrity chip in the kind row | `ui/search.test.js` | dom | port |
| 375 | b lint | and nothing in the source still filters on it | `rules/source.test.js` | rule | port. history: a grep for the removed Celebrity chip's identifiers; 374 is the observable half. Flagged as a delete candidate. PR 5: nothing replaces it |
| 376 | a | the kind row lights exactly one chip | `ui/search.test.js` | dom | port |
| 380 | a | rows carry a celebrity marker | `ui/search.test.js` | handle | port |
| 381 | a | the marker says what it means | `ui/search.test.js` | dom | port |
| 383 | a | only celebrity rows are marked | `ui/search.test.js` | handle | port. byId → handle.events.find |
| 388 | a | the detail sheet marks a celebrity event | `ui/search.test.js` | handle | port |
| 392 | a | and does not mark a non-celebrity one | `ui/search.test.js` | handle | port |
| 400 | a | tapping the same chip again clears the filter | `ui/search.test.js` | handle | port |
| 404 | a | every venue has a chip: … | `ui/search.test.js` | handle | port. ×8 (one per venue in the fixture); `hotels` is an internal — derive the venue list from handle.events |
| 405 | a | one Other chip and no Streaming chip (…) | `ui/search.test.js` | dom | port |
| 406 | a | Other matches streams and offsite venues and nothing else; a venue still matc… | `unit/venues.test.js` | import | port |
| 410 | a | tapping Other shows streams and offsite venues together (…) | `ui/search.test.js` | handle | port |
| 412 | a | streams are in it | `ui/search.test.js` | handle | port |
| 413 | a | and so are the offsite venues, when the data has any | `ui/search.test.js` | handle | port |
| 414 | a | the Other chip reads as pressed | `ui/search.test.js` | dom | port |
| 416 | a | the Now tab's venue row is the same set (…) | `ui/search.test.js` | handle | port |
| 418 | a | tapping Other again clears it | `ui/search.test.js` | handle | port |
| 419 | a | photo sessions hidden by default | `ui/search.test.js` | dom | port |
| 423 | a | photo sessions appear when toggle off (… -> …) | `ui/search.test.js` | handle | port |

### the control strip: two rows of two, one footprint

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 433 | a | four controls in order (…) | `ui/mine.test.js` | handle | port |
| 434 | a | actions above the view toggle | `ui/mine.test.js` | dom | port |
| 436 | b css | the actions row is two equal columns | `rules/styles.test.js` | rule | port |
| 439 | b css | actions and toggle share a height (… vs …) | `rules/styles.test.js` | rule | port |
| 442 | b css | and a corner radius (… vs …) | `rules/styles.test.js` | rule | port |
| 445 | b css | and a gap (… vs …) | `rules/styles.test.js` | rule | port |
| 446 | a | with picks, both actions are live | `ui/mine.test.js` | dom | port |

### step 5: timeline is the default view on Mine

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 449 | a | Mine defaults to the timeline | `ui/mine.test.js` | handle | port |
| 450 | a | timeline grid renders | `ui/mine.test.js` | dom | port |
| 451 | a | timeline draws a block per pick | `ui/mine.test.js` | handle | port |
| 452 | a | hour ruler renders | `ui/mine.test.js` | dom | port |
| 459 | a | block height tracks duration at 60px/hour (… vs …) | `ui/mine.test.js` | handle | port |
| 461 | a | HOUR_PX is 60 | `unit/misc.test.js` | import | port |
| 467 | a | long blocks flagged for fading (…) | `ui/mine.test.js` | handle | port |
| 470 | a | a long block says when it runs to | `ui/mine.test.js` | dom | port. does not run on the sample fixture (guarded by an if); keep the guard or pick a fixture row that satisfies it |
| 473 | a | tapping a timeline block opens the event sheet | `ui/mine.test.js` | dom | port |
| 489 | a | overlapping picks widen the cluster to … columns | `ui/mine.test.js` | handle | port |
| 490 | a | overlapping picks land in different columns | `ui/mine.test.js` | handle | port |
| 493 | a | 1am Sunday sits on Saturday's timeline | `unit/time.test.js` |  | **merge** with 247: identical claim and call: conDayKey(1 AM Sunday) is Saturday |
| 496 | a | toggle switches to the list view | `ui/mine.test.js` | handle | port |
| 497 | a | view choice persists | `ui/mine.test.js` | dom | port |
| 498 | a | Mine lists picks | `ui/mine.test.js` | handle | port |
| 499 | a | walk warning shown for tight transfer:  | `ui/mine.test.js` | dom | port. does not run on the sample fixture (guarded by an if); keep the guard or pick a fixture row that satisfies it |
| 506 | a | ICS export has events with TZ | `ui/ics.test.js` | dom | port |
| 509 | a | clear all works | `ui/mine.test.js` | dom | port |
| 510 | a | with nothing picked, both actions are disabled | `ui/mine.test.js` | dom | port |
| 511 | a | and there is no view toggle to switch | `ui/mine.test.js` | dom | port |
| 512 | b css | disabled buttons look disabled | `rules/styles.test.js` | rule | port |
| 516 | a | ranking: 'Video game costume contest' ->  | `ui/search.test.js` | handle | port |
| 517 | a | typing widens to all days | `ui/search.test.js` | handle | port |
| 518 | a | synonyms+stopwords: 'nerdy space stuff' ->  | `ui/search.test.js` | handle | port |
| 519 | a | vocabulary: 'Symphony show' ->  | `ui/search.test.js` | handle | port |
| 520 | a | '&' vs 'and': 'Rick and Morty' ->  | `ui/search.test.js` | handle | port |
| 521 | a | typo tolerance: 'philharmonc' ->  | `ui/search.test.js` | handle | port |
| 522 | a | matches are highlighted | `ui/search.test.js` | dom | port |
| 523 | a | day label shown in relevance mode | `ui/search.test.js` | dom | port |
| 525 | a | fandom select and kind chips render when tags exist | `ui/search.test.js` | dom | port |
| 526 | a | clearing the query restores the day | `ui/search.test.js` | handle | port |
| 529 | a | there is no Hide 18+ toggle any more | `ui/search.test.js` | handle | port |
| 531 | a | but the word kids still keeps 18+ out | `ui/search.test.js` | handle | port |
| 533 | a | and with it cleared everything is back | `ui/search.test.js` | handle | port |
| 535 | a | kind chip filters | `ui/search.test.js` | handle | port |
| 538 | a | settings opens | `ui/sheet.test.js` | dom | port |
| 539 | a | settings panel shown, event panel hidden | `ui/sheet.test.js` | dom | port |
| 541 | a | settings closes | `ui/sheet.test.js` | dom | port |

### render cost: typing is debounced, the minute tick patches

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 543 | d | browse renders are queued, not immediate | `ui/search.test.js` |  | **delete** `typeof queueBrowseRender === 'function'` is existence by name; the behaviour is 559 and 564 |
| 544 | a | the debounce is in a sensible range (…ms) | `unit/query.test.js` | import | port |
| 559 | a | typing eight characters draws nothing while you type (… renders) | `ui/search.test.js` | observe | **rewrite** MutationObserver on #view-browse while typing: eight keystrokes inside the debounce produce no mutation (replaces the window.renderBrowse counter) |
| 563 | a | the queued render eventually fires | `ui/search.test.js` | provoke | **rewrite** fake timers: advance SEARCH_DEBOUNCE_MS and the rows are drawn (replaces polling the internal browseRenderTimer) |
| 564 | a | and draws once you stop | `ui/search.test.js` |  | **merge** with 563: 563's rewrite already asserts the draw after the debounce |
| 565 | a | the query itself was recorded immediately | `ui/search.test.js` | handle | port |
| 569 | a | a render is pending after a keystroke | `ui/search.test.js` | observe | **rewrite** MutationObserver on #view-browse while typing: a keystroke alone mutates nothing, so a render is pending rather than done (replaces reading browseRenderTimer) |
| 571 | a | and a direct render cancels it | `ui/search.test.js` | observe | **rewrite** after a keystroke, handle.render() draws once; advancing past the debounce then draws nothing more, so the pending render was cancelled |
| 575 | d | the tick has its own path | `ui/now.test.js` |  | **delete** `typeof tickNow === 'function'` is existence by name; the behaviour is 591-592 and 602 |
| 576 | d | built on a model and a signature rather than a rebuild | `ui/now.test.js` |  | **delete** `typeof nowSignature/nowModel` is existence by name; the behaviour is 591-592 (a quiet tick keeps every node) |
| 590 | a | the Now tab had rows to disturb (…) | `ui/now.test.js` | handle | port |
| 591 | a | a tick with nothing new leaves every row node in place | `ui/now.test.js` | handle | port |
| 592 | a | and leaves the hero card alone too | `ui/now.test.js` | handle | port |
| 602 | a | a tick that finds the plan changed falls back to a full render | `ui/now.test.js` | observe | **rewrite** change the picks through handle.picks.set, call tickNow(): the hero node is replaced (replaces comparing the internal lastNowSig) |

### Now is about today: a Saturday pick seen from Thursday is not "your next"

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 627 | a | with only Sunday picks, Saturday's Now has no hero | `ui/now.test.js` | handle | port |
| 628 | a | it says so, and names the day of the next pick (…) | `ui/now.test.js` | handle | port |
| 630 | a | and shows that pick as one row, labelled Sun | `ui/now.test.js` | handle | port |
| 632 | a | there is no 'Rest of your day' for a day with nothing in it | `ui/now.test.js` | handle | port |
| 633 | a | and the mini-bar agrees: nothing today | `ui/now.test.js` | handle | port |
| 634 | a | with Saturday picks too, the hero is today's next | `ui/now.test.js` | handle | port |
| 635 | a | the rest of the day is today's only (… rows) | `ui/now.test.js` | handle | port |
| 636 | a | and the count is today's, not every pick (…) | `ui/now.test.js` | handle | port |
| 637 | a | an on-now hero does not tell you to leave for a Sunday event (…) | `ui/now.test.js` | handle | port |

### one definition of "day": the con day, which runs to 5am, everywhere

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 669 | a | at 1 AM Sunday, Search opens on the Saturday chip (…) | `ui/time.test.js` | handle | port |
| 670 | a | a small-hours Sunday event (…) is under Sat, not Sun | `ui/time.test.js` | handle | port |
| 671 | a | and its row is labelled Sat (…) | `ui/time.test.js` | handle | port |
| 672 | a | Mine's list and timeline file it under the same day (… / …) | `ui/time.test.js` | handle | port |
| 674 | a | the sheet keeps the date and names the night (…) | `ui/time.test.js` | handle | port |
| 677 | a | the clock is back on Saturday afternoon | `ui/time.test.js` | handle | port |

### because you starred: suggestions drawn from the reader's own picks

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 701 | a | with nothing starred there is no suggestions strip | `ui/explore.test.js` | handle | port |
| 702 | a | one pick brings a strip headed by the count (…) | `ui/explore.test.js` | handle | port |
| 703 | a | it offers the pick's track (…) | `ui/explore.test.js` | handle | port |
| 704 | a | and sits above the filter box | `ui/explore.test.js` | handle | port |
| 705 | a | following it takes it off the strip | `ui/explore.test.js` | handle | port |
| 706 | a | a starred screening with no guest suggests nothing | `ui/explore.test.js` | handle | port |

### a pick that vanishes or moves in a refresh is reported, not swallowed

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 736 | a | a pick whose event is gone leaves the plan | `ui/pick-news.test.js` | provoke | **rewrite** seed dc26.picks and dc26.pickInfo in localStorage, then boot: load() runs reconcilePicks() itself, as a refresh would; handle.picks.get() no longer holds the ghost |
| 737 | a | and both the vanished and the moved pick make the news (…) | `ui/pick-news.test.js` | provoke | **rewrite** seed dc26.picks and dc26.pickInfo in localStorage, then boot: load() runs reconcilePicks() itself, as a refresh would; two <li> in .pick-news |
| 738 | a | Now names the vanished event and when it was (…) | `ui/pick-news.test.js` | provoke | **rewrite** seed dc26.picks and dc26.pickInfo in localStorage, then boot: load() runs reconcilePicks() itself, as a refresh would; Now's notice text |
| 740 | a | and says where the moved one used to be | `ui/pick-news.test.js` | provoke | **rewrite** seed dc26.picks and dc26.pickInfo in localStorage, then boot: load() runs reconcilePicks() itself, as a refresh would; Now's notice text |
| 741 | a | Mine shows the same notice | `ui/pick-news.test.js` | provoke | **rewrite** seed dc26.picks and dc26.pickInfo in localStorage, then boot: load() runs reconcilePicks() itself, as a refresh would; Mine's notice text |
| 742 | a | the news is stored, so it survives a reload | `ui/pick-news.test.js` | provoke | **rewrite** seed dc26.picks and dc26.pickInfo in localStorage, then boot: load() runs reconcilePicks() itself, as a refresh would; dc26.pickNews in localStorage has two entries |
| 743 | a | the moved pick's snapshot now matches the new time | `ui/pick-news.test.js` | provoke | **rewrite** seed dc26.picks and dc26.pickInfo in localStorage, then boot: load() runs reconcilePicks() itself, as a refresh would; dc26.pickInfo in localStorage carries the new start |
| 744 | a | and the vanished one's snapshot is gone | `ui/pick-news.test.js` | provoke | **rewrite** seed dc26.picks and dc26.pickInfo in localStorage, then boot: load() runs reconcilePicks() itself, as a refresh would; dc26.pickInfo in localStorage has no ghost-1 |
| 745 | a | OK dismisses it for good | `ui/pick-news.test.js` | provoke | **rewrite** after the seeded boot, tap OK: notice gone, dc26.pickNews empty |
| 746 | a | and a second look finds nothing new to report | `ui/pick-news.test.js` | provoke | **rewrite** after the seeded boot and OK, handle.reconcilePicks() again: still no notice |

### the header pads for the status bar on phones that draw under it

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 749 | b css | a top inset variable exists alongside the bottom one | `rules/styles.test.js` | rule | port |
| 751 | b css | and the header adds it to its top padding | `rules/styles.test.js` | rule | port |
| 752 | c | which matters because the page opts into drawing under the bars | `build.test.js` | build | port |
| 753 | c | the iOS status bar is opaque: translucent leaves the web view short by its he… | `build.test.js` | build | port |
| 755 | b css | the root refuses the overscroll stretch, so a fixed nav cannot bounce with it | `rules/styles.test.js` | rule | port |
| 770 | a | a drag down with the page at its top is refused | `ui/shell.test.js` | handle | port |
| 771 | a | so is a drag up with the page at its bottom | `ui/shell.test.js` | handle | port |
| 772 | a | a mostly sideways drag is not | `ui/shell.test.js` | handle | port |
| 773 | a | nor a drag that began in the sheet | `ui/shell.test.js` | handle | port |
| 774 | a | nor one inside main, which scrolls and bounces on its own | `ui/shell.test.js` | handle | port |
| 777 | b css | main is the scroll container | `rules/styles.test.js` | rule | port |
| 778 | b css | and the page around it cannot scroll | `rules/styles.test.js` | rule | port |
| 779 | b css | the header is fixed above it | `rules/styles.test.js` | rule | port |
| 780 | b lint | no code scrolls the window directly | `rules/source.test.js` | rule | port. PR 5: ESLint no-restricted-properties on window.scrollTo / scrollBy / scrollY / pageYOffset |
| 782 | a | the scroll helpers address main (…) | `ui/shell.test.js` | handle | port |
| 783 | a | nor a two-finger gesture | `ui/shell.test.js` | handle | port |
| 784 | a | and none of it is wired up outside iOS | `unit/misc.test.js` | import | port |
| 785 | d | on iOS the bottom inset is capped at the home indicator | `ui/shell.test.js` | provoke | **rewrite** set navigator.platform to iPhone before bootPage (IS_IOS is read at import): the root has --safe-bottom: min(env(safe-area-inset-bottom, 0px), 34px) |
| 786 | a | and not anywhere else | `ui/shell.test.js` | dom | port |
| 790 | a | settings carries a device readout (…) | `ui/settings.test.js` | handle | port |
| 791 | a | ending in the build stamp from the page's last-modified time | `ui/settings.test.js` | dom | port |
| 793 | d | on iOS the move listener is the kind that may cancel | `ui/shell.test.js` | provoke | **rewrite** on an iOS boot, a cancelable touchmove that drags down at the top of the page comes back defaultPrevented, which a passive listener could not do |

### chip rows keep their place across renders, and a tapped chip is brought into view

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 805 | a | the Search chip rows are named (…) | `ui/search.test.js` | handle | port |
| 806 | a | a render rebuilds the row | `ui/search.test.js` | handle | port |
| 807 | a | and puts it back where it was (… -> …) | `ui/search.test.js` | handle | port |
| 808 | d | the Now, Explore and Following rows are named too | `ui/search.test.js` | dom | **rewrite** render Now, Explore and Following: .chips[data-row] exists with now-hotel, explore-jump and follows |
| 813 | a | tapping a hotel chip brings that chip into view (…) | `ui/search.test.js` | provoke | **rewrite** give the tapped chip and its row rects that put the chip off the edge (stub getBoundingClientRect): the row's scrollTo is called once, with a left offset (replaces patching revealChip) |
| 814 | a | and it shows pressed | `ui/search.test.js` | dom | port |
| 817 | a | on Explore a chip is revealed when it becomes current, and only then (…) | `ui/explore.test.js` | provoke | **rewrite** same stubbed rects; markActiveSection('topic') twice then 'track': the jump row's scrollTo is called once per change of section, not per call |
| 820 | d | revealChip only moves the row sideways, never the page | `ui/search.test.js` | provoke | **rewrite** in 813's setup main.scrollTo is never called and main.scrollTop is unchanged: only the row moves (replaces matching a comment's wording) |

### an install nudge on Now until the app is on the home screen

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 838 | a | outside a home-screen install, Now opens with the nudge | `ui/nudge.test.js` | handle | port. shares the nudge boot; isStandalone is untouched in this row |
| 839 | a | and an installed app never shows it | `ui/nudge.test.js` | provoke | **rewrite** bootPage({matchMedia: q => /standalone/.test(q)}): isStandalone() is true from import, and Now has no #nudge (replaces reassigning isStandalone) |
| 840 | a | Not now hides it for a week | `ui/nudge.test.js` | handle | port. isStandalone untouched |
| 841 | a | after which it comes back | `ui/nudge.test.js` | handle | port. isStandalone untouched |
| 842 | a | the iOS copy covers the chat-app browser and never offers a button it cannot … | `unit/misc.test.js` | import | port. nudgeCopy is pure |
| 843 | a | with a browser install prompt in hand, Android gets a real Install button | `unit/misc.test.js` | import | port. nudgeCopy is pure |
| 844 | a | anything else gets the generic wording | `unit/misc.test.js` | import | port. nudgeCopy is pure |
| 845 | a | here, with no prompt captured, there is no Install button | `ui/nudge.test.js` | handle | port. isStandalone untouched |
| 846 | d | the browser install prompt is captured for the button to fire | `ui/nudge.test.js` | provoke | **rewrite** dispatch a cancelable beforeinstallprompt on window: it comes back defaultPrevented, Now gains [data-act=nudge-install], and tapping it calls the event's prompt() |

### last sweep: durations read as plans, the placeholder fits, offsite venues lose their marker

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 849 | a | minutes over an hour read as hours | `unit/time.test.js` | import | port |
| 857 | a | the mini-bar says hours for a pick … min out (…) | `ui/minibar.test.js` | handle | port |
| 859 | a | the search placeholder fits a phone (… chars) | `unit/query.test.js` | import | port |
| 860 | a | an offsite venue loses its O marker and nothing else does | `unit/venues.test.js` | import | port |
| 862 | a | a respelled room is the same place; a different room is not | `unit/venues.test.js` | import | port |
| 871 | a | a refresh that only respells the room makes no news | `ui/pick-news.test.js` | provoke | **rewrite** seed dc26.pickInfo with the room respelled, then boot: no .pick-news |

### the search box is never rebuilt under the keyboard

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 876 | a | the keyboard's return key reads Search | `ui/search.test.js` | handle | port |
| 879 | a | typing redraws the results but keeps the same input element | `ui/search.test.js` | handle | port |
| 880 | a | and the results did redraw | `ui/search.test.js` | dom | port |
| 882 | a | a full render keeps it too | `ui/search.test.js` | handle | port |
| 883 | a | while the day chips did update, to All days for a query | `ui/search.test.js` | dom | port |
| 885 | a | a query set by a chip shows in the same box | `ui/search.test.js` | handle | port |
| 888 | a | Enter puts the keyboard away by blurring the box | `ui/search.test.js` | dom | port |
| 890 | a | and clearing the query clears the box | `ui/search.test.js` | handle | port |

### a cancelled event says so, not just a strike-through

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 908 | a | the probe found its row in the on-now list | `ui/now.test.js` | handle | port |
| 909 | a | a cancelled event's row is struck through | `ui/now.test.js` | handle | port |
| 910 | a | and carries a Cancelled label | `ui/now.test.js` | handle | port |
| 911 | a | and the sheet says Cancelled under the room | `ui/now.test.js` | handle | port |
| 912 | b css | in the warning colour | `rules/styles.test.js` | rule | port |

### step 0: the nav - Browse renamed to Search, For you folded into Explore, Map added

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 917 | a | the nav reads Now · Search · Explore · Map · Mine (…) | `ui/shell.test.js` | dom | port |
| 919 | a | five tabs | `ui/shell.test.js` | dom | port |
| 933 | a | the word Browse is gone from what the reader sees | `ui/shell.test.js` | dom | port |
| 934 | a | the internal identifiers are unchanged | `ui/shell.test.js` | dom | port |
| 936 | a | the For you tab is gone | `ui/shell.test.js` | dom | port |
| 937 | a | and so is its view | `ui/shell.test.js` | dom | port |
| 938 | b lint | and nothing in the source still refers to it | `rules/source.test.js` | rule | port. history: a grep for 'foryou'; 936-937 are the observable half. Flagged as a delete candidate. PR 5: nothing replaces it |
| 939 | b css | the nav lays out five columns | `rules/styles.test.js` | rule | port |
| 940 | b css | with labels back at 14px (.875rem, so Larger text can scale them) | `rules/styles.test.js` | rule | port |
| 941 | b css | and icons back at 24px | `rules/styles.test.js` | rule | port |
| 944 | a | the explore tab switches | `ui/shell.test.js` | handle | port |
| 945 | a | and its view shows | `ui/shell.test.js` | dom | port |
| 946 | a | while the others hide | `ui/shell.test.js` | dom | port |

### step 1: the follow model

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 951 | a | four kinds of follow | `unit/misc.test.js` | import | port |
| 953 | a | following returns true | `ui/follows.test.js` | handle | port |
| 954 | a | and it is now followed | `ui/follows.test.js` | handle | port |
| 955 | a | it persisted | `ui/follows.test.js` | dom | port |
| 956 | a | with its kind | `ui/follows.test.js` | dom | port |
| 957 | a | and its exact key | `ui/follows.test.js` | dom | port |
| 958 | a | unfollowing returns false | `ui/follows.test.js` | handle | port |
| 959 | a | and it is gone | `ui/follows.test.js` | handle | port |
| 960 | a | the removal persisted too | `ui/follows.test.js` | dom | port |
| 963 | a | follows keep the order they were added | `ui/follows.test.js` | handle | port |
| 964 | a | a follow has a stable id | `ui/follows.test.js` | handle | port. followId is pure; follows[0] comes from handle.follows.get() |
| 966 | a | malformed stored follows are dropped on load | `ui/follows.test.js` | provoke | **rewrite** seed dc26.follows with the four junk entries, then boot: handle.follows.get() holds the one valid follow. As written the harness filters with its own copy of the rule and never runs the app's |
| 977 | a | a track follow finds its events (…) | `ui/follows.test.js` | handle | port |
| 978 | a | and only its events | `ui/follows.test.js` | handle | port |
| 983 | a | a fandom follow finds its events (…) | `ui/follows.test.js` | handle | port |
| 984 | a | and only those | `ui/follows.test.js` | handle | port |
| 988 | a | a topic follow finds its events (…) | `ui/follows.test.js` | handle | port |
| 992 | a | a person follow finds their events (…) | `ui/follows.test.js` | handle | port |
| 993 | a | and only theirs | `ui/follows.test.js` | handle | port |
| 996 | a | an unknown key finds nothing | `ui/follows.test.js` | handle | port |
| 997 | a | and so does a malformed follow | `ui/follows.test.js` | handle | port |
| 999 | a | a follow's events come back in time order | `ui/follows.test.js` | handle | port |

### step 2: Explore

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1011 | a | the sections that have content render (…) | `ui/explore.test.js` | handle | port |
| 1012 | a | and are named from the five sections | `ui/explore.test.js` | dom | port |
| 1013 | a | in the order Tracks, Fandoms, Topics, Guests, Panelists | `ui/explore.test.js` | dom | port |
| 1014 | a | an empty section is skipped rather than shown empty | `ui/explore.test.js` | dom | port |
| 1015 | a | fandom tiles need 3+ events | `ui/explore.test.js` | handle | port |
| 1016 | a | tracks run A to Z | `ui/explore.test.js` | handle | port |
| 1018 | a | with the photo and video-room tracks last | `ui/explore.test.js` | handle | port |
| 1020 | a | fandoms stay sorted by count | `ui/explore.test.js` | handle | port |
| 1022 | a | panelists run A to Z | `ui/explore.test.js` | handle | port |
| 1024 | a | guests and panelists together are everyone followable | `ui/explore.test.js` | handle | port |
| 1027 | a | each tile shows a count | `ui/explore.test.js` | dom | port |
| 1037 | a | Tracks opens with its head (… of …) | `ui/explore.test.js` | handle | port |
| 1038 | a | and offers Show all … (…) | `ui/explore.test.js` | handle | port |
| 1039 | a | no section shows more than its head to start | `ui/explore.test.js` | handle | port |
| 1042 | a | the fixture has enough tracks to fold | `ui/explore.test.js` | dom | port |
| 1048 | a | Show all opens every track (…) and the button goes | `ui/explore.test.js` | handle | port |
| 1049 | a | without rebuilding the filter box | `ui/explore.test.js` | dom | port |
| 1050 | a | and the choice holds for this visit | `ui/explore.test.js` | handle | port |
| 1053 | a | a jump chip per rendered section, in order (…) | `ui/explore.test.js` | handle | port |
| 1054 | a | each chip carries its count | `ui/explore.test.js` | dom | port |
| 1058 | a | tapping a chip scrolls to its section | `ui/explore.test.js` | provoke | **rewrite** give main a scrollTo spy (the app prefers it when present): tapping a jump chip calls it once with top >= 0 (replaces patching pageScrollTo) |
| 1061 | a | a tapped chip is pressed at once, and only it (…) | `ui/explore.test.js` | dom | port |
| 1062 | a | the section on screen is the last header past the sticky line | `unit/misc.test.js` | import | port |
| 1064 | a | above the first header nothing is pressed | `unit/misc.test.js` | import | port |
| 1065 | a | and no headers means nothing pressed | `unit/misc.test.js` | import | port |
| 1066 | a | at the end of the page the last section is current even if its header never r… | `unit/misc.test.js` | import | port |
| 1070 | a | a render marks exactly one chip from the headers' positions (…) | `ui/explore.test.js` | handle | port |
| 1071 | b css | and the count stays readable on a pressed chip | `rules/styles.test.js` | rule | port |
| 1077 | a | the filter narrows the tiles (… -> …) | `ui/explore.test.js` | handle | port |
| 1078 | a | to those whose name matches | `ui/explore.test.js` | dom | port |
| 1083 | a | typing in the filter keeps the same input element | `ui/explore.test.js` | handle | port |
| 1085 | a | and narrows the tiles (…) | `ui/explore.test.js` | dom | port |
| 1087 | a | clearing it brings everything back | `ui/explore.test.js` | handle | port |
| 1092 | a | the tile opens its page (…) | `ui/explore.test.js` | handle | port |
| 1093 | a | labelled with its kind | `ui/explore.test.js` | dom | port |
| 1094 | a | and its total count | `ui/explore.test.js` | dom | port |
| 1095 | a | events are grouped under day headers | `ui/explore.test.js` | dom | port |
| 1096 | a | with standard rows | `ui/explore.test.js` | dom | port |
| 1097 | a | that carry a star | `ui/explore.test.js` | dom | port |
| 1100 | a | the page offers Follow | `ui/explore.test.js` | dom | port |
| 1102 | a | which becomes Following | `ui/explore.test.js` | dom | port |
| 1103 | a | and the follow is recorded | `ui/explore.test.js` | handle | port |
| 1105 | a | the page is deep-linked (…) | `ui/explore.test.js` | dom | port |
| 1106 | a | and the link parses back | `ui/explore.test.js` | handle | port |
| 1109 | a | back returns to the grid | `ui/explore.test.js` | handle | port |
| 1110 | a | and clears the deep link | `ui/explore.test.js` | dom | port |
| 1111 | a | the followed tile carries a mark | `ui/explore.test.js` | dom | port |
| 1118 | a | the detail sheet offers See all beside a speaker | `ui/explore.test.js` | handle | port |
| 1119 | a | pointing at that person's page | `ui/explore.test.js` | dom | port |
| 1121 | a | and tapping it lands on the person page | `ui/explore.test.js` | handle | port |
| 1123 | a | with the sheet closed behind it | `ui/explore.test.js` | dom | port |

### step 3: Following lives at the top of Explore

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1133 | a | with nothing followed there is no Following section | `ui/follows.test.js` | handle | port |
| 1134 | a | and no empty state | `ui/follows.test.js` | dom | port |
| 1135 | a | Explore is just the grid | `ui/follows.test.js` | dom | port |
| 1137 | a | with a one-line hint | `ui/follows.test.js` | dom | port |
| 1139 | a | sitting under the first section header | `ui/follows.test.js` | dom | port |
| 1151 | a | following two things puts a Following section on Explore | `ui/follows.test.js` | handle | port |
| 1152 | a | and the hint goes away | `ui/follows.test.js` | dom | port |
| 1153 | a | headed Following (2) (…) | `ui/follows.test.js` | dom | port |
| 1154 | a | open to start | `ui/follows.test.js` | dom | port |
| 1155 | a | pinned above everything else | `ui/follows.test.js` | dom | port |
| 1158 | a | the tile filter box stays with the grid, below it | `ui/follows.test.js` | dom | port |
| 1159 | a | and so do the tiles | `ui/follows.test.js` | dom | port |
| 1161 | a | chips list the follows in order (…) | `ui/follows.test.js` | handle | port |
| 1162 | a | each chip has an unfollow control | `ui/follows.test.js` | dom | port |
| 1163 | a | and there is a + chip at the end | `ui/follows.test.js` | dom | port |
| 1164 | a | a chip links to its Explore page | `ui/follows.test.js` | handle | port |
| 1166 | a | By interest is the default | `ui/follows.test.js` | handle | port |
| 1168 | a | a section per follow inside Following (…) | `ui/follows.test.js` | dom | port |
| 1169 | a | in follow order | `ui/follows.test.js` | handle | port |
| 1171 | a | each section shows at most eight to start | `ui/follows.test.js` | dom | port |
| 1176 | a | and 'more' expands it | `ui/follows.test.js` | dom | port |
| 1180 | a | the layout toggles | `ui/follows.test.js` | handle | port |
| 1181 | a | and persists | `ui/follows.test.js` | dom | port |
| 1183 | a | by time lists each event once (…) | `ui/follows.test.js` | handle | port |
| 1184 | a | grouped under day headers | `ui/follows.test.js` | dom | port |
| 1185 | a | and hour headers | `ui/follows.test.js` | dom | port |
| 1186 | a | the grid is still there under it | `ui/follows.test.js` | dom | port |
| 1193 | a | starring works from Following | `ui/follows.test.js` | handle | port |
| 1200 | a | the + chip stays on the Explore grid | `ui/follows.test.js` | handle | port. reads state only; shares 1201's tap |
| 1201 | a | and scrolls to the grid (…) | `ui/follows.test.js` | provoke | **rewrite** main.scrollTo spy: tapping + calls it once with top >= 0 (replaces patching pageScrollTo) |
| 1202 | a | with Following still open above it | `ui/follows.test.js` | dom | port |
| 1205 | a | tapping the header closes Following | `ui/follows.test.js` | dom | port |
| 1206 | a | hiding the feed | `ui/follows.test.js` | dom | port |
| 1207 | a | chips and all | `ui/follows.test.js` | dom | port |
| 1208 | a | the header still shows the count | `ui/follows.test.js` | dom | port |
| 1209 | a | and the grid is right there | `ui/follows.test.js` | dom | port |
| 1210 | a | closed is remembered | `ui/follows.test.js` | dom | port |
| 1212 | a | and survives reloading the state | `ui/follows.test.js` | handle | port |
| 1214 | a | tapping again reopens it | `ui/follows.test.js` | dom | port |
| 1215 | a | and remembers that too | `ui/follows.test.js` | dom | port |
| 1220 | a | unfollowing from a chip removes its section | `ui/follows.test.js` | dom | port |
| 1221 | a | and the header count drops (…) | `ui/follows.test.js` | dom | port |
| 1222 | a | and the follow itself | `ui/follows.test.js` | handle | port |
| 1227 | a | a deep link opens its page (…) | `ui/follows.test.js` | handle | port |
| 1228 | a | the page stands alone, without the Following section | `ui/follows.test.js` | dom | port |
| 1230 | a | back returns to the grid with Following on top | `ui/follows.test.js` | dom | port |
| 1231 | a | the URL keeps the simulated clock and drops the page | `ui/follows.test.js` | dom | port |
| 1234 | a | unfollowing the last one removes the section | `ui/follows.test.js` | dom | port |
| 1235 | a | and the hint is back | `ui/follows.test.js` | dom | port |

### step 4: picks are untouched by any of this

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1239 | d | togglePick still exists | `ui/minibar.test.js` |  | **delete** `typeof togglePick === 'function'` is existence by name; 52 stars through it |
| 1240 | d | with the anchoring signature the star fix gave it | `ui/minibar.test.js` |  | **delete** matches togglePick's parameter list; the anchoring behaviour is 53 |
| 1241 | d | the mini-bar still reads picks, not follows | `ui/minibar.test.js` | handle | **rewrite** follow a track that has events later today, with no picks: the mini-bar stays hidden off Now |
| 1242 | d | and knows nothing about follows | `ui/minibar.test.js` |  | **merge** with 1241: same behaviour; 1242 only re-reads the function's text |
| 1244 | d | nor does the hero card | `ui/now.test.js` | handle | **rewrite** follow a track that has events later today, with no picks: Now has no hero |
| 1246 | a | picks storage is its own key | `ui/minibar.test.js` |  | **merge** with 38: the condition is `length >= 0`, which cannot fail; 38 is the assertion that dc26.picks is the key |

### browse header: All first, and the key rows stay put

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1251 | a | "All days" leads the day row (…) | `ui/search.test.js` | dom | port |
| 1253 | a | the hotel row still leads with All, so the two rows match | `ui/search.test.js` | dom | port |
| 1254 | a | the six con days follow it, in order | `ui/search.test.js` | handle | port |
| 1258 | a | the search box and day row share a sticky container | `ui/search.test.js` | dom | port |
| 1259 | a | the search box is inside it | `ui/search.test.js` | dom | port |
| 1260 | a | the day chips are inside it | `ui/search.test.js` | dom | port |
| 1261 | a | the hotel row is not - it scrolls away | `ui/search.test.js` | dom | port |
| 1262 | a | nor the kind row | `ui/search.test.js` | dom | port |
| 1263 | b css | it is declared sticky | `rules/styles.test.js` | rule | port |
| 1264 | b css | it parks under the header, by measured height | `rules/styles.test.js` | rule | port |
| 1265 | d | the header height is measured, not assumed | `ui/shell.test.js` | dom | **rewrite** after boot the root carries --hdr-h (0px in jsdom: measured, not a constant) |
| 1266 | d | and re-measured when the header changes size | `ui/shell.test.js` | provoke | **rewrite** stub window.ResizeObserver before boot: it observes .hdr, and calling its callback with .hdr's rect stubbed to 80px sets --hdr-h: 80px |
| 1272 | d | the header is re-measured when the freshness line changes it | `ui/shell.test.js` | provoke | **rewrite** with .hdr's rect stubbed, updateFresh() re-measures: --hdr-h follows |
| 1274 | d | and once the font has loaded and changed the text metrics | `ui/shell.test.js` | provoke | **rewrite** define document.fonts.ready before boot: when it resolves --hdr-h is re-measured |
| 1276 | d | and on load, so it never rests on the observer alone | `ui/shell.test.js` | provoke | **rewrite** dispatch load on window: --hdr-h is re-measured |

### offline: what jsdom can actually reach

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1282 | c | sw.js parses | `build.test.js` | build | port |
| 1283 | c | sw.js parses:  | `build.test.js` | build | port. never runs: the catch arm of 1282 |
| 1284 | c | index.html registers ./sw.js by relative path (scope stays under /dragoncon-p… | `build.test.js` | build | port |
| 1286 | c | registration is guarded by a serviceWorker capability check | `build.test.js` | build | port |
| 1288 | d | a failed registration is reported, not swallowed | `ui/offline.test.js` | provoke | **rewrite** make the stub's register() reject and dispatch load: console.warn is called with 'Offline support unavailable' |
| 1290 | c | the cache name is versioned (v4) under a prefix the build can stamp, and only… | `build.test.js` | build | port |
| 1292 | c | the Apple touch icon is a PNG, not the SVG iOS ignores | `build.test.js` |  | **merge** with build.test.js case 6, which already asserts this exact <link> |
| 1293 | c | the home-screen title is DC26 | `build.test.js` | build | port |
| 1295 | c | the head carries … | `build.test.js` | build | port. ×5 (one per og: tag) |
| 1297 | c | og:image is an absolute URL on the Pages site | `build.test.js` | build | port |
| 1298 | c | and the card is the large-image kind | `build.test.js` | build | port |
| 1301 | c | the manifest offers 192 and 512 PNGs, any and maskable | `build.test.js` | build | port |
| 1305 | c | … exists and is a PNG (… bytes) | `build.test.js` | build | port. ×4 in a loop |
| 1307 | c | the worker precaches the icons | `build.test.js` | build | port |
| 1309 | c | the html fetch stores its response whenever it lands | `build.test.js` | build | port |
| 1311 | c | and is kept alive past the response with waitUntil | `build.test.js` | build | port |
| 1312 | c | while the race uses that same fetch rather than a second one | `build.test.js` | build | port |
| 1313 | c | older caches under this site's prefix are deleted on activate | `build.test.js` | build | port |
| 1314 | c | the html network race times out at 3s | `build.test.js` | build | port |
| 1315 | c | the worker only announces an update when generated_at actually changed | `build.test.js` | build | port |
| 1317 | c | font requests are cached, opaque allowed | `build.test.js` | build | port |
| 1321 | c | the background revalidation is kept alive with waitUntil | `build.test.js` | build | port |
| 1322 | c | and waitUntil is called synchronously in the fetch handler, before respondWith | `build.test.js` | build | port |
| 1324 | c | the version that could be killed mid-check is gone | `build.test.js` | build | port |
| 1327 | c | manifest names the app | `build.test.js` | build | port |
| 1328 | c | manifest is standalone from ./ | `build.test.js` | build | port |
| 1329 | c | manifest colours match the app | `build.test.js` | build | port |
| 1330 | c | manifest points at the icon | `build.test.js` | build | port |
| 1331 | c | index.html links the manifest | `build.test.js` |  | **merge** with build.test.js case 6, which already asserts this exact <link> |
| 1332 | c | index.html sets a PNG apple-touch-icon | `build.test.js` |  | **merge** with 1292: the same regex twice |
| 1333 | c | the icon file exists | `build.test.js` | build | port |
| 1337 | a | the update pill starts hidden | `ui/offline.test.js` | dom | port |
| 1339 | a | a schedule-updated message shows the pill | `ui/offline.test.js` | provoke | **rewrite** a `message` event on the navigator.serviceWorker stub, {type: 'schedule-updated'}: the pill shows (the harness called showUpdatePill() directly) |
| 1340 | a | the pill says what tapping does | `ui/offline.test.js` | dom | port |
| 1344 | a | showing the pill does not re-render the list | `ui/offline.test.js` | observe | **rewrite** MutationObserver on #view-browse while the message arrives: no mutation |
| 1349 | a | tapping the pill reloads | `ui/offline.test.js` | provoke | **rewrite** bootPage({reload: spy}): tapping the pill calls it once (replaces patching window.reloadNow) |
| 1352 | a | a swipe does not trigger the reload | `ui/offline.test.js` | provoke | **rewrite** touchstart, a touchmove of more than 6px and touchend on the pill, then click: the reload spy is not called (replaces writing pillDragged) |
| 1356 | a | the pill can be dismissed | `ui/offline.test.js` | handle | port. hideUpdatePill is exported; the pillDragged reset before it was the harness tidying up |
| 1360 | a | no offline marker while the network is fine | `ui/offline.test.js` | dom | port |
| 1363 | c | the worker reports offline when revalidation fails | `build.test.js` | build | port |
| 1365 | c | the worker reports back online when it succeeds | `build.test.js` | build | port |
| 1366 | d | the page marks itself offline on that message | `ui/offline.test.js` |  | **merge** with 1371: 1371's rewrite sends the schedule-offline message and reads the line; this row only matched the handler's text |
| 1368 | d | and clears the marker when the worker gets through | `ui/offline.test.js` |  | **merge** with 1375: 1375's rewrite sends the schedule-online message and reads the line; this row only matched the handler's text |
| 1371 | a | a cached copy is labelled (…) | `ui/offline.test.js` | provoke | **rewrite** a `message` event on the navigator.serviceWorker stub, {type: 'schedule-offline'}: the freshness line says offline copy (replaces writing servedOffline) |
| 1373 | a | the existing freshness line survives | `ui/offline.test.js` | dom | port. read after 1371's message |
| 1375 | a | the marker clears when back online | `ui/offline.test.js` | provoke | **rewrite** a `message` event on the navigator.serviceWorker stub, {type: 'schedule-online'}: the marker clears (replaces writing servedOffline) |

### Map, step 1: the base map

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1380 | a | the Map tab shows its own view | `ui/map.test.js` | dom | port |
| 1383 | a | one SVG, framed to the drawing (385 by 305) | `ui/map.test.js` | dom | port |
| 1386 | a | one block per walk-table hotel (…) | `ui/map.test.js` | handle | port |
| 1387 | a | no block for Other, Streaming or Unknown | `ui/map.test.js` | dom | port |
| 1393 | a | east of Peachtree: Hyatt, Marriott, Hilton, left to right | `ui/map.test.js` | dom | port |
| 1394 | a | the three sit in one row | `ui/map.test.js` | dom | port |
| 1395 | a | Peachtree runs between the Mart and the Hyatt, a quarter of the way across (…) | `ui/map.test.js` | dom | port |
| 1396 | a | the Westin is south-east of the Mart, which is level with the Hyatt | `ui/map.test.js` | dom | port |
| 1397 | a | the Courtland is below the Hilton, in its column | `ui/map.test.js` | dom | port |
| 1398 | a | Hardy Ivy Park is above the Hyatt | `ui/map.test.js` | dom | port |
| 1403 | a | the Hyatt and the Marriott nearly touch (… px apart) | `ui/map.test.js` | dom | port |
| 1404 | a | the Hilton is a real walk from the Marriott (… px) | `ui/map.test.js` | dom | port |
| 1405 | a | the Westin is south-east of the Mart and still west of Peachtree (right edge … | `ui/map.test.js` | dom | port |
| 1407 | a | the Westin is about as far below the Hyatt as the park is above it (… vs …) | `ui/map.test.js` | dom | port |
| 1408 | a | the Courtland sits under the Hilton (… vs …) | `ui/map.test.js` | dom | port |
| 1410 | a | the Marriott-Hilton bridge crosses Courtland St (… to … over …) | `ui/map.test.js` | dom | port |
| 1413 | a | the Mart-Westin bridge is a short diagonal from the Mart's bottom edge to the… | `ui/map.test.js` | dom | port |
| 1416 | a | the Hyatt-Marriott bridge spans just the gap | `ui/map.test.js` | dom | port |
| 1417 | a | hotel blocks are 60 wide | `ui/map.test.js` | dom | port |
| 1420 | a | the frame is cropped to the drawing with a card's padding around it (…) | `ui/map.test.js` | dom | port |
| 1421 | a | the streets span the cropped height | `ui/map.test.js` | dom | port |
| 1423 | a | the street labels sit inside the frame, above the row (…) | `ui/map.test.js` | dom | port |
| 1425 | a | the ground fills the frame | `ui/map.test.js` | dom | port |
| 1427 | a | three skybridges, none across Peachtree (…) | `ui/map.test.js` | dom | port |
| 1428 | b css | skybridges are dashed | `rules/styles.test.js` | rule | port |
| 1429 | a | two streets and nothing else | `ui/map.test.js` | dom | port |
| 1430 | a | Courtland St is the fainter one | `ui/map.test.js` | dom | port |
| 1432 | a | labels are abbreviated and uppercase (…) | `ui/map.test.js` | dom | port |
| 1433 | a | a nine-letter label takes a smaller size to fit a 60 px block; eight letters … | `ui/map.test.js` | dom | port. split: dom half (which label has .long) stays; `.map-hotel text.long` size → styles rule |
| 1436 | a | the park wears green, not a hotel hue | `ui/map.test.js` | dom | port |
| 1437 | a | each hotel wears its own hue | `ui/map.test.js` | dom | port |
| 1438 | b css | labels use the app font and blocks are an opaque low tint of their hue with a… | `rules/styles.test.js` | rule | port |

### Map, step 2: day chips

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1443 | a | a day chip row sits above the map | `ui/map.test.js` | dom | port |
| 1445 | a | it lists the con days as the same chips Search uses (…) | `ui/map.test.js` | handle | port |
| 1447 | a | with the same short labels | `ui/map.test.js` | dom | port |
| 1449 | a | untouched, it follows the clock: Saturday at the Saturday preview | `ui/map.test.js` | handle | port |
| 1452 | a | tapping Sun selects Sunday and the map below follows | `ui/map.test.js` | handle | port |
| 1457 | a | 1 AM Sunday is still Saturday on the map | `ui/map.test.js` | handle | port |
| 1460 | a | a new preview time lets the map follow the clock again | `ui/map.test.js` | handle | port |
| 1461 | d | the row is named, so it keeps its place across renders | `ui/map.test.js` | dom | **rewrite** .chips[data-row=map-day] is in the rendered Map tab (1442 already finds it; this asserts the attribute by name) |

### Map, step 3: pick pills and the hotel sheet

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1470 | a | four test picks: two Hyatt and one Marriott on Saturday, one Hilton on Sunday… | `ui/map.test.js` | handle | port |
| 1472 | a | pills count Saturday's picks per hotel and hide at zero (…) | `ui/map.test.js` | dom | port |
| 1476 | a | the pill sits on the block's top-right corner | `ui/map.test.js` | dom | port |
| 1477 | b css | pills are the mine gold | `rules/styles.test.js` | rule | port |
| 1478 | a | each block says what it holds | `ui/map.test.js` | dom | port |
| 1481 | a | Sunday shows Sunday's pills (…) | `ui/map.test.js` | dom | port |
| 1483 | a | and Saturday shows Saturday's again | `ui/map.test.js` | dom | port |
| 1488 | a | tapping a hotel opens the hotel sheet | `ui/map.test.js` | dom | port |
| 1489 | a | headed by the hotel's name | `ui/map.test.js` | dom | port |
| 1492 | a | with the Hyatt picks that day, in time order | `ui/map.test.js` | handle | port |
| 1493 | a | as standard rows with stars | `ui/map.test.js` | dom | port |
| 1494 | a | and a line saying which day and how many | `ui/map.test.js` | dom | port |
| 1497 | a | a row opens the event sheet | `ui/map.test.js` | handle | port. byId → handle.events.find |
| 1502 | a | unstarring in the sheet drops the row and the pill behind (…) | `ui/map.test.js` | handle | port |
| 1504 | a | unstarring the last one shows the empty state and the pill goes | `ui/map.test.js` | handle | port |
| 1508 | a | tapping a pill opens that hotel's sheet | `ui/map.test.js` | handle | port |
| 1513 | a | an empty hotel says so and offers a search (…) | `ui/map.test.js` | handle | port |
| 1515 | a | the button switches to Search | `ui/map.test.js` | handle | port |
| 1516 | a | with the hotel and the day as filters | `ui/map.test.js` | handle | port |
| 1517 | a | and the chips show them pressed | `ui/map.test.js` | dom | port |
| 1518 | a | listing that hotel's Saturday | `ui/map.test.js` | handle | port |
| 1519 | a | the park takes no article; the Mart is the Mart | `unit/venues.test.js` | import | port |
| 1523 | a | blocks are buttons: Enter opens the sheet | `ui/map.test.js` | handle | port |

### Map, step 4: now and next

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1538 | a | today: a ring on the on-now hotel and one on the next (…) | `ui/map.test.js` | handle | port |
| 1539 | b css | rings are gold and the next one pulses | `rules/styles.test.js` | rule | port |
| 1540 | b css | and holds still under reduced motion | `rules/styles.test.js` | rule | port |
| 1541 | a | no dashed line and no route, in the SVG or the source: the rings, the pills a… | `ui/map.test.js` | dom | port. split: dom half (no .map-leave, no .map-route) stays; the source/page grep for removed names is history → deleted |
| 1544 | a | rings over the blocks, pills over everything | `ui/map.test.js` | dom | port |
| 1548 | a | the card under the map says when to leave the building you are in (…) | `ui/map.test.js` | handle | port |
| 1550 | a | directly under the SVG sits the card | `ui/map.test.js` | dom | port |
| 1553 | a | no rings on another day; the card stays, it is about now | `ui/map.test.js` | dom | port |
| 1557 | a | with nowhere to leave from, the next ring stays and the card counts down (…) | `ui/map.test.js` | handle | port |
| 1561 | a | with no next pick, only the now ring; the On now line stays and the card says… | `ui/map.test.js` | handle | port |
| 1562 | d | the minute tick goes through tickMap | `ui/map.test.js` | provoke | **rewrite** fake timers: advance the app's own 60-second interval on the Map tab with a new pick in another hotel: the pills change; with nothing new the <svg> node is the same node |

### Map fixes

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1578 | a | found a pair to be late for | `ui/map.test.js` | handle | port |
| 1580 | a | late: the card says leave now (…) | `ui/map.test.js` | handle | port |
| 1581 | a | in the warn colour | `ui/map.test.js` | dom | port. split: dom half (.nc-when.late exists) stays; its colour → styles rule |
| 1591 | a | found a stream to pick next | `ui/map.test.js` | handle | port |
| 1592 | a | a streaming next shows Streaming as its room, counts down, and gets no next r… | `ui/map.test.js` | handle | port |
| 1595 | a | and the pick off the map is counted right under the card (…) | `ui/map.test.js` | dom | port |
| 1599 | a | an offsite next shows its venue as the room (…; …) | `ui/map.test.js` | handle | port |
| 1606 | a | ten picks at the Courtland make a two-digit pill | `ui/map.test.js` | handle | port |
| 1607 | a | and it stays inside the canvas (right edge …) | `ui/map.test.js` | dom | port |
| 1608 | a | no off-map line when every pick is on the map | `ui/map.test.js` | dom | port |
| 1612 | a | two ticks with nothing new draw nothing (… renders) | `ui/map.test.js` | observe | **rewrite** MutationObserver on #view-map around tickMap(): two quiet ticks return false and mutate nothing (replaces the renderMap counter) |
| 1614 | a | a change in the counts draws once, and the next quiet tick draws nothing | `ui/map.test.js` | observe | **rewrite** MutationObserver on #view-map around tickMap(): a new pick makes tickMap() return true with one batch of mutations; the next quiet tick mutates nothing |

### polish 1: a compact header

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1619 | a | the clock and the freshness text share one line | `ui/shell.test.js` | handle | port |
| 1620 | b css | in the clock style at a smaller size that follows the phone's width, and it n… | `rules/styles.test.js` | rule | port |
| 1622 | a | when the line would clip, the word refreshed goes first, by measurement | `ui/shell.test.js` | dom | port. split: dom half (#fresh .word) stays; `.hdr-line.tight .word` → styles rule; the two source regexes → provoke: stub .hdr-line scrollWidth > clientWidth, updateClock() adds .tight |
| 1625 | b css | and if that is not enough, the line steps down a size | `rules/styles.test.js` | rule | port. split: styles rule stays; the source regex → provoke: still clipped after .tight, the line gains .tighter |
| 1626 | a | the freshness text reads as the rest of the line (…) | `ui/shell.test.js` | dom | port |
| 1629 | a | the brand shows on Now as a small label | `ui/shell.test.js` | handle | port. split: dom half (brand text, shown on Now) stays; `.hdr .brand` size → styles rule |
| 1630 | a | above the line | `ui/shell.test.js` | dom | port |
| 1631 | a | and not on … | `ui/shell.test.js` | handle | port. ×4 in a loop |
| 1632 | d | the header is re-measured when the brand comes and goes | `ui/shell.test.js` | provoke | **rewrite** with .hdr's rect stubbed to differ by tab, switching tabs re-measures --hdr-h |

### polish 2: sticky map chips, and a map that fits the screen

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1638 | a | the day chips sit in the same sticky strip Search uses | `ui/map.test.js` | handle | port |
| 1639 | a | and the map itself scrolls under it | `ui/map.test.js` | dom | port |
| 1640 | b css | width first: the SVG takes the content width and its own height, and shrinks,… | `rules/styles.test.js` | rule | port |
| 1643 | b css | the card's padding matches the frame's inset around the drawing | `rules/styles.test.js` | rule | port |
| 1644 | b css | no chrome arithmetic remains; the mini-bar never shows here | `rules/styles.test.js` | rule | port |
| 1645 | a | the card band sits under the SVG and keeps its own height | `ui/map.test.js` | dom | port. split: dom half (.map-under follows the svg) stays; `.map-under { flex: none` → styles rule |
| 1647 | a | with the frame's viewBox | `ui/map.test.js` |  | **merge** with 1383: same viewBox, same value |

### polish 3: no mini-bar on the Map tab

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1658 | a | with a pick later today the mini-bar shows on Search, Explore and Mine | `ui/minibar.test.js` | handle | port |
| 1659 | a | but not on the Map, whose caption already says what is next, and the body res… | `ui/minibar.test.js` | handle | port |
| 1660 | a | nor on Now, as before | `ui/minibar.test.js` | handle | port |

### polish 5: refresh on foreground

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1682 | a | a return within 15 minutes of the last check asks for nothing (… fetches) | `ui/offline.test.js` | provoke | **rewrite** fetch stubbed; visibilitychange straight after boot: no fetch (loading was a check) |
| 1683 | a | after the interval, two visibility events in a row make one check, of data/20… | `ui/offline.test.js` | provoke | **rewrite** handle.setTimeOverride(+16 min) moves now() past the gate (a simulated clock stands still, which is why the harness wrote lastScheduleCheck): two visibilitychange events make one fetch of data/2026/events.json, cache: no-cache |
| 1684 | a | an unchanged schedule shows no pill and leaves the freshness alone | `ui/offline.test.js` | provoke | **rewrite** same run: the reply's generated_at is unchanged, so no pill and the same freshness text |
| 1685 | a | pageshow checks too, and a newer generated_at shows the pill and updates the … | `ui/offline.test.js` | provoke | **rewrite** setTimeOverride(+32 min), a newer generated_at in the reply, pageshow: second fetch, pill shown, handle.meta.generated_at is the newer one |
| 1687 | d | the check never re-renders under the reader; the pill offers the reload | `ui/offline.test.js` | observe | **rewrite** MutationObserver on main during 1685's recheck: nothing under main changes; only the pill and #fresh do |
| 1688 | d | the interval is 15 minutes, on visibilitychange and pageshow | `ui/offline.test.js` |  | **delete** matches RECHECK_MS and two addEventListener calls in the text; the behaviour is 1682, 1683 and 1685 |
| 1689 | d | with a worker, its schedule-updated message carries the new generated_at into… | `ui/offline.test.js` | provoke | **rewrite** a `message` event on the navigator.serviceWorker stub, {type: 'schedule-updated', generated_at: newer}: #fresh re-reads against the newer time and the pill shows |

### polish 6: Settings, the everyday two up top and the rest under Advanced

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1695 | a | Crowd factor and Hide photo sessions come first | `ui/settings.test.js` | handle | port |
| 1696 | a | and Larger text | `ui/settings.test.js` | dom | port |
| 1697 | a | then a collapsed Advanced section | `ui/settings.test.js` | dom | port |
| 1698 | a | holding the preview clock, the walk-time defaults and the device readout with… | `ui/settings.test.js` | dom | port |
| 1699 | a | the build stamp is still filled in behind the fold | `ui/settings.test.js` |  | **merge** with 791: same regex over the same #deviceLine |
| 1701 | a | outside Advanced only Done and Remove all picks remain, in that order (…) | `ui/settings.test.js` | dom | port |
| 1703 | a | Remove all picks is last, still destructive, outside Advanced and on its own … | `ui/settings.test.js` | dom | port |
| 1705 | b css | Advanced scrolls inside the sheet when it is long | `rules/styles.test.js` | rule | port |
| 1709 | a | opening Settings again leaves Advanced as you left it; the sheet does not for… | `ui/settings.test.js` | handle | port |

### polish 7: larger text

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1716 | a | a Larger text toggle sits with the everyday controls | `ui/settings.test.js` | handle | port |
| 1717 | a | off by default | `ui/settings.test.js` | dom | port |
| 1719 | a | on: the html element takes the class and the choice is saved as dc26.bigtext | `ui/settings.test.js` | dom | port |
| 1720 | b css | which sets the root size to 115% | `rules/styles.test.js` | rule | port |
| 1722 | a | off again, and saved | `ui/settings.test.js` | dom | port |
| 1723 | d | the saved choice is applied at startup, before the first paint | `ui/settings.test.js` | provoke | **rewrite** seed dc26.bigtext = true, then boot: <html> has the bigtext class before the first render |
| 1726 | b css | every text size outside the map's SVG is in rem, so it follows the root | `rules/styles.test.js` | rule | port |
| 1727 | b css | the map's labels stay in the SVG's own units, scaled with the drawing rather … | `rules/styles.test.js` | rule | port |
| 1728 | b lint | and no inline pixel size hides in a template | `rules/source.test.js` | rule | port. over src/app.js and index.html. PR 5: stays a rule test (a template-literal content check is not worth a custom ESLint rule) |
| 1729 | b css | timeline blocks that cannot hold their text give way by measurement: one-line… | `rules/styles.test.js` | rule | port. split: two styles rules stay; the two source regexes → provoke: stub a .tl-block's scrollHeight > clientHeight, render Mine: it gains .tight then .tighter |
| 1732 | b css | the hour gutter is in rem and its labels never wrap | `rules/styles.test.js` | rule | port |
| 1733 | d | toggling re-measures the header and re-renders, so the timeline refits | `ui/settings.test.js` | provoke | **rewrite** with a pick on Mine's timeline and .hdr's rect stubbed, toggling Larger text re-measures --hdr-h and replaces the .tl-block nodes |

### map card: the next pick under the map

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1765 | a | the card shows the next pick (…) | `ui/map.test.js` | handle | port. byId → handle.events.find |
| 1766 | a | room and hotel in the hotel's own hue, the same var as its block (…; …) | `ui/map.test.js` | handle | port. byId → handle.events.find |
| 1767 | a | the timing line is the start and how long until it (…) | `ui/map.test.js` | handle | port. byId → handle.events.find |
| 1768 | a | the walk estimate is a muted line when leaveInfo has one (…) | `ui/map.test.js` | handle | port. byId → handle.events.find |
| 1769 | a | nothing is on, so no On now line and no day label | `ui/map.test.js` | handle | port. byId → handle.events.find |
| 1771 | a | with a pick on in another hotel, the timing line says when to leave it (…) | `ui/map.test.js` | handle | port. byId → handle.events.find |
| 1772 | a | and a slim line above names what is on now (…) | `ui/map.test.js` | handle | port. byId → handle.events.find |
| 1773 | b css | truncated to one line | `rules/styles.test.js` | rule | port |
| 1774 | b css | leave-by in gold, warn colour when late | `rules/styles.test.js` | rule | port |
| 1776 | a | nothing left today: the first pick of tomorrow, labelled, time only (…: …) | `ui/map.test.js` | handle | port. byId → handle.events.find |
| 1777 | a | a pick two days out is labelled with its day (…) | `ui/map.test.js` | handle | port. byId → handle.events.find |
| 1778 | a | no picks at all: how to get one, and nothing to tap | `ui/map.test.js` | handle | port. byId → handle.events.find |
| 1779 | b css | the title is row style, up to two lines | `rules/styles.test.js` | rule | port |
| 1784 | a | tapping the card opens the event's detail sheet | `ui/map.test.js` | handle | port |
| 1789 | a | two quiet ticks draw nothing, so the pulse is not restarted | `ui/map.test.js` | observe | **rewrite** MutationObserver on #view-map around tickMap(): two quiet ticks mutate nothing, so the pulse is not restarted |
| 1794 | a | streamOnly ? "a change that touches only the card refreshes the card and leav… | `ui/map.test.js` | observe | **rewrite** MutationObserver on #view-map around tickMap(): a card-only change mutates #mapUnder and leaves the <svg> node identical |

### hotel names next to rooms

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1819 | a | a row reads hotel, dot, room, in the hotel's hue (…) | `ui/search.test.js` | handle | port |
| 1820 | a | and so does the detail sheet (…) | `ui/search.test.js` | handle | port |
| 1821 | a | a stream is just Streaming | `ui/search.test.js` | handle | port |
| 1822 | a | an offsite venue is itself, with no hotel part | `ui/search.test.js` | handle | port |
| 1823 | a | from the location, without its O marker, when the room is blank | `ui/search.test.js` | handle | port |
| 1824 | a | and Offsite when nothing names the venue | `ui/search.test.js` | handle | port |
| 1825 | a | a blank room shows the hotel alone | `ui/search.test.js` | handle | port |
| 1826 | a | no venue at all is Location TBA | `ui/search.test.js` | handle | port |
| 1827 | b css | in a row the room part may be shortened with an ellipsis, the hotel never | `rules/styles.test.js` | rule | port |

### perf: a query typed before the index is ready waits for it; typing draws once

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1842 | a | while the index builds the search box says so, quietly | `ui/search.test.js` | provoke | **rewrite** fake timers, boot, do not run them: the box reads 'indexing…' and carries .indexing. split: provoke half (fresh boot before the index: placeholder 'indexing…', .indexing class) → tests/ui/search.test.js; the placeholder colour → styles rule |
| 1843 | a | a query typed then is recorded and held, not run | `ui/search.test.js` | provoke | **rewrite** fake timers, boot, do not run them: the index does not exist yet. Type a query: state.browse.q holds it and no result is filtered (replaces nulling index and reading pendingQuery) |
| 1844 | a | a render meanwhile shows the list with a note, not a false empty | `ui/search.test.js` | provoke | **rewrite** same boot: handle.render() shows .indexing-note above a full list |
| 1845 | a | when the index is ready the held query is queued and the placeholder returns | `ui/search.test.js` | provoke | **rewrite** run the timers: the index builds, the placeholder is SEARCH_PLACEHOLDER again, the indexing class is gone and the held query draws |
| 1849 | a | and it runs once it can (… matches) | `ui/search.test.js` | handle | port |
| 1860 | a | … keystrokes draw once, … ms after the last (… renders) | `ui/search.test.js` | observe | **rewrite** MutationObserver on #view-browse while typing: nine keystrokes mutate nothing; after SEARCH_DEBOUNCE_MS there is one batch. SEARCH_DEBOUNCE_MS === 70 moves to tests/unit/query.test.js (import) |

### the hero, the mini-bar and the map card use the Hotel · Room convention

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1876 | a | the hero's room line reads hotel, dot, room (…) | `ui/leave.test.js` | handle | port |
| 1877 | a | and so does the mini-bar (…) | `ui/leave.test.js` | handle | port |
| 1878 | a | and the map's card, which used to put the room first (…) | `ui/leave.test.js` | handle | port |
| 1879 | d | one helper serves rows, sheet, hero, mini-bar and card | `ui/leave.test.js` |  | **delete** a removed helper's name plus a count of placeHTML( call sites; the behaviour is 1819-1826 and 1876-1878 |

### one clock: now(), the ?now= override, and the phase of the con

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1882 | d | now() is the one clock; getNow is gone | `ui/time.test.js` |  | **delete** `typeof getNow === 'undefined'` is history; DECISIONS #12 is the record and ESLint is the guard |
| 1883 | a | booted from ?now=, the clock is simulated and the chip shows | `ui/time.test.js` | handle | port |
| 1884 | a | the override is kept for the session | `ui/time.test.js` | dom | port |
| 1885 | a | the clock reads the simulated time, with no suffix (…) | `ui/time.test.js` | dom | port |
| 1890 | b lint | index.html has a Time section | `rules/source.test.js` |  | **merge** with 1892: it only locates the Time section that 1892's rule exempts |
| 1892 | b lint | no bare new Date() or Date.now() outside the Time section | `rules/source.test.js` | rule | port. PR 5: the no-restricted-syntax pair already in eslint.config.js, once src/time.js exists and src/app.js leaves its ignores |
| 1893 | b lint | the hash no longer carries the clock | `rules/source.test.js` | rule | port. history: a grep for the removed #now= hash; the behaviour is 1898 and 1231. Flagged as a delete candidate. PR 5: nothing replaces it |
| 1894 | d | the drag and the scroll-spy hold are stopwatch reads | `ui/time.test.js` | provoke | **rewrite** under a frozen ?now= clock with performance.now() faked: a fast flick still closes the sheet, and scroll events inside 700 ms of a jump-chip tap do not move the pressed chip |
| 1897 | a | an offset in the override is honoured | `ui/time.test.js` | handle | port |
| 1898 | a | the URL is kept in step and stays readable (…) | `ui/time.test.js` | dom | port |
| 1899 | a | and so is the session | `ui/time.test.js` | dom | port |
| 1901 | a | with the URL stripped, the session's override carries on | `ui/time.test.js` | provoke | **rewrite** boot with no ?now= and dc26.timeOverride in sessionStorage: isSimulated() and handle.now() is that moment (replaces calling initTimeOverride() a second time) |
| 1903 | a | clearing goes back to the wall clock, hides the chip, and cleans the URL and … | `ui/time.test.js` | handle | port |
| 1905 | a | now() is the wall clock again | `ui/time.test.js` | handle | port |
| 1907 | a | and back to Saturday, chip and all | `ui/time.test.js` | handle | port |
| 1909 | a | tapping the chip clears the override | `ui/time.test.js` | handle | port |
| 1912 | a | the Settings field shows the override (…) | `ui/time.test.js` | handle | port |
| 1915 | a | Apply preview time sets the override (…, …) | `ui/time.test.js` | dom | port |
| 1918 | a | Use real time clears it | `ui/time.test.js` | handle | port |
| 1922 | a | CON names the year and its bounds | `unit/time.test.js` | import | port |
| 1923 | a | before the first event: before | `unit/time.test.js` | import | port |
| 1924 | a | from the first start to the last end, inclusive: live | `unit/time.test.js` | import | port |
| 1925 | a | after the last event ends: ended | `unit/time.test.js` | import | port |
| 1926 | a | with no argument it reads now() | `ui/time.test.js` | handle | port |
| 1928 | a | before the con, the Thursday preview banner as before | `ui/time.test.js` | handle | port |
| 1929 | a | and the Now tab previews Thursday morning | `ui/time.test.js` | dom | port |

### archive mode: after the con

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1937 | a | the morning after the last event: ended | `ui/archive.test.js` | handle | port |
| 1939 | a | the banner says the con has ended and points at the schedule (…) | `ui/archive.test.js` | dom | port |
| 1940 | a | with a dismiss button | `ui/archive.test.js` | dom | port |
| 1941 | a | the Now tab has no hero, no on-now, no leave-by | `ui/archive.test.js` | dom | port |
| 1942 | a | it is headed Your 2026 schedule | `ui/archive.test.js` | dom | port |
| 1945 | a | every pick is listed, in time order (…) | `ui/archive.test.js` | handle | port |
| 1948 | a | grouped by day (…) | `ui/archive.test.js` | handle | port |
| 1949 | a | no on-now list and no install nudge under it | `ui/archive.test.js` | dom | port |
| 1951 | a | unstarring from the archive list removes the row | `ui/archive.test.js` | handle | port |
| 1953 | a | and starring brings it back | `ui/archive.test.js` | dom | port |
| 1955 | a | with no picks, an empty state that points at Search | `ui/archive.test.js` | dom | port |
| 1957 | a | the header calls the copy final (…) | `ui/archive.test.js` | dom | port |
| 1959 | a | no mini-bar on Search after the con | `ui/archive.test.js` | handle | port |
| 1960 | a | the banner is on every tab | `ui/archive.test.js` | dom | port |
| 1962 | a | search results have no Already happened fold: nothing is past when everything… | `ui/archive.test.js` | handle | port |
| 1963 | a | and no Today scope | `ui/archive.test.js` | dom | port |
| 1965 | a | the map has no next-pick card and no rings | `ui/archive.test.js` | handle | port |
| 1966 | a | the map still counts picks by hotel on its day chips | `ui/archive.test.js` | handle | port |
| 1968 | a | an Explore page lists everything plainly | `ui/archive.test.js` | handle | port |
| 1970 | a | Mine has no now-line, and export is still offered | `ui/archive.test.js` | handle | port |
| 1973 | a | dismissing hides the banner and remembers it for the year | `ui/archive.test.js` | handle | port |
| 1975 | a | and it stays dismissed | `ui/archive.test.js` | handle | port |
| 1978 | a | the minute tick leaves the archive list alone | `ui/archive.test.js` | handle | port |
| 1980 | a | a minute before the end it is still live | `ui/archive.test.js` | handle | port |
| 1982 | a | a minute after, the tick flips it to the archive with the banner | `ui/archive.test.js` | provoke | **rewrite** boot with no override, system time faked to 18:59 on the last day; advance two minutes: the app's own interval tick flips Now to the archive and shows the banner (replaces writing timeOverride) |
| 1984 | a | and Saturday afternoon is live again | `ui/archive.test.js` | handle | port |

### the dev-build mark: only on a build stamped with a channel

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 1987 | c | the source carries empty channel and build stamps | `build.test.js` |  | **merge** with build.test.js case 2, which already asserts both empty stamps in dist/index.html |
| 1988 | a | unstamped, there is no mark and no channel | `ui/devmark.test.js` | handle | port |
| 1989 | b lint | nothing in the page decides by hostname | `rules/source.test.js` | rule | port. PR 5: ESLint no-restricted-properties on location.host / hostname / origin |
| 1995 | a | stamped with a channel, the mark reads dev build · next · build (…) | `ui/devmark.test.js` | dom | port |
| 1996 | a | it is fixed, decorative, and takes no taps | `ui/devmark.test.js` | dom | port. split: dom half (aria-hidden on the mark) stays; two `.devmark` rules → styles rule |
| 1997 | b css | and it moves up above the mini-bar | `rules/styles.test.js` | rule | port |
| 1998 | a | the device readout names the channel and build | `ui/devmark.test.js` | handle | port |
| 1999 | a | and the page otherwise works as it does unstamped | `ui/devmark.test.js` | dom | port |
| 2000 | a | a stamped page keeps its simulated clock under a key of its own, so it never … | `ui/devmark.test.js` | handle | port |
| 2002 | a | and the unstamped page keeps the plain key | `ui/devmark.test.js` |  | **merge** with 2000: the unstamped half of the same key rule; one test boots both ways |

### realDataChecks: search quality and Explore against the real schedule

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 2029 | e | CON.start is the first listed event's start (… vs …) | `real-data.test.js` | handle | port |
| 2030 | e | CON.end is the last listed event's end (… vs …) | `real-data.test.js` | handle | port |
| 2053 | e | "star trek": everything above the fold is still to come (…) | `real-data.test.js` | handle | port |
| 2054 | e | no Friday events above the divider at Saturday 13:05 | `real-data.test.js` | handle | port |
| 2055 | e | past matches are kept, below the fold (…) | `real-data.test.js` | handle | port |
| 2058 | e | a query with plenty of AND matches shows no Looser section | `real-data.test.js` | handle | port |
| 2060 | e | "board games" narrows under AND (…, was ~1,300 under OR) | `real-data.test.js` | handle | port |
| 2061 | e | "board games" leads with real board-game rows (…) | `real-data.test.js` | handle | port |
| 2063 | e | a thin query has few AND matches | `real-data.test.js` | handle | port |
| 2073 | e | the Other chip covers both the streams and the offsite venues (…) | `real-data.test.js` | handle | port |
| 2081 | e | a tapped suggestion still returns results (…: …) | `real-data.test.js` | handle | port. `who` came from the internal suggestDocs; pick the busiest non-noise speaker from handle.events instead |
| 2082 | e | and nothing under a Looser divider | `real-data.test.js` | handle | port. who comes from handle.events, as 2081 |
| 2083 | e | every result for "…" actually features them | `real-data.test.js` | handle | port. who comes from handle.events, as 2081 |
| 2087 | d | match quality is computed per term, from MiniSearch's match map | `real-data.test.js` |  | **delete** matches termQuality's parameter list; the behaviour is 2089-2094 |
| 2089 | a | an exact match scores 1 | `unit/query.test.js` | import | port. sits in realDataChecks but needs no data |
| 2090 | a | a prefix scores how much of the word it covers (drag/dragons = 0.57) | `unit/query.test.js` | import | port. needs no data |
| 2092 | a | covering more of the word scores higher (dragon beats dragoncon) | `unit/query.test.js` | import | port. needs no data |
| 2094 | a | an unrelated term scores 0 | `unit/query.test.js` | import | port. needs no data |
| 2096 | e | "trek" still leads with Trek events (…) | `real-data.test.js` | handle | port |
| 2109 | e | "drag" admits it matched nothing literally (…) | `real-data.test.js` | handle | port |
| 2110 | e | and says the results are prefixes | `real-data.test.js` | handle | port |
| 2112 | e | a typo is described as a spelling miss, not a prefix (…) | `real-data.test.js` | handle | port |
| 2113 | e | a query that matched literally gets no note | `real-data.test.js` | handle | port |
| 2114 | e | nor a multi-word one that did | `real-data.test.js` | handle | port |
| 2115 | e | nor a query that was all filters and never ranked | `real-data.test.js` | handle | port |
| 2119 | a | d&d expands to the words the index holds | `unit/query.test.js` | import | port. needs no data |
| 2120 | a | dnd expands too | `unit/query.test.js` | import | port. needs no data |
| 2121 | e | "dnd" leads with D&D events (…) | `real-data.test.js` | handle | port |
| 2123 | e | "d&d" finds D&D sessions (…) | `real-data.test.js` | handle | port |
| 2128 | e | kids shows a Kids Track chip | `real-data.test.js` | handle | port |
| 2129 | e | "kids" returns Kids Track only (…) | `real-data.test.js` | handle | port |
| 2131 | e | kids stacks with a day | `real-data.test.js` | handle | port |
| 2132 | e | and only returns that day | `real-data.test.js` | handle | port |
| 2136 | e | the hotel is still read out of the question | `real-data.test.js` | handle | port |
| 2140 | e | a question of only stopwords is not ranked (residual was "…") | `real-data.test.js` | handle | port |
| 2142 | e | every result is at the Westin | `real-data.test.js` | handle | port |
| 2145 | e | in time order within the section, not ranked | `real-data.test.js` | handle | port |
| 2147 | e | and the past run is chronological too | `real-data.test.js` | handle | port |
| 2152 | e | "photo op tudyk" returns the photo sessions (…) | `real-data.test.js` | handle | port |
| 2153 | e | and they are the right person's | `real-data.test.js` | handle | port |
| 2156 | e | a person search says what was held back (…) | `real-data.test.js` | handle | port |
| 2159 | e | with the right count (… = …) | `real-data.test.js` | handle | port |
| 2161 | e | tapping show includes them (… results, … were hidden) | `real-data.test.js` | handle | port |
| 2162 | e | which is more than were shown before | `real-data.test.js` | handle | port |
| 2173 | e | the schedule has someone with photo sessions | `real-data.test.js` | handle | port |
| 2177 | e | a person follow keeps their … photo sessions (…) | `real-data.test.js` | handle | port |
| 2178 | e | alongside their other events | `real-data.test.js` | handle | port |
| 2181 | e | and the hide-photo-sessions setting does not change that | `real-data.test.js` | handle | port |
| 2185 | e | a track follow returns exactly the track's events | `real-data.test.js` | handle | port |
| 2193 | e | all five sections render (…) | `real-data.test.js` | handle | port |
| 2194 | e | every Guest is a celebrity guest (…) | `real-data.test.js` | handle | port |
| 2197 | e | and every Panelist has 5+ events | `real-data.test.js` | handle | port |
| 2198 | e | Epic Photos no longer leads the tracks; Video Room comes last (…) | `real-data.test.js` | handle | port |
| 2208 | e | a starred celebrity panel suggests its guest (…: …) | `real-data.test.js` | handle | port |
| 2209 | e | and never the photo-session track | `real-data.test.js` | handle | port |
| 2212 | e | every track gets a tile (…) | `real-data.test.js` | handle | port |
| 2214 | e | fandoms are limited to 3+ events | `real-data.test.js` | handle | port |
| 2215 | e | which is fewer than all of them | `real-data.test.js` | handle | port |
| 2217 | e | people are listed (…) | `real-data.test.js` | handle | port |
| 2218 | e | each person is either a celebrity guest or has 5+ events | `real-data.test.js` | handle | port |
| 2226 | e | the page count matches eventsFor (…: …) | `real-data.test.js` | handle | port |

### search-3 fix 1: a filter-only query means today

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 2232 | e | late night is still read as a time band | `real-data.test.js` | handle | port |
| 2233 | e | and with nothing left to rank, it scopes to today | `real-data.test.js` | handle | port |
| 2235 | e | every result belongs to today's con day | `real-data.test.js` | handle | port |
| 2237 | e | nothing from Wednesday | `real-data.test.js` | handle | port |
| 2238 | e | anything dated tomorrow is after midnight, not a different day | `real-data.test.js` | handle | port |
| 2242 | e | "party" returns today's parties (…) | `real-data.test.js` | handle | port |
| 2243 | e | with earlier ones behind the fold (…) | `real-data.test.js` | handle | port |
| 2244 | e | and everything above the fold is still to come | `real-data.test.js` | handle | port |
| 2248 | e | a named day is still read | `real-data.test.js` | handle | port |
| 2249 | e | and turns the today scope off | `real-data.test.js` | handle | port |
| 2252 | e | a day chip turns it off too | `real-data.test.js` | handle | port |
| 2253 | e | and its day is the one used | `real-data.test.js` | handle | port |
| 2256 | e | removing the Today chip widens to the whole con | `real-data.test.js` | handle | port |
| 2257 | e | which finds more (… vs …) | `real-data.test.js` | handle | port |
| 2258 | e | across more than one day | `real-data.test.js` | handle | port |
| 2261 | e | the Today chip is shown so it can be removed | `real-data.test.js` | handle | port |
| 2262 | e | with a control to remove it | `real-data.test.js` | dom | port |

### search-3 fix 2: stopwords and short-term prefix

| line | class | message | destination | mechanism | disposition |
|---:|---|---|---|---|---|
| 2266 | a | "…" is a stopword | `unit/query.test.js` | import | port. ×9 (one per word); needs no data |
| 2267 | d | the main index decides prefix per term | `real-data.test.js` |  | **delete** `typeof index._options.searchOptions.prefix` reads MiniSearch's private options; 2268-2270's rewrites are the behaviour |
| 2268 | d | two letters do not prefix-match | `real-data.test.js` | handle | **rewrite** search 'ai': every hit's _hit.terms is exactly 'ai' — nothing arrives by prefix (airbrush, aikido) |
| 2269 | d | nor three | `real-data.test.js` | handle | **rewrite** search 'mcu': every hit's _hit.terms is exactly 'mcu' |
| 2270 | d | four or more do | `real-data.test.js` | handle | **rewrite** search 'trek': some hit's _hit.terms holds a longer term that starts with trek |
| 2271 | d | the suggestion index is untouched | `real-data.test.js` |  | **merge** with 337: the suggestion index prefix-matching short input is what 337 observes (two characters start suggesting) |
| 2274 | e | "…" still returns events (…) | `real-data.test.js` | handle | port. ×5 in a loop |
| 2275 | e | "…" leads with … events (…) | `real-data.test.js` | handle | port. ×5 in a loop |
| 2281 | e | "…" finds something (…) | `real-data.test.js` | handle | port. ×3 in a loop |
