/* The state changes behind tools/review-people.html, as pure functions.
 *
 * No import and no export: the page loads this as a classic script, because a browser refuses an
 * ES module over file://, and `tests/unit/review-people.test.js` imports the same file for its
 * side effect and reads `globalThis.ReviewPeople`. A file with no bindings is valid as both.
 *
 * Every function here takes a state and returns a new one; nothing touches the DOM, the disk or
 * localStorage. The page owns all three.
 */

(function () {
  "use strict";

  const clone = (x) => (typeof structuredClone === "function" ? structuredClone(x) : JSON.parse(JSON.stringify(x)));

  /** The three files as one state. `sidecar` is the drafter's, and is written back unchanged but
   *  for the notes, the rejections and what a review adds. */
  function load(people, works, sidecar) {
    const side = sidecar || {};
    return {
      people: clone(people || []),
      works: clone(works || []),
      sidecar: {
        people: clone(side.people || {}),
        rejected: clone(side.rejected || []),
        minted: clone(side.minted || []),
      },
    };
  }

  const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
  const note = (state, id) => state.sidecar.people[id] || {};

  /** Who is left to judge, and in what order: low confidence first, because that is where a
   *  person's eye is worth most, then by name. */
  function order(state, filters) {
    const f = filters || {};
    return state.people
      .filter((p) => (f.unreviewedOnly ? p.reviewed !== true : true))
      .filter((p) => (f.tier && f.tier !== "all" ? p.tier === f.tier : true))
      .map((p) => ({ person: p, meta: note(state, p.id) }))
      .sort((a, b) => {
        const low = (x) => (x.meta.confidence === "low" ? 0 : 1);
        return low(a) - low(b) || a.person.name.localeCompare(b.person.name);
      })
      .map((x) => x.person);
  }

  function progress(state) {
    const done = state.people.filter((p) => p.reviewed === true).length;
    return { done, total: state.people.length, left: state.people.length - done };
  }

  /** Approve one card. The person and every credit kept turn reviewed, and so does each work a
   *  kept credit points at - a credit is only as good as the work it names. A dropped credit is
   *  removed outright; the registry has no memory of a credit a person said no to. */
  function approve(state, id, choice) {
    const c = choice || {};
    const drop = new Set(c.drop || []);
    const next = clone(state);
    const person = byId(next.people)[id];
    if (!person) return next;
    person.tier = c.tier || person.tier;
    person.credits = (person.credits || [])
      .filter((credit) => !drop.has(credit.work))
      .map((credit) => ({ work: credit.work, reviewed: true }));
    person.reviewed = true;
    const works = byId(next.works);
    for (const credit of person.credits) {
      if (works[credit.work]) works[credit.work].reviewed = true;
    }
    next.sidecar.people[id] = Object.assign({}, next.sidecar.people[id], { notes: c.notes || "" });
    return next;
  }

  /** "Not a guest": the person leaves the registry and the sidecar records who said so, beside
   *  the model's own rejections. */
  function reject(state, id, notes) {
    const next = clone(state);
    const person = byId(next.people)[id];
    if (!person) return next;
    next.people = next.people.filter((p) => p.id !== id);
    next.sidecar.rejected = next.sidecar.rejected.filter((r) => r.id !== id).concat([{
      id,
      by: "review",
      name: person.name,
      events: (note(next, id).events || []).slice(),
    }]);
    next.sidecar.people[id] = Object.assign({}, next.sidecar.people[id], { notes: notes || "" });
    return next;
  }

  /** "This is a guest", against a rejection the model made: the person joins the registry with the
   *  tier a reviewer picked and no credits - those go in the notes, for a later pass. */
  function unreject(state, id, tier, notes) {
    const next = clone(state);
    const row = next.sidecar.rejected.find((r) => r.id === id);
    if (!row || byId(next.people)[id]) return next;
    next.sidecar.rejected = next.sidecar.rejected.filter((r) => r.id !== id);
    next.people = next.people.concat([{
      id, name: row.name, aliases: [], tier, credits: [], reviewed: true,
    }]);
    next.sidecar.people[id] = Object.assign({}, next.sidecar.people[id], { notes: notes || "" });
    return next;
  }

  /** A work the drafter minted, still unreviewed, that no credit points at any more is dropped:
   *  it only ever existed to carry a credit, and the credit is gone. A minted work a reviewer
   *  approved stays, and a work the registry already held is never touched. */
  function pruneWorks(state) {
    const minted = new Set(state.sidecar.minted || []);
    const used = new Set();
    for (const person of state.people) {
      for (const credit of person.credits || []) used.add(credit.work);
    }
    return state.works.filter((w) => !(minted.has(w.id) && w.reviewed === false && !used.has(w.id)));
  }

  /** The three files as the loader expects them: sorted by id, and the keys in the registry's own
   *  order so a diff shows the review and nothing else. */
  const WORK_KEYS = ["id", "name", "aliases", "type", "family", "parent", "terms", "reviewed"];
  const PERSON_KEYS = ["id", "name", "aliases", "tier", "credits", "reviewed"];

  function pick(row, keys) {
    const out = {};
    for (const k of keys) if (row[k] !== undefined) out[k] = row[k];
    return out;
  }

  function exported(state) {
    const sorted = (rows) => rows.slice().sort((a, b) => a.id.localeCompare(b.id));
    return {
      people: sorted(state.people).map((p) => pick(p, PERSON_KEYS)),
      works: sorted(pruneWorks(state)).map((w) => pick(w, WORK_KEYS)),
      sidecar: {
        minted: (state.sidecar.minted || []).slice().sort(),
        people: state.sidecar.people,
        rejected: state.sidecar.rejected.slice().sort((a, b) => a.id.localeCompare(b.id)),
      },
    };
  }

  /** Keys sorted at every level, the way Python's json.dump(sort_keys=True) writes them, so the
   *  sidecar this page exports diffs against the one the drafter wrote. */
  function sortKeys(value) {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") {
      const out = {};
      for (const k of Object.keys(value).sort()) out[k] = sortKeys(value[k]);
      return out;
    }
    return value;
  }

  /** One entry, spaced the way Python's json.dumps writes it - ", " between items and ": " after a
   *  key. JSON.stringify has no separator option and packs them tight, which would rewrite all 145
   *  lines of a registry on export and bury the one row a reviewer actually changed. */
  function pyJson(value) {
    if (Array.isArray(value)) return "[" + value.map(pyJson).join(", ") + "]";
    if (value && typeof value === "object") {
      return "{" + Object.entries(value)
        .map(([k, v]) => JSON.stringify(k) + ": " + pyJson(v)).join(", ") + "}";
    }
    return JSON.stringify(value);
  }

  /** One entry a line for a registry, as they are written on disk; the sidecar indented, as the
   *  drafter writes it. */
  function toJson(value) {
    if (Array.isArray(value)) {
      return value.length ? "[\n" + value.map((r) => "  " + pyJson(r)).join(",\n") + "\n]\n" : "[]\n";
    }
    return JSON.stringify(sortKeys(value), null, 1) + "\n";
  }

  globalThis.ReviewPeople = {
    load, order, progress, approve, reject, unreject, pruneWorks, exported, toJson, sortKeys,
  };
}());
