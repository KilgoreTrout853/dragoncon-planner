/* Markup the views share: an event's row, a crewmate's pick as a line, a
   chip, the celebrity badge. Builders and their constants only - this module
   holds no DOM handle, scrolls nothing and draws nothing; it returns strings,
   and whoever asked puts them on the page. rowHTML reads state.sheetId and
   picks to mark the open and the starred row, and the plan's overlaps,
   through walk.js, for a picked row's flag; crewLineHTML reads picks to say
   "yours too". */
import { esc, fmtRange } from "./util.js";
import { state } from "./state.js";
import { DAY_LABEL } from "./time.js";
import { hotelVar, levelShort, placeHTML } from "./venues.js";
import { flagsOf, isCeleb } from "./data.js";
import { picks } from "./picks.js";
import { overlapsOf } from "./walk.js";

const CELEB_BADGE = `<span class="celeb" title="Celebrity guest">Celebrity</span>`;

/* An event's row (DECISIONS #64, #73): the title, then up to two lines under
   it, and the star on the right.
   - Line 1, the title, two lines at most: a cancelled or removed event says
     so first, inside the title's two lines, where it is never clipped; the
     strike is the title's words', not the tag's.
   - Line 2, one line: the day's label where the caller asks for it, the time
     as a range, the place and the level, each after a middle dot. Under a
     time head it says its time all the same: one row shape everywhere. The
     level is a part of its own, so it drops whole where the line cannot hold
     it, before the room is cut (styles.css).
   - Line 3, one line, only when anything is there: Celebrity; the overlap
     flag; the caller's context - Now's status, the Following feed's
     labels; the event's flags; the track, or "Gaming". Each part drops
     whole from the end where the line cannot hold it; the overlap's title
     shortens first, and Celebrity and the overlap never drop.
   - The overlap flag (W1): a picked row that overlaps another pick says so
     wherever it is drawn - "Overlaps <title>", or "Overlaps <n> picks" -
     from walk.js overlapsOf(), connection()'s answer over every pick. Every
     row is drawn again after a star, so the flag comes and goes on both
     rows at once. A flagged row leaves its track off: there is no room for
     both, and a clipped track says nothing.
   Search's ranked results keep their snippet under it all. */
function rowHTML(ev, opts = {}) {
  const mine = picks.has(ev.id), open = state.sheetId === ev.id;
  /* A removed event is drawn only as a pick, in Plans (DECISIONS #49), and is
     marked as a cancelled one is. It can be unstarred and never starred anew:
     a crewmate's pick of one, in the crew's day, carries no star to add it. */
  const cls = ["row", mine ? "mine" : "", open ? "open" : "", ev.cancelled ? "cancelled" : "", ev.removed ? "removed" : ""].filter(Boolean).join(" ");
  const hl = opts.terms ? highlighter(opts.terms) : (x => esc(x));
  const snippet = opts.terms ? snippetFor(ev, opts.terms) : "";
  const tags = (ev.cancelled ? `<span class="cancelled-tag">Cancelled</span> ` : "")
    + (ev.removed ? `<span class="removed-tag">Removed from the schedule</span> ` : "");
  const hue = `--h:var(${hotelVar(ev.hotel)})`, level = levelShort(ev);
  const day = opts.showDay ? `<span class="day">${DAY_LABEL[ev._cd] || ""}</span> ` : "";
  const clash = overlapsOf(ev);
  const overlap = clash.length === 1 ? `Overlaps ${clash[0].title}` : clash.length ? `Overlaps ${clash.length} picks` : "";
  const track = overlap ? "" : ev.track || (ev.type === "gaming" ? "Gaming" : "");
  const line3 = [
    isCeleb(ev) ? CELEB_BADGE : "",
    overlap ? `<span class="overlap">${esc(overlap)}</span>` : "",
    opts.status ? `<span class="status">${esc(opts.status)}</span>` : "",
    ...(opts.labels || []).map(l => `<span><span class="flabel">${esc(l)}</span></span>`),
    ...flagsOf(ev).map(f => `<span class="flag${f.key === "sold_out" ? " warn" : ""}">${esc(f.label)}</span>`),
    track ? `<span class="track">${esc(track)}</span>` : "",
  ].join("");
  return `<li class="${cls}" data-id="${esc(ev.id)}" data-list="${esc(opts.list || "")}">
    <div class="row-line">
      <button class="row-main" aria-haspopup="dialog">
        <div class="title">${tags}${hl(ev.title)}</div>
        <div class="when-where"><span class="at"><span class="when">${day}${fmtRange(ev._s, ev._e)}</span> · <span class="room" style="${hue}">${placeHTML(ev)}</span></span>${level ? `<span class="level" style="${hue}"> · ${esc(level)}</span>` : ""}</div>
        ${line3 ? `<div class="flags">${line3}</div>` : ""}
        ${snippet ? `<div class="snippet">${snippet}</div>` : ""}
      </button>
      <button class="star" aria-pressed="${mine}" aria-label="${mine ? "Remove from my schedule" : "Add to my schedule"}"${ev.removed && !mine ? " disabled" : ""}>${mine ? "★" : "☆"}</button>
    </div>
  </li>`;
}

