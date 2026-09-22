# Schedule history - the 2026 schedule on `main`

Written by `tools/schedule_history.py` from `main` at `e578dd4`: every commit whose first-parent line touched the 2026 schedule, followed back to `events.json` at the repo root, where the file lived until the archive merge. Do not edit it by hand; run the script again.

A record, not held fresh by CI: a shallow checkout has no history, and the history will not change. It states facts; `UNSURE` marks a match that needs a person's judgment, and the one fix it proposes (section 6) is applied to nothing. Events are matched by id, and by content through `scraper.dupe_key` - the normalised title, the start and the normalised room, the rule dedupe uses. Times are UTC. New York is UTC-4 throughout: every time converted here falls inside 2026's daylight-saving window, and the script refuses one that does not. Lists longer than 12 show their first 10.

## 0. Headline

1. Commits: 34 touched the schedule: 29 scrape, 2 tag, 3 other; 33 consecutive pairs.
2. Events: 3,574 in the first version, 3,459 in the last; 3,672 ids were ever seen.
3. `changed_at` equals `generated_at` in 34 of 34 versions.
4. Every scrape after the dedupe reorders `tracks` on 5-16 events, and 5 scrapes changed nothing but the order of `tracks` and `speakers` (section 6).
5. Scrape pairs with a `scraper.py` change between them: 2 (v9, v12); `52692ff` and `290464f` each changed `scraper.py` and the schedule in one commit.
6. Removed ids: 216 - under an id added in the same pair 0, still under an id both versions hold 192, gone 24. Same-title matches (UNSURE): 0.
7. Ids that leave and later return: 3. Content that returns under another id: 2.
8. `cancelled` transitions: 5 - false to true 2, true to false 3.
9. scrape.yml ran 32 times: 29 succeeded, 3 failed; successful runs that committed nothing: 0 (section 8).
10. Con days (2026-09-02 to 2026-09-07): 27 of 29 scrape pairs landed on them, with 471 of the 607 ids those pairs added, removed or changed - an id counted once a pair (section 7).

## 1. Commits

A commit's time is its author date: when it was made, which for a scrape is the end of the run. Classes, by author and message: `scrape` is schedule-bot's "Refresh schedule", `tag` a hand commit of `tag_events.py`'s output ("Tag the N events ..."), `other` the rest.

| # | commit | class | UTC | New York | author | subject |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `aec5f18` | other | 2026-09-01 20:56:09 | 2026-09-01 16:56 | KilgoreTrout853 | Dragon Con 2026 planner: schedule data, tagging, and refresh hardening |
| 2 | `21105aa` | scrape | 2026-09-01 21:33:33 | 2026-09-01 17:33 | schedule-bot | Refresh schedule 2026-09-01T21:33Z |
| 3 | `9f1415e` | scrape | 2026-09-01 23:40:00 | 2026-09-01 19:40 | schedule-bot | Refresh schedule 2026-09-01T23:40Z |
| 4 | `3150aa8` | tag | 2026-09-02 04:18:50 | 2026-09-02 00:18 | KilgoreTrout853 | Tag the 86 events added since the last pass |
| 5 | `52692ff` | other | 2026-09-02 11:30:23 | 2026-09-02 07:30 | KilgoreTrout853 | Merge dedupe: collapse duplicate events in the scraper |
| 6 | `787744d` | scrape | 2026-09-02 16:56:42 | 2026-09-02 12:56 | schedule-bot | Refresh schedule 2026-09-02T16:56Z |
| 7 | `8750dd8` | scrape | 2026-09-02 21:16:20 | 2026-09-02 17:16 | schedule-bot | Refresh schedule 2026-09-02T21:16Z |
| 8 | `49ae9dc` | scrape | 2026-09-02 23:40:39 | 2026-09-02 19:40 | schedule-bot | Refresh schedule 2026-09-02T23:40Z |
| 9 | `702a766` | scrape | 2026-09-03 04:00:02 | 2026-09-03 00:00 | schedule-bot | Refresh schedule 2026-09-03T04:00Z |
| 10 | `af7dbda` | scrape | 2026-09-03 04:53:56 | 2026-09-03 00:53 | schedule-bot | Refresh schedule 2026-09-03T04:53Z |
| 11 | `f7e3c97` | tag | 2026-09-03 05:32:23 | 2026-09-03 01:32 | KilgoreTrout853 | Tag the 5 events added since the last tagging pass |
| 12 | `8ffbae3` | scrape | 2026-09-03 11:33:12 | 2026-09-03 07:33 | schedule-bot | Refresh schedule 2026-09-03T11:33Z |
| 13 | `2e6ae84` | scrape | 2026-09-03 16:46:50 | 2026-09-03 12:46 | schedule-bot | Refresh schedule 2026-09-03T16:46Z |
| 14 | `ca9a98b` | scrape | 2026-09-03 21:24:59 | 2026-09-03 17:24 | schedule-bot | Refresh schedule 2026-09-03T21:24Z |
| 15 | `aed3530` | scrape | 2026-09-03 23:39:22 | 2026-09-03 19:39 | schedule-bot | Refresh schedule 2026-09-03T23:39Z |
| 16 | `1b6dcf5` | scrape | 2026-09-04 04:53:44 | 2026-09-04 00:53 | schedule-bot | Refresh schedule 2026-09-04T04:53Z |
| 17 | `b457a33` | scrape | 2026-09-04 11:37:15 | 2026-09-04 07:37 | schedule-bot | Refresh schedule 2026-09-04T11:37Z |
| 18 | `53f5f6d` | scrape | 2026-09-04 16:42:19 | 2026-09-04 12:42 | schedule-bot | Refresh schedule 2026-09-04T16:42Z |
| 19 | `6b2cf0a` | scrape | 2026-09-04 21:08:18 | 2026-09-04 17:08 | schedule-bot | Refresh schedule 2026-09-04T21:08Z |
| 20 | `6b923bb` | scrape | 2026-09-04 23:24:30 | 2026-09-04 19:24 | schedule-bot | Refresh schedule 2026-09-04T23:24Z |
| 21 | `c6138ce` | scrape | 2026-09-05 04:46:57 | 2026-09-05 00:46 | schedule-bot | Refresh schedule 2026-09-05T04:46Z |
| 22 | `b1b9452` | scrape | 2026-09-05 10:53:58 | 2026-09-05 06:53 | schedule-bot | Refresh schedule 2026-09-05T10:53Z |
| 23 | `a5bcf86` | scrape | 2026-09-05 15:33:39 | 2026-09-05 11:33 | schedule-bot | Refresh schedule 2026-09-05T15:33Z |
| 24 | `592e6cc` | scrape | 2026-09-05 17:42:25 | 2026-09-05 13:42 | schedule-bot | Refresh schedule 2026-09-05T17:42Z |
| 25 | `7ee4cdc` | scrape | 2026-09-05 20:40:15 | 2026-09-05 16:40 | schedule-bot | Refresh schedule 2026-09-05T20:40Z |
| 26 | `0114506` | scrape | 2026-09-05 23:14:39 | 2026-09-05 19:14 | schedule-bot | Refresh schedule 2026-09-05T23:14Z |
| 27 | `9839810` | scrape | 2026-09-06 04:58:38 | 2026-09-06 00:58 | schedule-bot | Refresh schedule 2026-09-06T04:58Z |
| 28 | `165aca7` | scrape | 2026-09-06 11:14:39 | 2026-09-06 07:14 | schedule-bot | Refresh schedule 2026-09-06T11:14Z |
| 29 | `fc0b2d1` | scrape | 2026-09-06 15:48:29 | 2026-09-06 11:48 | schedule-bot | Refresh schedule 2026-09-06T15:48Z |
| 30 | `e35ec51` | scrape | 2026-09-06 20:44:57 | 2026-09-06 16:44 | schedule-bot | Refresh schedule 2026-09-06T20:44Z |
| 31 | `3891855` | scrape | 2026-09-06 23:14:16 | 2026-09-06 19:14 | schedule-bot | Refresh schedule 2026-09-06T23:14Z |
| 32 | `f61e296` | scrape | 2026-09-07 05:01:46 | 2026-09-07 01:01 | schedule-bot | Refresh schedule 2026-09-07T05:01Z |
| 33 | `5dff70d` | scrape | 2026-09-07 12:50:19 | 2026-09-07 08:50 | schedule-bot | Refresh schedule 2026-09-07T12:50Z |
| 34 | `290464f` | other | 2026-09-07 17:25:27 | 2026-09-07 13:25 | KilgoreTrout853 | Merge archive-2026: the 2026 schedule frozen under data/2026, one clock, archive mode after the con |

