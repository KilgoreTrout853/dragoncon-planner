# Tag census v2 - the 2026 schedule

Written by `census_v2.py` from `data/2026/events.v2.json` (`generated_at` 2026-09-07T12:50:19+00:00, source https://app.core-apps.com/dragoncon26), which it first builds afresh from `data/2026/events.json`, `data/registry/` and `data/2026/tags.cache.jsonl`, and stops unless the two are the same; beside them, the drafter's sidecar, `data/registry/people.draft.json`. Do not edit it by hand; run the script again. CI fails when it is stale (DECISIONS #35).

It states facts and recommends nothing. `UNSURE` marks a candidate that needs a person's judgment, and nothing here resolves one. Lists run by count, descending, then by name; a list with no counts runs by name. Event titles and the names of works and people are in code spans, so that their punctuation shows as written.

It asks the questions of `census-2026.md` of the v2 file where they survive. Not asked again: v1's section 8, descriptions, since the tagger is now sent 2,000 characters and section 12 counts the descriptions past them; and v1's section 9, facets in titles, which the parse stage reads (`parse-2026.md`).

It never links: only the tagger links an event to a work (#34). Where a list here comes of matching text, every row is UNSURE, and the fix it names is a person's: a `"model": "hand"` line in the cache.

## 0. Headline

1. Events: 3,459 in `events.v2.json`, a fresh build. Every event has exactly one cache line: 2,580 lines for 2,580 distinct inputs.
2. Works linked: 654, by 3,366 links - `about` 1,669 on 1,594 events, `track` 30, `credit` 1,667. Events with no work and no axis value: 48 (1.4%).
3. Unreviewed works: 97 of 699 - the drafter's 42, the tagger's 55, other 0. Linked by events: 64, on 239 events (Appendix A).
4. Kind: of the 3,449 events v1 tagged, 3,147 keep their kind; the pairs that differ: 42, over 312 events. The largest kind: `panel` (1,086). Events that say wrestl*: 5, each UNSURE.
5. Audience: `all` 3,266, `mature` 105, `kids` 88. Events where v1's `adult` and v2's `mature` disagree: 9.
6. Play: on 868 of 931 gaming events; on other events: 0.
7. Guests: on 483 events; v1 called 470 `celebrity`. People: 1,798 ids; `people.json` holds 138, reviewed 113. On qa, photo and signing events and not in `people.json`: 197 (Appendix B).
8. Tracks: track and axis pairs where one value is on 80% or more of the track's events and `tracks.json` does not decide: 19 (UNSURE).
9. Recurring: repeat groups that sent more than one input: 45 of 371; of those, building different tags: 8. Hand lines in the cache: 0.
10. Links to check (UNSURE): resume mentions: 49, on 22 inputs. Music performances with no work: 72; with a registry work's name in the title: 1.
11. v1 fandoms: 815 assignments compared - same 577, more specific 137, less specific 6, lost 95.
12. Text: double-encoded events: 45; model strings that look double-encoded: 0. Strings holding U+2018: 1; U+FFFD: 0. Descriptions over the cap: 0.

## 1. Coverage

- Events: 3,459. `count` in the file says 3,459, which agrees.
- Every event has exactly one cache line: the 3,459 events send 2,580 distinct inputs, and each input's key is on exactly one of the cache's 2,580 lines.
- No work, by any via, and no axis value: 48 (1.4%).

No work and no axis value, by kind:

| kind | events | of | share |
| --- | ---: | ---: | ---: |
| `panel` | 16 | 1,086 | 1.5% |
| `other` | 11 | 78 | 14.1% |
| `contest` | 6 | 67 | 9.0% |
| `workshop` | 6 | 197 | 3.0% |
| `party` | 3 | 62 | 4.8% |
| `gaming` | 2 | 868 | 0.2% |
| `qa` | 2 | 118 | 1.7% |
| `screening` | 1 | 116 | 0.9% |
| `signing` | 1 | 137 | 0.7% |

No work and no axis value, by track (top 15; an event with two tracks counts under both):

| track | events | of | share |
| --- | ---: | ---: | ---: |
| Main Programming | 9 | 96 | 9.4% |
| Apocalypse Rising | 8 | 35 | 22.9% |
| Robotics and Maker Track | 7 | 51 | 13.7% |
| Digital Media | 6 | 134 | 4.5% |
| Alternate and Historical Fiction | 5 | 64 | 7.8% |
| Kids Track | 5 | 48 | 10.4% |
| Military Sci-fi Media | 3 | 45 | 6.7% |
| BritTrack | 2 | 50 | 4.0% |
| Silk Road | 2 | 29 | 6.9% |
| Vendor Workshops/Events | 2 | 139 | 1.4% |
| American Sci-fi and Fantasy Media | 1 | 61 | 1.6% |

## 2. Works

- Distinct works linked: 654, by 3,366 links. A work linked more than one way on one event is listed once, under its strongest via: about, then track, then credit (#32).

| via | works | links | events |
| --- | ---: | ---: | ---: |
| `about` | 540 | 1,669 | 1,594 |
| `track` | 2 | 30 | 30 |
| `credit` | 172 | 1,667 | 453 |

How many works have how many events, by any via:

| events | works |
| --- | ---: |
| 1 | 330 |
| 2 | 69 |
| 3-5 | 63 |
| 6-20 | 163 |
| 21+ | 29 |

### Top 50

By events rolled up through descendants: an event counts for a work when it links that work, or a work below it, `about`. "About it" counts the work's own `about` links alone.

| id | name | parent | about it | rolled up | aliases | terms |
| --- | --- | --- | ---: | ---: | --- | --- |
| `dungeons-and-dragons` | `Dungeons & Dragons` |  | 137 | 138 | `D&D`, `DnD`, `5e` | `Dungeon Master`, `DDAL`, `Adventurers League` |
| `magic-the-gathering` | `Magic: The Gathering` |  | 80 | 80 | `MTG` |  |
| `star-trek` | `Star Trek` |  | 42 | 77 | `Trek` | `Starfleet`, `Klingon`, `Trekkie` |
| `pathfinder` | `Pathfinder` |  | 53 | 53 |  |  |
| `marvel` | `Marvel` |  | 14 | 45 | `MCU`, `Marvel Cinematic Universe`, `Marvel Comics` |  |
| `brandish` | `Brandish` |  | 44 | 44 |  |  |
| `star-wars` | `Star Wars` |  | 31 | 43 |  | `Jedi`, `Sith`, `Skywalker`, `Lightsaber` |
| `dc-comics` | `DC Comics` |  | 4 | 35 | `DC`, `DC Universe`, `DCEU` |  |
| `pokemon` | `Pokemon` |  | 34 | 34 | `Pokémon` |  |
| `starfinder` | `Starfinder` |  | 32 | 32 |  |  |
| `shadowrun` | `Shadowrun` |  | 27 | 27 |  |  |
| `the-lord-of-the-rings` | `The Lord of the Rings` |  | 9 | 26 | `LOTR` | `Tolkien`, `Middle-earth` |
| `shovel-knight` | `Shovel Knight` |  | 22 | 22 |  |  |
| `worn-wanderers` | `Worn Wanderers` |  | 17 | 17 |  |  |
| `battletech` | `BattleTech` |  | 16 | 16 |  |  |
| `murder-hobo-tavern-brawl` | `Murder Hobo Tavern Brawl` |  | 15 | 15 |  |  |
| `star-trek-lower-decks` | `Star Trek: Lower Decks` | `star-trek` | 15 | 15 | `Lower Decks` |  |
| `warhammer` | `Warhammer` |  | 6 | 15 |  |  |
| `barely-coping` | `Barely Coping` |  | 14 | 14 |  |  |
| `doctor-who` | `Doctor Who` |  | 12 | 14 | `Dr Who` | `TARDIS`, `Whovian`, `Dalek` |
| `luminous` | `Luminous` |  | 14 | 14 |  |  |
| `the-hobbit` | `The Hobbit` | `the-lord-of-the-rings` | 14 | 14 |  |  |
| `battlestar-galactica` | `Battlestar Galactica` |  | 13 | 13 | `Battlestar`, `BSG`, `Galactica` |  |
| `call-of-cthulhu` | `Call of Cthulhu` |  | 12 | 13 |  |  |
| `superman` | `Superman` | `dc-comics` | 5 | 13 |  |  |
| `into-the-lair` | `Into the Lair` |  | 12 | 12 |  |  |
| `mothership` | `Mothership` |  | 11 | 11 |  |  |
| `resident-alien` | `Resident Alien` |  | 11 | 11 |  |  |
| `star-trek-enterprise` | `Star Trek: Enterprise` | `star-trek` | 11 | 11 | `Enterprise` |  |
| `the-boys` | `The Boys` |  | 11 | 11 |  |  |
| `final-fantasy` | `Final Fantasy` |  | 1 | 10 |  |  |
| `firefly` | `Firefly` |  | 10 | 10 | `Serenity` | `Whedon` |
| `spider-man` | `Spider-Man` | `marvel` | 7 | 10 | `Spiderman` |  |
| `urban-insanity` | `Urban Insanity` |  | 10 | 10 |  |  |
| `babylon-5` | `Babylon 5` |  | 9 | 9 |  |  |
| `castle` | `Castle` |  | 9 | 9 |  |  |
| `final-fantasy-xiv` | `Final Fantasy XIV` | `final-fantasy` | 9 | 9 |  |  |
| `stargate` | `Stargate` |  | 3 | 9 |  |  |
| `starship-troopers` | `Starship Troopers` |  | 9 | 9 |  |  |
| `warhammer-40000` | `Warhammer 40,000` | `warhammer` | 9 | 9 | `40k`, `Warhammer 40k`, `40,000` |  |
| `alien` | `Alien` |  | 7 | 8 | `Aliens` | `Xenomorph` |
| `inter-sidera` | `Inter Sidera` |  | 8 | 8 |  |  |
| `savage-worlds` | `Savage Worlds` |  | 8 | 8 |  |  |
| `the-amazing-digital-circus` | `The Amazing Digital Circus` |  | 8 | 8 |  |  |
| `wynonna-earp` | `Wynonna Earp` |  | 8 | 8 |  |  |
| `batman` | `Batman` | `dc-comics` | 6 | 7 |  | `Gotham` |
| `game-of-thrones` | `Game of Thrones` |  | 5 | 7 | `GoT` | `Westeros`, `Targaryen` |
| `hades` | `Hades` |  | 1 | 7 |  |  |
| `land-of-the-lost` | `Land of the Lost` |  | 7 | 7 |  |  |
| `scooby-doo` | `Scooby-Doo` |  | 7 | 7 |  |  |

### Registry terms the build dropped

A cached work name that is a term on a registry work links nothing: `events_v2.py` drops it and counts it until a person makes it an alias (#34).

- none

### The pilot's everyday words

The 30 works of `tools/tag_pilot.py`'s `EVERYDAY`: registry works whose name, or an alias, the 2026 text uses in its ordinary sense. The events that link each, by any via, and the event titles that hold the word, whole words, folded, by the pilot's `word_in`: a count only, because a title that holds the word is not a link.

| work | the word | events linking it | titles with the word |
| --- | --- | ---: | ---: |
| `castle` | `Castle` | 28 | 12 |
| `the-rookie` | `rookie` | 22 | 5 |
| `loki` | `Loki` | 15 | 0 |
| `marvel` | `marvel` | 14 | 12 |
| `titans` | `titans` | 13 | 1 |
| `lucifer` | `Lucifer` | 13 | 0 |
| `game-of-thrones` | `GoT` | 12 | 3 |
| `companion` | `companion` | 11 | 0 |
| `suits` | `suits` | 10 | 0 |
| `the-closer` | `closer` | 10 | 0 |
| `saw` | `saw` | 9 | 0 |
| `star-trek-voyager` | `Voyager` | 8 | 1 |
| `alien` | `Alien` | 7 | 19 |
| `wednesday` | `Wednesday` | 7 | 7 |
| `300` | `300` | 7 | 1 |
| `one-piece` | `one piece` | 6 | 6 |
| `the-choice` | `Choice` | 6 | 1 |
| `what-if` | `What if` | 6 | 0 |
| `dc-comics` | `DC` | 4 | 41 |
| `fallout` | `fallout` | 3 | 3 |
| `labyrinth` | `Labyrinth` | 3 | 3 |
| `twilight` | `twilight` | 3 | 3 |
| `rent` | `rent` | 2 | 2 |
| `destiny` | `Destiny` | 1 | 2 |
| `predator` | `Predator` | 1 | 2 |
| `persona` | `persona` | 1 | 1 |
| `portal` | `portal` | 1 | 0 |
| `the-league` | `League` | 0 | 17 |
| `nurses` | `Nurses` | 0 | 1 |
| `dinosaurs` | `dinosaurs` | 0 | 0 |

### Unreviewed works

- 97 of the 699 works are `reviewed: false`, and events link 64 of them, on 239 events.
- By where they came from: the drafter, when the sidecar's `minted` holds the id; the tagger, when a cached answer names it otherwise - `tag_stage.py` keeps no record of what it mints, so this is inferred; other, neither.

| source | works | linked | on events |
| --- | ---: | ---: | ---: |
| drafter | 42 | 9 | 10 |
| tagger | 55 | 55 | 229 |
| other | 0 | 0 | 0 |
| all | 97 | 64 | 239 |

Linked by events: 64, listed in Appendix A. Linked by none: 33, counted here and not listed.

## 3. Axes

As built: where a track in `tracks.json` decides an axis, its values are the event's on that axis, and otherwise the model's are.

- Values used: `medium` 10 of 10; `genre` 6 of 6; `craft` 7 of 7; `subject` 11 of 11.
- Events by how many axis values they carry, the four axes together: 0: 286; 1: 895; 2: 1,433; 3: 557; 4: 197; 5: 74; 6: 15; 7: 2.

| axis | value | events | share of all events |
| --- | --- | ---: | ---: |
| `medium` | tabletop | 942 | 27.2% |
| `medium` | books | 415 | 12.0% |
| `medium` | tv | 357 | 10.3% |
| `medium` | film | 256 | 7.4% |
| `medium` | music | 147 | 4.2% |
| `medium` | video-games | 133 | 3.8% |
| `medium` | animation | 113 | 3.3% |
| `medium` | comics | 107 | 3.1% |
| `medium` | podcast-web | 99 | 2.9% |
| `medium` | anime | 96 | 2.8% |
| `genre` | fantasy | 731 | 21.1% |
| `genre` | sci-fi | 530 | 15.3% |
| `genre` | horror | 232 | 6.7% |
| `genre` | comedy | 221 | 6.4% |
| `genre` | superhero | 106 | 3.1% |
| `genre` | romance | 37 | 1.1% |
| `craft` | costuming | 309 | 8.9% |
| `craft` | writing | 269 | 7.8% |
| `craft` | performance | 201 | 5.8% |
| `craft` | photography | 171 | 4.9% |
| `craft` | art | 156 | 4.5% |
| `craft` | puppetry | 51 | 1.5% |
| `craft` | props-making | 39 | 1.1% |
| `subject` | fandom-culture | 333 | 9.6% |
| `subject` | community | 150 | 4.3% |
| `subject` | tech | 117 | 3.4% |
| `subject` | science | 87 | 2.5% |
| `subject` | history | 78 | 2.3% |
| `subject` | space | 67 | 1.9% |
| `subject` | paranormal | 55 | 1.6% |
| `subject` | skepticism | 33 | 1.0% |
| `subject` | politics | 31 | 0.9% |
| `subject` | fitness | 15 | 0.4% |
| `subject` | food | 10 | 0.3% |

## 4. Kind

- The largest kind is `panel` (1,086); `other` is on 78 (2.3%). Kinds in the list with no events: none.

Kind against type:

| kind | events | share | panel | gaming |
| --- | ---: | ---: | ---: | ---: |
| `panel` | 1,086 | 31.4% | 1,083 | 3 |
| `gaming` | 868 | 25.1% | 61 | 807 |
| `photo` | 506 | 14.6% | 506 | 0 |
| `performance` | 197 | 5.7% | 197 | 0 |
| `workshop` | 197 | 5.7% | 146 | 51 |
| `signing` | 137 | 4.0% | 137 | 0 |
| `qa` | 118 | 3.4% | 118 | 0 |
| `screening` | 116 | 3.4% | 116 | 0 |
| `other` | 78 | 2.3% | 71 | 7 |
| `contest` | 67 | 1.9% | 66 | 1 |
| `party` | 62 | 1.8% | 61 | 1 |
| `reading` | 25 | 0.7% | 25 | 0 |
| `tour` | 2 | 0.1% | 2 | 0 |

### v1 kind to v2 kind

- Of the 3,449 events v1 tagged, 3,147 keep their kind and 302 change. Events v1 left untagged, which have a kind now: 10.
- The pairs that differ: 42, over 312 events.

| v1 kind | v2 kind | events |
| --- | --- | ---: |
| `panel` | `performance` | 40 |
| `workshop` | `panel` | 34 |
| `panel` | `other` | 28 |
| `contest` | `gaming` | 25 |
| `panel` | `qa` | 25 |
| `panel` | `gaming` | 18 |
| `panel` | `workshop` | 14 |
| `panel` | `contest` | 13 |
| `party` | `other` | 13 |
| `contest` | `other` | 9 |
| `gaming` | `workshop` | 9 |
| `panel` | `screening` | 8 |
| `qa` | `panel` | 7 |
| (untagged) | `photo` | 6 |
| `performance` | `party` | 6 |
| `performance` | `workshop` | 5 |
| `gaming` | `other` | 4 |
| `party` | `workshop` | 4 |
| `performance` | `contest` | 4 |
| `workshop` | `other` | 4 |
| `gaming` | `panel` | 3 |
| `gaming` | `performance` | 3 |
| `party` | `performance` | 3 |
| `performance` | `other` | 3 |
| `reading` | `performance` | 3 |
| (untagged) | `signing` | 2 |
| `other` | `gaming` | 2 |
| `panel` | `party` | 2 |
| `party` | `contest` | 2 |
| (untagged) | `panel` | 1 |
| (untagged) | `qa` | 1 |
| `contest` | `party` | 1 |
| `contest` | `workshop` | 1 |
| `gaming` | `qa` | 1 |
| `other` | `qa` | 1 |
| `panel` | `signing` | 1 |
| `party` | `gaming` | 1 |
| `party` | `panel` | 1 |
| `party` | `photo` | 1 |
| `performance` | `panel` | 1 |
| `reading` | `panel` | 1 |
| `workshop` | `contest` | 1 |

### Wrestling: 5 - UNSURE

Every event whose title or description says wrestl*, with its kind. The kind is the tagger's answer, given the glosses in `tag_stage.KIND_GLOSSES`; the text match only chooses the rows. Each is a person's call, and where a kind is wrong the fix is a `"model": "hand"` line in the cache.

- UNSURE: `Dragon Con Wrestling` - 2026-09-03T19:00 - Main Programming - `performance` - in the title and description
- UNSURE: `Photoshoot: Pro Wrestling` - 2026-09-03T17:00 - Group Cosplay Photoshoot - `photo` - in the title
- UNSURE: `Return Of The Cosmic Crusaders` - 2026-09-04T19:00 - Collectible Card Games - `gaming` - in the description
- UNSURE: `Supershow The Game - 2026 Dragon*Con Championship` - 2026-09-06T19:00 - Collectible Card Games - `gaming` - in the description
- UNSURE: `The Thrilling Adventures of Victoria` - 2026-09-06T10:00 - Main Programming - `qa` - in the description

## 5. Audience

| audience | events | share |
| --- | ---: | ---: |
| `all` | 3,266 | 94.4% |
| `mature` | 105 | 3.0% |
| `kids` | 88 | 2.5% |

v1 `adult` against v2 `audience`:

| v1 adult | `all` | `kids` | `mature` |
| --- | ---: | ---: | ---: |
| false | 3,252 | 88 | 5 |
| true | 4 | 0 | 100 |
| (untagged) | 10 | 0 | 0 |

### Where each `mature` came from

The build makes an event mature where the parse (`facets.mature`), the model or a track says so, and nothing takes it away (#32). Tracks whose `audience` is mature: none.

| said by | events |
| --- | ---: |
| the parse and the model | 74 |
| the model | 30 |
| the parse | 1 |

### Audience against a track: 1

Every event whose audience is not what one of its tracks says, with the reason.

- `Grown-up Games: Warrior Cats, or Game of Thrones?` - 2026-09-05T22:00 - Kids Track - Kids Track says `kids`, and the event is `mature`: the parse (`min_age` 18) and the model

### `min_age` against audience

| min_age | `all` | `kids` | `mature` |
| --- | ---: | ---: | ---: |
| 13 | 0 | 1 | 0 |
| 16 | 1 | 0 | 1 |
| 17 | 0 | 0 | 14 |
| 18 | 0 | 0 | 12 |
| 21 | 0 | 0 | 2 |
| (none) | 3,265 | 87 | 76 |

## 6. Play

A gaming event is one whose scraped type or whose kind is `gaming`, and `play` is kept on those alone (`events_v2.py`).

- Gaming events: 931: 870 by type, and 61 more by kind. With `play`: 868. Without: 63.
- `play` on any other event: 0.

Format against level, on the 868:

| format | `beginner` | `any` | events |
| --- | ---: | ---: | ---: |
| `one-shot` | 105 | 278 | 383 |
| `organized-play` | 0 | 188 | 188 |
| `learn-to-play` | 133 | 0 | 133 |
| `tournament` | 6 | 67 | 73 |
| `demo` | 54 | 2 | 56 |
| `open-play` | 7 | 28 | 35 |

### Gaming events with no play: 63

By kind: `workshop` (51), `other` (7), `panel` (3), `contest` (1), `party` (1). By title:

| title | kind | events |
| --- | --- | ---: |
| `P&T: Beginner Workshop - Intro to Painting Miniatures` | `workshop` | 9 |
| `P&T: Kids Workshop - Intro to Painting (under 18 only)` | `workshop` | 5 |
| `P&T: Open Paint` | `workshop` | 5 |
| `P&T: Beginner Workshop - Speed Paints` | `workshop` | 4 |
| `P&T: Advanced Workshop - Faces & Skin` | `workshop` | 3 |
| `P&T: Golden Dragon Competition Submissions` | `other` | 3 |
| `P&T: Intermediate Workshop - Lenses & Gemstones` | `workshop` | 3 |
| `P&T: Advanced Workshop - Object Source Lighting (OSL)` | `workshop` | 2 |
| `P&T: Intermediate Workshop - Glazing with Acrylics` | `workshop` | 2 |
| `P&T: Intermediate Workshop - Weathering your Minis` | `workshop` | 2 |
| `Worn Wanderers Trading/Deckbuilding session` | `other` | 2 |
| `What's that Dinosaur?!?` | `panel` | 1 |
| `Arium: Building Atlanta- World building 101` | `workshop` | 1 |
| `Arium: Building sci-fi planets with Arium Creates` | `workshop` | 1 |
| `Booyah Bash` | `party` | 1 |
| `Golden Dragon Awards Ceremony` | `other` | 1 |
| `Help! My Magic Users Are Too Strong!` | `panel` | 1 |
| `MEMORIES` | `panel` | 1 |
| `P&T: Advanced Workshop - Color Theory & Composition` | `workshop` | 1 |
| `P&T: Advanced Workshop - Non-Metallic Metals (NMM)` | `workshop` | 1 |
| `P&T: Advanced Workshop - Quick & Dirty NMM` | `workshop` | 1 |
| `P&T: Advanced Workshop - Underpainting Minis` | `workshop` | 1 |
| `P&T: Beginner Workshop - Metallic Painting` | `workshop` | 1 |
| `P&T: Beginner Workshop - Sponge Painting` | `workshop` | 1 |
| `P&T: Golden Dragon Miniature Painting Competition - Speed Paint` | `contest` | 1 |
| `P&T: Intermediate Workshop - Basing` | `workshop` | 1 |
| `P&T: Intermediate Workshop - Edge Highlighting` | `workshop` | 1 |
| `P&T: Intermediate Workshop - Fabrics & Folds` | `workshop` | 1 |
| `P&T: Intermediate Workshop - Learn to Layer` | `workshop` | 1 |
| `P&T: Intermediate Workshop - Next Steps in Miniature Painting` | `workshop` | 1 |
| `P&T: Intermediate Workshop - Painting Fire & Flames` | `workshop` | 1 |
| `P&T: Intermediate Workshop - Painting Scales` | `workshop` | 1 |
| `P&T: Kids Workshop - Intro to Building Minis (under 18 only)` | `workshop` | 1 |
| `Titan Test Event` | `other` | 1 |

## 7. Guests and people

### `guests`

The highest tier among an event's reviewed people, else absent (#32, #34). This report is its baseline.

| guests | events | share |
| --- | ---: | ---: |
| (absent) | 2,976 | 86.0% |
| `celebrity` | 483 | 14.0% |

### The Celebrity badge

v1 `guests` against v2 `guests`:

| v1 guests | `celebrity` | `creator` | (absent) |
| --- | ---: | ---: | ---: |
| `fan` | 5 | 0 | 1,400 |
| `creator` | 28 | 0 | 1,160 |
| `celebrity` | 436 | 0 | 34 |
| `unknown` | 5 | 0 | 381 |
| (untagged) | 9 | 0 | 1 |

The 34 events v1 called `celebrity` that v2 does not are in Appendix C, with up to 5 of their people each.

### People

- Distinct ids: 1,798, over 6,408 appearances. An id is the registry's where it resolves the name, reviewed or not, and otherwise the name's slug (#34).

| src | ids | appearances |
| --- | ---: | ---: |
| `speakers` | 893 | 4,529 |
| `description` | 927 | 1,879 |

Status, by person: reviewed and drafted are `people.json` entries, `reviewed` true and false; rejected is the sidecar's `rejected`, by the drafter's model or by review; never drafted is everyone else.

| status | people | on qa, photo or signing events |
| --- | ---: | ---: |
| never drafted | 1,541 | 162 |
| drafted | 25 | 17 |
| rejected by model | 110 | 34 |
| rejected by review | 9 | 1 |
| reviewed | 113 | 100 |
| all | 1,798 | 314 |

### Drafted people: 25

Every `people.json` entry with `reviewed: false`: celebrities first, then by events, then by id. Confidence is the drafter's, from the sidecar. Each credit shows its work's own reviewed state; 0 of the 46 credits are reviewed themselves.

| id | name | tier | confidence | events | qa | photo | signing | other | credits |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `delilah-s-dawson` | `Delilah S Dawson` | creator | high | 13 | 0 | 0 | 3 | 10 | `star-wars-phasma` (unreviewed), `kill-the-farm-boy` (unreviewed), `the-shadow-series` (unreviewed) |
| `aaron-michael-ritchey` | `Aaron Michael Ritchey` | creator | low | 11 | 0 | 0 | 1 | 10 | none |
| `van-allen-plexico` | `Van Allen Plexico` | creator | low | 11 | 2 | 0 | 0 | 9 | `sentinels-2006` (unreviewed) |
| `s-m-stirling` | `S. M. Stirling` | creator | high | 10 | 0 | 0 | 2 | 8 | `dies-the-fire` (unreviewed), `island-in-the-sea-of-time` (unreviewed), `the-peshawar-lancers` (unreviewed) |
| `jim-butcher` | `Jim Butcher` | creator | high | 9 | 1 | 0 | 2 | 6 | `the-dresden-files` (unreviewed), `codex-alera` (unreviewed), `the-cinder-spires` (unreviewed) |
| `leanna-renee-hieber` | `Leanna Renee Hieber` | creator | high | 9 | 0 | 0 | 1 | 8 | `strangely-beautiful` (unreviewed), `the-eterna-files` (unreviewed) |
| `sherrilyn-kenyon` | `Sherrilyn Kenyon` | creator | high | 9 | 1 | 0 | 2 | 6 | `dark-hunter` (unreviewed), `chronicles-of-nick` (unreviewed), `the-league` (unreviewed), `deadmans-cross` (unreviewed) |
| `steve-saffel` | `Steve Saffel` | creator | low | 9 | 0 | 0 | 0 | 9 | none |
| `timothy-zahn` | `Timothy Zahn` | creator | high | 9 | 3 | 0 | 3 | 3 | `thrawn` (unreviewed), `heir-to-the-empire` (unreviewed), `cobra-1985` (unreviewed), `blackcollar` (unreviewed) |
| `richard-lord-british-garriott` | `Richard Lord British"" Garriott` | creator | high | 7 | 1 | 0 | 0 | 6 | `ultima` (unreviewed), `ultima-online` (unreviewed), `shroud-of-the-avatar` (unreviewed) |
| `elisa-teague` | `Elisa Teague` | creator | low | 6 | 0 | 0 | 0 | 6 | `tales-of-the-valiant` (reviewed) |
| `tony-diterlizzi` | `Tony DiTerlizzi` | creator | high | 6 | 2 | 0 | 0 | 4 | `the-spiderwick-chronicles` (unreviewed), `dungeons-and-dragons` (reviewed), `planescape` (unreviewed), `the-search-for-wondla` (unreviewed) |
| `b-dave-walters` | `B. Dave Walters` | creator | high | 5 | 0 | 0 | 0 | 5 | `dungeons-and-dragons` (reviewed) |
| `jordan-morris` | `Jordan Morris` | creator | low | 5 | 0 | 0 | 0 | 5 | `jordan-jesse-go` (unreviewed), `bubble` (unreviewed) |
| `kirk-thatcher` | `Kirk Thatcher` | creator | high | 5 | 1 | 0 | 0 | 4 | `the-muppets` (reviewed), `star-trek-iv-the-voyage-home` (unreviewed), `dinosaurs` (unreviewed) |
| `lyndsay-ely` | `Lyndsay Ely` | creator | low | 5 | 0 | 0 | 1 | 4 | `gunslinger-girl` (unreviewed) |
| `ben-singer-death-battle` | `Ben Singer Death Battle` | creator | high | 4 | 3 | 0 | 0 | 1 | `death-battle` (unreviewed) |
| `berta-platas` | `Berta Platas` | creator | low | 4 | 0 | 0 | 0 | 4 | none |
| `brian-c-thompson` | `Brian C. Thompson` | creator | low | 4 | 0 | 0 | 1 | 3 | none |
| `d-j-butler` | `D.J. Butler` | creator | low | 4 | 0 | 0 | 2 | 2 | `witchy-eye` (unreviewed) |
| `ken-napzok` | `Ken Napzok` | creator | low | 4 | 0 | 0 | 0 | 4 | `why-we-love-star-wars` (unreviewed) |
| `larry-niven` | `Larry Niven` | creator | high | 4 | 0 | 0 | 0 | 4 | `ringworld` (unreviewed), `the-mote-in-gods-eye` (unreviewed), `known-space` (unreviewed), `lucifers-hammer` (unreviewed) |
| `yaya-han` | `Yaya Han` | creator | high | 4 | 0 | 0 | 0 | 4 | `heroes-of-cosplay` (unreviewed) |
| `chad-james-death-battle` | `Chad James Death Battle` | creator | high | 3 | 3 | 0 | 0 | 0 | `death-battle` (unreviewed) |
| `starr-long` | `Starr Long` | creator | high | 1 | 1 | 0 | 0 | 0 | `ultima-online` (unreviewed), `shroud-of-the-avatar` (unreviewed) |

### Not in `people.json`, on qa, photo or signing events: 197

The top 30 by those events; all 197 are in Appendix B.

| name | id | status | qa | photo | signing | all events |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| `Patricia Briggs` | `patricia-briggs` | never drafted | 2 | 0 | 4 | 15 |
| `Matt Dinniman` | `matt-dinniman` | never drafted | 2 | 0 | 4 | 10 |
| `Primetime Steve` | `primetime-steve` | rejected by model | 6 | 0 | 0 | 6 |
| `John Jackson Miller` | `john-jackson-miller` | never drafted | 0 | 0 | 5 | 11 |
| `Tony P Henderson` | `tony-p-henderson` | rejected by model | 5 | 0 | 0 | 8 |
| `Marc Lee` | `marc-lee` | rejected by model | 5 | 0 | 0 | 7 |
| `Thomas Parham` | `thomas-parham` | rejected by model | 5 | 0 | 0 | 7 |
| `Brian Richardson` | `brian-richardson` | rejected by model | 5 | 0 | 0 | 6 |
| `Sammi Doneff` | `sammi-doneff` | rejected by model | 5 | 0 | 0 | 5 |
| `Carol Malcolm` | `carol-malcolm` | rejected by model | 4 | 0 | 0 | 21 |
| `Ingrid Seymour` | `ingrid-seymour` | never drafted | 0 | 0 | 4 | 9 |
| `Lydia Sherrer` | `lydia-sherrer` | never drafted | 0 | 0 | 4 | 9 |
| `Kevin J Anderson` | `kevin-j-anderson` | never drafted | 2 | 0 | 2 | 8 |
| `Colby Smith` | `colby-smith` | rejected by model | 4 | 0 | 0 | 7 |
| `Joey Davila` | `joey-davila` | rejected by model | 4 | 0 | 0 | 6 |
| `Bobby Blackwolf` | `bobby-blackwolf` | rejected by model | 4 | 0 | 0 | 5 |
| `Manda Montane` | `manda-montane` | rejected by model | 4 | 0 | 0 | 5 |
| `E.M. Meyers` | `e-m-meyers` | never drafted | 0 | 0 | 4 | 4 |
| `K. E. Deyarmin` | `k-e-deyarmin` | never drafted | 0 | 0 | 4 | 4 |
| `Shami A Stovall` | `shami-a-stovall` | never drafted | 0 | 0 | 3 | 11 |
| `R.R. Virdi` | `r-r-virdi` | never drafted | 0 | 0 | 3 | 10 |
| `A. J. Hartley` | `a-j-hartley` | never drafted | 0 | 0 | 3 | 9 |
| `Ashley Poston` | `ashley-poston` | never drafted | 2 | 0 | 1 | 9 |
| `Melissa Olthoff` | `melissa-olthoff` | never drafted | 0 | 0 | 3 | 9 |
| `Susan Griffith` | `susan-griffith` | never drafted | 0 | 0 | 3 | 9 |
| `Rob Levy` | `rob-levy` | rejected by model | 3 | 0 | 0 | 8 |
| `Ryan Cahill` | `ryan-cahill` | never drafted | 0 | 0 | 3 | 8 |
| `Dot R Steverson` | `dot-r-steverson` | rejected by model | 3 | 0 | 0 | 7 |
| `Christopher D. Schmitz` | `christopher-d-schmitz` | never drafted | 0 | 0 | 3 | 6 |
| `Silas Reames` | `silas-reames` | never drafted | 0 | 0 | 3 | 6 |

## 8. Tracks

Per track: its events; on each axis, the value on the most of them and its share of all of them, a tie going to the first value alphabetically, and "(tracks.json)" where `tracks.json` decides that axis; and the `via: track` links its work makes. An event with two tracks counts under both.

| track | events | `medium` | `genre` | `craft` | `subject` | `via: track` |
| --- | ---: | --- | --- | --- | --- | --- |
| Epic Photos | 318 | tv 17.9% | sci-fi 11.0% | - | - |  |
| Collectible Card Games | 240 | tabletop 100.0% (tracks.json) | fantasy 43.3% | - | - |  |
| Role-Playing Games (Non-Campaign) | 240 | tabletop 100.0% (tracks.json) | fantasy 50.0% | - | space 3.3% |  |
| Group Cosplay Photoshoot | 185 | video-games 21.1% | fantasy 28.6% | costuming 100.0% | fandom-culture 54.1% |  |
| Role-Playing Games (Campaign) | 177 | tabletop 100.0% (tracks.json) | fantasy 81.9% | - | - |  |
| Vendor Workshops/Events | 139 | books 77.7% | fantasy 0.7% | writing 29.5% | history 0.7% |  |
| Digital Media | 134 | podcast-web 57.5% | comedy 12.7% | performance 11.9% | community 21.6% |  |
| Miniatures Games | 123 | tabletop 100.0% | fantasy 25.2% | art 43.1% | history 0.8% |  |
| Main Programming | 96 | video-games 10.4% | comedy 6.2% | performance 19.8% | community 30.2% |  |
| Video Room | 88 | film 50.0% | fantasy 53.4% | puppetry 1.1% | space 4.5% |  |
| Costuming | 76 | film 3.9% | horror 2.6% | costuming 100.0% (tracks.json) | fandom-culture 13.2% |  |
| Comics and Pop Art | 67 | comics 100.0% (tracks.json) | superhero 35.8% | art 28.4% | fandom-culture 9.0% |  |
| Urban Fantasy | 67 | books 47.8% | fantasy 83.6% | writing 44.8% | fandom-culture 9.0% |  |
| Board Games | 65 | tabletop 100.0% (tracks.json) | sci-fi 9.2% | - | - |  |
| Alternate and Historical Fiction | 64 | tv 14.1% | romance 12.5% | costuming 12.5% | history 29.7% |  |
| American Sci-fi and Fantasy Media | 61 | tv 57.4% | superhero 50.8% | writing 6.6% | fandom-culture 9.8% |  |
| Video Gaming | 58 | video-games 89.7% | fantasy 27.6% | performance 6.9% | fandom-culture 12.1% |  |
| Trek Track | 52 | tv 92.3% | sci-fi 96.2% | performance 11.5% | fandom-culture 13.5% | 16 (`star-trek`) |
| Robotics and Maker Track | 51 | film 7.8% | sci-fi 3.9% | props-making 25.5% | tech 47.1% |  |
| BritTrack | 50 | tv 62.0% | sci-fi 30.0% | performance 10.0% | fandom-culture 6.0% |  |
| High Fantasy | 50 | books 58.0% | fantasy 100.0% (tracks.json) | writing 10.0% | community 6.0% |  |
| Animation | 48 | animation 100.0% (tracks.json) | comedy 25.0% | performance 12.5% | fandom-culture 16.7% |  |
| Kids Track | 48 | books 6.2% | comedy 6.2% | performance 18.8% | fandom-culture 14.6% |  |
| Table Top Gaming | 47 | tabletop 100.0% (tracks.json) | fantasy 29.8% | writing 17.0% | community 10.6% |  |
| American Sci-fi Classics | 45 | tv 48.9% | sci-fi 37.8% | performance 11.1% | fandom-culture 68.9% |  |
| Military Sci-fi Media | 45 | tv 77.8% | sci-fi 77.8% | puppetry 4.4% | fandom-culture 15.6% |  |
| Writer's Track | 44 | books 88.6% | fantasy 2.3% | writing 100.0% (tracks.json) | community 2.3% |  |
| Puppetry | 43 | film 9.3% | comedy 11.6% | puppetry 100.0% (tracks.json) | fandom-culture 4.7% |  |
| Science | 43 | film 7.0% | sci-fi 11.6% | - | science 100.0% (tracks.json) |  |
| Space | 42 | - | comedy 2.4% | photography 7.1% | space 100.0% (tracks.json) |  |
| XTrack | 41 | tv 14.6% | sci-fi 9.8% | - | paranormal 82.9% |  |
| Horror | 40 | film 35.0% | horror 100.0% (tracks.json) | writing 25.0% | fandom-culture 5.0% |  |
| Electronic Frontiers Forum | 39 | film 5.1% | fantasy 2.6% | art 2.6% | tech 100.0% (tracks.json) |  |
| Art Show Programming | 38 | books 7.9% | fantasy 23.7% | art 100.0% (tracks.json) | community 18.4% |  |
| Anime/Manga | 35 | anime 100.0% (tracks.json) | comedy 11.4% | costuming 8.6% | fandom-culture 37.1% |  |
| Apocalypse Rising | 35 | books 14.3% | sci-fi 20.0% | costuming 8.6% | food 11.4% |  |
| Diversity Track | 35 | comics 25.7% | sci-fi 11.4% | art 20.0% | community 62.9% |  |
| Filk Music | 35 | music 100.0% (tracks.json) | comedy 17.1% | performance 88.6% | fandom-culture 34.3% |  |
| Star Wars | 35 | film 48.6% | sci-fi 80.0% | costuming 14.3% | fandom-culture 11.4% | 14 (`star-wars`) |
| Fantasy Literature | 33 | books 90.9% | fantasy 75.8% | writing 60.6% | fandom-culture 18.2% |  |
| Live Performances - Hyatt Concourse | 32 | music 100.0% (tracks.json) | fantasy 3.1% | performance 100.0% | fandom-culture 9.4% |  |
| Workshops | 32 | books 68.8% | fantasy 6.2% | writing 68.8% | fitness 12.5% |  |
| Skeptics | 31 | tv 6.5% | comedy 12.9% | performance 16.1% | skepticism 100.0% (tracks.json) |  |
| Sci-fi Literature | 30 | books 43.3% | sci-fi 100.0% (tracks.json) | writing 36.7% | fandom-culture 6.7% |  |
| Silk Road | 29 | film 20.7% | horror 10.3% | performance 24.1% | fandom-culture 34.5% |  |
| Film Track | 28 | film 100.0% (tracks.json) | horror 10.7% | art 7.1% | tech 25.0% |  |
| Young Adult Literature | 28 | books 100.0% (tracks.json) | fantasy 25.0% | writing 35.7% | fandom-culture 53.6% |  |
| NSDMG / War College | 25 | tabletop 28.0% | sci-fi 28.0% | - | politics 56.0% |  |
| Reading Sessions | 22 | books 100.0% | - | writing 100.0% | - |  |
| Live Performances | 19 | music 100.0% (tracks.json) | horror 10.5% | performance 78.9% | - |  |
| Author Signings | 15 | books 100.0% | fantasy 13.3% | writing 20.0% | - |  |
| Werewolf Games | 12 | tabletop 100.0% (tracks.json) | - | - | - |  |
| Artemis Spaceship Bridge Simulator | 5 | video-games 100.0% (tracks.json) | sci-fi 100.0% | - | - |  |
| Live-Action Roleplaying Games | 3 | tabletop 100.0% | fantasy 100.0% | - | - |  |

### One value on 80% or more, on an axis `tracks.json` does not decide: 19 - UNSURE

- UNSURE: Group Cosplay Photoshoot - `craft`: costuming, on 185 of its 185 events (100.0%)
- UNSURE: Role-Playing Games (Campaign) - `genre`: fantasy, on 145 of its 177 events (81.9%)
- UNSURE: Miniatures Games - `medium`: tabletop, on 123 of its 123 events (100.0%)
- UNSURE: Urban Fantasy - `genre`: fantasy, on 56 of its 67 events (83.6%)
- UNSURE: Video Gaming - `medium`: video-games, on 52 of its 58 events (89.7%)
- UNSURE: Trek Track - `medium`: tv, on 48 of its 52 events (92.3%)
- UNSURE: Trek Track - `genre`: sci-fi, on 50 of its 52 events (96.2%)
- UNSURE: Writer's Track - `medium`: books, on 39 of its 44 events (88.6%)
- UNSURE: XTrack - `subject`: paranormal, on 34 of its 41 events (82.9%)
- UNSURE: Filk Music - `craft`: performance, on 31 of its 35 events (88.6%)
- UNSURE: Star Wars - `genre`: sci-fi, on 28 of its 35 events (80.0%)
- UNSURE: Fantasy Literature - `medium`: books, on 30 of its 33 events (90.9%)
- UNSURE: Live Performances - Hyatt Concourse - `craft`: performance, on 32 of its 32 events (100.0%)
- UNSURE: Reading Sessions - `medium`: books, on 22 of its 22 events (100.0%)
- UNSURE: Reading Sessions - `craft`: writing, on 22 of its 22 events (100.0%)
- UNSURE: Author Signings - `medium`: books, on 15 of its 15 events (100.0%)
- UNSURE: Artemis Spaceship Bridge Simulator - `genre`: sci-fi, on 5 of its 5 events (100.0%)
- UNSURE: Live-Action Roleplaying Games - `medium`: tabletop, on 3 of its 3 events (100.0%)
- UNSURE: Live-Action Roleplaying Games - `genre`: fantasy, on 3 of its 3 events (100.0%)

## 9. Recurring

### The cache

- Events: 3,459. Distinct inputs: 2,580. Cache lines: 2,580. Lines no event uses: 0.
- The model on each line: `claude-sonnet-5` (2,580).
- Lines corrected by hand, `"model": "hand"`: 0. DECISIONS #34 has an overrides file designed here once they pass a handful; at 0, nothing is designed.

### One title, more than one input

- `repeat_key` groups: 371, over 1,254 events. Groups whose occurrences sent the tagger more than one distinct input: 45.

Which field of the input varied, by groups; a group counts under each field that varied:

| field | groups |
| --- | ---: |
| `title` | 14 |
| `type` | 3 |
| `tracks` | 7 |
| `description` | 29 |

Which built tags differ, by groups: kind, the `about` works, each axis, audience and play. Credits and guests are left out, because they change with who is on stage.

| field | groups |
| --- | ---: |
| `kind` | 1 |
| `about` | 0 |
| `medium` | 0 |
| `genre` | 1 |
| `craft` | 2 |
| `subject` | 1 |
| `audience` | 1 |
| `play` | 3 |

### The groups whose built tags differ: 8

Each with the title its occurrences use most, the fields of the input that varied, and every built field that differs, with its values and how many occurrences carry each.

- `Call of Cthulhu 7E: The Haunting` - 5 events, 2 inputs, which differ in `description` - `play` one-shot / beginner (4), one-shot / any (1)
- `Concert – Clearly Guilty` - 2 events, 2 inputs, which differ in `description` - `audience` all (1), mature (1)
- `Hollowed Oath` - 2 events, 2 inputs, which differ in `type` - `kind` gaming (1), qa (1); `play` demo / any (1), none (1)
- `Kevin Carlson Autograph Session` - 2 events, 2 inputs, which differ in `tracks` - `craft` none (1), puppetry (1)
- `Matt Dinniman - Signing - SOLD OUT` - 3 events, 3 inputs, which differ in `title`, `tracks`, `description` - `craft` writing (2), none (1)
- `Mothership: The Haunting of Ypsilon 14` - 6 events, 2 inputs, which differ in `title`, `description` - `play` one-shot / any (3), one-shot / beginner (3)
- `Photo Session: Photo Session: Smallville` - 2 events, 2 inputs, which differ in `title` - `genre` none (1), superhero (1)
- `Smoochyface` - 2 events, 2 inputs, which differ in `tracks` - `subject` fandom-culture (1), none (1)

## 10. Links to check - UNSURE

`about` links a person may want to look at. Nothing here finds that a link is wrong: every row below that says UNSURE is a person's call, and where a link is wrong the fix is a person's, a `"model": "hand"` line in `tags.cache.jsonl` (#34). Track and credit links are not asked about here.

### Resume mentions: 49

The model's own `about` links, as built, each with the evidence it gave. A link is a candidate when its evidence is in the description the model was sent and not in the title, and the title does not hold the work's name or an alias, whole words, folded, by the pilot's `word_in` - a match that only chooses rows. A candidate is listed when it shares its input with another candidate, or when one of these ends within 60 characters before its evidence: worked on, work on, credits, credited, known for, such as, including. One row a link, with the events that sent its input and about 80 characters of the description around the evidence.

- `Specialty Costumes`, the known case, is not among them: its cached answer names no work.
- UNSURE: `1931: Horror Goes Hollywood` (1 event) - `dracula`, evidence `Dracula` - shares its input with another - `...ormed the foundation for horror cinema: Dracula, Frankenstein, and Dr. Jekyll, and Mr. ...`
- UNSURE: `1931: Horror Goes Hollywood` (1 event) - `frankenstein`, evidence `Frankenstein` - shares its input with another - `... foundation for horror cinema: Dracula, Frankenstein, and Dr. Jekyll, and Mr. Hyde. Join our...`
- UNSURE: `1931: Horror Goes Hollywood` (1 event) - `dr-jekyll-and-mr-hyde`, evidence `Dr. Jekyll, and Mr. Hyde` - shares its input with another - `...rror cinema: Dracula, Frankenstein, and Dr. Jekyll, and Mr. Hyde. Join our panel of horror historians, f...`
- UNSURE: `A Look Back at Heavy Metal Magazine` (1 event) - `the-melting-pot`, evidence `graphic novel The Melting Pot` - shares its input with another - `...agazine, as well as the creators of the graphic novel The Melting Pot, which became the animated movie Heavy ...`
- UNSURE: `A Look Back at Heavy Metal Magazine` (1 event) - `heavy-metal-2000`, evidence `animated movie Heavy Metal 2000` - shares its input with another - `...novel The Melting Pot, which became the animated movie Heavy Metal 2000.`
- UNSURE: `Academic: Post-Modern Superheroes – Power, Violence, & Trauma` (1 event) - `the-boys`, evidence `The Boys` - shares its input with another - `...media, focused on the television series The Boys and Watchmen, focusing on the themes of...`
- UNSURE: `Academic: Post-Modern Superheroes – Power, Violence, & Trauma` (1 event) - `watchmen`, evidence `Watchmen` - shares its input with another - `...d on the television series The Boys and Watchmen, focusing on the themes of violence, tr...`
- UNSURE: `An Hour with Jim Butcher` (1 event) - `the-dresden-files`, evidence `the Dresden Files` - shares its input with another - `Audience Q&A with the Author of the Dresden Files, the Cinder Spires, & Codex Alera serie...`
- UNSURE: `An Hour with Jim Butcher` (1 event) - `the-cinder-spires`, evidence `the Cinder Spires` - shares its input with another - `...A with the Author of the Dresden Files, the Cinder Spires, & Codex Alera series.`
- UNSURE: `An Hour with Jim Butcher` (1 event) - `codex-alera`, evidence `Codex Alera series` - shares its input with another - `...the Dresden Files, the Cinder Spires, & Codex Alera series.`
- UNSURE: `An Hour with Patricia Briggs` (1 event) - `mercy-thompson`, evidence `Mercy Thompson` - shares its input with another - `Audience Q&A with the author of the Mercy Thompson and Alpha & Omega series.`
- UNSURE: `An Hour with Patricia Briggs` (1 event) - `alpha-and-omega`, evidence `Alpha & Omega series` - shares its input with another - `...th the author of the Mercy Thompson and Alpha & Omega series.`
- UNSURE: `An Hour with Sherrilyn Kenyon` (1 event) - `chronicles-of-nick`, evidence `Chronicles of Nick` - shares its input with another - `...&A with the author of the Dark-Hunters, Chronicles of Nick, Deadman's Cross, Eve of Destruction, N...`
- UNSURE: `An Hour with Sherrilyn Kenyon` (1 event) - `deadmans-cross`, evidence `Deadman's Cross` - shares its input with another - `...f the Dark-Hunters, Chronicles of Nick, Deadman's Cross, Eve of Destruction, Nevermore, Lords o...`
- UNSURE: `Bad to the Bone: Villains in the Bedroom` (1 event) - `marvel`, evidence `Marvel` - shares its input with another - `...reaks, let's share a spirited debate on Marvel & DC's most infamous villains! We'll de...`
- UNSURE: `Bad to the Bone: Villains in the Bedroom` (1 event) - `dc-comics`, evidence `DC` - shares its input with another - `...t's share a spirited debate on Marvel & DC's most infamous villains! We'll decide ...`
- UNSURE: `Beyond 'The Burn': Reckoning with Hegemony in Streaming-Era Star Trek` (1 event) - `star-trek-discovery`, evidence `Discovery (seasons 3-5)` - shares its input with another - `...f political commentary, focusing on how Discovery (seasons 3-5) and Starfleet Academy respond to and co...`
- UNSURE: `Beyond 'The Burn': Reckoning with Hegemony in Streaming-Era Star Trek` (1 event) - `star-trek-starfleet-academy`, evidence `Starfleet Academy` - shares its input with another - `...sing on how Discovery (seasons 3-5) and Starfleet Academy respond to and comment on the role and ...`
- UNSURE: `Classic British Horror: From Gothic Ink to 2026 Screens` (1 event) - `frankenstein`, evidence `Frankenstein` - shares its input with another - `...xplore the Classic British Horror icons Frankenstein, Dracula, and Jekyll & Hyde. From Shell...`
- UNSURE: `Classic British Horror: From Gothic Ink to 2026 Screens` (1 event) - `dracula`, evidence `Dracula` - shares its input with another - `...ssic British Horror icons Frankenstein, Dracula, and Jekyll & Hyde. From Shelley, Stoke...`
- UNSURE: `Classic British Horror: From Gothic Ink to 2026 Screens` (1 event) - `dr-jekyll-and-mr-hyde`, evidence `Jekyll & Hyde` - shares its input with another - `...Horror icons Frankenstein, Dracula, and Jekyll & Hyde. From Shelley, Stoker, and Stevenson's ...`
- UNSURE: `Creating an Accessible Starfleet Vessel` (1 event) - `star-trek-the-next-generation`, evidence `TNG's leaning-prone touchscreens` - shares its input with another - `Star Trek's UI fails: TNG's leaning-prone touchscreens, spoken passwords, ENT's rogue rolly ch...`
- UNSURE: `Creating an Accessible Starfleet Vessel` (1 event) - `star-trek-enterprise`, evidence `ENT's rogue rolly chairs` - shares its input with another - `...g-prone touchscreens, spoken passwords, ENT's rogue rolly chairs – fun, but flawed design! Could future ...`
- UNSURE: `DC Comics' Animated TV Shows` (1 event) - `young-justice`, evidence `Young Justice: Greg Weisman` - shares its input with another - `...e. We talk with Creator & Showrunner of Young Justice: Greg Weisman and Josie Campbell, the Showrunner for ...`
- UNSURE: `DC Comics' Animated TV Shows` (1 event) - `my-adventures-with-superman`, evidence `My Adventures of Superman` - shares its input with another - `... and Josie Campbell, the Showrunner for My Adventures of Superman as well as the new Starfire series.`
- UNSURE: `DC Comics' Animated TV Shows` (1 event) - `starfire`, evidence `the new Starfire series` - shares its input with another - `...or My Adventures of Superman as well as the new Starfire series.`
- UNSURE: `Diversity and Representation in Comics` (1 event) - `x-men`, evidence `X-Men comics` - shares its input with another - `..., from the influence of Deaf Culture on X-Men comics to the representation of women, people ...`
- UNSURE: `Diversity and Representation in Comics` (1 event) - `cutey-bunny`, evidence `Joshua Quagmire's Cutey Bunny` - shares its input with another - `...eople of color, and Queer characters in Joshua Quagmire's Cutey Bunny.(Mature Audience)`
- UNSURE: `Doctor Who Trivia (Adults)` (1 event) - `torchwood`, evidence `Torchwood's legacy` - shares its input with another - `... for a deep-dive trivia challenge! From Torchwood's legacy to the 2026 spinoff The War Between the...`
- UNSURE: `Doctor Who Trivia (Adults)` (1 event) - `the-war-between-the-land-and-the-sea`, evidence `the 2026 spinoff The War Between the Land and the Sea` - shares its input with another - `...a challenge! From Torchwood's legacy to the 2026 spinoff The War Between the Land and the Sea, we're testing your knowledge of the Do...`
- UNSURE: `Duty, Loyalty, and Honor: Colliding Allegiances in MSF Media` (1 event) - `babylon-5`, evidence `looking at Babylon 5` - shares its input with another - `... happens when they're blurred? We'll be looking at Babylon 5 and Halo for some deep dives into speci...`
- UNSURE: `Duty, Loyalty, and Honor: Colliding Allegiances in MSF Media` (1 event) - `halo`, evidence `and Halo for some deep dives` - shares its input with another - `... blurred? We'll be looking at Babylon 5 and Halo for some deep dives into specific conflict cases and resolu...`
- UNSURE: `From Netflix to the MCU: Marvel's Street-Level Heroes Evolve` (1 event) - `daredevil`, evidence `Daredevil's return` - shares its input with another - `...etflix heroes have found new life. With Daredevil's return and growing expectations for Jessica Jo...`
- UNSURE: `From Netflix to the MCU: Marvel's Street-Level Heroes Evolve` (1 event) - `jessica-jones`, evidence `Jessica Jones` - shares its input with another - `...l's return and growing expectations for Jessica Jones and Luke Cage, the street-level corner ...`
- UNSURE: `From Netflix to the MCU: Marvel's Street-Level Heroes Evolve` (1 event) - `luke-cage`, evidence `Luke Cage` - shares its input with another - `...wing expectations for Jessica Jones and Luke Cage, the street-level corner of Marvel is n...`
- UNSURE: `Horse Figures & Human Struggles in Animation` (1 event) - `bojack-horseman`, evidence `Bojack Horseman` - shares its input with another - `...opomorphized horses as main characters (Bojack Horseman and Spirit: Stallion of the Cimarron).`
- UNSURE: `Horse Figures & Human Struggles in Animation` (1 event) - `spirit-stallion-of-the-cimarron`, evidence `Spirit: Stallion of the Cimarron` - shares its input with another - `...as main characters (Bojack Horseman and Spirit: Stallion of the Cimarron).`
- UNSURE: `Learning Session: Alternate History in Gaming` (1 event) - `gloom`, evidence `Gloom` - shares its input with another - `...ew tabletop game. This year, we'll have Gloom, Hollywood 1947, and more games availab...`
- UNSURE: `Learning Session: Alternate History in Gaming` (1 event) - `hollywood-1947`, evidence `Hollywood 1947` - shares its input with another - `...etop game. This year, we'll have Gloom, Hollywood 1947, and more games available. Supplies are...`
- UNSURE: `Meet the Hellaverse Cast` (1 event) - `hazbin-hotel`, evidence `the Speaker, Stella, and the (Hellaverse) Creator` - shares its input with another - `Feathers fly as we host the Speaker, Stella, and the (Hellaverse) Creator herself. Join Viv Medrano, Liz Calloway...`
- UNSURE: `Meet the Hellaverse Cast` (1 event) - `helluva-boss`, evidence `the Speaker, Stella, and the (Hellaverse) Creator` - shares its input with another - `Feathers fly as we host the Speaker, Stella, and the (Hellaverse) Creator herself. Join Viv Medrano, Liz Calloway...`
- UNSURE: `Robots and Teeth: The Puppetry of Kevin Carlson` (1 event) - `pee-wees-playhouse`, evidence `Conky on Pee-wee's Playhouse` - after "known for" - `Best known for Conky on Pee-wee's Playhouse and the title character on The Adventur...`
- UNSURE: `The Brontë Sisters: Adapting Charlotte, Emily, & Anne` (1 event) - `jane-eyre`, evidence `Jane Eyre` - shares its input with another - `Beyond the moors of Jane Eyre and Wuthering Heights lies a world of g...`
- UNSURE: `The Brontë Sisters: Adapting Charlotte, Emily, & Anne` (1 event) - `wuthering-heights`, evidence `Wuthering Heights` - shares its input with another - `Beyond the moors of Jane Eyre and Wuthering Heights lies a world of gothic secrets. We unea...`
- UNSURE: `The Wonderful World of Oz Sing-along` (1 event) - `the-wizard-of-oz`, evidence `Wizard of Oz` - shares its input with another - `...no place like this sing-along! From the Wizard of Oz to the Wiz and Wicked on stages and scr...`
- UNSURE: `The Wonderful World of Oz Sing-along` (1 event) - `the-wiz`, evidence `the Wiz` - shares its input with another - `...e's no place like this sing-along! From the Wizard of Oz to the Wiz and Wicked on stage...`
- UNSURE: `The Wonderful World of Oz Sing-along` (1 event) - `wicked`, evidence `Wicked` - shares its input with another - `...g! From the Wizard of Oz to the Wiz and Wicked on stages and screens, journey through ...`
- UNSURE: `Â¡SUPER LUCHA! Saturday Night` (1 event) - `supershow-the-game`, evidence `Supershow The Game` - shares its input with another - `New player friendly sealed event for Supershow The Game; Â¡Super Lucha! is a collaboration with...`
- UNSURE: `Â¡SUPER LUCHA! Saturday Night` (1 event) - `mucha-lucha`, evidence `¡Mucha Lucha!` - shares its input with another - `...laboration with Eddie Mort, creator of Â¡Mucha Lucha!, based on that zany luchador universe.`

### Bands (a): works linked from music events: 25

Every work an event with `medium: music` links `about`: how many of those events link it, and every event that links it `about`, by kind.

| work | music events | its `about` events, by kind |
| --- | ---: | --- |
| `buffy-the-vampire-slayer` | 3 | `panel` (2), `performance` (2) |
| `wicked` | 2 | `panel` (1), `performance` (1), `photo` (1) |
| `moulin-rouge` | 2 | `panel` (1), `performance` (1) |
| `rent` | 2 | `panel` (1), `performance` (1) |
| `sleep-token` | 2 | `panel` (1), `photo` (1) |
| `star-forest` | 2 | `party` (1), `workshop` (1) |
| `the-cruxshadows` | 2 | `performance` (1), `qa` (1) |
| `the-hobbit` | 1 | `gaming` (11), `panel` (1), `performance` (1), `photo` (1) |
| `firefly` | 1 | `photo` (6), `qa` (2), `panel` (1), `performance` (1) |
| `the-lord-of-the-rings` | 1 | `panel` (4), `gaming` (3), `qa` (1), `workshop` (1) |
| `the-legend-of-zelda` | 1 | `gaming` (1), `panel` (1), `photo` (1), `workshop` (1) |
| `k-pop-demon-hunters` | 1 | `performance` (1), `photo` (1) |
| `welcome-to-night-vale` | 1 | `performance` (1), `qa` (1) |
| `120-minutes` | 1 | `party` (1) |
| `brobdingnagian-bards` | 1 | `performance` (1) |
| `cabaret` | 1 | `performance` (1) |
| `charming-disaster` | 1 | `qa` (1) |
| `der-kaiser-von-atlantis` | 1 | `panel` (1) |
| `eurovision` | 1 | `photo` (1) |
| `psychostick` | 1 | `performance` (1) |
| `rocky-horror-picture-show` | 1 | `performance` (1) |
| `spice-girls` | 1 | `performance` (1) |
| `the-wiz` | 1 | `performance` (1) |
| `the-wizard-of-oz` | 1 | `performance` (1) |
| `twenty-one-pilots` | 1 | `photo` (1) |

### Bands (b): music performances with no work: 72

Every `performance` event with `medium: music` and no `about` work. A row is marked UNSURE where its title holds a registry work's name or alias, whole words, folded: the only list that matches work names, and it reads titles only.

- `Aurelio Voltaire` - 2026-09-05T23:00 - Live Performances
- `Bathroom of the Future` - 2026-09-05T01:30 - Live Performances
- `Bathroom of the Future` - 2026-09-06T22:00 - Live Performances - Hyatt Concourse
- `Be the First to Sign up for Dark Horse Live Band Karaoke!` - 2026-09-04T20:00 - Live Performances
- `Beth Patterson` - 2026-09-04T16:00 - Live Performances - Hyatt Concourse
- `Beth Patterson` - 2026-09-05T14:30 - Live Performances - Hyatt Concourse
- `Beth Patterson` - 2026-09-06T17:30 - Live Performances - Hyatt Concourse
- `Bit Brigade` - 2026-09-07T00:00 - Live Performances
- `Brobdignagian Bards` - 2026-09-06T14:00 - Live Performances - Hyatt Concourse
- `CLOUDSAVE` - 2026-09-04T22:00 - Live Performances - Hyatt Concourse
- `CLOUDSAVE` - 2026-09-07T01:30 - Live Performances
- `Concert - The Blibbering Humdingers` - 2026-09-06T19:00 - Filk Music
- `Concert - Tim Griffin` - 2026-09-04T16:00 - Filk Music
- `Concert – Andrew McKee` - 2026-09-06T11:30 - Filk Music
- `Concert – Chuck Parker` - 2026-09-04T14:30 - Filk Music
- `Concert – Chuck Parker` - 2026-09-06T13:00 - Filk Music
- `Concert – Clearly Guilty` - 2026-09-05T17:30 - Filk Music
- `Concert – Clearly Guilty` - 2026-09-06T22:00 - Filk Music
- `Concert – Corwyn the Bardbarian` - 2026-09-05T14:30 - Filk Music
- `Concert – Emily Henry` - 2026-09-04T13:00 - Filk Music
- `Concert – Emily Henry` - 2026-09-06T14:30 - Filk Music
- `Concert – Foot Pound Force` - 2026-09-04T20:30 - Filk Music
- `Concert – Foot Pound Force` - 2026-09-06T20:30 - Filk Music
- `Concert – Mikey Mason` - 2026-09-06T20:30 - Filk Music
- `Concert – The Blibbering Humdingers` - 2026-09-04T19:00 - Filk Music
- `Concert – The Gekkos` - 2026-09-04T11:30 - Filk Music
- `Concert – The Gekkos` - 2026-09-05T16:00 - Filk Music
- `Concert – Tim Griffin` - 2026-09-06T16:00 - Filk Music
- `Concert – Tom Smith` - 2026-09-04T17:30 - Filk Music
- `Concert – Tom Smith` - 2026-09-06T17:30 - Filk Music
- `Concourse Presents: Killbillies, Corsets & Kilts!` - 2026-09-06T19:00 - Live Performances - Hyatt Concourse
- `Danger Woman, The Songbird of Justice – LIVE!` - 2026-09-05T19:00 - Main Programming
- `Dark Horse LIVE Band Karaoke` - 2026-09-04T20:30 - Live Performances
- `Denim Arcade` - 2026-09-05T00:00 - Live Performances
- `Denim Arcade` - 2026-09-05T17:30 - Live Performances - Hyatt Concourse
- `Diversity In DIY Rave Music` - 2026-09-03T20:30 - Digital Media
- `Diversity In DIY Rave Music` - 2026-09-03T20:30 - Digital Media
- `Dusty Gannon & The Agonal Gasps` - 2026-09-04T00:30 - Live Performances
- `Dusty Gannon & The Agonal Gasps` - 2026-09-05T22:00 - Live Performances - Hyatt Concourse
- `Early Morning Open Filk` - 2026-09-06T10:00 - Filk Music
- UNSURE: `Eurovision Karaoke` - 2026-09-05T23:30 - BritTrack - the title holds `Eurovision` (`eurovision`)
- `Filk & Cookies – Open Filk` - 2026-09-04T10:00 - Filk Music
- `Filk Two by Tens (2x10s)` - 2026-09-05T19:00 - Filk Music
- `Foot Pound Force` - 2026-09-06T15:00 - Live Performances - Hyatt Concourse
- `Galactic Empire` - 2026-09-06T00:00 - Live Performances
- `Geeky Sea Shanties` - 2026-09-03T20:30 - Alternate and Historical Fiction
- `Geeky Sea Shanties` - 2026-09-03T20:30 - Filk Music
- `Georgia Philharmonic Orchestra Presents – LIVE!` - 2026-09-05T20:00 - Main Programming
- `Gonzoroo Presents: A Music & Comedy Spectacular` - 2026-09-05T20:30 - Main Programming
- `Killbillies` - 2026-09-04T20:30 - Live Performances - Hyatt Concourse
- `Killbillies` - 2026-09-05T20:30 - Live Performances - Hyatt Concourse
- `Kinnfolk – LIVE!` - 2026-09-04T13:00 - Live Performances - Hyatt Concourse
- `Kinnfolk – LIVE!` - 2026-09-05T16:00 - Live Performances - Hyatt Concourse
- `Kinnfolk – LIVE!` - 2026-09-06T20:30 - Live Performances - Hyatt Concourse
- `Kinnfolk – LIVE!` - 2026-09-07T14:30 - Live Performances - Hyatt Concourse
- `LandLoch'd` - 2026-09-05T19:00 - Live Performances - Hyatt Concourse
- `LandLoch'd` - 2026-09-06T19:00 - Live Performances - Hyatt Concourse
- `Landloch'd` - 2026-09-04T14:30 - Live Performances - Hyatt Concourse
- `Last Grasp` - 2026-09-07T00:00 - Live Performances
- `Mercer Petterson` - 2026-09-04T17:30 - Live Performances - Hyatt Concourse
- `Mercer Petterson` - 2026-09-06T16:00 - Live Performances - Hyatt Concourse
- `Mikey Mason` - 2026-09-06T13:00 - Live Performances - Hyatt Concourse
- `Nerdy Irish Pub Song Sing-along` - 2026-09-07T11:30 - Digital Media
- `Nerdy Irish Pub Song Sing-along` - 2026-09-07T11:30 - Digital Media
- `Not Safe For Con – After Dark Round Robin` - 2026-09-05T22:00 - Filk Music
- `Silk Road Performance Expo` - 2026-09-06T14:30 - Silk Road
- `Smoochyface` - 2026-09-03T23:00 - Live Performances
- `Smoochyface` - 2026-09-04T19:00 - Live Performances - Hyatt Concourse
- `The Cybertronic Spree` - 2026-09-04T23:30 - Live Performances
- `The Great Geek Sing-along` - 2026-09-03T20:30 - American Sci-fi and Fantasy Media, American Sci-fi Classics
- `The Tan and Sober Gentlemen` - 2026-09-05T01:30 - Live Performances
- `Video Game Karaoke` - 2026-09-03T19:00 - Video Gaming

## 11. v1 against v2

Each of v1's fandom assignments, resolved through `works.json`, against the event's v2 works of any via, walking parents: the same work; more specific, where v2 names a descendant; less specific, where v2 names an ancestor; or lost. Left out: the five fandom names that are axis values in v2 - Animation (medium: animation), Anime (medium: anime), Comics (medium: comics), Fantasy (genre: fantasy), Video Games (medium: video-games). Their assignments: 50. v1 names no work resolves: 0.

| class | assignments | share |
| --- | ---: | ---: |
| same | 577 | 70.8% |
| more specific | 137 | 16.8% |
| lost | 95 | 11.7% |
| less specific | 6 | 0.7% |

The lost, by the event's v2 kind:

| kind | assignments |
| --- | ---: |
| `panel` | 33 |
| `gaming` | 24 |
| `performance` | 14 |
| `photo` | 8 |
| `qa` | 7 |
| `signing` | 5 |
| `other` | 1 |
| `party` | 1 |
| `screening` | 1 |
| `workshop` | 1 |

v2 `about` links on the events v1 gave no fandom: 930. By kind:

| kind | links |
| --- | ---: |
| `gaming` | 496 |
| `panel` | 151 |
| `photo` | 114 |
| `qa` | 53 |
| `screening` | 48 |
| `performance` | 45 |
| `party` | 8 |
| `contest` | 4 |
| `signing` | 4 |
| `workshop` | 4 |
| `other` | 2 |
| `reading` | 1 |

### Lost, by fandom: 95

Fandoms: 27.

**Dungeons & Dragons** (12)

- `DM Workshop: Ideas to Make Tabletop More Interesting` (2)
- `Call of Cthulhu 7E: The Haunting`
- `Creating Magic Items Deep Dive`
- `Dungeon Crawl Classics: Sailors on the Starless Sea`
- `Dungeons & Randomness Q&A – LIVE!`
- `Help! My Magic Users Are Too Strong!`
- `In Defense of Spell Components`
- `Oops!! All Wizards`
- `Pathfinder 2E: Grimm Tales - Snowy Vengeance 1 of 3`
- `Roll Against Fear: Tales of the Valiant – LIVE!`
- `Throwdown! Dungeon Debate`

**Doctor Who** (9)

- `Mothership: The Haunting of Ypsilon-14` (2)
- `Nerdy Irish Pub Song Sing-along` (2)
- `Costuming in British Media!`
- `Felt Nerdy's Stargate Puppet Show!`
- `Licensed Properties in Comics`
- `So Long, and Thanks for All the Fish: BritTrack Feedback Panel`
- `Watching Movies to Make You a Better Writer **EXTRA FEE WORKSHOP**`

**Magic: The Gathering** (9)

- `Command Zone Package` (4)
- `Convention League` (4)
- `DDAL FR-DC-TDD-03: The Zephyr's Fold`

**Marvel** (8)

- `Activate Your Spider-Senses IRL with Stretchable Electronics`
- `DAWN: Bringing JARVIS into Your Home & Armor`
- `Famous Superhero & Villain Grudges`
- `From Star Wars to Marvel Animation: An Hour with Henry Gilroy`
- `Specialty Costumes`
- `Ups and Downs in Superhero Love Lives`
- `Witchy Comics: Magic in Comics`
- `With Great Trivia Comes Great Responsibility`

**Star Wars** (8)

- `Blood Feud: Back to the Minors`
- `English Paper Piece! Many Choices! 4:00 - 6:00 SOLD OUT`
- `From Star Wars to Marvel Animation: An Hour with Henry Gilroy`
- `Galactic Empire`
- `How Did You Get So Lucky? – An Hour with Kirk Thatcher`
- `Roommates & Workers Wanted: These ARE the Droids You're Looking for`
- `Timothy Zahn signing`
- `Watching Movies to Make You a Better Writer **EXTRA FEE WORKSHOP**`

**DC Comics** (7)

- `African and African-American Comics`
- `Famous Superhero & Villain Grudges`
- `Matt Wagner: From Grendel to Dracula`
- `Specialty Costumes`
- `Ups and Downs in Superhero Love Lives`
- `Witchy Comics: Magic in Comics`
- `With Great Trivia Comes Great Responsibility`

**The Lord of the Rings** (6)

- `An Evening In Bree`
- `Brobdignagian Bards`
- `Coming Soon: The Magician's Nephew`
- `LOotR: Ribbon Drop STAGING (Participants ONLY)`
- `Please Adapt This`
- `The Mentorship of Moiraine`

**Star Trek** (5)

- `Felt Nerdy's Stargate Puppet Show!`
- `Galaxy Quest`
- `How Did You Get So Lucky? – An Hour with Kirk Thatcher`
- `Photo Session: Photo session: Michael Shanks Solo`
- `Photo Session: Photo session: Stargate - SG1`

**Firefly** (4)

- `Nerdy Irish Pub Song Sing-along` (2)
- `MSFM MAD-LIBs – LIVE!`
- `Mikey Mason`

**Pokemon** (4)

- `Mario Night`
- `Photoshoot: Dragonball`
- `Photoshoot: Sonic and Friends/Villains`
- `What Exactly Is Kirby?`

**My Hero Academia** (3)

- `Chuck Huber & Phil Parsons Signing – Vendors Booth # 2529`
- `Chuck Huber and Phil Parsons Signing – Booth #2529`
- `Phil Parsons and Chuck Huber Signing – Vendors Booth 2529`

**Warhammer 40,000** (3)

- `Battletech Classic - Boot Camp`
- `Battletech Classic - NAIS Adv. Combat School`
- `Battletech Classic - Rivalry`

**Stranger Things** (2)

- `Licensed Properties in Comics`
- `Tales from the Loop: Friend or Foe?`

**The Expanse** (2)

- `Built on Big Ideas: The Renaissance of Hard SF Media`
- `Photoshoot: Dresden Files, Alera & Cinder Spires`

**Babylon 5** (1)

- `MSFM MAD-LIBs – LIVE!`

**Chainsaw Man** (1)

- `CAIN: JJK/Chainsaw Man + XFiles/SCP/Control`

**Fallout** (1)

- `Photoshoot: The Pitt`

**Game of Thrones** (1)

- `Photoshoot: We Do Not Care Club`

**Hazbin Hotel** (1)

- `Alastor Explains Asexuality`

**Jujutsu Kaisen** (1)

- `CAIN: JJK/Chainsaw Man + XFiles/SCP/Control`

**Mighty Morphin Power Rangers** (1)

- `Chuck Huber and Phil Parsons Signing – Booth #2529`

**Rick and Morty** (1)

- `Adult Swim, Awesome Games, Great Job!`

**Stargate** (1)

- `MSFM MAD-LIBs – LIVE!`

**The Muppets** (1)

- `How Did You Get So Lucky? – An Hour with Kirk Thatcher`

**The NeverEnding Story** (1)

- `Kirk and Kendall Have a Panel`

**Transformers** (1)

- `Licensed Properties in Comics`

**Vikings** (1)

- `Photoshoot: Vikings`

## 12. Text

### Double-encoded events: 45

Text that was UTF-8 read as cp1252 before it reached the frozen file, by `draft_people.looks_double_encoded` over title and description (ROADMAP, Pipeline shape). `events.v2.json` copies the scraped fields as they are. By track:

| track | events |
| --- | ---: |
| Role-Playing Games (Campaign) | 27 |
| Role-Playing Games (Non-Campaign) | 17 |
| Collectible Card Games | 1 |

- `CMP 2083-24: Fortune At The Finish Line` - 2026-09-07T09:00 - Role-Playing Games (Campaign)
- `Call of Cthulhu 7E: Homecoming 1956` - 2026-09-04T18:00 - Role-Playing Games (Non-Campaign)
- `Call of Cthulhu 7E: The Haunting` - 2026-09-07T09:00 - Role-Playing Games (Non-Campaign)
- `D&D 5.5E: Last Train to Waterdeep` - 2026-09-04T13:00 - Role-Playing Games (Non-Campaign)
- `DDAL FR-DC-CGB-04: A Hareowing Tale` - 2026-09-04T09:00 - Role-Playing Games (Campaign)
- `DDAL FR-DC-CGB-04: A Hareowing Tale` - 2026-09-04T20:00 - Role-Playing Games (Campaign)
- `DDAL FR-DC-CGB-04: A Hareowing Tale` - 2026-09-05T14:00 - Role-Playing Games (Campaign)
- `DDAL FR-DC-CGB-04: A Hareowing Tale` - 2026-09-06T09:00 - Role-Playing Games (Campaign)
- `DDAL FR-DC-CGB-04: A Hareowing Tale` - 2026-09-06T14:00 - Role-Playing Games (Campaign)
- `DDAL FR-DC-TDD-01: Lofty Ambitions` - 2026-09-04T09:00 - Role-Playing Games (Campaign)
- `DDAL FR-DC-TDD-01: Lofty Ambitions` - 2026-09-04T14:00 - Role-Playing Games (Campaign)
- `DDAL FR-DC-TDD-01: Lofty Ambitions` - 2026-09-05T09:00 - Role-Playing Games (Campaign)
- `DDAL FR-DC-TDD-01: Lofty Ambitions` - 2026-09-05T14:00 - Role-Playing Games (Campaign)
- `DDAL FR-DC-TDD-01: Lofty Ambitions` - 2026-09-06T14:00 - Role-Playing Games (Campaign)
- `DDAL FR-DC-TDD-02: Clouded Visions` - 2026-09-04T14:00 - Role-Playing Games (Campaign)
- `DDAL FR-DC-TDD-02: Clouded Visions` - 2026-09-05T14:00 - Role-Playing Games (Campaign)
- `DDAL FR-DC-TDD-02: Clouded Visions` - 2026-09-06T14:00 - Role-Playing Games (Campaign)
- `DDAL PS-DC-RDP-05: Demon Queen of Spiders` - 2026-09-04T14:00 - Role-Playing Games (Campaign)
- `DDAL PS-DC-RDP-05: Demon Queen of Spiders` - 2026-09-05T14:00 - Role-Playing Games (Campaign)
- `DDAL PS-DC-RDP-05: Demon Queen of Spiders` - 2026-09-06T14:00 - Role-Playing Games (Campaign)
- `Mutant Crawl Classics: The Mutant Menace of Lab 47` - 2026-09-06T18:00 - Role-Playing Games (Non-Campaign)
- `PFS1 7-13: Captive in Crystal` - 2026-09-05T20:00 - Role-Playing Games (Campaign)
- `PFS2 2-23: An Agent's Obligation` - 2026-09-03T19:00 - Role-Playing Games (Campaign)
- `Pathfinder 1E: Rise of the Goblin Guild` - 2026-09-03T19:00 - Role-Playing Games (Non-Campaign)
- `Pathfinder 1E: Rise of the Goblin Guild` - 2026-09-04T13:00 - Role-Playing Games (Non-Campaign)
- `Pathfinder 1E: Rise of the Goblin Guild` - 2026-09-07T13:00 - Role-Playing Games (Non-Campaign)
- `Pathfinder 1E: The Glass River Rescue` - 2026-09-04T09:00 - Role-Playing Games (Non-Campaign)
- `Pathfinder 1E: The Glass River Rescue` - 2026-09-04T18:00 - Role-Playing Games (Non-Campaign)
- `Pathfinder 1E: The Glass River Rescue` - 2026-09-07T09:00 - Role-Playing Games (Non-Campaign)
- `SFS2 1-14/1-15: The Beasts of Bo Part 1/Ruins of the World Soul` - 2026-09-04T20:00 - Role-Playing Games (Campaign)
- `SFS2 1-14/1-15: The Beasts of Bo Part 1/Ruins of the World Soul` - 2026-09-05T20:00 - Role-Playing Games (Campaign)
- `SFS2 1-14/1-15: The Beasts of Bo Part 1/Ruins of the World Soul` - 2026-09-07T09:00 - Role-Playing Games (Campaign)
- `SFS2 1-16/1-17: The Beasts of Bo Part 2/Corpse Fleet Conflict` - 2026-09-04T09:00 - Role-Playing Games (Campaign)
- `SFS2 1-16/1-17: The Beasts of Bo Part 2/Corpse Fleet Conflict` - 2026-09-04T20:00 - Role-Playing Games (Campaign)
- `SFS2 1-16/1-17: The Beasts of Bo Part 2/Corpse Fleet Conflict` - 2026-09-05T20:00 - Role-Playing Games (Campaign)
- `SFS2 1-16/1-17: The Beasts of Bo Part 2/Corpse Fleet Conflict` - 2026-09-07T09:00 - Role-Playing Games (Campaign)
- `SRM 2083-18: Some Kind of Voodoo?` - 2026-09-04T14:00 - Role-Playing Games (Campaign)
- `Savage Worlds: Shattered Caribbean` - 2026-09-06T13:00 - Role-Playing Games (Non-Campaign)
- `Shadowrun 6E: Welcome to Goblin City` - 2026-09-04T13:00 - Role-Playing Games (Non-Campaign)
- `Shadowrun 6E: Welcome to Goblin City` - 2026-09-04T18:00 - Role-Playing Games (Non-Campaign)
- `Shadowrun 6E: Welcome to Goblin City` - 2026-09-05T09:00 - Role-Playing Games (Non-Campaign)
- `Shadowrun 6E: Welcome to Goblin City` - 2026-09-05T13:00 - Role-Playing Games (Non-Campaign)
- `Shadowrun 6E: Welcome to Goblin City` - 2026-09-06T09:00 - Role-Playing Games (Non-Campaign)
- `Shadowrun 6E: Welcome to Goblin City` - 2026-09-06T13:00 - Role-Playing Games (Non-Campaign)
- `Â¡SUPER LUCHA! Saturday Night` - 2026-09-05T19:00 - Collectible Card Games

### What the model returned

Strings the model wrote that look double-encoded, as a transport that decoded its reply wrongly would leave them: `works.json` names 0 of 699; cached work names 0 of 551; cached evidence 0 of 848.

### Two characters

U+2018 is a left single quote, which `parse_stage.fold` does not fold and `tag_stage.folded` does. U+FFFD is the replacement character, which a decoder leaves where it met bytes it could not read. Each place's distinct strings:

| where | strings | U+2018 | U+FFFD |
| --- | ---: | ---: | ---: |
| titles | 2,536 | 0 | 0 |
| descriptions | 2,189 | 1 | 0 |
| people's names on events | 1,811 | 0 | 0 |
| `people.json` names and aliases | 141 | 0 | 0 |
| `works.json` names and aliases | 759 | 0 | 0 |
| cached work names | 551 | 0 | 0 |
| cached evidence | 848 | 0 | 0 |
| the sidecar's strings | 1,104 | 0 | 0 |

- U+2018 in the description of `Building a Campaign for the Long Haul`

### Descriptions over the cap

- Events whose description, without its panelist line, runs past the 2,000 characters the tagger is sent: 0.

## 13. Observations

Facts from the sections above; at most ten.

- Events with no work and no axis value: 48 (1.4%); the kind with the most of them is `panel` (16), and the track Main Programming (9).
- Works linked by one event: 330 of the 654 linked; the most, rolled up through descendants, is `dungeons-and-dragons` (138).
- Unreviewed works that events link: 64, on 239 events - the drafter's 9 and the tagger's 55.
- Events whose kind changed from v1: 312; the largest change is `panel` to `performance` (40).
- `mature` events: 105; made mature by the model alone 30, by the parse alone 1.
- Gaming events with no `play`: 63 of 931; the kind with the most of them is `workshop` (51).
- Events with `guests`: 483. Reviewed people in `people.json`: 113; reviewed credits: 256. Events v1 called `celebrity`: 470.
- People on qa, photo and signing events who are not in `people.json`: 197 - never drafted (162), rejected by model (34), rejected by review (1).
- Repeat groups that sent more than one input: 45 of 371; of those, building different tags: 8.
- v1 fandom assignments lost in v2: 95 of 815; the fandom with the most is Dungeons & Dragons (12).

## Appendix A. Unreviewed works that events link

| id | name | source | type | parent | events | titles, up to 3 |
| --- | --- | --- | --- | --- | ---: | --- |
| `brandish` | `Brandish` | tagger | game / ccg |  | 44 | `Brandish, , the duelist's card game (DEMO)` |
| `worn-wanderers` | `Worn Wanderers` | tagger | game / ccg |  | 17 | `Worn Wanderers Booster Draft`, `Worn Wanderers Learn to Play`, `Worn Wanderers Tournament` ... |
| `murder-hobo-tavern-brawl` | `Murder Hobo Tavern Brawl` | tagger | game / board |  | 15 | `Destroy Your Friends with Murder Hobo Tavern Brawl!` |
| `barely-coping` | `Barely Coping` | tagger | game / board |  | 14 | `BARELY COPING? Play the Game! (17+)` |
| `luminous` | `Luminous` | tagger | game / ccg |  | 14 | `Learn to Play Luminous Card Game` |
| `into-the-lair` | `Into the Lair` | tagger | game / rpg |  | 12 | `Into the Lair: The Beast of Briar Ridge`, `Into the Lair: The Night Shift` |
| `urban-insanity` | `Urban Insanity` | tagger | game / board |  | 10 | `Urban Insanity` |
| `inter-sidera` | `Inter Sidera` | tagger | game / rpg |  | 8 | `Inter Sidera: Attempted murder of Sir Flynn Doyle`, `Inter Sidera: Coronatus War- Prometheus's Fire`, `Inter Sidera: The War for Coronatus with Creator` |
| `time-rift` | `Time Rift` | tagger | game / ccg |  | 7 | `Time Rift - Casual play pods - Each half hour`, `Time Rift - Constructed Tournament - Empire Builders`, `Time Rift - Demos- Learn to play, Get free cards` |
| `armored-coffins` | `Armored Coffins` | tagger | game / rpg |  | 6 | `Armored Coffins: Illusory Remnants`, `Armored Coffins: Titanomachy` |
| `land-and-sea` | `Land & Sea` | tagger | franchise |  | 6 | `Land & Sea Miniatures Game` |
| `safe-mode-disabled` | `Safe Mode: Disabled` | tagger | game / rpg |  | 6 | `Safe Mode Disabled: Con Crashers Adventure` |
| `the-garden` | `The Garden` | tagger | game / rpg |  | 5 | `The Garden: The Salt Crust Sanctum` |
| `battlequest` | `BattleQuest` | tagger | game / miniatures |  | 4 | `BattleQuest Adventure Awaits` |
| `cataclysm-arcade-tcg` | `Cataclysm Arcade TCG` | tagger | game / ccg |  | 4 | `Cataclysm Arcade TCG Free Demos` |
| `ember-obsidian-protocol` | `Ember: Obsidian Protocol` | tagger | game / miniatures |  | 4 | `E:OP - Official Ember: Obsidian Protocol Tournament` |
| `death-battle` | `Death Battle` | drafter | franchise |  | 3 | `Anime Death Battle: Who Would Win?`, `Death Battle: Behind the Scenes`, `Death Battle: Meet the Cast` |
| `koopia` | `Koopia` | tagger | game / board |  | 3 | `Koopia Demo` |
| `limbo-the-land-of-the-dead` | `Limbo: The Land of the Dead` | tagger | game / miniatures |  | 3 | `Limbo... The Land of the Dead` |
| `supershow-the-game` | `Supershow The Game` | tagger | game / ccg |  | 3 | `Return Of The Cosmic Crusaders`, `Supershow The Game - 2026 Dragon*Con Championship`, `Â¡SUPER LUCHA! Saturday Night` |
| `be-awesome-together` | `Be Awesome Together` | tagger | franchise |  | 2 | `Be Awesome Together` |
| `codex-alera` | `Codex Alera` | drafter | franchise |  | 2 | `An Hour with Jim Butcher`, `Photoshoot: Dresden Files, Alera & Cinder Spires` |
| `earth-station-boo` | `Earth Station Boo` | tagger | franchise |  | 2 | `Earth Station Boo Show – LIVE!` |
| `game-mechanics` | `Game Mechanics` | tagger | franchise |  | 2 | `Game Mechanics LIVE` |
| `hollowed-oath` | `Hollowed Oath` | tagger | game / video |  | 2 | `Hollowed Oath` |
| `sock-puppets` | `Sock Puppets` | tagger | game / rpg |  | 2 | `Sock Puppets RPG: Make a Puppet`, `Sock Puppets RPG: The Episode Where Things Really Go off the Rails` |
| `star-forest` | `Star Forest` | tagger | franchise |  | 2 | `Kids Track Presents: Star Forest Goblin Song Craft`, `Star Forest Family-Friendly Dance *ENDS at 6PM*` |
| `the-cinder-spires` | `The Cinder Spires` | drafter | franchise |  | 2 | `An Hour with Jim Butcher`, `Photoshoot: Dresden Files, Alera & Cinder Spires` |
| `the-dresden-files` | `The Dresden Files` | drafter | franchise |  | 2 | `An Hour with Jim Butcher`, `Photoshoot: Dresden Files, Alera & Cinder Spires` |
| `the-transformers-the-movie` | `The Transformers: The Movie` | drafter | franchise | `transformers` | 2 | `Break the Rules, Take the Heat: Transformers the Movie at 40`, `The Transformers: The Movie Turns 40` |
| `those-were-the-days` | `Those Were the Days` | tagger | franchise |  | 2 | `Those Were the Days – LIVE!` |
| `wingspan-pocket` | `Wingspan Pocket` | tagger | game / board | `wingspan` | 2 | `Rose Tatu Productions Presents: Wingspan Pocket` |
| `afterall` | `Afterall` | tagger | franchise |  | 1 | `Afterall Reading with Discussion and Q&A` |
| `avengers-age-of-ultron` | `Avengers: Age of Ultron` | tagger | franchise | `avengers` | 1 | `Marvel: Age of Ultron 2.0` |
| `black-nerd` | `Black Nerd` | tagger | franchise |  | 1 | `Black Nerd Reads – LIVE!` |
| `blood-feud` | `Blood Feud` | tagger | franchise |  | 1 | `Blood Feud: Back to the Minors` |
| `botched` | `Botched` | tagger | franchise |  | 1 | `Botched: A D&D/SCP Comedy Podcast – LIVE!` |
| `call-of-cthulu-campfire-tales` | `Call of Cthulu: Campfire Tales` | tagger | franchise | `call-of-cthulhu` | 1 | `Call of Cthulu: Campfire Tales – LIVE!` |
| `castlevania` | `Castlevania` | tagger | game / video |  | 1 | `Rhapsody of Blood: Castlevania-esque speedrun` |
| `chronicles-of-nick` | `Chronicles of Nick` | drafter | franchise | `dark-hunter` | 1 | `An Hour with Sherrilyn Kenyon` |
| `de-bellis-fantasiae` | `De Bellis Fantasiae` | tagger | game / miniatures |  | 1 | `F&G - De Bellis Fantasiae` |
| `de-bellus-malletorum` | `De Bellus Malletorum` | tagger | game / miniatures |  | 1 | `F&G - De Bellus Malletorum: a Clash of Spelle and Shotte` |
| `deadmans-cross` | `Deadman's Cross` | drafter | franchise | `dark-hunter` | 1 | `An Hour with Sherrilyn Kenyon` |
| `eerie-travels` | `Eerie Travels` | tagger | franchise |  | 1 | `Eerie Travels Presents: Cryptids & Legends fr. the Dark Heart of Appalachia` |
| `first-drafts-the-outcasts` | `First Drafts: The Outcasts` | tagger | franchise |  | 1 | `First Drafts: The Outcasts – Screening w/ Filmmaker Michelle Iannantuono` |
| `hells-half-acre` | `Hell's Half Acre` | tagger | franchise |  | 1 | `Sherrilyn Kenyon & Friends: Costume & Book Signing Extravaganza!` |
| `in-the-wild` | `In the Wild` | tagger | game / rpg |  | 1 | `Dungeon Crawler Carl Character Creation Panel!` |
| `inkwell` | `Inkwell` | tagger | game / board |  | 1 | `Rose Tatu Productions Presents: Inkwell` |
| `neuroscape` | `NeuroScape` | tagger | game / ccg |  | 1 | `NeuroScape Sealed` |
| `no-latency` | `No Latency` | tagger | franchise |  | 1 | `No Latency – LIVE!` |
| `no-way-out` | `No Way Out` | tagger | franchise |  | 1 | `No Way Out: A Fan Panel` |
| `psychostick` | `Psychostick` | drafter | franchise |  | 1 | `Psychostick` |
| `sanctuary` | `Sanctuary` | tagger | game / board |  | 1 | `Rose Tatu Productions Presents: Sanctuary` |
| `sarah-j-maas-universe` | `Sarah J Maas Universe` | tagger | franchise |  | 1 | `Photoshoot: Sarah J Maas Universe` |
| `starfire` | `Starfire` | tagger | franchise | `dc-comics` | 1 | `DC Comics' Animated TV Shows` |
| `talking-strange` | `Talking Strange` | tagger | franchise |  | 1 | `Talking Strange: Haunted Lore vs. Haunted History – LIVE!` |
| `tamora-pierce-universe` | `Tamora Pierce Universe` | tagger | franchise |  | 1 | `Photoshoot: Tamora Pierce Universe` |
| `the-demonatrix` | `The Demonatrix` | tagger | franchise |  | 1 | `The Demonatrix Screening` |
| `the-smoke-and-the-sea` | `The Smoke and the Sea` | tagger | franchise |  | 1 | `YA Book Club: The Smoke and the Sea – Katie Cross` |
| `the-someday-garden` | `The Someday Garden` | tagger | franchise |  | 1 | `Romance Book Club: The Someday Garden – Ashley Poston` |
| `ultima` | `Ultima` | drafter | franchise |  | 1 | `Dad's Garage Goes to Britannia (Ultima Series)` |
| `warriors` | `Warriors` | tagger | franchise |  | 1 | `Grown-up Games: Warrior Cats, or Game of Thrones?` |
| `welcome-to-widows-bay` | `Welcome to Widow's Bay` | tagger | franchise |  | 1 | `Welcome to Widow's Bay: A Fan Panel` |
| `zombiecon-vol-1` | `ZombieCON Vol. 1` | tagger | franchise |  | 1 | `ZombieCON Vol. 1: Fan Discussion Panel` |

## Appendix B. People on qa, photo and signing events who are not in `people.json`

| name | id | status | qa | photo | signing | all events |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| `Patricia Briggs` | `patricia-briggs` | never drafted | 2 | 0 | 4 | 15 |
| `Matt Dinniman` | `matt-dinniman` | never drafted | 2 | 0 | 4 | 10 |
| `Primetime Steve` | `primetime-steve` | rejected by model | 6 | 0 | 0 | 6 |
| `John Jackson Miller` | `john-jackson-miller` | never drafted | 0 | 0 | 5 | 11 |
| `Tony P Henderson` | `tony-p-henderson` | rejected by model | 5 | 0 | 0 | 8 |
| `Marc Lee` | `marc-lee` | rejected by model | 5 | 0 | 0 | 7 |
| `Thomas Parham` | `thomas-parham` | rejected by model | 5 | 0 | 0 | 7 |
| `Brian Richardson` | `brian-richardson` | rejected by model | 5 | 0 | 0 | 6 |
| `Sammi Doneff` | `sammi-doneff` | rejected by model | 5 | 0 | 0 | 5 |
| `Carol Malcolm` | `carol-malcolm` | rejected by model | 4 | 0 | 0 | 21 |
| `Ingrid Seymour` | `ingrid-seymour` | never drafted | 0 | 0 | 4 | 9 |
| `Lydia Sherrer` | `lydia-sherrer` | never drafted | 0 | 0 | 4 | 9 |
| `Kevin J Anderson` | `kevin-j-anderson` | never drafted | 2 | 0 | 2 | 8 |
| `Colby Smith` | `colby-smith` | rejected by model | 4 | 0 | 0 | 7 |
| `Joey Davila` | `joey-davila` | rejected by model | 4 | 0 | 0 | 6 |
| `Bobby Blackwolf` | `bobby-blackwolf` | rejected by model | 4 | 0 | 0 | 5 |
| `Manda Montane` | `manda-montane` | rejected by model | 4 | 0 | 0 | 5 |
| `E.M. Meyers` | `e-m-meyers` | never drafted | 0 | 0 | 4 | 4 |
| `K. E. Deyarmin` | `k-e-deyarmin` | never drafted | 0 | 0 | 4 | 4 |
| `Shami A Stovall` | `shami-a-stovall` | never drafted | 0 | 0 | 3 | 11 |
| `R.R. Virdi` | `r-r-virdi` | never drafted | 0 | 0 | 3 | 10 |
| `A. J. Hartley` | `a-j-hartley` | never drafted | 0 | 0 | 3 | 9 |
| `Ashley Poston` | `ashley-poston` | never drafted | 2 | 0 | 1 | 9 |
| `Melissa Olthoff` | `melissa-olthoff` | never drafted | 0 | 0 | 3 | 9 |
| `Susan Griffith` | `susan-griffith` | never drafted | 0 | 0 | 3 | 9 |
| `Rob Levy` | `rob-levy` | rejected by model | 3 | 0 | 0 | 8 |
| `Ryan Cahill` | `ryan-cahill` | never drafted | 0 | 0 | 3 | 8 |
| `Dot R Steverson` | `dot-r-steverson` | rejected by model | 3 | 0 | 0 | 7 |
| `Christopher D. Schmitz` | `christopher-d-schmitz` | never drafted | 0 | 0 | 3 | 6 |
| `Silas Reames` | `silas-reames` | never drafted | 0 | 0 | 3 | 6 |
| `Kiki Falkanger` | `kiki-falkanger` | rejected by model | 3 | 0 | 0 | 5 |
| `Madeleine Roux` | `madeleine-roux` | never drafted | 2 | 0 | 1 | 5 |
| `Rob Roberts` | `rob-roberts` | rejected by model | 3 | 0 | 0 | 5 |
| `Tay Samms` | `tay-samms` | rejected by model | 3 | 0 | 0 | 5 |
| `Crispy` | `crispy` | rejected by model | 3 | 0 | 0 | 4 |
| `Jeff Hays` | `jeff-hays` | never drafted | 2 | 0 | 1 | 3 |
| `Keith R.A. DeCandido` | `keith-r-a-decandido` | never drafted | 0 | 0 | 2 | 15 |
| `Marisa Wolf` | `marisa-wolf` | never drafted | 0 | 0 | 2 | 12 |
| `Megan O'Russell` | `megan-orussell` | never drafted | 0 | 0 | 2 | 12 |
| `Michael A. Stackpole` | `michael-a-stackpole` | never drafted | 2 | 0 | 0 | 12 |
| `Andrew E.C. Gaska` | `andrew-e-c-gaska` | never drafted | 1 | 0 | 1 | 11 |
| `D.B. Jackson` | `d-b-jackson` | never drafted | 0 | 0 | 2 | 11 |
| `Gail Z Martin` | `gail-z-martin` | never drafted | 0 | 0 | 2 | 11 |
| `Jennifer Estep` | `jennifer-estep` | never drafted | 0 | 0 | 2 | 11 |
| `Sue Kisenwether` | `sue-kisenwether` | rejected by model | 2 | 0 | 0 | 11 |
| `Tao Wong` | `tao-wong` | never drafted | 0 | 0 | 2 | 11 |
| `Isabelle Hardesty` | `isabelle-hardesty` | never drafted | 0 | 0 | 2 | 10 |
| `Kevin Bachelder` | `kevin-bachelder` | rejected by model | 2 | 0 | 0 | 10 |
| `Clay McLeod Chapman` | `clay-mcleod-chapman` | never drafted | 0 | 0 | 2 | 9 |
| `David Boop` | `david-boop` | never drafted | 0 | 0 | 2 | 9 |
| `Diana Peterfreund` | `diana-peterfreund` | never drafted | 0 | 0 | 2 | 9 |
| `Jody Lynn Nye` | `jody-lynn-nye` | never drafted | 0 | 0 | 2 | 9 |
| `K.A. Linde` | `k-a-linde` | never drafted | 0 | 0 | 2 | 9 |
| `KD Edwards` | `kd-edwards` | never drafted | 0 | 0 | 2 | 9 |
| `Jack Campbell` | `jack-campbell` | never drafted | 0 | 0 | 2 | 8 |
| `Seven Machina Rasmussen` | `seven-machina-rasmussen` | never drafted | 0 | 0 | 2 | 8 |
| `Fon H Davis` | `fon-h-davis` | rejected by model | 2 | 0 | 0 | 7 |
| `Jean Kwok` | `jean-kwok` | never drafted | 0 | 0 | 2 | 7 |
| `Casey Moores` | `casey-moores` | never drafted | 0 | 0 | 2 | 6 |
| `Drew Hayes` | `drew-hayes` | never drafted | 0 | 0 | 2 | 6 |
| `Esther Friesner` | `esther-friesner` | never drafted | 0 | 0 | 2 | 6 |
| `James J. Butcher` | `james-j-butcher` | never drafted | 0 | 0 | 2 | 6 |
| `Noel E Plaugher` | `noel-e-plaugher` | never drafted | 0 | 0 | 2 | 6 |
| `S.L. Rowland` | `s-l-rowland` | never drafted | 0 | 0 | 2 | 5 |
| `Greg Keyes` | `greg-keyes` | never drafted | 1 | 0 | 1 | 4 |
| `Andrew Givler` | `andrew-givler` | never drafted | 0 | 0 | 2 | 3 |
| `amberthysts cosplay` | `amberthysts-cosplay` | never drafted | 0 | 2 | 0 | 3 |
| `Dan dos Santos` | `dan-dos-santos` | never drafted | 1 | 0 | 1 | 2 |
| `Sydney Wilder` | `sydney-wilder` | never drafted | 0 | 0 | 2 | 2 |
| `Jami Jones` | `jami-jones` | never drafted | 1 | 0 | 0 | 12 |
| `Beth Dolgner` | `beth-dolgner` | never drafted | 0 | 0 | 1 | 11 |
| `R. E. Carr` | `r-e-carr` | never drafted | 0 | 0 | 1 | 11 |
| `Sarah J. Sover` | `sarah-j-sover` | never drafted | 0 | 0 | 1 | 11 |
| `Bryan Young` | `bryan-young` | never drafted | 1 | 0 | 0 | 10 |
| `Gary Mitchel` | `gary-mitchel` | rejected by model | 1 | 0 | 0 | 10 |
| `John G. Hartness` | `john-g-hartness` | never drafted | 0 | 0 | 1 | 10 |
| `Les Johnson` | `les-johnson` | never drafted | 0 | 0 | 1 | 10 |
| `Robert E Hampson` | `robert-e-hampson` | never drafted | 0 | 0 | 1 | 10 |
| `Alicia Rades` | `alicia-rades` | never drafted | 0 | 0 | 1 | 9 |
| `Bob McGough` | `bob-mcgough` | never drafted | 0 | 0 | 1 | 9 |
| `Clay Gilbert` | `clay-gilbert` | never drafted | 0 | 0 | 1 | 9 |
| `Darin Kennedy` | `darin-kennedy` | never drafted | 0 | 0 | 1 | 9 |
| `Gini Koch` | `gini-koch` | never drafted | 0 | 0 | 1 | 9 |
| `Griffin Barber` | `griffin-barber` | never drafted | 0 | 0 | 1 | 9 |
| `JM Paquette` | `jm-paquette` | never drafted | 0 | 0 | 1 | 9 |
| `Joe Crowe` | `joe-crowe` | rejected by model | 1 | 0 | 0 | 9 |
| `Judy Black` | `judy-black` | never drafted | 1 | 0 | 0 | 9 |
| `Mark Muncy` | `mark-muncy` | never drafted | 0 | 0 | 1 | 9 |
| `Rush Lilavivat` | `rush-lilavivat` | never drafted | 1 | 0 | 0 | 9 |
| `Channing Scott Sherman` | `channing-scott-sherman` | never drafted | 1 | 0 | 0 | 8 |
| `Cheralyn Lambeth` | `cheralyn-lambeth` | never drafted | 1 | 0 | 0 | 8 |
| `Clint Hall` | `clint-hall` | never drafted | 0 | 0 | 1 | 8 |
| `DCZev` | `dczev` | rejected by model | 0 | 0 | 1 | 8 |
| `Dante St. John` | `dante-st-john` | never drafted | 0 | 0 | 1 | 8 |
| `Mari Mancusi` | `mari-mancusi` | never drafted | 0 | 0 | 1 | 8 |
| `Megan Linski` | `megan-linski` | never drafted | 0 | 0 | 1 | 8 |
| `Melissa Truth Miller` | `melissa-truth-miller` | never drafted | 1 | 0 | 0 | 8 |
| `Allora Lee` | `allora-lee` | never drafted | 0 | 0 | 1 | 7 |
| `Dave West` | `dave-west` | rejected by model | 1 | 0 | 0 | 7 |
| `Erika L Lance` | `erika-l-lance` | never drafted | 0 | 0 | 1 | 7 |
| `Freddy Clements` | `freddy-clements` | never drafted | 1 | 0 | 0 | 7 |
| `J. B. Garner` | `j-b-garner` | never drafted | 0 | 0 | 1 | 7 |
| `Jonathan Sarge` | `jonathan-sarge` | rejected by model | 1 | 0 | 0 | 7 |
| `Julia Vee` | `julia-vee` | never drafted | 0 | 0 | 1 | 7 |
| `Palmetto Knights` | `palmetto-knights` | never drafted | 1 | 0 | 0 | 7 |
| `Theresa Glover` | `theresa-glover` | never drafted | 0 | 0 | 1 | 7 |
| `Alex Shvartsman` | `alex-shvartsman` | never drafted | 0 | 0 | 1 | 6 |
| `Andrew Najberg` | `andrew-najberg` | never drafted | 0 | 0 | 1 | 6 |
| `Brianna Marie` | `brianna-marie` | never drafted | 1 | 0 | 0 | 6 |
| `Chance Glenn` | `chance-glenn` | never drafted | 0 | 0 | 1 | 6 |
| `Charles E Gannon` | `charles-e-gannon` | never drafted | 0 | 0 | 1 | 6 |
| `Henry Herz` | `henry-herz` | never drafted | 0 | 0 | 1 | 6 |
| `Kaitlin Bevis` | `kaitlin-bevis` | never drafted | 0 | 0 | 1 | 6 |
| `Katharine E Wibell` | `katharine-e-wibell` | never drafted | 0 | 0 | 1 | 6 |
| `Kathleen O'Shea David` | `kathleen-oshea-david` | never drafted | 1 | 0 | 0 | 6 |
| `Kristin O'Donnell Tubb` | `kristin-odonnell-tubb` | never drafted | 0 | 0 | 1 | 6 |
| `L. M. Davis` | `l-m-davis` | never drafted | 0 | 0 | 1 | 6 |
| `Megan Mackie` | `megan-mackie` | never drafted | 0 | 0 | 1 | 6 |
| `Michael Webb` | `michael-webb` | never drafted | 0 | 0 | 1 | 6 |
| `Nikita Rowitz` | `nikita-rowitz` | never drafted | 0 | 0 | 1 | 6 |
| `Omega Jones` | `omega-jones` | rejected by model | 1 | 0 | 0 | 6 |
| `Paige L. Christie` | `paige-l-christie` | never drafted | 0 | 0 | 1 | 6 |
| `Rachel Rieckenberg` | `rachel-rieckenberg` | never drafted | 1 | 0 | 0 | 6 |
| `Walter H Hunt` | `walter-h-hunt` | never drafted | 0 | 0 | 1 | 6 |
| `Becky Albertalli` | `becky-albertalli` | never drafted | 0 | 0 | 1 | 5 |
| `Ben Wolf` | `ben-wolf` | never drafted | 1 | 0 | 0 | 5 |
| `C.B. Lee` | `c-b-lee` | never drafted | 0 | 0 | 1 | 5 |
| `David Hankins` | `david-hankins` | never drafted | 0 | 0 | 1 | 5 |
| `Ellie Raine` | `ellie-raine` | never drafted | 0 | 0 | 1 | 5 |
| `FT Lukens` | `ft-lukens` | never drafted | 0 | 0 | 1 | 5 |
| `Jason Massey` | `jason-massey` | never drafted | 1 | 0 | 0 | 5 |
| `John Bierce` | `john-bierce` | never drafted | 0 | 0 | 1 | 5 |
| `Katie Cross` | `katie-cross` | never drafted | 0 | 0 | 1 | 5 |
| `Kevin Grevioux` | `kevin-grevioux` | never drafted | 1 | 0 | 0 | 5 |
| `Lea Murphy` | `lea-murphy` | never drafted | 1 | 0 | 0 | 5 |
| `Mo Vermenton` | `mo-vermenton` | rejected by model | 1 | 0 | 0 | 5 |
| `Nicole Conway` | `nicole-conway` | never drafted | 0 | 0 | 1 | 5 |
| `Preeti Chhibber` | `preeti-chhibber` | never drafted | 0 | 0 | 1 | 5 |
| `Rebecca Moesta` | `rebecca-moesta` | never drafted | 0 | 0 | 1 | 5 |
| `Stefan Price` | `stefan-price` | never drafted | 1 | 0 | 0 | 5 |
| `Wil McCarthy` | `wil-mccarthy` | never drafted | 0 | 0 | 1 | 5 |
| `Alexander Stevens Damon` | `alexander-stevens-damon` | never drafted | 1 | 0 | 0 | 4 |
| `Anna Harrison` | `anna-harrison` | never drafted | 1 | 0 | 0 | 4 |
| `Becca Lynn Mathis` | `becca-lynn-mathis` | never drafted | 0 | 0 | 1 | 4 |
| `Dave Maass` | `dave-maass` | never drafted | 0 | 0 | 1 | 4 |
| `David A Trotter` | `david-a-trotter` | never drafted | 0 | 0 | 1 | 4 |
| `Gray Rinehart` | `gray-rinehart` | never drafted | 0 | 0 | 1 | 4 |
| `Henry Gilroy` | `henry-gilroy` | never drafted | 1 | 0 | 0 | 4 |
| `Hunter Blain` | `hunter-blain` | never drafted | 0 | 0 | 1 | 4 |
| `James A. Hunter` | `james-a-hunter` | never drafted | 0 | 0 | 1 | 4 |
| `Jarod K Anderson` | `jarod-k-anderson` | never drafted | 0 | 0 | 1 | 4 |
| `Jeffrey L Kohanek` | `jeffrey-l-kohanek` | never drafted | 0 | 0 | 1 | 4 |
| `Justin Lee Ford` | `justin-lee-ford` | rejected by model | 1 | 0 | 0 | 4 |
| `Justin Leslie` | `justin-leslie` | never drafted | 0 | 0 | 1 | 4 |
| `Keith Robinson` | `keith-robinson` | never drafted | 0 | 0 | 1 | 4 |
| `Kristen Jenkins` | `kristen-jenkins` | never drafted | 1 | 0 | 0 | 4 |
| `Lyman Chen` | `lyman-chen` | rejected by model | 1 | 0 | 0 | 4 |
| `Matthew R Silva` | `matthew-r-silva` | never drafted | 1 | 0 | 0 | 4 |
| `Michael Chatfield` | `michael-chatfield` | never drafted | 0 | 0 | 1 | 4 |
| `Shane Dzicek` | `shane-dzicek` | never drafted | 1 | 0 | 0 | 4 |
| `Tony Barletta` | `tony-barletta` | never drafted | 1 | 0 | 0 | 4 |
| `Chip Zdarsky` | `chip-zdarsky` | never drafted | 1 | 0 | 0 | 3 |
| `Matt Wagner` | `matt-wagner` | never drafted | 1 | 0 | 0 | 3 |
| `Molly Abigail Coffee` | `molly-abigail-coffee` | rejected by model | 1 | 0 | 0 | 3 |
| `Scott Sigler` | `scott-sigler` | never drafted | 1 | 0 | 0 | 3 |
| `Alex Taylor` | `alex-taylor` | never drafted | 1 | 0 | 0 | 2 |
| `Brandon Highbaugh` | `brandon-highbaugh` | never drafted | 1 | 0 | 0 | 2 |
| `Cruxshadows` | `cruxshadows` | rejected by review | 1 | 0 | 0 | 2 |
| `Daniel Ball` | `daniel-ball` | never drafted | 1 | 0 | 0 | 2 |
| `Darius Washington` | `darius-washington` | never drafted | 1 | 0 | 0 | 2 |
| `Dominic Bozzo` | `dominic-bozzo` | never drafted | 1 | 0 | 0 | 2 |
| `Greg Weisman` | `greg-weisman` | never drafted | 1 | 0 | 0 | 2 |
| `Jason Gonding` | `jason-gonding` | rejected by model | 1 | 0 | 0 | 2 |
| `John Strangeway` | `john-strangeway` | never drafted | 1 | 0 | 0 | 2 |
| `Kris Takahashi` | `kris-takahashi` | never drafted | 1 | 0 | 0 | 2 |
| `Mark Steven Braught` | `mark-steven-braught` | never drafted | 1 | 0 | 0 | 2 |
| `Mike Odle` | `mike-odle` | rejected by model | 1 | 0 | 0 | 2 |
| `Rachael Conniff` | `rachael-conniff` | never drafted | 1 | 0 | 0 | 2 |
| `Tim Jacobus` | `tim-jacobus` | never drafted | 1 | 0 | 0 | 2 |
| `A C Haskins` | `a-c-haskins` | never drafted | 0 | 0 | 1 | 1 |
| `A Sigler` | `a-sigler` | never drafted | 1 | 0 | 0 | 1 |
| `AC Haskins` | `ac-haskins` | never drafted | 0 | 0 | 1 | 1 |
| `C Mantis` | `c-mantis` | never drafted | 0 | 0 | 1 | 1 |
| `CJ Aaron` | `cj-aaron` | never drafted | 0 | 0 | 1 | 1 |
| `Chris Spears` | `chris-spears` | rejected by model | 1 | 0 | 0 | 1 |
| `Cornman` | `cornman` | never drafted | 0 | 0 | 1 | 1 |
| `James Cambias` | `james-cambias` | never drafted | 0 | 0 | 1 | 1 |
| `Jessica It's All Good` | `jessica-its-all-good` | never drafted | 1 | 0 | 0 | 1 |
| `Julie Simancek` | `julie-simancek` | never drafted | 1 | 0 | 0 | 1 |
| `Kyle Valle` | `kyle-valle` | rejected by model | 1 | 0 | 0 | 1 |
| `Lindsey Richardson` | `lindsey-richardson` | never drafted | 0 | 0 | 1 | 1 |
| `Mike Jeffries` | `mike-jeffries` | never drafted | 1 | 0 | 0 | 1 |
| `Noct` | `noct` | never drafted | 0 | 0 | 1 | 1 |
| `OverXelous` | `overxelous` | never drafted | 0 | 0 | 1 | 1 |
| `Seth Ring` | `seth-ring` | never drafted | 0 | 0 | 1 | 1 |
| `Sonny Gillespie` | `sonny-gillespie` | never drafted | 1 | 0 | 0 | 1 |
| `Uranium Phoenix` | `uranium-phoenix` | never drafted | 0 | 0 | 1 | 1 |

## Appendix C. Events v1 called `celebrity` that v2 does not

- `2026 Film Track Kick-Off & Preview: The State of Film in 2026` - 2026-09-03T19:00 - Film Track - `Matt Smith`
- `A Hour with Lord British` - 2026-09-05T14:30 - Video Gaming - `Richard Lord British"" Garriott`, `Chris Spears`, `Jason Gonding`, `Starr Long`
- `Age in Fandom: Breaking the Stereotypes` - 2026-09-04T14:30 - Diversity Track - `Thomas Parham`, `Jenna Levine`, `Larry Niven`, `Berta Platas`, `Glenn Parris`
- `Anime Death Battle: Who Would Win?` - 2026-09-04T14:30 - Anime/Manga - `Ben Singer Death Battle`, `Chad James Death Battle`
- `Avatar: Fire, Water, and Beyond` - 2026-09-05T13:00 - American Sci-fi and Fantasy Media - `Birma Gainor`, `Aaron Michael Ritchey`, `Nick Frutiger`
- `Bard Talk: Shakespeare with Shenanigans - LIVE!` - 2026-09-04T23:30 - Digital Media - `Sean Weiland`, `Paris K Arrowsmith`, `Catieosaurus`, `Mikal Mosley`
- `Bathroom of the Future` - 2026-09-05T01:30 - Live Performances - `Bathroom of the Future`
- `Bit Brigade` - 2026-09-07T00:00 - Live Performances - `Bit Brigade`
- `CLOUDSAVE` - 2026-09-07T01:30 - Live Performances - `CLOUDSAVE`
- `Classic Sci-Fi Charity Movie Lock-in : Howard the Duck` - 2026-09-04T19:00 - American Sci-fi Classics - `ToniAnn Marini`, `Michael Wesley Collins`, `Nick Frutiger`, `RL Grey`, `Trey Lawson`
- `Concert – Emily Henry` - 2026-09-04T13:00 - Filk Music - `Emily Henry`
- `Concert – The Brobdingnagian Bards` - 2026-09-05T20:30 - Filk Music - `Brobdingnagian Bards`
- `Death Battle: Meet the Cast` - 2026-09-06T19:00 - Anime/Manga - `Ben Singer Death Battle`, `Chad James Death Battle`
- `Delilah Dawson signing` - 2026-09-06T13:00 - Vendor Workshops/Events - `Delilah S Dawson`
- `Denim Arcade` - 2026-09-05T00:00 - Live Performances - `Denim Arcade`
- `Dragon Award Nominee & Past Recipients – Meet & Greet and Signings` - 2026-09-04T19:00 - Author Signings - `DCZev`, `Jim Butcher`, `D.J. Butler`, `Delilah S Dawson`, `Lyndsay Ely`, and 4 more
- `Friday Night Costuming Contest` - 2026-09-04T20:30 - Costuming - `Yaya Han`, `Rob Roberts`
- `Galactic Empire` - 2026-09-06T00:00 - Live Performances - `Galactic Empire`
- `Invasion Fan Panel: Day 1, Post Invasion` - 2026-09-07T11:30 - XTrack - `Chris Moore`, `Jessica Combs`
- `Killbillies` - 2026-09-05T20:30 - Live Performances - Hyatt Concourse - `Killbillies`
- `Last Grasp` - 2026-09-07T00:00 - Live Performances - `Last Grasp`
- `Pee Wee's Playhouse 40th Anniversary: Saturday Morning 1986` - 2026-09-05T11:30 - American Sci-fi Classics - `Kevin Eldridge`, `Molly Abigail Coffee`, `Remy Dee`, `Dave West`, `Nick Frutiger`
- `Psychostick` - 2026-09-06T01:30 - Live Performances - `Psychostick`
- `Q&A with Justin Lee Ford` - 2026-09-05T19:00 - Silk Road - `Justin Lee Ford`, `Mike Odle`, `Lyman Chen`
- `Real or Fake Anime with Thomas Sanders` - 2026-09-04T20:30 - Digital Media - no people
- `Running Man: The Game Has Changed` - 2026-09-04T10:00 - American Sci-fi and Fantasy Media - `Alyssa Askani`, `Jazzmin Wilson`, `Jeni Green`, `Rebecca Russell`, `Shayna Adelman`
- `Sherrilyn Kenyon & Friends: Costume & Book Signing Extravaganza!` - 2026-09-03T19:00 - Main Programming - `Leanna Renee Hieber`, `Sherrilyn Kenyon`
- `Supergirl: Woman of Tomorrow` - 2026-09-04T17:30 - American Sci-fi and Fantasy Media - `Aaron Michael Ritchey`, `Kevin Eldridge`, `Steve Saffel`, `Cammien Ray`, `Jon-Paul Estes`
- `The Boys: Truth? Justice? ... and Vought` - 2026-09-05T16:00 - American Sci-fi and Fantasy Media - `Crystal Cleveland`, `Haduo-Ken Masters`, `Michael Collins`, `Paul Race`, `Robyn McGlotten`
- `The Cybertronic Spree` - 2026-09-04T23:30 - Live Performances - `The Cybertronic Spree`
- `The Tan and Sober Gentlemen` - 2026-09-05T01:30 - Live Performances - `The Tan and Sober Gentlemen`
- `The Video Game Costume Contest` - 2026-09-04T17:30 - Video Gaming - `Alison Carrier`, `Dustin Fletcher`, `Mikal Mosley`, `Paris K Arrowsmith`
- `The World of Monster High: The Movies, the Shows, the Dolls, & More` - 2026-09-05T11:30 - Urban Fantasy - `Austinn West`, `Carol Malcolm`, `Gabby`, `Gracie Palmer`, `Vikki Ortone`
- `ZombieCON Vol. 1: Fan Discussion Panel` - 2026-09-04T19:00 - Apocalypse Rising - `Jonathan Sarge`, `Kyle Valle`
