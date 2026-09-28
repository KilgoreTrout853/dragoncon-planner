// @vitest-environment node
/* The push job's sender, supabase/functions/push/push.js (DECISIONS #55; docs/sync/contract.md, section 7),
   run in Node: its pure parts, and its handler against a fake PostgREST, fake push services, a fake encoder and
   a clock the test moves. Every request it makes is recorded, so each test says what went where. The Deno
   entry, index.js, is the hand test's. */
import { describe, expect, it } from "vitest";
import {
  BATCHES, BUDGET_MS, CHANGE_ORDER, FOLD_LINES, IN_FLIGHT, NO_START_TTL, PICK_CHANGED, PROBE_SUBSCRIPTION, SEND_TIMEOUT_MS,
  STARTS_SOON, fold, inList, makeHandler, message, parseBody, place, sameSecret, sayChange, sayChanges, sayTime,
  serviceHeaders, verdict,
} from "../../supabase/functions/push/push.js";

const API = "http://kong:8000";
const SECRET = "the-push-secret-0123456789";
const SB = "sb_secret_0123456789abcdefghijklmnopqrstuv";
const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2lnbmF0dXJl";
const ENV = { SUPABASE_URL: API, SUPABASE_SECRET_KEYS: JSON.stringify({ default: SB }), SUPABASE_SERVICE_ROLE_KEY: JWT,
              PUSH_SECRET: SECRET };
const ADA = "a0000000-0000-4000-a000-00000000000a";
const BO = "b0000000-0000-4000-a000-00000000000b";
const START = "2027-09-03T15:00:00+00:00";
const CLOCK = Date.parse("2027-09-03T14:50:00Z");   // the wall clock as a run starts: ten minutes before START
const WRITE = "handling=strict,return=minimal,count=exact";
const ADA_1 = { endpoint: "https://fcm.example/send/ada-1", p256dh: "k1", auth: "a1" };
const ADA_2 = { endpoint: "https://updates.example/wpush/ada-2", p256dh: "k2", auth: "a2" };
const BO_1 = { endpoint: "https://fcm.example/send/bo-1", p256dh: "k3", auth: "a3" };

/* A starts-soon row as push_due() returns one: its key the event's id. */
function row(over = {}) {
  const r = { kind: STARTS_SOON, user_id: ADA, year: 2027, event_id: "e1", title: "Due Panel", start: START, hotel: "Hyatt",
              room: "Regency V", minutes_until: 10, run: null, changes: null, endpoints: [ADA_1], ...over };
  return { key: r.event_id, ...r };
}

/* A run's world: PostgREST's answers, each push service's, the encoder and the clock. push_due() answers each call
   with the next of `batches` - `rows` alone, unless given - and then with nothing. `push` maps an endpoint to its
   status, or to an Error for no answer; `rpcTakes` moves the clock while push_due() runs. */
function world({ env = ENV, flag = [{ value: true }], rows = [], batches = [rows], push = {}, rest = {}, unusable = [],
                 probeRefused = null, rpcTakes = 0, sendTakes = 0 } = {}) {
  const requests = [];
  const encoded = [];
  const logs = [];
  const answers = [...batches];
  let time = CLOCK;
  const reply = (status, body = "", headers = {}) =>
    new Response(status === 204 ? null : body, { status, headers: { "Content-Type": "application/json", ...headers } });
  const keysIn = (query) => (/^in\.\((.*)\)$/.exec(query.get("key"))?.[1].match(/"(?:[^"\\]|\\.)*"/g) ?? []).length;
  async function fetch(url, init = {}) {
    const u = new URL(url);
    const req = { url: String(url), path: u.pathname, query: u.searchParams, method: init.method ?? "GET",
                  headers: init.headers ?? {}, body: init.body, redirect: init.redirect, signal: init.signal };
    requests.push(req);
    if (u.origin === API) {
      const route = `${req.method} ${u.pathname}`;
      if (rest[route]) return rest[route](req);
      if (route === "GET /rest/v1/flags") return reply(200, JSON.stringify(flag));
      if (route === "POST /rest/v1/rpc/push_due") {
        time += rpcTakes;
        return reply(200, JSON.stringify(answers.shift() ?? []));
      }
      if (route === "PATCH /rest/v1/push_sent" || route === "DELETE /rest/v1/push_sent") {
        return reply(204, "", { "Content-Range": `*/${keysIn(u.searchParams)}` });
      }
      if (route === "DELETE /rest/v1/push_subscriptions") return reply(204, "", { "Content-Range": "*/1" });
      throw new Error(`no route for ${route}`);
    }
    time += sendTakes;
    const answer = push[url] ?? 201;
    if (answer instanceof Error) throw answer;
    return reply(answer, answer >= 400 ? `the service says ${answer}` : "");
  }
  function encode(subscription, payload, options) {
    if (subscription === PROBE_SUBSCRIPTION) {
      if (probeRefused) throw new Error(probeRefused);
      return { endpoint: subscription.endpoint, method: "POST", headers: {}, body: payload };
    }
    if (unusable.includes(subscription.endpoint)) throw new Error("The subscription p256dh value should be 65 bytes long.");
    encoded.push({ subscription, payload: JSON.parse(payload), options });
    return { endpoint: subscription.endpoint, method: "POST", headers: { TTL: options.ttl, "Content-Encoding": "aes128gcm" },
             body: `sealed:${payload}` };
  }
  const handle = makeHandler({ env, fetch, encode, clock: () => time, log: (line) => logs.push(line) });
  const post = (body, headers = { "x-push-secret": SECRET }) =>
    handle(new Request("https://edge.example/functions/v1/push", { method: "POST", headers, body: body ?? "" }));
  const rpcs = () => requests.filter((r) => r.path === "/rest/v1/rpc/push_due");
  const sends = () => requests.filter((r) => !r.url.startsWith(API));
  const writes = () => requests.filter((r) => r.url.startsWith(API) && r.method !== "GET" && !r.path.includes("/rpc/"));
  // Every request after the switch, in order, as a word: due, send <endpoint>, ack, release or prune.
  const steps = () => requests.slice(1).map((r) => {
    if (r.path === "/rest/v1/rpc/push_due") return "due";
    if (!r.url.startsWith(API)) return `send ${r.url}`;
    if (r.path === "/rest/v1/push_subscriptions") return "prune";
    return r.method === "PATCH" ? "ack" : "release";
  });
  return { requests, encoded, logs, post, rpcs, sends, writes, steps, handle, advance: (ms) => { time += ms; } };
}

const claimsOf = (req) => Object.fromEntries(req.query);

