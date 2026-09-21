# Tag census v2 - the 2026 schedule

Written by `census_v2.py` from `data/2026/events.v2.json` (`generated_at` 2026-09-07T12:50:19+00:00, source https://app.core-apps.com/dragoncon26), which it first builds afresh from `data/2026/events.json`, `data/registry/` and `data/2026/tags.cache.jsonl`, and stops unless the two are the same; beside them, the drafter's sidecar, `data/registry/people.draft.json`. Do not edit it by hand; run the script again. CI fails when it is stale (DECISIONS #35).

It states facts and recommends nothing. `UNSURE` marks a candidate that needs a person's judgment, and nothing here resolves one. Lists run by count, descending, then by name; a list with no counts runs by name. Event titles and the names of works and people are in code spans, so that their punctuation shows as written.

It asks the questions of `census-2026.md` of the v2 file where they survive. Not asked again: v1's section 8, descriptions, since the tagger is now sent 2,000 characters and section 12 counts the descriptions past them; and v1's section 9, facets in titles, which the parse stage reads (`parse-2026.md`).

It never links: only the tagger links an event to a work (#34). Where a list here comes of matching text, every row is UNSURE, and the fix it names is a person's: a `"model": "hand"` line in the cache.

## 0. Headline

1. Events: 3,459 in `events.v2.json`, a fresh build. Every event has exactly one cache line: 2,580 lines for 2,580 distinct inputs.
2. Works linked: 540, by 1,699 links - `about` 1,669 on 1,594 events, `track` 30, `credit` 0. Events with no work and no axis value: 285 (8.2%).
3. Unreviewed works: 253 of 718 - the drafter's 198, the tagger's 55, other 0. Linked by events: 89, on 318 events (Appendix A).
4. Kind: of the 3,449 events v1 tagged, 3,147 keep their kind; the pairs that differ: 42, over 312 events. The largest kind: `panel` (1,086). Events that say wrestl*: 5, each UNSURE.
5. Audience: `all` 3,266, `mature` 105, `kids` 88. Events where v1's `adult` and v2's `mature` disagree: 9.
6. Play: on 868 of 931 gaming events; on other events: 0.
7. Guests: on 0 events; v1 called 470 `celebrity`. People: 1,798 ids; `people.json` holds 143, reviewed 2. On qa, photo and signing events and not in `people.json`: 198 (Appendix B).
8. Tracks: track and axis pairs where one value is on 80% or more of the track's events and `tracks.json` does not decide: 19 (UNSURE).
9. Recurring: repeat groups that sent more than one input: 45 of 371; of those, building different tags: 8. Hand lines in the cache: 0.
10. Links to check (UNSURE): resume mentions: 49, on 22 inputs. Music performances with no work: 72; with a registry work's name in the title: 1.
11. v1 fandoms: 815 assignments compared - same 553, more specific 108, less specific 6, lost 148.
12. Text: double-encoded events: 45; model strings that look double-encoded: 0. Strings holding U+2018: 1; U+FFFD: 0. Descriptions over the cap: 0.

## 1. Coverage

- Events: 3,459. `count` in the file says 3,459, which agrees.
- Every event has exactly one cache line: the 3,459 events send 2,580 distinct inputs, and each input's key is on exactly one of the cache's 2,580 lines.
- No work, by any via, and no axis value: 285 (8.2%).

No work and no axis value, by kind:

| kind | events | of | share |
| --- | ---: | ---: | ---: |
| `photo` | 233 | 506 | 46.0% |
| `panel` | 16 | 1,086 | 1.5% |
| `other` | 12 | 78 | 15.4% |
| `contest` | 6 | 67 | 9.0% |
| `workshop` | 6 | 197 | 3.0% |
| `qa` | 4 | 118 | 3.4% |
| `party` | 3 | 62 | 4.8% |
| `gaming` | 2 | 868 | 0.2% |
| `signing` | 2 | 137 | 1.5% |
| `screening` | 1 | 116 | 0.9% |

No work and no axis value, by track (top 15; an event with two tracks counts under both):

| track | events | of | share |
| --- | ---: | ---: | ---: |
| Epic Photos | 233 | 318 | 73.3% |
| Main Programming | 12 | 96 | 12.5% |
| Apocalypse Rising | 8 | 35 | 22.9% |
| Robotics and Maker Track | 7 | 51 | 13.7% |
| Digital Media | 6 | 134 | 4.5% |
| Alternate and Historical Fiction | 5 | 64 | 7.8% |
| Kids Track | 5 | 48 | 10.4% |
| Military Sci-fi Media | 3 | 45 | 6.7% |
| BritTrack | 2 | 50 | 4.0% |
| Silk Road | 2 | 29 | 6.9% |
| Vendor Workshops/Events | 2 | 139 | 1.4% |
| (no track) | 1 | 1 | 100.0% |
| American Sci-fi and Fantasy Media | 1 | 61 | 1.6% |

## 2. Works

- Distinct works linked: 540, by 1,699 links. A work linked more than one way on one event is listed once, under its strongest via: about, then track, then credit (#32).

| via | works | links | events |
| --- | ---: | ---: | ---: |
| `about` | 540 | 1,669 | 1,594 |
| `track` | 2 | 30 | 30 |
| `credit` | 0 | 0 | 0 |

How many works have how many events, by any via:

| events | works |
| --- | ---: |
| 1 | 346 |
| 2 | 78 |
| 3-5 | 57 |
| 6-20 | 49 |
| 21+ | 10 |

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
| `marvel` | `marvel` | 14 | 12 |
| `castle` | `Castle` | 9 | 12 |
| `alien` | `Alien` | 7 | 19 |
| `one-piece` | `one piece` | 6 | 6 |
| `wednesday` | `Wednesday` | 5 | 7 |
| `the-rookie` | `rookie` | 5 | 5 |
| `game-of-thrones` | `GoT` | 5 | 3 |
| `dc-comics` | `DC` | 4 | 41 |
| `fallout` | `fallout` | 3 | 3 |
| `labyrinth` | `Labyrinth` | 3 | 3 |
| `twilight` | `twilight` | 3 | 3 |
| `rent` | `rent` | 2 | 2 |
| `destiny` | `Destiny` | 1 | 2 |
| `predator` | `Predator` | 1 | 2 |
| `persona` | `persona` | 1 | 1 |
| `the-league` | `League` | 0 | 17 |
| `300` | `300` | 0 | 1 |
| `nurses` | `Nurses` | 0 | 1 |
| `star-trek-voyager` | `Voyager` | 0 | 1 |
| `the-choice` | `Choice` | 0 | 1 |
| `titans` | `titans` | 0 | 1 |
| `companion` | `companion` | 0 | 0 |
| `dinosaurs` | `dinosaurs` | 0 | 0 |
| `loki` | `Loki` | 0 | 0 |
| `lucifer` | `Lucifer` | 0 | 0 |
| `portal` | `portal` | 0 | 0 |
| `saw` | `saw` | 0 | 0 |
| `suits` | `suits` | 0 | 0 |
| `the-closer` | `closer` | 0 | 0 |
| `what-if` | `What if` | 0 | 0 |

### Unreviewed works

- 253 of the 718 works are `reviewed: false`, and events link 89 of them, on 318 events.
- By where they came from: the drafter, when the sidecar's `minted` holds the id; the tagger, when a cached answer names it otherwise - `tag_stage.py` keeps no record of what it mints, so this is inferred; other, neither.

| source | works | linked | on events |
| --- | ---: | ---: | ---: |
| drafter | 198 | 34 | 90 |
| tagger | 55 | 55 | 229 |
| other | 0 | 0 | 0 |
| all | 253 | 89 | 318 |

Linked by events: 89, listed in Appendix A. Linked by none: 164, counted here and not listed.

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
| (absent) | 3,459 | 100.0% |

### The Celebrity badge

v1 `guests` against v2 `guests`:

| v1 guests | `celebrity` | `creator` | (absent) |
| --- | ---: | ---: | ---: |
| `fan` | 0 | 0 | 1,405 |
| `creator` | 0 | 0 | 1,188 |
| `celebrity` | 0 | 0 | 470 |
| `unknown` | 0 | 0 | 386 |
| (untagged) | 0 | 0 | 10 |

The 470 events v1 called `celebrity` that v2 does not are in Appendix C, with up to 5 of their people each.

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
| drafted | 141 | 116 |
| rejected by model | 112 | 36 |
| rejected by review | 2 | 0 |
| reviewed | 2 | 0 |
| all | 1,798 | 314 |

### Drafted people: 141

Every `people.json` entry with `reviewed: false`: celebrities first, then by events, then by id. Confidence is the drafter's, from the sidecar. Each credit shows its work's own reviewed state; 0 of the 327 credits are reviewed themselves.

| id | name | tier | confidence | events | qa | photo | signing | other | credits |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `alan-tudyk` | `Alan Tudyk` | celebrity | high | 16 | 1 | 14 | 0 | 1 | `firefly` (reviewed), `resident-alien` (unreviewed), `rogue-one-a-star-wars-story` (unreviewed), `tucker-and-dale-vs-evil` (unreviewed), `harley-quinn` (unreviewed) |
| `tawny-newsome` | `Tawny Newsome` | celebrity | high | 16 | 3 | 12 | 0 | 1 | `star-trek-lower-decks` (reviewed), `space-force` (unreviewed), `bajillion-dollar-propertie` (unreviewed) |
| `eugene-cordero` | `Eugene Cordero` | celebrity | high | 15 | 3 | 12 | 0 | 0 | `star-trek-lower-decks` (reviewed), `loki` (unreviewed), `the-good-place` (unreviewed), `tacoma-fd` (unreviewed) |
| `jewel-staite` | `Jewel Staite` | celebrity | high | 14 | 2 | 11 | 0 | 1 | `firefly` (reviewed), `stargate-atlantis` (unreviewed), `resident-alien` (unreviewed), `the-l-a-complex` (unreviewed) |
| `anthony-montgomery` | `Anthony Montgomery` | celebrity | high | 13 | 4 | 9 | 0 | 0 | `star-trek-enterprise` (reviewed) |
| `connor-trinneer` | `Connor Trinneer` | celebrity | high | 13 | 4 | 9 | 0 | 0 | `star-trek-enterprise` (reviewed), `stargate-atlantis` (unreviewed) |
| `grace-park` | `Grace Park` | celebrity | high | 13 | 3 | 10 | 0 | 0 | `battlestar-galactica` (reviewed), `hawaii-five-0` (unreviewed), `a-million-little-things` (unreviewed) |
| `jon-huertas` | `Jon Huertas` | celebrity | high | 13 | 3 | 8 | 0 | 2 | `castle` (reviewed), `this-is-us` (unreviewed), `generation-kill` (unreviewed) |
| `seamus-dever` | `Seamus Dever` | celebrity | high | 13 | 3 | 8 | 0 | 2 | `castle` (reviewed), `titans` (unreviewed), `general-hospital` (unreviewed) |
| `tricia-helfer` | `Tricia Helfer` | celebrity | high | 13 | 3 | 10 | 0 | 0 | `battlestar-galactica` (reviewed), `lucifer` (unreviewed), `killer-women` (unreviewed) |
| `dawnn-lewis` | `Dawnn Lewis` | celebrity | high | 12 | 3 | 9 | 0 | 0 | `star-trek-lower-decks` (reviewed), `a-different-world` (unreviewed), `futurama` (unreviewed) |
| `melanie-scrofano` | `Melanie Scrofano` | celebrity | high | 12 | 3 | 9 | 0 | 0 | `wynonna-earp` (reviewed), `star-trek-strange-new-worlds` (reviewed), `letterkenny` (unreviewed), `ready-or-not` (unreviewed) |
| `nathan-fillion` | `Nathan Fillion` | celebrity | high | 12 | 2 | 10 | 0 | 0 | `firefly` (reviewed), `castle` (reviewed), `the-rookie` (reviewed), `guardians-of-the-galaxy` (unreviewed) |
| `noel-wells` | `Noël Wells` | celebrity | high | 12 | 3 | 9 | 0 | 0 | `star-trek-lower-decks` (reviewed), `master-of-none` (unreviewed), `saturday-night-live` (unreviewed) |
| `alice-wetterlund` | `Alice Wetterlund` | celebrity | high | 11 | 1 | 8 | 0 | 2 | `resident-alien` (unreviewed), `silicon-valley` (unreviewed) |
| `jack-quaid` | `Jack Quaid` | celebrity | high | 11 | 3 | 8 | 0 | 0 | `the-boys` (unreviewed), `star-trek-lower-decks` (reviewed), `scream` (unreviewed), `companion` (unreviewed), `the-hunger-games` (reviewed) |
| `levi-fiehler` | `Levi Fiehler` | celebrity | high | 11 | 1 | 8 | 0 | 2 | `resident-alien` (unreviewed) |
| `meredith-garretson` | `Meredith Garretson` | celebrity | high | 11 | 1 | 8 | 0 | 2 | `resident-alien` (unreviewed), `the-righteous-gemstones` (unreviewed) |
| `patricia-tallman` | `Patricia Tallman` | celebrity | high | 11 | 4 | 6 | 0 | 1 | `babylon-5` (reviewed), `night-of-the-living-dead` (unreviewed), `knightriders` (unreviewed), `star-trek-the-next-generation` (reviewed) |
| `sara-tomko` | `Sara Tomko` | celebrity | high | 11 | 1 | 8 | 0 | 2 | `resident-alien` (unreviewed), `once-upon-a-time` (unreviewed), `sneaky-pete` (unreviewed) |
| `bruce-boxleitner` | `Bruce Boxleitner` | celebrity | high | 10 | 4 | 6 | 0 | 0 | `babylon-5` (reviewed), `tron` (unreviewed), `scarecrow-and-mrs-king` (unreviewed) |
| `cassidy-freeman` | `Cassidy Freeman` | celebrity | high | 10 | 3 | 7 | 0 | 0 | `smallville` (reviewed), `longmire` (unreviewed), `the-righteous-gemstones` (unreviewed) |
| `claudia-black` | `Claudia Black` | celebrity | high | 10 | 4 | 6 | 0 | 0 | `farscape` (unreviewed), `stargate-sg-1` (reviewed), `dragon-age` (reviewed), `uncharted` (unreviewed) |
| `dominic-keating` | `Dominic Keating` | celebrity | high | 10 | 4 | 6 | 0 | 0 | `star-trek-enterprise` (reviewed) |
| `gina-torres` | `Gina Torres` | celebrity | high | 10 | 3 | 7 | 0 | 0 | `firefly` (reviewed), `suits` (unreviewed), `angel` (reviewed), `hercules-the-legendary-journeys` (unreviewed) |
| `jake-busey` | `Jake Busey` | celebrity | high | 10 | 4 | 6 | 0 | 0 | `starship-troopers` (reviewed), `the-frighteners` (unreviewed), `stranger-things` (reviewed), `agents-of-s-h-i-e-l-d` (unreviewed), `from-dusk-till-dawn` (unreviewed) |
| `julie-caitlin-brown` | `Julie Caitlin Brown` | celebrity | high | 10 | 3 | 6 | 0 | 1 | `babylon-5` (reviewed) |
| `katee-sackhoff` | `Katee Sackhoff` | celebrity | high | 10 | 2 | 8 | 0 | 0 | `battlestar-galactica` (reviewed), `the-mandalorian` (reviewed), `longmire` (unreviewed), `star-wars-the-clone-wars` (unreviewed) |
| `kathy-coleman` | `Kathy Coleman` | celebrity | high | 10 | 4 | 6 | 0 | 0 | `land-of-the-lost` (reviewed) |
| `mary-mcdonnell` | `Mary McDonnell` | celebrity | high | 10 | 3 | 7 | 0 | 0 | `battlestar-galactica` (reviewed), `major-crimes` (unreviewed), `the-closer` (unreviewed), `dances-with-wolves` (unreviewed), `independence-day` (unreviewed) |
| `michael-ironside` | `Michael Ironside` | celebrity | high | 10 | 4 | 6 | 0 | 0 | `starship-troopers` (reviewed), `total-recall` (unreviewed), `top-gun-maverick` (unreviewed), `scanners` (unreviewed), `splinter-cell` (unreviewed) |
| `phil-paley` | `Phil Paley` | celebrity | high | 10 | 4 | 6 | 0 | 0 | `land-of-the-lost` (reviewed) |
| `richard-dean-anderson` | `Richard Dean Anderson` | celebrity | high | 10 | 3 | 7 | 0 | 0 | `stargate-sg-1` (reviewed), `macgyver` (unreviewed) |
| `wesley-eure` | `Wesley Eure` | celebrity | high | 10 | 4 | 6 | 0 | 0 | `land-of-the-lost` (reviewed), `days-of-our-lives` (unreviewed) |
| `aaron-ashmore` | `Aaron Ashmore` | celebrity | high | 9 | 3 | 6 | 0 | 0 | `smallville` (reviewed), `warehouse-13` (unreviewed), `killjoys` (unreviewed), `locke-and-key` (unreviewed) |
| `anson-mount` | `Anson Mount` | celebrity | high | 9 | 1 | 6 | 0 | 2 | `star-trek-strange-new-worlds` (reviewed), `hell-on-wheels` (unreviewed), `inhumans` (unreviewed) |
| `ben-browder` | `Ben Browder` | celebrity | high | 9 | 3 | 6 | 0 | 0 | `farscape` (unreviewed), `stargate-sg-1` (reviewed) |
| `casper-van-dien` | `Casper Van Dien` | celebrity | high | 9 | 3 | 6 | 0 | 0 | `starship-troopers` (reviewed), `sleepy-hollow` (unreviewed) |
| `celia-rose-gooding` | `Celia Rose Gooding` | celebrity | high | 9 | 2 | 6 | 0 | 1 | `star-trek-strange-new-worlds` (reviewed), `jagged-little-pill` (unreviewed) |
| `denise-richards` | `Denise Richards` | celebrity | high | 9 | 3 | 6 | 0 | 0 | `starship-troopers` (reviewed), `wild-things` (unreviewed), `the-world-is-not-enough` (unreviewed), `the-real-housewives-of-beverly-hills` (unreviewed) |
| `dina-meyer` | `Dina Meyer` | celebrity | high | 9 | 3 | 6 | 0 | 0 | `starship-troopers` (reviewed), `saw` (unreviewed), `birds-of-prey` (unreviewed), `beverly-hills-90210` (unreviewed) |
| `jess-bush` | `Jess Bush` | celebrity | high | 9 | 2 | 6 | 0 | 1 | `star-trek-strange-new-worlds` (reviewed) |
| `kat-barrell` | `Kat Barrell` | celebrity | high | 9 | 3 | 6 | 0 | 0 | `wynonna-earp` (reviewed), `nurses` (unreviewed) |
| `michael-shanks` | `Michael Shanks` | celebrity | high | 9 | 3 | 6 | 0 | 0 | `stargate-sg-1` (reviewed), `stargate-the-ark-of-truth` (unreviewed), `saving-hope` (unreviewed), `burn-notice` (unreviewed) |
| `summer-glau` | `Summer Glau` | celebrity | high | 9 | 2 | 7 | 0 | 0 | `firefly` (reviewed), `terminator-the-sarah-connor-chronicles` (unreviewed), `arrow` (unreviewed), `dollhouse` (unreviewed) |
| `teryl-rothery` | `Teryl Rothery` | celebrity | high | 9 | 3 | 6 | 0 | 0 | `stargate-sg-1` (reviewed), `virgin-river` (unreviewed), `cedar-cove` (unreviewed) |
| `tim-rozon` | `Tim Rozon` | celebrity | high | 9 | 3 | 6 | 0 | 0 | `wynonna-earp` (reviewed), `schitts-creek` (reviewed), `surrealestate` (unreviewed), `instant-star` (unreviewed) |
| `varun-saranga` | `Varun Saranga` | celebrity | high | 9 | 3 | 6 | 0 | 0 | `wynonna-earp` (reviewed) |
| `edward-james-olmos` | `Edward James Olmos` | celebrity | high | 8 | 3 | 5 | 0 | 0 | `battlestar-galactica` (reviewed), `blade-runner` (unreviewed), `miami-vice` (unreviewed), `stand-and-deliver` (unreviewed), `coco` (unreviewed) |
| `erica-durance` | `Erica Durance` | celebrity | high | 8 | 3 | 5 | 0 | 0 | `smallville` (reviewed), `supergirl` (unreviewed), `saving-hope` (unreviewed) |
| `garrett-wang` | `Garrett Wang` | celebrity | high | 8 | 2 | 1 | 0 | 5 | `star-trek-voyager` (reviewed), `the-delta-flyers` (unreviewed) |
| `james-callis` | `James Callis` | celebrity | high | 8 | 3 | 5 | 0 | 0 | `battlestar-galactica` (reviewed), `bridget-joness-diary` (unreviewed), `12-monkeys` (unreviewed), `merlin` (unreviewed) |
| `molly-quinn` | `Molly Quinn` | celebrity | high | 8 | 3 | 5 | 0 | 0 | `castle` (reviewed), `guardians-of-the-galaxy` (unreviewed) |
| `erin-gray` | `Erin Gray` | celebrity | high | 7 | 0 | 3 | 0 | 4 | `buck-rogers-in-the-25th-century` (reviewed), `silver-spoons` (unreviewed) |
| `lena-headey` | `Lena Headey` | celebrity | high | 7 | 2 | 5 | 0 | 0 | `game-of-thrones` (reviewed), `terminator-the-sarah-connor-chronicles` (unreviewed), `300` (unreviewed), `the-brothers-grimm` (unreviewed), `dredd` (unreviewed) |
| `nivek-ogre` | `Nivek Ogre` | celebrity | high | 7 | 1 | 3 | 0 | 3 | `skinny-puppy` (unreviewed), `repo-the-genetic-opera` (unreviewed) |
| `shawn-ashmore` | `Shawn Ashmore` | celebrity | high | 7 | 3 | 4 | 0 | 0 | `x-men` (reviewed), `the-rookie-feds` (unreviewed), `the-boys` (unreviewed), `quantum-break` (unreviewed), `frozen` (unreviewed) |
| `tyler-labine` | `Tyler Labine` | celebrity | high | 7 | 2 | 5 | 0 | 0 | `tucker-and-dale-vs-evil` (unreviewed), `reaper` (unreviewed), `new-amsterdam` (unreviewed), `deadbeat` (unreviewed) |
| `aaron-douglas` | `Aaron Douglas` | celebrity | high | 6 | 3 | 3 | 0 | 0 | `battlestar-galactica` (reviewed) |
| `courtney-eaton` | `Courtney Eaton` | celebrity | high | 6 | 3 | 3 | 0 | 0 | `yellowjackets` (reviewed), `mad-max-fury-road` (unreviewed) |
| `lisseth-chavez` | `Lisseth Chavez` | celebrity | high | 6 | 2 | 4 | 0 | 0 | `the-rookie` (reviewed), `dcs-legends-of-tomorrow` (unreviewed), `chicago-p-d` (unreviewed) |
| `liz-callaway` | `Liz Callaway` | celebrity | high | 6 | 3 | 3 | 0 | 0 | `anastasia` (unreviewed), `the-lion-king-ii-simbas-pride` (unreviewed), `hazbin-hotel` (reviewed) |
| `peter-bramhill` | `Peter Bramhill` | celebrity | high | 6 | 2 | 3 | 0 | 1 | `final-fantasy-xiv` (unreviewed) |
| `ross-marquand` | `Ross Marquand` | celebrity | high | 6 | 2 | 3 | 0 | 1 | `the-walking-dead` (reviewed), `x-men-97` (unreviewed), `avengers-infinity-war` (unreviewed), `avengers-endgame` (unreviewed), `what-if` (unreviewed) |
| `sean-astin` | `Sean Astin` | celebrity | high | 6 | 3 | 3 | 0 | 0 | `the-lord-of-the-rings` (reviewed), `the-goonies` (unreviewed), `stranger-things` (reviewed), `rudy` (unreviewed), `50-first-dates` (unreviewed) |
| `symphony-sanders` | `Symphony Sanders` | celebrity | high | 6 | 1 | 0 | 0 | 5 | `welcome-to-night-vale` (unreviewed) |
| `tom-welling` | `Tom Welling` | celebrity | high | 6 | 2 | 4 | 0 | 0 | `smallville` (reviewed), `the-choice` (unreviewed), `cheaper-by-the-dozen` (unreviewed), `professionals-2020` (unreviewed) |
| `richard-t-jones` | `Richard T Jones` | celebrity | high | 5 | 3 | 2 | 0 | 0 | `the-rookie` (reviewed), `judging-amy` (unreviewed), `terminator-the-sarah-connor-chronicles` (unreviewed) |
| `thomas-sanders` | `Thomas Sanders` | celebrity | high | 5 | 0 | 0 | 0 | 5 | `sanders-sides` (unreviewed), `cartoon-therapy` (unreviewed) |
| `tomer-capone` | `Tomer Capone` | celebrity | high | 5 | 3 | 2 | 0 | 0 | `the-boys` (unreviewed) |
| `chuck-huber` | `Chuck Huber` | celebrity | high | 4 | 0 | 0 | 4 | 0 | `dragon-ball-z` (reviewed), `fullmetal-alchemist` (reviewed), `case-closed` (unreviewed) |
| `evie-templeton` | `Evie Templeton` | celebrity | high | 4 | 2 | 2 | 0 | 0 | `wednesday` (unreviewed) |
| `isaac-ordonez` | `Isaac Ordonez` | celebrity | high | 4 | 2 | 2 | 0 | 0 | `wednesday` (unreviewed), `doctor-strange-in-the-multiverse-of-madness` (unreviewed) |
| `james-saito` | `James Saito` | celebrity | high | 4 | 0 | 0 | 4 | 0 | `teenage-mutant-ninja-turtles` (reviewed), `eli-stone` (unreviewed) |
| `melissa-oneil` | `Melissa O'Neil` | celebrity | high | 4 | 2 | 2 | 0 | 0 | `the-rookie` (reviewed), `dark-matter` (unreviewed), `les-miserables` (unreviewed) |
| `alison-sealy-smith` | `Alison Sealy-Smith` | celebrity | high | 3 | 3 | 0 | 0 | 0 | `x-men-97` (unreviewed), `x-men-the-animated-series` (unreviewed) |
| `gillian-vigman` | `Gillian Vigman` | celebrity | high | 3 | 3 | 0 | 0 | 0 | `star-trek-lower-decks` (reviewed), `the-hangover` (unreviewed), `madtv` (unreviewed), `sonny-with-a-chance` (unreviewed) |
| `jason-marsden` | `Jason Marsden` | celebrity | high | 3 | 0 | 0 | 0 | 3 | `a-goofy-movie` (unreviewed), `the-fairly-oddparents` (unreviewed), `kingdom-hearts` (unreviewed), `young-justice` (unreviewed), `garfield` (unreviewed) |
| `delilah-s-dawson` | `Delilah S Dawson` | creator | high | 13 | 0 | 0 | 3 | 10 | `star-wars-phasma` (unreviewed), `kill-the-farm-boy` (unreviewed), `the-shadow-series` (unreviewed) |
| `aaron-michael-ritchey` | `Aaron Michael Ritchey` | creator | low | 11 | 0 | 0 | 1 | 10 | none |
| `michael-kovach` | `Michael Kovach` | creator | high | 11 | 2 | 8 | 0 | 1 | `the-amazing-digital-circus` (reviewed), `hazbin-hotel` (reviewed), `helluva-boss` (unreviewed) |
| `van-allen-plexico` | `Van Allen Plexico` | creator | low | 11 | 2 | 0 | 0 | 9 | `sentinels-2006` (unreviewed) |
| `becca-q-co` | `Becca Q. Co` | creator | high | 10 | 2 | 6 | 0 | 2 | `hades-ii` (unreviewed) |
| `emily-andras` | `Emily Andras` | creator | high | 10 | 4 | 6 | 0 | 0 | `wynonna-earp` (reviewed), `lost-girl` (unreviewed) |
| `judy-alice-lee` | `Judy Alice Lee` | creator | high | 10 | 2 | 6 | 0 | 2 | `hades-ii` (unreviewed) |
| `s-m-stirling` | `S. M. Stirling` | creator | high | 10 | 0 | 0 | 2 | 8 | `dies-the-fire` (unreviewed), `island-in-the-sea-of-time` (unreviewed), `the-peshawar-lancers` (unreviewed) |
| `skye-redden` | `Skye Redden` | creator | high | 10 | 2 | 6 | 0 | 2 | `the-amazing-digital-circus` (reviewed) |
| `alex-rochon` | `Alex Rochon` | creator | high | 9 | 2 | 6 | 0 | 1 | `the-amazing-digital-circus` (reviewed) |
| `amanda-hufford` | `Amanda Hufford` | creator | high | 9 | 2 | 6 | 0 | 1 | `the-amazing-digital-circus` (reviewed) |
| `amelia-tyler` | `Amelia Tyler` | creator | high | 9 | 2 | 6 | 0 | 1 | `baldurs-gate-3` (unreviewed), `hades-ii` (unreviewed) |
| `ashley-barrett` | `Ashley Barrett` | creator | high | 9 | 2 | 6 | 0 | 1 | `hades` (reviewed), `hades-ii` (unreviewed), `bastion` (unreviewed), `transistor` (unreviewed) |
| `erin-yvette` | `Erin Yvette` | creator | high | 9 | 2 | 6 | 0 | 1 | `hades-ii` (unreviewed), `oxenfree` (unreviewed), `pentiment` (unreviewed) |
| `jason-marnocha` | `Jason Marnocha` | creator | low | 9 | 2 | 6 | 0 | 1 | `hades-ii` (unreviewed), `hades` (reviewed) |
| `jim-butcher` | `Jim Butcher` | creator | high | 9 | 1 | 0 | 2 | 6 | `the-dresden-files` (unreviewed), `codex-alera` (unreviewed), `the-cinder-spires` (unreviewed) |
| `kevin-carlson` | `Kevin Carlson` | creator | low | 9 | 1 | 0 | 2 | 6 | none |
| `leanna-renee-hieber` | `Leanna Renee Hieber` | creator | high | 9 | 0 | 0 | 1 | 8 | `strangely-beautiful` (unreviewed), `the-eterna-files` (unreviewed) |
| `marissa-lenti` | `Marissa Lenti` | creator | high | 9 | 2 | 6 | 0 | 1 | `the-amazing-digital-circus` (reviewed) |
| `sherrilyn-kenyon` | `Sherrilyn Kenyon` | creator | high | 9 | 1 | 0 | 2 | 6 | `dark-hunter` (unreviewed), `chronicles-of-nick` (unreviewed), `the-league` (unreviewed), `deadmans-cross` (unreviewed) |
| `steve-saffel` | `Steve Saffel` | creator | low | 9 | 0 | 0 | 0 | 9 | none |
| `timothy-zahn` | `Timothy Zahn` | creator | high | 9 | 3 | 0 | 3 | 3 | `thrawn` (unreviewed), `heir-to-the-empire` (unreviewed), `cobra-1985` (unreviewed), `blackcollar` (unreviewed) |
| `hal-lublin` | `Hal Lublin` | creator | high | 8 | 2 | 0 | 0 | 6 | `welcome-to-night-vale` (unreviewed), `the-thrilling-adventure-hour` (unreviewed), `we-got-this-with-mark-and-hal` (unreviewed) |
| `brobdingnagian-bards` | `Brobdingnagian Bards` | creator | high | 7 | 0 | 0 | 0 | 7 | none |
| `javier-prusky` | `Javier Prusky` | creator | low | 7 | 2 | 3 | 0 | 2 | `final-fantasy-xiv` (unreviewed) |
| `mark-gagliardi` | `Mark Gagliardi` | creator | high | 7 | 2 | 0 | 0 | 5 | `the-thrilling-adventure-hour` (unreviewed), `we-got-this-with-mark-and-hal` (unreviewed), `drunk-history` (unreviewed) |
| `mark-meer` | `Mark Meer` | creator | high | 7 | 0 | 0 | 0 | 7 | `mass-effect` (unreviewed), `dragon-age` (reviewed) |
| `richard-lord-british-garriott` | `Richard Lord British"" Garriott` | creator | high | 7 | 1 | 0 | 0 | 6 | `ultima` (unreviewed), `ultima-online` (unreviewed), `shroud-of-the-avatar` (unreviewed) |
| `elisa-teague` | `Elisa Teague` | creator | low | 6 | 0 | 0 | 0 | 6 | `tales-of-the-valiant` (reviewed) |
| `tony-diterlizzi` | `Tony DiTerlizzi` | creator | high | 6 | 2 | 0 | 0 | 4 | `the-spiderwick-chronicles` (unreviewed), `dungeons-and-dragons` (reviewed), `planescape` (unreviewed), `the-search-for-wondla` (unreviewed) |
| `viv-medrano` | `Viv Medrano` | creator | high | 6 | 2 | 4 | 0 | 0 | `hazbin-hotel` (reviewed), `helluva-boss` (unreviewed) |
| `b-dave-walters` | `B. Dave Walters` | creator | high | 5 | 0 | 0 | 0 | 5 | `dungeons-and-dragons` (reviewed) |
| `doc-hammer` | `Doc Hammer` | creator | high | 5 | 0 | 0 | 0 | 5 | `the-venture-bros` (reviewed) |
| `jordan-morris` | `Jordan Morris` | creator | low | 5 | 0 | 0 | 0 | 5 | `jordan-jesse-go` (unreviewed), `bubble` (unreviewed) |
| `kirk-thatcher` | `Kirk Thatcher` | creator | high | 5 | 1 | 0 | 0 | 4 | `the-muppets` (reviewed), `star-trek-iv-the-voyage-home` (unreviewed), `dinosaurs` (unreviewed) |
| `lyndsay-ely` | `Lyndsay Ely` | creator | low | 5 | 0 | 0 | 1 | 4 | `gunslinger-girl` (unreviewed) |
| `aurelio-voltaire` | `Aurelio Voltaire` | creator | high | 4 | 0 | 0 | 0 | 4 | none |
| `banachek` | `Banachek` | creator | high | 4 | 0 | 0 | 0 | 4 | none |
| `ben-singer-death-battle` | `Ben Singer Death Battle` | creator | high | 4 | 3 | 0 | 0 | 1 | `death-battle` (unreviewed) |
| `berta-platas` | `Berta Platas` | creator | low | 4 | 0 | 0 | 0 | 4 | none |
| `beth-patterson` | `Beth Patterson` | creator | low | 4 | 0 | 0 | 0 | 4 | none |
| `brian-c-thompson` | `Brian C. Thompson` | creator | low | 4 | 0 | 0 | 1 | 3 | none |
| `d-j-butler` | `D.J. Butler` | creator | low | 4 | 0 | 0 | 2 | 2 | `witchy-eye` (unreviewed) |
| `ken-napzok` | `Ken Napzok` | creator | low | 4 | 0 | 0 | 0 | 4 | `why-we-love-star-wars` (unreviewed) |
| `larry-niven` | `Larry Niven` | creator | high | 4 | 0 | 0 | 0 | 4 | `ringworld` (unreviewed), `the-mote-in-gods-eye` (unreviewed), `known-space` (unreviewed), `lucifers-hammer` (unreviewed) |
| `phil-parsons` | `Phil Parsons` | creator | low | 4 | 0 | 0 | 4 | 0 | `dragon-ball-z` (reviewed) |
| `rogue` | `Rogue` | creator | high | 4 | 1 | 0 | 0 | 3 | `the-cruxshadows` (unreviewed) |
| `tom-smith` | `Tom Smith` | creator | high | 4 | 0 | 0 | 0 | 4 | none |
| `yaya-han` | `Yaya Han` | creator | high | 4 | 0 | 0 | 0 | 4 | `heroes-of-cosplay` (unreviewed) |
| `chad-james-death-battle` | `Chad James Death Battle` | creator | high | 3 | 3 | 0 | 0 | 0 | `death-battle` (unreviewed) |
| `georgie-leahy` | `Georgie Leahy` | creator | low | 3 | 3 | 0 | 0 | 0 | `helluva-boss` (unreviewed), `hazbin-hotel` (reviewed) |
| `gui-agustini` | `Gui Agustini` | creator | low | 3 | 3 | 0 | 0 | 0 | `x-men-97` (unreviewed) |
| `cruxshadows` | `Cruxshadows` | creator | high | 2 | 1 | 0 | 0 | 1 | `the-cruxshadows` (unreviewed) |
| `matthew-waterson` | `Matthew Waterson` | creator | high | 2 | 2 | 0 | 0 | 0 | `x-men-97` (unreviewed) |
| `mike-phirman` | `Mike Phirman` | creator | low | 2 | 0 | 0 | 0 | 2 | `hard-n-phirm` (unreviewed), `chowdaheads` (unreviewed) |
| `ming-chen` | `Ming Chen` | creator | high | 2 | 0 | 0 | 0 | 2 | `comic-book-men` (unreviewed), `tell-em-steve-dave` (unreviewed) |
| `bit-brigade` | `Bit Brigade` | creator | high | 1 | 0 | 0 | 0 | 1 | none |
| `jonathan-coulton` | `Jonathan Coulton` | creator | high | 1 | 0 | 0 | 0 | 1 | `portal` (unreviewed), `code-monkey` (unreviewed) |
| `paul-and-storm` | `Paul and Storm` | creator | high | 1 | 0 | 0 | 0 | 1 | `w00tstock` (unreviewed), `da-vincis-notebook` (unreviewed) |
| `psychostick` | `Psychostick` | creator | high | 1 | 0 | 0 | 0 | 1 | `psychostick` (unreviewed) |
| `starr-long` | `Starr Long` | creator | high | 1 | 1 | 0 | 0 | 0 | `ultima-online` (unreviewed), `shroud-of-the-avatar` (unreviewed) |
| `the-cybertronic-spree` | `The Cybertronic Spree` | creator | high | 1 | 0 | 0 | 0 | 1 | `the-transformers-the-movie` (unreviewed) |
| `the-tan-and-sober-gentlemen` | `The Tan and Sober Gentlemen` | creator | high | 1 | 0 | 0 | 0 | 1 | none |

### Not in `people.json`, on qa, photo or signing events: 198

The top 30 by those events; all 198 are in Appendix B.

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
| `Sena Bryer` | `sena-bryer` | rejected by model | 2 | 3 | 0 | 6 |
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
| same | 553 | 67.9% |
| lost | 148 | 18.2% |
| more specific | 108 | 13.3% |
| less specific | 6 | 0.7% |

The lost, by the event's v2 kind:

| kind | assignments |
| --- | ---: |
| `photo` | 52 |
| `panel` | 33 |
| `gaming` | 24 |
| `performance` | 14 |
| `qa` | 13 |
| `signing` | 8 |
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

### Lost, by fandom: 148

Fandoms: 33.

**Star Trek** (31)

- `Photo Session: Jess Bush` (3)
- `Photo Session: Photo session: Anthony Montgomery Solo` (3)
- `Photo Session: Photo session: Connor Trinneer Solo` (3)
- `Photo Session: Photo session: Dominic Keating Solo` (3)
- `Photo Session: Photo session: Eugene Cordero Solo` (3)
- `Photo Session: Photo session: Noel Wells Solo` (3)
- `Photo Session: Photo session: Tawny Newsome Solo` (3)
- `Photo Session: Photo session: Dawnn Lewis Solo` (2)
- `Felt Nerdy's Stargate Puppet Show!`
- `Galaxy Quest`
- `How Did You Get So Lucky? – An Hour with Kirk Thatcher`
- `Patricia Tallman's Greatest Hits: From Knightriders to Night of Living Dead`
- `Photo Session: Celia Rose Gooding`
- `Photo Session: Photo session: Garrett Wang Solo`
- `Photo Session: Photo session: Michael Shanks Solo`
- `Photo Session: Photo session: Stargate - SG1`

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

**The Lord of the Rings** (9)

- `Photo Session: Photo session: Sean Astin Solo` (2)
- `An Evening In Bree`
- `Brobdignagian Bards`
- `Coming Soon: The Magician's Nephew`
- `LOotR: Ribbon Drop STAGING (Participants ONLY)`
- `Please Adapt This`
- `The Life and Times of Sean Astin`
- `The Mentorship of Moiraine`

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

**Battlestar Galactica** (5)

- `Photo Session: Photo session: Grace Park Solo` (2)
- `Photo Session: Photo session: Tricia Helfer Solo` (2)
- `Photo Session: Photo session: Edward James Olmos Solo`

**Starship Troopers** (5)

- `Photo Session: Photo session: Casper Van Dien Solo`
- `Photo Session: Photo session: Denise Richards Solo`
- `Photo Session: Photo session: Dina Meyer Solo`
- `Photo Session: Photo session: Jake Busey Solo`
- `Photo Session: Photo session: Michael Ironside Solo`

**Firefly** (4)

- `Nerdy Irish Pub Song Sing-along` (2)
- `MSFM MAD-LIBs – LIVE!`
- `Mikey Mason`

**Game of Thrones** (4)

- `Hear Me Roar: An Hour with Lena Headey`
- `Long May She Reign: An Hour with Lena Headey`
- `Photo Session: Photo session: Lena Headey Solo`
- `Photoshoot: We Do Not Care Club`

**Pokemon** (4)

- `Mario Night`
- `Photoshoot: Dragonball`
- `Photoshoot: Sonic and Friends/Villains`
- `What Exactly Is Kirby?`

**Land of the Lost** (3)

- `Photo Session: Photo session: Kathy Coleman Solo`
- `Photo Session: Photo session: Phillip Paley Solo`
- `Photo Session: Wesley Eure Solo`

**My Hero Academia** (3)

- `Chuck Huber & Phil Parsons Signing – Vendors Booth # 2529`
- `Chuck Huber and Phil Parsons Signing – Booth #2529`
- `Phil Parsons and Chuck Huber Signing – Vendors Booth 2529`

**Stargate** (3)

- `MSFM MAD-LIBs – LIVE!`
- `Photo Session: Photo session: Richard Dean Anderson Solo`
- `Photo Session: Photo session: Teryl Rothery Solo`

**Stranger Things** (3)

- `Licensed Properties in Comics`
- `Tales from the Loop: Friend or Foe?`
- `The Life and Times of Sean Astin`

**Warhammer 40,000** (3)

- `Battletech Classic - Boot Camp`
- `Battletech Classic - NAIS Adv. Combat School`
- `Battletech Classic - Rivalry`

**Dragon Ball** (2)

- `Chuck Huber & Phil Parsons Signing – Vendors Booth # 2529`
- `Chuck Huber and Phil Parsons Signing – Booth #2529`

**Hazbin Hotel** (2)

- `Alastor Explains Asexuality`
- `Helluva Boss Cast`

**The Expanse** (2)

- `Built on Big Ideas: The Renaissance of Hard SF Media`
- `Photoshoot: Dresden Files, Alera & Cinder Spires`

**Babylon 5** (1)

- `MSFM MAD-LIBs – LIVE!`

**Chainsaw Man** (1)

- `CAIN: JJK/Chainsaw Man + XFiles/SCP/Control`

**Dragon Ball Z** (1)

- `Phil Parsons and Chuck Huber Signing – Vendors Booth 2529`

**Fallout** (1)

- `Photoshoot: The Pitt`

**Jujutsu Kaisen** (1)

- `CAIN: JJK/Chainsaw Man + XFiles/SCP/Control`

**Mighty Morphin Power Rangers** (1)

- `Chuck Huber and Phil Parsons Signing – Booth #2529`

**Rick and Morty** (1)

- `Adult Swim, Awesome Games, Great Job!`

**Smallville** (1)

- `Photo Session: Photo session: Cassidy Freeman Solo`

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

Strings the model wrote that look double-encoded, as a transport that decoded its reply wrongly would leave them: `works.json` names 0 of 718; cached work names 0 of 551; cached evidence 0 of 848.

### Two characters

U+2018 is a left single quote, which `parse_stage.fold` does not fold and `tag_stage.folded` does. U+FFFD is the replacement character, which a decoder leaves where it met bytes it could not read. Each place's distinct strings:

| where | strings | U+2018 | U+FFFD |
| --- | ---: | ---: | ---: |
| titles | 2,536 | 0 | 0 |
| descriptions | 2,189 | 1 | 0 |
| people's names on events | 1,811 | 0 | 0 |
| `people.json` names and aliases | 145 | 0 | 0 |
| `works.json` names and aliases | 778 | 0 | 0 |
| cached work names | 551 | 0 | 0 |
| cached evidence | 848 | 0 | 0 |
| the sidecar's strings | 1,116 | 0 | 0 |

- U+2018 in the description of `Building a Campaign for the Long Haul`

### Descriptions over the cap

- Events whose description, without its panelist line, runs past the 2,000 characters the tagger is sent: 0.

## 13. Observations

Facts from the sections above; at most ten.

- Events with no work and no axis value: 285 (8.2%); the kind with the most of them is `photo` (233), and the track Epic Photos (233).
- Works linked by one event: 346 of the 540 linked; the most, rolled up through descendants, is `dungeons-and-dragons` (138).
- Unreviewed works that events link: 89, on 318 events - the drafter's 34 and the tagger's 55.
- Events whose kind changed from v1: 312; the largest change is `panel` to `performance` (40).
- `mature` events: 105; made mature by the model alone 30, by the parse alone 1.
- Gaming events with no `play`: 63 of 931; the kind with the most of them is `workshop` (51).
- Events with `guests`: 0. Reviewed people in `people.json`: 2; reviewed credits: 0. Events v1 called `celebrity`: 470.
- People on qa, photo and signing events who are not in `people.json`: 198 - never drafted (162), rejected by model (36).
- Repeat groups that sent more than one input: 45 of 371; of those, building different tags: 8.
- v1 fandom assignments lost in v2: 148 of 815; the fandom with the most is Star Trek (31).

## Appendix A. Unreviewed works that events link

| id | name | source | type | parent | events | titles, up to 3 |
| --- | --- | --- | --- | --- | ---: | --- |
| `brandish` | `Brandish` | tagger | game / ccg |  | 44 | `Brandish, , the duelist's card game (DEMO)` |
| `worn-wanderers` | `Worn Wanderers` | tagger | game / ccg |  | 17 | `Worn Wanderers Booster Draft`, `Worn Wanderers Learn to Play`, `Worn Wanderers Tournament` ... |
| `murder-hobo-tavern-brawl` | `Murder Hobo Tavern Brawl` | tagger | game / board |  | 15 | `Destroy Your Friends with Murder Hobo Tavern Brawl!` |
| `barely-coping` | `Barely Coping` | tagger | game / board |  | 14 | `BARELY COPING? Play the Game! (17+)` |
| `luminous` | `Luminous` | tagger | game / ccg |  | 14 | `Learn to Play Luminous Card Game` |
| `into-the-lair` | `Into the Lair` | tagger | game / rpg |  | 12 | `Into the Lair: The Beast of Briar Ridge`, `Into the Lair: The Night Shift` |
| `resident-alien` | `Resident Alien` | drafter | franchise |  | 11 | `Photo Session: Photo session: Resident Alien`, `Photo Session: Photo session: Resident Alien Couple`, `Photo Session: Photo session: Resident Alien Duo` ... |
| `the-boys` | `The Boys` | drafter | franchise |  | 11 | `Academic: Post-Modern Superheroes – Power, Violence, & Trauma`, `Photo Session: The Boys`, `Photoshoot: The Boys` ... |
| `urban-insanity` | `Urban Insanity` | tagger | game / board |  | 10 | `Urban Insanity` |
| `final-fantasy-xiv` | `Final Fantasy XIV` | drafter | game / video | `final-fantasy` | 9 | `FFXIV Cast Q&A`, `FFXIV Team Trivia with Friends!`, `Final Fantasy Fish Finding Scavenger Hunt (FFFFSH!)` ... |
| `inter-sidera` | `Inter Sidera` | tagger | game / rpg |  | 8 | `Inter Sidera: Attempted murder of Sir Flynn Doyle`, `Inter Sidera: Coronatus War- Prometheus's Fire`, `Inter Sidera: The War for Coronatus with Creator` |
| `time-rift` | `Time Rift` | tagger | game / ccg |  | 7 | `Time Rift - Casual play pods - Each half hour`, `Time Rift - Constructed Tournament - Empire Builders`, `Time Rift - Demos- Learn to play, Get free cards` |
| `armored-coffins` | `Armored Coffins` | tagger | game / rpg |  | 6 | `Armored Coffins: Illusory Remnants`, `Armored Coffins: Titanomachy` |
| `hades-ii` | `Hades II` | drafter | game / video | `hades` | 6 | `Hades II Guests`, `Hades II Live`, `Hades II cast` ... |
| `land-and-sea` | `Land & Sea` | tagger | franchise |  | 6 | `Land & Sea Miniatures Game` |
| `safe-mode-disabled` | `Safe Mode: Disabled` | tagger | game / rpg |  | 6 | `Safe Mode Disabled: Con Crashers Adventure` |
| `the-garden` | `The Garden` | tagger | game / rpg |  | 5 | `The Garden: The Salt Crust Sanctum` |
| `wednesday` | `Wednesday` | drafter | franchise |  | 5 | `Family & Friends at Nevermore: Wednesday Cast`, `Family Matters: A Wednesday Fan Panel`, `Photo session: Wednesday` ... |
| `battlequest` | `BattleQuest` | tagger | game / miniatures |  | 4 | `BattleQuest Adventure Awaits` |
| `cataclysm-arcade-tcg` | `Cataclysm Arcade TCG` | tagger | game / ccg |  | 4 | `Cataclysm Arcade TCG Free Demos` |
| `ember-obsidian-protocol` | `Ember: Obsidian Protocol` | tagger | game / miniatures |  | 4 | `E:OP - Official Ember: Obsidian Protocol Tournament` |
| `helluva-boss` | `Helluva Boss` | drafter | franchise |  | 4 | `Helluva Boss Cast`, `Helluva Hazbin Sing-Along`, `Meet the Hellaverse Cast` ... |
| `supergirl` | `Supergirl` | drafter | franchise | `dc-comics` | 4 | `Supergirl & Lobo: An Unlikely Team-up`, `Supergirl: Beautiful Disaster`, `Supergirl: Woman of Tomorrow` ... |
| `x-men-97` | `X-Men '97` | drafter | franchise | `x-men` | 4 | `X-Men '97 Cast`, `X-Men '97 Guests`, `X-Men '97: The Mutant Saga` |
| `death-battle` | `Death Battle` | drafter | franchise |  | 3 | `Anime Death Battle: Who Would Win?`, `Death Battle: Behind the Scenes`, `Death Battle: Meet the Cast` |
| `koopia` | `Koopia` | tagger | game / board |  | 3 | `Koopia Demo` |
| `limbo-the-land-of-the-dead` | `Limbo: The Land of the Dead` | tagger | game / miniatures |  | 3 | `Limbo... The Land of the Dead` |
| `supershow-the-game` | `Supershow The Game` | tagger | game / ccg |  | 3 | `Return Of The Cosmic Crusaders`, `Supershow The Game - 2026 Dragon*Con Championship`, `Â¡SUPER LUCHA! Saturday Night` |
| `tucker-and-dale-vs-evil` | `Tucker & Dale vs. Evil` | drafter | franchise |  | 3 | `Photo Session: Photo session: Tucker and Dale vs Evil`, `You Want a Killer Hillbilly? – An Hour With Tyler Labine` |
| `be-awesome-together` | `Be Awesome Together` | tagger | franchise |  | 2 | `Be Awesome Together` |
| `codex-alera` | `Codex Alera` | drafter | franchise |  | 2 | `An Hour with Jim Butcher`, `Photoshoot: Dresden Files, Alera & Cinder Spires` |
| `earth-station-boo` | `Earth Station Boo` | tagger | franchise |  | 2 | `Earth Station Boo Show – LIVE!` |
| `farscape` | `Farscape` | drafter | franchise |  | 2 | `Claudia Black Live!`, `Space Muppets & CGI: Constructs as Characters in Farscape` |
| `game-mechanics` | `Game Mechanics` | tagger | franchise |  | 2 | `Game Mechanics LIVE` |
| `harley-quinn` | `Harley Quinn` | drafter | franchise | `dc-comics` | 2 | `Harley Quinn & the Gotham Sirens`, `Photoshoot: Harley Flash Mob` |
| `hollowed-oath` | `Hollowed Oath` | tagger | game / video |  | 2 | `Hollowed Oath` |
| `longmire` | `Longmire` | drafter | franchise |  | 2 | `Photo Session: Photo session: Longmire` |
| `night-of-the-living-dead` | `Night of the Living Dead` | drafter | franchise |  | 2 | `Patricia Tallman's Greatest Hits: From Knightriders to Night of Living Dead`, `The Undying Legacy: Celebrating Romero's Zombie World Since 1968` |
| `sock-puppets` | `Sock Puppets` | tagger | game / rpg |  | 2 | `Sock Puppets RPG: Make a Puppet`, `Sock Puppets RPG: The Episode Where Things Really Go off the Rails` |
| `star-forest` | `Star Forest` | tagger | franchise |  | 2 | `Kids Track Presents: Star Forest Goblin Song Craft`, `Star Forest Family-Friendly Dance *ENDS at 6PM*` |
| `terminator-the-sarah-connor-chronicles` | `Terminator: The Sarah Connor Chronicles` | drafter | franchise |  | 2 | `Photo Session: Photo session: Sarah Connor Chronicles Duo` |
| `the-cinder-spires` | `The Cinder Spires` | drafter | franchise |  | 2 | `An Hour with Jim Butcher`, `Photoshoot: Dresden Files, Alera & Cinder Spires` |
| `the-cruxshadows` | `The Cruxshadows` | drafter | franchise |  | 2 | `An Hour with The Cruxshadows: Discussion & Q&A`, `Cruxshadows` |
| `the-dresden-files` | `The Dresden Files` | drafter | franchise |  | 2 | `An Hour with Jim Butcher`, `Photoshoot: Dresden Files, Alera & Cinder Spires` |
| `the-transformers-the-movie` | `The Transformers: The Movie` | drafter | franchise | `transformers` | 2 | `Break the Rules, Take the Heat: Transformers the Movie at 40`, `The Transformers: The Movie Turns 40` |
| `those-were-the-days` | `Those Were the Days` | tagger | franchise |  | 2 | `Those Were the Days – LIVE!` |
| `welcome-to-night-vale` | `Welcome to Night Vale` | drafter | franchise |  | 2 | `Emily Henry`, `Welcome to Night Vale` |
| `wingspan-pocket` | `Wingspan Pocket` | tagger | game / board | `wingspan` | 2 | `Rose Tatu Productions Presents: Wingspan Pocket` |
| `young-justice` | `Young Justice` | drafter | franchise | `dc-comics` | 2 | `DC Comics' Animated TV Shows`, `Photoshoot: Teen Titans/Young Justice` |
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
| `knightriders` | `Knightriders` | drafter | franchise |  | 1 | `Patricia Tallman's Greatest Hits: From Knightriders to Night of Living Dead` |
| `neuroscape` | `NeuroScape` | tagger | game / ccg |  | 1 | `NeuroScape Sealed` |
| `no-latency` | `No Latency` | tagger | franchise |  | 1 | `No Latency – LIVE!` |
| `no-way-out` | `No Way Out` | tagger | franchise |  | 1 | `No Way Out: A Fan Panel` |
| `psychostick` | `Psychostick` | drafter | franchise |  | 1 | `Psychostick` |
| `reaper` | `Reaper` | drafter | franchise |  | 1 | `Don't Fear the Reaper – or, Maybe Do: An Hour with Tyler Labine` |
| `rogue-one-a-star-wars-story` | `Rogue One: A Star Wars Story` | drafter | franchise | `star-wars` | 1 | `10 Years of Rogue One` |
| `sanctuary` | `Sanctuary` | tagger | game / board |  | 1 | `Rose Tatu Productions Presents: Sanctuary` |
| `sarah-j-maas-universe` | `Sarah J Maas Universe` | tagger | franchise |  | 1 | `Photoshoot: Sarah J Maas Universe` |
| `saturday-night-live` | `Saturday Night Live` | drafter | franchise |  | 1 | `Classic TV Table Read: Saturday Night Live` |
| `scream` | `Scream` | drafter | franchise |  | 1 | `What's Your Favorite Scary Movie? The Scream Saga` |
| `starfire` | `Starfire` | tagger | franchise | `dc-comics` | 1 | `DC Comics' Animated TV Shows` |
| `talking-strange` | `Talking Strange` | tagger | franchise |  | 1 | `Talking Strange: Haunted Lore vs. Haunted History – LIVE!` |
| `tamora-pierce-universe` | `Tamora Pierce Universe` | tagger | franchise |  | 1 | `Photoshoot: Tamora Pierce Universe` |
| `the-demonatrix` | `The Demonatrix` | tagger | franchise |  | 1 | `The Demonatrix Screening` |
| `the-goonies` | `The Goonies` | drafter | franchise |  | 1 | `The Goonies` |
| `the-smoke-and-the-sea` | `The Smoke and the Sea` | tagger | franchise |  | 1 | `YA Book Club: The Smoke and the Sea – Katie Cross` |
| `the-someday-garden` | `The Someday Garden` | tagger | franchise |  | 1 | `Romance Book Club: The Someday Garden – Ashley Poston` |
| `tron` | `Tron` | drafter | franchise |  | 1 | `Tron/Ares: The Grid Evolves` |
| `ultima` | `Ultima` | drafter | franchise |  | 1 | `Dad's Garage Goes to Britannia (Ultima Series)` |
| `warriors` | `Warriors` | tagger | franchise |  | 1 | `Grown-up Games: Warrior Cats, or Game of Thrones?` |
| `we-got-this-with-mark-and-hal` | `We Got This with Mark and Hal` | drafter | franchise |  | 1 | `We Got This with Mark & Hal` |
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
| `Sena Bryer` | `sena-bryer` | rejected by model | 2 | 3 | 0 | 6 |
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
| `Victoria` | `victoria` | rejected by model | 1 | 0 | 0 | 2 |
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
- `All Good Things – Closing` - 2026-09-07T14:30 - Trek Track - `Garrett Wang`, `Joe Campbell`, `Leo Visentin`
- `Amazing Digital Circus Cast: Last Adventure` - 2026-09-06T13:00 - Animation - `Sammi Doneff`, `Amanda Hufford`, `Michael Kovach`, `Marissa Lenti`, `Skye Redden`, and 1 more
- `An Hour with Georgie Leahy` - 2026-09-04T19:00 - Animation - `Crispy`, `Georgie Leahy`
- `An Hour with Star Wars' Bo-Katan` - 2026-09-06T11:30 - Star Wars - `Primetime Steve`, `Katee Sackhoff`
- `An Hour with The Cruxshadows: Discussion & Q&A` - 2026-09-04T19:00 - Main Programming - `Rogue`, `Cruxshadows`
- `Anime Death Battle: Who Would Win?` - 2026-09-04T14:30 - Anime/Manga - `Ben Singer Death Battle`, `Chad James Death Battle`
- `Anime/Animation Cosplay Contest` - 2026-09-05T16:00 - Anime/Manga, Animation - `Jason Marsden`, `Jess Merriman`
- `Attack of the Celebrity Improv` - 2026-09-06T20:30 - Main Programming - `Ken Plume`, `Kelsey Ann Brady`, `Mark Gagliardi`, `Doc Hammer`, `Hal Lublin`, and 3 more
- `Aurelio Voltaire` - 2026-09-05T23:00 - Live Performances - `Aurelio Voltaire`
- `Avatar: Fire, Water, and Beyond` - 2026-09-05T13:00 - American Sci-fi and Fantasy Media - `Birma Gainor`, `Aaron Michael Ritchey`, `Nick Frutiger`
- `Babylon 5: A Dream Given Form` - 2026-09-06T10:00 - Military Sci-fi Media - `Thomas Parham`, `Bruce Boxleitner`, `Julie Caitlin Brown`, `Patricia Tallman`
- `Babylon 5: Clearing the Shadows` - 2026-09-04T14:30 - Military Sci-fi Media - `Primetime Steve`, `Bruce Boxleitner`, `Julie Caitlin Brown`, `Patricia Tallman`
- `Babylon 5: Space Station Conversation` - 2026-09-05T11:30 - Military Sci-fi Media - `Bobby Blackwolf`, `Bruce Boxleitner`, `Julie Caitlin Brown`, `Patricia Tallman`
- `Babylon 5: The End of One Chapter, the Beginning of Another` - 2026-09-07T10:00 - Military Sci-fi Media - `Van Allen Plexico`, `Bruce Boxleitner`
- `Banachek - Games of the Mind` - 2026-09-05T20:30 - Skeptics - `Curt Anderson`, `Banachek`
- `Bard Talk: Shakespeare with Shenanigans - LIVE!` - 2026-09-04T23:30 - Digital Media - `Sean Weiland`, `Paris K Arrowsmith`, `Catieosaurus`, `Mikal Mosley`
- `Bathroom of the Future` - 2026-09-05T01:30 - Live Performances - `Bathroom of the Future`
- `Battlestar Galactica: A Galaxy of Stars` - 2026-09-04T17:30 - Military Sci-fi Media - `Tony P Henderson`, `James Callis`, `Aaron Douglas`, `Tricia Helfer`, `Mary McDonnell`, and 2 more
- `Battlestar Galactica: Evolution` - 2026-09-06T11:30 - Military Sci-fi Media - `Marc Lee`, `James Callis`, `Aaron Douglas`, `Tricia Helfer`, `Mary McDonnell`, and 2 more
- `Battlestar Galactica: Humans and Cylons` - 2026-09-05T13:00 - Military Sci-fi Media - `Rob Levy`, `James Callis`, `Aaron Douglas`, `Tricia Helfer`, `Mary McDonnell`, and 3 more
- `Beth Patterson` - 2026-09-04T16:00 - Live Performances - Hyatt Concourse - `Beth Patterson`
- `Beth Patterson` - 2026-09-06T17:30 - Live Performances - Hyatt Concourse - `Beth Patterson`
- `Bit Brigade` - 2026-09-07T00:00 - Live Performances - `Bit Brigade`
- `Bringing Sam Gamgee to Life – A Visit with Sean Astin!` - 2026-09-05T11:30 - High Fantasy - `Tony P Henderson`, `Sean Astin`
- `CLOUDSAVE` - 2026-09-07T01:30 - Live Performances - `CLOUDSAVE`
- `Can Anyone Hear Me? A Yellowjackets Cast Panel` - 2026-09-04T10:00 - Horror - `Primetime Steve`, `Courtney Eaton`
- `Castle Cast` - 2026-09-05T11:30 - Main Programming - `Primetime Steve`, `Seamus Dever`, `Nathan Fillion`, `Jon Huertas`, `Molly Quinn`
- `Castle Cast` - 2026-09-06T13:00 - Main Programming - `Manda Montane`, `Seamus Dever`, `Jon Huertas`, `Molly Quinn`
- `Castle Guests` - 2026-09-04T14:30 - Main Programming - `Sammi Doneff`, `Seamus Dever`, `Jon Huertas`, `Molly Quinn`
- `Chuck Huber & Phil Parsons Signing – Vendors Booth # 2529` - 2026-09-04T10:00 - Vendor Workshops/Events - `Chuck Huber`, `Phil Parsons`
- `Chuck Huber and Phil Parsons Signing – Booth #2529` - 2026-09-06T10:00 - Vendor Workshops/Events - `Chuck Huber`, `Phil Parsons`
- `Classic Sci-Fi Charity Movie Lock-in : Howard the Duck` - 2026-09-04T19:00 - American Sci-fi Classics - `ToniAnn Marini`, `Michael Wesley Collins`, `Nick Frutiger`, `RL Grey`, `Trey Lawson`
- `Concert – Emily Henry` - 2026-09-04T13:00 - Filk Music - `Emily Henry`
- `Concert – The Brobdingnagian Bards` - 2026-09-05T20:30 - Filk Music - `Brobdingnagian Bards`
- `Concert – Tom Smith` - 2026-09-06T17:30 - Filk Music - `Tom Smith`
- `Cruxshadows` - 2026-09-07T01:30 - Live Performances - `Cruxshadows`, `Rogue`
- `Dad's Garage Goes to Britannia (Ultima Series)` - 2026-09-06T20:30 - Video Gaming - `Dad's Garage Theatre Co.`, `Richard Lord British"" Garriott`, `Mark Meer`
- `Death Battle: Meet the Cast` - 2026-09-06T19:00 - Anime/Manga - `Ben Singer Death Battle`, `Chad James Death Battle`
- `Delilah Dawson signing` - 2026-09-06T13:00 - Vendor Workshops/Events - `Delilah S Dawson`
- `Denim Arcade` - 2026-09-05T00:00 - Live Performances - `Denim Arcade`
- `Don't Fear the Reaper – or, Maybe Do: An Hour with Tyler Labine` - 2026-09-06T10:00 - Urban Fantasy - `Dave West`, `Tyler Labine`
- `Dragon Award Nominee & Past Recipients – Meet & Greet and Signings` - 2026-09-04T19:00 - Author Signings - `DCZev`, `Jim Butcher`, `D.J. Butler`, `Delilah S Dawson`, `Lyndsay Ely`, and 4 more
- `Dragon Awards Ceremony – LIVE!` - 2026-09-06T16:00 - Main Programming - `Ross Marquand`, `Matthew M Foster`, `Honor Santa Croce`, `Mandy Collier`, `Pat Henry`, and 2 more
- `Dragon Con Masquerade` - 2026-09-06T20:30 - Main Programming - `Fon H Davis`, `Catherine Lee Jones`, `Mikal Mosley`, `Anson Mount`, `Dot R Steverson`
- `Dragon Con Wrestling` - 2026-09-03T19:00 - Main Programming - `Victoria`
- `Everyone Welcome: Wynonna Earp Cast` - 2026-09-05T14:30 - Urban Fantasy - `Kevin Bachelder`, `Emily Andras`, `Kat Barrell`, `Tim Rozon`, `Varun Saranga`, and 1 more
- `FFXIV Cast Q&A` - 2026-09-04T14:30 - Video Gaming - `Rob Roberts`, `Peter Bramhill`, `Sena Bryer`, `Javier Prusky`
- `FFXIV Team Trivia with Friends!` - 2026-09-05T13:00 - Video Gaming - `Peter Bramhill`, `EmUnArum`, `Javier Prusky`, `Martin Freepaw`, `MelodicBlue`
- `Family & Friends at Nevermore: Wednesday Cast` - 2026-09-04T11:30 - Urban Fantasy - `Isaac Ordonez`, `Evie Templeton`, `Carol Malcolm`
- `Final Fantasy XIV Fireside Chat` - 2026-09-06T14:30 - Video Gaming - `Joey Davila`, `Peter Bramhill`, `Sena Bryer`, `Javier Prusky`
- `Firefly: One More Heist` - 2026-09-06T13:00 - Military Sci-fi Media - `Brian Richardson`, `Nathan Fillion`, `Summer Glau`, `Jewel Staite`, `Gina Torres`, and 1 more
- `Firefly: Seeking Serenity` - 2026-09-04T17:30 - Military Sci-fi Media - `Dot R Steverson`, `Summer Glau`, `Jewel Staite`, `Gina Torres`
- `Friday Night Costuming Contest` - 2026-09-04T20:30 - Costuming - `Yaya Han`, `Rob Roberts`
- `From FFXIV to FFXI: Adventuring in Vana'diel` - 2026-09-05T14:30 - Video Gaming - `Sena Bryer`, `EmUnArum`
- `Galactic Empire` - 2026-09-06T00:00 - Live Performances - `Galactic Empire`
- `Gil Gerard Remembered` - 2026-09-04T13:00 - Military Sci-fi Media - `Garrett Wang`, `Erin Gray`, `Janet Gerard`, `Pat Henry`, `Phil Collins`
- `Gil Gerard's Match Game in the 25th Century - with Garrett Wang` - 2026-09-04T19:30 - Main Programming - `Garrett Wang`, `Janet Gerard`
- `Gonzo Quiz Show: Looks Like We Made It` - 2026-09-06T19:00 - Main Programming - `Ken Plume`, `Kelsey Ann Brady`, `Mark Gagliardi`, `Doc Hammer`, `Mike Kaess`, and 6 more
- `Gonzo Quiz Show: The Return` - 2026-09-04T19:00 - Main Programming - `Ken Plume`, `Kelsey Ann Brady`, `Doc Hammer`, `Mike Kaess`, `Hal Lublin`, and 5 more
- `Gonzoroo Presents: A Music & Comedy Spectacular` - 2026-09-05T20:30 - Main Programming - `Ken Plume`, `Kelsey Ann Brady`, `Jonathan Coulton`, `Mark Gagliardi`, `Doc Hammer`, and 9 more
- `Hades II Guests` - 2026-09-04T11:30 - Video Gaming - `Crispy`, `Ashley Barrett`, `Becca Q. Co`, `Judy Alice Lee`, `Jason Marnocha`, and 2 more
- `Hades II cast` - 2026-09-07T11:30 - Video Gaming - `Bobby Blackwolf`, `Ashley Barrett`, `Becca Q. Co`, `Judy Alice Lee`, `Jason Marnocha`, and 2 more
- `Hear Me Roar: An Hour with Lena Headey` - 2026-09-06T10:00 - High Fantasy - `Dot R Steverson`, `Lena Headey`
- `Heavenly Hour with Liz Calloway` - 2026-09-04T11:30 - Animation - `Manda Montane`, `Liz Callaway`
- `Helluva Boss Cast` - 2026-09-05T19:00 - Animation - `Joey Davila`, `Georgie Leahy`, `Viv Medrano`
- `Home Sweet Homestead: Wynonna Earp Cast` - 2026-09-06T13:00 - Urban Fantasy - `Sue Kisenwether`, `Emily Andras`, `Kat Barrell`, `Tim Rozon`, `Varun Saranga`, and 1 more
- `How Did You Get So Lucky? – An Hour with Kirk Thatcher` - 2026-09-04T17:30 - Main Programming - `Mark Gagliardi`, `Hal Lublin`, `Kirk Thatcher`
- `How to Tame Your Fear Dragon with Patricia Tallman` - 2026-09-05T13:00 - Workshops - `Patricia Tallman`
- `Improvised Dungeons & Dragons – LIVE!` - 2026-09-04T19:00 - Main Programming - `Mark Meer`, `Dad's Garage Theatre Co.`, `Logan Jenkins`, `Dot R Steverson`
- `Invasion Fan Panel: Day 1, Post Invasion` - 2026-09-07T11:30 - XTrack - `Chris Moore`, `Jessica Combs`
- `James Saito - Teenage Mutant Ninja Turtles Signing` - 2026-09-06T10:00 - Vendor Workshops/Events - `James Saito`
- `James Saito - Teenage Mutant Ninja Turtles Signing` - 2026-09-07T10:00 - Vendor Workshops/Events - `James Saito`
- `James Saito - Teenage Mutant Ninja Turtles signing` - 2026-09-05T10:00 - Vendor Workshops/Events - `James Saito`
- `James Saito signing - Teenage Mutant Ninja Turtles` - 2026-09-04T10:00 - Vendor Workshops/Events - `James Saito`
- `Killbillies` - 2026-09-05T20:30 - Live Performances - Hyatt Concourse - `Killbillies`
- `Land of the Lost Cast` - 2026-09-07T11:30 - American Sci-fi Classics - `Sammi Doneff`, `Kathy Coleman`, `Wesley Eure`, `Phil Paley`
- `Land of the Lost Cast: Six Decades of a Routine Expedition` - 2026-09-04T13:00 - American Sci-fi Classics - `Primetime Steve`, `Kathy Coleman`, `Wesley Eure`, `Phil Paley`
- `Land of the Lost: Six Decades of Routine Expeditions` - 2026-09-05T11:30 - American Sci-fi Classics - `Thomas Parham`, `Kathy Coleman`, `Wesley Eure`, `Phil Paley`
- `Land of the Lost: Six Decades of Routine Expeditions` - 2026-09-06T14:30 - American Sci-fi Classics - `Marc Lee`, `Kathy Coleman`, `Wesley Eure`, `Phil Paley`
- `Last Grasp` - 2026-09-07T00:00 - Live Performances - `Last Grasp`
- `Lip Sync-a-Palooza` - 2026-09-06T20:30 - Puppetry - `Aretta Baumgartner`, `Kevin Carlson`, `Christine Papalexis`, `Raymond Carr`
- `Lips-On Voice Acting Workshop w/ Jason Marsden #2 **EXTRA FEE WORKSHOP**` - 2026-09-04T11:30 - Workshops - `Jason Marsden`
- `Lips-On Voice Acting Workshop w/ Jason Marsden **EXTRA FEE Workshop #1` - 2026-09-03T11:30 - Workshops - `Jason Marsden`
- `Long May She Reign: An Hour with Lena Headey` - 2026-09-05T14:30 - High Fantasy - `Rob Roberts`, `Lena Headey`
- `MOVED = Miss Star Trek Universe Pageant` - 2026-09-06T17:30 - Trek Track - `Garrett Wang`, `Lucy Boydston`
- `MOVED! Star Trek Actors Q&A` - 2026-09-07T10:00 - Trek Track - `Thomas Parham`, `Dominic Keating`, `Anthony Montgomery`, `Connor Trinneer`
- `Meet the Hellaverse Cast` - 2026-09-06T16:00 - Animation - `Sammi Doneff`, `Liz Callaway`, `Georgie Leahy`, `Viv Medrano`
- `Nivek Ogre Q&A` - 2026-09-05T13:00 - Horror - `Colby Smith`, `Nivek Ogre`
- `On the Case with the Cast of The Rookie` - 2026-09-06T14:30 - Main Programming - `Brian Richardson`, `Shawn Ashmore`, `Lisseth Chavez`, `Richard T Jones`, `Melissa O'Neil`
- `Once Upon a Liz Callaway` - 2026-09-05T11:30 - Animation - `Sue Kisenwether`, `Liz Callaway`
- `Patricia Tallman's Greatest Hits: From Knightriders to Night of Living Dead` - 2026-09-06T13:00 - American Sci-fi Classics - `Patricia Tallman`, `Gary Mitchel`
- `Pee Wee's Playhouse 40th Anniversary: Saturday Morning 1986` - 2026-09-05T11:30 - American Sci-fi Classics - `Kevin Eldridge`, `Molly Abigail Coffee`, `Remy Dee`, `Dave West`, `Nick Frutiger`
- `Phil Parsons and Chuck Huber Signing – Booth 2529` - 2026-09-05T10:00 - Vendor Workshops/Events - `Chuck Huber`, `Phil Parsons`
- `Phil Parsons and Chuck Huber Signing – Vendors Booth 2529` - 2026-09-07T10:00 - Vendor Workshops/Events - `Chuck Huber`, `Phil Parsons`
- `Photo Session: Aaron Ashmore` - 2026-09-05T16:00 - Epic Photos - `Aaron Ashmore`
- `Photo Session: Aaron Ashmore` - 2026-09-06T16:20 - Epic Photos - `Aaron Ashmore`
- `Photo Session: Aaron Douglas` - 2026-09-04T13:00 - Epic Photos - `Aaron Douglas`
- `Photo Session: Aaron Douglas` - 2026-09-05T14:20 - Epic Photos - `Aaron Douglas`
- `Photo Session: Aaron Douglas` - 2026-09-06T14:10 - Epic Photos - `Aaron Douglas`
- `Photo Session: Alan Tudyk Solo` - 2026-09-05T14:10 - Epic Photos - `Alan Tudyk`
- `Photo Session: Alan Tudyk Solo` - 2026-09-06T11:00 - Epic Photos - `Alan Tudyk`
- `Photo Session: Alex Rochon Solo` - 2026-09-04T14:20 - Epic Photos - `Alex Rochon`
- `Photo Session: Alex Rochon Solo` - 2026-09-06T15:20 - Epic Photos - `Alex Rochon`
- `Photo Session: Alice Wetterlund Solo` - 2026-09-04T17:40 - Epic Photos - `Alice Wetterlund`
- `Photo Session: Alice Wetterlund Solo` - 2026-09-05T13:30 - Epic Photos - `Alice Wetterlund`
- `Photo Session: Alice Wetterlund Solo` - 2026-09-06T11:00 - Epic Photos - `Alice Wetterlund`
- `Photo Session: Amanda Hufford Solo` - 2026-09-04T14:10 - Epic Photos - `Amanda Hufford`
- `Photo Session: Amanda Hufford Solo` - 2026-09-06T15:20 - Epic Photos - `Amanda Hufford`
- `Photo Session: Castle Group` - 2026-09-06T11:50 - Epic Photos - `Seamus Dever`, `Nathan Fillion`, `Jon Huertas`, `Molly Quinn`
- `Photo Session: Celia Rose Gooding` - 2026-09-04T11:20 - Epic Photos - `Celia Rose Gooding`
- `Photo Session: Celia Rose Gooding` - 2026-09-05T17:30 - Epic Photos - `Celia Rose Gooding`
- `Photo Session: Celia Rose Gooding` - 2026-09-06T16:00 - Epic Photos - `Celia Rose Gooding`
- `Photo Session: Hazbin Hotel` - 2026-09-06T15:00 - Epic Photos - `Michael Kovach`, `Viv Medrano`
- `Photo Session: Jess Bush` - 2026-09-04T11:20 - Epic Photos - `Jess Bush`
- `Photo Session: Jess Bush` - 2026-09-05T17:30 - Epic Photos - `Jess Bush`
- `Photo Session: Jess Bush` - 2026-09-06T16:00 - Epic Photos - `Jess Bush`
- `Photo Session: Lower Decks - Full` - 2026-09-04T13:10 - Epic Photos - `Eugene Cordero`, `Dawnn Lewis`, `Tawny Newsome`, `Jack Quaid`, `Noël Wells`
- `Photo Session: Lower Decks - Full` - 2026-09-05T11:50 - Epic Photos - `Eugene Cordero`, `Dawnn Lewis`, `Tawny Newsome`, `Jack Quaid`, `Noël Wells`
- `Photo Session: Lower Decks - Full` - 2026-09-06T13:20 - Epic Photos - `Eugene Cordero`, `Dawnn Lewis`, `Tawny Newsome`, `Jack Quaid`, `Noël Wells`
- `Photo Session: Photo Session: Claudia Black` - 2026-09-04T13:40 - Epic Photos - `Claudia Black`
- `Photo Session: Photo Session: Claudia Black` - 2026-09-05T16:30 - Epic Photos - `Claudia Black`
- `Photo Session: Photo Session: Claudia Black` - 2026-09-06T16:00 - Epic Photos - `Claudia Black`
- `Photo Session: Photo Session: Smallville` - 2026-09-05T15:50 - Epic Photos - `Aaron Ashmore`, `Erica Durance`, `Cassidy Freeman`, `Tom Welling`
- `Photo Session: Photo Session: TeamUp - Brothers` - 2026-09-05T16:00 - Epic Photos - `Aaron Ashmore`, `Shawn Ashmore`
- `Photo Session: Photo Session: TeamUp - Brothers` - 2026-09-06T16:20 - Epic Photos - `Aaron Ashmore`, `Shawn Ashmore`
- `Photo Session: Photo session: Amelia Tyler Solo` - 2026-09-04T17:20 - Epic Photos - `Amelia Tyler`
- `Photo Session: Photo session: Amelia Tyler Solo` - 2026-09-05T11:30 - Epic Photos - `Amelia Tyler`
- `Photo Session: Photo session: Amelia Tyler Solo` - 2026-09-06T15:50 - Epic Photos - `Amelia Tyler`
- `Photo Session: Photo session: Anson Mount Solo` - 2026-09-04T14:20 - Epic Photos - `Anson Mount`
- `Photo Session: Photo session: Anson Mount Solo` - 2026-09-05T12:00 - Epic Photos - `Anson Mount`
- `Photo Session: Photo session: Anson Mount Solo` - 2026-09-06T14:20 - Epic Photos - `Anson Mount`
- `Photo Session: Photo session: Anthony Montgomery Solo` - 2026-09-04T16:10 - Epic Photos - `Anthony Montgomery`
- `Photo Session: Photo session: Anthony Montgomery Solo` - 2026-09-05T12:20 - Epic Photos - `Anthony Montgomery`
- `Photo Session: Photo session: Anthony Montgomery Solo` - 2026-09-06T12:40 - Epic Photos - `Anthony Montgomery`
- `Photo Session: Photo session: Ashley Barrett Solo` - 2026-09-04T17:00 - Epic Photos - `Ashley Barrett`
- `Photo Session: Photo session: Ashley Barrett Solo` - 2026-09-05T11:20 - Epic Photos - `Ashley Barrett`
- `Photo Session: Photo session: Ashley Barrett Solo` - 2026-09-06T15:40 - Epic Photos - `Ashley Barrett`
- `Photo Session: Photo session: Babylon 5` - 2026-09-04T13:30 - Epic Photos - `Bruce Boxleitner`, `Julie Caitlin Brown`, `Patricia Tallman`
- `Photo Session: Photo session: Babylon 5` - 2026-09-05T17:10 - Epic Photos - `Bruce Boxleitner`, `Julie Caitlin Brown`, `Patricia Tallman`
- `Photo Session: Photo session: Babylon 5` - 2026-09-06T15:10 - Epic Photos - `Bruce Boxleitner`, `Julie Caitlin Brown`, `Patricia Tallman`
- `Photo Session: Photo session: Battlestar Galactica` - 2026-09-05T15:30 - Epic Photos - `James Callis`, `Tricia Helfer`, `Mary McDonnell`, `Edward James Olmos`, `Grace Park`, and 1 more
- `Photo Session: Photo session: Battlestar Galactica` - 2026-09-06T14:10 - Epic Photos - `James Callis`, `Tricia Helfer`, `Mary McDonnell`, `Edward James Olmos`, `Grace Park`, and 1 more
- `Photo Session: Photo session: Becca Q Co Solo` - 2026-09-04T17:00 - Epic Photos - `Becca Q. Co`
- `Photo Session: Photo session: Becca Q Co Solo` - 2026-09-05T11:20 - Epic Photos - `Becca Q. Co`
- `Photo Session: Photo session: Becca Q Co Solo` - 2026-09-06T15:40 - Epic Photos - `Becca Q. Co`
- `Photo Session: Photo session: Ben Browder Solo` - 2026-09-04T11:30 - Epic Photos - `Ben Browder`
- `Photo Session: Photo session: Ben Browder Solo` - 2026-09-05T12:40 - Epic Photos - `Ben Browder`
- `Photo Session: Photo session: Ben Browder Solo` - 2026-09-06T11:40 - Epic Photos - `Ben Browder`
- `Photo Session: Photo session: Bruce Boxleitner Solo` - 2026-09-04T13:30 - Epic Photos - `Bruce Boxleitner`
- `Photo Session: Photo session: Bruce Boxleitner Solo` - 2026-09-05T17:10 - Epic Photos - `Bruce Boxleitner`
- `Photo Session: Photo session: Bruce Boxleitner Solo` - 2026-09-06T15:20 - Epic Photos - `Bruce Boxleitner`
- `Photo Session: Photo session: Casper Van Dien Solo` - 2026-09-04T12:10 - Epic Photos - `Casper Van Dien`
- `Photo Session: Photo session: Casper Van Dien Solo` - 2026-09-05T17:00 - Epic Photos - `Casper Van Dien`
- `Photo Session: Photo session: Casper Van Dien Solo` - 2026-09-06T13:40 - Epic Photos - `Casper Van Dien`
- `Photo Session: Photo session: Cassidy Freeman Solo` - 2026-09-04T17:50 - Epic Photos - `Cassidy Freeman`
- `Photo Session: Photo session: Cassidy Freeman Solo` - 2026-09-05T15:40 - Epic Photos - `Cassidy Freeman`
- `Photo Session: Photo session: Cassidy Freeman Solo` - 2026-09-06T14:30 - Epic Photos - `Cassidy Freeman`
- `Photo Session: Photo session: Castle Duo` - 2026-09-04T16:00 - Epic Photos - `Seamus Dever`, `Jon Huertas`
- `Photo Session: Photo session: Castle Duo` - 2026-09-05T13:00 - Epic Photos - `Seamus Dever`, `Jon Huertas`
- `Photo Session: Photo session: Castle Duo` - 2026-09-06T12:00 - Epic Photos - `Seamus Dever`, `Jon Huertas`
- `Photo Session: Photo session: Castle Group` - 2026-09-05T12:50 - Epic Photos - `Seamus Dever`, `Nathan Fillion`, `Jon Huertas`, `Molly Quinn`
- `Photo Session: Photo session: Connor Trinneer Solo` - 2026-09-04T16:10 - Epic Photos - `Connor Trinneer`
- `Photo Session: Photo session: Connor Trinneer Solo` - 2026-09-05T12:20 - Epic Photos - `Connor Trinneer`
- `Photo Session: Photo session: Connor Trinneer Solo` - 2026-09-06T12:40 - Epic Photos - `Connor Trinneer`
- `Photo Session: Photo session: Courtney Eaton Solo` - 2026-09-04T15:30 - Epic Photos - `Courtney Eaton`
- `Photo Session: Photo session: Courtney Eaton Solo` - 2026-09-05T12:10 - Epic Photos - `Courtney Eaton`
- `Photo Session: Photo session: Courtney Eaton Solo` - 2026-09-06T15:00 - Epic Photos - `Courtney Eaton`
- `Photo Session: Photo session: Cylons` - 2026-09-04T14:00 - Epic Photos - `Tricia Helfer`, `Grace Park`
- `Photo Session: Photo session: Cylons` - 2026-09-05T15:00 - Epic Photos - `Tricia Helfer`, `Grace Park`
- `Photo Session: Photo session: Cylons` - 2026-09-06T13:20 - Epic Photos - `Tricia Helfer`, `Grace Park`
- `Photo Session: Photo session: Dawnn Lewis Solo` - 2026-09-04T13:00 - Epic Photos - `Dawnn Lewis`
- `Photo Session: Photo session: Dawnn Lewis Solo` - 2026-09-05T11:40 - Epic Photos - `Dawnn Lewis`
- `Photo Session: Photo session: Dawnn Lewis Solo` - 2026-09-06T13:30 - Epic Photos - `Dawnn Lewis`
- `Photo Session: Photo session: Denise Richards Solo` - 2026-09-04T11:50 - Epic Photos - `Denise Richards`
- `Photo Session: Photo session: Denise Richards Solo` - 2026-09-05T16:40 - Epic Photos - `Denise Richards`
- `Photo Session: Photo session: Denise Richards Solo` - 2026-09-06T13:40 - Epic Photos - `Denise Richards`
- `Photo Session: Photo session: Dina Meyer Solo` - 2026-09-04T12:10 - Epic Photos - `Dina Meyer`
- `Photo Session: Photo session: Dina Meyer Solo` - 2026-09-05T17:00 - Epic Photos - `Dina Meyer`
- `Photo Session: Photo session: Dina Meyer Solo` - 2026-09-06T13:40 - Epic Photos - `Dina Meyer`
- `Photo Session: Photo session: Dominic Keating Solo` - 2026-09-04T16:00 - Epic Photos - `Dominic Keating`
- `Photo Session: Photo session: Dominic Keating Solo` - 2026-09-05T12:30 - Epic Photos - `Dominic Keating`
- `Photo Session: Photo session: Dominic Keating Solo` - 2026-09-06T12:50 - Epic Photos - `Dominic Keating`
- `Photo Session: Photo session: Edward James Olmos Solo` - 2026-09-04T14:40 - Epic Photos - `Edward James Olmos`
- `Photo Session: Photo session: Edward James Olmos Solo` - 2026-09-05T15:20 - Epic Photos - `Edward James Olmos`
- `Photo Session: Photo session: Edward James Olmos Solo` - 2026-09-06T13:30 - Epic Photos - `Edward James Olmos`
- `Photo Session: Photo session: Emily Andras Solo` - 2026-09-04T11:40 - Epic Photos - `Emily Andras`
- `Photo Session: Photo session: Emily Andras Solo` - 2026-09-05T16:20 - Epic Photos - `Emily Andras`
- `Photo Session: Photo session: Emily Andras Solo` - 2026-09-06T14:50 - Epic Photos - `Emily Andras`
- `Photo Session: Photo session: Enterprise Duo` - 2026-09-04T16:10 - Epic Photos - `Anthony Montgomery`, `Connor Trinneer`
- `Photo Session: Photo session: Enterprise Duo` - 2026-09-05T12:20 - Epic Photos - `Anthony Montgomery`, `Connor Trinneer`
- `Photo Session: Photo session: Enterprise Duo` - 2026-09-06T12:40 - Epic Photos - `Anthony Montgomery`, `Connor Trinneer`
- `Photo Session: Photo session: Enterprise Group` - 2026-09-04T16:00 - Epic Photos - `Dominic Keating`, `Anthony Montgomery`, `Connor Trinneer`
- `Photo Session: Photo session: Enterprise Group` - 2026-09-05T12:30 - Epic Photos - `Dominic Keating`, `Anthony Montgomery`, `Connor Trinneer`
- `Photo Session: Photo session: Enterprise Group` - 2026-09-06T12:50 - Epic Photos - `Dominic Keating`, `Anthony Montgomery`, `Connor Trinneer`
- `Photo Session: Photo session: Erica Durance Solo` - 2026-09-04T17:30 - Epic Photos - `Erica Durance`
- `Photo Session: Photo session: Erica Durance Solo` - 2026-09-05T15:40 - Epic Photos - `Erica Durance`
- `Photo Session: Photo session: Erica Durance Solo` - 2026-09-06T14:30 - Epic Photos - `Erica Durance`
- `Photo Session: Photo session: Erin Gray Solo` - 2026-09-04T16:30 - Epic Photos - `Erin Gray`
- `Photo Session: Photo session: Erin Gray Solo` - 2026-09-05T11:50 - Epic Photos - `Erin Gray`
- `Photo Session: Photo session: Erin Gray Solo` - 2026-09-06T12:30 - Epic Photos - `Erin Gray`
- `Photo Session: Photo session: Erin Yvette Solo` - 2026-09-04T17:20 - Epic Photos - `Erin Yvette`
- `Photo Session: Photo session: Erin Yvette Solo` - 2026-09-05T11:30 - Epic Photos - `Erin Yvette`
- `Photo Session: Photo session: Erin Yvette Solo` - 2026-09-06T15:50 - Epic Photos - `Erin Yvette`
- `Photo Session: Photo session: Eugene Cordero Solo` - 2026-09-04T13:20 - Epic Photos - `Eugene Cordero`
- `Photo Session: Photo session: Eugene Cordero Solo` - 2026-09-05T11:50 - Epic Photos - `Eugene Cordero`
- `Photo Session: Photo session: Eugene Cordero Solo` - 2026-09-06T13:10 - Epic Photos - `Eugene Cordero`
- `Photo Session: Photo session: Evie Templeton Solo` - 2026-09-05T14:50 - Epic Photos - `Evie Templeton`
- `Photo Session: Photo session: Firefly` - 2026-09-05T13:00 - Epic Photos - `Nathan Fillion`, `Summer Glau`, `Jewel Staite`, `Gina Torres`, `Alan Tudyk`
- `Photo Session: Photo session: Firefly` - 2026-09-05T13:10 - Epic Photos - `Nathan Fillion`, `Summer Glau`, `Jewel Staite`, `Gina Torres`, `Alan Tudyk`
- `Photo Session: Photo session: Firefly` - 2026-09-06T11:30 - Epic Photos - `Nathan Fillion`, `Jewel Staite`, `Gina Torres`, `Alan Tudyk`
- `Photo Session: Photo session: Firefly Duo` - 2026-09-05T13:50 - Epic Photos - `Gina Torres`, `Alan Tudyk`
- `Photo Session: Photo session: Firefly Duo` - 2026-09-06T11:20 - Epic Photos - `Gina Torres`, `Alan Tudyk`
- `Photo Session: Photo session: Garrett Wang Solo` - 2026-09-05T14:40 - Epic Photos - `Garrett Wang`
- `Photo Session: Photo session: Gina Torres Solo` - 2026-09-05T13:40 - Epic Photos - `Gina Torres`
- `Photo Session: Photo session: Gina Torres Solo` - 2026-09-06T11:20 - Epic Photos - `Gina Torres`
- `Photo Session: Photo session: Grace Park Solo` - 2026-09-04T14:00 - Epic Photos - `Grace Park`
- `Photo Session: Photo session: Grace Park Solo` - 2026-09-05T15:00 - Epic Photos - `Grace Park`
- `Photo Session: Photo session: Grace Park Solo` - 2026-09-06T13:20 - Epic Photos - `Grace Park`
- `Photo Session: Photo session: Hades II` - 2026-09-04T17:10 - Epic Photos - `Ashley Barrett`, `Becca Q. Co`, `Judy Alice Lee`, `Jason Marnocha`, `Amelia Tyler`, and 1 more
- `Photo Session: Photo session: Hades II` - 2026-09-05T11:30 - Epic Photos - `Ashley Barrett`, `Becca Q. Co`, `Judy Alice Lee`, `Jason Marnocha`, `Amelia Tyler`, and 1 more
- `Photo Session: Photo session: Hades II` - 2026-09-06T15:40 - Epic Photos - `Ashley Barrett`, `Becca Q. Co`, `Judy Alice Lee`, `Jason Marnocha`, `Amelia Tyler`, and 1 more
- `Photo Session: Photo session: Hazbin Hotel` - 2026-09-05T17:20 - Epic Photos - `Michael Kovach`, `Viv Medrano`
- `Photo Session: Photo session: Isaac Ordonez Solo` - 2026-09-05T14:50 - Epic Photos - `Isaac Ordonez`
- `Photo Session: Photo session: Jake Busey Solo` - 2026-09-04T12:10 - Epic Photos - `Jake Busey`
- `Photo Session: Photo session: Jake Busey Solo` - 2026-09-05T17:00 - Epic Photos - `Jake Busey`
- `Photo Session: Photo session: Jake Busey Solo` - 2026-09-06T13:50 - Epic Photos - `Jake Busey`
- `Photo Session: Photo session: James Callis Solo` - 2026-09-04T13:50 - Epic Photos - `James Callis`
- `Photo Session: Photo session: James Callis Solo` - 2026-09-05T15:20 - Epic Photos - `James Callis`
- `Photo Session: Photo session: James Callis Solo` - 2026-09-06T13:30 - Epic Photos - `James Callis`
- `Photo Session: Photo session: Jason Marnocha Solo` - 2026-09-04T17:20 - Epic Photos - `Jason Marnocha`
- `Photo Session: Photo session: Jason Marnocha Solo` - 2026-09-05T11:20 - Epic Photos - `Jason Marnocha`
- `Photo Session: Photo session: Jason Marnocha Solo` - 2026-09-06T15:50 - Epic Photos - `Jason Marnocha`
- `Photo Session: Photo session: Javier Prusky Solo` - 2026-09-04T16:40 - Epic Photos - `Javier Prusky`
- `Photo Session: Photo session: Javier Prusky Solo` - 2026-09-05T15:00 - Epic Photos - `Javier Prusky`
- `Photo Session: Photo session: Javier Prusky Solo` - 2026-09-06T12:50 - Epic Photos - `Javier Prusky`
- `Photo Session: Photo session: Jewel Staite Solo` - 2026-09-04T11:30 - Epic Photos - `Jewel Staite`
- `Photo Session: Photo session: Jewel Staite Solo` - 2026-09-05T12:50 - Epic Photos - `Jewel Staite`
- `Photo Session: Photo session: Jewel Staite Solo` - 2026-09-06T11:40 - Epic Photos - `Jewel Staite`
- `Photo Session: Photo session: Jon Huertas Solo` - 2026-09-04T16:00 - Epic Photos - `Jon Huertas`
- `Photo Session: Photo session: Jon Huertas Solo` - 2026-09-05T13:00 - Epic Photos - `Jon Huertas`
- `Photo Session: Photo session: Jon Huertas Solo` - 2026-09-06T12:00 - Epic Photos - `Jon Huertas`
- `Photo Session: Photo session: Judy Alice Lee Solo` - 2026-09-04T17:10 - Epic Photos - `Judy Alice Lee`
- `Photo Session: Photo session: Judy Alice Lee Solo` - 2026-09-05T11:20 - Epic Photos - `Judy Alice Lee`
- `Photo Session: Photo session: Judy Alice Lee Solo` - 2026-09-06T15:50 - Epic Photos - `Judy Alice Lee`
- `Photo Session: Photo session: Julie Caitlin Brown Solo` - 2026-09-04T13:40 - Epic Photos - `Julie Caitlin Brown`
- `Photo Session: Photo session: Julie Caitlin Brown Solo` - 2026-09-05T17:20 - Epic Photos - `Julie Caitlin Brown`
- `Photo Session: Photo session: Julie Caitlin Brown Solo` - 2026-09-06T15:10 - Epic Photos - `Julie Caitlin Brown`
- `Photo Session: Photo session: Katee Sackhoff Solo` - 2026-09-05T15:20 - Epic Photos - `Katee Sackhoff`
- `Photo Session: Photo session: Katee Sackhoff Solo` - 2026-09-06T14:00 - Epic Photos - `Katee Sackhoff`
- `Photo Session: Photo session: Katherine Barrell Solo` - 2026-09-04T11:30 - Epic Photos - `Kat Barrell`
- `Photo Session: Photo session: Katherine Barrell Solo` - 2026-09-05T16:10 - Epic Photos - `Kat Barrell`
- `Photo Session: Photo session: Katherine Barrell Solo` - 2026-09-06T14:30 - Epic Photos - `Kat Barrell`
- `Photo Session: Photo session: Kathy Coleman Solo` - 2026-09-04T15:50 - Epic Photos - `Kathy Coleman`
- `Photo Session: Photo session: Kathy Coleman Solo` - 2026-09-05T13:20 - Epic Photos - `Kathy Coleman`
- `Photo Session: Photo session: Kathy Coleman Solo` - 2026-09-06T16:10 - Epic Photos - `Kathy Coleman`
- `Photo Session: Photo session: Land of the Lost` - 2026-09-04T15:40 - Epic Photos - `Kathy Coleman`, `Wesley Eure`, `Phil Paley`
- `Photo Session: Photo session: Land of the Lost` - 2026-09-05T13:20 - Epic Photos - `Kathy Coleman`, `Wesley Eure`, `Phil Paley`
- `Photo Session: Photo session: Land of the Lost` - 2026-09-06T16:00 - Epic Photos - `Kathy Coleman`, `Wesley Eure`, `Phil Paley`
- `Photo Session: Photo session: Lena Headey Solo` - 2026-09-05T16:10 - Epic Photos - `Lena Headey`
- `Photo Session: Photo session: Lena Headey Solo` - 2026-09-05T16:20 - Epic Photos - `Lena Headey`
- `Photo Session: Photo session: Lena Headey Solo` - 2026-09-06T13:00 - Epic Photos - `Lena Headey`
- `Photo Session: Photo session: Levi Fiehler Solo` - 2026-09-04T15:20 - Epic Photos - `Levi Fiehler`
- `Photo Session: Photo session: Levi Fiehler Solo` - 2026-09-05T14:10 - Epic Photos - `Levi Fiehler`
- `Photo Session: Photo session: Levi Fiehler Solo` - 2026-09-06T13:00 - Epic Photos - `Levi Fiehler`
- `Photo Session: Photo session: Lisseth Chavez Solo` - 2026-09-05T12:30 - Epic Photos - `Lisseth Chavez`
- `Photo Session: Photo session: Lisseth Chavez Solo` - 2026-09-06T12:10 - Epic Photos - `Lisseth Chavez`
- `Photo Session: Photo session: Liz Callaway Solo` - 2026-09-04T15:10 - Epic Photos - `Liz Callaway`
- `Photo Session: Photo session: Liz Callaway Solo` - 2026-09-05T11:10 - Epic Photos - `Liz Callaway`
- `Photo Session: Photo session: Liz Callaway Solo` - 2026-09-06T13:50 - Epic Photos - `Liz Callaway`
- `Photo Session: Photo session: Longmire` - 2026-09-05T15:40 - Epic Photos - `Cassidy Freeman`, `Katee Sackhoff`
- `Photo Session: Photo session: Longmire` - 2026-09-06T14:20 - Epic Photos - `Cassidy Freeman`, `Katee Sackhoff`
- `Photo Session: Photo session: Lower Decks - Duo 1` - 2026-09-04T13:20 - Epic Photos - `Eugene Cordero`, `Noël Wells`
- `Photo Session: Photo session: Lower Decks - Duo 1` - 2026-09-05T11:50 - Epic Photos - `Eugene Cordero`, `Noël Wells`
- `Photo Session: Photo session: Lower Decks - Duo 1` - 2026-09-06T13:10 - Epic Photos - `Eugene Cordero`, `Noël Wells`
- `Photo Session: Photo session: Lower Decks - Duo 2` - 2026-09-04T13:00 - Epic Photos - `Dawnn Lewis`, `Tawny Newsome`
- `Photo Session: Photo session: Lower Decks - Duo 2` - 2026-09-05T11:40 - Epic Photos - `Dawnn Lewis`, `Tawny Newsome`
- `Photo Session: Photo session: Lower Decks - Duo 2` - 2026-09-06T13:30 - Epic Photos - `Dawnn Lewis`, `Tawny Newsome`
- `Photo Session: Photo session: Lower Decks - Duo 3` - 2026-09-04T13:10 - Epic Photos - `Eugene Cordero`, `Tawny Newsome`
- `Photo Session: Photo session: Lower Decks - Duo 3` - 2026-09-05T11:40 - Epic Photos - `Eugene Cordero`, `Tawny Newsome`
- `Photo Session: Photo session: Lower Decks - Duo 3` - 2026-09-06T13:10 - Epic Photos - `Eugene Cordero`, `Tawny Newsome`
- `Photo Session: Photo session: Marissa Lenti Solo` - 2026-09-04T14:40 - Epic Photos - `Marissa Lenti`
- `Photo Session: Photo session: Marissa Lenti Solo` - 2026-09-06T15:10 - Epic Photos - `Marissa Lenti`
- `Photo Session: Photo session: Mary McDonnell Solo` - 2026-09-04T14:10 - Epic Photos - `Mary McDonnell`
- `Photo Session: Photo session: Mary McDonnell Solo` - 2026-09-05T15:10 - Epic Photos - `Mary McDonnell`
- `Photo Session: Photo session: Mary McDonnell Solo` - 2026-09-06T13:50 - Epic Photos - `Mary McDonnell`
- `Photo Session: Photo session: Melanie Scrofano Solo` - 2026-09-04T11:30 - Epic Photos - `Melanie Scrofano`
- `Photo Session: Photo session: Melanie Scrofano Solo` - 2026-09-05T16:20 - Epic Photos - `Melanie Scrofano`
- `Photo Session: Photo session: Melanie Scrofano Solo` - 2026-09-06T14:30 - Epic Photos - `Melanie Scrofano`
- `Photo Session: Photo session: Meredith Garretson Solo` - 2026-09-04T15:20 - Epic Photos - `Meredith Garretson`
- `Photo Session: Photo session: Meredith Garretson Solo` - 2026-09-05T14:10 - Epic Photos - `Meredith Garretson`
- `Photo Session: Photo session: Meredith Garretson Solo` - 2026-09-06T13:00 - Epic Photos - `Meredith Garretson`
- `Photo Session: Photo session: Michael Ironside Solo` - 2026-09-04T12:10 - Epic Photos - `Michael Ironside`
- `Photo Session: Photo session: Michael Ironside Solo` - 2026-09-05T16:40 - Epic Photos - `Michael Ironside`
- `Photo Session: Photo session: Michael Ironside Solo` - 2026-09-06T13:40 - Epic Photos - `Michael Ironside`
- `Photo Session: Photo session: Michael Kovach Solo` - 2026-09-04T14:50 - Epic Photos - `Michael Kovach`
- `Photo Session: Photo session: Michael Kovach Solo` - 2026-09-05T17:20 - Epic Photos - `Michael Kovach`
- `Photo Session: Photo session: Michael Kovach Solo` - 2026-09-06T15:10 - Epic Photos - `Michael Kovach`
- `Photo Session: Photo session: Michael Shanks Solo` - 2026-09-04T11:10 - Epic Photos - `Michael Shanks`
- `Photo Session: Photo session: Michael Shanks Solo` - 2026-09-05T12:50 - Epic Photos - `Michael Shanks`
- `Photo Session: Photo session: Michael Shanks Solo` - 2026-09-06T12:20 - Epic Photos - `Michael Shanks`
- `Photo Session: Photo session: Molly Quinn Solo` - 2026-09-04T16:30 - Epic Photos - `Molly Quinn`
- `Photo Session: Photo session: Molly Quinn Solo` - 2026-09-05T13:00 - Epic Photos - `Molly Quinn`
- `Photo Session: Photo session: Molly Quinn Solo` - 2026-09-06T12:00 - Epic Photos - `Molly Quinn`
- `Photo Session: Photo session: Nivek Ogre Solo` - 2026-09-04T15:20 - Epic Photos - `Nivek Ogre`
- `Photo Session: Photo session: Nivek Ogre Solo` - 2026-09-05T11:40 - Epic Photos - `Nivek Ogre`
- `Photo Session: Photo session: Noel Wells Solo` - 2026-09-04T13:20 - Epic Photos - `Noël Wells`
- `Photo Session: Photo session: Noel Wells Solo` - 2026-09-05T11:50 - Epic Photos - `Noël Wells`
- `Photo Session: Photo session: Noel Wells Solo` - 2026-09-06T13:20 - Epic Photos - `Noël Wells`
- `Photo Session: Photo session: Once We Were Spacemen and Superman` - 2026-09-05T13:30 - Epic Photos - `Nathan Fillion`, `Alan Tudyk`
- `Photo Session: Photo session: Once We Were Spacemen and Superman` - 2026-09-05T13:40 - Epic Photos - `Nathan Fillion`, `Alan Tudyk`
- `Photo Session: Photo session: Once We Were Spacemen and Superman` - 2026-09-06T11:40 - Epic Photos - `Nathan Fillion`, `Alan Tudyk`
- `Photo Session: Photo session: Patricia Tallman Solo` - 2026-09-04T13:40 - Epic Photos - `Patricia Tallman`
- `Photo Session: Photo session: Patricia Tallman Solo` - 2026-09-05T17:20 - Epic Photos - `Patricia Tallman`
- `Photo Session: Photo session: Patricia Tallman Solo` - 2026-09-06T15:20 - Epic Photos - `Patricia Tallman`
- `Photo Session: Photo session: Peter Bramhill Solo` - 2026-09-04T16:50 - Epic Photos - `Peter Bramhill`
- `Photo Session: Photo session: Peter Bramhill Solo` - 2026-09-05T15:30 - Epic Photos - `Peter Bramhill`
- `Photo Session: Photo session: Peter Bramhill Solo` - 2026-09-06T12:40 - Epic Photos - `Peter Bramhill`
- `Photo Session: Photo session: Phillip Paley Solo` - 2026-09-04T15:40 - Epic Photos - `Phil Paley`
- `Photo Session: Photo session: Phillip Paley Solo` - 2026-09-05T13:10 - Epic Photos - `Phil Paley`
- `Photo Session: Photo session: Phillip Paley Solo` - 2026-09-06T16:00 - Epic Photos - `Phil Paley`
- `Photo Session: Photo session: Resident Alien` - 2026-09-05T13:20 - Epic Photos - `Levi Fiehler`, `Meredith Garretson`, `Jewel Staite`, `Sara Tomko`, `Alan Tudyk`, and 1 more
- `Photo Session: Photo session: Resident Alien` - 2026-09-06T11:10 - Epic Photos - `Levi Fiehler`, `Meredith Garretson`, `Jewel Staite`, `Sara Tomko`, `Alan Tudyk`, and 1 more
- `Photo Session: Photo session: Resident Alien Couple` - 2026-09-04T15:20 - Epic Photos - `Levi Fiehler`, `Meredith Garretson`
- `Photo Session: Photo session: Resident Alien Couple` - 2026-09-05T14:10 - Epic Photos - `Levi Fiehler`, `Meredith Garretson`
- `Photo Session: Photo session: Resident Alien Couple` - 2026-09-06T13:00 - Epic Photos - `Levi Fiehler`, `Meredith Garretson`
- `Photo Session: Photo session: Resident Alien Duo` - 2026-09-04T17:40 - Epic Photos - `Sara Tomko`, `Alice Wetterlund`
- `Photo Session: Photo session: Resident Alien Duo` - 2026-09-05T13:30 - Epic Photos - `Sara Tomko`, `Alice Wetterlund`
- `Photo Session: Photo session: Resident Alien Duo` - 2026-09-06T11:00 - Epic Photos - `Sara Tomko`, `Alice Wetterlund`
- `Photo Session: Photo session: Richard Dean Anderson Solo` - 2026-09-04T11:00 - Epic Photos - `Richard Dean Anderson`
- `Photo Session: Photo session: Richard Dean Anderson Solo` - 2026-09-04T11:10 - Epic Photos - `Richard Dean Anderson`
- `Photo Session: Photo session: Richard Dean Anderson Solo` - 2026-09-05T12:20 - Epic Photos - `Richard Dean Anderson`
- `Photo Session: Photo session: Richard Dean Anderson Solo` - 2026-09-06T11:50 - Epic Photos - `Richard Dean Anderson`
- `Photo Session: Photo session: Ross Marquand Solo` - 2026-09-04T16:10 - Epic Photos - `Ross Marquand`
- `Photo Session: Photo session: Ross Marquand Solo` - 2026-09-05T12:00 - Epic Photos - `Ross Marquand`
- `Photo Session: Photo session: Ross Marquand Solo` - 2026-09-05T15:50 - Epic Photos - `Ross Marquand`
- `Photo Session: Photo session: Sara Tomko Solo` - 2026-09-04T17:40 - Epic Photos - `Sara Tomko`
- `Photo Session: Photo session: Sara Tomko Solo` - 2026-09-05T13:30 - Epic Photos - `Sara Tomko`
- `Photo Session: Photo session: Sara Tomko Solo` - 2026-09-06T11:00 - Epic Photos - `Sara Tomko`
- `Photo Session: Photo session: Sarah Connor Chronicles Duo` - 2026-09-05T16:30 - Epic Photos - `Summer Glau`, `Lena Headey`
- `Photo Session: Photo session: Sarah Connor Chronicles Duo` - 2026-09-06T13:10 - Epic Photos - `Summer Glau`, `Lena Headey`
- `Photo Session: Photo session: Seamus Dever Solo` - 2026-09-04T16:00 - Epic Photos - `Seamus Dever`
- `Photo Session: Photo session: Seamus Dever Solo` - 2026-09-05T13:00 - Epic Photos - `Seamus Dever`
- `Photo Session: Photo session: Seamus Dever Solo` - 2026-09-06T12:10 - Epic Photos - `Seamus Dever`
- `Photo Session: Photo session: Sean Astin Solo` - 2026-09-04T12:30 - Epic Photos - `Sean Astin`
- `Photo Session: Photo session: Sean Astin Solo` - 2026-09-05T16:40 - Epic Photos - `Sean Astin`
- `Photo Session: Photo session: Sean Astin Solo` - 2026-09-06T12:30 - Epic Photos - `Sean Astin`
- `Photo Session: Photo session: Sena Bryer Solo` - 2026-09-04T17:10 - Epic Photos - `Sena Bryer`
- `Photo Session: Photo session: Sena Bryer Solo` - 2026-09-05T16:50 - Epic Photos - `Sena Bryer`
- `Photo Session: Photo session: Sena Bryer Solo` - 2026-09-06T15:40 - Epic Photos - `Sena Bryer`
- `Photo Session: Photo session: Skye Redden Solo` - 2026-09-04T14:40 - Epic Photos - `Skye Redden`
- `Photo Session: Photo session: Skye Redden Solo` - 2026-09-05T17:30 - Epic Photos - `Skye Redden`
- `Photo Session: Photo session: Skye Redden Solo` - 2026-09-06T15:20 - Epic Photos - `Skye Redden`
- `Photo Session: Photo session: Smallville` - 2026-09-06T14:40 - Epic Photos - `Aaron Ashmore`, `Erica Durance`, `Cassidy Freeman`, `Tom Welling`
- `Photo Session: Photo session: Stargate - SG1` - 2026-09-04T11:20 - Epic Photos - `Richard Dean Anderson`, `Claudia Black`, `Ben Browder`, `Teryl Rothery`, `Michael Shanks`, and 1 more
- `Photo Session: Photo session: Stargate - SG1` - 2026-09-05T12:40 - Epic Photos - `Richard Dean Anderson`, `Claudia Black`, `Ben Browder`, `Teryl Rothery`, `Michael Shanks`, and 1 more
- `Photo Session: Photo session: Stargate - SG1` - 2026-09-06T11:50 - Epic Photos - `Richard Dean Anderson`, `Claudia Black`, `Ben Browder`, `Teryl Rothery`, `Michael Shanks`, and 1 more
- `Photo Session: Photo session: Starship Troopers` - 2026-09-04T12:00 - Epic Photos - `Jake Busey`, `Michael Ironside`, `Dina Meyer`, `Denise Richards`, `Casper Van Dien`
- `Photo Session: Photo session: Starship Troopers` - 2026-09-05T16:50 - Epic Photos - `Jake Busey`, `Michael Ironside`, `Dina Meyer`, `Denise Richards`, `Casper Van Dien`
- `Photo Session: Photo session: Starship Troopers` - 2026-09-06T13:50 - Epic Photos - `Jake Busey`, `Michael Ironside`, `Dina Meyer`, `Denise Richards`, `Casper Van Dien`
- `Photo Session: Photo session: Summer Glau` - 2026-09-04T17:30 - Epic Photos - `Summer Glau`
- `Photo Session: Photo session: Summer Glau` - 2026-09-05T16:30 - Epic Photos - `Summer Glau`
- `Photo Session: Photo session: Summer Glau` - 2026-09-06T13:10 - Epic Photos - `Summer Glau`
- `Photo Session: Photo session: Tawny Newsome Solo` - 2026-09-04T13:00 - Epic Photos - `Tawny Newsome`
- `Photo Session: Photo session: Tawny Newsome Solo` - 2026-09-05T11:40 - Epic Photos - `Tawny Newsome`
- `Photo Session: Photo session: Tawny Newsome Solo` - 2026-09-06T13:30 - Epic Photos - `Tawny Newsome`
- `Photo Session: Photo session: Teryl Rothery Solo` - 2026-09-04T11:10 - Epic Photos - `Teryl Rothery`
- `Photo Session: Photo session: Teryl Rothery Solo` - 2026-09-05T12:50 - Epic Photos - `Teryl Rothery`
- `Photo Session: Photo session: Teryl Rothery Solo` - 2026-09-06T11:40 - Epic Photos - `Teryl Rothery`
- `Photo Session: Photo session: The Amazing Digital Circus` - 2026-09-04T14:50 - Epic Photos - `Amanda Hufford`, `Michael Kovach`, `Marissa Lenti`, `Skye Redden`, `Alex Rochon`
- `Photo Session: Photo session: The Amazing Digital Circus` - 2026-09-05T17:30 - Epic Photos - `Amanda Hufford`, `Michael Kovach`, `Marissa Lenti`, `Skye Redden`, `Alex Rochon`
- `Photo Session: Photo session: The Amazing Digital Circus` - 2026-09-06T15:10 - Epic Photos - `Amanda Hufford`, `Michael Kovach`, `Marissa Lenti`, `Skye Redden`, `Alex Rochon`
- `Photo Session: Photo session: The Rookie` - 2026-09-05T12:40 - Epic Photos - `Lisseth Chavez`, `Nathan Fillion`, `Richard T Jones`, `Melissa O'Neil`
- `Photo Session: Photo session: The Rookie` - 2026-09-06T12:00 - Epic Photos - `Lisseth Chavez`, `Nathan Fillion`, `Richard T Jones`, `Melissa O'Neil`
- `Photo Session: Photo session: Timothy Rozon Solo` - 2026-09-04T11:50 - Epic Photos - `Tim Rozon`
- `Photo Session: Photo session: Timothy Rozon Solo` - 2026-09-05T16:20 - Epic Photos - `Tim Rozon`
- `Photo Session: Photo session: Timothy Rozon Solo` - 2026-09-06T14:40 - Epic Photos - `Tim Rozon`
- `Photo Session: Photo session: Tom Welling Solo` - 2026-09-05T16:00 - Epic Photos - `Tom Welling`
- `Photo Session: Photo session: Tricia Helfer Solo` - 2026-09-04T14:00 - Epic Photos - `Tricia Helfer`
- `Photo Session: Photo session: Tricia Helfer Solo` - 2026-09-05T15:00 - Epic Photos - `Tricia Helfer`
- `Photo Session: Photo session: Tricia Helfer Solo` - 2026-09-06T13:20 - Epic Photos - `Tricia Helfer`
- `Photo Session: Photo session: Tucker and Dale vs Evil` - 2026-09-05T14:00 - Epic Photos - `Tyler Labine`, `Alan Tudyk`
- `Photo Session: Photo session: Tucker and Dale vs Evil` - 2026-09-06T11:20 - Epic Photos - `Tyler Labine`, `Alan Tudyk`
- `Photo Session: Photo session: Tyler Labine Solo` - 2026-09-04T16:50 - Epic Photos - `Tyler Labine`
- `Photo Session: Photo session: Tyler Labine Solo` - 2026-09-05T13:50 - Epic Photos - `Tyler Labine`
- `Photo Session: Photo session: Tyler Labine Solo` - 2026-09-06T11:10 - Epic Photos - `Tyler Labine`
- `Photo Session: Photo session: Varun Saranga Solo` - 2026-09-04T11:50 - Epic Photos - `Varun Saranga`
- `Photo Session: Photo session: Varun Saranga Solo` - 2026-09-05T16:10 - Epic Photos - `Varun Saranga`
- `Photo Session: Photo session: Varun Saranga Solo` - 2026-09-06T14:50 - Epic Photos - `Varun Saranga`
- `Photo Session: Strange New Worlds` - 2026-09-04T11:20 - Epic Photos - `Jess Bush`, `Celia Rose Gooding`, `Anson Mount`, `Melanie Scrofano`
- `Photo Session: Strange New Worlds` - 2026-09-05T17:30 - Epic Photos - `Jess Bush`, `Celia Rose Gooding`, `Anson Mount`, `Melanie Scrofano`
- `Photo Session: Strange New Worlds` - 2026-09-06T16:00 - Epic Photos - `Jess Bush`, `Celia Rose Gooding`, `Anson Mount`, `Melanie Scrofano`
- `Photo Session: Vivienne Medrano Solo` - 2026-09-05T17:20 - Epic Photos - `Viv Medrano`
- `Photo Session: Vivienne Medrano Solo` - 2026-09-06T15:00 - Epic Photos - `Viv Medrano`
- `Photo Session: Wesley Eure Solo` - 2026-09-04T15:50 - Epic Photos - `Wesley Eure`
- `Photo Session: Wesley Eure Solo` - 2026-09-05T13:20 - Epic Photos - `Wesley Eure`
- `Photo Session: Wesley Eure Solo` - 2026-09-06T16:20 - Epic Photos - `Wesley Eure`
- `Photo Session: Women of Battlestar` - 2026-09-05T15:10 - Epic Photos - `Tricia Helfer`, `Mary McDonnell`, `Grace Park`, `Katee Sackhoff`
- `Photo Session: Women of Battlestar` - 2026-09-06T14:20 - Epic Photos - `Tricia Helfer`, `Mary McDonnell`, `Grace Park`, `Katee Sackhoff`
- `Photo Session: Wynonna Earp` - 2026-09-04T11:40 - Epic Photos - `Emily Andras`, `Kat Barrell`, `Tim Rozon`, `Varun Saranga`, `Melanie Scrofano`
- `Photo Session: Wynonna Earp` - 2026-09-05T16:10 - Epic Photos - `Emily Andras`, `Kat Barrell`, `Tim Rozon`, `Varun Saranga`, `Melanie Scrofano`
- `Photo Session: Wynonna Earp` - 2026-09-06T14:40 - Epic Photos - `Emily Andras`, `Kat Barrell`, `Tim Rozon`, `Varun Saranga`, `Melanie Scrofano`
- `Photo session: Wednesday` - 2026-09-05T14:50 - Epic Photos - `Isaac Ordonez`, `Evie Templeton`
- `Psychostick` - 2026-09-06T01:30 - Live Performances - `Psychostick`
- `Q&A with Justin Lee Ford` - 2026-09-05T19:00 - Silk Road - `Justin Lee Ford`, `Mike Odle`, `Lyman Chen`
- `Q&A with the Amazing Sean Astin!` - 2026-09-06T10:00 - Main Programming - `Brian Richardson`, `Sean Astin`
- `Real or Fake Anime with Thomas Sanders` - 2026-09-04T20:30 - Digital Media - no people
- `Real or Fake Anime with Thomas Sanders` - 2026-09-04T20:30 - Digital Media - `Thomas Sanders`, `Sixth_Raikage_6`, `Sean Weiland`, `Deron Generally`
- `Release the Bats: The Goth/Industrial Panel` - 2026-09-05T17:30 - Horror - `DJ Ichabod`, `Nivek Ogre`, `Rogue`, `Aurelio Voltaire`, `Adria Stembridge`, and 1 more
- `Resident Alien Guests: Funny Bones Are Universal` - 2026-09-06T11:30 - American Sci-fi and Fantasy Media - `Rob Levy`, `Levi Fiehler`, `Meredith Garretson`, `Sara Tomko`, `Alice Wetterlund`
- `Resident Alien: Alien? Guests Among Us` - 2026-09-05T16:00 - American Sci-fi and Fantasy Media - `Crispy`, `Levi Fiehler`, `Meredith Garretson`, `Jewel Staite`, `Sara Tomko`, and 2 more
- `Resident Alien: Visitors from Patience, CO` - 2026-09-04T10:00 - American Sci-fi and Fantasy Media - `Tony P Henderson`, `Levi Fiehler`, `Meredith Garretson`, `Sara Tomko`, `Alice Wetterlund`
- `Return to Purgatory: Wynonna Earp Cast` - 2026-09-04T13:00 - Urban Fantasy - `Emily Andras`, `Kat Barrell`, `Tim Rozon`, `Varun Saranga`, `Carol Malcolm`
- `Rituals in the Wilderness: A Yellowjackets Cast Panel` - 2026-09-06T11:30 - Horror - `Tay Samms`, `Courtney Eaton`
- `Robots and Teeth: The Puppetry of Kevin Carlson` - 2026-09-04T20:30 - Puppetry - `Molly Abigail Coffee`, `Kevin Carlson`
- `Roll Against Fear: Tales of the Valiant – LIVE!` - 2026-09-05T19:00 - Table Top Gaming - `B. Dave Walters`, `Ming Chen`, `Tracie Miss Magitek Hearne`, `Omega Jones`, `Mark Meer`, and 1 more
- `Running Man: The Game Has Changed` - 2026-09-04T10:00 - American Sci-fi and Fantasy Media - `Alyssa Askani`, `Jazzmin Wilson`, `Jeni Green`, `Rebecca Russell`, `Shayna Adelman`
- `Secrets of Nevermore: Wednesday Cast` - 2026-09-05T13:00 - Urban Fantasy - `Kevin Bachelder`, `Isaac Ordonez`, `Evie Templeton`
- `Sherrilyn Kenyon & Friends: Costume & Book Signing Extravaganza!` - 2026-09-03T19:00 - Main Programming - `Leanna Renee Hieber`, `Sherrilyn Kenyon`
- `Smallville Class Reunion` - 2026-09-04T16:00 - American Sci-fi Classics - `Manda Montane`, `Aaron Ashmore`, `Erica Durance`, `Cassidy Freeman`
- `Smallville Class Reunion` - 2026-09-05T11:30 - American Sci-fi Classics - `Mo Vermenton`, `Aaron Ashmore`, `Erica Durance`, `Cassidy Freeman`, `Tom Welling`
- `Smallville Class Reunion` - 2026-09-06T13:00 - American Sci-fi Classics - `Thomas Parham`, `Aaron Ashmore`, `Erica Durance`, `Cassidy Freeman`, `Tom Welling`
- `Star Trek Enterprise Q&A` - 2026-09-04T14:30 - Trek Track - `Marc Lee`, `Dominic Keating`, `Anthony Montgomery`, `Connor Trinneer`
- `Star Trek Enterprise Q&A` - 2026-09-05T17:30 - Trek Track - `Garrett Wang`, `Dominic Keating`, `Anthony Montgomery`, `Connor Trinneer`
- `Star Trek Enterprise Q&A` - 2026-09-06T16:00 - Trek Track - `Bobby Blackwolf`, `Dominic Keating`, `Anthony Montgomery`, `Connor Trinneer`
- `Star Trek Lower Decks Q&A` - 2026-09-04T11:30 - Trek Track - `Rob Roberts`, `Eugene Cordero`, `Dawnn Lewis`, `Tawny Newsome`, `Gillian Vigman`, and 1 more
- `Star Trek Lower Decks Q&A` - 2026-09-05T13:00 - Trek Track - `Garrett Wang`, `Eugene Cordero`, `Dawnn Lewis`, `Tawny Newsome`, `Jack Quaid`, and 2 more
- `Star Trek Lower Decks Q&A` - 2026-09-06T11:30 - Trek Track - `Crispy`, `Eugene Cordero`, `Dawnn Lewis`, `Tawny Newsome`, `Gillian Vigman`, and 1 more
- `Star Trek: Strange New Worlds` - 2026-09-05T16:00 - Trek Track - `Joey Davila`, `Jess Bush`, `Celia Rose Gooding`
- `Star Trek: Strange New Worlds Guests` - 2026-09-04T17:30 - Trek Track - `Brian Richardson`, `Jess Bush`, `Celia Rose Gooding`, `Anson Mount`, `Melanie Scrofano`
- `Star Trek: Strange New Worlds Guests` - 2026-09-06T14:30 - Trek Track - `Jess Bush`, `Celia Rose Gooding`
- `Stargate: SG-1 - Make It Spin` - 2026-09-05T14:30 - Military Sci-fi Media - `Marc Lee`, `Richard Dean Anderson`, `Claudia Black`, `Ben Browder`, `Teryl Rothery`, and 1 more
- `Stargate: SG-1: Taking This Loop off` - 2026-09-06T14:30 - Military Sci-fi Media - `Colby Smith`, `Richard Dean Anderson`, `Claudia Black`, `Ben Browder`, `Teryl Rothery`, and 1 more
- `Stargate: The Iris Is Open for SG-1` - 2026-09-04T16:00 - Military Sci-fi Media - `Bobby Blackwolf`, `Richard Dean Anderson`, `Claudia Black`, `Ben Browder`, `Teryl Rothery`, and 1 more
- `Starship Troopers 30th Anniversary Roughneck Reunion` - 2026-09-04T16:00 - American Sci-fi Classics - `Brian Richardson`, `Jake Busey`, `Michael Ironside`, `Dina Meyer`, `Denise Richards`, and 1 more
- `Starship Troopers 30th Anniversary Roughneck Reunion` - 2026-09-05T17:30 - American Sci-fi Classics - `Marc Lee`, `Jake Busey`, `Michael Ironside`, `Dina Meyer`, `Denise Richards`, and 1 more
- `Starship Troopers Roughneck Reunion` - 2026-09-07T10:00 - American Sci-fi Classics - `Rob Levy`, `Jake Busey`, `Michael Ironside`
- `Starship Troopers: 30th Anniversary Roughneck Reunion` - 2026-09-06T10:00 - American Sci-fi Classics - `Kiki Falkanger`, `Jake Busey`, `Michael Ironside`, `Dina Meyer`, `Denise Richards`, and 1 more
- `Supergirl: Woman of Tomorrow` - 2026-09-04T17:30 - American Sci-fi and Fantasy Media - `Aaron Michael Ritchey`, `Kevin Eldridge`, `Steve Saffel`, `Cammien Ray`, `Jon-Paul Estes`
- `Tai Chi with Erin Gray **EXTRA FEE WORKSHOP**` - 2026-09-04T16:00 - Workshops - `Erin Gray`
- `Tai Chi with Erin Gray **EXTRA FEE WORKSHOP**` - 2026-09-05T14:30 - Workshops - `Erin Gray`
- `Tai Chi with Erin Gray **EXTRA FEE WORKSHOP**` - 2026-09-06T14:30 - Workshops - `Erin Gray`
- `The Annual Dragon Con Parade!` - 2026-09-05T10:00 - Main Programming - `Tony DiTerlizzi`, `Anson Mount`, `Timothy Zahn`
- `The Boys Guests: Life in Vought World` - 2026-09-04T14:30 - American Sci-fi and Fantasy Media - `Joey Davila`, `Tomer Capone`, `Jack Quaid`
- `The Boys Guests: Supes, Scandals & Stories` - 2026-09-06T11:30 - American Sci-fi and Fantasy Media - `Tony P Henderson`, `Tomer Capone`, `Jack Quaid`
- `The Boys guests: Behind the Mayhem` - 2026-09-05T11:30 - American Sci-fi and Fantasy Media - `Colby Smith`, `Shawn Ashmore`, `Tomer Capone`
- `The Boys: Truth? Justice? ... and Vought` - 2026-09-05T16:00 - American Sci-fi and Fantasy Media - `Crystal Cleveland`, `Haduo-Ken Masters`, `Michael Collins`, `Paul Race`, `Robyn McGlotten`
- `The Cybertronic Spree` - 2026-09-04T23:30 - Live Performances - `The Cybertronic Spree`
- `The Demonatrix Screening` - 2026-09-04T22:00 - Horror - `Aurelio Voltaire`, `Nivek Ogre`
- `The Hunt Is On: A Yellowjackets Cast Panel` - 2026-09-05T17:30 - Horror - `Sammi Doneff`, `Courtney Eaton`
- `The Life and Times of Sean Astin` - 2026-09-04T13:00 - Main Programming - `Dot R Steverson`, `Sean Astin`
- `The Rookie Cast` - 2026-09-04T13:00 - Main Programming - `Tay Samms`, `Shawn Ashmore`, `Richard T Jones`
- `The Rookie Guests` - 2026-09-05T14:30 - Main Programming - `Kiki Falkanger`, `Lisseth Chavez`, `Richard T Jones`, `Melissa O'Neil`
- `The Skeptical Side of Castle` - 2026-09-05T19:00 - Skeptics - `Seamus Dever`, `Jon Huertas`, `The Friggatriskaidekaphobia Treatment Nurse`, `Angie Matttke`
- `The Tan and Sober Gentlemen` - 2026-09-05T01:30 - Live Performances - `The Tan and Sober Gentlemen`
- `The Thrilling Adventures of Victoria` - 2026-09-06T10:00 - Main Programming - `Victoria`, `Joe Crowe`
- `The Video Game Costume Contest` - 2026-09-04T17:30 - Video Gaming - `Alison Carrier`, `Dustin Fletcher`, `Mikal Mosley`, `Paris K Arrowsmith`
- `The World of Monster High: The Movies, the Shows, the Dolls, & More` - 2026-09-05T11:30 - Urban Fantasy - `Austinn West`, `Carol Malcolm`, `Gabby`, `Gracie Palmer`, `Vikki Ortone`
- `Venture Bros. Panel` - 2026-09-06T11:30 - Animation - `Ken Plume`, `Mark Gagliardi`, `Doc Hammer`, `Hal Lublin`
- `WABE: Imagined Worlds, Real Nation – 40 Years of Fandom & America at 250` - 2026-09-03T12:00 - Main Programming - `Yaya Han`, `Tawny Newsome`, `Pat Henry - President of Dragon Con`, `Rose Scott`
- `Welcome to Fandom Face-off: The Ultimate Gameshow of Bad Choices!` - 2026-09-06T16:00 - Digital Media - `Charles A Mcfall`, `Thomas Sanders`, `Josh Cooper`
- `Welcome to Night Vale` - 2026-09-05T16:00 - Digital Media - `Mark Gagliardi`, `Hal Lublin`, `Symphony Sanders`
- `Welcome to Trek Track` - 2026-09-04T10:00 - Trek Track - `Garrett Wang`, `Leo Visentin`
- `X-Men '97 Cast` - 2026-09-04T14:30 - Animation - `Tay Samms`, `Gui Agustini`, `Ross Marquand`, `Alison Sealy-Smith`
- `X-Men '97 Cast` - 2026-09-06T10:00 - Animation - `Manda Montane`, `Gui Agustini`, `Alison Sealy-Smith`, `Matthew Waterson`
- `X-Men '97 Guests` - 2026-09-05T13:00 - Animation - `Joey Davila`, `Gui Agustini`, `Ross Marquand`, `Alison Sealy-Smith`, `Matthew Waterson`
- `You Want a Killer Hillbilly? – An Hour With Tyler Labine` - 2026-09-04T10:00 - Horror - `Colby Smith`, `Tyler Labine`
- `ZombieCON Vol. 1: Fan Discussion Panel` - 2026-09-04T19:00 - Apocalypse Rising - `Jonathan Sarge`, `Kyle Valle`
