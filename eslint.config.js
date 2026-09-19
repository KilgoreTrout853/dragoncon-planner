/* Three rules, nothing inherited (DECISIONS #24). This is a guard for the
   module split, not a style guide: no-undef catches a function that moved
   to another module without its import, and no-unused-vars the import that
   stayed behind when the function it was for moved on; the third rule is
   the #12 clock guard, which took over from the regex the smoke harness had
   when src/time.js became a module. */
import globals from "globals";

/* Every read of the current moment goes through now() in src/time.js. A
   Date built from a value - new Date(iso), new Date(ms) - is arithmetic,
   not a clock read, and is allowed, exactly as that regex allows it. */
const CLOCK = [
  { selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: "Read the clock through now() from src/time.js (DECISIONS #12)." },
  { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: "Read the clock through now() from src/time.js (DECISIONS #12); use performance.now() for a stopwatch." },
];

/* main is the scroller, not the page, so nothing scrolls the window or reads
   how far it has scrolled; and the stamp decides the channel, never the
   address (DECISIONS #15). These took over from two regexes over the source
   text, [780] and [1989] in tests/rules/source.test.js, and catch every form
   of code those caught: window and location reached through another object
   (self.window.scrollY, window.location.hostname, document.location.origin),
   and pageYOffset wherever it is named, bare or as a property. */
const SCROLL = "main is the scroller, not the page: scroll and measure through src/scroll.js.";
const ADDRESS = "The stamp decides the channel, never the address (DECISIONS #15).";
const PAGE = [
  { selector: "CallExpression[callee.type='MemberExpression'][callee.computed=false][callee.property.name=/^scroll(To|By)$/]:matches([callee.object.name='window'], [callee.object.property.name='window'])",
    message: SCROLL },
  { selector: "MemberExpression[computed=false][property.name='scrollY']:matches([object.name='window'], [object.property.name='window'])",
    message: SCROLL },
  { selector: "Identifier[name='pageYOffset']",
    message: SCROLL },
  { selector: "MemberExpression[computed=false][property.name=/^(host|hostname|origin)$/]:matches([object.name='location'], [object.property.name='location'])",
    message: ADDRESS },
];

export default [
  { ignores: ["node_modules/", "dist/", "data/"] },

  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "no-undef": "error",
      /* an argument or a caught error that goes unused is how a signature or
         a catch is written, not a leftover */
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
    },
  },

  /* One rule, two lists. A later object's options for a rule replace an
     earlier object's, they are not added to them: so the page's selectors are
     given for all of src/, and given again, with the clock's, for every file
     but src/time.js, where now() lives and is the one place to read the
     clock. */
  {
    files: ["src/**/*.js"],
    rules: { "no-restricted-syntax": ["error", ...PAGE] },
  },
  {
    files: ["src/**/*.js"],
    ignores: ["src/time.js"],
    rules: { "no-restricted-syntax": ["error", ...CLOCK, ...PAGE] },
  },
];
