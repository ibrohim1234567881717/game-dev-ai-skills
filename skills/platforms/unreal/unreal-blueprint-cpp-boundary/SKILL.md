---
name: unreal-blueprint-cpp-boundary
description: Decide what belongs in C++ and what belongs in Blueprint, and expose C++ to designers without creating a maintenance trap - BlueprintCallable/BlueprintPure, BlueprintNativeEvent vs BlueprintImplementableEvent, Blueprint VM cost, the merge and diff problem with binary assets, and how to migrate logic across the boundary. Use when adding designer-facing API, when a Blueprint has grown into a system, when Blueprint tick shows up in a profile, or when Blueprint merge conflicts are blocking the team.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: unreal
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "software-architecture, api-design, game-architecture"
  uad-tags: "blueprint, ufunction, blueprintnativeevent, blueprintimplementableevent, vm cost, merge conflicts, designer api"
  uad-maturity: stable
---

# Blueprint / C++ boundary

## Purpose

Unreal gives every project two languages with overlapping capability and very
different properties. C++ is fast, diffable, refactorable and invisible to
designers. Blueprint is discoverable, hot-reloadable, iterable in the editor and
a binary blob that cannot be merged, reviewed or searched. Most Unreal
architecture failures are boundary failures: a system that grew inside a
Blueprint until nobody could change it, or a C++ API so awkward that designers
routed around it. This skill decides where the line goes and how to expose C++
across it.

## When to use

- Adding a class or feature and deciding how much of it designers will touch.
- Reviewing a Blueprint that has acquired hundreds of nodes, a tick graph, or
  its own state machine.
- Designers say "I can't do X without a programmer" or "the C++ node doesn't
  give me what I need".
- A profile shows Blueprint/`ProcessEvent` time on the game thread.
- Two people edited the same Blueprint and source control cannot merge it.
- Porting Blueprint logic to C++, or exposing existing C++ to Blueprint.

## When NOT to use

- Correct C++ gameplay mechanics, lifetime and ownership - `unreal-cpp-gameplay`.
- Which module or plugin a class belongs in - `unreal-project-conventions`.
- Widget Blueprints and UI event wiring - `unreal-umg-ui`.
- Blueprint nodes that replicate or run on the server - `unreal-networking-replication`.
- Ability Blueprints, which have their own conventions - `unreal-gameplay-ability-system`.

## Required context

- **Engine version** from the `.uproject` (see `unreal-project-conventions`).
  The exposure metadata below has grown across 5.x.
- **Whether the project has a `Source/` directory at all.** No `Source/` means
  Blueprint-only; moving logic to C++ means converting the project first, which
  is a much larger request than the one being asked.
- **The existing split.** Search `Source/` for `BlueprintImplementableEvent` and
  `BlueprintNativeEvent` to see how the team already draws the line, and match it.
- **Who edits Blueprints.** A solo C++ developer and a ten-designer team need
  opposite answers to the same question.
- **Source control setup.** Whether `.uasset` files are locked/exclusive-checkout
  (see `version-control-workflow`) determines how expensive Blueprint logic is
  for the team.

## Version constraints

Read `EngineAssociation` from the `.uproject` first. A GUID means a source or
custom build - resolve it to an engine path and read `Engine/Build/Build.version`
rather than assuming a version.

- **Blueprint nativization was removed in UE5.** Any advice about
  `-nativizeAssets` or "Inclusive/Exclusive nativization" in packaging settings is
  UE4-only. Performance-critical Blueprint must be rewritten in C++ instead;
  there is no compile-it-away switch.
- **Hot Reload is deprecated in favour of Live Coding** (UE 5.x default on
  Windows). Live Coding patches function bodies; adding or removing
  `UPROPERTY`/`UFUNCTION` declarations, or changing class layout, still requires
  a full editor restart. Telling a designer "just Live Coding it" for a
  reflection change wastes their afternoon.
- **`meta=` specifiers keep being added.** `ExpandEnumAsExecs`,
  `DeterminesOutputType`, `DisplayName`, `AdvancedDisplay`, `AutoCreateRefTerm`
  are long-standing; newer ones are not. Verify any specifier you are unsure of
  against `Runtime/CoreUObject/Public/UObject/ObjectMacros.h` in the project's
  engine before shipping it.
