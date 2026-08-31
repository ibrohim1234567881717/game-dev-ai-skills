---
name: unity-project-conventions
description: Orient in an unfamiliar Unity project before changing anything - resolve the editor version from ProjectSettings/ProjectVersion.txt and the render pipeline from Packages/manifest.json, then read the assembly definition layout, package manifest, meta file rules and .gitignore realities. Use this first on any Unity repository, when adding or moving files, when assembly references fail to compile, when a change does not appear in the editor, or when setting up version control for a Unity project. This is the entry point for every other Unity skill.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: unity
  uad-domain: production
  uad-version: "1.0.0"
  uad-requires: "software-architecture, dependency-analysis, version-control-workflow"
  uad-tags: "unity, project layout, asmdef, packages, meta files, version detection, render pipeline detection"
  uad-maturity: stable
---

# Unity Project Conventions

## Purpose

A Unity project is a filesystem convention, not a solution file. What is
correct depends on two facts that are never stated in the code: the **editor
version** and the **render pipeline**. Guessing either produces advice that
compiles nowhere. This skill establishes both, then explains the layout that
every other Unity skill assumes: assembly definitions, `Packages/manifest.json`,
`.meta` files, and what a Unity `.gitignore` must and must not contain.

## When to use

- First contact with a Unity repository, before reading or writing any code.
- Before any task that touches shaders, lighting, cameras or post-processing
  (those are pipeline-dependent and must not be started blind).
- Adding, moving, renaming or deleting assets and scripts.
- A compile error like `The type or namespace name 'X' could not be found`
  that is really an assembly definition reference problem.
- Setting up or repairing `.gitignore`, Git LFS, or merge tooling.
- A code change that "does not do anything" in the editor.

## When NOT to use

- Choosing between URP, HDRP and Built-in or migrating between them - that is
  `unity-render-pipelines`.
- Player settings, scripting backend and shipping builds - `unity-build-pipeline`.
- Prefab and scene structure, overrides and merge conflicts in `.unity` and
  `.prefab` files - `unity-prefabs-scenes`.
- Editor scripts and custom inspectors - `unity-editor-tooling`.

## Required context

Establish every one of these from files before acting. Do not ask the user for
what the repository already answers.

| Fact | File | What to read |
|---|---|---|
| Editor version | `ProjectSettings/ProjectVersion.txt` | `m_EditorVersion:` - e.g. `6000.0.23f1` |
| Render pipeline | `Packages/manifest.json` | `com.unity.render-pipelines.universal` = URP, `...high-definition` = HDRP, **neither = Built-in** |
| Pipeline actually assigned | `ProjectSettings/GraphicsSettings.asset` | `m_CustomRenderPipeline` - a `{fileID: 0}` here with a URP package present means the asset was never assigned |
| Per-quality pipeline override | `ProjectSettings/QualitySettings.asset` | `renderPipeline:` per quality level overrides the graphics default |
| Package set and versions | `Packages/manifest.json`, `Packages/packages-lock.json` | `dependencies`, plus resolved transitive versions in the lock file |
| Assembly layout | `**/*.asmdef` | names, `references`, `includePlatforms`, `defineConstraints` |
| Input handling | `ProjectSettings/ProjectSettings.asset` | `activeInputHandler:` `0` = legacy only, `1` = Input System only, `2` = both |
| Colour space | `ProjectSettings/ProjectSettings.asset` | `m_ActiveColorSpace:` `0` Gamma, `1` Linear |
| Asset serialization | `ProjectSettings/EditorSettings.asset` | `m_SerializationMode: 2` (Force Text) is required for diffable scenes |
| Scripting backend | `ProjectSettings/ProjectSettings.asset` | `scriptingBackend` per build target (Mono vs IL2CPP) |

If `ProjectVersion.txt` is missing, this is not a full Unity project (a package
repository or a stripped export) - say so rather than assuming a version.

## Version constraints

