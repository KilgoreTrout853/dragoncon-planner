"""Tests for census_v2.py: its pure parts on inline fixtures, a render of a small fixture under two hash seeds, what
stops it and what --check does, a run that reaches no model, no process and no network, and the committed report
held to a fresh render of the committed data. Only the last three tests read data/, and nothing here writes there.

Run:  python -m pytest tests/
"""
import hashlib
import json
import os
import socket
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import census_v2 as cv  # noqa: E402
import draft_people as dp  # noqa: E402
import events_v2 as v2  # noqa: E402
import registry  # noqa: E402
import tag_events  # noqa: E402
import tag_stage as ts  # noqa: E402

# --- the pure parts ---------------------------------------------------------------

PARENTS = {"star-trek": None, "star-trek-lower-decks": "star-trek", "lower-decks-season-1": "star-trek-lower-decks",
           "firefly": None}


def test_a_v1_fandom_is_the_same_more_specific_less_specific_or_lost():
    assert cv.fandom_class("star-trek", {"star-trek", "firefly"}, PARENTS) == "same"
    assert cv.fandom_class("star-trek", {"lower-decks-season-1"}, PARENTS) == "more specific"   # a grandchild counts
    assert cv.fandom_class("star-trek-lower-decks", {"star-trek"}, PARENTS) == "less specific"
    assert cv.fandom_class("firefly", {"star-trek"}, PARENTS) == "lost"
    assert cv.fandom_class("firefly", set(), PARENTS) == "lost"
    # the work itself beats a descendant beside it
    assert cv.fandom_class("star-trek", {"star-trek-lower-decks", "star-trek"}, PARENTS) == "same"


NAMES = {"the-dresden-files": ["The Dresden Files"], "codex-alera": ["Codex Alera"],
         "pee-wees-playhouse": ["Pee-wee's Playhouse"], "star-wars": ["Star Wars"], "star-trek": ["Star Trek", "Trek"],
         "firefly": ["Firefly", "Serenity"]}


def sent(title, description):
    return {"title": title, "type": "panel", "tracks": ["Main Programming"], "description": description}


def test_two_links_only_the_description_names_are_flagged_together():
    got = cv.resume_flags(sent("An Hour with Ada Quill", "Q&A with the author of the Dresden Files and Codex Alera."),
                          [("the-dresden-files", "the Dresden Files"), ("codex-alera", "Codex Alera")], NAMES)
    assert [(wid, why) for wid, _, why, _ in got] == [("the-dresden-files", ["shares its input with another"]),
                                                      ("codex-alera", ["shares its input with another"])]
    assert got[0][3] == "Q&A with the author of the Dresden Files and Codex Alera."


def test_a_lone_link_is_flagged_only_when_a_cue_ends_within_60_characters_before_it():
    links = [("pee-wees-playhouse", "Pee-wee's Playhouse")]
    got = cv.resume_flags(sent("Robots and Teeth", "Best known for Conky on Pee-wee's Playhouse."), links, NAMES)
    assert [(wid, why) for wid, _, why, _ in got] == [("pee-wees-playhouse", ['after "known for"'])]
    # the cue ends 60 characters before the evidence, then 61: in, then out
    near = "Known for " + "y" * 58 + " Pee-wee's Playhouse."
    far = "Known for " + "y" * 59 + " Pee-wee's Playhouse."
    assert cv.resume_flags(sent("Robots", near), links, NAMES) and not cv.resume_flags(sent("Robots", far), links, NAMES)
    assert cv.resume_flags(sent("Robots", "A talk on Pee-wee's Playhouse."), links, NAMES) == []
    # a cue is a whole phrase: "trainings such as" is a cue, "reworked on" is not "worked on"
    assert cv.resume_flags(sent("Robots", "Shows such as Pee-wee's Playhouse."), links, NAMES)
    assert cv.resume_flags(sent("Robots", "He reworked on Pee-wee's Playhouse."), links, NAMES) == []


