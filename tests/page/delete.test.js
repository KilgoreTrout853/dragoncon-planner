/* Delete my account (W45; DECISIONS #93; docs/screens/contract.md, section
   9): the about panel's last part on a build with a backend. Its words by
   the session, the confirm's by the crews the reader started, one request
   pinned as sent, and what it leaves: no session and none of sync's keys,
   the plan as it was. A failure says so and changes nothing. With the
   server a fake, tests/helpers/backend.js, which deletes as the database's
   function does. The panel's other words, and that a build with no backend
   has no Delete, are about.test.js's. New tests, not rows of
   tests/PORT-LEDGER.md, so their titles carry no harness line. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { fakeBackend } from "../helpers/backend.js";
import { YY } from "../../src/season.js";

const fixture = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sample-events.json"), "utf8"));
const SAT = fixture.events.filter(e => e.start >= "2026-09-05T14" && e.start < "2026-09-05T20").map(e => e.id).slice(0, 3);

const RPC = "/rest/v1/rpc/delete_my_account";
const REMOVES = "Removes what the server keeps for you: your picks and follows, your sign-in, with your email if you added one, and your place in every crew. A crew you started goes too if no one else is in it; otherwise it stays for its members, with no one to manage it - delete the crew first if you want it gone. Your plan stays on this phone; Remove all picks clears its picks. It cannot reach the logs the companies above keep.";
const SIGN_IN_FIRST = "To delete what the server keeps for you, sign in first - Settings, Keep your plan - then come back here. If you never started or joined a crew and never entered an email, it keeps nothing.";
const ASK_ACCOUNT = "Delete your account? Your picks, follows, email and place in every crew are removed from the server. This can't be undone. Your plan stays on this phone.";
const ASK_DATA = "Delete your data from the server? Your picks, follows and place in every crew are removed. This can't be undone. Your plan stays on this phone.";
const DELETED = "Deleted. Your picks, follows and sign-in are off the server. Your plan is still on this phone.";
const OFFLINE = "Couldn't reach the server. Your plan is safe on this phone; try again when you have signal.";
const WENT_WRONG = "Something went wrong. Please try again.";
const SIGNED_OUT = "You were signed out. Enter your email to sign in again.";

const KEY = name => `dc${YY}.${name}`;
const raw = name => window.localStorage.getItem(KEY(name));
const seed = (name, value) => window.localStorage.setItem(KEY(name), JSON.stringify(value));
const everything = () => Object.fromEntries(Object.keys(window.localStorage).sort().map(k => [k, window.localStorage.getItem(k)]));
/* What is the reader's own and never sync's: the plan, and the settings. */
const PLAN = ["picks", "pickInfo", "follows", "mutes", "settings"];
const plan = () => Object.fromEntries(PLAN.map(name => [name, raw(name)]));
const SYNCS = ["session", "outbox", "syncStamp", "crew", "crewPicks"];
const syncs = () => Object.fromEntries(SYNCS.map(name => [name, raw(name)]));
const NONE = Object.fromEntries(SYNCS.map(name => [name, null]));

