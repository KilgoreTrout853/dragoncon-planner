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

### 3. Tags come from Claude, keyed by event id, preserved across scrapes — Standing (2026); to be superseded by #32 (shape, keying) and #33 (where tags are written); superseded on `next` by #32 and #33, built by #39; `main` keeps it
**Decided:** `tag_events.py` sends untagged events to Claude (Haiku) and
writes `tags` (fandoms, kind, topics, adult, guests) back into `events.json`.
The scraper carries existing tags over by id on each refresh; only new
events get tagged.
**Why:** The fandom picker, kind chips, 18+ filter and search all need
categories the source doesn't provide. Tagging only the delta keeps a
refresh cheap.
**Cost:** Tag quality depends on a prompt and a `CANON` alias map in the
script. A change to the taxonomy means a full `--all` retag.

### 4. Offline by service worker, with three cache strategies — Standing (2026-09-01 backlog → shipped pre-con) — on `next` since #49 the update notice keys on the `digest`, `generated_at` deciding only for a copy without one; the caches are named by year and cleared by the whole name, so the unchanneled worker no longer deletes the next site's `dc26-next-*` caches, which `main`'s frozen worker still does until the freeze replaces it
**Decided:** `sw.js` serves `index.html` network-first with a 3 s timeout,
the schedule cache-first with quiet background revalidation (it only
announces an update when `generated_at` actually changed), and fonts
cache-first forever.
**Why:** Con hotels have terrible signal. The app has to open and render from
cache, but a UI fix should still land when there is signal.
**Cost:** The cache name (`dc26-v4`) is bumped by hand when `index.html` or
`sw.js` changes. Forget the bump and users keep the old page.

### 5. No GPS, no location inference — Standing (2026-09-04) — leave-by half to be retired by #40; no-GPS stands; the leave-by half retired by PR #76
**Decided:** The app never guesses where you are. "Leave by" is shown only
when a pick is on now and the next pick is in a different hotel; otherwise
just the start time and a walk estimate. Manual location chips, home base,
and GPS are all off the table.
**Why:** "Let's not create fake precision." A wrong leave-by is worse than
none.
**Cost:** The Now tab can't warn you if you wandered off between picks.

### 6. Leave-by uses a fixed 10-minute seating buffer; a con day ends at 5 AM — Standing (2026-09-01) — the seating-time half to be retired by #40, the constant kept as the tight-connection slack; the 5 AM day boundary stands; the seating-time half retired by PR #76, the constant `SLACK_MIN`
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

### 8. Identity is anonymous-first — Decided, not built (2026-09-05) — the email step amended by #25 (a six-digit code, not a magic link); to be built by #51, as #50 amends it: no user until the first tap that needs one, and no device key apart from the anonymous user
**Decided:** Every device gets a key with no prompt. An optional email
magic-link upgrade links devices for cross-device sync. Crews need only a
display name. No passwords, no social graph.
**Why:** Most users will arrive by a forwarded link and never meet the
author. Zero friction to first pick, and nothing worth breaching.
**Cost:** Someone who never upgrades and loses their phone loses their plan.
Acceptable.

