/* Plans, the crew (DECISIONS #56, #62, #63, #66; docs/screens/contract.md,
   sections 5 and 11): the crew header at the top of Plans, the crew panel -
   create, join by a kept ?join= or a pasted link, and the manage view with
   the invite, Remove, Leave and Delete - the My day | Crew segment, the
   crew's day, and the sync that redraws Plans when the crews or the
   crewmates' picks change. Every action is one request, then a sync run
   that began after it, then the panel and Plans drawn from what the pull
   kept: nothing optimistic, and a failure is said in the panel with nothing
   kept. Escape and focus for every panel of the sheet are here too.
   Against the fake backend, tests/helpers/backend.js. New tests, not rows of
   tests/PORT-LEDGER.md, so their titles carry no harness line. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { fakeBackend } from "../helpers/backend.js";
import { YEAR, YY } from "../../src/season.js";

const fixture = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sample-events.json"), "utf8"));
/* A con day's events at distinct times, in start order: Saturday's and
   Friday's, well inside the day - an event before 5 AM is the night
   before's. */
function dayOf(day) {
  const seen = new Set();
  return fixture.events.filter(e => e.start >= `${day}T09` && e.start < `${day}T20`).sort((a, b) => a.start.localeCompare(b.start))
    .filter(e => !seen.has(e.start) && seen.add(e.start)).map(e => e.id);
}
const SAT = dayOf("2026-09-05"), FRI = dayOf("2026-09-04");
const SATURDAY = "2026-09-05T13:05", AFTER_THE_CON = "2026-09-20T12:00";
const KEY = name => `dc${YY}.${name}`;
const read = name => JSON.parse(window.localStorage.getItem(KEY(name)));
const seed = (name, value) => window.localStorage.setItem(KEY(name), JSON.stringify(value));
const iso = ms => new Date(ms).toISOString();
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
const gets = (fake, table) => fake.requests.filter(r => r.method === "GET" && r.path.startsWith(`/rest/v1/${table}?`));
const sent = (fake, from) => fake.requests.slice(from).map(r => `${r.method} ${r.path.split("?")[0]}`);
const pick = (fake, user, id, picked = true) => fake.write(user.id, "picks", { event_id: id, picked, changed_at: iso(Date.now()) });

const el = id => document.getElementById(id);
const plans = () => el("view-plans");
const words = node => (node ? node.textContent.replace(/\s+/g, " ").trim() : "");
const shown = node => !!node && !node.hidden && !node.closest("[hidden]");
const tapTab = tab => document.querySelector(`.nav button[data-tab="${tab}"]`).click();
/* A tap that a keyboard or a mouse would give: focus, then the click. */
function press(node) { node.focus(); node.click(); }
/* A form sent as a reader sends it. */
const submit = form => el(form).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
const escape = () => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
/* The panel's request and the sync run after it, done: its buttons are back,
   and no run or drain is under way. */
async function settled(page) {
  await page.until(() => !el("crewCreate").disabled, 5000, "the crew panel's request");
  await page.app.syncSettled();
}
const members = () => [...el("crewMembers").children].map(li => words(li));
const blocks = () => [...plans().querySelectorAll(".crew-person")].map(b => ({
  who: words(b.querySelector(".crew-who")), rows: [...b.querySelectorAll(".row")].map(r => r.dataset.id),
  list: [...new Set([...b.querySelectorAll(".row")].map(r => r.dataset.list))], none: words(b.querySelector(".crew-none")),
}));

describe("a build with no backend: Plans is Mine as built, and the sheet closes on Escape", () => {
  let page, app, handle;

  beforeAll(async () => {
    page = await bootPage({ url: `https://example.test/?now=${SATURDAY}&join=${YEAR}.tokZ` });
    ({ app, handle } = page);
  }, 30000);
  afterAll(() => page.cleanup());

  it("an invite in the address opens nothing: the tab is the phase's, and the sheet is closed", () => {
    expect(handle.state.tab).toBe("now");
    expect(el("sheetWrap").hidden).toBe(true);
  });
  it("Plans has no crew header and no segment, and the crew panel is never drawn", () => {
    tapTab("plans");
    expect(plans().querySelector(".crew-head")).toBe(null);
    expect(plans().querySelector(".plans-seg")).toBe(null);
    expect(plans().querySelector(".plans-actions")).not.toBe(null);
    app.openSheet("crew", "create");
    expect(el("sheetWrap").hidden).toBe(true);
    expect(el("panel-crew").innerHTML).toBe("");
  });
  it("the gear: focus moves to the panel's heading, and Escape closes it and puts focus back on the gear", () => {
    press(el("settingsBtn"));
    expect(el("sheetWrap").hidden).toBe(false);
    expect(document.activeElement).toBe(el("sheetTitle"));
    escape();
    expect(el("sheetWrap").hidden).toBe(true);
    expect(document.activeElement).toBe(el("settingsBtn"));
  });
  it("an event opened from a row: its heading, then back to the same row's button, found again after the redraw", () => {
    tapTab("now");
    const row = document.querySelector("#view-now .row"), id = row.dataset.id, list = row.dataset.list;
    press(row.querySelector(".row-main"));
    expect(document.activeElement).toBe(el("sheetTitleEvent"));
    escape();
    expect(el("sheetWrap").hidden).toBe(true);
    const back = document.activeElement;
    expect(back.classList.contains("row-main")).toBe(true);
    expect(back.closest(".row").dataset.id).toBe(id);
    expect(back.closest(".row").dataset.list).toBe(list);
  });
  it("Escape with the sheet closed does nothing: not even the key's own default", () => {
    el("settingsBtn").focus();
    const key = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    el("settingsBtn").dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);
    expect(el("sheetWrap").hidden).toBe(true);
    expect(document.activeElement).toBe(el("settingsBtn"));
  });
  it("an Escape an input method is composing with is left to it - by its flag, or WebKit's keyCode 229", () => {
    press(el("settingsBtn"));
    for (const init of [{ isComposing: true }, { keyCode: 229 }]) {
      document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, ...init }));
      expect(el("sheetWrap").hidden).toBe(false);
    }
    escape();
    expect(el("sheetWrap").hidden).toBe(true);
  });
  it("a hotel opened from the Map: focus to its heading, and back to the hotel's block", () => {
    tapTab("map");
    const block = document.querySelector('#view-map .map-hotel[data-hotel="Hyatt"]');
    block.focus();
    block.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.activeElement).toBe(el("sheetTitleHotel"));
    escape();
    expect(document.activeElement).toBe(document.querySelector('#view-map .map-hotel[data-hotel="Hyatt"]'));
  });
  it("a timeline block in Plans: focus back to that block, not the same event's hero on the Now tab behind it", () => {
    handle.picks.set([SAT[3]]);
    tapTab("now");
    expect(document.querySelector(`#view-now [data-hero="${SAT[3]}"]`)).not.toBe(null);
    tapTab("plans");
    press(plans().querySelector(`.tl-block[data-hero="${SAT[3]}"]`));
    expect(document.activeElement).toBe(el("sheetTitleEvent"));
    escape();
    expect(document.activeElement.closest("#view-plans")).not.toBe(null);
    expect(document.activeElement.dataset.hero).toBe(SAT[3]);
    handle.picks.set([]);
  });
});

describe("a build with no backend ignores crews and an invite kept by a build with one", () => {
  let page, handle;
  beforeAll(async () => {
    window.sessionStorage.setItem(KEY("join"), `${YEAR}.tokZ`);
    seed("crew", [{ id: "c1", name: "Kept", creator: "x", invite_token: "t",
      members: [{ user_id: "x", display_name: "X" }, { user_id: "y", display_name: "Y" }] }]);
    page = await bootPage();
    ({ handle } = page);
  }, 30000);
  afterAll(() => page.cleanup());

  it("the tab is the phase's, no panel opens, and Plans has no crew", () => {
    expect(handle.state.tab).toBe("now");
    expect(el("sheetWrap").hidden).toBe(true);
    tapTab("plans");
    expect(plans().querySelector(".crew-head")).toBe(null);
    expect(plans().querySelector(".plans-seg")).toBe(null);
    expect(plans().querySelector(".crew-person")).toBe(null);
  });
});

describe("the new controls are 44px tall (#66)", () => {
  const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "styles.css"), "utf8");
  const rule = selector => { const at = css.indexOf(`${selector} {`); return at < 0 ? "" : css.slice(at, css.indexOf("}", at)); };
  it("the header's button and picker, the segment, the day chips, the panel's fields, its rows and Remove", () => {
    for (const [selector, height] of [[".crew-head .btn", "height: 44px"], ["select.crew-pick", "height: 44px"], [".plans-seg button", "height: 44px"],
      [".plans-days .chip", "height: 44px"], [".crew-form input, .crew-invite input", "height: 44px"], [".crew-members li", "min-height: 44px"],
      [".crew-members .crew-remove", "height: 44px"]]) {
      expect(rule(selector), selector).toContain(height);
    }
  });
});

