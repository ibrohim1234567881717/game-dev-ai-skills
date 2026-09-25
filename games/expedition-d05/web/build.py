#!/usr/bin/env python3
"""Bundle the UMBRA browser game into one HTML file.

    python games/expedition-d05/web/build.py
    python games/expedition-d05/web/build.py --no-voice
    python games/expedition-d05/web/build.py --voice-dir PATH

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
music/README.md. Stdlib only.
"""

from __future__ import annotations

import argparse
import base64
import json
import shutil
import sys
from pathlib import Path
from typing import List, Optional, Tuple

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT / "dist" / "umbra.html"
THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
VOICE_DIR = ROOT / "voice"
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


def copy_music(src: Path) -> Tuple[dict, int, List[str]]:
    """Copy one file per known cue into dist/music/; returns (cue -> relative url, bytes, notes)."""
    tracks: dict = {}
    total = 0
    notes: List[str] = []
    if MUSIC_OUT.is_dir():
        shutil.rmtree(MUSIC_OUT)  # build output only: the sources live in music/
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
        MUSIC_OUT.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(f, MUSIC_OUT / f.name)
        tracks[cue] = f"music/{f.name}"
        total += f.stat().st_size
    return tracks, total, notes


def speaker_table() -> Optional[list]:
    path = VOICE_DIR / "voices.json"
    if not path.is_file():
        return None
    who_map = json.loads(path.read_text(encoding="utf-8")).get("who_map", {})
    return [[p, k] for p, k in sorted(who_map.items(), key=lambda kv: -len(kv[0]))]


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
    args = ap.parse_args(argv)

    page = (SRC / "page.html").read_text(encoding="utf-8")
    css = (SRC / "style.css").read_text(encoding="utf-8")
    parts = [f"import * as THREE from '{THREE_URL}';"]

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
        if MUSIC_OUT.is_dir():
            shutil.rmtree(MUSIC_OUT)
        tracks, music_bytes, music_notes = {}, 0, []
    else:
        tracks, music_bytes, music_notes = copy_music(args.music_dir)
    for n in music_notes:
        print(f"warning: music {n}")
    parts.append("window.MUSIC_TRACKS = " + _js_json(tracks) + ";")
    if tracks:
        music_note = f"music: {len(tracks)} track(s) ({', '.join(sorted(tracks))}), {music_bytes / 1048576:.2f} MB in dist/music/"
    else:
        music_note = "music: off (--no-music)" if args.no_music else "music: none, the synthesized score plays"

    for js in sorted(SRC.glob("*.js")):
        parts.append(f"// ---- {js.name} ----\n" + js.read_text(encoding="utf-8"))
    js = "\n".join(parts)
    if "</script" in js:
        raise SystemExit("a JS source contains '</script' — it would end the inline module early")
    html = page.replace("/*__CSS__*/", css).replace("/*__JS__*/", js)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    size = len(html.encode("utf-8"))
    print(voice_note)
    print(music_note)
    print(f"wrote {OUT.relative_to(ROOT.parent)} ({size // 1024} KB)")
    if size > WARN_HTML_BYTES:
        print(f"warning: {OUT.name} is {size / 1048576:.1f} MB (> 15 MB); some browsers and hosts "
              "handle files this large slowly. Consider fewer lines, or a lower MP3 bitrate.")


if __name__ == "__main__":
    main()
