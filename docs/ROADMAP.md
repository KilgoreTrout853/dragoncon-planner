# Roadmap — 2027

The order of the 2027 work, by tentpole (DECISIONS #30). VISION.md says what
the app is for and DECISIONS.md what was decided; this file says what is
open, what is held, and what comes next. It is short on purpose: a feature
is specified when its tentpole opens, not before.

## Rules

- Most features hang off a few load-bearing designs. Those are the six
  tentpoles below.
- A tentpole opens with a design chat. The chat ends in DECISIONS entries, a
  data contract, and a first Claude Code prompt, usually a read-only census.
- One tentpole is in design and one in execution at a time. Review
  attention, not code throughput, is the limit.
- There is no feature-level plan for a tentpole that has not opened.
- Discover is first.

## Dates

The con is Labor Day weekend 2027. The spring checkpoint and the freeze are
unset. There are no other dates.

## The tentpoles

### 1. Pipeline shape — not opened

The stages, from fetch (behind #19's interface) through stable ids (#7),
dedupe, venue resolution, parse and tag, the schedule diff (#20), to writing
JSON and the Postgres mirror (#27). Also year rollover (#13), scrape cadence,
failing loudly, and `scrape.yml`'s path onto a PR-only branch (#26). Only the
fetch and id stages wait on outreach (#19).

For 2027 the scraper stops deriving `speakers` from the description's
"Additional Panelists:" line, or uses `parse_stage.split_panelists` for it;
the parse stage owns that parse.

The 2027 scraper decodes these feeds correctly. 45 events of the frozen 2026
file - 27 in Role-Playing Games (Campaign), 17 in Role-Playing Games
(Non-Campaign) and 1 in Collectible Card Games - carry text that was UTF-8
read as cp1252 ("â€“" for "–", "FaerÃ»n" for "Faerûn"), found by
`draft_people.looks_double_encoded`. The frozen file keeps them as scraped,
and so does `events.v2.json`, which copies the scraped fields as they are.

How works the tagger mints during a live scrape season get reviewed is an
open question for this tentpole: 2026's were reviewed in one pass after the
con (`docs/discover/works-review-2.json`). `tag_stage.py` keeps no record of
what it minted: a minted row is `reviewed: false` and nothing more, so census
v2 can only infer that the tagger made it.

`PROMPT_VERSION` is one global and the cache is per year, so a bump for 2027
makes every 2026 key miss and fails the 2026 build, unless the version
becomes per year.

### 2. Discover — in design and execution

What an event is about, who is on it, and how a reader finds it: the
registries, tags v2, and the derived file. Rests on #22 and #31-#33, and
supersedes #3 when built. The design is `docs/discover/schema-v2.md`; the
evidence is `docs/discover/census-2026.md`. The sequence:

1. Docs: the design note, DECISIONS #30-#33, this file.
2. The parse stage: `facets` and `people`, no model; the census corrected
   with its name splitter.
3. Registries seeded: `works.json`, `people.json`, `tracks.json`.
4. Tagger v2 - built: `tag_stage.py` and its cache, `events_v2.py` and
   `events.v2.json` (DECISIONS #34).
5. Census v2 - built: `census_v2.py` writes
   `docs/discover/census-v2-2026.md`, held fresh by CI (DECISIONS #35).
6. The client switch, in a PR of its own, after a golden query set exists.

### 3. Places — designed; two PRs held

Where a room is: the venues file, room resolution, and the building view
down to the level. Rests on #21, #27 and #28. Held: the room census, and the
venues registry.

### 4. Identity and sync — not opened

What is synced, the outbox and the conflict rule, the Postgres schema and
row-level security, the crew permission model, and push sending (the
scheduled job, the Edge Function). Rests on #8-#11, #20 and #25. It carries
VISION's Keep, Coordinate and Tell me.

### 5. Delivery — not opened

How the app reaches a phone and stays current: `sw.js` and its cache version
(#4), hashed assets against the single file (#23), the IIFE-or-module sharp
edge (ARCHITECTURE.md), Playwright (#24), the install flow, the client side
of a push subscription, and Pages from Actions (#26).

### 6. Where things live — not opened; opens last

The UI's information architecture. There are five tabs today; For you,
crews, a filter sheet and the building view need homes. No decisions yet.

## Held

- The two Places PRs: the room census, and the venues registry.
- `scrape.yml`'s path onto a PR-only branch (#26). Pipeline shape.
- Dragon Con outreach (#19). It gates the fetch and id stages of the
  pipeline, and nothing else.
