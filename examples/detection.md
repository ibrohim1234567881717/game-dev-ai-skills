# Detection examples

Real output. Reproduce with `python tests/make_fixtures.py` first.

## Minecraft: the facts that decide whether code compiles

```bash
python tools/uad.py detect tests/fixtures/minecraft-neoforge-sample --verbose
```

```
PRIMARY: Minecraft Modding (minecraft) - confidence 100/100
  facts:
    loader                 neoforge   <- src/main/resources/META-INF/neoforge.mods.toml
    minecraft              1.21.1     <- gradle.properties
    neoforge_version       21.1.72    <- gradle.properties
    mappings               2024.11.17 <- gradle.properties
    mod_id                 examplemod <- gradle.properties
    java                   21         <- gradle.properties
  evidence:
    glob:neoforge.mods.toml      +100 src/main/resources/META-INF/neoforge.mods.toml
    glob:gradle.properties       +45  gradle.properties
    glob:build.gradle            +35  build.gradle
```

Loader, game version and mappings are one indivisible fact. Fabric and NeoForge
never shared an API, so an assistant that guesses here does not produce
*slightly* wrong code — it produces code that does not compile.

Every fact names the file it came from, so the claim can be checked rather than
trusted.

The same request against the Fabric fixture resolves differently:

```
    loader                 fabric        <- src/main/resources/fabric.mod.json
    minecraft              1.21.4        <- gradle.properties
    mappings               1.21.4+build.8 <- gradle.properties
```

## Unity: the render pipeline is the fact that matters

```bash
python tools/uad.py detect tests/fixtures/unity-sample
```

```
PRIMARY: Unity (unity) - confidence 100/100
  facts:
    editor                 6000.3.5f1  <- ProjectSettings/ProjectVersion.txt
    render_pipeline_urp    17.3.0      <- Packages/manifest.json
    input_system           1.11.2      <- Packages/manifest.json
    netcode                2.2.0       <- Packages/manifest.json
    addressables           2.3.16      <- Packages/manifest.json
```

A shader written for the Built-in pipeline renders magenta under URP. Knowing
the editor version without knowing the pipeline is knowing half of what matters.

Absence is informative too: no URP and no HDRP package means Built-in.

## Godot: major version, unambiguously

```bash
python tools/uad.py detect tests/fixtures/godot-sample
```

```
PRIMARY: Godot Engine (godot) - confidence 100/100
  facts:
    engine                 4.6           <- project.godot
    config_version         5             <- project.godot
    renderer               forward_plus  <- project.godot
```

`config_version=5` means Godot 4.x; `4` means 3.x. Godot 3 and Godot 4 share a
name and almost no API — `KinematicBody` and `move_and_slide(velocity)` against
`CharacterBody2D` and `move_and_slide()`, `yield()` against `await`, `Spatial`
against `Node3D`. This one integer decides which of two incompatible APIs is
correct.

## A monorepo: both ecosystems reported

```bash
python tools/uad.py detect tests/fixtures/unity-with-web-tools
```

```
PRIMARY: Unity (unity) - confidence 100/100
  facts:
    editor                 6000.3.5f1  <- ProjectSettings/ProjectVersion.txt

also present: Web Development (web) - confidence 75/100
```

A Unity game with a build dashboard beside it. Both are real, so both are
reported, ranked. A secondary platform is information, not noise.

Note what does **not** happen here: `tests/fixtures/unity-sample` contains
`Packages/com.studio.tools/package.json`, because Unity ships a `package.json`
inside every embedded package. An unanchored signal matched it and reported
every Unity project as a web project. Detection signals now carry a `depth`
limit, and `tests/test_detect.py` asserts the Unity fixture matches Unity and
nothing else.

## Nothing to detect

```bash
python tools/uad.py detect tests/fixtures/empty-sample
```

```
No platform detected.
Add --depth to search deeper, or name the platform in your request.
```

Reporting nothing is the correct answer for a directory with no project markers.
Selection still works from the request wording — see [routing.md](routing.md) —
but it flags that the platform came from words rather than evidence.

## Machine-readable

```bash
python tools/uad.py detect . --json
```

Returns the same information as JSON: `primary`, `matches`, per-match
`versions`, `evidence` and `unresolved`. `unresolved` lists facts the adapter
declared required that could not be found — for Minecraft, an agent must not
generate registration or networking code while any of them is missing.
