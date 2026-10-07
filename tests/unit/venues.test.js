/* Venue names and rooms: the pure helpers. The number in brackets is the
   harness line the assertion came from (tests/PORT-LEDGER.md). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { samePlace } from "../../src/picks.js";
import { cleanRoom, hotelGroup, hotelMatches, hotelPhrase, hotelShort, hotelVar, placeHTML, placeText, roomWords } from "../../src/venues.js";

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
    expect(hotelPhrase("AmericasMart Building 2")).toBe("Mart 2");
    expect(hotelPhrase("AmericasMart Building 3")).toBe("Mart 3");
  });
});

/* The Mart's two buildings and their group (DECISIONS #91): new tests, not
   rows of tests/PORT-LEDGER.md. */
describe("the Mart: two venues, one group", () => {
  const B2 = "AmericasMart Building 2", B3 = "AmericasMart Building 3";
  it("a chip's value is a venue or a group: Mart is both buildings, a building itself alone", () => {
    expect([hotelGroup(B2), hotelGroup(B3)]).toEqual(["Mart", "Mart"]);
    expect([hotelMatches({ hotel: B2 }, "Mart"), hotelMatches({ hotel: B3 }, "Mart"), hotelMatches({ hotel: "Westin" }, "Mart")]).toEqual([true, true, false]);
    expect([hotelMatches({ hotel: B2 }, B2), hotelMatches({ hotel: B3 }, B2)]).toEqual([true, false]);
  });
  it("the group's colour is its first hotel's - the Mart's, not Other's grey - and its label Mart", () => {
    expect(hotelVar("Mart")).toBe("--h-Mart");
    expect([hotelVar(B2), hotelVar(B3)]).toEqual(["--h-Mart", "--h-Mart"]);
    expect([hotelShort("Mart"), hotelShort(B2), hotelShort(B3)]).toEqual(["Mart", "Mart 2", "Mart 3"]);
  });
  it("a hotel's own colour comes before its group's, and a name that is neither is Other's", () => {
    expect([hotelVar("Other"), hotelVar("Streaming"), hotelVar("Courtland Grand"), hotelVar("Nowhere")]).toEqual(["--h-Other", "--h-Streaming", "--h-Courtland", "--h-Other"]);
  });
  it("hotelPhrase(): a building takes no article, as the park takes none, and a hotel takes the", () => {
    expect([hotelPhrase(B2), hotelPhrase(B3)]).toEqual(["Mart 2", "Mart 3"]);
    expect([hotelPhrase("Hyatt"), hotelPhrase("Courtland Grand"), hotelPhrase("Hardy Ivy Park")]).toEqual(["the Hyatt", "the Courtland", "Hardy Ivy Park"]);
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
/* The words a row says for a room under a floor already named - the
   building view's card (DECISIONS #95). New tests, not rows of
   tests/PORT-LEDGER.md. */
describe("a room's words, under its floor", () => {
  it("its room ids, joined: one room, a composite's rooms, a room of the Mart's", () => {
    expect(roomWords({ rooms: ["Concourse"], room: "Concourse" })).toBe("Concourse");
    expect(roomWords({ rooms: ["Hanover A", "Hanover B"], room: "Hanover AB" })).toBe("Hanover A + Hanover B");
    expect(roomWords({ rooms: ["203D"], room: "Mart2 203D ArtCarp - booth # 1718" })).toBe("203D");
  });
  it("else, a booth in one of the Mart's vendor halls: the words after the hall and its floor", () => {
    expect(roomWords({ rooms: [], room: "Mart2 Vendor Hall Floor 3 Sidestreet Book Market - booth 3201" })).toBe("Sidestreet Book Market - booth 3201");
    expect(roomWords({ rooms: [], room: "Mart2 Vendor Hall Floor 1 The Missing Volume booth 1300" })).toBe("The Missing Volume booth 1300");
    expect(roomWords({ room: "Mart2 Vendor Hall Floor 12   Booth 9  " })).toBe("Booth 9");
  });
  it("its ids come first: a room with ids says them, whatever its string", () => {
    expect(roomWords({ rooms: ["A"], room: "Mart2 Vendor Hall Floor 2 The Booth" })).toBe("A");
  });
  it("else nothing: a room that only repeats its floor, a vendor hall with no words after its floor, a hall that is not the Mart's, and no room at all", () => {
    for (const room of ["12th Floor", "Mart Building 3, Floor 1", "Mart2 Vendor Hall Floor 2", "Mart2 Vendor Hall Floor 2 ", "Vendor Hall Floor 2 The Booth", "Mart2 Vendor Hall The Booth", "Steps B", "", null, undefined]) {
      expect(roomWords({ rooms: [], room }), String(room)).toBe("");
    }
    expect(roomWords({})).toBe("");
  });
  it("is text, not markup: for the caller to escape", () => {
    expect(roomWords({ rooms: ["A <b>"] })).toBe("A <b>");
    expect(roomWords({ room: "Mart2 Vendor Hall Floor 1 Fish & <i>Chips</i>" })).toBe("Fish & <i>Chips</i>");
  });
});

describe("a place as words", () => {
  const shown = ev => { const holder = document.createElement("div"); holder.innerHTML = placeHTML(ev); return holder.textContent; };

  it("the hotel before the room, as the markup has it", () => {
    expect(placeText({hotel: "Hilton", room: "313-314"})).toBe("Hilton · 313-314");
    expect(placeText({hotel: "Courtland Grand", room: "Atlanta 1-2"})).toBe("Courtland · Atlanta 1-2");
  });
  it("the Mart's room alone, a stream as Streaming, an offsite venue as itself, and a hotel alone where the room is blank", () => {
    expect(placeText({hotel: "AmericasMart Building 3", room: "Mart Building 3, Floor 1"})).toBe("Mart Building 3, Floor 1");
    expect(placeText({hotel: "Streaming", room: "Channel 2"})).toBe("Streaming");
    expect(placeText({hotel: "Other", room: "Joystick Gamebar"})).toBe("Joystick Gamebar");
    expect(placeText({hotel: "Other", room: "Other", location: "O Walton Spring Park"})).toBe("Walton Spring Park");
    expect(placeText({hotel: "Other", room: "Other", location: "Other"})).toBe("Offsite");
    expect(placeText({hotel: "Hyatt", room: "  "})).toBe("Hyatt");
    expect(placeText({hotel: "AmericasMart Building 2", room: ""})).toBe("Mart 2");
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
