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

**The work slug.** `registry.work_slug` drafts a work's or a track's id from
its name: case, accents and punctuation fold to hyphens, `&` reads "and",
and a comma inside a number is not a separator, so `Warhammer 40,000` is
`warhammer-40000`. A leading "the" stays - `the-expanse`, not `expanse` -
because it is part of the name. The seed holds `id == work_slug(name)` for
every entry, but that is not a rule the loader enforces: an id never
changes, and a name may be corrected later.

**The resolution key** is the work slug without a leading "the", so
`The Wheel of Time` and `Wheel of Time` are one name and neither needs an
alias, as are `Dungeons & Dragons` and `Dungeons and Dragons`. Two entries
in one file may not share a key. A person's names normalise the way a
person's id is made instead, by `parse_stage.person_slug`, which sets aside
an honorific and a trailing credential rather than a leading "the".

**What a phrase can be.** `tag_events.CANON` and `src/search.js`'s
`SYNONYMS` are associations, not identities, so seeding the registry from
them means labelling every phrase. A phrase is a work's own **name**; an
**alias**, another name for the same work (`mcu`, `serenity`); a **child**,
its own work with a parent (`the-mandalorian` under `star-wars`); a
**term**; **elsewhere**, meaning it has a v2 home that is not a work - an
axis value, a facet, a kind or a track; or **dropped**. A group of phrases
that names no work at all is search vocabulary, and `src/search.js` keeps
it.

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
| `terms` | Optional. Words that should lead a searcher to the work but are not names for it: `klingon`, `hogwarts`, `rocinante`, and creators' names. |
| `reviewed` | `false` on a work the tagger proposed and the pipeline added by itself; the census lists those. It can be wrong until someone looks. |

```json
{"id": "firefly", "name": "Firefly", "aliases": ["Serenity"], "type": "franchise",
 "terms": ["Whedon"], "reviewed": true}
```

**A term is not a name.** Terms never resolve: `resolve_work("whedon")` is
`None`. That is what lets one term sit on several works - `whedon` on
Firefly, Buffy and Angel - so the loader does not require them unique. What
it does require is that a term is not also a name or an alias somewhere,
which would make one string both resolvable and not. The tagger ignores
terms; they reach the client at the switch (PR 6) baked into the
pipeline-built search index, not by the client reading a registry, so #31's
"the client sees only resolved data" still holds.

### `people.json`

Curated people only: celebrity guests and prolific creators. The census
counts 225 distinct names on the 470 `guests: celebrity` events (section 7),
which sizes the credit review.

| field | what it holds |
|---|---|
| `id` | The slug. Forever. |
| `name` | The name shown. |
| `aliases` | The spellings the schedule uses. Section 7 has 9 variant groups, and 45 names that carry a title, a credential, a parenthetical or a "from X" tail. |
| `tier` | Optional: `celebrity` \| `creator`. A person outside the registry has no tier, and an entry with no tier exists to carry aliases. |
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
| `axes` | Optional. The default axes of a single-topic track: any of `medium`, `genre`, `craft`, `subject`, at most 2 values each. |
| `audience` | Optional: `kids` \| `mature`. A track's default audience, where it has one. Kids Track's topic is Kids, which this note sends to `audience` and not to an axis, so `axes` cannot carry it. |
| `work` | Optional. Where a track is about one work, that work's id. This is the source of `via: track`. |

```json
{"id": "filk-music", "name": "Filk Music", "aliases": ["Filk"], "axes": {"medium": ["music"]}}
{"id": "kids-track", "name": "Kids Track", "aliases": [], "audience": "kids"}
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
    {"id": "primetime-steve", "name": "Primetime Steve", "role": "Moderator", "src": "speakers"},
    {"id": "seamus-dever", "name": "Seamus Dever", "role": "Speaker", "src": "speakers"},
    {"id": "nathan-fillion", "name": "Nathan Fillion", "role": "Speaker", "src": "speakers"},
    {"id": "jon-huertas", "name": "Jon Huertas", "role": "Speaker", "src": "speakers"},
    {"id": "molly-quinn", "name": "Molly Quinn", "role": "Speaker", "src": "speakers"}
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
    "guests": "celebrity"
  }
}
```

