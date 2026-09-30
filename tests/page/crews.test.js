/* Crews, the client's layer (DECISIONS #56; docs/sync/contract.md, section
   8): src/crews.js. Each action is one request made as the user, pinned here
   as it is sent, and writes nothing on the phone - the next pull brings what
   changed; create and join mint a user when there is none; every failure is
   in plain words, most of them refused before any request; the invite link
   is read, taken out of the address, kept for the tab's session and taken;
   and the readers draw who's going and the overlay from what the pull kept.
   Against the fake backend, tests/helpers/backend.js, whose RPCs and
   deletes answer as the local stack's PostgREST did. New tests, not rows of
   tests/PORT-LEDGER.md, so their titles carry no harness line. */
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
/* everything the phone keeps, both storages */
const everything = () => ({
  local: Object.fromEntries(Object.keys(window.localStorage).sort().map(k => [k, window.localStorage.getItem(k)])),
  session: Object.fromEntries(Object.keys(window.sessionStorage).sort().map(k => [k, window.sessionStorage.getItem(k)])),
});
function signIn(fake, user) {
  const s = fake.issue(user.id);
  seed("session", { access_token: s.access_token, refresh_token: s.refresh_token,
    user: { id: user.id, email: user.email || "", is_anonymous: user.is_anonymous } });
  return s.access_token;
}
const AS = (fake, token) => ({ apikey: fake.key, Authorization: `Bearer ${token}` });
const AS_WITH_BODY = (fake, token) => ({ ...AS(fake, token), "Content-Type": "application/json" });
const gets = (fake, table) => fake.requests.filter(r => r.method === "GET" && r.path.startsWith(`/rest/v1/${table}?`));
const params = r => new URL(r.path, "https://backend.test").searchParams;
const failure = promise => promise.then(() => { throw new Error("the action succeeded"); }, e => e);

