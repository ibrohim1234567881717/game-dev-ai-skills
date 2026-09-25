"""The UMBRA Yandex Games target: nothing may load from outside the archive.

These call the build's helpers directly and write nothing, so the committed dist/ stays as it is.
"""

import importlib.util
import re
import sys
from pathlib import Path

import pytest

WEB = Path(__file__).resolve().parent.parent / "games" / "expedition-d05" / "web"
pytestmark = pytest.mark.skipif(not (WEB / "build.py").is_file(), reason="UMBRA web build not present")


@pytest.fixture(scope="module")
def build():
    spec = importlib.util.spec_from_file_location("umbra_build", WEB / "build.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["umbra_build"] = mod
    spec.loader.exec_module(mod)
    return mod


def test_document_has_no_outside_hosts(build, tmp_path):
    page = (WEB / "src" / "page.html").read_text(encoding="utf-8")
    html = build.yandex_document(page.replace("/*__CSS__*/", "").replace("/*__JS__*/", "window.x=1;"))
    assert html.startswith("<!doctype html>")
    assert '<script src="/sdk.js"></script>' in html
    assert build.check_self_contained(html, tmp_path) == []


@pytest.mark.parametrize("snippet", [
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">',
    '<script src="https://cdn.example.com/lib.js"></script>',
    '<img src="//example.com/a.png">',
    "<style>@font-face{src:url(https://example.com/f.woff2)}</style>",
    "<script type=module>import * as T from 'https://cdn.jsdelivr.net/npm/three/build/three.module.js';</script>",
])
def test_outside_resource_is_rejected(build, tmp_path, snippet):
    html = "<!doctype html><html><head></head><body>" + snippet + "</body></html>"
    assert build.check_self_contained(html, tmp_path), f"not caught: {snippet}"


def test_file_names_with_spaces_are_rejected(build, tmp_path):
    (tmp_path / "music").mkdir()
    (tmp_path / "music" / "menu (2).mp3").write_bytes(b"")
    problems = build.check_self_contained("<!doctype html>", tmp_path)
    assert any("menu (2).mp3" in p for p in problems)


def test_three_is_inlined_as_a_namespace(build):
    js = build.inline_three()
    assert js.startswith("const THREE = (() => {")
    assert not re.search(r"\bexport\s*\{", js), "the module's export clause must be gone"
    # the names the game uses come back out of the wrapper under their public names
    tail = js[js.rindex("return {"):]
    for name in ("WebGLRenderer", "Vector3", "Scene", "PerspectiveCamera", "MeshStandardMaterial"):
        assert re.search(r"[{,]" + name + ":", tail), name


def test_fonts_are_inlined(build):
    css = build.inline_fonts()
    assert "url(data:font/woff2;base64," in css
    assert not re.search(r"url\((?!data:)", css), "a font still points at a file"
