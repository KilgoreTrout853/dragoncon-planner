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
