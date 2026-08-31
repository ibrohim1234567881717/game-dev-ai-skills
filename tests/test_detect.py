"""Project detection tests.

Detection is the foundation the whole toolkit rests on: every version-sensitive
decision downstream is wrong if this is wrong. These tests assert on synthetic
projects carrying the same marker files real ones do.
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from uad import detect  # noqa: E402

import make_fixtures  # noqa: E402


@pytest.fixture(scope="module")
def fixtures():
    return make_fixtures.build()


def run(fixtures, name):
    return detect.detect(fixtures / name, repo_root=ROOT)


# --------------------------------------------------------------------------- #
# platform identification
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize(
    "fixture,expected",
    [
        ("unreal-sample", "unreal"),
        ("unity-sample", "unity"),
        ("godot-sample", "godot"),
        ("roblox-sample", "roblox"),
        ("minecraft-fabric-sample", "minecraft"),
        ("minecraft-neoforge-sample", "minecraft"),
        ("web-next-sample", "web"),
    ],
)
def test_identifies_platform(fixtures, fixture, expected):
    result = run(fixtures, fixture)
    assert result.primary is not None, "nothing detected for %s" % fixture
    assert result.primary.platform == expected
    assert result.primary.confidence >= detect.MIN_CONFIDENCE


def test_empty_project_detects_nothing(fixtures):
    result = run(fixtures, "empty-sample")
    assert result.primary is None
    assert result.matches == []


def test_evidence_names_the_file_that_matched(fixtures):
    """A detection you cannot audit is a detection you cannot trust."""
    result = run(fixtures, "unreal-sample")
    matched = [e.matched for e in result.primary.evidence]
    assert any(m.endswith(".uproject") for m in matched)


# --------------------------------------------------------------------------- #
# version extraction -- the reason detection exists
# --------------------------------------------------------------------------- #

def test_unreal_engine_version(fixtures):
    result = run(fixtures, "unreal-sample")
    assert result.primary.versions["engine"] == "5.7"


def test_unreal_detects_gameplay_ability_system(fixtures):
    result = run(fixtures, "unreal-sample")
    assert "gas" in result.primary.versions


def test_unity_editor_version_and_pipeline(fixtures):
    result = run(fixtures, "unity-sample")
    versions = result.primary.versions
    assert versions["editor"] == "6000.3.5f1"
    # The render pipeline decides whether shader and lighting advice is correct.
    assert versions["render_pipeline_urp"] == "17.3.0"
    assert "render_pipeline_hdrp" not in versions


def test_godot_major_version_is_unambiguous(fixtures):
    """config_version distinguishes Godot 3 from Godot 4, which share no API."""
    result = run(fixtures, "godot-sample")
    versions = result.primary.versions
    assert versions["config_version"] == "5"      # 5 => Godot 4.x
    assert versions["engine"] == "4.6"
    assert versions["renderer"] == "forward_plus"


def test_roblox_workflow_facts(fixtures):
    result = run(fixtures, "roblox-sample")
    versions = result.primary.versions
    # Whether the project is Rojo-synced decides if file edits are usable at all.
    assert versions["sync_tool"] == "rojo"
    assert versions["toolchain"] == "rokit"
    assert versions["luau_mode"] == "strict"


def test_minecraft_fabric_facts(fixtures):
    result = run(fixtures, "minecraft-fabric-sample")
    versions = result.primary.versions
    assert versions["loader"] == "fabric"
    assert versions["minecraft"] == "1.21.4"
    assert versions["mappings"] == "1.21.4+build.8"


def test_minecraft_neoforge_facts(fixtures):
    result = run(fixtures, "minecraft-neoforge-sample")
    versions = result.primary.versions
    assert versions["loader"] == "neoforge"
    assert versions["minecraft"] == "1.21.1"
    assert versions["neoforge_version"] == "21.1.72"
    # Parchment mappings version, not the Minecraft version it targets.
    assert versions["mappings"] == "2024.11.17"


def test_the_two_minecraft_loaders_are_never_confused(fixtures):
    """Producing NeoForge code for a Fabric mod is unusable output, not a near miss."""
    fabric = run(fixtures, "minecraft-fabric-sample").primary.versions["loader"]
    neoforge = run(fixtures, "minecraft-neoforge-sample").primary.versions["loader"]
    assert fabric == "fabric"
    assert neoforge == "neoforge"
    assert fabric != neoforge


def test_minecraft_required_facts_are_resolved(fixtures):
    """loader + version are declared required; unresolved must be empty."""
    for name in ("minecraft-fabric-sample", "minecraft-neoforge-sample"):
        result = run(fixtures, name)
        assert result.primary.unresolved == [], name


def test_web_framework_version_from_manifest(fixtures):
    result = run(fixtures, "web-next-sample")
    versions = result.primary.versions
    assert versions["framework_next"] == "15.1.3"
    assert versions["package_manager"].startswith("pnpm")
    assert versions["test_runner"] == "vitest"


# --------------------------------------------------------------------------- #
# false positives -- the failure mode that silently poisons everything after it
# --------------------------------------------------------------------------- #

def test_unity_embedded_package_json_is_not_a_web_project(fixtures):
    """Unity ships a package.json inside every embedded package."""
    result = run(fixtures, "unity-sample")
    assert [m.platform for m in result.matches] == ["unity"]


def test_monorepo_reports_both_with_the_right_primary(fixtures):
    """A real second ecosystem should be reported, not hidden."""
    result = run(fixtures, "unity-with-web-tools")
    platforms = [m.platform for m in result.matches]
    assert platforms[0] == "unity"
    assert "web" in platforms
    assert result.primary.confidence > result.matches[1].confidence


def test_no_fixture_detects_a_platform_it_is_not(fixtures):
    """Cross-check every fixture against every other platform."""
    expected = {
        "unreal-sample": {"unreal"},
        "unity-sample": {"unity"},
        "godot-sample": {"godot"},
        "roblox-sample": {"roblox"},
        "minecraft-fabric-sample": {"minecraft"},
        "minecraft-neoforge-sample": {"minecraft"},
        "web-next-sample": {"web"},
    }
    for fixture, allowed in expected.items():
        found = {m.platform for m in run(fixtures, fixture).matches}
        assert found <= allowed, "%s falsely matched %s" % (fixture, found - allowed)


def test_serialisable_output(fixtures):
    """The CLI's --json contract must not break silently."""
    import json

    payload = run(fixtures, "godot-sample").to_dict()
    json.dumps(payload)
    assert payload["primary"]["platform"] == "godot"
    assert payload["primary"]["versions"]["config_version"] == "5"
