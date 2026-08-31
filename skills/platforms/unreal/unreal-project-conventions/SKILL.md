---
name: unreal-project-conventions
description: Orient in an Unreal Engine project before changing anything - resolve the engine version from the .uproject, map modules and build targets, learn the naming and folder conventions, and decide where new code belongs. Load this first on any UE codebase, even for a narrow task, because the engine version and module layout gate almost every other decision an agent will make.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: unreal
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "software-architecture, dependency-analysis"
  uad-tags: "uproject, unrealbuildtool, modules, targets, naming, orientation, engine version"
  uad-maturity: stable
---

# Unreal project conventions

## Purpose

An Unreal project is not "a C++ codebase with some assets". It is a set of
UnrealBuildTool modules described by `.Build.cs` files, assembled by targets
described by `.Target.cs` files, glued to a binary content tree by a reflection
system that runs before the compiler. Editing the wrong file, or writing code
for the wrong engine version, produces failures that look like compiler noise
but are structural. This skill establishes the facts an agent needs before it
writes a single line: which engine, which modules, which conventions.

## When to use

- First contact with an unfamiliar `.uproject` / Unreal repository.
- Before adding a new class, module, or plugin, when you need to decide where it goes.
- A build fails with `Unresolved external symbol` on an engine symbol, or a module refuses to load.
- Someone asks "where does X live in this project" or "why is this class in a plugin".
- Before applying any other `unreal-*` skill, to resolve the version those skills defer to.

## When NOT to use

- Deep work inside a single subsystem once orientation is done - use the focused skill
  (`unreal-cpp-gameplay`, `unreal-networking-replication`, and so on).
- Packaging, cooking and build-configuration failures - `unreal-packaging-build`.
- Pure content/asset organisation and reference chains - `unreal-assets-data`.

## Required context

Establish all of these from the repository, not by asking:

- **Engine version.** `*.uproject` at the repo root, key `EngineAssociation`. See
  Version constraints - this is the gate for everything else.
- **Modules and their types.** The `Modules` array in the `.uproject`, plus every
  `Source/**/ *.Build.cs`. Each module's `Type` (`Runtime`, `Editor`, `Developer`,
  `Program`) and `LoadingPhase` matter.
- **Targets.** `Source/*.Target.cs`. There is at least `<Project>.Target.cs` and
  `<Project>Editor.Target.cs`; a networked game usually adds `Server` and `Client`.
- **Enabled plugins.** The `Plugins` array in the `.uproject` plus `Plugins/**/ *.uplugin`.
  Marketplace/engine plugins are enabled here; project plugins live in `Plugins/`.
- **Project-wide settings.** `Config/DefaultEngine.ini` (renderer, physics, networking),
  `Config/DefaultGame.ini` (Asset Manager, packaging), `Config/DefaultInput.ini`.
- **C++ or Blueprint-only.** No `Source/` directory means Blueprint-only; a C++ change
  request then requires converting the project (adding a module) first.

## Version constraints

**Resolve the engine version before anything else, and never assume the newest.**

1. Read `EngineAssociation` from the `.uproject`.
   - A version string (`"5.4"`, `"5.7"`) means a launcher/binary engine install.
   - **A GUID means a source or custom build.** Do not guess. Find the engine root
     (Windows: registry key `HKEY_CURRENT_USER\SOFTWARE\Epic Games\Unreal Engine\Builds`
     maps the GUID to a path; on Linux/macOS see `~/.config/Epic/UnrealEngine/Install.ini`)
     and read `Engine/Build/Build.version`, which holds `MajorVersion`, `MinorVersion`
     and `PatchVersion`. An empty `EngineAssociation` means the project sits inside
     the engine tree - the engine is the parent directory.
2. Cross-check with `Source/*.Target.cs`: `BuildSettingsVersion` and
   `IncludeOrderVersion` name the semantics the project opted into, and are often a
   more honest signal of the code's age than the engine it currently compiles against.
3. Record the resolved version and state it in your output. Every other `unreal-*`
   skill assumes you did this.

What actually changes across UE 5.x and will silently break generated code:

- **5.0** - UE5 baseline: `TObjectPtr` in `UPROPERTY`, `MarkAsGarbage()` replacing
  `MarkPendingKill()`, World Partition, Nanite, Lumen.
- **5.1** - Enhanced Input becomes the default input path; legacy axis/action mappings
  remain but are deprecated.
- **5.2+** - Include-What-You-Use tightening; monolithic engine headers keep disappearing,
  so a missing `#include` that compiled in 5.0 fails later.
- **5.3+** - `IncludeOrderVersion` values gain new entries each release;
  Enhanced Input user settings replace the older mappable-config path.
- **5.5+** - Several `AActor` replication fields (`bReplicates`, `NetUpdateFrequency`,
  `NetPriority`) moved behind setters/getters; direct assignment stops compiling.
  Verify against the engine before writing to them.
- **5.7** - current stable at time of writing. Nanite Foliage experimental,
  MegaLights beta, PCG and Substrate production-ready.

Anything stated as "always" in older tutorials is suspect. Prefer reading the engine
header in the installed engine over trusting memory for any signature.

## Workflow

1. **Resolve the version.** As above. Stop and report if `EngineAssociation` is a GUID
   you cannot resolve - guessing is worse than asking.
