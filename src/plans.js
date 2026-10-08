import { esc, fmtShort, minutesBetween } from "./util.js";
import { hasBackend } from "./backend.js";
import { crewmatePicks, myCrews, myMembership } from "./crews.js";
import { state } from "./state.js";
import { CON_DAYS, conDayKey, DAY_LABEL, DAY_LONG, FIRST_FULL_DAY, now } from "./time.js";
import { hotelVar, walkMin } from "./venues.js";
import { shareableDays } from "./shareday.js";
import { byId, happening } from "./data.js";
import { pickNewsHTML, picks } from "./picks.js";
import { gapHTML } from "./walk.js";
import { chipHTML, rowHTML } from "./ui.js";
import { inPlaceHTML } from "./inplace.js";

/* ---- Plans -------------------------------------------------------- */
/* Side-by-side columns for anything that overlaps in time. Events are
   grouped into clusters that genuinely collide, and each cluster is
   given only as many columns as it actually needs. */
const HOUR_PX = 60;
function layoutColumns(list) {
  const sorted = [...list].sort((a, b) => a._s - b._s || a._e - b._e);
  const out = [];
  let cluster = [], clusterEnd = null;
  const flush = () => {
    if (!cluster.length) return;
    const colEnds = [];
    cluster.forEach(it => {
      let c = colEnds.findIndex(end => end <= it.ev._s.getTime());
      if (c === -1) { c = colEnds.length; colEnds.push(0); }
      colEnds[c] = it.ev._e.getTime();
      it.col = c;
    });
    cluster.forEach(it => it.cols = colEnds.length);
    out.push(...cluster);
    cluster = []; clusterEnd = null;
  };
  sorted.forEach(ev => {
    if (clusterEnd !== null && ev._s.getTime() >= clusterEnd) flush();
    cluster.push({ev, col: 0, cols: 1});
    clusterEnd = clusterEnd === null ? ev._e.getTime() : Math.max(clusterEnd, ev._e.getTime());
  });
  flush();
  return out;
}

function timelineDayHTML(dayKey, list, now) {
  const items = layoutColumns(list);
  const sorted = items.map(i => i.ev).sort((a, b) => a._s - b._s);
  const startMs = Math.min(...sorted.map(e => e._s.getTime()));
  const endMs = Math.max(...sorted.map(e => e._e.getTime()));
  const origin = new Date(startMs); origin.setMinutes(0, 0, 0);
  const last = new Date(endMs);
  if (last.getMinutes() || last.getSeconds()) { last.setMinutes(0, 0, 0); last.setHours(last.getHours() + 1); }
  const spanH = Math.max(1, Math.round((last - origin) / 3600000));
  const top = t => ((t - origin) / 60000) * (HOUR_PX / 60);

  let hours = "";
  for (let h = 0; h <= spanH; h++) {
    const at = new Date(origin.getTime() + h * 3600000);
    hours += `<div class="tl-hour" style="top:${h * HOUR_PX}px"><span>${fmtShort(at)}</span></div>`;
  }

  /* A removed pick keeps its place in time, marked, and says so where its
     room would be; a cancelled one too, drawn the same (DECISIONS #90). */
  const blocks = items.map(({ev, col, cols}) => {
    const h = Math.max(24, top(ev._e.getTime()) - top(ev._s.getTime()) - 2);
    const w = 100 / cols;
    const long = h >= 150;
    const off = ev.removed ? "removed" : ev.cancelled ? "cancelled" : "";
    return `<button class="tl-block${long ? " long" : ""}${off ? ` ${off}` : ""}" data-hero="${esc(ev.id)}" style="top:${top(ev._s.getTime()).toFixed(1)}px;height:${h.toFixed(1)}px;left:${(col * w).toFixed(2)}%;width:calc(${w.toFixed(2)}% - 3px);--h:var(${hotelVar(ev.hotel)})">
      <span class="tb-title">${esc(ev.title)}</span>
      <span class="tb-room">${ev.removed ? "Removed from the schedule" : ev.cancelled ? "Cancelled" : esc(ev.room || ev.location || "")}</span>
      ${long ? `<span class="tb-runs">runs to ${fmtShort(ev._e)}</span>` : ""}
    </button>`;
  }).join("");

  /* A removed or a cancelled pick is not happening: no walk runs to it or
     from it. */
  const live = sorted.filter(happening);
  let links = "";
  for (let i = 1; i < live.length; i++) {
    const prev = live[i - 1], next = live[i];
    /* A stream is not walked to or from: no walk, no band, no link - the
       rule the hero and the gap line keep (DECISIONS #40). */
    const walk = walkMin(prev.hotel, next.hotel);
    if (prev.hotel === next.hotel || !walk) continue;
    const gap = minutesBetween(prev._e, next._s);
    const y1 = top(prev._e.getTime()), y2 = top(next._s.getTime());
    const height = Math.max(18, y2 - y1);
    links += `<div class="tl-link${gap < walk ? " tight" : ""}" style="top:${Math.min(y1, y2).toFixed(1)}px;height:${height.toFixed(1)}px">
      <span>${walk} min</span></div>`;
  }

  const nowLine = conDayKey(now) === dayKey && now >= origin && now <= last
    ? `<div class="tl-now" style="top:${top(now.getTime()).toFixed(1)}px"></div>` : "";

  return `<div class="tl-day">
    <div class="day-head" style="padding-left:0">${DAY_LONG[dayKey] || dayKey} <span class="count">${list.length}</span></div>
    <div class="tl-grid" style="height:${spanH * HOUR_PX + 12}px">${hours}${links}${blocks}${nowLine}</div>
  </div>`;
}