- `290464f` moved the file to `data/2026/events.json` (R100: the same bytes).
- Committed after they were authored, as a rebase leaves them: 4 (`8750dd8`, `702a766`, `af7dbda`, `fc0b2d1`), by 1-3 s.

## 2. Versions

| v | commit | class | generated_at | changed_at | events | count | failures | final ids present |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | `aec5f18` | other | 2026-09-01T18:29:46+00:00 | 2026-09-01T18:29:46+00:00 | 3,574 | 3,574 | 3 | 3,407 (98.5%) |
| 2 | `21105aa` | scrape | 2026-09-01T21:33:33+00:00 | 2026-09-01T21:33:33+00:00 | 3,652 | 3,652 | 0 | 3,444 (99.6%) |
| 3 | `9f1415e` | scrape | 2026-09-01T23:40:00+00:00 | 2026-09-01T23:40:00+00:00 | 3,654 | 3,654 | 0 | 3,446 (99.6%) |
| 4 | `3150aa8` | tag | 2026-09-01T23:40:00+00:00 | 2026-09-01T23:40:00+00:00 | 3,654 | 3,654 | 0 | 3,446 (99.6%) |
| 5 | `52692ff` | other | 2026-09-02T11:28:08+00:00 | 2026-09-02T11:28:08+00:00 | 3,462 | 3,462 | 0 | 3,446 (99.6%) |
| 6 | `787744d` | scrape | 2026-09-02T16:56:41+00:00 | 2026-09-02T16:56:41+00:00 | 3,459 | 3,459 | 0 | 3,446 (99.6%) |
| 7 | `8750dd8` | scrape | 2026-09-02T21:16:20+00:00 | 2026-09-02T21:16:20+00:00 | 3,459 | 3,459 | 0 | 3,448 (99.7%) |
| 8 | `49ae9dc` | scrape | 2026-09-02T23:40:39+00:00 | 2026-09-02T23:40:39+00:00 | 3,457 | 3,457 | 0 | 3,448 (99.7%) |
| 9 | `702a766` | scrape | 2026-09-03T04:00:01+00:00 | 2026-09-03T04:00:01+00:00 | 3,460 | 3,460 | 0 | 3,451 (99.8%) |
| 10 | `af7dbda` | scrape | 2026-09-03T04:53:56+00:00 | 2026-09-03T04:53:56+00:00 | 3,457 | 3,457 | 0 | 3,451 (99.8%) |
| 11 | `f7e3c97` | tag | 2026-09-03T04:53:56+00:00 | 2026-09-03T04:53:56+00:00 | 3,457 | 3,457 | 0 | 3,451 (99.8%) |
| 12 | `8ffbae3` | scrape | 2026-09-03T11:33:11+00:00 | 2026-09-03T11:33:11+00:00 | 3,458 | 3,458 | 0 | 3,452 (99.8%) |
| 13 | `2e6ae84` | scrape | 2026-09-03T16:46:50+00:00 | 2026-09-03T16:46:50+00:00 | 3,458 | 3,458 | 0 | 3,452 (99.8%) |
| 14 | `ca9a98b` | scrape | 2026-09-03T21:24:59+00:00 | 2026-09-03T21:24:59+00:00 | 3,457 | 3,457 | 1 | 3,451 (99.8%) |
| 15 | `aed3530` | scrape | 2026-09-03T23:39:21+00:00 | 2026-09-03T23:39:21+00:00 | 3,458 | 3,458 | 0 | 3,452 (99.8%) |
| 16 | `1b6dcf5` | scrape | 2026-09-04T04:53:43+00:00 | 2026-09-04T04:53:43+00:00 | 3,456 | 3,456 | 0 | 3,453 (99.8%) |
| 17 | `b457a33` | scrape | 2026-09-04T11:37:14+00:00 | 2026-09-04T11:37:14+00:00 | 3,458 | 3,458 | 0 | 3,455 (99.9%) |
| 18 | `53f5f6d` | scrape | 2026-09-04T16:42:19+00:00 | 2026-09-04T16:42:19+00:00 | 3,458 | 3,458 | 0 | 3,455 (99.9%) |
| 19 | `6b2cf0a` | scrape | 2026-09-04T21:08:18+00:00 | 2026-09-04T21:08:18+00:00 | 3,461 | 3,461 | 0 | 3,458 (100.0%) |
| 20 | `6b923bb` | scrape | 2026-09-04T23:24:29+00:00 | 2026-09-04T23:24:29+00:00 | 3,461 | 3,461 | 0 | 3,458 (100.0%) |
| 21 | `c6138ce` | scrape | 2026-09-05T04:46:57+00:00 | 2026-09-05T04:46:57+00:00 | 3,461 | 3,461 | 0 | 3,458 (100.0%) |
| 22 | `b1b9452` | scrape | 2026-09-05T10:53:57+00:00 | 2026-09-05T10:53:57+00:00 | 3,461 | 3,461 | 0 | 3,458 (100.0%) |
| 23 | `a5bcf86` | scrape | 2026-09-05T15:33:39+00:00 | 2026-09-05T15:33:39+00:00 | 3,461 | 3,461 | 0 | 3,458 (100.0%) |
| 24 | `592e6cc` | scrape | 2026-09-05T17:42:25+00:00 | 2026-09-05T17:42:25+00:00 | 3,460 | 3,460 | 0 | 3,458 (100.0%) |
| 25 | `7ee4cdc` | scrape | 2026-09-05T20:40:14+00:00 | 2026-09-05T20:40:14+00:00 | 3,461 | 3,461 | 0 | 3,459 (100.0%) |
| 26 | `0114506` | scrape | 2026-09-05T23:14:39+00:00 | 2026-09-05T23:14:39+00:00 | 3,461 | 3,461 | 0 | 3,459 (100.0%) |
| 27 | `9839810` | scrape | 2026-09-06T04:58:37+00:00 | 2026-09-06T04:58:37+00:00 | 3,461 | 3,461 | 0 | 3,459 (100.0%) |
| 28 | `165aca7` | scrape | 2026-09-06T11:14:38+00:00 | 2026-09-06T11:14:38+00:00 | 3,461 | 3,461 | 0 | 3,459 (100.0%) |
| 29 | `fc0b2d1` | scrape | 2026-09-06T15:48:29+00:00 | 2026-09-06T15:48:29+00:00 | 3,461 | 3,461 | 0 | 3,459 (100.0%) |
| 30 | `e35ec51` | scrape | 2026-09-06T20:44:56+00:00 | 2026-09-06T20:44:56+00:00 | 3,461 | 3,461 | 0 | 3,459 (100.0%) |
| 31 | `3891855` | scrape | 2026-09-06T23:14:15+00:00 | 2026-09-06T23:14:15+00:00 | 3,459 | 3,459 | 0 | 3,459 (100.0%) |
| 32 | `f61e296` | scrape | 2026-09-07T05:01:46+00:00 | 2026-09-07T05:01:46+00:00 | 3,459 | 3,459 | 0 | 3,459 (100.0%) |
| 33 | `5dff70d` | scrape | 2026-09-07T12:50:19+00:00 | 2026-09-07T12:50:19+00:00 | 3,459 | 3,459 | 0 | 3,459 (100.0%) |
| 34 | `290464f` | other | 2026-09-07T12:50:19+00:00 | 2026-09-07T12:50:19+00:00 | 3,459 | 3,459 | 0 | 3,459 (100.0%) |

- `count` equals the number of events in 34 of 34 versions; `changed_at` equals `generated_at` in 34.
- Ids ever seen: 3,672; in the last version: 3,459.
- The last version's blob, `89e21af`, is the frozen `data/2026/events.json` at `HEAD`.

### Failures

`failures` in the file is a count. The scraper prints the first failure's error at the end of its run, so a run's log is the only place a failure is named.

- v1 `aec5f18`: `failures` 3. No scrape.yml run made this version: its failures are not named anywhere.
- v14 `ca9a98b`: `failures` 1. Run #13's log: `WARNING: 1 detail pages failed, e.g. 404 Client Error: Not Found for url: https://app.core-apps.com/dragoncon26/event/1e3995157984a4c0e6515a2ed632d105`. It names `1e3995157984a4c0e6515a2ed632d105`, an id this version lacks and the one before held.

## 3. Pairs

Each version against the one before it. `common` is the ids both hold; `changed`, those of them on which one of the ten fields below changed, other than by order alone.

