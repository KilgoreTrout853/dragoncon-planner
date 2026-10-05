# Standing rules

1. Read `docs/DECISIONS.md`, `docs/ARCHITECTURE.md` and `docs/VISION.md`
   before any task. Decisions are binding; propose a new numbered entry
   rather than working around one.
2. Branches: `main` is frozen at `v2026-final`. Never commit to `main` or
   `next`. Every change is a feature branch off `next` and a PR into
   `next`, squash-merged.
3. Before writing code, summarize what you found and your plan.
4. Before pushing: `npm run lint`, `npm test`, `npm run test:browser` and
   `python -m pytest tests/` all green; and when anything under `supabase/`
   changed, the database tests too: `npm --prefix supabase run start`, then
   `npm --prefix supabase test`. They need Docker running - the local
   database is a container - so start Docker Desktop first.
5. Every read of the current time goes through `now()` (DECISIONS #12). No
   bare `new Date()` or `Date.now()` outside `src/time.js`; `npm run lint`
   fails on one.
6. A change that alters the shape described in `docs/ARCHITECTURE.md`
   updates that file in the same PR.
7. `data/2026/events.json` is frozen (#13). Never edit it.
8. No new dependencies, workflows, or secrets without naming them in the
   plan.
9. Refactors are behaviour-preserving unless the task says otherwise. Never
   rename or move by find-and-replace: `now` and `pad` are module-level
   names that are also parameters and locals, and `events`, `index`,
   `reload` and `main` each mean more than one thing in the code.
10. A handler lives in the module that owns the state it writes; a new
    module goes into the order (DECISIONS #29;
    `tests/rules/imports.test.js`).
11. A test written now is not a row of the port ledger: its title carries no
    bracket. Never import `src/main.js` in a test: it boots the page.
12. A PR's docs are written once and short (DECISIONS #83).
    - DECISIONS: one entry per decision - Decided, Why, Cost - 25 lines at
      most, with no tables or censuses: at most the one number that decided
      it. An older entry it changes gets "amended by #`<N>`" or "superseded
      by #`<N>`" appended to its heading and nothing more.
    - The contract files (under `docs/screens/`, `docs/sync/` and
      `docs/pipeline/`): no new "as built" part and nothing added to one. A
      section a PR builds gets one line, "Built: `<what>` - PR #`<n>`,
      DECISIONS #`<N>`." Designed text the PR makes false is fixed in
      place. An existing "as built" part the PR changes gets one line under
      its heading, "Changed by PR #`<n>` (#`<N>`): `<one clause>`.", and is
      otherwise left: it is a dated record. What a PR leaves open goes
      under Open, a bullet each.
    - The evidence - what was measured and at which sizes, what was seen
      and what only measured, the suites' counts, a mutation pass - goes in
      the PR description, once, and in no file.
    - `tests/PORT-LEDGER.md` is frozen: never edit it; a bracket in a
      test's title stays as it is.
