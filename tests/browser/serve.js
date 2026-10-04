/* What the browser tests are served, as Playwright's globalSetup: the page
   built afresh - `vite build`, the default year, no channel, no backend,
   whatever the shell's DC_ variables say, as tests/build.test.js builds - and
   dist/ served from this machine by Vite's preview for as long as the run
   lasts. So `npm run test:browser` never tests a stale dist/, and never a
   server it found: a port already taken stops the run before a test starts,
   and says so. A preview left running is not what is tested. */
import net from "node:net";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { preview } from "vite";
import { PORT, ROOT } from "./harness.js";

const PLAIN = { DC_YEAR: "", DC_CHANNEL: "", DC_BUILD: "", DC_SUPABASE_URL: "", DC_SUPABASE_KEY: "" };
const TAKEN = `Port ${PORT} is taken. The browser tests serve dist/ themselves and never use a server they find there: `
  + `stop what is listening on it - an \`npm run preview\` left running, most likely - and run again.`;

const answers = host => new Promise(resolve => {
  const socket = net.connect({ port: PORT, host });
  socket.once("connect", () => { socket.destroy(); resolve(true); });
  socket.once("error", () => resolve(false));
});

export default async function serve() {
  if (await answers("127.0.0.1") || await answers("::1")) throw new Error(TAKEN);
  Object.assign(process.env, PLAIN);
  execFileSync(process.execPath, [path.join(ROOT, "node_modules", "vite", "bin", "vite.js"), "build", "--logLevel", "warn"],
    /* what the build says, on stderr: stdout is a reporter's */
    { cwd: ROOT, stdio: ["ignore", process.stderr, process.stderr] });
  let server;
  try {
    server = await preview({ root: ROOT, logLevel: "warn", preview: { port: PORT, strictPort: true, open: false } });
  } catch (e) {
    /* taken between the look above and the listen */
    throw new Error(/already in use/i.test(String(e && e.message)) ? TAKEN : `The preview of dist/ did not start: ${e && e.message}`, { cause: e });
  }
  return () => server.close();
}
