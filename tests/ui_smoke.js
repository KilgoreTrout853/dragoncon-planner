// Headless smoke test for index.html using jsdom. Run: node tests/ui_smoke.js
const { JSDOM } = require("jsdom");
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/../index.html", "utf8")
  .replace("<script>", "<script>window.DC_EVENTS=" + fs.readFileSync(__dirname + "/sample-events.json", "utf8") + ";");
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://example.test/#now=2026-09-05T13:05", pretendToBeVisual: true });
const { window } = dom; const { document } = window;
window.confirm = () => true;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const text = id => document.getElementById(id).textContent.replace(/\s+/g, " ").trim();
function assert(c, m) { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  ", m); }
(async () => {
  await sleep(50);
  assert(text("clock").startsWith("Sat 1:05 PM"), "clock shows preview time: " + text("clock"));
  assert(/\d+ events, refreshed/.test(text("fresh")), "freshness line: " + text("fresh"));
  const now = document.getElementById("view-now");
  assert(now.textContent.includes("Nothing picked"), "empty picks state on Now");
  const onNowRows = now.querySelectorAll(".row").length;
  assert(onNowRows > 0, `Now shows events around 1 PM (${onNowRows} rows)`);
  assert(now.querySelector(".time-head").textContent === "On now", "first group is 'On now'");
  // star two events that are back to back in different hotels
  const rows = [...now.querySelectorAll(".row")];
  rows[0].querySelector(".star").click(); await sleep(10);
  assert(document.getElementById("mineBadge").textContent === "1", "badge counts 1 pick");
  assert(JSON.parse(window.localStorage.getItem("dc26.picks")).length === 1, "pick persisted to localStorage");
  // step 1: tapping a row opens the event panel of the bottom sheet
  const firstTitle = rows[0].querySelector(".title").textContent.trim();
  document.querySelector("#view-now .row-main").click(); await sleep(10);
  const wrap = document.getElementById("sheetWrap");
  assert(!wrap.hidden, "row tap opens the sheet");
  assert(!document.getElementById("panel-event").hidden, "event panel is shown");
  assert(document.getElementById("panel-settings").hidden, "settings panel is hidden");
  assert(document.getElementById("sheetTitleEvent").textContent.trim() === firstTitle, "sheet shows the tapped event's title");
  assert(document.getElementById("sheet").getAttribute("aria-labelledby") === "sheetTitleEvent", "dialog is labelled by the event title");
  assert(document.querySelector("#panel-event .ev-room"), "sheet shows the room");
  assert(/var\(--h-/.test(document.querySelector("#panel-event .ev-room").getAttribute("style") || ""), "room is set in the hotel's hue");
  assert(document.querySelector("#panel-event .ev-when").textContent.trim().length > 0, "sheet shows day/time/duration");
  // star toggle inside the sheet, on an event already picked
  const star = document.getElementById("sheetStar");
  assert(star.getAttribute("aria-pressed") === "true", "sheet star reflects an existing pick");
  star.click(); await sleep(10);
  assert(document.getElementById("sheetStar").getAttribute("aria-pressed") === "false", "sheet star unstars");
  assert(JSON.parse(window.localStorage.getItem("dc26.picks")).length === 0, "unstar persisted");
  document.getElementById("sheetStar").click(); await sleep(10);
  assert(JSON.parse(window.localStorage.getItem("dc26.picks")).length === 1, "restar persisted");
  // single-event .ics from the sheet
  let oneText = null;
  window.URL.createObjectURL = b => { b.text().then(t => oneText = t); return "blob:x"; };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {};
  document.getElementById("sheetICS").click(); await sleep(50);
  assert(oneText && (oneText.match(/BEGIN:VEVENT/g) || []).length === 1, "sheet exports exactly one VEVENT");
  assert(oneText && /DTSTART;TZID=America\/New_York:2026090[0-9]T\d{6}/.test(oneText), "single-event ICS carries the Eastern timezone");
  assert(oneText && oneText.includes(firstTitle.slice(0, 20)), "single-event ICS is the event from the sheet");
  // close via backdrop
  document.getElementById("sheetBack").click(); await sleep(10);
  assert(document.getElementById("sheetWrap").hidden, "backdrop tap closes the sheet");
  assert(!document.querySelector(".detail"), "inline row expansion is gone");
  // browse: search
  document.querySelector('.nav button[data-tab="browse"]').click(); await sleep(10);
  const q = document.getElementById("q"); q.value = "boroughs"; q.dispatchEvent(new window.Event("input", { bubbles: true })); await sleep(10);
  let results = window.eval("browseResults()");
  assert(results.length > 0 && results.length < 100 && results.every(e => /boroughs/i.test(e.title + " " + e.description)), `search filters to matches (${results.length})`);
  // all days chip
  document.querySelector('#view-browse [data-chip="day"][data-value="All"]').click(); await sleep(10);
  assert(document.querySelectorAll("#view-browse .t .day").length > 1, "All days + query shows per-row day labels");
  // hotel chip
  const q2 = document.getElementById("q"); q2.value = ""; q2.dispatchEvent(new window.Event("input", { bubbles: true })); await sleep(10);
  assert(window.eval("state.browse.q") === "", "search cleared");
  document.querySelector('#view-browse [data-chip="hotel"][data-value="Westin"]').click(); await sleep(10);
  assert([...document.querySelectorAll("#view-browse .room")].every(r => !/Marriott|Hilton|Hyatt/.test(r.textContent)), "hotel filter applies");
  // noise toggle: Epic Photos hidden by default
  document.querySelector('#view-browse [data-chip="hotel"][data-value="All"]').click(); await sleep(10);
  assert(![...document.querySelectorAll("#view-browse .track")].some(t => t.textContent === "Epic Photos"), "photo sessions hidden by default");
  const before = window.eval("browseResults().length");
  document.getElementById("hideNoise").click(); await sleep(10);
  const after = window.eval("browseResults().length");
  assert(after > before && window.eval("browseResults().some(e => e.track === 'Epic Photos')"), `photo sessions appear when toggle off (${before} -> ${after})`);
  // star a second event that starts right after the first pick in another hotel, then check Mine warnings
  const first = window.eval("events.find(e => picks.has(e.id))");
  const tight = window.eval(`events.find(e => e.day === "${first.day}" && e.hotel !== "${first.hotel}" && e.hotel !== "Streaming" && Math.abs(e._s - new Date("${first.end}")) <= 5*60000)`);
  if (tight) { window.eval(`togglePick("${tight.id}")`); }
  document.querySelector('.nav button[data-tab="mine"]').click(); await sleep(10);
  const mine = document.getElementById("view-mine");
  assert(mine.querySelectorAll(".row").length === (tight ? 2 : 1), "Mine lists picks");
  if (tight) assert(mine.querySelector(".gap"), "walk warning shown for tight transfer: " + (mine.querySelector(".gap") || {}).textContent);
  // ics export
  let blobText = null;
  window.URL.createObjectURL = b => { b.text().then(t => blobText = t); return "blob:x"; };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {};
  mine.querySelector('[data-act="ics"]').click(); await sleep(50);
  assert(blobText && blobText.includes("BEGIN:VEVENT") && blobText.includes("TZID=America/New_York") && /DTSTART;TZID=America\/New_York:2026090[0-9]T\d{6}/.test(blobText), "ICS export has events with TZ");
  // clear all
  mine.querySelector('[data-act="clear"]').click(); await sleep(10);
  assert(document.getElementById("view-mine").textContent.includes("Nothing picked yet"), "clear all works");
  // search quality: the four real queries
  document.querySelector('.nav button[data-tab="browse"]').click(); await sleep(10);
  const top = async (query) => { const q = document.getElementById("q"); q.value = query; q.dispatchEvent(new window.Event("input", { bubbles: true })); await sleep(10); return window.eval("browseResults().slice(0,3).map(e => e.title)"); };
  let r = await top("Video game costume contest"); assert(/Video Game Cosplay Contest/.test(r[0]), "ranking: 'Video game costume contest' -> " + r[0]);
  assert(window.eval("state.browse.day") === "All", "typing widens to all days");
  r = await top("nerdy space stuff"); assert(/NASA/.test(r[0]), "synonyms+stopwords: 'nerdy space stuff' -> " + r[0]);
  r = await top("Symphony show"); assert(/Philharmonic/.test(r[0]), "vocabulary: 'Symphony show' -> " + r[0]);
  r = await top("Rick and Morty"); assert(/Rick & Morty/.test(r[0]), "'&' vs 'and': 'Rick and Morty' -> " + r[0]);
  r = await top("philharmonc"); assert(/Philharmonic/.test(r[0]), "typo tolerance: 'philharmonc' -> " + r[0]);
  assert(document.querySelector("#view-browse mark"), "matches are highlighted");
  assert(document.querySelector("#view-browse .t .day"), "day label shown in relevance mode");
  // facets from tags
  assert(document.getElementById("fandom") && document.querySelector('[data-chip="kind"]'), "fandom select and kind chips render when tags exist");
  await top(""); assert(window.eval("state.browse.day") !== "All", "clearing the query restores the day");
  document.querySelector('#view-browse [data-chip="day"][data-value="All"]').click(); await sleep(10);
  const beforeAdult = window.eval("browseResults().length");
  document.getElementById("hideAdult").click(); await sleep(10);
  assert(window.eval("browseResults().length") === beforeAdult - 1 && !window.eval("browseResults().some(e => e.tags && e.tags.adult)"), "hide 18+ works");
  document.querySelector('#view-browse [data-chip="kind"][data-value="contest"]').click(); await sleep(10);
  assert(window.eval("browseResults().every(e => e.tags.kind === 'contest')"), "kind chip filters");
  // settings sheet
  document.getElementById("settingsBtn").click(); await sleep(10);
  assert(!document.getElementById("sheetWrap").hidden, "settings opens");
  assert(!document.getElementById("panel-settings").hidden && document.getElementById("panel-event").hidden, "settings panel shown, event panel hidden");
  document.getElementById("closeSheet").click(); await sleep(10);
  assert(document.getElementById("sheetWrap").hidden, "settings closes");
  const errs = window.__errors || [];
  console.log(process.exitCode ? "SOME FAILURES" : "ALL PASSED"); window.close(); process.exit(process.exitCode || 0);
})();
window.addEventListener("error", e => { console.error("JS ERROR:", e.message); process.exitCode = 1; });