| pair | to | class | before | after | added | removed | common | changed | order only |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v1 → v2 | `21105aa` | scrape | 3,574 | 3,652 | 84 | 6 | 3,568 | 43 | 0 |
| v2 → v3 | `9f1415e` | scrape | 3,652 | 3,654 | 2 | 0 | 3,652 | 1 | 0 |
| v3 → v4 | `3150aa8` | tag | 3,654 | 3,654 | 0 | 0 | 3,654 | 0 | 0 |
| v4 → v5 | `52692ff` | other | 3,654 | 3,462 | 0 | 192 | 3,462 | 117 | 0 |
| v5 → v6 | `787744d` | scrape | 3,462 | 3,459 | 0 | 3 | 3,459 | 2 | 10 |
| v6 → v7 | `8750dd8` | scrape | 3,459 | 3,459 | 2 | 2 | 3,457 | 0 | 8 |
| v7 → v8 | `49ae9dc` | scrape | 3,459 | 3,457 | 0 | 2 | 3,457 | 3 | 10 |
| v8 → v9 | `702a766` | scrape | 3,457 | 3,460 | 3 | 0 | 3,457 | 306 | 9 |
| v9 → v10 | `af7dbda` | scrape | 3,460 | 3,457 | 0 | 3 | 3,457 | 6 | 7 |
| v10 → v11 | `f7e3c97` | tag | 3,457 | 3,457 | 0 | 0 | 3,457 | 0 | 0 |
| v11 → v12 | `8ffbae3` | scrape | 3,457 | 3,458 | 2 | 1 | 3,456 | 52 | 16 |
| v12 → v13 | `2e6ae84` | scrape | 3,458 | 3,458 | 0 | 0 | 3,458 | 2 | 8 |
| v13 → v14 | `ca9a98b` | scrape | 3,458 | 3,457 | 0 | 1 | 3,457 | 1 | 9 |
| v14 → v15 | `aed3530` | scrape | 3,457 | 3,458 | 1 | 0 | 3,457 | 0 | 11 |
| v15 → v16 | `1b6dcf5` | scrape | 3,458 | 3,456 | 1 | 3 | 3,455 | 20 | 9 |
| v16 → v17 | `b457a33` | scrape | 3,456 | 3,458 | 2 | 0 | 3,456 | 0 | 12 |
| v17 → v18 | `53f5f6d` | scrape | 3,458 | 3,458 | 0 | 0 | 3,458 | 0 | 9 |
| v18 → v19 | `6b2cf0a` | scrape | 3,458 | 3,461 | 3 | 0 | 3,458 | 16 | 11 |
| v19 → v20 | `6b923bb` | scrape | 3,461 | 3,461 | 0 | 0 | 3,461 | 1 | 9 |
| v20 → v21 | `c6138ce` | scrape | 3,461 | 3,461 | 0 | 0 | 3,461 | 6 | 6 |
| v21 → v22 | `b1b9452` | scrape | 3,461 | 3,461 | 0 | 0 | 3,461 | 0 | 14 |
| v22 → v23 | `a5bcf86` | scrape | 3,461 | 3,461 | 0 | 0 | 3,461 | 0 | 7 |
| v23 → v24 | `592e6cc` | scrape | 3,461 | 3,460 | 0 | 1 | 3,460 | 2 | 8 |
| v24 → v25 | `7ee4cdc` | scrape | 3,460 | 3,461 | 1 | 0 | 3,460 | 3 | 8 |
| v25 → v26 | `0114506` | scrape | 3,461 | 3,461 | 0 | 0 | 3,461 | 1 | 10 |
| v26 → v27 | `9839810` | scrape | 3,461 | 3,461 | 0 | 0 | 3,461 | 3 | 7 |
| v27 → v28 | `165aca7` | scrape | 3,461 | 3,461 | 0 | 0 | 3,461 | 0 | 8 |
| v28 → v29 | `fc0b2d1` | scrape | 3,461 | 3,461 | 0 | 0 | 3,461 | 0 | 6 |
| v29 → v30 | `e35ec51` | scrape | 3,461 | 3,461 | 0 | 0 | 3,461 | 8 | 9 |
| v30 → v31 | `3891855` | scrape | 3,461 | 3,459 | 0 | 2 | 3,459 | 2 | 11 |
| v31 → v32 | `f61e296` | scrape | 3,459 | 3,459 | 0 | 0 | 3,459 | 2 | 15 |
| v32 → v33 | `5dff70d` | scrape | 3,459 | 3,459 | 0 | 0 | 3,459 | 2 | 5 |
| v33 → v34 | `290464f` | other | 3,459 | 3,459 | 0 | 0 | 3,459 | 0 | 0 |

The fields, counted on the common ids. `speakers` and `tracks` count a change of what they hold; a list that only changed its order is counted in the two columns after them. Other fields are every key outside the ten that differs, by name.

| pair | title | start | end | room | hotel | location | description | speakers | tracks | cancelled | speakers, order only | tracks, order only | other fields |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| v1 → v2 | 6 | 6 | 7 | 3 | 2 | 3 | 8 | 29 | 0 | 0 | 0 | 0 | day 2, duration_min 2 |
| v2 → v3 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | day 1 |
| v3 → v4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | tags 86 |
| v4 → v5 | 7 | 0 | 0 | 0 | 0 | 0 | 15 | 100 | 25 | 0 | 0 | 0 | tags 112, track 11, type 120 |
| v5 → v6 | 0 | 2 | 2 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 10 | day 1, track 10 |
| v6 → v7 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 7 | track 7 |
| v7 → v8 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 3 | 0 | 0 | 1 | 9 | track 9 |
| v8 → v9 | 1 | 0 | 0 | 0 | 0 | 0 | 303 | 0 | 0 | 3 | 0 | 9 | track 9 |
| v9 → v10 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 5 | 0 | 0 | 0 | 7 | track 7 |
| v10 → v11 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | tags 5 |
| v11 → v12 | 31 | 0 | 0 | 19 | 0 | 0 | 1 | 4 | 0 | 0 | 0 | 16 | track 16 |
| v12 → v13 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 2 | 0 | 0 | 0 | 8 | track 8 |
| v13 → v14 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 9 | track 9 |
| v14 → v15 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 11 | track 11 |
| v15 → v16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 0 | 0 | 0 | 9 | track 9 |
| v16 → v17 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12 | track 12 |
| v17 → v18 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 8 | track 8 |
| v18 → v19 | 9 | 4 | 4 | 0 | 0 | 0 | 1 | 5 | 0 | 0 | 0 | 11 | track 11 |
| v19 → v20 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 8 | track 8 |
| v20 → v21 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 0 | 0 | 0 | 6 | track 6 |
| v21 → v22 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 13 | track 13 |
| v22 → v23 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 6 | track 6 |
| v23 → v24 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 8 | track 8 |
| v24 → v25 | 0 | 0 | 0 | 1 | 0 | 1 | 1 | 2 | 0 | 0 | 1 | 7 | track 7 |
| v25 → v26 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 9 | track 9 |
| v26 → v27 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 2 | 0 | 1 | 0 | 7 | track 7 |
| v27 → v28 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 8 | track 8 |
| v28 → v29 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | track 6 |
| v29 → v30 | 3 | 1 | 1 | 2 | 2 | 2 | 4 | 4 | 0 | 0 | 1 | 8 | track 8 |
| v30 → v31 | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 1 | 0 | 11 | track 11 |
| v31 → v32 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 1 | 14 | track 14 |
| v32 → v33 | 1 | 0 | 0 | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 5 | track 5 |
| v33 → v34 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | none |

## 4. Pair by pair

### v1 → v2: `21105aa` - scrape, 2026-09-01 21:33:33 UTC

- Added 84:
  - `Gaming with Science / Wingspan Effect` - 2026-09-05T14:30 - Westin / Augusta 3 - `cd6fc9eb4daf652815838a9b09302eac`
  - `Roll Against Fear: Tales of the Valiant – LIVE!` - 2026-09-05T19:00 - Westin / Peachtree Ballroom - `cd6fc9eb4daf652815838a9b093039dd`
  - `Cozy Games` - 2026-09-06T14:30 - Westin / Augusta 1-2 - `cd6fc9eb4daf652815838a9b093049cb`
  - `Master Game Master` - 2026-09-06T19:00 - Westin / Peachtree Ballroom - `cd6fc9eb4daf652815838a9b09305692`
  - `Your Sci-Fi is Is in My Tabletop!` - 2026-09-06T17:30 - Westin / Augusta 1-2 - `cd6fc9eb4daf652815838a9b09305e83`
  - `Board Game Round Up` - 2026-09-06T16:00 - Westin / Augusta 1-2 - `cd6fc9eb4daf652815838a9b0930668a`
  - `The Absent Player` - 2026-09-06T13:00 - Westin / Augusta 1-2 - `cd6fc9eb4daf652815838a9b0930714c`
  - `Magic Items for Your Games` - 2026-09-06T11:30 - Westin / Augusta 1-2 - `cd6fc9eb4daf652815838a9b09307f76`
  - `Creating Memorable NPCs` - 2026-09-06T10:00 - Westin / Augusta 1-2 - `cd6fc9eb4daf652815838a9b0930847c`
  - `Dungeons and Randomness – LIVE!` - 2026-09-05T20:30 - Courtland Grand / Grand Capitol Ballroom - `cd6fc9eb4daf652815838a9b0930893f`
  - ... and 74 more
