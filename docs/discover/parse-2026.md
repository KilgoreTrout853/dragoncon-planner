# Parse stage - the 2026 schedule

Written by `parse_report.py` from `data/2026/events.json` (`generated_at` 2026-09-07T12:50:19+00:00, source https://app.core-apps.com/dragoncon26). Do not edit it by hand; run the script again.

What `parse_stage.py` reads out of the frozen schedule with no model: `people` and `facets` (DECISIONS #32, `schema-v2.md`). It states facts and recommends nothing. Each facet is shown beside the census's count of the same wording (`census-2026.md`), computed here with the census's own pattern, and any difference is explained. `UNSURE` marks what needs a person's judgment. Titles and names are in code spans so that their punctuation shows as written.

## 0. Headline

1. Events parsed: 3,459. Facet keys set: 1,721, on 380 events besides `repeat_key`'s 1,254.
2. Facets, by how many events carry one: `repeat_key` (1,254), `cost` (214), `signup` (112), `mature` (75), `min_age` (31), `sold_out` (19), `part` (16).
3. People: 1,799 distinct ids over 6,408 appearances. 906 of them only ever reach an event through a description line.
4. Of the 981 events with an "Additional Panelists:" line, 375 have a `speakers` the scraper built from that same line; the two parsers read 8 names differently.
5. Roles: a parenthetical in the name beats a generic field on 9 appearances, 0 of them on an event whose `speakers` is read; `speakers` and the line disagree on 0.
6. UNSURE: wording left unset 12, lines that did not split cleanly 29, one slug with two or more spellings 9, names carrying a from/of tail 19.

## 1. Facets

What `facets_for` set, against the census's count of the same wording. A key is present only where the listing states it; an absent key means the listing says nothing, not "free" or "open". 380 of 3,459 events (11.0%) carry at least one key other than `repeat_key`.

| key | events | the census, for comparison | the gap |
| --- | --- | --- | ---: |
| `mature` | 75 | section 6: 72 events whose text says "Mature Audience" | 71 of those write it as the marker "(Mature Audience)" and 1 without the brackets. "Adults only" is on 5 and brings 1 more; a stated 18+ or over adds the last 2. |
| `min_age` | 31 | section 6: a 13+ to 21+ wording on 31 events | None. The section 6 table's rows sum to 32 because one event states two ages; the higher is the gate: 13+ (1), 16+ (2), 17+ (14), 18+ (13), 21+ (2). |
| `cost` | 214 | section 9: 23 titles carry $ or $$, 45 fee or ticket wording | The census read titles; a price is usually in the description (248 carry fee wording there), and most of the difference is gaming's "Price: $N". No event states a zero or free price. |
| `sold_out` | 19 | section 9: 19 titles say SOLD OUT | None. Two descriptions say it as well, and both belong to events whose title already does. |
| `signup` | 112 | section 9: fee, ticket or pre-registration wording in 45 titles and 248 descriptions | The census's net catches every "ticket" and "fee"; this reads pre-registration wording only, so a gaming prize "500 tickets" and a panel about a $3 trillion space economy set nothing. |
| `part` | 16 | section 9: Part N or Repeat in 16 titles | None. "Repeat" alone gives no number, and no title carries it without a Part N. |
| `repeat_key` | 1,254 | section 11: 371 titles recur, over 1,254 events | None. It is the same key and the same rule: the title with $, SOLD OUT, a clock time and CANCELLED taken out, present only where that key occurs at more than one start. |

- 189 events say there is no fee or charge, 185 of them the photoshoot listings' "There is no charge to participate". `cost` is absent on every one, which is what an absent key means; none of them also carries a price, so no trigger was suppressed.
- Examples are up to 10 distinct titles, evenly spaced through the alphabetical list, as the census does it.

### `mature`: 75

- `'BLERD N OUT'`
- `Audio Erotica in the Digital Space`
- `Botched: A D&D/SCP Comedy Podcast – LIVE!`
- `Concert – Clearly Guilty`
- `Football Hooligans Presents: Divided by a Common Slanguage`
- `Kilt Blowing with Jennie Breeden`
- `No Kidding, There I Was...`
- `Sex Criminals' Chip Zdarsky: Comics for Perverts`
- `The Felt Nerdy and Dirty Star Trek Show!`
- `They Actually Did That? Wild Comics Characters, Covers, and Moments`

### `min_age`: 31

- `Adult Origami *FREE Workshop*` - `18`
- `Alternate & Historical Fiction Mad Libs: Historical Romance, Fiction & More` - `18`
- `BARELY COPING? Play the Game! (17+)` - `17`
- `Bring the Heat: Writing Spicy` - `18`
- `Concert – Clearly Guilty` - `18`
- `Grown-up Games: Warrior Cats, or Game of Thrones?` - `18`
- `Leather Collar/Choker **EXTRA FEE WORKSHOP**` - `18`
- `Puppetry 101 - Adults` - `16`
- `Spectrum: The Rainbow Flag Party` - `21`
- `They Actually Did That? Wild Comics Characters, Covers, and Moments` - `18`

### `cost`: 214

- `101 Ideas in an Hour **EXTRA FEE WORKSHOP**`
- `Convention League`
- `How to Play the Ocarina (and Your First Zelda Song) - $ - 10:30-11:30`
- `Lips-On Voice Acting Workshop w/ Jason Marsden #2 **EXTRA FEE WORKSHOP**`
- `MTG Late Night Flight Mixed RePrerelease`
- `MTG Retro Sealed Duskmourn - MAX 32`
- `More Epic Swordplay: Stage Combat Choreography (Intermediate) **EXTRA FEE**`
- `P&T: Beginner Workshop - Speed Paints`
- `P&T: Intermediate Workshop - Weathering your Minis`
- `Sword & Stage Combat Workshop - Class #1 **EXTRA FEE WORKSHOP**`

### `sold_out`: 19

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

### `signup`: 112

- `26th Annual Dragon Con Parade!`
- `Muscle Nerdz Showdown Pre-Judging`
- `P&T: Beginner Workshop - Intro to Painting Miniatures`
- `P&T: Intermediate Workshop - Fabrics & Folds`
- `P&T: Intermediate Workshop - Weathering your Minis`
- `Rose Tatu Productions Presents: Azul`
- `Rose Tatu Productions Presents: Harmonies`
- `Rose Tatu Productions Presents: Railroad Tiles`
- `Rose Tatu Productions Presents: Ticket to Ride`
- `Why Is It Squishy? JackMonkey FX Workshop – SFX Makeup: Session 2`

### `part`: 16

- `Beyond the Backrooms: Liminal Spaces, Part 2 – Endless Hallway Boogaloo` - `2`
- `Changed for Good: Celebrating Wicked – Part Two` - `2`
- `Intro Sculpting Workshop Part 1: Building a Small Dragon Armature - **$50` - `1`
- `Intro Sculpting Workshop Pt 2: Sculpting on Your Dragon Armature - $$ FEE` - `2`
- `SFS2 1-14/1-15: The Beasts of Bo Part 1/Ruins of the World Soul` - `1`
- `SFS2 1-16/1-17: The Beasts of Bo Part 2/Corpse Fleet Conflict` - `2`
- `SFS2 1-23/1-24: Psychic Echoes/Final Gambit Part 1` - `1`
- `SFS2 1-25/1-26: The Hollowed Shell/Final Gambit Part 2` - `2`
- `Surviving the Fallout Universe: Pt 2!` - `2`
- `VIRTUAL: Secrets and Lies: Wednesday Season 2, Pt.2 Fan Discussion Panel` - `2`

### `repeat_key`: 1,254

- `brandish the duelists card game demo` - 44 events
- `shovel knight dungeon duels learn to play` - 22 events
- `destroy your friends with murder hobo tavern brawl` - 15 events
- `barely coping play the game 17` - 14 events
- `learn to play luminous card game` - 14 events
- `15 minute mentor sessions` - 12 events
- `worn wanderers learn to play` - 11 events
- `urban insanity` - 10 events
- `p and t beginner workshop intro to painting miniatures` - 9 events
- `author signing` - 8 events

## 2. People

- Distinct ids: 1,799, over 6,408 appearances on 3,459 events. An id appears once in an event, and an event's list begins with its `speakers`, in order, except on the events at the end of this section, where `speakers` is not read.
- Ids that reach an event from a description: 928. Ids that reach one no other way - never `src: speakers` anywhere: 906. That is larger than the census's count of the people a line names and `speakers` lacks, because on the events below `speakers` is not read at all, so everyone on them is `src: description`.
- Events carrying an "Additional Panelists:" line: 981.

Roles, over all appearances:

| role | appearances |
| --- | ---: |
| `Speaker` | 3,776 |
| `Panelist` | 1,382 |
| `Moderator` | 1,159 |
| `Judge` | 54 |
| `DJ` | 32 |
| `Moderator Judge` | 2 |
| `(Alt: )` | 1 |
| `Moderator DJ` | 1 |
| `Virtual` | 1 |

### The 20 busiest people who are only ever in a description

Nobody here is ever read from an event's `speakers`, so the registry (#31) would not meet them through one. Some are in a `speakers` the scraper built from the line itself, which is the same thing.

| name | events |
| --- | ---: |
| Karen Henson | 23 |
| Carol Malcolm | 21 |
| Caro McCully | 15 |
| Heather Stephenson | 13 |
| Callie Kelley | 12 |
| Jami Jones | 12 |
| Jennifer Liang | 12 |
| Rob Bowen | 11 |
| Sarah Rose | 11 |
| Alli Martin | 10 |
| Anna Puerta | 10 |
| Ashley Morgan | 9 |
| James Henson | 9 |
| Joe Crowe | 9 |
| Mark Heffernan | 9 |
| Nick Frutiger | 9 |
| Elliot DuPree | 8 |
| Joe Campbell | 8 |
| Karen Bembry | 8 |
| Alex Ferguson | 7 |

### Events whose `speakers` the scraper built from this same line

- 375 of the 981 (38.2%). `scraper.py` fills `speakers` from the description when the detail page has no Speakers section, so on these events `speakers` is not a second source - it is an older parse of the line. `people` is built from the line again, and everyone on it is `src: description`.
- Names the two parsers read differently: 8, over 10 appearances. Names the newer parse adds that the older one never named: 0.

| scraper.extract_panelists | split_panelists | appearances |
| --- | --- | ---: |
| `Daniel Eisenhauer(Judge)` | `Daniel Eisenhauer` | 2 |
| `Elizabeth Carpenter(Judge)` | `Elizabeth Carpenter` | 1 |
| `Eric Holloway . Additional Panelists: Carter Alexander` | `(dropped: it is not one name)` | 1 |
| `James Henson(Judge)` | `James Henson` | 1 |
| `John Rice(Judge)` | `John Rice` | 1 |
| `Karen Henson(Judge)` | `Karen Henson` | 1 |
| `Lucy Boydston(Judge)` | `Lucy Boydston` | 2 |
| `Peggy Eisenhauer(Judge)` | `Peggy Eisenhauer` | 1 |

### Roles that disagree

A role parenthetical the schedule wrote into the name itself beats a role field that only says a person is present (`Speaker`, `Panelist`, or none); a field naming a specific role stands. The schedule does that on 9 appearances, and on 0 of them the `speakers` entry is the one `people` uses - every other one is on an event whose `speakers` the scraper built from the line, where the line is read again instead.

| the `role` field | in the name | kept | `speakers` used | appearances |
| --- | --- | --- | --- | ---: |
| `Moderator` | `Judge` | `Moderator` | no | 3 |
| `Panelist` | `Judge` | `Judge` | no | 6 |

Between `speakers` and the line, `speakers` wins. Events where both are read and they disagree: 0 appearances.

- none

## 3. UNSURE

Nothing below is resolved here.

### Wording left unset: 12

An event whose text carries the census's fee, ticket or registration net and whose `cost` and `signup` are both absent, or whose listing states a price and that there is none. Precision over recall: in doubt the parse sets nothing. With the events that hold each.

- UNSURE: `Charting 2050 & a $3 Trillion Space Economy` (1) - `$3` - wording not acted on
- UNSURE: `Cults of Dragon Con Costume Contest Registration` (1) - `Registration` - wording not acted on
- UNSURE: `Edgewood Avenue: An Improvised Variety Show – PUPPET SHOW` (1) - `ticket` - wording not acted on
- UNSURE: `LotR TCG Cube Draft` (2) - `fee` - wording not acted on
- UNSURE: `P&T: Open Paint` (5) - `ticket` - wording not acted on
- UNSURE: `Pre-Judging Star Wars Costume Contest` (1) - `registration` - wording not acted on
- UNSURE: `Zombie Makeovers!` (1) - `fee` - wording not acted on

### Lines that did not split cleanly: 29

A fragment the splitter kept whole where a person might read two names, a name and an affiliation, or a name and a handle; and a line whose punctuation is its own problem. With the lines that hold each.

- UNSURE: `Amy Bray (501st)` (1) - a parenthetical that is not a role
- UNSURE: `Bob & Carl` (1) - two names joined by "&"
- UNSURE: `Bryan Saunders (Cosplay Medics)` (1) - a parenthetical that is not a role
- UNSURE: `Chrissy Lynn - Black Phoenix Alchemy` (1) - a " - " that is either an affiliation or a surname
- UNSURE: `Gregory Boyle - Atlanta Opera` (1) - a " - " that is either an affiliation or a surname
- UNSURE: `James Farmer - ArtCarp` (1) - a " - " that is either an affiliation or a surname
- UNSURE: `John Hinkle (Roswell Firelab)` (1) - a parenthetical that is not a role
- UNSURE: `Jonelle Dawkins (Scraplanta)` (1) - a parenthetical that is not a role
- UNSURE: `Kat (Ell) Amitran` (1) - a parenthetical that is not a role
- UNSURE: `Kei (tophat_tiara)` (3) - a parenthetical that is not a role
- UNSURE: `Kimchi & Katanas` (1) - two names joined by "&"
- UNSURE: `Maddy with Cut/Sew` (1) - a "with X" tail
- UNSURE: `Matthew (Wally) Wallace` (1) - a parenthetical that is not a role
- UNSURE: `Mira (Cosplay Medic)` (1) - a parenthetical that is not a role
- UNSURE: `Nicole & Ryan Cadaver` (1) - two names joined by "&"
- UNSURE: `Pat Henry - President of Dragon Con` (1) - a " - " that is either an affiliation or a surname
- UNSURE: `Pro from Pros & Cons Cosplay` (1) - two names joined by "&"
- UNSURE: `Ra'Neith (Freeside Makerspace)` (1) - a parenthetical that is not a role
- UNSURE: `Ryan & Nicole Cadaver` (1) - two names joined by "&"
- UNSURE: `Sarah Brown & Jess Lyles` (1) - two names joined by "&"
- UNSURE: `Shahid Mahmud - Arc Manor` (1) - a " - " that is either an affiliation or a surname
- UNSURE: `Shelby Kurland (Decatur Makers)` (1) - a parenthetical that is not a role
- UNSURE: `Theda Daniels - Race` (2) - a " - " that is either an affiliation or a surname
- UNSURE: `Tom Bloom - Black Phoenix Alchemy Lab` (1) - a " - " that is either an affiliation or a surname
- UNSURE: `Toni from Quiltoni - booth 3230` (1) - a " - " that is either an affiliation or a surname
- UNSURE: `Viven (Fresh Frippery)` (1) - a parenthetical that is not a role
- UNSURE: `Dragon Con Sober Meetup` - the line's own marker occurs twice in the description
- UNSURE: `How to Win Illustrators of the Future w/ Tips on Launching Your Art Career` - a doubled or trailing comma, so one fragment is empty
- UNSURE: `The Art of World-Building: Creating Immersive Fantasy Realms` - a doubled or trailing comma, so one fragment is empty

### One slug, two or more spellings: 9

The slug is the id and an id is forever (#31), so these are one person to a follow whether or not they are one person. Merging or separating them is the registry's, with an alias.

- UNSURE: `angela-mattke` - `Angela Mattke MD`, `Dr. Angela Mattke`
- UNSURE: `calvin-watts` - `Calvin Watts`, `Calvin Watts III`
- UNSURE: `elizabeth-murphy-spivey` - `Elizabeth Murphy Spivey`, `Elizabeth Murphy-Spivey`
- UNSURE: `f-wayne-thompson` - `F Wayne Thompson`, `F. Wayne Thompson`
- UNSURE: `k-e-deyarmin` - `K. E. Deyarmin`, `K.E. Deyarmin`
- UNSURE: `laura-j-schroeder` - `Laura J Schroeder`, `Laura J. Schroeder`
- UNSURE: `teresa-spinelli` - `Teresa Spinelli`, `teresa Spinelli`
- UNSURE: `theda-daniels-race` - `Theda Daniels - Race`, `Theda Daniels-Race`, `Theda Daniels-Race PhD`
- UNSURE: `toni-from-quiltoni-booth-3230` - `Toni From Quiltoni booth 3230`, `Toni from Quiltoni - booth 3230`, `Toni from Quiltoni booth 3230`, `Toni from Quiltoni-booth 3230`

### Names carrying a "from X" or "of X" tail: 19

Kept, tail and all: the tail is how the schedule names the person, and an id that moves later is a follow that breaks.

- UNSURE: `Bathroom of the Future`
- UNSURE: `Con of Pros and Cons Cosplay`
- UNSURE: `Daniel Delgado from AllTru2U`
- UNSURE: `Elisa Relano from STL Ocarina`
- UNSURE: `James Farmer of ArtCarp`
- UNSURE: `Maddy with Cut/Sew`
- UNSURE: `Madison May from Cut/Sew`
- UNSURE: `Meg from Megs Mashables`
- UNSURE: `Nayr of StarPodTrek`
- UNSURE: `Pat Henry - President of Dragon Con`
- UNSURE: `Pro from Pros & Cons Cosplay`
- UNSURE: `Pro of Pros and Cons Cosplay`
- UNSURE: `Rebecca Scott from Paperbones`
- UNSURE: `Rebecca from The Evergreen Burrow`
- UNSURE: `Science Guys of Atlanta`
- UNSURE: `Toni From Quiltoni booth 3230`
- UNSURE: `Toni from Quiltoni - booth 3230`
- UNSURE: `Toni from Quiltoni booth 3230`
- UNSURE: `Toni from Quiltoni-booth 3230`