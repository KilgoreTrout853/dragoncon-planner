# Split manifest

A working document for the module split (DECISIONS #23, #24; plan step 4c):
for each slice, the plan, and then its as-built record. The docs slice
decides whether it stays in the repo. Two parts so far:

- **[Leaves](#leaves)** - as built. Fourteen modules that need nothing from
  `src/app.js`; merged in #14.
- **[Rest-1: the views](#rest-1-the-views)** - the plan, step one. Seven
  modules: scroll, bus, and the five views. It ends with
  [app.js after rest-1](#appjs-after-rest-1), what rest-2 starts from.

# Leaves

**Amended 2026-09-19, after the review of draft PR #14**, before any code
moved. The review's decisions are in [Decisions of the
review](#decisions-of-the-review); every table and count below was
regenerated from the parse with them applied. Where a placement had to change
while step two was being carried out, it is recorded under [Amended during
execution](#amended-during-execution), in the commit that changed it.

- **Base.** `next` at `fed41caa70c108917e82b0a77a166f52f00f11c4`, branch
  `refactor/leaves`. No code changes in this step.
- **The file.** `src/app.js` at that commit is 2,793 lines (the brief's 3,400
  was the one-file page). One import, `minisearch`. 275 top-level
  declarations: 151 functions, 88 consts, 36 lets. Every top-level statement
  is a declaration - nothing else runs at import. One 97-name export list,
  and one inline export, `boot`.
- **How it was made.** `src/app.js` was parsed with Vite's `parseAst` and
  walked with a scope-aware pass (parameters, block and catch scopes, shadowed
  names), which recorded, for every top-level declaration: its lines; the
  top-level names and globals it reads *while the module is imported*; the
  ones it reads later, inside function bodies; and every assignment to a
  top-level binding, with the declaration doing the assigning. The tables of
  names and lines below were generated from that parse, not typed. The
  proposed assignment was then checked mechanically: no name assigned twice,
  no leaf reading a later leaf or app.js, every import-time read satisfied.
- **Line numbers** are app.js lines at the base commit. They go stale at the
  first move; the names do not.

The slice: fourteen modules that need nothing from app.js, flat files under
`src/`, in this commit order:

`util`, `storage`, `platform`, `build`, `state`, `time`, `venues`, `data`,
`picks`, `follows`, `ics`, `leave`, `search`, `ui`.

Decided already: one PR, one commit per module, lint and tests green after
each; tests change import lines only; no behaviour change; minify stays on.
"rest" (views, shell, the render bus, dispatch, the rename to boot.js)
follows in its own slice.

## Result in one screen

- The fourteen leaves hold with **no back-edge**: checked mechanically, no
  leaf reads or writes a name that lives in a later leaf or in app.js.
- They take **123** of the 275 declarations and **52** of the 97 export-list
  names. **152** declarations stay, 45 of them in the export list, plus `boot`.
- **Nine lets** are assigned from code that stays in app.js, at 14 sites. Six
  are replaced by one function (`replaceSchedule`), the other three by five
  (`setOverride`, `replacePicks`, `replaceNews`, `clearNews`,
  `replaceFollows`). Three lets that looked like candidates stay in app.js
  instead, because nothing outside it reads them: `fromNetwork`,
  `servedOffline`, `pendingQuery`.
- **Import-time evaluation is safe under any import order.** Only 13
  declarations in the whole file read another top-level name while the module
  is imported; each becomes an import edge or stays above its reader in the
  same file. After leaves, app.js reads nothing from any leaf at import.
- **The clock rule finds one call**, the bare `new Date()` inside `now()`
  (line 326), which moves to `src/time.js`. No `Date.now()` anywhere. Nothing
  outside time.js: not a stop.
- The twelve placements the brief left open, and what the review decided for
  each, are in [Decisions of the review](#decisions-of-the-review).

## Step two, commit by commit

**Commit 0 - the tests get ready; no module moves.** Green against the
unsplit app.js.

1. `tests/rules/source.test.js`: the four rules that are not the Time-section
   rule read every `src/*.js`, concatenated in name order, instead of
   `src/app.js` alone (rule 6). See [The source rules](#the-source-rules):
   rule [780] slices the text at `const PAGE = 150;`, and that slice has to go
   in this commit.
2. `tests/helpers/page.js`: after `vi.resetModules()` it imports every module
   under `src/` except `main.js` and returns them merged as `app` (rule 7). See
   [The page helper](#the-page-helper).
3. `tests/rules/imports.test.js`, new (rule 8; the review keeps it). See
   [The imports rule](#the-imports-rule).

**Commits 1-14 - one module each**, in the order above. Each commit:

1. creates `src/<module>.js` holding the module's *takes*, in the order they
   have in app.js today, cut and pasted by block (CLAUDE.md 9) - never
   renamed, never found-and-replaced. `now`, `pad`, `index`, `events` and
   `reload` are shadowed names: `leave` takes three functions with a `now`
   parameter and must not import `now`; in app.js `revealChip()` has a local
   `pad` and `boot()` has locals called `now`, `data` and `reloadWith`.
2. gives the file the `import` lines listed under *imports*, and ends it
   with one `export { ... }` list of the names under *exports* - as app.js
   does today - so the moved code is byte for byte what it was and a private
   name that shares a declaration with an exported one stays private;
3. deletes those declarations from app.js and adds one `import` line there for
   the names app.js still uses;
4. prunes the module's names from app.js's export list (the first prune, in
   commit 1, also rewrites the list's comment: see
   [The export list](#the-export-list));
5. changes the import lines of the unit tests listed under *tests*. Page tests
   do not change: they reach everything through `page.app`.

Two commits carry something extra: **time** (the ESLint ignore and the
Time-section rule, rule 5) and **search** (app.js loses its `minisearch`
import).

Expected test counts: 837 passed and 4 skipped today; commit 0 adds the
imports rule's three tests (840); the time commit removes one, the
Time-section rule (839); every other commit leaves the count alone.

**Commit 15 - docs.** `docs/ARCHITECTURE.md`, surgical, the scope the review
set: the Repo map's row for `src/app.js` and one row for the leaf modules;
the "still one file" sharp edge; the Tests paragraphs that say the helper or
the unit tests import `src/app.js`; the ESLint paragraph. The rewrite is a
later PR.

---

## 1. util

Not a section: a named list. `esc`, `pad`, `toDate`, `fmt`, `fmtShort` and
`minutesBetween` sit in a run after Follows (229-234), `fmtMins` further down
the same run (256), `dayOf` at its end (277).

- **imports:** nothing.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `esc` | const | 229 |  |
| `pad` | const | 230 |  |
| `toDate` | const | 231 |  |
| `fmt` | function | 232 |  |
| `fmtShort` | function | 233 | yes |
| `minutesBetween` | function | 234 |  |
| `fmtMins` | function | 256-260 | yes |
| `dayOf` | function | 277 |  |

8 names, 12 declaration lines.

- **reads at import:** nothing. `toDate` builds a Date from a value
  (`new Date(iso)`), which the clock rule allows.
- **reassigned lets:** none.
- **stays behind:** nothing of its own. The run it is cut from also holds
  `cleanRoom`, `placeHTML`, `walkMin`, the `hotel*` helpers (venues),
  `isCeleb` (data) and `CELEB_BADGE` (ui), which wait for their commits.
- **exports:** all eight: `esc`, `pad`, `toDate`, `fmt`, `fmtShort`,
  `minutesBetween`, `fmtMins`, `dayOf`. **Pruned from app.js's list:**
  `fmtShort`, `fmtMins`.
- **tests:** `tests/unit/time.test.js` - `fmtMins` comes from
  `../../src/util.js`; `CON`, `conDayKey`, `conPhase` stay on
  `../../src/app.js` until commit 6.

## 2. storage

- **imports:** nothing.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `loadJSON` | function | 139 | yes |
| `saveJSON` | function | 140 | yes |
| `readSession` | const | 322 |  |
| `writeSession` | const | 323 |  |

4 names, 4 declaration lines.

- **reads at import:** nothing - four functions. What they read
  (`localStorage`, `sessionStorage`) is read when a caller calls them.
- **reassigned lets:** none.
- **stays behind:** nothing.
- **exports:** `loadJSON`, `saveJSON`, `readSession`, `writeSession`.
  **Pruned:** `loadJSON`, `saveJSON`.
- **tests:** none by import. `page.app.loadJSON` (archive, follows) is covered
  by the merged `app`.
- **Two notes.** The brief lists `loadJSON` among util's scattered names; with
  a `storage` module in the list it belongs here, and this manifest puts it
  here (proposal P1). `readSession` and `writeSession` sit in the Time section
  (322-323) and only time uses them; they are storage's session twins, so they
  come here and time imports them (P2).

## 3. platform

- **imports:** nothing.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `IS_IOS` | const | 2291-2292 | yes |
| `isStandalone` | function | 2301-2303 | yes |

2 names, 5 declaration lines.

- **reads at import:** `navigator.platform` and `navigator.maxTouchPoints`
  (`IS_IOS`). `isStandalone()` reads `matchMedia` and `navigator.standalone`
  when called, not at import.
- **reassigned lets:** none.
- **stays behind:** the rest of the Offline section, all of it shell or view.
  The install nudge (`NUDGE_SNOOZE_MS`, `installPrompt`, `nudgeVisible`,
  `nudgeCopy`, `nudgeHTML`) is Now-tab markup and `installPrompt` is assigned
  by `boot()`'s `beforeinstallprompt` listener. The edge guard (`edgeTouch`,
  `edgeTouchStart`, `edgeTouchMove`) and the update pill (`updatePill`,
  `showUpdatePill`, `hideUpdatePill`, the three `pill*` lets) touch the shell.
  `reload`/`reloadNow` belong to `boot()`'s option. `recheckSchedule` (with
  `RECHECK_MS`, `lastScheduleCheck`) calls `updateFresh()` and
  `showUpdatePill()`.
- **exports:** `IS_IOS`, `isStandalone`. **Pruned:** both.
- **tests:** `tests/unit/misc.test.js` - `IS_IOS` from
  `../../src/platform.js`.

## 4. build

- **imports:** util `{ esc }`; platform `{ IS_IOS }`.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `metaContent` | const | 286 |  |
| `BUILD` | const | 287 | yes |
| `devMarkHTML` | function | 288-291 |  |
| `deviceLine` | function | 2138-2153 | yes |

4 names, 22 declaration lines.

- **reads at import:** `<meta name="dc-channel">` and `<meta name="dc-build">`
  (`BUILD`, through `metaContent`, which must stay above it: a const arrow
  used at import).
- **reassigned lets:** none.
- **stays behind:** nothing from the Build section. `fillSettings()`, which
  calls `deviceLine()`, stays with the sheet.
- **exports:** `BUILD`, `devMarkHTML`, `deviceLine`. `metaContent` is private.
  **Pruned:** `BUILD`, `deviceLine`.
- **tests:** none by import (`page.app.BUILD`, `page.app.deviceLine` in
  devmark: covered).
- **Note (P5).** `deviceLine` sits in the sheet's section (2138) and needs
  both `BUILD` and `IS_IOS`. It names the build and needs nothing from
  app.js, so it lands here, which is why build imports platform - an edge
  between two leaves the brief did not list. The alternative is to leave it
  in app.js until "rest".

## 5. state

- **imports:** storage `{ loadJSON }`.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `settings` | const | 108 | yes |
| `state` | const | 113-120 | yes |

2 names, 9 declaration lines.

- **reads at import:** localStorage `dc26.settings` (`settings`), then
  `dc26.mineView`, `dc26.followingLayout`, `dc26.followingOpen` and
  `settings.hideNoise` (`state`). `settings` stays above `state`.
- **reassigned lets:** none. Both are consts whose properties are written,
  which an importer may do.
- **stays behind:** from the same run of lines (91-121): `BOOT` (97) - the
  review's decision (P4): it is written by `load()` and
  `scheduleIndexBuild()`, which stay, and nothing in a leaf needs it;
  `pendingQuery` (93) - assigned by `indexReady()` and by `boot()`'s input
  handler, read by nothing else, so it is the shell's; `fromNetwork` and
  `servedOffline` (111) - assigned by `load()` and `boot()`, read by `load()`
  and `updateFresh()` only; `PAGE` (121) - the browse view's page size. None
  is read by a leaf, so none needs a setter.
- **exports:** `settings`, `state`. **Pruned:** both.
- **tests:** none by import.

## 6. time

- **imports:** util `{ dayOf, pad, toDate }`; storage `{ readSession,
  writeSession }`; build `{ BUILD }`.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `CON_DAYS` | const | 5 | yes |
| `DAY_LABEL` | const | 6 |  |
| `DAY_LONG` | const | 7 | yes |
| `CON` | const | 309-315 | yes |
| `TIME_OVERRIDE_KEY` | const | 320 | yes |
| `timeOverride` | let | 321 |  |
| `parseMoment` | const | 324 |  |
| `now` | function | 326 | yes |
| `isSimulated` | const | 327 | yes |
| `initTimeOverride` | function | 331-336 | yes |
| `localInputValue` | const | 353 |  |
| `conPhase` | function | 357 | yes |
| `conEnded` | const | 358 | yes |
| `isPast` | const | 361 |  |
| `conDayKey` | function | 876 | yes |

15 names, 26 declaration lines.

- **reads at import:** nothing from the environment. `CON` is built with
  `toDate` (util) and `TIME_OVERRIDE_KEY` from `BUILD.channel` (build) - the
  two import-time edges that fix util and build before time. `?now=` and
  sessionStorage are read by `initTimeOverride()`, which `boot()` calls.
- **reassigned lets:** `timeOverride`, assigned at line 342 by
  `setTimeOverride()`, which stays. The review's decision (P7): time owns the
  override's persistence - the let, the session key and the URL parameter,
  read and write. So an exported `setOverride(value)` holds lines 342-346,
  verbatim: it parses, assigns, writes the session key and rewrites `?now=` in
  the address, and returns what it set. `setTimeOverride()` in app.js calls
  it, then does what is the page's: lines 347-350. `parseMoment`,
  `readSession` and `writeSession` then have no reader in app.js. The one read
  of `timeOverride` left there, `fillSettings()`, goes through the live
  binding, unchanged.
- **stays behind:** `setTimeOverride` (341-351), less lines 342-346: it calls
  `setOverride(value)`, resets `state.browse.day` and `state.map.day`, and
  calls `render()` and `updateFresh()`. One of the known two. Its comment
  (337-340) is split with it: what describes the address goes with
  `setOverride`, the last sentence stays. `DATA_URL` (316) leaves the section
  for data.
- **exports:** `CON_DAYS`, `DAY_LABEL`, `DAY_LONG`, `CON`,
  `TIME_OVERRIDE_KEY`, `timeOverride`, `now`, `isSimulated`,
  `initTimeOverride`, `setOverride` (new), `localInputValue`, `conPhase`,
  `conEnded`, `isPast`, `conDayKey`. `parseMoment` is private. **Pruned:**
  `CON_DAYS`, `DAY_LONG`, `CON`, `TIME_OVERRIDE_KEY`, `now`, `isSimulated`,
  `initTimeOverride`, `conPhase`, `conEnded`, `conDayKey`.
- **tests:** `tests/unit/time.test.js` - `CON`, `conDayKey`, `conPhase` from
  `../../src/time.js` (with `fmtMins` from util since commit 1, the file no
  longer imports app.js).
- **Also in this commit (rule 5).** `eslint.config.js`: `"src/app.js"` and its
  comment leave the clock rule's `ignores`, so the rule runs on every file
  under `src/` but `time.js`. `tests/rules/source.test.js`: the Time-section
  rule ([1892, and 1890]) is deleted. See [The clock rule](#the-clock-rule).
- **Cross-cuts.** `conDayKey` comes from the Rendering section (876): search,
  leave and data all need it. `CON_DAYS`, `DAY_LABEL`, `DAY_LONG` come from
  the top of the file (5-7): picks and ui need `DAY_LABEL`, search needs
  `DAY_LONG`, and the Time section's own comment already says the con's
  bounds live there (P3).

## 7. venues

DECISIONS #27: "in step 4 the only change is isolating today's constants in
`src/venues.js`" - hotel identity, the walk table, the buffer.

- **imports:** util `{ esc }`; state `{ settings }`.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `HOTEL_ORDER` | const | 8 |  |
| `HOTEL_VAR` | const | 9 |  |
| `HOTEL_SHORT` | const | 10 |  |
| `HOTEL_GROUP` | const | 14 |  |
| `WALK` | const | 16-22 | yes |
| `LEAVE_BUFFER_MIN` | const | 23 | yes |
| `cleanRoom` | function | 238-240 | yes |
| `placeHTML` | function | 246-255 | yes |
| `walkMin` | function | 261-266 | yes |
| `hotelShort` | const | 271 | yes |
| `hotelVar` | const | 272 |  |
| `hotelGroup` | const | 273 | yes |
| `hotelMatches` | const | 275 | yes |
| `hotelPhrase` | const | 600 | yes |

14 names, 36 declaration lines.

- **reads at import:** nothing.
- **reassigned lets:** none.
- **stays behind:** the map's geometry (`MAP_W`, `MAP_VIEW`, `MAP_STREETS`,
  `MAP_HOTELS`, `MAP_BRIDGES`) stays with the map view; #28 makes the drawing
  venues data, but not in this slice.
- **exports:** `HOTEL_ORDER`, `WALK`, `LEAVE_BUFFER_MIN`, `cleanRoom`,
  `placeHTML`, `walkMin`, `hotelShort`, `hotelVar`, `hotelGroup`,
  `hotelMatches`, `hotelPhrase`. Private: `HOTEL_VAR`, `HOTEL_SHORT`,
  `HOTEL_GROUP`. **Pruned:** `WALK`, `LEAVE_BUFFER_MIN`, `cleanRoom`,
  `placeHTML`, `walkMin`, `hotelShort`, `hotelGroup`, `hotelMatches`,
  `hotelPhrase`.
- **tests:** `tests/unit/venues.test.js` - `cleanRoom`, `hotelMatches`,
  `hotelPhrase` from `../../src/venues.js`; `samePlace` stays on app.js until
  commit 9. `tests/unit/misc.test.js` - `LEAVE_BUFFER_MIN` from
  `../../src/venues.js`.
- **Decided cross-cuts, confirmed.** `walkMin` keeps its signature and reads
  `settings.crowd`, so venues imports state, one way. `hotelPhrase` moves in
  from the Map section (600). venues also imports util, for `placeHTML`'s
  `esc` (P8: `placeHTML` and `hotelVar` are presentation, but they are keyed
  on hotel identity and need nothing later than util).

## 8. data

- **imports:** util `{ toDate }`; time `{ CON, conDayKey }`; venues
  `{ HOTEL_ORDER, cleanRoom, hotelGroup }`.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `NOISE_TRACKS` | const | 24 | yes |
| `isNoise` | const | 25 | yes |
| `events` | let | 110 |  |
| `byId` | let | 110 |  |
| `tracks` | let | 110 |  |
| `hotels` | let | 110 |  |
| `hotelChips` | let | 110 |  |
| `meta` | let | 112 |  |
| `isCeleb` | const | 269 | yes |
| `DATA_URL` | const | 316 |  |
| `fandomCounts` | function | 516-520 |  |

11 names, 15 declaration lines.

- **reads at import:** nothing from the environment. `DATA_URL` is built from
  `CON.year` (time).
- **reassigned lets:** six, all assigned by `load()` in one contiguous block,
  lines 388-402: `meta`, `events`, `byId`, `tracks`, `hotels`, `hotelChips`.
  Proposed (P6): that block moves, verbatim, into an exported
  `replaceSchedule(data)` here, and `load()` calls it where the block was -
  same statements, same order, all synchronous, so `load()` still reaches its
  first `render()` with no `await` on the way. It is what gives data its three
  imports. `hotels` then has no reader outside the module. Line 403,
  `servedOffline = fromNetwork === false`, stays in `load()`. The fallback, if
  the review wants `load()` untouched: six one-line setters, or one
  `setSchedule({...})`, and data imports only time. `recheckSchedule()` and the
  worker's message handler write `meta.generated_at` - a property, through
  the live binding, unchanged.
- **stays behind:** `load` (366-413): the fetch, the Cache API fallback, the
  empty state written into `#view-now`, then `buildCatalogue()`,
  `applyExploreHash()`, `reconcilePicks()`, `updateFresh()`, `render()`,
  `scheduleIndexBuild()`. `fromNetwork` and `servedOffline`: see state.
  `updateFresh` (521-539) writes the header. `buildCatalogue`/`getCatalogue`
  are the Explore view's model.
- **exports:** `NOISE_TRACKS`, `isNoise`, `isCeleb`, `events`, `byId`,
  `tracks`, `hotelChips`, `meta`, `DATA_URL`, `fandomCounts`,
  `replaceSchedule` (new). `hotels` is private. **Pruned:** `NOISE_TRACKS`,
  `isNoise`, `isCeleb`.
- **tests:** none by import.
- **Cross-cuts.** `DATA_URL` comes out of the Time section (316).
  `NOISE_TRACKS`/`isNoise` (24-25) and `isCeleb` (269) are predicates on an
  event that search and ui need. `fandomCounts` (516) is a count over
  `events` with one reader, `renderBrowse()`; it comes here because its
  section (Loading) is being taken apart, and the review confirmed it.

## 9. picks

- **imports:** util `{ dayOf, esc, fmtShort, toDate }`; storage `{ loadJSON,
  saveJSON }`; time `{ DAY_LABEL }`; data `{ byId }`.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `picks` | let | 109 |  |
| `pickInfo` | let | 144 |  |
| `pickNews` | let | 145 |  |
| `snapshotOf` | const | 146 |  |
| `savePicks` | function | 147-153 | yes |
| `savePickNews` | function | 154 | yes |
| `samePlace` | const | 157 | yes |
| `whenWhere` | function | 158-161 |  |
| `reconcilePicks` | function | 165-182 | yes |
| `pickNewsHTML` | function | 183-190 |  |

10 names, 43 declaration lines.

- **reads at import:** localStorage `dc26.picks`, `dc26.pickInfo`,
  `dc26.pickNews`.
- **reassigned lets:**
  - `picks` - `boot()` lines 2457 and 2667 (`picks = new Set()`, the two
    "remove everything" paths) and 2761 (`picks = new Set(ids)`, the handle).
    Replaced by `replacePicks(ids)`: `picks = new Set(ids)`. The two clears
    call `replacePicks([])`. The `savePicks()` that follows each stays where
    it is.
  - `pickNews` - `boot()` line 2473 (`pickNews = []`, dismiss) and line 2763
    twice (the handle's `news.set` and `news.clear`). Replaced by `clearNews()`
    and `replaceNews(list)`. `replaceNews` assigns the list it is given, not a
    copy, as line 2763 does.
  - `pickInfo` is assigned only by `savePicks()`, inside the module.
  - `picks.add`/`picks.delete` in `togglePick()` and `pickNews.push` are
    mutations through the live binding, unchanged.
- **stays behind:** `togglePick` (2086-2098): measures the tapped row, calls
  `render()`, then `pageScrollBy()`. The other of the known two.
- **exports:** `picks`, `pickNews`, `savePicks`, `savePickNews`, `samePlace`,
  `reconcilePicks`, `pickNewsHTML`, `replacePicks`, `replaceNews`,
  `clearNews` (three new). Private: `pickInfo`, `snapshotOf`, `whenWhere`.
  **Pruned:** `savePicks`, `savePickNews`, `samePlace`, `reconcilePicks`.
- **tests:** `tests/unit/venues.test.js` - `samePlace` from
  `../../src/picks.js`. (It is a room-string comparison and the unit file
  groups it with venues; it could as well move to venues and spare that file
  a second import line. Left in its section.)

## 10. follows

- **imports:** storage `{ loadJSON, saveJSON }`; data `{ events }`.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `FOLLOW_KINDS` | const | 198 | yes |
| `follows` | let | 199-200 |  |
| `followId` | const | 201 | yes |
| `saveFollows` | function | 202 | yes |
| `isFollowing` | function | 203 | yes |
| `toggleFollow` | function | 204-209 | yes |
| `eventsFor` | function | 213-228 | yes |

7 names, 28 declaration lines.

- **reads at import:** localStorage `dc26.follows`. The initializer filters
  what it loaded, and the filter's callback reads `FOLLOW_KINDS` *during
  import* - the one import-time read in the file that hides inside a
  callback. `FOLLOW_KINDS` stays the line above `follows`.
- **reassigned lets:** `follows` - `boot()` line 2762 (`follows = [...list]`,
  the handle). Replaced by `replaceFollows(list)`. `toggleFollow()` splices
  and pushes, inside the module.
- **stays behind:** nothing from the section. The Following feed
  (`followChipsHTML`, `followingByInterest`, `followingByTime`,
  `followingHTML`) is the Explore view's.
- **exports:** all seven, and `replaceFollows` (new). **Pruned:**
  `FOLLOW_KINDS`, `followId`, `saveFollows`, `isFollowing`, `toggleFollow`,
  `eventsFor`.
- **tests:** `tests/unit/misc.test.js` - `FOLLOW_KINDS` from
  `../../src/follows.js`.

## 11. ics

The whole Calendar export section (2050-2076), as it stands.

- **imports:** util `{ pad }`; time `{ now }`; data `{ events }`; picks
  `{ picks }`.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `icsEscape` | function | 2050 |  |
| `fold` | function | 2051 |  |
| `icsDate` | function | 2052 |  |
| `exportICS` | function | 2053 |  |
| `exportEventICS` | function | 2054-2056 |  |
| `downloadICS` | function | 2057-2076 |  |

6 names, 27 declaration lines.

- **reads at import:** nothing.
- **reassigned lets:** none.
- **stays behind:** nothing. `downloadICS()` appends an `<a>` to the body and
  clicks it; that is the document, not a view or the shell.
- **exports:** `exportICS`, `exportEventICS`. The other four are private.
  **Pruned:** none - the section was never in the list.
- **tests:** none by import.

## 12. leave

- **imports:** util `{ minutesBetween }`; time `{ conDayKey }`; venues
  `{ LEAVE_BUFFER_MIN, hotelPhrase, hotelShort, walkMin }`; data `{ events }`;
  picks `{ picks }`. **Not** `now`: `nextPickInConDay(now)`,
  `currentLocation(now)` and `leaveInfo(from, next, now)` take it as a
  parameter.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `gapHTML` | function | 861-873 |  |
| `nextPickInConDay` | function | 878-881 |  |
| `currentLocation` | function | 890-893 | yes |
| `previousPick` | function | 896-903 |  |
| `leaveInfo` | function | 910-922 | yes |

5 names, 42 declaration lines.

- **reads at import:** nothing.
- **reassigned lets:** none.
- **stays behind:** `RING_R`, `RING_C`, `ringHTML`, `heroHTML` (the Now tab's
  hero), `renderMiniBar` (shell), and the map's `mapNowState`/`mapCardState`,
  all of which call into this module.
- **exports:** `gapHTML`, `nextPickInConDay`, `currentLocation`, `leaveInfo`.
  `previousPick` is private. **Pruned:** `currentLocation`, `leaveInfo`.
- **tests:** none by import (`page.app.currentLocation`, `.leaveInfo`:
  covered).
- **Note (P9).** `gapHTML` (861) and `nextPickInConDay` (878) sit in the
  Rendering section. Both are about the walk between two picks and need only
  earlier leaves.

## 13. search

- **imports:** `minisearch`; util `{ dayOf }`; state `{ state }`; time
  `{ DAY_LONG, conDayKey, conEnded, isPast, now }`; venues `{ hotelMatches,
  hotelShort }`; data `{ byId, events, isNoise }`.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `SYNONYMS` | const | 29-82 |  |
| `STOPWORDS` | const | 83-89 | yes |
| `KIND_LABELS` | const | 90 |  |
| `index` | let | 91 |  |
| `SEARCH_PLACEHOLDER` | const | 94 | yes |
| `processTerm` | const | 98-101 |  |
| `aliasesFor` | function | 102-106 |  |
| `buildIndex` | function | 440-458 |  |
| `suggestIndex` | let | 461 |  |
| `suggestDocs` | let | 461 |  |
| `buildSuggestIndex` | function | 462-489 |  |
| `suggestionsFor` | function | 493-514 | yes |
| `passesFilters` | function | 1195-1207 |  |
| `DAY_WORDS` | const | 1213-1214 |  |
| `HOTEL_WORDS` | const | 1215-1216 |  |
| `TIME_BANDS` | const | 1217 |  |
| `queryRules` | function | 1221-1244 |  |
| `QUERY_RULES` | let | 1245 |  |
| `QUERY_EXPANSIONS` | const | 1252-1256 |  |
| `expandQuery` | function | 1257-1261 | yes |
| `tokenise` | function | 1263 |  |
| `stripPhrase` | function | 1264-1270 |  |
| `parseQuery` | function | 1272-1298 | yes |
| `finishParse` | function | 1300-1323 |  |
| `inTimeBand` | function | 1325-1331 |  |
| `activeFilters` | function | 1335-1353 | yes |
| `LOOSE_THRESHOLD` | const | 1355 |  |
| `termQuality` | function | 1362-1371 | yes |
| `collectHits` | function | 1375-1392 |  |
| `browseResults` | function | 1394-1452 | yes |

30 names, 370 declaration lines.

- **reads at import:** nothing from the environment.
- **reassigned lets:** none from outside. `index` is assigned by
  `buildIndex()`, `suggestIndex`/`suggestDocs` by `buildSuggestIndex()`,
  `QUERY_RULES` by `parseQuery()` - all inside. app.js reads `index` (`load()`,
  `renderBrowse()`, `boot()`) and `suggestDocs` (`hiddenForQueryHTML()`)
  through the live binding.
- **stays behind:** `idle`, `scheduleIndexBuild`, `indexReady` (they write
  `BOOT`, touch `#q` and call `queueBrowseRender()`), `pendingQuery` (see
  state), `renderBrowse` and its markup helpers (`suggestHTML`,
  `noExactMatchHTML`, `hiddenForQueryHTML`, `parsedChipsHTML`), and the
  debounce (`SEARCH_DEBOUNCE_MS`, `browseRenderTimer`, `queueBrowseRender`,
  `cancelQueuedBrowseRender`).
- **exports:** `STOPWORDS`, `KIND_LABELS`, `index`, `SEARCH_PLACEHOLDER`,
  `processTerm`, `buildIndex`, `suggestDocs`, `buildSuggestIndex`,
  `suggestionsFor`, `expandQuery`, `tokenise`, `stripPhrase`, `parseQuery`,
  `activeFilters`, `termQuality`, `browseResults`. Private: `SYNONYMS`,
  `aliasesFor`, `suggestIndex`, `passesFilters`, `DAY_WORDS`, `HOTEL_WORDS`,
  `TIME_BANDS`, `queryRules`, `QUERY_RULES`, `QUERY_EXPANSIONS`,
  `finishParse`, `inTimeBand`, `LOOSE_THRESHOLD`, `collectHits`. **Pruned:**
  `STOPWORDS`, `SEARCH_PLACEHOLDER`, `suggestionsFor`, `expandQuery`,
  `parseQuery`, `activeFilters`, `termQuality`, `browseResults`.
- **tests:** `tests/unit/query.test.js` - `expandQuery`, `SEARCH_PLACEHOLDER`,
  `STOPWORDS`, `termQuality` from `../../src/search.js`; `SEARCH_DEBOUNCE_MS`
  stays on `../../src/app.js`.
- **Also in this commit.** app.js's `import MiniSearch from "minisearch"` is
  deleted: `buildIndex()` and `buildSuggestIndex()` were its only users.
- **Decided cross-cut, confirmed.** `passesFilters` moves in from the Browse
  view (1195), and what it needs resolves without a new edge: `activeFilters`
  and `inTimeBand` are already in the Query section, which moves whole;
  `hotelMatches` is venues; `isNoise` is data. search imports state and
  earlier leaves only.
- **Worth knowing.** search *writes* state: `browseResults()` sets
  `state.browse.parsed` and `state.browse.todayScoped`, and it stamps `_hit`
  and `_section` on data's event objects. Property writes, legal through an
  import, and today's behaviour - but it is a leaf mutating what it imports,
  and "rest" should know.

## 14. ui

The review's decision (P10): markup builders and their constants only - no
DOM handle at import, nothing that scrolls or renders.

- **imports:** util `{ esc, fmt }`; state `{ state }`; time `{ DAY_LABEL }`;
  venues `{ hotelVar, placeHTML }`; data `{ isCeleb }`; picks `{ picks }`.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `CELEB_BADGE` | const | 270 |  |
| `rowHTML` | function | 816-839 |  |
| `highlighter` | function | 841-846 |  |
| `snippetFor` | function | 847-859 |  |
| `chipHTML` | function | 1187-1192 |  |

5 names, 50 declaration lines.

- **reads at import:** nothing.
- **reassigned lets:** none.
- **stays behind:** everything that holds a DOM handle, scrolls or draws: the
  scroller (`scroller`, `pageScrollTop`, `pageScrollTo`, `pageScrollBy`), the
  chip rows (`chipRowsSnapshot`, `chipRowsRestore`, `revealChip`), `cssEsc`
  (a selector escaper, not markup), `render`, `renderMiniBar`, `updateClock`,
  `fitHeaderLine`, `syncHeaderHeight`, the sheet (`sheetWrap` ... `settle`),
  the edge guard and the pill (see platform).
- **exports:** `CELEB_BADGE`, `rowHTML`, `chipHTML`. Private: `highlighter`,
  `snippetFor`. **Pruned:** none - none of the five was in the list.
- **tests:** none by import.
- **Note.** `rowHTML` reads `state.sheetId` and `picks`, both earlier leaves;
  it reads no view. The other markup builders that need nothing from app.js
  went where their subject is, as proposed: `placeHTML` to venues,
  `pickNewsHTML` to picks, `gapHTML` to leave, `devMarkHTML` to build.

---

## Back-edges and cross-cuts

The three decided ones hold as decided (venues imports state for `walkMin`;
`hotelPhrase` into venues; `passesFilters` into search with nothing new to
resolve). Beyond them, every place a leaf needed something that its section
would have left behind, or that sat in another leaf's section, and where it
lands:

| # | name(s) | sits today | needed by | lands in |
|---|---|---|---|---|
| 1 | `conDayKey` | Rendering, 876 | search (`finishParse`, `browseResults`), leave (`nextPickInConDay`), data (`replaceSchedule`) | time |
| 2 | `CON_DAYS`, `DAY_LABEL`, `DAY_LONG` | Data & constants, 5-7 | picks (`whenWhere`), ui (`rowHTML`), search (`queryRules`) | time |
| 3 | `NOISE_TRACKS`, `isNoise`, `isCeleb` | 24-25, 269 | search (`passesFilters`, `buildSuggestIndex`), ui (`rowHTML`) | data |
| 4 | `DATA_URL` | Time, 316 | `load()`, `recheckSchedule()` in app.js; built from `CON` | data |
| 5 | `readSession`, `writeSession` | Time, 322-323 | time | storage |
| 6 | `deviceLine` | the sheet, 2138 | needs `BUILD` and `IS_IOS` | build, which therefore imports platform |
| 7 | `esc` for `placeHTML` | - | venues | venues imports util as well as state |
| 8 | lines 388-402 of `load()` | Loading | every leaf that reads `events` or `byId` | data, as `replaceSchedule(data)`; data imports util, time, venues |
| 9 | `gapHTML`, `nextPickInConDay` | Rendering, 861, 878 | the Now and Mine views, the mini-bar | leave |
| 10 | `buildIndex`, `suggestIndex`, `suggestDocs`, `buildSuggestIndex`, `suggestionsFor` | Loading, 440-514 | - | search, with the vocabulary run at 29-106 |
| 11 | `rowHTML`, `highlighter`, `snippetFor`, `chipHTML`, `CELEB_BADGE` | Rendering, Now, helpers | every view | ui |
| 12 | `fandomCounts` | Loading, 516 | `renderBrowse()` | data |

None of these is a back-edge once placed: the check finds no leaf reading a
later leaf or app.js.

## Evaluation order

Today the module-level reads happen in file order:

| line | reads |
|---:|---|
| 108 | localStorage `dc26.settings` |
| 109 | localStorage `dc26.picks` |
| 113 | localStorage `dc26.mineView`, `dc26.followingLayout`, `dc26.followingOpen`; `settings.hideNoise` |
| 126 | `document.querySelector("main")` |
| 144-145 | localStorage `dc26.pickInfo`, `dc26.pickNews` |
| 199 | localStorage `dc26.follows`, filtered against `FOLLOW_KINDS` |
| 287 | the two stamp metas |
| 309-320 | `CON` from `toDate`; `DATA_URL` from `CON`; `TIME_OVERRIDE_KEY` from `BUILD` |
| 2118-2122, 2216 | `#sheetWrap`, `#sheet`, `#panel-settings`, `#panel-event`, `#panel-hotel`, `#sheetBack` |
| 2291 | `navigator.platform`, `navigator.maxTouchPoints` |
| 2342 | `#updatePill` |

After the split the order is import order, depth-first. With app.js importing
the leaves in list order that is: platform (navigator) -> build (the metas) ->
state (four keys) -> time (`CON`, the key) -> data (`DATA_URL`) -> picks (three
keys) -> follows (one key) -> app.js (`main` and seven more elements). So
`IS_IOS` and `BUILD` are read before storage instead of after it, `dc26.picks`
after `state` instead of before it, and `main` after every storage read
instead of before most of them.

None of that is observable, and the order does not have to be the one above.
Every declaration that reads another top-level name while the module is
imported - there are 13 in the file - is here, with what satisfies it:

| module | declaration | line | reads at import | satisfied by |
|---|---|---:|---|---|
| state | `settings` | 108 | `loadJSON` | state imports storage |
| picks | `picks` | 109 | `loadJSON` | picks imports storage |
| state | `state` | 113 | `loadJSON` | state imports storage |
| state | `state` | 113 | `settings` | same module: line 108 before 113 |
| picks | `pickInfo` | 144 | `loadJSON` | picks imports storage |
| picks | `pickNews` | 145 | `loadJSON` | picks imports storage |
| follows | `follows` | 199 | `loadJSON` | follows imports storage |
| follows | `follows` | 199 | `FOLLOW_KINDS` (inside a callback that runs during import) | same module: line 198 before 199 |
| build | `BUILD` | 287 | `metaContent` | same module: line 286 before 287 |
| time | `CON` | 309 | `toDate` | time imports util |
| data | `DATA_URL` | 316 | `CON` | data imports time |
| time | `TIME_OVERRIDE_KEY` | 320 | `BUILD` | time imports build |
| app.js | `RING_C` | 924 | `RING_R` | same statement: the declarator before it |

Each is either inside one module, where the block keeps its file order, or an
import edge, which the loader evaluates first whatever order the `import`
lines come in. There is no cycle, by construction, so no binding is read
before it is initialised. Everything else read at import is the environment
(localStorage, the document, navigator): plain reads with no side effect,
which the page helper has put in place before it imports anything, and which
`vi.resetModules()` makes every boot read again - platform, build, state,
picks, follows and app.js are the six modules with such a read.

What surprised me:

1. **app.js after leaves reads nothing from a leaf at import.** Its
   module-level work is eight element lookups and constants (`RING_C` from
   `RING_R`). The leaves' import order cannot matter to it.
2. **Hoisting is doing quiet work today.** `settings`, `picks`, `state`,
   `pickInfo`, `pickNews` and `follows` all call `loadJSON` at import, and
   `loadJSON` is declared *below* the first three (line 139). It works because
   it is a function declaration. Two helpers used at import are const arrows -
   `toDate` (for `CON`) and `metaContent` (for `BUILD`) - and those only work
   because they happen to sit above their use. After the split the first
   becomes an import and the second stays in file order inside build, so both
   hold; but it is the reason blocks keep their order inside a module.
3. **One import-time read hides in a callback.** `follows`' initializer runs
   its `.filter()` during import, and the callback reads `FOLLOW_KINDS`. A
   pass that treats function bodies as "later" misses it; the check here
   counts everything inside a non-function initializer as import-time.
4. **`TIME_OVERRIDE_KEY` is the only import-time edge between two leaves that
   touches a stamp**: time must see `BUILD` evaluated. The list order already
   has build before time. In a unit test, with no page, `BUILD.channel` is
   `""` and the key is the unstamped one, as it is today.
5. **Unit tests stop evaluating app.js.** `tests/unit/time.test.js` will
   import time and util and never reach app.js, so its eight element lookups
   no longer run there. They still need jsdom: time imports build, which
   queries the document.

## The export list

Pruned per module, as listed above. By destination:

| goes to | count | names |
|---|---:|---|
| util | 2 | `fmtMins` `fmtShort` |
| storage | 2 | `loadJSON` `saveJSON` |
| platform | 2 | `IS_IOS` `isStandalone` |
| build | 2 | `BUILD` `deviceLine` |
| state | 2 | `settings` `state` |
| time | 10 | `CON` `CON_DAYS` `conDayKey` `conEnded` `conPhase` `DAY_LONG` `initTimeOverride` `isSimulated` `now` `TIME_OVERRIDE_KEY` |
| venues | 9 | `cleanRoom` `hotelGroup` `hotelMatches` `hotelPhrase` `hotelShort` `LEAVE_BUFFER_MIN` `placeHTML` `WALK` `walkMin` |
| data | 3 | `isCeleb` `isNoise` `NOISE_TRACKS` |
| picks | 4 | `reconcilePicks` `samePlace` `savePickNews` `savePicks` |
| follows | 6 | `eventsFor` `FOLLOW_KINDS` `followId` `isFollowing` `saveFollows` `toggleFollow` |
| leave | 2 | `currentLocation` `leaveInfo` |
| search | 8 | `activeFilters` `browseResults` `expandQuery` `parseQuery` `SEARCH_PLACEHOLDER` `STOPWORDS` `suggestionsFor` `termQuality` |
| app.js | 45 | `BOOT` `closeSheet` `edgeTouchMove` `edgeTouchStart` `EXPLORE_HEAD` `getCatalogue` `hiddenForQueryHTML` `hideUpdatePill` `HOUR_PX` `indexReady` `layoutColumns` `MAP_HOTELS` `mapCardHTML` `mapDay` `markActiveSection` `nowModel` `nowSignature` `nudgeCopy` `openExplorePage` `openSheet` `pageScrollBy` `pageScrollTo` `pageScrollTop` `pickActiveSection` `queueBrowseRender` `readExploreHash` `recheckSchedule` `render` `renderBrowse` `renderExplore` `renderMap` `renderMiniBar` `renderNotice` `renderNow` `revealChip` `SEARCH_DEBOUNCE_MS` `setDrag` `setExploreHash` `setTimeOverride` `showUpdatePill` `tickMap` `tickNow` `togglePick` `updateClock` `updateFresh` |

97 names in the list; 52 pruned by the leaves; 45 stay. `boot` is exported inline and stays.

The list's comment still describes the smoke harness and `window.eval`. At the
first prune (commit 1) it becomes, in substance:

```js
/* What is left of the test surface: the functions and consts still in this
   file that a test reaches by name - through the merged namespace the page
   helper builds (tests/helpers/page.js), or a unit test's import. A name
   leaves this list in the commit that moves it to a module of its own, which
   exports it from there. The lets are not here - a test reaches those
   through boot()'s handle - and nor is reloadNow, which the reload option
   replaces. */
```

Thirteen of the forty-five names that stay are reached by no test through
`app.` or an import today (`closeSheet`, `indexReady`, `nowSignature`,
`openSheet`, `queueBrowseRender`, `recheckSchedule`, `render`, `renderMap`,
`renderMiniBar`, `renderNotice`, `revealChip`, `setTimeOverride`,
`showUpdatePill`): the
harness reached them through `window.eval`, and the page tests now go through
the handle. Pruning them is not this slice's business; "rest" can.

## The clock rule

Rule 5. The repo's own rule (`eslint.config.js`: `new Date()` with no
arguments, and `Date.now()`), run through ESLint's API over `src/app.js` as it
is at the base commit, finds **one** call:

- line 326, column 75 - the bare `new Date()` in `now()`, which moves to
  `src/time.js`, the rule's one ignored file.

No `Date.now()` anywhere. So when `"src/app.js"` leaves the rule's `ignores`
in the time commit, the rule runs on app.js and on the five leaves that exist
by then and finds nothing. **Not a stop.**

For the record, the file builds a Date from a value at 14 sites, which the
rule allows as arithmetic, exactly as the regex it replaces did: 231
(`toDate`, util), 324 and 326 (`parseMoment`, `now`: time), 876 (`conDayKey`,
time), 914 (`leaveInfo`, leave), 1308 (`finishParse`, search), 2150
(`deviceLine`, build), and 390, 668, 962, 1042, 1955, 1956, 1963 in code that
stays in app.js.

In the same commit the Time-section rule in `tests/rules/source.test.js` is
deleted (one test fewer). `tests/PORT-LEDGER.md` is not touched in this slice
(the review's call): its rows 1890 and 1892 still name the deleted rule as
their destination, which is the ledger's to say when its fate is decided.

## The source rules

Rule 6. The four rules that remain read `src/app.js` alone today. In commit 0
they read every `src/*.js`, concatenated in name order. Checked against the
proposed split:

- **[780] no code scrolls the window directly.** It slices the text from
  `const PAGE = 150;` before matching. The slice is vestigial - it skipped the
  pasted MiniSearch source in the one-file page - and the whole of app.js
  passes without it (checked). Over a concatenation it would be wrong rather
  than merely useless: `app.js` sorts first, so the slice would drop the top
  of app.js and nothing else, by accident. **The slice goes in commit 0.**
  `PAGE` itself stays in app.js.
- **[1240] togglePick's signature.** `togglePick` stays in app.js. Unaffected.
- **[1728] no inline pixel font size.** Reads the text and the template.
  Unaffected; `rowHTML` and the other markup move to leaves and stay covered.
- **[1989] nothing decides by hostname.** Unaffected.

"Every file under `src/`" means every `.js` file: `styles.css` has its own
rules file.

## The page helper

Rule 7. In commit 0, `tests/helpers/page.js` replaces
`app = await import("../../src/app.js")` with an import of every module under
`src/` and returns them merged as `app`. Three things the rule does not say
and step two needs:

1. **`src/main.js` must be excluded.** It is the entry: importing it imports
   the stylesheet and calls `boot()` with no options - a second boot, and a
   real `fetch`. The glob needs a negative pattern:
   `import.meta.glob(["../../src/*.js", "!../../src/main.js"])`.
2. **Merge with getters, not a spread.** After the split, modules export lets
   (`picks`, `events`, `index`, `timeOverride`, ...). `{...mod}` copies a
   let's value at merge time and the copy goes stale; a getter
   (`get: () => mod[name]`) stays live. No test reads a let through `app`
   today - they use the handle - so this is a trap avoided, not a bug fixed.
3. **`import.meta.glob` does behave under `vi.resetModules()`** on this Vitest
   (5.0.1). Tried in a scratch project outside the repo: after each
   `resetModules()`, the glob's loaders re-evaluate every module; the modules
   they return are one graph (b.js's import of a.js is the a.js the glob
   returned); the negative pattern keeps the entry out; a getter-merge keeps a
   let live where a spread does not; a duplicate export name throws. That was
   the node environment and a two-file graph, so commit 0 still has to show it
   green under the real helper; the list is the fallback.

`page.app.BOOT` (state), `page.app.isStandalone()` (platform) and the helper's
own `cleanup()` (`app.BOOT`, `app.SEARCH_DEBOUNCE_MS`) keep working wherever
those live. No two modules export the same name under this manifest.

**Does any test reach a moved name in a way this does not cover? No.** Every
test file was scanned for how it touches the app: the four unit files import
by name, 19 names (their lines are listed per module above); every page test,
and `tests/real-data.test.js`, reaches names only as `app.NAME` - a read or a
call - 65 names; 76 distinct names in all, every one a function or a const,
none a let. There is no `vi.spyOn`, `vi.mock` or `vi.doMock` on the app, no
assignment to `app.X`, no destructuring from `app`, and nothing enumerates
its keys.

One thing "import lines only" does not stretch to: the first line of each
unit file's header comment says "Pure exports of src/app.js". It becomes
untrue file by file. Left alone unless the review says otherwise.

## The imports rule

Rule 8; the review keeps it. `tests/rules/imports.test.js`, node environment, reading the
`import` declarations of every `src/*.js` (with `parseAst`, as
`build.test.js` once did; plus a check that no file uses `import()`):

1. `./app.js` is imported by `main.js` and by no other file under `src/`.
2. A leaf imports only leaves earlier in the list, and npm packages that are
   in `package.json`'s `dependencies`. The list is a constant in the test, in
   the commit order above.
3. Every `src/*.js` is `app.js`, `main.js` or a name in the list - so a new
   file has to be placed before it can land.

It is green from commit 0 (nothing to check yet but app.js and main.js) and
bites from commit 1. It costs three tests and keeps the leaf property true
through "rest", when views will be tempted to import each other. They are new
tests, not rows of the port ledger, so their titles carry no harness line.

## Decisions of the review

The twelve placements the brief left open, what step one proposed, and what
the review of draft PR #14 decided (2026-09-19). "As proposed" includes the
ones the review did not raise.

| # | proposed | decided |
|---|---|---|
| P1 | `loadJSON`/`saveJSON` go to storage, not util | as proposed |
| P2 | `readSession`/`writeSession` leave the Time section for storage | as proposed |
| P3 | `CON_DAYS`, `DAY_LABEL`, `DAY_LONG` go to time | as proposed |
| P4 | `BOOT` goes to state | **no: `BOOT` stays in app.js.** state is `settings` and `state` |
| P5 | `deviceLine` goes to build, so build imports platform | as proposed |
| P6 | lines 388-402 of `load()` become `replaceSchedule(data)` in data | as proposed, the body moved verbatim |
| P7 | `setOverride(value)` takes lines 342-343 | **amended: time owns the override's persistence** - the let, the session key and the URL parameter, read and write. `setOverride(value)` takes lines 342-346: it parses, assigns, persists and returns what it set; `setTimeOverride()` in app.js calls it, resets the day chips and renders |
| P8 | `placeHTML` and `hotelVar` go to venues | as proposed |
| P9 | `gapHTML` and `nextPickInConDay` go to leave | as proposed |
| P10 | ui is the scroller, the chip rows, `rowHTML` and its helpers, `chipHTML`, `CELEB_BADGE`, `cssEsc` | **amended: ui is markup builders and their constants only** - no DOM handle at import, nothing that scrolls or renders. ui is `CELEB_BADGE`, `rowHTML`, `highlighter`, `snippetFor`, `chipHTML`; the scroller, the chip rows and `cssEsc` stay in app.js |
| P11 | `KIND_LABELS` and `SEARCH_PLACEHOLDER` go to search; `fandomCounts` to data | as proposed; `fandomCounts` to data confirmed |
| P12 | `samePlace` stays in picks | as proposed |

Also decided: the imports rule test is in; `tests/PORT-LEDGER.md` is not
touched; `docs/ARCHITECTURE.md` gets the surgical edits of commit 15 and no
more. That left these sentences of ARCHITECTURE.md untrue:
"The client"'s opening ("One script. Everything below is in `src/app.js`,
which is still a single file"), the last sentence of its Time paragraph (the
rules test that guarded #12 is gone; ESLint guards it), and the list of consts
in "Boot order" that importing `src/app.js` fills (`settings`, `picks`,
`state` and `BUILD`, `IS_IOS` now belong to leaves). A follow-up commit on
the same branch, asked for by the review of step two, fixed those three, the
repo-map rows and the Rules paragraph that said the rules read `src/app.js`
alone, and the size of app.js's export list (45, not 97). The rewrite is
still a later PR.

## Amended during execution

**No placement changed.** Step two landed all fourteen modules as this
manifest has them. Checked at the end against `src/app.js` at the base commit,
statement by statement: of its 262 top-level statements (275 names), 259 are
byte for byte identical in exactly one module, none is missing, and the three
that differ are the three changed on purpose - `setTimeOverride` (calls
`setOverride`), `load` (calls `replaceSchedule`) and `boot` (six assignments
became calls). Six names are new: `setOverride`, `replaceSchedule`,
`replacePicks`, `replaceNews`, `clearNews`, `replaceFollows`. Per module: util
8, storage 4, platform 2, build 4, state 2, time 15, venues 14, data 11, picks
10, follows 7, ics 6, leave 5, search 30, ui 5; app.js keeps 152.

Details that were not placements, and how they landed:

- **Comments that were not where their code was.** `fmtMins`' comment sat 21
  lines above it, on `cleanRoom`; it went to util with `fmtMins` (commit 1).
  The comment above `IS_IOS` describes the edge guard; it stayed in app.js and
  moved down onto `edgeTouch` (commit 3).
- **Banners.** Build, Time, Follows, Calendar export, Query intent and "Where
  you are, and when to leave" travelled with their code; where a banner is the
  top of the new file it stands in for a header. "Data & constants" and
  "Browse" stayed in app.js with what is left under them. The bare "Helpers"
  banner was dropped when its section emptied (commit 9).
- **Order inside two files.** time.js opens with the Time banner and `CON`,
  so the day tables follow `CON` rather than precede it; leave.js opens with
  its banner's section, so `gapHTML` and `nextPickInConDay` follow it. Neither
  file reads any of those at import.
- **app.js's import lines** are recomputed from what it references after each
  move, so a name it stopped using leaves its import: `readSession`,
  `writeSession` and `BUILD` at commit 6, `pad` and `minisearch` at commit 13.
- **File sizes**, in lines: util 21, storage 13, platform 12, build 38, state
  17, time 81, venues 65, data 53, picks 76, follows 49, ics 37, leave 71,
  search 431, ui 67, app.js 1,965 (was 2,793). The per-module figures above are
  declaration lines; a file is those plus its comments, banner, imports and
  export list.

## Completeness

`src/app.js` parsed with Vite's `parseAst`; every top-level declaration, in
file order, with where it goes. Each name appears once.

Parsed: **275** top-level declarations (151 functions, 88 consts, 36 lets) across 262 declaration statements - a few declare several names. The file's other two top-level statements are the `minisearch` import and the export list. Assigned to modules: **123** (util 8, storage 4, platform 2, build 4, state 2, time 15, venues 14, data 11, picks 10, follows 7, ics 6, leave 5, search 30, ui 5). Staying in app.js: **152**. 123 + 152 = 275.

```
        5  const     CON_DAYS                  ->  time      [export list]
        6  const     DAY_LABEL                 ->  time    
        7  const     DAY_LONG                  ->  time      [export list]
        8  const     HOTEL_ORDER               ->  venues  
        9  const     HOTEL_VAR                 ->  venues  
       10  const     HOTEL_SHORT               ->  venues  
       14  const     HOTEL_GROUP               ->  venues  
    16-22  const     WALK                      ->  venues    [export list]
       23  const     LEAVE_BUFFER_MIN          ->  venues    [export list]
       24  const     NOISE_TRACKS              ->  data      [export list]
       25  const     isNoise                   ->  data      [export list]
    29-82  const     SYNONYMS                  ->  search  
    83-89  const     STOPWORDS                 ->  search    [export list]
       90  const     KIND_LABELS               ->  search  
       91  let       index                     ->  search  
       93  let       pendingQuery              ->  app.js  
       94  const     SEARCH_PLACEHOLDER        ->  search    [export list]
       97  const     BOOT                      ->  app.js    [export list]
   98-101  const     processTerm               ->  search  
  102-106  function  aliasesFor                ->  search  
      108  const     settings                  ->  state     [export list]
      109  let       picks                     ->  picks   
      110  let       events                    ->  data    
      110  let       byId                      ->  data    
      110  let       tracks                    ->  data    
      110  let       hotels                    ->  data    
      110  let       hotelChips                ->  data    
      111  let       fromNetwork               ->  app.js  
      111  let       servedOffline             ->  app.js  
      112  let       meta                      ->  data    
  113-120  const     state                     ->  state     [export list]
      121  const     PAGE                      ->  app.js  
      126  const     scroller                  ->  app.js  
      127  const     pageScrollTop             ->  app.js    [export list]
  128-133  function  pageScrollTo              ->  app.js    [export list]
      134  function  pageScrollBy              ->  app.js    [export list]
      139  function  loadJSON                  ->  storage   [export list]
      140  function  saveJSON                  ->  storage   [export list]
      144  let       pickInfo                  ->  picks   
      145  let       pickNews                  ->  picks   
      146  const     snapshotOf                ->  picks   
  147-153  function  savePicks                 ->  picks     [export list]
      154  function  savePickNews              ->  picks     [export list]
      157  const     samePlace                 ->  picks     [export list]
  158-161  function  whenWhere                 ->  picks   
  165-182  function  reconcilePicks            ->  picks     [export list]
  183-190  function  pickNewsHTML              ->  picks   
      198  const     FOLLOW_KINDS              ->  follows   [export list]
  199-200  let       follows                   ->  follows 
      201  const     followId                  ->  follows   [export list]
      202  function  saveFollows               ->  follows   [export list]
      203  function  isFollowing               ->  follows   [export list]
  204-209  function  toggleFollow              ->  follows   [export list]
  213-228  function  eventsFor                 ->  follows   [export list]
      229  const     esc                       ->  util    
      230  const     pad                       ->  util    
      231  const     toDate                    ->  util    
      232  function  fmt                       ->  util    
      233  function  fmtShort                  ->  util      [export list]
      234  function  minutesBetween            ->  util    
  238-240  function  cleanRoom                 ->  venues    [export list]
  246-255  function  placeHTML                 ->  venues    [export list]
  256-260  function  fmtMins                   ->  util      [export list]
  261-266  function  walkMin                   ->  venues    [export list]
      269  const     isCeleb                   ->  data      [export list]
      270  const     CELEB_BADGE               ->  ui      
      271  const     hotelShort                ->  venues    [export list]
      272  const     hotelVar                  ->  venues  
      273  const     hotelGroup                ->  venues    [export list]
      275  const     hotelMatches              ->  venues    [export list]
      277  function  dayOf                     ->  util    
      286  const     metaContent               ->  build   
      287  const     BUILD                     ->  build     [export list]
  288-291  function  devMarkHTML               ->  build   
  309-315  const     CON                       ->  time      [export list]
      316  const     DATA_URL                  ->  data    
      320  const     TIME_OVERRIDE_KEY         ->  time      [export list]
      321  let       timeOverride              ->  time    
      322  const     readSession               ->  storage 
      323  const     writeSession              ->  storage 
      324  const     parseMoment               ->  time    
      326  function  now                       ->  time      [export list]
      327  const     isSimulated               ->  time      [export list]
  331-336  function  initTimeOverride          ->  time      [export list]
  341-351  function  setTimeOverride           ->  app.js    [export list]
      353  const     localInputValue           ->  time    
      357  function  conPhase                  ->  time      [export list]
      358  const     conEnded                  ->  time      [export list]
      361  const     isPast                    ->  time    
  366-413  function  load                      ->  app.js  
      421  const     idle                      ->  app.js  
  422-433  function  scheduleIndexBuild        ->  app.js  
  434-438  function  indexReady                ->  app.js    [export list]
  440-458  function  buildIndex                ->  search  
      461  let       suggestIndex              ->  search  
      461  let       suggestDocs               ->  search  
  462-489  function  buildSuggestIndex         ->  search  
  493-514  function  suggestionsFor            ->  search    [export list]
  516-520  function  fandomCounts              ->  data    
  521-539  function  updateFresh               ->  app.js    [export list]
  547-551  function  chipRowsSnapshot          ->  app.js  
  552-554  function  chipRowsRestore           ->  app.js  
  558-569  function  revealChip                ->  app.js    [export list]
      580  const     MAP_W                     ->  app.js  
      585  const     MAP_VIEW                  ->  app.js  
      586  const     MAP_STREETS               ->  app.js  
  587-595  const     MAP_HOTELS                ->  app.js    [export list]
      597  const     MAP_BRIDGES               ->  app.js  
      600  const     hotelPhrase               ->  venues    [export list]
      602  const     mapPicksAt                ->  app.js  
  603-607  function  mapCounts                 ->  app.js  
  610-614  function  mapPillSVG                ->  app.js  
  615-625  function  hotelSheetHTML            ->  app.js  
  630-635  function  mapNowState               ->  app.js  
  638-647  function  mapRingsSVG               ->  app.js  
  653-659  function  mapCardState              ->  app.js  
  660-681  function  mapCardHTML               ->  app.js    [export list]
      682  const     offLineHTML               ->  app.js  
      684  const     mapOffMapCount            ->  app.js  
  686-703  function  mapSVG                    ->  app.js  
  707-711  function  mapDay                    ->  app.js    [export list]
  713-720  function  renderMap                 ->  app.js    [export list]
      726  let       lastMapSig                ->  app.js  
      726  let       lastCardSig               ->  app.js  
  727-729  function  mapSignature              ->  app.js  
  730-735  function  mapCardSignature          ->  app.js  
  736-750  function  tickMap                   ->  app.js    [export list]
  753-772  function  render                    ->  app.js    [export list]
  774-797  function  renderMiniBar             ->  app.js    [export list]
  799-804  function  updateClock               ->  app.js    [export list]
  808-814  function  fitHeaderLine             ->  app.js  
  816-839  function  rowHTML                   ->  ui      
  841-846  function  highlighter               ->  ui      
  847-859  function  snippetFor                ->  ui      
  861-873  function  gapHTML                   ->  leave   
      876  function  conDayKey                 ->  time      [export list]
  878-881  function  nextPickInConDay          ->  leave   
  890-893  function  currentLocation           ->  leave     [export list]
  896-903  function  previousPick              ->  leave   
  910-922  function  leaveInfo                 ->  leave     [export list]
      924  const     RING_R                    ->  app.js  
      924  const     RING_C                    ->  app.js  
  925-933  function  ringHTML                  ->  app.js  
  935-978  function  heroHTML                  ->  app.js  
  984-991  function  effectiveNow              ->  app.js  
      997  const     ARCHIVE_NOTICE_KEY        ->  app.js  
      998  const     archiveNoticeDismissed    ->  app.js  
 999-1005  function  noticeHTML                ->  app.js  
     1006  let       lastNoticeHTML            ->  app.js  
1007-1015  function  renderNotice              ->  app.js    [export list]
     1020  const     ARCHIVE_SIG               ->  app.js  
1021-1032  function  archiveHTML               ->  app.js  
1041-1055  function  nowModel                  ->  app.js    [export list]
     1057  const     statusShown               ->  app.js  
1061-1073  function  nowSignature              ->  app.js    [export list]
     1074  let       lastNowSig                ->  app.js  
1076-1117  function  renderNow                 ->  app.js    [export list]
1120-1134  function  suggestHTML               ->  app.js  
1139-1152  function  noExactMatchHTML          ->  app.js  
1157-1174  function  hiddenForQueryHTML        ->  app.js    [export list]
1177-1185  function  parsedChipsHTML           ->  app.js  
1187-1192  function  chipHTML                  ->  ui      
1195-1207  function  passesFilters             ->  search  
1213-1214  const     DAY_WORDS                 ->  search  
1215-1216  const     HOTEL_WORDS               ->  search  
     1217  const     TIME_BANDS                ->  search  
1221-1244  function  queryRules                ->  search  
     1245  let       QUERY_RULES               ->  search  
1252-1256  const     QUERY_EXPANSIONS          ->  search  
1257-1261  function  expandQuery               ->  search    [export list]
     1263  function  tokenise                  ->  search  
1264-1270  function  stripPhrase               ->  search  
1272-1298  function  parseQuery                ->  search    [export list]
1300-1323  function  finishParse               ->  search  
1325-1331  function  inTimeBand                ->  search  
1335-1353  function  activeFilters             ->  search    [export list]
     1355  const     LOOSE_THRESHOLD           ->  search  
1362-1371  function  termQuality               ->  search    [export list]
1375-1392  function  collectHits               ->  search  
1394-1452  function  browseResults             ->  search    [export list]
1454-1531  function  renderBrowse              ->  app.js    [export list]
     1535  const     KIND_NOUN                 ->  app.js  
     1540  let       catalogue                 ->  app.js  
1541-1578  function  buildCatalogue            ->  app.js  
     1579  const     getCatalogue              ->  app.js    [export list]
1582-1588  const     EXPLORE_SECTIONS          ->  app.js  
     1591  const     EXPLORE_HEAD              ->  app.js    [export list]
1595-1600  function  setExploreHash            ->  app.js    [export list]
1601-1609  function  readExploreHash           ->  app.js    [export list]
1610-1618  function  openExplorePage           ->  app.js    [export list]
1619-1624  function  closeExplorePage          ->  app.js  
1626-1632  function  tileHTML                  ->  app.js  
1634-1656  function  exploreSectionsHTML       ->  app.js  
1658-1664  function  exploreJumpHTML           ->  app.js  
     1670  const     SUGGEST_MAX               ->  app.js  
1671-1695  function  suggestedFollows          ->  app.js  
1696-1705  function  suggestedHTML             ->  app.js  
1707-1716  function  renderExploreGrid         ->  app.js  
1721-1728  function  pickActiveSection         ->  app.js    [export list]
1729-1740  function  activeExploreSection      ->  app.js  
1741-1747  function  markActiveSection         ->  app.js    [export list]
1748-1751  function  syncActiveSection         ->  app.js  
     1755  let       spyQueued                 ->  app.js  
     1755  let       spyHoldUntil              ->  app.js  
1759-1762  function  renderExploreSections     ->  app.js  
     1764  function  smoothScrollTo            ->  app.js  
1767-1772  function  scrollToGrid              ->  app.js  
1774-1781  function  scrollToExploreSection    ->  app.js  
1783-1818  function  renderExplorePage         ->  app.js  
1820-1822  function  renderExplore             ->  app.js    [export list]
     1825  const     FOLLOWING_PAGE            ->  app.js  
1827-1835  function  followChipsHTML           ->  app.js  
1837-1861  function  followingByInterest       ->  app.js  
1863-1896  function  followingByTime           ->  app.js  
1900-1917  function  followingHTML             ->  app.js  
     1923  const     HOUR_PX                   ->  app.js    [export list]
1924-1948  function  layoutColumns             ->  app.js    [export list]
1950-1997  function  timelineDayHTML           ->  app.js  
1999-2007  function  renderMineTimeline        ->  app.js  
2009-2035  function  renderMine                ->  app.js  
2039-2045  function  fitTimelineBlocks         ->  app.js  
     2050  function  icsEscape                 ->  ics     
     2051  function  fold                      ->  ics     
     2052  function  icsDate                   ->  ics     
     2053  function  exportICS                 ->  ics     
2054-2056  function  exportEventICS            ->  ics     
2057-2076  function  downloadICS               ->  ics     
2086-2098  function  togglePick                ->  app.js    [export list]
     2099  const     cssEsc                    ->  app.js  
     2103  const     SEARCH_DEBOUNCE_MS        ->  app.js    [export list]
     2104  let       browseRenderTimer         ->  app.js  
2105-2113  function  queueBrowseRender         ->  app.js    [export list]
     2115  function  cancelQueuedBrowseRender  ->  app.js  
     2118  const     sheetWrap                 ->  app.js  
     2119  const     sheetEl                   ->  app.js  
     2120  const     panelSettings             ->  app.js  
     2121  const     panelEvent                ->  app.js  
     2122  const     panelHotel                ->  app.js  
     2123  let       sheetScrollY              ->  app.js  
2125-2133  function  fillSettings              ->  app.js  
2138-2153  function  deviceLine                ->  build     [export list]
2155-2181  function  eventSheetHTML            ->  app.js  
2183-2198  function  openSheet                 ->  app.js    [export list]
2200-2211  function  closeSheet                ->  app.js    [export list]
     2216  const     sheetBackEl               ->  app.js  
     2217  let       dragY                     ->  app.js  
     2217  let       dragT                     ->  app.js  
     2217  let       dragDy                    ->  app.js  
2219-2224  function  setDrag                   ->  app.js    [export list]
2225-2238  function  settle                    ->  app.js  
2240-2244  function  applyExploreHash          ->  app.js  
2250-2272  function  tickNow                   ->  app.js    [export list]
2276-2280  function  syncHeaderHeight          ->  app.js  
2291-2292  const     IS_IOS                    ->  platform  [export list]
     2299  const     NUDGE_SNOOZE_MS           ->  app.js  
     2300  let       installPrompt             ->  app.js  
2301-2303  function  isStandalone              ->  platform  [export list]
2304-2308  function  nudgeVisible              ->  app.js  
2309-2317  function  nudgeCopy                 ->  app.js    [export list]
2318-2323  function  nudgeHTML                 ->  app.js  
     2325  const     edgeTouch                 ->  app.js  
2326-2331  function  edgeTouchStart            ->  app.js    [export list]
2332-2340  function  edgeTouchMove             ->  app.js    [export list]
     2342  const     updatePill                ->  app.js  
2344-2352  function  showUpdatePill            ->  app.js    [export list]
2353-2358  function  hideUpdatePill            ->  app.js    [export list]
     2362  let       reload                    ->  app.js  
     2363  function  reloadNow                 ->  app.js  
     2366  let       pillY                     ->  app.js  
     2366  let       pillDx                    ->  app.js  
     2366  let       pillDragged               ->  app.js  
     2375  const     RECHECK_MS                ->  app.js  
     2376  let       lastScheduleCheck         ->  app.js  
2377-2394  function  recheckSchedule           ->  app.js    [export list]
2413-2768  function  boot                      ->  app.js    [exported inline]
```

The export list, name by name, is under [The export list](#the-export-list):
97 names, each once, 52 to the leaves and 45 staying; `boot` is exported
inline and stays.

# Rest-1: the views

The plan for the first of the two "rest" slices, and then its as-built
record. Step one: this part of the manifest and `tools/split/`, committed
together, and a draft PR. Step two follows it commit by commit.

- **Base.** `next` at `9b27a2624a2d294d650103dc52fe18fa0bd0b1d9`, branch
  `refactor/rest-1`. No code under `src/` in this step.
- **The file.** `src/app.js` is 1,965 lines: 14 imports, all of them leaves,
  and 152 top-level declarations - 93 functions, 38 consts, 21 lets - which is
  exactly what leaves left. A 45-name export list, and `boot` inline.
- **How it was made.** As leaves was, and now with tools that are in the repo:
  `tools/split/parse.js` (the scope-aware parse; it agrees, declaration by
  declaration, with the scratch parser that made the leaves part), a module
  assignment checked mechanically against it, and the tables below generated
  from its output. Line numbers are app.js lines at the base commit.

Decided already: rest moves what is left in two PRs. Rest-1 is the views,
mechanical and leaves-shaped. Rest-2 is the sheet, the shell, loading and
offline, dispatch and the rename to boot.js, with a manifest of its own. The
bus is a synchronous call-through; `togglePick` and `setTimeOverride` stay in
app.js; the install nudge folds into now; `no-unused-vars` joins ESLint.

Seven modules, flat files under `src/`, in this commit order:

`scroll`, `bus`, `now`, `browse`, `explore`, `map`, `mine`.

## Rest-1 in one screen

- **100** of the 152 declarations move (scroll 8, now 18, browse 10, explore
  35, map 23, mine 6) and **52** stay; bus is new code, three names. **28** of
  the 45 export-list names are pruned; 17 stay, plus `boot`.
- **The views reach exactly one thing in what stays: `render()`**, at two
  sites, both in explore. They become `requestRender()`. Checked
  mechanically: no name in a rest-1 module reads or assigns anything else
  that stays in app.js.
- **One back-edge, resolved by placement.** `effectiveNow` was listed with
  the shell in the after-leaves table because the notice uses it; `renderNow`
  and `tickNow` use it too, and it sits in the file's own "Now" section. It
  goes to now, and the notice imports it (R1-P1).
- **Six assignments cross a module boundary, all from inside `boot()`**:
  `installPrompt` at three sites, `spyQueued` at two, `spyHoldUntil` at one.
  Six functions replace them; two of the three lets become private.
- **No module imports a later one.** The one view-to-view edge is map
  importing `nowModel` from now, which is why map follows now.
- **One import-time read moves:** `document.querySelector("main")`, from
  app.js to scroll. Nothing else in the seven reads anything at import.
- **`no-unused-vars` flags nothing** on `next` today - 51 files, and 58 with
  `tools/split/` - so it can land in commit 0 as it is. Checked that the run
  was live: a planted unused import, function and local were flagged, and an
  unused argument and caught error were not.

## Rest-1, step two commit by commit

**Commit 0 - the rules get ready; nothing under `src/` changes.**

1. `tests/rules/imports.test.js`: the ordered list gains `scroll`, `bus`,
   `now`, `browse`, `explore`, `map`, `mine` after `ui`. app.js stays the
   root: imported by `main.js` alone. The list is no longer all leaves, so the
   constant becomes `ORDER` and the second test's title says "module"
   (R1-P5); `tools/split/repo.js` reads either name.
2. `eslint.config.js`: `no-unused-vars` with `{args: "none", caughtErrors:
   "none"}`, everywhere, and its header comment says three rules. It lands
   here because the list below is clean.
3. `docs/DECISIONS.md` #24: the title's "ESLint with two rules" becomes three,
   dated, in the same commit.

**Commits 1-7 - one module each**, in the order above, with the tools:
`where.js` for the ranges, a spec, `move.js` (dry run, then `--write`), the
hand edits the mover lists, `imports.js --write`, `npm run lint` and
`npm test` green, commit. The mover refuses a module whose names or imports
are not this manifest's. Two commits carry something extra: **bus** is new
code, and `boot()` gains `setRenderer(render)` as its first statement;
**explore** turns two `render()` calls into `requestRender()`.

**Commit 8 - docs.** `docs/ARCHITECTURE.md`: the repo-map rows for the seven
modules and for `tools/split/` (added in step one, where only this file and
the tools could be touched), what `src/app.js` is now, and the ESLint
paragraph's "two rules". This part's "Amended during execution".

Expected test counts: 839 passed and 4 skipped throughout. No rule is added
or removed; the unit tests change import lines only. If the bus gets its
test (R1-P4), 841.

---

## R1.1 scroll

The group leaves left behind because no leaf needed it; every view and the
shell do.

- **imports:** nothing from `src/`.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `scroller` | const | 46 |  |
| `pageScrollTop` | const | 47 | yes |
| `pageScrollTo` | function | 48-53 | yes |
| `pageScrollBy` | function | 54 | yes |
| `chipRowsSnapshot` | function | 157-161 |  |
| `chipRowsRestore` | function | 162-164 |  |
| `revealChip` | function | 168-179 | yes |
| `cssEsc` | const | 1303 |  |

8 names, 30 declaration lines.

- **reads at import:** `document.querySelector("main")` (`scroller`). It
  stays the first declaration of the file: the three `pageScroll*` functions
  close over it.
- **reassigned lets:** none.
- **stays behind:** the "Rendering" banner, which `where.js` attaches to
  `chipRowsSnapshot` because it sits directly above its comment: the cut
  starts at line 154, and the banner stays with `render()`. `fitHeaderLine`
  and `syncHeaderHeight` are the header's, which is the shell.
- **exports:** all eight. **Pruned from app.js's list:** `pageScrollTop`,
  `pageScrollTo`, `pageScrollBy`, `revealChip`.
- **tests:** none by import (`page.app.pageScrollTo` and friends, in shell:
  the merged `app` covers them).

## R1.2 bus

New code; it takes nothing from app.js.

```js
let renderer = null;
function setRenderer(fn) { renderer = fn; }
function requestRender() {
  if (!renderer) throw new Error("requestRender() before setRenderer(): boot() has not run");
  renderer();
}
export { requestRender, setRenderer };
```

- **imports:** nothing.
- **reads at import:** nothing.
- **reassigned lets:** `renderer` is assigned by `setRenderer()` alone, inside
  the module; it is not exported.
- **in app.js:** `boot()` calls `setRenderer(render)` as its first statement,
  before it registers anything. Only `render()` goes over the bus. The
  partial renders - `renderMiniBar`, `tickNow`, `tickMap`,
  `renderExploreSections`, `queueBrowseRender` - stay direct imports from
  above: the shell imports the views, never the reverse.
- **synchronous:** `requestRender()` calls the renderer and returns when it
  has drawn, so `openExplorePage()`'s `pageScrollTo(0)` still runs after the
  draw, as it does today.
- **in tests:** every `bootPage()` calls `boot()`, which registers; and
  `vi.resetModules()` gives each boot a bus of its own. A unit test that
  called `openExplorePage()` with no page would throw - none does.
- **exports:** `requestRender`, `setRenderer`.
- **tests:** none re-pointed. Proposed: two new unit tests (R1-P4).

## R1.3 now

The Now tab with its hero, its archive after the con, its minute tick - and
the install nudge, which is Now-tab markup (decided).

- **imports:** util `{ esc, fmtShort, minutesBetween, toDate }`; storage
  `{ loadJSON }`; platform `{ IS_IOS, isStandalone }`; state `{ state }`; time
  `{ CON, DAY_LONG, conDayKey, conEnded, conPhase, now }`; venues
  `{ hotelMatches, hotelPhrase, hotelShort, hotelVar, placeHTML }`; data
  `{ events, hotelChips, isNoise }`; picks `{ pickNews, pickNewsHTML, picks }`;
  leave `{ currentLocation, gapHTML, leaveInfo }`; ui `{ chipHTML, rowHTML }`;
  scroll `{ cssEsc }`. It does import `now()`, for `effectiveNow()` and
  `nudgeVisible()`; `heroHTML`, `nowModel`, `statusShown` and `nowSignature`
  take a parameter of that name, which the parser does not confuse with it.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `RING_R` | const | 424 |  |
| `RING_C` | const | 424 |  |
| `ringHTML` | function | 425-433 |  |
| `heroHTML` | function | 435-478 |  |
| `effectiveNow` | function | 484-491 |  |
| `ARCHIVE_SIG` | const | 520 |  |
| `archiveHTML` | function | 521-532 |  |
| `nowModel` | function | 541-555 | yes |
| `statusShown` | const | 557 |  |
| `nowSignature` | function | 561-573 | yes |
| `lastNowSig` | let | 574 |  |
| `renderNow` | function | 576-617 | yes |
| `tickNow` | function | 1434-1456 | yes |
| `NUDGE_SNOOZE_MS` | const | 1476 |  |
| `installPrompt` | let | 1477 |  |
| `nudgeVisible` | function | 1478-1482 |  |
| `nudgeCopy` | function | 1483-1491 | yes |
| `nudgeHTML` | function | 1492-1497 |  |

18 names, 193 declaration lines.

  They come from four places: the hero (424-478) and `effectiveNow` (484-491),
  the archive and the tab itself (520-617), `tickNow` (1434-1456, under
  "Events (the DOM kind)"), and the nudge (1476-1497, under "Offline").
- **reads at import:** nothing. `RING_C` is computed from `RING_R` in the same
  statement.
- **reassigned lets:** `installPrompt`, assigned at three sites in `boot()` -
  see [Assignments from inside boot()](#assignments-from-inside-boot). Three
  functions: `setInstallPrompt(e)`, `clearInstallPrompt()`, and
  `takeInstallPrompt()`, a read-then-clear. After them nothing outside the
  module reads `installPrompt`, so it is private. `lastNowSig` is assigned by
  `renderNow()` and read by `tickNow()`, both inside.
- **stays behind:** the notice above the views (`ARCHIVE_NOTICE_KEY`,
  `archiveNoticeDismissed`, `noticeHTML`, `lastNoticeHTML`, `renderNotice`):
  it shows on every tab, so it is the shell's; it imports `effectiveNow` from
  here. `renderMiniBar` (shell). The nudge's three handlers in `boot()`
  (dispatch): "nudge-later" reads `NUDGE_SNOOZE_MS`, "nudge-install" and the
  two window listeners call the three functions.
- **exports:** `effectiveNow`, `nowModel`, `renderNow`, `tickNow`,
  `NUDGE_SNOOZE_MS`, `nudgeCopy`, `setInstallPrompt`, `clearInstallPrompt`,
  `takeInstallPrompt` (three new). Private: `RING_R`, `RING_C`, `ringHTML`,
  `heroHTML`, `ARCHIVE_SIG`, `archiveHTML`, `statusShown`, `nowSignature`,
  `lastNowSig`, `installPrompt`, `nudgeVisible`, `nudgeHTML`. **Pruned:**
  `nowModel`, `nowSignature`, `renderNow`, `tickNow`, `nudgeCopy`.
  `nowSignature` is in the list today and reached by no test and by nothing
  outside the module, so it becomes private (R1-P6).
- **tests:** `tests/unit/misc.test.js` - `nudgeCopy` from `../../src/now.js`.

## R1.4 browse

- **imports:** util `{ esc, fmtShort }`; state `{ state }`; time `{ CON_DAYS,
  DAY_LABEL, DAY_LONG, conDayKey, now }`; venues `{ hotelShort }`; data
  `{ events, fandomCounts, hotelChips, isNoise, tracks }`; search
  `{ KIND_LABELS, SEARCH_PLACEHOLDER, browseResults, index, processTerm,
  suggestDocs, suggestionsFor }`; ui `{ chipHTML, rowHTML }`; scroll
  `{ chipRowsRestore, chipRowsSnapshot }`.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `PAGE` | const | 41 |  |
| `suggestHTML` | function | 620-634 |  |
| `noExactMatchHTML` | function | 639-652 |  |
| `hiddenForQueryHTML` | function | 657-674 | yes |
| `parsedChipsHTML` | function | 677-685 |  |
| `renderBrowse` | function | 689-766 | yes |
| `SEARCH_DEBOUNCE_MS` | const | 1307 | yes |
| `browseRenderTimer` | let | 1308 |  |
| `queueBrowseRender` | function | 1309-1317 | yes |
| `cancelQueuedBrowseRender` | function | 1319 |  |

10 names, 147 declaration lines.

  From three places: `PAGE` (41, under "Data & constants"), the markup
  helpers and `renderBrowse` (620-766; the "Browse" banner at 687 travels),
  and the debounce (1307-1319, under "Events (the DOM kind)").
- **reads at import:** nothing.
- **reassigned lets:** none from outside. `browseRenderTimer` is assigned by
  `queueBrowseRender()` and `cancelQueuedBrowseRender()`, both inside.
- **stays behind:** `pendingQuery`, `idle`, `scheduleIndexBuild`,
  `indexReady` - loading: they write `BOOT`, touch `#q`, and call
  `queueBrowseRender()`, which they import. `boot()`'s input handler
  (dispatch), which assigns `pendingQuery`, app.js's own let.
- **exports:** `hiddenForQueryHTML`, `renderBrowse`, `SEARCH_DEBOUNCE_MS`,
  `queueBrowseRender`, `cancelQueuedBrowseRender`. Private: `PAGE`,
  `suggestHTML`, `noExactMatchHTML`, `parsedChipsHTML`, `browseRenderTimer`.
  **Pruned:** `hiddenForQueryHTML`, `renderBrowse`, `SEARCH_DEBOUNCE_MS`,
  `queueBrowseRender`.
- **tests:** `tests/unit/query.test.js` - `SEARCH_DEBOUNCE_MS` from
  `../../src/browse.js`; that file then no longer imports app.js. The page
  helper's own `cleanup()` reads `app.SEARCH_DEBOUNCE_MS`: covered.

## R1.5 explore

Explore and the Following feed at its top.

- **imports:** util `{ esc, fmtShort }`; state `{ state }`; time `{ DAY_LONG,
  conDayKey, conEnded, isPast, now }`; data `{ NOISE_TRACKS, byId, events,
  isCeleb }`; picks `{ picks }`; follows `{ FOLLOW_KINDS, eventsFor, followId,
  follows, isFollowing }`; ui `{ rowHTML }`; scroll `{ pageScrollTo,
  pageScrollTop, revealChip, scroller }`; bus `{ requestRender }`.
  `followingByInterest(now)` and `followingByTime(now)` take the moment as a
  parameter; `renderExplorePage()` and `followingHTML()` call `now()`.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `KIND_NOUN` | const | 770 |  |
| `catalogue` | let | 775 |  |
| `buildCatalogue` | function | 776-813 |  |
| `getCatalogue` | const | 814 | yes |
| `EXPLORE_SECTIONS` | const | 817-823 |  |
| `EXPLORE_HEAD` | const | 826 | yes |
| `setExploreHash` | function | 830-835 | yes |
| `readExploreHash` | function | 836-844 | yes |
| `openExplorePage` | function | 845-853 | yes |
| `closeExplorePage` | function | 854-859 |  |
| `tileHTML` | function | 861-867 |  |
| `exploreSectionsHTML` | function | 869-891 |  |
| `exploreJumpHTML` | function | 893-899 |  |
| `SUGGEST_MAX` | const | 905 |  |
| `suggestedFollows` | function | 906-930 |  |
| `suggestedHTML` | function | 931-940 |  |
| `renderExploreGrid` | function | 942-951 |  |
| `pickActiveSection` | function | 956-963 | yes |
| `activeExploreSection` | function | 964-975 |  |
| `markActiveSection` | function | 976-982 | yes |
| `syncActiveSection` | function | 983-986 |  |
| `spyQueued` | let | 990 |  |
| `spyHoldUntil` | let | 990 |  |
| `renderExploreSections` | function | 994-997 |  |
| `smoothScrollTo` | function | 999 |  |
| `scrollToGrid` | function | 1002-1007 |  |
| `scrollToExploreSection` | function | 1009-1016 |  |
| `renderExplorePage` | function | 1018-1053 |  |
| `renderExplore` | function | 1055-1057 | yes |
| `FOLLOWING_PAGE` | const | 1060 |  |
| `followChipsHTML` | function | 1062-1070 |  |
| `followingByInterest` | function | 1072-1096 |  |
| `followingByTime` | function | 1098-1131 |  |
| `followingHTML` | function | 1135-1152 |  |
| `applyExploreHash` | function | 1424-1428 |  |

35 names, 345 declaration lines.

  The Explore section (770-1057) and the Following section (1060-1152), both
  with their banners, and `applyExploreHash` (1424-1428, under "Events (the
  DOM kind)").
- **reads at import:** nothing.
- **reassigned lets:** `spyQueued` (two sites) and `spyHoldUntil` (one), all
  in `boot()` - see [Assignments from inside boot()](#assignments-from-inside-boot).
  Three functions: `queueSpy()`, a read-then-set; `spyDone()`;
  `holdSpyUntil(t)`. `spyQueued` is then private; `spyHoldUntil` is still
  read by the listener, through the live binding. `catalogue` is assigned by
  `buildCatalogue()`, inside.
- **render():** `openExplorePage()` line 851 and `closeExplorePage()` line 857
  call `render()`; both become `requestRender()`. The `pageScrollTo()` that
  follows each is unchanged, and still follows the draw.
- **stays behind:** `boot()`'s scroll listener and the explore actions of its
  click handler (dispatch); `load()`, which calls `buildCatalogue()` and
  `applyExploreHash()`, and the `hashchange` listener, which calls the
  latter.
- **exports:** `buildCatalogue`, `getCatalogue`, `EXPLORE_HEAD`,
  `setExploreHash`, `readExploreHash`, `openExplorePage`, `closeExplorePage`,
  `pickActiveSection`, `markActiveSection`, `syncActiveSection`,
  `spyHoldUntil`, `renderExploreSections`, `scrollToGrid`,
  `scrollToExploreSection`, `renderExplore`, `applyExploreHash`, `queueSpy`,
  `spyDone`, `holdSpyUntil` (three new). Nineteen names are private,
  `spyQueued` among them.
  **Pruned:** `getCatalogue`, `EXPLORE_HEAD`, `setExploreHash`,
  `readExploreHash`, `openExplorePage`, `pickActiveSection`,
  `markActiveSection`, `renderExplore`.
- **tests:** `tests/unit/misc.test.js` - `pickActiveSection` from
  `../../src/explore.js`.

## R1.6 map

After now: `mapNowState()` and `mapCardState()` call `nowModel()`.

- **imports:** util `{ esc, fmtMins, fmtShort, minutesBetween }`; state
  `{ state }`; time `{ CON_DAYS, DAY_LABEL, DAY_LONG, conDayKey, conEnded,
  now }`; venues `{ hotelPhrase, hotelShort, hotelVar, placeHTML }`; data
  `{ events }`; picks `{ picks }`; leave `{ currentLocation, leaveInfo }`; ui
  `{ chipHTML, rowHTML }`; scroll `{ chipRowsRestore, chipRowsSnapshot }`; now
  `{ nowModel }`.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `MAP_W` | const | 190 |  |
| `MAP_VIEW` | const | 195 |  |
| `MAP_STREETS` | const | 196 |  |
| `MAP_HOTELS` | const | 197-205 | yes |
| `MAP_BRIDGES` | const | 207 |  |
| `mapPicksAt` | const | 210 |  |
| `mapCounts` | function | 211-215 |  |
| `mapPillSVG` | function | 218-222 |  |
| `hotelSheetHTML` | function | 223-233 |  |
| `mapNowState` | function | 238-243 |  |
| `mapRingsSVG` | function | 246-255 |  |
| `mapCardState` | function | 261-267 |  |
| `mapCardHTML` | function | 268-289 | yes |
| `offLineHTML` | const | 290 |  |
| `mapOffMapCount` | const | 292 |  |
| `mapSVG` | function | 294-311 |  |
| `mapDay` | function | 315-319 | yes |
| `renderMap` | function | 321-328 | yes |
| `lastMapSig` | let | 334 |  |
| `lastCardSig` | let | 334 |  |
| `mapSignature` | function | 335-337 |  |
| `mapCardSignature` | function | 338-343 |  |
| `tickMap` | function | 344-358 | yes |

23 names, 139 declaration lines.

  The Map section whole (182-358), with its banner.
- **reads at import:** nothing; the geometry is literals.
- **reassigned lets:** none from outside. `lastMapSig` and `lastCardSig` are
  assigned by `renderMap()` and `tickMap()`, inside.
- **stays behind:** `openSheet()`'s hotel panel (the sheet), which imports
  `hotelSheetHTML`, `MAP_HOTELS` and `mapDay`; `boot()`'s map taps
  (dispatch).
- **exports:** `MAP_HOTELS`, `hotelSheetHTML`, `mapCardHTML`, `mapDay`,
  `renderMap`, `tickMap`. Seventeen names are private. **Pruned:**
  `MAP_HOTELS`, `mapCardHTML`, `mapDay`, `renderMap`, `tickMap`.
- **tests:** none by import.

## R1.7 mine

- **imports:** util `{ esc, fmtShort, minutesBetween }`; state `{ state }`;
  time `{ DAY_LONG, conDayKey, now }`; venues `{ hotelVar, walkMin }`; data
  `{ events }`; picks `{ pickNewsHTML, picks }`; leave `{ gapHTML }`; ui
  `{ rowHTML }`.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `HOUR_PX` | const | 1158 | yes |
| `layoutColumns` | function | 1159-1183 | yes |
| `timelineDayHTML` | function | 1185-1232 |  |
| `renderMineTimeline` | function | 1234-1242 |  |
| `renderMine` | function | 1244-1270 |  |
| `fitTimelineBlocks` | function | 1274-1280 |  |

6 names, 117 declaration lines.

  The Mine section whole (1158-1280), with its banner.
- **reads at import:** nothing.
- **reassigned lets:** none.
- **stays behind:** the export and "remove all" actions of `boot()`'s click
  handler (dispatch).
- **exports:** `HOUR_PX`, `layoutColumns`, `renderMine`. Private:
  `timelineDayHTML`, `renderMineTimeline`, `fitTimelineBlocks`. **Pruned:**
  `HOUR_PX`, `layoutColumns`.
- **tests:** `tests/unit/misc.test.js` - `HOUR_PX` from `../../src/mine.js`.
  With `nudgeCopy` and `pickActiveSection` re-pointed too, that file no longer
  imports app.js.

---

## Assignments from inside boot()

Rule 1. Every assignment that crosses a module boundary after rest-1. All six
are in `boot()` - its listeners and its delegated click handler - and none is
in top-level code. (`closeSheet()` assigns `dragY`, and `load()` assigns
`fromNetwork` and `servedOffline`, but those lets and those functions all
stay.)

| line | where in boot() | today | becomes | in |
|---:|---|---|---|---|
| 1600-1601 | the scroll listener | `if (spyQueued) return; spyQueued = true;` | `if (!queueSpy()) return;` | explore |
| 1603 | its `requestAnimationFrame` callback | `spyQueued = false;` | `spyDone();` | explore |
| 1656 | click handler, "nudge-install" | `if (installPrompt) { const p = installPrompt; installPrompt = null; p.prompt(); }` | `const p = takeInstallPrompt(); if (p) p.prompt();` | now |
| 1663 | click handler, "explore-jump" | `spyHoldUntil = performance.now() + 700;` | `holdSpyUntil(performance.now() + 700);` | explore |
| 1875 | the `beforeinstallprompt` listener | `installPrompt = e;` | `setInstallPrompt(e);` | now |
| 1876 | the `appinstalled` listener | `installPrompt = null;` | `clearInstallPrompt();` | now |

The functions, each one assignment:

```js
/* now.js */
function setInstallPrompt(e) { installPrompt = e; }
function clearInstallPrompt() { installPrompt = null; }
function takeInstallPrompt() { const p = installPrompt; installPrompt = null; return p; }

/* explore.js */
function queueSpy() { if (spyQueued) return false; spyQueued = true; return true; }
function spyDone() { spyQueued = false; }
function holdSpyUntil(t) { spyHoldUntil = t; }
```

Line 1604, `if (performance.now() < spyHoldUntil) return;`, is a read and is
unchanged. `takeInstallPrompt()` clears when there is a prompt and when there
is none; today's code clears only when there is one, and clearing a null is
no change.

## render() in a view

Rule 2. Two sites, both in explore, and no others: the parse finds `render`
read by no other name that moves.

| line | function | today | becomes |
|---:|---|---|---|
| 851 | `openExplorePage` | `render();` | `requestRender();` |
| 857 | `closeExplorePage` | `render();` | `requestRender();` |

Nothing in a view imports app.js; `tests/rules/imports.test.js` holds them
to it.

## What the views reach in the shell

Rule 3. **`render()`, and nothing else.** No function that moves calls the
sheet, the notice, `updateFresh()`, the pill, the mini-bar or the header, so
nothing stays behind for that reason. `effectiveNow` would have been a
second - `renderNow()` and `tickNow()` call it - had it stayed with the
notice; it moves instead (R1-P1).

| shell function | reached from | after rest-1 | after rest-2 |
|---|---|---|---|
| `render` | `openExplorePage`, `closeExplorePage` | `requestRender()`, from bus | the same; rest-2 moves `render()` and `boot()` keeps calling `setRenderer()` |

The traffic runs the other way, and rest-2 inherits this list: what each
declaration that stays reaches into a rest-1 module for.

| in app.js | reaches into | names |
|---|---|---|
| `load` | explore | `applyExploreHash` `buildCatalogue` |
| `scheduleIndexBuild` | browse | `queueBrowseRender` |
| `indexReady` | browse | `queueBrowseRender` |
| `render` | scroll | `chipRowsRestore` `chipRowsSnapshot` |
| `render` | now | `renderNow` |
| `render` | browse | `cancelQueuedBrowseRender` `renderBrowse` |
| `render` | explore | `renderExplore` |
| `render` | map | `renderMap` |
| `render` | mine | `renderMine` |
| `noticeHTML` | now | `effectiveNow` |
| `togglePick` | scroll | `cssEsc` `pageScrollBy` |
| `openSheet` | scroll | `pageScrollTop` |
| `openSheet` | map | `MAP_HOTELS` `hotelSheetHTML` `mapDay` |
| `closeSheet` | scroll | `pageScrollTo` |
| `boot` | scroll | `cssEsc` `pageScrollTo` `revealChip` `scroller` |
| `boot` | now | `NUDGE_SNOOZE_MS` `installPrompt` `tickNow` |
| `boot` | browse | `queueBrowseRender` |
| `boot` | explore | `applyExploreHash` `closeExplorePage` `markActiveSection` `openExplorePage` `renderExploreSections` `scrollToExploreSection` `scrollToGrid` `spyHoldUntil` `spyQueued` `syncActiveSection` |
| `boot` | map | `hotelSheetHTML` `mapDay` `tickMap` |

That is the code as it is today. In step two, `boot`'s `installPrompt` and
`spyQueued`, and its assignment of `spyHoldUntil`, become the six calls
above, and `boot` also reaches bus, for `setRenderer`. Nothing that stays
reaches mine except `render`.

## The imports rule, extended

Rule 4. The ordered list in `tests/rules/imports.test.js` becomes the
fourteen leaves and then `scroll`, `bus`, `now`, `browse`, `explore`, `map`,
`mine`. app.js stays the root, imported by `main.js` alone. Under this
manifest every edge points backwards: scroll and bus import nothing; mine
imports leaves alone; now and browse import leaves and scroll; explore adds
bus; map adds now.

## no-unused-vars

Rule 5. `no-unused-vars` with `{args: "none", caughtErrors: "none"}`, added to
the repo's own config through ESLint's API and run over everything
`eslint .` lints, on `next` at the base commit:

**51 files, 0 findings.** With `tools/split/` added, 58 files, 0 findings.

So there is no list to give dispositions to: no stale import, nothing for
review. The run was live: the same configuration over the text of
`src/app.js` with an unused import, an unused function and an unused local
added flagged all three, and did not flag an unused argument or an unused
caught error, which the options exempt. It is clean because leaves
recomputed app.js's import lines after every move; from commit 0 the rule
does that watching itself.

It lands in commit 0 of step two, with the word in DECISIONS #24's title and
the header comment of `eslint.config.js`. `docs/ARCHITECTURE.md`'s ESLint
paragraph ("two rules") follows in the docs commit.

## The split tools

Rule 6. Committed with this part, under `tools/split/`, lint-clean under
today's rules and under `no-unused-vars`:

| file | what it is |
|---|---|
| `scope.js` | the parser: the scope-aware walk everything else stands on |
| `parse.js` | its command line; `--json` is what these tables were generated from |
| `where.js` | the line ranges a list of names occupies now, with the lines at each edge |
| `move.js` | the mover: cuts by line range, refuses a module whose names or imports are not the manifest's |
| `imports.js` | rewrites the root file's import lines from what it references now |
| `partition.js` | the partition check against a base commit |
| `repo.js` | paths, and the module order - read from `tests/rules/imports.test.js`, so there is one list |

They were the scratch scripts of leaves, which survived; consolidated (one
walker, not two), made repo-relative, and checked against results already
known: `partition.js fed41ca` gives leaves' figures again (259 of 262
statements identical, 3 changed, none missing); `imports.js` says app.js's
import lines are already exactly what it would write; `parse.js` agrees with
the scratch parser on all 152 declarations; and in a sandbox copy outside the
repo, with the order extended, `move.js` refused a spec with a wrong import
list, then moved scroll, and `imports.js` rewrote app.js's imports for it.
One bug found and fixed on the way: with no `--root` given, the first name
passed to `where.js` was dropped. The docs slice decides whether they stay.

## Evaluation order in rest-1

Of the 100 declarations that move, two evaluate anything at import:
`scroller` looks up `main`, and `RING_C` is computed from `RING_R` in the same
statement. Everything else is a function, a literal, or a let initialised to
one. So the only change is where `main` is looked up: in scroll.js, which
evaluates before every view and before app.js, because they all import it.
The page helper has the markup in place before anything is imported, and
`vi.resetModules()` re-evaluates scroll with the rest. In a unit test with no
page `scroller` is null, as it is today, and nothing a unit test calls
touches it.

app.js after rest-1 looks up seven elements at import: `#sheetWrap`, `#sheet`,
`#panel-settings`, `#panel-event`, `#panel-hotel`, `#sheetBack`,
`#updatePill`. bus holds one let, null until `boot()` runs.

## Proposals for the review of rest-1

| # | proposal | alternative |
|---|---|---|
| R1-P1 | `effectiveNow` goes to now, and the notice imports it | it stays with the notice, and now reaches into app.js for it - which rule 2 forbids, so it would have to go over the bus or be passed in |
| R1-P2 | the scroll spy keeps its listener in `boot()` and gets three one-line functions: `queueSpy()`, `spyDone()`, `holdSpyUntil(t)` | the listener's body moves into explore as one function, `boot()` registers it, and both lets become private - tidier, but it is dispatch, which is rest-2's |
| R1-P3 | `installPrompt` gets `setInstallPrompt(e)`, `clearInstallPrompt()`, `takeInstallPrompt()` and becomes private | one `setInstallPrompt(value)` for both assignments, with the read at 1656 left to the live binding |
| R1-P4 | bus gets two unit tests, `tests/unit/bus.test.js`: `requestRender()` throws before `setRenderer()`, and calls through after. New tests, not ledger rows: 841 | none; the throw is then checked by nothing |
| R1-P5 | in `tests/rules/imports.test.js` the constant `LEAVES` becomes `ORDER` and the second test's title says "module", since seven of the twenty-one are not leaves | keep the names; the tools read either |
| R1-P6 | `nowSignature` leaves the export list and is not exported by now: no test and nothing outside the module reaches it | export it anyway |

## Completeness of rest-1

`src/app.js` at the base commit, parsed with `tools/split/parse.js`; every
top-level declaration, in file order, with where it goes. Each name appears
once.

Parsed: **152** top-level declarations (93 functions, 38 consts, 21 lets), 14 imports, a 45-name export list and `boot` exported inline. Assigned to rest-1's modules: **100** (scroll 8, now 18, browse 10, explore 35, map 23, mine 6; bus takes nothing, it is new). Staying in app.js: **52**. 100 + 52 = 152.

```
       35  let       pendingQuery              ->  app.js  
       38  const     BOOT                      ->  app.js    [export list]
       40  let       fromNetwork               ->  app.js  
       40  let       servedOffline             ->  app.js  
       41  const     PAGE                      ->  browse  
       46  const     scroller                  ->  scroll  
       47  const     pageScrollTop             ->  scroll    [export list]
    48-53  function  pageScrollTo              ->  scroll    [export list]
       54  function  pageScrollBy              ->  scroll    [export list]
    60-66  function  setTimeOverride           ->  app.js    [export list]
   71-104  function  load                      ->  app.js  
      112  const     idle                      ->  app.js  
  113-124  function  scheduleIndexBuild        ->  app.js  
  125-129  function  indexReady                ->  app.js    [export list]
  131-149  function  updateFresh               ->  app.js    [export list]
  157-161  function  chipRowsSnapshot          ->  scroll  
  162-164  function  chipRowsRestore           ->  scroll  
  168-179  function  revealChip                ->  scroll    [export list]
      190  const     MAP_W                     ->  map     
      195  const     MAP_VIEW                  ->  map     
      196  const     MAP_STREETS               ->  map     
  197-205  const     MAP_HOTELS                ->  map       [export list]
      207  const     MAP_BRIDGES               ->  map     
      210  const     mapPicksAt                ->  map     
  211-215  function  mapCounts                 ->  map     
  218-222  function  mapPillSVG                ->  map     
  223-233  function  hotelSheetHTML            ->  map     
  238-243  function  mapNowState               ->  map     
  246-255  function  mapRingsSVG               ->  map     
  261-267  function  mapCardState              ->  map     
  268-289  function  mapCardHTML               ->  map       [export list]
      290  const     offLineHTML               ->  map     
      292  const     mapOffMapCount            ->  map     
  294-311  function  mapSVG                    ->  map     
  315-319  function  mapDay                    ->  map       [export list]
  321-328  function  renderMap                 ->  map       [export list]
      334  let       lastMapSig                ->  map     
      334  let       lastCardSig               ->  map     
  335-337  function  mapSignature              ->  map     
  338-343  function  mapCardSignature          ->  map     
  344-358  function  tickMap                   ->  map       [export list]
  361-380  function  render                    ->  app.js    [export list]
  382-405  function  renderMiniBar             ->  app.js    [export list]
  407-412  function  updateClock               ->  app.js    [export list]
  416-422  function  fitHeaderLine             ->  app.js  
      424  const     RING_R                    ->  now     
      424  const     RING_C                    ->  now     
  425-433  function  ringHTML                  ->  now     
  435-478  function  heroHTML                  ->  now     
  484-491  function  effectiveNow              ->  now     
      497  const     ARCHIVE_NOTICE_KEY        ->  app.js  
      498  const     archiveNoticeDismissed    ->  app.js  
  499-505  function  noticeHTML                ->  app.js  
      506  let       lastNoticeHTML            ->  app.js  
  507-515  function  renderNotice              ->  app.js    [export list]
      520  const     ARCHIVE_SIG               ->  now     
  521-532  function  archiveHTML               ->  now     
  541-555  function  nowModel                  ->  now       [export list]
      557  const     statusShown               ->  now     
  561-573  function  nowSignature              ->  now       [export list]
      574  let       lastNowSig                ->  now     
  576-617  function  renderNow                 ->  now       [export list]
  620-634  function  suggestHTML               ->  browse  
  639-652  function  noExactMatchHTML          ->  browse  
  657-674  function  hiddenForQueryHTML        ->  browse    [export list]
  677-685  function  parsedChipsHTML           ->  browse  
  689-766  function  renderBrowse              ->  browse    [export list]
      770  const     KIND_NOUN                 ->  explore 
      775  let       catalogue                 ->  explore 
  776-813  function  buildCatalogue            ->  explore 
      814  const     getCatalogue              ->  explore   [export list]
  817-823  const     EXPLORE_SECTIONS          ->  explore 
      826  const     EXPLORE_HEAD              ->  explore   [export list]
  830-835  function  setExploreHash            ->  explore   [export list]
  836-844  function  readExploreHash           ->  explore   [export list]
  845-853  function  openExplorePage           ->  explore   [export list]
  854-859  function  closeExplorePage          ->  explore 
  861-867  function  tileHTML                  ->  explore 
  869-891  function  exploreSectionsHTML       ->  explore 
  893-899  function  exploreJumpHTML           ->  explore 
      905  const     SUGGEST_MAX               ->  explore 
  906-930  function  suggestedFollows          ->  explore 
  931-940  function  suggestedHTML             ->  explore 
  942-951  function  renderExploreGrid         ->  explore 
  956-963  function  pickActiveSection         ->  explore   [export list]
  964-975  function  activeExploreSection      ->  explore 
  976-982  function  markActiveSection         ->  explore   [export list]
  983-986  function  syncActiveSection         ->  explore 
      990  let       spyQueued                 ->  explore 
      990  let       spyHoldUntil              ->  explore 
  994-997  function  renderExploreSections     ->  explore 
      999  function  smoothScrollTo            ->  explore 
1002-1007  function  scrollToGrid              ->  explore 
1009-1016  function  scrollToExploreSection    ->  explore 
1018-1053  function  renderExplorePage         ->  explore 
1055-1057  function  renderExplore             ->  explore   [export list]
     1060  const     FOLLOWING_PAGE            ->  explore 
1062-1070  function  followChipsHTML           ->  explore 
1072-1096  function  followingByInterest       ->  explore 
1098-1131  function  followingByTime           ->  explore 
1135-1152  function  followingHTML             ->  explore 
     1158  const     HOUR_PX                   ->  mine      [export list]
1159-1183  function  layoutColumns             ->  mine      [export list]
1185-1232  function  timelineDayHTML           ->  mine    
1234-1242  function  renderMineTimeline        ->  mine    
1244-1270  function  renderMine                ->  mine    
1274-1280  function  fitTimelineBlocks         ->  mine    
1290-1302  function  togglePick                ->  app.js    [export list]
     1303  const     cssEsc                    ->  scroll  
     1307  const     SEARCH_DEBOUNCE_MS        ->  browse    [export list]
     1308  let       browseRenderTimer         ->  browse  
1309-1317  function  queueBrowseRender         ->  browse    [export list]
     1319  function  cancelQueuedBrowseRender  ->  browse  
     1322  const     sheetWrap                 ->  app.js  
     1323  const     sheetEl                   ->  app.js  
     1324  const     panelSettings             ->  app.js  
     1325  const     panelEvent                ->  app.js  
     1326  const     panelHotel                ->  app.js  
     1327  let       sheetScrollY              ->  app.js  
1329-1337  function  fillSettings              ->  app.js  
1339-1365  function  eventSheetHTML            ->  app.js  
1367-1382  function  openSheet                 ->  app.js    [export list]
1384-1395  function  closeSheet                ->  app.js    [export list]
     1400  const     sheetBackEl               ->  app.js  
     1401  let       dragY                     ->  app.js  
     1401  let       dragT                     ->  app.js  
     1401  let       dragDy                    ->  app.js  
1403-1408  function  setDrag                   ->  app.js    [export list]
1409-1422  function  settle                    ->  app.js  
1424-1428  function  applyExploreHash          ->  explore 
1434-1456  function  tickNow                   ->  now       [export list]
1460-1464  function  syncHeaderHeight          ->  app.js  
     1476  const     NUDGE_SNOOZE_MS           ->  now     
     1477  let       installPrompt             ->  now     
1478-1482  function  nudgeVisible              ->  now     
1483-1491  function  nudgeCopy                 ->  now       [export list]
1492-1497  function  nudgeHTML                 ->  now     
     1504  const     edgeTouch                 ->  app.js  
1505-1510  function  edgeTouchStart            ->  app.js    [export list]
1511-1519  function  edgeTouchMove             ->  app.js    [export list]
     1521  const     updatePill                ->  app.js  
1523-1531  function  showUpdatePill            ->  app.js    [export list]
1532-1537  function  hideUpdatePill            ->  app.js    [export list]
     1541  let       reload                    ->  app.js  
     1542  function  reloadNow                 ->  app.js  
     1545  let       pillY                     ->  app.js  
     1545  let       pillDx                    ->  app.js  
     1545  let       pillDragged               ->  app.js  
     1554  const     RECHECK_MS                ->  app.js  
     1555  let       lastScheduleCheck         ->  app.js  
1556-1573  function  recheckSchedule           ->  app.js    [export list]
1592-1947  function  boot                      ->  app.js    [exported inline]
```

The export list, by destination:

| goes to | count | names |
|---|---:|---|
| scroll | 4 | `pageScrollBy` `pageScrollTo` `pageScrollTop` `revealChip` |
| now | 5 | `nowModel` `nowSignature` `nudgeCopy` `renderNow` `tickNow` |
| browse | 4 | `hiddenForQueryHTML` `queueBrowseRender` `renderBrowse` `SEARCH_DEBOUNCE_MS` |
| explore | 8 | `EXPLORE_HEAD` `getCatalogue` `markActiveSection` `openExplorePage` `pickActiveSection` `readExploreHash` `renderExplore` `setExploreHash` |
| map | 5 | `MAP_HOTELS` `mapCardHTML` `mapDay` `renderMap` `tickMap` |
| mine | 2 | `HOUR_PX` `layoutColumns` |
| app.js | 17 | `BOOT` `closeSheet` `edgeTouchMove` `edgeTouchStart` `hideUpdatePill` `indexReady` `openSheet` `recheckSchedule` `render` `renderMiniBar` `renderNotice` `setDrag` `setTimeOverride` `showUpdatePill` `togglePick` `updateClock` `updateFresh` |

45 names in the list; 28 pruned by rest-1; 17 stay. `boot` is exported inline and stays.

## app.js after rest-1

What rest-2 starts from. It replaces the "app.js after leaves" table that
ended this document: of that table's eleven areas, the five "view:" areas
became now, browse, explore, map and mine, and the scroller and chip rows
became scroll. Declaration lines only - the comments and blank lines between
them are not counted; the file is 1,965 lines in all today.

| area | names | declaration lines | names (* = in the export list) |
|---|---:|---:|---|
| loading and freshness | 12 | 95 | `pendingQuery` `BOOT`* `fromNetwork` `servedOffline` `load` `idle` `scheduleIndexBuild` `indexReady`* `updateFresh`* `RECHECK_MS` `lastScheduleCheck` `recheckSchedule`* |
| shell: render, header, clock, notice | 12 | 101 | `setTimeOverride`* `render`* `renderMiniBar`* `updateClock`* `fitHeaderLine` `ARCHIVE_NOTICE_KEY` `archiveNoticeDismissed` `noticeHTML` `lastNoticeHTML` `renderNotice`* `togglePick`* `syncHeaderHeight` |
| shell: the sheet | 16 | 94 | `sheetWrap` `sheetEl` `panelSettings` `panelEvent` `panelHotel` `sheetScrollY` `fillSettings` `eventSheetHTML` `openSheet`* `closeSheet`* `sheetBackEl` `dragY` `dragT` `dragDy` `setDrag`* `settle` |
| shell: pill, edge guard, reload | 11 | 37 | `edgeTouch` `edgeTouchStart`* `edgeTouchMove`* `updatePill` `showUpdatePill`* `hideUpdatePill`* `reload` `reloadNow` `pillY` `pillDx` `pillDragged` |
| boot | 1 | 356 | `boot` |

52 names (26 functions, 13 consts, 13 lets), 683 declaration lines of the file's 1654.

Its imports after rest-1: the leaves it still uses, and all seven new
modules; no npm package. Its reads at import: the seven elements above. Its
lets: 13, none read outside the file. `boot()` is 356 lines on its own and is
where dispatch lives: the click and input handlers, the sheet's drag, the
pill's drag, the worker's messages, the timers, and the handle.

What rest-2 inherits from the two slices before it, beyond the code: eleven
functions that exist because an importer cannot assign a binding - leaves'
`setOverride`, `replaceSchedule`, `replacePicks`, `replaceNews`, `clearNews`
and `replaceFollows`, and rest-1's six - and the bus, which is the first of
them to carry a call upwards; search writing into `state.browse` and onto the
event objects; the table above of what the shell reaches into each view for;
and, of the 17 names left in the export list, the ones no test reaches by
name (`closeSheet`, `indexReady`, `openSheet`, `recheckSchedule`, `render`,
`renderMiniBar`, `renderNotice`, `setTimeOverride`, `showUpdatePill`), which
are rest-2's to prune or keep.
