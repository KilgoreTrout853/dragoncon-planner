// @vitest-environment node
/* public/sw.js, run in Node against stand-ins for what a browser hands a
   service worker - self, caches, fetch and its clients - so that its rules
   are tested by what they do: when it tells the page of a new schedule
   (DECISIONS #42, #49), what its stamps name, and which caches it clears. A
   harness of fakes, not a browser: registration, an event's lifetime and a
   real CacheStorage are Playwright's, still deferred (#24), and this does not
   stand in for it. New tests, not rows of tests/PORT-LEDGER.md. What the
   build does to the file is tests/build.test.js's. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = fs.readFileSync(path.join(ROOT, "public", "sw.js"), "utf8");
const ORIGIN = "https://example.test";

/* A CacheStorage: named caches, each a Map from a URL, less its query, to
   what it was given. */
function fakeCaches(names = []) {
  const store = new Map(names.map(name => [name, new Map()]));
  const keyOf = r => new URL(typeof r === "string" ? r : r.url, `${ORIGIN}/`).href.split("?")[0];
  const open = name => {
    if (!store.has(name)) store.set(name, new Map());
    const cache = store.get(name);
    return {
      async match(r) { const hit = cache.get(keyOf(r)); return hit === undefined ? undefined : new Response(hit); },
      async put(r, res) { cache.set(keyOf(r), await res.text()); },
    };
  };
  return { store, api: { open: async name => open(name), keys: async () => [...store.keys()], delete: async name => store.delete(name) } };
}

/* The worker as a site would run it: its stamps written in as the build
   writes them, its listeners kept, and what it posts to the page kept. */
function worker({ year, channel, caches = fakeCaches(), network = async () => new Response("{}") } = {}) {
  const listeners = {}, messages = [];
  const self = {
    location: new URL(`${ORIGIN}/`),
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => [{ postMessage: message => messages.push(message) }] },
  };
  let text = SOURCE;
  if (year) text = text.replace('const YEAR = "2026";', `const YEAR = "${year}";`);
  if (channel) text = text.replace('const CHANNEL = "";', `const CHANNEL = "${channel}";`);
  const names = new Function("self", "caches", "fetch", `${text}\nreturn {CACHE, DATA, SHELL};`)(self, caches.api, network);
  return { ...names, listeners, messages, caches };
}

/* The page asks for the schedule: the worker answers from its cache and looks
   for a newer copy behind it, and the test waits for both. */
async function askForSchedule(w) {
  const waits = [];
  let answer;
  w.listeners.fetch({ request: new Request(`${ORIGIN}/${w.DATA}`), respondWith: p => { answer = p; }, waitUntil: p => waits.push(p) });
  await Promise.all(waits);
  return answer;
}

const copy = (generated_at, digest) => ({ generated_at, ...(digest ? { digest } : {}), events: [] });
async function revalidate({ cached, fresh }) {
  const w = worker({ network: async () => new Response(JSON.stringify(fresh)) });
  if (cached) await (await w.caches.api.open(w.CACHE)).put(`${ORIGIN}/${w.DATA}`, new Response(JSON.stringify(cached)));
  await askForSchedule(w);
  return w;
}

describe("when the worker tells the page of a new schedule", () => {
  it("a new digest is news, though generated_at is the same, and the message carries both", async () => {
    const w = await revalidate({ cached: copy("2026-09-07T12:50:19+00:00", "d1"), fresh: copy("2026-09-07T12:50:19+00:00", "d2") });
    expect(w.messages).toEqual([{ type: "schedule-updated", digest: "d2", generated_at: "2026-09-07T12:50:19+00:00" }]);
  });
  it("the same digest is no news, though generated_at moved", async () => {
    const w = await revalidate({ cached: copy("2026-09-07T12:50:19+00:00", "d1"), fresh: copy("2026-09-08T12:00:00+00:00", "d1") });
    expect(w.messages).toEqual([{ type: "schedule-online" }]);
  });
  it("a cached copy with no digest is judged by generated_at: moved, it is news", async () => {
    const w = await revalidate({ cached: copy("2026-09-07T12:50:19+00:00"), fresh: copy("2026-09-08T12:00:00+00:00", "d2") });
    expect(w.messages).toEqual([{ type: "schedule-updated", digest: "d2", generated_at: "2026-09-08T12:00:00+00:00" }]);
  });
  it("and unmoved, it is not, whatever the fresh copy's digest", async () => {
    const w = await revalidate({ cached: copy("2026-09-07T12:50:19+00:00"), fresh: copy("2026-09-07T12:50:19+00:00", "d2") });
    expect(w.messages).toEqual([{ type: "schedule-online" }]);
  });
  it("a fresh copy with no digest is judged by generated_at too", async () => {
    const w = await revalidate({ cached: copy("2026-09-07T12:50:19+00:00", "d1"), fresh: copy("2026-09-08T12:00:00+00:00") });
    expect(w.messages).toEqual([{ type: "schedule-updated", digest: undefined, generated_at: "2026-09-08T12:00:00+00:00" }]);
  });
  it("either way the cache takes the fresh copy", async () => {
    const w = await revalidate({ cached: copy("2026-09-07T12:50:19+00:00", "d1"), fresh: copy("2026-09-07T12:50:19+00:00", "d2") });
    const held = await (await w.caches.api.open(w.CACHE)).match(`${ORIGIN}/${w.DATA}`);
    expect((await held.json()).digest).toBe("d2");
  });
  it("with nothing cached, it keeps the copy it fetched and says nothing", async () => {
    const w = await revalidate({ fresh: copy("2026-09-07T12:50:19+00:00", "d1") });
    expect(w.messages).toEqual([]);
    expect(await (await w.caches.api.open(w.CACHE)).match(`${ORIGIN}/${w.DATA}`)).toBeDefined();
  });
  it("with no network, it answers from the cache and says it is offline", async () => {
    const w = worker({ network: async () => { throw new TypeError("offline"); } });
    await (await w.caches.api.open(w.CACHE)).put(`${ORIGIN}/${w.DATA}`, new Response(JSON.stringify(copy("x", "d1"))));
    const answer = await askForSchedule(w);
    expect((await answer.json()).digest).toBe("d1");
    expect(w.messages).toEqual([{ type: "schedule-offline" }]);
  });
});

