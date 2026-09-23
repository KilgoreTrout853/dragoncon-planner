# Dragon Con 2026 planner

A phone-first schedule planner built on the data behind the official Dragon Con app. Search everything at once, star what you want, follow the tracks and guests you care about, and get walk-time warnings between hotels. Works with no signal.

**Live:** https://kilgoretrout853.github.io/dragoncon-planner/

## What's in here

| File | What it does |
|---|---|
| `data/2026/events.json` | The final 2026 schedule, frozen after the con: 3,459 events, scraped Sep 7 12:50 UTC. |
| `scraper.py` | The fetch stage: pulls every listing (panels + gaming) from the web version of the official app, for the year its `season.json` names, and writes that year's `source.json`, one raw row per listing. Takes ~20 minutes. The frozen `data/2026/events.json` was written by the 2026 scraper, which also merged duplicates. |
| `tag_events.py` | The 2026 tagger, retired: its tags (fandoms, kind, topics, guests, 18+) are in the frozen `events.json`, which the live site on `main` still reads. The client on `next` reads tags v2, from `events.v2.json`. |
| `tag_stage.py`, `events_v2.py` | Tags v2: a model's answers about each event, cached, and the schedule with them built into `data/2026/events.v2.json`. See Tagging. |
| `parse_stage.py`, `registry.py` and `data/registry/`, `draft_people.py`, `census_v2.py`, `tools/` | The rest of the Discover pipeline, and the tools a person runs beside it. `docs/ARCHITECTURE.md`'s repo map says what each one is. |
| `index.html`, `src/` | The planner: the page's markup, the script as ES modules under `src/` (`main.js` is the entry and `boot.js` starts the app) and `src/styles.css`. Vite builds them into one inlined `dist/index.html`, which reads `data/2026/events.v2.json`. |
| `public/sw.js` | Service worker: keeps the app opening and rendering with no signal. |
| `public/manifest.json`, `icon.svg`, `icon-*.png`, `og-image.png` | Make it installable to a home screen as "DC26", with a proper icon on iOS and a preview card in chats. |
| `make_icons.py` | Renders the PNG icons and the preview image from the design in `public/icon.svg`. Needs Pillow; fetches the font once. |
| `.github/workflows/scrape.yml` | The 2026 refresh, by hand only. It fails at its Scrape step now that the scraper is the fetch stage, until the 2027 workflow replaces it. |
| `vite.config.js`, `build/vite-dc.js` | The build. With `DC_CHANNEL=next` it stamps the output as a dev build, for the `next` branch's site. |
| `tests/` | The pipeline's tests (pytest) and the client's (Vitest): units, rules over the source, the page in jsdom, the real schedule, the build. Not optional — run them before you push. |
| `docs/` | `ARCHITECTURE.md`, what the system is; `DECISIONS.md`, what was decided and why; `VISION.md` and `ROADMAP.md`, what 2027 is for and in what order; `discover/`, the Discover design, its censuses and its review records; `venues/`, the floor-plan checklist and the room census; `SPLIT-MANIFEST.md`, the record of the module split. |

## Running it locally

```bash
pip install -r requirements.txt  # requests, beautifulsoup4, urllib3, ftfy, pytest - pinned
python scraper.py --season data/2026/season.json --limit 30 --out /tmp/source.json
                                 # smoke test against the live 2026 site; 2026 is frozen, so --out is outside data/2026/
python scraper.py --season data/2027/season.json   # the 2027 fetch, into data/2027/source.json

npm ci                           # Node version in .nvmrc
npm run dev                      # the app, unbuilt, at http://localhost:5173
npm run build && npm run preview # the app as it ships, from dist/
```

The root `index.html` is a build template: opening it as a file, or serving the repo root with a static server, no longer runs the app.

**Tests need Node** (for jsdom) as well as Python:

```bash
npm ci
npm run lint                     # eslint: three rules
npm test                         # vitest: units, rules, the page in jsdom, the real schedule, the build
pip install -r requirements.txt
python -m pytest tests/          # the pipeline: scraper, parse, tag and build stages, registries
```

CI runs the same commands on every pull request (`.github/workflows/ci.yml`), and `next` takes no pull request until both of its jobs pass.

