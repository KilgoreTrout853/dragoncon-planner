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
/* The words the page uses for each kind of follow. A work is still a
   fandom and an axis value a topic, to the reader. Explore's pages and its
   Following feed say them, and an event's sheet names each chip by them. */
const KIND_NOUN = {track: "Track", work: "Fandom", axis: "Topic", person: "Person"};
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
const holds = (list, kind, key) => list.some(f => f.kind === kind && f.key === key);
/* Mutes (DECISIONS #84): what the reader has said "not this" of - anything
   that can be followed, by the same {kind, key} and the same shape test, in
   the order they were made. A mute does one thing: the thing is no longer
   suggested. It is kept on the device alone, under a key of its own: no
   mute is handed to the outbox and none is read from a pull. Follow and
   Mute are one or the other, so a stored mute of something also followed -
   two tabs can leave one - is dropped as it is read, and the follow wins. */
let mutes = (loadJSON(storageKey("mutes"), []) || []).filter(wellFormedFollow).filter(m => !holds(follows, m.kind, m.key));
const keepMutes = () => saveJSON(storageKey("mutes"), mutes.map(m => ({kind: m.kind, key: m.key})));
/* The follows as last saved, by id, which saveFollows() compares the list
   with: each follow gained or lost since is a change for the outbox
   (docs/sync/contract.md, section 5). Read after the shape filter, so a
   follow it drops - v1's, never synced - is no change. */
let saved = new Set(follows.map(followId));
/* The write of the follows, which is also where a follow unmutes: whatever
   is followed now is taken out of the mutes. Every road that adds a follow
   writes the list through here - a tap, a pull, the handle's set - so after
   any of them nothing is both followed and muted (#84). */
function keepFollows() {
  saveJSON(storageKey("follows"), follows.map(f => ({kind: f.kind, key: f.key})));
  const left = mutes.filter(m => !holds(follows, m.kind, m.key));
  if (left.length !== mutes.length) { mutes = left; keepMutes(); }
}
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
   send them back. A follow it brings unmutes, in keepFollows(); an unfollow
   it brings leaves a mute alone. Returns whether the list changed. */
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
function isFollowing(kind, key) { return holds(follows, kind, key); }
function isMuted(kind, key) { return holds(mutes, kind, key); }
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

/* Mute, or unmute. A new mute is gated as a new follow is, by canFollow();
   one already made can always be undone, and stays in the list when the
   schedule no longer offers the thing, as a follow does. Muting what is
   followed unfollows it through saveFollows(), so the unfollow syncs as any
   other does; the mute itself goes to storage and nowhere else. Returns
   whether it is now muted. */
function toggleMute(kind, key) {
  const i = mutes.findIndex(m => m.kind === kind && m.key === key);
  if (i >= 0) mutes.splice(i, 1);
  else if (canFollow(kind, key)) {
    const j = follows.findIndex(f => f.kind === kind && f.key === key);
    if (j >= 0) { follows.splice(j, 1); saveFollows(); }
    mutes.push({kind, key});
  }
  else return false;
  keepMutes();
  return i < 0;
}

/* events is already in start order and filter preserves it, so these come
   back chronological without re-sorting. */
function eventsFor(follow) {
  if (!follow || !follow.key) return [];
  const key = follow.key;
  switch (follow.kind) {
    case "track":  return events.filter(e => (e.tracks || []).includes(key));
    /* What the events are about, never the cast: a work's credit links are
       castEvents()'s, data.js's, a group apart wherever it is drawn (#85). */
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
  FOLLOW_KINDS, KIND_NOUN, wellFormedFollow, follows, followId, saveFollows, applyPulledFollows, isFollowing, canFollow, toggleFollow,
  mutes, isMuted, toggleMute, eventsFor, replaceFollows,
};
