/* For you: what scores and what is chosen (DECISIONS #87), on schedules made
   here, each small enough to work out by hand. No page: the reader is set
   through the owners' functions - picks, follows, mutes - and the moment is
   handed in. An event with no start given takes the next free hour, so
   nothing overlaps unless a test says so. */
import { beforeEach, describe, expect, it } from "vitest";
import { replaceSchedule } from "../../src/data.js";
import { replacePicks } from "../../src/picks.js";
import { eventsFor, mutes, replaceFollows, toggleMute } from "../../src/follows.js";
import { FOR_YOU_MAX, forYou, profile, rarity, SIGNALS } from "../../src/foryou.js";

const WORKS = [
  { id: "star-wars", name: "Star Wars", aliases: [], terms: [], reviewed: true },
  { id: "andor", name: "Andor", aliases: [], terms: [], reviewed: true, parent: "star-wars" },
  { id: "firefly", name: "Firefly", aliases: [], terms: [], reviewed: true },
  { id: "loki", name: "Loki", aliases: [], terms: [], reviewed: false },
];
const pad = n => String(n).padStart(2, "0");
const BEFORE = new Date("2026-09-01T12:00");
const ev = (id, o = {}) => ({ id, title: o.title || id, start: o.start, end: o.end, tracks: o.tracks || [], speakers: [],
  people: (o.people || []).map(p => ({ id: p, name: p, role: "Speaker", src: "speakers" })),
  facets: o.repeat ? { repeat_key: o.repeat } : {}, ...(o.cancelled ? { cancelled: true } : {}),
  tags: { kind: o.kind || "panel", works: (o.works || []).map(w => ({ id: w, via: "about" })), medium: o.medium || [], genre: [], craft: [],
    subject: o.subject || [], audience: o.audience || "all" } });
/* Load a schedule: fifty minutes each, on the hour, one after another from
   Friday midnight, but where a start is given - and then an hour, but where
   an end is. */
function schedule(list) {
  const events = list.map((e, i) => {
    const start = e.start || `2026-09-0${4 + Math.floor(i / 24)}T${pad(i % 24)}:00`;
    return { ...e, start, end: e.end || (e.start ? `${start.slice(0, 11)}${pad(+start.slice(11, 13) + 1)}:00` : `${start.slice(0, 14)}50`) };
  });
  replaceSchedule({ generated_at: "x", works: WORKS, events });
}
function reader({ picks = [], follows = [], muted = [] } = {}) {
  mutes.slice().forEach(m => toggleMute(m.kind, m.key));
  replacePicks(picks);
  replaceFollows(follows);
  muted.forEach(([kind, key]) => expect(toggleMute(kind, key), `${kind}:${key} muted`).toBe(true));
}
const fill = (n, o = {}) => Array.from({ length: n }, (_, i) => ev(`fill-${i + 1}`, o));
const rows = (at = BEFORE) => forYou(at);
const ids = (at = BEFORE) => rows(at).map(r => r.id);
const said = (at = BEFORE) => rows(at).map(r => `${r.id}: ${r.reason.follow ? "You follow" : "Like your picks:"} ${r.reason.name}`);
const TRACK = key => ({ kind: "track", key }), WORK = key => ({ kind: "work", key }), PERSON = key => ({ kind: "person", key });
const LN = Math.log;

beforeEach(() => reader());

