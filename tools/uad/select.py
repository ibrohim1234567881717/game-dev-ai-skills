"""Skill selection -- the progressive-disclosure engine.

Given a request and a detected project, decide the smallest set of skills that
should be loaded into context. The point is as much what gets *left out*: a
Roblox task must never drag Unreal, Unity and Minecraft material along with it.

Selection runs in four passes:

1. **Gate by platform.** Only core skills and skills for detected platforms are
   eligible. Everything else is excluded, and the exclusion is reported so the
   behaviour can be asserted in tests.
2. **Score by relevance.** Keyword overlap between the request and each skill's
   name, tags, domain and description.
3. **Seed.** A detected platform always contributes its adapter's entry skills,
   so the agent gets the platform's ground rules even on a vague request.
4. **Close over dependencies.** `uad-requires` edges are followed transitively;
   dependencies are exempt from the budget because a skill is incomplete
   without them.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from . import detect as detect_mod
from . import model

DEFAULT_BUDGET = 6

# A description term appearing in at most this many skills counts as specific
# enough to justify a match on its own.
RARE_TERM_MAX = 4

# Tokens too common to carry signal in a development request.
STOPWORDS = {
    "a", "об", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do",
    "does", "for", "from", "get", "have", "help", "how", "i", "if", "in", "is",
    "it", "its", "make", "me", "my", "need", "not", "of", "on", "or", "our",
    "please", "should", "so", "some", "that", "the", "their", "then", "there",
    "this", "to", "up", "use", "want", "was", "we", "what", "when", "where",
    "which", "why", "will", "with", "you", "your", "project", "game", "code",
    "please", "add", "new", "using", "into", "out", "all", "any", "just",
    # Generic request scaffolding. These appear in almost every skill's prose,
    # so matching on them ranks by verbosity rather than by relevance.
    "system", "systems", "create", "creating", "implement", "implementing",
    "set", "setup", "give", "show", "tell", "look", "check", "thing", "things",
    "work", "works", "working", "better", "best", "good", "way", "ways",
}

# Words that mean the same thing to a developer but not to a string match.
# A value may be a tuple when one word should reach several canonical terms:
# "optimize" is both an optimisation word and a performance word, and a skill
# named `unreal-performance-profiling` must be reachable from either.
SYNONYMS = {
    # Inflected forms are listed explicitly rather than stemmed: a stemmer
    # would also collapse words that must stay distinct, and the vocabulary
    # developers actually use here is small enough to enumerate.
    "perf": "performance", "fps": "performance", "framerate": "performance",
    "lag": "performance", "lags": "performance", "laggy": "performance",
    "lagging": "performance", "slow": "performance", "slower": "performance",
    "slowdown": "performance", "stutter": "performance",
    "stutters": "performance", "stuttering": "performance",
    "hitch": "performance", "hitches": "performance", "hitching": "performance",
    "freeze": "performance", "freezes": "performance", "freezing": "performance",
    "bottleneck": "performance", "bottlenecks": "performance",
    "optimize": ("optimization", "performance"),
    "optimise": ("optimization", "performance"),
    "optimizing": ("optimization", "performance"),
    "optimising": ("optimization", "performance"),
    "optimization": ("optimization", "performance"),
    "optimisation": ("optimization", "performance"),
    "profiling": ("profile", "performance"),
    "profiler": ("profile", "performance"),
    "profile": ("profile", "performance"),
    "bug": "debugging", "bugs": "debugging", "crash": "debugging",
    "crashes": "debugging", "crashing": "debugging", "broken": "debugging",
    "breaks": "debugging", "breaking": "debugging",
    "fix": "debugging", "fixing": "debugging", "error": "debugging",
    "errors": "debugging", "exception": "debugging", "exceptions": "debugging",
    "debug": "debugging", "debugging": "debugging", "failing": "debugging",
    "fails": "debugging", "failure": "debugging",
    "secure": "security", "exploit": "security", "exploits": "security",
    "hack": "security", "hacker": "security", "cheat": "security",
    "vulnerability": "security", "vulnerabilities": "security",
    "auth": "authentication", "login": "authentication",
    "signup": "authentication", "session": "authentication",
    "net": "networking", "network": "networking", "replication": "networking",
    "multiplayer": "networking", "netcode": "networking",
    "shaders": "shader", "lighting": "light", "lights": "light",
    "memory": "memory", "ram": "memory", "vram": "memory", "gpu": "gpu",
    "cpu": "cpu", "draw": "drawcalls", "drawcall": "drawcalls",
    "mob": "entity", "mobs": "entity", "entities": "entity",
    "npc": "ai", "enemy": "ai", "enemies": "ai",
    "ui": "ui", "hud": "ui", "menu": "ui", "widget": "ui", "gui": "ui",
    "save": "persistence", "saving": "persistence", "load": "persistence",
    "savegame": "persistence", "datastore": "persistence",
    "test": "testing", "tests": "testing", "qa": "testing",
    "review": "review", "reviewing": "review",
    "architecture": "architecture", "design": "architecture",
    "structure": "architecture", "refactor": "refactoring",
    "shop": "economy", "store": "economy", "purchase": "economy",
    "monetization": "economy", "currency": "economy",
    "inventory": "inventory", "item": "inventory", "items": "inventory",
    "controller": "character", "movement": "character", "player": "character",
    "walk": "character", "jump": "character",
}

TOKEN_RE = re.compile(r"[a-z0-9#+.]+")


@dataclass
class SelectedSkill:
    name: str
    path: str
    score: float
    reason: str
    layer: str
    platform: str

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "path": self.path,
            "score": round(self.score, 2),
            "reason": self.reason,
            "layer": self.layer,
            "platform": self.platform,
        }


@dataclass
class Selection:
    request: str
    detected: dict = field(default_factory=dict)
    selected: list = field(default_factory=list)
    excluded_platforms: list = field(default_factory=list)
    notes: list = field(default_factory=list)

    @property
    def names(self) -> list:
        return [s.name for s in self.selected]

    def to_dict(self) -> dict:
        return {
            "request": self.request,
            "detected": self.detected,
            "selected": [s.to_dict() for s in self.selected],
            "excluded_platforms": self.excluded_platforms,
            "notes": self.notes,
        }


def tokenize(text: str, fold: bool = False) -> set:
    """Lowercase, split, drop stopwords, optionally folding synonyms.

    Folding is applied to the *request* only. Expanding a skill's own vocabulary
    would misfile it: `multiplayer-networking` is tagged "lag compensation",
    where "lag" means latency, and folding that to "performance" made a
    frame-rate question match a netcode skill.
    """
    tokens = set()
    for raw in TOKEN_RE.findall(text.lower()):
        word = raw.strip(".")
        if not word or word in STOPWORDS or len(word) < 2:
            continue
        # The literal is always kept, so exact names like "c#" or "niagara" hit.
        tokens.add(word)
        if fold:
            canonical = SYNONYMS.get(word)
            if isinstance(canonical, tuple):
                tokens.update(canonical)
            elif canonical is not None:
                tokens.add(canonical)
    return tokens


def select(
    request: str,
    project_root=None,
    repo_root=None,
    budget: int = DEFAULT_BUDGET,
    detection=None,
) -> Selection:
    """Choose the skills to load for `request` in the project at `project_root`."""
    repo_root = Path(repo_root) if repo_root else model.find_repo_root()
    repo = model.load_repository(repo_root)

    if detection is None and project_root is not None:
        detection = detect_mod.detect(project_root, repo_root=repo_root)

    result = Selection(request=request)

    active_platforms = set()
    if detection is not None:
        result.detected = detection.to_dict()
        for match in detection.matches:
            active_platforms.add(match.platform)
        if detection.ambiguous and len(detection.matches) > 1:
            result.notes.append(
                "Detection is ambiguous between %s -- confirm the target before "
                "generating version-sensitive code."
                % ", ".join(m.platform for m in detection.matches[:2])
            )

    request_tokens = tokenize(request, fold=True)

    # A request can name a platform that the files do not (yet) show, e.g.
    # "start a Godot project" in an empty folder.
    for adapter in repo.adapters:
        aliases = {adapter.key} | {
            str(a).lower() for a in (adapter.data.get("aliases") or [])
        }
        if aliases & request_tokens:
            if adapter.key not in active_platforms:
                active_platforms.add(adapter.key)
                result.notes.append(
                    "Platform %r came from the request wording, not from project "
                    "files -- confirm the version before writing code." % adapter.key
                )

    all_platforms = {a.key for a in repo.adapters}
    result.excluded_platforms = sorted(all_platforms - active_platforms)

    # Naming a platform must not rank skills *within* that platform. Gating has
    # already used the platform; leaving "unreal" in the scored tokens gives
    # every unreal-* skill a name match, so a performance request pulls in
    # Enhanced Input and the ability system alongside the profiling skill.
    platform_tokens = set()
    for adapter in repo.adapters:
        platform_tokens.add(adapter.key)
        platform_tokens.update(str(a).lower() for a in (adapter.data.get("aliases") or []))
    scoring_tokens = request_tokens - platform_tokens
    document_frequency = _document_frequency(repo.skills)

    # --- pass 2: score ----------------------------------------------------- #
    candidates = []
    for skill in repo.skills:
        if skill.layer == "platform" and skill.platform not in active_platforms:
            continue
        score = _score_skill(skill, scoring_tokens, platform_tokens, document_frequency)
        if score > 0:
            candidates.append((score, skill))

    candidates.sort(key=lambda pair: (-pair[0], pair[1].name))

    chosen = {}

    # --- pass 3: seed platform entry skills -------------------------------- #
    for platform in sorted(active_platforms):
        adapter = repo.adapter_by_key(platform)
        if adapter is None:
            continue
        for name in adapter.data.get("entry_skills") or []:
            skill = repo.skill_by_name(str(name))
            if skill is not None and skill.name not in chosen:
                chosen[skill.name] = SelectedSkill(
                    name=skill.name,
                    path=_rel(skill.path, repo.root),
                    score=float(
                        _score_skill(skill, scoring_tokens, platform_tokens, document_frequency)
                    ),
                    reason="platform entry skill for %s" % platform,
                    layer=skill.layer,
                    platform=skill.platform,
                )

    # --- relevance picks up to the budget ---------------------------------- #
    for score, skill in candidates:
        if len(chosen) >= budget:
            break
        if skill.name in chosen:
            continue
        chosen[skill.name] = SelectedSkill(
            name=skill.name,
            path=_rel(skill.path, repo.root),
            score=float(score),
            reason="matched request terms",
            layer=skill.layer,
            platform=skill.platform,
        )

    # --- pass 4: dependency closure (exempt from the budget) --------------- #
    queue = list(chosen)
    while queue:
        current = repo.skill_by_name(queue.pop())
        if current is None:
            continue
        for dependency in current.requires:
            if dependency in chosen:
                continue
            dep_skill = repo.skill_by_name(dependency)
            if dep_skill is None:
                continue
            chosen[dependency] = SelectedSkill(
                name=dep_skill.name,
                path=_rel(dep_skill.path, repo.root),
                score=0.0,
                reason="required by %s" % current.name,
                layer=dep_skill.layer,
                platform=dep_skill.platform,
            )
            queue.append(dependency)

    result.selected = sorted(chosen.values(), key=lambda s: (-s.score, s.name))

    if not result.selected:
        result.notes.append(
            "No skill matched. Describe the task in terms of the platform and the "
            "problem (for example 'Unity draw call spikes on mobile')."
        )

    return result


def _document_frequency(skills) -> dict:
    """How many skills each description term appears in.

    Used to tell a specific term from a generic one without a stopword list
    that would need maintaining as the library grows.
    """
    frequency = {}
    for skill in skills:
        for token in tokenize(skill.description):
            frequency[token] = frequency.get(token, 0) + 1
    return frequency


def _score_skill(
    skill: model.Skill,
    request_tokens: set,
    platform_tokens: set = None,
    document_frequency: dict = None,
) -> float:
    """Weighted keyword overlap. Name and tags outrank prose.

    `platform_tokens` are stripped from the skill's own name and tags: the
    platform is established by detection, so matching on it would rank every
    skill of that platform equally regardless of what the task is about.
    """
    if not request_tokens:
        return 0.0
    platform_tokens = platform_tokens or set()
    document_frequency = document_frequency or {}

    name_tokens = tokenize(skill.name.replace("-", " ")) - platform_tokens
    tag_tokens = tokenize(" ".join(skill.tags)) - platform_tokens
    domain_tokens = tokenize(skill.domain.replace("-", " "))
    desc_tokens = tokenize(skill.description) - platform_tokens

    score = 0.0
    score += 4.0 * len(request_tokens & name_tokens)
    score += 3.0 * len(request_tokens & tag_tokens)
    score += 2.0 * len(request_tokens & domain_tokens)

    # A description runs to 1024 characters, so a single shared *common* word in
    # it ranks by verbosity rather than relevance. A single shared *rare* word
    # does not: "authentication" appearing in one skill's description is a real
    # signal, while "build" appearing in twenty is not. So a description-only
    # match qualifies on either two terms or one specific term.
    overlap = request_tokens & desc_tokens
    if overlap:
        rare = any(document_frequency.get(t, 0) <= RARE_TERM_MAX for t in overlap)
        if score > 0 or len(overlap) >= 2 or rare:
            score += 1.0 * len(overlap)

    if score == 0.0:
        return 0.0

    # A platform skill for a detected platform gets a small floor so that a
    # vague request still surfaces platform material over generic material.
    if skill.layer == "platform":
        score += 0.5
    return score


def _rel(path: Path, root: Path) -> str:
    try:
        return str(Path(path).relative_to(root)).replace("\\", "/")
    except ValueError:
        return str(path)
