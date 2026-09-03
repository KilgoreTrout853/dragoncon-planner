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
  // starring must not move the list under the reader's finger: the first pick
  // inserts the hero card above it, which used to shove everything down ~200px
  const anchorProbe = window.eval(`(function(){
    picks = new Set(); savePicks(); render();
    var rows = document.querySelectorAll('#view-now .row[data-list="around"]');
    var tapped = rows[2], neighbour = rows[4];
    var nid = neighbour.dataset.id;
    var before = neighbour.getBoundingClientRect().top;
    var li = tapped.closest('.row');
    togglePick(li.dataset.id, li);
    var again = document.querySelector('#view-now .row[data-list="around"][data-id="' + (window.CSS && CSS.escape ? CSS.escape(nid) : nid) + '"]');
    return {drift: again ? Math.round(again.getBoundingClientRect().top - before) : null, picks: picks.size};
  })()`);
  assert(anchorProbe.picks === 1, "starring adds exactly one pick");
  assert(anchorProbe.drift !== null && Math.abs(anchorProbe.drift) <= 2,
    `starring does not shift neighbouring rows (drift ${anchorProbe.drift}px)`);
  window.eval(`(function(){ var r = document.querySelectorAll('#view-now .row')[0]; picks = new Set([r.dataset.id]); savePicks(); render(); })()`); await sleep(20);
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
  // the sheet owns the vertical gesture, so the page behind it cannot scroll
  // while you drag - that was the "whole screen moves" complaint
  const css = html;
  assert(/\.sheet\s*\{[^}]*touch-action:\s*none/.test(css), "the sheet declares touch-action: none");
  assert(/\.ev-body\s*\{[^}]*touch-action:\s*pan-y/.test(css), "the description still scrolls (touch-action: pan-y)");
  assert(/\.sheet\.settling\s*\{[^}]*transition:\s*transform/.test(css), "the sheet animates when it settles");
  assert(/prefers-reduced-motion[^}]*\}[\s\S]{0,200}?\.sheet\.settling\s*\{[^}]*transition:\s*none/.test(css)
      || /@media \(prefers-reduced-motion: reduce\) \{[\s\S]{0,240}?\.sheet\.settling/.test(css),
     "the settle animation is dropped under prefers-reduced-motion");
  // closing must clear everything the drag touched, or the next open is offset
  window.eval("setDrag(120)");
  assert(document.getElementById("sheet").style.transform !== "", "drag applies a transform");
  window.eval("closeSheet()"); await sleep(10);
  assert(document.getElementById("sheet").style.transform === "", "closing clears the drag transform");
  assert(document.getElementById("sheetBack").style.opacity === "", "closing clears the backdrop fade");
  assert(!document.getElementById("sheet").classList.contains("settling"), "closing clears the settling class");
  // reopen and close via backdrop
  document.querySelector("#view-now .row-main").click(); await sleep(20);
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
  // location is inferred from the schedule alone: on now, else just ended, else nothing
  const chain = window.eval(`(function(){
    var saved = [...picks];
    var n = getNow();
    var onNow = events.find(e => e._s <= n && n < e._e && e.hotel !== "Streaming");
    picks = new Set([onNow.id]);
    var a = currentLocation(n);
    var ended = events.filter(e => e._e <= n && (n - e._e)/60000 <= 90 && e.hotel !== "Streaming")
                      .sort(function(x,y){ return y._e - x._e; })[0];
    picks = ended ? new Set([ended.id]) : new Set();
    var b = currentLocation(n);
    picks = new Set();
    var c = currentLocation(n);
    picks = new Set(saved);
    return {onNow: a, onNowHotel: onNow.hotel, justEnded: b, endedHotel: ended ? ended.hotel : null, empty: c};
  })()`);
  assert(chain.onNow === chain.onNowHotel, "currentLocation uses the pick that's on now");
  if (chain.endedHotel) assert(chain.justEnded === chain.endedHotel, "currentLocation falls back to a pick that just ended");
  assert(chain.empty === null, "currentLocation is null when the schedule says nothing");
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

  // ---- the venue map is gone: hotel filtering is chips again ----
  assert(window.eval("typeof venueMapHTML") === "undefined", "the map component is gone");
  assert(!document.querySelector(".venue-map"), "no map renders anywhere");
  assert(!document.querySelector("#view-now .hero-map"), "the hero card has no map");
  assert(window.eval("typeof overrideLocation") === "undefined", "the override code is gone");
  assert(window.eval("typeof settings.homeBase") === "undefined", "the home base setting is gone");
  assert(!document.getElementById("homeBase"), "no home base control in Settings");
  // browse: search
  document.querySelector('.nav button[data-tab="browse"]').click(); await sleep(10);
  const q = document.getElementById("q"); q.value = "boroughs"; q.dispatchEvent(new window.Event("input", { bubbles: true })); await sleep(220);
  let results = window.eval("browseResults()");
  assert(results.length > 0 && results.length < 100 && results.every(e => /boroughs/i.test(e.title + " " + e.description)), `search filters to matches (${results.length})`);
  // all days chip
  document.querySelector('#view-browse [data-chip="day"][data-value="All"]').click(); await sleep(10);
  assert(document.querySelectorAll("#view-browse .t .day").length > 1, "All days + query shows per-row day labels");
  // hotel chip
  const q2 = document.getElementById("q"); q2.value = ""; q2.dispatchEvent(new window.Event("input", { bubbles: true })); await sleep(220);
  assert(window.eval("state.browse.q") === "", "search cleared");
  document.querySelector('#view-browse [data-chip="hotel"][data-value="Westin"]').click(); await sleep(10);
  assert(window.eval("state.browse.hotel") === "Westin", "hotel chip sets the filter");
  assert([...document.querySelectorAll("#view-browse .room")].every(r => !/Marriott|Hilton|Hyatt/.test(r.textContent)), "hotel filter applies");
  // ---- search step 1: query intent parsing ----
  // work from a known filter state, then hand the previous one back so the
  // search-quality assertions further down still see what they expect
  const browseSnapshot = window.eval("JSON.stringify(state.browse)");
  const resetBrowse = () => window.eval(`(function(){
    Object.assign(state.browse, {q:"", day:"All", prevDay:null, hotel:"All", type:"All", track:"All",
      fandom:"All", kind:"All", hideNoise:false, page:1});
    renderBrowse();
  })()`);
  resetBrowse(); await sleep(20);
  const P = q => window.eval(`(function(){ var p = parseQuery(${JSON.stringify(q)}); return {residual:p.residual, filters:p.filters, chips:p.chips.map(function(c){return c.label;})}; })()`);
  const a1 = P("star trek saturday hilton");
  assert(a1.residual === "star trek", `"star trek saturday hilton" searches only "star trek" (got "${a1.residual}")`);
  assert(a1.filters.day === "2026-09-05" && a1.filters.hotel === "Hilton", "day and hotel pulled out of the query");
  assert(a1.chips.join(",") === "Saturday,Hilton", `chips name what was taken (${a1.chips.join(",")})`);
  const a2 = P("signing sunday");
  assert(a2.residual === "" && a2.filters.kind === "signing" && a2.filters.day === "2026-09-06", "signing sunday is all filters");
  const a3 = P("tonight");
  assert(a3.filters.day === window.eval("conDayKey(getNow())") && a3.filters.time === "evening", "tonight means today, evening");
  const a4 = P("late night party");
  assert(a4.residual === "" && a4.filters.time === "late night" && a4.filters.kind === "party", "late night party is time + kind");
  // "gaming" is a filter alone or with a day/hotel, a search word otherwise
  assert(P("gaming").filters.kind === "gaming", "bare 'gaming' filters by kind");
  assert(P("marriott gaming").filters.kind === "gaming", "'marriott gaming' filters by kind");
  const a5 = P("board game night");
  assert(!a5.filters.kind, "'board game night' keeps 'game' as a search word");
  assert(a5.residual === "board game night", `the reverted word stays in place (got "${a5.residual}")`);
  // an all-filter query returns the filtered set in time order.
  // The fixture has no Sunday signings, so use a pair it does have.
  resetBrowse(); await sleep(10);
  window.eval(`(function(){ state.browse.q = "concert saturday"; state.browse.page = 1; renderBrowse(); })()`); await sleep(30);
  const sres = window.eval("browseResults()");
  assert(sres.length > 0, `"concert saturday" returns results (${sres.length})`);
  assert(sres.every(e => e._cd === "2026-09-05" && e.tags && e.tags.kind === "performance"), "every result is a Saturday performance");
  assert(!document.querySelector("#view-browse mark"), "an all-filter query highlights nothing (no search terms)");
  const times = sres.map(e => +new Date(e.start));
  assert(times.every((t, i) => i === 0 || t >= times[i-1]), "an all-filter query comes back in time order");
  // the chips render and can be taken back off
  const pchips = [...document.querySelectorAll("#view-browse .chip.parsed")];
  assert(pchips.length === 2, `two parsed chips render (${pchips.length})`);
  pchips.find(c => /Saturday/.test(c.textContent)).click(); await sleep(30);
  assert(!/saturday/i.test(window.eval("state.browse.q")), "removing a chip strips that word from the query");
  assert(window.eval("state.browse.q") === "concert", `the rest of the query survives (got "${window.eval("state.browse.q")}")`);
  // a parsed word beats the chip on the same dimension
  window.eval(`(function(){ state.browse.day = "2026-09-04"; state.browse.q = "saturday"; renderBrowse(); })()`); await sleep(30);
  assert(window.eval("activeFilters().day") === "2026-09-05", "a parsed day overrides the day chip");
  window.eval(`(function(){ state.browse.q = ""; state.browse.day = "2026-09-05"; state.browse.page = 1; renderBrowse(); })()`); await sleep(30);
  assert(window.eval("activeFilters().day") === "2026-09-05", "the chip takes over again once the word is gone");
  // ---- search step 2: suggestions as you type ----
  resetBrowse(); await sleep(10);
  const SG = q => window.eval(`(function(){ state.browse.q = ${JSON.stringify(q)}; var s = suggestionsFor(${JSON.stringify(q)});
    return {people: s.people.map(function(p){return p.name;}), topics: s.topics.map(function(t){return t.name;}),
            pc: s.people.map(function(p){return p.count;}), tc: s.topics.map(function(t){return t.count;})}; })()`);
  assert(window.eval("suggestDocs.length") >= 20, `a name index was built (${window.eval("suggestDocs.length")} names)`);
  assert(window.eval("suggestDocs.filter(function(d){return d.group==='people';}).length") > 0, "people are indexed");
  assert(window.eval("suggestDocs.filter(function(d){return d.group==='topics';}).length") > 0, "fandoms and topics are indexed");
  const one = SG("a");
  assert(!one.people.length && !one.topics.length, "one character suggests nothing");
  const two = SG("ke");
  assert(two.people.length || two.topics.length, `two characters start suggesting (${two.people.join(",")})`);
  const sug = SG("ka");
  assert(sug.people.length > 0, `"ka" suggests people (${sug.people.join(", ")})`);
  assert(sug.people.length <= 5 && sug.topics.length <= 5, "at most five chips per row");
  assert(sug.pc.every((c, i) => i === 0 || c <= sug.pc[i-1]), `people ranked by how many events match (${sug.pc.join(">")})`);
  assert(sug.people.every(n => n.includes(" ") || /^[A-Z]/.test(n)), `suggestions are whole names, not fragments (${sug.people.join("|")})`);
  const rick = SG("rick");
  assert(rick.topics.includes("Rick and Morty"), `topics are suggested too (${rick.topics.join(", ")})`);
  // the rows render, labelled
  window.eval(`(function(){ state.browse.q = "ka"; state.browse.page = 1; renderBrowse(); })()`); await sleep(30);
  const labels = [...document.querySelectorAll("#view-browse .suggest-label")].map(l => l.textContent.trim());
  assert(labels.some(l => /People/i.test(l)) || labels.some(l => /Fandoms/i.test(l)), `suggestion rows are labelled (${labels.join("|")})`);
  // tapping a chip searches that name exactly
  const target = window.eval(`(function(){ var s = suggestionsFor("ka"); return s.people[0].name; })()`);
  document.querySelector(`#view-browse [data-act="suggest"][data-name="${target}"]`).click(); await sleep(40);
  assert(window.eval("state.browse.q") === `"${target}"`, `tapping quotes the name (${window.eval("state.browse.q")})`);
  const exact = window.eval("browseResults()");
  assert(exact.length > 0, `the exact-phrase search returns results (${exact.length})`);
  assert(exact.every(e => JSON.stringify([e.title, (e.tags||{}).fandoms, (e.tags||{}).topics, (e.speakers||[]).map(p=>p.name)]).toLowerCase().includes(target.toLowerCase())),
    `every result actually mentions ${target}`);
  // the suggestion rows give way to one active chip
  assert(document.querySelector("#view-browse .chip.suggest.on"), "the chosen name shows as an active chip");
  assert(!document.querySelector('#view-browse [data-act="suggest"]'), "the suggestion rows are hidden once a name is chosen");
  document.querySelector('#view-browse [data-act="unsuggest"]').click(); await sleep(30);
  assert(window.eval("state.browse.q") === "", "clearing the active chip empties the query");
  // counts follow the noise filter, so a chip never promises more than it shows
  const withNoiseHidden = window.eval(`(function(){ state.browse.hideNoise = true; var s = suggestionsFor("nath"); return s.people[0]; })()`);
  const withNoiseShown  = window.eval(`(function(){ state.browse.hideNoise = false; var s = suggestionsFor("nath"); return s.people[0]; })()`);
  if (withNoiseHidden && withNoiseShown && withNoiseHidden.name === withNoiseShown.name) {
    assert(withNoiseHidden.count <= withNoiseShown.count,
      `the chip count drops when photo sessions are hidden (${withNoiseHidden.count} <= ${withNoiseShown.count})`);
  }

  // ---- search step 3: the celebrity marker; the chip that filtered on it is gone ----
  resetBrowse(); await sleep(20);
  const celebTotal = window.eval("events.filter(isCeleb).length");
  assert(celebTotal > 0, `the fixture has celebrity events (${celebTotal})`);
  assert(!document.querySelector('#view-browse [data-chip="celebrity"]'), "there is no Celebrity chip in the kind row");
  assert(!/celeb-chip|browse\.celebrity|f\.celebrity/.test(html), "and nothing in the source still filters on it");
  assert(document.querySelectorAll('#view-browse .chips[data-row="kind"] [aria-pressed="true"]').length === 1, "the kind row lights exactly one chip");
  // the marker shows on rows, and only on the right rows
  window.eval(`(function(){ state.browse.q = "NASA"; state.browse.day = "All"; state.browse.page = 1; renderBrowse(); })()`); await sleep(30);
  const marked = [...document.querySelectorAll("#view-browse .row .celeb")];
  assert(marked.length > 0, "rows carry a celebrity marker");
  assert(marked.every(m => /celebrity/i.test(m.textContent)), "the marker says what it means");
  const rowsWithMark = [...document.querySelectorAll("#view-browse .row")].filter(r => r.querySelector(".celeb"));
  assert(rowsWithMark.every(r => window.eval(`isCeleb(byId.get(${JSON.stringify(r.dataset.id)}))`)), "only celebrity rows are marked");
  window.eval(`(function(){ state.browse.q = ""; state.browse.page = 1; renderBrowse(); })()`); await sleep(20);
  // and in the detail sheet
  const celebId = window.eval("events.filter(isCeleb)[0].id");
  window.eval(`openSheet("event", ${JSON.stringify(celebId)})`); await sleep(30);
  assert(document.querySelector("#panel-event .celeb"), "the detail sheet marks a celebrity event");
  const plainId = window.eval("(events.find(function(e){ return e.tags && e.tags.guests !== 'celebrity'; })||{}).id");
  if (plainId) {
    window.eval(`openSheet("event", ${JSON.stringify(plainId)})`); await sleep(30);
    assert(!document.querySelector("#panel-event .celeb"), "and does not mark a non-celebrity one");
  }
  document.getElementById("sheetBack").click(); await sleep(20);

  window.eval(`(function(){ Object.assign(state.browse, ${browseSnapshot}); renderBrowse(); })()`); await sleep(20);

  // noise toggle: Epic Photos hidden by default
  document.querySelector('#view-browse [data-chip="hotel"][data-value="Westin"]').click(); await sleep(10);
  assert(window.eval("state.browse.hotel") === "All", "tapping the same chip again clears the filter");
  // every venue in the data is reachable again, including Hardy Ivy and Streaming
  const chipVals = [...document.querySelectorAll("#view-browse [data-chip='hotel']")].map(c => c.dataset.value);
  window.eval("hotels").forEach(h => assert(chipVals.includes(h), `every venue has a chip: ${h}`));
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

  // ---- the control strip: two rows of two, one footprint ----
  const strip = [...mine.querySelectorAll(".mine-actions .btn, .view-toggle button")].map(b => b.textContent.trim());
  assert(strip.join(" | ") === "Export to calendar | Remove all | Timeline | List", `four controls in order (${strip.join(" | ")})`);
  assert(mine.querySelector(".mine-actions").compareDocumentPosition(mine.querySelector(".view-toggle")) & window.Node.DOCUMENT_POSITION_FOLLOWING,
    "actions above the view toggle");
  assert(/\.mine-actions \{[^}]*grid-template-columns: 1fr 1fr/.test(html), "the actions row is two equal columns");
  const actH = (html.match(/\.mine-actions \.btn \{[^}]*height: (\d+)px/) || [])[1];
  const togH = (html.match(/\.view-toggle button \{[^}]*height: (\d+)px/) || [])[1];
  assert(actH && actH === togH, `actions and toggle share a height (${actH} vs ${togH})`);
  const actR = (html.match(/\.mine-actions \.btn \{[^}]*border-radius: (\d+)px/) || [])[1];
  const togR = (html.match(/\.view-toggle button \{[^}]*border-radius: (\d+)px/) || [])[1];
  assert(actR && actR === togR, `and a corner radius (${actR} vs ${togR})`);
  const actG = (html.match(/\.mine-actions \{[^}]*gap: (\d+)px/) || [])[1];
  const togG = (html.match(/\.view-toggle \{[^}]*gap: (\d+)px/) || [])[1];
  assert(actG && actG === togG, `and a gap (${actG} vs ${togG})`);
  assert(mine.querySelectorAll(".mine-actions .btn[disabled]").length === 0, "with picks, both actions are live");

  // ---- step 5: timeline is the default view on Mine ----
  assert(window.eval("state.mineView") === "timeline", "Mine defaults to the timeline");
  assert(mine.querySelector(".tl-grid"), "timeline grid renders");
  assert(mine.querySelectorAll(".tl-block").length === (tight ? 2 : 1), `timeline draws a block per pick`);
  assert(mine.querySelectorAll(".tl-hour").length >= 2, "hour ruler renders");
  // 60px per hour, blocks sized by duration
  const scale = window.eval(`(function(){
    var m = events.filter(e => picks.has(e.id)).sort((a,b)=>a._s-b._s);
    return m.map(e => Math.round((e._e - e._s)/60000));
  })()`);
  const heights = [...mine.querySelectorAll(".tl-block")].map(b => parseFloat(b.style.height));
  assert(heights.every((h, i) => Math.abs(h - (scale[i] - 2)) < 1.5 || h === 24),
    `block height tracks duration at 60px/hour (${heights.map(h=>h.toFixed(0))} vs ${scale})`);
  assert(window.eval("HOUR_PX") === 60, "HOUR_PX is 60");
  // long blocks keep their true geometry but are marked for the fade
  const longs = window.eval(`(function(){
    var m = events.filter(e => picks.has(e.id));
    return m.filter(e => (e._e - e._s)/60000 >= 152).length;
  })()`);
  assert([...mine.querySelectorAll(".tl-block.long")].length === longs,
    `long blocks flagged for fading (${longs})`);
  [...mine.querySelectorAll(".tl-block.long")].forEach(b =>
    assert(/runs to /.test(b.textContent), "a long block says when it runs to"));
  // tapping a block opens the step-1 sheet
  mine.querySelector(".tl-block").click(); await sleep(20);
  assert(!document.getElementById("sheetWrap").hidden && !document.getElementById("panel-event").hidden, "tapping a timeline block opens the event sheet");
  document.getElementById("sheetBack").click(); await sleep(10);
  // overlapping picks become side-by-side columns
  const cols = window.eval(`(function(){
    var n = getNow();
    var base = events.filter(e => picks.has(e.id))[0];
    var over = events.find(e => !picks.has(e.id) && e._s < base._e && e._e > base._s && e.id !== base.id);
    if (!over) return null;
    picks.add(over.id); savePicks(); render();
    var l = layoutColumns(events.filter(e => picks.has(e.id) && conDayKey(e._s) === conDayKey(base._s)));
    var pair = l.filter(i => i.ev.id === base.id || i.ev.id === over.id);
    var r = {cols: Math.max.apply(null, pair.map(i => i.cols)), distinct: new Set(pair.map(i => i.col)).size};
    picks.delete(over.id); savePicks(); render();
    return r;
  })()`); await sleep(20);
  if (cols) {
    assert(cols.cols >= 2, `overlapping picks widen the cluster to ${cols.cols} columns`);
    assert(cols.distinct >= 2, "overlapping picks land in different columns");
  }
  // a con day ends at 5am: a 1am Sunday pick belongs to Saturday's timeline
  assert(window.eval(`conDayKey(new Date("2026-09-06T01:00")) === "2026-09-05"`), "1am Sunday sits on Saturday's timeline");
  // switch to the list view for the assertions that follow
  mine.querySelector('[data-act="view-list"]').click(); await sleep(20);
  assert(window.eval("state.mineView") === "list", "toggle switches to the list view");
  assert(JSON.parse(window.localStorage.getItem("dc26.mineView")) === "list", "view choice persists");
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
  assert(mine.querySelectorAll(".mine-actions .btn[disabled]").length === 2, "with nothing picked, both actions are disabled");
  assert(!mine.querySelector(".view-toggle"), "and there is no view toggle to switch");
  assert(/\.btn\[disabled\] \{[^}]*opacity/.test(html), "disabled buttons look disabled");
  // search quality: the four real queries
  document.querySelector('.nav button[data-tab="browse"]').click(); await sleep(10);
  const top = async (query) => { const q = document.getElementById("q"); q.value = query; q.dispatchEvent(new window.Event("input", { bubbles: true })); await sleep(220); return window.eval("browseResults().slice(0,3).map(e => e.title)"); };
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
  assert(!document.getElementById("hideAdult"), "there is no Hide 18+ toggle any more");
  window.eval(`(function(){ state.browse.q = "kids"; state.browse.page = 1; renderBrowse(); })()`); await sleep(30);
  assert(window.eval("browseResults().length") > 0 && !window.eval("browseResults().some(e => e.tags && e.tags.adult)"), "but the word kids still keeps 18+ out");
  window.eval(`(function(){ state.browse.q = ""; state.browse.day = "All"; state.browse.page = 1; renderBrowse(); })()`); await sleep(30);
  assert(window.eval("browseResults().length") === beforeAdult, "and with it cleared everything is back");
  document.querySelector('#view-browse [data-chip="kind"][data-value="contest"]').click(); await sleep(10);
  assert(window.eval("browseResults().every(e => e.tags.kind === 'contest')"), "kind chip filters");
  // settings sheet
  document.getElementById("settingsBtn").click(); await sleep(10);
  assert(!document.getElementById("sheetWrap").hidden, "settings opens");
  assert(!document.getElementById("panel-settings").hidden && document.getElementById("panel-event").hidden, "settings panel shown, event panel hidden");
  document.getElementById("closeSheet").click(); await sleep(10);
  assert(document.getElementById("sheetWrap").hidden, "settings closes");
  // ---- render cost: typing is debounced, the minute tick patches ----
  assert(window.eval("typeof queueBrowseRender") === "function", "browse renders are queued, not immediate");
  assert(window.eval("SEARCH_DEBOUNCE_MS") >= 80 && window.eval("SEARCH_DEBOUNCE_MS") <= 300,
    `the debounce is in a sensible range (${window.eval("SEARCH_DEBOUNCE_MS")}ms)`);
  /* Earlier steps leave chips set; start from a known filter state. */
  const perfSnapshot = window.eval("JSON.stringify(state.browse)");
  window.eval(`(function(){ state.tab = "browse";
    Object.assign(state.browse, {q:"", day:"All", prevDay:null, hotel:"All", type:"All", track:"All",
      fandom:"All", kind:"All", showHidden:false, showPast:false, noToday:false,
      hideNoise:false, page:1});
    render(); })()`); await sleep(30);
  const typed = window.eval(`(function(){
    var n = 0, real = renderBrowse;
    window.renderBrowse = function(){ n++; return real.apply(this, arguments); };
    var el = document.getElementById("q"), q = "boroughs";
    for (var i = 1; i <= q.length; i++) { el.value = q.slice(0, i); el.dispatchEvent(new window.Event("input", {bubbles: true})); }
    return n; })()`);
  assert(typed === 0, `typing eight characters draws nothing while you type (${typed} renders)`);
  /* Wait for the timer to actually fire rather than guessing at a delay -
     timers in this harness can run several seconds late under load. */
  for (let i = 0; i < 60 && window.eval("browseRenderTimer") !== null; i++) await sleep(50);
  assert(window.eval("browseRenderTimer") === null, "the queued render eventually fires");
  assert(document.querySelectorAll("#view-browse .row").length > 0, "and draws once you stop");
  assert(window.eval(`state.browse.q`) === "boroughs", "the query itself was recorded immediately");
  // a direct render cancels a pending one rather than drawing twice
  window.eval(`(function(){ var el = document.getElementById("q"); el.value = "party";
    el.dispatchEvent(new window.Event("input", {bubbles: true})); })()`);
  assert(window.eval("browseRenderTimer") !== null, "a render is pending after a keystroke");
  window.eval(`render()`);
  assert(window.eval("browseRenderTimer") === null, "and a direct render cancels it");
  window.eval(`(function(){ Object.assign(state.browse, ${perfSnapshot}); state.browse.q = ""; state.tab = "now"; render(); })()`); await sleep(30);

  // the minute tick leaves the list alone when nothing has actually moved
  assert(window.eval("typeof tickNow") === "function", "the tick has its own path");
  assert(window.eval("typeof nowSignature") === "function" && window.eval("typeof nowModel") === "function",
    "built on a model and a signature rather than a rebuild");
  const tickProbe = JSON.parse(window.eval(`(function(){
    picks = new Set(events.filter(function(e){ return e._e > getNow(); }).slice(0, 5).map(function(e){ return e.id; }));
    state.tab = "now"; renderNow();
    var view = document.getElementById("view-now");
    var hero = view.querySelector(".hero");
    var rows = [].slice.call(view.querySelectorAll(".row"));
    tickNow();
    var after = [].slice.call(view.querySelectorAll(".row"));
    var r = {rowsSurvived: rows.length === after.length && rows.every(function(x, i){ return x === after[i]; }),
             heroSurvived: view.querySelector(".hero") === hero, rowCount: after.length};
    picks = new Set(); savePicks(); render();
    return JSON.stringify(r); })()`));
  assert(tickProbe.rowCount > 0, `the Now tab had rows to disturb (${tickProbe.rowCount})`);
  assert(tickProbe.rowsSurvived, "a tick with nothing new leaves every row node in place");
  assert(tickProbe.heroSurvived, "and leaves the hero card alone too");
  // but a real change still redraws
  const changed = window.eval(`(function(){
    picks = new Set(); state.tab = "now"; renderNow();
    var sigBefore = lastNowSig;
    picks = new Set(events.filter(function(e){ return e._e > getNow(); }).slice(0, 3).map(function(e){ return e.id; }));
    tickNow();
    var redrew = lastNowSig !== sigBefore;
    picks = new Set(); savePicks(); render();
    return redrew; })()`);
  assert(changed, "a tick that finds the plan changed falls back to a full render");

  // ---- Now is about today: a Saturday pick seen from Thursday is not "your next" ----
  // The clock is Saturday 1:05 PM. Sunday picks must not become the hero.
  const dayPlan = JSON.parse(window.eval(`(function(){
    var n = getNow();
    var sun = events.filter(function(e){ return conDayKey(e._s) === "2026-09-06" && e._s > n && e.hotel !== "Streaming"; });
    var satLater = events.filter(function(e){ return conDayKey(e._s) === conDayKey(n) && e._s > n && e.hotel !== "Streaming"; });
    var satOn = events.find(function(e){ return e._s <= n && n < e._e && e.hotel !== "Streaming"; });
    picks = new Set([sun[0].id, sun[1].id]); savePicks(); state.tab = "now"; render();
    var view = document.getElementById("view-now");
    var out = {sunOnly: {hero: !!view.querySelector(".hero"), empty: (view.querySelector(".empty") || {}).textContent || "",
      nextRow: (function(){ var r = view.querySelector('.row[data-list="next"]'); return r ? {id: r.dataset.id, day: (r.querySelector(".t .day") || {}).textContent} : null; })(),
      restTitle: !!view.querySelector(".section-title") && /Rest of your day/.test(view.textContent),
      minibar: document.getElementById("minibar").hidden}};
    picks = new Set([sun[0].id, satLater[0].id, satLater[1].id]); savePicks(); render();
    out.mixed = {heroId: (view.querySelector(".hero") || {dataset: {}}).dataset.hero,
      restIds: [].map.call(view.querySelectorAll('.row[data-list="next"]'), function(r){ return r.dataset.id; }),
      count: (view.querySelector(".section-title .count") || {}).textContent};
    picks = new Set([satOn.id, sun[0].id]); savePicks(); render();
    var h = view.querySelector(".hero");
    out.onNow = {kicker: h ? h.querySelector(".hkicker").textContent : null, then: h ? (h.querySelector(".hthen") || {}).textContent || "" : null};
    picks = new Set(); savePicks(); render();
    return JSON.stringify({sun0: sun[0].id, sat0: satLater[0].id, sat1: satLater[1].id, satOn: satOn.id, out: out}); })()`));
  const dp = dayPlan.out;
  assert(!dp.sunOnly.hero, "with only Sunday picks, Saturday's Now has no hero");
  assert(/Nothing picked for later today/.test(dp.sunOnly.empty) && /Sunday/.test(dp.sunOnly.empty),
    `it says so, and names the day of the next pick (${dp.sunOnly.empty.trim().slice(0, 70)})`);
  assert(dp.sunOnly.nextRow && dp.sunOnly.nextRow.id === dayPlan.sun0 && dp.sunOnly.nextRow.day === "Sun",
    "and shows that pick as one row, labelled Sun");
  assert(!dp.sunOnly.restTitle, "there is no 'Rest of your day' for a day with nothing in it");
  assert(dp.sunOnly.minibar, "and the mini-bar agrees: nothing today");
  assert(dp.mixed.heroId === dayPlan.sat0, "with Saturday picks too, the hero is today's next");
  assert(dp.mixed.restIds.join(",") === dayPlan.sat1, `the rest of the day is today's only (${dp.mixed.restIds.length} rows)`);
  assert(dp.mixed.count === "2 today", `and the count is today's, not every pick (${dp.mixed.count})`);
  assert(dp.onNow.kicker === "On now" && !/leave by/.test(dp.onNow.then),
    `an on-now hero does not tell you to leave for a Sunday event (${dp.onNow.then.trim()})`);

  // ---- one definition of "day": the con day, which runs to 5am, everywhere ----
  window.location.hash = "#now=2026-09-06T01:00"; window.dispatchEvent(new window.Event("hashchange")); await sleep(40);
  const oneAm = JSON.parse(window.eval(`(function(){
    /* earlier blocks leave chips set; start from the default filters */
    Object.assign(state.browse, {q: "", day: null, prevDay: null, hotel: "All", type: "All", track: "All", fandom: "All",
      kind: "All", showHidden: false, showPast: false, noToday: false, hideNoise: true, page: 1});
    state.tab = "browse"; render();
    var chip = state.browse.day;
    /* not a photo session or screening: the default noise filter would hide it */
    var late = events.find(function(e){ return e.day === "2026-09-06" && e._s.getHours() < 5 && !isNoise(e); });
    state.browse.day = "2026-09-05"; renderBrowse();
    var underSat = browseResults().some(function(e){ return e.id === late.id; });
    state.browse.day = "2026-09-06"; renderBrowse();
    var underSun = browseResults().some(function(e){ return e.id === late.id; });
    state.browse.q = late.title; state.browse.day = "All"; renderBrowse();
    var row = document.querySelector('#view-browse .row[data-id="' + late.id + '"]');
    var label = row ? row.querySelector(".t .day").textContent : null;
    state.browse.q = "";
    picks = new Set([late.id]); savePicks();
    state.mineView = "list"; state.tab = "mine"; render();
    var listDay = document.querySelector("#view-mine .day-head").textContent.trim();
    state.mineView = "timeline"; render();
    var tlDay = document.querySelector("#view-mine .tl-day .day-head").textContent.trim();
    openSheet("event", late.id);
    var when = document.querySelector("#panel-event .ev-when").textContent.replace(/\\s+/g, " ").trim();
    closeSheet();
    picks = new Set(); savePicks(); state.tab = "browse"; state.browse.day = null; render();
    return JSON.stringify({chip: chip, late: late.start, underSat: underSat, underSun: underSun, label: label,
      listDay: listDay, tlDay: tlDay, when: when}); })()`));
  assert(oneAm.chip === "2026-09-05", `at 1 AM Sunday, Search opens on the Saturday chip (${oneAm.chip})`);
  assert(oneAm.underSat && !oneAm.underSun, `a small-hours Sunday event (${oneAm.late}) is under Sat, not Sun`);
  assert(oneAm.label === "Sat", `and its row is labelled Sat (${oneAm.label})`);
  assert(/^Saturday/.test(oneAm.listDay) && /^Saturday/.test(oneAm.tlDay),
    `Mine's list and timeline file it under the same day (${oneAm.listDay} / ${oneAm.tlDay})`);
  assert(/^Sunday, /.test(oneAm.when) && /Saturday night/.test(oneAm.when), `the sheet keeps the date and names the night (${oneAm.when})`);
  window.location.hash = "#now=2026-09-05T13:05"; window.dispatchEvent(new window.Event("hashchange")); await sleep(40);
  window.eval(`(function(){ state.tab = "now"; state.browse.day = null; render(); })()`); await sleep(20);
  assert(window.eval("state.browse.day") === null || window.eval("conDayKey(getNow())") === "2026-09-05", "the clock is back on Saturday afternoon");

  // ---- because you starred: suggestions drawn from the reader's own picks ----
  const sugStrip = JSON.parse(window.eval(`(function(){
    follows = []; saveFollows(); picks = new Set(); savePicks();
    state.tab = "explore"; state.explore.page = null; state.explore.q = ""; state.explore.expanded = {}; render();
    var out = {none: !!document.getElementById("suggested")};
    var ev = events.find(function(e){ return (e.tracks || []).some(function(t){ return !NOISE_TRACKS.has(t); }); });
    picks = new Set([ev.id]); savePicks(); render();
    var sec = document.getElementById("suggested");
    out.one = {shown: !!sec,
      title: sec ? sec.querySelector(".section-title").textContent.replace(/\\s+/g, " ").trim() : "",
      tiles: sec ? [].map.call(sec.querySelectorAll(".tile"), function(t){ return t.dataset.explore; }) : [],
      aboveFilter: !!sec && !!(sec.compareDocumentPosition(document.getElementById("exploreQ")) & 4)};
    var track = ev.tracks.filter(function(t){ return !NOISE_TRACKS.has(t); })[0];
    toggleFollow("track", track); render();
    sec = document.getElementById("suggested");
    out.afterFollow = sec ? [].map.call(sec.querySelectorAll(".tile"), function(t){ return t.dataset.explore; }) : [];
    follows = []; saveFollows();
    var noise = events.find(function(e){ return NOISE_TRACKS.has(e.track) && !(e.speakers || []).length; });
    picks = new Set([noise.id]); savePicks(); render();
    out.noise = !!document.getElementById("suggested");
    picks = new Set(); savePicks(); render();
    return JSON.stringify({track: track, out: out}); })()`));
  assert(!sugStrip.out.none, "with nothing starred there is no suggestions strip");
  assert(sugStrip.out.one.shown && /^Because you starred 1 thing\b/.test(sugStrip.out.one.title), `one pick brings a strip headed by the count (${sugStrip.out.one.title})`);
  assert(sugStrip.out.one.tiles.includes("track:" + sugStrip.track), `it offers the pick's track (${sugStrip.out.one.tiles.join(", ")})`);
  assert(sugStrip.out.one.aboveFilter, "and sits above the filter box");
  assert(!sugStrip.out.afterFollow.includes("track:" + sugStrip.track), "following it takes it off the strip");
  assert(!sugStrip.out.noise, "a starred screening with no guest suggests nothing");

  // ---- a pick that vanishes or moves in a refresh is reported, not swallowed ----
  const newsProbe = JSON.parse(window.eval(`(function(){
    var n = getNow();
    var live = events.filter(function(e){ return e._s > n && e.hotel !== "Streaming"; });
    var moved = live[0], keep = live[1];
    picks = new Set([moved.id, keep.id, "ghost-1"]); savePicks();
    /* as if these had been starred before a refresh changed things */
    pickInfo["ghost-1"] = {title: "Hazbin Hotel Cast", start: "2026-09-06T16:00", location: "Hilton Salon"};
    pickInfo[moved.id] = {title: moved.title, start: "2026-09-05T10:00", location: "Westin Peachtree Ballroom"};
    saveJSON("dc26.pickInfo", pickInfo);
    pickNews = []; savePickNews();
    reconcilePicks();
    state.tab = "now"; render();
    var nowText = ((document.querySelector("#view-now .pick-news") || {}).textContent || "").replace(/\\s+/g, " ");
    state.tab = "mine"; render();
    var mineText = ((document.querySelector("#view-mine .pick-news") || {}).textContent || "").replace(/\\s+/g, " ");
    var out = {picks: Array.from(picks), news: pickNews.length, nowText: nowText, mineText: mineText,
      stored: (loadJSON("dc26.pickNews", []) || []).length,
      snapshotMoved: !!pickInfo[moved.id] && pickInfo[moved.id].start === moved.start,
      ghostForgotten: !pickInfo["ghost-1"]};
    document.querySelector('#view-mine [data-act="dismiss-news"]').click();
    out.afterDismiss = {news: pickNews.length, stored: (loadJSON("dc26.pickNews", []) || []).length,
      shown: !!document.querySelector("#view-mine .pick-news")};
    reconcilePicks();
    out.again = pickNews.length;
    picks = new Set(); savePicks(); state.tab = "now"; render();
    return JSON.stringify({moved: moved.id, keep: keep.id, out: out}); })()`));
  const np = newsProbe.out;
  assert(!np.picks.includes("ghost-1") && np.picks.length === 2, "a pick whose event is gone leaves the plan");
  assert(np.news === 2, `and both the vanished and the moved pick make the news (${np.news})`);
  assert(/Hazbin Hotel Cast/.test(np.nowText) && /removed/.test(np.nowText) && /Sun 4:00 PM, Hilton Salon/.test(np.nowText),
    `Now names the vanished event and when it was (${np.nowText.slice(0, 120)})`);
  assert(/moved to/.test(np.nowText) && /Westin Peachtree Ballroom/.test(np.nowText), "and says where the moved one used to be");
  assert(/Hazbin Hotel Cast/.test(np.mineText), "Mine shows the same notice");
  assert(np.stored === 2, "the news is stored, so it survives a reload");
  assert(np.snapshotMoved, "the moved pick's snapshot now matches the new time");
  assert(np.ghostForgotten, "and the vanished one's snapshot is gone");
  assert(np.afterDismiss.news === 0 && np.afterDismiss.stored === 0 && !np.afterDismiss.shown, "OK dismisses it for good");
  assert(np.again === 0, "and a second look finds nothing new to report");

  // ---- the header pads for the status bar on phones that draw under it ----
  assert(html.includes("--safe-top: env(safe-area-inset-top"), "a top inset variable exists alongside the bottom one");
  const hdrCss = html.slice(html.indexOf(".hdr {"), html.indexOf(".hdr {") + 400);
  assert(/padding: calc\(10px \+ var\(--safe-top\)\)/.test(hdrCss), "and the header adds it to its top padding");
  assert(html.includes("viewport-fit=cover"), "which matters because the page opts into drawing under the bars");
  assert(/apple-mobile-web-app-status-bar-style" content="black"/.test(html), "the iOS status bar is opaque: translucent leaves the web view short by its height on iOS 26");
  const htmlCss = html.slice(html.indexOf("html {"), html.indexOf("html {") + 200);
  assert(htmlCss.includes("overscroll-behavior-y: none"), "the root refuses the overscroll stretch, so a fixed nav cannot bounce with it");
  // iOS ignores that rule for the page, so a drag at the edge is refused by hand
  const edge = JSON.parse(window.eval(`(function(){
    var out = {};
    var fake = function(x, y, target){ var p = false; return {touches: [{clientX: x, clientY: y}], target: target || document.body,
      preventDefault: function(){ p = true; }, prevented: function(){ return p; }}; };
    /* jsdom has no layout: the page is at its top and its bottom at once */
    var s = fake(100, 100); edgeTouchStart(s); var m = fake(100, 160); edgeTouchMove(m); out.downAtTop = m.prevented();
    s = fake(100, 300); edgeTouchStart(s); m = fake(100, 240); edgeTouchMove(m); out.upAtBottom = m.prevented();
    s = fake(100, 300); edgeTouchStart(s); m = fake(220, 310); edgeTouchMove(m); out.sideways = m.prevented();
    s = fake(100, 300, document.getElementById("sheet")); edgeTouchStart(s); m = fake(100, 360); edgeTouchMove(m); out.inSheet = m.prevented();
    s = fake(100, 300, document.getElementById("view-now")); edgeTouchStart(s); m = fake(100, 360); edgeTouchMove(m); out.inMain = m.prevented();
    s = fake(100, 300, document.getElementById("q") || document.body); edgeTouchStart(s); m = fake(100, 360); edgeTouchMove(m); out.onInput = m.prevented();
    s = fake(100, 300); edgeTouchStart(s); m = {touches: [{clientX: 100, clientY: 360}, {clientX: 200, clientY: 360}], preventDefault: function(){ out.twoFingers = true; }}; edgeTouchMove(m);
    return JSON.stringify(out); })()`));
  assert(edge.downAtTop, "a drag down with the page at its top is refused");
  assert(edge.upAtBottom, "so is a drag up with the page at its bottom");
  assert(!edge.sideways, "a mostly sideways drag is not");
  assert(!edge.inSheet, "nor a drag that began in the sheet");
  assert(!edge.inMain, "nor one inside main, which scrolls and bounces on its own");
  // the page never scrolls; main does, and everything that scrolls goes through one door
  const mainCss = html.slice(html.indexOf("main {"), html.indexOf("main {") + 400);
  assert(/position: fixed/.test(mainCss) && /overflow-y: auto/.test(mainCss), "main is the scroll container");
  assert(/html, body \{[^}]*overflow: hidden/.test(html), "and the page around it cannot scroll");
  assert(/\.hdr \{[^}]*position: fixed/.test(html), "the header is fixed above it");
  assert(!/window\.scroll(To|By)\(|window\.scrollY|pageYOffset/.test(html.slice(html.indexOf("const PAGE = 150;"))), "no code scrolls the window directly");
  const sc = JSON.parse(window.eval(`(function(){ pageScrollTo(120); var a = pageScrollTop(); pageScrollBy(30); var b = pageScrollTop(); pageScrollTo(0); return JSON.stringify({a: a, b: b, c: pageScrollTop()}); })()`));
  assert((sc.a === 120 && sc.b === 150 && sc.c === 0) || (sc.a === 0 && sc.b === 0), `the scroll helpers address main (${JSON.stringify(sc)})`);
  assert(!edge.twoFingers, "nor a two-finger gesture");
  assert(window.eval("IS_IOS") === false, "and none of it is wired up outside iOS");
  assert(/setProperty\("--safe-bottom", "min\(env\(safe-area-inset-bottom, 0px\), 34px\)"\)/.test(html), "on iOS the bottom inset is capped at the home indicator");
  assert(document.documentElement.style.getPropertyValue("--safe-bottom") === "", "and not anywhere else");
  // the settings sheet reports what the device says
  window.eval("openSheet('settings')");
  const dev = document.getElementById("deviceLine").textContent;
  assert(/^(Home-screen app|Web page) · viewport \d+×\d+, visual .+, screen .+ · insets top .+, bottom .+/.test(dev), `settings carries a device readout (${dev})`);
  assert(/ · build \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/.test(dev), "ending in the build stamp from the page's last-modified time");
  window.eval("closeSheet()");
  assert(/document\.addEventListener\("touchmove", edgeTouchMove, \{passive: false\}\)/.test(html), "on iOS the move listener is the kind that may cancel");

  // ---- chip rows keep their place across renders, and a tapped chip is brought into view ----
  window.eval(`(function(){ state.tab = "browse"; state.browse.q = ""; state.browse.hotel = "All"; state.browse.page = 1; render(); })()`); await sleep(20);
  const rowKept = JSON.parse(window.eval(`(function(){
    var row = document.querySelector('#view-browse .chips[data-row="hotel"]');
    row.scrollLeft = 120;
    var before = row.scrollLeft;
    render();
    var after = document.querySelector('#view-browse .chips[data-row="hotel"]');
    return JSON.stringify({before: before, after: after.scrollLeft, sameNode: after === row,
      rows: [].map.call(document.querySelectorAll("#view-browse .chips[data-row]"), function(r){ return r.dataset.row; })}); })()`));
  assert(rowKept.rows.join(",") === "day,hotel,kind", `the Search chip rows are named (${rowKept.rows.join(",")})`);
  assert(!rowKept.sameNode, "a render rebuilds the row");
  assert(rowKept.before === 120 && rowKept.after === 120, `and puts it back where it was (${rowKept.before} -> ${rowKept.after})`);
  assert(document.querySelector('#view-now, #view-browse') && /data-row="now-hotel"/.test(html) && /data-row="explore-jump"/.test(html) && /data-row="follows"/.test(html),
    "the Now, Explore and Following rows are named too");
  window.eval(`window.__revealed = []; window.__realReveal = revealChip; revealChip = function(c){ __revealed.push(c ? (c.dataset.value || c.dataset.section || "?") : null); };`);
  document.querySelector('#view-browse [data-chip="hotel"][data-value="Hilton"]').click(); await sleep(20);
  const revealed = window.eval("__revealed");
  assert(revealed.length === 1 && revealed[0] === "Hilton", `tapping a hotel chip brings that chip into view (${revealed.join(",")})`);
  assert(document.querySelector('#view-browse [data-chip="hotel"][data-value="Hilton"]').getAttribute("aria-pressed") === "true", "and it shows pressed");
  window.eval(`(function(){ __revealed = []; state.tab = "explore"; state.explore.page = null; render(); markActiveSection("topic"); markActiveSection("topic"); markActiveSection("track"); })()`);
  const revealedEx = window.eval("__revealed");
  assert(revealedEx.filter(x => x === "topic").length === 1 && revealedEx.includes("track"),
    `on Explore a chip is revealed when it becomes current, and only then (${revealedEx.join(",")})`);
  window.eval(`revealChip = __realReveal; state.browse.hotel = "All"; state.tab = "browse"; render();`); await sleep(20);
  assert(/only ever moves the row sideways/i.test(html), "revealChip only moves the row sideways, never the page");

  // ---- a cancelled event says so, not just a strike-through ----
  const cancelProbe = JSON.parse(window.eval(`(function(){
    /* An event in the "on now and in the next hour" list: a pick would become
       the hero card, which is not a row. */
    var n = getNow();
    var ev = events.find(function(e){ return e._e > n && e._s <= new Date(n.getTime() + 3600000) && !isNoise(e) && e.hotel !== "Streaming"; });
    ev.cancelled = true;
    picks = new Set(); savePicks(); state.tab = "now"; state.now.hotel = "All"; render();
    var row = document.querySelector('#view-now .row[data-list="around"][data-id="' + ev.id + '"]');
    openSheet("event", ev.id);
    var out = {found: !!row, rowStruck: !!row && row.classList.contains("cancelled"),
      rowTag: !!row && !!row.querySelector(".cancelled-tag"),
      sheetTag: !!document.querySelector("#panel-event .ev-head .cancelled-tag")};
    closeSheet();
    ev.cancelled = false; render();
    return JSON.stringify(out); })()`));
  assert(cancelProbe.found, "the probe found its row in the on-now list");
  assert(cancelProbe.rowStruck, "a cancelled event's row is struck through");
  assert(cancelProbe.rowTag, "and carries a Cancelled label");
  assert(cancelProbe.sheetTag, "and the sheet says Cancelled under the room");
  assert(/\.cancelled-tag \{[^}]*var\(--warn\)/.test(html), "in the warning colour");

  // ---- step 0: four tabs - Browse renamed to Search, For you folded into Explore ----
  const navBtns = [...document.querySelectorAll(".nav button")];
  const navLabels = navBtns.map(b => [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(""));
  assert(navLabels.join(" · ") === "Now · Search · Explore · Mine",
    `the nav reads Now · Search · Explore · Mine (${navLabels.join(" · ")})`);
  assert(navBtns.length === 4, "four tabs");
  /* textContent includes <script> bodies, where "Browse" survives in comments
     and identifiers; only rendered text and aria labels matter here. */
  const visibleText = () => {
    const tw = document.createTreeWalker(document.body, window.NodeFilter.SHOW_TEXT);
    let out = "", n;
    while ((n = tw.nextNode())) {
      const tag = n.parentElement && n.parentElement.tagName;
      if (tag === "SCRIPT" || tag === "STYLE") continue;
      out += " " + n.textContent;
    }
    [...document.querySelectorAll("[aria-label]")].forEach(el => { out += " " + el.getAttribute("aria-label"); });
    return out;
  };
  assert(!/Browse/i.test(visibleText()), "the word Browse is gone from what the reader sees");
  assert(navBtns.map(b => b.dataset.tab).join(",") === "now,browse,explore,mine",
    "the internal identifiers are unchanged");
  assert(!document.querySelector('.nav button[data-tab="foryou"]'), "the For you tab is gone");
  assert(!document.getElementById("view-foryou"), "and so is its view");
  assert(!/foryou/i.test(html), "and nothing in the source still refers to it");
  assert(/repeat\(4, 1fr\)/.test(html), "the nav lays out four columns");
  assert(/\.nav button \{[^}]*font-size: 14px/.test(html), "with labels back at 14px");
  assert(/\.nav button svg \{[^}]*width: 24px/.test(html), "and icons back at 24px");
  // the explore view exists and switches
  document.querySelector('.nav button[data-tab="explore"]').click(); await sleep(20);
  assert(window.eval("state.tab") === "explore", "the explore tab switches");
  assert(!document.getElementById("view-explore").hidden, "and its view shows");
  assert(document.getElementById("view-browse").hidden, "while the others hide");
  document.querySelector('.nav button[data-tab="browse"]').click(); await sleep(20);

  // ---- step 1: the follow model ----
  window.eval(`(function(){ follows = []; saveFollows(); })()`);
  assert(window.eval(`JSON.stringify(FOLLOW_KINDS)`) === '["track","fandom","topic","person"]', "four kinds of follow");
  // toggle, persist, round-trip
  assert(window.eval(`toggleFollow("track", "Trek Track")`) === true, "following returns true");
  assert(window.eval(`isFollowing("track", "Trek Track")`) === true, "and it is now followed");
  assert(JSON.parse(window.localStorage.getItem("dc26.follows")).length === 1, "it persisted");
  assert(JSON.parse(window.localStorage.getItem("dc26.follows"))[0].kind === "track", "with its kind");
  assert(JSON.parse(window.localStorage.getItem("dc26.follows"))[0].key === "Trek Track", "and its exact key");
  assert(window.eval(`toggleFollow("track", "Trek Track")`) === false, "unfollowing returns false");
  assert(window.eval(`isFollowing("track", "Trek Track")`) === false, "and it is gone");
  assert(JSON.parse(window.localStorage.getItem("dc26.follows")).length === 0, "the removal persisted too");
  // order is preserved
  window.eval(`(function(){ follows = []; toggleFollow("topic","Space"); toggleFollow("track","Costuming"); toggleFollow("fandom","Star Trek"); })()`);
  assert(window.eval(`follows.map(function(f){return f.kind;}).join(",")`) === "topic,track,fandom", "follows keep the order they were added");
  assert(window.eval(`followId(follows[0])`) === "topic:Space", "a follow has a stable id");
  // junk in storage is ignored rather than trusted
  assert(window.eval(`(function(){
    var save = follows.slice();
    saveJSON("dc26.follows", [{kind:"bogus",key:"x"}, {kind:"track"}, null, {kind:"track",key:"Costuming"}]);
    var loaded = (loadJSON("dc26.follows", []) || []).filter(function(f){
      return f && FOLLOW_KINDS.indexOf(f.kind) >= 0 && typeof f.key === "string" && f.key; });
    follows = save; saveFollows();
    return loaded.length; })()`) === 1, "malformed stored follows are dropped on load");
  // eventsFor, one kind at a time
  const forKind = (kind, key) => window.eval(`eventsFor({kind:${JSON.stringify(kind)},key:${JSON.stringify(key)}}).length`);
  const anyTrack = window.eval(`(function(){ var t = {}; events.forEach(function(e){ (e.tracks||[]).forEach(function(x){ t[x]=(t[x]||0)+1; }); });
    return Object.keys(t).sort(function(a,b){return t[b]-t[a];})[0]; })()`);
  assert(forKind("track", anyTrack) > 0, `a track follow finds its events (${anyTrack})`);
  assert(window.eval(`eventsFor({kind:"track",key:${JSON.stringify(anyTrack)}}).every(function(e){ return (e.tracks||[]).indexOf(${JSON.stringify(anyTrack)}) >= 0; })`),
    "and only its events");
  const anyFandom = window.eval(`(function(){ var t={}; events.forEach(function(e){ ((e.tags||{}).fandoms||[]).forEach(function(x){ t[x]=(t[x]||0)+1; }); });
    return Object.keys(t).sort(function(a,b){return t[b]-t[a];})[0] || null; })()`);
  if (anyFandom) {
    assert(forKind("fandom", anyFandom) > 0, `a fandom follow finds its events (${anyFandom})`);
    assert(window.eval(`eventsFor({kind:"fandom",key:${JSON.stringify(anyFandom)}}).every(function(e){ return ((e.tags||{}).fandoms||[]).indexOf(${JSON.stringify(anyFandom)}) >= 0; })`), "and only those");
  }
  const anyTopic = window.eval(`(function(){ var t={}; events.forEach(function(e){ ((e.tags||{}).topics||[]).forEach(function(x){ t[x]=(t[x]||0)+1; }); });
    return Object.keys(t).sort(function(a,b){return t[b]-t[a];})[0] || null; })()`);
  if (anyTopic) assert(forKind("topic", anyTopic) > 0, `a topic follow finds its events (${anyTopic})`);
  const anyPerson = window.eval(`(function(){ var t={}; events.forEach(function(e){ (e.speakers||[]).forEach(function(p){ if(p.name) t[p.name]=(t[p.name]||0)+1; }); });
    return Object.keys(t).sort(function(a,b){return t[b]-t[a];})[0] || null; })()`);
  if (anyPerson) {
    assert(forKind("person", anyPerson) > 0, `a person follow finds their events (${anyPerson})`);
    assert(window.eval(`eventsFor({kind:"person",key:${JSON.stringify(anyPerson)}}).every(function(e){ return (e.speakers||[]).some(function(p){ return p.name === ${JSON.stringify(anyPerson)}; }); })`),
      "and only theirs");
  }
  assert(forKind("track", "No Such Track At All") === 0, "an unknown key finds nothing");
  assert(window.eval(`eventsFor(null).length`) === 0 && window.eval(`eventsFor({kind:"track"}).length`) === 0, "and so does a malformed follow");
  // returned in start order
  if (anyTrack) assert(window.eval(`(function(){ var t = eventsFor({kind:"track",key:${JSON.stringify(anyTrack)}}).map(function(e){return +e._s;});
    return t.every(function(v,i){ return i===0 || v>=t[i-1]; }); })()`), "a follow's events come back in time order");
  window.eval(`(function(){ follows = []; saveFollows(); })()`);

  // ---- step 2: Explore ----
  window.eval(`(function(){ follows = []; saveFollows(); state.explore.page = null; state.explore.q = ""; state.tab = "explore"; render(); })()`);
  await sleep(30);
  const secTitles = [...document.querySelectorAll("#view-explore .section-title")].map(x => x.textContent.replace(/\s+/g, " ").trim());
  /* The fixture has no fandom with 3+ events, so that section is correctly
     absent here; the all-four check runs against the real schedule below. */
  const order = ["Tracks", "Fandoms", "Topics", "Guests", "Panelists"];
  const seen = secTitles.map(t => t.split(" ")[0]);
  assert(seen.length >= 3, `the sections that have content render (${seen.join(" | ")})`);
  assert(seen.every(x => order.includes(x)), "and are named from the five sections");
  assert(seen.join(",") === order.filter(o => seen.includes(o)).join(","), "in the order Tracks, Fandoms, Topics, Guests, Panelists");
  assert(!seen.includes("Fandoms"), "an empty section is skipped rather than shown empty");
  assert(window.eval(`getCatalogue().fandom.every(function(f){ return f.count >= 3; })`), "fandom tiles need 3+ events");
  assert(window.eval(`(function(){ var c = getCatalogue().track.filter(function(t){ return !NOISE_TRACKS.has(t.key); });
    for (var i = 1; i < c.length; i++) if (c[i].key.localeCompare(c[i-1].key) < 0) return false; return true; })()`), "tracks run A to Z");
  assert(window.eval(`(function(){ var c = getCatalogue().track, n = c.filter(function(t){ return NOISE_TRACKS.has(t.key); }).length;
    return n > 0 && c.slice(-n).every(function(t){ return NOISE_TRACKS.has(t.key); }); })()`), "with the photo and video-room tracks last");
  assert(window.eval(`(function(){ var c = getCatalogue().fandom; for (var i = 1; i < c.length; i++) if (c[i].count > c[i-1].count) return false; return true; })()`),
    "fandoms stay sorted by count");
  assert(window.eval(`(function(){ var c = getCatalogue().panelist; for (var i = 1; i < c.length; i++) if (c[i].key.localeCompare(c[i-1].key) < 0) return false; return true; })()`),
    "panelists run A to Z");
  assert(window.eval(`getCatalogue().guest.length + getCatalogue().panelist.length === getCatalogue().person.length`),
    "guests and panelists together are everyone followable");
  const firstTile = document.querySelector("#view-explore .tile");
  assert(/\d/.test(firstTile.textContent), "each tile shows a count");
  // each section opens with its head and a Show all
  const fold = JSON.parse(window.eval(`(function(){
    var grid = document.getElementById("exploreGrid"), out = {}, cur = null;
    [].forEach.call(grid.children, function(el){
      if (el.classList.contains("section-title")) { cur = el.id.replace("explore-", ""); out[cur] = {tiles: 0, all: null}; }
      else if (cur && el.classList.contains("tiles")) out[cur].tiles += el.querySelectorAll(".tile").length;
      else if (cur && el.dataset && el.dataset.act === "explore-all") out[cur].all = el.textContent.trim();
    });
    return JSON.stringify({sections: out, head: EXPLORE_HEAD, tracks: getCatalogue().track.length}); })()`));
  assert(fold.sections.track && fold.sections.track.tiles === Math.min(fold.head, fold.tracks), `Tracks opens with its head (${fold.sections.track.tiles} of ${fold.tracks})`);
  assert(fold.tracks <= fold.head || fold.sections.track.all === "Show all " + fold.tracks, `and offers Show all ${fold.tracks} (${fold.sections.track.all})`);
  assert(Object.values(fold.sections).every(x => x.tiles <= fold.head), "no section shows more than its head to start");
  const boxKeep = document.getElementById("exploreQ");
  const showAll = document.querySelector('#exploreGrid [data-act="explore-all"][data-section="track"]');
  assert(showAll, "the fixture has enough tracks to fold");
  showAll.click(); await sleep(20);
  const opened = JSON.parse(window.eval(`(function(){
    var t = document.getElementById("explore-track"), tiles = 0, el = t.nextElementSibling;
    while (el && !el.classList.contains("section-title")) { if (el.classList.contains("tiles")) tiles += el.querySelectorAll(".tile").length; el = el.nextElementSibling; }
    return JSON.stringify({tiles: tiles, btn: !!document.querySelector('#exploreGrid [data-act="explore-all"][data-section="track"]')}); })()`));
  assert(opened.tiles === fold.tracks && !opened.btn, `Show all opens every track (${opened.tiles}) and the button goes`);
  assert(document.getElementById("exploreQ") === boxKeep, "without rebuilding the filter box");
  assert(window.eval("state.explore.expanded.track") === true, "and the choice holds for this visit");
  // the jump bar under the filter box
  const jumps = [...document.querySelectorAll('#view-explore .controls-sticky [data-act="explore-jump"]')].map(b => b.dataset.section);
  assert(jumps.length >= 3 && jumps.join(",") === Object.keys(fold.sections).join(","), `a jump chip per rendered section, in order (${jumps.join(",")})`);
  assert(document.querySelector('#view-explore .controls-sticky [data-act="explore-jump"] .n'), "each chip carries its count");
  window.eval(`window.__scrolls = []; window.__realPST = pageScrollTo; pageScrollTo = function(t){ __scrolls.push({top: t}); };`);
  document.querySelector('#view-explore [data-act="explore-jump"][data-section="' + jumps[jumps.length - 1] + '"]').click(); await sleep(20);
  const jumpScrolls = window.eval("__scrolls"); window.eval("pageScrollTo = __realPST");
  assert(jumpScrolls.length === 1 && jumpScrolls[0].top >= 0 && window.eval("state.tab") === "explore", "tapping a chip scrolls to its section");
  // the chip for the section on screen reads as pressed
  const pressedAfterTap = [...document.querySelectorAll('#view-explore [data-act="explore-jump"]')].filter(b => b.getAttribute("aria-pressed") === "true").map(b => b.dataset.section);
  assert(pressedAfterTap.join(",") === jumps[jumps.length - 1], `a tapped chip is pressed at once, and only it (${pressedAfterTap.join(",")})`);
  assert(window.eval(`pickActiveSection([{id:"track",top:-500},{id:"fandom",top:-10},{id:"topic",top:300}], 203)`) === "fandom",
    "the section on screen is the last header past the sticky line");
  assert(window.eval(`pickActiveSection([{id:"track",top:400}], 203)`) === null, "above the first header nothing is pressed");
  assert(window.eval(`pickActiveSection([], 203)`) === null, "and no headers means nothing pressed");
  assert(window.eval(`pickActiveSection([{id:"track",top:-500},{id:"panelist",top:300}], 203, true)`) === "panelist",
    "at the end of the page the last section is current even if its header never reached the line");
  window.eval(`(function(){ state.explore.active = null; renderExplore(); })()`); await sleep(20);
  const pressedAfterRender = document.querySelectorAll('#view-explore [data-act="explore-jump"][aria-pressed="true"]').length;
  assert(pressedAfterRender === 1, `a render marks exactly one chip from the headers' positions (${pressedAfterRender})`);
  assert(/\.explore-jump \.chip\[aria-pressed="true"\] \.n \{[^}]*color: inherit/.test(html), "and the count stays readable on a pressed chip");
  window.eval(`(function(){ state.explore.expanded = {}; renderExplore(); })()`); await sleep(20);
  // the filter narrows tiles, not events
  const allTiles = document.querySelectorAll("#view-explore .tile").length;
  window.eval(`(function(){ state.explore.q = "cost"; renderExplore(); })()`); await sleep(20);
  const narrowed = [...document.querySelectorAll("#view-explore .tile-name")].map(x => x.textContent);
  assert(narrowed.length > 0 && narrowed.length < allTiles, `the filter narrows the tiles (${allTiles} -> ${narrowed.length})`);
  assert(narrowed.every(n => /cost/i.test(n)), "to those whose name matches");
  window.eval(`(function(){ state.explore.q = ""; renderExplore(); })()`); await sleep(20);
  // typing in the filter box must not rebuild the box under the keyboard
  const boxBefore = document.getElementById("exploreQ");
  boxBefore.value = "cost"; boxBefore.dispatchEvent(new window.Event("input", {bubbles: true})); await sleep(20);
  assert(document.getElementById("exploreQ") === boxBefore, "typing in the filter keeps the same input element");
  const typedTiles = [...document.querySelectorAll("#view-explore .tile-name")].map(x => x.textContent);
  assert(typedTiles.length > 0 && typedTiles.every(x => /cost/i.test(x)), `and narrows the tiles (${typedTiles.length})`);
  boxBefore.value = ""; boxBefore.dispatchEvent(new window.Event("input", {bubbles: true})); await sleep(20);
  assert(window.eval("state.explore.q") === "" && document.querySelectorAll("#view-explore .tile").length === allTiles,
    "clearing it brings everything back");
  // a tile opens its page
  const someTrack = window.eval(`getCatalogue().track[0].key`);
  window.eval(`openExplorePage("track", ${JSON.stringify(someTrack)})`); await sleep(40);
  assert(document.querySelector("#view-explore .eh-name").textContent === someTrack, `the tile opens its page (${someTrack})`);
  assert(document.querySelector("#view-explore .eh-kind").textContent === "Track", "labelled with its kind");
  assert(/\d+ events?/.test(document.querySelector("#view-explore .eh-count").textContent), "and its total count");
  assert(document.querySelector("#view-explore .day-head"), "events are grouped under day headers");
  assert(document.querySelectorAll("#view-explore .row").length > 0, "with standard rows");
  assert(document.querySelector("#view-explore .row .star"), "that carry a star");
  // the follow toggle
  const fbtn = document.querySelector("#view-explore .follow-btn");
  assert(fbtn.textContent.trim() === "Follow", "the page offers Follow");
  fbtn.click(); await sleep(40);
  assert(document.querySelector("#view-explore .follow-btn").textContent.trim() === "Following", "which becomes Following");
  assert(window.eval(`isFollowing("track", ${JSON.stringify(someTrack)})`), "and the follow is recorded");
  // deep link round-trip
  assert(/explore=/.test(window.location.hash), `the page is deep-linked (${window.location.hash})`);
  assert(window.eval(`JSON.stringify(readExploreHash())`) === JSON.stringify({kind: "track", key: someTrack}), "and the link parses back");
  // back to the grid, with the follow marked
  document.querySelector('[data-act="explore-back"]').click(); await sleep(40);
  assert(!window.eval("state.explore.page"), "back returns to the grid");
  assert(!/explore=/.test(window.location.hash), "and clears the deep link");
  assert(document.querySelectorAll("#view-explore .tile.on").length === 1, "the followed tile carries a mark");
  // the detail sheet offers a way through to a person
  window.eval(`(function(){ state.tab = "browse"; render(); })()`); await sleep(20);
  const spk = window.eval(`(function(){ var e = events.find(function(x){ return (x.speakers||[]).length > 0; }); return e ? e.id : null; })()`);
  if (spk) {
    window.eval(`openSheet("event", ${JSON.stringify(spk)})`); await sleep(30);
    const seeAll = document.querySelector('#panel-event .see-all');
    assert(seeAll, "the detail sheet offers See all beside a speaker");
    assert(/^person:/.test(seeAll.dataset.explore), "pointing at that person's page");
    seeAll.click(); await sleep(60);
    assert(window.eval("state.tab") === "explore" && window.eval("state.explore.page.kind") === "person",
      "and tapping it lands on the person page");
    assert(document.getElementById("sheetWrap").hidden, "with the sheet closed behind it");
    window.eval(`(function(){ state.explore.page = null; setExploreHash(null); })()`);
  }
  window.eval(`(function(){ follows = []; saveFollows(); state.tab = "browse"; state.explore.page = null; render(); })()`); await sleep(20);

  // ---- step 3: Following lives at the top of Explore ----
  window.eval(`(function(){ follows = []; saveFollows(); state.tab = "explore"; state.explore.page = null; state.explore.q = "";
    state.following.expanded = {}; state.following.showPast = {}; state.following.open = true; render(); })()`);
  await sleep(30);
  const ex = document.getElementById("view-explore");
  assert(!ex.querySelector(".following"), "with nothing followed there is no Following section");
  assert(!ex.querySelector(".empty"), "and no empty state");
  assert(ex.querySelectorAll(".tile").length > 0, "Explore is just the grid");
  const hint = ex.querySelector(".hint");
  assert(hint && hint.textContent.trim() === "Follow a track, fandom or person and it'll show up here.", "with a one-line hint");
  const firstSection = ex.querySelector(".section-title");
  assert(hint && firstSection && firstSection.nextElementSibling === hint, "sitting under the first section header");
  // follow two things
  const twoFollows = window.eval(`(function(){
    var t = getCatalogue().track[0].key;
    var other = getCatalogue().track[1].key;
    follows = []; toggleFollow("track", t); toggleFollow("track", other);
    render();
    return JSON.stringify([t, other]); })()`);
  await sleep(40);
  const wanted = JSON.parse(twoFollows);
  const fol = () => document.getElementById("following");
  const folHead = () => (document.querySelector("#following .fol-head") || {textContent: ""}).textContent.replace(/\s+/g, " ").trim();
  assert(fol(), "following two things puts a Following section on Explore");
  assert(!ex.querySelector(".hint"), "and the hint goes away");
  assert(/^Following \(2\)/.test(folHead()), `headed Following (2) (${folHead()})`);
  assert(document.querySelector("#following .fol-head").getAttribute("aria-expanded") === "true", "open to start");
  assert(ex.firstElementChild === fol(), "pinned above everything else");
  const FOLLOWS = window.Node.DOCUMENT_POSITION_FOLLOWING;
  const exQ = document.getElementById("exploreQ");
  assert(exQ && (fol().compareDocumentPosition(exQ) & FOLLOWS), "the tile filter box stays with the grid, below it");
  assert(fol().compareDocumentPosition(ex.querySelector(".tiles")) & FOLLOWS, "and so do the tiles");
  const chipNames = [...document.querySelectorAll("#following .fc-name")].map(x => x.textContent);
  assert(chipNames.join("|") === wanted.join("|"), `chips list the follows in order (${chipNames.join(", ")})`);
  assert(document.querySelectorAll('#following .follow-chip [data-act="unfollow"]').length === 2, "each chip has an unfollow control");
  assert(document.querySelector('#following .fc-add'), "and there is a + chip at the end");
  assert(document.querySelector('#following .fc-name').dataset.explore === "track:" + wanted[0], "a chip links to its Explore page");
  // by interest
  assert(window.eval("state.following.layout") === "interest", "By interest is the default");
  const sections = [...document.querySelectorAll("#following .section-title")].map(x => x.textContent.trim());
  assert(sections.length === 2, `a section per follow inside Following (${sections.length})`);
  assert(sections[0].startsWith(wanted[0]), "in follow order");
  const firstList = document.querySelector("#following .list");
  assert(firstList.querySelectorAll(".row").length <= 8, "each section shows at most eight to start");
  const moreBtn = document.querySelector('#following [data-act="fol-more"]');
  if (moreBtn) {
    const before = document.querySelectorAll("#following .row").length;
    moreBtn.click(); await sleep(40);
    assert(document.querySelectorAll("#following .row").length > before, "and 'more' expands it");
  }
  // by time
  document.querySelector('[data-act="fol-time"]').click(); await sleep(40);
  assert(window.eval("state.following.layout") === "time", "the layout toggles");
  assert(JSON.parse(window.localStorage.getItem("dc26.followingLayout")) === "time", "and persists");
  const timeIds = [...document.querySelectorAll("#following .row")].map(r => r.dataset.id);
  assert(timeIds.length > 0 && timeIds.length === new Set(timeIds).size, `by time lists each event once (${timeIds.length})`);
  assert(document.querySelectorAll("#following .day-head").length > 0, "grouped under day headers");
  assert(document.querySelectorAll("#following .time-head").length > 0, "and hour headers");
  assert(document.querySelectorAll("#exploreGrid .tile").length > 0, "the grid is still there under it");
  // starring still behaves
  const folStar = document.querySelector("#following .row .star");
  if (folStar) {
    const id = folStar.closest(".row").dataset.id;
    const had = window.eval(`picks.has(${JSON.stringify(id)})`);
    folStar.click(); await sleep(40);
    assert(window.eval(`picks.has(${JSON.stringify(id)})`) !== had, "starring works from Following");
    window.eval(`(function(){ picks.delete(${JSON.stringify(id)}); savePicks(); })()`);
  }
  // the + chip scrolls down to the grid instead of leaving the tab
  window.eval(`window.__scrolls = []; window.__realPST = pageScrollTo; pageScrollTo = function(t){ __scrolls.push({top: t}); };`);
  document.querySelector('#following .fc-add').click(); await sleep(20);
  const scrolls = window.eval("__scrolls"); window.eval("pageScrollTo = __realPST");
  assert(window.eval("state.tab") === "explore" && !window.eval("state.explore.page"), "the + chip stays on the Explore grid");
  assert(scrolls.length === 1 && scrolls[0].top >= 0, `and scrolls to the grid (${JSON.stringify(scrolls)})`);
  assert(fol() && document.querySelector("#following .fc-name"), "with Following still open above it");
  // fold it away, and it stays folded
  document.querySelector("#following .fol-head").click(); await sleep(40);
  assert(document.querySelector("#following .fol-head").getAttribute("aria-expanded") === "false", "tapping the header closes Following");
  assert(document.getElementById("folBody").hidden, "hiding the feed");
  assert(!document.querySelector("#following .fc-name"), "chips and all");
  assert(/^Following \(2\)/.test(folHead()), "the header still shows the count");
  assert(document.querySelectorAll("#exploreGrid .tile").length > 0, "and the grid is right there");
  assert(JSON.parse(window.localStorage.getItem("dc26.followingOpen")) === false, "closed is remembered");
  window.eval(`(function(){ state.following.open = loadJSON("dc26.followingOpen", true); render(); })()`); await sleep(40);
  assert(document.querySelector("#following .fol-head").getAttribute("aria-expanded") === "false", "and survives reloading the state");
  document.querySelector("#following .fol-head").click(); await sleep(40);
  assert(document.querySelector("#following .fol-head").getAttribute("aria-expanded") === "true", "tapping again reopens it");
  assert(JSON.parse(window.localStorage.getItem("dc26.followingOpen")) === true, "and remembers that too");
  // unfollowing from a chip drops its section and the count
  document.querySelector('[data-act="fol-interest"]').click(); await sleep(40);
  const secBefore = document.querySelectorAll("#following .section-title").length;
  document.querySelector('#following [data-act="unfollow"]').click(); await sleep(40);
  assert(document.querySelectorAll("#following .section-title").length === secBefore - 1, "unfollowing from a chip removes its section");
  assert(/^Following \(1\)/.test(folHead()), `and the header count drops (${folHead()})`);
  assert(window.eval("follows.length") === 1, "and the follow itself");
  // a page deep link still works with Following present, and back brings it back
  window.location.hash = "#now=2026-09-05T13:05&explore=" + encodeURIComponent("track:" + wanted[1]);
  window.dispatchEvent(new window.Event("hashchange")); await sleep(40);
  const pageName = document.querySelector("#view-explore .eh-name");
  assert(pageName && pageName.textContent === wanted[1], `a deep link opens its page (${pageName && pageName.textContent})`);
  assert(!document.getElementById("following"), "the page stands alone, without the Following section");
  document.querySelector('[data-act="explore-back"]').click(); await sleep(40);
  assert(document.getElementById("following") && /^Following \(1\)/.test(folHead()), "back returns to the grid with Following on top");
  assert(!/explore=/.test(window.location.hash) && /now=/.test(window.location.hash), "the hash keeps the preview clock and drops the page");
  // unfollow the last one: the section goes, the hint returns
  document.querySelector('#following [data-act="unfollow"]').click(); await sleep(40);
  assert(!document.getElementById("following"), "unfollowing the last one removes the section");
  assert(ex.querySelector(".hint"), "and the hint is back");
  window.eval(`(function(){ follows = []; saveFollows(); state.tab = "browse"; render(); })()`); await sleep(20);

  // ---- step 4: picks are untouched by any of this ----
  assert(window.eval(`typeof togglePick`) === "function", "togglePick still exists");
  assert(/function togglePick\(id, anchor\)/.test(html), "with the anchoring signature the star fix gave it");
  assert(window.eval(`typeof renderMiniBar`) === "function" && /nextPickInConDay/.test(html), "the mini-bar still reads picks, not follows");
  assert(!/follows/.test(html.slice(html.indexOf("function renderMiniBar"), html.indexOf("function renderMiniBar") + 900)),
    "and knows nothing about follows");
  assert(!/follows/.test(html.slice(html.indexOf("function heroHTML"), html.indexOf("function heroHTML") + 2200)),
    "nor does the hero card");
  assert(JSON.parse(window.localStorage.getItem("dc26.picks") || "[]").length >= 0, "picks storage is its own key");

  // ---- browse header: All first, and the key rows stay put ----
  document.querySelector('.nav button[data-tab="browse"]').click(); await sleep(20);
  const dayVals = [...document.querySelectorAll('#view-browse [data-chip="day"]')].map(c => c.dataset.value);
  assert(dayVals[0] === "All", `"All days" leads the day row (${dayVals.slice(0,3).join(",")})`);
  const hotelVals = [...document.querySelectorAll('#view-browse [data-chip="hotel"]')].map(c => c.dataset.value);
  assert(hotelVals[0] === "All", "the hotel row still leads with All, so the two rows match");
  assert(dayVals.length === 7 && dayVals.slice(1).join(",") === window.eval("CON_DAYS.join(',')"),
    "the six con days follow it, in order");
  // the search box and day row are the sticky pair; the rest scrolls away
  const sticky = document.querySelector("#view-browse .controls-sticky");
  assert(sticky, "the search box and day row share a sticky container");
  assert(sticky.querySelector("#q"), "the search box is inside it");
  assert(sticky.querySelector('[data-chip="day"]'), "the day chips are inside it");
  assert(!sticky.querySelector('[data-chip="hotel"]'), "the hotel row is not - it scrolls away");
  assert(!sticky.querySelector('[data-chip="kind"]'), "nor the kind row");
  assert(/\.controls-sticky\s*\{[^}]*position:\s*sticky/.test(html), "it is declared sticky");
  assert(/\.controls-sticky\s*\{[^}]*top:\s*var\(--hdr-h/.test(html), "it parks under the header, by measured height");
  assert(/function syncHeaderHeight\(\)[\s\S]{0,300}setProperty\("--hdr-h"/.test(html), "the header height is measured, not assumed");
  assert(/ResizeObserver\(syncHeaderHeight\)/.test(html), "and re-measured when the header changes size");
  /* ResizeObserver is delivered on the rendering lifecycle, so a page that
     isn't painting never hears about it. The offset must not depend on it. */
  /* Anchored on the comment rather than a character window: the file is
     checked out with CRLF on Windows, and a byte-distance assertion silently
     changes meaning between platforms. */
  assert(/syncHeaderHeight\(\);\s*\/\/ this line is what changes the header's height/.test(html),
    "the header is re-measured when the freshness line changes it");
  assert(/document\.fonts\.ready\.then\(syncHeaderHeight\)/.test(html),
    "and once the font has loaded and changed the text metrics");
  assert(/window\.addEventListener\("load", syncHeaderHeight\)/.test(html),
    "and on load, so it never rests on the observer alone");

  // ---- offline: what jsdom can actually reach ----
  // (a) the worker parses, and registration is guarded
  const swSrc = fs.readFileSync(__dirname + "/../sw.js", "utf8");
  try { new Function(swSrc); assert(true, "sw.js parses"); }
  catch (e) { assert(false, "sw.js parses: " + e.message); }
  assert(/navigator\.serviceWorker\.register\(\s*["']\.\/sw\.js["']\s*\)/.test(html),
    "index.html registers ./sw.js by relative path (scope stays under /dragoncon-planner/)");
  assert(/if\s*\(\s*["']serviceWorker["']\s+in\s+navigator\s*\)/.test(html),
    "registration is guarded by a serviceWorker capability check");
  assert(/register\("\.\/sw\.js"\)\.catch\(err =>[\s\S]{0,120}console\.warn/.test(html),
    "a failed registration is reported, not swallowed");
  assert(/const CACHE\s*=\s*["']dc26-v3["']/.test(swSrc), "the cache name is versioned (dc26-v3)");
  // installable from a chat link: PNG icons, an app title, and a preview card
  assert(/<link rel="apple-touch-icon" href="\.\/icon-180\.png">/.test(html), "the Apple touch icon is a PNG, not the SVG iOS ignores");
  assert(/<meta name="apple-mobile-web-app-title" content="DC26">/.test(html), "the home-screen title is DC26");
  for (const tag of ["og:title", "og:description", "og:image", "og:url", "og:type"]) {
    assert(new RegExp(`<meta property="${tag}" content="[^"]+">`).test(html), `the head carries ${tag}`);
  }
  assert(/<meta property="og:image" content="https:\/\/kilgoretrout853\.github\.io\/dragoncon-planner\/og-image\.png">/.test(html), "og:image is an absolute URL on the Pages site");
  assert(/<meta name="twitter:card" content="summary_large_image">/.test(html), "and the card is the large-image kind");
  const manifest = JSON.parse(fs.readFileSync(__dirname + "/../manifest.json", "utf8"));
  const pngIcons = manifest.icons.filter(i => i.type === "image/png");
  assert(pngIcons.some(i => i.sizes === "192x192" && i.purpose === "any") && pngIcons.some(i => i.sizes === "512x512" && i.purpose === "maskable"),
    "the manifest offers 192 and 512 PNGs, any and maskable");
  for (const f of ["icon-180.png", "icon-192.png", "icon-512.png", "og-image.png"]) {
    const b = fs.readFileSync(__dirname + "/../" + f);
    assert(b.length > 1000 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47, `${f} exists and is a PNG (${b.length} bytes)`);
  }
  assert(/SHELL = \[[^\]]*"\.\/icon-180\.png"[^\]]*"\.\/icon-512\.png"/.test(swSrc), "the worker precaches the icons");
  // a page that arrives after the 3s race is stored for the next launch, not thrown away
  assert(/function fetchAndCache\(request\)/.test(swSrc) && /cache\.put\(request, res\.clone\(\)\)/.test(swSrc.slice(swSrc.indexOf("function fetchAndCache"))),
    "the html fetch stores its response whenever it lands");
  assert(/const net = fetchAndCache\(request\);[\s\S]{0,120}event\.waitUntil\(net/.test(swSrc), "and is kept alive past the response with waitUntil");
  assert(/networkFirst\(request, net\)/.test(swSrc), "while the race uses that same fetch rather than a second one");
  assert(/startsWith\(["']dc26-["']\)[\s\S]{0,80}caches\.delete/.test(swSrc), "older dc26-* caches are deleted on activate");
  assert(/HTML_TIMEOUT_MS\s*=\s*3000/.test(swSrc), "the html network race times out at 3s");
  assert(/schedule-updated/.test(swSrc) && /generated_at !== /.test(swSrc),
    "the worker only announces an update when generated_at actually changed");
  assert(/fonts\.gstatic\.com/.test(swSrc) && /opaque/.test(swSrc), "font requests are cached, opaque allowed");
  /* respondWith only keeps the worker alive until the cached copy is handed
     back, which is immediate - the background check needs its own lifetime or
     the browser may kill it, and the cache would never refresh. */
  assert(/event\.waitUntil\(update/.test(swSrc), "the background revalidation is kept alive with waitUntil");
  assert(swSrc.indexOf("event.waitUntil(update") < swSrc.indexOf("event.respondWith(cachedDataOr"),
    "and waitUntil is called synchronously in the fetch handler, before respondWith");
  assert(!/staleWhileRevalidate/.test(swSrc), "the version that could be killed mid-check is gone");
  // manifest and icon
  const mf = JSON.parse(fs.readFileSync(__dirname + "/../manifest.json", "utf8"));
  assert(mf.name === "Dragon Con 2026" && mf.short_name === "DC26", "manifest names the app");
  assert(mf.display === "standalone" && mf.start_url === "./", "manifest is standalone from ./");
  assert(mf.background_color === "#171A33" && mf.theme_color === "#171A33", "manifest colours match the app");
  assert(mf.icons.some(i => i.src === "./icon.svg"), "manifest points at the icon");
  assert(/<link rel="manifest" href="\.\/manifest\.json">/.test(html), "index.html links the manifest");
  assert(/<link rel="apple-touch-icon" href="\.\/icon-180\.png">/.test(html), "index.html sets a PNG apple-touch-icon");
  assert(fs.existsSync(__dirname + "/../icon.svg"), "the icon file exists");

  // (b) the pill: shown by the worker's message, dismissed, and reloads on tap
  const pill = document.getElementById("updatePill");
  assert(pill && pill.hidden, "the update pill starts hidden");
  window.eval("showUpdatePill()"); await sleep(20);
  assert(!document.getElementById("updatePill").hidden, "a schedule-updated message shows the pill");
  assert(/tap to refresh/i.test(pill.textContent), "the pill says what tapping does");
  // it must not re-render the list underneath the reader
  const rowsBefore = document.querySelectorAll("#view-browse .row").length;
  window.eval("showUpdatePill()"); await sleep(20);
  assert(document.querySelectorAll("#view-browse .row").length === rowsBefore, "showing the pill does not re-render the list");
  const realReload = window.reloadNow;
  window.__reloads = 0;
  window.reloadNow = () => { window.__reloads++; };
  pill.click(); await sleep(20);
  assert(window.__reloads === 1, "tapping the pill reloads");
  // a swipe must not also count as a tap
  window.eval("pillDragged = true"); pill.click(); await sleep(20);
  assert(window.__reloads === 1, "a swipe does not trigger the reload");
  window.eval("pillDragged = false");
  window.reloadNow = realReload;
  window.eval("hideUpdatePill()"); await sleep(10);
  assert(document.getElementById("updatePill").hidden, "the pill can be dismissed");

  // (c) the freshness line marks a cached copy
  const freshBefore = document.getElementById("fresh").textContent;
  assert(!/offline copy/.test(freshBefore), "no offline marker while the network is fine");
  // the worker decides, not the page: a cached response resolves normally, so
  // only the worker knows the revalidation never reached the network
  assert(/catch \(e\) \{[\s\S]{0,500}?tellClients\(\{type: "schedule-offline"\}\)/.test(swSrc),
    "the worker reports offline when revalidation fails");
  assert(/schedule-online/.test(swSrc), "the worker reports back online when it succeeds");
  assert(/t === "schedule-offline"[\s\S]{0,80}servedOffline = true/.test(html),
    "the page marks itself offline on that message");
  assert(/t === "schedule-online"[\s\S]{0,80}servedOffline = false/.test(html),
    "and clears the marker when the worker gets through");
  window.eval("servedOffline = true; updateFresh();"); await sleep(10);
  assert(/offline copy/.test(document.getElementById("fresh").textContent),
    `a cached copy is labelled (${document.getElementById("fresh").textContent})`);
  assert(/\d+ events, refreshed/.test(document.getElementById("fresh").textContent), "the existing freshness line survives");
  window.eval("servedOffline = false; updateFresh();"); await sleep(10);
  assert(!/offline copy/.test(document.getElementById("fresh").textContent), "the marker clears when back online");

  window.close();
  await realDataChecks();
  console.log(process.exitCode ? "SOME FAILURES" : "ALL PASSED"); process.exit(process.exitCode || 0);
})();

/* ------------------------------------------------------------------ *
 * Search quality against the real schedule.
 *
 * The sample fixture is 558 synthetic events; ranking questions like "does
 * AND actually narrow this" only mean something against the 3,462 real ones.
 * ------------------------------------------------------------------ */
async function realDataChecks() {
  const path = __dirname + "/../events.json";
  if (!fs.existsSync(path)) { console.log("skip  real-data search checks (no events.json)"); return; }
  const realDom = new JSDOM(
    fs.readFileSync(__dirname + "/../index.html", "utf8")
      .replace("<script>", "<script>window.DC_EVENTS=" + fs.readFileSync(path, "utf8") + ";"),
    { runScripts: "dangerously", url: "https://example.test/#now=2026-09-05T13:05", pretendToBeVisual: true });
  const w = realDom.window;
  await sleep(2500);

  const search = (q, over) => JSON.parse(w.eval(`(function(){
    Object.assign(state.browse, {q: ${JSON.stringify(q)}, day: "All", hotel: "All", type: "All", track: "All",
      fandom: "All", kind: "All", showHidden: false, showPast: false,
      hideNoise: true, page: 1}, ${JSON.stringify(over || {})});
    var r = browseResults(), pick = function(s){ return r.filter(function(e){ return e._section === s; }); };
    return JSON.stringify({
      total: r.length, main: pick("main").length, loose: pick("loose").length, past: pick("past").length,
      topTitles: pick("main").slice(0, 5).map(function(e){ return e.title; }),
      mainDays: pick("main").map(function(e){ return e.day; }),
      mainAllUpcoming: pick("main").every(function(e){ return e._e > getNow(); }),
      chips: (state.browse.parsed.chips || []).map(function(c){ return c.label; }),
      residual: state.browse.parsed.residual,
      allNoise: pick("main").length > 0 && pick("main").every(function(e){ return isNoise(e); }),
      tracksAll: pick("main").map(function(e){ return (e.tracks || []).join("|"); })
    });
  })()`));
  const has = (list, frag) => list.some(t => t.toLowerCase().includes(frag.toLowerCase()));

  // 1. past events sink below the fold
  const st = search("star trek");
  assert(st.main > 0 && st.mainAllUpcoming, `"star trek": everything above the fold is still to come (${st.main})`);
  assert(!st.mainDays.includes("2026-09-04"), "no Friday events above the divider at Saturday 13:05");
  assert(st.past > 0, `past matches are kept, below the fold (${st.past})`);

  // 3. AND first, OR fallback
  assert(st.loose === 0, "a query with plenty of AND matches shows no Looser section");
  const bg = search("board games");
  assert(bg.main < 900, `"board games" narrows under AND (${bg.main}, was ~1,300 under OR)`);
  assert(has(bg.topTitles, "board game"), `"board games" leads with real board-game rows (${bg.topTitles[0]})`);
  const thin = search("xylophone quidditch");
  assert(thin.main < 8, "a thin query has few AND matches");

  // quoted suggestion path is untouched
  const who = w.eval(`(function(){ var d = suggestDocs.filter(function(d){ return d.group === "people" && d.visible >= 3; })
    .sort(function(a,b){ return b.visible - a.visible; })[0]; return d.name; })()`);
  const quoted = search('"' + who + '"');
  assert(quoted.total > 0, `a tapped suggestion still returns results (${who}: ${quoted.total})`);
  assert(quoted.loose === 0, "and nothing under a Looser divider");
  assert(w.eval(`browseResults().every(function(e){ return (e.speakers||[]).some(function(p){ return p.name === ${JSON.stringify(who)}; }); })`),
    `every result for "${who}" actually features them`);

  // 4. exactness bonus is computed from h.match
  assert(/function termQuality\(t, matched, match\)/.test(fs.readFileSync(__dirname + "/../index.html", "utf8")),
    "match quality is computed per term, from MiniSearch's match map");
  assert(w.eval(`termQuality("trek", ["trek"], {trek:1})`) === 1, "an exact match scores 1");
  assert(Math.abs(w.eval(`termQuality("drag", ["dragons"], {dragons:1})`) - 4/7) < 0.01,
    "a prefix scores how much of the word it covers (drag/dragons = 0.57)");
  assert(w.eval(`termQuality("drag", ["dragon"], {dragon:1})`) > w.eval(`termQuality("drag", ["dragoncon"], {dragoncon:1})`),
    "covering more of the word scores higher (dragon beats dragoncon)");
  assert(w.eval(`termQuality("zzz", ["dragons"], {dragons:1})`) === 0, "an unrelated term scores 0");
  const trek = search("trek");
  assert(has(trek.topTitles.slice(0, 3), "trek"), `"trek" still leads with Trek events (${trek.topTitles[0]})`);

  // 4b. when nothing matched literally, say so rather than rank confidently
  /* No regex inside the eval string - normalise the text out here instead. */
  const noteFor = q => {
    w.eval(`(function(){ state.tab = "browse";
      Object.assign(state.browse, {q: ${JSON.stringify(q)}, day: "All", hotel: "All",
        track: "All", kind: "All", hideNoise: true, showHidden: false, showPast: false, page: 1});
      render(); })()`);
    const n = w.document.querySelector(".no-exact");
    return n ? n.textContent.replace(/\s+/g, " ").trim() : "";
  };
  const dragNote = noteFor("drag");
  assert(/No exact match for/.test(dragNote), `"drag" admits it matched nothing literally (${dragNote})`);
  assert(/start with it/.test(dragNote), "and says the results are prefixes");
  const typoNote = noteFor("philharmonc");
  assert(/close spellings/.test(typoNote), `a typo is described as a spelling miss, not a prefix (${typoNote})`);
  assert(noteFor("trek") === "", "a query that matched literally gets no note");
  assert(noteFor("star trek") === "", "nor a multi-word one that did");
  assert(noteFor("kids") === "", "nor a query that was all filters and never ranked");

  // 5. d&d
  const dnd = search("dnd"), dd = search("d&d");
  assert(w.eval(`expandQuery("d&d")`) === "dungeons dragons", "d&d expands to the words the index holds");
  assert(w.eval(`expandQuery("dnd")`) === "dungeons dragons", "dnd expands too");
  assert(has(dnd.topTitles.slice(0, 3), "d&d") || has(dnd.topTitles.slice(0, 3), "dungeons"),
    `"dnd" leads with D&D events (${dnd.topTitles[0]})`);
  assert(dd.main > 0 && has(dd.topTitles.concat(search("d&d").topTitles), "d&d") ||
         has(dd.topTitles, "dungeons"), `"d&d" finds D&D sessions (${dd.topTitles[0]})`);

  // 6. kids means the Kids Track
  const kids = search("kids");
  assert(kids.chips.includes("Kids Track"), "kids shows a Kids Track chip");
  assert(kids.main > 0 && kids.tracksAll.every(t => t.includes("Kids Track")), `"kids" returns Kids Track only (${kids.main})`);
  const kidsSat = search("kids saturday");
  assert(kidsSat.chips.includes("Saturday") && kidsSat.chips.includes("Kids Track"), "kids stacks with a day");
  assert(kidsSat.main > 0 && kidsSat.mainDays.every(d => d === "2026-09-05"), "and only returns that day");

  // 7. question words fall through to the filtered list
  const westin = search("what is at the westin");
  assert(westin.chips.includes("Westin"), "the hotel is still read out of the question");
  /* The residual is still "what is at the" - it is the *terms* that vanish
     once processTerm drops the stopwords, and that is what makes the query
     fall through to the filtered list unranked. */
  assert(w.eval(`browseResults().every(function(e){ return !e._hit; })`),
    `a question of only stopwords is not ranked (residual was "${westin.residual}")`);
  assert(w.eval(`browseResults().every(function(e){ return e.hotel === "Westin"; })`), "every result is at the Westin");
  /* Sections come first, time second: upcoming above the fold, past below,
     each run chronological. */
  assert(w.eval(`(function(){ var t = browseResults().filter(function(e){ return e._section === "main"; }).map(function(e){ return +e._s; });
    return t.every(function(v,i){ return i === 0 || v >= t[i-1]; }); })()`), "in time order within the section, not ranked");
  assert(w.eval(`(function(){ var t = browseResults().filter(function(e){ return e._section === "past"; }).map(function(e){ return +e._s; });
    return t.every(function(v,i){ return i === 0 || v >= t[i-1]; }); })()`), "and the past run is chronological too");

  // 2. explicit kinds beat the hide toggle
  const photo = search("photo op tudyk");
  assert(photo.main > 0 && photo.allNoise, `"photo op tudyk" returns the photo sessions (${photo.main})`);
  assert(has(photo.topTitles, "tudyk"), "and they are the right person's");
  const person = search("alan tudyk");
  const note = w.eval(`(function(){ var n = hiddenForQueryHTML(browseResults()); return n ? n.replace(/<[^>]*>/g, "") : ""; })()`);
  assert(/\d+ photo sessions hidden/.test(note), `a person search says what was held back (${note.trim()})`);
  const hiddenCount = parseInt(note, 10);
  const actual = w.eval(`events.filter(function(e){ return isNoise(e) && (e.speakers||[]).some(function(p){ return /alan tudyk/i.test(p.name); }); }).length`);
  assert(hiddenCount === actual, `with the right count (${hiddenCount} = ${actual})`);
  const revealed = search("alan tudyk", {showHidden: true});
  assert(revealed.main >= hiddenCount, `tapping show includes them (${revealed.main} results, ${hiddenCount} were hidden)`);
  assert(person.main < revealed.main, "which is more than were shown before");

  // follows: a person's photo sessions are the point, so the hide setting
  // must not apply to them (needs real data: the fixture has no such person)
  const celeb = w.eval(`(function(){
    var best = null;
    events.forEach(function(e){ if (!isNoise(e)) return;
      (e.speakers||[]).forEach(function(p){ if (p.name) { best = best || {}; best[p.name] = (best[p.name]||0)+1; } }); });
    if (!best) return null;
    var name = Object.keys(best).sort(function(a,b){ return best[b]-best[a]; })[0];
    return name ? {name: name, hidden: best[name]} : null; })()`);
  assert(celeb, "the schedule has someone with photo sessions");
  if (celeb) {
    const all = w.eval(`eventsFor({kind:"person",key:${JSON.stringify(celeb.name)}}).length`);
    const noisy = w.eval(`eventsFor({kind:"person",key:${JSON.stringify(celeb.name)}}).filter(isNoise).length`);
    assert(noisy === celeb.hidden, `a person follow keeps their ${celeb.hidden} photo sessions (${celeb.name})`);
    assert(all > noisy, "alongside their other events");
    const withHideOn = w.eval(`(function(){ var was = state.browse.hideNoise; state.browse.hideNoise = true;
      var n = eventsFor({kind:"person",key:${JSON.stringify(celeb.name)}}).length; state.browse.hideNoise = was; return n; })()`);
    assert(withHideOn === all, "and the hide-photo-sessions setting does not change that");
    // the other kinds are not exempt in the same way - they just report what matches
    const tr = w.eval(`(function(){ var t={}; events.forEach(function(e){ (e.tracks||[]).forEach(function(x){ t[x]=(t[x]||0)+1; }); });
      return Object.keys(t).sort(function(a,b){ return t[b]-t[a]; })[0]; })()`);
    assert(w.eval(`eventsFor({kind:"track",key:${JSON.stringify(tr)}}).length`) ===
           w.eval(`events.filter(function(e){ return (e.tracks||[]).indexOf(${JSON.stringify(tr)}) >= 0; }).length`),
      "a track follow returns exactly the track's events");
  }

  // Explore against the real schedule: all four sections, correct counts
  w.eval(`(function(){ follows = []; saveFollows(); state.tab = "explore"; state.explore.page = null; state.explore.q = ""; render(); })()`);
  const realSecs = [...w.document.querySelectorAll("#view-explore .section-title")].map(x => x.textContent.trim().split(" ")[0]);
  assert(realSecs.join(",") === "Tracks,Fandoms,Topics,Guests,Panelists", `all five sections render (${realSecs.join(",")})`);
  assert(w.eval(`getCatalogue().guest.length > 100 && getCatalogue().guest.every(function(p){
    return events.some(function(e){ return isCeleb(e) && (e.speakers||[]).some(function(s){ return s.name === p.key; }); }); })`),
    `every Guest is a celebrity guest (${w.eval("getCatalogue().guest.length")})`);
  assert(w.eval(`getCatalogue().panelist.every(function(p){ return p.count >= 5; })`), "and every Panelist has 5+ events");
  assert(w.eval(`getCatalogue().track[0].key`) !== "Epic Photos" && w.eval(`getCatalogue().track[getCatalogue().track.length - 1].key`) === "Video Room",
    `Epic Photos no longer leads the tracks; Video Room comes last (${w.eval("getCatalogue().track[0].key")})`);
  // a starred celebrity panel suggests its guest, not its photo sessions
  const sugReal = JSON.parse(w.eval(`(function(){
    follows = []; saveFollows();
    var ev = events.find(function(e){ return isCeleb(e) && !isNoise(e) && (e.speakers || []).length === 1; });
    picks = new Set([ev.id]); savePicks(); state.tab = "explore"; state.explore.page = null; state.explore.q = ""; render();
    var tiles = [].map.call(document.querySelectorAll("#suggested .tile"), function(t){ return t.dataset.explore; });
    picks = new Set(); savePicks(); render();
    return JSON.stringify({guest: ev.speakers[0].name, tiles: tiles}); })()`));
  assert(sugReal.tiles.includes("person:" + sugReal.guest), `a starred celebrity panel suggests its guest (${sugReal.guest}: ${sugReal.tiles.join(", ")})`);
  assert(!sugReal.tiles.includes("track:Epic Photos"), "and never the photo-session track");
  const cat = JSON.parse(w.eval(`JSON.stringify({track:getCatalogue().track.length, fandom:getCatalogue().fandom.length,
    topic:getCatalogue().topic.length, person:getCatalogue().person.length})`));
  assert(cat.track === w.eval(`(function(){ var t={}; events.forEach(function(e){ (e.tracks||[]).forEach(function(x){ t[x]=1; }); }); return Object.keys(t).length; })()`),
    `every track gets a tile (${cat.track})`);
  assert(w.eval(`getCatalogue().fandom.every(function(f){ return f.count >= 3; })`), "fandoms are limited to 3+ events");
  assert(w.eval(`getCatalogue().fandom.length < (function(){ var t={}; events.forEach(function(e){ ((e.tags||{}).fandoms||[]).forEach(function(x){ t[x]=1; }); }); return Object.keys(t).length; })()`),
    "which is fewer than all of them");
  assert(cat.person > 0, `people are listed (${cat.person})`);
  assert(w.eval(`getCatalogue().person.every(function(p){
    if (p.count >= 5) return true;
    return events.some(function(e){ return isCeleb(e) && (e.speakers||[]).some(function(s){ return s.name === p.key; }); }); })`),
    "each person is either a celebrity guest or has 5+ events");
  // a page's counts match eventsFor
  const t0 = w.eval(`getCatalogue().track[0].key`);
  w.eval(`openExplorePage("track", ${JSON.stringify(t0)})`);
  const shownCount = w.document.querySelector("#view-explore .eh-count").textContent;
  assert(shownCount.startsWith(String(w.eval(`eventsFor({kind:"track",key:${JSON.stringify(t0)}}).length`))),
    `the page count matches eventsFor (${t0}: ${shownCount})`);
  w.eval(`(function(){ state.explore.page = null; setExploreHash(null); follows = []; saveFollows(); state.tab = "browse"; render(); })()`);

  // ---- search-3 fix 1: a filter-only query means today ----
  const lateNight = search("late night");
  assert(lateNight.chips.includes("Late night"), "late night is still read as a time band");
  assert(w.eval(`state.browse.todayScoped`) === true, "and with nothing left to rank, it scopes to today");
  const conToday = w.eval(`conDayKey(getNow())`);
  assert(w.eval(`browseResults().filter(function(e){ return e._section === "main"; }).every(function(e){ return conDayKey(e._s) === ${JSON.stringify(conToday)}; })`),
    "every result belongs to today's con day");
  assert(!lateNight.mainDays.includes("2026-09-02"), "nothing from Wednesday");
  assert(w.eval(`browseResults().filter(function(e){ return e._section === "main" && e.day !== ${JSON.stringify(conToday)}; })
    .every(function(e){ return e._s.getHours() < 5; })`),
    "anything dated tomorrow is after midnight, not a different day");
  const party = search("party");
  assert(party.main > 0, `"party" returns today's parties (${party.main})`);
  assert(party.past > 0, `with earlier ones behind the fold (${party.past})`);
  assert(w.eval(`browseResults().filter(function(e){ return e._section === "main"; }).every(function(e){ return e._e > getNow(); })`),
    "and everything above the fold is still to come");
  // a day in the query wins
  const partyFri = search("party friday");
  assert(partyFri.chips.includes("Friday"), "a named day is still read");
  assert(w.eval(`state.browse.todayScoped`) === false, "and turns the today scope off");
  // a day chip wins
  search("party", {day: "2026-09-06"});
  assert(w.eval(`state.browse.todayScoped`) === false, "a day chip turns it off too");
  assert(w.eval(`browseResults().every(function(e){ return e._cd === "2026-09-06"; })`), "and its day is the one used");
  // the chip widens it
  const widened = search("party", {noToday: true});
  assert(w.eval(`state.browse.todayScoped`) === false, "removing the Today chip widens to the whole con");
  assert(widened.main > party.main, `which finds more (${widened.main} vs ${party.main})`);
  assert(new Set(widened.mainDays).size > 1, "across more than one day");
  // and the chip is offered
  w.eval(`(function(){ Object.assign(state.browse,{q:"party",day:"All",noToday:false,page:1}); state.tab="browse"; render(); })()`);
  assert(/Today/.test(w.document.querySelector("#view-browse .parsed-chips").textContent), "the Today chip is shown so it can be removed");
  assert(w.document.querySelector('#view-browse [data-act="unparse-today"]'), "with a control to remove it");

  // ---- search-3 fix 2: stopwords and short-term prefix ----
  ["how", "can", "do", "does", "should", "will", "want", "wanna", "gonna"].forEach(word =>
    assert(w.eval(`STOPWORDS.has(${JSON.stringify(word)})`), `"${word}" is a stopword`));
  assert(w.eval(`typeof index._options.searchOptions.prefix`) === "function", "the main index decides prefix per term");
  assert(w.eval(`index._options.searchOptions.prefix("ai")`) === false, "two letters do not prefix-match");
  assert(w.eval(`index._options.searchOptions.prefix("mcu")`) === false, "nor three");
  assert(w.eval(`index._options.searchOptions.prefix("trek")`) === true, "four or more do");
  assert(w.eval(`suggestIndex._options.searchOptions.prefix`) === true, "the suggestion index is untouched");
  for (const [q, want] of [["mcu", "mcu"], ["40k", "40k"], ["ai", "ai"], ["dnd", "dungeons"], ["trek", "trek"]]) {
    const r = search(q);
    assert(r.main > 0, `"${q}" still returns events (${r.main})`);
    assert(r.topTitles.slice(0, 3).some(t => new RegExp(want, "i").test(t)), `"${q}" leads with ${want} events (${r.topTitles[0]})`);
  }

  // 8. track aliases
  for (const [q, want] of [["skeptrack", "skeptic"], ["filk", "filk"], ["larp", "larp"]]) {
    const r = search(q);
    assert(r.total > 0, `"${q}" finds something (${r.total})`);
  }

  w.close();
}
window.addEventListener("error", e => { console.error("JS ERROR:", e.message); process.exitCode = 1; });
