# Venues — the floor-plan checklist

Kept by hand. Every hotel × level where programming happens: which published floor plan covers the level, where our
local copy of it is, what Dragon Con's own map shows of it, and the state of our own drawing (DECISIONS #28). The
hotels' drawings and the con's maps stay in `reference/` (gitignored); this file records what we have and where.

Room, alias and note truth is `data/<year>/venues.json` (DECISIONS #45): the levels, their rooms, their aliases and
their notes are data there, and this file does not repeat them. `tools/room_census.py` reads the 2026 schedule through
the venues step (`venues_stage.py`) against `data/2026/venues.json`, and writes `docs/venues/census-2026.md`: where every
event lands, and the worklist of strings the file cannot place yet.

Our drawings are data too: `data/<year>/drawings/<hotel>-<level>.json`, one file per level, geometry only, keyed by
the level's room ids (DECISIONS #58; format in `data/2027/drawings/README.md`). `tools/render_drawings.py` draws them
to `docs/venues/drawings/` for checking by eye.

"Con map" is what the official Dragon Con app's map gives us for the level: its room outlines say which rooms the con
uses, and place a room only where the hotel has no plan of its own; never copied. `reference/dragoncon/maps.json` records those positions; "n of m rooms" counts how many of
the level's rooms the con's map outlines, "image only" means the map has the floor but no room outlines to read.

| Hotel | Level | Plan | Dims | Local copy | Con map | Our drawing |
|---|---|---|---|---|---|---|
| Marriott | Atrium Level | have · [Hotel's floor plan, an image (AOM 2017)](https://my.aom.org/ProgramDocs/2017/maps/Atlanta_Marriott_Marquis.pdf), p. 1 | yes · the hotel's [capacity chart](https://www.marriott.com/en-us/hotels/atlmq-atlanta-marriott-marquis/events/) on its events page, read 2026-10-02 | `reference/plans/marriott-marquis-aom-2017.pdf` | 10 of 10 rooms (Atrium Ballroom as one outline) | `data/2027/drawings/marriott-atrium.json` · sizes from the chart, placement from the plan; section C drawn at the chart's 23 ft |
| Marriott | Lobby Level | have · [Hotel's floor plan, an image (AOM 2017)](https://my.aom.org/ProgramDocs/2017/maps/Atlanta_Marriott_Marquis.pdf), p. 2 | yes · the hotel's [capacity chart](https://www.marriott.com/en-us/hotels/atlmq-atlanta-marriott-marquis/events/) on its events page, read 2026-10-02 | `reference/plans/marriott-marquis-aom-2017.pdf` | 3 of 6 rooms | `data/2027/drawings/marriott-lobby.json` · sizes from the chart, placement from the plan |
| Marriott | Marquis Level | have · [Hotel's floor plan, an image (AOM 2017)](https://my.aom.org/ProgramDocs/2017/maps/Atlanta_Marriott_Marquis.pdf), p. 3 | yes · the hotel's [capacity chart](https://www.marriott.com/en-us/hotels/atlmq-atlanta-marriott-marquis/events/) on its events page, read 2026-10-02 | `reference/plans/marriott-marquis-aom-2017.pdf` | 6 of 12 rooms | `data/2027/drawings/marriott-marquis.json` · sizes from the chart, placement from the plan |
| Marriott | International Level | have · [Hotel's floor plan, an image (AOM 2017)](https://my.aom.org/ProgramDocs/2017/maps/Atlanta_Marriott_Marquis.pdf), p. 4 | yes · the hotel's [capacity chart](https://www.marriott.com/en-us/hotels/atlmq-atlanta-marriott-marquis/events/) on its events page, read 2026-10-02 | `reference/plans/marriott-marquis-aom-2017.pdf` | 0 of 15 rooms | `data/2027/drawings/marriott-international.json` · sizes from the chart, placement from the plan; International Hall North not drawn |
| Hyatt | International Tower · LL1 | have · [Hotel's official floor-plan PDF](https://www.nfaonline.org/docs/default-source/convention-documents/2025-convention/hyatt-regency-atlanta_floorplan.pdf) | yes | `reference/plans/hyatt-floorplan-2012.pdf` | 2 of 2 rooms | `data/2027/drawings/hyatt-tower-ll1.json` · sizes from the table, placement from the plan |
| Hyatt | International Tower · LL2 | have · [Hotel's official floor-plan PDF](https://www.nfaonline.org/docs/default-source/convention-documents/2025-convention/hyatt-regency-atlanta_floorplan.pdf) | yes | `reference/plans/hyatt-floorplan-2012.pdf` | 7 of 8 rooms | `data/2027/drawings/hyatt-tower-ll2.json` · sizes from the table, placement from the plan; Embassy A and B drawn from the corridor |
| Hyatt | Lobby Level | partial · [Hotel's official floor-plan PDF](https://www.nfaonline.org/docs/default-source/convention-documents/2025-convention/hyatt-regency-atlanta_floorplan.pdf) (p. 5's sketch alone) | no | `reference/plans/hyatt-floorplan-2012.pdf` | none | none · no rooms, and the file has only a sketch of it, with no table |
| Hyatt | Ballroom Level (LL1) | have · [Hotel's official floor-plan PDF](https://www.nfaonline.org/docs/default-source/convention-documents/2025-convention/hyatt-regency-atlanta_floorplan.pdf) | yes | `reference/plans/hyatt-floorplan-2012.pdf` | 7 of 8 rooms | `data/2027/drawings/hyatt-ballroom.json` · sizes from the table, placement from the plan |
| Hyatt | Exhibit Level (LL2) | have · [Hotel's official floor-plan PDF](https://www.nfaonline.org/docs/default-source/convention-documents/2025-convention/hyatt-regency-atlanta_floorplan.pdf) | yes | `reference/plans/hyatt-floorplan-2012.pdf` | 10 of 17 rooms | `data/2027/drawings/hyatt-exhibit.json` · sizes from the table, placement from the plan |
| Hyatt | Atlanta Conference Center (LL3) | have · [Hotel's official floor-plan PDF](https://www.nfaonline.org/docs/default-source/convention-documents/2025-convention/hyatt-regency-atlanta_floorplan.pdf) | yes | `reference/plans/hyatt-floorplan-2012.pdf` | 8 of 20 rooms | `data/2027/drawings/hyatt-acc.json` · sizes from the table, placement from the plan; Courtland and Dunwoody's order to be checked in person |
| Hilton | 4th Floor | have · [Hotel's 2024 group sales playbook](https://hiltonatlanta.com/wp-content/uploads/HiltonAtlanta_2024-GroupSalesPlaybook_EditablewUpdated_July_2024.pdf) | yes | `reference/plans/hilton-playbook-2024.pdf` | 2 of 7 rooms (404–405) | `data/2027/drawings/hilton-l4.json` · sizes from the table, placement from the plan |
| Hilton | 3rd Floor | have · [Hotel's 2024 group sales playbook](https://hiltonatlanta.com/wp-content/uploads/HiltonAtlanta_2024-GroupSalesPlaybook_EditablewUpdated_July_2024.pdf) | yes | `reference/plans/hilton-playbook-2024.pdf` | 15 of 15 rooms | `data/2027/drawings/hilton-l3.json` · sizes from the table, placement from the plan; 306–308's order to be checked in person |
| Hilton | 2nd Floor | have · [Hotel's 2024 group sales playbook](https://hiltonatlanta.com/wp-content/uploads/HiltonAtlanta_2024-GroupSalesPlaybook_EditablewUpdated_July_2024.pdf) | yes | `reference/plans/hilton-playbook-2024.pdf` | 14 of 32 rooms + Grand East/West + Salon as one | `data/2027/drawings/hilton-l2.json` · sizes from the table, placement from the plan; 201 and 215–224 not drawn |
| Hilton | 1st Floor | have · [Hotel's 2024 group sales playbook](https://hiltonatlanta.com/wp-content/uploads/HiltonAtlanta_2024-GroupSalesPlaybook_EditablewUpdated_July_2024.pdf) | yes | `reference/plans/hilton-playbook-2024.pdf` | Crystal Ballroom as one outline | `data/2027/drawings/hilton-l1.json` · sizes from the table, placement from the plan |
| Hilton | Galleria | have · [Hotel's 2024 group sales playbook](https://hiltonatlanta.com/wp-content/uploads/HiltonAtlanta_2024-GroupSalesPlaybook_EditablewUpdated_July_2024.pdf) | yes | `reference/plans/hilton-playbook-2024.pdf` | 8 of 8 rooms | `data/2027/drawings/hilton-galleria.json` · placement from the plan; sizes from the table but Galleria 3, 5, 6 and 7, the plan's |
| Courtland Grand | 3rd Floor | none | no | — | image only · rooms labelled on the image | none |
| Courtland Grand | 2nd Floor | none | no | — | image only · rooms labelled on the image | none |
| Courtland Grand | 1st Floor | none | no | — | image only · rooms labelled on the image | none |
| Westin | 14th Floor | partial · [Pre-renovation hotel floor-plan PDF](https://www.cs.hmc.edu/aaairoboted/floor6_page8.pdf) | no | `reference/plans/westin-floorplans-old.pdf` | image only · rooms labelled on the image | none |
| Westin | 12th Floor | partial · [Pre-renovation hotel floor-plan PDF](https://www.cs.hmc.edu/aaairoboted/floor6_page8.pdf) | no | `reference/plans/westin-floorplans-old.pdf` | image only · rooms labelled on the image | none |
| Westin | 8th Floor | partial · [Pre-renovation hotel floor-plan PDF](https://www.cs.hmc.edu/aaairoboted/floor6_page8.pdf) | no | `reference/plans/westin-floorplans-old.pdf` | image only · rooms labelled on the image | none |
| Westin | 7th Floor | partial · [Pre-renovation hotel floor-plan PDF](https://www.cs.hmc.edu/aaairoboted/floor6_page8.pdf) | no | `reference/plans/westin-floorplans-old.pdf` | image only · rooms labelled on the image | none |
| Westin | 6th Floor | partial · [Pre-renovation hotel floor-plan PDF](https://www.cs.hmc.edu/aaairoboted/floor6_page8.pdf) | no | `reference/plans/westin-floorplans-old.pdf` | image only · rooms labelled on the image | none |
| AmericasMart | Building 2, Vendor Hall Floor 3 | unknown | no | — | image only | none |
| AmericasMart | Building 2, Vendor Hall Floor 2 | unknown | no | — | image only | none |
| AmericasMart | Building 2, Vendor Hall Floor 1 | unknown | no | — | image only | none |
| AmericasMart | Building 2, meeting rooms | unknown | no | — | image only | none |
| AmericasMart | Building 3, Floor 2 | unknown | no | — | image only | none |
| AmericasMart | Building 3, Floor 1 | unknown | no | — | image only | none |
| Hardy Ivy Park | — | n/a | — | — | on the convention footprint map | — |

## The plans

- **Marriott** — the hotel's own floor plan, one page per level, each an image with a conference's markings over it
  (the Academy of Management's 2017 meeting): p. 1 the Atrium Level, p. 2 the Lobby Level, p. 3 the Marquis Level,
  p. 4 the International Level. No text layer, no vector linework, no compass; p. 4 prints three streets (Harris
  Street for John Portman Blvd), p. 2 one, pp. 1 and 3 none. Pp. 1 and 2 are squashed north to south, about 10% and
  6%, and are read with one scale across and another down. Sizes from the hotel's capacity chart on its events page,
  read 2026-10-02; no local copy.
- **Hyatt** — Hotel's official floor-plan PDF (2012 rev.), conference-hosted copy: p. 1 the Ballroom Level (LL1), p. 2
  the Exhibit Level (LL2), p. 3 the Atlanta Conference Center (LL3), drawn half a turn round from the others, p. 4 the
  International Tower's two levels, and p. 5 an exploded sketch of every level, the only picture of the Lobby Level.
  Each plan has its capacity table on its own page.
- **Hilton** — Hotel's 2024 group sales playbook (floor plans + capacity charts). The floor plans are on pp. 4, 6, 8, 10
  and 12 (the Galleria, then the 1st to 4th Floors), each before its capacity chart on pp. 5, 7, 9 and 11; the 4th
  Floor's chart shares p. 12 with its plan.
- **Westin** — Pre-renovation hotel floor-plan PDF (floors 6-10, 12, 14), one page per floor. It predates the levels'
  and rooms' post-renovation names, which are the con's, from its 2026 map. A current plan is still not found.
- **Dragon Con's own map** — the official app's map, one image per venue with every floor composited on it, plus the
  room outlines it draws for rooms with events (Hilton, Hyatt, Marriott only; the Westin, Courtland Grand and
  AmericasMart maps are images alone). Read for which rooms the con uses and their names, and for placement where a
  hotel has no plan; never copied; `reference/dragoncon/README.md` says how it
  was captured.

## Notes

- **Hilton** — all five levels drawn from the playbook's floor plans and its sizes, in one frame (DECISIONS #67), tied by
  named anchors. The plans are illustrations, so positions are good to about 10–15 ft until walked; 306–308 follow the
  hotel's order, the reverse of Dragon Con's map's.
- **Hyatt** — five levels drawn from the hotel's floor plans and its tables, in one frame (DECISIONS #67), tied by named
  anchors. Where the International Tower stands, 134 ft west and 107 ft south of the atrium elevators, rests on p. 3
  alone, the only page that draws both towers. Dragon Con's map labels Courtland and Dunwoody the other way round from
  the hotel's plan; the hotel's is drawn. The plan prints no compass and no streets: north is taken from the
  International Ballroom's North and South halves and the main entrance on Peachtree Street, and the streets from the
  con's footprint map. The plans are illustrations, so positions are good to about 10–15 ft until walked. The Lobby
  Level is not drawn: it has no rooms, and the file has only a sketch of it.
- **Marriott** — four levels drawn from the hotel's plan and its capacity chart, in one frame (DECISIONS #67), tied by
  named anchors: the elevator core on all four, the east elevators and the central escalators where the level has
  them. International Hall South is International 4 to 10, a composite; the chart's "International Ballroom 4-10",
  191.6 × 56.0 ft, is its outline. Where a combined row of the chart disagrees with its single rooms (L405 & L406,
  the M301–M304 pairs, A703 & A704), the single rooms are drawn. The Lobby and Atrium pages are drawn at a smaller
  scale and squashed north to south, so each is read with one scale across and another down; the A700 rooms are 265
  to 345 ft from the elevator core, so those are placed less finely. The plan is an image, so positions are good to
  about 10–15 ft until walked. Every room the con's map outlines reads as ours: M103–M105, M301, Imperial Ballroom,
  L401–L403, Atrium Ballroom, A601–A602, A703, A704 and A706–A708. The rooms the map names on the Marquis, Lobby and
  Atrium levels with no 2026 programming are in those levels' notes.
- **Westin** — its levels and rooms are the con's post-renovation names, from its 2026 map; the old PDF predates them.
  A current plan is still not found.
- **Courtland Grand** — no hotel plan found; the three floors and their rooms are the con's, from its 2026 map, but for
  the Grand Ballroom's sections A–F, which are the schedule's: the map labels one Grand Ballroom.
- **AmericasMart** — several buildings, each with floors; Dragon Con's map of each building is under
  `reference/dragoncon/`, a picture with no room outlines; its exhibitor maps were not captured. The Mart's drawing is
  W41's, as sources allow (DECISIONS #60).
- **Hardy Ivy Park** — outdoor; no levels, no plan needed

## Adding an alias

An alias reads a room string the grammar cannot - a numeral style, a name the source uses (`Crystal Ballroom`), a
room's halves (`Salon`) - and it beats every rule. Add it to the level whose rooms it
names in `data/<year>/venues.json`: the key is the string as the source writes it after the hotel's key, folded to lower
case with single spaces, and the value lists those rooms' ids, every one on that level, or `venues.py` refuses the file.
Then `python tools/room_census.py` shows the string gone from the worklist, and the change goes in as a data PR of its
own.

## How this file is kept

- By hand. A plan found, a copy saved or a drawing begun is an edit to its row here.
- A room, an alias or a level's note is an edit to `data/<year>/venues.json`, which `venues.py` validates; after one,
  `python tools/room_census.py` shows what the rooms reach.
- A drawing is an edit to `data/<year>/drawings/<hotel>-<level>.json`; after one, `python tools/render_drawings.py`
  redraws `docs/venues/drawings/` and `python -m pytest tests/test_drawings.py` checks the ids.
- A plan's local copy names the file in `reference/plans/`; record the retrieval date in the file name if the source
  changes.