2. **Map the build graph.** List `Source/*.Target.cs` and every `*.Build.cs`. For each
   module, note `PublicDependencyModuleNames` vs `PrivateDependencyModuleNames`. This
   is the dependency graph; treat it as the architecture diagram, because it is enforced.
3. **Classify the tree.** `Source/` (C++), `Content/` (binary assets, `.uasset`/`.umap`),
   `Config/` (ini), `Plugins/` (project plugins). `Binaries/`, `Intermediate/`, `Saved/`,
   `DerivedDataCache/` are generated - never edit, never commit, and never reason about
   them as source of truth.
4. **Locate the gameplay entry points.** `Config/DefaultEngine.ini`
   `[/Script/EngineSettings.GameMapsSettings]` gives the default and startup maps and
   the default `GameInstance` class; the map's World Settings names the `GameMode`.
   That chain is how you find the code that actually runs.
5. **Decide placement for new code.** Reusable and self-contained -> a plugin under
   `Plugins/`. Game-specific -> the primary game module. Editor-only tooling -> an
   `Editor` type module, never `#if WITH_EDITOR` scattered through runtime code.
   Adding a module means editing the `.uproject` `Modules` array *and* creating
   `Source/<Name>/<Name>.Build.cs` with a matching module implementation.
6. **Regenerate and build before editing further.** Regenerate project files
   (right-click the `.uproject`, or `UnrealBuildTool -projectfiles`) and build the
   editor target once, so you can distinguish pre-existing breakage from yours.
7. **Follow the existing conventions over the canonical ones.** If the project prefixes
   its classes differently from Epic's convention, match the project. Consistency inside
   the codebase beats correctness against a style guide.

## Best practices

- Put a new gameplay system in its own module or plugin when it has no dependency on the
  game module. UBT will then *enforce* that boundary, which no amount of code review can.
- Keep `PublicDependencyModuleNames` minimal; anything listed there is inherited by every
  module that depends on you and inflates compile times across the project.
- Class prefixes are load-bearing, not cosmetic: `U` for `UObject`, `A` for `AActor`,
  `F` for plain structs/classes, `I` for interfaces, `E` for enums, `T` for templates,
  `S` for Slate widgets, `b` for booleans. UnrealHeaderTool and the reflection system
  rely on the `U`/`A`/`F`/`I` distinction being right.
- Asset prefixes follow the same logic for content: `BP_`, `WBP_`, `SM_`, `SK_`, `M_`,
  `MI_`, `T_`, `NS_`, `ABP_`, `DA_`, `DT_`. Reference Viewer output is unreadable without them.
- Never commit `Binaries/`, `Intermediate/`, `Saved/`, `DerivedDataCache/`. Do commit
  `Config/`, `Content/`, `Source/`, `*.uproject`.
- Treat `.uasset` and `.umap` as binary: they cannot be merged. See
  `version-control-workflow` and enforce exclusive checkout on content.

## Common mistakes

- **Assuming the newest engine version.** Tempting because docs default to it. Produces
  code using APIs that do not exist in the project's engine, and the error surfaces as an
  unrelated compile failure. Resolve `EngineAssociation` first, every time.
- **Adding a module in the `.uproject` but forgetting the `IMPLEMENT_MODULE` /
  `.Build.cs` pairing** (or vice versa). The editor then fails at startup with
  "module could not be found" and the project will not open - a much worse failure than
  a compile error, because the fix cannot be made from inside the editor.
- **Adding an `#include` for a class whose module is not in `Build.cs`.** The header
  resolves (the include paths are broad) but linking fails with unresolved externals on
  engine symbols. The fix is a dependency entry, not an include change.
- **Creating classes with the wrong prefix**, e.g. `UMyActor : public AActor`. UHT accepts
  it inconsistently, and every downstream reader mis-reasons about lifetime and ownership.
- **Editing files under `Intermediate/`** (including generated `.gen.cpp` and the
  generated Visual Studio project). They are regenerated and the change vanishes,
  usually after an hour of confusion.
- **Treating the `Content/` tree as safe to reorganise from the filesystem.** Moving
  `.uasset` files outside the editor breaks every reference to them. Move assets in the
  Content Browser so redirectors are created.

## Validation

- The editor target builds clean from the command line:
  `Engine/Build/BatchFiles/Build.bat <Project>Editor Win64 Development -Project="<abs path>.uproject" -WaitMutex`
  Passing = exit code 0 and a `Build succeeded` line. On Linux/macOS use
  `Engine/Build/BatchFiles/{Linux,Mac}/Build.sh` with the same arguments.
- The editor opens the project and the Output Log shows no `LogModuleManager: Warning`
  or `Error` entries about your modules during startup.
- Every module you touched is reachable: `Window > Developer Tools > Modules` lists it
  as `Loaded`.
- The version you resolved is stated explicitly in your report, with the file you read
  it from. If you could not resolve it, say so rather than proceeding.

## References

- [Module, target and layout reference](references/REFERENCE.md)
- [Unreal Engine coding standard](https://dev.epicgames.com/documentation/en-us/unreal-engine/epic-cplusplus-coding-standard-for-unreal-engine)
- [Unreal Build Tool](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-build-tool-in-unreal-engine)
- [Project structure and directories](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-directory-structure)