describe("rarity, and the index it is read from", () => {
  const twelve = () => schedule([ev("a1", { tracks: ["A"] }), ev("a2", { tracks: ["A"] }),
    ...["b1", "b2", "b3", "b4", "b5", "b6"].map(id => ev(id, { tracks: ["B"] })), ...["c1", "c2", "c3", "c4"].map(id => ev(id, { tracks: ["C"] }))]);

  it("is the log of the schedule over the events that carry the thing, so a big track counts for less than a small one", () => {
    twelve();
    expect([rarity("track:A"), rarity("track:B"), rarity("track:C")]).toEqual([LN(12 / 2), LN(12 / 6), LN(12 / 4)]);
    expect(rarity("track:A")).toBeGreaterThan(rarity("track:B"));
  });
  it("is 0 for a thing nothing carries, and for one everything carries", () => {
    twelve();
    expect(rarity("track:Nowhere")).toBe(0);
    schedule([ev("x", { tracks: ["All"] }), ev("y", { tracks: ["All"] })]);
    expect(rarity("track:All")).toBe(0);
  });
  it("is worked out again with a schedule, and only then", () => {
    twelve();
    expect(rarity("track:A")).toBe(LN(6));
    schedule([ev("a1", { tracks: ["A"] }), ...fill(3)]);
    expect([rarity("track:A"), rarity("track:B")]).toEqual([LN(4), 0]);
  });
});

describe("the signals, each alone", () => {
  const twelve = () => {
    const list = [ev("a1", { tracks: ["A"] }), ev("a2", { tracks: ["A"] }),
      ...["b1", "b2", "b3", "b4", "b5", "b6"].map(id => ev(id, { tracks: ["B"] })), ...["c1", "c2", "c3", "c4"].map(id => ev(id, { tracks: ["C"] }))];
    schedule(list);
    return Object.fromEntries(list.map(e => [e.id, e]));
  };

  it("follows: an event a follow brings scores for that follow, three times its rarity, and is marked a follow", () => {
    const e = twelve();
    reader({ follows: [TRACK("A")] });
    expect(SIGNALS.follows(e.a1, profile())).toEqual([{ thing: "track:A", weight: 3 * LN(6), follow: true }]);
    expect(SIGNALS.follows(e.b1, profile())).toEqual([]);
    expect(SIGNALS.stars(e.a1, profile())).toEqual([]);
  });
  it("stars: a thing the picks share scores as many times its rarity as picks carry it, three at most", () => {
    const e = twelve();
    reader({ picks: ["b1", "b2"] });
    expect(SIGNALS.stars(e.b3, profile())).toEqual([{ thing: "track:B", weight: 2 * LN(2), follow: false }]);
    expect(SIGNALS.follows(e.b3, profile())).toEqual([]);
    reader({ picks: ["b1", "b2", "b3"] });
    expect(SIGNALS.stars(e.b6, profile())[0].weight).toBe(3 * LN(2));
    reader({ picks: ["b1", "b2", "b3", "b4", "b5"] });
    expect(SIGNALS.stars(e.b6, profile())[0].weight).toBe(3 * LN(2));
  });
  it("a followed thing is the follow's alone: the picks that carry it add nothing by stars", () => {
    const e = twelve();
    reader({ picks: ["b1", "b2"], follows: [TRACK("B")] });
    expect(SIGNALS.stars(e.b3, profile())).toEqual([]);
    expect(SIGNALS.follows(e.b3, profile())).toEqual([{ thing: "track:B", weight: 3 * LN(2), follow: true }]);
  });
  it("what the follows signal finds for a follow is exactly what eventsFor() lists for it, each kind", () => {
    const list = [ev("t", { tracks: ["A"] }), ev("w", { works: ["star-wars"] }), ev("under", { works: ["andor"] }), ev("x", { subject: ["space"] }),
      ev("kids", { audience: "kids" }), ev("p", { people: ["kay"] }), ev("both", { tracks: ["A"], people: ["kay"], works: ["andor"] }), ...fill(3)];
    schedule(list);
    for (const follow of [TRACK("A"), WORK("star-wars"), WORK("andor"), { kind: "axis", key: "subject:space" }, { kind: "axis", key: "audience:kids" }, PERSON("kay")]) {
      reader({ follows: [follow] });
      const found = list.filter(e => SIGNALS.follows(e, profile()).length).map(e => e.id);
      expect(found, `${follow.kind}:${follow.key}`).toEqual(eventsFor(follow).map(e => e.id));
      expect(found.length).toBeGreaterThan(0);
    }
  });
});

