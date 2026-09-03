#!/usr/bin/env python3
"""Render the app icons and the link-preview image from the design in icon.svg.

Outputs, next to this script:
    icon-180.png    apple-touch-icon (iOS does not accept SVG there)
    icon-192.png    manifest, purpose any and maskable
    icon-512.png    manifest, purpose any and maskable
    og-image.png    1200x630 link preview: the mark and the app's name

The design is the one in icon.svg - navy ground, an inset gold ring, and
DC / 26 in Barlow Semi Condensed 700 - drawn here with Pillow because
nothing on the build machine rasterises SVG. Everything is drawn at 2x and
downsampled. The font is fetched from Google Fonts into a cache directory
the first time.

Run:  python make_icons.py
"""

import os
import sys
import urllib.request

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
NAVY = (0x17, 0x1A, 0x33)
GOLD = (0xF3, 0xC6, 0x4B)
CREAM = (0xF5, 0xF1, 0xE8)
FONT_700 = ("BarlowSemiCondensed-Bold.ttf",
            "https://fonts.gstatic.com/s/barlowsemicondensed/v16/wlpigxjLBV1hqnzfr-F8sEYMB0Yybp0mudRfw6-PAA.ttf")
FONT_500 = ("BarlowSemiCondensed-Medium.ttf",
            "https://fonts.gstatic.com/s/barlowsemicondensed/v16/wlpigxjLBV1hqnzfr-F8sEYMB0Yybp0mudRfi6mPAA.ttf")


def font_path(name, url):
    cache = os.path.join(os.path.expanduser("~"), ".cache", "dragoncon-fonts")
    os.makedirs(cache, exist_ok=True)
    path = os.path.join(cache, name)
    if not os.path.exists(path):
        print(f"fetching {name}", file=sys.stderr)
        urllib.request.urlretrieve(url, path)
    return path


def spaced_text(draw, cx, baseline, text, font, fill, spacing):
    """Centred text with letter spacing, like the SVG's letter-spacing=4."""
    widths = [font.getlength(ch) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, baseline), ch, font=font, fill=fill, anchor="ls")
        x += w + spacing


def draw_mark(img, cx, cy, size, bold_path):
    """The icon design scaled to `size` (the SVG's 512 box), centred at cx, cy."""
    s = size / 512
    ring = Image.new("RGBA", img.size, (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    r = 196 * s
    rd.ellipse((cx - r, cy - r, cx + r, cy + r), outline=GOLD + (int(255 * .45),), width=max(1, round(10 * s)))
    img.alpha_composite(ring)
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(bold_path, round(150 * s))
    top = cy - 256 * s
    spaced_text(d, cx, top + 238 * s, "DC", f, GOLD, 4 * s)
    spaced_text(d, cx, top + 360 * s, "26", f, GOLD, 4 * s)


def icon(px, bold_path):
    big = px * 2
    img = Image.new("RGBA", (big, big), NAVY + (255,))
    draw_mark(img, big / 2, big / 2, big, bold_path)
    return img.resize((px, px), Image.LANCZOS).convert("RGB")


def og_image(bold_path, medium_path):
    W, H = 1200, 630
    img = Image.new("RGBA", (W * 2, H * 2), NAVY + (255,))
    draw_mark(img, 300 * 2, H, 400 * 2, bold_path)
    d = ImageDraw.Draw(img)
    # the name, in two lines, sized to fit the right-hand column
    col_left, col_right = 560 * 2, 1130 * 2
    size = 110 * 2
    while size > 40:
        f1 = ImageFont.truetype(bold_path, size)
        if f1.getlength("Dragon Con 2026") <= col_right - col_left:
            break
        size -= 4
    f2 = ImageFont.truetype(medium_path, round(size * .78))
    y = H - size * .15
    d.text((col_left, y), "Dragon Con 2026", font=f1, fill=CREAM, anchor="ls")
    d.text((col_left, y + size * .95), "planner", font=f2, fill=GOLD, anchor="ls")
    return img.resize((W, H), Image.LANCZOS).convert("RGB")


def main():
    bold = font_path(*FONT_700)
    medium = font_path(*FONT_500)
    for px in (180, 192, 512):
        out = os.path.join(HERE, f"icon-{px}.png")
        icon(px, bold).save(out, optimize=True)
        print(f"wrote icon-{px}.png ({os.path.getsize(out) // 1024} KB)", file=sys.stderr)
    out = os.path.join(HERE, "og-image.png")
    og_image(bold, medium).save(out, optimize=True)
    print(f"wrote og-image.png ({os.path.getsize(out) // 1024} KB)", file=sys.stderr)


if __name__ == "__main__":
    main()
