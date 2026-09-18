// @vitest-environment node
/* Rules over src/styles.css: what the smoke harness asserted with a regex over
   the built page's inlined stylesheet. One for one, the harness's own regex
   each time, under the harness's own section names; the number in brackets is
   the harness line (tests/PORT-LEDGER.md). "the CSS half" marks a harness
   assertion that also made a claim about the page: that half is a page test.

   These pin declarations, not rendering. jsdom computes no layout, so a rule
   over the text is the most that can be said here; what a phone actually
   draws is Playwright's to check when it arrives (DECISIONS #24). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const css = fs.readFileSync(path.join(ROOT, "src", "styles.css"), "utf8").replace(/\r\n/g, "\n");
/* the text that follows a selector's opening brace, as the harness sliced it */
const after = (anchor, length) => css.slice(css.indexOf(anchor), css.indexOf(anchor) + length);

describe("src/styles.css", () => {
  describe("boot: the first screen draws before the search index exists", () => {
    it("the sheet declares touch-action: none [88]", () => {
      expect(css).toMatch(/\.sheet\s*\{[^}]*touch-action:\s*none/);
    });
    it("the description still scrolls (touch-action: pan-y) [89]", () => {
      expect(css).toMatch(/\.ev-body\s*\{[^}]*touch-action:\s*pan-y/);
    });
    it("the sheet animates when it settles [90]", () => {
      expect(css).toMatch(/\.sheet\.settling\s*\{[^}]*transition:\s*transform/);
    });
    it("the settle animation is dropped under prefers-reduced-motion [91]", () => {
      /* either shape of the media query: the rule after a closed block, or inside one */
      const afterBlock = /prefers-reduced-motion[^}]*\}[\s\S]{0,200}?\.sheet\.settling\s*\{[^}]*transition:\s*none/, inside = /@media \(prefers-reduced-motion: reduce\) \{[\s\S]{0,240}?\.sheet\.settling/;
      expect(afterBlock.test(css) || inside.test(css)).toBe(true);
    });
  });

  describe("no guessing: the hero, the mini-bar and the map, with and without a pick on now", () => {
    it("the hero's walk estimate is a muted line [191, the CSS half]", () => {
      expect(css).toMatch(/\.hero \.hthen \{[^}]*var\(--muted\)/);
    });
  });

  describe("the control strip: two rows of two, one footprint", () => {
    it("the actions row is two equal columns [436]", () => {
      expect(css).toMatch(/\.mine-actions \{[^}]*grid-template-columns: 1fr 1fr/);
    });
    it("actions and toggle share a height [439]", () => {
      const a = css.match(/\.mine-actions \.btn \{[^}]*height: (\d+)px/), b = css.match(/\.view-toggle button \{[^}]*height: (\d+)px/);
      expect(a && a[1]).toBeTruthy();
      expect(a[1]).toBe(b && b[1]);
    });
    it("and a corner radius [442]", () => {
      const a = css.match(/\.mine-actions \.btn \{[^}]*border-radius: (\d+)px/), b = css.match(/\.view-toggle button \{[^}]*border-radius: (\d+)px/);
      expect(a && a[1]).toBeTruthy();
      expect(a[1]).toBe(b && b[1]);
    });
    it("and a gap [445]", () => {
      const a = css.match(/\.mine-actions \{[^}]*gap: (\d+)px/), b = css.match(/\.view-toggle \{[^}]*gap: (\d+)px/);
      expect(a && a[1]).toBeTruthy();
      expect(a[1]).toBe(b && b[1]);
    });
  });

  describe("step 5: timeline is the default view on Mine", () => {
    it("disabled buttons look disabled [512]", () => {
      expect(css).toMatch(/\.btn\[disabled\] \{[^}]*opacity/);
    });
  });

  describe("the header pads for the status bar on phones that draw under it", () => {
    it("a top inset variable exists alongside the bottom one [749]", () => {
      expect(css).toContain("--safe-top: env(safe-area-inset-top");
    });
    it("and the header adds it to its top padding [751]", () => {
      expect(after(".hdr {", 400)).toMatch(/padding: calc\(10px \+ var\(--safe-top\)\)/);
    });
    it("the root refuses the overscroll stretch, so a fixed nav cannot bounce with it [755]", () => {
      expect(after("html {", 200)).toContain("overscroll-behavior-y: none");
    });
    it("main is the scroll container [777]", () => {
      expect(after("main {", 400)).toMatch(/position: fixed/);
      expect(after("main {", 400)).toMatch(/overflow-y: auto/);
    });
    it("and the page around it cannot scroll [778]", () => {
      expect(css).toMatch(/html, body \{[^}]*overflow: hidden/);
    });
    it("the header is fixed above it [779]", () => {
      expect(css).toMatch(/\.hdr \{[^}]*position: fixed/);
    });
  });

  describe("a cancelled event says so, not just a strike-through", () => {
    it("in the warning colour [912]", () => {
      expect(css).toMatch(/\.cancelled-tag \{[^}]*var\(--warn\)/);
    });
  });

  describe("step 0: the nav - Browse renamed to Search, For you folded into Explore, Map added", () => {
    it("the nav lays out five columns [939]", () => {
      expect(css).toMatch(/repeat\(5, 1fr\)/);
    });
    it("with labels back at 14px (.875rem, so Larger text can scale them) [940]", () => {
      expect(css).toMatch(/\.nav button \{[^}]*font-size: \.875rem/);
    });
    it("and icons back at 24px [941]", () => {
      expect(css).toMatch(/\.nav button svg \{[^}]*width: 24px/);
    });
  });

  describe("step 2: Explore", () => {
    it("and the count stays readable on a pressed chip [1071]", () => {
      expect(css).toMatch(/\.explore-jump \.chip\[aria-pressed="true"\] \.n \{[^}]*color: inherit/);
    });
  });

  describe("browse header: All first, and the key rows stay put", () => {
    it("it is declared sticky [1263]", () => {
      expect(css).toMatch(/\.controls-sticky\s*\{[^}]*position:\s*sticky/);
    });
    it("it parks under the header, by measured height [1264]", () => {
      expect(css).toMatch(/\.controls-sticky\s*\{[^}]*top:\s*var\(--hdr-h/);
    });
  });

  describe("Map, step 1: the base map", () => {
    it("skybridges are dashed [1428]", () => {
      expect(css).toMatch(/\.map-bridge \{[^}]*stroke-dasharray/);
    });
    it("a nine-letter map label takes a smaller size to fit a 60 px block [1433, the CSS half]", () => {
      expect(css).toMatch(/\.map-hotel text\.long \{[^}]*font-size: 9\.5px/);
    });
    it("labels use the app font and blocks are an opaque low tint of their hue with a full stroke [1438]", () => {
      expect(css).toMatch(/\.map-hotel text \{[^}]*var\(--font\)/);
      expect(css).toMatch(/\.map-hotel rect \{[^}]*color-mix\(in srgb, var\(--h\) 18%, var\(--surface\)\)/);
      expect(css).toMatch(/\.map-hotel rect \{[^}]*stroke: var\(--h\)/);
    });
  });

  describe("Map, step 3: pick pills and the hotel sheet", () => {
    it("pills are the mine gold [1477]", () => {
      expect(css).toMatch(/\.map-pill rect \{[^}]*var\(--gold\)/);
      expect(css).toMatch(/\.map-pill text \{[^}]*var\(--gold-ink\)/);
    });
  });

  describe("Map, step 4: now and next", () => {
    it("rings are gold and the next one pulses [1539]", () => {
      expect(css).toMatch(/\.map-ring \{[^}]*var\(--gold\)/);
      expect(css).toMatch(/\.map-ring\.next \{[^}]*animation: map-pulse/);
      expect(css).toMatch(/@keyframes map-pulse/);
    });
    it("and holds still under reduced motion [1540]", () => {
      expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ \.map-ring\.next \{ animation: none/);
    });
  });

  describe("Map fixes", () => {
    it("a late leave-by on the map card is in the warn colour [1581, the CSS half]", () => {
      expect(css).toMatch(/\.next-card \.nc-when\.late \{ color: var\(--warn\)/);
    });
  });

  describe("polish 1: a compact header", () => {
    it("in the clock style at a smaller size that follows the phone's width, and it never wraps [1620]", () => {
      expect(css).toMatch(/\.hdr \.hdr-line \{[^}]*white-space: nowrap/);
      expect(css).toMatch(/\.hdr \.hdr-line \{[^}]*font-size: clamp\(\.8125rem, 4vw, \.9375rem\)/);
      expect(css).toMatch(/\.hdr \.hdr-line \{[^}]*font-weight: 700/);
      expect(css).not.toMatch(/\.hdr \.clock \{/);
    });
    it("when the header line would clip, the word refreshed goes first [1622, the CSS half]", () => {
      expect(css).toMatch(/\.hdr \.hdr-line\.tight \.word \{ display: none/);
    });
    it("and if that is not enough, the line steps down a size [1625]", () => {
      /* the source half of this harness row (the line gains .tighter by measurement) is a page test in 4b-ii */
      expect(css).toMatch(/\.hdr \.hdr-line\.tighter \{ font-size: \.8125rem/);
    });
    it("the brand on Now is a small label [1629, the CSS half]", () => {
      expect(css).toMatch(/\.hdr \.brand \{[^}]*font-size: \.75rem/);
    });
  });

  describe("polish 2: sticky map chips, and a map that fits the screen", () => {
    it("width first: the SVG takes the content width and its own height, and shrinks, centred, only when the tab would not fit, down to a floor [1640]", () => {
      expect(css).toMatch(/#view-map \{ display: flex; flex-direction: column; height: calc\(100dvh - var\(--hdr-h, 63px\) - 76px - var\(--safe-bottom\)\)/);
      expect(css).toMatch(/\.map \{[^}]*flex: 0 1 auto/);
      expect(css).toMatch(/\.map \{[^}]*min-height: 200px/);
      expect(css).toMatch(/\.map \{[^}]*width: 100%/);
      expect(css).toMatch(/\.map \{[^}]*height: auto/);
      expect(css).not.toMatch(/\.map \{[^}]*max-height/);
    });
    it("the card's padding matches the frame's inset around the drawing [1643]", () => {
      expect(css).toMatch(/\.next-card \{[^}]*padding: 12px 14px/);
    });
    it("no chrome arithmetic remains; the mini-bar never shows here [1644]", () => {
      expect(css).not.toMatch(/--map-chrome/);
      expect(css).not.toMatch(/has-minibar \.map/);
    });
    it("the card band under the map keeps its own height [1645, the CSS half]", () => {
      expect(css).toMatch(/\.map-under \{ flex: none/);
    });
  });

  describe("polish 6: Settings, the everyday two up top and the rest under Advanced", () => {
    it("Advanced scrolls inside the sheet when it is long [1705]", () => {
      expect(css).toMatch(/\.advanced-body \{[^}]*overflow-y: auto/);
      expect(css).toMatch(/\.advanced-body \{[^}]*touch-action: pan-y/);
    });
  });

  describe("polish 7: larger text", () => {
    it("which sets the root size to 115% [1720]", () => {
      expect(css).toMatch(/html\.bigtext \{ font-size: 115%; \}/);
    });
    it("every text size outside the map's SVG is in rem, so it follows the root [1726]", () => {
      /* the map's SVG text is sized in the drawing's own units (row 1727) */
      const scaled = css.split("\n").filter(l => !/^\.map-(street-label|hotel text|park text|pill text)/.test(l)).join("\n");
      expect(scaled).not.toMatch(/font-size: [\d.]+px/);
      expect(scaled).toMatch(/font-size: [\d.]+rem/);
      expect(css).toMatch(/body \{[^}]*font-size: 1\.0625rem/);
    });
    it("the map's labels stay in the SVG's own units, scaled with the drawing rather than the toggle [1727]", () => {
      expect(css).toMatch(/\.map-hotel text \{[^}]*font-size: 11px/);
      expect(css).toMatch(/\.map-pill text \{[^}]*font-size: 11px/);
    });
    it("timeline blocks that cannot hold their text give way by measurement: one-line title first, then no room [1729]", () => {
      /* the source half of this harness row (blocks give way by measurement) is a page test in 4b-ii */
      expect(css).toMatch(/\.tl-block\.tight \.tb-title \{[^}]*text-overflow: ellipsis/);
      expect(css).toMatch(/\.tl-block\.tighter \.tb-room \{ display: none/);
    });
    it("the hour gutter is in rem and its labels never wrap [1732]", () => {
      expect(css).toMatch(/\.tl-hour span \{[^}]*white-space: nowrap/);
      expect(css).toMatch(/\.tl-grid \{[^}]*margin-left: 3rem/);
      expect(css).toMatch(/\.tl-hour \{[^}]*left: -3rem/);
    });
  });

  describe("map card: the next pick under the map", () => {
    it("truncated to one line [1773]", () => {
      expect(css).toMatch(/\.next-on \{[^}]*white-space: nowrap/);
      expect(css).toMatch(/\.next-on \{[^}]*text-overflow: ellipsis/);
    });
    it("leave-by in gold, warn colour when late [1774]", () => {
      expect(css).toMatch(/\.next-card \.nc-when\.leave \{ color: var\(--gold\)/);
      expect(css).toMatch(/\.next-card \.nc-when\.late \{ color: var\(--warn\)/);
    });
    it("the title is row style, up to two lines [1779]", () => {
      expect(css).toMatch(/\.next-card \.nc-title \{[^}]*-webkit-line-clamp: 2/);
      expect(css).toMatch(/\.next-card \.nc-title \{[^}]*font-size: 1\.125rem/);
    });
  });

  describe("hotel names next to rooms", () => {
    it("in a row the room part may be shortened with an ellipsis, the hotel never [1827]", () => {
      expect(css).toMatch(/\.room \{[^}]*display: inline-flex/);
      expect(css).toMatch(/\.room \.rr \{[^}]*text-overflow: ellipsis/);
      expect(css).toMatch(/\.room \.rh \{ flex: none/);
    });
  });

  describe("perf: a query typed before the index is ready waits for it; typing draws once", () => {
    it("while the index builds the search box says so, quietly [1842, the CSS half]", () => {
      expect(css).toMatch(/\.search\.indexing::placeholder \{[^}]*var\(--dim\)/);
    });
  });

  describe("the dev-build mark: only on a build stamped with a channel", () => {
    it("the dev-build mark is fixed and takes no taps [1996, the CSS half]", () => {
      expect(css).toMatch(/\.devmark \{[^}]*pointer-events: none/);
      expect(css).toMatch(/\.devmark \{[^}]*position: fixed/);
    });
    it("and it moves up above the mini-bar [1997]", () => {
      expect(css).toMatch(/body\.has-minibar \.devmark \{/);
    });
  });
});