def test_evidence_in_the_title_or_a_work_the_title_names_is_no_candidate_and_no_partner():
    desc = "Star Trek is turning 60, and Star Wars is turning 50."
    links = [("star-trek", "Star Trek is turning 60"), ("star-wars", "Star Wars is turning 50")]
    # the title holds "Star Wars", so that link is left out and Star Trek shares its input with no candidate; the
    # title's "Trek's" is not the alias "Trek", because an apostrophe is part of a word to the pilot's word_in
    assert cv.resume_flags(sent("Trek's Influence on Star Wars", desc), links, NAMES) == []
    assert len(cv.resume_flags(sent("Two Birthdays", desc), links, NAMES)) == 2
    # an alias counts, folded
    assert cv.resume_flags(sent("SERENITY Sing-along", "Songs of Firefly and Star Trek."),
                           [("firefly", "Firefly"), ("star-trek", "Star Trek")], NAMES) == []
    # evidence the title holds is no candidate, whatever the work's name
    assert cv.resume_flags(sent("Codex Alera night", "Codex Alera and the Dresden Files."),
                           [("codex-alera", "Codex Alera"), ("the-dresden-files", "the Dresden Files")], NAMES) == []


def test_the_context_is_the_description_around_the_evidence_as_written():
    text = "x" * 50 + " the Dresden Files " + "y" * 50
    assert cv.context(text, "the  dresden files") == "..." + "x" * 39 + " the Dresden Files " + "y" * 39 + "..."
    # where only the folded text holds it (a curly apostrophe), the folded text is shown
    assert cv.context("Best known for Pee-wee’s Playhouse.", "Pee-wee's Playhouse") == \
        "best known for pee-wee's playhouse."
    assert cv.context("Nothing here.", "Codex Alera") == ""


def test_the_band_marker_finds_whole_word_names_folded_in_titles():
    names = ["Eurovision", "Castle", "Pokémon", "What If", "DC", "Trek", "Pee-wee's Playhouse"]
    assert cv.title_holds("Eurovision Karaoke", names) == ["Eurovision"]
    assert cv.title_holds("Castlevania Night", names) == []                       # not inside a longer word
    assert cv.title_holds("POKEMON Party", names) == ["Pokémon"]             # case and accents fold
    assert cv.title_holds("What   if? A Sing-along", names) == ["What If"]        # whitespace collapses
    assert cv.title_holds("Pee-wee’s Playhouse Live", names) == ["Pee-wee's Playhouse"]   # curly quotes fold
    assert cv.title_holds("Trek's Big Night", names) == []                        # the apostrophe is in the word
    assert cv.title_holds("DDAL FR-DC-TDD-03", names) == ["DC"]                   # a hyphen is not
    assert cv.title_holds("", names) == [] and cv.title_holds("Eurovision", []) == []


def test_which_field_of_the_input_varied():
    a = {"title": "Wingspan", "type": "gaming", "tracks": ["Board Games"], "description": "Learn it."}
    assert cv.varied([a, dict(a)]) == []
    assert cv.varied([a, {**a, "description": "Play it."}, {**a, "tracks": ["Board Games", "Kids Track"]}]) == \
        ["tracks", "description"]
    assert cv.varied([a, {**a, "title": "WINGSPAN", "type": "panel"}]) == ["title", "type"]


def test_which_built_tags_differ_and_credits_guests_and_order_do_not_count():
    base = {"kind": "gaming", "works": [{"id": "wingspan", "via": "about"}], "medium": ["tabletop", "video-games"],
            "genre": [], "craft": [], "subject": [], "audience": "all", "play": {"format": "demo", "level": "beginner"}}
    cast = {**base, "works": base["works"] + [{"id": "firefly", "via": "credit:nathan-fillion"}], "guests": "celebrity"}
    assert cv.differing([base, cast, {**base, "medium": ["video-games", "tabletop"]}]) == []
    assert cv.differing([base, {**base, "kind": "workshop"}, {k: v for k, v in base.items() if k != "play"}]) == \
        ["kind", "play"]
    assert cv.differing([base, {**base, "works": [], "genre": ["fantasy"]}]) == ["about", "genre"]


