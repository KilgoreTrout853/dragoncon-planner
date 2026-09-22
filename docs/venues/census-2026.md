# Room census - the 2026 schedule against the venues registry

Written by `tools/room_census.py` from `data/2026/events.json` (`generated_at` 2026-09-07T12:50:19+00:00) and `docs/venues/registry.json` (version 2026-09-18). Do not edit it by hand; run the script again.

A record, not held fresh by CI: an edit to the registry leaves it stale until the script runs again. It states facts and changes nothing. A room string matches a registry room exactly, case-folded, or it does not; every other reading here is a proposal, `UNSURE`, and applied to nothing - the registry, its `seen_2026` and the scraper are as they were. The combined-string rules and the other shapes are counted apart. Lists run by count, descending, then by string; room strings are in code spans, so that their spacing and punctuation show.

## 0. Headline

1. Events: 3,459, at 9 hotel values; distinct (hotel, room) strings: 180.
2. An exact registry match: 34 strings, 929 events (26.9%).
3. A combined-string rule alone, UNSURE: 31 strings, 728 events (21.0%). One of the other shapes, UNSURE: 37 strings, 376 events (10.9%).
4. No reading: 78 strings, 1,426 events (41.2%).
5. Hotels in the file and not in the registry: Streaming (62 events), Other (25 events). In the registry with no rooms: AmericasMart (1,033 events), Hardy Ivy Park (36 events). `Unknown`: 0 events.
6. The Courtland prefix: 151 of 151 Courtland Grand events, 9 of 9 strings (section 6).
7. Registry rooms: 213, besides 6 entries that hold a note. Matched exactly: 34. Named only by a proposal: 73. Neither: 106.
8. `split_hotel(location)` gives the stored hotel and room for 3,459 of 3,459 events.

## 1. Hotels

Events by how their room string reads: `exact`, an exact registry match; `combined`, a combined-string rule alone; `shape`, one of the other shapes, alone or with a combined rule; `none`, no reading. `combined` and `shape` are proposals, UNSURE.

| hotel | in the registry | levels | rooms | events | strings | exact | combined | shape | none |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| AmericasMart | yes | 1 | 0 | 1,033 | 43 | 0 | 18 | 0 | 1,015 |
| Hilton | yes | 6 | 69 | 739 | 37 | 378 | 210 | 28 | 123 |
| Marriott | yes | 4 | 34 | 606 | 20 | 343 | 114 | 60 | 89 |
| Hyatt | yes | 6 | 54 | 498 | 36 | 194 | 217 | 55 | 32 |
| Westin | yes | 8 | 54 | 309 | 19 | 14 | 169 | 81 | 45 |
| Courtland Grand | yes | 1 | 2 | 151 | 9 | 0 | 0 | 151 | 0 |
| Streaming | no | - | - | 62 | 4 | 0 | 0 | 0 | 62 |
| Hardy Ivy Park | yes | 0 | 0 | 36 | 2 | 0 | 0 | 0 | 36 |
| Other | no | - | - | 25 | 10 | 0 | 0 | 1 | 24 |

- Registry hotels with no events: none. `Unknown`, the scraper's hotel for an empty location: 0 events.

## 2. The readings

Every reading is UNSURE. A string takes each rewrite that fits it - the Courtland prefix, a doubled string, a hotel prefix, a leading "The", in that order - and then one reading: an exact match, a combined-string rule, partitions, the hotel alone, a floor alone, or a room and a trailing note. Last, a room the registry lacks is tried with its number written the other way (numeral style). A string counts under each rule it takes; the example is the rule's most frequent string.

| rule | kind | example | strings | events |
| --- | --- | --- | ---: | ---: |
| numeric run | combined string | `212-214` (Hilton) | 12 | 292 |
| roman run | combined string | `Centennial II-IV` (Hyatt) | 4 | 58 |
| letter run | combined string | `Augusta E-H` (Westin) | 8 | 111 |
| number run | combined string | `Galleria 2-3` (Hilton) | 7 | 144 |
| letters together | combined string | `Hanover AB` (Hyatt) | 6 | 169 |
| number and letters | combined string | `Mart2 203BC` (AmericasMart) | 1 | 18 |
| slash list | combined string | `Savannah Ballroom B/C` (Westin) | 1 | 1 |
| word pair | combined string | `International North-South` (Hyatt) | 1 | 5 |
| Courtland prefix | other shape | `Grand Athens` (Courtland Grand) | 9 | 151 |
| doubled | other shape | `Hanover C-E Hanover C-E` (Hyatt) | 2 | 3 |
| hotel prefix | other shape | `H-Piedmont` (Hyatt) | 5 | 44 |
| leading The | other shape | `The Learning Center` (Hyatt) | 1 | 17 |
| partitions | other shape | `Atrium Ballroom` (Marriott) | 6 | 100 |
| hotel only | other shape | `Hyatt` (Hyatt) | 3 | 5 |
| floor only | other shape | `14th Floor` (Westin) | 5 | 27 |
| trailing note | other shape | `Grand CG-Grand Ballroom A-F Hallway Table near Grand section B` (Courtland Grand) | 8 | 8 |
| numeral style | other shape | `Augusta 1-2` (Westin) | 2 | 36 |

## 3. Room strings, hotel by hotel

`exact` is the level of an exact registry match. `reading` is a proposal, UNSURE: the rules a string took and the rooms it names. `in the registry` counts those rooms in the registry, and where they are; for a string with no reading, whether a registry entry that holds a note names it.

### AmericasMart - 1,033 events, 43 strings

In the registry with no rooms: its one level lists none.