- Removed 6: under an id added here 0, still under an id both versions hold 0, gone 6.
  - Gone:
    - `Photo Session: Photo session: James Callis Solo` - 2026-09-05T15:20 - Marriott / International Hall South - `1e3995157984a4c0e6515a2ed636a1d6`
    - `Photo Session: Photo session: James Callis Solo` - 2026-09-04T13:50 - Marriott / International Hall South - `1e3995157984a4c0e6515a2ed63a1127`
    - `Photo Session: Photo session: Tom Welling Solo` - 2026-09-04T17:50 - Marriott / International Hall South - `1e3995157984a4c0e6515a2ed63a44af`
    - `Photo Session: Photo session: Smallville` - 2026-09-04T17:40 - Marriott / International Hall South - `1e3995157984a4c0e6515a2ed63a6714`
    - `Onesie Wednesday` - 2026-09-02T23:00 - Marriott / Marquis - `4f5d40b3cfde6b85b4ccbfe2be9a09bf`
    - `An Hour with Scott Adsit` - 2026-09-04T16:00 - Courtland Grand / Grand CG-Grand Ballroom A-F - `6ecc75745a676d39f230055623a365af`
- Start changes, 6:
  - `Break the Rules, Take the Heat: Transformers the Movie at 40`: 2026-09-05T17:30 → 2026-09-06T17:30
  - `Christopher Schmitz signing`: 2026-09-06T10:00 → 2026-09-06T12:00
  - `Photo Session: Photo session: Ross Marquand Solo`: 2026-09-06T00:00 → 2026-09-05T12:00
  - `Producing Puppet Short Films and Puppet Media`: 2026-09-04T14:30 → 2026-09-04T10:00
  - `Shami Stovall signing`: 2026-09-04T16:00 → 2026-09-04T18:00
  - `Welcome Home Dance & Countdown!`: 2026-09-03T01:00 → 2026-09-03T23:00
- Room changes, 3:
  - `From Maker to Professional`: Courtland Grand / Grand Atlanta 1-2 → Marriott / A708
  - `Non-Linear Storytelling for Immersive Entertainment`: Marriott / A708 → Courtland Grand / Grand Atlanta 1-2
  - `Shami Stovall signing`: AmericasMart / Mart2 Vendor Hall Floor 1 Aethon Books booth 3500 → AmericasMart / Mart2 Vendor Hall Floor 3 Aethon Books booth 3500
- Title changes, 6; 5 moved the event's dupe_key:
  - `Chuck Huber & Michael Copon Signing – Vendors Booth # 2529` → `Chuck Huber & Phil Parsons Signing – Vendors Booth # 2529`
  - `Chuck Huber and Michael Copon Signing – Booth #2529` → `Chuck Huber and Phil Parsons Signing – Booth #2529`
  - `Gale Martin signing` → `Gail Martin signing`
  - `Michael Copon and Chuck Huber Signing – Booth 2529` → `Phil Parsons and Chuck Huber Signing – Booth 2529`
  - `Photo Session: Photo session: Smallville` → `Photo Session: Photo Session: Smallville`
  - `Special Signing - Matt Dinniman & Jeff Hays!` → `Special Signing - Matt Dinniman and Jeff Hays!`
- Dedupe groups across the 5 title changes that moved a dupe_key: no other event holds a renamed event's old key after the pair or held its new key before it, and no id was added or removed at a renamed event's start and room, so no group gained or lost a member.
- Other fields: day 2, duration_min 2.

### v2 → v3: `9f1415e` - scrape, 2026-09-01 23:40:00 UTC

- Added 2:
  - `Supernatural Showdown: Formidable Foes Edition` - 2026-09-03T20:30 - Westin / Chastain 1-2 - `1730b660e89e6a3f06c52305de961188`
  - `Onesie Wednesday` - 2026-09-02T23:00 - Marriott / Marquis - `4f5d40b3cfde6b85b4ccbfe2be9a09bf`
- Start changes, 1:
  - `Welcome Home Dance & Countdown!`: 2026-09-03T23:00 → 2026-09-02T23:00
- Other fields: day 1.

### v3 → v4: `3150aa8` - tag, 2026-09-02 04:18:50 UTC

- Other fields: tags 86.

### v4 → v5: `52692ff` - other, 2026-09-02 11:30:23 UTC

- `scraper.py` changed in between: `52692ff` Merge dedupe: collapse duplicate events in the scraper.
- Removed 192: under an id added here 0, still under an id both versions hold 192, gone 0.
  - Still under an id both hold:
    - `Disney's Gargoyles in Animation & Comics` - 2026-09-06T13:00 - AmericasMart / Mart2 204J - `6ecc75745a676d39f23005562378353b` → `6ecc75745a676d39f2300556237557e4`
    - `Gina Torres - Big Damn Hero!` - 2026-09-05T17:30 - Marriott / Imperial Ballroom - `6ecc75745a676d39f230055623a23c98` → `1e3995157984a4c0e6515a2ed631dc0b`
    - `Blood, Bad Decisions, & the Brat Prince: The Vampire Lestat Fan Panel` - 2026-09-05T14:30 - Westin / Peachtree 1-2 - `6ecc75745a676d39f230055623a2719a` → `6ecc75745a676d39f23005562371d93e`
    - `Diversity Track Group Author Signing: Women in Speculative Fiction` - 2026-09-06T14:30 - Westin / Overlook - `6ecc75745a676d39f230055623a295a7` → `6ecc75745a676d39f230055623767c58`
    - `Star Wars Track Signing Showcase: Amazing Star Wars Authors` - 2026-09-05T17:30 - Westin / Overlook - `6ecc75745a676d39f230055623a30d27` → `6ecc75745a676d39f230055623769b8b`
    - `Science Fiction Lit Track Group Author Signing: Humor in SF Lit` - 2026-09-06T10:00 - Westin / Overlook - `6ecc75745a676d39f230055623a652de` → `6ecc75745a676d39f230055623769285`
    - `Urban Fantasy Author Group Signing:` - 2026-09-06T13:00 - Westin / Overlook - `6ecc75745a676d39f230055623a6b72b` → `6ecc75745a676d39f230055623767cab`
    - `DC Comics' Animated TV Shows` - 2026-09-04T13:00 - AmericasMart / Mart2 204J - `6ecc75745a676d39f230055623a7eed0` → `6ecc75745a676d39f230055623752c8c`
    - `Gaming with Science / Wingspan Effect` - 2026-09-05T14:30 - Westin / Augusta 3 - `6ecc75745a676d39f230055623a80a69` → `1e3995157984a4c0e6515a2ed62c9070`
    - `Introduction to Splendid Teapot Racing` - 2026-09-04T11:30 - Courtland Grand / Grand Augusta - `6ecc75745a676d39f230055623a8428a` → `6ecc75745a676d39f2300556237c5b0a`
    - ... and 182 more
- Title changes, 7; 6 moved the event's dupe_key:
  - `Photoshoot: Catherine Oâ€™Hara Memorial Shoot` → `Photoshoot: Catherine O'Hara Memorial Shoot`
  - `Photoshoot: Critical Role: Araman and Worldâ€™s Beyond` → `Photoshoot: Critical Role: Araman and Worlds Beyond`
  - `Photoshoot: Cult of Buc-eeâ€™s` → `Photoshoot: Cult of Buc-ee's`
  - `Photoshoot: GiJoe and Cobra` → `Photoshoot: GIJoe and Cobra`
  - `Photoshoot: The Cult of MalÃ¶rt` → `Photoshoot: The Cult of Malört`
  - `Photoshoot: Widowâ€™s Bay` → `Photoshoot: Widow's Bay`
  - `Post?Apocalyptic Fiction for Fun & Trauma` → `Post-Apocalyptic Fiction for Fun & Trauma`
- Dedupe groups across the 6 title changes that moved a dupe_key: 0 of the renamed events had been a group of two or more ids in v4, the last version where copies show; no other event holds a renamed event's old key after the pair or held its new key before it, and no id was added or removed at a renamed event's start and room, so no group gained or lost a member.
- Other fields: tags 112, track 11, type 120.

### v5 → v6: `787744d` - scrape, 2026-09-02 16:56:42 UTC

- Removed 3: under an id added here 0, still under an id both versions hold 0, gone 3.
  - Gone:
    - `Photo Session: Photo session: Isaac Ordonez Solo` - 2026-09-06T14:10 - Marriott / International Hall South - `1e3995157984a4c0e6515a2ed6332791`
    - `Photo Session: Photo session: Evie Templeton Solo` - 2026-09-06T14:10 - Marriott / International Hall South - `1e3995157984a4c0e6515a2ed6332a8f`
    - `Photo Session: Photo session: Wednesday` - 2026-09-06T14:10 - Marriott / International Hall South - `1e3995157984a4c0e6515a2ed6348ee1`
