/* Small pure helpers the other modules lean on: escaping, padding, dates and
   durations. Nothing here reads the page, storage or the clock. */

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2, "0");
const toDate = iso => new Date(iso);              // "2026-09-05T11:30" parses as local time
function fmt(d) { let h = d.getHours(), m = d.getMinutes(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return {t: `${h}:${pad(m)}`, ap}; }
function fmtShort(d) { const f = fmt(d); return `${f.t} ${f.ap}`; }
/* "2:30–3:30 PM": a span of time, an en dash between, the meridiem once where
   both ends share it and at each end where they do not, "11:30 AM–12:30 PM"
   (DECISIONS #73). fmtShort() is one end alone. */
function fmtRange(s, e) {
  const a = fmt(s), b = fmt(e);
  return a.ap === b.ap ? `${a.t}–${b.t} ${b.ap}` : `${a.t} ${a.ap}–${b.t} ${b.ap}`;
}
function minutesBetween(a, b) { return Math.round((b - a) / 60000); }
/* "310 min" is a number, "5 h 10 min" is a plan. */
function fmtMins(m) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

function dayOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export {
  esc, pad, toDate, fmt, fmtShort, fmtRange, minutesBetween, fmtMins, dayOf,
};
