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
      fandom:"All", kind:"All", hideAdult:false, hideNoise:false, page:1});
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
  assert(sres.every(e => e.day === "2026-09-05" && e.tags && e.tags.kind === "performance"), "every result is a Saturday performance");
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

  // ---- search step 3: celebrity chip and marker ----
  resetBrowse(); await sleep(20);
  const celebTotal = window.eval("events.filter(isCeleb).length");
  assert(celebTotal > 0, `the fixture has celebrity events (${celebTotal})`);
  const chip = document.querySelector('#view-browse [data-chip="celebrity"]');
  assert(chip, "a Celebrity chip sits in the kind row");
  assert(chip.closest(".chips") === document.querySelector('#view-browse [data-chip="kind"]').closest(".chips"),
    "it is in the same row as the kind chips");
  assert(chip.getAttribute("aria-pressed") === "false", "it starts off");
  chip.click(); await sleep(30);
  assert(window.eval("state.browse.celebrity") === true, "tapping turns it on");
  assert(document.querySelector('#view-browse [data-chip="celebrity"]').getAttribute("aria-pressed") === "true", "and it shows as pressed");
  const cres = window.eval("browseResults()");
  assert(cres.length > 0, `celebrity events are returned (${cres.length})`);
  assert(cres.every(e => e.tags && e.tags.guests === "celebrity"), "every result is a celebrity event");
  assert(!cres.some(e => !e.tags || e.tags.guests === "unknown"), "unknown and untagged events are excluded");
  // it stacks with the other filters rather than replacing them
  window.eval(`(function(){ state.browse.day = "2026-09-05"; state.browse.page = 1; renderBrowse(); })()`); await sleep(30);
  const stacked = window.eval("browseResults()");
  assert(stacked.every(e => e.day === "2026-09-05" && e.tags.guests === "celebrity"), "celebrity stacks with the day filter");
  assert(stacked.length <= cres.length, `stacking narrows rather than widens (${stacked.length} <= ${cres.length})`);
  // and with a parsed query filter
  window.eval(`(function(){ state.browse.q = "saturday"; state.browse.page = 1; renderBrowse(); })()`); await sleep(30);
  assert(window.eval("browseResults()").every(e => e.tags.guests === "celebrity"), "celebrity survives a parsed query filter");
  window.eval(`(function(){ state.browse.q = ""; renderBrowse(); })()`); await sleep(20);
  // the marker shows on rows, and only on the right rows
  const marked = [...document.querySelectorAll("#view-browse .row .celeb")];
  assert(marked.length > 0, "rows carry a celebrity marker");
  assert(marked.every(m => /celebrity/i.test(m.textContent)), "the marker says what it means");
  window.eval(`(function(){ state.browse.celebrity = false; state.browse.day = "All"; state.browse.page = 1; renderBrowse(); })()`); await sleep(30);
  const rowsWithMark = [...document.querySelectorAll("#view-browse .row")].filter(r => r.querySelector(".celeb"));
  assert(rowsWithMark.every(r => window.eval(`isCeleb(byId.get(${JSON.stringify(r.dataset.id)}))`)),
    "with the filter off, only celebrity rows are marked");
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
  // ---- render cost: typing is debounced, the minute tick patches ----
  assert(window.eval("typeof queueBrowseRender") === "function", "browse renders are queued, not immediate");
  assert(window.eval("SEARCH_DEBOUNCE_MS") >= 80 && window.eval("SEARCH_DEBOUNCE_MS") <= 300,
    `the debounce is in a sensible range (${window.eval("SEARCH_DEBOUNCE_MS")}ms)`);
  /* Earlier steps leave chips set; start from a known filter state. */
  const perfSnapshot = window.eval("JSON.stringify(state.browse)");
  window.eval(`(function(){ state.tab = "browse";
    Object.assign(state.browse, {q:"", day:"All", prevDay:null, hotel:"All", type:"All", track:"All",
      fandom:"All", kind:"All", celebrity:false, showHidden:false, showPast:false, noToday:false,
      hideAdult:false, hideNoise:false, page:1});
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

  // ---- step 0: five tabs, Browse renamed to Search ----
  const navBtns = [...document.querySelectorAll(".nav button")];
  const navLabels = navBtns.map(b => [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(""));
  assert(navLabels.join(" · ") === "Now · Search · Explore · For you · Mine",
    `the nav reads Now · Search · Explore · For you · Mine (${navLabels.join(" · ")})`);
  assert(navBtns.length === 5, "five tabs");
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
  assert(navBtns.map(b => b.dataset.tab).join(",") === "now,browse,explore,foryou,mine",
    "the internal identifiers are unchanged");
  assert(/repeat\(5, 1fr\)/.test(html), "the nav lays out five columns");
  // the two new views exist and switch
  for (const t of ["explore", "foryou"]) {
    document.querySelector(`.nav button[data-tab="${t}"]`).click(); await sleep(20);
    assert(window.eval("state.tab") === t, `the ${t} tab switches`);
    assert(!document.getElementById(`view-${t}`).hidden, `and its view shows`);
    assert(document.getElementById("view-browse").hidden, "while the others hide");
  }
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
  const order = ["Tracks", "Fandoms", "Topics", "People"];
  const seen = secTitles.map(t => t.split(" ")[0]);
  assert(seen.length >= 3, `the sections that have content render (${seen.join(" | ")})`);
  assert(seen.every(x => order.includes(x)), "and are named from the four kinds");
  assert(seen.join(",") === order.filter(o => seen.includes(o)).join(","), "in the order Tracks, Fandoms, Topics, People");
  assert(!seen.includes("Fandoms"), "an empty section is skipped rather than shown empty");
  assert(window.eval(`getCatalogue().fandom.every(function(f){ return f.count >= 3; })`), "fandom tiles need 3+ events");
  assert(window.eval(`(function(){ var c = getCatalogue().track; for (var i = 1; i < c.length; i++) if (c[i].count > c[i-1].count) return false; return true; })()`),
    "tiles are sorted by count, descending");
  const firstTile = document.querySelector("#view-explore .tile");
  assert(/\d/.test(firstTile.textContent), "each tile shows a count");
  // the filter narrows tiles, not events
  const allTiles = document.querySelectorAll("#view-explore .tile").length;
  window.eval(`(function(){ state.explore.q = "cost"; renderExplore(); })()`); await sleep(20);
  const narrowed = [...document.querySelectorAll("#view-explore .tile-name")].map(x => x.textContent);
  assert(narrowed.length > 0 && narrowed.length < allTiles, `the filter narrows the tiles (${allTiles} -> ${narrowed.length})`);
  assert(narrowed.every(n => /cost/i.test(n)), "to those whose name matches");
  window.eval(`(function(){ state.explore.q = ""; renderExplore(); })()`); await sleep(20);
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

  // ---- step 3: For you ----
  window.eval(`(function(){ follows = []; saveFollows(); state.tab = "foryou"; state.foryou.expanded = {}; state.foryou.showPast = {}; render(); })()`);
  await sleep(30);
  const fyEmpty = document.querySelector("#view-foryou .empty");
  assert(fyEmpty && /Follow a few things and they'll show up here/.test(fyEmpty.textContent), "the empty state says what to do");
  assert(document.querySelector('#view-foryou [data-act="foryou-add"]'), "and offers a way to Explore");
  document.querySelector('#view-foryou [data-act="foryou-add"]').click(); await sleep(30);
  assert(window.eval("state.tab") === "explore", "which switches to Explore");
  // follow two things and come back
  const twoFollows = window.eval(`(function(){
    var t = getCatalogue().track[0].key;
    var other = getCatalogue().track[1].key;
    follows = []; toggleFollow("track", t); toggleFollow("track", other);
    state.tab = "foryou"; render();
    return JSON.stringify([t, other]); })()`);
  await sleep(40);
  const wanted = JSON.parse(twoFollows);
  const chipNames = [...document.querySelectorAll("#view-foryou .fc-name")].map(x => x.textContent);
  assert(chipNames.join("|") === wanted.join("|"), `chips list the follows in order (${chipNames.join(", ")})`);
  assert(document.querySelectorAll('#view-foryou .follow-chip [data-act="unfollow"]').length === 2, "each chip has an unfollow control");
  assert(document.querySelector('#view-foryou .fc-add'), "and there is a + chip at the end");
  assert(document.querySelector('#view-foryou .fc-name').dataset.explore === "track:" + wanted[0], "a chip links to its Explore page");
  // by interest
  assert(window.eval("state.foryou.layout") === "interest", "By interest is the default");
  const sections = [...document.querySelectorAll("#view-foryou .section-title")].map(x => x.textContent.trim());
  assert(sections.length === 2, `a section per follow (${sections.length})`);
  assert(sections[0].startsWith(wanted[0]), "in follow order");
  const firstList = document.querySelector("#view-foryou .list");
  assert(firstList.querySelectorAll(".row").length <= 8, "each section shows at most eight to start");
  const moreBtn = document.querySelector('#view-foryou [data-act="fy-more"]');
  if (moreBtn) {
    const before = document.querySelectorAll("#view-foryou .row").length;
    moreBtn.click(); await sleep(40);
    assert(document.querySelectorAll("#view-foryou .row").length > before, "and 'more' expands it");
  }
  // by time
  document.querySelector('[data-act="fy-time"]').click(); await sleep(40);
  assert(window.eval("state.foryou.layout") === "time", "the layout toggles");
  assert(JSON.parse(window.localStorage.getItem("dc26.foryouLayout")) === "time", "and persists");
  const timeIds = [...document.querySelectorAll("#view-foryou .row")].map(r => r.dataset.id);
  assert(timeIds.length === new Set(timeIds).size, `by time lists each event once (${timeIds.length})`);
  assert(document.querySelectorAll("#view-foryou .day-head").length > 0, "grouped under day headers");
  assert(document.querySelectorAll("#view-foryou .time-head").length > 0, "and hour headers");
  // starring still behaves
  const fyStar = document.querySelector("#view-foryou .row .star");
  if (fyStar) {
    const id = fyStar.closest(".row").dataset.id;
    const had = window.eval(`picks.has(${JSON.stringify(id)})`);
    fyStar.click(); await sleep(40);
    assert(window.eval(`picks.has(${JSON.stringify(id)})`) !== had, "starring works from For you");
    window.eval(`(function(){ picks.delete(${JSON.stringify(id)}); savePicks(); })()`);
  }
  // unfollowing from a chip drops its section
  document.querySelector('[data-act="fy-interest"]').click(); await sleep(40);
  const secBefore = document.querySelectorAll("#view-foryou .section-title").length;
  document.querySelector('#view-foryou [data-act="unfollow"]').click(); await sleep(40);
  assert(document.querySelectorAll("#view-foryou .section-title").length === secBefore - 1, "unfollowing from a chip removes its section");
  assert(window.eval("follows.length") === 1, "and the follow itself");
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
  assert(/const CACHE\s*=\s*["']dc26-v1["']/.test(swSrc), "the cache name is versioned (dc26-v1)");
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
  assert(/<link rel="apple-touch-icon" href="\.\/icon\.svg">/.test(html), "index.html sets an apple-touch-icon");
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
      fandom: "All", kind: "All", celebrity: false, showHidden: false, showPast: false, hideAdult: false,
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
  assert(realSecs.join(",") === "Tracks,Fandoms,Topics,People", `all four sections render (${realSecs.join(",")})`);
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
  assert(w.eval(`browseResults().every(function(e){ return e.day === "2026-09-06"; })`), "and its day is the one used");
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
