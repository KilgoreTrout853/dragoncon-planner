/* An event's row (DECISIONS #64, #73): the title, then one line of when and
   where - the day's label where asked, the time as a range, the place, the
   level - then one line of what else is true of the event - Celebrity, the
   caller's context, the flags, the track - and the star on the right. The
   sample has no event with a facet but an age, no gaming event without a
   track and none with nothing for a third line, so this copy of it makes
   them; its Hilton celebrity panel, its Atrium Ballroom concert and its Mart
   card game are the sample's own. What a line drops on a narrow screen is
   layout, which jsdom does not do: tests/rules/style.test.js holds the rules,
   and the browser check the rest. New tests, not rows of
   tests/PORT-LEDGER.md. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

const sample = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sample-events.json"), "utf8"));
const SAT = sample.events.filter(e => e.day === "2026-09-05" && !(e.tags && e.tags.guests) && e.track && !e.cancelled);
const FLAGS = SAT[0].id, GAMING = SAT[1].id, BARE = SAT[2].id, CANCELLED = SAT[3].id;
const change = {
  [FLAGS]: e => ({...e, facets: {sold_out: true, cost: "extra", signup: true}, tags: {...(e.tags || {}), guests: "celebrity", audience: "kids"}}),
  [GAMING]: e => ({...e, type: "gaming", track: "", tracks: []}),
  [BARE]: e => ({...e, type: "panel", track: "", tracks: [], facets: {}}),
  [CANCELLED]: e => ({...e, cancelled: true}),
};
const data = {...sample, events: sample.events.map(e => (change[e.id] ? change[e.id](e) : e))};

describe("an event's row", () => {
  let page, app, handle, state;
  const draw = html => { const ul = document.createElement("ul"); ul.innerHTML = html; return ul.firstElementChild; };
  const row = (id, opts = {list: "test"}) => draw(app.rowHTML(app.byId.get(id), opts));
  const words = el => el.textContent.replace(/\s+/g, " ").trim();
  const parts = li => [...li.querySelectorAll(".flags > *")].map(words).map(w => w.replace(/^· /, ""));

  beforeAll(async () => {
    page = await bootPage({data});
    ({app, handle} = page);
    state = handle.state;
  }, 30000);
  afterAll(() => page.cleanup());

  it("has no time column: the title, then when and where, then what else is true of it", () => {
    const li = row("s0590");
    expect(li.querySelector(".t")).toBe(null);
    expect([...li.querySelector(".row-main").children].map(c => c.className)).toEqual(["title", "when-where", "flags"]);
    expect(words(li.querySelector(".title"))).toBe("Ask a NASA Scientist: The Road to Mars");
    expect(words(li.querySelector(".when-where"))).toBe("2:30–3:30 PM · Hilton · 209-211 · 2nd Floor");
    expect(parts(li)).toEqual(["Celebrity", "Space"]);
  });
  it("keeps its element, its classes and its two buttons", () => {
    const li = row("s0590", {list: "browse"});
    expect(li.matches('li.row[data-id="s0590"][data-list="browse"]')).toBe(true);
    expect(li.querySelector("button.row-main")).not.toBe(null);
    expect(li.querySelector("button.star")).not.toBe(null);
  });
  it("names the place in its hotel's hue, the hotel first, as the hero does", () => {
    const room = row("s0590").querySelector(".when-where .room");
    expect([room.querySelector(".rh").textContent, room.querySelector(".rr").textContent]).toEqual(["Hilton", "209-211"]);
    expect(room.getAttribute("style")).toMatch(/--h-Hilton/);
  });
  it("says the day's label first where the caller asks for it", () => {
    expect(words(row("s0590", {list: "test", showDay: true}).querySelector(".when-where"))).toBe("Sat 2:30–3:30 PM · Hilton · 209-211 · 2nd Floor");
    expect(row("s0590").querySelector(".day")).toBe(null);
  });
  it("leaves the level off where the room already says it", () => {
    const li = row("s0587");
    expect(li.querySelector(".level")).toBe(null);
    expect(words(li.querySelector(".when-where"))).toBe("8:00–10:00 PM · Marriott · Atrium Ballroom");
  });
  it("names a Mart event by its room alone, which names the Mart, with no level beside it", () => {
    const li = row("s0001");
    expect(li.querySelector(".room .rh")).toBe(null);
    expect(words(li.querySelector(".when-where"))).toBe("5:30–10:00 PM · Mart Building 3, Floor 1");
    expect(app.placeHTML(app.byId.get("s0001"))).toBe(`<span class="rr">Mart Building 3, Floor 1</span>`);
  });
  it("puts Celebrity first on the third line, never on the first", () => {
    const li = row("s0590");
    expect(li.querySelector(".title .celeb")).toBe(null);
    expect(li.querySelector(".flags > :first-child").matches(".celeb")).toBe(true);
  });
  it("says the third line's parts in one order: Celebrity, the caller's context, the flags, the track", () => {
    const li = row(FLAGS, {list: "test", status: "In 25 min", labels: ["Followed"]});
    expect(parts(li)).toEqual(["Celebrity", "In 25 min", "Followed", "Sold out", "Extra fee", "Sign-up", "Kids", app.byId.get(FLAGS).track]);
    expect(li.querySelector(".flags .status").textContent).toBe("In 25 min");
  });
  it("draws Sold out alone in the warning colour, an age as an ordinary flag", () => {
    expect([...row(FLAGS).querySelectorAll(".flag.warn")].map(words)).toEqual(["Sold out"]);
    const adult = row("s0044");
    expect(parts(adult)).toEqual(["18+", "Miniatures Games"]);
    expect(adult.querySelector(".flag.warn")).toBe(null);
  });
  it("says Gaming for a gaming event with no track, and has no third line with nothing to say", () => {
    expect(parts(row(GAMING))).toEqual(["Gaming"]);
    const bare = row(BARE);
    expect(bare.querySelector(".flags")).toBe(null);
    expect(bare.querySelectorAll(".track, .status")).toHaveLength(0);
  });
  it("leads a cancelled title with its tag, inside the title's two lines, and not on line 3", () => {
    const li = row(CANCELLED);
    expect(li.classList.contains("cancelled")).toBe(true);
    expect(li.querySelector(".title").firstElementChild.matches(".cancelled-tag")).toBe(true);
    expect(words(li.querySelector(".title"))).toBe(`Cancelled ${app.byId.get(CANCELLED).title}`);
    expect(li.querySelector(".flags .cancelled-tag")).toBe(null);
  });
  it("and a removed one with its own", () => {
    const ev = {...app.byId.get("s0590"), removed: true};
    const li = draw(app.rowHTML(ev, {list: "mine"}));
    expect(li.querySelector(".title").firstElementChild.matches(".removed-tag")).toBe(true);
    expect(words(li.querySelector(".title .removed-tag"))).toBe("Removed from the schedule");
  });
  it("says its time under a time head too: one row shape everywhere", () => {
    Object.assign(state.browse, {q: "", day: "2026-09-05", hotel: "All"});
    state.tab = "browse";
    handle.render();
    const first = document.querySelector("#view-browse .time-head + .row");
    const ev = app.byId.get(first.dataset.id);
    expect(words(first.querySelector(".when"))).toBe(app.fmtRange(ev._s, ev._e));
    expect(document.querySelectorAll("#view-browse .row .when").length).toBe(document.querySelectorAll("#view-browse .row").length);
    expect(document.querySelectorAll("#view-browse .flags > :empty")).toHaveLength(0);
  });
});
