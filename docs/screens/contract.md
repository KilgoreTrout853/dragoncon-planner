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
  text leaves the map alone; a field's text is never under 16px: an
  iPhone zooms the page on focus - and zoom itself is never limited or
  blocked. Each pull request's description says how it met them until
  Playwright checks them (#24, #57).
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
  | A pick on, nothing after it today | ends 2:00 PM |
  | Nothing on | starts 3:00 PM, and under it, muted, the walk from the pick before: ~12 min from the Westin |

  The band is `walk.js` `connection()`'s for the pair, which `gapHTML()`
  reads too, so the hero and the gap line under it - Rest of your day's
  first, measured from the hero - never hold two opinions about one pair:
  the hero is a card, the gap line a list, and both stay. An overlap is the
  two picks' intersection, the earlier end less the later start, so a
  10-minute session inside a 4-hour game overlaps by 10. The gap under the
  walk and an overlap are in warn, `.hero .hthen.warn`, as the gap line
  marks them; tight but doable stays quiet in both. Nothing says when to
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
  the crews at a change of owner or with no session; both only while
  Plans is the tab or the crew panel is open - since PR #81, while Now,
  the Map or Plans is the tab, or the crew panel or an event's sheet is
  open (sections 2, 6 and 7, as built). `render()` keeps Search's box and
  an open sheet as they were - an event's refills its who's-going line
  alone, in place - but rebuilds Explore's grid and its filter box with
  it, so a crewmate's star pulled while the reader types there would take
  the caret (ROADMAP, Flags): Search and Explore alone draw nothing for a
  crew's change. An event's sheet open over Explore draws Explore again
  behind it; focus is in the sheet, and the filter box keeps its text.
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
  one, the redraws and the gate, a change of owner, the refresh that keeps
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
  the screen, so three rows fit at 375x667 before it scrolls. Each row
  carries the reader's own star and works as a row anywhere; one not on
  the link's day carries its day's label; a removed one is marked and
  carries no star (#49), a cancelled one is marked. No "star all". A
  change to the reader's picks - a star here, in an event's sheet or from
  a pull - writes each row's class and star in place (`refreshSharedDay()`,
  from `render()`), so the list's scroll and the focus on a star stay.
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
  is taken whenever the shared panel closes or another panel opens, and
  See all, from that event, closes both. The hotel sheet's rows close to
  the Map, as before.
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
  focus, Escape, a star in the event's sheet, See all; the way back taken
  by a close and by another panel; and the 44px rules. `plans.test.js`
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

PR #81, step 5a, with #62 and #66: the crew's count. The focused hotel and
the building view (PRs 7 and 10) are still to come.

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
  in a crew, saying who starred the event - "Starred by" since PR #83, never
  that anyone is going (#68); in 2027 it taps nowhere.
- **The overlap** (W1): at the moment of starring, a line that lists
  every pick it overlaps, each with its times; a line, not a toast. The
  row's flag is section 10's.
- **Add to calendar** with W44's alarm, a fixed lead before the start - the
  same `ics.js` as Plans' Export, so both doors carry it. W44 is a
  standalone pull request in a free execution slot (#57), outside the
  sequence.
- **Focus and Escape** (#66): focus into the sheet on open and back to what
  opened it on close, and Escape closes it, for every panel. Built early,
  with the crew panel, by PR #77 (section 5, as built).

**Home of:** W18; W22; W42; W44.

Moves: `sheet.js` `eventSheetHTML()`, `openSheet()`, `closeSheet()`;
`dispatch.js` `onEventPanelClick()`; `data.js` (the people block);
`explore.js` `renderExplorePage()` (the line); `ics.js`.
Tests: `sheet.test.js`, `explore.test.js`'s "the detail sheet offers a way
through to a person", `ics.test.js`. PRs 5 (who's going) and 7; W44
standalone.

### The event sheet, as built

PR #81, step 5a, with #62, #64 and #66: who's going, worded as who starred
it by PR #83, step 5d, with #68. Focus and Escape were built by PR #77
(section 5, as built); the rest is PR 7's, and W44's.

- **Who's going** (W22; `sheet.js` `goingText()`). On a build with a
  backend, a line in the sheet's head, under the place and its tags:
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
- **In place** (`refreshEventSheet()`, from `render()` beside
  `refreshCrewPanel()`). A pull's change refills the open event's line -
  its words, and whether it shows - and nothing else: the sheet is never
  drawn again for it, so focus and everything in it stay where they are.
  The star's tap draws the panel again, as before, the line with it.
- **The tests.** `tests/page/crew-everywhere.test.js`: no one, one, three,
  four and six; never the reader; a name escaped; a removed event and a
  cancelled one; the star's redraw; the line refilled in place with focus
  kept, and hidden by the last unstar; an open sheet over Search and over
  Explore, Explore's filter box keeping its text; none on a build with no
  backend; and, since PR #83, that no string the crew screens draw - Now,
  the Map, the hotel and event sheets, Plans' crew and the crew panel, their
  labels among them - says "going" or "with you". None carries a ledger
  bracket.

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
  px, four put it 409 px down a body 390 px tall. A tap on the block or the
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
- **#66.** Each line is a button, 44 px or taller, labelled by what it
  says, its focus ring drawn inside it, where the body clips at its sides.
  Its id is the crewmate's and the event's, `crewHere-<user>-<event>`,
  unique on the page - Now's lines, hidden behind the Map, are
  `crewNow-<user>` - so `scroll.js` `focusKey()` finds it by its id, never
  by its event, which the Map's card behind may show too. A line the new
  order moves has focus again; one taken away while it had focus gives it
  to the sheet's heading.
- **The gate.** An open hotel sheet counts, as an open event's does: a
  crew's change pulled while one is open asks for a redraw whatever the
  tab (`docs/sync/contract.md`, section 5, as built), so PR 7's entry
  points from other tabs find it ready.
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
  focus, a pull that changes nothing and the reader's own unstar; the gate
  over Explore; the day kept past 5 AM; next's markup, byte for byte, with
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
  stop 1 to propose. What an overlap is, is settled (PR #76): `walk.js`
  `connection()`'s, the two picks' intersection, the one computation the
  hero and the gap line read - the row PR words the flag from it and does
  not compute it again.
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
| A Map hotel block or its gold pill, a hotel without level data | The hotel sheet | `state.sheetHotel` | Done, the backdrop, a swipe, Escape: the Map | built |
| The Map's crew pill | The hotel sheet, Your crew's picks here brought to the top of its body (#63) | `state.sheetHotel` | Done, the backdrop, a swipe, Escape: the Map | built, PR #82 |
| A Map hotel block, a hotel with level data | The building view | the Map's drill-down | the view's own back, to the Map | PR 10 |
| The hotel sheet's "Search the Hyatt on Saturday" | Search | `state.browse`: the hotel, the day, no query | the tab bar to the Map, whose day `state.map.day` kept | built |
| The event sheet's "See all" beside a person | That person's Explore page | `state.explore.page`, the hash | "← Explore", to the grid: one tap from the event, accepted | built |
| An Explore tile, a Following chip, a Because-you-starred tile | Its page | `state.explore.page`, the hash | "← Explore", the grid's scroll put back | built |
| A `#explore=` link | Its page | the same, at load | "← Explore", to the grid | built |
| The event sheet's track or work chip | Its Explore page | the same | "← Explore", to the grid, as See all | PR 7 |
| The event sheet's place line | The Map, focused on the hotel - the room once the building view exists | `state.tab`, a focus in `state.map` | the Map's focused card, which reopens the sheet | PR 7 |
| Search's Filters | `#panel-filters` | the panel shown | Apply, Clear, or closed: Search | PR 6 |
| A kept `?join=`, in any phase | Plans' join step | `state.tab`, the step open | the step closed: Plans as it opens | built |
| A line of Now's Your crew's picks right now | The event sheet | `state.sheetId` | Done, the backdrop, a swipe, Escape: Now, focus on that crewmate's line | built, PR #81 |
| Now's Your crew's picks right now, "+N more" | Plans' crew's day, on today | `state.tab`, `state.plansView` saved as Crew, `state.plans.day` back to the clock's | the tab bar to Now | built, PR #81 |
| A line of the hotel sheet's Your crew's picks here | The event sheet, in the hotel's place | `state.sheetId` | Done, the backdrop, a swipe, Escape: the Map, focus on what opened the hotel sheet - no way back to the hotel sheet, as for its rows | built, PR #82 |
| My day's Share a day | The share panel, `#panel-share` | the panel shown, the day chosen | Done, the backdrop, a swipe, Escape: Plans, focus on Share a day | built, PR #85 |
| A `?day=` link, in any phase | The shared day, `#panel-shared`, over the phase's tab, once the schedule has loaded | the day, in memory alone; the address cleaned | Done, the backdrop, a swipe, Escape: the tab as it opened; a reload loses the day | built, PR #85 |
| A row of the shared day | The event sheet | `state.sheetId` | Done, the backdrop, a swipe, Escape: the shared day, its scroll kept and focus on the row; See all closes both | built, PR #85 |

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
    time to the other's end and now overlaps by its own length;
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
  giving the pair the same band; a stream after the pick on and one
  overlapping it; a pick inside the one that is on, overlapping by its own
  length on the hero and on the gap line; nothing on the three surfaces
  saying leave or marked late; and `gapHTML()` pinned against the code it
  replaced, with its two exceptions, over every pair of the fixture's
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
- How an offsite pick is named in a line: the hero says "then Other
  next" and "then Other at 3:00 PM", as it did before PR #76, where the
  walk estimate and the map's On now line name its venue - the row PR's
  (PR 7), which settles how a row and a line name a place. Until then,
  since PR #81, Now's crew lines name it as the Map's On now line does,
  its room or else offsite, by one helper, `venues.js` `placeShort()`.
- A crew line's time can break in two: after a long name, "4:00" ends one
  line and "PM" starts the next, on Now's lines and the hotel sheet's
  alike - one builder, `ui.js` `crewLineHTML()`, whose start is `util.js`
  `fmtShort()`'s, an ordinary space between the two. Within the
  24-character cap on a name, measured in the hotel sheet at 375 px: 23
  W's, or 24 M's under Larger text. PR 7's, the row and the line, which
  settles how a row and a line say a time.
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

**Home of:** W24.
