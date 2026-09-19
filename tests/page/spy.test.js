/* The scroll spy on Explore: a scroll of main queues one animation frame, and
   the frame marks the jump chip of the section on screen - unless a tapped
   chip is holding the mark while its smooth scroll runs. No other test fires
   a scroll on main, and a hidden browser pane delivers no frames, so this is
   the path's only check. New tests, not rows of tests/PORT-LEDGER.md, so
   their titles carry no harness line.

   Frames are queued by hand: requestAnimationFrame is replaced, after boot,
   by a function that keeps the callback, and the test runs it. The listener
   looks requestAnimationFrame up when it fires, so that is soon enough.
   jsdom has no layout: every section header sits at 0, so by position the
   last section is always the one on screen. That makes the first chip the
   telling one to hold - without the hold, a frame moves the mark off it. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

describe("the scroll spy on Explore", () => {
  let page, app, state, hadFrame, first, last;
  const frames = [];
  const scroll = times => { for (let i = 0; i < times; i++) document.querySelector("main").dispatchEvent(new Event("scroll")); };
  const runFrames = () => frames.splice(0).forEach(callback => callback(performance.now()));
  const chips = () => [...document.querySelectorAll('#view-explore [data-act="explore-jump"]')];
  const pressed = () => chips().filter(chip => chip.getAttribute("aria-pressed") === "true").map(chip => chip.dataset.section);

  beforeAll(async () => {
    page = await bootPage();
    ({ app } = page);
    state = page.handle.state;
    hadFrame = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    state.tab = "explore"; state.explore.page = null; page.handle.render();
    const sections = chips().map(chip => chip.dataset.section);
    first = sections[0]; last = sections[sections.length - 1];
  }, 30000);
  afterAll(async () => {
    globalThis.requestAnimationFrame = hadFrame;
    await page.cleanup();
  });

  it("a burst of scroll events queues one frame", () => {
    expect(first).toBeTruthy();
    expect(last).not.toBe(first);
    frames.length = 0;
    scroll(3);
    expect(frames.length).toBe(1);
  });

  it("and once it has run, the next burst queues another", () => {
    app.markActiveSection(first);              // so that the frame has a mark to move
    expect(pressed()).toEqual([first]);
    runFrames();
    expect(pressed()).toEqual([last]);
    scroll(2);
    expect(frames.length).toBe(1);
    runFrames();                               // leave the gate open for the next test
  });

  it("a jump chip holds the spy", () => {
    chips()[0].click();
    expect(pressed()).toEqual([first]);
    scroll(1);
    expect(frames.length).toBe(1);
    runFrames();
    expect(pressed()).toEqual([first]);
  });

  it("and once the hold is over the spy marks by position again", () => {
    app.holdSpyUntil(0);
    scroll(1);
    runFrames();
    expect(pressed()).toEqual([last]);
  });
});
