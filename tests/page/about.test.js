/* About this app (W32; DECISIONS #59, #92; docs/screens/contract.md, section
   9): the sheet's eighth panel, behind Settings' row. Its words are a
   statement to the reader, so each build's are pinned here whole, as they
   were ruled - a sentence changed in src/about.js fails here until it is
   changed here too. And its one way out, which is back: the button, the
   backdrop, a swipe down and Escape each show Settings again, as it was.
   New tests, not rows of tests/PORT-LEDGER.md, so their titles carry no
   harness line. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { fakeBackend } from "../helpers/backend.js";
import { mutationsDuring, touch } from "../helpers/act.js";

const el = id => document.getElementById(id);
const shown = node => !!node && !node.closest("[hidden]");
const text = node => node.textContent.replace(/\s+/g, " ").trim();
/* The body's words, in order: each paragraph, heading, label, list item and
   link, by its tag. */
const words = () => [...el("aboutBody").querySelectorAll("p, h3, h4, li, a")].map(node => [node.tagName, text(node)]);

const TOP = [
  ["P", "Unofficial. A planner for Dragon Con made by a fan, for friends. Not affiliated with or endorsed by Dragon Con."],
  ["P", "The schedule is read from the con's public schedule and can run behind it. The con's own is the last word."],
  ["H3", "Dragon Con's own"],
  ["P", "Hours, maps, policies, vendors and everything else:"],
  ["A", "Dragon Con's official site and app"],
  ["H3", "What we store"],
];
const WITH_A_BACKEND = [
  ...TOP,
  ["H4", "On this phone"],
  ["P", "Your picks, what you follow and mute, your settings, and a copy of the schedule so the app opens without signal. Once you have a crew or an email, also your sign-in, your crew - its names, its invite link and its picks - and any change still waiting to be sent. All of it is kept in this browser; clearing its site data removes it from this phone."],
  ["H4", "On our server"],
  ["P", "Nothing, until you start or join a crew or add your email. From then on the server keeps:"],
  ["LI", "your picks and follows, each with the time it last changed, the ones you took back included"],
  ["LI", "your email, if you added one"],
  ["LI", "the name you gave each crew you're in and when you joined it, and any crew you started"],
  ["P", "Mutes and settings never leave this phone."],
  ["H4", "What your crew sees"],
  ["P", "The name you gave that crew, and your stars. Their phones are also told when you take a star back. Never your follows, your mutes or your email."],
  ["H4", "What the controls do"],
  ["LI", "Remove all picks unstars everything. On the server each pick stays, marked unstarred."],
  ["LI", "Sign out takes your sign-in off this phone, and your crew with it until you sign in again. Your plan stays here and on the server."],
  ["LI", "Leave a crew, or delete one you started, and its members stop seeing your picks once their phones next sync."],
  ["H4", "Who else is involved"],
  ["P", "GitHub serves the app, Google serves the typeface and Supabase runs the server. Each sees your phone's internet address when it answers, as any website does, and may log it; Supabase keeps it, and what browser you used, with your sign-in. Resend sends the sign-in code, so it sees your email address. No ads, no analytics, no cookies, and the app never asks where you are."],
];
const WITH_NONE = [
  ...TOP,
  ["H4", "On this phone"],
  ["P", "Your picks, what you follow and mute, your settings, and a copy of the schedule so the app opens without signal. All of it is kept in this browser; clearing its site data removes it."],
  ["H4", "On a server"],
  ["P", "Nothing. This copy of the app has no server: everything stays on this phone."],
  ["H4", "Who else is involved"],
  ["P", "GitHub serves the app and Google serves the typeface. Each sees your phone's internet address when it answers, as any website does, and may log it. No ads, no analytics, no cookies, and the app never asks where you are."],
];

/* What neither build's panel holds: a Delete, which is the next pull
   request's, a link to the code, a contact, a version, a second link. */
function nothingElse() {
  const body = el("aboutBody"), said = text(el("panel-about"));
  expect(said).not.toMatch(/delete my|github\.com|the code|contact|version|@/i);
  expect([...el("panel-about").querySelectorAll("a")]).toEqual([el("aboutLink")]);
  expect([...el("panel-about").querySelectorAll("button")]).toEqual([el("aboutBack")]);
  expect(body.querySelectorAll("input, select, textarea, form").length).toBe(0);
}

