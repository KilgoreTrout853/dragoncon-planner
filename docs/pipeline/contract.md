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
PR 6 rebuilds its `events.v2.json` in the 2027 shape (ROADMAP). No ids stage
runs for it: its ids are its source ids (The ledger).

## The raw row: `source.json`

The fetch's output (#41, #42): one row for every listing the source
serves, before any dedupe, and for every listing it has served this
season and serves no longer. The shape is normalised and the content is
not. The file is `{"source", "failures", "rows"}`, in that order: `source`
is `season.json`'s base URL, `failures` is below, and `rows` are sorted by
`source_id`, in string order. It carries no timestamp of its own, and is
compact UTF-8 with LF line ends, a line break before each row and one
after the last. A row's keys are written in the order below; `tracks` and
`speakers` are always written, `[]` where empty, and `stale` and `removed`
only where true.

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
failed, sorted by `source_id`, `error` the exception's text. A failed
listing with a row in the previous file is carried with `stale: true`; one
without is named here and nowhere else. A listing the source no longer
lists is carried the same way, with `removed: true`, for the rest of the
season or until it returns. A row carries one flag at most: a removed
listing that returns is fetched fresh, or is stale when its page fails,
and a stale row whose listing goes is removed.
`scraper.carry(listed, previous)` is that carrying on its own: the
listings a run holds, each with its fresh row or `None` where its page
failed, against the previous file's rows. `fetch()` calls it, and so does
the replay of 2026 (The ledger).

