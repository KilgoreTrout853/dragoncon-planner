/* Venue names and rooms: the pure helpers. The number in brackets is the
   harness line the assertion came from (tests/PORT-LEDGER.md). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { samePlace } from "../../src/picks.js";
import { cleanRoom, hotelMatches, hotelPhrase, placeHTML, placeText } from "../../src/venues.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("venues", () => {
  it("Other matches streams and offsite venues and nothing else; a venue still matches itself [406]", () => {
    expect(hotelMatches({ hotel: "Streaming" }, "Other")).toBe(true);
    expect(hotelMatches({ hotel: "Other" }, "Other")).toBe(true);
    expect(hotelMatches({ hotel: "Hilton" }, "Other")).toBe(false);
    expect(hotelMatches({ hotel: "Streaming" }, "Streaming")).toBe(true);
    expect(hotelMatches({ hotel: "Hilton" }, "All")).toBe(true);
  });
  it("the park takes no article; the Mart is the Mart [1519]", () => {
    expect(hotelPhrase("Hardy Ivy Park")).toBe("Hardy Ivy Park");
    expect(hotelPhrase("AmericasMart")).toBe("the Mart");
  });
});

describe("rooms", () => {
  it("an offsite venue loses its O marker and nothing else does [860]", () => {
    expect(cleanRoom("Other", "O Joystick Gamebar")).toBe("Joystick Gamebar");
    expect(cleanRoom("Other", "Walton Spring Park")).toBe("Walton Spring Park");
    expect(cleanRoom("Hilton", "Salon")).toBe("Salon");
  });
  it("a respelled room is the same place; a different room is not [862]", () => {
    expect(samePlace("Hilton Salon", "Hilton-Salon")).toBe(true);
    expect(samePlace("Hilton Salon", "Hilton Galleria 5")).toBe(false);
  });
});

/* A place as words (DECISIONS #75), for a label: new tests, not rows of
   tests/PORT-LEDGER.md. */
describe("a place as words", () => {
  const shown = ev => { const holder = document.createElement("div"); holder.innerHTML = placeHTML(ev); return holder.textContent; };

  it("the hotel before the room, as the markup has it", () => {
    expect(placeText({hotel: "Hilton", room: "313-314"})).toBe("Hilton · 313-314");
    expect(placeText({hotel: "Courtland Grand", room: "Atlanta 1-2"})).toBe("Courtland · Atlanta 1-2");
  });
  it("the Mart's room alone, a stream as Streaming, an offsite venue as itself, and a hotel alone where the room is blank", () => {
    expect(placeText({hotel: "AmericasMart", room: "Mart Building 3, Floor 1"})).toBe("Mart Building 3, Floor 1");
    expect(placeText({hotel: "Streaming", room: "Channel 2"})).toBe("Streaming");
    expect(placeText({hotel: "Other", room: "Joystick Gamebar"})).toBe("Joystick Gamebar");
    expect(placeText({hotel: "Other", room: "Other", location: "O Walton Spring Park"})).toBe("Walton Spring Park");
    expect(placeText({hotel: "Other", room: "Other", location: "Other"})).toBe("Offsite");
    expect(placeText({hotel: "Hyatt", room: "  "})).toBe("Hyatt");
    expect(placeText({hotel: "AmericasMart", room: ""})).toBe("Mart");
    expect(placeText({hotel: "Unknown", room: "", location: ""})).toBe("Location TBA");
  });
  it("is text, not markup: what a room holds is as the listing wrote it, for the caller to escape", () => {
    const ev = {hotel: "Hilton", room: `Salon <b> & "A"`};
    expect(placeText(ev)).toBe(`Hilton · Salon <b> & "A"`);
    expect(placeHTML(ev)).toBe(`<span class="rh">Hilton</span> · <span class="rr">Salon &lt;b&gt; &amp; &quot;A&quot;</span>`);
    expect(shown(ev)).toBe(placeText(ev));
  });
  /* Each event twice: as its file holds it, and with its room cleaned, as
     the app holds it (data.js replaceSchedule()). */
  for (const [name, file] of [["2026's schedule", ["data", "2026", "events.v2.json"]], ["the sample fixture", ["tests", "sample-events.json"]]]) {
    it(`is exactly the text of placeHTML(), for every event of ${name}`, () => {
      const events = JSON.parse(fs.readFileSync(path.join(ROOT, ...file), "utf8")).events;
      expect(events.length).toBeGreaterThan(0);
      const differ = events.flatMap(e => [e, {...e, room: cleanRoom(e.hotel, e.room)}]).filter(e => placeText(e) !== shown(e));
      expect(differ.map(e => e.id)).toEqual([]);
    });
  }
});
