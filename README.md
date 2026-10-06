# Dragon Con 2026 planner

A phone-first schedule planner built on the data behind the official Dragon Con app. Search everything at once, star what you want, follow the tracks and guests you care about, and get walk-time warnings between hotels. Works with no signal.

**Live:** https://kilgoretrout853.github.io/dragoncon-planner/

## What's in here

| File | What it does |
|---|---|
| `data/2026/events.json` | The final 2026 schedule, frozen after the con: 3,459 events, scraped Sep 7 12:50 UTC. |
| `scraper.py` | The fetch stage: pulls every listing (panels + gaming) from the web version of the official app, for the year its `season.json` names, and writes that year's `source.json`, one raw row per listing. Takes ~20 minutes. The frozen `data/2026/events.json` was written by the 2026 scraper, which also merged duplicates. |
| `pipeline.py` | The 2027 pipeline, one run at a time: the fetch, the ids stage, the tag stage, the build and the diff in turn, every file the run changed written together at the end, or none, and `last-run.json`'s summary of it. See Running the pipeline. |
| `tag_events.py` | The 2026 tagger, retired: its tags (fandoms, kind, topics, guests, 18+) are in the frozen `events.json`, which the live site on `main` still reads. The client on `next` reads tags v2, from `events.v2.json`. |
| `tag_stage.py`, `tag_key.py`, `events_v2.py` | Tags v2: a model's answers about each event, cached, and the schedule with them built into `data/2026/events.v2.json`. See Tagging. |
| `parse_stage.py`, `registry.py` and `data/registry/`, `draft_people.py`, `census_v2.py`, `tools/` | The rest of the Discover pipeline, and the tools a person runs beside it. `docs/ARCHITECTURE.md`'s repo map says what each one is. |
| `index.html`, `src/` | The planner: the page's markup, the script as ES modules under `src/` (`main.js` is the entry and `boot.js` starts the app) and `src/styles.css`. Vite builds them into one inlined `dist/index.html`, which reads its year's `data/<year>/events.v2.json` - `DC_YEAR`'s, 2026 unless set. |
| `public/sw.js` | Service worker: keeps the app opening and rendering with no signal. |
| `public/manifest.json`, `icon.svg`, `icon-*.png`, `og-image.png` | Make it installable to a home screen as "DC26", with a proper icon on iOS and a preview card in chats. |
| `make_icons.py` | Renders the PNG icons and the preview image from the design in `public/icon.svg`. Needs Pillow; fetches the font once. |
| `.github/workflows/scrape.yml` | Runs the pipeline hourly in the season's window, and by hand, and lands each run that changed a file by pull request, with auto-merge. See The scrape workflow. |
| `mirror.py`, `.github/workflows/mirror.yml` | Copies a year's committed schedule and change log into the Supabase project, for the push job: on a push that changes them, hourly in the season's window, and by hand. See The mirror. |
| `supabase/functions/push/` | The push job: a function in the Supabase project that pg_cron calls every minute while the kill switch is on, telling a reader's browsers when a pick starts within fifteen minutes, and when a scrape changed one (DECISIONS #55; `docs/sync/contract.md`, section 7). |
| `vite.config.js`, `build/vite-dc.js` | The build. `DC_YEAR` names the year the client is for, 2026 unless set; with `DC_CHANNEL=next` it stamps the output as a dev build, for the `next` branch's site; `DC_SUPABASE_URL` and `DC_SUPABASE_KEY` name its backend, and without them it has none. |
| `tests/` | The pipeline's tests (pytest) and the client's (Vitest): units, rules over the source, the page in jsdom, the real schedule, the build. Not optional — run them before you push. |
| `docs/` | `ARCHITECTURE.md`, what the system is; `DECISIONS.md`, what was decided and why; `VISION.md` and `ROADMAP.md`, what 2027 is for and in what order; `scope-2027.md`, the scope pass: what the app does today, what 2027 wants and the verdicts; `official-app-2026.md`, the walk through the official 2026 app; `discover/`, the Discover design, its censuses and its review records; `pipeline/`, the 2027 pipeline's contract and the records behind it; `sync/`, the identity and sync recon and contract; `venues/`, the floor-plan checklist and the room census; `prototypes/`, throwaway sketches kept as a record; `SPLIT-MANIFEST.md`, the record of the module split. |

