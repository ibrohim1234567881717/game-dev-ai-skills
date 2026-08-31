---
name: minecraft-blocks-items
description: Adding blocks and items to a Minecraft mod on Fabric or NeoForge. Covers registration order, block state properties, block entities and their ticking, item data components and properties, creative tab insertion, the blockstate/model/texture JSON chain, and translation keys. Use when adding or debugging a block, an item, a block entity, a missing texture, a purple-and-black model or an item that will not appear in the creative menu.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: minecraft
  uad-domain: gamedev
  uad-version: "1.0.0"
  uad-requires: "gameplay-systems, game-architecture"
  uad-tags: "block, item, blockstate, block entity, model, creative tab, data components, lang, textures"
  uad-maturity: stable
---

# Minecraft Blocks and Items

## Purpose

Blocks and items are the first thing every mod adds and the first place the
loader/version/mappings triple bites. A block is not one object: it is a
registered `Block`, usually a registered `BlockItem`, a blockstate JSON, one or
more model JSONs, textures, a translation key, a creative tab insertion, and
often loot and recipe data. Miss any link in that chain and you get silent
failure — an invisible block, a purple-and-black model, or an item that exists
but cannot be obtained. This skill covers the whole chain on each loader
separately.

## When to use

- Adding a block, an item, a block with a block entity, or a block with states.
- A block or item is registered but does not appear in the creative menu.
- The model renders as the missing-texture checkerboard, or the item shows as a
  purple-and-black square in the hand.
- The name shows as `block.examplemod.ruby_block` instead of "Ruby Block".
- Migrating item NBT code to data components after a 1.20.5+ version bump.
- A block entity does not save its contents across a world reload.

## When NOT to use

- The loader, Minecraft version and mappings are unresolved. Run
  `minecraft-project-conventions` first.
- The question is *where* registration classes live and when they run. That is
  `minecraft-mod-architecture`.
- The block opens a GUI — the menu and screen half is `minecraft-gui-screens`.
- Custom block rendering beyond the JSON model system (block entity renderers,
  render layers, animated models) is `minecraft-rendering-particles`.
- Generating the recipe, loot table and tag JSON is `minecraft-recipes-datagen`.

## Required context

Nothing below may be written until all three of these are read out of the
project. **`gradle.properties` answers all three and is the first file to open.**

| Fact | Where | Why it decides the code |
|---|---|---|
| Loader | `gradle.properties`, `fabric.mod.json`, `META-INF/neoforge.mods.toml` | Fabric registers directly; NeoForge uses `DeferredRegister`. No shared API. |
| Minecraft version | `gradle.properties` (`minecraft_version`) | Item NBT became data components in 1.20.5; properties gained a required registry key in 1.21.2; item model definitions moved in 1.21.4. |
| Mappings | `gradle.properties` (`yarn_mappings`, `parchment_mappings_version`) or `officialMojangMappings()` | `Item.Settings` vs `Item.Properties`, `Identifier` vs `ResourceLocation`. |
| Mod id | `gradle.properties` (`mod_id`) | The namespace for every resource location and every asset path. |
| Existing registry holders | `ModItems`, `ModBlocks` classes already in the source tree | New content joins the existing pattern; do not invent a second one. |

## Version constraints

Signatures below are shapes taken from the 1.21.x line. **Confirm every name
against the project's own decompiled sources and mapping files before
committing.** Blocks and items are one of the fastest-moving API areas.

- **1.20.5** replaced item NBT with **data components**. Any code calling
  `getOrCreateTag()` or `getTag()` on an `ItemStack` predates this and will not
  compile. Custom per-stack data is now a registered `DataComponentType`.
- **1.21** moved resource-location construction to factories:
  `Identifier.of(ns, path)` / `ResourceLocation.fromNamespaceAndPath(ns, path)`.
  `new Identifier("mod", "path")` no longer compiles.
- **1.21.2** made the registry key part of item and block properties. Both
  loaders adjusted their helpers; a pre-1.21.2 registration snippet fails at
  startup with a message about a missing id on the properties object.
- **1.21.4** moved item model definitions to `assets/<ns>/items/<name>.json`,
  which point at a model rather than being one. Items whose model lives only in
  `models/item/` may not resolve on 1.21.4+.
- Block **render layer** declaration (cutout, translucent) has moved between a
  client-side registration call and a data-driven declaration across the 1.21
  line. Check what your version does before writing either.

