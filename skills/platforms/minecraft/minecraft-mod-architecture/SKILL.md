---
name: minecraft-mod-architecture
description: How a Minecraft mod is structured on Fabric and on NeoForge. Covers entrypoints, the registration architecture and its timing rules, deferred and lazy registration, the hard separation between common and client code that keeps dedicated servers alive, package structure and mod id discipline. Use when creating a mod skeleton, adding a new registry, or diagnosing a crash that happens at mod load or only on a dedicated server.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: minecraft
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "software-architecture, game-architecture, api-design"
  uad-tags: "entrypoint, registration, deferredregister, modinitializer, dist, sides, mod id"
  uad-maturity: stable
---

# Minecraft Mod Architecture

## Purpose

Everything a mod adds must be *registered*, at the right time, on the right
side, through the loader's own mechanism. Get the timing wrong and the registry
is frozen and throws; get the side wrong and the dedicated server dies with
`NoClassDefFoundError` on a class that only exists on the client. This skill
gives the structural rules that make both classes of failure impossible by
construction, on each loader separately.

## When to use

- Setting up a new mod, or adding the first block, item, entity or block entity
  and needing somewhere for it to live.
- A crash occurs during mod loading, or the game logs "registry is frozen",
  "Registry object not present", or a null static field at startup.
- The dev client runs but `runServer` crashes, or players report the server
  crashing while the single-player world is fine.
- Deciding where a class belongs when it touches both game logic and rendering.

## When NOT to use

- The loader, version and mappings are not yet resolved. Run
  `minecraft-project-conventions` first; this skill assumes the triple is known.
- The question is about a specific content type's own API surface. Use
  `minecraft-blocks-items`, `minecraft-entities-mobs` or `minecraft-gui-screens`
  for those; this skill covers only where they plug in and when.
- Cross-loader abstraction of a mod that must ship on both. That is
  `minecraft-loader-portability`.

## Required context

- **Loader** (Fabric or NeoForge), **Minecraft version**, **mappings** — all
  three from `gradle.properties`, cross-checked against `fabric.mod.json` or
  `META-INF/neoforge.mods.toml`. Registration has a different shape on each
  loader and changed inside the 1.21 line.
- **Mod id**, from `gradle.properties` (`mod_id`) and the metadata file. It is
  the namespace for every resource location; it must match everywhere.
- **Whether Fabric split source sets are enabled** — look for
  `splitEnvironmentSourceSets()` in `build.gradle`. If yes, `src/client/java`
  exists and is the only correct home for client code.
- **Which entrypoints already exist**, from `fabric.mod.json` `entrypoints`, or
  the `@Mod` class on NeoForge.

## Version constraints

Examples below are labelled with loader and version family. Registration is one
of the fastest-moving parts of the platform, so verify names against the
project's sources before use.

- Fabric registers by calling the registry directly from a `ModInitializer`, and
  has done so consistently across 1.20 and 1.21, but the `Identifier` factory
  changed in 1.21 (`Identifier.of("mod", "path")` rather than a public
  constructor).
- NeoForge registers through `DeferredRegister`, which fires during mod loading.
  Convenience subclasses (`DeferredRegister.Items`, `DeferredRegister.Blocks`)
  and the `DeferredItem`/`DeferredBlock` holder types arrived in the 1.20.6 to
  1.21 window; older projects use plain `DeferredRegister` and `RegistryObject`
  or `DeferredHolder`.
- From 1.21.2, item and block property builders require the registry key/id to
  be set on the properties object at construction. Registration helpers on both
  loaders were adjusted for this; a pre-1.21.2 snippet will fail at startup.
- Registries are **frozen** after mod loading completes on every modern version.
  Anything registered later throws. This rule has not changed and will not.

## Workflow

1. **Confirm the triple** and state it in a comment at the top of every file you
   create.
2. **Create or locate the entrypoint** for the loader (see below). There should
   be exactly one common entrypoint and at most one client entrypoint.
3. **Create one registry-holder class per registry kind** — `ModItems`,
   `ModBlocks`, `ModEntities`, `ModBlockEntities`, `ModMenus`. Each holds only
   registration; no behaviour.
4. **Wire the holders into the entrypoint** in a deterministic order. Blocks
   before block items; entity types before renderers; anything a recipe or loot
   table references before the thing that references it.
5. **Decide the side for every new class** before writing it. If it imports a
   client class, it is client code and lives in the client source set or client
   package, and is reached only from a client entrypoint or a guarded call.
6. **Run `gradlew runServer`.** This is the step people skip and it is the only
   cheap way to prove no client class leaked into common code.
7. **Run `gradlew runClient`** and confirm the content appears in game.

## Loader entrypoints

### Fabric — MC 1.21.x, Yarn mappings

```java
// Fabric — MC 1.21.x, Yarn mappings. Verify names against your Yarn build.
public class ExampleMod implements ModInitializer {
    public static final String MOD_ID = "examplemod";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    public static Identifier id(String path) {
        return Identifier.of(MOD_ID, path); // 1.21+; earlier used the constructor
    }

    @Override
    public void onInitialize() {
        ModItems.register();     // static registry calls, ordered deliberately
        ModBlocks.register();
        ModBlockEntities.register();
    }
}
```

```java
// Fabric — MC 1.21.x, Yarn mappings. Lives in src/client/java when split
// source sets are enabled. Declared under "entrypoints": { "client": [...] }.
public class ExampleModClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        // renderers, screens, key bindings, model layers
    }
}
```

Entrypoints are declared in `fabric.mod.json`, not discovered. A class that
implements `ModInitializer` but is not listed there simply never runs, with no
error message. That is the single most common "my mod does nothing" cause.

