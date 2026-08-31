#!/usr/bin/env python3
"""Skill quality audit.

`uad validate` checks that a skill is *well-formed*. This checks whether it is
*good*: that its Validation section contains something you could actually run,
that a platform skill says something real about versions, that agents and
adapters point at skills that exist, and that no skill makes an absolute claim
about behaviour that is version-dependent.

These are heuristics, not proofs. A finding is a prompt to look, not a verdict —
the first version of this tool reported three excellent skills as having no
version awareness because they wrote "4.x" and "Unity 6" rather than the literal
word "version".

    python tools/audit.py            report findings
    python tools/audit.py --strict   exit non-zero if any are found
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from uad import model  # noqa: E402

# Something in a Validation section that a reader could actually execute.
RUNNABLE = re.compile(
    r"`[^`]*(grep|python|npm|npx|pnpm|yarn|curl|gradlew|pytest|git |stat |"
    r"selene|stylua|luau-lsp|axe|lighthouse|r\.[A-Za-z]|ProfileGPU|Insights|"
    r"net\.Pkt|Engine\.)[^`]*`|```",
    re.I,
)

# Either the word, or an actual version number: "4.x", "Unity 6", "2018.3",
# "1.21.4", "5.7". The literal-word-only check produced false positives.
VERSION_AWARE = re.compile(
    r"\bversion|\brolling\b|\bloader\b|\bpipeline\b|config_version|lockfile|"
    r"\bmappings\b|\b\d+\.(x|\d+)\b|\bUnity\s*\d|\bGodot\s*\d|\bUE\s*\d",
    re.I,
)

# Claims that cannot be true of a moving API surface.
ABSOLUTE = re.compile(
    r"\balways use\b|\bnever changes\b|\bin all versions\b|\bworks in every\b",
    re.I,
)


def section(body: str, heading: str) -> str:
    match = re.search(
        r"^##\s+%s\s*$(.*?)(?=^##\s|\Z)" % re.escape(heading), body, re.M | re.S
    )
    return match.group(1) if match else ""


def audit(root: Path):
    """Return (findings, notes).

    Findings are things to fix. Notes are things to look at once, where the
    answer is legitimately sometimes "no" -- a permanently noisy audit is an
    audit nobody reads.
    """
    repo = model.load_repository(root)
    findings = []
    notes = []

    def add(where, message):
        findings.append((where, message))

    def note(where, message):
        notes.append((where, message))

    # --- reachability ------------------------------------------------------ #
    for adapter in repo.adapters:
        entries = adapter.data.get("entry_skills") or []
        if not entries:
            add(adapter.path, "adapter declares no entry skills, so a vague "
                              "request loads nothing platform-specific")
        for name in entries:
            if not repo.skill_by_name(name):
                add(adapter.path, "entry skill %r does not exist" % name)

    for agent in repo.agents:
        for name in agent.meta_list("uad-skills"):
            if not repo.skill_by_name(name):
                add(agent.path, "names skill %r, which does not exist" % name)

    # --- per-skill quality ------------------------------------------------- #
    for skill in repo.skills:
        validation = section(skill.body, "Validation")
        if not RUNNABLE.search(validation) and len(validation) < 400:
            add(skill.path, "Validation has nothing runnable and is very short; "
                            "state a command and what passing looks like")

        if skill.layer == "platform":
            constraints = section(skill.body, "Version constraints")
            if not VERSION_AWARE.search(constraints):
                add(skill.path, "Version constraints names no version, API "
                                "generation or version-bearing file")

        if ABSOLUTE.search(skill.body):
            add(skill.path, "makes an absolute claim about behaviour that is "
                            "version-dependent")

        not_use = section(skill.body, "When NOT to use")
        if len(not_use.strip()) < 60:
            add(skill.path, "'When NOT to use' is too thin to steer an agent "
                            "away from the neighbouring skill")

    # --- composition ------------------------------------------------------- #
    for skill in repo.skills:
        if skill.layer == "platform" and not skill.requires:
            note(skill.path, "requires no core skill -- check whether it "
                             "restates general method. Legitimate when the "
                             "platform has no core counterpart (CSS layout).")

    return findings, notes


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Audit skill quality.")
    parser.add_argument("--strict", action="store_true",
                        help="exit non-zero when findings exist")
    parser.add_argument("--repo", default=None)
    args = parser.parse_args(argv)

    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass

    root = Path(args.repo).resolve() if args.repo else model.find_repo_root(Path(__file__))
    findings, notes = audit(root)

    def show(rows, label):
        if not rows:
            return
        print("%s:" % label)
        for where, message in rows:
            try:
                location = str(Path(where).relative_to(root)).replace("\\", "/")
            except ValueError:
                location = str(where)
            print("  %-56s %s" % (location, message))
        print()

    show(findings, "FINDINGS")
    show(notes, "NOTES (look once; sometimes the answer is legitimately no)")

    print("%d finding(s), %d note(s)." % (len(findings), len(notes)))
    if findings:
        print("These are heuristics. Read each one before acting on it.")
        return 1 if args.strict else 0
    print("No quality findings.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
