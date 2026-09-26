/* The push job's Edge Function (DECISIONS #55; docs/sync/contract.md, section 7): the runtime's half. push.js
   holds the logic; this hands it the environment, fetch, the clock and the Web Push encoder - npm:web-push's
   generateRequestDetails, which encrypts the payload (RFC 8291, aes128gcm) and signs the VAPID header (RFC
   8292) and leaves the sending to fetch, since its sendNotification goes through node:https. */
import webpush from "npm:web-push@3.6.7";
import { makeHandler } from "./push.js";

const env = Deno.env.toObject();
const vapidDetails = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };

Deno.serve(makeHandler({
  env,
  fetch,
  encode: (subscription, payload, { ttl, urgency }) =>
    webpush.generateRequestDetails(subscription, payload,
      { vapidDetails, TTL: ttl, urgency, contentEncoding: "aes128gcm" }),
  clock: () => Date.now(),
  log: (line) => console.log(line),
}));