**The repair** is ftfy's `fix_encoding` and no other ftfy transform (#44).
It runs on the page's text before whitespace is collapsed: the title (the
day list's too, which a row takes where its page has none), the location,
each paragraph of the description, each track and each speaker's name. The
source sends some text that was UTF-8 read as cp1252 ("â€“" for "–"), and
some with an "Â" before a no-break space; where that space ends a line,
collapsing strips it, and the "Â" left behind is past repair. Text with
nothing wrong with it passes through as it is, so a clean listing's tagger
input, and its cache key (#34), are unchanged; ftfy's other fixes - curly
quotes, normalisation, HTML entities - would change clean text.

**The fetch's result.** `scraper.fetch(season, previous)` returns one
object, which the run summary reads (#44; PR 8):

| field | what it holds |
|---|---|
| `rows`, `failures` | As the file holds them. |
| `repaired` | The strings on this run's fetched rows that the repair changed: a title, a location, a description (once, however many of its paragraphs), each track and each speaker's name. |
| `listings` | The listings this run: every day list's, or the first `--limit` of them in page order. |
| `fetched` | The detail pages fetched and parsed into a row: `listings` less the failures. |
| `carried_stale`, `carried_removed` | The rows carried from the previous file with each flag. |
| `seconds` | How long the fetch took. |

What left the row (#42): `hotel` and `room` are the venues step's (#45);
`track` is build's, the first of the sorted `tracks`; and `cancelled` is
the parse step's reading of the title and description, under the same
name on the v2 event. 2026's `events.json` differs in shape by design: it
is merged, split and tagged.

## The merge

The one place a group of rows becomes an event (#44): a pure function of
`source.json` and `ids.jsonl`, which the tag stage and build both call.
The ledger says which rows are one event - the rows whose `source_id` is
in one line's `source_ids` (#43) - and the merge makes them one.
Existence is the group's and content a row's. The group's rows sort by
source id, in string order, which is the fix the history report proposes
(section 6); then:

- The event is removed only if every row in it is removed.
- The supplying row is the smallest not removed, or the smallest of all
  when every row is removed. It supplies every scalar field, `source_id`
  and `stale` among them, but one: `type` is `panel` if any row not
  removed is `panel`, reading every row only when every row is removed,
  as 2026's `merge_group` put panel over gaming.
- `source_id` is the supplying row's, so it moves with that row: when the
  supplying row is removed and another is not, the event's `source_id`
  becomes the next row's. #43's match is not the only change to a
  `source_id`.
- `tracks` and `speakers` are the unions of the rows not removed - of
  every row only when every row is removed - taken in that order, so a
  group gives the same lists on every run.
- `description` is the longest of those same rows, a tie going to the
  first in that order.

So the James Callis sessions, whose vanished source ids sort before the
ones they came back under (history section 5), read live, from their new
listings.

The tag stage's input is the merged title, type, tracks and description,
read as `tag_stage.tagger_input` reads an event (#34). Build calls the
merge first.

## The ledger: `ids.jsonl`

The ids stage's file (#43), written by `ids_stage.py`. Only the ids stage
writes it, and no line is deleted in season. It exists, empty, from the
season's first commit. One line per id, sorted by id in string order,
compact UTF-8 with LF line ends and a line break after each line, so an
empty ledger is an empty file. A line's keys are written in the order
below; `left`, `gone_since` and `merged_into` only where set.

| key | what it holds |
|---|---|
| `id` | The event's id: its source id at first sight, forever. A group that leaves a line in a split takes its smallest source id, or `<source_id>.<n>` where that is already an id - the line it left, or one merged away - with n counting up from 1: the one id that is not a bare source id. |
| `source_ids` | The source ids that map to this id now, their rows listed this run or removed, sorted. A source id is in one line's `source_ids` at most, and resolution reads these alone. |
| `left` | An append-only record of the moves out of this line, in the order they were made: each `{source_id, to}`, a source id and the id it went to, in a merge or a split. A source id that later comes back keeps its entry. |
| `key` | The group's key at last sight, `[title, start, location]` as `dupe_key` makes it: the normalised title, the start and the normalised location. |
| `first_seen` | The stamp of the run that made the line. |
| `gone_since` | The stamp of the first run in which every source id of the line sat on a removed row, or in which it was merged into another id. It clears when a source id is live again. |
| `merged_into` | Where two ids collided on a key: the id that survived. The survivor's event lists this line's id in its `was`. |

There is no `last_seen`.

**The rules**, a to f. `ids_stage.assign(rows, ledger, stamp, thresholds)`
applies them in this order, every run, and returns the rows each carrying
its id, the groups, the new ledger and a report:

- **a. Groups.** The live rows - not removed; a stale row is live - group
  by `dupe_key`. A removed row never groups by key: it stays with the line
  its source id maps to.
- **b. A group's id** is the id its members map to, and every member's
  source id maps to it. Where they map to two or more ids, the smallest
  survives, in string order: the others' lines get `merged_into`, and
  their source ids move to the survivor's `source_ids`, each move recorded
  in the losing line's `left`.
- **c. The match.** A group with no id whose key equals a gone line's key -
  every source id of that line on a removed row, and the line not merged
  away - takes that line's id, in the same run or any later one. This is
  the one matching rule, and nothing looser. Where two gone lines hold the
  key, the smaller id takes it.
- **d. New.** Otherwise the group is new, and its id is its smallest
  source id.
- **e. A split** - two or more groups claiming one id - is decided by
  membership: the larger group keeps the id; on a tie, the group whose key
  equals the line's `key` at last sight; on a tie again, the group with the
  smaller smallest source id. Each other group leaves under a new id, as
  `id` above has it, and its source ids move to its new line, recorded in
  the old line's `left`.
- **f. Keys and gone.** A line's `key` becomes its group's whenever a live
  group holds it. A line is gone when every source id in its `source_ids`
  sits on a removed row; `gone_since` is the stamp of the first such run,
  and clears when a source id is live again. `first_seen` is the stamp of
  the run that made the line.

**The key in a split.** Membership comes first, so the side of a split
that keeps the id is the larger one, even where it is the side whose key
moved: of three copies, two renamed together keep the id, and the one that
stayed leaves. The key at last sight only breaks a tie: where a group of
two splits one and one, the copy still at the line's key keeps the id, and
the one that moved leaves - as `<source_id>.1` where its source id was the
line's id.

**Fatal**, as `IdsError`, and nothing is written: the ledger absent, or a
line of it malformed, its line number in the message; a removed row whose
source id no line holds; a source id in two lines' `source_ids` after
assignment; new ids - the new groups' and the leavers' - above `new_ids` ×
the lines before the run, skipped when the ledger was empty.

**The report**: the new ids, the matches by rule c, the merges, the
leavers, the lines gone this run and the lines returned - gone before it
and live after, by whichever rule - and UNSURE: each pair of a line gone
this run, not merged away, and an id new this run whose keys agree on two
of their three parts, with the part that differs. For UNSURE only,
locations are compared after the fold the venues stage applies at a key
boundary - space, comma and hyphen read alike - so the Salon pair (history
section 4, v6 → v7: `Hilton Salon`, then `Hilton-Salon`) shows with the
title as its one differing part; the match itself stays exact on the raw
key. The ids stage reads no hotel keys, so it reads the three alike
wherever they fall in a location, and a pair whose keys agree on all three
parts that way differs in the location's separators alone.

**A frozen year** has no ledger and no ids stage: nothing writes its
`ids.jsonl`, and PR 6's build sets each event's `id` to its `source_id`,
the frozen file's `id` (#13, #46).

**The replay.** `tools/replay_2026.py` runs the stage over the 34
committed 2026 versions, each converted to raw rows and carried as the
fetch carries them, and `replay-2026.md`, beside this file, is the result
(#43): ours differ from the frozen file's ids on the two James Callis
sessions alone, matched across their gap, and the Salon pair is new,
UNSURE by its title.

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
| `source_id` | the merge (#44) | The supplying row's: the source's id, which the client uses for any link out to the source. |
| `stale` | the merge (#44) | The supplying row's: `true` where it was carried because its detail page failed (#42). |
| `removed` | the merge (#44) | `true` when every row of the event is carried as removed, its fields frozen at last sight (#42). It clears when a listing returns. Kept all season; the client filters it out everywhere but Mine and Now. |
| `was` | the ids stage (#43) | The ids merged into this event, from the ledger's `merged_into` lines. The client's pick reconciliation re-points a pick whose id is absent but in an event's `was`. |
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
| `merged` | `to`: the survivor's id; the line's `id` is the id merged away (#43) |
| `time` | `start` and `end` |
| `place` | `hotel` and `room` |
| `title` | the title |
| `people` | the set of person ids |
| `tracks` | the set of track names |
| `description` | none: the line says only that it changed |

There is no line for tags, for an order alone, for a stale carry-forward
or for a change of group membership; two ids merging make a `merged` line,
under the id merged away. The first run records every event as `added`.

`cause` is `source` or `code`. When the run's SHA differs from the previous
run's, the diff builds the previous `source.json` with the new code, in
memory - writing nothing, and leaving a cache miss untagged - and splits
the diff exactly; otherwise every line is `source`. The three `cancelled`
flags a parser change flipped in 2026's v9 (history section 5) are the
kind of change it now calls `code`.

## `season.json`

By hand, one a year (#44, #46). Every key is written, in this order, and
`season.py` refuses a file with a key missing or a key it does not know:

- `year`;
- the source: `slug` (2026: `dragoncon26`) and `source`, its base URL;
- `days`, the source's day strings (2026: `Sep  2` to `Sep  7`, two
  spaces before a one-digit day);
- `con`, `{first, last}`: the con's first and last day, as the client's
  `CON` has them (2026: `2026-09-02` to `2026-09-07`); and `tz`, the time
  zone, a string;
- `window`, `{from, to}`: the cron window, outside which the workflow's
  guard exits 0 (#48); `null` in a frozen year;
- `frozen` (#46), which the fetch reads: it writes nothing into a frozen
  year's folder, and a probe of the source points `--out` outside it; and
  `prompt_version`, `PROMPT_VERSION` (2026: 1), which a season never bumps
  (#46);
- `thresholds`: `listings_floor`, the listings floor, 80% of the previous
  `source.json`'s, its removed rows aside (#44); `detail_failures`, the
  ceiling on failed detail fetches, 20% (#44); `new_ids`, the ceiling on
  new ids, 20%: a run with new ids above `new_ids` × the lines before the
  run is fatal, skipped when the ledger was empty (#43); and
  `requests_per_run`, the request cap, 40 requests a run by default (#46).

Dates are ISO, and a span's first day is not after its last. The three
fractions are in (0, 1], and the cap is a positive whole number.

## `venues.json`

By hand, one a year, runtime data only (#45). The resolver's rules - the
split, the grammar, the Mart - are #45's. Every field is written, and
`venues.py` refuses one it does not know. At the top, in this order:
`walk`, `same_venue_min`, `unknown_pair_min`, `slack_min` and `hotels`, in
their `order`; a hotel's fields and a level's, in the order below.

- **A hotel:** `hotel`, the value the schedule's hotel field holds;
  `name`; its `keys`, below; `short`, `group`, `var` and `order`, as the
  client's `src/venues.js` has them until PR 9; `placeless` (Streaming,
  Other and Unknown); `display`, whether the room shown is the rest of
  the location or the whole of it (`location` for AmericasMart, else
  `rest`); its `levels`; and `unplaced`, each room with no known level
  and its note.
- **Keys:** the prefixes the source writes, matched longest first.
  Hardy Ivy Park's one key is `Hardy`: the source writes
  `Hardy - Terraces`, so its venue token is `Hardy`, and the rest is the
  room - in `Hardy Ivy Structure`, the room is `Ivy Structure`.
- **A level:** `id`, unique within its hotel; `name`; `order`; and its
  `rooms`, `aliases` and `notes`.
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
`venues.py` also refuses, as fatal: a hotel key that is not whole tokens
(single spaces, no comma, no hyphen); an alias not written folded; an
`order` taken twice among the hotels or among a hotel's levels; a walk
pair that is not two hotels of the file; and minutes that are not whole
numbers.

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
| fetch | `season.json`; the previous `source.json` | `source.json` | a day list that fails; no listings; listings under 80% of the previous file's, its removed rows aside; over 20% of the detail fetches failed; every detail page parsing to an empty title | a failed detail page; a listing gone; a repaired text |
| ids | `source.json`; `ids.jsonl`; `season.json` | `ids.jsonl` | the ledger absent or a line of it malformed; a removed row no line holds; a source id in two lines' `source_ids`; new ids above `new_ids` × the lines before the run, skipped when the ledger was empty | an UNSURE match candidate or merge |
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
| `changes.jsonl` | - | `last-run.json`'s `changes_logged` against the log's last stamp; every id the log names in `events.v2.json`, removed or not, or a `merged` line's id; each commit's log beginning with the last commit's (#47). |
| the counters | Held at zero on 2026's build (#44). | - |
| writes | The raw file refused; the derived files rebuilt by an explicit command, never by a run (#46). | A run's, when it commits (#44). |

The fixture tests of #47 - every kind, the attribution, append-only, the
order - run whatever the year.

What CI cannot check:

- The source. CI has none (#42), so the fetch, its thresholds and the
  repair meet the source only in a run.
- The model. CI has no key (#33): whether an answer is right.
- The ledger's history. `ids.jsonl` records every match a season made, and
  nothing CI holds can re-derive it; the replay of 2026, `replay-2026.md`,
  is its check (#43).
- A past line's cause, which needed that run's code (#47).
- The curation: whether an alias, a room or a walk time is true.

## Open

- The key order in each file; whether a key that holds nothing - `false`,
  an empty list - is written; and the names the entries do not give: the
  SHA's key in a change line and `last-run.json`'s counters. Each is the
  writing PR's; PR 2 settled them for `season.json` and `venues.json`, PR 3
  for `source.json` and PR 4 for `ids.jsonl`, above.
