/* The state changes behind tools/review-people.html.
 *
 * The file under test is a classic script - no import, no export - because a browser refuses an
 * ES module over file://. Importing it for its side effect and reading the global is how both
 * worlds load the same file. */
import { describe, expect, it, beforeAll } from "vitest";
import "../../tools/review-people.js";

let R;
beforeAll(() => { R = globalThis.ReviewPeople; });

const person = (id, name, tier, credits = [], reviewed = false) =>
  ({ id, name, aliases: [], tier, credits: credits.map(w => ({ work: w, reviewed: false })), reviewed });
const work = (id, name, reviewed = false) => ({ id, name, aliases: [], type: "franchise", reviewed });

/** A drafter's output: two people, three works, two of them minted. */
function fixture() {
  return R.load(
    [person("ada-quill", "Ada Quill", "celebrity", ["firefly", "the-rookie"]),
     person("joe-crowe", "Joe Crowe", "creator", ["some-podcast"])],
    [work("firefly", "Firefly", true), work("the-rookie", "The Rookie"), work("some-podcast", "Some Podcast")],
    {
      people: {
        "ada-quill": { name: "Ada Quill", known_for: "an actor", confidence: "high", events: ["Castle Cast"] },
        "joe-crowe": { name: "Joe Crowe", known_for: "a podcaster", confidence: "low", events: ["A Panel"] },
      },
      rejected: [{ id: "pat-henry", by: "model", name: "Pat Henry", events: ["Opening Ceremonies"] }],
      minted: ["the-rookie", "some-podcast"],
    });
}

describe("load", () => {
  it("takes the three files and fills the sidecar's keys when they are missing", () => {
    const state = R.load([person("a", "A", "creator")], [work("w", "W")], null);
    expect(state.sidecar).toEqual({ people: {}, rejected: [], minted: [] });
    expect(state.people[0].id).toBe("a");
  });

  it("copies, so the caller's files are not the state", () => {
    const people = [person("a", "A", "creator")];
    const state = R.load(people, [], {});
    state.people[0].name = "changed";
    expect(people[0].name).toBe("A");
  });
});

describe("order", () => {
  it("puts low confidence first, then sorts by name", () => {
    const state = fixture();
    expect(R.order(state, {}).map(p => p.id)).toEqual(["joe-crowe", "ada-quill"]);
  });

  it("hides the reviewed when asked", () => {
    let state = fixture();
    state = R.approve(state, "joe-crowe", { tier: "creator" });
    expect(R.order(state, { unreviewedOnly: true }).map(p => p.id)).toEqual(["ada-quill"]);
    expect(R.order(state, { unreviewedOnly: false }).map(p => p.id)).toEqual(["joe-crowe", "ada-quill"]);
  });

  it("filters by tier, so the celebrities can be reviewed first", () => {
    const state = fixture();
    expect(R.order(state, { tier: "celebrity" }).map(p => p.id)).toEqual(["ada-quill"]);
    expect(R.order(state, { tier: "creator" }).map(p => p.id)).toEqual(["joe-crowe"]);
    expect(R.order(state, { tier: "all" }).map(p => p.id)).toEqual(["joe-crowe", "ada-quill"]);
  });
});

describe("approve", () => {
  it("reviews the person, the credits kept, and the works they point at", () => {
    const state = R.approve(fixture(), "ada-quill", { tier: "celebrity", drop: [], notes: "checked" });
    const ada = state.people.find(p => p.id === "ada-quill");
    expect(ada.reviewed).toBe(true);
    expect(ada.credits).toEqual([{ work: "firefly", reviewed: true }, { work: "the-rookie", reviewed: true }]);
    expect(state.works.find(w => w.id === "the-rookie").reviewed).toBe(true);
    expect(state.sidecar.people["ada-quill"].notes).toBe("checked");
    expect(state.sidecar.people["ada-quill"].known_for).toBe("an actor");   // the drafter's note stays
  });

  it("removes a dropped credit and leaves its work unreviewed", () => {
    const state = R.approve(fixture(), "ada-quill", { tier: "celebrity", drop: ["the-rookie"] });
    expect(state.people.find(p => p.id === "ada-quill").credits).toEqual([{ work: "firefly", reviewed: true }]);
    expect(state.works.find(w => w.id === "the-rookie").reviewed).toBe(false);
  });

  it("can change the tier, and leaves the other cards alone", () => {
    const state = R.approve(fixture(), "ada-quill", { tier: "creator" });
    expect(state.people.find(p => p.id === "ada-quill").tier).toBe("creator");
    expect(state.people.find(p => p.id === "joe-crowe").reviewed).toBe(false);
  });

  it("returns a new state and does not touch the old one", () => {
    const before = fixture();
    R.approve(before, "ada-quill", { tier: "celebrity" });
    expect(before.people.find(p => p.id === "ada-quill").reviewed).toBe(false);
  });
});

