# Venues — the floor-plan checklist

Kept by hand. Every hotel × level where programming happens: which published floor plan covers the level, where our
local copy of it is, and the state of our own drawing (DECISIONS #28). The hotels' drawings stay in `reference/`
(gitignored); this file records what we have and where.

Room, alias and note truth is `data/<year>/venues.json` (DECISIONS #45): the levels, their rooms, their aliases and
their notes are data there, and this file does not repeat them. `tools/room_census.py` reads the 2026 schedule through
the venues step (`venues_stage.py`) against `data/2026/venues.json`, and writes `docs/venues/census-2026.md`: where every
event lands, and the worklist of strings the file cannot place yet.

| Hotel | Level | Plan | Dims | Local copy | Our drawing |
|---|---|---|---|---|---|
| Marriott | Atrium Level | partial · [AOM 2017 level map](https://my.aom.org/ProgramDocs/2017/maps/Atlanta_Marriott_Marquis.pdf) | per room, from a third-party site | `reference/plans/marriott-marquis-aom-2017.pdf` | none |
| Marriott | Lobby Level | partial · [AOM 2017 level map](https://my.aom.org/ProgramDocs/2017/maps/Atlanta_Marriott_Marquis.pdf) | per room, from a third-party site | `reference/plans/marriott-marquis-aom-2017.pdf` | none |
| Marriott | Marquis Level | partial · [AOM 2017 level map](https://my.aom.org/ProgramDocs/2017/maps/Atlanta_Marriott_Marquis.pdf) | per room, from a third-party site | `reference/plans/marriott-marquis-aom-2017.pdf` | none |
| Marriott | International Level | partial · [AOM 2017 level map](https://my.aom.org/ProgramDocs/2017/maps/Atlanta_Marriott_Marquis.pdf) | per room, from a third-party site | `reference/plans/marriott-marquis-aom-2017.pdf` | none |
| Hyatt | International Tower · LL1 | have · [Hotel's official floor-plan PDF](https://www.nfaonline.org/docs/default-source/convention-documents/2025-convention/hyatt-regency-atlanta_floorplan.pdf) | yes | `reference/plans/hyatt-floorplan-2012.pdf` | none |
| Hyatt | International Tower · LL2 | have · [Hotel's official floor-plan PDF](https://www.nfaonline.org/docs/default-source/convention-documents/2025-convention/hyatt-regency-atlanta_floorplan.pdf) | yes | `reference/plans/hyatt-floorplan-2012.pdf` | none |
| Hyatt | Lobby Level | have · [Hotel's official floor-plan PDF](https://www.nfaonline.org/docs/default-source/convention-documents/2025-convention/hyatt-regency-atlanta_floorplan.pdf) | yes | `reference/plans/hyatt-floorplan-2012.pdf` | none |
| Hyatt | Ballroom Level (LL1) | have · [Hotel's official floor-plan PDF](https://www.nfaonline.org/docs/default-source/convention-documents/2025-convention/hyatt-regency-atlanta_floorplan.pdf) | yes | `reference/plans/hyatt-floorplan-2012.pdf` | none |
| Hyatt | Exhibit Level (LL2) | have · [Hotel's official floor-plan PDF](https://www.nfaonline.org/docs/default-source/convention-documents/2025-convention/hyatt-regency-atlanta_floorplan.pdf) | yes | `reference/plans/hyatt-floorplan-2012.pdf` | none |
| Hyatt | Atlanta Conference Center (LL3) | have · [Hotel's official floor-plan PDF](https://www.nfaonline.org/docs/default-source/convention-documents/2025-convention/hyatt-regency-atlanta_floorplan.pdf) | yes | `reference/plans/hyatt-floorplan-2012.pdf` | none |
| Hilton | Level 4 | have · [Hotel's 2024 group sales playbook](https://hiltonatlanta.com/wp-content/uploads/HiltonAtlanta_2024-GroupSalesPlaybook_EditablewUpdated_July_2024.pdf) | yes | `reference/plans/hilton-playbook-2024.pdf` | none |
| Hilton | Level 3 | have · [Hotel's 2024 group sales playbook](https://hiltonatlanta.com/wp-content/uploads/HiltonAtlanta_2024-GroupSalesPlaybook_EditablewUpdated_July_2024.pdf) | yes | `reference/plans/hilton-playbook-2024.pdf` | none |
| Hilton | Level 2 | have · [Hotel's 2024 group sales playbook](https://hiltonatlanta.com/wp-content/uploads/HiltonAtlanta_2024-GroupSalesPlaybook_EditablewUpdated_July_2024.pdf) | yes | `reference/plans/hilton-playbook-2024.pdf` | draft |
| Hilton | Lobby | have · [Hotel's 2024 group sales playbook](https://hiltonatlanta.com/wp-content/uploads/HiltonAtlanta_2024-GroupSalesPlaybook_EditablewUpdated_July_2024.pdf) | yes | `reference/plans/hilton-playbook-2024.pdf` | none |
| Hilton | Level 1 | have · [Hotel's 2024 group sales playbook](https://hiltonatlanta.com/wp-content/uploads/HiltonAtlanta_2024-GroupSalesPlaybook_EditablewUpdated_July_2024.pdf) | yes | `reference/plans/hilton-playbook-2024.pdf` | none |
| Hilton | Galleria | have · [Hotel's 2024 group sales playbook](https://hiltonatlanta.com/wp-content/uploads/HiltonAtlanta_2024-GroupSalesPlaybook_EditablewUpdated_July_2024.pdf) | yes | `reference/plans/hilton-playbook-2024.pdf` | none |
| Courtland Grand | levels unknown | none | no | — | none |
| Westin | Fourteenth Floor | partial · [Pre-renovation hotel floor-plan PDF](https://www.cs.hmc.edu/aaairoboted/floor6_page8.pdf) | no | `reference/plans/westin-floorplans-old.pdf` | none |
| Westin | Twelfth Floor | partial · [Pre-renovation hotel floor-plan PDF](https://www.cs.hmc.edu/aaairoboted/floor6_page8.pdf) | no | `reference/plans/westin-floorplans-old.pdf` | none |
| Westin | Tenth Floor | partial · [Pre-renovation hotel floor-plan PDF](https://www.cs.hmc.edu/aaairoboted/floor6_page8.pdf) | no | `reference/plans/westin-floorplans-old.pdf` | none |
| Westin | Ninth Floor | partial · [Pre-renovation hotel floor-plan PDF](https://www.cs.hmc.edu/aaairoboted/floor6_page8.pdf) | no | `reference/plans/westin-floorplans-old.pdf` | none |
| Westin | Eighth Floor | partial · [Pre-renovation hotel floor-plan PDF](https://www.cs.hmc.edu/aaairoboted/floor6_page8.pdf) | no | `reference/plans/westin-floorplans-old.pdf` | none |
| Westin | Seventh Floor | partial · [Pre-renovation hotel floor-plan PDF](https://www.cs.hmc.edu/aaairoboted/floor6_page8.pdf) | no | `reference/plans/westin-floorplans-old.pdf` | none |
| Westin | Sixth Floor | partial · [Pre-renovation hotel floor-plan PDF](https://www.cs.hmc.edu/aaairoboted/floor6_page8.pdf) | no | `reference/plans/westin-floorplans-old.pdf` | none |
| Westin | Chastain (level unknown) | unknown | no | — | none |
| AmericasMart | Building 2, Vendor Hall Floor 3 | unknown | no | — | none |
| AmericasMart | Building 2, Vendor Hall Floor 2 | unknown | no | — | none |
| AmericasMart | Building 2, Vendor Hall Floor 1 | unknown | no | — | none |
| AmericasMart | Building 2, meeting rooms | unknown | no | — | none |
| AmericasMart | Building 3, Floor 2 | unknown | no | — | none |
| AmericasMart | Building 3, Floor 1 | unknown | no | — | none |
| Hardy Ivy Park | — | n/a | — | — | — |

## The plans

- **Marriott** — AOM 2017 level map (image only) + NAQT all-in-one map + NFB prose walk-through; dimensions per room on
  thevendry.co. All levels on one sheet.
- **Hyatt** — Hotel's official floor-plan PDF (2012 rev.), conference-hosted copy. One page per level; confirm.
- **Hilton** — Hotel's 2024 group sales playbook (floor plans + capacity charts). Floor plans follow the capacity
  charts; confirm page numbers.
- **Westin** — Pre-renovation hotel floor-plan PDF (floors 6-10, 12, 14); the Chastain level is not in it. One page per
  floor.

## Notes

- **Hilton · Level 2** — our draft drawing: docs/venues/drawings/hilton-second-floor.svg — sizes true, placement unverified
- **Westin · Chastain (level unknown)** — post-renovation rooms; not in the old PDF — find the current plan
- **Courtland Grand · levels unknown** — no plan found in a quick search; the hotel's sales office is the likely source
- **AmericasMart** — several buildings, each with floors; Dragon Con's exhibitor map is the real source. Not searched yet.
- **Hardy Ivy Park** — outdoor; no levels, no plan needed

## Adding an alias

An alias reads a room string the grammar cannot - a numeral style (`Augusta 1-2` for Augusta I and II), a name the
source uses (`Crystal Ballroom`), a room's halves (`Salon`) - and it beats every rule. Add it to the level whose rooms it
names in `data/<year>/venues.json`: the key is the string as the source writes it after the hotel's key, folded to lower
case with single spaces, and the value lists those rooms' ids, every one on that level, or `venues.py` refuses the file.
Then `python tools/room_census.py` shows the string gone from the worklist, and the change goes in as a data PR of its
own.

## How this file is kept

- By hand. A plan found, a copy saved or a drawing begun is an edit to its row here.
- A room, an alias or a level's note is an edit to `data/<year>/venues.json`, which `venues.py` validates; after one,
  `python tools/room_census.py` shows what the rooms reach.
- A plan's local copy names the file in `reference/plans/`; record the retrieval date in the file name if the source
  changes.
