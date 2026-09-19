import { dayOf, pad, toDate } from "./util.js";
import { readSession, writeSession } from "./storage.js";
import { BUILD } from "./build.js";

/* ==================================================================
   Time. Every read of the current moment goes through now() - the header
   clock, the Now tab, leave-by, the search folds, the nudge snooze, the
   ICS stamp - so one override moves all of them together. Elapsed-time
   measurements (a drag's speed, the scroll-spy hold, boot timings) are
   stopwatch reads and use performance.now() instead.

   ?now=2026-09-05T14:15 in the URL simulates that moment; an offset is
   honoured (2026-09-05T14:15:00-04:00). The override is kept for the tab's
   session, so a reload or the update pill lands on the same moment, and
   is cleared from Settings or the chip in the header. A simulated clock
   stands still: the tick redraws, but the minute never changes.

   The con's bounds live here too, because the phase of the con - before,
   live, ended - is a question about the clock.
   ================================================================== */
const CON = {
  year: 2026,
  /* The first listed event's start and the last one's end, as the data
     has them: local time, like every time in the app. */
  start: toDate("2026-09-02T18:00"),
  end: toDate("2026-09-07T19:00"),
};

const CON_DAYS = ["2026-09-02","2026-09-03","2026-09-04","2026-09-05","2026-09-06","2026-09-07"];
const DAY_LABEL = {"2026-09-02":"Wed","2026-09-03":"Thu","2026-09-04":"Fri","2026-09-05":"Sat","2026-09-06":"Sun","2026-09-07":"Mon"};
const DAY_LONG = {"2026-09-02":"Wednesday","2026-09-03":"Thursday","2026-09-04":"Friday","2026-09-05":"Saturday","2026-09-06":"Sunday","2026-09-07":"Monday"};

/* Per channel: the next site shares this origin, and sessionStorage with it,
   so a clock simulated there must not follow the reader to the live site in
   the same tab. */
const TIME_OVERRIDE_KEY = `dc26.timeOverride${BUILD.channel ? "." + BUILD.channel : ""}`;
let timeOverride = null;                     // a Date, or null for the wall clock
const parseMoment = raw => { const d = raw ? new Date(raw) : null; return d && !isNaN(d) ? d : null; };

function now() { return timeOverride ? new Date(timeOverride.getTime()) : new Date(); }
const isSimulated = () => timeOverride !== null;

/* The URL wins over the session, so a pasted link means what it says; with
   no ?now= the session's override, if any, carries on. */
function initTimeOverride() {
  const fromUrl = new URLSearchParams(location.search).get("now");
  const raw = fromUrl !== null ? fromUrl : readSession(TIME_OVERRIDE_KEY);
  timeOverride = parseMoment(raw);
  writeSession(TIME_OVERRIDE_KEY, timeOverride ? raw : null);
}
/* value: an ISO date-time, or null for the real clock. The session keeps it,
   and the URL is kept in step so a reload lands on the same moment - only "+"
   is encoded, so the address stays readable - and the hash (an explore deep
   link) is left alone. Returns the override it set: a Date, or null. What the
   page does about a new moment is setTimeOverride()'s, in app.js. */
function setOverride(value) {
  timeOverride = parseMoment(value);
  writeSession(TIME_OVERRIDE_KEY, timeOverride ? value : null);
  const rest = location.search.replace(/^\?/, "").split("&").filter(p => p && !p.startsWith("now="));
  const parts = timeOverride ? rest.concat("now=" + value.replace(/\+/g, "%2B")) : rest;
  history.replaceState(null, "", location.pathname + (parts.length ? "?" + parts.join("&") : "") + location.hash);
  return timeOverride;
}
/* What the datetime-local input in Settings shows for the override. */
const localInputValue = d => `${dayOf(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/* before | live | ended. The bounds are the con's own: a moment at the very
   end is still live. */
function conPhase(at = now()) { return at < CON.start ? "before" : at > CON.end ? "ended" : "live"; }
const conEnded = () => conPhase() === "ended";
/* Once the con is over nothing is "already happened" in a useful sense - the
   whole schedule is - and folding all of it away would hide every result. */
const isPast = (e, at) => e._e <= at && conPhase(at) !== "ended";

/* Before the con the Now tab previews a sensible moment instead of an empty
   one. Shared so the minute tick sees the same clock as the render. After
   the con the tab is the archive, and this is not consulted. */
function effectiveNow() {
  const real = now();
  if (conPhase(real) === "before") {
    return {now: toDate("2026-09-03T10:00"),
      banner: `<b>Con starts Thursday.</b> Showing Thursday 10:00 AM as a preview. Use Settings to preview any other time.`};
  }
  return {now: real, banner: ""};
}

/* A con day runs to 5am, so a 1am Sunday panel still belongs to Saturday. */
function conDayKey(d) { return dayOf(new Date(d.getTime() - 5 * 3600000)); }

export {
  CON, CON_DAYS, DAY_LABEL, DAY_LONG, TIME_OVERRIDE_KEY, timeOverride, now, isSimulated,
  initTimeOverride, setOverride, localInputValue, conPhase, conEnded, isPast, effectiveNow,
  conDayKey,
};