- Start changes, 2:
  - `Family & Friends at Nevermore: Wednesday Cast`: 2026-09-06T10:00 → 2026-09-04T11:30
  - `Photo Session: Photo Session: Aaron Douglas`: 2026-09-06T11:30 → 2026-09-06T14:10
- Room changes, 1:
  - `Family & Friends at Nevermore: Wednesday Cast`: Westin / Peachtree Ballroom → Hyatt / Centennial II-IV
- Order only: tracks 10.
- Other fields: day 1, track 10.

### v6 → v7: `8750dd8` - scrape, 2026-09-02 21:16:20 UTC

- Added 2:
  - `Meet the Hellaverse Cast` - 2026-09-06T16:00 - Hilton / Hilton-Salon - `a3b6e0b83be4882de2e8a2170733de54`
  - `An Hour with Georgie Leahy` - 2026-09-04T19:00 - Hilton / Hilton-Salon - `e69d501c2d69b4f93b5313149141b03e`
- Removed 2: under an id added here 0, still under an id both versions hold 0, gone 2.
  - Gone:
    - `Hazbin Hotel Cast` - 2026-09-06T16:00 - Hilton / Salon - `6ecc75745a676d39f230055623a24fa5`
    - `Meet the Hellverse Creator!` - 2026-09-04T19:00 - Hilton / Salon - `6ecc75745a676d39f230055623a25d94`
- Order only: speakers 1, tracks 7.
- Other fields: track 7.

### v7 → v8: `49ae9dc` - scrape, 2026-09-02 23:40:39 UTC

- Removed 2: under an id added here 0, still under an id both versions hold 0, gone 2.
  - Gone:
    - `Photo Session: Photo session: Hazbin Hotel` - 2026-09-04T15:00 - Marriott / International Hall South - `1e3995157984a4c0e6515a2ed639b2ac`
    - `Photo Session: Photo session: Vivienne Medrano Solo` - 2026-09-04T15:00 - Marriott / International Hall South - `1e3995157984a4c0e6515a2ed639b88f`
- Title changes, 1; 1 moved the event's dupe_key:
  - `Hazbin Hotel /Helluva Boss – Viv Medrano!` → `Helluva Boss Cast`
- Dedupe groups across the 1 title change that moved a dupe_key: 0 of the renamed events had been a group of two or more ids in v4, the last version where copies show; no other event holds a renamed event's old key after the pair or held its new key before it, and no id was added or removed at a renamed event's start and room, so no group gained or lost a member.
- Order only: speakers 1, tracks 9.
- Other fields: track 9.

### v8 → v9: `702a766` - scrape, 2026-09-03 04:00:02 UTC

- `scraper.py` changed in between: `b14c611` Merge cancelled-flag: cancelled means the event said so; `c77bbe1` Merge descriptions: each description once, line breaks kept.
- Added 3:
  - `Photo Session: Photo session: James Callis Solo` - 2026-09-04T13:50 - Marriott / International Hall South - `e7a143f7f9a04b9580c1b55cffd71723`
  - `Photo Session: Photo session: James Callis Solo` - 2026-09-05T15:20 - Marriott / International Hall South - `f1a3341fc863c0a3f635d819c7ac9d19`
  - `Photo Session: Photo session: James Callis Solo` - 2026-09-06T13:30 - Marriott / International Hall South - `fce517cd0c0fd0bde5d2d35704f3f4b7`
- Title changes, 1; 1 moved the event's dupe_key:
  - `Live Painting with Tahani Farr` → `Live Painting with Tehani Farr`
- `cancelled` changes, 3:
  - `Classic TV Table Read: Manimal`: true → false
  - `Doctor Who: Into the Wilderness Years?`: true → false
  - `Hopes, Dreams, & Cancellations: The MSFM Festivus Panel`: true → false
- Dedupe groups across the 1 title change that moved a dupe_key: 0 of the renamed events had been a group of two or more ids in v4, the last version where copies show; no other event holds a renamed event's old key after the pair or held its new key before it, and no id was added or removed at a renamed event's start and room, so no group gained or lost a member.
- Order only: tracks 9.
- Other fields: track 9.

### v9 → v10: `af7dbda` - scrape, 2026-09-03 04:53:56 UTC

- Removed 3: under an id added here 0, still under an id both versions hold 0, gone 3.
  - Gone:
    - `DCTV Interview and DCTV Tries segment` - 2026-09-04T12:00 - Hyatt / Grand Hall Main Floor - `1e3995157984a4c0e6515a2ed63b5d03`
    - `DCTV Interview - Live Show` - 2026-09-07T08:30 - Hyatt / Centennial II-IV - `6ecc75745a676d39f230055623a10ede`
    - `Paranormal Caught on Camera: Unseen & Behind the Scenes with Aaron Sagers` - 2026-09-06T17:30 - Courtland Grand / Grand Capitol Ballroom - `6ecc75745a676d39f230055623a2ba2f`
- Order only: tracks 7.
- Other fields: track 7.

### v10 → v11: `f7e3c97` - tag, 2026-09-03 05:32:23 UTC

- Other fields: tags 5.

### v11 → v12: `8ffbae3` - scrape, 2026-09-03 11:33:12 UTC

- `scraper.py` changed in between: `5b03eef` Merge qa-sweep: last sweep fixes, and a search box that is never rebuilt under the keyboard.
- Added 2:
  - `Photo Session: The Boys` - 2026-09-04T12:30 - Marriott / International Hall South - `4a6a4f2cf2cbaedd47f016aa48259b41`
  - `Photo Session: The Boys` - 2026-09-05T12:10 - Marriott / International Hall South - `4a6a4f2cf2cbaedd47f016aa48827565`
- Removed 1: under an id added here 0, still under an id both versions hold 0, gone 1.
  - Gone:
    - `On the Mothman Trail` - 2026-09-04T16:00 - Courtland Grand / Grand Athens - `c32d19e7750818e0eb903f152ac55882`
- Room changes, 19:
  - `26th Annual Dragon Con Parade!`: Other / O Parade → Other / Parade
  - `Dragon Con Kick-Off Celebration: From Juke Joints to Hip Hop Dance!`: Other / O Other Marriott, Imperial Ballroom → Other / Other Marriott, Imperial Ballroom
  - `Dragon Con Night at the Georgia Aquarium **EXTRA FEE EVENT**`: Other / O Georgia Aquarium → Other / Georgia Aquarium
  - `Final Fantasy Fish Finding Scavenger Hunt (FFFFSH!)`: Other / O Georgia Aquarium → Other / Georgia Aquarium
  - `Gatsby & Daisy Champagne Ball **EXTRA FEE EVENT**`: Other / O 200 Peachtree Whitehall Ballroom → Other / 200 Peachtree Whitehall Ballroom
  - `Joystick Gamebar Presents: FREE Arcade Games!!!`: Other / O Joystick Gamebar → Other / Joystick Gamebar
  - `Joystick Gamebar Presents: FREE Arcade Games!!!`: Other / O Joystick Gamebar → Other / Joystick Gamebar
  - `Joystick Gamebar Presents: FREE Arcade Games!!!`: Other / O Joystick Gamebar → Other / Joystick Gamebar
  - `Joystick Gamebar Presents: FREE Arcade Games!!!`: Other / O Joystick Gamebar → Other / Joystick Gamebar
  - `Joystick Gamebar Presents: FREE Arcade Games!!!`: Other / O Joystick Gamebar → Other / Joystick Gamebar
  - ... and 9 more
- Title changes, 31; 31 moved the event's dupe_key:
  - `Photo Session: Photo Session: Aaron Ashmore` → `Photo Session: Aaron Ashmore`
  - `Photo Session: Photo Session: Aaron Ashmore` → `Photo Session: Aaron Ashmore`
  - `Photo Session: Photo Session: Aaron Douglas` → `Photo Session: Aaron Douglas`
  - `Photo Session: Photo Session: Aaron Douglas` → `Photo Session: Aaron Douglas`
  - `Photo Session: Photo Session: Aaron Douglas` → `Photo Session: Aaron Douglas`
  - `Photo Session: Photo session: Alan Tudyk Solo` → `Photo Session: Alan Tudyk Solo`
  - `Photo Session: Photo session: Alan Tudyk Solo` → `Photo Session: Alan Tudyk Solo`
  - `Photo Session: Photo session: Alex Rochon Solo` → `Photo Session: Alex Rochon Solo`
  - `Photo Session: Photo session: Alex Rochon Solo` → `Photo Session: Alex Rochon Solo`
  - `Photo Session: Photo session: Alex Rochon Solo` → `Photo Session: Alex Rochon Solo`
  - ... and 21 more