describe("reject", () => {
  it("takes the person out and records who said so", () => {
    const state = R.reject(fixture(), "joe-crowe", "track staff");
    expect(state.people.map(p => p.id)).toEqual(["ada-quill"]);
    expect(state.sidecar.rejected).toContainEqual(
      { id: "joe-crowe", by: "review", name: "Joe Crowe", events: ["A Panel"] });
    expect(state.sidecar.people["joe-crowe"].notes).toBe("track staff");
  });
});

describe("unreject", () => {
  it("a model rejection a person overrules becomes an entry, reviewed, with no credits", () => {
    const state = R.unreject(fixture(), "pat-henry", "creator", "wrote three novels");
    const pat = state.people.find(p => p.id === "pat-henry");
    expect(pat).toEqual({ id: "pat-henry", name: "Pat Henry", aliases: [], tier: "creator",
                          credits: [], reviewed: true });
    expect(state.sidecar.rejected.map(r => r.id)).not.toContain("pat-henry");
    expect(state.sidecar.people["pat-henry"].notes).toBe("wrote three novels");
  });

  it("does nothing for an id that is not rejected, or is already a person", () => {
    const state = fixture();
    expect(R.unreject(state, "nobody", "creator", "")).toEqual(state);
    expect(R.unreject(state, "ada-quill", "creator", "")).toEqual(state);
  });
});

describe("pruneWorks", () => {
  it("drops a minted work no credit points at any more", () => {
    // Ada's Rookie credit is dropped, so the work it was minted for has no reason to exist.
    const state = R.approve(fixture(), "ada-quill", { tier: "celebrity", drop: ["the-rookie"] });
    expect(R.pruneWorks(state).map(w => w.id)).toEqual(["firefly", "some-podcast"]);
  });

  it("keeps a minted work a credit still points at, and one a reviewer approved", () => {
    const state = fixture();
    expect(R.pruneWorks(state).map(w => w.id)).toEqual(["firefly", "the-rookie", "some-podcast"]);
    const approved = R.approve(state, "ada-quill", { tier: "celebrity", drop: ["the-rookie"] });
    approved.works.find(w => w.id === "the-rookie").reviewed = true;   // a reviewer kept it anyway
    expect(R.pruneWorks(approved).map(w => w.id)).toContain("the-rookie");
  });

  it("never drops a work the registry already held", () => {
    let state = fixture();
    state = R.reject(state, "ada-quill", "");        // firefly loses its only credit
    expect(R.pruneWorks(state).map(w => w.id)).toContain("firefly");   // but it is not minted
  });
});

describe("exported", () => {
  it("sorts by id and writes the registry's own keys", () => {
    const out = R.exported(R.approve(fixture(), "ada-quill", { tier: "celebrity" }));
    expect(out.people.map(p => p.id)).toEqual(["ada-quill", "joe-crowe"]);
    expect(Object.keys(out.people[0])).toEqual(["id", "name", "aliases", "tier", "credits", "reviewed"]);
    expect(Object.keys(out.works[0])).toEqual(["id", "name", "aliases", "type", "reviewed"]);
    expect(out.sidecar.rejected.map(r => r.id)).toEqual(["pat-henry"]);
  });

  it("prunes on the way out", () => {
    const out = R.exported(R.approve(fixture(), "ada-quill", { tier: "celebrity", drop: ["the-rookie"] }));
    expect(out.works.map(w => w.id)).toEqual(["firefly", "some-podcast"]);
  });
});

describe("toJson", () => {
  it("writes a registry one entry a line, spaced as Python writes it", () => {
    // The drafter writes these files with json.dumps, which puts a space after every comma and
    // colon. JSON.stringify packs them tight; exporting that way would rewrite all 145 lines of
    // people.json and bury the one row a reviewer actually changed.
    expect(R.toJson([{ id: "a" }, { id: "b" }])).toBe('[\n  {"id": "a"},\n  {"id": "b"}\n]\n');
    expect(R.toJson([{ id: "a", aliases: [], credits: [{ work: "w", reviewed: true }] }]))
      .toBe('[\n  {"id": "a", "aliases": [], "credits": [{"work": "w", "reviewed": true}]}\n]\n');
    expect(R.toJson([])).toBe("[]\n");
  });

  it("keeps the registry's own key order, so a late-set field does not move a line", () => {
    const state = R.load([], [{ id: "w", reviewed: false, name: "W", type: "franchise",
                                aliases: [], parent: "p" }], {});
    expect(R.toJson(R.exported(state).works)).toBe(
      '[\n  {"id": "w", "name": "W", "aliases": [], "type": "franchise", "parent": "p", "reviewed": false}\n]\n');
  });

  it("writes the sidecar with its keys sorted at every level, as the drafter does", () => {
    const text = R.toJson({ rejected: [], minted: ["b", "a"], people: { x: { name: "X", confidence: "low" } } });
    expect(text.indexOf('"minted"')).toBeLessThan(text.indexOf('"people"'));
    expect(text.indexOf('"people"')).toBeLessThan(text.indexOf('"rejected"'));
    expect(text.indexOf('"confidence"')).toBeLessThan(text.indexOf('"name"'));
    expect(text.endsWith("\n")).toBe(true);
  });
});
