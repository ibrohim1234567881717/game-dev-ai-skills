#!/usr/bin/env python3
"""Extract every voiced dialogue line of UMBRA into voice/lines.json.

    python games/expedition-d05/web/voice/extract_lines.py
    python games/expedition-d05/web/voice/extract_lines.py --selftest

Scans web/src/*.js for the two forms the game uses to show dialogue:

* object form, anywhere:   { who: 'Лена (рация)', text: 'Итан, ...', dur: 3 }
  (keys in any order, extra keys allowed, '...' "..." or `...` strings)
* array form, prologue:    ['Хальм', 'Доброе утро. ...', 4]

Template literals with ${...} are skipped: their text is not known until the
game runs. Stdlib only.

The line id is the contract with the game runtime:

    id = FNV-1a 32-bit over UTF-8(speakerKey + '|' + text), 8 lowercase hex

where text is the exact JS string value of `text` (escapes decoded) and
speakerKey comes from voices.json -> who_map (see speaker_key()).
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import unittest
from pathlib import Path
from typing import Dict, List, Optional, Tuple

VOICE_DIR = Path(__file__).resolve().parent
WEB_DIR = VOICE_DIR.parent
SRC_DIR = WEB_DIR / "src"
VOICES_JSON = VOICE_DIR / "voices.json"
LINES_JSON = VOICE_DIR / "lines.json"

FNV_OFFSET = 0x811C9DC5
FNV_PRIME = 0x01000193


# --------------------------------------------------------------------------
# Hash (must match the JS side byte for byte)
# --------------------------------------------------------------------------

def js_utf8(s: str) -> bytes:
    """UTF-8 bytes of a JS string, as TextEncoder would produce them.

    Surrogate pairs that came from \\uD83D\\uDE00-style escapes are combined;
    a lone surrogate becomes U+FFFD, exactly like TextEncoder.
    """
    try:
        return s.encode("utf-8")
    except UnicodeEncodeError:
        fixed = s.encode("utf-16-le", "surrogatepass").decode("utf-16-le", "replace")
        return fixed.encode("utf-8")


def fnv1a32(data: bytes) -> int:
    h = FNV_OFFSET
    for b in data:
        h ^= b
        h = (h * FNV_PRIME) & 0xFFFFFFFF
    return h


def fnv1a_hex(s: str) -> str:
    return "%08x" % fnv1a32(js_utf8(s))


def line_id(speaker: str, text: str) -> str:
    return fnv1a_hex(speaker + "|" + text)


# --------------------------------------------------------------------------
# A small JS lexer: enough to find string literals reliably
# --------------------------------------------------------------------------

class Tok:
    __slots__ = ("kind", "value", "line", "subst")

    def __init__(self, kind: str, value, line: int, subst: bool = False):
        self.kind = kind      # str | tpl | num | id | p | regex | group
        self.value = value    # decoded string for str/tpl, text otherwise
        self.line = line
        self.subst = subst    # template literal contained ${...}

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"Tok({self.kind},{self.value!r},{self.line})"


_ID_START = re.compile(r"[A-Za-z_$\u0080-￿]")
_ID_BODY = re.compile(r"[A-Za-z0-9_$\u0080-￿]*")
_NUM = re.compile(
    r"0[xX][0-9a-fA-F_]+n?|0[bB][01_]+n?|0[oO][0-7_]+n?"
    r"|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?n?"
)
# after these a '/' starts a regex literal, not a division
_REGEX_AFTER_P = set("([{,;:=!&|?+-*%<>~^}")
_REGEX_AFTER_KW = {
    "return", "typeof", "instanceof", "in", "of", "new", "delete", "void",
    "throw", "case", "do", "else", "yield", "await",
}
_SIMPLE_ESC = {"n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f", "v": "\v"}


class JSLexer:
    def __init__(self, src: str):
        self.s = src
        self.i = 0
        self.line = 1
        self.warnings: List[str] = []

    # -- helpers ----------------------------------------------------------
    def _peek(self, k: int = 0) -> str:
        j = self.i + k
        return self.s[j] if j < len(self.s) else ""

    def _adv(self, n: int = 1) -> None:
        for _ in range(n):
            if self.i < len(self.s):
                if self.s[self.i] == "\n":
                    self.line += 1
                self.i += 1

    def _escape(self) -> str:
        """Decode one escape; self.i points just after the backslash."""
        c = self._peek()
        if c == "":
            return ""
        if c == "\r":
            self._adv()
            if self._peek() == "\n":
                self._adv()
            return ""
        if c in ("\n", " ", " "):
            self._adv()
            return ""
        if c in _SIMPLE_ESC:
            self._adv()
            return _SIMPLE_ESC[c]
        if c == "0" and not self._peek(1).isdigit():
            self._adv()
            return "\0"
        if c == "x":
            h = self.s[self.i + 1:self.i + 3]
            if re.fullmatch(r"[0-9a-fA-F]{2}", h):
                self._adv(3)
                return chr(int(h, 16))
        if c == "u":
            if self._peek(1) == "{":
                end = self.s.find("}", self.i + 2)
                h = self.s[self.i + 2:end] if end != -1 else ""
                if re.fullmatch(r"[0-9a-fA-F]{1,6}", h):
                    self._adv(end + 1 - self.i)
                    return chr(int(h, 16))
            else:
                h = self.s[self.i + 1:self.i + 5]
                if re.fullmatch(r"[0-9a-fA-F]{4}", h):
                    self._adv(5)
                    return chr(int(h, 16))
        self._adv()
        return c  # \' \" \\ \` \$ and unknown escapes: the char itself

    def _string(self, q: str) -> Tok:
        line = self.line
        self._adv()  # opening quote
        out = []
        while True:
            c = self._peek()
            if c == "":
                self.warnings.append(f"line {line}: unterminated string")
                break
            if c == q:
                self._adv()
                break
            if c == "\n":
                self.warnings.append(f"line {line}: newline inside a string literal")
                break
            if c == "\\":
                self._adv()
                out.append(self._escape())
                continue
            out.append(c)
            self._adv()
        return Tok("str", _combine_surrogates("".join(out)), line)

    def _template(self) -> Tok:
        line = self.line
        self._adv()  # opening backtick
        out = []
        subst = False
        while True:
            c = self._peek()
            if c == "":
                self.warnings.append(f"line {line}: unterminated template literal")
                break
            if c == "`":
                self._adv()
                break
            if c == "\\":
                self._adv()
                out.append(self._escape())
                continue
            if c == "$" and self._peek(1) == "{":
                subst = True
                self._adv(2)
                self._skip_expression()
                continue
            if c == "\r":  # template literals normalise CRLF / CR to LF
                self._adv()
                if self._peek() == "\n":
                    self._adv()
                out.append("\n")
                continue
            out.append(c)
            self._adv()
        return Tok("tpl", _combine_surrogates("".join(out)), line, subst)

    def _skip_expression(self) -> None:
        """Skip a ${...} body up to its matching '}'."""
        depth = 0
        prev: Optional[Tok] = None
        while True:
            t = self.next_token(prev)
            if t is None:
                return
            if t.kind == "p" and t.value in "{":
                depth += 1
            elif t.kind == "p" and t.value == "}":
                if depth == 0:
                    return
                depth -= 1
            prev = t

    def _regex(self) -> Tok:
        line = self.line
        start = self.i
        self._adv()  # opening '/'
        in_class = False
        while True:
            c = self._peek()
            if c == "" or c == "\n":
                break
            if c == "\\":
                self._adv(2)
                continue
            if c == "[":
                in_class = True
            elif c == "]":
                in_class = False
            elif c == "/" and not in_class:
                self._adv()
                break
            self._adv()
        while re.match(r"[A-Za-z]", self._peek() or " "):
            self._adv()
        return Tok("regex", self.s[start:self.i], line)

    # -- main entry -------------------------------------------------------
    def next_token(self, prev: Optional[Tok]) -> Optional[Tok]:
        s = self.s
        while True:
            c = self._peek()
            if c == "":
                return None
            if c in " \t\r\n﻿   ":
                self._adv()
                continue
            if c == "/" and self._peek(1) == "/":
                while self._peek() not in ("", "\n"):
                    self._adv()
                continue
            if c == "/" and self._peek(1) == "*":
                end = s.find("*/", self.i + 2)
                end = len(s) if end == -1 else end + 2
                self._adv(end - self.i)
                continue
            break
        line = self.line
        if c in ("'", '"'):
            return self._string(c)
        if c == "`":
            return self._template()
        if c == "/":
            regex_ok = (
                prev is None
                or (prev.kind == "p" and prev.value in _REGEX_AFTER_P)
                or (prev.kind == "id" and prev.value in _REGEX_AFTER_KW)
            )
            if regex_ok:
                return self._regex()
        if c.isdigit() or (c == "." and self._peek(1).isdigit()):
            m = _NUM.match(s, self.i)
            if m and m.end() > self.i:
                self._adv(m.end() - self.i)
                return Tok("num", m.group(0), line)
        if _ID_START.match(c):
            m = _ID_BODY.match(s, self.i + 1)
            end = m.end() if m else self.i + 1
            word = s[self.i:end]
            self._adv(end - self.i)
            return Tok("id", word, line)
        if s.startswith("...", self.i):
            self._adv(3)
            return Tok("p", "...", line)
        self._adv()
        return Tok("p", c, line)

    def tokens(self) -> List[Tok]:
        out: List[Tok] = []
        prev = None
        while True:
            t = self.next_token(prev)
            if t is None:
                return out
            out.append(t)
            prev = t


def _combine_surrogates(s: str) -> str:
    if not any("\ud800" <= ch <= "\udfff" for ch in s):
        return s
    return s.encode("utf-16-le", "surrogatepass").decode("utf-16-le", "replace")


# --------------------------------------------------------------------------
# Finding dialogue in the token stream
# --------------------------------------------------------------------------

_DYNAMIC = object()   # value exists but is not a plain literal
_TEMPLATE = object()  # value is a template literal with ${...}

# key pairs that make an object a dialogue line; voices.json can add more
DEFAULT_KEY_PAIRS = [("who", "text")]


def _literal_value(toks: List[Tok]):
    """'a' / "a" / `a` / 'a' + 'b' -> the string; anything else -> marker."""
    if not toks:
        return _DYNAMIC
    parts = []
    for n, t in enumerate(toks):
        if n % 2 == 1:
            if not (t.kind == "p" and t.value == "+"):
                return _DYNAMIC
            continue
        if t.kind == "tpl" and t.subst:
            return _TEMPLATE
        if t.kind not in ("str", "tpl"):
            return _DYNAMIC
        parts.append(t.value)
    if len(toks) % 2 == 0:
        return _DYNAMIC
    return "".join(parts)


def _find_ternary(toks: List[Tok]) -> Optional[Tuple[int, int]]:
    """Indices of the top-level '?' and its ':' in `c ? a : b`, if any."""
    qi, depth = None, 0
    for i, t in enumerate(toks):
        if t.kind != "p":
            continue
        if t.value == "?":
            nxt = toks[i + 1] if i + 1 < len(toks) else None
            prv = toks[i - 1] if i else None
            if nxt is not None and nxt.kind == "p" and nxt.value in (".", "?"):
                continue  # ?. or the first half of ??
            if prv is not None and prv.kind == "p" and prv.value == "?":
                continue  # second half of ??
            if qi is None:
                qi = i
            else:
                depth += 1
        elif t.value == ":" and qi is not None:
            if depth == 0:
                return qi, i
            depth -= 1
    return None


def _alternatives(toks: List[Tok]) -> Tuple[List[str], Optional[str]]:
    """Every string an expression can evaluate to, if it is made of literals.

    Returns (strings, problem): problem is None when every branch is a
    literal, else 'template' or 'dynamic' (strings may still be non-empty
    for `cond ? 'literal' : someVariable`).
    """
    v = _literal_value(toks)
    if isinstance(v, str):
        return [v], None
    tern = _find_ternary(toks)
    if tern is not None:
        qi, ci = tern
        a, pa = _alternatives(toks[qi + 1:ci])
        b, pb = _alternatives(toks[ci + 1:])
        return a + b, pa or pb
    # x || 'fallback', x ?? 'fallback': the literal side is a possible value
    for i in range(1, len(toks)):
        a, b = toks[i - 1], toks[i]
        if a.kind == b.kind == "p" and a.value == b.value and a.value in "|?":
            left, pl = _alternatives(toks[:i - 1])
            right, pr = _alternatives(toks[i + 1:])
            return left + right, pl or pr
    return [], "template" if v is _TEMPLATE else "dynamic"


def _table_ref(toks: List[Tok]) -> Optional[str]:
    """`NAME[key]` -> 'NAME' (a lookup into a table of lines)."""
    if len(toks) == 2 and toks[0].kind == "id" and toks[1].kind == "group" and toks[1].value == "[":
        return toks[0].value
    return None


def _number_value(toks: List[Tok]) -> Optional[float]:
    if len(toks) == 2 and toks[0].kind == "p" and toks[0].value == "-" and toks[1].kind == "num":
        toks = toks[1:]
    if len(toks) == 1 and toks[0].kind == "num":
        try:
            return float(toks[0].value.replace("_", "").rstrip("n"))
        except ValueError:
            return None
    return None


class Candidate:
    __slots__ = ("who", "text", "line", "form", "skip")

    def __init__(self, who, text, line, form, skip=None):
        self.who, self.text, self.line, self.form, self.skip = who, text, line, form, skip


def find_candidates(src: str, key_pairs=None) -> Tuple[List[Candidate], List[str]]:
    """Return raw (who, text) pairs in source order, plus lexer warnings.

    Handles literal values, 'a' + 'b', `c ? 'a' : 'b'` (every branch), and
    `text: NAME[key]` where NAME is an object/array of strings assigned in the
    same file (`const NAME = { k: '...' }`).
    """
    key_pairs = [tuple(p) for p in (key_pairs or DEFAULT_KEY_PAIRS)]
    lexer = JSLexer(src)
    toks = lexer.tokens()
    found: List[Candidate] = []
    tables: Dict[str, List[Tuple[str, int]]] = {}
    table_refs: List[Tuple[str, str, int]] = []   # (who, NAME, line)

    # frame: [opener, elements(list of token lists), current(list), name]
    stack: List[list] = [["root", [], [], None]]
    closers = {"}": "{", "]": "[", ")": "("}

    def close_frame(frame) -> None:
        opener, elements, current, name = frame
        if current:
            elements.append(current)
        if opener == "{":
            pairs: Dict[str, List[Tok]] = {}
            for el in elements:
                if len(el) >= 2 and el[0].kind in ("id", "str") and el[1].kind == "p" and el[1].value == ":":
                    pairs.setdefault(el[0].value, el[2:] or [el[0]])
                elif len(el) == 1 and el[0].kind == "id":
                    pairs.setdefault(el[0].value, el)  # shorthand { who, text }
            for wk, tk in key_pairs:
                if tk not in pairs:
                    continue
                tt = pairs[tk]
                line = tt[0].line
                if wk not in pairs:
                    if (wk, tk) != ("who", "text"):
                        found.append(Candidate(None, None, line, "object", "no_who"))
                    continue
                whos, wp = _alternatives(pairs[wk])
                ref = _table_ref(tt)
                if ref is not None:
                    for w in whos:
                        table_refs.append((w, ref, line))
                    if not whos:
                        found.append(Candidate(None, None, line, "object", wp or "dynamic"))
                    continue
                texts, tp = _alternatives(tt)
                if wp or tp:
                    found.append(Candidate(None, None, line, "object",
                                           "template" if "template" in (wp, tp) else "dynamic"))
                for w in whos:
                    for t in texts:
                        found.append(Candidate(w, t, line, "object", None))
            if name:
                for el in elements:
                    if len(el) >= 3 and el[1].kind == "p" and el[1].value == ":":
                        v = _literal_value(el[2:])
                        if isinstance(v, str):
                            tables.setdefault(name, []).append((v, el[2].line))
        elif opener == "[":
            # ['Хальм', 'text', 4.2] (the prologue's lines() helper). Without
            # the numeric duration, only accept a sentence-like second item,
            # so lookup tables such as ['Хальм', 'halm'] are not dialogue.
            if len(elements) in (2, 3):
                who = _literal_value(elements[0])
                text = _literal_value(elements[1])
                if len(elements) == 3:
                    shape_ok = _number_value(elements[2]) is not None
                else:
                    shape_ok = isinstance(text, str) and bool(
                        re.search(r"\s", text) and re.search(r"[А-Яа-яЁё]", text))
                if isinstance(who, str) and isinstance(text, str) and shape_ok:
                    found.append(Candidate(who, text, elements[1][0].line, "array", None))
            if name:
                for el in elements:
                    v = _literal_value(el)
                    if isinstance(v, str):
                        tables.setdefault(name, []).append((v, el[0].line))

    for t in toks:
        frame = stack[-1]
        if t.kind == "p" and t.value in "{[(":
            cur = frame[2]
            name = None
            if (len(cur) >= 2 and cur[-1].kind == "p" and cur[-1].value == "="
                    and cur[-2].kind == "id"):
                name = cur[-2].value  # const NAME = { ... }
            # the nested group is one opaque token of the parent element
            cur.append(Tok("group", t.value, t.line))
            stack.append([t.value, [], [], name])
            continue
        if t.kind == "p" and t.value in closers:
            if len(stack) > 1 and stack[-1][0] == closers[t.value]:
                close_frame(stack.pop())
            continue
        if t.kind == "p" and t.value == ",":
            if frame[2]:
                frame[1].append(frame[2])
            frame[2] = []
            continue
        if t.kind == "p" and t.value == ";" and frame[0] in ("root", "{"):
            if frame[2]:
                frame[1].append(frame[2])
            frame[2] = []
            continue
        frame[2].append(t)

    for who, name, line in table_refs:
        entries = tables.get(name)
        if not entries:
            found.append(Candidate(None, None, line, "table", "dynamic"))
            continue
        for text, tline in entries:
            found.append(Candidate(who, text, tline, "table", None))
    found.sort(key=lambda c: c.line)  # objects are emitted when they close
    return found, lexer.warnings


# --------------------------------------------------------------------------
# Speaker mapping, cleaning, emotion
# --------------------------------------------------------------------------

def who_base(who: str) -> str:
    """Cut at the first ' (' and drop one leading '[' / trailing ']'.

    Mirrors the JS runtime exactly (web/src/12-voice.js speakerKey):
        i = who.indexOf(' ('); s = i >= 0 ? who.slice(0, i) : who;
        s = s.replace(/^\\[|\\]$/g, '').trim();
    """
    i = who.find(" (")
    s = who[:i] if i >= 0 else who
    return re.sub(r"^\[|\]\Z", "", s).strip()


def speaker_prefixes(who_map: Dict[str, str]) -> List[Tuple[str, str]]:
    """who_map as (prefix, key) pairs, longest prefix first."""
    return sorted(who_map.items(), key=lambda kv: -len(kv[0]))


def speaker_key(who: str, who_map: Dict[str, str]) -> Optional[str]:
    """Longest who_map prefix that who_base(who) starts with, else None."""
    if not who:
        return None
    base = who_base(who)
    for prefix, key in speaker_prefixes(who_map):
        if prefix and base.startswith(prefix):
            return key
    return None


def is_radio(who: str, cfg: dict) -> bool:
    """Mirrors isRadioLine() in 12-voice.js: a radio marker, or a bracketed
    recording ('[Мара Линд]', '[Эфир · закрытый канал]', ...)."""
    radio = cfg.get("radio", {})
    if any(m in who for m in radio.get("markers", [])):
        return True
    return bool(radio.get("bracketed_is_recording", True)) and who.startswith("[")


_TAG = re.compile(r"<[^>]*>")
_LABEL_PREFIX = re.compile(r"^\s*<(em|b|i|strong)>\s*[^<()]{1,40}:\s*</\1>\s*")
_PARENS = re.compile(r"\(([^()]*)\)")


def stage_directions(text: str) -> List[str]:
    plain = html.unescape(_TAG.sub("", _LABEL_PREFIX.sub("", text)))
    return [d.strip() for d in _PARENS.findall(plain) if d.strip()]


def apply_pronounce(s: str, table: Dict[str, str]) -> str:
    for src in sorted(table, key=len, reverse=True):
        pat = r"(?<![0-9A-Za-zА-Яа-яЁё])" + re.escape(src) + r"(?![0-9A-Za-zА-Яа-яЁё])"
        s = re.sub(pat, table[src].replace("\\", "\\\\"), s)
    return s


def clean_say(text: str, pronounce: Optional[Dict[str, str]] = None) -> str:
    """Text for the TTS: no tags, no (stage directions), whitespace collapsed."""
    s = _LABEL_PREFIX.sub(" ", text)          # '<em>Хальм:</em> …' on the closed channel
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = _TAG.sub("", s)
    s = html.unescape(s)
    s = _PARENS.sub(" ", s)
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s+([,.!?…:;»)])", r"\1", s)
    s = re.sub(r"([«(])\s+", r"\1", s)
    s = s.strip().lstrip(",;:").strip()
    if pronounce:
        s = apply_pronounce(s, pronounce)
    return s


def derive_emotion(directions: List[str], say: str, dir_map: Dict[str, str]) -> str:
    for d in directions:
        low = d.lower()
        for key, emo in dir_map.items():
            if key in low:
                return emo
    sentences = [x for x in re.split(r"(?<=[.!?…])\s+", say) if x.strip()]
    n_sent = max(1, len(sentences))
    n_excl = len(re.findall(r"!+", say))
    if n_excl >= 3 or (n_excl >= 2 and n_excl >= 0.6 * n_sent):
        return "shouting"
    if n_excl >= 1 and n_excl >= 0.5 * n_sent:
        return "urgent"
    if "…" in say or "..." in say:
        return "hesitant"
    return "neutral"


# --------------------------------------------------------------------------
# Whole-project extraction
# --------------------------------------------------------------------------

def load_config(path: Path = VOICES_JSON) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def extract(src_dir: Path, cfg: dict) -> Tuple[List[dict], dict]:
    who_map = cfg["who_map"]
    dir_map = cfg.get("directions", {})
    pronounce = cfg.get("pronounce", {})
    overrides = cfg.get("line_overrides", {})
    key_pairs = DEFAULT_KEY_PAIRS + [tuple(p) for p in cfg.get("extra_key_pairs", [])]
    stats = {
        "files": 0, "found": 0, "voiced": 0, "duplicates": 0, "narration": 0,
        "system": 0, "template": 0, "dynamic": 0, "no_who": 0, "empty": 0,
        "unmapped": [], "no_who_at": [], "warnings": [],
    }
    by_id: Dict[str, dict] = {}
    order: List[str] = []
    for js in sorted(src_dir.glob("*.js")):
        stats["files"] += 1
        src = js.read_text(encoding="utf-8")
        cands, warns = find_candidates(src, key_pairs)
        stats["warnings"] += [f"{js.name}: {w}" for w in warns]
        for c in cands:
            stats["found"] += 1
            where = f"{js.name}:{c.line}"
            if c.skip:
                stats[c.skip] += 1
                if c.skip == "no_who":
                    stats["no_who_at"].append(where)
                continue
            who = c.who
            if who.strip() == "":
                stats["narration"] += 1
                continue
            spk = speaker_key(who, who_map)
            if spk is None:
                if who.strip().startswith("["):
                    stats["system"] += 1
                elif c.form != "array":
                    stats["unmapped"].append((who, where))
                continue
            lid = line_id(spk, c.text)
            if lid in by_id:
                stats["duplicates"] += 1
                by_id[lid].setdefault("also", []).append(where)
                continue
            dirs = stage_directions(c.text)
            say = clean_say(c.text, pronounce)
            if not re.search(r"[0-9A-Za-zА-Яа-яЁё]", say):
                stats["empty"] += 1
                continue
            rec = {
                "id": lid,
                "speaker": spk,
                "who": who,
                "text": c.text,
                "say": say,
                "emotion": derive_emotion(dirs, say, dir_map),
                "directions": dirs,
                "radio": is_radio(who, cfg),
                "source": where,
            }
            ov = overrides.get(lid)
            if ov:
                for k in ("say", "emotion"):
                    if k in ov:
                        rec[k] = ov[k]
                rec["override"] = True
            by_id[lid] = rec
            order.append(lid)
    stats["voiced"] = len(order)
    stats["stale_overrides"] = sorted(set(overrides) - set(by_id))
    return [by_id[i] for i in order], stats


def write_lines(lines: List[dict], path: Path) -> None:
    tmp = path.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(lines, f, ensure_ascii=False, indent=1)
        f.write("\n")
    tmp.replace(path)


def report(lines: List[dict], stats: dict, cfg: dict, out: Path) -> None:
    per: Dict[str, List[dict]] = {}
    for l in lines:
        per.setdefault(l["speaker"], []).append(l)
    print(f"scanned {stats['files']} files, {stats['found']} dialogue objects/arrays")
    print(f"voiced lines: {stats['voiced']}  (duplicates merged: {stats['duplicates']})")
    print(f"not voiced: narration {stats['narration']}, system labels {stats['system']}, "
          f"template ${{}} {stats['template']}, dynamic {stats['dynamic']}, "
          f"no speaker {stats['no_who']}, empty after cleaning {stats['empty']}")
    print()
    print(f"  {'speaker':<10} {'lines':>5} {'radio':>5} {'chars':>6}  emotions")
    for spk in list(cfg.get("speakers", {})) + sorted(set(per) - set(cfg.get("speakers", {}))):
        ls = per.get(spk, [])
        if not ls:
            continue
        emos: Dict[str, int] = {}
        for l in ls:
            emos[l["emotion"]] = emos.get(l["emotion"], 0) + 1
        emo_s = ", ".join(f"{k} {v}" for k, v in sorted(emos.items(), key=lambda kv: -kv[1]))
        print(f"  {spk:<10} {len(ls):>5} {sum(l['radio'] for l in ls):>5} "
              f"{sum(len(l['say']) for l in ls):>6}  {emo_s}")
    missing = sorted(set(per) - set(cfg.get("speakers", {})))
    if missing:
        print(f"\nWARNING: speakers without a profile in voices.json: {', '.join(missing)}")
    if stats["unmapped"]:
        print("\nWARNING: `who` values that look like characters but are not in voices.json who_map:")
        for who, where in stats["unmapped"]:
            print(f"  {who!r:<40} {where}")
    if stats["no_who_at"]:
        print("\nWARNING: lines with no literal speaker (add one, e.g. nudgeWho, to voice them): "
              + ", ".join(stats["no_who_at"]))
    if stats["stale_overrides"]:
        print("\nWARNING: line_overrides for ids that no longer exist: " + ", ".join(stats["stale_overrides"]))
    for w in stats["warnings"]:
        print(f"WARNING: {w}")
    print(f"\nwrote {out}")


# --------------------------------------------------------------------------
# Self-test
# --------------------------------------------------------------------------

class SelfTest(unittest.TestCase):
    # reference values produced by the JS implementation
    # (TextEncoder + Math.imul) in Node 22
    def test_fnv_known_vectors(self):
        self.assertEqual(fnv1a_hex(""), "811c9dc5")
        self.assertEqual(fnv1a_hex("a"), "e40c292c")
        self.assertEqual(fnv1a_hex("foobar"), "bf9cf968")

    def test_fnv_cyrillic_matches_js(self):
        self.assertEqual(line_id("halm", "Доброе утро. Кто ещё не проснулся — сейчас проснётся. Это Умбра."), "12fbd71b")
        self.assertEqual(line_id("lena", "<em>(тихо)</em> В восьмидесятых…"), "c3e9d871")
        self.assertEqual(line_id("mara", "«Лена, если ты это слышишь… я знала, что ты прилетишь. "
                                         "Ты всегда приходила туда, куда тебе запрещали»."), "cb4151fa")

    def test_fnv_zero_padding_and_astral(self):
        self.assertEqual(line_id("ethan", 'Он сказал: "стой"\nи ушёл \'сам\' \\ A'), "02ed44d9")
        self.assertEqual(line_id("lena", "smile \U0001F600 ok"), "b08cbd5e")
        # the same emoji written as a surrogate pair escape in JS source
        self.assertEqual(line_id("lena", _combine_surrogates("smile 😀 ok")), "b08cbd5e")

    SNIPPET = r"""
    // { who: 'Лена', text: 'в комментарии — не реплика' }
    /* { who: 'Хальм', text: 'и это тоже' } */
    const re = /['"{]+/g, half = 10 / 2;
    HUD.say([{ who: 'Лена (рация)', text: 'Итан, стой! Не \'двигайся\'.', dur: 3 },
             { text: "Он сказал: \"стой\"\nи ушёл 'сам' \\ A", who: "Итан" }]);
    HUD.say({ dur: 2, who: 'Хальм', text: '<em>(пауза)</em> Они приняли ' + 'неверные решения.' });
    HUD.say([{ who: `[Улика ${n}/8]`, text, dur: 5 }]);
    HUD.say([{ who: 'Лена', text: `Нашла ${count} следов` }]);
    HUD.say([{ who: '', text: '<em>Хальм кивает.</em>' }]);
    HUD.say([{ who: '[Сканер]', text: 'Образец: живой.' }]);
    HUD.say([{ who: 'Незнакомец', text: 'Кто здесь?' }]);
    HUD.say([{ who: '[Эфир · закрытый канал]', text: '<em>Хальм:</em> …три из пяти.' }]);
    HUD.say([{ who: `Лукас`, text: `Держитесь!` }]);
    lines([['Хальм', 'Доброе утро. Это Умбра.', 4], ['Лена', '«Не должно» — в каком смысле?', 2.6]]);
    const MAP = [['Хальм', 'halm'], ['diary', cx + 8, 'x']];
    const tpl = `a ${ { who: 'Лена', text: 'внутри шаблона' }.text } b`;
    const after = { print: 'Отпечатки! Идите по следу.', dung: "Два часа.", n: 3 };
    HUD.say([{ who: 'Лена', text: after[key] }, { who: 'Хальм', text: nope[key] }]);
    HUD.say([{ who: 'Лена (рация)', text: scent ? 'Она вас учуяла!' : a?.b ?? 'Тише!' }]);
    const goals = [{ x: 1, nudge: 'Сюда, Итан.', nudgeWho: 'Лена' }, { nudge: 'Без автора.' }];
    """

    def test_extract_snippet(self):
        cands, warns = find_candidates(self.SNIPPET)
        self.assertEqual(warns, [])
        got = [(c.who, c.text, c.form, c.skip) for c in cands]
        self.assertIn(("Лена (рация)", "Итан, стой! Не 'двигайся'.", "object", None), got)
        self.assertIn(("Итан", "Он сказал: \"стой\"\nи ушёл 'сам' \\ A", "object", None), got)
        self.assertIn(("Хальм", "<em>(пауза)</em> Они приняли неверные решения.", "object", None), got)
        self.assertIn(("Хальм", "Доброе утро. Это Умбра.", "array", None), got)
        self.assertIn(("Лена", "«Не должно» — в каком смысле?", "array", None), got)
        self.assertIn(("Лукас", "Держитесь!", "object", None), got)
        self.assertIn(("Лена", "Отпечатки! Идите по следу.", "table", None), got)
        self.assertIn(("Лена", "Два часа.", "table", None), got)
        self.assertIn(("Лена (рация)", "Она вас учуяла!", "object", None), got)
        self.assertIn(("Лена (рация)", "Тише!", "object", None), got)
        skips = sorted(c.skip for c in cands if c.skip)
        # the ${} who and text, the unresolved nope[key], the `a?.b` branch
        self.assertEqual(skips, ["dynamic", "dynamic", "template", "template"])
        cands2, _ = find_candidates(self.SNIPPET, [("who", "text"), ("nudgeWho", "nudge")])
        got2 = [(c.who, c.text, c.skip) for c in cands2]
        self.assertIn(("Лена", "Сюда, Итан.", None), got2)
        self.assertIn((None, None, "no_who"), got2)
        texts = " ".join(str(c.text) for c in cands)
        self.assertNotIn("комментарии", texts)
        self.assertNotIn("и это тоже", texts)
        self.assertNotIn("внутри шаблона", texts)
        self.assertNotIn("Сюда, Итан.", texts)  # nudge pair not configured here
        self.assertNotIn(("Хальм", "halm"), [(c.who, c.text) for c in cands])

    def test_extract_and_map(self):
        import tempfile
        cfg = {
            "who_map": {"Хальм": "halm", "Лена": "lena", "Итан": "ethan", "Лукас": "lucas",
                        "Эфир · закрытый канал": "halm"},
            "radio": {"markers": ["(рация)"], "bracketed_is_recording": True},
            "directions": {"пауза": "hesitant"},
            "pronounce": {},
        }
        with tempfile.TemporaryDirectory() as d:
            Path(d, "10-test.js").write_text(self.SNIPPET, encoding="utf-8")
            lines, stats = extract(Path(d), cfg)
        by_text = {l["text"]: l for l in lines}
        radio_line = by_text["Итан, стой! Не 'двигайся'."]
        self.assertEqual(radio_line["speaker"], "lena")
        self.assertTrue(radio_line["radio"])
        self.assertEqual(radio_line["id"], line_id("lena", "Итан, стой! Не 'двигайся'."))
        self.assertEqual(radio_line["emotion"], "urgent")
        pause = by_text["<em>(пауза)</em> Они приняли неверные решения."]
        self.assertEqual(pause["say"], "Они приняли неверные решения.")
        self.assertEqual(pause["emotion"], "hesitant")
        self.assertFalse(pause["radio"])
        eth = by_text["<em>Хальм:</em> …три из пяти."]
        self.assertEqual((eth["speaker"], eth["say"], eth["radio"]), ("halm", "…три из пяти.", True))
        self.assertEqual(stats["narration"], 1)
        self.assertEqual(stats["system"], 1)
        self.assertEqual(stats["template"], 2)
        self.assertEqual([w for w, _ in stats["unmapped"]], ["Незнакомец"])
        self.assertNotIn("halm", by_text)

    def test_speaker_key(self):
        cfg = load_config()
        m = cfg["who_map"]
        cases = {
            "Лена (рация)": "lena", "Хальм": "halm", "Варн (запись, 1998)": "varn",
            "[Мара Линд · последняя запись · 2019]": "mara", "[Мара Линд]": "mara",
            "[Дневник D-04 · Мара Линд]": "mara", "[Бортовой самописец D-02 · 2006]": "d02pilot",
            "[Эфир · закрытый канал]": "halm", "Кесслер (спутниковый канал)": "kessler",
            "Нора (интерком)": "nora", "[Сканер]": None, "[Улика 3/8]": None, "": None,
            "[Журнал D-03 · 2011]": None, "Бортовой самописец D-02 · 2007": "d02pilot",
            "[Лена]": "lena", "Лена ": "lena",
        }
        for who, want in cases.items():
            self.assertEqual(speaker_key(who, m), want, who)

    def test_clean_and_emotion(self):
        d = {"шёпотом": "whisper", "тихо": "quiet", "вдыхает": "breath"}
        self.assertEqual(clean_say("<em>(шёпотом)</em> Не  двигайся…  Она <b>рядом</b>."),
                         "Не двигайся… Она рядом.")
        self.assertEqual(derive_emotion(["шёпотом"], "Не двигайся…", d), "whisper")
        self.assertEqual(derive_emotion([], "Бегом! Сейчас же! Все к двери!", d), "shouting")
        self.assertEqual(derive_emotion([], "Следопыт! Никто не летал. Там приборы сходят с ума.", d), "neutral")
        self.assertEqual(derive_emotion([], "Предыдущие… исследование было прекращено.", d), "hesitant")
        self.assertEqual(clean_say("Это D-04, а не D-040.", {"D-04": "Дэ-ноль-четыре"}),
                         "Это Дэ-ноль-четыре, а не D-040.")
        self.assertEqual(clean_say("«Цитата» &laquo;ok&raquo; (шорох бумаги)"), "«Цитата» «ok»")


def run_selftest() -> int:
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(SelfTest)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


def main(argv=None) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    ap = argparse.ArgumentParser(description="Extract voiced UMBRA lines into voice/lines.json")
    ap.add_argument("--src", type=Path, default=SRC_DIR, help="folder with the game's *.js (default: web/src)")
    ap.add_argument("--voices", type=Path, default=VOICES_JSON, help="voices.json with who_map")
    ap.add_argument("--out", type=Path, default=LINES_JSON, help="output lines.json")
    ap.add_argument("--selftest", action="store_true", help="run the built-in tests and exit")
    args = ap.parse_args(argv)
    if args.selftest:
        return run_selftest()
    cfg = load_config(args.voices)
    lines, stats = extract(args.src, cfg)
    write_lines(lines, args.out)
    report(lines, stats, cfg, args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
