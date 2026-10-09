/* The teaser reel's storyboard, as data (DECISIONS #105): the words on
   screen, the moment, the cast, and each beat - its caption, its targets and
   its holds. tools/reel/reel.mjs records it and tools/reel/beats.mjs holds
   each beat's moves; nothing here runs.

   The words are Brian's to change: the name and the three lines of the
   title card, the captions, and the end card's two lines.

   Two rules the captions keep. A caption never says where a person is: a
   star is a pick, not a whereabouts (DECISIONS #68), so "your crew's picks",
   never "your crew". And none compares the app with the official one. */

/* The title card: the name, small, over three large lines, the last in
   gold. The end card: one large line, and the small line that says the app
   is unofficial - the only place the film says so. */
const WORDS = {
  name: "Dragon Con Planner",
  lines: ["Find the panel.", "Find the room.", "Find your crew."],
  ending: "Coming September 2027",
  disclaimer: "Not affiliated with or endorsed by Dragon Con.",
};

/* The build's default moment (DC_NOW; DECISIONS #99): the Saturday of the
   con, five minutes into the 1:00 PM hour, with no offset. A default moment
   wears no "simulated time" chip, and stands still. */
const MOMENT = "2026-09-05T13:05";

/* The cast: real events of data/2026/events.v2.json, by id, all of that
   Saturday; every name invented. Chosen so that the reader has a pick on at
   the moment and one in the room the Map beat zooms to; three crewmates have
   a pick on at the moment, one of them the reader's too; every crewmate has
   one still to come, so Now says four lines and "+1 more"; five hotels wear
   a crew pill and two hold three of the crew. No photo session, no signing,
   nothing 18+, nothing cancelled. reel.mjs stops before it records anything
   where the schedule does not hold one of these.

   stamped: when each crewmate's stars are said to have been made - a fixed
   date, the day before, since nothing here reads a clock. */
const CAST = {
  crew: "Elevator's Full",
  stamped: "2026-09-04T16:00:00Z",
  reader: {
    name: "Alex",
    picks: [
      "c32d19e7750818e0eb903f152ad10b0e",   // British Noir, 10:00 AM, Hilton, Galleria 5
      "6ecc75745a676d39f230055623a7291a",   // Castle Cast, 11:30 AM, Marriott, Atrium Ballroom
      "6ecc75745a676d39f230055623abeabe",   // Secrets of Nevermore: Wednesday Cast, 1:00 PM, Hyatt, Centennial II-IV - on at the moment
      "6ecc75745a676d39f2300556237a3955",   // Predator: The Hunt Re-Imagined, 2:30 PM, Marriott, M301 - the Map beat's room
      "1e3995157984a4c0e6515a2ed62f7d95",   // Hades II Live, 4:00 PM, Westin, Peachtree Ballroom
      "c32d19e7750818e0eb903f152abf3c96",   // Star Trek Enterprise Q&A, 5:30 PM, Hilton, Salon
      "c32d19e7750818e0eb903f152ac709d2",   // Dad's Garage Live: Comedy Improv @ Dragon Con!, 7:00 PM, Courtland Grand, Capitol Ballroom
    ],
  },
  mates: [
    { name: "Mara", picks: [
      "6ecc75745a676d39f230055623abeabe",   // Secrets of Nevermore: Wednesday Cast - on at the moment, the reader's too
      "1e3995157984a4c0e6515a2ed631cf9e",   // Star Trek: Strange New Worlds, 4:00 PM, Marriott, Imperial Ballroom
      "c32d19e7750818e0eb903f152ac709d2",   // Dad's Garage Live: Comedy Improv @ Dragon Con!
    ] },
    { name: "Theo", picks: [
      "c32d19e7750818e0eb903f152ac6b50a",   // Battlestar Galactica: Humans and Cylons, 1:00 PM, Marriott, Atrium Ballroom - on at the moment
      "6ecc75745a676d39f2300556237a3955",   // Predator: The Hunt Re-Imagined
    ] },
    { name: "June", picks: [
      "c32d19e7750818e0eb903f152ac2f43c",   // Star Trek Lower Decks Q&A, 1:00 PM, Hilton, Salon - on at the moment
      "c32d19e7750818e0eb903f152abf3c96",   // Star Trek Enterprise Q&A
    ] },
    { name: "Dev", picks: [
      "6ecc75745a676d39f230055623a12112",   // The Boys guests: Behind the Mayhem, 11:30 AM, Marriott, Imperial Ballroom
      "6ecc75745a676d39f230055623ad6553",   // Long May She Reign: An Hour with Lena Headey, 2:30 PM, Marriott, Atrium Ballroom
      "c32d19e7750818e0eb903f152abf3c96",   // Star Trek Enterprise Q&A
    ] },
    { name: "Kit", picks: [
      "c32d19e7750818e0eb903f152ac6b4f5",   // Stargate: SG-1 - Make It Spin, 2:30 PM, Westin, Peachtree Ballroom
      "1e3995157984a4c0e6515a2ed62f7d95",   // Hades II Live
      "c32d19e7750818e0eb903f152ac16d8f",   // Banachek - Games of the Mind, 8:30 PM, Hilton, Crystal Ballroom
    ] },
  ],
};

/* The beats, in the film's order. A card is a picture held for its seconds
   - the title's stands over the view the beat it names opens on, taken from
   the build at each run; every other beat is recorded from the page, under
   its caption. hold: how
   long each view stands, in ms, by the clock - this is a film - after its
   move has ended; the rest is what beats.mjs taps. */
const BEATS = [
  { n: 1, key: "title", card: "title", seconds: 3, over: "map" },
  { n: 2, key: "map", caption: "Find the room, not just the hotel.",
    hotel: "Marriott", level: "marquis", room: "M301",
    hold: { city: 3000, stack: 4000, level: 4000, room: 5000 } },
  { n: 3, key: "filters", caption: "Every filter, one screen.",
    groups: ["Hotel", "What it's about", "Type", "Kind", "Getting in"],
    hotel: "Marriott", kind: "qa", select: { id: "filterGenre", value: "Sci-Fi" },
    whole: "Show 3,053 events",
    hold: { search: 900, days: 900, sheet: 800, foot: 600, chip: 900, list: 1800 }, scroll: 1700 },
  { n: 4, key: "explore", caption: "Browse by track, fandom, topic or guest.",
    sections: ["topic", "guest", "fandom"], page: "work:star-trek",
    hold: { grid: 1200, section: 1000, page: 1400, followed: 1800 } },
  { n: 5, key: "plans", caption: "Your day, and your crew's.",
    fold: "Mara", foldScroll: 700,
    hold: { day: 2200, crew: 1400, opened: 500, fold: 2000 }, scroll: 1400 },
  { n: 6, key: "crew-map", caption: "See where your crew's picks are.",
    hotel: "Hilton",
    hold: { city: 2200, sheet: 4600 } },
  { n: 7, key: "now", caption: "At the con: what's on, and what's next.",
    stopBefore: "On now and in the next hour",
    hold: { top: 3000, foot: 1400 }, scroll: 2600 },
  { n: 8, key: "end", card: "end", seconds: 4 },
];

export { WORDS, MOMENT, CAST, BEATS };