describe("not in a crew: the rung, and Start a crew", () => {
  let page, app, handle, fake, ada;

  beforeAll(async () => {
    fake = fakeBackend();
    ada = fake.held("ada@example.test");
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    tapTab("plans");
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("the header is the rung: one line and two buttons, no segment, and My day under it", () => {
    const head = plans().querySelector(".crew-head.crew-rung");
    expect(words(head.querySelector("p"))).toBe("Start a crew, or paste an invite link.");
    expect(words(el("crewStartBtn"))).toBe("Start a crew");
    expect(words(el("crewJoinBtn"))).toBe("Join with a link");
    expect(plans().querySelector(".plans-seg")).toBe(null);
    expect(plans().querySelector(".plans-actions")).not.toBe(null);
    expect(plans().firstElementChild).toBe(head);
  });
  it("Start a crew opens the crew panel on its create step, focus on its heading, and sends nothing", () => {
    const from = fake.requests.length;
    press(el("crewStartBtn"));
    expect(el("sheetWrap").hidden).toBe(false);
    expect(["settings", "event", "hotel"].map(p => el(`panel-${p}`).hidden)).toEqual([true, true, true]);
    expect(el("panel-crew").hidden).toBe(false);
    expect(el("sheet").getAttribute("aria-labelledby")).toBe("sheetTitleCrew");
    expect(document.activeElement).toBe(el("sheetTitleCrew"));
    expect(words(el("sheetTitleCrew"))).toBe("Start a crew");
    expect([shown(el("crewCreateForm")), shown(el("crewJoinForm")), shown(el("crewManage"))]).toEqual([true, false, false]);
    expect(fake.requests.length).toBe(from);
  });
  it("its fields are labelled, empty with no crew to take a name from, and it says what joining shares", () => {
    for (const [id, label] of [["crewNewName", "Crew name"], ["crewCreateMe", "Your name in the crew"]]) {
      expect(el(id).closest("label").textContent).toContain(label);
      expect(el(id).value).toBe("");
    }
    expect(words(el("crewCreateForm").querySelector(".crew-consent")))
      .toBe("Everyone who joins this crew sees your name and your starred events, now and later.");
  });
  it("a crew with no name: the words, in the panel, before any request", () => {
    const before = everything(), from = fake.requests.length;
    el("crewNewName").value = "   ";
    el("crewCreateMe").value = "Ada";
    submit("crewCreateForm");
    return settled(page).then(() => {
      expect(words(el("crewNote"))).toBe("A crew's name is 1 to 40 characters.");
      expect(fake.requests.length).toBe(from);
      expect(everything()).toEqual(before);
    });
  });
  it("a server that fails: its words inline, nothing kept, no sync run, and the form as it was", async () => {
    const before = everything(), from = fake.requests.length;
    fake.fail = r => (r.path === "/rest/v1/rpc/create_crew" ? { status: 500, code: "XX000" } : null);
    el("crewNewName").value = "Night owls";
    submit("crewCreateForm");
    await settled(page);
    fake.fail = null;
    expect(words(el("crewNote"))).toBe("Something went wrong. Please try again.");
    expect(sent(fake, from)).toEqual(["POST /rest/v1/rpc/create_crew"]);
    expect(everything()).toEqual(before);
    expect([el("crewNewName").value, el("crewCreateMe").value]).toEqual(["Night owls", "Ada"]);
    expect(shown(el("crewCreateForm"))).toBe(true);
  });
  it("offline: the words for no signal, and nothing kept", async () => {
    const before = everything();
    fake.offline = true;
    submit("crewCreateForm");
    await settled(page);
    fake.offline = false;
    expect(words(el("crewNote"))).toBe("Couldn't reach the server. Your plan is safe on this phone; try again when you have signal.");
    expect(everything()).toEqual(before);
    expect(plans().querySelector(".crew-rung")).not.toBe(null);
  });
  it("one request at a time: the buttons are disabled while it is out, and a second tap sends nothing", async () => {
    const from = fake.requests.length;
    fake.defer = r => r.path === "/rest/v1/rpc/create_crew";
    el("crewCreate").focus();
    submit("crewCreateForm");
    expect(el("crewCreate").disabled).toBe(true);
    expect(el("closeSheetCrew").disabled).toBe(false);
    submit("crewCreateForm");
    el("crewCreate").click();
    await page.until(() => fake.requests.length > from, 5000, "the create request");
    expect(sent(fake, from)).toEqual(["POST /rest/v1/rpc/create_crew"]);
    fake.defer = r => r.method === "GET" && r.path.startsWith("/rest/v1/crews?");
    fake.release();
    await page.until(() => gets(fake, "crews").length && fake.requests.at(-1).path.startsWith("/rest/v1/crews?"), 5000, "the pull after it");
  });
  it("nothing optimistic: until the pull has the crew, Plans still offers the rung and the panel no crew's controls", () => {
    expect(plans().querySelector(".crew-rung")).not.toBe(null);
    expect(shown(el("crewManage"))).toBe(false);
    expect(read("crew")).toEqual([]);
    expect(el("crewCreate").disabled).toBe(true);
  });
  it("then the crew: made, the manage view - the reader marked, Delete crew and no Leave - and the header", async () => {
    fake.defer = null;
    fake.release();
    await settled(page);
    const [owls] = fake.rows("crews");
    expect(words(el("crewNote"))).toBe("Night owls is made. Share the link to bring people in.");
    expect(words(el("sheetTitleCrew"))).toBe("Night owls");
    expect(shown(el("crewManage"))).toBe(true);
    expect(members()).toEqual(["Ada (you) made the crew"]);
    expect([shown(el("crewDelete")), shown(el("crewLeave")), shown(el("crewRenew"))]).toEqual([true, false, true]);
    expect(el("crewLink").value).toBe(`https://example.test/?join=${YEAR}.${owls.invite_token}`);
    expect(handle.state.plans.crew).toBe(owls.id);
    expect(words(plans().querySelector(".crew-title"))).toBe("Night owls");
    expect(words(plans().querySelector(".crew-count"))).toBe("1 person");
    const at = document.activeElement;
    expect([el("panel-crew").contains(at), !!at.disabled, !!at.closest("[hidden]")]).toEqual([true, false, false]);
  });
  it("on a con day the segment is shown, and on Crew: the reader alone, with no picks on the day", () => {
    expect(el("plansViewCrew").getAttribute("aria-pressed")).toBe("true");
    expect(el("plansViewMine").getAttribute("aria-pressed")).toBe("false");
    expect(blocks()).toEqual([{ who: "Ada (you)", rows: [], list: [], none: "No picks on Saturday." }]);
    expect(read("plansView")).toBe(null);
  });
  it("Done closes it, and focus goes to the header's Manage, which took the place of the button that opened it", () => {
    press(el("closeSheetCrew"));
    expect(el("sheetWrap").hidden).toBe(true);
    expect(words(el("crewManageBtn"))).toBe("Manage");
    expect(el("crewManageBtn").getAttribute("aria-label")).toBe("Manage Night owls");
    expect(document.activeElement).toBe(el("crewManageBtn"));
  });
  it("a session gone between the action and its run: the words for an action that landed, and no crew's controls", async () => {
    press(el("crewManageBtn"));
    press(el("crewMoreCreate"));
    expect(document.activeElement).toBe(el("sheetTitleCrew"));
    el("crewNewName").value = "Night larks";
    fake.defer = r => r.path === "/rest/v1/rpc/create_crew";
    const from = fake.requests.length;
    submit("crewCreateForm");
    await page.until(() => fake.requests.length > from, 5000, "the create request");
    window.localStorage.removeItem(KEY("session"));
    fake.defer = null;
    fake.release();
    await settled(page);
    expect(words(el("crewNote"))).toBe("Night larks is made - it will show here once this phone reaches the server.");
    expect(words(el("sheetTitleCrew"))).toBe("Night larks");
    expect(shown(el("crewManage"))).toBe(false);
  });
});

describe("the creator's manage view: the invite shared, copied and renewed, a member removed, the crew deleted", () => {
  let page, app, handle, fake, ada, bo, cy, crew, asked, answer;
  const run = async () => { await app.runSync(); await app.syncSettled(); };
  const stub = (name, value) => Object.defineProperty(window.navigator, name, { value, configurable: true });

  beforeAll(async () => {
    fake = fakeBackend();
    [ada, bo, cy] = ["ada", "bo", "cy"].map(n => fake.held(`${n}@example.test`));
    crew = fake.crew({ name: "The crew", creator: ada.id, members: [[ada.id, "Ada"], [cy.id, "Cy"], [bo.id, "Bo"]] });
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    tapTab("plans");
    await app.syncSettled();
    window.confirm = message => { asked.push(message); return answer; };
  }, 30000);
  afterEach(() => { for (const name of ["share", "canShare", "clipboard"]) delete window.navigator[name]; });
  afterAll(() => page.cleanup());

  it("the header: the crew's name, how many, and Manage", () => {
    expect(words(plans().querySelector(".crew-title"))).toBe("The crew");
    expect(words(plans().querySelector(".crew-count"))).toBe("3 people");
    expect(el("crewPick")).toBe(null);
  });
  it("Manage: the members, the reader first and the rest by name, Remove beside each of the others, and the creator's controls", () => {
    press(el("crewManageBtn"));
    expect(document.activeElement).toBe(el("sheetTitleCrew"));
    expect(words(el("sheetTitleCrew"))).toBe("The crew");
    expect(members()).toEqual(["Ada (you) made the crew", "Bo Remove", "Cy Remove"]);
    expect([...el("crewMembers").querySelectorAll(".crew-remove")].map(b => [b.dataset.user, b.getAttribute("aria-label")]))
      .toEqual([[bo.id, "Remove Bo"], [cy.id, "Remove Cy"]]);
    expect([shown(el("crewRenew")), shown(el("crewDelete")), shown(el("crewLeave"))]).toEqual([true, true, false]);
    expect(el("crewLink").readOnly).toBe(true);
    expect(el("crewLink").closest("label").textContent).toContain("Invite link");
    expect(el("crewLink").value).toBe(`https://example.test/?join=${YEAR}.${crew.invite_token}`);
    expect([shown(el("crewMoreCreate")), shown(el("crewMoreJoin"))]).toEqual([true, true]);
  });
  it("with no Web Share on the phone, Copy link alone", () => {
    expect([shown(el("crewCopy")), shown(el("crewShare"))]).toEqual([true, false]);
  });
  it("Copy link: the bare link to the clipboard, the words, and no request", async () => {
    const copied = [], before = everything(), from = fake.requests.length;
    stub("clipboard", { writeText: text => { copied.push(text); return Promise.resolve(); } });
    el("crewCopy").click();
    expect(copied).toEqual([el("crewLink").value]);
    await page.until(() => words(el("crewNote")), 2000, "the words");
    expect(words(el("crewNote"))).toBe("Link copied - send it to the people you want in this crew.");
    expect(fake.requests.length).toBe(from);
    expect(everything()).toEqual(before);
  });
  it("a clipboard that refuses, and none at all: the link selected in its field, and the words", async () => {
    stub("clipboard", { writeText: () => Promise.reject(new DOMException("no", "NotAllowedError")) });
    el("sheetTitleCrew").focus();
    el("crewCopy").click();
    await page.until(() => document.activeElement === el("crewLink"), 2000, "the field selected");
    expect(words(el("crewNote"))).toBe("Couldn't copy - select the link above and copy it.");
    expect([el("crewLink").selectionStart, el("crewLink").selectionEnd]).toEqual([0, el("crewLink").value.length]);
    delete window.navigator.clipboard;
    el("sheetTitleCrew").focus();
    el("crewNote").textContent = "";
    el("crewCopy").click();
    expect(document.activeElement).toBe(el("crewLink"));
    expect(words(el("crewNote"))).toBe("Couldn't copy - select the link above and copy it.");
  });
  it("with Web Share, Share link: one string, the crew's name in it and the link last, no url - called in the tap itself", () => {
    const calls = [], from = fake.requests.length;
    stub("share", data => { calls.push(data); return Promise.resolve(); });
    handle.render();
    expect(shown(el("crewShare"))).toBe(true);
    el("crewShare").click();
    expect(calls).toEqual([{ text: `Join "The crew" on the Dragon Con planner: ${el("crewLink").value}` }]);
    expect(fake.requests.length).toBe(from);
  });
  it("and that string is an invite readInvite() reads, the link being last", () => {
    const text = `Join "The crew" on the Dragon Con planner: ${el("crewLink").value}`;
    expect(app.readInvite(text)).toEqual({ year: YEAR, token: crew.invite_token });
  });
  it("a share cancelled says nothing and copies nothing; one refused selects the link, with the words", async () => {
    const copied = [];
    stub("clipboard", { writeText: text => { copied.push(text); return Promise.resolve(); } });
    stub("share", () => Promise.reject(new DOMException("cancelled", "AbortError")));
    el("crewNote").textContent = "";
    el("crewShare").click();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(words(el("crewNote"))).toBe("");
    expect(copied).toEqual([]);
    stub("share", () => Promise.reject(new DOMException("no", "NotAllowedError")));
    el("crewShare").click();
    await page.until(() => document.activeElement === el("crewLink"), 2000, "the field selected");
    expect(words(el("crewNote"))).toBe("Couldn't open sharing - the link is above; copy it from there.");
    expect(copied).toEqual([]);
  });
  it("a Web Share that cannot take the text shows no Share link; one that can, shows it, asked about that very text", () => {
    const asked = [];
    stub("share", () => Promise.resolve());
    stub("canShare", () => false);
    handle.render();
    expect(shown(el("crewShare"))).toBe(false);
    stub("canShare", data => { asked.push(data); return true; });
    handle.render();
    expect(shown(el("crewShare"))).toBe(true);
    expect(asked.at(-1)).toEqual({ text: `Join "The crew" on the Dragon Con planner: ${el("crewLink").value}` });
  });
  it("New link: the request, a run, and the new link in the field", async () => {
    const old = el("crewLink").value, from = fake.requests.length;
    el("crewRenew").click();
    await settled(page);
    expect(sent(fake, from).slice(0, 2)).toEqual(["POST /rest/v1/rpc/regenerate_invite", "GET /rest/v1/crews"]);
    expect(words(el("crewNote"))).toBe("New link made - the old one no longer works.");
    expect(el("crewLink").value).toBe(`https://example.test/?join=${YEAR}.${fake.rows("crews")[0].invite_token}`);
    expect(el("crewLink").value).not.toBe(old);
  });
  it("a new link whose pull fails: said so, and the old link is not offered - not after a close and a reopen either - until a pull brings the new one", async () => {
    stub("share", () => Promise.resolve());
    handle.render();
    expect(shown(el("crewShare"))).toBe(true);
    fake.offline = r => r.method === "GET";
    el("crewRenew").click();
    await settled(page);
    expect(words(el("crewNote"))).toBe("New link made - it will show here once this phone reaches the server.");
    expect([shown(el("crewCopy")), shown(el("crewShare")), shown(el("crewLink"))]).toEqual([false, false, false]);
    expect(words(el("crewLinkWait"))).toBe("The invite link comes with the next sync.");
    el("closeSheetCrew").click();
    press(el("crewManageBtn"));
    expect([shown(el("crewCopy")), shown(el("crewShare")), shown(el("crewLink")), shown(el("crewLinkWait"))]).toEqual([false, false, false, true]);
    fake.offline = false;
    await run();
    expect([shown(el("crewLink")), shown(el("crewShare"))]).toEqual([true, true]);
    expect(shown(el("crewLinkWait"))).toBe(false);
    expect(el("crewLink").value).toBe(`https://example.test/?join=${YEAR}.${fake.rows("crews")[0].invite_token}`);
  });
  it("Remove asks first, naming the person, and a no sends nothing", async () => {
    asked = []; answer = false;
    const from = fake.requests.length;
    el("crewMembers").querySelector(`.crew-remove[data-user="${bo.id}"]`).click();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(asked).toEqual(["Remove Bo from The crew?"]);
    expect(fake.requests.length).toBe(from);
    expect(members()).toContain("Bo Remove");
  });
  it("a yes: the delete, a run, the member gone, and the line about the link, with New link beside it", async () => {
    asked = []; answer = true;
    const from = fake.requests.length;
    el("crewMembers").querySelector(`.crew-remove[data-user="${bo.id}"]`).click();
    await settled(page);
    expect(fake.requests[from]).toMatchObject({ method: "DELETE", path: `/rest/v1/crew_members?crew_id=eq.${crew.id}&user_id=eq.${bo.id}` });
    expect(members()).toEqual(["Ada (you) made the crew", "Cy Remove"]);
    expect(words(el("crewNote"))).toBe("Bo is out. They can still join with the current link until you make a new one.");
    expect(shown(el("crewRenew"))).toBe(true);
    expect(words(plans().querySelector(".crew-count"))).toBe("2 people");
  });
  it("a removal whose pull fails says so, and a later pull that shows it gives the words for it", async () => {
    asked = []; answer = true;
    fake.offline = r => r.method === "GET";
    el("crewMembers").querySelector(`.crew-remove[data-user="${cy.id}"]`).click();
    await settled(page);
    expect(words(el("crewNote"))).toBe("Done - it will show here once this phone reaches the server.");
    expect(members()).toContain("Cy Remove");
    fake.offline = false;
    await run();
    expect(members()).toEqual(["Ada (you) made the crew"]);
    expect(words(el("crewNote"))).toBe("Cy is out. They can still join with the current link until you make a new one.");
  });
  it("Delete crew answered no: nothing sent, and the panel as it was", async () => {
    asked = []; answer = false;
    const from = fake.requests.length;
    el("crewDelete").click();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(asked.length).toBe(1);
    expect(fake.requests.length).toBe(from);
    expect(el("sheetWrap").hidden).toBe(false);
    expect(shown(el("crewManage"))).toBe(true);
  });
  it("Delete crew asks first, and a yes deletes it: the panel closes to Plans, which offers the rung", async () => {
    asked = []; answer = true;
    const from = fake.requests.length;
    el("crewDelete").click();
    expect(asked).toEqual(["Delete The crew? Everyone in it loses the crew, and the link stops working."]);
    await page.until(() => el("sheetWrap").hidden, 5000, "the panel closed");
    await app.syncSettled();
    expect(fake.requests[from]).toMatchObject({ method: "DELETE", path: `/rest/v1/crews?id=eq.${crew.id}` });
    expect(fake.rows("crews")).toEqual([]);
    expect(plans().querySelector(".crew-rung")).not.toBe(null);
    expect(plans().querySelector(".plans-seg")).toBe(null);
  });
});

describe("a member's manage view, and the policy as the wall", () => {
  let page, app, handle, fake, ada, bo, crew;

  beforeAll(async () => {
    fake = fakeBackend();
    [ada, bo] = ["ada", "bo"].map(n => fake.held(`${n}@example.test`));
    crew = fake.crew({ name: "Ada's crew", creator: ada.id, members: [[ada.id, "Ada"], [bo.id, "Bo"]] });
    signIn(fake, bo);
    seed("syncStamp", { user: bo.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    tapTab("plans");
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("Leave crew, the invite to share, and none of the creator's controls", () => {
    press(el("crewManageBtn"));
    expect(members()).toEqual(["Bo (you)", "Ada made the crew"]);
    expect(el("crewMembers").querySelector(".crew-remove")).toBe(null);
    expect([shown(el("crewLeave")), shown(el("crewDelete")), shown(el("crewRenew")), shown(el("crewCopy"))]).toEqual([true, false, false, true]);
  });
  it("a list gone stale - the reader shown as the creator - lets New link out, and the server's refusal is said, nothing kept", async () => {
    const kept = read("crew");
    kept[0].creator = bo.id;
    seed("crew", kept);
    handle.render();
    expect(shown(el("crewRenew"))).toBe(true);
    const before = everything(), from = fake.requests.length;
    el("crewRenew").click();
    await settled(page);
    expect(sent(fake, from)).toEqual(["POST /rest/v1/rpc/regenerate_invite"]);
    expect(words(el("crewNote"))).toBe("Only the crew's creator can do that.");
    expect(everything()).toEqual(before);
  });
  it("Leave: the delete of the reader's own membership, a run, and the panel closes to Plans with the rung", async () => {
    await app.runSync();
    await app.syncSettled();
    expect(shown(el("crewLeave"))).toBe(true);
    const from = fake.requests.length;
    el("crewLeave").click();
    await page.until(() => el("sheetWrap").hidden, 5000, "the panel closed");
    await app.syncSettled();
    expect(fake.requests[from]).toMatchObject({ method: "DELETE", path: `/rest/v1/crew_members?crew_id=eq.${crew.id}&user_id=eq.${bo.id}` });
    expect(plans().querySelector(".crew-rung")).not.toBe(null);
    expect(read("crew")).toEqual([]);
  });
});

describe("two crews: the picker, and a crew whose creator is gone", () => {
  let page, app, handle, fake, ada, bo, owls, orphans;

  beforeAll(async () => {
    fake = fakeBackend();
    [ada, bo] = ["ada", "bo"].map(n => fake.held(`${n}@example.test`));
    owls = fake.crew({ name: "<i>Owls</i>", creator: bo.id, members: [[bo.id, "Bo"], [ada.id, "Ada"]] });
    orphans = fake.crew({ name: "Orphans", creator: null, members: [[ada.id, "Ada B"], [bo.id, "Bo"]] });
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    tapTab("plans");
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("a labelled picker of the reader's crews, the oldest first and chosen, each name as text", () => {
    const pickEl = el("crewPick");
    expect(pickEl.getAttribute("aria-label")).toBe("Crew");
    expect([...pickEl.options].map(o => [o.value, o.textContent])).toEqual([[owls.id, "<i>Owls</i>"], [orphans.id, "Orphans"]]);
    expect(pickEl.value).toBe(owls.id);
    expect(plans().querySelector(".crew-head i")).toBe(null);
    expect(words(plans().querySelector(".crew-count"))).toBe("2 people");
  });
  it("choosing the other keeps it in state.plans.crew, redraws, and gives focus back to the picker", () => {
    const pickEl = el("crewPick");
    pickEl.focus();
    pickEl.value = orphans.id;
    pickEl.dispatchEvent(new Event("change", { bubbles: true }));
    expect(handle.state.plans.crew).toBe(orphans.id);
    expect(el("crewPick").value).toBe(orphans.id);
    expect(document.activeElement).toBe(el("crewPick"));
  });
  it("Manage opens the crew chosen: no creator, so Leave for everyone and no creator's controls", () => {
    press(el("crewManageBtn"));
    expect(words(el("sheetTitleCrew"))).toBe("Orphans");
    expect(members()).toEqual(["Ada B (you)", "Bo"]);
    expect([shown(el("crewLeave")), shown(el("crewDelete")), shown(el("crewRenew"))]).toEqual([true, false, false]);
    el("closeSheetCrew").click();
  });
  it("a crew in state.plans.crew that is no longer kept: the oldest instead", () => {
    handle.state.plans.crew = "00000000-0000-4000-b000-999999999999";
    handle.render();
    expect(el("crewPick").value).toBe(owls.id);
  });
  it("Start another crew takes the reader's name in the oldest crew for a start, focus on its heading", () => {
    press(el("crewManageBtn"));
    press(el("crewMoreCreate"));
    expect(document.activeElement).toBe(el("sheetTitleCrew"));
    expect(words(el("sheetTitleCrew"))).toBe("Start a crew");
    expect([el("crewNewName").value, el("crewCreateMe").value]).toEqual(["", "Ada"]);
    el("closeSheetCrew").click();
  });
  it("a pasted link for the crew not shown: no request, that crew's manage view, and Plans behind it on that crew", async () => {
    expect(el("crewPick").value).toBe(owls.id);
    press(el("crewManageBtn"));
    press(el("crewMoreJoin"));
    const from = fake.requests.length;
    el("crewPaste").value = `https://example.test/?join=${YEAR}.${orphans.invite_token}`;
    submit("crewJoinForm");
    await settled(page);
    expect(fake.requests.length).toBe(from);
    expect(words(el("crewNote"))).toBe("You're already in Orphans.");
    expect(handle.state.plans.crew).toBe(orphans.id);
    expect(el("sheetWrap").hidden).toBe(false);
    expect(el("crewPick").value).toBe(orphans.id);
    el("closeSheetCrew").click();
  });
  it("a picker changed without focus - a browser that does not focus what is tapped - is given none", () => {
    document.activeElement.blur();
    el("crewPick").value = owls.id;
    el("crewPick").dispatchEvent(new Event("change", { bubbles: true }));
    expect(handle.state.plans.crew).toBe(owls.id);
    expect(document.activeElement).not.toBe(el("crewPick"));
  });
});

describe("arriving by a tapped invite link", () => {
  let page, app, handle, fake, ada, crew;

  beforeAll(async () => {
    fake = fakeBackend();
    ada = fake.held("ada@example.test");
    crew = fake.crew({ name: "The crew", creator: ada.id, members: [[ada.id, "Ada"]] });
    page = await bootPage({ backend: fake, url: `https://example.test/?now=${AFTER_THE_CON}&join=${YEAR}.${crew.invite_token}` });
    ({ app, handle } = page);
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("opens on Plans with the join step, focus in it, and sends nothing: the invite is kept", () => {
    expect(handle.state.tab).toBe("plans");
    expect(el("sheetWrap").hidden).toBe(false);
    expect(el("panel-crew").hidden).toBe(false);
    expect(document.activeElement).toBe(el("sheetTitleCrew"));
    expect(words(el("sheetTitleCrew"))).toBe("Join a crew");
    expect(fake.requests).toEqual([]);
    expect(app.pendingJoin()).toBe(`${YEAR}.${crew.invite_token}`);
  });
  it("it names no crew - the invite cannot - asks the reader's name, and says what joining shares", () => {
    expect(words(el("crewInvited"))).toBe("You've been invited to join a crew.");
    expect(shown(el("crewPasteLabel"))).toBe(false);
    expect(el("panel-crew").textContent).not.toContain("The crew");
    expect(el("crewJoinMe").closest("label").textContent).toContain("Your name in the crew");
    expect(words(el("crewJoinForm").querySelector(".crew-consent")))
      .toBe("Joining shares your name and your starred events with everyone in this crew, now and later.");
  });
  it("Join with no name: the words, nothing sent, the invite still kept", async () => {
    el("crewJoinMe").value = "";
    submit("crewJoinForm");
    await settled(page);
    expect(words(el("crewNote"))).toBe("Your name in the crew is 1 to 24 characters.");
    expect(fake.requests).toEqual([]);
    expect(app.pendingJoin()).toBe(`${YEAR}.${crew.invite_token}`);
  });
  it("Join: a user minted, the join, a run; the crew named from then on, both members, the invite taken", async () => {
    el("crewJoinMe").value = "Bo";
    submit("crewJoinForm");
    await settled(page);
    expect(sent(fake, 0).slice(0, 3)).toEqual(["POST /auth/v1/signup", "POST /rest/v1/rpc/join_crew", "GET /rest/v1/crews"]);
    expect(fake.requests[1].body).toEqual({ token: crew.invite_token, display_name: "Bo" });
    expect(words(el("crewNote"))).toBe("You're in The crew.");
    expect(words(el("sheetTitleCrew"))).toBe("The crew");
    expect(members()).toEqual(["Bo (you)", "Ada made the crew"]);
    expect(app.pendingJoin()).toBe("");
    expect(handle.state.plans.crew).toBe(crew.id);
  });
  it("Done: Plans, two people, and after the con the segment on My day", () => {
    el("closeSheetCrew").click();
    expect(el("sheetWrap").hidden).toBe(true);
    expect(words(plans().querySelector(".crew-count"))).toBe("2 people");
    expect(el("plansViewMine").getAttribute("aria-pressed")).toBe("true");
    expect(plans().querySelector(".plans-actions")).not.toBe(null);
  });
});

describe("a tapped invite closed, another year's, and one for a crew already kept", () => {
  let page;
  afterAll(() => page && page.cleanup());

  it("before the con, when invites are sent, the invite still wins the tab: Plans under the join step, nothing sent", async () => {
    const fake = fakeBackend();
    page = await bootPage({ backend: fake, url: `https://example.test/?now=2026-08-20T12:00&join=${YEAR}.tokA` });
    await page.app.syncSettled();
    expect(page.handle.state.tab).toBe("plans");
    expect(el("panel-crew").hidden).toBe(false);
    expect(fake.requests).toEqual([]);
    escape();
    expect(page.handle.state.tab).toBe("plans");
    await page.cleanup();
  }, 30000);
  it("a #explore= link beside it still wins the tab, with the join step open over Explore", async () => {
    const fake = fakeBackend();
    page = await bootPage({ backend: fake, url: `https://example.test/?now=${SATURDAY}&join=${YEAR}.tokA#explore=track:Gaming` });
    await page.app.syncSettled();
    expect(page.handle.state.tab).toBe("explore");
    expect(page.handle.state.explore.page).toEqual({ kind: "track", key: "Gaming" });
    expect([el("sheetWrap").hidden, el("panel-crew").hidden, words(el("sheetTitleCrew"))]).toEqual([false, false, "Join a crew"]);
    await page.cleanup();
  }, 30000);
  it("over Explore, a kept list gone stale is said once the pull after boot has taken the crew away: the open panel is redrawn off Plans too", async () => {
    const fake = fakeBackend(), ada = fake.held("ada@example.test"), bo = fake.held("bo@example.test");
    const crew = fake.crew({ name: "The crew", creator: ada.id, members: [[ada.id, "Ada"]] });
    signIn(fake, bo);
    seed("syncStamp", { user: bo.id, picks: null, follows: null });
    seed("crew", [{ id: crew.id, name: "The crew", creator: ada.id, invite_token: crew.invite_token,
      members: [{ user_id: ada.id, display_name: "Ada" }, { user_id: bo.id, display_name: "Bo" }] }]);
    page = await bootPage({ backend: fake, url: `https://example.test/?now=${SATURDAY}&join=${YEAR}.${crew.invite_token}#explore=track:Gaming` });
    await page.app.syncSettled();
    expect(page.handle.state.tab).toBe("explore");
    expect(el("panel-crew").hidden).toBe(false);
    expect(read("crew")).toEqual([]);
    expect(words(el("crewNote"))).toBe("That crew isn't on this phone any more - it may have been deleted.");
    expect([shown(el("crewManage")), shown(el("crewJoinForm")), shown(el("crewCreateForm")), shown(el("closeSheetCrew"))]).toEqual([false, false, false, true]);
    await page.cleanup();
  }, 30000);
  it("closing the join step unjoined takes the invite: it is declined, not nagged", async () => {
    const fake = fakeBackend();
    page = await bootPage({ backend: fake, url: `https://example.test/?now=${SATURDAY}&join=${YEAR}.tokA` });
    await page.app.syncSettled();
    expect(el("panel-crew").hidden).toBe(false);
    escape();
    expect(el("sheetWrap").hidden).toBe(true);
    expect(page.app.pendingJoin()).toBe("");
    expect(page.handle.state.tab).toBe("plans");
    expect(fake.requests).toEqual([]);
    await page.cleanup();
  }, 30000);
  it("another year's invite: said as the step opens, the paste field offered, nothing sent, the invite kept till it closes", async () => {
    const fake = fakeBackend();
    page = await bootPage({ backend: fake, url: `https://example.test/?now=${SATURDAY}&join=${YEAR + 1}.tokE` });
    await page.app.syncSettled();
    expect(words(el("crewNote"))).toBe("That invite is for another year's con - ask for a new link.");
    expect(shown(el("crewInvited"))).toBe(false);
    expect(shown(el("crewPasteLabel"))).toBe(true);
    expect(page.app.pendingJoin()).toBe(`${YEAR + 1}.tokE`);
    expect(fake.requests).toEqual([]);
    await page.cleanup();
  }, 30000);
  it("an invite whose token is a kept crew's: no request, no form - that crew chosen, its manage view, and the invite taken", async () => {
    const fake = fakeBackend(), ada = fake.held("ada@example.test"), bo = fake.held("bo@example.test");
    const crew = fake.crew({ name: "The crew", creator: ada.id, members: [[ada.id, "Ada"], [bo.id, "Bo"]] });
    signIn(fake, bo);
    seed("syncStamp", { user: bo.id, picks: null, follows: null });
    seed("crew", [{ id: crew.id, name: "The crew", creator: ada.id, invite_token: crew.invite_token,
      members: [{ user_id: ada.id, display_name: "Ada" }, { user_id: bo.id, display_name: "Bo" }] }]);
    page = await bootPage({ backend: fake, url: `https://example.test/?now=${SATURDAY}&join=${YEAR}.${crew.invite_token}` });
    await page.app.syncSettled();
    expect(fake.requests.filter(r => r.method !== "GET")).toEqual([]);
    expect(words(el("crewNote"))).toBe("You're already in The crew.");
    expect([shown(el("crewJoinForm")), shown(el("crewManage"))]).toEqual([false, true]);
    expect(page.app.pendingJoin()).toBe("");
    expect(page.handle.state.plans.crew).toBe(crew.id);
    await page.cleanup();
  }, 30000);
  it("a kept list gone stale - the reader since removed - says so once the pull after boot has taken the crew away, with Done and nothing else", async () => {
    const fake = fakeBackend(), ada = fake.held("ada@example.test"), bo = fake.held("bo@example.test");
    const crew = fake.crew({ name: "The crew", creator: ada.id, members: [[ada.id, "Ada"]] });
    signIn(fake, bo);
    seed("syncStamp", { user: bo.id, picks: null, follows: null });
    seed("crew", [{ id: crew.id, name: "The crew", creator: ada.id, invite_token: crew.invite_token,
      members: [{ user_id: ada.id, display_name: "Ada" }, { user_id: bo.id, display_name: "Bo" }] }]);
    page = await bootPage({ backend: fake, url: `https://example.test/?now=${SATURDAY}&join=${YEAR}.${crew.invite_token}` });
    await page.app.syncSettled();
    expect(read("crew")).toEqual([]);
    expect(words(el("crewNote"))).toBe("That crew isn't on this phone any more - it may have been deleted.");
    expect([shown(el("crewManage")), shown(el("crewJoinForm")), shown(el("crewCreateForm"))]).toEqual([false, false, false]);
    expect(shown(el("closeSheetCrew"))).toBe(true);
    await page.cleanup();
  }, 30000);
});

describe("a pasted link", () => {
  let page, app, fake, ada, bo, theirs, old;

  beforeAll(async () => {
    fake = fakeBackend();
    [ada, bo] = ["ada", "bo"].map(n => fake.held(`${n}@example.test`));
    theirs = fake.crew({ name: "Bo's crew", creator: bo.id, members: [[bo.id, "Bo"]] });
    old = `${YEAR}.old-token-of-bos-crew`;
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app } = page);
    await app.syncSettled();
    tapTab("plans");
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("Join with a link: the join step with a labelled field to paste into", () => {
    press(el("crewJoinBtn"));
    expect(words(el("sheetTitleCrew"))).toBe("Join a crew");
    expect(shown(el("crewInvited"))).toBe(false);
    expect(shown(el("crewPasteLabel"))).toBe(true);
    expect(el("crewPaste").closest("label").textContent).toContain("Invite link");
  });
  it("what is not an invite: the words, no request", async () => {
    const from = fake.requests.length;
    el("crewPaste").value = "see you there";
    el("crewJoinMe").value = "Ada";
    submit("crewJoinForm");
    await settled(page);
    expect(words(el("crewNote"))).toBe("That doesn't look like an invite link.");
    expect(fake.requests.length).toBe(from);
  });
  it("a link since renewed: the server's words, and nothing kept", async () => {
    const before = everything();
    el("crewPaste").value = `https://example.test/?join=${old}`;
    submit("crewJoinForm");
    await settled(page);
    expect(words(el("crewNote"))).toBe("That invite doesn't work any more - ask for a new link.");
    expect(everything()).toEqual(before);
  });
  it("the whole message a share sends, pasted: joins by the link at its end", async () => {
    const from = fake.requests.length;
    el("crewPaste").value = `Join "Bo's crew" on the Dragon Con planner: https://example.test/?join=${YEAR}.${theirs.invite_token}`;
    submit("crewJoinForm");
    await settled(page);
    expect(fake.requests[from]).toMatchObject({ method: "POST", path: "/rest/v1/rpc/join_crew", body: { token: theirs.invite_token, display_name: "Ada" } });
    expect(words(el("crewNote"))).toBe("You're in Bo's crew.");
    expect(members()).toEqual(["Ada (you)", "Bo made the crew"]);
  });
  it("the same link pasted again: no request, and that crew's manage view", async () => {
    el("crewMoreJoin").click();
    const from = fake.requests.length;
    el("crewPaste").value = `https://example.test/?join=${YEAR}.${theirs.invite_token}`;
    el("crewJoinMe").value = "";
    submit("crewJoinForm");
    await settled(page);
    expect(fake.requests.length).toBe(from);
    expect(words(el("crewNote"))).toBe("You're already in Bo's crew.");
    expect(shown(el("crewManage"))).toBe(true);
  });
  it("a join whose pull fails: said so, and the panel shows the crew once a pull brings it", async () => {
    const third = fake.crew({ name: "Third", creator: bo.id, members: [[bo.id, "Bo"]] });
    el("crewMoreJoin").click();
    el("crewPaste").value = `${YEAR}.${third.invite_token}`;
    el("crewJoinMe").value = "Ada";
    fake.offline = r => r.method === "GET";
    submit("crewJoinForm");
    await settled(page);
    expect(words(el("crewNote"))).toBe("You're in Third - it will show here once this phone reaches the server.");
    expect([shown(el("crewManage")), shown(el("crewJoinForm"))]).toEqual([false, false]);
    fake.offline = false;
    await app.runSync();
    await app.syncSettled();
    expect(shown(el("crewManage"))).toBe(true);
    expect(words(el("crewNote"))).toBe("You're in Third.");
  });
});

describe("the crew's day, the segment, and the redraws", () => {
  let page, app, handle, fake, ada, bo, cy, dee, crew;
  const run = async () => { await app.runSync(); await app.syncSettled(); };

  beforeAll(async () => {
    fake = fakeBackend();
    [ada, bo, cy] = ["ada", "bo", "cy"].map(n => fake.held(`${n}@example.test`));
    crew = fake.crew({ name: "The crew", creator: ada.id, members: [[ada.id, "Ada"], [cy.id, "Cy"], [bo.id, "Bo"]] });
    pick(fake, ada, SAT[2]);
    pick(fake, bo, SAT[3]);
    pick(fake, bo, SAT[0]);
    pick(fake, bo, FRI[0]);
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    tapTab("plans");
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("on a con day, in a crew, with nothing saved: the segment on Crew, labelled, and the day chips on today", () => {
    const seg = plans().querySelector(".plans-seg");
    expect(seg.getAttribute("role")).toBe("group");
    expect(seg.getAttribute("aria-label")).toBe("Plans view");
    expect([words(el("plansViewMine")), words(el("plansViewCrew"))]).toEqual(["My day", "Crew"]);
    expect(el("plansViewCrew").getAttribute("aria-pressed")).toBe("true");
    const chips = [...plans().querySelectorAll('[data-chip="plans-day"]')];
    expect(chips.map(c => c.dataset.value)).toEqual(app.CON_DAYS);
    expect(chips.filter(c => c.getAttribute("aria-pressed") === "true").map(c => c.dataset.value)).toEqual(["2026-09-05"]);
    expect(plans().querySelector(".plans-actions")).toBe(null);
  });
  it("one block a member, the reader first and the rest by name, each their picks that day as compact rows", () => {
    expect(blocks()).toEqual([
      { who: "Ada (you) 1", rows: [SAT[2]], list: [`crew:${ada.id}`], none: "" },
      { who: "Bo 2", rows: [SAT[0], SAT[3]], list: [`crew:${bo.id}`], none: "" },
      { who: "Cy", rows: [], list: [], none: "No picks on Saturday." },
    ]);
    expect(plans().querySelectorAll(".crew-person .list.compact").length).toBe(2);
  });
  it("another day's chip: that day, kept in state.plans.day", () => {
    plans().querySelector('[data-chip="plans-day"][data-value="2026-09-04"]').click();
    expect(handle.state.plans.day).toBe("2026-09-04");
    expect(blocks().map(b => [b.who, b.rows, b.none])).toEqual([
      ["Ada (you)", [], "No picks on Friday."], ["Bo 1", [FRI[0]], ""], ["Cy", [], "No picks on Friday."]]);
    plans().querySelector('[data-chip="plans-day"][data-value="2026-09-05"]').click();
  });
  it("a crewmate's pick carries the reader's own star: tapped, it is the reader's pick, and the row stays put", () => {
    const star = plans().querySelector(`.row[data-id="${SAT[0]}"][data-list="crew:${bo.id}"] .star`);
    expect(star.getAttribute("aria-pressed")).toBe("false");
    star.click();
    expect(handle.picks.get().has(SAT[0])).toBe(true);
    expect(plans().querySelector(`.row[data-id="${SAT[0]}"][data-list="crew:${bo.id}"] .star`).getAttribute("aria-pressed")).toBe("true");
    expect(blocks()[0].rows).toEqual([SAT[0], SAT[2]]);
  });
  it("a crewmate's row opened and closed: focus back on that row, not the reader's row for the same event", () => {
    expect(plans().querySelectorAll(`.row[data-id="${SAT[0]}"]`).length).toBe(2);
    press(plans().querySelector(`.row[data-id="${SAT[0]}"][data-list="crew:${bo.id}"] .row-main`));
    expect(document.activeElement).toBe(el("sheetTitleEvent"));
    escape();
    expect(document.activeElement.classList.contains("row-main")).toBe(true);
    expect(document.activeElement.closest(".row").dataset.list).toBe(`crew:${bo.id}`);
  });
  it("My day: Mine as built, saved, and no sync run; a tap on Crew saves it too and starts one - focus kept on it through the run's redraw", async () => {
    await app.syncSettled();
    let reads = gets(fake, "crews").length;
    press(el("plansViewMine"));
    expect(read("plansView")).toBe("mine");
    expect(plans().querySelector(".plans-actions")).not.toBe(null);
    expect(plans().querySelector(".crew-person")).toBe(null);
    expect(document.activeElement).toBe(el("plansViewMine"));
    await app.syncSettled();
    expect(gets(fake, "crews").length).toBe(reads);
    pick(fake, bo, SAT[6]);
    press(el("plansViewCrew"));
    expect(read("plansView")).toBe("crew");
    expect(document.activeElement).toBe(el("plansViewCrew"));
    await app.syncSettled();
    expect(gets(fake, "crews").length).toBe(reads + 1);
    expect(blocks().find(b => b.who.startsWith("Bo")).rows).toContain(SAT[6]);
    expect(document.activeElement).toBe(el("plansViewCrew"));
    reads = gets(fake, "crews").length;
    tapTab("browse");
    tapTab("map");
    await app.syncSettled();
    expect(gets(fake, "crews").length).toBe(reads);
    tapTab("plans");
    await app.syncSettled();
  });
  it("a segment tapped without focus is given none", async () => {
    document.activeElement.blur();
    el("plansViewCrew").click();
    expect(document.activeElement).not.toBe(el("plansViewCrew"));
    await app.syncSettled();
  });
  it("a tap on the Plans tab starts a sync run too", async () => {
    const reads = gets(fake, "crews").length;
    tapTab("plans");
    await app.syncSettled();
    expect(gets(fake, "crews").length).toBe(reads + 1);
  });
  it("a pull that changed only a crewmate's picks redraws Plans: the new row is there with no tap", async () => {
    pick(fake, cy, SAT[4]);
    await run();
    expect(blocks().find(b => b.who.startsWith("Cy")).rows).toEqual([SAT[4]]);
  });
  it("a pull that changed nothing, or only the order its members came in, draws nothing", async () => {
    const marker = plans().firstElementChild;
    await run();
    expect(plans().firstElementChild).toBe(marker);
    const live = fake.rows("crews")[0];
    expect(live.members.length).toBe(3);
    crew.members.reverse();
    await run();
    expect(plans().firstElementChild).toBe(marker);
  });
  it("a crewmate joining redraws the header's count", async () => {
    dee = fake.held("dee@example.test");
    fake.join(crew, dee.id, "Dee");
    await run();
    expect(words(plans().querySelector(".crew-count"))).toBe("4 people");
  });
  it("a crewmate whose only row pulled is an unstar: nothing drawn changes, and nothing is drawn", async () => {
    const marker = plans().firstElementChild;
    pick(fake, dee, SAT[1], false);
    await run();
    expect(plans().firstElementChild).toBe(marker);
  });
  it("off Plans, a crew's change pulled draws nothing: Explore's filter keeps its focus and caret", async () => {
    tapTab("explore");
    await app.syncSettled();
    const box = el("exploreQ");
    box.focus();
    box.value = "sta";
    box.dispatchEvent(new Event("input", { bubbles: true }));
    box.setSelectionRange(1, 2);
    pick(fake, bo, SAT[5]);
    await run();
    expect(el("exploreQ")).toBe(box);
    expect(document.activeElement).toBe(box);
    expect([box.selectionStart, box.selectionEnd]).toEqual([1, 2]);
    tapTab("plans");
    await app.syncSettled();
    expect(blocks().find(b => b.who.startsWith("Bo")).rows).toContain(SAT[5]);
  });
  it("a redraw keeps a half-typed Search query and its caret, and an open event sheet as it was", () => {
    tapTab("browse");
    const q = el("q");
    q.focus();
    q.value = "dar";
    q.dispatchEvent(new Event("input", { bubbles: true }));
    q.setSelectionRange(1, 2);
    handle.render();
    expect(el("q")).toBe(q);
    expect(document.activeElement).toBe(q);
    expect([q.value, q.selectionStart, q.selectionEnd]).toEqual(["dar", 1, 2]);
    app.openSheet("event", SAT[0]);
    const inside = el("panel-event").firstElementChild;
    handle.render();
    expect(el("sheetWrap").hidden).toBe(false);
    expect(el("panel-event").firstElementChild).toBe(inside);
    app.closeSheet();
    tapTab("plans");
  });
  it("the session gone - another tab signed out - forgets the crews, and Plans shows the rung with no tap", async () => {
    await app.syncSettled();
    window.localStorage.removeItem(KEY("session"));
    await run();
    expect(read("crew")).toBe(null);
    expect(plans().querySelector(".crew-rung")).not.toBe(null);
  });
});

describe("the open panel refreshed by a pull, and a run that began after the action", () => {
  let page, app, handle, fake, ada, bo, cy, crew;
  const run = async () => { await app.runSync(); await app.syncSettled(); };

  beforeAll(async () => {
    fake = fakeBackend();
    [ada, bo, cy] = ["ada", "bo", "cy"].map(n => fake.held(`${n}@example.test`));
    crew = fake.crew({ name: "The crew", creator: ada.id, members: [[ada.id, "Ada"], [bo.id, "Bo"]] });
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    tapTab("plans");
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("a pull that adds a member while the manage view is open: listed, and focus stays on the Remove it was on", async () => {
    press(el("crewManageBtn"));
    const remove = el("crewMembers").querySelector(`.crew-remove[data-user="${bo.id}"]`);
    remove.focus();
    fake.join(crew, cy.id, "Cy");
    await run();
    expect(members()).toEqual(["Ada (you) made the crew", "Bo Remove", "Cy Remove"]);
    expect(document.activeElement).toBe(remove);
  });
  it("a pull that takes a member listed above the focused Remove: listed without them, and focus stays", async () => {
    const remove = el("crewMembers").querySelector(`.crew-remove[data-user="${cy.id}"]`);
    remove.focus();
    fake.leave(crew, bo.id);
    await run();
    expect(members()).toEqual(["Ada (you) made the crew", "Cy Remove"]);
    expect(document.activeElement).toBe(remove);
  });
  it("a pull while a name is half typed: the field as it was, its caret, its focus", async () => {
    el("crewMoreCreate").click();
    const box = el("crewNewName");
    box.focus();
    box.value = "Night ow";
    box.setSelectionRange(3, 5);
    fake.join(crew, fake.held("dee@example.test").id, "Dee");
    await run();
    expect(el("crewNewName")).toBe(box);
    expect(document.activeElement).toBe(box);
    expect([box.value, box.selectionStart, box.selectionEnd]).toEqual(["Night ow", 3, 5]);
  });
  it("the redraw after an action waits for a run that began after it - not the one already out, which read too soon", async () => {
    el("crewNewName").value = "Night owls";
    el("crewCreateMe").value = "Ada";
    /* a run already out: its crews read answered, its picks read held */
    let hold = "picks";
    fake.defer = r => r.method === "GET" && r.path.startsWith(`/rest/v1/${hold}?`);
    const out = app.runSync();
    await page.until(() => fake.requests.at(-1).path.startsWith("/rest/v1/picks?"), 5000, "the run out, holding");
    const from = fake.requests.length;
    submit("crewCreateForm");
    await page.until(() => fake.requests.length > from, 5000, "the create request");
    /* that run goes on and ends, having read the crews before the crew was
       made; the next one's crews read is held */
    hold = "crews";
    const reads = gets(fake, "crews").length;
    fake.release();
    await page.until(() => gets(fake, "crews").length > reads, 5000, "the run after the action, holding");
    expect(el("crewCreate").disabled).toBe(true);
    expect(shown(el("crewManage"))).toBe(false);
    fake.defer = null;
    fake.release();
    await page.until(() => !el("crewCreate").disabled, 5000, "the panel's request");
    expect(shown(el("crewManage"))).toBe(true);
    expect(words(el("sheetTitleCrew"))).toBe("Night owls");
    expect(words(el("crewNote"))).toBe("Night owls is made. Share the link to bring people in.");
    await out;
    await app.syncSettled();
  });
  it("a pull that takes the open crew away: the no_crew words, Done, and no other crew's controls", async () => {
    const owls = fake.rows("crews").find(c => c.name === "Night owls");
    expect(handle.state.plans.crew).toBe(owls.id);
    const live = fake.rows("crews");
    expect(live.length).toBe(2);
    /* another device of the reader's deletes it */
    const other = fake.issue(ada.id);
    await fake.fetch(`${fake.url}/rest/v1/crews?id=eq.${owls.id}`, { method: "DELETE", headers: { apikey: fake.key, Authorization: `Bearer ${other.access_token}` } });
    await run();
    expect(words(el("crewNote"))).toBe("That crew isn't on this phone any more - it may have been deleted.");
    expect([shown(el("crewManage")), shown(el("crewCreateForm")), shown(el("crewJoinForm"))]).toEqual([false, false, false]);
    expect(words(el("sheetTitleCrew"))).toBe("Night owls");
    el("closeSheetCrew").click();
    expect(words(plans().querySelector(".crew-title"))).toBe("The crew");
  });
});

describe("the segment's default off the con's days, and a saved one", () => {
  let page;
  afterAll(() => page && page.cleanup());

  async function boot(fake, user, now) {
    signIn(fake, user);
    seed("syncStamp", { user: user.id, picks: null, follows: null });
    page = await bootPage({ backend: fake, now });
    await page.app.syncSettled();
    tapTab("plans");
    await page.app.syncSettled();
  }

  it("after the con, in a crew, nothing saved: My day, and the day chips on the first full day", async () => {
    const fake = fakeBackend(), ada = fake.held("ada@example.test");
    fake.crew({ name: "The crew", creator: ada.id, members: [[ada.id, "Ada"]] });
    await boot(fake, ada, AFTER_THE_CON);
    expect(el("plansViewMine").getAttribute("aria-pressed")).toBe("true");
    expect(read("plansView")).toBe(null);
    press(el("plansViewCrew"));
    expect(plans().querySelector('[data-chip="plans-day"][aria-pressed="true"]').dataset.value).toBe(page.app.FIRST_FULL_DAY);
    await page.app.syncSettled();
    await page.cleanup();
  }, 30000);
  it("before the con, in a crew, nothing saved: My day too, and the chips on the first full day", async () => {
    const fake = fakeBackend(), ada = fake.held("ada@example.test");
    fake.crew({ name: "The crew", creator: ada.id, members: [[ada.id, "Ada"]] });
    await boot(fake, ada, "2026-08-20T12:00");
    expect(el("plansViewMine").getAttribute("aria-pressed")).toBe("true");
    press(el("plansViewCrew"));
    expect(plans().querySelector('[data-chip="plans-day"][aria-pressed="true"]').dataset.value).toBe(page.app.FIRST_FULL_DAY);
    expect(words(plans().querySelector(".crew-none"))).toBe(`No picks on ${page.app.DAY_LONG[page.app.FIRST_FULL_DAY]}.`);
    await page.app.syncSettled();
    await page.cleanup();
  }, 30000);
  it("a saved Crew wins on any day", async () => {
    const fake = fakeBackend(), ada = fake.held("ada@example.test");
    fake.crew({ name: "The crew", creator: ada.id, members: [[ada.id, "Ada"]] });
    seed("plansView", "crew");
    await boot(fake, ada, AFTER_THE_CON);
    expect(el("plansViewCrew").getAttribute("aria-pressed")).toBe("true");
    await page.cleanup();
  }, 30000);
  it("a saved Crew and a saved My day with no crew: My day, and no segment", async () => {
    const fake = fakeBackend(), ada = fake.held("ada@example.test");
    seed("plansView", "crew");
    await boot(fake, ada, SATURDAY);
    expect(plans().querySelector(".plans-seg")).toBe(null);
    expect(plans().querySelector(".plans-actions")).not.toBe(null);
  }, 30000);
  it("a new simulated moment puts the crew's day back on the clock", async () => {
    page.handle.state.plans.day = "2026-09-03";
    page.handle.setTimeOverride(SATURDAY);
    expect(page.handle.state.plans.day).toBe(null);
  });
});

describe("an action that lands after its panel was closed or opened again leaves the panel alone", () => {
  let page, app, handle, fake, ada, bo, owls;

  beforeAll(async () => {
    fake = fakeBackend();
    [ada, bo] = ["ada", "bo"].map(n => fake.held(`${n}@example.test`));
    owls = fake.crew({ name: "Owls", creator: bo.id, members: [[bo.id, "Bo"], [ada.id, "Ada"]] });
    fake.crew({ name: "Larks", creator: ada.id, members: [[ada.id, "Ada"]] });
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app, handle } = page);
    await app.syncSettled();
    tapTab("plans");
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("a Leave that lands after Done and an event sheet opened: the event sheet stays open, and Plans shows the crew left behind", async () => {
    expect(el("crewPick").value).toBe(owls.id);
    press(el("crewManageBtn"));
    fake.defer = r => r.method === "DELETE";
    const from = fake.requests.length;
    el("crewLeave").click();
    await page.until(() => fake.requests.length > from, 5000, "the leave request");
    el("closeSheetCrew").click();
    app.openSheet("event", SAT[0]);
    fake.defer = null;
    fake.release();
    await page.until(() => !el("crewCreate").disabled, 5000, "the leave");
    await app.syncSettled();
    expect([el("sheetWrap").hidden, el("panel-event").hidden]).toEqual([false, false]);
    expect(words(plans().querySelector(".crew-title"))).toBe("Larks");
    app.closeSheet();
  });
  it("a Leave that lands after the panel was opened on another crew: that crew's view as it was, and the crew chosen kept", async () => {
    fake.join(owls, ada.id, "Ada");
    await app.runSync();
    await app.syncSettled();
    const larks = app.myCrews().find(c => c.name === "Larks").id;
    expect(el("crewPick").value).toBe(owls.id);
    press(el("crewManageBtn"));
    fake.defer = r => r.method === "DELETE";
    const from = fake.requests.length;
    el("crewLeave").click();
    await page.until(() => fake.requests.length > from, 5000, "the leave request");
    el("closeSheetCrew").click();
    el("crewPick").value = larks;
    el("crewPick").dispatchEvent(new Event("change", { bubbles: true }));
    press(el("crewManageBtn"));
    expect(words(el("sheetTitleCrew"))).toBe("Larks");
    fake.defer = null;
    fake.release();
    await page.until(() => !el("crewCreate").disabled, 5000, "the leave");
    await app.syncSettled();
    expect([el("sheetWrap").hidden, words(el("sheetTitleCrew")), shown(el("crewManage")), words(el("crewNote"))]).toEqual([false, "Larks", true, ""]);
    expect(handle.state.plans.crew).toBe(larks);
    el("closeSheetCrew").click();
  });
  it("a create that lands after the panel was opened again on a crew: that crew's view stays, and the new crew is chosen behind it", async () => {
    press(el("crewManageBtn"));
    press(el("crewMoreCreate"));
    el("crewNewName").value = "Robins";
    fake.defer = r => r.path === "/rest/v1/rpc/create_crew";
    const from = fake.requests.length;
    submit("crewCreateForm");
    await page.until(() => fake.requests.length > from, 5000, "the create request");
    el("closeSheetCrew").click();
    press(el("crewManageBtn"));
    expect(words(el("sheetTitleCrew"))).toBe("Larks");
    fake.defer = null;
    fake.release();
    await page.until(() => !el("crewCreate").disabled, 5000, "the create");
    await app.syncSettled();
    expect([words(el("sheetTitleCrew")), shown(el("crewManage")), shown(el("crewCreateForm")), words(el("crewNote"))]).toEqual(["Larks", true, false, ""]);
    expect(app.myCrews().find(c => c.id === handle.state.plans.crew).name).toBe("Robins");
    el("closeSheetCrew").click();
  });
  it("a create whose pull fails: the panel is headed with the new crew's name, and focus leaves the hidden form for the heading", async () => {
    press(el("crewManageBtn"));
    press(el("crewMoreCreate"));
    el("crewNewName").value = "Wrens";
    fake.offline = r => r.method === "GET";
    el("crewCreate").focus();
    submit("crewCreateForm");
    await settled(page);
    fake.offline = false;
    expect([words(el("sheetTitleCrew")), words(el("crewNote"))]).toEqual(["Wrens", "Wrens is made - it will show here once this phone reaches the server."]);
    expect(document.activeElement).toBe(el("sheetTitleCrew"));
    await app.runSync();
    await app.syncSettled();
    expect(words(el("crewNote"))).toBe("Wrens is made. Share the link to bring people in.");
    el("closeSheetCrew").click();
  });
  it("a Delete whose run fails after the panel was opened again on another crew: that panel says nothing of it", async () => {
    const wrens = app.myCrews().find(c => c.name === "Wrens").id, larks = app.myCrews().find(c => c.name === "Larks").id;
    el("crewPick").value = wrens;
    el("crewPick").dispatchEvent(new Event("change", { bubbles: true }));
    press(el("crewManageBtn"));
    fake.defer = r => r.method === "GET" && r.path.startsWith("/rest/v1/crews?");
    const reads = gets(fake, "crews").length;
    el("crewDelete").click();
    await page.until(() => gets(fake, "crews").length > reads, 5000, "the run after the delete, holding");
    el("closeSheetCrew").click();
    el("crewPick").value = larks;
    el("crewPick").dispatchEvent(new Event("change", { bubbles: true }));
    press(el("crewManageBtn"));
    fake.offline = r => r.method === "GET";
    fake.defer = null;
    fake.release();
    await page.until(() => !el("crewCreate").disabled, 5000, "the delete");
    await app.syncSettled();
    fake.offline = false;
    expect([words(el("sheetTitleCrew")), shown(el("crewManage")), words(el("crewNote"))]).toEqual(["Larks", true, ""]);
    await app.runSync();
    await app.syncSettled();
    expect(app.myCrews().some(c => c.id === wrens)).toBe(false);
    expect(el("sheetWrap").hidden).toBe(false);
    el("closeSheetCrew").click();
  });
});

describe("a Leave whose pull fails, then a pull that shows it", () => {
  let page, app, fake, ada, bo, cy, theirs;

  beforeAll(async () => {
    fake = fakeBackend();
    [ada, bo, cy] = ["ada", "bo", "cy"].map(n => fake.held(`${n}@example.test`));
    theirs = fake.crew({ name: "The crew", creator: ada.id, members: [[ada.id, "Ada"], [bo.id, "Bo"]] });
    fake.crew({ name: "Cy's crew", creator: cy.id, members: [[cy.id, "Cy"], [bo.id, "Bo"]] });
    signIn(fake, bo);
    seed("syncStamp", { user: bo.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app } = page);
    await app.syncSettled();
    tapTab("plans");
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("said so, with Done alone, and the crew still kept", async () => {
    expect(el("crewPick").value).toBe(theirs.id);
    press(el("crewManageBtn"));
    fake.offline = r => r.method === "GET";
    el("crewLeave").click();
    await settled(page);
    fake.offline = false;
    expect(words(el("crewNote"))).toBe("Done - it will show here once this phone reaches the server.");
    expect([el("sheetWrap").hidden, shown(el("crewManage")), shown(el("closeSheetCrew")), words(el("sheetTitleCrew"))]).toEqual([false, false, true, "The crew"]);
    expect(app.myCrews().length).toBe(2);
  });
  it("the pull that shows it gone closes the panel to Plans, on the crew left", async () => {
    await app.runSync();
    await page.until(() => el("sheetWrap").hidden, 5000, "the panel closed");
    await app.syncSettled();
    expect(words(plans().querySelector(".crew-title"))).toBe("Cy's crew");
  });
});

describe("the crew's day with a removed pick, and one the schedule does not hold", () => {
  let page, app, handle, fake, ada, bo;
  const data = structuredClone(fixture);
  for (const e of data.events) if (e.id === SAT[1] || e.id === SAT[5]) e.removed = true;

  beforeAll(async () => {
    fake = fakeBackend();
    [ada, bo] = ["ada", "bo"].map(n => fake.held(`${n}@example.test`));
    fake.crew({ name: "The crew", creator: ada.id, members: [[ada.id, "Ada"], [bo.id, "Bo"]] });
    pick(fake, bo, SAT[1]);
    pick(fake, bo, SAT[2]);
    pick(fake, bo, "no-such-event");
    pick(fake, ada, SAT[5]);
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake, data });
    ({ app, handle } = page);
    await app.syncSettled();
    tapTab("plans");
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("a crewmate's removed pick is marked and has no star to add it; the one not on this schedule is left out", () => {
    expect(blocks().map(b => [b.who, b.rows])).toEqual([["Ada (you) 1", [SAT[5]]], ["Bo 2", [SAT[1], SAT[2]]]]);
    const theirs = plans().querySelector(`.row[data-id="${SAT[1]}"][data-list="crew:${bo.id}"]`);
    expect(theirs.classList.contains("removed")).toBe(true);
    expect(theirs.querySelector(".star").disabled).toBe(true);
    theirs.querySelector(".star").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(handle.picks.get().has(SAT[1])).toBe(false);
  });
  it("its sheet offers no star to add it either", () => {
    app.openSheet("event", SAT[1]);
    expect(el("sheetStar").disabled).toBe(true);
    el("sheetStar").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(handle.picks.get().has(SAT[1])).toBe(false);
    app.closeSheet();
  });
  it("the reader's own removed pick is marked and can still be unstarred", () => {
    const mine = plans().querySelector(`.row[data-id="${SAT[5]}"][data-list="crew:${ada.id}"]`);
    expect(mine.classList.contains("removed")).toBe(true);
    expect(mine.querySelector(".star").disabled).toBe(false);
    mine.querySelector(".star").click();
    expect(handle.picks.get().has(SAT[5])).toBe(false);
  });
});

describe("crews forgotten at a change of owner, and a sessionless run with nothing kept", () => {
  let page, app, fake, ada, zed;

  beforeAll(async () => {
    fake = fakeBackend();
    [ada, zed] = ["ada", "zed"].map(n => fake.held(`${n}@example.test`));
    fake.crew({ name: "The crew", creator: ada.id, members: [[ada.id, "Ada"]] });
    signIn(fake, ada);
    seed("syncStamp", { user: ada.id, picks: null, follows: null });
    page = await bootPage({ backend: fake });
    ({ app } = page);
    await app.syncSettled();
    tapTab("plans");
    await app.syncSettled();
  }, 30000);
  afterAll(() => page.cleanup());

  it("another tab signs in as someone in no crew: Plans shows the rung with no tap", async () => {
    expect(words(plans().querySelector(".crew-title"))).toBe("The crew");
    signIn(fake, zed);
    await app.runSync();
    await app.syncSettled();
    expect(plans().querySelector(".crew-rung")).not.toBe(null);
  });
  it("with no session and no crews kept, a run draws nothing", async () => {
    await app.syncSettled();
    window.localStorage.removeItem(KEY("session"));
    await app.runSync();
    await app.syncSettled();
    const marker = plans().firstElementChild;
    await app.runSync();
    await app.syncSettled();
    expect(plans().firstElementChild).toBe(marker);
  });
});
