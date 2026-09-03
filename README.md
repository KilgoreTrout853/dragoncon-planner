# Dragon Con 2026 planner

A phone-first schedule planner built on the data behind the official Dragon Con app. Search everything at once, star what you want, follow the tracks and guests you care about, and get walk-time warnings between hotels. Works with no signal.

**Live:** https://kilgoretrout853.github.io/dragoncon-planner/

## What's in here

| File | What it does |
|---|---|
| `scraper.py` | Pulls every event (panels + gaming) from the web version of the official app, merges duplicates, and writes `events.json`. Takes ~20 minutes. |
| `tag_events.py` | Has Claude tag each event with fandoms, kind (celebrity Q&A, fan panel, screening…), topics, guests, and 18+. Powers the fandom picker, kind chips, Celebrity filter, and search. |
| `index.html` | The whole planner, one file. Reads `events.json` from the same folder. |
| `sw.js` | Service worker: keeps the app opening and rendering with no signal. |
| `manifest.json`, `icon.svg` | Make it installable to a home screen as "DC26". |
| `.github/workflows/scrape.yml` | Re-runs the scraper every 3 hours during con week and commits fresh data. |
| `tests/` | 19 parser tests and 460 UI assertions. Not optional — run them before you push. |

## Running it locally

```bash
pip install requests beautifulsoup4
python scraper.py --limit 30     # smoke test against the live site, ~30 seconds
python scraper.py                # full scrape, ~3,460 events after merging duplicates
python -m http.server 8000       # then open http://localhost:8000
```

`index.html` must be served over http — opened as a file, the browser blocks it from reading `events.json`.

**Tests need Node** (for jsdom) as well as Python:

```bash
npm install                      # jsdom, a dev dependency; no build step
node tests/ui_smoke.js           # 460 assertions
python tests/test_parse.py       # 19 parser tests
```

The UI suite runs twice: once against `tests/sample-events.json` (558 synthetic events, deterministic) and once against the real `events.json`, because ranking questions are meaningless against synthetic rows.

## Using it

Four tabs.

- **Now** opens with a hero card for the one thing you have to act on: a countdown ring, when to leave, and a walk time to wherever you're going next. It turns amber once you're late. Below it, the rest of your day and everything on now or starting within the hour.
- **Search** understands what you type. `star trek saturday hilton` searches "star trek" across Saturday's Hilton events and shows you which words it took as filters, each removable. `late night`, `signing sunday`, `tonight` and `kids` all work; a query that's entirely filters scopes to today unless you say otherwise. Typing two letters suggests guests and fandoms by name. Events that already happened sit behind a fold. When nothing matched a word literally, it says so rather than pretending.
- **Explore** lists everything you could follow — every track, fandoms with 3+ events, topics, and guests — as tiles with counts. Tap one for its own page and a Follow button. Each page is linkable as `#explore=kind:key`. Once you follow something, a **Following** section sits above the grid with what you follow, grouped by interest or merged into one timeline; an event reached by two follows appears once, labelled with both. It folds away behind its header, and stays folded if you leave it that way.
- **Mine** shows your picks as a timeline by default — blocks sized by duration, clashes side by side, walk connectors between hotels, a now-line. Or as a list. "Export to calendar" downloads an `.ics` with the correct Eastern time zone.

Tap any row for the detail sheet: description, panelists with a "See all" link to each person, exact room, star, and a single-event calendar export. Swipe it down to dismiss.

**Settings** (gear): crowd factor for walk estimates, the default noise filter, preview any time (`#now=2026-09-05T14:00` in the URL does the same), and the walk-time table.

Picks and follows live in the browser's storage, per device. They aren't shared between phones and there's no URL format for them yet.

## Offline

The service worker caches the app and the schedule, so it opens and renders in a building with no signal — which is the normal state of the Marriott lobby.

- `index.html` is network-first with a 3-second timeout, so fixes land when there's signal and a saturated tower can't stop the app opening.
- `events.json` is served from cache immediately and refreshed behind you. When it changes you get a "Schedule updated · tap to refresh" pill rather than the list moving under your thumb.
- When the cached copy is what you're seeing, the line under the clock says `· offline copy`.

To install: iPhone must use **Safari** (Share → Add to Home Screen); Android uses Chrome (⋮ → Install app). You get a **DC26** icon that opens without browser chrome.

Bump `CACHE` in `sw.js` when you change `index.html` in a way that must reach people immediately; older `dc26-*` caches are dropped on activate.

## Tagging

`tag_events.py` sends events to Claude in batches of 40 and writes back `tags: {fandoms, kind, topics, adult, guests}`. It only sends untagged events, so after a refresh you re-run it for the new ones; `--all` retags everything.

**Use the API key path.** With `ANTHROPIC_API_KEY` set it makes one HTTPS request per batch and tags ~3,500 events in about seven minutes for well under a dollar. The `claude -p` fallback spawns a full CLI process per batch and is not practical at this scale — it managed 160 events in two hours before being stopped.

```bash
ANTHROPIC_API_KEY=$(cat anthropic_key.txt) python tag_events.py
```

`anthropic_key.txt` is gitignored. Delete it and revoke the key when you're done with the con.

The scraper carries tags forward across refreshes by event id — including through duplicate merging, where the surviving id may not be the one that was tagged. The GitHub Action has no Claude access, so events added during the con arrive untagged until you re-run the tagger. Search still finds them by their words; the fandom, kind and Celebrity filters won't.

Fandom names are normalised (`CANON` in the script) so the picker shows one "Marvel" rather than Marvel, MCU and Avengers.

## Duplicates

The same event is often listed twice — once in the panel feed and once in gaming, or cross-listed under two tracks — and the copies disagree, one carrying the speakers and the other not. `scraper.py` groups by normalised title, start and room and merges each group: smallest id survives (so existing picks keep pointing at something), speakers and tracks union, panel beats gaming, longest description wins, tags follow whichever copy had them. That's 146 groups and 192 rows on a typical scrape.

## Walk times

Estimates in minutes, before the crowd factor, in the `WALK` table near the top of `index.html`. Edit them if you know better — especially Westin and Courtland Grand, the far ends.

## If the scraper breaks

Hosted by Core-apps at `https://app.core-apps.com/dragoncon26`. Day pages are `events/view_by_day?day=Sep++5` (two spaces) with `&type=Entertainment` for gaming. Each event page is `event/<id>` with a Location/Date/Duration table, a description, an optional Speakers list, and a Tracks section. `tests/test_parse.py` shows the exact markup the parser expects.

**The host signals rate limiting with `403`, not `429`.** That has to stay in the retry `status_forcelist` in `make_session()`; without it the first throttle turns every remaining fetch into an instant failure — it once cost 3,285 of 3,577 events.

## The refresh workflow

Runs every 3 hours through Sep 8, then stops itself via a date guard. Before committing it refuses a scrape that returned nothing or fell more than 20% — a throttled run can't overwrite good data. If `main` moved while it was scraping it rebases and retries rather than dropping the refresh. Two refreshes never run at once: a run started by hand that overlaps the cron waits for it, because both would rewrite `events.json` and the rebase can't resolve that.

After the con, disable it (Actions → Refresh schedule → ⋯ → Disable) or leave it; it stops on its own.
