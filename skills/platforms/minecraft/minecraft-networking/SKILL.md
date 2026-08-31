---
name: minecraft-networking
description: Custom packets between client and server in a Minecraft mod, on Fabric or NeoForge. Covers the CustomPacketPayload model, payload registration and stream codecs per loader, the threading rule that handlers must schedule work back onto the main thread, and validating every client-sent packet because the client is an attacker. Use when adding a packet, syncing state to clients, handling a GUI button server-side, or diagnosing a ConcurrentModificationException or a client-triggered exploit.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: minecraft
  uad-domain: security
  uad-version: "1.0.0"
  uad-requires: "client-server-trust, threat-modeling, secure-coding"
  uad-tags: "networking, packets, payload, codec, c2s, s2c, threading, validation, exploit, sync"
  uad-maturity: stable
---

# Minecraft Networking

## Purpose

Minecraft is a client-server game even in single player, where an integrated
server runs on its own thread. Any state that matters lives on the server; the
client holds a copy that is only as correct as what you send it. Custom packets
are how a mod moves data across that boundary, and they carry two failure modes
that dwarf everything else: **the client is under the player's control, so any
client-sent packet is attacker-controlled input**, and **packet handlers run on
a network thread, so touching the world from one corrupts it**. This skill
covers the payload model on each loader and the two rules that make it safe.

## When to use

- Adding any packet: a GUI button that must act server-side, a key bind that
  triggers a server action, syncing mod state to clients.
- A GUI button works in single player and does nothing in multiplayer.
- `ConcurrentModificationException`, a corrupt chunk, or a random
  `NullPointerException` deep in vanilla code after adding a packet.
- Reviewing a mod for exploits, or a bug report that a player duplicated items
  or reached blocks they should not.
- Migrating channel-based packet code after a 1.20.2+ or 1.20.5+ version bump.

## When NOT to use

- The loader, version and mappings are unresolved. Run
  `minecraft-project-conventions` first.
- Entity state that the vanilla tracked-data system already syncs. Use it
  instead — see `minecraft-entities-mobs`.
- Container/menu field syncing, which has its own mechanism
  (`ContainerData`/`PropertyDelegate`). See `minecraft-gui-screens`.
- Block entity state that only needs to reach nearby clients on change. The
  block entity update-packet mechanism already exists; do not rebuild it.

## Required context

**`gradle.properties` answers the first three; open it first.**

| Fact | Where | Why it decides the code |
|---|---|---|
| Loader | `gradle.properties`, metadata file | Fabric registers payload types with `PayloadTypeRegistry` and receivers with `ServerPlayNetworking`; NeoForge uses a `RegisterPayloadHandlers` mod-bus event and a registrar. Different classes, different handler signatures. |
| Minecraft version | `gradle.properties` (`minecraft_version`) | Vanilla networking was reworked in 1.20.2 (configuration phase) and again in 1.20.5 (`CustomPacketPayload` + `StreamCodec`). Pre-1.20.5 channel code does not port. |
| Mappings | `gradle.properties` or `officialMojangMappings()` | `PacketByteBuf` vs `FriendlyByteBuf`, `ServerPlayerEntity` vs `ServerPlayer`. |
| Mod id | `gradle.properties` (`mod_id`) | Payload channel ids are namespaced; a collision with another mod is a hard failure. |
| Which side sends | the feature itself | C2S packets need validation; S2C packets need the client to tolerate absent or stale data. |

## Version constraints

Shapes below are from the 1.21.x line. **Confirm the registration and handler
signatures against the project's own sources — networking is one of the four
fastest-moving areas of the platform.**

- **1.20.2** introduced the configuration phase and reworked packet flow. Code
  written before it assumes a play-phase-only world.
- **1.20.5** made `CustomPacketPayload` with a typed `Type<T>` and a
  `StreamCodec` the vanilla model. Both loaders adopted it. Anything using
  raw channel `ResourceLocation`s and manual buffer reads predates this.
- **NeoForge** registers payloads on the mod event bus. The event was
  `RegisterPayloadHandlerEvent` and became `RegisterPayloadHandlersEvent` with a
  versioned registrar in the 1.21 window; the registrar exposes
  `playToServer` / `playToClient` style methods. Verify which your version has.
- **Fabric** registers the payload type with `PayloadTypeRegistry.playC2S()` /
  `playS2C()` and the receiver with `ServerPlayNetworking.registerGlobalReceiver`
  / `ClientPlayNetworking.registerGlobalReceiver`. Registering the receiver
  without registering the type is a runtime error.
