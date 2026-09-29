#!/usr/bin/env python3
"""A year's level drawings, data/<year>/drawings/, drawn to docs/venues/drawings/<hotel>-<level>.svg.

    python tools/render_drawings.py                                  # 2027's drawings
    python tools/render_drawings.py --season data/2027/season.json   # a year's, named by its season file
    python tools/render_drawings.py --png                            # a PNG beside each SVG, where cairosvg is installed

A documentation renderer, not the app's (DECISIONS #58): it draws what the data says at 2 px per foot, with sizes
printed, so that a drawing can be checked against the hotel's tables by eye. The drawing files carry geometry only;
the hotel's and the level's names come from the year's venues.json, beside its season file. The app's stage builder
is its own code and reads the same files.

cairosvg is optional and not in requirements.txt: without it, --png says so and the SVGs are written alone. The
standard library otherwise, and deterministic - two runs write the same bytes.
"""

import argparse
import glob
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SEASON = os.path.join("data", "2027", "season.json")
OUT = os.path.join("docs", "venues", "drawings")

PX = 2.0
INK, FLOOR, LINE, TEXT, MUTED, DIM, GOLD, HUE = "#171A33", "#22264A", "#3A3F70", "#F3EFE4", "#A5A9C9", "#6F739A", "#F3C64B", "#79D19B"
FONT = "Barlow Semi Condensed, Avenir Next Condensed, Roboto Condensed, system-ui, sans-serif"


def mix(a, pa, b):
    A = tuple(int(a[i:i + 2], 16) for i in (1, 3, 5)); B = tuple(int(b[i:i + 2], 16) for i in (1, 3, 5))
    return "#%02X%02X%02X" % tuple(round(A[i] * pa + B[i] * (1 - pa)) for i in range(3))


ROOM_FILL, ROOM_STROKE, BALL_FILL = mix(HUE, .16, FLOOR), mix(HUE, .7, FLOOR), mix(HUE, .10, FLOOR)
GLYPH = {   # the landmark kinds a drawing may use, each drawn as its glyph
    "escalator": '<path d="M-14 9 L0 -5 M-6 9 L8 -5 M2 9 L16 -5" fill="none" stroke="{c}" stroke-width="2.2" stroke-linecap="round"/>',
    "elevator": '<rect x="-10" y="-7" width="20" height="14" rx="2" fill="none" stroke="{c}" stroke-width="2"/><path d="M-3 -3 L-3 3 M3 -3 L3 3" stroke="{c}" stroke-width="2" stroke-linecap="round"/>',
    "entrance": '<path d="M-12 -8 V8 H12 V-8 M0 -8 V8 M-12 8 H12" fill="none" stroke="{c}" stroke-width="2" stroke-linejoin="round"/>',
    "bridge": '<path d="M-16 5 Q0 -9 16 5 M-16 5 V-1 M16 5 V-1" fill="none" stroke="{c}" stroke-width="2" stroke-linecap="round"/>',
    "info": '<circle r="9" fill="none" stroke="{c}" stroke-width="2"/><path d="M0 -1 V5 M0 -5 V-4" stroke="{c}" stroke-width="2.2" stroke-linecap="round"/>',
}
X = lambda v: v * PX
esc = lambda s: s.replace("&", "&amp;").replace("<", "&lt;")


def stem(hotel, level):
    """A drawing's name, as its file and its render are named: the venues file's hotel key folded to lower case,
    spaces as hyphens, then the level id - "hilton-l2"."""
    return f"{hotel.lower().replace(' ', '-')}-{level}"


def text(x, y, s, size, fill, weight=600, anchor="middle", extra=""):
    return f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" {extra}>{esc(s)}</text>'


def fontfor(w, h, s): return max(7, min(15, h * .6, w * 1.7 / max(1, len(s))))
def rot_attr(rot, cx, cy): return f' transform="rotate({rot:.1f} {cx:.1f} {cy:.1f})"' if rot else ""
def box(o): return X(o["cx"]), X(o["cy"]), X(o["w"]), X(o["h"])


def draw_rect(o, fill, stroke, width, dash=None, rx=3, opacity=None):
    cx, cy, w, h = box(o)
    d = f' stroke-dasharray="{dash}"' if dash else ""; op = f' opacity="{opacity}"' if opacity else ""
    return f'<g{rot_attr(o.get("rot", 0), cx, cy)}><rect x="{cx - w / 2:.1f}" y="{cy - h / 2:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"{d}{op}/></g>'


