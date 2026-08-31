#!/usr/bin/env python3
"""Check that every relative Markdown link in the repository resolves.

`uad validate` checks links inside skills, agents and workflows. This covers
everything else -- README, CONTRIBUTING, AGENTS.md and docs/ -- so a
reorganisation cannot quietly break the documentation.

    python tools/check_links.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")

# Links inside HTML comments and fenced code blocks are not rendered, so they
# are documentation of syntax rather than links that must resolve.
COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
FENCE_RE = re.compile(r"^```.*?^```", re.DOTALL | re.MULTILINE)

SKIP_DIRS = {".git", "__pycache__", ".pytest_cache", "fixtures", ".venv", "venv"}

# Placeholder URLs that are meant to be replaced by whoever forks this.
PLACEHOLDER_HOSTS = ("YOUR-ORG", "YOUR-USERNAME", "example.com")


def markdown_files(root: Path):
    for path in sorted(root.rglob("*.md")):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        yield path


def check(root: Path) -> int:
    failures = []
    checked = 0

    for path in markdown_files(root):
        text = path.read_text(encoding="utf-8")
        text = COMMENT_RE.sub("", text)
        text = FENCE_RE.sub("", text)
        for match in LINK_RE.finditer(text):
            target = match.group(1).strip()

            if not target or target.startswith(("#", "mailto:")):
                continue
            if target.startswith(("http://", "https://")):
                continue  # external links are not fetched here

            target = target.split("#", 1)[0].split(" ", 1)[0]
            if not target:
                continue

            checked += 1
            if (path.parent / target).exists():
                continue
            if (root / target.lstrip("/")).exists():
                continue

            failures.append((path.relative_to(root), target))

    for source, target in failures:
        print("BROKEN  %s -> %s" % (str(source).replace("\\", "/"), target))

    print("\nChecked %d relative link(s) across Markdown files." % checked)
    if failures:
        print("%d broken link(s)." % len(failures))
        return 1
    print("All relative links resolve.")
    return 0


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    return check(root)


if __name__ == "__main__":
    sys.exit(main())
