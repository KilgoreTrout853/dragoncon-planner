/* Two rules, nothing inherited (DECISIONS #24). This is a guard for the
   module split, not a style guide: no-undef catches a function that moved
   to another module without its import; the second rule is the #12 clock
   guard, taking over module by module from the regex the smoke harness
   had, which is now the Time-section rule in tests/rules/source.test.js. */
import globals from "globals";

export default [
  { ignores: ["node_modules/", "dist/", "data/"] },

  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { "no-undef": "error" },
  },

  /* Every read of the current moment goes through now() in src/time.js. A
     Date built from a value - new Date(iso), new Date(ms) - is arithmetic,
     not a clock read, and is allowed, exactly as that regex allows it. */
  {
    files: ["src/**/*.js"],
    ignores: [
      "src/time.js",
      /* temporary until src/time.js exists (PR 5); tests/rules/source.test.js guards #12 until then. */
      "src/app.js",
    ],
    rules: {
      "no-restricted-syntax": ["error",
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "Read the clock through now() from src/time.js (DECISIONS #12)." },
        { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: "Read the clock through now() from src/time.js (DECISIONS #12); use performance.now() for a stopwatch." },
      ],
    },
  },
];
