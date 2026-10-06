/* What the browser tests are served, as Playwright's globalSetup: two pages,
   each built afresh and served from this machine by Vite's preview for as
   long as the run lasts.
   - dist/, on PORT: `vite build`, the default year, no channel, no backend,
     whatever the shell's DC_ variables say, as tests/build.test.js builds.
     The standing checks and every test but the gear's read this one.
   - dist-backend/, on BACKEND_PORT (DECISIONS #92): the same build told of a
     backend - harness.js BACKEND, an address on this machine where nothing
     listens and a key that is plainly made up - so the page draws what only
     such a build has, Keep your plan first. The build's own check of the
     two takes them as they are. The harness answers the page's requests.
   So `npm run test:browser` never tests a stale build, and never a server
   it found: a port already taken stops the run before a test starts, and
   says so. A preview left running is not what is tested. */
import net from "node:net";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { preview } from "vite";
import { BACKEND, BACKEND_DIR, BACKEND_PORT, PORT, ROOT } from "./harness.js";

const PLAIN = { DC_YEAR: "", DC_CHANNEL: "", DC_BUILD: "", DC_SUPABASE_URL: "", DC_SUPABASE_KEY: "" };
const taken = port => `Port ${port} is taken. The browser tests serve their two builds themselves and never use a server they find there: `
  + `stop what is listening on it - an \`npm run preview\` left running, most likely - and run again.`;

const answers = (port, host) => new Promise(resolve => {
  const socket = net.connect({ port, host });
  socket.once("connect", () => { socket.destroy(); resolve(true); });
  socket.once("error", () => resolve(false));
});

function build(env, ...args) {
  execFileSync(process.execPath, [path.join(ROOT, "node_modules", "vite", "bin", "vite.js"), "build", "--logLevel", "warn", ...args],
    /* what the build says, on stderr: stdout is a reporter's */
    { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", process.stderr, process.stderr] });
}
async function served(port, outDir) {
  try {
    return await preview({ root: ROOT, logLevel: "warn", build: { outDir }, preview: { port, strictPort: true, open: false } });
  } catch (e) {
    /* taken between the look below and the listen */
    throw new Error(/already in use/i.test(String(e && e.message)) ? taken(port) : `The preview of ${outDir}/ did not start: ${e && e.message}`, { cause: e });
  }
}

export default async function serve() {
  for (const port of [PORT, BACKEND_PORT]) {
    if (await answers(port, "127.0.0.1") || await answers(port, "::1")) throw new Error(taken(port));
  }
  Object.assign(process.env, PLAIN);
  build({});
  build({ DC_SUPABASE_URL: BACKEND.url, DC_SUPABASE_KEY: BACKEND.key }, "--outDir", BACKEND_DIR);
  const plain = await served(PORT, "dist");
  let backend;
  try { backend = await served(BACKEND_PORT, BACKEND_DIR); }
  catch (e) { await plain.close(); throw e; }
  return () => Promise.all([plain.close(), backend.close()]);
}
