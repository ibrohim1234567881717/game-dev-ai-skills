---
name: minecraft-worldgen
description: Adding biomes, features, ore placement, structures and dimensions to a Minecraft mod on Fabric or NeoForge. Covers the data-driven worldgen registry model, configured versus placed features, placement modifiers, structure sets, biome modification per loader, datapack registry bootstrap in datagen, and how to debug worldgen that does not appear. Use when adding ore generation, a custom biome, a structure or a dimension, or when generated content is missing from new chunks.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: minecraft
  uad-domain: gamedev
  uad-version: "1.0.0"
  uad-requires: "gameplay-systems, performance-profiling-method"
  uad-tags: "worldgen, biome, feature, placement modifier, structure, dimension, ore generation, biome modifier, datapack registry"
  uad-maturity: stable
---

# Minecraft World Generation

## Purpose

Worldgen is data, not code. Since the 1.18 line, biomes, features, placements,
structures and dimensions live in **datapack registries** — JSON loaded per
world, not Java registered at mod load. Java's role is to register the *types*
(feature types, structure types, placement modifier types) and to bootstrap the
JSON through data generation. Getting this backwards, or getting the
configured/placed feature split wrong, produces the platform's most frustrating
failure: everything loads, nothing generates, nothing is logged. This skill
covers the model, the per-loader biome modification hook, and how to actually
see what is happening.

## When to use

- Adding ore generation, plants, boulders, geodes or any other feature.
- Adding a custom biome, or changing what generates in vanilla biomes.
- Adding a structure, structure set or jigsaw structure.
- Adding a dimension.
- Content generates in some worlds but not others, or only in newly generated
  chunks, or not at all.
- Deciding whether new content belongs in Java or in JSON.

## When NOT to use

- The loader, version and mappings are unresolved. Run
  `minecraft-project-conventions` first.
- The block being placed does not exist yet. Register it first
  (`minecraft-blocks-items`).
- Mob spawn *rules* attached to the entity type. That is
  `minecraft-entities-mobs`; this skill covers the biome-side spawner list.
- Chunk generation cost and server tick impact. Worldgen is the single most
  expensive thing a mod can make worse; see `minecraft-performance`.

## Required context

**`gradle.properties` answers the first three; open it first.**

| Fact | Where | Why it decides the code |
|---|---|---|
| Loader | `gradle.properties`, metadata file | Biome modification is a Fabric API Java call, and a JSON biome modifier on NeoForge. This is the largest single API divergence in the whole platform. |
| Minecraft version | `gradle.properties` (`minecraft_version`) | Datapack registry directory names singularised in 1.21; placement modifier and structure APIs moved repeatedly across the 1.19–1.21 line. |
| Mappings | `gradle.properties` or `officialMojangMappings()` | `RegistryKey` vs `ResourceKey`, `Identifier` vs `ResourceLocation`. |
| Whether datagen exists | `gradlew tasks --all` | Bootstrapping worldgen JSON through datagen is strongly preferred; see `minecraft-recipes-datagen`. |
| Existing worldgen data | `data/<mod_id>/worldgen/…` and `src/*/generated` | Tells you whether the project already bootstraps datapack registries and in what style. |

## Version constraints

Shapes below are from the 1.21.x line. **Worldgen class names and JSON schemas
move more than almost anything else; confirm against the project's own sources
and against a vanilla JSON of the same kind before writing either.**

- **Datapack registry directories singularised in 1.21**, matching the rest of
  the data pack. `worldgen/configured_feature`, `worldgen/placed_feature`,
  `worldgen/biome`, `worldgen/structure`, `worldgen/structure_set`. Files at the
  old plural paths are ignored silently.
- **Configured vs placed features** has been the model since 1.18 and is stable:
  a *configured feature* says what to build, a *placed feature* says where and
  how often. A configured feature alone never generates.
- **NeoForge biome modifiers** are JSON files under
  `data/<ns>/neoforge/biome_modifier/`, using types such as
  `neoforge:add_features` and `neoforge:add_spawns`. On older Forge the folder
  and namespace were `forge`. Confirm the current directory in your NeoForge
  version's docs.
