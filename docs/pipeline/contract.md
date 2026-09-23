# Pipeline shape: the data contract

The design note for the 2027 pipeline: DECISIONS #41-#48, in the detail a
pull request needs. Written 2026-09-22, before any of it is built. The
evidence is `history-2026.md`, beside this file, and
`docs/venues/census-2026.md`, and every number here names the section it
comes from. Where an entry has the detail, this note points at it rather
than saying it twice. What the note does not settle is under Open, at the
end. A change of meaning here is a decision: log it in DECISIONS.md and
update this file in the same PR.

## The files

A year's files live in `data/<year>/`, one writer each (#42). The year is
`--year` on the pipeline and `DC_YEAR` at the client build; there is no
pointer file.

| file | written by | read by | what it holds |
|---|---|---|---|
| `season.json` | a person | every stage; the workflow's season-window guard | The year's settings, below. |
| `venues.json` | a person | build's venues step; the client, imported at its build (#27) | Hotels, levels, rooms, aliases and the walk, below. |
| `source.json` | fetch | the merge, for tag and build; fetch's next run, for the rows it carries; the diff, for a code cause | The raw rows and the failures, below. |
| `ids.jsonl` | the ids stage | the merge; the ids stage's next run; the diff | The ledger, below. |
| `tags.cache.jsonl` | the tag stage | build; the tag stage's next run | One answer per input, as names (#34). |
| `events.v2.json` | the orchestrator, after the diff: build's file, with the diff's `changed_at` | the client; the diff; census v2, on demand | The v2 file, below. |
| `changes.jsonl` | the orchestrator, after the diff: the diff's lines | the mirror and the push job (Identity and sync); a windowed copy for the client (Delivery) | The change log, below. |
| `last-run.json` | the orchestrator, after the diff | build, for `fetched_at` after `--from`; CI, for the stamps and `changes_logged` | The stamps and the summary of the last run that committed, below. |
| `drawings/` | a person | the building view (#28); never the resolver | One file per hotel level, keyed by level and room ids (#45). |

`data/registry/` is unchanged (#42): cross-year, edited by people, and
added to by the tag stage's mint, whose rows now carry
`minted: {year, run}` (#46).

2026 is frozen (#46). Its raw file is `data/2026/events.json` (#13), which
nothing writes, and it has no `source.json`, `ids.jsonl`, `changes.jsonl`
or `last-run.json`. PR 2 writes its `season.json` and `venues.json`, and
PR 6 rebuilds its `events.v2.json` in the 2027 shape (ROADMAP).

## The raw row: `source.json`

The fetch's output (#41, #42): one row for every listing the source
serves, before any dedupe, and for every listing it has served this
season and serves no longer. The shape is normalised and the content is
not. The file carries no timestamp of its own, and is compact, with a
line break before each row.

| field | what it holds |
|---|---|
| `source_id` | The source's id for the listing, from its URL. Not our id (#43). |
| `type` | The feed the listing came from: `panel` or `gaming`. |
| `title` | The detail page's title, else the day list's. |
| `day` | The start's date. |
| `start`, `end` | Local time, `YYYY-MM-DDTHH:MM`. |
| `duration_min` | Minutes. |
| `location` | Verbatim. No hotel or room split: that is build's venues step (#45). |
| `description` | The paragraphs, line breaks kept, the text repaired before whitespace is collapsed (#44). |
| `tracks` | As listed. |
| `speakers` | The detail page's Speakers section only, each `{name, role}`. Never derived from the description: the parse step owns the "Additional Panelists:" line (#42). |
| `stale` | `true` on a row carried from the previous file because its detail page failed this run (#42). |
| `removed` | `true` on a row carried from the previous file because the source no longer lists it, its fields frozen at last sight. It clears if the listing returns (#42). |

`failures` lists `{source_id, error}`, one per listing whose detail page
failed. A failed listing with a row in the previous file is carried with
`stale: true`; one without is named here and nowhere else. A listing the
source no longer lists is carried the same way, with `removed: true`, for
the rest of the season or until it returns.

What left the row (#42): `hotel` and `room` are the venues step's (#45);
`track` is build's, the first of the sorted `tracks`; and `cancelled` is
the parse step's reading of the title and description, under the same
name on the v2 event. 2026's `events.json` differs in shape by design: it
is merged, split and tagged.

## The merge

The one place a group of rows becomes an event (#44): a pure function of
`source.json` and `ids.jsonl`, which the tag stage and build both call.
The ledger says which rows are one event - the rows whose `source_id` is
in one line's `source_ids` (#43) - and the merge makes them one. The
group's rows sort by source id, in string order, which is the fix the
history report proposes (section 6); then:

- The smallest supplies every scalar field.
- `tracks` and `speakers` are the unions, taken in that order, so a group
  gives the same lists on every run.
- `description` is the longest, a tie going to the first in that order.

The tag stage's input is the merged title, type, tracks and description,
read as `tag_stage.tagger_input` reads an event (#34). Build calls the
merge first.

## The ledger: `ids.jsonl`

One line per id, sorted by id (#43). Only the ids stage writes it, and no
line is deleted in season. It exists, empty, from the season's first
commit.

| key | what it holds |
|---|---|
| `id` | The event's id: its source id at first sight, forever. A copy that leaves the group whose id is its own source id takes `<source_id>.<n>`, with n counting up from 1: the one id that is not a bare source id. |
| `source_ids` | The source ids that map to this id now, listed this run or not. A source id is in one line's `source_ids` at most, and resolution reads these alone. |
| `left` | The source ids that once mapped here and now map to another id, each with the id it went to. |
| `dupe_key` | The normalised title, the start and the normalised location, at last sight. |
| `first_seen` | The stamp of the run that first saw the id. |
| `gone_since` | The stamp of the run since which none of its source ids is listed, or since it was merged into another id. |
| `merged_into` | Where two ids collided on a dupe key: the id that survived. |

There is no `last_seen`. The rules that write a line - a group's id, a
copy that leaves, two ids that collide, the one match - are #43's, and so
are the ids stage's fatal conditions.

## The v2 file: `events.v2.json`

#38's shape - `generated_at`, `changed_at`, `source`, `count`, `failures`,
`works`, `events` - plus `digest` (#42). Compact, with a line break before
each event.

| key | what it holds |
|---|---|
| `generated_at` | `last-run.json`'s `fetched_at`: the schedule is as of that fetch, and a `--from` run keeps it (#42, #44). |
| `changed_at` | `last-run.json`'s `changed_at`: the stamp of the last run that moved the digest, set by the diff (#47). A retag moves it with no line in the change log. |
| `source` | `season.json`'s base URL. |
| `count` | The length of `events`. |
| `failures` | `source.json`'s list. |
| `digest` | The sha256 of the canonical JSON of `{works, events}`, made as the tag cache's key is (#34): no timestamps, no failures. The worker's input for a new-schedule notice (ROADMAP, Held). |
| `works` | #38's block. |

An event is the merged row's fields, then these, each from its owner:

| key | owner | what it holds |
|---|---|---|
| `id` | the ids stage (#43) | Ours. |
| `source_id` | the ids stage (#43) | The source's id. The client uses it for any link out to the source. |
| `stale` | fetch (#42) | `true` where the event's row was carried because its detail page failed. |
| `removed` | fetch (#42); the ids stage (#43) | `true` on an event whose listing the source no longer lists, its row carried with its fields frozen at last sight, or on an id merged into another (#43). It clears if the listing returns. Kept all season; the client filters it out everywhere but Mine and Now. |
| `hotel`, `room` | the venues step (#45) | The hotel, and the room as the location writes it, for display. |
| `level` | the venues step (#45) | The level's id, where one is known. |
| `rooms` | the venues step (#45) | Room ids: the room strings as `venues.json` writes them, scoped to the hotel. |
| `place` | the venues step (#45) | How the place was found: `exact` \| `rule` \| `alias` \| `level` \| `hotel` \| `none`. |
| `track` | build (#42) | The first of the sorted `tracks`. |
| `cancelled` | the parse step (#42) | Its reading of the title and description. |
| `people`, `facets`, `tags` | the parse step and build | As `docs/discover/schema-v2.md` has them. An event the tag stage could not answer carries no `tags`: untagged is a state, counted, and the client handles the absence (#46). |

Inside build, in order: the merge; the venues step (#45); the parse step,
for `people`, `facets` and `cancelled`; resolution, through the registries
and the cache; then the works block and the digest. Build is a pure
function of committed inputs, and never reads its own previous output
(#42).

2026's file is rebuilt in this shape (ROADMAP, PR 6), so the client reads
one shape. Its `id` and `source_id` are both the frozen file's `id` (#13),
and its place fields come from `data/2026/venues.json`.

## The change log: `changes.jsonl`

Append-only, one line per change to an event, sorted by run, id and kind
(#47). A line holds the run's stamp (`run`), the SHA of the code that ran,
the event's `id`, the `kind`, `from` and `to`, and the `cause`.

| kind | `from` and `to` |
|---|---|
| `added`, `removed`, `restored` | - |
| `cancelled`, `uncancelled` | - |
| `time` | `start` and `end` |
| `place` | `hotel` and `room` |
| `title` | the title |
| `people` | the set of person ids |
| `tracks` | the set of track names |
| `description` | none: the line says only that it changed |

There is no line for tags, for an order alone, for a stale carry-forward
or for a change of group membership. The first run records every event as
`added`.

`cause` is `source` or `code`. When the run's SHA differs from the previous
run's, the diff builds the previous `source.json` with the new code, in
memory - writing nothing, and leaving a cache miss untagged - and splits
the diff exactly; otherwise every line is `source`. The three `cancelled`
flags a parser change flipped in 2026's v9 (history section 5) are the
kind of change it now calls `code`.

## `season.json`

By hand, one a year (#44, #46):

- the year;
- the source: its slug (2026: `dragoncon26`) and its base URL;
- the source's day strings (2026: `Sep  2` to `Sep  7`, two spaces before
  a one-digit day);
- the con's first and last day, and the time zone;
- the cron window, outside which the workflow's guard exits 0 (#48);
- `PROMPT_VERSION` (2026: 1), which a season never bumps, and `frozen`
  (#46);
- the thresholds: the listings floor, 80% of the previous `source.json`'s,
  its removed rows aside (#44); the ceiling on failed detail fetches, 20%
  (#44); the ceiling on new ids in a run after the first, 20% (#43);
- the request cap, 40 requests a run by default (#46).

## `venues.json`

By hand, one a year, runtime data only (#45). The resolver's rules - the
split, the grammar, the Mart - are #45's.

- **A hotel:** its keys (the prefixes the source writes, matched longest
  first), `short`, `group`, `order`, `placeless` (Streaming and Other),
  and its levels.
- **A level:** an id unique within its hotel, its rooms, its aliases and
  its notes.
- **A room:** its id is its string as `venues.json` writes it, unique
  within the hotel.
- **An alias:** an exact string, case-folded and whitespace-collapsed, to
  room ids on its level. A numeral style is an alias, never a rule, and an
  alias beats the grammar.
- **The walk:** the matrix, verbatim from `src/venues.js`;
  `same_venue_min` 5; `unknown_pair_min` 12; and `slack_min`, the
  tight-connection slack (#40), which starts at 10, data, tuned later.

Validation, fatal: hotel keys unique across hotels; level ids and room ids
unique within a hotel; every alias naming rooms on its level; every walk
pair among hotels that are not placeless present, or the default used and
listed; the slack present. CI loads the committed file and validates it.

The drawings are not in it: they live under `data/2027/drawings/`, one file
per hotel level (#45).

## `last-run.json`

The orchestrator's, written with each commit; a run with no change writes
nothing and reports through the job summary (#44). It holds two stamps:
`fetched_at`, set only by a run that fetched, which is `events.v2.json`'s
`generated_at`; and `changed_at`, set by the diff when the digest moves.
Then the summary of the last run that committed: `changes_logged`, the
lines it added to the change log (#47), and its counters, one per
degradation #44 enumerates:

| counter | what it counts, and where |
|---|---|
| detail pages failed | Rows carried with `stale: true`, each named (fetch). |
| listings gone | Rows carried with `removed: true` (fetch). |
| texts repaired | Texts the repair changed (fetch). |
| UNSURE matches | Candidates looser than #43's one rule, and merges of two ids (the ids stage). |
| hotels unknown | Locations no hotel key matches, placed at Other with the unknown-pair walk (build). |
| rooms unresolved | Rooms placed at their level, or at their hotel (#28; build). |
| events untagged | The model unreachable, rate-limited or malformed after one retry (tag), and cache misses (build). |
| mints failed | A mint that failed: its links drop for this run (tag). |
| work names unresolved | Links dropped for this run (build). |
| tracks unknown | Tracks `tracks.json` lacks: no track axes, and listed as owed (build, #46). |

A counter above zero becomes a warning annotation on the workflow (#48).
The same counts on 2026's build are held at zero by a CI test (#44).

## The stages

Five stages, in this order (#44). `--from <stage>` starts at any of them,
and a run is idempotent after fetch. One stamp a run, taken as it starts
and handed down: a run that fetches records it as `fetched_at`, and a
`--from` run keeps the last one as `generated_at`.

| stage | reads | writes | fatal | degraded |
|---|---|---|---|---|
| fetch | `season.json`; the previous `source.json` | `source.json` | no listings; listings under 80% of the previous file's, its removed rows aside; over 20% of the detail fetches failed; every detail page parsing to an empty title | a failed detail page; a listing gone; a repaired text |
| ids | `source.json`; `ids.jsonl`; `season.json` | `ids.jsonl` | the ledger absent; a source id in two lines' `source_ids`; over 20% new ids in a run after the first | an UNSURE match candidate or merge |
| tag | the merge; the cache; the registries; `season.json` | the cache; `works.json`, by mint | a registry failing validation | the model unreachable, rate-limited or malformed after one retry; a mint that fails |
| build | the merge; `venues.json`; the registries; the cache; `season.json`; the run's `fetched_at`, or `last-run.json`'s after `--from` | `events.v2.json`, in memory | `venues.json` or a registry failing validation; any exception; its two builds in memory differing | a hotel unknown; a room unresolved; a cache miss; a work name unresolved; a track unknown |
| diff | the previous and the new `events.v2.json`; `ids.jsonl`; the previous `source.json`, for a code cause | the change lines and `changed_at`, in memory | the previous `events.v2.json` unreadable, unless it is absent and the ledger empty | - |

After the diff the orchestrator writes `events.v2.json`, `changes.jsonl`
and `last-run.json` together, so no file has two writers, and makes the
commit - only when a committed file's bytes change, its own stamp aside
(#44).

## What CI holds, per year

| | a frozen year: 2026 | a live year: 2027 |
|---|---|---|
| `events.v2.json` | Rebuilt from the raw file, the registries, the cache, `season.json` and `venues.json`: equal to the committed file (#34, #46). | Rebuilt from `source.json`, `ids.jsonl`, the registries, `venues.json`, the cache and `season.json`, its two stamps read from `last-run.json`, not from the file it checks: equal to it, byte for byte (#42). |
| census v2 | Rendered afresh: equal to the committed report (#35). | Not held; run on demand (#46). |
| `venues.json` | Loads and validates (#45). | Loads and validates (#45). |
| `changes.jsonl` | - | `last-run.json`'s `changes_logged` against the log's last stamp; every id the log names in `events.v2.json`; each commit's log beginning with the last commit's (#47). |
| the counters | Held at zero on 2026's build (#44). | - |
| writes | The raw file refused; the derived files rebuilt by an explicit command, never by a run (#46). | A run's, when it commits (#44). |

The fixture tests of #47 - every kind, the attribution, append-only, the
order - run whatever the year.

What CI cannot check:

- The source. CI has none (#42), so the fetch, its thresholds and the
  repair meet the source only in a run.
- The model. CI has no key (#33): whether an answer is right.
- The ledger's history. `ids.jsonl` records every match a season made, and
  nothing CI holds can re-derive it; the replay of 2026 is its check
  (#43).
- A past line's cause, which needed that run's code (#47).
- The curation: whether an alias, a room or a walk time is true.

## Open

- The key order in each file; whether a key that holds nothing - `false`,
  an empty list - is written; and the names the entries do not give: the
  top level of `source.json`, the SHA's key in a change line, the entries
  of `left`, the fields of `season.json` and `last-run.json`'s counters.
  Each is the writing PR's.
- A group whose rows are partly carried as removed. The smallest row
  supplies every scalar, `removed` among them, so a group whose smallest
  row is carried as removed reads as removed, with that row's frozen
  fields, while another of its rows is still listed: a copy that left a
  dedupe group, or the James Callis sessions once #43's match joins their
  vanished source ids, which sort first, to the ones they came back under
  (history section 5).
- A merged-away id (#43). Its source ids move to the survivor, so no row
  is left to carry its fields as a removed listing's row carries them; yet
  #43 removes its event as a dropped one's, and #47 wants every id the log
  names in `events.v2.json`.