describe("the pure parts", () => {
  it("compares the caller's secret with ours, all of it", () => {
    expect(sameSecret(SECRET, SECRET)).toBe(true);
    expect(sameSecret(`${SECRET.slice(0, -1)}X`, SECRET)).toBe(false);
    expect(sameSecret(`${SECRET}0`, SECRET)).toBe(false);
    expect(sameSecret(null, SECRET)).toBe(false);
    expect(sameSecret("", "")).toBe(false);
  });

  it("takes the runtime's default secret key on apikey alone, else the legacy JWT as the bearer too", () => {
    expect(serviceHeaders(ENV)).toEqual({ apikey: SB });
    expect(serviceHeaders({ ...ENV, SUPABASE_SECRET_KEYS: undefined })).toEqual({ apikey: JWT, Authorization: `Bearer ${JWT}` });
    expect(serviceHeaders({ ...ENV, SUPABASE_SECRET_KEYS: "{not json" })).toEqual({ apikey: JWT, Authorization: `Bearer ${JWT}` });
    expect(serviceHeaders({ ...ENV, SUPABASE_SECRET_KEYS: JSON.stringify({ other: SB }) }).apikey).toBe(JWT);
    expect(serviceHeaders({ SUPABASE_URL: API })).toBeNull();
  });

  it("shows a place as the hotel and the room, whichever it has", () => {
    expect(place({ hotel: "Hyatt", room: "Regency V" })).toBe("Hyatt Regency V");
    expect(place({ hotel: "Marriott", room: null })).toBe("Marriott");
    expect(place({ hotel: null, room: null })).toBe("");
  });

  it("writes a PostgREST in list with every value quoted and escaped", () => {
    expect(inList(["e1", "a1b2.1", 'say "hi"', "back\\slash", "x,y(z)"]))
      .toBe('("e1","a1b2.1","say \\"hi\\"","back\\\\slash","x,y(z)")');
  });

  it("reads a push service's answer: sent, dead, retry or refused", () => {
    expect([200, 201, 202].map(verdict)).toEqual(["sent", "sent", "sent"]);
    expect([404, 410].map(verdict)).toEqual(["dead", "dead"]);
    expect([0, 429, 500, 502, 503].map(verdict)).toEqual(["retry", "retry", "retry", "retry", "retry"]);
    expect([400, 401, 403, 413].map(verdict)).toEqual(["refused", "refused", "refused", "refused"]);
    expect([299, 300, 304].map(verdict)).toEqual(["sent", "refused", "refused"]);   // a 3xx that reaches it: redirects throw
  });

  it("takes a body of nothing, or an object with an ISO `at` and a boolean `dry`", () => {
    expect(parseBody("")).toEqual({ at: undefined, dry: false });
    expect(parseBody("{}")).toEqual({ at: undefined, dry: false });
    expect(parseBody('{"at": "2027-09-03T14:50:00Z", "dry": true}')).toEqual({ at: "2027-09-03T14:50:00Z", dry: true });
    expect(parseBody('{"at": "2027-09-03T14:50:00-04:00"}').at).toBe("2027-09-03T14:50:00-04:00");
    for (const bad of ["{", "[]", "null", '"at"', '{"at": "2027-09-03T14:50"}', '{"at": "soon+01:00"}', '{"at": 5}',
                       '{"dry": "yes"}']) {
      expect(() => parseBody(bad), bad).toThrow();
    }
  });

  it("folds a user's picks that share a start into one push, in push_due()'s order", () => {
    const later = "2027-09-03T16:00:00Z";
    const pushes = fold([row({ event_id: "e1" }), row({ event_id: "e2", start: "2027-09-03T15:00:00Z" }),
                         row({ event_id: "e3", start: later }), row({ user_id: BO, event_id: "e1", endpoints: [BO_1] })]);
    expect(pushes.map((p) => [p.user_id, p.rows.map((r) => r.event_id)]))
      .toEqual([[ADA, ["e1", "e2"]], [ADA, ["e3"]], [BO, ["e1"]]]);
    expect(pushes[2]).toMatchObject({ year: 2027, start: START, endpoints: [BO_1] });
  });

  it("makes one push's message: the event's title and where, and the minutes counted as it is sent", () => {
    const at = Date.parse(START) - 9.5 * 60000;
    expect(message(fold([row()])[0], at)).toEqual({
      payload: { kind: STARTS_SOON, year: 2027, event_ids: ["e1"], title: "Due Panel", body: "Starts in 10 min · Hyatt Regency V" },
      ttl: 570, urgency: "high" });
    expect(message(fold([row({ hotel: null, room: null })])[0], at).payload.body).toBe("Starts in 10 min");
    const late = message(fold([row()])[0], Date.parse(START) + 1000);
    expect([late.payload.body, late.ttl]).toEqual(["Starting now · Hyatt Regency V", 0]);
  });

  it("makes a fold's message: how many picks start, and one line an event", () => {
    const rows = [row({ event_id: "e1", title: "Also Panel", hotel: "Marriott", room: null }), row({ event_id: "e2" })];
    const { payload, ttl } = message(fold(rows)[0], Date.parse(START) - 5 * 60000);
    expect(payload).toEqual({ kind: STARTS_SOON, year: 2027, event_ids: ["e1", "e2"], title: "2 picks start in 5 min",
                              body: "Also Panel · Marriott\nDue Panel · Hyatt Regency V" });
    expect(ttl).toBe(300);
    expect(message(fold(rows)[0], Date.parse(START)).payload.title).toBe("2 picks start now");
    const many = Array.from({ length: FOLD_LINES + 2 }, (_, i) => row({ event_id: `e${i}`, title: `Panel ${i}`, room: null }));
    const big = message(fold(many)[0], Date.parse(START) - 60000).payload;
    expect(big.event_ids).toHaveLength(FOLD_LINES + 2);
    expect(big.body.split("\n")).toHaveLength(FOLD_LINES + 1);
    expect(big.body.split("\n").at(-1)).toBe("and 2 more");
  });
});

describe("the handler: who may call it", () => {
  it("answers only a POST", async () => {
    const w = world();
    const res = await w.handle(new Request("https://edge.example/functions/v1/push", { method: "GET" }));
    expect(res.status).toBe(405);
    expect(w.requests).toEqual([]);
  });

  it("refuses a caller without our secret, or with another, and asks nothing", async () => {
    const w = world();
    expect((await w.post("{}", {})).status).toBe(401);
    expect((await w.post("{}", { "x-push-secret": `${SECRET}!` })).status).toBe(401);
    expect((await w.post("{}", { "x-push-secret": SECRET.replace(/.$/, "?") })).status).toBe(401);
    expect(w.requests).toEqual([]);
  });

  it("fails, and says so, with no secret of its own, no service key, or VAPID keys the encoder refuses", async () => {
    for (const [env, probeRefused, words] of [
      [{ ...ENV, PUSH_SECRET: "" }, null, "PUSH_SECRET is not set"],
      [{ SUPABASE_URL: API, PUSH_SECRET: SECRET }, null, "no service key"],
      [ENV, "No subject set in vapidDetails.subject.", "the encoder refuses our VAPID keys: No subject set"],
    ]) {
      const w = world({ env, probeRefused });
      const res = await w.post("{}");
      expect(res.status).toBe(500);
      expect((await res.json()).error).toContain(words);
      expect(w.logs.join("\n")).toContain(words);
      expect(w.requests).toEqual([]);
    }
  });

  it("refuses a body it cannot read, before any request", async () => {
    const w = world();
    const res = await w.post('{"at": "tomorrow"}');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "at is an ISO date and time with its offset" });
    expect(w.requests).toEqual([]);
  });
});

