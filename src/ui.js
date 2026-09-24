/* Markup the views share: an event's row, a chip, the celebrity badge. Builders
   and their constants only - this module holds no DOM handle, scrolls nothing
   and draws nothing; it returns strings, and whoever asked puts them on the
   page. rowHTML reads state.sheetId and picks to mark the open and the starred
   row. */
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
  /* A removed event is drawn only as a pick, in Mine (DECISIONS #49), and is
     marked as a cancelled one is. */
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
      <button class="star" aria-pressed="${mine}" aria-label="${mine ? "Remove from my schedule" : "Add to my schedule"}">${mine ? "★" : "☆"}</button>
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

function chipHTML(label, on, kind, value, style) {
  const v = value ?? label;
  const cls = kind.endsWith("hotel") && v !== "All" ? `chip hotel` : `chip`;
  const st = kind.endsWith("hotel") && v !== "All" ? ` style="--h:var(${hotelVar(v)})"` : "";
  return `<button class="${cls}" data-chip="${kind}" data-value="${esc(v)}" aria-pressed="${on}"${st}>${esc(label)}</button>`;
}

export { CELEB_BADGE, rowHTML, chipHTML };
