/* Keep your plan: the backend's two constants, identity and the email step
   (DECISIONS #51, #53; docs/sync/contract.md, section 1, as built). With no
   backend the page sends nothing and keeps no session. With one - a fake of
   the Auth server, tests/helpers/backend.js - the email step reaches
   "signed in as" by every door, says each failure in plain words and
   leaves the plan alone, and every request is pinned as it is sent. A step
   that succeeds starts a sync run too (docs/sync/contract.md, section 5),
   whose requests sync.test.js pins; here the email step's conversation is
   read from the Auth requests, and "nothing else" names every kind the
   page sent. New tests, not rows of tests/PORT-LEDGER.md, so their titles
   carry no harness line. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { CODE, fakeBackend } from "../helpers/backend.js";

const el = id => document.getElementById(id);
const read = key => JSON.parse(window.localStorage.getItem(key));
const everything = () => Object.fromEntries(Object.keys(window.localStorage).map(k => [k, window.localStorage.getItem(k)]));
/* the requests to the Auth server alone: the email step's conversation */
const authOf = fake => fake.requests.filter(r => r.path.startsWith("/auth/"));

/* The email step as a reader drives it: a value typed into a field and its
   form sent, done when the step is no longer busy and the sync run it
   started has settled, so no run of one test meets the next one's knobs. */
async function step(page, form, field, value) {
  el(field).value = value;
  el(form).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await page.until(() => !el("keepSend").disabled, 5000, `the answer to ${form}`);
  await page.app.syncSettled();
}
const JSON_HEADERS = key => ({ apikey: key, "Content-Type": "application/json" });

describe("a build with no backend", () => {
  let page, app, handle, realFetch;
  const calls = [];

  beforeAll(async () => {
    realFetch = globalThis.fetch;
    globalThis.fetch = (...args) => { calls.push(args); return Promise.reject(new Error("no request should leave the page")); };
    page = await bootPage();
    ({ app, handle } = page);
  }, 30000);
  afterAll(async () => { await page.cleanup(); globalThis.fetch = realFetch; });

  it("is built with none", () => {
    expect(app.hasBackend).toBe(false);
  });
  it("sends nothing across a boot and a star, and keeps no session", () => {
    document.querySelector("#view-now .row .star").click();
    expect(Object.keys(window.localStorage)).toContain(`dc${app.YY}.picks`);
    expect(calls).toEqual([]);
    expect(window.localStorage.getItem(`dc${app.YY}.session`)).toBe(null);
  });
  it("shows no Keep your plan in Settings: the section is hidden and empty", () => {
    handle.openSheet("settings");
    expect(el("keep").hidden).toBe(true);
    expect(el("keep").children.length).toBe(0);
    handle.closeSheet();
  });
  it("refuses ensureUser() without a request", async () => {
    await expect(app.ensureUser()).rejects.toMatchObject({ code: "no_backend" });
    expect(calls).toEqual([]);
    expect(window.localStorage.getItem(`dc${app.YY}.session`)).toBe(null);
  });
});

