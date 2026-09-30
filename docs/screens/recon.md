# Screens recon — the client at screen grain

A record of the client's screens as they stood when Where things live
(ROADMAP tentpole 5) opened: `next` at 7968d96, read from the code, not
from the docs. `docs/scope-2027.md` section 1 says what the app does at
feature grain; this file says where each thing is on screen, which
function draws it and which `state` key drives it. Written by hand, not
held fresh by CI.

Conventions. A claim names its file and function as `file.js` `fn()`; a
`state` key is written `state.browse.day`; a stored key is its
`storageKey()` name, `"picks"`, which is `dc<yy>.picks` on disk and
`dc<yy>.picks.<channel>` on a stamped build (`build.js` `storageKey()`).
"A tap" is a click the delegated handler hears: `dispatch.js`
`onMainClick()` for anything under `main`, unless another handler is named.
"Redraws" means `shell.js` `render()`, reached directly or over the bus
(`bus.js` `requestRender()`). Where a doc and the code disagree, the
section says so under **Doc and code**. UNSURE marks what the code cannot
settle; every UNSURE is listed again at the end.

**Dev-only affordances**, listed here once and set aside everywhere below:

| Affordance | Where | Owner |
|---|---|---|
| The `?now=<ISO>` override | The address; kept for the tab's session under `"timeOverride"` (sessionStorage) | `time.js` `initTimeOverride()`, `setOverride()` |
| The preview time | Settings, Advanced: a `datetime-local` (`#previewTime`), Apply preview time (`#applyPreview`), Use real time (`#clearPreview`) | `sheet.js` `fillSettings()`; `dispatch.js` `onApplyPreview()`, `onClearPreview()`; `shell.js` `setTimeOverride()` |
| The simulated-time chip | The header line, `#simChip`, "simulated time ×"; a tap goes back to the real clock | `shell.js` `updateClock()`, `onSimChipClick()` |
| The dev-build mark | A fixed pill, bottom right above the nav, "dev build · <channel> · <id>", on a build stamped with a channel only; takes no taps | `build.js` `devMarkHTML()`, inserted by `boot.js` `boot()` |
| The device readout | Settings, Advanced, the last line, `#deviceLine` | `build.js` `deviceLine()`, filled by `sheet.js` `fillSettings()` |

The con's phase decides much of what follows: `time.js` `conPhase()` is
`before`, `live` or `ended` against `CON`, which runs from 18:00 on the
season file's first day to 19:00 on its last. Before the con, the Now tab
and its tick use `time.js` `effectiveNow()`, which pins the moment to the
first full day at 10:00 and supplies the preview banner; every other tab
uses `now()`.

## 1. The shell

The page skeleton is `index.html`: a fixed `header.hdr`, then `main` (the
scroller) holding `#notice` and the five `section.view`s, then
`#updatePill`, `#minibar`, `nav.nav`, and `#sheetWrap` with the sheet.
`boot.js` `boot()` appends the dev-build mark to `body`.

### Header (`header.hdr`, fixed)

Top to bottom, left to right:

| Element | Id | Drawn by | Driven by |
|---|---|---|---|
| The brand, "Dragon Con 2026", a small uppercase label | `#brand` | Text fixed in `index.html` (a build for another year rewrites it: `build/vite-dc.js`, `dcBuild`); shown only on Now by `shell.js` `render()` | `state.tab === "now"` |
| The clock: short weekday and time, "Sat 1:05 PM" | `#clock` | `shell.js` `updateClock()`, on every `render()` and every minute (`dispatch.js` `onMinute()`) | `now()` — not `effectiveNow()`, so before the con the header shows the real time while Now previews Thursday |
| The freshness line: " · 3,459 events · refreshed 2 h ago", "· offline copy" when served from the cache, "final schedule" after the con, and the waiting copy's day and time when it postdates a simulated clock | `#fresh` | `loading.js` `updateFresh()`, on load, every minute, on a recheck and on the worker's messages | `meta.generated_at`, `events.length`, `servedOffline`, `conEnded()` |
| The simulated-time chip (dev-only) | `#simChip` | `shell.js` `updateClock()` | `time.js` `isSimulated()` |
| The gear, a 44 px icon button, right | `#settingsBtn` | `index.html` | A tap: `sheet.js` `onSettingsClick()` → `openSheet("settings")` |

The line never wraps: `scroll.js` `fitHeaderLine()` adds `.tight`, which
hides the word "refreshed", then `.tighter`, a size down, by measurement.
The header's height is measured into `--hdr-h` by `scroll.js`
`syncHeaderHeight()`, on the moments `boot()` lists (a frame after boot,
resize, orientation change, load, fonts ready, a `ResizeObserver` on
`.hdr`), after every `render()` and after every `updateFresh()`.

### The notice (`#notice`, top of `main`, scrolls)

`shell.js` `renderNotice()`, called by `render()` and every minute, redrawn
only when its HTML changes. Three states, from `shell.js` `noticeHTML()`:

- **Before the con**: the preview banner from `time.js` `effectiveNow()`:
  "Con starts Thursday. Showing Thursday 10:00 AM as a preview. Use Settings
  to preview any other time."
- **Live**: nothing; hidden.
- **After the con**: "Dragon Con 2026 has ended. Your starred events are on
  the Now tab as your 2026 schedule." with an OK button
  (`data-act="dismiss-archive"`), on every tab, until OK; `dispatch.js`
  `onMainClick()` saves `CON.year` under `"archiveNoticeDismissed"`.

### The update pill (`#updatePill`, fixed, above the nav)

"Schedule updated · tap to refresh". Shown by `loading.js`
`showUpdatePill()` when the worker posts `schedule-updated`
(`onWorkerMessage()`), or, with no worker controlling the page, when
`recheckSchedule()`'s own fetch finds a new digest (`generated_at` for a
copy with none). A tap reloads the page (`onPillClick()` → `reloadNow()`);
a sideways swipe past 60 px dismisses it (`onPillTouchStart()`,
`onPillTouchMove()`, `onPillTouchEnd()`). It never redraws the schedule in
place. It sits higher when the mini-bar shows (`body.has-minibar
.update-pill`). This is B20's offer of a newer schedule.

### The tab bar (`nav.nav`, fixed, bottom)

From `index.html`, in order. Each is a `button[data-tab]` with a 24 px
stroke icon above its label; the ids are what `state.tab` holds.

| Order | `data-tab` | Label | Icon | View section | Drawn by |
|---|---|---|---|---|---|
| 1 | `now` | Now | A clock face | `#view-now` | `now.js` `renderNow()` |
| 2 | `browse` | Search | A magnifier | `#view-browse` | `browse.js` `renderBrowse()` |
| 3 | `explore` | Explore | Four rounded squares | `#view-explore` | `explore.js` `renderExplore()` |
| 4 | `map` | Map | A folded map | `#view-map` | `map.js` `renderMap()` |
| 5 | `mine` | Mine | A star, and the pick-count badge `#mineBadge` | `#view-mine` | `mine.js` `renderMine()` |

- A tap: `shell.js` `onNavClick()` sets `state.tab`, redraws and scrolls
  `main` to the top. `render()` sets `aria-current="page"` on the active
  button, hides every other view, and calls the one view's function; only
  the active tab is drawn.
