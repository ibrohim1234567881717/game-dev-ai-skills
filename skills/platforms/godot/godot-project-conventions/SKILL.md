---
name: godot-project-conventions
description: Entry point for any Godot task. Establishes which Godot major version a project targets by reading config_version in project.godot (5 means Godot 4.x, 4 means Godot 3.x), then covers res:// and user:// paths, autoload singletons, folder layout, .import and .uid sidecar files, and what belongs in version control. Load this before writing any GDScript, C#, scene or shader for an unfamiliar Godot project, because Godot 3 and Godot 4 share a name and almost no API.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: godot
  uad-domain: production
  uad-version: "1.0.0"
  uad-requires: "version-control-workflow, software-architecture"
  uad-tags: "godot, project.godot, config_version, autoload, res://, gitignore, import"
  uad-maturity: stable
---

# Godot Project Conventions

## Purpose

Godot 3 and Godot 4 are different engines wearing the same name. `KinematicBody`
became `CharacterBody3D`, `Spatial` became `Node3D`, `yield` became `await`,
`instance()` became `instantiate()`, and roughly every rendering and physics
API was rewritten. Code written for the wrong major version does not degrade
gracefully — it fails to parse, or silently does nothing. This skill is the
gate: resolve the engine version from the project itself before producing a
single line of code, then apply the layout, path and version-control
conventions that the rest of the Godot pack assumes.

## When to use

- First contact with any repository containing `project.godot`, `*.tscn`, `*.gd`
  or `*.gdextension` files.
- Before writing or editing GDScript, C#, scenes, resources or shaders in a
  project whose Godot version you have not yet confirmed this session.
- When deciding where a new script, scene or asset should live.
- When setting up `.gitignore`, reviewing what is committed, or diagnosing
  "works on my machine but not after clone" import breakage.
- When adding, removing or ordering autoload singletons.

## When NOT to use

- Deep work in a specific subsystem once the version is established — go to the
  focused skill (`godot-gdscript-patterns`, `godot-physics`,
  `godot-scene-composition`, …). This skill deliberately stops at conventions.
- Export configuration and build pipelines — that is `godot-export-deployment`.
- Non-Godot engines. `project.godot` is the only definitive marker; a stray
  `.tres` in an unrelated repo is not a Godot project.

## Required context

Establish all of these from files, not by asking:

- **Major version.** `project.godot`, line `config_version=N`.
  `config_version=5` → Godot 4.x. `config_version=4` → Godot 3.x.
  `config_version=3` → Godot 2.x (unsupported; stop and say so).
- **Minor version (4.x only).** `project.godot`, key
  `config/features=PackedStringArray("4.3", "Forward Plus")`. The first entry is
  the minor version the project was last opened with. Absent on 3.x projects.
- **Renderer.** `renderer/rendering_method` in `project.godot`:
  `forward_plus`, `mobile`, or `gl_compatibility`. Determines which shader and
  rendering features are legal (see `godot-shaders`).
- **Language mix.** A `.csproj` next to `project.godot`, or
  `dotnet/project/assembly_name` in `project.godot`, means C# is enabled — see
  `godot-csharp-integration`.
- **Autoloads.** The `[autoload]` section of `project.godot` lists every global
  singleton and its script path. Read it before inventing a new global.
- **Main scene.** `run/main_scene` under `[application]`.
- **GDExtension addons.** Any `*.gdextension` file pins native binaries to a
  specific engine ABI; a version bump usually requires rebuilding them.

If `project.godot` cannot be found or `config_version` is absent, ask the user
which major version they target. Do not guess.

## Version constraints

- **This pack assumes Godot 4.x by default.** Every unlabelled code sample is
  4.x. Godot 3.x equivalents, where they matter, are labelled `3.x` inline.
- Never mix majors in one sample. `move_and_slide(velocity, Vector2.UP)` and
  `CharacterBody2D` cannot coexist; the presence of both in a file is a bug.
- Within 4.x, `config/features` gates recent APIs. Notable minor-version
  boundaries this pack flags: typed dictionaries and script `.uid` files (4.4),
  `AnimationMixer` as the base of `AnimationPlayer`/`AnimationTree` (4.2),
  `EditorInterface` as a directly accessible singleton (4.2), Jolt as the
  **default** 3D physics engine (4.6 — before that it is opt-in or an add-on;
  see `godot-physics`). Where a claim depends on a minor version, verify it
  against the project's `config/features` before relying on it.