describe("what counts by stars", () => {
  const taste = () => schedule([
    ev("pick-1", { tracks: ["T"], works: ["firefly"], medium: ["tv"], people: ["nathan"] }),
    ev("pick-2", { tracks: ["T"], medium: ["tv"], people: ["nathan"] }),
    ev("same-fandom", { tracks: ["U"], works: ["firefly"] }),
    ev("same-track", { tracks: ["T"] }),
    ev("same-topic", { tracks: ["V"], medium: ["tv"] }),
    ev("same-person", { tracks: ["W"], people: ["nathan"] }),
    ...fill(6)]);

  it("a fandom from one pick; a track and a topic not from one", () => {
    taste();
    reader({ picks: ["pick-1"] });
    expect(said()).toEqual(["same-fandom: Like your picks: Firefly"]);
  });
  it("a track and a topic from two", () => {
    taste();
    reader({ picks: ["pick-1", "pick-2"] });
    expect(said()).toEqual(["same-fandom: Like your picks: Firefly", "same-track: Like your picks: T", "same-topic: Like your picks: TV"]);
  });
  it("a person never, however many picks they are on - and by a follow, yes", () => {
    taste();
    reader({ picks: ["pick-1", "pick-2"] });
    expect(ids()).not.toContain("same-person");
    reader({ picks: ["pick-1", "pick-2"], follows: [PERSON("nathan")] });
    expect(said()).toContain("same-person: You follow nathan");
  });
  it("not a work nobody has reviewed, not a noise track, and of the audiences only Kids", () => {
    schedule([ev("p1", { tracks: ["Epic Photos"], works: ["loki"], audience: "mature" }), ev("p2", { tracks: ["Epic Photos"], audience: "mature" }),
      ev("loki-2", { tracks: ["X"], works: ["loki"] }), ev("photos", { tracks: ["Epic Photos", "X"] }), ev("mature", { tracks: ["X"], audience: "mature" }), ...fill(6)]);
    reader({ picks: ["p1", "p2"] });
    expect(ids()).toEqual([]);
    schedule([ev("k1", { audience: "kids" }), ev("k2", { audience: "kids" }), ev("k3", { tracks: ["X"], audience: "kids" }), ...fill(6)]);
    reader({ picks: ["k1", "k2"] });
    expect(said()).toEqual(["k3: Like your picks: Kids"]);
  });
});