function renderPlansTimeline(mine, now) {
  const days = new Map();
  mine.forEach(ev => {
    const k = conDayKey(ev._s);
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(ev);
  });
  return [...days.keys()].sort().map(k => timelineDayHTML(k, days.get(k), now)).join("");
}

/* ---- The crew (DECISIONS #62) -------------------------------------- */
/* The crew Plans shows: the one chosen in the picker while it is still
   kept, else the oldest; null out of a crew. The crew panel's manage view
   opens on it (sheet.js). */
function chosenCrew(crews = myCrews()) {
  return crews.find(c => c.id === state.plans.crew) || crews[0] || null;
}
/* My day or the crew's: the one last tapped, and with none, the crew's on a
   con day for a reader in a crew. Out of a crew, My day, whatever was
   tapped. */
function plansView(crews) {
  if (!crews.length) return "mine";
  if (state.plansView === "mine" || state.plansView === "crew") return state.plansView;
  return CON_DAYS.includes(conDayKey(now())) ? "crew" : "mine";
}
/* The crew's day: the chip tapped, else today on a con day and the first
   full day otherwise - map.js mapDay()'s rule, with Plans' own chips. */
function plansDay() {
  if (state.plans.day) return state.plans.day;
  const d = conDayKey(now());
  return CON_DAYS.includes(d) ? d : FIRST_FULL_DAY;
}
const people = n => `${n} ${n === 1 ? "person" : "people"}`;
/* A crew's members as its screens list them, the pull reading them in no
   order: the reader first, then the rest by the names this crew gives
   them, then by id - the crew's day here, the member list in the crew
   panel. */
function crewPeople(crew) {
  const me = myMembership(crew);
  const others = (crew.members || []).filter(m => !me || m.user_id !== me.user_id)
    .sort((a, b) => String(a.display_name).localeCompare(String(b.display_name)) || (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0));
  return me ? [me, ...others] : others;
}

/* The top of Plans on a build with a backend: in a crew, its name - a
   picker of them, the oldest first, in more than one - how many, and
   Manage, which opens the crew panel; in none, the ladder's rung, shown and
   not nagged (VISION). Every name is someone's own text, so escaped. */