- The `config/features` string reflects the editor that last saved the file, not
  a floor. A project last opened with 4.1 will not have 4.4 features available.
- Godot 3.x is in long-term maintenance. New work should target 4.x; existing
  3.x projects are legitimate and must be served with 3.x APIs, not with 4.x
  code plus an apology.

## Workflow

1. **Locate the project root.** Find `project.godot`. Its directory *is*
   `res://`. Every engine path in the project is relative to it.
2. **Read `config_version` and stop if it is not 4 or 5.** Record the major
   version. State it explicitly in your first response so the user can correct
   you cheaply.
3. **Read `config/features`** (4.x) and record the minor version and renderer.
4. **Read the `[autoload]` section** and the main scene. These tell you what is
   globally available without a `get_node` walk.
5. **Map the folder layout** before adding files. Match the existing convention
   rather than importing one from another engine (see Best practices).
6. **Check `.gitignore`** against the Version control table below before
   committing anything, especially on a project that has never been shared.
7. **Only now write code**, and route to the specific skill for the subsystem.

## Best practices

- **State the detected version in your output.** "This is Godot 4.3
  (`config_version=5`, `config/features` 4.3, Forward+)" costs one line and
  prevents an entire class of wasted work.
- **Use `res://` for shipped content and `user://` for anything written at
  runtime.** `res://` is read-only in an exported build — it lives inside the
  `.pck`. Saves, logs, and downloaded content go to `user://`, which maps to
  the OS application-data directory. Resolve it with
  `ProjectSettings.globalize_path("user://")` only for display or for handing a
  path to an external process; keep engine calls on the virtual path.
- **Prefer a domain-based folder layout** — `scenes/player/player.tscn`,
  `scenes/player/player.gd`, `scenes/player/player_sprite.png` — over a
  type-based one that scatters a feature across `scripts/`, `scenes/` and
  `art/`. Godot has no asset database enforcing either; consistency with what
  the project already does beats any abstract ideal.
- **Keep a script next to the scene it drives**, with the same base name. It
  makes moving a feature a directory operation.
- **Add autoloads sparingly and order them deliberately.** Autoloads are
  instantiated top-to-bottom before the main scene, so an autoload may only
  reference autoloads declared above it during `_ready`. Reserve them for true
  cross-cutting services: a save manager, an event bus, an audio director. A
  singleton holding gameplay state is a global variable with a nicer name.
- **Reference the engine's own gitignore.** GitHub's `Godot.gitignore` is
  maintained upstream and is the correct starting point.
- **Set `.gitattributes` to treat `*.tscn`, `*.tres`, `*.gd` and
  `project.godot` as text** so diffs and merges work. Godot's text scene format
  is deliberately merge-friendly; binary `.scn`/`.res` files are not.
- **Never hand-edit `.import` files** to change import settings. Change them in
  the editor Import dock and let the editor rewrite the file; the `uid` and
  hash fields inside must stay consistent with the reimport cache.

## Version control

