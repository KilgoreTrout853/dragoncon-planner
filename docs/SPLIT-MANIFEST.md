# Split manifest: leaves

A working document for the module split (DECISIONS #23, #24; plan step 4c).
It is step one of the "leaves" slice: the plan step two follows, commit by
commit. The docs slice decides whether it stays in the repo.

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
- They take **132** of the 275 declarations and **57** of the 97 export-list
  names. **143** declarations stay, 40 of them in the export list, plus `boot`.
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
- Proposals that go beyond the brief are collected in
  [Proposals for the review](#proposals-for-the-review).

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
3. `tests/rules/imports.test.js`, new, if the review keeps it (rule 8). See
   [The imports rule](#the-imports-rule).

**Commits 1-14 - one module each**, in the order above. Each commit:

1. creates `src/<module>.js` holding the module's *takes*, in the order they
   have in app.js today, cut and pasted by block (CLAUDE.md 9) - never
   renamed, never found-and-replaced. `now`, `pad`, `index`, `events` and
   `reload` are shadowed names: `leave` takes three functions with a `now`
   parameter and must not import `now`; `ui`'s `revealChip` has a local `pad`;
   `boot()` has locals called `now`, `data` and `reloadWith`.
2. adds `export` to the names listed under *exports*, and the module's
   `import` lines, exactly the ones listed under *imports*;
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
imports rule's tests; the time commit removes one (the Time-section rule);
every other commit leaves the count alone.

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
| `BOOT` | const | 97 | yes |
| `settings` | const | 108 | yes |
| `state` | const | 113-120 | yes |

3 names, 10 declaration lines.

- **reads at import:** localStorage `dc26.settings` (`settings`), then
  `dc26.mineView`, `dc26.followingLayout`, `dc26.followingOpen` and
  `settings.hideNoise` (`state`). `settings` stays above `state`.
- **reassigned lets:** none. All three are consts whose properties are
  written, which an importer may do.
- **stays behind:** from the same run of lines (91-121): `pendingQuery` (93) -
  assigned by `indexReady()` and by `boot()`'s input handler, read by nothing
  else, so it is the shell's; `fromNetwork` and `servedOffline` (111) -
  assigned by `load()` and `boot()`, read by `load()` and `updateFresh()`
  only; `PAGE` (121) - the browse view's page size. None is read by a leaf, so
  none needs a setter.
- **exports:** `BOOT`, `settings`, `state`. **Pruned:** all three.
- **tests:** none by import (`page.app.BOOT` everywhere, and in the helper's
  own `cleanup()`: covered).
- **Note (P4).** `BOOT` sits among the search constants (97). It is written by
  `load()` and `scheduleIndexBuild()`, which stay, and read by tests. Nothing
  in a leaf needs it; it comes here because it is state, and leaving it would
  be as correct.

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
  `setTimeOverride()`, which stays. Replaced by an exported
  `setOverride(value)` holding lines 342-343 (the assignment and the session
  write that `initTimeOverride()` pairs it with); `setTimeOverride()` calls it
  and carries on. `parseMoment` then has no reader outside the module. The
  narrow alternative: `setOverride` holds line 342 alone and line 343 stays in
  app.js, which then also imports `writeSession` (P7). Reads of `timeOverride`
  from app.js - `setTimeOverride()`'s URL sync, `fillSettings()` - go through
  the live binding, unchanged.
- **stays behind:** `setTimeOverride` (341-351): resets `state.browse.day`
  and `state.map.day`, calls `render()` and `updateFresh()`. One of the known
  two. `DATA_URL` (316) leaves the section for data.
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
  section (Loading) is being taken apart, and leaving it would be as correct.

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

Shared markup and DOM helpers the views call, none of which draws a view.

- **imports:** util `{ esc, fmt }`; state `{ state }`; time `{ DAY_LABEL }`;
  venues `{ hotelVar, placeHTML }`; data `{ isCeleb }`; picks `{ picks }`.
  **Not** `pad`: `revealChip()` has a local of that name.
- **takes:**

| name | kind | app.js line(s) | in the export list |
|---|---|---:|---|
| `scroller` | const | 126 |  |
| `pageScrollTop` | const | 127 | yes |
| `pageScrollTo` | function | 128-133 | yes |
| `pageScrollBy` | function | 134 | yes |
| `CELEB_BADGE` | const | 270 |  |
| `chipRowsSnapshot` | function | 547-551 |  |
| `chipRowsRestore` | function | 552-554 |  |
| `revealChip` | function | 558-569 | yes |
| `rowHTML` | function | 816-839 |  |
| `highlighter` | function | 841-846 |  |
| `snippetFor` | function | 847-859 |  |
| `chipHTML` | function | 1187-1192 |  |
| `cssEsc` | const | 2099 |  |

13 names, 80 declaration lines.

- **reads at import:** `document.querySelector("main")` (`scroller`).
- **reassigned lets:** none.
- **stays behind:** everything that draws or touches the shell: `render`,
  `renderMiniBar`, `updateClock`, `fitHeaderLine`, `syncHeaderHeight`, the
  sheet (`sheetWrap` ... `settle`), the edge guard and the pill (see
  platform).
- **exports:** `scroller`, `pageScrollTop`, `pageScrollTo`, `pageScrollBy`,
  `CELEB_BADGE`, `chipRowsSnapshot`, `chipRowsRestore`, `revealChip`,
  `rowHTML`, `chipHTML`, `cssEsc`. Private: `highlighter`, `snippetFor`.
  **Pruned:** `pageScrollTop`, `pageScrollTo`, `pageScrollBy`, `revealChip`.
- **tests:** none by import (`page.app.pageScrollTo` and friends in shell:
  covered).
- **Note (P10).** The brief names `ui` without its contents. This is every
  helper that more than one view calls and that needs nothing from app.js:
  the scroller, the chip rows, `rowHTML` with its two helpers, `chipHTML`,
  `CELEB_BADGE`, `cssEsc`. `rowHTML` reads `state.sheetId` and `picks`, both
  earlier leaves; it reads no view.

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
| 11 | `rowHTML`, `highlighter`, `snippetFor`, `chipHTML`, `CELEB_BADGE`, `cssEsc` | Rendering, Now, helpers, DOM events | every view | ui |
| 12 | `BOOT` | among the search constants, 97 | `load()`, `scheduleIndexBuild()`, tests | state |
| 13 | `fandomCounts` | Loading, 516 | `renderBrowse()` | data |

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
keys) -> follows (one key) -> ui (`main`) -> app.js (seven elements). So
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
picks, follows, ui and app.js are the seven modules with such a read.

What surprised me:

1. **app.js after leaves reads nothing from a leaf at import.** Its
   module-level work is seven element lookups and constants (`RING_C` from
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
   import time and util and never reach app.js, so its seven element lookups
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
| state | 3 | `BOOT` `settings` `state` |
| time | 10 | `CON` `CON_DAYS` `conDayKey` `conEnded` `conPhase` `DAY_LONG` `initTimeOverride` `isSimulated` `now` `TIME_OVERRIDE_KEY` |
| venues | 9 | `cleanRoom` `hotelGroup` `hotelMatches` `hotelPhrase` `hotelShort` `LEAVE_BUFFER_MIN` `placeHTML` `WALK` `walkMin` |
| data | 3 | `isCeleb` `isNoise` `NOISE_TRACKS` |
| picks | 4 | `reconcilePicks` `samePlace` `savePickNews` `savePicks` |
| follows | 6 | `eventsFor` `FOLLOW_KINDS` `followId` `isFollowing` `saveFollows` `toggleFollow` |
| leave | 2 | `currentLocation` `leaveInfo` |
| search | 8 | `activeFilters` `browseResults` `expandQuery` `parseQuery` `SEARCH_PLACEHOLDER` `STOPWORDS` `suggestionsFor` `termQuality` |
| ui | 4 | `pageScrollBy` `pageScrollTo` `pageScrollTop` `revealChip` |
| app.js | 40 | `closeSheet` `edgeTouchMove` `edgeTouchStart` `EXPLORE_HEAD` `getCatalogue` `hiddenForQueryHTML` `hideUpdatePill` `HOUR_PX` `indexReady` `layoutColumns` `MAP_HOTELS` `mapCardHTML` `mapDay` `markActiveSection` `nowModel` `nowSignature` `nudgeCopy` `openExplorePage` `openSheet` `pickActiveSection` `queueBrowseRender` `readExploreHash` `recheckSchedule` `render` `renderBrowse` `renderExplore` `renderMap` `renderMiniBar` `renderNotice` `renderNow` `SEARCH_DEBOUNCE_MS` `setDrag` `setExploreHash` `setTimeOverride` `showUpdatePill` `tickMap` `tickNow` `togglePick` `updateClock` `updateFresh` |

97 names in the list; 57 pruned by the leaves; 40 stay. `boot` is exported inline and stays.

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

Twelve of the forty names that stay are reached by no test through `app.` or
an import today (`closeSheet`, `indexReady`, `nowSignature`, `openSheet`,
`queueBrowseRender`, `recheckSchedule`, `render`, `renderMap`,
`renderMiniBar`, `renderNotice`, `setTimeOverride`, `showUpdatePill`): the
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
deleted (one test fewer), and `tests/PORT-LEDGER.md` rows 1890 and 1892 -
whose destination is that rule - are amended by hand to say ESLint.

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

Rule 8, proposed: `tests/rules/imports.test.js`, node environment, reading the
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
through "rest", when views will be tempted to import each other. Struck if
the review says so.

## Proposals for the review

Where this manifest decided something the brief left open, or differs from it:

| # | proposal | alternative |
|---|---|---|
| P1 | `loadJSON`/`saveJSON` go to storage, not util | util, as the brief's list has it; storage then holds only the two session helpers |
| P2 | `readSession`/`writeSession` leave the Time section for storage | stay in time |
| P3 | `CON_DAYS`, `DAY_LABEL`, `DAY_LONG` go to time | data - but picks, search and ui need them, and time is earlier than all three either way |
| P4 | `BOOT` goes to state | stays in app.js; nothing in a leaf needs it |
| P5 | `deviceLine` goes to build, so build imports platform | stays in app.js with `fillSettings()` until "rest" |
| P6 | lines 388-402 of `load()` become `replaceSchedule(data)` in data | six setters, or one `setSchedule({...})`; `load()` keeps the block and data imports only time |
| P7 | `setOverride(value)` takes lines 342-343 | line 342 alone; app.js keeps the session write and imports `writeSession` |
| P8 | `placeHTML` and `hotelVar` go to venues | ui - but ui is last, and build, picks and leave are not the ones that need them; either works |
| P9 | `gapHTML` and `nextPickInConDay` go to leave | ui, or stay |
| P10 | ui is the scroller, the chip rows, `rowHTML` and its helpers, `chipHTML`, `CELEB_BADGE`, `cssEsc` | a narrower ui (DOM helpers only), with the shared markup staying in app.js until "rest" |
| P11 | `KIND_LABELS` and `SEARCH_PLACEHOLDER` go to search with the vocabulary run; `fandomCounts` to data | any of the three stays in app.js; none is needed by a leaf except `KIND_LABELS` (by `buildIndex`) |
| P12 | `samePlace` stays in picks | venues, which spares `tests/unit/venues.test.js` a second import line |

CLAUDE.md rule 6 applies to step two's PR: `docs/ARCHITECTURE.md`'s Repo map,
"The client" ("One script. Everything below is in `src/app.js`", "Its only
import is MiniSearch", the Time paragraph's pointer to the rules test), the
ESLint paragraph under Tests and the third Sharp edge all become untrue as
the commits land. Whether they are fixed in that PR or in the docs slice is
the review's call; rule 6 as written says that PR.

## Completeness

`src/app.js` parsed with Vite's `parseAst`; every top-level declaration, in
file order, with where it goes. Each name appears once.

Parsed: **275** top-level declarations (151 functions, 88 consts, 36 lets) across 262 declaration statements - a few declare several names. The file's other two top-level statements are the `minisearch` import and the export list. Assigned to modules: **132** (util 8, storage 4, platform 2, build 4, state 3, time 15, venues 14, data 11, picks 10, follows 7, ics 6, leave 5, search 30, ui 13). Staying in app.js: **143**. 132 + 143 = 275.

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
       97  const     BOOT                      ->  state     [export list]
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
      126  const     scroller                  ->  ui      
      127  const     pageScrollTop             ->  ui        [export list]
  128-133  function  pageScrollTo              ->  ui        [export list]
      134  function  pageScrollBy              ->  ui        [export list]
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
  547-551  function  chipRowsSnapshot          ->  ui      
  552-554  function  chipRowsRestore           ->  ui      
  558-569  function  revealChip                ->  ui        [export list]
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
     2099  const     cssEsc                    ->  ui      
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
97 names, each once, 57 to the leaves and 40 staying; `boot` is exported
inline and stays.

## app.js after leaves

What "rest" starts from. Declaration lines only - the comments and blank lines
between them are not counted, and the file is 2,793 lines in all today.

| area | names | declaration lines | names (* = in the export list) |
|---|---:|---:|---|
| loading and freshness | 11 | 108 | `pendingQuery` `fromNetwork` `servedOffline` `load` `idle` `scheduleIndexBuild` `indexReady`* `updateFresh`* `RECHECK_MS` `lastScheduleCheck` `recheckSchedule`* |
| shell: render, header, clock, notice | 13 | 113 | `setTimeOverride`* `render`* `renderMiniBar`* `updateClock`* `fitHeaderLine` `effectiveNow` `ARCHIVE_NOTICE_KEY` `archiveNoticeDismissed` `noticeHTML` `lastNoticeHTML` `renderNotice`* `togglePick`* `syncHeaderHeight` |
| shell: the sheet | 16 | 94 | `sheetWrap` `sheetEl` `panelSettings` `panelEvent` `panelHotel` `sheetScrollY` `fillSettings` `eventSheetHTML` `openSheet`* `closeSheet`* `sheetBackEl` `dragY` `dragT` `dragDy` `setDrag`* `settle` |
| shell: pill, edge guard, reload | 11 | 37 | `edgeTouch` `edgeTouchStart`* `edgeTouchMove`* `updatePill` `showUpdatePill`* `hideUpdatePill`* `reload` `reloadNow` `pillY` `pillDx` `pillDragged` |
| view: map | 23 | 139 | `MAP_W` `MAP_VIEW` `MAP_STREETS` `MAP_HOTELS`* `MAP_BRIDGES` `mapPicksAt` `mapCounts` `mapPillSVG` `hotelSheetHTML` `mapNowState` `mapRingsSVG` `mapCardState` `mapCardHTML`* `offLineHTML` `mapOffMapCount` `mapSVG` `mapDay`* `renderMap`* `lastMapSig` `lastCardSig` `mapSignature` `mapCardSignature` `tickMap`* |
| view: now (hero, archive, nudge, tick) | 17 | 185 | `RING_R` `RING_C` `ringHTML` `heroHTML` `ARCHIVE_SIG` `archiveHTML` `nowModel`* `statusShown` `nowSignature`* `lastNowSig` `renderNow`* `tickNow`* `NUDGE_SNOOZE_MS` `installPrompt` `nudgeVisible` `nudgeCopy`* `nudgeHTML` |
| view: browse | 10 | 147 | `PAGE` `suggestHTML` `noExactMatchHTML` `hiddenForQueryHTML`* `parsedChipsHTML` `renderBrowse`* `SEARCH_DEBOUNCE_MS`* `browseRenderTimer` `queueBrowseRender`* `cancelQueuedBrowseRender` |
| view: explore and following | 35 | 345 | `KIND_NOUN` `catalogue` `buildCatalogue` `getCatalogue`* `EXPLORE_SECTIONS` `EXPLORE_HEAD`* `setExploreHash`* `readExploreHash`* `openExplorePage`* `closeExplorePage` `tileHTML` `exploreSectionsHTML` `exploreJumpHTML` `SUGGEST_MAX` `suggestedFollows` `suggestedHTML` `renderExploreGrid` `pickActiveSection`* `activeExploreSection` `markActiveSection`* `syncActiveSection` `spyQueued` `spyHoldUntil` `renderExploreSections` `smoothScrollTo` `scrollToGrid` `scrollToExploreSection` `renderExplorePage` `renderExplore`* `FOLLOWING_PAGE` `followChipsHTML` `followingByInterest` `followingByTime` `followingHTML` `applyExploreHash` |
| view: mine | 6 | 117 | `HOUR_PX`* `layoutColumns`* `timelineDayHTML` `renderMineTimeline` `renderMine` `fitTimelineBlocks` |
| boot | 1 | 356 | `boot` |

143 names (88 functions, 34 consts, 21 lets), 1641 declaration lines of the file's 2361.

Its imports: all fourteen leaves, and no npm package (the `minisearch` import
leaves with search). Its reads at import: `#sheetWrap`, `#sheet`,
`#panel-settings`, `#panel-event`, `#panel-hotel`, `#sheetBack`,
`#updatePill`. Its lets: 21, none of them read outside the file. `boot()` is
356 lines on its own and is where dispatch lives: the click and input
handlers, the sheet's drag, the pill's drag, the worker's messages, the
timers, and the handle.

What "rest" inherits from this slice, beyond the code: the five new setter
functions and `replaceSchedule`, which are the first piece of the bus; search
writing into `state.browse` and onto the event objects; and twelve
export-list names no test reaches by name.
