# The registries - seeded, and not yet reviewed

Written by `registry_report.py` from `data/registry/` and `data/2026/events.json` (`generated_at` 2026-09-07T12:50:19+00:00). Do not edit it by hand; run the script again.

What PR 3a seeded into `works.json` and `tracks.json` (DECISIONS #31), for the review that flips a row to `reviewed: true`. It states what was seeded and why, and resolves nothing: `UNSURE` marks a judgment that is a person's to make.

- Works: 139, all `reviewed: false`. Tracks: 54, 26 with axes. People: 0 - PR 3b.
- Phrases labelled: 256. UNSURE: 4. Kept in `src/search.js`: 16. Dropped: 0.
- Coverage: 0 unresolved fandom names, 0 unresolved tracks, 0 unlabelled phrases, 0 tracks whose axes the evidence does not support.

## 1. Works

139 entries, every one `reviewed: false`. 110 carry events under a 2026 fandom name and 29 carry none - a child is seeded whether or not 2026 names it, because the parent link is worth having either way. Rows with events come first; a row with none is marked `-`.

### franchise: 104

| id | name | parent | family | aliases | terms | events |
| --- | --- | --- | --- | --- | --- | ---: |
| `star-trek` | Star Trek |  |  | `Trek` | `Starfleet`, `Klingon`, `Trekkie` | 111 |
| `star-wars` | Star Wars |  |  |  | `Jedi`, `Sith`, `Skywalker`, `Lightsaber` | 58 |
| `marvel` | Marvel |  |  | `MCU`, `Marvel Cinematic Universe`, `Marvel Comics` |  | 51 |
| `dc-comics` | DC Comics |  |  | `DC`, `DC Universe`, `DCEU` |  | 34 |
| `the-lord-of-the-rings` | The Lord of the Rings |  |  | `LOTR` | `Tolkien`, `Middle-earth` | 29 |
| `doctor-who` | Doctor Who |  |  | `Dr Who` | `TARDIS`, `Whovian`, `Dalek` | 23 |
| `game-of-thrones` | Game of Thrones |  |  | `GoT` | `Westeros`, `Targaryen` | 11 |
| `battlestar-galactica` | Battlestar Galactica |  |  | `Battlestar`, `BSG`, `Galactica` |  | 9 |
| `firefly` | Firefly |  |  | `Serenity` | `Whedon` | 9 |
| `stargate` | Stargate |  |  |  |  | 8 |
| `stranger-things` | Stranger Things |  |  |  | `Hawkins` | 8 |
| `starship-troopers` | Starship Troopers |  |  |  |  | 7 |
| `alien` | Alien |  |  | `Aliens` | `Xenomorph` | 6 |
| `my-hero-academia` | My Hero Academia |  |  |  |  | 6 |
| `babylon-5` | Babylon 5 |  |  |  |  | 5 |
| `buffy-the-vampire-slayer` | Buffy the Vampire Slayer |  |  | `Buffy` | `Whedon` | 5 |
| `land-of-the-lost` | Land of the Lost |  |  |  |  | 5 |
| `the-amazing-digital-circus` | The Amazing Digital Circus |  |  |  |  | 5 |
| `hazbin-hotel` | Hazbin Hotel |  |  |  |  | 4 |
| `harry-potter` | Harry Potter |  |  | `Potter`, `Wizarding World` | `Hogwarts` | 3 |
| `the-expanse` | The Expanse |  |  |  | `Rocinante`, `Belter` | 3 |
| `the-magicians` | The Magicians |  |  |  |  | 3 |
| `wynonna-earp` | Wynonna Earp |  |  |  |  | 3 |
| `castle` | Castle |  |  |  |  | 2 |
| `critical-role` | Critical Role |  |  |  |  | 2 |
| `dragon-ball` | Dragon Ball |  |  |  |  | 2 |
| `dune` | Dune |  |  |  |  | 2 |
| `haikyuu` | Haikyuu!! |  |  |  |  | 2 |
| `one-piece` | One Piece |  |  |  |  | 2 |
| `smallville` | Smallville |  |  |  |  | 2 |
| `the-hitchhikers-guide-to-the-galaxy` | The Hitchhiker's Guide to the Galaxy |  |  |  |  | 2 |
| `the-hunger-games` | The Hunger Games |  |  |  |  | 2 |
| `the-muppets` | The Muppets |  |  |  |  | 2 |
| `the-neverending-story` | The NeverEnding Story |  |  |  |  | 2 |
| `the-orville` | The Orville |  |  |  |  | 2 |
| `the-rookie` | The Rookie |  |  |  |  | 2 |
| `the-wheel-of-time` | The Wheel of Time |  |  |  |  | 2 |
| `the-witcher` | The Witcher |  |  |  |  | 2 |
| `transformers` | Transformers |  |  |  |  | 2 |
| `adventure-time` | Adventure Time |  |  |  |  | 1 |
| `buck-rogers-in-the-25th-century` | Buck Rogers in the 25th Century |  |  |  |  | 1 |
| `chainsaw-man` | Chainsaw Man |  |  |  |  | 1 |
| `detective-conan` | Detective Conan |  |  |  |  | 1 |
| `downton-abbey` | Downton Abbey |  |  |  |  | 1 |
| `dracula` | Dracula |  |  |  |  | 1 |
| `dragon-ball-z` | Dragon Ball Z | `dragon-ball` |  |  |  | 1 |
| `frankenstein` | Frankenstein |  |  |  |  | 1 |
| `fullmetal-alchemist` | Fullmetal Alchemist |  |  |  |  | 1 |
| `gargoyles` | Gargoyles |  |  |  |  | 1 |
| `ghostbusters` | Ghostbusters |  |  | `Ghostbuster` |  | 1 |
| `jujutsu-kaisen` | Jujutsu Kaisen |  |  |  |  | 1 |
| `labyrinth` | Labyrinth |  |  |  |  | 1 |
| `mighty-morphin-power-rangers` | Mighty Morphin Power Rangers |  |  |  |  | 1 |
| `mobile-suit-gundam` | Mobile Suit Gundam |  |  |  |  | 1 |
| `nirvanna-the-band-the-show` | Nirvanna the Band the Show |  |  |  |  | 1 |
| `outlander` | Outlander |  |  |  |  | 1 |
| `pee-wees-playhouse` | Pee Wee's Playhouse |  |  |  |  | 1 |
| `ponies` | Ponies |  |  |  |  | 1 |
| `rent` | Rent |  |  |  |  | 1 |
| `rick-and-morty` | Rick and Morty |  |  |  |  | 1 |
| `rwby` | RWBY |  |  |  |  | 1 |
| `schitts-creek` | Schitt's Creek |  |  |  |  | 1 |
| `spirited-away` | Spirited Away |  |  |  |  | 1 |
| `ted-lasso` | Ted Lasso |  |  |  |  | 1 |
| `teenage-mutant-ninja-turtles` | Teenage Mutant Ninja Turtles |  |  |  |  | 1 |
| `the-apothecary-diaries` | The Apothecary Diaries |  |  |  |  | 1 |
| `the-librarians` | The Librarians |  |  |  |  | 1 |
| `the-princess-bride` | The Princess Bride |  |  |  |  | 1 |
| `the-venture-bros` | The Venture Bros |  |  |  |  | 1 |
| `the-walking-dead` | The Walking Dead |  |  |  |  | 1 |
| `twilight` | Twilight |  |  |  |  | 1 |
| `upload` | Upload |  |  |  |  | 1 |
| `vikings` | Vikings |  |  |  |  | 1 |
| `witch-hat-atelier` | Witch Hat Atelier |  |  |  |  | 1 |
| `xena-warrior-princess` | Xena: Warrior Princess |  |  |  |  | 1 |
| `yellowjackets` | Yellowjackets |  |  |  |  | 1 |
| `yu-gi-oh` | Yu-Gi-Oh! |  |  |  |  | 1 |
| `andor` | Andor | `star-wars` |  | `Star Wars: Andor` |  | - |
| `angel` | Angel | `buffy-the-vampire-slayer` |  |  | `Whedon` | - |
| `avengers` | Avengers | `marvel` |  |  |  | - |
| `batman` | Batman | `dc-comics` |  |  | `Gotham` | - |
| `daredevil` | Daredevil | `marvel` |  |  |  | - |
| `deadpool` | Deadpool | `marvel` |  |  |  | - |
| `godzilla` | Godzilla |  |  |  | `Kaiju` | - |
| `house-of-the-dragon` | House of the Dragon | `game-of-thrones` |  |  |  | - |
| `justice-league` | Justice League | `dc-comics` |  |  |  | - |
| `lego` | LEGO |  |  |  | `Brick`, `Bricks` | - |
| `predator` | Predator |  |  |  |  | - |
| `spider-man` | Spider-Man | `marvel` |  | `Spiderman` |  | - |
| `star-trek-deep-space-nine` | Star Trek: Deep Space Nine | `star-trek` |  | `DS9` |  | - |
| `star-trek-discovery` | Star Trek: Discovery | `star-trek` |  |  |  | - |
| `star-trek-enterprise` | Star Trek: Enterprise | `star-trek` |  | `Enterprise` |  | - |
| `star-trek-lower-decks` | Star Trek: Lower Decks | `star-trek` |  | `Lower Decks` |  | - |
| `star-trek-strange-new-worlds` | Star Trek: Strange New Worlds | `star-trek` |  | `Strange New Worlds` |  | - |
| `star-trek-the-next-generation` | Star Trek: The Next Generation | `star-trek` |  | `TNG` |  | - |
| `star-trek-voyager` | Star Trek: Voyager | `star-trek` |  | `Voyager` |  | - |
| `stargate-sg-1` | Stargate SG-1 | `stargate` |  | `SG-1` |  | - |
| `superman` | Superman | `dc-comics` |  |  |  | - |
| `the-hobbit` | The Hobbit | `the-lord-of-the-rings` |  |  |  | - |
| `the-mandalorian` | The Mandalorian | `star-wars` |  |  |  | - |
| `the-rings-of-power` | The Rings of Power | `the-lord-of-the-rings` |  |  |  | - |
| `wolverine` | Wolverine | `marvel` |  |  |  | - |
| `wonder-woman` | Wonder Woman | `dc-comics` |  |  |  | - |
| `x-men` | X-Men | `marvel` |  | `XMen` |  | - |

### game: 35

| id | name | parent | family | aliases | terms | events |
| --- | --- | --- | --- | --- | --- | ---: |
| `dungeons-and-dragons` | Dungeons & Dragons |  | rpg | `D&D`, `DnD`, `5e` | `Dungeon Master`, `DDAL`, `Adventurers League` | 147 |
| `magic-the-gathering` | Magic: The Gathering |  | ccg | `MTG` |  | 89 |
| `pokemon` | Pokemon |  | video | `Pokémon` |  | 38 |
| `warhammer-40000` | Warhammer 40,000 | `warhammer` | miniatures | `40k`, `Warhammer 40k`, `40,000` |  | 18 |
| `pathfinder` | Pathfinder |  | rpg |  |  | 8 |
| `final-fantasy` | Final Fantasy |  | video |  |  | 4 |
| `starfinder` | Starfinder |  | rpg |  |  | 4 |
| `shovel-knight` | Shovel Knight |  | video |  |  | 3 |
| `fallout` | Fallout |  | video |  |  | 2 |
| `halo` | Halo |  | video |  |  | 2 |
| `the-legend-of-zelda` | The Legend of Zelda |  | video | `Zelda` | `Nintendo` | 2 |
| `baldurs-gate` | Baldur's Gate |  | video |  |  | 1 |
| `battletech` | BattleTech |  | miniatures |  |  | 1 |
| `borderlands` | Borderlands |  | video |  |  | 1 |
| `deltarune` | Deltarune |  | video |  |  | 1 |
| `destiny` | Destiny |  | video |  |  | 1 |
| `dragon-age` | Dragon Age |  | video |  |  | 1 |
| `dragon-quest` | Dragon Quest |  | video |  |  | 1 |
| `fire-emblem` | Fire Emblem |  | video |  |  | 1 |
| `flesh-and-blood-tcg` | Flesh & Blood TCG |  | ccg |  |  | 1 |
| `fortnite` | Fortnite |  | video |  |  | 1 |
| `genshin-impact` | Genshin Impact |  | video |  |  | 1 |
| `hades` | Hades |  | video |  |  | 1 |
| `league-of-legends` | League of Legends |  | video |  |  | 1 |
| `mortal-kombat` | Mortal Kombat |  | video |  |  | 1 |
| `omori` | Omori |  | video |  |  | 1 |
| `persona` | Persona |  | video |  |  | 1 |
| `shadowrun` | Shadowrun |  | rpg |  |  | 1 |
| `slay-the-spire` | Slay the Spire |  | video |  |  | 1 |
| `tales-of-the-valiant` | Tales of the Valiant |  | rpg |  |  | 1 |
| `team-fortress-2` | Team Fortress 2 |  | video |  |  | 1 |
| `the-last-of-us` | The Last of Us |  | video |  |  | 1 |
| `zenless-zone-zero` | Zenless Zone Zero |  | video |  |  | 1 |
| `super-mario` | Super Mario |  | video | `Mario` | `Nintendo` | - |
| `warhammer` | Warhammer |  | miniatures |  |  | - |


## 2. Tracks

All 54 tracks of the 2026 schedule. 26 carry axes - the single-topic tracks of census section 10, through schema-v2.md's TOPICS table - and the rest carry none, because the model is asked for axes only where a track does not decide them.

| id | name | aliases | axes | audience | work |
| --- | --- | --- | --- | --- | --- |
| `alternate-and-historical-fiction` | Alternate and Historical Fiction |  |  |  |  |
| `american-sci-fi-and-fantasy-media` | American Sci-fi and Fantasy Media |  |  |  |  |
| `american-sci-fi-classics` | American Sci-fi Classics |  |  |  |  |
| `animation` | Animation |  | medium: animation |  |  |
| `anime-manga` | Anime/Manga |  | medium: anime |  |  |
| `apocalypse-rising` | Apocalypse Rising |  |  |  |  |
| `art-show-programming` | Art Show Programming |  | craft: art |  |  |
| `artemis-spaceship-bridge-simulator` | Artemis Spaceship Bridge Simulator |  | medium: video-games |  |  |
| `author-signings` | Author Signings |  |  |  |  |
| `board-games` | Board Games |  | medium: tabletop |  |  |
| `brittrack` | BritTrack | `Brit`, `British` |  |  |  |
| `collectible-card-games` | Collectible Card Games |  | medium: tabletop |  |  |
| `comics-and-pop-art` | Comics and Pop Art |  | medium: comics |  |  |
| `costuming` | Costuming |  | craft: costuming |  |  |
| `digital-media` | Digital Media |  |  |  |  |
| `diversity-track` | Diversity Track |  |  |  |  |
| `electronic-frontiers-forum` | Electronic Frontiers Forum |  | subject: tech |  |  |
| `epic-photos` | Epic Photos |  |  |  |  |
| `fantasy-literature` | Fantasy Literature |  |  |  |  |
| `filk-music` | Filk Music | `Filk`, `Filking` | medium: music |  |  |
| `film-track` | Film Track |  | medium: film |  |  |
| `group-cosplay-photoshoot` | Group Cosplay Photoshoot |  |  |  |  |
| `high-fantasy` | High Fantasy |  | genre: fantasy |  |  |
| `horror` | Horror |  | genre: horror |  |  |
| `kids-track` | Kids Track |  |  | kids |  |
| `live-action-roleplaying-games` | Live-Action Roleplaying Games | `LARP`, `Live-Action Roleplaying`, `Live Action Roleplaying` |  |  |  |
| `live-performances` | Live Performances |  | medium: music |  |  |
| `live-performances-hyatt-concourse` | Live Performances - Hyatt Concourse |  | medium: music |  |  |
| `main-programming` | Main Programming |  |  |  |  |
| `military-sci-fi-media` | Military Sci-fi Media |  |  |  |  |
| `miniatures-games` | Miniatures Games |  |  |  |  |
| `nsdmg-war-college` | NSDMG / War College |  |  |  |  |
| `puppetry` | Puppetry |  | craft: puppetry |  |  |
| `reading-sessions` | Reading Sessions |  |  |  |  |
| `robotics-and-maker-track` | Robotics and Maker Track |  |  |  |  |
| `role-playing-games-campaign` | Role-Playing Games (Campaign) |  | medium: tabletop |  |  |
| `role-playing-games-non-campaign` | Role-Playing Games (Non-Campaign) |  | medium: tabletop |  |  |
| `sci-fi-literature` | Sci-fi Literature |  | genre: sci-fi |  |  |
| `science` | Science |  | subject: science |  |  |
| `silk-road` | Silk Road |  |  |  |  |
| `skeptics` | Skeptics | `Skeptrack`, `Skeptic` | subject: skepticism |  |  |
| `space` | Space |  | subject: space |  |  |
| `star-wars` | Star Wars |  |  |  | `star-wars` |
| `table-top-gaming` | Table Top Gaming |  | medium: tabletop |  |  |
| `trek-track` | Trek Track |  |  |  | `star-trek` |
| `urban-fantasy` | Urban Fantasy |  |  |  |  |
| `vendor-workshops-events` | Vendor Workshops/Events |  |  |  |  |
| `video-gaming` | Video Gaming |  |  |  |  |
| `video-room` | Video Room |  |  |  |  |
| `werewolf-games` | Werewolf Games |  | medium: tabletop |  |  |
| `workshops` | Workshops |  |  |  |  |
| `writers-track` | Writer's Track |  | craft: writing |  |  |
| `xtrack` | XTrack |  |  |  |  |
| `young-adult-literature` | Young Adult Literature | `YA`, `Young Adult` | medium: books |  |  |

### Calls made

Decided here, not left open.

- `type` -> where the work started: it picks a shelf and nothing more, so a work that grew into something else keeps the type it began with: `pokemon` is `game`/`video` and `yu-gi-oh` a `franchise`, because one began on a Game Boy and the other as a manga. `fallout`, `halo`, `the-last-of-us`, `battletech` and `critical-role` keep the type they were drafted with for the same reason.
- `warhammer` -> a work of its own, the parent of `warhammer-40000`: `CANON` folds "warhammer" into 40,000; it is really the parent, and Warhammer Fantasy is its other child. "Warhammer" is no longer an alias of the child.
- `ponies` -> kept as the schedule writes it: not My Little Pony: its one event calls it "the Peacock show Ponies" and talks about Moscow and a season 2, so the id is `ponies` and no other name is minted.
- `avengers` -> id `avengers`, name "Avengers": BritTrack has its own The Avengers, and an id is forever; `the-avengers` would have claimed the name before anyone chose which one gets it.
- Group Cosplay Photoshoot, Live-Action Roleplaying Games -> no axes: the rule offers each one a value and each declines it: the track is the facet, and an axis would say less than the track's own name.
- Kids Track -> `audience: kids`, no axes: schema-v2.md sends the topic Kids to `audience`, which is not one of the four axes.

### The evidence for a track's axes

A track takes a value on an axis where that one value covers at least 80% of its **tagged** events, after each v1 topic is mapped to its v2 home (schema-v2.md's TOPICS table). `Gaming` has no single home, so on a track it is the medium that track plays in: `video-games` on Video Gaming and Artemis Spaceship Bridge Simulator, `tabletop` elsewhere. The best candidate on each axis is shown whether or not it clears, so that a track that takes nothing shows how far off it was.

| track | tagged | best candidate per axis | at 80% | held |
| --- | --- | --- | ---: | ---: |
| `alternate-and-historical-fiction` | 64 | subject: history 55%, medium: books 30%, craft: costuming 14% | - | - |
| `american-sci-fi-and-fantasy-media` | 61 | medium: tv 59%, genre: sci-fi 44%, subject: fandom-culture 26% | - | - |
| `american-sci-fi-classics` | 45 | medium: tv 42%, genre: sci-fi 40%, subject: fandom-culture 20% | - | - |
| `animation` | 48 | medium: animation 96%, subject: fandom-culture 15%, genre: comedy 6% | `medium: animation` | `medium: animation` |
| `anime-manga` | 35 | medium: anime 97%, subject: fandom-culture 14%, craft: costuming 6% | `medium: anime` | `medium: anime` |
| `apocalypse-rising` | 35 | genre: sci-fi 37%, subject: science 23%, medium: tv 14% | - | - |
| `art-show-programming` | 38 | craft: art 89%, subject: community 16%, genre: fantasy 11% | `craft: art` | `craft: art` |
| `artemis-spaceship-bridge-simulator` | 5 | medium: video-games 100%, genre: sci-fi 60%, subject: tech 60% | `medium: video-games` | `medium: video-games` |
| `author-signings` | 15 | medium: books 73%, genre: fantasy 13%, subject: fandom-culture 7% | - | - |
| `board-games` | 65 | medium: tabletop 100%, genre: horror 2% | `medium: tabletop` | `medium: tabletop` |
| `brittrack` | 50 | medium: tv 46%, subject: fandom-culture 22%, genre: sci-fi 14% | - | - |
| `collectible-card-games` | 240 | medium: tabletop 100%, genre: fantasy 5% | `medium: tabletop` | `medium: tabletop` |
| `comics-and-pop-art` | 67 | medium: comics 93%, craft: art 34%, subject: fandom-culture 7% | `medium: comics` | `medium: comics` |
| `costuming` | 76 | craft: costuming 88%, subject: community 12%, medium: film 3% | `craft: costuming` | `craft: costuming` |
| `digital-media` | 134 | medium: podcast-web 49%, subject: community 25%, craft: art 16% | - | - |
| `diversity-track` | 35 | subject: community 49%, craft: art 29%, medium: comics 23% | - | - |
| `electronic-frontiers-forum` | 39 | subject: tech 85%, craft: art 5%, genre: sci-fi 5% | `subject: tech` | `subject: tech` |
| `epic-photos` | 312 | craft: photography 7%, medium: tv 2% | - | - |
| `fantasy-literature` | 33 | medium: books 76%, genre: fantasy 67%, craft: writing 33% | - | - |
| `filk-music` | 35 | medium: music 100%, subject: fandom-culture 26%, genre: comedy 3% | `medium: music` | `medium: music` |
| `film-track` | 28 | medium: film 100%, subject: tech 25%, craft: writing 18% | `medium: film` | `medium: film` |
| `group-cosplay-photoshoot` | 185 | craft: photography 100%, subject: fandom-culture 4%, medium: anime 3% | `craft: photography` - declined, 186 cosplay meetups are not "the craft of photography" | - |
| `high-fantasy` | 50 | genre: fantasy 80%, medium: books 54%, craft: writing 12% | `genre: fantasy` | `genre: fantasy` |
| `horror` | 40 | genre: horror 95%, medium: film 28%, subject: fandom-culture 12% | `genre: horror` | `genre: horror` |
| `kids-track` | 48 | craft: art 23%, medium: tabletop 12%, subject: community 12% | - | - |
| `live-action-roleplaying-games` | 3 | medium: tabletop 100%, genre: fantasy 67% | `medium: tabletop` - declined, a LARP is not played at a table | - |
| `live-performances` | 19 | medium: music 89%, subject: community 11%, genre: comedy 5% | `medium: music` | `medium: music` |
| `live-performances-hyatt-concourse` | 32 | medium: music 94%, genre: comedy 6%, subject: fandom-culture 6% | `medium: music` | `medium: music` |
| `main-programming` | 96 | subject: community 33%, medium: music 12%, craft: art 10% | - | - |
| `military-sci-fi-media` | 44 | genre: sci-fi 70%, medium: tv 66%, subject: community 16% | - | - |
| `miniatures-games` | 123 | medium: tabletop 73%, craft: art 38%, genre: fantasy 6% | - | - |
| `nsdmg-war-college` | 25 | subject: history 52%, medium: tabletop 28%, genre: sci-fi 16% | - | - |
| `puppetry` | 42 | craft: puppetry 100%, genre: comedy 7%, medium: music 7% | `craft: puppetry` | `craft: puppetry` |
| `reading-sessions` | 22 | medium: books 77% | - | - |
| `robotics-and-maker-track` | 51 | subject: tech 73%, craft: props-making 39%, genre: sci-fi 6% | - | - |
| `role-playing-games-campaign` | 177 | medium: tabletop 100%, genre: fantasy 29%, subject: space 2% | `medium: tabletop` | `medium: tabletop` |
| `role-playing-games-non-campaign` | 240 | medium: tabletop 100%, genre: fantasy 35%, subject: food 0% | `medium: tabletop` | `medium: tabletop` |
| `sci-fi-literature` | 30 | genre: sci-fi 80%, medium: books 73%, craft: writing 20% | `genre: sci-fi` | `genre: sci-fi` |
| `science` | 43 | subject: science 95%, genre: sci-fi 7%, medium: film 5% | `subject: science` | `subject: science` |
| `silk-road` | 29 | medium: film 31%, craft: art 24%, subject: history 21% | - | - |
| `skeptics` | 31 | subject: skepticism 87%, genre: comedy 16%, craft: art 10% | `subject: skepticism` | `subject: skepticism` |
| `space` | 42 | subject: space 98%, craft: props-making 2%, genre: comedy 2% | `subject: space` | `subject: space` |
| `star-wars` | 35 | subject: fandom-culture 43%, genre: sci-fi 37%, medium: film 17% | - | - |
| `table-top-gaming` | 47 | medium: tabletop 98%, subject: history 9%, genre: horror 6% | `medium: tabletop` | `medium: tabletop` |
| `trek-track` | 52 | medium: tv 63%, genre: sci-fi 40%, subject: fandom-culture 33% | - | - |
| `urban-fantasy` | 67 | genre: fantasy 63%, medium: tv 42%, craft: writing 15% | - | - |
| `vendor-workshops-events` | 139 | medium: books 47%, craft: costuming 12% | - | - |
| `video-gaming` | 58 | medium: video-games 69%, subject: tech 10%, craft: photography 5% | - | - |
| `video-room` | 88 | medium: film 58%, genre: sci-fi 26%, craft: puppetry 1% | - | - |
| `werewolf-games` | 12 | medium: tabletop 100% | `medium: tabletop` | `medium: tabletop` |
| `workshops` | 32 | craft: writing 69%, subject: fitness 16%, medium: animation 6% | - | - |
| `writers-track` | 44 | craft: writing 100%, medium: books 14%, subject: community 7% | `craft: writing` | `craft: writing` |
| `xtrack` | 40 | subject: paranormal 65%, medium: tv 18%, genre: horror 8% | - | - |
| `young-adult-literature` | 28 | medium: books 89%, subject: fandom-culture 18%, craft: writing 14% | `medium: books` | `medium: books` |

- Tracks the rule gives a value: 28; of those, 2 decline it, below. Tracks where the file and the rule disagree: **0**.


### What the schedule says about the search-only words

Events whose title or description holds the word. The axis lists are schema-v2.md's and nothing here changes them; this is the count a decision about them would rest on.

| words | events | of those, in the title |
| --- | ---: | ---: |
| `romance, romantasy` | 13 | 8 |
| `wrestling` | 5 | 2 |
| `karaoke, sing-along` | 29 | 20 |
| `dance, dancing` | 43 | 21 |

## 3. Every phrase of CANON and SYNONYMS

`tag_events.CANON` and `src/search.js`'s `SYNONYMS` are associations, not identities, so each of their 256 distinct phrases carries one label. A **work** is the seeded entry's own name, an **alias** another name for it, a **child** a work with a parent, a **term** a word that should lead a searcher to a work but is not a name for it (terms never resolve), **elsewhere** a v2 home that is not a work, **search-only** a phrase the registries have no home for that stays in `src/search.js`, and **dropped** a phrase that is wrong. Nothing is dropped for lacking a registry home.

- **elsewhere** (129), **alias** (36), **term** (28), **work** (26), **child** (21), **search-only** (16).

### work: 26

| phrase | where it went |
| --- | --- |
| `alien` | alien |
| `dc comics` | dc-comics |
| `doctor who` | doctor-who |
| `dungeons & dragons` | dungeons-and-dragons |
| `dungeons and dragons` | dungeons-and-dragons |
| `expanse` | the-expanse |
| `firefly` | firefly |
| `game of thrones` | game-of-thrones |
| `ghostbusters` | ghostbusters |
| `godzilla` | godzilla |
| `harry potter` | harry-potter |
| `lego` | lego |
| `lord of the rings` | the-lord-of-the-rings |
| `magic the gathering` | magic-the-gathering |
| `marvel` | marvel |
| `pathfinder` | pathfinder |
| `pokemon` | pokemon |
| `pokémon` | pokemon |
| `predator` | predator |
| `rick & morty` | rick-and-morty |
| `rick and morty` | rick-and-morty |
| `star trek` | star-trek |
| `star wars` | star-wars |
| `stargate` | stargate |
| `stranger things` | stranger-things |
| `warhammer` | warhammer |

### alias: 36

| phrase | where it went |
| --- | --- |
| `40,000` | warhammer-40000 |
| `40k` | warhammer-40000 |
| `5e` | dungeons-and-dragons |
| `aliens` | alien |
| `battlestar` | battlestar-galactica |
| `bsg` | battlestar-galactica |
| `buffy` | buffy-the-vampire-slayer |
| `d&d` | dungeons-and-dragons |
| `dc` | dc-comics |
| `dc universe` | dc-comics |
| `dceu` | dc-comics |
| `dnd` | dungeons-and-dragons |
| `dr who` | doctor-who |
| `ds9` | star-trek-deep-space-nine |
| `galactica` | battlestar-galactica |
| `ghostbuster` | ghostbusters |
| `got` | game-of-thrones |
| `lotr` | the-lord-of-the-rings |
| `mario` | super-mario |
| `marvel cinematic universe` | marvel |
| `marvel comics` | marvel |
| `mcu` | marvel |
| `mtg` | magic-the-gathering |
| `potter` | harry-potter |
| `serenity` | firefly |
| `sg-1` | stargate-sg-1 |
| `spiderman` | spider-man |
| `star wars: andor` | andor |
| `strange new worlds` | star-trek-strange-new-worlds |
| `tng` | star-trek-the-next-generation |
| `trek` | star-trek |
| `voyager` | star-trek-voyager |
| `warhammer 40k` | warhammer-40000 |
| `wizarding world` | harry-potter |
| `xmen` | x-men |
| `zelda` | the-legend-of-zelda |

### child: 21

| phrase | where it went |
| --- | --- |
| `andor` | andor under star-wars |
| `angel` | angel under buffy-the-vampire-slayer |
| `avengers` | avengers under marvel |
| `batman` | batman under dc-comics |
| `daredevil` | daredevil under marvel |
| `deadpool` | deadpool under marvel |
| `hobbit` | the-hobbit under the-lord-of-the-rings |
| `house of the dragon` | house-of-the-dragon under game-of-thrones |
| `justice league` | justice-league under dc-comics |
| `mandalorian` | the-mandalorian under star-wars |
| `rings of power` | the-rings-of-power under the-lord-of-the-rings |
| `spider-man` | spider-man under marvel |
| `star trek: discovery` | star-trek-discovery under star-trek |
| `star trek: strange new worlds` | star-trek-strange-new-worlds under star-trek |
| `star trek: the next generation` | star-trek-the-next-generation under star-trek |
| `superman` | superman under dc-comics |
| `the mandalorian` | the-mandalorian under star-wars |
| `warhammer 40000` | warhammer-40000 under warhammer |
| `wolverine` | wolverine under marvel |
| `wonder woman` | wonder-woman under dc-comics |
| `x-men` | x-men under marvel |

### term: 28

| phrase | where it went |
| --- | --- |
| `adventurers league` | dungeons-and-dragons |
| `belter` | the-expanse |
| `brick` | lego |
| `bricks` | lego |
| `dalek` | doctor-who |
| `ddal` | dungeons-and-dragons |
| `dungeon master` | dungeons-and-dragons |
| `gotham` | batman |
| `hawkins` | stranger-things |
| `hogwarts` | harry-potter |
| `jedi` | star-wars |
| `kaiju` | godzilla |
| `klingon` | star-trek |
| `lightsaber` | star-wars |
| `middle-earth` | the-lord-of-the-rings |
| `nintendo` | super-mario, the-legend-of-zelda |
| `rocinante` | the-expanse |
| `sith` | star-wars |
| `skywalker` | star-wars |
| `starfleet` | star-trek |
| `tardis` | doctor-who |
| `targaryen` | game-of-thrones |
| `tolkien` | the-lord-of-the-rings |
| `trekkie` | star-trek |
| `westeros` | game-of-thrones |
| `whedon` | angel, buffy-the-vampire-slayer, firefly |
| `whovian` | doctor-who |
| `xenomorph` | alien |

### elsewhere: 129

| phrase | where it went |
| --- | --- |
| `18+` | the `min_age` facet |
| `adult` | the `mature` facet |
| `adults only` | the `mature` facet |
| `after dark` | the `mature` facet |
| `all ages` | audience: kids |
| `anime` | medium: anime |
| `arcade` | medium: video-games |
| `astronaut` | subject: space |
| `astronomy` | subject: space |
| `author` | craft: writing |
| `authors` | craft: writing |
| `autograph` | the kind `signing` |
| `autographs` | the kind `signing` |
| `band` | medium: music |
| `biology` | subject: science |
| `board game` | medium: tabletop |
| `board games` | the track board-games |
| `boardgame` | medium: tabletop |
| `brit` | the track brittrack |
| `british` | the track brittrack |
| `brittrack` | the track brittrack |
| `burlesque` | the `mature` facet and audience: mature |
| `card game` | medium: tabletop |
| `championship` | the kind `contest` |
| `chemistry` | subject: science |
| `children` | audience: kids |
| `classical music` | medium: music |
| `comic book` | medium: comics |
| `comic books` | medium: comics |
| `comics` | medium: comics |
| `competition` | the kind `contest` |
| `concert` | the kind `performance` |
| `console` | medium: video-games |
| `contest` | the kind `contest` |
| `cosplay` | craft: costuming |
| `costume` | craft: costuming |
| `costumer` | craft: costuming |
| `costuming` | the track costuming |
| `dance party` | the kind `party` |
| `deck-building` | medium: tabletop |
| `dj` | medium: music, and a role the schedule writes in `speakers` |
| `epic fantasy` | genre: fantasy |
| `esports` | medium: video-games |
| `exoplanet` | subject: space |
| `family` | audience: kids |
| `fantasy` | genre: fantasy |
| `filk` | the track filk-music |
| `filk music` | the track filk-music |
| `filking` | the track filk-music |
| `folk music` | medium: music |
| `gamer` | medium: video-games |
| `graphic novel` | medium: comics |
| `haunted` | genre: horror |
| `high fantasy` | the track high-fantasy |
| `horror` | the track horror |
| `jpl` | subject: space |
| `kids` | audience: kids |
| `larp` | the track live-action-roleplaying-games |
| `late night` | the `mature` facet |
| `live action roleplaying` | the track live-action-roleplaying-games |
| `live music` | medium: music |
| `live-action roleplaying` | the track live-action-roleplaying-games |
| `manga` | medium: anime |
| `manuscript` | craft: writing |
| `mars` | subject: space |
| `masquerade` | craft: costuming |
| `miniatures` | medium: tabletop, and the game family `miniatures` |
| `minis` | medium: tabletop, and the game family `miniatures` |
| `moon landing` | subject: space |
| `music` | medium: music |
| `musicians` | medium: music |
| `nasa` | subject: space |
| `novel` | craft: writing |
| `orbit` | subject: space |
| `otaku` | medium: anime |
| `photo op` | the kind `photo` |
| `photo session` | the kind `photo` |
| `photos with` | the kind `photo` |
| `physics` | subject: science |
| `planetary` | subject: space |
| `playstation` | medium: video-games |
| `podcast` | medium: podcast-web |
| `podcasters` | medium: podcast-web |
| `podcasting` | medium: podcast-web |
| `publishing` | craft: writing |
| `puppet` | craft: puppetry |
| `puppet slam` | craft: puppetry |
| `puppetry` | the track puppetry |
| `puppets` | craft: puppetry |
| `rave` | the kind `party` |
| `rocket` | subject: space |
| `role-playing` | medium: tabletop |
| `roleplaying` | medium: tabletop |
| `scary` | genre: horror |
| `science` | the track science |
| `scientist` | subject: science |
| `shonen` | medium: anime |
| `signing` | the kind `signing` |
| `skeptic` | the track skeptics |
| `skeptics` | the track skeptics |
| `skeptrack` | the track skeptics |
| `slasher` | genre: horror |
| `space` | the track space |
| `spaceflight` | subject: space |
| `steam` | medium: video-games |
| `stem` | subject: science |
| `tabletop` | medium: tabletop |
| `tabletop rpg` | medium: tabletop |
| `telescope` | subject: space |
| `tournament` | play.format: tournament |
| `ttrpg` | medium: tabletop |
| `urban fantasy` | the track urban-fantasy |
| `video game` | medium: video-games |
| `video games` | medium: video-games |
| `video gaming` | the track video-gaming |
| `videogame` | medium: video-games |
| `videogames` | medium: video-games |
| `wargame` | medium: tabletop, and the game family `miniatures` |
| `wargaming` | medium: tabletop, and the game family `miniatures` |
| `worldbuilding` | craft: writing |
| `writer` | craft: writing |
| `writers` | craft: writing |
| `writing` | craft: writing |
| `xbox` | medium: video-games |
| `ya` | the track young-adult-literature |
| `young` | audience: kids |
| `young adult` | the track young-adult-literature |
| `zombie` | genre: horror |
| `zombies` | genre: horror |

### search-only: 16

| phrase | where it went |
| --- | --- |
| `ball` | an activity no axis names, and too common a word to be a term |
| `dance` | an activity no axis names |
| `dancing` | an activity no axis names |
| `karaoke` | an activity no axis names |
| `orchestra` | an ensemble, not a work |
| `paranormal romance` | `subject: paranormal` is about the paranormal, not the genre of romance |
| `philharmonic` | an ensemble, not a work |
| `romance` | no romance value on any of the four axes |
| `romantasy` | no romance value on any of the four axes |
| `sing along` | an activity no axis names |
| `sing-along` | an activity no axis names |
| `singalong` | an activity no axis names |
| `symphony` | an ensemble, not a work |
| `wrestle` | no axis has a value for it |
| `wrestlers` | no axis has a value for it |
| `wrestling` | no axis has a value for it |

### Groups that name no work: 28

Search vocabulary and nothing else, so `src/search.js` keeps them; the registries have nothing to say about them.

- `symphony`, `orchestra`, `philharmonic`, `concert`, `classical music`
- `skeptrack`, `skeptics`, `skeptic`
- `filk`, `filk music`, `filking`
- `larp`, `live-action roleplaying`, `live action roleplaying`
- `anime`, `manga`, `shonen`, `otaku`
- `cosplay`, `costume`, `costuming`, `costumer`, `masquerade`
- `space`, `nasa`, `astronomy`, `astronaut`, `rocket`, `planetary`, `spaceflight`, `jpl`, `telescope`, `exoplanet`, `orbit`, `mars`, `moon landing`
- `science`, `physics`, `biology`, `chemistry`, `stem`, `scientist`
- `video game`, `video games`, `video gaming`, `videogame`, `esports`, `arcade`, `console`, `gamer`, `playstation`, `xbox`, `nintendo`, `steam`
- `board game`, `board games`, `boardgame`, `tabletop`, `card game`, `deck-building`
- `horror`, `scary`, `slasher`, `zombie`, `zombies`, `haunted`
- `writing`, `writers`, `writer`, `author`, `authors`, `novel`, `publishing`, `manuscript`, `worldbuilding`
- `comics`, `comic book`, `comic books`, `graphic novel`
- `puppet`, `puppets`, `puppetry`, `puppet slam`
- `burlesque`, `18+`, `adults only`, `after dark`, `late night`, `adult`
- `kids`, `children`, `family`, `all ages`, `young`
- `wrestling`, `wrestlers`, `wrestle`
- `karaoke`, `sing-along`, `singalong`, `sing along`
- `signing`, `autograph`, `autographs`
- `photo op`, `photo session`, `photos with`
- `music`, `band`, `dj`, `dance party`, `rave`, `live music`, `musicians`
- `filk`, `folk music`
- `fantasy`, `high fantasy`, `epic fantasy`, `urban fantasy`
- `romance`, `romantasy`, `paranormal romance`
- `young adult`, `ya`
- `podcast`, `podcasting`, `podcasters`
- `contest`, `competition`, `tournament`, `championship`
- `dance`, `dancing`, `ball`

## 4. UNSURE

4 judgments a person has to make. Nothing here is resolved, and every work is `reviewed: false` until one is.

- UNSURE: `angel` (Angel) - Seeded as a child of Buffy the Vampire Slayer. A bare "Angel" is an ambiguous name to resolve, and this is the only entry whose name is an everyday word.
- UNSURE: `dragon-ball-z` (Dragon Ball Z) - Seeded as a child of Dragon Ball rather than merged with it. The census flags the two as a prefix pair (section 2); they are one v1 name each.
- UNSURE: `predator` (Predator) - Seeded on two 2026 mentions, of which one is `D&D 5.5E: Crowning The Apex Predator` - not the film. The other, `Predator: The Hunt Re-Imagined`, is.
- UNSURE: character-led children (`batman`, `superman`, `wonder-woman`, `justice-league`, `spider-man`, `x-men`, `avengers`, `wolverine`, `deadpool`, `daredevil`) - seeded as child works, following the brief's own "batman under dc-comics". A character is not a franchise, and a reviewer may want some of them folded into the parent instead.

## 5. Coverage

- Of the 116 fandom names in the frozen file, 111 resolve to a work and 5 are left out on purpose. Unresolved: **0**.
- Of the 54 distinct values in `tracks[]`, all but **0** resolve to a track.
- Phrases of CANON and SYNONYMS with no label: **0**.

The five names left out, each an axis value in v2 rather than a work:

| fandom name | events | its v2 home |
| --- | ---: | ---: |
| `Animation` | 1 | medium: animation |
| `Anime` | 32 | medium: anime |
| `Comics` | 3 | medium: comics |
| `Fantasy` | 1 | genre: fantasy |
| `Video Games` | 13 | medium: video-games |