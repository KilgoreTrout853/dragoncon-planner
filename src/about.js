/* About this app (W32, W45; DECISIONS #59, #92, #93, #99; docs/screens/contract.md,
   section 9): the sheet's eighth panel, #panel-about, behind Settings' row.
   That the app is unofficial, the one link to Dragon Con's own, and what we
   store: on this phone, on the server, what a crew sees, what the controls
   do, who else is involved and, last, Delete - or, on a build with no
   backend, the three parts that are true of it; and on a build with a
   backend and the email step off (#99) a third wording, the backend's less
   the email, the sign-out and the company that sends the code, so that the
   word "email" is nowhere in the panel. The words are a statement
   to the reader: one that the code makes false is changed here, in the same
   pull request. The panel's element is the sheet's, and so are its way in,
   its way back and the tap on Delete; this draws it and says its words, and
   nothing else. A leaf. */
import { emailStep, hasBackend, storedSession } from "./backend.js";

const OFFICIAL = "https://www.dragoncon.org/";
const NO_MORE = "No ads, no analytics, no cookies, and the app never asks where you are.";
const SEEN_BY = "Each sees your phone's internet address when it answers, as any website does, and may log it";
const label = words => `<h4 class="about-label">${words}</h4>`;

/* Three wordings: a backend with the email step off; a backend; none. */
const STORED = hasBackend && !emailStep
  ? `${label("On this phone")}
    <p>Your picks, what you follow and mute, your settings, and a copy of the schedule so the app opens without signal. Once you have a crew, also your sign-in, your crew - its names, its invite link and its picks - and any change still waiting to be sent. All of it is kept in this browser; clearing its site data removes it from this phone.</p>
    ${label("On our server")}
    <p>Nothing, until you start or join a crew. From then on the server keeps:</p>
    <ul>
      <li>your picks and follows, each with the time it last changed, the ones you took back included</li>
      <li>the name you gave each crew you're in and when you joined it, and any crew you started</li>
    </ul>
    <p>Mutes and settings never leave this phone.</p>
    ${label("What your crew sees")}
    <p>The name you gave that crew, and your stars. Their phones are also told when you take a star back. Never your follows or your mutes.</p>
    ${label("What the controls do")}
    <ul>
      <li><b>Remove all picks</b> unstars everything. On the server each pick stays, marked unstarred.</li>
      <li><b>Leave</b> a crew, or delete one you started, and its members stop seeing your picks once their phones next sync.</li>
    </ul>
    ${label("Who else is involved")}
    <p>GitHub serves the app, Google serves the typeface and Supabase runs the server. ${SEEN_BY}; Supabase keeps it, and what browser you used, with your sign-in. ${NO_MORE}</p>`
  : hasBackend
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

/* Delete (W45, #93), last in What we store on a build with a backend: what
   the server keeps for the reader, removed by one tap and one confirm. The
   part is worked out as it is drawn, from the session as it then is: with
   one, what Delete removes and the button, named for a session with an email
   or for an anonymous one; with none, that the reader signs in first. And
   written again in place by the sheet: note, a failure's plain words under
   the button, or under the sentence once the session is gone; done, the
   delete made - the button gone and DELETED in its place. The note is a
   status, so a screen reader says it, and takes focus when the sheet gives
   it. With the email step off (#99) no one has an email and no one can sign
   in again: what Delete removes names none, and with no session there is
   nothing to delete from here. */
const REMOVES = `Removes what the server keeps for you: your picks and follows, your sign-in, ${emailStep ? "with your email if you added one, " : ""}and your place in every crew. A crew you started goes too if no one else is in it; otherwise it stays for its members, with no one to manage it - delete the crew first if you want it gone. Your plan stays on this phone; Remove all picks clears its picks. It cannot reach the logs the companies above keep.`;
const SIGN_IN_FIRST = emailStep ? "To delete what the server keeps for you, sign in first - Settings, Keep your plan - then come back here. If you never started or joined a crew and never entered an email, it keeps nothing." : "Nothing to delete from here: this phone has no sign-in on the server. If you never started or joined a crew, the server keeps nothing for you.";
const DELETED = "Deleted. Your picks, follows and sign-in are off the server. Your plan is still on this phone.";
const said = words => `<div class="about-note" id="aboutDeleteNote" role="status" tabindex="-1">${words}</div>`;
function deleteHTML({note = "", done = false} = {}) {
  const session = storedSession();
  if (done) return `${label("Delete")}<p>${REMOVES}</p>${said(DELETED)}`;
  if (!session) return `${label("Delete")}<p>${SIGN_IN_FIRST}</p>${said(note)}`;
  return `${label("Delete")}<p>${REMOVES}</p>
    <div class="rowbtns"><button class="btn danger" type="button" id="aboutDeleteBtn">${session.user.is_anonymous ? "Delete my data from the server" : "Delete my account"}</button></div>
    ${said(note)}`;
}

/* The confirm's question, by the session - null with none, and nothing is
   asked. started: the names of the crews the reader made that hold someone
   else, as the phone last knew them; each stays, so each is named. A crew
   the reader is alone in goes with them, and is not. */
function deleteQuestion(started = []) {
  const session = storedSession();
  if (!session) return null;
  const question = session.user.is_anonymous
    ? "Delete your data from the server? Your picks, follows and place in every crew are removed. This can't be undone. Your plan stays on this phone."
    : "Delete your account? Your picks, follows, email and place in every crew are removed from the server. This can't be undone. Your plan stays on this phone.";
  if (!started.length) return question;
  const stays = started.length === 1
    ? `You started ${started[0]}. It stays for its members, with no one to manage it. Delete the crew first if you want it gone.`
    : `You started ${started.slice(0, -1).join(", ")} and ${started[started.length - 1]}. They stay for their members, with no one to manage them. Delete a crew first if you want it gone.`;
  return [question, "", stays].join("\n");
}

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
      ${hasBackend ? `<div class="about-delete" id="aboutDelete">${deleteHTML()}</div>` : ""}
    </div>
    <div class="sheet-foot"><button class="btn" type="button" id="aboutBack">Back to Settings</button></div>`;
}

export { aboutHTML, deleteHTML, deleteQuestion };
