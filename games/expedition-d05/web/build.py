#!/usr/bin/env python3
"""Bundle the UMBRA browser game into one HTML file.

    python games/expedition-d05/web/build.py
    python games/expedition-d05/web/build.py --no-voice
    python games/expedition-d05/web/build.py --voice-dir PATH
    python games/expedition-d05/web/build.py --target yandex

Reads src/page.html, src/style.css and every src/*.js in name order, and
writes dist/umbra.html. The JS files share one module scope, so each file can
use what earlier files define. three.js is imported from the jsDelivr npm CDN.

Voice-over (optional): if voice/audio/manifest.json exists, every clip it
lists is embedded as a data: URL in

    window.VOICE_BANK = {"<line id>": {"d": <seconds>, "u": "data:audio/mpeg;base64,..."}};

right after the three.js import. Without a manifest (or with --no-voice) the
page gets window.VOICE_BANK = null and shows subtitles only. The speaker table
from voice/voices.json is emitted as window.VOICE_SPEAKERS, longest prefix
first. See voice/README.md.

Music (optional): audio files in music/ named after a cue (menu.mp3,
danger.ogg, ...) are copied to dist/music/ and listed in

    window.MUSIC_TRACKS = {"menu": "music/menu.mp3", ...};

They stay separate files, not data: URLs, so a few minutes of music does not
push the page past what browsers and hosts load comfortably. Keep dist/music/
next to dist/umbra.html. The cues the game knows are MUSIC_CUES; see
music/README.md.

Yandex Games (--target yandex): the platform wants a whole index.html at the
archive root and no requests to outside hosts. This target inlines three.js
and the fonts from vendor/ (see vendor/fetch_vendor.py), loads the Yandex SDK
from /sdk.js, and writes dist/yandex/ (index.html + music/) and
dist/umbra-yandex.zip, the file to upload in the developer console. See
YANDEX.md. Stdlib only.
"""

from __future__ import annotations

import argparse
import base64
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path
from typing import List, Optional, Tuple

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT / "dist" / "umbra.html"
THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
VOICE_DIR = ROOT / "voice"
VENDOR = ROOT / "vendor"
YANDEX_OUT = OUT.parent / "yandex"
YANDEX_ZIP = OUT.parent / "umbra-yandex.zip"
YANDEX_LIMIT = 100 * 1024 * 1024  # unpacked archive, per the Yandex Games requirements
MUSIC_DIR = ROOT / "music"
MUSIC_OUT = OUT.parent / "music"
MUSIC_CUES = ("menu", "island", "danger", "truth", "finale", "ending")
MUSIC_EXT = (".mp3", ".ogg", ".m4a", ".wav")
WARN_HTML_BYTES = 15 * 1024 * 1024
AUDIO_MIME = {
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".opus": "audio/ogg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".webm": "audio/webm",
}


def _js_json(value) -> str:
    """JSON that is also safe inside an inline <script>."""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def find_manifest(voice_dir: Path) -> Optional[Path]:
    """voice_dir may be the audio folder itself or the voice/ folder above it."""
    for cand in (voice_dir / "manifest.json", voice_dir / "audio" / "manifest.json"):
        if cand.is_file():
            return cand
    return None


def voice_bank(manifest_path: Path) -> Tuple[dict, int, List[str]]:
    """(bank, raw audio bytes, problems) for every playable clip in the manifest."""
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    base = manifest_path.parent
    bank: dict = {}
    raw = 0
    problems: List[str] = []
    for lid in sorted(manifest):
        entry = manifest[lid]
        if not isinstance(entry, dict) or "file" not in entry:
            continue
        path = base / entry["file"]
        mime = AUDIO_MIME.get(path.suffix.lower())
        if mime is None:
            problems.append(f"{lid}: unsupported audio type '{path.suffix}'")
            continue
        if not path.is_file():
            problems.append(f"{lid}: file missing: {entry['file']}")
            continue
        data = path.read_bytes()
        raw += len(data)
        bank[lid] = {
            "d": round(float(entry.get("dur", 0.0)), 3),
            "u": f"data:{mime};base64," + base64.b64encode(data).decode("ascii"),
        }
    return bank, raw, problems


def copy_music(src: Path, out: Path = MUSIC_OUT) -> Tuple[dict, int, List[str]]:
    """Copy one file per known cue into out (dist/music/); returns (cue -> relative url, bytes, notes)."""
    tracks: dict = {}
    total = 0
    notes: List[str] = []
    if out.is_dir():
        shutil.rmtree(out)  # build output only: the sources live in music/
    if not src.is_dir():
        return tracks, total, notes
    for f in sorted(src.iterdir()):
        if not f.is_file() or f.suffix.lower() not in MUSIC_EXT:
            continue
        cue = f.stem.lower()
        if cue not in MUSIC_CUES:
            notes.append(f"{f.name}: not a known cue ({', '.join(MUSIC_CUES)}), skipped")
            continue
        if cue in tracks:
            notes.append(f"{f.name}: a second file for '{cue}', skipped")
            continue
        out.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(f, out / f.name)
        tracks[cue] = f"music/{f.name}"
        total += f.stat().st_size
    return tracks, total, notes


