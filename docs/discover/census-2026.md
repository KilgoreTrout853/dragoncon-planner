# Tag census - the 2026 schedule

Written by `tag_census.py` from `data/2026/events.json` (`generated_at` 2026-09-07T12:50:19+00:00, source https://app.core-apps.com/dragoncon26). Do not edit it by hand; run the script again.

It states facts and recommends nothing. `UNSURE` marks a candidate that needs a person's judgment, and nothing here resolves one. Lists run by count, descending, then by name; a list with no counts runs by name. Event titles and patterns are in code spans so that their punctuation shows as written.

## 0. Headline numbers

1. Events: 3,459, and `count` in events.json says 3,459. Tagged: 3,449. No tags at all: 10.
2. No fandom: 2,627 (75.9%). No topic: 367 (10.6%). Neither: 288 (8.3%).
3. Fandoms: 116 distinct names over 865 assignments; 64 appear once; the largest is Dungeons & Dragons (147).
4. Fandom names to look at (UNSURE): same-key groups 1, prefix pairs 1. Names that are a topic or generic: 5, on 50 events.
5. Topics: 32 of 32 used (unused: none); the largest is Gaming (850).
6. Kind: `other` on 20 of 3,449 tagged events (0.6%); the largest is `panel` (1,187).
7. Guests: `unknown` on 386 (11.2% of tagged); `celebrity` on 470.
8. Adult: 104 events. UNSURE: says 18+, 21+, adults only or "Mature Audience" and tagged false, 1; tagged true and says none of them, 30; one title tagged both ways, 3.
9. People: 1,405 distinct speaker names; UNSURE: variant groups 9, names carrying a title, credential, parenthetical or "from X" tail 45. Names on celebrity events: 225. Events with no speakers: 1,334 (38.6%).
10. Titles: 94 carry a facet ($, SOLD OUT, a clock time and the like); 371 titles recur at more than one start time, over 1,254 events; 27 of 54 tracks have one topic on over 80% of their events.

## 1. Coverage

- Events: 3,459. `count` in events.json says 3,459, which agrees.
- With tags: 3,449. With no `tags` object at all: 10.
- No fandom: 2,627 (75.9%). No topic: 367 (10.6%). Neither: 288 (8.3%). Each of the three includes the 10 untagged events.

The untagged events:

- `Claudia Black Live!` - 2026-09-07T10:00, Military Sci-fi Media
- `Kevin Carlson Autograph Session` - 2026-09-05T16:00, (no track)
- `Kevin Carlson Autograph Session` - 2026-09-06T11:30, Puppetry
- `On the Mothman Trail` - 2026-09-04T16:00, XTrack
- `Photo Session: Jack Quaid Solo` - 2026-09-04T12:40, Epic Photos
- `Photo Session: Jack Quaid Solo` - 2026-09-05T12:00, Epic Photos
- `Photo Session: Jack Quaid Solo` - 2026-09-06T13:10, Epic Photos
- `Photo Session: Photo session: Tom Welling Solo` - 2026-09-06T14:50, Epic Photos
- `Photo Session: The Boys` - 2026-09-04T12:30, Epic Photos
- `Photo Session: The Boys` - 2026-09-05T12:10, Epic Photos

Neither a fandom nor a topic, by type:

| type | neither | of | share |
| --- | ---: | ---: | ---: |
| panel | 288 | 2,589 | 11.1% |
| gaming | 0 | 870 | 0.0% |

Neither a fandom nor a topic, by track (top 15; an event with two tracks counts under both):

| track | neither | of | share |
| --- | ---: | ---: | ---: |
| Epic Photos | 213 | 318 | 67.0% |
| Vendor Workshops/Events | 41 | 139 | 29.5% |
| Main Programming | 7 | 96 | 7.3% |
| Reading Sessions | 5 | 22 | 22.7% |
| Author Signings | 4 | 15 | 26.7% |
| Military Sci-fi Media | 4 | 45 | 8.9% |
| XTrack | 3 | 41 | 7.3% |
| Video Gaming | 2 | 58 | 3.4% |
| (no track) | 1 | 1 | 100.0% |
| Alternate and Historical Fiction | 1 | 64 | 1.6% |
| Apocalypse Rising | 1 | 35 | 2.9% |
| Costuming | 1 | 76 | 1.3% |
| Live Performances | 1 | 19 | 5.3% |
| Live Performances - Hyatt Concourse | 1 | 32 | 3.1% |
| Puppetry | 1 | 43 | 2.3% |

## 2. Fandoms

- Distinct fandom names: 116, over 865 assignments.
- Tagged events by how many fandoms they have: 0: 2,617; 1: 803; 2: 25; 3: 4.
- The five largest hold 456 of the assignments (52.7%).

How many fandoms have how many events:

| events | fandoms |
| --- | ---: |
| 1 | 64 |
| 2 | 18 |
| 3-5 | 13 |
| 6-20 | 11 |
| 21+ | 10 |

Top 50:

| fandom | events |
| --- | ---: |
| Dungeons & Dragons | 147 |
| Star Trek | 111 |
| Magic: The Gathering | 89 |
| Star Wars | 58 |
| Marvel | 51 |
| Pokemon | 38 |
| DC Comics | 34 |
| Anime | 32 |
| The Lord of the Rings | 29 |
| Doctor Who | 23 |
| Warhammer 40,000 | 18 |
| Video Games | 13 |
| Game of Thrones | 11 |
| Battlestar Galactica | 9 |
| Firefly | 9 |
| Pathfinder | 8 |
| Stargate | 8 |
| Stranger Things | 8 |
| Starship Troopers | 7 |
| Alien | 6 |
| My Hero Academia | 6 |
| Babylon 5 | 5 |
| Buffy the Vampire Slayer | 5 |
| Land of the Lost | 5 |
| The Amazing Digital Circus | 5 |
| Final Fantasy | 4 |
| Hazbin Hotel | 4 |
| Starfinder | 4 |
| Comics | 3 |
| Harry Potter | 3 |
| Shovel Knight | 3 |
| The Expanse | 3 |
| The Magicians | 3 |
| Wynonna Earp | 3 |
| Castle | 2 |
| Critical Role | 2 |
| Dragon Ball | 2 |
| Dune | 2 |
| Fallout | 2 |
| Haikyuu!! | 2 |
| Halo | 2 |
| One Piece | 2 |
| Smallville | 2 |
| The Hitchhiker's Guide to the Galaxy | 2 |
| The Hunger Games | 2 |
| The Legend of Zelda | 2 |
| The Muppets | 2 |
| The NeverEnding Story | 2 |
| The Orville | 2 |
| The Rookie | 2 |

The 64 fandoms with one event are in Appendix A.

### Near-duplicate candidates - UNSURE

Names that are the same once case, punctuation, and/& and a leading "the" are set aside:

- UNSURE: The Wheel of Time (1), Wheel of Time (1)

Names whose words begin another name (whole words only):

- UNSURE: Dragon Ball (2) / Dragon Ball Z (1)

Names in the data that `CANON` in tag_events.py, as it stands today, would fold into another:

- none

### Fandom names that are a topic, or generic

Checked against the 32 `TOPICS`, against the same with plurals set aside, and against this list: Anime, Board Games, Books, Card Games, Cartoons, Cosplay, Film, Games, Gaming, Manga, Movies, Science Fiction, Superheroes, Tabletop Games, Television, TV, Video Games. 50 events carry at least one of these names.

| fandom | why | events |
| --- | --- | ---: |
| Anime | equals the topic Anime | 32 |
| Video Games | in the generic list | 13 |
| Comics | equals the topic Comics | 3 |
| Animation | equals the topic Animation | 1 |
| Fantasy | equals the topic Fantasy | 1 |

### Inside the ten largest

Words and adjacent two-word phrases in the titles of each fandom's events, by how many of those events hold them: up to 20 of each, those on at least 2 events. Out: stopwords, numbers, one-letter words, and the words of the fandom's own name.

**Dungeons & Dragons** (147 events)

- Words: 5e (59), ddal (38), dc (35), fr (30), ddlg (20), log (18), loi (18), cgb (15), tdd (13), fever (7), fog (7), run (7), through (7), adventure (6), arena (6), combat (6), gang (6), ghost (6), gilded (6), live (6)
- Phrases: ddal fr (30), fr dc (30), ddlg log (18), log loi (18), dc cgb (15), dc tdd (13), 5e arena (6), 5e ghost (6), 5e shakedown (6), arena combat (6), gang adventure (6), gilded zephyr (6), noir mystery (6), occult noir (6), scooby gang (6), author run (5), blind wyrms (5), crooked moon (5), dc rdp (5), ddal ps (5)

**Star Trek** (111 events)

- Words: session (49), photo (48), solo (22), decks (15), lower (15), duo (12), enterprise (10), new (7), strange (7), worlds (6), show (5), anthony (3), bush (3), connor (3), cordero (3), dominic (3), eugene (3), felt (3), full (3), group (3)
- Phrases: photo session (48), session photo (38), lower decks (15), session lower (12), decks duo (9), new worlds (6), session enterprise (6), strange new (6), anthony montgomery (3), connor trinneer (3), cordero solo (3), decks full (3), dominic keating (3), enterprise duo (3), enterprise group (3), eugene cordero (3), jess bush (3), keating solo (3), montgomery solo (3), newsome solo (3)

**Magic: The Gathering** (89 events)

- Words: mtg (80), sealed (33), ode (25), commander (16), draft (13), hobbit (11), pod (10), box (8), league (8), precon (8), chaos (7), mixed (7), 2hg (6), 40th (5), anniversary (5), booster (5), clue (5), constructed (5), elimination (5), mystery (5)
- Phrases: mtg ode (25), hobbit sealed (11), mtg precon (8), precon commander (8), mtg chaos (7), mtg 2hg (6), 40th anniversary (5), box constructed (5), clue pod (5), commander pod (5), elimination draft (5), mystery booster (5), ode clue (5), ode commander (5), ode mystery (5), ode single (5), ode win (5), sealed 40th (5), single elimination (5), bootcamp league (4)

**Star Wars** (58 events)

- Words: photoshoot (8), hour (4), authors (3), contest (3), empire (3), republic (3), sealed (3), unlimited (3), amazing (2), back (2), costume (2), droids (2), fan (2), galactic (2), jedi (2), mandalorian (2), new (2), old (2), panel (2), showcase (2)
- Phrases: unlimited sealed (3), old republic (2), trivia contest (2)

**Marvel** (51 events)

- Words: man (9), mcu (9), spider (9), photoshoot (6), liesmiths (5), men (5), multiverse (5), rpg (5), war (5), america (2), captain (2), cardio (2), cast (2), comics (2), daredevil (2), doomsday (2), geeknasium (2), iron (2), live (2), magic (2)
- Phrases: liesmiths war (5), multiverse rpg (5), spider man (5), captain america (2), cardio workout (2), geeknasium live (2), man cardio (2)

**Pokemon** (38 events)

- Words: challenge (4), diamond (4), journeys (4), pearl (4), advanced (3), adventures (3), battle (3), black (3), deck (3), league (3), moon (3), photoshoot (3), precon (3), sun (3), ultra (3), white (3), johto (2), late (2), live (2), master (2)
- Phrases: deck challenge (3), precon deck (3), late starters (2), moon ultra (2), starters live (2), ttrpg late (2)

**DC Comics** (34 events)

- Words: photoshoot (6), batman (4), supergirl (4), dark (3), knight (3), woman (3), animated (2), anniversary (2), harley (2), heroes (2), justice (2), man (2), night (2), superhero (2), superman (2), tomorrow (2), trivia (2), universe (2), years (2)
- Phrases: dark knight (3), supergirl woman (2)

**Anime** (32 events)

- Words: photoshoot (4), battle (3), death (3), adventure (2), amvs (2), cast (2), fake (2), life (2), real (2), sanders (2), thomas (2)
- Phrases: death battle (3), thomas sanders (2)

**The Lord of the Rings** (29 events)

- Words: hobbit (8), sealed (6), gathering (5), magic (5), mtg (5), astin (4), sean (4), 40th (3), anniversary (3), lotr (3), cube (2), draft (2), earth (2), game (2), life (2), middle (2), photo (2), power (2), presents (2), productions (2)
- Phrases: hobbit sealed (5), mtg magic (4), sean astin (4), 40th anniversary (3), sealed 40th (3), astin solo (2), cube draft (2), lotr tcg (2), middle earth (2), photo session (2), productions presents (2), rose tatu (2), session photo (2), session sean (2), taking game (2), tatu productions (2), tcg cube (2), trick taking (2)

**Doctor Who** (23 events)

- Words: along (2), felt (2), haunting (2), irish (2), mothership (2), nerdy (2), nerdys (2), pub (2), puppet (2), show (2), sing (2), song (2), trivia (2), years (2), ypsilon (2)
- Phrases: felt nerdys (2), irish pub (2), nerdy irish (2), pub song (2), puppet show (2), sing along (2), song sing (2)

## 3. Topics

- `TOPICS` has 32 entries; 32 are used. Unused: none.
- Topic values in the data that are not in `TOPICS`: none.
- Tagged events by how many topics they have: 0: 357; 1: 958; 2: 1,710; 3: 424.

| topic | events | share of all events |
| --- | ---: | ---: |
| Gaming | 850 | 24.6% |
| Tabletop | 724 | 20.9% |
| Fantasy | 290 | 8.4% |
| Literature | 281 | 8.1% |
| Sci-Fi | 275 | 8.0% |
| TV | 252 | 7.3% |
| Cosplay Photography | 251 | 7.3% |
| Film | 231 | 6.7% |
| Fandom Culture | 222 | 6.4% |
| Art | 215 | 6.2% |
| Music | 179 | 5.2% |
| Community | 166 | 4.8% |
| Writing | 157 | 4.5% |
| Tech | 154 | 4.5% |
| Science | 145 | 4.2% |
| Costuming | 134 | 3.9% |
| Props & Making | 126 | 3.6% |
| Horror | 117 | 3.4% |
| Anime | 101 | 2.9% |
| History | 98 | 2.8% |
| Comics | 90 | 2.6% |
| Animation | 87 | 2.5% |
| Comedy | 83 | 2.4% |
| Kids | 79 | 2.3% |
| Podcasting | 75 | 2.2% |
| Space | 64 | 1.9% |
| Puppetry | 53 | 1.5% |
| Politics | 45 | 1.3% |
| Skepticism | 37 | 1.1% |
| Paranormal | 34 | 1.0% |
| Fitness | 21 | 0.6% |
| Food | 14 | 0.4% |

## 4. Kind

- `other`: 20 of 3,449 tagged events (0.6%). `clean_tags` also writes `other` for any kind the model returned that is not in `KINDS`; the file cannot tell the two apart.
- Kinds in `KINDS` with no events: none. Kind values not in `KINDS`: none.

Distribution, and type against kind:

| kind | events | share | panel | gaming |
| --- | ---: | ---: | ---: | ---: |
| panel | 1,187 | 34.3% | 1,187 | 0 |
| gaming | 842 | 24.3% | 29 | 813 |
| photo | 499 | 14.4% | 499 | 0 |
| workshop | 203 | 5.9% | 160 | 43 |
| performance | 167 | 4.8% | 167 | 0 |
| signing | 134 | 3.9% | 134 | 0 |
| screening | 108 | 3.1% | 108 | 0 |
| qa | 97 | 2.8% | 97 | 0 |
| contest | 83 | 2.4% | 73 | 10 |
| party | 78 | 2.3% | 77 | 1 |
| reading | 29 | 0.8% | 29 | 0 |
| other | 20 | 0.6% | 17 | 3 |
| (untagged) | 10 | 0.3% | 10 | 0 |
| tour | 2 | 0.1% | 2 | 0 |

## 5. Guests

- `unknown`: 386 of 3,449 tagged events (11.2%). As with kind, `clean_tags` writes `unknown` for any value it does not recognise.

| guests | events | share |
| --- | ---: | ---: |
| fan | 1,405 | 40.6% |
| creator | 1,188 | 34.3% |
| celebrity | 470 | 13.6% |
| unknown | 386 | 11.2% |
| (untagged) | 10 | 0.3% |

The `unknown` events, by kind:

| kind | events |
| --- | ---: |
| gaming | 224 |
| screening | 88 |
| panel | 35 |
| performance | 10 |
| other | 9 |
| party | 7 |
| contest | 5 |
| photo | 4 |
| workshop | 4 |

## 6. Adult

- `adult` is true on 104 events (3.0% of tagged). The untagged events are in none of the lists below.
- The wording looked for, in title and description: `\b(?:18|21)\s*\+|\b(?:18|21)\s*(?:and|&|or)\s*(?:up|over|older)\b|\badults?[\s-]+only\b|\bmature audiences?\b`. That is 18+, 21+ and adults only, and also "Mature Audience": the schedule's own marker, which closes a description as "(Mature Audience)" and is on 72 events. "Adults only" is on 5.
- "past 600" means the words sit after character 600 of the description, which the tagger was never sent.

What the text says, by how the event is tagged (events; every `N+` from 13+ to 21+ is shown):

| wording | events | adult true | adult false |
| --- | ---: | ---: | ---: |
| `mature audience` | 71 | 70 | 1 |
| `17+` | 14 | 12 | 2 |
| `18+` | 13 | 13 | 0 |
| `adults only` | 5 | 5 | 0 |
| `16+` | 2 | 1 | 1 |
| `21+` | 2 | 2 | 0 |
| `13+` | 1 | 0 | 1 |
| `mature audiences` | 1 | 1 | 0 |

### Says so, tagged false: 1 - UNSURE

- UNSURE: `The Adult Boasting Contest: May the Best Storyteller Prevail!` - 2026-09-04T22:00 - in the description: `Mature Audience`

### One title, tagged both ways: 3 - UNSURE

Titles, normalised as in section 11, whose occurrences do not agree on `adult`:

- UNSURE: `BARELY COPING? Play the Game! (17+)` - true on 12 of 14
- UNSURE: `CAIN: JJK/Chainsaw Man + XFiles/SCP/Control` - true on 4 of 5
- UNSURE: `Concert – Clearly Guilty` - true on 1 of 2

### Tagged true, does not say so: 30 - UNSURE

- UNSURE: `BARELY COPING? Play the Game! (17+)` - 2026-09-03T19:00 - Collectible Card Games
- UNSURE: `BARELY COPING? Play the Game! (17+)` - 2026-09-03T20:00 - Collectible Card Games
- UNSURE: `BARELY COPING? Play the Game! (17+)` - 2026-09-04T15:00 - Collectible Card Games
- UNSURE: `BARELY COPING? Play the Game! (17+)` - 2026-09-04T16:00 - Collectible Card Games
- UNSURE: `BARELY COPING? Play the Game! (17+)` - 2026-09-04T17:00 - Collectible Card Games
- UNSURE: `BARELY COPING? Play the Game! (17+)` - 2026-09-04T18:00 - Collectible Card Games
- UNSURE: `BARELY COPING? Play the Game! (17+)` - 2026-09-05T16:00 - Collectible Card Games
- UNSURE: `BARELY COPING? Play the Game! (17+)` - 2026-09-05T17:00 - Collectible Card Games
- UNSURE: `BARELY COPING? Play the Game! (17+)` - 2026-09-06T16:00 - Collectible Card Games
- UNSURE: `BARELY COPING? Play the Game! (17+)` - 2026-09-06T18:00 - Collectible Card Games
- UNSURE: `BARELY COPING? Play the Game! (17+)` - 2026-09-06T19:00 - Collectible Card Games
- UNSURE: `BARELY COPING? Play the Game! (17+)` - 2026-09-07T14:00 - Collectible Card Games
- UNSURE: `Bad to the Bone: Villains in the Bedroom` - 2026-09-04T22:00 - American Sci-fi and Fantasy Media
- UNSURE: `Boinking Beasties` - 2026-09-06T22:00 - Fantasy Literature
- UNSURE: `Bootleg Apocalypse: Making Your Own Booze After the World Falls` - 2026-09-06T13:00 - Apocalypse Rising
- UNSURE: `Bunny Hutch Party – Age Verification & Wristbanding` - 2026-09-03T14:00 - Costuming
- UNSURE: `Bunny Hutch Party – Age Verification & Wristbanding` - 2026-09-03T14:00 - Main Programming
- UNSURE: `CAIN: JJK/Chainsaw Man + XFiles/SCP/Control` - 2026-09-05T09:00 - Role-Playing Games (Non-Campaign)
- UNSURE: `CAIN: JJK/Chainsaw Man + XFiles/SCP/Control` - 2026-09-05T13:00 - Role-Playing Games (Non-Campaign)
- UNSURE: `CAIN: JJK/Chainsaw Man + XFiles/SCP/Control` - 2026-09-05T18:00 - Role-Playing Games (Non-Campaign)
- UNSURE: `CAIN: JJK/Chainsaw Man + XFiles/SCP/Control` - 2026-09-06T09:00 - Role-Playing Games (Non-Campaign)
- UNSURE: `Dragon Con's 'Pin-ups by the Pool' Party` - 2026-09-04T20:30 - Main Programming
- UNSURE: `Let's Get Kinky: A Very Incomplete Survey of Scientists Making Sex Jokes` - 2026-09-04T22:00 - Space
- UNSURE: `Lewdle Crew - Art After Dark` - 2026-09-04T23:30 - Digital Media
- UNSURE: `National Puppet Slam **EXTRA FEE EVENT**` - 2026-09-05T20:00 - Puppetry
- UNSURE: `Puppetry 101 - Adults` - 2026-09-07T13:00 - Puppetry
- UNSURE: `Puppetry and Burlesque` - 2026-09-07T11:30 - Puppetry
- UNSURE: `Rating the Spice & Everything Nice!` - 2026-09-04T14:30 - Fantasy Literature
- UNSURE: `Spectrum: A Rainbow Flag Party – Age Verification & Wristbanding` - 2026-09-05T14:00 - Costuming
- UNSURE: `They Do the Weird Stuff!: NC-17 Fanfic` - 2026-09-05T22:00 - American Sci-fi and Fantasy Media

## 7. People

- Distinct speaker names: 1,405, over 5,316 appearances.

Roles:

| role | appearances |
| --- | ---: |
| `Speaker` | 3,777 |
| `Moderator` | 846 |
| `Panelist` | 612 |
| `Judge` | 44 |
| `DJ` | 32 |
| `Moderator Judge` | 2 |
| `(Alt: )` | 1 |
| `Moderator DJ` | 1 |
| `Virtual` | 1 |

How many names have how many appearances:

| appearances | names |
| --- | ---: |
| 1 | 479 |
| 2 | 172 |
| 3-5 | 400 |
| 6-10 | 305 |
| 11-20 | 49 |
| 21+ | 0 |

### Variant candidates: 9 groups - UNSURE

Names that are the same once case, punctuation, honorifics (Dr., Mr.), trailing credentials and suffixes (PhD, Jr., II), (parentheticals), a "from X" or "of X" tail and middle initials are set aside. With appearances:

- UNSURE: `Elizabeth Carpenter` (2), `Elizabeth Carpenter(Judge)` (1)
- UNSURE: `Elizabeth Murphy Spivey` (1), `Elizabeth Murphy-Spivey` (1)
- UNSURE: `Heather Croas` (1), `Heather N. Croas` (1)
- UNSURE: `James Henson` (6), `James Henson(Judge)` (1)
- UNSURE: `K. E. Deyarmin` (1), `K.E. Deyarmin` (3)
- UNSURE: `Karen Henson` (14), `Karen Henson(Judge)` (1)
- UNSURE: `Madison May` (1), `Madison May from Cut/Sew` (1)
- UNSURE: `Pro from Pros & Cons Cosplay` (1), `Pro of Pros and Cons Cosplay` (1)
- UNSURE: `Toni From Quiltoni booth 3230` (1), `Toni from Quiltoni - booth 3230` (1), `Toni from Quiltoni booth 3230` (1), `Toni from Quiltoni-booth 3230` (1)

### Names carrying something besides the name: 45 - UNSURE

Whether or not another spelling exists. Left out of the list: the 120 names whose only extra is a middle initial. With appearances, and what the key set aside:

- UNSURE: `Amy Bray (501st)` (1) - parenthetical
- UNSURE: `Bathroom of the Future` (1) - from/of tail
- UNSURE: `Bryan Saunders (Cosplay Medics)` (1) - parenthetical
- UNSURE: `Calvin Watts III` (2) - credential or suffix
- UNSURE: `Con of Pros and Cons Cosplay` (2) - from/of tail
- UNSURE: `Daniel Delgado from AllTru2U` (1) - from/of tail
- UNSURE: `Daniel Eisenhauer(Judge)` (2) - parenthetical
- UNSURE: `Dr Sabrina Grinstead` (1) - honorific
- UNSURE: `Dr. Carol White` (1) - honorific
- UNSURE: `Dr. Craz` (1) - honorific
- UNSURE: `Dr. Dana Bevan` (1) - honorific
- UNSURE: `Dr. John Bradford` (4) - honorific
- UNSURE: `Dr. Lea Harris` (2) - honorific
- UNSURE: `Dr. Nicole Gugliucci` (8) - honorific
- UNSURE: `Elisa Relano from STL Ocarina` (1) - from/of tail
- UNSURE: `Elizabeth Carpenter(Judge)` (1) - parenthetical
- UNSURE: `James Farmer of ArtCarp` (1) - from/of tail
- UNSURE: `James Henson(Judge)` (1) - parenthetical
- UNSURE: `John Hinkle (Roswell Firelab)` (1) - parenthetical
- UNSURE: `John Rice(Judge)` (1) - parenthetical
- UNSURE: `Jonelle Dawkins (Scraplanta)` (1) - parenthetical
- UNSURE: `Jotham R Austin, II` (7) - credential or suffix, middle initial
- UNSURE: `Karen Henson(Judge)` (1) - parenthetical
- UNSURE: `Kei (tophat_tiara)` (3) - parenthetical
- UNSURE: `Lucy Boydston(Judge)` (2) - parenthetical
- UNSURE: `Madison May from Cut/Sew` (1) - from/of tail
- UNSURE: `Mark NeCamp, Jr.` (4) - credential or suffix
- UNSURE: `Matthew (Wally) Wallace` (1) - parenthetical
- UNSURE: `Meg from Megs Mashables` (1) - from/of tail
- UNSURE: `Mr. Corporate` (1) - honorific
- UNSURE: `Mr. Vader` (1) - honorific
- UNSURE: `Ms. Leisure` (2) - honorific
- UNSURE: `Peggy Eisenhauer(Judge)` (1) - parenthetical
- UNSURE: `Pro from Pros & Cons Cosplay` (1) - from/of tail
- UNSURE: `Pro of Pros and Cons Cosplay` (1) - from/of tail
- UNSURE: `Ra'Neith (Freeside Makerspace)` (1) - parenthetical
- UNSURE: `Rebecca Scott from Paperbones` (1) - from/of tail
- UNSURE: `Rebecca from The Evergreen Burrow` (1) - from/of tail
- UNSURE: `Robert Madison II` (2) - credential or suffix
- UNSURE: `Rose (TJ) Reynolds` (5) - parenthetical
- UNSURE: `Shelby Kurland (Decatur Makers)` (1) - parenthetical
- UNSURE: `Toni From Quiltoni booth 3230` (1) - from/of tail
- UNSURE: `Toni from Quiltoni - booth 3230` (1) - from/of tail
- UNSURE: `Toni from Quiltoni booth 3230` (1) - from/of tail
- UNSURE: `Toni from Quiltoni-booth 3230` (1) - from/of tail

### Names on `guests: celebrity` events

225 distinct names appear on the 470 celebrity events. Everyone credited on such an event is counted, moderators included. The top 30 are here and the full list is Appendix B.

| name | celebrity events | all events |
| --- | ---: | ---: |
| Alan Tudyk | 16 | 16 |
| Tawny Newsome | 16 | 16 |
| Eugene Cordero | 15 | 15 |
| Jewel Staite | 14 | 14 |
| Anthony Montgomery | 13 | 13 |
| Connor Trinneer | 13 | 13 |
| Grace Park | 13 | 13 |
| Tricia Helfer | 13 | 13 |
| Dawnn Lewis | 12 | 12 |
| Jon Huertas | 12 | 13 |
| Melanie Scrofano | 12 | 12 |
| Nathan Fillion | 12 | 12 |
| Noël Wells | 12 | 12 |
| Seamus Dever | 12 | 13 |
| Alice Wetterlund | 11 | 11 |
| Levi Fiehler | 11 | 11 |
| Meredith Garretson | 11 | 11 |
| Patricia Tallman | 11 | 11 |
| Sara Tomko | 11 | 11 |
| Bruce Boxleitner | 10 | 10 |
| Cassidy Freeman | 10 | 10 |
| Dominic Keating | 10 | 10 |
| Jake Busey | 10 | 10 |
| Katee Sackhoff | 10 | 10 |
| Kathy Coleman | 10 | 10 |
| Mary McDonnell | 10 | 10 |
| Michael Ironside | 10 | 10 |
| Phil Paley | 10 | 10 |
| Richard Dean Anderson | 10 | 10 |
| Wesley Eure | 10 | 10 |

### Events with no speakers

- 1,334 events (38.6%) have an empty `speakers`. By kind: gaming (826), photo (186), screening (95), panel (90), workshop (58), contest (27), party (24), other (17), performance (8), signing (2), reading (1).
- Of those, with "Additional Panelists:" in the description: 0.
- Events that do have speakers and whose description also has "Additional Panelists:": 981. Those names are in the description only.

## 8. Descriptions

- Empty: 75 (2.2%). Not empty and under 80 characters: 370 (10.7%).
- Over 600 characters: 104. The tagger was sent the first 600.
- Longest: 1,191 characters. Median: 210.

Length in characters, whitespace trimmed:

| characters | events | share |
| --- | ---: | ---: |
| 0 | 75 | 2.2% |
| 1-79 | 370 | 10.7% |
| 80-199 | 1,236 | 35.7% |
| 200-399 | 1,604 | 46.4% |
| 400-600 | 70 | 2.0% |
| 601-999 | 101 | 2.9% |
| 1,000+ | 3 | 0.1% |

## 9. Facets hiding in titles

94 events carry at least one of these in the title. The description column is the same pattern run over descriptions, for scale.

| facet | titles | descriptions |
| --- | ---: | ---: |
| $ / $$ | 23 | 0 |
| SOLD OUT | 19 | 2 |
| 18+ / 21+ | 1 | 14 |
| a clock time | 30 | 68 |
| CANCELLED | 2 | 4 |
| Part N / Repeat | 16 | 49 |
| fee / ticket / pre-registration | 45 | 248 |

- The `cancelled` field is true on 2 events: `CANCELLED - The Temporal Formal: Silver Screens and Golden Dreams`, `CANCELLED: Dragon Con Burlesque: A Glamour Geek Revue`.
- Fee wording leaves out "Ticket to Ride", which is a board game.
- Examples are up to ten distinct titles, evenly spaced through the alphabetical list of matches.

### $ / $$: 23

Pattern: `(?<![\w$])\${1,3}(?![\w$])`

- `Build Your Own RPG Dice Tray - $$ - 1:30-3:00pm SOLD OUT`
- `DYI Ponytail Clips - $$ - 1:00 - 3:00`
- `Fragrance as Creative Prompt- $ 10:30 - 11:30. SOLD OUT`
- `How to Play the Ocarina (and Your First Zelda Song) - $ - 10:30-11:30`
- `Intro Sculpting Workshop Pt 2: Sculpting on Your Dragon Armature - $$ FEE`
- `Kids!! Paint Your Own Wooden Character - $- 3:30-4:30`
- `Make (sew) Your own Banner - $$ 1:00-2:30p`
- `Mimic Dice Box Wooodworking Workshop - $ - 1:00 - 3:00`
- `Sew Your Own Beret - $$ 12:45p-2:45p SOLD OUT`
- `Sew a Kindle Sleeve - $$ 4:30 - 6:45`

### SOLD OUT: 19

Pattern: `\bsold[\s-]*out\b`

- `Build Your Own RPG Dice Tray - $$ - 1:30-3:00pm SOLD OUT`
- `Carpet Dragon Stained 'Glass' Workshop - $$ - 12:00-2:00 SOLD OUT`
- `English Paper Piece! Many Choices! 4:00 - 6:00 SOLD OUT`
- `Hand Embroider a Fabric Bookmark - $$- 10:30-12:30 SOLD OUT`
- `How to Sew a Tote Bag - $$ 10:15 - 12:15 SOLD OUT`
- `Learn Watercolor Basics &Paint Bookmarks! -$- 5:00-6:30 SOLD OUT`
- `Matt Dinniman - Signing - SOLD OUT`
- `Mending Clothes w/ Japanese Boro Embroidery- $ - 4:00-5:30 SOLD OUT`
- `Sew Your Own Beret - $$ 12:45p-2:45p SOLD OUT`
- `Sewing for Absolute Beginners - $$ 3:00-5:00p SOLD OUT`

### 18+ / 21+: 1

Pattern: `\b(?:18|21)\s*\+`

- `Battle of the Tropes 2: Late-Night Edition (18+)`

### a clock time: 30

Pattern: `\b(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*[ap]\.?m?\.?(?![a-z]))?|\b(?:1[0-2]|0?[1-9])\s*[ap]\.?m\b\.?`

- `Build Your Own RPG Dice Tray - $$ - 1:30-3:00pm SOLD OUT`
- `Dragon Con Throw Pillows! Make your own! - $$ 10:15 - 11:30 SOLD OUT`
- `Hand Embroider a Fabric Bookmark - $$- 10:30-12:30 SOLD OUT`
- `Highlander CCG sealed deck - Friday 11am`
- `How to Sew a Tote Bag - $$ 10:15 - 12:15 SOLD OUT`
- `Joystick Gamebar Presents: FREE Arcade Games!!! 10am to 4am`
- `Learn Watercolor Basics &Paint Bookmarks! -$- 5:00-6:30 SOLD OUT`
- `Mending Clothes w/ Japanese Boro Embroidery- $ - 4:00-5:30 SOLD OUT`
- `Sew Your Own Beret - $$ 12:45p-2:45p SOLD OUT`
- `Sewing for Absolute Beginners - $$ 3:00-5:00p SOLD OUT`

### CANCELLED: 2

Pattern: `\bcancell?ed\b`

- `CANCELLED - The Temporal Formal: Silver Screens and Golden Dreams`
- `CANCELLED: Dragon Con Burlesque: A Glamour Geek Revue`

### Part N / Repeat: 16

Pattern: `\bpart\s+(?:\d+|[ivx]+|one|two|three|four|five)\b|\bpart\d+\b|\bpt\.?\s*\d+\b|\brepeat\b`

- `Beyond the Backrooms: Liminal Spaces, Part 2 – Endless Hallway Boogaloo`
- `Changed for Good: Celebrating Wicked – Part Two`
- `Intro Sculpting Workshop Part 1: Building a Small Dragon Armature - **$50`
- `Intro Sculpting Workshop Pt 2: Sculpting on Your Dragon Armature - $$ FEE`
- `SFS2 1-14/1-15: The Beasts of Bo Part 1/Ruins of the World Soul`
- `SFS2 1-16/1-17: The Beasts of Bo Part 2/Corpse Fleet Conflict`
- `SFS2 1-23/1-24: Psychic Echoes/Final Gambit Part 1`
- `SFS2 1-25/1-26: The Hollowed Shell/Final Gambit Part 2`
- `Surviving the Fallout Universe: Pt 2!`
- `VIRTUAL: Secrets and Lies: Wednesday Season 2, Pt.2 Fan Discussion Panel`

### fee / ticket / pre-registration: 45

Pattern: `\bfees?\b|\bticket(?:s|ed)?\b(?!\s+to\s+ride)|\bpre-?\s?reg(?:ist\w*)?\b|\bregistration\b|\$\d`

- `101 Ideas in an Hour **EXTRA FEE WORKSHOP**`
- `Building Your Novel-Writing Tool Kit **EXTRA FEE WORKSHOP**`
- `Creating Reader Engagement: **EXTRA FEE WORKSHOP**`
- `Gatsby & Daisy Champagne Ball **EXTRA FEE EVENT**`
- `Intro Sculpting Workshop Part 1: Building a Small Dragon Armature - **$50`
- `Life-Drawing Workshop - Learn to Draw a Real Model! $$10`
- `Making the Next Draft the Best **EXTRA FEE WORKSHOP**`
- `Plotting: **EXTRA FEE WORKSHOP**`
- `Tai Chi with Erin Gray **EXTRA FEE WORKSHOP**`
- `Watching Movies to Make You a Better Writer **EXTRA FEE WORKSHOP**`

## 10. Tracks vs tags

- Tracks: 54 distinct values in `tracks[]`. Events by how many tracks they have: 0: 1; 1: 3,433; 2: 25. An event with two counts under both.
- A track's dominant topic is the topic on the most of its events; its share is those events over all the track's events, with or without topics. A tie goes to the first name alphabetically.

### Redundant with the topic (share over 80%): 27 of 54

- Collectible Card Games (240 events): Gaming, 94.6%
- Role-Playing Games (Non-Campaign) (240 events): Tabletop, 95.4%
- Group Cosplay Photoshoot (185 events): Cosplay Photography, 100.0%
- Role-Playing Games (Campaign) (177 events): Tabletop, 100.0%
- Costuming (76 events): Costuming, 88.2%
- Comics and Pop Art (67 events): Comics, 92.5%
- Board Games (65 events): Gaming, 95.4%
- Animation (48 events): Animation, 95.8%
- Kids Track (48 events): Kids, 95.8%
- Table Top Gaming (47 events): Tabletop, 95.7%
- Writer's Track (44 events): Writing, 100.0%
- Puppetry (43 events): Puppetry, 97.7%
- Science (43 events): Science, 95.3%
- Space (42 events): Space, 97.6%
- Horror (40 events): Horror, 95.0%
- Electronic Frontiers Forum (39 events): Tech, 84.6%
- Art Show Programming (38 events): Art, 89.5%
- Anime/Manga (35 events): Anime, 97.1%
- Filk Music (35 events): Music, 100.0%
- Live Performances - Hyatt Concourse (32 events): Music, 93.8%
- Skeptics (31 events): Skepticism, 87.1%
- Film Track (28 events): Film, 100.0%
- Young Adult Literature (28 events): Literature, 89.3%
- Live Performances (19 events): Music, 89.5%
- Werewolf Games (12 events): Gaming, 100.0%
- Artemis Spaceship Bridge Simulator (5 events): Gaming, 100.0%
- Live-Action Roleplaying Games (3 events): Tabletop, 100.0%

### Every track

| track | dominant topic | events | with it | share |
| --- | --- | ---: | ---: | ---: |
| Epic Photos | Cosplay Photography | 318 | 21 | 6.6% |
| Collectible Card Games | Gaming | 240 | 227 | 94.6% |
| Role-Playing Games (Non-Campaign) | Tabletop | 240 | 229 | 95.4% |
| Group Cosplay Photoshoot | Cosplay Photography | 185 | 185 | 100.0% |
| Role-Playing Games (Campaign) | Tabletop | 177 | 177 | 100.0% |
| Vendor Workshops/Events | Literature | 139 | 66 | 47.5% |
| Digital Media | Podcasting | 134 | 65 | 48.5% |
| Miniatures Games | Gaming | 123 | 82 | 66.7% |
| Main Programming | Community | 96 | 32 | 33.3% |
| Video Room | Film | 88 | 51 | 58.0% |
| Costuming | Costuming | 76 | 67 | 88.2% |
| Comics and Pop Art | Comics | 67 | 62 | 92.5% |
| Urban Fantasy | Fantasy | 67 | 42 | 62.7% |
| Board Games | Gaming | 65 | 62 | 95.4% |
| Alternate and Historical Fiction | History | 64 | 35 | 54.7% |
| American Sci-fi and Fantasy Media | TV | 61 | 36 | 59.0% |
| Video Gaming | Gaming | 58 | 40 | 69.0% |
| Trek Track | TV | 52 | 33 | 63.5% |
| Robotics and Maker Track | Tech | 51 | 37 | 72.5% |
| BritTrack | TV | 50 | 23 | 46.0% |
| High Fantasy | Fantasy | 50 | 40 | 80.0% |
| Animation | Animation | 48 | 46 | 95.8% |
| Kids Track | Kids | 48 | 46 | 95.8% |
| Table Top Gaming | Tabletop | 47 | 45 | 95.7% |
| American Sci-fi Classics | TV | 45 | 19 | 42.2% |
| Military Sci-fi Media | Sci-Fi | 45 | 31 | 68.9% |
| Writer's Track | Writing | 44 | 44 | 100.0% |
| Puppetry | Puppetry | 43 | 42 | 97.7% |
| Science | Science | 43 | 41 | 95.3% |
| Space | Space | 42 | 41 | 97.6% |
| XTrack | Paranormal | 41 | 26 | 63.4% |
| Horror | Horror | 40 | 38 | 95.0% |
| Electronic Frontiers Forum | Tech | 39 | 33 | 84.6% |
| Art Show Programming | Art | 38 | 34 | 89.5% |
| Anime/Manga | Anime | 35 | 34 | 97.1% |
| Apocalypse Rising | Sci-Fi | 35 | 13 | 37.1% |
| Diversity Track | Community | 35 | 17 | 48.6% |
| Filk Music | Music | 35 | 35 | 100.0% |
| Star Wars | Fandom Culture | 35 | 15 | 42.9% |
| Fantasy Literature | Literature | 33 | 25 | 75.8% |
| Live Performances - Hyatt Concourse | Music | 32 | 30 | 93.8% |
| Workshops | Writing | 32 | 22 | 68.8% |
| Skeptics | Skepticism | 31 | 27 | 87.1% |
| Sci-fi Literature | Sci-Fi | 30 | 24 | 80.0% |
| Silk Road | Film | 29 | 9 | 31.0% |
| Film Track | Film | 28 | 28 | 100.0% |
| Young Adult Literature | Literature | 28 | 25 | 89.3% |
| NSDMG / War College | History | 25 | 13 | 52.0% |
| Reading Sessions | Literature | 22 | 17 | 77.3% |
| Live Performances | Music | 19 | 17 | 89.5% |
| Author Signings | Literature | 15 | 11 | 73.3% |
| Werewolf Games | Gaming | 12 | 12 | 100.0% |
| Artemis Spaceship Bridge Simulator | Gaming | 5 | 5 | 100.0% |
| Live-Action Roleplaying Games | Tabletop | 3 | 3 | 100.0% |

## 11. Recurring

A title is normalised by case, accents and punctuation, and counts as recurring when it occurs at more than one `start`.

- Recurring titles: 370, over 1,251 events.
- With these facets also taken out of the title first ($ / $$, SOLD OUT, a clock time, CANCELLED): 371 titles, over 1,254 events (36.3% of the schedule). "Part N" stays in, so a series is not a recurrence. The rest of this section uses this count.
- By the title's most frequent kind: gaming (172), photo (107), signing (21), performance (20), workshop (16), panel (11), qa (7), party (6), contest (5), (untagged) (4), other (2).

### One thing, tagged more than once

- Recurring titles whose occurrences do not all carry the same tags: 259 of 371. Occurrences of one title can differ in description and speakers.
- Groups of two or more tagged events with the same title, track, type, speakers and first 600 characters of description, which is what the tagger is sent: 331, over 1,125 events. Groups whose tags are not all the same: 231 (69.8%).

By field; the order of a list is not a difference, and untagged events are left out:

| field | recurring titles that differ | share | same-input groups that differ | share |
| --- | ---: | ---: | ---: | ---: |
| `topics` | 193 | 52.0% | 176 | 53.2% |
| `guests` | 111 | 29.9% | 102 | 30.8% |
| `fandoms` | 60 | 16.2% | 54 | 16.3% |
| `kind` | 17 | 4.6% | 10 | 3.0% |
| `adult` | 3 | 0.8% | 2 | 0.6% |

Top 30 by number of start times (the title shown is the group's most frequent spelling):

| title | kind | start times | events |
| --- | --- | ---: | ---: |
| `Brandish, , the duelist's card game (DEMO)` | gaming | 44 | 44 |
| `Shovel Knight: Dungeon Duels. Learn to play` | gaming | 22 | 22 |
| `Destroy Your Friends with Murder Hobo Tavern Brawl!` | gaming | 15 | 15 |
| `BARELY COPING? Play the Game! (17+)` | gaming | 14 | 14 |
| `Learn to Play Luminous Card Game` | gaming | 14 | 14 |
| `15-Minute Mentor Sessions` | panel | 12 | 12 |
| `Worn Wanderers Learn to Play` | gaming | 11 | 11 |
| `Urban Insanity` | gaming | 10 | 10 |
| `P&T: Beginner Workshop - Intro to Painting Miniatures` | workshop | 9 | 9 |
| `Author Signing` | signing | 8 | 8 |
| `Rose Tatu Productions Presents: Small Game Hour` | gaming | 8 | 8 |
| `DDLG LOG-LOI-09: Through the Fever and Fog` | gaming | 7 | 7 |
| `Joystick Gamebar Presents: FREE Arcade Games!!!` | gaming | 7 | 7 |
| `Battletech Classic - Boot Camp` | gaming | 6 | 6 |
| `D&D 5E: Arena Combat` | gaming | 6 | 6 |
| `D&D 5E: Ghost of Mistmoor - A Scooby Gang Adventure` | gaming | 6 | 6 |
| `D&D 5E: Shakedown in Sorenso` | gaming | 6 | 6 |
| `D&D 5E: The Gilded Zephyr - An Occult Noir Mystery` | gaming | 6 | 6 |
| `DDAL FR-DC-CGB-05: Orctoberfest` | gaming | 6 | 6 |
| `DDAL FR-DC-TDD-03: The Zephyr's Fold` | gaming | 6 | 6 |
| `DDLG LOG-LOI-07: Mud and Mushrooms` | gaming | 6 | 6 |
| `Gamma World 7E: Legion of Gold` | gaming | 6 | 6 |
| `Into the Lair: The Beast of Briar Ridge` | gaming | 6 | 6 |
| `Into the Lair: The Night Shift` | gaming | 6 | 6 |
| `Land & Sea Miniatures Game` | gaming | 6 | 6 |
| `Mothership: The Haunting of Ypsilon 14` | gaming | 6 | 6 |
| `Safe Mode Disabled: Con Crashers Adventure` | gaming | 6 | 6 |
| `Shadowrun 6E: Welcome to Goblin City` | gaming | 6 | 6 |
| `Warhammer the Old World: Thirst of Three` | gaming | 6 | 6 |
| `Artemis Spaceship Bridge Simulator` | gaming | 5 | 5 |

## 12. Observations

Facts from the sections above; at most ten.

- Events with no `tags` object: 10. The track with the most of them: Epic Photos (6).
- Events with no fandom: 67.6% of type gaming (588 of 870); 78.8% of type panel (2,039 of 2,589).
- 64 of 116 fandom names (55.2%) appear on one event; the five largest hold 52.7% of all fandom assignments.
- 4 fandom names are also entries in `TOPICS`: Anime, Comics, Animation, Fantasy.
- `other` is 0.6% of tagged events; the least used kind is `tour` (2).
- `guests` is `unknown` on 386 events; the kind with the most of them is `gaming` (224).
- "Mature Audience", the schedule's own marker, is in the text of 72 events, and `adult` is true on 104. Says so and tagged false: 1, of which 0 say it only past character 600 of the description, which the tagger never saw.
- 1,334 events (38.6%) have no speakers, and 981 events with speakers name more people in an "Additional Panelists:" line that `speakers` does not hold.
- 371 titles recur, over 1,254 events (36.3% of the schedule); most often the title's kind is `gaming` (172 titles). Of 331 groups of events that gave the tagger the same input, 231 do not all carry the same tags.
- 27 of 54 tracks have a single topic on more than 80% of their events; 104 descriptions run past the 600 characters the tagger was sent.

## Appendix A. Fandoms with one event

- Adventure Time
- Animation
- Baldur's Gate
- BattleTech
- Borderlands
- Buck Rogers in the 25th Century
- Chainsaw Man
- Deltarune
- Destiny
- Detective Conan
- Downton Abbey
- Dracula
- Dragon Age
- Dragon Ball Z
- Dragon Quest
- Fantasy
- Fire Emblem
- Flesh & Blood TCG
- Fortnite
- Frankenstein
- Fullmetal Alchemist
- Gargoyles
- Genshin Impact
- Ghostbusters
- Hades
- Jujutsu Kaisen
- Labyrinth
- League of Legends
- Mighty Morphin Power Rangers
- Mobile Suit Gundam
- Mortal Kombat
- Nirvanna the Band the Show
- Omori
- Outlander
- Pee Wee's Playhouse
- Persona
- Ponies
- RWBY
- Rent
- Rick and Morty
- Schitt's Creek
- Shadowrun
- Slay the Spire
- Spirited Away
- Tales of the Valiant
- Team Fortress 2
- Ted Lasso
- Teenage Mutant Ninja Turtles
- The Apothecary Diaries
- The Last of Us
- The Librarians
- The Princess Bride
- The Venture Bros
- The Walking Dead
- The Wheel of Time
- Twilight
- Upload
- Vikings
- Wheel of Time
- Witch Hat Atelier
- Xena: Warrior Princess
- Yellowjackets
- Yu-Gi-Oh!
- Zenless Zone Zero

## Appendix B. Every name on a `guests: celebrity` event

| name | celebrity events | all events |
| --- | ---: | ---: |
| Alan Tudyk | 16 | 16 |
| Tawny Newsome | 16 | 16 |
| Eugene Cordero | 15 | 15 |
| Jewel Staite | 14 | 14 |
| Anthony Montgomery | 13 | 13 |
| Connor Trinneer | 13 | 13 |
| Grace Park | 13 | 13 |
| Tricia Helfer | 13 | 13 |
| Dawnn Lewis | 12 | 12 |
| Jon Huertas | 12 | 13 |
| Melanie Scrofano | 12 | 12 |
| Nathan Fillion | 12 | 12 |
| Noël Wells | 12 | 12 |
| Seamus Dever | 12 | 13 |
| Alice Wetterlund | 11 | 11 |
| Levi Fiehler | 11 | 11 |
| Meredith Garretson | 11 | 11 |
| Patricia Tallman | 11 | 11 |
| Sara Tomko | 11 | 11 |
| Bruce Boxleitner | 10 | 10 |
| Cassidy Freeman | 10 | 10 |
| Dominic Keating | 10 | 10 |
| Jake Busey | 10 | 10 |
| Katee Sackhoff | 10 | 10 |
| Kathy Coleman | 10 | 10 |
| Mary McDonnell | 10 | 10 |
| Michael Ironside | 10 | 10 |
| Phil Paley | 10 | 10 |
| Richard Dean Anderson | 10 | 10 |
| Wesley Eure | 10 | 10 |
| Aaron Ashmore | 9 | 9 |
| Anson Mount | 9 | 9 |
| Ben Browder | 9 | 9 |
| Casper Van Dien | 9 | 9 |
| Celia Rose Gooding | 9 | 9 |
| Claudia Black | 9 | 10 |
| Denise Richards | 9 | 9 |
| Dina Meyer | 9 | 9 |
| Emily Andras | 9 | 10 |
| Gina Torres | 9 | 10 |
| Jess Bush | 9 | 9 |
| Julie Caitlin Brown | 9 | 10 |
| Kat Barrell | 9 | 9 |
| Michael Kovach | 9 | 11 |
| Michael Shanks | 9 | 9 |
| Summer Glau | 9 | 9 |
| Teryl Rothery | 9 | 9 |
| Tim Rozon | 9 | 9 |
| Varun Saranga | 9 | 9 |
| Amelia Tyler | 8 | 9 |
| Ashley Barrett | 8 | 9 |
| Becca Q. Co | 8 | 10 |
| Edward James Olmos | 8 | 8 |
| Erica Durance | 8 | 8 |
| Erin Yvette | 8 | 9 |
| Garrett Wang | 8 | 8 |
| James Callis | 8 | 8 |
| Jason Marnocha | 8 | 9 |
| Judy Alice Lee | 8 | 10 |
| Molly Quinn | 8 | 8 |
| Erin Gray | 7 | 7 |
| Hal Lublin | 7 | 8 |
| Lena Headey | 7 | 7 |
| Skye Redden | 7 | 10 |
| Tyler Labine | 7 | 7 |
| Aaron Douglas | 6 | 6 |
| Alex Rochon | 6 | 9 |
| Amanda Hufford | 6 | 9 |
| Courtney Eaton | 6 | 6 |
| Jack Quaid | 6 | 11 |
| Javier Prusky | 6 | 7 |
| Lisseth Chavez | 6 | 6 |
| Liz Callaway | 6 | 6 |
| Marissa Lenti | 6 | 9 |
| Mark Gagliardi | 6 | 7 |
| Peter Bramhill | 6 | 6 |
| Ross Marquand | 6 | 6 |
| Sean Astin | 6 | 6 |
| Sena Bryer | 6 | 6 |
| Viv Medrano | 6 | 6 |
| Brian Richardson | 5 | 6 |
| Doc Hammer | 5 | 5 |
| Dot R Steverson | 5 | 7 |
| Joey Davila | 5 | 6 |
| Ken Plume | 5 | 7 |
| Marc Lee | 5 | 7 |
| Nivek Ogre | 5 | 7 |
| Primetime Steve | 5 | 6 |
| Richard T Jones | 5 | 5 |
| Sammi Doneff | 5 | 5 |
| Shawn Ashmore | 5 | 7 |
| Symphony Sanders | 5 | 6 |
| Thomas Parham | 5 | 7 |
| Tom Welling | 5 | 6 |
| Bobby Blackwolf | 4 | 5 |
| Chuck Huber | 4 | 4 |
| Colby Smith | 4 | 5 |
| Crispy | 4 | 4 |
| Evie Templeton | 4 | 4 |
| Isaac Ordonez | 4 | 4 |
| James Saito | 4 | 4 |
| Jordan Morris | 4 | 5 |
| Kelsey Ann Brady | 4 | 4 |
| Kirk Thatcher | 4 | 5 |
| Manda Montane | 4 | 5 |
| Melissa O'Neil | 4 | 4 |
| Phil Parsons | 4 | 4 |
| Rob Roberts | 4 | 5 |
| Tony P Henderson | 4 | 8 |
| Alison Sealy-Smith | 3 | 3 |
| Aurelio Voltaire | 3 | 4 |
| Georgie Leahy | 3 | 3 |
| Gillian Vigman | 3 | 3 |
| Gui Agustini | 3 | 3 |
| Jason Marsden | 3 | 3 |
| Ken Napzok | 3 | 4 |
| Mark Meer | 3 | 7 |
| Mikal Mosley | 3 | 5 |
| Mike Kaess | 3 | 4 |
| Rob Levy | 3 | 8 |
| Rogue | 3 | 4 |
| Tay Samms | 3 | 5 |
| Tomer Capone | 3 | 5 |
| Aaron Michael Ritchey | 2 | 11 |
| Ben Singer Death Battle | 2 | 4 |
| Beth Patterson | 2 | 4 |
| Chad James Death Battle | 2 | 3 |
| Cruxshadows | 2 | 2 |
| Dad's Garage Theatre Co. | 2 | 6 |
| Dan Larson | 2 | 4 |
| Dave West | 2 | 7 |
| Delilah S Dawson | 2 | 13 |
| EmUnArum | 2 | 5 |
| Kevin Bachelder | 2 | 10 |
| Kevin Carlson | 2 | 9 |
| Kevin Eldridge | 2 | 9 |
| Kiki Falkanger | 2 | 5 |
| Matthew Waterson | 2 | 2 |
| Mike Phirman | 2 | 2 |
| Molly Abigail Coffee | 2 | 3 |
| Paris K Arrowsmith | 2 | 7 |
| Richard Lord British"" Garriott | 2 | 7 |
| Sean Weiland | 2 | 5 |
| Sherrilyn Kenyon | 2 | 9 |
| Sue Kisenwether | 2 | 11 |
| Thomas Sanders | 2 | 5 |
| Timothy Zahn | 2 | 9 |
| Victoria | 2 | 2 |
| Yaya Han | 2 | 4 |
| Alison Carrier | 1 | 6 |
| Alyssa Askani | 1 | 2 |
| Aretta Baumgartner | 1 | 8 |
| Austin Taylor | 1 | 6 |
| Austinn West | 1 | 1 |
| B. Dave Walters | 1 | 5 |
| Banachek | 1 | 4 |
| Bathroom of the Future | 1 | 1 |
| Berta Platas | 1 | 4 |
| Birma Gainor | 1 | 6 |
| Bit Brigade | 1 | 1 |
| Brian C. Thompson | 1 | 4 |
| Brobdingnagian Bards | 1 | 7 |
| CLOUDSAVE | 1 | 2 |
| Carol Malcolm | 1 | 2 |
| Catherine Lee Jones | 1 | 6 |
| Catieosaurus | 1 | 10 |
| Charles A Mcfall | 1 | 7 |
| Chris Moore | 1 | 1 |
| Chris Spears | 1 | 1 |
| Christine Papalexis | 1 | 11 |
| Crystal Cleveland | 1 | 9 |
| Curt Anderson | 1 | 7 |
| D.J. Butler | 1 | 4 |
| DCZev | 1 | 8 |
| DJ Ichabod | 1 | 3 |
| Denim Arcade | 1 | 2 |
| Dustin Fletcher | 1 | 4 |
| Elisa Teague | 1 | 6 |
| Emily Henry | 1 | 5 |
| Fon H Davis | 1 | 7 |
| Gabby | 1 | 1 |
| Galactic Empire | 1 | 1 |
| Gracie Palmer | 1 | 1 |
| Jason Gonding | 1 | 2 |
| Jazzmin Wilson | 1 | 3 |
| Jeni Green | 1 | 1 |
| Jenna Levine | 1 | 3 |
| Jessica Combs | 1 | 1 |
| Jim Butcher | 1 | 9 |
| Jonathan Coulton | 1 | 1 |
| Jonathan Sarge | 1 | 4 |
| Justin Lee Ford | 1 | 4 |
| Killbillies | 1 | 3 |
| Kyle Valle | 1 | 1 |
| Larry Niven | 1 | 4 |
| Last Grasp | 1 | 1 |
| Leanna Renee Hieber | 1 | 9 |
| Logan Jenkins | 1 | 7 |
| Lyndsay Ely | 1 | 5 |
| Martin Freepaw | 1 | 2 |
| Matt Smith | 1 | 1 |
| Matthew M Foster | 1 | 6 |
| MelodicBlue | 1 | 5 |
| Ming Chen | 1 | 2 |
| Mo Vermenton | 1 | 5 |
| Omega Jones | 1 | 6 |
| Paul and Storm | 1 | 1 |
| Psychostick | 1 | 1 |
| Raymond Carr | 1 | 8 |
| Rebecca Russell | 1 | 1 |
| Remy Dee | 1 | 1 |
| S. M. Stirling | 1 | 10 |
| Shayna Adelman | 1 | 3 |
| Sixth_Raikage_6 | 1 | 1 |
| Starr Long | 1 | 1 |
| Steve Saffel | 1 | 9 |
| The Cybertronic Spree | 1 | 1 |
| The Friggatriskaidekaphobia Treatment Nurse | 1 | 2 |
| The Tan and Sober Gentlemen | 1 | 1 |
| Tom Smith | 1 | 4 |
| ToniAnn Marini | 1 | 8 |
| Tony DiTerlizzi | 1 | 6 |
| Tracie Miss Magitek Hearne | 1 | 5 |
| Van Allen Plexico | 1 | 11 |
| Vikki Ortone | 1 | 1 |
