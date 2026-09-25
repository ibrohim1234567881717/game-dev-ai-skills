#!/usr/bin/env python3
"""Store images for Yandex Games: the icon and the cover, from the Blender key art.

    python games/expedition-d05/web/store/make_store_art.py

Reads the renders assets/blender/keyart.py writes (assets/previews/keyart/cover.png and
icon.png) and writes into store/yandex/:

    icon-512.png           512 x 512, no lettering: at icon size a title only turns to mush
    cover-800x470.png      the title in the open sky left of the Queen
    cover-1600x940.png     the same at twice the size, for screens that ask for more

Check the sizes against the draft form in the Yandex Games console: its current requirements
are shown there, and they change. The lettering uses the menu's own face, Fira Sans Extra
Condensed, fetched once from the google/fonts repository into a cache next to this script.

Development-time only, like tools/make_social_preview.py: it needs Pillow, nothing at
runtime imports it.
"""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
GAME = HERE.parent.parent
KEYART = GAME / "assets" / "previews" / "keyart"
OUT = HERE / "yandex"
FONT_CACHE = HERE / ".fonts"
FONTS = {
    "black": "https://raw.githubusercontent.com/google/fonts/main/ofl/firasansextracondensed/FiraSansExtraCondensed-ExtraBold.ttf",
    "semi": "https://raw.githubusercontent.com/google/fonts/main/ofl/firasansextracondensed/FiraSansExtraCondensed-SemiBold.ttf",
}
INK = (232, 238, 228)
AMBER = (227, 163, 59)


def font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    path = FONT_CACHE / Path(FONTS[kind]).name
    if not path.is_file():
        FONT_CACHE.mkdir(exist_ok=True)
        with urllib.request.urlopen(FONTS[kind], timeout=60) as r:
            path.write_bytes(r.read())
    return ImageFont.truetype(str(path), size)


def spaced(draw: ImageDraw.ImageDraw, xy, text: str, f, fill, tracking: float) -> int:
    """Draw text letter by letter with extra spacing (em fraction); returns the end x."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill)
        x += draw.textlength(ch, font=f) + tracking * f.size
    return int(x)


def spaced_width(draw, text, f, tracking) -> float:
    return sum(draw.textlength(ch, font=f) for ch in text) + tracking * f.size * (len(text) - 1)


def cover(src: Image.Image, w: int, h: int) -> Image.Image:
    img = src.convert("RGB").resize((w, h), Image.LANCZOS)
    s = w / 800
    title = font("black", round(104 * s))
    sub = font("semi", round(17 * s))
    x, y = round(46 * s), round(44 * s)
    # a soft shadow keeps the letters off the bright sky without a visible box
    shadow = Image.new("L", img.size, 0)
    sd = ImageDraw.Draw(shadow)
    spaced(sd, (x, y + round(4 * s)), "UMBRA", title, 150, 0.16)
    shadow = shadow.filter(ImageFilter.GaussianBlur(round(14 * s)))
    img.paste((4, 8, 10), mask=shadow)
    d = ImageDraw.Draw(img)
    spaced(d, (x, y), "UMBRA", title, INK, 0.16)
    tw = spaced_width(d, "UMBRA", title, 0.16)
    sw = spaced_width(d, "EXPEDITION D-05", sub, 0.62)
    # the subtitle is centred under the title, as on the title screen
    spaced(d, (x + (tw - sw) / 2, y + round(116 * s)), "EXPEDITION D-05", sub, AMBER, 0.62)
    return img


def icon(src: Image.Image, size: int) -> Image.Image:
    img = src.convert("RGB").resize((size, size), Image.LANCZOS)
    # a light vignette pulls the eye to the head in the middle
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((-size * 0.25, -size * 0.2, size * 1.25, size * 1.3), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(size * 0.12))
    dark = Image.new("RGB", img.size, (6, 10, 12))
    return Image.composite(img, Image.blend(img, dark, 0.45), mask)


def main() -> None:
    cover_src, icon_src = KEYART / "cover.png", KEYART / "icon.png"
    for f in (cover_src, icon_src):
        if not f.is_file():
            sys.exit(f"{f} is missing: render it with assets/blender/keyart.py")
    OUT.mkdir(parents=True, exist_ok=True)
    c = Image.open(cover_src)
    for w, h in ((800, 470), (1600, 940)):
        cover(c, w, h).save(OUT / f"cover-{w}x{h}.png", optimize=True)
    icon(Image.open(icon_src), 512).save(OUT / "icon-512.png", optimize=True)
    for f in sorted(OUT.glob("*.png")):
        with Image.open(f) as im:
            print(f"{f.relative_to(GAME)}  {im.size[0]}x{im.size[1]}  {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
