---
name: unreal-cpp-gameplay
description: Write correct Unreal Engine gameplay C++ - UObject and AActor lifecycle, UPROPERTY/UFUNCTION reflection, garbage collection and object ownership, delegates, the Gameplay Framework classes (GameMode, GameState, PlayerController, Pawn, Character, PlayerState) and Subsystems. Use when adding or reviewing gameplay classes, chasing a crash on a stale pointer, or deciding which framework class owns a piece of state.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: unreal
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "game-architecture, gameplay-systems, software-architecture"
  uad-tags: "uobject, aactor, uproperty, ufunction, garbage collection, delegates, gamemode, subsystem, lifecycle"
  uad-maturity: stable
---

# Unreal gameplay C++

## Purpose

Unreal C++ is C++ plus a reflection and garbage-collection system that runs on
macro-annotated declarations. Most "random" gameplay crashes and most "my value
resets itself" bugs come from breaking that system's rules: an unreferenced
`UObject` collected mid-frame, work done in a constructor that should have been
done in `BeginPlay`, or state put on a class that does not exist on the machine
reading it. This skill covers those rules and the Gameplay Framework's ownership
model.

## When to use

- Adding a new actor, component, `UObject` or subsystem.
- A crash on a null/garbage pointer, or an object disappearing without being destroyed.
- Deciding where state belongs: GameMode vs GameState vs PlayerController vs PlayerState.
- Values set in a constructor not surviving into play, or Blueprint defaults overriding C++.
- Replacing a manager singleton or an `AActor`-as-manager with something appropriate.

## When NOT to use

- The C++/Blueprint split and exposing API to designers - `unreal-blueprint-cpp-boundary`.
- Replication, RPCs and authority rules - `unreal-networking-replication`.
- Abilities, attributes and effects - `unreal-gameplay-ability-system`.
- Build failures and module wiring - `unreal-project-conventions` / `unreal-packaging-build`.

## Required context

- **Engine version** - from the `.uproject` (see `unreal-project-conventions`). Signatures
  in this area changed repeatedly across 5.x.
- **Whether the project is networked.** `Source/*Server.Target.cs`, or `bReplicates` /
  `GetLifetimeReplicatedProps` anywhere in `Source/`. If it is, ownership questions have
  a second axis and `unreal-networking-replication` applies too.
- **The existing base classes.** Most projects have their own `A<Project>Character`,
  `A<Project>GameMode` etc. Derive from those, not from the engine class.
- **Whether GAS is enabled** - `GameplayAbilities` in a `.Build.cs` or the `.uproject`.
  If so, attributes belong in an `UAttributeSet`, not as loose `UPROPERTY` floats.

## Version constraints

Read the engine version from `EngineAssociation` in the `.uproject` before writing any
signature; a GUID means a source build, so read `Engine/Build/Build.version` in that
engine tree. Then verify signatures against the installed engine headers.

- **`TObjectPtr<T>`** replaced raw pointers in `UPROPERTY` declarations in UE5. It behaves
  as a raw pointer at runtime in packaged builds and adds access tracking in the editor.
  New code should use it; existing raw-pointer `UPROPERTY` still compiles.
- **`MarkPendingKill()` is gone in UE5**; the replacement is `MarkAsGarbage()`, and
  `IsValid()` is the check. UE4-era `IsPendingKill()` guidance is stale.
- **UE 5.5+** made several `AActor` replication fields private with accessors
  (`SetReplicates()`, `SetNetUpdateFrequency()`, `SetNetPriority()`). Direct assignment
  that compiled in 5.4 fails in 5.5+. Verify before writing to them.
- **Include-What-You-Use tightening (5.2 onward)** keeps removing transitive includes.
  Code that compiled without `#include "Engine/World.h"` may stop compiling on upgrade.
- **`FTimerManager`, `FTickFunction`, subsystem APIs** are stable across 5.x, but the
  set of available subsystem base classes has grown; check the engine before assuming
  a specific one exists.

Where you are unsure whether an API is current, open the header in the project's engine
install and read it. Do not write a signature from memory into version-sensitive code.

## Workflow

1. **Pick the right base class before writing code.** `UObject` for data and logic with no
   world presence; `UActorComponent` for behaviour attached to an actor; `USceneComponent`
   when it needs a transform; `AActor` when it must exist in the world; a Subsystem when
   it is a manager with a defined lifetime. "Manager actor placed in the level" is almost
   always the wrong answer - a subsystem has a guaranteed lifetime and no level dependency.
2. **Respect the construction order.** The constructor runs on the class-default object
   too, at editor startup, in a world that does not exist yet. Only set defaults and call
   `CreateDefaultSubobject` there. Anything that touches the world, other actors, or
   gameplay state goes in `PostInitializeComponents` or `BeginPlay`.
3. **Anchor every UObject you create.** `NewObject<UMyThing>(Outer)` returns an object that
   the GC will collect unless something reachable holds it. A `UPROPERTY()` member is the
   normal anchor; `TStrongObjectPtr` or `FGCObject::AddReferencedObjects` for non-UObject
   owners; `AddToRoot()` only for genuine process-lifetime globals, and then remember
   `RemoveFromRoot()`.