describe("the handler: the switch and push_due()", () => {
  it("reads the kill switch first, and with it off asks for nothing more", async () => {
    for (const flag of [[{ value: false }], [], [{ value: "true" }]]) {
      const w = world({ flag, rows: [row()] });
      const res = await w.post("");
      expect([res.status, await res.json()])
        .toEqual([200, { off: true, batches: 0, due: 0, sent: 0, released: 0, pruned: 0 }]);
      expect(w.requests.map((r) => `${r.method} ${r.url}`))
        .toEqual([`GET ${API}/rest/v1/flags?select=value&name=eq.push_enabled`]);
      expect(w.logs).toEqual(['push: {"off":true,"batches":0,"due":0,"sent":0,"released":0,"pruned":0}']);
    }
  });

  it("sends the secret key on apikey alone, and a legacy JWT as the bearer too, on every request", async () => {
    const w = world({ rows: [row()] });
    await w.post("");
    expect(w.requests.filter((r) => r.url.startsWith(API)).every((r) => r.headers.apikey === SB && !r.headers.Authorization))
      .toBe(true);
    const legacy = world({ env: { ...ENV, SUPABASE_SECRET_KEYS: "" }, rows: [row()] });
    await legacy.post("");
    expect(legacy.requests.filter((r) => r.url.startsWith(API))
      .every((r) => r.headers.apikey === JWT && r.headers.Authorization === `Bearer ${JWT}`)).toBe(true);
  });

  it("asks push_due() with no arguments, or with the `at` and the `dry` it was given", async () => {
    const w = world();
    await w.post("");
    await w.post('{"dry": false}');
    await w.post('{"at": "2026-09-05T14:50:00Z"}');
    await w.post('{"at": "2026-09-05T14:50:00Z", "dry": true}');
    expect(w.rpcs().map((r) => [r.method, r.headers["Content-Type"], JSON.parse(r.body)])).toEqual([
      ["POST", "application/json", {}], ["POST", "application/json", {}],
      ["POST", "application/json", { at: "2026-09-05T14:50:00Z" }],
      ["POST", "application/json", { at: "2026-09-05T14:50:00Z", dry: true }],
    ]);
  });

  it("with dry, sends nothing and writes nothing, and shows what it would send", async () => {
    const w = world({ rows: [row({ endpoints: [ADA_1, ADA_2] }), row({ user_id: BO, endpoints: [BO_1] })] });
    const res = await w.post(JSON.stringify({ at: "2027-09-03T14:52:00Z", dry: true }));
    expect(await res.json()).toEqual({
      off: false, batches: 1, due: 2, sent: 0, released: 0, pruned: 0, dry: true,
      pushes: [
        { kind: STARTS_SOON, user_id: ADA, event_ids: ["e1"], title: "Due Panel", body: "Starts in 8 min · Hyatt Regency V",
          ttl: 480, browsers: 2 },
        { kind: STARTS_SOON, user_id: BO, event_ids: ["e1"], title: "Due Panel", body: "Starts in 8 min · Hyatt Regency V",
          ttl: 480, browsers: 1 },
      ],
    });
    expect([w.sends(), w.writes(), w.encoded]).toEqual([[], [], []]);
  });

  it("fails the run when PostgREST refuses, and sends nothing", async () => {
    const w = world({ rest: { "POST /rest/v1/rpc/push_due": () => new Response('{"message":"boom"}', { status: 500 }) } });
    const res = await w.post("");
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('POST /rest/v1/rpc/push_due answered 500: {"message":"boom"}');
    expect(w.sends()).toEqual([]);
  });
});

