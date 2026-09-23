# Architecture

What the system **is** as of the `next` branch, September 2026. Not what is
planned — that lives in DECISIONS.md, VISION.md and the roadmap. Update this
file in the same PR as any change that alters the shape described here.

## In one paragraph

A Python scraper turns the official Dragon Con app's web view into one JSON
file, frozen for 2026. Beside it, tags v2 derive a second one - people,
facets and tags from the registries and a cache of a model's answers, and
the works those tags name - and that is the file the client reads. A web
app, built by Vite into a single HTML file, reads it, lets you search,
star, and plan, and stores your picks in the browser. A service worker
keeps the app usable with no signal. GitHub Pages serves it; there is no
backend.

```
app.core-apps.com/dragoncon26          (official schedule, HTML)
        │  scraper.py, as it ran in 2026  (fetch, parse, dedupe, carry tags over)
        ▼
data/2026/events.json  (frozen; its v1 tags are tag_events.py's, now retired)
        │  tags v2, reading it and never writing it:
        │  parse_stage.py  people, facets; no model
        │  tag_stage.py    Claude, once an input ──► data/2026/tags.cache.jsonl
        │                  unknown works minted ──► data/registry/works.json
        │  events_v2.py    no model
        ▼
data/2026/events.v2.json  (people, facets, tags v2, the works block)
        │  fetched by the page; cached by sw.js
        ▼
index.html + src/  ──vite build──►  dist/index.html  (the whole client, inlined)
        │                                   └──►  localStorage (picks, settings)
   GitHub Pages  (main → live site: the 2026 one-file app, served as-is;
                  next → dev site: the built dist/)
```

## Repo map