- The badge is `picks.size`, hidden at zero (`render()`), and so counts a
  pulled pick the schedule does not know yet (DECISIONS #53).
- The first tab is `state.tab`'s initial value, `"now"` (`state.js`).

### The gear

The header's right-hand button, on every tab. It opens the sheet's
Settings panel (section 3). It is the only way to Settings.

### The mini-bar (`#minibar`, fixed, above the nav) — B11

`shell.js` `renderMiniBar()`, at the end of every `render()` and every
minute (`dispatch.js` `onMinute()`; on the Map through the same call, where
it hides itself).

- **Which tabs**: Search, Explore and Mine. Not on Now or Map
  (`state.tab`), not before the schedule has loaded, and not once
  `conEnded()`.
- **What it shows**: the next pick that starts later in the current con
  day, from `leave.js` `nextPickInConDay(now())` — nothing if there is none
  today — as its title, its place (`venues.js` `placeHTML()`, in the hotel's
  colour) and, right, one of: "leave now", "leave by 2:35 PM", or "in 47
  min" (`util.js` `fmtMins()`). The leave-by comes from `leave.js`
  `leaveInfo(currentLocation(now), next, now)` (section 5). `.late` turns
  the time the warn colour. Its accessible name is "Next: <title>, <when>.
  Go to Now."
- **Where its tap goes**: `shell.js` `onMiniBarClick()` sets `state.tab =
  "now"`, redraws and scrolls to the top.
- It adds `body.has-minibar`, which lengthens `main`'s end spacer and lifts
  the update pill and the dev-build mark.

**Doc and code.** `docs/scope-2027.md` B11 says the bar shows "when it
starts"; the code shows a relative time ("in 47 min") or a leave-by, never
the start's clock time.

### Who owns what

| Element | Module |
|---|---|
| `render()`, the tab bar's handler, the clock, the notice, the mini-bar, the simulated-time chip, larger text, `togglePick()`, the iOS edge guard | `shell.js` |
| The freshness line, the update pill, the load, the recheck | `loading.js` |
| The header's measurement, the scroller | `scroll.js` |
| The sheet and its three panels | `sheet.js` |
| The delegated handlers on `main`, the sheet panels' clicks, the hash, the minute tick | `dispatch.js` |
| The dev-build mark, the device readout | `build.js` |

## 2. The five tabs, top to bottom

Only the Search, Explore and Map tabs have sticky parts: a
`.controls-sticky` block that parks under the header at `top:
var(--hdr-h)`. Everything else scrolls with `main`. Chip rows scroll
sideways and keep their offset across a redraw (`scroll.js`
`chipRowsSnapshot()`, `chipRowsRestore()`, keyed by `data-row`); a tapped
chip is brought into view (`revealChip()`).

A tap on any row's body (`.row-main`) opens the event sheet
(`openSheet("event", id)`); a tap on its star toggles the pick
(`shell.js` `togglePick()`, which keeps the row under the finger). These
two hold on every tab and are not repeated below.

### Now (`now.js`) — during the con, and before it

`now.js` `renderNow()`, from `effectiveNow()`, the model `nowModel(now)`.
Nothing sticky.

1. **The install nudge**, `nudgeHTML()`: section 7.
2. **Your picks changed**, `picks.js` `pickNewsHTML()`: a warn-bordered
   notice, "Your picks changed in the last schedule refresh.", one line per
   change (removed, gone, merged, moved), and OK
   (`data-act="dismiss-news"`, which clears `"pickNews"`). Drawn from the
   `pickNews` list `picks.js` `reconcilePicks()` fills at load.
3. **The hero**, `heroHTML()`, when a pick is on now or later in today's
   con day (`model.heroEv`): a button (`data-hero`) — a countdown ring
   (`ringHTML()`: minutes, or hours at 60 and over), the kicker "On now" or
   "Your next", the title, the place, and a line under it:
   - on now, the next pick in another building: "leave the Hyatt by 2:35
     PM" or "leave the Hyatt now", and "then: Hilton at 3:00 PM";
   - on now otherwise: "ends 2:00 PM", and "then: Hilton next" when there
     is a next pick;
   - nothing on: "starts 3:00 PM", and the walk estimate "~12 min from the
     Westin" when the previous pick today was in another building.
   `.late` colours the ring and line with the warn colour. A tap opens the
   hero's event sheet.
4. **Rest of your day**, when there are other picks today (`model.rest`):
   the title "Rest of your day" with "<n> today", then a compact list; before
   each row a gap line (`leave.js` `gapHTML()`, section 5) measured from the
   pick above it, the hero first; each row carries a status, "On now, ends
   2:00 PM" or "In 25 min", only when it is on or starts within 90 minutes.
5. **Or, with nothing left today**: "Nothing picked for later today. Your
   next pick is on Saturday." and that pick's row with its day
   (`model.later`); **or, with no picks ahead at all**: "Nothing picked for
   later today. Star things in Search and they show up here with walk
   times."
6. **On now and in the next hour**: the title with a count; a hotel chip row
   (`data-row="now-hotel"`: All, then one chip per hotel group present in the
   data, `data.js` `hotelChips`, each in its hotel's colour; `state.now.hotel`;
   a tap also resets `state.now.limit` to 80); then a compact list of every
   event on now or starting within 60 minutes, photo sessions and screenings
   left out while `state.browse.hideNoise` is on, under time heads, "On now"
   and "Starts 1:30 PM". The first `state.now.limit` rows (80); a "Show <n>
   more" button (`data-act="more-now"`) adds 100. Empty: "Nothing on in this
   window" and "at the <hotel>" under a hotel chip.

The minute tick, `now.js` `tickNow()` (from `dispatch.js` `onMinute()`,
only while the sheet is closed), redraws the whole tab when
`nowSignature()` changes, and otherwise replaces the hero if its HTML
changed and rewrites the "In N min" statuses in place.

Taps that leave the tab: none. The hero and the rows open the event sheet;
Install app opens the browser's install prompt.

### Now (`now.js`) — after the con

`now.js` `archiveHTML()`, when `conEnded()`: the picks-changed notice;
"Your 2026 schedule" with a count; every pick not removed by con day, under
day heads, rows as anywhere else (`list: "archive"`); empty: "Nothing
starred. Star things in Search and they'll be listed here by day." No hero,
no nudge, no "On now", no tick after the first redraw.

### Search (`browse.js`, the `browse` tab)

`browse.js` `renderBrowse()`, results from `search.js` `browseResults()`.
On the first draw with `state.browse.day === null` it sets the day to the
current con day, or the first full day outside con week. The sticky block is
built once and the box is never replaced (so an open iOS keyboard survives);
later draws refill `#dayChips` and `#browseRest` around it.

**Sticky** (`.controls-sticky`):

1. **The search box**, `#q`, placeholder "Search titles, guests, fandoms,
   words" (`search.js` `SEARCH_PLACEHOLDER`), or "indexing…" in italics
   until the index is built (`loading.js` `indexReady()`); `state.browse.q`.
   Typing is `dispatch.js` `onMainInput()`: it clears `showHidden`,
   `showPast` and `noToday`, moves `state.browse.day` to All on the first
   character (keeping it in `prevDay`) and back when the box is cleared, and
   queues the draw 70 ms later (`queueBrowseRender()`); before the index
   exists a query is held (`loading.js` `holdQuery()`). Return blurs the box
   (`onMainKeydown()`).
2. **Day chips** (`data-row="day"`): All days, then each con day, Wed to
   Mon for 2026; `state.browse.day`.

**Scrolls** (`#browseRest`):

3. **Hotel chips** (`data-row="hotel"`): All, then each hotel group present,
   coloured; a second tap on the chip that is on goes back to All;
   `state.browse.hotel`.
4. **Kind chips** (`data-row="kind"`), only when some event is tagged: Any
   kind, then each kind present (`search.js` `KIND_LABELS`: Celebrity Q&A,
   Fan panel, Screening, …); `state.browse.kind`.
5. **Suggestions** (`suggestHTML()`, from `search.js` `suggestionsFor()`):
   while the query is two characters or more and the suggestion index is
   built, up to two rows, "People" and "Fandoms & topics", up to five chips
   each with a count (`data-act="suggest"`, which sets the query to the
   quoted name). With a quoted name in the box, one gold chip "<name> ×"
   (`data-act="unsuggest"`) instead.
6. **Parsed chips** (`parsedChipsHTML()`): what the query was read as, gold,
   each with ×: "Today" when an all-filter query was scoped to today
   (`state.browse.todayScoped`; `data-act="unparse-today"` sets
   `noToday`), and one per filter word (`state.browse.parsed.chips`;
   `data-act="unparse"` takes the word out of the query).
7. **The row of controls**: a segmented Type control, All / Panels / Gaming
   (`data-chip="type"`; `state.browse.type`); the Fandom select `#fandom`,
   only when some event is tagged, "Any fandom" and the reviewed works with
   three or more events and their counts (`data.js` `topWorks()`;
   `state.browse.work`); the Track select `#track`, "All tracks" and every
   track (`state.browse.track`). Both selects are `dispatch.js`
   `onMainChange()`.
8. **The noise toggle** `#hideNoise`: "Hide photo sessions and video-room
   screenings (<n>)", the count for the chosen day; `state.browse.hideNoise`,
   seeded from `settings.hideNoise`.
9. "Indexing the schedule… your search will run in a moment." while a query
   waits for the index.
10. **The results title**: "Best matches first" while searching, else
    "Results", with the count.
11. "No exact match for <word> — showing words that start with it" or "—
    showing close spellings" (`noExactMatchHTML()`), when nothing matched a
    word exactly.
12. **The list.** With no query: under day heads (only with All days) and
    time heads, rows (`list: "browse"`). With a query: ranked rows with the
    day shown and the matched words marked, a snippet under each; a divider
    "Looser matches" before the OR results; then "Already happened (<n>) ▸",
    a fold (`data-act="toggle-past"`; `state.browse.showPast`) over the past
    ones.
13. "<n> photo sessions hidden · show" (`hiddenForQueryHTML()`), when the
    query is a person's name and the noise filter held some back
    (`data-act="show-hidden"`; `state.browse.showHidden`).
14. **Empty**: "No matches. Try fewer or different words, another day, or
    turn off the photo/video filter."
15. **More**: "Show 150 more of <n>" (`data-act="more-browse"`;
    `state.browse.page`), 150 rows a page.

Every chip or select resets `state.browse.page` to 1. Taps that leave the
tab: none.

### Explore (`explore.js`)

`explore.js` `renderExplore()`: the grid (`renderExploreGrid()`) or, with
`state.explore.page` set, a page (`renderExplorePage()`). The catalogue is
built once at load (`buildCatalogue()`).

**The grid**, top to bottom:

1. **Following**, only when the reader follows something (`followingHTML()`;
   `follows`): a fold head "Following (<n>) ▾" (`data-act="fol-toggle"`;
   `state.following.open`, saved under `"followingOpen"`). Folded, nothing
   else is built. Open:
   - a chip row of the follows, each a gold chip whose name opens its page
     (`data-explore`) and whose × unfollows (`data-act="unfollow"`), and
     "+ Follow more" (`data-act="fol-add"`), which scrolls down to the
     filter box (`scrollToGrid()`);
   - a two-button toggle, By interest / By time (`data-act="fol-interest"`,
     `"fol-time"`; `state.following.layout`, saved under
     `"followingLayout"`);
   - **By interest** (`followingByInterest()`): for each follow in the order
     added, a title with its kind and "<n> to come", then its upcoming rows
     with their day (`list: "fol:<id>"`), eight at a time with "Show <n>
     more" (`data-act="fol-more"`; `state.following.expanded`), or "Nothing
     left today or later."; then "Already happened (<n>)", a fold
     (`data-act="fol-past"`; `state.following.showPast`);
   - **By time** (`followingByTime()`): one list of every followed event, once
     each, under day and time heads, each row carrying a gold label per
     follow that brought it (`list: "foltime"`), then its own "Already
     happened" fold.
2. **Because you starred <n> things**, only with picks and something to
   suggest (`suggestedHTML()`, `suggestedFollows()`): a hint line and up to
   six tiles for the tracks, fandoms and guests behind the reader's picks
   that are not followed yet.
3. **Sticky**: the filter box `#exploreQ`, "Filter tracks, fandoms, topics,
   people" (`state.explore.q`; typing redraws the tiles alone,
   `renderExploreSections()`), and the jump chips (`exploreJumpHTML()`),
   Tracks, Fandoms, Topics, Guests, Panelists with their counts
   (`data-act="explore-jump"`, a smooth scroll to the section). The chip for
   the section on screen reads pressed, set by the scroll spy
   (`onScrollSpy()`, `syncActiveSection()`; `state.explore.active`), held
   for 700 ms after a tap (`holdSpyUntil()`).
