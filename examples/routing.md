# Routing examples

Which skills load for a request, and — as importantly — which platforms are kept
out. Real output; reproduce with `python tests/make_fixtures.py` first.

Every one of these is also asserted in `tests/test_scenarios.py`, so the
behaviour cannot regress silently.

## Unreal — a performance question

```bash
python tools/uad.py select \
  "Analyze this Unreal project and find likely performance bottlenecks" \
  --path tests/fixtures/unreal-sample
```

```
Detected: unreal (confidence 100) {'engine': '5.7', 'has_cpp': 'yes', 'gas': 'GameplayAbilities'}

Skills to load (8):
  performance-profiling-method       core      any       matched request terms
  cpu-optimization                   core      any       matched request terms
  gpu-optimization                   core      any       matched request terms
  memory-optimization                core      any       matched request terms
  code-review-method                 core      any       matched request terms
  dependency-analysis                core      any       required by unreal-project-conventions
  software-architecture              core      any       required by unreal-project-conventions
  unreal-project-conventions         platform  unreal    platform entry skill for unreal

Excluded platforms (kept out of context): godot, minecraft, roblox, unity, web
```

Performance skills, the Unreal entry skill, and nothing from the other five
engines.

The entry skill loads even though the request never asked about project
conventions — that is deliberate. It carries the rule that the engine version
must be read from `EngineAssociation` before any code is written.

## Roblox — a security-shaped request

```bash
python tools/uad.py select "Create a secure shop system" \
  --path tests/fixtures/roblox-sample
```

```
Detected: roblox (confidence 100) {'toolchain': 'rokit', 'rojo': '7.5.1', 'sync_tool': 'rojo', 'luau_mode': 'strict'}

Skills to load (8):
  secure-coding                      core      any       matched request terms
  threat-modeling                    core      any       matched request terms
  roblox-security                    platform  roblox    platform entry skill for roblox
  client-server-trust                core      any       matched request terms
  game-architecture                  core      any       matched request terms
  code-review-method                 core      any       required by roblox-security
  roblox-project-conventions         platform  roblox    platform entry skill for roblox
  software-architecture              core      any       required by game-architecture

Excluded platforms (kept out of context): godot, minecraft, unity, unreal, web
```

A shop handles currency, so security is not optional. `roblox-security` is
declared an **entry skill** for the platform, which means it loads on every
Roblox task whether or not the request mentions security — a shop built without
it is a duplication exploit waiting to be found.

`sync_tool: rojo` matters as much as the skills: a Rojo project is edited as
files, while a Studio-only place has no files to edit, and writing `.luau` files
into one produces work the developer cannot use.

## Minecraft — the loader decides everything

```bash
python tools/uad.py select "Add a custom mob to my mod" \
  --path tests/fixtures/minecraft-fabric-sample
```

```
Detected: minecraft (confidence 100) {'loader': 'fabric', 'minecraft': '1.21.4', ...}

Skills to load (15):
  minecraft-entities-mobs            platform  minecraft matched request terms
  minecraft-blocks-items             platform  minecraft matched request terms
  minecraft-networking               platform  minecraft matched request terms
  ...
  minecraft-project-conventions      platform  minecraft platform entry skill for minecraft
  client-server-trust                core      any       required by minecraft-networking
  gameplay-systems                   core      any       required by minecraft-worldgen
  ...

Excluded platforms (kept out of context): godot, roblox, unity, unreal, web
```

`minecraft-entities-mobs` ranks first, and the loader and version are resolved
before anything is written. Run the same request against
`minecraft-neoforge-sample` and the facts change to `loader: neoforge`,
`minecraft: 1.21.1` — the same request, a different API.

This selection is larger than the others because the dependency closure is
exempt from the budget: a skill is incomplete without what it requires, so
`uad-requires` edges are followed even after the relevance budget is spent.

## Godot — a debugging question

```bash
python tools/uad.py select "Debug my character controller" \
  --path tests/fixtures/godot-sample
```

```
Detected: godot (confidence 100) {'engine': '4.6', 'config_version': '5', 'renderer': 'forward_plus'}

Skills to load (8):
  root-cause-debugging               core      any       matched request terms
  input-systems                      core      any       matched request terms
  render-debugging                   core      any       matched request terms
  game-architecture                  core      any       required by input-systems
  godot-project-conventions          platform  godot     platform entry skill for godot
  ...

Excluded platforms (kept out of context): minecraft, roblox, unity, unreal, web
```

`root-cause-debugging` leads, which carries the rule that matters here: no fix
without a proven cause, and no null check added at the crash site to make the
symptom disappear.

`config_version: 5` establishes Godot 4, so `CharacterBody2D` and
`move_and_slide()` are correct and the Godot 3 forms are not.

A dedicated `godot-character-controllers` skill is planned but not yet written —
see the [roadmap](../docs/roadmap.md). The entry skill and the core debugging
method still apply.

## An empty directory, platform named in the request

```bash
python tools/uad.py select "Create an inventory system in Godot" \
  --path tests/fixtures/empty-sample
```

```
Detected: nothing (selection falls back to the request wording)
...
NOTE: Platform 'godot' came from the request wording, not from project files --
confirm the version before writing code.
```

Routing still works, and the agent is told the platform is an inference rather
than a fact. That distinction is the difference between an assumption stated and
an assumption hidden.

## Controlling the budget

```bash
python tools/uad.py select "optimise draw calls" --path . --budget 3
```

`--budget` caps how many skills relevance scoring may pick. Entry skills and
dependencies are additional, by design.

## Machine-readable

```bash
python tools/uad.py select "fix a crash" --path . --json
```

Returns `selected` (each with `name`, `path`, `score`, `reason`),
`excluded_platforms`, `detected`, and `notes`. The `reason` field distinguishes
a relevance match from an entry skill from a dependency, so the routing decision
can be audited rather than trusted.
