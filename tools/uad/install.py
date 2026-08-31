"""Installation into AI coding clients.

Skills in this repository are plain Agent Skills, so "installing" them is
mostly a matter of putting the skill directories where a client looks. What
this module adds is: knowing those locations, filtering to the platforms a
developer actually works on (installing all six engines pollutes every
session's skill index), and generating the client-specific wrappers that are
*not* part of the skill standard -- subagent definitions and slash commands.

Copying is the default rather than symlinking. Symlinks give free updates on
`git pull`, but on Windows they need Developer Mode or an elevated shell, so
they are opt-in via --link and fall back to copying with a warning.
"""

from __future__ import annotations

import os
import shutil
from dataclasses import dataclass, field
from pathlib import Path

from . import model


@dataclass
class Target:
    """Where one client keeps skills, agents and commands."""

    key: str
    title: str
    user_root: str          # relative to the home directory
    project_root: str       # relative to the project being worked in
    skills_dir: str = "skills"
    agents_dir: str = ""    # empty means the client has no subagent concept
    commands_dir: str = ""  # empty means the client has no slash-command concept
    verified: bool = False  # whether these paths were checked against docs
    note: str = ""


# Paths taken from each client's own documentation. `verified` marks the ones
# this project has confirmed; anything else should be installed with --dest.
TARGETS = {
    "claude-code": Target(
        key="claude-code",
        title="Claude Code",
        user_root=".claude",
        project_root=".claude",
        skills_dir="skills",
        agents_dir="agents",
        commands_dir="commands",
        verified=True,
    ),
    "codex": Target(
        key="codex",
        title="OpenAI Codex",
        user_root=".codex",
        project_root=".codex",
        skills_dir="skills",
        verified=True,
    ),
    "copilot": Target(
        key="copilot",
        title="GitHub Copilot / VS Code",
        user_root=".copilot",
        project_root=".github",
        skills_dir="skills",
        verified=True,
    ),
    "cursor": Target(
        key="cursor",
        title="Cursor",
        user_root=".cursor",
        project_root=".cursor",
        skills_dir="skills",
        verified=True,
    ),
    "gemini-cli": Target(
        key="gemini-cli",
        title="Gemini CLI",
        user_root=".gemini",
        project_root=".gemini",
        skills_dir="skills",
        verified=False,
        note="Path follows the documented convention but was not verified here.",
    ),
    "generic": Target(
        key="generic",
        title="Any Agent Skills client",
        user_root=".agent-skills",
        project_root=".agent-skills",
        skills_dir="skills",
        verified=True,
        note="Use --dest to point at the directory your client scans.",
    ),
}


@dataclass
class InstallPlan:
    target: Target
    destination: Path
    skills: list = field(default_factory=list)
    agents: list = field(default_factory=list)
    commands: list = field(default_factory=list)
    mode: str = "copy"
    namespace: str = ""

    def describe(self) -> str:
        lines = [
            "target      : %s (%s)" % (self.target.title, self.target.key),
            "destination : %s" % self.destination,
            "mode        : %s" % self.mode,
            "skills      : %d" % len(self.skills),
        ]
        if self.agents:
            lines.append("agents      : %d" % len(self.agents))
        if self.commands:
            lines.append("commands    : %d" % len(self.commands))
        if self.namespace:
            lines.append("namespace   : %s (prefixed to every skill name)" % self.namespace)
        if self.target.note:
            lines.append("note        : %s" % self.target.note)
        return "\n".join(lines)


def build_plan(
    repo_root: Path,
    target_key: str = "claude-code",
    platforms=None,
    scope: str = "user",
    dest: Path = None,
    link: bool = False,
    namespace: str = "",
    include_agents: bool = True,
    include_commands: bool = True,
    project_dir: Path = None,
) -> InstallPlan:
    """Work out exactly what would be installed, without touching the disk."""
    repo = model.load_repository(repo_root)

    if target_key not in TARGETS:
        raise ValueError(
            "unknown target %r; known targets: %s" % (target_key, ", ".join(sorted(TARGETS)))
        )
    target = TARGETS[target_key]

    if dest is not None:
        destination = Path(dest).expanduser().resolve()
    elif scope == "project":
        base = Path(project_dir or Path.cwd()).resolve()
        destination = base / target.project_root
    else:
        destination = Path.home() / target.user_root

    selected = _filter_skills(repo, platforms)

    plan = InstallPlan(
        target=target,
        destination=destination,
        skills=selected,
        mode="link" if link else "copy",
        namespace=namespace,
    )

    if include_agents and target.agents_dir:
        plan.agents = list(repo.agents)
    if include_commands and target.commands_dir:
        plan.commands = list(repo.workflows)

    return plan