4. **The sections** (`exploreSectionsHTML()`, `EXPLORE_SECTIONS`): Tracks
   (A to Z, the two noise tracks last), Fandoms (count order), Topics (count
   order), Guests (celebrity speakers, by count), Panelists (people with
   five or more events, A to Z). Each: a title with its count; under the
   first, when nothing is followed, "Follow a track, fandom or person and
   it'll show up here."; tiles, name and count, a gold dot and border when
   followed; the first twelve, then "Show all <n>" (`data-act="explore-all"`;
   `state.explore.expanded`). A filter shows every match. Empty: "Nothing
   matches. Try fewer letters."

**A page** (`renderExplorePage()`; `state.explore.page` = `{kind, key}`):

1. The head: "← Explore" (`data-act="explore-back"`), the kind as a noun
   (Track, Fandom, Topic, Person), the name, "<n> events", with "· <n>
   still to come" once some are past, and Follow / Following (`data-act="toggle-follow"`), shown only
   when the thing can be followed or already is (`follows.js`
   `canFollow()`).
2. The upcoming events by day (`list: "explore"`), or "Everything here has
   already happened.", or "No events. Nothing in the schedule matches this
   any more."
3. "Already happened (<n>)", a fold (`state.explore.showPast`).
4. On a work's page only, "With the cast (<n>)", a fold
   (`state.explore.showCast`): events linked by a credit and not above, the
   photo and signing kinds held back behind "show photo ops and signings
   (<n>)" (`state.explore.castNoise`).

Opening a page (`openExplorePage()`) keeps the grid's scroll in
`state.explore.scroll`, writes `#explore=<kind>:<key>` into the address and
scrolls to the top; "← Explore" (`closeExplorePage()`) clears the hash and
puts the scroll back. Nothing sticky on a page.