describe("every request the page makes, exactly as it is sent", () => {
  let page, app, handle, fake, session;
  const requests = () => fake.requests, auth = () => authOf(fake);

  beforeAll(async () => {
    fake = fakeBackend();
    fake.held("ada@example.test");
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    handle.openSheet("settings");
  }, 30000);
  afterAll(() => page.cleanup());

  it("none before a tap that needs a user: the section is shown, and nothing is sent", () => {
    expect(app.hasBackend).toBe(true);
    expect(el("keep").hidden).toBe(false);
    expect(el("keep").querySelector("h3").textContent).toBe("Keep your plan");
    expect(requests()).toEqual([]);
  });
  it("anonymous sign-in: POST /auth/v1/signup, the public key and an empty body; the session kept under dc<yy>.session", async () => {
    session = await app.ensureUser();
    expect(requests()).toEqual([{ method: "POST", path: "/auth/v1/signup", headers: JSON_HEADERS(fake.key), body: {} }]);
    expect(read(`dc${app.YY}.session`)).toEqual(session);
    expect(session.user.is_anonymous).toBe(true);
  });
  it("add, with a token the server refuses: PUT /auth/v1/user as the user, a refresh, and the add once more with the fresh token", async () => {
    fake.refuse(session.access_token);
    await step(page, "keepEmailForm", "keepEmail", "new@example.test");
    const fresh = read(`dc${app.YY}.session`);
    expect(fresh.access_token).not.toBe(session.access_token);
    expect(fresh.user.id).toBe(session.user.id);
    expect(auth().slice(1)).toEqual([
      { method: "PUT", path: "/auth/v1/user", headers: { ...JSON_HEADERS(fake.key), Authorization: `Bearer ${session.access_token}` }, body: { email: "new@example.test" } },
      { method: "POST", path: "/auth/v1/token?grant_type=refresh_token", headers: JSON_HEADERS(fake.key), body: { refresh_token: session.refresh_token } },
      { method: "PUT", path: "/auth/v1/user", headers: { ...JSON_HEADERS(fake.key), Authorization: `Bearer ${fresh.access_token}` }, body: { email: "new@example.test" } },
    ]);
    expect(el("keepCodeForm").hidden).toBe(false);
    expect(el("keepSentTo").textContent).toBe("new@example.test");
    expect(el("keepNote").textContent).toBe("Check your email for the code.");
    session = fresh;
  });
  it("verify: POST /auth/v1/verify, email_change, with no token; the same user, now with the email", async () => {
    await step(page, "keepCodeForm", "keepCode", CODE);
    expect(auth().at(-1)).toEqual({ method: "POST", path: "/auth/v1/verify", headers: JSON_HEADERS(fake.key),
      body: { type: "email_change", email: "new@example.test", token: CODE } });
    const signedIn = read(`dc${app.YY}.session`);
    expect(signedIn.user).toEqual({ id: session.user.id, email: "new@example.test", is_anonymous: false });
    expect(el("keepIn").hidden).toBe(false);
    expect(el("keepOut").hidden).toBe(true);
    expect(el("keepWho").textContent).toBe("new@example.test");
    session = signedIn;
  });
  it("sign out: POST /auth/v1/logout?scope=local as the user, with no body", () => {
    el("keepSignOut").click();
    expect(auth().at(-1)).toEqual({ method: "POST", path: "/auth/v1/logout?scope=local",
      headers: { apikey: fake.key, Authorization: `Bearer ${session.access_token}` }, body: undefined });
  });
  it("recover, with no session: POST /auth/v1/otp, create_user false, then verify with type email; signed in as the address's user", async () => {
    const before = auth().length;
    await step(page, "keepEmailForm", "keepEmail", "ada@example.test");
    await step(page, "keepCodeForm", "keepCode", CODE);
    expect(auth().slice(before)).toEqual([
      { method: "POST", path: "/auth/v1/otp", headers: JSON_HEADERS(fake.key), body: { email: "ada@example.test", create_user: false } },
      { method: "POST", path: "/auth/v1/verify", headers: JSON_HEADERS(fake.key), body: { type: "email", email: "ada@example.test", token: CODE } },
    ]);
    expect(read(`dc${app.YY}.session`).user).toMatchObject({ email: "ada@example.test", is_anonymous: false });
    expect(el("keepWho").textContent).toBe("ada@example.test");
  });
  it("and nothing else: the email step's six requests and a sync run's three reads, every one to the backend's address", () => {
    const kind = r => `${r.method} ${r.path.startsWith("/rest/") ? r.path.split("?")[0] : r.path}`;
    expect(new Set(requests().map(kind))).toEqual(new Set([
      "POST /auth/v1/signup", "PUT /auth/v1/user", "POST /auth/v1/token?grant_type=refresh_token",
      "POST /auth/v1/verify", "POST /auth/v1/logout?scope=local", "POST /auth/v1/otp",
      "GET /rest/v1/crews", "GET /rest/v1/picks", "GET /rest/v1/follows",
    ]));
  });
});