The page tests boot the source in jsdom against `tests/sample-events.json` (558 synthetic events in the v2 shape, deterministic, which `python tools/sample_v2.py` makes from `tests/sample-events.v1.json`; CI checks it is fresh); `tests/real-data.test.js` boots it once more against the real `data/2026/events.v2.json`, because ranking questions are meaningless against synthetic rows. `docs/ARCHITECTURE.md` says how the suite is put together.

## Using it

Five tabs.

- **Now** opens with a hero card for the one thing you have to act on: a countdown ring and, while a pick is on, when to leave that building for the next one. It turns amber once you're late. The app never guesses where you are: the only location it will claim is the hotel of a pick that is on right now. With nothing on, the ring counts down to the start and the walk from your previous pick is offered as an estimate ("~12 min from the Westin"), not an instruction. Below it, the rest of your day and everything on now or starting within the hour.
- **Search** understands what you type. `star trek saturday hilton` searches "star trek" across Saturday's Hilton events and shows you which words it took as filters, each removable. `late night`, `signing sunday`, `tonight` and `kids` all work; a query that's entirely filters scopes to today unless you say otherwise. Typing two letters suggests guests and fandoms by name. Events that already happened sit behind a fold. When nothing matched a word literally, it says so rather than pretending. The search index is built after the first screen is up, in idle time; until then the box says indexing… and a query typed early runs the moment it can.
- **Explore** lists everything you could follow as tiles with counts, in five sections: Tracks A to Z, Fandoms with 3+ events, Topics, Guests, and Panelists with 5+ events. Each section opens with a dozen tiles and a Show all; the chips under the filter box jump between sections, and the chip for the section on screen shows as pressed. Tap a tile for its own page and a Follow button. Once you have starred something, a "Because you starred" strip above the filter offers the tracks, fandoms and guests behind your picks that you don't follow yet. Each page is linkable as `#explore=kind:key`. Once you follow something, a **Following** section sits above the grid with what you follow, grouped by interest or merged into one timeline; an event reached by two follows appears once, labelled with both. It folds away behind its header, and stays folded if you leave it that way.
- **Map** is a schematic of the con hotels, transit-map style, drawn from the venues' real positions at one scale so the distances mean something: Peachtree St up the left, the Hyatt and the Marriott nearly touching east of it with the Hilton a real walk further on (that long skybridge crosses Courtland St, as it does in life), the Mart and the Westin west of Peachtree with their own skybridge, the Courtland under the Hilton, and Hardy Ivy Park above the Hyatt. Hotel level only; streams and offsite venues are not on it. A row of day chips above it picks the con day, starting on today with the same 5 AM boundary as the rest of the app. Each hotel wears a gold pill with the number of your picks there that day. Tap a hotel (or its pill) for those picks as ordinary rows, star and detail sheet included; a hotel with none offers a button that searches it on that day. When the chosen day is today, a solid gold ring marks the hotel of the pick that is on now, a pulsing one the hotel of the next pick. Under the map, a card shows your next pick as the Now tab sees it: title, room and hotel in the hotel's colour, the start and how long until it, or, while a pick is on somewhere else, when to leave the building you are in, plus the walk estimate when there is one. Tap it for the event's detail sheet. While a pick is on, a line above the card names it. With nothing left today the card shows the first pick of the next con day, labelled; with no picks at all it says where to get one. Picks at venues the map does not draw are counted under the card.
- **Mine** shows your picks as a timeline by default — blocks sized by duration, clashes side by side, walk connectors between hotels, a now-line. Or as a list. "Export to calendar" downloads an `.ics` with the correct Eastern time zone.

A con day runs to 5 AM, everywhere in the app: a 1 AM panel sits under the day before on the day chips, in day headers, in Mine and on the Now tab. The detail sheet and the calendar export keep the real date and say which night it belongs to.

Rows and the detail sheet name the hotel before the room ("Hilton · 313-314"); a stream is just "Streaming" and an offsite venue is itself. Tap any row for the detail sheet: description, panelists with a "See all" link to each person, hotel and room, star, and a single-event calendar export. Swipe it down to dismiss.

**Settings** (gear): crowd factor for walk estimates, the default noise filter and a Larger text switch up top. Under **Advanced**: preview any time (`?now=2026-09-05T14:00` in the URL does the same), the walk-time table, and a device readout that ends with the build time. Remove all picks is last, on its own.

## After the con

The app knows the con's bounds (`CON` in `src/time.js`: the first listed event's start to the last one's end) and derives a phase from the clock: before, live, or ended. Once it has ended, a dismissible banner says so, the Now tab becomes **Your 2026 schedule** - every starred event by day, still starrable - and nothing anywhere says "on now", "leave by" or "in 40 min". Search, Explore, the map, Mine and the calendar export work as before, except that the "Already happened" folds are gone, since everything has.