| string | events | exact | reading (UNSURE) | in the registry |
| --- | ---: | --- | --- | --- |
| `Mart Building 3, Floor 2` | 463 | - | - | - |
| `Mart Building 3, Floor 1` | 382 | - | - | - |
| `Mart2 Vendor Hall Floor 1 The Missing Volume booth 1300` | 62 | - | - | - |
| `Mart2 203BC` | 18 | - | number and letters → `Mart2 203B`, `Mart2 203C` | 0 of 2 |
| `Mart2 204J` | 18 | - | - | - |
| `Mart2 Vendor Hall Floor 3 Sidestreet Book Market - booth 3201` | 18 | - | - | - |
| `Mart2 203A` | 13 | - | - | - |
| `Mart2 Vendor Hall Floor 3 Aethon Books booth 3500` | 12 | - | - | - |
| `Mart2 Vendor Hall Floor 2 The Marigolden Bookshelf - booth 2506` | 10 | - | - | - |
| `Mart2 Vendor Hall Floor 2 Scorched Design - booth 2105` | 3 | - | - | - |
| `Mart2 203E BERNINA/Atlanta Sewing Center - 3300` | 2 | - | - | - |
| `Mart2 203D` | 1 | - | - | - |
| `Mart2 203D AllTru2U - booth #2626` | 1 | - | - | - |
| `Mart2 203D ArtCarp - James Farmer - booth # 1718` | 1 | - | - | - |
| `Mart2 203D ArtCarp - booth # 1718` | 1 | - | - | - |
| `Mart2 203D Bats in the Belfry Goods/ Nightwing Brooms Table-E` | 1 | - | - | - |
| `Mart2 203D Black Phoenix Alchemy Lab - booth 1417/1419` | 1 | - | - | - |
| `Mart2 203D By Quiltoni booth #3230` | 1 | - | - | - |
| `Mart2 203D Cut/Sew booth # 2720` | 1 | - | - | - |
| `Mart2 203D Maddy with Cut/Sew - booth # 2720` | 1 | - | - | - |
| `Mart2 203D Paperbones - Table # B75` | 1 | - | - | - |
| `Mart2 203D The Evergreen Burrow - booth # 2627` | 1 | - | - | - |
| `Mart2 203D by STL Ocarina - booth #2404` | 1 | - | - | - |
| `Mart2 203E By BERNINA-booth 3300, Oliso-booth 3307` | 1 | - | - | - |
| `Mart2 203E By Bernina booth-3300/Atlanta Sewing Center` | 1 | - | - | - |
| `Mart2 203E Room By BERNINA - 3300 & Oliso-3307` | 1 | - | - | - |
| `Mart2 203E Room by BERNINA/Atlanta Sewing Center- 3300` | 1 | - | - | - |
| `Mart2 203E Room by Bernina booth 3300/ Oliso-3307` | 1 | - | - | - |
| `Mart2 203E Room by Bernina booth 3300/Atlanta Sewing Center` | 1 | - | - | - |
| `Mart2 203E Room by Bernina booth 3300/Oliso-booth 3307` | 1 | - | - | - |
| `Mart2 203E Room by: BERNINA/Atlanta Sewing Center - 3300` | 1 | - | - | - |
| `Mart2 203E Room by:BERNINA/Atlanta Sewing Center -Booth: 3300` | 1 | - | - | - |
| `Mart2 Vendor Hall Floor 1 The MIssing Volume booth 1300` | 1 | - | - | - |
| `Mart2 Vendor Hall Floor 1 The Missing Volume - booth 1300` | 1 | - | - | - |
| `Mart2 Vendor Hall Floor 1 The Missing Volume Booth 1300` | 1 | - | - | - |
| `Mart2 Vendor Hall Floor 1 The Missing Voume booth 1300` | 1 | - | - | - |
| `Mart2 Vendor Hall Floor 2 J&J Collectables - Booth #2529` | 1 | - | - | - |
| `Mart2 Vendor Hall Floor 2 J&J Collectables - booth # 2529` | 1 | - | - | - |
| `Mart2 Vendor Hall Floor 2 J&J Collectibles - booth #2529` | 1 | - | - | - |
| `Mart2 Vendor Hall Floor 2 J&J Collectibles booth 2529` | 1 | - | - | - |
| `Mart2 Vendor Hall Floor 2 Scorched Design - Booth 2105` | 1 | - | - | - |
| `Mart2 Vendor Hall Floor 2 The Marigolden Bookshelf - Booth 2506` | 1 | - | - | - |
| `Mart2 Vendor Hall Floor 3 Sidestreet Book Market - book 3201` | 1 | - | - | - |

### Hilton - 739 events, 37 strings

| string | events | exact | reading (UNSURE) | in the registry |
| --- | ---: | --- | --- | --- |
| `202` | 45 | Level 2 (`l2`) | - | - |
| `Steps B` | 44 | unplaced | - | - |
| `203` | 43 | Level 2 (`l2`) | - | - |
| `Galleria 5` | 41 | Galleria (`galleria`) | - | - |
| `Steps A` | 37 | - | - | - |
| `Galleria 6` | 36 | Galleria (`galleria`) | - | - |
| `212-214` | 35 | - | numeric run → `212`, `213`, `214` | 3 of 3: Level 2 (`l2`) |
| `Galleria 2-3` | 33 | - | number run → `Galleria 2`, `Galleria 3` | 2 of 2: Galleria (`galleria`) |
| `313-314` | 32 | - | numeric run → `313`, `314` | 2 of 2: Level 3 (`l3`) |
| `209-211` | 31 | - | numeric run → `209`, `210`, `211` | 3 of 3: Level 2 (`l2`) |
| `Steps E` | 31 | - | - | - |
| `Galleria 7` | 30 | Galleria (`galleria`) | - | - |
| `Crystal Ballroom` | 29 | - | - | - |
| `302-304` | 28 | - | numeric run → `302`, `303`, `304` | 3 of 3: Level 3 (`l3`) |
| `Galleria 1` | 27 | Galleria (`galleria`) | - | - |
| `204-207` | 26 | - | numeric run → `204`, `205`, `206`, `207` | 4 of 4: Level 2 (`l2`) |
| `Galleria 4` | 26 | Galleria (`galleria`) | - | - |
| `309-312` | 21 | - | numeric run → `309`, `310`, `311`, `312` | 4 of 4: Level 3 (`l3`) |
| `Grand East` | 21 | Level 2 (`l2`) | - | - |
| `Steps G` | 20 | - | - | - |
| `Grand West` | 19 | Level 2 (`l2`) | - | - |
| `Salon` | 19 | - | partitions → `Salon East`, `Salon West` | 2 of 2: Level 2 (`l2`) |
| `Galleria 8` | 18 | Galleria (`galleria`) | - | - |
| `301` | 7 | Level 3 (`l3`) | - | - |
| `307` | 7 | Level 3 (`l3`) | - | - |
| `306` | 6 | Level 3 (`l3`) | - | - |
| `3rd floor outside deck` | 6 | - | - | - |
| `404-405` | 4 | - | numeric run → `404`, `405` | 2 of 2: Level 4 (`l4`) |
| `305` | 3 | Level 3 (`l3`) | - | - |
| `308` | 3 | Level 3 (`l3`) | - | - |
| `5th` | 3 | - | floor only: floor 5, no room | no level named for it |
| `315` | 2 | Level 3 (`l3`) | - | - |
| `Hilton-Salon` | 2 | - | hotel prefix + partitions → `Salon East`, `Salon West` | 2 of 2: Level 2 (`l2`) |
| `12th` | 1 | - | floor only: floor 12, no room | no level named for it |
| `212-214 Hilton, 3rd floor outdoor deck` | 1 | - | trailing note + numeric run → `212`, `213`, `214` | 3 of 3: Level 2 (`l2`) |
| `Crystal Ballroom Crystal Ballroom` | 1 | - | doubled → `Crystal Ballroom` | 0 of 1 |
| `Galleria 2-3 Hallway Just outside Galleria 2-3` | 1 | - | trailing note + number run → `Galleria 2`, `Galleria 3` | 2 of 2: Galleria (`galleria`) |

