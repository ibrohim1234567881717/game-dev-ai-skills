"""Project detection.

Identifies which platform(s) a directory belongs to, and -- critically for
game engines, whose APIs churn -- which *version* of that platform, by reading
the project's own files.

Detection is data-driven: every rule lives in `skills/platforms/<key>/platform.yaml`,
so adding an engine adds one manifest, not code.

A single file is never treated as proof. Signals carry weights and a platform
must clear a confidence threshold, which keeps look-alike projects (a Node
tool sitting inside a Unity repo, say) from hijacking the result.
"""

from __future__ import annotations

import fnmatch
import re
from dataclasses import dataclass, field
from pathlib import Path

from . import model

# Directories that are large, generated, or vendored. Skipping them keeps
# detection fast and stops a vendored copy of another engine from voting.
IGNORED_DIRS = {
    ".git", ".hg", ".svn", ".idea", ".vs", ".vscode", "node_modules",
    "__pycache__", ".venv", "venv", "dist", "build", "out", "target",
    "Library", "Temp", "Obj", "Logs", "UserSettings", "MemoryCaptures",
    "Intermediate", "Binaries", "Saved", "DerivedDataCache", ".godot",
    ".gradle", ".mvn", "run", "coverage", ".next", ".nuxt", ".turbo",
    ".cache", "vendor", "Pods", "bin",
}

MAX_DEPTH = 6
MAX_FILES = 20000
# Minimum score for a platform to be reported at all.
MIN_CONFIDENCE = 25
# A platform this far below the leader is treated as secondary, not a rival.
PRIMARY_MARGIN = 20


@dataclass
class Evidence:
    signal: str
    weight: int
    matched: str
    note: str = ""


@dataclass
class PlatformMatch:
    platform: str
    title: str
    confidence: int
    evidence: list = field(default_factory=list)
    versions: dict = field(default_factory=dict)
    unresolved: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "platform": self.platform,
            "title": self.title,
            "confidence": self.confidence,
            "versions": self.versions,
            "unresolved": self.unresolved,
            "evidence": [
                {"signal": e.signal, "weight": e.weight, "matched": e.matched, "note": e.note}
                for e in self.evidence
            ],
        }


@dataclass
class DetectionResult:
    project_root: str
    matches: list = field(default_factory=list)
    scanned_files: int = 0
    truncated: bool = False

    @property
    def primary(self):
        return self.matches[0] if self.matches else None

    @property
    def secondary(self) -> list:
        """Platforms that are clearly present but not the leader."""
        if len(self.matches) < 2:
            return []
        return self.matches[1:]

    @property
    def ambiguous(self) -> bool:
        """True when two platforms score close enough that the choice matters."""
        if len(self.matches) < 2:
            return False
        return (self.matches[0].confidence - self.matches[1].confidence) < PRIMARY_MARGIN

    def to_dict(self) -> dict:
        return {
            "project_root": self.project_root,
            "scanned_files": self.scanned_files,
            "truncated": self.truncated,
            "ambiguous": self.ambiguous,
            "primary": self.primary.to_dict() if self.primary else None,
            "matches": [m.to_dict() for m in self.matches],
        }


# --------------------------------------------------------------------------- #
# scanning
# --------------------------------------------------------------------------- #

def scan_tree(project_root: Path, max_depth: int = MAX_DEPTH):
    """Collect relative POSIX paths for files and directories worth inspecting."""
    project_root = Path(project_root).resolve()
    files, dirs = [], []
    truncated = False

    stack = [(project_root, 0)]
    while stack:
        current, depth = stack.pop()
        if depth > max_depth:
            continue
        try:
            entries = list(current.iterdir())
        except (PermissionError, OSError):
            continue
        for entry in entries:
            try:
                is_dir = entry.is_dir()
            except OSError:
                continue
            rel = entry.relative_to(project_root).as_posix()
            if is_dir:
                if entry.name in IGNORED_DIRS:
                    continue
                dirs.append(rel)
                stack.append((entry, depth + 1))
            else:
                files.append(rel)
                if len(files) >= MAX_FILES:
                    truncated = True
                    stack = []
                    break
    return files, dirs, truncated


def _matches_pattern(pattern: str, candidates) -> list:
    """Match a glob against relative paths.

    A pattern containing '/' is matched against the whole relative path;
    a bare pattern is matched against the basename at any depth.
    """
    hits = []
    if "/" in pattern:
        for rel in candidates:
            if fnmatch.fnmatch(rel, pattern) or fnmatch.fnmatch(rel, "*/" + pattern.lstrip("*/")):
                hits.append(rel)
    else:
        for rel in candidates:
            if fnmatch.fnmatch(rel.rsplit("/", 1)[-1], pattern):
                hits.append(rel)
    return hits


