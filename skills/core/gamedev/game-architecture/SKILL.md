---
name: game-architecture
description: Structuring a game codebase - separating simulation from presentation, choosing between inheritance, composition and ECS, managing game state and scene flow, and deciding what lives in data rather than code. Use when starting a game project, adding a system that touches many others, or when a game codebase has become hard to change. Engine-agnostic; platform skills supply the engine's own idioms.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: gamedev
  uad-version: "1.0.0"
  uad-requires: "software-architecture"
  uad-tags: "game architecture, ecs, composition, game state, scene flow, data driven, simulation, presentation"
  uad-maturity: stable
---

# Game Architecture

## Purpose

Game codebases decay in a characteristic way: a deep inheritance tree that
cannot accommodate the next entity, a manager singleton that everything talks
to, gameplay rules tangled into engine callbacks so nothing can be tested, and
tuning values compiled into code so designers must ask a programmer to change a
number.

This skill covers the structural decisions that prevent that. It is
engine-agnostic; `unreal-*`, `unity-*`, `godot-*` and `roblox-*` skills supply
the idioms each engine expects.

## When to use

- Starting a project, or a substantial new system inside one.
- Adding a feature that touches several existing systems.
- When adding an entity type requires editing many unrelated files.
- When gameplay rules cannot be tested without launching the game.
- When designers cannot change values without a programmer and a rebuild.

## When NOT to use

- A game jam or a prototype answering a design question. Structure the code to
  be thrown away; architecture applied to a prototype delays the answer.
- A single specific defect. Use `root-cause-debugging`.
- Frame-time problems. Use `performance-profiling-method` first; architecture
  chosen for imagined performance reasons is usually wrong.

## Required context

| Fact | Why it matters |
|---|---|
| Genre and core loop | Determines which systems are central |
| Entity count and update frequency | Decides whether ECS-style data layout is warranted |
| Single-player or networked | Networking constrains where state may live (`client-server-trust`) |
| Who authors content, and how | Decides what must be data rather than code |
| The engine and its idioms | Fighting the engine's model costs more than it saves |
| Team size | Boundaries are coordination boundaries |

## Version constraints

The structural principles are version-independent. What each engine *provides*
is not: entity-component frameworks, scene systems, data-asset types and
subsystem lifetimes all differ, and their capabilities change between versions.
Resolve the engine and version first, then apply these principles using that
engine's mechanisms rather than importing another engine's vocabulary.

## Workflow

1. **Separate simulation from presentation.** Game rules -- damage, economy,
   progression, inventory, win conditions -- should not be written inside
   rendering, animation or input callbacks. Simulation that can run without a
   renderer is testable, is portable to a headless server, and survives a UI
   rewrite. This is the highest-value structural decision in most game codebases.

2. **Choose the entity model deliberately.**

   | Model | Fits | Breaks down when |
   |---|---|---|
   | Inheritance | Small, genuinely hierarchical entity sets | Entities need traits from several branches -- the diamond that never resolves |
   | Composition | Most games; entities as bags of behaviours | Very high entity counts with cache-hostile layout |
   | ECS / data-oriented | Thousands of similar entities updated uniformly | Small entity counts, where it adds ceremony without benefit |

   Composition is the default answer for most games. Choose ECS because the
   entity count and update pattern demand it, not because it is fashionable.

3. **Define ownership of state.** Every piece of mutable state has exactly one
   owner responsible for changing it; others read or request. Multiple writers
   to the same state is the root of most "impossible" gameplay bugs.

4. **Model game flow as an explicit state machine.** Boot, menu, loading, play,
   pause, game over, shutdown -- with defined transitions. Implicit flow spread
   across flags produces the class of bug where pausing during a load leaves the
   game unresponsive.

5. **Decide what is data.** Anything a designer tunes -- stats, prices, spawn
   tables, dialogue, quests, level layout -- belongs in data files or data
   assets, edited and reloaded without a programmer. Validate that data: content
   errors ship as readily as code errors.

6. **Choose communication mechanisms per relationship**, and be consistent:
   direct reference for ownership, interface for a swappable collaborator,
   events for one-to-many notification. Events everywhere makes control flow
   invisible and undebuggable; direct references everywhere makes everything
   coupled.

7. **Keep the update order explicit.** Input, then simulation, then presentation.
   Order-dependent bugs that appear only sometimes usually come from an
   undefined update order.

8. **Isolate save state deliberately.** Decide early what is persisted and how
   it will be versioned; retrofitting migration onto a shipped save format is
   painful (`save-systems`).

## Best practices

- **Composition over inheritance**, as the default for entities.
- **Keep managers narrow.** A `GameManager` that owns everything is the shape
  of missing architecture. Prefer several small services with stated
  responsibilities.
- **Avoid mutable global singletons.** They hide dependencies and make tests
  impossible. Where the engine provides a scoped service or subsystem, use it.
- **Make rules pure functions of state where possible.** Easy to test, easy to
  reason about, easy to replicate in networked play.
- **Put the authoritative simulation on the server** in networked games, from
  the start. Retrofitting authority is close to a rewrite.
- **Make content data validate itself**, with a checker that runs in CI.
- **Design for the debug view.** A way to inspect and manipulate live game state
  pays for itself many times over.

## Common mistakes

- **Deep entity inheritance.** Works for the first ten entity types and then
  blocks every one after.
- **Gameplay logic inside engine callbacks.** Untestable, unportable, and
  duplicated when a second entry point appears.
- **Singleton managers referencing each other.** Cyclic, order-dependent at
  startup, impossible to test in isolation.
- **Tuning values in code.** Every balance change becomes a programmer task and
  a rebuild.
- **Events for everything.** Control flow becomes invisible; nobody can answer
  "what happens when I press this".
- **Implicit game flow through booleans.** `isPaused && !isLoading && hasStarted`
  is a state machine that nobody designed.
- **Adopting ECS for a game with a hundred entities.** Cost without benefit.
- **Deferring save format and versioning.** Shipping without a version field in
  the save is a decision you cannot undo.
- **Copying another engine's idioms wholesale.** Unity patterns in Godot, or
  Unreal patterns in Roblox, fight the engine and confuse contributors.

## Validation

The architecture is sound when:

- Core game rules can be exercised without starting the renderer.
- Adding a new entity type or ability touches a small, predictable set of files.
- Every mutable piece of state has one identifiable owner.
- Game flow is one explicit state machine, and illegal transitions are impossible.
- A designer can change tuning values without a programmer or a rebuild.
- Content data is validated automatically.
- There are no cycles in the module dependency graph.
- In networked play, the server computes every outcome that matters.

Concrete test: write a unit test that runs a combat exchange, a purchase, or a
progression step with no engine objects instantiated. If that is impossible,
simulation and presentation are not separated, and that is the first thing to fix.

## References

- Related core skills: `software-architecture`, `gameplay-systems`,
  `save-systems`, `multiplayer-networking`, `client-server-trust`
- Engine idioms: `unreal-cpp-gameplay`, `unity-scriptable-objects`,
  `godot-scene-composition`, `roblox-project-conventions`