### Marriott - 606 events, 20 strings

| string | events | exact | reading (UNSURE) | in the registry |
| --- | ---: | --- | --- | --- |
| `International Hall South` | 318 | International Level (`international`) | - | - |
| `L401-L403` | 35 | - | numeric run → `L401`, `L402`, `L403` | 3 of 3: Lobby Level (`lobby`) |
| `Atrium Ballroom` | 32 | - | partitions → `Atrium Ballroom A`, `Atrium Ballroom B`, `Atrium Ballroom C`, `Atrium Ballroom D` | 4 of 4: Atrium Level (`atrium`) |
| `M103-M105` | 31 | - | numeric run → `M103`, `M104`, `M105` | 0 of 3 |
| `M302-M303` | 29 | - | numeric run → `M302`, `M303` | 2 of 2: Marquis Level (`marquis`) |
| `A706` | 26 | - | - | - |
| `A707` | 25 | - | - | named in the note `A601-A602 … A707 (confirm the runs)` |
| `M301` | 25 | Marquis Level (`marquis`) | - | - |
| `Imperial Ballroom` | 22 | - | partitions → `Imperial Ballroom A`, `Imperial Ballroom B` | 2 of 2: Marquis Level (`marquis`) |
| `A704` | 21 | - | - | - |
| `A601-A602` | 19 | - | numeric run → `A601`, `A602` | 0 of 2; `A601`, `A602` are named in the note `A601-A602 … A707 (confirm the runs)` |
| `A703` | 8 | - | - | - |
| `A708` | 5 | - | - | - |
| `10th` | 3 | - | floor only: floor 10, no room | no level named for it |
| `Marriott-A703` | 2 | - | hotel prefix → `A703` | 0 of 1 |
| `Marquis` | 1 | - | partitions → `Marquis Ballroom A`, `Marquis Ballroom B`, `Marquis Ballroom C`, `Marquis Ballroom D` | 4 of 4: Marquis Level (`marquis`) |
| `Marquis Foyer` | 1 | - | - | - |
| `Marquis Foyer Near Salon D doors` | 1 | - | - | - |
| `Skyline South- 10th Floor` | 1 | - | - | - |
| `Walk of Fame` | 1 | - | - | - |

### Hyatt - 498 events, 36 strings

| string | events | exact | reading (UNSURE) | in the registry |
| --- | ---: | --- | --- | --- |
| `Hanover AB` | 31 | - | letters together → `Hanover A`, `Hanover B` | 2 of 2: Exhibit Level (LL2) (`exhibit`) |
| `Concourse` | 30 | - | - | - |
| `Embassy EF` | 30 | - | letters together → `Embassy E`, `Embassy F` | 2 of 2: International Tower · LL2 (`tower-ll2`) |
| `Hanover FG` | 30 | - | letters together → `Hanover F`, `Hanover G` | 2 of 2: Exhibit Level (LL2) (`exhibit`) |
| `Centennial II-IV` | 29 | - | roman run → `Centennial II`, `Centennial III`, `Centennial IV` | 3 of 3: Ballroom Level (LL1) (`ballroom`) |
| `H-Piedmont` | 28 | - | hotel prefix → `Piedmont` | 1 of 1: Atlanta Conference Center (LL3) (`acc`) |
| `Embassy CD` | 26 | - | letters together → `Embassy C`, `Embassy D` | 2 of 2: International Tower · LL2 (`tower-ll2`) |
| `Regency VI-VII` | 26 | - | roman run → `Regency VI`, `Regency VII` | 2 of 2: Ballroom Level (LL1) (`ballroom`) |
| `Inman` | 25 | Atlanta Conference Center (LL3) (`acc`) | - | - |
| `Embassy AB` | 24 | - | letters together → `Embassy A`, `Embassy B` | 2 of 2: International Tower · LL2 (`tower-ll2`) |
| `Centennial I` | 20 | Ballroom Level (LL1) (`ballroom`) | - | - |
| `International North` | 17 | International Tower · LL1 (`tower-ll1`) | - | - |
| `Spring` | 17 | Atlanta Conference Center (LL3) (`acc`) | - | - |
| `The Learning Center` | 17 | - | leading The → `Learning Center` | 1 of 1: Ballroom Level (LL1) (`ballroom`) |
| `Grand Hall C` | 15 | Exhibit Level (LL2) (`exhibit`) | - | - |
| `International South` | 15 | International Tower · LL1 (`tower-ll1`) | - | - |
| `Marietta` | 15 | Atlanta Conference Center (LL3) (`acc`) | - | - |
| `Hanover C-E` | 14 | - | letter run → `Hanover C`, `Hanover D`, `Hanover E` | 3 of 3: Exhibit Level (LL2) (`exhibit`) |
| `Embassy G` | 13 | International Tower · LL2 (`tower-ll2`) | - | - |
| `Regency V` | 13 | Ballroom Level (LL1) (`ballroom`) | - | - |
| `Grand Hall D` | 11 | Exhibit Level (LL2) (`exhibit`) | - | - |
| `Roswell` | 10 | Atlanta Conference Center (LL3) (`acc`) | - | - |
| `Techwood` | 10 | Atlanta Conference Center (LL3) (`acc`) | - | - |
| `Kennesaw` | 9 | Atlanta Conference Center (LL3) (`acc`) | - | - |
| `International North-South` | 5 | - | word pair → `International North`, `International South` | 2 of 2: International Tower · LL1 (`tower-ll1`) |
| `Vinings` | 4 | Atlanta Conference Center (LL3) (`acc`) | - | - |
| `Hyatt` | 3 | - | hotel only: the hotel, no room | the hotel |
| `Centennial I-IV` | 2 | - | roman run → `Centennial I`, `Centennial II`, `Centennial III`, `Centennial IV` | 4 of 4: Ballroom Level (LL1) (`ballroom`) |
| `Hanover C-E Hanover C-E` | 2 | - | doubled + letter run → `Hanover C`, `Hanover D`, `Hanover E` | 3 of 3: Exhibit Level (LL2) (`exhibit`) |
| `Centennial II-IV Table outside the room` | 1 | - | trailing note + roman run → `Centennial II`, `Centennial III`, `Centennial IV` | 3 of 3: Ballroom Level (LL1) (`ballroom`) |
| `Grand Hall C Black Phoenix Alchemy - Vendors - Booth 1419` | 1 | - | trailing note → `Grand Hall C` | 1 of 1: Exhibit Level (LL2) (`exhibit`) |
| `Grand Hall D Poole Booth 111 for more info!!` | 1 | - | trailing note → `Grand Hall D` | 1 of 1: Exhibit Level (LL2) (`exhibit`) |
| `Grand Hall D Poole booth 111 for more information` | 1 | - | trailing note → `Grand Hall D` | 1 of 1: Exhibit Level (LL2) (`exhibit`) |
| `Grand Hall D Sponsored By Copic` | 1 | - | trailing note → `Grand Hall D` | 1 of 1: Exhibit Level (LL2) (`exhibit`) |
| `Grand Hall Main Floor` | 1 | - | - | - |
| `Hall D` | 1 | - | - | - |

