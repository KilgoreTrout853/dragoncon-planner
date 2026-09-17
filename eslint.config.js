/* Two rules, nothing inherited (DECISIONS #24). This is a guard for the
   module split, not a style guide: no-undef catches a function that moved
   to another module without its import; the second rule is the #12 clock
   guard, taking over from the smoke test's regex once src/ exists. */
import globals from "globals";

export default [
  { ignores: ["node_modules/", "dist/", "site/", "data/", "tests/ui_smoke.cjs"] },

  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { "no-undef": "error" },
  },

  /* Inert until src/ exists (PR 3). Every read of the current moment goes
     through now() in src/time.js. A Date built from a value - new Date(iso),
     new Date(ms) - is arithmetic, not a clock read, and is allowed, exactly
     as the smoke test's regex allows it today. */
  {
    files: ["src/**/*.js"],
    ignores: ["src/time.js"],
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
