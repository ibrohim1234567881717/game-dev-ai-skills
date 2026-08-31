"""Tests for the zero-dependency YAML subset parser."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

from uad import miniyaml  # noqa: E402


def test_flat_mapping():
    doc = miniyaml.safe_load("name: unreal-performance\ncount: 3\nready: true\n")
    assert doc == {"name": "unreal-performance", "count": 3, "ready": True}


def test_quoted_scalars_keep_colons_and_hashes():
    doc = miniyaml.safe_load('description: "Profile first: never guess # really"\n')
    assert doc["description"] == "Profile first: never guess # really"


def test_comments_are_stripped_outside_quotes():
    doc = miniyaml.safe_load("name: a  # trailing comment\n# whole line\nvalue: 1\n")
    assert doc == {"name": "a", "value": 1}


def test_nested_mapping():
    doc = miniyaml.safe_load(
        "metadata:\n  uad-layer: platform\n  uad-version: '1.0.0'\ntop: 1\n"
    )
    assert doc["metadata"] == {"uad-layer": "platform", "uad-version": "1.0.0"}
    assert doc["top"] == 1


def test_flow_sequence_and_mapping():
    doc = miniyaml.safe_load("tags: [a, b, c]\npair: {x: 1, y: two}\n")
    assert doc["tags"] == ["a", "b", "c"]
    assert doc["pair"] == {"x": 1, "y": "two"}


def test_block_sequence_of_mappings():
    doc = miniyaml.safe_load(
        "signals:\n"
        "  - glob: '*.uproject'\n"
        "    weight: 100\n"
        "  - glob: 'Source/'\n"
        "    weight: 30\n"
    )
    assert doc["signals"] == [
        {"glob": "*.uproject", "weight": 100},
        {"glob": "Source/", "weight": 30},
    ]


def test_block_sequence_of_scalars():
    doc = miniyaml.safe_load("items:\n  - one\n  - two\n")
    assert doc["items"] == ["one", "two"]


def test_block_scalar_literal():
    doc = miniyaml.safe_load("body: |\n  line one\n  line two\nafter: 1\n")
    assert doc["body"] == "line one\nline two\n"
    assert doc["after"] == 1


def test_block_scalar_folded():
    doc = miniyaml.safe_load("body: >\n  line one\n  line two\n")
    assert doc["body"] == "line one line two"


def test_url_value_is_not_parsed_as_mapping():
    doc = miniyaml.safe_load("url: https://example.com/path\n")
    assert doc["url"] == "https://example.com/path"


def test_null_and_bool_forms():
    doc = miniyaml.safe_load("a: null\nb: ~\nc: false\nd: yes\n")
    assert doc == {"a": None, "b": None, "c": False, "d": True}


def test_empty_document():
    assert miniyaml.safe_load("") is None
    assert miniyaml.safe_load("# only a comment\n") is None


def test_tabs_rejected():
    if miniyaml.USING_PYYAML:
        pytest.skip("delegating to PyYAML, which has its own tab handling")
    with pytest.raises(miniyaml.YamlError):
        miniyaml.safe_load("a:\n\tb: 1\n")


def test_malformed_line_rejected():
    if miniyaml.USING_PYYAML:
        pytest.skip("delegating to PyYAML, which has its own error handling")
    with pytest.raises(miniyaml.YamlError):
        miniyaml.safe_load("this line has no colon\n")
