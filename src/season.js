/* The year this build is for, and that year's season file (DECISIONS #49).
   DC_YEAR names it at the build - 2026 where it is unset - and
   build/vite-dc.js defines __DC_YEAR__ and resolves virtual:season to
   data/<year>/season.json, inlined like any import: no fetch, and offline by
   construction. Everything the app keeps in storage is keyed dc<YY>., the
   year's last two digits, so a new year starts with nothing of the last
   one's; the worker names its caches the same way. First in the order:
   state.js reads its keys as it is imported. */
import SEASON from "virtual:season";

const YEAR = __DC_YEAR__;
const YY = String(YEAR).slice(2);

export { YEAR, YY, SEASON };
