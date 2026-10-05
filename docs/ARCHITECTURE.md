# Architecture

What the system **is** as of the `next` branch, September 2026. Not what is
planned — that lives in DECISIONS.md, VISION.md and the roadmap. Update this
file in the same PR as any change that alters the shape described here.

## In one paragraph

A Python scraper turns the official Dragon Con app's web view into one JSON
file, frozen for 2026. Beside it, the build derives a second one - each
event's place, people, facets and tags, from the venues file, the
registries and a cache of a model's answers, and the works those tags name
- and that is the file the client reads. A web
app, built by Vite into a single HTML file, reads it, lets you search,
star, and plan, and stores your picks in the browser. A service worker
keeps the app usable with no signal. GitHub Pages serves it. A build
given a backend - a Supabase project's address and public key - lets a
reader keep the plan by email, and syncs their picks and follows once the
phone has a user (Identity and sync); a build given none has no backend,
and sends nothing anywhere but for the schedule. And a job on Actions
copies each year's committed schedule and change log into the Supabase
project, where the push job reads them; the pipeline never learns of it.
The push job is a function in that project, which its scheduler calls
every minute while a kill switch is on: it tells a reader, on each of
their browsers, when a pick is about to start, and when a scrape changed
one.

```
app.core-apps.com/dragoncon26          (official schedule, HTML)
        │  scraper.py, as it ran in 2026  (fetch, parse, dedupe, carry tags over)
        ▼
data/2026/events.json  (frozen; its v1 tags are tag_events.py's, now retired)
        │  tags v2, reading it and never writing it:
        │  parse_stage.py  people, facets; no model
        │  tag_stage.py    Claude, once an input ──► data/2026/tags.cache.jsonl
        │                  unknown works minted ──► data/registry/works.json
        │  events_v2.py    no model: the merge, the venues step, the parse, the cache
        ▼
data/2026/events.v2.json  (places, people, facets, tags v2, the works block, the digest)
        │  mirror.py, on Actions ──► Supabase: schedule_events, schedule_changes, mirror_state
        │                             └─ pg_cron, every minute ──► the push function ──► Web Push: starts-soon, pick-changed
        │  fetched by the page, for the year DC_YEAR names at the build; cached by sw.js
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
| `src/now.js`, `browse.js`, `explore.js`, `map.js`, `plans.js` | The five views, one per tab (`browse` is the Search tab). |
| `src/scroll.js`, `bus.js` | The scroller, the header's measurement, focus found again after a redraw, and what a scrolling area of the sheet hides past an edge (DECISIONS #76, #78); how a module below the shell asks for a redraw. |
| `src/eventsheet.js` | The event's panel of the bottom sheet (DECISIONS #74, #75; `docs/screens/contract.md`, section 7, as built): its markup - a head, a body that scrolls and a foot, the place a tap to the Map and the chips taps to Explore - and what a star's tap or a pull's redraw writes into it in place: the star, the overlap line and Starred by. It holds no DOM handle: the panel's element is `sheet.js`'s, and the clicks inside it `dispatch.js`'s. |
| `src/sync.js` | Sync (DECISIONS #53): a run - the drain, then the pull - on every trigger; the crew's data, read and written through `crews.js`; `syncAfter()`, the run the crew panel waits for after an action; Sign out's send of what waits; and its lines in Keep your plan, the status and a refused Sign out's count. |
| `src/crews.js` | Crews, the client's layer (DECISIONS #56; `docs/sync/contract.md`, section 8, as built): the reader's crews and their crewmates' picks as the pull kept them, the seven crew actions - each one request as the user, writing nothing on the phone - the invite link, read at boot and kept for the tab's session, and the readers the crew screens draw from: who's going and the overlay's map, one crewmate's picks, the reader's own row in a crew, and each crewmate's pick on now or next. No screen: the crew header and the crew's day are `plans.js`'s, the crew panel, who's going and the hotel sheet's crew `sheet.js`'s, the crew on Now `now.js`'s and on the Map `map.js`'s. A leaf. |
| `src/shareday.js` | Share a day (DECISIONS #69; `docs/screens/contract.md`, section 5, Share a day, as built): which picks a day shares, the days that hold one and the day the panel opens on, the link and the message, and a link read back against a schedule the caller hands it. Pure: no DOM, no storage, no clock; the share panel and the shared day are `sheet.js`'s. A leaf. |
| `src/filters.js` | The filter sheet (DECISIONS #70, #71, #77; `docs/screens/contract.md`, section 3, as built): Search's filters in a sheet panel - its markup, drawn as it opens, Getting in's four selects and their options' counts among it, and what a tap writes into it in place, the count on its main button among it; what the sheet set that is in effect, which the Filters button's badge counts and the chips under the box name; Clear's reach; one filter set, the last one set winning - a tap taking a word that holds its dimension out of the query - and the step a word typed takes once the box is left, the sheet's value for its dimension to All. The panel's element is `sheet.js`'s and its handlers `dispatch.js`'s. A leaf. |
| `src/season.js`, `util.js`, `storage.js`, `platform.js`, `build.js`, `backend.js`, `identity.js`, `crews.js`, `state.js`, `time.js`, `outbox.js`, `venues.js`, `shareday.js`, `data.js`, `picks.js`, `follows.js`, `ics.js`, `walk.js`, `search.js`, `ui.js`, `filters.js` | The twenty-one leaves: what everything else stands on. "The client: modules and their order" has a paragraph on each layer. |
| `src/styles.css` | All the CSS. |
| `public/` | Served and copied verbatim: `sw.js` (service worker: offline caching, schedule revalidation), `manifest.json`, `icon.svg`, `icon-*.png`, `og-image.png` (PWA install and link-preview assets), `.nojekyll`. |
| `vite.config.js`, `build/vite-dc.js` | The build: single-file output, and this project's own three plugins: `dcYear`, the year `DC_YEAR` names - its define and its two data modules, in the dev server, the build and Vitest alike (DECISIONS #49); `dcBackend`, the backend `DC_SUPABASE_URL` and `DC_SUPABASE_KEY` name, or none - its two defines, in the same three places, and the guard on them (#53); and `dcBuild`, the HTML fix-ups, the channel and year stamps and the `data/` copy. |
| `dist/` | Build output, not in git: `index.html` with the CSS and script inlined, the files from `public/`, and the one file from `data/` the client reads, the year's `events.v2.json`. |
| `data/2026/events.json` | The frozen 2026 schedule: 3,459 events, 2.7 MB. Read by tags v2, which never write it, and by the live site's one-file app on `main`; the client on `next` reads `events.v2.json` (DECISIONS #39). |
| `data/2026/tags.cache.jsonl` | The tag stage's answers, one a line, sorted by the hash of what the model was sent and the year's `prompt_version` (DECISIONS #34, #46): names, never ids. Frozen with its year: the tag stage reads 2026 with `--dry-run` only and writes it no more, and a line corrected by hand says `"model": "hand"`. |
| `data/2026/events.v2.json` | The frozen schedule in the 2027 shape (DECISIONS #42; `docs/pipeline/contract.md`, The v2 file), built by `events_v2.py` from the frozen file, `data/2026/venues.json`, the registries and the cache: each event's ten raw fields, its `id` and `source_id` - both the frozen file's id - the venues step's `hotel`, `room`, `level`, `rooms` and `place`, `track`, `cancelled`, `people`, `facets` and tags v2. Before the events, a `works` block (DECISIONS #38): every work an event links and every ancestor of those, sorted by id, each row the registry's `id`, `name`, `aliases`, `terms`, `reviewed` and, where it has one, `parent` - what the client reads a work by, never a registry. Then a `people` block (DECISIONS #61): every registry person an event names who is reviewed and has a `known_for` line, `{id, name, known_for}`, sorted by id, `[]` when there is none - what the client joins a guest's line by. The other top-level fields are the frozen file's, and `digest`, the sha256 of the works, the people and the events as the file writes them, one row a line. The file the client reads (DECISIONS #39) for 2026, the year the build names by default (#49), and the only one the build copies from `data/` for it. |
| `data/registry/` | The three curated registries `registry.py` owns, below, and `people.draft.json`, the drafter's sidecar - the draft `known_for` lines, confidence, the event titles, the minted work ids and the rejections, which the loader ignores. `works.json` also holds the works the tag stage minted, `reviewed: false`, which the sidecar does not list, so the review page never prunes them; a row minted since PR 7a carries `minted: {year, run}` (DECISIONS #46), which the review page keeps. A reviewed `known_for` line is `people.json`'s, reached only through the review page (DECISIONS #61). Cross-year, unlike `data/2026/`, because a work or a person outlasts a con. The client never reads them (#31) - what it needs of a work or a person's line is in `events.v2.json`'s blocks - and the build does not copy them into `dist/`. |
| `data/2026/season.json`, `data/2027/season.json` | A year's settings, by hand (`docs/pipeline/contract.md`; DECISIONS #44, #46, #48): the source's slug, base URL and day strings, the con's first and last day, the time zone, the cron window - `null` in 2026, which is `frozen` - the prompt version and the run's thresholds. `season.py` validates them. The fetch (`scraper.py`) reads one: the source, the day strings, the year, the listings floor and the failure ceiling, and `frozen`. The tag stage reads `frozen`, `prompt_version` - the `v` of its cache's keys - the request cap and the year, and the build and census v2 `prompt_version` too. The client imports its year's at build, as `virtual:season` (DECISIONS #49): the year, and the con's days `CON` takes. |
| `data/2026/venues.json`, `data/2027/venues.json` | The venues file (DECISIONS #45), by hand, one copy a year: per hotel its keys, short name, group, colour variable, order, whether it is placeless and how its room is shown; its levels, each with its short name and its storey (DECISIONS #72), its rooms, aliases and notes; its rooms of no known level; and the walk matrix with its three minute values. The two are identical, migrated from the retired `docs/venues/registry.json` and `src/venues.js`'s constants by a one-off script outside the repo. `venues.py` validates both; the build reads a year's (`events_v2.py`, and `tools/sample_v2.py` for the page tests' fixture), and `tools/room_census.py` reads 2026's, so an edit to 2026's is followed by `python events_v2.py` and `python tools/sample_v2.py`, or CI fails. The client imports its year's at build, as `virtual:venues` (DECISIONS #49): the hotels' order, short names, groups and colours, how each shows its room (`display`), each level's short name for a row (DECISIONS #73), the walk and its three minute values; the constants `src/venues.js` held are gone. |
| `data/2027/drawings/` | Our level drawings, as data (DECISIONS #58, #67; the folder's `README.md` is the format), by hand: one file per hotel level, `<hotel>-<level>.json`, named for the venues file's hotel key and level id. Geometry only, in feet, north up, a hotel's levels in one frame - the same origin and extent: each leaf room a rectangle - centre, size and rotation - keyed by its room id in the year's `venues.json`; the composites and groups that say how rooms combine; the open floor, an area with a room's id a place rather than scenery; the anchors, named points that tie a hotel's levels together; landmarks and streets; and prose on sources and notes. Names are the venues file's. Sizes come from the hotels' published tables, and placement from the hotel's own floor plan, read locally under `reference/plans/`; Dragon Con's map, under `reference/dragoncon/`, says which rooms the con uses; nothing of theirs is copied (#28, #67). The Hilton's five levels, the Hyatt's five, the Marriott's four, the Westin's 6th, 7th and 8th Floors and the Courtland Grand's three floors so far, each hotel's in one frame tied by named anchors. `tests/test_drawings.py` holds every file to its year's venues file and each hotel's files to one frame, `tools/render_drawings.py` draws them into `docs/venues/drawings/`, and the resolver never reads them (#45). |
| `data/2027/ids.jsonl` | The ids stage's ledger (DECISIONS #43; `contract.md`, The ledger): one line per id, sorted, each with its source ids, the moves out of it, its key at last sight and its stamps. Committed empty: it exists from the season's first commit, and its absence is fatal. 2026, frozen, has none: its ids are its source ids. |
| `scraper.py` | The fetch stage (DECISIONS #41, #42, #44): `python scraper.py --season data/<year>/season.json` writes the year's `source.json`, one raw row per listing, the text repaired before whitespace is collapsed; `fetch()` returns the rows, the failures and the run summary's counts, and `carry()` is its carrying of the previous file's rows on its own, which the 2026 replay calls too; `parse_source()` and `source_text()` are the file's reading and writing, which the orchestrator calls. It no longer splits the hotel, dedupes, carries tags or writes `events.json`: the hotel and room split is `venues_stage.py`'s, the cancelled rule `parse_stage.py`'s and the merge of a group `merge_stage.py`'s; v1's `dedupe` and `merge_group` live on in `tests/make_sample.py`, to reproduce the committed fixture, and `extract_panelists` stays for the parse stage's copy of it, which a test pins. See The data pipeline. |
| `ids_stage.py` | The ids stage (DECISIONS #43; `docs/pipeline/contract.md`, The ledger): `assign(rows, ledger, stamp, thresholds)` gives every raw row our id - the live rows grouped by `dupe_key`, a group keeping the id its members map to, the smaller surviving a collision, a gone line's id taken only on an exactly equal key, a split decided by membership, then key - and returns the rows with their ids, the groups, the new ledger and a report, UNSURE pairs among it; `read_ledger` and `write_ledger` read and write `ids.jsonl`. Fatal as `IdsError`. It owns `dupe_key` and `norm_text`, which the history tool and `tests/make_sample.py`'s copy of v1's dedupe import. Standard library, and no command: the orchestrator runs it after the fetch, and so do the replay, the build's live front door - which checks that the committed ledger already holds the rows' ids - and the tests. `parse_ledger` and `ledger_text` are the reader's and the writer's halves, which the orchestrator calls. |
| `merge_stage.py` | The merge (DECISIONS #43, #44; `docs/pipeline/contract.md`, The merge): `merge(rows, ledger)` makes one event of each id's rows, in the order of each id's first row - removed only if every row is; the smallest row not removed supplies every scalar and the source id, but `type`, panel where any is; `tracks` and `speakers` the unions in source-id order, a speaker its whole entry; the longest description; `was`, the ids merged into it through any chain. The identity on a frozen year's groups of one. Pure and standard library; the build and the tag stage call it. |
| `tag_events.py` | The 2026 tagger, retired: its `main()` refuses to write the frozen file, by a path check kept as legacy - the frozen flag is the tag stage's (DECISIONS #46). It keeps `KINDS`, `TOPICS`, `CANON`, `parse_json_array` and the two transports, which the census, the drafter and the tag stage import. `call_claude_code` sends the prompt on stdin; with `isolated=True`, the tag stage's call, it runs `claude -p` with no tools, no MCP servers and no saved session, from an empty directory of its own, and reports the model that answered. |
| `tag_stage.py` | The tag stage of tags v2 (DECISIONS #34, #46; `docs/pipeline/contract.md`, The tag stage, as built): `--season` names a year, 2026's by default. Its events come through the build's front door, `events_v2.season_rows()`, with its refusals, and `merge_stage.merge()`, the removed ones left out; each distinct input is asked of `claude-sonnet-5` once a season, 25 to a request, at most `thresholds.requests_per_run` requests a run, the retry's among them - `--requests` overrides the cap - and each answer, held to the closed lists, is cached in the `tags.cache.jsonl` beside the season file after every request. Then mint: every cached work name the registry cannot resolve becomes a `works.json` row, `reviewed: false`, carrying `minted: {year, run}`, placed under a parent by one request outside the cap, the file written once. `tag()` returns a `TagResult` - the requests, the inputs sent, cached before and after, and the capped, stopped, failed and unanswered - which `mint()` fills with what it minted, what failed and its parents requests; the run summary reads it. `mint_works()` is the mint with no file, which the orchestrator calls, and `works_rows()` the rows the mint writes. `seed --from <year>` copies another year's lines whose keys the season shares, when the two `prompt_version`s match. A frozen year runs with `--dry-run` only; `--mint-only` mints with no model. |
| `tag_key.py` | What the tag stage sends and caches (DECISIONS #34, #46): `tagger_input` - the title without its price or clock marks, type, tracks and the description without its panelist line, capped at `DESCRIPTION_CAP` characters - `input_key(input, version)`, the sha256 of the canonical `{"v": version, "input": ...}` with the year's `prompt_version`, and `load_cache` and `write_cache`, the cache's file, with `parse_cache` and `cache_text`, their halves, which the orchestrator calls; nothing else. A leaf of the tag and build path: `events_v2.py` and `tag_stage.py` import it and it imports neither, so the tag stage imports the build with no cycle. Standard library, plus `parse_stage` and `registry`. |
| `events_v2.py` | The build (DECISIONS #42-#46; `docs/pipeline/contract.md`, The build, as built), no model: `build(rows, top, reg, cache, venues, ledger=None, *, version)` runs the merge, the venues step, the parse stage's people, facets and `cancelled`, every person's id through the registry, tracks through `tracks.json`, the cached answer by its key under the season's `prompt_version`, and the merge of tags - works about > track > credit, a track's axes over the model's, mature > kids > all, play on gaming, guests from reviewed tiers - then the works block, from the tagged events: each linked work and its ancestors; then the people block, each reviewed person an event names who has a `known_for` line (DECISIONS #61); then the digest. It returns the file and a report. Tolerant: a cache miss ships the event untagged, an unresolved work name drops its link and an unknown track keeps its name, each counted; a name that is a registry term is dropped and counted too. Two front doors, both in `season_rows()`, which the tag stage reads a season through too: a frozen season's raw `events.json` - `python events_v2.py`, 2026's by default - and a live season's `source.json`, ledger and `last-run.json`, whose file it only checks, since the orchestrator writes it. Its hints name the season's `tag_stage.py --season` command. `dumps()` writes one works row, one people row and one event a line. `--check` exits 1 if the file on disk is stale. `attribution()` is the diff's: the previous run's rows and ledger through the current code, built as a live year is and written nowhere, the ledger the ids stage returns used where the current code regroups them. `live_inputs()` is the live front door on files already read, which the orchestrator builds through where it skips the ids stage, and a second time on the texts it is about to write, and `live_top()` a live year's top-level fields. |
| `diff_stage.py` | The diff stage (DECISIONS #47; `docs/pipeline/contract.md`, The diff, as built): `diff(previous, current, *, stamp, sha, attribution=None)` compares the previous `events.v2.json` with this run's, one line per event and kind - added, removed, restored, cancelled, uncancelled, time, place, title, people, tracks, description, and merged, read from the survivors' `was` - each `source` or `code` by the attribution document, and returns the lines, `changed_at` and the counts; `render()` writes the lines as `changes.jsonl` holds them. An event that leaves the file by no merge is fatal, as `DiffError`. Pure and standard library; the orchestrator runs it after the build. |
| `pipeline.py` | The orchestrator (DECISIONS #44, #48; `docs/pipeline/contract.md`, The run, as built): `run --season <season.json>` runs the five stages in order - the fetch, the ids stage, the tag stage and its mint, the build and the diff - each called with its rows, ledgers and stamps as arguments. `--to` stops after the fetch, the ids stage or the tag stage, and is refused, where the run fetches, once the year's `events.v2.json` exists; `--from` starts at the ids stage, the tag stage or the build and keeps the committed `fetched_at` and `fetch_code_hash`, so its `fetch_code_changed` is false; `--limit` is the fetch's and `--requests` the tag stage's; `--force` runs outside the season window. Two edges, each in one place: one read of the clock, the run's stamp, and one git call, `rev-parse HEAD`, which `PIPELINE_SHA` replaces on Actions. The files are read before the first stage - the season, the venues file, the registries and the snapshot of the previous files - and written after the last: every changed file together or none, `last-run.json` last, the change log only grown (the prefix check), and the build run a second time, through the live front door, on the texts about to be written. `window` prints `in window` or `out of window`; `summary --format md` renders the run's result object for the job summary, the pull request and the commit. A fatal run exits 2 and writes nothing; a degraded run commits, its counters in `last-run.json`, and on Actions a fault above zero is a `::warning::` and a curation counter a `::notice::`. |
| `mirror.py` | The mirror job (DECISIONS #50, #54; `docs/sync/contract.md`, section 6, as built): `--season <season.json>` copies the year's committed `events.v2.json`, and the change log's lines after the watermark, into the Supabase project's `schedule_events` and `schedule_changes`, over PostgREST as the service role, `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` from the environment. `mirror_state` read first and written last; the events upserted and those the file no longer holds deleted, in a live year only by a `merged` line; a line's `fetch_code_changed` its run's from `last-run.json`, or `true` for an earlier run not yet mirrored. Every file read and checked before any request; the key checked, never printed. `--dry-run` sends nothing; `--summary PATH` appends the job summary. Exit 0, or 1 for a failure. |
| `census_v2.py` | Census v2 (DECISIONS #35): the questions of `census-2026.md` asked of `events.v2.json`, and the lists owed a reviewer - the unreviewed works that events link, the drafted people, the people block against the reviewed people and the drafter's unused lines, the people on qa, photo and signing events whom `people.json` does not hold, and the links worth a look - written to `docs/discover/census-v2-2026.md`. It builds `events.v2.json` in memory first, keyed by `data/2026/season.json`'s `prompt_version`, and stops if the file on disk is stale; `--check` exits 1 if the committed report is not a fresh render, and CI checks the same. It never links: it matches text only to choose rows, and every row that comes of it is UNSURE. It imports `tag_census.py`'s markdown helpers and loads the pilot's `EVERYDAY` by path; nothing on the tag or build path imports it. Two runs give the same bytes. |
| `tag_census.py`, `docs/discover/` | A read-only census of the tags in `events.json` - coverage, fandoms, topics, people, title facets, recurrence - written to `docs/discover/census-2026.md`: evidence for the Discover design work, facts only. Standard library; it imports the taxonomy from `tag_events.py` and the facet patterns, the title key and the panelist splitter from `parse_stage.py`, writes nothing under `data/`, and two runs give the same bytes. Not part of the pipeline: nothing runs it but a person. |
| `parse_stage.py` | The parse stage of tags v2 (DECISIONS #32): `people` and `facets` read out of an event with no model. Pure functions and the standard library; it owns the facet patterns, the title key, the "Additional Panelists:" splitter, `strip_panelists` (the description the tagger is sent), `person_slug`, and `is_cancelled`, the build's `cancelled`, moved from `scraper.py`. `--out PATH` writes the parsed events for inspection; it writes nothing under `data/` and nothing it writes is committed (#13, #33). |
| `parse_report.py` | What `parse_stage.py` reads out of the frozen schedule, written to `docs/discover/parse-2026.md`: per facet the count beside the census's figure for the same wording, the people, and four UNSURE lists. Imports `parse_stage` and the census's markdown helpers. Two runs give the same bytes. Nothing runs it but a person. |
| `registry.py` | The curated registries (DECISIONS #31): `works.json`, `people.json` and `tracks.json`, cross-year and hand-edited. `load()` validates all three and raises one error listing every problem, and `check()` does the same with no file, for the orchestrator's mint; `resolve_work` / `resolve_track` / `resolve_person` turn a name or an alias into an id, and `is_term` says whether a name is a term, which never resolves. It owns `AXES`, the four closed axis lists, which the tag stage imports, and `WORK_KEYS`, the one list of a work's keys in their order, which the drafter and the tag stage's mint write `works.json` in and the review page keeps a copy of, held equal by a test: any other key on a work is a problem, and `minted` must be `{year, run}`, a whole number and an ISO date and time with its offset (DECISIONS #46). `PERSON_KEYS` is the same for a person, written by the drafter and copied by the review page, and an optional `known_for` is one plain line of at most `KNOWN_FOR_MAX`, 120, characters (DECISIONS #61). Standard library, plus `parse_stage` for its folding. |
| `season.py` | Loads and validates a `season.json`: every field present and no other, dates ISO, a span's first day not after its last, the three fractions in (0, 1] and the request cap a positive whole number; one error lists every problem. Standard library. The fetch, the build, the tag stage and census v2 read a season through it. |
| `venues.py` | Loads and validates a `venues.json` (DECISIONS #45): every field present and no other, hotel keys whole tokens and unique across hotels, level and room ids unique within a hotel, each alias written folded and naming rooms of its level, a level's short name at most 20 characters and unique within its hotel, its storey a whole number and a hotel's storeys from 0 with none skipped (DECISIONS #72), each walk pair two hotels of the file, whole minutes; one error lists every problem, and a pair of placed hotels with no walk time is a warning, the default used. Helpers only: the hotels in order, and the level a room is on. The split and the reading of a room string are `venues_stage.py`'s. Standard library. |
| `venues_stage.py` | The venues step (DECISIONS #45; `docs/pipeline/contract.md`, `venues.json`): `resolve(rows, venues)` gives every row `hotel`, `room`, `level`, `rooms` and `place`, and a report. The split matches every hotel's keys against the location, longest first, whole tokens; the reading is an alias, an exact room, the grammar - the Mart's three rules, the census's eight combined-string rules, three rewrites, partitions, the hotel alone, a floor alone, a trailing note - a level, the hotel alone, or none at a placeless hotel, whose room string is first split once more against the placed hotels' keys. The report counts the places and lists the worklist, the unplaced rooms, the locations no key begins, the re-splits, the alias hits and the rules' firings. Pure and standard library; the build calls it on every event, and the room census over the frozen schedule. |
| `draft_people.py` | Drafts people into `people.json` with a model, for review (DECISIONS #31): everyone on a `guests: celebrity` event, skipped when the registry already resolves the name or the sidecar records a rejection, so a second run calls nothing. Reuses `tag_events.py`'s two transports; Opus by full id, `claude-opus-5`, on the API and on Claude Code alike (see Sharp edges). `--parents` is a second, narrow pass that gives each work it minted a parent from the registry. Nothing it writes is reviewed, and its `known_for` lines stay in the sidecar: the review page writes one to `people.json` (DECISIONS #61). |
| `tools/` | Tools a person runs, not part of the build and never copied into `dist/`. `review-people.html` + `review-people.js` are pages opened from disk - no server, no network - and the review for `draft_people.py`'s output: one card a person, tier and credit controls, the `known_for` line in a field with a character count, a "reviewed, no known_for" view whose approve writes the line alone, and an export of the three files formatted as the drafter writes them. The state changes are pure functions in the `.js`, which is a classic script - no import, no export - because a browser refuses an ES module over `file://`. `tag_pilot.py` is the tag stage's pilot: `sample` picks about 150 inputs, and `compare` reports how runs of the tag stage into scratch caches agree - runs made against 2026 before it was frozen; a later pilot runs on a live copy, as its docstring says. It string-matches work names against event text to choose test events, which the tag stage must never do, so nothing on the tag or build path imports it. `sample_v2.py` makes `tests/sample-events.json`, the page tests' v2 fixture, from the v1 sample: each event in the file's shape, its place from the venues step against `data/2026/venues.json`, people and facets from the parse stage, the five tagged events' fandoms as works and topics as axes, one parent chain for a roll-up, and the works block. `schedule_history.py` walks every commit on `main` that touched the 2026 schedule, diffs each version against the one before by id and by the dedupe's key, adds scrape.yml's runs where `gh` can list them, and writes `docs/pipeline/history-2026.md`. `room_census.py` reads every location of the frozen schedule through the venues step, `venues_stage.py`, against `data/2026/venues.json`, and writes `docs/venues/census-2026.md`, the off-season coverage report (#45): each hotel's strings as the step reads them, the curation worklist, the rooms no string reaches and the rules' firings. It has no grammar of its own, and writes neither input. `replay_2026.py` replays the ids stage over the 2026 versions `schedule_history.py` reads - each converted to raw rows and carried as the fetch carries them, the ledger in a temp folder - and writes `docs/pipeline/replay-2026.md`: which frozen ids ours differ from and how, #43's named checks, each version's counts and the UNSURE pairs. None of the three reports is held fresh by CI. `replay_changes_2026.py` rebuilds 2026's change log from the same history, which nothing else writes: each replayed version built by `events_v2.build()` and diffed by `diff_stage.diff()` against the one before, a run flagged `fetch_code_changed` where a `scraper.py` commit comes before it. It writes the log to `tools/out/`, which git ignores, and with `--load` upserts it into a project's `schedule_changes` for 2026 by `mirror.py`'s client, so that pick-changed can be rehearsed on a real season (DECISIONS #55; `docs/sync/contract.md`, section 7, Pick-changed, as built). `render_drawings.py` draws a year's level drawings, `data/<year>/drawings/` (DECISIONS #58), into `docs/venues/drawings/<hotel>-<level>.svg` at 2 px per foot, with sizes printed and the hotel's and the level's names from the year's venues file: a renderer for checking a drawing by eye, not the app's, and deterministic. `--season` names the year by its season file, 2027's by default; `--png` writes a PNG beside each SVG where cairosvg is installed, which `requirements.txt` does not name, and without it the SVGs are written alone. Its renders are a record, not held fresh by CI. |
| `make_icons.py` | Renders the PNG icons and the preview image into `public/`. One-off; needs Pillow. |
| `tests/helpers/` | `page.js` boots the app in Vitest's jsdom for a page test, with no backend or with a fake one, and as it cleans up lets a sync run finish and stops the drains; `backend.js` is that fake, of the Supabase Auth server and of PostgREST over the four synced tables - judging an upsert as the database's triggers and grants do, narrowing a read as row-level security does, and answering the three crew RPCs and the two deletes as the policies judge them, with the statuses the real PostgREST gives - keeping every request it is sent; `act.js` is the few gestures the page tests share (type, tap, touch, watch for mutations). |
| `tests/page/` | Vitest, one file per part of the app: the source, booted in jsdom, driven through the DOM and `boot()`'s handle. |
| `tests/unit/` | Vitest: pure exports, imported by name from the module that holds them, with no page; and the push function's logic, `supabase/functions/push/push.js`, run in Node against a fake PostgREST, fake push services and a clock the test moves (`push.test.js`). |
| `tests/rules/` | Vitest: rules over the text of `src/styles.css` and of every module under `src/`, and over the module graph (`imports.test.js`). |
| `tests/real-data.test.js` | Vitest: search quality, Explore and the event sheet's entry points - which places and chips are taps - against the real schedule of the year under test, `data/2026/events.v2.json`. |
| `tests/build.test.js` | Vitest: what `vite build` leaves in the output folder, stamped and unstamped, the years and the secret key it refuses, a build for 2027 in a temporary copy of the project with a stand-in schedule, and smokes that boot the built pages - the next site's, given a backend, signing in by email and syncing a star. The only test that executes `dist/`. |
| `tests/worker.test.js` | Vitest: `public/sw.js` run in Node against fakes of what a browser hands a worker - `self`, `caches`, `fetch`, its clients - so that its rules are tested by what they do: when it tells the page of a new schedule, what its stamps name, which caches it clears (DECISIONS #49). A harness of fakes, not a browser; Playwright stays deferred (#24). |
| `tests/browser/` | Playwright (DECISIONS #81): the built page in Chromium and in WebKit at three phone sizes. `harness.js` holds the states - engines, sizes, clocks, readers - and what every spec opens the page with: Barlow served from this repo, no request to another machine, a reader seeded through localStorage, and the two standing checks' rule, read in the page; `serve.js` builds `dist/` afresh and serves it for the run, and never uses a server it finds; `standing.spec.js` walks the five tabs; `rule.spec.js` holds the rule itself, on a page of its own; `chip.spec.js` holds the header's simulated-time chip (#82); `mute-cast.spec.js` holds Follow and Mute on one line and the 44 px of Mute, every fold's button and a muted chip (#84, #85). |
| `playwright.config.js` | The browser tests' configuration: a project for each engine at each size, a phone with touch on, the worker blocked, the zone the season file's, no retries. |
| `tests/PORT-LEDGER.md` | Where each assertion of the old smoke harness went, and how. A record, frozen: never edited (DECISIONS #83). |
| `tests/test_parse.py` | Scraper parsing: the day list, the detail page, the raw row. |
| `tests/test_fetch.py` | The fetch stage on a fake source, with no network: the rows and their order, a failed page carried stale or named alone, a listing gone carried removed and every move between the two flags, each fatal rule at its boundary, `--limit`, the file's bytes, the repair before whitespace is collapsed and a clean page untouched by it, and `main()`'s frozen refusal and its `--previous`. |
| `tests/test_ids_stage.py` | The ids stage: `scraper.carry()`, a fixture for each rule and each fatal one, the UNSURE pairs and their fold, the ledger's file and its bytes, that `assign()` changes neither input, and the mini-history run end to end, its ledger the same under two hash seeds. It reads no `data/`. |
| `tests/test_replay_2026.py` | The replay tool: a committed event made a raw row and back, and its report rendered on the mini-history - how each differing id came by ours, the named checks passing and failing, a version that trips a fatal rule - and the same under two hash seeds. It runs no git and reads no `data/`. |
| `tests/test_replay_changes_2026.py` | The change-log rehearsal tool on the mini-history: each version's lines, a run flagged where a `scraper.py` commit comes before it and a season's first not, the rows a load sends and what refuses them, and `--load` against a fake PostgREST - the year's ids read first, 1,000 lines a request, the lines whose id the table lacks counted, nothing sent for a year with no events, and the key in no output - and the same bytes under two hash seeds. It runs no git and reads no `data/`. |
| `tests/mini_history.py` | Five versions in the frozen file's shape, run by both ids tests, by the diff's and by the change-log rehearsal's: a match across a gap, a return, a split each way, a collision and an UNSURE pair. Not a test file. |
| `tests/test_tag_census.py` | The census's pure functions and its repeatability, on an inline fixture; it never reads `data/`. |
| `tests/test_parse_stage.py` | The parse stage's splitter, slug, roles, people, facets and cancelled rule, on inline fixtures built from real lines and titles; it never reads `data/`. It pins the copy of `scraper.extract_panelists` that `parse_stage` keeps. |
| `tests/test_draft_people.py` | The drafter with the model mocked: candidates, the skip, credit resolution, the cap, the parents pass, and the transport's encoding. |
| `tests/test_registry.py` | One failing fixture per registry rule - a work's keys and its `minted` among them - the slug and resolve functions, a person's keys and `known_for`, the drafter and the review page on the one `WORK_KEYS` and the one `PERSON_KEYS`, and a load of the committed `data/registry/`, so CI checks every later edit to it. |
| `tests/test_tag_stage.py` | The tag stage with the model mocked, and `tag_key.py`: the input and its key, the prompt, the checks before an answer is cached, the cache; a frozen and a live fixture year read through the front door and the merge, the live year's refusals and its removed events never sent, and every 2026 event's key still in the committed cache; the cap, with capped, stopped, failed and unanswered told apart, and `--requests`; seed; the frozen refusal; mint, its parents request and `minted`, and a rewrite of the committed `works.json` that changes no line; the key's module a leaf, and that neither stage imports the pilot or the census. |
| `tests/test_events_v2.py` | The build on inline fixtures: the merge of tags, what it tolerates and counts and what still stops it, the frozen and live front doors - a live ledger the rows would change refuses - the file's order, its digest and its lines, its bytes under two hash seeds, that it never writes over an input, the cache read by the season's `prompt_version` and the hints naming the season - and a fresh build of the committed data compared byte for byte with `data/2026/events.v2.json`, so an edit to a registry, the venues file or the cache with no rebuild fails CI. |
| `tests/test_merge_stage.py` | The merge: every clause on inline rows - the supplying row, removed, stale, type, the unions and their order, the description, `was` through a chain - the identity on groups of one, the events' order, and that it changes neither input. It reads no `data/`. |
| `tests/test_diff_stage.py` | The diff: every kind with its `from` and `to`, the first run, a run that changes nothing and a retag, what makes no line, the cause rule, `merged` from `was`, the fatal event, the lines' order and bytes, the counts and purity; a five-run history - a move, a rename, a cancellation, a return, a removal and a code change read as code - and `tests/mini_history.py`'s versions through the fetch's carry, the ids stage, the build and the diff; and the attribution document, equal to the current build and across a regrouping. It reads no `data/`. |
| `tests/test_changes_log.py` | A live year's committed change log against its `last-run.json` and `events.v2.json` (DECISIONS #47): skipped until `data/2027/events.v2.json` exists - a season's first run, to the ids stage, leaves none - and the same check on a fixture. |
| `tests/test_pipeline.py` | The orchestrator on a fake source - `scraper.fetch` replaced, the real `carry()` carrying the rows - and a mocked model, in a season folder and a registry under a temp folder, the clock, the SHA and the fetch code's hash injected: what a run writes and what it leaves, `last-run.json` and its counters, the prefix check, the snapshot's fatal rules and the fatal runs, `--to` and `--from`, the attribution, the two builds, a mint that resolves in its own run, a merge, the annotations, the summary and the season window. It reads no `data/`. |
| `tests/test_mirror.py` | The mirror job: the rows it makes - the times in the season's zone, a null kept, a removed event, the watermark, the flag with two runs unmirrored, the delete set - and the job against a fake PostgREST that answers as 14.5 does, every request recorded: the order, the batches and pages, idempotence, the guard, the deletes and their quoting, the flag on a re-send, both key forms and the key's hygiene, retries, the strict `Prefer`, the frozen year, the absent file, the refusals, the dry run and the summary; and the committed `data/2026/events.v2.json` converted whole. No network, no git. |
| `tests/test_zero_hold.py` | 2026's build from the committed inputs: no event untagged, no work name unresolved, no track unknown (DECISIONS #44); the venue counters printed, never held. |
| `tests/test_sample_v2.py` | The page tests' fixture: its shape beside the v1 sample's events, its tags, its roll-up and people, and the committed file compared with a fresh build under two hash seeds, so an edit to the v1 sample, a registry, 2026's venues file or the tool with no rebuild fails CI. |
| `tests/test_census_v2.py` | The census's pure parts on inline fixtures - the fandom classes, the resume rule, the band marker, which input field varied, where an unreviewed work came from - the people block's counts, a fixture rendered under two hash seeds, what stops it and `--check`, a real run that reaches no model, no process and no network and leaves `data/` as it was, and the committed report compared byte for byte with a fresh render, so a data PR with no re-render fails CI. |
| `tests/test_schedule_history.py` | The history tool's pure parts on inline fixtures - classing commits, the diff and its order-only split, where a removed id's content went, same-title matches, renames against dedupe groups, returns by id and by key, the New York window, the cron's slots, runs joined to commits - and a render under two hash seeds. It reads no `data/`, runs no git and calls no gh. |
| `tests/test_room_census.py` | The room census on an inline schedule and venues file: the facts it renders - the counters, the hotels, the rules, the worklist and its candidate key, the rooms not reached - that it keeps no grammar of its own, and a render under two hash seeds that leaves both inputs as they were. It reads neither `data/` nor `docs/venues/`. |
| `tests/test_season.py` | One failing fixture per `season.json` rule, and a load of both committed files: 2026's source is the frozen schedule's and its day strings are the frozen events' days, and each year's first day string is its `con.first`. |
| `tests/test_venues.py` | One failing fixture per `venues.json` rule, the warning and the two helpers, and a load of both committed files, 2026's holding every hotel `events.json` names, so CI checks every later edit; and, in both, 2026's own floor-only and Mart strings, as `events.json` writes them, read at their levels through the venues step, which reads those levels by name: the one test of the step that reads `data/`. |
| `tests/test_venues_stage.py` | The venues step on an inline venues file: the split, with every case `scraper.split_hotel` held; each rule of the grammar reading its rooms and failing on a missing room or two levels; alias, exact and rule in that order; the Mart, floors, partitions, the rewrites and the trailing note; the placeless hotels and the re-split; the report and its counters; and purity. It reads no `data/`. |
| `tests/test_drawings.py` | The level drawings (DECISIONS #58, #67): one failing fixture per rule - the hotel and the level the venues file's, the file named for them, feet and north up, every room named a room of that level and drawn once among the rooms, the composites and the identified open areas, composites and groups made of the file's own leaf rooms, every rectangle wholly on the extent - all four rotated corners, to within rounding - anchors well formed, named once and on the extent, and the landmark, group and street kinds the format fixes, a landmark's one `tools/render_drawings.py` draws; across one year's files of a hotel, one extent and one position for an anchor name, within 0.5 ft - and every committed `data/*/drawings/*.json` held to its year's `venues.json` and its hotel's frame, so CI checks every later edit. |
| `tests/test_tag_events.py` | What the retired tagger still does: refuse the frozen file, and carry a prompt to `claude -p` on stdin, isolated for the tag stage. |
| `tests/sample-events.json`, `tests/sample-events.v1.json`, `tests/make_sample.py` | 558 synthetic events: in the v2 shape, the fixture for the page tests and the build smoke, which `tools/sample_v2.py` makes from the v1 sample; and the seeded script that generates the v1 sample, which keeps v1's dedupe, `_dedupe` and `_merge_group`, to reproduce it. |
| `supabase/config.toml`, `supabase/package.json`, `supabase/package-lock.json` | The backend's local project (DECISIONS #52; `docs/sync/contract.md`, section 4, as built): `supabase init`'s config - the project `dragoncon-planner`, Postgres 17, storage and realtime off, and no new table exposed to the Data API roles but by a migration's grant - and the Supabase CLI, pinned in a package of its own so that the root `npm ci` never fetches it. `npm --prefix supabase run start` starts the database alone, in Docker; `test`, `reset` and `stop` are the others. The hosted dev project takes each migration by hand after its merge, and the next site's build talks to it; production is the operations track's (DECISIONS #50). The config declares the push function too, `[functions.push]`, with the gateway's JWT check off - its secret header is the gate - and `index.js` its entry (#55). |
| `supabase/migrations/`, `supabase/seed.sql` | The schema, numbered SQL the CLI applies, one migration a pull request and never edited once merged: `20260925154849_sync_schema.sql`, the ten tables of `contract.md`'s section 2, their row-level security and grants by name, the two helpers, the stamp triggers and the three RPCs; and `20260925204917_picks_follows_sync.sql`, sync's: `synced_at` on picks and follows, the caller as a row's user by default, the key columns' update grant and the trigger that keeps every key as it is, and the indexes by user and `synced_at` (`contract.md`, sections 2 and 3, as built); and `20260926005152_mirror_times.sql`, the mirror job's: `schedule_events.start` and `end` nullable, and the mirror's three tables granted to `service_role` by name (section 6, as built); and `20260926224454_push_spine.sql`, the push job's: pg_cron and pg_net, `push_sent` a queue - `sent_at` nullable with no default, and `claimed_at` - `push_due()`, the grants to `service_role` it needs, and two cron jobs, the push every minute behind the kill switch and a daily cleanup of pg_cron's run records (section 7, as built); and `20260928154158_pick_changed.sql`, pick-changed's: `push_due()` made again to decide and claim both kinds in one statement, with the grants it had, and no table changed (section 7, Pick-changed, as built); and `20260928193428_push_batch.sql`, the batch's: `push_due()` replaced in place to claim a batch at a time - whole pushes, starts-soon first, 200 rows or one push - so that a call never claims more than PostgREST's answer of 1,000 rows returns, its grants kept and no table changed (section 7, The batch, as built). `seed.sql` is a local dataset alone - three users, a crew of two, a few picks and follows - which no hosted project runs. |
| `supabase/functions/push/` | The push job (DECISIONS #55; `docs/sync/contract.md`, section 7, as built): an Edge Function in the Supabase project, which pg_cron calls through pg_net every minute while `flags.push_enabled` is on. `push.js` is its logic and imports nothing: it checks the caller's `x-push-secret`, reads the switch, asks `push_due()` for the pushes due of both kinds a batch at a time - each claimed for the run - folds a user's picks at one start into one starts-soon push, and a user's picks one scrape run changed into one pick-changed push, whose words it makes from the change log's wall-clock strings by hand, sends each to each of the user's browsers, acks or prunes, and asks again until a call comes back empty - twice a run at most, and no call but the first after twenty seconds - releasing a push no browser took when the run ends, so that it waits for the next minute. `index.js` hands it the runtime: the environment, `fetch`, the clock and `npm:web-push`'s encoder. Its secrets are the project's, set by hand; locally, `supabase/functions/.env`, which git ignores. |
| `supabase/tests/` | pgTAP, one file per concern, each a transaction rolled back: the structure and the grants - the mirror's nullable times and its migration's grants to `service_role` among them - anon, a stranger, a member, the stamps, the RPCs, the job tables, the cascades, push subscriptions and sync's migration (`contract.md`, section 3, as built), and the push job's `push_due()`, its grants and its two cron jobs (`10_push`; section 7, as built), and pick-changed's (`11_pick_changed`; section 7, Pick-changed, as built), and the batch's (`12_batch`; section 7, The batch, as built). Run by `npm --prefix supabase test`, and by CI's `database` job. |
| `.github/workflows/scrape.yml` | The 2027 pipeline's workflow (DECISIONS #48; `contract.md`, The run, as built): hourly at `17 * * * *` inside the season window, and by `workflow_dispatch` with `force`, `to`, `limit`, `requests`, `season` and `target`. It checks the target out - the `SCRAPE_TARGET` repository variable - with the bot's token, runs `pipeline.py`, writes the summary to the job summary, and lands a run that changed a file by pull request: a `schedule/<stamp>` branch, the bot's older pull requests closed as superseded, auto-merge on, and CI the gate. |
| `.github/workflows/mirror.yml` | The mirror job's workflow (DECISIONS #54; `docs/sync/contract.md`, section 6): on a push to `next` or `main` that changes a year's `events.v2.json`, `changes.jsonl` or `last-run.json`, hourly at `47 * * * *` inside the season window, and by `workflow_dispatch` with `season`. `next` and `main` alone, each checked out as it stands; the `production` Environment on `main` and `dev` otherwise, with no deployment recorded, for `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`; one run at a time for a project and a season. |
| `.github/workflows/ci.yml` | CI on every PR into `next` or `main` and every push to `next`: jobs `client`, `pipeline` and `database`. |
| `.github/dependabot.yml` | Monthly update PRs for GitHub Actions only. |
| `package.json`, `.nvmrc`, `eslint.config.js`, `vitest.config.js` | Client tooling: scripts `dev`, `build`, `preview`, `lint`, `test`; Node 24; three ESLint rules; Vitest, with jsdom as its default environment and the year's two data modules resolved as the build resolves them. |
| `requirements.txt` | Every package the pipeline, the mirror job and their tests import, and every package those need, each pinned; `colorama` and `tzdata` by a marker, for Windows alone. Python 3.13, for CI and the scrape and mirror workflows alike. |
| `.gitattributes` | Text files are LF in the index and on checkout. |
| `CLAUDE.md` | Standing rules for Claude Code sessions. |
| `docs/` | This file, DECISIONS.md and VISION.md; ROADMAP.md, the order of the 2027 work by tentpole (DECISIONS #30); SPLIT-MANIFEST.md, the record of how the one-file script became the modules; and `discover/`: the two censuses, `census-2026.md` of v1's tags and `census-v2-2026.md` of the v2 file, which CI holds fresh; `parse-2026.md`, above; `registry-2026.md`, the record of the seed review, whose script is retired; `works-review-2.json` and `people-review-1.json`, the review records - what each review decided, applied by a one-off script outside the repo; and `schema-v2.md`, the design note for the registries and tags v2 (#31-#34, #38, #39), built: the pipeline half - the parse stage, the registries, the tag stage and `events.v2.json` - and the client switch. The contracts' "as built" parts, in `pipeline/`, `screens/` and `sync/` below, are dated records of the pull requests that wrote them, and none is added (DECISIONS #83). |
| `docs/official-app-2026.md` | The scope pass's Part B (DECISIONS #57), by hand: the official Dragon Con app as it stood in 2026, walked in its web view on 2026-09-25 and on an iPhone on 2026-09-29 - its shape; one row a feature, each marked planning, coordination, reference or keep, with ours beside it by `docs/scope-2027.md`'s ids; what it changes in that file, W46; its quality on the day; the cells not observed; and the reference kept on the author's machine under `reference/dragoncon/`. Evidence for the verdicts and for Where things live, not a wish list. A record, not held fresh by CI. |
| `docs/pipeline/` | Pipeline shape (ROADMAP tentpole 1): `contract.md`, the design note for DECISIONS #41-#48 - the 2027 pipeline's files, with their writers and readers, the raw row, the ledger, the change log and the stages - decided, and built so far for `season.json` and `venues.json` (ROADMAP, PR 2), `source.json`, the fetch (PR 3), `ids.jsonl`, the ids stage (PR 4), `events.v2.json`, the build (PR 6), `tags.cache.jsonl`, the tag stage (PR 7a), and `changes.jsonl`'s lines, the diff (PR 7b); its evidence, `history-2026.md`, how the 2026 schedule changed from commit to commit on `main` and how scrape.yml ran, written by `tools/schedule_history.py`; and `replay-2026.md`, the ids stage run over that history by `tools/replay_2026.py`, #43's verification. Both are records, not held fresh by CI: a shallow checkout has no history, and the history will not change. |
| `docs/prototypes/` | Throwaway sketches kept as a record: `building-view-motion-r6.html`, round 6 of the building view's motion sketch (DECISIONS #28; PR #67), one standalone page that nothing in the app, the build or the tests reads, its level data a hand copy superseded by `data/2027/drawings/`; and `README.md`, which says so. Not held fresh by CI. |
| `docs/scope-2027.md` | The scope pass (DECISIONS #57), by hand: section 1, what the app does on `next` today, one row a feature; section 2, every feature wanted for 2027 - VISION's, those the docs defer, hold or leave open, and the design chat's catalogue's, and Part B's - each with its sources, its state, and the design chat's description, test and verdict; section 3, the verdicts: 2027, the spring checkpoint's candidates in rank order, and out; and two appendices, the catalogue as brought in, and what the sweep found and left out. A record, not held fresh by CI. |
| `docs/screens/` | Where things live (ROADMAP tentpole 5): `recon.md`, the client's screens as they stood when the design opened, `next` at 7968d96 - the shell, the five tabs top to bottom, the sheet's three panels, the row and its callers, leave-by and the walk on screen, routes and stored keys, the stranger's view, crews' seam, the layout and what pins the screens - a record, written by hand, not held fresh by CI; and `contract.md`, the design note for DECISIONS #62-#66 - the tabs, each screen's as built, as designed and what it moves, the row, the entry points and their backs, the removals, what waits on data, and each wanted feature's one home - decided, and built so far for the shell (section 1, PR #74), the quieter Now (sections 2 and 12, PR #76), Plans' crew (section 5, PR #77), the crew everywhere - Now, the Map and the event's sheet (sections 2, 6 and 7, PR #81) - the hotel sheet's crew (section 8, PR #82) and Share a day (section 5, PR #85) and the filter sheet (section 3, PR #88) and the row and the gap line (section 10, PR #92), each with its "as built"; ROADMAP, tentpole 5, has its pull requests. |
| `docs/sync/` | Identity and sync (ROADMAP tentpole 4), built, its operations track trailing: `recon.md`, the client as it stood when the design opened, `next` at c860f38 - every key it stores and whether each is expected to sync, every site that changes picks or follows, the clock, the refresh hooks, install and notifications, the channel stamp, a change log for 2026 sized, and the backend's absence - a record, written by hand, not held fresh by CI; and `contract.md`, the design note for DECISIONS #50-#56 - identity, the data model, security and migrations, the sync rules, the mirror job, the push job and crews' client layer, each with its "as built" (PRs #54, #55, #56, #57, #59, #60, #61 and #62). |
| `docs/venues/` | The venues curation (DECISIONS #21, #27, #28, #45, #58): `README.md`, the floor-plan checklist, kept by hand - every hotel × level where programming happens, which published floor plan covers the level, our local copy of it, what Dragon Con's own map shows of it and the state of our own drawing, with the notes on plans and drawings; `drawings/`, the level drawings of `data/2027/drawings/` as `tools/render_drawings.py` draws them, for checking by eye - sizes from the hotels' tables, placement from the hotel's own floor plan, held locally under `reference/plans/` - the Hilton's five levels, the Hyatt's five, the Marriott's four, the Westin's 6th, 7th and 8th Floors and the Courtland Grand's three floors so far, each hotel's in one frame; and `census-2026.md`, the room census - every location of the frozen schedule read by the venues step against `data/2026/venues.json`, with the curation worklist, written by `tools/room_census.py`. The rooms, aliases and level notes are the venues file's, and the drawings' geometry is `data/2027/drawings/`'s; `registry.json` is retired (#45). The census and the drawings are records, not held fresh by CI: an edit to the venues file or a drawing leaves them stale until their script runs again. |
| `reference/` | Local copies of other people's drawings, gitignored but for its README, which says how a new clone rebuilds them: the hotels' floor plans in `plans/`, at the paths `docs/venues/README.md` records; screenshots of single levels in `shots/`, for a drawing's underlay; and the official Dragon Con app's maps in `dragoncon/` - one PNG per venue with every floor on it, and `maps.json`, where the app outlines each room: Dragon Con's room name, the polygon in image pixels, the door points and the 2026 event count. `maps.json`'s outlines, or the picture's labels where it outlines none, say which rooms the con uses and their names, and place a hotel with no plan of its own; the PNGs are for the eye only (#28, #67). Never committed - none of it is ours. |

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
  counts the run summary reads, which `contract.md` names.

It no longer splits the hotel and room, sets `track` or `cancelled`,
derives speakers from the description, carries tags over, dedupes or
writes `events.json`. The orchestrator, below, runs it and hands its rows
to the ids stage.

**The ids stage**, `ids_stage.py` (DECISIONS #43; `contract.md`, The
ledger), is the second, which the orchestrator runs after the fetch.
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
`venues.json`), is built; the build calls it on every event, and the room
census over the frozen schedule. `resolve(rows, venues)` splits each
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

**The merge**, `merge_stage.py` (DECISIONS #43, #44; `contract.md`, The
merge), makes one event of the rows the ledger says are one: sorted by
source id, the smallest row not removed supplies the scalars and the source
id, `type` is panel where any live row is, `tracks` and `speakers` are the
unions - a speaker its whole entry - and the description the longest; the
event is removed only when every row is, and carries in `was` every id
merged into it, through any chain. On a frozen year's rows, groups of one,
it is the identity.

**The tag stage**, `tag_stage.py` (DECISIONS #34, #46; `contract.md`, The
tag stage, as built), reads a season through the build's front door,
`events_v2.season_rows()`, with its refusals, and the merge, and asks the
model about each distinct input of the events not removed that the year's
`tags.cache.jsonl` lacks: at most `thresholds.requests_per_run` requests a
run, the retry's among them, unless `--requests` says otherwise. The key
is `tag_key.py`'s, a hash of the input and the season's `prompt_version`.
Every input asked about ends answered, or capped, stopped, failed or
unanswered, and `tag()` returns them counted in a `TagResult`; `mint()`
then adds each work name the registry cannot resolve to `works.json`,
carrying `minted: {year, run}`, and fills the result's mint fields.
`seed --from <year>` copies another year's lines for the inputs the season
shares, when the two `prompt_version`s match. A frozen year runs with
`--dry-run` only. The orchestrator calls `tag()` and `mint_works()` and
reads the result; a season's first tag is a sequence it owns - a dispatch
run to the ids stage, then `seed`, then the cron's runs, which finish it in
about three.

**The build**, `events_v2.py` (DECISIONS #42-#46; `contract.md`, The build,
as built), makes a year's `events.v2.json`: the merge, the venues step, the
parse step - people, facets and `cancelled` - the cached answer and the
merge of tags, the works block, the people block (DECISIONS #61) and the
digest. Its front doors are a frozen
season's raw `events.json` and a live season's `source.json`, `ids.jsonl`
and `last-run.json`; a live year's ledger must already hold the rows' ids,
and its file is the orchestrator's to write, so the command only checks it.
The build is tolerant: a cache miss ships the event untagged, an unresolved
work name drops its link and a track `tracks.json` lacks keeps its name with
no axes, each counted in its report, which `tests/test_zero_hold.py` holds
at zero on 2026. What stops it is ours to fix before a run: an input that
fails to load, a row with no id. The file is compact, one works row, one
people row and one event a line, and its `digest` is the sha256 of the
works, the people and the events as the file writes them.

**The diff**, `diff_stage.py` (DECISIONS #47; `contract.md`, The diff, as
built), compares the previous `events.v2.json` with this run's and gives
`changes.jsonl`'s lines: one per event and kind - added, removed, restored,
cancelled, uncancelled, time, place, title, people, tracks, description,
and merged, read from the survivors' `was` - never tags, an order alone, a
stale carry-forward or a change of group membership. Each line is `source`
or `code`: when the commit changed, the caller builds the attribution
document, the previous run's rows and ledger through the current code
(`events_v2.attribution()`), and a line is `code` where that document
already shows the change. It sees the build's code and data, not the
fetch's, which is why `last-run.json` records `fetch_code_changed`.
`changed_at` moves with the digest. An event that leaves the file by no
merge is fatal. The function is pure; the orchestrator snapshots the
previous files, hands the stamp and the SHA down, and appends the lines.

**The orchestrator**, `pipeline.py` (DECISIONS #44, #48; `contract.md`, The
run, as built), runs the stages in turn. It has two edges, each in one
place: one read of the clock as a run starts, UTC to the second, which is
the run's stamp and a fetch's `fetched_at`; and one git call,
`rev-parse HEAD`, for the SHA the change log records, which the workflow's
`PIPELINE_SHA` replaces. It reads every file before the first stage - the
season, the venues file, the registries, and the previous `source.json`,
`ids.jsonl`, `tags.cache.jsonl`, `events.v2.json`, `changes.jsonl` and
`last-run.json`, as bytes - and calls each stage with its inputs as
arguments, so no stage reads a file, the clock or git in a run. After the
diff it builds the file a second time, through the live front door on the
texts about to be written, and writes every file whose bytes changed,
together, or none: `last-run.json` last, and the change log only grown. A
run that changes nothing writes nothing. `.github/workflows/scrape.yml`
runs it hourly in the season window and lands a run that changed a file by
pull request, with auto-merge (DECISIONS #48).

**The mirror.** `.github/workflows/mirror.yml` runs `mirror.py` when a
push to `next` or `main` changes a year's `events.v2.json`,
`changes.jsonl` or `last-run.json` - a scrape's pull request landing -
hourly in the season window, and by hand. It copies the events, and the
change log's lines since its watermark, into the Supabase project's
`schedule_events` and `schedule_changes`, and its watermark into
`mirror_state`, where the push job is to read them (DECISIONS #50, #54;
`docs/sync/contract.md`, section 6). The pipeline never learns of it, and
nothing waits on it: a run that fails is completed by the next.

**The push job.** `supabase/functions/push/` is an Edge Function in the
Supabase project, which the project's scheduler, pg_cron, calls through
pg_net every minute - only while `flags.push_enabled` is on, which the
cron job reads itself, so that with it off nothing is called and no
secret read (DECISIONS #55; `docs/sync/contract.md`, section 7). A SQL
function, `push_due()`, decides what is due and claims it in `push_sent`,
so that two runs cannot both take a push; the function sends each to each
of the user's browsers by Web Push, and acks, releases or prunes. It sends
two kinds: starts-soon, a pick whose event starts within fifteen minutes;
and pick-changed, a user's picks that a scrape run cancelled, restored,
removed, moved or re-roomed within the last six hours, one push a run -
never for a change our own code made, which the change log's cause and
its run's flag say. What it reads is the mirror's, so a change reaches it
once the mirror has run. Its caller's secret header, not Supabase's JWT
check, is its gate. `tools/replay_changes_2026.py` rehearses pick-changed
on 2026's real season, whose change log nothing else writes.

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
   input and the year's `prompt_version`, as names, never ids. Then mint: a
   cached work name the registry cannot resolve becomes a `works.json` row,
   `reviewed: false`, under a parent a second request chose from a closed
   list. 2026 is frozen now, and the tag stage reads it with `--dry-run`
   only (The tag stage, above).
3. **Build**, `events_v2.py`, no model (The build, above): the frozen
   events, the venues file, the registries and the cache give
   `data/2026/events.v2.json`, the same bytes every run.
   Names resolve through the registry on every build, so an alias, a merge
   or a rename fixes events with no model call.

**Curation** is off the build path: `draft_people.py` drafts people,
`tools/review-people.html` reviews them, `census_v2.py` lists what is owed
a reviewer, and each review's decisions are committed as a record in
`docs/discover/`.

## The client: modules and their order

One program in thirty-five modules under `src/`, and `main.js`, the entry.
The markup it drives is in `index.html` and the CSS in `src/styles.css`.

The modules stand in one order, which is the array `ORDER` in
`tests/rules/imports.test.js`, with `boot.js` as the root above it:

```
season  util  storage  platform  build  backend  identity  crews  state
time  outbox  venues  shareday  data  picks  follows  ics  walk  search
ui  filters                                            the twenty-one leaves
scroll  eventsheet  bus  sync
now  browse  explore  map  plans                       the five views
sheet  loading  shell  dispatch
                                                       boot.js, the root
```

A module imports only npm packages and the modules before it, reading left
to right and down, and `season` and `venues` each the year's data file it
owns; `boot.js` imports any of them, and only `main.js` imports
`boot.js`. So there is no cycle, and nothing below can import what is above
it.

**The leaves** need nothing from the modules after them. `season`: the year
the build is for, `YEAR`, the `YY` every storage key carries, and that
year's season file, inlined at build as `virtual:season` (DECISIONS #49).
`util`: formatting
and date helpers. `storage`: `loadJSON()`, `saveJSON()` and their session
twins. `platform`: `IS_IOS`, `isStandalone()`. `build`: the stamp `BUILD`;
`storageKey()`, which names every key the app stores - `dc<yy>.` and a name,
and the channel after it on a stamped build; the dev-build mark; the device
readout. `backend`: the backend the build names, or none - `hasBackend` -
every request to it, by `fetch`, and the session it keeps under
`storageKey("session")`, refreshed only when the server refuses its token
(DECISIONS #53). `identity`: `ensureUser()`, which mints the anonymous user
at the first tap that needs one, the email step - add and recover by one
code - and sign out (#51). `crews`: the reader's crews and their
crewmates' picks as the last pull kept them, under `storageKey("crew")`
and `storageKey("crewPicks")`, which `sync` writes and forgets through it;
the seven crew actions, each one request as the user and nothing written
on the phone, with their failures in plain words; the invite link, which
`boot()` reads and keeps for the tab's session under `storageKey("join")`;
and the readers for who's going and the overlay, crewmates alone (#56),
and for the crew screens, one crewmate's picks, the reader's own row in a
crew and, since PR #81, `crewRightNow()`: each crewmate's pick on now or
next today, from a schedule the caller hands it, since `crews` comes before
the schedule and the clock. Writing and forgetting, it says whether anything a crew screen
draws has changed, for the pull's redraw. It reads its keys when asked,
never as it is imported. `state`: `settings` and `state`, Plans' crew
and day and the Map's day and focus among it, and the folds kept in memory:
`explore.mutedOpen`, `following.showCast` and `following.castNoise` by
follow, and `browse.castOpen` (#84, #85).
`time`: `now()`, the override, `CON` - the season file's days - and the
days' names, `conPhase()`, `conDayKey()`, `effectiveNow()`. `outbox`: what
the doors have changed and the server has not yet taken - one op per
changed key, stamped by `wallClock()` - under `storageKey("outbox")`, and
the drain that sends it, one upsert per table, one at a time, with its
backoff (DECISIONS #53). `venues`: hotel
identity, the `WALK` table, the slack, `SLACK_MIN`, `walkMin()`, `placeHTML()` -
a hotel whose `display` is "location", the Mart, its room alone - `levelShort()`,
the level a row says after the room, left off where the room says it (DECISIONS
#72, #73), `levelName()`, the same level in full, which an event's sheet says
under the place (#74), `placeText()`, a place as words, exactly the text of
`placeHTML()`, for a label (#75), and `placeShort()`, a place in a line of words as the Map's On now
line, Now's crew section and the hero's next pick name it, all from
the year's venues file, inlined at build as `virtual:venues`. `shareday`:
Share a day's link and message (#69) - the picks a day shares, the link,
the message, and a link read back - pure, handed the schedule, so it
stands before it. `data`:
`DATA_URL`, the schedule as the app holds it (`events`, `byId`, `meta`) -
`byId` holds the removed events too, `events` never - the file's works
block as `worksById`, and `replaceSchedule()`; `tagsOf()`, the one read of
an event's tags, which an untagged event has none of; `flagsOf()`, an event's
flags - Sold out, Extra fee, Sign-up, an age, Kids - from its facets and its
audience, which a row's line 3 and an event's sheet say (DECISIONS #73, #74);
`isAdult()`, the one rule for 18+ - a mature audience, a stated minimum of
17 or more, or the listing's Mature Audience marker - which the word in the
box, the filter sheet's Audience and a row's flag all ask (#77);
`factsOf()`, what the sheet says besides - the part, a game's format;
`sessionsOf()`, an event's other sessions not yet started (#75), by its
repeat key, its title and its people, the moment a parameter; `knownFor()`, a person's known-for line
from the file's people block (#61); `linksTo()`, which says whether an
event is about a work or anything under it, the rolled-up counts and
`topWorks()` it agrees with, `castEvents()`, the events with a work's cast
that are not about it, which a work's page, the Following feed and Search
all ask (#85), and a person's display name. `data` is the only
module that walks a work's parent. `picks` and `follows`: what the reader starred and follows -
a follow is a track by name, or a work, an axis value or a person by id,
each kind with the word the screen has for it, `KIND_NOUN`, and
`canFollow()`, whether the schedule offers it, which a `#explore=` link and
an event's chips are read by -
and their doors, `savePicks()` and `saveFollows()`, which hand the outbox
every key changed since the last save; `applyPulledPicks()` and
`applyPulledFollows()` are how a pull changes them without sending them
back. `follows` keeps the mutes too (DECISIONS #84): what the reader said
"not this" of, in a follow's shape under a key of its own, on the device
alone - never handed to the outbox, never read from a pull - with
`isMuted()` and `toggleMute()`. The write of the follows is where a follow
unmutes, and a mute of something followed unfollows it through
`saveFollows()`, so nothing is both.
`ics`: the calendar export. `walk`: the walk between picks - the walk
estimate from the pick before, and the tight-connection flag between two
picks in a row, `connection()`, which the Now tab's hero and the gap line
between rows both read (DECISIONS #40) - and, from it, `overlapsOf()`,
every other pick a pick overlaps across the plan, which a row's overlap
flag says (#73), and `clashesOf()`, the same asked of any event, picked
or not, which the sheet's overlap line says (#74); the gap line says the walk and the tight bands, and no
overlap. Nothing in it says where the reader is, or when to leave. `search`: the two MiniSearch
indexes (MiniSearch is an npm dependency, pinned to 7.2.0), the reading of a
query, the ranking, `AXIS_LABELS`, the only place an axis slug becomes a
label, `passesGettingIn()`, whether an event passes one of the filter
sheet's cost, sign-up, audience and sold out at a value, which the list and
an option's count both ask (#77), and `browseCast()`, Search's cast group,
which `browseResults()` works out beside the list (#85). `ui`:
markup every view shares, `rowHTML()` - an event's row: the title, then
the time, the place and the level, then Celebrity, the overlap flag, the
caller's context, the flags and the track (DECISIONS #64, #73) -
`chipHTML()` and, since PR #82, `crewLineHTML()`, a crewmate's pick as a
line, which Now's crew section and the hotel sheet's both draw. `filters`: the filter sheet (#70) - Search's
filters in a sheet panel, drawn as it opens and written into in place as
it is tapped, what it set that is in effect, Clear's reach, and the last
one set winning between it and a word in the box (#71); it makes the
panel's markup and writes into the element `sheet` hands it, so it stands
below `sheet`, and below `browse`, which counts its badge and draws its
chips. Five read storage,
the document or `navigator` as they are imported: `platform`, `build`,
`state`, `picks`, `follows`.

**`scroll`** holds the scroller (`main`, not the page), the sideways chip
rows a redraw has to put back, `cssEsc`, focus found again after a redraw -
`focusKey()`, a control as a selector, which the sheet keeps its opener by
and Now and the Map what had focus as they draw again (DECISIONS #66) -
and the minute tick's redraw in place, `refill()` and `drawInPlace()`,
which write the new words into the nodes already there, so a control with
focus keeps it; and the header's measurement:
`syncHeaderHeight()`, which sets `--hdr-h`, what the sticky filters park
under, and `fitHeaderLine()`; and the nav's, `syncNavHeight()`, which sets
`--nav-h`, what the mini-bar, the end spacer, the update pill, the dev-build
mark and the Map are laid out from. `loading`, the `shell` and `boot()` all
need the measurement, so it sits below all three. And the mark on an area
of the sheet that scrolls on its own (DECISIONS #76; `MORE_AREAS`, four
selectors for six areas): `moreHidden()`, a pure function of an element's
scrollTop, clientHeight and scrollHeight to the px hidden above and below
it, which `markMore()` writes onto the element as `--more-above` and
`--more-below`, with `data-more` while either is above 0, only where a
value changed - its value `moreWord()`'s, `below` while the area hides 20
px or more below and nothing under that (DECISIONS #78);
`onMoreScroll()` and `syncMore()`, which `boot()` registers;
and `moreCap()`, the deepest a band can be on an area, read from its own
scroll padding, which the hotel sheet's crew pill lands by. The stylesheet
does the rest: one mask, as deep as what is hidden, and one arrow, on the
element that follows an area that says `below`. It imports nothing,
and looks
up `main` as it is imported. **`bus`** is how a module below the shell - a
view, the sheet, loading - asks for the whole page to be redrawn without
importing the shell: `requestRender()` calls the function `boot()`
registered with `setRenderer(render)`, synchronously, and throws if none is
registered. Only `render()` goes over it.

**`eventsheet`** is the event's panel of the bottom sheet (DECISIONS #74,
#75): `eventSheetHTML()`, what the panel says of one event - a head that
never scrolls, with the place, a tap to the Map where the Map can show the
event, the level, the facts, the other sessions still to come and who in
the reader's crews starred it (#68); a body that scrolls, with the
description, the people and the chips, `chipsOf()`, each track's and each
reviewed work's a tap to its Explore page; and a foot, with the overlap
line and the actions - and `refreshEventSheet()`, which writes the star,
the overlap line and Starred by in place, at the star's own tap and when
`render()` runs, so the panel is drawn once, as it opens. It holds no DOM
handle - it finds what it writes by id, when asked - so it stands below
`sheet`, which draws it into the panel as it opens, and below `dispatch`,
whose clicks those inside the panel are. It stands below the Map too, so
`sheet` tells it whether the Map can show the event, a boolean. It stands
after `scroll`, whose `refill()` and `focusIn()` its fill uses.

**`sync`** is sync's run (DECISIONS #53; `docs/sync/contract.md`,
section 5, as built): `runSync()` drains the outbox, then pulls - the
crews, the oldest first with their invite tokens, then the picks and the
follows since the watermark - and applies the reader's own rows through
the owners' functions, and the crews and the crewmates' picks through
`crews`, which keeps them; the change of owner, which seeds the outbox
with the whole plan; `sendBeforeSignOut()`, Sign out's send of what
waits, which lets every run and drain under way finish, makes a try of its
own, and says how much still waits; `syncAfter()`, the run the crew panel
waits for after an action, one that began after it; and two lines in Keep
your plan, the status and, after a refused Sign out, what still waits. It
stands above the bus, because a pull that changed the plan, or what a
crew screen draws, asks for a redraw - on any tab, one rule (DECISIONS
#80), so it reads neither `state` nor the page. The outbox stands
below `picks` and `follows`, whose doors call it, so a drain it starts
after a tap is followed by no pull: the next trigger's run pulls.

**The five views** each draw their own tab and nothing else; `render()` in
`shell.js` calls them, and none of them imports it. `now` also carries the
install nudge and the two listeners for the install prompt; `explore` the
scroll spy's listener, and `openExplorePage()`, every tap's way to a page:
it takes the grid's scroll where the grid is the screen under the tap, and
puts keyboard focus on the page's heading (#75). `map` imports `nowModel`
from `now`, the one edge between two views; it holds the Map's focus - one
event, `state.map.focus`, which carries its own day - with `onTheMap()`,
whether the Map can show an event, and `showOnMap()`, the event sheet's
place line's way in (#75). `plans` also draws the crew header, the My day | Crew
segment and the crew's day on a build with a backend, and says which crew
Plans shows (`chosenCrew()`) and in what order a crew's members are
listed (`crewPeople()`), for the crew panel too; each time it draws, it
gives focus back, by id, to its own control that had it (DECISIONS #66).
On a build with a backend `now` draws the crew's section, Your crew right
now, and `map` the crew counted per hotel, from `mapCrewPicks()`, each
crewmate's pick at each hotel on a day, which the hotel sheet lists too;
both give focus back to the
control that had it, as `scroll`'s `focusKey()` finds it, each time they
draw and at the minute's tick.

**`sheet`** is the bottom sheet: its seven panels (Settings, an event,
which `eventsheet` draws, a hotel, a crew, Share a day, a day shared with
the reader and Search's filters, which `filters` draws) and what fills
them, `openSheet()` and `closeSheet()`, the
swipe and the Escape that dismiss it, focus into it and back to what
opened it (DECISIONS #66), and the handlers for the drag and the Settings
controls - the email step's among them, Keep your plan, which it draws
only on a build with a backend, with sync's status line under its
heading; the step starts a sync run once it has sent a code and once it
has confirmed one, and Sign out sends what waits first - refused while
anything still waits, and sync's line under the status says how much -
and then forgets sync's keys. The crew panel, on a build with a backend
alone, is create, join and manage - the reader's own name in the crew
among what manage changes - its state the module's: each action is one
request at a time, then `syncAfter()`, then the panel and Plans drawn
from what the pull kept; `openKeptJoin()` opens its join step for a kept
invite at boot, and `refreshCrewPanel()` refills it when `render()` runs.
A hotel's panel lists the crew's picks there under the reader's own,
on the day it was drawn for, which it keeps - opened from the Map's crew
pill, with them brought to the top of its body (`showHotelCrew()`);
`refreshHotelSheet()` writes what it draws of the crew in place when
`render()` runs. The share panel draws a day's message as it will be
sent, with Share and Copy; a `?day=` link is read at boot - `takeDayLink()`,
a join winning - kept in memory alone and opened once the schedule has
loaded (`openSharedDay()`), and `refreshSharedDay()` writes its rows' words
and stars in place when `render()` runs, so an overlap flag follows a star
(DECISIONS #73). An event opened from the shared day closes
back to it, its scroll kept (#63), and so does one opened over that
event's sheet (#74). `closeSheet()` asks for its redraw over
the bus; the filter sheet closed with anything changed brings the list
back to its top. It looks up the eleven sheet elements as it is imported.

**`loading`** is loading, freshness and offline: `load()` and the idle index
build, `BOOT`, the header's freshness line (`updateFresh()`), the update
pill, `recheckSchedule()`, and the handlers for the pill, the worker's
messages and coming back to the app. It is below the shell, so it asks for
the first draw over the bus. It looks up `#updatePill` as it is imported.

**`shell`** is what is on screen whatever the tab: `render()`, which redraws
the page from `state` and is what the bus calls, the open crew panel with
it, an open event's star, overlap line and who's-going line, an open
hotel's crew and an open shared day's rows, and which ends the Map's focus
when the tab is not the Map, the one place that is decided (#75); the header's
clock, the notice and the mini-bar; `setTimeOverride()`; `setOpeningTab()`,
the tab the app opens on - Plans for a kept invite; `togglePick()`; the iOS
edge guard; and the handlers for the tab bar - a tap on Plans starts a sync
run - the mini-bar, the simulated-time chip, larger text, and the redraw on
coming back to the tab. It imports the five views, `eventsheet`, the sheet
and `loading`; nothing below it imports it.

**`dispatch`** is the fourteen handlers whose bodies reach across modules: the
five delegated listeners on `main` (click, input, keydown, change, focusout), the
clicks inside the sheet's event, hotel and shared-day panels - the event's
place, to the Map, and its names and chips, to Explore, among them - the clicks
and changes inside its filter panel, which write `state.browse` and close
the sheet, Apply and Clear for the
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
`scroll.js`, `scroller`; in `sheet.js` the eleven sheet elements; in
`loading.js`, `updatePill`. `boot.js` itself reads nothing. That is why
`src/main.js` imports it after the markup exists. `main.js` then calls
`boot()`, once, with no options: the page fetches its own schedule.

`boot()` first registers `render()` on the bus, so that a module below the
shell can ask for a redraw; then it applies the saved text size, inserts the
dev-build mark, reads the time override, reads the invite link - which it
takes out of the address and keeps for a crew screen (`crews`) - and a
shared day's link after it, taken out of the address too and kept in memory
unless a join won (`sheet`), sets the opening tab by the two, opens the crew panel's join step for a kept
invite (`sheet`), and
registers every listener, timer and observer in a fixed order, which is
`boot()`'s own, top to bottom: listeners on one element fire in the order
they were added. It writes none of them. Each handler is a named function,
imported from the module that
owns the state it writes (`sheet`, `loading`, `shell`, `explore`, `now`), or
from `scroll` or `dispatch`. What `boot()` still holds inline is the four
conditions that decide whether a registration is made at all -
`document.fonts.ready`, `ResizeObserver`, `IS_IOS`, `serviceWorker` - and the
empty `catch`. Three of the registrations keep the sheet's more-past-an-edge
mark (DECISIONS #76), and no draw calls for it: a scroll listener on the
sheet in the capture phase, a MutationObserver on its child lists, and,
under the `ResizeObserver` condition, one on each scrolling area and its
children. Sync's triggers come last, after the schedule's recheck on
the same events. Then it calls `load()`; once it has loaded, a shared
day's link opens its panel, and a sync run follows.

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

**Tabs:** `now`, `browse`, `explore`, `map`, `plans` are the `data-tab` ids
the code and `state.tab` use. The labels the user sees are Now, Search,
Explore, Map and Plans, in that order; only `browse` differs from its label.
Plans also carries the pick-count badge, hidden at zero. The app opens on
Explore before the con and on Now from its start (`shell.js`
`setOpeningTab()`, by `conPhase()`; DECISIONS #62), unless a `#explore=`
link names a page; a kept invite opens it on Plans, under the crew panel's
join step, in any phase. Rendering is a
single `render()` that redraws the active view from `state`.

**Time.** One `now()` function. A `?now=<ISO>` query parameter sets a
simulated clock, mirrored to `sessionStorage` (`dc<yy>.timeOverride`, or
`dc<yy>.timeOverride.<channel>` on a stamped build) so it survives navigation
but not a new tab. `isSimulated()` shows a chip. `CON` spans the season
file's days, from 18:00 on the first to 19:00 on the last - 2026's observed
bounds, until a season file holds its own. `conPhase()` returns
`before | live | ended` from `now()` and drives the pre-con banner, the
live Now tab, and archive mode. All of it is in `src/time.js`, the one file
ESLint lets read the clock: a bare `new Date()` or `Date.now()` anywhere
else under `src/` fails `npm run lint`.

**Picks.** A `Set` of event ids, persisted as `dc<yy>.picks`. On load,
`reconcilePicks()` compares each pick against a stored snapshot: a pick
whose id was merged into another event - it is in that event's `was` -
moves to it; one whose event vanished otherwise is dropped, where it has a
snapshot - one with none, which this copy of the schedule never showed, a
pick pulled from a device on a newer schedule, stays unseen until the
schedule knows it, and Plans' badge, `picks.size`, counts it meanwhile
(DECISIONS #53); one whose
event the source dropped stays a pick, and its snapshot remembers that it
was told; one whose time or room moved is re-snapshotted. Each is reported
once (DECISIONS #49). The report (`dc<yy>.pickNews`) shows on Now and Plans
until dismissed.

**Now tab.** Hero card for the pick that is on, or the next: a ring counting
to its end or its start, and one line - when it ends, then the next pick
today and the walk to it, or the band `walk.js` `connection()` gives the
pair - for a walk the one the gap line between their rows gives, and for an
overlap the one both rows flag (DECISIONS #73) - the next pick named as
`placeShort()` names a place, a stream by its title; or, with nothing on,
when it starts and the walk from the pick before (DECISIONS #40). Never when
to leave. On a build with a backend, for a reader in a crew and only while
the clock is inside the con, Your crew's picks right now under it: a line a
crewmate, their pick on now or next today, four and then how many more,
which opens Plans' crew's day (DECISIONS #62; `docs/screens/contract.md`,
section 2, as built). Then the rest of the day's picks, then "On now" and
upcoming groups. A minute tick re-renders only what changed - the crew's
lines among what it watches - and focus stays on the control that had it.
While the reader has a
pick and until the app is installed, the tab opens with the install nudge
(DECISIONS #65), before and during the con - never after it; after the con
the tab is the record of the reader's picks.

**Mini-bar.** The shell's: the next pick and how long until it starts, "in
47 min", above the nav on Search, Explore and Plans. Not on Now or Map,
which say the same thing themselves, and not once the con is over.

**Plans.** Timeline view by default (con day ends 5 AM), list view as an
option. Export to `.ics`, remove all. A pick on an event the source
dropped is drawn here and nowhere else, where its time puts it, struck and
marked "Removed from the schedule", with no gap line or walk link to or
from it; the export leaves it out, and its sheet offers no calendar
(DECISIONS #49). A stream has no walk, so no walk link runs to or from it
either (DECISIONS #40). On a build with a backend the crew header tops it:
the crew's name - a picker, in more than one - how many, and Manage,
which opens the crew panel; in no crew, the rung, Start a crew or Join
with a link. In a crew, My day | Crew: My day is all of the above, and
Crew one day of the crew, day chips and a block of picks a member, the
reader first (DECISIONS #62; `docs/screens/contract.md`, section 5, as
built).

**Map.** Schematic SVG of the host hotels, Peachtree and Courtland streets,
and the three skybridges. Per-hotel pick-count pills for the selected day,
and on a build with a backend, in a crew, a second count, outlined, of the
crewmates with a pick at the hotel that day - people, not picks
(`docs/screens/contract.md`, section 6, as built); a "next pick" card under
the map. An event's sheet's place line opens the Map focused on that event
(DECISIONS #75): on the event's con day, a third ring, not gold, on its
hotel, and the card showing the event, "You were looking at", until the tab
is left, a day chip is tapped or the clock is changed - the focus carries
its own day, so the Map is then on the day it had. On the minute tick the
map is redrawn when its signature has changed - the day, the pick that is
on, the next pick, both counts, the focus - and otherwise only the card
under it, when that has; focus stays on the control that had it.

**Search.** The first render happens with no index; the search index is
built in idle time afterwards, then a suggestion index (people by their
display names, works and topic labels). Query intent parsing turns day/hotel/kind/audience/time words into filters.
The box, a Filters button beside it and the day chips are the sticky
block; the other filters are the filter sheet's (DECISIONS #70;
`docs/screens/contract.md`, section 3, as built): the hotel, the fandom
and the track, the four topic axes, panels or gaming, the kind, Getting
in - cost, sign-up, audience and sold out (#77) - and the
photo-session hide, in a sheet panel that applies each tap at once and
counts what the list will hold, the list drawn again as it closes. Each
filter it set that is in effect is a chip under the box, beside the
query's words, and the button's badge counts them. One value a filter,
and the last one set wins (DECISIONS #71): a tap in the sheet takes a word
that holds its filter out of the query, and a word typed takes the sheet's
value to All once the box is left. With the Fandom filter set and no word
to rank by, the fandom's cast group stands after the list: a fold, open, of
the cast's events that pass every other filter in effect (DECISIONS #85).

**Explore.** Everything that can be followed - tracks, works (the Fandoms
section), axis values (Topics), guests, panelists - as tiles with counts, a
work's count taking in the works under it; a page for each, linkable as
`#explore=kind:key` with the key an id, or a track's name, with Follow and, beside it,
Mute (DECISIONS #84), and a work's page ending with its
cast, apart and collapsed; above the grid, a Following feed - a followed
work's block ending with its cast too, by interest (#85) - suggestions
drawn from the reader's picks, and a fold of what the reader muted, which
the suggestions leave out and nothing else does. A page opened by a tap takes keyboard focus
on its heading, and "← Explore" lands the grid where it last was
(DECISIONS #75). The jump chips follow the scroll through a spy that
runs once per animation frame. The filter box and the jump chips are the
sticky block, and the box is built once, as Search's is: a later draw of
the grid writes around it - what stands above the block, the jump chips
and the tiles - so a redraw never takes the box from a reader typing in
it (DECISIONS #80; `docs/screens/contract.md`, section 4, as built).

**The sheet.** One bottom sheet, seven panels: Settings, an event's detail, a
hotel's picks for the day - on a build with a backend the crew's there
under them (`docs/screens/contract.md`, section 8, as built) - on a
build with a backend a crew - create,
join and manage (`docs/screens/contract.md`, section 5, as built) - Share
a day and a day shared with the reader (section 5, Share a day, as
built), and Search's filters (section 3, as built). An event's detail is
a head, a body that scrolls and a foot (DECISIONS #74, #75; section 7, as
built): the place, a tap to the Map where the Map can show the event;
under it the level in full, the facts in a row's words, its other
sessions still to come, the people, each name a tap to that person's
Explore page, the chips, each track's and each reviewed work's a tap to
its own, and in the foot every pick it overlaps - or would, before the
star; on a build with a backend it says who in the reader's crews starred
it. A star's tap and a pull write the star, the overlap line and that line
in place. The sheet is at most 86% of the
screen, and past that an event's panel scrolls with its foot pinned. Six
areas of the sheet scroll on their own - an event's body, the hotel's list,
a shared day's, the filters' body, Settings' Advanced and the crew panel -
and each fades at an edge with more past it, as deep as what is hidden
there (DECISIONS #76; section 7, More past an edge, as built); where one
hides 20 px or more below and something follows it in its panel, a small
arrow stands above that, and each has room for a focus ring at its sides,
as an event's panel has (DECISIONS #78; section 7, The sheet's edges, as
built). Swipe
down or press Escape to dismiss; focus moves to the panel's heading as it
opens and back to what opened it as it closes (DECISIONS #66). On a build
with a backend, Settings carries Keep your plan: the email step, which
adds an email to the phone's user or signs the phone in as the user who
holds it, by a six-digit code (DECISIONS #51, #53;
`docs/sync/contract.md`, section 1, as built). Under its heading, with a
session, is one line of sync's: synced, what is waiting, offline, or the
last failure in plain words (`contract.md`, section 5, as built).

**Stored keys.** Everything is `localStorage` but the last two rows. Every key
carries the build's year, `<yy>` its last two digits, so a build for a new
year starts with none of the last one's (DECISIONS #49); and on a build
stamped with a channel every key ends `.<channel>` - `dc<yy>.picks.next` on
the next site - so the next site reads none of the live site's, which shares
its origin (#39). `storageKey()` in `build.js` names them all.

| Key | Read in | Written in | What |
|---|---|---|---|
| `dc<yy>.picks`, `dc<yy>.pickInfo`, `dc<yy>.pickNews` | `picks` | `picks` | Starred event ids; what each looked like when starred; the report of what changed |
| `dc<yy>.follows` | `follows` | `follows` | What the reader follows: `{kind, key}`, a track by name, a work, an axis value or a person by id; kept by its shape as it is read (DECISIONS #39) |
| `dc<yy>.mutes` | `follows` | `follows` | What the reader muted: `{kind, key}`, a follow's shape and kept by it as it is read, less anything also followed; on the device alone, never synced (DECISIONS #84) |
| `dc<yy>.settings` | `state` | `sheet` | Crowd factor, the default noise filter |
| `dc<yy>.mineView`, `dc<yy>.followingLayout`, `dc<yy>.followingOpen` | `state` | `dispatch` | Timeline or list; the Following feed's layout, and whether it is folded |
| `dc<yy>.plansView` | `state` | `dispatch` | My day or Crew, `"mine"` or `"crew"`, once tapped; absent, Plans decides by the day and the crews (DECISIONS #62) |
| `dc<yy>.bigtext` | `boot` | `shell` | Larger text. Its own key, so nothing that resets settings shrinks it; all sizes outside the map SVG are in `rem` |
| `dc<yy>.archiveNoticeDismissed` | `shell` | `dispatch` | The year whose "has ended" notice was dismissed |
| `dc<yy>.nudgeSnoozedUntil` | `now` | `dispatch` | When the install nudge may show again |
| `dc<yy>.session` | `backend` | `backend` | The backend's session: its two tokens and the user's id, email and `is_anonymous`. Only on a build with a backend, and only from the first tap that needs a user (DECISIONS #51, #53) |
| `dc<yy>.outbox` | `outbox` | `outbox` | What the server has not yet taken: `{user, ops}`, an op per changed pick or follow. Only with a backend and a session, like the three below; Sign out, once nothing waits to be sent, and a run with no session remove all four (DECISIONS #53) |
| `dc<yy>.syncStamp` | `sync` | `sync` | The pull's watermark, the server's `synced_at` for each table: `{user, picks, follows}` |
| `dc<yy>.crew` | `crews` | `crews`, for `sync`'s pull | The reader's crews of the year, the oldest first, with their members and invite tokens, as the last pull read them: what the crew screens draw from (DECISIONS #56) |
| `dc<yy>.crewPicks` | `crews` | `crews`, for `sync`'s pull | Crewmates' picks, by user and then event |
| `dc<yy>.timeOverride` (`sessionStorage`) | `time` | `time` | The simulated clock |
| `dc<yy>.join` (`sessionStorage`) | `crews` | `crews` | An invite link's `<year>.<token>`, kept from the address for the tab's session until the crew panel takes it - on a join, or when its join step is closed; only on a build with a backend |

## Offline

`public/sw.js`, three strategies:

| Request | Strategy | Why |
|---|---|---|
| `index.html` | Network-first, 3 s timeout, fall back to cache; late responses still cached; kept once, under its address less the query | A fix should land when there's signal; a slow tower must not block launch |
| `events.v2.json` | Cache-first; revalidate in the background; notify the page only if its `digest` changed - `generated_at`, for a copy without one | Megabytes on con wifi are the thing that makes the app feel broken |
| Fonts | Cache-first forever (opaque responses allowed) | Never change; a missing font is a visibly broken page |

The page is stored under its address without the query (`pageKey()`), and
the offline fallback looks that key up exactly, then the shell's
`index.html`: a `?join=`, a `?now=` or any other query opens the one page,
the latest that arrived. Kept under each address it was asked for, a copy
stored once was never replaced, and since a cache matches its oldest entry
first, an offline launch could serve the page as it was the day a link
was opened; v7 dropped those copies. The schedule's lookups still ignore a
query.

Cache name is `dc<yy>-v7` (or `dc<yy>-<channel>-v7` on a stamped build),
`<yy>` the stamped year's last two digits. Bump the version when the built
page or `sw.js` changes; this site's other caches, of any year, are deleted
on activate, matched by the whole name, so the live site's worker and the
next site's leave each other's alone. Install precaches the shell
individually so one failed fetch doesn't fail the install.

The worker answers no request but a GET, and no GET to another origin but
the fonts', so the backend's requests - `src/backend.js`'s, to the Supabase
project - pass it untouched (DECISIONS #53).

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
  reads: `data/<year>/events.v2.json` for the year `DC_YEAR` names, 2026
  where it is unset, an allowlist (DECISIONS #39, #49). The frozen v1 file,
  the tag cache and the registries are the pipeline's and stay behind.

`build/vite-dc.js` holds three plugins. `dcYear` runs first, in the dev
server and Vitest as in the build: it reads `DC_YEAR` - four digits, 2026
where it is unset, or the build fails before it starts - defines
`__DC_YEAR__`, which `src/season.js` reads, and resolves `virtual:season`
and `virtual:venues` to the year's `season.json` and `venues.json`, which
Vite inlines like any JSON import. It refuses a year whose two files are
missing, or whose `season.json` names another year (DECISIONS #49).

`dcBackend` runs beside it, in the same three places. It reads
`DC_SUPABASE_URL` and `DC_SUPABASE_KEY`, a Supabase project's address and
its public key, and defines `__DC_SUPABASE_URL__` and
`__DC_SUPABASE_KEY__`, which `src/backend.js` reads: both empty where both
are unset, a build with no backend, whose page sends nothing anywhere but
for the schedule (DECISIONS #53). The key is inlined in a public page, so
it refuses a secret key - an `sb_secret_` key, or a JWT whose role is
`service_role` - an address that is more than an origin, or is not https
but for http on this machine, and either variable without the other.

`dcBuild` runs last, in `closeBundle`. Vite emits the
entry as `<script type="module" crossorigin>` in `<head>`; `dcBuild` moves
it to the end of `<body>` as a bare, classic `<script>`, because the app
reads the DOM as it is imported, and because the build smoke runs the page
in a JSDOM, which does not run module scripts. It
makes the inlined style a bare `<style>` holding `src/styles.css`,
minified. When `DC_CHANNEL` is set it stamps the channel into
`<meta name="dc-channel">` and the worker's `CHANNEL`, and `DC_BUILD`
(default: short commit sha) into `<meta name="dc-build">`; a bad channel
string fails the build before it starts. For a year that is not 2026 it
stamps the worker's `YEAR`, and the year into the page's name - `Dragon Con
<year>` and `DC<yy>` in its title, its head's tags and the brand on Now -
and the manifest's; the icons draw the year in pixels, which no stamp
reaches. With no channel and the default year both stamps stay empty, and
`dist/sw.js` and `dist/manifest.json` are `public/`'s byte for byte. A year
with no `events.v2.json` fails the build before it starts. Then it copies
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
sha) and the backend's two variables, the dev project's, set there by hand
(ROADMAP, Checklist), publishes the output folder to its `gh-pages`
branch as an orphan commit (`peaceiris/actions-gh-pages`), and commits
the deployed sha to
`deployed.txt` on its `main`. That commit is also what keeps GitHub from
disabling the schedule for inactivity. The source repo is public, so no
secret is involved. To deploy now rather than within ten minutes:
`gh workflow run deploy.yml -R KilgoreTrout853/dragoncon-planner-next`.

The live and dev sites share an origin; the channel stamp is what keeps
their caches and storage keys apart (DECISIONS #15, #39).

## Tests and lint

```
npm ci                        # once; Node major from .nvmrc
npm run lint                  # eslint .
npm test                      # vitest run: everything under tests/ that ends .test.js
npx playwright install chromium webkit   # once: the two engines the browser tests drive
npm run test:browser          # playwright test: every tests/browser/*.spec.js, in both engines at three sizes
pip install -r requirements.txt
python -m pytest tests/       # every tests/test_*.py: the pipeline's tests
npm ci --prefix supabase         # once; the Supabase CLI, pinned in supabase/package.json
npm --prefix supabase run start  # the local database, in Docker: the migrations and seed.sql applied
npm --prefix supabase test       # pgTAP: every supabase/tests/*.test.sql against it
npm --prefix supabase run reset  # the database afresh: the migrations and the seed again
npm --prefix supabase run stop
```

The database is tested by pgTAP (DECISIONS #52; `docs/sync/contract.md`,
section 3, as built): one file per concern under `supabase/tests/`, each a
transaction rolled back, run by the Supabase CLI's `test db` against the
local database, which needs Docker running and nothing else of Supabase's.
A test user is a row inserted into `auth.users`, and a test acts as them
through the `authenticated` role and a `request.jwt.claims` that names
them, or as anon. Each case is refused - 42501, where no grant reaches the
role - or empty, where a grant exists and row-level security filters.

The client is tested by Vitest (DECISIONS #24), in five kinds of file.

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
`tests/sample-events.json`, the real schedule of the year under test for
`real-data`, or a test's own copy of the sample, changed where it needs a
schedule the sample lacks - a removed event, a `was`, a digest. A test
drives the page through the DOM, through the handle `boot()` returned, and
through `app`, wherever a name lives. The backend's two constants, which
Vitest makes globals, are set before the import: empty - a build with no
backend, whatever the shell says - unless the test hands the helper a fake
of the Supabase Auth server, `tests/helpers/backend.js`, whose address and
key the page is built with and whose `fetch` it talks to. The window
outlives the modules, so the helper records every listener and interval
`boot()` registers and `cleanup()` removes them; it also fails the file if
the window saw an uncaught error.
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
`build.js`, which looks for the stamps. `year-files.test.js` hands the
client another year's season file and a venues file of other values, by
`vi.mock` of the two data modules, so that what the client derives is
seen to follow the files.

**Rules** (`tests/rules/`) are regexes over the text of `src/styles.css` and
of every module under `src/`, read one after another: declarations a page
in jsdom cannot show, since jsdom computes no layout. Two source rules
remain: [1240], the signature of `togglePick()`, which goes when a browser
test of the star's anchoring is written (ROADMAP, Flags), and [1728], no inline pixel font size, which stays a rule; ESLint
took the others. Two more hold the build's year (DECISIONS #49): no `dc26`
in `src/`, and no date written into a string under `src/`. `imports.test.js` reads the module graph instead: only
`main.js` imports `boot.js`, a module imports only npm packages, the year's
data file it owns and the modules before it in the order, every file under `src/` has a place in it,
and only the root imports `dispatch.js`.

**`tests/build.test.js`** runs the real `vite build` into temp folders: a
stamped build, an unstamped one, the default build id, a refused channel,
a refused secret key, the years it refuses, a build for 2027 in a
temporary copy of the project with a stand-in schedule - its schedule
copied, its worker and its name
stamped, the page booted to fetch, key and read its days by 2027 -
the shape of the output (one classic `<script>` at the end of the body,
one `<style>`, no separate assets, relative links in the head, the one file
copied from `data/`), and checks
of `sw.js`, the manifest, the icons and the head. It ends with the tests
that execute `dist/`: the built page in a JSDOM of its own, `fetch` stubbed
to serve the sample fixture, asserting that the first screen renders, a
search returns rows, nothing is asked for but the schedule and no uncaught
error fired; the page stamped with a channel, keeping everything under it;
and the next site's build given a backend, signing in by email against the
fake backend, keeping its session under the channel, and sending a star to
the fake's PostgREST as the user's pick.

**`tests/worker.test.js`** runs `public/sw.js` in Node against fakes of
`self`, `caches`, `fetch` and the worker's clients (DECISIONS #49): the
digest rule and its fallback, what the stamps name, and which caches
activate clears. It is not a browser, and does not stand in for a
browser test of the worker, which is still to write (#24, #81).

jsdom is Vitest's default environment; the files that only read text or run
the build opt out with a `// @vitest-environment node` docblock.

And the client is tested in real browsers by Playwright (DECISIONS #81),
for what jsdom cannot see: where a thing is, and how wide. `npm run
test:browser` runs every `tests/browser/*.spec.js` - Vitest collects none
of them - in Chromium and in WebKit at 375x667, 390x664 and 402x714, a
project for each engine at each size, as a phone with touch on. Its
`globalSetup`, `tests/browser/serve.js`, builds `dist/` afresh - the
default year, no channel, no backend, whatever the shell says - and
serves it with Vite's preview on port 4173 for the run; a port already
taken stops the run and says so, so a preview left running is never what
is tested. `tests/browser/harness.js` holds the states in one place - the
engines, the sizes, the clocks, the readers - and what every test opens
the page with: the service worker blocked, the clock `?now=`, the zone
the season file's, a reader seeded through localStorage by the keys a
build with no channel reads, the Google Fonts request answered with
Barlow's four weights from `@fontsource/barlow-semi-condensed`, and any
other request off this machine refused and failed on. Every test waits
for the four weights and fails where one did not load. There are no
retries and no waits by the clock; a failure keeps its trace. At most
four tests run at once: with sixteen side by side on one machine WebKit's
page stood still for seconds now and then, and a test timed out.
`standing.spec.js` is the two standing checks on each of the five tabs,
for a stranger and for a reader with picks and follows, at a moment
during the con and one before it: nothing scrolls sideways, and no
control is cut off - each shown button, link, input, select and textarea
lies inside every ancestor that clips it, on each axis, up to the first
ancestor that scrolls on that axis, and a control in a fixed element
inside the screen. One page a test, its assertions soft and named for
their tab, so a run reports every tab that fails. `rule.spec.js` holds
the rule itself on a page of its own, where every box has its size
written on it: that it still flags a control cut by an ancestor or by
the screen, and still stops at a scroller. A layout fault gets a named
test of its own: `chip.spec.js` is the first (#82), and
`mute-cast.spec.js` holds what Mute and the cast folds added (#84, #85). It is not an
iPhone - no iOS keyboard, no safe-area insets, no home-screen app,
`IS_IOS` false in both engines - and it tests nothing of the worker,
offline or install.

`tests/PORT-LEDGER.md` is the record of how this suite was made, frozen
since PR #102 (DECISIONS #83) and no longer amended: one row for
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
clock's, for every file but `time.js`. Two more declare the build's
defines as globals: `__DC_YEAR__`, for `src/season.js` alone, and the
backend's two, for `src/backend.js` alone. And the push function, under
`supabase/functions/`, runs in Deno: its block declares `Deno`, and turns
off Node's own names, which the config otherwise gives every file
(DECISIONS #55).

The Python test files are plain pytest modules; running one directly with
`python tests/test_parse.py` executes nothing.

## CI

`.github/workflows/ci.yml` runs all of the above on a clean Ubuntu runner
for every pull request into `next` or `main`, every push to `next`, and on
demand: job `client` (Node from `.nvmrc`, `npm ci`, lint, test) and job
`pipeline` (Python 3.13, `pip install`, pytest, then
`python events_v2.py --season data/2026/season.json --check`). `npm test`
runs the build itself, inside `tests/build.test.js`; pytest builds
`events.v2.json` afresh and compares it with the committed file, byte for
byte, with no model - the check the pipeline job then runs again as a
command - renders the census of it (DECISIONS #35) the same way, checks that
the page tests' fixture is a fresh build of the v1 sample, and holds 2026's
tag and track counters at zero (`tests/test_zero_hold.py`); once a live
year's first run past the ids stage has committed its `events.v2.json`, it
checks that year's change log against its `last-run.json` and
`events.v2.json` (`tests/test_changes_log.py`), and the pipeline job builds
the file afresh and compares it
(`python events_v2.py --season data/2027/season.json --check`). The
ruleset on `next` requires both
jobs to pass before a pull request can merge (DECISIONS #26), and it knows
them by their job ids: renaming either one un-gates the branch.

A third job, `database` (DECISIONS #52), installs the Supabase CLI with
`npm ci --prefix supabase` - `supabase/`'s own lockfile, never the root's -
starts the local database with the migrations and the seed applied, and
runs the pgTAP tests. Docker is already running on GitHub's Ubuntu runners.
It is a required check too, by its job id like the other two: it was added
to the `next` ruleset by hand after its first green run (ROADMAP, Checklist).

A fourth, `browser` (DECISIONS #81), runs the browser tests: `npm ci`, the
two engines - Chromium's headless shell and WebKit, kept in a cache keyed
by the Playwright version, so a moved pin fetches its own - the system
libraries they need, by apt at every run, and `npm run test:browser`,
which builds the page for itself. A failed run keeps Playwright's report,
the traces in it, as an artifact for a week. It becomes a required check
when it is added to the `next` ruleset by hand, after its first green run
on `next` (ROADMAP, Checklist).

## Branches

- `main` — the frozen 2026 app, tagged `v2026-final`. Ruleset `main`,
  active: a pull request is required (no approvals), the branch cannot be
  deleted or force-pushed, and nobody bypasses it.
- `next` — development, and the repo's default branch for the off-season.
  Ruleset `next - PR only`, active: a pull request is required (no
  approvals), squash is the only merge method, the checks `client`,
  `pipeline` and `database` must pass - and `browser`, once it is added
  (ROADMAP, Checklist) - the branch cannot be deleted or
  force-pushed, and only the repository admin can bypass it.
- Feature branches target `next`. GitHub deletes a head branch when its pull
  request merges, and a squash commit takes the pull request's title (the
  commit's, when there is only one), with the branch's commit messages as
  its body.
- `schedule/<stamp>` - the scrape's, one for each run that changed a file:
  it lands by pull request into the target, with auto-merge, and is deleted
  when it merges or a later run supersedes it (DECISIONS #48).

## Sharp edges to know

- The scrape lands by pull request (DECISIONS #48). A run that starts
  before the last run's pull request has merged builds on the target
  without it, and closes it as superseded; but if that pull request merges
  while the run is under way, the new one conflicts with it, and waits for
  the next run to supersede it. The token that pushes is a person's
  fine-grained token, which expires the month after the con (ROADMAP,
  Checklist), and the bot's commits carry that person's noreply address:
  a commit GitHub attributes to no account needs an extra approval under
  both rulesets, which auto-merge would wait on for ever.
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
  test. The Plans tab's are `data-tab="plans"`, `#view-plans` and
  `#plansBadge`, Mine's until PR #74 (DECISIONS #62).
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
  `sw.js` work and its browser tests (DECISIONS #24). `npm run dev` and the page
  tests run real modules and do not show it.
- `sw.js` cache version is bumped by hand. Any change to `public/sw.js`,
  a comment included, is a new worker for every installed client.
- The worker tells the page of a new schedule when the file's `digest`
  moves, which it does with every rebuild of the works or the events and
  with nothing else (DECISIONS #42, #49): a rebuild after a registry or
  cache edit keeps `generated_at` and moves the digest. A copy with no
  digest - one saved before the file had one - is judged by
  `generated_at`.
- The client is built for one year. A build for a year with no
  `data/<year>/events.v2.json` fails before it starts, so `DC_YEAR=2027`
  waits for the season's first run past the ids stage. It is set where
  each site is built - for `next`, the deploy repository's workflow
  (ROADMAP, Checklist) - and every storage key and cache name carries the
  year, so the switch starts each reader with nothing of 2026's.
- The page makes one third-party request at run time: Google Fonts, for
  Barlow Semi Condensed (`index.html`). The worker caches it.
- A build with no backend has no accounts and no sync: picks live on one
  device. With one, picks and follows sync once the phone has a user -
  the email step mints one - and what was starred before then goes up
  with the rest (DECISIONS #53).
- A Claude Code model alias moves with the CLI: on CLI 2.1.145 (2026-09-21)
  `sonnet` was claude-sonnet-4-6 and `opus` claude-opus-4-7. The tag stage
  asks by full id (`claude-sonnet-5`) and caches the id of the model that
  answered, and `draft_people.py` asks for `claude-opus-5` the same way.
- A retag is not neutral. Two runs of one model and prompt differ on a few
  percent of inputs for works and kind and more for the axes (DECISIONS
  #34), so the cache, not the model, keeps an event's tags stable: a year's
  `prompt_version`, in its `season.json`, is in every key, so a new one asks
  everything again, and a season takes no bump (#46); any edit to a
  registry or the cache needs `python events_v2.py` and then
  `python census_v2.py` after it, or CI fails.
