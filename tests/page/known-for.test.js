/* A person's known-for line on their Explore page (W42; DECISIONS #61, #74):
   the file's people block's, under the name, the line the event's sheet
   says under the same name. The sample has no block, so this copy of it
   carries one, for two of its people. New tests, not rows of
   tests/PORT-LEDGER.md. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(fs.readFileSync(path.join(HERE, "..", "sample-events.json"), "utf8"));
const css = fs.readFileSync(path.join(HERE, "..", "..", "src", "styles.css"), "utf8").replace(/\r\n/g, "\n");
const LINE = "Host of the <Tuning Into SciFi TV> podcast";
const data = {...sample, people: [{id: "kevin-bachelder", name: "Kevin Bachelder", known_for: LINE}, {id: "beth-verant", name: "Beth Verant", known_for: "Wrote the book."}]};

describe("a person's Explore page", () => {
  let page, app, state;
  const head = () => document.querySelector("#view-explore .explore-head");
  const words = node => (node ? node.textContent.replace(/\s+/g, " ").trim() : "");
  const openPage = (kind, key) => { app.openExplorePage(kind, key); return head(); };

  beforeAll(async () => {
    page = await bootPage({data});
    ({app} = page);
    state = page.handle.state;
  }, 30000);
  afterAll(async () => { state.explore.page = null; app.setExploreHash(null); await page.cleanup(); });

  it("says the person's known-for line under the name, before the count and the line that holds Follow and Mute", () => {
    const h = openPage("person", "kevin-bachelder");
    expect([...h.children].map(c => c.className.split(" ")[0])).toEqual(["back", "eh-kind", "eh-name", "eh-known", "eh-count", "eh-acts"]);
    expect([...h.querySelector(".eh-acts").children].map(words)).toEqual(["Follow", "Mute"]);
    expect(words(h.querySelector(".eh-name"))).toBe("Kevin Bachelder");
    expect(words(h.querySelector(".eh-known"))).toBe(LINE);
  });
  it("as the person's own text: escaped", () => {
    expect(head().querySelector(".eh-known").children).toHaveLength(0);
  });
  it("the line the event's sheet says under the same name", () => {
    const ev = page.handle.events.find(e => (e.people || []).some(p => p.id === "kevin-bachelder"));
    page.handle.openSheet("event", ev.id);
    const lined = [...document.querySelectorAll("#panel-event .who.lined")].find(li => words(li.querySelector(".who-name")) === "Kevin Bachelder");
    expect(words(lined.querySelector(".who-line"))).toBe(LINE);
    page.handle.closeSheet();
  });
  it("has no line for a person the block does not hold, and the head is the rest: the count, then the line that holds Follow and Mute", () => {
    const h = openPage("person", "anthony-liggins");
    expect(h.querySelector(".eh-known")).toBe(null);
    expect([...h.children].map(c => c.className.split(" ")[0])).toEqual(["back", "eh-kind", "eh-name", "eh-count", "eh-acts"]);
  });
  it("and none on a page that is not a person's, whatever its key", () => {
    expect(openPage("work", "star-wars").querySelector(".eh-known")).toBe(null);
    expect(openPage("track", "Animation").querySelector(".eh-known")).toBe(null);
    expect(openPage("track", "kevin-bachelder").querySelector(".eh-known")).toBe(null);
  });
  it("a redraw keeps it", () => {
    openPage("person", "beth-verant");
    page.handle.render();
    expect(words(head().querySelector(".eh-known"))).toBe("Wrote the book.");
  });
  it("its rule: muted, in rem, and a long word wraps", () => {
    expect(css).toMatch(/\.explore-head \.eh-known \{ margin: 0; font-size: \.9375rem; line-height: 1\.4; color: var\(--muted\); overflow-wrap: anywhere; \}/);
  });
});

describe("with no people block in the file", () => {
  let page;
  beforeAll(async () => { page = await bootPage(); }, 30000);
  afterAll(async () => { page.handle.state.explore.page = null; page.app.setExploreHash(null); await page.cleanup(); });

  it("no one has a line: a person's page, and an event's people, are names alone", () => {
    page.app.openExplorePage("person", "kevin-bachelder");
    expect(document.querySelector("#view-explore .eh-name").textContent).toBe("Kevin Bachelder");
    expect(document.querySelector("#view-explore .eh-known")).toBe(null);
    const ev = page.handle.events.find(e => (e.people || []).some(p => p.id === "kevin-bachelder"));
    page.handle.openSheet("event", ev.id);
    expect(document.querySelector("#panel-event .who.lined")).toBe(null);
    expect(document.querySelector("#panel-event .who-line")).toBe(null);
    page.handle.closeSheet();
  });
});