### Westin - 309 events, 19 strings

| string | events | exact | reading (UNSURE) | in the registry |
| --- | ---: | --- | --- | --- |
| `Chastain 1-2` | 32 | - | number run → `Chastain 1`, `Chastain 2` | 2 of 2: Chastain (level unknown) (`chastain`) |
| `Augusta E-H` | 28 | - | letter run → `Augusta E`, `Augusta F`, `Augusta G`, `Augusta H` | 0 of 4 |
| `Chastain DE` | 28 | - | letters together → `Chastain D`, `Chastain E` | 0 of 2 |
| `Peachtree 1-2` | 25 | - | number run → `Peachtree 1`, `Peachtree 2` | 0 of 2 |
| `Peachtree Ballroom` | 24 | - | partitions → `Peachtree Ballroom A`, `Peachtree Ballroom B`, `Peachtree Ballroom C`, `Peachtree Ballroom D`, `Peachtree Ballroom E`, `Peachtree Ballroom F` | 6 of 6: Eighth Floor (`f8`) |
| `Chastain F` | 21 | - | - | - |
| `Augusta 1-2` | 20 | - | number run + numeral style → `Augusta I`, `Augusta II` | 2 of 2: Seventh Floor (`f7`) |
| `Augusta A-B` | 20 | - | letter run → `Augusta A`, `Augusta B` | 0 of 2 |
| `Chastain H-I-J` | 20 | - | letter run → `Chastain H`, `Chastain I`, `Chastain J` | 0 of 3 |
| `Augusta 3` | 16 | - | numeral style → `Augusta III` | 1 of 1: Seventh Floor (`f7`) |
| `Augusta C-D` | 15 | - | letter run → `Augusta C`, `Augusta D` | 0 of 2 |
| `Chastain G` | 14 | - | - | - |
| `Overlook` | 14 | Sixth Floor (`f6`) | - | - |
| `14th Floor` | 12 | - | floor only: floor 14, no room | Fourteenth Floor (`f14`) |
| `12th Floor` | 8 | - | floor only: floor 12, no room | Twelfth Floor (`f12`) |
| `Augusta C` | 5 | - | - | - |
| `Augusta D` | 5 | - | - | - |
| `Savannah Ballroom B/C` | 1 | - | slash list → `Savannah Ballroom B`, `Savannah Ballroom C` | 0 of 2 |
| `Westin` | 1 | - | hotel only: the hotel, no room | the hotel |

### Courtland Grand - 151 events, 9 strings

| string | events | exact | reading (UNSURE) | in the registry |
| --- | ---: | --- | --- | --- |
| `Grand Athens` | 35 | - | Courtland prefix → `Athens` | 1 of 1: levels unknown (`unknown`) |
| `Grand Macon` | 30 | - | Courtland prefix → `Macon` | 0 of 1 |
| `Grand Augusta` | 23 | - | Courtland prefix → `Augusta` | 0 of 1 |
| `Grand Atlanta 1-2` | 19 | - | Courtland prefix + number run → `Atlanta 1`, `Atlanta 2` | 0 of 2 |
| `Grand Capitol Ballroom` | 17 | - | Courtland prefix → `Capitol Ballroom` | 1 of 1: levels unknown (`unknown`) |
| `Grand Atlanta 3-4` | 14 | - | Courtland prefix + number run → `Atlanta 3`, `Atlanta 4` | 0 of 2 |
| `Grand CG-Grand Ballroom A-F` | 11 | - | Courtland prefix + hotel prefix + letter run → `Grand Ballroom A`, `Grand Ballroom B`, `Grand Ballroom C`, `Grand Ballroom D`, `Grand Ballroom E`, `Grand Ballroom F` | 0 of 6 |
| `Grand CG-Grand Ballroom A-F Hallway Table near Grand section B` | 1 | - | Courtland prefix + hotel prefix + trailing note + letter run → `Grand Ballroom A`, `Grand Ballroom B`, `Grand Ballroom C`, `Grand Ballroom D`, `Grand Ballroom E`, `Grand Ballroom F` | 0 of 6 |
| `Grand Pool and Courtyard` | 1 | - | Courtland prefix → `Pool and Courtyard` | 0 of 1 |