- **Fabric biome modification** is the `BiomeModifications` API from Fabric API,
  with `BiomeSelectors` predicates. It is Java, runs at world load, and has no
  JSON equivalent.
- **Placement modifier order matters and has version-specific classes.** The
  usual chain is count/rarity, then spread, then height range, then biome
  filter. Copy the chain from a vanilla placed feature JSON of the same kind
  rather than assembling one from memory.

## Workflow

1. **Resolve and state the triple.** Label every file, including JSON paths.
2. **Decide Java or data.** New *types* (a `Feature` subclass, a `StructureType`,
   a custom `PlacementModifierType`) are Java and are registered at mod load.
   Everything else — configured features, placed features, biomes, structures,
   structure sets, dimensions — is datapack registry data.
3. **Register any custom types** in a holder class on the loader's normal
   registration path.
4. **Declare `ResourceKey`s** for each configured and placed feature in a
   constants class. These keys are the link between the bootstrap code, the JSON
   and the biome modifier; a typo here is the most common silent failure.
5. **Bootstrap the entries in datagen** using a `RegistrySetBuilder`, then run
   the datagen task and read the emitted JSON against a vanilla equivalent.
6. **Attach the placed feature to biomes** through the loader's own mechanism —
   Fabric `BiomeModifications`, NeoForge biome modifier JSON.
7. **Test in a brand-new world.** Existing chunks are already generated and will
   never contain your feature. This step is not optional and catches most
   "it does not work" reports.
8. **Verify with `/locate`, chunk regeneration and the debug tools** below.

### Feature keys and bootstrap — MC 1.21.x, both loaders

The bootstrap code is vanilla API and looks the same on both loaders; what
differs is the datagen provider that runs it (see `minecraft-recipes-datagen`).

```java
// Both loaders — MC 1.21.x, Mojang mappings shown. Confirm the placement
// modifier class names against your version; they move.
public static final ResourceKey<ConfiguredFeature<?, ?>> RUBY_ORE =
        ResourceKey.create(Registries.CONFIGURED_FEATURE, ExampleMod.id("ruby_ore"));
public static final ResourceKey<PlacedFeature> RUBY_ORE_PLACED =
        ResourceKey.create(Registries.PLACED_FEATURE, ExampleMod.id("ruby_ore_placed"));
```

The configured feature describes the ore body (target block, replaceable rules,
vein size). The placed feature wraps it with modifiers: how many attempts per
chunk, how they spread vertically, which height range, and a biome filter.
**Both are required.** A configured feature with no placed feature never runs.

### Attaching to biomes — Fabric, MC 1.21.x, Yarn mappings

```java
// Fabric — MC 1.21.x, Yarn mappings. Requires the Fabric API biome module.
// Called from ModInitializer#onInitialize.
BiomeModifications.addFeature(
        BiomeSelectors.foundInOverworld(),
        GenerationStep.Feature.UNDERGROUND_ORES,
        ModPlacedFeatures.RUBY_ORE_PLACED);
```

### Attaching to biomes — NeoForge, MC 1.21.x, Mojang mappings

NeoForge has no Java equivalent. The attachment is a data file, generated by
datagen or written by hand, at
`data/<mod_id>/neoforge/biome_modifier/add_ruby_ore.json`:

```json
{
  "type": "neoforge:add_features",
  "biomes": "#minecraft:is_overworld",
  "features": "examplemod:ruby_ore_placed",
  "step": "underground_ores"
}
```

Confirm the directory (`neoforge/biome_modifier`) and the type ids against the
NeoForge version in `gradle.properties`; both changed when NeoForge forked from
Forge.

### Structures and dimensions — MC 1.21.x, both loaders

Structures need a `Structure` entry, a `StructureSet` entry controlling spacing
and separation, and — for jigsaw structures — template pools and NBT structure
files. A structure with no structure set never generates and `/locate` reports
that it is unknown. Dimensions need a dimension type and a level stem; they are
entirely data, and the most common failure is a dimension that loads but
generates the void because its noise settings key does not resolve.

### Debugging worldgen