| Path | What it is |
|---|---|
| `index.html` | The Vite entry template: the page's head and body markup, a link to `src/styles.css` and the module entry. Not runnable as a static file. |
| `src/main.js` | The entry: imports `styles.css`, then calls `boot()` from `boot.js`. |
| `src/boot.js` | The root of the client: `boot()`, which wires the app and starts it, and nothing else. See Boot. |
| `src/dispatch.js`, `shell.js`, `loading.js`, `sheet.js` | The four modules above the views: the handlers that span modules; `render()` and what is on screen whatever the tab; loading, freshness and offline; the bottom sheet. |
| `src/now.js`, `browse.js`, `explore.js`, `map.js`, `mine.js` | The five views, one per tab (`browse` is the Search tab). |
| `src/scroll.js`, `bus.js` | The scroller and the header's measurement; how a module below the shell asks for a redraw. |
| `src/util.js`, `storage.js`, `platform.js`, `build.js`, `state.js`, `time.js`, `venues.js`, `data.js`, `picks.js`, `follows.js`, `ics.js`, `leave.js`, `search.js`, `ui.js` | The fourteen leaves: what everything else stands on. "The client: modules and their order" has a paragraph on each layer. |
| `src/styles.css` | All the CSS. |
| `public/` | Served and copied verbatim: `sw.js` (service worker: offline caching, schedule revalidation), `manifest.json`, `icon.svg`, `icon-*.png`, `og-image.png` (PWA install and link-preview assets), `.nojekyll`. |
| `vite.config.js`, `build/vite-dc.js` | The build: single-file output, and this project's own plugin (`dcBuild`) for the HTML fix-ups, the channel stamp and the `data/` copy. |
| `dist/` | Build output, not in git: `index.html` with the CSS and script inlined, the files from `public/`, and the one file from `data/` the client reads. |
| `data/2026/events.json` | The frozen 2026 schedule: 3,459 events, 2.7 MB. Read by tags v2, which never write it, and by the live site's one-file app on `main`; the client on `next` reads `events.v2.json` (DECISIONS #39). |
| `data/2026/tags.cache.jsonl` | The tag stage's answers, one a line, sorted by the hash of what the model was sent (DECISIONS #34): names, never ids. `tag_stage.py` alone writes it; a line corrected by hand says `"model": "hand"`. |
| `data/2026/events.v2.json` | The frozen schedule with `people`, `facets` and tags v2, built by `events_v2.py` from the frozen file, the registries and the cache. Before the events, a `works` block (DECISIONS #38): every work an event links and every ancestor of those, sorted by id, each row the registry's `id`, `name`, `aliases`, `terms`, `reviewed` and, where it has one, `parent` - what the client reads a work by, never a registry. The other top-level fields are the frozen file's. The file the client reads (DECISIONS #39), and the only one the build copies from `data/`. |
| `data/registry/` | The three curated registries `registry.py` owns, below, and `people.draft.json`, the drafter's sidecar - `known_for`, confidence, the event titles, the minted work ids and the rejections, which the loader ignores. `works.json` also holds the works the tag stage minted, `reviewed: false`, which the sidecar does not list, so the review page never prunes them. Cross-year, unlike `data/2026/`, because a work or a person outlasts a con. The client never reads them (#31) - what it needs of a work is in `events.v2.json`'s block - and the build does not copy them into `dist/`. |
| `data/2026/season.json`, `data/2027/season.json` | A year's settings, by hand (`docs/pipeline/contract.md`; DECISIONS #44, #46, #48): the source's slug, base URL and day strings, the con's first and last day, the time zone, the cron window - `null` in 2026, which is `frozen` - the prompt version and the run's thresholds. `season.py` validates them, and the fetch (`scraper.py`) reads one: the source, the day strings, the year, the listings floor and the failure ceiling, and `frozen`. |
| `data/2026/venues.json`, `data/2027/venues.json` | The venues file (DECISIONS #45), by hand, one copy a year: per hotel its keys, short name, group, colour variable, order, whether it is placeless and how its room is shown; its levels, with their rooms, aliases and notes; its rooms of no known level; and the walk matrix with its three minute values. The two are identical, migrated from the retired `docs/venues/registry.json` and `src/venues.js`'s constants by a one-off script outside the repo. `venues.py` validates both, and `tools/room_census.py` reads 2026's. The client keeps its own walk and hotel constants in `src/venues.js` until PR 9; `tests/rules/venues-data.test.js` holds the two copies equal. |
| `data/2027/ids.jsonl` | The ids stage's ledger (DECISIONS #43; `contract.md`, The ledger): one line per id, sorted, each with its source ids, the moves out of it, its key at last sight and its stamps. Committed empty: it exists from the season's first commit, and its absence is fatal. 2026, frozen, has none: its ids are its source ids. |
| `scraper.py` | The fetch stage (DECISIONS #41, #42, #44): `python scraper.py --season data/<year>/season.json` writes the year's `source.json`, one raw row per listing, the text repaired before whitespace is collapsed; `fetch()` returns the rows, the failures and the run summary's counts, and `carry()` is its carrying of the previous file's rows on its own, which the 2026 replay calls too. It no longer splits the hotel, dedupes, carries tags or writes `events.json`: the hotel and room split is `venues_stage.py`'s, and `is_cancelled`, `extract_panelists`, `dedupe` and `merge_group` stay as functions for their readers until PR 6, and `dupe_key` and `norm_text` moved to `ids_stage.py`, imported back for `dedupe`. See The data pipeline. |
| `ids_stage.py` | The ids stage (DECISIONS #43; `docs/pipeline/contract.md`, The ledger): `assign(rows, ledger, stamp, thresholds)` gives every raw row our id - the live rows grouped by `dupe_key`, a group keeping the id its members map to, the smaller surviving a collision, a gone line's id taken only on an exactly equal key, a split decided by membership, then key - and returns the rows with their ids, the groups, the new ledger and a report, UNSURE pairs among it; `read_ledger` and `write_ledger` read and write `ids.jsonl`. Fatal as `IdsError`. It owns `dupe_key` and `norm_text`, which `scraper.py` imports back for `dedupe` and the history and room tools import. Standard library, and no command: nothing runs it yet but the replay and the tests, and PR 8's orchestrator will. |
| `tag_events.py` | The 2026 tagger, retired: its `main()` refuses to write the frozen file. It keeps `KINDS`, `TOPICS`, `CANON`, `parse_json_array` and the two transports, which the census, the drafter and the tag stage import. `call_claude_code` sends the prompt on stdin; with `isolated=True`, the tag stage's call, it runs `claude -p` with no tools, no MCP servers and no saved session, from an empty directory of its own, and reports the model that answered. |
| `tag_stage.py` | The tag stage of tags v2 (DECISIONS #34): each distinct input - the title without its price or clock marks, type, tracks and the description without its panelist line - is asked of `claude-sonnet-5` once, 25 to a request, and the answer, held to the closed lists, is cached in `data/2026/tags.cache.jsonl` after every request. Then mint: every cached work name the registry cannot resolve becomes a `works.json` row, `reviewed: false`, placed under a parent by one request, the file written once. `--dry-run` calls nothing; `--mint-only` mints with no model. |
| `events_v2.py` | Builds `data/2026/events.v2.json` with no model: the parse stage's people and facets, every person's id through the registry, tracks through `tracks.json`, the cached answer by key, and the merge - works about > track > credit, a track's axes over the model's, mature > kids > all, play on gaming, guests from reviewed tiers; then the works block, from the merged events: each linked work and its ancestors. A cache miss, an unresolved work name or track stops it; a name that is a registry term is dropped and counted. `--check` exits 1 if the file on disk is stale. |
| `census_v2.py` | Census v2 (DECISIONS #35): the questions of `census-2026.md` asked of `events.v2.json`, and the lists owed a reviewer - the unreviewed works that events link, the drafted people, the people on qa, photo and signing events whom `people.json` does not hold, and the links worth a look - written to `docs/discover/census-v2-2026.md`. It builds `events.v2.json` in memory first and stops if the file on disk is stale; `--check` exits 1 if the committed report is not a fresh render, and CI checks the same. It never links: it matches text only to choose rows, and every row that comes of it is UNSURE. It imports `tag_census.py`'s markdown helpers and loads the pilot's `EVERYDAY` by path; nothing on the tag or build path imports it. Two runs give the same bytes. |
| `tag_census.py`, `docs/discover/` | A read-only census of the tags in `events.json` - coverage, fandoms, topics, people, title facets, recurrence - written to `docs/discover/census-2026.md`: evidence for the Discover design work, facts only. Standard library; it imports the taxonomy from `tag_events.py` and the facet patterns, the title key and the panelist splitter from `parse_stage.py`, writes nothing under `data/`, and two runs give the same bytes. Not part of the pipeline: nothing runs it but a person. |
| `parse_stage.py` | The parse stage of tags v2 (DECISIONS #32): `people` and `facets` read out of an event with no model. Pure functions and the standard library; it owns the facet patterns, the title key, the "Additional Panelists:" splitter, `strip_panelists` (the description the tagger is sent) and `person_slug`. `--out PATH` writes the parsed events for inspection; it writes nothing under `data/` and nothing it writes is committed (#13, #33). |
| `parse_report.py` | What `parse_stage.py` reads out of the frozen schedule, written to `docs/discover/parse-2026.md`: per facet the count beside the census's figure for the same wording, the people, and four UNSURE lists. Imports `parse_stage` and the census's markdown helpers. Two runs give the same bytes. Nothing runs it but a person. |
| `registry.py` | The curated registries (DECISIONS #31): `works.json`, `people.json` and `tracks.json`, cross-year and hand-edited. `load()` validates all three and raises one error listing every problem; `resolve_work` / `resolve_track` / `resolve_person` turn a name or an alias into an id, and `is_term` says whether a name is a term, which never resolves. It owns `AXES`, the four closed axis lists, which the tag stage imports. Standard library, plus `parse_stage` for its folding. |
| `season.py` | Loads and validates a `season.json`: every field present and no other, dates ISO, a span's first day not after its last, the three fractions in (0, 1] and the request cap a positive whole number; one error lists every problem. Standard library. The fetch reads a season through it. |
| `venues.py` | Loads and validates a `venues.json` (DECISIONS #45): every field present and no other, hotel keys whole tokens and unique across hotels, level and room ids unique within a hotel, each alias written folded and naming rooms of its level, each walk pair two hotels of the file, whole minutes; one error lists every problem, and a pair of placed hotels with no walk time is a warning, the default used. Helpers only: the hotels in order, and the level a room is on. The split and the reading of a room string are `venues_stage.py`'s. Standard library. |
| `venues_stage.py` | The venues step (DECISIONS #45; `docs/pipeline/contract.md`, `venues.json`): `resolve(rows, venues)` gives every row `hotel`, `room`, `level`, `rooms` and `place`, and a report. The split matches every hotel's keys against the location, longest first, whole tokens; the reading is an alias, an exact room, the grammar - the Mart's three rules, the census's eight combined-string rules, three rewrites, partitions, the hotel alone, a floor alone, a trailing note - a level, the hotel alone, or none at a placeless hotel, whose room string is first split once more against the placed hotels' keys. The report counts the places and lists the worklist, the unplaced rooms, the locations no key begins, the re-splits, the alias hits and the rules' firings. Pure and standard library; nothing runs it yet but the room census and the tests, and PR 6's build will. |
| `draft_people.py` | Drafts people into `people.json` with a model, for review (DECISIONS #31): everyone on a `guests: celebrity` event, skipped when the registry already resolves the name or the sidecar records a rejection, so a second run calls nothing. Reuses `tag_events.py`'s two transports; Opus by full id, `claude-opus-5`, on the API and on Claude Code alike (see Sharp edges). `--parents` is a second, narrow pass that gives each work it minted a parent from the registry. Nothing it writes is reviewed. |
| `tools/` | Tools a person runs, not part of the build and never copied into `dist/`. `review-people.html` + `review-people.js` are pages opened from disk - no server, no network - and the review for `draft_people.py`'s output: one card a person, tier and credit controls, and an export of the three files formatted as the drafter writes them. The state changes are pure functions in the `.js`, which is a classic script - no import, no export - because a browser refuses an ES module over `file://`. `tag_pilot.py` is the tag stage's pilot: `sample` picks about 150 inputs, and `compare` reports how runs of the tag stage into scratch caches agree. It string-matches work names against event text to choose test events, which the tag stage must never do, so nothing on the tag or build path imports it. `sample_v2.py` makes `tests/sample-events.json`, the page tests' v2 fixture, from the v1 sample: people and facets from the parse stage, the five tagged events' fandoms as works and topics as axes, one parent chain for a roll-up, and the works block. `schedule_history.py` walks every commit on `main` that touched the 2026 schedule, diffs each version against the one before by id and by the dedupe's key, adds scrape.yml's runs where `gh` can list them, and writes `docs/pipeline/history-2026.md`. `room_census.py` reads every location of the frozen schedule through the venues step, `venues_stage.py`, against `data/2026/venues.json`, and writes `docs/venues/census-2026.md`, the off-season coverage report (#45): each hotel's strings as the step reads them, the curation worklist, the rooms no string reaches and the rules' firings. It has no grammar of its own, and writes neither input. `replay_2026.py` replays the ids stage over the 2026 versions `schedule_history.py` reads - each converted to raw rows and carried as the fetch carries them, the ledger in a temp folder - and writes `docs/pipeline/replay-2026.md`: which frozen ids ours differ from and how, #43's named checks, each version's counts and the UNSURE pairs. None of the three reports is held fresh by CI. |
| `make_icons.py` | Renders the PNG icons and the preview image into `public/`. One-off; needs Pillow. |
| `tests/helpers/` | `page.js` boots the app in Vitest's jsdom for a page test; `act.js` is the few gestures the page tests share (type, tap, touch, watch for mutations). |
| `tests/page/` | Vitest, one file per part of the app: the source, booted in jsdom, driven through the DOM and `boot()`'s handle. |
| `tests/unit/` | Vitest: pure exports, imported by name from the module that holds them, with no page. |
| `tests/rules/` | Vitest: rules over the text of `src/styles.css` and of every module under `src/`, and over the module graph (`imports.test.js`); and `venues-data.test.js`, `data/2027/venues.json`'s walk and hotel constants against `src/venues.js`'s, which PR 9 deletes with the constants. |
| `tests/real-data.test.js` | Vitest: search quality and Explore against the real `data/2026/events.v2.json`. |
| `tests/build.test.js` | Vitest: what `vite build` leaves in the output folder, stamped and unstamped, and a smoke that boots the built page. The only test that executes `dist/`. |
| `tests/PORT-LEDGER.md` | Where each assertion of the old smoke harness went, and how. A record. |
| `tests/test_parse.py` | Scraper parsing - the day list, the detail page, the raw row - and the functions kept for later stages: the cancelled rule, dedupe. |
| `tests/test_fetch.py` | The fetch stage on a fake source, with no network: the rows and their order, a failed page carried stale or named alone, a listing gone carried removed and every move between the two flags, each fatal rule at its boundary, `--limit`, the file's bytes, the repair before whitespace is collapsed and a clean page untouched by it, and `main()`'s frozen refusal and its `--previous`. |
| `tests/test_ids_stage.py` | The ids stage: `scraper.carry()`, a fixture for each rule and each fatal one, the UNSURE pairs and their fold, the ledger's file and its bytes, that `assign()` changes neither input, and the mini-history run end to end, its ledger the same under two hash seeds. It reads no `data/`. |
| `tests/test_replay_2026.py` | The replay tool: a committed event made a raw row and back, and its report rendered on the mini-history - how each differing id came by ours, the named checks passing and failing, a version that trips a fatal rule - and the same under two hash seeds. It runs no git and reads no `data/`. |
| `tests/mini_history.py` | Five versions in the frozen file's shape, run by both ids tests: a match across a gap, a return, a split each way, a collision and an UNSURE pair. Not a test file. |
| `tests/test_tag_census.py` | The census's pure functions and its repeatability, on an inline fixture; it never reads `data/`. |
| `tests/test_parse_stage.py` | The parse stage's splitter, slug, roles, people and facets, on inline fixtures built from real lines and titles; it never reads `data/`. It pins the copy of `scraper.extract_panelists` that `parse_stage` keeps. |
| `tests/test_draft_people.py` | The drafter with the model mocked: candidates, the skip, credit resolution, the cap, the parents pass, and the transport's encoding. |
| `tests/test_registry.py` | One failing fixture per registry rule, the slug and resolve functions, and a load of the committed `data/registry/`, so CI checks every later edit to it. |
| `tests/test_tag_stage.py` | The tag stage with the model mocked: the input and its key, the prompt, the checks before an answer is cached, the cache, the retry, mint and its parents request, a rewrite of the committed `works.json` that changes no line, and that neither stage imports the pilot or the census. |
| `tests/test_events_v2.py` | The build's merge rules and hard errors on inline fixtures, its bytes under two hash seeds, that it never touches its input - and a fresh build of the committed data compared byte for byte with `data/2026/events.v2.json`, so an edit to a registry or the cache with no rebuild fails CI. |
| `tests/test_sample_v2.py` | The page tests' fixture: its shape beside the v1 sample's events, its tags, its roll-up and people, and the committed file compared with a fresh build under two hash seeds, so an edit to the v1 sample, a registry or the tool with no rebuild fails CI. |
| `tests/test_census_v2.py` | The census's pure parts on inline fixtures - the fandom classes, the resume rule, the band marker, which input field varied, where an unreviewed work came from - a fixture rendered under two hash seeds, what stops it and `--check`, a real run that reaches no model, no process and no network and leaves `data/` as it was, and the committed report compared byte for byte with a fresh render, so a data PR with no re-render fails CI. |
| `tests/test_schedule_history.py` | The history tool's pure parts on inline fixtures - classing commits, the diff and its order-only split, where a removed id's content went, same-title matches, renames against dedupe groups, returns by id and by key, the New York window, the cron's slots, runs joined to commits - and a render under two hash seeds. It reads no `data/`, runs no git and calls no gh. |
| `tests/test_room_census.py` | The room census on an inline schedule and venues file: the facts it renders - the counters, the hotels, the rules, the worklist and its candidate key, the rooms not reached - that it keeps no grammar of its own, and a render under two hash seeds that leaves both inputs as they were. It reads neither `data/` nor `docs/venues/`. |
| `tests/test_season.py` | One failing fixture per `season.json` rule, and a load of both committed files: 2026's source is the frozen schedule's and its day strings are the frozen events' days, and each year's first day string is its `con.first`. |
| `tests/test_venues.py` | One failing fixture per `venues.json` rule, the warning and the two helpers, and a load of both committed files, 2026's holding every hotel `events.json` names, so CI checks every later edit. |
| `tests/test_venues_stage.py` | The venues step on an inline venues file: the split, with every case `scraper.split_hotel` held; each rule of the grammar reading its rooms and failing on a missing room or two levels; alias, exact and rule in that order; the Mart, floors, partitions, the rewrites and the trailing note; the placeless hotels and the re-split; the report and its counters; and purity. It reads no `data/`. |
| `tests/test_tag_events.py` | What the retired tagger still does: refuse the frozen file, and carry a prompt to `claude -p` on stdin, isolated for the tag stage. |
| `tests/sample-events.json`, `tests/sample-events.v1.json`, `tests/make_sample.py` | 558 synthetic events: in the v2 shape, the fixture for the page tests and the build smoke, which `tools/sample_v2.py` makes from the v1 sample; and the seeded script that generates the v1 sample (it imports `scraper`). |
| `.github/workflows/scrape.yml` | Manual-trigger scrape (workflow_dispatch), from before the fetch stage: it installs requests and beautifulsoup4 alone and runs `python scraper.py --workers 4`, with no `--season`, so a run fails at its Scrape step until PR 8's workflow replaces it (DECISIONS #48). |
| `.github/workflows/ci.yml` | CI on every PR into `next` or `main` and every push to `next`: jobs `client` and `pipeline`. |
| `.github/dependabot.yml` | Monthly update PRs for GitHub Actions only. |
| `package.json`, `.nvmrc`, `eslint.config.js`, `vitest.config.js` | Client tooling: scripts `dev`, `build`, `preview`, `lint`, `test`; Node 24; three ESLint rules; Vitest, with jsdom as its default environment. |
| `requirements.txt` | Pinned pipeline dependencies, plus pytest. Python 3.13. |
| `.gitattributes` | Text files are LF in the index and on checkout. |
| `CLAUDE.md` | Standing rules for Claude Code sessions. |
| `docs/` | This file, DECISIONS.md and VISION.md; ROADMAP.md, the order of the 2027 work by tentpole (DECISIONS #30); SPLIT-MANIFEST.md, the record of how the one-file script became the modules; and `discover/`: the two censuses, `census-2026.md` of v1's tags and `census-v2-2026.md` of the v2 file, which CI holds fresh; `parse-2026.md`, above; `registry-2026.md`, the record of the seed review, whose script is retired; `works-review-2.json` and `people-review-1.json`, the review records - what each review decided, applied by a one-off script outside the repo; and `schema-v2.md`, the design note for the registries and tags v2 (#31-#34, #38, #39), built: the pipeline half - the parse stage, the registries, the tag stage and `events.v2.json` - and the client switch. |
| `docs/pipeline/` | Pipeline shape (ROADMAP tentpole 1): `contract.md`, the design note for DECISIONS #41-#48 - the 2027 pipeline's files, with their writers and readers, the raw row, the ledger, the change log and the stages - decided, and built so far for `season.json` and `venues.json` (ROADMAP, PR 2), `source.json`, the fetch (PR 3), and `ids.jsonl`, the ids stage (PR 4); its evidence, `history-2026.md`, how the 2026 schedule changed from commit to commit on `main` and how scrape.yml ran, written by `tools/schedule_history.py`; and `replay-2026.md`, the ids stage run over that history by `tools/replay_2026.py`, #43's verification. Both are records, not held fresh by CI: a shallow checkout has no history, and the history will not change. |
| `docs/venues/` | The venues curation (DECISIONS #21, #27, #28, #45): `README.md`, the floor-plan checklist, kept by hand - every hotel × level where programming happens, which published floor plan covers the level, our local copy of it and the state of our own drawing, with the notes on plans and drawings; `drawings/`, our schematics, one draft so far; and `census-2026.md`, the room census - every location of the frozen schedule read by the venues step against `data/2026/venues.json`, with the curation worklist, written by `tools/room_census.py`. The rooms, aliases and level notes are the venues file's; `registry.json` is retired (#45). The census is a record, not held fresh by CI: an edit to the venues file leaves it stale until the script runs again. |
| `reference/` | Local copies of other people's drawings, gitignored but for its README: the hotels' floor plans in `plans/`, at the paths `docs/venues/README.md` records, and screenshots of single levels in `shots/`, used as an underlay to trace our own shapes against (#28). Never committed - none of it is ours. |

## The data pipeline

**The fetch stage**, `scraper.py` (DECISIONS #41, #42, #44;
`docs/pipeline/contract.md`), is the first stage of the 2027 pipeline.
`python scraper.py --season data/<year>/season.json`
takes the source's base URL, its day strings and the year from the season
file, fetches the day lists (each day × panels and gaming), then every
listing's detail page in parallel with polite retries (403 is treated as
rate-limiting), and writes the year's `source.json`,
`{source, failures, rows}`: one raw row per listing, before any dedupe,
sorted by source id.

```
source_id, type (panel|gaming), title, day, start, end, duration_min,
location, description, tracks[], speakers[]; stale or removed, where true
```

- `location` is the page's Location cell verbatim, with no hotel or room
  split (#45), and `speakers` is the page's Speakers section alone, `[]`
  where it has none.
- The text is repaired before any whitespace is collapsed, by ftfy's
  `fix_encoding` and no other ftfy transform: the source sends some text
  double-encoded ("â€“" for "–"), and some with an "Â" before a no-break
  space, which collapsing would strand at a line's end.
- A listing whose detail page failed is carried from the previous file with
  `stale: true`, or, with no row there to carry, named in `failures` alone;
  a listing the source no longer lists is carried with `removed: true`, its
  fields frozen. A row carries one flag at most. `carry()` does the
  carrying.
- Fatal, writing nothing and exiting 1: a day list that fails; no listings;
  listings under `thresholds.listings_floor` of the previous file's rows
  not removed; failed detail pages over `thresholds.detail_failures` of the
  listings; every page parsing to an empty title. `main()` also refuses a
  `--previous` that is missing, malformed or another source's, and a frozen
  season (#46) unless `--out` points outside its folder.
- `fetch()` returns one result object: the rows, the failures and the
  counts the run summary will read, which `contract.md` names.

It no longer splits the hotel and room, sets `track` or `cancelled`,
derives speakers from the description, carries tags over, dedupes or
writes `events.json`. Nothing reads `source.json` in a run yet: the ids
stage, below, takes its rows, and PR 8's orchestrator will run the two in
turn (ROADMAP).

**The ids stage**, `ids_stage.py` (DECISIONS #43; `contract.md`, The
ledger), is the second, run so far only by its tests and the 2026 replay.
`assign(rows, ledger, stamp, thresholds)` takes a run's raw rows, the
ledger read from `data/<year>/ids.jsonl`, the run's stamp and the season's
thresholds, and gives every row our id, an event's source id at first
sight:

- The live rows, stale ones among them, group by `dupe_key` - the
  normalised title, the start and the normalised location - and a removed
  row stays with the line its source id maps to.
- A group keeps the id its members map to, the smaller surviving where
  they map to two, and takes a gone line's id only where its key is
  exactly that line's; otherwise it is new, under its smallest source id.
- A split goes by membership, then by the key at last sight, and the side
  that leaves takes its smallest source id, or `<source_id>.<n>`.

It returns the rows with their ids, the groups, the new ledger and a
report: new ids, matches, merges, leavers, lines gone and returned, and
UNSURE pairs - a line gone and an id new in one run whose keys agree on
two parts, the location read with a space, a comma and a hyphen alike.
Fatal, as `IdsError`: the ledger absent or a line of it malformed, a
removed row no line holds, a source id in two lines, new ids above
`new_ids` × the lines before the run. A frozen year has no ledger: 2026's
ids are its source ids. `tools/replay_2026.py` runs the stage over the 34
committed 2026 versions, and `docs/pipeline/replay-2026.md` is the result.

**The venues step**, `venues_stage.py` (DECISIONS #45; `contract.md`,
`venues.json`), is built, and runs so far in the room census and its tests;
PR 6's build will call it on every row. `resolve(rows, venues)` splits each
location at its hotel's key, longest first, and reads the rest:

- an alias of the venues file, an exact room, or a rule of the grammar
  naming rooms on one level;
- else a level - the Mart's building floors and vendor halls, a floor
  alone, or the level a failed rule's found rooms share;
- else the hotel alone, counted as rooms unresolved;
- and nothing at a placeless hotel, once its room string, split once more
  against the placed hotels' keys, has matched none.

Each row gains `hotel`, `room`, `level`, `rooms` and `place`. The report
counts the places and lists the worklist, the unplaced rooms, the locations
no key begins - counted as hotels unknown - the re-splits, the alias hits
and the rules' firings. `tools/room_census.py` renders it over the 2026
schedule as `docs/venues/census-2026.md`.

**The frozen 2026 file** was written by the scraper as it ran through the
con. Each event became:

```
id, type (panel|gaming), title, day, start, end, duration_min,
location, hotel, room, description, tracks[], track, speakers[], cancelled
```

Then, in this order:

1. **Tags carried over** from the previous `events.json`, matched by `id`.
2. **Dedupe.** Same normalised title + start + room collapses to one row. The
   smallest `id` survives; speakers and tracks are unioned; the longest
   description and any tags win; `cancelled` is sticky. Deterministic
   regardless of input order, but for the order of the unions (corrected
   2026-09-22): the copies of a group tie on the scraper's sort by (start,
   title) and keep the order their detail pages came back in, and the union
   takes first appearance, so a merged event's `tracks` - and with them its
   `track` - and `speakers` can come out reordered on every scrape.
   `docs/pipeline/history-2026.md`, section 6, has the evidence and a
   proposed fix.
3. **Write** `{generated_at, changed_at, source, count, failures, events}`.
   `changed_at` only moves when the event list actually differs, and the
   service worker only announces an update when `generated_at` moves.

The `id` is the official site's hex id from the event URL. It is **not**
first-seen stable (DECISIONS #7).

The v1 tags in the frozen file are `tag_events.py`'s: it batched untagged
events to Claude Haiku and wrote `tags: {fandoms[≤3], kind, topics[≤3],
adult, guests}` back, with a `CANON` map folding fandom name variants
together. It is retired for 2026 and refuses to write the frozen file.

**Tags v2** (DECISIONS #32-#34; `docs/discover/schema-v2.md` has the shape)
read the frozen file and never write it, in three stages:

1. **Parse**, `parse_stage.py`, no model: `people` from `speakers` and the
   description's "Additional Panelists:" line, and `facets` from the
   wording.
2. **Tag**, `tag_stage.py`: each distinct input - the title without its
   price, clock or SOLD OUT marks, the type, the tracks, the description
   without its panelist line; no people - is asked of `claude-sonnet-5`
   once, 25 to a request, on the API when `ANTHROPIC_API_KEY` is in the
   environment and on Claude Code otherwise. Each answer is held to the
   closed lists and cached in `data/2026/tags.cache.jsonl` by a hash of the
   input and `PROMPT_VERSION`, as names, never ids. Then mint: a cached
   work name the registry cannot resolve becomes a `works.json` row,
   `reviewed: false`, under a parent a second request chose from a closed
   list.
3. **Build**, `events_v2.py`, no model: the frozen events, the registries
   and the cache give `data/2026/events.v2.json`, the same bytes every run.
   Names resolve through the registry on every build, so an alias, a merge
   or a rename fixes events with no model call.

**Curation** is off the build path: `draft_people.py` drafts people,
`tools/review-people.html` reviews them, `census_v2.py` lists what is owed
a reviewer, and each review's decisions are committed as a record in
`docs/discover/`.

## The client: modules and their order

One program in twenty-six modules under `src/`, and `main.js`, the entry.
The markup it drives is in `index.html` and the CSS in `src/styles.css`.

The modules stand in one order, which is the array `ORDER` in
`tests/rules/imports.test.js`, with `boot.js` as the root above it:

```
util  storage  platform  build  state  time  venues  data  picks  follows
ics  leave  search  ui                                 the fourteen leaves
scroll  bus
now  browse  explore  map  mine                        the five views
sheet  loading  shell  dispatch
                                                       boot.js, the root
```

A module imports only npm packages and the modules before it, reading left
to right and down; `boot.js` imports any of them, and only `main.js` imports
`boot.js`. So there is no cycle, and nothing below can import what is above
it.

**The leaves** need nothing from the modules after them. `util`: formatting
and date helpers. `storage`: `loadJSON()`, `saveJSON()` and their session
twins. `platform`: `IS_IOS`, `isStandalone()`. `build`: the stamp `BUILD`,
the dev-build mark, the device readout. `state`: `settings` and `state`.
`time`: `now()`, the override, `CON`, `conPhase()`, `conDayKey()`,
`effectiveNow()`. `venues`: hotel identity, the `WALK` table, the seating
buffer, `walkMin()`, `placeHTML()`. `data`: `DATA_URL`, the schedule as the
app holds it (`events`, `byId`, `meta`), the file's works block as
`worksById`, and `replaceSchedule()`; `linksTo()`, which says whether an
event is about a work or anything under it, the rolled-up counts and
`topWorks()` it agrees with, and a person's display name. `data` is the only
module that walks a work's parent. `picks` and `follows`: what the reader starred and follows -
a follow is a track by name, or a work, an axis value or a person by id.
`ics`: the calendar export. `leave`: leave-by. `search`: the two MiniSearch
indexes (MiniSearch is an npm dependency, pinned to 7.2.0), the reading of a
query, the ranking, and `AXIS_LABELS`, the only place an axis slug becomes a
label. `ui`:
markup every view shares, `rowHTML()` and `chipHTML()`. Five read storage,
the document or `navigator` as they are imported: `platform`, `build`,
`state`, `picks`, `follows`.

**`scroll`** holds the scroller (`main`, not the page), the sideways chip
rows a redraw has to put back, `cssEsc`, and the header's measurement:
`syncHeaderHeight()`, which sets `--hdr-h`, what the sticky filters park
under, and `fitHeaderLine()`. `loading`, the `shell` and `boot()` all need
the measurement, so it sits below all three. It imports nothing, and looks
up `main` as it is imported. **`bus`** is how a module below the shell - a
view, the sheet, loading - asks for the whole page to be redrawn without
importing the shell: `requestRender()` calls the function `boot()`
registered with `setRenderer(render)`, synchronously, and throws if none is
registered. Only `render()` goes over it.

**The five views** each draw their own tab and nothing else; `render()` in
`shell.js` calls them, and none of them imports it. `now` also carries the
install nudge and the two listeners for the install prompt; `explore` the
scroll spy's listener. `map` imports `nowModel` from `now`, the one edge
between two views.

**`sheet`** is the bottom sheet: its three panels (Settings, an event, a
hotel) and what fills them, `openSheet()` and `closeSheet()`, the swipe that
dismisses it, and the handlers for the drag and the Settings controls.
`closeSheet()` asks for its redraw over the bus. It looks up the six sheet
elements as it is imported.

**`loading`** is loading, freshness and offline: `load()` and the idle index
build, `BOOT`, the header's freshness line (`updateFresh()`), the update
pill, `recheckSchedule()`, and the handlers for the pill, the worker's
messages and coming back to the app. It is below the shell, so it asks for
the first draw over the bus. It looks up `#updatePill` as it is imported.

**`shell`** is what is on screen whatever the tab: `render()`, which redraws
the page from `state` and is what the bus calls; the header's clock, the
notice and the mini-bar; `setTimeOverride()`; `togglePick()`; the iOS edge
guard; and the handlers for the tab bar, the mini-bar, the simulated-time
chip, larger text, and the redraw on coming back to the tab. It imports the
five views and `loading`; nothing below it imports it.

**`dispatch`** is the ten handlers whose bodies reach across modules: the
four delegated listeners on `main` (click, input, keydown, change), the
clicks inside the sheet's event and hotel panels, Apply and Clear for the
preview clock, the hash, and the minute tick. It declares nothing else. It
is last in the order, and only the root imports it.

**`boot.js`** is its imports and `boot()`. It holds no handler but one empty
`catch`, owns no `let`, reads nothing as it is imported, and exports `boot`
and nothing else.

The rules, in short (DECISIONS #29 has them with their reasons): a handler
lives in the module that owns the state it writes, or in `dispatch` when it
spans modules; a module that has to change another module's `let` calls a
function the owner exports for it, which is why `replacePicks()`,
`replaceSchedule()`, `setOverride()`, `takeInstallPrompt()`, `setReload()`
and their like exist; a module exports what another module imports from it
and what a test reaches by name, and nothing more; and a new module goes
into `ORDER` at the lowest place that satisfies its imports.

## Boot

`src/boot.js` exports `boot({events, reload})`. Importing it imports every
other module first, and runs nothing but declarations and the consts that
read `localStorage`, the DOM and `navigator`: in the leaves `IS_IOS`
(`platform`), `BUILD` (`build`), `settings` and `state` (`state`), `picks`
with its snapshots and news (`picks`) and `follows` (`follows`); in
`scroll.js`, `scroller`; in `sheet.js` the six sheet elements; in
`loading.js`, `updatePill`. `boot.js` itself reads nothing. That is why
`src/main.js` imports it after the markup exists. `main.js` then calls
`boot()`, once, with no options: the page fetches its own schedule.

`boot()` first registers `render()` on the bus, so that a module below the
shell can ask for a redraw; then it applies the saved text size, inserts the
dev-build mark, reads the time override, and registers every listener, timer
and observer in a fixed order, which is `boot()`'s own, top to bottom:
listeners on one element fire in the order they were added. It writes none
of them. Each handler is a named function, imported from the module that
owns the state it writes (`sheet`, `loading`, `shell`, `explore`, `now`), or
from `scroll` or `dispatch`. What `boot()` still holds inline is the four
conditions that decide whether a registration is made at all -
`document.fonts.ready`, `ResizeObserver`, `IS_IOS`, `serviceWorker` - and the
empty `catch`. Then it calls `load()`.

The two options are for tests: given `events`, `load()` uses it instead of
fetching and reaches the first render - over the bus, since `load()` is
below the shell - with no `await` on the way; `reload` replaces what
`reloadNow()` calls, because jsdom will not let `location.reload` be
replaced. From there: parse JSON → first render → index build (idle) →
suggestion index (idle). The timings are recorded in `BOOT`; `BUILD` is the
channel and build-id stamp, which the device readout shows.

`boot()` returns a handle, synchronously - state and operations, never
internals: `state`, `render`, `now`, `setTimeOverride`, `picks` and `follows`
(each `get`/`set`), `news` (`set`/`clear`), live `meta` and `events` getters,
`BOOT`, `reconcilePicks`, `recheckSchedule`, `openSheet`, `closeSheet`, and
`ready`, which is `load()`'s promise.

## What the client does

**Tabs:** `now`, `browse`, `explore`, `map`, `mine` are the `data-tab` ids
the code and `state.tab` use. The labels the user sees are Now, Search,
Explore, Map and Mine, in that order; only `browse` differs from its label.
Mine also carries the pick-count badge, hidden at zero. Rendering is a
single `render()` that redraws the active view from `state`.

**Time.** One `now()` function. A `?now=<ISO>` query parameter sets a
simulated clock, mirrored to `sessionStorage` (`dc26.timeOverride`, or
`dc26.timeOverride.<channel>` on a stamped build) so it survives navigation
but not a new tab. `isSimulated()` shows a chip. `conPhase()` returns
`before | live | ended` from `now()` and drives the pre-con banner, the
live Now tab, and archive mode. All of it is in `src/time.js`, the one file
ESLint lets read the clock: a bare `new Date()` or `Date.now()` anywhere
else under `src/` fails `npm run lint`.

**Picks.** A `Set` of event ids, persisted as `dc26.picks`. On load,
`reconcilePicks()` compares each pick against a stored snapshot: a pick
whose event vanished is dropped and reported; one whose time or room moved
is reported and re-snapshotted. The report (`dc26.pickNews`) shows on Now
and Mine until dismissed.

**Now tab.** Hero card for the current pick with a leave-by line when the
next pick is in another hotel (walk estimate + 10 min), then the rest of the
day's picks, then "On now" and upcoming groups. A minute tick re-renders
only what changed. Until the app is installed the tab opens with the install
nudge; after the con it is the record of the reader's picks.

**Mini-bar.** The shell's: the next pick and its leave-by, above the nav on
Search, Explore and Mine. Not on Now or Map, which say the same thing
themselves, and not once the con is over.

**Mine.** Timeline view by default (con day ends 5 AM), list view as an
option. Export to `.ics`, remove all.

**Map.** Schematic SVG of the host hotels, Peachtree and Courtland streets,
and the three skybridges. Per-hotel pick-count pills for the selected day; a
"next pick" card under the map. On the minute tick the map is redrawn when
its signature has changed - the day, the pick that is on, the next pick, the
counts - and otherwise only the card under it, when that has.

**Search.** The first render happens with no index; the search index is
built in idle time afterwards, then a suggestion index (people by their
display names, works and topic labels). Query intent parsing turns day/hotel/kind/time words into filters.

**Explore.** Everything that can be followed - tracks, works (the Fandoms
section), axis values (Topics), guests, panelists - as tiles with counts, a
work's count taking in the works under it; a page for each, linkable as
`#explore=kind:key` with the key an id, or a track's name, and a work's page ending with its
cast, apart and collapsed; above the grid, a Following feed and suggestions
drawn from the reader's picks. The jump chips follow the scroll through a spy that
runs once per animation frame.

**The sheet.** One bottom sheet, three panels: Settings, an event's detail, a
hotel's picks for the day. Swipe down to dismiss.

**Stored keys.** Everything is `localStorage` but the last row.

| Key | Read in | Written in | What |
|---|---|---|---|
| `dc26.picks`, `dc26.pickInfo`, `dc26.pickNews` | `picks` | `picks` | Starred event ids; what each looked like when starred; the report of what changed |
| `dc26.follows` | `follows` | `follows` | What the reader follows: `{kind, key}`, a track by name, a work, an axis value or a person by id; kept by its shape as it is read (DECISIONS #39) |
| `dc26.settings` | `state` | `sheet` | Crowd factor, the default noise filter |
| `dc26.mineView`, `dc26.followingLayout`, `dc26.followingOpen` | `state` | `dispatch` | Timeline or list; the Following feed's layout, and whether it is folded |
| `dc26.bigtext` | `boot` | `shell` | Larger text. Its own key, so nothing that resets settings shrinks it; all sizes outside the map SVG are in `rem` |
| `dc26.archiveNoticeDismissed` | `shell` | `dispatch` | The year whose "has ended" notice was dismissed |
| `dc26.nudgeSnoozedUntil` | `now` | `dispatch` | When the install nudge may show again |
| `dc26.timeOverride[.<channel>]` (`sessionStorage`) | `time` | `time` | The simulated clock |

## Offline

`public/sw.js`, three strategies:

| Request | Strategy | Why |
|---|---|---|
| `index.html` | Network-first, 3 s timeout, fall back to cache; late responses still cached | A fix should land when there's signal; a slow tower must not block launch |
| `events.v2.json` | Cache-first; revalidate in the background; notify the page only if `generated_at` changed | Megabytes on con wifi are the thing that makes the app feel broken |
| Fonts | Cache-first forever (opaque responses allowed) | Never change; a missing font is a visibly broken page |

Cache name is `dc26-v5` (or `dc26-<channel>-v5` on a stamped build). Bump
the version when the built page or `sw.js` changes; older caches under the
same prefix are deleted on activate. Install precaches the shell
individually so one failed fetch doesn't fail the install.

## Build and deploy

There is no build step for the live site: `main` is the 2026 one-file app,
served as-is by GitHub Pages at `kilgoretrout853.github.io/dragoncon-planner/`.

On `next` the client is built (DECISIONS #23). `npm run build` runs Vite
8, which bundles with Rolldown, and writes `dist/`:

- `index.html`, with `src/styles.css` and the bundled script inlined by
  `vite-plugin-singlefile`, so there are no hashed assets and the worker's
  `SHELL` list is what it was. `base` is `./`: every URL is relative,
  because the same build is deployed at two subpaths. `build.target` is
  `safari16.4`. The script and the CSS are minified, by Vite's defaults,
  and there is no source map.
- everything in `public/`, verbatim, and from `data/` only what the client
  reads: `data/2026/events.v2.json`, an allowlist (DECISIONS #39). The frozen
  v1 file, the tag cache and the registries are the pipeline's and stay
  behind.

`build/vite-dc.js` (`dcBuild`) runs last, in `closeBundle`. Vite emits the
entry as `<script type="module" crossorigin>` in `<head>`; `dcBuild` moves
it to the end of `<body>` as a bare, classic `<script>`, because the app
reads the DOM as it is imported, and because the build smoke runs the page
in a JSDOM, which does not run module scripts. It
makes the inlined style a bare `<style>` holding `src/styles.css`,
minified. When `DC_CHANNEL` is set it stamps the channel into
`<meta name="dc-channel">` and the worker's `CHANNEL`, and `DC_BUILD`
(default: short commit sha) into `<meta name="dc-build">`; a bad channel
string fails the build before it starts. With no channel both stamps stay
empty and `dist/sw.js` is byte-identical to `public/sw.js`. Then it copies
the allowlist into `dist/data/`.

`npm run dev` serves the unbuilt modules for development. It runs the app
as a real ES module - deferred, strict, no globals - which is not what
ships. The page tests run the source the same way; what ties them to what
ships is the dist smoke in `tests/build.test.js`: the built page boots.

The stamped output reaches the `dragoncon-planner-next` deploy repo through
that repo's own workflow (`.github/workflows/deploy.yml`), not through
anything here. Every ten minutes, and on `workflow_dispatch`, the workflow
compares the head of `next` (`git ls-remote`) with the sha in its
`deployed.txt`. When they differ, or the run was manual, it checks `next`
out, builds it (Node setup, then `npm ci && npm run build`) with
`DC_CHANNEL=next` (no `DC_BUILD`, so the build id is the checkout's short
sha), publishes the output folder to its `gh-pages` branch as an orphan
commit (`peaceiris/actions-gh-pages`), and commits the deployed sha to
`deployed.txt` on its `main`. That commit is also what keeps GitHub from
disabling the schedule for inactivity. The source repo is public, so no
secret is involved. To deploy now rather than within ten minutes:
`gh workflow run deploy.yml -R KilgoreTrout853/dragoncon-planner-next`.

The live and dev sites share an origin; the channel stamp is what keeps
their caches and session keys apart (DECISIONS #15).

## Tests and lint

```
npm ci                        # once; Node major from .nvmrc
npm run lint                  # eslint .
npm test                      # vitest run: everything under tests/ that ends .test.js
pip install -r requirements.txt
python -m pytest tests/       # every tests/test_*.py: the pipeline's tests
```

The client is tested by Vitest (DECISIONS #24), in four kinds of file.

**Page tests** (`tests/page/`, one file per part of the app, and
`tests/real-data.test.js`) run the source, in the test's own realm. There
is no built page and no `window.eval`: `tests/helpers/page.js` puts
`index.html`'s markup and `src/styles.css` into Vitest's jsdom, sets the two
meta stamps and the URL (`?now=2026-09-05T13:05` unless the test says
otherwise), stubs `matchMedia` and a `navigator.serviceWorker` that is an
`EventTarget` with `register()`, then imports every module under `src/`
but the entry, fresh (`vi.resetModules()`, `import.meta.glob`; importing
`main.js` would boot the page), merges their exports into one `app` - a
getter per export, so an exported `let` stays live, and a throw if two
modules export one name - and calls `boot({events, reload})` with a fixture:
`tests/sample-events.json`, or the real schedule for `real-data`. A test
drives the page through the DOM, through the handle `boot()` returned, and
through `app`, wherever a name lives. The window outlives the modules, so
the helper records every listener and interval `boot()` registers and
`cleanup()` removes them; it also fails the file if the window saw an
uncaught error.
One boot per file, tests in file order; a test that needs a different start
(seeded storage, a stamp, an iPhone, no `?now=`) cleans up and boots again.
Internals are never assigned: a situation is produced the way it arises on a
phone - a `message` from the worker stub, storage seeded before the boot, the
simulated clock moved, fake timers around the app's own interval, an
animation frame queued by hand where the code waits for one (the scroll spy),
a MutationObserver where the claim is that nothing was redrawn.

**Unit tests** (`tests/unit/`) import pure exports by name, from the module
that holds them, with no page. They still run in jsdom, because a module
they reach may read the document as it is imported: `time.js` imports
`build.js`, which looks for the stamps.

**Rules** (`tests/rules/`) are regexes over the text of `src/styles.css` and
of every module under `src/`, read one after another: declarations a page
in jsdom cannot show, since jsdom computes no layout. Two source rules
remain: [1240], the signature of `togglePick()`, which goes when Playwright
arrives, and [1728], no inline pixel font size, which stays a rule; ESLint
took the others. `imports.test.js` reads the module graph instead: only
`main.js` imports `boot.js`, a module imports only npm packages and the
modules before it in the order, every file under `src/` has a place in it,
and only the root imports `dispatch.js`.

**`tests/build.test.js`** runs the real `vite build` into temp folders: a
stamped build, an unstamped one, the default build id, a refused channel,
the shape of the output (one classic `<script>` at the end of the body,
one `<style>`, no separate assets, relative links in the head, the one file
copied from `data/`), and checks
of `sw.js`, the manifest, the icons and the head. It ends with the one test
that executes `dist/`: the built page in a JSDOM of its own, `fetch` stubbed
to serve the sample fixture, asserting that the first screen renders, a
search returns rows and no uncaught error fired.

jsdom is Vitest's default environment; the files that only read text or run
the build opt out with a `// @vitest-environment node` docblock.

`tests/PORT-LEDGER.md` is the record of how this suite was made: one row for
each assertion in the smoke harness it replaced (`tests/ui_smoke.cjs`,
removed 2026-09-18), saying where it went and how. A ported test's title
ends with the harness line it came from, in brackets; a test written since
carries none. The skipped tests are ledger rows that cannot run: three the
sample fixture never reaches ([366], [470], [499]) and a `catch` arm that
runs only when another test has already failed ([1283]). Each is an
`it.skip` whose title is the reason.

ESLint carries three rules and inherits nothing: `no-undef` and
`no-unused-vars` everywhere, and `no-restricted-syntax` under `src/`.
`no-undef` is what catches a name used in a module that does not import it;
`no-unused-vars` (arguments and caught errors exempt) catches the import
left behind when what it was for moved on. The third holds what were once
regexes over the source text, as selectors. Two are the #12 guard: a bare
`new Date()` and `Date.now()`, on every file under `src/` but `time.js`,
where `now()` lives. Four are about the page, on every file under `src/`:
nothing scrolls the window or reads how far it has scrolled (`window.scrollTo`
and `scrollBy` called, `window.scrollY`, `pageYOffset`), because `main` is
the scroller; and nothing reads `location.host`, `hostname` or `origin`,
because the stamp decides the channel, never the address (#15). A later
config object replaces an earlier one's options for a rule, so the config
gives the page's selectors for all of `src/` and gives them again, with the
clock's, for every file but `time.js`.

The Python test files are plain pytest modules; running one directly with
`python tests/test_parse.py` executes nothing.

## CI

`.github/workflows/ci.yml` runs all of the above on a clean Ubuntu runner
for every pull request into `next` or `main`, every push to `next`, and on
demand: job `client` (Node from `.nvmrc`, `npm ci`, lint, test) and job
`pipeline` (Python 3.13, `pip install`, pytest). `npm test` runs the build
itself, inside `tests/build.test.js`; pytest builds `events.v2.json` afresh
and compares it with the committed file, byte for byte, with no model, and
renders the census of it (DECISIONS #35) the same way, and checks that the
page tests' fixture is a fresh build of the v1 sample. The
ruleset on `next` requires both
jobs to pass before a pull request can merge (DECISIONS #26), and it knows
them by their job ids: renaming either one un-gates the branch.

## Branches

- `main` — the frozen 2026 app, tagged `v2026-final`. Ruleset `main`,
  active: a pull request is required (no approvals), the branch cannot be
  deleted or force-pushed, and nobody bypasses it.
- `next` — development, and the repo's default branch for the off-season.
  Ruleset `next - PR only`, active: a pull request is required (no
  approvals), squash is the only merge method, the checks `client` and
  `pipeline` must pass, the branch cannot be deleted or force-pushed, and
  only the repository admin can bypass it.
- Feature branches target `next`. GitHub deletes a head branch when its pull
  request merges, and a squash commit takes the pull request's title (the
  commit's, when there is only one), with the branch's commit messages as
  its body.

## Sharp edges to know

- The scrape workflow fails at its Scrape step until PR 8's workflow
  replaces it (DECISIONS #48): it installs requests and beautifulsoup4
  alone, where the fetch stage also needs ftfy, and runs
  `python scraper.py` with no `--season`. Behind that, it pushes to the
  branch chosen in the Run workflow dropdown (default: the default branch,
  currently `next`), and its rebase-on-retry hard-codes `main`. Both branches are PR-only, and the
  workflow's token is not the admin the `next` ruleset lets through, so a
  run that has anything to commit fails at its push (DECISIONS #26). The
  2027 pipeline needs a path onto a branch before the cron returns. It also
  runs Python 3.12, where CI runs 3.13.
- Event ids belong to the source site (see pipeline).
- The module order is a test, not a convention (DECISIONS #29): a file under
  `src/` that is not in `ORDER`, or that imports a module after it, fails
  `npm test`. An importer can read another module's `let` and mutate what it
  holds but cannot assign it - the assignment throws when it runs, and the
  build refuses it - and a module below the shell that needs the whole page
  redrawn asks over the bus, because `render()` is above it. Only `render()`
  goes over the bus, which is why the two functions that measure the header
  are in `scroll.js`, not the shell: `updateFresh()`, in `loading.js`, calls
  one of them.
- `index.html`'s ids are an interface. `sheet.js` and `loading.js` look
  elements up by id as they are imported, and `scroll.js` looks up `main`:
  a renamed id is a `null` at import and a throw in `boot()`, in every page
  test.
- The root `index.html` is Vite's entry template, not a page. Serving the
  repo root with a static server does not run the app; use `npm run dev`,
  or build and serve `dist/` (`npm run preview`).
- The built page's one script is a classic script, not a module (`dcBuild`
  strips `type="module"`; see Build and deploy), so every top-level name in
  the bundle is a global: minified, a few hundred one- and two-letter
  `var`s and functions on `window`. With one script on the page nothing can
  collide, and the app never reads a global by name. It stops being
  harmless the day a second script shares the page - an error tracker, an
  analytics snippet, a client library from a CDN - or an inline handler is
  written into the template. The fix is an IIFE wrap in `dcBuild`, or
  shipping the module script and teaching the build smoke to run one.
  Either changes the bytes the worker serves, so it belongs with the
  `sw.js` and Playwright work (DECISIONS #24). `npm run dev` and the page
  tests run real modules and do not show it.
- `sw.js` cache version is bumped by hand. Any change to `public/sw.js`,
  a comment included, is a new worker for every installed client.
- The worker tells the page of a new schedule only when `generated_at`
  moves, and `events.v2.json` copies `generated_at` from the frozen file: a
  rebuild after a registry or cache edit changes the bytes and keeps the
  stamp, so an installed client takes it in quietly on its next revalidation
  and says nothing (ROADMAP, Held).
- The page makes one third-party request at run time: Google Fonts, for
  Barlow Semi Condensed (`index.html`). The worker caches it.
- No backend, no accounts, no sync: picks live on one device.
- A Claude Code model alias moves with the CLI: on CLI 2.1.145 (2026-09-21)
  `sonnet` was claude-sonnet-4-6 and `opus` claude-opus-4-7. The tag stage
  asks by full id (`claude-sonnet-5`) and caches the id of the model that
  answered, and `draft_people.py` asks for `claude-opus-5` the same way.
- A retag is not neutral. Two runs of one model and prompt differ on a few
  percent of inputs for works and kind and more for the axes (DECISIONS
  #34), so the cache, not the model, keeps an event's tags stable: bumping
  `PROMPT_VERSION` asks everything again, and any edit to a registry or the
  cache needs `python events_v2.py` and then `python census_v2.py` after it,
  or CI fails.