### Streaming - 62 events, 4 strings

Not in the registry.

| string | events | exact | reading (UNSURE) | in the registry |
| --- | ---: | --- | --- | --- |
| `STRM_TWITCH https://www.twitch.tv/dcdigitalmedia` | 29 | - | - | - |
| `STRM_TWITCH https://www.twitch.tv/dcdigitalmedia2` | 25 | - | - | - |
| `STRM_FBL https://www.facebook.com/DCUrbanFantasy` | 7 | - | - | - |
| `STRM_FBL` | 1 | - | - | - |

### Hardy Ivy Park - 36 events, 2 strings

In the registry with no rooms: it has no levels.

| string | events | exact | reading (UNSURE) | in the registry |
| --- | ---: | --- | --- | --- |
| `Ivy Structure` | 35 | - | - | - |
| `- Terraces` | 1 | - | - | - |

### Other - 25 events, 10 strings

Not in the registry.

| string | events | exact | reading (UNSURE) | in the registry |
| --- | ---: | --- | --- | --- |
| `Joystick Gamebar` | 10 | - | - | - |
| `Walton Spring Park` | 3 | - | - | - |
| `Georgia Aquarium` | 2 | - | - | - |
| `Offsite Center for Puppetry Arts` | 2 | - | - | - |
| `Parade` | 2 | - | - | - |
| `Peachtree Plaza` | 2 | - | - | - |
| `200 Peachtree Whitehall Ballroom` | 1 | - | - | - |
| `Other` | 1 | - | hotel only: the hotel, no room | the hotel |
| `Other Hyatt Lobby` | 1 | - | - | - |
| `Other Marriott, Imperial Ballroom` | 1 | - | - | - |

## 4. Strings no rule reaches

78 strings, 1,426 events: no exact match, and no reading in section 2.

| hotel | string | events | a registry note names it |
| --- | --- | ---: | --- |
| AmericasMart | `Mart Building 3, Floor 2` | 463 | - |
| AmericasMart | `Mart Building 3, Floor 1` | 382 | - |
| AmericasMart | `Mart2 Vendor Hall Floor 1 The Missing Volume booth 1300` | 62 | - |
| Hilton | `Steps A` | 37 | - |
| Hardy Ivy Park | `Ivy Structure` | 35 | - |
| Hilton | `Steps E` | 31 | - |
| Hyatt | `Concourse` | 30 | - |
| Hilton | `Crystal Ballroom` | 29 | - |
| Streaming | `STRM_TWITCH https://www.twitch.tv/dcdigitalmedia` | 29 | - |
| Marriott | `A706` | 26 | - |
| Marriott | `A707` | 25 | `A601-A602 … A707 (confirm the runs)` |
| Streaming | `STRM_TWITCH https://www.twitch.tv/dcdigitalmedia2` | 25 | - |
| Marriott | `A704` | 21 | - |
| Westin | `Chastain F` | 21 | - |
| Hilton | `Steps G` | 20 | - |
| AmericasMart | `Mart2 204J` | 18 | - |
| AmericasMart | `Mart2 Vendor Hall Floor 3 Sidestreet Book Market - booth 3201` | 18 | - |
| Westin | `Chastain G` | 14 | - |
| AmericasMart | `Mart2 203A` | 13 | - |
| AmericasMart | `Mart2 Vendor Hall Floor 3 Aethon Books booth 3500` | 12 | - |
| AmericasMart | `Mart2 Vendor Hall Floor 2 The Marigolden Bookshelf - booth 2506` | 10 | - |
| Other | `Joystick Gamebar` | 10 | - |
| Marriott | `A703` | 8 | - |
| Streaming | `STRM_FBL https://www.facebook.com/DCUrbanFantasy` | 7 | - |
| Hilton | `3rd floor outside deck` | 6 | - |
| Marriott | `A708` | 5 | - |
| Westin | `Augusta C` | 5 | - |
| Westin | `Augusta D` | 5 | - |
| AmericasMart | `Mart2 Vendor Hall Floor 2 Scorched Design - booth 2105` | 3 | - |
| Other | `Walton Spring Park` | 3 | - |
| AmericasMart | `Mart2 203E BERNINA/Atlanta Sewing Center - 3300` | 2 | - |
| Other | `Georgia Aquarium` | 2 | - |
| Other | `Offsite Center for Puppetry Arts` | 2 | - |
| Other | `Parade` | 2 | - |
| Other | `Peachtree Plaza` | 2 | - |
| AmericasMart | `Mart2 203D` | 1 | - |
| AmericasMart | `Mart2 203D AllTru2U - booth #2626` | 1 | - |
| AmericasMart | `Mart2 203D ArtCarp - James Farmer - booth # 1718` | 1 | - |
| AmericasMart | `Mart2 203D ArtCarp - booth # 1718` | 1 | - |
| AmericasMart | `Mart2 203D Bats in the Belfry Goods/ Nightwing Brooms Table-E` | 1 | - |
| AmericasMart | `Mart2 203D Black Phoenix Alchemy Lab - booth 1417/1419` | 1 | - |
| AmericasMart | `Mart2 203D By Quiltoni booth #3230` | 1 | - |
| AmericasMart | `Mart2 203D Cut/Sew booth # 2720` | 1 | - |
| AmericasMart | `Mart2 203D Maddy with Cut/Sew - booth # 2720` | 1 | - |
| AmericasMart | `Mart2 203D Paperbones - Table # B75` | 1 | - |
| AmericasMart | `Mart2 203D The Evergreen Burrow - booth # 2627` | 1 | - |
| AmericasMart | `Mart2 203D by STL Ocarina - booth #2404` | 1 | - |
| AmericasMart | `Mart2 203E By BERNINA-booth 3300, Oliso-booth 3307` | 1 | - |
| AmericasMart | `Mart2 203E By Bernina booth-3300/Atlanta Sewing Center` | 1 | - |
| AmericasMart | `Mart2 203E Room By BERNINA - 3300 & Oliso-3307` | 1 | - |
| AmericasMart | `Mart2 203E Room by BERNINA/Atlanta Sewing Center- 3300` | 1 | - |
| AmericasMart | `Mart2 203E Room by Bernina booth 3300/ Oliso-3307` | 1 | - |
| AmericasMart | `Mart2 203E Room by Bernina booth 3300/Atlanta Sewing Center` | 1 | - |
| AmericasMart | `Mart2 203E Room by Bernina booth 3300/Oliso-booth 3307` | 1 | - |
| AmericasMart | `Mart2 203E Room by: BERNINA/Atlanta Sewing Center - 3300` | 1 | - |
| AmericasMart | `Mart2 203E Room by:BERNINA/Atlanta Sewing Center -Booth: 3300` | 1 | - |
| AmericasMart | `Mart2 Vendor Hall Floor 1 The MIssing Volume booth 1300` | 1 | - |
| AmericasMart | `Mart2 Vendor Hall Floor 1 The Missing Volume - booth 1300` | 1 | - |
| AmericasMart | `Mart2 Vendor Hall Floor 1 The Missing Volume Booth 1300` | 1 | - |
| AmericasMart | `Mart2 Vendor Hall Floor 1 The Missing Voume booth 1300` | 1 | - |
| AmericasMart | `Mart2 Vendor Hall Floor 2 J&J Collectables - Booth #2529` | 1 | - |
| AmericasMart | `Mart2 Vendor Hall Floor 2 J&J Collectables - booth # 2529` | 1 | - |
| AmericasMart | `Mart2 Vendor Hall Floor 2 J&J Collectibles - booth #2529` | 1 | - |
| AmericasMart | `Mart2 Vendor Hall Floor 2 J&J Collectibles booth 2529` | 1 | - |
| AmericasMart | `Mart2 Vendor Hall Floor 2 Scorched Design - Booth 2105` | 1 | - |
| AmericasMart | `Mart2 Vendor Hall Floor 2 The Marigolden Bookshelf - Booth 2506` | 1 | - |
| AmericasMart | `Mart2 Vendor Hall Floor 3 Sidestreet Book Market - book 3201` | 1 | - |
| Hardy Ivy Park | `- Terraces` | 1 | - |
| Hyatt | `Grand Hall Main Floor` | 1 | - |
| Hyatt | `Hall D` | 1 | - |
| Marriott | `Marquis Foyer` | 1 | - |
| Marriott | `Marquis Foyer Near Salon D doors` | 1 | - |
| Marriott | `Skyline South- 10th Floor` | 1 | - |
| Marriott | `Walk of Fame` | 1 | - |
| Other | `200 Peachtree Whitehall Ballroom` | 1 | - |
| Other | `Other Hyatt Lobby` | 1 | - |
| Other | `Other Marriott, Imperial Ballroom` | 1 | - |
| Streaming | `STRM_FBL` | 1 | - |