def _filter_skills(repo: model.Repository, platforms):
    """Core skills always install; platform skills only for chosen platforms."""
    if not platforms:
        return list(repo.skills)

    wanted = {p.strip().lower() for p in platforms if p.strip()}
    if "all" in wanted:
        return list(repo.skills)

    known = {a.key for a in repo.adapters}
    unknown = wanted - known
    if unknown:
        raise ValueError(
            "unknown platform(s): %s; known: %s"
            % (", ".join(sorted(unknown)), ", ".join(sorted(known)))
        )

    return [
        s for s in repo.skills
        if s.layer in ("core", "meta") or s.platform in wanted
    ]


def apply_plan(plan: InstallPlan, repo_root: Path, dry_run: bool = False) -> list:
    """Execute the plan. Returns a list of human-readable actions taken."""
    actions = []
    skills_root = plan.destination / plan.target.skills_dir

    if not dry_run:
        skills_root.mkdir(parents=True, exist_ok=True)

    for skill in plan.skills:
        name = plan.namespace + skill.name if plan.namespace else skill.name
        target_dir = skills_root / name
        actions.append("skill  %s -> %s" % (skill.name, target_dir))
        if dry_run:
            continue
        _place_directory(skill.directory, target_dir, plan.mode, actions)
        if plan.namespace:
            _rewrite_name(target_dir / "SKILL.md", name)

    if plan.agents and plan.target.agents_dir:
        agents_root = plan.destination / plan.target.agents_dir
        if not dry_run:
            agents_root.mkdir(parents=True, exist_ok=True)
        for agent in plan.agents:
            target_file = agents_root / agent.path.name
            actions.append("agent  %s -> %s" % (agent.name, target_file))
            if not dry_run:
                shutil.copy2(agent.path, target_file)

    if plan.commands and plan.target.commands_dir:
        commands_root = plan.destination / plan.target.commands_dir
        if not dry_run:
            commands_root.mkdir(parents=True, exist_ok=True)
        for workflow in plan.commands:
            target_file = commands_root / workflow.path.name
            actions.append("command /%s -> %s" % (workflow.name, target_file))
            if not dry_run:
                shutil.copy2(workflow.path, target_file)

    return actions


def _place_directory(source: Path, target: Path, mode: str, actions: list) -> None:
    if target.is_symlink() or target.exists():
        if target.is_symlink() or target.is_file():
            target.unlink()
        else:
            shutil.rmtree(target)

    if mode == "link":
        try:
            os.symlink(source, target, target_is_directory=True)
            return
        except (OSError, NotImplementedError):
            actions.append(
                "       symlink unavailable (Windows needs Developer Mode); copied instead"
            )

    shutil.copytree(source, target)


def _rewrite_name(skill_md: Path, new_name: str) -> None:
    """Namespacing renames the directory, so the `name` field must follow.

    The spec requires `name` to equal the parent directory name; a namespaced
    install that skipped this would produce skills that silently fail to load.
    """
    if not skill_md.is_file():
        return
    text = skill_md.read_text(encoding="utf-8")
    lines = text.split("\n")
    for i, line in enumerate(lines[:40]):
        if line.startswith("name:"):
            lines[i] = "name: %s" % new_name
            break
    skill_md.write_text("\n".join(lines), encoding="utf-8")


def uninstall(plan: InstallPlan) -> list:
    """Remove everything a matching plan would have installed."""
    removed = []
    skills_root = plan.destination / plan.target.skills_dir
    for skill in plan.skills:
        name = plan.namespace + skill.name if plan.namespace else skill.name
        target_dir = skills_root / name
        if target_dir.is_symlink():
            target_dir.unlink()
            removed.append(str(target_dir))
        elif target_dir.is_dir():
            shutil.rmtree(target_dir)
            removed.append(str(target_dir))
    return removed