describe("the email step, from no session to signed in", () => {
  let page, app, handle, fake;

  beforeAll(async () => {
    fake = fakeBackend();
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    document.querySelector("#view-now .row .star").click();
    handle.openSheet("settings");
  }, 30000);
  afterAll(() => page.cleanup());

  it("an address no one holds, with no session: recover finds no one, so the phone mints a user and adds it - one screen, one code", async () => {
    await step(page, "keepEmailForm", "keepEmail", "  new@example.test ");
    const auth = authOf(fake);
    expect(auth.map(r => `${r.method} ${r.path}`)).toEqual(["POST /auth/v1/otp", "POST /auth/v1/signup", "PUT /auth/v1/user"]);
    expect(auth[0].body).toEqual({ email: "new@example.test", create_user: false });
    const minted = read(`dc${app.YY}.session`);
    expect(minted.user.is_anonymous).toBe(true);
    expect(auth[2].headers.Authorization).toBe(`Bearer ${minted.access_token}`);
    expect(el("keepSentTo").textContent).toBe("new@example.test");
  });
  it("an anonymous user is offered no Sign out, and signOut() leaves it be", () => {
    expect(el("keepIn").hidden).toBe(true);
    const before = window.localStorage.getItem(`dc${app.YY}.session`), sent = fake.requests.length;
    app.signOut();
    expect(window.localStorage.getItem(`dc${app.YY}.session`)).toBe(before);
    expect(fake.requests.length).toBe(sent);
  });
  it("a wrong code is said in plain words, and nothing is signed in", async () => {
    await step(page, "keepCodeForm", "keepCode", "000000");
    expect(el("keepNote").textContent).toBe("That code is wrong or has expired. Check it, or send a new one.");
    expect(el("keepIn").hidden).toBe(true);
    expect(read(`dc${app.YY}.session`).user.is_anonymous).toBe(true);
  });
  it("a code that is not six digits is refused before anything is sent", async () => {
    const sent = fake.requests.length;
    await step(page, "keepCodeForm", "keepCode", "12 34");
    expect(el("keepNote").textContent).toBe("Enter the six-digit code from the email.");
    expect(fake.requests.length).toBe(sent);
  });
  it("the right code reaches signed in as the address", async () => {
    await step(page, "keepCodeForm", "keepCode", ` ${CODE} `);
    expect(el("keepWho").textContent).toBe("new@example.test");
    expect(el("keepIn").hidden).toBe(false);
    expect(el("keepNote").textContent).toBe("");
    expect(read(`dc${app.YY}.session`).user).toMatchObject({ email: "new@example.test", is_anonymous: false });
  });
  it("Sign out removes the session key and sync's own four, and nothing of the plan", () => {
    const gone = ["session", "outbox", "syncStamp", "crew", "crewPicks"].map(name => `dc${app.YY}.${name}`);
    const before = everything();
    el("keepSignOut").click();
    const after = everything();
    expect(Object.keys(before)).toEqual(expect.arrayContaining(gone));
    for (const key of gone) delete before[key];
    expect(after).toEqual(before);
    expect(Object.keys(after)).toContain(`dc${app.YY}.picks`);
    expect(el("keepOut").hidden).toBe(false);
    expect(el("keepNote").textContent).toBe("Signed out. Your plan stays on this phone.");
  });
});

describe("recover from an anonymous session", () => {
  let page, app, handle, fake, held;

  beforeAll(async () => {
    fake = fakeBackend();
    held = fake.held("ada@example.test");
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    handle.openSheet("settings");
  }, 30000);
  afterAll(() => page.cleanup());

  it("add answers that someone holds the address, so the step falls through to recover, and the phone signs in as them", async () => {
    const anonymous = await app.ensureUser();
    await step(page, "keepEmailForm", "keepEmail", "ada@example.test");
    expect(authOf(fake).map(r => `${r.method} ${r.path}`)).toEqual(["POST /auth/v1/signup", "PUT /auth/v1/user", "POST /auth/v1/otp"]);
    await step(page, "keepCodeForm", "keepCode", CODE);
    expect(authOf(fake).at(-1).body).toEqual({ type: "email", email: "ada@example.test", token: CODE });
    const session = read(`dc${app.YY}.session`);
    expect(session.user).toEqual({ id: held.id, email: "ada@example.test", is_anonymous: false });
    expect(session.user.id).not.toBe(anonymous.user.id);
    expect(el("keepWho").textContent).toBe("ada@example.test");
  });
});