## 5. Registry rooms not seen

Per level, the rooms no string matches exactly: those a proposal names (UNSURE), and those nothing names. The registry's entries that hold a note are listed after; no string matches them.

| hotel | level | rooms | matched exactly | named only by a proposal (UNSURE) | named by nothing |
| --- | --- | ---: | ---: | --- | --- |
| Hyatt | Atlanta Conference Center (LL3) (`acc`) | 20 | 7 | `Piedmont` | `Auburn`, `Baker`, `Courtland`, `Dunwoody`, `Edgewood`, `Fairlie`, `Greenbriar`, `Harris`, `Heritage Boardroom`, `Lenox`, `University`, `Williams` |
| Hyatt | Exhibit Level (LL2) (`exhibit`) | 16 | 2 | `Hanover A`, `Hanover B`, `Hanover C`, `Hanover D`, `Hanover E`, `Hanover F`, `Hanover G` | `Grand Hall A`, `Grand Hall B`, `Chicago A`, `Chicago B`, `Chicago C`, `Chicago D`, `Chicago E` |
| Hyatt | Ballroom Level (LL1) (`ballroom`) | 8 | 2 | `Centennial II`, `Centennial III`, `Centennial IV`, `Regency VI`, `Regency VII`, `Learning Center` | - |
| Hyatt | International Tower · LL2 (`tower-ll2`) | 8 | 1 | `Embassy A`, `Embassy B`, `Embassy C`, `Embassy D`, `Embassy E`, `Embassy F` | `Embassy H` |
| Hyatt | International Tower · LL1 (`tower-ll1`) | 2 | 2 | - | - |
| Marriott | International Level (`international`) | 15 | 1 | - | `International 1`, `International 2`, `International 3`, `International 4`, `International 5`, `International 6`, `International 7`, `International 8`, `International 9`, `International 10`, `International A`, `International B`, `International C`, `International Hall North` |
| Marriott | Marquis Level (`marquis`) | 9 | 1 | `Marquis Ballroom A`, `Marquis Ballroom B`, `Marquis Ballroom C`, `Marquis Ballroom D`, `Imperial Ballroom A`, `Imperial Ballroom B`, `M302`, `M303` | - |
| Marriott | Lobby Level (`lobby`) | 6 | 0 | `L401`, `L402`, `L403` | `L404`, `L405`, `L406` |
| Marriott | Atrium Level (`atrium`) | 4 | 0 | `Atrium Ballroom A`, `Atrium Ballroom B`, `Atrium Ballroom C`, `Atrium Ballroom D` | - |
| Hilton | Galleria (`galleria`) | 8 | 6 | `Galleria 2`, `Galleria 3` | - |
| Hilton | Level 1 (`l1`) | 6 | 0 | - | `Crystal A`, `Crystal B`, `Crystal C`, `Crystal D`, `Crystal E`, `Crystal F` |
| Hilton | Level 2 (`l2`) | 32 | 4 | `204`, `205`, `206`, `207`, `209`, `210`, `211`, `212`, `213`, `214`, `Salon East`, `Salon West` | `201`, `208`, `215`, `216`, `217`, `218`, `219`, `220`, `221`, `222`, `223`, `224`, `Grand Ballroom A`, `Grand Ballroom B`, `Grand Ballroom C`, `Grand Ballroom D` |
| Hilton | Level 3 (`l3`) | 15 | 6 | `302`, `303`, `304`, `309`, `310`, `311`, `312`, `313`, `314` | - |
| Hilton | Level 4 (`l4`) | 7 | 0 | `404`, `405` | `401`, `402`, `403`, `406`, `407` |
| Hilton | unplaced | 1 | 1 | - | - |
| Westin | Chastain (level unknown) (`chastain`) | 2 | 0 | `Chastain 1`, `Chastain 2` | - |
| Westin | Sixth Floor (`f6`) | 14 | 1 | - | `International`, `International Boardroom`, `American`, `Vinings I`, `Vinings II`, `A`, `B`, `C`, `D`, `E`, `F`, `G`, `H` |
| Westin | Seventh Floor (`f7`) | 9 | 0 | `Augusta I`, `Augusta II`, `Augusta III` | `Atlanta Ballroom A`, `Atlanta Ballroom B`, `Atlanta Ballroom C`, `Atlanta Ballroom D`, `Atlanta Ballroom E`, `Atlanta Ballroom F` |
| Westin | Eighth Floor (`f8`) | 8 | 0 | `Peachtree Ballroom A`, `Peachtree Ballroom B`, `Peachtree Ballroom C`, `Peachtree Ballroom D`, `Peachtree Ballroom E`, `Peachtree Ballroom F` | `Roswell I`, `Roswell II` |
| Westin | Ninth Floor (`f9`) | 2 | 0 | - | `Peachtree G`, `Peachtree H` |
| Westin | Tenth Floor (`f10`) | 3 | 0 | - | `Plaza Ballroom A`, `Plaza Ballroom B`, `Plaza Ballroom C` |
| Westin | Twelfth Floor (`f12`) | 8 | 0 | - | `1201`, `1202`, `1203`, `1204`, `1205`, `1206`, `1207`, `1208` |
| Westin | Fourteenth Floor (`f14`) | 8 | 0 | - | `1401`, `1402`, `1403`, `1404`, `1405`, `1406`, `1407`, `1408` |
| Courtland Grand | levels unknown (`unknown`) | 2 | 0 | `Capitol Ballroom`, `Athens` | - |