- Unity 6 reports as **`6000.x.y`** in `ProjectVersion.txt`. `6000.0` is Unity
  6.0, `6000.1` is 6.1, `6000.2` is 6.2, `6000.3` is 6.3 (the current LTS).
  Unity 6.x is the current line; treat it as the default target.
- `2022.3.x` and `2021.3.x` are the previous LTS lines and are still common in
  shipping projects. `2023.x` was the tech stream that became Unity 6 - treat
  anything `2023.x` as pre-6 and verify APIs individually.
- Render pipeline package versions track the editor: URP/HDRP **17.x** with
  Unity 6.0, **14.x** with 2022.3, **12.x** with 2021.3. A pipeline package
  version that does not match the editor line is a red flag - check whether the
  package is embedded in `Packages/` or pinned to a git URL.
- Package APIs move faster than the editor. Read the exact version from
  `manifest.json` before using any package API, and when a detail matters and
  you are not certain it exists in that version, say so and check the installed
  package source under `Library/PackageCache/<package>@<version>/` or
  `Packages/` for embedded copies.

## Workflow

1. **Read `ProjectSettings/ProjectVersion.txt`.** Record the exact
   `m_EditorVersion`. Every later API decision is gated on it. If it is absent,
   stop and establish what the repository actually is.
2. **Read `Packages/manifest.json`.** Record the render pipeline (URP, HDRP, or
   neither = Built-in) and the versions of the packages relevant to the task:
   `com.unity.inputsystem`, `com.unity.addressables`,
   `com.unity.netcode.gameobjects`, `com.unity.entities`, `com.unity.timeline`,
   `com.unity.cinemachine`, `com.unity.burst`, `com.unity.test-framework`.
3. **Confirm the pipeline is actually in use.** A URP package in the manifest
   with no asset assigned in `GraphicsSettings.asset` means the project still
   renders through Built-in. Check `QualitySettings.asset` too - per-level
   overrides are how a project ends up on two pipelines at once.
4. **Map the assembly graph.** List every `.asmdef`. Note which folder each one
   roots, its `references`, whether `autoReferenced` is false, and any
   `includePlatforms: [Editor]` (editor-only assemblies). Code with no
   enclosing `.asmdef` lands in the predefined `Assembly-CSharp`, which
   references every auto-referenced assembly but which nothing can reference
   back. That asymmetry causes most "type not found" errors.
5. **Locate the entry points.** Scenes in `Assets/Scenes/` are only a
   convention; the authoritative build list is `ProjectSettings/EditorBuildSettings.asset`
   (and, on Unity 6, build profile assets under `Assets/Settings/Build Profiles/`
   if the project uses them).
6. **Check version control hygiene** before writing files: `.gitignore` must
   ignore `Library/`, `Temp/`, `Obj/`, `Build/`, `Builds/`, `Logs/`,
   `UserSettings/`, `*.csproj`, `*.sln`; it must **not** ignore `*.meta`,
   `ProjectSettings/`, or `Packages/manifest.json`.
7. **Make the change in the right place.** New runtime code goes inside an
   existing assembly's folder or a new `.asmdef` with explicit references;
   editor code goes in an `Editor/` folder or an editor-only assembly.
8. **Verify it compiled.** See `Validation`. A Unity change is not done when the
   file is written - it is done when the editor recompiled without errors and
   the asset database picked up the new files.

## Best practices

- **Resolve version and pipeline first, every time.** They are two file reads
  and they invalidate whole categories of otherwise-correct advice.
- **Never move, rename or delete an asset without its `.meta` file.** The GUID
  in the `.meta` is the only identity Unity has; losing it breaks every
  reference in every scene and prefab, silently, as missing references.
- **Prefer many small assembly definitions over one giant `Assembly-CSharp`.**
  Assemblies are the compilation unit: a change inside one only recompiles that
  assembly and its dependents. This is the single biggest lever on iteration
  time in a large project.