describe("the handler: sending", () => {
  it("sends each push to each of the user's browsers, encrypted and signed by the encoder", async () => {
    const w = world({ rows: [row({ endpoints: [ADA_1, ADA_2] })] });
    await w.post("");
    expect(w.encoded.map((e) => e.subscription)).toEqual([
      { endpoint: ADA_1.endpoint, keys: { p256dh: "k1", auth: "a1" } },
      { endpoint: ADA_2.endpoint, keys: { p256dh: "k2", auth: "a2" } },
    ]);
    expect(w.encoded[0].payload).toEqual({ kind: STARTS_SOON, year: 2027, event_ids: ["e1"], title: "Due Panel",
                                           body: "Starts in 10 min · Hyatt Regency V" });
    expect(w.encoded[0].options).toEqual({ ttl: 600, urgency: "high" });
    expect(w.sends().map((s) => [s.url, s.method, s.body, s.redirect, s.signal instanceof AbortSignal])).toEqual([
      [ADA_1.endpoint, "POST", `sealed:${JSON.stringify(w.encoded[0].payload)}`, "error", true],
      [ADA_2.endpoint, "POST", `sealed:${JSON.stringify(w.encoded[1].payload)}`, "error", true],
    ]);
    expect(w.sends()[0].headers).toEqual({ TTL: 600, "Content-Encoding": "aes128gcm" });
  });

  it("counts the minutes and the TTL as it sends: from `at` where given, the time the run took added", async () => {
    const w = world({ rows: [row()], rpcTakes: 90000 });
    await w.post(JSON.stringify({ at: "2027-09-03T14:48:00Z" }));
    expect([w.encoded[0].payload.body, w.encoded[0].options.ttl]).toEqual(["Starts in 11 min · Hyatt Regency V", 630]);
    const clockOnly = world({ rows: [row()], rpcTakes: 90000 });
    await clockOnly.post("");
    expect([clockOnly.encoded[0].payload.body, clockOnly.encoded[0].options.ttl])
      .toEqual(["Starts in 9 min · Hyatt Regency V", 510]);
    const partSecond = world({ rows: [row()], rpcTakes: 90500 });
    await partSecond.post("");
    expect(partSecond.encoded[0].options.ttl).toBe(509);   // never past the start
  });

  it("makes one message a push: every browser of it gets the same words, though sending takes time", async () => {
    const w = world({ rows: [row({ endpoints: [ADA_1, ADA_2] })], sendTakes: 60000 });
    await w.post("");
    expect(w.encoded).toHaveLength(2);
    expect(w.encoded[1].payload).toEqual(w.encoded[0].payload);
    expect(w.encoded[1].options).toEqual(w.encoded[0].options);
  });

  it("folds a user's picks at one start into one push, and acks every key", async () => {
    const w = world({ rows: [row({ event_id: "e1", title: "Also Panel" }), row({ event_id: "e2" }),
                             row({ user_id: BO, event_id: "e2", endpoints: [BO_1] })] });
    const res = await w.post("");
    expect(w.encoded.map((e) => [e.subscription.endpoint, e.payload.title, e.payload.event_ids])).toEqual([
      [ADA_1.endpoint, "2 picks start in 10 min", ["e1", "e2"]],
      [BO_1.endpoint, "Due Panel", ["e2"]],
    ]);
    const acks = w.writes();
    expect(acks.map((r) => [r.method, r.path, claimsOf(r), r.headers.Prefer])).toEqual([
      ["PATCH", "/rest/v1/push_sent", { user_id: `eq.${ADA}`, kind: "eq.starts-soon", key: 'in.("e1","e2")',
                                        sent_at: "is.null" }, WRITE],
      ["PATCH", "/rest/v1/push_sent", { user_id: `eq.${BO}`, kind: "eq.starts-soon", key: 'in.("e2")',
                                        sent_at: "is.null" }, WRITE],
    ]);
    expect(await res.json()).toEqual({ off: false, batches: 1, due: 3, sent: 3, released: 0, pruned: 0 });
  });

  it("acks with the real clock, never the `at` it was given", async () => {
    const w = world({ rows: [row()], rpcTakes: 2000 });
    await w.post(JSON.stringify({ at: "2026-09-05T14:50:00Z" }));
    expect(JSON.parse(w.writes()[0].body)).toEqual({ sent_at: new Date(CLOCK + 2000).toISOString() });
  });

  it("acks where one browser took it, and prunes one that is gone", async () => {
    const w = world({ rows: [row({ endpoints: [ADA_1, ADA_2] })], push: { [ADA_2.endpoint]: 410 } });
    const res = await w.post("");
    expect(w.writes().map((r) => [r.method, r.path, claimsOf(r)])).toEqual([
      ["PATCH", "/rest/v1/push_sent", { user_id: `eq.${ADA}`, kind: "eq.starts-soon", key: 'in.("e1")', sent_at: "is.null" }],
      ["DELETE", "/rest/v1/push_subscriptions", { endpoint: `eq.${ADA_2.endpoint}` }],
    ]);
    expect(await res.json()).toEqual({ off: false, batches: 1, due: 1, sent: 1, released: 0, pruned: 1 });
  });

  it("where every browser is gone, prunes each and deletes the claim", async () => {
    const w = world({ rows: [row({ endpoints: [ADA_1, ADA_2] })], push: { [ADA_1.endpoint]: 404, [ADA_2.endpoint]: 410 } });
    const res = await w.post("");
    expect(w.writes().map((r) => [r.method, r.path])).toEqual([
      ["DELETE", "/rest/v1/push_subscriptions"], ["DELETE", "/rest/v1/push_subscriptions"], ["DELETE", "/rest/v1/push_sent"],
    ]);
    expect(claimsOf(w.writes()[2])).toEqual({ user_id: `eq.${ADA}`, kind: "eq.starts-soon", key: 'in.("e1")',
                                              sent_at: "is.null" });
    expect(await res.json()).toEqual({ off: false, batches: 1, due: 1, sent: 0, released: 1, pruned: 2 });
  });

  it("releases the claim for the next minute on a 429, a 5xx or no answer, and prunes only the gone", async () => {
    for (const answers of [[429], [503], [new Error("The signal has been aborted")], [410, 502]]) {
      const endpoints = [ADA_1, ADA_2].slice(0, answers.length);
      const push = Object.fromEntries(endpoints.map((e, i) => [e.endpoint, answers[i]]));
      const w = world({ rows: [row({ endpoints })], push });
      const res = await w.post("");
      expect(res.status).toBe(200);
      expect(w.writes().map((r) => [r.method, r.path])).toEqual([
        ...(answers.includes(410) ? [["DELETE", "/rest/v1/push_subscriptions"]] : []),
        ["DELETE", "/rest/v1/push_sent"],
      ]);
    }
  });

  it("on a refusal - a 401, a 403 or another 4xx - releases the claim, logs it and fails the run", async () => {
    for (const status of [401, 403, 400, 413]) {
      const w = world({ rows: [row()], push: { [ADA_1.endpoint]: status } });
      const res = await w.post("");
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ off: false, batches: 1, due: 1, sent: 0, released: 1, pruned: 0,
        error: "1 push(es) refused by the push service: our VAPID keys or our request" });
      expect(w.writes().map((r) => [r.method, r.path])).toEqual([["DELETE", "/rest/v1/push_sent"]]);
      expect(w.logs).toContain(`push: https://fcm.example refused a push, ${status}: the service says ${status}`);
    }
  });

  it("acks a push one browser took though another refused it, and still fails the run", async () => {
    const w = world({ rows: [row({ endpoints: [ADA_1, ADA_2] })], push: { [ADA_2.endpoint]: 403 } });
    const res = await w.post("");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ off: false, batches: 1, due: 1, sent: 1, released: 0, pruned: 0,
      error: "1 push(es) refused by the push service: our VAPID keys or our request" });
    expect(w.writes().map((r) => [r.method, claimsOf(r)])).toEqual([
      ["PATCH", { user_id: `eq.${ADA}`, kind: "eq.starts-soon", key: 'in.("e1")', sent_at: "is.null" }],
    ]);
  });

  it("where one push service refuses a push and another takes its own, acks the one taken, releases only the refused "
     + "as the run ends, and then fails the run - whichever comes first", async () => {
    const bo = row({ user_id: BO, event_id: "e2", title: "Bo Panel", endpoints: [BO_1] });   // fcm.example: 403
    const ada = row({ endpoints: [ADA_2] });                                               // updates.example: 201
    const ack = ["PATCH", { user_id: `eq.${ADA}`, kind: "eq.starts-soon", key: 'in.("e1")', sent_at: "is.null" }];
    const release = ["DELETE", { user_id: `eq.${BO}`, kind: "eq.starts-soon", key: 'in.("e2")', sent_at: "is.null" }];
    for (const rows of [[bo, ada], [ada, bo]]) {
      const w = world({ rows, push: { [BO_1.endpoint]: 403 } });
      const res = await w.post("");
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ off: false, batches: 1, due: 2, sent: 1, released: 1, pruned: 0,
        error: "1 push(es) refused by the push service: our VAPID keys or our request" });
      expect(w.writes().map((r) => [r.method, claimsOf(r)])).toEqual([ack, release]);
      expect(w.logs).toContain("push: https://fcm.example refused a push, 403: the service says 403");
    }
  });

  it("prunes a browser whose keys the encoder cannot use", async () => {
    const w = world({ rows: [row()], unusable: [ADA_1.endpoint] });
    const res = await w.post("");
    expect(w.sends()).toEqual([]);
    expect(w.writes().map((r) => [r.method, r.path])).toEqual([
      ["DELETE", "/rest/v1/push_subscriptions"], ["DELETE", "/rest/v1/push_sent"],
    ]);
    expect(await res.json()).toEqual({ off: false, batches: 1, due: 1, sent: 0, released: 1, pruned: 1 });
    expect(w.logs[0]).toContain("a browser's keys are unusable");
  });

  it("sends Prefer on every write: the ack, the prune and the release", async () => {
    const w = world({ rows: [row({ endpoints: [ADA_1, ADA_2] }), row({ user_id: BO, event_id: "e2", endpoints: [BO_1] })],
                      push: { [ADA_1.endpoint]: 410, [ADA_2.endpoint]: 503 } });
    await w.post("");
    expect(w.writes().map((r) => [r.method, r.path, r.headers.Prefer])).toEqual([
      ["PATCH", "/rest/v1/push_sent", WRITE], ["DELETE", "/rest/v1/push_subscriptions", WRITE],
      ["DELETE", "/rest/v1/push_sent", WRITE]]);
  });

  it("sends IN_FLIGHT at once and never more, however many browsers a batch has", async () => {
    expect([IN_FLIGHT, SEND_TIMEOUT_MS]).toEqual([50, 10000]);
    const rows = Array.from({ length: 120 }, (_, i) =>
      row({ user_id: `c0000000-0000-4000-a000-${String(i).padStart(12, "0")}`, event_id: `e${i}`,
            endpoints: [{ endpoint: `https://fcm.example/send/u${i}`, p256dh: `k${i}`, auth: `a${i}` }] }));
    let inFlight = 0;
    let peak = 0;
    let calls = 0;
    const fetch = async (url) => {
      const u = new URL(url);
      if (u.origin === API) {
        if (u.pathname === "/rest/v1/flags") return new Response('[{"value": true}]', { status: 200 });
        if (u.pathname === "/rest/v1/rpc/push_due") return new Response(JSON.stringify(calls++ ? [] : rows), { status: 200 });
        return new Response(null, { status: 204, headers: { "Content-Range": "*/1" } });
      }
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return new Response("", { status: 201 });
    };
    const handle = makeHandler({ env: ENV, fetch, clock: () => CLOCK, log: () => {},
      encode: (s, payload) => ({ endpoint: s.endpoint, method: "POST", headers: {}, body: payload }) });
    const res = await handle(new Request("https://edge.example/functions/v1/push",
      { method: "POST", headers: { "x-push-secret": SECRET }, body: "" }));
    expect((await res.json()).sent).toBe(120);
    expect(peak).toBe(IN_FLIGHT);
  });

  it("quotes the keys it acks, whatever an id holds", async () => {
    const w = world({ rows: [row({ event_id: "a1b2.1" }), row({ event_id: 'odd "id"' })] });
    await w.post("");
    expect(claimsOf(w.writes()[0]).key).toBe('in.("a1b2.1","odd \\"id\\"")');
  });

  it("logs one line a run, its summary", async () => {
    const w = world({ rows: [row(), row({ user_id: BO, endpoints: [BO_1] })], push: { [BO_1.endpoint]: 410 } });
    await w.post("");
    expect(w.logs).toEqual(['push: {"off":false,"batches":1,"due":2,"sent":1,"released":1,"pruned":1}']);
  });
});

