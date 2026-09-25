/* Sync: the doors and the outbox (DECISIONS #53; docs/sync/contract.md,
   section 5). savePicks() and saveFollows() tell the outbox what changed -
   one op per changed key, stamped by the real clock, the latest change to a
   key the only op for it - and the drain sends each table's ops as one
   upsert, pinned here as it is sent; what the server does not take is kept
   and tried again after a wait. The whole local state goes up as adds when
   the phone gets a user, the last owner's ops never go as the next one's,
   and nothing is recorded or sent without a session. Against the fake
   backend, tests/helpers/backend.js. New tests, not rows of
   tests/PORT-LEDGER.md, so their titles carry no harness line. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bootPage } from "../helpers/page.js";
import { CODE, fakeBackend } from "../helpers/backend.js";
import { YEAR, YY } from "../../src/season.js";

const fixture = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sample-events.json"), "utf8"));
const ids = fixture.events.filter(e => !e.removed).map(e => e.id);
const KEY = name => `dc${YY}.${name}`;
const read = name => JSON.parse(window.localStorage.getItem(KEY(name)));
const seed = (name, value) => window.localStorage.setItem(KEY(name), JSON.stringify(value));
const el = id => document.getElementById(id);
/* A session for a user, kept as the page keeps one, before the boot. */
function signIn(fake, user) {
  const s = fake.issue(user.id);
  seed("session", { access_token: s.access_token, refresh_token: s.refresh_token,
    user: { id: user.id, email: user.email || "", is_anonymous: user.is_anonymous } });
  return s;
}
const posts = (fake, table) => fake.requests.filter(r => r.method === "POST" && r.path.startsWith(`/rest/v1/${table}`));
const UPSERT_HEADERS = (fake, token) => ({ apikey: fake.key, "Content-Type": "application/json", Authorization: `Bearer ${token}`,
  Prefer: "resolution=merge-duplicates,return=minimal" });
/* The email step as a reader drives it, done when it is no longer busy and
   the sync run it started has settled. */
async function step(page, form, field, value) {
  el(field).value = value;
  el(form).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await page.until(() => !el("keepSend").disabled, 5000, `the answer to ${form}`);
  await page.app.syncSettled();
}