def test_the_band_marker_leaves_out_a_work_minted_in_a_later_year():
    """A 2027 mint must leave the 2026 report as it is (#46); a work no event links still counts, which is what the
    list is for."""
    works = [{"id": "eurovision", "name": "Eurovision", "aliases": []},
             {"id": "the-yetis", "name": "The Yetis", "aliases": ["Yetis"],
              "minted": {"year": 2027, "run": "2027-08-01T10:17Z"}},
             {"id": "the-owls", "name": "The Owls", "aliases": [], "minted": {"year": 2026, "run": "2026-09-01T00:17Z"}}]
    assert cv.band_names(works, 2026) == ["Eurovision", "The Owls"]
    assert cv.band_names(works, 2027) == ["Eurovision", "The Owls", "The Yetis", "Yetis"]
    assert not cv.minted_after({"minted": {"year": True}}, 2026) and not cv.minted_after({"minted": 2027}, 2026)
    assert cv.YEAR == 2026


def test_an_unreviewed_work_came_from_the_drafter_the_tagger_or_elsewhere():
    minted, named = {"castle", "the-boys"}, {"the-boys", "brandish"}
    assert cv.work_source("the-boys", minted, named) == "drafter"     # the sidecar decides, whoever names it
    assert cv.work_source("brandish", minted, named) == "tagger"
    assert cv.work_source("eurovision", minted, named) == "other"


# --- a fixture, run whole ----------------------------------------------------------

WORKS = [
    {"id": "castle", "name": "Castle", "aliases": [], "type": "franchise", "reviewed": False},
    {"id": "codex-alera", "name": "Codex Alera", "aliases": [], "type": "franchise", "reviewed": False},
    {"id": "dungeons-and-dragons", "name": "Dungeons & Dragons", "aliases": ["D&D"], "type": "game", "family": "rpg",
     "terms": ["DDAL"], "reviewed": True},
    {"id": "eurovision", "name": "Eurovision", "aliases": [], "type": "franchise", "reviewed": False},
    {"id": "firefly", "name": "Firefly", "aliases": ["Serenity"], "type": "franchise", "reviewed": True},
    {"id": "pee-wees-playhouse", "name": "Pee-wee's Playhouse", "aliases": [], "type": "franchise", "reviewed": True},
    {"id": "star-trek", "name": "Star Trek", "aliases": ["Trek"], "type": "franchise", "reviewed": True},
    {"id": "star-trek-lower-decks", "name": "Star Trek: Lower Decks", "aliases": ["Lower Decks"], "parent": "star-trek",
     "type": "franchise", "reviewed": True},
    {"id": "the-dresden-files", "name": "The Dresden Files", "aliases": [], "type": "franchise", "reviewed": False},
    {"id": "wingspan", "name": "Wingspan", "aliases": [], "type": "game", "family": "board", "reviewed": False},
]
PEOPLE = [
    {"id": "nathan-fillion", "name": "Nathan Fillion", "aliases": [], "tier": "celebrity",
     "credits": [{"work": "firefly", "reviewed": False}, {"work": "castle", "reviewed": False}], "reviewed": False},
    {"id": "pat-henry", "name": "Pat Henry", "aliases": [], "credits": [], "reviewed": True},
]
TRACKS = [
    {"id": "main-programming", "name": "Main Programming", "aliases": []},
    {"id": "trek-track", "name": "Trek Track", "aliases": [], "work": "star-trek"},
    {"id": "kids-track", "name": "Kids Track", "aliases": [], "audience": "kids"},
    {"id": "filk-music", "name": "Filk Music", "aliases": [], "axes": {"medium": ["music"]}},
    {"id": "board-games", "name": "Board Games", "aliases": [], "axes": {"medium": ["tabletop"]}},
    {"id": "role-playing-games-campaign", "name": "Role-Playing Games (Campaign)", "aliases": [],
     "axes": {"medium": ["tabletop"]}},
]
SIDECAR = {"minted": ["castle", "codex-alera", "the-dresden-files"],
           "people": {"nathan-fillion": {"name": "Nathan Fillion", "confidence": "high", "known_for": "Actor.",
                                         "events": ["Castle Cast"]}},
           "rejected": [{"id": "primetime-steve", "by": "model", "name": "Primetime Steve", "events": ["Castle Cast"]},
                        {"id": "galactic-empire", "by": "review", "name": "Galactic Empire", "events": []}]}