/* A pick-changed row as push_due() returns one: a user's pick that one run changed, its key the run in UTC and the
   event's id, its changes the event's lines of that run, each {kind, from, to}. */
const RUN = "2027-09-03T11:00:00+00:00";
function changedRow(over = {}) {
  const r = { kind: PICK_CHANGED, user_id: ADA, year: 2027, event_id: "e1", title: "Due Panel", start: START, hotel: "Hyatt",
              room: "Regency V", minutes_until: null, run: RUN, changes: [{ kind: "cancelled", from: null, to: null }],
              endpoints: [ADA_1], ...over };
  return { key: `${new Date(Date.parse(r.run)).toISOString().slice(0, 19)}Z|${r.event_id}`, ...r };
}
const time = (from, to) => ({ kind: "time", from, to });
const at = (start, end) => ({ start, end });

describe("pick-changed: what a push says", () => {
  it("says a wall-clock time as its weekday and 12-hour time, from the string alone", () => {
    expect(sayTime("2026-09-04T14:30")).toBe("Fri 2:30 PM");
    expect(sayTime("2026-09-06T00:00")).toBe("Sun 12:00 AM");
    expect(sayTime("2026-09-05T12:00")).toBe("Sat 12:00 PM");
    expect(sayTime("2026-09-02T09:05")).toBe("Wed 9:05 AM");
    expect(sayTime("2026-09-07T23:59")).toBe("Mon 11:59 PM");
    expect(sayTime("2028-02-29T13:00")).toBe("Tue 1:00 PM");
    expect(sayTime(null)).toBeNull();
    expect(sayTime(undefined)).toBeNull();
    expect(sayTime("soon")).toBe("soon");
  });

  it("gives the date's own weekday whatever zone the runtime is in: the string is never read as an instant", () => {
    const was = process.env.TZ;
    try {
      for (const zone of ["Pacific/Kiritimati", "Pacific/Pago_Pago", "UTC"]) {
        process.env.TZ = zone;
        expect([sayTime("2026-09-04T23:30"), sayTime("2026-09-05T00:30")], zone).toEqual(["Fri 11:30 PM", "Sat 12:30 AM"]);
      }
    } finally {
      if (was === undefined) delete process.env.TZ;
      else process.env.TZ = was;
    }
  });

  it("says each kind a push tells", () => {
    expect(["cancelled", "uncancelled", "removed", "restored"].map((kind) => sayChange({ kind, from: null, to: null })))
      .toEqual(["Cancelled", "No longer cancelled", "Removed from the schedule", "Back on the schedule"]);
  });

  it("says a time line as the start moving, Time TBD for a start unknown, or the end where the start stayed", () => {
    expect(sayChange(time(at("2026-09-04T14:30", "2026-09-04T15:30"), at("2026-09-04T15:00", "2026-09-04T16:00"))))
      .toBe("Moved: Fri 2:30 PM → Fri 3:00 PM");
    expect(sayChange(time(at("2026-09-05T17:30", "2026-09-05T18:30"), at("2026-09-06T17:30", "2026-09-06T18:30"))))
      .toBe("Moved: Sat 5:30 PM → Sun 5:30 PM");
    expect(sayChange(time(at("2026-09-04T14:30", "2026-09-04T15:30"), at(null, null))))
      .toBe("Moved: Fri 2:30 PM → Time TBD");
    expect(sayChange(time(at(null, null), at("2026-09-04T15:00", "2026-09-04T16:00"))))
      .toBe("Moved: Time TBD → Fri 3:00 PM");
    expect(sayChange(time(at("2026-09-05T14:00", "2026-09-05T20:00"), at("2026-09-05T14:00", "2026-09-05T18:00"))))
      .toBe("Ends: Sat 8:00 PM → Sat 6:00 PM");
    expect(sayChange(time(at("2026-09-05T14:00", "2026-09-05T20:00"), at("2026-09-05T14:00", null))))
      .toBe("Ends: Sat 8:00 PM → Time TBD");
  });

  it("says a place line as the hotel and the room, whichever it has, and TBD for neither", () => {
    const room = (from, to) => sayChange({ kind: "place", from, to });
    expect(room({ hotel: "Marriott", room: "A708" }, { hotel: "Courtland Grand", room: "Atlanta 1-2" }))
      .toBe("Room: Marriott A708 → Courtland Grand Atlanta 1-2");
    expect(room({ hotel: "Hyatt", room: null }, { hotel: "Hilton", room: "Grand" })).toBe("Room: Hyatt → Hilton Grand");
    expect(room({ hotel: "Hyatt", room: "Regency V" }, { hotel: null, room: null })).toBe("Room: Hyatt Regency V → TBD");
    expect(room(null, { hotel: "Hilton", room: "Grand" })).toBe("Room: TBD → Hilton Grand");
  });

  it("tells an event's changes of one run in their order, joined, whatever order they came in", () => {
    expect(CHANGE_ORDER).toEqual(["cancelled", "uncancelled", "removed", "restored", "time", "place"]);
    const changes = [{ kind: "place", from: { hotel: "Hyatt", room: "Regency V" }, to: { hotel: "Hilton", room: "Grand" } },
                     { kind: "removed", from: null, to: null },
                     time(at("2026-09-04T14:30", "2026-09-04T15:30"), at("2026-09-04T16:00", "2026-09-04T17:00")),
                     { kind: "uncancelled", from: null, to: null }];
    expect(sayChanges(changes)).toBe(
      "No longer cancelled · Removed from the schedule · Moved: Fri 2:30 PM → Fri 4:00 PM · Room: Hyatt Regency V → Hilton Grand");
    expect(sayChanges([{ kind: "restored", from: null, to: null }])).toBe("Back on the schedule");
  });

  it("makes one event's push: its title, its changes, until its start, at normal urgency", () => {
    const changes = [time(at("2027-09-03T10:30", "2027-09-03T11:30"), at("2027-09-03T11:00", "2027-09-03T12:00"))];
    expect(message(fold([changedRow({ changes })])[0], CLOCK)).toEqual({
      payload: { kind: PICK_CHANGED, year: 2027, event_ids: ["e1"], title: "Due Panel",
                 body: "Moved: Fri 10:30 AM → Fri 11:00 AM" },
      ttl: 600, urgency: "normal" });
  });

  it("makes a fold's push: how many picks changed, and a line an event, its title and its changes", () => {
    const rows = [changedRow({ event_id: "e1", title: "Also Panel" }),
                  changedRow({ event_id: "e2", changes: [{ kind: "place", from: { hotel: "Hyatt", room: "Regency V" },
                                                          to: { hotel: "Hilton", room: "Grand" } },
                                                        { kind: "removed", from: null, to: null }] })];
    const { payload } = message(fold(rows)[0], CLOCK);
    expect(payload).toEqual({ kind: PICK_CHANGED, year: 2027, event_ids: ["e1", "e2"], title: "2 of your picks changed",
                              body: "Also Panel — Cancelled\nDue Panel — Removed from the schedule · Room: Hyatt Regency V → Hilton Grand" });
    const many = Array.from({ length: FOLD_LINES + 2 }, (_, i) => changedRow({ event_id: `e${i}`, title: `Panel ${i}` }));
    const big = message(fold(many)[0], CLOCK).payload;
    expect(big.title).toBe(`${FOLD_LINES + 2} of your picks changed`);
    expect(big.event_ids).toHaveLength(FOLD_LINES + 2);
    expect(big.body.split("\n")).toHaveLength(FOLD_LINES + 1);
    expect(big.body.split("\n").slice(-2)).toEqual([`Panel ${FOLD_LINES - 1} — Cancelled`, "and 2 more"]);
  });

  it("lives until the earliest start of its events, a day where none is known, and never below zero", () => {
    const rows = [changedRow({ event_id: "e1", start: "2027-09-03T16:00:00+00:00" }), changedRow({ event_id: "e2" }),
                  changedRow({ event_id: "e3", start: null })];
    expect(message(fold(rows)[0], CLOCK).ttl).toBe(600);
    expect(message(fold(rows)[0], CLOCK + 500).ttl).toBe(599);
    expect(message(fold([changedRow({ start: null })])[0], CLOCK).ttl).toBe(NO_START_TTL);
    expect(NO_START_TTL).toBe(86400);
    expect(message(fold(rows)[0], Date.parse(START) + 1000).ttl).toBe(0);
  });

  it("folds a user's rows of one run into one push; another run, another user or the other kind is another", () => {
    const later = "2027-09-03T12:00:00+00:00";
    const pushes = fold([changedRow({ event_id: "e1" }), changedRow({ event_id: "e2", run: "2027-09-03T11:00:00Z" }),
                         changedRow({ event_id: "e1", run: later }), changedRow({ user_id: BO, endpoints: [BO_1] }),
                         changedRow({ event_id: "e4", year: 2028 }), row({ event_id: "e3" })]);
    expect(pushes.map((p) => [p.kind, p.user_id, p.year, p.rows.map((r) => r.event_id)])).toEqual([
      [PICK_CHANGED, ADA, 2027, ["e1", "e2"]], [PICK_CHANGED, ADA, 2027, ["e1"]], [PICK_CHANGED, BO, 2027, ["e1"]],
      [PICK_CHANGED, ADA, 2028, ["e4"]], [STARTS_SOON, ADA, 2027, ["e3"]]]);
    expect(pushes[1]).toMatchObject({ run: later, endpoints: [ADA_1] });
  });
});

