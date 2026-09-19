/* Small pure helpers the other modules lean on: escaping, padding, dates and
   durations. Nothing here reads the page, storage or the clock. */

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2, "0");
const toDate = iso => new Date(iso);              // "2026-09-05T11:30" parses as local time
function fmt(d) { let h = d.getHours(), m = d.getMinutes(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return {t: `${h}:${pad(m)}`, ap}; }
function fmtShort(d) { const f = fmt(d); return `${f.t} ${f.ap}`; }
function minutesBetween(a, b) { return Math.round((b - a) / 60000); }
/* "310 min" is a number, "5 h 10 min" is a plan. */
function fmtMins(m) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

function dayOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export {
  esc, pad, toDate, fmt, fmtShort, minutesBetween, fmtMins, dayOf,
};
