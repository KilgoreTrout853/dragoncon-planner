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

### 1. One HTML file, no framework, no build step — Standing (2026, pre-con) — superseded on `next` by #23; `main` keeps it
**Decided:** The app is a single `index.html` with inline CSS and JS, served
as static files from GitHub Pages. No bundler, no framework, no npm runtime
dependencies.
**Why:** Fast to ship, nothing to break at 2 AM at the con, works from a
phone's home screen. One person could hold the whole thing in their head.
**Cost:** The file is now large and monolithic; every change touches one
file, and the tests read it as a string. This is the constraint the 2027
foundation work exists to relax (see #23 and #29).

### 2. The scraper is the schedule's source of truth — Standing (2026) — on `next` since 2026-09-22 the client reads `events.v2.json`, derived from the scraper's file (#39)
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

### 5. No GPS, no location inference — Standing (2026-09-04) — leave-by half to be retired by #40; no-GPS stands
**Decided:** The app never guesses where you are. "Leave by" is shown only
when a pick is on now and the next pick is in a different hotel; otherwise
just the start time and a walk estimate. Manual location chips, home base,
and GPS are all off the table.
**Why:** "Let's not create fake precision." A wrong leave-by is worse than
none.
**Cost:** The Now tab can't warn you if you wandered off between picks.

### 6. Leave-by uses a fixed 10-minute seating buffer; a con day ends at 5 AM — Standing (2026-09-01) — the seating-time half to be retired by #40, the constant kept as the tight-connection slack; the 5 AM day boundary stands
**Decided:** Walk estimate plus a constant 10 minutes to get seated. Events
between midnight and 5 AM belong to the previous day.
**Why:** Simple, predictable, matches how people actually talk about "Saturday
night."
**Cost:** One constant for every room in every hotel. Good enough for 2026.

---

## Off-season 2026 → 2027

### 7. Events get stable first-seen ids that survive re-scrapes — Decided, not built (2026-09-05) — to be built by #43
**Decided:** The pipeline will assign its own id the first time it sees an
event and keep it across every later scrape, matching by content when the
source id changes. The pipeline owns schedule truth; the client never
invents or repairs ids.
**Why:** Picks, crews, and sync all hang off ids. Today's ids (#2) belong to
a third party.
**Cost:** A match-by-content step with edge cases (renamed panel, moved
room). Belongs to the 2027 pipeline work.

### 8. Identity is anonymous-first — Decided, not built (2026-09-05) — the email step amended by #25 (a six-digit code, not a magic link)
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

### 16. The repo's default branch is `next` for the off-season — Standing (2026-09-10) — for 2027 the scrape lands by pull request, and the default flips to `main` for the con (#48)
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

### 19. Dragon Con is a door kept open, not a design target — Decided (2026-09-17) — timing set by #37; deferred, no date, by #41
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

### 20. Notifications in 2027 are minimal: leave-by and pick-changed — Decided, not built (2026-09-17) — leave-by replaced by starts-soon in #40; pick-changed stands; the pipeline's diff to be built by #47
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

### 21. Venues are pipeline-owned data; the building view is a stretch goal — Decided, not built (2026-09-17) — drawing half superseded by #28; the venues file stands via #27; the file and room resolution to be built by #45
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

### 26. CI on every PR; `next` becomes PR-only with required checks — Decided, not built (2026-09-17) — built: CI, the required checks, the `next` ruleset, the deploy repo's build command, Dependabot and `.gitattributes`; open: Pages from Actions (Delivery); `scrape.yml`'s PR path decided by #48
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

### 27. Walk table, buffer and hotel identity live in the venues file; one shared leave-by formula — Decided, not built (2026-09-17) — by #40 the shared `leaveBy` module becomes the tight-connection helper; the buffer becomes the slack; the walk table's home unchanged; an unknown hotel to degrade to Other rather than fail the run (#44); the file to be built by #45
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

### 28. The building view goes to the room: a top-down level view, floor plans as reference — Decided, not built (2026-09-18) — its room resolution to be built by #45, which moves each level's drawing out of the venues file into `data/2027/drawings/`
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

### 30. Tentpoles order the 2027 work — Standing (2026-09-20) — the order after Discover is #37's
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

### 31. Curated registries live in git, cross-year — Decided, not built (2026-09-20) — built: `registry.py` loads and validates all three on every run; works and people reviewed (`docs/discover/works-review-2.json`, `people-review-1.json`)
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

### 32. Tags v2 — Decided, not built (2026-09-20) — the pipeline half built by #34, which supersedes its line on axes; the client half is PR 6's; its golden-query gate replaced by #36; PR 6 built by #38 and #39, the cast group on a work's page only
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

### 33. The frozen 2026 file is the input; v2 output is derived beside it — Decided, not built (2026-09-20) — built by #34; the client switch is PR 6's, built by #39
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

### 34. Tags v2 as built: one answer an input, cached as names; the model by full id — Standing (2026-09-21) — its PR 6 items built by #39: the allowlist into `dist/`, and no follow of an unreviewed work; its three build stops (a cache miss, an unresolved name, an unknown track) to become counted degradations, 2026's held at zero by a CI test (#44); `PROMPT_VERSION` to be per year, in `season.json`, and a minted row to record its year and run (#46)
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
and 7-10% for each axis (pilot, gate and re-gate, 150 inputs). On the same
prompt, the full run differed from a pilot run on 10 of 150 inputs for
works, wider than the same-sample pairs (1, 3, 5), because an input's
neighbours in a request change. The cache, not the model, is what makes an
event's tags stable, so `PROMPT_VERSION` is bumped rarely and on purpose,
and a listing that does not change between years keeps its answer. A wrong
cached answer is corrected by hand in
`tags.cache.jsonl`, with `"model": "hand"` on that line so a reader can
tell. The correction is lost if `PROMPT_VERSION` is bumped; if hand lines
grow past a handful, census v2 is where an overrides file gets designed.
The first run minted 383 works, every one unreviewed and each a person's to
check; a name that is a registry term links nothing until someone makes it
an alias. `dist/` carries `events.v2.json` and the cache unused until PR 6.
A full run is about a hundred requests: about 41 minutes on Claude Code with
three workers.

### 35. Census v2 is a living report, held fresh by CI — Standing (2026-09-21) — to count the works in a year's works block, not the registry, and for a live year to run on demand, not held by CI (#46)
**Decided:** `census_v2.py` writes `docs/discover/census-v2-2026.md`: the
questions of `census-2026.md` asked of `events.v2.json`, and the lists the
v2 design owes a reviewer - the unreviewed works that events link, the
drafted people, the people on `qa`, `photo` and `signing` events whom
`people.json` does not hold, and the links worth a person's look. It builds
`events.v2.json` in memory first and stops if the file on disk is stale. A
test in CI's `pipeline` job renders the report afresh and compares it byte
for byte with the committed file, beside the check on `events.v2.json`;
`--check` does the same by hand. It never links (#34): where a list comes
of matching text, every row is UNSURE, and the fix it names is a person's,
a `"model": "hand"` line in the cache. `registry-2026.md` stays as the
record of the seed review.
**Why:** Its inputs are living: the registries and the tag cache change
with every review. `registry-2026.md`, which nothing held, went stale: it
still reads 139 works, and `works.json` held 718 when this was written.
Held by CI, a data PR's diff shows its effect on the census beside its
effect on `events.v2.json`.
**Cost:** Every data PR that edits a registry or the cache re-renders two
files, `events.v2.json` and the census. The report can hold nothing
volatile - no date, no timing, nothing of the machine that ran it - or it
could never be fresh. `registry_report.py` is retired.

### 36. The golden-query gate is replaced by a search-eval harness after the client switch — Decided, not built (2026-09-22) — PR 6 built by #38 and #39; the harness is still to build
**Decided:** An eval harness after the client switch replaces the golden
query set that #32 put before it.
- PR 6, the client switch, is plumbing and parity: the client reads
  `events.v2.json`, and v1's search behaviour (synonyms, prefix and typo
  tolerance, the day, time, hotel, kind and other filter words it reads out
  of a query) carries across as it is. It is not a search redesign.
- Search is tuned after it, by a harness Claude Code builds and runs.
  Queries are generated from the registries (every work, alias, term and
  person), with mechanical variants (dropped spaces, typos, surnames alone,
  nicknames) and intent-style queries by category. The app's real search
  runs headlessly. A model judges relevance, cached like the tag stage,
  with a different model or prompt from the tagger's. A report by category
  comes out, rerun after each change.
- The author approves a rubric of what good means and spot-checks a sample
  of the judge's verdicts, and marks no results by hand.

**Why:** Tuning needs the infrastructure first. `next` has no users until
August 2027, so a regression in PR 6 hurts no one before the harness can
catch it. Search analysis is model work; a person sets the standard.
**Cost:** Model-built tags, model-written queries and a model judge share
blind spots; the rubric and the sample check are the guard. Real users'
searches are the missing input. Recording searches that return nothing,
anonymously, in 2027 is a privacy question for Identity and sync.

### 37. Pipeline shape follows Discover — Standing (2026-09-22) — outreach deferred by #41; search tuning held until the first pass of the whole app (ROADMAP, Held, 2026-09-22)
**Decided:** The tentpoles (#30) go in this order: Discover (PR 6), then
Pipeline shape, whose design opens while PR 6 executes, then Identity and
sync, then Delivery; Where things live last, as now.
- Search tuning (#36) does not gate Pipeline shape; it runs once PR 6 has
  landed, in a free execution slot.
- Identity and sync is designed while Pipeline shape executes, so it slips
  by one slot at most.
- The Postgres mirror (#27) is the seam: Pipeline shape ends at writing
  JSON, and the mirror is designed with Identity and sync's schema and
  row-level security.
- Places' data half (the room census, the venues file, room resolution) is
  Pipeline shape's venue-resolution stage. The building view's drawings and
  sketches continue on the side, in chat. Places PRs beyond what the
  pipeline absorbs take a free review slot.
- Outreach (#19) goes out when Pipeline shape's design opens.

**Why:** Discover's stages are pipeline stages, so the design continues
while they are fresh. The pipeline must run unattended through con weekend
and can only be proven on 2027 data in August. Live and Tell me rest on it.
**Cost:** Identity and sync, which carries Keep, Coordinate and Tell me and
the most new technology, opens one slot later. Coordinate still has to land
by the spring checkpoint for the building view to stay in.

### 38. The v2 file carries a works block — Standing (2026-09-22)
**Decided:** `events_v2.py` writes a top-level `works` into
`events.v2.json`, before `events`; every top-level field of the frozen file
but `events` is copied as it is. `docs/discover/schema-v2.md`, under The
file, has the detail.
- One row per work that any event's `tags.works` names, by any `via`, and
  every ancestor of those; nothing else; sorted by id.
- A row is `id`, `name`, `aliases`, `terms`, `reviewed`, then `parent` where
  the registry has one. `aliases` and `terms` are always there, `[]` where
  the registry holds none, and every value is the registry's as it stands.
  No `type` or `family`.
- Built from the merged events, not the registry, so every id in it has
  resolved. An event's `tags.works` still lists only the work named.
- 2027's pipeline writes the same shape into `data/2027/` (#33).
- PR 6 is two: 6a, this block; 6b, the client switch, which earlier entries
  call PR 6.

**Why:** The client switch needs, for every work an event links, the name
it shows, the parent chain, the aliases and terms that lead a searcher to
it, and whether it is reviewed: an unreviewed work is searchable, never
followable (#34). The client sees only resolved data, never a registry
(#31). The block is resolved data: its rows are the works events reach once
every name has resolved, and their ancestors - no other work, no person, no
track.
**Cost:** The file grows: by 61,637 bytes, 1.7%, at 661 rows when this was
written, shipped in `dist/` unused until 6b. An edit to the name, aliases,
terms, reviewed flag or parent of a work in the block now changes
`events.v2.json` even where it changes no link, so a works review that only
marks such works reviewed now rebuilds the file. The census report does not
read the block.

### 39. The client switch as built — Standing (2026-09-22)
**Decided:** The client on `next` reads `data/2026/events.v2.json` (#33,
#38), and every surface keeps its behaviour: plumbing and parity, not a
search redesign (#36). `docs/discover/schema-v2.md` has the detail, under
The file, The profile and About, and with the cast.
- **The file.** `data.js` builds `worksById` from the works block and a
  descendants map from `parent`, and `linksTo(event, work, vias)` is true
  where the event names the work or anything under it by one of the vias -
  about and track unless the credit via is asked for. `data.js` is the
  only module that walks `parent`; every count, filter, tile and follow of
  a work agrees with `linksTo`, and a count is taken in one pass over the
  events.
- **Fandoms are works.** Where the client read `tags.fandoms` it reads the
  about and track works: the index's `fandoms` field (their names and the
  names above them), the suggestion chips, the Fandom select (value the
  id, label the name), the filter, the Explore tiles, the feed, the sheet's
  chips and the suggested follows. The select and the tiles take reviewed
  works with 3+ rolled-up events; the index and the suggestions take every
  work. The follow kind is `work`, `state.browse.work` holds an id, and
  `#explore=` holds ids. DOM ids, CSS classes and the copy stay.
- **Topics are axes.** One Topics section: every value of the four axes in
  the file, in count order, and `audience:kids`. Follow kind `axis`, key
  `<axis>:<value>`. `AXIS_LABELS` in `search.js` is the only place a slug
  becomes a label - v1's topic name where schema-v2 maps one, and Video
  Games (which v1's Gaming split), Superhero, Romance and Performance for
  the four with none. The
  index's `topics` field holds the four axes' labels, and the synonym scan
  reads them.
- **A work's cast.** A work's page ends with a collapsed "With the cast (N)"
  group: events linked by a credit to the work or anything under it that
  are not already in the list, with photo ops and signings behind a reveal
  of their own. The feed takes about and track only; search has no cast
  section.
- **People.** Where the client read `speakers` it reads `people[]`, and a
  person is followed, counted and linked by id. The name shown is the
  spelling used most under the id, ties to the shortest, then code-unit
  order. Guests are people the listing names (`src: speakers`) on a
  celebrity event, not description-line panelists; panelists are the rest
  with 5+ events. `isCeleb` is unchanged.
- **Adult is audience:** `tags.audience === "mature"`, and the 18+, adult
  and kids query words keep their behaviour. `play` and `facets` get no UI.
- **Search is unchanged:** the synonyms, the query rules and expansions,
  the stopwords, the boosts, prefix and fuzzy matching, the loose
  threshold. The registry's aliases and terms of the about and track works,
  and of the works above them, join the `aliases` field.
- **Stored follows.** A stored follow is kept by its shape, as it is read
  and before any schedule: a slug for a work or a person, `<axis>:<slug>`
  for an axis or audience value, any name for a track. v1's fandom, topic
  and person-by-name follows fall away with no migration, and a follow of
  something with no events stays. `canFollow` asks the loaded schedule when
  the reader acts - a reviewed work, a person or an axis value it carries -
  for `toggleFollow` and `#explore=`, so an unreviewed work is never
  followable (#34).
- **Shipped.** `build/vite-dc.js` copies an allowlist into `dist/data`,
  `data/2026/events.v2.json` alone, which settles #34's copy. The worker's
  `DATA` and shell entry name that file, and its cache goes from v4 to v5.

**Why:** #31's rule that the client sees only resolved data, #36's parity,
#34's "searchable, never followable". An id is forever (#31), so a follow
by id survives a rename where a name does not; a follow judged by its shape
needs no data to be read and outlives a schedule that briefly lacks its
subject.
**Cost:** The Fandom select gains a threshold it did not have: v1 listed
every fandom, 116; it lists the reviewed works with 3+ events, 106 when this
was written. Three reviewed celebrities - chuck-huber, james-saito and
phil-parsons, when this was written - reach celebrity events only through
description lines, so they get no Guests tile until the client reads people
tiers. The file the page fetches is 37% larger: 3,688,074 bytes against the
frozen file's 2,688,886 when this was written, 30% gzipped. v1's fandom,
topic and person follows are dropped, not mapped, and a track follow is
kept. `next` has no users until 2027, but the live site shares its origin
and its storage (#15): a follow saved on `next` drops the live site's
fandom, topic and person follows from the stored list, and one saved on the
live site drops `next`'s work and axis follows. The worker's update notice
keys on `generated_at`, which every rebuild of `events.v2.json` keeps
(ROADMAP, Held).

### 40. Leave-by retired; Tell me is pick-changed and starts-soon; alternatives are same-slot — Decided, not built (2026-09-22) — the slack's initial value, 10, set by #45; data, tuned later
**Decided:** Leave-by is retired: no `leave by <time>` countdown on any
screen, and no leave-by push.
- The plan keeps what is true of the plan rather than the person: a walk
  estimate on a row, and a tight-connection flag between consecutive
  picks in two bands - can't make it, when the gap is shorter than the
  walk, and tight, when it is shorter than the walk plus a small slack.
  Both come from the venues file's walk table (#27), which stays.
- The seating-time use of #6's buffer retires with leave-by. The constant
  survives as the tight-connection slack, its home unchanged: the venues
  file (#27). The code has both bands today, with the slack typed in
  directly; the slack's value is unset until built.
- Tell me is two pushes: your pick changed, from the pipeline's diff
  (#20), and starts soon, when a pick of yours is about to begin. Neither
  needs a location.
- When a pick is cancelled or moved, the alternatives offered are events
  in the same time slot only: the time it vacated.
- Open under Where things live, unscheduled: crew status pings, whose
  build order stays picks → presence → pings (#10), and when the install
  nudge is shown - a standing line on Now, or at the moment it earns
  itself.

**Why:** A countdown assumes where the person is, which #5 forbids the app
to know, and the hotels are close enough that the estimate is false
precision. An alternative fills the hole the change left; a different
slot is a different plan, and search already exists for that.
**Cost:** The client still shows leave-by - on the Now tab's hero card, in
the mini-bar and on the map's next-pick card - until Where things live
reworks the Now tab, so this is a scheduled behaviour change, not a
current one. Starts-soon is a new push type with its own timing rule: how
many minutes before is unset. The walk table's server-side mirror in #27
loses its only consumer until starts-soon or tight connections need it,
so the mirror is kept as designed but no job reads it yet, and none
applies the crowd factor.

### 41. Outreach deferred; the raw row is the seam — Decided, not built (2026-09-22)
**Decided:** The 2027 pipeline is scraper-first. Outreach to Dragon Con
(#19) is deferred, with no date. What lets a feed in later is data, not a
framework:
- `scraper.fetch(season, previous)` returns `(rows, failures)`, the rows
  in #42's raw shape. A feed adapter would be a second module with the
  same function.
- `source_id` is a field apart from `id`, so a feed with stable ids leaves
  #43's matching idle.
- The venue aliases (#45) and the tag cache, keyed by text (#34), do not
  care which source a row came from.
- The workflow's fetch is one command (#48).

**Why:** #19's own reason: guessing at a partner's requirements builds for
users the app will never have. The scrape's limits are the fixed reality,
so the design starts from them.
**Cost:** One boundary and one field. Rate limits, runs of 20m 42s to
33m 00s (median 22m 32s: `docs/pipeline/history-2026.md`, section 8) and
the encoding repair (#44) stay ours.

### 42. The 2027 contract — Decided, not built (2026-09-22)
**Decided:** A year's pipeline files live in `data/<year>/`, one writer
each; `docs/pipeline/contract.md` has the detail.
- `season.json` (by hand, #44), `venues.json` (by hand, #45),
  `source.json` (fetch), `ids.jsonl` (the ids stage, #43),
  `tags.cache.jsonl` (the tag stage, #46), and `events.v2.json`,
  `changes.jsonl` and `last-run.json`, which the orchestrator writes
  together after the diff (#44, #47). `data/registry/` is unchanged:
  cross-year, and still added to by the tag stage's mint.
- **`source.json`** is the fetch's output: one row per listing, keyed by
  `source_id`, before any dedupe, its shape normalised and its content
  not. A row is `source_id`, ten fields - `type`, `title`, `day`, `start`,
  `end`, `duration_min`, `location`, `description`, `tracks`, `speakers` -
  `stale` and `removed`. `location` is verbatim, with no hotel or room
  split (#45). `speakers` is the detail page's Speakers section only,
  never derived from the description; the parse stage owns the
  "Additional Panelists:" line. `track` and `cancelled` were ours all
  along: `track` is build's, the first of the sorted `tracks`, and
  `cancelled` is the parse stage's reading of the title and description,
  its name on the v2 event unchanged. `failures` is a list of
  `{source_id, error}`, and a row whose detail fetch failed is carried
  from the previous file with `stale: true`. A listing the source no
  longer lists is carried forward the same way, with `removed: true` and
  its fields frozen at last sight; the flag clears if the listing
  returns. The file carries no timestamp of its own.
- **`events.v2.json`** is #38's shape plus `digest`, the sha256 of the
  canonical `{works, events}` - no timestamps, no failures - and on each
  event `id` (ours, #43), `source_id`, `stale`, `removed: true` for an
  event the source dropped, kept all season, `was` for the ids merged
  into it (#43), and #45's place fields.
  `generated_at` is `last-run.json`'s `fetched_at`: the schedule is as of
  that fetch, and a `--from` run keeps it. `changed_at` is
  `last-run.json`'s, and moves only when the digest does (#47). `source`
  is `season.json`'s base URL, `count` the length of `events`, and
  `failures` `source.json`'s list.
- The build is a pure function of committed inputs, and never reads its
  own previous output.
- Both files are compact, with a line break before each event object.
- The year is `--year` on the pipeline and `DC_YEAR` at the client build.
  There is no pointer file.

**Why:** History section 3: the two biggest diffs of 2026 were our code,
not the source - the dedupe (v4 → v5: 192 removed, 117 changed) and the
fixes to descriptions and the cancelled flag (v8 → v9: 306 changed). Only
a raw record lets a fix re-derive what came before, and CI has no source.
**Enforced by:** a fresh build from `source.json`, `ids.jsonl`, the
registries, `venues.json`, the cache and `season.json`, its two stamps
read from `last-run.json`, not from the file it checks, equals the
committed `events.v2.json` byte for byte.
**Cost:** Two files of about 3 MB each in every scrape commit. The client
must filter removed events out everywhere but Mine and Now. 2026's
`events.json` and 2027's `source.json` differ in shape, by design.

### 43. Stable ids (builds #7) — Decided, not built (2026-09-22)
**Decided:** An event's id is its source id at first sight, forever. The
ids stage keeps it in a ledger, and every source id resolves through it.
- **Groups.** The ids stage groups rows on `dupe_key`: the normalised
  title, the start and the normalised location. A group takes the id a
  member already has, and at first sight the smallest source id. Every
  member's source id maps to it.
- **A copy that leaves a group** but stays at the source is a new event
  under its own source id, unless that is the group's id: then its id is
  `<source_id>.<n>`, with n counting up from 1 - the one case an id is not
  a bare source id. The group keeps its id in every case.
- **Two ids in one group.** Where two events that already have ids
  collide on a dupe key after a change, the smaller id survives, in string
  order, as the dedupe's `min()` compares. The other line gets
  `merged_into` and `gone_since`, and its event leaves the file. The
  survivor carries `was`, the ids merged into it, from the ledger's
  `merged_into` lines, and the client's pick reconciliation re-points a
  pick whose id is absent but in an event's `was`: a collision is an exact
  dupe-key match, so this is certain in a way the looser matches are not.
  The change log records it as `merged` (#47), and the run summary lists
  the merge UNSURE. 2026 never showed it; it is written down so that
  nothing improvises.
- **One matching rule.** A source id that vanished and one that appeared,
  in the same run or any later run of the season, are one event if and
  only if their dupe keys are equal: the id stays, and `source_id`
  updates. Nothing looser. A looser candidate goes in the run summary,
  UNSURE.
- **The ledger,** `ids.jsonl`: one line per id, sorted - `id`,
  `source_ids` (the source ids that map to it now), `left` (the source ids
  that once mapped to it, each with the id it went to), `dupe_key` at last
  sight, `first_seen`, `gone_since`, and `merged_into` where set; no
  `last_seen`. A source id maps to at most one current id, and resolution
  reads `source_ids` alone. Only the ids stage writes the ledger, and no
  line is deleted in season.
- Cancelled, removed and merged events keep their ids; only the match
  changes a `source_id`. The client uses `source_id` for any link out to
  the source.
- **Fatal:** the ledger absent (it exists, empty, from the season's first
  commit); a source id in two lines' `source_ids`; more than 20% new ids
  in one run after the first.
- **Verification:** a replay of the 34 committed 2026 versions, written as
  a report under `docs/pipeline/`. The two James Callis sessions keep
  their ids across the gap; the Tom Welling, Onesie Wednesday and Mothman
  Trail listings keep theirs; the Salon pair is new; each of the 192
  collapses resolves to one id; nothing else moves.

**Why:** History sections 4 and 5. In 29 scrapes no removed id's content
came back under an id added in the same pair (section 5). The Callis
sessions are the one case the rule serves: gone after v1, back in v9
under new source ids with the same content (section 5). The Salon pair is
the one it refuses: two Hilton listings in the Salon left in v7 as two
arrived at the same starts, under new titles, new source ids and the room
written `Hilton-Salon` (section 4, v6 → v7). Precision over recall.
**Cost:** The Salon pair's picks break. A rule that fires once a con.

### 44. The run — Decided, not built (2026-09-22)
**Decided:** `pipeline.py run --year <year>` runs five stages in order:
fetch writes `source.json`, ids `ids.jsonl` and tag the cache; build makes
`events.v2.json`, and the diff its change lines and `changed_at`; and the
orchestrator writes those with `last-run.json`, together, after the diff,
so no file has two writers.
- **The merge** of a group - the sorted unions, the longest description -
  is one pure function of `source.json` and `ids.jsonl`, and tag and build
  both call it: the tag stage's input is the merged title, type, tracks
  and description. Venues (#45) and parse are pure steps inside build,
  after the merge and before resolution.
- `--from <stage>` starts at any of the five, and a run is idempotent
  after fetch. One stamp a run, taken as it starts and handed down. A run
  that fetches records its stamp in `last-run.json` as `fetched_at`, which
  becomes `events.v2.json`'s `generated_at`; a `--from` run keeps the last
  `fetched_at`. `last-run.json`'s `changed_at` is the diff's (#47). Text
  is repaired inside fetch, before whitespace is collapsed. Build runs
  twice in memory and compares; a mismatch is fatal.
- A run commits only when a committed file's bytes change, its own stamp
  aside. A run with no change leaves the tree clean and reports through
  the job summary.
- **The principle:** degradations are enumerated, and anything else is
  fatal. A fatal run commits nothing and fails the workflow. A degraded run
  commits, and every degradation is a named counter.
- **Fatal.** Fetch: no listings; listings under 80% of the previous
  `source.json`'s, its removed rows aside; over 20% of the detail fetches
  failed; every detail page parsing to an empty title. Ids: #43's three.
  `venues.json` or a registry failing validation. Build: any exception;
  its two builds differing. The diff: the previous `events.v2.json`
  unreadable, unless it is absent and the ledger empty.
- **Degraded.** A failed detail page: carried, stale, named. A listing
  gone: carried, removed, counted. A repaired text. An UNSURE match
  candidate or merge (#43). A hotel no key matches: Other, with the
  unknown-pair walk. A room not resolved: its level, then its hotel (#28).
  The model unreachable, rate-limited or malformed after one retry: those
  events ship untagged, as a cache miss does. A mint that fails: its links
  drop for this run, as an unresolved work name's do. A track
  `tracks.json` lacks: no track axes.
- `last-run.json` holds `fetched_at`, `changed_at` and the summary of the
  last run that committed; a counter above zero becomes a workflow
  warning.
- `season.json` holds the year, the source's slug and base URL, its day
  strings, the con's first and last day, the time zone, the cron window,
  `PROMPT_VERSION` and `frozen` (#46), the thresholds and the request cap.
- The workflow runs Python 3.13 from `requirements.txt`, as CI does.

**Why:** The pipeline runs unattended through con weekend. History section
2, under Failures: in v14 a failed detail page dropped an event - a Tom
Welling session, back in v15 (section 5) - and only the run's log named
it.
**Cost:** The thresholds are set by feel, to be tuned in August. With the
build tolerant, the test that holds 2026's counters at zero is the
off-season guard.

### 45. Venue resolution (builds #21, #27, #28) — Decided, not built (2026-09-22)
**Decided:** `data/2027/venues.json` holds runtime data only, curated by
hand, one copy a year (#27):
- Per hotel: its keys (the prefixes the source writes), `short`, `group`,
  `order`, and `placeless` (Streaming, Other).
- The walk: the matrix verbatim from `src/venues.js`, `same_venue_min` 5,
  `unknown_pair_min` 12, and `slack_min`, #40's name for the buffer, which
  starts at today's 10 - data, tuned later.
- Levels, with their rooms, their aliases (an exact string, case-folded
  and whitespace-collapsed, to room ids) and their notes.
- Drawings live under `data/2027/drawings/`, one file per hotel level,
  keyed by level and room ids. The resolver never reads them.
- **The hotel and room split leaves the scraper.** Build's venues step
  matches the hotel keys longest first and splits at a space, a comma or a
  hyphen - the census's Courtland and hyphen cases (section 6). It sets
  `hotel`, `room` (for display), `level`, `rooms` (ids: the room strings as
  `venues.json` writes them, scoped to the hotel) and `place` = `exact` |
  `rule` | `alias` | `level` | `hotel` | `none`. The ids stage groups on
  title, start and location, before any split.
- **The grammar:** the census's eight combined-string rules (section 2),
  plus doubled, a leading "The", a trailing note (the longest room name as
  a prefix), partitions, hotel only and floor only. A reading counts only
  if every room it names is on one level; else the level, if they agree;
  else nothing. A numeral style is an alias, never a rule. Aliases beat the
  grammar.
- **The Mart:** levels by building and floor - Building 3's floors 1 and
  2, the Mart2 room floor, three vendor-hall floors - and rooms 203A-E and
  204J. Three Mart rules in code: `Mart Building 3, Floor <n>` is that
  level; `Mart2 Vendor Hall Floor <n> …` is that vendor-hall level, level
  only, with the rest - the vendor and booth - kept as the display room;
  `Mart2 <room> …` is that room, with the rest a note.
- `docs/venues/`: the README checklist stays, edited by hand;
  `registry.json` is retired at migration by a one-off script; and
  `tools/room_census.py` is retargeted at `venues.json`, as the off-season
  coverage report. The migration writes `data/2026/venues.json` too,
  identical to 2027's.
- **Validation, fatal:** hotel keys unique across hotels; level ids and
  room ids unique within a hotel; every alias naming rooms on its level;
  every walk pair among hotels that are not placeless present, or the
  default used and listed; the slack present.

**Why:** The room census, `docs/venues/census-2026.md`, sections 0 and 1:
26.9% of the 2026 events match a registry room exactly, 21.0% take a
combined-string rule alone and 10.9% one of the other shapes, and 41.2%
have no reading - 1,015 of those at the Mart.
**Enforced by:** CI loads the committed file and validates it.
**Cost:** A 2026 scraper behaviour changes on purpose. The aliases to
curate are the strings no rule reaches, by events (census section 4). A
copy a year.

### 46. Tagging live (builds #34) — Decided, not built (2026-09-22)
**Decided:** `PROMPT_VERSION` is per year, in `season.json`: 2026 is
pinned at 1, and a season takes no bump.
- `tag seed --from <year>` copies the cache lines whose keys are
  identical, when the versions match.
- On Actions the tag stage calls the API, with `ANTHROPIC_API_KEY` a
  repository secret and a spend cap set in the console; `claude -p` is for
  local runs only. The model is named by full id in code and recorded on
  every cache line.
- Only uncached inputs are sent, and `season.json` caps the requests a run
  makes, 40 by default. A season's first full tag is run by hand, before
  the cron.
- **Untagged is a state:** an event with no tags, counted. The client must
  handle the absence: a grep in the 2027 client switch.
- **Mint as now,** and a minted row gains `minted: {year, run}`, which the
  census reads and resolution ignores. An unreviewed work is searchable,
  never followable, all season. Works are reviewed weekly in August, each
  review a `works-review-N.json` and a data PR; none during the con, one
  after it.
- **People:** the drafter runs by hand, weekly in August, with its fix
  (PR #28) in. An unreviewed person gives no tier.
- **`frozen`** in `season.json` means the year's raw file is write-refused
  and no run targets the year; its derived files are rebuilt only by an
  explicit command, never by a run, and CI holds them fresh. That is how
  2026's `events.v2.json` is rebuilt in the new shape, and its census
  recounted (ROADMAP, PRs 2 and 6). `data/2026/season.json` is frozen,
  with `PROMPT_VERSION` 1. A live year's `events.v2.json` must equal a
  fresh build (#42); its census is not held by CI and runs on demand.
  `tag_events.py`'s hard-coded refusal becomes the flag.
- **Census v2 counts a year's works block** - the works that year's file
  links, and their ancestors - never the whole registry: a count across
  the registry is not a fact about one year. A mint adds rows and edits
  none, so a 2027 mint leaves 2026's derived files as they were; a
  person's registry edit that touches a shared work already rebuilds 2026
  in the same PR (#38).
- A track `tracks.json` lacks degrades (#44), and is listed as owed.
- `anthropic_key.txt` is deleted and its key revoked, by hand, beside PR 2
  (ROADMAP, Checklist).

**Why:** #34's Cost: a retag is not neutral, and the cache, not the model,
is what keeps an event's tags stable.
**Cost:** A description edited at the source is a new input: the event is
tagged again and can change works. The request cap is a guess, to be tuned
in August.

### 47. The change log (builds #20 as narrowed by #40) — Decided, not built (2026-09-22)
**Decided:** `changes.jsonl` is append-only, one line per change to an
event: the run's stamp, the code's SHA, the event's id, the kind, from and
to, and the cause, sorted by run, id and kind.
- **Kinds:** `added`, `removed`, `restored`, `cancelled`, `uncancelled`,
  `merged` (`to`: the survivor's id, #43), `time` (`start`, `end`),
  `place` (`hotel`, `room`), `title`, `people` (sets of ids), `tracks`
  (sets) and `description` (no from or to). Never tags, and never an
  order alone.
- **Cause:** `source` | `code`. When the run's SHA differs from the
  previous run's, the diff stage builds the previous `source.json` with the
  new code, in memory - writing nothing, a cache miss left untagged - and
  splits the diff exactly; otherwise every line is `source`.
- `changed_at` is set here, to the run's stamp, and follows the digest
  (#42): tags are never logged, so a retag moves it with no line.
- A stale carry-forward and a change of group membership make no line;
  two ids merging make a `merged` line, under the id merged away. The
  first run records every event as `added`.
- **Consumers:** the mirror and the push job (Identity and sync). A
  windowed copy for the client is Delivery's.

**Why:** History section 3: of the three biggest diffs, by rows added,
removed or changed, two were ours - the dedupe (v4 → v5) and the
description and cancelled-flag fixes (v8 → v9) - and one was the
source's (v1 → v2). The three `cancelled` flags v9 flipped were a parser
change (section 5), and this attributes such a change to code. A push for
our own bug fix is the failure.
**Enforced by:** fixture tests for every kind, the attribution,
append-only and the order. On the committed files, `last-run.json`
records `changes_logged`: above zero, the log's last stamp equals
`last-run.json`'s `changed_at`, since a run that logs a line has moved
the digest; at zero, it is no later. Every id the log names is in
`events.v2.json`, removed or not, or is a `merged` line's id; and each
commit's log begins with the last commit's, byte for byte.
**Cost:** A typo fixed at the source makes a description line. Thousands
of lines a season.

### 48. Cadence and landing (builds #26) — Decided, not built (2026-09-22)
**Decided:** A run lands by pull request: it commits to a branch, opens a
pull request to the target and enables auto-merge; CI runs; the pull
request merges, and the branch is deleted.
- **The credential:** a fine-grained personal access token for this
  repository (contents and pull requests, write), expiring the month after
  the con, held as a secret: `GITHUB_TOKEN` cannot trigger CI. Not a bypass
  actor, which would land untested with nothing to review; not a data
  branch, because mints live with the code.
- **Supersede:** the next run closes an open bot pull request and branches
  afresh from the target.
- **Branches.** In August the default is `next`, pull requests go to
  `next`, and the dev site shows them. At the freeze `next` merges to
  `main`, the default flips to `main`, and pull requests go to `main`.
  After the con `main` merges back into `next` as a merge commit, so the
  season's history survives, and the default flips back. The target is a
  workflow variable, which the freeze PR flips.
- **Settings, by hand** (ROADMAP, Checklist): "Allow auto-merge" turned on;
  `client` and `pipeline` required on the `main` ruleset before the
  freeze; and the `next` ruleset allowing merge commits beside squash, for
  the merge back. Feature pull requests still squash (#26).
- **The cron** is hourly, `17 * * * *`. A season-window guard exits 0
  outside the window; the concurrency group absorbs an overlap; 403
  pushback fails a run through the 20% rule (#44), and the cron is one
  line to relax. Held as a fallback: a listing-only pre-check.
- **The workflow:** checkout, Python 3.13 and `requirements.txt`, the model
  secret, `pipeline.py run --year 2027`, and one commit-and-PR step. The
  summary is rendered as the job summary, the pull request's body and the
  commit's body, and the degradation counters as warning annotations. A
  fatal run fails the job and commits nothing. `workflow_dispatch` takes a
  force input, which runs past the season window and nothing else: nothing
  overrides a fatal rule. Commits are authored by schedule-bot and pushed
  with the token.

**Why:** History section 8: 18 of 47 cron slots never started, the runs
that did were created 9m 36s to 2h 54m after their slot, and three runs
failed in the step that commits and pushes. #26's gate: `next` and `main`
take pull requests only.
**Cost:** A few tens of pull requests a week; an hourly run with no change
costs nothing, since it commits nothing (#44). About a minute of CI a run.
A token to rotate every year.