describe("the handler: pick-changed", () => {
  it("sends a pick-changed push at normal urgency, living until the earliest start, and acks its keys", async () => {
    const w = world({ rows: [changedRow({ event_id: "e1", title: "Also Panel" }),
                             changedRow({ event_id: "e2", start: "2027-09-03T16:00:00+00:00",
                                          changes: [time(at("2027-09-03T11:00", "2027-09-03T12:00"),
                                                         at("2027-09-03T12:00", "2027-09-03T13:00"))] })] });
    const res = await w.post("");
    expect(w.encoded.map((e) => [e.payload, e.options])).toEqual([[
      { kind: PICK_CHANGED, year: 2027, event_ids: ["e1", "e2"], title: "2 of your picks changed",
        body: "Also Panel — Cancelled\nDue Panel — Moved: Fri 11:00 AM → Fri 12:00 PM" },
      { ttl: 600, urgency: "normal" }]]);
    expect(w.writes().map((r) => [r.method, r.path, claimsOf(r), r.headers.Prefer])).toEqual([
      ["PATCH", "/rest/v1/push_sent", { user_id: `eq.${ADA}`, kind: "eq.pick-changed",
                                        key: 'in.("2027-09-03T11:00:00Z|e1","2027-09-03T11:00:00Z|e2")', sent_at: "is.null" },
       WRITE]]);
    expect(await res.json()).toEqual({ off: false, batches: 1, due: 2, sent: 2, released: 0, pruned: 0 });
  });

  it("sends each kind as its own push in one run, and acks each by its own kind and keys", async () => {
    const w = world({ rows: [row({ event_id: "e9", title: "Soon Panel" }), changedRow({ start: null })] });
    const res = await w.post("");
    expect(w.encoded.map((e) => [e.payload.kind, e.payload.title, e.options])).toEqual([
      [STARTS_SOON, "Soon Panel", { ttl: 600, urgency: "high" }],
      [PICK_CHANGED, "Due Panel", { ttl: NO_START_TTL, urgency: "normal" }]]);
    expect(w.writes().map((r) => [claimsOf(r).kind, claimsOf(r).key])).toEqual([
      ["eq.starts-soon", 'in.("e9")'], ["eq.pick-changed", 'in.("2027-09-03T11:00:00Z|e1")']]);
    expect(await res.json()).toEqual({ off: false, batches: 1, due: 2, sent: 2, released: 0, pruned: 0 });
  });

  it("releases a pick-changed push no browser took, for the next minute, by its own kind and keys", async () => {
    const w = world({ rows: [row({ event_id: "e9", endpoints: [ADA_2] }), changedRow()], push: { [ADA_1.endpoint]: 503 } });
    const res = await w.post("");
    expect(w.writes().map((r) => [r.method, claimsOf(r).kind, claimsOf(r).key])).toEqual([
      ["PATCH", "eq.starts-soon", 'in.("e9")'], ["DELETE", "eq.pick-changed", 'in.("2027-09-03T11:00:00Z|e1")']]);
    expect([res.status, await res.json()])
      .toEqual([200, { off: false, batches: 1, due: 2, sent: 1, released: 1, pruned: 0 }]);
  });

  it("with dry, shows each push with its kind, and sends and writes nothing", async () => {
    const w = world({ rows: [row({ event_id: "e9" }), changedRow({ changes: [{ kind: "restored", from: null, to: null }] })] });
    const res = await w.post(JSON.stringify({ at: "2027-09-03T14:52:00Z", dry: true }));
    expect((await res.json()).pushes).toEqual([
      { kind: STARTS_SOON, user_id: ADA, event_ids: ["e9"], title: "Due Panel", body: "Starts in 8 min · Hyatt Regency V",
        ttl: 480, browsers: 1 },
      { kind: PICK_CHANGED, user_id: ADA, event_ids: ["e1"], title: "Due Panel", body: "Back on the schedule", ttl: 480,
        browsers: 1 }]);
    expect([w.sends(), w.writes(), w.encoded]).toEqual([[], [], []]);
  });
});

