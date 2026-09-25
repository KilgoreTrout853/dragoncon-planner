import { loadJSON, saveJSON } from "./storage.js";
import { storageKey } from "./build.js";
import { record } from "./outbox.js";
import { axisKeys, events, linksTo, personName, tagsOf, worksById } from "./data.js";

/* ==================================================================
   Follows. A pick is one event; a follow is a standing interest - a
   track, a work, an axis value, or a person - that keeps producing
   events as the schedule changes. Stored in the order they were added,
   because the Following feed presents them that way.
   ================================================================== */
const FOLLOW_KINDS = ["track", "work", "axis", "person"];
const FOLLOW_AXES = ["medium", "genre", "craft", "subject", "audience"];
const SLUG = /^[a-z0-9-]+$/;
/* What a stored follow must look like to be kept, read as the module is
   imported and before any schedule is loaded, so it judges the shape and
   never whether the data knows the key: v1's follows by name and its fandom
   and topic kinds fall away here, with no migration (DECISIONS #39). A
   follow whose subject has no events stays, and says so in the feed. */
function wellFormedFollow(f) {
  if (!f || typeof f.key !== "string" || !f.key) return false;
  switch (f.kind) {
    case "track": return true;
    case "work": case "person": return SLUG.test(f.key);
    case "axis": {
      const i = f.key.indexOf(":");
      return i > 0 && FOLLOW_AXES.includes(f.key.slice(0, i)) && SLUG.test(f.key.slice(i + 1));
    }
    default: return false;
  }
}
let follows = (loadJSON(storageKey("follows"), []) || []).filter(wellFormedFollow);
const followId = f => `${f.kind}:${f.key}`;
/* The follows as last saved, by id, which saveFollows() compares the list
   with: each follow gained or lost since is a change for the outbox
   (docs/sync/contract.md, section 5). Read after the shape filter, so a
   follow it drops - v1's, never synced - is no change. */
let saved = new Set(follows.map(followId));
const keepFollows = () => saveJSON(storageKey("follows"), follows.map(f => ({kind: f.kind, key: f.key})));
/* The one door for a change to the follows, as savePicks() is for picks: it
   tells the outbox what changed since the last save, a follow an add and an
   unfollow a tombstone. */
function saveFollows() {
  const current = new Set(follows.map(followId)), changes = [];
  current.forEach(id => { if (!saved.has(id)) changes.push([id, true]); });
  saved.forEach(id => { if (!current.has(id)) changes.push([id, false]); });
  saved = current;
  keepFollows();
  record("follows", changes);
}
/* The reader's own follows a pull read, applied as the server has them, a
   new one at the end of the list; one of a shape this client does not keep
   is passed over. The saved copy moves with them, so the next save does not
   send them back. Returns whether the list changed. */
function applyPulledFollows(rows) {
  let changed = false;
  for (const {kind, key, followed} of rows) {
    if (!wellFormedFollow({kind, key})) continue;
    const id = followId({kind, key}), i = follows.findIndex(f => f.kind === kind && f.key === key);
    if (followed) saved.add(id); else saved.delete(id);
    if (followed && i < 0) { follows.push({kind, key}); changed = true; }
    else if (!followed && i >= 0) { follows.splice(i, 1); changed = true; }
  }
  if (changed) keepFollows();
  return changed;
}
function isFollowing(kind, key) { return follows.some(f => f.kind === kind && f.key === key); }
/* Whether the loaded schedule offers this to follow: a person it has, an axis
   value some event carries, a work it names that a person has reviewed. An
   unreviewed work is searchable, never followable (#34). A track is followed
   by its name, as it always was. */
function canFollow(kind, key) {
  switch (kind) {
    case "track": return typeof key === "string" && !!key;
    case "work": return (worksById.get(key) || {}).reviewed === true;
    case "axis": return axisKeys.has(key);
    case "person": return !!personName(key);
    default: return false;
  }
}
function toggleFollow(kind, key) {
  const i = follows.findIndex(f => f.kind === kind && f.key === key);
  if (i >= 0) follows.splice(i, 1);
  else if (canFollow(kind, key)) follows.push({kind, key});
  else return false;
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
    /* What the events are about, never the cast: a work's credit links are its
       Explore page's own group. */
    case "work":   return events.filter(e => linksTo(e, key));
    case "axis": {
      const i = key.indexOf(":"), axis = key.slice(0, i), value = key.slice(i + 1);
      return events.filter(e => {
        const tg = tagsOf(e);
        return axis === "audience" ? tg.audience === value : (tg[axis] || []).includes(value);
      });
    }
    /* Someone's photo sessions are half the reason to follow them, so the
       hide-photo-sessions setting deliberately does not apply here. */
    case "person": return events.filter(e => (e.people || []).some(p => p.id === key));
    default: return [];
  }
}

/* The handle's follows.set assigned the list; a module that imports follows
   may not, so it calls this. A copy, as that assignment made. */
function replaceFollows(list) { follows = [...list]; }

export {
  FOLLOW_KINDS, wellFormedFollow, follows, followId, saveFollows, applyPulledFollows, isFollowing, canFollow, toggleFollow,
  eventsFor, replaceFollows,
};
