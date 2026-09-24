/* Three rules, nothing inherited (DECISIONS #24). A guard, not a style
   guide. no-undef catches a name used in a module that does not import it,
   and no-unused-vars the import left behind when what it was for moved on.
   The third, no-restricted-syntax, holds what were once regexes over the
   source text: the #12 clock guard, and the two rules about the page. */
import globals from "globals";

/* Every read of the current moment goes through now() in src/time.js. A
   Date built from a value - new Date(iso), new Date(ms) - is arithmetic,
   not a clock read, and is allowed, exactly as the regex it replaced
   allowed it. */
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

  /* tools/ is not part of the build and never reaches dist/: pages opened from
     disk, with no server and no bundler. The block above gives every file both
     browser and Node globals, which for a page is too generous - a `process`
     or a `require` there is a mistake, not a global - so Node's own names are
     turned off for tools/ and the browser's left on. */
  {
    files: ["tools/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...Object.fromEntries(Object.keys(globals.node)
          .filter(name => !(name in globals.browser)).map(name => [name, "off"])),
      },
    },
  },

  /* The year the build defines, read in one place (DECISIONS #49). */
  {
    files: ["src/season.js"],
    languageOptions: { globals: { __DC_YEAR__: "readonly" } },
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