Entries that hold a note:

- Marriott, Marquis Level (`marquis`): `M101-M109 (confirm the run)`
- Marriott, Marquis Level (`marquis`): `M2xx (confirm)`
- Marriott, Marquis Level (`marquis`): `M304 (confirm the run)`
- Marriott, Atrium Level (`atrium`): `A601-A602 … A707 (confirm the runs)`
- Westin, Chastain (level unknown) (`chastain`): `Chastain A … J (confirm)`
- Courtland Grand, levels unknown (`unknown`): `(55 meeting rooms in two towers; list unknown)`

## 6. `split_hotel`: the Courtland prefix and hyphenated locations

`split_hotel` takes the location's first word - up to a space or a comma - as the hotel, and the rest as the room.

The Courtland prefix: 151 of the 151 Courtland Grand events have a location that begins "Courtland Grand ". The first word matches `courtland`, only that word is cut, and the room keeps "Grand ": `split_hotel('Courtland Grand Macon')` is `('Courtland Grand', 'Grand Macon')`.

With "Grand " cut, UNSURE:

| string | events | cut | then |
| --- | ---: | --- | --- |
| `Grand Athens` | 35 | `Athens` | an exact match |
| `Grand Macon` | 30 | `Macon` | no reading |
| `Grand Augusta` | 23 | `Augusta` | no reading |
| `Grand Atlanta 1-2` | 19 | `Atlanta 1-2` | number run |
| `Grand Capitol Ballroom` | 17 | `Capitol Ballroom` | an exact match |
| `Grand Atlanta 3-4` | 14 | `Atlanta 3-4` | number run |
| `Grand CG-Grand Ballroom A-F` | 11 | `CG-Grand Ballroom A-F` | hotel prefix + letter run |
| `Grand CG-Grand Ballroom A-F Hallway Table near Grand section B` | 1 | `CG-Grand Ballroom A-F Hallway Table near Grand section B` | hotel prefix + trailing note + letter run |
| `Grand Pool and Courtyard` | 1 | `Pool and Courtyard` | no reading |

Hyphenated locations: 5 events at a hotel `split_hotel` recognised have a location whose first word joins the hotel to what follows with a hyphen. With nothing after that word the room is the whole location; with words after it, the word after the hyphen is lost:

- `Hilton-Salon` (2): `('Hilton', 'Hilton-Salon')`
- `Marriott-A703` (2): `('Marriott', 'Marriott-A703')`
- `Hyatt-Grand Hall D` (1): `('Hyatt', 'Hall D')`

The 2027 fix, proposed and applied to nothing: match the venue's name as the source writes it, longest first, and cut all of it - "Courtland Grand" before "Courtland" - splitting at a hyphen as well as at a space or a comma. "Courtland Grand Athens" would give ("Courtland Grand", "Athens"), "Hilton-Salon" ("Hilton", "Salon") and "Hyatt-Grand Hall D" ("Hyatt", "Grand Hall D"). The frozen file keeps the rooms it has (DECISIONS #13).

## 7. `seen_2026`, level by level

What each level's `seen_2026` would become if it held the strings that reach the level: by an exact match, and by a proposal (UNSURE), with today's list beside them. A string whose rooms land on two levels is listed under both. Nothing here is written to the registry.

### Hyatt - Atlanta Conference Center (LL3) (`acc`)

- Today: `Kennesaw`.
- By an exact match: `Inman` (25), `Spring` (17), `Marietta` (15), `Roswell` (10), `Techwood` (10), `Kennesaw` (9), `Vinings` (4).
- By a proposal, UNSURE: `H-Piedmont` (28).

### Hyatt - Exhibit Level (LL2) (`exhibit`)

