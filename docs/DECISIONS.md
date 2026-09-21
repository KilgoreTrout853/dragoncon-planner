# Decisions

Append-only. One entry per decision, newest at the bottom. Never edit an old
entry; if a decision is reversed, add a new entry that says so and mark the
old one `Superseded by #N`.

Status values: **Standing** (in the code today), **Decided, not built**
(agreed, implementation pending), **Superseded**.

Format per entry: what we decided, why, and what it costs us.

---

## 2026 build (inherited)

These were made during the 2026 build and never written down. Dates are
approximate; the code is the record.

### 1. One HTML file, no framework, no build step — Standing (2026, pre-con)
**Decided:** The app is a single `index.html` with inline CSS and JS, served
as static files from GitHub Pages. No bundler, no framework, no npm runtime
dependencies.
**Why:** Fast to ship, nothing to break at 2 AM at the con, works from a
phone's home screen. One person could hold the whole thing in their head.
**Cost:** The file is now large and monolithic; every change touches one
file, and the tests read it as a string. This is the constraint the 2027
foundation work exists to relax (see #12).

### 2. The scraper is the schedule's source of truth — Standing (2026)
**Decided:** `scraper.py` pulls the official Dragon Con app's web view
(`app.core-apps.com/dragoncon26`), normalises it, and writes
`data/2026/events.json`. The client reads that file and nothing else.
**Why:** The official app has the data but no planning tools. Scraping into a
flat JSON file keeps the client dumb and offline-friendly.
**Cost:** The event `id` is the official site's id. If they ever renumber,
every starred pick breaks. Duplicate listings (a panel in both the panel and
gaming feeds) collapse to the smallest id so a pick survives a re-scrape,
but that is a workaround, not stability by design. See #7.

### 3. Tags come from Claude, keyed by event id, preserved across scrapes — Standing (2026); to be superseded by #32 (shape, keying) and #33 (where tags are written)
**Decided:** `tag_events.py` sends untagged events to Claude (Haiku) and
writes `tags` (fandoms, kind, topics, adult, guests) back into `events.json`.
The scraper carries existing tags over by id on each refresh; only new
events get tagged.
**Why:** The fandom picker, kind chips, 18+ filter and search all need
categories the source doesn't provide. Tagging only the delta keeps a
refresh cheap.
**Cost:** Tag quality depends on a prompt and a `CANON` alias map in the
script. A change to the taxonomy means a full `--all` retag.

### 4. Offline by service worker, with three cache strategies — Standing (2026-09-01 backlog → shipped pre-con)
**Decided:** `sw.js` serves `index.html` network-first with a 3 s timeout,
the schedule cache-first with quiet background revalidation (it only
announces an update when `generated_at` actually changed), and fonts
cache-first forever.
**Why:** Con hotels have terrible signal. The app has to open and render from
cache, but a UI fix should still land when there is signal.
**Cost:** The cache name (`dc26-v4`) is bumped by hand when `index.html` or
`sw.js` changes. Forget the bump and users keep the old page.

### 5. No GPS, no location inference — Standing (2026-09-04)
**Decided:** The app never guesses where you are. "Leave by" is shown only
when a pick is on now and the next pick is in a different hotel; otherwise
just the start time and a walk estimate. Manual location chips, home base,
and GPS are all off the table.
**Why:** "Let's not create fake precision." A wrong leave-by is worse than
none.
**Cost:** The Now tab can't warn you if you wandered off between picks.

### 6. Leave-by uses a fixed 10-minute seating buffer; a con day ends at 5 AM — Standing (2026-09-01)
**Decided:** Walk estimate plus a constant 10 minutes to get seated. Events
between midnight and 5 AM belong to the previous day.
**Why:** Simple, predictable, matches how people actually talk about "Saturday
night."
**Cost:** One constant for every room in every hotel. Good enough for 2026.

---

## Off-season 2026 → 2027

### 7. Events get stable first-seen ids that survive re-scrapes — Decided, not built (2026-09-05)
**Decided:** The pipeline will assign its own id the first time it sees an
event and keep it across every later scrape, matching by content when the
source id changes. The pipeline owns schedule truth; the client never
invents or repairs ids.
**Why:** Picks, crews, and sync all hang off ids. Today's ids (#2) belong to
a third party.
**Cost:** A match-by-content step with edge cases (renamed panel, moved
room). Belongs to the 2027 pipeline work.

### 8. Identity is anonymous-first — Decided, not built (2026-09-05)
**Decided:** Every device gets a key with no prompt. An optional email
magic-link upgrade links devices for cross-device sync. Crews need only a
display name. No passwords, no social graph.
**Why:** Most users will arrive by a forwarded link and never meet the
author. Zero friction to first pick, and nothing worth breaching.
**Cost:** Someone who never upgrades and loses their phone loses their plan.
Acceptable.

### 9. Local-first with optional sync; link-based sharing — Decided, not built (2026-09-05)
**Decided:** The device is the primary store. Sync is an add-on. Sharing and
crews work by link, not by friending. Supabase is the working assumption for
the backend, to be confirmed in step 3a of the plan.
**Why:** The app must keep working with no signal (see #4) and with no
backend at all. A backend that is down should degrade to 2026 behaviour, not
to a blank screen.
**Cost:** A sync/conflict rule (outbox proposed) still has to be designed.

### 10. Crews are coordination, not conversation — Decided, not built (2026-09-05)
**Decided:** No in-app chat, ever. WhatsApp stays the chat. In scope: crew
picks overlaid on the timeline, "who's going" per panel, a crew Now board,
status pings tied to a pick, one-tap share-a-day. Build order: picks →
presence → pings.
**Why:** The group already has a chat. Building a worse one is wasted effort
and a moderation burden.
**Cost:** Some coordination will still spill into WhatsApp. That's fine.

### 11. Plan for 300–500 users, not 10 — Decided (2026-09-05)
**Decided:** Design the 2027 backend and data model for a few hundred users
arriving by forwarded link, with an ambitious build-out treated as a
deliberate learning exercise.
**Why:** The cost of planning for 300 when 10 show up is small; the reverse
is a broken app on con weekend.
**Cost:** More infrastructure than a friend-group app strictly needs.

### 12. Every current-time read goes through `now()` with a dev override — Standing (2026-09-07)
**Decided:** One `now()` function. `?now=<ISO>` in the URL sets a simulated
clock, kept in `sessionStorage`; bare `new Date()` / `Date.now()` are
forbidden outside the Time section of `index.html` and the smoke test
enforces it. Stopwatch reads use `performance.now()`.
**Why:** Archive mode, the Now tab, leave-by and the map all depend on the
clock, and none of them can be tested against the wall clock in December.
**Cost:** Anyone adding a time read has to know the rule. The test is the
guard.

### 13. Freeze 2026 data; the app enters archive mode after the con — Standing (2026-09-07)
**Decided:** `data/2026/events.json` is frozen. The client computes a con
phase (preview / live / ended) from `now()`; after the last event it shows a
dismissable "2026 has ended" banner and the Now tab becomes a read-only
record of your picks.
**Why:** The 2026 link should keep working for the group all off-season, and
2027 work needs a realistic dataset to develop against.
**Cost:** The 2027 scrape (new `dragoncon27` source, new `data/2027/`) is a
pipeline change, not a data refresh.

### 14. `main` is frozen at v2026-final; all work happens on `next` via PR — Standing (2026-09-07, enforced 2026-09-10)
**Decided:** `main` is what GitHub Pages serves and is tagged `v2026-final`.
A GitHub ruleset requires a pull request to change it (0 approvals, no
bypass). `next` is the development branch; feature branches target `next`.
Claude Code never commits to `main`.
**Why:** The live link must not break while the app is being rebuilt
underneath it.
**Cost:** Every change to the live site, including a one-line fix, is a PR.

### 15. A separate dev site, stamped by a build step — Standing (2026-09-08)
**Decided:** `build.py` copies the site into an output folder, dropping
source-only files (tests, scripts, README), and stamps a channel and build
id into `index.html` (`<meta name="dc-channel">`, `<meta name="dc-build">`)
and `sw.js` (`CHANNEL`). A stamped page shows a "dev build · next · <sha>"
mark, prefixes its cache name with the channel, and keeps its simulated
clock under a channel-specific session key. An unstamped build is
byte-identical to the source. Nothing in the page decides behaviour by
hostname.
**Why:** The live site and the dev site share an origin
(`kilgoretrout853.github.io`), and so share `CacheStorage` and
`sessionStorage`. Without the stamp, the dev site's worker would evict the
live site's cache and a test clock would follow you to the live link.
**Cost:** Two deploy paths to keep working. See ARCHITECTURE.md → Deploy.

### 16. The repo's default branch is `next` for the off-season — Standing (2026-09-10)
**Decided:** GitHub default branch switched from `main` to `next` so the
design Project's GitHub sync (which has no branch picker) reads `next`, and
so new PRs target `next` by default.
**Why:** The sync must show the code being worked on.
**Cost:** The scrape workflow's `git push` lands on whatever branch it checked
out, which is the default. The cron is deleted, not paused. Re-check the
target branch — and the rebase step, which hard-codes `main` — before it
comes back for 2027. Note also that `main`'s ruleset now blocks the bot's
push; see ARCHITECTURE.md → Sharp edges.

### 17. No 2026 retro; `docs/` starts with two files — Decided (2026-09-10)
**Decided:** No retro document. Anything remembered later goes into this log
as context. `docs/` begins with `DECISIONS.md` and `ARCHITECTURE.md` only.
**Why:** A retro written from nothing is worse than none.
**Cost:** Some 2026 lessons are lost. Accepted.

### 18. The 2027 vision is planning and coordination; VISION.md holds it — Decided (2026-09-17)
**Decided:** `docs/VISION.md` states what the app is for and what its
author is building it to learn. One line: "the planning and coordination
layer for Dragon Con." A feature is in only if it helps someone plan or
coordinate. Five pillars — Plan, Coordinate, Keep, Live, Tell me — and one
stretch, the building view. The learning list is ranked; the spring scope
cut takes from the bottom.
**Why:** The roadmap needs something to be written against, and
"ambitious" needs a definition or it means everything.
**Cost:** Good ideas that fail the test do not get built. VISION.md is one
more document that has to stay true.

### 19. Dragon Con is a door kept open, not a design target — Decided (2026-09-17)
**Decided:** The app is not designed for an official partnership. It stays
official-ready in five ways: the schedule source behind one interface, no
personal data by default, offline, accessible, scale by configuration.
Outreach happens once the 2027 work shows momentum — roughly a week or two
out — and before the pipeline work. If a data feed is offered, it replaces
the scraper behind that interface and the match-by-content step in #7
becomes unnecessary.
**Why:** Guessing at their requirements would mean building for tens of
thousands of users the app will never have. The official-ready properties
are good engineering regardless.
**Cost:** If the partnership happens, some rework is certain. It is the
rework worth doing then, not before.

### 20. Notifications in 2027 are minimal: leave-by and pick-changed — Decided, not built (2026-09-17)
**Decided:** Web Push for two events only: leave by (computed server-side
from synced picks and the walk table) and your pick changed (from the
pipeline's diff). Crew pings by push are deferred to the spring checkpoint.
Push needs the backend from #9 and, on iPhone, an installed PWA.
**Why:** The fixed cost — subscription storage, a scheduled job, the iOS
install requirement — is paid once. Two types is the smallest slice that
makes the top rung of the ladder real.
**Cost:** Leave-by is now computed in two places. The walk table and the
buffer (#6) have to live somewhere both the client and the job can read,
which is a step-3a question. Uninstalled iPhone users get nothing.

### 21. Venues are pipeline-owned data; the building view is a stretch goal — Decided, not built (2026-09-17) — drawing half superseded by #28; the venues file stands via #27
**Decided:** A venues dataset (hotel → level → rooms, with aliases for the
room strings the scraper produces and a one-line "how to get there") is
owned by the pipeline, which resolves every event's room against it and
flags unknowns. The data ships first and improves rows and the detail
sheet on its own. The per-hotel building view — tap a hotel, see its
levels with your picks lit — is schematic, never traced floor plans, and
is gated on the foundation and Coordinate landing by the spring
checkpoint. The author curates the rooms. The animated top-down-to-side
transition is built last, if at all.
**Why:** The value is knowing which level a room is on; the drawing is
presentation. Schematic keeps it honest (#5) and maintainable.
**Cost:** Roughly 120–150 rooms to curate by hand, and a new failure mode
when 2027 renames rooms. The pipeline warning is the guard.

### 22. AI runs in the pipeline, not at runtime — Decided (2026-09-17)
**Decided:** No runtime AI in the core app. Tags, aliases and similarity
are computed in the pipeline and shipped as data. A pre-con "help me plan"
feature may be tried behind a flag as an experiment, never as a dependency.
**Why:** Per-request cost, a relay to build, and no signal at the con.
Pipeline-time AI is free at runtime and works offline.
**Cost:** The app cannot answer a question it was not pre-computed for.

### 23. The client is built from `src/` by Vite; single-file output for step 4 — Built (2026-09-17)
**Decided:** The client becomes ES modules under `src/`, built by Vite.
`public/` holds what is served verbatim: `sw.js`, `manifest.json`, icons,
`data/`. `base` is `./` because the same build is deployed at two
subpaths. `build.target` is pinned to the iOS 16.4 floor that #20 already
implies (`safari16.4`); Android is never the floor because Chrome updates
independently of the phone. MiniSearch becomes an npm dependency instead
of pasted source. The channel and build-id stamp moves into the Vite build
(`DC_CHANNEL`, `DC_BUILD` env vars, a small plugin writing
`dist/index.html` and `dist/sw.js`); `build.py` and `tests/test_build.py`
retire, their assertions becoming a Vitest test against `dist/`.
`package.json` switches to `"type": "module"`. For step 4 the build emits
one inlined `index.html` (an inlining plugin, or a thirty-line post-build
script if the plugin rots), so `sw.js`, its `SHELL` list and the deploy
contract are unchanged; hashed assets are a later decision, taken with the
service-worker work. No framework in 2027; revisit only if hand-rolled
re-rendering becomes where the bugs live. No TypeScript in step 4; decide
at the Supabase step, where generated database types are the concrete
payoff. 2026-09-18: the bundle is minified with no source map; the Rolldown
settings that held `dist/` to `src/`'s syntax tree were step-4 scaffolding
for the smoke harness and left with it.
**Why:** Testable functions, a real dependency graph, and a tool the rest
of the ecosystem uses. Single-file output makes "zero behaviour change"
literal and verifiable.
**Cost:** Vite's dev server and production build use different engines, so
only the built output counts as tested. The root `index.html` becomes
Vite's entry template; when the 2027 app merges to `main`, Pages must
serve a built artifact rather than the branch (#26). jsdom does not
execute `<script type="module">`, so the inlined script is emitted as a
classic script (or the test loader strips the attribute). Two toolchains:
Python owns the pipeline, Node owns the client.

### 24. Vitest and pytest; ESLint with two rules (three since 2026-09-19: `no-unused-vars`); Playwright deferred — Built (2026-09-18)
**Decided:** Vitest (jsdom environment) for the client, run by `npm test`;
pytest for the pipeline, run by `python -m pytest tests/` (the existing
test files are already pytest-shaped; only the manual `__main__` runners
go). ESLint with exactly two rules: `no-undef`, and a restriction on
`new Date` / `Date.now` everywhere under `src/` except `src/time.js`,
which replaces the smoke test's regex as the #12 guard. Every assertion in
`tests/ui_smoke.js` is reclassified: DOM behaviour → Vitest + jsdom; rules
over source text → ESLint; build-output checks (stamps, SW registration,
cache name) → a test against `dist/`; implementation-detail regexes (e.g.
a function signature) → a behaviour test or deleted; real-data search
checks → their own file. The behavioural assertions are ported first and
made green against the one-file app, then the split happens, then they run
again against `dist/`. The modular app exposes an explicit
`boot({events, now})` so tests inject data and clock directly instead of
string-replacing `<script>`. Playwright is deferred; the trigger is the
first change to `sw.js`, when jsdom can no longer see what is changing.
2026-09-19: the last two rules over source text that ESLint could take -
no code scrolls the window, nothing decides by hostname - moved from
`tests/rules/source.test.js` into `eslint.config.js`, as selectors under the
`no-restricted-syntax` rule that holds the clock guard; still three rules.
**Why:** Vitest reads the Vite config, so tests import `src/` the way the
app does. `no-undef` catches the number-one error of splitting a
global-scope file — a function used in one module that now lives in
another without an import — statically, in every file. Tests ported before
the refactor are the refactor's proof; tests written after it only prove
its own assumptions.
**Cost:** One more tool. Porting before splitting is work that ships no
feature. Until Playwright, offline and install are verified by hand on the
dev site.

### 25. Supabase is the backend — Decided, not built (2026-09-17)
**Decided:** #9's working assumption is confirmed. Two hosted projects,
dev and production; the schema lives as migration files in
`supabase/migrations/`, applied by the CLI and changed only through PRs;
`seed.sql` for a dev dataset. One Edge Function — the push sender —
triggered by pg_cron on the minute; nothing else runs in Deno. Anonymous
sign-in is the device key (#8), enabled with a bot check, with a periodic
cleanup of stale anonymous users. The email upgrade uses a six-digit code
typed into the app, not a magic link, because on an installed iPhone app
the link opens in Safari, whose storage is separate. Realtime is an
accelerator over refresh-on-open and polling, never a dependency. The
pipeline writes to Postgres with a service-role key held as a repository
secret: an events mirror, the schedule diff (#20), and venues (#27).
Production runs on Pro for August and September (backups, no pausing) and
free otherwise, with a weekly keep-alive request so the dev project does
not pause. The client ships the public anon key; row-level security is the
whole defence.
**Why:** Every requirement in #8–#11 and #20 maps to a first-class
feature: anonymous-to-email identity, RLS for crews by link, a per-minute
scheduler that GitHub's five-minute, often-late cron cannot provide.
Learning item 3 names it. Alternatives (Firebase, Cloudflare Workers + D1,
Convex, self-hosted PocketBase) each trade away Postgres, RLS, or the
scheduler.
**Cost:** RLS mistakes are silent — wrong rows come back, nothing errors —
so policies need tests. A third runtime (Deno), kept to one function.
About $50 a year. Free projects pause after roughly a week idle. Safari
deletes an uninstalled site's local storage after seven Safari-use days
without a visit, taking picks and the anonymous session with it; the next
open mints a new anonymous user and the old synced rows are orphaned. Only
an email-upgraded user recovers. VISION.md's "one that did not still keeps
what it had" is qualified in this PR, and the install nudge is now a
data-safety measure, not only a push enabler.

### 26. CI on every PR; `next` becomes PR-only with required checks — Decided, not built (2026-09-17)
**Decided:** `.github/workflows/ci.yml` with two jobs matching the
toolchain boundary: `client` (Node from `.nvmrc`, `npm ci` with cache,
lint, test, build) and `pipeline` (Python, `requirements.txt`, pytest).
Triggers: pull requests into `next` and `main`, pushes to `next`, and
manual dispatch. A ruleset on `next`: pull request required, both checks
required, bypass allowed for the repository admin only (the `main` ruleset
stays no-bypass). Merge strategy: squash for feature branches into `next`;
merge commit for `next` into `main`. The polling deploy repo
(`dragoncon-planner-next`) is kept; its only change is the build command,
from `python build.py --out ../site` to Node setup plus
`npm ci && npm run build` — a manual edit in that repo. `.gitattributes`
with `* text=auto eol=lf`, added in its own PR because the renormalisation
touches every text file. Dependabot for GitHub Actions only, monthly.
Recorded, not built: when the 2027 app merges to `main`, a workflow
deploys the built site to Pages from Actions.
**Why:** Tests that run only when typed are advice; a required check on a
PR-only branch is a gate. With `next` advancing only through green PRs,
the polling deploy publishes only tested commits without touching it. The
PR is already where the diff gets read.
**Cost:** Every change is a branch and a PR, small ones included. A
workflow file with a syntax error blocks every PR until an admin bypasses.
The scrape workflow's direct push is blocked by the `next` ruleset exactly
as `main`'s already blocks it; before the 2027 cron returns it must open a
PR with auto-merge on green, or run as a bypass actor — pipeline work,
forced by this decision. The line-ending change is a one-time noisy
commit.

### 27. Walk table, buffer and hotel identity live in the venues file; one shared leave-by formula — Decided, not built (2026-09-17)
**Decided:** #21's venues file (`data/2027/venues.json`, per-year as #13
set for events) also holds hotel identity (keys as used in `events.json`,
short names, groups), the walk matrix, the seating buffer from #6, and the
same-hotel and unknown-pair defaults. It is hand-curated; the pipeline
validates it on every run — an event whose hotel is not in venues fails
the run — and mirrors it into Postgres alongside events in the same run.
Git is the truth for static data; Postgres holds a mirror; the pipeline is
the only writer of both. The client imports the JSON at build time, so it
is inlined into the bundle: no fetch, no new precache entry, offline by
construction. The leave-by formula is one pure module,
`leaveBy(prevHotel, nextHotel, crowd, venues)`, in
`supabase/functions/_shared/`, imported by the client and the Edge
Function; if that import proves awkward, the fallback is a shared test
fixture of inputs and expected minutes that both sides assert against. The
crowd factor syncs with the user's settings and the job applies it,
default 1.0. The job evaluates #5's rule at send time — leave-by only when
a pick is on now and the next is in a different hotel — and never infers
location. In step 4 the only change is isolating today's constants in
`src/venues.js`.
**Why:** #20 put leave-by in two places; this puts the data in one and the
arithmetic in one. Walk times change with the buildings, not the schedule,
so a build-time import is the right cadence.
**Cost:** A drift window of one deploy after a data commit. Copying the
file forward each year. One Vite config line to import from outside
`src/`. Supersedes #6's "one constant" — the buffer becomes data.

### 28. The building view goes to the room: a top-down level view, floor plans as reference — Decided, not built (2026-09-18)
**Decided:** Supersedes the drawing half of #21; the venues file (#21, #27)
stays pipeline-owned and still ships first. The building view gains a third
layer: tap a level in a hotel's stack and it drops to a top-down view of that
level, rooms as blocks in their real relative positions and rough
proportions, landmarks marked (escalators, elevators, skybridge doors), no
walls, no scale. The hotels' published floor plans and Dragon Con's own maps
are reference for adjacency and placement only; nothing of theirs is copied
or embedded; our shapes are drawn with their plan as an underlay. Each level's
drawing is data in the venues file (an outline, room shapes keyed by room id,
landmarks, which connector lands where); the client builds it once and only
lights it. The pipeline normalises the schedule's combined-room strings
("Regency VI-VII", "Centennial II-IV", "A601-A602") to room ids; an unmatched
string falls back to level-only, then hotel-only. Curation covers the
Marriott, Hyatt and Hilton first, in the order a room census of `events.json`
sets; a hotel without level data keeps today's hotel sheet. Still schematic,
still no location (#5): the level view answers where a room is, not where you
are. The animation is being designed now in a throwaway sketch outside the
repo; the build order and the spring gate from #21 are unchanged.
**Why:** Which level is necessary but not sufficient. The hotels are mazes
and the question people actually ask is which end of the level and from
which escalator. Room placement is where the value is; the stack is how you
get there.
**Cost:** Roughly 150–250 room shapes across three hotels, curated with a
drawing tool that shows the plan as an underlay; #21's renamed-room failure
mode now also covers moved partitions. The map needs one persistent SVG
mutated in place rather than the innerHTML rebuild in `src/app.js` — a
constraint on step 4's module split.

### 29. Module order and the bus — Standing (2026-09-19)
**Decided:** The client's modules stand in one order, and `src/boot.js` is
its root. The order is the array `ORDER` in `tests/rules/imports.test.js` -
the fourteen leaves, then `scroll` and the `bus`, the five views, then
`sheet`, `loading`, `shell` and `dispatch` - and a module imports only npm
packages and the modules before it. No module imports `boot.js`, which
imports any of them and is imported by `src/main.js` alone; `dispatch` is
last, and only the root imports it. A module that has to change another
module's `let` calls a function the owner exports for it (`replacePicks()`,
`setOverride()`, `setReload()` and eight more today); it never reaches for
the binding. One call goes upward, `render()`, and it goes over the bus: a
module below the shell calls `requestRender()`, which calls straight
through, synchronously, to the function `boot()` registered first. Nothing
else crosses upward, by the bus or any other way; what two modules both
need goes below both, as the header's measurement went to `scroll`. A new
module goes into the order at the lowest place that satisfies its imports.
A module exports what another module imports from it and what a test
reaches by name, and nothing more. A handler lives in the module that owns
the state it writes, or in `dispatch` when it spans modules. `boot()`
writes no handler: it registers each by name, in a fixed order, because
listeners on one element fire in the order they were added.
**Why:** With one order there is no cycle, so no module can meet a binding
before it is initialised, the order of the `import` lines never matters,
and any module can be imported alone in a test. ES modules make an imported
binding read-only, so the write has to be the owner's; one named function
per write says who may make it. `render()` is the one thing everything
below the shell needs from above it, and a synchronous call-through keeps
what always followed the draw - the scroll put back, a measurement -
following it. The lowest place keeps a module from acquiring dependencies
it does not have, and keeps the next one's choices open. An export list
held to what is used is the module's interface and its share of the test
coupling, and nothing to look through. A handler beside the state it writes
needs no function to write it, and a `boot()` that only registers reads,
top to bottom, as the page's wiring. Step 4c's three slices were made under
these rules; this writes them down for the code that comes after.
**Enforced by:** `tests/rules/imports.test.js`, four tests: only `main.js`
imports `boot.js`; a module imports only npm dependencies and the modules
before it; every file under `src/` is `boot.js`, `main.js` or a module in
the list, so a new module fails until it is given a place; only the root
imports `dispatch.js`. `tests/unit/bus.test.js`, two: the bus throws before
it is wired, and calls through then and there once it is. The write rule is
the language's and the bundler's: an assignment to an import is a
`TypeError` when it runs, and Rolldown refuses to build it
(`ASSIGN_TO_IMPORT`), so `tests/build.test.js` fails. The rest is held by
review: the tests stop an upward import, not a second bus, and accept any
legal place, not only the lowest; nothing checks an export list against its
users, where a handler lives, or the order `boot()` registers in -
`tools/split/partition.js` checked that last while the split ran, and went
with it (`docs/SPLIT-MANIFEST.md`).
**Cost:** A line in a test's array for every new module. Eleven small
functions that exist only because a `let` has an owner. A redraw asked for
from below costs an indirection, and throws if it is asked for before
`boot()` has run. The order is a list in a test file, which is an odd place
to look for an architecture; ARCHITECTURE.md repeats it and has to be kept
in step.

### 30. Tentpoles order the 2027 work — Standing (2026-09-20)
**Decided:** `docs/ROADMAP.md` names six tentpoles: pipeline shape,
Discover, Places, identity and sync, delivery, where things live. Each
opens with a design chat that ends in DECISIONS entries, a data contract
and a first Claude Code prompt, usually a read-only census. One tentpole is
in design and one in execution at a time. A feature is specified when its
tentpole opens, not before. Discover is first. The only dates are the
spring checkpoint, the freeze and the con.
**Why:** Most features hang off a few load-bearing designs. Review
attention, not code throughput, is the limit.
**Cost:** No feature-level plan exists until a tentpole opens. The
checkpoint and freeze dates are still unset.

### 31. Curated registries live in git, cross-year — Decided, not built (2026-09-20)
**Decided:** #27's pattern, generalised. `data/registry/works.json`,
`people.json` and `tracks.json` are hand-curated, validated by the pipeline
on every run, and resolved to ids; the client sees only resolved data. They
are cross-year, unlike venues, because a work or a person outlasts a con.
One works registry: id, name, aliases, optional parent, type (franchise |
game), and for games a family (rpg, ccg, board, miniatures, video). People
holds curated people only - celebrity guests, prolific creators: id, name,
aliases, tier, and at most about 5 credits, each pointing at a work and
carrying reviewed true/false; only reviewed credits reach events. Works the
tagger proposes are auto-added, marked unreviewed, and listed by the
census. `tracks.json` holds track aliases, the default axes of single-topic
tracks and, where a track is about one work, that work, which is the source
of `via: track` (#32).
**Why:** Census sections 2, 7 and 11 (`docs/discover/census-2026.md`).
Spelling is not the problem (one near-duplicate); identity is. Firefly has
9 events and its cast about 60 appearances (Appendix B: Tudyk, Staite,
Fillion, Torres, Glau). Guest tier disagreed on 31% of same-input groups
because fame is not in a blurb.
**Cost:** Reviewing credits for about 225 people. An id is forever: a
rename or merge keeps an alias, because follows are stored by id. An
unreviewed work can be wrong until someone looks.

### 32. Tags v2 — Decided, not built (2026-09-20) — the pipeline half built by #34, which supersedes its line on axes; the client half is PR 6's
**Decided:** Supersedes #3's tag shape and its keying by event id, when
built. Parse what the source states; closed lists for what the model fills;
every link says why.
- `facets`, parsed, no model: `mature`, `min_age`, `cost`, `sold_out`,
  `signup`, `repeat_key`, `part`.
- `people`: from `speakers` and from the description's "Additional
  Panelists:" line, each with `src`.
- `tags`: `kind` unchanged (13). `works`: registry ids, each with `via` =
  `about` | `credit:<person>` | `track`. `topics` is replaced by four closed
  axes, at most 2 each (lists in `docs/discover/schema-v2.md`): `medium`,
  `genre`, `craft`, `subject`. `audience`: kids | all | mature - mature when
  the parsed marker says so or when the model adds it; the model may add
  mature, never remove it. v1's `adult` flag folds into `audience`.
  `play {format, level}` on gaming events. `guests` is derived from people
  tiers, never asked.
- The model is asked for axes only where `tracks.json` does not decide.
- One input is tagged once: answers are cached by a hash of what the tagger
  was sent.
- Following or searching a work: events about it first, then a separate
  "with the cast" group linked by credits; photo and signing kinds hidden
  there unless asked for.
- The on-device profile uses the same ids: follows, mutes, and weights
  computed from stars. Weights sync only as settings after the email
  upgrade (#8, #25).
- Embedding a typed query at runtime stays out (#22).

**Why:** Census section 11: 231 of 331 same-input groups disagree; topics
53.2%, guests 30.8%, fandoms 16.3%, kind 3.0%, adult 0.6%. Closed
single-choice fields hold; "up to 3 of 32" across five mixed axes does not.
27 of 54 tracks are over 80% one topic (section 10). "(Mature Audience)" is
the schedule's own marker (section 6). 981 events carry an "Additional
Panelists:" line in the description (section 7).
**Cost:** A full retag. The client's search index, Explore, follows and
filters change shape, in a PR of their own, after a golden query set
exists. Follows stored by name need mapping to ids. The file grows;
unmeasured and accepted, to be measured after.

### 33. The frozen 2026 file is the input; v2 output is derived beside it — Decided, not built (2026-09-20) — built by #34; the client switch is PR 6's
**Decided:** Supersedes #3's writing of tags back into `events.json`, when
built. #13 stands. The v2 pipeline reads `data/2026/events.json` and never
writes it. It writes `data/2026/events.v2.json`, and a committed tag cache
keyed by input hash. Frozen events + registries + cache give the same bytes
every run with no model call. The client on `next` reads the frozen file
until a PR of its own switches it. For 2027 the pipeline writes the v2
shape into `data/2027/` directly.
**Why:** #13's reasons; `tests/real-data.test.js` asserts against the
frozen file; CI has no model access; reproducibility.
**Cost:** Two copies of the 2026 schedule in the repo. The build copies
`data/` into `dist/`, so the v2 file ships unused until the switch unless
the copy excludes it; decide in the PR that first writes it.

### 34. Tags v2 as built: one answer an input, cached as names; the model by full id — Standing (2026-09-21)
**Decided:** `tag_stage.py` asks the model and `events_v2.py` builds
(#32, #33); `docs/discover/schema-v2.md` has the detail.
- **The input and its key.** The model is sent an event's title without its
  price mark, SOLD OUT, clock time or CANCELLED and the separators they
  leave, its scraped type and tracks, and its description without the
  "Additional Panelists:" line, capped at 2,000 characters. No people: a
  panel with a different moderator is the same input, and a guest's name
  cannot pull their other shows in. The key is the sha256 of the canonical
  JSON of `{"v": PROMPT_VERSION, "input": ...}`; the prompt text, the works
  list, `tracks.json` and the model are not in it. `PROMPT_VERSION` is
  bumped by hand to ask everything again. The 3,459 events are 2,580 inputs.
- **The cache** is per year, `data/2026/tags.cache.jsonl`, and the key holds
  no year. One entry a line, sorted by key, `{key, title, model, answer}`,
  no timestamps, rewritten after every request, so a crash or a rate limit
  resumes where it stopped. It holds what the model said, held to the
  closed lists, and depends on no registry: a work in it is a name and the
  phrase that shows it, never an id. `events_v2.py` resolves every name on
  every run, so an alias, a merge or a rename fixes events with no model
  call. A name that is a registry term stays cached and is dropped by the
  build until a person makes it an alias.
- **Every field asked, every time.** The four axes are asked on every input,
  and `tracks.json` decides at build, per axis; this supersedes #32's "asked
  only where `tracks.json` does not decide". `play` is a format - demo,
  learn-to-play, organized-play, tournament, open-play or one-shot - and a
  level, beginner or any. `one-shot` is a scheduled, self-contained session
  that is none of the others. `campaign` and `experienced` were struck
  before the full run: at this con the Campaign track is organized play,
  and they were the values two runs disagreed on.
- **Mint only in `tag`.** A cached name the registry cannot resolve becomes
  a `works.json` row, `reviewed: false`, placed under a parent by one
  request with a closed list, and the file is written once, or not at all
  if that request fails. `--mint-only` mints with no model and asks no
  parent. `events_v2.py` never writes a registry: an unresolved name stops
  it, and it names the command that mints.
- **People and guests.** Every person's id goes through the registry,
  reviewed or not: resolution is spelling, and an id that changed on the day
  a person was approved would break a follow. A credit reaches an event only
  where the person and the credit are both reviewed, and `guests` is the
  highest tier among reviewed people, else absent.
- **The model by full id,** `claude-sonnet-5`, on the API and on Claude Code
  alike: an alias moves with the CLI, and on 2026-09-21 `sonnet` was
  claude-sonnet-4-6. The cache records the model that answered. Claude Code
  runs with no tools, no MCP servers, no saved session and no CLAUDE.md or
  memory; the prompt goes on stdin.
- **Shipped unused.** `events.v2.json` and the cache ride in `dist/`'s copy of
  `data/` until PR 6, which turns the copy into an allowlist of what the
  client reads; `sw.js` does not precache them. This settles #33's open
  cost.
- **Recorded for PR 6:** an unreviewed work is searchable, never followable,
  so no id becomes permanent before a person has looked at it.

**Why:** Census section 11: 231 of 331 groups of events that sent v1's
tagger the same input do not all carry the same tags; one input, one
answer. Names in the cache keep an id a person's decision (#31). CI has no
model (#33). The prompt was settled over a pilot of 150 inputs and two
gates, whose tables are in the pull request, and the alias moved under us
between two briefs.
**Cost:** A retag is not neutral. On identical inputs, two runs of the same
model and prompt differ on about 2-3% of inputs for works, 1-2% for kind,
and 7-10% for each axis (pilot, gate and re-gate, 150 inputs). The cache,
not the model, is what makes an event's tags stable, so `PROMPT_VERSION` is
bumped rarely and on purpose, and a listing that does not change between
years keeps its answer. A wrong cached answer is corrected by hand in
`tags.cache.jsonl`, with `"model": "hand"` on that line so a reader can
tell. The correction is lost if `PROMPT_VERSION` is bumped; if hand lines
grow past a handful, census v2 is where an overrides file gets designed.
The first run minted 383 works, every one unreviewed and each a person's to
check; a name that is a registry term links nothing until someone makes it
an alias. `dist/` carries `events.v2.json` and the cache unused until PR 6.
A full run is about a hundred requests: about 41 minutes on Claude Code with
three workers.
