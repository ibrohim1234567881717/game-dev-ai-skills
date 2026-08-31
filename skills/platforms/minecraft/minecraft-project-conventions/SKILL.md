---
name: minecraft-project-conventions
description: Entry skill for every Minecraft mod task. Forces resolution of the mod loader, the Minecraft version and the mappings from gradle.properties, fabric.mod.json and META-INF/neoforge.mods.toml before any code is written, then explains the Gradle layout, source sets, resource layout, run configurations and where mod metadata lives on each loader. Load this first whenever a repository looks like a Minecraft mod.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: minecraft
  uad-domain: production
  uad-version: "1.0.0"
  uad-requires: "software-architecture, dependency-analysis"
  uad-tags: "gradle, loom, moddevgradle, neogradle, mappings, yarn, parchment, project setup, loader detection"
  uad-maturity: stable
---

# Minecraft Project Conventions

## Purpose

A Minecraft mod is not written against "Minecraft". It is written against one
exact combination of **mod loader + Minecraft version + mappings**. That triple
is a single indivisible fact: change any one of the three and class names,
method signatures, registration timing, resource paths and JSON schemas all
move. This skill establishes that fact from the project's own files before any
other Minecraft skill is allowed to produce code, and describes the Gradle and
resource layout that follows from it.

## When to use

- The repository contains `fabric.mod.json`, `neoforge.mods.toml`, `mods.toml`,
  `quilt.mod.json`, or a `build.gradle` mentioning `fabric-loom`,
  `net.neoforged` or `architectury`, and any work is about to start.
- Someone asks to "add a block", "add an item", "make a mod" and no loader or
  version has been stated yet.
- A build fails with `cannot find symbol`, `method does not override`, or
  `NoSuchMethodError` at runtime, which almost always means code from the wrong
  version or loader was pasted in.
- A new mod project is being scaffolded and the toolchain has to be chosen.

## When NOT to use

- Server plugin work (Bukkit, Spigot, Paper, Velocity). Those are a different
  ecosystem with no mappings problem of this shape and no client side.
- Datapack-only or resource-pack-only work with no Java. The version still
  matters, but the Gradle and loader material here does not apply.
- Once the triple is resolved and the task is specific, hand off to the skill
  that owns it (`minecraft-mod-architecture`, `minecraft-blocks-items`,
  `minecraft-networking`, and so on). This skill is the gate, not the whole job.

## Required context

Nothing may be written until all three of these are known. **`gradle.properties`
answers all three in most modern projects and is the first file to read.**

| Fact | Where it lives | Typical key or marker |
|---|---|---|
| Mod loader | `gradle.properties`; `src/main/resources/fabric.mod.json`; `src/main/resources/META-INF/neoforge.mods.toml` | `neoforge_version`, `loader_version`, `forge_version` |
| Minecraft version | `gradle.properties` | `minecraft_version=1.21.1` |
| Mappings | `gradle.properties` and the build script | `yarn_mappings`, `parchment_mappings_version`, `mapping_channel`, or `officialMojangMappings()` in the build script |
| Mod id | `gradle.properties`, and the metadata file | `mod_id`, `"id"`, `modId` |
| Java version | `gradle.properties`, `build.gradle` toolchain block | `java_version`, `JavaLanguageVersion.of(21)` |
| Loader API version | `gradle.properties` | `fabric_version` (Fabric API), `neoforge_version` |

If `gradle.properties` and the metadata file disagree, trust
`gradle.properties` for the toolchain and report the mismatch rather than
silently picking one. If any of the three cannot be resolved from files, ask.
Guessing here is the most expensive mistake available in this ecosystem.

## Version constraints

- **Loaders.** NeoForge forked from Forge in 2023 and is the default loader for
  1.20.5 and later; Forge remains for older packs; Fabric is the lighter,
  faster-updating alternative; Quilt is a minority fork of Fabric. NeoForge and
  Fabric share no API surface. Any snippet that blends them is wrong on both.
- **Versions.** The 1.21.x line is current, with NeoForge builds tracking
  releases such as 1.21.1, 1.21.6, 1.21.9 and 1.21.11. Treat 1.20.1, 1.20.4,
  1.20.6, 1.21.1 and later 1.21.x as separate targets, not as "1.20/1.21".
- **Metadata file name.** NeoForge moved mod metadata to
  `META-INF/neoforge.mods.toml` around 1.20.5; older Forge and early NeoForge
  used `META-INF/mods.toml`. The presence of one or the other is itself a
  version signal.
- **Mappings.** Fabric projects usually use Yarn; NeoForge projects use official
  Mojang mappings, usually with Parchment layered on for parameter names. The
  same class has different names in each (see the table in
  [references/REFERENCE.md](references/REFERENCE.md)).
- **Data pack directory names changed in 1.21**, from plural to singular
  (`recipes` to `recipe`, `loot_tables` to `loot_table`, `tags/items` to
  `tags/item`, and similar). Verify the layout of an existing project rather
  than assuming, and prefer data generation, which emits whatever the target
  version expects.
- Anything below is a shape to expect, not a signature to trust. Confirm names
  against the project's own decompiled sources and its mapping files before
  committing code.

## Workflow

1. **Read `gradle.properties` first.** Record loader, `minecraft_version`,
   mappings, `mod_id`, Java version. Quote the actual lines back; do not
   paraphrase them from memory.
