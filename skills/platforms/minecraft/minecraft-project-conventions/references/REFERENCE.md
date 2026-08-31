# Minecraft project reference tables

Everything here is a *shape and a naming aid*, not a guaranteed signature. Class
and method names move between Minecraft versions and mapping sets. Confirm
against the project's own decompiled sources before relying on any single name.

## 1. Mappings translation table

Fabric projects normally use **Yarn**; NeoForge and Forge use **official Mojang
mappings**, usually with **Parchment** added for parameter names. Parchment does
not rename classes or methods; it only fills in parameter names, so a
Mojang-mapped project stays Mojang-mapped.

| Yarn (Fabric) | Mojang official (NeoForge/Forge) |
|---|---|
| `Identifier` | `ResourceLocation` |
| `World` | `Level` |
| `ServerWorld` | `ServerLevel` |
| `ClientWorld` | `ClientLevel` |
| `PlayerEntity` | `Player` |
| `ServerPlayerEntity` | `ServerPlayer` |
| `LivingEntity` | `LivingEntity` |
| `MinecraftClient` | `Minecraft` |
| `MinecraftServer` | `MinecraftServer` |
| `Registries` | `BuiltInRegistries` |
| `RegistryKey` | `ResourceKey` |
| `Text` | `Component` |
| `Item.Settings` | `Item.Properties` |
| `AbstractBlock.Settings` | `BlockBehaviour.Properties` |
| `BlockEntity` | `BlockEntity` |
| `ScreenHandler` | `AbstractContainerMenu` |
| `ScreenHandlerType` | `MenuType` |
| `HandledScreen` | `AbstractContainerScreen` |
| `PropertyDelegate` | `ContainerData` |
| `RenderLayer` | `RenderType` |
| `VertexConsumerProvider` | `MultiBufferSource` |
| `MatrixStack` | `PoseStack` |
| `DrawContext` | `GuiGraphics` |
| `SpawnGroup` | `MobCategory` |
| `EntityAttributes` | `Attributes` |
| `StatusEffect` | `MobEffect` |
| `SoundEvents` | `SoundEvents` |
| `ItemStack` | `ItemStack` |
| `BlockPos` / `Vec3d` | `BlockPos` / `Vec3` |
| `NbtCompound` | `CompoundTag` |
| `PacketByteBuf` | `FriendlyByteBuf` |

Method names differ too, often more subtly than class names (`Block#onUse`
vs `BlockBehaviour#useWithoutItem`, for example, and that pair itself changed
inside 1.20.x). Never translate a method name from memory; find it in the
project's sources.

## 2. gradle.properties keys you will meet

### Fabric (Loom)

```properties
# Fabric — example shape, values vary per project
minecraft_version=1.21.1
yarn_mappings=1.21.1+build.3
loader_version=0.16.5
fabric_version=0.102.0+1.21.1
mod_id=examplemod
mod_version=1.0.0
maven_group=com.example
archives_base_name=examplemod
```

### NeoForge (ModDevGradle or NeoGradle)

```properties
# NeoForge — example shape, values vary per project
minecraft_version=1.21.1
neo_version=21.1.72
neo_version_range=[21.1.0,)
loader_version_range=[4,)
parchment_minecraft_version=1.21.1
parchment_mappings_version=2024.11.17
mod_id=examplemod
mod_version=1.0.0
```

Key names are conventions, not standards. `neo_version` and `neoforge_version`
both appear in the wild. Read what is actually there.

## 3. Project layout

### Fabric

```
src/main/java/…                      common code (runs on both sides)
src/main/resources/fabric.mod.json   metadata, entrypoints, mixin configs
src/main/resources/assets/<id>/      models, textures, lang, sounds
src/main/resources/data/<id>/        recipes, loot tables, tags, worldgen
src/client/java/…                    client-only code (split source sets)
src/client/resources/…               client-only resources
src/main/resources/<id>.mixins.json  mixin configuration
```

`src/client` exists only when the build script calls
`loom { splitEnvironmentSourceSets() }`. When it does, the client source set is
compiled against client classes and is not shipped to the dedicated server
classpath in dev, which turns "client class on server" from a runtime crash into
a compile error. That is the strongest available protection; prefer it.