**`people`** is the resolved superset of `speakers`: everyone in `speakers`,
and everyone the description's "Additional Panelists:" line names, each with
`src` saying which (`speakers` | `description`). Every entry carries an `id`:
the registry's id when the person is known, otherwise a deterministic slug
from the normalised name. Follows are stored by id (#31), and any panelist
can be followed today, so there is one keying, not two. The cost: two people
with one name share a slug until the registry separates them. Above, Nathan
Fillion's id is the registry's, his being the one `people.json` entry this
note shows; the other four are slugs.

**The line is the source's.** "Additional Panelists:" is written by whoever
wrote the listing; `scraper.py` reads the description verbatim and never
composes it. It runs the other way once: where the detail page has no
Speakers section, the scraper fills `speakers` *from* that line
(`speakers = detail["speakers"] or extract_panelists(description)`), which is
why no event with an empty `speakers` carries one (section 7). On those 375
events `speakers` is not a second source but an older parse of the line, and
an imperfect one - it reads "(Judge)" as part of a name, and on the one
description that says "Additional Panelists:" twice it reads to the end of
the string. `parse_stage.scraper_derived_speakers` detects that case exactly,
by comparing `speakers` with what `extract_panelists` returns, and reads the
line again instead; everyone on such an event is `src: description`. Both go
when the 2027 scraper stops deriving speakers from the line, or uses the
parse stage's splitter (ROADMAP, Pipeline shape).

**The slug rules**, as `parse_stage.person_slug` builds them. Case, accents,
punctuation and whitespace fold: `François Custardy` is `francois-custardy`,
`Ra'Neith` is `raneith`, `&` reads as "and". An honorific goes (`Dr. Nicole
Gugliucci` is `nicole-gugliucci`), and so does a trailing credential or
suffix (`Theda Daniels-Race PhD` and `Theda Daniels - Race` are both
`theda-daniels-race`; `Calvin Watts III` is `calvin-watts`) - but only where
two or more words are left without it. In `Mr. Corporate`, `Ms. Leisure`,
`Mr. Vader` and `Dr. Craz` the honorific is the name, and those four are the
schedule's only such names; the registry is seeded from these slugs, and
`corporate` is the wrong id to make permanent. A trailing parenthetical that
is a role becomes the role and leaves the name (`Karen Henson(Judge)` is
`karen-henson`, a judge); one that is not stays (`Kei (tophat_tiara)`).

What the slug **keeps** is as much the point: a middle initial
(`laura-j-schroeder` is not `laura-schroeder`) and a "from X" or "of X" tail
(`madison-may-from-cut-sew`). An id is forever, and merging two spellings is
the registry's job, with an alias (#31): a slug that moves later is a follow
that breaks. Nine slugs are shared by two or more spellings today, listed
UNSURE in `parse-2026.md`.

A role has two readings where the schedule writes one into the name itself.
A parenthetical in the name beats a `role` field that says no more than that
a person is there - `Speaker`, `Panelist`, or nothing - and loses to a field
that names a specific role. Between `speakers` and the line, `speakers`
wins.

**`tags.works`** holds registry ids, each with `via` = `about` |
`credit:<person>` | `track`. A work linked more than one way is listed once,
with the strongest `via`: `about`, then `track`, then `credit`. The event is
about Castle, so Castle is listed once, as `about`, though Nathan Fillion's
reviewed credit links it too. Firefly arrives by a reviewed credit. The
Rookie does not arrive: its credit is not reviewed.

**`tags.guests`** is derived, never asked: the highest tier among the
event's people, `celebrity` over `creator`, else the key is absent. `fan`
and `unknown` retire; the client reads only `celebrity` today (`isCeleb`).
The cost: a celebrity missing from the registry gets no badge, so census v2
lists the unregistered people on `qa`, `photo` and `signing` events.

**`tags.audience`** is `kids` | `all` | `mature`. It is `mature` when the
parsed marker says so, or when the model adds it: the pipeline forces
`mature` where `facets.mature` is true, and the model may add `mature`,
never remove it. The marker alone would not reach every such event: 30
events are tagged adult today and say nothing of it (section 6). v1's `adult`
flag folds into `audience`, so `tags` carries no `adult`.

**`tags.play`** is `{format, level}`, on gaming events only. `kind` is
unchanged: the same 13.

### Facets

Parsed, no model. A facet is present only when the source says so; otherwise
the key is absent, as all of them are above. Absence is not "free": an event
with no `cost` is one whose listing states no fee, and nothing more.

The wording each one is read from, as PR 2 built it in `parse_stage.py`.
Unless a row says otherwise, the wording is looked for in the title and the
description together.

| key | value | the source says it as | census |
|---|---|---|---|
| `mature` | `true` | "Mature Audience", bracketed or not; "adults only"; or a `min_age` of 18 or more | section 6: 72 events; parse: 75 |
| `min_age` | N | "18+", "17+", "(Age 18+)", "18 and up". 13 to 21 only, and the highest stated where a listing gives two | section 6: a 13+ to 21+ wording on 31 events; parse: 31 |
| `cost` | `"extra"` | "$" or "$$" **in the title**, "EXTRA FEE", or an amount of money ("Price: $8", "$10 cash donation"). Not a number that is not a price ("$3 trillion"), and not zero | section 9: `$ / $$` in 23 titles, fee or ticket wording in 45; parse: 214, most of them a description's "Price: $N" |
| `sold_out` | `true` | "SOLD OUT" | section 9: 19 titles; parse: 19 |
| `signup` | `true` | "pre-reg", "pre-registration", "advance registration", "registration required", "must register", "sign-up required", "reserve a seat", "RSVP". Not "ticket" or "fee" alone | section 9: fee, ticket or pre-registration wording in 45 titles and 248 descriptions; parse: 112 |
| `part` | N | "Part 2", "Pt 2", "Part Two", **in the title**. "Repeat" alone gives no number and sets nothing | section 9: Part N or Repeat in 16 titles; parse: 16 |
| `repeat_key` | the normalised title | the same key at more than one start | section 11: 371 titles recur, over 1,254 events; parse: the same |

`repeat_key` follows the same rule as the rest: it is present only on an
event whose key occurs at more than one start, and absent otherwise. The key
is the title with `$`, SOLD OUT, a clock time and CANCELLED taken out, cased
and punctuated away - the census's section 11 key, which `parse_stage.py`
now owns and the census imports.

`cost` and `signup` are the two a reader would be angry to see wrong, so
they take precision over recall: where the same listing says there is no fee
("No fee to enter", the photoshoots' "There is no charge to participate" on
185 events), neither key is set, and wording the parse does not act on is
listed UNSURE rather than guessed at. An absent key still means only that
the listing states nothing.

Two real titles:

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
  and aliases; one that does not is added, `reviewed: false`. A work that
  only a title names, as in `Photo Session: Castle Group`, is found here:
  `via: about`.
- The four axes, at most 2 each, and only where `tracks.json` does not
  decide.
- `audience`: `kids` | `all` | `mature`. It may add `mature`, never remove
  it: the pipeline forces `mature` where `facets.mature` is true.
- `play`, on a gaming event.

Not asked:

- `facets` and `people`. They are parsed.
- `guests`. It is derived from tiers.
- The credit links in `works`. They come from `people.json`.
- A `via: track` work, and the axes a track decides. They come from
  `tracks.json`.
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
2. **The parse stage.** `facets` and `people`, no model. Built:
   `parse_stage.py` and its report `parse_report.py`, which writes
   `parse-2026.md`. The census imports the splitter, the facet patterns and
   the title key from it - one owner - and its sentence about all 981 lines,
   "those names are in the description only", which was never checked, is
   now three counts: 564 lines name someone `speakers` lacks, 417 name
   nobody it does not, and the first group names 567 distinct people.
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
- The tag cache's path and format. PR 4.
- Whether the build's copy of `data/` into `dist/` leaves `events.v2.json`
  out until the switch (#33). The PR that first writes the file decides.