def speaker_table() -> Optional[list]:
    path = VOICE_DIR / "voices.json"
    if not path.is_file():
        return None
    who_map = json.loads(path.read_text(encoding="utf-8")).get("who_map", {})
    return [[p, k] for p, k in sorted(who_map.items(), key=lambda kv: -len(kv[0]))]


# ---------- self-contained target (Yandex Games) ----------

def inline_three() -> str:
    """three.js as a plain block, not an import: `const THREE = (() => {...; return {...}})();`.

    Every file shares one module scope and reads THREE as a namespace, so an object with the same
    names behaves identically. An inline copy needs no second file and no network, and it also
    works from file://, where Chrome refuses to import a module from disk.
    """
    src = (VENDOR / "three.module.min.js").read_text(encoding="utf-8")
    m = re.search(r"export\s*\{([^}]*)\}\s*;?\s*$", src)
    if not m:
        raise SystemExit("vendor/three.module.min.js: no trailing export clause (run vendor/fetch_vendor.py)")
    # a module that imports something, or reads import.meta, cannot be unwrapped into a block
    if re.search(r"\bimport\s*[{*\"'(]|\bimport\.meta|\bexport\s+(default|const|function|class)\b", src[: m.start()]):
        raise SystemExit("vendor/three.module.min.js: has imports or inline exports; inlining would break it")
    names = []
    for item in m.group(1).split(","):
        bits = item.split(" as ")
        local, exported = bits[0].strip(), bits[-1].strip()
        names.append(f"{exported}:{local}")
    return "const THREE = (() => {\n" + src[: m.start()] + "\nreturn {" + ",".join(names) + "};\n})();"


def inline_fonts() -> str:
    """The vendored @font-face rules with every file as a data: URL."""
    css = (VENDOR / "fonts" / "fonts.css").read_text(encoding="utf-8")

    def data_url(m: "re.Match[str]") -> str:
        data = (VENDOR / "fonts" / m.group(1)).read_bytes()
        return "url(data:font/woff2;base64," + base64.b64encode(data).decode("ascii") + ")"

    return re.sub(r"url\(([\w.-]+\.woff2)\)", data_url, css)


def yandex_document(page: str) -> str:
    """page.html as a whole document: fonts inline, the Yandex SDK first, the game after it."""
    fonts = re.search(r"<!--fonts-->.*?<!--/fonts-->\n?", page, re.S)
    if not fonts:
        raise SystemExit("src/page.html: the <!--fonts--> ... <!--/fonts--> block is missing")
    page = page[: fonts.start()] + "<style>\n" + inline_fonts() + "</style>\n" + page[fonts.end():]
    head, sep, body = page.partition('<div id="app">')
    if not sep:
        raise SystemExit('src/page.html: <div id="app"> not found')
    return ('<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            # served by Yandex next to the game; a relative path is what the console expects for archive uploads
            '<script src="/sdk.js"></script>\n'
            + head + "</head>\n<body>\n" + sep + body + "</body>\n</html>\n")


def check_self_contained(html: str, root: Path) -> List[str]:
    """Problems that would fail Yandex moderation or the archive upload."""
    problems = []
    for host in ("cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"):
        if host in html:
            problems.append(f"index.html still references {host}")
    for m in re.finditer(r"""(?:src|href)\s*=\s*["'](https?:)?//|url\(\s*["']?https?:|from\s*["']https?:""", html):
        problems.append(f"index.html loads an outside resource near: {html[m.start():m.start() + 80]!r}")
    for f in root.rglob("*"):
        rel = f.relative_to(root).as_posix()
        if " " in rel or not rel.isascii():
            problems.append(f"file name with a space or non-ASCII characters: {rel}")
    return problems


def write_zip(root: Path, dest: Path) -> int:
    """Zip the contents of root (index.html at the archive root); returns the unpacked size."""
    total = 0
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in sorted(root.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(root).as_posix())
                total += f.stat().st_size
    return total


