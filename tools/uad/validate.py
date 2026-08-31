"""Validation for skills, agents, workflows and platform adapters.

Two rule families are checked:

1. **Agent Skills specification** compliance -- the things that make a skill
   load at all in the 40+ tools that implement the standard (name shape, name
   matching the folder, description limits, `metadata` being a string map).
2. **UAD conventions** -- required body sections, resolvable `uad-requires`
   edges, no duplicate names, adapters that actually point at real skills.

Errors fail the build; warnings are advisory.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re

from . import model
from .model import (
    COMPATIBILITY_MAX,
    DESCRIPTION_MAX,
    NAME_MAX,
    NAME_RE,
    RECOMMENDED_MAX_LINES,
    REQUIRED_METADATA,
    REQUIRED_SECTIONS,
    SEMVER_RE,
    SPEC_FRONTMATTER_KEYS,
    VALID_LAYERS,
)

ERROR = "error"
WARNING = "warning"

# Matches markdown links, capturing the target.
LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")


@dataclass
class Issue:
    severity: str
    path: str
    message: str

    def format(self, root: Path = None) -> str:
        location = self.path
        if root is not None:
            try:
                location = str(Path(self.path).relative_to(root)).replace("\\", "/")
            except ValueError:
                pass
        mark = "ERROR  " if self.severity == ERROR else "WARN   "
        return "%s %s: %s" % (mark, location, self.message)


class Report:
    def __init__(self):
        self.issues = []
        self.checked = 0

    def error(self, path, message):
        self.issues.append(Issue(ERROR, str(path), message))

    def warn(self, path, message):
        self.issues.append(Issue(WARNING, str(path), message))

    @property
    def errors(self):
        return [i for i in self.issues if i.severity == ERROR]

    @property
    def warnings(self):
        return [i for i in self.issues if i.severity == WARNING]

    @property
    def ok(self) -> bool:
        return not self.errors


# --------------------------------------------------------------------------- #
# entry point
# --------------------------------------------------------------------------- #

def validate_repository(root: Path, strict: bool = False) -> Report:
    root = Path(root).resolve()
    report = Report()

    try:
        repo = model.load_repository(root)
    except model.LoadError as exc:
        report.error(root, str(exc))
        return report

    _check_duplicate_names(repo, report)

    known_skills = {s.name for s in repo.skills}
    for skill in repo.skills:
        report.checked += 1
        _validate_skill(skill, known_skills, report)

    for adapter in repo.adapters:
        report.checked += 1
        _validate_adapter(adapter, known_skills, report)

    for agent in repo.agents:
        report.checked += 1
        _validate_agent(agent, known_skills, report)

    for workflow in repo.workflows:
        report.checked += 1
        _validate_workflow(workflow, known_skills, report)

    if strict:
        for issue in report.warnings:
            issue.severity = ERROR

    return report


# --------------------------------------------------------------------------- #
# skills
# --------------------------------------------------------------------------- #

def _validate_skill(skill: model.Skill, known_skills, report: Report) -> None:
    path = skill.path
    fm = skill.frontmatter

    # --- specification compliance ----------------------------------------- #
    if not skill.name:
        report.error(path, "frontmatter is missing the required 'name' field")
    else:
        if len(skill.name) > NAME_MAX:
            report.error(path, "name exceeds %d characters" % NAME_MAX)
        if not NAME_RE.match(skill.name):
            report.error(
                path,
                "name %r must be lowercase a-z0-9 separated by single hyphens, "
                "with no leading or trailing hyphen" % skill.name,
            )
        if skill.name != skill.directory.name:
            report.error(
                path,
                "name %r must match its parent directory %r (spec requirement)"
                % (skill.name, skill.directory.name),
            )

    if not skill.description.strip():
        report.error(path, "frontmatter is missing the required 'description' field")
    elif len(skill.description) > DESCRIPTION_MAX:
        report.error(
            path,
            "description is %d characters, over the %d limit"
            % (len(skill.description), DESCRIPTION_MAX),
        )
    elif len(skill.description) < 40:
        report.warn(path, "description is very short; state what it does AND when to use it")

    compatibility = fm.get("compatibility")
    if compatibility is not None and len(str(compatibility)) > COMPATIBILITY_MAX:
        report.error(path, "compatibility exceeds %d characters" % COMPATIBILITY_MAX)

    unknown = set(fm) - SPEC_FRONTMATTER_KEYS
    if unknown:
        report.error(
            path,
            "unknown top-level frontmatter keys %s -- the spec only defines %s; "
            "put custom fields under 'metadata'"
            % (sorted(unknown), sorted(SPEC_FRONTMATTER_KEYS)),
        )

    meta = fm.get("metadata")
    if meta is None:
        report.error(path, "missing 'metadata' block with UAD routing fields")
        meta = {}
    elif not isinstance(meta, dict):
        report.error(path, "'metadata' must be a mapping")
        meta = {}
    else:
        for key, value in meta.items():
            if not isinstance(value, str):
                report.error(
                    path,
                    "metadata.%s must be a string (the spec allows only string "
                    "values); got %s -- quote it" % (key, type(value).__name__),
                )

    # --- UAD conventions --------------------------------------------------- #
    for key in REQUIRED_METADATA:
        if not str(meta.get(key, "")).strip():
            report.error(path, "metadata.%s is required" % key)

    layer = str(meta.get("uad-layer", ""))
    if layer and layer not in VALID_LAYERS:
        report.error(path, "metadata.uad-layer %r must be one of %s" % (layer, sorted(VALID_LAYERS)))

    version = str(meta.get("uad-version", ""))
    if version and not SEMVER_RE.match(version):
        report.error(path, "metadata.uad-version %r must be semver (e.g. \"1.0.0\")" % version)

    platform = str(meta.get("uad-platform", ""))
    if layer == "core" and platform != "any":
        report.error(path, "core skills must declare metadata.uad-platform: any")
    if layer == "platform" and platform in ("", "any"):
        report.error(path, "platform skills must name their platform in metadata.uad-platform")

    # Directory placement must agree with the declared layer.
    parts = skill.directory.parts
    if layer == "core" and "core" not in parts:
        report.warn(path, "declared layer 'core' but the skill lives outside skills/core/")
    if layer == "platform" and platform not in ("", "any") and platform not in parts:
        report.warn(
            path,
            "declared platform %r but the skill lives outside skills/platforms/%s/"
            % (platform, platform),
        )

    # --- body structure ---------------------------------------------------- #
    sections = skill.sections()
    lowered = [s.lower() for s in sections]
    for required in REQUIRED_SECTIONS:
        if required.lower() not in lowered:
            report.error(path, "missing required section '## %s'" % required)

    if skill.line_count() > RECOMMENDED_MAX_LINES:
        report.warn(
            path,
            "SKILL.md is %d lines; the spec recommends staying under %d -- move "
            "detail into references/" % (skill.line_count(), RECOMMENDED_MAX_LINES),
        )

    if not skill.body.strip():
        report.error(path, "SKILL.md has an empty body")

    # --- cross references -------------------------------------------------- #
    for dependency in skill.requires:
        if dependency not in known_skills:
            report.error(
                path,
                "metadata.uad-requires names %r, which is not a skill in this repository"
                % dependency,
            )
        if dependency == skill.name:
            report.error(path, "metadata.uad-requires lists the skill itself")

    _check_links(skill.path, skill.body, report)


# --------------------------------------------------------------------------- #
# adapters, agents, workflows
# --------------------------------------------------------------------------- #

def _validate_adapter(adapter: model.Adapter, known_skills, report: Report) -> None:
    path = adapter.path
    data = adapter.data

    if not adapter.key:
        report.error(path, "platform.yaml must declare 'platform'")
    elif adapter.key != adapter.directory.name:
        report.error(
            path,
            "platform %r must match its directory %r" % (adapter.key, adapter.directory.name),
        )

    for required in ("title", "detect"):
        if required not in data:
            report.error(path, "platform.yaml must declare %r" % required)

    detect = data.get("detect") or {}
    if not isinstance(detect, dict):
        report.error(path, "'detect' must be a mapping")
        return

    signals = detect.get("signals")
    if not signals:
        report.error(path, "'detect.signals' must list at least one detection signal")
    elif not isinstance(signals, list):
        report.error(path, "'detect.signals' must be a list")
    else:
        for i, signal in enumerate(signals):
            if not isinstance(signal, dict):
                report.error(path, "detect.signals[%d] must be a mapping" % i)
                continue
            if "glob" not in signal and "dir" not in signal:
                report.error(path, "detect.signals[%d] needs a 'glob' or 'dir' key" % i)
            weight = signal.get("weight")
            if not isinstance(weight, int) or not 1 <= weight <= 100:
                report.error(
                    path, "detect.signals[%d].weight must be an integer 1-100" % i
                )

    for i, source in enumerate(detect.get("version") or []):
        if not isinstance(source, dict):
            report.error(path, "detect.version[%d] must be a mapping" % i)
            continue
        if "file" not in source:
            report.error(path, "detect.version[%d] needs a 'file' key" % i)
        if "pattern" not in source and "value" not in source:
            report.error(
                path, "detect.version[%d] needs either a 'pattern' or a 'value' key" % i
            )
        pattern = source.get("pattern")
        if isinstance(pattern, str):
            try:
                compiled = re.compile(pattern)
            except re.error as exc:
                report.error(path, "detect.version[%d].pattern is not valid regex: %s" % (i, exc))
            else:
                if compiled.groups < 1:
                    report.error(
                        path,
                        "detect.version[%d].pattern must contain a capture group "
                        "for the version" % i,
                    )

    # Every skill in the adapter's directory should belong to this platform.
    for skill in adapter.skills:
        if skill.platform != adapter.key:
            report.error(
                skill.path,
                "skill sits under skills/platforms/%s/ but declares uad-platform %r"
                % (adapter.key, skill.platform),
            )

    for name in data.get("entry_skills") or []:
        if name not in known_skills:
            report.error(path, "entry_skills names %r, which does not exist" % name)


def _validate_agent(agent: model.Document, known_skills, report: Report) -> None:
    path = agent.path
    if not agent.name:
        report.error(path, "agent frontmatter is missing 'name'")
    elif not NAME_RE.match(agent.name):
        report.error(path, "agent name %r must be lowercase-hyphenated" % agent.name)
    elif agent.name != path.stem:
        report.error(path, "agent name %r must match its filename %r" % (agent.name, path.stem))

    if not agent.description.strip():
        report.error(path, "agent frontmatter is missing 'description'")
    elif len(agent.description) > DESCRIPTION_MAX:
        report.error(path, "agent description exceeds %d characters" % DESCRIPTION_MAX)

    if not agent.body.strip():
        report.error(path, "agent has an empty system prompt body")

    for name in agent.meta_list("uad-skills"):
        if name not in known_skills:
            report.error(path, "metadata.uad-skills names %r, which does not exist" % name)

    _check_links(path, agent.body, report)


def _validate_workflow(workflow: model.Document, known_skills, report: Report) -> None:
    path = workflow.path
    if not workflow.name:
        report.error(path, "workflow frontmatter is missing 'name'")
    elif workflow.name != path.stem:
        report.error(
            path, "workflow name %r must match its filename %r" % (workflow.name, path.stem)
        )
    if not workflow.description.strip():
        report.error(path, "workflow frontmatter is missing 'description'")

    if "## Steps" not in workflow.body and "## Workflow" not in workflow.body:
        report.error(path, "workflow must define a '## Steps' or '## Workflow' section")

    for name in workflow.meta_list("uad-skills"):
        if name not in known_skills:
            report.error(path, "metadata.uad-skills names %r, which does not exist" % name)

    _check_links(path, workflow.body, report)


# --------------------------------------------------------------------------- #
# shared checks
# --------------------------------------------------------------------------- #

def _check_duplicate_names(repo: model.Repository, report: Report) -> None:
    """Names must be unique: installers flatten every skill into one folder."""
    seen = {}
    for skill in repo.skills:
        if not skill.name:
            continue
        if skill.name in seen:
            report.error(
                skill.path,
                "duplicate skill name %r (already defined at %s); names collide "
                "when skills are installed into a single directory"
                % (skill.name, seen[skill.name]),
            )
        else:
            seen[skill.name] = skill.path

    seen_agents = {}
    for agent in repo.agents:
        if not agent.name:
            continue
        if agent.name in seen_agents:
            report.error(agent.path, "duplicate agent name %r" % agent.name)
        else:
            seen_agents[agent.name] = agent.path


def _check_links(path: Path, body: str, report: Report) -> None:
    """Relative markdown links must resolve on disk."""
    base = path.parent
    for match in LINK_RE.finditer(body):
        target = match.group(1).strip()
        if not target or target.startswith(("http://", "https://", "#", "mailto:")):
            continue
        target = target.split("#", 1)[0].split(" ", 1)[0]
        if not target:
            continue
        if (base / target).exists():
            continue
        # Allow links written relative to the repository root as a fallback.
        try:
            repo_root = model.find_repo_root(path)
        except model.LoadError:
            repo_root = None
        if repo_root is not None and (repo_root / target).exists():
            continue
        report.error(path, "broken relative link: %s" % target)