- Dedupe groups across the 31 title changes that moved a dupe_key: 0 of the renamed events had been a group of two or more ids in v4, the last version where copies show; no other event holds a renamed event's old key after the pair or held its new key before it, and no id was added or removed at a renamed event's start and room, so no group gained or lost a member.
- Order only: tracks 16.
- Other fields: track 16.

### v12 → v13: `2e6ae84` - scrape, 2026-09-03 16:46:50 UTC

- Order only: tracks 8.
- Other fields: track 8.

### v13 → v14: `ca9a98b` - scrape, 2026-09-03 21:24:59 UTC

- Removed 1: under an id added here 0, still under an id both versions hold 0, gone 1.
  - Gone:
    - `Photo Session: Photo session: Tom Welling Solo` - 2026-09-06T14:50 - Marriott / International Hall South - `1e3995157984a4c0e6515a2ed632d105`
- Order only: tracks 9.
- Other fields: track 9.

### v14 → v15: `aed3530` - scrape, 2026-09-03 23:39:22 UTC

- Added 1:
  - `Photo Session: Photo session: Tom Welling Solo` - 2026-09-06T14:50 - Marriott / International Hall South - `1e3995157984a4c0e6515a2ed632d105`
- Order only: tracks 11.
- Other fields: track 11.

### v15 → v16: `1b6dcf5` - scrape, 2026-09-04 04:53:44 UTC

- Added 1:
  - `Photo Session: Jack Quaid Solo` - 2026-09-04T12:40 - Marriott / International Hall South - `73107aead1886165a0f61b3f317f7e08`
- Removed 3: under an id added here 0, still under an id both versions hold 0, gone 3.
  - Gone:
    - `Photo Session: Photo session: John Billingsley Solo` - 2026-09-06T12:50 - Marriott / International Hall South - `1e3995157984a4c0e6515a2ed633e6f7`
    - `Photo Session: Photo session: John Billingsley Solo` - 2026-09-05T12:30 - Marriott / International Hall South - `1e3995157984a4c0e6515a2ed638054b`
    - `Photo Session: Photo session: John Billingsley Solo` - 2026-09-04T16:00 - Marriott / International Hall South - `1e3995157984a4c0e6515a2ed639632d`
- Order only: tracks 9.
- Other fields: track 9.

### v16 → v17: `b457a33` - scrape, 2026-09-04 11:37:15 UTC

- Added 2:
  - `Photo Session: Jack Quaid Solo` - 2026-09-06T12:20 - Marriott / International Hall South - `b77d1cad025955d8c0d486d0bda23ccc`
  - `Photo Session: Jack Quaid Solo` - 2026-09-05T12:00 - Marriott / International Hall South - `fd5e688f690df209758bd2089ec5f204`
- Order only: tracks 12.
- Other fields: track 12.

### v17 → v18: `53f5f6d` - scrape, 2026-09-04 16:42:19 UTC

- Order only: speakers 1, tracks 8.
- Other fields: track 8.

### v18 → v19: `6b2cf0a` - scrape, 2026-09-04 21:08:18 UTC

- Added 3:
  - `Kevin Carlson Autograph Session` - 2026-09-05T16:00 - Marriott / Marriott-A703 - `0866095ce3bc4203798ee5cb816355de`
  - `Kevin Carlson Autograph Session` - 2026-09-06T11:30 - Marriott / Marriott-A703 - `565ef7fb0c527002f010acc2bc55a210`
  - `On the Mothman Trail` - 2026-09-04T16:00 - Courtland Grand / Grand Athens - `c32d19e7750818e0eb903f152ac55882`
- Start changes, 4:
  - `Photo Session: Celia Rose Gooding`: 2026-09-05T16:30 → 2026-09-05T17:30
  - `Photo Session: Jack Quaid Solo`: 2026-09-06T12:20 → 2026-09-06T13:10
  - `Photo Session: Jess Bush`: 2026-09-05T16:30 → 2026-09-05T17:30
  - `Photo Session: Strange New Worlds`: 2026-09-05T16:30 → 2026-09-05T17:30
- Title changes, 9; 9 moved the event's dupe_key:
  - `Photo Session: Photo Session: Celia Rose Gooding` → `Photo Session: Celia Rose Gooding`
  - `Photo Session: Photo Session: Celia Rose Gooding` → `Photo Session: Celia Rose Gooding`
  - `Photo Session: Photo session: Castle Group` → `Photo Session: Castle Group`
  - `Photo Session: Photo session: Jess Bush` → `Photo Session: Jess Bush`
  - `Photo Session: Photo session: Jess Bush` → `Photo Session: Jess Bush`
  - `Photo Session: Photo session: Jess Bush` → `Photo Session: Jess Bush`
  - `Photo Session: Photo session: Strange New Worlds` → `Photo Session: Strange New Worlds`
  - `Photo Session: Photo session: Strange New Worlds` → `Photo Session: Strange New Worlds`
  - `Photo Session: Photo session: Strange New Worlds` → `Photo Session: Strange New Worlds`
- Dedupe groups across the 9 title changes that moved a dupe_key: 0 of the renamed events had been a group of two or more ids in v4, the last version where copies show; no other event holds a renamed event's old key after the pair or held its new key before it, and no id was added or removed at a renamed event's start and room, so no group gained or lost a member.
- Order only: tracks 11.
- Other fields: track 11.

### v19 → v20: `6b923bb` - scrape, 2026-09-04 23:24:30 UTC

- Title changes, 1; 1 moved the event's dupe_key:
  - `Photo Session: Photo Session: Celia Rose Gooding` → `Photo Session: Celia Rose Gooding`
- Dedupe groups across the 1 title change that moved a dupe_key: 0 of the renamed events had been a group of two or more ids in v4, the last version where copies show; no other event holds a renamed event's old key after the pair or held its new key before it, and no id was added or removed at a renamed event's start and room, so no group gained or lost a member.
- Order only: speakers 1, tracks 8.
- Other fields: track 8.

### v20 → v21: `c6138ce` - scrape, 2026-09-05 04:46:57 UTC

- Order only: tracks 6.
- Other fields: track 6.

### v21 → v22: `b1b9452` - scrape, 2026-09-05 10:53:58 UTC

- Order only: speakers 1, tracks 13.
- Other fields: track 13.

### v22 → v23: `a5bcf86` - scrape, 2026-09-05 15:33:39 UTC

- Order only: speakers 1, tracks 6.
- Other fields: track 6.

### v23 → v24: `592e6cc` - scrape, 2026-09-05 17:42:25 UTC

- Removed 1: under an id added here 0, still under an id both versions hold 0, gone 1.
  - Gone:
    - `The Stars of Farscape: We Don't Say Goodbyes` - 2026-09-07T10:00 - Westin / Peachtree Ballroom - `c32d19e7750818e0eb903f152ac6a446`
- Order only: tracks 8.
- Other fields: track 8.

### v24 → v25: `7ee4cdc` - scrape, 2026-09-05 20:40:15 UTC

- Added 1:
  - `Claudia Black Live!` - 2026-09-07T10:00 - Westin / Peachtree Ballroom - `dbd8b0e8fd87f9b5c9e6f1d6bf180322`
- Room changes, 1:
  - `Spectrum: A Rainbow Flag Party – Age Verification & Wristbanding`: Hyatt / Roswell In hallway -outside Roswell, near International to → Hyatt / Techwood
- Order only: speakers 1, tracks 7.
- Other fields: track 7.

### v25 → v26: `0114506` - scrape, 2026-09-05 23:14:39 UTC

- Order only: speakers 1, tracks 9.
- Other fields: track 9.

### v26 → v27: `9839810` - scrape, 2026-09-06 04:58:38 UTC

- Title changes, 1; 1 moved the event's dupe_key:
  - `Dragon Con Burlesque: A Glamour Geek Revue` → `CANCELLED: Dragon Con Burlesque: A Glamour Geek Revue`
- `cancelled` changes, 1:
  - `CANCELLED: Dragon Con Burlesque: A Glamour Geek Revue`: false → true
- Dedupe groups across the 1 title change that moved a dupe_key: 0 of the renamed events had been a group of two or more ids in v4, the last version where copies show; no other event holds a renamed event's old key after the pair or held its new key before it, and no id was added or removed at a renamed event's start and room, so no group gained or lost a member.
- Order only: tracks 7.
- Other fields: track 7.

### v27 → v28: `165aca7` - scrape, 2026-09-06 11:14:39 UTC

- Order only: tracks 8.
- Other fields: track 8.

### v28 → v29: `fc0b2d1` - scrape, 2026-09-06 15:48:29 UTC