describe("About this app, on a build with no backend", () => {
  let page, handle;
  const gear = () => el("settingsBtn");
  const openAbout = () => { gear().focus(); gear().click(); el("aboutRow").click(); };

  beforeAll(async () => { page = await bootPage(); ({ handle } = page); }, 30000);
  afterAll(() => page.cleanup());

  describe("the row opens it", () => {
    beforeAll(openAbout);

    it("the about panel is shown in Settings' place, in the same sheet", () => {
      expect(el("sheetWrap").hidden).toBe(false);
      expect(shown(el("panel-about"))).toBe(true);
      expect(el("panel-settings").hidden).toBe(true);
      expect([...document.querySelectorAll(".sheet-panel")].filter(shown)).toEqual([el("panel-about")]);
    });
    it("its heading says About this app, names the dialog and has focus", () => {
      expect(text(el("sheetTitleAbout"))).toBe("About this app");
      expect(el("sheet").getAttribute("aria-labelledby")).toBe("sheetTitleAbout");
      expect(document.activeElement).toBe(el("sheetTitleAbout"));
    });
    it("it is a heading, one body and a foot with one button, Back to Settings", () => {
      const panel = el("panel-about");
      expect([...panel.children].map(c => c.id || c.className)).toEqual(["sheetTitleAbout", "aboutBody", "sheet-foot"]);
      expect(el("aboutBody").classList.contains("sheet-body")).toBe(true);
      expect([...panel.lastElementChild.querySelectorAll("*")]).toEqual([el("aboutBack")]);
      expect(text(el("aboutBack"))).toBe("Back to Settings");
    });
    it("the words, whole: with no backend What we store is three parts, and the server's says this copy has none", () => {
      expect(page.app.hasBackend).toBe(false);
      expect(words()).toEqual(WITH_NONE);
      expect(text(el("aboutBody"))).toContain("This copy of the app has no server");
      expect(text(el("aboutBody"))).not.toMatch(/our server|Supabase|Resend|crew|Sign out/);
    });
    it("Unofficial is the one thing in bold", () => {
      expect([...el("aboutBody").querySelectorAll("b")].map(text)).toEqual(["Unofficial."]);
    });
    it("the one link is Dragon Con's own site, in a new tab, with rel=noopener", () => {
      const link = el("aboutLink");
      expect(link.getAttribute("href")).toBe("https://www.dragoncon.org/");
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener");
    });
    it("and nothing else: no Delete, no link to the code, no contact, no second link", () => nothingElse());
  });

  describe("each way out is back to Settings, as it was", () => {
    /* Settings, scrolled; the about panel over it; and the scroll a browser
       would have lost with the hidden panel, lost - jsdom keeps it. */
    let nodes, table;
    function arrive() {
      if (!el("sheetWrap").hidden) { if (shown(el("panel-about"))) handle.closeSheet(); handle.closeSheet(); }
      gear().focus();
      gear().click();
      nodes = [...el("settingsBody").children];
      table = el("walkTable").firstChild;
      el("settingsBody").scrollTop = 140;
      el("aboutRow").click();
      el("settingsBody").scrollTop = 0;
      expect(shown(el("panel-about"))).toBe(true);
    }
    function backOnSettings() {
      expect(el("sheetWrap").hidden).toBe(false);
      expect(el("panel-about").hidden).toBe(true);
      expect(shown(el("panel-settings"))).toBe(true);
      expect(el("sheet").getAttribute("aria-labelledby")).toBe("sheetTitle");
      expect([...el("settingsBody").children]).toEqual(nodes);       // the same nodes
      expect(el("walkTable").firstChild).toBe(table);                // shown, not filled again
      expect(el("settingsBody").scrollTop).toBe(140);
      expect(document.activeElement).toBe(el("aboutRow"));
    }

    it("the button", () => {
      arrive();
      el("aboutBack").click();
      backOnSettings();
    });
    it("a tap on the backdrop", () => {
      arrive();
      el("sheetBack").click();
      backOnSettings();
    });
    it("Escape", () => {
      arrive();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      backOnSettings();
    });
    it("a swipe down on the heading, once the sheet has settled - and the sheet is at rest again", async () => {
      arrive();
      touch(el("sheetTitleAbout"), "touchstart", { y: 100 });
      touch(el("sheetTitleAbout"), "touchmove", { y: 300 });
      touch(el("sheetTitleAbout"), "touchend", null);
      await page.until(() => el("panel-about").hidden, 2000, "the swipe to settle");
      backOnSettings();
      expect(el("sheet").style.transform).toBe("");
      expect(el("sheet").classList.contains("settling")).toBe(false);
      expect(el("sheetBack").style.opacity).toBe("");
    });
    it("a swipe down on the foot, where the transition does end: the timer that follows it closes nothing", async () => {
      arrive();
      touch(el("aboutBack"), "touchstart", { y: 100 });
      touch(el("aboutBack"), "touchmove", { y: 300 });
      touch(el("aboutBack"), "touchend", null);
      el("sheet").dispatchEvent(new Event("transitionend"));
      backOnSettings();
      await new Promise(resolve => setTimeout(resolve, 400));
      backOnSettings();
    });
    it("a drag in its body scrolls it while it has more than its room, and moves the sheet where it fits", () => {
      arrive();
      const body = el("aboutBody"), sized = (clientHeight, scrollHeight) => { for (const [name, value] of Object.entries({ clientHeight, scrollHeight })) Object.defineProperty(body, name, { configurable: true, value }); };
      sized(417, 568);
      touch(body.querySelector("p"), "touchstart", { y: 100 });
      touch(body.querySelector("p"), "touchmove", { y: 300 });
      expect(el("sheetBack").classList.contains("dragging")).toBe(false);
      expect(el("sheet").style.transform).toBe("");
      touch(body.querySelector("p"), "touchend", null);
      sized(600, 568);
      touch(body.querySelector("p"), "touchstart", { y: 100 });
      touch(body.querySelector("p"), "touchmove", { y: 130 });
      expect(el("sheet").style.transform).toBe("translateY(30px)");
      touch(body.querySelector("p"), "touchcancel", null);
      expect(shown(el("panel-about"))).toBe(true);
    });
    it("Done then closes the sheet, and the gear has focus", () => {
      arrive();
      el("aboutBack").click();
      el("closeSheet").click();
      expect(el("sheetWrap").hidden).toBe(true);
      expect(document.activeElement).toBe(gear());
    });
    it("the page's own close goes back first, then closes", () => {
      arrive();
      handle.closeSheet();
      backOnSettings();
      handle.closeSheet();
      expect(el("sheetWrap").hidden).toBe(true);
    });
  });

  describe("what leaves it alone, and what lets it go", () => {
    it("a pull's redraw while it is open writes nothing in it, and leaves its scroll and focus where they were", () => {
      openAbout();
      const body = el("aboutBody");
      body.scrollTop = 90;
      const records = mutationsDuring(el("sheet"), () => handle.render());
      expect(records.filter(r => el("panel-about").contains(r.target) || el("panel-settings").contains(r.target))).toEqual([]);
      expect(shown(el("panel-about"))).toBe(true);
      expect(el("aboutBody")).toBe(body);
      expect(body.scrollTop).toBe(90);
      expect(document.activeElement).toBe(el("sheetTitleAbout"));
      handle.closeSheet();
      handle.closeSheet();
    });
    it("opened again it is drawn afresh, at its top", () => {
      openAbout();
      const was = el("aboutBody");
      was.scrollTop = 200;
      el("aboutBack").click();
      el("aboutRow").click();
      expect(el("aboutBody")).not.toBe(was);
      expect(el("aboutBody").scrollTop).toBe(0);
      expect(words()).toEqual(WITH_NONE);
      handle.closeSheet();
      handle.closeSheet();
    });
    it("Settings opened afresh never shows it", () => {
      openAbout();
      el("aboutBack").click();
      el("closeSheet").click();
      gear().click();
      expect(shown(el("panel-settings"))).toBe(true);
      expect(el("panel-about").hidden).toBe(true);
      handle.closeSheet();
      expect(el("sheetWrap").hidden).toBe(true);
    });
    it("any other panel opening lets it go: that panel's close closes the sheet, focus on the gear", () => {
      openAbout();
      handle.openSheet("event", handle.events[0].id);
      expect(el("panel-about").hidden).toBe(true);
      expect(shown(el("panel-event"))).toBe(true);
      handle.closeSheet();
      expect(el("sheetWrap").hidden).toBe(true);
      expect(document.activeElement).toBe(gear());
    });
    it("it opens from Settings alone: asked for with the sheet shut, or over another panel, nothing happens", () => {
      handle.openSheet("about");
      expect(el("sheetWrap").hidden).toBe(true);
      handle.openSheet("event", handle.events[0].id);
      handle.openSheet("about");
      expect(shown(el("panel-event"))).toBe(true);
      expect(el("panel-about").hidden).toBe(true);
      handle.closeSheet();
      expect(el("sheetWrap").hidden).toBe(true);
    });
  });
});

