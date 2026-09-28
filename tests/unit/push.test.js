// @vitest-environment node
/* The push job's sender, supabase/functions/push/push.js (DECISIONS #55; docs/sync/contract.md, section 7),
   run in Node: its pure parts, and its handler against a fake PostgREST, fake push services, a fake encoder and
   a clock the test moves. Every request it makes is recorded, so each test says what went where. The Deno
   entry, index.js, is the hand test's. */
import { describe, expect, it } from "vitest";
import {
  FOLD_LINES, KIND, PROBE_SUBSCRIPTION, fold, inList, makeHandler, message, parseBody, place, sameSecret,
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

const row = (over = {}) => ({ user_id: ADA, year: 2027, event_id: "e1", title: "Due Panel", start: START, hotel: "Hyatt",
                              room: "Regency V", minutes_until: 10, endpoints: [ADA_1], ...over });

/* A run's world: PostgREST's answers, each push service's, the encoder and the clock. `push` maps an endpoint to
   its status, or to an Error for no answer; `rpcTakes` moves the clock while push_due() runs. */
function world({ env = ENV, flag = [{ value: true }], rows = [], push = {}, rest = {}, unusable = [],
                 probeRefused = null, rpcTakes = 0, sendTakes = 0 } = {}) {
  const requests = [];
  const encoded = [];
  const logs = [];
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
        return reply(200, JSON.stringify(rows));
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
  return { requests, encoded, logs, post, rpcs, sends, writes, handle, advance: (ms) => { time += ms; } };
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
      payload: { kind: KIND, year: 2027, event_ids: ["e1"], title: "Due Panel", body: "Starts in 10 min · Hyatt Regency V" },
      ttl: 570 });
    expect(message(fold([row({ hotel: null, room: null })])[0], at).payload.body).toBe("Starts in 10 min");
    const late = message(fold([row()])[0], Date.parse(START) + 1000);
    expect([late.payload.body, late.ttl]).toEqual(["Starting now · Hyatt Regency V", 0]);
  });

  it("makes a fold's message: how many picks start, and one line an event", () => {
    const rows = [row({ event_id: "e1", title: "Also Panel", hotel: "Marriott", room: null }), row({ event_id: "e2" })];
    const { payload, ttl } = message(fold(rows)[0], Date.parse(START) - 5 * 60000);
    expect(payload).toEqual({ kind: KIND, year: 2027, event_ids: ["e1", "e2"], title: "2 picks start in 5 min",
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
      expect([res.status, await res.json()]).toEqual([200, { off: true, due: 0, sent: 0, released: 0, pruned: 0 }]);
      expect(w.requests.map((r) => `${r.method} ${r.url}`))
        .toEqual([`GET ${API}/rest/v1/flags?select=value&name=eq.push_enabled`]);
      expect(w.logs).toEqual(['push: {"off":true,"due":0,"sent":0,"released":0,"pruned":0}']);
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
      off: false, due: 2, sent: 0, released: 0, pruned: 0, dry: true,
      pushes: [
        { user_id: ADA, event_ids: ["e1"], title: "Due Panel", body: "Starts in 8 min · Hyatt Regency V", ttl: 480, browsers: 2 },
        { user_id: BO, event_ids: ["e1"], title: "Due Panel", body: "Starts in 8 min · Hyatt Regency V", ttl: 480, browsers: 1 },
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
    expect(w.encoded[0].payload).toEqual({ kind: KIND, year: 2027, event_ids: ["e1"], title: "Due Panel",
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
    expect(await res.json()).toEqual({ off: false, due: 3, sent: 3, released: 0, pruned: 0 });
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
    expect(await res.json()).toEqual({ off: false, due: 1, sent: 1, released: 0, pruned: 1 });
  });

  it("where every browser is gone, prunes each and deletes the claim", async () => {
    const w = world({ rows: [row({ endpoints: [ADA_1, ADA_2] })], push: { [ADA_1.endpoint]: 404, [ADA_2.endpoint]: 410 } });
    const res = await w.post("");
    expect(w.writes().map((r) => [r.method, r.path])).toEqual([
      ["DELETE", "/rest/v1/push_sent"], ["DELETE", "/rest/v1/push_subscriptions"], ["DELETE", "/rest/v1/push_subscriptions"],
    ]);
    expect(claimsOf(w.writes()[0])).toEqual({ user_id: `eq.${ADA}`, kind: "eq.starts-soon", key: 'in.("e1")',
                                              sent_at: "is.null" });
    expect(await res.json()).toEqual({ off: false, due: 1, sent: 0, released: 1, pruned: 2 });
  });

  it("releases the claim for the next minute on a 429, a 5xx or no answer, and prunes only the gone", async () => {
    for (const answers of [[429], [503], [new Error("The signal has been aborted")], [410, 502]]) {
      const endpoints = [ADA_1, ADA_2].slice(0, answers.length);
      const push = Object.fromEntries(endpoints.map((e, i) => [e.endpoint, answers[i]]));
      const w = world({ rows: [row({ endpoints })], push });
      const res = await w.post("");
      expect(res.status).toBe(200);
      expect(w.writes().map((r) => [r.method, r.path])).toEqual([
        ["DELETE", "/rest/v1/push_sent"],
        ...(answers.includes(410) ? [["DELETE", "/rest/v1/push_subscriptions"]] : []),
      ]);
    }
  });

  it("on a refusal - a 401, a 403 or another 4xx - releases the claim, logs it and fails the run", async () => {
    for (const status of [401, 403, 400, 413]) {
      const w = world({ rows: [row()], push: { [ADA_1.endpoint]: status } });
      const res = await w.post("");
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ off: false, due: 1, sent: 0, released: 1, pruned: 0,
        error: "1 push(es) refused by the push service: our VAPID keys or our request" });
      expect(w.writes().map((r) => [r.method, r.path])).toEqual([["DELETE", "/rest/v1/push_sent"]]);
      expect(w.logs).toContain(`push: https://fcm.example refused a push, ${status}: the service says ${status}`);
    }
  });

  it("acks a push one browser took though another refused it, and still fails the run", async () => {
    const w = world({ rows: [row({ endpoints: [ADA_1, ADA_2] })], push: { [ADA_2.endpoint]: 403 } });
    const res = await w.post("");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ off: false, due: 1, sent: 1, released: 0, pruned: 0,
      error: "1 push(es) refused by the push service: our VAPID keys or our request" });
    expect(w.writes().map((r) => [r.method, claimsOf(r)])).toEqual([
      ["PATCH", { user_id: `eq.${ADA}`, kind: "eq.starts-soon", key: 'in.("e1")', sent_at: "is.null" }],
    ]);
  });

  it("where one push service refuses a push and another takes its own, acks the one taken, releases only the refused, "
     + "and then fails the run - whichever comes first", async () => {
    const bo = row({ user_id: BO, event_id: "e2", title: "Bo Panel", endpoints: [BO_1] });   // fcm.example: 403
    const ada = row({ endpoints: [ADA_2] });                                               // updates.example: 201
    const ack = ["PATCH", { user_id: `eq.${ADA}`, kind: "eq.starts-soon", key: 'in.("e1")', sent_at: "is.null" }];
    const release = ["DELETE", { user_id: `eq.${BO}`, kind: "eq.starts-soon", key: 'in.("e2")', sent_at: "is.null" }];
    for (const [rows, writes] of [[[bo, ada], [release, ack]], [[ada, bo], [ack, release]]]) {
      const w = world({ rows, push: { [BO_1.endpoint]: 403 } });
      const res = await w.post("");
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ off: false, due: 2, sent: 1, released: 1, pruned: 0,
        error: "1 push(es) refused by the push service: our VAPID keys or our request" });
      expect(w.writes().map((r) => [r.method, claimsOf(r)])).toEqual(writes);
      expect(w.logs).toContain("push: https://fcm.example refused a push, 403: the service says 403");
    }
  });

  it("prunes a browser whose keys the encoder cannot use", async () => {
    const w = world({ rows: [row()], unusable: [ADA_1.endpoint] });
    const res = await w.post("");
    expect(w.sends()).toEqual([]);
    expect(w.writes().map((r) => [r.method, r.path])).toEqual([
      ["DELETE", "/rest/v1/push_sent"], ["DELETE", "/rest/v1/push_subscriptions"],
    ]);
    expect(await res.json()).toEqual({ off: false, due: 1, sent: 0, released: 1, pruned: 1 });
    expect(w.logs[0]).toContain("a browser's keys are unusable");
  });

  it("quotes the keys it acks, whatever an id holds", async () => {
    const w = world({ rows: [row({ event_id: "a1b2.1" }), row({ event_id: 'odd "id"' })] });
    await w.post("");
    expect(claimsOf(w.writes()[0]).key).toBe('in.("a1b2.1","odd \\"id\\"")');
  });

  it("logs one line a run, its summary", async () => {
    const w = world({ rows: [row(), row({ user_id: BO, endpoints: [BO_1] })], push: { [BO_1.endpoint]: 410 } });
    await w.post("");
    expect(w.logs).toEqual(['push: {"off":false,"due":2,"sent":1,"released":1,"pruned":1}']);
  });
});