describe("what is not a candidate", () => {
  /* The reader follows kay, who is on the event asked about; three more of
     the schedule make her rare enough to weigh. */
  const offered = (event, { others = [], picks = [], at = BEFORE } = {}) => {
    schedule([event, ...others, ...fill(3)]);
    reader({ picks, follows: [PERSON("kay")] });
    return ids(at).includes(event.id);
  };
  const kay = (id, o = {}) => ev(id, { people: ["kay"], tracks: ["Main"], ...o });

  it("an event she is on is offered, and that is the case every other one here is set against", () => {
    expect(offered(kay("ok"))).toBe(true);
  });
  it("a pick", () => {
    expect(offered(kay("mine"), { picks: ["mine"] })).toBe(false);
  });
  it("a cancelled event", () => {
    expect(offered(kay("off", { cancelled: true }))).toBe(false);
  });
  it("one that has started: at its start it has, a minute before it has not", () => {
    const e = () => kay("soon", { start: "2026-09-05T10:00", end: "2026-09-05T11:00" });
    expect(offered(e(), { at: new Date("2026-09-05T09:59") })).toBe(true);
    expect(offered(e(), { at: new Date("2026-09-05T10:00") })).toBe(false);
    expect(offered(e(), { at: new Date("2026-09-05T10:30") })).toBe(false);
  });
  it("a photo op, and a signing", () => {
    expect(offered(kay("photo", { kind: "photo" }))).toBe(false);
    expect(offered(kay("signing", { kind: "signing" }))).toBe(false);
  });
  it("one whose every track is a noise track - and not one with another track beside it, nor one with no track at all", () => {
    expect(offered(kay("noise", { tracks: ["Epic Photos"] }))).toBe(false);
    expect(offered(kay("noise-2", { tracks: ["Epic Photos", "Video Room"] }))).toBe(false);
    expect(offered(kay("mixed", { tracks: ["Epic Photos", "Main"] }))).toBe(true);
    expect(offered(kay("bare", { tracks: [] }))).toBe(true);
  });
  it("another session of a pick: by its repeat key, whatever the titles say", () => {
    expect(offered(kay("again", { repeat: "the show", title: "The Show!" }), { others: [ev("first", { repeat: "the show", title: "The Show" })], picks: ["first"] })).toBe(false);
    expect(offered(kay("other", { repeat: "another show" }), { others: [ev("first", { repeat: "the show" })], picks: ["first"] })).toBe(true);
  });
  it("or by its title, where it has no key", () => {
    expect(offered(kay("again", { title: "Open Gaming" }), { others: [ev("first", { title: "Open Gaming" })], picks: ["first"] })).toBe(false);
    expect(offered(kay("again", { title: "Open Gaming", repeat: "open gaming 2" }), { others: [ev("first", { title: "Open Gaming" })], picks: ["first"] })).toBe(true);
  });
  it("one that overlaps a pick, by a minute; one that starts as the pick ends does not", () => {
    const pick = ev("plan", { start: "2026-09-05T10:00", end: "2026-09-05T11:00" });
    expect(offered(kay("clash", { start: "2026-09-05T10:59", end: "2026-09-05T12:00" }), { others: [pick], picks: ["plan"] })).toBe(false);
    expect(offered(kay("inside", { start: "2026-09-05T10:15", end: "2026-09-05T10:45" }), { others: [pick], picks: ["plan"] })).toBe(false);
    expect(offered(kay("after", { start: "2026-09-05T11:00", end: "2026-09-05T12:00" }), { others: [pick], picks: ["plan"] })).toBe(true);
  });
  it("but a pick of more than four hours blocks nothing, and one of four hours does", () => {
    const during = () => kay("during", { start: "2026-09-05T12:00", end: "2026-09-05T13:00" });
    const long = ev("all-day", { start: "2026-09-05T10:00", end: "2026-09-05T14:01" }), four = ev("four", { start: "2026-09-05T10:00", end: "2026-09-05T14:00" });
    expect(offered(during(), { others: [long], picks: ["all-day"] })).toBe(true);
    expect(offered(during(), { others: [four], picks: ["four"] })).toBe(false);
  });
  it("a cancelled pick blocks nothing", () => {
    const gone = ev("gone", { start: "2026-09-05T10:00", end: "2026-09-05T11:00", cancelled: true });
    expect(offered(kay("free", { start: "2026-09-05T10:00", end: "2026-09-05T11:00" }), { others: [gone], picks: ["gone"] })).toBe(true);
  });
});

