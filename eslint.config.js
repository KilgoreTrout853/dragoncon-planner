/* Three rules, nothing inherited (DECISIONS #24). This is a guard for the
   module split, not a style guide: no-undef catches a function that moved
   to another module without its import, and no-unused-vars the import that
   stayed behind when the function it was for moved on; the third rule is
   the #12 clock guard, which took over from the regex the smoke harness had
   when src/time.js became a module. */
import globals from "globals";

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

  /* Every read of the current moment goes through now() in src/time.js. A
     Date built from a value - new Date(iso), new Date(ms) - is arithmetic,
     not a clock read, and is allowed, exactly as that regex allows it. */
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