describe("ensureUser()", () => {
  let page, app, fake;

  beforeAll(async () => {
    fake = fakeBackend();
    page = await bootPage({ backend: fake });
    ({ app } = page);
  }, 30000);
  afterAll(() => page.cleanup());

  it("makes one sign-in request however often it is asked, at once or after", async () => {
    const [a, b, c] = await Promise.all([app.ensureUser(), app.ensureUser(), app.ensureUser()]);
    const d = await app.ensureUser();
    expect(fake.to("/auth/v1/signup").length).toBe(1);
    expect(new Set([a, b, c, d].map(s => s.user.id)).size).toBe(1);
    expect(fake.requests.length).toBe(1);
  });
});

describe("a session lost on the way", () => {
  let page, app, handle, fake;

  beforeAll(async () => {
    fake = fakeBackend();
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    handle.openSheet("settings");
  }, 30000);
  afterAll(() => page.cleanup());

  it("an anonymous user whose refresh is refused is dropped, and the step starts again with no session", async () => {
    const lost = await app.ensureUser();
    fake.refuse(lost.access_token);
    fake.revoke(lost.refresh_token);
    await step(page, "keepEmailForm", "keepEmail", "new@example.test");
    expect(authOf(fake).map(r => `${r.method} ${r.path}`)).toEqual(["POST /auth/v1/signup", "PUT /auth/v1/user",
      "POST /auth/v1/token?grant_type=refresh_token", "POST /auth/v1/otp", "POST /auth/v1/signup", "PUT /auth/v1/user"]);
    const session = read(`dc${app.YY}.session`);
    expect(session.user.id).not.toBe(lost.user.id);
    expect(el("keepSentTo").textContent).toBe("new@example.test");
  });
});

describe("a refused token, and another tab", () => {
  let page, app, handle, fake, session;
  const SESSION = () => `dc${app.YY}.session`;
  const keep = s => window.localStorage.setItem(SESSION(), JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token,
    user: { id: s.user.id, email: s.user.email, is_anonymous: s.user.is_anonymous } }));
  const sent = from => authOf(fake).slice(from).map(r => `${r.method} ${r.path} ${r.headers.Authorization || ""}`.trim());

  beforeAll(async () => {
    fake = fakeBackend();
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    handle.openSheet("settings");
    session = await app.ensureUser();
  }, 30000);
  afterAll(() => page.cleanup());

  it("a token another tab has refreshed already is used as it stands, with no refresh of this tab's own", async () => {
    const other = fake.issue(session.user.id), from = authOf(fake).length;
    fake.refuse(session.access_token);
    fake.onRequest = r => { if (r.path === "/auth/v1/user" && r.headers.Authorization === `Bearer ${session.access_token}`) keep(other); };
    await step(page, "keepEmailForm", "keepEmail", "new@example.test");
    fake.onRequest = null;
    expect(sent(from)).toEqual([`PUT /auth/v1/user Bearer ${session.access_token}`, `PUT /auth/v1/user Bearer ${other.access_token}`]);
    expect(read(SESSION()).access_token).toBe(other.access_token);
    session = read(SESSION());
  });
  it("a refresh refused while another tab refreshed meanwhile takes that tab's session, and drops nothing", async () => {
    const other = fake.issue(session.user.id), from = authOf(fake).length;
    fake.refuse(session.access_token);
    fake.revoke(session.refresh_token);
    fake.onRequest = r => { if (r.path.startsWith("/auth/v1/token")) keep(other); };
    await step(page, "keepEmailForm", "keepEmail", "second@example.test");
    fake.onRequest = null;
    expect(sent(from)).toEqual([`PUT /auth/v1/user Bearer ${session.access_token}`, "POST /auth/v1/token?grant_type=refresh_token",
      `PUT /auth/v1/user Bearer ${other.access_token}`]);
    expect(read(SESSION()).access_token).toBe(other.access_token);
    expect(el("keepSentTo").textContent).toBe("second@example.test");
    session = read(SESSION());
  });
  it("a refresh that cannot reach the server keeps the session, and says the phone is offline", async () => {
    fake.refuse(session.access_token);
    fake.offline = r => r.path.startsWith("/auth/v1/token");
    await step(page, "keepEmailForm", "keepEmail", "third@example.test");
    fake.offline = false;
    expect(el("keepNote").textContent).toBe("Couldn't reach the server. Your plan is safe on this phone; try again when you have signal.");
    expect(read(SESSION())).toEqual(session);
  });
});

