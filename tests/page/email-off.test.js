/* A build with a backend that leaves the email step off (DECISIONS #99):
   DC_EMAIL=off. Settings shows no Keep your plan; crews, sync and Delete
   are as built - a crew's first tap mints an anonymous user, and no email
   is asked; About this app's third wording is pinned here whole, as it was
   ruled, with the word "email" nowhere in the panel; and the device readout
   says the step is off, and what sync's line in Keep your plan would have.
   The page is built as the build defines it, by tests/helpers/page.js,
   against the fake backend, tests/helpers/backend.js. The build's guard is
   tests/unit/backend-env.test.js's. New tests, not rows of
   tests/PORT-LEDGER.md, so their titles carry no harness line. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { fakeBackend } from "../helpers/backend.js";
import { YEAR, YY } from "../../src/season.js";

const KEY = name => `dc${YY}.${name}`;
const read = name => JSON.parse(window.localStorage.getItem(KEY(name)));
const el = id => document.getElementById(id);
const text = node => (node ? node.textContent.replace(/\s+/g, " ").trim() : "");
const shown = node => !!node && !node.hidden && !node.closest("[hidden]");
const tapTab = tab => document.querySelector(`.nav button[data-tab="${tab}"]`).click();
function press(node) { node.focus(); node.click(); }
const submit = form => el(form).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
const sent = (fake, from = 0) => fake.requests.slice(from).map(r => `${r.method} ${r.path.split("?")[0]}`);
const words = () => [...el("aboutBody").querySelectorAll("p, h3, h4, li, a")].map(node => [node.tagName, text(node)]);
const part = () => [...el("aboutDelete").querySelectorAll("h4, p, button")].map(node => [node.tagName, text(node)]);
function openAbout(handle) {
  while (!el("sheetWrap").hidden) handle.closeSheet();
  el("settingsBtn").click();
  el("aboutRow").click();
}
async function crewSettled(page) {
  await page.until(() => !el("crewCreate").disabled, 5000, "the crew panel's request");
  await page.app.syncSettled();
}

const REMOVES = "Removes what the server keeps for you: your picks and follows, your sign-in, and your place in every crew. A crew you started goes too if no one else is in it; otherwise it stays for its members, with no one to manage it - delete the crew first if you want it gone. Your plan stays on this phone; Remove all picks clears its picks. It cannot reach the logs the companies above keep.";
const NOTHING_TO_DELETE = "Nothing to delete from here: this phone has no sign-in on the server. If you never started or joined a crew, the server keeps nothing for you.";
const ASK_DATA = "Delete your data from the server? Your picks, follows and place in every crew are removed. This can't be undone. Your plan stays on this phone.";
const DELETED = "Deleted. Your picks, follows and sign-in are off the server. Your plan is still on this phone.";
const WITH_THE_EMAIL_OFF = [
  ["P", "Unofficial. A planner for Dragon Con made by a fan, for friends. Not affiliated with or endorsed by Dragon Con."],
  ["P", "The schedule is read from the con's public schedule and can run behind it. The con's own is the last word."],
  ["H3", "Dragon Con's own"],
  ["P", "Hours, maps, policies, vendors and everything else:"],
  ["A", "Dragon Con's official site and app"],
  ["H3", "What we store"],
  ["H4", "On this phone"],
  ["P", "Your picks, what you follow and mute, your settings, and a copy of the schedule so the app opens without signal. Once you have a crew, also your sign-in, your crew - its names, its invite link and its picks - and any change still waiting to be sent. All of it is kept in this browser; clearing its site data removes it from this phone."],
  ["H4", "On our server"],
  ["P", "Nothing, until you start or join a crew. From then on the server keeps:"],
  ["LI", "your picks and follows, each with the time it last changed, the ones you took back included"],
  ["LI", "the name you gave each crew you're in and when you joined it, and any crew you started"],
  ["P", "Mutes and settings never leave this phone."],
  ["H4", "What your crew sees"],
  ["P", "The name you gave that crew, and your stars. Their phones are also told when you take a star back. Never your follows or your mutes."],
  ["H4", "What the controls do"],
  ["LI", "Remove all picks unstars everything. On the server each pick stays, marked unstarred."],
  ["LI", "Leave a crew, or delete one you started, and its members stop seeing your picks once their phones next sync."],
  ["H4", "Who else is involved"],
  ["P", "GitHub serves the app, Google serves the typeface and Supabase runs the server. Each sees your phone's internet address when it answers, as any website does, and may log it; Supabase keeps it, and what browser you used, with your sign-in. No ads, no analytics, no cookies, and the app never asks where you are."],
  ["H4", "Delete"],
  ["P", NOTHING_TO_DELETE],
];
/* What the panel must not say on such a build, whatever its state. */
const NO_EMAIL = /e-?mail|sign out|sign in again|sign in first|resend|keep your plan|\bcode\b/i;

