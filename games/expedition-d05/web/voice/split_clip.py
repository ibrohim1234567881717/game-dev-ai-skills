"""Cut one recorded line into several, so a cutscene can change shot between its words.

The briefing names the five species in one recording; the cutscene that shows each of them
needs each name as its own line. Rather than synthesise the names again (a new take would not
sound like the rest of the sentence), this cuts the approved take at its pauses and adds the
pieces to audio/manifest.json as new lines. The source clip and its manifest entry stay.

    python voice/split_clip.py 8231a5e5 "Трицератопс.@0-1.5" "Велоцираптор.@1.55-3.3" ...

Each piece is "<text as the game says it>@<start>-<end>" in seconds. Find the pauses with
    ffmpeg -i audio/halm/8231a5e5.mp3 -af silencedetect=noise=-38dB:d=0.12 -f null -
and cut in the middle of them. Needs ffmpeg on PATH, or the imageio-ffmpeg package.
"""

import argparse
import datetime
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from extract_lines import line_id  # noqa: E402  the same id rule the game uses

AUDIO = HERE / "audio"


def ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
    except ImportError:
        sys.exit("ffmpeg not found: install it, or `pip install imageio-ffmpeg`")
    return imageio_ffmpeg.get_ffmpeg_exe()


def duration(ff: str, path: Path) -> float:
    out = subprocess.run([ff, "-hide_banner", "-i", str(path), "-f", "null", "-"], capture_output=True, text=True).stderr
    t = out.rsplit("time=", 1)[1].split()[0]
    h, m, s = t.split(":")
    return round(int(h) * 3600 + int(m) * 60 + float(s), 3)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("source", help="line id of the recording to cut")
    ap.add_argument("pieces", nargs="+", help='"text@start-end", seconds')
    a = ap.parse_args()
    manifest_path = AUDIO / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    src = manifest.get(a.source)
    if not src:
        sys.exit(f"{a.source}: not in the manifest")
    ff = ffmpeg()
    for piece in a.pieces:
        text, _, span = piece.rpartition("@")
        start, end = (float(x) for x in span.split("-"))
        lid = line_id(src["speaker"], text)
        rel = f"{src['speaker']}/{lid}.mp3"
        fade = 0.012
        subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-i", str(AUDIO / src["file"]),
                        "-ss", f"{start}", "-to", f"{end}",
                        "-af", f"afade=t=in:d={fade},areverse,afade=t=in:d={fade},areverse",
                        "-ac", "1", "-ar", "24000", "-b:a", "64k", str(AUDIO / rel)], check=True)
        entry = {k: v for k, v in src.items() if k not in ("bytes", "dur", "file", "say", "text_hash", "created")}
        entry.update({
            "bytes": (AUDIO / rel).stat().st_size, "dur": duration(ff, AUDIO / rel), "file": rel, "say": text,
            "text_hash": lid, "created": datetime.datetime.now().isoformat(timespec="seconds"),
            "cut_from": {"id": a.source, "start": start, "end": end},
        })
        manifest[lid] = entry
        print(f"{lid}  {entry['dur']:5.2f} s  {text}")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
