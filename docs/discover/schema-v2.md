# Discover: schema v2

The design note for the registries and tags v2: DECISIONS #31, #32 and #33,
in the detail a pull request needs. Written 2026-09-20, before any of it is
built. The evidence is `census-2026.md`, beside this file, and every number
here names the census section it comes from. What this note does not settle
is under Open, at the end. A change of meaning here is a decision: log it in
DECISIONS.md and update this file in the same PR.

## Principles

1. **Parse what the source states.** The schedule marks its own adult events
   with "(Mature Audience)", on 72 events (section 6). 94 events carry a
   price mark, SOLD OUT, a clock time or the like in the title (section 9).
   981 events carry an "Additional Panelists:" line in the description
   (section 7). None of that needs a model, and a parser gives the same
   answer every time.
2. **Closed lists for what the model fills.** Where the model chose one
   value from a closed list, it held: groups of events that sent it the same
   input disagree on `kind` in 3.0% and on `adult` in 0.6%. Where it chose
   up to 3 of 32 topics, they disagree in 53.2% (section 11).
3. **Every link says why.** A link from an event to a work carries `via`:
   the event is about the work, or a credited person is on it, or its track
   is about it. Firefly has 9 events (section 2) and its cast about 60
   appearances (Appendix B: Tudyk 16, Staite 14, Fillion 12, Torres 10,
   Glau 9). Those are two lists, and the reader should see which is which.
4. **Identity is curated, not read from a blurb.** `guests` disagrees in
   30.8% of same-input groups (section 11), because fame is not in a
   description. Spelling is nearly clean - one same-key group and one prefix
   pair among 116 fandom names (section 2) - so the work is knowing who and
   what, not mending strings.
5. **Ask only what is not already known.** 27 of 54 tracks have one topic on
   over 80% of their events (section 10). The model is asked for axes only
   where `tracks.json` does not decide.
6. **One input, one answer.** 231 of 331 groups of events that sent the
   tagger the same input do not all carry the same tags (section 11). An
   answer is cached by a hash of what was sent, so one input is tagged once.

## The registries