### 9. Local-first with optional sync; link-based sharing — Decided, not built (2026-09-05) — the conflict rule its Cost left open is #52's: latest stamp wins, per row
**Decided:** The device is the primary store. Sync is an add-on. Sharing and
crews work by link, not by friending. Supabase is the working assumption for
the backend, to be confirmed in step 3a of the plan.
**Why:** The app must keep working with no signal (see #4) and with no
backend at all. A backend that is down should degrade to 2026 behaviour, not
to a blank screen.
**Cost:** A sync/conflict rule (outbox proposed) still has to be designed.

### 10. Crews are coordination, not conversation — Decided, not built (2026-09-05) — its build narrowed for 2027 by #50: create, join, leave, remove, the invite, the overlay and who's going; the Now board deferred to Where things live, share-a-day a link with no backend, pings the spring's; the client's layer built by #56, PR #62: `src/crews.js`, the six actions, the invite link and the readers for the overlay and who's going - the screens Where things live's; its screens placed by #62: the crew Now board a section of Now, one line a crewmate, and in 2027 the overlay Plans' Crew segment of per-person lists, lanes on the reader's timeline open (`docs/screens/contract.md`, sections 2, 5 and 14); the Now board built by PR #81, step 5a, as Now's Your crew right now - a line a crewmate, their pick on now or next today, four and then how many more - and who's going as a line on the event's sheet (`docs/screens/contract.md`, sections 2 and 7, as built); "who's going" said on screen as what a crewmate starred by #68, PR #83: "Starred by", Your crew's picks right now, "yours too"; share-a-day built by PR #85, step 5b, as Share a day in Plans' My day: a day of the reader's picks as a message and a link that needs no backend, the link's shape #69's (`docs/screens/contract.md`, section 5, Share a day, as built)
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

### 12. Every current-time read goes through `now()` with a dev override — Standing (2026-09-07) — one second read, of the real clock, in `src/time.js` under the same exemption, for sync stamps only (#51); built by PR #55 as `wallClock()`
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

### 15. A separate dev site, stamped by a build step — Standing (2026-09-08) — its channel-specific session key extended to every storage key by PR #52 (see #39)
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

### 18. The 2027 vision is planning and coordination; VISION.md holds it — Decided (2026-09-17) — the checkpoint's candidates are `docs/scope-2027.md`'s section 3, in rank order (PR #69); the building view a 2027 commitment, not a stretch (#60)
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

### 21. Venues are pipeline-owned data; the building view is a stretch goal — Decided, not built (2026-09-17) — drawing half superseded by #28; the venues file stands via #27; the file and room resolution to be built by #45; the building view a 2027 commitment by #60, its spring gate lifted and its animation no longer "if at all"
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

### 23. The client is built from `src/` by Vite; single-file output for step 4 — Built (2026-09-17) — TypeScript closed as no by #52
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

### 24. Vitest and pytest; ESLint with two rules (three since 2026-09-19: `no-unused-vars`); Playwright deferred — Built (2026-09-18) — pgTAP for the database, in a `database` CI job, by #52; Playwright may come forward as a standalone pull request before Delivery, by #57; Playwright is to check #66's requirements when it comes; the harness built by #81, PR #101, for layout, its trigger amended: it came with a layout fault, before any change to `sw.js`; its tests of the worker, of offline and of install are still to write
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

### 25. Supabase is the backend — Decided, not built (2026-09-17) — amended by #50: the mirror two tables written after merge by an Actions job, the pipeline writing no Postgres and no venues mirrored; realtime out of 2027, a pull since a watermark instead; sign-in lazy, the bot check the project's setting, off, and the cleanup built; identity by #51, the schema and its security by #52; the email templates can be edited only with custom SMTP, so custom email is a prerequisite of the six-digit code, not an operations item: the dev project sends through Resend's test sender, and production needs a domain verified there (ROADMAP, Checklist); the push sender built by #55 as drawn here: one Edge Function, `push`, which pg_cron calls through pg_net every minute - only while `flags.push_enabled` is true, which the cron job reads itself - its gate a secret header, not the gateway's JWT check; starts-soon by PR #59; the cleanup not yet built - the operations track's first pull request (#57; ROADMAP, tentpole 4)
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

### 26. CI on every PR; `next` becomes PR-only with required checks — Decided, not built (2026-09-17) — built: CI, the required checks, the `next` ruleset, the deploy repo's build command, Dependabot and `.gitattributes`; open: Pages from Actions (Delivery); `scrape.yml`'s PR path decided by #48; a third job, `database`, to be added with the schema (#52), and required on `next` after its first green run (ROADMAP, Checklist); `database` added by PR #54, and required on `next` since its first green run
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

### 27. Walk table, buffer and hotel identity live in the venues file; one shared leave-by formula — Decided, not built (2026-09-17) — by #40 the shared `leaveBy` module becomes the tight-connection helper; the buffer becomes the slack; the walk table's home unchanged; an unknown hotel to degrade to Other rather than fail the run (#44); the file to be built by #45; the client's import built by #49: `virtual:venues`, and `src/venues.js`'s constants gone; the mirror narrowed by #50: no venues in Postgres, and the pipeline writes none; the crowd factor per device, not synced (#50); the tight-connection helper built by PR #76 as `src/walk.js`'s `connection()`, which the hero and the gap line both read
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

### 28. The building view goes to the room: a top-down level view, floor plans as reference — Decided, not built (2026-09-18) — its room resolution to be built by #45, which moves each level's drawing out of the venues file into `data/2027/drawings/`; its level drawings built by #58: one file per level, geometry only, keyed by the venues file's room ids, the Hilton's five levels first; 2026-09-29: round 6 of the sketch is kept at docs/prototypes/ as a record (PR #67). Nothing in the app reads it; the principle stands. The building view is a 2027 commitment by #60, its spring gate lifted. A hotel with level data lifts to its levels when tapped, and one without keeps the hotel sheet (#62; `docs/screens/contract.md`, sections 6 and 8).
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

### 29. Module order and the bus — Standing (2026-09-19) — a fifteenth leaf, `season`, first in the order, and each year's data file importable by the one module that owns it, `virtual:season` by `season` and `virtual:venues` by `venues` (#49); a sixteenth and a seventeenth, `backend` and `identity`, after `build` (#53); an eighteenth, `outbox`, after `time`, and `sync` after the bus (#53); a nineteenth, `crews`, after `identity` (#56); `mine` renamed `plans` in the fifth view's place (#62); `leave` renamed `walk` in its place (#40, PR #76); a module for the sheet's event panel, `eventsheet`, after `scroll` (#74, PR #93)
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

### 30. Tentpoles order the 2027 work — Standing (2026-09-20) — the order after Discover is #37's; a scope pass, a named step that is not a tentpole, takes the design slot after Identity and sync (#57); Where things live opened 2026-09-29 (PR #72), its tabs #62's
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

### 31. Curated registries live in git, cross-year — Decided, not built (2026-09-20) — built: `registry.py` loads and validates all three on every run; works and people reviewed (`docs/discover/works-review-2.json`, `people-review-1.json`); a person gains an optional `known_for`, W42's line, by #61, and a key outside `registry.PERSON_KEYS` is a problem, as one outside `WORK_KEYS` is on a work
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

### 32. Tags v2 — Decided, not built (2026-09-20) — the pipeline half built by #34, which supersedes its line on axes; the client half is PR 6's; its golden-query gate replaced by #36; PR 6 built by #38 and #39, the cast group on a work's page only; its weights do not sync as settings in 2027: For-you's are recomputed from picks and follows, which sync (#50); For you's home is the top of Explore (#62; `docs/screens/contract.md`, section 4); amended by #85
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

### 34. Tags v2 as built: one answer an input, cached as names; the model by full id — Standing (2026-09-21) — its PR 6 items built by #39: the allowlist into `dist/`, and no follow of an unreviewed work; its three build stops (a cache miss, an unresolved name, an unknown track) to become counted degradations, 2026's held at zero by a CI test (#44); `PROMPT_VERSION` to be per year, in `season.json`, and a minted row to record its year and run (#46); the three stops built as counted degradations by Pipeline shape's PR 6, 2026's held at zero by `tests/test_zero_hold.py`; `PROMPT_VERSION` per year, `season.json`'s `prompt_version`, and a minted row's year and run built by Pipeline shape's PR 7a (`contract.md`, The tag stage, as built); an unreviewed work's chip on an event's sheet is no tap, by the same rule, `canFollow()` (#75)
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

### 37. Pipeline shape follows Discover — Standing (2026-09-22) — outreach deferred by #41; search tuning held until the first pass of the whole app (ROADMAP, Held, 2026-09-22); the order after Identity and sync is #57's: the scope pass, then Where things live, Delivery last; the building view's spring condition in its Cost lifted by #60, which makes its screens Where things live's; Where things live opened 2026-09-29, its tabs #62's
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

### 38. The v2 file carries a works block — Standing (2026-09-22) — a `people` block beside it, between `works` and `events`, on this entry's pattern, by #61
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

### 39. The client switch as built — Standing (2026-09-22) — by year since #49: the file is `DC_YEAR`'s, and every storage key carries the year, so a build for 2027 starts with no picks, follows or settings of 2026's, by design; the update notice keys on the `digest`; its Cost's shared storage closed by PR #52: every storage key carries the channel, `storageKey()` in `src/build.js`; amended by #85
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

### 40. Leave-by retired; Tell me is pick-changed and starts-soon; alternatives are same-slot — Decided, not built (2026-09-22) — the slack's initial value, 10, set by #45; data, tuned later; the client reads it from the venues file, and the tight band reads it rather than a typed-in 10 (#49); the two-table mirror drops the walk table (#50); starts-soon uses one lead time, set in the push job's call (#50); the lead time is 15 minutes, one constant in `push_due()` (#55); its client half - no leave-by on the hero, the mini-bar or the map card, the slack renamed `SLACK_MIN`, `leave.js` renamed `walk.js` and `currentLocation()` deleted, so that the app no longer says where the reader is - to be built by PR 3 of Where things live's sequence (ROADMAP, tentpole 5; `docs/screens/contract.md`, section 12); when the install nudge shows decided by #65; its client half built by PR #76: no leave-by on the hero, the mini-bar or the map card - the hero says the walk to the next pick and the band `walk.js` `connection()` gives the pair, as the gap line between their rows does - `SLACK_MIN`, `walk.js`, and `currentLocation()` deleted, so the app no longer says where the reader is (`docs/screens/contract.md`, sections 2 and 12, as built); the gap line no longer says an overlap, the two rows' flags do (#73)
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

### 41. Outreach deferred; the raw row is the seam — Decided, not built (2026-09-22) — fetch built by PR 3; returns a result object, `contract.md` names its fields
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

### 42. The 2027 contract — Decided, not built (2026-09-22) — `events.v2.json` built by PR 6, 2026's rebuilt in its shape: the digest is the sha256 of the works and the events written exactly as the file writes them, one serialisation, not a canonical sorted-key JSON; a line break before each works row too; a frozen year's `failures` stays a count (`contract.md`, The v2 file); the year is its season file, `pipeline.py run --season`, not `--year` (PR 8); the client's half built by #49: `DC_YEAR` at its build, a removed event shown in Mine alone - not in Now, as the Cost had it - and a pick re-pointed through `was`; the digest takes #61's `people` block too, between the works and the events
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

### 43. Stable ids (builds #7) — Decided, not built (2026-09-22) — an event's `source_id` is its supplying row's, so it also moves when that row is removed and another is not (`docs/pipeline/contract.md`, The merge); the ids stage built by PR 4: its rules and the ledger's keys as built are `contract.md`'s, a split decided by membership, then key
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

### 44. The run — Decided, not built (2026-09-22) — a room placed at its level is by design, not a degradation, and the zero hold on 2026's build covers the tag and track counters alone, the venue counters reported, never held (`contract.md`, `last-run.json`); the build tolerates, built by PR 6: a cache miss ships the event untagged, an unresolved work name drops its link and a track `tracks.json` lacks keeps its name with no axes, each counted in the build's report, and `tests/test_zero_hold.py` is the zero hold (`contract.md`, The build, as built); the run built by PR 8, `pipeline.py` (`contract.md`, The run, as built): `run --season`, not `--year`; `--from` the ids stage, the tag stage or the build, and `--to` the fetch, the ids stage or the tag stage; every file written by the orchestrator at the end of a run, all or nothing; the build's second run through the live front door, on the texts about to be written; the previous `events.v2.json` absent never fatal, a season's first run stopping after the ids stage; a fault counter above zero a warning annotation, a curation counter - rooms unresolved, listings gone, texts repaired - a notice; by PR #58, a `--from` run keeps the committed `fetch_code_hash` too, as it keeps `fetched_at`, and records `fetch_code_changed` false (`contract.md`, `last-run.json`), and a `--to` run that fetches is fatal once the year's `events.v2.json` exists, since it would move `source.json` past that file and the next run's diff could not tell the source's changes from the code's - a season's first run, to the ids stage, comes before it (`contract.md`, The run, as built)
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

### 45. Venue resolution (builds #21, #27, #28) — Decided, not built (2026-09-22) — built by PR 5: `venues_stage.py`, the split, the grammar and the report as `contract.md` has them; its drawings built by #58: `data/<year>/drawings/<hotel>-<level>.json`, geometry only, keyed by level and room ids; a level gains `storey` and `short` by #72
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

### 46. Tagging live (builds #34) — Decided, not built (2026-09-22) — untagged built by PR 6: an event with no cached answer carries no `tags` key, and the build's report lists it (`contract.md`, The v2 file); the tag stage built by PR 7a: a season read through the build's front door and the merge, `prompt_version` from `season.json`, seed, the request cap, the frozen refusal and `minted` (`contract.md`, The tag stage, as built); the frozen flag is the tag stage's, and `tag_events.py` keeps its path check as legacy
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

### 47. The change log (builds #20 as narrowed by #40) — Decided, not built (2026-09-22) — built by PR 7b: `diff_stage.py`, the attribution built by the caller (`events_v2.attribution()`) from the snapshot of the previous files, one cause per id and kind, `source` winning where the code and the source both changed it; `merged` read from the survivors' `was`, the diff reading no ledger, and the snapshot's fatal rule the orchestrator's; `people` and `tracks` compared as sets, `from` and `to` sorted; the prefix check PR 8's workflow step; the attribution sees the build's code and data, not the fetch's, and `last-run.json`'s `fetch_code_changed` is PR 8's (`contract.md`, The diff, as built); the prefix check built by PR 8 as the orchestrator's, where it writes, and `fetch_code_changed` by a hash of the fetch's code, not a git diff (`contract.md`, `last-run.json`); its consumer, since #54, the mirror job and then the push job, which reads the flag per line: a line of the run `last-run.json` describes takes its flag, and a line of an earlier run the mirror had not yet written is written `true`; and the flag is the committing run's, not the fetching run's, until a pipeline pull request of its own moves it (#54; ROADMAP, Flags); moved by PR #58: a run that does not fetch keeps the committed `fetch_code_hash`, as it keeps `fetched_at`, and records the flag `false`, so a fetching run's flag compares its code with the last fetching run's; and a `--to` run that fetches is refused once the year's `events.v2.json` exists (#44), so the attribution's previous rows are always those the committed file was built from (`contract.md`, `last-run.json`); the push job is to send pick-changed for a `source` line of a run whose flag is false alone: a `code` line is suppressed too (#55, PR B); that consumer built by PR #60: `push_due()` reads each line's cause and its run's flag, and sends nothing for a `code` line or a flagged run's (`contract.md`, section 7, Pick-changed, as built)
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

### 48. Cadence and landing (builds #26) — Decided, not built (2026-09-22) — built by PR 8, `.github/workflows/scrape.yml` (`contract.md`, The run, as built): `pipeline.py run --season`, not `--year`; the target the repository variable `SCRAPE_TARGET`, flipped by hand with the default branch (ROADMAP, Checklist), not by the freeze PR; a run checks the target out; its commits authored as schedule-bot with the token owner's noreply address, which GitHub attributes to that account, so the rulesets' extra approval for unattributed changes does not hold them; a fault counter a warning annotation, a curation counter a notice
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

### 49. The client switch, by year — Standing (2026-09-24) — `LEAVE_BUFFER_MIN` to be renamed `SLACK_MIN` by PR 3 of Where things live's sequence (#40; `docs/screens/contract.md`, section 12); renamed by PR #76; since PR #77 a removed event can be unstarred, never starred anew - its star hidden and disabled, on a row and in its sheet, for a reader who has not picked it - and a crewmate's removed pick is drawn, marked, in Plans' crew's day (`docs/screens/contract.md`, section 5, as built)
**Decided:** The client is built for one year, `DC_YEAR`'s (#42), and
reads that year's contract: its `events.v2.json`, and at build its
`season.json` and `venues.json`. Plumbing and parity, as #39 was;
`docs/pipeline/contract.md` has the file.
- **The year.** `DC_YEAR` at the build, four digits, 2026 where it is
  unset, or the build refuses. `build/vite-dc.js`'s `dcYear()` defines
  `__DC_YEAR__`, which `src/season.js` - first in the order (#29) - reads
  as `YEAR`. `DATA_URL` is built from it, and `dcBuild()` copies that
  year's `events.v2.json` alone into `dist/` and refuses a year with none.
  2026 stays the year copied and read until the checklist sets `DC_YEAR`
  where each site is built (ROADMAP, Checklist).
- **The season and venues files are modules.** `virtual:season` and
  `virtual:venues` resolve to the year's two files, inlined at build like
  any import (#27): no fetch, offline by construction. The build refuses a
  year whose two files are missing, or whose `season.json` names another
  year. `CON`'s days are `season.con`'s, and its bounds keep 2026's
  observed 18:00 and 19:00 until `season.json` holds a year's own. Every
  other 2026 date the client held is derived from the days: their names,
  the preview, the default day, the day words, the calendar export's names.
  The hotels - their order, short names, groups and colours - the walk, the
  same-venue and unknown-pair minutes and the slack are the venues file's,
  and the constants are gone. `LEAVE_BUFFER_MIN` keeps its name until Where
  things live, and the tight band reads it (#40).
- **Keys by year.** Every storage key is `dc<yy>.`, settings and all, and
  the worker's caches `dc<yy>-`: a build for a new year starts with
  nothing of the last one's.
- **Removed.** An event with `removed` is in `byId` and in nothing drawn
  from the schedule: search, Browse, Explore, the feeds, Now and the map see
  only the rest. A pick on one stays a pick. Mine draws it where its time
  puts it, marked removed from the schedule, with no gap line or walk link
  to or from it; its event sheet marks it as a cancelled event is marked;
  the pick news says so once; the calendar takes it by neither door, Mine's
  export or its sheet. Everywhere but Mine, where #42's Cost and
  `contract.md` had Mine and Now.
- **Was.** A pick whose id is absent but in an event's `was` moves to that
  event, and the news says it is now listed under that title (#43).
- **Untagged.** Every read of an event's tags goes through `tagsOf()`,
  which gives one empty set where the key is absent (#46): an untagged
  event is found by its text, shows in Now, Browse and Mine, and is under
  no work, axis or guests tile.
- **The worker.** `public/sw.js` builds its data file, its shell's entry
  and its cache names from a stamped `YEAR`, as from `CHANNEL`; the cache
  is v6, and an unstamped worker is `public/sw.js` still. It tells the
  page of a new schedule when the `digest` moves (#42), `generated_at`
  deciding only where a copy has none, and `loading.js`'s own check, with
  no worker, asks the same. On activate it deletes its site's caches of
  every year, by the whole name, so the unchanneled worker no longer
  deletes the next site's; `main`'s frozen worker still does, until the
  freeze replaces it.
- **The page's name.** For a year that is not 2026 the build stamps the
  year into the head, the brand on Now and the manifest; the default build
  is byte for byte what it was.

**Why:** #42: the year is `DC_YEAR` at the client build, and there is no
pointer file. #27: the venues file is inlined at build, one copy a year.
#46: untagged is a state the client handles. #43: re-pointing a pick
through `was` is certain. #39's Cost: the notice keyed on `generated_at`,
which a rebuild keeps.
**Cost:** A build for 2027 starts empty - no picks, follows or settings of
2026's - by design (#39's note). The flip is a checklist line, and it waits
for the season's first run past the ids stage, since a year with no
`events.v2.json` does not build. The worker's digest comparison is Pipeline
shape's input to Delivery (ROADMAP, Held), taken here, and v6 is a new
worker for every installed client. The page carries the whole venues file,
8,336 bytes before gzip, of which it reads about a thousand; Places will
read the rest. 18:00 and 19:00 are a guess for 2027 until its schedule
shows. The icons draw 2026 in their pixels, which no stamp reaches
(ROADMAP, Checklist).

### 50. Identity and sync, reassessed: five narrowings — Standing (2026-09-25) — the captcha widget deferred by #53: a plain message until the project turns the captcha on; the mirror built by #54: `mirror.yml`, on a push that changes a year's three files, hourly in the season's window and by hand, under the `dev` or the `production` Environment; the push job's first pull request built by #55, PR #59: starts-soon, queue-shaped, the kill switch read by the cron job, by `push_due()` and by the function; crews' client layer built by #56, PR #62: `src/crews.js`, with no screen - the screens are Where things live's; the tentpole built by PRs #51-#62, and the operations track trailing - the cleanup of stale anonymous users its first pull request - its list in ROADMAP, tentpole 4; the crew screens' home is Plans, crew a dimension of every tab (#62); in 2027 the overlay is Plans' Crew segment of per-person lists, and lanes on the reader's timeline are open (`docs/screens/contract.md`, sections 5 and 14)
**Decided:** Identity and sync is built smaller than #8, #10, #25 and #27
drew it; `docs/sync/contract.md` has the design.
- **The mirror** is two tables, `schedule_events` and `schedule_changes`,
  written after a scrape's pull request merges, by a job of its own on
  Actions. The pipeline never learns Supabase exists and writes no
  Postgres; venues are not mirrored, and the walk table #40 kept in the
  mirror goes with them (amends #25 and #27).
- **Realtime is out of 2027.** The client pulls what changed since its
  watermark instead (amends #25). Realtime is a spring question, with
  crew pings.
- **Crews** are create, join, leave, remove, regenerate the invite, the
  overlay of crewmates' picks and who's going. The crew Now board goes to
  Where things live, share-a-day is a link that needs no backend, and
  pings are the spring's: #10's build for 2027 narrowed, not its scope.
- **A pick is a row.** One row per pick and per follow, latest stamp
  wins; the local lists are never synced as they stand (#52). Settings do
  not sync in 2027: the crowd factor is per device, and For-you's weights
  are recomputed from picks and follows, which sync (amends #27 and #32).
- **Sign-in is lazy.** No server user until the first tap that needs
  one, and no separate device key: the anonymous user is the device. The
  bot check is the Supabase project's setting, left off, and the client
  wires its widget. The periodic cleanup of stale anonymous users is
  built (amends #8 and #25; the detail is #51's).
- The push job is queue-shaped from its first pull request, which carries
  the kill switch. Starts-soon uses one lead time, set in the push job's
  call (#40).
- Keep means recovery - a wiped or replaced phone gets its plan back by
  email (#51) - not two devices kept in step.
- Operations - the production project, the workflow that migrates it,
  its plan and backups, and the dev project's keep-alive (#25) - is a
  track inside this tentpole, run beside the rest and gating none of it.
  It is not a tentpole; #30 stands.

**Why:** One developer (VISION, Risks worth naming): what can wait for
spring, or needs no backend, leaves the first build. The recon
(`docs/sync/recon.md`, section 3) found every pick and every follow
written by one whole-state save, so one row per item, stamped, is the
smallest shape that syncs them. A mirror written after the merge keeps
the backend off the path of the pipeline, which has to run unattended
through con weekend.
**Cost:** Two phones signed in as one user agree only by stamps: two taps
seconds apart land in stamp order. Crew presence, pings and realtime wait
for spring, and the mirror trails a scrape by its merge. The crowd factor
is set again on each device.

### 51. Identity: lazy, anonymous, recovered by email — Decided, not built (2026-09-25) — built by PR #55 but for recover's union, which is sync's (#53): `src/backend.js`, `src/identity.js` and the email step in Settings (`docs/sync/contract.md`, section 1, as built); the widget amended by #53, a plain message until the project turns the captcha on; recover's union built by PR #56, as sync's change of owner (`contract.md`, section 5, as built)
**Decided:** #8 as #25 and #50 amend it; `docs/sync/contract.md`,
section 1, has the detail.
- No server user until the first tap that needs one: joining or creating
  a crew, turning on notifications, or entering an email. A star, a
  follow and every screen work with no session, no network and no
  backend (#9).
- The anonymous user is the device, minted by Supabase's anonymous
  sign-in; there is no separate device key. A captcha is the project's
  setting, off, and the client shows the widget when sign-in is refused.
- The email step is one screen, one field and a six-digit code (#25).
  **Add:** an anonymous user gains the email in place, keeping its id,
  picks, follows, memberships and subscription. **Recover:** the email
  already belongs to a user, and the phone signs in as that user - how a
  wiped or replaced phone gets its plan back. The phone's local picks and
  follows go up as adds stamped now: the union. A recovering phone that
  was anonymous and in a crew leaves that membership and subscription
  behind; the person rejoins by the link and turns notifications on
  again. Documented, not built.
- Two signed-in devices: latest stamp wins, and nothing more.
- Stamps read the real clock, never `now()`: one read, in `src/time.js`
  under the lint's exemption, for sync stamps only (#12).
- The session is kept under `storageKey("session")`, per year and per
  channel like every key (#39's note), so an email user types one code a
  year.
- Two rules every later screen inherits: a star or a follow never waits
  on the network; a crew or notification action that needs the network
  fails visibly and leaves local state untouched.

**Why:** VISION's first rung: useful in ten seconds, with no account and
no prompt. A user minted at the first tap that needs one is someone who
chose to coordinate or to be told, not every visitor. Recovery is the one
thing #25's Cost leaves an email user, and the reason the step exists.
**Cost:** Someone who never enters an email and loses the phone loses the
plan (#8). A recovering phone's crew membership stays behind until the
person rejoins. A stamp ignores the simulated clock, so a test under
`?now=` stamps the real time.

### 52. The data model and security — Decided, not built (2026-09-25) — built by PR #54: `supabase/migrations/20260925154849_sync_schema.sql`, the seed, nine pgTAP files and the `database` CI job (`docs/sync/contract.md`, sections 2-4, as built); PR #56's migration adds `synced_at`, the caller as a row's user by default, and an update of the key columns, which PostgREST's upsert needs, with a trigger that keeps every key as it is (`contract.md`, sections 2 and 3, as built); the mirror job's migration (#54) makes `schedule_events.start` and `end` nullable, as the file's may be, and grants `service_role` the mirror's three tables by name; and a line's `fetch_code_changed` is its run's from `last-run.json`, or `true` for an earlier run the mirror had not yet written (`contract.md`, section 6); the push job's migration (#55) makes `push_sent` a queue - `sent_at` nullable with no default, a row without it a claim, and `claimed_at` - and grants `service_role` select, insert, update and delete on `push_sent`, select and delete on `push_subscriptions`, select on `flags`, and `push_due()`'s execution, by name (`contract.md`, section 7); pick-changed's migration (#55) replaces `push_due()`, its grants made again as they were, and changes no table (`contract.md`, section 7, Pick-changed, as built); the batch's migration (#55) replaces it in place, by `create or replace`, which keeps its grants, and changes no table (`contract.md`, section 7, The batch, as built); the RPCs' errors reach the client as PostgREST answers them - `P0002` and `53400` 500, `42501` 403, `22023` and `23514` 400 - and a delete that row-level security turns away answers 204, as one that deletes does; the policies let a creator delete their own membership, and `creator` stays set, so a creator who left could still regenerate the invite from outside, though not remove anyone or delete the crew, and the client refuses the creator's leave (#56; `contract.md`, section 8, as built); "a star means going" amended by #68: a star is a pick, and the crew screens say what a crewmate starred, never that they are going or where they are
**Decided:** Ten tables in Supabase's Postgres, row-level security on
every one, and three RPCs; `docs/sync/contract.md`, sections 2-4, has the
columns, the policies and the tests.
- `picks` and `follows`: one row per item, per user and year, with
  `changed_at`; unstarring and unfollowing write a tombstone with a newer
  stamp, never a delete. Two tables of one shape because crewmates may
  read picks and never follows: the boundary is structural.
- Latest stamp wins, enforced by a trigger in the database, not by a
  client clause; a stamp is the client's real clock (#51), clamped by a
  trigger to the server's time plus five minutes. It is #9's conflict
  rule.
- `crews` and `crew_members`: the display name, 1 to 24 characters, is on
  the membership, and the user row holds nothing personal (#8). A star
  means going; there is no maybe. `push_subscriptions`: one row per
  browser endpoint.
- The mirror's `schedule_events`, `start` and `end` as `timestamptz` in
  the con's zone, and `schedule_changes`, the change log's line as it is
  with its run's `fetch_code_changed`. The mirror always mirrors;
  suppression is the push job's, by that flag. `push_sent`, the push
  job's idempotence ledger; `mirror_state`, one row per year; `flags`:
  `push_enabled`, the kill switch, and `crew_size_cap`.
- Every table that holds a year's plan carries `year`. Every foreign key
  to a user cascades on delete, but `crews.creator`, which is set null: a
  crew outlives its creator, whose actions then lapse. The cleanup deletes
  a stale anonymous user only if it is in no crew and holds no
  subscription.
- The five job tables have no client access at all.
- Row-level security on every table, policies for the signed-in role
  alone; the anon role has none, and its default grants are revoked.
  `is_crew_member(crew_id)`, a security-definer helper with a pinned
  search path, serves the policies on `crews`, `crew_members` and
  `picks`, because a policy on `crew_members` that reads `crew_members`
  recurses. Reads are by policy, not by function.
- Three RPCs, for what a plain write cannot do: `create_crew`,
  `join_crew` and `regenerate_invite`. Everything else is a plain write
  the policies judge.
- The tests: pgTAP under `supabase/tests/`, run by the Supabase CLI
  against a local database in a third CI job, `database`, which becomes
  a required check on `next` after its first green run. They exist before
  any crew screen.
- Migrations: `supabase/migrations/`, numbered SQL, one a pull request,
  never edited once merged, and `supabase/seed.sql`. Dev takes them by
  hand after each merge, production by a workflow in the operations
  track (#50).
- No TypeScript: #23 left it to this step, and ten small tables whose
  shapes live in the contract do not earn it.

**Why:** Row-level security mistakes are silent (#25), so the policies
are named and tested before any screen leans on them. A trigger judges
every write the same way, whoever sends it. Picks and follows in
separate tables make "crewmates see picks, never follows" a table's
boundary, not a clause one query could forget.
**Cost:** A tombstone for every unstar, so the tables only grow in a
season. The RPCs, the helper and the triggers are SQL to keep beside the
Python and the JavaScript; pgTAP is a third test framework beside Vitest
and pytest, and `database` one more job on every pull request. A crew
whose creator is gone can no longer regenerate its invite or remove
anyone.

### 53. The fetch layer, the captcha, and the sync rules — Decided, not built (2026-09-25) — the fetch layer and the captcha's plain message built by PR #55: `src/backend.js`, `src/identity.js` and the email step in Settings (`docs/sync/contract.md`, section 1, as built); the sync rules built by PR #56: `src/outbox.js`, `src/sync.js` and a second migration, the watermark stopping at a row a pending op holds (`contract.md`, section 5, as built); two triggers more since PR #77 - a tap on the Plans tab and a tap on its Crew segment - and a crew action's run, for which the crew panel waits for a run that began after the action (`syncAfter()`); and a redraw when what a crew screen draws has changed, asked only while Plans or the crew panel is on screen, since a redraw rebuilds Explore's filter box (`contract.md`, section 5, as built); that redraw widened by PR #81 to Now and the Map as the tab and an event's sheet open over any, whose who's-going line it refills in place - never Search or Explore alone (`contract.md`, section 5, as built); the gate lifted by #80, PR #100: Explore's filter box is built once, so that redraw is asked on any tab, Search and Explore among them (`contract.md`, section 5, as built)
**Decided:** How the client talks to the backend, what it says when a
captcha is demanded, and how it will move picks and follows;
`docs/sync/contract.md` has the detail, in section 1, as built, and
section 5.
- **The fetch layer has no dependency.** The client talks to Supabase by
  `fetch`: the Auth endpoints now, PostgREST from the sync PR. Every
  request goes through one module, `src/backend.js`, which keeps the
  session too; `src/identity.js` holds `ensureUser()` and the email step.
  Both stand after `build` in #29's order. `dist/index.html`, measured on
  `next` at 9fd43ab, raw and gzipped, in bytes:
  - as it stood: 140,382 and 45,113;
  - with `@supabase/supabase-js` 2.117.2: 355,648 and 99,543, up 153% and
    121%;
  - with `@supabase/auth-js` and `@supabase/postgrest-js` 2.117.2:
    257,604 and 72,772, up 84% and 61% - `auth-js` alone, 240,811 and
    67,864;
  - by `fetch`: 142,528 and 46,107, up 1.5% and 2.2%.

  The session is read from storage at every use; refreshed only when the
  server refuses its token, never by the clock, so `wallClock()` stays
  for stamps; one refresh in flight a tab; and dropped only when the
  refresh itself is refused. **Revisit:** if the fetch layer outgrows
  about two hundred lines across the sync and crew PRs, the two libraries
  are reconsidered.
- **No captcha widget** until the project turns the captcha on (amends
  #50 and #51): a refusal for want of one is a plain message. A widget is
  its own pull request, when abuse calls for it.
- **The sync rules** (contract, section 5). Picks and follows sync, one's
  own rows both ways, and nothing else. The doors are `savePicks()` and
  `saveFollows()`, which diff against a retained copy into an outbox - a
  map by table and key, one op per changed key, stamped by `wallClock()`,
  coalescing to the latest; with no session there is no outbox. At mint,
  and so at recover, the whole local state goes up as adds. The drain is
  one upsert per table, the trigger judges each row, and a failure is
  kept and retried with backoff up to five minutes: nothing is dropped.
  The pull is one query per table for rows newer than its watermark,
  `storageKey("syncStamp")`, on a server-written stamp, `synced_at`, set
  by a trigger on insert and update and read with a small overlap; latest
  stamp wins still judges by `changed_at`. The pull applies one's own
  rows unless an op is pending for the key, keeps crewmates' picks under
  `storageKey("crewPicks")`, refreshes the member list and drops departed
  members' picks. It runs on open, on `visibilitychange` and `pageshow`
  ungated, on `online` and `schedule-online`, and after a drain; there is
  no timer. The sync PR carries the migration: `synced_at` on `picks` and
  `follows`, an index by user and `synced_at`, the trigger, and the
  behavioural test that clamps a follow's stamp, which PR #54 left to the
  structure test.

**Why:** The page loads over con Wi-Fi, and the libraries' weight is
almost all code this app never calls: the Auth client's constructor
binds MFA, WebAuthn, passkeys, an OAuth server and recovery codes, which
no bundler can drop, where the app makes six plain requests. The refresh,
the one part worth a library, is kept small by design, and a test pins
every request. The captcha is off (#50), so a widget would be code that
never runs. A pull by `changed_at` misses a change drained late: a phone
offline from 10:00 to 14:00 stamps its star 10:00, and a crewmate who
pulled at noon holds a watermark past it - and hours offline in a hotel
basement are the con's normal case.
**Cost:** The refresh is ours to keep: cross-tab coordination, retry with
backoff and whatever the Auth API changes next, which a library would
have followed for us. Two tabs refreshing one token more than ten seconds
apart lose the session to the server's reuse detection. A captcha turned
on in a hurry waits for a pull request. Two tabs of one phone: the last
save wins, accepted for 2027. The sync PR has one more migration to
write and test.

### 54. The mirror job — Decided, not built (2026-09-25) — built by PR #57; its flag's source moved by PR #58, as its last bullet had it: a `--from` run keeps the committed `fetch_code_hash` and records `false`, and a `--to` run that fetches is refused once the year's `events.v2.json` exists (#44), so only a fetching run - a full run, or a season's first, to the ids stage - records a new hash and the flag; `mirror_state` is to gain `tz`, the con's zone, which the mirror is to write, for pick-changed's times (#55, PR B); `tz` not added: pick-changed says the change log's wall-clock strings as they are and shows no `timestamptz`, so it needs no zone - the column is the extension if a push ever shows one (#55, PR #60)
**Decided:** A job of its own on Actions copies a year's committed
schedule into `schedule_events`, `schedule_changes` and `mirror_state`
(#50); `docs/sync/contract.md`, section 6, has the detail.
- **The trigger.** `.github/workflows/mirror.yml`: a push to `next` or
  `main` that changes a year's `events.v2.json`, `changes.jsonl` or
  `last-run.json`; hourly at `47 * * * *`, inside the season's window
  alone, so a failed mirror heals within the hour during the con; and by
  hand, naming a season. Not `workflow_run`: Scrape ends when it opens its
  pull request, and auto-merge lands it later. `next` and `main` alone,
  each checked out as it stands, so a re-run mirrors the head; one run at a
  time for a project and a season; the Environment `production` on `main`
  and `dev` otherwise, recording no deployment.
- **The transport.** `mirror.py`: Python, `requests` over PostgREST as the
  service role, and no new dependency. An `sb_secret_` key goes on `apikey`
  alone, a legacy JWT as the bearer too; the key is checked before any
  request and never printed. Every write is strict and counted.
- **The writes.** The watermark read first; the events upserted, and those
  the file no longer holds deleted - in a live year only an id a `merged`
  line names; the lines after the watermark; the watermark written last.
  The table equals the file. No transaction: each step is idempotent. A
  commit older than the one last mirrored writes nothing. A connection
  lost, a 429 or a 5xx is tried three times in all.
- **The flag.** A line of the run `last-run.json` describes takes its
  `fetch_code_changed`; a line of an earlier run the mirror had not yet
  written is written `true`, and a warning names the run. The change lines
  are upserted with merge-duplicates, not inserted ignoring duplicates:
  the lines after the watermark are sent together, so a run's lines carry
  one flag, which only moves from `false` to `true`. The push job reads the
  flag per line.
- **Nulls.** A third migration makes `schedule_events.start` and `end`
  nullable, and the mirror writes a null time as the file has it. The push
  job sends no starts-soon for an event with no start.
- **The grants.** The same migration grants `service_role` select, insert,
  update and delete on `schedule_events`, `schedule_changes` and
  `mirror_state`, by name, so a production project gets them by migration,
  not by its defaults. `supabase/config.toml` turns the local database's
  defaults off, `auto_expose_new_tables = false`, so `00_structure` pins
  the migration's grants, not the defaults.
- **The flag's source.** The flag is the committing run's, not the
  fetching run's (`pipeline.py`): a committed `--from` or `--to` run takes
  it from the next run that fetches. A pipeline pull request of its own
  follows this one: a `--from` run keeps the committed `fetch_code_hash`,
  as it keeps `fetched_at`, so only a fetching run records a new hash and
  the flag (ROADMAP, Flags).

**Why:** #50: the mirror stays off the path of the pipeline, which runs
unattended through con weekend, and off the site's. A time kept from
before would make a starts-soon push at a time the source no longer
states, the wrong push #47 exists to prevent, so the table holds the
file's null. With duplicates ignored, a run half written and completed
after the next scrape landed would carry `false` and `true` at once. A
re-run of an old job on its own commit, after a newer one had written its
events but not the watermark, would take the tables back; the head cannot.
Supabase's API keys guide sends a secret key on `apikey`, not as a bearer.
A project made since 2026-05-30 grants a new table to no Data API role,
`service_role` included, so a grant left to the defaults would fail the
first mirror on production; and with the local defaults on, a test could
not tell the migration's grant from them.
**Cost:** A run the mirror did not write while `last-run.json` described it
is flagged, and its pick-changed pushes suppressed: after a failed mirror
completed late, and every earlier run of the season at a project's first
mirror - production's, at the freeze. One more workflow, an hourly job in
the season, a third migration, and two Environments' variable and secret
to keep. The local database no longer grants a new table to the Data API
roles by default, so every later migration's table is granted by name, or
reaches no role, locally as on production. The fake PostgREST is the only
automated check of the requests, since CI's `database` job runs no
PostgREST; it was checked against the real one by hand.

### 55. The push job — Decided, not built (2026-09-26) — starts-soon built by PR #59; pick-changed, PR B, to follow; pick-changed built by PR #60: `push_due()` replaced by a fifth migration, both kinds claimed by one statement, the six kinds told, a `code` line and a flagged run's suppressed, the horizon six hours back to `at`, and the sender's fold per user and run, its words said from the change log's wall-clock strings; `mirror_state.tz`, decided for those words, found unneeded and not added - nothing a push shows is a `timestamptz`, and the column is the extension if one ever does; and the rehearsal, `tools/replay_changes_2026.py`, 2026's change log rebuilt for a project's `schedule_changes` (`contract.md`, section 7, Pick-changed, as built); the batch built by PR #61: a sixth migration, `push_due()` claiming no more than PostgREST's answer of 1,000 rows can return - whole pushes, starts-soon first, up to 200 rows or one push a call - and the sender asking again until a call comes back empty, two batches a run at most, as the encoder's CPU measured on the hosted runtime allows, and no call after the first past 20 seconds; a push no browser took released when the run ends, so that it is retried the next minute and not the next batch (`contract.md`, section 7, The batch, as built)
**Decided:** The push job runs inside the Supabase project, as #25 drew
it: pg_cron calls one Edge Function, `push`, through pg_net, every minute,
and a SQL function decides what is due while the function sends it.
Queue-shaped from its first pull request, which carries the kill switch
(#50); `docs/sync/contract.md`, section 7, has the detail.
- **Not a third Actions job.** GitHub documents its schedule event as best
  effort - delayed under load, a five-minute floor, runs dropped - and its
  terms name a serverless application run on Actions as a disproportionate
  burden. The mirror is a publish step and stays on Actions (#54); a
  sender on the minute is a runtime service.
- **The split.** `push_due()`, in SQL, decides and claims; the function
  sends. The logic lives where pgTAP is.
- **The queue.** `push_sent` holds a claim per user, kind and key, its
  `sent_at` null until sent, and `claimed_at`. `push_due()` claims by an
  insert that skips a key already held, and returns what it claimed, so
  two runs that overlap cannot both take a row. The sender acks a claim
  when a browser took the push; releases it when every browser answered
  429, a 5xx or nothing; prunes a browser on 404 or 410, and deletes a
  claim whose every browser was gone. A claim still unsent five minutes
  after it was made is a crashed run's, and is released first.
- **The kill switch.** `flags.push_enabled`, read by the cron job's own
  SQL - off, there is no call, and no Vault row is read - by `push_due()`,
  which then returns nothing, and by the function, for its summary. It is
  the season's window too: on at the freeze, off after the con (ROADMAP,
  Checklist).
- **The clock.** `push_due(at default now(), dry default false)`: the
  function passes on an `at` its request names, the cron sends none, and
  `dry` claims nothing. #12's rule, on the server.
- **Starts-soon.** Due where the pick is picked, the event is not removed,
  not cancelled and has a start (#54), `start - 15 min <= at < start`, and
  the user has a browser; the key is the event's id, the year the
  event's. The lead time is 15 minutes, one constant, the value #40 and
  #50 left open. The minutes are counted as the push is sent, so a late
  run gives a shorter warning, never a stale one. A user's picks that
  share a start fold into one push, one claim a pick: one start, one count
  of minutes and one TTL, the seconds until the start. Urgency high.
- **The payload,** one shape: `{kind, year, event_ids, title, body}`. One
  pick: its title, and `Starts in N min · <hotel> <room>`. A fold:
  `N picks start in M min`, and one line an event,
  `<title> · <hotel> <room>`. The worker, Delivery's, builds any URL from
  `event_ids`.
- **The caller.** The function refuses any request without an
  `x-push-secret` header equal to its `PUSH_SECRET`, whatever Supabase's
  JWT setting; the gateway's JWT check is off for it.
- **Libraries.** PostgREST by `fetch`, as #53. Web Push by `npm:web-push`
  3.6.7, its request built by `generateRequestDetails` and sent by
  `fetch`.
- **The cron job** posts with a 30-second timeout, so that pg_net keeps
  the run's own answer; and a second job deletes pg_cron's run records
  older than a week, which pg_cron never deletes.
- **Pick-changed,** PR B's: one push per user per run and event, folding
  `cancelled`, `uncancelled`, `time`, `place`, `removed` and `restored`,
  and never `title`, `description`, `people`, `tracks` or `merged`; sent
  only for a `source` line of a run whose `fetch_code_changed` is false -
  a `code` line is suppressed too - where the pick is still picked, the
  run is after the pick's `changed_at`, the event starts in the future or
  has no start, and the run is within six hours; its times in the con's
  zone, from a `tz` column the mirror is to write to `mirror_state`.

**Why:** #25 chose the project's per-minute scheduler because GitHub's
cron cannot be one, and a minute is starts-soon's grain. A rule in SQL is
held by pgTAP, as #52's are, and a claim made by the insert itself holds
against a run that overlaps. With the switch read in the job, a project
whose switch is off makes no call and reads no secret, all year. With the
gateway's JWT check on, any `apikey` passes it - the public publishable
key among them - so it cannot be the gate; a secret the function checks
is. A late push that says less time is true, and one that says the time
it would have said is not.
**Cost:** A push that fails between its send and its ack is sent again
five minutes later. A fourth migration; a function in Deno, #25's third
runtime; and its four secrets and two Vault rows on each project, set by
hand (ROADMAP, Checklist). pg_cron's records: 1,440 runs a day, a week
kept. The function's logic is tested in Node against fakes; the runtime
was checked on the CLI's local stack, and a real push service and a real
browser only by the hand test.

### 56. Crews, the client's layer — Standing (2026-09-28) — its screens' home is Plans, who's going the event sheet's (#62); its screens on Plans built by PR #77: the crew header, the crew panel - create, join by a tapped or a pasted link, manage - and the crew's day, with two readers more, one crewmate's picks and the reader's own row in a crew, and `no_crew` in plain words (`docs/screens/contract.md`, section 5, as built); the display-name edit built by PR #80: a seventh action, `setMyName()`, an update of the reader's own row in one crew, refused before any request for a reader the crew does not hold (`not_member`), and Your name in this crew in the crew panel's manage step, whose words wait for the pull, since row-level security answers a row it turned away with the same 204 (`docs/screens/contract.md`, section 5, and `docs/sync/contract.md`, section 8, as built); who's going drawn on the event's sheet, and the crew on Now and the Map, by PR #81, with a reader more, `crewRightNow()`, each crewmate's pick on now or next today from a schedule the caller hands it (`docs/screens/contract.md`, sections 2, 6 and 7, and `docs/sync/contract.md`, section 8, as built)
**Decided:** The client's half of crews is built before any crew screen:
one module, `src/crews.js`, with no screen; the screens are Where things
live's. `docs/sync/contract.md`, section 8, has the detail.
- **The creator cannot leave;** the creator's Leave is Delete crew. The
  policies let a creator delete their own membership, and `creator` stays
  set when it goes, so a creator who left could still regenerate the
  invite from outside - that alone: removing a member and deleting the
  crew read the crew as a member, and from outside delete nothing (checked
  on the CLI's local stack). Handing a crew over is the spring's, only if a
  crew asks.
- **Who does what.** Any member may share the invite link; the creator
  alone regenerates it, removes a member and deletes the crew. The client
  refuses the rest before any request, as a courtesy; the policies are the
  wall.
- **Several crews a user,** with no cap on how many. The readers take the
  union of all of them, a person once, by the name the first crew that
  holds them gives, and the crews are read oldest first, so that crew
  stays the first.
- **Renaming a crew and editing one's display name:** the policies allow
  both; neither is built now.
- **A crew action never writes local state on success.** The server's
  answer is the truth, and the next pull brings it, so #51's rule - fails
  visibly, local state untouched - holds by construction. Create and join
  mint a user first when there is none (#51): the first taps that need
  one.
- **The module** is a nineteenth leaf, after `identity`, the lowest place
  its imports allow (#29). It owns the crews' two keys, which `sync`
  writes and forgets through it, as it writes picks and follows through
  their owners; it reads them when asked, never as it is imported. Six
  actions, each one request as the user; `crewMessage()`, the codes' words
  and its own; the invite link; and the readers, who's going and the
  overlay's map, crewmates alone - never the reader, whose star already
  says they are going.
- **The link** is the site's address with `?join=<year>.<token>` for its
  query, so a build of another year refuses it before any request. It is
  built from the page's own address, read only to point the link back at
  the site the sharer is on, which #15's rule - never decide by the
  address - allows. `boot()` reads it beside the time override, takes it
  out of the address and keeps it for the tab's session until a screen
  takes it; with no backend it goes and nothing is kept. A pasted link
  joins as a tapped one does: an iPhone opens a tapped link in the
  browser, not the home-screen app, whose storage is its own - confirmed
  on a phone on 2026-10-01, PR #77's hand test: a link pasted in the
  home-screen app joins that app's own user, as a separate member
  (`contract.md`, Open).

**Why:** #50 narrowed crews for 2027 to create, join, leave, remove, the
invite, the overlay and who's going, and Where things live opens last
(#30), so the data and the actions come first, pinned by tests, as #52
had the policies tested before any screen leaned on them. A creator who
has left can no longer see the crew but can still hand out its keys, so
the client keeps the creator in. With nothing written locally there is
one truth, the server's, and no local copy to roll back when a request
fails. The year in the link: a build is for one year (#49), and a crew of
another year is not this year's.
**Cost:** A crew cannot change hands, and one whose creator is gone keeps
no one who can regenerate its invite or remove anyone (#52's Cost). A
change shows on the phone only once a sync run has pulled it, a round
trip after the action. The client's refusals repeat the policies and
could drift from them; where they do, the policy wins. A create or a join
that mints and then fails leaves an anonymous user with no crew, for the
cleanup. An installed iPhone reader joins by pasting the link, not by
tapping it.

### 57. The order after Identity and sync: the scope pass, Where things live, Delivery last — Standing (2026-09-28) — the runner pin, PR #64, went first, for GitHub's date; the built inventory, `docs/scope-2027.md`'s section 1, added as a source and read before the wanted list; the verdicts landed, `docs/scope-2027.md`'s sections 2 and 3, with #59 and #60 (PR #69); Places' building view is #60's: its drawings a side lane, its screens Where things live's; W44, the calendar alarm, a standalone pull request in a free execution slot, as Playwright may be; Part B landed, `docs/official-app-2026.md` (PR #70); Where things live opened with the pass's output, the recon PR #72; Playwright came forward by this leave, a standalone pull request in the execution slot (#81, PR #101)
**Decided:** After Identity and sync the design slot goes to a scope pass;
Where things live opens with its output, and Delivery comes last. This
amends #37's order and adds to #30 a step that is not a tentpole;
`docs/ROADMAP.md` follows it.
- **The scope pass** is a named step, not a tentpole (#30). It runs in the
  design slot, now.
- **Its list** is the union of three sources: VISION's pillars; every item
  DECISIONS or ROADMAP defers, holds, or names as the spring's, not built,
  or open - pings, the Now board and share-a-day (#50), a crew's transfer
  and rename and the paste field (#56), and their like, such as
  hide-my-plan and guest bios; and the design chat's catalogue, Part A,
  which the pass brings into the repo.
- **Its verdicts.** Every wanted feature on the list is given a fuller
  description, passed through VISION's test - does it help someone plan
  or coordinate - and given a verdict: 2027, checkpoint candidate, or out,
  written in `docs/scope-2027.md`, Part A. A description is what the test
  needs, not a design: a feature is still specified when its tentpole
  opens (#30).
- **The official app.** A walk through the official 2026 app on a phone
  makes `docs/official-app-2026.md`, Part B, beside it: one row a feature,
  each marked planning, coordination or reference. The pass writes a rule
  for reference content, which VISION's Not doing now bans only by
  implication.
- **The guardrail:** the pass adds to the spring checkpoint's list, and
  the checkpoint still cuts from the bottom (#18). A DECISIONS entry comes
  of the pass only for a change to VISION.
- **Where things live** opens with the pass's output, before Delivery.
  The crew screens (#56), Delivery's notifications toggle and the install
  nudge wait for homes there (ROADMAP).
- **Delivery last.** Playwright (#24) may come forward as a standalone
  pull request in a free execution slot. Places' building view keeps
  #37's rule: a free review slot when its sketches are ready.

**Why:** Where things live gives a home to everything the app does, so it
opens once the pass has said what that is. The crew screens, the
notifications toggle and the install nudge all need homes; Delivery is
technical - it neither needs the pass's list nor feeds it - so building
its two screens first would build them into a UI about to be redrawn. A
real-browser test earns its place under a UI reshaping, and Playwright
depends on nothing else in Delivery, so it need not wait for the rest.
The design slot is free now: Identity and sync is built, and its
operations track - the cleanup of stale anonymous users its first pull
request - gates nothing (#50).
**Cost:** The worker's cache version (#4), hashed assets (#23) and Pages
from Actions (#26) land last, nearest the freeze, and the freeze date is
still unset (#30): that is the risk.

### 58. Level drawings are data, one file per level — Standing (2026-09-28) — its placement source and "each level is its own frame" superseded by #67, which also refines its sizes
**Decided:** Level drawings are data:
`data/<year>/drawings/<hotel>-<level>.json`, one file per level, geometry
only (feet, north up), every drawn room a room id of that level in
`venues.json`; composites and groups say how rooms combine; names come
from `venues.json`. `tools/render_drawings.py` draws them for docs; the
app's stage builder will read the same files. Sizes from the hotels'
published tables, placement from Dragon Con's map, nothing of theirs
copied (#28).

**Why:** #45 put each level's drawing in `data/2027/drawings/`, keyed by
level and room ids, and #28 made a drawing data the client builds once
and only lights. A schedule reading lands on a room id, so a shape keyed
by one can be lit; a name kept once, in `venues.json`, cannot disagree
with a drawing.
**Cost:** A room renamed, split or removed in `venues.json` leaves its
drawing wrong until the file follows; `tests/test_drawings.py` is the
guard. Each level is its own frame, so the levels do not stack until a
hotel's elevator cores line up. The renders are a record, redrawn by
hand, not held fresh by CI.

### 59. Reference content: attached, or about the app — Standing (2026-09-29) — the Cost's gap in the data closed by #61: `known_for` is a reviewed field of `people.json`, and `events.v2.json` carries it in a `people` block; the line's screen is Where things live's; the gear page's shape is `docs/screens/contract.md`'s section 9
**Decided:** Reference content is anything a person reads rather than acts
on: hours, policies, links, bios, documents. It is in the app in two forms,
and no other.
- **Attached:** one tap from a planning object - an event, a person on an
  event, a room, a crew - and short enough to read there: a two-line
  "known for" on a guest, the level on a room.
- **About the app:** one page behind the gear, in three parts - what we
  store, about this app, and the links: a one-line link to Dragon Con's
  official site and app. Delete my account is on it (`docs/scope-2027.md`,
  W32 and W45).
- It never gets a tab, a tile or a feed. Everything else the official app
  carries - photos, costumes, the vendor halls, show documents, social
  media, the store, DCTV, publications - stays there, and the one link
  points at it.
- VISION's Not doing keeps its list and gains this rule; guest bios move
  from banned to attached (W42).

**Why:** A feature is in only if it helps someone plan or coordinate
(#18), and Not doing banned reference content only by implication (#57).
A line attached to a planning object serves the plan: a guest's "known
for" decides whether to pick the panel (W42). About the app, it answers
what the app keeps and where everything else is. The official app carries
the rest, and one link reaches it.
**Cost:** A reader who wants more than a line - a photo, a full bio, a
show document - leaves for the official app. The "known for" line is to
be the registry's, reviewed: `people.json` has no field for it today - the
drafter's sidecar holds a draft line for 109 of `people.json`'s 111
celebrities, unreviewed, which the loader ignores - and the client sees a
person only through `events.v2.json`, whose shape has no place for it yet
(#31).

### 60. The building view is a 2027 commitment — Standing (2026-09-29) — its screens are `docs/screens/contract.md`'s section 6; its levels stacked by `storey` (#72)
**Decided:** The building view is built in 2027. This lifts the spring
gate of #21 and #28, which kept it in only if the foundation and
Coordinate had landed by the spring checkpoint.
- W38 to W41 (`docs/scope-2027.md`) are 2027, in that order: a hotel's
  levels with the reader's picks lit, the top-down level view, the motion
  between the views, and the same for the Westin, the Courtland Grand and
  the Mart - W41 as sources allow.
- They rank above every checkpoint candidate: if the checkpoint must cut
  a 2027 row, it is not one of these.
- The data half stays where Pipeline shape put it (#37, #45); the
  drawings are a side lane (#37; their form #58); the screens are Where
  things live's, with the map.

**Why:** #28's reason stands: which level is necessary but not
sufficient, and the question people ask is which end of the level and
from which escalator. The ground is laid: the venues file holds the
Marriott's, the Hyatt's and the Hilton's levels and rooms (#45), the
Hilton's five are drawn (#58), and the motion is sketched (PR #67). And
it is the part of 2027 its author most wants to build: VISION makes the
plan ambitious on purpose, as a tool to learn, and this is where that
ambition lives.
**Cost:** It is the largest UI build of 2027, on top of Where things
live's reshaping; something else gives first, decided at the checkpoint,
not now. Before its screens: the Marriott's and the Hyatt's levels drawn,
each hotel's levels put in one frame so that they stack (#58's Cost), and
the map made one persistent SVG (#28's Cost).

### 61. Known for is registry data, a people block in v2 — Standing (2026-09-30) — the line's screen is `docs/screens/contract.md`'s section 7; the client's half built by PR #93 (#74): `data.js` reads the block, and the line stands under the name on the event's sheet and on the person's Explore page, for no one until the line review lands
**Decided:** W42's line (#59) is a field of the registry, reviewed, and
reaches the client in a block of `events.v2.json`, on #38's pattern.
- `people.json` gains an optional `known_for`: one plain line, a string,
  not blank, with no line break, at most 120 characters
  (`registry.KNOWN_FOR_MAX`). The cap catches garbage, not typography; the
  review page counts characters and marks a line over 90, about two lines
  on a phone.
- `registry.PERSON_KEYS` is a person's keys in the order `people.json`
  writes them - `id`, `name`, `aliases`, `tier`, `known_for`, `credits`,
  `reviewed` - moved from `draft_people.py` as #46 moved `WORK_KEYS`; the
  review page keeps a copy that a test holds equal, and a key outside it is
  a problem.
- The drafter's lines stay in the sidecar. A line reaches `people.json`
  only through the review page, which shows it in an editable field, a
  sidecar line of `""` counting as none; its "reviewed, no known_for" view
  approves the line alone, touching no tier, credit or work, for the people
  approved before the field existed.
- `events_v2.py` writes a top-level `people`, between `works` and
  `events`: one row per registry person that any event's `people` names,
  `reviewed: true` and with a line, as `{id, name, known_for}`, sorted by
  id; `[]` when no one qualifies. Review gates the line, not tier: a
  creator's line ships as a celebrity's does. An event's own `people`
  entries are unchanged, and the client joins by id.
- The digest takes the block, between the works and the events (#42).
- `census_v2.py` reports the block against the reviewed people events name
  and the drafter's lines no registry person carries.

**Why:** #59 made the line attached content, the registry's and reviewed,
and its Cost found the data missing: the line only in the sidecar,
unreviewed, and no place for it in the file the client reads (#31). A block
keeps the line once per person: on 2026, with the 109 reviewed people's
draft lines standing in, 13,058 bytes against 65,719 repeated on the 892
event entries that name them. In the digest, an edited line reaches a
phone's update notice as any other change to the file does.
**Cost:** The client has to join by id, as it does for works. An edit to a
line moves the digest and `changed_at` with no line in the change log, as a
works-block edit does. 2026's file is rebuilt with an empty block now and
rebuilt again when the lines are reviewed. The line pass is a second review
of 113 people, four of them with no draft.

### 62. The five tabs; crew is a dimension, not a place — Decided, not built (2026-09-30) — the bar built by PR #74: the tab, its view, its module and its badge renamed `plans`, `--nav-h` measured and the bottom of the page laid out from it, and the opening tab by phase (`docs/screens/contract.md`, section 1, as built); Plans' crew built by PR #77, step 4: the crew header and its management, the My day | Crew segment and the crew's day of per-person lists, and a kept `?join=` opening Plans' join step in any phase (`docs/screens/contract.md`, section 5, as built); crew at every scope built by PR #81, step 5a: the hour on Now, Your crew right now; the building on the Map, the crew counted per hotel - as people, not picks: the crewmates with a pick there that day; and the event on the sheet, who's going (`docs/screens/contract.md`, sections 2, 6 and 7, as built); the hotel sheet's crew by PR #82, step 5c: Your crew here, the crewmates' picks at the hotel under the reader's own, a line a pick, and the head's count the Map's pill's (`docs/screens/contract.md`, section 8, as built); who's going and the crew's sections worded as picks by #68, PR #83, step 5d: "Starred by", Your crew's picks right now and here, "yours too"
**Decided:** The bar keeps five tabs, in today's positions: Now, Search,
Explore, Map and Plans - what is on, what to find, what to discover, where,
and my day and my crew's. Plans replaces Mine in its slot, fifth, with the
pick-count badge. `docs/screens/contract.md` has the detail.
- **Crew is a dimension at every scope, not a place:** the hour on Now, a
  crew section; the day on Plans, its Crew segment; the building on the
  Map, crewmates' picks counted per hotel; the event on the sheet, who's
  going. Crew management - create, join, the invite, leave, remove,
  delete - lives on Plans, in its crew header.
- **In 2027 the overlay** of crewmates' picks (#10, #50) is Plans' Crew
  segment, per-person lists of one day; lanes on the reader's own timeline
  are open.
- **The opening tab** follows the con's phase (`time.js` `conPhase()`):
  Explore before the con, Now during it, and Now after it, the record of
  the reader's picks as today. A `#explore=` link still opens its page,
  and a kept `?join=` opens Plans' join step, in any phase: the invite wins
  over the opening tab.
- **Provisional, with a tripwire.** If placing the homes shows that Now
  cannot hold its load above the fold, that crew management does not fit
  Plans' header, that For you and the Following feed read as two versions
  of one thing, or that something has no natural home or entry point: one
  of these redesigns the tab it falls on, two redesign the bar, and six
  tabs is the fallback.
- Amends #56: the crew screens' home is Plans - their management and the
  crew's day - and who's going is the event sheet's.

**Why:** The scope pass sent the official app's long tail to one link
(#57, #59), so nothing pushes a menu. "What is everyone up to today?" is
day-scoped and needs a tab. Search and Explore are two modes over one
subject, and a merge collapses them; Mine and a crew tab are one shape
over two subjects, and a merge only adds a subject. Before the con nothing
is on, and Explore is what a stranger can use; during it, Now is the
question.
**Cost:** Mine's name goes from the tab, its view, its module and its
badge, and from every test that selects them (`docs/screens/recon.md`,
section 10), by hand; the row's `mine` class, the `"mine"` list and
`"mineView"` mean the reader's own and keep their names. Plans carries the
reader's day, the crew's and the crew's management: the tab the tripwire
watches most. Before the con a reader opens on Explore, not on Now's
preview.

### 63. One home, any number of entry points — Decided, not built (2026-09-30) — the event sheet's entry points built by #75, PR #94: the place to the Map, focused on the event, and the chips to their Explore pages (`docs/screens/contract.md`, sections 6, 7 and 11, as built)
**Decided:** Every item in `docs/screens/contract.md` has one home, the
screen that owns its state, and any number of entry points: taps from
context that open the home's own state with parameters - the Map focused
on a hotel, an Explore page for a chip - never a second copy of it.
- An entry point sets the home's state and shows it; it draws nothing of
  its own.
- Back is designed for each entry point, and the contract's section 11
  names it: the app has no router, and the tab, the sheet and the hash are
  its navigation state (`docs/screens/recon.md`, section 6).
- A crew is an overlay wherever it appears, with one screen for its
  management (#62).

**Why:** The map should open from the event a person is reading. One home
keeps one copy of an item's state and one set of tests; the same rule
keeps crews an overlay everywhere and one screen for management.
**Cost:** Each entry point is a state change and a designed way back, and
some homes gain state they do not hold today - the Map a focused hotel.
The browser's own Back plays no part: the hash is written by
`replaceState`, so nothing the app does adds history. The back from an
Explore page is "← Explore", to the grid, wherever the page was opened
from: one tap from the event, accepted.

### 64. The row and the gap line — Decided, not built (2026-09-30) — its overlap computed once, by `walk.js` `connection()`: the two picks' intersection, the earlier end less the later start, which the hero and the gap line read and the row's flag is to word, not compute again (PR #76); who's going built by PR #81: a line on the event's sheet, three names and then how many more, tapping nowhere (`docs/screens/contract.md`, section 7, as built); the level on line 2 to be its `short` (#72); amended by #73, the row as built (PR #92): the time a range on line 2 and no time column, Celebrity on line 3, the overlap said by the two rows' flags and the gap line keeping walks and tight connections, a flagged row's track left off, and the level by its `short` (`docs/screens/contract.md`, section 10, as built); its sheet built and amended by #74 (PR #93): the overlap line before starring too, as "Would overlap", and the facts in the row's words, not a second vocabulary (`docs/screens/contract.md`, section 7, as built); its chips and its place line as entry points still to build; built by #75, PR #94: the place a tap to the Map on the event's con day, its hotel ringed and the event on the card, and each track's chip and each reviewed work's a tap to its Explore page, an unreviewed work's staying plain (#34)
**Decided:** A row is at most three lines, and the walk between two events
is said between their rows.
- **Line 1:** the star, the title and the state tags - Cancelled, Removed
  from the schedule, Celebrity.
- **Line 2:** the day's label where the caller asks for it (`showDay`),
  the time as "2:30–3:30 PM", then hotel · room · level, the level where
  the venues data has it (W18).
- **Line 3,** only when anything is present, in this order: the track's
  label, or "Gaming", muted; W7's facet flags; the pick's overlap flag;
  then the caller's context - Now's status, the Following feed's labels by
  time.
- **The one exception:** Search's ranked results keep their two-line
  snippet under line 3. It is the result's anatomy - why it matched - not
  the row's.
- **Overlap (W1):** a picked row that overlaps another pick carries a
  flag on line 3 wherever the row appears: "Overlaps `<title>`" for one
  clash, "Overlaps `<n>` picks" for more than one. The flag appears at the
  moment of starring, on a row or in the sheet, and persists; an unstarred
  row carries none. The event sheet also says it in a line of its own,
  listing every pick it overlaps with the times, at the moment of
  starring - a line, not a toast. The check is over every pick, not the consecutive pair.
- **Between rows:** the walk and the two tight bands are said on
  `leave.js` `gapHTML()`'s line (`docs/screens/recon.md`, section 5),
  never on a row, and the gap line keeps saying the overlap between rows
  on Now and Plans.
- **Facets** are flags on a row and words on the sheet.
- **The sheet's chips and place line are entry points** (#63): a track or
  work chip opens its Explore page; the place line opens the Map on that
  hotel, and on the room once the building view exists (#60).
- **Who's going** is a line on the sheet, from `crews.js` `goingTo()`; in
  2027 it taps nowhere.

**Why:** The recon found a row carrying up to thirteen elements
(section 4) and a walk that was already said between rows, where it
belongs: a walk is true of two events, not one. An overlap is true of the
pick itself, wherever it is listed, and a reader deciding whether to star
needs it then. The sheet is where a row's words have room.
**Cost:** Every row's markup changes, and with it the tests that read a
row's parts. The clash check is new: `gapHTML()` sees only the pick
before, and the helper's home is the row pull request's to propose.

### 65. The install nudge earns itself — Decided, not built (2026-09-30) — built by PR #76: `now.js` `nudgeVisible()` asks for a pick (`docs/screens/contract.md`, section 2, as built)
**Decided:** The install nudge stays where it is - the top of Now, its
three wordings, the seven-day snooze (`docs/screens/recon.md`, section 7)
- and shows only while the reader has a pick (`picks.size > 0`), never
before. Unstar everything and it goes: there is nothing to keep. The
wordings and the snooze are unchanged. The install flow's mechanics are
Delivery's (#57; W36).

**Why:** VISION's ladder - each screen makes the next rung obvious
without nagging - and a nudge over an empty plan is nagging. A pick is
what the home screen keeps: Safari deletes an uninstalled site's storage
after seven days without a visit (#25).
**Cost:** A stranger who never stars is never asked to install. It
settles #40's open question - a standing line on Now, or the moment it
earns itself - as the second.

### 66. Accessibility is a requirement, not a home — Decided, not built (2026-09-30) — focus into the sheet on open and back to what opened it on close, and Escape closing it, built for every panel by PR #77, with a label and 44px on every control that PR added (`docs/screens/contract.md`, section 5, as built); focus kept through a redraw on Now and the Map, and through the minute's tick, by PR #81, with a label and 44px on its new controls and the contrast of the Map's crew count (`docs/screens/contract.md`, sections 2 and 6, as built); focus kept through a pull's refill of the hotel sheet's crew, in place, by PR #82, with a label and 44px on its lines (`docs/screens/contract.md`, section 8, as built); focus, Escape and the way back for Share a day's two panels by PR #85, with a label and 44px on their controls, and My day's action strip and view toggle grown to 44px (`docs/screens/contract.md`, section 5, Share a day, as built); the filter sheet's by PR #88 (#70): focus to its heading and back to the Filters button, Escape, a label and 44px on every control in its panel - the Type control and the selects grown from 40 - the Filters button at the box's 48px, the row of chips under the box grown to 44px, and focus, when a chip there is taken off, on the one that takes its place, else on the Filters button, never the box (`docs/screens/contract.md`, section 3, as built); the event sheet's by PR #93 (#74): every new tap 44 px tall and at least 44 wide - a person's name, a session, an overlapped pick - the star's tap and a pull written in place with focus kept, the overlap line a polite live region, and focus on the heading of a sheet opened from a sheet (`docs/screens/contract.md`, section 7, as built); the entry points' by PR #94 (#75): the place's target 44 px tall with the head not grown, a chip's 44 px tall and at least 44 wide around the chip's own look, each named for where it goes or by its kind, and keyboard focus landing on what a tap opened - the Map's card, an Explore page's heading, from the grid's tiles too (`docs/screens/contract.md`, sections 6 and 7, as built); the more-below cue's by PR #95 (#76): no new control and no tap target's size or place changed, a control that takes focus scrolled clear of both bands by each area's scroll padding, nothing a screen reader hears changed, and nothing that moves, so no reduced-motion rule (`docs/screens/contract.md`, section 7, as built); the facet filters' by PR #96 (#77): four selects, each with a name of its own and 44 px tall, under a small label that names their group, at the sheet's 16 px so an iPhone does not zoom, a choice written in place with focus kept on its select, and a chip taken off sending focus as the others do (`docs/screens/contract.md`, section 3, as built); the sheet's edges' by PR #97 (#78): a focus ring drawn whole at the sides of the sheet's five scrollers, by 4 px of room that moves nothing, and an arrow where an area has more below that is no control - no tap, nothing a screen reader meets - at 6.3:1 on the sheet and with no animation; a ring is still cut at an area's top or foot, and at an event's panel's (`docs/screens/contract.md`, section 7, The sheet's edges, as built, and section 14); the browser tests came with #81, PR #101, and check none of these yet but the tap area of the header's simulated-time chip, 44 px tall or more (#82): step 11's sweep adds the rest to the harness, and until then "met" is still a pull request's word
**Decided:** Every screen Where things live touches meets these, and none
of them has a screen of its own (W43):
- a label on every new control;
- focus moved into the sheet when it opens and back to what opened it
  when it closes, and Escape closes it - neither is true today
  (`docs/screens/recon.md`, section 3);
- tap targets of 44 px;
- contrast on the map's lit rooms;
- `prefers-reduced-motion` honoured: the building view's lift and level
  swap show their end states with no animation under it, and there is no
  switch of our own;
- Larger text (B18) leaves the map alone, as it does today, and the
  building view inherits that.

Playwright checks them when it comes (#24, #57); until then each pull
request's description says how it met them.

**Why:** VISION's learning item 7, which the spring cut does not take
(`docs/scope-2027.md`, section 3, Notes). A requirement on every screen
cannot wait for a screen of its own, and a reshaping is when it is
cheapest.
**Cost:** Controls under 44 px today - the chips and the notices' buttons
at 38, the Type control, Mine's action strip and the view toggle at 40 -
grow in the pull request that touches them, and the style rules that pin
their heights move with them. Until Playwright, "met" is a pull request's
word.

### 67. A hotel's levels share one frame, placed from the hotel's own plan — Standing (2026-09-30) — its sizes gain a case by #79: where a chart gives areas alone, a room's sides are whole feet in the plan's shape
**Decided:** Builds on #58: the drawing format
(`data/2027/drawings/README.md`) gains four rules, and the Hilton's five
levels are redrawn to them.
- **One frame per hotel.** Every level file of a hotel has the same origin
  and the same `extent`; a point directly above another has the same x, y.
- **Anchors.** Named fixed points, `{name, x, y}`, unique within a file; a
  name that appears in two files of one hotel has one position.
- **An open area may carry an `id`.** With one, it is a place events
  happen: the id is a room of that level in `venues.json`, unique among
  the file's rooms, composites and open ids, and the app may light it.
  Without one it is scenery, as before. No Hilton file uses this yet.
- **Sources.** Placement, order and orientation come from the hotel's own
  floor plan where there is one, read for position only (#28). Dragon
  Con's map says which rooms the con uses and their names, and places a
  hotel that has no plan. Sizes stay the hotel's tables', turned as the
  plan draws each room; where a table contradicts its own square footage,
  the plan's shape.

**Why:** The app stacks a hotel's levels (#60). The con's map outlines
blocks of rooms, not the order inside them, and its panels are not to one
scale. Reading the hotel's plan and its tables again found the Hilton's
drawings wrong on every level: 301-305 drawn lengthwise as a 229 ft row,
where each stands 48 ft deep in a 131 ft row; 309-312 in reverse order;
the 2nd floor's wing rooms 204-214 turned the wrong way; Grand Ballroom
C/D and B/A swapped north to south; the Crystal Ballroom turned and
mirrored; the order inside 404-407; and thirteen rooms at sizes that are
not the table's.
**Cost:** The hotels' plans are illustrations, not surveys, so positions
are good to roughly 10-15 ft until walked. 306-308 follow the hotel's
order, and Dragon Con's map says the reverse.

### 68. A star is a pick, not a whereabouts — Standing (2026-10-01)
**Decided:** A crewmate's star says what they picked, never that they are
going or where they are. The crew screens say so in their words (ROADMAP,
tentpole 5, step 5d; PR #83):
- the event's sheet: "Starred by Bo, Cy and 2 more", where it said
  "Going: Bo, Cy and 2 more";
- Now's section: "Your crew's picks right now", and the hotel sheet's:
  "Your crew's picks here";
- a crew line: "yours too" where the reader starred the event as well,
  where it said "with you".

What does not change: "on now" and the start on a line, which are the
pick's time; the counts - "3 picks · 4 of your crew", the Map's label -
which count picks and people; Plans' crew day; the join step; "+N more".
The code keeps its names - `goingTo()`, `goingText()`, `#sheetGoing`,
`.ev-going`, `.cn-with`, `crewNow-`, `crewHere-` - with a comment where
the screen's word now differs. A star stays one state, with no maybe and
no second state on a pick. Amends #52's "a star means going; there is no
maybe": a star is a pick, and says nothing of whether its crewmate will be
there. VISION's ladder says so too: with a crew, "you can see who starred
what, and where it is", where it said "who is going where". Its Coordinate
pillar still names #10's "who's going per event": "who's going" stays the
feature's name, as `goingTo()` stays the code's.

**Why:** A star is not a commitment: people star two things at 1 PM, which
is why the app warns of overlaps (#64). "Going" and "with you" put a plan
on screen as a whereabouts, and the app says nothing of where anyone is
(#5).
**Cost:** The code's names and the screen's words differ, so a reader of
the code meets "going" where the screen says "starred". Now's and the
hotel sheet's titles are longer.

### 69. A shared day's link is a contract — Standing (2026-10-01)
**Decided:** Share a day (W25; #10, #50) sends a day of the reader's picks
as a message and a link to the page's own address, with one query and
nothing else - no name, no user, no crew. Links live on in people's
messages, so the shape is a contract from the day it ships
(`docs/screens/contract.md`, section 5, Share a day, as built):
- **The shape:** `?day=<year>.<day>.<token>-<token>-...` - the year; the
  con day's three letters in lower case, `sat`; and a token a pick, the
  last eight characters of its id, or the whole id where those eight are
  another event's too in the year's schedule. An id may hold a "." (#43's
  `<source_id>.<n>`), so the tokens are joined by "-", which no id holds,
  no query encodes and no chat app formats. The link ends on a token, never
  on the punctuation a link detector trims.
- **Read back:** the last `day=` in what the reader holds - a link, a
  message pasted whole, or the bare value - so a paste field needs no
  parser of its own. A token resolves across the year, not the day, to the
  one event whose id ends with it: one that finds none or more than one,
  or is shorter than eight characters - a tail cut short - is skipped and
  counted, and an event moved to another day is still found. A link that
  ends in "-", its last token empty, still parses; it and one whose last
  token is short are said to be likely cut short. No token is resolved
  through `was` (#43). Another year's link is refused; one that
  names no con day of the year, carries no token or runs past 16 KB does
  not parse. Nothing that reads a link throws.
- **What travels:** that day's picks that are neither removed nor
  cancelled, in start order. The message carries them as text, at most
  1,800 characters, lines dropped from its end and counted; the link
  always carries every pick.
- **Every id travels as it is:** letters, digits and ".", nothing a query
  encodes, eight characters or more. A test holds each year's
  `events.v2.json` to it, so a source that mints ids of another shape fails
  CI before a link breaks.
- **Nothing kept:** the received day lives in memory alone, no request is
  made for it, and a reload loses it.

**Why:** A link in a chat lives as long as the chat, so its shape cannot
change under it. 2026's 3,459 ids are 32 hex characters and
near-sequential: the last six are unique across the year and the first 31
are not, so a tail is short and a head is no use. Eight leave a margin for
a year whose ids collide more, and the whole id covers one that does. A
15-pick link is about 200 characters on the live site, and a 30-pick one
about 335. Four of 2026's fourteen start changes crossed a con day, which
is why a token is read across the year. "-" is unreserved in RFC 3986, and
`_`, `*` and `~` are formatting in WhatsApp or Discord.
**Cost:** The link is longer than a packed encoding would be, in exchange
for being readable and simple to read back. A change of shape needs a new
query name, or a version in the year's place, with the old shape read for
as long as its links live. An id shorter than eight characters cannot
travel, and the test refuses a year that has one.

### 70. The filter sheet applies as it is tapped — Standing (2026-10-02) — its held group retired by #71: one value a filter and the last one set wins, a tap in the sheet taking a word out of the query and a word typed taking the sheet's value to All once the box is left; its groups reordered by #71; its facet filters built by #77, PR #96: cost, sign-up, audience and sold out, under Getting in, and the sheet's filters thirteen
**Decided:** Search's filters leave the page for a sheet panel,
`#panel-filters` (W13, with W8's topic axes; `docs/screens/contract.md`,
section 3, as built; PR #88), opened by one Filters button beside the
box, whose badge counts the filters the sheet set that are in effect.
- **No Apply.** A tap in the sheet changes the filter at once. Its main
  button says what the list will hold - "Show `<n>` events", "Show 1
  event", "No events match" - counted as the tap lands, and the list
  behind is drawn once, when the sheet closes: by that button, the
  backdrop, a swipe or Escape. Clear takes the sheet's nine filters back
  to All and the toggle to Settings' default, never the day or the query.
- **One value per filter,** as before: a hotel, a kind, a type, a fandom,
  a track, and one each of Medium, Genre, Craft and Subject; every one set
  must hold.
- **A word in the box holds its dimension.** While "hilton" is in the
  box, the sheet's Hotel group shows the Hilton, disabled, "Set by your
  search"; the sheet's own hotel is kept, unshown and uncounted, and comes
  back when the word goes. Neither the sheet nor the chips under the box
  show a value that is not in effect.
- **Each filter in effect is a chip under the box,** in the row the
  query's words use, and a tap takes that one off.
- **Facet filters (W7) come after step 7,** once a row shows the facets
  (ROADMAP, tentpole 5).

**Why:** The hotel and kind rows, the selects and the toggle filled the
top of Search: at 375x667 the first result sat more than 570px down. An
Apply makes every change two taps and leaves the reader to guess what it
will show; a count on the button says it before the sheet closes, at
about 2 ms a tap on 2026's schedule in desktop Chromium. One value per
filter is what the state and the query's words already had. A word that
quietly beat a sheet filter, as `activeFilters()` already let it, would
leave a chip naming one hotel over a list of another. A facet has nowhere
to be seen on a row until step 7 puts it there.
**Cost:** Every filter is a tap further away: the hotel chips were on the
page, one tap each. A held group cannot be changed in the sheet: the word
comes off first. The box's placeholder is shorter, "Titles, guests,
fandoms", to fit beside the button with Larger text on and the badge
showing, and the box is named by a label of its own, "Search the
schedule".

### 71. One value per filter, and the last one set wins — Standing (2026-10-02) — a fourth filter a word sets, the audience, by #77: "18+" and "adult" hold it at 18+, and a kids word holds the track and the audience both, taken out whole by a tap on either
**Decided:** The filter sheet (#70) has no lock. A word in the box and
the sheet set the same three filters - the hotel, the kind and the track -
and whichever was set last is the one in effect (`docs/screens/contract.md`,
section 3, as built; PR #90):
- **Nothing in the sheet is disabled,** and "Set by your search" is gone.
  The sheet shows what is in effect: with "hilton" in the box, the Hilton
  is pressed.
- **A tap or a choice in the sheet** on a dimension a word holds takes
  that word out of the query, as its chip's x does, then sets the value
  tapped; a second word that would hold the dimension once the first is
  gone - "hilton hyatt" - comes out too. A second tap on the hotel in
  effect is All, as before. "kids" taken out by a track takes its hiding
  of 18+ with it, as its chip's x does. The count on the main button
  follows at once, and the box shows the changed query when the sheet
  closes.
- **A word typed replaces the sheet's value** for its dimension, which
  goes to All, so nothing is kept unshown and nothing comes back when the
  word is removed - once the box is left: the return key, the box losing
  focus, or the sheet opening, which takes the step before the panel
  draws. Never a keystroke. Until then the word wins, as `activeFilters()`
  already had it, and `inEffect()` - the badge and the chips under the box
  - leaves out a dimension a word holds: the one line of the held case
  that stays. Nothing shown changes at that moment, so nothing is drawn.
- **The panel's groups** in a new order: Hotel, Fandom with Track, the
  four topics, Type, Kind, the toggle. The chips under the box, in the
  sheet's order, follow it.

Amends #70: its "a word in the box holds its dimension", and its cost "a
held group cannot be changed in the sheet".

**Why:** On an iPhone the held group did not read as locked: "Set by your
search" and the dimmed chips went unnoticed, and a lock the reader has to
notice is the wrong design. The moment is the box left, not a keystroke,
because the box is read on every keystroke and a word holds its dimension
only while it is a whole word of the query: "photo" on the way to
"photoshoot", a word in 187 of 2026's titles, holds Kind, as "game" does
on the way to "games" (34), and "mart" holds the hotel on the way to
"martial"; and "gaming" holds Kind only as the whole query, so typing
"gaming trivia" holds it between the two words. Taken per keystroke, the
step would take the sheet's value to All on the way through, and nothing
would bring it back. At 402x714 the old order showed only Hotel and Kind
on the panel's first screen, ending at the fold with nothing to say there
was more.
**Cost:** A word deleted before the box is left gives the sheet's value
back, as #70 had it: until the box is left the old rule stands, and a
hand test presses return between typing a word and deleting it. A word
taken out by the sheet rewrites the query in lower case with one space
between words, as a chip's x always has. Kind, second in #70's order, is
now near the panel's foot, below the fold on a phone.

### 72. A level has a storey and a short name — Standing (2026-10-02) — its `short` read by the row since PR #92 (#73)
**Decided:** Every level of the venues file (#45) gains two keys, required
like every other, which nothing reads yet:
- **`storey`**, written after `order`: the storey the level is on, a whole
  number counted from the hotel's lowest level in the file, which is 0. A
  larger number is higher, and two levels on one storey stand side by side
  in different parts of the building - the Hyatt's International Tower
  LL2 beside its Exhibit Level, LL1 beside its Ballroom Level. It ranks
  the file's levels and does not count the building's floors: the
  Westin's 8th and 12th Floors are storeys 2 and 3. The building view
  (#60; ROADMAP, tentpole 5, step 10) is to stack a hotel's levels by it.
  The Mart's six are placeholders, each its `order`: it is two buildings
  in one entry until the building view's pull request splits it and sets
  them.
- **`short`**, written after `name`: the level's name where a line has
  little room - an event's row, after the room (#64). It may equal `name`,
  and is shown, never read by the resolver, which reads a floor alone, and
  the Mart's building floors and vendor halls, by `name` (#45). `name`
  stays the full name, which the event's sheet and the building view
  show. Its reader is the row's pull request, next in
  Where things live's step 7, which is to leave the level off where the
  room already says it - where the room, case-folded, contains the
  `short`, case-folded, less a trailing " Level" or " Floor" - and the
  values are chosen for that rule, which that pull request builds.
- **Fatal** in `venues.py`: a `storey` that is not a whole number, or a
  hotel whose storeys do not start at 0 or skip a number - two levels may
  share one; a `short` that is not a non-empty string, is longer than 20
  characters, or is shared by two levels of one hotel, case-folded.

**Why:** `order` is distinct within a hotel and is the order its levels
are listed in, so it cannot put two levels on one storey (prototype round
7, 2026-10-02). `name` is the full name the sheet shows, and "Atlanta
Conference Center (LL3)" does not fit on a row beside a hotel and a room
(the step 7 design chat, 2026-10-02).
**Cost:** Two more keys on every level, kept by hand in both years' files
and in every test fixture that builds one. A storey says nothing of how
far apart two levels are, and a level added between two others renumbers
the storeys above it. The Mart's storeys are wrong until its split. 20
characters is a guess, to be tried on a phone by the row's pull request.

### 73. The row as built — Standing (2026-10-02) — its flags made filters by #77, PR #96: the filter sheet asks the facets and the audience themselves, not the row's flags; and a row's 18+ asks `isAdult()`, which reads the listing's Mature Audience marker too, every 2026 event's flags as they were
**Decided:** An event's row is #64's, amended in five ways: the title, then
up to two lines under it, and the star on the right
(`docs/screens/contract.md`, section 10, as built; PR #92).
- **Line 1:** the title, at most two lines, its gold star before it when
  picked, struck when cancelled or removed. "Cancelled" or "Removed from
  the schedule" leads the title's words, inside its two lines, where it is
  never clipped and the row gains no line; the strike is the words', not
  the tag's or the star's.
- **Line 2, one line:** the day's label where the caller asks for it, the
  time as a range - "2:30–3:30 PM", the meridiem once, both where they
  differ - then the place and the level, each after a middle dot, as text
  in the hotel's colour. There is no time column, and under a time head
  the row says its time all the same: one shape everywhere. The hotel never
  shortens, and the room takes the ellipsis; a hotel whose `display` is
  "location", the Mart, is its room alone, on every screen `placeHTML()`
  feeds. The level is its `short` (#72): none where the event has no level,
  left off where the room, case-folded, holds the `short` less a trailing
  " Level" or " Floor", and dropped whole where the line cannot hold it,
  before the room is cut.
- **Line 3, one line, only when anything is present:** Celebrity; the
  overlap flag; the caller's context - Now's status, the Following feed's
  labels; the flags; the track, or "Gaming". A part that does not fit drops
  whole, from the end: the track, then the flags from last to first, then
  the context. Celebrity and the overlap never drop, the overlap's title
  shortening first: the reason a row is on its screen outlasts its flags.
- **The overlap flag** (W1): a picked row that overlaps another pick says
  "Overlaps `<title>`", or "Overlaps `<n>` picks", in the warning colour,
  wherever it is drawn - in a crewmate's block of the crew's day and in a
  shared day as anywhere - over every pick, by `connection()`'s band, the
  hero's answer. It comes and goes on both rows at the moment of starring.
  A cancelled or removed pick neither carries one nor counts in another's.
  A flagged row leaves its track off.
- **The flags** (W7), words after a middle dot, in this order: Sold out,
  alone in the warning colour; Extra fee; Sign-up; an age, "`<n>`+", else
  18+ for a mature audience; Kids. One helper says an event's flags, for
  the row now and for the sheet and the filter sheet later.
- **The gap line** says the walk and the two tight bands, and no longer an
  overlap: the two rows' flags say it.

Amends #64: the time on line 2 as a range, and no time column; Celebrity
on line 3; the overlap said by the flags alone, the gap line keeping walks
and tight connections; a flagged row's track left off; the level by its
`short`.

**Why:** The step 7 design chat sketched #64 on real 2026 events
(2026-10-02). On line 1, Celebrity fell to a line of its own after a title
that nearly filled the row. The gap line said an overlap a third time,
after both rows' flags. Line 3 had no room for an overlap flag and a track,
and "Trek Tra…" says nothing. "Atlanta Conference Center (LL3)" does not
fit after a hotel and a room (#72), and a level the room already names -
"Atrium Ballroom", "Galleria 5" - says it twice. A tag in the title's first
words cannot be clipped by the title's two lines, and adds none.
**Cost:** A row is up to four lines. Every row's markup changes, and the
tests that read its parts with it. A line that cannot hold the level drops
it: at 375 px with Larger text and a day label, the level shows on a
minority of the rows that have one, as measured in Chromium (`contract.md`,
section 10, as built), and a dropped level stays in the row's text, so a
screen reader reads what the eye does not see. A Celebrity row with an
overlap can lose Now's status. Measured in Chromium, the overlap naming a
title: the long status, "On now, ends 2:00 PM", is lost at 375 px at the
normal text size, and at 375, 390 and 402 px with Larger text; the short
one, "In 40 min", is lost at none of the three, at either size
(`contract.md`, section 10, as built). The hero and the gap line still
band a cancelled pick, which the row's flag does not (`contract.md`,
section 14).

### 74. The event sheet as built — Standing (2026-10-03) — its other sessions amended by #75: only those not yet started, the rest left out; its place and its chips made taps by #75, PR #94; its body fades where it has more past an edge, by #76, PR #95
**Decided:** An event's sheet is #64's, amended in two ways, in three
parts: a head and a foot that never scroll, and a body between them that
does (`docs/screens/contract.md`, section 7, as built; PR #93).
- **The head:** the title and when, as before; the place, and under it the
  level's full `name` (#72), exactly where a row names the level (#73) -
  the event has one, and the room does not already say it; Cancelled or
  Removed from the schedule; the facts; the other sessions; Starred by
  (#68).
- **The facts,** one line that may wrap, in the row's words: Celebrity; the
  row's flags in the row's order, Sold out alone in the warning colour
  (#73); then two things a row does not carry - "Part `<n>`", and a game's
  format, "One-shot game", "Organized play", "Learn to play", "Tournament",
  "Demo" or "Open play", with ", beginners welcome" where its level is
  beginner, but for Learn to play, which says so itself. The age is on this
  line, and the body's 18+ chip is gone.
- **The other sessions:** "Also runs Fri 4:00 PM · Sun 2:30 PM" - the
  events with the same repeat key, the same title and the same people, by
  id, neither removed nor cancelled. Each is said by its con day's label
  and its start, as a row says a day, so a session after midnight takes the
  night it belongs to; those not yet started come first; three are named,
  then "and `<n>` more". A named session is a tap, to its own sheet in this
  one's place. A cancelled event's sheet lists the sessions that still run.
- **The body:** the description; the people, under a small "With"; the
  track and work chips. A person's name is the tap to their Explore page,
  and See all is gone. A role other than Speaker or Panelist follows the
  name, in lower case, muted. A person with a known-for line (#61) has a
  line of their own, the name and under it the line, and they come first,
  in the listing's order; everyone else shares one wrapping line. The same
  line stands under the name on that person's Explore page.
- **The foot:** the overlap line (W1), then the actions. On a pick,
  "Overlaps `<title>`" and under it its time as a range, a block a pick,
  "and `<title>`" for a second and a third, then "and `<n>` more"; on an
  event that is not a pick, "Would overlap `<title>`", quietly. The title
  is cut to one line. A block is one tap, to that pick's sheet in this
  one's place. The rule is the row's (#73): `connection()`'s band over
  every pick, and a cancelled or removed event has no line and counts in
  none. The line is a polite live region.
- **In place:** the star's tap writes the star, the overlap line and
  Starred by where they stand, and a pull's redraw fills the same three by
  the same function. The panel is drawn once, as it opens.
- **The height:** the sheet is at most 86% of the screen, its padding, its
  grip and its border counted. The head and the foot keep their height and
  the body takes what is left, never under 4.5rem; where they leave it
  less, the panel scrolls as one with its foot pinned, and a drag there
  scrolls rather than dismisses.
- **A sheet from a sheet:** Done, the backdrop, a swipe and Escape close to
  the screen underneath, focus on what opened the first sheet; an event
  opened over a shared day's event keeps the way back to the list (#69).
- **Every new tap is 44 px** tall and at least 44 wide (#66): a name, a
  session, an overlapped pick.

Amends #64's sheet: the overlap line shows before starring too, where #64
gave it "at the moment of starring"; and the facts are the row's words,
where #64 had "flags on a row and words on the sheet".

**Why:** The step 7 design chat sketched the sheet on real 2026 events
(2026-10-02), after the row (#73). A reader deciding whether to star needs
the overlap before the star, not after it. A fact said two ways, a flag on
the row and other words on the sheet, is two things to learn. A repeat key
alone is not a session: "Author Signing" is eight sessions of eight
line-ups; by key, title and people 2026 has 347 groups of two or more over
1,173 events, the largest of 44. A redraw at the star dropped focus to the
page, sent the body back to its top and replaced the live region, which a
screen reader then does not read; and a pull left the open sheet's star
stale (ROADMAP, Flags). The taps are made walking through a hotel, and two
names side by side in a comma line are the easiest wrong tap in the app:
#66 holds as written. Three long titles that wrap take 249 px of the foot
at 375 px wide, 269 with Larger text, measured in Chromium; cut to a line
each, 132 and 147. A foot that scrolled away would take the star and Done
with it.
**Cost:** Height, most of it in the body, which scrolls: 15 people's names
are 220 px at 375 px wide where words in a line would be 98, 264 and 135
with Larger text. In the parts that never scroll, the sessions line is 44
px where words would be 20, and three overlapped picks are 132 px, 147
with Larger text, where words in a line would be 59 and 67. With the
tallest head of 2026 - 208 px at 375 wide, 258 with Larger text - three
overlapped picks and a Starred by line, the body is at its floor and the
panel scrolls: by 10 px at 375x667 and 13 at 390x664, and with Larger text
by 89, 62 and 19 at 375x667, 390x664 and 402x714; with one overlapped pick
it scrolls at none of the three, at either size (`contract.md`, section 7,
as built). A title in the overlap line is cut, and an event with almost
nothing in its body gains up to 16 px of space under it. A session in
another room is not said until it is tapped: 6 of 2026's 347 groups run in
more than one. There is no way back to the first event from a sheet opened
from it. The one-line "how to get there" (W18) is not built: no data for
it exists. The known-for line is built before any line exists: 2026's
block is empty until the review lands (#61). A live region cannot be heard
in jsdom, nor a pinned foot seen: both are hand checks on a phone.

### 75. The event sheet's entry points as built — Standing (2026-10-03)
**Decided:** Three taps leave an event's sheet, each to a home's own state
(#63), and the Map can hold one event as its focus
(`docs/screens/contract.md`, sections 6, 7 and 11, as built; PR #94).
- **The place** is one button on the sheet of an event at one of the Map's
  seven places that is neither cancelled nor removed: its words as before,
  underlined, in the hotel's hue, named "`<place>`, show on the map". A
  stream, an offsite event, one with no known place, a cancelled and a
  removed event keep the plain line. The level stays under it, outside the
  tap. Its target is 44 px tall and the head does not grow: the button
  takes 16 px of padding above and 6 px below and gives both back as
  negative margins, so its box reaches over the when line, which is never a
  tap, and ends exactly where the next line starts. The tap closes the
  whole sheet, a shared day under it too, and opens the Map at its top,
  focused on the event.
- **The Map's focus** is one event's id, in memory alone
  (`state.map.focus`). The focus carries its own day: while it is set the
  Map shows the event's con day, and `state.map.day` is not written, so
  when the focus ends the Map is on the day it had - the clock's, where no
  chip had been tapped. A third ring stands on the event's hotel: the light
  text colour, not gold, which is the reader's own picks; not pulsing; 11
  out from the block, outside the now ring and the next ring. The card
  under the map shows that event in the next pick's place, the same button:
  "You were looking at", the title, the place and the level as a row says
  them, the con day's name and the time as a range; a long place wraps. No
  minutes and no walk. The card is a tap, to the event's sheet, and it
  shows whatever the clock says: before the con, and after it, where the
  Map has no card.
- **The focus ends** when the Map tab is left by any road, which one line
  of `render()` decides; at a day chip's tap, which chooses the day; when
  the clock is changed; and when the schedule no longer holds the event, or
  holds it as removed. A sheet opened and closed over the Map, and a star,
  leave it. A reload loses it.
- **A chip** - each track, and each work a person has reviewed - is a
  button to its Explore page, the whole sheet closing, as a person's name
  does. Every chip's name says its kind too, by Explore's own noun in lower
  case: "Star Wars, track", "Star Wars, fandom". An unreviewed work's chip
  is no tap and does not look like one - a span, no fill, its words muted:
  its id must not become permanent in an address (#34), and the rule is the
  hash's own, `canFollow()`.
- **Focus** lands on what the tap opened (#66), the page staying at its
  top: the Map's card after the place; the Explore page's heading after a
  name or a chip - and after a tile, a Following chip or a
  Because-you-starred tile on Explore's grid, which lost it the same way.
- **The way back from an Explore page,** "← Explore", lands the grid where
  it last was: the grid's scroll is taken only where the screen under the
  tap is the grid itself. From another tab's sheet, or from an Explore
  page, what the grid last held stays - its top, if it was never left.
- **Every new tap is 44 px** tall and at least 44 wide (#66); a chip keeps
  its look inside its target.
- **The other sessions** are only those not yet started when the panel is
  drawn, in start order. The rest are left out, "and `<n>` more" counts
  what is left, and with none left there is no line: after the con no sheet
  has it, and a cancelled event's sheet lists its live sessions still to
  come.

Amends #74's other sessions - "those not yet started come first", and "A
cancelled event's sheet lists the sessions that still run" - and builds
#64's "the sheet's chips and place line are entry points", its "a track or
work chip" narrowed to a work a person has reviewed.

**Why:** The step 7 design chat (2026-10-03), after the sheet (#74). The
map should open from the event a person is reading (#63). Gold is the
reader's own picks, so a place only looked at takes another colour. A
reader at the con on Saturday who looked up where a Sunday panel is never
tapped Sunday: coming back to the Map an hour later, they must find today,
its rings and its counts - so the focus carries its day and writes none.
The head never scrolls: 21 px of it for the place's target would open a gap
between the place and its own level, and #74's tallest case would scroll 32
px where it scrolls 10; #66 asks for the target, not for the room. A
session that has started is not one to go to: at Saturday 1:05 PM, 944 of
the 2,601 sessions 2026's sheets named had started. After a tap that left
the sheet, focus was on nothing: the sheet's close gave it back to the row
that opened the sheet, and the tab change then hid the row. And "←
Explore" landed the grid at the scroll of whatever tab the sheet had stood
over: 900 px down, from a sheet over Search at 900.
**Cost:** A row of chips is 44 px where it was 23, and two rows 88 where
they were 52, in the body, which scrolls: #74's tallest case scrolls as it
did, by 10, 13 and 0 px at 375x667, 390x664 and 402x714, and its body holds
160 px where it held 139. The place's box covers the lower 10 px of the
when line, so a thumb on the time can open the Map: a phone's to check. The
focus ring is 2 over the next hotel's block where the Hyatt and the
Marriott stand 10 apart, and 1 inside the frame above the park and under
the Courtland. A chip that is not a tap sits among chips that are: 244 of
2026's 1,699 work chips, 64 unreviewed works on 239 events. Two chips can
carry the same words and go to two pages: "Star Wars", the track and the
work, on 35 events of 2026, and "Artemis Spaceship Bridge Simulator" on 5.
304 of the pages a chip opens hold one event, the one the reader came
from. After the con no sheet names another session. A reload loses the
focus. While a notice stands above the views - the preview banner before
the con, "has ended" after it until its OK - the Map tab is taller than
the screen by the notice, as it was, and the focused card is cut at the
page's top: by 82 px after the con at 375x667, where the Map had no card
to cut. "← Explore" still drops keyboard focus to the page.

### 76. A fade where a scrolling area has more past its edge — Standing (2026-10-03) — its fade cannot show where the fold lands in a gap: an arrow beside it where an area hides enough below, and `data-more` a word, not a bare hook, by #78, PR #97
**Decided:** Six areas of the bottom sheet scroll on their own - an
event's body, the hotel sheet's list, the shared day's, the filter sheet's
body, Settings' Advanced and the crew panel - and where one has more past
an edge, that edge fades to nothing: the bottom with more below, the top
with more above, both in the middle, neither where everything fits
(`docs/screens/contract.md`, section 7, as built; PR #95).
- **A mask, not an overlay:** `mask-image` on the scrolling element
  itself, so what fades is the content and what shows through is the
  sheet, with no element laid over it and no colour kept in step with the
  sheet's. One rule, on the mark, serves all six, and no area has its own.
  The property is unprefixed: the floor is Safari 16.4 (#23). It does not
  animate as it comes and goes.
- **Graded, not on or off.** A band is as deep as what is hidden past its
  edge, and at most 1.75rem and a fifth of the area's height. A few hidden
  px dim nothing a reader can see whole; a short area keeps a clear
  middle; Larger text scales the cap with no script; and the band eases
  out as a thumb nears an end, where an on-off band would pop.
- **The mark.** The element carries what it hides, in whole px, as two
  custom properties, `--more-above` and `--more-below`, and `data-more`, a
  bare hook the rule hangs on, while either is above 0: an area that fits
  carries no mask and no attribute of the cue's. `scroll.js`
  `moreHidden()` is a pure function of the element's three numbers -
  scrollTop, clientHeight and scrollHeight - to the two: under 1 px hidden
  is 0; never under 0, so a bounce past an end is the end; and never over a
  ceiling of 48 px, which stands above the deepest band, 32.2 px with
  Larger text, so that far from an end the number does not change and
  nothing is written.
- **Kept by three registrations** in `boot()`, and no call at any draw: a
  scroll listener on the sheet in the capture phase, since a scroll does
  not bubble; a MutationObserver on the sheet's child lists - never its
  attributes or character data, so the mark's own write cannot wake it -
  for an area a draw has just replaced and a child put into one at its cap;
  and a ResizeObserver on each area and each child of it, for a panel
  shown, Larger text, Advanced opened, the window resized or turned, and
  content that grows inside an area whose own box stays as it was.
- **Not among the six:** the share panel's message, which is a field; an
  event's panel scrolling as one, whose body has the cue and whose foot is
  pinned (#74); and `main`, where the nav cuts the rows in plain sight.
- **#66.** The same cap, `min(1.75rem, 20%)`, is each area's scroll
  padding, always and not by the mark - where a focused control lands must
  not depend on a number written after the scroll - so a control that
  takes focus is scrolled clear of both bands. The mask changes nothing a
  screen reader hears, and no tap target's size or place. Nothing moves, so
  reduced motion needs no rule.
- **Two fixes with it.** The crew pill's way into the hotel sheet (#63)
  lands Your crew's picks here short of the body's top by the cap, which
  `scroll.js` `moreCap()` reads from the body's own scroll padding, so the
  heading the pill opened stands clear of the top band. And a drag that
  starts in Advanced scrolls it and no longer drags the sheet: `sheet.js`
  `onSheetTouchStart()` leaves `.advanced-body` alone, as it leaves an
  event's body and the filters'.

**Why:** The step 7 design chat (2026-10-03): the last line of a scrolling
area was cut mid-letter, and a reader could not tell a full list from a
cut one. A fade, not a shadow: a dark shadow on the dark sheet barely
shows. On 2026's schedule in Chromium, with no picks, 347, 297 and 120 of
the 3,459 events have a body that scrolls at 375x667, 390x664 and 402x714,
and 1,102, 1,038 and 469 with Larger text; the filter sheet's body always
scrolls, and at 375x667 the hotel's list does from four picks, the shared
day's from four rows and the crew panel from three members. Graded,
because at 375x667 161 of
those 347 bodies hide less than 28 px: "Football Hooligans Presents: Learn
to Chant Like a Football Hooligan!" hides 6, all of it the space under its
last chip, and a 28 px band there dims a chip none of which is cut. The
fifth, because at the event body's floor, 72 px (#74), two 28 px bands
would leave 16 px clear. The padding always, because a padding that
followed the mark would be set after the scroll it is meant to steer. A
cue on Advanced invites a scroll, and a scroll there that also dragged the
sheet away was worse with the cue than without it.
**Cost:** Text inside a band is dimmer than it is anywhere else, by
design, until it is scrolled clear. Within the ceiling of an end a scroll
writes the element's style once a px, and nowhere else. The area's own
scrollbar fades with its content at a marked edge. Three registrations
more in `boot()`, and an observer on each area and each of its children.
The cap is said twice in the stylesheet, as the mask's and as the scroll
padding, and `scroll.js` names the four selectors the stylesheet pads and
a ceiling that must stand above the cap: a style test holds each. At its
72 px floor a body's two bands leave 43.2 px clear, 0.8 short of a 44 px
tap; in 2026 the one control in such a body is its last chip, which stands
at the end, where there is no band. `moreCap()` reads the cap out of the
computed scroll padding's own words, `min(28px, 20%)` in Chromium; where a
browser says it another way the crew pill lands at the body's top, as it
did. Whether the fade draws in Safari on a scrolling area and holds steady
under a thumb is a phone's to check, and jsdom lays nothing out, so the
tests give a node its numbers.

### 77. Cost, sign-up, audience and sold out are filters — Standing (2026-10-03)
**Decided:** The filter sheet (#70, #71) gains four filters, the flags a
row has said since #73 (W7; `docs/screens/contract.md`, section 3, as
built; PR #96). Each is All or one value, and is set, cleared, counted in
the badge and shown as a chip under the box as the other nine are: the
sheet's filters are thirteen.
- **One group, "Getting in",** after Kind and before the toggle: four
  selects two by two, in the topic axes' markup and classes, each with a
  name of its own. Cost: Any cost, No extra fee, Extra fee. Sign-up: Any
  sign-up, No sign-up, Sign-up. Audience: Any audience, Kids, No 18+, 18+.
  Sold out: Sold out or not, Not sold out. A chip under the box says the
  option's own words.
- **Both directions where both are useful,** not switches that only hide:
  "Extra fee" and "Sign-up" find, "No extra fee" and "No sign-up" leave
  out. There is no "Only sold out".
- **The options are fixed lists.** An option is there at 0, so a value a
  word in the box holds always has its option to show. A count stands only
  on an option that names something an event has - "Extra fee (214)",
  "Sign-up (112)", "Kids (88)" and "18+ (105)" in 2026 - counted over every
  event, as an axis's is, by the filter's own rule. An option that takes
  things away says no number, and the main button's count is the true one.
- **18+ is one thing:** a mature audience, or a stated minimum age of 17
  or more, or the listing's own Mature Audience marker - `data.js`
  `isAdult()`, which the word in the box, the select, its count and a
  row's flag all ask. The stated age and the marker are the parse stage's
  (`docs/discover/schema-v2.md`, Facets) and ask no tags, so an event the
  tagger has not reached (#46) is 18+ where its listing says so. A 13+ or
  a 16+ is not 18+. A row's flag says 18+ where `isAdult()` does and the
  listing states no age; a stated minimum still wins the label (#73).
- **Kids is the audience,** not the Kids Track.
- **An event that says nothing:** with no facets it has no fee, no
  sign-up and is not sold out; with no tags, no such age and no marker it
  is not known to be for kids or 18+ - it passes No 18+ and fails Kids and
  18+.
- **The words** already read hold the Audience, a fourth filter a word
  sets (#71). "18+" and "adult" hold it at 18+. "kids", "kid", "family"
  and "children" hold two dimensions, the track at Kids Track and the
  Audience at No 18+, under one chip, "Kids Track". A chip names every
  dimension its word holds, and a tap on either select takes the word out
  whole: the Kids Track goes with a tap on the Audience. Beside "18+" or
  "adult" the explicit word wins, in either order: both give the Kids
  Track's 18+ events. No new word is read: not "free", not "sold out", not
  "sign-up".
- **A schedule with no tags** has Cost, Sign-up and Sold out, and no
  Audience.
- **Not filters:** a game's format and its level.

Amends #70: its "Facet filters (W7) come after step 7", and Clear's nine
are thirteen. Amends #71: the filters a word and the sheet both set are
four. Amends #73: the filter sheet does not read the row's flags - it asks
the facets and the audience themselves - and a row's 18+ asks `isAdult()`.

**Why:** A row has shown its flags since PR #92 and nothing could filter
by them (the step 7 design chat, 2026-10-03). "Getting in": the four
answer one question a reader has of an event before going - can I get in,
and what does it take: a fee, a sign-up, an age, a seat left. Both
directions: "No extra fee" and "Not sold out" are asked at the con;
"Sign-up" is asked before it, to find what needs registering, and switches
that only hide would lose the second. No "Only sold out": no one looks for
what they cannot get into. Not a game's format or level: a row does not
show them, and 7b's rule (#70) was to filter by what a row shows. A count
on an option that takes things away tells a reader nothing - "No extra fee
(3,245)" - and is not what the list shows once photo sessions are hidden,
2,839. One rule for 18+, so that a row and the filter cannot disagree
about an event: in 2026 its three halves name the same 105 events - each
of the 28 that state 17, 18 or 21 and of the 75 that carry the marker is a
mature audience - and every event's flags are what they were. The explicit
word, because "kids 18+" gave the Kids Track's 18+ events and "adult kids"
the track without them: the answer turned on which word was the longer.
**Cost:** The panel's content is 131 px taller, 134 with Larger text, and
the group is below the fold at 375x667, 390x664 and 402x714 (`contract.md`,
section 3, as built). "Not sold out" hides only a listing that says sold
out - one that says its classes are full is not flagged (`contract.md`,
section 14) - so the filter is not a promise. A count is over every event,
so "Kids (88)" lists 66 while photo sessions are hidden. "No 18+" hides a
row whose flag says 16+ - "Puppetry 101 - Adults", a mature audience whose
listing states 16 - and "18+" lists rows flagged 17+ and 21+. "kids" holds
the Audience with no chip of its own, uncounted by the badge, and a tap on
the Audience over it takes the Kids Track too. "adult" is an ordinary word
as well - "young adult" reads as 18+ and "young" - which is older than
this entry and now shows in the Audience select (`contract.md`, section
14). A schedule with no tags shows three selects, the fourth cell empty.

### 78. An arrow where more is below, and room for the focus ring — Standing (2026-10-03)
**Decided:** Two rules at the edges of the sheet's scrolling areas, both
follow-ups to #76 (`docs/screens/contract.md`, section 7, The sheet's
edges, as built; PR #97).
- **The arrow.** Where an area hides 20 px or more below and an element
  follows it in its panel - an event's foot, the hotel sheet's and the
  shared day's Done row, the filters' foot - a small down chevron stands
  centred in the gap just above that element. The fade stays (#76), and
  under 20 px it speaks alone.
- **Outside the area.** The chevron is the `::before` of the element that
  follows, out of the flow: it is outside the scrolling area and outside
  its mask, so it shows whatever the fold lands on, and it moves nothing,
  the element it hangs on least of all.
- **The word.** `scroll.js` `markMore()` writes `data-more` as it did, and
  its value is now a word: `below` while the area hides the threshold or
  more below, and nothing under it - `moreWord()`, a pure function of what
  `moreHidden()` gives. One rule of the stylesheet reads the word, the
  arrow's; the mask hangs on the attribute alone, as it did. The
  threshold, 20 px, stands under the ceiling of 48.
- **Not a control.** No content, no tap, no pointer events, nothing a
  screen reader meets. Two borders of a square turned 45 degrees,
  0.6875rem a side and 0.125rem thick, so Larger text scales it: 15.6 px
  wide and 7.8 tall, 17.9 and 8.9 with Larger text. Its colour is
  `--muted`, 6.3:1 on the sheet, where #66 asks 3:1 of a graphic. It comes
  and goes with no animation.
- **No arrow for more above:** the reader scrolled there. And none on
  Settings' Advanced or the crew panel, which have nothing after them:
  both keep the fade alone.
- **Room for the ring.** The sheet's five scrollers - #76's four selectors
  and an event's panel, `#panel-event` (#74) - take 4 px of inline padding
  and give it back as a negative inline margin of the same size, so a
  focus ring at either side is drawn whole and nothing moves. The 4 px is
  the ring's reach, its 2 px offset and its 2 px width, and a style test
  holds the room equal to their sum: a change to the ring cannot outrun
  it. The ring's own rule does not change, and no ring is drawn inside a
  control but the two that were (`.plans-seg`, `.crew-now`).

Amends #76: its "`data-more`, a bare hook", since the attribute carries a
word; and its fade as the one cue, which cannot show where the fold lands
in a gap.

**Why:** Both faults were found on the next site on 2026-10-03, after
PR #96. A fade can only dim content that is there to be cut. On a 390-wide
iPhone the filter sheet opens with its fold between the Type control and
Kind: the sheet looks complete, and Kind, Getting in and the toggle are
below with no hint. On `next`'s build at 076f8cc, in Chromium with Barlow
loaded, the band as the filter sheet opens holds the last 11 px of the
Type control and 3 px of the Kind label's box at 375x667; the last 14 px
of the Type control and nothing else at 390x664; 9 px and 10 px at 402x714
with Larger text; at 402x714 at the normal size it cuts Kind's first row,
which is why PR #95's phone test passed. The arrow is the cue that does
not depend on the content. Twenty px is about a line of text, and 2026's
bodies part there: on the schedule with no picks, the clock at Saturday
1:05 PM, 374, 304 and 117 of the 3,459 events have a body that scrolls at
375x667, 390x664 and 402x714, and 142, 111 and 17 of them hide under 20
px - every one ends in a row of chips, and hides the space under its last
chip and at most 8 px of the chip itself, which the fade dims in plain
sight; 232, 193 and 100 hide 20 px or more, at least 10 px of a chip among
it. With Larger text 1,125, 1,031 and 506 scroll: 221, 181 and 164 under,
at most 10 px of a chip, and 904, 850 and 342 at or over. In 5, 20 and 2
of the bodies that hide 20 px or more the band holds no text and no chip
at all, 25, 37 and 8 with Larger text: "Diversity In DIY Rave Music" at
375x667 hides 41 px under a fold in the gap below its people. The ring is
drawn 4 px outside its control and a scrolling area clips at its own box,
so a control at an area's left edge lost the left of its ring and one at
the right its right: the Fandom and the axis selects since PR #88, and on
`next` at 375x667 20 of the filter sheet's 39 controls, 10 of an event's
13, 14 of 16 in a hotel's sheet of seven picks, 12 of 14 in a shared day
of six rows, 3 of Settings' 11 and 13 of the crew panel's 16. An iPhone
shows the ring after a pick from a select, which is where it was seen. A
ring inside the control was not the answer: Done and "Show `<n>` events"
are gold, and a gold ring inside a gold button cannot be seen.
**Cost:** The threshold is a number in script, in px, where #76 kept its
cap in the stylesheet: a rule cannot compare what is hidden with a length,
and the element the arrow hangs on cannot read its sibling's property. At
the threshold a scroll writes the attribute once more. An event's panel
scrolling as one (#74) has its foot pinned over the gap, so the arrow
stands over the foot of what shows of the body until the panel is at its
end: over its last 4 and 7 px at 375x667 and 390x664 in #74's tallest
case, and with Larger text over a body of which 10, 37 and 80 px show at
375x667, 390x664 and 402x714. A ring is still cut at an area's top or
foot, where its first or last thing is a control and the area is at that
end - block padding would change heights - and at the foot of an event's
panel on every sheet, where the star, Add this to calendar and Done lose
the bottom of theirs (`contract.md`, section 14). Each area is 8 px wider,
so a drag that starts in the 4 px beside one scrolls it where it dragged
the sheet. The stylesheet names the three elements an arrow hangs on, and
a new area with something after it needs its own. Whether the arrow draws
in Safari on the filter sheet, and the ring whole after a pick from a
left-hand select, are a phone's to check.

### 79. Where a chart gives areas alone, a room's sides are whole feet in the plan's shape — Standing (2026-10-03)
**Decided:** Builds on #67's sizes. Where a hotel's chart gives each room's
area and not its sides, a room's sides are the whole feet whose product is
the chart's area and whose shape is the plan's, a row of rooms sharing the
side the plan draws them sharing. The Courtland Grand is drawn so: Atlanta
1 to 5, 832 sq ft each, are 32 x 26, five in a row, 130 x 32.

**Why:** #67 takes a room's sides from the hotel's table, and the Courtland
Grand's chart prints none. Its plans are pictures with no scale, so the
plan alone cannot size a room. The areas factor into whole feet that add
up along each row to the chart's own combined rows: 137 x 70 for the
Capitol Ballroom's 9,590, 130 x 116 for the Grand Ballroom's 15,080.
**Cost:** The sides are inferred, not printed, and no test holds a drawing
to them. Where the chart's rows disagree with each other - the Atlanta
Ballroom at 4,100 where five 832s make 4,160, the Salon Hallway at 3,432
where the ballroom leaves 2,600, Salon F at its own row's 966 where the
combined rows count it as 1,008 - the single rooms' areas are followed.
The Grand Ballroom is drawn at 116 x 130 where the plan draws about
122 x 140.

### 80. Explore's filter box is built once, and a pull's redraw is not gated — Standing (2026-10-04)
**Decided:** Two rules, the second resting on the first
(`docs/screens/contract.md`, section 4, The filter box, as built;
`docs/sync/contract.md`, section 5, as built; PR #100).
- **The box is built once.** While the grid is what Explore draws,
  `#exploreQ` is made by the first draw and is the same node after every
  later one, as Search's box is. A later draw writes what stands above
  the sticky block, the jump chips and `#exploreGrid`, and sets the box's
  value from `state.explore.q` only where the two differ - never while
  the reader types, when they agree. The node kept is the whole fix: its
  focus, its caret and an iPhone's keyboard stay because nothing replaced
  it.
- **Nothing is added, removed or moved.** The view's children are the
  kinds they were, in the same order, Following first when there is one,
  and the jump chips stay the sticky block's own child. No screen looks
  different.
- **A page** replaces the view as it did, and the way back builds the
  grid anew, the box with it and its text kept.
- **The gate goes.** A crew's change pulled, and the crews forgotten, ask
  for a redraw on any tab, as the reader's own picks and follows do: one
  rule for a pull. `sync.js` `redrawCrew()` and `CREW_TABS` are gone, and
  `sync.js` reads neither `state` nor the sheet's markup. An open sheet
  is refilled in place by `render()`, as it was.
- **Not here.** What had focus elsewhere on the grid - a tile, a fold, a
  row - is still lost when the grid is drawn again: step 11's sweep
  (ROADMAP, Flags).

Amends #53's redraw for a crew's change, which was asked only while a
crew screen was on screen (PRs #77, #81 and #82).

**Why:** A redraw replaced the box under the reader. On `next`'s build at
c799393, in Chromium at 375x667, 390x664 and 402x714, with something
followed and "star" typed in the box, the caret inside the word: after a
whole draw - `render()`, asked by a `hashchange` - the box is another
node, focus is on the body, the caret reads 0-0 and the next key typed
goes nowhere; the same after a tap on the Following heading. It is the
fault `browse.js` records for Search's box,
where an iPhone's keyboard was left on a node that was gone. What draws
the page while the reader types there: a pull of the reader's own picks
or follows - another device's - on any tab; a return to the page; and a
tap in Explore that draws it whole - the Following heading, By interest
and By time, Show more, Already happened, an unfollow, a star on a
Following row - since an iPhone does not move focus to a tapped button,
so the box still has the keyboard. The gate was a guard for the box and
nothing else: with the box kept it has no reason left, and the other
three pull requests of step 8 put more on Explore that redraws.
**Cost:** A redraw on Search and on Explore that draws nothing new, since
neither shows a crew - spent work, and only when a pull runs: at a
trigger, never on a timer (#53). A kept box keeps the `value` attribute
it was built with while its value follows the filter, so once text is
typed and the page drawn whole, the view's markup differs from `next`'s
in that one attribute. A tile, a Following chip or a suggestion tapped
while the box has the keyboard still opens a page, which takes the box
away with the view; focus goes to the page's heading (#75). A key typed
while the box is off screen now lands in it, and the browser scrolls the
box into view - in Chromium at 375x667 to the foot of `main`, under the
mini-bar and the nav, where a key typed in a box scrolled away already
put it. What an iPhone's keyboard does through each of these is a
phone's to check.

### 81. Browser tests: Playwright, thin, in two engines at three sizes — Standing (2026-10-04)
**Decided:** A second kind of test runs the built page in real browsers
(`npm run test:browser`; `tests/browser/`; PR #101). It amends #24's
trigger - Playwright came with a layout fault, not with a change to
`sw.js` - and uses #57's leave. `@playwright/test` drives Chromium and
WebKit at the three sizes the reviews use, 375x667, 390x664 and 402x714,
as a phone, touch on, against `dist/` built afresh for the default year
with no channel and no backend and served by the harness, which never
uses a server it finds; the worker is blocked, the clock is `?now=`, the
zone is the season file's. Barlow is always the face measured: its four
weights come from `@fontsource/barlow-semi-condensed` in place of the
Google Fonts request, a test fails where one did not load, and a request
to any other machine fails it too. It is kept thin: two standing checks
on each of the five tabs, for a stranger and for a reader with picks and
follows, at a moment during the con and one before it, and a named test
for each layout fault from here on. Nothing scrolls sideways: `main` and
the page are no wider than the screen. No control is cut off: every
button, link, input, select and textarea that is shown lies inside every
ancestor that clips it, on each axis, up to the first ancestor that
scrolls on that axis - what is past a scroller's edge is reached by
scrolling, and is not cut - and a control in a fixed element is checked
up to that element, then against the screen. No retries, here or in CI,
and no waits by the clock. Left out: pictures kept and compared; the
worker, offline and install, which stay Delivery's (#24; ROADMAP); the
accessibility sweep, step 11's, which adds to this harness (#66); and
the sheet's panels, which the pull request that touches one adds. And it
is not an iPhone: no iOS keyboard, no safe-area insets, no home-screen
app, and `IS_IOS` is false in both engines. Those stay checks on a phone.

**Why:** jsdom has no layout: it knows what is on the page and not where,
nor how wide. Four layout faults reached a phone that no test could see -
one in PR #81, one in PR #82, PR #95's fade at 390 wide, and the header's
chip (#82). The stop at a scroller is the rule: without it every row
below the fold and every chip in a sideways row reads as cut.
**Cost:** A fourth CI job, `browser`, and its minutes on every pull
request - about three when it was added, the longest of the four jobs -
which grow with every test; it is required on `next` once it is
added to the ruleset by hand, after its first green run there, as
`database` was (#26; ROADMAP, Checklist). Two dev dependencies, each
pinned to an exact version, which move by hand - Dependabot is for
actions alone (#26) - with CI's cache of the engines keyed by the
Playwright version, so a moved pin fetches its own; the engines'
system libraries come by apt at every run. A one-time install of the
engines on each machine (README). A check that is skipped is named,
dated, says why and has a ROADMAP Flag.

### 82. The simulated-time chip stands after the clock, with a tap area 44 px tall — Standing (2026-10-04)
**Decided:** While the clock is simulated the header's chip is drawn
whole - at every size, in both engines, with Larger text on, whatever the
hour and whatever the freshness line says: the words give way, never the
chip (`docs/screens/contract.md`, section 1, The chip, as built; PR #101).
`#simChip` stands between `#clock` and `#fresh`, a note on the clock, so
the end of the line is words, which take the ellipsis after
`fitHeaderLine()`'s two steps; nothing new is measured, and a screen
reader meets the clock, the chip, the freshness line and then the gear.
Its tap area is its `::after`, 18 px above the chip's box and 9 below:
44 px tall or more, and uneven so that it ends inside the header on every
tab, with Larger text too. The line clips what leaves it, so the line is
given that room as padding and takes it back as margin: nothing moves,
and the header is no taller. The browser tests hold all of it (#81),
and no rule over the stylesheet does.

**Why:** The chip is the one tap back to the real clock, and on a phone
it was not drawn: it stood last in a line that is one line, and an
ellipsis drops whole a box that does not fit. On `next` it was cut at 375
and at 390 wide at any hour, and at 402 under a wider clock - "Thu 10:00
AM" - or with Larger text on, in Chromium and in WebKit alike. At 402
wide, at 1:05 PM, with Larger text off, WebKit on Windows draws it with
7 px to spare, so why an iPhone of that width never showed it is not
settled by any test here. And it was 20 px tall where #66 asks 44.
**Cost:** While a clock is simulated the freshness line is cut short
sooner - at 375 wide its "Mon 8:50 AM" ends in an ellipsis - which only a
simulated clock ever shows. The line's box is 27 px taller than its
text, by padding its margin takes back: a later rule on `.hdr-line` keeps
both, or the chip's area is clipped. A chip tapped by keyboard goes with
focus on it, and focus falls to the page: older than this, and step 11's
sweep's (ROADMAP, Flags).

### 83. A pull request's docs are written once — Standing (2026-10-04)
**Decided:** A pull request's docs are written once and short; CLAUDE.md,
rule 12, has the words.
- **This log:** one entry a decision, 25 lines at most, with no tables or
  censuses: at most the one number that decided it. An older entry it
  changes gets "amended by" or "superseded by" on its heading, no more.
- **The contracts** (`docs/screens/`, `docs/sync/`, `docs/pipeline/`): no
  new "as built" part, nothing added to one; a section built gets one line.
- **The evidence** - what was measured, the suites' counts, a mutation
  pass - goes in the pull request's description, once, and in no file.
- **`tests/PORT-LEDGER.md` is frozen;** a test's bracket stays as it is.

It amends no entry by number: it ends a practice no entry asked for, the
"as built" parts and the notes appended to headings.

**Why:** Docs lines passed code lines: the 18 feature and fix pull requests
of Where things live (#74 to #97) changed 4,501 lines of code and 5,004 of
docs. An "as built" part repeats the entry, the pull request and the tests.
And CLAUDE.md's rule 1 has every session read this log and ARCHITECTURE
whole, so every later session pays for what a pull request adds.
**Cost:** A pull request's measurements are on GitHub, in the pull request,
and not in the repo, so a reader of the repo alone no longer finds them.
An "as built" part can say something a later pull request changed, with
only its "Changed by" line to say so, until the parts are moved out.

### 84. Mute: not suggested, and nothing else — Standing (2026-10-04)
**Decided:** A reader can say "not this" of anything they could follow
(W5; PR #103; `docs/screens/contract.md`, section 4).
- **One thing.** A muted thing is no longer suggested: not in Because you
  starred, nor in For you when it is built, which asks `isMuted()`. A mute
  hides nothing - not in Search, on the thing's page, in Following or in
  the grid.
- **One or the other.** Muting unfollows and following unmutes, on every
  road: a tap, a follow a pull brings, the handle. An unfollow a pull
  brings leaves a mute alone.
- **On the device.** Kept by `{kind, key}` beside the follows, under a key
  of its own, and not synced in 2027: no column, no outbox op.
- **Where.** Mute stands beside Follow on a page, and a muted page says so
  in one line. The muted are in a fold, "Muted (n)", after Because you
  starred, each a chip whose x unmutes; a suggestion's tile has no x.
- A mute is of one thing, by its id. Every control this adds is 44 px tall
  or more (#66), a fold's button with them wherever the app draws one.

**Why:** A suggestion the reader cannot turn down comes back at every
visit. Hiding would be another promise, and a wrong one: a muted guest is
still on the panels of a fandom the reader follows.
**Cost:** A mute does not follow the reader to another phone. One made of
something followed, with no session, is undone by the first pull after a
sign-in, which brings the follow back by the union rule (#53). What a
fandom's mute means for the fandoms under it is For you's to decide.

### 85. The cast group in Search and in Following — Standing (2026-10-04)
**Decided:** The "With the cast" group a fandom's page ends with (#39) is
Search's and the Following feed's too (W6; PR #103). One function,
`data.js` `castEvents()`, answers for all three: the events linked to the
fandom by a credit that are not about it.
- **Following,** By interest alone: a followed fandom's block ends with
  the fold, shut, counting the cast's events still to come. Open, its
  photo ops and signings are behind the page's button. By time is as it
  was.
- **Search,** only with the Fandom filter set and no word to rank by:
  after the list, a fold, open, of every cast event that passes every
  filter in effect but the Fandom's. A word that ranks is a text search
  and has no group (#36). Every count is the list's alone, and an empty
  list over a group says "No events about" the fandom.
- **No button in Search.** What the filters leave is the group: the photo
  and video filter stands for the photo ops' button there.
- Amends #32 and #39, on the feed and on search.

**Why:** #32 decided both groups wherever a work is followed or searched,
and #39 built the page's alone: 43 of the 106 fandoms in the Fandom select
have a cast, which only a visit to the page showed. Search's own filter
already holds back what the page's button does.
**Cost:** Two rules for photo ops: a button on a page and in the feed, a
filter in Search. A word that ranks loses the group. The feed's fold
counts what is to come, where the page's counts every one.

### 86. What is tapped stays where it stood — Standing (2026-10-05)
**Decided:** A control that is tapped, and is still there after the draw,
stands where it stood, to 1 px, wherever the page is scrolled; where the
tap takes the control away - Show more, a photo ops' button, a chip's x -
what stood just above it stays (PR #104; `docs/screens/contract.md`,
section 0). It is `togglePick()`'s rule for the star, made every tap's.
- **The page's scroller does not anchor:** `overflow-anchor: none` on
  `main`, one declaration, and no script.
- **The browser tests hold it** (#81), the star's row too: [53] and
  [1240], which could not fail, are deleted.
- **No rule helps one case:** a fold shut at the foot of the page, where
  the page becomes too short to hold it.

**Why:** Since #80 a draw of Explore's grid keeps the filter block, and a
browser that anchors its scroll holds a kept node still, by scrolling,
when what stands above it changes height. With the block on screen under
a fold, the list the fold opened stood where the fold had been: Already
happened went 321 px up and off the screen, in both of the browser
tests' engines. For you puts a Show more in the same place.
**Cost:** A draw nobody tapped for - a pull that brings the reader's own
picks or follows, a return to the page after events have passed - no
longer leaves Explore's grid held where what stands above it changes
height. The grid moves by the difference, as it did before #80 and as it
does in a browser that never anchored; our own code does not hold it.

### 87. For you: a short list with its reasons, at the top of Explore — Standing (2026-10-06)
**Decided:** A reader with a pick or a follow finds For you first on
Explore's grid: events not starred that fit the gaps in the plan, each
saying why (W3; PR #105; `docs/screens/contract.md`, section 4).
- **Three parts:** what scores and what is chosen are `src/foryou.js`'s,
  what is drawn `explore.js`'s; a later way of guessing is one more signal.
- **What scores:** a follow, what Following lists for it, at three times
  its rarity; the picks, what they share - a fandom from one pick, a
  track or a topic from two, never a person - by the picks that carry
  it, three at most. What reads as one reason weighs as one.
- **What is chosen:** nothing started, cancelled, picked or overlapping a
  pick of four hours or less; no photo op, signing or second session.
  Best first, two rows a reason by its words, eight rows, four shown.
- **Mutes:** an event carrying a muted thing is out unless a follow
  brings it; a muted fandom mutes the fandoms under it.
- **It holds still:** worked out when the grid is drawn from somewhere
  else, kept while the reader stays on it; an empty list is never kept.
- **Following** is folded under a For you that has a row, until the
  reader taps its heading; then what is stored is what is shown.

**Why:** Nobody reads Following whole. A sampler earns its place by
saying why each row is there, from the profile alone (#22, #32), and by
not moving under a finger (#86).
**Cost:** A starred row, an unfollowed thing's rows and one whose event
has started stay until the grid is left. Weights are by hand, untuned.

### 88. The zero state: Start here and the big ones, computed — Standing (2026-10-06)
**Decided:** Where For you has no row, the zero state stands in its place
(W16; PR #106; `docs/screens/contract.md`, section 4).
- **Computed, not curated:** no file kept by hand, nothing to validate.
- **Start here,** a heading and one line on how the app works, is a
  stranger's alone - no pick and no follow, whatever is muted - and the
  grid's hint line goes while it stands.
- **The big ones** stand in for an empty For you, for anyone: Main
  Programming's celebrity events still to start, soonest first and then
  by id, four shown and Show all for the rest. None cancelled, a photo op
  or a signing, or carrying a muted thing (#84); one session of anything,
  and a pick is a session already had.
- **It holds still with For you,** by a narrower rule: kept while the
  follows are as they were and every pick added or taken since is one of
  its own rows. A follow, or a pick from anywhere else, works the top of
  the grid out again, as an empty For you always was (#87).
- **With nothing to list** - after the con, or no such track - Start here
  stands alone.

**Why:** A stranger got one hint line on the tab the app opens on before
the con (#62). After one star For you usually has nothing yet - no row for
16 of the 23 big ones before the con - so the list stays to star from. The
hold is narrower because a sign-in's pull must still bring For you at once.
**Cost:** One track's name is the rule, judged on 2027's schedule in August.
A star in it that gives For you a row shows it only once the grid is left.

### 89. The Map view is built once and drawn in place — Standing (2026-10-06)
**Decided:** The Map's first draw builds its view, and every later draw,
`render()`'s or the minute's, writes in place only what changed (PR #107;
`docs/screens/contract.md`, section 6).
- **Built once:** the sticky strip and its chip row, the wrap, the band
  under the map, and in the SVG the ground, the streets, the bridges and
  the seven blocks, then three empty groups: rings, focus, pills. The page
  says what is built, as for Explore's box (#80), and no flag does.
- **Written where it differs:** the day chips, each block's label, the
  wrap's day, the three groups, and the card with the off-map line.
- **`tickMap()` is that draw,** and says whether it wrote. Both signatures
  are gone.
- **Two things a reader can see.** The next ring's pulse no longer starts
  again on a draw that leaves the rings alone: a star, a sheet closed, a
  pull. And at the minute the con ends the tick takes the card away, as a
  whole draw does; the old tick left it standing.
- `scroll.js` `drawInPlace()` reads a part's markup in an element of the
  part's own kind, so a part of an SVG is drawn as SVG.

**Why:** Step 10 animates these elements, and an element that is replaced
ends its animation. It is the last of #60's prerequisites (#28's Cost).
**Cost:** A draw builds every part's markup to compare it. A part added
later must be added to the draw. Five tests that assumed a rebuild now
assert a kept node or read the SVG's whole order.
