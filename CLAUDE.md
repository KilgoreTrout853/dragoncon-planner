# Standing rules

1. Read `docs/DECISIONS.md`, `docs/ARCHITECTURE.md` and `docs/VISION.md`
   before any task. Decisions are binding; propose a new numbered entry
   rather than working around one.
2. Branches: `main` is frozen at `v2026-final`. Never commit to `main` or
   `next`. Every change is a feature branch off `next` and a PR into
   `next`, squash-merged.
3. Before writing code, summarize what you found and your plan.
4. Before pushing: `npm run lint`, `npm test` and
   `python -m pytest tests/` all green.
5. Every read of the current time goes through `now()` (DECISIONS #12). No
   bare `new Date()` or `Date.now()` outside the Time module.
6. A change that alters the shape described in `docs/ARCHITECTURE.md`
   updates that file in the same PR.
7. `data/2026/events.json` is frozen (#13). Never edit it.
8. No new dependencies, workflows, or secrets without naming them in the
   plan.
9. Refactors are behaviour-preserving unless the task says otherwise; move
   code by section, never by find-and-replace (`now`, `pad`, `index`,
   `events` are shadowed names).
