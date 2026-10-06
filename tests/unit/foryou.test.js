/* For you: what scores and what is chosen (DECISIONS #87), the big ones
   that stand where it has no row (#88), and what is offered in place of a
   pick that changed (#90), on schedules made
   here, each small enough to work out by hand. No page: the reader is set
   through the owners' functions - picks, follows, mutes - and the moment is
   handed in. An event with no start given takes the next free hour, so
   nothing overlaps unless a test says so. */
import { beforeEach, describe, expect, it } from "vitest";
import { byId, replaceSchedule } from "../../src/data.js";
import { replacePicks } from "../../src/picks.js";
import { eventsFor, mutes, replaceFollows, toggleMute } from "../../src/follows.js";
import { clashesOf } from "../../src/walk.js";
import { BIG_TRACK, bigOnes, FOR_YOU_MAX, forYou, IN_PLACE_GRACE_MIN, IN_PLACE_MAX, inPlace, profile, rarity, SIGNALS } from "../../src/foryou.js";

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
  facets: o.repeat ? { repeat_key: o.repeat } : {}, ...(o.cancelled ? { cancelled: true } : {}), ...(o.hotel ? { hotel: o.hotel } : {}),
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
/* What one signal finds on an event: the thing, its weight and whether it is a follow. */
const finds = (signal, event) => { const found = []; SIGNALS[signal](event, profile(), found); return found.map(({ thing, weight, follow }) => ({ thing, weight, follow })); };

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
    expect(finds("follows", e.a1)).toEqual([{ thing: "track:A", weight: 3 * LN(6), follow: true }]);
    expect(finds("follows", e.b1)).toEqual([]);
    expect(finds("stars", e.a1)).toEqual([]);
  });
  it("stars: a thing the picks share scores as many times its rarity as picks carry it, three at most", () => {
    const e = twelve();
    reader({ picks: ["b1", "b2"] });
    expect(finds("stars", e.b3)).toEqual([{ thing: "track:B", weight: 2 * LN(2), follow: false }]);
    expect(finds("follows", e.b3)).toEqual([]);
    reader({ picks: ["b1", "b2", "b3"] });
    expect(finds("stars", e.b6)[0].weight).toBe(3 * LN(2));
    reader({ picks: ["b1", "b2", "b3", "b4", "b5"] });
    expect(finds("stars", e.b6)[0].weight).toBe(3 * LN(2));
  });
  it("a followed thing is the follow's alone: the picks that carry it add nothing by stars", () => {
    const e = twelve();
    reader({ picks: ["b1", "b2"], follows: [TRACK("B")] });
    expect(finds("stars", e.b3)).toEqual([]);
    expect(finds("follows", e.b3)).toEqual([{ thing: "track:B", weight: 3 * LN(2), follow: true }]);
  });
  it("what the follows signal finds for a follow is exactly what eventsFor() lists for it, each kind", () => {
    const list = [ev("t", { tracks: ["A"] }), ev("w", { works: ["star-wars"] }), ev("under", { works: ["andor"] }), ev("x", { subject: ["space"] }),
      ev("kids", { audience: "kids" }), ev("p", { people: ["kay"] }), ev("both", { tracks: ["A"], people: ["kay"], works: ["andor"] }), ...fill(3)];
    schedule(list);
    for (const follow of [TRACK("A"), WORK("star-wars"), WORK("andor"), { kind: "axis", key: "subject:space" }, { kind: "axis", key: "audience:kids" }, PERSON("kay")]) {
      reader({ follows: [follow] });
      const found = list.filter(e => finds("follows", e).length).map(e => e.id);
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
    expect(offered(kay("before", { start: "2026-09-05T09:00", end: "2026-09-05T10:00" }), { others: [pick], picks: ["plan"] })).toBe(true);
    expect(offered(kay("into", { start: "2026-09-05T09:30", end: "2026-09-05T10:01" }), { others: [pick], picks: ["plan"] })).toBe(false);
  });
  it("one that starts with a pick, the shorter or the longer of the two, or the same hour", () => {
    const pick = ev("plan", { start: "2026-09-05T10:00", end: "2026-09-05T11:00" });
    for (const end of ["2026-09-05T10:30", "2026-09-05T11:00", "2026-09-05T12:30"]) {
      expect(offered(kay("with", { start: "2026-09-05T10:00", end }), { others: [pick], picks: ["plan"] }), end).toBe(false);
    }
  });
  it("and what bars it is what clashesOf() says of the plan, for every event of a busy day", () => {
    const day = [];
    for (let h = 8; h < 20; h++) for (const [m, len] of [[0, 60], [30, 90], [15, 20]]) {
      const start = new Date(`2026-09-05T${pad(h)}:${pad(m)}`), end = new Date(start.getTime() + len * 60000), hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      day.push(ev(`e-${h}-${m}`, { people: ["kay"], repeat: `r-${h}-${m}`, start: `2026-09-05T${hm(start)}`, end: `2026-09-05T${hm(end)}` }));
    }
    const plan = [ev("p-a", { start: "2026-09-05T09:00", end: "2026-09-05T10:00" }), ev("p-b", { start: "2026-09-05T12:15", end: "2026-09-05T12:35" }),
      ev("p-c", { start: "2026-09-05T15:30", end: "2026-09-05T17:00" }), ev("p-long", { start: "2026-09-05T08:00", end: "2026-09-05T19:00" })];
    const short = new Set(["p-a", "p-b", "p-c"]), seen = { barred: 0, offered: 0 };
    for (const e of day) {
      /* one event a schedule, so the cap of two rows a reason bars nothing */
      schedule([e, ...plan, ...fill(3)]);
      reader({ picks: plan.map(p => p.id), follows: [PERSON("kay")] });
      const clash = clashesOf(byId.get(e.id)).some(p => short.has(p.id));
      expect(ids().includes(e.id), e.id).toBe(!clash);
      seen[clash ? "barred" : "offered"]++;
    }
    expect(seen.barred).toBeGreaterThan(5);
    expect(seen.offered).toBeGreaterThan(5);
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

/* The big ones (W16; DECISIONS #88): what stands where For you has no row.
   One function of the moment, on schedules made here. */
describe("the big ones", () => {
  /* A celebrity event on Main Programming, but where o says otherwise. */
  const big = (id, o = {}) => {
    const e = ev(id, { tracks: [BIG_TRACK], ...o });
    if (o.guests !== false) e.tags.guests = o.guests || "celebrity";
    return e;
  };
  const got = (at = BEFORE) => bigOnes(at);

  it("the track has one name, Main Programming", () => {
    expect(BIG_TRACK).toBe("Main Programming");
  });
  it("the celebrity events on Main Programming: not the track's other events, nor another track's celebrities; a second track beside it changes nothing", () => {
    schedule([big("a"), big("untold", { guests: false }), big("creator", { guests: "creator" }), big("elsewhere", { tracks: ["Other"] }),
      big("two-tracks", { tracks: ["Other", BIG_TRACK] }), ...fill(3)]);
    expect(got()).toEqual(["a", "two-tracks"]);
  });
  it("soonest first, and two that start together by id, whatever order the schedule lists them in", () => {
    schedule([big("late", { start: "2026-09-05T10:00" }), big("b", { start: "2026-09-04T13:00" }), big("a", { start: "2026-09-04T13:00" }),
      big("first", { start: "2026-09-04T09:00" })]);
    expect(got()).toEqual(["first", "a", "b", "late"]);
    schedule([big("a", { start: "2026-09-04T13:00" }), big("b", { start: "2026-09-04T13:00" })]);
    expect(got()).toEqual(["a", "b"]);
  });
  it("as ids, for anyone: what is followed changes nothing", () => {
    schedule([big("a", { people: ["kay"] }), big("b"), ...fill(3)]);
    reader({ follows: [PERSON("kay"), TRACK(BIG_TRACK)] });
    expect(got()).toEqual(["a", "b"]);
  });
  it("not a cancelled one", () => {
    schedule([big("off", { cancelled: true }), big("on")]);
    expect(got()).toEqual(["on"]);
  });
  it("not one that has started: at its start it has, a minute before it has not", () => {
    schedule([big("gone", { start: "2026-09-04T09:00" }), big("ten", { start: "2026-09-04T10:00" }), big("later", { start: "2026-09-04T12:00" })]);
    expect(got(new Date("2026-09-04T09:59"))).toEqual(["ten", "later"]);
    expect(got(new Date("2026-09-04T10:00"))).toEqual(["later"]);
    expect(got(new Date("2026-09-04T10:30"))).toEqual(["later"]);
  });
  it("not a pick", () => {
    schedule([big("mine"), big("free")]);
    reader({ picks: ["mine"] });
    expect(got()).toEqual(["free"]);
  });
  it("not a photo op, nor a signing", () => {
    schedule([big("photo", { kind: "photo" }), big("signing", { kind: "signing" }), big("panel"), big("qa", { kind: "qa" })]);
    expect(got()).toEqual(["panel", "qa"]);
  });
  it("not one that carries a muted thing: a track beside its own, a topic, a person, a fandom, and the fandom above its own", () => {
    const list = () => schedule([big("free"), big("on-track", { tracks: [BIG_TRACK, "M"] }), big("on-topic", { subject: ["space"] }), big("with-person", { people: ["kay"] }),
      big("on-firefly", { works: ["firefly"] }), big("on-andor", { works: ["andor"] })]);
    const all = ["free", "on-track", "on-topic", "with-person", "on-firefly", "on-andor"];
    list(); reader();
    expect(got()).toEqual(all);
    for (const [mute, gone] of [[["track", "M"], "on-track"], [["axis", "subject:space"], "on-topic"], [["person", "kay"], "with-person"],
      [["work", "firefly"], "on-firefly"], [["work", "star-wars"], "on-andor"]]) {
      list(); reader({ muted: [mute] });
      expect(got(), mute.join(":")).toEqual(all.filter(id => id !== gone));
    }
  });
  it("and none at all with Main Programming itself muted", () => {
    schedule([big("a"), big("b")]);
    reader({ muted: [["track", BIG_TRACK]] });
    expect(got()).toEqual([]);
  });
  it("one session of anything, the soonest: by its repeat key, or by its title where it has none", () => {
    schedule([big("keyed-2", { repeat: "show", start: "2026-09-05T10:00" }), big("keyed-1", { repeat: "show", start: "2026-09-04T10:00" }),
      big("titled-1", { title: "Twice", start: "2026-09-04T11:00" }), big("titled-2", { title: "Twice", start: "2026-09-05T11:00" }),
      big("other-key", { title: "Twice", repeat: "apart", start: "2026-09-05T12:00" })]);
    expect(got()).toEqual(["keyed-1", "titled-1", "other-key"]);
  });
  it("a session that has started, or is cancelled, does not stand for the one still to come", () => {
    schedule([big("first", { repeat: "show", start: "2026-09-04T10:00" }), big("second", { repeat: "show", start: "2026-09-05T10:00" }),
      big("off", { repeat: "talk", start: "2026-09-04T11:00", cancelled: true }), big("on", { repeat: "talk", start: "2026-09-05T11:00" })]);
    expect(got()).toEqual(["first", "on"]);
    expect(got(new Date("2026-09-04T10:00"))).toEqual(["second", "on"]);
  });
  it("a pick is a session already had: its other session is out with it", () => {
    schedule([big("first", { repeat: "show", start: "2026-09-04T10:00" }), big("second", { repeat: "show", start: "2026-09-05T10:00" }), big("free")]);
    reader({ picks: ["first"] });
    expect(got()).toEqual(["free"]);
    reader({ picks: ["second"] });
    expect(got()).toEqual(["free"]);
  });
  it("none on a schedule with no Main Programming track, and none once everything has started", () => {
    schedule([big("elsewhere", { tracks: ["Other"] }), ...fill(3)]);
    expect(got()).toEqual([]);
    schedule([big("a"), big("b")]);
    expect(got()).toEqual(["a", "b"]);
    expect(got(new Date("2026-09-08T12:00"))).toEqual([]);
  });
});

describe("in place of a pick: what is on in the time it vacated", () => {
  /* The pick was Saturday's 10:00 to 11:00 at the Hilton, and it is 9:00. */
  const HOUR = { start: "2026-09-05T10:00", end: "2026-09-05T11:00", hotel: "Hilton" };
  const AT = new Date("2026-09-05T09:00");
  const sat = (id, hm, o = {}) => ev(id, { start: `2026-09-05T${hm}`, ...o, ...(o.end ? { end: `2026-09-05T${o.end}` } : {}) });
  const offered = (at = AT, vacated = HOUR) => inPlace(vacated, at);
  const got = (at, vacated) => offered(at, vacated).map(r => r.id);

  it("an event that starts at the vacated start is in, and one inside it; one that starts at its end is out, and one that starts before it and runs into it", () => {
    schedule([sat("at-start", "10:00"), sat("inside", "10:30"), sat("at-end", "11:00"), sat("into", "09:30", { end: "10:30" }), ...fill(3)]);
    expect(got()).toEqual(["at-start", "inside"]);
  });
  it("for anyone: a reader with no pick and no follow is offered what is on, each row with no reason and a score of 0", () => {
    schedule([sat("a", "10:00"), ...fill(3)]);
    expect(offered()).toEqual([{ id: "a", score: 0, reason: null }]);
  });
  it("still offered 14 minutes after it starts, and not at 15 - where For you passes over whatever has started", () => {
    schedule([sat("a", "10:00"), ...fill(3)]);
    expect(IN_PLACE_GRACE_MIN).toBe(15);
    expect(got(new Date("2026-09-05T10:00"))).toEqual(["a"]);
    expect(got(new Date("2026-09-05T10:14"))).toEqual(["a"]);
    expect(got(new Date("2026-09-05T10:15"))).toEqual([]);
    expect(got(new Date("2026-09-05T12:00"))).toEqual([]);
  });
  it("what For you bars is barred: a cancelled event, a photo op and a signing, a noise track's, another session of a pick, and so a pick", () => {
    schedule([sat("ok", "10:00"), sat("off", "10:00", { cancelled: true }), sat("photo", "10:00", { kind: "photo" }), sat("signing", "10:00", { kind: "signing" }),
      sat("noise", "10:00", { tracks: ["Epic Photos"] }), sat("again", "10:00", { repeat: "the show" }), ev("first", { repeat: "the show" }),
      sat("mine", "10:00", { end: "15:00" }), ...fill(3)]);
    reader({ picks: ["first", "mine"] });                       // mine, five hours, blocks nothing
    expect(got()).toEqual(["ok"]);
  });
  it("one that carries a muted thing is out, unless a follow brings it", () => {
    schedule([sat("muted", "10:00", { tracks: ["M"] }), sat("both", "10:00", { tracks: ["M"], people: ["kay"] }), sat("plain", "10:00"), ...fill(3)]);
    reader({ follows: [PERSON("kay")], muted: [["track", "M"]] });
    expect(got()).toEqual(["both", "plain"]);
  });
  it("one that overlaps a pick is out: a moved pick blocks at its new time, as any pick does", () => {
    schedule([sat("moved", "10:30", { end: "11:30" }), sat("clash", "10:00"), sat("clear", "10:00", { end: "10:30" }), ...fill(3)]);
    reader({ picks: ["moved"] });
    expect(got()).toEqual(["clear"]);
  });
  it("a cancelled pick blocks nothing, nor one of more than four hours; one of four hours does", () => {
    schedule([sat("gone", "10:00", { cancelled: true }), sat("free", "10:00"), ...fill(3)]);
    reader({ picks: ["gone"] });
    expect(got()).toEqual(["free"]);
    schedule([sat("all-day", "08:00", { end: "12:01" }), sat("free", "10:00"), ...fill(3)]);
    reader({ picks: ["all-day"] });
    expect(got()).toEqual(["free"]);
    schedule([sat("four", "08:00", { end: "12:00" }), sat("free", "10:00"), ...fill(3)]);
    reader({ picks: ["four"] });
    expect(got()).toEqual([]);
  });
  it("the order: the score, highest first, whenever it starts; then those in the vacated building; then the start; then the id", () => {
    schedule([sat("away-early", "10:00", { hotel: "Westin" }), sat("here-late", "10:30", { hotel: "Hilton" }), sat("scored-late", "10:45", { tracks: ["A"], hotel: "Westin", end: "11:30" }), ...fill(4)]);
    reader({ follows: [TRACK("A")] });
    expect(got()).toEqual(["scored-late", "here-late", "away-early"]);
    /* Of two that score, the heavier: kay, on one event, over A, on two. */
    schedule([sat("a", "10:00", { tracks: ["A"] }), sat("k", "10:30", { people: ["kay"] }), ev("a-other", { tracks: ["A"] }), ...fill(4)]);
    reader({ follows: [TRACK("A"), PERSON("kay")] });
    expect(got()).toEqual(["k", "a"]);
    schedule([sat("late", "10:30", { hotel: "Hilton" }), sat("early", "10:00", { hotel: "Hilton" }), ...fill(3)]);
    reader();
    expect(got()).toEqual(["early", "late"]);
    schedule([sat("zed", "10:00"), sat("abe", "10:00"), ...fill(3)]);
    expect(got()).toEqual(["abe", "zed"]);
  });
  it("two rows at most that say one reason, as For you; a row that scores nothing comes after those that score", () => {
    schedule([sat("plain", "10:00"), sat("a1", "10:05", { tracks: ["A"] }), sat("a2", "10:10", { tracks: ["A"] }), sat("a3", "10:20", { tracks: ["A"] }), ...fill(4)]);
    reader({ follows: [TRACK("A")] });
    expect(offered().map(r => [r.id, r.reason && r.reason.name])).toEqual([["a1", "A"], ["a2", "A"], ["plain", null]]);
  });
  it(`${IN_PLACE_MAX} rows at most, and rows with no reason are not capped at two`, () => {
    schedule([sat("u1", "10:00"), sat("u2", "10:10"), sat("u3", "10:20"), sat("u4", "10:30"), ...fill(3)]);
    expect(IN_PLACE_MAX).toBe(3);
    expect(offered()).toEqual([{ id: "u1", score: 0, reason: null }, { id: "u2", score: 0, reason: null }, { id: "u3", score: 0, reason: null }]);
    schedule([sat("a", "10:00", { tracks: ["A"] }), sat("b", "10:10", { tracks: ["B"] }), sat("c", "10:20", { tracks: ["C"] }), sat("d", "10:30", { tracks: ["D"] }), ...fill(4)]);
    reader({ follows: ["A", "B", "C", "D"].map(TRACK) });
    expect(got()).toEqual(["a", "b", "c"]);
  });
  it("one session of anything: of two with one repeat key the first is offered", () => {
    schedule([sat("s1", "10:00", { repeat: "the show" }), sat("s2", "10:30", { repeat: "the show" }), sat("other", "10:40"), ...fill(3)]);
    expect(got()).toEqual(["s1", "other"]);
  });
  it("a row is its id, weigh()'s score and For you's reason, the one thing that weighed most", () => {
    schedule([sat("k", "10:00", { people: ["kay"], tracks: ["A"] }), ev("a-other", { tracks: ["A"] }), ...fill(3)]);
    reader({ follows: [TRACK("A"), PERSON("kay")] });
    expect(offered()).toEqual([{ id: "k", score: 3 * LN(5 / 1) + 3 * LN(5 / 2), reason: { kind: "person", key: "kay", name: "kay", follow: true } }]);
    expect(offered()[0].score).toBe(forYou(AT).find(r => r.id === "k").score);
  });
  it("a row that scores nothing has no reason, though a follow finds it: a track every event is on weighs nothing", () => {
    schedule([sat("a", "10:00", { tracks: ["All"] }), ...fill(3, { tracks: ["All"] })]);
    reader({ follows: [TRACK("All")] });
    expect(rarity("track:All")).toBe(0);
    expect(offered()).toEqual([{ id: "a", score: 0, reason: null }]);
  });
  it("a time of one minute - a pick that is gone, its snapshot with no end - holds what starts in that minute", () => {
    schedule([sat("then", "10:00"), sat("after", "10:01"), ...fill(3)]);
    expect(got(AT, { start: "2026-09-05T10:00", end: "2026-09-05T10:01", hotel: "" })).toEqual(["then"]);
  });
});
