# Room census - the 2026 schedule read by the venues stage

Written by `tools/room_census.py` from `data/2026/events.json` (`generated_at` 2026-09-07T12:50:19+00:00) and `data/2026/venues.json`. Do not edit it by hand; run the script again.

A record, not held fresh by CI: an edit to the venues file leaves it stale until the script runs again. Every location of the schedule is read by the venues stage, `venues_stage.py` (DECISIONS #45), as build will read it - its split, then an alias, an exact room, the grammar's rules, a level, the hotel alone, or no place at a placeless hotel - and this report has no reading of its own. Section 4 is the curation worklist; an alias added to the venues file moves a string out of it. Lists run by events, descending, then by string; room strings are in code spans, so that their spacing and punctuation show, and a bare key's empty room string shows as (hotel only).

## 0. Headline

1. Events: 3,459, at 9 hotels; distinct readings of a room string: 177.
2. By place: `exact` 970 (28.0%), 38 strings; `alias` 0 (0.0%), 0 strings; `rule` 693 (20.0%), 54 strings; `level` 981 (28.4%), 20 strings; `hotel` 730 (21.1%), 53 strings; `none` 85 (2.5%), 12 strings.
3. The run's venue counters on this schedule: rooms unresolved 686 - the strings read at the hotel alone (section 4); hotels unknown 5 - the locations no key begins. Not counted: 44 events at an unplaced room of the venues file, read at its hotel, and the 981 events placed at a level, by design.
4. Split again: 2 events of a placeless hotel, read at a placed one (section 4).
5. Alias hits: 0 events, in 0 strings.
6. Rooms of the venues file: 218 on levels, and 1 unplaced room. Reached by a reading: 103; by none: 115 (section 5).

## 1. Hotels

Events by place, per hotel as the stage reads it: `exact`, a room of the venues file; `alias`, an alias of the file; `rule`, a rule of the grammar; `level`, a level and no room; `hotel`, the hotel alone; `none`, a placeless hotel. `strings` counts distinct readings.

| hotel | levels | rooms | events | strings | exact | alias | rule | level | hotel | none |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Marriott | 4 | 34 | 607 | 20 | 343 | 0 | 119 | 0 | 145 | 0 |
| Hyatt | 6 | 54 | 499 | 36 | 195 | 0 | 268 | 0 | 36 | 0 |
| Hilton | 6 | 68 | 739 | 36 | 334 | 0 | 210 | 0 | 195 | 0 |
| Courtland Grand | 1 | 2 | 151 | 9 | 52 | 0 | 0 | 0 | 99 | 0 |
| Westin | 8 | 54 | 309 | 19 | 14 | 0 | 56 | 20 | 219 | 0 |
| AmericasMart | 6 | 6 | 1,033 | 43 | 32 | 0 | 40 | 961 | 0 | 0 |
| Hardy Ivy Park | 0 | 0 | 36 | 2 | 0 | 0 | 0 | 0 | 36 | 0 |
| Streaming | 0 | 0 | 62 | 4 | 0 | 0 | 0 | 0 | 0 | 62 |
| Other | 0 | 0 | 23 | 8 | 0 | 0 | 0 | 0 | 0 | 23 |

- Hotels of the venues file with no events: Unknown.

## 2. The rules

Each rule of the grammar, in the order the stage tries it, with the strings and events it read: a string read by a chain of rules - a rewrite and then a rule - counts under each. The example is the rule's most frequent string.

| rule | example | strings | events |
| --- | --- | ---: | ---: |
| re-split | `Lobby` (Hyatt) | 2 | 2 |
| mart building | `Building 3, Floor 2` (AmericasMart) | 2 | 845 |
| mart vendor hall | `Vendor Hall Floor 1 The Missing Volume booth 1300` (AmericasMart) | 16 | 116 |
| mart room | `203E BERNINA/Atlanta Sewing Center - 3300` (AmericasMart) | 21 | 22 |
| numeric run | `212-214` (Hilton) | 9 | 241 |
| roman run | `Centennial II-IV` (Hyatt) | 3 | 57 |
| letter run | `Hanover C-E` (Hyatt) | 2 | 16 |
| number run | `Galleria 2-3` (Hilton) | 2 | 65 |
| letters together | `Hanover AB` (Hyatt) | 5 | 141 |
| number and letters | `203BC` (AmericasMart) | 1 | 18 |
| slash list | - | 0 | 0 |
| word pair | `International North-South` (Hyatt) | 1 | 5 |
| doubled | `Hanover C-E Hanover C-E` (Hyatt) | 1 | 2 |
| leading The | `The Learning Center` (Hyatt) | 1 | 17 |
| hotel initials | `H-Piedmont` (Hyatt) | 1 | 28 |
| partitions | `Atrium Ballroom` (Marriott) | 3 | 79 |
| hotel only | (hotel only) (Hyatt) | 2 | 4 |
| floor only | `14th Floor` (Westin) | 2 | 20 |
| trailing note | `Grand Hall C Black Phoenix Alchemy - Vendors - Booth 1419` (Hyatt) | 4 | 4 |

## 3. Room strings, hotel by hotel

The room string the stage read - the location less its hotel's key - with its place, its level and its rooms, and the rules that read it, or, at the hotel alone with none, why: an unplaced room, or no reading. The Mart shows its whole location as its room; the string here is what was read.

### Marriott - 607 events, 20 strings

| string | events | place | level | rooms | rules |
| --- | ---: | --- | --- | --- | --- |
| `International Hall South` | 318 | exact | international | `International Hall South` | - |
| `L401-L403` | 35 | rule | lobby | `L401`, `L402`, `L403` | numeric run |
| `Atrium Ballroom` | 32 | rule | atrium | `Atrium Ballroom A`, `Atrium Ballroom B`, `Atrium Ballroom C`, `Atrium Ballroom D` | partitions |
| `M103-M105` | 31 | hotel | - | - | no reading |
| `M302-M303` | 29 | rule | marquis | `M302`, `M303` | numeric run |
| `A706` | 26 | hotel | - | - | no reading |
| `A707` | 25 | hotel | - | - | no reading |
| `M301` | 25 | exact | marquis | `M301` | - |
| `Imperial Ballroom` | 22 | rule | marquis | `Imperial Ballroom A`, `Imperial Ballroom B` | partitions |
| `A704` | 21 | hotel | - | - | no reading |
| `A601-A602` | 19 | hotel | - | - | no reading |
| `A703` | 10 | hotel | - | - | no reading |
| `A708` | 5 | hotel | - | - | no reading |
| `10th` | 3 | hotel | - | - | no reading |
| `Imperial Ballroom` | 1 | rule | marquis | `Imperial Ballroom A`, `Imperial Ballroom B` | re-split + partitions |
| `Marquis` | 1 | hotel | - | - | no reading |
| `Marquis Foyer` | 1 | hotel | - | - | no reading |
| `Marquis Foyer Near Salon D doors` | 1 | hotel | - | - | no reading |
| `Skyline South- 10th Floor` | 1 | hotel | - | - | no reading |
| `Walk of Fame` | 1 | hotel | - | - | no reading |

### Hyatt - 499 events, 36 strings

| string | events | place | level | rooms | rules |
| --- | ---: | --- | --- | --- | --- |
| `Hanover AB` | 31 | rule | exhibit | `Hanover A`, `Hanover B` | letters together |
| `Concourse` | 30 | hotel | - | - | no reading |
| `Embassy EF` | 30 | rule | tower-ll2 | `Embassy E`, `Embassy F` | letters together |
| `Hanover FG` | 30 | rule | exhibit | `Hanover F`, `Hanover G` | letters together |
| `Centennial II-IV` | 29 | rule | ballroom | `Centennial II`, `Centennial III`, `Centennial IV` | roman run |
| `H-Piedmont` | 28 | rule | acc | `Piedmont` | hotel initials |
| `Embassy CD` | 26 | rule | tower-ll2 | `Embassy C`, `Embassy D` | letters together |
| `Regency VI-VII` | 26 | rule | ballroom | `Regency VI`, `Regency VII` | roman run |
| `Inman` | 25 | exact | acc | `Inman` | - |
| `Embassy AB` | 24 | rule | tower-ll2 | `Embassy A`, `Embassy B` | letters together |
| `Centennial I` | 20 | exact | ballroom | `Centennial I` | - |
| `International North` | 17 | exact | tower-ll1 | `International North` | - |
| `Spring` | 17 | exact | acc | `Spring` | - |
| `The Learning Center` | 17 | rule | ballroom | `Learning Center` | leading The |
| `Grand Hall C` | 15 | exact | exhibit | `Grand Hall C` | - |
| `International South` | 15 | exact | tower-ll1 | `International South` | - |
| `Marietta` | 15 | exact | acc | `Marietta` | - |
| `Hanover C-E` | 14 | rule | exhibit | `Hanover C`, `Hanover D`, `Hanover E` | letter run |
| `Embassy G` | 13 | exact | tower-ll2 | `Embassy G` | - |
| `Regency V` | 13 | exact | ballroom | `Regency V` | - |
| `Grand Hall D` | 12 | exact | exhibit | `Grand Hall D` | - |
| `Roswell` | 10 | exact | acc | `Roswell` | - |
| `Techwood` | 10 | exact | acc | `Techwood` | - |
| `Kennesaw` | 9 | exact | acc | `Kennesaw` | - |
| `International North-South` | 5 | rule | tower-ll1 | `International North`, `International South` | word pair |
| `Vinings` | 4 | exact | acc | `Vinings` | - |
| (hotel only) | 3 | hotel | - | - | hotel only |
| `Centennial I-IV` | 2 | rule | ballroom | `Centennial I`, `Centennial II`, `Centennial III`, `Centennial IV` | roman run |
| `Hanover C-E Hanover C-E` | 2 | rule | exhibit | `Hanover C`, `Hanover D`, `Hanover E` | doubled + letter run |
| `Centennial II-IV Table outside the room` | 1 | hotel | - | - | no reading |
| `Grand Hall C Black Phoenix Alchemy - Vendors - Booth 1419` | 1 | rule | exhibit | `Grand Hall C` | trailing note |
| `Grand Hall D Poole Booth 111 for more info!!` | 1 | rule | exhibit | `Grand Hall D` | trailing note |
| `Grand Hall D Poole booth 111 for more information` | 1 | rule | exhibit | `Grand Hall D` | trailing note |
| `Grand Hall D Sponsored By Copic` | 1 | rule | exhibit | `Grand Hall D` | trailing note |
| `Grand Hall Main Floor` | 1 | hotel | - | - | no reading |
| `Lobby` | 1 | hotel | - | - | re-split |

### Hilton - 739 events, 36 strings

| string | events | place | level | rooms | rules |
| --- | ---: | --- | --- | --- | --- |
| `202` | 45 | exact | l2 | `202` | - |
| `Steps B` | 44 | hotel | - | - | unplaced |
| `203` | 43 | exact | l2 | `203` | - |
| `Galleria 5` | 41 | exact | galleria | `Galleria 5` | - |
| `Steps A` | 37 | hotel | - | - | no reading |
| `Galleria 6` | 36 | exact | galleria | `Galleria 6` | - |
| `212-214` | 35 | rule | l2 | `212`, `213`, `214` | numeric run |
| `Galleria 2-3` | 33 | rule | galleria | `Galleria 2`, `Galleria 3` | number run |
| `313-314` | 32 | rule | l3 | `313`, `314` | numeric run |
| `209-211` | 31 | rule | l2 | `209`, `210`, `211` | numeric run |
| `Steps E` | 31 | hotel | - | - | no reading |
| `Galleria 7` | 30 | exact | galleria | `Galleria 7` | - |
| `Crystal Ballroom` | 29 | hotel | - | - | no reading |
| `302-304` | 28 | rule | l3 | `302`, `303`, `304` | numeric run |
| `Galleria 1` | 27 | exact | galleria | `Galleria 1` | - |
| `204-207` | 26 | rule | l2 | `204`, `205`, `206`, `207` | numeric run |
| `Galleria 4` | 26 | exact | galleria | `Galleria 4` | - |
| `309-312` | 21 | rule | l3 | `309`, `310`, `311`, `312` | numeric run |
| `Grand East` | 21 | exact | l2 | `Grand East` | - |
| `Salon` | 21 | hotel | - | - | no reading |
| `Steps G` | 20 | hotel | - | - | no reading |
| `Grand West` | 19 | exact | l2 | `Grand West` | - |
| `Galleria 8` | 18 | exact | galleria | `Galleria 8` | - |
| `301` | 7 | exact | l3 | `301` | - |
| `307` | 7 | exact | l3 | `307` | - |
| `306` | 6 | exact | l3 | `306` | - |
| `3rd floor outside deck` | 6 | hotel | - | - | no reading |
| `404-405` | 4 | rule | l4 | `404`, `405` | numeric run |
| `305` | 3 | exact | l3 | `305` | - |
| `308` | 3 | exact | l3 | `308` | - |
| `5th` | 3 | hotel | - | - | no reading |
| `315` | 2 | exact | l3 | `315` | - |
| `12th` | 1 | hotel | - | - | no reading |
| `212-214 Hilton, 3rd floor outdoor deck` | 1 | hotel | - | - | no reading |
| `Crystal Ballroom Crystal Ballroom` | 1 | hotel | - | - | no reading |
| `Galleria 2-3 Hallway Just outside Galleria 2-3` | 1 | hotel | - | - | no reading |

### Courtland Grand - 151 events, 9 strings

| string | events | place | level | rooms | rules |
| --- | ---: | --- | --- | --- | --- |
| `Athens` | 35 | exact | unknown | `Athens` | - |
| `Macon` | 30 | hotel | - | - | no reading |
| `Augusta` | 23 | hotel | - | - | no reading |
| `Atlanta 1-2` | 19 | hotel | - | - | no reading |
| `Capitol Ballroom` | 17 | exact | unknown | `Capitol Ballroom` | - |
| `Atlanta 3-4` | 14 | hotel | - | - | no reading |
| `CG-Grand Ballroom A-F` | 11 | hotel | - | - | no reading |
| `CG-Grand Ballroom A-F Hallway Table near Grand section B` | 1 | hotel | - | - | no reading |
| `Pool and Courtyard` | 1 | hotel | - | - | no reading |

### Westin - 309 events, 19 strings

| string | events | place | level | rooms | rules |
| --- | ---: | --- | --- | --- | --- |
| `Chastain 1-2` | 32 | rule | chastain | `Chastain 1`, `Chastain 2` | number run |
| `Augusta E-H` | 28 | hotel | - | - | no reading |
| `Chastain DE` | 28 | hotel | - | - | no reading |
| `Peachtree 1-2` | 25 | hotel | - | - | no reading |
| `Peachtree Ballroom` | 24 | rule | f8 | `Peachtree Ballroom A`, `Peachtree Ballroom B`, `Peachtree Ballroom C`, `Peachtree Ballroom D`, `Peachtree Ballroom E`, `Peachtree Ballroom F` | partitions |
| `Chastain F` | 21 | hotel | - | - | no reading |
| `Augusta 1-2` | 20 | hotel | - | - | no reading |
| `Augusta A-B` | 20 | hotel | - | - | no reading |
| `Chastain H-I-J` | 20 | hotel | - | - | no reading |
| `Augusta 3` | 16 | hotel | - | - | no reading |
| `Augusta C-D` | 15 | hotel | - | - | no reading |
| `Chastain G` | 14 | hotel | - | - | no reading |
| `Overlook` | 14 | exact | f6 | `Overlook` | - |
| `14th Floor` | 12 | level | f14 | - | floor only |
| `12th Floor` | 8 | level | f12 | - | floor only |
| `Augusta C` | 5 | hotel | - | - | no reading |
| `Augusta D` | 5 | hotel | - | - | no reading |
| (hotel only) | 1 | hotel | - | - | hotel only |
| `Savannah Ballroom B/C` | 1 | hotel | - | - | no reading |

### AmericasMart - 1,033 events, 43 strings

| string | events | place | level | rooms | rules |
| --- | ---: | --- | --- | --- | --- |
| `Building 3, Floor 2` | 463 | level | b3f2 | - | mart building |
| `Building 3, Floor 1` | 382 | level | b3f1 | - | mart building |
| `Vendor Hall Floor 1 The Missing Volume booth 1300` | 62 | level | b2-vendor-f1 | - | mart vendor hall |
| `203BC` | 18 | rule | b2-rooms | `203B`, `203C` | number and letters |
| `204J` | 18 | exact | b2-rooms | `204J` | - |
| `Vendor Hall Floor 3 Sidestreet Book Market - booth 3201` | 18 | level | b2-vendor-f3 | - | mart vendor hall |
| `203A` | 13 | exact | b2-rooms | `203A` | - |
| `Vendor Hall Floor 3 Aethon Books booth 3500` | 12 | level | b2-vendor-f3 | - | mart vendor hall |
| `Vendor Hall Floor 2 The Marigolden Bookshelf - booth 2506` | 10 | level | b2-vendor-f2 | - | mart vendor hall |
| `Vendor Hall Floor 2 Scorched Design - booth 2105` | 3 | level | b2-vendor-f2 | - | mart vendor hall |
| `203E BERNINA/Atlanta Sewing Center - 3300` | 2 | rule | b2-rooms | `203E` | mart room |
| `203D` | 1 | exact | b2-rooms | `203D` | - |
| `203D AllTru2U - booth #2626` | 1 | rule | b2-rooms | `203D` | mart room |
| `203D ArtCarp - James Farmer - booth # 1718` | 1 | rule | b2-rooms | `203D` | mart room |
| `203D ArtCarp - booth # 1718` | 1 | rule | b2-rooms | `203D` | mart room |
| `203D Bats in the Belfry Goods/ Nightwing Brooms Table-E` | 1 | rule | b2-rooms | `203D` | mart room |
| `203D Black Phoenix Alchemy Lab - booth 1417/1419` | 1 | rule | b2-rooms | `203D` | mart room |
| `203D By Quiltoni booth #3230` | 1 | rule | b2-rooms | `203D` | mart room |
| `203D Cut/Sew booth # 2720` | 1 | rule | b2-rooms | `203D` | mart room |
| `203D Maddy with Cut/Sew - booth # 2720` | 1 | rule | b2-rooms | `203D` | mart room |
| `203D Paperbones - Table # B75` | 1 | rule | b2-rooms | `203D` | mart room |
| `203D The Evergreen Burrow - booth # 2627` | 1 | rule | b2-rooms | `203D` | mart room |
| `203D by STL Ocarina - booth #2404` | 1 | rule | b2-rooms | `203D` | mart room |
| `203E By BERNINA-booth 3300, Oliso-booth 3307` | 1 | rule | b2-rooms | `203E` | mart room |
| `203E By Bernina booth-3300/Atlanta Sewing Center` | 1 | rule | b2-rooms | `203E` | mart room |
| `203E Room By BERNINA - 3300 & Oliso-3307` | 1 | rule | b2-rooms | `203E` | mart room |
| `203E Room by BERNINA/Atlanta Sewing Center- 3300` | 1 | rule | b2-rooms | `203E` | mart room |
| `203E Room by Bernina booth 3300/ Oliso-3307` | 1 | rule | b2-rooms | `203E` | mart room |
| `203E Room by Bernina booth 3300/Atlanta Sewing Center` | 1 | rule | b2-rooms | `203E` | mart room |
| `203E Room by Bernina booth 3300/Oliso-booth 3307` | 1 | rule | b2-rooms | `203E` | mart room |
| `203E Room by: BERNINA/Atlanta Sewing Center - 3300` | 1 | rule | b2-rooms | `203E` | mart room |
| `203E Room by:BERNINA/Atlanta Sewing Center -Booth: 3300` | 1 | rule | b2-rooms | `203E` | mart room |
| `Vendor Hall Floor 1 The MIssing Volume booth 1300` | 1 | level | b2-vendor-f1 | - | mart vendor hall |
| `Vendor Hall Floor 1 The Missing Volume - booth 1300` | 1 | level | b2-vendor-f1 | - | mart vendor hall |
| `Vendor Hall Floor 1 The Missing Volume Booth 1300` | 1 | level | b2-vendor-f1 | - | mart vendor hall |
| `Vendor Hall Floor 1 The Missing Voume booth 1300` | 1 | level | b2-vendor-f1 | - | mart vendor hall |
| `Vendor Hall Floor 2 J&J Collectables - Booth #2529` | 1 | level | b2-vendor-f2 | - | mart vendor hall |
| `Vendor Hall Floor 2 J&J Collectables - booth # 2529` | 1 | level | b2-vendor-f2 | - | mart vendor hall |
| `Vendor Hall Floor 2 J&J Collectibles - booth #2529` | 1 | level | b2-vendor-f2 | - | mart vendor hall |
| `Vendor Hall Floor 2 J&J Collectibles booth 2529` | 1 | level | b2-vendor-f2 | - | mart vendor hall |
| `Vendor Hall Floor 2 Scorched Design - Booth 2105` | 1 | level | b2-vendor-f2 | - | mart vendor hall |
| `Vendor Hall Floor 2 The Marigolden Bookshelf - Booth 2506` | 1 | level | b2-vendor-f2 | - | mart vendor hall |
| `Vendor Hall Floor 3 Sidestreet Book Market - book 3201` | 1 | level | b2-vendor-f3 | - | mart vendor hall |

### Hardy Ivy Park - 36 events, 2 strings

| string | events | place | level | rooms | rules |
| --- | ---: | --- | --- | --- | --- |
| `Ivy Structure` | 35 | hotel | - | - | no reading |
| `Terraces` | 1 | hotel | - | - | no reading |

### Streaming - 62 events, 4 strings

| string | events | place | level | rooms | rules |
| --- | ---: | --- | --- | --- | --- |
| `STRM_TWITCH https://www.twitch.tv/dcdigitalmedia` | 29 | none | - | - | - |
| `STRM_TWITCH https://www.twitch.tv/dcdigitalmedia2` | 25 | none | - | - | - |
| `STRM_FBL https://www.facebook.com/DCUrbanFantasy` | 7 | none | - | - | - |
| `STRM_FBL` | 1 | none | - | - | - |

### Other - 23 events, 8 strings

| string | events | place | level | rooms | rules |
| --- | ---: | --- | --- | --- | --- |
| `Joystick Gamebar` | 10 | none | - | - | - |
| `Walton Spring Park` | 3 | none | - | - | - |
| `Georgia Aquarium` | 2 | none | - | - | - |
| `Offsite Center for Puppetry Arts` | 2 | none | - | - | - |
| `Parade` | 2 | none | - | - | - |
| `Peachtree Plaza` | 2 | none | - | - | - |
| (hotel only) | 1 | none | - | - | - |
| `200 Peachtree Whitehall Ballroom` | 1 | none | - | - | - |

## 4. The worklist

### Read at the hotel alone - rooms unresolved, 686

No reading, or the hotel alone: counted by the run as rooms unresolved. An alias, a room or a key in the venues file is what moves one.

| hotel | string | events | why |
| --- | --- | ---: | --- |
| Hilton | `Steps A` | 37 | no reading |
| Hardy Ivy Park | `Ivy Structure` | 35 | no reading |
| Hilton | `Steps E` | 31 | no reading |
| Marriott | `M103-M105` | 31 | no reading |
| Courtland Grand | `Macon` | 30 | no reading |
| Hyatt | `Concourse` | 30 | no reading |
| Hilton | `Crystal Ballroom` | 29 | no reading |
| Westin | `Augusta E-H` | 28 | no reading |
| Westin | `Chastain DE` | 28 | no reading |
| Marriott | `A706` | 26 | no reading |
| Marriott | `A707` | 25 | no reading |
| Westin | `Peachtree 1-2` | 25 | no reading |
| Courtland Grand | `Augusta` | 23 | no reading |
| Hilton | `Salon` | 21 | no reading |
| Marriott | `A704` | 21 | no reading |
| Westin | `Chastain F` | 21 | no reading |
| Hilton | `Steps G` | 20 | no reading |
| Westin | `Augusta 1-2` | 20 | no reading |
| Westin | `Augusta A-B` | 20 | no reading |
| Westin | `Chastain H-I-J` | 20 | no reading |
| Courtland Grand | `Atlanta 1-2` | 19 | no reading |
| Marriott | `A601-A602` | 19 | no reading |
| Westin | `Augusta 3` | 16 | no reading |
| Westin | `Augusta C-D` | 15 | no reading |
| Courtland Grand | `Atlanta 3-4` | 14 | no reading |
| Westin | `Chastain G` | 14 | no reading |
| Courtland Grand | `CG-Grand Ballroom A-F` | 11 | no reading |
| Marriott | `A703` | 10 | no reading |
| Hilton | `3rd floor outside deck` | 6 | no reading |
| Marriott | `A708` | 5 | no reading |
| Westin | `Augusta C` | 5 | no reading |
| Westin | `Augusta D` | 5 | no reading |
| Hilton | `5th` | 3 | no reading |
| Hyatt | (hotel only) | 3 | hotel only |
| Marriott | `10th` | 3 | no reading |
| Courtland Grand | `CG-Grand Ballroom A-F Hallway Table near Grand section B` | 1 | no reading |
| Courtland Grand | `Pool and Courtyard` | 1 | no reading |
| Hardy Ivy Park | `Terraces` | 1 | no reading |
| Hilton | `12th` | 1 | no reading |
| Hilton | `212-214 Hilton, 3rd floor outdoor deck` | 1 | no reading |
| Hilton | `Crystal Ballroom Crystal Ballroom` | 1 | no reading |
| Hilton | `Galleria 2-3 Hallway Just outside Galleria 2-3` | 1 | no reading |
| Hyatt | `Centennial II-IV Table outside the room` | 1 | no reading |
| Hyatt | `Grand Hall Main Floor` | 1 | no reading |
| Hyatt | `Lobby` | 1 | no reading |
| Marriott | `Marquis` | 1 | no reading |
| Marriott | `Marquis Foyer` | 1 | no reading |
| Marriott | `Marquis Foyer Near Salon D doors` | 1 | no reading |
| Marriott | `Skyline South- 10th Floor` | 1 | no reading |
| Marriott | `Walk of Fame` | 1 | no reading |
| Westin | (hotel only) | 1 | hotel only |
| Westin | `Savannah Ballroom B/C` | 1 | no reading |

### Unplaced rooms, read at their hotel

Rooms the venues file knows but places on no level: read at their hotel, and not counted as unresolved.

| hotel | string | events |
| --- | --- | ---: |
| Hilton | `Steps B` | 44 |

### Locations no key begins - hotels unknown, 5

Placed at Other, no place. Where a placed hotel's name holds the string, it is a candidate key of that hotel.

| location | events | note |
| --- | ---: | --- |
| `Walton Spring Park` | 3 | - |
| `Peachtree Plaza` | 2 | a candidate Westin key |

### Placeless locations split again

A placeless hotel's room string that begins with a placed hotel's key - its own key again aside - read at that hotel: the source's habit of writing a hotel inside an offsite location.

| location | read at | string | place | events |
| --- | --- | --- | ---: | ---: |
| `O Other Hyatt Lobby` | Hyatt | `Lobby` | hotel | 1 |
| `O Other Marriott, Imperial Ballroom` | Marriott | `Imperial Ballroom` | rule | 1 |

## 5. Rooms of the venues file no string reaches

Per level, the rooms a reading names - exactly, by an alias or by a rule - and those none names. The notes on the levels, and the unplaced rooms, are listed after.

| hotel | level | rooms | reached | not reached |
| --- | --- | ---: | ---: | --- |
| Marriott | International Level (`international`) | 15 | 1 | `International 1`, `International 2`, `International 3`, `International 4`, `International 5`, `International 6`, `International 7`, `International 8`, `International 9`, `International 10`, `International A`, `International B`, `International C`, `International Hall North` |
| Marriott | Marquis Level (`marquis`) | 9 | 5 | `Marquis Ballroom A`, `Marquis Ballroom B`, `Marquis Ballroom C`, `Marquis Ballroom D` |
| Marriott | Lobby Level (`lobby`) | 6 | 3 | `L404`, `L405`, `L406` |
| Marriott | Atrium Level (`atrium`) | 4 | 4 | - |
| Hyatt | Atlanta Conference Center (LL3) (`acc`) | 20 | 8 | `Auburn`, `Baker`, `Courtland`, `Dunwoody`, `Edgewood`, `Fairlie`, `Greenbriar`, `Harris`, `Heritage Boardroom`, `Lenox`, `University`, `Williams` |
| Hyatt | Exhibit Level (LL2) (`exhibit`) | 16 | 9 | `Grand Hall A`, `Grand Hall B`, `Chicago A`, `Chicago B`, `Chicago C`, `Chicago D`, `Chicago E` |
| Hyatt | Ballroom Level (LL1) (`ballroom`) | 8 | 8 | - |
| Hyatt | International Tower · LL2 (`tower-ll2`) | 8 | 7 | `Embassy H` |
| Hyatt | International Tower · LL1 (`tower-ll1`) | 2 | 2 | - |
| Hilton | Galleria (`galleria`) | 8 | 8 | - |
| Hilton | Level 1 (`l1`) | 6 | 0 | `Crystal A`, `Crystal B`, `Crystal C`, `Crystal D`, `Crystal E`, `Crystal F` |
| Hilton | Level 2 (`l2`) | 32 | 14 | `201`, `208`, `215`, `216`, `217`, `218`, `219`, `220`, `221`, `222`, `223`, `224`, `Grand Ballroom A`, `Grand Ballroom B`, `Grand Ballroom C`, `Grand Ballroom D`, `Salon East`, `Salon West` |
| Hilton | Level 3 (`l3`) | 15 | 15 | - |
| Hilton | Level 4 (`l4`) | 7 | 2 | `401`, `402`, `403`, `406`, `407` |
| Courtland Grand | levels unknown (`unknown`) | 2 | 2 | - |
| Westin | Chastain (level unknown) (`chastain`) | 2 | 2 | - |
| Westin | Sixth Floor (`f6`) | 14 | 1 | `International`, `International Boardroom`, `American`, `Vinings I`, `Vinings II`, `A`, `B`, `C`, `D`, `E`, `F`, `G`, `H` |
| Westin | Seventh Floor (`f7`) | 9 | 0 | `Augusta I`, `Augusta II`, `Augusta III`, `Atlanta Ballroom A`, `Atlanta Ballroom B`, `Atlanta Ballroom C`, `Atlanta Ballroom D`, `Atlanta Ballroom E`, `Atlanta Ballroom F` |
| Westin | Eighth Floor (`f8`) | 8 | 6 | `Roswell I`, `Roswell II` |
| Westin | Ninth Floor (`f9`) | 2 | 0 | `Peachtree G`, `Peachtree H` |
| Westin | Tenth Floor (`f10`) | 3 | 0 | `Plaza Ballroom A`, `Plaza Ballroom B`, `Plaza Ballroom C` |
| Westin | Twelfth Floor (`f12`) | 8 | 0 | `1201`, `1202`, `1203`, `1204`, `1205`, `1206`, `1207`, `1208` |
| Westin | Fourteenth Floor (`f14`) | 8 | 0 | `1401`, `1402`, `1403`, `1404`, `1405`, `1406`, `1407`, `1408` |
| AmericasMart | Building 2, meeting rooms (`b2-rooms`) | 6 | 6 | - |

Notes on the levels:

- Marriott, Marquis Level (`marquis`): `room codes carry the level: M = Marquis`
- Marriott, Marquis Level (`marquis`): `M101-M109 (confirm the run)`
- Marriott, Marquis Level (`marquis`): `M2xx (confirm)`
- Marriott, Marquis Level (`marquis`): `M304 (confirm the run)`
- Marriott, Lobby Level (`lobby`): `L = Lobby`
- Marriott, Atrium Level (`atrium`): `A = Atrium`
- Marriott, Atrium Level (`atrium`): `A601-A602 … A707 (confirm the runs)`
- Hyatt, Lobby Level (`lobby`): `registration and the atrium; no programming rooms known`
- Hyatt, International Tower · LL2 (`tower-ll2`): `two levels below the lobby, in the International Tower; reached from the ACC`
- Hilton, Galleria (`galleria`): `directly under the lobby; Galleria 1-8 are the hotel's own partitions`
- Hilton, Lobby (`lobby`): `escalators up to Level 2`
- Courtland Grand, levels unknown (`unknown`): `(55 meeting rooms in two towers; list unknown)`
- Westin, Chastain (level unknown) (`chastain`): `Chastain A … J (confirm)`

Unplaced rooms:

- Hilton: `Steps B` - a Dragon Con name, not the hotel's; level unknown