- Order only: tracks 6.
- Other fields: track 6.

### v29 → v30: `e35ec51` - scrape, 2026-09-06 20:44:57 UTC

- Start changes, 1:
  - `MOVED! Vision Vogue Fashion Show`: 2026-09-06T14:30 → 2026-09-06T16:00
- Room changes, 2:
  - `MOVED = Miss Star Trek Universe Pageant`: Courtland Grand / Grand CG-Grand Ballroom A-F → Marriott / Atrium Ballroom
  - `MOVED! Vision Vogue Fashion Show`: Courtland Grand / Grand CG-Grand Ballroom A-F → Hyatt / Centennial II-IV
- Title changes, 3; 3 moved the event's dupe_key:
  - `Miss Star Trek Universe Pageant` → `MOVED = Miss Star Trek Universe Pageant`
  - `Return of the Star Wars Costume Contest` → `Star Wars Costume Showcase`
  - `Vision Vogue Fashion Show` → `MOVED! Vision Vogue Fashion Show`
- Dedupe groups across the 3 title changes that moved a dupe_key: 0 of the renamed events had been a group of two or more ids in v4, the last version where copies show; no other event holds a renamed event's old key after the pair or held its new key before it, and no id was added or removed at a renamed event's start and room, so no group gained or lost a member.
- Order only: speakers 1, tracks 8.
- Other fields: track 8.

### v30 → v31: `3891855` - scrape, 2026-09-06 23:14:16 UTC

- Removed 2: under an id added here 0, still under an id both versions hold 0, gone 2.
  - Gone:
    - `X-Men '97 Guests` - 2026-09-07T10:00 - Marriott / Atrium Ballroom - `6ecc75745a676d39f230055623782e8d`
    - `Battlestar Galactica: Back on Earth` - 2026-09-07T11:30 - Hyatt / Centennial II-IV - `c32d19e7750818e0eb903f152ac6b30b`
- Title changes, 1; 1 moved the event's dupe_key:
  - `The Temporal Formal: Silver Screens and Golden Dreams` → `CANCELLED - The Temporal Formal: Silver Screens and Golden Dreams`
- `cancelled` changes, 1:
  - `CANCELLED - The Temporal Formal: Silver Screens and Golden Dreams`: false → true
- Dedupe groups across the 1 title change that moved a dupe_key: 0 of the renamed events had been a group of two or more ids in v4, the last version where copies show; no other event holds a renamed event's old key after the pair or held its new key before it, and no id was added or removed at a renamed event's start and room, so no group gained or lost a member.
- Order only: tracks 11.
- Other fields: track 11.

### v31 → v32: `f61e296` - scrape, 2026-09-07 05:01:46 UTC

- Order only: speakers 1, tracks 14.
- Other fields: track 14.

### v32 → v33: `5dff70d` - scrape, 2026-09-07 12:50:19 UTC

- Room changes, 1:
  - `MOVED! Star Trek Actors Q&A`: Hilton / Salon → Marriott / Atrium Ballroom
- Title changes, 1; 1 moved the event's dupe_key:
  - `Star Trek Actors Q&A` → `MOVED! Star Trek Actors Q&A`
- Dedupe groups across the 1 title change that moved a dupe_key: 0 of the renamed events had been a group of two or more ids in v4, the last version where copies show; no other event holds a renamed event's old key after the pair or held its new key before it, and no id was added or removed at a renamed event's start and room, so no group gained or lost a member.
- Order only: tracks 5.
- Other fields: track 5.

### v33 → v34: `290464f` - other, 2026-09-07 17:25:27 UTC

- `scraper.py` changed in between: `290464f` Merge archive-2026: the 2026 schedule frozen under data/2026, one clock, archive mode after the con.
- No change: the same events, field for field.

## 5. Across the history

### Removed ids

Where a removed id's content - its dupe_key - went:

- To an id added in the same pair. A new id that sorts before the old one is consistent with a dedupe-survivor flip, a new copy with a smaller id winning the group, and with a source id change that happens to sort lower. One that sorts after cannot be the dedupe's choice, since the smallest id survives: either the source gave the listing a new id, or a smaller copy left the source while a larger one the dedupe had hidden stayed. The file keeps no merged-away ids, so the two readings cannot be told apart. Ids sort as strings, as `merge_group`'s `min()` compares them.
- To an id both versions hold: a dedupe collapse.
- Nowhere: gone.

| pair | class | removed | under an added id | under an id both hold | gone | same-title matches (UNSURE) |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| v1 → v2 | scrape | 6 | 0 | 0 | 6 | 0 |
| v4 → v5 | other | 192 | 0 | 192 | 0 | 0 |
| v5 → v6 | scrape | 3 | 0 | 0 | 3 | 0 |
| v6 → v7 | scrape | 2 | 0 | 0 | 2 | 0 |
| v7 → v8 | scrape | 2 | 0 | 0 | 2 | 0 |
| v9 → v10 | scrape | 3 | 0 | 0 | 3 | 0 |
| v11 → v12 | scrape | 1 | 0 | 0 | 1 | 0 |
| v13 → v14 | scrape | 1 | 0 | 0 | 1 | 0 |
| v15 → v16 | scrape | 3 | 0 | 0 | 3 | 0 |
| v23 → v24 | scrape | 1 | 0 | 0 | 1 | 0 |
| v30 → v31 | scrape | 2 | 0 | 0 | 2 | 0 |

### Ids that leave and later return

| id | title | missing from | versions | `failures` there | first missing to back |
| --- | --- | --- | ---: | ---: | ---: |
| `1e3995157984a4c0e6515a2ed632d105` | `Photo Session: Photo session: Tom Welling Solo` | v14 `ca9a98b` | 1 | 1 | 2h 14m |
| `4f5d40b3cfde6b85b4ccbfe2be9a09bf` | `Onesie Wednesday` | v2 `21105aa` | 1 | 0 | 2h 06m |
| `c32d19e7750818e0eb903f152ac55882` | `On the Mothman Trail` | v12-v18 (`8ffbae3` to `53f5f6d`) | 7 | 0, 0, 1, 0, 0, 0, 0 | 33h 35m |

### Content that returns under another id

A dupe_key absent from one or more versions, then held again by a different id. The readings of "sorts before" and "sorts after" are the two above; no pair shows this within itself, so the examples come from across the history.

- `Photo Session: Photo session: James Callis Solo` - 2026-09-04T13:50 - Marriott / International Hall South: held by `1e3995157984a4c0e6515a2ed63a1127` to v1, absent v2-v8, back in v9 under `e7a143f7f9a04b9580c1b55cffd71723`; `e7a143f7f9a04b9580c1b55cffd71723` sorts after `1e3995157984a4c0e6515a2ed63a1127`.
- `Photo Session: Photo session: James Callis Solo` - 2026-09-05T15:20 - Marriott / International Hall South: held by `1e3995157984a4c0e6515a2ed636a1d6` to v1, absent v2-v8, back in v9 under `f1a3341fc863c0a3f635d819c7ac9d19`; `f1a3341fc863c0a3f635d819c7ac9d19` sorts after `1e3995157984a4c0e6515a2ed636a1d6`.

### `cancelled`, every transition

- v9 `702a766`: `Classic TV Table Read: Manimal`: true → false - `scraper.py` changed in between
- v9 `702a766`: `Doctor Who: Into the Wilderness Years?`: true → false - `scraper.py` changed in between
- v9 `702a766`: `Hopes, Dreams, & Cancellations: The MSFM Festivus Panel`: true → false - `scraper.py` changed in between
- v27 `9839810`: `CANCELLED: Dragon Con Burlesque: A Glamour Geek Revue`: false → true
- v31 `3891855`: `CANCELLED - The Temporal Formal: Silver Screens and Golden Dreams`: false → true

## 6. Why `tracks` and `speakers` reorder

The mechanism, from `scraper.py`, with each step checked against the history where the history can show it:

1. `scrape()` sorts the events by (start, title) before `dedupe()` groups them.
2. The copies of a dedupe group tie on that sort. In `3150aa8` (v4), the last version in which two ids share a dupe_key, 146 keys are held by two or more ids, and the copies of 146 of them share their start and their exact title.
3. Python's sort is stable, so tied copies keep the order they arrived in: the order in which `as_completed` handed back their detail pages, which is the order the requests finished.
4. `merge_group` takes `speakers` and `tracks` in first appearance, so a merged event's lists - and `track`, the first of `tracks` - come out in that order.

- `speakers`, after v4: 10 order-only changes on 1 event, which is an id of the v4 groups: `The Great Geek Sing-along` (`6ecc75745a676d39f2300556237b0b60`).
- `tracks`, after v4: 242 order-only changes on 25 events, of which 25 are ids of the v4 groups.
- Events in the last version with two or more tracks: 25, of which 25 are ids of the v4 groups.

