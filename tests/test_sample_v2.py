"""Tests for tools/sample_v2.py: the page tests' fixture, tests/sample-events.json, is the v2 shape the client
reads (DECISIONS #39), made from the v1 sample, tests/sample-events.v1.json. The committed fixture is held to a
fresh build, as data/2026/events.v2.json is, so an edit to the v1 sample, the registries, 2026's venues file or the
tool with no rebuild after it fails here, in CI's pipeline job. No model, no network.

Run:  python -m pytest tests/
"""
import importlib.util
import json
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import merge_stage  # noqa: E402
import registry  # noqa: E402
import venues  # noqa: E402
import venues_stage  # noqa: E402

TOOL = os.path.join(ROOT, "tools", "sample_v2.py")
PLACED = list(merge_stage.FIELDS) + ["id", "source_id", "hotel", "room", "level", "rooms", "place", "track",
                                     "cancelled", "people", "facets"]
spec = importlib.util.spec_from_file_location("sample_v2", TOOL)
sv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sv)


def committed():
    with open(sv.OUT, "rb") as f:
        return json.loads(f.read().decode("utf-8"))


def v1():
    with open(sv.V1, "rb") as f:
        return json.loads(f.read().decode("utf-8"))


def test_the_committed_sample_is_a_fresh_build():
    for seed in ("0", "1"):
        run = subprocess.run([sys.executable, TOOL, "--check"], cwd=ROOT, capture_output=True, text=True,
                             env={**os.environ, "PYTHONHASHSEED": seed})
        assert run.returncode == 0, "stale: run `python tools/sample_v2.py` and commit the result\n" + run.stderr


def test_the_file_has_the_v2_shape_and_the_v1_sample_s_events():
    doc, old = committed(), v1()
    assert list(doc) == ["generated_at", "changed_at", "source", "count", "failures", "works", "events"]
    assert all(doc[k] == old[k] for k in old if k != "events")
    assert [e["id"] for e in doc["events"]] == [e["id"] for e in old["events"]]
    placed = venues_stage.resolve(old["events"], venues.load(sv.VENUES)).rows
    for e, o, p in zip(doc["events"], old["events"], placed):
        # the file's order; the ten raw fields as the v1 sample has them, and its id, which is also the source id
        assert list(e) == PLACED + (["tags"] if "tags" in e else [])
        assert {k: e[k] for k in merge_stage.FIELDS} == {k: o[k] for k in merge_stage.FIELDS}
        assert e["id"] == e["source_id"] == o["id"]
        # the place is the venues step's reading of the location, as events_v2.py's is; track and cancelled as v1's
        assert {k: e[k] for k in ("hotel", "room", "level", "rooms", "place")} == \
            {k: p[k] for k in ("hotel", "room", "level", "rooms", "place")}
        assert (e["track"], e["cancelled"]) == (o["track"], o["cancelled"])
        assert not {"fandoms", "topics", "adult"} & set(e.get("tags") or {})


def test_the_events_v1_tagged_carry_v2_tags_and_the_rest_carry_works_at_most():
    doc, old = committed(), {e["id"]: e for e in v1()["events"]}
    for e in doc["events"]:
        if old[e["id"]].get("tags"):
            assert list(e["tags"])[:7] == ["kind", "works", "medium", "genre", "craft", "subject", "audience"]
            assert e["tags"]["kind"] == old[e["id"]]["tags"]["kind"]
            assert (e["tags"]["audience"] == "mature") == bool(old[e["id"]]["tags"]["adult"])
            assert e["tags"].get("guests") in (None, "celebrity", "creator")
        elif "tags" in e:
            assert list(e["tags"]) == ["works"] and e["tags"]["works"]


def test_a_work_rolls_up_and_the_block_is_every_linked_work_and_its_ancestors():
    doc, reg = committed(), registry.load(os.path.join(ROOT, registry.DIR))
    rows = {w["id"]: w for w in doc["works"]}
    assert rows["andor"]["parent"] == "star-wars"
    linked = {w["id"] for e in doc["events"] for w in (e.get("tags") or {}).get("works", [])}
    parents = {w["id"]: w.get("parent") for w in doc["works"]}
    expected = set(linked)
    for w in linked:
        at = parents.get(w)
        while at:
            expected.add(at)
            at = parents.get(at)
    assert set(rows) == expected
    direct = sum(1 for e in doc["events"] if any(w["id"] == "star-wars" for w in (e.get("tags") or {}).get("works", [])))
    rolled = sum(1 for e in doc["events"] if any(w["id"] in ("star-wars", "andor") for w in (e.get("tags") or {}).get("works", [])))
    assert rolled > direct > 0
    # a row the registry holds is as the registry holds it; a fandom it cannot resolve is the fixture's own, reviewed
    by_id = reg.by_id("works")
    for wid, row in rows.items():
        entry = by_id.get(wid)
        if entry:
            assert (row["name"], row["reviewed"], row.get("parent")) == (entry["name"], entry["reviewed"], entry.get("parent"))
        else:
            assert row == {"id": wid, "name": row["name"], "aliases": [], "terms": [], "reviewed": True}
            assert reg.resolve_work(row["name"]) is None


def test_every_topic_goes_to_a_value_of_its_closed_axis():
    for topic, (axis, value) in sv.TOPIC_AXES.items():
        assert value in registry.AXES[axis], topic


def test_people_have_the_v2_shape_and_the_registry_s_person_is_among_them():
    doc = committed()
    people = [p for e in doc["events"] for p in e["people"]]
    assert people and all(set(p) == {"id", "name", "role", "src"} for p in people)
    assert "eugene-cordero" in {p["id"] for p in people}
