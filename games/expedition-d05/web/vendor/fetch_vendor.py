#!/usr/bin/env python3
"""Fetch the third-party files the self-contained builds embed.

    python games/expedition-d05/web/vendor/fetch_vendor.py

The regular build loads three.js from jsDelivr and the fonts from Google
Fonts. Platforms that forbid outside requests (Yandex Games) get a build
with both embedded, from the files this script writes next to itself:

    three.module.min.js   three.js r160 from the npm registry tarball,
                          checked against THREE_SHA256
    three.LICENSE         its MIT licence
    fonts/*.woff2         the Cyrillic and Latin subsets of every face the
                          page uses, from the same Google Fonts css2 URL the
                          page links
    fonts/fonts.css       @font-face rules pointing at those files
    fonts/OFL-*.txt       the fonts' SIL Open Font License texts

The outputs are committed; run this only to refresh them. Stdlib only.
"""

from __future__ import annotations

import hashlib
import io
import re
import sys
import tarfile
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
THREE_TGZ = "https://registry.npmjs.org/three/-/three-0.160.0.tgz"
THREE_SHA256 = "3e690ac7d180b0aadf0891bea39eec643e29e2d3e75c99b18689518665f69ba6"  # build/three.module.min.js of the r160 tarball
FONTS_CSS = (
    "https://fonts.googleapis.com/css2?family=Fira+Sans+Extra+Condensed:wght@500;600;700;800"
    "&family=Fira+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
)
# the page is Russian with English terms; Google's other subsets (Greek, Vietnamese, ...) never render
SUBSETS = ("cyrillic", "latin")
OFL = {
    "firasans": "https://raw.githubusercontent.com/google/fonts/main/ofl/firasans/OFL.txt",
    "firasansextracondensed": "https://raw.githubusercontent.com/google/fonts/main/ofl/firasansextracondensed/OFL.txt",
    "ibmplexmono": "https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/OFL.txt",
}
# a current browser's user agent: without it Google serves TTF instead of WOFF2
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def fetch_three() -> None:
    tgz = tarfile.open(fileobj=io.BytesIO(get(THREE_TGZ)), mode="r:gz")
    js = tgz.extractfile("package/build/three.module.min.js").read()
    digest = hashlib.sha256(js).hexdigest()
    if digest != THREE_SHA256:
        sys.exit(f"three.module.min.js: sha256 {digest} does not match the pinned {THREE_SHA256}")
    (HERE / "three.module.min.js").write_bytes(js)
    (HERE / "three.LICENSE").write_bytes(tgz.extractfile("package/LICENSE").read())
    print(f"three.module.min.js  {len(js) / 1024:.0f} KB  sha256 {digest[:16]}")


def fetch_fonts() -> None:
    out = HERE / "fonts"
    out.mkdir(exist_ok=True)
    for old in out.glob("*.woff2"):
        old.unlink()
    css = get(FONTS_CSS).decode("utf-8")
    rules = []
    total = 0
    for subset, body in re.findall(r"/\* ([a-z-]+) \*/\s*@font-face\s*\{(.*?)\}", css, re.S):
        if subset not in SUBSETS:
            continue
        family = re.search(r"font-family:\s*'([^']+)'", body).group(1)
        weight = re.search(r"font-weight:\s*(\d+)", body).group(1)
        url = re.search(r"url\((https://[^)]+)\)", body).group(1)
        name = f"{family.lower().replace(' ', '-')}-{weight}-{subset}.woff2"
        data = get(url)
        (out / name).write_bytes(data)
        total += len(data)
        rules.append(f"/* {subset} */\n@font-face {{{body.replace(url, name)}}}")
    if not rules:
        sys.exit("no @font-face rules found: Google Fonts changed its CSS format")
    (out / "fonts.css").write_text("\n".join(rules) + "\n", encoding="utf-8")
    print(f"fonts: {len(rules)} faces, {total / 1024:.0f} KB")
    for key, url in OFL.items():
        (out / f"OFL-{key}.txt").write_bytes(get(url))


if __name__ == "__main__":
    fetch_three()
    fetch_fonts()