The fix, proposed and applied to nothing: sort a group by id before merging it - `group = sorted(group, key=lambda e: e["id"])` at the top of `merge_group` - so the unions follow id order, the same on every run. The same order would also settle the two other picks that take the group's order today: `max` between two descriptions of one length, and `next` for the first tagged copy.

## 7. When the changes landed

### Commits by date

| date | UTC: all | UTC: scrape | New York: all | New York: scrape |
| --- | ---: | ---: | ---: | ---: |
| 2026-09-01 | 3 | 2 | 3 | 2 |
| 2026-09-02 | 5 | 3 | 5 | 3 |
| 2026-09-03 | 7 | 6 | 7 | 6 |
| 2026-09-04 | 5 | 5 | 5 | 5 |
| 2026-09-05 | 6 | 6 | 6 | 6 |
| 2026-09-06 | 5 | 5 | 5 | 5 |
| 2026-09-07 | 3 | 2 | 3 | 2 |

### Commits by hour

| hour | UTC: all | UTC: scrape | New York: all | New York: scrape |
| --- | ---: | ---: | ---: | ---: |
| 00 | 0 | 0 | 6 | 5 |
| 01 | 0 | 0 | 2 | 1 |
| 02 | 0 | 0 | 0 | 0 |
| 03 | 0 | 0 | 0 | 0 |
| 04 | 6 | 5 | 0 | 0 |
| 05 | 2 | 1 | 0 | 0 |
| 06 | 0 | 0 | 1 | 1 |
| 07 | 0 | 0 | 4 | 3 |
| 08 | 0 | 0 | 1 | 1 |
| 09 | 0 | 0 | 0 | 0 |
| 10 | 1 | 1 | 0 | 0 |
| 11 | 4 | 3 | 2 | 2 |
| 12 | 1 | 1 | 3 | 3 |
| 13 | 0 | 0 | 2 | 1 |
| 14 | 0 | 0 | 0 | 0 |
| 15 | 2 | 2 | 0 | 0 |
| 16 | 3 | 3 | 3 | 2 |
| 17 | 2 | 1 | 4 | 4 |
| 18 | 0 | 0 | 0 | 0 |
| 19 | 0 | 0 | 6 | 6 |
| 20 | 3 | 2 | 0 | 0 |
| 21 | 4 | 4 | 0 | 0 |
| 22 | 0 | 0 | 0 | 0 |
| 23 | 6 | 6 | 0 | 0 |

### Gaps between scrape commits

28 gaps: shortest 53m 54s, median 4h 38m, longest 17h 16m.

| from | to | gap |
| --- | --- | ---: |
| v2 `21105aa` | v3 `9f1415e` | 2h 06m |
| v3 `9f1415e` | v6 `787744d` | 17h 16m |
| v6 `787744d` | v7 `8750dd8` | 4h 19m |
| v7 `8750dd8` | v8 `49ae9dc` | 2h 24m |
| v8 `49ae9dc` | v9 `702a766` | 4h 19m |
| v9 `702a766` | v10 `af7dbda` | 53m 54s |
| v10 `af7dbda` | v12 `8ffbae3` | 6h 39m |
| v12 `8ffbae3` | v13 `2e6ae84` | 5h 13m |
| v13 `2e6ae84` | v14 `ca9a98b` | 4h 38m |
| v14 `ca9a98b` | v15 `aed3530` | 2h 14m |
| v15 `aed3530` | v16 `1b6dcf5` | 5h 14m |
| v16 `1b6dcf5` | v17 `b457a33` | 6h 43m |
| v17 `b457a33` | v18 `53f5f6d` | 5h 05m |
| v18 `53f5f6d` | v19 `6b2cf0a` | 4h 25m |
| v19 `6b2cf0a` | v20 `6b923bb` | 2h 16m |
| v20 `6b923bb` | v21 `c6138ce` | 5h 22m |
| v21 `c6138ce` | v22 `b1b9452` | 6h 07m |
| v22 `b1b9452` | v23 `a5bcf86` | 4h 39m |
| v23 `a5bcf86` | v24 `592e6cc` | 2h 08m |
| v24 `592e6cc` | v25 `7ee4cdc` | 2h 57m |
| v25 `7ee4cdc` | v26 `0114506` | 2h 34m |
| v26 `0114506` | v27 `9839810` | 5h 43m |
| v27 `9839810` | v28 `165aca7` | 6h 16m |
| v28 `165aca7` | v29 `fc0b2d1` | 4h 33m |
| v29 `fc0b2d1` | v30 `e35ec51` | 4h 56m |
| v30 `e35ec51` | v31 `3891855` | 2h 29m |
| v31 `3891855` | v32 `f61e296` | 5h 47m |
| v32 `f61e296` | v33 `5dff70d` | 7h 48m |

### Con days and before

Con days are the days the last version's events fall on, 2026-09-02 to 2026-09-07 - the bounds the client's `CON` holds - and a commit's day is its New York date. Only scrape pairs are counted; `changed` is common ids with one of the ten fields changed other than by order.

Every scrape pair:

| period | pairs | added | removed | changed | start | room | title | cancelled |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| before | 2 | 86 | 6 | 44 | 7 | 3 | 6 | 0 |
| during | 27 | 15 | 18 | 438 | 7 | 24 | 49 | 5 |

Scrape pairs with no `scraper.py` change between them - the source's changes alone:

| period | pairs | added | removed | changed | start | room | title | cancelled |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| before | 2 | 86 | 6 | 44 | 7 | 3 | 6 | 0 |
| during | 25 | 10 | 17 | 80 | 7 | 5 | 17 | 2 |

## 8. scrape.yml's runs

From `gh run list --workflow=scrape.yml` (every run) and `gh run view` for each run's job.

- Runs: 32: schedule 29, workflow_dispatch 3. Conclusions: failure 3, success 29. Runs on a second attempt: 0.
- Start to last update: shortest 20m 42s, median 22m 32s, longest 33m 00s. A run's job started at most 5 s after the run was created.
- Scrape commits made by a run: 29 of 29, each to one run, by the run whose start to last update holds the commit's author time. Runs that committed nothing: 3 - #3 (failure), #4 (failure), #7 (failure).
- Successful runs that committed nothing - no-op runs: 0. Every scrape writes a new `generated_at`, so a run that reaches its commit step has something to commit.

### Failed runs

| run | created (UTC) | trigger | head | failed step | overlapped |
| --- | --- | --- | --- | --- | --- |
| #3 | 2026-09-02 04:30:41 | schedule | `3150aa8` | Commit events.json if anything changed | - |
| #4 | 2026-09-02 11:15:35 | schedule | `08c80b8` | Commit events.json if anything changed | - |
| #7 | 2026-09-02 21:01:25 | schedule | `651ac3f` | Commit events.json if anything changed | #6 |

### Runs that overlapped

- #6 (workflow_dispatch, success, 2026-09-02 20:51:11 to 2026-09-02 21:16:32) and #7 (schedule, failure, 2026-09-02 21:01:25 to 2026-09-02 21:26:36), before scrape.yml had a concurrency group.

### The cron and its slots

- scrape.yml gained its concurrency group in `74f04f0` (2026-09-03 02:42:06 UTC, commit time). A run the group queues out is kept as a `cancelled` run; runs cancelled: 0.
- `17 */3 * * *` was in scrape.yml from `aec5f18` (2026-09-01 20:56:09 UTC) to `290464f` (2026-09-07 17:25:27 UTC), by commit time: 47 slots.
- GitHub records no slot for a scheduled run, so a run is counted for the last slot at or before its creation. Under that rule 29 scheduled runs fall in 29 slots, created 9m 36s to 2h 54m after their slot; one run a slot.
- Slots with no run: 18. The run metadata holds no run for any of them - no record, and no `cancelled` run the concurrency group queued out - so each one never started:

| day (UTC) | slots | scheduled runs | manual runs | slots with no run (never started) | slots queued out |
| --- | ---: | ---: | ---: | --- | --- |
| 2026-09-01 | 1 | 1 | 1 | - | - |
| 2026-09-02 | 8 | 5 | 1 | 00:17, 06:17, 12:17 | - |
| 2026-09-03 | 8 | 5 | 1 | 00:17, 06:17, 12:17 | - |
| 2026-09-04 | 8 | 5 | 0 | 00:17, 06:17, 12:17 | - |
| 2026-09-05 | 8 | 6 | 0 | 00:17, 06:17 | - |
| 2026-09-06 | 8 | 5 | 0 | 00:17, 06:17, 12:17 | - |
| 2026-09-07 | 6 | 2 | 0 | 00:17, 06:17, 09:17, 15:17 | - |