Every read of the clock goes through one `now()` function. `?now=2026-09-05T14:15` in the URL (an offset works too: `?now=2026-09-05T14:15:00-04:00`) simulates that moment for the whole app and shows a small **simulated time** chip in the header; the override is kept for the tab's session, so reloads keep it, and the chip or Settings clears it. That is how the live behaviour is checked in the off-season.

Picks and follows live in the browser's storage, per device. They aren't shared between phones and there's no URL format for them yet.

## The next site

`main` is the live site and publishes straight from the branch, as it always has. Off-season work happens on `next`, which publishes to a site of its own at https://kilgoretrout853.github.io/dragoncon-planner-next/. A repository has one Pages site with one source, so a `/next/` path under the live site would have had to be part of `main`'s own publish; a sibling site leaves `main` alone.

The publishing lives in the [`dragoncon-planner-next`](https://github.com/KilgoreTrout853/dragoncon-planner-next) repository, not here. Its workflow looks at this repository's `next` branch every ten minutes and on demand; when the branch has moved it checks it out, builds it (`npm ci && npm run build`) with `DC_CHANNEL=next`, pushes the result to its own `gh-pages` branch, and records the commit it deployed in `deployed.txt`. This repository is public, so none of that needs a credential. To deploy now rather than within ten minutes:

```bash
gh workflow run deploy.yml -R KilgoreTrout853/dragoncon-planner-next
```

`npm run build` writes the site into `dist/` - one `index.html` with the CSS and script inlined, the files from `public/`, and `data/2026/events.v2.json`, the one data file the client reads - and, given a channel, stamps it: `index.html` gets the channel and build id in two `<meta>` tags, which the page reads to show the **dev build** mark and to name the build in the device readout; `sw.js` gets a cache name of its own (`dc26-next-v5`), because the two sites share one origin and would otherwise delete each other's caches. The source carries empty stamps, so a build with no channel wears no mark and its `sw.js` is `public/sw.js` byte for byte; the mark is decided by the stamp, never by the address. `main` is still the 2026 one-file app and never runs a build. `dist/` is ignored by git.

One origin also means one localStorage: in an ordinary browser tab the next site reads the same picks and settings as the live one. A home-screen install on iOS keeps its own storage, so the phone's live app is unaffected. The simulated clock is the exception: its session key carries the channel, so a `?now=` opened on the next site does not follow you to the live site in the same tab.

## Offline

The service worker caches the app and the schedule, so it opens and renders in a building with no signal — which is the normal state of the Marriott lobby.

- `index.html` is network-first with a 3-second timeout, so fixes land when there's signal and a saturated tower can't stop the app opening. A copy that arrives after the limit is stored for the next launch, so a slow tower delays a fix by one open rather than for ever.
- The schedule is served from cache immediately and refreshed behind you. When it changes you get a "Schedule updated · tap to refresh" pill rather than the list moving under your thumb. Coming back to the app after 15 minutes or more away checks again, the same quiet way.
- When the cached copy is what you're seeing, the line under the clock says `· offline copy`.

To install: iPhone must use **Safari** (Share → Add to Home Screen); Android uses Chrome (⋮ → Install app). Until it is installed, the Now tab opens with a nudge saying so, which can be put off for a week at a time. You get a **DC26** icon that opens without browser chrome. The content area scrolls inside its own container rather than the page, so the header and the nav stay put on an iPhone instead of riding the system's bottom inset. The status bar is opaque on purpose: on iOS 26 a translucent one leaves the web view short by its own height, with a dead strip at the bottom of the screen. iOS reads these web-app settings once, when the icon is added, so a change to them only reaches a phone after the icon is deleted and added again from Safari. The device line under Advanced in Settings ends with the build time, so you can tell which version a phone is running.

Bump `CACHE` in `public/sw.js` when the built page or the worker changes in a way that must reach people immediately; older `dc26-*` caches are dropped on activate.

## Tagging

The 2026 schedule is frozen, so tags v2 are written beside it rather than into it, by two scripts.

`tag_stage.py` asks a model what each event is about - its kind, the works it is about, four closed axes, the audience and, on a gaming event, how it is played - once for each distinct input, and caches the answer in `data/2026/tags.cache.jsonl`. The input is what the model is sent: the title without its price, clock time or SOLD OUT, the scraped type and tracks, and the description without its "Additional Panelists:" line. A second run sends nothing. A work name the registry does not know becomes a `data/registry/works.json` row, unreviewed, placed under a parent by one more request.

`events_v2.py` builds `data/2026/events.v2.json` from the frozen schedule, the venues file, the registries and the cache, with no model. CI checks that the committed file is a fresh build.

`census_v2.py` writes `docs/discover/census-v2-2026.md`, the census of that file: what it holds, the works and people still to review, and the links worth a look. CI checks that it is fresh too, so an edit to a registry or the cache is followed by `python events_v2.py` and then `python census_v2.py`, and both files are committed.

```bash
python tag_stage.py --dry-run    # what would be sent, and how big; calls nothing
python tag_stage.py --workers 3  # asks about every uncached input, then mints the new works
python events_v2.py              # no model; --check exits 1 if the committed file is stale
python census_v2.py              # no model; the census of it; --check exits 1 if the report is stale
```

With `ANTHROPIC_API_KEY` set in the environment it calls the API; nothing reads a key from a file. Without it, it runs `claude -p` on your subscription: the prompt on stdin, from an empty directory of its own, with no tools, no MCP servers and no saved session, so that no CLAUDE.md or memory rides along. That is practical now - about 70 seconds for a request of 25 inputs.

`tag_events.py`, the 2026 tagger, is retired: it wrote `tags: {fandoms, kind, topics, adult, guests}` into `events.json` and now refuses to. The live site on `main` still reads those v1 tags, whose fandom names `CANON` in that script normalised, so its picker shows one "Marvel" rather than Marvel, MCU and Avengers. The client on `next` reads `events.v2.json` instead (DECISIONS #39), where a fandom is a registry work, by id.

## Duplicates

The same event is often listed twice — once in the panel feed and once in gaming, or cross-listed under two tracks — and the copies disagree, one carrying the speakers and the other not. In 2026 `scraper.py` grouped by normalised title, start and room and merged each group: smallest id survives (so existing picks keep pointing at something), speakers and tracks union, panel beats gaming, longest description wins, tags follow whichever copy had them. That was 146 groups and 192 rows on a typical scrape. The fetch no longer merges: `source.json` keeps every listing, and the 2027 pipeline's ids stage and merge take the groups over (DECISIONS #43, #44).

## Walk times

Estimates in minutes, before the crowd factor, in the `WALK` table in `src/venues.js`, and again as `walk` in `data/2027/venues.json`, which a test holds equal to it until the client reads the file. Edit both if you know better — especially Westin and Courtland Grand, the far ends.

## If the scraper breaks

Hosted by Core-apps at `https://app.core-apps.com/dragoncon26`. Day pages are `events/view_by_day?day=Sep++5` (two spaces) with `&type=Entertainment` for gaming. Each event page is `event/<id>` with a Location/Date/Duration table, a description, an optional Speakers list, and a Tracks section. `tests/test_parse.py` shows the exact markup the parser expects.

**The host signals rate limiting with `403`, not `429`.** That has to stay in the retry `status_forcelist` in `make_session()`; without it the first throttle turns every remaining fetch into an instant failure — it once cost 3,285 of 3,577 events.

## The refresh workflow

It fails at its Scrape step now: the scraper is the fetch stage, which takes `--season` and needs ftfy, and the workflow gives it neither. The 2027 workflow replaces it (DECISIONS #48). What follows is how it ran in 2026.

Runs by hand only (Actions → Refresh schedule → Run workflow); the 3-hourly cron that ran it through con week was removed once the schedule was final, and a run now would overwrite `data/2026/events.json` with whatever the host serves. Before committing it refuses a scrape that returned nothing or fell more than 20% — a throttled run can't overwrite good data. If `main` moved while it was scraping it rebases and retries rather than dropping the refresh. Two refreshes never run at once: a second run waits for the first, because both would rewrite the schedule and the rebase can't resolve that.

For next year: put the `schedule:` trigger and its con-week date guard back, point the scraper, the tagger, the worker (`DATA` and `SHELL` in `public/sw.js`), the build's allowlist (`DATA_FILES` in `build/vite-dc.js`) and `CON` (`src/time.js`; `DATA_URL` in `src/data.js` follows its year) at `data/2027/`, and the 2026 file stays where it is.