describe("About this app, on a build with a backend", () => {
  let page, fake;

  beforeAll(async () => {
    fake = fakeBackend();
    page = await bootPage({ backend: fake });
    el("settingsBtn").click();
    el("aboutRow").click();
  }, 30000);
  afterAll(() => { page.handle.closeSheet(); page.handle.closeSheet(); return page.cleanup(); });

  it("the words, whole: What we store is five parts, the server's among them", () => {
    expect(page.app.hasBackend).toBe(true);
    expect(words()).toEqual(WITH_A_BACKEND);
    expect(text(el("aboutBody"))).not.toContain("has no server");
  });
  it("the three controls it explains are in bold, with Unofficial", () => {
    expect([...el("aboutBody").querySelectorAll("b")].map(text)).toEqual(["Unofficial.", "Remove all picks", "Sign out", "Leave"]);
  });
  it("the one link is Dragon Con's own site, in a new tab, with rel=noopener", () => {
    const link = el("aboutLink");
    expect([link.getAttribute("href"), link.getAttribute("target"), link.getAttribute("rel")]).toEqual(["https://www.dragoncon.org/", "_blank", "noopener"]);
  });
  it("and nothing else: no Delete, no link to the code, no contact, no second link", () => nothingElse());
  it("opening it asked the server for nothing", async () => {
    await page.app.syncSettled();
    expect(fake.requests).toEqual([]);
  });
  it("the way back is the same: the button shows Settings, Keep your plan as it was, focus on the row", () => {
    const keep = el("keep").firstElementChild;
    el("aboutBack").click();
    expect(el("panel-about").hidden).toBe(true);
    expect(shown(el("panel-settings"))).toBe(true);
    expect(el("keep").firstElementChild).toBe(keep);
    expect(document.activeElement).toBe(el("aboutRow"));
    el("aboutRow").click();
  });
});
