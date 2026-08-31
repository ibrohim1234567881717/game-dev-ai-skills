---
name: minecraft-recipes-datagen
description: Producing recipes, loot tables, tags, advancements and models through Minecraft data generation instead of hand-written JSON, on Fabric or NeoForge. Covers the datagen entrypoint per loader, provider classes, generated resource roots, tag conventions across loaders, and custom recipe serializers. Use when adding a recipe or loot table, when data pack JSON silently fails to load, or when setting up runDatagen/runData for a mod.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: minecraft
  uad-domain: production
  uad-version: "1.0.0"
  uad-requires: "gameplay-systems, testing-strategy"
  uad-tags: "datagen, recipes, loot tables, tags, advancements, data providers, runDatagen, runData, recipe serializer"
  uad-maturity: stable
---

# Minecraft Recipes and Data Generation

## Purpose

Recipes, loot tables, tags and advancements are data pack JSON. Their schemas
and even their directory names change between Minecraft versions, and a wrong
file does not crash — it is silently ignored, so the recipe simply does not
exist. Data generation solves this by making the game itself write the JSON from
Java code that will not compile if the schema moved. This skill covers setting
up datagen on each loader, writing providers, and the tag and serializer rules
that hand-written JSON gets wrong.

## When to use

- Adding a crafting, smelting, smithing or stonecutting recipe.
- Adding a block drop, chest loot or mob drop.
- Adding or consuming tags, especially cross-mod ingredient tags.
- A recipe or loot table exists on disk and the game behaves as if it does not.
- Setting up `runDatagen` / `runData` for the first time.
- Writing a custom recipe type with its own serializer.
- Bulk-generating block models, item models and blockstates for many blocks.

## When NOT to use

- The loader, version and mappings are unresolved. Run
  `minecraft-project-conventions` first.
- The content being generated for does not exist yet. Register the block or item
  first (`minecraft-blocks-items`), then generate its data.
- Worldgen JSON — biomes, features, structures. Those are datapack *registries*
  with their own bootstrap mechanism; see `minecraft-worldgen`.
- A pure data pack with no Java. Datagen needs a mod to run in.

## Required context

**`gradle.properties` answers the first three; open it first.**

| Fact | Where | Why it decides the code |
|---|---|---|
| Loader | `gradle.properties`, metadata file | Fabric uses `DataGeneratorEntrypoint` and `Fabric*Provider` classes; NeoForge uses `GatherDataEvent` and vanilla provider subclasses. Different classes entirely. |
| Minecraft version | `gradle.properties` (`minecraft_version`) | Data pack directories were singularised in 1.21; recipe JSON shape changed in the 1.21.2 window; loot table entries moved to registry-key form. |
| Mappings | `gradle.properties` or `officialMojangMappings()` | Provider and builder class names differ between Yarn and Mojang. |
| Datagen task name | `gradlew tasks --all` | `runDatagen` on Fabric, `runData` on NeoForge. If neither exists, datagen is not configured yet. |
| Generated resource root | `build.gradle` | Fabric Loom adds `src/main/generated` to resources; NeoForge conventionally uses `src/generated/resources`. Output that is not on a resource root ships nowhere. |

## Version constraints

Shapes below come from the 1.21.x line. **Provider class names and constructor
parameters are among the least stable things in the platform — confirm against
the project's own sources before writing a provider.**

- **1.21 singularised data pack directories**: `recipes` → `recipe`,
  `loot_tables` → `loot_table`, `advancements` → `advancement`,
  `tags/items` → `tags/item`, `tags/blocks` → `tags/block`. Hand-written JSON in
  the old paths is ignored with no error. Datagen writes the right one for you.
- **1.20.5 introduced data components**, so recipe results and loot entries that
  carried NBT now carry components. Old `nbt` fields do not parse.
- **1.21.2 changed recipe JSON** (result object shape, ingredient list form).
  Regenerate rather than editing generated output by hand.
- **Provider constructors gained a `CompletableFuture<HolderLookup.Provider>`**
  parameter in the 1.20.5 window, because component and registry-aware data
  needs registry access during generation. A provider written before that will
  not compile.