describe("a second tap while a request is out", () => {
  let page, handle, fake;

  beforeAll(async () => {
    fake = fakeBackend();
    fake.held("ada@example.test");
    page = await bootPage({ backend: fake });
    ({ handle } = page);
    handle.openSheet("settings");
  }, 30000);
  afterAll(() => page.cleanup());

  it("does nothing: one code asked for", async () => {
    el("keepEmail").value = "ada@example.test";
    const send = () => el("keepEmailForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    send();
    send();
    await page.until(() => !el("keepSend").disabled, 5000, "the answer");
    expect(fake.requests.map(r => `${r.method} ${r.path}`)).toEqual(["POST /auth/v1/otp"]);
  });
});

describe("failures, in plain words, with the plan left alone", () => {
  let page, app, handle, fake, plan;
  const note = () => el("keepNote").textContent;

  beforeAll(async () => {
    fake = fakeBackend();
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    document.querySelector("#view-now .row .star").click();
    plan = everything();
    handle.openSheet("settings");
  }, 30000);
  afterAll(() => page.cleanup());

  it("an address that is not one is refused before anything is sent", async () => {
    await step(page, "keepEmailForm", "keepEmail", "not an address");
    expect(note()).toBe("That doesn't look like an email address.");
    expect(fake.requests).toEqual([]);
  });
  it("offline: said so, and nothing kept", async () => {
    fake.offline = true;
    await step(page, "keepEmailForm", "keepEmail", "new@example.test");
    fake.offline = false;
    expect(note()).toBe("Couldn't reach the server. Your plan is safe on this phone; try again when you have signal.");
    expect(everything()).toEqual(plan);
  });
  it("anonymous sign-ins switched off: said so, and no session", async () => {
    fake.anonymousOff = true;
    await step(page, "keepEmailForm", "keepEmail", "new@example.test");
    fake.anonymousOff = false;
    expect(fake.requests.slice(-2).map(r => r.path)).toEqual(["/auth/v1/otp", "/auth/v1/signup"]);
    expect(note()).toBe("Signing in is switched off for now. Please try again later.");
    expect(everything()).toEqual(plan);
  });
  it("a captcha the project demands: a plain message, and no widget", async () => {
    fake.captcha = true;
    const ids = () => [...el("keep").querySelectorAll("[id]")].map(e => e.id), section = ids(), scripts = document.scripts.length;
    await step(page, "keepEmailForm", "keepEmail", "new@example.test");
    expect(note()).toBe("Signing in needs a check this app can't show yet. Please try again later.");
    await expect(app.ensureUser()).rejects.toMatchObject({ code: "captcha_failed" });
    fake.captcha = false;
    expect(ids()).toEqual(section);
    expect(document.scripts.length).toBe(scripts);
    expect(document.querySelectorAll("iframe").length).toBe(0);
    expect(everything()).toEqual(plan);
  });
  it("every other failure has words too", () => {
    expect(app.plainMessage({ code: "over_email_send_rate_limit" })).toBe("A code went to that address a moment ago. Wait a minute before asking for another.");
    expect(app.plainMessage({ code: "session_lost" })).toBe("You were signed out. Enter your email to sign in again.");
    expect(app.plainMessage({ code: "something_new" })).toBe("Something went wrong. Please try again.");
  });
});

describe("a backend on a page stamped with a channel", () => {
  let page, app, fake;

  beforeAll(async () => {
    fake = fakeBackend();
    page = await bootPage({ backend: fake, channel: "next", build: "abc1234" });
    ({ app } = page);
  }, 30000);
  afterAll(() => page.cleanup());

  it("keeps the session under dc<yy>.session.next, and nothing under the live site's key", async () => {
    await app.ensureUser();
    expect(read(`dc${app.YY}.session.next`).user.is_anonymous).toBe(true);
    expect(window.localStorage.getItem(`dc${app.YY}.session`)).toBe(null);
    expect(Object.keys(window.localStorage).filter(k => !k.endsWith(".next"))).toEqual([]);
  });
});
