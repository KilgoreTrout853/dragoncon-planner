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

  /* Plans' top as built (DECISIONS #101): the two actions on two columns, and
     under them the view's switch, Timeline | List, which is a segment in My
     day | Crew's look and no longer two more buttons of the actions' size.
     Explore's By interest | By time keeps .view-toggle. */
  describe("the control strip: the actions on two columns, the view's switch a segment under them", () => {
    it("the actions row is two equal columns [436]", () => {
      expect(css).toMatch(/\.plans-actions \{[^}]*grid-template-columns: 1fr 1fr/);
    });
    it("actions and toggle share a height [439]", () => {
      const a = css.match(/\.plans-actions \.btn \{[^}]*height: (\d+)px/), b = css.match(/\n\.plans-seg button \{[^}]*height: (\d+)px/);
      expect(a && a[1]).toBe("44");
      expect(a[1]).toBe(b && b[1]);
    });
    it("and a corner radius [442]", () => {
      const a = css.match(/\.plans-actions \.btn \{[^}]*border-radius: (\d+)px/), b = css.match(/\n\.seg \{[^}]*border-radius: (\d+)px/);
      expect(a && a[1]).toBeTruthy();
      expect(a[1]).toBe(b && b[1]);
    });
    it("and a gap [445]", () => {
      /* the gap between the two actions is the room the switch keeps under it: the plan starts where it did */
      const a = css.match(/\.plans-actions \{[^}]*gap: (\d+)px/), b = css.match(/\n\.plans-view \{ width: fit-content; margin: 0 14px (\d+)px auto; \}/);
      expect(a && a[1]).toBeTruthy();
      expect(a[1]).toBe(b && b[1]);
    });
    it("the switch hugs its words at the row's right end, each side of it 44px wide or more, and it is the segment's own class - so its ring is the segment's, and no third ring is drawn inside a control", () => {
      expect(css).toContain("\n.plans-view { width: fit-content; margin: 0 14px 8px auto; }\n.plans-view button { flex: none; min-width: 44px; padding: 0 16px; }\n");
      expect(css).not.toMatch(/\.plans-view[^{]*:focus-visible/);
    });
    it("the rung is a card: its line and its two buttons in one bordered box, as a notice's is", () => {
      expect(css).toContain("\n.crew-rung { display: grid; gap: 10px; margin: 12px 14px 0; padding: 12px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }\n");
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
    /* Until DECISIONS #92 Advanced scrolled on its own; now the body it is
       in does, and the row keeps its bracket. */
    it("Advanced is a fold in a body that scrolls: no scroller and no cap of its own [1705]", () => {
      const fold = /\n\.advanced-body \{([^}]*)\}/.exec(css)[1];
      expect(fold).not.toMatch(/overflow|max-height|touch-action|overscroll/);
      expect(css).toMatch(/\n\.sheet-body \{[^}]*overflow-y: auto/);
      expect(css).toMatch(/\n\.sheet-body \{[^}]*touch-action: pan-y/);
    });
  });

  describe("polish 7: larger text", () => {
    it("which sets the root size to 115% [1720]", () => {
      expect(css).toMatch(/html\.bigtext \{ font-size: 115%; \}/);
    });
    it("every text size outside the map's SVG is in rem, so it follows the root [1726]", () => {
      /* the map's SVG text is sized in the drawing's own units (row 1727); the
         crew's count on the map, since step 5a, is SVG text too, and so is a
         plate's label in a venue's stack (DECISIONS #95) */
      const scaled = css.split("\n").filter(l => !/^\.(map-(street-label|hotel text|park text|pill text|crew text)|plate-label \{)/.test(l)).join("\n");
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
      expect(css).toMatch(/\.search\.indexing::placeholder \{ color: var\(--muted\); font-style: italic; \}/);
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
    const AREAS = [".ev-body", ".filters-body", ".sheet-body", "#panel-crew"];
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
    it("the same cap is each area's scroll padding, always - on the four selectors the seven areas are, never on the mark", () => {
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
    const AREAS = [".ev-body", ".filters-body", ".sheet-body", "#panel-crew"];
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
      const FOLLOWERS = [".ev-foot", ".ev-actions", ".filters-foot", ".sheet-foot"];
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
      it("it is the ::before of what follows an area that says below: an event's foot, a Done row, the filters' foot, Settings' foot and About's", () => {
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
        expect(rules.filter(r => r.selector === ".ev-body + .ev-actions, .filters-foot, .sheet-foot").map(r => r.body)).toEqual(["position: relative;"]);
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

  /* The gear (DECISIONS #92): Settings and About this app are a heading,
     one body that scrolls and a pinned foot, in a sheet capped as an event's
     is; a checkbox in the sheet stands beside its words. Where things stand
     on a phone is the browser tests' (tests/browser/gear.spec.js); the
     declarations are pinned here. New tests, not rows of
     tests/PORT-LEDGER.md. */
  describe("the gear: a heading, one body and a pinned foot, in a sheet no taller than an event's", () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), body: m[2].trim().replace(/\s+/g, " ") }));
    const body = selector => (rules.find(r => r.selector === selector) || { body: "" }).body;
    const cap = text => (/max-height: calc\((\d+)dvh - (\d+)px - var\(--safe-bottom\)\);/.exec(text) || []).slice(1).map(Number);

    it("the two panels are capped as an event's panel is: the sheet at most 86% of the screen, by the one number", () => {
      expect(cap(body("#panel-settings, #panel-about"))).toEqual([86, 53]);
      expect(cap(body("#panel-settings, #panel-about"))).toEqual(cap(body("#panel-event")));
      expect(body("#panel-settings, #panel-about")).toMatch(/max-height: calc\(86vh - 53px - var\(--safe-bottom\)\); max-height: calc\(86dvh/);
    });
    it("each is a column whose heading and foot keep their height, and whose body takes what is left", () => {
      expect(body("#panel-settings, #panel-about")).toMatch(/(^|; )display: flex; flex-direction: column;/);
      expect(body("#panel-settings > *, #panel-about > *")).toBe("flex: none;");
      expect(body("#panel-settings > .sheet-body, #panel-about > .sheet-body")).toBe("flex: 0 1 auto; min-height: 0;");
    });
    it("the panel itself does not scroll: the body is the one scroller, and no body has a cap of its own", () => {
      expect(body("#panel-settings, #panel-about")).not.toMatch(/overflow/);
      expect(rules.filter(r => /\.sheet-body/.test(r.selector) && /max-height/.test(r.body))).toEqual([]);
    });
    it("the body has the ring's room at its top and foot too, given back as margin, so the panel's gaps stand", () => {
      const ring = body(":focus-visible"), reach = Number(/outline: (\d+)px/.exec(ring)[1]) + Number(/outline-offset: (\d+)px/.exec(ring)[1]);
      expect(body(".sheet-body")).toMatch(new RegExp(`(^|; )padding-block: ${reach}px; margin-block: -${reach}px;`));
    });
    it("a grid item of a body has a floor of 0 under its width, so a long line cannot widen the column", () => {
      expect(body(".sheet-body > *")).toBe("min-width: 0;");
    });
    it("the foot's button is as wide as the sheet", () => {
      expect(body(".sheet-foot")).toBe("display: flex;");
      expect(body(".sheet-foot .btn")).toBe("flex: 1 1 auto;");
    });
    it("one rule for a toggle in the sheet: beside its words, 44px or more, the box never squeezed - and it outranks the sheet's label rule", () => {
      expect(body(".sheet .toggle")).toBe("display: flex; min-height: 44px;");
      expect(body(".sheet label")).toMatch(/(^|; )display: grid;/);
      expect(rules.filter(r => /\.toggle/.test(r.selector)).map(r => r.selector)).toEqual([".toggle", ".toggle input", ".sheet .toggle"]);
      expect(body(".toggle input")).toMatch(/(^|; )flex: none; width: 22px; height: 22px;/);
    });
    it("the About row and the about panel's link are 44px or more where they are tapped", () => {
      expect(Number(/min-height: (\d+)px;/.exec(body(".about-row"))[1])).toBeGreaterThanOrEqual(44);
      expect(body(".about-row")).toMatch(/(^|; )width: 100%;/);
      expect(body(".about-link")).toMatch(/min-height: 44px; min-width: 44px;/);
    });
    it("Delete's part keeps the about body's rhythm, and its note takes no room while it says nothing (#93)", () => {
      expect(body(".about")).toBe("gap: 12px;");
      expect(body(".about-delete")).toBe("display: grid; gap: 12px;");
      expect(body(".about-note:empty")).toBe("display: none;");
      expect(body(".about-note")).toMatch(/(^|; )color: var\(--text\);/);
    });
  });

  describe("in place of a pick: the notice's OK, and a cancelled block on the timeline (DECISIONS #90)", () => {
    it("the picks-changed notice's OK is 44px tall (#66)", () => {
      expect(css).toMatch(/\.pick-news \.btn \{[^}]*height: 44px;/);
    });
    it("a cancelled pick's block is drawn as a removed one's is: dimmed, its title struck", () => {
      expect(css).toMatch(/\.tl-block\.removed, \.tl-block\.cancelled \{ opacity: \.55; \}/);
      expect(css).toMatch(/\.tl-block\.removed \.tb-title, \.tl-block\.cancelled \.tb-title \{ text-decoration: line-through; \}/);
    });
  });

  /* The stack (DECISIONS #95): a venue lifted into its floors. The lines that
     must stay as the map's were, what gold is spent on, the inert plate, the
     slot's one height and the contrast of what a plate draws. What a phone
     draws of it is tests/browser/stack.spec.js's. New tests, not rows of
     tests/PORT-LEDGER.md. */
  describe("the stack: a venue lifted into its floors (DECISIONS #95)", () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), body: m[2].trim().replace(/\s+/g, " ") }));
    const body = selector => rules.filter(r => r.selector === selector).map(r => r.body).join(" | ");
    /* Every rule the stack brought: a plate's, its label's, the card's, the way back's. */
    const STACK = /\.(plate|pl-|pc-|stack-|venue-line|vl-|map-hint|map-back)|\[data-stack\]/;
    const stack = rules.filter(r => STACK.test(r.selector));

    it("the map's own lines are as they were: the frame takes the width, gives way in height to a floor of 200px, and the band under it keeps its own height", () => {
      expect(body(".map")).toMatch(/^display: block; width: 100%; height: auto; flex: 0 1 auto; min-height: 200px; /);
      expect(body(".map-under")).toBe("flex: none;");
      expect(body("#view-map")).toBe("display: flex; flex-direction: column; height: calc(100dvh - var(--hdr-h, 63px) - var(--nav-h) - 5px);");
    });
    it("gold is the reader's own, on the stack as everywhere: a plate's edge where it holds a pick, a lit room, the star on a label and before a name on the card - and nothing else of the stack's", () => {
      expect(stack.filter(r => /--gold\b/.test(r.body)).map(r => r.selector)).toEqual([
        ".plate.mine .plate-hull", ".plate-room.lit, .plate-open.place.lit", ".plate-label .pl-picks", ".plate-card.mine .nc-title::before, .pc-row.mine .pc-title::before"]);
      expect(stack.length).toBeGreaterThan(25);
    });
    it("the gold edge keeps a dashed plate's dashes: it sets the stroke's colour and width, and nothing of its pattern", () => {
      expect(body(".plate.mine .plate-hull")).toBe("stroke: var(--gold); stroke-width: 2.5;");
      expect(body(".plate.floor .plate-hull")).toMatch(/stroke-dasharray: 5 4;$/);
      /* And a plate laid flat wears none (#96): the hull's own plain edge again, its colour and its width. */
      expect(body(".plate.flat.mine .plate-hull")).toBe("stroke: var(--h); stroke-width: 1.4;");
      expect(body(".plate-hull")).toMatch(/; stroke: var\(--h\); stroke-width: 1\.4; /);
    });
    it("an inert plate is see-through and takes no pointer: a dotted outline, no fill, and no rule gives it one", () => {
      expect(body(".plate.inert")).toBe("pointer-events: none;");
      expect(body(".plate.inert .plate-hull")).toBe("fill: none; stroke: var(--dim); stroke-dasharray: 2 5;");
      const inert = rules.map((r, at) => ({ ...r, at })).filter(r => /\.inert/.test(r.selector) && /\.plate/.test(r.selector));
      expect(inert.map(r => r.selector)).toEqual([".plate.inert", ".plate.inert .plate-hull", ".plate-label.inert"]);
      const fills = rules.map((r, at) => ({ ...r, at })).filter(r => /\.plate-hull$/.test(r.selector) && /(^|; )fill:/.test(r.body));
      expect(fills.map(r => r.selector)).toEqual([".plate-hull", ".plate.floor .plate-hull", ".plate.inert .plate-hull"]);      // the inert one last: it wins
      expect(body(".plate.drawn, .plate.floor")).toBe("cursor: pointer;");
    });
    it("a plate's keyboard focus is its own edge, thicker: no outline, which a tilted group draws as two lines across the frame", () => {
      expect(body(".plate:focus")).toBe("outline: none;");
      expect(body(".plate:focus-visible .plate-hull")).toBe("stroke-width: 4;");
      expect(stack.filter(r => /outline/.test(r.body)).map(r => r.selector)).toEqual([".plate:focus", ".plate.flat .plate-room:focus, .plate.flat .plate-open.place:focus"]);    // and a room's, in its level (#96)
      expect(body(".plate.mine:focus-visible .plate-hull")).toBe("stroke-width: 5;");                 // on a gold edge thicker again: 2.5 to 4 is too small a step
    });
    it("what must win does by weight, whatever order the rules stand in: focus on a gold edge over the gold's own width, and a lit place over the tint a place has", () => {
      /* A selector's weight, as the cascade counts it: ids, then classes, attributes and pseudo-classes, then types and pseudo-elements. */
      const weight = selector => { const s = selector.replace(/::[\w-]+/g, " el"); return [(s.match(/#[\w-]+/g) || []).length, (s.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g) || []).length, (s.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length]; };
      const over = (a, b) => { const [x, y] = [weight(a), weight(b)]; const at = x.findIndex((v, i) => v !== y[i]); return at >= 0 && x[at] > y[at]; };
      expect([weight(".plate.mine .plate-hull"), weight(".plate:focus-visible .plate-hull"), weight("#view-map .controls-sticky"), weight("main::after")]).toEqual([[0, 3, 0], [0, 3, 0], [1, 1, 0], [0, 0, 2]]);
      expect(over(".plate.mine:focus-visible .plate-hull", ".plate.mine .plate-hull")).toBe(true);
      expect(over(".plate.flat.mine .plate-hull", ".plate.mine .plate-hull")).toBe(true);                // a level's plain edge over the gold one
      expect(over(".plate-open.place.lit", ".plate-open.place")).toBe(true);
      expect(over(".plate-room.lit", ".plate-room")).toBe(true);
      const width = selector => Number(/stroke-width: ([\d.]+);/.exec(body(selector))[1]);
      expect(width(".plate.mine:focus-visible .plate-hull")).toBeGreaterThanOrEqual(width(".plate.mine .plate-hull") * 2);
      expect(body(".plate-open.place")).toMatch(/^fill: /);                                            // the tint a lit place has to beat
      expect(rules.filter(r => /\.lit\b/.test(r.selector) && STACK.test(r.selector)).map(r => r.selector)).toEqual([".plate-room.lit, .plate-open.place.lit"]);
    });
    it("the slot under the map keeps one height while a stack is open, one rule, in rem where the card's words are - and no other rule sets the band's height", () => {
      const slot = rules.filter(r => /\.map-under$/.test(r.selector) && /(^|; |\b)(min-|max-)?height:/.test(r.body));
      expect(slot.map(r => r.selector)).toEqual([".map-wrap[data-stack] .map-under"]);
      expect(slot[0].body).toBe("height: calc(10px + 2px + 12px + (.75rem * 1.3 + 3px) + 1.125rem * 1.2 + (4px + .9375rem * 1.3) + 8px + 2 * (14px + 1.8125rem * 1.3));");
    });
    it("on a screen too short for the map's floor and the slot, the slot brings the room under it along - the tab's foot and the nav's - out of the flow: main scrolls to it, and it takes none where the slot fits", () => {
      expect(rules.filter(r => r.selector === ".map-wrap[data-stack] .map-under").map(r => r.body)).toContain("position: relative;");
      expect(body(".map-wrap[data-stack] .map-under::after")).toBe('content: ""; position: absolute; left: 0; top: 100%; width: 1px; height: calc(12px + var(--nav-h) + 5px); pointer-events: none;');
      expect(body(".view")).toBe("padding: 0 0 12px;");                                               // the foot
      expect(body("main::after")).toBe('content: ""; display: block; height: calc(var(--nav-h) + 5px);');    // and the nav's room
    });
    it("the slot's sum is the card's own: its margin, border and padding, its three lines' sizes and line heights, and two rows", () => {
      const size = (selector, name = "font-size") => Number(new RegExp(`(?:^|; )${name}: (-?[\\d.]+)(?:rem|px)?;`).exec(body(selector))[1]);
      expect([size(".next-card", "margin-top"), size(".next-card .nc-label"), size(".next-card .nc-label", "margin-bottom"), size(".next-card .nc-title"), size(".next-card .nc-title", "line-height"),
        size(".next-card .nc-when", "margin-top"), size(".next-card .nc-when"), size(".pc-row .pc-title") + size(".pc-row .pc-when")]).toEqual([10, 0.75, 3, 1.125, 1.2, 4, 0.9375, 1.8125]);
      expect(body(".next-card")).toMatch(/(^|; )padding: 12px 14px;.*border: 1px solid var\(--line\);/);
      expect(body(".pc-rows")).toBe("list-style: none; margin: 8px -14px -12px; padding: 0;");
      expect(body(".pc-row")).toMatch(/(^|; )padding: 6px 14px; border: 0; border-top: 1px solid var\(--line\);.* gap: 1px;$/);
      expect(/(^|; )line-height: 1\.3;/.test(body("body"))).toBe(true);
    });
    it("a card's head adds no height (#98): the card's own padding at its top and sides, taken back as margin, no border and nothing at its foot, and no rule of its own gives it a height - its chevron the venue's line's", () => {
      expect(body(".pc-head")).toBe("display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: 10px; width: calc(100% + 28px); margin: -12px -14px 0; padding: 12px 14px 0; border: 0; border-radius: 13px 13px 0 0; background: none; color: inherit; font: inherit; text-align: left;");
      expect(body(".next-card")).toMatch(/(^|; )padding: 12px 14px;/);
      expect(rules.filter(r => /\.pc-(head|words|chevron)/.test(r.selector)).map(r => r.selector)).toEqual([".pc-head", "button.pc-head", ".pc-head .pc-words, .pc-head .pc-words > span", ".pc-head .pc-chevron"]);
      expect(rules.filter(r => /\.pc-(head|words)/.test(r.selector) && !/\.pc-chevron$/.test(r.selector) && /(^|; )((min-|max-)?height|line-height|font-size|margin-top|margin-bottom|padding-(top|bottom)|gap|row-gap):/.test(r.body)).map(r => r.selector)).toEqual([]);
      expect(body(".pc-head .pc-words, .pc-head .pc-words > span")).toBe("display: block; min-width: 0;");
      expect(body(".pc-head .pc-chevron")).toBe(body(".venue-line .vl-chevron"));
    });
    it("the way back is 44px, tall and wide, over the frame's top left; a card's row is 46px or more", () => {
      expect(body(".map-back")).toMatch(/^position: absolute; left: 20px; top: 18px; z-index: 1; height: 44px; min-width: 44px;/);
      /* a control's own fill and a lighter edge, so it reads as one on the stage (#100) */
      expect(body(".map-back")).toMatch(/; border: 1px solid var\(--muted\); background: var\(--surface\); color: var\(--text\); /);
      expect(Number(/min-height: (\d+)px;/.exec(body(".pc-row"))[1])).toBeGreaterThanOrEqual(44);
    });
    it("a plate's label is in the drawing's own units, as a block's name is: Larger text leaves the map alone", () => {
      expect(body(".plate-label")).toMatch(/(^|; )font-size: 11px;/);
      expect(stack.filter(r => /font-size: [\d.]+px/.test(r.body)).map(r => r.selector)).toEqual([".plate-label"]);
    });
    it("a label is left in a touch's way: it is in its plate's group, and its touch is its plate's - nothing of the stack's is taken out of the way but an inert plate, and what is drawn over a plate", () => {
      expect(body(".plate-label")).not.toMatch(/pointer-events|cursor/);
      expect(body(".plate-label.inert")).toBe("fill: var(--muted); font-weight: 600;");
      expect(stack.filter(r => /pointer-events/.test(r.body)).map(r => [r.selector, /pointer-events: ([\w-]+);/.exec(r.body)[1]]))
        .toEqual([[".plate.inert", "none"], [".plate-sel", "none"], [".plate-group", "none"], [".map-wrap[data-stack] .map-under::after", "none"]]);
      expect(stack.filter(r => /labels/.test(r.selector))).toEqual([]);                              // no layer of labels apart from the plates
    });
    it("what a plate draws reads at 3:1 or more (#66): a lit room and the gold edge on a plate of every hue and on the ground, the selection, each plate's own edge and a dashed plate's, and an inert plate's outline and name", () => {
      const token = name => new RegExp(`--${name}: (#[0-9A-Fa-f]{6})`).exec(css)[1];
      const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
      const lum = c => { const [r, g, bl] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
      const contrast = (x, y) => { const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
      const mix = (a, b, p) => a.map((v, i) => Math.round(v * p + b[i] * (1 - p)));
      /* the ground is the stage (#100), darker than the page: everything a plate draws reads better on it */
      const ink = rgb(token("ink")), ground = rgb(token("stage")), gold = rgb(token("gold"));
      expect(body(".map")).toMatch(/; background: var\(--stage\); /);
      expect(body(".plate-hull")).toMatch(/^fill: color-mix\(in srgb, var\(--h\) 11%, var\(--ink\)\); stroke: var\(--h\);/);
      expect(body(".plate.floor .plate-hull")).toMatch(/^fill: color-mix\(in srgb, var\(--h\) 5%, var\(--ink\)\); stroke: color-mix\(in srgb, var\(--h\) 75%, var\(--ink\)\);/);
      for (const name of ["Marriott", "Hyatt", "Hilton", "Courtland", "Westin", "Mart"]) {
        const hue = rgb(token(`h-${name}`)), plate = mix(hue, ink, 0.11), floor = mix(hue, ink, 0.05);
        for (const [what, a, b] of [["a lit room on its plate", gold, plate], ["the gold edge on a floor", gold, floor], ["the plate's edge on the ground", hue, ground],
          ["a dashed plate's edge on the ground", mix(hue, ink, 0.75), ground], ["the selection on its plate", rgb(token("text")), plate]]) {
          expect(contrast(a, b), `${name}: ${what}`).toBeGreaterThanOrEqual(3);
        }
      }
      expect(contrast(gold, ground)).toBeGreaterThan(11);
      expect(contrast(rgb(token("text")), ground)).toBeGreaterThan(16);
      expect(contrast(rgb(token("dim")), ground)).toBeGreaterThanOrEqual(3);           // an inert plate's dotted edge, a mark
      expect(contrast(rgb(token("muted")), ground)).toBeGreaterThanOrEqual(4.5);       // and its name, which is words
    });
  });
  /* The level (DECISIONS #96): a drawn plate laid flat. What is not shown is
     hidden and never removed, the frame is one size, a room's focus is its
     own edge and wins by weight, the labels take no pointer and no size from
     the stylesheet, and gold stays the reader's. What a phone draws of it is
     tests/browser/level.spec.js's. New tests, not rows of
     tests/PORT-LEDGER.md. */
  describe("the level: a drawn plate laid flat (DECISIONS #96)", () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), body: m[2].trim().replace(/\s+/g, " ") }));
    const body = selector => rules.filter(r => r.selector === selector).map(r => r.body).join(" | ");
    /* Every rule the level brought: what it hides, its rooms, its outlines, its labels, its streets and its card. */
    const LEVEL = /\.(level-|lv-|room-card)|\[data-level\]|\.plate\.flat/;
    const level = rules.filter(r => LEVEL.test(r.selector));

    it("what is not shown behind a level is hidden, never removed: the city, the other plates and every plate's label, by visibility - and no rule of the level's takes a thing out of the page, moves it or times it", () => {
      expect(body(".map[data-level] .map-city")).toBe("visibility: hidden;");
      expect(body(".map-stack[data-level] .plate:not(.flat), .map-stack[data-level] .plate-label")).toBe("visibility: hidden;");
      expect(level.filter(r => /display: none|animation|transition|transform/.test(r.body)).map(r => r.selector)).toEqual([]);
      expect(level.length).toBeGreaterThan(15);
    });
    it("the frame does not grow: no rule of the level's sets a size or a space - the map's lines and the slot's one height are the stack's", () => {
      expect(level.filter(r => /(^|; )((min-|max-)?(height|width)|flex|padding|margin|inset|top|left)\b/.test(r.body)).map(r => r.selector)).toEqual([]);
      expect(rules.filter(r => /\.map-under$/.test(r.selector) && /(^|; |\b)(min-|max-)?height:/.test(r.body)).map(r => r.selector)).toEqual([".map-wrap[data-stack] .map-under"]);
    });
    it("a room with keyboard focus says so by its own edge, light and thicker, with no outline - by more weight than a lit room's rule and a place's tint, whatever order the rules stand in", () => {
      const focus = ".map-stack[data-level] .plate.flat .plate-room:focus-visible, .map-stack[data-level] .plate.flat .plate-open.place:focus-visible";
      expect(body(focus)).toBe("stroke: var(--text); stroke-width: 4;");
      expect(body(".plate.flat .plate-room:focus, .plate.flat .plate-open.place:focus")).toBe("outline: none;");
      const weight = selector => { const w = selector.replace(/::[\w-]+/g, " el"); return [(w.match(/#[\w-]+/g) || []).length, (w.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g) || []).length, (w.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length]; };
      const over = (a, b) => { const [x, y] = [weight(a), weight(b)]; const at = x.findIndex((v, i) => v !== y[i]); return at >= 0 && x[at] > y[at]; };
      for (const part of focus.split(", ")) {
        for (const other of [".plate-room.lit", ".plate-open.place.lit", ".plate-open.place", ".plate-room", ".plate-open"]) expect(over(part, other), `${part} over ${other}`).toBe(true);
      }
      expect(Number(/stroke-width: ([\d.]+);/.exec(body(focus))[1])).toBeGreaterThanOrEqual(4 * Number(/stroke-width: ([\d.]+);/.exec(body(".plate-room"))[1]));
    });
    it("a room and an identified open area are what a tap lands on: their names, a selected room's outline and a ballroom's are drawn over them and take no pointer", () => {
      expect(body(".level-labels")).toBe("pointer-events: none;");
      expect(body(".level-sel-room")).toBe("fill: none; stroke: var(--text); stroke-width: 2.5; stroke-linejoin: round; vector-effect: non-scaling-stroke; pointer-events: none;");
      expect(body(".plate-group")).toMatch(/pointer-events: none;$/);
      expect([body(".plate.flat"), body(".plate.flat .plate-room, .plate.flat .plate-open.place")]).toEqual(["cursor: default;", "cursor: pointer;"]);
      expect(level.filter(r => /pointer-events/.test(r.body)).map(r => r.selector)).toEqual([".level-sel-room", ".level-labels"]);
    });
    it("a label's size is the drawing's, never the stylesheet's: Larger text leaves the map alone", () => {
      expect(level.filter(r => /font-size|rem\b/.test(r.body)).map(r => r.selector)).toEqual([]);
      expect(body(".level-labels text")).toBe("font-family: var(--font);");
      expect(body(".lv-room, .lv-open")).toBe("text-anchor: middle; dominant-baseline: central;");
    });
    it("gold is the reader's own: a lit room's words are in the gold's ink, and no name, landmark, street or outline of the level's is gold", () => {
      expect(body(".lv-room.lit, .lv-open.lit")).toBe("fill: var(--gold-ink); font-weight: 700;");
      expect(level.filter(r => /--gold(?![-\w])/.test(r.body)).map(r => r.selector)).toEqual([]);
      expect([body(".lv-mark path, .lv-mark rect, .lv-mark circle"), body(".lv-mark text")]).toEqual(["fill: none; stroke: var(--muted); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round;", "fill: var(--muted); font-weight: 600; text-anchor: middle;"]);
      expect([body(".lv-room"), body(".lv-open"), body(".lv-group"), body(".lv-group.middle")]).toEqual(["fill: var(--text); font-weight: 600;", "fill: var(--muted); font-weight: 500;", "fill: var(--h); font-weight: 700; letter-spacing: .08em;", "text-anchor: middle;"]);
    });
    it("a street's name is the city map's own label, on its edge of the frame, edged in the dark so the venue's outline does not strike it through: north from its right end, clear of the way back, the others about their middle", () => {
      expect(body(".level-street")).toBe("paint-order: stroke; stroke: var(--ink); stroke-width: 3px; stroke-linejoin: round;");
      expect([body('.level-street[data-side="N"]'), body('.level-street[data-side="S"], .level-street[data-side="W"], .level-street[data-side="E"]')]).toEqual(["text-anchor: end;", "text-anchor: middle;"]);
      expect(body(".map-street-label")).toMatch(/font-size: 10px;.*text-transform: uppercase; fill: var\(--muted\);$/);
    });
    it("a room's card is a plate's, its small line one line with an ellipsis its net", () => {
      expect(body(".room-card .nc-label")).toBe("white-space: nowrap; overflow: hidden; text-overflow: ellipsis;");
    });
    it("what a level says reads (#66): a room's name on its room, a lit one's on the gold, an open area's name and a landmark's on the plate and on a place's tint at 4.5:1 or more on every hue; a group's name and the selection at 3:1", () => {
      const token = name => new RegExp(`--${name}: (#[0-9A-Fa-f]{6})`).exec(css)[1];
      const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
      const lum = c => { const [r, g, bl] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
      const contrast = (x, y) => { const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
      const mix = (a, b, p) => a.map((v, i) => Math.round(v * p + b[i] * (1 - p)));
      const ink = rgb(token("ink")), ground = rgb(token("surface")), text = rgb(token("text")), muted = rgb(token("muted"));
      expect(body(".plate-room")).toMatch(/^fill: color-mix\(in srgb, var\(--h\) 18%, var\(--surface\)\);/);
      expect(body(".plate-open.place")).toMatch(/^fill: color-mix\(in srgb, var\(--h\) 8%, var\(--surface\)\);/);
      expect(contrast(rgb(token("gold-ink")), rgb(token("gold")))).toBeGreaterThanOrEqual(4.5);
      for (const name of ["Marriott", "Hyatt", "Hilton", "Courtland", "Westin"]) {
        const hue = rgb(token(`h-${name}`)), plate = mix(hue, ink, 0.11), room = mix(hue, ground, 0.18), tint = mix(hue, ground, 0.08);
        for (const [what, a, b, least] of [["a room's name on its room", text, room, 4.5], ["an open area's name on the plate", muted, plate, 4.5], ["an open area's name on a place's tint", muted, tint, 4.5],
          ["a landmark on the plate", muted, plate, 4.5], ["a group's name on the plate", hue, plate, 3], ["the selection round a room", text, room, 3], ["a room's focus on the plate", text, plate, 3]]) {
          expect(contrast(a, b), `${name}: ${what}`).toBeGreaterThanOrEqual(least);
        }
      }
    });
  });

  /* New rules, not ledger rows (DECISIONS #97): the stylesheet's half of the
     motion - what a move's keyframes show, and what nothing else may. */
  describe("the motion between the Map's views (DECISIONS #97)", () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), body: m[2].trim().replace(/\s+/g, " ") }));
    const body = selector => rules.filter(r => r.selector === selector).map(r => r.body).join(" | ");
    const src = name => fs.readFileSync(path.join(ROOT, "src", name), "utf8");

    it("a venue's group that is put away is rendered and not shown: one rule, which outweighs the page's own for [hidden], so a way back's keyframes can show it", () => {
      expect(body(".map-stack[hidden]")).toBe("display: inline !important; visibility: hidden;");
      expect(body("[hidden]")).toBe("display: none !important;");
      expect(rules.filter(r => /\[hidden\]/.test(r.selector) && /display: (?!none)/.test(r.body)).map(r => r.selector)).toEqual([".map-stack[hidden]"]);    // one class heavier, and the only exception
    });
    it("nothing but a move makes a hidden thing visible: no rule of the stylesheet says visibility: visible", () => {
      expect(rules.filter(r => /visibility:\s*visible/.test(r.body)).map(r => r.selector)).toEqual([]);
    });
    it("the block's face is not shown at any end state: its one rule hides it, whatever the view, and no rule gives it a pointer to take or to refuse", () => {
      expect(body(".stack-face")).toBe("visibility: hidden;");
      const face = rules.filter(r => /\.stack-face/.test(r.selector));
      expect(face.map(r => r.selector)).toEqual([".stack-face", ".stack-face rect", ".stack-face text", ".stack-face text.long"]);
      expect(face.filter(r => /pointer-events|display|opacity/.test(r.body))).toEqual([]);
    });
    it("the face is the block as the Map draws it: its fill, its edge - which keeps its width as the camera grows it - and its name's face", () => {
      const fill = /^fill: (color-mix\([^;]+\)); stroke: var\(--h\);/.exec(body(".map-hotel rect"))[1];
      expect(body(".stack-face rect")).toBe(`fill: ${fill}; stroke: var(--h); stroke-width: 1.5px; vector-effect: non-scaling-stroke;`);
      expect(body(".stack-face text")).toBe("font-family: var(--font); font-weight: 600; letter-spacing: .06em; fill: var(--h); text-anchor: middle; dominant-baseline: central;");
      expect(body(".map-hotel text")).toMatch(/font-weight: 600; letter-spacing: \.06em; fill: var\(--h\); text-anchor: middle; dominant-baseline: central;$/);
      expect([body(".stack-face text.long"), /letter-spacing: \.04em;/.test(body(".map-hotel text.long"))]).toEqual(["letter-spacing: .04em;", true]);
    });
    it("the lift dims the city to the stylesheet's own two numbers: motion.js DIM and the rules under [data-stack] say the same", () => {
      const dim = /const DIM = \{streets: ([\d.]+), blocks: ([\d.]+)\};/.exec(src("motion.js")).slice(1).map(Number);
      expect([body(".map[data-stack] .map-streets"), body(".map[data-stack] .map-hotel")]).toEqual([`opacity: ${String(dim[0]).replace(/^0/, "")};`, `opacity: ${String(dim[1]).replace(/^0/, "")};`]);
    });
    it("the motion is the script's and none of the stylesheet's: no rule of the Map's moves a thing or times it but the next ring's pulse", () => {
      const MAP = /\.(map|plate|stack-|level-|lv-)|\[data-(stack|level)\]/;
      expect(rules.filter(r => MAP.test(r.selector) && /(^|; )(transition|animation|transform)[\w-]*:/.test(r.body)).map(r => r.selector)).toEqual([".map-ring.next", ".map-ring.next"]);
      expect(bare.match(/@keyframes [\w-]+/g)).toContain("@keyframes map-pulse");
    });
  });

  /* The Map's stage (DECISIONS #100): the map's own box, at every size. */
  describe("the Map's stage (DECISIONS #100)", () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), body: m[2].trim().replace(/\s+/g, " ") }));
    const body = selector => rules.filter(r => r.selector === selector).map(r => r.body).join(" | ");
    const token = name => new RegExp(`--${name}: (#[0-9A-Fa-f]{6})`).exec(css)[1];
    const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

    it("the stage is one token, darker than the page and than the old ground", () => {
      expect(token("stage")).toBe("#0B0D20");
      expect(lum(token("stage"))).toBeLessThan(lum(token("ink")));
      expect(lum(token("ink"))).toBeLessThan(lum(token("surface")));
      expect(rules.filter(r => /var\(--stage\)/.test(r.body)).map(r => r.selector)).toEqual([".map"]);
    });
    it("its fill, its edge and its corners are the svg's own box's: the edge a shadow inside the box, which takes no room - no border, which would move the drawing, and no outline", () => {
      expect(body(".map")).toBe("display: block; width: 100%; height: auto; flex: 0 1 auto; min-height: 200px; background: var(--stage); border-radius: 14px; box-shadow: inset 0 0 0 1px var(--line);");
      expect(rules.filter(r => /(^|[\s,])(svg)?\.map$/.test(r.selector) && /(^|; )(border|outline|padding|margin)[a-z-]*:/.test(r.body.replace(/border-radius/g, "radius"))).map(r => r.selector)).toEqual([]);
    });
    it("the ground's rectangle draws nothing of its own, and is still there to be measured and touched: see-through, not none", () => {
      expect(body(".map-ground")).toBe("fill: transparent;");
    });
    it("the dimmed city behind a stack runs to the stage's edge: the draw's clip is lifted, and the svg's box cuts it", () => {
      expect(body(".map[data-stack] .map-city")).toBe("clip-path: none;");
    });
    it("the way back stands where it stood, 6px inside the stage's corner: the map's box starts at the wrap's padding, 14px in and 12 down", () => {
      expect(body(".map-wrap")).toMatch(/(^|; )position: relative; .*padding: 12px 14px 0;$/);
      expect(body(".map-back")).toMatch(/^position: absolute; left: 20px; top: 18px; /);
    });
  });

  /* The first-contact pass (DECISIONS #101). */
  describe("the first-contact pass (DECISIONS #101)", () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), body: m[2].trim().replace(/\s+/g, " ") }));
    const body = selector => rules.filter(r => r.selector === selector).map(r => r.body).join(" | ");
    const SRC = path.join(ROOT, "src");

    it("--dim colours marks alone - a dotted edge, a caret, the dots between a row's parts, the empty star: every word is --muted", () => {
      expect(rules.filter(r => /var\(--dim\)/.test(r.body)).map(r => r.selector)).toEqual([
        ".plate.inert .plate-hull", ".fol-head .caret", ".when-where", ".flags > * + *::before", ".star", ".ev-facts > * + *::before"]);
      /* a row's second line: its words each take a colour of their own, and what is left for --dim is the dots between them */
      expect([body(".when-where .when"), body(".when-where .day"), body(".when-where .level")].map(b => /(^|; )color: var\(--(text|muted|h)\);/.test(b))).toEqual([true, true, true]);
      expect(body(".room")).toMatch(/color: var\(--h\);/);
    });
    it("and none is coloured --dim from a module's markup, nor from the page's: a day's count is its class's", () => {
      const files = [...fs.readdirSync(SRC).filter(f => f.endsWith(".js")).map(f => path.join(SRC, f)), path.join(ROOT, "index.html")];
      expect(files.filter(f => /--dim\b/.test(fs.readFileSync(f, "utf8"))).map(f => path.basename(f))).toEqual([]);
      expect(body(".day-head .count")).toBe("font-size: .875rem; color: var(--muted); font-weight: 400;");
    });
    it("--dim's value, and --muted's, are as they were", () => {
      expect(css).toMatch(/\n {2}--muted: #A5A9C9;\n {2}--dim: #6F739A;/);
    });
    it("a follow chip is a mute chip's shape: its name 44px tall, its x 44 by 44, and Follow more beside them the row's height", () => {
      expect(body(".follow-chip .fc-name")).toMatch(/(^|; )min-height: 44px; padding: 7px 4px 7px 14px; /);
      expect(body(".follow-chip .fc-x")).toMatch(/(^|; )min-width: 44px; min-height: 44px; /);
      expect(body(".chip.fc-add")).toBe("flex: none; height: 44px; border-radius: 22px;");
      expect([body(".mute-chip .fc-name"), body(".mute-chip .fc-x")].map(b => /min-(width|height)|padding/.test(b))).toEqual([false, false]);
    });
    it("the way back from an Explore page is 44px tall and at least 44 wide, and the head is no taller: 10px over the head's own padding above, and below what is left of 44 after a line, in em", () => {
      expect(body(".explore-head .back")).toBe("position: relative; display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; margin: -10px 0 calc(1.3em - 34px); background: none; border: 0; padding: 0; color: var(--muted); font: inherit; font-weight: 600; cursor: pointer;");
      expect(body(".explore-head")).toMatch(/^padding: 10px 14px 14px; /);
      expect(css).toMatch(/\nbody \{\n {2}margin: 0; font-family: var\(--font\); font-size: 1\.0625rem; line-height: 1\.3;/);
    });
  });
});
