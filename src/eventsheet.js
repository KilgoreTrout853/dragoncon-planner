/* The event's panel of the bottom sheet (DECISIONS #74;
   docs/screens/contract.md, section 7, as built): what it says of one event,
   in three parts. The head, which never scrolls: the title, when, the place
   and under it the level, Cancelled or Removed, the facts, the other
   sessions, and who in the reader's crews starred it. The body, which
   scrolls: the description, the people, the track and work chips. The foot,
   which never scrolls either: the overlap line and the actions. And what a
   star's tap or a pull's redraw writes into it in place - the star, the
   overlap line and Starred by - so the panel is drawn once, as it opens.
   Markup and what is written into it, found by id when asked: the panel's
   element is sheet.js's, which draws this into it as it opens, and the
   clicks inside it are dispatch's. It stands below both, and holds no DOM
   handle. */
import { esc, fmtRange, fmtShort } from "./util.js";
import { hasBackend } from "./backend.js";
import { goingTo } from "./crews.js";
import { state } from "./state.js";
import { DAY_LABEL, DAY_LONG, now } from "./time.js";
import { hotelVar, levelName, placeHTML } from "./venues.js";
import { byId, directWorks, factsOf, flagsOf, isCeleb, knownFor, sessionsOf, worksById } from "./data.js";
import { picks } from "./picks.js";
import { clashesOf } from "./walk.js";
import { CELEB_BADGE } from "./ui.js";
import { focusIn, refill, shownMatch } from "./scroll.js";

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

/* The other sessions (data.js sessionsOf()): "Also runs Fri 4:00 PM · Sun
   2:30 PM", each by its con day's label and its start, as a row with a day
   says it - so a session after midnight takes the night it belongs to - and
   those not yet started first, as the clock stood when the panel was drawn.
   Three are named, then how many more, in plain words. Each named session
   is a tap, to its own sheet in this one's place. No line with no other
   session. */
const SESSIONS_NAMED = 3;
function sessionsHTML(ev) {
  const sessions = sessionsOf(ev, now()), more = sessions.length - SESSIONS_NAMED;
  if (!sessions.length) return "";
  const said = e => `${DAY_LABEL[e._cd] || ""} ${fmtShort(e._s)}`.trim();
  return `<div class="ev-sessions"><span>Also runs</span> ${sessions.slice(0, SESSIONS_NAMED).map(e =>
    `<button class="ev-link" data-event="${esc(e.id)}" aria-label="Also runs ${said(e)}">${said(e)}</button>`)
    .join(` <span class="dot" aria-hidden="true">·</span> `)}${more > 0 ? ` <span>and ${more} more</span>` : ""}</div>`;
}

/* The people, under a small "With": each as this listing spells them, the
   name the tap to their Explore page, by id; a role other than Speaker or
   Panelist after it, in lower case. A person with a known-for line (#61) has
   a line of their own, the name and under it the line, and they come first,
   in the listing's order; everyone else shares one wrapping line after them,
   their names after commas, opening "and" where lined people stand above. */
function peopleHTML(ev) {
  const people = (ev.people || []).filter(p => p && p.name).map(p => ({
    id: p.id, name: p.name, line: knownFor(p.id),
    role: p.role && p.role !== "Speaker" && p.role !== "Panelist" ? p.role.toLowerCase() : "",
  }));
  if (!people.length) return "";
  const lined = people.filter(p => p.line), rest = people.filter(p => !p.line);
  const who = p => `<button class="who-name" data-explore="person:${esc(p.id)}">${esc(p.name)}</button>${p.role ? ` <span class="who-role">${esc(p.role)}</span>` : ""}`;
  return `<div class="ev-people"><div class="ev-label" id="sheetWith">With</div><ul class="who-list" aria-labelledby="sheetWith">${
    lined.map(p => `<li class="who lined">${who(p)} <div class="who-line">${esc(p.line)}</div></li>`).join("")}${
    rest.map((p, i) => `<li class="who">${!i && lined.length ? "and " : ""}${who(p)}${i < rest.length - 1 ? "," : ""}</li>`).join(" ")}</ul></div>`;
}

/* The overlap line (W1): every pick the event overlaps (walk.js
   clashesOf()), each a block that is one tap, to that pick's sheet in this
   one's place - "Overlaps <title>" and under it its time as a range, then
   "and <title>" - three at most, then how many more in plain words. On a
   pick it is a warning; on an event that is not one it says what a star
   would overlap, "Would overlap <title>", quietly: the reader deciding
   whether to star needs it before. A cancelled or removed event has none
   and counts in none. The line's element is always in the panel, empty with
   no overlap, and is a live region: what a star changes is written into it,
   so a screen reader hears it. */
const OVERLAPS_NAMED = 3;
function overlapHTML(ev) {
  const clash = clashesOf(ev), mine = picks.has(ev.id), more = clash.length - OVERLAPS_NAMED;
  const blocks = clash.slice(0, OVERLAPS_NAMED).map((p, i) =>
    `<button class="ev-clash" id="overlap-${esc(p.id)}" data-event="${esc(p.id)}"><span class="ov-line">${i ? "and" : mine ? "Overlaps" : "Would overlap"} <span class="ov-title">${esc(p.title)}</span></span> <span class="ov-when">${fmtRange(p._s, p._e)}</span></button>`);
  return `<div class="ev-overlap${mine && clash.length ? " is" : ""}" id="sheetOverlap" role="status">${blocks.join("")}${more > 0 ? `<div class="ov-more">and ${more} more</div>` : ""}</div>`;
}