def main(argv=None) -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    ap = argparse.ArgumentParser(description="Bundle UMBRA into dist/umbra.html")
    ap.add_argument("--no-voice", action="store_true", help="do not embed voice-over audio")
    ap.add_argument("--voice-dir", type=Path, default=VOICE_DIR / "audio",
                    help="folder with manifest.json (default: voice/audio)")
    ap.add_argument("--no-music", action="store_true", help="leave music out (the game falls back to its synthesized score)")
    ap.add_argument("--music-dir", type=Path, default=MUSIC_DIR, help="folder with the music files (default: music)")
    ap.add_argument("--target", choices=("web", "yandex"), default="web",
                    help="web: dist/umbra.html, three.js and fonts from CDNs (default); "
                         "yandex: dist/yandex/index.html and dist/umbra-yandex.zip, nothing loaded from outside")
    args = ap.parse_args(argv)
    yandex = args.target == "yandex"
    out_html = YANDEX_OUT / "index.html" if yandex else OUT
    music_out = YANDEX_OUT / "music" if yandex else MUSIC_OUT
    if yandex and YANDEX_OUT.is_dir():
        shutil.rmtree(YANDEX_OUT)  # a build output: start clean so nothing stale lands in the archive

    page = (SRC / "page.html").read_text(encoding="utf-8")
    css = (SRC / "style.css").read_text(encoding="utf-8")
    parts = [inline_three() if yandex else f"import * as THREE from '{THREE_URL}';"]

    voice_note = "voice: off (--no-voice)"
    bank_js = "window.VOICE_BANK = null;"
    if not args.no_voice:
        manifest = find_manifest(args.voice_dir)
        if manifest is None:
            voice_note = f"voice: none (no manifest.json in {args.voice_dir})"
        else:
            bank, raw, problems = voice_bank(manifest)
            for p in problems:
                print(f"warning: voice {p}")
            if bank:
                bank_js = "window.VOICE_BANK = " + _js_json(bank) + ";"
                voice_note = (f"voice: {len(bank)} clips, {raw / 1048576:.2f} MB audio, "
                              f"{len(bank_js) / 1048576:.2f} MB embedded")
            else:
                voice_note = f"voice: manifest {manifest} lists no playable clips"
    parts.append(bank_js)
    speakers = speaker_table()
    if speakers is not None:
        parts.append("window.VOICE_SPEAKERS = " + _js_json(speakers) + ";")
    if args.no_music:
        if music_out.is_dir():
            shutil.rmtree(music_out)
        tracks, music_bytes, music_notes = {}, 0, []
    else:
        tracks, music_bytes, music_notes = copy_music(args.music_dir, music_out)
    for n in music_notes:
        print(f"warning: music {n}")
    parts.append("window.MUSIC_TRACKS = " + _js_json(tracks) + ";")
    if tracks:
        music_note = f"music: {len(tracks)} track(s) ({', '.join(sorted(tracks))}), {music_bytes / 1048576:.2f} MB in {music_out.relative_to(ROOT)}/"
    else:
        music_note = "music: off (--no-music)" if args.no_music else "music: none, the synthesized score plays"

    for js in sorted(SRC.glob("*.js")):
        parts.append(f"// ---- {js.name} ----\n" + js.read_text(encoding="utf-8"))
    js = "\n".join(parts)
    if "</script" in js:
        raise SystemExit("a JS source contains '</script' — it would end the inline module early")
    html = page.replace("/*__CSS__*/", css).replace("/*__JS__*/", js)
    if yandex:
        html = yandex_document(html)
    out_html.parent.mkdir(parents=True, exist_ok=True)
    out_html.write_text(html, encoding="utf-8")
    size = len(html.encode("utf-8"))
    print(voice_note)
    print(music_note)
    print(f"wrote {out_html.relative_to(ROOT.parent)} ({size // 1024} KB)")
    if size > WARN_HTML_BYTES:
        print(f"warning: {out_html.name} is {size / 1048576:.1f} MB (> 15 MB); some browsers and hosts "
              "handle files this large slowly. Consider fewer lines, or a lower MP3 bitrate.")
    if yandex:
        # three.js (MIT) and the fonts (SIL OFL) travel inside index.html; their licences ask to travel with them
        lic = YANDEX_OUT / "licenses"
        lic.mkdir(exist_ok=True)
        shutil.copyfile(VENDOR / "three.LICENSE", lic / "three.js-LICENSE.txt")
        for f in sorted((VENDOR / "fonts").glob("OFL-*.txt")):
            shutil.copyfile(f, lic / f.name)
        problems = check_self_contained(html, YANDEX_OUT)
        for p in problems:
            print(f"error: {p}")
        if problems:
            raise SystemExit("the Yandex build is not self-contained; nothing was zipped")
        unpacked = write_zip(YANDEX_OUT, YANDEX_ZIP)
        print(f"wrote {YANDEX_ZIP.relative_to(ROOT.parent)} ({YANDEX_ZIP.stat().st_size // 1024} KB, "
              f"{unpacked / 1048576:.1f} MB unpacked of the {YANDEX_LIMIT // 1048576} MB allowed)")
        if unpacked > YANDEX_LIMIT:
            raise SystemExit("the archive is over the Yandex Games size limit")


if __name__ == "__main__":
    main()
