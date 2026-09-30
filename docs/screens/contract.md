# Where things live: the screen contract

The design note for Where things live (ROADMAP tentpole 5): DECISIONS
#62-#66, in the detail a pull request needs. Written 2026-09-30, before
any of it was built. The evidence is `recon.md`, beside this file: the
client's screens as the design found them, `next` at 7968d96. Each section
says what is built, by pointing at the recon's section; what is designed;
and what the change moves, in code and in the tests the recon names
(section 10). "PR <n>" is a line of ROADMAP tentpole 5's sequence. Where an
entry has the detail, this note points at it rather than saying it twice.
What the note does not settle is under Open, at the end. A change of
meaning here is a decision: log it in DECISIONS.md and update this file in
the same PR.

Every wanted feature this tentpole places has one home, named once, on a
line of its own: **Home of:**. A W-id is `docs/scope-2027.md`'s.

## 0. Rules

As built: the recon, sections 3 (no focus management, no key closes the
sheet) and 7 (what each reader sees).

- **One home, any number of entry points** (#63). An item's home is the
  screen that owns its state; an entry point is a tap from context that
  opens the home's own state with parameters, never a second copy of it.
  Back is designed per entry point: section 11 names each.
- **The row and the gap line** (#64). A row is at most three lines;
  the walk between two events is said between their rows. Section 10.
- **Accessibility is a requirement, not a home** (#66): a label on every
  new control; focus into the sheet on open and back on close, Escape
  closing it; 44 px tap targets; contrast on the map's lit rooms;
  `prefers-reduced-motion` honoured, with no switch of our own; Larger
  text leaves the map alone. Each pull request's description says how it
  met them until Playwright checks them (#24, #57).
- **The ladder** (VISION): useful in ten seconds, better with a crew, best
  installed. Every screen makes sense at the rung the reader is on and
  makes the next rung obvious without nagging: a stranger opens on
  Explore's zero state before the con and on Now during it (sections 1,
  4); crew sections show only to a reader in a crew, and Plans' header
  offers the rung to one who is not (sections 2, 5); the nudge waits for a
  pick (#65; section 2).

**Home of:** W43, as a rule on every screen, not a screen.

## 1. The shell

As built: the recon, section 1; the numbers, section 9.

- **The bar** (#62): five tabs in today's positions - Now, Search,
  Explore, Map, Plans. `data-tab` values `now`, `browse`, `explore`,
  `map`, `plans`. The views `#view-now`, `#view-browse`, `#view-explore`,
  `#view-map`, `#view-plans`; the modules `now.js`, `browse.js`,
  `explore.js`, `map.js`, `plans.js`. Plans takes Mine's slot and its
  pick-count badge, `#plansBadge`.
- **The rename is by hand** (CLAUDE.md rule 9) and touches only the tab,
  its view, its module and its badge. `.row.mine`, `list: "mine"` and the
  key `"mineView"` mean picked, or the reader's own, and keep their names.
  `ORDER` in `tests/rules/imports.test.js`, #29's note and ARCHITECTURE
  move with the module; the port ledger's rows that name Mine are amended
  by hand.
- **The opening tab** follows `time.js` `conPhase()`: Explore before the
  con, Now during it and after it. A `#explore=` link opens its page, and a
  kept `?join=` opens Plans' join step in any phase (section 11). Today
  `state.tab` starts as `"now"` on every load (`state.js`).
- **The header** is unchanged.
- **The mini-bar** shows on Search, Explore and Plans, as today it shows on
  Search, Explore and Mine. Its right-hand words are "in 47 min", by
  `util.js` `fmtMins()`, as today; the leave-by cases go (section 12).
- **The nav's height** is measured into `--nav-h` by `scroll.js`, beside
  `--hdr-h`, at the moments the header is measured. The five numbers that
  assume it today - `.minibar`'s 70, the 76 of `main::after`, `.devmark`
  and `#view-map`, the pill's 80, and the 124 and 132 under
  `body.has-minibar` - are derived from `--nav-h`. This closes the recon's
  UNSURE 2 by measurement.

Moves: `index.html`'s nav and view ids; `shell.js` `render()`'s list and
its `if`s, `renderMiniBar()`, `onMiniBarClick()`; the other readers of
`state.tab` (recon section 9); `styles.css`'s nav rules and the five
numbers. Tests: `shell.test.js` [917] and [934], which pin the labels and
ids; `style.test.js` [1640], which pins `#view-map`'s 76 px; the
selectors of the tab, view and badge across `tests/page/`; `ORDER`. PR 2.

### The shell, as built

PR #74, with #62.

- **The rename,** by hand: `data-tab="plans"` and its label, `#view-plans`,
  `#plansBadge`, `src/plans.js` and `renderPlans()` - its private
  timeline `renderPlansTimeline()` - and the action strip's class,
  `.plans-actions`. `.row.mine`, `list: "mine"`, `state.mineView` and its
  key `"mineView"` mean the reader's own and keep their names. The one
  sentence a reader sees name the tab besides its label, the removed
  pick's news, says it "stays in Plans, marked". `ORDER` has `plans` in
  the fifth view's place; `tests/page/mine.test.js` is
  `tests/page/plans.test.js`, and the port ledger is amended for it.
- **`--nav-h`.** The root's default is `calc(71px + var(--safe-bottom))`,
  the nav as it is laid out - its border, its padding, a 58 px button and
  the inset - and `--minibar-h` is `48px`. `scroll.js` `syncNavHeight()`
  writes the nav's measured height into `--nav-h` on the root, at the
  header's moments - the frame after boot, resize, a turn of the phone,
  load, the fonts - and on a `ResizeObserver` of its own on `.nav`; a 0,
  from jsdom or a page not laid out, is ignored and the default stands.
  The measured height already holds the safe-area inset, so nothing
  derived from it adds `--safe-bottom` again: the brief that asked for a
  `calc()` from the three had it wrong. The eight rules, each today's
  value until a measurement lands:

  | Rule | Is |
  |---|---|
  | `.minibar` `bottom` | `calc(var(--nav-h) - 1px)`, over the nav's top border |
  | `main::after` | `calc(var(--nav-h) + 5px)` |
  | `body.has-minibar main::after` | `calc(var(--nav-h) + 5px + var(--minibar-h))` |
  | `.devmark` `bottom` | `calc(var(--nav-h) + 5px)` |
  | `body.has-minibar .devmark` | `calc(var(--nav-h) + 5px + var(--minibar-h))` |
  | `.update-pill` `bottom` | `calc(var(--nav-h) + 9px)` |
  | `body.has-minibar .update-pill` | `calc(var(--nav-h) + 13px + var(--minibar-h))` |
  | `#view-map` `height` | `calc(100dvh - var(--hdr-h, 63px) - var(--nav-h) - 5px)` |

  The mini-bar's own height stays `48px`, a number jsdom can compute
  ([239]), and a style rule holds it equal to `--minibar-h`.
- **The opening tab.** `shell.js` `setOpeningTab()` sets `state.tab` to
  `"explore"` while `time.js` `conPhase()` is `"before"` - earlier than
  18:00 on the season file's first day - and to `"now"` otherwise.
  `boot()` calls it after `initTimeOverride()`, so `?now=` decides it, and
  before `load()`, where a valid `#explore=` still wins. A kept `?join=`
  does nothing here yet (PR 4).
- **The tests.** `tests/page/shell.test.js`: a boot at 12:00 on the con's
  first day opens on Explore and one at 18:00 on Now; the nav measured
  into `--nav-h` by its observer and at load, resize and a turn, a 0 left
  alone. `tests/rules/style.test.js`: the root's two defaults and each
  derived rule, and no rule left that assumes the nav's height or adds
  the inset to it. None carries a ledger bracket.
- **Measured** on the next site, build 22fd291, after the merge, from the
  device readout under Settings, Advanced, which says what `--nav-h` and
  `--hdr-h` were measured at, or `default` for a nav not yet measured
  (`build.js` `deviceLine()`):

  | Where | Viewport | Insets, top / bottom | `--safe-bottom` | `--nav-h` | `--hdr-h` |
  |---|---|---|---|---|---|
  | Safari on an iPhone, a browser tab | 402×714, screen 402×874 | 0 / 0 | 0px, the inset under the cap | 71px | 63px |
  | Desktop Chromium - the Claude app's built-in browser, Chrome 152 - at 1280×800 | 1280×800 | 0 / 0 | 0px | 71px | 63px |
  | The home-screen app on an iPhone | - | not yet measured; the readout gives the raw inset, before the cap | expected 34px, `boot()`'s cap | expected 105px | - |

  Both measured copies agree with the root's default, 71 px and no inset,
  and on the desktop copy the end spacer computes to 76 px, as it did when
  it was written in by hand. The Safari tab's bottom inset is 0 because
  the browser's toolbar owns that edge of the screen. The home-screen copy
  draws to the edge, so its `--safe-bottom` is expected at `boot()`'s cap
  of 34 px and its nav at 105 px; those are to be added here once
  measured. The phone check passed: the five labels in order, the badge on
  Plans, the mini-bar flush on the nav with the dev-build mark lifted above
  it, and the map filling to the nav with its card below.

## 2. Now

As built: the recon, section 2, Now; section 5; section 7, the nudge.

- **As built, less the leave-by** (#40): the notices, the hero, Rest of
  your day, On now and in the next hour.
- **The hero.** Its ring counts to the current pick's end while one is on,
  else to the next start, as today. With a pick on and a next one today,
  its line is "ends 2:00 PM · then Hilton at 3:00 PM, ~13 min walk" - the
  walk where the two are in different buildings - taking the gap line's
  band, its words and colour, when the gap is under the walk or under the
  walk and the slack. With a pick on and none after it: "ends 2:00 PM".
  With nothing on: "starts 3:00 PM" and the walk estimate from the
  previous pick, as today.
- **Your crew right now** (W23): on con days, and only for a reader in a
  crew, a section between the hero and Rest of your day - one line per
  crewmate, what they are on now or next and where, from their kept picks.
  Nothing when none has anything. It needs a per-person reader
  `crews.js` does not export today (`crewmates()` is private; recon
  section 8), and `tickNow()`'s signature takes the section.
- **The install nudge** (#65): where it is, as it is, only while
  `picks.size > 0`. The install flow's mechanics are Delivery's.
- **Alternatives** (W2, #40): under the picks-changed notice, for a pick
  cancelled or moved, the events in the time it vacated. The notice is
  `picks.js` `pickNewsHTML()`, drawn on Now and on Plans' My day.

**Home of:** W23; W36, its trigger, W37 folded in; W2.

Moves: `now.js` `heroHTML()`, `nudgeVisible()`, `nowSignature()`,
`renderNow()`; `picks.js` `pickNewsHTML()`. Tests: `nudge.test.js` [838]
and [841], which boot with no picks and expect the nudge; `now.test.js`'s
hero suite. PRs 3 (the hero and the nudge's gate), 5 (the crew section)
and 8b (W2).

### Now, as built

PR #76, with #40 and #65: the hero and the nudge's gate. The crew section
(PR 5) and W2 (PR 8b) are still to come.

- **The hero** (`now.js` `heroHTML()`, `thenHTML()`). The ring counts to
  the end of the pick that is on, else to the start of the next, as
  before; `.late` is gone, and `ringHTML()`'s parameter with it. The line
  is one: its time in gold, `.hwhen`, and what follows it quieter,
  `.hthen`. At the default crowd factor, 1.3, the walk from the Hyatt to
  the Hilton is 16 minutes and one building's own 7:

  | The pair | The line |
  |---|---|
  | A pick on, the next today in another building, no band | ends 2:00 PM · then Hilton at 3:00 PM, ~16 min walk |
  | … the gap under the walk and the slack | ends 2:00 PM · then Hilton at 2:20 PM: 20 min gap, ~16 min walk. Tight but doable |
  | … the gap under the walk | ends 2:00 PM · then Hilton at 2:10 PM: 10 min to get there, ~16 min walk, in warn |
  | … the next starting before this one ends | ends 3:00 PM · then Hilton at 2:30 PM: overlaps by 30 min, in warn |
  | A pick on, the next in the same building | the same bands at the building's own minutes; with none, ends 2:00 PM · then Hyatt next |
  | A pick on, a stream either side | no walk, so no connection: ends 2:00 PM · then Hilton next, or then `<title>` next for a stream, which has no building; or the overlap, which is time, not walking |
  | A pick on, nothing after it today | ends 2:00 PM |
  | Nothing on | starts 3:00 PM, and under it, muted, the walk from the pick before: ~12 min from the Westin |

  The band is `walk.js` `connection()`'s for the pair, which `gapHTML()`
  reads too, so the hero and the gap line under it - Rest of your day's
  first, measured from the hero - never hold two opinions about one pair:
  the hero is a card, the gap line a list, and both stay. The gap under
  the walk and an overlap are in warn, `.hero .hthen.warn`, as the gap
  line marks them; tight but doable stays quiet in both. Nothing says when
  to leave.
- **The nudge** (`nudgeVisible()`) shows while `picks.size > 0`, never
  before: a star brings it, and unstarring the last pick takes it away.
  Its wordings and the seven-day snooze are unchanged. `nowSignature()`
  reads it, so the minute tick redraws when it comes or goes.
- **The tests.** `tests/page/walk.test.js`, section 12's; `nudge.test.js`:
  the boots behind [838] to [846] find a pick in storage, as a returning
  reader's phone would, so that none passes for want of one, and new tests
  boot with nothing starred - no nudge; a star brings it; unstarring takes
  it away. `now.test.js` [637]: with only a Sunday pick after it, the hero
  says when it ends and names nothing next.

## 3. Search, and the filter sheet

As built: the recon, section 2, Search, items 1 to 15.

- **The sticky block** keeps the box and the day chips (items 1 and 2) and
  gains one button, "Filters", with a badge counting the active filters.
- **The filter sheet** (W13), a fourth sheet panel, `#panel-filters`,
  takes the hotel chips, the kind chips, the Type control, the Fandom and
  Track selects and the noise toggle (items 3, 4, 7 and 8), and gains
  W8's four topic axes and W7's facet flags. Apply and Clear.
- **Under the box,** as built: the suggestions and the parsed chips
  (items 5 and 6).
- Everything else as built: the results' title, the no-exact line, the
  list and its folds, the hidden-photo line, the empty state, More.
- W6's cast group in Search's results is section 4's.

**Home of:** W13; W8.

Moves: `index.html` (the panel), `sheet.js` `openSheet()` (a fourth
kind), `browse.js` `renderBrowse()`, `state.browse` (the axes and facets),
`search.js` `passesFilters()`, `dispatch.js`'s chip and select handlers.
Tests: `search.test.js`'s chip suites, `untagged.test.js`, and the hotel
panel's search (section 11). PR 6.

## 4. Explore

As built: the recon, section 2, Explore; section 7, the stranger's
Explore.

- **The grid's top, in order:**
  1. **For you** (W3): about eight rows, ranked from the on-device
     profile (#32) - follows, mutes and the weights computed from stars,
     recomputed from picks and follows, which sync (#50) - each row saying
     why ("because you follow Star Trek", "like your picks"), less what
     clashes with the plan.
  2. **Following,** complete and folded, as built.
  3. **Because you starred,** as built.
  4. The sticky filter and jump chips, and the sections, as built.
- **The zero state** (W16): for a stranger with nothing starred and
  nothing followed, one curated screen in place of the hint line. Before
  the con it is the first thing the app shows (#62). Its source - a
  hand-curated file the pipeline validates, or a computed list - is the
  Explore PR's design call (Open).
- **Pages,** as built, and also the target of the sheet's track and work
  chips (#64; section 11).
- **Mute** (W5): beside Follow on a page; a mute is kept by id in the
  profile beside the follows (#32).
- **With the cast** (W6): the cast group a work's page has (#32, #39),
  also in Search's results for a work and in the Following feed.

**Home of:** W3; W16; W5; W6.

Moves: `explore.js` `renderExploreGrid()`, `renderExplorePage()`,
`followingHTML()`; `follows.js` (mutes); `search.js` `browseResults()`
(the cast group). Tests: `explore.test.js`, `follows.test.js`,
`spy.test.js`. PR 8.

## 5. Plans

As built: the recon, section 2, Mine; section 8, crews' seam.

- **The crew header,** at the top: the crew's name, its member count, and
  one button for the rest - the invite, shared or renewed; leave; remove a
  member; delete - the creator's actions refused for anyone else as the
  client's courtesy (#56) - and a picker when the reader is in more than
  one crew. A removal meant to hold is followed by a new invite, which the
  header offers (`docs/sync/contract.md`, section 8). Editing one's own
  display name (W28) is in the header, its `crews.js` action PR 4b.
- **Not in a crew,** the header is the empty state: "Start a crew, or
  paste an invite link" - shown, not nagged.
- **Create and join** each say, in one sentence, "Joining shares your name
  and your starred events with everyone in this crew." The join step takes
  a pasted link (W20; `crews.js` `readInvite()`), and a kept `?join=`
  opens it (`pendingJoin()`, `takePendingJoin()`; section 11).
- **Every action:** `ensureUser()` where #56 says - create and join - one
  request, `runSync()` after it, and on failure `crewMessage()`'s words,
  shown; nothing written on the phone.
- **Under the header, a segmented control, My day | Crew:**
  `state.plansView`, saved under a new key, `"plansView"`. With nothing
  saved: Crew on a con day when the reader is in a crew, else My day.
- **My day** is Mine as built, every day: the picks-changed notice and
  W2's alternatives under it (section 2); the action strip, Export and
  Remove all, and Share a day beside Export (W25) - it shares the reader's
  day, not the crew's, by a link that needs no backend (#10, #50); the
  Timeline | List toggle; the timeline and the list.
- **Crew** has day chips - today by default, `map.js` `mapDay()`'s
  convention - and shows one day: per crewmate, the reader first, their
  picks that day as compact rows (`list: "crew:<user>"`). In 2027 this is
  the overlay (#62): lanes on the reader's own timeline are Open.
- **The redraw:** `sync.js` `pull()` asks for one only when the reader's
  own picks or follows changed (recon section 8); Plans needs one on a
  crew change too, a `sync.js` change in PR 4.

**Home of:** W19; W20; W21; W25; W28.

Moves: `plans.js` (Mine's module, renamed in PR 2), `crews.js` (the
per-person reader, W28's action), `sync.js` `pull()`, `state.js`,
`index.html`. Tests: `mine.test.js`, renamed; `crews.test.js`;
`sync-pull.test.js`; `removed.test.js`. PRs 4, 4b and 5 (W25).

## 6. Map, and the building view

As built: the recon, section 2, Map; section 5, the map card.

- **As built, less the card's leave-by** (#40): the card keeps "3:00 PM ·
  in 47 min" and the walk estimate.
- **Crewmates' picks counted per hotel:** a second count beside the gold
  pick pill, not gold - gold is the reader's own. "Presence" stays #10's
  word.
- **The building view** (#60), the drill-down: tap a hotel and it lifts to
  its levels, the reader's picks lit (W38); tap a level and it drops to a
  top-down view, rooms in place, landmarks marked, lit where the picks are,
  a tap on a room for what is on there (W39); the motion between them last
  (W40); the Westin, the Courtland Grand and the Mart as sources allow
  (W41). A hotel without level data keeps the hotel sheet (#28; section
  8). Data per #58: `data/<year>/drawings/`, keyed by the venues file's
  level and room ids.
- **Focused:** the event sheet's place line lands here on its hotel - on
  its room once the building view exists - with the card showing that
  event, which reopens the sheet (#63, #64; section 11).
- **Reduced motion** (#66): the lift and the level swap show their end
  states with no animation.
- **Before its screens** (#60's Cost): the map one persistent SVG, mutated
  in place (#28's Cost) - today `renderMap()` rebuilds it by `innerHTML`
  and `tickMap()` redraws it whole on a new signature - the Marriott's and
  the Hyatt's levels drawn, and each hotel's levels in one frame (#58's
  Cost).

**Home of:** W38; W39; W40; W41.

Moves: `map.js` `mapCardHTML()` (PR 3), `mapPillSVG()` and `mapCounts()`
(PR 5), `mapSVG()` and a focus in `state.map` (PRs 7 and 10). Tests:
`map.test.js`, its "late pair" and "streaming next" suites in PR 3;
`style.test.js`'s map rules. PRs 3, 5, 7 and 10.

## 7. The event sheet

As built: the recon, section 3, the event panel.

As built, plus:

- **The place line** is tappable: the Map on that hotel, focused (section
  6).
- **The level and "how to get there"** (W18) under the place line, from
  the venues file, as the data lands (section 13).
- **"Known for"** (W42): a guest's reviewed line under each person, and
  under the name on that person's Explore page, joined by id from the
  file's `people` block (#61), which `data.js` does not read today and
  which is `[]` in 2026's file until the review lands.
- **The chips** - each track and each work - are tappable: their Explore
  page.
- **Facets** (W7) in words.
- **Who's going** (W22): a line, from `crews.js` `goingTo()`, for a reader
  in a crew; in 2027 it taps nowhere.
- **The overlap** (W1): at the moment of starring, a line that lists
  every pick it overlaps, each with its times; a line, not a toast. The
  row's flag is section 10's.
- **Add to calendar** with W44's alarm, a fixed lead before the start - the
  same `ics.js` as Plans' Export, so both doors carry it. W44 is a
  standalone pull request in a free execution slot (#57), outside the
  sequence.
- **Focus and Escape** (#66): focus into the sheet on open and back to what
  opened it on close, and Escape closes it, for every panel.

**Home of:** W18; W22; W42; W44.

Moves: `sheet.js` `eventSheetHTML()`, `openSheet()`, `closeSheet()`;
`dispatch.js` `onEventPanelClick()`; `data.js` (the people block);
`explore.js` `renderExplorePage()` (the line); `ics.js`.
Tests: `sheet.test.js`, `explore.test.js`'s "the detail sheet offers a way
through to a person", `ics.test.js`. PRs 5 (who's going) and 7; W44
standalone.

## 8. The hotel sheet

As built: the recon, section 3, the hotel panel.

As built. Once the building view exists it opens only for a hotel without
level data (#28; section 6).

## 9. The gear

As built: the recon, section 3, Settings.

In order:

1. Settings as built: the crowd factor, the noise default, Larger text,
   Advanced.
2. Keep your plan as built, on a build with a backend.
3. **The notifications toggle** (W34): its slot here; its wiring - the
   subscription and the worker's handler - Delivery's.
4. **About this app** (W32, #59): a row that opens a fifth sheet panel,
   `#panel-about`, whose back returns to Settings. Three parts: what we
   store, about this app, and the links - one to Dragon Con's official
   site and app. **Delete my account** (W45) is on it, and needs a
   server-side delete that does not exist: a `supabase/` migration and RPC,
   sequenced with the gear PR.
5. Done.
6. Remove all picks, last.

**Home of:** W32; W34; W45.

Moves: `index.html` (the panel, the toggle's slot), `sheet.js`
`fillSettings()` and `openSheet()`, `supabase/migrations/` and
`supabase/tests/` (W45). Tests: `settings.test.js`, `keep.test.js`,
`sheet.test.js`; pgTAP for the delete. PR 9.

## 10. The row and the gap line

As built: the recon, section 4, the row's thirteen elements and every
caller; section 5, the gap line.

**The row** (#64), three lines at most:

| Line | What | From the recon's table |
|---|---|---|
| 1 | The star, the title, the state tags: Cancelled, Removed from the schedule, Celebrity | the star; the title, its ★ and strike and marks; Cancelled; Removed; Celebrity |
| 2 | The day's label where the caller asks (`showDay`), "2:30–3:30 PM", then hotel · room · level | the day label; the start and "to" end; the place chip |
| 3, only when anything is present | The track's label or "Gaming", muted; W7's facet flags; the pick's overlap flag; the caller's context - Now's status, the Following feed's labels by time | the track; the status; the follow labels |
| under 3, Search's ranked results only | The two-line snippet: the result's anatomy, why it matched | the snippet |

- **The overlap flag** (W1): a picked row that overlaps another pick
  carries a flag on line 3 wherever the row appears - "Overlaps
  `<title>`" for one clash, "Overlaps `<n>` picks" for more than one; it
  appears at the moment of starring, on a row or in the sheet, and
  persists; an unstarred row carries none. The check runs over every pick,
  not the consecutive pair `gapHTML()` sees; the helper's home is PR 7's
  stop 1 to propose.
- **Facets** (W7) are flags on line 3 and words on the sheet (section 7).
- **The gap line** stays: `leave.js` `gapHTML()` - `walk.js` from PR 3 -
  says the walk and the two tight bands between rows, never on a row, and
  the overlap between rows on Now and Plans. Plans' timeline keeps its walk
  links, one band, as built.
- **Callers** as the recon lists them, plus Plans' Crew segment,
  `list: "crew:<user>"`.

**Home of:** W1; W7.

Moves: `ui.js` `rowHTML()`, `styles.css`'s row rules, every caller's
options. Tests: the page tests that read a row's parts, and
`style.test.js` [1827]. PR 7.

## 11. Entry points

As built: the recon, section 2, each tab's taps that leave it; section 6,
the hash and the address.

| From | To | State it sets | Back | Since |
|---|---|---|---|---|
| Any row, the hero, the map card and its On now line, a timeline block | The event sheet | `state.sheetId` | Done, the backdrop, a swipe, Escape (#66): the screen as it was | built |
| The gear | The Settings panel | the panel shown | Done, the backdrop, a swipe, Escape | built |
| Settings' About row | `#panel-about` | the panel shown | its back: Settings | PR 9 |
| The mini-bar | Now | `state.tab` | the tab bar | built |
| A Map hotel block or pill, a hotel without level data | The hotel sheet | `state.sheetHotel` | Done, the backdrop, a swipe, Escape: the Map | built |
| A Map hotel block, a hotel with level data | The building view | the Map's drill-down | the view's own back, to the Map | PR 10 |
| The hotel sheet's "Search the Hyatt on Saturday" | Search | `state.browse`: the hotel, the day, no query | the tab bar to the Map, whose day `state.map.day` kept | built |
| The event sheet's "See all" beside a person | That person's Explore page | `state.explore.page`, the hash | "← Explore", to the grid: one tap from the event, accepted | built |
| An Explore tile, a Following chip, a Because-you-starred tile | Its page | `state.explore.page`, the hash | "← Explore", the grid's scroll put back | built |
| A `#explore=` link | Its page | the same, at load | "← Explore", to the grid | built |
| The event sheet's track or work chip | Its Explore page | the same | "← Explore", to the grid, as See all | PR 7 |
| The event sheet's place line | The Map, focused on the hotel - the room once the building view exists | `state.tab`, a focus in `state.map` | the Map's focused card, which reopens the sheet | PR 7 |
| Search's Filters | `#panel-filters` | the panel shown | Apply, Clear, or closed: Search | PR 6 |
| A kept `?join=`, in any phase | Plans' join step | `state.tab`, the step open | the step closed: Plans as it opens | PR 4 |

## 12. Removals (#40)

As built: the recon, section 5.

- **The leave-by goes** from its three sites: the hero (`now.js`
  `heroHTML()`), the mini-bar (`shell.js` `renderMiniBar()`, whose words
  are "in 47 min" alone) and the map card (`map.js` `mapCardHTML()`), and
  from `map.js` `mapNowState()`, which computes one nothing draws. A
  stream as the next pick loses its leave-by with the rest.
- **`LEAVE_BUFFER_MIN` is renamed `SLACK_MIN`**, the venues file's
  `slack_min`: the tight-connection slack is all it is now.
- **`leave.js` is renamed `walk.js`**, which holds walks and gaps
  afterwards; `ORDER`, #29's note and ARCHITECTURE move with it.
- **`currentLocation()` is deleted,** and #40's note says so: the app no
  longer says where the reader is.
- The walk estimate and the tight bands stay: the hero's line (section 2),
  the map card's "~12 min from the Westin", the gap lines, Plans'
  timeline links.

Moves: `leave.js`, `venues.js`, `now.js`, `shell.js`, `map.js`,
`styles.css` (`.hleave`, the `.late` rules, `.nc-when.leave`). Tests:
`leave.test.js`; `minibar.test.js`'s late cases; `map.test.js`'s "late
pair" and "streaming next"; `style.test.js` [1581] and [1774];
`imports.test.js`'s `ORDER`. PR 3.

### Removals, as built

PR #76, with #40.

- **The leave-by is gone** from its three sites, and from `map.js`
  `mapNowState()`: the hero (section 2, as built); the mini-bar
  (`shell.js` `renderMiniBar()`), "in 47 min" by `fmtMins()` alone; and
  the map card (`map.js` `mapCardHTML()`), "3:00 PM · in 47 min", or the
  start alone for a later day, and the walk from the pick before,
  `walkEstimate()`, which now shows with a pick on elsewhere too, where
  the leave-by stood. A stream as the next pick has its start alone on the
  mini-bar and the card, and its title on the hero. With it went the CSS
  that coloured it: `.hleave` - the hero's line is `.hwhen` - the five
  `.late` rules and `.nc-when.leave`.
- **`walk.js`** is `leave.js`, moved by `git mv`:
  - `walkEstimate(next)`, what was left of `leaveInfo()`: the walk from
    the pick before today, when that was another building, as
    `{walk, from, label}`, else null;
  - `connection(prev, next)`, the tight-connection flag, as
    `{walk, gap, band}`: the band `"overlap"` for any pair, a stream
    included, and otherwise, where there is a walk, `"cant"` under it or
    `"tight"` under it and `SLACK_MIN`; a pair with no walk, a stream
    either side, has no connection, null;
  - `gapHTML()`, which reads its band from `connection()`: byte for byte
    what it said before, but for a stream's pair within the slack, which
    said "about 0 min. Tight but doable" and says nothing now;
  - `nextPickInConDay()`, unchanged, and `previousPick()`, private.

  `leave.js` and `walk.js` are 24% alike, and their tests 25%, so after
  the squash `git log --follow` crosses the renames with `-M20%`.
- **`currentLocation()` is deleted** with its last reader: nothing in the
  app says where the reader is.
- **`SLACK_MIN`** is `venues.js`'s name for the venues file's `slack_min`.
  `ORDER` has `walk` in `leave`'s place.
- **The tests.** `tests/page/walk.test.js` is `leave.test.js`, moved: the
  leave-by formula's and `currentLocation()`'s cases deleted, ledger rows
  125, 126 and 145 to 148; the rest kept, a pick on now's rewritten for
  the new words; the hero in each band, in two buildings and in one,
  against pairs the fixture has at 1:05 PM, and the gap line under it
  giving the pair the same band; a stream after the pick on and one
  overlapping it; nothing on the three surfaces saying leave or marked
  late; and `gapHTML()` pinned against the code it replaced, over every
  pair of the fixture's events a few hours apart and over made pairs at
  every gap from a 40-minute overlap to 40 minutes apart. `minibar.test.js`
  has no late case: its one leave-by case, [238], and `map.test.js`'s
  [1548], [1580], [1581] and [1771] now read the countdown and the walk
  line; "a streaming next" asserted nothing the removal changed, since the
  card never gave a stream a leave-by, and stands. `style.test.js`: [1774]
  rewritten - the card's timing line has one look - with [1581]'s CSS half
  merged into it, and two new rules, no `.late` rule anywhere and the
  hero's line. [191] stands. A mutation pass restored the leave-by in
  `heroHTML()`, and [197], the three bands' tests and the no-leave test
  failed; every other mutant of the pass was caught too.

## 13. Waiting on data

As built: the recon, section 3, what the event panel does not carry.

- **W42:** the `people` block is `[]` in 2026's file until the line
  review lands (#61); the sheet's line shows only once it has rows.
- **W18:** the levels are in `venues.json` for the Marriott, the Hyatt and
  the Hilton (#45); the one-line "how to get there" exists nowhere yet.
- **W16:** the zero state's curated source (section 4; Open).
- **W45:** the server-side delete, a `supabase/` migration and RPC, with
  the gear PR.

## 14. Open

As built: the recon, section 8, what crews' readers offer today.

- The crew's day beyond per-person lists: lanes on the reader's own
  timeline (#62).
- **Status pings** (W24), a checkpoint candidate, rank 2: the build order
  stays picks → presence → pings (#10).
- The Now board's shape beyond one line per crewmate (W23).
- W16's source: a hand-curated file the pipeline validates, or a computed
  list - the Explore PR's call.
- Which day Share a day shares, and its link's shape (W25).

**Home of:** W24.