Taps that leave the tab: none. A page is the same tab. (Into the tab: the
event sheet's "See all" beside a person, section 3.)

### Map (`map.js`)

`map.js` `renderMap()`. The view is a flex column sized to the space
between the header and the nav (`#view-map` in `styles.css`), so the map
shrinks to fit before the tab scrolls.

1. **Sticky**: day chips (`data-row="map-day"`), each con day, no All;
   `state.map.day`, or, while that is `null`, the current con day, or the
   first full day outside con week (`mapDay()`).
2. **The map**, one SVG (`mapSVG()`), "Schematic map of the con hotels, not
   to scale": the ground; Peachtree St and, fainter, Courtland St; three
   dashed skybridges (`MAP_BRIDGES`); a block per venue in `MAP_HOTELS` —
   AmericasMart, Westin, Hyatt, Marriott, Hilton, Courtland Grand, and Hardy
   Ivy Park in the park green — each labelled with its short name in
   capitals and focusable (`role="button"`, `tabindex="0"`, Enter or Space
   opens it: `dispatch.js` `onMainKeydown()`); on the day the clock is in,
   a solid gold ring on the hotel of the pick on now and a pulsing one on the
   next pick's (`mapRingsSVG()`); a gold pill with the count of the day's
   picks on each hotel that has any (`mapPillSVG()`, `mapCounts()`).
3. **Under the map** (`#mapUnder`, `mapCardHTML()`, from `mapCardState()`,
   which is always about now, whatever day is chosen):
   - "On now: <title> · ends 2:00 PM · Hyatt" (`.next-on`, `data-hero`),
     when a pick is on;
   - the next-pick card (`.next-card`, `data-hero`): "Tomorrow" or the
     day's name when the next pick is on a later day; the title; the place;
     the when — "leave the Hyatt by 2:35 PM" / "leave the Hyatt now" in gold
     or warn (section 5), or "3:00 PM · in 47 min", or the start alone for a
     later day; and the walk estimate "~12 min from the Westin";
   - empty: "Star things in Search and your next pick shows here.";
   - after the con, no card;
   - "<n> picks streaming or offsite" (`offLineHTML()`), for the chosen day.

The minute tick, `map.js` `tickMap()` (only while the sheet is closed),
redraws the whole tab when the rings, the pills or the day change
(`mapSignature()`), and otherwise the card alone when its words change
(`mapCardSignature()`).

Taps that leave the tab: a hotel block or pill opens the hotel sheet
(`openSheet("hotel", hotel)`), from which "Search the Hyatt on Saturday"
goes to the Search tab (section 3). The card and the On now line open the
event sheet.

### Mine (`mine.js`)

`mine.js` `renderMine()`: every pick from `byId`, the removed among them.
Nothing sticky.

1. **Your picks changed**, `picks.js` `pickNewsHTML()`, as on Now.
2. **The action strip** (`.mine-actions`): "Export to calendar"
   (`data-act="ics"`, `ics.js` `exportICS()`, a `.ics` download; disabled
   with no pick still on the schedule) and "Remove all" (`data-act="clear"`,
   a `confirm()`, then every pick gone; disabled with no picks).
3. **The view toggle**, only with picks: Timeline / List
   (`data-act="view-timeline"`, `"view-list"`; `state.mineView`, saved under
   `"mineView"`, Timeline by default).
4. **Empty**: "Nothing picked yet. Star things in Search. They'll line up
   here by day with warnings when two picks overlap or the walk between
   hotels is too tight."
5. **Timeline** (`renderMineTimeline()`, `timelineDayHTML()`): per con day, a
   day head with a count, then a grid at 60 px an hour
   (`HOUR_PX`): hour lines with their times; a block per pick in its hotel's
   colour, placed by time, side by side where picks overlap
   (`layoutColumns()`), with title, room and, on a block 150 px or taller,
   "runs to <time>"; a dashed walk link with "<n> min" between consecutive
   picks in different hotels, warn-coloured when the gap is shorter than the
   walk; a red "now" line on today's grid. A removed pick is faded, struck,
   and says "Removed from the schedule" for its room, with no walk to or
   from it. Blocks give way by measurement (`fitTimelineBlocks()`): a
   one-line title, then no room. A tap on a block opens its event sheet
   (`data-hero`).
6. **List**: under day heads with counts, rows (`list: "mine"`) with a gap
   line (`leave.js` `gapHTML()`) before each, measured from the pick above;
   a removed pick has none on either side.

Taps that leave the tab: none. Export downloads a file.

### Doc and code

- `docs/ARCHITECTURE.md`, What the client does, "Now tab": "until the app
  is installed the tab opens with the install nudge" — true only before and
  during the con: `archiveHTML()` draws no nudge.
- DECISIONS #40 keeps "a walk estimate on a row". No row carries one: the
  walk is on the hero's line, the map card's line, the gap lines between
  rows and the timeline's links (section 5).

## 3. The sheet (`sheet.js`)

One wrapper, `#sheetWrap`, a backdrop `#sheetBack` and a `div.sheet`
(`role="dialog"`) with a grip bar and three panels, one shown at a time.
`sheet.js` `openSheet(kind, id)` fills and shows the one panel: `"event"`
refuses an id `byId` lacks, `"hotel"` a hotel `MAP_HOTELS` lacks. It sets
`state.sheetId` or `state.sheetHotel` (a row whose event is open is drawn
`.open`), keeps `main`'s scroll, and points `aria-labelledby` at the
panel's heading. No focus is moved into the sheet, and no key closes it.

**Closing** (`closeSheet()`): Done in each panel (`#closeSheet`,
`#closeSheetEvent`, `#closeSheetHotel`), a tap on the backdrop, Apply or
Clear preview, and Remove all picks. It clears `state.sheetId` and
`state.sheetHotel`, redraws, and puts the scroll back.

**Swipe to dismiss** (`onSheetTouchStart()`, `onSheetTouchMove()`,
`onSheetTouchEnd()`, `onSheetTouchCancel()`; `setDrag()`, `settle()`): a
drag that starts outside `.ev-body` moves the sheet with the finger (a
quarter as far upward) and fades the backdrop; let go past 70 px, or a
flick past 40 px faster than 0.6 px/ms, and it slides away and closes;
otherwise it settles back. The sheet claims the gesture (`touch-action:
none`); the event and hotel bodies still scroll (`pan-y`). Touch only: no
mouse drag.

### Settings (`#panel-settings`, `sheet.js` `fillSettings()`)

In order:

1. "Settings", the heading.
2. **Crowd factor for walk estimates: 1.3x**, a range 1 to 2.5 by 0.1
   (`#crowd`; `settings.crowd`, saved under `"settings"` by
   `onCrowdInput()`). It scales every walk (`venues.js` `walkMin()`).
3. **Hide photo sessions and video-room screenings by default**, a checkbox
   (`#noiseDefault`; `settings.hideNoise`, and `state.browse.hideNoise`
   with it; `onNoiseDefaultChange()`).
4. **Larger text**, a checkbox (`#bigText`; its own key, `"bigtext"`;
   `shell.js` `onBigTextChange()`).
5. **Advanced**, a fold (`#advanced`), scrolling inside the sheet:
   - "Preview a different time (leave blank to use the real clock)", the
     `datetime-local`, Apply preview time and Use real time — dev-only;
   - "Walk-time defaults (minutes, before crowd factor)", a nested fold over
     a table of every pair in the venues file's walk table (`#walkTable`,
     from `venues.js` `WALK`) — not dev-only by the code, which draws it on
     every build;
   - the device readout — dev-only.
6. **Keep your plan** (`#keep`), on a build with a backend only
   (`backend.js` `hasBackend`; `fillKeep()`, drawn once and then shown and
   hidden): the heading; sync's two status lines (`sync.js`
   `fillSyncStatus()`: "Synced just now", "<n> changes waiting", "Offline,
   …", or a failure in plain words; and, after a refused Sign out, "<n>
   changes are waiting to send; connect and try again"); then either the
   email step — a sentence on what it is for, Email and Send code, then
   "The code sent to <email>" and Confirm (`onKeepSubmit()`) — or, signed
   in with an email, "Signed in as <email>. …" and Sign out
   (`onKeepClick()`); and a note line for what just happened.
7. **Done** (`#closeSheet`).
8. **Remove all picks** (`#resetPicks`, danger style, alone on its row): a
   `confirm()`, then every pick gone and the sheet closed
   (`onResetPicks()`).

### The event panel (`#panel-event`, `sheet.js` `eventSheetHTML(ev)`)

Every line, in order:

1. The title (`h2#sheetTitleEvent`).
2. When: the calendar day's name, "2:30 PM to 3:30 PM · 1 h", and "·
   Saturday night" when the con day is not the calendar day.
3. The place (`venues.js` `placeHTML()`), large, in the hotel's colour.
4. "Cancelled", "Removed from the schedule" and the Celebrity badge, each
   when it applies.
5. The description, or "No description." (`.ev-body`, which scrolls).
6. "With <name>, <name> (moderator), …", each person as this listing spells
   them, a role other than Speaker or Panelist in brackets, and a "See all"
   link after each (`data-explore="person:<id>"`).
7. The tagline: each track and each work the event is about by name, as
   plain tags, and "18+" when `tags.audience` is mature.
8. The actions: the star (`#sheetStar`), "Add this to calendar"
   (`#sheetICS`, `ics.js` `exportEventICS()`; left out for a removed event),
   and Done.

Clicks are `dispatch.js` `onEventPanelClick()`: "See all" closes the sheet
and opens that person's Explore page — the one tap in the sheet that changes
the tab; the star toggles the pick and redraws the panel alone. Not in the
panel: a walk, a clash, who's going, a follow button, a "known for" line,
the facets.

### The hotel panel (`#panel-hotel`, `sheet.js` `hotelSheetHTML(hotel, day)`)

The hotel's full name; "<day> · <n> picks"; the reader's picks there that
con day as compact rows (`list: "map"`), or "No picks here on Saturday."
and a button "Search the Hyatt on Saturday" (`data-act="map-search"`). The
day is the map's (`map.js` `mapDay()`). Clicks are `dispatch.js`
`onHotelPanelClick()`: the search button sets `state.browse` to that hotel
and day with an empty query, switches to the Search tab and closes the
sheet; a star toggles the pick and redraws the panel; a row opens the event
panel in its place; Done closes.

## 4. The row

`ui.js` `rowHTML(ev, opts)`. An `li.row` with `data-id` and `data-list`,
classed `mine`, `open`, `cancelled`, `removed` as they apply; inside, a
`button.row-main` (`aria-haspopup="dialog"`) and a `button.star`.

The elements a row can carry, in screen order:

| Element | When | From |
|---|---|---|
| Day label ("Sat") above the time | `opts.showDay` | `DAY_LABEL[ev._cd]` |
| Start time, large, with AM/PM | always | `ev._s` |
| "to <end>" | always | `ev._e` |
| Title, two lines at most; a gold ★ before it when picked; struck when cancelled or removed; matched words marked | always; marks with `opts.terms` | `ev.title`, `picks` |
| Place chip, "Hilton · 313-314", in the hotel's colour; the room shortens, the hotel never | always | `venues.js` `placeHTML()` |
| "Cancelled" | `ev.cancelled` | |
| "Removed from the schedule" | `ev.removed` (drawn only in Mine) | |
| Status, gold | `opts.status` | the caller's string |
| "Celebrity" | `tags.guests === "celebrity"` | `data.js` `isCeleb()` |
| Follow labels, gold outline | `opts.labels` | the caller's list |
| Track, or "Gaming" for an untracked gaming event | always, when either exists | `ev.track`, `ev.type` |
| Snippet, two lines: the description around the first matched word, or "With <people>" when the match was a person | `opts.terms` | `ev.description`, `ev.people` |
| The star, ★ or ☆, "Add to my schedule" / "Remove from my schedule" | always | `picks` |

What a row never says: a clash, a tight walk, a walk estimate, a leave-by, a
kind, a topic or fandom tag, the people (outside a search snippet), or a
cost or any other parsed facet. Clashes and walks are said between rows, by
`leave.js` `gapHTML()`, which only Now's Rest of your day and Mine's list
call (section 5).

Every caller, with what it passes:

| Context | Caller | `list` | `showDay` | `terms` | `status` | `labels` | Between rows |
|---|---|---|---|---|---|---|---|
| Search, no query | `browse.js` `renderBrowse()` | `browse` | | | | | day and time heads |
| Search, a query | `browse.js` `renderBrowse()` | `browse` | yes | yes | | | "Looser matches", "Already happened" |
| Explore page, and its cast group | `explore.js` `renderExplorePage()` (`dayGroups()`) | `explore`, `explore-cast` | | | | | day heads |
| Following, by interest | `explore.js` `followingByInterest()` | `fol:<id>`, `folp:<id>` past | yes | | | | |
| Following, by time | `explore.js` `followingByTime()` | `foltime` | | | | yes | day and time heads |
| Mine's list | `mine.js` `renderMine()` | `mine` | | | | | day heads; `gapHTML()` |
| Now, Rest of your day | `now.js` `renderNow()` | `next` | | | within 90 min | | `gapHTML()` |
| Now, your next pick on a later day | `now.js` `renderNow()` | `next` | yes | | | | |
| Now, On now and in the next hour | `now.js` `renderNow()` | `around` | | | | | time heads |
| Now, after the con | `now.js` `archiveHTML()` | `archive` | | | | | day heads |
| The hotel panel | `sheet.js` `hotelSheetHTML()` | `map` | | | | | |

`data-list` lets `togglePick()` find the tapped row again when one event is
on screen twice, and lets `tickNow()` find Now's statuses. Mine's timeline
blocks and the hero are not rows: they are buttons of their own
(`data-hero`).

## 5. Leave-by and the walk on screen

Every site, from a grep for `leave` across `src/`, case-insensitive. The
matches not in the table are other words - leave a crew, leaves the plan,
leave it alone - in `crews.js`, `identity.js`, `picks.js`, `sheet.js`,
`sync.js`, the comments on `mine.js` `fitTimelineBlocks()`, `map.js`'s and
`now.js`'s ticks and `venues.js` `placeHTML()`, or comments that name leave-by in
`time.js`'s and `venues.js`'s headers and `now.js` `nowModel()`'s:

| Site | What it says | Module, function | Reads |
|---|---|---|---|
| Now, the hero, a pick on now | "leave the Hyatt by 2:35 PM" / "leave the Hyatt now" (gold, warn when late, the ring warn too); "then: Hilton at 3:00 PM" | `now.js` `heroHTML()` | `leave.js` `leaveInfo()`, `currentLocation()` |
| Now, the hero, nothing on | "~12 min from the Westin", muted | `now.js` `heroHTML()` | `leaveInfo()`'s `estimate` |
| The mini-bar | "leave by 2:35 PM" / "leave now" (warn when late), else "in 47 min" | `shell.js` `renderMiniBar()` | `leaveInfo()`, `currentLocation()`, `nextPickInConDay()` |
| Map, the next-pick card | "leave the Hyatt by 2:35 PM" / "leave the Hyatt now" (gold, warn when late), else "3:00 PM · in 47 min"; and "~12 min from the Westin" | `map.js` `mapCardHTML()`, `mapCardState()` | `leaveInfo()`, `currentLocation()` |
| Map, the rings | none in words; `mapNowState()` computes a `leaveInfo()` that nothing draws | `map.js` `mapNowState()` | `leaveInfo()` |
| Now's Rest of your day, and Mine's list: the gap line | "Overlaps the one above by 15 min" (warn); "10 min to get there, Hyatt to Hilton is about 13 min at con pace" (warn border); "20 min gap, Hyatt to Hilton about 13 min. Tight but doable" | `leave.js` `gapHTML()` | `walkMin()`, `LEAVE_BUFFER_MIN` |
| Mine's timeline: the walk link | "13 min" on a dashed line between picks in two hotels, warn when the gap is under the walk | `mine.js` `timelineDayHTML()` | `walkMin()` |
| Settings | the crowd factor, and the walk table under Advanced | `sheet.js` `fillSettings()` | `settings.crowd`, `WALK` |