### NeoForge — MC 1.21.x, Mojang mappings

```java
// NeoForge — MC 1.21.x, Mojang mappings. Constructor injection of the mod bus
// is the 1.20.4+ shape; confirm the parameter list your NeoForge version wants.
@Mod(ExampleMod.MOD_ID)
public class ExampleMod {
    public static final String MOD_ID = "examplemod";

    public ExampleMod(IEventBus modBus, ModContainer container) {
        ModItems.REGISTER.register(modBus);
        ModBlocks.REGISTER.register(modBus);
        modBus.addListener(this::commonSetup);
        // Game-bus (runtime) listeners go on NeoForge.EVENT_BUS instead.
    }

    private void commonSetup(FMLCommonSetupEvent event) {
        event.enqueueWork(() -> { /* thread-unsafe one-time setup */ });
    }
}
```

The **mod event bus** carries loading-time events (registration, setup, creative
tab contents, payload registration). The **game event bus**
(`NeoForge.EVENT_BUS`) carries runtime events (ticks, player actions, command
registration). Putting a listener on the wrong bus means it silently never
fires. See `minecraft-commands-events`.

## Registration architecture

### Fabric — MC 1.21.x, Yarn mappings

```java
// Fabric — MC 1.21.x, Yarn mappings.
public final class ModItems {
    public static final Item RUBY = register("ruby", new Item(new Item.Settings()));

    private static Item register(String path, Item item) {
        return Registry.register(Registries.ITEM, ExampleMod.id(path), item);
    }

    public static void register() { /* forces class init from onInitialize */ }
}
```

Fabric registration is immediate: the static initialiser runs when the class is
first touched, so the holder must be touched from `onInitialize` and nowhere
earlier. From 1.21.2 the settings object also needs the registry key; check
whether your version's `Item.Settings` requires it.

### NeoForge — MC 1.21.x, Mojang mappings

```java
// NeoForge — MC 1.21.x, Mojang mappings.
public final class ModItems {
    public static final DeferredRegister.Items REGISTER =
            DeferredRegister.createItems(ExampleMod.MOD_ID);

    public static final DeferredItem<Item> RUBY =
            REGISTER.registerSimpleItem("ruby", new Item.Properties());
}
```

`DeferredRegister` defers construction until the registry event fires, which is
why NeoForge holders are safe to reference from static context. The value is a
*holder*: call `.get()` to obtain the object, and never call `.get()` during
class initialisation.

## Best practices

- **One namespace, everywhere.** `mod_id` in Gradle, `"id"` in metadata,
  `assets/<mod_id>/`, `data/<mod_id>/`, and every resource location. A mismatch
  produces missing textures and unresolvable recipes with no crash to point at.
- **Registration classes contain registration only.** Behaviour goes in the
  block/item/entity class. This keeps load order comprehensible and makes the
  frozen-registry rule easy to respect.
- **Sides are a package boundary, not a comment.** `com.example.mod.client` for
  client code; nothing outside it may import it. On Fabric, prefer split source
  sets so the compiler enforces this instead of a code reviewer.
- **Prefer a helper for resource locations** (`ExampleMod.id("ruby")`) over
  literal namespace strings. Typos in namespaces are invisible until content
  goes missing.
- **Log the mod id and version at startup.** It takes one line and turns "which
  build is this crash from" into a fact.
- **Keep the entrypoint boring.** It wires things together; it holds no logic.
  A branching entrypoint is very hard to reason about at load time.

## Common mistakes

- **A client class referenced from common code.** `Minecraft`/`MinecraftClient`,
  `Screen`, any renderer, any `RenderType`. It runs perfectly in the dev client
  and kills the dedicated server on first class load. Move it behind the client
  entrypoint, or on NeoForge behind an explicit dist check, and prove it with
  `runServer`.
- **Registering after mod loading.** Calling `Registry.register` from a tick
  handler or a command throws because the registry is frozen. All registration
  belongs in the load phase.
- **Static fields initialised from a registry too early.** On Fabric a static
  `Item` field in a class touched before `onInitialize` registers into a
  half-built world; on NeoForge a static `.get()` at class-init time throws
  because the object does not exist yet. Hold the holder, resolve late.
- **Forgetting to list the entrypoint in `fabric.mod.json`.** No error, no
  content, hours lost. Check the metadata file whenever a mod "does nothing".
- **Putting a mod-bus listener on the game bus, or vice versa, on NeoForge.**
  Registration events never fire; content never appears. Match the bus to the
  event's phase.
- **Reusing another mod's namespace** to "override" its content. It does not
  override, it collides, and the failure lands on the user in a modpack.

## Validation

- `gradlew build` compiles. Mapping and side errors surface here first.
- `gradlew runServer` reaches `Done (…s)!` and stays up through a
  `/reload`. Any `NoClassDefFoundError` naming a client class is a side leak.
- `gradlew runClient`, then `/give @s <mod_id>:<item>` and
  `/setblock ~ ~ ~ <mod_id>:<block>` succeed. Failure means registration did not
  run or the namespace is wrong.
- The log contains no `Missing registry entry`, `Unregistered object` or
  `registry is frozen` lines.
- `F3` in game shows your block's state with the expected namespace when looked
  at, confirming the resource location matches the id you intended.

## References

- [Loader, mappings and version reference tables](../minecraft-project-conventions/references/REFERENCE.md)
- [Fabric documentation — entrypoints and registries](https://docs.fabricmc.net/)
- [NeoForge documentation — registries and the mod lifecycle](https://docs.neoforged.net/)
