# Scope — 2027

The scope pass's list (DECISIONS #57): what the app does on `next` today,
the features wanted for 2027 beside it, and their verdicts, once the design
chat has passed each through VISION's test. Section 1 is read before
section 2, so that every verdict is made against what is already built. A
feature here is described, not designed: it is specified when its tentpole
opens (#30).

## 1. What the app does on `next` today

One row a feature: a thing a person can do, or that the app does for them,
on `next` as it stands; a row that needs a backend says so, and the next
site's build has one, the live site's none. Owners are `src/`'s modules by
name, and anything else by its path. Since is 2026, or 2027 with the pull
request that added it; "2026; PR #N" is a 2026 feature that a 2027 pull
request reshaped, and the row says how. A row a reader may not meet today
says UNSURE, and why. Left out: the developer affordances - the time
override (`?now=`, Settings' preview time and the simulated-time chip), the
dev-build mark and the device readout - and operations, which Appendix B
lists.

| id | feature | how it works | owner | since | pillar |
|---|---|---|---|---|---|
| B1 | Search the whole schedule | Every event, searched by its title, people, fandoms, tracks, topics, kind, description and place: ranked, forgiving of prefixes and typos, with the con's synonyms, the matched words marked and what already happened folded away; with no query, a day's events by time. Since PR #31 the fandoms are works and the topics the four axes, and a work's registry aliases and terms reach the index. | `search.js`, `browse.js` | 2026; PR #31 | Plan |
| B2 | A query's filter words become chips | "star trek saturday hilton" searches "star trek" on Saturday at the Hilton: day, hotel, kind, time-of-day, today, tonight, tomorrow, 18+ and kids words are taken out of the query as chips a tap removes, and a query of filter words alone is scoped to today. | `search.js`, `browse.js` | 2026 | Plan |
| B3 | Filter by day, hotel, kind, type, fandom and track | Chips for the day, the hotel and the kind, panels or gaming, and selects for the fandom and the track; photo sessions and video-room screenings are hidden by default, as Settings sets, unless a search asks for them. Since PR #31 the fandom select holds the reviewed works with three or more events. Since PR #88 all but the day are in the filter sheet, behind a Filters button beside the box: each tap applies at once and the sheet counts what the list will hold; each filter in effect is a chip under the box, and the button's badge counts them (W13; #70). | `browse.js`, `search.js`, `filters.js`, `sheet.js`, `dispatch.js` | 2026; PR #31; PR #88 | Plan |
| B4 | Name suggestions as you type | Under the box, the people and the fandoms or topics that match what is typed, each with its count; a tap searches that name exactly, and a search for a person offers the photo sessions the filter held back. | `search.js`, `browse.js` | 2026 | Plan |
| B5 | An event's details | A tap on a row opens its sheet: the day and time, the length, a late night's con day, the place, cancelled or removed, the celebrity mark, the description, everyone on it with their role and a link to their page, its track and works, 18+; a star, and Add to calendar. Since PR #94 the place is a tap that shows the event on the Map, and each track and each reviewed work a tap to its Explore page (#75). | `sheet.js`, `eventsheet.js`, `dispatch.js` | 2026; PR #94 | Plan |
| B6 | Star an event; picks persist and sync | A star on any row or sheet adds the event to the plan, kept on the phone. Since PR #56, once the phone has a user - the email step mints one - each star and unstar goes up through an outbox, the latest stamp winning per pick; with the backend down the app works as the 2026 app did. | `picks.js`, `shell.js`, `outbox.js`, `sync.js` | 2026; PR #56 | Plan; Keep |
| B7 | Now: your current or next pick | The Now tab opens on the pick that is on or next, a ring counting down to its end or its start, then the rest of today's picks, "In N min" as they near; with nothing left today, the next day's first pick; before the con, a preview of its first full day at 10:00. | `now.js`, `time.js` | 2026 | Plan |
| B8 | On now and in the next hour | Under the reader's picks, everything on now or starting within the hour, by start time, a chip for each hotel, photo sessions and screenings hidden as Search hides them. | `now.js` | 2026 | Plan |
| B9 | Leave-by, to be retired | When a pick is on now and the next is in another hotel, a time to leave by - the walk at the crowd factor plus the slack - on the Now tab's card, the bar above the nav and the map's card; #40 retires it when Where things live reworks the Now tab. | `leave.js`, `now.js`, `shell.js`, `map.js` | 2026 | Plan |
| B10 | Walk times, tight connections and clashes | Between one pick and the next: an overlap is said, a gap shorter than the walk is flagged, and one shorter than the walk and the slack is "tight but doable" (#40); the timeline draws each walk between hotels, and the Now card, with nothing on, gives the walk from the last pick. Walks scale by the crowd factor in Settings, whose Advanced panel shows the walk table. Since PR #50 the walk and the slack are the venues file's. Since PR #92 an overlap is said on each overlapping pick's row, wherever it is drawn, and no longer between them; the line between picks keeps the walk and the two tight bands (W1; #73). | `leave.js`, `venues.js`, `now.js`, `mine.js`, `sheet.js`; `walk.js`, `ui.js` | 2026; PR #50; PR #92 | Plan |
| B11 | The next pick above the nav | On Search, Explore and Mine, a bar with the con day's next pick, its place and when it starts - or its leave-by - which a tap takes to Now; not on Now or the Map, and not after the con. [The bar shows a relative time, "in 47 min", or a leave-by, never the start's clock time: `docs/screens/recon.md`, section 1.] | `shell.js` | 2026 | Plan |
| B12 | Mine: your plan by day | Every pick by con day, as a timeline - clashes side by side, the walks drawn, a line at now - or as a list with the gap lines between picks; Remove all, here or in Settings. Since PR #50 a pick on an event the source dropped stays here alone, struck and marked. | `mine.js` | 2026; PR #50 | Plan |
| B13 | Calendar export | Mine's Export writes an `.ics` of every pick still on the schedule, and an event's sheet one of that event, in the con's time zone, with who is on it and its track. | `ics.js` | 2026 | Plan |
| B14 | The map | A schematic of the hotels, the two streets and the skybridges: the reader's picks per hotel on a chosen day, rings on the hotels of the pick on now and the next, a card for the next pick below, the picks streaming or offsite counted, and a tap on a hotel for its picks that day, or a search of it. Since PR #94 the place on an event's sheet opens the Map focused on that event: its con day, a third ring, not gold, on its hotel, and the event on the card, until the tab is left, a day is chosen or the clock is changed (#75). | `map.js`, `sheet.js` | 2026; PR #94 | Plan |
| B15 | Explore | Everything that can be followed, as tiles with counts - tracks, fandoms, topics, guests, panelists - with a filter box and chips that jump to a section; a page for each, its events to come and those past, which a link can open (`#explore=`). Since PR #31 the fandoms are reviewed works and the topics the four axes, and a work's page ends with its cast, folded. | `explore.js`, `data.js` | 2026; PR #31 | Plan |
| B16 | Follow a track, fandom, topic or person | A page's Follow adds it to the Following feed at the top of Explore, which lists what each follow brings, by interest or by time, and folds away. Since PR #31 a follow is kept by id, and an unreviewed work is never followable; since PR #56 follows sync as picks do. | `follows.js`, `explore.js`, `sync.js` | 2026; PRs #31 and #56 | Plan; Keep |
| B17 | Follows suggested by your picks | "Because you starred": up to six tracks, fandoms and guests behind the reader's picks that the reader does not follow yet. | `explore.js` | 2026 | Plan |
| B18 | Larger text | A switch in Settings scales every size but the map's, kept apart so that nothing that resets settings shrinks it. | `shell.js`, `sheet.js` | 2026 | none |
| B19 | A fresh schedule, hourly through the con | In the season's window, 2027-08-01 to 2027-09-07, the pipeline fetches the source every hour, keeps each event's id, tags new text and builds the file, and lands each change by pull request once CI passes; a run that fails commits nothing, so the last good schedule stands, and the page offers the new one (B20). Built, and not yet run on a live season: the client on `next` reads 2026's frozen file until `DC_YEAR` is 2027. | `pipeline.py`, `.github/workflows/scrape.yml` | 2027 (PR #49) | Live |
| B20 | How fresh the schedule is, and a newer one offered | The header gives the events' count and how long since the schedule was refreshed, "offline copy" when it came from the cache, and "final schedule" after the con; when the worker finds a newer file, a pill offers it rather than redraw under a thumb, and coming back after fifteen minutes checks again. Since PR #50 newer means the digest moved. | `loading.js`, `public/sw.js` | 2026; PR #50 | Live |
| B21 | Picks follow schedule changes, and the app says what changed | Each event keeps the id it was first seen with (#43); a pick on an id merged away moves to the survivor, a moved pick stays in the plan, and one on an event the source dropped stays in Mine, marked; each change is told once, on Now and Mine, until dismissed, and a cancelled event is marked everywhere. First-seen ids since PR #37; merged and removed since PR #50. | `picks.js`, `ids_stage.py` | 2026; PRs #37 and #50 | Live |
| B22 | Works with no signal | The service worker keeps the page, the schedule and the fonts - the page network-first with a three-second timeout, the schedule from the cache and checked behind it - so the app opens in a hotel basement. | `public/sw.js`, `loading.js` | 2026 | Keep |
| B23 | Keep your plan by email | On a build with a backend, Settings' Keep your plan takes an email and a six-digit code: the phone gains the email and keeps its plan, or, where the email already holds a plan, signs in to it and adds its own - PR #56's union - which is how a wiped or new phone gets a plan back; Sign out sends what waits first. | `sheet.js`, `identity.js`, `backend.js` | 2027 (PR #55) | Keep |
| B24 | The sync status line | Under Keep your plan's heading, with a session: "Synced just now", the changes waiting, offline, or what went wrong in plain words; after a refused Sign out, how many changes still wait to send. | `sync.js`, `sheet.js` | 2027 (PR #56) | Keep |
| B25 | After the con, the record of your picks | Once the con's last event is over, a dismissable notice that it has ended, on every tab, and the Now tab becomes the year's picks by day; the countdowns stop. | `now.js`, `shell.js`, `time.js` | 2026 | Keep |
| B26 | Install to the home screen, and the nudge | The manifest and icons make a home-screen app, and until it is installed the Now tab opens with a nudge - Safari's steps on an iPhone, the browser's Install on Android - which Not now snoozes for a week. | `now.js`, `dispatch.js`, `public/manifest.json`, `index.html` | 2026 | Keep; Tell me |
| B27 | A forwarded link's preview card | A link sent in a chat shows a card - the title, a line on what the app does and the DC26 image - from the page's Open Graph and Twitter tags. | `index.html`, `public/og-image.png` | 2026 | none |
| B28 | Starts-soon push | Every minute while the kill switch is on, the Supabase project's push job finds the picks that start within fifteen minutes and sends each user one push a start, to each of their browsers. UNSURE: no reader can receive one today - nothing in `src/` subscribes a browser, `public/sw.js` has no push handler, and dev's switch is off; the client's half is W34. | `supabase/functions/push/`, `push_due()` in `supabase/migrations/` | 2027 (PR #59) | Tell me |
| B29 | Pick-changed push | After a scrape lands and the mirror copies it, one push per user and run for their picks the run cancelled or uncancelled, removed or restored, or moved in time or place, within six hours - never for a change the pipeline's own code made. UNSURE: as B28. | `supabase/functions/push/`, `push_due()` in `supabase/migrations/`, `mirror.py` | 2027 (PR #60) | Tell me |
| B30 | Crews | Create a crew, join one by its link - tapped, or pasted - leave, remove a member, renew the invite, delete, and change your own name in a crew: each one request, with a display name alone; the pull keeps the reader's crews and their crewmates' picks, from which who's going and the overlay are read. Since PR #77 the screens are Plans': the crew header - the crew's name, how many, and Manage, or out of a crew the rung, Start a crew and Join with a link - the crew panel's create, join and manage steps, and the My day \| Crew segment, whose Crew is the crew's day, per person; a tapped `?join=` opens the join step. Since PR #80 the manage step changes the reader's name in that crew. Since PR #81 the crew is on every scope: who starred an event, a line on its sheet; Your crew's picks right now, a section of Now, each crewmate's pick on now or next today; and the Map's count per hotel of the crewmates with a pick there. Since PR #82 the hotel's sheet lists their picks there under the reader's own, Your crew's picks here. Since PR #83 the words say what a crewmate starred, never that they are going (#68). | `crews.js`, `sync.js`, `plans.js`, `sheet.js`, `now.js`, `map.js` | 2027 (PR #62); PRs #77, #80, #81, #82 and #83 | Coordinate |

## 2. Wanted

State: decided, a DECISIONS entry commits to it, and its verdict reads 2027
with the entry's number; deferred, a doc puts it off and says until when -
a tentpole, the spring, past 2027; open, a doc names it or asks about it,
and nothing has ruled on it; untouched, no doc mentions it. State is as
the sweep found it (PR #68), before the verdicts; #59 and #60 decide W32,
W38 to W42 and W45. W46 is Part B's, added after the sweep.

| id | feature | sources | state | description | test | verdict |
|---|---|---|---|---|---|---|
| W1 | An overlap warning when you star: "you can't make both" | VISION, Plan; cat. P1 | open | At the moment of starring, the sheet says when the new pick overlaps another or can't be reached from one, and rows that clash with the plan carry a mark. Until PR #92 a clash showed only afterwards: side by side on Mine's timeline, and as a line between one pick and the next in Mine's list and Now's rest of the day (B10, B12). Built in part by PR #92: a picked row that overlaps another pick says so on its line 3, "Overlaps `<title>`" or "Overlaps `<n>` picks", wherever it is drawn, from the moment of starring (#73). Built by PR #93: the event's sheet lists every pick the event overlaps, each with its time - "Overlaps" on a pick and, before the star, "Would overlap" (#74). The half that says a pick can't be reached from another is the gap line's, as before. Two stars in one slot stay allowed; the warning informs. | plan: yes | 2027 |
| W2 | Alternatives in the same slot when a pick is cancelled or moved | VISION, Plan; #40; cat. P2 | built | When a pick is cancelled or moved, the events in the time it vacated are offered in its place; a different slot is a different plan (#40). Built by PR #108 (#90): a fold a change under the picks-changed notice, on Now and on Plans' My day, for a removed and a gone pick too. | plan: yes | 2027 (#40) |
| W3 | A real For you, from follows and similarity | VISION, Plan; #32, #50; ROADMAP, Where things live; cat. P3 | built | Built by PR #105 (#87). A ranked list of unstarred events the reader probably wants, each with its reason (a follow, a starred work, an axis), minus what clashes with the plan. The first version ranks from the profile #32 decided (follows, mutes, and the weights computed from stars); later improvements to tags and registries, and search tuning (#36), raise the ranking without changing the feature. Its home is Where things live's. | plan: yes | 2027 |
| W4 | Similar events, their similarity computed in the pipeline | VISION, Plan; #22; cat. P4 | open | For each event the pipeline computes its four nearest thematic neighbours (same people, same work, same kind) and ships the list; the sheet shows three or four "more like this". The same list for everyone; these neighbours would be another of For you's signals, beside its follows and its stars (#87). Costs pipeline work and, measured on 2026's file, about half a megabyte uncompressed, some 100 KB compressed. | plan: yes, weakly on its own | checkpoint, rank 1 |
| W5 | Mutes, in the on-device profile beside follows | #32; schema-v2, The profile | built | Mutes, kept by id in the on-device profile beside follows and the weights computed from stars (#32). Built by PR #103 (#84). | plan: yes | 2027 (#32) |
| W6 | "With the cast" in search and the Following feed, as on a work's page | #32, #39; schema-v2, About, and with the cast | built | Following or searching a work lists the events about it first, then a separate "with the cast" group linked by credits, photo and signing kinds hidden there unless asked for (#32); built on a work's page (#39), and in Search and the Following feed. Built by PR #103 (#85). | plan: yes | 2027 (#32) |
| W7 | The parsed facets and a game's play on screen: extra fee, sold out, sign-up, minimum age, part, repeats; format and level | #32, #39; schema-v2, Facets | built | The parsed facets on the row and the sheet - extra fee, sold out, sign-up, minimum age, part N, repeats (since PR #20) - and the tagger's play on a gaming event, its format and level (since PR #25). Read by no screen until PR #92; some reach the reader only as the title's own words (SOLD OUT, $$, Part 2). Since PR #92 a row's line 3 flags four, in words - Sold out, Extra fee, Sign-up and an age, the stated minimum, else 18+ for a mature audience - and Kids for a kids audience (#73). Since PR #93 the event's sheet says the same flags on its facts line and the rest with them: the part, a game's format - with beginners welcome, where its level is beginner - and the repeats, as "Also runs", each other session a tap (#74); since PR #94 only the sessions not yet started (#75). Since PR #96 four are filters in the filter sheet (W13): cost, sign-up, audience and sold out, under Getting in (#77; `docs/screens/contract.md`, section 3, as built); a game's format and level are not filters. | plan: yes | 2027 |
| W8 | Topics as a Search filter | cat. P7 | built | The four topic axes as a search filter. Built by PR #88 in the filter sheet (W13): Medium, Genre, Craft and Subject selects, two by two, each value with its count, one value an axis and every one set holding (#70; `docs/screens/contract.md`, section 3, as built). | plan: yes | merged into W13 |
| W9 | Search results grouped by day | cat. P8 | untouched | Ranked results regrouped under day headers. The no-query listing is by day already; grouping ranked results breaks the ranking. | plan: marginal | out - breaks the ranking; the no-query view is grouped already |
| W10 | Recent and pinned searches on the empty state | cat. P9 | untouched | With the search box empty, Search also shows the last few queries; one can be pinned. Local storage only. | plan: a convenience | checkpoint, rank 5 |
| W11 | A day heat strip in Search | cat. P10 | untouched | A thin bar under the day chips, a segment an hour, darker where more matching events start. Its meaning was never settled. | plan: unclear | out - the picks reading is Mine's timeline; the matches reading is unwanted for now |
| W12 | Swipe to star, swipe between days | cat. P11 | untouched | Swipe a row to star; swipe between days. | none | out - accidental stars; day navigation is Where things live's question |
| W13 | A filter sheet with a count badge | ROADMAP, Where things live; cat. P12 | built | The filters leave the chip rows for a sheet opened by one button whose badge counts the active filters; the sheet holds the day - unless Where things live keeps it by the box (W12) - hotel, kind, type, fandom, track, the photo-and-screening hide (B3), the topic axes (W8) and the facet flags (W7). Built by PR #88: the day stays by the box; the sheet holds the rest but the facet flags, which follow ROADMAP step 7; no Apply - a tap applies at once and the main button counts what the list will hold; one value a filter; each filter in effect a chip under the box; a word in the box holds its filter (#70; `docs/screens/contract.md`, section 3, as built). The facet flags by PR #96, ROADMAP step 7b: cost, sign-up, audience and sold out, four selects under Getting in (#77). | plan: yes | 2027 |
| W14 | Kind icons on rows | cat. P13 | untouched | An icon per row for its kind. | none | out - a row-design detail, Where things live's |
| W15 | Onboarding: pick your fandoms | cat. P14 | untouched | A first-run screen asking which works to follow, to seed For you. | plan: seeds W3 | checkpoint, rank 9 - in tension with the ladder's rule against prompting before the app has shown its worth; W16 does the job by showing |
| W16 | A computed zero state, so the app explains itself to strangers | VISION, Who it is for; cat. P15 | built | Built by PR #106 (#88). With nothing starred or followed the app shows a computed first screen - "Start here", one line on how the app works, and the big ones, Main Programming's celebrity events still to start - something worth starring, so a stranger understands it in one screen. | plan: yes, for newcomers | 2027 |
| W17 | A pre-con "help me plan", behind a flag, as an experiment | VISION, Not doing; #22; cat. P17 | open | A pre-con "help me plan" over the schedule, conversational, behind a flag: an experiment, never a dependency (#22). | plan: yes | checkpoint, rank 6 - the con-day app must not depend on it |
| W18 | Level and "how to get there" on rows and the event sheet | VISION, the stretch; #21, #45; cat. P18 | decided | Each row and the event sheet name the room's level and a one-line "how to get there", from the pipeline's venues data, which ships first and improves them on its own (#21); no "how to get there" line exists yet. Since PR #92 a row names the level on line 2 by its short name (#72), left off where the room already says it and dropped whole where the line cannot hold it (#73), and since PR #93 the event's sheet names it in full under the place, by the same two rules (#74). The one-line "how to get there" is not built: no data for it exists. | plan: yes | 2027 (#21) |
| W19 | The crew screens: create, join by the link, your crews, the invite shared or renewed, leave, remove, delete | VISION, the ladder and Coordinate; #10, #50, #56, #57; ROADMAP, Where things live; sync contract, section 8; cat. C1 | decided | The screens for the crew actions #50 kept and `src/crews.js` built (B30; #56): create, join by the link, the reader's crews, the invite shared or renewed, leave, remove, delete. The join step says, in one sentence, that joining shares your name and your stars with everyone in the crew. W28's name edit merged in: #50 has none, and the policies allow it; PR #80 built it, `setMyName()` and Your name in this crew in the crew panel's manage step (#56). | coordinate: yes | 2027 (#50) |
| W20 | Join by pasting the link, for an installed iPhone app that a tapped link never reaches | #56, #57; ROADMAP, Where things live and Delivery; sync contract, section 8 and Open | decided | A field in the crew screens that takes a pasted invite link and joins as a tapped one does, for the installed iPhone app a tapped link never reaches - confirmed on a phone on 2026-10-01, PR #77's hand test: a link pasted in the home-screen app joins that app's own user, as a separate member (#56). | coordinate: yes | 2027 (#56) |
| W21 | Crew picks on your timeline | VISION, the ladder and Coordinate; #10, #50, #56; ROADMAP, Where things live; sync contract, section 8; cat. C2 | decided | Crewmates' picks overlaid on the reader's timeline, from the pull's copy (#50; B30). | coordinate: yes | 2027 (#50) |
| W22 | Who's going, per event | VISION, the ladder and Coordinate; #10, #50, #56; ROADMAP, Where things live; sync contract, section 8; cat. C3 | built | On each event, the crewmates who starred it; a star is a pick, not a whereabouts (#68, which amends #52's "a star means going"; #50; B30). Built by PR #81: a line on the event's sheet, `crews.js` `goingTo()`, three names and then how many more (`docs/screens/contract.md`, section 7, as built); worded by PR #83 as who starred it, "Starred by Bo, Cy and 2 more", where it said "Going:" (#68). | coordinate: yes | 2027 (#50) |
| W23 | The crew Now board | VISION, Coordinate; #10, #50; cat. C4 | built | One screen: each crewmate, and what they have picked for now and next, from their picks and never from their location (#5). Its data is kept (B30) - crewmates' picks, pulled - and until PR #81 no now-and-next reader was built; the screen is one Where things live invents rather than rearranges, and its shape is open. Built by PR #81 as a section of Now, Your crew right now - Your crew's picks right now since PR #83, its line's "with you" now "yours too" (#68): a line a crewmate, their pick on now or next today, from `crews.js` `crewRightNow()`, four and then how many more (`docs/screens/contract.md`, section 2, as built). | coordinate: yes | 2027 |
| W24 | Status pings tied to a pick | VISION, Coordinate; #10, #40, #50; ROADMAP, Where things live; cat. C5 | deferred, to the spring | One tap on a pick - on my way, here, running late, skipping - that crewmates see on the board and on that pick. Tied to a pick, not free text. Seen at the next open until W35. | coordinate: yes | checkpoint, rank 2 - usage unknown; ask the crew before the checkpoint |
| W25 | Share a day in one tap, by a link that needs no backend | VISION, Coordinate; #10, #50, #57; cat. C6, C7 | built | One tap shares a day's picks as a link that needs no backend (#10, #50). Built by PR #85: Share a day in Plans' My day, the share panel's message and its link - its shape #69's - and the link opened as a list kept in memory alone, with the reader's own stars (`docs/screens/contract.md`, section 5, Share a day, as built). The PNG of cat. C6 is not built. | coordinate: yes | 2027 (#10, #50) |
| W26 | Hand a crew over | #56, #57; sync contract, section 8 | deferred, to the spring, and only if a crew asks | The creator makes another member the creator. | coordinate: an edge case | checkpoint, rank 8 - #56 holds it for the spring, only if a crew asks |
| W27 | Rename a crew | #56, #57; sync contract, sections 3 and 8 | open | Rename a crew after create. | coordinate: marginal | out - delete and recreate covers it, though every member rejoins by a new link; the policies allow a rename (#56); reopen if a crew asks |
| W28 | Change your name in a crew | #56; sync contract, sections 3 and 8 | built | Edit your own display name on your membership row. Built by PR #80: `crews.js` `setMyName()`, and Your name in this crew in the crew panel's manage step (`docs/screens/contract.md`, section 5, as built). | coordinate: yes | merged into W19 |
| W29 | Hide my plan | #57 | open | Stay in a crew but keep your picks from it, or from one member; one table and one policy clause. | coordinate: a privacy control | checkpoint, rank 10 - leaving (for the creator, deleting) is the control; the join step's sentence, W19's, is the contract |
| W30 | A recover that brings your crews and notifications across | #51; sync contract, section 1 | open | Signing in with an existing email on a phone whose anonymous user has crews carries those memberships across, instead of leaving them to rejoin by link. | keep: yes, narrowly | checkpoint, rank 7 |
| W31 | Settings that sync across your devices | #27, #32, #50 | deferred, past 2027 | The crowd factor and the photo-session and screening hide (B3) carried between devices. | keep | out - settings do not sync in 2027 (#50) |
| W32 | A short "what we store" page | cat. F11 | built | Built by PR #110 (#92). One page behind the gear, in three parts. What we store: what the phone holds, what the server holds once the phone has a user - at its first crew, notification or email - what a crew sees, and what today's controls delete and what they leave: Remove all unstars, leaving a tombstone on the server for each pick, and Sign out removes the session and keeps the plan. About this app. The links: one to Dragon Con's official site and app. | no - reference, about the app (#59) | 2027 (#59) |
| W33 | Where the 2026 app and its archive live after the cutover | cat. F10 | untouched | Where the frozen 2026 app is reachable once the live link is 2027. | none | out - a cutover decision, ROADMAP's Checklist |
| W34 | Turn on notifications, and see them: the toggle, the browser's subscription and the worker's push handler | VISION, the ladder and Tell me; #20, #40, #51, #55, #57; ROADMAP, Where things live and Delivery; cat. T1 | decided | A toggle that subscribes the browser, its subscription stored, and the worker's handler that shows #20's two pushes, leave-by replaced by starts-soon (#40): pick-changed and starts-soon. | tell me: yes | 2027 (#20) |
| W35 | Crew pings by push | VISION, Tell me; #20, #50; cat. C8 | deferred, to the spring | A ping arrives as a push, by the push job; realtime (#50) would only speed W24's pings to an open app. | tell me: yes | checkpoint, rank 3 - after W24 |
| W36 | An install flow good enough that iPhone users finish it | VISION, Tell me and Risks worth naming; ROADMAP, Delivery; cat. T5 | deferred, to Delivery | When the app asks a Safari reader to install, what it says, and how it walks them through Share → Add to Home Screen; carries W37's copy (losing your stars, not signal) and trigger (a standing line on Now, or the moment it earns itself). Mechanics are Delivery's. | keep and tell me: gates both | 2027 |
| W37 | The install nudge as data safety, and when it shows | VISION, What done looks like and Risks worth naming; #25, #40; ROADMAP, Where things live; cat. K8 | open | The nudge's copy and trigger. | as W36 | merged into W36 |
| W38 | The building view: a hotel's levels, the reader's picks lit | VISION, the stretch; #21, #28; ROADMAP, Places and Where things live; cat. B2 | built | Tap a hotel on the map: a side view of its levels, the reader's picks lit. Built by PR #113 (#95): the stack, a venue lifted into its floors in the Map's own frame, end states only; a level's own view (W39) and the motion (W40) follow. | plan: yes | 2027 (#60) - ranked above every checkpoint candidate |
| W39 | The top-down level view: rooms in place, landmarks, a tap for what is on | VISION, the stretch; #28, #45, #58; ROADMAP, Places; cat. B3 | built | Tap a level: top-down, rooms in place, landmarks, tap a room for what's on. Built by PR #114 (#96): the level, a drawn plate laid flat in the Map's own frame, a small room brought close by its tap, end states only; the motion (W40) follows. | plan: yes | 2027 (#60), with W38 |
| W40 | The animation between the views | VISION, the stretch; #21, #28; cat. B6 | built | The motion between the views; PR #67's sketch is the record. Built by PR #115 (#97): the lift, the drop-in, the zoom, each way back and the arrival, each a set of animations played over an end state the draw has already written, and none under Reduce Motion. | as W38 | 2027 (#60), last of W38 to W40 |
| W41 | The building view for the Westin, the Courtland Grand and the Mart | #28; ROADMAP, Pipeline shape; cat. B7 | open | The same for the Westin, the Courtland Grand and the Mart. | plan: yes | 2027 (#60), after W38 to W40, as sources allow - the Westin's plan predates its renovation, the Courtland Grand has none, the Mart's is an exhibitor map; the source is the author's own drawing and a walk of the grounds |
| W42 | Guest bios | VISION, Not doing; #57 | open | A reviewed person's "known for" line under their name on an event's sheet and on their page; no photos, no full bios. The data is the registry's, a `people` block in `events.v2.json` (#61), and the client reads it since PR #93 (#74): a line shows once the review's lines have landed. | plan: yes - it decides whether to pick the panel | 2027 (#59) |
| W43 | Accessibility, properly | VISION, Who it is for and What this is built to learn; cat. F2 | open | Every screen with labels for screen readers, focus order, contrast, reduced motion and tap targets; larger text exists (B18), and reduced motion and some labels do in part. | who it is for: a property, not a feature | 2027, as a requirement on Where things live's screens, checked by Playwright when it comes |
| W44 | A calendar alarm in the `.ics` export, a fixed lead time before each pick, for people who never install and so never get a push | cat. P16, recast by the design chat, 2026-09-29 | untouched | Each exported event carries an alarm a fixed lead before it starts, so people who never install still get an alert from their calendar app. | plan and tell me: yes | 2027 |
| W45 | Delete my account, from the "what we store" page | #59; the design chat's pass, 2026-09-29 | built | One call that removes the user's rows and the auth user, from the "what we store" page (W32). Built by PR #111 (#93). | keep, and what a public link owes | 2027 (#59), beside W32 |
| W46 | Your own schedule items | Part B, `docs/official-app-2026.md`, section 3 | untouched | A title, a place and a time that is not on the con's schedule - a dinner reservation, a meeting place, a shuttle - on the same timeline as the picks and in the same clash check. A pick today is an event id, so a personal item is a new shape in picks, sync and the timeline. | plan: yes | checkpoint, rank 4 |

## 3. Verdicts

The design chat's pass over section 2: every row not already decided
passed through VISION's test and given a verdict (#57); a decided row's
verdict is its entry's. A merged row's verdict is the row it joined.

**2027.** The ten decided rows:

- W2, alternatives in the same slot (#40)
- W5, mutes, and W6, "with the cast" in search and the feed (#32)
- W18, level and "how to get there" (#21)
- W19, the crew screens, W28's name edit in it (#50)
- W20, join by pasting the link (#56)
- W21, crew picks on your timeline, and W22, who's going (#50)
- W25, share a day by a link (#10, #50)
- W34, turn on notifications, and see them (#20)

And the pass's:

- W1, the overlap warning when you star
- W3, For you
- W7, the parsed facets on screen
- W13, the filter sheet, W8's topic axes in it
- W16, the zero state
- W44, a calendar alarm in the export
- W23, the crew Now board
- W32, the "what we store" page (#59), and W45, delete my account, on
  it
- W36, the install flow, W37's copy and trigger in it
- W38, W39, W40 and W41, the building view (#60)
- W42, a guest's "known for" line (#59)
- W43, accessibility, a requirement on Where things live's screens

**Checkpoint candidates**, in rank order; the cut takes from the bottom
(#18):

1. W4, similar events, computed in the pipeline
2. W24, status pings tied to a pick
3. W35, crew pings by push, after W24
4. W46, your own schedule items
5. W10, recent and pinned searches
6. W17, a pre-con "help me plan", behind a flag
7. W30, a recover that brings a phone's crews across
8. W26, hand a crew over
9. W15, onboarding: pick your fandoms
10. W29, hide my plan

**Out:**

- W9, search results grouped by day: it breaks the ranking, and the
  no-query view is grouped already.
- W11, a day heat strip: the picks reading is Mine's timeline, and the
  matches reading is unwanted for now.
- W12, swipe to star and between days: accidental stars, and day
  navigation is Where things live's question.
- W14, kind icons on rows: a row-design detail, Where things live's.
- W27, rename a crew: delete and recreate covers it, though every member
  rejoins by a new link; the policies allow a rename (#56); reopen if a
  crew asks.
- W31, settings that sync: settings do not sync in 2027 (#50).
- W33, where the 2026 app lives after the cutover: a cutover decision,
  ROADMAP's Checklist.

**Notes:**

- W3 is a floor: later work on tags and registries, and search tuning
  (#36), keeps raising its ranking without changing the feature.
- W23's screen shape is open, for Where things live. Since PR #81 it is a
  section of Now, one line a crewmate; its shape beyond that is open
  (`docs/screens/contract.md`, section 14).
- W24's usage is unknown: a question for the crew before the checkpoint.
- W38 to W41 rank above every checkpoint candidate, by the author's
  ruling: if the checkpoint must cut a 2027 row, not these (#60). W41
  goes as sources allow: the Westin's plan predates its renovation, the
  Courtland Grand has none and the Mart's is an exhibitor map, so its
  source is the author's own drawing and a walk of the grounds.
- W43 is 2027: the spring cut from the bottom of VISION's learning list
  does not take its item 7, accessibility.

## Appendix A. The catalogue, as brought in

The design chat's catalogue of 2026-09-19, each row verbatim with its
disposition: 71 rows, which the design chat counted as 65, its
building-view paragraph one row. Elsewhere in this file a catalogue id is
written `cat. B3`, so that a bare B3 is always section 1's.

> Key from the original: D decided, not built · I idea · E debt · H held · +
> an addition no doc had. Statuses are as of 2026-09-19; most have moved.

### Plan

| id | row | disposition |
|---|---|---|
| P1 | Overlap warning at star time, "you can't make both." VISION. I. | wanted → W1; the clash and walk lines between picks already follow a star (B10); since PR #92 the clash is a flag on both picks' rows, not a line between them. |
| P2 | Alternatives when a pick is cancelled or moved. VISION. I. | wanted → W2, same-slot by #40. |
| P3 | Real "For you" from follows + similarity. VISION. I. | wanted → W3. |
| P4 | Similarity computed in the pipeline; "similar events" in the detail sheet. #22. I. | wanted → W4. |
| P5 | Per-event aliases from the tagger. #22. I. | not a feature: superseded by #31 and #39 - aliases are the registry's, a work's, and reach the search index through the works block; the tagger is asked for none (#34). |
| P6 | CANON: Comics / Video Games overlap before the next full retag. I. | not a feature: superseded by #32 and #34 - the full retag was tagger v2 (PR #25), the fandoms now registry works and the topics four closed axes. |
| P7 | Topics as a Search filter. I. | wanted → W8. |
| P8 | Search results grouped by day. I. | wanted → W9; with no query the listing is grouped by day already (B1), and ranked results are not. |
| P9 | Recent/pinned searches on the empty state. I. | wanted → W10. |
| P10 | Day heat strip in Search. I. | wanted → W11. |
| P11 | Swipe-to-star, swipe between days. I. | wanted → W12. |
| P12 | Filter sheet with a count badge. I. | wanted → W13. |
| P13 | Kind icons on rows. I. | wanted → W14. |
| P14 | Onboarding: pick fandoms. I. | wanted → W15. |
| P15 | Curated zero state, so the app explains itself to strangers. VISION. I. | wanted → W16. |
| P16 | VALARM at leave-by in the .ics. I. | not a feature: superseded by #40, which retires leave-by; its successor, a calendar alarm a fixed time before each pick, is W44. |
| P17 | Pre-con "help me plan" behind a flag. #22. I, experiment only. | wanted → W17. |
| P18 | Level and "how to get there" on rows and the detail sheet. #21. D. | wanted → W18; the level is in the file where the venues step finds one (#45, PR #38), no "how to get there" line exists yet; the client reads the level since PR #92, by its short name on a row (#72), and the line not at all. |

### Coordinate

| id | row | disposition |
|---|---|---|
| C1 | Crew by link, display name only. #8–10. D. | built → B30 (`src/crews.js`, PR #62), with no screen (UNSURE); its screens → W19. |
| C2 | Crew picks on your timeline. D. | wanted → W21; its reader, `crewmatesByEvent()`, is built (B30). |
| C3 | Who's going, per event. D. | wanted → W22; its reader, `goingTo()`, is built (B30); the line built by PR #81. |
| C4 | Crew Now board. D. | wanted → W23; built by PR #81, a section of Now. |
| C5 | Status pings tied to a pick. D. | wanted → W24. |
| C6 | One-tap share-a-day, including a PNG for WhatsApp. #10. D. | wanted → W25, a link that needs no backend (#50); the PNG is this row's alone. |
| C7 | Shareable pick list by link, no backend. I. | wanted → W25, with cat. C6. |
| C8 | Crew pings by push. #20. Deferred to spring. | wanted → W35. |

### Keep

| id | row | disposition |
|---|---|---|
| K1 | Device key, no prompt. #8, #25. D. | built → B23: the anonymous user is the device, minted at the first tap that needs one, with no key apart from it (#51; `src/identity.js`, PR #55). |
| K2 | Email upgrade by six-digit code. #25. D. | built → B23 (`src/identity.js`, `src/sheet.js`, PR #55). |
| K3 | Outbox and the conflict rule. #9. D. | built → B6: the outbox (`src/outbox.js`, PR #56), and latest stamp wins by a trigger (#52, PR #54). |
| K4 | Backend down means the 2026 app, as a tested property. #9. D. | built → B6: a build with no backend asks for nothing but the schedule (`tests/build.test.js`), and with the backend down the outbox holds and tries again (`tests/page/sync.test.js`). |
| K5 | Two Supabase projects, Pro for Aug–Sep, keep-alive. #25. D. | not a feature: the operations track - dev is built; production, its plan and the keep-alive are its lines (Appendix B). |
| K6 | RLS policy tests. #25. D. | not a feature: tests, built (`supabase/tests/`, PR #54). |
| K7 | TypeScript: decide at the Supabase step. #23. Deferred call. | not a feature: closed as no by #52. |
| K8 | + Install nudge reframed as data safety (Safari's 7-day wipe). #25. | wanted → W37; the nudge is built (B26), and its words speak of signal, not of the wipe. |

### Live / pipeline

| id | row | disposition |
|---|---|---|
| L1 | Stable first-seen ids, match by content. #7. D. | built → B21 (`ids_stage.py`, #43, PR #37). |
| L2 | Schedule source behind one interface. #19. D. | not a feature: built as the raw row, the seam a feed would plug into (#41; `scraper.fetch()`, PR #36). |
| L3 | Year rollover: dragoncon27 source, data/2027/, and the client half (cache prefix, storage keys, CON bounds, home-screen title). #13. D. | not a feature: built - 2027's season file (PR #35) and the client by year (#49, PR #50); left, Checklist lines and `CON`'s two times (Appendix B). |
| L4 | Scrapes every hour or two during the con. VISION. I. | built → B19 (`.github/workflows/scrape.yml`, #48, PR #49). |
| L5 | Scraper fails loudly and keeps the last good schedule. VISION. I. | built → B19: a fatal run commits nothing and fails the workflow, and a degraded one names each degradation (#44; `pipeline.py`, PR #49). |
| L6 | Scrape workflow onto a PR-only branch; Python 3.12 vs 3.13. #16, #26. H. | not a feature: settled - a run lands by pull request (#48, PR #49), on Python 3.13 (#44). |
| L7 | Pipeline diff of schedule changes. #20. D. | built → B29, its source: `diff_stage.py` (#47, PR #41). |
| L8 | Pipeline mirrors events and venues to Postgres. #27. D. | not a feature: superseded by #50 - a mirror job of its own writes two tables and no venues (`mirror.py`, #54, PR #57). |
| L9 | Tagger runs with every scrape. I. | built → B19: the tag stage runs in every run, on uncached inputs alone, up to the season's request cap (#46; `tag_stage.py`, PR #40). |
| L10 | Venues file: hotel identity, walk matrix, buffer, defaults, validated each run. #27. D. | built → B10: `data/2027/venues.json` (#45, PR #35), which the client imports at its build (#49, PR #50). |
| L11 | Room-string normaliser. #28. D. | not a feature: built as the venues step (#45; `venues_stage.py`, PR #38); a reader meets it through W18 and the building view. |
| L12 | Room census. H. | not a feature: done (PR #33), `docs/venues/census-2026.md`. |
| L13 | Venues registry PR. H. | not a feature: done (PR #21), and retired into the venues file (#45, PR #35). |
| L14 | Dragon Con outreach. #19. H. | not a feature: outreach, deferred with no date (#41; Appendix B). |

### Tell me

| id | row | disposition |
|---|---|---|
| T1 | Push subscription and storage. #20. D. | wanted → W34; the storage is built, `push_subscriptions` (#52, PR #54). |
| T2 | Leave-by push from a per-minute job, one Edge Function. #20, #25. D. | not a feature: superseded by #40 - starts-soon in its place, from the same per-minute job and one function, built → B28 (PR #59). |
| T3 | Pick-changed push from the diff. #20. D. | built → B29 (`supabase/functions/push/`, PR #60), which no reader receives yet (UNSURE). |
| T4 | One shared leaveBy module, crowd factor synced. #27. D. | not a feature: superseded by #40, the helper now the tight-connection flag (B10), and by #50, the crowd factor per device (Appendix B). |
| T5 | + An install flow good enough that iPhone users actually do it. | wanted → W36. |

### Building view (stretch, #28)

| id | row | disposition |
|---|---|---|
| B1 | Level data for the big three hotels. | not a feature: data, built - `venues.json` holds the Marriott's, the Hyatt's and the Hilton's levels and rooms (PR #35; the Hilton's as the con's map names them, PR #65), and the Hilton's five levels are drawn (#58, PR #66). |
| B2 | Level stack with picks lit. | wanted → W38. |
| B3 | Top-down level view. | wanted → W39. |
| B4 | Placer tool with plan underlay. | not a feature: a curation tool (#28's Cost); a level's drawing is data, made by hand (#58). |
| B5 | Map as one persistent SVG. | not a feature: debt, the building view's constraint on the map (#28's Cost; Appendix B). |
| B6 | Animation, last. | wanted → W40. |
| B7 | Westin / Courtland / Mart: undecided. | wanted → W41. |

### Foundation and quality

| id | row | disposition |
|---|---|---|
| F1 | Error tracking. I. | not a feature: VISION's learning list, item 6 (Appendix B). |
| F2 | Accessibility, properly. I. | wanted → W43. |
| F3 | Abuse and security for a public link. I. | not a feature: VISION's learning list, item 8 (Appendix B). |
| F4 | IIFE wrap or ship a module script. E. | not a feature: debt, Delivery's (Appendix B). |
| F5 | Playwright at the first sw.js change. #24. Deferred. | not a feature: test tooling, #24's (Appendix B). |
| F6 | Automated cache version. #4. E. | not a feature: debt, Delivery's (Appendix B). |
| F7 | Hashed assets vs single file. #23. Deferred. | not a feature: the build, Delivery's (Appendix B). |
| F8 | Pages deploy from Actions when 2027 reaches main. #26. | not a feature: the deploy, Delivery's (Appendix B). |
| F9 | + Self-host the font. | not a feature: Delivery - the page's one third-party request, Google Fonts (ARCHITECTURE, Sharp edges). |
| F10 | + The next → main cutover, and where the 2026 archive lives after. | split: the cutover is Checklist lines (Appendix B); where the 2026 archive lives after it → W33. |
| F11 | + A short "what we store" page once email exists. | wanted → W32. |

## Appendix B. Found and excluded

What the sweep of DECISIONS, ROADMAP, the two contracts and schema-v2
turned up and section 2 leaves out as not a feature, so that nothing found
is dropped unsaid; and, last, one line of VISION's and the catalogue's F1
and F3. One line each, with its source.

| item | source | kind |
|---|---|---|
| The `dev` Environment's deployment branches restricted to `next` | ROADMAP, the operations track and Checklist; #54 | operations |
| The dev project's weekly keep-alive | ROADMAP, the operations track; #25, #50 | operations |
| The dev project's "Automatically expose new tables" off, and its grants exactly the migrations' | ROADMAP, the operations track; sync contract, section 4; #54 | operations |
| The cleanup of stale anonymous users, and how stale | ROADMAP, the operations track; sync contract, section 2 and Open; #25, #50, #52 | operations |
| The production project, and the workflow that migrates it | ROADMAP, the operations track; sync contract, section 4; #50, #52 | operations |
| Production's plan: Pro for August and September, free otherwise | ROADMAP, the operations track; #25, #50 | operations |
| Production's "Automatically expose new tables" off, and its grants exactly the migrations' | ROADMAP, the operations track; sync contract, sections 3 and 4; #54, #55 | operations |
| A domain verified at Resend for production's custom SMTP | ROADMAP, the operations track and Checklist; #25 | operations |
| Production's Auth set by hand before it serves the email step | ROADMAP, the operations track and Checklist; sync contract, section 1; #51, #53 | operations |
| Production's limit on anonymous sign-ins, set for a hotel's Wi-Fi | ROADMAP, the operations track; sync contract, Open | operations |
| 2027's first mirror by dispatch, and after the first bot landing a Mirror run from the push confirmed | ROADMAP, the operations track and Checklist; #54 | operations |
| The `production` Environment, before the freeze merge brings `mirror.yml` to `main` | ROADMAP, the operations track and Checklist; #54 | operations |
| The push job on production before the freeze: its VAPID pair, secrets and Vault rows, and the function | ROADMAP, the operations track and Checklist; sync contract, section 7; #55 | operations |
| `client`, `pipeline` and `database` required on the `main` ruleset before the freeze | ROADMAP, the operations track and Checklist; #48, #52 | operations |
| At the freeze, the build that publishes `main` given production's `DC_SUPABASE_URL` and `DC_SUPABASE_KEY` | ROADMAP, the operations track and Checklist; #53 | operations |
| At the freeze, production's first mirror confirmed, then the push job's hand test on production | ROADMAP, the operations track and Checklist; sync contract, sections 6 and 7; #54 | operations |
| Production's `flags.push_enabled` on at the freeze and off after the con | ROADMAP, the operations track and Checklist; #55 | operations |
| `DC_YEAR=2027` in the next site's build, once a run past the ids stage has written 2027's `events.v2.json` | ROADMAP, Checklist; #49 | Checklist |
| The icons and the preview image redrawn for 2027, before the 2027 client ships | ROADMAP, Checklist; #49 | Checklist |
| At the freeze, `next` merged to `main`, the default branch and `SCRAPE_TARGET` flipped to `main`, and `DC_YEAR=2027` on `main` - cat. F10's cutover | ROADMAP, Checklist; #48, #49 | Checklist |
| After the con, merge commits allowed on `next`, `main` merged back, and the default branch and `SCRAPE_TARGET` flipped back | ROADMAP, Checklist; #48 | Checklist |
| A new token every year | ROADMAP, Checklist; #48 | Checklist |
| The spring checkpoint's date and the freeze's, both unset | ROADMAP, Dates; #30 | dates |
| The freeze date, tied to the source's posting of the 2027 schedule | ROADMAP, Flags | dates |
| The worker's cache version, bumped by hand - cat. F6 | ROADMAP, Delivery; #4 | debt |
| Hashed assets against the single file - cat. F7 | ROADMAP, Delivery; #23 | debt |
| The built page's one script a classic script, for an IIFE wrap or a module script to settle - cat. F4 | ROADMAP, Delivery; ARCHITECTURE, Sharp edges | sharp edge |
| Playwright, which may come forward as a pull request of its own - cat. F5 | ROADMAP, Delivery; #24, #57 | test tooling |
| Pages from Actions when the 2027 app reaches `main` - cat. F8 | ROADMAP, Delivery; #23, #26 | deploy |
| `mobile-web-app-capable` beside the Apple meta in `index.html` | ROADMAP, Delivery (Open) | debt |
| `main`'s frozen worker deleting the next site's caches until the freeze replaces it | #4, #49 | sharp edge |
| The alias worklist: 547 of 2026's events read at the hotel alone | ROADMAP, Pipeline shape; #45 | curation |
| The curation gaps: the Westin's post-renovation plan, the Marriott's Atrium and Marquis notes, the Courtland Grand's room list | ROADMAP, Pipeline shape; #45 | curation |
| Census v2's 45 double-encoded events, 51 with the six lone "Â" | ROADMAP, Pipeline shape | curation |
| Brandish, 44 events, unreviewed until a works review | ROADMAP, Pipeline shape; #34, #46 | curation |
| The attribution on almost every run, and a hash of the build's code in place of the SHA if its cost matters | ROADMAP, Pipeline shape | debt |
| `CON`'s 18:00 and 19:00 into `season.json` once 2027's schedule shows its own | ROADMAP, Pipeline shape; #49 | data |
| The run's thresholds and the request cap, set by feel, to be tuned in August | #44, #46 | pipeline |
| Works and people reviewed weekly in August and once after the con, and credits reviewed for about 225 people | #31, #46 | curation |
| An overrides file for hand-corrected cache lines, if they grow past a handful | #34 | curation |
| The listing-only pre-check, held as a fallback against 403 pushback | ROADMAP, Flags; #48 | pipeline |
| A windowed copy of the change log for the client, Delivery's; no doc says what it would feed | pipeline contract, The files; #47 | data |
| Dragon Con outreach, deferred with no date - cat. L14 | ROADMAP, Held; #19, #41 | outreach |
| The leave-by countdown taken off the Now tab, the bar above the nav and the map's card: a removal, Where things live's (B9) | ROADMAP, Where things live; #5, #6, #40 | removal |
| `LEAVE_BUFFER_MIN` keeping its name until Where things live | #49 | debt |
| The tight-connection helper shared with a job, which no job needs - cat. T4 | #27, #40 | superseded |
| The map as one persistent SVG, changed in place - cat. B5 | #28 | debt |
| No framework in 2027, revisited only if hand-rolled re-rendering becomes where the bugs live | #23 | debt |
| The fetch layer's two libraries reconsidered if it outgrows about two hundred lines | #53 | debt |
| Two tabs of one phone: the last save wins, accepted for 2027 | sync contract, section 5; #53 | sharp edge |
| A captcha widget, a pull request of its own when abuse calls for it | #50, #53 | security |
| Guests from people tiers: three reviewed celebrities reach celebrity events only through description lines | #39 | data |
| Search tuning by the eval harness, held until the first pass of the whole app: a quality pass on B1 | ROADMAP, Discover and Held; #36 | quality |
| Recording searches that return nothing, anonymously: #36's privacy question | sync contract, Open; #36 | analytics |
| Realtime, out of 2027 and a spring question with crew pings: a transport | #25, #50; VISION, What this is built to learn | transport |
| A push's acks chunked and its `event_ids` bounded, for a push of more than some 70 to 100 events | sync contract, section 7 and Open; #55 | limit |
| The walk through the official 2026 app, `docs/official-app-2026.md`, and the rule for reference content | ROADMAP, The scope pass; #57 | the pass's own output |
| Every screen making sense at the reader's rung, the next rung obvious without nagging | VISION, The ladder | a principle, for Where things live |
| Error tracking - cat. F1: VISION's learning list, item 6; the spring cut takes from that list too | VISION, What this is built to learn; cat. F1 | learning list |
| Abuse and security for a public link - cat. F3: VISION's learning list, item 8; the spring cut takes from that list too | VISION, What this is built to learn; cat. F3 | learning list |