def ev(title, start, description="", tracks=("Main Programming",), type="panel", speakers=(), v1=None):
    tracks = list(tracks)
    out = {"id": f"{title}|{start}", "type": type, "title": title, "day": start[:10], "start": start, "end": start,
           "duration_min": 60, "location": "Marriott A", "hotel": "Marriott", "room": "A", "description": description,
           "tracks": tracks, "track": tracks[0] if tracks else "",
           "speakers": [{"name": nm, "role": role} for nm, role in speakers], "cancelled": False}
    if v1 is not None:
        out["tags"] = {"fandoms": [], "kind": "panel", "topics": [], "adult": False, "guests": "fan", **v1}
    return out


def ans(kind="panel", works=(), audience="all", play=None, **axes):
    """A cached answer; a work is a name, or (name, evidence)."""
    works = [w if isinstance(w, tuple) else (w, w) for w in works]
    return {"kind": kind, "works": [{"name": nm, "evidence": evidence, "type": "franchise"} for nm, evidence in works],
            "medium": [], "genre": [], "craft": [], "subject": [], **axes, "audience": audience, "play": play}


PAIRS = [
    (ev("Castle Cast", "2026-09-05T11:30", "Bring your questions!", speakers=[("Nathan Fillion", "Speaker"),
                                                                              ("Primetime Steve", "Moderator")],
        v1={"fandoms": ["Castle"], "kind": "qa", "guests": "celebrity"}),
     ans("qa", ["Castle"], medium=["tv"])),
    (ev("Star Trek: Lower Decks Q&A", "2026-09-05T13:00",
        v1={"fandoms": ["Star Trek"], "kind": "qa", "guests": "celebrity"}),
     ans("qa", ["Star Trek: Lower Decks"], medium=["animation"])),
    (ev("Trek Trivia Night", "2026-09-05T20:00", "Questions about the final frontier.", tracks=["Trek Track"],
        v1={"kind": "contest"}),
     ans("contest")),
    (ev("An Hour with Ada Quill", "2026-09-04T10:00", "Q&A with the author of the Dresden Files and Codex Alera.",
        speakers=[("Ada Quill", "Speaker")], v1={"kind": "qa", "guests": "creator"}),
     ans("qa", [("The Dresden Files", "the Dresden Files"), "Codex Alera"], medium=["books"])),
    (ev("Robots and Teeth", "2026-09-06T15:00", "Best known for Conky on Pee-wee's Playhouse, he talks puppets.",
        v1={"kind": "panel"}),
     ans("performance", [("Pee-wee's Playhouse", "Conky on Pee-wee's Playhouse")], craft=["puppetry"])),
    (ev("Eurovision Karaoke", "2026-09-05T23:30", "Sing along. Podcast ‘No Latency’ hosts.",
        tracks=["Filk Music"], v1={"fandoms": ["Firefly"], "kind": "performance"}),
     ans("performance", craft=["performance"])),
    (ev("Wingspan Demo", "2026-09-04T10:00", "Learn it.", tracks=["Board Games"], type="gaming",
        v1={"kind": "gaming"}),
     ans("gaming", ["Wingspan"], play={"format": "demo", "level": "beginner"})),
    (ev("Wingspan Demo", "2026-09-05T10:00", "Paint the birds.", tracks=["Board Games"], type="gaming",
        v1={"kind": "gaming"}),
     ans("workshop", ["Wingspan"])),
    (ev("Grown-up Games", "2026-09-05T22:00", "Party games for grown-ups.(Mature Audience)", tracks=["Kids Track"],
        v1={"kind": "party", "adult": True}),
     ans("party", audience="mature")),
    (ev("Dragon Con Wrestling", "2026-09-03T19:00", "Wrestling, live!", v1={"kind": "contest"}),
     ans("performance", craft=["performance"])),
    (ev("FaerÃ»n Nights", "2026-09-06T09:00", "DDAL play in FaerÃ»n.",
        tracks=["Role-Playing Games (Campaign)"], type="gaming", v1={"fandoms": ["Dungeons & Dragons"], "kind": "gaming"}),
     ans("gaming", ["Dungeons & Dragons", ("DDAL", "DDAL")], play={"format": "organized-play", "level": "any"})),
    (ev("Convention League", "2026-09-04T12:00", "Weekly MTG.", tracks=["Board Games"], type="gaming",
        v1={"fandoms": ["Anime"], "kind": "gaming"}),
     ans("gaming", play={"format": "tournament", "level": "any"})),
    (ev("Photo Session: Pat Henry", "2026-09-06T12:00", speakers=[("Pat Henry", "Speaker")]),
     ans("photo")),
]


