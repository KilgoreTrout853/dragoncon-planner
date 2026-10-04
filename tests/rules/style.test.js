// @vitest-environment node
/* Rules over src/styles.css: what the smoke harness asserted with a regex over
   the built page's inlined stylesheet. One for one, the harness's own regex
   each time, under the harness's own section names; the number in brackets is
   the harness line (tests/PORT-LEDGER.md). "the CSS half" marks a harness
   assertion that also made a claim about the page: that half is a page test.

   These pin declarations, not rendering. jsdom computes no layout, so a rule
   over the text is the most that can be said here; what a browser actually
   draws is the browser tests' to check (tests/browser/, DECISIONS #81). */
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

  /* New rules, not ledger rows (DECISIONS #40): the leave-by's colours are
     gone, and the hero's line is its time in gold and what follows it
     quieter, in warn for a gap under the walk or an overlap. */
  describe("the quieter Now: no leave-by, and the hero's band", () => {
    it("no rule marks anything late any more", () => {
      expect(css).not.toMatch(/\.late\b/);
    });
    it("the hero's line: its time in gold, what follows in the muted weight, the two warn bands in warn", () => {
      expect(css).toMatch(/\.hero \.hwhen \{[^}]*color: var\(--gold\)/);
      expect(css).toMatch(/\.hero \.hthen \{[^}]*font-weight: 400/);
      expect(css).toMatch(/\.hero \.hthen\.warn, \.hero \.hthen\.warn b \{ color: var\(--warn\)/);
      expect(css).not.toMatch(/\.hleave/);
    });
  });

  describe("the control strip: two rows of two, one footprint", () => {
    it("the actions row is two equal columns [436]", () => {
      expect(css).toMatch(/\.plans-actions \{[^}]*grid-template-columns: 1fr 1fr/);
    });
    it("actions and toggle share a height [439]", () => {
      const a = css.match(/\.plans-actions \.btn \{[^}]*height: (\d+)px/), b = css.match(/\.view-toggle button \{[^}]*height: (\d+)px/);
      expect(a && a[1]).toBeTruthy();
      expect(a[1]).toBe(b && b[1]);
    });
    it("and a corner radius [442]", () => {
      const a = css.match(/\.plans-actions \.btn \{[^}]*border-radius: (\d+)px/), b = css.match(/\.view-toggle button \{[^}]*border-radius: (\d+)px/);
      expect(a && a[1]).toBeTruthy();
      expect(a[1]).toBe(b && b[1]);
    });
    it("and a gap [445]", () => {
      const a = css.match(/\.plans-actions \{[^}]*gap: (\d+)px/), b = css.match(/\.view-toggle \{[^}]*gap: (\d+)px/);
      expect(a && a[1]).toBeTruthy();
      expect(a[1]).toBe(b && b[1]);
    });
  });

  describe("step 5: timeline is the default view on Plans", () => {
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
    it("and the tag leading a struck title is not struck: an inline-block, which the strike does not reach", () => {
      expect(css).toMatch(/(^|\n)\.removed-tag, \.cancelled-tag \{[^}]*display: inline-block/);
    });
    it("nor is a pick's star before it: an inline-block too, its gap a margin and not a space the box would drop", () => {
      const star = (css.match(/(^|\n)\.row\.mine \.title::before \{([^}]*)\}/) || [])[2] || "";
      expect(star).toMatch(/content: "★";/);
      expect(star).toMatch(/display: inline-block;/);
      expect(star).toMatch(/margin-right: \.2em;/);
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
      expect(css).toMatch(/#view-map \{ display: flex; flex-direction: column; height: calc\(100dvh - var\(--hdr-h, 63px\) - var\(--nav-h\) - 5px\)/);
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
      /* the map's SVG text is sized in the drawing's own units (row 1727); the
         crew's count on the map, since step 5a, is SVG text too */
      const scaled = css.split("\n").filter(l => !/^\.map-(street-label|hotel text|park text|pill text|crew text)/.test(l)).join("\n");
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
    /* 1581's CSS half, the late leave-by in warn, is merged into this one:
       the card no longer says when to leave (DECISIONS #40). */
    it("the timing line has one look: no leave-by in gold, and nothing late in warn [1774, and 1581, the CSS half]", () => {
      expect(css).toMatch(/\.next-card \.nc-when \{[^}]*font-weight: 700/);
      expect(css).not.toMatch(/\.nc-when\.(leave|late)/);
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

  /* The row's lines (DECISIONS #73): the rules that make a part drop whole
     rather than be clipped. What a phone draws with them is the browser
     check's; these hold the declarations. */
  describe("the row's second and third lines", () => {
    const rule = selector => (css.match(new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`)) || [])[2] || "";
    it("are each one wrapping flex line, clipped, whose words never wrap", () => {
      const both = rule(".when-where, .flags");
      expect(both).toMatch(/display: flex/);
      expect(both).toMatch(/flex-wrap: wrap/);
      expect(both).toMatch(/overflow: clip/);
      expect(both).toMatch(/white-space: nowrap/);
      expect(rule(".when-where")).toMatch(/height: 1\.3em/);
      expect(rule(".flags")).toMatch(/height: max\(19px, 1\.3em\)/);
    });
    it("the level is a part of its own that never shrinks, after one that may", () => {
      expect(rule(".when-where .level")).toMatch(/flex: none/);
      expect(rule(".when-where .at")).toMatch(/min-width: 0/);
      expect(rule(".when-where .when")).toMatch(/flex: none/);
    });
    it("a part of line 3 may shrink to an ellipsis, and a warning flag is in the warning colour", () => {
      expect(rule(".flags > *")).toMatch(/min-width: 0;/);
      expect(rule(".flags > *")).toMatch(/text-overflow: ellipsis/);
      expect(rule(".flags .flag.warn")).toMatch(/color: var\(--warn\)/);
    });
    it("the overlap flag counts as 8em, then takes the room left up to its whole text, in the warning colour", () => {
      const o = rule(".flags .overlap");
      expect(o).toMatch(/flex: 1 1 8em;/);
      expect(o).toMatch(/max-width: max-content;/);
      expect(o).toMatch(/color: var\(--warn\)/);
    });
    it("each part of line 3 carries its own dot", () => {
      expect(rule(".flags > * + *::before")).toMatch(/content: "· "/);
    });
    it("a crew line's start never breaks between the time and its meridiem", () => {
      expect(rule(".crew-now .cn-when")).toMatch(/white-space: nowrap/);
    });
    it("there is no time column: the text has the row's width, and the gap line starts where the row's text does", () => {
      expect(rule(".row-main")).toMatch(/grid-template-columns: minmax\(0, 1fr\);/);
      expect(css).not.toMatch(/(^|\n)\.t \{/);
      expect(rule(".gap")).toMatch(/margin: 0 14px;/);
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

  /* New rules, not ledger rows (DECISIONS #62; docs/screens/contract.md,
     section 1): what sits on the nav or clears it is laid out from its
     measured height, which scroll.js writes into --nav-h. */
  describe("the bottom of the page, laid out from the nav's height", () => {
    it("the root's defaults are today's layout: the nav at 71px and the inset, the mini-bar at 48px", () => {
      expect(css).toMatch(/:root \{[^}]*--nav-h: calc\(71px \+ var\(--safe-bottom\)\);/);
      expect(css).toMatch(/:root \{[^}]*--minibar-h: 48px;/);
    });
    it("the mini-bar sits on the nav, over its top border", () => {
      expect(css).toMatch(/\.minibar \{[^}]*bottom: calc\(var\(--nav-h\) - 1px\)/);
    });
    /* The bar's own height stays a number, which jsdom can compute ([239]);
       what clears it reads --minibar-h, and the two are held equal. */
    it("and its height is the one --minibar-h says", () => {
      const own = css.match(/\.minibar \{[^}]*height: (\d+px)/), root = css.match(/--minibar-h: (\d+px);/);
      expect(own && own[1]).toBeTruthy();
      expect(own[1]).toBe(root && root[1]);
    });
    it("the end spacer clears the nav, and the mini-bar when it shows", () => {
      expect(css).toMatch(/main::after \{[^}]*height: calc\(var\(--nav-h\) \+ 5px\)/);
      expect(css).toMatch(/body\.has-minibar main::after \{ height: calc\(var\(--nav-h\) \+ 5px \+ var\(--minibar-h\)\)/);
    });
    it("the update pill clears the nav, and the mini-bar when it shows", () => {
      expect(css).toMatch(/\.update-pill \{[^}]*bottom: calc\(var\(--nav-h\) \+ 9px\)/);
      expect(css).toMatch(/body\.has-minibar \.update-pill \{ bottom: calc\(var\(--nav-h\) \+ 13px \+ var\(--minibar-h\)\)/);
    });
    it("the dev-build mark clears the nav, and the mini-bar when it shows", () => {
      expect(css).toMatch(/\.devmark \{[^}]*bottom: calc\(var\(--nav-h\) \+ 5px\)/);
      expect(css).toMatch(/body\.has-minibar \.devmark \{ bottom: calc\(var\(--nav-h\) \+ 5px \+ var\(--minibar-h\)\)/);
    });
    it("no rule assumes the nav's height any more, and none adds the inset to it a second time", () => {
      expect(css).not.toMatch(/calc\((70|76|80|124|132)px \+ var\(--safe-bottom\)\)/);
      expect(css).not.toMatch(/- 76px -/);
      expect(css).not.toMatch(/var\(--nav-h\)[^;]*var\(--safe-bottom\)/);
    });
  });

  /* An iPhone zooms the page when a field whose text is under 16px takes
     focus (DECISIONS #66). A field inherits its label's size, and the sheet's
     labels are .9375rem, so the sheet's fields get 1rem by a rule of their
     own; a rule over the text cannot follow inheritance, so that rule is
     pinned here, and the page's computed sizes are a phone's to check. New
     tests, not rows of tests/PORT-LEDGER.md. */
  describe("a field's text is never under 16px: an iPhone zooms the page on focus", () => {
    const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), body: m[2] }));
    /* The sizes a rule's font-size and font shorthand set, each in px at a 16px rem. */
    const sizes = body => [...body.matchAll(/(?:^|;)\s*font(?:-size)?:\s*([^;]*)/g)]
      .flatMap(m => [...m[1].matchAll(/(\d*\.?\d+)(rem|em|px)\b/g)].slice(0, 1))
      .map(([, n, unit]) => Number(n) * (unit === "px" ? 1 : 16));
    const under = rule => sizes(rule.body).some(px => px < 16);

    it("the share panel's message field is 1rem", () => {
      const share = rules.find(r => r.selector === "#shareText");
      expect(sizes(share.body)).toEqual([16]);
    });
    it("every field in the sheet is 1rem, by the sheet's id, which no field rule's font: inherit can undo", () => {
      expect(css).toMatch(/#sheet input, #sheet textarea, #sheet select \{ font-size: 1rem; \}/);
    });
    it("no rule whose selector names input, textarea or select sets a size under 1rem", () => {
      expect(rules.filter(r => /(^|[\s,>+~(])(input|textarea|select)\b/.test(r.selector) && under(r)).map(r => r.selector)).toEqual([]);
    });
  });

  /* The event sheet's place is a tap to the Map (DECISIONS #75), and its
     target is 44px tall without the head, which never scrolls, growing: the
     button takes padding and gives it back as a negative margin of the same
     size. A target need not push its neighbours (#66 asks for the target,
     not for the room). What the box then covers is a browser's to measure;
     the rule is pinned here. New tests, not rows of tests/PORT-LEDGER.md. */
  describe("the event sheet's place: a 44px target, and a head that does not grow", () => {
    const body = selector => { const at = css.indexOf(`\n${selector} {`); return at < 0 ? "" : css.slice(at, css.indexOf("}", at) + 1); };
    const sides = (text, name) => (new RegExp(`[; {]${name}: (-?\\d+)px 0 (-?\\d+)px;`).exec(text) || []).slice(1, 3).map(Number);
    const number = (text, name) => Number((new RegExp(`[; {]${name}: (\\d*\\.?\\d+)(?:rem)?;`).exec(text) || [])[1]);
    const place = body(".ev-place");

    it("the button's padding is 16px above and 6px below, and its margin gives exactly that back", () => {
      expect(sides(place, "padding")).toEqual([16, 6]);
      expect(sides(place, "margin")).toEqual([-16, -6]);
    });
    it("so its box is 44px or more tall: its line, 1.1875rem at 1.2, and the 22px", () => {
      const room = body(".ev-room");
      expect([number(room, "font-size"), number(room, "line-height")]).toEqual([1.1875, 1.2]);
      expect(1.1875 * 16 * 1.2 + 16 + 6).toBeGreaterThanOrEqual(44);
      expect(place).toMatch(/font: inherit;/);
    });
    it("and nothing in the rule sets a height of its own, which would grow the line", () => {
      expect(place).not.toMatch(/height/);
      expect(place).toMatch(/display: inline-block;/);
    });
    it("below, it reaches exactly the head's own gap, 6px, and no further: the line under it starts where the box ends", () => {
      expect(body(".ev-head")).toMatch(/display: grid; gap: 6px;/);
      expect(sides(place, "padding")[1]).toBe(6);
    });
    it("it is at least 44px wide, a hotel's name alone among them", () => {
      expect(place).toMatch(/min-width: 44px;/);
    });
    it("its words are underlined, as the sheet's other taps are, and keep the hotel's hue", () => {
      expect(body(".ev-place-words")).toMatch(/text-decoration: underline; text-underline-offset: 3px;/);
      expect(place).toMatch(/color: inherit;/);
      expect(body(".ev-room")).toMatch(/color: var\(--h\);/);
    });
  });

  /* More past an edge (DECISIONS #76): a mask on the scrolling area itself,
     as deep as what scroll.js says is hidden past that edge, and at most
     1.75rem and a fifth of the area's height; and that cap as each area's
     scroll padding, always. What a phone draws with them is a browser's to
     see; the declarations are pinned here. New tests, not rows of
     tests/PORT-LEDGER.md. */
  describe("more past an edge: a mask as deep as what is hidden, up to its cap", () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), body: m[2].trim() }));
    const AREAS = [".ev-body", ".filters-body", ".advanced-body", "#panel-crew"];
    const masks = rules.filter(r => /mask/.test(r.body));
    const names = r => r.selector.split(",").map(s => s.trim());

    it("one rule in the stylesheet masks anything, and it hangs on the mark alone: no area has a rule of its own", () => {
      expect(masks.map(r => r.selector)).toEqual(["[data-more]"]);
      expect(masks[0].body.match(/mask/g).length).toBe(1);
    });
    it("a band at each edge: nothing at the edge itself, and whole from the band's depth in", () => {
      expect(masks[0].body).toMatch(/^mask-image: linear-gradient\(to bottom, transparent, #000 min\([^()]*var\(--more-above, 0px\)\), #000 calc\(100% - min\([^()]*var\(--more-below, 0px\)\)\), transparent\);$/);
    });
    it("a band is the least of 1.75rem, a fifth of the area's height and what is hidden past its edge - none where nothing is said", () => {
      const depths = [...masks[0].body.matchAll(/min\(([^()]*(?:\([^()]*\))?)\)/g)].map(m => m[1]);
      expect(depths).toEqual(["1.75rem, 20%, var(--more-above, 0px)", "1.75rem, 20%, var(--more-below, 0px)"]);
    });
    it("the cap is in rem, so Larger text scales it, and no px is written into it", () => {
      expect(masks[0].body.replace(/var\(--more-(above|below), 0px\)/g, "")).not.toMatch(/\dpx/);
    });
    it("the unprefixed property alone: the floor is Safari 16.4, which takes it", () => {
      expect(bare).not.toMatch(/-webkit-mask/);
    });
    it("it does not animate as it comes and goes: no transition and no animation on the mark's rule or on an area's own", () => {
      const moving = rules.filter(r => /(^|[\s;])(transition|animation)(-[a-z-]+)?:/.test(r.body) && names(r).some(s => s === "[data-more]" || AREAS.includes(s)));
      expect(moving.map(r => r.selector)).toEqual([]);
    });
    it("the same cap is each area's scroll padding, always - on the four selectors the six areas are, never on the mark", () => {
      const padded = rules.filter(r => /scroll-padding/.test(r.body));
      expect(padded.map(r => r.selector)).toEqual([AREAS.join(", ")]);
      expect(padded[0].body).toBe("scroll-padding-block: min(1.75rem, 20%);");
    });
    it("and each of the four scrolls on its own", () => {
      for (const area of AREAS) expect(rules.filter(r => names(r).includes(area) && /overflow-y: auto/.test(r.body)).length).toBe(1);
    });
    const scroll = fs.readFileSync(path.join(ROOT, "src", "scroll.js"), "utf8");
    it("the areas scroll.js marks are the four the stylesheet pads: one list, said twice and held equal", () => {
      expect((/const MORE_AREAS = "([^"]*)";/.exec(scroll) || [])[1]).toBe(AREAS.join(", "));
    });
    it("scroll.js's ceiling stands above the deepest band these rules draw: 1.75rem with Larger text on", () => {
      const ceiling = Number((/const MORE_CEILING = (\d+);/.exec(scroll) || [])[1]);
      const larger = Number((/html\.bigtext \{ font-size: (\d+)%; \}/.exec(css) || [])[1]) / 100;
      expect(larger).toBe(1.15);
      expect(ceiling).toBeGreaterThan(1.75 * 16 * larger);
    });
  });

  /* The sheet's edges (DECISIONS #78). Room for the focus ring at the sides
     of the sheet's five scrollers, as much as the ring reaches and no more,
     so a change to the ring cannot outrun it; and an arrow in the gap above
     what follows an area that hides enough below, which scroll.js says with
     a word in data-more. What a phone draws is a browser's to see; the
     declarations are pinned here. New tests, not rows of
     tests/PORT-LEDGER.md. */
  describe("the sheet's edges: room for the focus ring, and an arrow where more is below", () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), body: m[2].trim().replace(/\s+/g, " ") }));
    const names = r => r.selector.split(",").map(s => s.trim());
    const AREAS = [".ev-body", ".filters-body", ".advanced-body", "#panel-crew"];
    const SCROLLERS = [...AREAS, "#panel-event"];
    const scroll = fs.readFileSync(path.join(ROOT, "src", "scroll.js"), "utf8");
    const one = (body, re) => Number((re.exec(body) || [])[1]);

    describe("the ring's room", () => {
      const ring = rules.filter(r => r.selector === ":focus-visible");
      const reach = () => one(ring[0].body, /outline: (\d+)px solid/) + one(ring[0].body, /outline-offset: (\d+)px;/);
      const room = rules.filter(r => /(^|[; ])(margin|padding)-inline/.test(r.body));

      it("the ring's own rule is as it was: 2px of gold, 2px off its control, so it reaches 4px", () => {
        expect(ring.map(r => r.body)).toEqual(["outline: 2px solid var(--gold); outline-offset: 2px;"]);
        expect(reach()).toBe(4);
      });
      it("one rule gives the room, to the sheet's five scrollers: the four areas scroll.js marks, and an event's panel", () => {
        expect(room.map(r => r.selector)).toEqual([SCROLLERS.join(", ")]);
        expect((/const MORE_AREAS = "([^"]*)";/.exec(scroll) || [])[1]).toBe(AREAS.join(", "));
      });
      it("the room is the ring's reach - its offset and its width - as inline padding, given back as a negative margin of the same size", () => {
        expect(room[0].body).toBe(`margin-inline: -${reach()}px; padding-inline: ${reach()}px;`);
        expect(one(room[0].body, /padding-inline: (\d+)px;/)).toBe(reach());
        expect(one(room[0].body, /margin-inline: -(\d+)px;/)).toBe(reach());
      });
      it("each of the five scrolls, so each clips at its box", () => {
        for (const s of SCROLLERS) expect(rules.filter(r => names(r).includes(s) && /overflow-y: auto/.test(r.body)).length).toBe(1);
      });
      it("no other rule on a scroller sets an inline padding or margin, which would take the room back or move its content", () => {
        const ends = r => names(r).some(s => SCROLLERS.some(a => s === a || new RegExp(`[\\s>+~]${a.replace(/[.#]/g, "\\$&")}$`).test(s)));
        const sideways = rules.filter(r => ends(r) && r !== room[0] && /(^|[; ])(padding|margin)(-left|-right|-inline[a-z-]*)?:/.test(r.body));
        expect(sideways.map(r => r.selector)).toEqual([]);
      });
      it("no ring is drawn inside a control but the two that were: a gold ring inside a gold button cannot be seen", () => {
        expect(rules.filter(r => /outline-offset: -/.test(r.body)).map(r => r.selector)).toEqual([".plans-seg button:focus-visible", ".crew-now:focus-visible"]);
      });
    });

    describe("the arrow", () => {
      const reads = rules.filter(r => /data-more/.test(r.selector));
      const arrow = rules.filter(r => /::before/.test(r.selector) && /data-more/.test(r.selector));
      const FOLLOWERS = [".ev-foot", ".ev-actions", ".filters-foot"];
      const rem = (body, name) => one(body, new RegExp(`(?:^|[; ])${name}: (\\d*\\.?\\d+)rem;`));
      /* Two borders of a square turned 45 degrees: its point is half its
         diagonal under its centre, and its arms end level with the centre. */
      const stands = size => {
        const side = rem(arrow[0].body, "width") * size, off = one(arrow[0].body, /bottom: calc\(100% \+ (\d+)px\);/);
        return { point: off + side / 2 - side / Math.SQRT2, top: off + side / 2, tall: side / Math.SQRT2 };
      };

      it("two rules read the mark: the mask, on the mark alone, and the arrow, on its word", () => {
        expect(reads.map(r => r.selector)).toEqual(["[data-more]", arrow[0].selector]);
        expect(arrow.length).toBe(1);
      });
      it("it is the ::before of what follows an area that says below: an event's foot, a Done row, the filters' foot", () => {
        expect(names(arrow[0])).toEqual(FOLLOWERS.map(f => `[data-more~="below"] + ${f}::before`));
      });
      it("the word is the one scroll.js writes, at a threshold that stands under its ceiling", () => {
        expect(scroll).toContain('const moreWord = hidden => (hidden.below >= MORE_ARROW ? "below" : "");');
        const threshold = Number((/const MORE_ARROW = (\d+);/.exec(scroll) || [])[1]), ceiling = Number((/const MORE_CEILING = (\d+);/.exec(scroll) || [])[1]);
        expect(threshold).toBe(20);
        expect(threshold).toBeLessThan(ceiling);
      });
      it("it is outside the flow, so it moves nothing: absolute, in an element that is positioned", () => {
        expect(arrow[0].body).toMatch(/(^|; )position: absolute;/);
        expect(rules.filter(r => r.selector === ".ev-body + .ev-actions, .filters-foot").map(r => r.body)).toEqual(["position: relative;"]);
        expect(rules.filter(r => r.selector === "#panel-event > .ev-foot" && /position: sticky;/.test(r.body)).length).toBe(1);
      });
      it("it is no control: no content, so nothing a screen reader meets, and no tap", () => {
        expect(arrow[0].body).toMatch(/(^|; )content: "";/);
        expect(arrow[0].body).toMatch(/(^|; )pointer-events: none;/);
      });
      it("it is a square's two borders, turned to point down, its size in rem so Larger text scales it", () => {
        expect(arrow[0].body).toMatch(/(^|; )box-sizing: border-box;/);
        expect(rem(arrow[0].body, "width")).toBe(0.6875);
        expect(rem(arrow[0].body, "height")).toBe(rem(arrow[0].body, "width"));
        expect(arrow[0].body).toMatch(/(^|; )border: solid var\(--muted\); border-width: 0 \.125rem \.125rem 0;/);
        expect(arrow[0].body).toMatch(/(^|; )transform: rotate\(45deg\);/);
        expect(arrow[0].body.replace(/bottom: calc\(100% \+ \d+px\);/, "")).not.toMatch(/\dpx/);
      });
      it("it is centred on the element it hangs on", () => {
        expect(arrow[0].body).toMatch(/(^|; )left: 0; right: 0;/);
        expect(arrow[0].body).toMatch(/(^|; )margin: 0 auto;/);
      });
      it("it stands inside the smallest gap it is drawn in, the filters' 12px, clear of the area and of the element, at both text sizes", () => {
        const gaps = [one((rules.find(r => r.selector === "#panel-filters") || {}).body, /(?:^|; )gap: (\d+)px;/), one((rules.find(r => r.selector === ".sheet-panel") || {}).body, /(?:^|; )gap: (\d+)px;/)];
        expect(gaps).toEqual([12, 16]);
        const larger = Number((/html\.bigtext \{ font-size: (\d+)%; \}/.exec(css) || [])[1]) / 100;
        for (const size of [16, 16 * larger]) {
          const { point, top, tall } = stands(size);
          expect(point).toBeGreaterThan(1);
          expect(top).toBeLessThan(Math.min(...gaps) - 1);
          expect(tall).toBeGreaterThan(7);
        }
        expect(stands(16).point).toBeCloseTo(1.72, 2);
        expect(stands(16).top).toBeCloseTo(9.5, 2);
      });
      it("its colour is --muted, 6.3:1 on the sheet: a graphic needs 3:1 (#66)", () => {
        const token = name => (new RegExp(`--${name}: (#[0-9A-Fa-f]{6});`).exec(css) || [])[1];
        const channel = c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
        const luminance = hex => [1, 3, 5].map(i => channel(parseInt(hex.slice(i, i + 2), 16) / 255)).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
        const ratio = (luminance(token("muted")) + 0.05) / (luminance(token("surface")) + 0.05);
        expect(ratio).toBeGreaterThanOrEqual(3);
        expect(ratio).toBeCloseTo(6.31, 2);
        expect((rules.find(r => r.selector === ".sheet") || {}).body).toMatch(/background: var\(--surface\);/);
      });
      it("it does not animate as it comes and goes", () => {
        expect(arrow[0].body).not.toMatch(/(transition|animation)/);
      });
    });
  });
});
