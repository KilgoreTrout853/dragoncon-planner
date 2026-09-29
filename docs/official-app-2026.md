# The official app, 2026

The scope pass's Part B (DECISIONS #57): what the official Dragon Con app
did in 2026, one row a feature, each marked planning, coordination or
reference, with our equivalent beside it. It is evidence for the verdicts
in `docs/scope-2027.md` and for Where things live, not a wish list: a
feature being here is never by itself a reason to build it.

**The app.** A Core-apps white-label. On a phone it is the vendor's
multi-convention shell, "Follow Me", version 10.7.0.17 built 2026-08-11,
with Dragon Con 2026 as the convention loaded; "Exit to Convention List"
leaves it for the vendor's other shows. Its web view is
app.core-apps.com/dragoncon26.

**Sources.** The web view, walked through Chrome on 2026-09-25 (every
section, unauthenticated). The iPhone app, walked on 2026-09-29 (the
signed-in half: My Schedule, settings, reminders, sync, profile, friends,
alerts, the notes editor, the day filter, offline, the home screen, and the
phone's own Settings page for the app). The author used the planner, not
this app, at the con, so what a shared schedule looks like on the receiving
end and whether any push reached a phone during the con were not observed;
Appendix A lists every unobserved cell.

**The three categories.** Planning: helps a person decide what to do and
when. Coordination: helps people do it together. Reference: read, not acted
on - hours, policies, links, bios, documents (#59). The Keep table's rows
serve the plan by holding it and are marked keep; Bluetooth is a
permission, not a feature, marked "-".

**Reading the "ours" column.** A B-id or W-id is `docs/scope-2027.md`'s: B,
built on `next`; W, wanted, with its verdict there. "None" with "out" is a
feature we do not build, and the reason is in the row.

## 1. The shape

The phone's home screen is a grid of twenty tiles under an alert strip: My
Schedule, Exhibitors, Maps, Events, Speakers, Show Documents, Gaming
Events, Friends, Attendees, Social Media, Locate Me, What's On Now, Hours
of Operation, About, Exit, DCTV, Store, Notes, Policies, Publications. A
bar of six icons persists at the bottom (home, exhibitors, maps, events,
speakers, search); the top bar holds a hamburger (the Message Center:
friends and alerts), a gear (Settings) and a refresh. The web view has the
same sections behind a five-icon bar and nineteen tiles.

Everything is a peer of everything else. Vendor halls sit beside My
Schedule; Policies beside What's On Now. That is what a platform that must
fit every convention looks like: a section for each thing the vendor can
do, and no opinion about which ones matter on a Saturday afternoon. Ours
has five tabs for the hourly loop and a gear for the rest; section 2 shows
how many destinations that grid holds; Where things live places ours, which
are fewer.

## 2. The features

### The schedule

| feature | where | how it works | category | ours |
|---|---|---|---|---|
| Browse by day | Events | Six days, Sep 2 to 7, each grouped by start time. A row is a star, the title and the time range: no room, no hotel. | planning | B1: our row carries the hotel and room on the line under the title; theirs shows neither. |
| Browse by track | Events | The track list, then a track's events. | planning | B15, Explore's track tiles, a page per track; B3's select in Search. |
| Filter events | Events, the filter icon | A multi-select of tracks with counts, Cancel and Apply. Tracks only, as far as seen (Appendix A). | planning | B3; W13 is the sheet. |
| Gaming as its own type | Gaming Events | Gaming is a separate "Entertainment" type with its own track list and day view. | planning | B3, the type chip. |
| Universal search | the search icon | One box across events, speakers, exhibitors and maps. | planning | B1, B4: events and people, with the con's synonyms. |
| The event page | any event | Location (hotel and room as text; a link to the map pin in the web view, not tappable on the iPhone), Date, Duration, the description, a Tracks chip, a Rate Event button, and a rail: share, notes, rate, star, help. | planning | B5. |
| Star, "add to schedule" | the event page, any row | Toggles. If the event overlaps a pick a toast says so for about four seconds, then nothing records it anywhere. No reminder prompt, no notify option. | planning | B6; W1 is the warning that stays. |
| My Schedule | My Schedule | A day at a time on an hour grid, with a list toggle. Two overlapping picks are drawn side by side with no mark; the room is on the block. | planning | B12, Mine: the timeline draws the same picture, and Mine's list and Now's rest of the day also say by how many minutes one pick overlaps the next; a clash across hotels carries the tight-walk mark. The official app says nothing once its toast is gone. |
| Add your own schedule item | My Schedule, the plus | Title (required), Location, Notes, Date and Length (60 minutes by default): a non-con appointment on the same timeline. | planning | none. The one Part B candidate: see section 3. |
| What's On Now | the alarm-clock icon; a home tile | On now and coming up soon, with an explainer dialog on first use. Empty after the con. | planning | B7, B8: Now, and the next hour. |
| Share an event | the rail | The phone's share sheet. | coordination | none. No per-event share exists; the sheet's Add to calendar is the closest. W25 shares a day. |
| Rate an event | the event page | A rating per event, open until the end of the month after the con. | reference: feedback to the con | none; out. |
| Notes per event | the rail; a home tile | A plain text box per event with an email-it icon; View All Notes in Settings; a switch to show notes on maps. Notes never sync between devices. | reference: personal | none; out. A notes app exists. |
| Session check-in | the event page, while live | "Verification is available once a session has started" (web view); absent after the con. | reference | none; out. |

### Tell me

| feature | where | how it works | category | ours |
|---|---|---|---|---|
| My Schedule reminders | Settings | Off by default. One global lead time on a slider, 0 to 60 minutes, "notify N minutes before". A local notification scheduled on the phone, which a native app can do and a PWA on iOS cannot. | planning | B28, the starts-soon push, at 15 minutes from the server; W34 turns it on; W44 is the calendar alarm for readers who never install. |
| Push notifications | Settings; the phone's own Settings | The app registers for push (the phone's Settings page lists Notifications: banners, sounds, badges). The app's own screen only says to use the phone's. | planning | B28, B29; W34. |
| Alerts | the Message Center; the strip on home | Broadcasts from the con, with an unread count and "mark all as read". Four in 2026 - Aug 26, Sep 1, Sep 8, Sep 21 - and none dated during the con in the list as seen on 2026-09-29. Their content is memberships, the survey, streaming: reference. | reference | none; out. Our pushes are about the reader's picks, not broadcasts. |

### Keep

| feature | where | how it works | category | ours |
|---|---|---|---|---|
| Multi Device Sync | Settings | An email and password account, "used across all devices to establish that they are all being used by the same person"; First Device or Additional Device. Syncs My Schedule and exhibitor bookmarks, not notes. | keep | B23: an email and a six-digit code, no password; B24 the status line. |
| Email My Show Summary | Settings | Emails the reader their schedule. | keep | B13, the calendar export; W25. |
| Offline | - | The schedule, a day's list and an event page all open in airplane mode. | keep | B22. |
| Delete My Account | Settings | Removes the account. | keep | W45. |

### Coordination

| feature | where | how it works | category | ours |
|---|---|---|---|---|
| Friends | the Message Center; a home tile | Add a friend by request; requests pending, awaiting, accepted, declined; a friend can see your schedule and you theirs. The receiving end was not observed. | coordination | B30, crews by link: no requests, no graph (VISION). |
| Attendees | a home tile; My Profile | An opt-in directory, searchable A to Z; the profile's checkbox is unticked by default. | coordination | none; out. VISION has no social graph. |
| My Profile | Settings | First and last name public; email friends-only; title, company, phone and three social URLs, friends-only; all stored on the vendor's server; a Public / Friends Only legend. | reference | B23 holds an email and nothing else personal; a crew holds the display name you give it (B30). W32 says so. |
| Status | the Message Center | "What are you doing right now?" - a free-text post to friends, tied to nothing. | coordination | W24, a ping tied to a pick. |
| Messages, meetings, an activity feed, likes | the Message Center's strings | Present as template strings only; not switched on for Dragon Con. | coordination | none; out. |
| Invite Your Friends | Settings | Shares the app. | coordination | B27, the link; not a feature. |

### Places

| feature | where | how it works | category | ours |
|---|---|---|---|---|
| Maps | Maps; a home tile | Seventeen: each hotel, both AmericasMart buildings, the three vendor-hall floors, the Art Show, Artists Alley, the Walk of Fame, the convention footprint, three shuttle maps. A hotel is Dragon Con's own per-floor drawing with every room labelled by track and number and an Areas of Interest list per floor. | planning | B14, the map, hotel by hotel; W18 puts the level on the row; the building view, W38 to W41, is built on our own level drawings (#58, `data/2027/drawings/`), from the layout facts, never traced. |
| Room pins | Maps; the event page's Location in the web view | A room is a tappable pin; an event's Location opens its hotel's map at that pin. | planning | none today; W18, then W39. |
| Route-finding | Maps | A route between any two points on the plan. | planning | B10 knows the walk between hotels, not between rooms; out for rooms. |
| Locate Me | a home tile | Sets your position by typing the room or exhibitor you are near. No GPS: the phone's Settings page for the app lists no Location permission at all. | planning | none; out (#5). Their no-GPS choice matches ours. |
| Bluetooth | the phone's Settings | Allowed; the platform's beacon support, unused as far as seen. | - | none. |

### Reference

| feature | where | how it works | category | ours |
|---|---|---|---|---|
| Speakers | Speakers; a home tile | A to Z and search; a page is a bio and Related Sessions, each with the person's role and its own star. | planning and reference | B4, B16: people are searchable and followable; B15's person page; W42 is the two-line "known for" (#59). Full bios: out. |
| Exhibitors | Exhibitors; a home tile | A to Z, search, browse by category, bookmarks, and the vendor-hall floor maps behind them. | reference | none; out (VISION, Not doing). |
| Show Documents | a home tile | Twenty-one PDFs: rack cards per day, large-print schedules, the gaming guide, both video-room schedules, streaming, shuttle maps, hours. | reference | none; out. The one link points here (#59). |
| Hours of Operation | a home tile | Registration and venue hours. | reference | none; out; the one link. |
| Social Media, DCTV, Store, Publications, Policies, About | home tiles | Link-outs and pages. | reference | the one link to the official site and app (#59). |
| Show Notes on Maps | Settings | Notes pinned to map locations. | reference: personal | none; out. |
| App tutorials | Settings, "Reset App Tutorials" | First-use explainer dialogs, as What's On Now showed one. | reference | W16 is our version: a zero state that shows rather than tells. |

## 3. What Part B changes in `docs/scope-2027.md`

One candidate row, and five confirmations.

**The candidate: your own schedule items.** A dinner reservation, a meeting
place, a shuttle to catch - a thing with a title, a place and a time that
is not on the con's schedule, on the same timeline as the picks and in the
same clash check. It is the one feature the official app has that passes
VISION's test and that no W-row covers. Its cost is real: a pick today is
an event id, so a personal item is a new shape in picks, sync and the
timeline. Proposed as W46, state untouched, source Part B.

**Confirmations.**

- **W1.** The official app warns of an overlap at the moment of starring
  and then forgets; ours should warn and keep the mark.
- **W44.** Their reminders are local notifications, 0 to 60 minutes, off by
  default. A web app cannot schedule one; the calendar alarm is the honest
  equivalent for a reader who never installs, and W34 plus B28 the
  equivalent for one who does.
- **W42 and #59.** Bios are the one reference feature that touches
  planning, and only as a line. Everything else on their home screen -
  documents, hours, exhibitors, store, policies, socials - is reference
  content #59 sends to the one link.
- **Locate Me, out.** Typed, not GPS; still a stated position the app then
  reasons from, which #5 rules out. Notably, the official app asks for no
  Location permission either.
- **Where things live.** Twenty tiles is what no product opinion looks
  like. Section 2 has seventeen planning rows, six coordination, twelve
  reference and four keep; ours puts the planning rows on five tabs, the
  coordination rows with crews, attached reference one tap from its object,
  about-the-app behind the gear, and the rest behind the one link (#59).

## 4. Quality, for the record

Not features, but what "not very good" meant on the day:

- Tapping the reminder row turned every Settings row into a toggle,
  Privacy Policy included, until the screen was left.
- The overlap toast lasts about four seconds and leaves no trace.
- The event page's Location is a link in the web view and plain text on
  the iPhone.
- The notes editor opens black on a white page.
- What's On Now is behind an alarm-clock icon, which reads as reminders.

## Appendix A. Unobserved

| cell | why |
|---|---|
| A friend's shared schedule, as the receiving friend sees it | The author had no friends in the app; the request model was seen, the schedule view was not. |
| A push received on a phone during the con | The author did not use the app at the con. The Alerts list holds none dated during it, as of 2026-09-29; older alerts could have been cleared. |
| Check-in while a session is live | Seen only as the web view's text; absent after the con. |
| The rating's scale and what the con does with it | Not tapped. |
| The day filter beyond tracks | Only the top of the track list was seen; a type or hotel section below it is not ruled out. |
| Route-finding and Locate Me in use | Seen in the web view's controls, not exercised. |

## Appendix B. Sources on disk

Dragon Con's own maps (seven drawings - the five hotels and the Mart's two
buildings - plus the convention footprint) and `maps.json` with their room
polygons for the Hilton, the Hyatt and the Marriott are kept under
`reference/dragoncon/` on the author's machine, gitignored, as reference
for our own level drawings (#58): facts are used, their rendering never is.
