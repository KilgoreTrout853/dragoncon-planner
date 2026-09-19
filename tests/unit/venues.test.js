/* Venue names and rooms: the pure helpers. The number in brackets is the
   harness line the assertion came from (tests/PORT-LEDGER.md). */
import { describe, expect, it } from "vitest";
import { samePlace } from "../../src/app.js";
import { cleanRoom, hotelMatches, hotelPhrase } from "../../src/venues.js";

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