describe("the doors: one op per changed key, one upsert per table", () => {
  let page, app, handle, fake, ada, token, id;

  beforeAll(async () => {
    fake = fakeBackend();
    ada = fake.held("ada@example.test");
    token = signIn(fake, ada).access_token;
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("the open run sends nothing, with nothing changed", () => {
    expect(posts(fake, "picks")).toEqual([]);
    expect(posts(fake, "follows")).toEqual([]);
  });
  it("a star is one op, sent as exactly this upsert, stamped by the real clock whatever ?now= says", async () => {
    const row = document.querySelector("#view-now .row");
    id = row.dataset.id;
    const from = Date.now();
    row.querySelector(".star").click();
    await app.syncSettled();
    const to = Date.now();
    expect(posts(fake, "picks")).toEqual([{
      method: "POST", path: "/rest/v1/picks?on_conflict=user_id,year,event_id", headers: UPSERT_HEADERS(fake, token),
      body: [{ year: YEAR, event_id: id, picked: true, changed_at: expect.any(String) }],
    }]);
    const at = Date.parse(posts(fake, "picks")[0].body[0].changed_at);
    expect(at).toBeGreaterThanOrEqual(from);
    expect(at).toBeLessThanOrEqual(to);
    expect(fake.rows("picks")).toEqual([expect.objectContaining({ user_id: ada.id, year: YEAR, event_id: id, picked: true })]);
    expect(read("outbox")).toEqual({ user: ada.id, ops: { picks: {}, follows: {} } });
  });
  it("an unstar is a tombstone: the same key, picked false, a newer stamp", async () => {
    document.querySelector(`#view-now .row[data-id="${id}"] .star`).click();
    await app.syncSettled();
    expect(posts(fake, "picks").at(-1).body).toEqual([{ year: YEAR, event_id: id, picked: false, changed_at: expect.any(String) }]);
    expect(fake.rows("picks")).toEqual([expect.objectContaining({ event_id: id, picked: false })]);
  });
  it("a save that changed nothing records nothing and sends nothing", async () => {
    const sent = fake.requests.length;
    app.savePicks();
    app.saveFollows();
    await app.syncSettled();
    expect(fake.requests.length).toBe(sent);
    expect(read("outbox").ops).toEqual({ picks: {}, follows: {} });
  });
  it("two changes to one key before a drain are one op, the latest", async () => {
    const from = posts(fake, "picks").length;
    handle.picks.set([...handle.picks.get(), ids[3]]);
    handle.picks.set([...handle.picks.get()].filter(x => x !== ids[3]));
    await app.syncSettled();
    expect(posts(fake, "picks").slice(from).map(r => r.body)).toEqual([[{ year: YEAR, event_id: ids[3], picked: false, changed_at: expect.any(String) }]]);
  });
  it("Remove all is a tombstone for every pick, in one upsert", async () => {
    handle.picks.set([ids[4], ids[5]]);
    await app.syncSettled();
    const from = posts(fake, "picks").length;
    handle.picks.set([]);
    await app.syncSettled();
    expect(posts(fake, "picks").slice(from).map(r => r.body.map(b => [b.event_id, b.picked]))).toEqual([[[ids[4], false], [ids[5], false]].sort()]);
  });
  it("a follow and an unfollow: rows of the follows upsert, by kind and key, an axis key whole", async () => {
    handle.follows.set([{ kind: "track", key: "Animation" }, { kind: "axis", key: "genre:horror" }]);
    await app.syncSettled();
    expect(posts(fake, "follows")).toEqual([{
      method: "POST", path: "/rest/v1/follows?on_conflict=user_id,year,kind,key", headers: UPSERT_HEADERS(fake, token),
      body: [
        { year: YEAR, kind: "axis", key: "genre:horror", followed: true, changed_at: expect.any(String) },
        { year: YEAR, kind: "track", key: "Animation", followed: true, changed_at: expect.any(String) },
      ],
    }]);
    handle.follows.set([{ kind: "axis", key: "genre:horror" }]);
    await app.syncSettled();
    expect(posts(fake, "follows").at(-1).body).toEqual([{ year: YEAR, kind: "track", key: "Animation", followed: false, changed_at: expect.any(String) }]);
    expect(fake.rows("follows").map(r => [r.kind, r.key, r.followed]).sort()).toEqual([["axis", "genre:horror", true], ["track", "Animation", false]]);
  });
  it("a change made while a drain is out is not cleared by it, and goes in the next", async () => {
    const from = posts(fake, "picks").length;
    fake.onRequest = r => {
      if (r.method !== "POST") return;
      fake.onRequest = null;
      handle.picks.set([...handle.picks.get()].filter(x => x !== ids[6]));
    };
    handle.picks.set([...handle.picks.get(), ids[6]]);
    await app.syncSettled();
    expect(posts(fake, "picks").slice(from).map(r => r.body.map(b => [b.event_id, b.picked]))).toEqual([[[ids[6], true]], [[ids[6], false]]]);
    expect(fake.rows("picks").find(r => r.event_id === ids[6]).picked).toBe(false);
    expect(read("outbox").ops.picks).toEqual({});
  });
  it("one drain at a time: a star made while one is out waits for it, and is sent alone after", async () => {
    const from = posts(fake, "picks").length;
    fake.onRequest = r => {
      if (r.method !== "POST") return;
      fake.onRequest = null;
      handle.picks.set([...handle.picks.get(), ids[8]]);
    };
    handle.picks.set([...handle.picks.get(), ids[7]]);
    await app.syncSettled();
    expect(posts(fake, "picks").slice(from).map(r => r.body.map(b => b.event_id))).toEqual([[ids[7]], [ids[8]]]);
  });
});

describe("a follow the shape filter drops was never synced", () => {
  let page, app, fake;

  beforeAll(async () => {
    fake = fakeBackend();
    const ada = fake.held("ada@example.test");
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    seed("follows", [{ kind: "fandom", key: "Star Wars" }, { kind: "track", key: "Animation" }]);
    page = await bootPage({ backend: fake });
    ({ app } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("so the next save sends no tombstone for it", async () => {
    app.saveFollows();
    await app.syncSettled();
    expect(posts(fake, "follows")).toEqual([]);
    expect(read("follows")).toEqual([{ kind: "track", key: "Animation" }]);
  });
});

describe("ops kept for another user than the session's", () => {
  let page, app, fake;

  beforeAll(async () => {
    fake = fakeBackend();
    const bo = fake.held("bo@example.test");
    signIn(fake, bo);
    seed("syncStamp", { user: bo.id, picks: null, follows: null });
    seed("outbox", { user: "00000000-0000-4000-a000-0000000000aa", ops: { picks: { [ids[0]]: { on: false, at: new Date(Date.now() - 60000).toISOString() } }, follows: {} } });
    page = await bootPage({ backend: fake });
    ({ app } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("are dropped, never sent as the session's", () => {
    expect(posts(fake, "picks")).toEqual([]);
    expect(window.localStorage.getItem(KEY("outbox"))).toBe(null);
  });
});

describe("a change recorded while another user's ops are kept", () => {
  let page, app, fake, token;

  beforeAll(async () => {
    fake = fakeBackend();
    const bo = fake.held("bo@example.test");
    token = signIn(fake, bo).access_token;
    seed("syncStamp", { user: bo.id, picks: null, follows: null });
    seed("outbox", { user: "00000000-0000-4000-a000-0000000000aa", ops: { picks: { [ids[0]]: { on: false, at: new Date(Date.now() - 60000).toISOString() } }, follows: {} } });
    /* a pick whose event has gone: the load's reconcile records its tombstone */
    seed("picks", ["ghost-2"]);
    seed("pickInfo", { "ghost-2": { title: "Hazbin Hotel Cast", start: "2026-09-06T16:00", location: "Hilton Salon" } });
    page = await bootPage({ backend: fake });
    ({ app } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("starts an outbox of the session's own, and goes out alone", () => {
    expect(posts(fake, "picks").map(r => [r.headers.Authorization, r.body.map(b => [b.event_id, b.picked])]))
      .toEqual([[`Bearer ${token}`, [["ghost-2", false]]]]);
  });
});

describe("with no session", () => {
  let page, app, handle, fake;

  beforeAll(async () => {
    fake = fakeBackend();
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("nothing is recorded, and no request leaves the page: not for a star, a follow or any trigger", async () => {
    document.querySelector("#view-now .row .star").click();
    handle.follows.set([{ kind: "track", key: "Animation" }]);
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pageshow"));
    window.dispatchEvent(new Event("online"));
    page.sw.dispatchEvent(new MessageEvent("message", { data: { type: "schedule-online" } }));
    await app.syncSettled();
    expect(fake.requests).toEqual([]);
    expect(window.localStorage.getItem(KEY("outbox"))).toBe(null);
    expect(window.localStorage.getItem(KEY("syncStamp"))).toBe(null);
  });
  it("and Settings shows no status line", () => {
    handle.openSheet("settings");
    expect(el("keepSync").hidden).toBe(true);
    handle.closeSheet();
  });
});

describe("a drain that fails", () => {
  let page, app, handle, fake;
  const sentPosts = () => posts(fake, "picks").length;

  beforeAll(async () => {
    fake = fakeBackend();
    const ada = fake.held("ada@example.test");
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    await page.until(() => app.BOOT.suggested > 0, 20000, "the index build");
  }, 30000);
  afterAll(() => page.cleanup());

  it("keeps its ops, and the next attempt waits 5 s - a tap inside the wait starts none - then 10, doubling", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      fake.fail = r => (r.method === "POST" ? { status: 503, code: "PGRST000" } : null);
      handle.picks.set([ids[1]]);
      await app.syncSettled();
      const failed = sentPosts();
      expect(read("outbox").ops.picks).toEqual({ [ids[1]]: { on: true, at: expect.any(String) } });
      handle.picks.set([ids[1], ids[2]]);
      await app.syncSettled();
      await vi.advanceTimersByTimeAsync(4999);
      expect(sentPosts()).toBe(failed);
      await vi.advanceTimersByTimeAsync(1);
      expect(sentPosts()).toBe(failed + 1);
      expect(posts(fake, "picks").at(-1).body.map(b => b.event_id)).toEqual([ids[1], ids[2]].sort());
      await vi.advanceTimersByTimeAsync(9999);
      expect(sentPosts()).toBe(failed + 1);
      fake.fail = null;
      await vi.advanceTimersByTimeAsync(1);
      await app.syncSettled();
      expect(sentPosts()).toBe(failed + 2);
      expect(read("outbox").ops.picks).toEqual({});
      expect(fake.rows("picks").map(r => r.event_id).sort()).toEqual([ids[1], ids[2]].sort());
    } finally {
      vi.useRealTimers();
    }
  });
  it("the wait doubles to five minutes and stays there, and a success starts it again at 5 s", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      fake.fail = r => (r.method === "POST" ? { status: 503, code: "PGRST000" } : null);
      handle.picks.set([ids[1]]);
      await app.syncSettled();
      const waits = [];
      for (let tries = 0; tries < 8; tries++) {
        const sent = sentPosts();
        let waited = 0;
        while (sentPosts() === sent) { await vi.advanceTimersByTimeAsync(1000); waited += 1000; }
        waits.push(waited / 1000);
      }
      expect(waits).toEqual([5, 10, 20, 40, 80, 160, 300, 300]);
      fake.fail = null;
      const sent = sentPosts();
      await vi.advanceTimersByTimeAsync(300000);
      await app.syncSettled();
      expect(sentPosts()).toBe(sent + 1);
      fake.fail = r => (r.method === "POST" ? { status: 503, code: "PGRST000" } : null);
      handle.picks.set([ids[2]]);
      await app.syncSettled();
      const failed = sentPosts();
      await vi.advanceTimersByTimeAsync(5000);
      expect(sentPosts()).toBe(failed + 1);
      fake.fail = null;
      await vi.advanceTimersByTimeAsync(10000);
      await app.syncSettled();
    } finally {
      vi.useRealTimers();
    }
  });
  it("and a trigger tries again at once, inside the wait", async () => {
    fake.fail = r => (r.method === "POST" ? { status: 503, code: "PGRST000" } : null);
    handle.picks.set([ids[1], ids[2], ids[3]]);
    await app.syncSettled();
    const failed = sentPosts();
    fake.fail = null;
    window.dispatchEvent(new Event("online"));
    await app.syncSettled();
    expect(sentPosts()).toBe(failed + 1);
    expect(read("outbox").ops.picks).toEqual({});
  });
});

describe("the status line in Keep your plan", () => {
  let page, app, handle, fake;
  const line = () => (el("keepSync").hidden ? null : el("keepSync").textContent);
  const trigger = async () => { document.dispatchEvent(new Event("visibilitychange")); await app.syncSettled(); };

  beforeAll(async () => {
    fake = fakeBackend();
    const ada = fake.held("ada@example.test");
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    handle.openSheet("settings");
  }, 30000);
  afterAll(() => { handle.closeSheet(); return page.cleanup(); });

  it("with a session, under the heading: synced", () => {
    expect(el("keep").children[1]).toBe(el("keepSync"));
    expect(line()).toBe("Synced just now");
  });
  it("what is waiting, while it waits", async () => {
    await app.holdDrains();
    handle.picks.set([ids[1], ids[2]]);
    handle.openSheet("settings");
    expect(line()).toBe("2 changes waiting");
    app.releaseDrains();
    await app.syncSettled();
    handle.openSheet("settings");
    expect(line()).toBe("Synced just now");
  });
  it("offline, and what waits", async () => {
    fake.offline = true;
    handle.picks.set([ids[1]]);
    await trigger();
    expect(line()).toBe("Offline, 1 change waiting");
  });
  it("a server's failure in plain words", async () => {
    fake.offline = false;
    fake.fail = r => (r.method === "POST" ? { status: 500, code: "XX000" } : null);
    await trigger();
    expect(line()).toBe("The server had a problem. Your changes are safe on this phone, and will be sent again.");
  });
  it("a refusal in plain words", async () => {
    fake.fail = r => (r.method === "POST" ? { status: 403, code: "42501" } : null);
    await trigger();
    expect(line()).toBe("The server turned your changes away. They're kept on this phone, and will be sent again.");
  });
  it("synced again once the server takes them", async () => {
    fake.fail = null;
    await trigger();
    expect(line()).toBe("Synced just now");
    expect(fake.rows("picks").filter(r => r.picked).map(r => r.event_id)).toEqual([ids[1]]);
  });
});

describe("mint: the whole local plan goes up as adds", () => {
  let page, app, handle, fake;

  beforeAll(async () => {
    fake = fakeBackend();
    seed("picks", [ids[0], ids[1]]);
    seed("follows", [{ kind: "track", key: "Animation" }, { kind: "person", key: "brendon-lee" }]);
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    handle.openSheet("settings");
  }, 30000);
  afterAll(() => { handle.closeSheet(); return page.cleanup(); });

  it("with no session nothing went up at the boot", () => {
    expect(fake.requests).toEqual([]);
  });
  it("sending a code to an address no one holds mints the phone's user, and every pick and follow goes up as its adds, stamped at once", async () => {
    await step(page, "keepEmailForm", "keepEmail", "new@example.test");
    const minted = read("session");
    expect(minted.user.is_anonymous).toBe(true);
    const [picksSent] = posts(fake, "picks"), [followsSent] = posts(fake, "follows");
    expect(picksSent.headers.Authorization).toBe(`Bearer ${minted.access_token}`);
    expect(picksSent.body.map(b => [b.event_id, b.picked])).toEqual([[ids[0], true], [ids[1], true]].sort());
    expect(followsSent.body.map(b => [b.kind, b.key, b.followed])).toEqual([["person", "brendon-lee", true], ["track", "Animation", true]]);
    expect(new Set([...picksSent.body, ...followsSent.body].map(b => b.changed_at)).size).toBe(1);
    expect(fake.rows("picks").map(r => r.user_id)).toEqual([minted.user.id, minted.user.id]);
  });
  it("and confirming the code adds the email to the same user, and sends nothing again", async () => {
    const sent = posts(fake, "picks").length + posts(fake, "follows").length;
    await step(page, "keepCodeForm", "keepCode", CODE);
    expect(read("session").user.is_anonymous).toBe(false);
    expect(posts(fake, "picks").length + posts(fake, "follows").length).toBe(sent);
    expect(el("keepSync").textContent).toBe("Synced just now");
  });
});

describe("recover: the phone's plan goes up as the recovered user's, and nothing of the last owner's", () => {
  let page, app, handle, fake, ada, anonymous;

  beforeAll(async () => {
    fake = fakeBackend();
    ada = fake.held("ada@example.test");
    const device = fake.held("");
    device.is_anonymous = true;
    const phone = fake.issue(device.id);
    anonymous = device.id;
    seed("session", { access_token: phone.access_token, refresh_token: phone.refresh_token, user: { id: anonymous, email: "", is_anonymous: true } });
    seed("syncStamp", { user: anonymous, picks: null, follows: null });
    seed("picks", [ids[0]]);
    /* the anonymous user's sends fail, so its ops wait */
    fake.fail = r => (r.method === "POST" && r.headers.Authorization === `Bearer ${phone.access_token}` ? { status: 503, code: "PGRST000" } : null);
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    handle.openSheet("settings");
  }, 30000);
  afterAll(() => { handle.closeSheet(); return page.cleanup(); });

  it("the anonymous user's ops wait: a star and an unstar", async () => {
    handle.picks.set([ids[1]]);
    await app.syncSettled();
    expect(read("outbox")).toEqual({ user: anonymous, ops: { picks: { [ids[0]]: { on: false, at: expect.any(String) }, [ids[1]]: { on: true, at: expect.any(String) } }, follows: {} } });
  });
  it("signed in as the address's user, the outbox is theirs: the plan as adds, and no tombstone of the last owner's", async () => {
    await step(page, "keepEmailForm", "keepEmail", "ada@example.test");
    await step(page, "keepCodeForm", "keepCode", CODE);
    const session = read("session");
    expect(session.user.id).toBe(ada.id);
    const mine = posts(fake, "picks").filter(r => r.headers.Authorization === `Bearer ${session.access_token}`);
    expect(mine.map(r => r.body.map(b => [b.event_id, b.picked]))).toEqual([[[ids[1], true]]]);
    expect(fake.rows("picks")).toEqual([expect.objectContaining({ user_id: ada.id, event_id: ids[1], picked: true })]);
    expect(read("outbox")).toEqual({ user: ada.id, ops: { picks: {}, follows: {} } });
    expect(read("syncStamp").user).toBe(ada.id);
  });
});

describe("sign out, then in again as the same user", () => {
  let page, app, handle, fake, ada;

  beforeAll(async () => {
    fake = fakeBackend();
    ada = fake.held("ada@example.test");
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    seed("picks", [ids[0]]);
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    handle.openSheet("settings");
  }, 30000);
  afterAll(() => { handle.closeSheet(); return page.cleanup(); });

  it("sign out forgets sync's keys and hides the status line", () => {
    el("keepSignOut").click();
    for (const name of ["session", "outbox", "syncStamp", "crew", "crewPicks"]) expect(window.localStorage.getItem(KEY(name)), name).toBe(null);
    expect(el("keepSync").hidden).toBe(true);
  });
  it("a star while signed out records nothing", async () => {
    const sent = fake.requests.length;
    handle.picks.set([ids[0], ids[2]]);
    await app.syncSettled();
    expect(fake.requests.length).toBe(sent);
    expect(window.localStorage.getItem(KEY("outbox"))).toBe(null);
  });
  it("and signing in again sends the whole plan, the star made meanwhile with it", async () => {
    await step(page, "keepEmailForm", "keepEmail", "ada@example.test");
    await step(page, "keepCodeForm", "keepCode", CODE);
    expect(posts(fake, "picks").at(-1).body.map(b => [b.event_id, b.picked])).toEqual([[ids[0], true], [ids[2], true]].sort());
  });
});
