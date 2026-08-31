<h1 align="center">Universal AI Dev</h1>

<p align="center">
  <b>Stop your AI assistant writing Godot 3 code into your Godot 4 project.</b><br>
  Skills, agents and workflows that make AI coding assistants actually competent at game development.
</p>

<p align="center">
  <a href="https://github.com/ibrohim1234567881717/game-dev-ai-skills/actions/workflows/ci.yml"><img src="https://github.com/ibrohim1234567881717/game-dev-ai-skills/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT"></a>
  <a href="https://agentskills.io"><img src="https://img.shields.io/badge/format-Agent%20Skills-5A67D8" alt="Agent Skills"></a>
  <img src="https://img.shields.io/badge/skills-71-brightgreen" alt="71 skills">
  <img src="https://img.shields.io/badge/tests-118%20passing-success" alt="118 tests">
  <img src="https://img.shields.io/badge/dependencies-none-success" alt="No dependencies">
</p>

<p align="center">
  <b>
  <a href="#-unreal-engine">Unreal</a> ·
  <a href="#-unity">Unity</a> ·
  <a href="#-godot">Godot</a> ·
  <a href="#-roblox-studio">Roblox</a> ·
  <a href="#-minecraft-modding">Minecraft</a> ·
  <a href="#-web-development">Web</a>
  </b>
</p>

---

## ⚡ 60 seconds to working

```bash
git clone https://github.com/ibrohim1234567881717/game-dev-ai-skills.git
cd game-dev-ai-skills
python tools/uad.py install --target claude-code --platforms unreal unity
```

Then just ask, in your own words:

> *Optimize my Unreal Engine project.*
> *Create an inventory system in Godot.*
> *Find security problems in my Roblox game.*
> *Add a custom mob to my Minecraft mod.*
> *Fix this Unity performance bottleneck.*

Your assistant reads your project, works out **which engine and which version**,
loads only the skills that task needs, and follows a procedure that demands
evidence instead of confidence.