- Today: none.
- By an exact match: `Grand Hall C` (15), `Grand Hall D` (11).
- By a proposal, UNSURE: `Hanover AB` (31), `Hanover FG` (30), `Hanover C-E` (14), `Hanover C-E Hanover C-E` (2), `Grand Hall C Black Phoenix Alchemy - Vendors - Booth 1419` (1), `Grand Hall D Poole Booth 111 for more info!!` (1), `Grand Hall D Poole booth 111 for more information` (1), `Grand Hall D Sponsored By Copic` (1).

### Hyatt - Ballroom Level (LL1) (`ballroom`)

- Today: `Regency V`, `Regency VI-VII`, `Centennial II-IV`.
- By an exact match: `Centennial I` (20), `Regency V` (13).
- By a proposal, UNSURE: `Centennial II-IV` (29), `Regency VI-VII` (26), `The Learning Center` (17), `Centennial I-IV` (2), `Centennial II-IV Table outside the room` (1).

### Hyatt - International Tower · LL2 (`tower-ll2`)

- Today: `Embassy AB`.
- By an exact match: `Embassy G` (13).
- By a proposal, UNSURE: `Embassy EF` (30), `Embassy CD` (26), `Embassy AB` (24).

### Hyatt - International Tower · LL1 (`tower-ll1`)

- Today: none.
- By an exact match: `International North` (17), `International South` (15).
- By a proposal, UNSURE: `International North-South` (5).

### Marriott - International Level (`international`)

- Today: none.
- By an exact match: `International Hall South` (318).
- By a proposal, UNSURE: none.

### Marriott - Marquis Level (`marquis`)

- Today: `M103-M105`, `M301`, `M302-M303`, `M303-M304`.
- By an exact match: `M301` (25).
- By a proposal, UNSURE: `M302-M303` (29), `Imperial Ballroom` (22), `Marquis` (1).
- Today's, reached by nothing here: `M103-M105`, `M303-M304` (not in the file).

### Marriott - Lobby Level (`lobby`)

- Today: none.
- By an exact match: none.
- By a proposal, UNSURE: `L401-L403` (35).

### Marriott - Atrium Level (`atrium`)

- Today: `Atrium Ballroom`, `A601-A602`, `A703`, `A707`.
- By an exact match: none.
- By a proposal, UNSURE: `Atrium Ballroom` (32).
- Today's, reached by nothing here: `A601-A602`, `A703`, `A707`.

### Hilton - Galleria (`galleria`)

- Today: `Galleria 1`, `Galleria 5`, `Galleria 6`, `Galleria 8`.
- By an exact match: `Galleria 5` (41), `Galleria 6` (36), `Galleria 7` (30), `Galleria 1` (27), `Galleria 4` (26), `Galleria 8` (18).
- By a proposal, UNSURE: `Galleria 2-3` (33), `Galleria 2-3 Hallway Just outside Galleria 2-3` (1).

### Hilton - Level 1 (`l1`)

- Today: `Crystal Ballroom`.
- By an exact match: none.
- By a proposal, UNSURE: none.
- Today's, reached by nothing here: `Crystal Ballroom`.

### Hilton - Level 2 (`l2`)

- Today: `202`, `203`, `209-211`, `212-214`, `Salon`, `Grand East`.
- By an exact match: `202` (45), `203` (43), `Grand East` (21), `Grand West` (19).
- By a proposal, UNSURE: `212-214` (35), `209-211` (31), `204-207` (26), `Salon` (19), `Hilton-Salon` (2), `212-214 Hilton, 3rd floor outdoor deck` (1).

### Hilton - Level 3 (`l3`)

- Today: `313-314`.
- By an exact match: `301` (7), `307` (7), `306` (6), `305` (3), `308` (3), `315` (2).
- By a proposal, UNSURE: `313-314` (32), `302-304` (28), `309-312` (21).

### Hilton - Level 4 (`l4`)

- Today: none.
- By an exact match: none.
- By a proposal, UNSURE: `404-405` (4).

### Westin - Chastain (level unknown) (`chastain`)

- Today: none.
- By an exact match: none.
- By a proposal, UNSURE: `Chastain 1-2` (32).

### Westin - Sixth Floor (`f6`)

- Today: none.
- By an exact match: `Overlook` (14).
- By a proposal, UNSURE: none.

### Westin - Seventh Floor (`f7`)

- Today: none.
- By an exact match: none.
- By a proposal, UNSURE: `Augusta 1-2` (20), `Augusta 3` (16).

### Westin - Eighth Floor (`f8`)

- Today: none.
- By an exact match: none.
- By a proposal, UNSURE: `Peachtree Ballroom` (24).

### Westin - Twelfth Floor (`f12`)

- Today: none.
- By an exact match: none.
- By a proposal, UNSURE: `12th Floor` (8).

### Westin - Fourteenth Floor (`f14`)

- Today: none.
- By an exact match: none.
- By a proposal, UNSURE: `14th Floor` (12).

### Courtland Grand - levels unknown (`unknown`)

- Today: `Grand Athens`, `Grand Capitol Ballroom`, `Grand Atlanta 3-4`.
- By an exact match: none.
- By a proposal, UNSURE: `Grand Athens` (35), `Grand Capitol Ballroom` (17).
- Today's, reached by nothing here: `Grand Atlanta 3-4`.

## 8. Strings the dedupe reads as one room

Distinct strings at one hotel that `norm_text` - the dedupe's rule: case, spacing and trailing punctuation - makes one: 3 groups.

- AmericasMart: `Mart2 Vendor Hall Floor 1 The Missing Volume booth 1300` (62), `Mart2 Vendor Hall Floor 1 The MIssing Volume booth 1300` (1), `Mart2 Vendor Hall Floor 1 The Missing Volume Booth 1300` (1)
- AmericasMart: `Mart2 Vendor Hall Floor 2 Scorched Design - booth 2105` (3), `Mart2 Vendor Hall Floor 2 Scorched Design - Booth 2105` (1)
- AmericasMart: `Mart2 Vendor Hall Floor 2 The Marigolden Bookshelf - booth 2506` (10), `Mart2 Vendor Hall Floor 2 The Marigolden Bookshelf - Booth 2506` (1)
