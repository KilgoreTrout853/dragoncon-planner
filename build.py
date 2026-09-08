#!/usr/bin/env python3
"""Build a deployable copy of the site, stamped for a channel.

main publishes straight from the branch and never runs this: the source
carries empty stamps, so the live site wears no mark. The next site's deploy
runs it with DC_CHANNEL=next, which stamps index.html (the dev-build mark,
and the build id in the device readout) and sw.js (a cache name of its own,
so two sites on one origin never delete each other's cache).

    DC_CHANNEL=next python build.py --out site
    python build.py --out site            # unstamped: identical to the source
"""
import argparse
import os
import re
import shutil
import subprocess
import sys

SITE_FILES = ["index.html", "sw.js", "manifest.json", "icon.svg",
              "icon-180.png", "icon-192.png", "icon-512.png", "og-image.png"]
SITE_DIRS = ["data"]


def git_short_sha(cwd):
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=cwd,
                              capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        return ""


def stamp(text, needle, replacement, what):
    if text.count(needle) != 1:
        sys.exit(f"build: could not stamp {what}: expected exactly one {needle!r}")
    return text.replace(needle, replacement)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--channel", default=os.environ.get("DC_CHANNEL", ""),
                    help="the channel to stamp; default $DC_CHANNEL, empty for an unstamped copy")
    ap.add_argument("--build", default=os.environ.get("DC_BUILD", ""),
                    help="the build id to stamp; default $DC_BUILD, else the git short sha")
    ap.add_argument("--out", default="site", help="the directory to build into (replaced)")
    args = ap.parse_args()

    src = os.path.dirname(os.path.abspath(__file__))
    out = os.path.abspath(args.out)
    channel = args.channel.strip()
    if channel and not re.fullmatch(r"[a-z0-9-]+", channel):
        sys.exit(f"build: a channel is lowercase letters, digits and dashes, not {channel!r}")
    build = args.build.strip() or git_short_sha(src)
    if build and not re.fullmatch(r"[A-Za-z0-9._-]+", build):
        sys.exit(f"build: a build id is letters, digits, dots and dashes, not {build!r}")

    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(out)
    for f in SITE_FILES:
        shutil.copy2(os.path.join(src, f), os.path.join(out, f))
    for d in SITE_DIRS:
        shutil.copytree(os.path.join(src, d), os.path.join(out, d))
    open(os.path.join(out, ".nojekyll"), "w").close()

    if channel:
        p = os.path.join(out, "index.html")
        html = open(p, encoding="utf-8", newline="").read()
        html = stamp(html, '<meta name="dc-channel" content="">',
                     f'<meta name="dc-channel" content="{channel}">', "the channel in index.html")
        html = stamp(html, '<meta name="dc-build" content="">',
                     f'<meta name="dc-build" content="{build}">', "the build id in index.html")
        open(p, "w", encoding="utf-8", newline="").write(html)

        p = os.path.join(out, "sw.js")
        sw = open(p, encoding="utf-8", newline="").read()
        sw = stamp(sw, 'const CHANNEL = "";', f'const CHANNEL = "{channel}";', "the channel in sw.js")
        open(p, "w", encoding="utf-8", newline="").write(sw)

    print(f"built {out}: channel={channel or '(none)'} build={build if channel else '(none)'}")


if __name__ == "__main__":
    main()