Works in **Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI** and every
other tool that supports the [Agent Skills](https://agentskills.io) standard —
no plugin, no adapter, no translation layer.

---

# 🎮 Skills by engine

Every skill below is a real file. Click any of them.

## 🔷 Unreal Engine

**8 skills.** Reads `EngineAssociation` from your `.uproject` before writing a
line — and knows that a GUID there means a source build.

| Skill | What it stops happening |
|---|---|
| [unreal-performance-profiling](skills/platforms/unreal/unreal-performance-profiling) | Optimising the wrong thread. `stat unit` first, every time — and **"Draw" is render-thread CPU cost, not a GPU problem** |
| [unreal-networking-replication](skills/platforms/unreal/unreal-networking-replication) | Late joiners seeing a broken world because state was established with a multicast RPC |
| [unreal-rendering-features](skills/platforms/unreal/unreal-rendering-features) | Enabling Nanite, Lumen and MegaLights "because they're modern", then discovering the frame budget |
| [unreal-cpp-gameplay](skills/platforms/unreal/unreal-cpp-gameplay) | Raw `UObject` pointers with no `UPROPERTY` — a dangling pointer waiting to happen |
| [unreal-gameplay-ability-system](skills/platforms/unreal/unreal-gameplay-ability-system) | GAS misuse, and using GAS where it is overkill |
| [unreal-blueprint-cpp-boundary](skills/platforms/unreal/unreal-blueprint-cpp-boundary) | C++ dumped into a Blueprint-only project |
| [unreal-enhanced-input](skills/platforms/unreal/unreal-enhanced-input) | Abilities firing dozens of times because no trigger was set |
| [unreal-project-conventions](skills/platforms/unreal/unreal-project-conventions) | Code that ignores how *your* project is organised |

## 🔶 Unity

**7 skills.** Establishes **two** things first: the editor version, and the
**render pipeline** — because a Built-in shader renders magenta under URP.

| Skill | What it stops happening |
|---|---|
| [unity-csharp-patterns](skills/platforms/unity/unity-csharp-patterns) | GC spikes from hidden allocations in `Update` — the usual cause of hitching |
| [unity-scriptable-objects](skills/platforms/unity/unity-scriptable-objects) | Tuning values compiled into code, so every balance change needs a programmer |
| [unity-prefabs-scenes](skills/platforms/unity/unity-prefabs-scenes) | Prefab overrides and scene merges quietly destroying a day's work |
| [unity-physics](skills/platforms/unity/unity-physics) | Movement in `Update` that behaves differently on every machine |
| [unity-animation](skills/platforms/unity/unity-animation) | Animator state machines nobody can debug |
| [unity-input-system](skills/platforms/unity/unity-input-system) | Legacy and new input fighting each other for the same button |
| [unity-project-conventions](skills/platforms/unity/unity-project-conventions) | Advice that ignores your pipeline — or deletes your `.meta` files |

## 🔵 Godot

**7 skills.** Reads `config_version` from `project.godot` first. **5 means
Godot 4, 4 means Godot 3** — two engines sharing a name and almost no API.

| Skill | What it stops happening |
|---|---|
| [godot-character-controllers](skills/platforms/godot/godot-character-controllers) | Godot 3 movement code pasted into a Godot 4 project — the single most common Godot failure |
| [godot-performance-profiling](skills/platforms/godot/godot-performance-profiling) | Leaks going unnoticed for weeks. **Orphan Nodes rising and never falling is a leak** |
| [godot-scene-composition](skills/platforms/godot/godot-scene-composition) | Deep node inheritance that blocks every entity after the tenth |
| [godot-signals-events](skills/platforms/godot/godot-signals-events) | Signal spaghetti where nobody can trace what happens on a button press |
| [godot-gdscript-patterns](skills/platforms/godot/godot-gdscript-patterns) | Untyped GDScript that is both slower and hides real errors |
| [godot-csharp-integration](skills/platforms/godot/godot-csharp-integration) | C# proposed for a project whose export setup cannot ship it |
| [godot-project-conventions](skills/platforms/godot/godot-project-conventions) | Version-blind advice, autoload sprawl, broken `res://` paths |

## 🟥 Roblox Studio

**6 skills.** Treats every client as hostile, because it is: exploit executors
inject arbitrary Luau into the client context.

| Skill | What it stops happening |
|---|---|
| [**roblox-security**](skills/platforms/roblox/roblox-security) | **Loads on every Roblox task.** A full audit procedure for every RemoteEvent — the client is a rendering surface, never a source of truth |
| [roblox-datastore-persistence](skills/platforms/roblox/roblox-datastore-persistence) | Item duplication. **It is almost never a bug in your shop code** — it is non-atomic read-modify-write on the data store |
| [roblox-monetization](skills/platforms/roblox/roblox-monetization) | Players paying and receiving nothing. `ProcessReceipt` may be called twice for the same purchase — that is the contract, not a bug |
| [roblox-client-server-architecture](skills/platforms/roblox/roblox-client-server-architecture) | A `RemoteFunction` blocking your server on a machine the attacker controls |
| [roblox-luau-patterns](skills/platforms/roblox/roblox-luau-patterns) | Untyped Luau, and deprecated `wait()`/`spawn()` copied from old tutorials |
| [roblox-project-conventions](skills/platforms/roblox/roblox-project-conventions) | Writing `.luau` files into a Studio-only place, where you cannot use them |

## ⛏️ Minecraft Modding

**7 skills.** Refuses to write version-sensitive code until **loader + game
version + mappings** are all known. Fabric and NeoForge never shared an API.

| Skill | What it stops happening |
|---|---|
| [minecraft-project-conventions](skills/platforms/minecraft/minecraft-project-conventions) | NeoForge code handed to a Fabric mod — not a near miss, unusable output |
| [minecraft-mod-architecture](skills/platforms/minecraft/minecraft-mod-architecture) | Client-only classes in common code, crashing every dedicated server |
| [minecraft-entities-mobs](skills/platforms/minecraft/minecraft-entities-mobs) | Entities registered in the wrong phase, or desyncing from the client |
| [minecraft-networking](skills/platforms/minecraft/minecraft-networking) | Packet handlers touching the world off-thread — corruption that surfaces much later |
| [minecraft-worldgen](skills/platforms/minecraft/minecraft-worldgen) | Worldgen written against the wrong version's data model |
| [minecraft-blocks-items](skills/platforms/minecraft/minecraft-blocks-items) | Hand-written blockstate JSON that silently does not match the code |
| [minecraft-recipes-datagen](skills/platforms/minecraft/minecraft-recipes-datagen) | Hand-maintained recipe and loot JSON instead of data generation |

## 🌐 Web Development

**7 skills.** Reads the **lockfile**, not the version ranges — because that is
what actually ships.

| Skill | What it stops happening |
|---|---|
| [web-security](skills/platforms/web/web-security) | An audit that starts with injection. **Broken access control is more common, easier to exploit, and routinely missed** |
| [web-authentication](skills/platforms/web/web-authentication) | Tokens in `localStorage`, turning any XSS into full account takeover |
| [web-typescript-patterns](skills/platforms/web/web-typescript-patterns) | `any` at every boundary — the cost of types with none of the benefit |
| [web-backend-architecture](skills/platforms/web/web-backend-architecture) | Validation scattered everywhere and trusted nowhere |
| [web-frontend-architecture](skills/platforms/web/web-frontend-architecture) | State ownership nobody can explain three months later |
| [web-css-layout](skills/platforms/web/web-css-layout) | `!important` as an architecture |
| [web-project-conventions](skills/platforms/web/web-project-conventions) | Commands invented from memory instead of read from `scripts` |

---

# 🧠 29 skills that work on every engine

Platform skills stay small because the *reasoning* lives once, in the core, and
each engine specialises it. That is why there is **zero duplicated content**
across 71 skills.

| Area | Skills |
|---|---|
| **Performance** | [the profiling method](skills/core/performance/performance-profiling-method) every platform skill builds on · [CPU](skills/core/performance/cpu-optimization) · [GPU](skills/core/performance/gpu-optimization) · [memory](skills/core/performance/memory-optimization) |
| **Security** | [client-server trust](skills/core/security/client-server-trust) · [threat modeling](skills/core/security/threat-modeling) · [secure coding](skills/core/security/secure-coding) |
| **Programming** | [architecture](skills/core/programming/software-architecture) · [root-cause debugging](skills/core/programming/root-cause-debugging) · [code review](skills/core/programming/code-review-method) · [API design](skills/core/programming/api-design) · [refactoring](skills/core/programming/refactoring-safely) · [dependencies](skills/core/programming/dependency-analysis) |
| **Game systems** | [game architecture](skills/core/gamedev/game-architecture) · [gameplay systems](skills/core/gamedev/gameplay-systems) · [save systems](skills/core/gamedev/save-systems) · [input](skills/core/gamedev/input-systems) · [multiplayer](skills/core/gamedev/multiplayer-networking) |
| **Graphics** | [rendering fundamentals](skills/core/graphics/rendering-fundamentals) · [lighting](skills/core/graphics/lighting-design) · [materials & shaders](skills/core/graphics/materials-and-shaders) · [VFX](skills/core/graphics/vfx-and-particles) · [post-processing](skills/core/graphics/post-processing) · [render debugging](skills/core/graphics/render-debugging) · [level design](skills/core/graphics/level-design-and-environment) |
| **Production** | [testing](skills/core/production/testing-strategy) · [bug triage](skills/core/production/bug-triage) · [version control](skills/core/production/version-control-workflow) · [releases](skills/core/production/release-management) |

---

# 🤖 15 agents with rules they cannot break

An agent here is not "a helpful assistant". It is a role with **explicit
prohibitions**:

| Agent | Cannot |
|---|---|
| [performance](agents/core/performance.md) | Propose an optimisation before profiling |
| [debugger](agents/core/debugger.md) | Add a null check at the crash site and call it fixed |
| [security](agents/core/security.md) | Assume anything a client sends is true |
| [reviewer](agents/core/reviewer.md) | Accept plausible-looking code as evidence of correctness |
| [minecraft-specialist](agents/platforms/minecraft-specialist.md) | Write code before loader, version and mappings are known |
| [unity-specialist](agents/platforms/unity-specialist.md) | Give visual advice without knowing the render pipeline |
| [godot-specialist](agents/platforms/godot-specialist.md) | Mix Godot 3 and Godot 4 APIs |
| [orchestrator](agents/core/orchestrator.md) | Ask you for a fact your project files already answer |

Plus [architect](agents/core/architect.md), [programmer](agents/core/programmer.md),
[qa](agents/core/qa.md), [graphics](agents/core/graphics.md), and specialists for
[Unreal](agents/platforms/unreal-specialist.md),
[Roblox](agents/platforms/roblox-specialist.md) and
[Web](agents/platforms/web-specialist.md).

All inherit one rule above all others: **never claim you ran something you did
not run.**

---

# ⚙️ 8 workflows, as slash commands

[`/build-feature`](workflows/build-feature.md) ·
[`/fix-bug`](workflows/fix-bug.md) ·
[`/optimize`](workflows/optimize.md) ·
[`/review`](workflows/review.md) ·
[`/prototype`](workflows/prototype.md) ·
[`/graphics-pass`](workflows/graphics-pass.md) ·
[`/security-review`](workflows/security-review.md) ·
[`/release-check`](workflows/release-check.md)

Each is a procedure with a checklist, not a prompt. `/fix-bug` will not let a
fix through without a **proven** root cause and a regression test that failed
before it.

---

# 🔍 Why this works: it reads your project

The whole thing rests on one idea — **detect before you decide**:

```bash
$ python tools/uad.py detect .

PRIMARY: Minecraft Modding (minecraft) - confidence 100/100
  facts:
    loader        neoforge    <- src/main/resources/META-INF/neoforge.mods.toml
    minecraft     1.21.1      <- gradle.properties
    mappings      2024.11.17  <- gradle.properties
    java          21          <- gradle.properties
```

Every fact names the file it came from, so the claim can be **checked**, not
trusted. That is the difference between a mod that compiles and one that does not.

Then only the relevant skills load — and the ones that do not are reported:

```bash
$ python tools/uad.py select "why is my game lagging" --path .

Skills to load (8): performance-profiling-method, cpu-optimization, ...
Excluded platforms (kept out of context): godot, minecraft, roblox, unity, web
```

[See real output for every engine →](examples/README.md)

---

## 📦 Installation

**Python 3.9+. No dependencies.** The toolkit ships its own YAML parser.

```bash
# Claude Code — skills, subagents and slash commands
python tools/uad.py install --target claude-code --platforms unreal web

# Codex · Cursor · Copilot — skills
python tools/uad.py install --target codex --platforms minecraft

# Any other Agent Skills client
python tools/uad.py install --target generic --dest <the directory it scans>
```

Pick your platforms — installing all six puts engines you never touch into every
session. `--dry-run` to preview, `--namespace uad-` to avoid collisions,
`--uninstall` to remove. [Full guide →](docs/installation.md)

## 🛠 How skills work

A skill is a folder with a `SKILL.md`. Agents load them **progressively**:

```
startup    → name + description only            (~100 tokens each)
activation → the full SKILL.md, when it matches
execution  → references/ and scripts/, only if needed
```

Every skill answers ten fixed questions — including **When NOT to use**,
**Required context** (and the file that answers each fact), and **Version
constraints**. Those three are what stop an agent confidently writing code for
the wrong engine version. [Format spec →](docs/skill-format.md)

## ➕ Add your own skill

```bash
cp templates/SKILL.template.md skills/core/programming/my-skill/SKILL.md
python tools/uad.py validate --strict
python tools/audit.py --strict
```

`validate` checks it is well-formed; `audit` checks it is any *good*.
[Walkthrough →](docs/adding-a-skill.md)

## 🔌 Add a new engine

Bevy, Three.js, Phaser, GameMaker, Blender — **one directory, no code changes**:

```
skills/platforms/bevy/
├── platform.yaml                       ← detection + version extraction
└── bevy-project-conventions/SKILL.md
```

The detector, selector and installer are all driven by `platform.yaml`. The
entire 29-skill core library applies to your engine the moment you add it.
[Walkthrough →](docs/adding-a-platform.md) · [Open issue →](https://github.com/ibrohim1234567881717/game-dev-ai-skills/issues/1)

## 📚 Documentation

[Architecture](docs/architecture.md) ·
[Skill format](docs/skill-format.md) ·
[Installation](docs/installation.md) ·
[Adding a skill](docs/adding-a-skill.md) ·
[Adding an engine](docs/adding-a-platform.md) ·
[Roadmap](docs/roadmap.md) ·
[Examples](examples/README.md) ·
[Русское описание](КАТАЛОГ.md)

---

## ✅ Honest status

This project would rather be trusted than admired, so:

**Solid.** The architecture, detection (23 tests including false-positive
checks), skill selection and context isolation (19 scenario tests), validation
(19 tests, all asserting the validator *rejects* defects), install (14 tests).
118 tests, CI on Linux, macOS and Windows across Python 3.9 and 3.12.

**Partial.** 42 platform skills against roughly 90 planned. Each pack carries
its entry skill plus the areas where a mistake is most expensive; everything
missing is named in the [roadmap](docs/roadmap.md).

**Unverified.** The `gemini-cli` install path follows the documented convention
but was not tested end to end — `uad doctor` says so. And while the tests prove
the toolkit works as designed, *"these skills improve an assistant's output"* is
not something this repository measures.

## 🤝 Contributing

Most useful, in order:

1. **A new engine adapter** — highest leverage by far.
2. **Corrections.** Engine APIs move; a wrong claim fixed beats a new skill added.
3. **Filling roadmap gaps** — Unreal UMG, Unity Addressables, Minecraft GUI…

Issues labelled [`good first issue`](https://github.com/ibrohim1234567881717/game-dev-ai-skills/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
are scoped so you can start without reading the whole repository.
[Contributing guide →](CONTRIBUTING.md)

## 📄 License

MIT — see [LICENSE](LICENSE). Use it, fork it, ship it.

---

<p align="center">
  <sub><b>Universal AI Dev</b> — because the fastest way to lose an afternoon is
  an assistant that is confidently wrong about your engine version.</sub>
</p>
