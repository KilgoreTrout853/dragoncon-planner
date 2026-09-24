/* An untagged event: the tag stage could not answer it, and it carries no
   tags key (DECISIONS #46). Every read of an event's tags goes through
   tagsOf() (DECISIONS #49), so such an event is found by its text, shows in
   Now, Browse and Mine, and is under no work, axis or guests tile. 517 of the
   sample's 558 events are untagged. The sample's two celebrity events name
   nobody, so this copy of it makes one more, with speakers, so that there are
   guests to be under. New tests, not rows of tests/PORT-LEDGER.md. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

const sample = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sample-events.json"), "utf8"));
const noise = e => (e.tracks || []).some(t => ["Epic Photos", "Video Room"].includes(t)) || /^photo session/i.test(e.title);
const speakers = e => (e.people || []).filter(p => p.src === "speakers").map(p => p.id);
/* An untagged Saturday event on at the helper's 1:05 PM, with speakers of its
   own, who would be guests if it were a celebrity event; and another event,
   with other speakers, which this copy makes one. */
const untagged = sample.events.find(e => !("tags" in e) && e.day === "2026-09-05" && e.start <= "2026-09-05T14:05" && e.end > "2026-09-05T13:05"
  && !noise(e) && speakers(e).length);
const celebrity = sample.events.find(e => !("tags" in e) && e.id !== untagged.id && speakers(e).length
  && !(untagged.people || []).some(p => speakers(e).includes(p.id)));
const data = { ...sample, events: sample.events.map(e => e.id === celebrity.id ? { ...e, tags: { kind: "qa", guests: "celebrity" } } : e) };

describe("an untagged event", () => {
  let page, app, handle, state, ev;
  const show = tab => { state.tab = tab; handle.render(); };

  beforeAll(async () => {
    page = await bootPage({ data });
    ({ app, handle } = page);
    state = handle.state;
    ev = app.byId.get(untagged.id);
    await page.until(() => app.BOOT.indexed > 0, 20000, "the index");
  }, 30000);
  afterAll(() => page.cleanup());

  it("carries no tags key, and reads as the one empty set of tags every untagged event shares", () => {
    expect("tags" in ev).toBe(false);
    expect(app.tagsOf(ev)).toEqual({});
    expect(Object.isFrozen(app.tagsOf(ev))).toBe(true);
    expect(app.tagsOf(ev)).toBe(app.tagsOf(handle.events.find(e => e.id !== ev.id && !("tags" in e))));
  });
  it("is found by a word of its title", () => {
    const word = untagged.title.split(/[^A-Za-z]+/).filter(w => w.length >= 5).sort((a, b) => b.length - a.length)[0];
    expect(app.parseQuery(word).residual).toBe(word.toLowerCase());          // a search word, not a filter word
    Object.assign(state.browse, { q: word, day: "All", hotel: "All", showPast: true });
    expect(app.browseResults().some(e => e.id === ev.id)).toBe(true);
    Object.assign(state.browse, { q: "", showPast: false });
  });
  it("is on Browse, on its day at its hotel", () => {
    Object.assign(state.browse, { day: ev.day, hotel: ev.hotel });
    show("browse");
    expect(document.querySelector(`#view-browse .row[data-id="${ev.id}"]`)).not.toBe(null);
    Object.assign(state.browse, { day: null, hotel: "All" });
  });
  it("is on Now while it is on", () => {
    state.now.hotel = ev.hotel;
    show("now");
    expect(document.querySelector(`#view-now .row[data-id="${ev.id}"]`)).not.toBe(null);
    state.now.hotel = "All";
  });
  it("is in Mine when picked", () => {
    handle.picks.set([ev.id]);
    show("mine");
    expect(document.querySelector(`#view-mine [data-id="${ev.id}"], #view-mine [data-hero="${ev.id}"]`)).not.toBe(null);
    handle.picks.set([]);
  });

  describe("the tiles", () => {
    let cat;
    beforeAll(() => { cat = app.buildCatalogue(); });

    it("there are work, axis and guests tiles to be under", () => {
      expect(cat.fandom.length).toBeGreaterThan(0);
      expect(cat.topic.length).toBeGreaterThan(0);
      expect(cat.guest.map(t => t.key)).toEqual(expect.arrayContaining(speakers(celebrity)));
    });
    it("it is under no work, axis or guests tile", () => {
      const under = [...cat.fandom.map(t => ["work", t.key]), ...cat.topic.map(t => ["axis", t.key]), ...cat.guest.map(t => ["person", t.key])]
        .filter(([kind, key]) => app.eventsFor({ kind, key }).some(e => e.id === ev.id));
      expect(under).toEqual([]);
    });
    it("and its speakers are no guests by it: only a celebrity event's listing makes one", () => {
      expect(app.isCeleb(ev)).toBe(false);
      expect(cat.guest.map(t => t.key).filter(key => speakers(untagged).includes(key))).toEqual([]);
    });
  });
});
