---
name: unreal-gameplay-ability-system
description: Build and debug gameplay with the Gameplay Ability System - AbilitySystemComponent placement and initialisation, AttributeSets and attribute accessors, GameplayEffects and modifier calculations, GameplayTags as the control vocabulary, GameplayCues for cosmetics, and the prediction and replication-mode rules that decide whether it works in multiplayer. Use when adding abilities, attributes, buffs or status effects, when GAS attributes desync between server and client, or when deciding whether GAS is the right tool for a project at all.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: unreal
  uad-domain: gamedev
  uad-version: "1.0.0"
  uad-requires: "gameplay-systems, game-architecture, multiplayer-networking"
  uad-tags: "gas, abilitysystemcomponent, attributeset, gameplayeffect, gameplaytag, gameplaycue, prediction, replication mode"
  uad-maturity: stable
---

# Gameplay Ability System

## Purpose

GAS is Epic's framework for abilities, attributes and status effects, built for
replicated, predicted, designer-authored combat. It is powerful and it is
opinionated: attributes must live in an `UAttributeSet`, mutations must go
through `UGameplayEffect`, control flow is expressed in `FGameplayTag`s, and the
prediction model constrains what an ability may legally do on a client. Used as
designed it removes an enormous amount of networking work. Used partially - a
few attributes here, direct `SetHealth` calls there - it costs more than it
saves and desyncs in ways that are hard to diagnose. This skill covers the rules
and the decision to adopt it.

## When to use

- Adding abilities, cooldowns, costs, buffs, debuffs, damage-over-time or status
  effects to a project where `GameplayAbilities` is already enabled.
- An attribute (health, stamina, movement speed) shows the wrong value on a
  client, or reverts a moment after changing.
- A `GameplayEffect` is applied but nothing happens, or it applies twice.
- Deciding whether to adopt GAS on a project that does not use it yet.
- Cosmetic effects need to fire on all clients when an ability executes.
- An ability activates on the client and is then rejected/rolled back by the server.

## When NOT to use

- Plain gameplay classes, ownership and lifetime - `unreal-cpp-gameplay`.
- General replication, RPCs and relevancy - `unreal-networking-replication`.
- Enhanced Input bindings that trigger abilities - `unreal-enhanced-input`.
- The visual side of a GameplayCue (the Niagara system itself) - `unreal-niagara-vfx`.
- A single-player game with fewer than a handful of simple abilities. GAS is a
  large fixed cost; say so rather than adopting it.

## Required context

- **Is GAS actually enabled?** `GameplayAbilities` in the `.uproject` `Plugins`
  array and `"GameplayAbilities", "GameplayTags", "GameplayTasks"` in a
  `.Build.cs`. If not, adopting it is a project-level decision, not an
  implementation detail.
- **Engine version** from the `.uproject` (`unreal-project-conventions`). GAS
  APIs have changed materially across 5.x - see Version constraints.
- **Where the ASC lives.** Search for `UAbilitySystemComponent` in `Source/`:
  on the `APlayerState` (persists across pawn death, standard for player
  characters) or on the `APawn` (simpler, standard for AI/minions). This decides
  the replication mode and the initialisation call sites.
- **Is `UAbilitySystemGlobals::Get().InitGlobalData()` called?** Usually from
  `UAssetManager::StartInitialLoading()`. Without it, target data and prediction
  break in ways that only show up in networked play.
- **Whether the project is networked at all.** `Source/*Server.Target.cs` or
  existing replication. Single-player GAS can ignore most of the prediction
  section; multiplayer cannot ignore any of it.
- **The tag vocabulary.** `Config/DefaultGameplayTags.ini` plus any
  `UE_DEFINE_GAMEPLAY_TAG` in `Source/`. Tags are the API here; read them before
  inventing new ones.

## Version constraints

Resolve the engine version from `EngineAssociation` before writing GAS code; a
GUID means a source build, so read `Engine/Build/Build.version` from that engine
tree. GAS is a plugin and moves faster than the engine core.

- **`EGameplayAbilityInstancingPolicy::NonInstanced` was deprecated in UE 5.5.**
  New abilities should be `InstancedPerActor` (the normal choice) or
  `InstancedPerExecution` (when concurrent instances need separate state). Old
  tutorials still recommend `NonInstanced` for cheap abilities.
- **Native gameplay tags** are declared with `UE_DECLARE_GAMEPLAY_TAG_EXTERN` /
  `UE_DEFINE_GAMEPLAY_TAG` (and `UE_DEFINE_GAMEPLAY_TAG_STATIC` for
  file-local). The older `FGameplayTag::RequestGameplayTag(FName(...))` string
  lookup still works but is unchecked and slow; the older `FNativeGameplayTag`
  type has been superseded.
