---
name: minecraft-entities-mobs
description: Adding entities and mobs to a Minecraft mod on Fabric or NeoForge. Covers EntityType registration and dimensions, attribute registration, goal-based and brain-based AI, natural spawn rules and spawn eggs, entity data synchronisation to clients, and the client-side renderer and model layer split. Use when adding a mob, projectile or vehicle, or when an entity is invisible, immediately dies, never spawns, or crashes the dedicated server.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: minecraft
  uad-domain: gamedev
  uad-version: "1.0.0"
  uad-requires: "gameplay-systems, game-architecture"
  uad-tags: "entity, mob, ai, goals, brain, attributes, spawn egg, renderer, entity data, spawn rules"
  uad-maturity: stable
---

# Minecraft Entities and Mobs

## Purpose

An entity is the most split-brained thing a mod can add. Its `EntityType` and
logic are common code; its renderer, model and layer definition are client-only;
its attributes are registered through a loader-specific hook; its natural
spawning is a separate registration again; and any state the client needs to
draw must be explicitly synchronised. Each of those is a different failure when
omitted — invisible entity, instant death, never spawns, dedicated server crash.
This skill lays out all of them, per loader, and where the client/server line
runs.

## When to use

- Adding a mob, an animal, a boss, a projectile, a thrown item or a vehicle.
- The entity spawns but is invisible, or renders as a white box or a shadow.
- The entity spawns and dies immediately, or has zero health.
- The entity never spawns naturally despite spawn rules being present.
- The dedicated server crashes at load with an error naming a renderer or model.
- Client and server disagree about an entity's state — an animation that never
  plays, a flag the client cannot see.

## When NOT to use

- The loader, version and mappings are unresolved. Run
  `minecraft-project-conventions` first.
- The work is purely visual — a custom model format, animation, or a render
  layer question. Use `minecraft-rendering-particles`.
- Where the mob is allowed to exist by biome. Biome-side spawn additions are in
  `minecraft-worldgen`; this skill covers the entity's own spawn predicate.
- Syncing arbitrary gameplay state to a client outside the entity data system.
  That is `minecraft-networking`.

## Required context

Nothing here may be written before all three are read from the project.
**`gradle.properties` answers all three; open it first.**

| Fact | Where | Why it decides the code |
|---|---|---|
| Loader | `gradle.properties`, `fabric.mod.json`, `META-INF/neoforge.mods.toml` | Attribute registration, renderer registration and spawn placement hooks are entirely different APIs. |
| Minecraft version | `gradle.properties` (`minecraft_version`) | Entity rendering was refactored around a render-state object in the 1.21.2 window; spawn-rule registration moved across the 1.20 line. |
| Mappings | `gradle.properties` or `officialMojangMappings()` | `SpawnGroup` vs `MobCategory`, `EntityAttributes` vs `Attributes`, `PlayerEntity` vs `Player`. |
| Mod id | `gradle.properties` (`mod_id`) | Namespace for the entity type, texture, model and lang key. |
| Whether split source sets are on | `splitEnvironmentSourceSets()` in `build.gradle` | On Fabric, decides whether the renderer *must* live in `src/client/java`. |

## Version constraints

Every signature below is a shape from the 1.21.x line. **Confirm names against
the project's own sources before use.** Entity rendering in particular changed
substantially inside 1.21 and any snippet older than your target is suspect.

- **Entity render states.** Around **1.21.2** entity renderers were restructured
  so that the renderer extracts a mutable *render state* object on the client
  each frame instead of reading the entity directly in `render`. A renderer
  written for 1.20.x or 1.21.1 will not compile against a version that has this,
  and vice versa. Check whether `EntityRenderState` (or equivalent) exists in
  your version before choosing the renderer shape.
- **Attributes** are registered through `FabricDefaultAttributeRegistry` on
  Fabric and through `EntityAttributeCreationEvent` on the NeoForge mod bus.
  Without it, a `LivingEntity` subclass crashes or spawns with no health.
- **Spawn placement** (`SpawnPlacements` / `SpawnRestriction`) registration moved
  between direct static calls and a loader event across the 1.20–1.21 window.
  On recent NeoForge it is `RegisterSpawnPlacementsEvent`; on Fabric it is a
  direct `SpawnRestriction.register` call from the initialiser. Verify.
- **`EntityType.Builder`** gained and lost convenience methods repeatedly. The
  stable parts are the factory, the `MobCategory`/`SpawnGroup`, and
  `sized(width, height)` / `dimensions(...)`.
