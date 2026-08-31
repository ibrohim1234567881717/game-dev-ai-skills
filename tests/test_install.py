"""Installation tests.

The claim these defend: installing only the platforms a developer works on is
what keeps every session's skill index small. If platform filtering silently
installed everything, the context-efficiency claim would be false.
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from uad import install, model  # noqa: E402


@pytest.fixture(scope="module")
def repo():
    return model.load_repository(ROOT)


def test_every_known_target_builds_a_plan(tmp_path):
    for key in install.TARGETS:
        plan = install.build_plan(ROOT, target_key=key, dest=tmp_path / key)
        assert plan.skills, "%s installed no skills" % key
        assert plan.target.key == key


def test_unknown_target_is_rejected(tmp_path):
    with pytest.raises(ValueError):
        install.build_plan(ROOT, target_key="not-a-real-client", dest=tmp_path)


def test_unknown_platform_is_rejected(tmp_path):
    with pytest.raises(ValueError):
        install.build_plan(ROOT, platforms=["nintendo"], dest=tmp_path)


def test_platform_filter_excludes_other_platforms(tmp_path, repo):
    """The context-efficiency claim, asserted."""
    plan = install.build_plan(ROOT, platforms=["godot"], dest=tmp_path)
    platforms = {s.platform for s in plan.skills}
    assert platforms <= {"any", "godot"}
    assert "unreal" not in platforms
    assert "minecraft" not in platforms


def test_core_skills_always_install(tmp_path):
    plan = install.build_plan(ROOT, platforms=["web"], dest=tmp_path)
    layers = {s.layer for s in plan.skills}
    assert "core" in layers
    assert any(s.name == "client-server-trust" for s in plan.skills)


def test_filtered_install_is_smaller_than_full(tmp_path):
    full = install.build_plan(ROOT, dest=tmp_path / "full")
    one = install.build_plan(ROOT, platforms=["godot"], dest=tmp_path / "one")
    assert len(one.skills) < len(full.skills)


def test_dry_run_touches_nothing(tmp_path):
    plan = install.build_plan(ROOT, dest=tmp_path / "dest")
    actions = install.apply_plan(plan, ROOT, dry_run=True)
    assert actions
    assert not (tmp_path / "dest").exists()


def test_install_copies_skill_directories(tmp_path):
    plan = install.build_plan(ROOT, platforms=["godot"], dest=tmp_path / "dest")
    install.apply_plan(plan, ROOT, dry_run=False)

    skills_root = tmp_path / "dest" / "skills"
    assert skills_root.is_dir()
    installed = {p.name for p in skills_root.iterdir() if p.is_dir()}
    assert "godot-project-conventions" in installed
    assert "client-server-trust" in installed
    assert not any(name.startswith("unreal-") for name in installed)

    # Bundled resources travel with the skill.
    md = skills_root / "godot-project-conventions" / "SKILL.md"
    assert md.is_file()
    assert md.read_text(encoding="utf-8").startswith("---")


def test_install_is_idempotent(tmp_path):
    plan = install.build_plan(ROOT, platforms=["godot"], dest=tmp_path / "dest")
    install.apply_plan(plan, ROOT, dry_run=False)
    first = sorted(p.name for p in (tmp_path / "dest" / "skills").iterdir())
    install.apply_plan(plan, ROOT, dry_run=False)
    second = sorted(p.name for p in (tmp_path / "dest" / "skills").iterdir())
    assert first == second


def test_namespace_renames_directory_and_name_field(tmp_path):
    """The spec requires name == directory, so namespacing must rewrite both."""
    plan = install.build_plan(
        ROOT, platforms=["godot"], dest=tmp_path / "dest", namespace="uad-"
    )
    install.apply_plan(plan, ROOT, dry_run=False)

    folder = tmp_path / "dest" / "skills" / "uad-godot-project-conventions"
    assert folder.is_dir()
    text = (folder / "SKILL.md").read_text(encoding="utf-8")
    assert "name: uad-godot-project-conventions" in text
    assert "\nname: godot-project-conventions" not in text


def test_namespaced_install_still_validates(tmp_path):
    """A namespaced install must remain spec-compliant, not just look installed."""
    from uad import validate

    dest = tmp_path / "dest"
    plan = install.build_plan(ROOT, platforms=["godot"], dest=dest, namespace="uad-")
    install.apply_plan(plan, ROOT, dry_run=False)

    # Rebuild a minimal repo shape around the installed skills so the validator
    # can load them, then check the spec rules that namespacing could break.
    (dest / "tools" / "uad").mkdir(parents=True, exist_ok=True)
    report = validate.validate_repository(dest)
    naming = [
        i for i in report.errors
        if "parent directory" in i.message or "must be lowercase" in i.message
    ]
    assert not naming, "\n".join(i.format(dest) for i in naming)


def test_agents_and_commands_install_for_claude_code(tmp_path):
    plan = install.build_plan(ROOT, target_key="claude-code", dest=tmp_path / "dest")
    assert plan.agents
    assert plan.commands
    install.apply_plan(plan, ROOT, dry_run=False)
    assert (tmp_path / "dest" / "agents" / "orchestrator.md").is_file()
    assert (tmp_path / "dest" / "commands" / "fix-bug.md").is_file()


def test_targets_without_agent_support_get_skills_only(tmp_path):
    plan = install.build_plan(ROOT, target_key="codex", dest=tmp_path / "dest")
    assert plan.skills
    assert plan.agents == []
    assert plan.commands == []


def test_uninstall_removes_what_install_created(tmp_path):
    dest = tmp_path / "dest"
    plan = install.build_plan(ROOT, platforms=["godot"], dest=dest)
    install.apply_plan(plan, ROOT, dry_run=False)
    assert (dest / "skills" / "godot-project-conventions").is_dir()

    removed = install.uninstall(plan)
    assert removed
    assert not (dest / "skills" / "godot-project-conventions").exists()
