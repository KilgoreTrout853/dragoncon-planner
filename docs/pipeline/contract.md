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

A year's files live in `data/<year>/`, one writer each (#42): the stage
whose output a file is. The orchestrator puts them on disk, every file a
run changed together, at the end of the run, or none (The run, as built).
The year is its season file, `--season data/<year>/season.json` on the
pipeline - #42 wrote `--year`; PR 8 built `--season` - and `DC_YEAR` at the
client build; there is no pointer file.

| file | written by | read by | what it holds |
|---|---|---|---|
| `season.json` | a person | every stage; the workflow's season-window guard | The year's settings, below. |
| `venues.json` | a person | build's venues step; the client, imported at its build (#27) | Hotels, levels, rooms, aliases and the walk, below. |
| `source.json` | fetch | the merge, for tag and build; fetch's next run, for the rows it carries; the attribution build, for a code cause (The diff, as built) | The raw rows and the failures, below. |
| `ids.jsonl` | the ids stage | the merge; the ids stage's next run; the attribution build, for a code cause | The ledger, below. |
| `tags.cache.jsonl` | the tag stage | build; the tag stage's next run; another year's seed | One answer per input, as names (#34). |
| `events.v2.json` | the orchestrator, after the diff: build's file, with the diff's `changed_at` | the client; the diff; census v2, on demand | The v2 file, below. |
| `changes.jsonl` | the orchestrator, after the diff: the diff's lines | the mirror and the push job (Identity and sync); a windowed copy for the client (Delivery) | The change log, below. |
| `last-run.json` | the orchestrator, with each commit | the next run, for its stamps, SHA and `fetch_code_hash`; build's live front door, for the stamps; CI, for the stamps and `changes_logged` | The stamps and the summary of the last run that committed, below. |
| `drawings/` | a person | the building view (#28); never the resolver | One file per hotel level, keyed by level and room ids (#45). |

`data/registry/` is unchanged (#42): cross-year, edited by people, and
added to by the tag stage's mint, whose rows now carry
`minted: {year, run}` (#46).

2026 is frozen (#46). Its raw file is `data/2026/events.json` (#13), which
nothing writes, and it has no `source.json`, `ids.jsonl`, `changes.jsonl`
or `last-run.json`. PR 2 wrote its `season.json` and `venues.json`, and
PR 6 rebuilt its `events.v2.json` in the 2027 shape (ROADMAP). No ids stage
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
`track` is build's, the first of the merged `tracks`; and `cancelled` is
the parse step's reading of the title and description, under the same
name on the v2 event - `parse_stage.is_cancelled`, the rule `scraper.py`
held until PR 6, moved as it was. 2026's `events.json` differs in shape by
design: it is merged, split and tagged.

## The merge

The one place a group of rows becomes an event (#44): `merge_stage.py`'s
`merge(rows, ledger)`, built by PR 6, a pure function of `source.json` and
`ids.jsonl`, which build and the tag stage call (PR 7a). The ledger
says which rows are one event - the rows whose `source_id` is in one
line's `source_ids` (#43), the rows the ids stage hands on each carrying
that line's `id` - and the merge makes them one. The events come in the
order of each id's first row. Existence is the group's and content a
row's. The group's rows sort by source id, in string order, which is the
fix the history report proposes (section 6); then:

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
  group gives the same lists on every run: each row's list in turn, less
  the entries a row before it already has. A speaker is its whole
  `{name, role}` entry, so a person a listing names in two roles stays
  twice, as one 2026 event does; the parse step's `people` still holds one
  entry an id.
- `description` is the longest of those same rows, a tie going to the
  first in that order.
- `was` is the ids merged into this one, directly or through another id
  merged into it - the ledger's `merged_into` lines, followed to the id
  that survived - sorted, and only where there are any: A merged into B
  and B later into C puts both on C's event, where a pick on A lands.

So the James Callis sessions, whose vanished source ids sort before the
ones they came back under (history section 5), read live, from their new
listings. A frozen year's rows are groups of one, and the merge gives each
back as it was.

The tag stage's input is the merged title, type, tracks and description of
each event not removed, read as `tag_key.tagger_input` reads an event
(#34). Build and the tag stage call the merge first.

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

## The cache: `tags.cache.jsonl`

The tag stage's file (#34, #46), one a year, beside `season.json`: one
answer an input, `{key, title, model, answer}` a line in that order,
sorted by key, LF, no timestamps - names, never ids. The key is the sha256
of the canonical JSON of `{"v": prompt_version, "input": ...}`, where
`prompt_version` is the year's `season.json`'s: a season takes no bump, so
an input is asked once a season. A line corrected by hand says
`"model": "hand"` (#34). `tag_key.py` holds what the tag stage sends about
an event (`tagger_input`), the key (`input_key`) and the file's reader and
writer, and imports neither stage: the build reads the cache through it,
and the tag stage imports the build.

### The tag stage, as built

`tag_stage.py` (PR 7a). `--season` names the year, 2026's by default, and
the cache is the one beside it; `--cache` names another, as a pilot's
scratch runs do.

- **The input.** A season's events come through the build's front door,
  `events_v2.season_rows()` - a frozen year's `events.json` by `frozen()`,
  a live year's `source.json`, `ids.jsonl` and `last-run.json` by `live()`,
  with its refusals: run the ids stage first; a live year needs a run -
  and the merge, `merge_stage.merge()`. The inputs are the merged events'
  that are not removed. Read so, 2026's 3,459 events give the 2,580 keys
  they gave before, every one in the cache (`tests/test_tag_stage.py`).
- **The cap.** Only uncached inputs are sent, 25 to a request in (first
  track, title) order, and a run sends at most
  `thresholds.requests_per_run` requests, the retry's among them;
  `--requests N` overrides the cap for a hand run. The mint's parents
  requests are outside it. Every input asked about ends one way: answered;
  capped, not sent, for the cap; stopped, not sent, after
  `STOP_AFTER_FAILURES` requests failed in a row; failed, sent in a request
  the transport failed; or unanswered, sent, with no reply holding a valid
  row for it. An input the retry cannot reach, for the cap or a stop, keeps
  its first way.
- **The result.** `tag()` returns a `TagResult`, which the run summary
  reads (#44; PR 8): the model asked for; the season's inputs, and how many
  were cached before and after; the requests and the inputs sent; and the
  capped, stopped, failed and unanswered. `mint()` adds `minted`, the work
  ids it added - their count its length - `mint_failed`, those a failed
  parents request left unwritten, and `parents_requests`. A hand run exits
  1 on a failed, stopped or unanswered input or a failed parents request,
  and 0 with inputs capped alone, since a later run takes them; the
  orchestrator reads the result, and its own table of the fatal and the
  degraded (#44) decides.
- **Seed.** `tag_stage.py seed --season <season> --from <year>` reads the
  season's merged events through the same front door, keys them under its
  `prompt_version`, and copies the source year's cache lines whose keys
  match - `<year>/season.json` beside the season's folder, and the cache
  beside that - as they are, so a hand line stays a hand line. It copies
  nothing when the two years' `prompt_version` differ, and then reads
  nothing of the source. It reports copied, already present, and skipped -
  the season's keys that neither cache holds, left for the tag stage - and
  the three sum to the season's inputs. It writes the season's cache only
  when it copies. Refused: a frozen season; one with no `source.json`, or
  one its front door refuses; a source season that does not load, or has
  no cache.
- **Frozen.** A season with `frozen: true` runs with `--dry-run` only, the
  report of what would be sent: no request, no cache write, no mint -
  `--dry-run --mint-only` included, which reports what it would mint. The
  refusal names the flag. The frozen flag is the tag stage's;
  `tag_events.py` keeps its path check as legacy.
- **`minted`.** Every row the mint adds to `works.json` carries
  `minted: {"year": <the season's year>, "run": <last-run.json's fetched_at>}`,
  after `reviewed` in the row's key order, and no other row gains it. A
  live year with no `last-run.json` cannot mint by hand: its front door
  refuses. The orchestrator hands the mint its run's `fetched_at`, a
  season's first run's too, and writes the rows with the rest of the run
  (`tag_stage.mint_works`; The run, as built).
  `registry.py` holds `WORK_KEYS`, the one list of a work's keys in their
  order, which the drafter and the mint write in and the review page keeps
  a copy of, held equal by a test; it refuses any other key, and checks
  `minted`: exactly `year`, a whole number, and `run`, an ISO date and time
  with its offset. Resolution ignores it (#46), census v2's band marker
  leaves out a work minted in a later year, and the works block of
  `events.v2.json` never carries it.
- **The season-start sequence.** #46's "a season's first full tag is run
  by hand, before the cron" becomes a sequence the orchestrator owns (PR
  8): a dispatch run to the ids stage (`--to ids`), which leaves
  `source.json`, `ids.jsonl` and `last-run.json`, the front door's inputs;
  then `seed --from` the year before; then the cron, whose runs send 40
  requests each, 1,000 inputs, and finish a season's first tag in about
  three runs, each leaving what the cap left for the next. A hand tag with
  `--requests` set high is optional: `pipeline.py run --from tag --to tag
  --requests <n>`.

## The v2 file: `events.v2.json`

#38's shape plus `digest` (#42), its keys in this order: `generated_at`,
`changed_at`, `source`, `count`, `failures`, `digest`, `works`, `events`.
Compact UTF-8, with a line break before each works row and each event, LF
line ends, and one after the last (PR 6).

| key | what it holds |
|---|---|
| `generated_at` | `last-run.json`'s `fetched_at`: the schedule is as of that fetch, and a `--from` run keeps it (#42, #44). |
| `changed_at` | `last-run.json`'s `changed_at`: the stamp of the last run that moved the digest, set by the diff (#47). A retag moves it with no line in the change log. |
| `source` | `season.json`'s base URL. |
| `count` | The length of `events`, the removed events among them. |
| `failures` | `source.json`'s list. |
| `digest` | The sha256 of the works and the events written exactly as the file writes them: `{"works":[...],"events":[...]}` in the file's one serialisation, compact, a line break before each row - so it can be recomputed from the file's own text - with no timestamps and no failures. Not a canonical sorted-key JSON, which #42's body names (its header note). The worker's input for a new-schedule notice, `generated_at` deciding only where a copy has none (#49). |
| `works` | #38's block. |

An event's keys run in this order: the ten fields of its merged row
(`type` to `speakers`); `id`, `source_id`, `hotel`, `room`, `level`,
`rooms`, `place`, `track`, `cancelled`, `people`, `facets` and `tags`; and
last `removed` or `stale`, then `was`, each only where set. An event the tag
stage could not answer has no `tags` key. Each from its owner:

| key | owner | what it holds |
|---|---|---|
| `id` | the ids stage (#43) | Ours. |
| `source_id` | the merge (#44) | The supplying row's: the source's id, which the client uses for any link out to the source. |
| `hotel`, `room` | the venues step (#45) | The hotel, and the room shown: the location less its hotel's key, or the whole location at a hotel whose `display` is `location` (the Mart). |
| `level` | the venues step (#45) | The level's id, where one is known; else `null`. |
| `rooms` | the venues step (#45) | Room ids: the room strings as `venues.json` writes them, scoped to the hotel. |
| `place` | the venues step (#45) | How the place was found: `exact` \| `rule` \| `alias` \| `level` \| `hotel` \| `none`. |
| `track` | build (#42) | The first of the merged `tracks`, or `null` where there are none. |
| `cancelled` | the parse step (#42) | Its reading of the title and description, `parse_stage.is_cancelled`. |
| `people`, `facets`, `tags` | the parse step and build | As `docs/discover/schema-v2.md` has them. An event the tag stage could not answer carries no `tags`: untagged is a state, counted, and the client handles the absence (#46). |
| `removed` | the merge (#44) | `true` when every row of the event is carried as removed, its fields frozen at last sight (#42). It clears when a listing returns. Kept all season; the client filters it out everywhere but Mine, Now included, and Mine draws a picked one marked (#49). |
| `stale` | the merge (#44) | The supplying row's: `true` where it was carried because its detail page failed (#42). A row carries one flag at most, so an event carries `removed` or `stale`, never both. |
| `was` | the ids stage (#43), through the merge | The ids merged into this event, directly or through another merged id, from the ledger's `merged_into` lines (The merge). The client's pick reconciliation re-points a pick whose id is absent but in an event's `was` (#49). |

The five place fields by `place`, as the venues step (below, under
`venues.json`) sets them:

| `place` | `hotel` | `room` | `level` | `rooms` |
|---|---|---|---|---|
| `exact`, `alias`, `rule` | the hotel | the room shown | the level | the rooms, as `venues.json` writes them |
| `level` | the hotel | the room shown | the level | `[]` |
| `hotel` | the hotel | the room shown; `""` for a bare key | `null` | `[]` |
| `none` | Streaming, Other or Unknown | the room shown; `""` for an empty location | `null` | `[]` |

Inside build, in order: the merge; the venues step (#45); the parse step,
for `people`, `facets` and `cancelled`; resolution, through the registries
and the cache; then the works block and the digest. Build is a pure
function of committed inputs, and never reads its own previous output
(#42).

2026's file is rebuilt in this shape (ROADMAP, PR 6), so the client reads
one shape. Its `id` and `source_id` are both the frozen file's `id` (#13),
and its place fields come from `data/2026/venues.json`, read by the same
venues step from each frozen event's `location`. A frozen year's
top-level fields are its raw file's, copied as they are - `failures` stays
a count, 0 for 2026 - with the digest added; its events carry no
`removed`, `stale` or `was`.

### The build, as built

`events_v2.py` (PR 6). `build(rows, top, reg, cache, venues, ledger=None)`
takes rows that carry our ids, the top-level fields to write, the
registries, the cache, the venues file and, for a live year, the ledger,
and returns the file and a report.

- **The front doors.** `python events_v2.py --season <season.json>`,
  2026's by default: for a frozen year, the explicit command its derived
  file is rebuilt by (#46). A frozen season reads `events.json` beside it:
  each event becomes a raw row whose `id` is its `source_id`, v1's
  `hotel`, `room`, `track`, `cancelled` and `tags` dropped and its
  `location` kept. A live season reads `source.json`, `ids.jsonl` and
  `last-run.json` beside it. `ids_stage.assign()` with the committed ledger
  and the season's thresholds must leave the ledger as it is, or the build
  refuses - run the ids stage first. A fatal rule of the ids stage refuses
  it as well, and so does a missing `last-run.json`, since a live year
  needs a run. A live year's file is the orchestrator's to write (#42,
  #44): `--check` checks it, `--out` outside the year's folder writes a
  copy to look at, and nothing else writes it.
- **Tolerance** (#44). A cache miss ships the event untagged, with no
  `tags` key (#46); a work name the registry cannot resolve drops that
  link; a track `tracks.json` lacks keeps its name, with no axes and no
  track work. A name that is a registry term is dropped, as before. What
  stops a build is ours to fix before any run, as `BuildError`: a
  registry, the venues file or the cache that fails to load, the raw file
  unreadable, a row with no id, and a live year's refusals.
- **The report.** `untagged`, the titles of the events with no cached
  answer; `unresolved_names`, each name and the links it dropped;
  `unknown_tracks`, each track and its events; `terms`, the registry terms
  dropped; the venues step's `places`, `rooms_unresolved` and
  `hotels_unknown`; and what the merge of tags counted. These are the run
  summary's build counters (`last-run.json`, below): events untagged, work
  names unresolved - the links dropped - and tracks unknown, the tracks.
- **The file**: as above. `dumps()` writes it, and the digest is taken of
  that writer's text of the works and the events.
- **Attribution** (PR 7b), `attribution(rows, ledger, reg, cache, venues,
  *, version, thresholds, stamp)`: the previous run's rows through the
  current code, for the diff's causes (The diff, as built). `rows` and
  `ledger` are the previous `source.json` and `ids.jsonl` from the
  orchestrator's snapshot, `stamp` that run's `fetched_at`, and `version`
  and `thresholds` the season's. It runs the ids stage, the merge and the
  build as a live year's build does, writing nothing, a cache miss
  untagged, and returns the digest, the works and the events. The ids
  stage leaves the ledger as it is under unchanged code - it is idempotent
  on its own output - but where the current code regroups the previous
  rows, the build uses the ledger the ids stage returns, in memory, and
  refuses nothing, unlike the live front door: a regrouping the current
  code makes is a code-caused change, and reads as one. A fatal rule of
  the ids stage refuses it, as `BuildError`.

## The change log: `changes.jsonl`

Append-only, one line per change to an event, sorted by run, id and kind
(#47). A line holds the run's stamp (`run`), the SHA of the code that ran,
the event's `id`, the `kind`, `from` and `to`, and the `cause`.

| kind | `from` and `to` |
|---|---|
| `added`, `removed`, `restored` | - |
| `cancelled`, `uncancelled` | - |
| `merged` | `to`: the survivor's id; the line's `id` is the id merged away (#43) |
| `time` | `{start, end}` |
| `place` | `{hotel, room}` |
| `title` | the titles |
| `people` | the sorted person ids: the sets are compared |
| `tracks` | the sorted track names: the sets are compared |
| `description` | none: the line says only that it changed |

There is no line for tags, for an order alone, for a stale carry-forward
or for a change of group membership; two ids merging make a `merged` line,
under the id merged away. The first run records every event as `added`.

`cause` is `source` or `code`. When the run's SHA differs from the previous
run's, the orchestrator builds the previous `source.json` and `ids.jsonl`
with the new code, in memory - writing nothing, and leaving a cache miss
untagged - and hands the diff that document, and each line takes one
cause, `source` winning where the code and the source both changed its
kind; otherwise every line is `source`. The three `cancelled` flags a
parser change flipped in 2026's v9 (history section 5) are the kind of
change it now calls `code`.

### The diff, as built

`diff_stage.py` (PR 7b). `diff(previous, current, *, stamp, sha,
attribution=None)` takes the previous and this run's documents as
`events_v2.build()` returns them - `previous` None on a season's first
run - and returns the lines, `changed_at`, `changes_logged` and the lines
counted by kind and by cause. It is pure: no file, no git and no clock;
the stamp and the sha are arguments. It reads no ledger.

- **The kinds, exactly.** One line per id and kind. `added` is an id
  `previous` does not hold, and its only line, even where `current` carries
  it removed. `removed` and `restored` are the `removed` flag's two ways,
  and `cancelled` and `uncancelled` the `cancelled` flag's; none carries
  `from` or `to`. `time` is `start` or `end` changed, `from` and `to`
  `{start, end}`; `place` is `hotel` or `room` changed, `from` and `to`
  `{hotel, room}` - `level`, `rooms` and `place` alone make no line;
  `title` carries the two titles; `people` compares the sets of person ids,
  `from` and `to` the sorted ids; `tracks` compares the sets of tracks,
  `from` and `to` sorted. `events.v2.json` keeps the merge's order of the
  tracks, and the log compares sets, so an order alone is no change.
  `description` carries neither.
- **merged** is read from the survivors' `was`: an id `previous` holds and
  `current` does not, which a current event's `was` names, is merged into
  that event, `to` its id. `was` names every id merged into its event all
  season, directly or through another; an id `previous` never held was
  logged in the run it left, and is not logged again.
- **The cause.** The caller builds the attribution document: the previous
  run's rows through the current code, `events_v2.attribution()` (The
  build, as built), from the orchestrator's snapshot of the previous
  `source.json` and `ids.jsonl`. A line is `source` where the attribution
  and `current` differ on its kind, and `code` where they agree - an event
  the attribution lacks differs on every kind, and a merged id agrees only
  where the attribution merges it into the same survivor. One cause per id
  and kind: where the code and the source both changed a kind, the line is
  `source`, its `from` and `to` the whole change, previous to current. With
  no attribution - the SHA unchanged - every line is `source`.
- **What attribution cannot see.** It sees the build's code and data - the
  registries, the venues file, the cache and the version - and not the
  fetch's. A change to the fetch's parsing or its repair reaches the raw
  rows themselves, so the previous rows, rebuilt, still read the old way,
  and the change reads as `source`: 2026's v8 → v9 descriptions (303) and
  v4 → v5's seven mojibake titles were such changes. `last-run.json`'s
  `fetch_code_changed` (below) marks such a run.
- **The line** is `{run, sha, id, kind, from, to, cause}`, in that order:
  `from` and `to` only for `time`, `place`, `title`, `people` and `tracks`,
  and `to` alone for `merged`. The lines sort by run, id and kind, in string
  order. `render(lines)` writes them as `changes.jsonl` holds them: one
  compact JSON object a line, UTF-8, LF after each; the orchestrator
  appends the text.
- **`changed_at`** is the run's stamp where `current`'s digest differs from
  `previous`'s, or `previous` is None, and `previous`'s `changed_at`
  otherwise. A digest can move with no line - a retag, a works-block edit,
  or, in a live year, a source that reorders an event's tracks, since a
  group of one keeps the source's order - and `changed_at` moves with it:
  harmless. `changes_logged` is the count of lines.
- **Fatal**, as `DiffError` naming the ids: an id `previous` holds that
  `current` does not and that no current event's `was` names. The ledger
  deletes no line in season (#43), so an event leaves the file by a merge
  or not at all: the input is corrupt, which is not a degradation (#44).
  Reading the snapshot is the orchestrator's, and so is its fatal rule:
  the previous `events.v2.json` there and unreadable. Absent, it is a
  season's first diff, whatever the ledger holds, since a season's first
  run stops after the ids stage (The run, as built).
- **The check** on a live year's committed files, `tests/test_changes_log.py`,
  skipped until a run past the ids stage commits the year's
  `events.v2.json`: the log's last stamp equals
  `last-run.json`'s `changed_at` when `changes_logged` is above zero, and is
  no later when it is zero; every id the log names is in `events.v2.json`,
  removed or not, or is a `merged` line's id; the lines sort. The prefix
  check - each commit's log beginning with the last commit's, byte for
  byte - is the orchestrator's, made as it writes, where the old bytes are
  (The run, as built): CI's checkout is shallow.

## `season.json`

By hand, one a year (#44, #46). Every key is written, in this order, and
`season.py` refuses a file with a key missing or a key it does not know:

- `year`;
- the source: `slug` (2026: `dragoncon26`) and `source`, its base URL;
- `days`, the source's day strings (2026: `Sep  2` to `Sep  7`, two
  spaces before a one-digit day);
- `con`, `{first, last}`: the con's first and last day, which the client's
  `CON` takes its days from (2026: `2026-09-02` to `2026-09-07`; #49); and
  `tz`, the time zone, a string;
- `window`, `{from, to}`: the cron window, outside which the workflow's
  guard exits 0 (#48); `null` in a frozen year;
- `frozen` (#46), which the fetch reads: it writes nothing into a frozen
  year's folder, and a probe of the source points `--out` outside it; and
  `prompt_version`, `PROMPT_VERSION` (2026: 1), the `v` of the tag stage's
  key, which a season never bumps (#46);
- `thresholds`: `listings_floor`, the listings floor, 80% of the previous
  `source.json`'s, its removed rows aside (#44); `detail_failures`, the
  ceiling on failed detail fetches, 20% (#44); `new_ids`, the ceiling on
  new ids, 20%: a run with new ids above `new_ids` × the lines before the
  run is fatal, skipped when the ledger was empty (#43); and
  `requests_per_run`, the tag stage's request cap, 40 requests a run by
  default, which `--requests` overrides for a hand run (#46).

Dates are ISO, and a span's first day is not after its last. The three
fractions are in (0, 1], and the cap is a positive whole number.

## `venues.json`

By hand, one a year, runtime data only (#45). The resolver's rules - the
split, the grammar, the Mart - are #45's, built as the venues step, below.
Every field is written, and
`venues.py` refuses one it does not know. At the top, in this order:
`walk`, `same_venue_min`, `unknown_pair_min`, `slack_min` and `hotels`, in
their `order`; a hotel's fields and a level's, in the order below.

- **A hotel:** `hotel`, the value the schedule's hotel field holds;
  `name`; its `keys`, below; `short`, `group`, `var` and `order`, which the
  client reads, imported at its build (#49); `placeless` (Streaming,
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
- **The walk:** the matrix, migrated verbatim from `src/venues.js`, whose
  constants the client read until #49;
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

**The venues step**, `venues_stage.py` (#45), reads each row's `location`
into the five place fields and a report. Build calls it (PR 6), on raw
rows and on a frozen year's rows alike; it is pure.

- **The split.** The location's leading tokens are matched against every
  hotel's keys, longest key first, whole tokens only and without regard to
  case, and the room string is the rest, after a space, a comma or a
  hyphen; a bare key leaves it empty. No key: Other, the whole location the
  room string, counted as hotels unknown. Empty: Unknown.
- **The reading**, the first that holds winning:
  - a. `alias` - the room string, folded, is an alias of one of the
    hotel's levels: its rooms, on that level.
  - b. `exact` - the room string, case-folded, is a room on one of its
    levels. One of the hotel's unplaced rooms reads `hotel`: the file knows
    it but not where it is, so it is listed apart and not counted as
    unresolved.
  - c. `rule` - a rule of the grammar names rooms that all exist on one
    level. A rule whose rooms are missing, or span two levels, fails, and
    the next is tried.
  - d. `level` - a rule names a level and no room: the Mart's building
    floors and vendor halls, a floor alone. Or, once every rule has failed,
    the rooms the first failed rule did find all sit on one level.
  - e. `hotel` - no reading, or the hotel alone: a bare key, or the hotel's
    own name again. Counted as rooms unresolved, and listed.
  - f. `none` - a placeless hotel: Streaming, Other, Unknown. First its room
    string, less a repeat of its own key
    (`O Other Marriott, Imperial Ballroom`), is split once more against the
    placed hotels' keys, and a match is read at that hotel, as the rule
    `re-split`.
- **The grammar**, in the order it is tried:
  - the three Mart rules: `Building <n>, Floor <m>`, that level;
    `Vendor Hall Floor <n> …`, that vendor-hall level; `20xY …`, that
    Building 2 room, the rest a note;
  - the census's eight combined-string rules: numeric run, roman run, letter
    run, number run, letters together, number and letters, slash list, word
    pair;
  - three rewrites, each read again: doubled; a leading "The"; and the
    hotel's own initials and a hyphen (`H-Piedmont` at the Hyatt, `CG-` at
    the Courtland Grand), nothing else stripping;
  - partitions: the common prefix of two or more rooms on one level, each
    the prefix and a letter, a number or a roman numeral (`Atrium Ballroom`
    is its A to D; `Salon`, whose halves are East and West, waits for an
    alias);
  - the hotel alone;
  - a floor alone, `Nth Floor` or `Floor N`, read as the level named
    `<Ordinal> Floor` or `Level N`;
  - a trailing note: the longest leading run of whole words that is a room.

  Each rule is a function of the string alone, but partitions, which reads
  the level's rooms; the step checks every other rule's rooms and levels
  against the file. A numeral style is an alias, never a rule, and an alias
  beats the grammar.
- **The report:** events by place kind, in total and per hotel; the
  worklist - the strings read at the hotel alone, with why, by events; the
  unplaced rooms; the locations no key begins; the re-split locations; the
  alias hits; and each rule's firings. Its two counters are the run
  summary's venue counters (PR 8): rooms unresolved, the worklist's events,
  and hotels unknown, the no-key locations'. A room placed at its level is
  placed by design, and counts in neither. `tools/room_census.py` renders
  the report over the 2026 schedule as `docs/venues/census-2026.md`.

## `last-run.json`

The orchestrator's, written with each commit, the last of a run's files;
a run with no change writes nothing and reports through the job summary
(#44), so the file always describes the last run that committed. JSON,
indented two spaces, its keys in this order (PR 8):

| key | what it holds |
|---|---|
| `stamp` | The run's stamp: its one read of the clock as it started, UTC, whole seconds. |
| `fetched_at` | The stamp of the last run that fetched: `events.v2.json`'s `generated_at`. A `--from` run keeps it. |
| `changed_at` | The stamp of the last run that moved the digest, the diff's (#47). A run that stops before the diff keeps it; a season's first such run, with none to keep, writes its own stamp, which the build's live front door needs. |
| `sha` | The code's SHA: `PIPELINE_SHA`, the workflow's checkout, or `git rev-parse HEAD`. |
| `fetch_code_hash`, `fetch_code_changed` | Below. |
| `changes_logged` | The lines the run added to the change log (#47); 0 where it stopped before the diff. |
| `digest` | `events.v2.json`'s, as the commit leaves the file; `null` before a season's first build. |
| `season` | The year. |
| `elapsed` | Seconds from the run's start to this file's text. |
| `fetch`, `ids`, `tag`, `build`, `diff` | Each stage's counters, in a block of its own, where the stage ran: a run `--to ids` has no `tag` block, and a run `--from build` no `fetch`. |

The blocks, each counter one of #44's degradations or a count beside them:

- `fetch`: `listings`, `fetched`, `stale` - rows carried with `stale:
  true` - `removed` - rows carried with `removed: true` - `failures`, the
  listings whose detail page failed, carried stale or named alone, and
  `repaired`, the texts the repair changed (The fetch's result).
- `ids`: `new`, `matches` (rule c), `merges`, `leavers`, `gone`,
  `returned` and `unsure`: the report's lists, counted (The ledger).
- `tag`: `requests`, `sent`, `capped`, `failed`, `stopped`, `unanswered`,
  `minted` and `mint_failed`: the `TagResult`'s (The tag stage, as built).
- `build`: `untagged`, the events with no cached answer; `unresolved_names`,
  the links dropped; `unknown_tracks`, the tracks; `rooms_unresolved` and
  `hotels_unknown`, the venue counters; and `places`, the events by place
  kind (The build, as built).
- `diff`: `kinds` and `causes`, the lines by kind and by cause.

| degradation (#44) | its counters |
|---|---|
| detail pages failed | `fetch.failures`, and `fetch.stale`, the rows carried with `stale: true`, each named (fetch). |
| listings gone | `fetch.removed`: rows carried with `removed: true` (fetch). |
| texts repaired | `fetch.repaired`: texts the repair changed (fetch). |
| UNSURE matches | `ids.unsure`, candidates looser than #43's one rule, and `ids.merges`, merges of two ids (the ids stage). |
| hotels unknown | `build.hotels_unknown`: locations no hotel key matches, placed at Other with the unknown-pair walk (build). |
| rooms unresolved | `build.rooms_unresolved`: rooms read at the hotel alone - no reading, or a bare key: the venues step's worklist - but not an unplaced room of the file, and not a room placed at its level, which is by design (build). |
| events untagged | `tag.failed`, `tag.stopped` and `tag.unanswered` - the model unreachable, rate-limited or malformed after one retry - and `tag.capped`, inputs past the cap, left for a later run (tag); `build.untagged`, every event with no cached answer (build). |
| mints failed | `tag.mint_failed`: a mint that failed, its links dropped for this run (tag). |
| work names unresolved | `build.unresolved_names`: links dropped for this run (build). |
| tracks unknown | `build.unknown_tracks`: tracks `tracks.json` lacks: no track axes, and listed as owed (build, #46). |

A counter above zero becomes an annotation on the workflow (#48), in two
kinds (PR 8). A fault is a `::warning::`: `fetch.failures` and
`fetch.stale`; `ids.merges` and `ids.unsure`; `tag.capped`, `tag.failed`,
`tag.stopped`, `tag.unanswered` and `tag.mint_failed`; `build.untagged`,
`build.unresolved_names`, `build.unknown_tracks` and
`build.hotels_unknown`. A curation counter is a `::notice::`:
`build.rooms_unresolved`, 686 on 2026's build, and `fetch.removed` and
`fetch.repaired`, which the carried rows and the repair on every page keep
above zero all season. So a warning stays a fault, and nobody learns to
read past one every hour. A fatal run is an `::error::`.
On 2026's build the tag and track counters - events untagged, work names
unresolved, tracks unknown - are held at zero by a CI test (#44): on a
frozen year they are pipeline faults. The venue counters - hotels unknown,
rooms unresolved - are curation state, reported and never held; PR 6
built the test that way, `tests/test_zero_hold.py`.

**`fetch_code_hash`** (PR 8). The attribution sees the build's code and
data, not the fetch's (The diff, as built). So each run records
`fetch_code_hash`, the sha256 of `scraper.py`, `tag_key.py` and
`requirements.txt`, their bytes one after another, and
`fetch_code_changed: true` where it is not the last committed run's -
`false` on a season's first run. No git diff: the orchestrator's one git
call is `rev-parse HEAD`, and the workflow, which sets `PIPELINE_SHA` from
its checkout, makes none. That run's lines still read as the diff finds
them; the push job reads the flag and suppresses that run. Identity and
sync's design gets the same sentence when it opens.

## The stages

Five stages, in this order (#44). `--from` starts at the ids stage, the
tag stage or the build, and `--to` stops after the fetch, the ids stage or
the tag stage (The run, as built); a run is idempotent after fetch. One
stamp a run, taken as it starts and handed down: a run that fetches
records it as `fetched_at`, and a `--from` run keeps the last one as
`generated_at`.

| stage | reads | writes | fatal | degraded |
|---|---|---|---|---|
| fetch | `season.json`; the previous `source.json` | `source.json` | a day list that fails; no listings; listings under 80% of the previous file's, its removed rows aside; over 20% of the detail fetches failed; every detail page parsing to an empty title | a failed detail page; a listing gone; a repaired text |
| ids | `source.json`; `ids.jsonl`; `season.json` | `ids.jsonl` | the ledger absent or a line of it malformed; a removed row no line holds; a source id in two lines' `source_ids`; new ids above `new_ids` × the lines before the run, skipped when the ledger was empty | an UNSURE match candidate or merge |
| tag | the build's front door and the merge; the cache; the registries; `season.json` | the cache; `works.json`, by mint | a registry failing validation; the rows' ids not the ledger's, or no `last-run.json`, in a live year (The tag stage, as built) | the model unreachable, rate-limited or malformed after one retry; a mint that fails; inputs past the request cap, left for a later run |
| build | the merge; `venues.json`; the registries; the cache; `season.json`; the run's `fetched_at`, or `last-run.json`'s after `--from` | `events.v2.json`, in memory | `venues.json`, a registry or the cache failing to load; a row with no id; the rows' ids not the ledger's, or no `last-run.json`, in a live year (The build, as built); any exception; its two builds differing - the stages', and the live front door's on the texts about to be written (The run, as built) | a hotel unknown; a room unresolved; a cache miss; a work name unresolved; a track unknown |
| diff | the previous `events.v2.json`, from the orchestrator's snapshot, and the new one; for a code cause, the attribution document the orchestrator builds from the snapshot's `source.json` and `ids.jsonl` (The diff, as built) - no ledger | the change lines and `changed_at`, in memory | an event that leaves the file by no merge; reading the snapshot is the orchestrator's, with its rules (The run, as built) | - |

The orchestrator writes every file a run changed, together, at the end,
or none - each file's content one stage's, so no file has two writers -
and the workflow commits them: only when a committed file's bytes change,
the run's own stamp aside (#44; The run, as built).

### The run, as built

`pipeline.py` (PR 8), three commands:

- `run --season <season.json> [--to fetch|ids|tag] [--from ids|tag|build]
  [--limit N] [--requests N] [--force]`: the stages in order, the fetch to
  the diff. `--to` stops after a stage and writes what exists so far - not
  after the build, whose file goes only with the diff's lines and
  `changed_at`. `--from` starts at a later stage and reads what it skips
  from the committed files: the rows from `source.json`; their ids from the
  committed ledger, which must already hold them, through the build's live
  front door (`events_v2.live_inputs`); `fetched_at` from `last-run.json`,
  kept. The run's own stamp goes on its lines and `changed_at`. `--limit`
  is the fetch's and `--requests` the tag stage's cap for the run. Outside
  the season window a run stops before it starts, writing nothing, unless
  `--force`; no run targets a frozen season (#46).
- `window --season <season.json>`: `in window` or `out of window`, exit 0
  either way. The window's dates are the season's local days, read in its
  `tz` through zoneinfo; where that zone cannot be loaded - Windows without
  tzdata - they are compared in UTC, with a warning. A season whose window
  is `null` is always out.
- `summary --format md`: the last run's result object, as the job summary,
  the pull request's body and the commit's body show it.

**The edges**, each in one place. One read of the clock as the run
starts, UTC, to the second, is the run's stamp, handed to every stage, and
a fetch's `fetched_at`. The SHA is `PIPELINE_SHA`, the workflow's checkout,
or else one `git rev-parse HEAD`. The files are read before the first stage
and written after the last: no stage reads a file, the clock or git during
a run. Each is called with its rows, ledgers and stamps as arguments - the
fetch with the previous rows; the ids stage with the ledger; the tag stage
with the season's inputs and the cache, and the mint with no file
(`tag_stage.mint_works`); the build, the attribution and the diff with the
documents - and the front doors that read a season's files are not used.

**The snapshot.** Before any stage, the previous `source.json`,
`ids.jsonl`, `tags.cache.jsonl`, `events.v2.json`, `changes.jsonl` and
`last-run.json`, as bytes, each `None` where absent; a season's first run
has none but its empty ledger. A file that is there and cannot be read is
fatal: the ledger absent or malformed, a `source.json` that is not one or
is another source's, a `last-run.json` or `events.v2.json` that is not
JSON or lacks its keys. An absent `events.v2.json` is not, whatever the
ledger holds: after a season's first run, to the ids stage, the first full
run's diff records every event `added`. The attribution runs where the SHA
differs from `last-run.json`'s and there is a previous `events.v2.json` to
attribute (The diff, as built).

**The writes**, all or nothing (#44). A run commits when a file's bytes
change, `events.v2.json`'s compared with its `generated_at` held at the
committed one - the run's own stamp aside - so a run whose fetch finds
nothing new writes nothing, `last-run.json` included. A run that commits
writes each file whose bytes differ from the committed ones - `source.json`,
`ids.jsonl`, `tags.cache.jsonl`, `works.json` for a mint, `events.v2.json`,
its `generated_at` new where the run fetched, and `changes.jsonl` - each to
a temp file beside it, every temp before any is moved over its file, and
`last-run.json` last. `changes.jsonl` is the committed log, re-rendered,
with the new lines after it, and must begin with the committed bytes - the
prefix check, made where the old bytes are - or the run is fatal. A mint's
rows are checked with the registry (`registry.check`) before the build,
which resolves them in the same run.

**Two builds** (#44): the file from the stages' rows, and the file again
through the live front door on the texts about to be written -
`source.json`, the ledger, the cache and `last-run.json` - which is the
build CI checks. The two must be equal, byte for byte.

**Fatal**, writing nothing and exiting 2: a frozen season; an input that
does not load; a stage's error - the fatal column above - or any other
exception; a registry the mint's rows break; the prefix check; the two
builds differing. A degraded run commits, and exits 0, as do a run that
changes nothing and one outside the window.

**The result object**: the outcome - committed, nothing changed, fatal or
out of window - the error, the files written, `last-run.json`'s fields,
and the names behind the counters: failed pages, merges, UNSURE pairs,
inputs left untagged, works minted, events untagged, names unresolved and
tracks unknown, ten of each. It goes to `pipeline-result.json` in the
system's temp folder, never into the tree, for `summary`.

**The workflow**, `.github/workflows/scrape.yml` (#48): the cron
`17 * * * *`, and `workflow_dispatch` with `force`, `to`, `limit`,
`requests`, `season` (default `data/2027/season.json`) and `target`
(default the repository variable `SCRAPE_TARGET`); the concurrency group
`scrape`, nothing cancelled. It checks the target out with the bot's token -
a run branches afresh from the target (#48) - installs `requirements.txt`
on Python 3.13, asks `window`, and runs `pipeline.py run` when in the
window or forced, with `ANTHROPIC_API_KEY` and `PIPELINE_SHA`, its
checkout's commit. The summary goes to the job summary whatever the
outcome. A run that changed a file commits it to `schedule/<stamp>`, the
stamp's colons dropped, as schedule-bot with the token owner's noreply
address, which GitHub attributes to that account, so the rulesets' extra
approval for unattributed changes does not hold it. It opens a pull request
into the target with the summary as its body, closes the bot's other open
`schedule/` pull requests into that target with a "Superseded by" comment,
deleting their branches, and turns on auto-merge: `--merge` into `main`,
`--squash` otherwise. On a failure the last step checks that the tree is
clean, and fails with the diff where it is not.

## What CI holds, per year

| | a frozen year: 2026 | a live year: 2027 |
|---|---|---|
| `events.v2.json` | Rebuilt from the raw file, the registries, the cache, `season.json` and `venues.json`: equal to the committed file (#34, #46) - by pytest, and by the pipeline job's `python events_v2.py --season data/2026/season.json --check`. | Rebuilt from `source.json`, `ids.jsonl`, the registries, `venues.json`, the cache and `season.json`, its two stamps read from `last-run.json`, not from the file it checks: equal to it, byte for byte (#42) - by the pipeline job's `python events_v2.py --season data/2027/season.json --check` once the file exists, and by each run's second build as it writes (The run, as built). |
| census v2 | Rendered afresh: equal to the committed report (#35). | Not held; run on demand (#46). |
| `venues.json` | Loads and validates (#45). | Loads and validates (#45). |
| `changes.jsonl` | - | `last-run.json`'s `changes_logged` against the log's last stamp; every id the log names in `events.v2.json`, removed or not, or a `merged` line's id; the lines sorted (`tests/test_changes_log.py`, skipped until a run past the ids stage commits the year's `events.v2.json`; #47). Each commit's log beginning with the last commit's is the orchestrator's prefix check, made where the old bytes are: CI's checkout is shallow. |
| the counters | The tag and track counters held at zero on 2026's build, by `tests/test_zero_hold.py`; the venue counters reported, never held (#44). | - |
| the tag cache | Every event's key, read through the front door and the merge, in the committed cache (`tests/test_tag_stage.py`). | - |
| writes | The raw file refused, and the tag stage run with `--dry-run` only; the derived files rebuilt by an explicit command, never by a run (#46). | A run's, when it commits (#44). |

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

- ~~The key order in each file, and whether a key that holds nothing -
  `false`, an empty list - is written.~~ Settled by each writing PR: PR 2
  for `season.json` and `venues.json`, PR 3 for `source.json`, PR 4 for
  `ids.jsonl`, PR 6 for `events.v2.json`, PR 7b for `changes.jsonl` and
  PR 8 for `last-run.json`, above.
- ~~The names the entries do not give~~: the SHA's key in a change line,
  `sha`, PR 7b (The diff, as built); `last-run.json`'s counters, PR 8
  (`last-run.json`, above).
