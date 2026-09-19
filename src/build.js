import { esc } from "./util.js";
import { IS_IOS } from "./platform.js";

/* ==================================================================
   Build. main publishes straight from the branch: the source carries empty
   stamps and the live site wears no mark. build.py stamps a deploy with a
   channel (the next site) and a build id, and a stamped page shows a small
   dev-build mark, so a screenshot says which site it came from. It is the
   stamp that decides, never the address the page was loaded from.
   ================================================================== */
const metaContent = name => { const m = document.querySelector(`meta[name="${name}"]`); return m && m.content ? m.content.trim() : ""; };
const BUILD = {channel: metaContent("dc-channel"), id: metaContent("dc-build")};
function devMarkHTML() {
  if (!BUILD.channel) return "";
  return `<div class="devmark" aria-hidden="true">dev build &middot; ${esc(BUILD.channel)}${BUILD.id ? ` &middot; ${esc(BUILD.id)}` : ""}</div>`;
}

/* What the phone is telling us, for the times a screenshot is not enough:
   how the app was opened, the viewport against the screen, and the insets
   the system reports before any cap of ours. */
function deviceLine() {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const insets = `top ${cs.paddingTop || "?"}, bottom ${cs.paddingBottom || "?"}`;
  probe.remove();
  const standalone = !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  const vv = window.visualViewport ? Math.round(window.visualViewport.height) : "-";
  const scr = window.screen ? `${screen.width}×${screen.height}` : "-";
  /* GitHub Pages stamps every deploy with a Last-Modified header; the page
     can read it, so "which build is this" is a glance rather than a guess. */
  const built = new Date(document.lastModified);
  const stamp = isNaN(built) ? "" : ` · build ${built.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  return `${standalone ? "Home-screen app" : "Web page"} · viewport ${window.innerWidth}×${window.innerHeight}, visual ${vv}, screen ${scr} · insets ${insets}${IS_IOS ? " · iOS" : ""}${BUILD.channel ? ` · ${BUILD.channel} build${BUILD.id ? " " + BUILD.id : ""}` : ""}${stamp}`;
}

export { BUILD, devMarkHTML, deviceLine };
