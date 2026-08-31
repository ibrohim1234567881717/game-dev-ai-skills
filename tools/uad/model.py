"""Loading and in-memory model for UAD skills, agents, workflows and adapters.

Everything the toolkit knows about the repository is discovered from the
filesystem here, so no component needs a hand-maintained index that can drift.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import miniyaml

# --------------------------------------------------------------------------- #
# Agent Skills specification constants (agentskills.io/specification)
# --------------------------------------------------------------------------- #

NAME_MAX = 64
DESCRIPTION_MAX = 1024
COMPATIBILITY_MAX = 500
RECOMMENDED_MAX_LINES = 500

NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

SPEC_FRONTMATTER_KEYS = {
    "name",
    "description",
    "license",
    "compatibility",
    "metadata",
    "allowed-tools",
}

# --------------------------------------------------------------------------- #
# UAD conventions layered on top of the spec (carried inside `metadata`)
# --------------------------------------------------------------------------- #

REQUIRED_SECTIONS = [
    "Purpose",
    "When to use",
    "When NOT to use",
    "Required context",
    "Version constraints",
    "Workflow",
    "Best practices",
    "Common mistakes",
    "Validation",
    "References",
]

REQUIRED_METADATA = ["uad-layer", "uad-platform", "uad-domain", "uad-version"]

VALID_LAYERS = {"core", "platform", "meta"}

SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+$")

FRONTMATTER_RE = re.compile(r"\A---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|\Z)", re.DOTALL)


class LoadError(ValueError):
    """Raised when a file cannot be read as a skill/agent/adapter document."""


# --------------------------------------------------------------------------- #
# documents
# --------------------------------------------------------------------------- #

@dataclass
class Document:
    """A Markdown file with YAML frontmatter."""

    path: Path
    frontmatter: dict
    body: str

    @property
    def name(self) -> str:
        return str(self.frontmatter.get("name", "") or "")

    @property
    def description(self) -> str:
        return str(self.frontmatter.get("description", "") or "")

    @property
    def metadata(self) -> dict:
        meta = self.frontmatter.get("metadata")
        return meta if isinstance(meta, dict) else {}

    def meta(self, key: str, default: str = "") -> str:
        value = self.metadata.get(key, default)
        return "" if value is None else str(value)

    def meta_list(self, key: str) -> list:
        """Read a comma-separated metadata value as a list.

        The spec restricts `metadata` to string values, so lists travel as
        comma-separated strings rather than YAML sequences.
        """
        raw = self.meta(key)
        return [part.strip() for part in raw.split(",") if part.strip()]

    def sections(self) -> list:
        """Return the `##` headings present in the body, in order."""
        return [m.group(1).strip() for m in re.finditer(r"^##\s+(.+?)\s*$", self.body, re.M)]

    def line_count(self) -> int:
        return len(self.path.read_text(encoding="utf-8").splitlines())


@dataclass
class Skill(Document):
    """A skill directory: SKILL.md plus optional bundled resources."""

    @property
    def directory(self) -> Path:
        return self.path.parent

    @property
    def layer(self) -> str:
        return self.meta("uad-layer")

    @property
    def platform(self) -> str:
        return self.meta("uad-platform", "any")

    @property
    def domain(self) -> str:
        return self.meta("uad-domain")

    @property
    def requires(self) -> list:
        return self.meta_list("uad-requires")

    @property
    def tags(self) -> list:
        return self.meta_list("uad-tags")


@dataclass
class Adapter:
    """A platform adapter: platform.yaml describing detection and skills."""

    path: Path
    data: dict
    skills: list = field(default_factory=list)

    @property
    def key(self) -> str:
        return str(self.data.get("platform", ""))

    @property
    def title(self) -> str:
        return str(self.data.get("title", self.key))

    @property
    def directory(self) -> Path:
        return self.path.parent

    @property
    def signals(self) -> list:
        return list(self.data.get("detect", {}).get("signals", []) or [])

    @property
    def version_sources(self) -> list:
        return list(self.data.get("detect", {}).get("version", []) or [])


@dataclass
class Repository:
    """The whole toolkit, discovered from the filesystem."""

    root: Path
    skills: list = field(default_factory=list)
    adapters: list = field(default_factory=list)
    agents: list = field(default_factory=list)
    workflows: list = field(default_factory=list)

    def skill_by_name(self, name: str):
        for skill in self.skills:
            if skill.name == name:
                return skill
        return None

    def skills_for_platform(self, platform: str) -> list:
        return [s for s in self.skills if s.platform == platform]

    @property
    def core_skills(self) -> list:
        return [s for s in self.skills if s.layer == "core"]

    def adapter_by_key(self, key: str):
        for adapter in self.adapters:
            if adapter.key == key:
                return adapter
        return None


# --------------------------------------------------------------------------- #
# loading
# --------------------------------------------------------------------------- #

def split_frontmatter(text: str):
    """Split a document into (frontmatter dict, body). Raises LoadError."""
    match = FRONTMATTER_RE.match(text.lstrip("﻿"))
    if not match:
        raise LoadError("missing YAML frontmatter delimited by '---' lines")
    try:
        data = miniyaml.safe_load(match.group(1))
    except miniyaml.YamlError as exc:
        raise LoadError("invalid YAML frontmatter: %s" % exc) from exc
    if data is None:
        data = {}
    if not isinstance(data, dict):
        raise LoadError("frontmatter must be a mapping, got %s" % type(data).__name__)
    body = text[match.end():]
    return data, body


def load_document(path: Path, cls=Document):
    text = path.read_text(encoding="utf-8")
    frontmatter, body = split_frontmatter(text)
    return cls(path=path, frontmatter=frontmatter, body=body)


def load_adapter(path: Path) -> Adapter:
    try:
        data = miniyaml.safe_load(path.read_text(encoding="utf-8"))
    except miniyaml.YamlError as exc:
        raise LoadError("invalid YAML in %s: %s" % (path.name, exc)) from exc
    if not isinstance(data, dict):
        raise LoadError("%s must contain a mapping" % path.name)
    return Adapter(path=path, data=data)


def load_repository(root: Path) -> Repository:
    """Discover every skill, adapter, agent and workflow under `root`."""
    root = Path(root).resolve()
    repo = Repository(root=root)

    skills_dir = root / "skills"
    if skills_dir.is_dir():
        for skill_md in sorted(skills_dir.rglob("SKILL.md")):
            repo.skills.append(load_document(skill_md, Skill))

    platforms_dir = skills_dir / "platforms"
    if platforms_dir.is_dir():
        for manifest in sorted(platforms_dir.glob("*/platform.yaml")):
            adapter = load_adapter(manifest)
            adapter.skills = [
                s for s in repo.skills
                if _is_within(s.directory, manifest.parent)
            ]
            repo.adapters.append(adapter)

    agents_dir = root / "agents"
    if agents_dir.is_dir():
        for agent_md in sorted(agents_dir.rglob("*.md")):
            if agent_md.name.upper() == "README.MD":
                continue
            repo.agents.append(load_document(agent_md))

    workflows_dir = root / "workflows"
    if workflows_dir.is_dir():
        for workflow_md in sorted(workflows_dir.rglob("*.md")):
            if workflow_md.name.upper() == "README.MD":
                continue
            repo.workflows.append(load_document(workflow_md))

    return repo


def _is_within(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def find_repo_root(start: Path = None) -> Path:
    """Walk upward looking for the toolkit root (a directory holding skills/)."""
    current = Path(start or Path(__file__)).resolve()
    for candidate in [current, *current.parents]:
        if (candidate / "skills").is_dir() and (candidate / "tools" / "uad").is_dir():
            return candidate
    raise LoadError("could not locate the universal-ai-dev repository root")
