/* Sync: the pull (DECISIONS #53; docs/sync/contract.md, section 5). A run
   reads the crews, then the picks and follows newer than the watermark - a
   minute's overlap, a page at a time, the picks whole when a crew gains
   anyone - and applies the reader's own rows unless a pending op holds the
   key, the crewmates' picks under crewPicks, and the server's synced_at as
   the watermark. It runs once for each trigger, with the drains held while
   it reads and applies. reconcilePicks()'s changes go out as ordinary ops.
   Against the fake backend, tests/helpers/backend.js. New tests, not rows
   of tests/PORT-LEDGER.md, so their titles carry no harness line. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { fakeBackend } from "../helpers/backend.js";
import { YEAR, YY } from "../../src/season.js";

const fixture = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sample-events.json"), "utf8"));
const ids = fixture.events.filter(e => !e.removed).map(e => e.id);
const KEY = name => `dc${YY}.${name}`;
const read = name => JSON.parse(window.localStorage.getItem(KEY(name)));
const seed = (name, value) => window.localStorage.setItem(KEY(name), JSON.stringify(value));
const iso = ms => new Date(ms).toISOString();
const YEAR_MS = 365 * 86400000;
function signIn(fake, user) {
  const s = fake.issue(user.id);
  seed("session", { access_token: s.access_token, refresh_token: s.refresh_token,
    user: { id: user.id, email: user.email || "", is_anonymous: user.is_anonymous } });
  return s;
}
const gets = (fake, table) => fake.requests.filter(r => r.method === "GET" && r.path.startsWith(`/rest/v1/${table}?`));
const params = r => new URL(r.path, "https://backend.test").searchParams;

describe("the pull", () => {
  let page, app, handle, fake, ada, bo, carol, crew, token;
  const [X, Y, Z, W, V, Q, X2] = ids;
  const trigger = async () => { document.dispatchEvent(new Event("visibilitychange")); await app.syncSettled(); };

  beforeAll(async () => {
    fake = fakeBackend();
    ada = fake.held("ada@example.test");
    bo = fake.held("bo@example.test");
    carol = fake.held("carol@example.test");
    /* carol's pick, long before anything else by the server's clock; then
       the server's clock a year ahead of the phone's */
    fake.clockOffset = -2 * 60000;
    fake.write(carol.id, "picks", { event_id: W, picked: true, changed_at: iso(Date.now() - 2 * 60000) });
    fake.clockOffset = YEAR_MS;
    fake.write(ada.id, "picks", { event_id: Y, picked: true, changed_at: iso(Date.now()) });
    fake.write(ada.id, "follows", { kind: "track", key: "Gaming", followed: true, changed_at: iso(Date.now()) });
    fake.write(bo.id, "picks", { event_id: X, picked: true, changed_at: iso(Date.now()) });
    crew = fake.crew({ name: "The crew", creator: ada.id, members: [[ada.id, "Ada"], [bo.id, "Bo"]] });
    token = signIn(fake, ada).access_token;
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("the open run reads the crews, then the picks and the follows whole: exactly these requests", () => {
    const AS_ADA = { apikey: fake.key, Authorization: `Bearer ${token}` };
    expect(fake.requests).toEqual([
      { method: "GET", path: `/rest/v1/crews?select=id,name,creator,crew_members(user_id,display_name)&year=eq.${YEAR}`, headers: AS_ADA, body: undefined },
      { method: "GET", path: `/rest/v1/picks?select=user_id,event_id,picked,changed_at,synced_at&year=eq.${YEAR}&order=synced_at.asc,user_id.asc,event_id.asc&limit=1000&offset=0`, headers: AS_ADA, body: undefined },
      { method: "GET", path: `/rest/v1/follows?select=kind,key,followed,changed_at,synced_at&year=eq.${YEAR}&order=synced_at.asc,kind.asc,key.asc&limit=1000&offset=0`, headers: AS_ADA, body: undefined },
    ]);
  });
  it("the reader's own rows from another device are applied, and kept: a pick and a follow", () => {
    expect([...handle.picks.get()]).toEqual([Y]);
    expect(handle.follows.get()).toEqual([{ kind: "track", key: "Gaming" }]);
    expect(read("picks")).toEqual([Y]);
    expect(read("follows")).toEqual([{ kind: "track", key: "Gaming" }]);
    expect(document.getElementById("mineBadge").textContent).toBe("1");
  });
  it("and nothing goes back: applying a pull records no op", () => {
    expect(fake.requests.filter(r => r.method === "POST")).toEqual([]);
    expect(window.localStorage.getItem(KEY("outbox"))).toBe(null);
  });
  it("a crewmate's picks go under crewPicks, by user and then event, and the crew under crew; no one else's", () => {
    expect(read("crewPicks")).toEqual({ [bo.id]: { [X]: true } });
    expect(read("crew")).toEqual([{ id: crew.id, name: "The crew", creator: ada.id,
      members: [{ user_id: ada.id, display_name: "Ada" }, { user_id: bo.id, display_name: "Bo" }] }]);
  });
  it("the watermark is the server's synced_at, a year ahead of the phone's clock, per table", () => {
    const newest = rows => rows.map(r => r.synced_at).sort().at(-1);
    const stamp = read("syncStamp");
    expect(stamp).toEqual({ user: ada.id, picks: newest(fake.rows("picks").filter(r => r.user_id !== carol.id)), follows: newest(fake.rows("follows")) });
    expect(Date.parse(stamp.picks)).toBeGreaterThan(Date.now() + 300 * 86400000);
  });
  it("a later run reads from a minute before it", async () => {
    const stamp = read("syncStamp");
    await trigger();
    expect(params(gets(fake, "picks").at(-1)).get("synced_at")).toBe(`gt.${iso(Date.parse(stamp.picks) - 60000)}`);
    expect(params(gets(fake, "follows").at(-1)).get("synced_at")).toBe(`gt.${iso(Date.parse(stamp.follows) - 60000)}`);
    expect(gets(fake, "picks").at(-1).path).toContain(`synced_at=gt.${encodeURIComponent(iso(Date.parse(stamp.picks) - 60000))}`);
  });
  it("a crewmate's unstar takes the pick out of crewPicks", async () => {
    fake.write(bo.id, "picks", { event_id: X, picked: false, changed_at: iso(Date.now()) });
    await trigger();
    expect(read("crewPicks")).toEqual({ [bo.id]: {} });
  });
  it("a pending op holds the reader's key against a pulled row, and the watermark waits at that row", async () => {
    fake.fail = r => (r.method === "POST" ? { status: 503, code: "PGRST000" } : null);
    const starred = Date.now();
    handle.picks.set([...handle.picks.get(), Z]);
    await app.syncSettled();
    /* another device unstars it after, and a later row moves the server two minutes on */
    const theirs = fake.write(ada.id, "picks", { event_id: Z, picked: false, changed_at: iso(starred + 1000) });
    fake.clockOffset += 2 * 60000;
    fake.write(ada.id, "picks", { event_id: V, picked: true, changed_at: iso(Date.now()) });
    await trigger();
    expect(handle.picks.get().has(Z)).toBe(true);
    expect(handle.picks.get().has(V)).toBe(true);
    expect(read("syncStamp").picks).toBe(theirs.synced_at);
  });
  it("once the op drains and loses, the row it held is read again, and the newer stamp's value is the phone's", async () => {
    fake.fail = null;
    await trigger();
    expect(fake.rows("picks").find(r => r.user_id === ada.id && r.event_id === Z).picked).toBe(false);
    expect(handle.picks.get().has(Z)).toBe(false);
    expect(read("outbox").ops.picks).toEqual({});
  });
  it("a pending op holds a follow's key too, and the watermark waits for it", async () => {
    fake.fail = r => (r.method === "POST" ? { status: 503, code: "PGRST000" } : null);
    const followed = Date.now();
    handle.follows.set([...handle.follows.get(), { kind: "track", key: "Film" }]);
    await app.syncSettled();
    fake.write(ada.id, "follows", { kind: "track", key: "Film", followed: false, changed_at: iso(followed + 1000) });
    fake.clockOffset += 2 * 60000;
    fake.write(ada.id, "follows", { kind: "track", key: "Comics", followed: false, changed_at: iso(Date.now()) });
    await trigger();
    expect(handle.follows.get()).toContainEqual({ kind: "track", key: "Film" });
    fake.fail = null;
    await trigger();
    expect(handle.follows.get()).toEqual([{ kind: "track", key: "Gaming" }]);
  });
  it("a departed member's picks are dropped", async () => {
    fake.write(bo.id, "picks", { event_id: X2, picked: true, changed_at: iso(Date.now()) });
    await trigger();
    expect(read("crewPicks")).toEqual({ [bo.id]: { [X2]: true } });
    fake.leave(crew, bo.id);
    await trigger();
    expect(read("crewPicks")).toEqual({});
    expect(read("crew")[0].members).toEqual([{ user_id: ada.id, display_name: "Ada" }]);
  });
  it("a newcomer's picks, older than the watermark, come with a whole read of the picks", async () => {
    fake.join(crew, carol.id, "Carol");
    await trigger();
    expect(params(gets(fake, "picks").at(-1)).has("synced_at")).toBe(false);
    expect(params(gets(fake, "follows").at(-1)).has("synced_at")).toBe(true);
    expect(read("crewPicks")).toEqual({ [carol.id]: { [W]: true } });
    await trigger();
    expect(params(gets(fake, "picks").at(-1)).has("synced_at")).toBe(true);
  });
  it("each trigger pulls once: a return to the page, pageshow, online and the worker's schedule-online; no other message", async () => {
    const pulls = () => gets(fake, "crews").length;
    for (const fire of [
      () => document.dispatchEvent(new Event("visibilitychange")),
      () => window.dispatchEvent(new Event("pageshow")),
      () => window.dispatchEvent(new Event("online")),
      () => page.sw.dispatchEvent(new MessageEvent("message", { data: { type: "schedule-online" } })),
    ]) {
      const before = pulls();
      fire();
      await app.syncSettled();
      expect(pulls()).toBe(before + 1);
    }
    const before = pulls();
    page.sw.dispatchEvent(new MessageEvent("message", { data: { type: "schedule-offline" } }));
    page.sw.dispatchEvent(new MessageEvent("message", { data: { type: "schedule-updated", digest: "x" } }));
    await app.syncSettled();
    expect(pulls()).toBe(before);
  });
  it("a trigger during a run asks for one more after it, and three ask for no more than one", async () => {
    const pulls = () => gets(fake, "crews").length, before = pulls();
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("online"));
    await app.syncSettled();
    expect(pulls()).toBe(before + 2);
  });
  it("a pulled follow of a shape this client does not keep is passed over", async () => {
    fake.write(ada.id, "follows", { kind: "work", key: "Not A Slug", followed: true, changed_at: iso(Date.now()) });
    await trigger();
    expect(handle.follows.get()).toEqual([{ kind: "track", key: "Gaming" }]);
  });
  it("the drains are held while a pull reads and applies: a tap mid-pull is not overwritten, and goes out after", async () => {
    fake.write(ada.id, "picks", { event_id: Q, picked: false, changed_at: iso(Date.now() - 60000) });
    fake.onRequest = r => {
      if (r.method !== "GET" || !r.path.startsWith("/rest/v1/follows")) return;
      fake.onRequest = null;
      handle.picks.set([...handle.picks.get(), Q]);
    };
    const from = fake.requests.length;
    await trigger();
    const run = fake.requests.slice(from).map(r => `${r.method} ${r.path.split("?")[0]}`);
    expect(run).toEqual(["GET /rest/v1/crews", "GET /rest/v1/picks", "GET /rest/v1/follows", "POST /rest/v1/picks"]);
    expect(handle.picks.get().has(Q)).toBe(true);
    expect(fake.rows("picks").find(r => r.user_id === ada.id && r.event_id === Q).picked).toBe(true);
  });
  it("a pull waits for a drain already out before it reads", async () => {
    const [K1, K2] = [ids[7], ids[8]];
    fake.fail = r => (r.method === "POST" ? { status: 503, code: "PGRST000" } : null);
    handle.picks.set([...handle.picks.get(), K1]);
    await app.syncSettled();
    fake.fail = null;
    /* while the run's drain is out a star is made, and the drain that
       follows for it is held open */
    fake.onRequest = r => {
      if (r.method !== "POST") return;
      fake.onRequest = null;
      handle.picks.set([...handle.picks.get(), K2]);
      fake.defer = x => x.method === "POST" && x !== r;
    };
    const from = fake.requests.length, run = () => fake.requests.slice(from).map(r => `${r.method} ${r.path.split("?")[0]}`);
    document.dispatchEvent(new Event("visibilitychange"));
    await page.until(() => run().length === 2, 5000, "the second drain");
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(run()).toEqual(["POST /rest/v1/picks", "POST /rest/v1/picks"]);
    fake.defer = null;
    fake.release();
    await app.syncSettled();
    expect(run()).toEqual(["POST /rest/v1/picks", "POST /rest/v1/picks", "GET /rest/v1/crews", "GET /rest/v1/picks", "GET /rest/v1/follows"]);
  });
  it("a follow pulled is not sent back by the next save: only what the reader changes goes", async () => {
    const from = fake.requests.length;
    handle.follows.set([...handle.follows.get(), { kind: "track", key: "Anime" }]);
    await app.syncSettled();
    handle.follows.set([{ kind: "track", key: "Gaming" }]);
    await app.syncSettled();
    expect(fake.requests.slice(from).filter(r => r.method === "POST").map(r => r.body.map(b => [b.key, b.followed])))
      .toEqual([[["Anime", true]], [["Anime", false]]]);
  });
  it("a session gone by the next trigger - another tab signed out - forgets sync's keys, and sends nothing", async () => {
    window.localStorage.removeItem(KEY("session"));
    const sent = fake.requests.length;
    await trigger();
    for (const name of ["outbox", "syncStamp", "crew", "crewPicks"]) expect(window.localStorage.getItem(KEY(name)), name).toBe(null);
    expect(fake.requests.length).toBe(sent);
  });
});