describe("what the stamps name", () => {
  it("unstamped: 2026's schedule, in the shell, and the cache dc26-v6", () => {
    const w = worker();
    expect([w.DATA, w.CACHE]).toEqual(["data/2026/events.v2.json", "dc26-v6"]);
    expect(w.SHELL).toContain("./data/2026/events.v2.json");
  });
  it("the year and the channel stamped: 2027's schedule, in the shell, and dc27-next-v6", () => {
    const w = worker({ year: "2027", channel: "next" });
    expect([w.DATA, w.CACHE]).toEqual(["data/2027/events.v2.json", "dc27-next-v6"]);
    expect(w.SHELL).toContain("./data/2027/events.v2.json");
    expect(w.SHELL).not.toContain("./data/2026/events.v2.json");
  });
});

/* Every cache a device might hold on this origin: the live site's and the
   next site's of three years, a channel whose name begins with next, a name
   that only begins like one of ours, and someone else's. */
const HELD = ["dc25-v4", "dc26-v5", "dc26-v6", "dc27-v6", "dc26-next-v5", "dc26-next-v6", "dc27-next-v6", "dc26-next2-v1", "dc26-v5-old", "other-v1"];
async function activate(stamps) {
  const w = worker({ ...stamps, caches: fakeCaches(HELD) });
  const waits = [];
  w.listeners.activate({ waitUntil: p => waits.push(p) });
  await Promise.all(waits);
  return HELD.filter(name => !w.caches.store.has(name));
}

describe("which caches a new worker clears", () => {
  it("the live site's clears its own of every other year and version, and never the next site's", async () => {
    expect(await activate({})).toEqual(["dc25-v4", "dc26-v5", "dc27-v6"]);
  });
  it("the next site's clears the next site's of every other year and version, and never the live site's", async () => {
    expect(await activate({ channel: "next" })).toEqual(["dc26-next-v5", "dc27-next-v6"]);
  });
  it("2027's live worker clears 2026's", async () => {
    expect(await activate({ year: "2027" })).toEqual(["dc25-v4", "dc26-v5", "dc26-v6"]);
  });
});

/* The backend's requests go through src/backend.js, and the worker passes
   them untouched (DECISIONS #53): it answers nothing that is not a GET, and
   no GET to another origin but the fonts'. */
describe("a request to the backend", () => {
  const BACKEND = "https://backend.test";
  const handled = request => {
    const w = worker({ network: async () => { throw new Error("the worker fetched for the page"); } });
    let answered = false, waited = false;
    w.listeners.fetch({ request, respondWith: () => { answered = true; }, waitUntil: () => { waited = true; } });
    return { answered, waited };
  };

  it("a POST - a sign-in, a code, an upsert - is not the worker's to answer", () => {
    expect(handled(new Request(`${BACKEND}/auth/v1/signup`, { method: "POST", body: "{}" }))).toEqual({ answered: false, waited: false });
    expect(handled(new Request(`${BACKEND}/rest/v1/picks`, { method: "POST", body: "[]" }))).toEqual({ answered: false, waited: false });
  });
  it("nor a PUT, nor a GET to the backend's origin", () => {
    expect(handled(new Request(`${BACKEND}/auth/v1/user`, { method: "PUT", body: "{}" }))).toEqual({ answered: false, waited: false });
    expect(handled(new Request(`${BACKEND}/rest/v1/picks?select=*`))).toEqual({ answered: false, waited: false });
  });
});
