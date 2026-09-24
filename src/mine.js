import { esc, fmtShort, minutesBetween } from "./util.js";
import { state } from "./state.js";
import { conDayKey, DAY_LONG, now } from "./time.js";
import { hotelVar, walkMin } from "./venues.js";
import { byId } from "./data.js";
import { pickNewsHTML, picks } from "./picks.js";
import { gapHTML } from "./leave.js";
import { rowHTML } from "./ui.js";

/* ---- Mine --------------------------------------------------------- */
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
     room would be. */
  const blocks = items.map(({ev, col, cols}) => {
    const h = Math.max(24, top(ev._e.getTime()) - top(ev._s.getTime()) - 2);
    const w = 100 / cols;
    const long = h >= 150;
    return `<button class="tl-block${long ? " long" : ""}${ev.removed ? " removed" : ""}" data-hero="${esc(ev.id)}" style="top:${top(ev._s.getTime()).toFixed(1)}px;height:${h.toFixed(1)}px;left:${(col * w).toFixed(2)}%;width:calc(${w.toFixed(2)}% - 3px);--h:var(${hotelVar(ev.hotel)})">
      <span class="tb-title">${esc(ev.title)}</span>
      <span class="tb-room">${ev.removed ? "Removed from the schedule" : esc(ev.room || ev.location || "")}</span>
      ${long ? `<span class="tb-runs">runs to ${fmtShort(ev._e)}</span>` : ""}
    </button>`;
  }).join("");

  /* A removed pick is not happening: no walk runs to it or from it. */
  const live = sorted.filter(e => !e.removed);
  let links = "";
  for (let i = 1; i < live.length; i++) {
    const prev = live[i - 1], next = live[i];
    if (prev.hotel === next.hotel) continue;
    const walk = walkMin(prev.hotel, next.hotel);
    const gap = minutesBetween(prev._e, next._s);
    const y1 = top(prev._e.getTime()), y2 = top(next._s.getTime());
    const height = Math.max(18, y2 - y1);
    links += `<div class="tl-link${gap < walk ? " tight" : ""}" style="top:${Math.min(y1, y2).toFixed(1)}px;height:${height.toFixed(1)}px">
      <span>${walk} min</span></div>`;
  }

  const nowLine = conDayKey(now) === dayKey && now >= origin && now <= last
    ? `<div class="tl-now" style="top:${top(now.getTime()).toFixed(1)}px"></div>` : "";

  return `<div class="tl-day">
    <div class="day-head" style="padding-left:0">${DAY_LONG[dayKey] || dayKey} <span class="count" style="font-size:.875rem;color:var(--dim);font-weight:400">${list.length}</span></div>
    <div class="tl-grid" style="height:${spanH * HOUR_PX + 12}px">${hours}${links}${blocks}${nowLine}</div>
  </div>`;
}

function renderMineTimeline(mine, now) {
  const days = new Map();
  mine.forEach(ev => {
    const k = conDayKey(ev._s);
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(ev);
  });
  return [...days.keys()].sort().map(k => timelineDayHTML(k, days.get(k), now)).join("");
}

/* Every pick, the removed among them: byId holds every event in start order.
   A pick on an event the source dropped stays in the plan until the reader
   takes it out, marked, and is on no other tab (DECISIONS #49). The calendar
   export takes the picks still on the schedule. */
function renderMine() {
  const mine = [...byId.values()].filter(e => picks.has(e.id));
  const onSchedule = mine.filter(e => !e.removed).length;
  let html = pickNewsHTML() + `<div class="mine-actions">
    <button class="btn" data-act="ics" ${onSchedule ? "" : "disabled"}>Export to calendar</button>
    <button class="btn quiet" data-act="clear" ${mine.length ? "" : "disabled"}>Remove all</button>
  </div>`;
  if (mine.length) html += `<div class="view-toggle" role="group" aria-label="View">
    <button data-act="view-timeline" aria-pressed="${state.mineView === "timeline"}">Timeline</button>
    <button data-act="view-list" aria-pressed="${state.mineView === "list"}">List</button>
  </div>`;
  if (!mine.length) {
    html += `<div class="empty"><b>Nothing picked yet.</b> Star things in Search. They'll line up here by day with warnings when two picks overlap or the walk between hotels is too tight.</div>`;
  } else if (state.mineView === "timeline") {
    html += renderMineTimeline(mine, now());
  } else {
    html += `<ul class="list">`;
    let lastDay = "", prev = null;
    mine.forEach(ev => {
      if (ev._cd !== lastDay) { html += `<li class="day-head">${DAY_LONG[ev._cd] || ev._cd} <span class="count" style="font-size:.875rem;color:var(--dim);font-weight:400">${mine.filter(x => x._cd === ev._cd).length}</span></li>`; lastDay = ev._cd; prev = null; }
      /* A removed pick has no gap line on either side: the next one's is
         measured from the pick before it. */
      if (ev.removed) { html += rowHTML(ev, {list: "mine"}); return; }
      html += gapHTML(prev, ev) + rowHTML(ev, {list: "mine"});
      prev = ev;
    });
    html += `</ul>`;
  }
  document.getElementById("view-mine").innerHTML = html;
  fitTimelineBlocks();
}

/* Measured, so it only acts where it has to; jsdom reports no heights and
   leaves every block alone. */
function fitTimelineBlocks() {
  document.querySelectorAll("#view-mine .tl-block").forEach(b => {
    b.classList.remove("tight", "tighter");
    if (b.scrollHeight > b.clientHeight + 1) b.classList.add("tight");
    if (b.scrollHeight > b.clientHeight + 1) b.classList.add("tighter");
  });
}

export { HOUR_PX, layoutColumns, renderMine };
