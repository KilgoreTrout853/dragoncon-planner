// @vitest-environment node
/* data/2027/venues.json against src/venues.js (DECISIONS #45). Until PR 9
   moves the client onto the venues file, the walk and each hotel's order,
   short name, group and colour variable are written twice, and this holds the
   two copies equal. PR 9 deletes this test with the constants. It reads the
   constants through what src/venues.js already exports, so nothing is
   exported for it. A new test, not a row of tests/PORT-LEDGER.md, so its
   titles carry no harness line. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HOTEL_ORDER, WALK, hotelGroup, hotelShort, hotelVar } from "../../src/venues.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const venues = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "2027", "venues.json"), "utf8"));
const hotels = [...venues.hotels].sort((a, b) => a.order - b.order);

describe("data/2027/venues.json and src/venues.js", () => {
  it("hold the same walk, pair for pair", () => {
    expect(venues.walk).toEqual(WALK);
  });

  it("hold the hotels in the same order", () => {
    expect(hotels.map(h => h.hotel)).toEqual(HOTEL_ORDER);
  });

  it("give every hotel the same short name, group and colour variable", () => {
    for (const h of hotels) {
      expect(h.short, h.hotel).toBe(hotelShort(h.hotel));
      expect(h.group, h.hotel).toBe(hotelGroup(h.hotel));
      expect(`--h-${h.var}`, h.hotel).toBe(hotelVar(h.hotel));
    }
  });
});