## Running it locally

```bash
pip install -r requirements.txt  # every package pinned, the ones they need among them
python scraper.py --season data/2026/season.json --limit 30 --out /tmp/source.json
                                 # smoke test against the live 2026 site; 2026 is frozen, so --out is outside data/2026/
python scraper.py --season data/2027/season.json   # the 2027 fetch, into data/2027/source.json

npm ci                           # Node version in .nvmrc
npm run dev                      # the app, unbuilt, at http://localhost:5173
npm run build && npm run preview # the app as it ships, from dist/
DC_YEAR=2027 npm run build       # the 2027 client, once data/2027/events.v2.json exists
```

The root `index.html` is a build template: opening it as a file, or serving the repo root with a static server, no longer runs the app.

**Tests need Node** (for jsdom) as well as Python:

```bash
npm ci
npm run lint                     # eslint: three rules
npm test                         # vitest: units, rules, the page in jsdom, the real schedule, the build
npx playwright install chromium webkit   # once: the two engines the browser tests drive, about 875 MB
npm run test:browser             # playwright: the built page in Chromium and WebKit, at three phone sizes
pip install -r requirements.txt
python -m pytest tests/          # the pipeline: scraper, parse, tag and build stages, registries
```

CI runs the same commands on every pull request (`.github/workflows/ci.yml`); a third job, `database`, runs the schema's pgTAP tests, and a fourth, `browser`, the browser tests. `next` takes no pull request until `client`, `pipeline` and `database` pass, and `browser` too once it is added to the ruleset.