def write_fixture(tmp_path, pairs=PAIRS):
    """The inputs census_v2 reads, as the pipeline writes them, and events.v2.json built from them. Returns the
    command-line arguments naming them."""
    d = tmp_path / "registry"
    d.mkdir(exist_ok=True)
    dp.write_json(str(d / "works.json"), [dp.in_order(w, dp.WORK_KEYS) for w in WORKS])
    dp.write_json(str(d / "people.json"), [dp.in_order(p, dp.PERSON_KEYS) for p in PEOPLE])
    dp.write_json(str(d / "tracks.json"), TRACKS)
    dp.write_json(str(tmp_path / "people.draft.json"), SIDECAR)
    data = {"generated_at": "2026-09-07T12:50:19+00:00", "source": "fixture", "count": len(pairs),
            "events": [e for e, _ in pairs]}
    (tmp_path / "events.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    cache = {}
    for e, a in pairs:
        inp = ts.tagger_input(e)
        cache[ts.input_key(inp)] = {"key": ts.input_key(inp), "title": inp["title"], "model": "m", "answer": a}
    ts.write_cache(str(tmp_path / "tags.cache.jsonl"), cache)
    doc, _ = v2.build(data, registry.load(str(d)), ts.load_cache(str(tmp_path / "tags.cache.jsonl")))
    (tmp_path / "events.v2.json").write_bytes(v2.dumps(doc))
    return ["--events", str(tmp_path / "events.json"), "--v2", str(tmp_path / "events.v2.json"),
            "--cache", str(tmp_path / "tags.cache.jsonl"), "--registry", str(d),
            "--sidecar", str(tmp_path / "people.draft.json")]


def fixture_text(tmp_path):
    args = write_fixture(tmp_path)
    out = tmp_path / "census.md"
    assert cv.main(args + ["--out", str(out)]) == 0
    return out.read_text(encoding="utf-8")


def test_the_fixture_renders_every_section_and_what_it_should_list(tmp_path):
    text = fixture_text(tmp_path)
    for heading in ["## 0. Headline", "## 1. Coverage", "## 2. Works", "## 3. Axes", "## 4. Kind", "## 5. Audience",
                    "## 6. Play", "## 7. Guests and people", "## 8. Tracks", "## 9. Recurring",
                    "## 10. Links to check - UNSURE", "## 11. v1 against v2", "## 12. Text", "## 13. Observations",
                    "## Appendix A.", "## Appendix B.", "## Appendix C."]:
        assert heading in text, heading
    assert "## Appendix D" not in text
    assert "- Every event has exactly one cache line: the 13 events send 13 distinct inputs" in text
    assert "| Trek Track | 1 | - | - | - | - | 1 (`star-trek`) |" in text
    # the resume rule: two description-only links, and one after a cue
    assert "- UNSURE: `An Hour with Ada Quill` (1 event) - `the-dresden-files`, evidence `the Dresden Files` - " \
           "shares its input with another" in text
    assert "- UNSURE: `Robots and Teeth` (1 event) - `pee-wees-playhouse`, evidence `Conky on Pee-wee's Playhouse` - " \
           "after \"known for\"" in text
    assert "- `Specialty Costumes`, the known case: no input is titled so." in text
    # the band marker, and a registry term the build dropped
    assert "- UNSURE: `Eurovision Karaoke` - 2026-09-05T23:30 - Filk Music - the title holds `Eurovision` " \
           "(`eurovision`)" in text
    assert "| `DDAL` | 1 |" in text
    # one title, two inputs, two kinds
    assert "- `Wingspan Demo` - 2 events, 2 inputs, which differ in `description` - `kind` gaming (1), workshop (1); " \
           "`play` demo / beginner (1), none (1)" in text
    # a Kids Track event made mature, and the wrestling list
    assert "Kids Track says `kids`, and the event is `mature`: the parse and the model" in text
    assert "- UNSURE: `Dragon Con Wrestling` - 2026-09-03T19:00 - Main Programming - `performance` - in the title " \
           "and description" in text
    # v1 against v2: Castle the same, Star Trek more specific, Firefly lost, Anime left out
    assert "| same | 2 | 50.0% |" in text and "| more specific | 1 | 25.0% |" in text and "| lost | 1 | 25.0% |" in text
    assert "**Firefly** (1)" in text and "Their assignments: 1." in text
    # a track's one value on an axis it does not decide, and a list with nothing in it
    assert "- UNSURE: Filk Music - `craft`: performance, on 1 of its 1 events (100.0%)" in text
    assert "### Bands (a): works linked from music events: 0\n\nEvery work an event" in text
    assert "and every event that links it `about`, by kind.\n\n- none\n" in text
    # sources of the unreviewed works in the block: the drafter's three and the tagger's one. Eurovision, from
    # neither, is linked by no event and is no ancestor, so it is not in the block, and a count over the registry
    # would not be a fact about the year
    assert "| drafter | 3 | 3 | 2 |" in text and "| tagger | 1 | 1 | 2 |" in text and "| other | 0 | 0 | 0 |" in text
    assert "| all | 4 | 4 | 4 |" in text and "Linked by none: 0," in text
    assert "3. Unreviewed works: 4 of 8 in the block - the drafter's 3, the tagger's 1, other 0. Linked by events: " \
           "4, on 4 events (Appendix A)." in text
    assert "work names 0 of 8 in the block; cached work names" in text
    assert "| work names and aliases in the block | 11 | 0 | 0 |" in text    # 8 names and 3 aliases
    # people: the drafted celebrity, and who is on qa, photo and signing events without an entry
    assert "| `nathan-fillion` | `Nathan Fillion` | celebrity | high | 1 | 1 | 0 | 0 | 0 | `firefly` (reviewed), " \
           "`castle` (unreviewed) |" in text
    assert "| `Primetime Steve` | `primetime-steve` | rejected by model | 1 | 0 | 0 | 1 |" in text
    assert "| `Ada Quill` | `ada-quill` | never drafted | 1 | 0 | 0 | 1 |" in text
    assert "- `Castle Cast` - 2026-09-05T11:30 - Main Programming - `Nathan Fillion`, `Primetime Steve`" in text
    # text: the double-encoded event, the two characters
    assert "- `FaerÃ»n Nights` - 2026-09-06T09:00 - Role-Playing Games (Campaign)" in text
    assert "- U+2018 in the description of `Eurovision Karaoke`" in text
    assert text.endswith("\n") and not text.endswith("\n\n") and "\r" not in text and "\n\n\n" not in text


def test_two_hash_seeds_give_the_same_bytes(tmp_path):
    """Set order follows the process's hash seed; nothing in the report may."""
    args = write_fixture(tmp_path)
    written = []
    for seed in ("0", "1"):
        out = tmp_path / f"census-{seed}.md"
        subprocess.run([sys.executable, "census_v2.py", *args, "--out", str(out)], cwd=ROOT, check=True,
                       capture_output=True, env={**os.environ, "PYTHONHASHSEED": seed})
        written.append(out.read_bytes())
    assert written[0] == written[1]
    sources = dict(zip(["events", "v2", "cache", "registry", "sidecar"], args[1::2]))
    census = cv.load(sources["events"], sources["v2"], sources["cache"], sources["registry"], sources["sidecar"])
    assert written[0] == cv.render(census, sources).encode("utf-8")


def test_a_stale_events_v2_stops_it_and_it_writes_nothing(tmp_path, capsys):
    args = write_fixture(tmp_path)
    with open(tmp_path / "events.v2.json", "ab") as f:
        f.write(b" ")
    out = tmp_path / "census.md"
    assert cv.main(args + ["--out", str(out)]) == 1 and not out.exists()
    assert "run `python events_v2.py` first" in capsys.readouterr().err


def test_check_is_1_for_a_stale_or_absent_report_and_0_for_a_fresh_one_and_writes_nothing(tmp_path):
    args = write_fixture(tmp_path)
    out = tmp_path / "census.md"
    assert cv.main(args + ["--out", str(out), "--check"]) == 1 and not out.exists()
    assert cv.main(args + ["--out", str(out)]) == 0
    fresh = out.read_bytes()
    assert cv.main(args + ["--out", str(out), "--check"]) == 0
    out.write_bytes(fresh + b"\n")
    assert cv.main(args + ["--out", str(out), "--check"]) == 1 and out.read_bytes() == fresh + b"\n"


def test_it_will_not_write_under_data(tmp_path):
    target = os.path.join(ROOT, "data", "census-v2-test.md")
    assert cv.main(write_fixture(tmp_path) + ["--out", target]) == 1 and not os.path.exists(target)


# --- the real data -------------------------------------------------------------------

def real_args():
    return ["--events", os.path.join(ROOT, cv.EVENTS), "--v2", os.path.join(ROOT, cv.EVENTS_V2),
            "--cache", os.path.join(ROOT, cv.CACHE), "--registry", os.path.join(ROOT, registry.DIR),
            "--sidecar", os.path.join(ROOT, cv.SIDECAR)]


def test_a_full_run_reaches_no_model_no_process_and_no_network(tmp_path, monkeypatch):
    """Every model transport is refused wherever a module holds it, and so are subprocess and a socket's connect."""
    def refuse(*args, **kwargs):
        raise AssertionError("census_v2 reached for a model, a process or the network")

    transports = (tag_events.call_api, tag_events.call_claude_code, ts.api_transport, ts.code_transport)
    patched = set()
    for name, module in sorted(sys.modules.items()):
        for attr, value in list((getattr(module, "__dict__", None) or {}).items()):
            if any(value is t for t in transports):
                monkeypatch.setattr(module, attr, refuse)
                patched.add(f"{name}.{attr}")
    assert {"tag_events.call_api", "tag_events.call_claude_code", "tag_stage.call_api", "tag_stage.call_claude_code",
            "tag_stage.api_transport", "tag_stage.code_transport", "draft_people.call_api",
            "draft_people.call_claude_code"} <= patched
    monkeypatch.setattr(subprocess, "run", refuse)
    monkeypatch.setattr(subprocess, "Popen", refuse)
    monkeypatch.setattr(socket.socket, "connect", refuse)
    out = tmp_path / "census.md"
    assert cv.main(real_args() + ["--out", str(out)]) == 0
    assert out.read_text(encoding="utf-8").startswith("# Tag census v2 - the 2026 schedule\n")


def digests():
    out = {}
    for folder, _, files in os.walk(os.path.join(ROOT, "data")):
        for name in files:
            path = os.path.join(folder, name)
            with open(path, "rb") as f:
                out[os.path.relpath(path, ROOT)] = hashlib.sha256(f.read()).hexdigest()
    return out


def test_a_real_run_leaves_every_file_under_data_as_it_was(tmp_path):
    before = digests()
    subprocess.run([sys.executable, "census_v2.py", "--out", str(tmp_path / "census.md")], cwd=ROOT, check=True,
                   capture_output=True)
    assert digests() == before and (tmp_path / "census.md").stat().st_size > 0


def test_the_committed_census_is_a_fresh_render():
    """docs/discover/census-v2-2026.md is exactly what the committed data renders today: an edit to a registry or the
    cache with no re-render after it fails here, in CI's pipeline job, beside the events.v2.json check."""
    census = cv.load(*(os.path.join(ROOT, p) for p in (cv.EVENTS, cv.EVENTS_V2, cv.CACHE, registry.DIR, cv.SIDECAR)))
    with open(os.path.join(ROOT, cv.OUT), "rb") as f:
        committed = f.read()
    assert cv.render(census).encode("utf-8") == committed, "stale: run `python census_v2.py` and commit the result"