- **UE 5.5+ moved several `AActor` replication fields behind accessors**
  (`SetReplicates`, `SetNetUpdateFrequency`); this affects ASC-owning actors too.
- **`FGameplayAttributeData` and the `ATTRIBUTE_ACCESSORS` macro pattern** are
  stable, but the exact macro is defined per project (it is copied from Epic's
  samples, not provided by the plugin). Find the project's copy before assuming
  the name.
- **UE 5.7** is current at time of writing. GAS itself gained no boundary-level
  redesign in 5.6-5.7, but Epic has been iterating on the ability
  task/targeting APIs. Verify any signature you are unsure of against
  `Plugins/Runtime/GameplayAbilities/Source/GameplayAbilities/Public/` in the
  project's engine rather than writing it from memory.

## Workflow

1. **Decide whether GAS earns its cost.** It pays for itself with: many
   abilities, stacking/duration effects, replicated attributes with prediction,
   designers authoring content. It does not pay for itself with: three
   hard-coded abilities, single-player, or a team with no GAS experience and a
   short schedule. Say no explicitly and use plain components instead.
2. **Place the ASC.** Player characters -> `APlayerState`, with
   `SetIsReplicated(true)` and replication mode `Mixed`. AI and simple actors ->
   the pawn itself, replication mode `Minimal`. Single-player -> anywhere, mode
   `Full`.
3. **Initialise the actor info on both sides.** `InitAbilityActorInfo(Owner, Avatar)`
   must run on the server *and* on the owning client. With the ASC on the
   PlayerState, that means `APawn::PossessedBy` (server) and
   `OnRep_PlayerState`/`AcknowledgePossession` (client). Missing the client call
   is the single most common GAS bug: abilities work in PIE-as-listen-server and
   do nothing for a real client.
4. **Define attributes in an `UAttributeSet`.** One `FGameplayAttributeData` per
   attribute, replicated with `ReplicatedUsing=OnRep_X`, and each `OnRep_X`
   calling `GAMEPLAYATTRIBUTE_REPNOTIFY`. Add the attribute set as a default
   subobject of the ASC's owner. Never expose a public setter.
5. **Clamp in the right hook.** `PreAttributeChange` clamps the *value*
   (including from any source); `PostGameplayEffectExecute` is where you react to
   an instant change (death, overheal spillover, applying damage to health).
   Meta attributes (an incoming `Damage` attribute consumed in
   `PostGameplayEffectExecute`) are the idiomatic way to route damage.
6. **Change attributes only through `UGameplayEffect`.** Instant for one-off
   changes, HasDuration for timed buffs, Infinite for effects removed by
   explicit conditions. Direct `SetHealth()` on the attribute set bypasses
   prediction, tag reactions and cues, and desyncs.
7. **Express control flow in tags.** Ability tags, `Activation Blocked Tags`,
   `Activation Required Tags`, `Cancel Abilities With Tag`, `Block Abilities
   With Tag`, and `GrantedTags` on effects. This is what lets designers add a
   "stunned" state without touching code.
8. **Set the net execution policy per ability.** `LocalPredicted` for player
   abilities that must feel instant; `ServerOnly` for anything requiring
   server-authoritative data (loot rolls, damage numbers derived from hidden
   state); `LocalOnly` for purely cosmetic; `ServerInitiated` when the server
   drives it. Do not default everything to `LocalPredicted`.
9. **Put cosmetics in GameplayCues.** Tag-driven (`GameplayCue.*`), executed
   through the ASC, so they fire correctly for simulated proxies and respect
   replication mode. Spawning a Niagara system directly inside the ability body
   means remote clients see nothing.
10. **Grant abilities on the server only.** `GiveAbility` is server-authoritative;
    the resulting `FGameplayAbilitySpec` replicates to the owning client.

## Best practices

- Keep one `UAttributeSet` per conceptual group (health/combat/movement) rather
  than one giant set - it keeps replication and ownership legible.
- Use the `ATTRIBUTE_ACCESSORS` macro pattern so every attribute gets consistent
  getter/setter/initter/property accessors; hand-written accessors drift.
- Build damage as: an execution calculation (`FGameplayEffectExecutionCalculation`)
  reading captured source and target attributes, writing to a `Damage` meta
  attribute, consumed in `PostGameplayEffectExecute`. Anything simpler stops
  scaling the moment armour or resistances appear.
- Use `UGameplayModMagnitudeCalculation` for magnitudes that depend on other
  attributes; use `Set By Caller` (`SetSetByCallerMagnitude`) for values the
  caller knows at runtime. Curve tables for level scaling.
