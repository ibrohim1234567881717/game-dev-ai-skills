#!/usr/bin/env python3
"""Generate the UMBRA voice-over with Qwen3-TTS. Runs on your own PC.

    python generate.py --list-speakers
    python generate.py --dry-run                    # what would happen, no model needed
    python generate.py                              # auto-detect a local 0.6B model
    python generate.py --model D:\\models\\Qwen3-TTS-12Hz-0.6B-CustomVoice --device cuda
    python generate.py --only lena --force          # redo one character
    python generate.py --only 12fbd71b --force --seed 1   # redo one line, another take
    python generate.py --mock --limit 5             # no model: placeholder tones, tests the pipeline

Reads voice/lines.json (from extract_lines.py) and voice/voices.json, writes
voice/audio/<speaker>/<id>.mp3 and voice/audio/manifest.json. Files that
already exist are never overwritten without --force; the manifest is saved
after every line, so an interrupted run resumes where it stopped.

qwen-tts API used here, read from the qwen-tts 0.1.1 source (PyPI, Jan 2026);
if your installed version differs, check `pip show qwen-tts` and
qwen_tts/inference/qwen3_tts_model.py:

    from qwen_tts import Qwen3TTSModel
    tts = Qwen3TTSModel.from_pretrained(path_or_hf_id, device_map="cuda:0", dtype=torch.bfloat16)
    tts.model.tts_model_type          "custom_voice" | "voice_design" | "base"   (config.json)
    tts.model.tts_model_size          "0b6" | "1b7"                              (config.json)
    tts.get_supported_speakers()      lower-cased preset names, or None
    wavs, sr = tts.generate_custom_voice(text=, speaker=, language=, instruct=)
        -> the package itself drops `instruct` when tts_model_size is "0b6"
    wavs, sr = tts.generate_voice_design(text=, instruct=, language=)    1.7B only
    prompt = tts.create_voice_clone_prompt(ref_audio=(wav, sr), ref_text=, x_vector_only_mode=)
    wavs, sr = tts.generate_voice_clone(text=, language=, voice_clone_prompt=prompt)
    extra kwargs (max_new_tokens, temperature, top_p, ...) go to HF generate().

Third-party imports: numpy and soundfile always; torch, qwen_tts and librosa
(both come with `pip install qwen-tts`) only when needed.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

VOICE_DIR = Path(__file__).resolve().parent
LINES_JSON = VOICE_DIR / "lines.json"
VOICES_JSON = VOICE_DIR / "voices.json"
AUDIO_DIR = VOICE_DIR / "audio"
REFS_DIR = VOICE_DIR / "refs"

sys.path.insert(0, str(VOICE_DIR))
from extract_lines import apply_pronounce, fnv1a32  # noqa: E402  (same folder, stdlib only)

# Preset voices of the CustomVoice models (README of qwen-tts 0.1.1). The real
# list is read from the loaded model; this one is only for --dry-run/--list.
KNOWN_PRESETS = ["Vivian", "Serena", "Uncle_Fu", "Dylan", "Eric", "Ryan", "Aiden", "Ono_Anna", "Sohee"]
FORMATS = [("mp3", "MP3", "MPEG_LAYER_III"), ("ogg", "OGG", "VORBIS"), ("wav", "WAV", "PCM_16")]
TARGET_PEAK_DBFS = -1.0


def log(msg: str = "") -> None:
    print(msg, flush=True)


def load_json(path: Path, default=None):
    if not path.is_file():
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json_atomic(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")
    os.replace(tmp, path)


# --------------------------------------------------------------------------
# Finding a model
# --------------------------------------------------------------------------

def read_model_info(path: Path) -> Optional[dict]:
    """Model type/size from a local folder's config.json, without torch."""
    try:
        cfg = json.loads((path / "config.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if cfg.get("model_type") != "qwen3_tts" or "tts_model_type" not in cfg:
        return None  # not a Qwen3-TTS model (the 12Hz tokenizer repo lands here too)
    return {
        "path": str(path),
        "name": _model_name(str(path)),
        "type": cfg.get("tts_model_type"),
        "size": cfg.get("tts_model_size"),
        "complete": (path / "speech_tokenizer" / "config.json").is_file(),
    }


def _model_name(path_or_id: str) -> str:
    p = path_or_id.replace("\\", "/").rstrip("/")
    m = re.search(r"models--([^/]+)--([^/]+)/snapshots", p)
    if m:
        return f"{m.group(1)}/{m.group(2)}"
    return p.split("/")[-1]


def guess_info_from_name(name: str) -> dict:
    low = name.lower()
    typ = ("custom_voice" if "customvoice" in low else
           "voice_design" if "voicedesign" in low else
           "base" if low.endswith("-base") or "-base" in low else None)
    size = "0b6" if "0.6b" in low else "1b7" if "1.7b" in low else None
    return {"path": name, "name": name, "type": typ, "size": size, "complete": True}


def _hf_cache_dirs() -> List[Path]:
    out = []
    for var in ("HF_HUB_CACHE", "HUGGINGFACE_HUB_CACHE"):
        if os.environ.get(var):
            out.append(Path(os.environ[var]))
    if os.environ.get("HF_HOME"):
        out.append(Path(os.environ["HF_HOME"]) / "hub")
    out.append(Path.home() / ".cache" / "huggingface" / "hub")
    return out


def _search_roots() -> List[Path]:
    home = Path.home()
    roots = [VOICE_DIR / "models", VOICE_DIR.parent / "models", Path.cwd() / "models", Path.cwd(),
             home / "models", home / "Downloads", home / "Desktop", home / "Documents",
             home / ".cache" / "modelscope" / "hub" / "models" / "Qwen",
             home / ".cache" / "modelscope" / "hub" / "Qwen"]
    if os.environ.get("MODELSCOPE_CACHE"):
        ms = Path(os.environ["MODELSCOPE_CACHE"])
        roots += [ms / "models" / "Qwen", ms / "Qwen", ms / "hub" / "models" / "Qwen"]
    if os.name == "nt":
        for drive in "CDEFGH":
            roots += [Path(f"{drive}:/models"), Path(f"{drive}:/AI/models")]
    for parent in list(VOICE_DIR.parents)[:5]:  # (Path.parents slicing needs 3.10)
        roots.append(parent / "models")
    return roots


def find_local_models() -> List[dict]:
    """Every local Qwen3-TTS model folder in the usual places."""
    found: Dict[str, dict] = {}

    def consider(p: Path) -> None:
        try:
            if not p.is_dir():
                return
        except OSError:
            return
        info = read_model_info(p)
        if info:
            found.setdefault(os.path.normcase(str(p.resolve())), info)

    for hub in _hf_cache_dirs():
        try:
            repos = [d for d in hub.iterdir() if d.is_dir() and "qwen3-tts" in d.name.lower()]
        except OSError:
            continue
        for repo in repos:
            snaps = repo / "snapshots"
            ref = repo / "refs" / "main"
            try:
                if ref.is_file() and (snaps / ref.read_text().strip()).is_dir():
                    consider(snaps / ref.read_text().strip())
                    continue
                for s in sorted(snaps.iterdir(), key=lambda d: d.stat().st_mtime, reverse=True):
                    consider(s)
            except OSError:
                pass
    for root in _search_roots():
        consider(root)
        try:
            children = [c for c in root.iterdir() if c.is_dir()]
        except OSError:
            continue
        for c in children:
            consider(c)
            if "qwen" in c.name.lower() or "tts" in c.name.lower() or c.name.lower() == "models":
                try:
                    for g in c.iterdir():
                        consider(g)
                except OSError:
                    pass
    return list(found.values())


def rank_model(info: dict) -> tuple:
    size_rank = {"0b6": 0, "1b7": 1}.get(info.get("size"), 2)
    type_rank = {"custom_voice": 0, "base": 1, "voice_design": 2}.get(info.get("type"), 3)
    return (not info.get("complete"), size_rank, type_rank, info["path"])


def resolve_model(arg: Optional[str]) -> dict:
    if arg:
        p = Path(arg).expanduser()
        if p.is_dir():
            info = read_model_info(p)
            if info is None:
                raise SystemExit(f"{p} has no Qwen3-TTS config.json (tts_model_type). Is this the model folder?")
            if not info["complete"]:
                log(f"warning: {p} has no speech_tokenizer/ subfolder; loading will probably fail")
            return info
        for info in find_local_models():  # an HF id that is already in the cache
            if info["name"].lower() == arg.lower():
                return info
        log(f"'{arg}' is not a local folder; qwen-tts will download it from Hugging Face")
        return guess_info_from_name(arg)
    models = sorted(find_local_models(), key=rank_model)
    if not models:
        raise SystemExit(
            "No local Qwen3-TTS model found. Pass --model <folder or HF id>, e.g.\n"
            "  --model C:\\models\\Qwen3-TTS-12Hz-0.6B-CustomVoice\n"
            "Looked in the Hugging Face cache (~/.cache/huggingface/hub), ModelScope cache, "
            "./models, ~/models, ~/Downloads.")
    log("found local Qwen3-TTS models:")
    for m in models:
        flag = "" if m["complete"] else "  (incomplete: no speech_tokenizer/)"
        log(f"  {m['type'] or '?':<13} {m['size'] or '?':<4} {m['path']}{flag}")
    log(f"using: {models[0]['path']}")
    return models[0]


def instruct_supported(info: dict) -> bool:
    """Mirrors qwen-tts: `if self.model.tts_model_size in "0b6": instruct = None`."""
    size = info.get("size")
    if info.get("type") == "voice_design":
        return True
    if info.get("type") == "base":
        return False
    return not (isinstance(size, str) and size in "0b6")


# --------------------------------------------------------------------------
# Per-line synthesis settings
# --------------------------------------------------------------------------

def emotion_settings(voices: dict, speaker: str, emotion: str) -> dict:
    base = dict(voices.get("emotion_defaults", {}).get(emotion, {}))
    ov = voices["speakers"].get(speaker, {}).get("emotions", {}).get(emotion)
    if isinstance(ov, str):
        ov = {"instruct": ov}
    base.update(ov or {})
    return base


def _join(*parts: Optional[str]) -> str:
    return " ".join(p.strip() for p in parts if p and p.strip())


def line_settings(line: dict, voices: dict, mode: str, can_instruct: bool) -> dict:
    prof = voices["speakers"][line["speaker"]]
    emo = emotion_settings(voices, line["speaker"], line.get("emotion", "neutral"))
    s = {
        "language": prof.get("language", voices.get("language", "Russian")),
        "speed": float(prof.get("speed", 1.0)) * float(emo.get("speed", 1.0)),
        "gain_db": float(emo.get("gain_db", 0.0)),
        "pitch": 0.0,
        "preset": None,
        "instruct": None,
    }
    if mode == "custom_voice":
        s["preset"] = prof.get("preset")
        s["pitch"] = float(prof.get("pitch_semitones", 0.0))  # separates shared presets
        if can_instruct:
            s["instruct"] = _join(prof.get("style"), emo.get("instruct")) or None
    elif mode == "voice_design":
        s["instruct"] = _join(prof.get("description"), prof.get("style"), emo.get("instruct"))
    return s


def max_tokens_for(text: str) -> int:
    # the 12Hz codec makes ~12.5 frames/s; Russian speech is ~13-15 chars/s.
    # 3 frames per character is a generous ceiling that still stops a runaway.
    return int(min(2048, 60 + 3 * len(text)))


def expected_seconds(text: str) -> float:
    return 0.4 + len(text) / 14.0


# --------------------------------------------------------------------------
# Audio post-processing (numpy; librosa only for speed/pitch)
# --------------------------------------------------------------------------

def to_mono_float(wav):
    import numpy as np
    if hasattr(wav, "detach"):  # a torch tensor
        wav = wav.detach().float().cpu().numpy()
    y = np.asarray(wav, dtype=np.float32)
    if y.ndim > 1:
        y = y.mean(axis=0 if y.shape[0] < y.shape[-1] else -1)
    return np.nan_to_num(y.reshape(-1))


def trim_silence(y, sr: int, rel_db: float = -40.0, floor_db: float = -60.0,
                 pad_start: float = 0.04, pad_end: float = 0.12):
    import numpy as np
    frame = max(1, int(sr * 0.01))
    n = len(y) // frame
    if n < 2:
        return y
    rms = np.sqrt(np.mean(y[:n * frame].reshape(n, frame) ** 2, axis=1))
    peak = float(rms.max())
    if peak <= 0:
        return y
    thr = max(peak * 10 ** (rel_db / 20), 10 ** (floor_db / 20))
    loud = np.nonzero(rms > thr)[0]
    if loud.size == 0:
        return y
    a = max(0, loud[0] * frame - int(pad_start * sr))
    b = min(len(y), (loud[-1] + 1) * frame + int(pad_end * sr))
    return y[a:b]


def postprocess(y, sr: int, speed: float, pitch: float, gain_db: float, trim: bool, notes: set):
    import numpy as np
    if trim:
        y = trim_silence(y, sr)
    if abs(pitch) > 0.05 or abs(speed - 1.0) > 0.01:
        try:
            import librosa
            if abs(pitch) > 0.05:
                y = librosa.effects.pitch_shift(y, sr=sr, n_steps=pitch)
            if abs(speed - 1.0) > 0.01:
                y = librosa.effects.time_stretch(y, rate=speed)
        except ImportError:
            notes.add("librosa is not installed: speed/pitch_semitones from voices.json were not applied")
    y = np.asarray(y, dtype=np.float32)
    peak = float(np.max(np.abs(y))) if y.size else 0.0
    if peak > 1e-6:
        y = y * (10 ** (TARGET_PEAK_DBFS / 20) / peak)
    if gain_db:
        y = y * (10 ** (gain_db / 20))
    fi, fo = min(len(y), int(0.005 * sr)), min(len(y), int(0.03 * sr))
    if fi:
        y[:fi] *= np.linspace(0.0, 1.0, fi, dtype=np.float32)
    if fo:
        y[-fo:] *= np.linspace(1.0, 0.0, fo, dtype=np.float32)
    return y


def mock_wave(line: dict, sr: int = 24000):
    """Placeholder 'speech': a hummed tone per speaker, with silence around it."""
    import numpy as np
    dur = max(0.8, min(12.0, expected_seconds(line["say"])))
    t = np.arange(int(dur * sr), dtype=np.float32) / sr
    f0 = 100 + (fnv1a32(line["speaker"].encode()) % 160)
    syll = 0.55 + 0.45 * np.sin(2 * np.pi * 4.0 * t) ** 2
    tone = sum(np.sin(2 * np.pi * f0 * k * t) / k for k in range(1, 5))
    rng = np.random.default_rng(fnv1a32(line["id"].encode()))
    y = 0.25 * syll * tone + 0.01 * rng.standard_normal(t.size)
    pad = np.zeros(int(0.3 * sr), dtype=np.float32)
    return np.concatenate([pad, y.astype(np.float32), pad]), sr


# --------------------------------------------------------------------------
# Writing files
# --------------------------------------------------------------------------

class Writer:
    def __init__(self, prefer: str, mp3_level: Optional[float]):
        import soundfile as sf
        self.sf = sf
        avail = set(sf.available_formats())
        order = FORMATS if prefer == "auto" else [f for f in FORMATS if f[0] == prefer] + \
            [f for f in FORMATS if f[0] != prefer]
        self.formats = [f for f in order if f[1] in avail]
        if not self.formats:
            raise SystemExit("soundfile can write neither MP3, OGG nor WAV here")
        if self.formats[0][0] != order[0][0]:
            log(f"note: this libsndfile ({getattr(sf, '__libsndfile_version__', '?')}) cannot write "
                f"{order[0][1]}; writing {self.formats[0][1]} instead (pip install -U soundfile)")
        self.mp3_level = mp3_level

    def write(self, stem: Path, y, sr: int) -> Path:
        stem.parent.mkdir(parents=True, exist_ok=True)
        while self.formats:
            ext, fmt, sub = self.formats[0]
            path = stem.with_suffix("." + ext)
            kw = {}
            if fmt == "MP3" and self.mp3_level is not None:
                kw["compression_level"] = self.mp3_level  # soundfile >= 0.13
            try:
                self.sf.write(str(path), y, sr, format=fmt, subtype=sub, **kw)
                return path
            except Exception as e:  # noqa: BLE001 - any encoder failure means: try the next format
                try:
                    path.unlink()
                except OSError:
                    pass
                log(f"warning: writing {fmt} failed ({e}); falling back to the next format")
                self.formats.pop(0)
        raise RuntimeError("no audio format could be written")


def existing_audio(line: dict, manifest: dict) -> Optional[Path]:
    e = manifest.get(line["id"])
    if e and (AUDIO_DIR / e.get("file", "")).is_file():
        return AUDIO_DIR / e["file"]
    for ext, _, _ in FORMATS:
        p = AUDIO_DIR / line["speaker"] / f"{line['id']}.{ext}"
        if p.is_file():
            return p
    return None


def _duration(p: Path) -> float:
    try:
        import soundfile as sf
        return float(sf.info(str(p)).duration)
    except Exception:  # noqa: BLE001 - unreadable here; the game falls back to its own timing
        return 0.0


def adopt_orphans(lines: List[dict], manifest: dict) -> int:
    """Audio you placed by hand gets a manifest entry; a replaced file (its size
    differs from what generate.py wrote) gets its duration re-read."""
    n = 0
    for l in lines:
        e = manifest.get(l["id"])
        p = existing_audio(l, manifest)
        if p is None:
            continue
        size = p.stat().st_size
        if e is not None and (e.get("bytes") in (None, size)) and (AUDIO_DIR / e.get("file", "")) == p:
            continue
        manifest[l["id"]] = {"file": p.relative_to(AUDIO_DIR).as_posix(), "dur": round(_duration(p), 3),
                             "speaker": l["speaker"], "model": "external", "text_hash": l["id"],
                             "bytes": size}
        n += 1
    return n


# --------------------------------------------------------------------------
# The TTS engine
# --------------------------------------------------------------------------

class Engine:
    """Wraps one loaded Qwen3TTSModel (or the mock)."""

    def __init__(self, info: dict, device: str, dtype: str, mock: bool):
        self.info, self.mock = info, mock
        self.tts = None
        self.torch = None
        self.presets: Optional[set] = None
        self.clone_prompts: Dict[tuple, object] = {}
        if mock:
            return
        try:
            import torch
            from qwen_tts import Qwen3TTSModel
        except ImportError as e:
            raise SystemExit(f"cannot import qwen-tts ({e}). Install it: pip install -U qwen-tts soundfile")
        self.torch = torch
        dev = device
        if dev == "auto":
            dev = "cuda" if torch.cuda.is_available() else "cpu"
        if dev == "cuda" and not torch.cuda.is_available():
            raise SystemExit("--device cuda, but torch sees no CUDA GPU (CPU-only torch build?). "
                             "Use --device cpu or install a CUDA build of torch.")
        if dtype == "auto":
            if dev.startswith("cuda"):
                dt = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
            else:
                dt = torch.float32
        else:
            dt = {"bf16": torch.bfloat16, "fp16": torch.float16, "fp32": torch.float32}[dtype]
        kwargs = {"device_map": "cuda:0" if dev == "cuda" else dev, "dtype": dt}
        if dev.startswith("cuda") and dt in (torch.float16, torch.bfloat16):
            try:
                import flash_attn  # noqa: F401
                kwargs["attn_implementation"] = "flash_attention_2"
            except ImportError:
                pass
        log(f"loading {info['path']} on {dev} ({str(dt).replace('torch.', '')}) ...")
        t0 = time.time()
        self.tts = Qwen3TTSModel.from_pretrained(info["path"], **kwargs)
        m = self.tts.model
        self.info = dict(info, type=getattr(m, "tts_model_type", info.get("type")),
                         size=getattr(m, "tts_model_size", info.get("size")))
        sp = self.tts.get_supported_speakers()
        self.presets = set(sp) if sp else None
        log(f"loaded in {time.time() - t0:.0f}s: type={self.info['type']} size={self.info['size']}"
            + (f", presets: {', '.join(sorted(self.presets))}" if self.presets else ""))

    @property
    def mode(self) -> str:
        return {"custom_voice": "custom_voice", "voice_design": "voice_design",
                "base": "clone"}.get(self.info.get("type"), "unknown")

    def unload(self) -> None:
        self.tts = None
        self.clone_prompts.clear()
        if self.torch is not None and self.torch.cuda.is_available():
            self.torch.cuda.empty_cache()

    def pick_preset(self, speaker: str, prof: dict, warned: set) -> str:
        want = [prof.get("preset")] + list(prof.get("preset_alternatives", []))
        want = [w for w in want if w]
        if self.presets is None:
            return want[0] if want else KNOWN_PRESETS[0]
        for w in want:
            if w.lower() in self.presets:
                if w != want[0] and speaker not in warned:
                    log(f"note: preset {want[0]} is not in this model, {speaker} uses {w}")
                    warned.add(speaker)
                return w
        fallback = sorted(self.presets)[0]
        if speaker not in warned:
            log(f"warning: none of {want} exist in this model; {speaker} uses {fallback}")
            warned.add(speaker)
        return fallback

    def _seed(self, seed: int) -> None:
        if self.torch is not None:
            self.torch.manual_seed(seed)
            if self.torch.cuda.is_available():
                self.torch.cuda.manual_seed_all(seed)

    def synth(self, text: str, s: dict, seed: int, clone_prompt=None) -> Tuple[object, int]:
        if self.mock:
            raise RuntimeError("synth() is not used in mock mode")
        self._seed(seed)
        gen = {"max_new_tokens": max_tokens_for(text)}
        if self.mode == "custom_voice":
            wavs, sr = self.tts.generate_custom_voice(text=text, speaker=s["preset"], language=s["language"],
                                                      instruct=s["instruct"], **gen)
        elif self.mode == "voice_design":
            wavs, sr = self.tts.generate_voice_design(text=text, instruct=s["instruct"] or "",
                                                      language=s["language"], **gen)
        elif self.mode == "clone":
            wavs, sr = self.tts.generate_voice_clone(text=text, language=s["language"],
                                                     voice_clone_prompt=clone_prompt, **gen)
        else:
            raise RuntimeError(f"unknown model type {self.info.get('type')!r}")
        return wavs[0], int(sr)

    def clone_prompt(self, speaker: str, emotion: str):
        """Reference for Base models: refs/<speaker>.<emotion>.wav, else refs/<speaker>.wav."""
        import soundfile as sf
        for key, stem in (((speaker, emotion), f"{speaker}.{emotion}"), ((speaker, None), speaker)):
            if key in self.clone_prompts:
                return self.clone_prompts[key]
            wav = REFS_DIR / f"{stem}.wav"
            if not wav.is_file():
                continue
            txt = REFS_DIR / f"{stem}.txt"
            ref_text = txt.read_text(encoding="utf-8").strip() if txt.is_file() else ""
            audio, sr = sf.read(str(wav), dtype="float32", always_2d=False)
            if audio.ndim > 1:
                audio = audio.mean(axis=1)
            if not ref_text:
                log(f"note: {txt.name} is missing; cloning {stem} from the timbre only (x_vector_only_mode)")
            items = self.tts.create_voice_clone_prompt(ref_audio=(audio, int(sr)), ref_text=ref_text or None,
                                                       x_vector_only_mode=not ref_text)
            self.clone_prompts[key] = items
            return items
        return None


def make_refs(speakers: List[str], voices: dict, ref_info: dict, args) -> List[str]:
    """Create refs/<speaker>.wav with a preset/designed voice, for Base-model cloning."""
    ref = Engine(ref_info, args.device, args.dtype, mock=False)
    if ref.mode not in ("custom_voice", "voice_design"):
        raise SystemExit("--ref-model must be a CustomVoice or VoiceDesign model")
    made, warned = [], set()
    notes: set = set()
    for spk in speakers:
        prof = voices["speakers"][spk]
        text = apply_pronounce(prof.get("ref_text", ""), voices.get("pronounce", {}))
        if not text:
            log(f"warning: {spk} has no ref_text in voices.json; cannot make a reference")
            continue
        s = line_settings({"speaker": spk, "emotion": "neutral"}, voices, ref.mode, instruct_supported(ref.info))
        if ref.mode == "custom_voice":
            s["preset"] = ref.pick_preset(spk, prof, warned)
        wav, sr = ref.synth(text, s, seed=fnv1a32(spk.encode()) + args.seed)
        y = postprocess(to_mono_float(wav), sr, 1.0, s["pitch"], 0.0, True, notes)
        REFS_DIR.mkdir(parents=True, exist_ok=True)
        import soundfile as sf
        sf.write(str(REFS_DIR / f"{spk}.wav"), y, sr, subtype="PCM_16")
        (REFS_DIR / f"{spk}.txt").write_text(text + "\n", encoding="utf-8")
        log(f"  reference: refs/{spk}.wav ({len(y) / sr:.1f}s, {ref.mode})")
        made.append(spk)
    for n in sorted(notes):
        log(f"note: {n}")
    ref.unload()
    return made


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def select_lines(lines: List[dict], only: Optional[str], voices: dict) -> List[dict]:
    if not only:
        return lines
    ids = {l["id"] for l in lines}
    speakers = {l["speaker"] for l in lines} | set(voices["speakers"])
    want_ids, want_spk = set(), set()
    for tok in [t.strip() for t in only.split(",") if t.strip()]:
        if tok.lower() in ids:
            want_ids.add(tok.lower())
        elif tok in speakers:
            want_spk.add(tok)
        else:
            raise SystemExit(f"--only: '{tok}' is neither a speaker ({', '.join(sorted(speakers))}) "
                             "nor a line id from lines.json")
    return [l for l in lines if l["id"] in want_ids or l["speaker"] in want_spk]


def list_speakers(lines: List[dict], voices: dict, manifest: dict) -> None:
    log(f"{'key':<9} {'name':<14} {'sex':<6} {'age':>3} {'preset':<9} {'pitch':>5} {'speed':>5} "
        f"{'lines':>5} {'done':>5}")
    for key, p in voices["speakers"].items():
        ls = [l for l in lines if l["speaker"] == key]
        done = sum(1 for l in ls if existing_audio(l, manifest))
        log(f"{key:<9} {p.get('name', ''):<14} {p.get('gender', ''):<6} {p.get('age', ''):>3} "
            f"{p.get('preset', ''):<9} {p.get('pitch_semitones', 0):>5} {p.get('speed', 1.0):>5} "
            f"{len(ls):>5} {done:>5}")
    unknown = sorted({l["speaker"] for l in lines} - set(voices["speakers"]))
    if unknown:
        log(f"\nno profile in voices.json for: {', '.join(unknown)}")
    log(f"\npresets in Qwen3-TTS CustomVoice (0.6B and 1.7B): {', '.join(KNOWN_PRESETS)}")


def main(argv=None) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    ap = argparse.ArgumentParser(description="Generate UMBRA voice-over with Qwen3-TTS",
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", help="local model folder or Hugging Face id (default: auto-detect, prefers 0.6B)")
    ap.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"])
    ap.add_argument("--dtype", default="auto", choices=["auto", "bf16", "fp16", "fp32"])
    ap.add_argument("--only", help="comma-separated speakers and/or line ids, e.g. lena or 12fbd71b,c3e9d871")
    ap.add_argument("--force", action="store_true", help="regenerate even if the audio file exists")
    ap.add_argument("--dry-run", action="store_true", help="show the plan; load nothing, write nothing")
    ap.add_argument("--limit", type=int, help="generate at most N lines this run")
    ap.add_argument("--list-speakers", action="store_true", help="print the voice table and exit")
    ap.add_argument("--mock", action="store_true", help="no model: write placeholder tones (pipeline test)")
    ap.add_argument("--ref-model", help="CustomVoice/VoiceDesign model that creates missing refs/<speaker>.wav "
                                        "when --model is a Base (voice clone) model")
    ap.add_argument("--seed", type=int, default=0, help="change to get a different take of the same line")
    ap.add_argument("--format", default="auto", choices=["auto", "mp3", "ogg", "wav"])
    ap.add_argument("--mp3-level", type=float, default=None,
                    help="MP3 compression 0.0 (best, larger) .. 0.9 (smallest); default: libsndfile's VBR")
    ap.add_argument("--no-trim", action="store_true", help="keep leading/trailing silence")
    ap.add_argument("--prune", action="store_true",
                    help="move audio of lines no longer in the game to audio/_pruned/ and drop them from the manifest")
    args = ap.parse_args(argv)

    voices = load_json(VOICES_JSON)
    lines = load_json(LINES_JSON)
    if voices is None:
        raise SystemExit(f"missing {VOICES_JSON}")
    if lines is None:
        raise SystemExit(f"missing {LINES_JSON}: run extract_lines.py first")
    manifest_path = AUDIO_DIR / "manifest.json"
    manifest = load_json(manifest_path, {}) or {}

    if args.list_speakers:
        list_speakers(lines, voices, manifest)
        return 0

    no_profile = sorted({l["speaker"] for l in lines} - set(voices["speakers"]))
    if no_profile:
        log(f"warning: no voice profile for {', '.join(no_profile)}; their lines are skipped")
    todo_all = [l for l in select_lines(lines, args.only, voices) if l["speaker"] in voices["speakers"]]

    stale = sorted(set(manifest) - {l["id"] for l in lines})
    if not args.dry_run:
        adopted = adopt_orphans(lines, manifest)
        if adopted:
            log(f"manifest: took in {adopted} audio file(s) placed or replaced by hand")
            save_json_atomic(manifest_path, manifest)
        if stale and args.prune:
            pr = AUDIO_DIR / "_pruned"
            for lid in stale:
                f = AUDIO_DIR / manifest[lid].get("file", "")
                if f.is_file():
                    (pr / f.parent.name).mkdir(parents=True, exist_ok=True)
                    os.replace(f, pr / f.parent.name / f.name)
                del manifest[lid]
            save_json_atomic(manifest_path, manifest)
            log(f"pruned {len(stale)} clip(s) of removed lines into audio/_pruned/")
            stale = []

    skipped = [l for l in todo_all if not args.force and existing_audio(l, manifest)]
    todo = [l for l in todo_all if args.force or not existing_audio(l, manifest)]
    if args.limit is not None:
        todo = todo[:max(0, args.limit)]

    if args.mock:
        info = {"path": "mock", "name": "mock", "type": "mock", "size": None, "complete": True}
    else:
        info = resolve_model(args.model)
    mode = {"custom_voice": "custom_voice", "voice_design": "voice_design", "base": "clone",
            "mock": "mock"}.get(info.get("type"), "unknown")
    can_instruct = instruct_supported(info) if mode != "mock" else False

    log(f"lines: {len(lines)} in lines.json, {len(todo_all)} selected, {len(skipped)} already have audio"
        f"{' (kept; --force to redo)' if skipped else ''}, {len(todo)} to generate")
    if stale:
        log(f"note: {len(stale)} clip(s) in the manifest belong to lines no longer in the game (--prune)")
    if mode == "custom_voice" and not can_instruct:
        log("note: 0.6B CustomVoice ignores instructions (qwen-tts drops `instruct` for 0b6). Emotions and "
            "style fall back to the preset voice plus speed / pitch_semitones / gain_db from voices.json.")
    if mode == "clone":
        log("note: Base models clone a reference voice and take no instructions; emotion comes from "
            "refs/<speaker>.<emotion>.wav if present, plus speed / gain_db.")

    if args.dry_run:
        log(f"\nmodel: {info['path']}  mode: {mode}  instructions: {'yes' if can_instruct else 'no'}\n")
        for l in todo:
            s = line_settings(l, voices, mode if mode != "mock" else "custom_voice", can_instruct)
            voice = s["preset"] if mode in ("custom_voice", "mock") else (
                "designed" if mode == "voice_design" else f"refs/{l['speaker']}.wav")
            extra = []
            if abs(s["pitch"]) > 0.05:
                extra.append(f"pitch {s['pitch']:+g}")
            if abs(s["speed"] - 1) > 0.01:
                extra.append(f"speed {s['speed']:.2f}")
            if s["gain_db"]:
                extra.append(f"gain {s['gain_db']:+g} dB")
            log(f"{l['id']} {l['speaker']:<8} {l['emotion']:<8} {voice:<9} {' '.join(extra):<24} {l['say'][:60]}")
            if s["instruct"]:
                log(f"{'':9}instruct: {s['instruct'][:150]}")
        return 0

    if not todo:
        log("nothing to do")
        return 0

    writer = Writer(args.format, args.mp3_level)

    # Base (clone) models need a reference clip per speaker; make missing ones
    # with --ref-model first, so only one model is in memory at a time.
    def missing_refs() -> List[str]:
        need = sorted({l["speaker"] for l in todo})
        return [s for s in need if not (REFS_DIR / f"{s}.wav").is_file()]

    if mode == "clone" and args.ref_model and missing_refs():
        log(f"creating reference voices for: {', '.join(missing_refs())}")
        make_refs(missing_refs(), voices, resolve_model(args.ref_model), args)

    engine = Engine(info, args.device, args.dtype, mock=args.mock)
    if not args.mock:
        mode = engine.mode
        can_instruct = instruct_supported(engine.info)
    model_name = engine.info.get("name", "mock")

    unclonable: set = set()
    if mode == "clone" and missing_refs():
        unclonable = set(missing_refs())
        log(f"warning: no refs/<speaker>.wav for {', '.join(sorted(unclonable))}; their lines are skipped. "
            "Record 10-20 s of the voice (plus the words in refs/<speaker>.txt), or pass --ref-model "
            "with a CustomVoice/VoiceDesign model to create them.")

    stats: Dict[str, Dict[str, float]] = {}
    for l in skipped:
        stats.setdefault(l["speaker"], {"new": 0, "kept": 0, "failed": 0, "sec": 0.0})["kept"] += 1
    notes: set = set()
    warnings: List[str] = []
    warned_presets: set = set()
    t_start = time.time()
    interrupted = False
    try:
        for n, l in enumerate(todo, 1):
            st = stats.setdefault(l["speaker"], {"new": 0, "kept": 0, "failed": 0, "sec": 0.0})
            if l["speaker"] in unclonable:
                st["failed"] += 1
                continue
            s = line_settings(l, voices, mode if mode != "mock" else "custom_voice", can_instruct)
            prof = voices["speakers"][l["speaker"]]
            seed = (fnv1a32(l["id"].encode()) + args.seed) % (2 ** 31)
            t0 = time.time()
            try:
                if mode == "mock":
                    wav, sr = mock_wave(l)
                else:
                    prompt = None
                    if mode == "custom_voice":
                        s["preset"] = engine.pick_preset(l["speaker"], prof, warned_presets)
                    elif mode == "clone":
                        prompt = engine.clone_prompt(l["speaker"], l.get("emotion", "neutral"))
                    wav, sr = engine.synth(l["say"], s, seed, prompt)
                y = postprocess(to_mono_float(wav), sr, s["speed"], s["pitch"], s["gain_db"],
                                not args.no_trim, notes)
                old = existing_audio(l, manifest)
                path = writer.write(AUDIO_DIR / l["speaker"] / l["id"], y, sr)
                if old is not None and old != path and old.is_file():
                    old.unlink()  # replaced with --force in another format
            except Exception as e:  # noqa: BLE001 - keep going; the line stays pending
                st["failed"] += 1
                log(f"[{n}/{len(todo)}] {l['id']} {l['speaker']}: FAILED: {e}")
                continue
            dur = len(y) / sr
            exp = expected_seconds(l["say"])
            entry = {
                "file": path.relative_to(AUDIO_DIR).as_posix(), "dur": round(dur, 3),
                "speaker": l["speaker"], "model": model_name, "text_hash": l["id"],
                "mode": mode, "emotion": l.get("emotion", "neutral"), "voice": s["preset"] or mode,
                "instruct": bool(s["instruct"]), "seed": seed, "say": l["say"],
                "created": time.strftime("%Y-%m-%dT%H:%M:%S"), "bytes": path.stat().st_size,
            }
            if dur > 2.5 * exp + 2 or dur < 0.3 * exp:
                entry["check"] = f"duration {dur:.1f}s, expected ~{exp:.1f}s"
                warnings.append(f"{l['id']} {l['speaker']}: {entry['check']} — listen, redo with --seed")
            manifest[l["id"]] = entry
            save_json_atomic(manifest_path, manifest)
            st["new"] += 1
            st["sec"] += dur
            log(f"[{n}/{len(todo)}] {l['id']} {l['speaker']:<8} {l['emotion']:<8} {dur:5.1f}s "
                f"({time.time() - t0:4.1f}s) {path.suffix[1:]}  {l['say'][:50]}")
    except KeyboardInterrupt:
        interrupted = True
        log("\ninterrupted — the manifest is saved; run the same command again to continue")

    log(f"\n{'speaker':<9} {'new':>4} {'kept':>5} {'failed':>6} {'audio s':>8}")
    for spk, st in sorted(stats.items()):
        log(f"{spk:<9} {int(st['new']):>4} {int(st['kept']):>5} {int(st['failed']):>6} {st['sec']:>8.1f}")
    total_new = sum(int(st["new"]) for st in stats.values())
    log(f"generated {total_new} clip(s) in {time.time() - t_start:.0f}s with {model_name} ({mode}); "
        f"manifest: {manifest_path}")
    for n_ in sorted(notes):
        log(f"note: {n_}")
    if warnings:
        log("check these (unusual length — possible repeat or cut-off):")
        for w in warnings:
            log(f"  {w}")
    log("next: python games/expedition-d05/web/build.py")
    if interrupted:
        return 130
    return 1 if any(st["failed"] for st in stats.values()) else 0


if __name__ == "__main__":
    sys.exit(main())
