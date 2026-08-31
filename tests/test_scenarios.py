"""End-to-end scenario tests.

These encode the acceptance scenarios for the toolkit as executable assertions.
Each one runs a realistic developer request against a realistic project and
checks two things:

  * the RIGHT skills are selected, and
  * the WRONG platforms are excluded.

The second half is the point. Context spent on Unreal material during a Roblox
task is context not spent on the problem, and a claim of "progressive
disclosure" that is not asserted anywhere is just a claim.
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from uad import detect, select  # noqa: E402

import make_fixtures  # noqa: E402

ALL_PLATFORMS = {"unreal", "unity", "godot", "roblox", "minecraft", "web"}


@pytest.fixture(scope="module")
def fixtures():
    return make_fixtures.build()


def run(fixtures, project, request, budget=6):
    return select.select(
        request,
        project_root=fixtures / project,
        repo_root=ROOT,
        budget=budget,
    )


def platforms_of(selection):
    return {s.platform for s in selection.selected if s.platform != "any"}


# --------------------------------------------------------------------------- #
# Scenario A -- Unreal performance
# --------------------------------------------------------------------------- #

def test_scenario_a_unreal_performance(fixtures):
    """"Analyze this Unreal project and find likely performance bottlenecks." """
    selection = run(
        fixtures, "unreal-sample",
        "Analyze this Unreal project and find likely performance bottlenecks",
    )

    # Unreal is detected, with its engine version.
    assert selection.detected["primary"]["platform"] == "unreal"
    assert selection.detected["primary"]["versions"]["engine"] == "5.7"

    # Performance skills are loaded.
    assert "performance-profiling-method" in selection.names

    # Unreal material is loaded; no other engine's is.
    assert platforms_of(selection) <= {"unreal"}

    # Every other platform is explicitly excluded.
    for platform in ("roblox", "minecraft", "unity", "godot"):
        assert platform in selection.excluded_platforms


# --------------------------------------------------------------------------- #
# Scenario B -- Roblox security
# --------------------------------------------------------------------------- #

def test_scenario_b_roblox_secure_shop(fixtures):
    """"Create a secure shop system." Security and architecture must engage."""
    selection = run(fixtures, "roblox-sample", "Create a secure shop system")

    assert selection.detected["primary"]["platform"] == "roblox"

    # The platform's security skill is an entry skill and must always load.
    assert "roblox-security" in selection.names
    # And it must drag in the core trust rule via uad-requires.
    assert "client-server-trust" in selection.names

    assert platforms_of(selection) <= {"roblox"}
    assert "unreal" in selection.excluded_platforms
    assert "minecraft" in selection.excluded_platforms


def test_scenario_b_every_declared_dependency_is_present(fixtures):
    """Whatever roblox-security declares in uad-requires must be loaded with it.

    A skill is incomplete without its dependencies, so the selection must close
    over them. It does not matter whether a given dependency also happened to
    match on keywords -- what matters is that none is missing.
    """
    from uad import model

    selection = run(fixtures, "roblox-sample", "Create a secure shop system")
    repo = model.load_repository(ROOT)
    security = repo.skill_by_name("roblox-security")

    assert security is not None
    assert security.requires, "roblox-security should compose, not restate"
    for dependency in security.requires:
        assert dependency in selection.names, "missing dependency %r" % dependency


def test_dependency_closure_pulls_in_skills_that_did_not_match(fixtures):
    """The closure must add dependencies on its own, not rely on keyword luck.

    Verified with a request whose wording matches the platform skill but not the
    core skills it requires, so the only way they can appear is via the closure.
    """
    selection = run(fixtures, "roblox-sample", "restructure my ModuleScript layout")
    added_by_closure = [s for s in selection.selected if s.reason.startswith("required by")]
    assert added_by_closure, "no skill was pulled in by uad-requires"
    for skill in added_by_closure:
        assert skill.score == 0.0, "%s matched on keywords too" % skill.name


# --------------------------------------------------------------------------- #
# Scenario C -- Minecraft version and loader awareness
# --------------------------------------------------------------------------- #

def test_scenario_c_minecraft_custom_mob_fabric(fixtures):
    """"Add a custom mob." The loader and version must be resolved first."""
    selection = run(fixtures, "minecraft-fabric-sample", "Add a custom mob to my mod")

    primary = selection.detected["primary"]
    assert primary["platform"] == "minecraft"
    assert primary["versions"]["loader"] == "fabric"
    assert primary["versions"]["minecraft"] == "1.21.4"
    # Required facts are all resolved, so nothing blocks code generation.
    assert primary["unresolved"] == []

    assert "minecraft-entities-mobs" in selection.names
    assert platforms_of(selection) <= {"minecraft"}


def test_scenario_c_neoforge_is_not_confused_with_fabric(fixtures):
    """The same request against a NeoForge project must report NeoForge."""
    selection = run(fixtures, "minecraft-neoforge-sample", "Add a custom mob to my mod")
    versions = selection.detected["primary"]["versions"]
    assert versions["loader"] == "neoforge"
    assert versions["minecraft"] == "1.21.1"


# --------------------------------------------------------------------------- #
# Scenario D -- Godot character controller
# --------------------------------------------------------------------------- #

def test_scenario_d_godot_character_controller(fixtures):
    """"Debug my character controller." Godot 4 must be established, not assumed."""
    selection = run(fixtures, "godot-sample", "Debug my character controller")

    primary = selection.detected["primary"]
    assert primary["platform"] == "godot"
    # config_version 5 means Godot 4.x -- the fact that prevents 3.x API use.
    assert primary["versions"]["config_version"] == "5"

    assert "godot-project-conventions" in selection.names
    assert "root-cause-debugging" in selection.names
    assert platforms_of(selection) <= {"godot"}


# --------------------------------------------------------------------------- #
# Scenario E -- Web authentication
# --------------------------------------------------------------------------- #

def test_scenario_e_web_authentication(fixtures):
    """"Build an authentication system." Web and security skills must engage."""
    selection = run(fixtures, "web-next-sample", "Build an authentication system")

    assert selection.detected["primary"]["platform"] == "web"
    assert platforms_of(selection) <= {"web"}

    names = set(selection.names)
    # Either the web auth skill or the core trust/security skills must be present;
    # an auth task that pulls in neither is a routing failure.
    assert names & {"web-authentication", "client-server-trust", "threat-modeling",
                    "secure-coding"}, names

    for platform in ("unreal", "unity", "godot", "roblox", "minecraft"):
        assert platform in selection.excluded_platforms


# --------------------------------------------------------------------------- #
# Cross-cutting guarantees
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize(
    "project,expected",
    [
        ("unreal-sample", "unreal"),
        ("unity-sample", "unity"),
        ("godot-sample", "godot"),
        ("roblox-sample", "roblox"),
        ("minecraft-fabric-sample", "minecraft"),
        ("web-next-sample", "web"),
    ],
)
def test_no_cross_platform_context_pollution(fixtures, project, expected):
    """The core guarantee: one project's task never loads another engine's skills."""
    selection = run(fixtures, project, "help me improve this project")
    assert platforms_of(selection) <= {expected}
    assert set(selection.excluded_platforms) == ALL_PLATFORMS - {expected}


def test_platform_named_in_request_without_project_files(fixtures):
    """"Create an inventory system in Godot" in an empty folder still routes."""
    selection = run(fixtures, "empty-sample", "Create an inventory system in Godot")
    assert "godot" in platforms_of(selection) or any(
        "godot" in note for note in selection.notes
    )
    # And it must flag that the platform came from wording, not from files.
    assert any("request wording" in note for note in selection.notes)


def test_budget_is_respected_but_dependencies_are_exempt(fixtures):
    """Relevance picks are capped; uad-requires closure is not."""
    selection = run(fixtures, "roblox-sample", "Create a secure shop system", budget=3)
    relevance = [s for s in selection.selected if s.reason == "matched request terms"]
    assert len(relevance) <= 3
    # Dependencies still arrive even though the budget is spent.
    assert any(s.reason.startswith("required by") for s in selection.selected)


def test_selection_is_deterministic(fixtures):
    """Same request, same project, same result -- routing must be reproducible."""
    a = run(fixtures, "unity-sample", "fix a performance problem")
    b = run(fixtures, "unity-sample", "fix a performance problem")
    assert a.names == b.names


def test_every_adapter_has_entry_skills_that_exist(fixtures):
    """A platform whose entry skills are missing routes into nothing."""
    from uad import model

    repo = model.load_repository(ROOT)
    known = {s.name for s in repo.skills}
    for adapter in repo.adapters:
        entries = adapter.data.get("entry_skills") or []
        assert entries, "%s declares no entry skills" % adapter.key
        for name in entries:
            assert name in known, "%s entry skill %r missing" % (adapter.key, name)


def test_detection_and_selection_agree(fixtures):
    """The selector must not silently disagree with the detector."""
    result = detect.detect(fixtures / "unreal-sample", repo_root=ROOT)
    selection = select.select(
        "optimise rendering", repo_root=ROOT, detection=result, budget=6
    )
    assert selection.detected["primary"]["platform"] == result.primary.platform
