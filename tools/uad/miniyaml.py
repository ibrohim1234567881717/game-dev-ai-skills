"""Zero-dependency YAML subset parser.

The toolkit must run on a bare Python install, so it cannot assume PyYAML is
present. When PyYAML *is* importable we defer to it (more robust on files we
did not author). Otherwise this module parses the strict subset the toolkit
uses:

    * block mappings, nested by indentation
    * block sequences (``- item``), of scalars or mappings
    * flow sequences ``[a, b]`` and flow mappings ``{a: b}``
    * single/double quoted and plain scalars
    * block scalars ``|`` and ``>``
    * ``#`` comments, ``null``/``~``, booleans, ints, floats

Anything outside that subset raises YamlError rather than guessing.
"""

from __future__ import annotations

import re
from typing import Any

__all__ = ["safe_load", "YamlError", "USING_PYYAML"]


class YamlError(ValueError):
    """Raised when the document uses syntax outside the supported subset."""


try:  # pragma: no cover - depends on the host environment
    import yaml as _pyyaml

    USING_PYYAML = True
except ImportError:  # pragma: no cover
    _pyyaml = None
    USING_PYYAML = False


_INT_RE = re.compile(r"^[+-]?\d+$")
_FLOAT_RE = re.compile(r"^[+-]?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$")
_KEY_RE = re.compile(r'^(?P<key>(?:"[^"]*"|\'[^\']*\'|[^:#]+?))\s*:(?:\s+(?P<val>.*))?$')


def safe_load(text: str) -> Any:
    """Parse a YAML document, returning dict/list/scalar (``None`` when empty)."""
    if USING_PYYAML:  # pragma: no cover
        return _pyyaml.safe_load(text)
    lines = _tokenize(text)
    if not lines:
        return None
    value, index = _parse_block(lines, 0, lines[0][0])
    if index != len(lines):
        raise YamlError("unexpected content at line %d" % lines[index][2])
    return value


# --------------------------------------------------------------------------- #
# tokenizing
# --------------------------------------------------------------------------- #

def _tokenize(text: str) -> list:
    """Return (indent, content, line_number) for every significant line."""
    out = []
    raw_lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    for lineno, raw in enumerate(raw_lines, start=1):
        if raw.strip().startswith("#"):
            continue
        stripped = _strip_comment(raw)
        if not stripped.strip():
            continue
        leading = stripped[: len(stripped) - len(stripped.lstrip(" \t"))]
        if "\t" in leading:
            raise YamlError("tab used for indentation on line %d" % lineno)
        out.append((len(leading), stripped.strip(), lineno))
    return out


def _strip_comment(line: str) -> str:
    """Remove a trailing ``#`` comment that is not inside quotes."""
    in_single = in_double = False
    for i, ch in enumerate(line):
        if ch == "'" and not in_double:
            in_single = not in_single
        elif ch == '"' and not in_single:
            in_double = not in_double
        elif ch == "#" and not in_single and not in_double:
            if i == 0 or line[i - 1] in " \t":
                return line[:i]
    return line


# --------------------------------------------------------------------------- #
# parsing
# --------------------------------------------------------------------------- #

def _parse_block(lines, index: int, indent: int):
    if index >= len(lines):
        return None, index
    content = lines[index][1]
    if content == "-" or content.startswith("- "):
        return _parse_sequence(lines, index, indent)
    return _parse_mapping(lines, index, indent)


def _parse_sequence(lines, index: int, indent: int):
    items = []
    while index < len(lines):
        line_indent, content, lineno = lines[index]
        if line_indent < indent:
            break
        if line_indent > indent:
            raise YamlError("unexpected indentation on line %d" % lineno)
        if not (content == "-" or content.startswith("- ")):
            break
        rest = content[1:].strip()
        index += 1
        if not rest:
            child, index = _parse_child(lines, index, indent)
            items.append(child)
            continue
        match = _KEY_RE.match(rest)
        if match and not _looks_like_scalar(rest):
            # "- key: value" opens an inline mapping owned by this item.
            item_indent = line_indent + 2
            synthetic = [(item_indent, rest, lineno)]
            end = index
            while end < len(lines) and lines[end][0] > line_indent:
                synthetic.append(lines[end])
                end += 1
            value, consumed = _parse_mapping(synthetic, 0, item_indent)
            if consumed != len(synthetic):
                raise YamlError("could not parse sequence item on line %d" % lineno)
            items.append(value)
            index = end
        else:
            items.append(_parse_scalar(rest, lineno))
    return items, index


