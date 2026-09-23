"""The zero hold (DECISIONS #44; contract.md, `last-run.json`): 2026's build, from its committed inputs, leaves no event
untagged, no work name unresolved and no track unknown. The build tolerates all three for a live year, but on a frozen
year each is a pipeline fault - the cache, the registries and tracks.json are ours to finish before any run - so CI
holds them at zero here. The venue counters, rooms unresolved and hotels unknown, are curation state (#45): reported,
never held.

Run:  python -m pytest tests/   (-s shows the venue counters)
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import events_v2 as v2  # noqa: E402
import registry  # noqa: E402
from season import load as load_season  # noqa: E402


def test_2026_builds_with_nothing_untagged_unresolved_or_unknown():
    path = os.path.join(ROOT, v2.SEASON)
    _, report = v2.build_season(load_season(path), os.path.dirname(path), os.path.join(ROOT, registry.DIR))
    print(f"2026's venue counters, reported and not held: rooms unresolved {report['rooms_unresolved']:,}, "
          f"hotels unknown {report['hotels_unknown']:,}; places {report['places']}")
    # 2026 is frozen, and the tag stage runs on it with --dry-run only (#46): what fixes these is a person's edit
    assert report["untagged"] == [], f"events untagged - a hand line in the cache (#34): {report['untagged'][:20]}"
    assert report["unresolved_names"] == {}, \
        f"work names unresolved - an alias in works.json: {report['unresolved_names']}"
    assert report["unknown_tracks"] == {}, f"tracks unknown - add them to tracks.json: {report['unknown_tracks']}"