How they are computed (`leave.js`):

- `currentLocation(now)`: the hotel of a pick on now, or null — null for a
  stream. The only place the app says where the reader is.
- `leaveInfo(from, next, now)`: with `from` known and not the next pick's
  hotel, a leave-by, the next start less the walk at the crowd factor and
  `LEAVE_BUFFER_MIN` (`venues.js`, the venues file's `slack_min`, 10), and
  `late` once it has passed; otherwise no leave-by, and an estimate of the
  walk from the previous pick today when it was in another building.
- `gapHTML(prev, next)`: nothing across a con day with more than four hours
  between; an overlap; a gap under the walk; a gap under the walk and the
  slack, the tight band; else nothing. A same-building pair is walked at the
  same-venue minutes, 5 at the crowd factor, so a short gap in one building
  can be flagged.
- The timeline's link has one band: under the walk. The slack band is the
  gap line's alone.
- The map card shows a leave-by only when the walk is above zero
  (`info.walk > 0`). The hero and the mini-bar test `info.leaveBy` alone, so
  with a pick on now and the next pick a stream, where the walk is 0, both
  say leave by the stream's start less the slack.

**#40's removal list, checked.** #40's Cost names three places that still
show leave-by: the Now tab's hero card, the mini-bar and the map's next-pick
card. All three do, as above, and no other site computes one. The walk
estimate and the tight bands #40 keeps are in the hero's "~N min from"
line, the map card's, the gap lines and the timeline's links; no row
carries a walk estimate (section 2, Doc and code).

## 6. Routes, hash and storage

**The tab.** `state.tab` starts as `"now"` (`state.js`) on every load; no
key keeps it. The one exception is the hash: `loading.js` `load()` calls
`explore.js` `applyExploreHash()` before the first draw, and a valid
`#explore=` puts the tab on Explore with that page open. Leaving Explore by
the tab bar leaves the hash in the address and `state.explore.page` set, so
a reload after leaving still lands on that Explore page.

**Every `#…` and `?…` the app reads**, from a grep for `location.`,
`URLSearchParams` and `hashchange` across `src/`:

| Part | Read by | What it does |
|---|---|---|
| `#explore=<kind>:<key>` | `explore.js` `readExploreHash()`, from `applyExploreHash()` at load and on `hashchange` (`dispatch.js` `onHashChange()`) | Opens that page when the kind is a follow kind and the schedule offers the key to follow (`canFollow()`); otherwise the grid. Written by `setExploreHash()`, which keeps any other `&`-part of the hash. |
| `?now=<ISO>` | `time.js` `initTimeOverride()`, at boot | Dev-only: the simulated clock, kept under `"timeOverride"` (sessionStorage); `setOverride()` keeps the address in step. |
| `?join=<year>.<token>` | `crews.js` `readJoinLink()`, at boot | Kept under `"join"` (sessionStorage) on a build with a backend, dropped on one without, and taken out of the address either way. No screen reads it yet (section 8). `inviteLink()` writes it. |

Nothing else in the address is read. `public/manifest.json` starts an
installed app at `./`, with no query or hash.

**Every stored key**, from a grep for `storageKey(` across `src/` —
eighteen names, each spelled once by its owner:

| `storageKey()` name | Store | Written by | Read by |
|---|---|---|---|
| `picks` | local | `picks.js` `keepPicks()` (from `savePicks()`, `applyPulledPicks()`) | `picks.js`, at import |
| `pickInfo` | local | `picks.js` `keepPicks()` | `picks.js`, at import |
| `pickNews` | local | `picks.js` `savePickNews()` | `picks.js`, at import |
| `follows` | local | `follows.js` `keepFollows()` (from `saveFollows()`, `applyPulledFollows()`) | `follows.js`, at import |
| `settings` | local | `sheet.js` `onCrowdInput()`, `onNoiseDefaultChange()` | `state.js`, at import |
| `mineView` | local | `dispatch.js` `onMainClick()` | `state.js`, at import |
| `followingLayout` | local | `dispatch.js` `onMainClick()` | `state.js`, at import |
| `followingOpen` | local | `dispatch.js` `onMainClick()` | `state.js`, at import |
| `bigtext` | local | `shell.js` `onBigTextChange()` | `boot.js` `boot()` |
| `archiveNoticeDismissed` | local | `dispatch.js` `onMainClick()`, by `shell.js`'s `ARCHIVE_NOTICE_KEY` | `shell.js` `noticeHTML()` |
| `nudgeSnoozedUntil` | local | `dispatch.js` `onMainClick()` | `now.js` `nudgeVisible()` |
| `session` | local | `backend.js` | `backend.js` `storedSession()` |
| `outbox` | local | `outbox.js` | `outbox.js` |
| `syncStamp` | local | `sync.js` `adopt()`, `pull()` | `sync.js` `syncOnce()` |
| `crew` | local | `crews.js` `applyPulledCrews()`, for `sync.js` | `crews.js` `myCrews()` |
| `crewPicks` | local | `crews.js` `applyPulledCrews()`, for `sync.js` | `crews.js` `crewPicksKept()` |
| `timeOverride` | session | `time.js` `initTimeOverride()`, `setOverride()` | `time.js` `initTimeOverride()` |
| `join` | session | `crews.js` `readJoinLink()`, `takePendingJoin()` | `crews.js` `pendingJoin()` |

This agrees with `docs/ARCHITECTURE.md`'s stored-keys table.

**Scroll.** `main` is the one scroller (`scroll.js` `scroller`). There is no
per-tab scroll memory: a tab-bar tap and the mini-bar scroll to the top
(`onNavClick()`, `onMiniBarClick()`). Three things put a scroll back:
closing the sheet (`closeSheet()`, to where it opened), leaving an Explore
page (`closeExplorePage()`, to `state.explore.scroll`), and starring
(`togglePick()`, which keeps the tapped row under the finger). The hotel
panel's search goes to the top of Search.

## 7. The stranger's view

A reader with nothing starred and nothing followed, on a build with the
schedule loaded:

**Before the con** (the 2027 build until 2027-09-01 18:00): the preview
banner on every tab; Now shows the install nudge (unless installed), then
"Nothing picked for later today. Star things in Search and they show up
here with walk times.", then On now and in the next hour for the first full
day at 10:00. **During the con**: the same without the banner, at the real
time. **After it**: the "has ended" notice on every tab until OK, and Now's
"Your 2026 schedule 0 — Nothing starred."

On every other tab, in any phase:

- **Search**: the day's whole schedule (or Thursday's outside con week),
  every control present; nothing differs for a stranger.
- **Explore**: no Following section and no Because you starred; the sticky
  filter and jump chips; under the Tracks title, "Follow a track, fandom or
  person and it'll show up here."; the tiles.
- **Map**: no pills, no rings; "Star things in Search and your next pick
  shows here." under the map (nothing after the con).
- **Mine**: both buttons disabled, no view toggle, and "Nothing picked yet.
  Star things in Search. …"
- **The mini-bar**: never; the badge: hidden.
- **The sheet**: Settings as in section 3; on a build with a backend, Keep
  your plan's email form with no status line (no session yet).

**The install nudge** (`now.js` `nudgeHTML()`, `nudgeVisible()`,
`nudgeCopy()`): the first thing on Now, before and during the con — never
on another tab, never after the con. It shows unless the page runs as an
installed app (`platform.js` `isStandalone()`: `display-mode: standalone`
or `navigator.standalone`) or `now()` is before the time kept under
`"nudgeSnoozedUntil"`. What it says:

- on an iPhone or iPad (`IS_IOS`): "Add this to your home screen. In
  Safari: Share, then Add to Home Screen. If you opened this from a chat,
  tap the menu (the dots or the compass) and choose Open in Safari first.
  Once installed it works with no signal." and Not now;
- where the browser has offered an install prompt
  (`onBeforeInstallPrompt()` kept it): "Install this app. It opens like an
  app and works with no signal." with "Install app"
  (`data-act="nudge-install"`, which shows the browser's prompt once,
  `takeInstallPrompt()`) and Not now;
- otherwise: "Add this to your home screen. From the menu (the three
  dots): Install app, or Add to Home screen. Once installed it works with
  no signal." and Not now.

Not now (`data-act="nudge-later"`) saves `now()` plus `NUDGE_SNOOZE_MS`,
seven days, under `"nudgeSnoozedUntil"`; there is no other dismissal. The
snooze is measured on `now()`, so a simulated clock moves it too.
`appinstalled` (`onAppInstalled()`) forgets the prompt and redraws. UNSURE:
which browsers fire `beforeinstallprompt` and `appinstalled`, and so which
readers see "Install app" rather than the menu steps, is the browser's, not
the code's.

**The new-schedule offer (B20)**: the update pill, section 1; the
freshness line's "offline copy" and "final schedule" beside it.

**No schedule at all**: with the fetch failed and nothing cached,
`loading.js` `load()` writes into the Now view "No schedule data yet.
data/2026/events.v2.json is missing or unreadable. Run `python
events_v2.py` in this folder, then reload." — a developer's instruction,
on every build — and draws nothing else.

**Notifications**: none. A grep for `Notification`, `PushManager`,
`pushManager`, `showNotification`, `"push"` and `pushsubscription` across
`src/` and `public/sw.js` finds nothing: no toggle, no permission request,
no subscription, no push handler. `identity.js`'s header names
notifications as a future caller of `ensureUser()`, in a comment.

## 8. Crews' seam

`crews.js` exports: `myCrews`, `isCreator`, `crewGained`,
`applyPulledCrews`, `forgetCrews`, `goingTo`, `crewmatesByEvent`,
`inviteLink`, `readInvite`, `readJoinLink`, `pendingJoin`,
`takePendingJoin`, `createCrew`, `joinCrew`, `newInvite`, `leaveCrew`,
`removeMember`, `deleteCrew`, `crewMessage`.

Who imports them today: `boot.js` (`readJoinLink`) and `sync.js`
(`applyPulledCrews`, `crewGained`, `forgetCrews`). No view, no sheet panel,
no shell function reads `"crew"`, `"crewPicks"` or `"join"`, or calls a
reader or an action: a grep for `crews.js` and for those three names finds
them in `crews.js`, `sync.js` and `boot.js`, and in a comment in
`identity.js`'s header. A sync pull that changed
only the crews or the crewmates' picks asks for no redraw
(`sync.js` `pull()` calls `requestRender()` when the reader's own picks or
follows changed).

What each screen would call, by the module's own comments:

| Screen | Readers | Actions |
|---|---|---|
| A who's-going line on a row or the sheet | `goingTo(eventId)`: the crewmates whose kept picks hold the event, `{user_id, display_name}`, never the reader | — |
| The overlay on a timeline or the map | `crewmatesByEvent()`: a `Map` of event id to the same list | — |
| A crews list | `myCrews()`: `[{id, name, creator, invite_token, members: [{user_id, display_name}]}]`, oldest first; `isCreator(crew)`; `inviteLink(crew)` | `createCrew(name, displayName)`, `newInvite(crewId)`, `leaveCrew(crewId)`, `removeMember(crewId, userId)`, `deleteCrew(crewId)`; `crewMessage(error)` for any failure |
| Join | `pendingJoin()`, `takePendingJoin()` for a kept `?join=`; `readInvite(text)` for a pasted link | `joinCrew(invite, displayName)` |

Each action is one request and writes nothing on the phone; the module says
the screen's handler runs a sync after it (`sync.js` `runSync()`), as the
email step does. `crewmates()` is not exported. The screens are listed in
ROADMAP, tentpole 5, and `docs/sync/contract.md`, section 8.

## 9. Layout (`styles.css`)

**The skeleton.**

- `html, body` are `height: 100%; overflow: hidden`: the page never
  scrolls. `html` refuses the overscroll stretch.
- `.hdr` is `position: fixed` at the top, `z-index: 5`, padded by
  `--safe-top` and, past 760 px, centred to the column.
- `main` is `position: fixed` edge to edge, `max-width: 760px`, and the
  scroller (`overflow-y: auto`). Its `::before` is a spacer of
  `var(--hdr-h, 82px)`; its `::after` one of `76px + --safe-bottom`, or
  `124px + --safe-bottom` under `body.has-minibar`.
- `.controls-sticky` is `position: sticky; top: var(--hdr-h, 74px)`,
  `z-index: 4`.
- `.nav` is `position: fixed` at the bottom, `z-index: 5`, `display: grid;
  grid-template-columns: repeat(5, 1fr)`, padded by `--safe-bottom`; each
  button 58 px tall. `.nav .badge` is `position: absolute`, placed by
  `margin-left: 40px; margin-top: -34px` inside the Mine button, which
  `index.html` gives `position:relative` inline.
- `.minibar`: fixed, 48 px, `bottom: calc(70px + --safe-bottom)`,
  `z-index: 6`. `.devmark`: `bottom` 76 px, 124 px with the mini-bar,
  `z-index: 7`. `.update-pill`: `bottom` 80 px, 132 px with the mini-bar,
  `z-index: 8`. The sheet's backdrop is `z-index: 9`, the sheet 10.
- `#view-map` is a flex column `height: calc(100dvh - var(--hdr-h, 63px) -
  76px - var(--safe-bottom))`.
- Safe areas: `--safe-top` and `--safe-bottom` are the `env()` insets;
  `boot.js` `boot()` caps `--safe-bottom` at 34 px on iOS.

The nav's height, the mini-bar's offset, the end spacer and the Map's
height are written as separate numbers — 58 px buttons with 6 px padding
and a 1 px border, 70, 76, 80, 124 and 132 — not derived from one
another. UNSURE: how they compare on a device, which is layout the code
cannot settle.

**Custom properties** (`:root`): the palette `--ink`, `--surface`,
`--raised`, `--line`, `--text`, `--muted`, `--dim`, `--gold` (the reader's
own: picks, pills, follows), `--gold-ink`, `--warn`; `--font`; a colour per
venue, `--h-Marriott`, `--h-Hyatt`, `--h-Hilton`, `--h-Courtland`,
`--h-Westin`, `--h-Mart`, `--h-Hardy`, `--h-Streaming`, `--h-Other`, which
`venues.js` `hotelVar()` names from the venues file's `var` and a row sets
as `--h`; `--park`; `--safe-bottom`, `--safe-top`. `--hdr-h` is set from
JavaScript (`syncHeaderHeight()`).

**Larger text.** `html.bigtext { font-size: 115% }`; every text size
outside the map's SVG is in `rem`, and the timeline's hour gutter too.
Boxes stay in px. The map's labels are in the SVG's own units and scale
with the drawing, not the switch. `tests/rules/source.test.js` refuses an
inline pixel font size in a template.

**What a change to the tab bar's shape or count would touch**, by
selector and by code:

- `index.html`: the five `button[data-tab]`s and `#mineBadge`; the five
  `section.view#view-<tab>`s.
