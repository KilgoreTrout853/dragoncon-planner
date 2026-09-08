"""build.py stamps a copy for a channel, and an unstamped copy is the source.
Run: python tests/test_build.py"""
import filecmp
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build.py")


def build(env, out):
    e = dict(os.environ)
    e.update(env)
    return subprocess.run([sys.executable, BUILD, "--out", out], env=e, cwd=ROOT,
                          capture_output=True, text=True)


def read(*parts):
    return open(os.path.join(*parts), encoding="utf-8", newline="").read()


def test_a_channel_stamps_the_page_and_the_worker():
    with tempfile.TemporaryDirectory() as d:
        out = os.path.join(d, "site")
        r = build({"DC_CHANNEL": "next", "DC_BUILD": "abc1234"}, out)
        assert r.returncode == 0, r.stderr
        html, sw = read(out, "index.html"), read(out, "sw.js")
        assert '<meta name="dc-channel" content="next">' in html
        assert '<meta name="dc-build" content="abc1234">' in html
        assert 'const CHANNEL = "next";' in sw
        assert "dc26-v4" not in sw.replace("dc26${", "")      # the name is built from the prefix
        assert os.path.exists(os.path.join(out, "data", "2026", "events.json"))
        assert os.path.exists(os.path.join(out, ".nojekyll"))
        for absent in ("tests", "scraper.py", "tag_events.py", "README.md", "build.py", "node_modules"):
            assert not os.path.exists(os.path.join(out, absent)), absent


def test_no_channel_is_the_source():
    with tempfile.TemporaryDirectory() as d:
        out = os.path.join(d, "site")
        r = build({"DC_CHANNEL": "", "DC_BUILD": ""}, out)
        assert r.returncode == 0, r.stderr
        for f in ("index.html", "sw.js", "manifest.json", "icon.svg"):
            assert filecmp.cmp(os.path.join(ROOT, f), os.path.join(out, f), shallow=False), f
        assert 'const CHANNEL = "";' in read(out, "sw.js")


def test_the_build_id_defaults_to_the_commit():
    with tempfile.TemporaryDirectory() as d:
        out = os.path.join(d, "site")
        r = build({"DC_CHANNEL": "next", "DC_BUILD": ""}, out)
        assert r.returncode == 0, r.stderr
        sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT,
                             capture_output=True, text=True).stdout.strip()
        assert sha and f'<meta name="dc-build" content="{sha}">' in read(out, "index.html")


def test_a_bad_channel_is_refused():
    with tempfile.TemporaryDirectory() as d:
        r = build({"DC_CHANNEL": "Next Site"}, os.path.join(d, "site"))
        assert r.returncode != 0 and "channel" in r.stderr


if __name__ == "__main__":
    failed = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print("ok", name)
            except AssertionError as e:
                failed += 1
                print("FAIL", name, e)
    print("ALL PASSED" if not failed else f"{failed} FAILED")
    sys.exit(1 if failed else 0)