def draw_label(o, label, big=False, dims=True):
    cx, cy, w, h = box(o); rot = o.get("rot", 0)
    up = rot - 180 if rot > 90 else (rot + 180 if rot < -90 else rot)   # keep text readable
    s = [f'<g{rot_attr(up, cx, cy)}>']
    if big:
        s.append(text(cx, cy + 10, label, 30 if len(label) <= 2 else 18, HUE, 700))
        if dims: s.append(text(cx, cy + 28, f'{o["w"]:g} × {o["h"]:g} ft', 10, MUTED, 500))
    else:
        fs = fontfor(w, h, label); tall = dims and h > 44
        s.append(text(cx, cy + fs * .35 - (5 if tall else 0), label, fs, TEXT, 700))
        if tall: s.append(text(cx, cy + 14, f'{o["w"]:g} × {o["h"]:g}', 8.5, MUTED, 500))
    s.append("</g>"); return "".join(s)


def render(d, level_name, hotel_name):
    """One drawing as an SVG document, a single line with no newline at its end."""
    ew, eh = d["extent"]["w"], d["extent"]["h"]
    W, H = max(X(ew) + 80, 980), X(eh) + 190; ox, oy = 40, 120
    in_group = {rid: g for g in d["groups"] for rid in g["rooms"]}
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}" width="{W:.0f}" height="{H:.0f}">',
         f'<rect width="{W:.0f}" height="{H:.0f}" fill="{INK}"/>', f'<g transform="translate({ox} {oy})">',
         f'<rect x="0" y="0" width="{X(ew):.1f}" height="{X(eh):.1f}" rx="10" fill="{FLOOR}"/>', '<g opacity=".07">']
    for i in range(0, ew + 1, 25): o.append(f'<line x1="{X(i):.1f}" y1="0" x2="{X(i):.1f}" y2="{X(eh):.1f}" stroke="{TEXT}" stroke-width="1"/>')
    for i in range(0, eh + 1, 25): o.append(f'<line x1="0" y1="{X(i):.1f}" x2="{X(ew):.1f}" y2="{X(i):.1f}" stroke="{TEXT}" stroke-width="1"/>')
    o.append("</g>")
    for g in d["groups"]:                                 # group blocks, then open areas (a corridor can sit inside a block), then rooms
        ball = g["kind"] == "ballroom"
        o.append(draw_rect(g["outline"], BALL_FILL if ball else ROOM_FILL, ROOM_STROKE, 2 if ball else 1.5, rx=4))
        if ball:
            cx, cy, w, h = box(g["outline"])
            o.append(text(cx - w / 2 + 10, cy - h / 2 - 8, g["name"].upper(), 13, HUE, 700, "start", 'letter-spacing=".12em"'))
    for a in d["open"]:                                   # open areas: dashed outlines, quiet labels
        o.append(draw_rect(a, "none", LINE, 1.5, "6 6", rx=6))
        cx, cy, w, h = box(a); fs = min(15, w / max(6, len(a["name"])) * 1.8, h * .5); big = w > 300 and h > 100
        vert = h > w * 1.8
        o.append(text(cx - w / 2 + 8 if big else cx, cy - h / 2 + 16 if big else cy + fs * .35, a["name"], 13 if big else (12 if vert else fs), DIM, 500,
                      "start" if big else "middle", extra=f'transform="rotate(-90 {cx:.1f} {cy:.1f})"' if vert else ""))
    rooms = {r["id"]: r for r in d["rooms"]}
    for r in d["rooms"]:
        g = in_group.get(r["id"])
        if g:
            o.append(draw_rect(r, "none", ROOM_STROKE, 1.3, "6 4", rx=0, opacity=".85"))
            o.append(draw_label(r, r["id"].split()[-1] if g["kind"] == "ballroom" else r["id"], big=g["kind"] == "ballroom", dims=True))
        else:
            o.append(draw_rect(r, ROOM_FILL, ROOM_STROKE, 1.5)); o.append(draw_label(r, r["id"]))
    for g in d["groups"]: o.append(draw_rect(g["outline"], "none", ROOM_STROKE, 2 if g["kind"] == "ballroom" else 1.5, rx=4))
    for c in d["composites"]:                             # composite rooms: a caps label over the union of their parts
        xs = [rooms[i]["cx"] - rooms[i]["w"] / 2 for i in c["of"]] + [rooms[i]["cx"] + rooms[i]["w"] / 2 for i in c["of"]]
        ys = [rooms[i]["cy"] - rooms[i]["h"] / 2 for i in c["of"]]
        o.append(text(X((min(xs) + max(xs)) / 2), X(min(ys)) + 16, c["id"].upper(), 11, MUTED, 600, extra='letter-spacing=".1em"'))
    for l in d["landmarks"]:
        o.append(f'<g transform="translate({X(l["x"]):.1f} {X(l["y"]):.1f})">{GLYPH[l["kind"]].format(c=GOLD)}{text(0, 24, l["name"], 11, GOLD, 600)}</g>')
    for st in d["streets"]:
        if st["side"] == "N": o.append(text(X(ew) / 2, -8, st["name"], 11, DIM, 600, extra='letter-spacing=".08em"'))
        if st["side"] == "S": o.append(text(X(ew) / 2, X(eh) + 18, st["name"], 11, DIM, 600, extra='letter-spacing=".08em"'))
        if st["side"] == "W": o.append(text(-10, X(eh) / 2, st["name"], 11, DIM, 600, extra=f'letter-spacing=".08em" transform="rotate(-90 -10 {X(eh) / 2:.1f})"'))
        if st["side"] == "E": o.append(text(X(ew) + 14, X(eh) / 2, st["name"], 11, DIM, 600, extra=f'letter-spacing=".08em" transform="rotate(90 {X(ew) + 14:.1f} {X(eh) / 2:.1f})"'))
    o.append("</g>")
    o.append(text(ox, 42, f"{hotel_name} · {level_name}", 28, TEXT, 700, "start"))
    o.append(text(ox, 64, "Sizes from the hotel's tables at 2 px per foot; placement and orientation from Dragon Con's own map. North is up.", 13, MUTED, 500, "start"))
    o.append(text(ox, 82, "  ·  ".join(d.get("notes", [])), 13, MUTED, 500, "start"))
    sy = oy + X(eh) + 40
    o.append(f'<g transform="translate({ox} {sy:.0f})"><rect x="0" y="0" width="{X(50):.0f}" height="6" fill="{TEXT}"/><rect x="{X(50):.0f}" y="0" width="{X(50):.0f}" height="6" fill="{MUTED}"/>')
    for ft in (0, 50, 100): o.append(text(X(ft), 20, f"{ft} ft", 11, MUTED, 600))
    o.append("</g></svg>")
    return "".join(o)