- **New world, every time.** Chunk data is permanent.
- `/locate structure <mod_id>:<name>` — "unknown structure" means the entry did
  not load; "could not find" means it loaded but is too rare or biome-excluded.
- `/place feature <mod_id>:<placed_feature>` forces a placed feature at your
  position. If this works but natural generation does not, the problem is the
  biome attachment, not the feature.
- `/reload` reports datapack parse errors for worldgen JSON. Read the log; a
  malformed worldgen file usually reports the exact field.
- Chunk borders (`F3+G`) plus creative flight over a superflat or amplified
  world makes rare features visible far faster than survival exploration.

## Best practices

- **Copy a vanilla JSON of the same kind as the starting point.** Vanilla ships
  a correct example of every worldgen type for your exact version; it is the
  only documentation guaranteed to be current.
- **Generate worldgen JSON through datagen**, so the keys in Java and the ids in
  JSON cannot drift apart.
- **Use biome tags in selectors**, not lists of biome ids. A list excludes every
  modded biome, which in a pack means your ore does not exist in most of the
  world.
- **Keep feature counts low.** Ore and plant features run for every chunk
  generated, forever. A count that seems modest multiplies across a server's
  chunk generation load; see `minecraft-performance`.
- **Name the placed feature and the configured feature differently** and
  consistently (`ruby_ore` / `ruby_ore_placed`). Debugging is much easier when
  the log line tells you which layer failed.
- **Add a biome filter modifier last** in the placement chain. Without it, a
  feature can place into a biome that the selector never intended.
- **Treat dimensions as a large commitment.** A dimension multiplies chunk
  storage, generation cost and testing surface.

## Common mistakes

- **Testing in an existing world.** The feature will never appear in already
  generated chunks and hours are lost before anyone tries a new world.
- **Registering a configured feature but no placed feature.** Everything loads,
  nothing generates, nothing is logged.
- **Registering worldgen objects in Java as if they were normal registries.**
  On modern versions these are datapack registries; a Java-side
  `Registry.register` for a configured feature either fails or is ignored,
  depending on version.
- **Blending loaders.** Writing a NeoForge biome modifier JSON in a Fabric mod
  does nothing at all, and calling `BiomeModifications` in a NeoForge mod does
  not compile. This is the sharpest Fabric/NeoForge divergence in the platform.
- **Mismatched resource keys.** The key in the bootstrap, the JSON filename and
  the id in the biome modifier must agree exactly. One typo gives silence.
- **Using the plural pre-1.21 directory names** on 1.21+. Files are ignored.
- **Biome selectors listing vanilla biome ids.** Works in a vanilla test world,
  fails in every modpack.
- **Enormous ore counts "so it is easy to find during testing".** They ship. Use
  `/place feature` for testing instead and keep the real numbers honest.

## Validation

- `gradlew runDatagen` / `gradlew runData` completes and emits files under
  `data/<mod_id>/worldgen/…` with 1.21+ singular directory names.
- `gradlew build` compiles, and the jar contains the worldgen data:
  `jar tf build/libs/<name>.jar | grep worldgen`.
- `gradlew runClient`, then in a **new** creative world:
  - `/place feature <mod_id>:<placed_feature>` succeeds at your position.
  - Flying to fresh chunks shows the feature generating naturally at a plausible
    rate.
  - `/locate structure <mod_id>:<name>` finds the structure rather than
    reporting it unknown.
  - `/reload` logs no `Failed to parse` or `Unknown registry key` lines for your
    namespace.
- `gradlew runServer` generates a fresh world without errors, and
  `/tick query` (1.21+) or a spark profile shows chunk generation time in a
  normal range rather than dominated by your feature.
- On NeoForge, confirm the biome modifier applied: a feature that places with
  `/place` but never generates naturally means the modifier did not load.

## References

- [Loader, mappings and version reference tables](../minecraft-project-conventions/references/REFERENCE.md)
- [Fabric documentation — biome modification API](https://docs.fabricmc.net/)
- [NeoForge documentation — biome modifiers and datapack registries](https://docs.neoforged.net/)
- [Minecraft Wiki — custom world generation formats](https://minecraft.wiki/w/Custom_world_generation)