describe("what is chosen", () => {
  it("nothing for a reader with no pick and no follow, and nothing once nothing is left to start", () => {
    schedule([ev("a", { tracks: ["A"] }), ...fill(3)]);
    expect(rows()).toEqual([]);
    reader({ follows: [TRACK("A")] });
    expect(ids()).toEqual(["a"]);
    expect(ids(new Date("2026-09-08T12:00"))).toEqual([]);
  });
  it("two rows a reason at most: the best two, and with equal scores the earliest, then the lower id", () => {
    schedule([ev("a-late", { tracks: ["A"], start: "2026-09-05T15:00" }), ev("a-zed", { tracks: ["A"], start: "2026-09-05T09:00" }),
      ev("a-abe", { tracks: ["A"], start: "2026-09-05T09:00" }), ev("a-first", { tracks: ["A"], start: "2026-09-05T08:00" }), ...fill(4)]);
    reader({ follows: [TRACK("A")] });
    expect(ids()).toEqual(["a-first", "a-abe"]);
  });
  it("and the best is the higher score, whenever it starts", () => {
    schedule([ev("early", { tracks: ["A"], start: "2026-09-05T08:00" }), ev("mid", { tracks: ["A"], start: "2026-09-05T09:00" }),
      ev("late-and-kay", { tracks: ["A"], people: ["kay"], start: "2026-09-05T20:00" }), ev("k2", { people: ["kay"], start: "2026-09-06T08:00" }), ...fill(4)]);
    reader({ follows: [TRACK("A"), PERSON("kay")] });
    /* late-and-kay scores for both follows: its reason is kay, the rarer, so A keeps its two rows. */
    expect(said()).toEqual(["early: You follow A", "mid: You follow A", "late-and-kay: You follow kay", "k2: You follow kay"]);
  });
  it("the cap is by the words a row says: a track and a topic of one name are one reason", () => {
    schedule([ev("p1", { tracks: ["Space"] }), ev("p2", { tracks: ["Space"] }), ev("p3", { tracks: ["Other"], subject: ["space"] }), ev("p4", { tracks: ["Other 2"], subject: ["space"] }),
      ev("track-1", { tracks: ["Space"] }), ev("track-2", { tracks: ["Space"] }), ev("topic-1", { tracks: ["Q"], subject: ["space"] }), ev("topic-2", { tracks: ["R"], subject: ["space"] }),
      ...fill(8)]);
    reader({ picks: ["p1", "p2", "p3", "p4"] });
    expect(rows().map(r => [r.reason.kind, r.reason.name])).toEqual([["track", "Space"], ["track", "Space"]]);
    expect(rows().length).toBe(2);
  });
  it("and on one event they weigh once, the heavier: what reads as one reason scores as one", () => {
    schedule([ev("p1", { tracks: ["Space"], subject: ["space"] }), ev("p2", { tracks: ["Space"], subject: ["space"] }),
      ev("both", { tracks: ["Space"], subject: ["space"] }), ev("topic-only", { tracks: ["Q"], subject: ["space"] }), ev("topic-2", { tracks: ["R"], subject: ["space"] }),
      ...fill(11)]);
    reader({ picks: ["p1", "p2"] });
    /* 16 events: the track on 3, the topic on 5. The track is the rarer, so the heavier. */
    const both = rows().find(r => r.id === "both");
    expect(both.score).toBe(2 * LN(16 / 3));
    expect(both.reason).toEqual({ kind: "track", key: "Space", name: "Space", follow: false });
    expect(rows().find(r => r.id === "topic-only").score).toBe(2 * LN(16 / 5));
  });
  it("a follow and a pick's thing of one name are two reasons, and both weigh", () => {
    schedule([ev("p1", { tracks: ["X"], subject: ["space"] }), ev("p2", { tracks: ["Y"], subject: ["space"] }), ev("both", { tracks: ["Space"], subject: ["space"] }), ...fill(5)]);
    reader({ picks: ["p1", "p2"], follows: [TRACK("Space")] });
    expect(rows()[0].score).toBe(3 * LN(8 / 1) + 2 * LN(8 / 3));
    expect(said()).toEqual(["both: You follow Space"]);
  });
  it("one session of anything: of two with one repeat key the first is chosen and the other passed over", () => {
    schedule([ev("show-fri", { people: ["kay"], repeat: "the show", start: "2026-09-04T20:00" }), ev("show-sat", { people: ["kay"], repeat: "the show", start: "2026-09-05T20:00" }),
      ev("talk", { people: ["kay"], start: "2026-09-06T10:00" }), ...fill(5)]);
    reader({ follows: [PERSON("kay")] });
    expect(ids()).toEqual(["show-fri", "talk"]);
  });
  it("and of two with one title and no key", () => {
    schedule([ev("g1", { title: "Open Gaming", people: ["kay"], start: "2026-09-04T20:00" }), ev("g2", { title: "Open Gaming", people: ["kay"], start: "2026-09-05T20:00" }),
      ev("talk", { people: ["kay"], start: "2026-09-06T10:00" }), ...fill(5)]);
    reader({ follows: [PERSON("kay")] });
    expect(ids()).toEqual(["g1", "talk"]);
  });
  it(`${FOR_YOU_MAX} rows at most, the best of them, given back in time order`, () => {
    /* Five follows, three events each: two a reason is ten, and the rarest four reasons' eight are kept. E, on eight events, is the commonest. */
    const list = [];
    ["A", "B", "C", "D"].forEach((t, i) => [1, 2, 3].forEach(n => list.push(ev(`${t}${n}`, { tracks: [t], start: `2026-09-0${4 + (n % 3)}T${pad(10 + i)}:00` }))));
    for (let n = 1; n <= 8; n++) list.push(ev(`E${n}`, { tracks: ["E"], start: `2026-09-04T0${n}:00` }));
    schedule([...list, ...fill(10)]);
    reader({ follows: ["A", "B", "C", "D", "E"].map(TRACK) });
    const got = rows();
    expect(got.length).toBe(8);
    expect(got.map(r => r.reason.key).sort()).toEqual(["A", "A", "B", "B", "C", "C", "D", "D"]);
    expect(got.map(r => r.id)).toEqual(["A3", "B3", "C3", "D3", "A1", "B1", "C1", "D1"]);
  });
  it("the reason is the one thing that weighed most, a follow or not, and the score the sum of all", () => {
    /* 20 events: kay on 2, the track Big on 10, Firefly on 2. */
    schedule([ev("pick", { works: ["firefly"] }), ev("mix", { tracks: ["Big"], works: ["firefly"] }), ev("mix-kay", { tracks: ["Big"], people: ["kay"] }), ev("kay-2", { people: ["kay"] }),
      ...fill(8, { tracks: ["Big"] }).map((e, i) => ({ ...e, id: `big-${i}` })), ...fill(8)]);
    reader({ picks: ["pick"], follows: [TRACK("Big")] });
    const mix = rows().find(r => r.id === "mix");
    expect(mix.score).toBeCloseTo(3 * LN(20 / 10) + 1 * LN(20 / 2), 10);
    expect(mix.reason).toEqual({ kind: "work", key: "firefly", name: "Firefly", follow: false });       // 2.30 by the pick, 2.08 by the follow
    reader({ picks: ["pick"], follows: [TRACK("Big"), PERSON("kay")] });
    expect(rows().find(r => r.id === "mix-kay").reason).toEqual({ kind: "person", key: "kay", name: "kay", follow: true });
  });
  it("where two things weigh the same the follow is the reason, and of two follows the one whose id sorts first", () => {
    /* 10 events, the tracks A and P on five each: A's follow weighs 3 x ln 2, and P, on three picks, 3 x ln 2 by stars. */
    schedule([ev("p1", { tracks: ["P"] }), ev("p2", { tracks: ["P"] }), ev("p3", { tracks: ["P"] }), ev("tie", { tracks: ["P", "A"] }), ev("a2", { tracks: ["A", "P"], cancelled: true }),
      ev("a3", { tracks: ["A"] }), ev("a4", { tracks: ["A"] }), ev("a5", { tracks: ["A"] }), ...fill(2)]);
    reader({ picks: ["p1", "p2", "p3"], follows: [TRACK("A")] });
    expect([rarity("track:P"), rarity("track:A")]).toEqual([LN(2), LN(2)]);                           // 5 of 10 each
    const tie = rows().find(r => r.id === "tie");
    expect([tie.score, tie.reason.key, tie.reason.follow]).toEqual([6 * LN(2), "A", true]);
    /* Two follows of one rarity on one event: */
    schedule([ev("both", { tracks: ["B", "A"] }), ev("a2", { tracks: ["A"] }), ev("b2", { tracks: ["B"] }), ...fill(5)]);
    reader({ follows: [TRACK("B"), TRACK("A")] });
    expect(rows().find(r => r.id === "both").reason.key).toBe("A");
  });
});