function highlighter(terms) {
  const words = [...new Set(terms)].filter(t => t.length > 1).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return x => esc(x);
  const re = new RegExp(`(${words.join("|")})`, "gi");
  return x => esc(x).replace(re, "<mark>$1</mark>");
}
function snippetFor(ev, terms) {
  const d = ev.description || "";
  const words = [...new Set(terms)].filter(t => t.length > 1);
  let pos = -1;
  for (const w of words) { const i = d.toLowerCase().indexOf(w); if (i >= 0 && (pos < 0 || i < pos)) pos = i; }
  if (pos < 0) {
    const who = (ev.people || []).map(p => p.name).join(", ");
    if (who && words.some(w => who.toLowerCase().includes(w))) return `With ${highlighter(terms)(who)}`;
    return d ? esc(d.slice(0, 110)) + (d.length > 110 ? "…" : "") : "";
  }
  const start = Math.max(0, pos - 40), end = Math.min(d.length, pos + 100);
  return (start > 0 ? "…" : "") + highlighter(terms)(d.slice(start, end)) + (end < d.length ? "…" : "");
}

/* A crewmate's pick as a line (DECISIONS #62), a button to the event's
   sheet: who and when, and "yours too" when the reader picked it too; then
   what and where, the title giving way before the place does. Now's Your
   crew's picks right now and the hotel sheet's Your crew's picks here draw
   it, each giving the line its id, the words after the name - "on now", or
   the start - and the place, "" for none, which leaves the title alone.
   Every name is someone's own text, so escaped. A star is a pick, not a
   whereabouts: the line says what was starred, never that anyone is going
   (#68), and .cn-with keeps its old name. The words after the name never
   break inside: "4:00" and "PM" stay on one line (#73). */
function crewLineHTML(id, name, when, ev, where) {
  const withYou = picks.has(ev.id) ? ` &middot; <span class="cn-with">yours too</span>` : "";
  return `<li><button class="crew-now" id="${esc(id)}" data-hero="${esc(ev.id)}" aria-haspopup="dialog">
    <span class="cn-top"><b class="cn-who">${esc(name)}</b> &middot; <span class="cn-when">${esc(when)}</span>${withYou}</span>
    <span class="cn-what"><span class="cn-title">${esc(ev.title)}</span>${where ? `<span class="cn-where" style="--h:var(${hotelVar(ev.hotel)})">&nbsp;&middot; ${esc(where)}</span>` : ""}</span>
  </button></li>`;
}

function chipHTML(label, on, kind, value, style) {
  const v = value ?? label;
  const cls = kind.endsWith("hotel") && v !== "All" ? `chip hotel` : `chip`;
  const st = kind.endsWith("hotel") && v !== "All" ? ` style="--h:var(${hotelVar(v)})"` : "";
  return `<button class="${cls}" data-chip="${kind}" data-value="${esc(v)}" aria-pressed="${on}"${st}>${esc(label)}</button>`;
}

export { CELEB_BADGE, rowHTML, crewLineHTML, chipHTML };
