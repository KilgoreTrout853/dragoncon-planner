/* The Map tab: the drawing, the day chips, the pick pills and the hotel sheet,
   the now and next rings, the card under the map, and the minute tick. The
   number in brackets is the harness line the assertion came from
   (tests/PORT-LEDGER.md). The clock is Saturday 1:05 PM. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bootPage } from "../helpers/page.js";
import { mutationsDuring, tap } from "../helpers/act.js";

describe("the Map tab", () => {
  let page, app, handle, state, at, today;
  const el = id => document.getElementById(id);
  const map = () => el("view-map");
  const svg = () => map().querySelector("svg.map");
  const num = (node, attr) => +node.getAttribute(attr);
  const onMap = e => !!app.MAP_HOTELS[e.hotel] && !e.cancelled;
  const setPicks = ids => { handle.picks.set(ids); state.map.day = null; handle.render(); };
  const pillsOf = () => Object.fromEntries([...map().querySelectorAll(".map-pill")].map(p => [p.dataset.hotel, p.querySelector("text").textContent]));
  const rings = () => [...map().querySelectorAll(".map-ring")].map(r => `${r.classList.contains("now") ? "now" : "next"}:${r.dataset.hotel}`).sort().join(" ");
  const cardWhen = () => { const w = map().querySelector(".nc-when"); return w ? w.textContent.trim() : null; };
  const pressedDay = () => [...map().querySelectorAll('[data-chip="map-day"][aria-pressed="true"]')].map(c => c.dataset.value).join(",");

  beforeAll(async () => {
    page = await bootPage();
    ({ app, handle } = page);
    state = handle.state;
    at = handle.now(); today = app.conDayKey(at);
    document.querySelector('.nav button[data-tab="map"]').click();
  }, 30000);
  afterAll(() => page.cleanup());

  describe("step 1: the base map", () => {
    let g, peachtree, courtlandX, vb;
    const geo = hotel => { const r = svg().querySelector(`.map-hotel[data-hotel="${hotel}"] rect`), x = num(r, "x"), y = num(r, "y"), w = num(r, "width"), h = num(r, "height");
      return { x, y, w, h, right: x + w, bottom: y + h, cx: x + w / 2, cy: y + h / 2 }; };

    beforeAll(() => {
      g = Object.fromEntries(["Hyatt", "Marriott", "Hilton", "AmericasMart", "Westin", "Courtland Grand", "Hardy Ivy Park"].map(h => [h, geo(h)]));
      peachtree = num(svg().querySelector('[data-street="Peachtree"]'), "x1");
      courtlandX = num(svg().querySelector('[data-street="Courtland"]'), "x1");
      vb = svg().getAttribute("viewBox").split(" ").map(Number);
    });

    it("the Map tab shows its own view [1380]", () => {
      expect(map().hidden).toBe(false);
      expect(el("view-mine").hidden).toBe(true);
      expect(el("view-browse").hidden).toBe(true);
      expect(document.querySelector('.nav button[data-tab="map"]').getAttribute("aria-current")).toBe("page");
    });
    it("one SVG, framed to the drawing (385 by 305) [1383, and 1647]", () => {
      expect(svg().getAttribute("viewBox")).toBe("-3 111 385 305");
      expect(map().querySelectorAll("svg")).toHaveLength(1);
    });
    it("one block per walk-table hotel [1386]", () => {
      const walkHotels = [...new Set(Object.keys(app.WALK).flatMap(k => k.split("|")))].sort();
      expect([...svg().querySelectorAll(".map-hotel")].map(b => b.dataset.hotel).sort()).toEqual(walkHotels);
    });
    it("no block for Other, Streaming or Unknown [1387]", () => {
      const drawn = [...svg().querySelectorAll("[data-hotel]")].map(b => b.dataset.hotel);
      for (const none of ["Other", "Streaming", "Unknown"]) expect(drawn).not.toContain(none);
    });
    it("east of Peachtree: Hyatt, Marriott, Hilton, left to right [1393]", () => {
      expect(g.Hilton.cx).toBeGreaterThan(g.Marriott.cx);
      expect(g.Marriott.cx).toBeGreaterThan(g.Hyatt.cx);
    });
    it("the three sit in one row [1394]", () => {
      expect(Math.abs(g.Hyatt.cy - g.Marriott.cy)).toBeLessThanOrEqual(10);
      expect(Math.abs(g.Marriott.cy - g.Hilton.cy)).toBeLessThanOrEqual(10);
    });
    it("Peachtree runs between the Mart and the Hyatt, a quarter of the way across [1395]", () => {
      expect(g.AmericasMart.cx).toBeLessThan(peachtree);
      expect(peachtree).toBeLessThan(g.Hyatt.cx);
      expect(Math.abs(peachtree - 95)).toBeLessThanOrEqual(20);
    });
    it("the Westin is south-east of the Mart, which is level with the Hyatt [1396]", () => {
      expect(g.Westin.cy).toBeGreaterThan(g.AmericasMart.cy);
      expect(g.Westin.cx).toBeGreaterThan(g.AmericasMart.cx);
      expect(Math.abs(g.AmericasMart.cy - g.Hyatt.cy)).toBeLessThanOrEqual(10);
    });
    it("the Courtland is below the Hilton, in its column [1397]", () => {
      expect(g["Courtland Grand"].cy).toBeGreaterThan(g.Hilton.cy);
      expect(Math.abs(g["Courtland Grand"].cx - g.Hilton.cx)).toBeLessThanOrEqual(10);
    });
    it("Hardy Ivy Park is above the Hyatt [1398]", () => {
      expect(g["Hardy Ivy Park"].cy).toBeLessThan(g.Hyatt.cy);
    });
    it("the Hyatt and the Marriott nearly touch [1403]", () => {
      expect(g.Marriott.x - g.Hyatt.right).toBeGreaterThan(0);
      expect(g.Marriott.x - g.Hyatt.right).toBeLessThan(15);
    });
    it("the Hilton is a real walk from the Marriott [1404]", () => {
      expect(g.Hilton.x - g.Marriott.right).toBeGreaterThan(45);
    });
    it("the Westin is south-east of the Mart and still west of Peachtree [1405]", () => {
      expect(g.Westin.cx).toBeGreaterThan(g.AmericasMart.cx);
      expect(g.Westin.right).toBeLessThanOrEqual(peachtree);
    });
    it("the Westin is about as far below the Hyatt as the park is above it [1407]", () => {
      expect(Math.abs((g.Westin.cy - g.Hyatt.cy) - (g.Hyatt.cy - g["Hardy Ivy Park"].cy))).toBeLessThanOrEqual(20);
    });
    it("the Courtland sits under the Hilton [1408]", () => {
      expect(Math.abs(g["Courtland Grand"].cx - g.Hilton.cx)).toBeLessThanOrEqual(10);
    });
    it("the Marriott-Hilton bridge crosses Courtland St [1410]", () => {
      const bridge = svg().querySelector('[data-bridge="Marriott|Hilton"]'), xs = [num(bridge, "x1"), num(bridge, "x2")];
      expect(Math.min(...xs)).toBeLessThan(courtlandX);
      expect(courtlandX).toBeLessThan(Math.max(...xs));
    });
    it("the Mart-Westin bridge is a short diagonal from the Mart's bottom edge to the Westin's top [1413]", () => {
      const bridge = svg().querySelector('[data-bridge="AmericasMart|Westin"]');
      expect(num(bridge, "y1")).toBe(g.AmericasMart.bottom);
      expect(num(bridge, "y2")).toBe(g.Westin.y);
      expect(num(bridge, "x1")).not.toBe(num(bridge, "x2"));
    });
    it("the Hyatt-Marriott bridge spans just the gap [1416]", () => {
      const bridge = svg().querySelector('[data-bridge="Hyatt|Marriott"]');
      expect(num(bridge, "x2") - num(bridge, "x1")).toBe(g.Marriott.x - g.Hyatt.right);
    });
    it("hotel blocks are 60 wide [1417]", () => {
      for (const h of ["Hyatt", "Marriott", "Hilton", "Courtland Grand", "Westin"]) expect(g[h].w, h).toBe(60);
    });
    it("the frame is cropped to the drawing with a card's padding around it [1420]", () => {
      const inset = { top: g["Hardy Ivy Park"].y - vb[1], bottom: vb[1] + vb[3] - Math.max(g["Courtland Grand"].bottom, g.Westin.bottom), left: g.AmericasMart.x - vb[0], right: vb[0] + vb[2] - g.Hilton.right };
      expect(vb[3]).toBeLessThan(320);
      Object.entries(inset).forEach(([side, v]) => { expect(v, side).toBeGreaterThanOrEqual(10); expect(v, side).toBeLessThanOrEqual(18); });
    });
    it("the streets span the cropped height [1421]", () => {
      svg().querySelectorAll("[data-street]").forEach(l => { expect(num(l, "y1")).toBe(vb[1]); expect(num(l, "y2")).toBe(vb[1] + vb[3]); });
    });
    it("the street labels sit inside the frame, above the row [1423]", () => {
      const ys = [...svg().querySelectorAll(".map-street-label")].map(t => +t.getAttribute("transform").match(/translate\([-\d.]+ ([-\d.]+)\)/)[1]);
      expect(ys).toHaveLength(2);
      ys.forEach(y => { expect(y).toBeGreaterThan(vb[1] + 60); expect(y).toBeLessThan(g.Hyatt.y); });
    });
    it("the ground fills the frame [1425]", () => {
      const ground = svg().querySelector(".map-ground");
      expect([num(ground, "x"), num(ground, "y"), num(ground, "width"), num(ground, "height")]).toEqual(vb);
    });
    it("three skybridges, none across Peachtree [1427]", () => {
      expect([...svg().querySelectorAll("[data-bridge]")].map(l => l.dataset.bridge).sort().join(";")).toBe("AmericasMart|Westin;Hyatt|Marriott;Marriott|Hilton");
    });
    it("two streets and nothing else [1429]", () => {
      expect([...svg().querySelectorAll("[data-street]")].map(l => l.dataset.street).sort().join(",")).toBe("Courtland,Peachtree");
    });
    it("Courtland St is the fainter one [1430]", () => {
      expect(svg().querySelector('[data-street="Courtland"]').classList.contains("faint")).toBe(true);
      expect(svg().querySelector('[data-street="Peachtree"]').classList.contains("faint")).toBe(false);
    });
    it("labels are abbreviated and uppercase [1432]", () => {
      const labels = [...svg().querySelectorAll(".map-hotel text")].map(t => t.textContent);
      for (const want of ["MART", "COURTLAND", "HARDY IVY"]) expect(labels).toContain(want);
      labels.forEach(l => expect(l).toBe(l.toUpperCase()));
    });
    it("a nine-letter label is marked long to fit a 60 px block; eight letters are not [1433, the page half]", () => {
      expect(svg().querySelector('[data-hotel="Courtland Grand"] text').classList.contains("long")).toBe(true);
      expect(svg().querySelector('[data-hotel="Marriott"] text').classList.contains("long")).toBe(false);
    });
    it("the park wears green, not a hotel hue [1436]", () => {
      const park = svg().querySelector('[data-hotel="Hardy Ivy Park"]');
      expect(park.classList.contains("map-park")).toBe(true);
      expect(park.getAttribute("style")).toMatch(/--park/);
      expect(park.getAttribute("style")).not.toMatch(/--h-/);
    });
    it("each hotel wears its own hue [1437]", () => {
      expect(svg().querySelector('[data-hotel="Hyatt"]').getAttribute("style")).toMatch(/--h-Hyatt/);
      expect(svg().querySelector('[data-hotel="Courtland Grand"]').getAttribute("style")).toMatch(/--h-Courtland\b/);
    });
  });

  describe("step 2: day chips", () => {
    it("a day chip row sits above the map [1443]", () => {
      const row = map().querySelector('.chips[data-row="map-day"]');
      expect(row.compareDocumentPosition(svg()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    it("it lists the con days as the same chips Search uses [1445]", () => {
      const chips = [...map().querySelectorAll("[data-chip='map-day']")];
      expect(chips.map(c => c.dataset.value)).toEqual(app.CON_DAYS);
      chips.forEach(c => expect(c.classList.contains("chip")).toBe(true));
    });
    it("with the same short labels [1447]", () => {
      expect([...map().querySelectorAll("[data-chip='map-day']")].map(c => c.textContent).join(",")).toBe("Wed,Thu,Fri,Sat,Sun,Mon");
    });
    it("untouched, it follows the clock: Saturday at the Saturday preview [1449]", () => {
      expect(state.map.day).toBe(null);
      expect(pressedDay()).toBe("2026-09-05");
      expect(map().querySelector(".map-wrap").dataset.day).toBe("2026-09-05");
    });
    it("tapping Sun selects Sunday and the map below follows [1452]", () => {
      map().querySelectorAll("[data-chip='map-day']")[4].click();
      expect(state.map.day).toBe("2026-09-06");
      expect(pressedDay()).toBe("2026-09-06");
      expect(map().querySelector(".map-wrap").dataset.day).toBe("2026-09-06");
    });
    it("1 AM Sunday is still Saturday on the map [1457]", () => {
      state.map.day = null;
      handle.setTimeOverride("2026-09-06T01:00");
      expect(state.tab).toBe("map");
      expect(pressedDay()).toBe("2026-09-05");
    });
    it("a new preview time lets the map follow the clock again [1460]", () => {
      state.map.day = "2026-09-07";
      handle.setTimeOverride("2026-09-05T13:05");
      expect(state.map.day).toBe(null);
      expect(pressedDay()).toBe("2026-09-05");
    });
    /* the harness looked for data-row="map-day" in the source */
    it("the row is named, so it keeps its place across renders [1461]", () => {
      expect(map().querySelector('.chips[data-row="map-day"]')).toBeTruthy();
    });
  });

  describe("step 3: pick pills and the hotel sheet", () => {
    let ids, panel;
    const want = (day, hotel, n) => handle.events.filter(e => e._cd === day && e.hotel === hotel && !e.cancelled).slice(0, n).map(e => e.id);
    const SAT = { Hyatt: "2", Marriott: "1" };

    beforeAll(() => {
      ids = [...want("2026-09-05", "Hyatt", 2), ...want("2026-09-05", "Marriott", 1), ...want("2026-09-06", "Hilton", 1)];
      setPicks(ids);
      panel = el("panel-hotel");
    });
    afterAll(() => { handle.closeSheet(); state.browse.hotel = "All"; state.browse.day = null; state.tab = "map"; setPicks([]); });

    it("four test picks: two Hyatt and one Marriott on Saturday, one Hilton on Sunday [1470]", () => {
      expect(ids).toHaveLength(4);
    });
    it("pills count Saturday's picks per hotel and hide at zero [1472]", () => {
      expect(pillsOf()).toEqual(SAT);
    });
    it("the pill sits on the block's top-right corner [1476]", () => {
      const pill = map().querySelector('.map-pill[data-hotel="Hyatt"] rect'), block = map().querySelector('.map-hotel[data-hotel="Hyatt"] rect');
      const centre = { x: num(pill, "x") + num(pill, "width") / 2, y: num(pill, "y") + num(pill, "height") / 2 };
      expect(Math.abs(centre.x - (num(block, "x") + num(block, "width")))).toBeLessThanOrEqual(12);
      expect(Math.abs(centre.y - num(block, "y"))).toBeLessThanOrEqual(12);
    });
    it("each block says what it holds [1478]", () => {
      expect(map().innerHTML).toMatch(/aria-label="Hyatt: 2 picks on Saturday"/);
      expect(map().innerHTML).toMatch(/aria-label="Westin: no picks on Saturday"/);
    });
    it("Sunday shows Sunday's pills [1481]", () => {
      map().querySelector('[data-chip="map-day"][data-value="2026-09-06"]').click();
      expect(pillsOf()).toEqual({ Hilton: "1" });
    });
    it("and Saturday shows Saturday's again [1483]", () => {
      map().querySelector('[data-chip="map-day"][data-value="2026-09-05"]').click();
      expect(pillsOf()).toEqual(SAT);
    });

    describe("tapping a hotel opens its sheet", () => {
      let rows, wantRows;
      beforeAll(() => {
        tap(map().querySelector('.map-hotel[data-hotel="Hyatt"] rect'));
        rows = [...panel.querySelectorAll(".row")];
        wantRows = handle.events.filter(e => handle.picks.get().has(e.id) && e.hotel === "Hyatt" && e._cd === "2026-09-05").map(e => e.id);
      });

      it("tapping a hotel opens the hotel sheet [1488]", () => {
        expect(el("sheetWrap").hidden).toBe(false);
        expect(panel.hidden).toBe(false);
        expect(el("panel-event").hidden).toBe(true);
        expect(el("panel-settings").hidden).toBe(true);
      });
      it("headed by the hotel's name [1489]", () => {
        expect(el("sheetTitleHotel").textContent).toBe("Hyatt");
        expect(el("sheet").getAttribute("aria-labelledby")).toBe("sheetTitleHotel");
      });
      it("with the Hyatt picks that day, in time order [1492]", () => {
        expect(rows.map(r => r.dataset.id)).toEqual(wantRows);
        expect(rows).toHaveLength(2);
      });
      it("as standard rows with stars [1493]", () => {
        rows.forEach(r => { expect(r.querySelector(".star[aria-pressed='true']")).toBeTruthy(); expect(r.querySelector(".row-main")).toBeTruthy(); expect(r.querySelector(".room")).toBeTruthy(); });
      });
      it("and a line saying which day and how many [1494]", () => {
        expect(panel.textContent).toMatch(/Saturday/);
        expect(panel.textContent).toMatch(/2 picks/);
      });
      it("a row opens the event sheet [1497]", () => {
        rows[0].querySelector(".row-main").click();
        expect(el("panel-event").hidden).toBe(false);
        expect(panel.hidden).toBe(true);
        expect(el("sheetTitleEvent").textContent).toBe(handle.events.find(e => e.id === wantRows[0]).title);
        handle.closeSheet();
      });
    });

    describe("the star works from inside it, and the map behind keeps up", () => {
      beforeAll(() => tap(map().querySelector('.map-hotel[data-hotel="Hyatt"] rect')));

      it("unstarring in the sheet drops the row and the pill behind [1502]", () => {
        panel.querySelector(".row .star").click();
        expect(handle.picks.get().size).toBe(3);
        expect(panel.querySelectorAll(".row")).toHaveLength(1);
        expect(pillsOf().Hyatt).toBe("1");
      });
      it("unstarring the last one shows the empty state and the pill goes [1504]", () => {
        panel.querySelector(".row .star").click();
        expect(handle.picks.get().size).toBe(2);
        expect(panel.querySelector(".row")).toBe(null);
        expect(panel.textContent).toMatch(/No picks here on Saturday/);
        expect(pillsOf().Hyatt).toBeUndefined();
        handle.picks.set(ids); handle.closeSheet();
      });
    });

    it("tapping a pill opens that hotel's sheet [1508]", () => {
      tap(map().querySelector('.map-pill[data-hotel="Marriott"] text'));
      expect(el("sheetWrap").hidden).toBe(false);
      expect(el("sheetTitleHotel").textContent).toBe("Marriott");
      expect(panel.querySelectorAll(".row")).toHaveLength(1);
      handle.closeSheet();
    });

    describe("an empty hotel offers a search", () => {
      let button;
      beforeAll(() => { tap(map().querySelector('.map-hotel[data-hotel="Westin"] rect')); button = panel.querySelector('[data-act="map-search"]'); });

      it("an empty hotel says so and offers a search [1513]", () => {
        expect(panel.textContent).toMatch(/No picks here on Saturday/);
        expect(button.textContent.trim()).toBe("Search the Westin on Saturday");
      });
      it("the button switches to Search [1515]", () => {
        button.click();
        expect(el("sheetWrap").hidden).toBe(true);
        expect(state.tab).toBe("browse");
        expect(el("view-browse").hidden).toBe(false);
      });
      it("with the hotel and the day as filters [1516]", () => {
        expect(state.browse).toMatchObject({ hotel: "Westin", day: "2026-09-05", q: "" });
      });
      it("and the chips show them pressed [1517]", () => {
        expect(document.querySelector('#view-browse [data-chip="hotel"][data-value="Westin"]').getAttribute("aria-pressed")).toBe("true");
        expect(document.querySelector('#view-browse [data-chip="day"][data-value="2026-09-05"]').getAttribute("aria-pressed")).toBe("true");
      });
      it("listing that hotel's Saturday [1518]", () => {
        const results = app.browseResults();
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(e => e.hotel === "Westin" && e._cd === "2026-09-05")).toBe(true);
      });
    });

    it("blocks are buttons: Enter opens the sheet [1523]", () => {
      state.tab = "map"; handle.render();
      const block = map().querySelector('.map-hotel[data-hotel="Hilton"]');
      block.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      expect(el("sheetWrap").hidden).toBe(false);
      expect(el("sheetTitleHotel").textContent).toBe("Hilton");
      expect(block.getAttribute("role")).toBe("button");
    });
  });

  describe("step 4: now and next", () => {
    let on, next, label;
    beforeAll(() => {
      on = handle.events.find(e => e._s <= at && at < e._e && onMap(e));
      next = handle.events.find(e => e._s > at && app.conDayKey(e._s) === today && onMap(e) && e.hotel !== on.hotel);
      state.tab = "map"; setPicks([on.id, next.id]);
      const info = app.leaveInfo(app.currentLocation(at), next, at);
      label = info.late ? `leave ${app.hotelPhrase(on.hotel)} now` : `leave ${app.hotelPhrase(on.hotel)} by ${app.fmtShort(info.leaveBy)}`;
    });
    afterAll(() => setPicks([]));

    it("today: a ring on the on-now hotel and one on the next [1538]", () => {
      expect(rings()).toBe([`next:${next.hotel}`, `now:${on.hotel}`].sort().join(" "));
    });
    it("no dashed line and no route: the rings, the pills and the caption carry it [1541, the page half]", () => {
      expect(map().querySelector(".map-leave")).toBe(null);
      expect(map().querySelector(".map-route")).toBe(null);
    });
    it("rings over the blocks, pills over everything [1544]", () => {
      const order = svg().innerHTML;
      expect(order.indexOf("map-hotel")).toBeLessThan(order.indexOf("map-ring"));
      expect(order.indexOf("map-ring")).toBeLessThan(order.lastIndexOf("map-pill"));
    });
    it("the card under the map says when to leave the building you are in [1548]", () => {
      expect(cardWhen()).toBe(label);
      expect(map().querySelector(".nc-when.leave")).toBeTruthy();
    });
    it("directly under the SVG sits the card [1550]", () => {
      expect(svg().nextElementSibling).toBe(map().querySelector(".map-under"));
      expect(map().querySelector(".map-under .next-card")).toBeTruthy();
    });
    it("no rings on another day; the card stays, it is about now [1553]", () => {
      map().querySelector('[data-chip="map-day"][data-value="2026-09-06"]').click();
      expect(map().querySelector(".map-ring")).toBe(null);
      expect(map().querySelector(".next-card")).toBeTruthy();
      state.map.day = null; handle.render();
    });
    it("with nowhere to leave from, the next ring stays and the card counts down [1557]", () => {
      setPicks([next.id]);
      expect(rings()).toBe(`next:${next.hotel}`);
      expect(cardWhen()).toBe(`${app.fmtShort(next._s)} · in ${app.fmtMins(Math.round((next._s - at) / 60000))}`);
    });
    it("with no next pick, only the now ring; the On now line stays and the card says how to get a next pick [1561]", () => {
      setPicks([on.id]);
      expect(rings()).toBe(`now:${on.hotel}`);
      expect(map().querySelector(".next-on")).toBeTruthy();
      expect(map().querySelector(".next-card.empty")).toBeTruthy();
    });
  });

  describe("fixes", () => {
    afterAll(() => { handle.setTimeOverride("2026-09-05T13:05"); state.tab = "map"; setPicks([]); });

    describe("a late pair: stand five minutes before the next pick starts", () => {
      let late;
      beforeAll(() => {
        const pad = n => String(n).padStart(2, "0");
        const sat = handle.events.filter(e => e._cd === "2026-09-05" && onMap(e));
        for (const nx of sat) {
          if (nx._s < new Date("2026-09-05T14:00")) continue;
          const t = new Date(nx._s.getTime() - 5 * 60000), on = sat.find(e => e.hotel !== nx.hotel && e._s <= t && t < e._e);
          if (on) { late = { on, nx, at: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}` }; break; }
        }
        if (late) { handle.picks.set([late.on.id, late.nx.id]); handle.setTimeOverride(late.at); }
      });
      afterAll(() => handle.setTimeOverride("2026-09-05T13:05"));

      it("found a pair to be late for [1578]", () => {
        expect(late).toBeTruthy();
      });
      it("late: the card says leave now [1580]", () => {
        expect(state.tab).toBe("map");
        expect(cardWhen()).toBe(`leave ${app.hotelPhrase(late.on.hotel)} now`);
      });
      it("and is marked late [1581, the page half]", () => {
        expect(map().querySelector(".nc-when.late")).toBeTruthy();
      });
    });

    describe("a streaming next: a caption that says so, no next ring, and the off-map count", () => {
      let on, stream;
      beforeAll(() => {
        on = handle.events.find(e => e._s <= at && at < e._e && app.MAP_HOTELS[e.hotel] && !e.cancelled);
        stream = handle.events.find(e => e._s > at && app.conDayKey(e._s) === today && e.hotel === "Streaming");
        if (on && stream) setPicks([on.id, stream.id]);
      });

      it("found a stream to pick next [1591]", () => {
        expect(on && stream).toBeTruthy();
      });
      it("a streaming next shows Streaming as its room, counts down, and gets no next ring [1592]", () => {
        expect(map().querySelector(".nc-where").textContent.trim()).toBe("Streaming");
        expect(cardWhen().startsWith(`${app.fmtShort(stream._s)} · in `)).toBe(true);
        expect(rings()).toBe(`now:${on.hotel}`);
      });
      it("and the pick off the map is counted right under the card [1595]", () => {
        const line = map().querySelector(".map-offmap");
        expect(line.textContent.trim()).toBe("1 pick streaming or offsite");
        expect(map().querySelector(".next-card").nextElementSibling).toBe(line);
      });
    });

    it("an offsite next shows its venue as the room [1599]", () => {
      const holder = document.createElement("div");
      holder.innerHTML = app.mapCardHTML({ now: handle.now(), onNow: null, later: null, from: null, info: { leaveBy: null, late: false, estimate: null },
        next: { id: "x", title: "Arcade night", hotel: "Other", room: "Joystick Gamebar", _s: new Date(handle.now().getTime() + 30 * 60000) } });
      expect(holder.querySelector(".nc-where").textContent).toBe("Joystick Gamebar");
      expect(holder.querySelector(".nc-when").textContent).toMatch(/ · in 30 min$/);
    });

    describe("a two-digit pill on the Courtland stays inside the canvas", () => {
      let ten;
      beforeAll(() => { ten = handle.events.filter(e => e._cd === "2026-09-05" && e.hotel === "Courtland Grand").slice(0, 10).map(e => e.id); setPicks(ten); });

      it("ten picks at the Courtland make a two-digit pill [1606]", () => {
        expect(ten).toHaveLength(10);
        expect(map().querySelector('.map-pill[data-hotel="Courtland Grand"] text').textContent).toBe("10");
      });
      it("and it stays inside the canvas [1607]", () => {
        const pill = map().querySelector('.map-pill[data-hotel="Courtland Grand"]'), rect = pill.querySelector("rect");
        expect(num(rect, "x") + num(rect, "width")).toBeLessThanOrEqual(378);
        expect(num(pill.querySelector("text"), "x")).toBeLessThanOrEqual(378 - 8);
      });
      it("no off-map line when every pick is on the map [1608]", () => {
        expect(map().querySelector(".map-offmap")).toBe(null);
      });
    });

    /* The harness counted calls to a replaced renderMap. A redraw restarts the
       pulse on the next ring, so what matters is whether anything under the tab
       was touched: watch it. */
    describe("the minute tick leaves an unchanged map alone", () => {
      it("two ticks with nothing new draw nothing [1612]", () => {
        let results;
        const seen = mutationsDuring(map(), () => { results = [app.tickMap(), app.tickMap()]; });
        expect(results).toEqual([false, false]);
        expect(seen).toHaveLength(0);
      });
      it("a change in the counts draws once, and the next quiet tick draws nothing [1614]", () => {
        const before = svg();
        const extra = handle.events.find(e => e._cd === "2026-09-05" && e.hotel === "Hyatt" && !handle.picks.get().has(e.id));
        handle.picks.set([...handle.picks.get(), extra.id]);
        expect(app.tickMap()).toBe(true);
        expect(svg()).not.toBe(before);                             // redrawn
        const redrawn = svg();
        let quiet;
        expect(mutationsDuring(map(), () => { quiet = app.tickMap(); })).toHaveLength(0);
        expect(quiet).toBe(false);
        expect(svg()).toBe(redrawn);
      });
    });
  });

  describe("polish 2: sticky map chips, and a map that fits the screen", () => {
    it("the day chips sit in the same sticky strip Search uses [1638]", () => {
      state.tab = "map"; state.map.day = null; handle.render();
      const strip = map().querySelector(".controls-sticky");
      expect(strip).toBe(map().firstElementChild);
      expect(strip.querySelector('[data-chip="map-day"]')).toBeTruthy();
    });
    it("and the map itself scrolls under it [1639]", () => {
      const strip = map().querySelector(".controls-sticky");
      expect(strip.querySelector("svg")).toBe(null);
      expect(map().querySelector(".map-wrap")).toBe(strip.nextElementSibling);
    });
    it("the card band sits under the SVG [1645, the page half]", () => {
      expect(svg().nextElementSibling).toBe(map().querySelector(".map-under"));
    });
  });

  describe("map card: the next pick under the map", () => {
    let prev, next, on, sun, mon, plain, onNow, tomorrow, monday, empty;
    function read() {
      state.tab = "map"; state.map.day = null; handle.render();
      const card = map().querySelector(".next-card"), onLine = map().querySelector(".next-on");
      const g = sel => { const node = card && card.querySelector(sel); return node ? node.textContent.trim() : null; };
      const heroEv = card && card.dataset.hero ? handle.events.find(e => e.id === card.dataset.hero) : null;
      const block = heroEv ? map().querySelector(`.map-hotel[data-hotel="${heroEv.hotel}"]`) : null;
      return { empty: !!(card && card.classList.contains("empty")), tag: card && card.tagName, text: card ? card.textContent.trim() : null, hero: card ? card.dataset.hero || null : null,
        label: g(".nc-label"), title: g(".nc-title"), where: g(".nc-where"), when: g(".nc-when"), whenCls: card && card.querySelector(".nc-when") ? card.querySelector(".nc-when").className : "",
        walk: g(".nc-walk"), hue: card ? card.getAttribute("style") : null, blockHue: block ? block.getAttribute("style") : null, on: onLine ? onLine.textContent.trim() : null, onHero: onLine ? onLine.dataset.hero : null };
    }

    beforeAll(() => {
      on = handle.events.find(e => e._s <= at && at < e._e && onMap(e));
      next = handle.events.find(e => e._s > at && app.conDayKey(e._s) === today && onMap(e) && e.hotel !== on.hotel);
      prev = handle.events.find(e => e._e <= at && app.conDayKey(e._s) === today && onMap(e) && e.hotel !== next.hotel);
      sun = handle.events.find(e => app.conDayKey(e._s) === "2026-09-06" && onMap(e));
      mon = handle.events.find(e => app.conDayKey(e._s) === "2026-09-07" && onMap(e));
      handle.picks.set([prev.id, next.id]); plain = read();
      handle.picks.set([on.id, next.id]); onNow = read();
      handle.picks.set([sun.id]); tomorrow = read();
      handle.picks.set([mon.id]); monday = read();
      handle.picks.set([]); empty = read();
    });
    afterAll(() => setPicks([]));

    it("the card shows the next pick [1765]", () => {
      expect(plain).toMatchObject({ empty: false, tag: "BUTTON", title: next.title, hero: next.id });
    });
    it("room and hotel in the hotel's own hue, the same var as its block [1766]", () => {
      expect(plain.where).toBe(`${app.hotelShort(next.hotel)} · ${next.room || next.location}`);
      expect(plain.hue).toMatch(/var\(--h-/);
      expect(plain.hue).toBe(plain.blockHue);
    });
    it("the timing line is the start and how long until it [1767]", () => {
      expect(plain.when).toBe(`${app.fmtShort(next._s)} · in ${app.fmtMins(Math.round((next._s - at) / 60000))}`);
      expect(plain.whenCls).not.toMatch(/leave/);
    });
    it("the walk estimate is a muted line when leaveInfo has one [1768]", () => {
      expect(plain.walk).toBe(`~${app.walkMin(prev.hotel, next.hotel)} min from ${app.hotelPhrase(prev.hotel)}`);
    });
    it("nothing is on, so no On now line and no day label [1769]", () => {
      expect(plain.on).toBe(null);
      expect(plain.label).toBe(null);
    });
    it("with a pick on in another hotel, the timing line says when to leave it [1771]", () => {
      const leaveBy = new Date(next._s.getTime() - (app.walkMin(on.hotel, next.hotel) + 10) * 60000), late = at >= leaveBy;
      expect(onNow.when).toBe(late ? `leave ${app.hotelPhrase(on.hotel)} now` : `leave ${app.hotelPhrase(on.hotel)} by ${app.fmtShort(leaveBy)}`);
      expect(onNow.whenCls).toMatch(/leave/);
      expect(/late/.test(onNow.whenCls)).toBe(late);
    });
    it("and a slim line above names what is on now [1772]", () => {
      expect(onNow.on).toBe(`On now: ${on.title} · ends ${app.fmtShort(on._e)} · ${app.hotelShort(on.hotel)}`);
      expect(onNow.onHero).toBe(on.id);
    });
    it("nothing left today: the first pick of tomorrow, labelled, time only [1776]", () => {
      expect(tomorrow).toMatchObject({ label: "Tomorrow", title: sun.title, when: app.fmtShort(sun._s), hero: sun.id, walk: null, on: null });
    });
    it("a pick two days out is labelled with its day [1777]", () => {
      expect(mon).toBeTruthy();
      expect(monday.label).toBe("Monday");
    });
    it("no picks at all: how to get one, and nothing to tap [1778]", () => {
      expect(empty).toMatchObject({ empty: true, tag: "DIV", hero: null });
      expect(empty.text).toMatch(/Star things in Search and your next pick shows here\./);
    });
    it("tapping the card opens the event's detail sheet [1784]", () => {
      setPicks([handle.events.find(e => e._s > at && app.conDayKey(e._s) === today && app.MAP_HOTELS[e.hotel]).id]);
      const card = map().querySelector(".next-card");
      card.click();
      expect(el("sheetWrap").hidden).toBe(false);
      expect(el("panel-event").hidden).toBe(false);
      expect(el("sheetTitleEvent").textContent).toBe(card.querySelector(".nc-title").textContent);
      handle.closeSheet();
    });

    /* as 1612: the harness counted renderMap calls */
    it("two quiet ticks draw nothing, so the pulse is not restarted [1789]", () => {
      let results;
      expect(mutationsDuring(map(), () => { results = [app.tickMap(), app.tickMap()]; })).toHaveLength(0);
      expect(results).toEqual([false, false]);
    });
    it("a change that touches only the card refreshes the card and leaves the SVG untouched [1794]", () => {
      const upcoming = app.nowModel(at).upcoming[0];
      const stream = handle.events.find(e => e._s > upcoming._s && app.conDayKey(e._s) === today && e.hotel === "Streaming");
      expect(stream, "the fixture has a stream later today").toBeTruthy();
      const drawing = svg();
      handle.picks.set([...handle.picks.get(), stream.id]);
      let ticked;
      const seen = mutationsDuring(map(), () => { ticked = app.tickMap(); });
      expect(ticked).toBe(true);
      expect(svg()).toBe(drawing);
      expect(seen.length).toBeGreaterThan(0);
      seen.forEach(record => expect(el("mapUnder").contains(record.target)).toBe(true));
      expect(map().querySelector(".map-offmap").textContent).toMatch(/1 pick streaming or offsite/);
    });
  });

  /* The harness matched `state.tab === "map" && sheetWrap.hidden) { tickMap()`
     in the source. The tick is the app's own 60-second interval: let it run. */
  describe("the minute tick goes through tickMap [1562]", () => {
    let ticking;
    beforeAll(async () => {
      await page.cleanup();
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
      ticking = await bootPage();
      ticking.handle.state.tab = "map"; ticking.handle.render();
    }, 30000);
    afterAll(async () => { await ticking.cleanup(); vi.useRealTimers(); page = await bootPage(); });

    it("with a new pick a minute later the pills change; a quiet minute leaves the drawing alone", () => {
      const drawing = svg();
      vi.advanceTimersByTime(60000);
      expect(svg()).toBe(drawing);                                   // a quiet minute
      const hyatt = ticking.handle.events.find(e => e._cd === "2026-09-05" && e.hotel === "Hyatt");
      ticking.handle.picks.set([hyatt.id]);                          // no render: only the tick can draw it
      expect(pillsOf()).toEqual({});
      vi.advanceTimersByTime(60000);
      expect(pillsOf()).toEqual({ Hyatt: "1" });
    });
  });
});
