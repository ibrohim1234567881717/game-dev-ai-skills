# Roadmap

What exists, what is planned, and what is deliberately out of scope. Kept honest
so that nobody mistakes a plan for a feature.

Counts current as of the last update to this file; `python tools/uad.py doctor`
reports the live numbers.

## Status summary

| Area | State |
|---|---|
| Architecture, format contract, tooling | Complete and tested (89 tests) |
| Detection + version extraction | Complete for all six platforms |
| Skill selection / context isolation | Complete, asserted by scenario tests |
| Validation | Complete, with negative tests |
| Install | Complete for 5 verified targets |
| Core skills | 28 of ~42 planned |
| Platform skills | 32, unevenly distributed |
| Agents | 15, complete |
| Workflows | 8, complete |

## Core skills

**Present (28).**

*Programming* — `software-architecture`, `api-design`, `refactoring-safely`,
`root-cause-debugging`, `code-review-method`, `dependency-analysis`.
*Gamedev* — `game-architecture`, `gameplay-systems`, `input-systems`,
`multiplayer-networking`.
*Graphics* — `rendering-fundamentals`, `lighting-design`,
`materials-and-shaders`, `vfx-and-particles`, `post-processing`,
`render-debugging`, `level-design-and-environment`.
*Performance* — `performance-profiling-method`, `cpu-optimization`,
`gpu-optimization`, `memory-optimization`.
*Production* — `testing-strategy`, `bug-triage`, `version-control-workflow`,
`release-management`.
*Security* — `threat-modeling`, `secure-coding`, `client-server-trust`.

**Planned.**

| Skill | Domain | Why it matters |
|---|---|---|
| `save-systems` | gamedev | Serialisation, versioning and migration — the defect class that costs players progress |
| `inventory-systems` | gamedev | Stacking, capacity, and the duplication bugs that follow |
| `quest-systems` | gamedev | State machines, persistence, and content authoring |
| `dialogue-systems` | gamedev | Branching, localisation, and content pipelines |
| `game-ai` | gamedev | Behaviour trees, steering, perception |
| `procedural-generation` | gamedev | Determinism, seeding, reproducibility |
| `game-ui-architecture` | gamedev | Screen stacks, input routing, data binding |
| `game-audio` | gamedev | Mixing, occlusion, memory, middleware |
| `animation-systems` | gamedev | State machines, blending, root motion |
| `asset-optimization` | performance | Textures, meshes, audio, compression, LODs |
| `loading-and-streaming` | performance | Load time, streaming, hitches |
| `ci-cd-pipelines` | production | Build automation, caching, artifacts |
| `technical-documentation` | production | Documentation that stays true |
| `project-detection` | meta | Teaching agents the detection procedure directly |

## Platform skills

| Platform | Present | Planned |
|---|---|---|
| **Unreal** (5) | project conventions, C++ gameplay, Blueprint/C++ boundary, Enhanced Input, GAS | UMG, networking/replication, AI & behaviour trees, Niagara, materials, rendering features, performance profiling, World Partition, data assets, packaging |
| **Unity** (7) | project conventions, C# patterns, ScriptableObjects, prefabs & scenes, input system, physics, animation | UI systems, render pipelines, shaders & VFX, Addressables, netcode, performance profiling, mobile optimization, editor tooling, build pipeline |
| **Godot** (5) | project conventions, GDScript patterns, C# integration, scene composition, signals | resources & data, character controllers, physics, UI controls, animation, shaders, navigation, multiplayer, editor plugins, performance, export |
| **Roblox** (3) | project conventions, **security**, Luau patterns | client-server architecture, DataStore persistence, UI, character systems, NPC AI, physics, monetization, performance, procedural generation, testing |
| **Minecraft** (7) | project conventions, mod architecture, blocks & items, entities & mobs, recipes & datagen, worldgen, networking | GUI/screens, rendering & particles, commands & events, config & compatibility, performance, loader portability |
| **Web** (5) | project conventions, frontend architecture, backend architecture, TypeScript patterns, CSS layout | accessibility, REST API design, database layer, authentication, security, performance, testing, deployment, plus framework skills (React, Next.js, Node, Vue/Svelte) |

The Roblox and Unreal packs are the thinnest relative to their planned scope.
`roblox-security` is present and is the most important skill in that pack.

## New engine adapters

The architecture supports these with one directory each and no code changes.
None is started.

Blender · Three.js · Babylon.js · Phaser · GameMaker · Bevy · CryEngine · love2d

See [adding-a-platform.md](adding-a-platform.md). A new adapter is the single
highest-leverage contribution: it makes the whole core library apply to a new
ecosystem.

## Tooling

**Present:** `detect`, `select`, `validate`, `list`, `install`, `doctor`; a
zero-dependency YAML subset parser; 89 tests; GitHub Actions CI.

**Planned:**

- **`uad new skill|platform`** — scaffolding from the templates.
- **Claude Code plugin packaging** — install via the plugin marketplace instead
  of the CLI.
- **Skill-quality linting** — flag filler content, missing runnable validation
  steps, and version claims with no verification instruction.
- **Detection signal coverage report** — which signals never fire against the
  fixture corpus.
- **A larger fixture corpus**, including real-world project shapes rather than
  only minimal ones.

## Explicitly out of scope

- **Being a game engine, framework or library.** This ships knowledge, not code
  that runs in your game.
- **Coupling to one AI provider.** Skills are portable Agent Skills by
  construction; anything that would require a specific vendor belongs in an
  adapter, not the core.
- **Mirroring official documentation.** Skills encode judgement and procedure.
  Where documentation is the right answer, link to it.
- **Cheat development.** Auditing your own game and building anti-cheat are
  supported; producing tools to cheat in other people's games is not.

## How to help

The [contributing guide](../CONTRIBUTING.md) has the details. In short:
corrections first, then filling the gaps above, then new adapters. Small focused
pull requests — one skill or one adapter — get reviewed properly, which for this
project matters more than throughput.