### NeoForge

```
src/main/java/…                                common + client code, split by package
src/main/resources/META-INF/neoforge.mods.toml metadata (older Forge: mods.toml)
src/main/resources/assets/<id>/                client resources
src/main/resources/data/<id>/                  server data
src/generated/resources/…                      datagen output, added as a resource root
```

NeoForge has no separate client source set. Separation is by package convention
(`…mod.client.…`) plus `Dist` checks, and it is enforced only by discipline and
by running the dedicated server.

## 4. Metadata file shapes

### `fabric.mod.json` (Fabric)

```json
{
  "schemaVersion": 1,
  "id": "examplemod",
  "version": "${version}",
  "entrypoints": {
    "main": ["com.example.ExampleMod"],
    "client": ["com.example.client.ExampleModClient"]
  },
  "mixins": ["examplemod.mixins.json"],
  "depends": { "minecraft": "~1.21.1", "fabricloader": ">=0.16.5" }
}
```

### `META-INF/neoforge.mods.toml` (NeoForge, 1.20.5+)

```toml
modLoader = "javafml"
loaderVersion = "[4,)"
license = "MIT"

[[mods]]
modId = "examplemod"
version = "${mod_version}"

[[dependencies.examplemod]]
modId = "neoforge"
type = "required"
versionRange = "[21.1.0,)"
ordering = "NONE"
side = "BOTH"
```

Older Forge and pre-1.20.5 NeoForge use `META-INF/mods.toml` with
`mandatory = true` instead of `type = "required"`. The file name alone tells you
roughly which era you are in.

## 5. Version change timeline that breaks pasted code

Confirm each of these against release notes for your exact version. They are
listed because they are the changes most likely to make an older snippet fail.

| Version | Change | Consequence for pasted code |
|---|---|---|
| 1.20 | `GuiGraphics`/`DrawContext` replaced direct `PoseStack` drawing calls | Every GUI drawing snippet older than 1.20 fails to compile |
| 1.20.2 | Networking and configuration phase reworked in vanilla | Old channel-based packet code no longer matches |
| 1.20.5 | Data components replaced item NBT | `getOrCreateTag()`-style code is gone; use component types |
| 1.20.5 | NeoForge metadata moved to `neoforge.mods.toml` | Metadata in the wrong file means the mod does not load |
| 1.20.5 | Custom payload networking (`CustomPacketPayload`) became the vanilla model | Both loaders' packet APIs changed shape |
| 1.21 | Data pack directories singularised (`recipe`, `loot_table`, `tags/item`, `advancement`) | Hand-written JSON in the old paths is silently ignored |
| 1.21 | `Identifier`/`ResourceLocation` construction moved to factory methods | `new Identifier("mod","path")` no longer compiles |
| 1.21.2 | Item and block properties gained a required id/registry key | Registration without it fails at startup |
| 1.21.2 | Recipe JSON shape changed (result object, ingredient lists) | Old recipe JSON fails to parse |
| 1.21.4 | Item model definitions moved to `assets/<ns>/items/` | Item models placed only in `models/item/` may not resolve |
| 1.21.5+ | Large renderer refactors continued through the 1.21 line | Rendering snippets are the least portable code of all |

The pattern is stable even when the details are not: **registration,
networking, data generation and rendering are the four areas that keep
changing**. Treat any snippet touching them as version-suspect until proven
otherwise by a successful compile.

## 6. Useful commands

```bash
./gradlew build                 # compile + jar; the primary correctness check
./gradlew runClient             # launch a dev client
./gradlew runServer             # launch a dedicated server (catches client leaks)
./gradlew runDatagen            # Fabric data generation
./gradlew runData               # NeoForge data generation
./gradlew runGameTestServer     # game tests, where configured
./gradlew tasks --all           # discover what this project actually defines
./gradlew dependencies          # resolve and inspect the mapped dependency tree
./gradlew --refresh-dependencies build   # after a version bump
```

Deleting `.gradle/` and `build/` and re-running is the standard fix for
"impossible" mapping or remap errors after a version bump.
