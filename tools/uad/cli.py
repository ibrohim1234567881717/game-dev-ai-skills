"""Command line interface for the Universal AI Dev toolkit.

    uad detect [PATH]           identify the platform and version of a project
    uad select "REQUEST"        show which skills would be loaded, and which not
    uad validate                check every skill, agent, workflow and adapter
    uad list                    list skills, adapters or agents
    uad install                 install into an AI coding client
    uad doctor                  report the environment and repository health
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import detect as detect_mod
from . import install as install_mod
from . import model
from . import select as select_mod
from . import validate as validate_mod


def _configure_stdout() -> None:
    """Windows consoles default to a legacy codepage that cannot print paths.

    Repository paths routinely contain non-ASCII characters, so force UTF-8
    rather than crashing halfway through a report.
    """
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def _repo_root(args) -> Path:
    if getattr(args, "repo", None):
        return Path(args.repo).resolve()
    return model.find_repo_root(Path(__file__))


# --------------------------------------------------------------------------- #
# commands
# --------------------------------------------------------------------------- #

def cmd_detect(args) -> int:
    root = _repo_root(args)
    result = detect_mod.detect(args.path, repo_root=root, max_depth=args.depth)

    if args.json:
        print(json.dumps(result.to_dict(), indent=2))
        return 0

    print("Project : %s" % result.project_root)
    print("Scanned : %d files%s" % (result.scanned_files, " (truncated)" if result.truncated else ""))

    if not result.matches:
        print("\nNo platform detected.")
        print("Add --depth to search deeper, or name the platform in your request.")
        return 0

    for index, match in enumerate(result.matches):
        label = "PRIMARY" if index == 0 else "also present"
        print("\n%s: %s (%s) - confidence %d/100" % (label, match.title, match.platform, match.confidence))
        facts = {k: v for k, v in match.versions.items() if k != "_sources"}
        if facts:
            print("  facts:")
            for key, value in facts.items():
                source = match.versions.get("_sources", {}).get(key, "")
                suffix = "   <- %s" % source if source else ""
                print("    %-22s %s%s" % (key, value, suffix))
        if match.unresolved:
            print("  UNRESOLVED (must be established before writing code):")
            for label_name in match.unresolved:
                print("    - %s" % label_name)
        if args.verbose:
            print("  evidence:")
            for item in match.evidence:
                print("    %-28s +%-3d %s" % (item.signal, item.weight, item.matched))

    if result.ambiguous:
        print("\nWARNING: the top two platforms score within %d points of each other."
              % detect_mod.PRIMARY_MARGIN)
        print("Confirm the intended target before generating version-sensitive code.")

    return 0


def cmd_select(args) -> int:
    root = _repo_root(args)
    selection = select_mod.select(
        args.request,
        project_root=args.path,
        repo_root=root,
        budget=args.budget,
    )

    if args.json:
        print(json.dumps(selection.to_dict(), indent=2))
        return 0

    print("Request : %s" % selection.request)
    primary = (selection.detected or {}).get("primary")
    if primary:
        facts = {k: v for k, v in (primary.get("versions") or {}).items() if k != "_sources"}
        print("Detected: %s (confidence %d) %s" % (primary["platform"], primary["confidence"], facts or ""))
    else:
        print("Detected: nothing (selection falls back to the request wording)")

    print("\nSkills to load (%d):" % len(selection.selected))
    for item in selection.selected:
        print("  %-34s %-9s %-9s %s" % (item.name, item.layer, item.platform, item.reason))

    if selection.excluded_platforms:
        print("\nExcluded platforms (kept out of context): %s"
              % ", ".join(selection.excluded_platforms))

    for note in selection.notes:
        print("\nNOTE: %s" % note)

    return 0


def cmd_validate(args) -> int:
    root = _repo_root(args)
    report = validate_mod.validate_repository(root, strict=args.strict)

    for issue in report.issues:
        print(issue.format(root))

    print("\nChecked %d documents: %d error(s), %d warning(s)."
          % (report.checked, len(report.errors), len(report.warnings)))

    if report.ok:
        print("VALID")
        return 0
    print("INVALID")
    return 1


def cmd_list(args) -> int:
    root = _repo_root(args)
    repo = model.load_repository(root)

    if args.what == "adapters":
        for adapter in repo.adapters:
            print("%-12s %-24s %d skills" % (adapter.key, adapter.title, len(adapter.skills)))
        return 0

    if args.what == "agents":
        for agent in repo.agents:
            print("%-26s %s" % (agent.name, agent.description[:90]))
        return 0

    if args.what == "workflows":
        for workflow in repo.workflows:
            print("/%-22s %s" % (workflow.name, workflow.description[:90]))
        return 0

    skills = repo.skills
    if args.platform:
        skills = [s for s in skills if s.platform == args.platform or s.layer == "core"]
    if args.domain:
        skills = [s for s in skills if s.domain == args.domain]

    for skill in sorted(skills, key=lambda s: (s.platform, s.domain, s.name)):
        print("%-36s %-10s %-14s %s" % (skill.name, skill.platform, skill.domain, skill.description[:70]))
    print("\n%d skill(s)." % len(skills))
    return 0


def cmd_install(args) -> int:
    root = _repo_root(args)
    try:
        plan = install_mod.build_plan(
            root,
            target_key=args.target,
            platforms=args.platforms,
            scope=args.scope,
            dest=args.dest,
            link=args.link,
            namespace=args.namespace,
            include_agents=not args.no_agents,
            include_commands=not args.no_commands,
            project_dir=args.project_dir,
        )
    except ValueError as exc:
        print("error: %s" % exc, file=sys.stderr)
        return 2

    print(plan.describe())
    print()

    if args.uninstall:
        removed = install_mod.uninstall(plan)
        for path in removed:
            print("removed %s" % path)
        print("\nRemoved %d item(s)." % len(removed))
        return 0

    actions = install_mod.apply_plan(plan, root, dry_run=args.dry_run)
    if args.verbose or args.dry_run:
        for action in actions:
            print(action)
    print("\n%s %d skill(s), %d agent(s), %d command(s)."
          % ("Would install" if args.dry_run else "Installed",
             len(plan.skills), len(plan.agents), len(plan.commands)))
    if not args.dry_run:
        print("Restart your AI client so it picks up the new skills.")
    return 0


def cmd_doctor(args) -> int:
    from . import miniyaml

    root = _repo_root(args)
    print("repository : %s" % root)
    print("python     : %s" % sys.version.split()[0])
    print("yaml       : %s" % ("PyYAML" if miniyaml.USING_PYYAML else "built-in subset parser"))

    repo = model.load_repository(root)
    print("skills     : %d (%d core, %d platform)"
          % (len(repo.skills),
             len([s for s in repo.skills if s.layer == "core"]),
             len([s for s in repo.skills if s.layer == "platform"])))
    print("adapters   : %d (%s)" % (len(repo.adapters), ", ".join(a.key for a in repo.adapters)))
    print("agents     : %d" % len(repo.agents))
    print("workflows  : %d" % len(repo.workflows))

    report = validate_mod.validate_repository(root)
    print("validation : %d error(s), %d warning(s)" % (len(report.errors), len(report.warnings)))

    print("\ninstall targets:")
    for key, target in sorted(install_mod.TARGETS.items()):
        mark = "verified" if target.verified else "unverified"
        print("  %-12s %-30s %s" % (key, target.title, mark))

    return 0 if report.ok else 1


# --------------------------------------------------------------------------- #
# parser
# --------------------------------------------------------------------------- #

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="uad",
        description="Universal AI Dev - skills and agents for game and software development.",
    )
    parser.add_argument("--repo", help="path to the toolkit repository (default: auto-detect)")
    subparsers = parser.add_subparsers(dest="command", required=True)

    p_detect = subparsers.add_parser("detect", help="identify a project's platform and version")
    p_detect.add_argument("path", nargs="?", default=".", help="project directory (default: .)")
    p_detect.add_argument("--json", action="store_true", help="machine-readable output")
    p_detect.add_argument("--verbose", "-v", action="store_true", help="show matched evidence")
    p_detect.add_argument("--depth", type=int, default=detect_mod.MAX_DEPTH, help="scan depth")
    p_detect.set_defaults(func=cmd_detect)

    p_select = subparsers.add_parser("select", help="show which skills a request would load")
    p_select.add_argument("request", help="the developer request, in quotes")
    p_select.add_argument("--path", default=".", help="project directory (default: .)")
    p_select.add_argument("--budget", type=int, default=select_mod.DEFAULT_BUDGET,
                          help="maximum relevance-selected skills (dependencies are extra)")
    p_select.add_argument("--json", action="store_true", help="machine-readable output")
    p_select.set_defaults(func=cmd_select)

    p_validate = subparsers.add_parser("validate", help="validate the repository")
    p_validate.add_argument("--strict", action="store_true", help="treat warnings as errors")
    p_validate.set_defaults(func=cmd_validate)

    p_list = subparsers.add_parser("list", help="list repository contents")
    p_list.add_argument("what", nargs="?", default="skills",
                        choices=["skills", "adapters", "agents", "workflows"])
    p_list.add_argument("--platform", help="filter to one platform")
    p_list.add_argument("--domain", help="filter to one domain")
    p_list.set_defaults(func=cmd_list)

    p_install = subparsers.add_parser("install", help="install into an AI coding client")
    p_install.add_argument("--target", default="claude-code",
                           choices=sorted(install_mod.TARGETS),
                           help="which client to install for")
    p_install.add_argument("--platforms", nargs="*", default=None,
                           help="platforms to include (default: all). Core skills always install.")
    p_install.add_argument("--scope", default="user", choices=["user", "project"],
                           help="install for the whole user or just one project")
    p_install.add_argument("--project-dir", default=None,
                           help="project directory when --scope project")
    p_install.add_argument("--dest", default=None, help="explicit destination directory")
    p_install.add_argument("--link", action="store_true",
                           help="symlink instead of copying (needs Developer Mode on Windows)")
    p_install.add_argument("--namespace", default="",
                           help="prefix every skill name, e.g. uad- (avoids collisions)")
    p_install.add_argument("--no-agents", action="store_true", help="skip subagent definitions")
    p_install.add_argument("--no-commands", action="store_true", help="skip slash commands")
    p_install.add_argument("--dry-run", action="store_true", help="show what would happen")
    p_install.add_argument("--uninstall", action="store_true", help="remove a previous install")
    p_install.add_argument("--verbose", "-v", action="store_true", help="list every action")
    p_install.set_defaults(func=cmd_install)

    p_doctor = subparsers.add_parser("doctor", help="report environment and repository health")
    p_doctor.set_defaults(func=cmd_doctor)

    return parser


def main(argv=None) -> int:
    _configure_stdout()
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except model.LoadError as exc:
        print("error: %s" % exc, file=sys.stderr)
        return 2
