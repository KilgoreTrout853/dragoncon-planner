/* The teaser reel's moves (DECISIONS #105): what each recorded beat of
   tools/reel/storyboard.mjs taps, and in what order. A beat has a setup,
   which runs before any frame is kept - a film's cut - and a play, which is
   the clip. Both are handed the page's hands by tools/reel/reel.mjs:

     tap(target, what)       a touch where the target answers, with the dot;
                             a target that is not there, or not on screen,
                             stops the run and names the beat and the target
     settle()                the move has ended: its animations are gone
                             and nothing is scrolling
     hold(ms)                the view stands, by the clock
     scroll(scroller, to, ms)  an eased scroll of the script's own, to a
                             top, the end, or an element brought under an
                             edge of another
     see(selector, what)     it is on the page, or the run stops
     text(selector), choose(select, words), and page for the rest

   A target is a selector, or {selector, text}: the first match whose words
   begin with the text. Nothing here waits for anything but a move's end and
   a hold, and nothing reads the clock. */

/* Words as the page holds them, whatever the stylesheet does to their case,
   and with a plain apostrophe. */
const plain = words => words.replace(/\u2019/g, "'").toLowerCase();
const says = (said, words) => plain(said).includes(plain(words));

const beats = {
  /* The Map: the city, a hotel lifted into its floors, a floor laid flat,
     a room zoomed on, and its card. One touch on a floor's strip opens it. */
  map: {
    async setup(h, beat) {
      await h.tap('nav button[data-tab="map"]', "the Map tab");
      await h.settle();
      await h.see(`g.map-hotel[data-hotel="${beat.hotel}"]`, `the ${beat.hotel}'s block`);
    },
    async play(h, beat) {
      await h.hold(beat.hold.city);
      await h.tap(`g.map-hotel[data-hotel="${beat.hotel}"]`, `the ${beat.hotel}'s block`);
      await h.settle();
      await h.see(`g.plate.mine[data-plate="${beat.level}"]`, `the ${beat.level} floor with a gold edge, the reader's pick on it`);
      await h.hold(beat.hold.stack);
      await h.tap(`text.plate-label[data-plate="${beat.level}"]`, `the ${beat.level} floor's strip`);
      await h.settle();
      await h.hold(beat.hold.level);
      await h.tap(`rect.plate-room.lit[data-level="${beat.level}"][data-room="${beat.room}"]`, `room ${beat.room}, lit`);
      await h.settle();
      await h.see("#view-map .pc-row", `the card of room ${beat.room}`);
      await h.hold(beat.hold.room);
    },
  },

  /* Search's filter sheet: the whole schedule's count, every group by its
     title, then the count falling as two chips and one menu are set. The
     menu is set by value - a native select shows no picker in a recording -
     and nothing is typed. */
  filters: {
    async setup(h) {
      await h.tap('nav button[data-tab="browse"]', "the Search tab");
      await h.settle();
    },
    async play(h, beat) {
      await h.hold(beat.hold.search);
      await h.tap('#view-browse button[data-chip="day"][data-value="All"]', "All days");
      await h.settle();
      await h.hold(beat.hold.days);
      await h.tap("#filtersBtn", "Filters");
      await h.settle();
      const whole = (await h.text("#filtersShow")).trim();
      if (whole !== beat.whole) throw new Error(`the sheet's main button reads "${whole}", not "${beat.whole}"`);
      const said = await h.text("#sheet");
      for (const group of beat.groups) if (!says(said, group)) throw new Error(`the filter sheet has no group titled "${group}"`);
      await h.hold(beat.hold.sheet);
      await h.scroll("#filtersBody", "end", beat.scroll);
      await h.hold(beat.hold.foot);
      await h.scroll("#filtersBody", 0, Math.round(beat.scroll * 0.8));
      await h.tap(`#sheet button[data-chip="hotel"][data-value="${beat.hotel}"]`, `the ${beat.hotel} chip`);
      await h.hold(beat.hold.chip);
      await h.choose(`#${beat.select.id}`, beat.select.value);
      await h.hold(beat.hold.chip);
      await h.scroll("#filtersBody", { to: `#sheet button[data-chip="kind"][data-value="${beat.kind}"]`, gap: 120 }, 700);
      await h.tap(`#sheet button[data-chip="kind"][data-value="${beat.kind}"]`, `the ${beat.kind} chip`);
      await h.hold(beat.hold.chip);
      await h.tap("#filtersShow", "the sheet's main button");
      await h.settle();
      await h.hold(beat.hold.list);
    },
  },

  /* Explore: the clip opens at the grid, the filter box and the jump chips
     at the top - the ease down from For you is the setup's, and its tap on
     the Tracks chip, which lands Tracks under the pinned box where the
     app's own jump lands a section. Then three chips, a fandom's tile, and
     Follow. The chips' scroll is the app's own. */
  explore: {
    async setup(h) {
      await h.tap('nav button[data-tab="explore"]', "the Explore tab");
      await h.settle();
      await h.scroll("main", { to: "#explore-track", gap: 220 }, 600);
      await h.settle();
      await h.tap('button[data-act="explore-jump"][data-section="track"]', "the Tracks chip");
      await h.settle();
    },
    async play(h, beat) {
      await h.hold(beat.hold.grid);
      for (const section of beat.sections) {
        await h.tap(`button[data-act="explore-jump"][data-section="${section}"]`, `the ${section} chip`);
        await h.settle();
        await h.hold(beat.hold.section);
      }
      await h.tap(`button.tile[data-explore="${beat.page}"]`, `the tile of ${beat.page}`);
      await h.settle();
      await h.hold(beat.hold.page);
      await h.tap('button.follow-btn[data-act="toggle-follow"][aria-pressed="false"]', "Follow");
      await h.settle();
      await h.see('button.follow-btn[aria-pressed="true"]', "Following");
      await h.hold(beat.hold.followed);
    },
  },

  /* Plans: My day's timeline, eased down its afternoon and back, then the
     crew's day and one person's fold. Once it is open the page is brought
     up until the first fold's head stands at the header's foot: the My day
     | Crew control and the day chips are then wholly off the screen, never
     cut by the header, and the open fold's last row is whole above the
     next-pick bar. The run stops where any of that is not so. */
  plans: {
    async setup(h) {
      await h.tap('nav button[data-tab="plans"]', "the Plans tab");
      await h.settle();
      await h.see('#plansViewMine[aria-pressed="true"]', "My day");
    },
    async play(h, beat) {
      await h.hold(beat.hold.day / 2);
      await h.scroll("main", "end", beat.scroll);
      await h.hold(beat.hold.day / 2);
      await h.scroll("main", 0, Math.round(beat.scroll * 0.6));
      await h.tap("#plansViewCrew", "Crew");
      await h.settle();
      await h.hold(beat.hold.crew);
      await h.tap({ selector: "button.crew-fold", text: beat.fold }, `${beat.fold}'s fold`);
      await h.settle();
      await h.hold(beat.hold.opened);
      await h.scroll("main", { to: "button.crew-fold", at: { of: ".hdr", edge: "bottom" } }, beat.foldScroll);
      const stands = await h.page.evaluate(who => {
        const box = el => el.getBoundingClientRect();
        const head = [...document.querySelectorAll("button.crew-fold")].find(fold => fold.textContent.trim().startsWith(who));
        const rows = box(document.getElementById(head.getAttribute("aria-controls"))), control = box(document.querySelector(".plans-seg"));
        const header = box(document.querySelector(".hdr")), bar = box(document.getElementById("minibar"));
        const whole = at => at.top >= header.bottom || at.bottom <= header.bottom;
        return { control: whole(control), chips: [...document.querySelectorAll('#view-plans button[data-chip="plans-day"]')].every(chip => whole(box(chip))),
          rows: rows.top >= header.bottom && rows.bottom <= bar.top };
      }, beat.fold);
      if (!stands.control) throw new Error("the My day | Crew control is cut by the header");
      if (!stands.chips) throw new Error("the day chips are cut by the header");
      if (!stands.rows) throw new Error(`${beat.fold}'s rows are not whole between the header and the next-pick bar`);
      await h.hold(beat.hold.fold);
    },
  },

  /* The Map again, for the crew: a touch on a hotel's crew pill, and the
     hotel sheet's "Your crew's picks here", as it opens. */
  "crew-map": {
    async setup(h, beat) {
      await h.tap('nav button[data-tab="map"]', "the Map tab");
      await h.settle();
      await h.see(`g.map-crew[data-hotel="${beat.hotel}"]`, `the ${beat.hotel}'s crew pill`);
    },
    async play(h, beat) {
      await h.hold(beat.hold.city);
      await h.tap(`g.map-crew[data-hotel="${beat.hotel}"]`, `the ${beat.hotel}'s crew pill`);
      await h.settle();
      const said = await h.text("#sheet");
      if (!says(said, "Your crew's picks here")) throw new Error(`the ${beat.hotel}'s sheet does not say "Your crew's picks here"`);
      await h.hold(beat.hold.sheet);
    },
  },

  /* Now: the hero and "Your crew's picks right now", held; then eased down
     until Rest of your day fills the screen, and no further: the section
     after it stays under the tab bar, so the beat ends on the reader's own
     plan. */
  now: {
    async setup(h) {
      await h.see("#nowHero", "the hero");
      const said = await h.text("#view-now");
      for (const words of ["Your crew's picks right now", "yours too", "+1 more"]) if (!says(said, words)) throw new Error(`Now does not say "${words}"`);
    },
    async play(h, beat) {
      await h.hold(beat.hold.top);
      await h.scroll("main", { to: "#view-now .section-title", text: beat.stopBefore, at: { of: "nav", edge: "top" }, gap: 2 }, beat.scroll);
      const hidden = await h.page.evaluate(words => {
        const title = [...document.querySelectorAll("#view-now .section-title")].find(found => found.textContent.trim().startsWith(words));
        return !!title && title.getBoundingClientRect().top >= document.querySelector("nav").getBoundingClientRect().top;
      }, beat.stopBefore);
      if (!hidden) throw new Error(`"${beat.stopBefore}" came into view`);
      await h.hold(beat.hold.foot);
    },
  },
};

export { beats };
