/* Markup the views share: an event's row, a crewmate's pick as a line, a
   chip, the celebrity badge. Builders and their constants only - this module
   holds no DOM handle, scrolls nothing and draws nothing; it returns strings,
   and whoever asked puts them on the page. rowHTML reads state.sheetId and
   picks to mark the open and the starred row, and crewLineHTML picks to say
   "yours too". */
import { esc, fmt } from "./util.js";
import { state } from "./state.js";
import { DAY_LABEL } from "./time.js";
import { hotelVar, placeHTML } from "./venues.js";
import { isCeleb } from "./data.js";
import { picks } from "./picks.js";

const CELEB_BADGE = `<span class="celeb" title="Celebrity guest">Celebrity</span>`;

function rowHTML(ev, opts = {}) {
  const s = fmt(ev._s), e = fmt(ev._e);
  const mine = picks.has(ev.id), open = state.sheetId === ev.id;
  const status = opts.status ? `<span class="status">${esc(opts.status)}</span>` : "";
  /* A removed event is drawn only as a pick, in Plans (DECISIONS #49), and is
     marked as a cancelled one is. It can be unstarred and never starred anew:
     a crewmate's pick of one, in the crew's day, carries no star to add it. */
  const cls = ["row", mine ? "mine" : "", open ? "open" : "", ev.cancelled ? "cancelled" : "", ev.removed ? "removed" : ""].filter(Boolean).join(" ");
  const hl = opts.terms ? highlighter(opts.terms) : (x => esc(x));
  const snippet = opts.terms ? snippetFor(ev, opts.terms) : "";
  return `<li class="${cls}" data-id="${esc(ev.id)}" data-list="${esc(opts.list || "")}">
    <div class="row-line">
      <button class="row-main" aria-haspopup="dialog">
        <div class="t">${opts.showDay ? `<span class="day">${DAY_LABEL[ev._cd] || ""}</span>` : ""}<span class="start">${s.t}<span class="ampm">${s.ap}</span></span><span class="end">to ${e.t} ${e.ap}</span></div>
        <div class="body">
          <div class="title">${hl(ev.title)}</div>
          <div class="meta">
            <span class="room" style="--h:var(${hotelVar(ev.hotel)})">${placeHTML(ev)}</span>
            ${ev.cancelled ? `<span class="cancelled-tag">Cancelled</span>` : ""}${ev.removed ? `<span class="removed-tag">Removed from the schedule</span>` : ""}${status}${isCeleb(ev) ? CELEB_BADGE : ""}${(opts.labels || []).map(l => `<span class="flabel">${esc(l)}</span>`).join("")}<span class="track">${esc(ev.track || (ev.type === "gaming" ? "Gaming" : ""))}</span>
          </div>
          ${snippet ? `<div class="snippet">${snippet}</div>` : ""}
        </div>
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
   (#68), and .cn-with keeps its old name. */
function crewLineHTML(id, name, when, ev, where) {
  const withYou = picks.has(ev.id) ? ` &middot; <span class="cn-with">yours too</span>` : "";
  return `<li><button class="crew-now" id="${esc(id)}" data-hero="${esc(ev.id)}" aria-haspopup="dialog">
    <span class="cn-top"><b class="cn-who">${esc(name)}</b> &middot; ${esc(when)}${withYou}</span>
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