- Tracked entity data (`DataTracker` / `SynchedEntityData`) has kept its shape,
  but the `defineSynchedData` / `initDataTracker` override gained a builder
  parameter in the 1.20.5 window.

## Workflow

1. **Resolve and state the triple.** Label every file.
2. **Register the `EntityType`** in a `ModEntities` holder, with the correct
   `MobCategory`/`SpawnGroup` and accurate dimensions. Dimensions decide the
   hitbox and suffocation checks; guessing here causes mobs stuck in blocks.
3. **Write the entity class** in common code. Extend the nearest vanilla base
   (`PathfinderMob`/`PathAwareEntity`, `Animal`, `Monster`, `Projectile`).
4. **Register attributes.** A `LivingEntity` without registered attributes is a
   crash or a zero-health entity, not a warning.
5. **Add AI.** Goals for most mobs; a brain only if you are modelling something
   villager- or piglin-shaped. Goal priorities are ascending: lower number wins.
6. **Add tracked data** for anything the client must draw that it cannot infer.
7. **Add spawning** — spawn egg item, spawn placement rules, and the biome-side
   spawn entry (see `minecraft-worldgen`). All three are separate.
8. **Register the renderer and model layer on the client only.**
9. **Run `runServer` before `runClient`.** The server run is what proves the
   renderer did not leak into common code.

### Entity type registration — Fabric, MC 1.21.x, Yarn mappings

```java
// Fabric — MC 1.21.x, Yarn mappings. Confirm EntityType.Builder methods
// against your Yarn build; this builder's API moves between versions.
public final class ModEntities {
    public static final EntityType<RubyGolemEntity> RUBY_GOLEM = Registry.register(
            Registries.ENTITY_TYPE,
            ExampleMod.id("ruby_golem"),
            EntityType.Builder.create(RubyGolemEntity::new, SpawnGroup.CREATURE)
                    .dimensions(0.9f, 1.9f)
                    .build(/* version-dependent argument: check your sources */));

    public static void register() { /* touched from onInitialize */ }
}
```

Attributes, from `onInitialize`:

```java
// Fabric — MC 1.21.x, Yarn mappings. Requires the Fabric API entity module.
FabricDefaultAttributeRegistry.register(ModEntities.RUBY_GOLEM, RubyGolemEntity.createAttributes());
```

### Entity type registration — NeoForge, MC 1.21.x, Mojang mappings

```java
// NeoForge — MC 1.21.x, Mojang mappings.
public final class ModEntities {
    public static final DeferredRegister<EntityType<?>> ENTITIES =
            DeferredRegister.create(BuiltInRegistries.ENTITY_TYPE, ExampleMod.MOD_ID);

    public static final Supplier<EntityType<RubyGolem>> RUBY_GOLEM = ENTITIES.register(
            "ruby_golem",
            () -> EntityType.Builder.of(RubyGolem::new, MobCategory.CREATURE)
                    .sized(0.9f, 1.9f)
                    .build(/* version-dependent argument: check your sources */));
}
```

Attributes, on the **mod** event bus:

```java
// NeoForge — MC 1.21.x, Mojang mappings. Mod bus, not the game bus.
@SubscribeEvent
public static void attributes(EntityAttributeCreationEvent event) {
    event.put(ModEntities.RUBY_GOLEM.get(), RubyGolem.createAttributes().build());
}
```

### AI — goals, MC 1.21.x, both loaders

Goals are registered in `registerGoals` (Mojang) / `initGoals` (Yarn) with an
integer priority; **lower numbers run first and can block higher ones**. Keep
survival goals (float, panic, avoid) at low numbers and idle behaviour (look
around, wander) at high numbers, exactly as vanilla mobs do. Target selection
uses a separate goal selector; mixing target goals into the main selector is a
common cause of a mob that never attacks.

Brains (`Brain`, activities, memory modules, sensors) are a much larger
commitment and only pay off for mobs with distinct scheduled behaviours. Do not
convert a working goal mob to a brain mob for style.

### Client-side renderer — Fabric, MC 1.21.x, Yarn mappings

```java
// Fabric — MC 1.21.x, Yarn mappings. src/client/java only, called from
// ClientModInitializer#onInitializeClient. Never referenced from common code.
EntityModelLayerRegistry.registerModelLayer(RubyGolemModel.LAYER, RubyGolemModel::getTexturedModelData);
EntityRendererRegistry.register(ModEntities.RUBY_GOLEM, RubyGolemRenderer::new);
```