- **UE 5.2+ include tightening** means moving Blueprint logic into C++ often
  surfaces missing includes that older engine versions provided transitively.
- **UE 5.7** is current at time of writing; nothing in this skill's core rules
  changed in 5.5-5.7, but confirm exposure metadata against the engine you build.

## Workflow

1. **Classify the logic before moving it.** Four buckets:
   - *Types, data structures, math, anything per-frame or per-entity at scale* -> C++.
   - *Tuning values, asset references, curve shapes* -> data on a C++ class or a
     Data Asset, edited in the editor (see `unreal-assets-data`).
   - *Composition and cosmetic wiring* - which mesh, which sound, which Niagara
     system, what plays when -> Blueprint.
   - *Level-specific one-offs* -> Blueprint or Level Blueprint, and accept it.
2. **Design the C++ surface as an API, not as an export.** Expose verbs
   designers need (`StartReload()`, `ApplyDamage()`), not internal fields. Every
   `BlueprintCallable` function and `BlueprintReadWrite` property is API you must
   keep working, because breaking it breaks binary assets you cannot grep.
3. **Choose the override mechanism deliberately.**
   - `BlueprintImplementableEvent` - declared in C++, *no* C++ body. Pure hook,
     designers own it entirely. Calling it when nothing implements it is free.
   - `BlueprintNativeEvent` - C++ writes `virtual void Foo_Implementation()`,
     Blueprint may override. Use when there must be sane default behaviour.
     C++ overrides go on `Foo_Implementation`, never on `Foo`.
   - Plain `virtual` (no `UFUNCTION`) - C++-only extension point, cheapest.
4. **Keep `BlueprintPure` honest.** A pure node has no exec pins and is
   re-evaluated *every time an output pin is read*. A pure function that does a
   line trace or iterates actors will run many times per graph execution and the
   cost is invisible in the graph. Pure means cheap and side-effect free; if it
   is not both, make it `BlueprintCallable`.
5. **Never put a loop with real work in a Blueprint tick graph.** Every node is
   a VM instruction dispatched through `UObject::ProcessEvent`; the constant
   factor is roughly an order of magnitude worse than compiled C++ and it is per
   node, not per function. One Blueprint ticking is fine; two hundred actors each
   ticking a fifty-node graph is a frame-time problem.
6. **Break hard reference chains at the boundary.** A `Cast<>` node or a hard
   class pin in a Blueprint creates a load-time dependency on that asset and
   everything it references. Expose `TSoftObjectPtr`/`TSoftClassPtr` parameters
   and interfaces instead of concrete classes when the reference is optional.
   See `unreal-assets-data` for the reference-chain consequences.
7. **When migrating Blueprint logic to C++, reparent rather than rewrite.**
   Create the C++ class, then use *Class Settings > Parent Class* to reparent the
   existing Blueprint onto it, moving logic down node by node and testing after
   each move. Deleting the Blueprint and making a new one orphans every
   placed instance and every reference in every level.
8. **Leave a thin Blueprint on top.** Even for a fully C++ system, designers need
   a Blueprint subclass to set defaults and hook cosmetics. Ending at pure C++
   with no Blueprint child forces a programmer into every content change.

## Best practices

- Put `Category="Section|Subsection"` on everything exposed. Without categories
  the details panel and the node palette become unusable at ~30 exposed members.
- Prefer `EditDefaultsOnly, BlueprintReadOnly` as the default exposure. Widen to
  `EditAnywhere`/`BlueprintReadWrite` only when per-instance editing or
  Blueprint writes are genuinely required.
- Use `meta=(AllowPrivateAccess="true")` to expose a private member rather than
  making it public - the C++ invariant survives.
- Expose Blueprint-assignable events (`DECLARE_DYNAMIC_MULTICAST_DELEGATE`,
  `UPROPERTY(BlueprintAssignable)`) instead of asking designers to poll state
  on tick. This single habit removes most Blueprint tick graphs.
- Use `UINTERFACE`/`IInterface` with `BlueprintNativeEvent` methods when several
  unrelated Blueprint classes must respond to the same call - it avoids casting
  and the hard reference casting brings.
