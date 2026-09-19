import { pad } from "./util.js";
import { now } from "./time.js";
import { events } from "./data.js";
import { picks } from "./picks.js";

/* ==================================================================
   Calendar export (.ics)
   ================================================================== */
function icsEscape(s) { return String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
function fold(line) { const out = []; while (line.length > 74) { out.push(line.slice(0, 74)); line = " " + line.slice(74); } out.push(line); return out.join("\r\n"); }
function icsDate(d) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`; }
function exportICS() { downloadICS(events.filter(e => picks.has(e.id)), "dragoncon-2026-my-schedule.ics"); }
function exportEventICS(ev) {
  downloadICS([ev], `dragoncon-2026-${(ev.title || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "event"}.ics`);
}
function downloadICS(mine, filename) {
  const stamp = now().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//dragoncon-planner//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Dragon Con 2026",
    "BEGIN:VTIMEZONE", "TZID:America/New_York",
    "BEGIN:DAYLIGHT", "TZOFFSETFROM:-0500", "TZOFFSETTO:-0400", "TZNAME:EDT", "DTSTART:19700308T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:-0400", "TZOFFSETTO:-0500", "TZNAME:EST", "DTSTART:19701101T020000", "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU", "END:STANDARD",
    "END:VTIMEZONE"];
  mine.forEach(ev => {
    const who = (ev.speakers || []).map(p => p.name).join(", ");
    const desc = [ev.description, who ? `With: ${who}` : "", ev.track ? `Track: ${ev.track}` : ""].filter(Boolean).join("\n");
    lines.push("BEGIN:VEVENT", `UID:dc26-${ev.id}@dragoncon-planner`, `DTSTAMP:${stamp}`,
      `DTSTART;TZID=America/New_York:${icsDate(ev._s)}`, `DTEND;TZID=America/New_York:${icsDate(ev._e)}`,
      fold(`SUMMARY:${icsEscape(ev.title)}`), fold(`LOCATION:${icsEscape(ev.location)}`), fold(`DESCRIPTION:${icsEscape(desc)}`), "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n") + "\r\n"], {type: "text/calendar;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}

export { exportICS, exportEventICS };