describe("mutes", () => {
  /* Two picks on the track T, so its events score whatever else they carry,
     and T, twice picked, outweighs Star Wars, which one of the picks is
     about. 17 events: T on five and Star Wars on five. */
  const galaxy = () => schedule([ev("pick-sw", { tracks: ["T"], works: ["star-wars"] }), ev("pick-t", { tracks: ["T"] }),
    ev("star-wars-talk", { tracks: ["T"], works: ["star-wars"] }), ev("andor-talk", { tracks: ["T"], works: ["andor"] }), ev("plain", { tracks: ["T"] }),
    ev("kay-on-andor", { tracks: ["V"], works: ["andor"], people: ["kay"] }), ev("star-wars-elsewhere", { tracks: ["W"], works: ["star-wars"] }), ...fill(10)]);

  it("nothing muted: the Star Wars events are offered, Andor's among them, since an Andor event carries Star Wars", () => {
    galaxy();
    reader({ picks: ["pick-sw", "pick-t"] });
    /* Two rows a reason: plain, the third for T, is passed over. */
    expect(said()).toEqual(["star-wars-talk: Like your picks: T", "andor-talk: Like your picks: T",
      "kay-on-andor: Like your picks: Star Wars", "star-wars-elsewhere: Like your picks: Star Wars"]);
  });
  it("a muted fandom takes its events out, and the events of the works under it: Star Wars muted, Andor is not offered either", () => {
    galaxy();
    reader({ picks: ["pick-sw", "pick-t"], muted: [["work", "star-wars"]] });
    expect(said()).toEqual(["plain: Like your picks: T"]);
  });
  it("the work under it muted, the fandom above is still offered", () => {
    galaxy();
    reader({ picks: ["pick-sw", "pick-t"], muted: [["work", "andor"]] });
    expect(said()).toEqual(["star-wars-talk: Like your picks: T", "plain: Like your picks: T", "star-wars-elsewhere: Like your picks: Star Wars"]);
  });
  it("a muted thing is never a reason, and adds nothing to a score", () => {
    galaxy();
    reader({ picks: ["pick-sw", "pick-t"], muted: [["track", "T"]] });
    expect(profile().starred.has("track:T")).toBe(false);
    /* The three on T are barred, though Star Wars would have brought two of them; the two off it are left. */
    expect(said()).toEqual(["kay-on-andor: Like your picks: Star Wars", "star-wars-elsewhere: Like your picks: Star Wars"]);
  });
  it("a muted track, a muted topic and a muted person each take their events out", () => {
    const list = () => schedule([ev("p1", { works: ["firefly"] }), ev("on-track", { tracks: ["M"], works: ["firefly"] }), ev("on-topic", { subject: ["space"], works: ["firefly"] }),
      ev("with-person", { people: ["kay"], works: ["firefly"] }), ev("free", { tracks: ["N"], works: ["firefly"] }), ...fill(10)]);
    list(); reader({ picks: ["p1"] });
    expect(ids().length).toBe(2);                             // one reason, two rows
    for (const [mute, gone] of [[["track", "M"], "on-track"], [["axis", "subject:space"], "on-topic"], [["person", "kay"], "with-person"]]) {
      list(); reader({ picks: ["p1"], muted: [mute, ["track", "N"]] });
      const left = ["on-track", "on-topic", "with-person"].filter(id => id !== gone);
      expect(ids(), mute.join(":")).toEqual(left);
    }
  });
  it("a follow wins over a mute: an event a follow brings is offered though it carries a muted thing, and the follow is its reason", () => {
    galaxy();
    reader({ picks: ["pick-sw", "pick-t"], follows: [PERSON("kay")], muted: [["work", "star-wars"]] });
    expect(said()).toEqual(["plain: Like your picks: T", "kay-on-andor: You follow kay"]);
  });
});