- **Tag namespaces differ by loader.** Fabric conventional tags live under the
  `c:` namespace; NeoForge uses the `c:` namespace too on modern versions after
  converging from `forge:`. Which exact tag names exist is version- and
  loader-specific — check the loader's conventional tags class rather than
  typing a tag id from memory.

## Workflow

1. **Resolve and state the triple.** Label every generated-code file.
2. **Confirm the datagen task exists**: `gradlew tasks --all`. If it does not,
   add it to the build script before writing providers.
3. **Create the datagen entrypoint** for the loader (below). On Fabric it is a
   separate entrypoint declared in `fabric.mod.json`; on NeoForge it is a
   `GatherDataEvent` listener on the mod bus.
4. **Add one provider per data kind** — recipes, loot tables, block/item tags,
   models, advancements. Keep them small and separate.
5. **Run the datagen task** and inspect the output tree. Read the generated JSON
   at least once: it teaches you the current schema better than any tutorial.
6. **Confirm the output directory is a resource root**, and that generated files
   land inside the built jar.
7. **Run `runClient` and test in game** — the recipe book, block drops, and the
   advancement toast are the real proof.
8. **Regenerate after every content change.** Stale generated data is worse than
   none because it looks intentional.

### Datagen entrypoint — Fabric, MC 1.21.x, Yarn mappings

```java
// Fabric — MC 1.21.x, Yarn mappings. Declared in fabric.mod.json under
// "entrypoints": { "fabric-datagen": ["com.example.datagen.ModDataGenerator"] }
public class ModDataGenerator implements DataGeneratorEntrypoint {
    @Override
    public void onInitializeDataGenerator(FabricDataGenerator generator) {
        FabricDataGenerator.Pack pack = generator.createPack();
        pack.addProvider(ModRecipeProvider::new);
        pack.addProvider(ModLootTableProvider::new);
        pack.addProvider(ModBlockTagProvider::new);
        pack.addProvider(ModModelProvider::new);
    }
}
```

Run with `gradlew runDatagen`. Loom writes to `src/main/generated` by default
and adds it as a resource root; confirm both in `build.gradle`.

### Datagen entrypoint — NeoForge, MC 1.21.x, Mojang mappings

```java
// NeoForge — MC 1.21.x, Mojang mappings. Mod event bus listener.
// The GatherDataEvent API surface has changed within the 1.21 line; confirm
// the accessor names against your NeoForge version before copying this.
@SubscribeEvent
public static void gatherData(GatherDataEvent event) {
    DataGenerator generator = event.getGenerator();
    PackOutput output = generator.getPackOutput();
    CompletableFuture<HolderLookup.Provider> lookup = event.getLookupProvider();
    ExistingFileHelper helper = event.getExistingFileHelper();

    generator.addProvider(event.includeServer(), new ModRecipeProvider(output, lookup));
    generator.addProvider(event.includeServer(), new ModLootTableProvider(output, lookup));
    generator.addProvider(event.includeClient(), new ModItemModelProvider(output, helper));
}
```

Run with `gradlew runData`. Output conventionally goes to
`src/generated/resources`, which the build script must add as a resource root.

### Recipes

Recipe builders are vanilla classes on both loaders — `ShapedRecipeBuilder` /
`ShapedRecipeJsonBuilder`, and the smelting and stonecutting equivalents. Two
rules matter more than the exact method names:

- **Every recipe needs an unlock criterion.** A recipe with no `criterion`/
  `unlockedBy` throws during generation on modern versions, and a recipe whose
  criterion never fires never appears in the recipe book.
- **Take ingredients from tags, not items, wherever a tag exists.** A recipe that
  demands your own copper ingot instead of the common tag will not accept
  another mod's identical ingot, and modpack players notice immediately.

### Loot tables

Block loot is the common case: a drop-self table, or a fortune-affected ore
table. Both loaders provide a block-loot provider base with helpers for these.
The important detail is that **the provider must be told which blocks it
covers**; a block registered but not listed in the provider generates no table
and drops nothing, silently.

### Tags