/* One-row pushes for users from `from`, each with a browser of its own, as a batch of push_due()'s rows. */
const USER = (i) => `c0000000-0000-4000-a000-${String(i).padStart(12, "0")}`;
const BROWSER = (i) => ({ endpoint: `https://fcm.example/send/u${i}`, p256dh: `k${i}`, auth: `a${i}` });
const batch = (from, n) =>
  Array.from({ length: n }, (_, i) => row({ user_id: USER(from + i), event_id: `e${from + i}`, endpoints: [BROWSER(from + i)] }));
const sendTo = (i) => `send ${BROWSER(i).endpoint}`;

describe("the handler: batches", () => {
  it("takes rows from push_due() twice a run at most, and stops asking after twenty seconds", () => {
    expect([BATCHES, BUDGET_MS]).toEqual([2, 20000]);
  });

  it("asks again after a batch until a call comes back empty, the batch sent, acked and pruned before the next call",
     async () => {
    const w = world({ batches: [batch(1, 2), []], push: { [BROWSER(2).endpoint]: 410 } });
    const res = await w.post("");
    expect(w.steps()).toEqual(["due", sendTo(1), sendTo(2), "ack", "prune", "due", "release"]);
    expect(await res.json()).toEqual({ off: false, batches: 1, due: 2, sent: 1, released: 1, pruned: 1 });
  });

  it("stops at the ceiling: BATCHES calls, their rows summed, the run marked stopped by it, in the answer and the log",
     async () => {
    const w = world({ batches: [batch(1, 2), batch(3, 3), batch(6, 1)] });
    const res = await w.post("");
    expect(w.rpcs()).toHaveLength(2);
    expect(w.steps()).toEqual(["due", sendTo(1), sendTo(2), "ack", "ack", "due", sendTo(3), sendTo(4), sendTo(5),
                               "ack", "ack", "ack"]);
    const summary = { off: false, batches: 2, due: 5, sent: 5, released: 0, pruned: 0, stopped: "batches" };
    expect([res.status, await res.json()]).toEqual([200, summary]);
    expect(w.logs).toEqual([`push: ${JSON.stringify(summary)}`]);
  });

  it("makes no call after the first once the run has taken BUDGET_MS, and says the time stopped it", async () => {
    const late = world({ batches: [batch(1, 1), batch(2, 1)], rpcTakes: BUDGET_MS });
    const res = await late.post("");
    expect(late.rpcs()).toHaveLength(1);
    expect(await res.json()).toEqual({ off: false, batches: 1, due: 1, sent: 1, released: 0, pruned: 0, stopped: "time" });
    const inTime = world({ batches: [batch(1, 1), batch(2, 1)], rpcTakes: BUDGET_MS - 1 });
    expect(await (await inTime.post("")).json())
      .toEqual({ off: false, batches: 2, due: 2, sent: 2, released: 0, pruned: 0, stopped: "batches" });
    let slow;
    slow = world({ batches: [batch(1, 1)], rest: { "GET /rest/v1/flags": () => {
      slow.advance(BUDGET_MS);
      return new Response('[{"value": true}]', { status: 200 });
    } } });
    expect(await (await slow.post("")).json())
      .toEqual({ off: false, batches: 1, due: 1, sent: 1, released: 0, pruned: 0, stopped: "time" });
    expect(slow.rpcs()).toHaveLength(1);   // the first call is made however long the run took to reach it
  });

  it("holds a push no browser took until the run ends: released after the last call, once, so no later call takes it",
     async () => {
    const w = world({ batches: [[...batch(1, 1), ...batch(2, 1)], batch(3, 1)], push: { [BROWSER(1).endpoint]: 503 } });
    const res = await w.post("");
    expect(w.steps()).toEqual(["due", sendTo(1), sendTo(2), "ack", "due", sendTo(3), "ack", "release"]);
    expect(claimsOf(w.writes().at(-1))).toEqual({ user_id: `eq.${USER(1)}`, kind: "eq.starts-soon", key: 'in.("e1")',
                                                  sent_at: "is.null" });
    expect(await res.json())
      .toEqual({ off: false, batches: 2, due: 3, sent: 2, released: 1, pruned: 0, stopped: "batches" });
  });

  it("releases every push no browser took as the run ends, each once, and counts them all", async () => {
    const w = world({ batches: [batch(1, 2), batch(3, 1)],
                      push: { [BROWSER(1).endpoint]: 503, [BROWSER(3).endpoint]: 429 } });
    const res = await w.post("");
    expect(w.steps()).toEqual(["due", sendTo(1), sendTo(2), "ack", "due", sendTo(3), "release", "release"]);
    expect(w.writes().filter((r) => r.method === "DELETE").map((r) => claimsOf(r).user_id))
      .toEqual([`eq.${USER(1)}`, `eq.${USER(3)}`]);
    expect(await res.json())
      .toEqual({ off: false, batches: 2, due: 3, sent: 1, released: 2, pruned: 0, stopped: "batches" });
  });

  it("says the ceiling stopped a run that met both limits at once", async () => {
    const w = world({ batches: Array.from({ length: BATCHES + 1 }, (_, i) => batch(i + 1, 1)), rpcTakes: BUDGET_MS / BATCHES });
    const res = await w.post("");
    expect(w.rpcs()).toHaveLength(BATCHES);
    expect((await res.json()).stopped).toBe("batches");
  });

  it("where the time ends the run, still releases what it holds, and fails it for a refusal", async () => {
    const w = world({ batches: [batch(1, 2), batch(3, 1)], rpcTakes: BUDGET_MS,
                      push: { [BROWSER(1).endpoint]: 503, [BROWSER(2).endpoint]: 403 } });
    const res = await w.post("");
    expect(w.steps()).toEqual(["due", sendTo(1), sendTo(2), "release", "release"]);
    expect([res.status, await res.json()]).toEqual([500, { off: false, batches: 1, due: 2, sent: 0, released: 2, pruned: 0,
      stopped: "time", error: "1 push(es) refused by the push service: our VAPID keys or our request" }]);
  });

  it("goes on after a refusal, releases the refused as the run ends, and then fails the run", async () => {
    const w = world({ batches: [[...batch(1, 1), ...batch(2, 1)], batch(3, 1)], push: { [BROWSER(1).endpoint]: 403 } });
    const res = await w.post("");
    expect(w.steps()).toEqual(["due", sendTo(1), sendTo(2), "ack", "due", sendTo(3), "ack", "release"]);
    expect([res.status, await res.json()]).toEqual([500, { off: false, batches: 2, due: 3, sent: 2, released: 1, pruned: 0,
      stopped: "batches", error: "1 push(es) refused by the push service: our VAPID keys or our request" }]);
  });

  it("with dry, calls once and shows the first batch alone", async () => {
    const w = world({ batches: [batch(1, 2), batch(3, 1)] });
    const res = await w.post(JSON.stringify({ at: "2027-09-03T14:50:00Z", dry: true }));
    expect(w.rpcs()).toHaveLength(1);
    const answer = await res.json();
    expect([answer.batches, answer.due, answer.pushes.map((p) => p.user_id), answer.stopped])
      .toEqual([1, 2, [USER(1), USER(2)], undefined]);
    expect([w.sends(), w.writes()]).toEqual([[], []]);
    const empty = world();
    expect(await (await empty.post('{"dry": true}')).json())
      .toEqual({ off: false, batches: 0, due: 0, sent: 0, released: 0, pruned: 0, dry: true, pushes: [] });
  });

  it("asks every call with the same arguments: the `at` it was given, or none", async () => {
    const given = world({ batches: [batch(1, 1)] });
    await given.post(JSON.stringify({ at: "2027-09-03T14:50:00Z" }));
    const none = world({ batches: [batch(1, 1)] });
    await none.post("");
    expect([given.rpcs().map((r) => JSON.parse(r.body)), none.rpcs().map((r) => JSON.parse(r.body))])
      .toEqual([[{ at: "2027-09-03T14:50:00Z" }, { at: "2027-09-03T14:50:00Z" }], [{}, {}]]);
  });

  it("on an error in the second batch, keeps the first batch's acks, releases what it holds, and answers 500 with the "
     + "summary so far", async () => {
    let acks = 0;
    const failSecondAck = { "PATCH /rest/v1/push_sent": (req) => (++acks === 2
      ? new Response('{"message":"boom"}', { status: 503 })
      : new Response(null, { status: 204, headers: { "Content-Range": `*/${req.query.get("key").split(",").length}` } })) };
    const w = world({ batches: [[...batch(1, 1), ...batch(2, 1)], batch(3, 1)], push: { [BROWSER(2).endpoint]: 503 },
                      rest: failSecondAck });
    const res = await w.post("");
    expect(w.steps()).toEqual(["due", sendTo(1), sendTo(2), "ack", "due", sendTo(3), "ack", "release"]);
    expect([res.status, await res.json()]).toEqual([500, { off: false, batches: 2, due: 3, sent: 1, released: 1, pruned: 0,
      error: 'PATCH /rest/v1/push_sent answered 503: {"message":"boom"}' }]);

    const rpcFails = world({ batches: [batch(1, 1)], push: { [BROWSER(1).endpoint]: 503 },
      rest: { "POST /rest/v1/rpc/push_due": (() => {
        let calls = 0;
        return () => (++calls === 1 ? new Response(JSON.stringify(batch(1, 1)), { status: 200 })
          : new Response('{"message":"gone"}', { status: 500 }));
      })() } });
    const failed = await rpcFails.post("");
    expect(rpcFails.steps()).toEqual(["due", sendTo(1), "due", "release"]);
    expect([failed.status, await failed.json()]).toEqual([500, { off: false, batches: 1, due: 1, sent: 0, released: 1,
      pruned: 0, error: 'POST /rest/v1/rpc/push_due answered 500: {"message":"gone"}' }]);
  });

  it("where an ack fails, still releases each push of its batch that nobody took, though it came after", async () => {
    let acks = 0;
    const failSecondAck = { "PATCH /rest/v1/push_sent": () => (++acks === 2
      ? new Response('{"message":"boom"}', { status: 503 })
      : new Response(null, { status: 204, headers: { "Content-Range": "*/1" } })) };
    const w = world({ batches: [batch(1, 3)], push: { [BROWSER(3).endpoint]: 503 }, rest: failSecondAck });
    const res = await w.post("");
    expect(w.steps()).toEqual(["due", sendTo(1), sendTo(2), sendTo(3), "ack", "ack", "release"]);
    expect(claimsOf(w.writes().at(-1)).user_id).toBe(`eq.${USER(3)}`);
    expect([res.status, await res.json()]).toEqual([500, { off: false, batches: 1, due: 3, sent: 1, released: 1, pruned: 0,
      error: 'PATCH /rest/v1/push_sent answered 503: {"message":"boom"}' }]);
  });

  it("where the release at the run's end fails, releases each held push once, the rest on the way out", async () => {
    let deletes = 0;
    const w = world({ batches: [batch(1, 2)], push: { [BROWSER(1).endpoint]: 503, [BROWSER(2).endpoint]: 503 },
      rest: { "DELETE /rest/v1/push_sent": () => (++deletes === 1 ? new Response('{"message":"busy"}', { status: 503 })
        : new Response(null, { status: 204, headers: { "Content-Range": "*/1" } })) } });
    const res = await w.post("");
    expect(w.steps()).toEqual(["due", sendTo(1), sendTo(2), "due", "release", "release"]);
    expect(w.writes().map((r) => claimsOf(r).user_id)).toEqual([`eq.${USER(1)}`, `eq.${USER(2)}`]);
    expect([res.status, await res.json()]).toEqual([500, { off: false, batches: 1, due: 2, sent: 0, released: 1, pruned: 0,
      error: 'DELETE /rest/v1/push_sent answered 503: {"message":"busy"}' }]);
  });

  it("answers 500 with the run's own error when the release on the way out fails too", async () => {
    let calls = 0;
    const w = world({ push: { [BROWSER(1).endpoint]: 503 }, rest: {
      "POST /rest/v1/rpc/push_due": () => (++calls === 1 ? new Response(JSON.stringify(batch(1, 1)), { status: 200 })
        : new Response('{"message":"gone"}', { status: 500 })),
      "DELETE /rest/v1/push_sent": () => new Response('{"message":"also gone"}', { status: 503 }) } });
    const res = await w.post("");
    expect(w.steps()).toEqual(["due", sendTo(1), "due", "release"]);
    expect([res.status, await res.json()]).toEqual([500, { off: false, batches: 1, due: 1, sent: 0, released: 0, pruned: 0,
      error: 'POST /rest/v1/rpc/push_due answered 500: {"message":"gone"}' }]);
  });
});
