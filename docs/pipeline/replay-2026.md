# Replay - the ids stage over the 2026 schedule on `main`

Written by `tools/replay_2026.py` from `main` at `e578dd4`: the ids stage (`ids_stage.assign`, DECISIONS #43, `docs/pipeline/contract.md`, The ledger) run over every version of the 2026 schedule that `tools/schedule_history.py` reads, oldest first. Do not edit it by hand; run the script again.

A record, not held fresh by CI: a shallow checkout has no history, and the history will not change. Each version's events become raw rows - `id` the `source_id`, the ten fields as they are - and are carried against the version before as the fetch carries them (`scraper.carry`): an event a version no longer holds is carried with `removed: true`, all season. The version's `generated_at` is the run's stamp, the thresholds are `data/2026/season.json`'s, and the ledger is threaded from version to version through `ids.jsonl` in a temp folder, never under `data/`. Ids are compared as strings, as the ledger sorts them.

The copy groups are counted on v4's rows, the last version that holds copies: the frozen file, v34, holds none, nor does any version from v5 on. Grouped as the ids stage groups raw rows, by the title, the start and the location, v4 holds 146 groups and 192 collapses - the same groups the room-keyed dedupe made of its events.

## 0. Headline

1. Versions: 34 of 34 replayed. The last version read holds 3,672 rows, 213 of them carried removed.
2. The frozen file's ids against ours: 2 of 3,459 differ (section 1).
3. Named checks: 6 of 6 pass (section 2).
4. Across the versions: 3,478 new ids, 3,428 of them in v1; 2 matches by rule c; 0 merges; 0 leavers; 24 lines gone and 5 returned; 2 UNSURE pairs (sections 3 and 4).
5. The final ledger: 3,478 lines, 19 of them gone (section 5).

## 1. The frozen file's ids against ours

Every event of the frozen file, v34, whose id the final ledger gives differently: its id there, which is its source id, then ours, and how it came by ours.

| frozen id | event | ours | how |
| --- | --- | --- | --- |
| `e7a143f7f9a04b9580c1b55cffd71723` | `Photo Session: Photo session: James Callis Solo` - 2026-09-04T13:50 - `Marriott International Hall South` | `1e3995157984a4c0e6515a2ed63a1127` | v9: rule c matched it to the line of `1e3995157984a4c0e6515a2ed63a1127`, first seen in v1, gone since v2, on an equal key |
| `f1a3341fc863c0a3f635d819c7ac9d19` | `Photo Session: Photo session: James Callis Solo` - 2026-09-05T15:20 - `Marriott International Hall South` | `1e3995157984a4c0e6515a2ed636a1d6` | v9: rule c matched it to the line of `1e3995157984a4c0e6515a2ed636a1d6`, first seen in v1, gone since v2, on an equal key |

Expected: exactly the sessions matched across their gap (section 2, check 1), ours keeping the earlier ids - **pass**.

## 2. Named checks

DECISIONS #43's verification, each case named from `docs/pipeline/history-2026.md` (sections 4 and 5).

1. **Pass.** Matched across the gap by rule c.
   - `Photo Session: Photo session: James Callis Solo` - 2026-09-05T15:20 - `Marriott International Hall South`: `f1a3341fc863c0a3f635d819c7ac9d19` took `1e3995157984a4c0e6515a2ed636a1d6` in v9, first seen in v1, gone since v2
   - `Photo Session: Photo session: James Callis Solo` - 2026-09-04T13:50 - `Marriott International Hall South`: `e7a143f7f9a04b9580c1b55cffd71723` took `1e3995157984a4c0e6515a2ed63a1127` in v9, first seen in v1, gone since v2
2. **Pass.** Kept their ids through their absences, and returned.
   - `Photo Session: Photo session: Tom Welling Solo` - 2026-09-06T14:50 - `Marriott International Hall South`: gone in v14, back in v15, under `1e3995157984a4c0e6515a2ed632d105` throughout
   - `Onesie Wednesday` - 2026-09-02T23:00 - `Marriott Marquis`: gone in v2, back in v3, under `4f5d40b3cfde6b85b4ccbfe2be9a09bf` throughout
   - `On the Mothman Trail` - 2026-09-04T16:00 - `Courtland Grand Athens`: gone in v12, back in v19, under `c32d19e7750818e0eb903f152ac55882` throughout
3. **Pass.** New at both appearances, with an UNSURE line naming the part that differs.
   - `Hazbin Hotel Cast` - 2026-09-06T16:00 - `Hilton Salon` → `Meet the Hellaverse Cast` - 2026-09-06T16:00 - `Hilton-Salon`: new in v7, as `6ecc75745a676d39f230055623a24fa5` went; UNSURE, the title differs, the locations (`hilton salon`, `hilton-salon`) agreeing once space, comma and hyphen are read alike
   - `Meet the Hellverse Creator!` - 2026-09-04T19:00 - `Hilton Salon` → `An Hour with Georgie Leahy` - 2026-09-04T19:00 - `Hilton-Salon`: new in v7, as `6ecc75745a676d39f230055623a25d94` went; UNSURE, the title differs, the locations (`hilton salon`, `hilton-salon`) agreeing once space, comma and hyphen are read alike
4. **Pass.** The copy groups of v4 hold one id each from their first appearance, so v5 changes nothing.
   - v4: 146 groups, 192 collapses; every group held one id, its smallest source id, from its first appearance
   - v5, which holds no copies, moves no id and reports nothing
5. **Pass.** No merge, no leaver, no fatal rule in any version.
   - Merges 0, leavers 0; no fatal rule tripped.
6. **Pass.** Every id of the frozen file is in the final ledger.
   - 3,459 of 3,459 are in a line's `source_ids`.

## 3. Version by version

`rows` is the version's raw rows, the removed ones carried among them; `groups` its live groups; the rest is the ids stage's report for the run, and `lines` the ledger after it.

| v | commit | class | stamp | rows | removed | groups | new | matched | merged | leavers | gone | returned | UNSURE | lines |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v1 | `aec5f18` | other | 2026-09-01T18:29:46+00:00 | 3,574 | 0 | 3,428 | 3,428 | 0 | 0 | 0 | 0 | 0 | 0 | 3,428 |
| v2 | `21105aa` | scrape | 2026-09-01T21:33:33+00:00 | 3,658 | 6 | 3,460 | 38 | 0 | 0 | 0 | 6 | 0 | 0 | 3,466 |
| v3 | `9f1415e` | scrape | 2026-09-01T23:40:00+00:00 | 3,659 | 5 | 3,462 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 3,467 |
| v4 | `3150aa8` | tag | 2026-09-01T23:40:00+00:00 | 3,659 | 5 | 3,462 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,467 |
| v5 | `52692ff` | other | 2026-09-02T11:28:08+00:00 | 3,659 | 197 | 3,462 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,467 |
| v6 | `787744d` | scrape | 2026-09-02T16:56:41+00:00 | 3,659 | 200 | 3,459 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 3,467 |
| v7 | `8750dd8` | scrape | 2026-09-02T21:16:20+00:00 | 3,661 | 202 | 3,459 | 2 | 0 | 0 | 0 | 2 | 0 | 2 | 3,469 |
| v8 | `49ae9dc` | scrape | 2026-09-02T23:40:39+00:00 | 3,661 | 204 | 3,457 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 3,469 |
| v9 | `702a766` | scrape | 2026-09-03T04:00:01+00:00 | 3,664 | 204 | 3,460 | 1 | 2 | 0 | 0 | 0 | 2 | 0 | 3,470 |
| v10 | `af7dbda` | scrape | 2026-09-03T04:53:56+00:00 | 3,664 | 207 | 3,457 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 3,470 |
| v11 | `f7e3c97` | tag | 2026-09-03T04:53:56+00:00 | 3,664 | 207 | 3,457 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,470 |
| v12 | `8ffbae3` | scrape | 2026-09-03T11:33:11+00:00 | 3,666 | 208 | 3,458 | 2 | 0 | 0 | 0 | 1 | 0 | 0 | 3,472 |
| v13 | `2e6ae84` | scrape | 2026-09-03T16:46:50+00:00 | 3,666 | 208 | 3,458 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,472 |
| v14 | `ca9a98b` | scrape | 2026-09-03T21:24:59+00:00 | 3,666 | 209 | 3,457 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 3,472 |
| v15 | `aed3530` | scrape | 2026-09-03T23:39:21+00:00 | 3,666 | 208 | 3,458 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 3,472 |
| v16 | `1b6dcf5` | scrape | 2026-09-04T04:53:43+00:00 | 3,667 | 211 | 3,456 | 1 | 0 | 0 | 0 | 3 | 0 | 0 | 3,473 |
| v17 | `b457a33` | scrape | 2026-09-04T11:37:14+00:00 | 3,669 | 211 | 3,458 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 3,475 |
| v18 | `53f5f6d` | scrape | 2026-09-04T16:42:19+00:00 | 3,669 | 211 | 3,458 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,475 |
| v19 | `6b2cf0a` | scrape | 2026-09-04T21:08:18+00:00 | 3,671 | 210 | 3,461 | 2 | 0 | 0 | 0 | 0 | 1 | 0 | 3,477 |
| v20 | `6b923bb` | scrape | 2026-09-04T23:24:29+00:00 | 3,671 | 210 | 3,461 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,477 |
| v21 | `c6138ce` | scrape | 2026-09-05T04:46:57+00:00 | 3,671 | 210 | 3,461 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,477 |
| v22 | `b1b9452` | scrape | 2026-09-05T10:53:57+00:00 | 3,671 | 210 | 3,461 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,477 |
| v23 | `a5bcf86` | scrape | 2026-09-05T15:33:39+00:00 | 3,671 | 210 | 3,461 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,477 |
| v24 | `592e6cc` | scrape | 2026-09-05T17:42:25+00:00 | 3,671 | 211 | 3,460 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 3,477 |
| v25 | `7ee4cdc` | scrape | 2026-09-05T20:40:14+00:00 | 3,672 | 211 | 3,461 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 3,478 |
| v26 | `0114506` | scrape | 2026-09-05T23:14:39+00:00 | 3,672 | 211 | 3,461 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,478 |
| v27 | `9839810` | scrape | 2026-09-06T04:58:37+00:00 | 3,672 | 211 | 3,461 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,478 |
| v28 | `165aca7` | scrape | 2026-09-06T11:14:38+00:00 | 3,672 | 211 | 3,461 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,478 |
| v29 | `fc0b2d1` | scrape | 2026-09-06T15:48:29+00:00 | 3,672 | 211 | 3,461 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,478 |
| v30 | `e35ec51` | scrape | 2026-09-06T20:44:56+00:00 | 3,672 | 211 | 3,461 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,478 |
| v31 | `3891855` | scrape | 2026-09-06T23:14:15+00:00 | 3,672 | 213 | 3,459 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 3,478 |
| v32 | `f61e296` | scrape | 2026-09-07T05:01:46+00:00 | 3,672 | 213 | 3,459 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,478 |
| v33 | `5dff70d` | scrape | 2026-09-07T12:50:19+00:00 | 3,672 | 213 | 3,459 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,478 |
| v34 | `290464f` | other | 2026-09-07T12:50:19+00:00 | 3,672 | 213 | 3,459 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,478 |

## 4. UNSURE pairs

A line gone in a run against an id new in it, their keys agreeing on two of the three parts at least, the location read with a space, a comma and a hyphen alike (`contract.md`, The ledger). The match never reads it so.

- v7 `8750dd8`: gone `6ecc75745a676d39f230055623a24fa5` `Hazbin Hotel Cast` - 2026-09-06T16:00 - `Hilton Salon`; new `a3b6e0b83be4882de2e8a2170733de54` `Meet the Hellaverse Cast` - 2026-09-06T16:00 - `Hilton-Salon`: the title differs, the locations (`hilton salon`, `hilton-salon`) agreeing once space, comma and hyphen are read alike.
- v7 `8750dd8`: gone `6ecc75745a676d39f230055623a25d94` `Meet the Hellverse Creator!` - 2026-09-04T19:00 - `Hilton Salon`; new `e69d501c2d69b4f93b5313149141b03e` `An Hour with Georgie Leahy` - 2026-09-04T19:00 - `Hilton-Salon`: the title differs, the locations (`hilton salon`, `hilton-salon`) agreeing once space, comma and hyphen are read alike.

## 5. The final ledger

3,478 lines: 3,459 live, 19 gone, 0 of those merged away. Ids that are not a bare source id: 0. Lines with a `left` record: 0.

The lines gone at the end, each with the version it went in:

- `1e3995157984a4c0e6515a2ed6332791` `Photo Session: Photo session: Isaac Ordonez Solo` - 2026-09-06T14:10 - `Marriott International Hall South`: gone since v6
- `1e3995157984a4c0e6515a2ed6332a8f` `Photo Session: Photo session: Evie Templeton Solo` - 2026-09-06T14:10 - `Marriott International Hall South`: gone since v6
- `1e3995157984a4c0e6515a2ed633e6f7` `Photo Session: Photo session: John Billingsley Solo` - 2026-09-06T12:50 - `Marriott International Hall South`: gone since v16
- `1e3995157984a4c0e6515a2ed6348ee1` `Photo Session: Photo session: Wednesday` - 2026-09-06T14:10 - `Marriott International Hall South`: gone since v6
- `1e3995157984a4c0e6515a2ed638054b` `Photo Session: Photo session: John Billingsley Solo` - 2026-09-05T12:30 - `Marriott International Hall South`: gone since v16
- `1e3995157984a4c0e6515a2ed639632d` `Photo Session: Photo session: John Billingsley Solo` - 2026-09-04T16:00 - `Marriott International Hall South`: gone since v16
- `1e3995157984a4c0e6515a2ed639b2ac` `Photo Session: Photo session: Hazbin Hotel` - 2026-09-04T15:00 - `Marriott International Hall South`: gone since v8
- `1e3995157984a4c0e6515a2ed639b88f` `Photo Session: Photo session: Vivienne Medrano Solo` - 2026-09-04T15:00 - `Marriott International Hall South`: gone since v8
- `1e3995157984a4c0e6515a2ed63a44af` `Photo Session: Photo session: Tom Welling Solo` - 2026-09-04T17:50 - `Marriott International Hall South`: gone since v2
- `1e3995157984a4c0e6515a2ed63a6714` `Photo Session: Photo session: Smallville` - 2026-09-04T17:40 - `Marriott International Hall South`: gone since v2
- `1e3995157984a4c0e6515a2ed63b5d03` `DCTV Interview and DCTV Tries segment` - 2026-09-04T12:00 - `Hyatt Grand Hall Main Floor`: gone since v10
- `6ecc75745a676d39f230055623782e8d` `X-Men '97 Guests` - 2026-09-07T10:00 - `Marriott Atrium Ballroom`: gone since v31
- `6ecc75745a676d39f230055623a10ede` `DCTV Interview - Live Show` - 2026-09-07T08:30 - `Hyatt Centennial II-IV`: gone since v10
- `6ecc75745a676d39f230055623a24fa5` `Hazbin Hotel Cast` - 2026-09-06T16:00 - `Hilton Salon`: gone since v7
- `6ecc75745a676d39f230055623a25d94` `Meet the Hellverse Creator!` - 2026-09-04T19:00 - `Hilton Salon`: gone since v7
- `6ecc75745a676d39f230055623a2ba2f` `Paranormal Caught on Camera: Unseen & Behind the Scenes with Aaron Sagers` - 2026-09-06T17:30 - `Courtland Grand Capitol Ballroom`: gone since v10
- `6ecc75745a676d39f230055623a365af` `An Hour with Scott Adsit` - 2026-09-04T16:00 - `Courtland Grand CG-Grand Ballroom A-F`: gone since v2
- `c32d19e7750818e0eb903f152ac6a446` `The Stars of Farscape: We Don't Say Goodbyes` - 2026-09-07T10:00 - `Westin Peachtree Ballroom`: gone since v24
- `c32d19e7750818e0eb903f152ac6b30b` `Battlestar Galactica: Back on Earth` - 2026-09-07T11:30 - `Hyatt Centennial II-IV`: gone since v31