describe("a build with a backend and the email step off", () => {
  let page, app, handle, fake;
  const asked = [];

  beforeAll(async () => {
    fake = fakeBackend();
    page = await bootPage({ backend: fake, email: "off" });
    ({ app, handle } = page);
    await app.syncSettled();
    window.confirm = message => { asked.push(message); return true; };
  }, 30000);
  afterAll(() => { while (!el("sheetWrap").hidden) handle.closeSheet(); return page.cleanup(); });

  it("has a backend, and no email step", () => {
    expect(app.hasBackend).toBe(true);
    expect(app.emailStep).toBe(false);
  });

  describe("Settings", () => {
    beforeAll(() => el("settingsBtn").click());
    afterAll(() => handle.closeSheet());

    it("shows no Keep your plan: its place is hidden and empty, and nothing asks for an address", () => {
      expect(el("keep").hidden).toBe(true);
      expect(el("keep").children.length).toBe(0);
      expect(el("panel-settings").querySelectorAll('input[type="email"], form').length).toBe(0);
      for (const id of ["keepEmail", "keepSend", "keepCode", "keepSignOut", "keepSync"]) expect(el(id), id).toBe(null);
    });
    it("the rest of it is as built, in its order: Advanced, About this app, Remove all picks", () => {
      const body = el("settingsBody");
      expect([...body.children].filter(shown).map(node => node.id || node.querySelector("[id]").id))
        .toEqual(["crowdLabel", "noiseDefault", "bigText", "advanced", "aboutRow", "resetPicks"]);
    });
    it("the readout says the step is off, before the build time, and no sync line while the phone has no user", () => {
      expect(text(el("deviceLine"))).toMatch(/ · email off · build \d{4}-\d\d-\d\d \d\d:\d\d UTC$/);
      expect(text(el("deviceLine"))).not.toMatch(/sync:|clock/);
    });
    it("and asked the server for nothing", () => {
      expect(fake.requests).toEqual([]);
    });
  });

  describe("About this app, with no session", () => {
    beforeAll(() => openAbout(handle));

    it("the third wording, whole: the backend's less the email, the sign-out and the company that sends the code", () => {
      expect(words()).toEqual(WITH_THE_EMAIL_OFF);
    });
    it("the word email is nowhere in the panel, nor Sign out, Resend or Keep your plan", () => {
      expect(text(el("panel-about"))).not.toMatch(NO_EMAIL);
    });
    it("the two controls it explains are in bold, with Unofficial", () => {
      expect([...el("aboutBody").querySelectorAll("b")].map(text)).toEqual(["Unofficial.", "Remove all picks", "Leave"]);
    });
    it("Delete is a sentence and no button: there is no sign-in to delete, and none to sign in with", () => {
      expect(part()).toEqual([["H4", "Delete"], ["P", NOTHING_TO_DELETE]]);
      expect([...el("panel-about").querySelectorAll("button")]).toEqual([el("aboutBack")]);
    });
  });

  describe("a crew made, as built", () => {
    beforeAll(async () => {
      while (!el("sheetWrap").hidden) handle.closeSheet();
      tapTab("plans");
      await app.syncSettled();
    });

    it("Plans offers the rung, as on any build with a backend", () => {
      expect(text(el("crewStartBtn"))).toBe("Start a crew");
      expect(text(el("crewJoinBtn"))).toBe("Join with a link");
    });
    it("Start a crew mints an anonymous user at its first tap, makes the crew, and no email is asked", async () => {
      press(el("crewStartBtn"));
      expect(el("panel-crew").querySelectorAll('input[type="email"]').length).toBe(0);
      expect(text(el("panel-crew"))).not.toMatch(/e-?mail/i);
      el("crewNewName").value = "Night owls";
      el("crewCreateMe").value = "Ada";
      submit("crewCreateForm");
      await crewSettled(page);
      expect(sent(fake).slice(0, 3)).toEqual(["POST /auth/v1/signup", "POST /rest/v1/rpc/create_crew", "GET /rest/v1/crews"]);
      expect(sent(fake).filter(line => line.includes("/auth/"))).toEqual(["POST /auth/v1/signup"]);
      expect(read("session").user).toMatchObject({ is_anonymous: true });
      expect(text(el("crewNote"))).toBe("Night owls is made. Share the link to bring people in.");
      expect(read("crew").map(c => c.name)).toEqual(["Night owls"]);
      expect(fake.rows("crews").map(c => c.name)).toEqual(["Night owls"]);
      el("closeSheetCrew").click();
    });
    it("the readout then says what sync's line in Keep your plan would have", () => {
      el("settingsBtn").click();
      expect(text(el("deviceLine"))).toMatch(/ · email off · sync: Synced just now · build \d{4}-/);
      expect(el("keep").hidden).toBe(true);
      expect(el("keep").children.length).toBe(0);
      handle.closeSheet();
    });
  });

  describe("Delete, as the anonymous user a crew minted", () => {
    beforeAll(() => openAbout(handle));

    it("the part: what Delete removes, with no email named, and the button an anonymous user's", () => {
      expect(part()).toEqual([["H4", "Delete"], ["P", REMOVES], ["BUTTON", "Delete my data from the server"]]);
      expect(text(el("panel-about"))).not.toMatch(NO_EMAIL);
    });
    it("one confirm, an anonymous user's, one request, and the words that it is done", async () => {
      const from = fake.requests.length;
      press(el("aboutDeleteBtn"));
      await page.until(() => !el("aboutDeleteBtn"), 5000, "the delete's answer");
      await app.syncSettled();
      expect(asked).toEqual([ASK_DATA]);
      expect(sent(fake, from)).toEqual(["POST /rest/v1/rpc/delete_my_account"]);
      expect(part()).toEqual([["H4", "Delete"], ["P", REMOVES]]);
      expect(text(el("aboutDeleteNote"))).toBe(DELETED);
      expect(window.localStorage.getItem(KEY("session"))).toBe(null);
      expect(fake.rows("crews")).toEqual([]);
    });
    it("still no email in the panel, and Keep your plan is not brought back by the delete", () => {
      expect(text(el("panel-about"))).not.toMatch(NO_EMAIL);
      el("aboutBack").click();
      expect(el("keep").hidden).toBe(true);
      expect(el("keep").children.length).toBe(0);
    });
    it("opened again with no session: the sentence, and no button", () => {
      openAbout(handle);
      expect(part()).toEqual([["H4", "Delete"], ["P", NOTHING_TO_DELETE]]);
      expect(words()).toEqual(WITH_THE_EMAIL_OFF);
    });
  });

  it("a session lost says to join again by the link, not to enter an email", () => {
    expect(app.plainMessage({ code: "session_lost" })).toBe("This phone lost its sign-in. Join your crew again by its link.");
    expect(app.crewMessage({ code: "session_lost" })).toBe("This phone lost its sign-in. Join your crew again by its link.");
  });
  it("the two refusals a crew's first tap can reach are as built", () => {
    expect(app.plainMessage({ code: "anonymous_provider_disabled" })).toBe("Signing in is switched off for now. Please try again later.");
    expect(app.plainMessage({ code: "captcha_failed" })).toBe("Signing in needs a check this app can't show yet. Please try again later.");
  });
});

