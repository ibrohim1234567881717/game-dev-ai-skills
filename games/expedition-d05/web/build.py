#!/usr/bin/env python3
"""Bundle the UMBRA browser game into one HTML file.

    python games/expedition-d05/web/build.py

Reads src/page.html, src/style.css and every src/*.js in name order, and
writes dist/umbra.html. The JS files share one module scope, so each file can
use what earlier files define. three.js is imported from the jsDelivr npm CDN.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT / "dist" / "umbra.html"
THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"


def main() -> None:
    page = (SRC / "page.html").read_text(encoding="utf-8")
    css = (SRC / "style.css").read_text(encoding="utf-8")
    parts = [f"import * as THREE from '{THREE_URL}';"]
    for js in sorted(SRC.glob("*.js")):
        parts.append(f"// ---- {js.name} ----\n" + js.read_text(encoding="utf-8"))
    js = "\n".join(parts)
    if "</script" in js:
        raise SystemExit("a JS source contains '</script' — it would end the inline module early")
    html = page.replace("/*__CSS__*/", css).replace("/*__JS__*/", js)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT.parent)} ({len(html) // 1024} KB)")


if __name__ == "__main__":
    main()
