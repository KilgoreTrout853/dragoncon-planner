# Dragon Con 2026 planner

A phone-first schedule planner built on the data behind the official Dragon Con app. Search everything at once, star what you want, and get walk-time warnings between hotels.

## What's in here

| File | What it does |
|---|---|
| `scraper.py` | Pulls every event (panels + gaming) from the web version of the official app and writes `events.json`. Takes a few minutes. |
| `tag_events.py` | Has Claude tag each event with fandoms, kind (celebrity Q&A, fan panel, screening…), topics, and 18+. Powers the fandom picker, kind chips, and search. |
| `index.html` | The planner. Reads `events.json` from the same folder. Nothing else needed. |
| `.github/workflows/scrape.yml` | Re-runs the scraper every 3 hours during con week and commits fresh data. |
| `tests/` | Parser tests and a headless UI test. Optional. |

## Quick start (local, no GitHub)

```bash
pip install requests beautifulsoup4
python scraper.py --limit 30     # smoke test, ~10 seconds
python scraper.py                # full scrape, ~3,600 events
python tag_events.py --limit 80  # smoke test the tagger (uses `claude -p`, or ANTHROPIC_API_KEY if set)
python tag_events.py             # tag everything, 15-30 minutes, saves as it goes
python -m http.server 8000       # then open http://localhost:8000
```

`index.html` has to be served over http (not opened as a file) or the browser blocks it from reading `events.json`.

## Recommended: GitHub Pages with auto-refresh

Open Claude Code in this folder and paste the prompt below. It will do the git and GitHub work for you; you only need to answer the `gh auth login` prompt in your browser if you're not already logged in.

> I have a small project in this folder: `scraper.py`, `index.html`, `tests/`, and `.github/workflows/scrape.yml`. Please set it up on GitHub Pages:
>
> 1. `pip install requests beautifulsoup4`, then run `python scraper.py --limit 30` and show me the first event from `events.json` so we can confirm the parser works against the live site. If it fails, read `scraper.py` (the selectors are documented in the parse functions) and fix it.
> 2. Run the full `python scraper.py` and tell me how many events it found and how long it took.
> 3. Run `python tag_events.py --limit 80` and show me the tags on three of the events. If that worked, run `python tag_events.py` for the full set (it calls `claude -p` in batches, saves progress as it goes, and takes 15-30 minutes; if it complains about running inside Claude Code, tell me and I'll run it in a separate terminal instead). Report the top fandoms it found.
> 4. `git init`, commit everything including `events.json`, and create a **public** GitHub repo called `dragoncon-planner` with `gh repo create`, pushing `main`. Check `gh auth status` first and walk me through `gh auth login` if needed.
> 5. Enable GitHub Pages from the `main` branch, root folder (`gh api` or tell me the exact clicks in Settings > Pages).
> 6. Trigger the "Refresh schedule" workflow once with `gh workflow run` and confirm it succeeds.
> 7. Give me the Pages URL, and confirm the page loads with events.

Then open the URL on your phone and add it to your home screen. Your picks are saved on the phone.

After the con, disable the workflow (Actions tab > Refresh schedule > "..." > Disable) or just leave it; it stops itself after Sep 8.

## Using it

- **Now** is the default tab. It shows your upcoming picks with countdowns and walk warnings, then everything on now or starting within the hour. Filter by hotel with the chips.
- **Browse** search is ranked: title and guest hits outrank a mention buried in a description, prefixes and typos work ("philhar", "philharmonc"), matched words are highlighted, and typing a query widens to all days automatically. A synonym table near the top of `index.html` maps con vocabulary ("symphony" finds the Philharmonic, "Marvel" finds MCU panels, "space" finds NASA and astronomy); add your own lines. Stack filters on top: day, hotel, panels vs gaming, track, and once events are tagged, fandom, kind (celebrity Q&A, fan panel, screening, workshop, contest, performance, party…), and hide 18+. Photo sessions and video-room screenings are hidden by default (there are hundreds); the toggle shows them.
- **Mine** lists picks by day and flags overlaps and tight transfers. "Export to calendar" downloads an .ics with the correct Eastern time zone; open it on your phone to add everything to Google or Apple Calendar.
- Tap any row to expand it: description, panelists, exact room, and the add/remove button.
- **Settings** (gear): crowd factor for walk estimates, default noise filter, preview any time (`#now=2026-09-05T14:00` in the URL does the same), and the walk-time table.

## Tagging

`tag_events.py` sends events to Claude in batches of 40 and writes back `tags: {fandoms, kind, topics, adult, guests}` on each event. It only sends untagged events, so after a refresh you re-run it for the new ones; `--all` retags everything. The scraper carries tags forward across refreshes, and the GitHub Action doesn't tag (it has no Claude access), so new events added during the con show up untagged until you run the tagger again locally. Search still finds them by their words.

Fandom names are normalized (`CANON` in the script) so the picker shows one "Marvel" rather than Marvel, MCU, and Avengers. If you see duplicates, add a line there and re-run with `--all`.

## Walk times

The defaults are estimates in minutes, before the crowd factor. They live in the `WALK` table near the top of `index.html`. Edit them if you know better, especially Westin and Courtland Grand, which are the far ends.

## If the scraper breaks

The app is hosted by Core-apps at `https://app.core-apps.com/dragoncon26`. Day pages are `events/view_by_day?day=Sep++5` (two spaces) with `&type=Entertainment` for gaming. Each event page is `event/<id>` with a Location/Date/Duration table, a description, an optional Speakers list, and a Tracks section. Tests in `tests/test_parse.py` show the exact markup the parser expects.
