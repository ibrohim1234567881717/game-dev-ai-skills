"""Selector precision tests.

Regression cover for three ranking defects found by running the acceptance
scenarios by hand. Each made the selector load skills that were technically
"matched" but had nothing to do with the task, which is exactly the context
pollution the toolkit claims to prevent.
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from uad import select  # noqa: E402

import make_fixtures  # noqa: E402


@pytest.fixture(scope="module")
def fixtures():
    return make_fixtures.build()


def run(fixtures, project, request, budget=6):
    return select.select(
        request, project_root=fixtures / project, repo_root=ROOT, budget=budget
    )


def relevance_picks(selection):
    """Skills chosen by scoring, excluding entry skills and dependencies."""
    return [s.name for s in selection.selected if s.reason == "matched request terms"]


# --------------------------------------------------------------------------- #
# 1. Naming the platform must not rank skills within that platform
# --------------------------------------------------------------------------- #

def test_platform_name_does_not_rank_within_platform(fixtures):
    """"Unreal" in the request once gave every unreal-* skill a name match.

    A performance question pulled in Enhanced Input and the ability system
    because their names contain "unreal". Detection already established the
    platform; the word must not also decide relevance inside it.
    """
    selection = run(
        fixtures, "unreal-sample",
        "Analyze this Unreal project and find likely performance bottlenecks",
    )
    picks = relevance_picks(selection)

    assert "unreal-enhanced-input" not in picks
    assert "unreal-gameplay-ability-system" not in picks
    assert "performance-profiling-method" in picks


def test_platform_word_alone_still_routes_to_the_platform(fixtures):
    """Stripping the platform word must not stop it selecting the platform."""
    selection = run(fixtures, "unreal-sample", "help me with this Unreal project")
    assert any(s.platform == "unreal" for s in selection.selected)
    assert "unreal" not in selection.excluded_platforms


# --------------------------------------------------------------------------- #
# 2. Synonyms normalise the request, not the skill library
# --------------------------------------------------------------------------- #

def test_synonyms_are_not_applied_to_skill_vocabulary(fixtures):
    """`multiplayer-networking` is tagged "lag compensation", where lag means
    latency. Folding that tag to "performance" made a frame-rate question
    select a netcode skill.
    """
    selection = run(
        fixtures, "unreal-sample",
        "Analyze this Unreal project and find likely performance bottlenecks",
    )
    assert "multiplayer-networking" not in relevance_picks(selection)


def test_request_synonyms_still_fold(fixtures):
    """The request side must keep folding: "lag" should reach performance skills."""
    selection = run(fixtures, "unity-sample", "the game lags badly in combat")
    assert "performance-profiling-method" in selection.names


def test_tokenize_folds_only_when_asked():
    assert "performance" in select.tokenize("bottleneck", fold=True)
    assert "performance" not in select.tokenize("bottleneck")
    # The literal is always kept, so exact names still match.
    assert "bottleneck" in select.tokenize("bottleneck", fold=True)


# --------------------------------------------------------------------------- #
# 3. A single common description word is noise; a rare one is signal
# --------------------------------------------------------------------------- #

def test_single_generic_description_word_does_not_select(fixtures):
    """"system" and "build" appear in most skills' prose and must not rank."""
    selection = run(fixtures, "web-next-sample", "Build an authentication system")
    picks = relevance_picks(selection)
    # game-architecture matched only on the word "system" before this fix.
    assert "game-architecture" not in picks


def test_single_specific_description_word_does_select(fixtures):
    """"authentication" is specific, so one occurrence is a real signal."""
    selection = run(fixtures, "web-next-sample", "Build an authentication system")
    # The security core skills must engage for an auth task.
    assert {"client-server-trust", "threat-modeling"} <= set(selection.names)


def test_document_frequency_distinguishes_common_from_rare():
    from uad import model

    repo = model.load_repository(ROOT)
    frequency = select._document_frequency(repo.skills)

    # A word used across the library is common by construction.
    assert frequency.get("version", 0) > select.RARE_TERM_MAX
    # A domain-specific word is not.
    assert 0 < frequency.get("authentication", 0) <= select.RARE_TERM_MAX


def test_stopwords_cover_generic_request_scaffolding():
    for word in ("system", "systems", "create", "implement", "setup"):
        assert word in select.STOPWORDS, word


# --------------------------------------------------------------------------- #
# Overall precision
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize(
    "project,request_text,expected_top",
    [
        ("unreal-sample", "find performance bottlenecks", "performance-profiling-method"),
        ("roblox-sample", "audit my remotes for exploits", "roblox-security"),
        ("minecraft-fabric-sample", "add a custom mob", "minecraft-entities-mobs"),
        ("godot-sample", "debug a crash on startup", "root-cause-debugging"),
    ],
)
def test_most_relevant_skill_is_selected(fixtures, project, request_text, expected_top):
    selection = run(fixtures, project, request_text)
    assert expected_top in selection.names


@pytest.mark.parametrize(
    "project",
    ["unreal-sample", "unity-sample", "godot-sample", "roblox-sample",
     "minecraft-fabric-sample", "web-next-sample"],
)
def test_selection_stays_small(fixtures, project):
    """Progressive disclosure means a bounded set, dependencies included."""
    selection = run(fixtures, project, "find and fix a performance problem")
    assert len(selection.selected) <= 16, [s.name for s in selection.selected]
