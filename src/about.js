/* About this app (W32; DECISIONS #59, #92; docs/screens/contract.md,
   section 9): the sheet's eighth panel, #panel-about, behind Settings' row.
   That the app is unofficial, the one link to Dragon Con's own, and what we
   store: on this phone, on the server, what a crew sees, what the controls
   do and who else is involved - or, on a build with no backend, the three
   parts that are true of it. The words are a statement to the reader: one
   that the code makes false is changed here, in the same pull request. The
   panel's element is the sheet's, and so are its way in and its way back;
   this draws it and nothing else. A leaf. */
import { hasBackend } from "./backend.js";

const OFFICIAL = "https://www.dragoncon.org/";
const NO_MORE = "No ads, no analytics, no cookies, and the app never asks where you are.";
const SEEN_BY = "Each sees your phone's internet address when it answers, as any website does, and may log it";
const label = words => `<h4 class="about-label">${words}</h4>`;

const STORED = hasBackend
  ? `${label("On this phone")}
    <p>Your picks, what you follow and mute, your settings, and a copy of the schedule so the app opens without signal. Once you have a crew or an email, also your sign-in, your crew - its names, its invite link and its picks - and any change still waiting to be sent. All of it is kept in this browser; clearing its site data removes it from this phone.</p>
    ${label("On our server")}
    <p>Nothing, until you start or join a crew or add your email. From then on the server keeps:</p>
    <ul>
      <li>your picks and follows, each with the time it last changed, the ones you took back included</li>
      <li>your email, if you added one</li>
      <li>the name you gave each crew you're in and when you joined it, and any crew you started</li>
    </ul>
    <p>Mutes and settings never leave this phone.</p>
    ${label("What your crew sees")}
    <p>The name you gave that crew, and your stars. Their phones are also told when you take a star back. Never your follows, your mutes or your email.</p>
    ${label("What the controls do")}
    <ul>
      <li><b>Remove all picks</b> unstars everything. On the server each pick stays, marked unstarred.</li>
      <li><b>Sign out</b> takes your sign-in off this phone, and your crew with it until you sign in again. Your plan stays here and on the server.</li>
      <li><b>Leave</b> a crew, or delete one you started, and its members stop seeing your picks once their phones next sync.</li>
    </ul>
    ${label("Who else is involved")}
    <p>GitHub serves the app, Google serves the typeface and Supabase runs the server. ${SEEN_BY}; Supabase keeps it, and what browser you used, with your sign-in. Resend sends the sign-in code, so it sees your email address. ${NO_MORE}</p>`
  : `${label("On this phone")}
    <p>Your picks, what you follow and mute, your settings, and a copy of the schedule so the app opens without signal. All of it is kept in this browser; clearing its site data removes it.</p>
    ${label("On a server")}
    <p>Nothing. This copy of the app has no server: everything stays on this phone.</p>
    ${label("Who else is involved")}
    <p>GitHub serves the app and Google serves the typeface. ${SEEN_BY}. ${NO_MORE}</p>`;

/* The panel, drawn as it opens: the heading, a body that scrolls - one of the
   sheet's areas, as Settings' is - and a foot with the one way back. */
function aboutHTML() {
  return `<h2 id="sheetTitleAbout" tabindex="-1">About this app</h2>
    <div class="sheet-body about" id="aboutBody">
      <p><b>Unofficial.</b> A planner for Dragon Con made by a fan, for friends. Not affiliated with or endorsed by Dragon Con.</p>
      <p>The schedule is read from the con's public schedule and can run behind it. The con's own is the last word.</p>
      <h3>Dragon Con's own</h3>
      <p>Hours, maps, policies, vendors and everything else:</p>
      <a class="about-link" id="aboutLink" href="${OFFICIAL}" target="_blank" rel="noopener">Dragon Con's official site and app</a>
      <h3>What we store</h3>
      ${STORED}
    </div>
    <div class="sheet-foot"><button class="btn" type="button" id="aboutBack">Back to Settings</button></div>`;
}

export { aboutHTML };