## Workflow

1. **Resolve and state the triple.** Every file you create opens with a comment
   naming loader and version, e.g. `// NeoForge — MC 1.21.1, Mojang mappings`.
2. **Register the block first, then its `BlockItem`.** The item needs the block
   instance, so ordering is not cosmetic. Put both in the existing holder
   classes.
3. **Add block state properties** only if the block genuinely has variants.
   Every property multiplies the blockstate JSON; a four-property block has
   sixteen or more variants to model.
4. **Add the block entity** if the block stores data. Register the
   `BlockEntityType` against the block, and implement load/save.
5. **Insert into a creative tab** through the loader's own hook. Registration
   alone never puts an item in the menu.
6. **Create the resources**: blockstate JSON, block model, item model, texture,
   and the `en_us.json` entries. Prefer generating them
   (`minecraft-recipes-datagen`) over writing them by hand.
7. **Run `gradlew runClient`** and verify with `/setblock` and `/give`.
8. **Run `gradlew runServer`** to prove nothing client-only leaked in.

### Registration — Fabric, MC 1.21.x, Yarn mappings

```java
// Fabric — MC 1.21.x, Yarn mappings. Verify names against your Yarn build.
public final class ModBlocks {
    public static final Block RUBY_BLOCK = register("ruby_block",
            new Block(AbstractBlock.Settings.create()
                    .strength(3.0f, 6.0f)
                    .requiresTool()
                    .sounds(BlockSoundGroup.METAL)));

    private static Block register(String path, Block block) {
        Identifier id = ExampleMod.id(path);
        // On 1.21.2+ the settings object also needs the registry key; check
        // whether AbstractBlock.Settings in your version requires .registryKey().
        Registry.register(Registries.ITEM, id, new BlockItem(block, new Item.Settings()));
        return Registry.register(Registries.BLOCK, id, block);
    }

    public static void register() { /* touched from onInitialize */ }
}
```

### Registration — NeoForge, MC 1.21.x, Mojang mappings

```java
// NeoForge — MC 1.21.x, Mojang mappings. Confirm the DeferredRegister helper
// names against the NeoForge version in gradle.properties.
public final class ModBlocks {
    public static final DeferredRegister.Blocks BLOCKS =
            DeferredRegister.createBlocks(ExampleMod.MOD_ID);

    public static final DeferredBlock<Block> RUBY_BLOCK = BLOCKS.registerSimpleBlock(
            "ruby_block",
            BlockBehaviour.Properties.of()
                    .strength(3.0f, 6.0f)
                    .requiresCorrectToolForDrops()
                    .sound(SoundType.METAL));
}
```

The matching `BlockItem` is registered from `ModItems` with
`ITEMS.registerSimpleBlockItem(ModBlocks.RUBY_BLOCK)`. `DeferredBlock` is a
*holder*: call `.get()` at runtime, never during class initialisation.

### Block state properties — both loaders, MC 1.21.x

Declare the property as a `static final`, add it in `appendProperties`
(Yarn) / `createBlockStateDefinition` (Mojang), and set the default in the
constructor. The set of properties must be identical between those two places
or the game throws while building the state definition.

```java
// Fabric — MC 1.21.x, Yarn mappings.
public static final BooleanProperty LIT = Properties.LIT;

@Override
protected void appendProperties(StateManager.Builder<Block, BlockState> builder) {
    builder.add(LIT);
}
```

```java
// NeoForge — MC 1.21.x, Mojang mappings.
public static final BooleanProperty LIT = BlockStateProperties.LIT;

@Override
protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
    builder.add(LIT);
}
```

### Block entities — MC 1.21.x, both loaders

`BlockEntityType.Builder.create(...)` (Yarn) / `.of(...)` (Mojang) binds the
constructor to the set of valid blocks. Register the type after the block. On
1.20.5+ the load/save methods take a registry lookup provider alongside the
NBT compound because component-bearing contents need registry access; confirm
the exact parameter list in your version's sources rather than copying an older
override.

### Creative tabs

```java
// Fabric — MC 1.21.x, Yarn mappings. Requires the Fabric API item-groups module.
ItemGroupEvents.modifyEntriesEvent(ItemGroups.BUILDING_BLOCKS)
        .register(entries -> entries.add(ModBlocks.RUBY_BLOCK));
```