- **Keep editor code in editor-only assemblies.** `includePlatforms: ["Editor"]`
  guarantees `UnityEditor` references cannot leak into a player build, which
  otherwise fails at build time, not at compile time.
- **Commit `Packages/packages-lock.json`.** Without it, package resolution can
  drift between machines and CI for anything not pinned to an exact version.
- **Set Asset Serialization to Force Text** and enable Unity's `UnityYAMLMerge`
  (Smart Merge) tool - binary scenes cannot be merged, reviewed or bisected.
- **Use Git LFS for large binaries** (textures, audio, meshes, video) and track
  the patterns before the files land, because retro-fitting LFS means rewriting
  history.

## Common mistakes

- **Assuming Built-in shader/lighting advice applies.** It is the historic
  default and most search results describe it, so it is the easy assumption.
  On a URP or HDRP project the shader compiles to magenta and the lighting
  setup does nothing. Read the manifest first.
- **Ignoring `.meta` files in `.gitignore`.** Tempting because they look like
  editor noise. It detaches every GUID, so pulled branches show empty
  inspectors and missing scripts. `.meta` files are source.
- **Committing `Library/`.** It is regenerated import cache, often gigabytes,
  and it is machine- and version-specific. Ignore it; the first import after a
  fresh clone is expected to be slow.
- **Editing files while the editor is open and expecting a refresh.** Unity
  imports on focus (or per the Asset Pipeline refresh setting). If the change
  does not appear, focus the editor or trigger `Assets > Refresh` (Ctrl+R)
  before concluding the code is wrong.
- **Adding a script to a folder covered by an `.asmdef` that does not reference
  what the script uses.** The error names a type, not the assembly, so it reads
  like a missing `using`. Fix the `references` array, not the imports.
- **Putting `UnityEditor` calls in runtime code without `#if UNITY_EDITOR`.**
  It compiles in the editor and fails only when someone makes a build, usually
  the day of a milestone.
- **Deleting a `.meta` file for a folder** to "clean up". Folder GUIDs matter;
  Unity regenerates a new one and every path-based reference to that folder in
  Addressables groups or asset labels breaks.

## Validation

1. **Version and pipeline are on record.** State the exact `m_EditorVersion`
   and the pipeline (URP/HDRP/Built-in) with the file that proved each. Passing
   looks like two concrete strings, not "probably URP".
2. **Compile check.** In the editor, the Console shows zero errors and the
   bottom-right spinner has finished. Headless equivalent, run from the project
   root with the matching editor version:
   `Unity -batchmode -quit -projectPath . -logFile - -executeMethod UnityEditor.SyncVS.SyncSolution`
   Passing means exit code 0 and no `error CS` lines in the log. (Any
   `-executeMethod` that forces a compile works; the point is a non-interactive
   compile.)
3. **Meta integrity.** `git status` after an asset change shows the asset and
   its `.meta` staged together. A staged asset without its `.meta`, or a
   deleted `.meta` without its asset, fails this check.
4. **Assembly graph is intact.** Every `.asmdef` referenced by name resolves;
   Unity reports unresolved references in the Console as
   `Assembly for Assembly Definition File ... will not be compiled`.
5. **No editor code in player assemblies.** Grep runtime assemblies for
   `using UnityEditor` outside `#if UNITY_EDITOR` blocks and outside
   `Editor/` folders; passing is zero hits.

## References

- [Bundled reference: file map, gitignore, asmdef fields](references/REFERENCE.md)
- [Unity Manual - Special folder names](https://docs.unity3d.com/Manual/SpecialFolders.html)
- [Unity Manual - Assembly definitions](https://docs.unity3d.com/Manual/ScriptCompilationAssemblyDefinitionFiles.html)
- [Unity Manual - Project manifest](https://docs.unity3d.com/Manual/upm-manifestPrj.html)
- [Unity Manual - Meta files and asset workflow](https://docs.unity3d.com/Manual/AssetWorkflow.html)
- [Unity Manual - Version control integration](https://docs.unity3d.com/Manual/VersionControl.html)
