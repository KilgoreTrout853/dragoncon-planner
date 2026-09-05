# Dragon Con 2026 planner

A phone-first schedule planner built on the data behind the official Dragon Con app. Search everything at once, star what you want, follow the tracks and guests you care about, and get walk-time warnings between hotels. Works with no signal.

**Live:** https://kilgoretrout853.github.io/dragoncon-planner/

## What's in here

| File | What it does |
|---|---|
| `scraper.py` | Pulls every event (panels + gaming) from the web version of the official app, merges duplicates, and writes `events.json`. Takes ~20 minutes. |
| `tag_events.py` | Has Claude tag each event with fandoms, kind (celebrity Q&A, fan panel, screening…), topics, guests, and 18+. Powers the fandom picker, kind chips, the Celebrity badge and Guests section, and search. |
| `index.html` | The whole planner, one file. Reads `events.json` from the same folder. |
| `sw.js` | Service worker: keeps the app opening and rendering with no signal. |
| `manifest.json`, `icon.svg`, `icon-*.png`, `og-image.png` | Make it installable to a home screen as "DC26", with a proper icon on iOS and a preview card in chats. |
| `make_icons.py` | Renders the PNG icons and the preview image from the design in `icon.svg`. Needs Pillow; fetches the font once. |
| `.github/workflows/scrape.yml` | Re-runs the scraper every 3 hours during con week and commits fresh data. |
| `tests/` | 25 parser tests and 739 UI assertions. Not optional — run them before you push. |

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
node tests/ui_smoke.js           # 739 assertions
python tests/test_parse.py       # 25 parser tests
```

The UI suite runs twice: once against `tests/sample-events.json` (558 synthetic events, deterministic) and once against the real `events.json`, because ranking questions are meaningless against synthetic rows.

## Using it

Five tabs.

- **Now** opens with a hero card for the one thing you have to act on: a countdown ring and, while a pick is on, when to leave that building for the next one. It turns amber once you're late. The app never guesses where you are: the only location it will claim is the hotel of a pick that is on right now. With nothing on, the ring counts down to the start and the walk from your previous pick is offered as an estimate ("~12 min from the Westin"), not an instruction. Below it, the rest of your day and everything on now or starting within the hour.
- **Search** understands what you type. `star trek saturday hilton` searches "star trek" across Saturday's Hilton events and shows you which words it took as filters, each removable. `late night`, `signing sunday`, `tonight` and `kids` all work; a query that's entirely filters scopes to today unless you say otherwise. Typing two letters suggests guests and fandoms by name. Events that already happened sit behind a fold. When nothing matched a word literally, it says so rather than pretending.
- **Explore** lists everything you could follow as tiles with counts, in five sections: Tracks A to Z, Fandoms with 3+ events, Topics, Guests, and Panelists with 5+ events. Each section opens with a dozen tiles and a Show all; the chips under the filter box jump between sections, and the chip for the section on screen shows as pressed. Tap a tile for its own page and a Follow button. Once you have starred something, a "Because you starred" strip above the filter offers the tracks, fandoms and guests behind your picks that you don't follow yet. Each page is linkable as `#explore=kind:key`. Once you follow something, a **Following** section sits above the grid with what you follow, grouped by interest or merged into one timeline; an event reached by two follows appears once, labelled with both. It folds away behind its header, and stays folded if you leave it that way.
- **Map** is a schematic of the con hotels, transit-map style, drawn from the venues' real positions at one scale so the distances mean something: Peachtree St up the left, the Hyatt and the Marriott nearly touching east of it with the Hilton a real walk further on (that long skybridge crosses Courtland St, as it does in life), the Mart and the Westin west of Peachtree with their own skybridge, the Courtland under the Hilton, and Hardy Ivy Park above the Hyatt. Hotel level only; streams and offsite venues are not on it. A row of day chips above it picks the con day, starting on today with the same 5 AM boundary as the rest of the app. Each hotel wears a gold pill with the number of your picks there that day. Tap a hotel (or its pill) for those picks as ordinary rows, star and detail sheet included; a hotel with none offers a button that searches it on that day. When the chosen day is today, a solid gold ring marks the hotel of the pick that is on now, a pulsing one the hotel of the next pick,. A caption under the map says where and when, with the same leave-by the Now tab shows, or what is next when the next pick is streaming or offsite; picks at venues the map does not draw are counted under it.
- **Mine** shows your picks as a timeline by default — blocks sized by duration, clashes side by side, walk connectors between hotels, a now-line. Or as a list. "Export to calendar" downloads an `.ics` with the correct Eastern time zone.

