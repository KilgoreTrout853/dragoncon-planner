/* The event's panel of the bottom sheet: what it says of one event - the
   head, the body that scrolls and the actions - who in the reader's crews
   starred it, and the refill of that line in place when a pull's redraw
   runs. Markup and what is written into it, found by id when asked: the
   panel's element is sheet.js's, which draws this into it as it opens, and
   the clicks inside it are dispatch's. It stands below both, and holds no
   DOM handle. */
import { esc, fmtShort } from "./util.js";
import { hasBackend } from "./backend.js";
import { goingTo } from "./crews.js";
import { state } from "./state.js";
import { DAY_LONG } from "./time.js";
import { hotelVar, placeHTML } from "./venues.js";
import { byId, directWorks, isCeleb, tagsOf, worksById } from "./data.js";
import { picks } from "./picks.js";
import { CELEB_BADGE } from "./ui.js";

/* Who's going (W22; DECISIONS #62, #64): the crewmates whose picks hold the
   event, by name, three of them and then how many more - from what the pull
   kept (crews.js goingTo()), so on a build with a backend alone, and never
   for a removed event, which is not happening. "" for no one. Every name is
   someone's own text, escaped where it is drawn. In 2027 it taps nowhere.
   The screen says what they starred, "Starred by", never that they are
   going: a star is a pick (#68). The code's names - goingText(),
   #sheetGoing, .ev-going - keep "going". */
const GOING_NAMED = 3;
function goingText(ev) {
  const going = hasBackend && !ev.removed ? goingTo(ev.id) : [];
  if (!going.length) return "";
  const more = going.length - GOING_NAMED;
  return `Starred by ${going.slice(0, GOING_NAMED).map(p => p.display_name).join(", ")}${more > 0 ? ` and ${more} more` : ""}`;
}

function eventSheetHTML(ev) {
  const mine = picks.has(ev.id), going = goingText(ev);
  /* Each person as this listing spells them, with the role it gives them;
     See all opens their page by id. */
  const peopleRows = (ev.people || []).filter(p => p && p.name).map(p => ({
    id: p.id,
    label: p.role && p.role !== "Speaker" && p.role !== "Panelist" ? `${p.name} (${p.role.toLowerCase()})` : p.name,
  }));
  const dur = ev.duration_min ? (ev.duration_min >= 60 ? `${Math.floor(ev.duration_min / 60)} h${ev.duration_min % 60 ? ` ${ev.duration_min % 60} min` : ""}` : `${ev.duration_min} min`) : "";
  const chips = [...(ev.tracks || []), ...directWorks(ev).map(id => (worksById.get(id) || {}).name).filter(Boolean)];
  const mature = tagsOf(ev).audience === "mature";
  /* The calendar takes only what is on the schedule: Plans' export leaves a
     removed pick out, and so does this, the other door to the same calendar
     (DECISIONS #49). A cancelled event keeps its button, as it always had. */
  const ics = ev.removed ? "" : `<button class="btn quiet" id="sheetICS">Add this to calendar</button>`;
  return `<div class="ev-head">
      <h2 id="sheetTitleEvent" tabindex="-1">${esc(ev.title)}</h2>
      <div class="ev-when">${DAY_LONG[ev.day] || ev.day}, ${fmtShort(ev._s)} to ${fmtShort(ev._e)}${dur ? ` &middot; ${dur}` : ""}${ev._cd !== ev.day ? ` &middot; ${DAY_LONG[ev._cd] || ev._cd} night` : ""}</div>
      <div class="ev-room" style="--h:var(${hotelVar(ev.hotel)})">${placeHTML(ev)}</div>
      ${ev.cancelled ? `<div><span class="cancelled-tag">Cancelled</span></div>` : ""}
      ${ev.removed ? `<div><span class="removed-tag">Removed from the schedule</span></div>` : ""}
      ${isCeleb(ev) ? `<div>${CELEB_BADGE}</div>` : ""}
      <p class="ev-going" id="sheetGoing"${going ? "" : " hidden"}>${esc(going)}</p>
    </div>
    <div class="ev-body">
      ${ev.description ? `<p>${esc(ev.description)}</p>` : `<p style="color:var(--muted)">No description.</p>`}
      ${peopleRows.length ? `<div class="ev-people">With ${peopleRows.map(p =>
        `<span class="who"><span>${esc(p.label)}</span> <button class="see-all" data-explore="person:${esc(p.id)}">See all</button></span>`).join(", ")}</div>` : ""}
      ${chips.length || mature ? `<div class="tagline">${chips.map(t => `<span class="tag">${esc(t)}</span>`).join("")}${mature ? `<span class="tag adult">18+</span>` : ""}</div>` : ""}
    </div>
    <div class="ev-actions">
      <button class="ev-star" id="sheetStar" aria-pressed="${mine}" aria-label="${mine ? "Remove from my schedule" : "Add to my schedule"}"${ev.removed && !mine ? " disabled" : ""}>${mine ? "★" : "☆"}</button>
      ${ics}
      <button class="btn" id="closeSheetEvent">Done</button>
    </div>`;
}

/* And the open event - `state.sheetId` is one only while its panel is
   shown: its who's-going line alone, its words and whether it shows, in
   place - the panel is never drawn again for it, so focus and everything
   else in the sheet stay as they are (#66). */
function refreshEventSheet() {
  const ev = state.sheetId ? byId.get(state.sheetId) : null, line = document.getElementById("sheetGoing");
  if (!ev || !line) return;
  const going = goingText(ev);
  if (line.textContent !== going) line.textContent = going;
  line.hidden = !going;
}

export { eventSheetHTML, refreshEventSheet };
