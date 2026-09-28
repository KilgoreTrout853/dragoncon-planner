/* The push job's sender (DECISIONS #55; docs/sync/contract.md, section 7). pg_cron calls it every minute,
   through pg_net, while the kill switch is on. A run checks the caller's secret, reads the switch, asks
   push_due() for what is due - one batch, claimed for this run - folds the rows into pushes, sends each push to
   each of the user's browsers, acks what a browser took and prunes the browsers gone; then asks again, until a
   call comes back empty, BATCHES calls have brought rows, or the run has taken BUDGET_MS. A push no browser took
   is released when the run ends, not when its batch does, so that no later call of the run claims it again: it is
   retried the next minute. Two kinds: starts-soon, a user's picks that share a start folded into one push; and
   pick-changed, a user's picks that one scrape run changed. This file has no runtime of its own: index.js hands it
   the environment, fetch, the Web Push encoder and the clock, so that tests/unit/push.test.js runs it in Node. */

export const STARTS_SOON = "starts-soon";
export const PICK_CHANGED = "pick-changed";
export const SEND_TIMEOUT_MS = 10000;   // one push service's answer
export const IN_FLIGHT = 50;            // sends at once
export const BATCHES = 2;               // push_due() calls a run takes rows from: 2 x 200 rows, two browsers a user,
                                        // ~1 s of the 2 s of CPU hosted (contract section 7, The batch, as built)
export const BUDGET_MS = 20000;         // no call after the first once a run has taken this long
export const FOLD_LINES = 10;           // a fold's body lists this many events, then how many more
export const NO_START_TTL = 86400;      // seconds: a pick-changed push none of whose events has a start known
// The order an event's changes are told in, when one run changed several things about it (#55).
export const CHANGE_ORDER = ["cancelled", "uncancelled", "removed", "restored", "time", "place"];
const WRITE = "handling=strict,return=minimal,count=exact";
const SAID = { cancelled: "Cancelled", uncancelled: "No longer cancelled", removed: "Removed from the schedule",
               restored: "Back on the schedule" };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* A browser that exists nowhere: its key is a real P-256 point, whose private half was thrown away. The
   encoder signs and encrypts a push to it before a run claims anything, so VAPID keys it refuses fail the run
   there, and a refusal later can only be the one browser's. */
export const PROBE_SUBSCRIPTION = {
  endpoint: "https://push.invalid/probe",
  keys: { p256dh: "BGtUhZTj-9kPgfbakxPcoGSnpx30bZCkcofMeArca7VV3uAApReHEWifVY0TS7L4ED4bUuwKAp8CM2oZHnhR28Q",
          auth: "mUXv3gHnJOcu5KiIs0i_aQ" },
};

/* The service key as PostgREST takes it (#54): an sb_secret_ key on apikey alone, a legacy JWT as the bearer
   too. The runtime's default secret key, else its legacy service-role key; null with neither. */