The browser tests (`tests/browser/`, DECISIONS #81) check layout, which jsdom cannot: nothing scrolls sideways and no control is cut off, on every tab, and a named test for each layout fault. They build the page themselves and serve it on port 4173, and stop with a message if something is already listening there. The one-time install puts Chromium and WebKit under `%LOCALAPPDATA%\ms-playwright` on Windows (`~/.cache/ms-playwright` on Linux, where `npx playwright install-deps chromium webkit` adds the system libraries they need). A failed run leaves a report: `npx playwright show-report`.

The page tests boot the source in jsdom against `tests/sample-events.json` (558 synthetic events in the v2 shape, deterministic, which `python tools/sample_v2.py` makes from `tests/sample-events.v1.json`; CI checks it is fresh); `tests/real-data.test.js` boots it once more against the real `data/2026/events.v2.json`, because ranking questions are meaningless against synthetic rows. `docs/ARCHITECTURE.md` says how the suite is put together.

## Running the pipeline

`pipeline.py` runs a live season's stages in turn - fetch, ids, tag, build, diff - and writes every file the run changed together at the end, or none (`docs/pipeline/contract.md`, The run, as built):

```bash
python pipeline.py window --season data/2027/season.json            # "in window" or "out of window"
python pipeline.py run --season data/2027/season.json               # the whole run
python pipeline.py run --season data/2027/season.json --to ids      # a season's first run: its source and ids
python pipeline.py run --season data/2027/season.json --from build  # after a registry edit: rebuild and diff
python pipeline.py summary --format md                              # the last run's summary, as Markdown
```

The season's window is `window` in its `season.json`, read as local days in its time zone; outside it a run stops before it starts and writes nothing, and `--force` runs it anyway. `--to` stops after the fetch, the ids stage or the tag stage and writes what exists so far; `--from` starts at the ids stage, the tag stage or the build and reads what it skips from the committed files, keeping the last fetch's `fetched_at` and `fetch_code_hash`. `--limit N` takes only the first N listings, and `--requests N` sets the tag stage's cap for the run. A run that changes nothing writes nothing, `last-run.json` included; a fatal one writes nothing and exits 2. The tag stage calls the API with `ANTHROPIC_API_KEY` in the environment, and Claude Code without it. On Actions the scrape workflow runs it (below).

## Using it

Five tabs: Now, Search, Explore, Map and Plans. Before the con the app opens on Explore; from its start, on Now. A crew's invite link opens it on Plans, at the step that joins the crew, whatever the day. A shared day's link opens that day's events over whatever tab the app opens on.

- **Now** opens with a hero card for the one thing you have to act on: a countdown ring to the end of the pick that is on, or to the start of the next. While a pick is on, one line says when it ends, then where and when the next one is and the walk to it ("ends 2:00 PM · then Hilton at 3:00 PM, ~16 min walk"), or, when the gap is too short, what the warning between the two rows says - tight but doable, or the minutes to get there - or the overlap, which both picks' rows flag; the last two in the warn colour. With nothing on, the ring counts down to the start and the walk from your previous pick is offered as an estimate ("~12 min from the Westin"), not an instruction. It never tells you when to leave, and never guesses where you are (DECISIONS #5, #40). Below it, in a crew and while the con is on, your crew's picks right now: a line a crewmate, what they have starred that is on now or next today and where it is, marked "yours too" when it is your pick too - four, then how many more, which opens the crew's day in Plans. Then the rest of your day and everything on now or starting within the hour.
- **Search** understands what you type. `star trek saturday hilton` searches "star trek" across Saturday's Hilton events and shows you which words it took as filters, each removable. `late night`, `signing sunday`, `tonight` and `kids` all work; a query that's entirely filters scopes to today unless you say otherwise. Typing two letters suggests guests and fandoms by name. Events that already happened sit behind a fold. When nothing matched a word literally, it says so rather than pretending. The filters - the hotel, the kind, panels or gaming, the fandom, the track, four topic menus (medium, genre, craft, subject), four more under Getting in (cost, sign-up, audience and sold out) and the photo-session hide - are behind the **Filters** button beside the box: each tap applies at once and the button at the bottom says how many events that leaves. Each filter set shows as a chip under the box, a tap taking it off, and the button's badge counts them; a word you typed, like `hilton`, holds its filter while it is in the box. The search index is built after the first screen is up, in idle time; until then the box says indexing… and a query typed early runs the moment it can.
- **Explore** lists everything you could follow as tiles with counts, in five sections: Tracks A to Z, Fandoms with 3+ events, Topics, Guests, and Panelists with 5+ events. Each section opens with a dozen tiles and a Show all; the chips under the filter box jump between sections, and the chip for the section on screen shows as pressed. Tap a tile for its own page, with Follow and, beside it, Mute: a muted thing is no longer suggested to you, and is hidden nowhere. A fandom's page ends with "With the cast", the events its cast is on that are not about it. Once you have starred something, a "Because you starred" strip above the filter offers the tracks, fandoms and guests behind your picks that you don't follow yet, and under it a "Muted" fold keeps what you muted, each with an x that unmutes it. Each page is linkable as `#explore=kind:key`. Once you have starred or followed something, **For you** comes first: a few events you have not starred that fit the gaps in your plan, each saying why it is there - "You follow Star Trek", "Like your picks: Space" - four of them, and Show more for the rest; it stays as it is while you look at it. Once you follow something, a **Following** section sits under it, above the grid, with what you follow, grouped by interest or merged into one timeline; an event reached by two follows appears once, labelled with both. It folds away behind its header: it starts folded where For you is above it, and from your first tap on the header it stays as you leave it. By interest, a followed fandom's block ends with "With the cast" too; and in Search, with the Fandom filter set and no word typed to rank by, the list is followed by that fandom's cast.
- **Map** is a schematic of the con hotels, transit-map style, drawn from the venues' real positions at one scale so the distances mean something: Peachtree St up the left, the Hyatt and the Marriott nearly touching east of it with the Hilton a real walk further on (that long skybridge crosses Courtland St, as it does in life), the Mart and the Westin west of Peachtree with their own skybridge, the Courtland under the Hilton, and Hardy Ivy Park above the Hyatt. Hotel level only; streams and offsite venues are not on it. A row of day chips above it picks the con day, starting on today with the same 5 AM boundary as the rest of the app. Each hotel wears a gold pill with the number of your picks there that day, and, in a crew, an outlined one under it with a person on it: how many of your crewmates have a pick there that day. Tap a hotel (or either pill) for your picks there as ordinary rows, star and detail sheet included; a hotel with none of yours offers a button that searches it on that day. In a crew, Your crew's picks here follows: a line for each of your crewmates' picks at that hotel that day - who, when and the room - which opens the event's detail sheet. When the chosen day is today, a solid gold ring marks the hotel of the pick that is on now, a pulsing one the hotel of the next pick. Under the map, a card shows your next pick as the Now tab sees it: title, room and hotel in the hotel's colour, the start and how long until it, and the walk from the pick before it when that was in another building. Tap it for the event's detail sheet. While a pick is on, a line above the card names it. With nothing left today the card shows the first pick of the next con day, labelled; with no picks at all it says where to get one. Picks at venues the map does not draw are counted under the card. Tap the place on an event's detail sheet and the Map opens on that event's day with a third ring, not gold, on its hotel and the card showing the event you were looking at; tap the card to go back to it. Leave the tab, pick a day or change the clock and the Map is as it was.
- **Plans** shows your picks as a timeline by default — blocks sized by duration, clashes side by side, walk connectors between hotels, a now-line. Or as a list. "Export to calendar" downloads an `.ics` with the correct Eastern time zone. "Share a day" beside it sends one day of your picks as a message with a link, through your phone's share sheet or the clipboard: whoever opens the link, with the app or without it, sees that day's events with their own stars, in a list that isn't kept. No account and no backend are involved. On a build with a backend, the top of Plans is your crew's: its name, how many are in it, and Manage; or, in no crew, a line offering to start one or to paste an invite link. In a crew, My day | Crew switches between your own plan and the crew's day, one block of picks a person (below).

A con day runs to 5 AM, everywhere in the app: a 1 AM panel sits under the day before on the day chips, in day headers, in Plans and on the Now tab. The detail sheet and the calendar export keep the real date and say which night it belongs to.

Rows and the detail sheet name the hotel before the room ("Hilton · 313-314"), and a row the level after it where the room does not already say it ("Hilton · 306 · 3rd Floor"); the Mart's room is its whole place ("Mart Building 3, Floor 1"), a stream is just "Streaming" and an offsite venue is itself. A row gives its time as a range ("2:30–3:30 PM") and, under that, what else is true of the event: Celebrity, an overlap with another of your picks, Sold out, Extra fee, Sign-up, an age or Kids, and its track. Tap any row for the detail sheet: hotel and room, a tap that shows the event on the Map, and the level in full, what else is true of the event - the row's flags, a part, a game's format - its other sessions still to come ("Also runs Sun 2:30 PM"), in a crew who of it has starred it, the description, the people on it, each name the way to that person's page, its track and fandoms, each the way to its Explore page, your picks it overlaps - or would, before you star it - then star and a single-event calendar export. Swipe it down to dismiss.

**Settings** (gear): crowd factor for walk estimates, the default noise filter and a Larger text switch up top. Under **Advanced**: preview any time (`?now=2026-09-05T14:00` in the URL does the same), the walk-time table, and a device readout that ends with the build time. Remove all picks is last, on its own.

## After the con

The app knows the con's bounds (`CON` in `src/time.js`: the season file's first and last day, from 18:00 on the first to 19:00 on the last - the 2026 schedule's first start and last end) and derives a phase from the clock: before, live, or ended. Once it has ended, a dismissible banner says so, the Now tab becomes **Your 2026 schedule** - every starred event by day, still starrable - and nothing anywhere says "on now" or "in 40 min". Search, Explore, the map, Plans and the calendar export work as before, except that the "Already happened" folds are gone, since everything has.

Every read of the clock goes through one `now()` function. `?now=2026-09-05T14:15` in the URL (an offset works too: `?now=2026-09-05T14:15:00-04:00`) simulates that moment for the whole app and shows a small **simulated time** chip in the header; the override is kept for the tab's session, so reloads keep it, and the chip or Settings clears it. That is how the live behaviour is checked in the off-season.

Picks, follows and mutes live in the browser's storage, per device. On a build with a backend, picks and follows also sync once the phone has a user, so a plan kept by email comes back on another phone; a day's picks are shared by a link (Share a day); mutes stay on the device.

## The next site

`main` is the live site and publishes straight from the branch, as it always has. Off-season work happens on `next`, which publishes to a site of its own at https://kilgoretrout853.github.io/dragoncon-planner-next/. A repository has one Pages site with one source, so a `/next/` path under the live site would have had to be part of `main`'s own publish; a sibling site leaves `main` alone.

The publishing lives in the [`dragoncon-planner-next`](https://github.com/KilgoreTrout853/dragoncon-planner-next) repository, not here. Its workflow looks at this repository's `next` branch every ten minutes and on demand; when the branch has moved it checks it out, builds it (`npm ci && npm run build`) with `DC_CHANNEL=next`, pushes the result to its own `gh-pages` branch, and records the commit it deployed in `deployed.txt`. This repository is public, so none of that needs a credential. To deploy now rather than within ten minutes:

```bash
gh workflow run deploy.yml -R KilgoreTrout853/dragoncon-planner-next
```

`npm run build` writes the site into `dist/` - one `index.html` with the CSS and script inlined, the files from `public/`, and the year's `data/<year>/events.v2.json`, the one data file the client reads - and, given a channel, stamps it: `index.html` gets the channel and build id in two `<meta>` tags, which the page reads to show the **dev build** mark and to name the build in the device readout; `sw.js` gets a cache name of its own (`dc26-next-v7`), because the two sites share one origin and would otherwise delete each other's caches. The source carries empty stamps, so a build with no channel wears no mark and its `sw.js` is `public/sw.js` byte for byte; the mark is decided by the stamp, never by the address. `main` is still the 2026 one-file app and never runs a build. `dist/` is ignored by git.

`DC_YEAR` names the year the client is built for: four digits, 2026 unless set, and a year with no `data/<year>/events.v2.json` does not build. A build for another year stamps it into the worker, the page's name and the manifest, and keys everything it stores by the year, so it starts with none of 2026's picks, follows or settings (DECISIONS #49). The next site moves to 2027 by a line of its workflow, once 2027's first run has written the file (ROADMAP, Checklist).

One origin also means one localStorage, so the storage keys carry the channel as the cache name does - `dc26.picks.next` on the next site where the live one keeps `dc26.picks` - and the next site keeps a plan of its own. A home-screen install on iOS keeps its own storage, so the phone's live app is unaffected.

A build without `DC_SUPABASE_URL` and `DC_SUPABASE_KEY` has no backend: the page asks for nothing but the schedule, and Settings shows no Keep your plan. Given both - a Supabase project's address and its public key, repository variables on the deploy repository and never secrets - a reader can keep their plan by email (DECISIONS #51, #53).

With a backend there are crews, too (DECISIONS #56, #62): a few people who see each other's starred events. Plans' **Start a crew** names one and your name in it; **Manage** lists who is in it, copies or shares its invite link - a shared one reads `Join "<crew>" on the Dragon Con planner: <link>` - and lets the crew's creator make a new link, remove someone or delete the crew, and anyone else leave it. A tapped invite link opens the app on the step that joins, which asks only your name; an iPhone opens a link in Safari rather than in the home-screen app, so there the link is pasted into **Join with a link** instead, and the home-screen app joins as a member of its own. Joining shares your name and your starred events with everyone in the crew, now and later. **Crew**, beside My day, shows one day: day chips, then each member's picks that day, yours first, each star still yours to tap. Elsewhere a crew is a layer, not a place: an event's detail sheet says who of everyone you share a crew with has starred it ("Starred by Sam, Alex, Jo and 2 more") - a star is a pick, not a promise to be there, Now lists what each is on now or has next, and the Map counts them per hotel, a hotel's sheet listing what each has there that day. Nothing a crew action does is shown until the server has it: each is one request, then a sync, and a failure says why and changes nothing on the phone.

## Offline

The service worker caches the app and the schedule, so it opens and renders in a building with no signal — which is the normal state of the Marriott lobby.

- `index.html` is network-first with a 3-second timeout, so fixes land when there's signal and a saturated tower can't stop the app opening. A copy that arrives after the limit is stored for the next launch, so a slow tower delays a fix by one open rather than for ever.
- The schedule is served from cache immediately and refreshed behind you. When it changes you get a "Schedule updated · tap to refresh" pill rather than the list moving under your thumb. Coming back to the app after 15 minutes or more away checks again, the same quiet way.
- When the cached copy is what you're seeing, the line under the clock says `· offline copy`.

To install: iPhone must use **Safari** (Share → Add to Home Screen); Android uses Chrome (⋮ → Install app). Once you have starred something, and until it is installed, the Now tab opens with a nudge saying so, which can be put off for a week at a time. You get a **DC26** icon that opens without browser chrome. The content area scrolls inside its own container rather than the page, so the header and the nav stay put on an iPhone instead of riding the system's bottom inset. The status bar is opaque on purpose: on iOS 26 a translucent one leaves the web view short by its own height, with a dead strip at the bottom of the screen. iOS reads these web-app settings once, when the icon is added, so a change to them only reaches a phone after the icon is deleted and added again from Safari. The device line under Advanced in Settings ends with the build time, so you can tell which version a phone is running.

Bump `CACHE` in `public/sw.js` when the built page or the worker changes in a way that must reach people immediately; the site's other caches, of any year, are dropped on activate.

## Tagging

The 2026 schedule is frozen, so tags v2 are written beside it rather than into it, by two scripts.

`tag_stage.py` asks a model what each event is about - its kind, the works it is about, four closed axes, the audience and, on a gaming event, how it is played - once for each distinct input a season, and caches the answer in the `tags.cache.jsonl` beside the season file, `data/<year>/`. The input is what the model is sent: the title without its price, clock time or SOLD OUT, the scraped type and tracks, and the description without its "Additional Panelists:" line; the key it is cached under is a hash of that and the year's `prompt_version`, from its `season.json` (`tag_key.py`). It reads a year's events as the build does, through its front door and the merge. A run sends at most the season's `requests_per_run` requests, 40, and an input past the cap waits for a later run; `--requests` lifts it for a hand run. A second run sends nothing. A work name the registry does not know becomes a `data/registry/works.json` row, unreviewed, carrying `minted: {year, run}`, placed under a parent by one more request. `seed` copies another year's answers to the inputs a season shares with it. 2026 is frozen: the tag stage reads it with `--dry-run` only.

`events_v2.py` builds `data/2026/events.v2.json` from the frozen schedule, the venues file, the registries and the cache, with no model. CI checks that the committed file is a fresh build.

`census_v2.py` writes `docs/discover/census-v2-2026.md`, the census of that file: what it holds, the works and people still to review, and the links worth a look. CI checks that it is fresh too, so an edit to a registry or the cache is followed by `python events_v2.py` and then `python census_v2.py`, and both files are committed.

```bash
python tag_stage.py --dry-run                                        # 2026: what would be sent, and how big; calls nothing
python tag_stage.py --season data/2027/season.json --workers 3       # every uncached input, up to the cap; then mints
python tag_stage.py --season data/2027/season.json --requests 200    # a season's first full tag, past the cap
python tag_stage.py seed --season data/2027/season.json --from 2026  # 2026's answers to the inputs 2027 shares
python events_v2.py              # no model; --check exits 1 if the committed file is stale
python census_v2.py              # no model; the census of it; --check exits 1 if the report is stale
```

A live year's tag stage needs the year's `source.json`, ledger and `last-run.json`, which a pipeline run leaves, so a season starts with a run to the ids stage (`pipeline.py run --to ids`), then `seed`; the cron's runs tag the rest, a first tag in about three of them, and a hand tag with `--requests` set high is optional.

With `ANTHROPIC_API_KEY` set in the environment it calls the API; nothing reads a key from a file. Without it, it runs `claude -p` on your subscription: the prompt on stdin, from an empty directory of its own, with no tools, no MCP servers and no saved session, so that no CLAUDE.md or memory rides along. That is practical now - about 70 seconds for a request of 25 inputs.

`tag_events.py`, the 2026 tagger, is retired: it wrote `tags: {fandoms, kind, topics, adult, guests}` into `events.json` and now refuses to. The live site on `main` still reads those v1 tags, whose fandom names `CANON` in that script normalised, so its picker shows one "Marvel" rather than Marvel, MCU and Avengers. The client on `next` reads `events.v2.json` instead (DECISIONS #39), where a fandom is a registry work, by id.

## Duplicates

The same event is often listed twice — once in the panel feed and once in gaming, or cross-listed under two tracks — and the copies disagree, one carrying the speakers and the other not. In 2026 `scraper.py` grouped by normalised title, start and room and merged each group: smallest id survives (so existing picks keep pointing at something), speakers and tracks union, panel beats gaming, longest description wins, tags follow whichever copy had them. That was 146 groups and 192 rows on a typical scrape. The fetch no longer merges: `source.json` keeps every listing, and the 2027 pipeline's ids stage and merge take the groups over (DECISIONS #43, #44).

## Walk times

Estimates in minutes, before the crowd factor, as `walk` in the year's `data/<year>/venues.json`, beside `same_venue_min`, `unknown_pair_min` and `slack_min`; the client imports the file at its build (DECISIONS #49). Edit the year's file if you know better — especially Westin and Courtland Grand, the far ends.

## If the scraper breaks

Hosted by Core-apps at `https://app.core-apps.com/dragoncon26`. Day pages are `events/view_by_day?day=Sep++5` (two spaces) with `&type=Entertainment` for gaming. Each event page is `event/<id>` with a Location/Date/Duration table, a description, an optional Speakers list, and a Tracks section. `tests/test_parse.py` shows the exact markup the parser expects.

**The host signals rate limiting with `403`, not `429`.** That has to stay in the retry `status_forcelist` in `make_session()`; without it the first throttle turns every remaining fetch into an instant failure — it once cost 3,285 of 3,577 events.

## The scrape workflow

`.github/workflows/scrape.yml` runs the pipeline hourly, at 17 minutes past, inside the season's window - 2027-08-01 to 2027-09-07 in `data/2027/season.json`, read in the con's time zone - and a run outside it checks the window and stops. By hand (Actions → Scrape → Run workflow) it takes `force`, to run outside the window; `to`, to stop after fetch, ids or tag (refused once the year's `events.v2.json` exists); `limit`, the first N listings only; `requests`, the tag stage's cap for the run; `season`; and `target`, the branch it starts from and lands on - by default the `SCRAPE_TARGET` repository variable, `next` until the freeze. Nothing overrides a fatal rule.

A run that changed a committed file lands by pull request (DECISIONS #48): it commits as schedule-bot to a `schedule/<stamp>` branch off the target, opens a pull request into the target with the run's summary as its body, closes the bot's older open ones as superseded, and turns on auto-merge, so the pull request merges once CI passes. A run that changed nothing, or a fatal one, commits nothing, and a fatal one fails the job. Each fault - a failed page, an input past the request cap, an event untagged - shows as a warning on the run, and the rooms still to curate as notices. Two runs never overlap: a second waits for the first.

The client is built for one year, `DC_YEAR`'s, 2026 unless set (DECISIONS #49): the next site moves to 2027 once the season's first run past the ids stage has written `data/2027/events.v2.json`, and `main` at the freeze (ROADMAP, Checklist). The 2026 file stays where it is.

## The mirror

`mirror.py` copies a year's committed `events.v2.json`, and the change log's lines since it last ran, into the Supabase project's `schedule_events` and `schedule_changes`, where the push job is to read them (DECISIONS #54; `docs/sync/contract.md`, section 6). The pipeline never learns of it, and nothing waits on it: a run that fails is completed by the next.

```bash
python mirror.py --season data/2026/season.json --dry-run   # read and check the files, send nothing: 3,459 events, 0 lines
python mirror.py --season data/2027/season.json             # with SUPABASE_URL and SUPABASE_SERVICE_KEY set
```

`.github/workflows/mirror.yml` runs it when a push to `next` or `main` changes a year's `events.v2.json`, `changes.jsonl` or `last-run.json` - a scrape's pull request landing - hourly at 47 minutes past inside the season's window, and by hand (Actions → Mirror → Run workflow) with a `season`. On `next` it runs under the `dev` Environment and on `main` under `production`, each holding its project's `SUPABASE_URL` variable and `SUPABASE_SERVICE_KEY` secret, the project's secret key, which the job never prints.