describe("a build with the email step off, arriving by a tapped invite link", () => {
  let page, app, fake, crew;

  beforeAll(async () => {
    fake = fakeBackend();
    const bo = fake.held("bo@example.test");
    crew = fake.crew({ name: "The crew", creator: bo.id, members: [[bo.id, "Bo"]] });
    page = await bootPage({ backend: fake, email: "off", url: `https://example.test/?now=2026-09-05T13:05&join=${YEAR}.${crew.invite_token}` });
    ({ app } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => { while (!el("sheetWrap").hidden) page.handle.closeSheet(); return page.cleanup(); });

  it("opens on Plans under the join step, as built, with nothing sent", () => {
    expect(page.handle.state.tab).toBe("plans");
    expect(text(el("sheetTitleCrew"))).toBe("Join a crew");
    expect(fake.requests).toEqual([]);
  });
  it("Join mints an anonymous user and joins: both members, and no email asked", async () => {
    expect(el("panel-crew").querySelectorAll('input[type="email"]').length).toBe(0);
    el("crewJoinMe").value = "Ada";
    submit("crewJoinForm");
    await crewSettled(page);
    expect(sent(fake).slice(0, 3)).toEqual(["POST /auth/v1/signup", "POST /rest/v1/rpc/join_crew", "GET /rest/v1/crews"]);
    expect(text(el("crewNote"))).toBe("You're in The crew.");
    expect([...el("crewMembers").children].map(text)).toEqual(["Ada (you)", "Bo made the crew"]);
    expect(read("session").user).toMatchObject({ is_anonymous: true });
  });
});

describe("a build with a backend and the email step on is as it was", () => {
  let page, fake;

  /* Signed in, and synced once: sync has a line to say. */
  beforeAll(async () => {
    fake = fakeBackend();
    const ada = fake.held("ada@example.test"), s = fake.issue(ada.id);
    window.localStorage.setItem(KEY("session"), JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token,
      user: { id: ada.id, email: ada.email, is_anonymous: false } }));
    page = await bootPage({ backend: fake });
    await page.app.syncSettled();
  }, 30000);
  afterAll(() => { while (!el("sheetWrap").hidden) page.handle.closeSheet(); return page.cleanup(); });

  it("the step is on, and Settings shows Keep your plan", () => {
    expect(page.app.emailStep).toBe(true);
    el("settingsBtn").click();
    expect(el("keep").hidden).toBe(false);
    expect(text(el("keep").querySelector("h3"))).toBe("Keep your plan");
    expect(text(el("keepWho"))).toBe("ada@example.test");
  });
  it("sync's line is Keep your plan's, and the readout says nothing of it, nor of the email step", () => {
    expect(text(el("keepSync"))).toBe("Synced just now");
    expect(text(el("deviceLine"))).not.toMatch(/email off|sync:|Synced|clock/);
  });
  it("a session lost says to enter the email again", () => {
    expect(page.app.plainMessage({ code: "session_lost" })).toBe("You were signed out. Enter your email to sign in again.");
  });
});

describe("a build with no backend has no email step either, and says nothing of one", () => {
  let page;

  beforeAll(async () => { page = await bootPage(); }, 30000);
  afterAll(() => { while (!el("sheetWrap").hidden) page.handle.closeSheet(); return page.cleanup(); });

  it("no backend, no step, no Keep your plan, and the readout silent", () => {
    expect([page.app.hasBackend, page.app.emailStep]).toEqual([false, false]);
    el("settingsBtn").click();
    expect(el("keep").hidden).toBe(true);
    expect(text(el("deviceLine"))).not.toMatch(/email off|sync:|clock/);
  });
});