- `styles.css`: `.nav` (`repeat(5, 1fr)`), `.nav button`, `.nav button
  svg`, `.nav button[aria-current="page"]`, `.nav .badge`; and every number
  that assumes the nav's height: `main::after`, `body.has-minibar
  main::after`, `.minibar`'s `bottom`, `.update-pill` and its
  `has-minibar` rule, `.devmark` and its `has-minibar` rule, `#view-map`'s
  `height`.
- `shell.js` `render()`: the list `["now", "browse", "explore", "map",
  "mine"]` and one `if` per tab; `renderMiniBar()`'s two excluded tabs;
  `onNavClick()`, `onMiniBarClick()` (`"now"`).
- The other writers and readers of `state.tab`: `state.js` (the first tab),
  `dispatch.js` `onHotelPanelClick()` (`"browse"`) and `onMinute()`
  (`"now"`, `"map"`), `explore.js` `openExplorePage()`,
  `applyExploreHash()` and `syncActiveSection()` (`"explore"`),
  `loading.js` `scheduleIndexBuild()` and `indexReady()` (`"browse"`),
  `now.js` `onBeforeInstallPrompt()` (`"now"`).
- `tests/rules/style.test.js`: "the nav lays out five columns [939]"
  matches `repeat(5, 1fr)`, [940] and [941] the label and icon sizes, and
  [1640] the whole `#view-map` height rule, 76 px included.

**Line count per view module**, at 7968d96: `now.js` 251, `browse.js` 187,
`explore.js` 474, `map.js` 178, `mine.js` 150; and around them `sheet.js`
297, `shell.js` 189, `dispatch.js` 241, `ui.js` 69, `leave.js` 71,
`styles.css` 539, `index.html` 136.

## 10. What pins the screens

Counts are about, at 7968d96, from `vitest list`; they are there to size
churn, and they rot.

| File | Screen | What it holds | Tests |
|---|---|---|---|
| `archive.test.js` | Now after the con, the notice | The record of picks, the "has ended" notice on every tab and its dismissal, the con ending on an open page | about 25 |
| `boot.test.js` | First paint | The first draw before the index, the idle build | about 5 |
| `crews.test.js` | none yet (the crew layer) | The six actions as sent, the mint, the invite link through reload and years, `readInvite()`, `goingTo()` and `crewmatesByEvent()` | about 50 |
| `devmark.test.js` | The dev-build mark | Unstamped, stamped, and the shared origin | about 10 |
| `explore.test.js` | Explore | Because you starred, the grid, heads and Show all, the jump bar, the filter, a tile's page, the sheet's See all | about 55 |
| `follows.test.js` | Explore, Following | The follow model, `eventsFor()`, the feed by interest and by time, + Follow more, the fold, unfollow, a page's deep link | about 75 |
| `ics.test.js` | Mine's export, the sheet's | The calendar files | about 5 |
| `keep.test.js` | Settings, Keep your plan | No backend, every request as sent, the email step, recover, a lost session, failures in plain words | about 30 |
| `leave.test.js` | Hero, mini-bar, map card | `leaveInfo()`, `currentLocation()`, no guessing with and without a pick on now, the Hotel · Room convention | about 20 |
| `map.test.js` | Map, the hotel panel | The base map, day chips, pills, the hotel sheet and its search, now and next, the late pair, a streaming next, a two-digit pill | about 95 |
| `mine.test.js` | Mine | The action strip, the timeline and its columns, the list, Remove all | about 20, and 2 skipped |
| `minibar.test.js` | The mini-bar | When it shows, what it says, its tap, not on the Map | about 15 |
| `now.test.js` | Now | Nothing starred, starring and the row under the finger, the hero, no cap, the tick's patching, today only, cancelled | about 35 |
| `nudge.test.js` | The install nudge | In a tab and installed, Not now | about 5 |
| `offline.test.js` | The pill, the freshness line | The worker's messages, the pill's swipe and tap, the recheck on return, the digest | about 20 |
| `pick-news.test.js` | The picks-changed notice | Removed and moved, a respelled room | about 10 |
| `removed.test.js` | Mine, the notice | A removed pick in Mine's list and timeline, merges, the news | about 25 |
| `search.test.js` | Search | Chips, query parsing, suggestions, the celebrity mark, venue chips, search quality on the fixture, the debounce, chip rows keeping their place | about 115, and 1 skipped |
| `settings.test.js` | Settings | The device readout, the everyday two and Advanced, Larger text, the backend's section | about 20 |
| `sheet.test.js` | The sheet | A row opens it, the star inside, closing clears the drag, the Settings panel | about 20 |
| `shell.test.js` | Header and nav | The hotel chips, the edge guard, the five tabs and their labels, the compact header, the measured header, iOS | about 35 |
| `spy.test.js` | Explore's jump chips | The scroll spy | about 5 |
| `sync-pull.test.js` | none (sync) | The pull, a change of owner, paging, `reconcilePicks()` with a session | about 25 |
| `sync.test.js` | Keep your plan's status | The doors, the outbox, the status line, mint, recover, sign out | about 40 |
| `time.test.js` | Every tab's clock | `?now=`, the con day, the stopwatch, the phase | about 30 |
| `untagged.test.js` | Search, Explore | An untagged event, the tiles | about 10 |
| `year.test.js` | Keys, days, hotels | The year in every key, `CON` from the season file, the venues file's hotels and walk | about 15 |

Every page test boots the page from `index.html`'s own markup
(`tests/helpers/page.js` `template()`) and reaches the DOM by the ids and
classes the source draws; `index.html`'s ids are an interface. By a grep of
`tests/page/`, `view-now` is named in 16 files, `view-mine` 10,
`view-browse` 8, `panel-event` 8, `view-explore` 6, `sheetWrap` 6, and every
other id of `index.html` in 1 to 4 but `crowdLabel`, in none. Tests set
`state.tab` directly about 55 times; six files select a nav button by its
`data-tab`, one of them to assert there is no `data-tab="foryou"`.

**The rules a reshaping would meet** (`tests/rules/`, about 60 tests):

- `imports.test.js`, `ORDER` (DECISIONS #29): a module imports only
  earlier modules; a new module goes into `ORDER` at the lowest place its
  imports allow; only `main.js` imports `boot.js` and only `boot.js`
  imports `dispatch.js`. The five views sit together, after `sync`; `map`
  imports `nowModel` from `now`, the one edge between two views, and
  `sheet` imports `map` for `MAP_HOTELS` and `mapDay()`.
- The dispatch rule (#29, CLAUDE.md rule 10): a handler lives in the module
  that owns the state it writes, or in `dispatch.js` when it spans modules.
  It is held by review and by `ORDER`, not by a test of its own.
- `source.test.js`: `togglePick(id, anchor)` keeps its signature [1240]; no
  inline pixel font size [1728]; no `dc26`; every `dc<YY>.` key is
  `storageKey()`'s; no date written into a string.
- `style.test.js`: about 50 matches against `styles.css` text, among them
  the nav's five columns and its label and icon sizes, `main` as the
  scroller and the page that cannot scroll, the fixed header, the sticky
  controls under `--hdr-h`, `#view-map`'s height, the map's colours and
  pulse, the map card, the timeline's measured give-way, rem sizes for
  Larger text, the dev-build mark's lift over the mini-bar.
- `npm run lint`: the clock rule (`now()` only; DECISIONS #12), and the
  scrolling and hostname rules [780] and [1989] as `no-restricted-syntax`
  selectors.

## UNSURE, collected

1. Which browsers fire `beforeinstallprompt` and `appinstalled`, and so
   which readers see "Install app" on the nudge rather than the menu steps
   (section 7).
2. How the nav's real height compares on a device with the numbers that
   assume it — 70, 76, 80, 124 and 132 px — in the mini-bar, the end
   spacers, the pill, the dev-build mark and the Map's height (section 9).