describe("a change of owner whose pull fails", () => {
  let page, app, fake, ada;

  beforeAll(async () => {
    fake = fakeBackend();
    ada = fake.held("ada@example.test");
    signIn(fake, ada);
    /* the last owner's watermark and crew */
    seed("syncStamp", { user: "00000000-0000-4000-a000-0000000000aa", picks: "2026-01-01T00:00:00.000000+00:00", follows: null });
    seed("crew", [{ id: "c1", name: "Someone else's", creator: "x", members: [{ user_id: "x", display_name: "X" }] }]);
    seed("crewPicks", { x: { [ids[0]]: true } });
    fake.fail = r => (r.method === "GET" ? { status: 503, code: "PGRST000" } : null);
    page = await bootPage({ backend: fake });
    ({ app } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("still starts the watermark and the crew's two keys again", () => {
    expect(read("syncStamp")).toEqual({ user: ada.id, picks: null, follows: null });
    expect(window.localStorage.getItem(KEY("crew"))).toBe(null);
    expect(window.localStorage.getItem(KEY("crewPicks"))).toBe(null);
  });
});

describe("a pull of more rows than a page", () => {
  let page, app, handle, fake;

  beforeAll(async () => {
    fake = fakeBackend();
    const ada = fake.held("ada@example.test");
    for (let i = 0; i < 1001; i++) fake.write(ada.id, "picks", { event_id: `p${String(i).padStart(4, "0")}`, picked: true, changed_at: iso(Date.now()) });
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("reads a page at a time until one comes back short", () => {
    expect(gets(fake, "picks").map(r => params(r).get("offset"))).toEqual(["0", "1000"]);
    expect(handle.picks.get().size).toBe(1001);
  });
});

describe("reconcilePicks(), with a session", () => {
  let page, app, handle, fake, survivor, kept;

  beforeAll(async () => {
    const data = structuredClone(fixture);
    const live = data.events.filter(e => !e.removed);
    survivor = live[10];
    kept = live[11];
    survivor.was = ["merged-1"];
    const snapshot = e => ({ title: e.title, start: e.start, location: e.location || "" });
    fake = fakeBackend();
    const ada = fake.held("ada@example.test");
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    seed("picks", ["ghost-1", "merged-1", "unseen-1", kept.id]);
    seed("pickInfo", {
      "ghost-1": { title: "Hazbin Hotel Cast", start: "2026-09-06T16:00", location: "Hilton Salon" },
      "merged-1": { title: "An old title", start: survivor.start, location: survivor.location || "" },
      [kept.id]: snapshot(kept),
    });
    page = await bootPage({ backend: fake, data });
    ({ app, handle } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("a gone pick is a tombstone, a merged one a tombstone and an add for its survivor", () => {
    const sent = fake.requests.filter(r => r.method === "POST").flatMap(r => r.body.map(b => [b.event_id, b.picked]));
    expect(sent).toEqual([["ghost-1", false], ["merged-1", false], [survivor.id, true]].sort());
    expect(read("pickNews").map(n => n.kind)).toEqual(["gone", "merged"]);
  });
  it("a pick this schedule never showed - no event, no was, no snapshot - stays in the plan, unreported and unsent", () => {
    expect([...handle.picks.get()].sort()).toEqual(["unseen-1", kept.id, survivor.id].sort());
    expect(fake.rows("picks").some(r => r.event_id === "unseen-1")).toBe(false);
  });
  it("and Mine's badge counts it meanwhile", () => {
    expect(document.getElementById("mineBadge").textContent).toBe("3");
  });
});
