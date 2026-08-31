"""Validator tests.

A validator that never fails is worse than no validator, because it manufactures
confidence. Each test here builds a deliberately broken skill in a temporary
repository and asserts the specific defect is caught.

The final test asserts the real repository is clean.
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from uad import validate  # noqa: E402

GOOD_BODY = """
## Purpose
Something useful.

## When to use
- A trigger.

## When NOT to use
- Another skill's job.

## Required context
- A fact, and the file that answers it.

## Version constraints
Version independent.

## Workflow
1. Do the thing.

## Best practices
- A practice.

## Common mistakes
- **A mistake.** Why it hurts.

## Validation
Run the thing and read the output.

## References
- Nothing bundled.
"""

GOOD_FRONTMATTER = """---
name: {name}
description: A skill that does a specific thing, used when that specific thing needs doing.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: programming
  uad-version: "1.0.0"
---
"""


def make_repo(tmp_path):
    """A minimal repository skeleton that find_repo_root will accept."""
    (tmp_path / "skills" / "core" / "programming").mkdir(parents=True)
    (tmp_path / "tools" / "uad").mkdir(parents=True)
    return tmp_path


def write_skill(repo, name, frontmatter=None, body=GOOD_BODY, directory=None):
    folder = repo / "skills" / "core" / "programming" / (directory or name)
    folder.mkdir(parents=True, exist_ok=True)
    text = (frontmatter or GOOD_FRONTMATTER.format(name=name)) + body
    (folder / "SKILL.md").write_text(text, encoding="utf-8")
    return folder


def messages(report):
    return " | ".join(i.message for i in report.issues)


# --------------------------------------------------------------------------- #
# the happy path must actually pass
# --------------------------------------------------------------------------- #

def test_wellformed_skill_passes(tmp_path):
    repo = make_repo(tmp_path)
    write_skill(repo, "good-skill")
    report = validate.validate_repository(repo)
    assert report.ok, messages(report)


# --------------------------------------------------------------------------- #
# Agent Skills specification rules
# --------------------------------------------------------------------------- #

def test_name_must_match_directory(tmp_path):
    """The spec requires it; skills that break it silently fail to load."""
    repo = make_repo(tmp_path)
    write_skill(repo, "declared-name", directory="different-folder")
    report = validate.validate_repository(repo)
    assert not report.ok
    assert "parent directory" in messages(report)


def test_invalid_name_shape_is_rejected(tmp_path):
    repo = make_repo(tmp_path)
    for bad in ("Bad-Caps", "double--hyphen", "-leading", "trailing-"):
        fresh = make_repo(tmp_path / bad.replace("-", "_"))
        write_skill(fresh, bad, directory=bad)
        report = validate.validate_repository(fresh)
        assert not report.ok, bad


def test_missing_description_is_rejected(tmp_path):
    repo = make_repo(tmp_path)
    write_skill(
        repo, "no-desc",
        frontmatter='---\nname: no-desc\nmetadata:\n  uad-layer: core\n'
                    '  uad-platform: any\n  uad-domain: programming\n'
                    '  uad-version: "1.0.0"\n---\n',
    )
    report = validate.validate_repository(repo)
    assert not report.ok
    assert "description" in messages(report)


def test_overlong_description_is_rejected(tmp_path):
    repo = make_repo(tmp_path)
    long_description = "x" * 1100
    write_skill(
        repo, "long-desc",
        frontmatter='---\nname: long-desc\ndescription: %s\nmetadata:\n'
                    '  uad-layer: core\n  uad-platform: any\n'
                    '  uad-domain: programming\n  uad-version: "1.0.0"\n---\n'
                    % long_description,
    )
    report = validate.validate_repository(repo)
    assert not report.ok
    assert "1024" in messages(report)


def test_non_string_metadata_is_rejected(tmp_path):
    """The spec restricts metadata to string values; 1.0.0 unquoted is a float."""
    repo = make_repo(tmp_path)
    write_skill(
        repo, "bad-meta",
        frontmatter="---\nname: bad-meta\ndescription: A skill with a numeric "
                    "metadata value, which the specification forbids.\n"
                    "metadata:\n  uad-layer: core\n  uad-platform: any\n"
                    "  uad-domain: programming\n  uad-version: 1.0\n---\n",
    )
    report = validate.validate_repository(repo)
    assert not report.ok
    assert "must be a string" in messages(report)


def test_unknown_toplevel_frontmatter_key_is_rejected(tmp_path):
    repo = make_repo(tmp_path)
    write_skill(
        repo, "extra-key",
        frontmatter="---\nname: extra-key\ndescription: A skill that puts a "
                    "custom field at the top level instead of under metadata.\n"
                    "author: someone\nmetadata:\n  uad-layer: core\n"
                    '  uad-platform: any\n  uad-domain: programming\n'
                    '  uad-version: "1.0.0"\n---\n',
    )
    report = validate.validate_repository(repo)
    assert not report.ok
    assert "unknown top-level frontmatter" in messages(report)


def test_missing_frontmatter_is_reported(tmp_path):
    repo = make_repo(tmp_path)
    folder = repo / "skills" / "core" / "programming" / "no-frontmatter"
    folder.mkdir(parents=True)
    (folder / "SKILL.md").write_text("# Just a heading\n", encoding="utf-8")
    report = validate.validate_repository(repo)
    assert not report.ok


# --------------------------------------------------------------------------- #
# UAD conventions
# --------------------------------------------------------------------------- #

def test_missing_required_section_is_rejected(tmp_path):
    repo = make_repo(tmp_path)
    truncated = GOOD_BODY.replace("## Common mistakes\n- **A mistake.** Why it hurts.\n", "")
    write_skill(repo, "missing-section", body=truncated)
    report = validate.validate_repository(repo)
    assert not report.ok
    assert "Common mistakes" in messages(report)


def test_missing_required_metadata_is_rejected(tmp_path):
    repo = make_repo(tmp_path)
    write_skill(
        repo, "no-domain",
        frontmatter="---\nname: no-domain\ndescription: A skill missing its "
                    "routing domain, which the selector needs to rank it.\n"
                    "metadata:\n  uad-layer: core\n  uad-platform: any\n"
                    '  uad-version: "1.0.0"\n---\n',
    )
    report = validate.validate_repository(repo)
    assert not report.ok
    assert "uad-domain" in messages(report)


def test_bad_semver_is_rejected(tmp_path):
    repo = make_repo(tmp_path)
    write_skill(
        repo, "bad-version",
        frontmatter="---\nname: bad-version\ndescription: A skill whose version "
                    "is not semver, which breaks ordering and comparison.\n"
                    "metadata:\n  uad-layer: core\n  uad-platform: any\n"
                    '  uad-domain: programming\n  uad-version: "one"\n---\n',
    )
    report = validate.validate_repository(repo)
    assert not report.ok
    assert "semver" in messages(report)


def test_dangling_requires_is_rejected(tmp_path):
    repo = make_repo(tmp_path)
    write_skill(
        repo, "dangling",
        frontmatter="---\nname: dangling\ndescription: A skill requiring another "
                    "skill that does not exist anywhere in the repository.\n"
                    "metadata:\n  uad-layer: core\n  uad-platform: any\n"
                    '  uad-domain: programming\n  uad-version: "1.0.0"\n'
                    '  uad-requires: "does-not-exist"\n---\n',
    )
    report = validate.validate_repository(repo)
    assert not report.ok
    assert "does-not-exist" in messages(report)


def test_self_requirement_is_rejected(tmp_path):
    repo = make_repo(tmp_path)
    write_skill(
        repo, "selfref",
        frontmatter="---\nname: selfref\ndescription: A skill that lists itself "
                    "as one of its own dependencies, which cannot be right.\n"
                    "metadata:\n  uad-layer: core\n  uad-platform: any\n"
                    '  uad-domain: programming\n  uad-version: "1.0.0"\n'
                    '  uad-requires: "selfref"\n---\n',
    )
    report = validate.validate_repository(repo)
    assert not report.ok
    assert "itself" in messages(report)


def test_duplicate_names_are_rejected(tmp_path):
    """Installers flatten every skill into one directory, so names must be unique."""
    repo = make_repo(tmp_path)
    write_skill(repo, "dupe")
    second = repo / "skills" / "core" / "gamedev" / "dupe"
    second.mkdir(parents=True)
    (second / "SKILL.md").write_text(
        GOOD_FRONTMATTER.format(name="dupe") + GOOD_BODY, encoding="utf-8"
    )
    report = validate.validate_repository(repo)
    assert not report.ok
    assert "duplicate skill name" in messages(report)


def test_broken_relative_link_is_rejected(tmp_path):
    repo = make_repo(tmp_path)
    body = GOOD_BODY.replace(
        "- Nothing bundled.", "- [Missing file](references/REFERENCE.md)"
    )
    write_skill(repo, "broken-link", body=body)
    report = validate.validate_repository(repo)
    assert not report.ok
    assert "broken relative link" in messages(report)


def test_existing_relative_link_passes(tmp_path):
    repo = make_repo(tmp_path)
    body = GOOD_BODY.replace(
        "- Nothing bundled.", "- [Present file](references/REFERENCE.md)"
    )
    folder = write_skill(repo, "good-link", body=body)
    (folder / "references").mkdir()
    (folder / "references" / "REFERENCE.md").write_text("# Reference\n", encoding="utf-8")
    report = validate.validate_repository(repo)
    assert report.ok, messages(report)


def test_core_skill_must_declare_platform_any(tmp_path):
    repo = make_repo(tmp_path)
    write_skill(
        repo, "wrong-platform",
        frontmatter="---\nname: wrong-platform\ndescription: A core skill that "
                    "wrongly claims to belong to a single platform.\n"
                    "metadata:\n  uad-layer: core\n  uad-platform: unity\n"
                    '  uad-domain: programming\n  uad-version: "1.0.0"\n---\n',
    )
    report = validate.validate_repository(repo)
    assert not report.ok
    assert "uad-platform: any" in messages(report)


def test_strict_mode_promotes_warnings(tmp_path):
    repo = make_repo(tmp_path)
    write_skill(
        repo, "short-desc",
        frontmatter="---\nname: short-desc\ndescription: Does things.\n"
                    "metadata:\n  uad-layer: core\n  uad-platform: any\n"
                    '  uad-domain: programming\n  uad-version: "1.0.0"\n---\n',
    )
    lenient = validate.validate_repository(repo)
    assert lenient.ok
    assert lenient.warnings

    strict = validate.validate_repository(repo, strict=True)
    assert not strict.ok


# --------------------------------------------------------------------------- #
# the real repository
# --------------------------------------------------------------------------- #

def test_this_repository_is_valid_in_strict_mode():
    report = validate.validate_repository(ROOT, strict=True)
    assert report.ok, "\n".join(i.format(ROOT) for i in report.issues)
    assert report.checked > 50, "suspiciously few documents checked"