def _parse_mapping(lines, index: int, indent: int):
    mapping = {}
    while index < len(lines):
        line_indent, content, lineno = lines[index]
        if line_indent < indent:
            break
        if line_indent > indent:
            raise YamlError("unexpected indentation on line %d" % lineno)
        if content.startswith("- "):
            break
        match = _KEY_RE.match(content)
        if not match:
            raise YamlError("expected 'key: value' on line %d: %r" % (lineno, content))
        key = _parse_scalar(match.group("key").strip(), lineno)
        raw_value = (match.group("val") or "").strip()
        index += 1
        if raw_value in ("|", "|-", ">", ">-", "|+", ">+"):
            value, index = _parse_block_scalar(lines, index, line_indent, raw_value)
        elif raw_value == "":
            value, index = _parse_child(lines, index, line_indent)
        else:
            value = _parse_scalar(raw_value, lineno)
        mapping[str(key)] = value
    return mapping, index


def _parse_child(lines, index: int, parent_indent: int):
    """Parse the nested block belonging to a key/sequence entry, else None."""
    if index >= len(lines) or lines[index][0] <= parent_indent:
        return None, index
    return _parse_block(lines, index, lines[index][0])


def _parse_block_scalar(lines, index: int, parent_indent: int, style: str):
    chunks = []
    while index < len(lines) and lines[index][0] > parent_indent:
        chunks.append(lines[index][1])
        index += 1
    joined = "\n".join(chunks) if style.startswith("|") else " ".join(chunks)
    if style.startswith("|") and not style.endswith("-"):
        joined += "\n"
    return joined, index


def _looks_like_scalar(text: str) -> bool:
    """True when 'a: b' should be read as a plain string (e.g. a URL)."""
    return text.startswith(("'", '"', "[", "{")) or "://" in text.split(":")[0]


def _parse_scalar(token: str, lineno: int) -> Any:
    token = token.strip()
    if not token:
        return None
    if len(token) >= 2 and token.startswith('"') and token.endswith('"'):
        return _unescape(token[1:-1])
    if len(token) >= 2 and token.startswith("'") and token.endswith("'"):
        return token[1:-1].replace("''", "'")
    if token.startswith("[") and token.endswith("]"):
        return [_parse_scalar(p, lineno) for p in _split_flow(token[1:-1])]
    if token.startswith("{") and token.endswith("}"):
        result = {}
        for part in _split_flow(token[1:-1]):
            if not part:
                continue
            if ":" not in part:
                raise YamlError("malformed flow mapping on line %d" % lineno)
            key, _, val = part.partition(":")
            result[str(_parse_scalar(key, lineno))] = _parse_scalar(val, lineno)
        return result
    lowered = token.lower()
    if lowered in ("null", "~"):
        return None
    if lowered in ("true", "yes", "on"):
        return True
    if lowered in ("false", "no", "off"):
        return False
    if _INT_RE.match(token):
        return int(token)
    if _FLOAT_RE.match(token):
        return float(token)
    return token


def _split_flow(body: str) -> list:
    parts = []
    depth = 0
    current = []
    in_single = in_double = False
    for ch in body:
        if ch == "'" and not in_double:
            in_single = not in_single
        elif ch == '"' and not in_single:
            in_double = not in_double
        if not in_single and not in_double:
            if ch in "[{":
                depth += 1
            elif ch in "]}":
                depth -= 1
            elif ch == "," and depth == 0:
                parts.append("".join(current).strip())
                current = []
                continue
        current.append(ch)
    tail = "".join(current).strip()
    if tail:
        parts.append(tail)
    return parts


def _unescape(text: str) -> str:
    return (
        text.replace('\\"', '"')
        .replace("\\n", "\n")
        .replace("\\t", "\t")
        .replace("\\\\", "\\")
    )
