"""Tests for tools/sample_v2.py: the page tests' fixture, tests/sample-events.json, is the v2 shape the client
reads (DECISIONS #39), made from the v1 sample, tests/sample-events.v1.json. The committed fixture is held to a
fresh build, as data/2026/events.v2.json is, so an edit to the v1 sample, the registries or the tool with no
rebuild after it fails here, in CI's pipeline job. No model, no network.

Run:  python -m pytest tests/
"""
import importlib.util
import json
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import registry  # noqa: E402

TOOL = os.path.join(ROOT, "tools", "sample_v2.py")
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
    for e, o in zip(doc["events"], old["events"]):
        assert {k: v for k, v in e.items() if k not in ("people", "facets", "tags")} == {k: v for k, v in o.items() if k != "tags"}
        assert list(e)[-3:] == ["people", "facets", "tags"] if "tags" in e else list(e)[-2:] == ["people", "facets"]
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


def test_people_carry_the_registry_s_ids():
    doc = committed()
    people = [p for e in doc["events"] for p in e["people"]]
    assert people and all(set(p) == {"id", "name", "role", "src"} for p in people)
    assert "eugene-cordero" in {p["id"] for p in people}