describe("the actions: one request each, as the user, pinned as sent, and nothing kept on the phone", () => {
  let page, app, fake, ada, bo, cy, crew, token, owls;
  const run = async () => { await app.runSync(); await app.syncSettled(); };

  beforeAll(async () => {
    fake = fakeBackend();
    ada = fake.held("ada@example.test");
    bo = fake.held("bo@example.test");
    cy = fake.held("cy@example.test");
    crew = fake.crew({ name: "The crew", creator: ada.id, members: [[ada.id, "Ada"], [bo.id, "Bo"], [cy.id, "Cy"]] });
    token = signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("the pull keeps the crew with its invite token: myCrews(), and the reader its creator", () => {
    expect(app.myCrews()).toEqual([{ id: crew.id, name: "The crew", creator: ada.id, invite_token: crew.invite_token,
      members: [{ user_id: ada.id, display_name: "Ada" }, { user_id: bo.id, display_name: "Bo" }, { user_id: cy.id, display_name: "Cy" }] }]);
    expect(app.isCreator(app.myCrews()[0])).toBe(true);
  });
  it("createCrew(): POST rpc/create_crew with the year and both names trimmed, answered by the crew; nothing kept until a pull", async () => {
    const before = everything(), from = fake.requests.length;
    owls = await app.createCrew("  Night owls  ", " Ada ");
    expect(fake.requests.slice(from)).toEqual([{ method: "POST", path: "/rest/v1/rpc/create_crew", headers: AS_WITH_BODY(fake, token),
      body: { year: YEAR, name: "Night owls", display_name: "Ada" } }]);
    expect(owls).toEqual({ id: owls.id, year: YEAR, name: "Night owls", invite_token: owls.invite_token, creator: ada.id, created_at: owls.created_at });
    expect(owls.invite_token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(everything()).toEqual(before);
    expect(app.myCrews().map(c => c.name)).toEqual(["The crew"]);
    await run();
    expect(app.myCrews().map(c => c.name)).toEqual(["The crew", "Night owls"]);
  });
  it("newInvite(): POST rpc/regenerate_invite with the crew's id, answered by the new token; the kept one stays until a pull", async () => {
    const before = everything(), from = fake.requests.length, old = crew.invite_token;
    const fresh = await app.newInvite(crew.id);
    expect(fake.requests.slice(from)).toEqual([{ method: "POST", path: "/rest/v1/rpc/regenerate_invite", headers: AS_WITH_BODY(fake, token),
      body: { crew_id: crew.id } }]);
    expect(fresh).toBe(fake.rows("crews").find(c => c.id === crew.id).invite_token);
    expect(fresh).not.toBe(old);
    expect(everything()).toEqual(before);
    expect(app.myCrews()[0].invite_token).toBe(old);
    await run();
    expect(app.myCrews()[0].invite_token).toBe(fresh);
  });
  it("removeMember(): DELETE the member's row of crew_members, by crew and user, with no body; answered by nothing", async () => {
    const before = everything(), from = fake.requests.length;
    expect(await app.removeMember(crew.id, cy.id)).toBe(null);
    expect(fake.requests.slice(from)).toEqual([{ method: "DELETE", path: `/rest/v1/crew_members?crew_id=eq.${crew.id}&user_id=eq.${cy.id}`,
      headers: AS(fake, token), body: undefined }]);
    expect(everything()).toEqual(before);
    expect(fake.rows("crews").find(c => c.id === crew.id).members.map(m => m.user_id)).toEqual([ada.id, bo.id]);
    await run();
    expect(app.myCrews()[0].members.map(m => m.display_name)).toEqual(["Ada", "Bo"]);
  });
  it("deleteCrew(): DELETE the crew by its id, its memberships with it", async () => {
    const before = everything(), from = fake.requests.length;
    expect(await app.deleteCrew(owls.id)).toBe(null);
    expect(fake.requests.slice(from)).toEqual([{ method: "DELETE", path: `/rest/v1/crews?id=eq.${owls.id}`, headers: AS(fake, token), body: undefined }]);
    expect(everything()).toEqual(before);
    expect(fake.rows("crews").map(c => c.id)).toEqual([crew.id]);
    await run();
    expect(app.myCrews().map(c => c.name)).toEqual(["The crew"]);
  });
  it("leaveCrew(): DELETE the reader's own row, by crew and user - a member's, not the creator's", async () => {
    const boToken = signIn(fake, bo);
    await run();
    expect(app.isCreator(app.myCrews()[0])).toBe(false);
    const before = everything(), from = fake.requests.length;
    expect(await app.leaveCrew(crew.id)).toBe(null);
    expect(fake.requests.slice(from)).toEqual([{ method: "DELETE", path: `/rest/v1/crew_members?crew_id=eq.${crew.id}&user_id=eq.${bo.id}`,
      headers: AS(fake, boToken), body: undefined }]);
    expect(everything()).toEqual(before);
    await run();
    expect(app.myCrews()).toEqual([]);
  });
  it("joinCrew() by a pasted link: POST rpc/join_crew with the link's token and the name trimmed, answered by the crew", async () => {
    const boToken = JSON.parse(window.localStorage.getItem(KEY("session"))).access_token;
    const link = `https://example.test/some/path/?now=2026-09-05T13:05&join=${YEAR}.${fake.rows("crews")[0].invite_token}#explore=track:Gaming`;
    const before = everything(), from = fake.requests.length;
    const joined = await app.joinCrew(link, " Bo ");
    expect(fake.requests.slice(from)).toEqual([{ method: "POST", path: "/rest/v1/rpc/join_crew", headers: AS_WITH_BODY(fake, boToken),
      body: { token: fake.rows("crews")[0].invite_token, display_name: "Bo" } }]);
    expect(joined).toMatchObject({ id: crew.id, name: "The crew", creator: ada.id });
    expect(everything()).toEqual(before);
  });
  it("and again, as a member already in it: the crew as it was, and the first display name kept", async () => {
    const again = await app.joinCrew(`${YEAR}.${fake.rows("crews")[0].invite_token}`, "Someone else");
    expect(again.id).toBe(crew.id);
    expect(fake.rows("crews")[0].members).toEqual([{ user_id: ada.id, display_name: "Ada" }, { user_id: bo.id, display_name: "Bo" }]);
  });
  it("a name is counted as Postgres counts it, by code point: forty dragons are a name, forty-one are not", async () => {
    const from = fake.requests.length;
    await app.createCrew("\u{1F409}".repeat(40), "Bo");
    expect(fake.requests.slice(from).map(r => r.body.name)).toEqual(["\u{1F409}".repeat(40)]);
    expect((await failure(app.createCrew("\u{1F409}".repeat(41), "Bo"))).code).toBe("bad_crew_name");
    expect(fake.requests.length).toBe(from + 1);
  });
});

describe("create and join mint a user when the phone has none, and only then", () => {
  let page, app, fake, ada, crew;
  const X = ids[0];

  beforeAll(async () => {
    fake = fakeBackend();
    ada = fake.held("ada@example.test");
    crew = fake.crew({ name: "Ada's crew", creator: ada.id, members: [[ada.id, "Ada"]] });
    seed("picks", [X]);
    page = await bootPage({ backend: fake });
    ({ app } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("with no session the page has sent nothing", () => {
    expect(fake.requests).toEqual([]);
  });
  it("a join with an invite that does not work mints first, and keeps the user it minted: nothing of the plan changes", async () => {
    const picks = window.localStorage.getItem(KEY("picks"));
    const err = await failure(app.joinCrew(`${YEAR}.no-such-invite`, "Bo"));
    expect(fake.requests.map(r => `${r.method} ${r.path}`)).toEqual(["POST /auth/v1/signup", "POST /rest/v1/rpc/join_crew"]);
    expect([err.code, err.status]).toEqual(["P0002", 500]);
    expect(app.crewMessage(err)).toBe("That invite doesn't work any more - ask for a new link.");
    expect(read("session").user.is_anonymous).toBe(true);
    expect(window.localStorage.getItem(KEY("picks"))).toBe(picks);
  });
  it("with a session, create sends one request and no sign-in", async () => {
    const from = fake.requests.length, token = read("session").access_token;
    await app.createCrew("Bo's crew", "Bo");
    expect(fake.requests.slice(from).map(r => [`${r.method} ${r.path}`, r.headers.Authorization])).toEqual([["POST /rest/v1/rpc/create_crew", `Bearer ${token}`]]);
  });
  it("with none, create signs in anonymously first and makes the crew as that user", async () => {
    window.localStorage.removeItem(KEY("session"));
    const from = fake.requests.length;
    const made = await app.createCrew("Another", "Bo");
    const sent = fake.requests.slice(from), session = read("session");
    expect(sent.map(r => `${r.method} ${r.path}`)).toEqual(["POST /auth/v1/signup", "POST /rest/v1/rpc/create_crew"]);
    expect(sent[0]).toMatchObject({ headers: { apikey: fake.key, "Content-Type": "application/json" }, body: {} });
    expect(sent[1].headers.Authorization).toBe(`Bearer ${session.access_token}`);
    expect(made.creator).toBe(session.user.id);
  });
  it("and so does join, with the invite as the link kept it", async () => {
    window.localStorage.removeItem(KEY("session"));
    const from = fake.requests.length;
    const joined = await app.joinCrew(`${YEAR}.${crew.invite_token}`, "Bo");
    const sent = fake.requests.slice(from), session = read("session");
    expect(sent.map(r => `${r.method} ${r.path}`)).toEqual(["POST /auth/v1/signup", "POST /rest/v1/rpc/join_crew"]);
    expect(sent[1]).toMatchObject({ headers: { Authorization: `Bearer ${session.access_token}` }, body: { token: crew.invite_token, display_name: "Bo" } });
    expect(joined.id).toBe(crew.id);
  });
  it("then a sync run carries the phone's plan up for its new user, and brings the crew and its picks", async () => {
    fake.write(ada.id, "picks", { event_id: ids[1], picked: true, changed_at: iso(Date.now()) });
    await app.runSync();
    await app.syncSettled();
    const user = read("session").user.id;
    expect(fake.rows("picks").filter(r => r.user_id === user).map(r => [r.event_id, r.picked])).toEqual([[X, true]]);
    expect(app.myCrews().map(c => c.id)).toEqual([crew.id]);
    expect(app.goingTo(ids[1])).toEqual([{ user_id: ada.id, display_name: "Ada" }]);
  });
});

describe("joinCrew() then runSync(): the new crew's picks arrive whole, older than the watermark", () => {
  let page, app, fake, ada, bo, crew;
  const [X, Y, Z] = ids;

  beforeAll(async () => {
    fake = fakeBackend();
    ada = fake.held("ada@example.test");
    bo = fake.held("bo@example.test");
    /* ada's picks, an hour before anything the phone has seen */
    fake.clockOffset = -3600000;
    fake.write(ada.id, "picks", { event_id: X, picked: true, changed_at: iso(Date.now() - 3600000) });
    fake.write(ada.id, "picks", { event_id: Y, picked: true, changed_at: iso(Date.now() - 3600000) });
    fake.clockOffset = 0;
    crew = fake.crew({ name: "Ada's crew", creator: ada.id, members: [[ada.id, "Ada"]] });
    fake.write(bo.id, "picks", { event_id: Z, picked: true, changed_at: iso(Date.now()) });
    signIn(fake, bo);
    seed("picks", [Z]);
    seed("syncStamp", { user: bo.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("before: no crew, and a watermark past ada's picks", () => {
    expect(app.myCrews()).toEqual([]);
    expect(Date.parse(read("syncStamp").picks)).toBeGreaterThan(Date.parse(fake.rows("picks").find(r => r.event_id === X).synced_at) + 60000);
  });
  it("a crew of the reader alone gains no one: the next pull reads from the watermark still", async () => {
    await app.createCrew("Bo alone", "Bo");
    await app.runSync();
    await app.syncSettled();
    expect(app.myCrews().map(c => c.name)).toEqual(["Bo alone"]);
    expect(params(gets(fake, "picks").at(-1)).has("synced_at")).toBe(true);
  });
  it("after: the picks read whole, and ada's two under crewPicks, for goingTo() and the overlay", async () => {
    await app.joinCrew(`${YEAR}.${crew.invite_token}`, "Bo");
    await app.runSync();
    await app.syncSettled();
    expect(params(gets(fake, "picks").at(-1)).has("synced_at")).toBe(false);
    expect(read("crewPicks")).toEqual({ [ada.id]: { [X]: true, [Y]: true } });
    expect(app.goingTo(X)).toEqual([{ user_id: ada.id, display_name: "Ada" }]);
    expect([...app.crewmatesByEvent().keys()].sort()).toEqual([X, Y].sort());
  });
  it("and the next run reads from the watermark again", async () => {
    await app.runSync();
    await app.syncSettled();
    expect(params(gets(fake, "picks").at(-1)).has("synced_at")).toBe(true);
  });
});

describe("every failure in plain words, and local state untouched", () => {
  let page, app, fake, ada, bo, cy, dee, mine, theirs, full;

  beforeAll(async () => {
    fake = fakeBackend();
    ada = fake.held("ada@example.test");
    bo = fake.held("bo@example.test");
    cy = fake.held("cy@example.test");
    dee = fake.held("dee@example.test");
    mine = fake.crew({ name: "Ada's", creator: ada.id, members: [[ada.id, "Ada"], [bo.id, "Bo"]] });
    theirs = fake.crew({ name: "Bo's", creator: bo.id, members: [[bo.id, "Bo"], [ada.id, "Ada"]] });
    full = fake.crew({ name: "Cy's", creator: cy.id, members: [[cy.id, "Cy"], [dee.id, "Dee"]] });
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  /* action, the error's code, how many requests it made, and the words */
  const cases = () => [
    ["a crew's name that is empty", () => app.createCrew("", "Ada"), "bad_crew_name", 0, "A crew's name is 1 to 40 characters."],
    ["a crew's name of spaces alone", () => app.createCrew("   ", "Ada"), "bad_crew_name", 0, "A crew's name is 1 to 40 characters."],
    ["a crew's name of 41", () => app.createCrew("x".repeat(41), "Ada"), "bad_crew_name", 0, "A crew's name is 1 to 40 characters."],
    ["a display name of 25", () => app.createCrew("A crew", "y".repeat(25)), "bad_display_name", 0, "Your name in the crew is 1 to 24 characters."],
    ["a display name of 25, to join", () => app.joinCrew(`${YEAR}.${full.invite_token}`, "y".repeat(25)), "bad_display_name", 0, "Your name in the crew is 1 to 24 characters."],
    ["a display name that is empty, to join", () => app.joinCrew(`${YEAR}.${full.invite_token}`, " "), "bad_display_name", 0, "Your name in the crew is 1 to 24 characters."],
    ["what is not an invite", () => app.joinCrew("see you there", "Ada"), "bad_invite", 0, "That doesn't look like an invite link."],
    ["another year's invite", () => app.joinCrew(`${YEAR + 1}.${full.invite_token}`, "Ada"), "other_year", 0, "That invite is for another year's con - ask for a new link."],
    ["an invite no crew has", () => app.joinCrew(`${YEAR}.no-such-invite`, "Ada"), "P0002", 1, "That invite doesn't work any more - ask for a new link."],
    ["a crew at its cap", () => app.joinCrew(`${YEAR}.${full.invite_token}`, "Ada"), "53400", 1, "That crew is full."],
    ["a new invite for a crew the reader did not make", () => app.newInvite(theirs.id), "not_creator", 0, "Only the crew's creator can do that."],
    ["a member removed from a crew the reader did not make", () => app.removeMember(theirs.id, bo.id), "not_creator", 0, "Only the crew's creator can do that."],
    ["a crew the reader did not make deleted", () => app.deleteCrew(theirs.id), "not_creator", 0, "Only the crew's creator can do that."],
    ["the creator leaving", () => app.leaveCrew(mine.id), "creator_leaves", 0, "You made this crew, so you can't leave it - you can delete it instead."],
    ["the creator removing themselves", () => app.removeMember(mine.id, ada.id), "creator_leaves", 0, "You made this crew, so you can't leave it - you can delete it instead."],
    ["a crew the phone does not hold", () => app.leaveCrew("00000000-0000-4000-b000-999999999999"), "no_crew", 0, "That crew isn't on this phone any more - it may have been deleted."],
  ];
  it("each refused as it should be, with its words, nothing kept and nothing more sent", async () => {
    fake.flags.crew_size_cap = 2;
    for (const [what, act, code, sent, words] of cases()) {
      const before = everything(), from = fake.requests.length;
      const err = await failure(act());
      expect(err.code, what).toBe(code);
      expect(app.crewMessage(err), what).toBe(words);
      expect(fake.requests.length - from, what).toBe(sent);
      expect(everything(), what).toEqual(before);
    }
    fake.flags.crew_size_cap = 25;
  });
  it("the cap absent from flags, a crew takes no one: full", async () => {
    fake.flags = {};
    expect((await failure(app.joinCrew(`${YEAR}.${full.invite_token}`, "Ada"))).code).toBe("53400");
    fake.flags = { crew_size_cap: 25 };
  });
  it("the server's 42501, where the phone still thinks the reader made the crew, is the creator's words", async () => {
    const before = everything(), from = fake.requests.length;
    const server = fake.rows("crews").find(c => c.id === mine.id);
    expect(server.creator).toBe(ada.id);
    mine.creator = bo.id;              // behind the page's back: the crew as the server now has it
    const err = await failure(app.newInvite(mine.id));
    mine.creator = ada.id;
    expect(fake.requests.length - from).toBe(1);
    expect([err.code, err.status]).toEqual(["not_creator", 403]);
    expect(app.crewMessage(err)).toBe("Only the crew's creator can do that.");
    expect(everything()).toEqual(before);
  });
  it("offline, and a server's error, in identity's words", async () => {
    fake.offline = true;
    let err = await failure(app.createCrew("A crew", "Ada"));
    fake.offline = false;
    expect(app.crewMessage(err)).toBe("Couldn't reach the server. Your plan is safe on this phone; try again when you have signal.");
    fake.fail = r => (r.path.startsWith("/rest/v1/rpc/") ? { status: 503, code: "PGRST000" } : null);
    err = await failure(app.createCrew("A crew", "Ada"));
    fake.fail = null;
    expect([err.code, app.crewMessage(err)]).toEqual(["PGRST000", "Something went wrong. Please try again."]);
  });
  it("with no session, an action on a crew is refused as signed out, and sends nothing", async () => {
    const session = window.localStorage.getItem(KEY("session"));
    window.localStorage.removeItem(KEY("session"));
    const from = fake.requests.length;
    const err = await failure(app.deleteCrew(mine.id));
    window.localStorage.setItem(KEY("session"), session);
    expect(err.code).toBe("session_lost");
    expect(fake.requests.length).toBe(from);
  });
});

describe("the invite link: read, taken out of the address, kept for the session and taken", () => {
  let page, app, handle, fake;

  beforeAll(async () => {
    fake = fakeBackend();
    page = await bootPage({ backend: fake, url: `https://example.test/sub/path/?now=2026-09-05T13:05&join=${YEAR}.tokA#explore=track:Gaming` });
    ({ app, handle } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("boot() takes the parameter out of the address, leaving ?now= and the hash as they were", () => {
    expect(window.location.pathname).toBe("/sub/path/");
    expect(window.location.search).toBe("?now=2026-09-05T13:05");
    expect(window.location.hash).toBe("#explore=track:Gaming");
  });
  it("and the simulated clock is the link's still", () => {
    expect(app.isSimulated()).toBe(true);
    expect(handle.now().getTime()).toBe(new Date("2026-09-05T13:05").getTime());
  });
  it("the invite is kept for the tab's session, and nothing is sent: nothing joins but a screen", () => {
    expect(window.sessionStorage.getItem(KEY("join"))).toBe(`${YEAR}.tokA`);
    expect(app.pendingJoin()).toBe(`${YEAR}.tokA`);
    expect(fake.requests).toEqual([]);
  });
  it("inviteLink(): the page's address with ?join=<year>.<token> for its query - the sharer's ?now= and hash left behind", () => {
    expect(app.inviteLink({ invite_token: "abc_-9" })).toBe(`https://example.test/sub/path/?join=${YEAR}.abc_-9`);
    expect(app.inviteLink({})).toBe("");
    expect(app.inviteLink(null)).toBe("");
  });
  it("and what it makes, readInvite() reads back", () => {
    expect(app.readInvite(app.inviteLink({ invite_token: "abc_-9" }))).toEqual({ year: YEAR, token: "abc_-9" });
  });
  it("takePendingJoin() hands it over once and forgets it", () => {
    expect(app.takePendingJoin()).toBe(`${YEAR}.tokA`);
    expect(app.pendingJoin()).toBe("");
    expect(window.sessionStorage.getItem(KEY("join"))).toBe(null);
    expect(app.takePendingJoin()).toBe("");
  });
});

describe("the invite link across a reload, another link, another year and no backend", () => {
  let page;
  afterAll(() => page && page.cleanup());

  it("a reload before the join lands: the address has none, and the session's is kept", async () => {
    window.sessionStorage.setItem(KEY("join"), `${YEAR}.tokB`);
    page = await bootPage({ backend: fakeBackend() });
    expect(page.app.pendingJoin()).toBe(`${YEAR}.tokB`);
    expect(window.location.search).toBe("?now=2026-09-05T13:05");
    await page.cleanup();
  }, 30000);
  it("a link opened over a kept one: the address wins", async () => {
    window.sessionStorage.setItem(KEY("join"), `${YEAR}.tokB`);
    page = await bootPage({ backend: fakeBackend(), url: `https://example.test/?join=${YEAR}.tokC&now=2026-09-05T13:05` });
    expect(page.app.pendingJoin()).toBe(`${YEAR}.tokC`);
    expect(window.location.search).toBe("?now=2026-09-05T13:05");
    await page.cleanup();
  }, 30000);
  it("a path that begins // is kept as it is: the address is rewritten whole, and boot() goes on", async () => {
    page = await bootPage({ backend: fakeBackend(), url: `https://example.test//sub/?now=2026-09-05T13:05&join=${YEAR}.tokH#explore=track:Gaming` });
    expect(window.location.href).toBe("https://example.test//sub/?now=2026-09-05T13:05#explore=track:Gaming");
    expect(page.app.pendingJoin()).toBe(`${YEAR}.tokH`);
    expect(page.app.inviteLink({ invite_token: "abc" })).toBe(`https://example.test//sub/?join=${YEAR}.abc`);
    await page.cleanup();
  }, 30000);
  it("the parameter alone leaves no query at all", async () => {
    page = await bootPage({ backend: fakeBackend(), url: `https://example.test/?join=${YEAR}.tokD` });
    expect(window.location.href).toBe("https://example.test/");
    expect(page.app.pendingJoin()).toBe(`${YEAR}.tokD`);
    await page.cleanup();
  }, 30000);
  it("a bare ?join goes from the address and keeps nothing; an invite with spaces about it is kept trimmed", async () => {
    page = await bootPage({ backend: fakeBackend(), url: "https://example.test/?join&now=2026-09-05T13:05" });
    expect(window.location.search).toBe("?now=2026-09-05T13:05");
    expect(page.app.pendingJoin()).toBe("");
    expect(window.sessionStorage.getItem(KEY("join"))).toBe(null);
    await page.cleanup();
    page = await bootPage({ backend: fakeBackend(), url: `https://example.test/?now=2026-09-05T13:05&join=%20${YEAR}.tokG%20` });
    expect(window.location.search).toBe("?now=2026-09-05T13:05");
    expect(page.app.pendingJoin()).toBe(`${YEAR}.tokG`);
    await page.cleanup();
  }, 30000);
  it("another year's link is kept, and refused by the join before any request - no sign-in either", async () => {
    const fake = fakeBackend();
    page = await bootPage({ backend: fake, url: `https://example.test/?now=2026-09-05T13:05&join=${YEAR + 1}.tokE` });
    await page.app.syncSettled();
    expect(page.app.pendingJoin()).toBe(`${YEAR + 1}.tokE`);
    const err = await failure(page.app.joinCrew(page.app.pendingJoin(), "Bo"));
    expect(err.code).toBe("other_year");
    expect(fake.requests).toEqual([]);
    expect(window.localStorage.getItem(KEY("session"))).toBe(null);
    await page.cleanup();
  }, 30000);
  it("a build with no backend takes the parameter out and keeps nothing - drops one kept, too: the 2026 app knows no crews", async () => {
    window.sessionStorage.setItem(KEY("join"), `${YEAR}.tokB`);
    page = await bootPage({ url: `https://example.test/?now=2026-09-05T13:05&join=${YEAR}.tokF#explore=track:Gaming` });
    expect(window.location.search).toBe("?now=2026-09-05T13:05");
    expect(window.location.hash).toBe("#explore=track:Gaming");
    expect(window.sessionStorage.getItem(KEY("join"))).toBe(null);
    expect(page.app.pendingJoin()).toBe("");
  }, 30000);
});

describe("readInvite(): the kept <year>.<token>, or a pasted link", () => {
  let page;
  beforeAll(async () => { page = await bootPage(); }, 30000);
  afterAll(() => page.cleanup());

  it("reads the kept value, a link, and a link in a sentence", () => {
    const { readInvite } = page.app;
    expect(readInvite(`${YEAR}.tok_A-1`)).toEqual({ year: YEAR, token: "tok_A-1" });
    expect(readInvite(`  ${YEAR}.tok_A-1  `)).toEqual({ year: YEAR, token: "tok_A-1" });
    expect(readInvite(`https://example.test/p/?now=2026-09-05T13:05&join=${YEAR}.tok_A-1#x`)).toEqual({ year: YEAR, token: "tok_A-1" });
    expect(readInvite(`Join us: https://example.test/?join=${YEAR}.tok_A-1 see you`)).toEqual({ year: YEAR, token: "tok_A-1" });
    expect(readInvite(`https://example.test/?join=${YEAR}%2Etok_A-1`)).toEqual({ year: YEAR, token: "tok_A-1" });
  });
  it("the message a share sends, whole: the crew's name, then its link, last", () => {
    const { readInvite } = page.app;
    expect(readInvite(`Join "Night owls" on the Dragon Con planner: https://example.test/?join=${YEAR}.tok_A-1`)).toEqual({ year: YEAR, token: "tok_A-1" });
    expect(readInvite(`Join "?join=${YEAR}.not-this" on the Dragon Con planner: https://example.test/?join=${YEAR}.tok_A-1`)).toEqual({ year: YEAR, token: "tok_A-1" });
  });
  it("and nothing else", () => {
    const { readInvite } = page.app;
    for (const junk of ["", null, undefined, "tok", `${YEAR}.`, `${YEAR}tok`, `26.tok`, `1${YEAR}.tok`, `x${YEAR}.tok`, `${YEAR}.to k`, `${YEAR}.tok.more`,
      "https://example.test/?join=", "https://example.test/?join=%E0%A4%A", "https://example.test/?now=2026-09-05T13:05"]) {
      expect(readInvite(junk), String(junk)).toBe(null);
    }
  });
});

describe("the readers: who's going and the overlay, from what the pull kept", () => {
  let page, app, fake, ada, bo, cy, dee, zed, older, newer;
  const [X, Y, Z, W, V] = ids;
  const run = async () => { await app.runSync(); await app.syncSettled(); };
  const person = (user, name) => ({ user_id: user.id, display_name: name });

  beforeAll(async () => {
    fake = fakeBackend();
    [ada, bo, cy, dee, zed] = ["ada", "bo", "cy", "dee", "zed"].map(n => fake.held(`${n}@example.test`));
    older = fake.crew({ name: "Older", creator: ada.id, members: [[ada.id, "Ada"], [zed.id, "Zed"], [bo.id, "Bo"]] });
    newer = fake.crew({ name: "Newer", creator: bo.id, members: [[bo.id, "Bobby"], [ada.id, "Ada"], [dee.id, "Dee"]] });
    fake.crew({ name: "Not ada's", creator: cy.id, members: [[cy.id, "Cy"]] });
    const pick = (user, id, picked = true, later = 0) => fake.write(user.id, "picks", { event_id: id, picked, changed_at: iso(Date.now() + later) });
    pick(bo, X); pick(bo, Y); pick(zed, X); pick(dee, X); pick(dee, Z); pick(ada, X); pick(ada, W); pick(cy, X);
    pick(bo, V);
    pick(bo, V, false, 1000);
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("myCrews(): the kept crews, oldest first, each with its token and members", () => {
    expect(app.myCrews().map(c => [c.name, c.creator, c.invite_token])).toEqual([["Older", ada.id, older.invite_token], ["Newer", bo.id, newer.invite_token]]);
    expect(app.myCrews()[1].members).toEqual([person(bo, "Bobby"), person(ada, "Ada"), person(dee, "Dee")]);
  });
  it("isCreator(): the reader's own crew, and not another's", () => {
    const [mine, theirs] = app.myCrews();
    expect([app.isCreator(mine), app.isCreator(theirs), app.isCreator(null)]).toEqual([true, false, false]);
  });
  it("goingTo(): the union of every crew, a person once, the first crew's name, by name - and never the reader", () => {
    expect(app.goingTo(X)).toEqual([person(bo, "Bo"), person(dee, "Dee"), person(zed, "Zed")]);
    expect(app.goingTo(Y)).toEqual([person(bo, "Bo")]);
    expect(app.goingTo(Z)).toEqual([person(dee, "Dee")]);
  });
  it("an event only the reader starred, one a crewmate unstarred and one no one did: no one", () => {
    expect([app.goingTo(W), app.goingTo(V), app.goingTo("no-such-event")]).toEqual([[], [], []]);
  });
  it("crewmatesByEvent(): every event a crewmate starred, to the same list", () => {
    const map = app.crewmatesByEvent();
    expect([...map.keys()].sort()).toEqual([X, Y, Z].sort());
    for (const id of [X, Y, Z]) expect(map.get(id)).toEqual(app.goingTo(id));
  });
  it("crewmatePicks(): one crewmate's stars as the pull kept them - an unstar none of them - and nothing for the reader or a stranger", () => {
    expect(app.crewmatePicks(bo.id).sort()).toEqual([X, Y].sort());
    expect(app.crewmatePicks(dee.id).sort()).toEqual([X, Z].sort());
    expect([app.crewmatePicks(ada.id), app.crewmatePicks(cy.id), app.crewmatePicks("no-such-user")]).toEqual([[], [], []]);
  });
  it("myMembership(): the reader's own row in a crew, by the name that crew gives them", () => {
    const [mine, theirs] = app.myCrews();
    expect(app.myMembership(mine)).toEqual(person(ada, "Ada"));
    expect(app.myMembership(theirs)).toEqual(person(ada, "Ada"));
    expect([app.myMembership(null), app.myMembership({ members: [person(bo, "Bo")] })]).toEqual([null, null]);
  });
  it("a departed member is gone from both", async () => {
    fake.leave(newer, dee.id);
    await run();
    expect(app.goingTo(X)).toEqual([person(bo, "Bo"), person(zed, "Zed")]);
    expect(app.crewmatesByEvent().has(Z)).toBe(false);
  });
  it("a crewmate who leaves one of two crews stays, by the name the other gives", async () => {
    fake.leave(older, bo.id);
    await run();
    expect(app.goingTo(X)).toEqual([person(bo, "Bobby"), person(zed, "Zed")]);
  });
  it("a newcomer who joins between the crews read and the picks read waits for the next run, and comes whole with it", async () => {
    fake.onRequest = r => {
      if (r.method !== "GET" || !r.path.startsWith("/rest/v1/picks?")) return;
      fake.onRequest = null;
      fake.join(older, cy.id, "Cy");
    };
    await run();
    expect(read("crewPicks")[cy.id]).toBe(undefined);
    expect(app.goingTo(X)).toEqual([person(bo, "Bobby"), person(zed, "Zed")]);
    await run();
    expect(params(gets(fake, "picks").at(-1)).has("synced_at")).toBe(false);
    expect(app.goingTo(X)).toEqual([person(bo, "Bobby"), person(cy, "Cy"), person(zed, "Zed")]);
  });
});

describe("the readers with no crews", () => {
  let page, app, fake, ada;
  const X = ids[0];

  beforeAll(async () => {
    fake = fakeBackend();
    ada = fake.held("ada@example.test");
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("empty lists, an empty map", () => {
    expect(app.myCrews()).toEqual([]);
    expect(app.goingTo(X)).toEqual([]);
    expect(app.crewmatesByEvent().size).toBe(0);
  });
  it("the keys are read when asked, not as the module was imported", () => {
    seed("crew", [{ id: "c1", name: "Seeded", creator: "x", invite_token: "t", members: [{ user_id: ada.id, display_name: "Ada" }, { user_id: "x", display_name: "X" }] }]);
    seed("crewPicks", { x: { [X]: true } });
    expect(app.goingTo(X)).toEqual([{ user_id: "x", display_name: "X" }]);
    expect(app.myCrews().map(c => c.name)).toEqual(["Seeded"]);
  });
  it("a kept map that holds the reader - one from before a change of owner - still never lists them", () => {
    seed("crewPicks", { [ada.id]: { [X]: true }, x: { [X]: true } });
    expect(app.goingTo(X)).toEqual([{ user_id: "x", display_name: "X" }]);
    expect(app.crewmatesByEvent().get(X)).toEqual([{ user_id: "x", display_name: "X" }]);
  });
  it("two crewmates of one name: by name, then by id", () => {
    seed("crew", [{ id: "c1", name: "Seeded", creator: "y", invite_token: "t",
      members: [{ user_id: ada.id, display_name: "Ada" }, { user_id: "y", display_name: "Sam" }, { user_id: "x", display_name: "Sam" }] }]);
    seed("crewPicks", { x: { [X]: true }, y: { [X]: true } });
    expect(app.goingTo(X)).toEqual([{ user_id: "x", display_name: "Sam" }, { user_id: "y", display_name: "Sam" }]);
  });
  it("a kept entry that is not a star is no one going, in every reader", () => {
    seed("crewPicks", { x: { [X]: true, [ids[1]]: false } });
    expect(app.goingTo(ids[1])).toEqual([]);
    expect([...app.crewmatesByEvent().keys()]).toEqual([X]);
    expect(app.crewmatePicks("x")).toEqual([X]);
  });
});