- **The threading rule has never changed** on any version or loader: the handler
  runs off the main thread and must schedule world access back onto it.

## Workflow

1. **Resolve and state the triple.** Label every file.
2. **Ask whether a custom packet is needed at all.** Tracked entity data,
   container data slots and block entity update packets cover most cases and are
   already correct.
3. **Define the payload** as a record implementing the vanilla payload interface,
   with a `Type` carrying a namespaced id and a `StreamCodec`.
4. **Register the payload type on both sides** and the handler on the receiving
   side only, in the loader's registration phase.
5. **Write the handler as two parts**: a validation section that runs
   immediately and rejects bad input, and a body that is scheduled onto the
   main thread.
6. **Validate every field of every C2S packet** against the sender's actual
   state — see the checklist below.
7. **Test in true multiplayer**: `runServer` plus a separate `runClient`. Single
   player hides both the threading bug and the trust bug because everything is
   local and mostly on the right thread by accident.

### Payload definition — MC 1.21.x, both loaders

The payload record itself is vanilla API and is the same on both loaders; only
registration differs.

```java
// Both loaders — MC 1.21.x, Mojang mappings. Confirm CustomPacketPayload's
// members against your version; the Type/codec shape arrived in 1.20.5.
public record OpenRubyMenuPayload(BlockPos pos) implements CustomPacketPayload {
    public static final CustomPacketPayload.Type<OpenRubyMenuPayload> TYPE =
            new CustomPacketPayload.Type<>(ExampleMod.id("open_ruby_menu"));

    public static final StreamCodec<FriendlyByteBuf, OpenRubyMenuPayload> CODEC =
            StreamCodec.composite(BlockPos.STREAM_CODEC, OpenRubyMenuPayload::pos,
                                  OpenRubyMenuPayload::new);

    @Override
    public CustomPacketPayload.Type<? extends CustomPacketPayload> type() { return TYPE; }
}
```

### Registration and handling — Fabric, MC 1.21.x, Yarn mappings

```java
// Fabric — MC 1.21.x, Yarn mappings. Type registration must happen on BOTH
// sides; the receiver is registered only on the receiving side.
PayloadTypeRegistry.playC2S().register(OpenRubyMenuPayload.TYPE, OpenRubyMenuPayload.CODEC);

ServerPlayNetworking.registerGlobalReceiver(OpenRubyMenuPayload.TYPE, (payload, context) -> {
    ServerPlayerEntity player = context.player();
    BlockPos pos = payload.pos();
    context.server().execute(() -> {          // back on the main thread
        if (!player.getWorld().isChunkLoaded(pos.getX() >> 4, pos.getZ() >> 4)) return;
        if (player.getBlockPos().getSquaredDistance(pos) > 64.0) return;  // reach check
        // ... act on the world here
    });
});
```

### Registration and handling — NeoForge, MC 1.21.x, Mojang mappings

```java
// NeoForge — MC 1.21.x, Mojang mappings. Mod event bus. The event name and the
// registrar's method names changed within the 1.21 line — confirm yours.
@SubscribeEvent
public static void payloads(RegisterPayloadHandlersEvent event) {
    event.registrar("1").playToServer(
            OpenRubyMenuPayload.TYPE,
            OpenRubyMenuPayload.CODEC,
            (payload, context) -> context.enqueueWork(() -> {   // main thread
                if (!(context.player() instanceof ServerPlayer player)) return;
                BlockPos pos = payload.pos();
                if (!player.level().isLoaded(pos)) return;
                if (player.distanceToSqr(Vec3.atCenterOf(pos)) > 64.0) return;
                // ... act on the world here
            }));
}
```

### The threading rule

Handlers are invoked on a **network thread**. The world, entities, block
entities, chunks and the player list are not thread-safe. Reading or writing any
of them from the network thread produces corruption that surfaces later,
somewhere else, as a `ConcurrentModificationException`, a null field in vanilla
code, or a silently lost chunk write. Both loaders give you a scheduler for
exactly this: `server.execute(...)` / `client.execute(...)` on Fabric,
`context.enqueueWork(...)` on NeoForge. Everything that touches the game goes
inside it. Only decoding and cheap validation belongs outside.

### Validating a client-sent packet

The client is running on the player's machine and can send anything, at any
rate, in any order. Treat every C2S payload as hostile input. Before acting:

- **The player is the authority on nothing.** Never accept a player id, an
  inventory index the client resolved, a computed result, a permission level, or
  a "the server already checked this" flag. Recompute server-side.
- **Range-check every number.** Slot indices, counts, enum ordinals, dimensions
  of anything. An out-of-range index is a crash or an out-of-bounds read.
- **Reach-check every position.** A `BlockPos` from the client must be near the
  sending player and in a loaded chunk. Otherwise the packet is a remote
  world-edit primitive.
- **Ownership-check every reference.** The block entity at that position must be
  yours; the container the player claims to have open must be the one the server
  has open for them; the entity must be one they can legitimately interact with.
- **Re-check state, not just shape.** "Player pressed the craft button" must
  re-verify the ingredients server-side, not trust a client-sent recipe result.
- **Bound the size of collections and strings** in the codec. An unbounded list
  is a memory-exhaustion vector.
- **Rate-limit anything expensive.** A client can send a packet every tick, or
  faster.

## Best practices

- **Prefer existing sync mechanisms.** Tracked entity data, `ContainerData` and
  block entity update packets are already correct and already throttled.
- **Send small, send rarely.** Packets are per-player bandwidth. Sync deltas or
  events, not whole state snapshots every tick.
- **Make S2C handlers tolerant.** The client may receive data for something it
  has not loaded, or receive it out of order. Drop it quietly rather than
  throwing on the render thread.
- **Namespace payload ids with the mod id.** A collision with another mod's
  channel is a disconnect for everyone in the pack.
- **Keep the payload a record with a codec** rather than manual buffer reads.
  The codec makes the wire format explicit and symmetric.
- **Put validation in one place per payload** so a reviewer can see all of it at
  once, and so nobody adds a second call path that skips it.
- **Log rejected packets at debug level with the player name.** It turns "a
  player is cheating" from a rumour into a log line.

## Common mistakes

- **Touching the world directly in the handler.** It appears to work — often for
  weeks — then corrupts a chunk or throws deep inside vanilla. Schedule it.
- **Trusting a client-sent value.** The classic is a slot index or an item count
  used unchecked, which becomes an item duplication exploit within a day of the
  mod appearing in a public pack.
- **No reach or chunk check on a client-sent `BlockPos`.** The packet becomes a
  remote block editor with unlimited range.
- **Registering the receiver but not the payload type**, or registering the type
  on only one side. Fabric throws at runtime; the symptom looks like a missing
  packet rather than a registration error.
- **Putting the NeoForge payload registration on the game bus.** It never fires,
  and the failure is silence.
- **Sending an S2C packet to a player who is still in the configuration phase**
  or has already disconnected. Guard the send.
- **Testing only in single player.** The integrated server hides the threading
  bug (the client and server are one process) and hides the trust bug (there is
  no adversary). `runServer` plus an external client is the only real test.
- **Sending a packet every client tick.** Twenty packets per second per player,
  multiplied by a full server, is a measurable bandwidth and CPU cost for
  something that usually changes once a minute.

## Validation

- `gradlew build` compiles.
- `gradlew runServer` in one terminal, `gradlew runClient` in another; connect to
  `localhost`. Every packet feature must be exercised here, not in single
  player.
- The feature works with two clients connected, and one client's action does not
  affect the other's view incorrectly.
- **Adversarial check.** Temporarily modify the client to send a deliberately
  bad payload — an out-of-range slot, a `BlockPos` a thousand blocks away, a
  negative count — and confirm the server rejects it without an exception and
  without effect. Revert the change afterwards. If the server crashes or
  complies, the validation is missing.
- The server log contains no `ConcurrentModificationException`, no
  `Accessing LegacyRandomSource from multiple threads`, and no exception whose
  stack trace passes through your handler.
- Run the server with a packet-heavy action repeated for a minute and confirm
  `/tick query` (1.21+) or a spark profile shows no growth in tick time.
- `/reload` and a client reconnect leave the feature working — proof the
  registration is in the load phase and not tied to a single session.

## References

- [Loader, mappings and version reference tables](../minecraft-project-conventions/references/REFERENCE.md)
- [Fabric documentation — networking](https://docs.fabricmc.net/)
- [NeoForge documentation — network payloads](https://docs.neoforged.net/)
- [Minecraft Wiki — protocol overview](https://minecraft.wiki/w/Java_Edition_protocol)