- Prefer ability tasks (`UAbilityTask_WaitDelay`, `PlayMontageAndWait`,
  `WaitGameplayEvent`, `WaitTargetData`) over ticking inside an ability; tasks
  clean up when the ability ends.
- Always `EndAbility` on every exit path, including cancellation. A leaked
  active ability blocks reactivation forever and looks like "input stopped
  working".
- Register cue tags under a consistent root (`GameplayCue.Weapon.Fire`) so the
  `GameplayCueManager` can scan them, and keep cue notify assets in a scanned
  directory (`Config/DefaultGame.ini` `+GameplayCueNotifyPaths`).
- Keep the tag tree shallow and named for meaning (`State.Debuff.Stunned`), not
  for implementation. Tags are matched by prefix, so hierarchy is behaviour.

## Common mistakes

- **Calling `InitAbilityActorInfo` only on the server.** Everything works in
  single-player PIE and as the listen-server host, and clients silently have no
  working abilities. Call it on both sides, and again after respawn.
- **Using replication mode `Full` in multiplayer.** Every gameplay effect
  replicates to every client, which is enormous bandwidth waste and leaks other
  players' state. Use `Mixed` for player-controlled ASCs and `Minimal` for AI.
- **`Mixed` mode with the ASC owner not owned by the controller.** Mixed mode
  relies on the owning connection being resolvable; putting a Mixed-mode ASC on
  an actor whose `Owner` chain does not reach the PlayerController produces
  effects that never reach the client. PlayerState-owned ASCs satisfy this
  naturally.
- **Setting attributes directly** (`AttributeSet->SetHealth(50)` or a raw
  `UPROPERTY` float). It skips prediction, tag triggers and cues; the client's
  predicted value and the server's authoritative value diverge and the health
  bar visibly snaps.
- **Clamping in `PostGameplayEffectExecute` only.** The base value is already
  modified by then for duration-based effects, so the clamp fights the effect
  and values drift. Clamp the current value in `PreAttributeChange` and the base
  in `PostGameplayEffectExecute`.
- **Predicting something unpredictable.** `LocalPredicted` on an ability whose
  outcome depends on server-only state (a random roll, hidden enemy data) means
  the client shows one result and the server corrects it. Use `ServerOnly` or
  `ServerInitiated`.
- **Spawning effects and sounds inside the ability instead of a GameplayCue.**
  On a `LocalPredicted` ability, only the local client sees them; simulated
  proxies see nothing at all.
- **Forgetting `InitGlobalData()`.** Target data serialisation and prediction
  keys misbehave, with errors that point at unrelated code.
- **Adding tags in `DefaultGameplayTags.ini` by hand while the editor is open.**
  The editor rewrites the file; edit tags through the Gameplay Tag manager, or
  declare them natively in C++.

## Validation

- **`showdebug abilitysystem`** in PIE on the possessed pawn. It lists granted
  abilities, active effects with remaining duration, owned tags and attribute
  values (`Page Up`/`Page Down` cycle pages). Passing = the attribute values, the
  tag set and the active effect list match what you expect *on both the server
  and the client window*.
- **Run PIE with 2 players and "Play As Client"** (Editor Preferences > Play >
  Net Mode: Play As Client, Number of Players: 2). Passing = attributes and
  cooldowns look identical in both windows, with no visible snap-back after an
  ability fires. This is the only check that catches the missing client-side
  `InitAbilityActorInfo`.
- **Add artificial latency** with `NetEmulation.PktLag 150` and
  `NetEmulation.PktLoss 3`, then fire predicted abilities. Passing = the local
  client sees the ability start immediately and there is no visual rollback of
  health/cooldown when the server acknowledges.
- **Check the effect actually applied**: `AbilitySystemComponent->
  GetActiveGameplayEffects()` in the debugger, or the `showdebug abilitysystem`
  effect page. An effect that "did nothing" is usually blocked by
  `ApplicationTagRequirements` rather than broken.
- **Cue coverage:** trigger the ability from a simulated proxy's point of view
  (second PIE window watching another player). Passing = cosmetics play on the
  observer, not just the instigator.
- **Attribute leak check:** apply and remove a duration effect repeatedly; the
  attribute must return exactly to its base value. Drift means a clamp or a
  modifier is being applied to the wrong value type.

## References

- [GAS class, effect and tag reference](references/REFERENCE.md)
- [Gameplay Ability System](https://dev.epicgames.com/documentation/en-us/unreal-engine/gameplay-ability-system-for-unreal-engine)
- [Gameplay Tags](https://dev.epicgames.com/documentation/en-us/unreal-engine/using-gameplay-tags-in-unreal-engine)
- [Gameplay Effects](https://dev.epicgames.com/documentation/en-us/unreal-engine/gameplay-effects-for-the-gameplay-ability-system-in-unreal-engine)