/* The star. A removed event can be unstarred, never starred anew (#49). */
function starHTML(ev) {
  const mine = picks.has(ev.id);
  return `<button class="ev-star" id="sheetStar" aria-pressed="${mine}" aria-label="${mine ? "Remove from my schedule" : "Add to my schedule"}"${ev.removed && !mine ? " disabled" : ""}>${mine ? "★" : "☆"}</button>`;
}

function eventSheetHTML(ev) {
  const going = goingText(ev), level = levelName(ev), hue = `--h:var(${hotelVar(ev.hotel)})`;
  const dur = ev.duration_min ? (ev.duration_min >= 60 ? `${Math.floor(ev.duration_min / 60)} h${ev.duration_min % 60 ? ` ${ev.duration_min % 60} min` : ""}` : `${ev.duration_min} min`) : "";
  const chips = [...(ev.tracks || []), ...directWorks(ev).map(id => (worksById.get(id) || {}).name).filter(Boolean)];
  /* The facts, one line that may wrap: Celebrity; the row's flags, in the
     row's words and the row's order (data.js flagsOf()), Sold out alone in
     the warning colour; then what a row does not carry, the part and a
     game's format (factsOf()). The age is here, not a chip below. */
  const facts = [
    isCeleb(ev) ? CELEB_BADGE : "",
    ...flagsOf(ev).map(f => `<span class="flag${f.key === "sold_out" ? " warn" : ""}">${esc(f.label)}</span>`),
    ...factsOf(ev).map(f => `<span class="fact">${esc(f.label)}</span>`),
  ].join("");
  /* The calendar takes only what is on the schedule: Plans' export leaves a
     removed pick out, and so does this, the other door to the same calendar
     (DECISIONS #49). A cancelled event keeps its button, as it always had. */
  const ics = ev.removed ? "" : `<button class="btn quiet" id="sheetICS">Add this to calendar</button>`;
  return `<div class="ev-head">
      <h2 id="sheetTitleEvent" tabindex="-1">${esc(ev.title)}</h2>
      <div class="ev-when">${DAY_LONG[ev.day] || ev.day}, ${fmtShort(ev._s)} to ${fmtShort(ev._e)}${dur ? ` &middot; ${dur}` : ""}${ev._cd !== ev.day ? ` &middot; ${DAY_LONG[ev._cd] || ev._cd} night` : ""}</div>
      <div class="ev-room" style="${hue}">${placeHTML(ev)}</div>
      ${level ? `<div class="ev-level" style="${hue}">${esc(level)}</div>` : ""}
      ${ev.cancelled ? `<div><span class="cancelled-tag">Cancelled</span></div>` : ""}
      ${ev.removed ? `<div><span class="removed-tag">Removed from the schedule</span></div>` : ""}
      ${facts ? `<div class="ev-facts">${facts}</div>` : ""}
      ${sessionsHTML(ev)}
      <p class="ev-going" id="sheetGoing"${going ? "" : " hidden"}>${esc(going)}</p>
    </div>
    <div class="ev-body">
      ${ev.description ? `<p>${esc(ev.description)}</p>` : `<p style="color:var(--muted)">No description.</p>`}
      ${peopleHTML(ev)}
      ${chips.length ? `<div class="tagline">${chips.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
    </div>
    <div class="ev-foot">
      ${overlapHTML(ev)}
      <div class="ev-actions">
        ${starHTML(ev)}
        ${ics}
        <button class="btn" id="closeSheetEvent">Done</button>
      </div>
    </div>`;
}

/* shell.js render()'s, and the star's own tap (dispatch.js): what the open
   panel says of the picks and the crew, written where it stands -
   `state.sheetId` is one only while its panel is shown. Three parts, each
   into the node already there: Starred by, its words and whether it shows;
   the star; and the overlap line, "Would overlap" becoming "Overlaps" at
   the tap. The panel is never drawn again for any of them, so focus stays
   on the star, the body keeps its scroll, and the live region is heard
   (#66). A pull that changes the reader's own pick of the open event fills
   the same three, so its star is never stale. Focus on an overlapped pick
   that is still listed stays on it; on one that has gone, or on a star
   that can no longer be tapped, it goes to the heading. */
function refreshEventSheet() {
  const ev = state.sheetId ? byId.get(state.sheetId) : null, line = document.getElementById("sheetGoing");
  if (!ev || !line) return;
  const going = goingText(ev);
  if (line.textContent !== going) line.textContent = going;
  line.hidden = !going;
  const star = document.getElementById("sheetStar"), region = document.getElementById("sheetOverlap"), title = document.getElementById("sheetTitleEvent");
  const fresh = document.createElement("div"), back = focusIn(region);
  fresh.innerHTML = starHTML(ev) + overlapHTML(ev);
  refill(star, fresh.firstElementChild);
  refill(region, fresh.lastElementChild);
  if (star.disabled && document.activeElement === star) title.focus({preventScroll: true});
  if (back && !region.contains(document.activeElement)) (shownMatch(back) || title).focus({preventScroll: true});
}

export { eventSheetHTML, refreshEventSheet };
