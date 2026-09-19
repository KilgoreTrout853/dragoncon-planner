import { loadJSON, saveJSON } from "./storage.js";
import { events } from "./data.js";

/* ==================================================================
   Follows. A pick is one event; a follow is a standing interest - a
   track, a fandom, a topic, or a person - that keeps producing events
   as the schedule changes. Stored in the order they were added,
   because the Following feed presents them that way.
   ================================================================== */
const FOLLOW_KINDS = ["track", "fandom", "topic", "person"];
let follows = (loadJSON("dc26.follows", []) || [])
  .filter(f => f && FOLLOW_KINDS.includes(f.kind) && typeof f.key === "string" && f.key);
const followId = f => `${f.kind}:${f.key}`;
function saveFollows() { saveJSON("dc26.follows", follows.map(f => ({kind: f.kind, key: f.key}))); }
function isFollowing(kind, key) { return follows.some(f => f.kind === kind && f.key === key); }
function toggleFollow(kind, key) {
  const i = follows.findIndex(f => f.kind === kind && f.key === key);
  if (i >= 0) follows.splice(i, 1); else follows.push({kind, key});
  saveFollows();
  return i < 0;                       // true when it is now followed
}

/* events is already in start order and filter preserves it, so these come
   back chronological without re-sorting. */
function eventsFor(follow) {
  if (!follow || !follow.key) return [];
  const key = follow.key;
  switch (follow.kind) {
    case "track":  return events.filter(e => (e.tracks || []).includes(key));
    case "fandom": return events.filter(e => ((e.tags || {}).fandoms || []).includes(key));
    case "topic":  return events.filter(e => ((e.tags || {}).topics || []).includes(key));
    case "person": {
      /* Someone's photo sessions are half the reason to follow them, so the
         hide-photo-sessions setting deliberately does not apply here. */
      const lower = key.toLowerCase();
      return events.filter(e => (e.speakers || []).some(p => (p.name || "").toLowerCase() === lower));
    }
    default: return [];
  }
}

/* The handle's follows.set assigned the list; a module that imports follows
   may not, so it calls this. A copy, as that assignment made. */
function replaceFollows(list) { follows = [...list]; }

export {
  FOLLOW_KINDS, follows, followId, saveFollows, isFollowing, toggleFollow, eventsFor,
  replaceFollows,
};