Three files under `data/registry/` (#31): hand-curated, in git, validated by
the pipeline on every run, and resolved to ids. The client sees only
resolved data, never a registry. They are cross-year, unlike
`data/2027/venues.json` (#27), because a work or a person outlasts a con.

An id is a slug and is forever. A rename or a merge keeps the old name as an
alias, because follows are stored by id.

### `works.json`

One registry for everything an event can be about or a person can be
credited with.

| field | what it holds |
|---|---|
| `id` | The slug. Forever. |
| `name` | The name shown. |
| `aliases` | Other names and spellings that resolve to this id, a renamed or merged work's old name among them. |
| `parent` | Optional. The id of the work this one belongs to. |
| `type` | `franchise` \| `game`. |
| `family` | Games only: `rpg` \| `ccg` \| `board` \| `miniatures` \| `video`. |
| `reviewed` | `false` on a work the tagger proposed and the pipeline added by itself; the census lists those. It can be wrong until someone looks. |

```json
{"id": "firefly", "name": "Firefly", "aliases": ["Serenity"], "type": "franchise", "reviewed": true}
```

### `people.json`

Curated people only: celebrity guests and prolific creators. The census
counts 225 distinct names on the 470 `guests: celebrity` events (section 7),
which sizes the credit review.

| field | what it holds |
|---|---|
| `id` | The slug. Forever. |
| `name` | The name shown. |
| `aliases` | The spellings the schedule uses. Section 7 has 9 variant groups, and 45 names that carry a title, a credential, a parenthetical or a "from X" tail. |
| `tier` | `celebrity` \| `creator`. A person outside the registry has no tier. |
| `credits` | At most about 5, each `{work, reviewed}`: a work's id, and whether a person has checked the credit. Only a credit with `reviewed: true` reaches an event. |

```json
{"id": "nathan-fillion", "name": "Nathan Fillion", "aliases": [], "tier": "celebrity",
 "credits": [{"work": "firefly", "reviewed": true},
             {"work": "castle", "reviewed": true},
             {"work": "the-rookie", "reviewed": false}]}
```

### `tracks.json`

| field | what it holds |
|---|---|
| `id` | The slug. Forever. |
| `name` | The track's name as the schedule gives it. |
| `aliases` | Other names for the same track. |
| `axes` | Optional. The default axes of a single-topic track: any of `medium`, `genre`, `craft`, `subject`. |
| `work` | Optional. Where a track is about one work, that work's id. This is the source of `via: track`. |

```json
{"id": "filk-music", "name": "Filk Music", "aliases": [], "axes": {"medium": ["music"]}}
```

All 35 Filk Music events carry the topic Music today (section 10).

## The v2 event

The scraped fields are unchanged, and `speakers` stays as scraped. Three
things are added or change shape: `people`, `facets` and `tags`. The example
is a real event from the frozen file, with the v2 fields as this design
would fill them.

```json
{
  "id": "6ecc75745a676d39f230055623a7291a",
  "type": "panel",
  "title": "Castle Cast",
  "day": "2026-09-05",
  "start": "2026-09-05T11:30",
  "end": "2026-09-05T12:30",
  "duration_min": 60,
  "location": "Marriott Atrium Ballroom",
  "hotel": "Marriott",
  "room": "Atrium Ballroom",
  "description": "Bring your questions for our guests from the crime drama Castle! They always find the right answer!",
  "tracks": ["Main Programming"],
  "track": "Main Programming",
  "speakers": [
    {"name": "Primetime Steve", "role": "Moderator"},
    {"name": "Seamus Dever", "role": "Speaker"},
    {"name": "Nathan Fillion", "role": "Speaker"},
    {"name": "Jon Huertas", "role": "Speaker"},
    {"name": "Molly Quinn", "role": "Speaker"}
  ],
  "cancelled": false,
  "people": [
    {"name": "Primetime Steve", "role": "Moderator", "src": "speakers"},
    {"name": "Seamus Dever", "role": "Speaker", "src": "speakers"},
    {"name": "Nathan Fillion", "role": "Speaker", "src": "speakers", "id": "nathan-fillion"},
    {"name": "Jon Huertas", "role": "Speaker", "src": "speakers"},
    {"name": "Molly Quinn", "role": "Speaker", "src": "speakers"}
  ],
  "facets": {},
  "tags": {
    "kind": "qa",
    "works": [
      {"id": "castle", "via": "about"},
      {"id": "firefly", "via": "credit:nathan-fillion"}
    ],
    "medium": ["tv"],
    "genre": [],
    "craft": [],
    "subject": [],
    "audience": "all",
    "guests": "celebrity",
    "adult": false
  }
}
```

**`people`** is the resolved superset of `speakers`: everyone in `speakers`,
and everyone the description's "Additional Panelists:" line names, each with
`src` saying which (`speakers` | `description`). A person the registry knows
carries its `id`. Only Nathan Fillion's entry is shown in this note, so only
he has one here; the rest of the cast would resolve the same way once
registered, and the moderator is outside the registry.

**`tags.works`** holds registry ids, each with `via` = `about` |
`credit:<person>` | `track`. The event is about Castle. Firefly arrives by a
reviewed credit. The Rookie does not arrive: its credit is not reviewed.

**`tags.guests`** is derived, never asked: the highest tier among the
event's people, `celebrity` over `creator`, else the key is absent. `fan`
and `unknown` retire; the client reads only `celebrity` today (`isCeleb`).
The cost: a celebrity missing from the registry gets no badge, so census v2
lists the unregistered people on `qa`, `photo` and `signing` events.

**`tags.adult`** comes from the parsed marker first; the model may only add.
**`tags.audience`** is `kids` | `all` | `mature`, and `mature` is derived
from `facets`. **`tags.play`** is `{format, level}`, on gaming events only.
`kind` is unchanged: the same 13.

### Facets

Parsed, no model. A facet is present only when the source says so; otherwise
the key is absent, as all of them are above. Absence is not "free": an event
with no `cost` is one whose listing states no fee, and nothing more.

| key | value | the source says it as | census |
|---|---|---|---|
| `mature` | `true` | "(Mature Audience)" | section 6: 72 events |
| `min_age` | N | "18+", "17+", "(Age 18+)" | section 6: `18+` on 13 events, `17+` on 14 |
| `cost` | `"extra"` | "$", "$$", "EXTRA FEE" | section 9: `$ / $$` in 23 titles; fee, ticket or pre-registration wording in 45 |
| `sold_out` | `true` | "SOLD OUT" | section 9: 19 titles |
| `signup` | `true` | pre-registration wording | section 9: within the 45 titles above, and 248 descriptions |
| `part` | N | "Part 2", "Pt 2", "Part Two" | section 9: Part N or Repeat in 16 titles |
| `repeat_key` | the normalised title | the same title at another start | section 11: 371 titles recur, over 1,254 events |

Exactly which wording sets each facet is the parse stage's to pin down, with
tests (PR 2). Two real titles:

- `Battle of the Tropes 2: Late-Night Edition (18+)`, whose description
  closes "(Age 18+)(Mature Audience)", would carry
  `{"mature": true, "min_age": 18}`.
- `Sew Your Own Beret - $$ 12:45p-2:45p SOLD OUT` would carry
  `{"cost": "extra", "sold_out": true}`.

## The axes

`topics` is replaced by four closed axes, at most 2 values each.

| axis | values |
|---|---|
| `medium` | `tv`, `film`, `books`, `comics`, `animation`, `anime`, `music`, `podcast-web`, `video-games`, `tabletop` |
| `genre` | `fantasy`, `sci-fi`, `horror`, `comedy`, `superhero` |
| `craft` | `writing`, `costuming`, `props-making`, `art`, `photography`, `puppetry`, `performance` |
| `subject` | `science`, `space`, `tech`, `history`, `politics`, `skepticism`, `paranormal`, `fitness`, `food`, `community`, `fandom-culture` |

And on gaming events:

| field | values |
|---|---|
| `play.format` | `demo`, `learn-to-play`, `organized-play`, `tournament`, `open-play`, `campaign` |
| `play.level` | `beginner`, `any`, `experienced` |

## From `TOPICS` to v2

Today's 32 topics are five axes in one list - medium, genre, craft, subject
and audience - which is what "up to 3 of 32" asked the model to pick across.
Each one's v2 home, in `TOPICS`' own order, with its events today (section
3):

| topic | events | v2 home |
|---|---:|---|
| Space | 64 | `subject: space` |
| Science | 145 | `subject: science` |
| Writing | 157 | `craft: writing` |
| Costuming | 134 | `craft: costuming` |
| Props & Making | 126 | `craft: props-making` |
| Comics | 90 | `medium: comics` |
| Animation | 87 | `medium: animation` |
| Anime | 101 | `medium: anime` |
| Film | 231 | `medium: film` |
| TV | 252 | `medium: tv` |
| Literature | 281 | `medium: books` |
| Music | 179 | `medium: music` |
| Comedy | 83 | `genre: comedy` |
| History | 98 | `subject: history` |
| Tech | 154 | `subject: tech` |
| Kids | 79 | `audience: kids` |
| Horror | 117 | `genre: horror` |
| Fantasy | 290 | `genre: fantasy` |
| Sci-Fi | 275 | `genre: sci-fi` |
| Gaming | 850 | No single home: `medium: video-games` or `medium: tabletop`, by the event, and `play` |
| Tabletop | 724 | `medium: tabletop` |
| Fitness | 21 | `subject: fitness` |
| Food | 14 | `subject: food` |
| Podcasting | 75 | `medium: podcast-web` |
| Art | 215 | `craft: art` |
| Community | 166 | `subject: community` |
| Politics | 45 | `subject: politics` |
| Fandom Culture | 222 | `subject: fandom-culture` |
| Puppetry | 53 | `craft: puppetry` |
| Cosplay Photography | 251 | `craft: photography` |
| Skepticism | 37 | `subject: skepticism` |
| Paranormal | 34 | `subject: paranormal` |

Two v2 values have no topic behind them: `genre: superhero` and
`craft: performance`.

## What the model is asked

Asked, each from a closed list:

- `kind`: one of the 13.
- The works the event is about. A name resolves against `works.json`, names
  and aliases; one that does not is added, `reviewed: false`.
- The four axes, at most 2 each, and only where `tracks.json` does not
  decide.
- `audience`: `kids` or `all`.
- `play`, on a gaming event.
- `adult`, which it may only add to.

Not asked:

- `facets` and `people`. They are parsed.
- `guests`. It is derived from tiers.
- The credit links in `works`. They come from `people.json`.
- A `via: track` work, and the axes a track decides. They come from
  `tracks.json`.
- `audience: mature`. It is derived from `facets`.
- Anything it has already answered. One input is tagged once: the answer is
  cached by a hash of what the tagger was sent.

Embedding a typed query at runtime stays out (#22).

## The profile

On the device, and keyed by the same ids as the data: follows, mutes, and
weights computed from stars. Weights sync only as settings, and only after
the email upgrade (#8, #25). Follows are stored by name today and need
mapping to ids; that is part of the client switch.

## About, and with the cast

Following or searching a work gives two groups. First, the events about it:
`via: about`. Then a separate "with the cast" group: the events linked by a
credit. In that second group the `photo` and `signing` kinds are hidden
unless asked for; they are 499 and 134 of the schedule's events (section 4).

For Firefly that is the 9 events about it (section 2), and then, apart,
where its cast is appearing.

## The derived file and the cache

`data/2026/events.json` stays frozen (#13, #33): the v2 pipeline reads it and
never writes it. It writes `data/2026/events.v2.json` beside it, and a
committed tag cache keyed by input hash. Frozen events + registries + cache
give the same bytes on every run, with no model call, which is what CI needs,
having no model access. The client on `next` reads the frozen file until a PR
of its own switches it. For 2027 the pipeline writes the v2 shape into
`data/2027/` directly.

## The PR sequence

1. **Docs.** This note, DECISIONS #30-#33, `docs/ROADMAP.md`.
2. **The parse stage.** `facets` and `people`, no model. It builds the tested
   splitter for the "Additional Panelists:" line, and the census imports it
   to report exactly how many events' line names someone `speakers` lacks.
   The census says today, of all 981, that "those names are in the
   description only"; that was never checked, and some lines repeat a
   speaker. The correction rides here.
3. **Registries seeded.** `works.json`, `people.json`, `tracks.json`.
4. **Tagger v2.** The closed axes, the hash cache, `events.v2.json`.
5. **Census v2.** The same questions of the v2 file, and two lists: the
   unreviewed works, and the unregistered people on `qa`, `photo` and
   `signing` events.
6. **The client switch.** The search index, Explore, follows and filters
   change shape, in a PR of their own. A golden query set exists before it.

## Open

- The credit-review format: how about 225 people's credits (section 7) are
  put in front of a person and marked reviewed.
- Names that appear only in a photo-session title. Not measured: the census
  does not count them, so this has no number yet. A look at the frozen file
  found no Epic Photos session with an empty `speakers`; what a group
  session's title names that `speakers` does not is the work, as in
  `Photo Session: Castle Group`. PR 2 measures it, before anything is
  designed for it.
- The tag cache's path and format. PR 4.
- Whether the build's copy of `data/` into `dist/` leaves `events.v2.json`
  out until the switch (#33). The PR that first writes the file decides.
- `repeat_key`: on every event, or only on one whose title recurs.
- A work linked more than one way: listed once, as the example lists Castle,
  or once per reason.
- An event the model marks `adult` with no parsed marker keeps
  `audience: all`, by the letter of #32. 30 events are tagged adult today
  and say nothing of it (section 6). Whether that is wanted.