const el = id => document.getElementById(id);
const text = node => (node ? node.textContent.replace(/\s+/g, " ").trim() : "");
const shown = node => !!node && !node.hidden && !node.closest("[hidden]");
const part = () => [...el("aboutDelete").querySelectorAll("h4, p, button")].map(node => [node.tagName, text(node)]);
const tapTab = tab => document.querySelector(`.nav button[data-tab="${tab}"]`).click();
function press(node) { node.focus(); node.click(); }
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/* A session for a user of the fake's, kept as the page keeps one. */
function signIn(fake, user) {
  const s = fake.issue(user.id);
  seed("session", { access_token: s.access_token, refresh_token: s.refresh_token,
    user: { id: user.id, email: user.email || "", is_anonymous: user.is_anonymous } });
  return s;
}
/* An anonymous user, minted as the page mints one. */
async function mint(fake) {
  const res = await fake.fetch(`${fake.url}/auth/v1/signup`, { method: "POST", headers: { apikey: fake.key, "Content-Type": "application/json" }, body: "{}" });
  const s = JSON.parse(await res.text());
  seed("session", { access_token: s.access_token, refresh_token: s.refresh_token, user: { id: s.user.id, email: "", is_anonymous: true } });
  return s;
}
/* A reader's own plan on the phone: three picks, a follow, a mute, a setting. */
function seedPlan() {
  seed("picks", SAT);
  seed("follows", [{ kind: "track", key: "Animation" }]);
  seed("mutes", [{ kind: "track", key: "Main Programming" }]);
  seed("settings", { crowd: 1.5, hideNoise: true });
}
function openAbout(handle) {
  while (!el("sheetWrap").hidden) handle.closeSheet();
  el("settingsBtn").click();
  el("aboutRow").click();
}
/* The tap, answered, and its request back: the part is no longer busy, and
   no run or drain is under way or kept. */
async function settled(page) {
  await page.until(() => !el("aboutDeleteBtn") || !el("aboutDeleteBtn").disabled, 5000, "the delete's answer");
  await page.app.syncSettled();
}

describe("Delete, with a backend and no session", () => {
  let page, fake;

  beforeAll(async () => {
    fake = fakeBackend();
    seedPlan();
    page = await bootPage({ backend: fake });
    openAbout(page.handle);
  }, 30000);
  afterAll(() => page.cleanup());

  it("stands last in the body: the label and the sentence that says to sign in first", () => {
    expect(el("aboutBody").lastElementChild).toBe(el("aboutDelete"));
    expect(part()).toEqual([["H4", "Delete"], ["P", SIGN_IN_FIRST]]);
  });
  it("with no button, and nothing said under it", () => {
    expect(el("aboutDeleteBtn")).toBe(null);
    expect(el("aboutDelete").querySelectorAll("button, a, input").length).toBe(0);
    expect(el("aboutDeleteNote").textContent).toBe("");
  });
  it("and asks the server for nothing", async () => {
    await page.app.syncSettled();
    expect(fake.requests).toEqual([]);
  });
});

