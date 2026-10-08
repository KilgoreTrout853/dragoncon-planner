// @vitest-environment node
/* public/sw.js, run in Node against stand-ins for what a browser hands a
   service worker - self, caches, fetch and its clients - so that its rules
   are tested by what they do: when it tells the page of a new schedule
   (DECISIONS #42, #49), what its stamps name, and which caches it clears. A
   harness of fakes, not a browser: registration, an event's lifetime and a
   real CacheStorage are a browser test's, still to write (#24, #81), and this
   does not stand in for one. New tests, not rows of tests/PORT-LEDGER.md. What the
   build does to the file is tests/build.test.js's. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = fs.readFileSync(path.join(ROOT, "public", "sw.js"), "utf8");
const ORIGIN = "https://example.test";

/* A CacheStorage: named caches, each a list of what it was given, in the
   order it was put, under the whole URL, query and all - as a browser's
   keeps it. A put replaces the entry its URL already has and appends; a
   match finds the first entry whose URL is the one asked for, or, with
   ignoreSearch, the first whose URL is that one less both queries. */
function fakeCaches(names = []) {
  const store = new Map(names.map(name => [name, []]));
  const urlOf = r => new URL(typeof r === "string" ? r : r.url, `${ORIGIN}/`).href;
  const bare = url => url.split("?")[0];
  const open = name => {
    if (!store.has(name)) store.set(name, []);
    const cache = store.get(name);
    return {
      async match(r, { ignoreSearch = false } = {}) {
        const url = urlOf(r), hit = cache.find(e => (ignoreSearch ? bare(e.url) === bare(url) : e.url === url));
        return hit === undefined ? undefined : new Response(hit.body);
      },
      async put(r, res) {
        const url = urlOf(r), body = await res.text(), at = cache.findIndex(e => e.url === url);
        if (at >= 0) cache.splice(at, 1);
        cache.push({ url, body });
      },
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

/* A launch of the page at an address: the worker answers it - from the
   network or, failing that, its cache - and the test waits for the late
   arrival it keeps alive too. The network answers net.page, or fails while
   it is null: offline. */
async function launch(w, address) {
  const waits = [];
  let answer;
  w.listeners.fetch({ request: new Request(`${ORIGIN}${address}`), respondWith: p => { answer = p; }, waitUntil: p => waits.push(p) });
  const text = await (await answer).text();
  await Promise.allSettled(waits);
  return text;
}
function pageWorker() {
  const net = { page: null };
  const w = worker({ network: async () => { if (net.page === null) throw new TypeError("offline"); return new Response(net.page); } });
  return { w, net };
}
const kept = w => (w.caches.store.get(w.CACHE) || []).map(e => e.url);

describe("the page it keeps", () => {
  it("an invite's address opened, then a plain launch online: offline, the latest page", async () => {
    const { w, net } = pageWorker();
    net.page = "the page as it was";
    expect(await launch(w, "/?join=2026.x")).toBe("the page as it was");
    net.page = "the latest page";
    expect(await launch(w, "/")).toBe("the latest page");
    net.page = null;
    expect(await launch(w, "/")).toBe("the latest page");
  });
  it("one page kept, under its address less the query, whatever the address it was asked for", async () => {
    const { w, net } = pageWorker();
    for (const [address, page] of [["/?join=2026.x", "one"], ["/?day=2026.sat.0123abcd", "two"], ["/?now=2026-09-05T14:15", "three"]]) {
      net.page = page;
      await launch(w, address);
    }
    expect(kept(w)).toEqual([`${ORIGIN}/`]);
  });
  it("offline, an address with a query opens the latest page", async () => {
    const { w, net } = pageWorker();
    net.page = "the latest page";
    await launch(w, "/");
    net.page = null;
    expect(await launch(w, "/?day=2026.sat.0123abcd")).toBe("the latest page");
  });
  it("offline with no page kept under the address, the shell's index.html", async () => {
    const { w } = pageWorker();
    await (await w.caches.api.open(w.CACHE)).put(`${ORIGIN}/index.html`, new Response("the shell's page"));
    expect(await launch(w, "/?join=2026.x")).toBe("the shell's page");
  });
  it("the schedule is still found with a query, by ignoreSearch", async () => {
    const { w } = pageWorker();
    await (await w.caches.api.open(w.CACHE)).put(`${ORIGIN}/${w.DATA}?v=1`, new Response(JSON.stringify(copy("x", "d1"))));
    const waits = [];
    let answer;
    w.listeners.fetch({ request: new Request(`${ORIGIN}/${w.DATA}`), respondWith: p => { answer = p; }, waitUntil: p => waits.push(p) });
    await Promise.allSettled(waits);
    expect((await (await answer).json()).digest).toBe("d1");
  });
});

describe("what the stamps name", () => {
  it("unstamped: 2026's schedule, in the shell, and the cache dc26-v8", () => {
    const w = worker();
    expect([w.DATA, w.CACHE]).toEqual(["data/2026/events.v2.json", "dc26-v8"]);
    expect(w.SHELL).toContain("./data/2026/events.v2.json");
  });
  it("the year and the channel stamped: 2027's schedule, in the shell, and dc27-next-v8", () => {
    const w = worker({ year: "2027", channel: "next" });
    expect([w.DATA, w.CACHE]).toEqual(["data/2027/events.v2.json", "dc27-next-v8"]);
    expect(w.SHELL).toContain("./data/2027/events.v2.json");
    expect(w.SHELL).not.toContain("./data/2026/events.v2.json");
  });
});

/* Every cache a device might hold on this origin: the live site's and the
   next site's of three years, a channel whose name begins with next, a name
   that only begins like one of ours, and someone else's. */
const HELD = ["dc25-v4", "dc26-v7", "dc26-v8", "dc27-v8", "dc26-next-v7", "dc26-next-v8", "dc27-next-v8", "dc26-next2-v1", "dc26-v6-old", "other-v1"];
async function activate(stamps) {
  const w = worker({ ...stamps, caches: fakeCaches(HELD) });
  const waits = [];
  w.listeners.activate({ waitUntil: p => waits.push(p) });
  await Promise.all(waits);
  return HELD.filter(name => !w.caches.store.has(name));
}

describe("which caches a new worker clears", () => {
  it("the live site's clears its own of every other year and version, and never the next site's", async () => {
    expect(await activate({})).toEqual(["dc25-v4", "dc26-v7", "dc27-v8"]);
  });
  it("the next site's clears the next site's of every other year and version, and never the live site's", async () => {
    expect(await activate({ channel: "next" })).toEqual(["dc26-next-v7", "dc27-next-v8"]);
  });
  it("2027's live worker clears 2026's", async () => {
    expect(await activate({ year: "2027" })).toEqual(["dc25-v4", "dc26-v7", "dc26-v8"]);
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
