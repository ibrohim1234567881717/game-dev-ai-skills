#!/usr/bin/env python3
"""Generate the repository's social preview image.

GitHub shows this card whenever the repository link is shared — Discord, Reddit,
X, Slack. Without one the preview is an empty grey box, which measurably costs
clicks. Recommended size is 1280x640.

    python tools/make_social_preview.py            writes assets/social-preview.png
    python tools/make_social_preview.py --out X    writes elsewhere

Requires Pillow. It is a development-time tool, not part of the toolkit itself,
so it is not a runtime dependency: the repository still installs and runs with
no dependencies at all.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover
    print("This tool needs Pillow:  python -m pip install pillow", file=sys.stderr)
    raise SystemExit(2)

WIDTH, HEIGHT = 1280, 640

# GitHub dark-theme-adjacent palette, so the card sits naturally next to the repo.
BG = (13, 17, 23)
PANEL = (22, 27, 34)
BORDER = (48, 54, 61)
TEXT = (230, 237, 243)
MUTED = (139, 148, 158)
ACCENT = (88, 166, 255)
GREEN = (63, 185, 80)
AMBER = (210, 153, 34)

ENGINES = [
    ("Unreal Engine", (12, 122, 209)),
    ("Unity", (200, 200, 210)),
    ("Godot", (71, 138, 190)),
    ("Roblox", (226, 35, 26)),
    ("Minecraft", (95, 160, 70)),
    ("Web", (240, 173, 78)),
]

FONT_DIR = Path("C:/Windows/Fonts")
FONT_CANDIDATES = {
    "bold": ["segoeuib.ttf", "arialbd.ttf", "calibrib.ttf"],
    "semibold": ["seguisb.ttf", "segoeuib.ttf", "arialbd.ttf"],
    "regular": ["segoeui.ttf", "arial.ttf", "calibri.ttf"],
    "mono": ["consola.ttf", "cour.ttf"],
    "mono_bold": ["consolab.ttf", "consola.ttf"],
}


def load_font(kind: str, size: int):
    for name in FONT_CANDIDATES[kind]:
        path = FONT_DIR / name
        if path.is_file():
            try:
                return ImageFont.truetype(str(path), size)
            except OSError:
                continue
    # Last resort: readable but unstyled, rather than failing to produce a card.
    return ImageFont.load_default()


def rounded(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text_width(draw, text, font):
    return draw.textbbox((0, 0), text, font=font)[2]


def build() -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)

    f_title = load_font("bold", 78)
    f_hook = load_font("semibold", 31)
    f_body = load_font("regular", 23)
    f_chip = load_font("semibold", 21)
    f_mono = load_font("mono", 20)
    f_mono_b = load_font("mono_bold", 20)
    f_stat = load_font("bold", 34)
    f_stat_label = load_font("regular", 17)

    # A subtle accent bar down the left edge, so the card is recognisable at
    # thumbnail size where the text is unreadable.
    draw.rectangle([0, 0, 8, HEIGHT], fill=ACCENT)

    left = 64
    y = 62

    # --- title ------------------------------------------------------------- #
    draw.text((left, y), "Universal AI Dev", font=f_title, fill=TEXT)
    y += 96

    # --- the hook ---------------------------------------------------------- #
    draw.text((left, y), "Stop your AI assistant writing", font=f_hook, fill=MUTED)
    y += 42
    draw.text((left, y), "Godot 3 code into your Godot 4 project.", font=f_hook, fill=TEXT)
    y += 60

    draw.text(
        (left, y),
        "Skills, agents and workflows that make AI coding",
        font=f_body, fill=MUTED,
    )
    y += 32
    draw.text((left, y), "assistants competent at game development.", font=f_body, fill=MUTED)
    y += 58

    # --- engine chips ------------------------------------------------------ #
    x = left
    for name, colour in ENGINES:
        w = text_width(draw, name, f_chip) + 34
        if x + w > WIDTH - 400:          # keep clear of the stats panel
            x = left
            y += 46
        rounded(draw, [x, y, x + w, y + 38], 19, fill=PANEL, outline=BORDER)
        draw.ellipse([x + 13, y + 15, x + 21, y + 23], fill=colour)
        draw.text((x + 28, y + 9), name, font=f_chip, fill=TEXT)
        x += w + 10
    y += 68

    # --- terminal snippet -------------------------------------------------- #
    panel_x = WIDTH - 348               # reserved for the stats panel
    box_top = y
    box_bottom = y + 92
    rounded(draw, [left, box_top, panel_x - 24, box_bottom], 10,
            fill=PANEL, outline=BORDER)

    draw.text((left + 20, box_top + 18), "$", font=f_mono_b, fill=GREEN)
    draw.text(
        (left + 42, box_top + 18),
        "uad detect .",
        font=f_mono_b, fill=TEXT,
    )
    draw.text(
        (left + 20, box_top + 50),
        "loader neoforge",
        font=f_mono, fill=AMBER,
    )
    draw.text(
        (left + 20 + text_width(draw, "loader neoforge ", f_mono), box_top + 50),
        "<- gradle.properties",
        font=f_mono, fill=MUTED,
    )

    # --- stats panel on the right (positioned after the snippet is sized) -- #
    panel_y = 150
    panel_bottom = box_bottom          # line up with the terminal snippet
    rounded(draw, [panel_x, panel_y, WIDTH - 64, panel_bottom], 14,
            fill=PANEL, outline=BORDER)

    stats = [
        ("71", "skills"),
        ("15", "agents"),
        ("118", "tests passing"),
        ("0", "dependencies"),
    ]
    spacing = (panel_bottom - panel_y - 40) / len(stats)
    sy = panel_y + 22
    for value, label in stats:
        draw.text((panel_x + 30, sy), value, font=f_stat, fill=ACCENT)
        draw.text(
            (panel_x + 30 + text_width(draw, value, f_stat) + 12, sy + 14),
            label, font=f_stat_label, fill=MUTED,
        )
        sy += spacing

    # --- footer ------------------------------------------------------------ #
    footer = "Agent Skills standard  ·  Claude Code · Codex · Cursor · Copilot"
    draw.text((left, HEIGHT - 52), footer, font=f_body, fill=MUTED)

    handle = "github.com/ibrohim1234567881717/game-dev-ai-skills"
    draw.text(
        (WIDTH - 64 - text_width(draw, handle, f_stat_label), HEIGHT - 46),
        handle, font=f_stat_label, fill=(90, 99, 108),
    )

    return image


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Generate the social preview card.")
    parser.add_argument("--out", default="assets/social-preview.png")
    args = parser.parse_args(argv)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    build().save(out, "PNG", optimize=True)

    size_kb = out.stat().st_size / 1024
    print("wrote %s  (%dx%d, %.0f KB)" % (out, WIDTH, HEIGHT, size_kb))
    print("Upload it at: Settings -> General -> Social preview")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
