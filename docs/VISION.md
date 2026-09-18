# Vision — 2027

What the app is for, and what it is being built to learn. Written
2026-09-17 at step 2 of the off-season plan, before any 2027 code. The
roadmap is written against this after the foundation work; this file does
not sequence anything. A change here is a decision: log it in
DECISIONS.md and update this file in the same PR.

## In one line

The planning and coordination layer for Dragon Con: your weekend on one
screen, and your crew's too.

2026 was a phone-first schedule planner. 2027 keeps that and adds the
people you came with.

## The ladder

**Useful in ten seconds. Better with a crew. Best when installed.**

- *Ten seconds:* someone opens a forwarded link, sees the schedule, stars
  something. No account, no prompt, no signal needed after the first load.
- *With a crew:* a link puts a few people together. Their picks show on
  yours; you can see who is going where.
- *Installed:* on the home screen, the app can tell you when to leave and
  when a pick moved, instead of waiting to be opened.

Every screen should make sense at the rung the person is on and make the
next rung obvious without nagging.

## Who it is for

1. The author's friend group — the people it was built for in 2026.
2. Their networks, arriving by forwarded link. Plan for a few hundred
   (DECISIONS #11). Most of these people will never meet the author, so
   the app has to explain itself.
3. Dragon Con itself is **not** a design target (#19). If a partnership
   comes, they bring the requirements. What the app keeps *official-ready*,
   because it is good engineering anyway:
   - The schedule source sits behind one interface; a feed could replace
     the scraper without the client noticing.
   - Identity holds no personal data by default (#8).
   - Works with no signal (#4).
   - Accessible.
   - Scale is a configuration change, not a rewrite.

## The test

A feature is in if it helps someone **plan** their weekend or **coordinate**
with the people they came with. Otherwise it is out, however good it is.

## Pillars

### 1. Plan
What 2026 did, sharpened. Search, star, follow, Now, Mine and Map stay.
New: overlap detection ("you can't make both"), alternatives when a pick
is cancelled or moved, and a real "For you" built from follows plus
similarity computed in the pipeline.

### 2. Coordinate
DECISIONS #10, unchanged: crew picks on your timeline, who's going per
event, a crew Now board, status pings tied to a pick, one-tap share-a-day.
Build order picks → presence → pings. No chat.

### 3. Keep
DECISIONS #8 and #9: a device key with no prompt, an optional email
upgrade to link devices (a six-digit code typed into the app, not a
magic link — #25), local-first with an outbox to sync. With the backend
down, the app is the 2026 app.

### 4. Live
Stable ids (#7) so nothing breaks when the schedule changes; scrapes every
hour or two during the con instead of nightly; a change to your picks
reaches you (Pillar 5) rather than waiting for the next open.

### 5. Tell me
Push notifications, minimal (#20): **leave by** and **your pick changed**.
Both are computed server-side from data sync already holds. Crew pings by
push are a spring decision, not a 2027 commitment. On iPhone, push only
reaches an installed app — which is why the top rung of the ladder is
"installed."

### Stretch: the building view
A per-hotel view: tap a hotel on the map and it opens into its levels,
your picks lit; tap a level and it drops to a top-down view of it (#28),
rooms as blocks in their real relative positions, escalators, elevators
and skybridge doors marked; tap a room for what is on there. Data first
(#21): a pipeline-owned venues file mapping every room string to a hotel,
a level, and a one-line "how to get there," which improves every row and
the detail sheet before any drawing exists. Schematic: blocks and landmarks,
our own drawings, hotel plans as reference. Gated on the foundation and
Coordinate landing by the spring checkpoint. The animation is built last.

## Not doing

- Chat, or anything that becomes chat (#10).
- A social graph. Crews are links.
- GPS or inferred location (#5).
- Runtime AI in the core app (#22): natural-language search, "plan my
  Saturday." AI runs in the pipeline (tags, aliases, similarity), where it
  is free at runtime and works offline. A pre-con "help me plan" is
  allowed as an experiment, not a pillar.
- Public crowd-sourced line or capacity status. Too sparse at a few
  hundred users to trust. Crew-scoped, it is a status ping, already in
  Pillar 2.
- Photos, costumes, the vendor halls, guest bios — anything the official
  app does that is not schedule.
- Native apps. It is a PWA.

## What done looks like

- The author's crew runs the whole weekend from it.
- Strangers arrive by link and star something.
- Nobody loses a plan: a device that upgraded is recoverable; one that
  did not keeps what it had for as long as its browser keeps it — Safari
  deletes an uninstalled site's storage after seven days without a visit
  (#25), which is why the install nudge earns its place twice.
- It works in a hotel basement with no signal.
- The pipeline runs unattended through con weekend.
- A leave-by notification fires at the right minute for someone who is
  not the author.

## What this is built to learn

Ranked. The roadmap sequences these against the pillars, and the spring
scope cut takes from the bottom.

1. A build step and a modular client, replacing the one-file app with
   zero behaviour change (plan step 4).
2. A real test setup and CI that runs on every PR.
3. Supabase: Postgres, row-level security, auth, realtime.
4. Local-first sync: the outbox, conflicts, what happens when two devices
   disagree.
5. Web Push end to end: subscriptions, a scheduled job, delivery on iOS.
6. Error tracking and basic observability: knowing it broke before a
   friend says so.
7. Accessibility, properly.
8. Abuse and security basics for a public link: rate limits, what a
   stranger can and cannot do to a crew.

## Risks worth naming

- **The scraper.** Everything downstream depends on a third party's web
  view. It must fail loudly and keep the last good schedule. A partnership
  feed removes this risk; nothing else does.
- **Push on iPhone** only works installed. If people do not install,
  Pillar 5 reaches nobody. The install nudge earns its place.
- **The building view** is the kind of feature that eats a month happily.
  It has a budget and a gate.
- **One developer.** Every pillar has to be finishable alone; the spring
  checkpoint exists to prove that or cut.
- **Partnership drift.** Building for Dragon Con's imagined requirements
  instead of the friend group's real ones. The official-ready list above
  is the whole obligation.