A con day runs to 5 AM, everywhere in the app: a 1 AM panel sits under the day before on the day chips, in day headers, in Mine and on the Now tab. The detail sheet and the calendar export keep the real date and say which night it belongs to.

Tap any row for the detail sheet: description, panelists with a "See all" link to each person, exact room, star, and a single-event calendar export. Swipe it down to dismiss.

**Settings** (gear): crowd factor for walk estimates, the default noise filter and a Larger text switch up top. Under **Advanced**: preview any time (`#now=2026-09-05T14:00` in the URL does the same), the walk-time table, and a device readout that ends with the build time. Remove all picks is last, on its own.

Picks and follows live in the browser's storage, per device. They aren't shared between phones and there's no URL format for them yet.

## Offline

The service worker caches the app and the schedule, so it opens and renders in a building with no signal — which is the normal state of the Marriott lobby.

- `index.html` is network-first with a 3-second timeout, so fixes land when there's signal and a saturated tower can't stop the app opening. A copy that arrives after the limit is stored for the next launch, so a slow tower delays a fix by one open rather than for ever.
- `events.json` is served from cache immediately and refreshed behind you. When it changes you get a "Schedule updated · tap to refresh" pill rather than the list moving under your thumb. Coming back to the app after 15 minutes or more away checks again, the same quiet way.
- When the cached copy is what you're seeing, the line under the clock says `· offline copy`.

To install: iPhone must use **Safari** (Share → Add to Home Screen); Android uses Chrome (⋮ → Install app). Until it is installed, the Now tab opens with a nudge saying so, which can be put off for a week at a time. You get a **DC26** icon that opens without browser chrome. The content area scrolls inside its own container rather than the page, so the header and the nav stay put on an iPhone instead of riding the system's bottom inset. The status bar is opaque on purpose: on iOS 26 a translucent one leaves the web view short by its own height, with a dead strip at the bottom of the screen. iOS reads these web-app settings once, when the icon is added, so a change to them only reaches a phone after the icon is deleted and added again from Safari. The device line under Advanced in Settings ends with the build time, so you can tell which version a phone is running.

Bump `CACHE` in `sw.js` when you change `index.html` in a way that must reach people immediately; older `dc26-*` caches are dropped on activate.

## Tagging

`tag_events.py` sends events to Claude in batches of 40 and writes back `tags: {fandoms, kind, topics, adult, guests}`. It only sends untagged events, so after a refresh you re-run it for the new ones; `--all` retags everything.

**Use the API key path.** With `ANTHROPIC_API_KEY` set it makes one HTTPS request per batch and tags ~3,500 events in about seven minutes for well under a dollar. The `claude -p` fallback spawns a full CLI process per batch and is not practical at this scale — it managed 160 events in two hours before being stopped.

```bash
ANTHROPIC_API_KEY=$(cat anthropic_key.txt) python tag_events.py
```

`anthropic_key.txt` is gitignored. Delete it and revoke the key when you're done with the con.

The scraper carries tags forward across refreshes by event id — including through duplicate merging, where the surviving id may not be the one that was tagged. The GitHub Action has no Claude access, so events added during the con arrive untagged until you re-run the tagger. Search still finds them by their words; the fandom and kind filters won't, and they carry no Celebrity badge.

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