Declare tags your own content joins (`c:ingots/ruby`) and tags your content
consumes. Tag files merge across mods and data packs, so adding to a tag never
overwrites another mod's entry unless you explicitly set `replace: true` — which
you should never do without a reason you can state.

### Custom recipe serializers

A custom recipe type needs a `RecipeType`, a `RecipeSerializer`, a `Recipe`
implementation and — on modern versions — codecs for both the JSON form and the
network form. The serializer is registered like any other registry object, on
the loader's normal registration path. Keep the recipe's `matches` cheap: it is
called for every candidate recipe whenever a crafting grid changes.

## Best practices

- **Never hand-edit generated output.** It is overwritten on the next run, and
  the edit disappears without trace. Change the provider.
- **Commit generated resources** so reviewers can see the schema diff a version
  bump caused, and so a fresh clone builds without running datagen first.
- **Regenerate as part of the build habit**: `gradlew runDatagen build` (or
  `runData build`). A CI job that regenerates and diffs catches stale data.
- **One provider per concern.** A single 900-line provider becomes impossible to
  review; five small ones each fail loudly and locally.
- **Prefer tags over hardcoded item ids** in every recipe, every loot condition
  and every advancement trigger. It is the single largest determinant of whether
  a mod plays well in a pack.
- **Generate models in bulk** for families of blocks (stairs, slabs, walls). The
  model providers have helpers for exactly this and it removes a whole class of
  copy-paste JSON error.
- **Read the generated JSON once per version bump.** It is the most reliable
  documentation of the current schema that exists.

## Common mistakes

- **Hand-writing JSON into the pre-1.21 plural directories** (`recipes/`,
  `loot_tables/`). On 1.21+ the game ignores them completely: no error, no
  recipe. This is the most common "my recipe does nothing" cause.
- **Generated output not on a resource root.** Everything runs, the files exist
  in `build/`, and the jar contains none of them. Check `build.gradle`.
- **Forgetting to regenerate after renaming an item.** The old table still names
  the old id and the block drops nothing.
- **Omitting the recipe unlock criterion.** Generation fails outright on modern
  versions; on older ones the recipe is uncraftable in survival.
- **Blocks missing from the loot provider's block list.** They drop nothing in
  survival, which nobody notices in creative testing.
- **Using `replace: true` in a tag file.** It wipes every other mod's entries in
  that tag and produces bug reports aimed at the wrong mod.
- **Copying a provider constructor from an older version.** The
  `CompletableFuture<HolderLookup.Provider>` parameter arrived in the 1.20.5
  window; without it, nothing compiles, and with it in the wrong position,
  generation fails at runtime.
- **Running datagen against stale registries.** If the datagen run crashes,
  fix it — do not ship the partial output that the previous run left behind.

## Validation

- `gradlew runDatagen` (Fabric) or `gradlew runData` (NeoForge) exits zero. Any
  provider exception is a hard failure, not a warning.
- The output tree contains what you expect, at the singular 1.21+ paths:
  `data/<mod_id>/recipe/…`, `data/<mod_id>/loot_table/blocks/…`,
  `data/<mod_id>/tags/item/…`.
- `gradlew build`, then `jar tf build/libs/<name>.jar | grep <mod_id>` shows the
  generated data inside the jar.
- `gradlew runClient`, then in game:
  - The recipe appears in the recipe book once its criterion is met, and crafts.
  - `/recipe give @s <mod_id>:<recipe>` succeeds — a failure here means the
    recipe id does not exist.
  - Breaking the block in survival drops the expected item.
  - `/reload` produces no `Couldn't parse` or `Failed to load` lines naming your
    namespace. Run it deliberately; it is the cheapest data-pack lint available.
- For tags: `/data get` is no help, but placing the item in a recipe that uses
  the tag is. Confirm cross-mod tags with a second mod installed if the tag
  exists to interoperate.

## References

- [Loader, mappings and version reference tables](../minecraft-project-conventions/references/REFERENCE.md)
- [Fabric documentation — data generation](https://docs.fabricmc.net/)
- [NeoForge documentation — data generation and datapack registries](https://docs.neoforged.net/)
- [Minecraft Wiki — recipe and loot table JSON formats](https://minecraft.wiki/w/Recipe)