- Keep Blueprint graphs shallow: if a graph does not fit on one screen at a
  readable zoom, it is a system and belongs in C++, or at least in a Blueprint
  Function Library or macro.
- Name exposed functions for designers, not for the codebase.
  `meta=(DisplayName="Apply Damage")` costs nothing and is read hundreds of times.
- Add `meta=(ToolTip=...)` or a `///` comment on exposed API; it appears in the
  node tooltip and is the only documentation most designers will ever see.

## Common mistakes

- **Overriding `Foo()` in C++ for a `BlueprintNativeEvent`.** Tempting because
  the signature exists. It compiles, and the override is silently never called -
  the reflection thunk dispatches to `Foo_Implementation`. Symptom: "my C++
  override does nothing".
- **Making an expensive function `BlueprintPure`.** The graph looks clean; the
  function runs once per output pin read, potentially several times per frame per
  actor. This is one of the most common causes of unexplained game-thread cost.
- **Building a system in Blueprint because it was faster to prototype, and never
  paying it back.** The failure is not performance, it is that two people can
  never work on it at once and no one can review the diff. Set a size ceiling and
  enforce it.
- **Renaming or deleting an exposed C++ function or property.** Blueprints
  referencing it get compile errors or, worse, silently null pins, and you cannot
  find the callers with a text search. Deprecate instead:
  `UFUNCTION(BlueprintCallable, meta=(DeprecatedFunction, DeprecationMessage="Use X"))`.
- **Casting to a concrete Blueprint class inside another Blueprint.** It creates
  a hard reference; loading one asset now loads the other and its whole subtree,
  which is how a 5 MB level ends up loading 400 MB. Use an interface or a base
  C++ class.
- **`BlueprintReadWrite` on state that has an invariant.** Designers will write
  to it from a graph at a time you did not anticipate. Expose a
  `BlueprintCallable` setter that enforces the invariant.
- **Assuming Live Coding covers a header change.** Adding a `UPROPERTY` and
  hitting Live Coding appears to succeed and then behaves inconsistently or
  crashes the editor. Reflection changes require a restart.
- **Editing the same Blueprint on two branches.** `.uasset` is binary; the merge
  tool handles only simple cases and there is no text fallback. Lock the file, or
  keep the logic in C++.

## Validation

- **The override actually runs.** Put a `UE_LOG` in `Foo_Implementation` and a
  Print String in the Blueprint override; both paths must behave as designed when
  called. If the C++ log never fires from a Blueprint child, the override is
  wrong (see the first common mistake).
- **Blueprint cost is measurable.** Run Unreal Insights with
  `-trace=cpu,frame,bookmark -statnamedevents`, open the Timing view on the game
  thread and look for `UObject::ProcessEvent` and named Blueprint function
  scopes. Passing = no Blueprint scope in the top ten game-thread costs for a
  typical frame. `stat game` gives the coarse number to compare before and after.
- **Tick audit.** In PIE, `stat game` and watch `Tick Time`; then disable the
  Blueprint's tick (`Class Defaults > Start with Tick Enabled` off) and compare.
  A measurable drop means the graph was doing per-frame work that belongs in an
  event or timer.
- **Reference hygiene.** Right-click the Blueprint in the Content Browser >
  *Reference Viewer*, and *Size Map*. Passing = the dependency set contains no
  asset the Blueprint does not actually need at load time.
- **Exposed API compiles from content.** After changing any `UFUNCTION`
  signature, run *Tools > Blueprint Debugging* or the commandlet
  `UnrealEditor-Cmd.exe <Project>.uproject -run=CompileAllBlueprints` (verify the
  commandlet name against your engine version) and confirm zero errors before
  committing.

## References

- [Exposure specifiers and boundary patterns](references/REFERENCE.md)
- [Blueprint Visual Scripting](https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprints-visual-scripting-in-unreal-engine)
- [Exposing C++ to Blueprints](https://dev.epicgames.com/documentation/en-us/unreal-engine/exposing-gameplay-elements-to-blueprints-visual-scripting-in-unreal-engine)
- [Blueprint best practices](https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-best-practices-in-unreal-engine)