export function serviceHeaders(env) {
  let key;
  try {
    key = JSON.parse(env.SUPABASE_SECRET_KEYS || "{}").default;
  } catch {
    key = undefined;
  }
  key = key || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return key.split(".").length === 3 ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

/* The caller's secret against ours, in time that does not depend on where they differ. */
export function sameSecret(given, ours) {
  if (typeof given !== "string" || !ours || given.length !== ours.length) return false;
  let diff = 0;
  for (let i = 0; i < ours.length; i++) diff |= given.charCodeAt(i) ^ ours.charCodeAt(i);
  return diff === 0;
}

/* An event's place as a push shows it: the hotel and the room, whichever it has. */
export function place(row) {
  return [row.hotel, row.room].filter(Boolean).join(" ");
}

/* A time as the change log writes it - "2026-09-04T14:30", the con's wall clock (#42) - as a push says it,
   "Fri 2:30 PM": the weekday from the date, the 12-hour time from HH:MM, put together by hand. The string is
   already on the con's clock, so nothing reads it as an instant or asks a zone. null for no time; a string of
   another shape is said as it is. */
export function sayTime(local) {
  if (local === null || local === undefined) return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!parts) return String(local);
  const [year, month, day, hour, minute] = parts.slice(1).map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];   // a date's weekday, no clock
  return `${weekday} ${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

const timeOr = (local) => sayTime(local) ?? "Time TBD";
const placeOr = (where) => place(where ?? {}) || "TBD";

/* One change line - {kind, from, to}, as push_due() returns it - as a push says it. A time line says the start
   moving, or the end where the start stayed; a place line, the hotel and room. push_due() returns the six kinds
   a push tells and no other; were another to come, it would be said by its name, not thrown on in mid-send. */
export function sayChange(change) {
  if (SAID[change.kind]) return SAID[change.kind];
  if (change.kind === "time") {
    const from = change.from ?? {};
    const to = change.to ?? {};
    return from.start === to.start ? `Ends: ${timeOr(from.end)} → ${timeOr(to.end)}`
      : `Moved: ${timeOr(from.start)} → ${timeOr(to.start)}`;
  }
  if (change.kind === "place") return `Room: ${placeOr(change.from)} → ${placeOr(change.to)}`;
  return String(change.kind);
}

/* An event's changes of one run, in CHANGE_ORDER, joined. */
export function sayChanges(changes) {
  return [...changes].sort((a, b) => CHANGE_ORDER.indexOf(a.kind) - CHANGE_ORDER.indexOf(b.kind))
    .map(sayChange).join(" · ");
}

/* push_due()'s rows - one a user's claimed pick, or a user's pick one run changed - folded into pushes, each row
   kept in the order push_due() gave it: starts-soon, one push per user and start; pick-changed, one per user, year
   and run. */
export function fold(rows) {
  const pushes = new Map();
  for (const row of rows) {
    const key = row.kind === PICK_CHANGED ? `${row.kind} ${row.user_id} ${row.year} ${Date.parse(row.run)}`
      : `${row.kind} ${row.user_id} ${Date.parse(row.start)}`;
    if (!pushes.has(key)) {
      pushes.set(key, { kind: row.kind, user_id: row.user_id, year: row.year, start: row.start, run: row.run, rows: [],
                        endpoints: row.endpoints });
    }
    pushes.get(key).rows.push(row);
  }
  return [...pushes.values()];
}

/* A fold's body: a line an event, at most FOLD_LINES, then how many more. */
function lines(rows, say) {
  const out = rows.slice(0, FOLD_LINES).map(say);
  if (rows.length > FOLD_LINES) out.push(`and ${rows.length - FOLD_LINES} more`);
  return out.join("\n");
}

/* A starts-soon push at `now`: the minutes are counted as it is sent, so a late run gives a shorter warning, never
   a stale one; one start, so one count and one TTL for a fold. */
function soonMessage(push, now) {
  const left = Date.parse(push.start) - now;
  const minutes = Math.ceil(left / 60000);
  const { rows } = push;
  let title, body;
  if (rows.length === 1) {
    const where = place(rows[0]);
    title = rows[0].title;
    body = (minutes > 0 ? `Starts in ${minutes} min` : "Starting now") + (where ? ` · ${where}` : "");
  } else {
    title = minutes > 0 ? `${rows.length} picks start in ${minutes} min` : `${rows.length} picks start now`;
    body = lines(rows, (row) => (place(row) ? `${row.title} · ${place(row)}` : row.title));
  }
  return { title, body, ttl: Math.max(0, Math.floor(left / 1000)), urgency: "high" };
}

/* A pick-changed push at `now`: one event, its title and its changes; several, how many, and a line an event. It
   lives until the earliest of its events starts, or a day where none has a start known. */
function changedMessage(push, now) {
  const { rows } = push;
  const title = rows.length === 1 ? rows[0].title : `${rows.length} of your picks changed`;
  const body = rows.length === 1 ? sayChanges(rows[0].changes)
    : lines(rows, (row) => `${row.title} — ${sayChanges(row.changes)}`);
  const starts = rows.filter((row) => row.start).map((row) => Date.parse(row.start));
  const ttl = starts.length ? Math.max(0, Math.floor((Math.min(...starts) - now) / 1000)) : NO_START_TTL;
  return { title, body, ttl, urgency: "normal" };
}

/* A push's payload, its TTL at `now` in seconds, and its urgency. */
export function message(push, now) {
  const { title, body, ttl, urgency } = push.kind === PICK_CHANGED ? changedMessage(push, now) : soonMessage(push, now);
  return { payload: { kind: push.kind, year: push.year, event_ids: push.rows.map((row) => row.event_id), title, body },
           ttl, urgency };
}

/* What one push service's answer means: sent; dead, the browser gone, so pruned; retry, the claim released for
   the next minute - a 429, a 5xx, or no answer at all (0); or refused, which is ours: VAPID or the request. */
export function verdict(status) {
  if (status >= 200 && status < 300) return "sent";
  if (status === 404 || status === 410) return "dead";
  if (status === 0 || status === 429 || status >= 500) return "retry";
  return "refused";
}

/* A PostgREST `in` list: each value double-quoted, `"` and `\` escaped (#54, the mirror's rule). */
export function inList(values) {
  return `(${values.map((value) => `"${String(value).replace(/[\\"]/g, (c) => `\\${c}`)}"`).join(",")})`;
}