describe("Delete, signed in with an email", () => {
  let page, app, handle, fake, ada, bo, session, answer = false;
  const asked = [];
  const crewNames = () => fake.rows("crews").map(c => c.name).sort();

  beforeAll(async () => {
    fake = fakeBackend();
    [ada, bo] = ["ada", "bo"].map(n => fake.held(`${n}@example.test`));
    fake.crew({ name: "Just me", creator: ada.id, members: [[ada.id, "Ada"]] });
    fake.crew({ name: "Bo made this", creator: bo.id, members: [[bo.id, "Bo"], [ada.id, "Ada"]] });
    fake.write(bo.id, "picks", { event_id: SAT[0], picked: true, changed_at: new Date().toISOString() });
    session = signIn(fake, ada);
    seedPlan();
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    window.confirm = message => { asked.push(message); return answer; };
    openAbout(handle);
  }, 30000);
  afterAll(() => page.cleanup());

  it("the phone's whole plan went up at the first run, so the server holds what Delete removes", () => {
    expect(fake.rows("picks").filter(r => r.user_id === ada.id).map(r => r.event_id).sort()).toEqual([...SAT].sort());
    expect(fake.rows("follows").filter(r => r.user_id === ada.id).length).toBe(1);
    expect(JSON.parse(raw("crew")).map(c => c.name)).toEqual(["Just me", "Bo made this"]);
    for (const name of SYNCS) expect(raw(name), name).not.toBe(null);
  });
  it("the part: the label, what Delete removes, and the button, Delete my account", () => {
    expect(el("aboutBody").lastElementChild).toBe(el("aboutDelete"));
    expect(part()).toEqual([["H4", "Delete"], ["P", REMOVES], ["BUTTON", "Delete my account"]]);
  });
  it("the button is the danger button, alone on its row, and the note under it is a status with nothing said", () => {
    const button = el("aboutDeleteBtn");
    expect([...button.classList]).toEqual(["btn", "danger"]);
    expect(button.getAttribute("type")).toBe("button");
    expect([...button.parentElement.children]).toEqual([button]);
    expect(button.parentElement.nextElementSibling).toBe(el("aboutDeleteNote"));
    expect(el("aboutDeleteNote").getAttribute("role")).toBe("status");
    expect(el("aboutDeleteNote").textContent).toBe("");
  });
  it("opening the panel asked the server for nothing more", async () => {
    const before = fake.requests.length;
    openAbout(handle);
    await app.syncSettled();
    expect(fake.requests.length).toBe(before);
  });

  describe("the confirm", () => {
    async function ask() {
      asked.length = 0;
      await app.runSync();
      openAbout(handle);
      press(el("aboutDeleteBtn"));
      return asked;
    }

    it("alone in the crew they started, and in one someone else did: the question, and no crew named", async () => {
      expect(await ask()).toEqual([ASK_ACCOUNT]);
    });
    it("a no sends nothing and changes nothing", async () => {
      const before = { requests: fake.requests.length, kept: everything() };
      asked.length = 0;
      press(el("aboutDeleteBtn"));
      await tick();
      await app.syncSettled();
      expect(asked.length).toBe(1);
      expect(fake.requests.length).toBe(before.requests);
      expect(everything()).toEqual(before.kept);
      expect(fake.users.has(ada.id)).toBe(true);
      expect(part()).toEqual([["H4", "Delete"], ["P", REMOVES], ["BUTTON", "Delete my account"]]);
      expect(el("aboutDeleteBtn").disabled).toBe(false);
      expect(el("aboutDeleteNote").textContent).toBe("");
    });
    it("one crew started with someone else in it: named after a blank line, it stays", async () => {
      fake.crew({ name: "Con crew", creator: ada.id, members: [[ada.id, "Ada"], [bo.id, "Bo"]] });
      expect(await ask()).toEqual([`${ASK_ACCOUNT}\n\nYou started Con crew. It stays for its members, with no one to manage it. Delete the crew first if you want it gone.`]);
    });
    it("two: both named, they stay", async () => {
      fake.crew({ name: "Dinner", creator: ada.id, members: [[ada.id, "Ada"], [bo.id, "Bo"]] });
      expect(await ask()).toEqual([`${ASK_ACCOUNT}\n\nYou started Con crew and Dinner. They stay for their members, with no one to manage them. Delete a crew first if you want it gone.`]);
    });
    it("three: a list, the oldest first", async () => {
      fake.crew({ name: "Parade", creator: ada.id, members: [[bo.id, "Bo"], [ada.id, "Ada"]] });
      expect(await ask()).toEqual([`${ASK_ACCOUNT}\n\nYou started Con crew, Dinner and Parade. They stay for their members, with no one to manage them. Delete a crew first if you want it gone.`]);
    });
  });

  describe("a yes", () => {
    let before, node;

    beforeAll(async () => {
      await app.runSync();
      await app.syncSettled();
      openAbout(handle);
      el("aboutBody").scrollTop = 120;
      node = el("aboutDelete");
      before = { requests: fake.requests.length, plan: plan(), syncs: syncs() };
      asked.length = 0;
      answer = true;
      fake.defer = r => r.path === RPC;
      press(el("aboutDeleteBtn"));
      await page.until(() => fake.to(RPC).length === 1, 5000, "the request");
    }, 30000);

    it("sends one request, as the user: the fourth RPC, with no argument", () => {
      expect(asked.length).toBe(1);
      expect(fake.requests.slice(before.requests)).toEqual([{ method: "POST", path: RPC,
        headers: { apikey: fake.key, "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: {} }]);
    });
    it("while it is out the button is busy: a second tap asks nothing and sends nothing", async () => {
      expect(el("aboutDeleteBtn").disabled).toBe(true);
      el("aboutDeleteBtn").disabled = false;      // a tap that reaches the handler all the same
      press(el("aboutDeleteBtn"));
      await tick();
      expect(asked.length).toBe(1);
      expect(fake.to(RPC).length).toBe(1);
      expect(fake.requests.length).toBe(before.requests + 1);
      expect(syncs()).toEqual(before.syncs);
    });
    it("answered, the session is gone and sync's keys with it: the outbox, the watermark, the crews", async () => {
      fake.defer = null;
      fake.release();
      await settled(page);
      expect(before.syncs.session).not.toBe(null);
      expect(JSON.parse(before.syncs.crew).length).toBe(5);
      expect(syncs()).toEqual(NONE);
      expect(app.storedSession()).toBe(null);
      expect(app.myCrews()).toEqual([]);
    });
    it("the picks, the follows, the mutes and the settings are as they were", () => {
      expect(JSON.parse(before.plan.picks).sort()).toEqual([...SAT].sort());
      expect(plan()).toEqual(before.plan);
      expect([...handle.picks.get()].sort()).toEqual([...SAT].sort());
    });
    it("the part is written in place: the button gone, and the note in its place says it is done", () => {
      expect(el("aboutDelete")).toBe(node);
      expect(el("aboutDeleteBtn")).toBe(null);
      expect(part()).toEqual([["H4", "Delete"], ["P", REMOVES]]);
      expect(text(el("aboutDeleteNote"))).toBe(DELETED);
      expect(el("aboutDeleteNote").getAttribute("role")).toBe("status");
      expect(el("aboutDeleteNote").previousElementSibling.tagName).toBe("P");
    });
    it("focus is on the note, and the body is scrolled where it was", () => {
      expect(document.activeElement).toBe(el("aboutDeleteNote"));
      expect(el("aboutBody").scrollTop).toBe(120);
      expect(shown(el("panel-about"))).toBe(true);
    });
    it("on the server the user is gone, with their picks, their follows and their place in every crew", () => {
      expect(fake.users.has(ada.id)).toBe(false);
      expect(fake.users.has(bo.id)).toBe(true);
      expect(fake.rows("picks").map(r => r.user_id)).toEqual([bo.id]);
      expect(fake.rows("follows")).toEqual([]);
      expect(fake.rows("crews").flatMap(c => c.members.map(m => m.user_id))).toEqual([bo.id, bo.id, bo.id, bo.id]);
    });
    it("the crew they were alone in went with them; the three with someone else stay, with no creator", () => {
      expect(crewNames()).toEqual(["Bo made this", "Con crew", "Dinner", "Parade"]);
      expect(fake.rows("crews").map(c => [c.name, c.creator]).sort()).toEqual([["Bo made this", bo.id], ["Con crew", null], ["Dinner", null], ["Parade", null]]);
    });
    it("nothing else was sent: no run and no drain followed it", () => {
      expect(fake.requests.length).toBe(before.requests + 1);
    });
    it("Back to Settings shows Keep your plan's email form, not Signed in as", () => {
      el("aboutBack").click();
      expect(shown(el("panel-settings"))).toBe(true);
      expect(shown(el("keepOut"))).toBe(true);
      expect(shown(el("keepEmailForm"))).toBe(true);
      expect(shown(el("keepIn"))).toBe(false);
      expect(shown(el("keepSignOut"))).toBe(false);
      expect(el("keepWho").textContent).toBe("");
      expect(el("keepNote").textContent).toBe("");
      expect(shown(el("keepSync"))).toBe(false);
    });
    it("the about panel opened again has no session: the sentence, and no button", () => {
      el("aboutRow").click();
      expect(part()).toEqual([["H4", "Delete"], ["P", SIGN_IN_FIRST]]);
      expect(el("aboutDeleteBtn")).toBe(null);
      expect(el("aboutDeleteNote").textContent).toBe("");
    });
    it("Plans' header is the rung: Start a crew", async () => {
      handle.closeSheet();
      handle.closeSheet();
      tapTab("plans");
      await app.syncSettled();
      expect(el("view-plans").querySelector(".crew-head.crew-rung")).not.toBe(null);
      expect(text(el("crewStartBtn"))).toBe("Start a crew");
    });
    it("a star afterwards is kept on the phone and sends nothing", async () => {
      const had = handle.picks.get().size;
      tapTab("now");
      document.querySelector("#view-now .row .star").click();
      await tick();
      await app.syncSettled();
      expect(handle.picks.get().size).not.toBe(had);
      expect(raw("outbox")).toBe(null);
      expect(fake.requests.length).toBe(before.requests + 1);
    });
  });
});

describe("Delete, as an anonymous user", () => {
  let page, app, handle, fake, session;
  const asked = [];

  beforeAll(async () => {
    fake = fakeBackend();
    session = await mint(fake);
    fake.crew({ name: "Mine alone", creator: session.user.id, members: [[session.user.id, "Me"]] });
    seedPlan();
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    window.confirm = message => { asked.push(message); return true; };
    /* a code sent and not yet confirmed: the email step waits on it */
    handle.openSheet("settings");
    el("keepEmail").value = "me@example.test";
    el("keepEmailForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await page.until(() => !el("keepSend").disabled, 5000, "the code's sending");
    await app.syncSettled();
    openAbout(handle);
  }, 30000);
  afterAll(() => page.cleanup());

  it("the button says Delete my data from the server, over the same words", () => {
    expect(app.signedInAs()).toBe("");
    expect(app.codeSentTo()).toBe("me@example.test");
    expect(part()).toEqual([["H4", "Delete"], ["P", REMOVES], ["BUTTON", "Delete my data from the server"]]);
  });
  it("the confirm asks about the data, names no email, and names no crew the reader is alone in", async () => {
    press(el("aboutDeleteBtn"));
    await settled(page);
    expect(asked).toEqual([ASK_DATA]);
  });
  it("a yes deletes them: one request, the user and their crew gone from the server, the session and sync's keys from the phone", () => {
    expect(fake.to(RPC).map(r => r.headers.Authorization)).toEqual([`Bearer ${session.access_token}`]);
    expect(fake.users.has(session.user.id)).toBe(false);
    expect(fake.rows("crews")).toEqual([]);
    expect(fake.rows("picks")).toEqual([]);
    expect(syncs()).toEqual(NONE);
  });
  it("the note says it is done, and the plan is still on the phone", () => {
    expect(text(el("aboutDeleteNote"))).toBe(DELETED);
    expect(document.activeElement).toBe(el("aboutDeleteNote"));
    expect(JSON.parse(raw("picks")).sort()).toEqual([...SAT].sort());
  });
  it("Back to Settings shows the email form, and the code that was waiting is forgotten", () => {
    el("aboutBack").click();
    expect(shown(el("keepEmailForm"))).toBe(true);
    expect(shown(el("keepIn"))).toBe(false);
    expect(app.codeSentTo()).toBe("");
    expect(shown(el("keepCodeForm"))).toBe(false);
  });
});

describe("Delete, when the request fails", () => {
  let page, app, handle, fake, ada, bo, session, before;
  const asked = [];

  /* A tap and a yes, answered; and that nothing on the phone or the server
     moved: the session, sync's keys, the plan, the user, the part. */
  async function tapYes() {
    asked.length = 0;
    press(el("aboutDeleteBtn"));
    await settled(page);
    expect(asked.length).toBe(1);
  }
  function asItWas(words) {
    expect(everything()).toEqual(before.kept);
    expect(el("aboutDelete")).toBe(before.node);
    expect(el("aboutDeleteBtn")).toBe(before.button);
    expect(el("aboutDeleteBtn").disabled).toBe(false);
    expect(document.activeElement).toBe(el("aboutDeleteBtn"));
    expect(part()).toEqual([["H4", "Delete"], ["P", REMOVES], ["BUTTON", "Delete my account"]]);
    expect(text(el("aboutDeleteNote"))).toBe(words);
    expect(el("aboutDeleteBtn").parentElement.nextElementSibling).toBe(el("aboutDeleteNote"));
    expect(app.signedInAs()).toBe("ada@example.test");
    expect(app.myCrews().map(c => c.name)).toEqual(["Con crew"]);
  }

  beforeAll(async () => {
    fake = fakeBackend();
    [ada, bo] = ["ada", "bo"].map(n => fake.held(`${n}@example.test`));
    fake.crew({ name: "Con crew", creator: ada.id, members: [[ada.id, "Ada"], [bo.id, "Bo"]] });
    session = signIn(fake, ada);
    seedPlan();
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    window.confirm = message => { asked.push(message); return true; };
    openAbout(handle);
    before = { kept: everything(), node: el("aboutDelete"), button: el("aboutDeleteBtn") };
  }, 30000);
  afterAll(() => page.cleanup());

  it("offline: plain words under the button, and everything as it was", async () => {
    fake.offline = true;
    await tapYes();
    fake.offline = false;
    asItWas(OFFLINE);
    expect(fake.users.has(ada.id)).toBe(true);
  });
  it("a second try clears the words while it is out", async () => {
    fake.defer = r => r.path === RPC;
    fake.fail = r => (r.path === RPC ? { status: 500, code: "XX000" } : null);
    const sentBefore = fake.to(RPC).length;
    press(el("aboutDeleteBtn"));
    await page.until(() => fake.to(RPC).length === sentBefore + 1, 5000, "the request");
    expect(el("aboutDeleteNote").textContent).toBe("");
    expect(el("aboutDeleteBtn").disabled).toBe(true);
    fake.defer = null;
    fake.release();
    await settled(page);
  });
  it("the server's error: plain words, and everything as it was", () => {
    fake.fail = null;
    asItWas(WENT_WRONG);
    expect(fake.users.has(ada.id)).toBe(true);
  });
  it("the function not there: the same", async () => {
    fake.fail = r => (r.path === RPC ? { status: 404, code: "PGRST202" } : null);
    await tapYes();
    fake.fail = null;
    asItWas(WENT_WRONG);
    expect(fake.users.has(ada.id)).toBe(true);
  });
  it("no failure started a run or a drain: each try was one request", () => {
    expect(fake.requests.slice(-3).map(r => r.path)).toEqual([RPC, RPC, RPC]);
  });
  it("an answer lost on the way back: the server has deleted, the phone says it could not reach it and keeps everything", async () => {
    const real = globalThis.fetch;
    globalThis.fetch = async (...args) => {
      const res = await real(...args);
      if (String(args[0]).endsWith(RPC)) throw new TypeError("Failed to fetch");
      return res;
    };
    try { await tapYes(); } finally { globalThis.fetch = real; }
    expect(fake.users.has(ada.id)).toBe(false);
    asItWas(OFFLINE);
  });
  it("tried again, the same call answers as the first did, and it is done", async () => {
    const sentBefore = fake.requests.length;
    await tapYes();
    expect(fake.requests.slice(sentBefore)).toEqual([{ method: "POST", path: RPC,
      headers: { apikey: fake.key, "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: {} }]);
    expect(text(el("aboutDeleteNote"))).toBe(DELETED);
    expect(el("aboutDeleteBtn")).toBe(null);
    expect(syncs()).toEqual(NONE);
    expect(JSON.parse(raw("picks")).sort()).toEqual([...SAT].sort());
  });
});

describe("Delete, with a session the server no longer knows", () => {
  let page, app, handle, fake, ada, session, before;

  beforeAll(async () => {
    fake = fakeBackend();
    ada = fake.held("ada@example.test");
    fake.crew({ name: "Just me", creator: ada.id, members: [[ada.id, "Ada"]] });
    session = signIn(fake, ada);
    seedPlan();
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    openAbout(handle);
    fake.refuse(session.access_token);
    fake.revoke(session.refresh_token);
    before = { plan: plan(), requests: fake.requests.length };
    press(el("aboutDeleteBtn"));
    await settled(page);
  }, 30000);
  afterAll(() => page.cleanup());

  it("the token refused and the refresh too: the request, the refresh, and no more", () => {
    expect(fake.requests.slice(before.requests).map(r => r.path)).toEqual([RPC, "/auth/v1/token?grant_type=refresh_token"]);
    expect(fake.users.has(ada.id)).toBe(true);
  });
  it("as Sign out has it: the session and sync's keys are gone, the plan kept", () => {
    expect(syncs()).toEqual(NONE);
    expect(plan()).toEqual(before.plan);
  });
  it("the part says to sign in first, with You were signed out under it and focus there", () => {
    expect(part()).toEqual([["H4", "Delete"], ["P", SIGN_IN_FIRST]]);
    expect(el("aboutDeleteBtn")).toBe(null);
    expect(text(el("aboutDeleteNote"))).toBe(SIGNED_OUT);
    expect(document.activeElement).toBe(el("aboutDeleteNote"));
  });
  it("and Keep your plan says the same over its email form", () => {
    el("aboutBack").click();
    expect(shown(el("keepEmailForm"))).toBe(true);
    expect(shown(el("keepIn"))).toBe(false);
    expect(el("keepNote").textContent).toBe(SIGNED_OUT);
  });
});

describe("Delete and sync: nothing crosses the request", () => {
  let page, app, handle, fake, ada, bo, before;
  const CREWS = r => r.method === "GET" && r.path.startsWith("/rest/v1/crews?");
  const since = () => fake.requests.slice(before).map(r => `${r.method} ${r.path.split("?")[0]}`);
  const star = at => document.querySelectorAll("#view-now .row .star")[at].click();

  async function arrive() {
    fake = fakeBackend();
    [ada, bo] = ["ada", "bo"].map(n => fake.held(`${n}@example.test`));
    fake.crew({ name: "Con crew", creator: ada.id, members: [[ada.id, "Ada"], [bo.id, "Bo"]] });
    signIn(fake, ada);
    seedPlan();
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    openAbout(handle);
  }

  describe("a run under way, a trigger and a star meanwhile, and a delete that is made", () => {
    beforeAll(arrive, 30000);
    afterAll(() => page.cleanup());

    it("the request waits for the run under way to finish", async () => {
      fake.defer = CREWS;
      before = fake.requests.length;
      app.runSync();
      await page.until(() => since().length === 1, 5000, "the run's first read");
      press(el("aboutDeleteBtn"));
      for (let i = 0; i < 5; i++) await tick();
      expect(since()).toEqual(["GET /rest/v1/crews"]);
      expect(el("aboutDeleteBtn").disabled).toBe(true);
      fake.defer = r => r.path === RPC;
      fake.release();
      await page.until(() => fake.to(RPC).length === 1, 5000, "the delete's request");
      expect(since()).toEqual(["GET /rest/v1/crews", "GET /rest/v1/picks", "GET /rest/v1/follows", `POST ${RPC}`]);
    });
    it("while it is out a trigger starts no run, and a star is kept and not sent", async () => {
      const sent = fake.requests.length, had = handle.picks.get().size;
      app.onSyncTrigger();
      star(0);
      for (let i = 0; i < 5; i++) await tick();
      expect(handle.picks.get().size).not.toBe(had);
      expect(Object.keys(JSON.parse(raw("outbox")).ops.picks).length).toBe(1);
      expect(fake.requests.length).toBe(sent);
    });
    it("made, the kept trigger's run and the waiting change find no session: nothing more is sent, and the star stays on the phone", async () => {
      const sent = fake.requests.length, picked = raw("picks");
      fake.defer = null;
      fake.release();
      await settled(page);
      for (let i = 0; i < 5; i++) await tick();
      await app.syncSettled();
      expect(text(el("aboutDeleteNote"))).toBe(DELETED);
      expect(fake.requests.length).toBe(sent);
      expect(syncs()).toEqual(NONE);
      expect(raw("picks")).toBe(picked);
      expect(fake.rows("picks")).toEqual([]);
    });
  });

  describe("a trigger and a star meanwhile, and a delete that fails", () => {
    beforeAll(arrive, 30000);
    afterAll(() => page.cleanup());

    it("the star's change is sent and the kept run made, once the failure is back - and not before", async () => {
      fake.defer = r => r.path === RPC;
      fake.fail = r => (r.path === RPC ? { status: 500, code: "XX000" } : null);
      before = fake.requests.length;
      press(el("aboutDeleteBtn"));
      await page.until(() => fake.to(RPC).length === 1, 5000, "the delete's request");
      app.onSyncTrigger();
      star(0);
      for (let i = 0; i < 5; i++) await tick();
      expect(since()).toEqual([`POST ${RPC}`]);
      fake.defer = null;
      fake.release();
      await settled(page);
      for (let i = 0; i < 5; i++) await tick();
      await app.syncSettled();
      fake.fail = null;
      expect(text(el("aboutDeleteNote"))).toBe(WENT_WRONG);
      expect(since().slice(0, 2)).toEqual([`POST ${RPC}`, "POST /rest/v1/picks"]);
      expect(since()).toContain("GET /rest/v1/crews");
      expect([...handle.picks.get()].sort()).not.toEqual([...SAT].sort());
      expect(fake.rows("picks").filter(r => r.user_id === ada.id && r.picked).map(r => r.event_id).sort()).toEqual([...handle.picks.get()].sort());
      expect(app.signedInAs()).toBe("ada@example.test");
    });
  });
});

describe("Delete, made on another phone signed in as the same user", () => {
  let page, app, handle, fake, ada, bo, session, before;

  beforeAll(async () => {
    fake = fakeBackend();
    [ada, bo] = ["ada", "bo"].map(n => fake.held(`${n}@example.test`));
    fake.crew({ name: "Con crew", creator: ada.id, members: [[ada.id, "Ada"], [bo.id, "Bo"]] });
    session = signIn(fake, ada);
    seedPlan();
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    before = { plan: plan() };
    fake.erase(ada.id);
  }, 30000);
  afterAll(() => page.cleanup());

  it("while its token is still read, a run comes back empty: the crew is forgotten, the session and the plan stay", async () => {
    expect(app.myCrews().map(c => c.name)).toEqual(["Con crew"]);
    await app.runSync();
    await app.syncSettled();
    expect(app.myCrews()).toEqual([]);
    expect(app.signedInAs()).toBe("ada@example.test");
    expect(plan()).toEqual(before.plan);
  });
  it("at its next refused token the session is lost: sync's keys forgotten, the plan kept", async () => {
    fake.refuse(session.access_token);
    const sent = fake.requests.length;
    await app.runSync();
    await app.syncSettled();
    expect(fake.requests.slice(sent).map(r => [r.path.split("?")[0], r.method])).toEqual([["/rest/v1/crews", "GET"], ["/auth/v1/token", "POST"]]);
    expect(syncs()).toEqual(NONE);
    expect(plan()).toEqual(before.plan);
    expect([...handle.picks.get()].sort()).toEqual([...SAT].sort());
  });
  it("and Keep your plan says You were signed out", () => {
    handle.openSheet("settings");
    expect(shown(el("keepEmailForm"))).toBe(true);
    expect(shown(el("keepIn"))).toBe(false);
    handle.closeSheet();
  });
});