### Client-side renderer — NeoForge, MC 1.21.x, Mojang mappings

```java
// NeoForge — MC 1.21.x, Mojang mappings. Mod bus, in a client-only class
// registered behind a Dist check or an @EventBusSubscriber value = Dist.CLIENT.
@SubscribeEvent
public static void layers(EntityRenderersEvent.RegisterLayerDefinitions event) {
    event.registerLayerDefinition(RubyGolemModel.LAYER, RubyGolemModel::createBodyLayer);
}

@SubscribeEvent
public static void renderers(EntityRenderersEvent.RegisterRenderers event) {
    event.registerEntityRenderer(ModEntities.RUBY_GOLEM.get(), RubyGolemRenderer::new);
}
```

## Best practices

- **Extend the closest vanilla mob and delete what you do not want.** Vanilla
  bases already handle pathfinding, breeding, despawning and persistence
  correctly; a from-scratch `Mob` subclass reimplements all of it badly.
- **Set dimensions from the model, not from taste.** A hitbox larger than the
  visual makes the mob unhittable-looking; smaller makes it suffocate.
- **Synchronise only what the client needs to draw.** Tracked data costs a
  packet per change per viewer. State the server alone uses belongs in NBT.
- **Save what must survive a reload** in the entity's NBT read/write overrides,
  and always call `super`. Tracked data is *not* persistence.
- **Give the mob a spawn egg** even for a mob meant to spawn naturally. It is the
  only cheap way to test it.
- **Keep the renderer and model in a client package** and reach them only from
  the client entrypoint. On Fabric with split source sets the compiler enforces
  this; on NeoForge only `runServer` does.
- **Log spawn attempts while tuning** rather than flying around waiting. Natural
  spawning has many gates and silence tells you nothing about which one failed.

## Common mistakes

- **Forgetting attribute registration.** The mob crashes on spawn, or exists
  with no max health and dies instantly. Every `LivingEntity` subclass needs it,
  through the loader's own hook.
- **Referencing the renderer from common code.** It runs in `runClient` and
  kills the dedicated server with `NoClassDefFoundError` naming a client class,
  usually the moment the first player connects.
- **Assuming registration makes it spawn.** Natural spawning needs an
  `EntityType` in the right `MobCategory`, a spawn placement rule, a biome that
  lists the entity, and a location that passes the check. Missing any one gives
  silence.
- **Goal priority collisions.** Two goals at the same priority that both claim
  the MOVE control produce a mob that twitches or stands still. Read the
  priorities of the vanilla mob you copied from.
- **Putting target goals in the movement goal selector.** The mob wanders
  contentedly and never attacks anything.
- **Reading tracked data on the wrong side.** The server sets it; the client
  reads it. Setting tracked data from client code changes nothing anyone else
  sees and is silently discarded.
- **Not calling `super` in the NBT read/write overrides.** Position, health and
  UUID stop persisting, and the bug looks like a teleporting or resetting mob.
- **Copying a 1.20.x renderer into a 1.21.2+ project** (or the reverse). The
  render-state refactor makes them mutually incompatible; the compile error will
  name a method you did not write.

## Validation

- `gradlew build` compiles.
- `gradlew runServer` reaches `Done (…s)!` and a client can connect and stay
  connected with the entity spawned. This is the client-leak check.
- `gradlew runClient`, then:
  - `/summon <mod_id>:ruby_golem ~ ~ ~` produces a visible, correctly sized,
    correctly textured entity that survives more than one tick.
  - `F3+B` shows the hitbox matching the model.
  - The entity's name renders as text, not `entity.<mod_id>.<path>`.
  - `/data get entity @e[type=<mod_id>:ruby_golem,limit=1]` shows the NBT you
    expect, including anything you wrote in the save override.
- Reload the world and confirm the entity is still there with its state intact.
- For natural spawning, `/gamerule doMobSpawning true` in a fresh world with the
  right biome, then confirm with
  `/execute as @e[type=<mod_id>:ruby_golem] run say found` after some time.

## References

- [Loader, mappings and version reference tables](../minecraft-project-conventions/references/REFERENCE.md)
- [Fabric documentation — entities and rendering](https://docs.fabricmc.net/)
- [NeoForge documentation — entities, attributes and renderers](https://docs.neoforged.net/)