def shown(path):
    """A path as the repo spells it - relative to the root, forward slashes - where it is inside the root."""
    root, p = os.path.abspath(ROOT), os.path.abspath(path)
    return os.path.relpath(p, root).replace(os.sep, "/") if p.startswith(root + os.sep) else p


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--season", default=os.path.join(ROOT, SEASON),
                    help="the year's season.json, beside its venues.json and drawings/ (default: 2027's)")
    ap.add_argument("--out", default=os.path.join(ROOT, OUT), help=f"where the drawings are written (default: {OUT})")
    ap.add_argument("--png", action="store_true", help="a PNG beside each SVG, at twice its size (needs cairosvg)")
    args = ap.parse_args(argv)
    folder = os.path.dirname(os.path.abspath(args.season))
    with open(os.path.join(folder, "venues.json"), encoding="utf-8") as f:
        hotels = {h["hotel"]: h for h in json.load(f)["hotels"]}
    os.makedirs(args.out, exist_ok=True)
    png = None
    if args.png:
        try:
            import cairosvg
            png = cairosvg
        except ImportError:
            print("cairosvg is not installed: SVG only", file=sys.stderr)
    paths = sorted(glob.glob(os.path.join(folder, "drawings", "*.json")))
    for path in paths:
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        h = hotels[d["hotel"]]
        level = next(lv for lv in h["levels"] if lv["id"] == d["level"])
        svg = render(d, level["name"], h["name"])
        out = os.path.join(args.out, stem(d["hotel"], d["level"]))
        with open(out + ".svg", "w", encoding="utf-8", newline="\n") as f:
            f.write(svg)
        if png:
            png.svg2png(bytestring=svg.encode("utf-8"), write_to=out + ".png",
                        output_width=int(max(X(d["extent"]["w"]) + 80, 980) * 2))
        print(f"{shown(out + '.svg')}{' and .png' if png else ''}: {h['name']}, {level['name']}", file=sys.stderr)
    print(f"{len(paths)} drawings from {shown(os.path.join(folder, 'drawings'))}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