def _content_matches(project_root: Path, rel_paths, pattern: str) -> list:
    """Keep only paths whose contents match a regex (bounded read)."""
    compiled = re.compile(pattern)
    hits = []
    for rel in rel_paths:
        path = project_root / rel
        try:
            text = path.read_text(encoding="utf-8", errors="replace")[:200000]
        except (OSError, UnicodeError):
            continue
        if compiled.search(text):
            hits.append(rel)
    return hits


# --------------------------------------------------------------------------- #
# detection
# --------------------------------------------------------------------------- #

def detect(project_root, repo_root=None, max_depth: int = MAX_DEPTH) -> DetectionResult:
    """Detect the platform(s) used by the project at `project_root`."""
    project_root = Path(project_root).resolve()
    repo_root = Path(repo_root) if repo_root else model.find_repo_root()
    repo = model.load_repository(repo_root)

    files, dirs, truncated = scan_tree(project_root, max_depth=max_depth)
    result = DetectionResult(
        project_root=str(project_root), scanned_files=len(files), truncated=truncated
    )

    for adapter in repo.adapters:
        match = _score_adapter(adapter, project_root, files, dirs)
        if match and match.confidence >= MIN_CONFIDENCE:
            result.matches.append(match)

    result.matches.sort(key=lambda m: (-m.confidence, m.platform))
    return result


def _score_adapter(adapter: model.Adapter, project_root: Path, files, dirs):
    score = 0
    evidence = []

    for signal in adapter.signals:
        if not isinstance(signal, dict):
            continue
        weight = int(signal.get("weight", 0))
        note = str(signal.get("note", ""))

        if "dir" in signal:
            pattern = str(signal["dir"])
            hits = _matches_pattern(pattern, dirs)
            kind = "dir"
        else:
            pattern = str(signal.get("glob", ""))
            hits = _matches_pattern(pattern, files)
            kind = "glob"

        # `depth` anchors a signal near the project root. Without it a marker
        # file vendored deep inside another ecosystem's package folder would
        # vote -- Unity ships a package.json inside every embedded package.
        if "depth" in signal:
            max_allowed = int(signal["depth"])
            hits = [h for h in hits if h.count("/") + 1 <= max_allowed]

        if not hits:
            continue

        contains = signal.get("contains")
        if contains:
            hits = _content_matches(project_root, hits, str(contains))
            if not hits:
                continue

        score += weight
        evidence.append(
            Evidence(signal="%s:%s" % (kind, pattern), weight=weight, matched=hits[0], note=note)
        )

    if not evidence:
        return None

    versions, unresolved = _detect_versions(adapter, project_root, files)

    return PlatformMatch(
        platform=adapter.key,
        title=adapter.title,
        confidence=min(score, 100),
        evidence=evidence,
        versions=versions,
        unresolved=unresolved,
    )


def _detect_versions(adapter: model.Adapter, project_root: Path, files):
    """Extract version facts (engine version, loader, language level...)."""
    versions = {}
    unresolved = []

    for source in adapter.version_sources:
        if not isinstance(source, dict):
            continue
        label = str(source.get("label", "version"))
        if label in versions:
            continue
        candidates = _matches_pattern(str(source.get("file", "")), files)
        if "depth" in source:
            max_allowed = int(source["depth"])
            candidates = [c for c in candidates if c.count("/") + 1 <= max_allowed]
        if not candidates:
            continue

        # A fact can be asserted by a file's mere existence -- which loader a
        # Minecraft mod targets is decided by which manifest is present, not by
        # anything written inside it.
        if "value" in source:
            versions[label] = str(source["value"])
            versions.setdefault("_sources", {})
            versions["_sources"][label] = candidates[0]
            continue

        pattern = str(source.get("pattern", ""))
        try:
            compiled = re.compile(pattern, re.MULTILINE)
        except re.error:
            continue
        for rel in candidates:
            try:
                text = (project_root / rel).read_text(encoding="utf-8", errors="replace")[:200000]
            except (OSError, UnicodeError):
                continue
            found = compiled.search(text)
            if found:
                value = found.group(1).strip()
                transform = str(source.get("transform", ""))
                if transform == "basename":
                    value = value.rsplit("/", 1)[-1]
                versions[label] = value
                versions.setdefault("_sources", {})
                versions["_sources"][label] = rel
                break

    for label in adapter.data.get("detect", {}).get("required_facts", []) or []:
        if str(label) not in versions:
            unresolved.append(str(label))

    return versions, unresolved
