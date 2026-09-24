# Identity and sync: the client recon

Describes `next` at c860f38, the merge of PR #50, as of 2026-09-24.

What the client keeps and how it changes, taken before Identity and sync
is designed (ROADMAP, tentpole 4; DECISIONS #30, #37): every key it
stores, every way picks and follows change, the clock, the hooks a pull
could attach to, what exists for install and notifications, the channel
stamp, a change log for 2026 sized, and the backend's absence. It names
files and functions, not lines. A record, written by hand and held fresh
by nothing; the recon changed no code. Where it only expects, as in which
keys sync, the design decides.

## 1. Baseline

- `next` at `c860f386901cfe9c9f2570b9cb64e9448c4417ae`, the merge of
  PR #50: the client switch by year (#49), the last of Pipeline shape.
- `npm run lint` is clean. Vitest: 1,014 passed and 4 skipped, in 38
  files. `python -m pytest tests/`: 513 passed and 1 skipped.
- The client is built for `DC_YEAR`, 2026 where it is unset
  (`build/vite-dc.js`, `DEFAULT_YEAR`), so every key below is `dc26.` and
  the worker's cache `dc26-v6`. The next site is built with
  `DC_CHANNEL=next` and no `DC_YEAR` (ARCHITECTURE.md, Build and deploy):
  2026's as well, its cache `dc26-next-v6` and its clock key
  `dc26.timeOverride.next`. An unstamped build writes a `dist/index.html`
  of 140,442 bytes, the same bytes when built again.
- The live site on `main` is the 2026 one-file app, on the same origin
  (#15), and it keeps the same twelve key names under `dc26.`
  (section 10).

## 2. What the client persists

Eleven keys in `localStorage` and one in `sessionStorage`, each `dc<yy>.`
and a name, `<yy>` the last two digits of the build's year (#49). Every
read and write goes through `src/storage.js` - `loadJSON()`, `saveJSON()`,
`readSession()` and `writeSession()` - and each swallows its errors: a
value that will not parse reads as the fallback, and a write that throws
(private browsing, a full quota) is dropped without a word. "Import" below
means once, as the module is imported, before `boot()` runs, and never
again while the page is open; nothing listens for the `storage` event.
Values are shown as they are stored. The sync? column is this report's
expectation and its reason; the design decides.

| Key | Module | Shape, with an example | Read | Written by | sync? |
|---|---|---|---|---|---|
| `dc<yy>.picks` | `picks` | The starred ids, in the order starred: `["1e3995157984a4c0e6515a2ed630f116"]` | import, into the `Set` `picks` | `savePicks()` | **yes** - the reader's plan (#9) |
| `dc<yy>.pickInfo` | `picks` | Each pick as it was at the last save, by id, with `"removed":true` once the news has said so: `{"1e3995157984a4c0e6515a2ed630f116":{"title":"GameCube Night","start":"2026-09-03T19:00","location":"Westin Augusta A-B"}}` | import | `savePicks()`, which rebuilds it for every pick from the loaded schedule and keeps an old entry only where the schedule lacks the id | **no** - a snapshot of the schedule, this device's baseline for the news |
| `dc<yy>.pickNews` | `picks` | The reports not yet dismissed, each `kind` `gone`, `removed`, `merged` or `moved`, with `was` and `now` where the kind has them: `[{"kind":"gone","title":"GameCube Night","was":"Thu 7:00 PM, Westin Augusta A-B"}]` | import | `savePickNews()` | **no** - derived from the schedule and the snapshot |
| `dc<yy>.follows` | `follows` | `{kind, key}`, in the order followed: `[{"kind":"track","key":"Animation"},{"kind":"work","key":"12-monkeys"},{"kind":"axis","key":"genre:comedy"},{"kind":"person","key":"brendon-lee"}]` | import, kept by shape (`wellFormedFollow()`) | `saveFollows()` | **yes** - standing interests, by id (#39) |
| `dc<yy>.settings` | `state` | `{"crowd":1.3,"hideNoise":true}` | import; that default where the key is absent | `onCrowdInput()` and `onNoiseDefaultChange()` in `src/sheet.js`, the whole object | **per device** (#27 and #32 expect otherwise) |
| `dc<yy>.mineView` | `state` | `"timeline"` or `"list"` | import | `onMainClick()` in `src/dispatch.js` (`view-timeline`, `view-list`) | **per device** - a view |
| `dc<yy>.followingLayout` | `state` | `"interest"` or `"time"` | import | `onMainClick()` (`fol-interest`, `fol-time`) | **per device** - a view |
| `dc<yy>.followingOpen` | `state` | `true` or `false` | import | `onMainClick()` (`fol-toggle`) | **per device** - a view |
| `dc<yy>.bigtext` | `boot`, `shell` | `true` or `false` | by `boot()` | `onBigTextChange()` in `src/shell.js` | **per device** - this screen's text size |
| `dc<yy>.archiveNoticeDismissed` | `shell` | The year whose "has ended" notice was dismissed: `2026` | each notice render once the con has ended | `onMainClick()` (`dismiss-archive`), by the shell's `ARCHIVE_NOTICE_KEY` | **per device** - a notice |
| `dc<yy>.nudgeSnoozedUntil` | `now` | Epoch milliseconds, `now()` plus 604,800,000, a week | each render and tick of Now, by `nudgeVisible()` | `onMainClick()` (`nudge-later`) | **per device** - installing is per device |
| `dc<yy>.timeOverride`, or `dc<yy>.timeOverride.<channel>` on a stamped build, in `sessionStorage` | `time` | The moment as given: `2026-09-05T13:05`, `2026-09-05T14:15:00-04:00` | by `initTimeOverride()`, which `boot()` calls; `?now=` wins over it | `initTimeOverride()`, which writes back what it read or removes it, and `setOverride()` | **never** - a developer's clock, per tab |

**Settings' fields.** Two. `crowd` is the walk multiplier, the Settings
sheet's slider (1 to 2.5, in tenths), which `walkMin()` in `src/venues.js`
applies to every walk; 1.3 by default. `hideNoise` is whether Search hides
photo sessions and video-room screenings by default - the Epic Photos and
Video Room tracks, and titles that begin "Photo session"; true by default,
and copied into `state.browse.hideNoise` as it is read and when it
changes. The stored object is used whole, not merged with the default
(section 10). Larger text is a key of its own, `dc<yy>.bigtext`, so that
nothing that resets settings shrinks it.

**Kept, but in no key.** The worker's caches, `dc<yy>-v6` - or
`dc<yy>-<channel>-v6` on a stamped build - hold the shell, the year's
`events.v2.json` and the fonts (`public/sw.js`). `load()` in
`src/loading.js` reads the schedule from them itself only where its fetch
fails and no worker answered.

## 3. How picks and follows change

Every site under `src/` that adds, deletes, replaces or clears picks or
follows: every write to the exported `picks` Set and `follows` array, and
every call of `replacePicks()`, `replaceFollows()` and `toggleFollow()`.
The pick news changes too - `reconcilePicks()` adds to it, and the OK
button (`dismiss-news`) and the handle's `news` clear or replace it, each
followed by `savePickNews()` - but it holds no pick.

| Site | Where | What changes | Save | Who saves |
|---|---|---|---|---|
| A row's star | `togglePick(id, anchor)` in `src/shell.js`, called by `onMainClick()` (a row anywhere in `main`) and `onHotelPanelClick()` (a row in the hotel sheet) in `src/dispatch.js` | One id added or deleted on the exported `Set` | `savePicks()` | The caller, shell |
| The event sheet's star, `#sheetStar` | `onEventPanelClick()` in `src/dispatch.js` | The same, written out there rather than through `togglePick()`; only the sheet's panel is redrawn | `savePicks()` | The caller, dispatch |
| Mine's Remove all, `data-act="clear"` | `onMainClick()`, after `confirm()` | Every pick: `replacePicks([])` | `savePicks()` | The caller, dispatch |
| Settings' Remove all picks, `#resetPicks` | `onResetPicks()` in `src/sheet.js`, after `confirm()` | Every pick: `replacePicks([])` | `savePicks()` | The caller, sheet |
| The handle's `picks.set(ids)` | The handle `boot()` returns, in `src/boot.js`: the tests' way in, since `src/main.js` drops the handle | The whole set: `replacePicks(ids)` | `savePicks()` | The caller, boot |
| Reconciliation, with no user action | `reconcilePicks()` in `src/picks.js`, called by `load()` | A pick whose id left the file is deleted; one whose id is in an event's `was` is deleted and that event's id added; a report for each | `savePicks()` and `savePickNews()` where anything changed; `savePicks()` alone where a pick has no snapshot | The module, picks |
| A follow's button or chip | `toggleFollow(kind, key)` in `src/follows.js`, called by `onMainClick()`: the Explore page's Follow button (`toggle-follow`) and the Following feed's chip (`unfollow`) | One follow spliced out, or pushed where `canFollow()` allows; a refused add returns false and saves nothing | `saveFollows()` | The module, follows |
| The handle's `follows.set(list)` | The handle, in `src/boot.js`: the tests' | The whole list: `replaceFollows(list)`, a copy | `saveFollows()` | The caller, boot |
| The shape filter, with no user action | `wellFormedFollow()` in `src/follows.js`, as the module is imported | A stored follow of the wrong shape - v1's fandom, topic and person-by-name follows (#39) - left out of the list in memory | None: the next `saveFollows()` writes the list without it | Nobody, then |

**One door, for the write.** `savePicks()` is the only code that writes
`dc<yy>.picks`, and every site above that changes picks calls it;
`saveFollows()` is the only code that writes `dc<yy>.follows`, and both
sites that change follows call it. So every persisted change passes
through one function for picks and one for follows - but neither is told
what changed. Each takes no argument and writes the whole state:
`savePicks()` the set, and a `pickInfo` rebuilt for every pick;
`saveFollows()` the list. The change happens before the call, outside the
function: the exported `Set` is changed in place in three modules, shell,
dispatch and picks. `savePicks()` also runs where no pick changed, when
`reconcilePicks()` backfills a missing snapshot. And two of the changes
that pass through the doors are nobody's tap: reconciliation's deletions
and re-points, and, at the reader's next follow, the shape filter's drops.

**What an outbox at the doors would need.** Neither door carries the
change, so an outbox hooked at `savePicks()` and `saveFollows()` would
have to keep its own copy of the last-saved state and diff the state
against it on each call, to learn which ids and which follows were added
and which removed. The call sites would be unchanged: every change already
reaches a door. What the diff cannot tell is why. A pick `reconcilePicks()`
deleted, one it re-pointed - a deletion and an addition - and a follow the
shape filter dropped would each read exactly as the reader's own tap.

## 4. The clock

Everything in this list is in `src/time.js` unless it says otherwise.

- `now()`, the one read of the current moment: a copy of the override
  where one is set, `new Date()` where none is. Its callers are in
  `browse`, `dispatch`, `explore`, `ics`, `loading`, `map`, `mine`, `now`,
  `search` and `shell`, and in `time.js` itself, as `conPhase()`'s default
  and in `effectiveNow()`; the handle gives it to the tests. `leave.js`
  never imports it: its functions take the moment as a parameter.
- `effectiveNow()`: before the con, the preview moment - the first full
  day at 10:00 - and the banner that says so; otherwise `now()`. Called by
  `renderNow()` and `tickNow()` in `src/now.js` and by `noticeHTML()` in
  `src/shell.js`.
- `conPhase(at = now())` - before, live or ended - with `conEnded()`,
  `isPast(e, at)`, and `conDayKey(d)`, the con day that runs to 5 AM.
- The override. `?now=<ISO>` in the URL, or the session key
  `TIME_OVERRIDE_KEY`: `dc<yy>.timeOverride`, with `.<channel>` added on a
  stamped build. `initTimeOverride()`, which `boot()` calls, takes the
  URL's where there is one and the session's otherwise, parses it
  (`parseMoment()`: a moment that does not parse is none) and writes it
  back to the session, or removes it. `setOverride(value)` sets it, keeps
  the session key and writes `now=` into the URL with
  `history.replaceState`, leaving the hash alone. `setTimeOverride(value)`
  in `src/shell.js` calls it, then lets the day chips follow the clock
  again, redraws and updates the freshness line. Its callers are
  `onApplyPreview()` and `onClearPreview()` in `src/dispatch.js`, the
  Settings sheet's preview controls; `onSimChipClick()` in the shell, the
  header's chip, which clears it; and the handle. `fillSettings()` in
  `src/sheet.js` reads the exported `timeOverride` for the preview input.
  A simulated clock stands still.
- Stopwatch reads are `performance.now()`, not the clock: the boot
  timings (`loading`), the scroll spy's hold (`dispatch`, `explore`) and
  the sheet's drag (`sheet`).

**The rule.** `eslint.config.js`, `no-restricted-syntax`, whose `CLOCK`
list holds two selectors: `new Date` with no argument, and `Date.now()`.
They are given for `src/**/*.js` with `ignores: ["src/time.js"]`, so
`src/time.js` is the one exemption; the `PAGE` selectors are given again
beside them, because a later config object replaces an earlier one's
options for a rule. A `Date` built from a value - `new Date(iso)`,
`new Date(ms)` - is arithmetic and allowed. The rule applies under `src/`
only: not to `public/sw.js`, which reads no clock today, nor to `tests/`,
`tools/` or `build/`.

**What the rule does not see.** `deviceLine()` in `src/build.js` builds
`new Date(document.lastModified)`: a value, so the rule passes it, but
`document.lastModified` is the page's Last-Modified header, or the current
time where the response carried none. It is shown in the Settings sheet's
device readout, and nowhere else. And the two stamps the app keeps or
writes out are `now()`'s: the nudge snooze, stored as `now()` plus a week,
and the calendar export's `DTSTAMP` (`downloadICS()` in `src/ics.js`).
Under a simulated clock both carry the simulated moment.

**Where a real-clock read would live.** In `src/time.js`, beside `now()`.
It is the one file the rule's clock selectors skip, so a read of the real
clock there - `new Date()` or `Date.now()`, whatever the override - clears
the rule by the exemption the file already has, and every other module
would import it as it imports `now()`: the rule stays whole, with no new
exemption and no disabling comment. Anywhere else under `src/` the same
read fails `npm run lint`. Today the file's one such read is inside
`now()`, taken only when no override is set, so no export gives the real
time while a simulated clock runs.

## 5. The refresh hooks

**The recheck**, `recheckSchedule()` in `src/loading.js`. `boot()`
registers two triggers: `onVisibleRecheck()` on `visibilitychange`, which
rechecks only when `document.visibilityState` is `visible`, and
`onPageShow()` on `pageshow`, which always does; the handle exposes
`recheckSchedule` too. It first brings the freshness line up to date
(`updateFresh()`), then returns unless 15 minutes, `RECHECK_MS`, have
passed since the last check - and `boot()` counts loading as one
(`markScheduleChecked()`). Past that, it fetches the year's file with
`cache: "no-cache"`. With a worker in control, the worker answers from its
cache and revalidates behind it (below). With none, the page compares the
file with `meta` itself - `scheduleChanged()`: the digests where both have
one, else `generated_at` - and on a change takes the two stamps, updates
the freshness line and shows the update pill. A failed fetch says
nothing. Nothing is redrawn under the reader: the pill offers a reload.

**The other hooks.** `boot()` registers `onVisibleRender()` in
`src/shell.js` on `visibilitychange` before the recheck - a redraw
whenever the page is not hidden - and `onMinute()` in `src/dispatch.js`
every 60 seconds, which redraws the clock, the notice, Now's or the Map's
tick and the mini-bar, and updates the freshness line.

**The worker's messages.** `revalidateData()` in `public/sw.js` runs on
every fetch of the year's file that passes through the worker - `load()`'s
at boot and the recheck's - serves the cached copy, fetches the network
behind it and posts to every window client (`includeUncontrolled: true`).
A response that is not ok, or a first copy with nothing cached, posts
nothing.

| Message | When | What `onWorkerMessage()` in `src/loading.js` does |
|---|---|---|
| `schedule-updated`, with `digest` and `generated_at` | The fetched copy's digest differs from the cached copy's; `generated_at` decides where a copy has no digest | `meta` takes the two stamps, the freshness line is updated, the pill shows |
| `schedule-online` | The fetched copy is the same | `servedOffline` false; the freshness line updated |
| `schedule-offline` | The network fetch failed | `servedOffline` true; the line says "offline copy" |

`boot()` adds the message listener, and on window `load` the worker's
registration (`onLoadRegisterWorker()`), only where
`navigator.serviceWorker` exists.

**Reconciliation's call site.** One: `load()`, once per page load - after
`replaceSchedule()`, the Explore catalogue and the `#explore=` hash, and
before the freshness line and the first draw. Not on a recheck, and not on
`schedule-updated`, which only shows the pill; the reload the pill offers
runs `load()` again. The handle exposes `reconcilePicks` for the tests.

**What a sync pull would inherit**, attached to these hooks as they are:

- The 15-minute threshold is measured with `now()`, the app's clock, not a
  stopwatch. A simulated clock stands still, so after `boot()`'s mark no
  trigger passes the threshold until the override moves 15 minutes on or
  is cleared, and a clock set back holds it off until the clock is 15
  minutes past the mark. On the real clock it is 15 minutes of wall time,
  the time in the background included.
- The triggers are a return to the page - `visibilitychange` to visible,
  `pageshow` - and the worker's messages, which follow only a fetch of the
  schedule through the worker. Nothing fetches while the page stays in
  front: the minute tick redraws and fetches nothing.
- `reconcilePicks()` runs only in `load()`. A schedule that changes while
  the page is open reaches the picks, the snapshots and the news only
  after a reload, which the pill offers and never forces.

## 6. Install and notifications

**What exists.**

- The install nudge, in `src/now.js`: the first card on Now while
  `nudgeVisible()` says so - the page is not running from the home screen
  (`isStandalone()`, in `src/platform.js`) and the nudge is not snoozed -
  and never after the con. `nudgeCopy()` has three wordings: for an
  iPhone, Safari's Share, then Add to Home Screen, and Open in Safari
  first from a chat app's browser; for a browser that has offered an
  install prompt, an Install app button; and for any other, the browser
  menu's Install app. Not now (`nudge-later`, in `onMainClick()`) snoozes
  it for a week, `NUDGE_SNOOZE_MS`, in `dc<yy>.nudgeSnoozedUntil`,
  measured with `now()`.
- The install prompt, in `src/now.js` as well: `onBeforeInstallPrompt()`
  keeps the browser's `beforeinstallprompt` event and redraws Now,
  `onAppInstalled()` drops it, and `takeInstallPrompt()` reads and clears
  it for `nudge-install`, the Install app button's tap in `onMainClick()`,
  which calls its `prompt()`. `boot()` registers the two listeners on
  `window`. `src/platform.js` holds only `IS_IOS` and `isStandalone()`.
- The worker's registration: `onLoadRegisterWorker()` in `src/loading.js`
  registers `./sw.js` on window `load`, and logs a failure with
  `console.warn` rather than swallowing it.
- The worker, `public/sw.js`: three listeners, `install`, `activate` and
  `fetch`. The `fetch` listener lets every request that is not a GET, and
  every request to another origin but the Google Fonts hosts, go to the
  network untouched.
- The manifest, `public/manifest.json`: `display` standalone, `start_url`
  and `scope` `./`.

**What does not exist.** Counted with a case-sensitive `grep` on c860f38:

| Name | `src/` | `public/` | `index.html` |
|---|---|---|---|
| `Notification` | 0 | 0 | 0 |
| `pushManager` | 0 | 0 | 0 |
| `PushSubscription` | 0 | 0 | 0 |
| `applicationServerKey` | 0 | 0 | 0 |

In `public/sw.js`, a `push` listener: 0; `notificationclick`: 0;
`showNotification`: 0. Case-insensitive, "notification" is nowhere in the
three, and "push" only as an array's `push()` and once in a comment in
`src/styles.css`.

## 7. The channel stamp

**Where the channel is read.** `src/build.js`, as it is imported:
`metaContent("dc-channel")` and `metaContent("dc-build")` read
`index.html`'s two metas into `BUILD`, `{channel, id}`. `dcBuild()` in
`build/vite-dc.js` stamps them where `DC_CHANNEL` is set, and the worker's
`CHANNEL` with them; an unstamped page carries both empty.

**Where the year is built.** `src/season.js`: `YEAR`, from `__DC_YEAR__`,
and `YY`, its last two digits. Nothing more: no module holds a key
prefix, and each key is spelled where it is used, as `dc${YY}.` and its
name.

**The count.** `dc${YY}` is written 24 times under `src/`. 23 are storage
keys, in nine modules: the eleven `localStorage` keys at 22 sites, and the
clock's session key at one, `TIME_OVERRIDE_KEY` in `src/time.js`. The 24th
is the calendar export's UID in `src/ics.js`,
`dc<yy>-<id>@dragoncon-planner`, which is not storage. The 23:

| Module | Where | Keys |
|---|---|---|
| `src/state.js` | As it is imported | `settings`, `mineView`, `followingLayout`, `followingOpen`: 4 |
| `src/picks.js` | As it is imported; `savePicks()`; `savePickNews()` | `picks`, `pickInfo`, `pickNews`; `picks`, `pickInfo`; `pickNews`: 6 |
| `src/follows.js` | As it is imported; `saveFollows()` | `follows`, twice: 2 |
| `src/time.js` | `TIME_OVERRIDE_KEY`, as it is imported | `timeOverride`, with the channel: 1 |
| `src/boot.js` | `boot()` | `bigtext`: 1 |
| `src/shell.js` | `ARCHIVE_NOTICE_KEY`, which dispatch imports; `onBigTextChange()` | `archiveNoticeDismissed`; `bigtext`: 2 |
| `src/now.js` | `nudgeVisible()` | `nudgeSnoozedUntil`: 1 |
| `src/sheet.js` | `onCrowdInput()`, `onNoiseDefaultChange()` | `settings`, twice: 2 |
| `src/dispatch.js` | `onMainClick()`: `nudge-later`, `fol-toggle`, `fol-interest` and `fol-time`, `view-timeline` and `view-list` | `nudgeSnoozedUntil`, `followingOpen`, `followingLayout`, `mineView`: 4 |

**The existing pattern.** One key carries the channel today:
`src/time.js` imports `BUILD` from `src/build.js` and builds
`TIME_OVERRIDE_KEY` as `dc<yy>.timeOverride`, with `.<channel>` added
where `BUILD.channel` is set - `dc26.timeOverride.next` on the next site.
The worker's caches carry it as well, by `public/sw.js`'s
`CACHE_PREFIX`, `dc<yy>-<channel>-`.

**The order (#29).** `ORDER` in `tests/rules/imports.test.js` begins
`season`, `util`, `storage`, `platform`, `build`, `state`, `time`, and a
module imports only the modules before it. `season` is first and imports
nothing of ours, only `virtual:season`, so it cannot read `BUILD`: a
prefix built there cannot carry the channel as the order stands. Nor can
`storage`, third, where `loadJSON()` and `saveJSON()` are. `build` is
fifth, before every module that spells a key - `state`, `time`, `picks`,
`follows`, the views, `sheet`, `shell`, `dispatch` and `boot.js` - so any
of them may import it, as `time` does.

**The tests that assert the key names as they are.**

- `tests/page/year.test.js`: `dc${YY}.picks` and `.pickInfo` after a
  star, and `dc${YY}.follows` after a follow set through the handle;
  `TIME_OVERRIDE_KEY` is `dc${YY}.timeOverride`; and every key in both
  storages begins `dc${YY}.`.
- `tests/page/devmark.test.js`: `dc26.timeOverride` on an unstamped page;
  on a stamped one `dc26.timeOverride.next`, and nothing under the key
  without the channel.
- `tests/build.test.js`: the 2027 build, in a temporary copy, keeps a star
  under `dc27.picks`, every `localStorage` key begins `dc27.` and
  `sessionStorage` holds exactly `dc27.timeOverride`; and the worker's
  cache names, `dc26-next-v6` stamped and `dc27-v6` for 2027.
- `tests/worker.test.js`: the caches the worker names and clears, with and
  without a channel, across years.
- `tests/rules/source.test.js`: no `dc26` anywhere in `src/`.
- The page tests that seed or read a key by its literal name, `dc26.` and
  the name: `archive` (`archiveNoticeDismissed`), `follows` (`follows`,
  `followingLayout`, `followingOpen`), `mine` (`mineView`), `now`
  (`picks`), `nudge` (`nudgeSnoozedUntil`), `pick-news` (`picks`,
  `pickInfo`, `pickNews`), `settings` (`bigtext`), `sheet` (`picks`) and
  `time` (`timeOverride`); and `removed`, which spells them
  `dc${YY}.picks`, `.pickInfo` and `.pickNews`.

## 8. A `changes.jsonl` for 2026

**Nothing writes one.** The only writer of `changes.jsonl` is
`pipeline.py`, the orchestrator, for a live year, and `contract.md` (The
files) gives frozen 2026 none: no `source.json`, `ids.jsonl`,
`changes.jsonl` or `last-run.json`. Nothing under `data/`, `tools/` or
`tests/` writes change lines for the 34 replayed 2026 versions.

**Where PR #41's kinds came from.** PR 7b's plan stop: a read-only script
outside the repo, in that session's scratch folder, which replayed the 34
versions as `tools/replay_2026.py` does, built each with the code of the
day, and counted the kinds with a prototype of the diff written before
`diff_stage.py` existed. Not a test and not a tool. PR #41's description
holds the table, under "Evidence from the plan stop (read-only probes, not
committed)"; no file came out.

**Run again for this report** with the real `diff_stage.diff()`, by a
throwaway script, not committed. The counts are the same:

| Kind | Lines, v1 → v2 to v33 → v34 |
|---|---|
| `added` | 50 |
| `removed` | 24 |
| `restored` | 5 |
| `cancelled` | 2 |
| `time` | 15 |
| `place` | 8 |
| `title` | 62 |
| `people` | 84 |
| `description` | 331, 303 of them v8 → v9 |
| `tracks`, `uncancelled`, `merged` | 0 |

581 lines, every one `source`, and no `DiffError`. Five pairs move the
digest with no line - v17 → v18, v21 → v22, v22 → v23, v27 → v28 and
v28 → v29 - which PR #41 put down to order-only rows. With v1 as a
season's first run, its 3,428 events each `added`, the whole log is 4,009
lines and 653,506 bytes; the 581 after v1 are 115,310 bytes. Reading the
history takes about 2 seconds, the replay and the 34 builds about 21, and
the diffs under half a second.

**Sizing `tools/replay_changes_2026.py`**, not built:

- **What it reads.** `schedule_history.gather()`, the git reading. Each
  version made raw rows by `replay_2026.to_raw()`, the conversion PR 4
  proved exact, carried by `scraper.carry()` and given ids by
  `ids_stage.assign()` - `replay_2026.replay()` does those three, the
  ledger in a temp folder. `registry.load()` and 2026's
  `tags.cache.jsonl`, `venues.json` and `prompt_version`, loaded once;
  `events_v2.build()` for each version; `diff_stage.diff()` between each
  version and the one before, the stamp the version's `generated_at` and
  the SHA its commit's; `diff_stage.render()`.
- **The cache misses.** The cache holds the frozen file's inputs, so an
  earlier text misses: 376 events are untagged at v1 and 373 to 388 in
  each version to v8; 75 at v9, the version after the description fix, 70
  of them live; and 13 at v34, every one a removed event carried at last
  sight. Harmless: the diff never logs tags.
- **The cause.** Every version is built by today's code, so the
  attribution document, `events_v2.attribution()`, is the previous build
  itself, and every line is `source`. 2026's code changes were the
  scraper's, and they are in the rows, where no attribution can see them
  (`contract.md`, The diff, as built: v8 → v9's 303 descriptions and
  v4 → v5's seven titles).
- **The workaround.** A per-version flag, `fetch_code_changed`, on each
  run a `scraper.py` commit precedes: the flag a live run records in
  `last-run.json`, which `contract.md` has the push job read, suppressing
  that run. `gather()` already returns `scraper.py`'s commits on `main`:
  six, which flag four runs. The first is v1's own commit, a season's
  first run, `false` by the contract, and two land before v9.

  | Run | Its `scraper.py` commits | Its lines |
  |---|---|---|
  | v5 | `52692ff`, the dedupe merge: v5's own commit | 8: `description` 1, `title` 7 |
  | v9 | `b14c611`, the cancelled flag, and `c77bbe1`, the descriptions | 307: `added` 1, `description` 303, `restored` 2, `title` 1 |
  | v12 | `5b03eef`, the QA sweep | 39: `added` 2, `description` 1, `people` 4, `removed` 1, `title` 31 |
  | v34 | `290464f`, the archive merge: v34's own commit | 0 |

  354 of the 581 lines are in flagged runs, and a flag holds a run back
  whole: v9's two `restored` lines, the James Callis sessions' return
  (#43), are the source's, and go with the 303.
- **The SHA.** #47's `sha` is the code's. A bot's 2026 commit holds data
  the code at its parent wrote, while v1, v5 and v34 are commits that
  changed code and data together, so the tool has to say which it
  records.
- **Two homes, neither chosen here.**
  - A committed fixture under `tests/`, trimmed to the 581 lines after v1,
    115,310 bytes, with a 34-entry version index. CI's checkout is
    shallow, so nothing in CI could make it again: like `replay-2026.md`,
    it would be a record.
  - A tool run by hand, its output gitignored: nothing committed, and a
    clone with `main`'s history makes it in about 25 seconds.
- **About its size.** 100 to 150 lines, importing `replay_2026`'s reading
  and `schedule_history`'s; a test of 60 to 100 lines on
  `tests/mini_history.py`, as `tests/test_replay_2026.py` runs the replay.
  The throwaway that made the counts above is under 90 lines.

## 9. Backend absence

On c860f38 the first backend PR starts from nothing:

- No `supabase/` directory.
- `package.json`: one dependency, `minisearch` 7.2.0, and the dev tools -
  `eslint`, `globals`, `jsdom`, `vite`, `vite-plugin-singlefile` and
  `vitest`. No `@supabase/supabase-js`, and `package-lock.json` names no
  Supabase package.
- `git grep` over the tracked files, `supabase` and `VAPID`
  case-insensitive:

| Term | Hits |
|---|---|
| `supabase` | 6, in docs alone: DECISIONS.md's #9, #23, #25 (twice) and #27, and VISION.md's learning list. No code, config or workflow. |
| `VAPID` | 0 |
| `SUPABASE_` | 0 |
| `.env` | `.gitignore`'s `.env` line. The rest are `process.env` in `build/vite-dc.js` and `tests/build.test.js`, and `os.environ` in the Python. No `.env` file is tracked, and none is on disk. |

- The repository's secrets are `ANTHROPIC_API_KEY` and
  `SCHEDULE_BOT_TOKEN`, and its one variable is `SCRAPE_TARGET`, `next`:
  nothing for a backend. The workflows are `ci.yml` and `scrape.yml`.
- The page's one request to another origin is Google Fonts
  (ARCHITECTURE.md, Sharp edges), and the worker lets any other
  cross-origin request pass untouched (section 6).

## 10. Findings

**Where the brief was wrong.**

- `src/platform.js` holds no install prompt: only `IS_IOS` and
  `isStandalone()`. The prompt is `src/now.js`'s -
  `onBeforeInstallPrompt()`, `onAppInstalled()`, `takeInstallPrompt()` -
  and the Install app tap is `onMainClick()`'s `nudge-install`. And the
  nudge is not the iPhone's alone: it has three wordings, and shows on any
  browser where the page is not running from the home screen.
- `src/season.js` builds `YY` and no key prefix. A channel in the keys
  would touch the 23 key sites in nine modules, not two places, and
  `season.js`, first in the order, cannot read the channel (section 7).
- The recheck has two triggers, `visibilitychange` and `pageshow`.
- PR #41's kinds came from a prototype at its plan stop, not from
  `diff_stage.py`; the real diff gives the same counts (section 8).
- The reading list left out `src/dispatch.js`, `src/sheet.js` and
  `src/now.js`, which hold most of the writes: the event sheet's star,
  both Remove alls, both settings handlers, the three view keys, the
  archive notice and the nudge snooze.

**Settings.**

- #27 says the crowd factor syncs with the reader's settings and the job
  applies it, default 1.0; #40 leaves no job applying it and says nothing
  of the sync. The client's default is 1.3. #32 has the profile's weights
  sync only as settings, after the email upgrade.
- The stored settings object is used whole, not merged with the default:
  a field added later is undefined for every reader who saved settings
  before it existed.

**Keys and writes the brief's lists would have missed.**

- The event sheet's star, `#sheetStar` in `onEventPanelClick()`: a pick
  written without `togglePick()`.
- The shape filter in `src/follows.js`, which drops stored follows as the
  module is imported, with no save; the next follow saves the drop.
- No listener for the `storage` event. A second tab keeps its own copy of
  every key until it reloads, and the last whole-state save wins.
- The live site on `main` keeps the same twelve names under `dc26.` on the
  same origin (#15; #39's Cost). Until `DC_YEAR` is 2027 on `next`, the
  next site's picks, follows and settings are the live site's, and a sync
  tried there would read and write the live site's plan.

**Surprising.**

- `savePicks()` rebuilds every pick's snapshot from the loaded schedule on
  each call, not only the starred one's.
- The recheck's 15-minute threshold runs on `now()` (section 5).
- `new Date(document.lastModified)` in `src/build.js` passes the clock
  rule and reads the wall clock where the response has no Last-Modified
  header (section 4).
- The nudge snooze and the calendar's `DTSTAMP` are stamped by `now()`:
  simulated where the clock is.
- Six `scraper.py` commits flag four replayed runs: one is v1's own
  commit, and two share v9 (section 8).
- The worker passes every request that is not a GET, and every other
  origin's but the fonts', straight to the network: a backend's requests
  would reach it unchanged and uncached.
- Every storage call swallows its error: a save that fails is silent.