4. **Choose the framework class by who needs to see the data.**
   - `AGameModeBase` - server-only rules. Does not exist on clients. Never store anything
     a client must read here.
   - `AGameStateBase` - game-wide state replicated to everyone (match state, scores).
   - `APlayerState` - per-player state visible to everyone; survives pawn death and,
     with `bUseSeamlessTravel`, level transitions.
   - `APlayerController` - per-player, exists on the owning client and the server only;
     input, UI ownership, client-specific commands.
   - `APawn`/`ACharacter` - the possessed body; treat as disposable.
   - `UGameInstance` - persists across level loads within a session.
5. **Expose deliberately.** `UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category=...)`
   for tuning knobs; `EditAnywhere` only when per-instance overrides genuinely make sense.
   Every exposed property is API you now have to keep.
6. **Wire events with delegates, not polling.** `DECLARE_DYNAMIC_MULTICAST_DELEGATE_*` when
   Blueprint must bind (`AddDynamic`, requires `UFUNCTION()` handlers); the non-dynamic
   `DECLARE_MULTICAST_DELEGATE_*` when it is C++ only - it is faster and type-safe.
   Bind with `AddUObject` so the binding dies with the object, and keep the
   `FDelegateHandle` if you may need to remove it.
7. **Turn ticking off.** `PrimaryActorTick.bCanEverTick = false` is the default you should
   want. When ticking is genuinely needed, set a tick interval, or use a timer
   (`GetWorldTimerManager().SetTimer`) if the work is periodic rather than per-frame.
8. **Clean up in `EndPlay`.** Timers, delegate bindings to objects that outlive you, and
   spawned actors you own. `EndPlay` runs for level transitions and Play-In-Editor stops;
   `BeginDestroy` is too late to touch other objects safely.

## Best practices

- Prefer composition: put behaviour in `UActorComponent` subclasses so it can be reused
  across unrelated actor hierarchies. Deep actor inheritance chains are the classic Unreal
  architecture failure.
- Use `IsValid(Obj)` rather than `Obj != nullptr` for `UObject` pointers - it also catches
  objects marked as garbage but not yet collected.
- Use `TWeakObjectPtr` for back-references and caches; it does not keep the object alive
  and `IsValid()` on it is honest about destruction.
- `CreateDefaultSubobject<T>(TEXT("Name"))` only in the constructor; the name string must
  be stable, because renaming it orphans the subobject in every existing Blueprint child
  and serialised instance.
- Use `checkf`/`ensure` deliberately: `check` for invariants that must abort,
  `ensure` for "should not happen but recoverable" - it reports once and continues,
  which is right for gameplay code.
- Cache subsystem pointers per frame at most; `GetGameInstance()->GetSubsystem<T>()` is a
  map lookup, cheap but not free in a hot loop.
- Log through a project-specific category (`DECLARE_LOG_CATEGORY_EXTERN`) rather than
  `LogTemp`, so it can be filtered and shipped-off with verbosity settings.

## Common mistakes

- **Storing a `UObject*` in a plain (non-`UPROPERTY`) member.** Tempting because it
  compiles. The GC never sees the reference, collects the object, and you get a crash on a
  dangling pointer minutes later in unrelated code. Every owned `UObject` reference must be
  `UPROPERTY()` or held by `TStrongObjectPtr`.
- **Doing gameplay work in the constructor.** It runs on the CDO at editor startup;
  `GetWorld()` is null or the wrong world, and anything you spawn leaks into the editor.
  Move it to `BeginPlay`.
- **Setting a property in the constructor and expecting it in a Blueprint child.**
  Blueprint subclasses serialise their own defaults; a constructor change only affects
  instances that never overrode it. Reparent or re-serialise, or set the value in code
  at runtime.
- **Putting per-player data on the GameMode.** GameMode does not exist on clients, so the
  data is simply absent there, and the bug presents as "works in PIE single player only".
  Use PlayerState.
- **Binding a delegate with a raw lambda capturing `this` and never unbinding.** The
  broadcaster outlives the listener and calls into freed memory. Use `AddUObject`, or
  capture a `TWeakObjectPtr` and check it.
- **Casting with `Cast<T>` in a per-frame loop.** `Cast` is a reflection check, not
  `static_cast`. Resolve the type once and store it, or use an interface.
- **Leaving `bCanEverTick = true` on hundreds of actors that do nothing.** Each is a tick
  function registration and a virtual call per frame; it shows up as unexplained game
  thread time in `stat game` long before anyone suspects it.

## Validation

- `stat game` in PIE: the `Ticks` / `TickActors` figure should not grow with actors that
  have no per-frame work. Compare before and after a change.
- Force a collection to prove ownership is correct: `obj gc` (or set
  `gc.CollectGarbageEveryFrame 1` for a few seconds) and confirm no crash and no
  disappearing objects. This flushes out unrooted `UObject`s immediately instead of
  minutes later.
- `obj list class=<YourClass>` in the console lists live instances with counts - a good
  leak check after repeated spawn/destroy cycles; the count should return to baseline.
- Build with `bUseUnityBuild = false` on the module once to confirm includes are honest.
- Run PIE with two players (Editor Preferences > Play > Number of Players = 2) even for a
  single-player feature: state placed on the wrong framework class fails immediately there.

## References

- [Lifecycle, framework and GC reference](references/REFERENCE.md)
- [Gameplay Framework](https://dev.epicgames.com/documentation/en-us/unreal-engine/gameplay-framework-in-unreal-engine)
- [Unreal Object handling and garbage collection](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-object-handling-in-unreal-engine)
- [Programming Subsystems](https://dev.epicgames.com/documentation/en-us/unreal-engine/programming-subsystems-in-unreal-engine)