| Path | Commit? | Why |
|---|---|---|
| `project.godot`, `*.tscn`, `*.tres`, `*.gd`, `*.cs`, `*.gdshader` | yes | The project |
| `*.import` | yes | Import settings and the stable UID of each asset; losing them reshuffles asset UIDs and breaks references |
| `*.gd.uid`, `*.cs.uid` (Godot 4.4+) | yes | Stable script identity; regenerating them churns every scene that references the script |
| `.godot/` (Godot 4) | no | Editor cache and reimported binaries, regenerated on open |
| `.import/` (Godot 3) | no | Same role as `.godot/` in 3.x |
| `.mono/` (3.x), `bin/`, `obj/` (C#) | no | Build output |
| `export_presets.cfg` | with care | Useful to share, but it can contain Android keystore paths and passwords. Audit it; move secrets to CI secrets or environment variables before committing |
| `android/build/` | no | Generated Gradle build template |
| Export output (`builds/`, `*.pck`, `*.exe`, `*.apk`) | no | Build artefacts |

Losing `.import` files is the single most common Godot version-control mistake.
The engine regenerates them on next open, but with fresh UIDs, so every scene
and resource that pointed at an asset by UID now points at nothing.

## Common mistakes

- **Writing Godot 3 code into a Godot 4 project (or the reverse).** Tempting
  because most tutorials and Stack Overflow answers predate 4.0 and do not say
  which version they target. GDScript 3 syntax such as `export(int) var hp`,
  `onready var s = $Sprite` or `yield(get_tree(), "idle_frame")` is a parse
  error in 4.x, so it fails loudly. The dangerous half is the code that still
  parses: `connect("pressed", self, "_on_pressed")` in 4.x raises a runtime
  error about the argument types, and 3.x-style `Tween` nodes simply do
  nothing. Resolve `config_version` first, every time.
- **Assuming `config/features` means "at least".** It records the editor that
  last saved the project. Using a 4.4 API in a project whose features say 4.1
  produces "Invalid call. Nonexistent function" at runtime, often only on the
  code path that triggers it.
- **Writing to `res://` at runtime.** It works when running from the editor and
  fails silently or with a permission error in an exported build, because
  `res://` is inside the read-only `.pck`. Any save, config or log file must
  use `user://`.
- **Gitignoring `*.import`.** Usually done while trying to ignore the `.import/`
  folder in a 3.x project and carrying the rule to a 4.x project where the
  cache directory is `.godot/` instead. The result is a repo that imports
  differently on every machine.
- **Committing `.godot/`.** Multi-gigabyte binary churn on every asset touch,
  and constant merge conflicts on `global_script_class_cache.cfg`.
- **Using an autoload as the answer to every dependency question.** Every
  autoload is loaded for every scene, including test scenes and the main menu,
  and creates initialisation-order coupling that only manifests when someone
  reorders the list. See `godot-scene-composition` for the alternatives.
- **Renaming or moving files outside the editor.** Godot rewrites references
  when you move a file in the FileSystem dock. Moving it with `mv` or the OS
  file manager leaves every `.tscn` pointing at the old path; the scene opens
  with missing nodes.

## Validation

Run these from the project root and state the result:

```bash
# 1. Major version. Prints 5 for Godot 4.x, 4 for Godot 3.x.
grep -m1 '^config_version=' project.godot

# 2. Minor version and renderer (4.x only).
grep -E '^(config/features|renderer/rendering_method)' project.godot

# 3. Autoloads, in initialisation order.
sed -n '/^\[autoload\]/,/^\[/p' project.godot

# 4. No 3.x syntax left in a 4.x project (should print nothing).
grep -rnE '\b(yield\(|export\(|onready var|\.instance\(\)|KinematicBody|Spatial\b)' --include='*.gd' .

# 5. No 4.x-only syntax in a 3.x project (should print nothing).
grep -rnE '(@onready|@export|\bawait\b|\.instantiate\(\))' --include='*.gd' .

# 6. Import sidecars are tracked.
git ls-files '*.import' | wc -l      # expect roughly one per imported asset
git check-ignore -v $(git ls-files -o --exclude-standard | head -1) 2>/dev/null
```

Headless project load, which parses every script and reports errors without
opening a window (Godot 4; use `--no-window` instead of `--headless` on 3.x):

```bash
godot --headless --path . --quit
```

**Passing looks like:** check 1 prints a single number you have recorded; checks
4 and 5 print nothing; the headless load exits 0 with no `SCRIPT ERROR` or
`ERROR: Failed to load` lines on stderr.

## References

- [Version and layout reference, including the Godot 3.x to 4.x rename table](references/REFERENCE.md)
- [Godot docs: project organization](https://docs.godotengine.org/en/stable/tutorials/best_practices/project_organization.html)
- [Godot docs: file paths in Godot projects](https://docs.godotengine.org/en/stable/tutorials/io/data_paths.html)
- [Godot docs: version control systems](https://docs.godotengine.org/en/stable/tutorials/best_practices/version_control_systems.html)
- [Godot docs: upgrading from Godot 3 to Godot 4](https://docs.godotengine.org/en/stable/tutorials/migrating/upgrading_to_godot_4.html)
- [GitHub Godot.gitignore](https://github.com/github/gitignore/blob/main/Godot.gitignore)
