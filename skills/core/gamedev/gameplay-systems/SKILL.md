---
name: gameplay-systems
description: Implementing game mechanics as maintainable systems - state machines, abilities, stats and modifiers, cooldowns, damage pipelines, and the tuning data behind them. Use when building or extending combat, abilities, character state, progression, or any rule-driven mechanic, and when a mechanic has become a tangle of special cases. Engine-agnostic.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: gamedev
  uad-version: "1.0.0"
  uad-requires: "game-architecture"
  uad-tags: "gameplay, mechanics, state machine, abilities, stats, modifiers, combat, damage, cooldown, tuning"
  uad-maturity: stable
---

# Gameplay Systems

## Purpose

Mechanics start simple and accumulate exceptions: a damage calculation that
grows a special case per weapon, a character controller with fifteen booleans, a
buff system where each new buff needs a new branch. The result is a system
nobody can change safely, in the part of the codebase that changes most often.

This skill covers the structures that absorb new content without new branches.

## When to use

- Building combat, abilities, status effects, progression, crafting, or any
  rule-driven mechanic.
- Adding the third variant of something that already has two hard-coded cases.
- When a character or entity's behaviour is controlled by a growing set of
  boolean flags.
- When designers need to add content without a programmer.

## When NOT to use

- The mechanic is genuinely one-off and will not vary. A direct implementation
  is correct; do not build a framework for one case.
- Structuring the codebase as a whole. Use `game-architecture`.
- Specific subsystems with their own skills: `inventory-systems`,
  `quest-systems`, `dialogue-systems`, `save-systems`, `game-ai`.

## Required context

| Fact | Why it matters |
|---|---|
| The rules, as the designer states them | Ambiguity here becomes bugs later |
| What varies between instances | Decides what becomes data |
| Whether it is networked | Authority and determinism constraints (`client-server-trust`) |
| Who authors the content | Decides the data format and tooling |
| Expected content volume | Ten abilities and a thousand need different structures |
| Whether outcomes must be reproducible | Replays, rollback and testing need determinism |

## Version constraints

Version-independent as design. Engines provide their own frameworks for parts of
this -- Unreal's Gameplay Ability System is the most complete example -- and
using the engine's framework is usually better than building a parallel one.
Consult `unreal-gameplay-ability-system` and the corresponding platform skills;
their APIs are version-sensitive even where these principles are not.

## Workflow

1. **Write the rules down as statements** before coding: "damage is base weapon
   damage, multiplied by the attacker's damage modifiers, reduced by armour,
   minimum 1". Ambiguity survives into code as bugs, and this text becomes the
   test cases.

2. **Separate the rule from the content.** The pipeline is code; the numbers,
   the effect list and the ability definitions are data. Adding an ability
   should mean adding a data entry, not a code branch.

3. **Model entity behaviour as an explicit state machine** when behaviour is
   mode-dependent. States, transitions, entry and exit actions. Replace boolean
   sets: `isGrounded && !isDashing && !isStunned` is an undesigned state machine
   with undefined transitions, and it is where character controller bugs live.

4. **Build stats as a base value plus a modifier pipeline.** Modifiers have a
   source, an operation (add, multiply, override), a priority, and a lifetime.
   Recompute rather than mutating the base -- mutation is why stats drift
   permanently after a buff expires, one of the most common gameplay bugs.

5. **Make effects data-driven and composable.** An ability is a list of effects
   (damage, apply status, move, spawn, play cue), each independently
   implemented. New abilities recombine existing effects.

6. **Define the pipeline order once** for damage or similar multi-step
   calculations, and route everything through it. Two code paths that both
   compute damage will diverge.

7. **Handle time explicitly.** Cooldowns, durations and delays are state with an
   owner, driven by a game clock you control -- not by wall time, and not by
   frame counting. Decide up front what pausing and time dilation do to them.

8. **Decide determinism early.** If replays, rollback netcode or reproducible
   tests are needed, all randomness must come from a seeded, ordered source, and
   the simulation must not depend on frame timing or iteration order.

9. **Validate content data**, with a checker in CI: referenced ids exist,
   required fields present, values in range.

## Best practices

- **Data over code for anything designers tune.** The number of programmer
  round-trips is the real measure of a gameplay system's quality.
- **One authoritative path per calculation.**
- **Make state machines explicit and inspectable**, with a debug view of the
  current state and last transition.
- **Modifiers as a list, stats as a computation.** Never mutate the base.
- **Give every effect a source.** "Who applied this" is needed for expiry,
  dispel, attribution, kill credit and debugging.
- **Simulate on the server in networked games**; treat client-side prediction as
  presentation only.
- **Unit test the rules** with the statements from step 1 as cases. Rules
  separated from engine callbacks are cheap to test.
- **Build the debug tooling early** -- inspect stats, list active modifiers,
  force a state, trigger an ability. It pays for itself within days.

## Common mistakes

- **Boolean soup instead of a state machine.** Every combination is reachable,
  most were never considered.
- **Mutating base stats to apply buffs.** Values drift; the entity ends the
  session permanently stronger.
- **A damage formula with a branch per weapon type.** Becomes unmaintainable at
  around the fifth type.
- **Hard-coded tuning values.** Every balance pass becomes an engineering task.
- **Duplicate calculation paths.** Melee and ranged damage computed separately
  diverge, and one of them silently ignores a modifier.
- **Cooldowns on wall-clock time.** Break on pause, time scaling, and offline
  progression; sometimes exploitable by changing the device clock.
- **Unseeded randomness in a system that needs replays.** Discovered far too late.
- **Effects with no source.** Cannot expire, dispel, or attribute correctly.
- **Client-authoritative combat in a networked game.** Instantly exploitable.

## Validation

The system is sound when:

- Adding a typical new ability, weapon, or status effect requires only new data.
- The rules as written by the designer exist as unit tests, and they pass.
- Applying and removing a modifier returns the stat to exactly its original value.
- No entity behaviour depends on a combination of booleans rather than a state.
- Every calculation of a given quantity goes through one function.
- With a fixed seed and identical inputs, the simulation produces identical
  output (where determinism is required).
- Content data passes an automated validity check.
- In networked play, outcomes are computed server-side.

Two concrete checks: apply every modifier in the game to an entity and remove
them all, asserting stats equal their starting values; and run the designer's
rule statements as a test table, which catches formula regressions immediately.

## References

- Related core skills: `game-architecture`, `game-ai`, `inventory-systems`,
  `save-systems`, `multiplayer-networking`, `client-server-trust`
- Engine frameworks: `unreal-gameplay-ability-system`
