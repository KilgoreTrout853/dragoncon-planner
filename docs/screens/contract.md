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
the same PR. Since DECISIONS #83 a PR adds no "as built" part: it fixes the
designed text, marks a section built in one line and puts its evidence in
the PR; the "as built" parts below are dated records of the PRs that wrote
them.

Every wanted feature this tentpole places has one home, named once, on a
line of its own: **Home of:**. A W-id is `docs/scope-2027.md`'s.

## 0. Rules

As built: the recon, sections 3 (no focus management, no key closes the
sheet) and 7 (what each reader sees).

- **One home, any number of entry points** (#63). An item's home is the
  screen that owns its state; an entry point is a tap from context that
  opens the home's own state with parameters, never a second copy of it.
  Back is designed per entry point: section 11 names each.
- **The row and the gap line** (#64, #73). A row is its title and up to
  two lines under it; the walk between two events is said between their
  rows. Section 10.
- **Accessibility is a requirement, not a home** (#66): a label on every
  new control; focus into the sheet on open and back on close, Escape
  closing it; 44 px tap targets; contrast on the map's lit rooms;
  `prefers-reduced-motion` honoured, with no switch of our own; Larger
  text leaves the map alone; a field's text is never under 16px: an
  iPhone zooms the page on focus - and zoom itself is never limited or
  blocked. Each pull request's description says how it met them until
  the browser tests check them: the harness is built (#81), and step 11's
  sweep adds these to it.
- **The ladder** (VISION): useful in ten seconds, better with a crew, best
  installed. Every screen makes sense at the rung the reader is on and
  makes the next rung obvious without nagging: a stranger opens on
  Explore's zero state before the con and on Now during it (sections 1,
  4); crew sections show only to a reader in a crew, and Plans' header
  offers the rung to one who is not (sections 2, 5); the nudge waits for a
  pick (#65; section 2).
- **What is tapped stays where it stood** (#86; PR #104). A control
  that is tapped, and is still there after the draw, stands where it
  stood, to 1 px, wherever the page is scrolled; where the tap takes
  it away, what stood just above it stays. The page's scroller does
  not anchor, and the browser tests hold the rule.

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
- **The header** is unchanged, but for where its simulated-time chip
  stands (#82; The chip, as built).
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
  wins over the phase: since PR #77 `boot()` reads the invite first, and
  the tab is Plans, under its join step (section 5, as built).
- **The tests.** `tests/page/shell.test.js`: a boot at 12:00 on the con's
  first day opens on Explore and one at 18:00 on Now; the nav measured
  into `--nav-h` by its observer and at load, resize and a turn, a 0 left
  alone. `tests/rules/style.test.js`: the root's two defaults and each
  derived rule, and no rule left that assumes the nav's height or adds
  the inset to it. None carries a ledger bracket.
- **Measured** on the next site, build 22fd291, after the merge - the
  home-screen app's row at build 5fb5453, on 2026-10-01 - from the
  device readout under Settings, Advanced, which says what `--nav-h` and
  `--hdr-h` were measured at, or `default` for a nav not yet measured
  (`build.js` `deviceLine()`):

  | Where | Viewport | Insets, top / bottom | `--safe-bottom` | `--nav-h` | `--hdr-h` |
  |---|---|---|---|---|---|
  | Safari on an iPhone, a browser tab | 402×714, screen 402×874 | 0 / 0 | 0px, the inset under the cap | 71px | 63px |
  | Desktop Chromium - the Claude app's built-in browser, Chrome 152 - at 1280×800 | 1280×800 | 0 / 0 | 0px | 71px | 63px |
  | The home-screen app on an iPhone, iOS, build 5fb5453 | 377×761, screen 402×874 | 0px / 34px | 34px, `boot()`'s cap | 105px | 63px |

  The two browser copies agree with the root's default, 71 px and no
  inset, and on the desktop copy the end spacer computes to 76 px, as it
  did when it was written in by hand. The Safari tab's bottom inset is 0
  because the browser's toolbar owns that edge of the screen. The
  home-screen copy draws to the edge: its bottom inset is 34 px, at
  `boot()`'s cap, and its nav 105 px, the default's 71 and the inset, as
  expected. Its viewport measured 377 wide against a 402-wide screen,
  where the Safari tab's measured 402: not explained (section 14, Open).
  The phone check passed: the five labels in order, the badge on
  Plans, the mini-bar flush on the nav with the dev-build mark lifted above
  it, and the map filling to the nav with its card below.

### The chip, as built

PR #101, with #66, #81 and #82. While a clock is simulated the header's line
reads the clock, the chip, then the freshness line: `#simChip` stands
between `#clock` and `#fresh`, so the words after it take the ellipsis
and the chip is drawn whole at every size, with Larger text on,
whatever the hour. Its look is as it was. Its tap area is its `::after`,
18 px above its box and 9 below - 44 px tall or more, and inside the
header on every tab - and `.hdr-line` carries that room as padding, taken
back as margin: the header's height and `--hdr-h` are what they were,
63 px, and nothing else in the header moved. A screen reader meets the
clock, the chip, the freshness line, then the gear. Held by
`tests/browser/chip.spec.js`, in Chromium and in WebKit at 375, 390 and
402 wide; on a phone it is the pull request's to check.

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
- **Your crew's picks right now** (W23; "Your crew right now" until PR #83,
  #68): on con days, and only for a reader in a crew, a section between the
  hero and Rest of your day - one line per crewmate, their pick on now or
  next and where it is, from their kept picks, "yours too" when it is the
  reader's pick too: what they starred, never where they are. On now first,
  then by start, then by name; four lines, then "+N more", which opens
  Plans' crew's day on today. Nothing when none has anything. It needs a
  per-person reader `crews.js` does not export today (`crewmates()` is
  private; recon section 8), and `tickNow()`'s signature takes the section.
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

PR #76, with #40 and #65: the hero and the nudge's gate. PR #81, step 5a,
with #10, #62 and #66: Your crew right now, worded as picks by PR #83, step
5d, with #68. W2 (PR 8b) is still to come.

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
  | A pick on, the next offsite | ends 2:00 PM · then Joystick Gamebar at 3:00 PM, ~16 min walk: its room, else offsite, as `venues.js` `placeShort()` names a place in a line of words (#73); after an offsite pick, one building: then Joystick Gamebar next |
  | A pick on, nothing after it today | ends 2:00 PM |
  | Nothing on | starts 3:00 PM, and under it, muted, the walk from the pick before: ~12 min from the Westin |

  The band is `walk.js` `connection()`'s for the pair, which `gapHTML()`
  reads too, so the hero and the gap line under it - Rest of your day's
  first, measured from the hero - never hold two opinions about one pair:
  the hero is a card, the gap line a list, and both stay. An overlap the
  gap line no longer says: the two picks' rows flag it (#73; section 10,
  as built). An overlap is the two picks' intersection, the earlier end
  less the later start, so a 10-minute session inside a 4-hour game
  overlaps by 10. The gap under the walk and an overlap are in warn,
  `.hero .hthen.warn`, as the gap line marks the first and a row's flag
  the second; tight but doable stays quiet in both. Nothing says when to
  leave.
- **The nudge** (`nudgeVisible()`) shows while `picks.size > 0`, never
  before: a star brings it, and unstarring the last pick takes it away.
  Its wordings and the seven-day snooze are unchanged. `nowSignature()`
  reads it, so the minute tick redraws when it comes or goes.
- **Your crew's picks right now** (W23; since PR #81, its words since
  PR #83; `now.js` `crewHTML()`, `crews.js` `crewRightNow()`). On a build
  with a backend, for a reader in a crew, and only while the clock - real or
  simulated - is inside the con: before it the tab previews a made-up
  moment, Thursday at 10 AM, and after it the tab is the record. Between the
  hero and Rest of your day; with no hero, after the line that says so, and
  after the reader's next pick on another day where there is one. Headed
  "Your crew's picks right now" - "Your crew right now" until PR #83: a star
  is a pick, not a whereabouts (#68) - with no count. A line a crewmate,
  from every crew the reader is in, named as `goingTo()` names them, by the
  oldest crew's name: their pick on now, else their next today, the rule the
  hero keeps - anything still running counted in today, and of two on at
  once the earlier start. Each line is a button to that event's sheet:

  | The case | Its first line | Its second |
  |---|---|---|
  | On now | **Bo** · on now | the title · Westin |
  | The reader's pick too | **Bo** · on now · yours too, the last in gold - "with you" until PR #83 | the title · Westin |
  | Next today | **Dee** · 2:30 PM | the title · Hyatt |
  | Offsite | as above | the title · its room, else offsite - as the Map's On now line names it (`venues.js` `placeShort()`) |
  | A stream | as above | the title · Streaming |

  On now first, then by start, then by name. Four lines, then "+N more", a
  quiet button labelled "+N more of your crew, in Plans", which does what a
  tap on Plans' Crew segment does - `state.plansView` saved as Crew, and a
  sync run - on today, `state.plans.day` back to the clock's, scrolled to
  the top and with focus on the segment's Crew. A crewmate whose picks
  today are over has no line, and with none left there is no section. A
  removed event, or one this copy of the schedule does not hold, is no
  one's: `crewRightNow()` reads `data.js` `events`. A cancelled one stays,
  as the reader's own hero keeps one; W2 (PR 8b) revisits cancellations.
  `nowSignature()` takes each line - who, on what, on now or next, and
  whether it is the reader's too - so the minute tick draws Now again when
  a line moves on or ends. Every name is someone's own text, and escaped.
- **Focus** (#66; since PR #81). A line's id is its crewmate's,
  `crewNow-<user>`, so closing an event's sheet gives focus back to the
  line that opened it, not to the hero on the same event. Now gives focus
  back to the control that had it - a line, a row's star, the hero, a chip,
  a button - each time it draws, a pull's redraw and the minute's alike, as
  `scroll.js` `focusKey()` finds it again; the sheet's opener is kept the
  same way, `focusKey()` being the sheet's `openerOf()` moved down, with
  chips and actions added. The hero is kept by its place, `#nowHero`,
  whatever event it shows, as a crew line is by its crewmate, so focus
  never lands on a crewmate's line for the hero's event, or on the hero for
  a crewmate's. The hero's own refresh at the minute writes its new ring into it
  in place, so a hero with focus keeps it and is not read out again. The
  lines are 44 px or taller, their focus ring drawn inside them, and "+N
  more" 46.
- **The tests.** `tests/page/walk.test.js`, section 12's; `nudge.test.js`:
  the boots behind [838] to [846] find a pick in storage, as a returning
  reader's phone would, so that none passes for want of one, and new tests
  boot with nothing starred - no nudge; a star brings it; unstarring takes
  it away. `now.test.js` [637]: with only a Sunday pick after it, the hero
  says when it ends and names nothing next. Since PR #81,
  `tests/page/crew-everywhere.test.js`: the section's place, with a hero
  and without; its lines' words and order, "yours too", the cap and "+N
  more" landing on Plans' crew's day on today; a line's sheet and focus
  back on it; focus kept through a crew's pull and the minute's tick; the
  tick moving a line from next to on now, and a pick that ends; the con's
  live phase alone; removed, unknown and offsite picks. `crews.test.js`:
  `crewRightNow()` over a schedule of the test's own. None carries a
  ledger bracket.

## 3. Search, and the filter sheet

As built: the recon, section 2, Search, items 1 to 15.

- **The sticky block** keeps the box and the day chips (items 1 and 2) and
  gains one button, "Filters", with a badge counting the active filters.
- **The filter sheet** (W13), a sheet panel, `#panel-filters`,
  takes the hotel chips, the kind chips, the Type control, the Fandom and
  Track selects and the noise toggle (items 3, 4, 7 and 8), and gains
  W8's four topic axes. No Apply: a tap applies at once, and the list is
  drawn again when the sheet closes; Clear (#70). W7's facets as filters
  are built, as step 7b: cost, sign-up, audience and sold out, under
  Getting in (#77; as built, below).
- **Under the box,** as built: the suggestions and the parsed chips
  (items 5 and 6), and in the parsed chips' row each filter the sheet set.
- Everything else as built: the results' title, the no-exact line, the
  list and its folds, the hidden-photo line, the empty state, More.
- W6's cast group in Search's results is section 4's.

**Home of:** W13; W8.

Moves: `index.html` (the panel), `sheet.js` `openSheet()` (a seventh
kind), `browse.js` `renderBrowse()`, `state.browse` (the axes),
`search.js` `passesFilters()`, `dispatch.js`'s chip and select handlers.
Tests: `search.test.js`'s chip suites, `untagged.test.js`, and the hotel
panel's search (section 11). PR 6.

### Search and the filter sheet, as built

Changed by PR #103 (#85): with the Fandom filter set and no word to rank by, the cast group stands after the list.

PR #88, step 6 (W13, with W8), with #63, #66 and #70; the last one set
wins, and the panel's order, by PR #90 (#71); Getting in, W7's four
filters, by PR #96, step 7b (#77).

- **The page** (`browse.js` `renderBrowse()`). The sticky block is the
  box and, right of it at the box's height, 48px, the Filters button, then
  the day chips. The button's badge counts what the sheet set that is in
  effect, hidden at none, and its name says so: "Filters", "Filters, 2
  set". The block is built once, so a redraw writes only the badge and
  the name: the box is never rebuilt under the keyboard. The box has a
  name of its own, "Search the schedule", and its placeholder is
  "Titles, guests, fandoms" (`search.js` `SEARCH_PLACEHOLDER`), the longer
  "Search titles, guests, fandoms" measured too wide beside the button
  with Larger text on and the badge showing: 228px of text in a box with
  207. Under the block, only when there is something there: the
  suggestions, then one row, "Filters in effect" - the Today chip, the
  query's words, then each filter the sheet set, in the sheet's order. With
  nothing set and nothing typed, the results' title follows the day chips.
- **The panel,** `#panel-filters` (`filters.js` `filtersHTML()`, which
  `sheet.js` `openSheet("filters")` draws as it opens): the heading
  "Filters"; a body that scrolls on its own, in #71's order - Hotel, its
  small label and its chips, All and each hotel; Fandom and Track side by
  side; Medium, Genre, Craft and Subject two by two, each "Any `<axis>`"
  and then its values by how many events carry them, then by label, with
  the count, as the Fandom select's works are ordered; the Type control,
  All, Panels, Gaming; Kind, its label and its chips, Any kind and each
  kind the schedule has; Getting in, its label and its four selects two
  by two, Cost, Sign-up, Audience and Sold out (#77; below); and the
  toggle that hides photo sessions and video-room screenings - and under
  the body, on screen, "Show `<n>` events" and Clear. The chips wrap. A
  schedule with no tags has no Kind group, no Fandom select, no topic
  selects, and no Audience among Getting in's selects.
- **Live** (`dispatch.js` `onFiltersPanelClick()`,
  `onFiltersPanelChange()`; `filters.js` `setFilter()`, `fillFilters()`).
  A tap or a choice changes `state.browse` at once, one value a filter - a
  second tap on the hotel that is on is All again - and the panel writes
  what changed into the nodes already there, the pressed chips, the
  selects, the toggle, Clear and the count, so focus stays where it was.
  A tap or a choice on a dimension a word in the box holds takes the word
  out of the query first (#71; below).
  The count is `search.js` `browseResults()`'s, the list's own: "Show 1
  event", "Show 1,234 events", and "No events match" at none, the button
  still closing the sheet. Nothing behind is drawn while the sheet is open
  for a tap. A redraw for any other reason - a pull, coming back to the
  app, the index ready - draws the list as `state.browse` stands, and
  leaves the panel, its focus and its scroll alone.
- **Closing,** by Show `<n>` events, the backdrop, a swipe down on the
  heading or Escape, draws the list once and gives focus back to the
  Filters button. With anything changed since the sheet opened the list
  starts from its top; with nothing changed, or a change taken back, where
  it was. A drag that starts in the body scrolls it.
- **Clear** (`filters.js` `clearFilters()`) takes the thirteen filters -
  the hotel, the kind, the type, the fandom, the track, the four axes and
  Getting in's four - back to All, and the toggle to Settings' default;
  never the day, nor the query, so a word in the box stays, and its value
  pressed. It is disabled with nothing to clear, and enabled when only the
  toggle differs from Settings' default.
- **The chips under the box** (`browse.js` `parsedChipsHTML()`;
  `filters.js` `inEffect()`) are gold, 44px, one row that scrolls
  sideways and keeps its place across a redraw. A long label is cut with
  an ellipsis; the chip's name carries it whole, "Remove `<label>`
  filter". A tap takes that one filter off (`dispatch.js` `takeOff()`) -
  a query's word out of the box, as before, or the sheet's filter back to
  All - and focus goes to the chip that takes its place in the row, else
  to the Filters button: never to the box, which would raise the keyboard.
- **The last one set wins** (#71; `filters.js` `setFilter()` and
  `settleWords()`; `dispatch.js` `onMainFocusOut()` and `onMainChange()`).
  The query's hotel, kind, track and audience words - "hilton",
  "contest", "photo", "kids", "18+" - and the sheet set the same four
  filters, the audience since #77, one value each, and the one set last
  is in effect. Nothing in the panel is disabled, and
  each group shows what is in effect, the word's value where a word holds
  it. A tap or a choice there takes the word out of the query, as its
  chip's x does (`search.js` `dropPhrase()`), and a second word that
  would hold the dimension once the first is gone, then sets the value
  tapped; a second tap on the hotel in effect is All. "kids" taken out by
  a track takes its No 18+ with it, and taken out by the Audience its
  Kids Track (#77; below). A word typed takes the sheet's
  value for its dimension to All once the box is left - the return key,
  which blurs the box; the box's `focusout` and its `change`, two hands
  on one idempotent step, `focusout` firing on every blur and `change`
  only for a value changed since focus; and `sheet.js`
  `openSheet("filters")`, which takes the step before the panel draws,
  whether or not the box has lost focus by then - never a keystroke,
  since "photo" on the way to "photoshoot" holds Kind until the next
  letter. Until then the word wins, as `search.js` `activeFilters()` has
  it, and `inEffect()` leaves a dimension a word holds out of the badge
  and the chips under the box, so a word deleted before the box is left
  gives the sheet's value back. Nothing shown changes as the box is left,
  so nothing is drawn. Type, the fandom, the axes, and Getting in's
  cost, sign-up and sold out have no words.
- **The empty state,** while a filter of the sheet's is in effect: "No
  matches. Remove a filter above, or try another day or fewer words."
  Unchanged otherwise.
- **The topic axes** join `search.js` `passesFilters()` as the others do:
  each set holds, an event with two values on one axis passing on either,
  and an untagged event passing none that is set.
- **The hotel sheet's "Search the Hyatt on Saturday"** lands on Search as
  before, the hotel now a chip under the box and counted on Filters
  (section 11).
- **The module.** `src/filters.js`, a leaf after `ui` in `ORDER`: the
  panel's markup, its in-place fill, what is in effect, Clear, one filter
  set, and the step a word typed takes once the box is left. The panel's
  element is `sheet.js`'s, its handlers `dispatch.js`'s, which close the
  sheet as well.
- **#66.** Every control in the panel is labelled and 44px - the chips,
  the Type control and the selects grown from 40, the toggle - and Show
  and Clear are 46px. Every field in the sheet is 16px, so an iPhone does
  not zoom on a select. Focus goes to the heading as the panel opens and
  back to the Filters button as it closes; Escape closes it. The row
  under the box is 44px. The day chips and the suggestions stay at 38px.
  Getting in's four selects (#77) are the panel's selects - 44px, 16px,
  each with a name of its own, Cost, Sign-up, Audience and Sold out -
  under a small label that names their group, as Hotel's and Kind's do; a
  choice writes the panel in place, so focus stays on its select.
- **Measured** at 375x667 in desktop Chromium, on the built page with
  2026's schedule and the real clock's has-ended notice, 111px, above
  Search. The first result is 382px down, where it was 684px: 271px and
  573px without the notice. The panel with nothing set: the sheet from
  107px to the screen's foot, its heading at 140px, the body 411px tall
  over 731px of groups, Show and Clear at 601 to 647px. With all nine set:
  "No events match", the badge 9 and the button "Filters, 9 set", and nine
  chips under the box, 44px tall, one row 1,088px wide that scrolls
  sideways, none cut. With Larger text on and the nine set: the box 235px
  beside a 104px button, its placeholder 175px of text in 205; the sheet
  from 142px, the body 373px tall, Show and Clear still at 601 to 647px.
- **Measured for #71,** in desktop Chromium on the built page with 2026's
  schedule, the panel with nothing set, its body from 178px. At 375x667
  the body ends at 589px: Hotel, Fandom with Track, the four topics and
  Type are on the first screen, Type ending at 572px; Kind starts at
  586px, 3px above the fold, its label cut, and the toggle is below it.
  At 402x714 the body ends at 636px: the same four, then Kind's label and
  the top 50px of its first row of chips, cut by the fold. #70's order at
  402x714, the same groups moved back in place, showed Hotel, Kind and
  Type, Type ending at 633px - where the brief's iPhone showed Hotel and
  Kind alone.
- **More past an edge** (PR #95, #76; section 7, More past an edge, as
  built). The body always holds more than it shows - 411 px of 731 at
  375x667 - so it fades at its foot as the panel opens, where until then
  the fold cut a row of chips with nothing to say there was more, and at
  its top once it is scrolled. Its 33 controls, focused in turn forward
  and backward, are never inside a band. Since PR #96 the body holds 862
  px and 37 controls, and both still hold (Measured for #77, below).
- **The sheet's edges** (PR #97, #78; section 7, The sheet's edges, as
  built). While the body hides 20 px or more below, a small down arrow
  stands in the 12 px gap above Show and Clear: as the panel opens, at
  every size, and it goes within 20 px of the body's end. It is there for
  the fold the fade cannot show: at 375x667 and 390x664, and at 402x714
  with Larger text, the panel opens with its fold in the gap between Type
  and Kind, the band holding the foot of the Type control and at most the
  top of Kind's label, none of its letters. And the body has room for a
  focus ring at its sides: the chips that start a row and the left-hand
  selects lost its left, the right-hand selects its right - 20 of the
  panel's 39 controls at 375x667.
- **Getting in** (PR #96, step 7b; #77; `filters.js` `filtersHTML()`,
  `search.js` `passesGettingIn()`, `data.js` `isAdult()`). Four filters,
  the flags a row says (section 10, as built), each All or one value in
  `state.browse` - `cost` and `signup`, `no` or `yes`; `audience`, `kids`,
  `no-adult` or `adult`; `soldOut`, `no` - at the end of `filters.js`
  `FILTERS`, which is thirteen, so each is set, cleared, snapshotted,
  counted in the badge and shown as a chip under the box by the code that
  was there. One group after Kind and before the toggle, labelled "Getting
  in", its four selects two by two in the topic axes' markup and classes,
  with no rule of its own in the stylesheet: Cost - Any cost, No extra
  fee, Extra fee; Sign-up - Any sign-up, No sign-up, Sign-up; Audience -
  Any audience, Kids, No 18+, 18+; Sold out - Sold out or not, Not sold
  out. The options are fixed lists, there at 0. A count stands only on an
  option that names something an event has, over every event as an axis's
  is and by the filter's own `passesGettingIn()`: "Extra fee (214)",
  "Sign-up (112)", "Kids (88)" and "18+ (105)" on 2026's schedule; "No
  extra fee", "No sign-up", "No 18+" and "Not sold out" say no number. A
  chip under the box says the option's words without the count, after
  Kind's, in the sheet's order.
- **What each keeps.** Extra fee is `facets.cost`, Sign-up
  `facets.signup` and sold out `facets.sold_out`; an event with no facets
  has no fee, no sign-up and is not sold out. Kids is the audience, not
  the Kids Track. 18+ is `isAdult()`: a mature audience, or a stated
  minimum age of 17 or more, or the listing's Mature Audience marker,
  `facets.mature` - the last two the parse stage's, asking no tags, so an
  event the tagger has not reached is 18+ where its listing says so; with
  no tags, no such age and no marker an event passes No 18+ and fails
  Kids and 18+. A row's 18+ flag asks the same `isAdult()` where the
  listing states no age (section 10, as built). On 2026's schedule, over
  all 3,459 events: 3,245 with no fee and 214 with one; 3,347 with no
  sign-up and 112 with one; 88 for kids, 3,354 not 18+ and 105 that are;
  3,440 not sold out. The list, with photo sessions and video-room
  screenings hidden, holds 2,839 and 214; 2,941 and 112; 66, 2,948 and
  105; 3,034. The three halves of 18+ name the same 105 events there.
- **The words and the Audience** (`search.js` `parseQuery()`,
  `finishParse()`; `filters.js` `dropWords()`). "18+" and "adult" hold the
  Audience at 18+, one chip, "18+". "kids", "kid", "family" and "children"
  hold two dimensions, the track at Kids Track and the Audience at No
  18+, under one chip, "Kids Track": the sheet shows both, and the badge
  counts neither. A parsed chip names every dimension its word holds, and
  a tap on a select takes out each word that holds its dimension: a
  choice in the Audience over "kids" takes the word out whole, and the
  Kids Track with it. Beside "18+" or "adult" the explicit word wins, in
  either order - "kids 18+" and "18+ kids" are the Kids Track's 18+
  events, one in 2026 - and a choice in the Audience then takes both
  words out, one in the Track "kids" alone. `filters.adult` is gone. No
  new word is read. A schedule with no tags has Cost, Sign-up and Sold
  out, the fourth cell empty; "18+" there holds a dimension the panel has
  no select for, as "contest" does Kind.
- **Measured for #77,** in desktop Chromium on the built page with 2026's
  schedule, at a simulated Saturday 1:05 PM, the panel with nothing set.
  The body's own height and Show and Clear are where they were; its
  content is the group and one gap taller. At 375x667 the body shows 411
  px of 862, where it held 731; at 390x664, 408 of 862; at 402x714, 458
  of 812, where it held 681. With Larger text: 373, 370 and 420 px of
  870, where it held 736. The group starts 686.5 px down the content at
  375x667 and 390x664 and 636.5 at 402x714, and 691.2 at all three with
  Larger text: below the fold at all six. Each select is 44 px tall -
  167, 174.3 and 180.3 px wide - at 16 px, 18.4 with Larger text. The
  fade: more below at the ceiling, 48 px, as the panel opens, and more
  above and none below at its foot; the 37 controls, focused in turn
  forward and backward, never inside a band; at all six. At 375x667 with
  Larger text every option of the four fits its closed select whole, the
  widest "Sold out or not" at 103.5 px of text; the axes' longest,
  "Cosplay Photography (171)" at 180.3 px, is wider than its select
  there, as it was. A choice takes about 1.6 ms.
- **The tests.** `tests/page/filters.test.js`, on a copy of the sample
  whose untagged events carry the four axes at counts that differ: the
  page's sticky block, the box's name and placeholder, nothing between the
  day chips and the results; the panel alone shown, and hidden by another
  panel; its groups, their order and labels, every control's name, the
  topic options by count; each control changing the state and the count
  with nothing behind drawn; one, none and the words for each; each way of
  closing drawing the list once, and focus back; a drag in the body; the
  scroll after closing, the toggle alone a change; Clear, the toggle alone
  enabling it, and the list back to its first page; the badge and the
  button's name; the chips under the box, their order, a hotel's short
  name, a removal and where focus goes, Today's, a long label, the row's
  place kept; the last one set wins (#71) - a tap over a hotel, a kind
  and a track a word holds, each taking its word out, the kind in effect
  tapped again and staying set, "kids" and "photo", a phrase and a second
  hotel word, the count, focus on the control
  tapped, nothing in the panel disabled, and Clear with a word in the box;
  a word typed over a sheet value, the box left and the word removed,
  leaving All, and removed before the box is left, the value back; each
  moment, the return key, `focusout` and `change`; "photoshoot" typed
  through "photo", and "gaming trivia", the sheet's kind kept; and the
  sheet opened straight from typing, the step taken before the panel
  draws; a render while open; a query inside a filter; the CSS jsdom
  cannot show; and a schedule with no tags, where "kids" holds a track it
  lacks and a choice takes it out.
  `tests/unit/axes.test.js`: the four axes in `passesFilters()`. The
  rows of `search.test.js` and `map.test.js` that read the controls on the
  page read them in the panel, and `real-data.test.js` counts the whole con
  on the button, "Show 3,053 events" (`tests/PORT-LEDGER.md`). None of the
  new tests carries a ledger bracket. A mutation pass of 62 mutants over
  the new code - `filters.js`, the axes in `search.js`, `browse.js`,
  `sheet.js`, `dispatch.js` and the CSS - killed all 62 on its last run.
  The first left ten: six got tests; three were the panel's draw and the
  fill that followed it on open saying the same thing, and the draw now
  says it alone; one, a guard on a disabled chip, which no click reaches,
  was dropped. #71's pass, 28 mutants over the changed lines -
  `filters.js`, `dispatch.js`, `search.js` `dropPhrase()`, `sheet.js` and
  `boot.js` - killed 27: one, only a hotel toggling, after a test for it
  was added. The one left, `dropPhrase()` emptying the query when its
  phrase is not found, is reached only by a phrase split by another word
  the query reads first - "photo marriott op" reads as Marriott and Photo
  op, and "photo op" is not in the box as two words side by side - where
  a chip's x already leaves the query as it was (section 14).
  For #77: `tests/unit/facets.test.js`, on a schedule of its own - the
  four in `passesFilters()`, each value and its complement, two, three
  and four together, `isAdult()`'s three halves and what is not 18+, an
  event with no facets and one with no tags, an untagged event that
  states 18 or carries the marker, a row's 18+ asking the same rule, and
  the words: the two that hold the Audience, the four that hold two
  dimensions, the explicit word winning in either order, and the
  dimensions every chip names. `filters.test.js`, whose copy of the
  sample carries a fee, a sign-up, sold out and an audience at counts
  that differ: the group, its place, its label and its markup, each
  select's options, a count only where an option names something an event
  has, each value changing the state and the count with nothing behind
  drawn, every event passing each filter exactly where its row's flags
  say, two, three and four together and beside a hotel and a day, the
  list as the sheet closes, Clear, the badge at thirteen, each chip's
  words, a chip's x and where focus goes; the words - each held value
  shown, a choice over "18+" and over "kids", the Kids Track going with
  the Audience, "kids 18+" and "18+ kids", the step as the box is left
  and as the sheet opens, and no new word; a schedule with no tags, three
  selects and an option at 0; and a schedule where no event has what the
  options name, every option there at 0 and a word's value shown.
  `real-data.test.js`: the four counts on the options, the eight over
  every event, the main button's under each value, each filter against
  the row's flags on every event, and every event's flags as they were
  before the marker was read. `search.test.js`'s 531 asks the one rule
  (`tests/PORT-LEDGER.md`). A mutation pass of 73 mutants over the new
  rules - `data.js` `isAdult()` and the row's 18+, `search.js`
  `passesGettingIn()`, the words and `activeFilters()`, `state.js`, and
  `filters.js`'s group, options, counts and `dropWords()` - killed 72. The
  one left reorders `filters.js` `FILTERS`, whose order nothing reads: the
  chips' order is `inEffect()`'s own, which a test holds.

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
  4. **Muted,** a fold, when anything is muted (#84).
  5. The sticky filter and jump chips, and the sections, as built.
- **The zero state** (W16): for a stranger with nothing starred and
  nothing followed, one curated screen in place of the hint line. Before
  the con it is the first thing the app shows (#62). Its source - a
  hand-curated file the pipeline validates, or a computed list - is the
  Explore PR's design call (Open).
- **Pages,** as built, and also the target of the sheet's track and work
  chips (#64; section 11).
- **Mute** (W5): beside Follow on a page, and one or the other with it:
  muting unfollows, following unmutes. A mute takes the thing out of the
  suggestions and hides nothing. A muted page says so in one line; the
  muted are listed in the grid's fold, each a chip whose x unmutes. Kept
  by id on the device beside the follows (#32), and not synced (#84).
- **With the cast** (W6): the cast group a work's page has (#32, #39),
  also in Search's results - with the Fandom filter set and no word to
  rank by, after the list - and in the Following feed's By interest, the
  last of a followed fandom's block (#85).

Built: Mute, and the cast group in Search and in Following - PR #103,
DECISIONS #84, #85.

**Home of:** W3; W16; W5; W6.

Moves: `explore.js` `renderExploreGrid()`, `renderExplorePage()`,
`followingHTML()`; `follows.js` (mutes); `data.js` `castEvents()`,
`search.js` `browseResults()` and `browse.js` `renderBrowse()` (the cast
group). Tests: `explore.test.js`, `follows.test.js`, `spy.test.js`,
`real-data.test.js`. PR 8.

### The filter box, as built

Changed by PR #103 (#84): a draw also writes the Muted fold above the sticky block, after Because you starred.

PR #100, the first of step 8's, with #66 and #80: Explore's filter box is
built once, which lifts the crew redraw's gate (section 5, as built;
`docs/sync/contract.md`, section 5, as built). No screen looks different.
For you, the zero state, Mute and the cast group are not built.

- **The first draw of the grid** makes the view whole, as every draw
  did: what stands above the sticky block - Following, when anything is
  followed, and Because you starred - the sticky block, which is the
  box, `#exploreQ`, and the jump row, and `#exploreGrid`.
- **Every later draw** (`explore.js` `renderExploreGrid()`) finds the box
  and writes around it: the sections before the sticky block are taken
  out and written again at the view's start, the jump chips are written
  into their row, and the tiles into `#exploreGrid`. The box's value is
  set from `state.explore.q` only where the two differ, so a draw writes
  nothing to a box the reader is typing in. The box keeps its node, and
  with it its focus, its caret and its text, through a pull's redraw, a
  return to the page, and a tap in Explore that draws the page whole -
  the Following heading, By interest and By time, Show more, Already
  happened, an unfollow, a star on a Following row - where an iPhone,
  which does not move focus to a tapped button, leaves the keyboard on
  the box.
- **Nothing is added, removed, moved or wrapped.** The view's children
  are the kinds they were, in the same order, Following first when there
  is one ([1155]), and the jump chips are the sticky block's own child,
  as its rules expect: in the design's trial a wrapper round them made
  `main` 561 px wide at 390. The markup is what one whole draw writes,
  byte for byte, but for the box's `value` attribute, which stays as the
  box was built while its value follows the filter.
- **Typing and Show all** draw the tiles alone, as they did
  (`renderExploreSections()`; [1049], [1083]).
- **A page** replaces the view, the box with it, and the way back builds
  the grid anew, with the text kept. A tile, a Following chip or a
  suggestion tapped while the box has the keyboard takes the focused box
  away with the view, as it did, and focus goes to the page's heading
  (#75).
- **The jump row** is kept with the box, so its sideways scroll stays
  through a draw with nothing to put back, and `syncActiveSection()`
  runs after every draw, as it did.
- **#66.** No new control. The box's focus is kept by keeping the box;
  what else had focus on the grid is still lost at a draw, and on a page
  (ROADMAP, Flags; section 14).
- **The browser run,** this build beside `next`'s at c799393, each a
  built page in Chromium with Barlow loaded, at 375x667, 390x664 and
  402x714, the clock simulated at Saturday 1:05 PM. On `next`, after a
  whole draw and after the Following heading tapped, the box is another
  node, focus is on the body, the caret reads 0-0 and a key typed goes
  nowhere. On this build, after each of a whole draw, By time tapped, a
  star tapped on a Following row and the Following heading tapped, the
  box is the same node with its focus and its caret, 1-2 in "star", and
  the next key typed lands: "sxar". Thirty states at each size - a
  stranger's grid, a filter typed and cleared, Tracks opened with Show
  all, a page, a follow made there and the way back, Following folded
  and open, by time and by interest, Show more, Already happened, a star
  and an unfollow, picks and follows, picks alone, follows alone, the
  grid's reached by a first draw and by a later one - gave markup equal
  to `next`'s in
  twenty-nine and, in the thirtieth, a filter typed and the page then
  drawn whole, equal but for the `value` attribute; and the left, top,
  width and height of every element of the view, 15,513 across the
  thirty, equal to a tenth of a px in all of them. `main` is no wider
  than the screen in any. Scrolled past its place, the sticky block
  stands at 63 px, under the header; the jump row, scrolled 80 px
  sideways, is at 80 after a whole draw. A tap was a `click()` from
  script, which moves no focus, and a key a real one. Seen, in pictures
  of the page: the box reading "sxar" with its ring at 390 and 402 wide,
  the caret after the "x" at 375, and the sticky block under the header
  at 375 and 402; the rest was measured. What an iPhone's keyboard does
  is a phone's to check.
- **The tests.** `tests/page/explore.test.js`: a whole draw and a return
  to the page with text typed and the caret inside it - the same node,
  its focus, its caret, its text; each tap that draws the page whole;
  the value following the filter when something else sets it, and
  written only then; a page and back; the view's children the same
  kinds in the same order, the jump chips the sticky block's own child;
  the markup of seven states beside one whole draw's, byte for byte, and
  the `value` attribute apart; and, against the fake backend, the
  reader's own pick and follow pulled while they type. [817] takes its
  stand-ins off the jump row by hand, since a draw keeps the row; no
  ledger row changes meaning, and the new tests carry no bracket.
  `tests/page/crew-everywhere.test.js` and `crew-screens.test.js`: the
  six tests that stated the gate, restated - the tab drawn again, seen
  by a jump chip or the list's first node replaced, and the box the same
  node with its text, its focus and its caret - and the crews forgotten,
  with no session and at a change of owner, on Explore and on Search. A
  mutation pass of 30 mutants over the two rules - the box rebuilt on
  every draw, the value never put in step, always written or its test
  inverted, each of the three writes left out or misplaced, the jump row
  wrapped, the gate put back for each tab in the pull, in forgetting and
  at a change of owner - is not committed: every mutant of its last run
  failed a test, once the three survivors of the first, the crews
  forgotten gated off Explore or Search, had the tests above.

## 5. Plans

As built: the recon, section 2, Mine; section 8, crews' seam.

- **The crew header,** at the top: the crew's name, its member count, and
  one button for the rest - the invite, shared or renewed; leave; remove a
  member; delete - the creator's actions refused for anyone else as the
  client's courtesy (#56) - and a picker when the reader is in more than
  one crew. A removal meant to hold is followed by a new invite, which the
  header offers (`docs/sync/contract.md`, section 8). Editing one's own
  display name (W28) is in the crew panel's manage step, which the
  header's Manage opens; its `crews.js` action PR 4b.
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

### Plans, as built

PR #77, with #56, #62, #63 and #66: the crew header, the crew panel, the
join step, My day | Crew and the crew's day, and the sync that redraws
them. PR #80, PR 4b, with #56 and #66: W28, the reader's own name in a
crew. PR #85, PR 5b, with #10, #50, #63, #66 and #69: W25, Share a day
(below). With no backend there is none of the crew's: Plans is Mine as
built, Share a day among it, and the 2026 app knows no crews.

- **The header** (`plans.js` `crewHeadHTML()`). In a crew: its name, "1
  person" or "N people", and Manage, which opens the crew panel on the
  crew shown. In more than one: a labelled `<select>` of them in place of
  the name, the oldest first, the one chosen kept in `state.plans.crew`
  and not stored; a crew no longer kept falls back to the oldest
  (`chosenCrew()`). In none: the rung, "Start a crew, or paste an invite
  link.", with Start a crew and Join with a link. Every name is someone's
  own text, and escaped.
- **The crew panel,** `#panel-crew`, a panel of the sheet's (`sheet.js`).
  It is drawn once, the first time it opens; after that its steps are only
  shown and hidden, and a pull's redraw refills its lines and lists around
  the form (`refreshCrewPanel()`, from `render()`), so it never rewrites a
  field the reader types in or moves focus - a member arriving or leaving
  leaves focus on the Remove it was on. The invite link's read-only field
  takes a new link in place. Taller than the screen, the panel scrolls on
  its own, and a drag that starts in it scrolls rather than dismisses.
  Since PR #95 it fades at an edge with more past it (#76; section 7, More
  past an edge, as built): its manage step scrolls from three members at
  375x667, and its create and join steps never do. Since PR #97 it has
  room for a focus ring at its sides; nothing follows it, so it has no
  arrow, and keeps the fade alone (#78; section 7, The sheet's edges, as
  built; section 14).
  - *Create:* Crew name, Your name in the crew, and "Everyone who joins
    this crew sees your name and your starred events, now and later."
  - *Join:* Your name in the crew and "Joining shares your name and your
    starred events with everyone in this crew, now and later." It names
    no crew: the invite carries only `<year>.<token>`, and only members can
    read a crew (Open). A kept `?join=` gives "You've been invited to join
    a crew."; otherwise, or when the kept invite is another year's or none
    at all - said as the step opens - an Invite link field to paste into.
  - *Manage:* the members, the reader first and the rest by the names this
    crew gives them, the reader marked "(you)" and the creator "made the
    crew"; under them, since PR #80, Your name in this crew - a labelled
    field and Save beside it (below); the invite link in a read-only
    field, Copy link, Share link
    where the browser has Web Share, and for the creator New link; Remove
    beside each other member and Delete crew for the creator, Leave crew
    for everyone else - everyone, for a crew whose creator is gone; and
    Start another crew and Join with a link. It stays on one crew: a pull
    that takes that crew away leaves `crews.js`'s `no_crew` words and Done.
  - A name for a new crew or a join starts as the reader's name in the
    oldest crew that has them.
- **A link for a crew already kept** - tapped or pasted - sends nothing and
  shows no form: the invite is taken, that crew chosen, and its manage view
  says "You're already in `<name>`." A list gone stale shows it until the
  pull after boot takes the crew away.
- **Every action** is one request at a time: the panel's buttons are
  disabled while one is out. Create and join mint a user in `crews.js`,
  where #56 put it, and the panel adds no `ensureUser()`. After the request
  the panel waits for a sync run that began after it - `sync.js`
  `syncAfter()`, since a run already out may have read before the action
  landed - then draws the panel and Plans from what the pull kept. Nothing
  is optimistic, and a failure is said inline in `crewMessage()`'s words
  with nothing kept and no run:

  | Action | Said once the pull shows it | Said when the action landed but its pull failed |
  |---|---|---|
  | Create | `<name>` is made. Share the link to bring people in. | `<name>` is made - it will show here once this phone reaches the server. |
  | Join | You're in `<name>`. | You're in `<name>` - it will show here once this phone reaches the server. |
  | New link | New link made - the old one no longer works. | New link made - it will show here once this phone reaches the server; the link is withheld until a pull brings the new one |
  | Remove, after a confirm naming the person | `<person>` is out. They can still join with the current link until you make a new one. - New link beside it | Done - it will show here once this phone reaches the server. |
  | Leave, Delete after a confirm | the panel closes to Plans: the next crew, or the rung | Done - it will show here once this phone reaches the server; the panel closes to Plans once a pull shows the crew gone |
  | Save, your name, since PR #80 | Your name in this crew is now `<name>`. - or, when the pull shows the name as it was: Your name didn't change - try again. - with Save there again | Done - it will show here once this phone reaches the server. |

  A pull that later shows what the action did replaces the second column's
  words with the first's, or closes the panel. A New link's old token stays
  withheld across a close and a reopen until a pull brings the new one. An
  action that lands after its panel was closed, or opened again, changes
  Plans' own state alone - the crew chosen - and never the panel the reader
  has by then. Focus stays in the panel: on the control that sent the
  action while it can still take it, and on the heading once the step has
  moved on - but for Save, after which focus is on the name's field.
- **Your name in this crew** (W28; since PR #80), in the manage step, for
  a reader the crew holds: the field, labelled, filled with the name this
  crew gives them (`myMembership()`) as the step opens on a crew, and
  Save beside it, disabled while the field is empty, or says the name
  kept once trimmed, or a request is out; Enter then sends nothing too. A
  name over 24 characters is refused in the panel in `crewMessage()`'s
  words, before any request. Save is `crews.js` `setMyName()`, the
  reader's own row in this crew alone, so a name changed in one crew
  changes no other. Its words wait for the pull: row-level security
  answers a row it turned away with the same 204 as one it changed
  (`docs/sync/contract.md`, section 8, as built), so success is said only
  once the pull shows the name sent, and the pull showing the name as it
  was says it didn't change. A pull's refresh puts a newly pulled name in
  the field only while the field still says the name it was filled with:
  a name the reader has changed stays as typed, its caret and its focus
  with it. Closed and opened again, the field starts from the name kept.
  For a crew whose kept members do not hold the reader - kept for the user
  before, until a run starts the crews again - there is no field.
- **The invite shared.** Copy link puts the bare link on the clipboard.
  Share link sends one string and no url - `Join "<crew>" on the Dragon Con
  planner: <link>`, the link last - since the join step cannot name the
  crew, and a share sheet's Copy then has nothing to drop; `readInvite()`
  reads the last `join=` in what is pasted, so the whole message is an
  invite. Both are called in the tap itself, which is when a browser
  allows them, and make no request. A share cancelled says nothing; a
  refusal of either selects the link in its field, with words.
- **The kept `?join=`** (section 11): `boot()` reads it before the opening
  tab, which is then Plans in any phase, and `sheet.js` `openKeptJoin()`
  opens the join step at once, before the schedule has loaded, sending
  nothing. A join takes the invite, and so does closing the step unjoined:
  declined, not asked again on a reload. A failure keeps it while the step
  stays open.
- **My day | Crew,** only for a reader in a crew: `state.plansView`, saved
  under `"plansView"` when tapped - "mine" or "crew" - and never on a draw.
  With nothing saved, Crew on a con day and My day otherwise; a saved Crew
  with no crew is My day. My day is Mine as built, and since PR #85 Share a
  day beside Export (below). A tap on Crew starts a
  sync run, as a tap on the Plans tab does (`docs/sync/contract.md`,
  section 5).
- **The crew's day:** day chips, `state.plans.day`, today on a con day and
  the first full day otherwise - `mapDay()`'s rule - and back on the clock
  at a new simulated moment. Then a block a member, in the manage view's
  order, headed by the name this crew gives them and how many picks that
  day, the reader's marked "(you)": their picks that day in start order as
  compact rows, `list: "crew:<user>"`, or "No picks on `<day>`." The
  reader's come from `picks`, a crewmate's from `crews.js`
  `crewmatePicks()`, one person's stars as the pull kept them; the reader's
  own row is `myMembership()`. A removed pick is marked, as in My day
  (#49): the reader's can be unstarred, and a crewmate's carries no star to
  add it, nor does its sheet, so a removed event is never picked anew. A
  pick this copy of the schedule does not hold is left out. A crewmate's
  other rows carry the reader's own star.
- **The redraw** (`docs/sync/contract.md`, section 5, as built). A pull
  whose crews or crewmates' picks would draw differently - members
  compared by id, stars alone - asks for a redraw, and so does forgetting
  the crews at a change of owner or with no session; since PR #100 both
  on any tab (DECISIONS #80), as the reader's own picks and follows do.
  Until then both were asked only while Plans was the tab or the crew
  panel open - since PR #81, while Now, the Map or Plans was the tab, or
  the crew panel or an event's sheet open (sections 2, 6 and 7, as
  built), and since PR #82 a hotel's (section 8, as built) - because
  `render()` rebuilt Explore's grid and its filter box with it, and a
  crewmate's star pulled while the reader typed there took the caret.
  `render()` keeps Search's box, Explore's since PR #100 (section 4, The
  filter box, as built) and an open sheet as they were - an event's
  refills its who's-going line in place, and since PR #93 its star and
  its overlap line with it. On Search and on Explore a crew's change
  draws nothing new.
- **#66.** Every new control has a label, and every new one is 44px tall:
  the header's button and picker, the segment, the day chips, the panel's
  fields and buttons. The sheet's four panels take focus to their heading
  as they open and give it back to what opened them as they close - found
  again, on screen, by its id, or its row, timeline block or map hotel,
  since the redraw has replaced it; a crew panel whose opener the redraw
  took away gives it to the header's picker, Manage or Start a crew - and
  Escape closes the sheet, but for a key an input method is composing
  with (section 7). Plans gives focus back, by id, to its own control that
  had it, through every redraw, a tap's own and a pull's. The segment's
  focus ring is drawn inside it. The controls under 44px that this PR does
  not touch - the chips elsewhere, the Type control, My day's action strip
  and view toggle - stay as they were. Since PR #80 the name's field is
  labelled Your name in this crew, and it and its Save are 44px.
- **The tests.** `tests/page/crew-screens.test.js`: the header in each
  state, create, a join by a kept `?join=` and by a pasted link - the
  whole share message among them - share, copy and renew, remove, leave,
  delete, the policy as the wall behind a stale list, the inline failures,
  one request at a time, a run that began after the action, the landed
  words and their catching up, actions that land after the panel was
  closed or opened again, a crew taken away under the panel, a kept
  invite before the con and beside `#explore=`, the segment and its
  defaults, the crew's day with its members, a removed pick and an unknown
  one, the redraws - since PR #100 off Plans too, Explore drawn again with
  its filter box the same node - a change of owner, the refresh that keeps
  a half-typed name and a focused Remove, focus and Escape for the gear, an
  event, a timeline block, a map hotel and a crewmate's row, and the new
  controls' 44px rules. `crews.test.js`: the two readers and the share
  message read back. A mutation pass over the gates and the redraw is not
  committed: every mutant of its last run failed a test, once a first run's
  survivors had new tests, or - one of them - showed a second way to close
  the panel after a Leave, since removed. Since PR #80, Your name in this
  crew: the field labelled, filled and placed under the members; Save's
  disabled states and Enter on a name unchanged or empty; a name too long
  and a server's failure said inline, with focus on the field; one request
  at a time; the save the pull shows, with its words, the reader's row and
  Plans' crew's day; the other crew's name left as it was; a refusal's 204
  with the name as it was, said so and never as success; a pull that
  failed, then caught up; a half-typed name kept through a pull that
  brings the reader a new name, and an untouched field that takes one; no
  field for a crew whose kept members do not hold the reader; a close and
  a reopen; saves that land after the panel was opened on another crew;
  and the 44px rules. `crews.test.js` pins `setMyName()`
  (`docs/sync/contract.md`, section 8, as built). A mutation pass over the
  action, the field and Save is not committed: every mutant of its last
  run failed a test, once a first run's survivors had new tests or - one
  of them - its line was removed.

### Share a day, as built

PR #85, PR 5b (W25), with #10, #50, #63, #66 and #69: a day of the
reader's picks as a message and a link that needs no backend, so on every
build. It is the app's front door for people outside a crew: the message
makes sense to someone who has never seen the app, and the link shows them
that day at once.

- **The button** (`plans.js` `myDayHTML()`): Share a day beside Export in
  My day's action strip, and Remove all under Export, on two columns.
  Disabled while no pick is on the schedule - neither removed nor
  cancelled. The strip and the view toggle are 44px since it joined them
  (#66).
- **The share panel,** `#panel-share` (`sheet.js` `openShare()`): "Share a
  day"; a chip for each con day that holds such a pick (`shareday.js`
  `shareableDays()`), today's chosen where it holds one, else the next day
  that does, else the first (`defaultShareDay()`); the message exactly as
  it will be sent, in a read-only field labelled Message, its text 1rem -
  16px, since an iPhone zooms the page when a field under that takes
  focus; .9375rem until the fix after PR #85, as every field in the sheet
  was, by its label's size, which `#sheet input, #sheet textarea, #sheet
  select` now overrides - as tall as it
  wraps to up to 40% of the screen and scrolling past that, so Share, Copy
  and Done stay on a 375x667 screen; Share where the browser's Web Share
  takes the text, Copy always; and Done. A chip rewrites the message and
  which chip is pressed, nothing else, so focus stays on it. Share sends
  the message as one text and no url, as the invite's Share link does, and
  Copy puts it on the clipboard; both run in the tap and make no request. A
  share cancelled says nothing; a refusal of either selects the message in
  its field, with words.
- **The message** (`dayMessage()`), with no name in it:

  ```
  My Saturday at Dragon Con:
  1:00 PM  Artemis: Bridge Crew Open Play (Westin)
  2:30 PM  Writing Villains Readers Love to Hate (Hyatt)
  https://.../?day=2026.sat.<token>-<token>
  ```

  A line a pick, in start order by the con day's 5 AM boundary: its start
  (`util.js` `fmtShort()`), its title on one line, and its place as the
  Map's On now line names it (`venues.js` `placeShort()`). Removed and
  cancelled picks are in neither the message nor the link. At most 1,800
  characters, since Discord refuses a message over 2,000: lines go from
  the end and one, "+N more in the link", says how many; the link always
  carries every pick.
- **The link** (#69; `dayLink()`): `?day=<year>.<day>.<token>-...` on the
  page's own address, without the sharer's `?now=` or hash, as
  `inviteLink()` builds an invite.
- **A link opened** (`sheet.js` `takeDayLink()`, `openSharedDay()`).
  `boot()` reads the `?day=` after the invite and takes it out of the
  address, `?now=` and the hash left as they were. A join wins - an invite
  in the address, or one the session kept - and the day is dropped. The
  link is kept in memory alone and, once the schedule has loaded, opens
  `#panel-shared` over whatever tab the phase opens on, with a backend or
  without. No request is made for it and nothing is stored. With no
  schedule loaded nothing opens.
- **The shared day,** `#panel-shared` (`sheet.js` `sharedHTML()`):
  "Saturday, shared with you"; "This list isn't saved: it
  goes when you close it. Star what you want to keep."; where tokens found
  nothing, one line - "2 events in the link aren't on this copy of the
  schedule." - which adds " - the link may have been cut short when it was
  copied" where the last token is shorter than a tail or empty; a link
  ending in "-", with nothing skipped, has "The link may have been cut
  short when it was copied." alone, under what resolved; then the events as
  rows in start order (`list: "shared"`), in a body that takes up to 55% of
  the screen, so three rows fit at 375x667 before it scrolls - measured
  again in Chromium on the row of PR #92: a body 367 px tall, a row 106
  px, 118 with Larger text; the phone check to come. Each row
  carries the reader's own star and works as a row anywhere; one not on
  the link's day carries its day's label; a removed one is marked and
  carries no star (#49), a cancelled one is marked. No "star all". A
  change to the reader's picks - a star here, in an event's sheet or from
  a pull - writes each row's class, its words and its star in place
  (`refreshSharedDay()`, from `render()`), so an overlap flag comes and
  goes at once (#73) and the list's scroll and the focus on a star stay.
  Since PR #95 the list fades at an edge with more rows past it, from four
  rows at 375x667 (#76; section 7, More past an edge, as built); the share
  panel's message, a field that scrolls on its own, does not. Since PR #97
  a small down arrow stands in the gap above Done while the list hides 20
  px or more below, and a row's ring and its star's are whole at the
  list's sides (#78; section 7, The sheet's edges, as built).
- **Refused,** in the same panel, headed "A shared day", with Done: another
  year's link - "That link is a day from Dragon Con 2025, and this planner
  is 2026's, so there's nothing of it to show." - and one that does not
  parse - "That link doesn't hold a day of the schedule. It was probably
  cut short when it was copied - ask for it again, or copy all of it."
- **Back** (#63). An event opened from the shared day closes to it -
  Done, the backdrop, a swipe, Escape - the panel shown again rather than
  drawn again, its list's scroll put back, since a browser drops a hidden
  scroller's place, and focus on the row that opened the event. The shared
  day itself closes to the page, and the list goes with it. The way back
  is taken whenever the shared panel closes or another panel opens - but
  not by an event opened over that event's sheet, another session or an
  overlapped pick, which keeps it since PR #93 (#74), its close returning
  to the list - and a person's name, from that event, closes both. The
  hotel sheet's rows close to the Map, as before.
- **#66.** Focus goes to each panel's heading. The share panel gives it
  back to Share a day; a shared day that a link opened, with no control
  behind it, leaves it to the page. Escape closes each, and from an event
  opened there goes back one step. The chips, the strip and the toggle are
  44px, and the panels' buttons 46. The chips' group is labelled "Day to
  share", and the field "Message", which a screen reader reads whole.
- **The tests.** `tests/unit/shareday.test.js`: a round trip; the link's
  parts, with no `?now=` or hash; a tail shared with another event sent
  whole and read back; a tail matching two, none, or cut short; duplicates;
  an id holding a ".", and #43's leaver, `<source_id>.1`, sent whole
  through `dayLink()`, `parseDayLink()` and `readSharedDay()`; a link
  ending in "-"; an event moved to another day; another year;
  links that do not parse, and junk of any type, with nothing thrown; the
  last `day=` in a pasted message; a thousand picks, and a link past the
  cap; an id a link cannot carry; the days, the default day and the
  message, with its cap; and every id of each year's `events.v2.json`
  link-safe, a rule that allows the leaver's ".". `tests/page/share-day.test.js`: the button and its disabled
  states; the chips and the default day; the message equal to what Share
  and Copy send; removed and cancelled left out; the refusals of Share and
  Copy; focus and Escape; a link opened in each phase, with a backend and
  without, nothing stored and no request; the address cleaned; the stars;
  the skipped line and its cut-short words; a removed, a cancelled and
  another day's row; the refusals; a join winning, from the address and
  from the session; no schedule; the event and back, with its scroll and
  focus, Escape, a star in the event's sheet, a person's name; the way
  back taken by a close and by another panel, and kept by an event opened
  over that event, since PR #93; and the 44px rules. `plans.test.js`
  [433] and [510] count the strip's third action, the port ledger amended
  for them. None of the new tests carries a ledger bracket. A mutation
  pass over the new code is not committed: every mutant of its last run
  failed a test, once a first run's survivors had new tests - the share
  panel asked for with nothing to share, an id shorter than a tail - or,
  three of them, showed two ways of taking the way back where one does,
  since made one.

## 6. Map, and the building view

As built: the recon, section 2, Map; section 5, the map card.

- **As built, less the card's leave-by** (#40): the card keeps "3:00 PM ·
  in 47 min" and the walk estimate.
- **Crewmates counted per hotel:** a second count beside the gold pick
  pill - the crewmates with a pick at the hotel that day, people, not
  picks - not gold: gold is the reader's own. "Presence" stays #10's
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

### Map, as built

PR #81, step 5a, with #62 and #66: the crew's count. PR #94, step 7's
third, with #63, #66 and #75: the focused event. The building view (PR 10)
is still to come.

- **The crew counted per hotel** (`map.js` `mapCrewCounts()`). On a build
  with a backend, for a reader in a crew: at each hotel, how many
  crewmates - from every crew the reader is in, each once - have a pick
  there on the Map's day. People, not picks: two of one crewmate's picks at
  a hotel count one. Streams and offsite picks are on no hotel; a removed
  event, or one this copy of the schedule does not hold, is no one's; a
  cancelled one counts, as in the gold pill. None at zero.
- **Its pill** (`mapCrewSVG()`). An outline, not gold: the light text on the
  darkest fill, `--text` on `--ink`, with a person before the number, 32
  wide, or 40 from ten up. On the block's bottom-right corner, under the
  gold pill's top-right, ending 9 past the corner as a one-digit gold pill
  does, which keeps it off the Marriott beside the Hyatt. The park, 24 tall,
  too short for two pills and its name between them, has it hanging under
  its corner instead. Every hotel's stays inside the frame - the Hilton's
  ends at 376, the frame at 382 - so it needs no pulling in. A tap on it
  opens the hotel's sheet, as a tap on the gold one does - since PR #82 with
  Your crew's picks here brought to the top of the sheet's body, the crew's
  picks listed under the reader's own and headed by the pill's number
  (section 8, as built). The pill is hidden from screen readers: the hotel's
  label says it (below), and a bare number beside that would say nothing.
- **The hotel's label** adds the count: "Hyatt: 2 picks on Saturday, 3 of
  your crew", "Westin: no picks on Saturday, 1 of your crew". A hotel with
  none of the crew says nothing of it.
- **The redraw.** A pull's change draws the Map at once (section 5, as
  built, the redraw), and `mapSignature()` takes the crew's counts beside
  the reader's, so the minute tick draws it again when one has changed.
- **#66.** The number reads at 14.8:1 on its fill, and the outline at 8.1:1
  or more against every block's fill and 12.7:1 against the ground. The
  app has one theme, dark - `color-scheme: dark` and one `:root` - so there
  is no second to check. Larger text leaves it alone, as it leaves the map:
  its number is in the drawing's units, 11 px, and `style.test.js` [1726]'s
  list of the map's text gains it. The Map gives focus back to the control
  that had it - a hotel, a day's chip, the card, the On now line - each
  time it draws. The card and the On now line are kept by their places,
  `#mapNext` and `#mapOnNow`, whatever event they show; and the card's
  refresh at the minute writes the new words into the card in place
  (`scroll.js` `drawInPlace()`), so a card with focus keeps it and is not
  read out again, and a minute that changed nothing on it changes nothing.
- **The tests.** `tests/page/crew-everywhere.test.js`: people, not picks;
  none at zero, off the map, out of a crew or on a build with no backend;
  another day's chip; the place on the block and under the park; the
  label; the tap; the signature at the tick; ten of the crew at the Hilton;
  focus kept through a crew's pull and the minute's tick; the contrast,
  computed from the tokens. None carries a ledger bracket.

The focused event, PR #94:

- **The focus** (`map.js` `showOnMap()`, `mapFocus()`; `state.map.focus`).
  One event's id, in memory alone: the event whose sheet's place line sent
  the reader here (section 7, as built). `showOnMap()` sets the focus and
  the tab and nothing else, draws, brings the page to its top and puts
  keyboard focus on the card. It does nothing for an event `onTheMap()`
  refuses: one off the Map's seven places, a cancelled one, a removed one.
- **Its day.** `mapDay()` answers the focused event's con day while a focus
  is set; then the day a chip chose; then the clock's, as before.
  `state.map.day` is not written, so when the focus ends the Map is on the
  day it had - the clock's, where no chip had been tapped. The pills, the
  crew's counts, the off-map line and a hotel's sheet are the day's the Map
  shows; the gold rings are today's, and show only where that is today.
  Every event of 2026 has a con day among the Map's day chips.
- **Its ring** (`mapFocusSVG()`; `.map-focus`). On the event's hotel, in a
  class of its own: `--text`, 2 wide, no fill, no pulse, 11 out from the
  block - the now ring is at 4 and the next ring at 7, its pulse reaching
  9 - drawn after the gold rings and before the pills. 11 is the largest
  that stays inside the frame on all seven, with 1 to spare above the park
  and under the Courtland. Between the Hyatt and the Marriott, 10 apart, it
  is 2 over the neighbour's block. Decorative, as the other rings are.
- **Its card** (`focusCardHTML()`). `#mapNext` itself, in the next pick's
  place: "You were looking at", in `.nc-label`; the title; the place and,
  after a middle dot, the level's short name, as a row says them; the con
  day's name and the time as a range, so a session after midnight is
  "Saturday 12:30–1:30 AM". A long place wraps. No minutes and no walk: it
  is not a pick. The On now line above it stays. It is drawn before the
  `conEnded()` exit, so it shows after the con, alone, where the Map has no
  card, and before it, where the next pick's card or the line on how to
  get one would stand. Its tap is the card's: the event's sheet.
- **How it ends.** `shell.js` `render()`: a tab that is not the Map ends
  it, one line for every road there is - the tab bar, an Explore page, the
  hotel sheet's search, a hash. A day chip's tap (`dispatch.js`), which
  writes the day. `setTimeOverride()`. And `mapFocus()` itself, where
  `byId` lacks the event or holds it as removed - which no page reaches
  today, since a new schedule comes by a reload, and a reload loses the
  focus. It is kept through a sheet opened and closed, the event's or a
  hotel's, a star, a pull's redraw and the minute's tick.
- **The signatures.** `mapSignature()` carries the focus's id, so a focus
  set or ended is drawn at the tick; a focused card's signature holds no
  minutes and no walk, so a minute changes nothing on it.
- **#66.** Keyboard focus lands on the card as the Map opens, and the card
  keeps it through a redraw by its id, as before. The hotel's label is
  unchanged: the card says what is focused. The ring reads at 12.7:1 on the
  ground and 8.1:1 or more on every block. No new motion; Larger text
  leaves the ring alone.
- **Measured** in desktop Chromium, the app's pane, on the built page with
  2026's schedule, Barlow Semi Condensed loaded, and the page confirmed to
  be this build; at 375x667, 390x664 and 402x714, Larger text off and on;
  the phone check to come. With an On now line above the card and the
  off-map line under it, the focused card is whole in view with the page
  at its top in every case: "Tai Chi with Erin Gray", 133.5 px, 148 with
  Larger text; and the tallest of 2026, a two-line title over a place that
  wraps, 151.7 and 168.9. The map gives the room, down to 201.3 px of its
  200 at 390x664 with Larger text. With a notice above the views the tab
  is taller than the screen by the notice, as it was (section 14): at
  375x667 the card is cut by 31.8 px before the con, as the next pick's
  card is there, and by 81.8 after it until the notice's OK, then by
  nothing.
- **The tests.** `tests/page/map.test.js`, the Map's focus: set as the
  sheet's place sets it, the day shown and none written; the ring, its
  place among the others, all three on one hotel, inside the frame on each
  of the seven, its rule and its contrast; the card's words, the On now
  line, the Mart, a session after midnight, its tap and the close after
  it; kept through a hotel's sheet, a star and quiet minutes; each way it
  ends, and the day the Map is then on; after the con and before it; and
  the schedule losing the event. None carries a ledger bracket. A mutation
  pass of 82 mutants over this pull request's new rules - the sessions,
  the place as words, the focus and its ends, the ring, the card, the
  signatures, the taps, the chips, focus, the grid's scroll and the CSS -
  killed all 82.

## 7. The event sheet

As built: the recon, section 3, the event panel.

As built, plus:

- **The place line** is tappable: the Map on that hotel, focused (section
  6). Built by PR #94 (#75), for an event the Map can show.
- **The level and "how to get there"** (W18) under the place line, from
  the venues file, as the data lands (section 13).
- **"Known for"** (W42): a guest's reviewed line under each person, and
  under the name on that person's Explore page, joined by id from the
  file's `people` block (#61), which `data.js` reads since PR #93 and
  which is `[]` in 2026's file until the review lands.
- **The chips** - each track and each work - are tappable: their Explore
  page. Built by PR #94 (#75): each track, and each work a person has
  reviewed; an unreviewed work's chip stays plain (#34).
- **Facets** (W7) in words - the row's words, since #74.
- **Who's going** (W22): a line, from `crews.js` `goingTo()`, for a reader
  in a crew, saying who starred the event - "Starred by" since PR #83, never
  that anyone is going (#68); in 2027 it taps nowhere.
- **The overlap** (W1): at the moment of starring, a line that lists
  every pick it overlaps, each with its times; a line, not a toast. The
  row's flag is section 10's. Amended by #74: the line shows before the
  star too, as "Would overlap".
- **Add to calendar** with W44's alarm, a fixed lead before the start - the
  same `ics.js` as Plans' Export, so both doors carry it. W44 is a
  standalone pull request in a free execution slot (#57), outside the
  sequence.
- **Focus and Escape** (#66): focus into the sheet on open and back to what
  opened it on close, and Escape closes it, for every panel. Built early,
  with the crew panel, by PR #77 (section 5, as built).

**Home of:** W18; W22; W42; W44.

Moves: `sheet.js` `eventSheetHTML()` - `eventsheet.js`'s since PR #93 -
`openSheet()`, `closeSheet()`;
`dispatch.js` `onEventPanelClick()`; `data.js` (the people block);
`explore.js` `renderExplorePage()` (the line); `ics.js`.
Tests: `sheet.test.js`, `explore.test.js`'s "the detail sheet offers a way
through to a person", `ics.test.js`. PRs 5 (who's going) and 7; W44
standalone.

### The event sheet, as built

PR #81, step 5a, with #62, #64 and #66: who's going, worded as who starred
it by PR #83, step 5d, with #68. Focus and Escape were built by PR #77
(section 5, as built). PR #93, step 7's second, with #66 and #74: the
panel's three parts, the level, the facts, the other sessions, the people
and the overlap line, its height, and the star written in place. PR #94,
step 7's third, with #63, #66 and #75: the place and the chips as taps
(section 11), focus after a tap that leaves the sheet, and the other
sessions still to come alone. PR #95, step 7's fourth, with #66 and #76: a
fade where the body has more past an edge, as five more areas of the
sheet have (More past an edge, as built, below). PR #97, a follow-up to
it, with #66 and #78: an arrow above the foot where the body has more
below, and room for a focus ring at the sides of the body and of the
panel (The sheet's edges, as built, below). Still to come: W44's.

- **Three parts** (`eventsheet.js` `eventSheetHTML()`, the panel's own
  module since PR #93; the panel's element and `openSheet()` are
  `sheet.js`'s, and its clicks `dispatch.js` `onEventPanelClick()`'s).
  `.ev-head`, which never scrolls: the title, when, the place, the level,
  Cancelled or Removed from the schedule, the facts, the other sessions,
  Starred by. `.ev-body`, which scrolls: the description, the people, the
  track and work chips. `.ev-foot`, which never scrolls: the overlap line,
  then the star, Add this to calendar and Done.
- **The level** (`venues.js` `levelName()`): the level's full `name`, in the
  hotel's hue, on a line of its own under the place - "Atlanta Conference
  Center (LL3)", where a row says "Conference Center" - exactly where
  `levelShort()` says one (section 10, as built), so the sheet never says a
  level its room has said. On 2026's schedule 1,634 events show one, and
  for 565 of them it says more than the row's short name. There is no
  one-line "how to get there": no data for it exists (section 13).
- **The facts** (`.ev-facts`), one line that may wrap, a middle dot before
  each part but the first: Celebrity, the pill; the row's flags, `data.js`
  `flagsOf()`, in the row's words and the row's order, Sold out alone in
  the warning colour; then `factsOf()` - "Part `<n>`", from `facets.part`,
  and a game's format, from `tags.play`: "One-shot game", "Organized play",
  "Learn to play", "Tournament", "Demo" or "Open play", with ", beginners
  welcome" where its level is beginner, but for Learn to play, which says
  so itself; level any says nothing. The age is on this line, in the row's
  colour, and the body's 18+ chip is gone. No line with nothing to say. On
  2026's schedule 16 events say a part, 868 a format, and 172 of those
  beginners welcome.
- **The other sessions** (`data.js` `sessionsOf()`): "Also runs Fri 4:00 PM
  · Sun 2:30 PM". An event's other sessions are the events with the same
  `facets.repeat_key`, the same title and the same people, by id - whatever
  their order - that are neither removed nor cancelled: "Author Signing"
  is eight sessions of eight line-ups, and they are not each other's. A
  cancelled or a removed event's own sheet lists its live sessions still
  to come. Each is said by its con day's label and its start, so a session
  after midnight takes the night it belongs to, as a row does. Only those
  not yet started are listed, in start order, since PR #94 (#75) - until
  then they came first, and the rest after them - by `now()` (#12), read
  as the panel is drawn and not again while it is open: the sheet does not
  tick. One starting at that very moment has started. Three are named,
  each a button, then "and `<n>` more" of those left, in plain words. No
  line with none left: after the con no sheet has one. In 2026, counted
  before the con: 347 groups of two or more, 1,173 events with another
  session, the largest group 44, and 46 groups with more than three
  others; 6 groups run in more than one room, which the line does not say.
  The sheets with the line, and those of them with more than three: 1,173
  and 351 before the con, 987 and 151 at Saturday 1:05 PM, none after it.
  Neither of 2026's two cancelled events has another session.
- **The people**, under a small "With", a list the label names. Each is as
  the listing spells them; a name is a button to that person's Explore page
  (`data-explore`), and "See all" is gone. A role other than Speaker or
  Panelist follows the name in lower case, muted, with no parentheses. A
  person with a known-for line - `data.js` `knownFor()`, the file's
  `people` block joined by id, an absent or empty block being no lines
  (#61) - is a block, the name and under it the line, and they come first,
  in the listing's order; everyone else is one wrapping line after them,
  their names after commas, opening "and" where lined people stand above.
  The same line stands under the name on a person's Explore page
  (`explore.js` `renderExplorePage()`, `.eh-known`), and on no other kind
  of page. 2026's block is empty, so no one has a line yet.
- **The overlap line** (W1; `#sheetOverlap`; `walk.js` `clashesOf()`), in
  the foot. `clashesOf()` is `overlapsOf()`'s loop, asked whether the
  event is a pick or not - the same pairs put to `connection()` in the same
  order, so an overlap is still computed in one place - and `overlapsOf()`
  asks it for a pick alone, the row's flag unchanged. On a pick, "Overlaps
  `<title>`" and under it its time as a range; a second and a third pick
  take a block each, "and `<title>`"; three at most, then "and `<n>` more"
  in plain words; in the warning colour. On an event that is not a pick,
  "Would overlap `<title>`", in the same shape, quietly. A block is one
  button, its first line cut with an ellipsis and never wrapped. A
  cancelled or removed event has no line and counts in none. The element
  is always in the panel, empty and unseen with no overlap, and is a polite
  live region (`role="status"`).
- **Who's going** (W22; `eventsheet.js` `goingText()`). On a build with a
  backend, a line in the sheet's head, the last of it:
  "Starred by " - "Going: " until PR #83: a star is a pick, not a
  whereabouts (#68) - and the crewmates whose picks hold the event, from
  every crew the reader is in, by `crews.js` `goingTo()` - a person once, by
  the oldest crew's name, never the reader, whose star says so - in its
  order, by name. Three names, then how many more: "Starred by Bo", "Starred
  by Bo, Cy", "Starred by Bo, Cy, Dee", "Starred by Bo, Cy, Dee and 2 more",
  with no comma before "and". With no one, the line is there, empty and
  hidden. Never on a removed event, which is not happening; a cancelled one
  has its line. Every name is someone's own text, and escaped. In 2027 it
  taps nowhere.
- **In place** (`eventsheet.js` `refreshEventSheet()`, from `render()` beside
  `refreshCrewPanel()`, and from the star's own tap). Three parts are
  written into the nodes already there: Starred by, its words and whether
  it shows; the star, pressed and named anew; and the overlap line, "Would
  overlap" becoming "Overlaps" at the tap. The panel is never drawn again
  for any of them - it is drawn once, as it opens - so focus stays on the
  star, the body keeps its scroll, and a screen reader hears the line
  change. A pull that changes the reader's own pick of the open event fills
  the same three, so its star is no longer stale (ROADMAP, Flags). Focus on
  an overlapped pick that is still listed stays on it, by its id; on one
  that has gone, or on a removed pick's star once it is unstarred and can
  no longer be tapped, it goes to the heading. Until PR #93 the star's tap
  drew the whole panel again, and a pull refilled Starred by alone.
- **A sheet from a sheet.** A session or an overlapped pick opens that
  event's sheet in this one's place, focus on its heading. `opener` is
  kept, so Done, the backdrop, a swipe and Escape close to the screen
  underneath, with focus on what opened the first sheet. An event opened
  over a shared day's event keeps the way back to the list (`sheet.js`
  `openSheet()`): its close returns to the list, focus on the row that
  opened the first event (section 5, Share a day, as built). There is no
  way back to the first event (section 14).
- **The place, a tap to the Map** (PR #94, #75; `#sheetPlace`). Where the
  Map can show the event - `map.js` `onTheMap()`: at one of its seven
  places, neither cancelled nor removed, which `sheet.js` tells the panel
  as it draws it, a boolean that is false untold, since `eventsheet.js`
  stands below the Map - the place line is one button: its words as
  before, `placeHTML()`'s, underlined, in the hotel's hue, named
  "`<place>`, show on the map" by `venues.js` `placeText()`, the same
  place as words. A stream, an offsite event, one with no known place, a
  cancelled and a removed event keep the line exactly as it was. The level
  stays under it, outside the tap. The tap (`dispatch.js`
  `onEventPanelClick()`) closes the whole sheet, a shared day under it
  too, then calls `showOnMap()`: the Map at its top, on the event's con
  day, its hotel ringed, the event on the card (section 6, as built). The
  close comes first: it draws the tab underneath, which would end a focus
  set before it. The way back is the Map's card, which opens the sheet
  again. On 2026's schedule 3,372 sheets have the tap - the 3,374 events at
  the seven places, less the two cancelled - and 87 do not: 62 streams, 23
  offsite, 2 cancelled. Four of the 3,372 name no room, and the tap is
  "Hyatt" or "Westin" alone.
- **Its target** (`styles.css`, `.ev-place`). 44 px tall, and the head does
  not grow: the button takes 16 px of padding above and 6 px below and
  gives both back as negative margins. Above, its box covers the gap and
  the lower 10 px of the when line, which is never a tap; below, 6 px is
  the head's own gap, so the box ends exactly where the next line starts
  and never reaches a session's tap. At least 44 px wide.
- **The chips, taps to Explore** (PR #94, #75; `eventsheet.js` `chipsOf()`).
  The event's tracks, then the works it names itself, as before. Each
  track's chip, and each work's that a person has reviewed, is a button
  (`.tag-tap`, `data-explore`) around the chip's own look, to its Explore
  page - `track:<name>` or `work:<id>` - the whole sheet closing, as a
  person's name does. Every such chip's name says its kind too, by
  Explore's own noun in lower case (`follows.js` `KIND_NOUN`, which
  Explore's pages read): "Star Wars, track", "Star Wars, fandom". An
  unreviewed work's chip is no tap and does not look like one: a span, no
  fill, its words muted, the border as it is. Whether a chip is a tap is
  `follows.js` `canFollow()`, the rule a `#explore=` link is read by, so no
  tap writes an address the app would refuse (#34). In 2026: 5,182 chips on
  3,458 events - 3,483 track chips over 54 tracks, all taps, and 1,699
  work chips over 540 works, 1,455 of them taps and 244 plain, 64
  unreviewed works on 239 events. Every tap opens a page with at least one
  event; 304 of those pages hold one, the event the reader came from. 40
  events draw two chips with the same words (section 14).
- **Focus after a tap that leaves the sheet** (PR #94; #66). The Map's
  card after the place. The Explore page's heading, `.eh-name`, after a
  name or a chip: `explore.js` `openExplorePage()` puts it there once the
  page is drawn, with the page at its top - on arrival, never in the
  page's draw, which Follow and the folds ask for again - so a tile's, a
  Following chip's and a Because-you-starred tile's taps land there too.
  The heading takes `tabindex="-1"`, and shows its ring for a keyboard's
  arrival and not for a tap's. Until PR #94 focus was on nothing: the
  sheet's close gave it back to the row that opened the sheet, and the tab
  change hid the row.
- **The way back from an Explore page** (PR #94). "← Explore" lands the
  grid where it last was: `openExplorePage()` takes the grid's scroll only
  where the screen under the tap is the grid itself - a tile, or a sheet
  opened over the grid. From another tab's sheet, or from an Explore page,
  what the grid last held stays - its top, if it was never left. Until
  PR #94 the scroll of whatever tab the sheet stood over was taken as the
  grid's.
- **The height** (`styles.css`, `#panel-event`). The sheet is at most 86%
  of the screen: the panel's cap is `86dvh` less the sheet's own 53px -
  its border, its padding and the gap under the grip - and the inset. The
  panel is a column: the head and the foot keep their height, and the body
  takes what is left and scrolls, never under 4.5rem. Where the head and
  the foot leave it less than that, the panel scrolls as one with its foot
  pinned (`position: sticky`), so the star and Done stay on screen, and a
  drag that starts in a scrolling panel scrolls it rather than dismisses
  (`sheet.js` `onSheetTouchStart()`), as the crew panel's does. The other
  panels keep their rules: `.ev-body`'s 48vh is still the hotel sheet's.
- **#66.** Every new tap is 44 px tall and at least 44 wide: a name and a
  session by the button's `min-height` and `min-width`, so the line they
  stand in is 44 px tall; an overlapped pick as its block. Each is a button
  named by its words, a session's with "Also runs" before them, and the dot
  between two sessions is not read out. Focus is as above. The overlap
  line is a live region. The sizes are in rem; no new motion, no new field.
  The entry points, PR #94: the place's target is 44 px tall by its padding,
  the head not grown, and a chip's 44 px tall and at least 44 wide by the
  button around it, the chip's look as it was. The place is named for
  where it goes, a chip by its words and its kind. Focus lands on what
  each tap opened. An unreviewed work's chip is a span, and no control.
- **Measured** in desktop Chromium, the app's pane, on the built page with
  2026's schedule, Barlow Semi Condensed loaded, and the page confirmed to
  be this build before each pass; the phone check to come. The event with
  the tallest head at 375 px wide, "Contemporary NSDM – National Security
  Decision Making MegaGame" - 208 px, 258 with Larger text - picked, with
  the three longest-titled events that overlap it as picks; "Starred by
  Bo, Cy, Dee and 2 more" written into its line by hand, the build having
  no backend; and the shortest sheet, "Titan Test Event". Each cell is the
  sheet's height, then the body's of what it holds:

  | Size, text | Three overlapped picks and Starred by | Three overlapped picks | One overlapped pick and Starred by | The short event |
  |---|---|---|---|---|
  | 375x667 | 573.6; 72 of 139, the panel scrolling 10 | 573.6; 86.8 of 139 | 562.1; whole | 283.5; 72 |
  | 375x667, Larger | 573.6; 82.8 of 181, scrolling 89 | 573.6; 82.8 of 181, scrolling 60 | 573.6; 91.7 of 180 | 304.6; 82.8 |
  | 390x664 | 571; 72 of 139, scrolling 13 | 571; 84.2 of 139 | 562.1; whole | 283.5; 72 |
  | 390x664, Larger | 571; 82.8 of 181, scrolling 62 | 571; 82.8 of 181, scrolling 33 | 570.7; 119 of 180 | 304.6; 82.8 |
  | 402x714 | 614; 101.7 of 139 | 614; 127.2 of 139 | 562.1; whole | 283.5; 72 |
  | 402x714, Larger | 614; 82.8 of 157, scrolling 19 | 614; 92.7 of 157 | 608; whole | 304.6; 82.8 |

  - Not picked, the same event says "Would overlap" over the same three
    and measures the same. Three overlapped picks are 132 px of the foot,
    146.5 with Larger text, and one is 44 and 48.8; the sessions line is 44
    px. On the design's prototype, the same three as words in a line were
    58.5 and 67.3 px, the sessions line 19.5, and three long titles left to
    wrap 249 and 269.
  - Where the panel scrolls, the foot stays at the panel's foot: at
    375x667 with Larger text, three overlapped picks and Starred by, it is
    in one place with the panel at its top and scrolled its 89 px, the star
    and Done on screen, and the body scrolls its own 98 px inside.
  - The short event's body holds 56 px and stands at the floor, 72. On the
    prototype, 12 to 15 of 2026's events had a body under the floor at the
    three widths, 4 to 6 with Larger text.
  - 15 people, "National Puppet Slam", the one such event: the names are
    five lines, 220 px, in a body of 428 at 375 wide, 523 with Larger
    text; on the prototype the five lines were 264 with Larger text, and
    as words in a line 98 and 135.
  - In every case no part of the panel or the body scrolled sideways, and
    every tap measured at least 44 by 44 px, the narrowest name 54 wide.
  - In the pane: the star's tap kept the head, the body and the region as
    the nodes they were, the body's scroll and the focus on the star; a
    block's tap opened that pick's sheet, which named the first event back;
    a session's tap opened that session; a name's tap closed the sheet on
    that person's Explore page.
  - The entry points, PR #94, on its build, at the three sizes with Larger
    text off and on. The head's height is the same with the place a button
    as with the plain line: 207.8 px, "Tai Chi with Erin Gray", and 130.5,
    "Photoshoot: Horror" and "P&T: Open Paint", each with a session's tap
    directly under the place; 227.8 and 140.8 with Larger text. The place's
    box is 44.8 px tall, 48.2 with Larger text, from 10 px into the when
    line to the foot of the gap under the place; where a session's tap is
    the next line, the box's foot and the tap's top are one line to the
    tenth of a pixel, and a point 1 px inside the tap is the session's. At
    that seam Chromium's hit test can give the last fraction of a pixel of
    the place's box to the session's tap, which is drawn later.
  - A chip's target is 44 px tall, its look 22.9 as before, 25.4 with
    Larger text; a row of chips is 44 px where it was 22.9, and two rows 88
    where they were 51.8 and, with Larger text, 56.9. The line is in the
    body, which scrolls: the panel in the table's first column scrolls as
    it did, by 10, 13 and 0 px and, with Larger text, 89, 62 and 19, and
    the body there holds 160 px where it held 139, 19 more with Larger
    text.
  - In the pane, at each size: the place's tap from an event at each of the
    seven places opened the Map on that event's day, its hotel ringed, the
    event on the card and keyboard focus on the card, the page at its top;
    a stream's, an offsite event's and a cancelled event's place was the
    plain line, and a tap on it did nothing; a track's chip and a work's of
    the same words opened two pages, focus on each one's heading; an
    unreviewed work's chip had no fill, muted words and the chips' border,
    and its tap did nothing; and a Sunday event focused on Saturday showed
    Sunday, and the tab left and opened again showed Saturday.
- **The tests.** `tests/unit/eventsheet.test.js`: the five helpers on made
  events and a made people block, and 2026's counts above.
  `tests/page/eventsheet.test.js`, on a copy of the sample with a made
  Saturday and a block: the parts and their order; the level; the facts,
  the row's flags among them and no 18+ chip; the sessions' words, their
  order, a cancelled one, a tap and the close after it, by Done, the
  backdrop and Escape; the overlap line picked and not, to three and past
  it, its rule the row's, and a tap; the star in place - the region, the
  star and the body the nodes they were, the scroll and the focus kept; a
  redraw's fill, and focus when an overlapped pick goes; the people, lined
  and not, the role, a name's tap; a removed pick unstarred; the drag on a
  scrolling panel; and the rules of `styles.css`, the 53px against the
  sheet's own numbers among them. `tests/page/known-for.test.js`: the line
  on a person's Explore page, and none without a block.
  `tests/page/crew-everywhere.test.js`: who's going - no one, one, three,
  four and six; never the reader; a name escaped; a removed event and a
  cancelled one; the star, written in place since PR #93; the line
  refilled in place with focus kept, and hidden by the last unstar; an open
  sheet over Search and over Explore, Explore drawn again behind it and,
  since PR #100, its filter box the same node with its text and its caret;
  none on a build with no backend; and, since PR #83, that no string
  the crew screens draw - Now, the Map, the hotel and event sheets, Plans'
  crew and the crew panel, their labels among them - says "going" or "with
  you", as whole words since PR #93, the sheet's "With" standing over its
  people. `explore.test.js` [1118] reads the name's button
  (`tests/PORT-LEDGER.md`), `real-data.test.js` the facts line's age for a
  mature event, and `share-day.test.js` the way back kept. The new tests
  carry no ledger bracket. A mutation pass of 85 mutants over the new
  rules - the helpers, the panel's words and order, the fill in place, the
  taps, the way back, the drag, Explore's line and the CSS - killed 84.
  The one left loosens `openSheet()`'s test for an event over an event to
  any event, and changes nothing a reader can reach: the shared day is kept
  only while its panel or its event's is up, so every event that opens
  while there is a shared day to drop opens from one of those two.
  PR #94's: `tests/unit/eventsheet.test.js`, the sessions still to come
  alone, asked before the con and at later moments, and 2026's counts at
  three; `tests/unit/venues.test.js`, a place as words, equal to the
  markup's text for every event of 2026 and of the sample;
  `tests/page/eventsheet.test.js`, on its made Saturday, with an offsite
  event, one with no known place, a hotel with no room named and a work
  nobody has reviewed: the place's button, its name, the level outside it,
  where there is no tap, the tap and the way back, from a sheet over the
  Map and from a sheet opened from a sheet; the chips, their names, the
  plain one, the two pages of one name, and their rules;
  `tests/rules/style.test.js`, the place's target and the head that does
  not grow; `tests/page/explore.test.js`, focus on a page's heading from
  each tap that opens one, and the grid's scroll from the grid, from
  another tab's sheet, from an Explore page and from a sheet over the
  grid; `tests/page/share-day.test.js`, the place and a chip from an event
  opened from a shared day; `tests/real-data.test.js`, 2026's counts of the
  taps, the chips and the twins. None carries a ledger bracket. The
  mutation pass is section 6's.

### More past an edge, as built

PR #95, step 7's fourth, with #66 and #76. Six areas of the sheet scroll
on their own, and where one has more past an edge, that edge fades to
nothing. Its home is here, with the event's body; the screens that own
the other five point at it (sections 3, 5, 8 and 9).

- **The six areas,** by four selectors (`scroll.js` `MORE_AREAS`), each
  measured in desktop Chromium on 2026's schedule at 375x667, 390x664 and
  402x714:

  | Area | Its element | Its height | Scrolls in 2026 |
  |---|---|---|---|
  | An event's body | `#panel-event > .ev-body` | what the head and the foot leave of the panel, never under 4.5rem (above) | 347, 297 and 120 of 3,459 events with no picks; 1,102, 1,038 and 469 with Larger text |
  | The hotel sheet's list | `#panel-hotel .ev-body` | at most 48vh: 320, 319, 343 px | from four picks at a hotel on a day; from three with Larger text at the two shorter screens |
  | The shared day's list | `#sharedBody`, an `.ev-body` | at most 55dvh: 367, 365, 393 px | from four rows; from five at 402x714 at the normal size |
  | The filter sheet's body | `.filters-body` | at most 100dvh less 16rem: 411, 408, 458 px | always: 731 px of groups, 681 at 402 wide |
  | Settings' Advanced | `.advanced-body` | at most 45vh: 300, 299, 321 px | never at the normal size, 231 px, until Walk-time defaults is opened, 741; with Larger text by 10 and 11 px at the two shorter screens |
  | The crew panel | `#panel-crew` | at most 100dvh less 7rem: 555, 552, 602 px | its manage step from three, three and four members, and from two at 390x664 with Larger text; its create and join steps, 367 px, never |

  Not among them: the share panel's message, which is a field; an event's
  panel scrolling as one, whose body has the cue and whose foot is pinned;
  and `main`, where the nav cuts the rows in plain sight.
- **The band** (`styles.css`, one rule, `[data-more]`). A mask on the
  scrolling element itself, a gradient down it: nothing at the edge, whole
  from the band's depth in. What fades is the content and what shows
  through is the sheet; no element is laid over it. A band is as deep as
  what is hidden past its edge, and at most 1.75rem - 28 px, 32.2 with
  Larger text - and a fifth of the area's height:
  `min(1.75rem, 20%, var(--more-above, 0px))`. So a body that hides 6 px
  fades 6 px, which dims nothing a reader could see whole; a body at its
  72 px floor fades 14.4 px at each edge; and the band eases out as a thumb
  nears an end. It does not animate. The property is unprefixed: the floor
  is Safari 16.4, and the build, Lightning CSS at `safari16.4`, adds no
  prefix.
- **The mark** (`scroll.js`). `moreHidden(scrollTop, clientHeight,
  scrollHeight)` gives the px hidden above and below, whole, under 1 px
  none, never under 0 - a bounce past an end is the end - and never over a
  ceiling of 48. `markMore()` writes them onto the element as
  `--more-above` and `--more-below`, each taken off at 0, with `data-more`,
  the hook the rule hangs on - bare until PR #97, since then carrying a
  word (The sheet's edges, as built, below) - while either is above 0;
  only where a value changed, so far from an end a scroll writes nothing
  and within the ceiling of one it writes once a px. An area that fits carries no mask,
  no attribute and no empty `style` left behind; an area in a hidden panel
  measures nothing and loses its mark the same way.
- **Kept by three registrations** in `boot()`, and no call at any draw:

  | What happens | What hears it |
  |---|---|
  | A scroll, a thumb's or a script's - the crew pill's landing, the shared day put back, a focused control scrolled into view | `onMoreScroll()`, a listener on the sheet in the capture phase: a scroll does not bubble |
  | A panel drawn, so an area that is a new node - every event, hotel, shared day and filter sheet, and the hotel's again at a star; a child put into an area or taken out of one at its cap, as a pull puts Your crew's picks here under four rows | `syncMore()`, from a MutationObserver on the sheet's child lists and subtree - never attributes or character data, so the mark's own write cannot wake it |
  | A panel shown; Larger text; Advanced or Walk-time defaults opened or closed; the window resized or turned; a star or a pull that changes an event's head or foot; a crew step shown; fonts arriving late; content that grows inside an area whose own box stays as it was | `syncMore()`, from a ResizeObserver on each area and each child of it, handed over once as `syncMore()` meets them (`setMoreObserver()`), where the browser has one |

  The keyboard resizes the visual viewport alone on a current iPhone and
  Android, so an area's three numbers do not change; where a browser
  resizes the layout, the area's box changes and the ResizeObserver hears
  it.
- **The crew pill's landing** (`sheet.js` `showHotelCrew()`; section 8).
  Your crew's picks here stops short of the body's top by the deepest the
  top band can be, the cap, which `scroll.js` `moreCap()` reads from the
  body's own computed scroll padding - the px and the share of the body's
  height its `min()` names - so the numbers stay the stylesheet's.
- **A drag in Advanced** (`sheet.js` `onSheetTouchStart()`) scrolls it and
  leaves the sheet where it is, as a drag in an event's body or the
  filters' does: until PR #95 a thumb there scrolled Advanced and dragged
  the sheet at once.
- **#66.** No control is added, and the mask moves no box: every tap
  target keeps its size and its place, a control inside a band among them.
  Each of the six areas has the cap as its scroll padding, always, not by
  the mark - `scroll-padding-block: min(1.75rem, 20%)` - so a control that
  takes focus is scrolled clear of both bands. `data-more` is no ARIA
  attribute and the mask is paint alone: nothing a screen reader hears
  changes. Nothing moves, so reduced motion needs no rule. The cap is in
  rem, so Larger text scales it.
- **Measured** in desktop Chromium, the app's pane, on the built page with
  2026's schedule and Barlow Semi Condensed loaded, the page confirmed to
  be this build first; the phone check to come. The pane was hidden, so a
  scroll event reached the page only when a frame was forced: at 375x667
  at the normal size each area was scrolled and the page's own listener
  marked it, and at the other sizes the scroll event was dispatched by
  hand.
  - At 375x667, 390x664 and 402x714, Larger text off and on, each of the
    six at its top, its middle and its end said what its three numbers
    give - Friday's "National Puppet Slam", 261 px of 449 at 375x667: 0
    above and the ceiling's 48 below, 48 and 48, 48 and 0 - and each as it
    opened, with no scroll; content that fits - "Titan Test Event", a
    shared day of two rows, Advanced at the normal size, the crew's create
    step - carried no mark, no attribute and no mask.
  - A body that hides under 28 px: "Football Hooligans Presents: Learn to
    Chant Like a Football Hooligan!" hides 6 px at 375x667, and its band is
    6 px - its last chip whole and undimmed, as before PR #95. Advanced
    with Larger text hides 10 px, and its band is 10.
  - The event's body at its floor, "Contemporary NSDM", picked with three
    overlapped picks and Starred by written in by hand, as above: 72 px of
    160 at 375x667 and 390x664, the cap 14.4 px, so the middle keeps 43.2
    px clear; 82.8 of 199 with Larger text, the cap 16.6 and 49.8 clear;
    at 402x714, 101.7 of 160, the cap 20.4, and 82.8 of 176 with Larger
    text. The panel scrolls as it did, by 10, 13 and 0 px, and 89, 62 and
    19 with Larger text. The one control in that body, its last chip,
    stands at its end, where there is no band.
  - Focus: the filter sheet's 33 controls and the crew panel's 13, each
    focused in turn forward and then backward: none inside a band, at any
    of the three sizes, at either text size.
  - The crew pill, on a build with a backend and a kept crew of six, six
    picks of the reader's own at the Marriott: at 375x667 the section 28.1
    px below the body's top and its heading's words from 34.1, the top
    band 28 deep; 32.3, 39 and 32.2 with Larger text; within a third of a
    px of those at the other two sizes.
  - The refresh: a star in the hotel's sheet drew a new body, marked as it
    arrived; a filter chosen left the body's mark right; Advanced opened
    carried none, and Walk-time defaults opened marked it, 300 px of 741;
    Larger text switched with Settings open and Advanced at its end, 741
    px grown to 877 in an area still 300, added the band below; and the
    window resized to 375x520 kept the marks right.
  - A drag from a row of the walk table, by touches made in script: the
    sheet did not move and stayed open; the same drag from the heading
    moved it.
- **The tests.** `tests/unit/scroll.test.js`: `moreHidden()` where
  everything fits, with jsdom's zeros, at the top, the middle and the end,
  at 1 px, at a fraction, past either end and at the ceiling.
  `tests/rules/style.test.js`: one rule masks, on the mark alone; its two
  bands and their three limits; no px in the cap; no prefix; no transition
  or animation on the mark's rule or an area's; the scroll padding on the
  four selectors, which are `scroll.js`'s, each scrolling on its own; and
  the ceiling above the cap with Larger text. `tests/page/more.test.js`,
  with a stand-in for the ResizeObserver jsdom lacks, an area given the
  numbers a phone would give it: each of the six at its top, its middle,
  its end, far from both and fitting; one write where a value changes and
  none where it does not, nor any asked of the element's style; the hook
  on and off once; an inline style of the area's own left where it was; a
  bounce; no mark on an event's panel, the message's field or `main`; a
  panel opened onto an area that hides something, a star's new body, a
  child put in and taken out, a line's words written, and no waking by an
  attribute or a text node's data; the observer handed each area and
  child once, and nothing else; its callback; a hidden panel's area; a
  page with nothing opened yet, the areas in it handed over all the same;
  and a page with no ResizeObserver. `tests/page/crew-everywhere.test.js`:
  the crew pill's landing by the px, by the fifth, by either alone and by
  nothing. `tests/page/settings.test.js`: a drag from Advanced, and one
  from the panel outside it. None carries a ledger bracket, and no test
  that stood before PR #95 changed. A mutation pass of 71 mutants over the
  new rules - the arithmetic, the four selectors, the mark, the listener
  and the two observers, the cap and the crew pill's landing, the drag and
  the stylesheet - killed all 71 on its last run. The first left three,
  and each got a test: a write asked for where nothing changed, which
  jsdom, like a browser, drops by itself; an inline style of an area's own
  taken off with the mark; and the areas already in the page handed to the
  observer by the first draw alone, not as `boot()` registers it.

### The sheet's edges, as built

PR #97, a follow-up to PR #95, with #66 and #78. Two faults at the edges
of the sheet's scrolling areas, found on the next site on 2026-10-03 after
PR #96: the fade says nothing where the fold lands in a gap, and a focus
ring is cut at an area's side. Its home is here, beside the fade's; the
screens that own the other areas point at it (sections 3, 5 and 8).

- **The word** (`scroll.js`). `moreWord()` gives `below` while what
  `moreHidden()` says is hidden below is 20 px or more - `MORE_ARROW`,
  which stands under the ceiling of 48 - and nothing under that.
  `markMore()` writes it as the value of `data-more`, which was bare, only
  when it changes: one write as the threshold is crossed, either way, and
  none either side of it. What is hidden above never says a word: there
  is no arrow for more above. The mask's rule, `[data-more]`, hangs on the
  attribute alone and is as it was.
- **The arrow** (`styles.css`, one rule, the only one that reads the
  word). It is the `::before` of what follows the area in its panel:

  | Area | What follows it | The gap it stands in |
  |---|---|---|
  | An event's body | the foot, `.ev-foot` | 16 px |
  | The hotel sheet's list | its Done row, `.ev-actions` | 16 px |
  | The shared day's list | its Done row, `.ev-actions` | 16 px |
  | The filter sheet's body | `.filters-foot`, Show and Clear | 12 px |
  | Settings' Advanced | nothing: it is the last thing in its `<details>` | none: the fade alone |
  | The crew panel | nothing: it is its own scroller | none: the fade alone |

  Being the following element's, it is outside the area and outside its
  mask, and shows whatever the fold lands on. It is absolute, so out of
  the flow and moving nothing: the two Done rows and the filters' foot are
  `position: relative` for it, and an event's foot is sticky already. It
  has no content and takes no pointer events: no tap, and nothing a screen
  reader meets. Two borders of a square turned 45 degrees, 0.6875rem a
  side and 0.125rem thick - 15.6 px wide and 7.8 tall, 17.9 and 8.9 with
  Larger text - centred on the element and 4 px above it: its point
  stands 1.7 px over the element and its top 9.5, 1.4 and 10.3 with Larger
  text, so in the filters' 12 px gap it is 2.5 px clear of the body, 1.7
  with Larger text, and 4 px more in the others. Its colour is `--muted`,
  6.3:1 on the sheet (#66 asks 3:1 of a graphic). It does not animate.
- **The threshold's census.** Every event's sheet opened in turn in
  desktop Chromium, the app's pane with a phone's viewport, on 2026's
  schedule with no picks and the clock at a simulated Saturday 1:05 PM:

  | Size | Bodies that scroll | Hide under 20 px | Hide 20 px or more | Of those, the band holds no text and no chip |
  |---|---|---|---|---|
  | 375x667 | 374 | 142 | 232 | 5 |
  | 390x664 | 304 | 111 | 193 | 20 |
  | 402x714 | 117 | 17 | 100 | 2 |
  | 375x667, Larger text | 1,125 | 221 | 904 | 25 |
  | 390x664, Larger text | 1,031 | 181 | 850 | 37 |
  | 402x714, Larger text | 506 | 164 | 342 | 8 |

  Every body that hides under 20 px ends in a row of chips, and what it
  hides is the space under its last chip and at most 8 px of the chip
  itself, 10 with Larger text, which the fade dims in plain sight; every
  body that hides 20 px or more hides at least 10 px of a chip, or more
  than a chip. At 375x667 one body hides 20 to 23 px, where 11 hide 16 to
  19 and 14 hide 24 to 27. The last column is the fault in an event's
  body: the fold in a gap, the band empty, and until PR #97 nothing to say
  there was more - "Diversity In DIY Rave Music" at 375x667 hides 41 px
  under a fold in the gap below its people.
- **The ring's room** (`styles.css`, one rule). Five scrollers of the
  sheet take `padding-inline: 4px` and give it back as `margin-inline:
  -4px`: the fade's four selectors and an event's panel, `#panel-event`,
  which scrolls too (above). Each is 8 px wider and its content is where
  it was. The 4 px is the ring's reach: `:focus-visible` is a 2 px outline
  2 px off its control, and that rule is unchanged. No ring is drawn
  inside a control but the two that were, `.plans-seg`'s buttons and
  `.crew-now`. A drag that starts in the 4 px beside an area scrolls it,
  where it dragged the sheet.
- **An event's panel scrolling as one** (above). Its foot is pinned over
  the gap, so there is no gap for the arrow, and it stands over the foot
  of what shows of the body until the panel is at its end, where it is in
  the gap again. In the tallest case of 2026 - "Contemporary NSDM", picked
  with three overlapped picks and Starred by written in by hand - the
  arrow is over the body's last 4.2 px at 375x667 and 6.8 at 390x664, and
  clear at 402x714; with Larger text 9.6, 37.2 and 80.2 px of the body
  show above the foot and the arrow is over the last 10.3 of them, at
  375x667 all of them (section 14).
- **A ring at an area's top or foot** is still cut, where the area's
  first or last thing is a control and the area is at that end: block
  padding would change heights, and #78 left it (section 14). Measured at
  375x667: the hotel's list and the shared day's at both ends, by 3 px at
  the top and 4 at the foot - the first and the last row and their stars;
  an event's body at its foot, its last chip, by just over 3 px; the crew
  panel at both, its heading and Done, by 4 px. Not the filters' body,
  which starts with a label and ends with the toggle, nor Advanced, which
  has 12 px of padding above and ends with the device line. And an event's
  panel, the fifth scroller, at both ends on every sheet: its heading's
  ring at the top, and at the foot the star's, Add this to calendar's and
  Done's, each cut by 4 px - the whole bottom edge of the ring.
- **#66.** The arrow is no control: no label, no target, no tap, and
  nothing a screen reader meets; 6.3:1 on the sheet; nothing moves or
  animates, so reduced motion needs no rule. The room moves no tap target
  and changes no size: every control keeps its place.
- **Measured** in desktop Chromium, the app's pane, on the built page with
  2026's schedule and Barlow Semi Condensed loaded, the page confirmed to
  be this build first, beside `next`'s build at 076f8cc; the phone check
  to come. Seen means a picture of the page was looked at; the rest was
  read by script, a scroll event dispatched by hand after each scroll a
  script made.
  - `next`'s build first: as the filter sheet opens the band holds 10.6
    px of the Type control and 3.4 of the Kind label's box at 375x667;
    13.6 and 0.4 at 390x664; 8.5 and 9.7 at 402x714 with Larger text - a
    label's box starts above its letters - and Kind's first row at
    402x714 at the normal size. Seen at 390x664: no cue above Show, and
    the Fandom select's ring cut at its left.
  - The arrow, at 375x667, 390x664 and 402x714, Larger text off and on:
    on the filter sheet as it opens, gone at its end, gone 19 px short of
    it and back 20 px short; the same walk on an event's body, the shared
    day's list of twenty rows and the hotel's list of seven picks; never
    on Advanced or the crew panel, which said `below` and drew none.
    Twenty events' sheets at each of the six: an arrow wherever the body
    hid 20 px or more and nowhere else, the mask wherever it hid 1 px or
    more - "PFS2 7-02: Shipyard Sabotage" at 375x667 hides 19 px, the fade
    and no arrow; "DDAL FR-DC-CGB-05: Orctoberfest" at 402x714 hides 20,
    both; "Joystick Gamebar Presents: FREE Arcade Games!!! Wednesday 6pm
    to 4am!" fits, neither. Seen: the filter sheet as it opens at 375x667,
    390x664 and 402x714, and at 402x714 with Larger text; at its end at
    375x667, no arrow; the hotel's list and the shared day's at 375x667;
    an event that hides 19 px and one whose fold is in a gap, at 375x667.
  - Nothing moved. For each of the five scrollers, in six states - the
    filter sheet, an event, a hotel of seven picks, a shared day, Advanced
    with Walk-time defaults open, and the crew panel's manage step, its
    markup written in by hand, the build having no backend - at the three
    sizes at both text sizes: every element inside the scroller has the
    left, the right, the top and the height it has on `next`'s build, to a
    hundredth of a px; so have the panel's heading, its foot and the
    sheet; the scroller's own box is 4 px wider at each side; and none
    scrolls sideways - its scroll width is its client width, and a
    scrollLeft set to 50 reads back 0.
  - The ring. On `next` at 375x667 a scroller cut a ring at a side on 20
    of the filter sheet's 39 controls, 10 of an event's 13, 14 of the
    hotel sheet's 16, 12 of the shared day's 14, 3 of Settings' 11 and 13
    of the crew panel's 16; on this build on none, at either text size.
    Seen, focus moved by the Tab key: the ring whole on the Fandom and
    the Track selects at 390x664, on Cost and on the first hotel chip at
    375x667, and on the last hotel chip at 402x714 with Larger text; on
    the event sheet's star and Done at 375x667 whole at both sides and
    cut at the bottom; on the hotel's first row whole at both sides and
    cut at the top.
- **The tests.** `tests/unit/scroll.test.js`: `moreWord()` under the
  threshold, at it and over it, a fraction under it, far from an end,
  with more above alone, and where everything fits.
  `tests/page/more.test.js`: for each of the six areas, the word not said
  at 19 px, written at 20, kept far from both ends, taken away 19 px short
  of the end and back at 20, never said for more above, and gone with the
  mark; the stylesheet's own arrow selectors, less their `::before`,
  finding the element that follows each of the four areas and nothing for
  Advanced or the crew panel; and one write of the hook as the threshold
  is crossed, either way. `tests/rules/style.test.js`: the ring's rule as
  it was; one rule giving the room, to the five scrollers, equal to the
  ring's offset and width together; no other rule setting an inline
  padding or margin on a scroller; no ring drawn inside a control but the
  two; two rules reading the mark, the mask and the arrow; the arrow's
  three selectors; the word and the threshold as `scroll.js` has them,
  under its ceiling; absolute, in an element that is positioned; no
  content and no pointer events; its size in rem and its two borders;
  centred; inside the filters' 12 px gap at both text sizes; its contrast,
  computed from the two tokens; and no animation. None carries a ledger
  bracket, and no test that stood before PR #97 changed. A mutation pass
  of 69 mutants over the new rules - the threshold and the word, the
  write, the room and the ring's own rule, the arrow's selectors and its
  declarations - killed all 69. With the pins on the source's text left
  out, the unit and page tests alone killed 16 of the 17 mutants of the
  threshold and of the arrow's selectors; the one left, any later sibling
  for the next one, changes nothing in the six panels as they stand, and
  the pin holds it.

## 8. The hotel sheet

As built: the recon, section 3, the hotel panel.

As built. Once the building view exists it opens only for a hotel without
level data (#28; section 6).

Since PR #81 the Map's crew count opens it too; since PR #82, step 5c, it
lists the crew's picks at the hotel under the reader's own (below).

### The hotel sheet, as built

PR #82, step 5c, with #62, #63 and #66: Your crew here, worded as picks
by PR #83, step 5d, with #68.

- **Your crew's picks here** (`sheet.js` `hotelSheetHTML()`; `map.js`
  `mapCrewPicks()`; "Your crew here" until PR #83, #68). On a build with a
  backend, for a reader in a crew: under the reader's own rows, in the
  sheet's scrolling body, a section headed "Your crew's picks here", a line
  for each crewmate's pick at the hotel on the Map's day - from every crew
  the reader is in, a person once, by the oldest crew's name, as `goingTo()`
  names them. A crewmate with two picks there has two lines. The lines are
  in the schedule's order, by start and then title, and by name within one
  event, so one event's lines stay together: at 4:00 PM, Bo and Dee at one
  panel come before Cy at the next, though Cy's name comes before Dee's. No
  cap and no "+N more": the body scrolls. A removed event, or one this copy
  of the schedule does not hold, is no one's; a cancelled one keeps its
  line, unmarked, as on Now - W2 (PR 8b) revisits cancellations.
- **The line** is Now's (`ui.js` `crewLineHTML()`, which both draw), but
  for two things:

  | Where | Its first line | Its second |
  |---|---|---|
  | Now | **Bo** · on now, or the start | the title · the place, as the Map's On now line names it |
  | The hotel sheet | **Bo** · 2:30 PM: the start, never "on now" - the sheet does not tick, and the Map's day is often not today | the title · the room - the hotel is the sheet's - or the title alone where there is no room |

  "yours too", in gold, where the pick is the reader's too - "with you"
  until PR #83: the line says what a crewmate starred, never where they are
  (#68). Every name and title is someone's own text, and escaped.
- **The head:** "Saturday · 2 picks · 3 of your crew", "Saturday · no
  picks · 3 of your crew" - people, not picks, by the pill's own count
  (`map.js` `mapCrewCounts()`, the crewmates of `mapCrewPicks()`), so the
  head and the pill cannot disagree. Nothing of the crew at none.
- **With no pick of the reader's here** the sentence is "None of your own
  picks here on Saturday.", above the Search button, which stays; then the
  crew. With none of the crew here the sheet is as it was before PR #82,
  byte for byte.
- **A tap** on a line opens its event's sheet in the hotel's place, as a
  row does (`dispatch.js` `onHotelPanelClick()`), and closing it returns
  to the Map, focus on what opened the hotel sheet: no way back to the
  hotel sheet, as for its rows (section 11).
- **The crew pill's way in** (#63; `sheet.js` `showHotelCrew()`, from
  `dispatch.js` `onMainClick()`). A tap on the Map's crew pill opens the
  sheet with Your crew's picks here brought to the top of its body: with a
  few picks of the reader's own the section starts below the fold - at 375
  px, four put it 409 px down a body 390 px tall; on the row of PR #92, 394
  px down, and 432 with Larger text, measured in Chromium at 375x812, the
  phone check to come. Since PR #95 the section stops short of the body's
  top by the cap of the band that fades there, 28 px and 32.2 with Larger
  text, so its heading stands clear of the fade and the row above it shows
  through (#76; section 7, More past an edge, as built). A tap on the
  block or the
  gold pill opens the sheet at its top, as before, and so does the block's
  keyboard path, Enter or Space; focus goes to the heading whichever opened
  it (#66). A pill left on the Map from crew picks another tab has since
  changed may find no section, and the sheet opens at its top.
- **Its day.** The sheet keeps the day it was drawn for: with no day chip
  tapped the Map's day moves on at 5 AM, and the star's redraw
  (`drawHotelSheet()`) and a pull's refill stay on the day the sheet shows.
- **In place** (`refreshHotelSheet()`, from `render()` beside
  `refreshEventSheet()`). A pull that changes what the open sheet draws of
  the crew writes it in place: the count in the head, the sentence's words,
  and Your crew's picks here - put in or taken out whole, or its lines kept
  by id, as the crew panel keeps its members, a line still there keeping its
  node, written into only when what it says changed and moved only when the
  order did. The body is never replaced, so its scroll stays, and nothing is
  written when nothing changed. The reader's own rows and count stay as
  drawn, so a pull that changes the reader's picks leaves them stale
  (ROADMAP, Flags), while "yours too" follows the reader's picks.
- **More past an edge** (PR #95, #76; section 7, More past an edge, as
  built). The list fades at an edge with more past it: from four picks at
  a hotel on a day, and from three with Larger text at 375x667 and
  390x664. A section a pull puts under four rows changes no box, only what
  is hidden, and the mark follows it. A star's tap draws the panel again
  (`drawHotelSheet()`), so the list goes back to its top, and its new body
  is marked there (section 14).
- **The sheet's edges** (PR #97, #78; section 7, The sheet's edges, as
  built). A small down arrow stands in the gap above Done while the list
  hides 20 px or more below. A row's ring and its star's are whole at the
  list's sides; the first row's is still cut at the list's top and the
  last row's at its foot (section 14).
- **#66.** Each line is a button, 44 px or taller, labelled by what it
  says, its focus ring drawn inside it, as Now's lines have theirs, by one
  rule; since PR #97 the body no longer clips a ring at its sides (#78).
  Its id is the crewmate's and the event's, `crewHere-<user>-<event>`,
  unique on the page - Now's lines, hidden behind the Map, are
  `crewNow-<user>` - so `scroll.js` `focusKey()` finds it by its id, never
  by its event, which the Map's card behind may show too. A line the new
  order moves has focus again; one taken away while it had focus gives it
  to the sheet's heading.
- **The gate.** An open hotel sheet counted, as an open event's did: a
  crew's change pulled while one was open asked for a redraw whatever the
  tab, so PR 7's entry points from other tabs found it ready. Since
  PR #100 there is no gate: a crew's change asks for a redraw on any tab
  (DECISIONS #80; `docs/sync/contract.md`, section 5, as built).
- **The tests.** `tests/page/crew-everywhere.test.js`: the section under the
  reader's rows and under the sentence; a line a pick, two for one crewmate;
  the order, two events at one start with the names interleaved; "yours too";
  the room, and none; never on now; a cancelled pick unmarked; the head at
  none, one and several, and the pill's number for every hotel on every day;
  the crew pill's way in, the gold pill's and the block's, tapped and by its
  keys, with the layout jsdom lacks given to the body and the section, and a
  pill left stale by another tab; a removed and an unknown pick; a name and
  a title escaped; the tap and the close; the ids; a pull adding a line
  above the one with focus, a rename reordering them, a line taken away with
  focus, a pull that changes nothing and the reader's own unstar; the
  sheet open over Explore, since PR #100 Explore drawn again behind it with
  its filter box the same node; the day kept past 5 AM; next's markup,
  byte for byte, with
  no backend, with no crew, and where the crew has none; and Now's lines,
  byte for byte as they were. None carries a ledger bracket.

## 9. The gear

As built: the recon, section 3, Settings.

In order:

1. Settings as built: the crowd factor, the noise default, Larger text,
   Advanced.
2. Keep your plan as built, on a build with a backend.
3. **The notifications toggle** (W34): its slot here; its wiring - the
   subscription and the worker's handler - Delivery's.
4. **About this app** (W32, #59): a row that opens a sheet panel,
   `#panel-about`, whose back returns to Settings. Three parts: what we
   store, about this app, and the links - one to Dragon Con's official
   site and app. **Delete my account** (W45) is on it, and needs a
   server-side delete that does not exist: a `supabase/` migration and RPC,
   sequenced with the gear PR.
5. Done.
6. Remove all picks, last.

Since PR #95 Advanced fades at an edge with more past it, and a drag that
starts in it scrolls it and no longer drags the sheet (#76; section 7,
More past an edge, as built). At the normal size it holds 231 px and never
scrolls until Walk-time defaults is opened, 741 px; with Larger text it
hides 10 px at 375x667 and 11 at 390x664, and its band is as deep.

**Home of:** W32; W34; W45.

Moves: `index.html` (the panel, the toggle's slot), `sheet.js`
`fillSettings()` and `openSheet()`, `supabase/migrations/` and
`supabase/tests/` (W45). Tests: `settings.test.js`, `keep.test.js`,
`sheet.test.js`; pgTAP for the delete. PR 9.

## 10. The row and the gap line

As built: the recon, section 4, the row's thirteen elements and every
caller; section 5, the gap line.

**The row** (#64, as #73 amends it), its title and up to two lines under
it:

| Line | What | From the recon's table |
|---|---|---|
| 1 | The star, the title; Cancelled or Removed from the schedule leading the title's words | the star; the title, its ★ and strike and marks; Cancelled; Removed |
| 2 | The day's label where the caller asks (`showDay`), "2:30–3:30 PM", then hotel · room · level, the level by its `short` (#72) | the day label; the start and "to" end; the place chip |
| 3, only when anything is present | Celebrity; the pick's overlap flag; the caller's context - Now's status, the Following feed's labels by time; W7's facet flags; the track's label or "Gaming", muted, left off on a row with an overlap flag | Celebrity; the status; the follow labels; the track |
| under 3, Search's ranked results only | The two-line snippet: the result's anatomy, why it matched | the snippet |

- **The overlap flag** (W1): a picked row that overlaps another pick
  carries a flag on line 3 wherever the row appears - "Overlaps
  `<title>`" for one clash, "Overlaps `<n>` picks" for more than one; it
  appears at the moment of starring, on a row or in the sheet, and
  persists; an unstarred row carries none. The check runs over every pick,
  not the consecutive pair `gapHTML()` sees, by one helper beside
  `connection()` (as built, below). What an overlap is, is settled (PR
  #76): `walk.js` `connection()`'s, the two picks' intersection, the one
  computation the hero reads - the row words the flag from it and does not
  compute it again.
- **Facets** (W7) are flags on line 3 and words on the sheet (section 7).
- **The gap line** stays: `leave.js` `gapHTML()` - `walk.js` from PR 3 -
  says the walk and the two tight bands between rows, never on a row; the
  overlap it said between rows on Now and Plans the two rows' flags say
  since PR #92 (#73). Plans' timeline keeps its walk links, one band, as
  built.
- **Callers** as the recon lists them, plus Plans' Crew segment,
  `list: "crew:<user>"`.

**Home of:** W1; W7.

Moves: `ui.js` `rowHTML()`, `styles.css`'s row rules, every caller's
options. Tests: the page tests that read a row's parts, and
`style.test.js` [1827]. PR 7.

### The row and the gap line, as built

PR #92, step 7's first (W1, W7, W18), with #64, #66, #72 and #73: the
row's lines, the facet flags, the level and the overlap flag; the gap line
saying no overlap; and two lines of words, the hero's and a crew line's.
The event sheet followed, in PR #93 (section 7, as built).

- **The row** (`ui.js` `rowHTML()`), for all fifteen of its calls, their
  options unchanged:

  | Line | What |
  |---|---|
  | 1 | The title, two lines at most, its ★ before it when picked, struck when cancelled or removed. "Cancelled" or "Removed from the schedule" leads its words, inside the two lines; the strike is the words', the tag and the ★ each an inline-block it does not reach. |
  | 2 | The day's label where `showDay` asks and the time, `util.js` `fmtRange()` - "Sat 2:30–3:30 PM", "11:30 AM–12:30 PM"; then the place, `venues.js` `placeHTML()`, as text in the hotel's hue, no box, and the level, `levelShort()`, each after a middle dot. |
  | 3, only when anything is there | Celebrity; the overlap flag; the caller's context - Now's `.status`, the Following feed's labels; the flags, `data.js` `flagsOf()`; the track, or "Gaming". A middle dot between each two; an empty part is left out, and with none there is no line. |
  | under 3 | Search's ranked results: the snippet, as before; a compact list hides it. |

  The row keeps `li.row`, `data-id`, `data-list`, its classes,
  `button.row-main` and `button.star`, and the class names the tests and
  `now.js` `tickNow()` read: `.room`, `.rh`, `.rr`, `.day`, `.status`,
  `.track`. Under a time head the row says its time all the same. The time
  column is gone, and the gap line's left margin, which cleared it, is the
  row's, 14px.
- **One line each** (`styles.css`). Lines 2 and 3 are each a flex line one
  line tall that wraps, its overflow clipped (`overflow: clip`): a part
  that does not fit wraps onto a line the box does not show, so it drops
  whole, never clipped. Clip, not hidden: a hidden box can be scrolled - by
  `scrollIntoView()`, Find on page or a screen reader - and a scrolled line
  would show the dropped part and hide the rest. On line 2 the time, the
  hotel and the room are one part, which shrinks only when it is alone on
  the line - the room takes the ellipsis, the time and the hotel never
  shorten - and the level with its dot is a second, so it drops before the
  room is cut. On line 3 each part carries its own dot and they drop from
  the end: the track, the flags from last to first, then the context. The
  overlap flag counts as 8em when the line is filled and then takes the
  room left, up to its whole text, so its title shortens first; it and
  Celebrity never drop. A Celebrity row with an overlap can lose Now's
  status: the long one, "On now, ends 2:00 PM", at 375 at the normal text
  size and at 375, 390 and 402 with Larger text; the short one, "In 40
  min", at none (measured below; #73's Cost).
- **The place** (`venues.js` `placeHTML()`). A hotel whose `display` is
  "location", the Mart, is its room alone - "Mart Building 3, Floor 1",
  where every screen said "Mart · Mart Building 3, Floor 1" - on all five
  screens it feeds: the row, the hero, the Map's next card, the event sheet
  and the mini-bar.
- **The level** (`venues.js` `levelShort()`): the level's `short` by the
  event's `level` id (#72); none where the event has no level, and none
  where the room, case-folded, holds the `short` less a trailing " Level"
  or " Floor" - "Atrium Ballroom" is said to be on the Atrium Level,
  "Imperial Ballroom" is not said to be on the Marquis Level. On 2026's
  schedule 1,634 events show a level, 1,542 leave it off and 283 have
  none. The event's sheet shows the level in full, `levelName()`, by the
  same two rules, since PR #93 (section 7, as built).
- **The flags** (`data.js` `flagsOf()`), `{key, label}` in the order a row
  says them: Sold out, alone in the warning colour; Extra fee; Sign-up; an
  age, the listing's minimum, else 18+ for a mature audience; Kids. On
  2026's schedule 460 events carry one or more: 387 one, 66 two, 7 three.
  Since PR #96 the 18+ asks `data.js` `isAdult()` - a mature audience, or
  the listing's Mature Audience marker where the tagger has not answered -
  so a row and the filter sheet's Audience agree; every one of 2026's
  events is flagged as it was (#77; section 3, as built).
  Since PR #93 the event's sheet says the same flags on its facts line,
  the age in the row's colour, and its 18+ chip is gone (section 7, as
  built).
- **The overlap flag** (`walk.js` `overlapsOf()`): every other pick a pick
  overlaps, over the whole plan, each pair asked of `connection()` in start
  order, so the flag and the hero hold one answer; a cancelled or removed
  pick overlaps nothing and counts in no other pick's. "Overlaps
  `<title>`" for one, "Overlaps `<n>` picks" for more, in the warning
  colour, on the row of every pick that clashes, wherever it is drawn -
  Search, Explore, Now, Plans' list, a crewmate's block of the crew's day,
  where the reader stars a crewmate's pick, the hotel sheet and a shared
  day. A star draws every row again, so the flag comes and goes on both
  rows at once; the shared day writes each row's `.row-main` in place as it
  writes its star (`sheet.js` `refreshSharedDay()`), its scroll and the
  focus on a star kept. A flagged row leaves its track off. Over all 3,459
  rows of 2026 the helper takes under a millisecond with 60 picks, and 11
  ms with 250.
- **The gap line** (`walk.js` `gapHTML()`): the walk and the two tight
  bands, and nothing for an overlap. `connection()` and the hero do not
  change.
- **Two lines of words.** The hero names its next pick as `venues.js`
  `placeShort()` names a place - an offsite pick by its room, else
  offsite, never Other (section 2) - and a stream by its title, as before.
  A crew line's start is a span that does not wrap, so "4:00" and "PM" stay
  on one line, on Now's lines and the hotel sheet's alike (`ui.js`
  `crewLineHTML()`); `fmtShort()` does not change.
- **#66.** No new control: a row's two buttons are as they were,
  `.row-main` named by its words, the flag and the level among them. Focus
  is unchanged - `scroll.js` `focusKey()` finds the same selectors - and
  the shared day keeps the focus on a star as it writes the row's words in
  place. The shortest compact row is about 61 px tall from its
  declarations, and the star 56 px wide at the row's full height. The two
  lines' text is in rem and their heights and gaps in em - line 3's height
  with a 19 px floor, the pills' - so Larger text scales them; only the 5
  and 4 px above them stay put. The overlap and Sold out are the warning
  colour the page already uses, and the place the hotel's hue, as the hero
  writes it. A dropped level stays in the row's text, so a screen reader
  reads it.
- **Measured** in desktop Chromium, the app's pane, on the built page with
  2026's schedule; the phone check to come.
  - The level, over the 1,634 rows that show one, with Search's every row
    drawn and the list set to each text width - the list's at 375 is 305
    px, the hotel sheet's and a shared day's 271 - and the day's label
    written "Sat":

    | Text width | Normal | Normal, with the day | Larger | Larger, with the day |
    |---|---|---|---|---|
    | 305, a list at 375 | 1,372 shown | 1,099 | 683 | 290 |
    | 271, the hotel sheet or a shared day at 375 | 824 | 419 | 222 | 89 |
    | 320, a list at 390 | 1,503 | 1,306 | 986 | 530 |
    | 332, a list at 402 | 1,547 | 1,435 | 1,179 | 746 |

    In none of the sixteen did a level show in part, a room take the
    ellipsis while its level showed, or a line scroll.
  - At 375, 390 and 402 wide, Larger text off and on, on Search (Saturday,
    and a query), Plans' list, Now, the Hilton's sheet and a shared day of
    ten: no part of line 2 or line 3 shown in part, no room cut while its
    level showed, no line scrolled.
  - Now's status on a Celebrity row with an overlap, on Now, Barlow Semi
    Condensed loaded, the overlap naming a title and so held to its 8em:

    | Status | Text size | 375, a 305 px line | 390, 320 px | 402, 332 px |
    |---|---|---|---|---|
    | "On now, ends 2:00 PM" | Normal, 125 px | lost | shown | shown |
    | "On now, ends 2:00 PM" | Larger, 144 px | lost | lost | lost |
    | "In 40 min" | Normal, 57 px | shown | shown | shown |
    | "In 40 min" | Larger, 65 px | shown | shown | shown |

    Celebrity is 68 px, 76 with Larger text; the overlap's 8em is 112 and
    129; the gap between two parts is 4 and 5. At 390 the long status fits
    with 6 px to spare, and the widest end time of every five minutes of
    the clock, "10:40 AM", is 5 px wider, so each still fits there. An
    overlap that says a count, "Overlaps 2 picks", is 96 px, under its 8em:
    it keeps the long status at 375 at the normal size and loses it with
    Larger text, which is all this check's first run met, at all three
    widths.
  - A pick's star as an inline-block, its gap a margin: at 375 and 402,
    Larger text off and on, a picked row and a cancelled picked row keep
    their height, the title's place and height and line 2's place, and what
    follows the star moves 0.02 px at most. The strike no longer runs
    through the star; after the tag it begins at the space before the
    title's words, as before.
  - A shared day still fits three rows at 375x667 (section 5), and four of
    the reader's picks put the hotel sheet's crew 394 px down at 375x812,
    432 with Larger text (section 8).
- **The tests.** `tests/unit/row.test.js`: the four helpers, and 2026's
  counts above. `tests/page/row.test.js`: the lines on the sample and on a
  copy of it with the flags, a bare event, a gaming one and a cancelled
  one; the flag at starring on both rows, over every pick, after
  Celebrity, in Plans' list and a crewmate's block, gone on an unstar, and
  never on a row that is not a pick or for a cancelled pick.
  `tests/page/walk.test.js`: the gap line's
  overlap tests read the row's flag and an empty gap line, its pin names
  any overlap as its exception, and the hero's offsite next pick.
  `removed.test.js` holds a removed pick to no flag, `share-day.test.js`
  the shared day's flags in place, `crew-everywhere.test.js`'s pin the
  crew line's span, and `style.test.js` the two lines' rules, line 3's
  parts and the overlap's among them, and the tag's and the star's, which
  the title's strike does not reach. [271], [523], [630] and [671] read the
  day's label on line 2 (`tests/PORT-LEDGER.md`); the new tests carry no
  ledger bracket. A mutation pass of 40 mutants over the new rules - the
  range, the level, the flags, the overlap and its order, the gap line, the
  Mart, the shared day, the hero's name, the crew line and the CSS - killed
  all 40 on its last run. The first run, of 30, left one, Celebrity after
  the overlap, which got a test; seven more are the rules a review found no
  test held - the level's " Floor", the tag's inline-block, line 3's parts
  and the overlap's flex - which got pins; and three are the star's rule.

## 11. Entry points

As built: the recon, section 2, each tab's taps that leave it; section 6,
the hash and the address.

| From | To | State it sets | Back | Since |
|---|---|---|---|---|
| Any row, the hero, the map card and its On now line, a timeline block | The event sheet | `state.sheetId` | Done, the backdrop, a swipe, Escape (#66): the screen as it was | built |
| The gear | The Settings panel | the panel shown | Done, the backdrop, a swipe, Escape | built |
| Settings' About row | `#panel-about` | the panel shown | its back: Settings | PR 9 |
| The mini-bar | Now | `state.tab` | the tab bar | built |
| A Map hotel block or its gold pill, a hotel without level data | The hotel sheet | `state.sheetHotel` | Done, the backdrop, a swipe, Escape: the Map | built |
| The Map's crew pill | The hotel sheet, Your crew's picks here brought to the top of its body (#63) | `state.sheetHotel` | Done, the backdrop, a swipe, Escape: the Map | built, PR #82 |
| A Map hotel block, a hotel with level data | The building view | the Map's drill-down | the view's own back, to the Map | PR 10 |
| The hotel sheet's "Search the Hyatt on Saturday" | Search | `state.browse`: the hotel, the day, no query - since PR #88 the hotel a chip under the box, counted on Filters | the tab bar to the Map, whose day `state.map.day` kept | built |
| A person's name on the event sheet - "See all" beside it until PR #93 | That person's Explore page, keyboard focus on its heading since PR #94 | `state.explore.page`, the hash | "← Explore", to the grid, where it last was since PR #94 - its top, if it was never left: one tap from the event, accepted | built; the name since PR #93 |
| Another session on the event sheet's Also runs line | That session's sheet, in this one's place | `state.sheetId` | Done, the backdrop, a swipe, Escape: the screen underneath, focus on what opened the first sheet - the shared day, where the first was opened from it; no way back to the first event (section 14) | built, PR #93 |
| A pick on the event sheet's overlap line | That pick's sheet, in this one's place | `state.sheetId` | the same | built, PR #93 |
| An Explore tile, a Following chip, a Because-you-starred tile | Its page, keyboard focus on its heading since PR #94 | `state.explore.page`, the hash | "← Explore", the grid's scroll put back | built |
| A `#explore=` link | Its page | the same, at load | "← Explore", to the grid | built |
| The event sheet's track chip, or the chip of a work a person has reviewed | Its Explore page, keyboard focus on its heading | `state.explore.page`, the hash | "← Explore", to the grid, as a person's name | built, PR #94 |
| The event sheet's place line, where the Map can show the event: at one of its seven places, neither cancelled nor removed | The Map at its top, on the event's con day, focused on the event: its hotel ringed, the event on the card, keyboard focus on the card - on the room once the building view exists | `state.tab`, `state.map.focus` | the Map's focused card, which reopens the sheet | built, PR #94 |
| The Map's focused card | The event sheet | `state.sheetId` | Done, the backdrop, a swipe, Escape: the Map, the focus still held, keyboard focus on the card | built, PR #94 |
| Search's Filters | `#panel-filters` | the panel shown | no Apply (#70): Show `<n>` events, the backdrop, a swipe, Escape: Search, focus on Filters, the list from its top if anything changed | built, PR #88 |
| A kept `?join=`, in any phase | Plans' join step | `state.tab`, the step open | the step closed: Plans as it opens | built |
| A line of Now's Your crew's picks right now | The event sheet | `state.sheetId` | Done, the backdrop, a swipe, Escape: Now, focus on that crewmate's line | built, PR #81 |
| Now's Your crew's picks right now, "+N more" | Plans' crew's day, on today | `state.tab`, `state.plansView` saved as Crew, `state.plans.day` back to the clock's | the tab bar to Now | built, PR #81 |
| A line of the hotel sheet's Your crew's picks here | The event sheet, in the hotel's place | `state.sheetId` | Done, the backdrop, a swipe, Escape: the Map, focus on what opened the hotel sheet - no way back to the hotel sheet, as for its rows | built, PR #82 |
| My day's Share a day | The share panel, `#panel-share` | the panel shown, the day chosen | Done, the backdrop, a swipe, Escape: Plans, focus on Share a day | built, PR #85 |
| A `?day=` link, in any phase | The shared day, `#panel-shared`, over the phase's tab, once the schedule has loaded | the day, in memory alone; the address cleaned | Done, the backdrop, a swipe, Escape: the tab as it opened; a reload loses the day | built, PR #85 |
| A row of the shared day | The event sheet | `state.sheetId` | Done, the backdrop, a swipe, Escape: the shared day, its scroll kept and focus on the row; a person's name closes both | built, PR #85 |

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
    included, with `overlap` its minutes, the two picks' intersection -
    the earlier end less the later start, #64's one computation of an
    overlap; and otherwise, where there is a walk, `"cant"` under it or
    `"tight"` under it and `SLACK_MIN`; a pair with no walk, a stream
    either side, has no connection, null;
  - `gapHTML()`, which reads its band from `connection()`: byte for byte
    what it said before, but for two named exceptions - a stream's pair
    within the slack, which said "about 0 min. Tight but doable" and says
    nothing now; and a pick inside the one above, which overlapped by the
    time to the other's end and now overlaps by its own length - and since
    PR #92 nothing for any overlap, which the two rows' flags say (section
    10, as built);
  - `nextPickInConDay()`, unchanged, and `previousPick()`, private.

  `leave.js` and `walk.js` are 24% alike, and their tests 25%, so after
  the squash `git log --follow` crosses the renames with `-M20%`.
- **Plans' timeline** draws no walk link to or from a stream (`plans.js`
  `timelineDayHTML()`): no walk, no band, no link, the stream rule at its
  third site. It drew one reading "0 min".
- **`currentLocation()` is deleted** with its last reader: nothing in the
  app says where the reader is.
- **`SLACK_MIN`** is `venues.js`'s name for the venues file's `slack_min`.
  `ORDER` has `walk` in `leave`'s place.
- **The tests.** `tests/page/walk.test.js` is `leave.test.js`, moved: the
  leave-by formula's and `currentLocation()`'s cases deleted, ledger rows
  125, 126 and 145 to 148; the rest kept, a pick on now's rewritten for
  the new words; the hero in each band, in two buildings and in one,
  against pairs the fixture has at 1:05 PM, and the gap line under it
  giving the pair the same band - since PR #92 but for an overlap, which
  the pair's rows flag; a stream after the pick on and one
  overlapping it; a pick inside the one that is on, overlapping by its own
  length on the hero and, until PR #92, on the gap line; nothing on the
  three surfaces saying leave or marked late; and `gapHTML()` pinned
  against the code it replaced, with its two exceptions - since PR #92,
  any overlap the second, now nothing - over every pair of the fixture's
  events a few hours apart and over made pairs at every gap from a
  40-minute overlap to 40 minutes apart, and a half hour inside four.
  `plans.test.js`: two picks in two hotels keep their walk link, and a
  stream between them leaves no link to or from it. `minibar.test.js`
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
  review lands (#61); the sheet's line, and the Explore page's, built by
  PR #93 (section 7, as built), show only once it has rows.
- **W18:** the levels are in `venues.json` for six hotels - the Marriott,
  the Hyatt, the Hilton, the Westin, the Courtland Grand and the Mart
  (#45; the Westin's as the con names them, and the Courtland Grand's,
  since PR #78) - each with a
  short name and a storey (#72); a row names an event's level by its short
  name since PR #92 (section 10, as built), and the event's sheet by its
  full name since PR #93 (section 7, as built). The one-line "how to get
  there" is not built: the line exists nowhere yet, in no file.
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
- No cast group in Search with a word typed that ranks: a typed word is a
  text search, and whether "firefly" should set the Fandom is search
  tuning's (#36, #85).
- A mute and the fandoms under a fandom: Star Wars muted says nothing of
  Andor. A mute is of one thing, by its id; For you decides (#84).
- Mutes are on the device alone: a new phone, or a recovered plan, starts
  with none (#84).
- A mute made with no session. Its unfollow is recorded nowhere, so where
  another device still follows the thing, the first pull after a sign-in
  brings the follow back and the mute goes: the union rule's, and older
  than Mute (#53, #84).
- ~~Which day Share a day shares, and its link's shape (W25).~~ Settled
  by PR #85, step 5b: the con day the reader chooses, today's first where
  it holds a pick, and #69's link (section 5, Share a day, as built).
- The home-screen iPhone and a shared day. A tapped `?day=` link opens
  Safari, not the app on the home screen: Safari's storage - and, on a
  build with a backend, its anonymous user - is not the app's, so stars
  made there stay in Safari, and the app has no field to paste a day's
  link into, as it has for an invite (W20). `shareday.js` `parseDayLink()`
  reads the last `day=` in pasted text, so such a field needs no new
  parser.
- A token is not resolved through `was` (#43): a pick merged into another
  event after the link was sent is skipped and counted, though the
  reader's own picks would be re-pointed.
- A reload loses a shared day: it is kept in memory alone and the address
  is cleaned as it is read, so the link in the chat is the way back.
- ~~How an offsite pick is named in a line: the hero says "then Other
  next" and "then Other at 3:00 PM", as it did before PR #76, where the
  walk estimate and the map's On now line name its venue - the row PR's
  (PR 7), which settles how a row and a line name a place. Until then,
  since PR #81, Now's crew lines name it as the Map's On now line does,
  its room or else offsite, by one helper, `venues.js` `placeShort()`.~~
  Settled by PR #92, step 7: the hero names its next pick as
  `placeShort()` does - an offsite pick by its room, else offsite - and a
  stream by its title (sections 2 and 10, as built).
- ~~A crew line's time can break in two: after a long name, "4:00" ends one
  line and "PM" starts the next, on Now's lines and the hotel sheet's
  alike - one builder, `ui.js` `crewLineHTML()`, whose start is `util.js`
  `fmtShort()`'s, an ordinary space between the two. Within the
  24-character cap on a name, measured in the hotel sheet at 375 px: 23
  W's, or 24 M's under Larger text. PR 7's, the row and the line, which
  settles how a row and a line say a time.~~ Settled by PR #92, step 7:
  the start is a span that does not wrap, `fmtShort()` unchanged (section
  10, as built).
- A sheet opened from a sheet has no way back to the first event: a
  session or an overlapped pick opens in the sheet's place, and its close
  goes to the screen underneath (#74; section 7, as built).
- A session in another room. The Also runs line says a day and a start,
  and no place: 6 of 2026's 347 groups run in more than one room, which a
  reader learns by the tap (section 7, as built).
- Two chips with the same words. On 40 events of 2026 a track's chip and
  a work's carry one name - "Star Wars" on 35, "Artemis Spaceship Bridge
  Simulator" on 5 - and open two pages, the track's and the fandom's. Their
  accessible names say which; their looks do not (#75; section 7, as
  built). For Explore's design (step 8).
- "← Explore" drops keyboard focus to the page: its button is redrawn
  away, as a tile was before PR #94 put focus on the page's heading. For
  step 11's sweep.
- A redraw of Explore drops keyboard focus from every control but the
  filter box, which PR #100 kept (#80; section 4, The filter box, as
  built): on the grid, the Following heading, a follow's chip and its
  unfollow, "+ Follow more", By interest and By time, a Following row
  and its star, Show more, Already happened, a Because-you-starred tile,
  a jump chip, a tile and Show all; on a page, Follow, the folds, a row
  and its star. For step 11's sweep (ROADMAP, Flags).
- A tile, a Following chip or a suggestion tapped while the filter box
  has the keyboard opens a page, which takes the focused box away with
  the view; focus then goes to the page's heading (#75). Older than
  PR #100, which left it; what an iPhone's keyboard does then is a phone's
  to check.
- A notice above the Map. The Map tab is as tall as the screen less the
  header and the nav, and a notice above the views is not counted: while
  one stands - the preview banner before the con, "has ended" after it
  until its OK - the tab is taller than the screen by the notice, and the
  card under the map is cut at the page's top. It predates PR #94, which
  made it show after the con, where the Map had no card: a focused card is
  cut by 81.8 px at 375x667 until the notice's OK (section 6, as built).
- A star in the hotel's sheet draws its whole panel again, so the list
  jumps back to its top under the thumb that tapped: older than PR #95,
  which left it - the new body is marked afresh, so its fade is right, at
  the top (#76; sections 7 and 8, as built; ROADMAP, Flags).
- Settings is taller than a short screen once Advanced is open. At
  375x667 the sheet is 691 px with Advanced open, its top 24 px above the
  screen; 760 with Walk-time defaults open, and 801 with Larger text, the
  heading and the crowd factor above the screen and out of reach, since
  the sheet itself does not scroll. Older than PR #95, which changed no
  height; the gear's pull request (step 9) is where it goes.
- An event's body at its 72 px floor keeps 43.2 px clear between its two
  bands, 0.8 short of a 44 px tap. In 2026 the one control in such a body
  is its last chip, at the end, where there is no band (#76; section 7,
  More past an edge, as built).
- Advanced and the crew panel with the fade alone. Nothing follows either
  in its panel - Advanced is the last thing in its `<details>`, and the
  crew panel is its own scroller - so neither has the arrow (#78), and
  where the fold lands in a gap there the fade says nothing, as the filter
  sheet's did. At 375x667 Advanced with Walk-time defaults open hides 463
  px, and the crew panel's manage step for a crew of six 155 (section 7,
  The sheet's edges, as built). Advanced is the gear's pull request's
  (step 9).
- A focus ring cut at an area's top or foot. #78 gave a ring room at an
  area's sides alone: block padding would change heights. Where an area's
  first or last thing is a control and the area is at that end, the area
  still cuts its ring: the hotel's list and the shared day's at both ends,
  the first and the last row; an event's body at its foot, its last chip;
  the crew panel at both, its heading and Done. Not the filters' body nor
  Advanced. And an event's panel, which scrolls too, cuts the bottom of
  the ring on the star, Add this to calendar and Done on every event's
  sheet, and the top of its heading's. Older than PR #97, which measured
  it (section 7, The sheet's edges, as built; ROADMAP, Flags). For step
  11's sweep.
- The Type control's ring. `.seg` clips at its own box and its buttons
  fill it, so a focused button of the filter sheet's Type control shows no
  ring above or below it, nor at the control's two ends. Plans' segment
  draws its ring inside (`.plans-seg`); the Type control, a `.seg` too,
  does not. Older than PR #97, whose browser run found it (ROADMAP,
  Flags). For step 11's sweep.
- The arrow over the body. While an event's panel scrolls as one, its
  foot is pinned over the gap the arrow stands in, and the arrow is drawn
  over the foot of what shows of the body until the panel is at its end:
  over text, with Larger text on a short screen in 2026's tallest case
  (#74, #78; section 7, The sheet's edges, as built).
- The one-line "how to get there" (W18): no data for it exists, and the
  sheet says the level alone (section 13).
- A role the listing writes "(Alt: )" prints as the listing writes it, in
  lower case, after the name: one person in 2026. The pipeline's, not the
  sheet's.
- A listing that says its classes are full, with no "sold out" in it,
  carries no Sold out flag - "Workshop: Chainmail Dice Bag" is one. The
  parse stage prefers a missed flag to a false one, so a row or a sheet
  without the flag is not a promise, and nor is the Not sold out filter,
  which keeps it (#77). The pipeline's.
- A cancelled pick. The hero and the gap line still band it - "then
  `<place>` at 3:00 PM: overlaps by 30 min", a walk band between rows -
  while a row's overlap flag counts a cancelled pick in no other pick's,
  and gives it none (#73; section 10, as built). Step 8b's to settle, with
  the alternatives it offers for a cancelled pick (ROADMAP, tentpole 5).
- The hotel sheet's rows name the hotel its title already names - "Hilton
  · 306 · 3rd Floor" under the heading "Hilton" - on the narrowest lines a
  row is drawn on, 271 px of text at 375 (section 10, as built).
- Whose crew. Now's crew section, the Map's count and who's going take
  every crew the reader is in, by `goingTo()`'s rule - a person once, by
  the oldest crew's name - while Plans' Crew segment shows the one crew
  chosen, by its own names. So Now's "+N more" lands on that crew's day,
  which may not hold everyone it counted, or may name one of them
  otherwise (section 2, as built).
- ~~The hotel sheet's crew. A hotel where only the crew has picks opens the
  hotel sheet's "No picks here on `<day>`.", its head saying "no picks"
  under the Map's crew count that says otherwise: the sheet lists the
  reader's own picks alone (sections 6, as built, and 8). Its crew block is
  a follow-up, step 5c, designed in chat (ROADMAP, tentpole 5).~~ Built by
  PR #82, step 5c: Your crew here, under the reader's own picks, and the
  head's count the pill's (section 8, as built).
- The crew named before joining. The invite carries only `<year>.<token>`,
  and only members can read a crew, so the join step names none; a preview
  would be a read by function, against #52's reads by policy, and a
  decision of its own (section 5, as built).
- The home-screen app's viewport, measured 377 wide against a 402-wide
  screen, while the Safari tab on the same phone measured 402: not
  explained, to check on a phone (section 1, as built).
- More than one value a filter. The filter sheet takes one (#70), as the
  page did: two hotels, or two kinds, are two searches (section 3, as
  built).
- ~~An audience control. Kids and 18+ are words in the box alone - "kids",
  "18+" - with no control in the filter sheet (section 3). A track chosen
  in the sheet over "kids" takes the word out, and its hiding of 18+ with
  it (#71).~~ Settled by PR #96, step 7b: the Audience select, Kids, No
  18+ and 18+, which the words hold (#77; section 3, as built).
- "adult" is an ordinary word too. It is a whole word of four of 2026's
  titles and of the track Young Adult Literature, and "young adult" reads
  as 18+ and "young". Older than PR #96, which did not change what is
  read: since it, the Audience select shows 18+ for such a query, and the
  box left takes the sheet's own Audience to All (#77).
- An option's count and the list. Getting in's counts are over every
  event, as the axes' are, and the list hides photo sessions and
  video-room screenings: "Kids (88)" lists 66. The main button's count is
  the list's (#77; section 3, as built).
- A row that says 16+ under 18+. "Puppetry 101 - Adults" is a mature
  audience whose listing states 16: its row says 16+, the stated minimum
  winning the label, and it is 18+ to the word and the filter - No 18+
  hides it and keeps the other 16+, "Troika: Slate & Chalcedony" (#73,
  #77).
- The one-tap hotel filter the filter sheet traded away. The hotel chips
  were on the page, one tap each; now a hotel is Filters, its chip, then
  Show `<n>` events (#70; section 3, as built).
- Whether Type stays. Once tags exist it says nearly what Kind does: in
  2026, 870 events are Gaming by type and 868 by kind, and 807 of them
  both (section 3).
- A phrase split by another word. "photo marriott op" reads as Marriott
  and Photo op, since "marriott" is taken first and "photo op" is then
  side by side; but "photo op" is not side by side in the box, so the
  Photo op chip's x leaves the query as it was, and a tap on a kind in the
  sheet sets it under a word that still holds Kind (`search.js`
  `parseQuery()`, `dropPhrase()`; #71).
- The toggle that hides photo sessions and video-room screenings can show
  checked while a Photo op or Screening kind, from the sheet or a word,
  overrides it (`search.js` `activeFilters()`): the list then holds them
  (section 3).

**Home of:** W24.
