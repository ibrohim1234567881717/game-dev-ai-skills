# Universal AI Dev

[![CI](https://github.com/ibrohim1234567881717/game-dev-ai-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/ibrohim1234567881717/game-dev-ai-skills/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Agent Skills](https://img.shields.io/badge/format-Agent%20Skills-5A67D8)](https://agentskills.io)
[![Python 3.9+](https://img.shields.io/badge/python-3.9%2B-blue)](https://www.python.org/)
[![No dependencies](https://img.shields.io/badge/dependencies-none-success)](tools/uad/miniyaml.py)

**Skills, agents and workflows that make AI coding assistants competent at game
and software development — across Unreal, Unity, Godot, Roblox, Minecraft
modding and the web.**

This is not a game engine and not a framework. It is a toolkit you clone once,
after which your AI assistant knows how to profile an Unreal frame, audit a
Roblox game for exploits, tell a Fabric mod from a NeoForge one, and — above all
— **check which version of your engine you actually use before writing code for it.**

Built on the [Agent Skills](https://agentskills.io) open standard, so the same
skills load in Claude Code, Codex, Cursor, Copilot, Gemini CLI and the rest
without a translation layer.

```
python tools/uad.py detect .
python tools/uad.py install --target claude-code --platforms godot web
```

---

## Why this exists

Ask an AI assistant for help with a game project and you will recognise the
failure modes:

| What happens | Why it happens |
|---|---|
| It writes Godot 3 code into your Godot 4 project | It never checked `project.godot` |
| It gives you Fabric code for your NeoForge mod | It assumed a loader |
| Its Unity shader renders magenta | It didn't know you use URP |
| It "optimises" something that wasn't slow | It never profiled |
| It puts your shop's price check in a LocalScript | It treated the client as trustworthy |
| It says "tests pass" without running them | Nothing required it to show output |

None of these are model-intelligence problems. They are **missing procedure**.
This toolkit supplies the procedure: detect the platform and version from the
project's own files, load only the skills that task needs, follow a method that
demands evidence, and review the result adversarially before calling it done.

---

## What's in it

| | Count | What it is |
|---|---|---|
| **Skills** | 60 | Procedural knowledge, loaded on demand |
| **Agents** | 15 | Specialists with defined responsibilities |
| **Workflows** | 8 | Repeatable procedures, usable as slash commands |
| **Adapters** | 6 | Platform detection + routing manifests |
| **Tests** | 89 | Covering detection, selection, validation and install |

**Skills** split into 28 engine-agnostic core skills — profiling method,
root-cause debugging, architecture, the client-server trust rule, rendering
fundamentals — and 32 platform skills that specialise them. Composition, not
duplication: `unreal-performance-profiling` states the Unreal-specific part and
*requires* `performance-profiling-method` for the method itself.

**Agents** are the orchestrator, architect, programmer, debugger, reviewer, QA,
performance, graphics and security roles, plus one specialist per platform.
The reviewer is deliberately independent: its job is to find problems, not to
confirm the work.

**Workflows**: `/build-feature`, `/fix-bug`, `/optimize`, `/review`,
`/prototype`, `/graphics-pass`, `/security-review`, `/release-check`.

---

## Supported platforms

| Platform | Skills | Detected from | Version facts extracted |
|---|---|---|---|
| **Unreal Engine** | 5 | `*.uproject` | Engine version, C++ modules, GAS |
| **Unity** | 7 | `ProjectSettings/ProjectVersion.txt` | Editor version, **render pipeline**, packages |
| **Godot** | 5 | `project.godot` | **Major version (3.x vs 4.x)**, renderer |
| **Roblox Studio** | 3 | `*.rbxl`, `default.project.json` | Rojo vs Studio workflow, toolchain, Luau mode |
| **Minecraft** | 7 | `gradle.properties`, loader metadata | **Loader**, MC version, mappings, Java |
| **Web** | 5 | `package.json` + lockfile | Framework majors, package manager, test runner |

The bolded facts are the ones that make otherwise-correct code wrong. They are
extracted automatically, and the detector reports which file each came from.

---

## Install

Requires **Python 3.9+**. No dependencies — the toolkit ships its own YAML parser.

```bash
git clone https://github.com/ibrohim1234567881717/game-dev-ai-skills.git
cd game-dev-ai-skills
python tools/uad.py doctor
```

Then install into your assistant, choosing the platforms you actually work on —
installing all six puts skills for engines you never touch into every session's
index:

```bash
# Claude Code — skills, subagents and slash commands
python tools/uad.py install --target claude-code --platforms unreal web

# Codex, Cursor, Copilot — skills
python tools/uad.py install --target codex --platforms minecraft
python tools/uad.py install --target cursor --platforms godot

# Any other Agent Skills client
python tools/uad.py install --target generic --dest ~/path/your/client/scans
```

Useful flags: `--dry-run` to preview, `--scope project` to install into the
current project rather than your home directory, `--namespace uad-` to avoid
name collisions with skills you already have, `--uninstall` to remove.

Restart your assistant afterwards so it re-reads the skill index.

Full detail, including which client paths are verified and which are not:
[docs/installation.md](docs/installation.md).

---

## Use it

Once installed, work normally. The skills activate from your request.

```
Optimize my Unreal Engine project.
Create an inventory system in Godot.
Find security problems in my Roblox game.
Add a custom mob to my Minecraft mod.
Fix this Unity performance bottleneck.
Build an authentication system.
```

You can also drive the tooling directly:

```bash
python tools/uad.py detect .                      # what is this project?
python tools/uad.py select "why is this slow?"    # which skills would load?
python tools/uad.py list skills --platform godot  # what is available?
python tools/uad.py validate --strict             # is the repository sound?
```

`detect` on a Minecraft mod, for example:

```
PRIMARY: Minecraft Modding (minecraft) - confidence 100/100
  facts:
    loader                 neoforge   <- src/main/resources/META-INF/neoforge.mods.toml
    minecraft              1.21.1     <- gradle.properties
    mappings               2024.11.17 <- gradle.properties
    java                   21         <- gradle.properties
```

That is the difference between a mod that compiles and one that does not.

---

## How skills work

A skill is a folder with a `SKILL.md` — the [Agent Skills](https://agentskills.io)
standard, adopted across the ecosystem. Agents load them progressively:

```
startup      → only name + description of every skill  (~100 tokens each)
activation   → the full SKILL.md, when the task matches
execution    → references/ and scripts/, only if needed
```

On top of the standard, every skill here answers ten fixed questions — including
**When NOT to use**, **Required context** (and the file that answers each fact),
and **Version constraints**. Those three are what stop an agent confidently
writing code for the wrong engine version.

Routing metadata rides inside the spec's `metadata` field, so clients that have
never heard of this project ignore it harmlessly:

```yaml
metadata:
  uad-layer: platform
  uad-platform: unreal
  uad-domain: performance
  uad-requires: "performance-profiling-method, gpu-optimization"
```

`uad-requires` is what makes composition work: platform skills state only what
is platform-specific and pull in the core method, so the reasoning is written
once and specialised six times rather than copy-pasted six times.

Details: [docs/skill-format.md](docs/skill-format.md).

---

## How agents work

The **orchestrator** is the entry point. It detects the project, selects skills,
decomposes the work, delegates to specialists, and runs an independent review
before reporting:

```
request → detect platform + version → select skills → decompose
        → delegate to specialists → integrate → review → report
```

Specialists carry the rules of their domain. The `performance` agent may not
propose an optimisation before profiling. The `security` agent treats every
client as hostile. The `minecraft-specialist` refuses to write version-sensitive
code until loader, version and mappings are all known. The `reviewer` tries to
break the work rather than confirm it.

All of them inherit [instructions/master-agent.md](instructions/master-agent.md),
whose central rule is honesty about verification: never claim a command was run
that was not, never report "tests pass" without the output, never present an
assumption as a detected fact.

---

## Add your own skill

```bash
cp -r templates/SKILL.template.md skills/core/programming/my-skill/SKILL.md
# edit it — the folder name must equal the `name` field
python tools/uad.py validate --strict
```

The validator checks specification compliance (name shape, folder match,
description limits, string-only metadata), all ten required sections, resolvable
dependencies, unique names and working links. It has 19 tests of its own
asserting that it actually rejects each defect.

See [docs/adding-a-skill.md](docs/adding-a-skill.md).

## Add a new engine

Adding Bevy, Three.js, Phaser or GameMaker means adding **one directory**:

```
skills/platforms/bevy/
├── platform.yaml          ← detection signals + version extraction + routing
└── bevy-project-conventions/SKILL.md
```

No code changes. The detector, selector and installer are all driven by
`platform.yaml`. See [docs/adding-a-platform.md](docs/adding-a-platform.md).

---

## Honest status

This is a young project and its coverage is uneven. What exists is tested; what
is missing is listed rather than implied.

**Solid:** the architecture, the detection engine (23 tests, including
false-positive checks), skill selection and context isolation (19 scenario
tests), validation (19 tests), install (17 tests), and all six platform entry
skills plus `roblox-security`.

**Partial:** platform skill coverage. Unity and Minecraft have 7 skills each;
Roblox has 3. The [roadmap](docs/roadmap.md) lists the planned skills per
platform. Core coverage is missing several planned gamedev skills — save
systems, inventory, quests, dialogue, game AI, procedural generation, audio,
animation — and `asset-optimization`, `loading-and-streaming`, `ci-cd-pipelines`
and `technical-documentation`.

**Unverified:** the toolkit's *own* tests all pass, but "these skills make an
assistant produce better code" is not something this repository measures. Only
the `claude-code`, `codex`, `copilot`, `cursor` and `generic` install paths have
had their destination layout checked; `gemini-cli` is marked unverified in
`uad doctor`.

**Version-sensitive:** [knowledge/version-matrix.yaml](knowledge/version-matrix.yaml)
records what was current in August 2026. Skills are written to send agents to
the project's files rather than to rely on that matrix, but it needs periodic
review.

---

## Contributing

New skills, new engine adapters, corrections to version-specific claims and
better detection signals are all welcome — corrections especially, since
engine APIs move and this repository will drift.

Read [CONTRIBUTING.md](CONTRIBUTING.md). The bar is simple: a skill must make an
agent measurably better at a real task. Fifty skills that do that beat five
hundred that restate documentation.

**Where help is most useful right now**, in order of leverage:

1. **A new engine adapter** — Bevy, Three.js, Phaser, GameMaker, Blender. One
   directory, no code changes, and the whole 28-skill core library immediately
   applies to that ecosystem. See [docs/adding-a-platform.md](docs/adding-a-platform.md).
2. **Roblox and Unreal skills** — the thinnest packs relative to their scope.
3. **Corrections.** Engine APIs move; a wrong claim fixed is worth more than a
   new skill added.

Issues labelled `good first issue` are scoped so you can start without reading
the whole repository.

## License

MIT — see [LICENSE](LICENSE).