/* The request's body: nothing, or an object with `at`, an ISO date and time with its offset, and `dry`. */
export function parseBody(text) {
  const body = text.trim() ? JSON.parse(text) : {};
  if (body === null || typeof body !== "object" || Array.isArray(body)) throw new Error("the body is a JSON object");
  if (body.at !== undefined
      && (typeof body.at !== "string" || !/(?:Z|[+-]\d\d:\d\d)$/.test(body.at) || Number.isNaN(Date.parse(body.at)))) {
    throw new Error("at is an ISO date and time with its offset");
  }
  if (body.dry !== undefined && typeof body.dry !== "boolean") throw new Error("dry is true or false");
  return { at: body.at, dry: body.dry === true };
}

async function pool(items, limit, work) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await work(items[i]);
    }
  });
  await Promise.all(runners);
  return results;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/* The function's handler. `env` is the runtime's environment; `fetch` sends; `encode(subscription, payload,
   {ttl, urgency})` returns a push's request - endpoint, method, headers and body - encrypted and signed;
   `clock()` is milliseconds; `log` takes a line. */
export function makeHandler({ env, fetch, encode, clock, log }) {
  const key = serviceHeaders(env);
  const rest = `${env.SUPABASE_URL}/rest/v1`;

  async function call(method, path, body, prefer) {
    const headers = { ...key, ...(body === undefined ? {} : { "Content-Type": "application/json" }),
                      ...(prefer ? { Prefer: prefer } : {}) };
    const res = await fetch(`${rest}${path}`,
      { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} /rest/v1${path.split("?")[0]} answered ${res.status}: ${text.slice(0, 500)}`);
    return { text, count: Number((res.headers.get("content-range") || "").split("/")[1]) || 0 };
  }

  // A push's claims, as push_due() made them: its kind, and the key of each of its rows.
  const claims = (push) => new URLSearchParams({ user_id: `eq.${push.user_id}`, kind: `eq.${push.kind}`,
    key: `in.${inList(push.rows.map((row) => row.key))}`, sent_at: "is.null" });

  return async function handle(req) {
    const started = clock();
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
    if (!env.PUSH_SECRET) {
      log("push: PUSH_SECRET is not set");
      return json({ error: "PUSH_SECRET is not set" }, 500);
    }
    if (!sameSecret(req.headers.get("x-push-secret"), env.PUSH_SECRET)) return json({ error: "refused" }, 401);
    if (!key) {
      log("push: no service key");
      return json({ error: "no service key: SUPABASE_SECRET_KEYS has no default and SUPABASE_SERVICE_ROLE_KEY is unset" },
                  500);
    }
    try {
      encode(PROBE_SUBSCRIPTION, "{}", { ttl: 0, urgency: "high" });
    } catch (err) {
      log(`push: the encoder refuses our VAPID keys: ${err.message}`);
      return json({ error: `the encoder refuses our VAPID keys: ${err.message}` }, 500);
    }
    let asked;
    try {
      asked = parseBody(await req.text());
    } catch (err) {
      return json({ error: err.message }, 400);
    }

    const summary = { off: false, batches: 0, due: 0, sent: 0, released: 0, pruned: 0 };
    const refused = [];
    const held = [];   // pushes no browser took: their claims kept until the run ends, so no later call takes them
    const base = asked.at ? Date.parse(asked.at) : started;
    const now = () => base + (clock() - started);

    // One batch's pushes: one message a push, made as its first send starts; every browser of every push, IN_FLIGHT
    // at once; then each push acked where a browser took it, else held, and the browsers gone pruned.
    async function send(pushes) {
      const sends = pushes.flatMap((push) => push.endpoints.map((to) => ({ push, to })));
      const made = new Map();
      const answers = await pool(sends, IN_FLIGHT, async ({ push, to }) => {
        if (!made.has(push)) made.set(push, message(push, now()));
        const { payload, ttl, urgency } = made.get(push);
        let request;
        try {
          request = encode({ endpoint: to.endpoint, keys: { p256dh: to.p256dh, auth: to.auth } }, JSON.stringify(payload),
                           { ttl, urgency });
        } catch (err) {
          log(`push: a browser's keys are unusable, so it is pruned: ${err.message}`);
          return { push, to, status: 404 };
        }
        try {
          const res = await fetch(request.endpoint, { method: request.method, headers: request.headers,
            body: request.body, redirect: "error", signal: AbortSignal.timeout(SEND_TIMEOUT_MS) });
          const text = res.status >= 400 ? (await res.text()).slice(0, 500) : "";
          return { push, to, status: res.status, text };
        } catch (err) {
          return { push, to, status: 0, text: err.message };
        }
      });

      // Every push's answers read before any write, so that a write that fails leaves each push nobody took held.
      const dead = new Set();
      const took = [];
      for (const push of pushes) {
        const mine = answers.filter((a) => a.push === push);
        const verdicts = mine.map((a) => verdict(a.status));
        for (const a of mine) {
          if (verdict(a.status) === "dead") dead.add(a.to.endpoint);
          if (verdict(a.status) === "refused") {
            refused.push(a);
            log(`push: ${new URL(a.to.endpoint).origin} refused a push, ${a.status}: ${a.text}`);
          }
        }
        (verdicts.includes("sent") ? took : held).push(push);
      }
      for (const push of took) {
        summary.sent += (await call("PATCH", `/push_sent?${claims(push)}`,
          { sent_at: new Date(clock()).toISOString() }, WRITE)).count;
      }
      for (const endpoint of dead) {
        summary.pruned += (await call("DELETE", `/push_subscriptions?${new URLSearchParams({ endpoint: `eq.${endpoint}` })}`,
          undefined, WRITE)).count;
      }
    }

    // The held pushes' claims released, a push at a time, for the next minute.
    async function release() {
      while (held.length) {
        const push = held.shift();
        summary.released += (await call("DELETE", `/push_sent?${claims(push)}`, undefined, WRITE)).count;
      }
    }

    try {
      const flag = JSON.parse((await call("GET", "/flags?select=value&name=eq.push_enabled")).text)[0];
      if (!flag || flag.value !== true) {
        summary.off = true;
        log(`push: ${JSON.stringify(summary)}`);
        return json(summary);
      }
      // Every call the same arguments: the `at` the request named, or none, and `dry`.
      const args = { ...(asked.at ? { at: asked.at } : {}), ...(asked.dry ? { dry: true } : {}) };
      const due = async () => JSON.parse((await call("POST", "/rpc/push_due", args)).text);

      if (asked.dry) {
        const rows = await due();
        summary.batches = rows.length ? 1 : 0;
        summary.due = rows.length;
        const preview = fold(rows).map((push) => {
          const { payload, ttl } = message(push, now());
          return { kind: push.kind, user_id: push.user_id, event_ids: payload.event_ids, title: payload.title,
                   body: payload.body, ttl, browsers: push.endpoints.length };
        });
        log(`push: dry ${JSON.stringify(summary)}`);
        return json({ ...summary, dry: true, pushes: preview });
      }

      for (;;) {
        if (summary.batches === BATCHES) {
          summary.stopped = "batches";
          break;
        }
        if (summary.batches > 0 && clock() - started >= BUDGET_MS) {
          summary.stopped = "time";
          break;
        }
        const rows = await due();
        if (!rows.length) break;
        summary.batches += 1;
        summary.due += rows.length;
        await send(fold(rows));
      }
      await release();
    } catch (err) {
      try {
        await release();
      } catch {
        // what is still held is released five minutes on, as a crashed run's
      }
      log(`push: ${err.message} ${JSON.stringify(summary)}`);
      return json({ ...summary, error: err.message }, 500);
    }
    if (refused.length) {
      const error = `${refused.length} push(es) refused by the push service: our VAPID keys or our request`;
      log(`push: ${error} ${JSON.stringify(summary)}`);
      return json({ ...summary, error }, 500);
    }
    log(`push: ${JSON.stringify(summary)}`);
    return json(summary);
  };
}