2. **Confirm with the metadata file.** `src/main/resources/fabric.mod.json` for
   Fabric, `src/main/resources/META-INF/neoforge.mods.toml` for NeoForge. Check
   the mod id matches `gradle.properties` and note the declared dependency
   ranges (`"minecraft": ">=1.21"`, `versionRange="[21.1,)"`).
3. **Read the build script.** `build.gradle` or `build.gradle.kts` tells you the
   plugin (`fabric-loom`, `net.neoforged.moddev`, NeoGradle, `architectury-loom`),
   the mappings block, the Java toolchain and the declared run configurations.
   A multi-project build with `common/`, `fabric/`, `neoforge/` means a
   multiloader setup; hand off to `minecraft-loader-portability`.
4. **State the resolved triple out loud** before writing anything, in the form
   `NeoForge / 1.21.1 / Mojang + Parchment`. Every code block produced from now
   on carries that label as a comment on its first line.
5. **Map the source layout.** `src/main/java` for common code; `src/main/resources`
   for assets and data; on Fabric, `src/client/java` and `src/client/resources`
   when `splitEnvironmentSourceSets()` is enabled. Client-only code belongs in
   the client source set or behind an explicit dist check, never in common code.
6. **Locate the run configurations.** `gradlew tasks --all | grep run` lists what
   exists: typically `runClient`, `runServer`, plus `runDatagen` on Fabric or
   `runData` on NeoForge, and `runGameTestServer` where game tests are set up.
7. **Prove the baseline builds before changing it.** `gradlew build` on a clean
   checkout. If the project does not compile before your edit, you cannot
   attribute a later failure to anything.
8. **Only now** load the task-specific skill and write code.

## Best practices

- Keep every coordinate in `gradle.properties` and reference it from the build
  script and from metadata templating. One source of truth per fact means a
  version bump is one edit, not a scavenger hunt.
- Use the mod id consistently as the resource namespace: `mod_id` in Gradle, the
  `"id"` in metadata, the namespace in every `ResourceLocation`/`Identifier`, and
  the `assets/<mod_id>/` and `data/<mod_id>/` directories.
- Prefer generated resources over hand-written JSON. Generated files follow the
  target version's schema automatically; hand-written ones rot silently.
- Commit the Gradle wrapper and run through `./gradlew` (or `gradlew.bat`), so
  everyone builds with the same Gradle. Loom and ModDevGradle both pin
  behaviour to their Gradle version.
- Keep a `# Minecraft 1.21.1 / NeoForge` style header comment in the build
  script. It is the cheapest defence against someone pasting 1.20.1 code in.
- When bumping the Minecraft version, bump loader, API and mappings together in
  one commit, then fix the compile errors. Partial bumps produce dependency
  resolution failures that look like network problems.

## Common mistakes

- **Writing code before resolving the triple.** The tempting move is to answer
  "how do I register an item" generically. There is no generic answer:
  registration differs between Fabric and NeoForge, and item construction
  changed inside 1.21 itself. The result compiles nowhere. Resolve first.
- **Trusting a tutorial's version.** Most search results target 1.16, 1.18 or
  1.20.1. Their registration and networking code does not compile on 1.21.x.
  Treat any snippet without a stated version as unusable.
- **Mixing mappings.** Pasting Yarn names (`Identifier`, `World`,
  `PlayerEntity`) into a Mojang-mapped NeoForge project produces a wall of
  `cannot find symbol`. The fix is translation, not imports.
- **Putting client classes in `src/main/java` and referencing them from common
  code.** It runs fine in `runClient` and crashes the dedicated server with
  `NoClassDefFoundError` on first load. See `minecraft-mod-architecture`.
- **Editing `build/` or `run/` contents.** Both are generated. Changes there
  vanish on the next build and confuse everyone reading the diff.
- **Adding the loader API as `implementation` instead of the loader-specific
  configuration.** On Loom, `modImplementation` is what maps the dependency
  through the remapper; a plain `implementation` gives you an unmapped jar that
  fails at runtime.

## Validation

- `gradlew build` completes. This is the only proof that the code matches the
  resolved triple. A green build after a mapping mistake is impossible.
- `gradlew runClient` reaches the main menu, and the mod appears in the mod list
  with the id and version from `gradle.properties`.
- `gradlew runServer` reaches `Done (…s)! For help, type "help"`. This is the
  check that catches client-only classes leaking into common code, and it is
  not optional for any mod that touches rendering or screens.
- `gradlew tasks --all` lists the run and datagen tasks you expect. A missing
  `runDatagen`/`runData` means data generation is not configured yet.
- The generated jar contains `assets/<mod_id>/` and `data/<mod_id>/` at the
  paths the target version expects; check with
  `jar tf build/libs/<name>.jar | head -40`.

## References

- [Loader, mappings and version reference tables](references/REFERENCE.md)
- [Fabric documentation](https://docs.fabricmc.net/)
- [NeoForge documentation](https://docs.neoforged.net/)
- [Fabric Loom](https://github.com/FabricMC/fabric-loom)
- [NeoForge ModDevGradle](https://github.com/neoforged/ModDevGradle)
- [Parchment mappings](https://parchmentmc.org/docs/getting-started)
