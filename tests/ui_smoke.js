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

  // ---- step 2: hero card, leave-by, ring, no 6-pick cap ----
  const hero = document.querySelector("#view-now .hero");
  assert(hero, "hero card renders for the next pick");
  assert(hero.querySelector(".ring svg circle.prog"), "hero has an SVG countdown ring");
  const prog = hero.querySelector(".ring circle.prog");
  const dash = parseFloat(prog.getAttribute("stroke-dasharray")), off = parseFloat(prog.getAttribute("stroke-dashoffset"));
  assert(dash > 0 && off >= 0 && off <= dash + 0.5, `ring dashoffset within its circumference (${off.toFixed(0)}/${dash.toFixed(0)})`);
  assert(/On now|Your next/.test(hero.querySelector(".hkicker").textContent), "hero kicker reads On now or Your next");
  assert(/var\(--h-/.test(hero.querySelector(".hroom").getAttribute("style") || ""), "hero room uses the hotel hue");
  assert(window.eval("LEAVE_BUFFER_MIN") === 10, "LEAVE_BUFFER_MIN is 10");
  // leave-by maths: from a known hotel to the next pick
  const lb = window.eval(`(function(){
    var n = getNow();
    var nxt = events.filter(e => picks.has(e.id) && e._s > n)[0] || events.filter(e => e._s > n)[0];
    var info = leaveInfo("Marriott", nxt, n);
    return {walk: info.walk, gap: Math.round((nxt._s - info.leaveBy)/60000), hotel: nxt.hotel};
  })()`);
  assert(lb.gap === lb.walk + 10, `leave-by = start - walk - buffer (${lb.gap} = ${lb.walk} + 10)`);
  // location resolution: falls back to home base when nothing is on now
  const loc = window.eval(`(function(){
    var before = settings.homeBase; settings.homeBase = "Hyatt";
    var saved = [...picks]; picks = new Set();
    var r = currentLocation(getNow());
    picks = new Set(saved); settings.homeBase = before; return r;
  })()`);
  assert(loc === "Hyatt", "currentLocation falls back to home base");
  const noLoc = window.eval(`(function(){
    var before = settings.homeBase; settings.homeBase = "";
    var saved = [...picks]; picks = new Set();
    var r = currentLocation(getNow());
    picks = new Set(saved); settings.homeBase = before; return r;
  })()`);
  assert(noLoc === null, "currentLocation is null with no picks and no home base");
  // no 6-pick cap: star 8 upcoming picks and count rendered rows + hero
  window.eval(`(function(){
    var n = getNow();
    events.filter(e => e._e > n).slice(0, 9).forEach(e => picks.add(e.id));
    savePicks(); render();
  })()`); await sleep(20);
  const planned = window.eval("events.filter(e => picks.has(e.id) && e._e > getNow()).length");
  const shownRows = document.querySelectorAll("#view-now .list.compact .row[data-list='next']").length;
  assert(planned > 6, `more than six picks in play (${planned})`);
  assert(shownRows + 1 >= planned, `all picks render, no 6-cap (hero + ${shownRows} rows for ${planned} picks)`);
  assert(document.querySelector("#view-now .list.compact"), "remaining picks render as a compact list");
  // tapping the hero opens the step-1 sheet
  document.querySelector("#view-now .hero").click(); await sleep(20);
  assert(!document.getElementById("sheetWrap").hidden && !document.getElementById("panel-event").hidden, "tapping the hero opens the event sheet");
  document.getElementById("sheetBack").click(); await sleep(10);
  // reset to a single pick so later assertions keep their shape
  window.eval(`(function(){ var keep = events.filter(e => e._e > getNow())[0].id; picks = new Set([keep]); savePicks(); render(); })()`); await sleep(20);
  assert(JSON.parse(window.localStorage.getItem("dc26.picks")).length === 1, "reset to one pick for later steps");

  // ---- step 3: sticky next-up mini-bar ----
  const bar = document.getElementById("minibar");
  assert(bar, "mini-bar element exists");
  assert(bar.hidden, "mini-bar is hidden on the Now tab");
  // give ourselves a pick later in the same con day, then leave Now
  const hasLater = window.eval(`(function(){
    var n = getNow(), key = conDayKey(n);
    var later = events.find(e => e._s > n && conDayKey(e._s) === key && e.hotel !== "Streaming");
    if (later) { picks.add(later.id); savePicks(); render(); return later.title; }
    return null;
  })()`); await sleep(20);
  assert(hasLater, "found a pick later in the same con day");
  document.querySelector('.nav button[data-tab="browse"]').click(); await sleep(20);
  assert(!bar.hidden, "mini-bar shows on Browse when a pick remains today");
  assert(bar.querySelector(".mb-title").textContent.trim() === hasLater, "mini-bar names the next pick");
  assert(/var\(--h-/.test(bar.querySelector(".mb-room").getAttribute("style") || ""), "mini-bar room uses the hotel hue");
  assert(/leave (by|now)|in \d+ min/.test(bar.querySelector(".mb-when").textContent), "mini-bar shows a countdown or leave-by: " + bar.querySelector(".mb-when").textContent);
  assert(window.getComputedStyle(bar).height === "48px", "mini-bar is 48px tall");
  assert(document.body.classList.contains("has-minibar"), "body reserves room for the bar");
  // tapping it returns to Now
  bar.click(); await sleep(20);
  assert(window.eval("state.tab") === "now", "tapping the mini-bar switches to Now");
  assert(bar.hidden, "mini-bar hides again once Now is active");
  // con-day boundary: 1am Sunday still belongs to Saturday
  const conDay = window.eval(`[conDayKey(new Date("2026-09-06T01:00")), conDayKey(new Date("2026-09-05T23:00")), conDayKey(new Date("2026-09-06T06:00"))]`);
  assert(conDay[0] === "2026-09-05", "1am Sunday counts as Saturday's con day");
  assert(conDay[1] === "2026-09-05", "11pm Saturday counts as Saturday");
  assert(conDay[2] === "2026-09-06", "6am Sunday counts as Sunday");
  // with no picks left today the bar stays hidden off Now
  window.eval(`(function(){ picks = new Set(); savePicks(); render(); })()`); await sleep(10);
  document.querySelector('.nav button[data-tab="browse"]').click(); await sleep(20);
  assert(bar.hidden, "mini-bar stays hidden with no picks left today");
  window.eval(`(function(){ var keep = events.filter(e => e._e > getNow())[0].id; picks = new Set([keep]); savePicks(); render(); })()`); await sleep(20);
  document.querySelector('.nav button[data-tab="now"]').click(); await sleep(10);

  // ---- step 4: venue map + manual location override ----
  const hmap = document.querySelector("#view-now .hero-map .venue-map");
  assert(hmap, "hero card carries a venue map");
  const blocks = [...hmap.querySelectorAll("[data-map]")].map(g => g.dataset.map);
  assert(blocks.length === 6, `map has six blocks (${blocks.length})`);
  ["Marriott","Hyatt","Hilton","AmericasMart","Westin","Courtland Grand"].forEach(h =>
    assert(blocks.includes(h), `map includes ${h}`));
  assert([...hmap.querySelectorAll("[data-map]")].every(g => /var\(--h-/.test(g.getAttribute("style") || "")), "each block is filled with its hotel var");
  // rough arrangement: Mart upper-left of Hyatt; Westin lower-left; Courtland lower-right of Hilton
  const geo = window.eval("MAP_BLOCKS.reduce((m,b)=>(m[b.hotel]=b,m),{})");
  assert(geo.AmericasMart.x < geo.Hyatt.x && geo.AmericasMart.y === geo.Hyatt.y, "Mart sits upper-left beside the Hyatt");
  assert(geo.Westin.x < geo.Hilton.x && geo.Westin.y > geo.Marriott.y, "Westin sits lower-left");
  assert(geo["Courtland Grand"].x > geo.Hilton.x && geo["Courtland Grand"].y >= geo.Hilton.y, "Courtland sits lower-right past the Hilton");
  assert(geo.Hyatt.y < geo.Marriott.y && geo.Marriott.y < geo.Hilton.y, "Marriott/Hyatt/Hilton form the central column");
  // override: tapping a block on the hero map sets it, with a timestamp
  window.eval(`saveJSON("dc26.override", null)`);
  document.querySelector('#view-now .hero-map [data-map="Westin"]').dispatchEvent(new window.MouseEvent("click", {bubbles: true})); await sleep(20);
  const ov = JSON.parse(window.localStorage.getItem("dc26.override"));
  assert(ov && ov.hotel === "Westin" && typeof ov.at === "number", "tapping a hero block stores an override with a timestamp");
  assert(window.eval("currentLocation(getNow())") === "Westin", "override wins over every other location rule");
  const locLine = document.querySelector("#view-now .hero-loc");
  assert(locLine && /At the Westin/.test(locLine.textContent), "hero shows 'At the Westin'");
  assert(/set .* ago|just now/.test(locLine.textContent), "hero shows how long ago it was set");
  assert(locLine.querySelector('[data-act="clear-override"]'), "hero offers a way to clear it");
  assert(document.querySelector('#view-now .hero-map [data-map="Westin"]').classList.contains("on"), "map highlights the override block");
  // expiry: older than 90 minutes
  assert(window.eval(`(function(){
    var o = loadJSON("dc26.override", null);
    saveJSON("dc26.override", {hotel: o.hotel, at: getNow().getTime() - 91*60000});
    var r = overrideLocation(getNow());
    saveJSON("dc26.override", o); return r; })()`) === null, "override expires after 90 minutes");
  // expiry: the next pick has started
  assert(window.eval(`(function(){
    var o = loadJSON("dc26.override", null);
    var n = getNow();
    var nxt = events.find(e => picks.has(e.id) && e._s > n);
    if (!nxt) return null;
    saveJSON("dc26.override", {hotel: "Westin", at: n.getTime() - 1000});
    var r = overrideLocation(new Date(nxt._s.getTime() + 60000));
    saveJSON("dc26.override", o); return r; })()`) === null, "override expires once the next pick starts");
  // tapping the same block again clears it
  document.querySelector('#view-now .hero-map [data-map="Westin"]').dispatchEvent(new window.MouseEvent("click", {bubbles: true})); await sleep(20);
  assert(!JSON.parse(window.localStorage.getItem("dc26.override") || "null"), "tapping the same block again clears the override");
  // the clear link works too
  document.querySelector('#view-now .hero-map [data-map="Hyatt"]').dispatchEvent(new window.MouseEvent("click", {bubbles: true})); await sleep(20);
  document.querySelector('#view-now .hero-loc [data-act="clear-override"]').click(); await sleep(20);
  assert(!JSON.parse(window.localStorage.getItem("dc26.override") || "null"), "the clear link removes the override");
  assert(!document.querySelector("#view-now .hero-loc"), "the location line disappears once cleared");
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
  document.querySelector('#view-browse .browse-map [data-map="Westin"]').dispatchEvent(new window.MouseEvent("click", {bubbles: true})); await sleep(10);
  assert(window.eval("state.browse.hotel") === "Westin", "map block sets the hotel filter");
  assert([...document.querySelectorAll("#view-browse .room")].every(r => !/Marriott|Hilton|Hyatt/.test(r.textContent)), "hotel filter applies");
  // noise toggle: Epic Photos hidden by default
  document.querySelector('#view-browse .browse-map [data-map="Westin"]').dispatchEvent(new window.MouseEvent("click", {bubbles: true})); await sleep(10);
  assert(window.eval("state.browse.hotel") === "All", "tapping the same block again clears the filter");
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