function crewHeadHTML(crews) {
  if (!crews.length) return `<div class="crew-head crew-rung">
    <p>Start a crew, or paste an invite link.</p>
    <div class="crew-rung-btns"><button class="btn quiet" id="crewStartBtn" data-act="crew-create">Start a crew</button><button class="btn quiet" id="crewJoinBtn" data-act="crew-join">Join with a link</button></div>
  </div>`;
  const crew = chosenCrew(crews);
  const name = crews.length > 1
    ? `<select class="crew-pick" id="crewPick" aria-label="Crew">${crews.map(c => `<option value="${esc(c.id)}"${c === crew ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>`
    : `<span class="crew-title">${esc(crew.name)}</span>`;
  return `<div class="crew-head">${name}<span class="crew-count">${people((crew.members || []).length)}</span>
    <button class="btn quiet" id="crewManageBtn" data-act="crew-manage" aria-label="Manage ${esc(crew.name)}">Manage</button></div>`;
}
function plansSegHTML(view) {
  return `<div class="seg plans-seg" role="group" aria-label="Plans view"><button id="plansViewMine" data-act="plans-mine" aria-pressed="${view === "mine"}">My day</button><button id="plansViewCrew" data-act="plans-crew" aria-pressed="${view === "crew"}">Crew</button></div>`;
}
/* The crew's day: one day's chips, then per person, not lanes (#62) - the
   reader first, the rest by the names this crew gives them - each one's
   picks that day in start order, as compact rows whose star is the
   reader's own. A removed pick is marked, as in My day (#49); a pick this
   copy of the schedule does not hold is left out. */
function crewDayHTML(crew) {
  const day = plansDay(), me = myMembership(crew);
  const chips = CON_DAYS.map(d => chipHTML(DAY_LABEL[d], d === day, "plans-day", d)).join("");
  const blocks = crewPeople(crew).map(m => {
    const own = !!me && m.user_id === me.user_id, starred = own ? picks : new Set(crewmatePicks(m.user_id));
    const rows = [...byId.values()].filter(e => starred.has(e.id) && e._cd === day);
    return `<section class="crew-person" data-user="${esc(m.user_id)}">
      <h3 class="crew-who">${esc(m.display_name)}${own ? " (you)" : ""}${rows.length ? ` <span class="count">${rows.length}</span>` : ""}</h3>
      ${rows.length ? `<ul class="list compact">${rows.map(ev => rowHTML(ev, {list: `crew:${m.user_id}`})).join("")}</ul>`
        : `<p class="crew-none">No picks on ${DAY_LONG[day] || day}.</p>`}
    </section>`;
  }).join("");
  return `<div class="controls"><div class="chips plans-days" data-row="plans-day">${chips}</div></div>${blocks}`;
}

/* Plans: on a build with a backend the crew header, and in a crew the
   My day | Crew segment under it (#62); then My day or the crew's day. With
   no backend it is Mine as built: the 2026 app knows no crews. */
function renderPlans() {
  const crews = hasBackend ? myCrews() : [];
  const view = plansView(crews);
  let html = hasBackend ? crewHeadHTML(crews) : "";
  if (crews.length) html += plansSegHTML(view);
  html += view === "crew" ? crewDayHTML(chosenCrew(crews)) : myDayHTML();
  /* A control of Plans' own that had focus - the picker, the segment,
     Manage - gets it back by its id: every redraw replaces them, a tap's
     own and a pull's alike (#66). */
  const el = document.getElementById("view-plans"), active = document.activeElement;
  const had = active && el.contains(active) && active.id;
  el.innerHTML = html;
  const again = had && document.getElementById(had);
  if (again) again.focus({preventScroll: true});
  fitTimelineBlocks();
}

/* My day, Mine as built: every pick, the removed among them - byId holds
   every event in start order. A pick on an event the source dropped stays
   in the plan until the reader takes it out, marked, and is on no other tab
   (DECISIONS #49). A cancelled pick stays the same way, marked (#90). The
   calendar export takes the picks that are happening, neither removed nor
   cancelled, and under the picks-changed notice stands what is on in place
   of a pick that changed (inplace.js). The strip is Export and Share a day:
   Remove all picks is Settings' alone (DECISIONS #92). */
function myDayHTML() {
  const mine = [...byId.values()].filter(e => picks.has(e.id));
  const onSchedule = mine.filter(happening).length;
  /* Share a day (W25), beside Export: a day of picks as a link that needs no
     backend, so on every build, and only while a pick is neither removed nor
     cancelled - the panel's chips are the days that hold one. */
  const shareable = shareableDays(mine, picks).length;
  let html = pickNewsHTML() + inPlaceHTML("plans") + `<div class="plans-actions">
    <button class="btn quiet" data-act="ics" ${onSchedule ? "" : "disabled"}>Export to calendar</button>
    <button class="btn quiet" data-act="share-day" ${shareable ? "" : "disabled"}>Share a day</button>
  </div>`;
  if (mine.length) html += `<div class="seg plans-seg plans-view" role="group" aria-label="View">
    <button data-act="view-timeline" aria-pressed="${state.mineView === "timeline"}">Timeline</button><button data-act="view-list" aria-pressed="${state.mineView === "list"}">List</button>
  </div>`;
  if (!mine.length) {
    html += `<div class="empty"><b>Nothing picked yet.</b> Star things in Explore or Search. They'll line up here by day with warnings when two picks overlap or the walk between hotels is too tight.</div>`;
  } else if (state.mineView === "timeline") {
    html += renderPlansTimeline(mine, now());
  } else {
    html += `<ul class="list">`;
    let lastDay = "", prev = null;
    mine.forEach(ev => {
      if (ev._cd !== lastDay) { html += `<li class="day-head">${DAY_LONG[ev._cd] || ev._cd} <span class="count">${mine.filter(x => x._cd === ev._cd).length}</span></li>`; lastDay = ev._cd; prev = null; }
      /* A removed or a cancelled pick has no gap line on either side: the
         next one's is measured from the pick before it. */
      if (!happening(ev)) { html += rowHTML(ev, {list: "mine"}); return; }
      html += gapHTML(prev, ev) + rowHTML(ev, {list: "mine"});
      prev = ev;
    });
    html += `</ul>`;
  }
  return html;
}

/* Measured, so it only acts where it has to; jsdom reports no heights and
   leaves every block alone. */
function fitTimelineBlocks() {
  document.querySelectorAll("#view-plans .tl-block").forEach(b => {
    b.classList.remove("tight", "tighter");
    if (b.scrollHeight > b.clientHeight + 1) b.classList.add("tight");
    if (b.scrollHeight > b.clientHeight + 1) b.classList.add("tighter");
  });
}

export { HOUR_PX, layoutColumns, chosenCrew, crewPeople, renderPlans };