```java
// NeoForge — MC 1.21.x, Mojang mappings. Mod event bus listener.
@SubscribeEvent
public static void addCreative(BuildCreativeModeTabContentsEvent event) {
    if (event.getTabKey() == CreativeModeTabs.BUILDING_BLOCKS) {
        event.accept(ModBlocks.RUBY_BLOCK);
    }
}
```

### Resources — same shape on both loaders

`assets/<mod_id>/blockstates/ruby_block.json` maps each state to a model:

```json
{ "variants": { "": { "model": "examplemod:block/ruby_block" } } }
```

`assets/<mod_id>/models/block/ruby_block.json` inherits a vanilla parent and
names textures; `assets/<mod_id>/models/item/ruby_block.json` normally just
parents the block model. Textures go in `assets/<mod_id>/textures/block/`.
Translations go in `assets/<mod_id>/lang/en_us.json` under
`"block.examplemod.ruby_block"` and `"item.examplemod.ruby"`.

## Best practices

- **Generate resources, do not hand-write them.** Datagen emits the schema the
  target version wants; hand-written JSON silently rots across version bumps.
- **One holder class per registry**, referenced from the entrypoint. Blocks
  before block items, block entities after blocks.
- **Use vanilla property constants** (`Properties.LIT`, `BlockStateProperties.LIT`)
  rather than declaring your own equivalents. Vanilla code and other mods
  already understand them.
- **Copy vanilla settings for a similar block** as the starting point —
  hardness, tool requirement, sound group and map colour are easy to get subtly
  wrong and hard to notice.
- **Register a data component type** for per-stack data rather than reaching for
  anything NBT-shaped. Components are typed, synced and diffed for you.
- **Keep block behaviour in the block class**, registration in the holder. A
  holder that also implements `useWithoutItem` becomes unreadable fast.
- **Name resources after the registry path, exactly.** `ruby_block` everywhere:
  registry path, blockstate file, model file, texture file, lang key suffix.

## Common mistakes

- **Registering the `BlockItem` before the `Block`.** The item constructor needs
  a constructed block; doing it in the wrong order gives a null block reference
  that surfaces much later as a null item in the creative tab.
- **Expecting registration to populate the creative menu.** It does not. Without
  the tab hook the item exists, `/give` works, and the menu stays empty. This is
  the single most reported "my item is missing" cause.
- **Blockstate JSON that does not cover every state combination.** The game logs
  a missing-variant warning and renders the checkerboard. Every combination of
  every declared property needs a variant or a multipart rule.
- **`appendProperties`/`createBlockStateDefinition` disagreeing with the default
  state.** Adding a property but not setting a default, or setting a default for
  a property never added, throws while the block is being built.
- **Calling `DeferredBlock.get()` in a static initialiser** on NeoForge. The
  object does not exist during class init and you get a hard crash at load.
- **Client-only calls inside the block class**, such as a `Minecraft`/
  `MinecraftClient` reference for a particle or sound. It works in `runClient`
  and kills the dedicated server with `NoClassDefFoundError`.
- **Using item NBT on 1.20.5+.** It does not compile. Migrate to a registered
  `DataComponentType` rather than searching for a compatibility shim.
- **Forgetting the lang entry.** The game shows the raw translation key. It is
  not a crash, so it ships.

## Validation

- `gradlew build` compiles. Mapping and version errors surface here first.
- `gradlew runClient`, then in game:
  - `/setblock ~ ~ ~ <mod_id>:ruby_block` places the block, and F3 shows the
    expected namespace and state values when looking at it.
  - `/give @s <mod_id>:ruby_block` yields a correctly named, correctly rendered
    item.
  - The block appears in the creative tab you targeted.
- The client log contains no `Unable to load model`, `Missing model`,
  `Missing variant` or `Failed to load texture` lines mentioning your namespace.
- The block name renders as text, not as `block.<mod_id>.<path>`.
- `gradlew runServer` reaches `Done (…s)!` — proof no client class leaked into
  block or item code.
- Place the block entity, save and reload the world: contents survive. If they
  do not, the save/load override signature is wrong for this version.

## References

- [Loader, mappings and version reference tables](../minecraft-project-conventions/references/REFERENCE.md)
- [Fabric documentation — blocks and items](https://docs.fabricmc.net/)
- [NeoForge documentation — blocks, items and data components](https://docs.neoforged.net/)
- [Minecraft Wiki — model and blockstate JSON formats](https://minecraft.wiki/w/Tutorials/Models)
