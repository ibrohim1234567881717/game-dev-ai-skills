# Unreal gameplay C++ reference

Signatures change between engine versions. Confirm against the headers in the engine
the project actually uses before relying on any of this.

## Actor lifecycle order

For an actor spawned at runtime:

1. C++ constructor (also runs on the class-default object at editor startup)
2. `PostActorCreated` (spawned) or `PostLoad` (loaded from a level)
3. `OnConstruction` - the Blueprint Construction Script; re-runs on every property edit
4. `PreInitializeComponents`
5. Component `InitializeComponent` (only when `bWantsInitializeComponent` is true)
6. `PostInitializeComponents` - components exist and are registered
7. `BeginPlay` - the world is live; other actors may or may not have had `BeginPlay` yet
8. `Tick` (if enabled)
9. `EndPlay(EEndPlayReason)` - destruction, level transition, or PIE stop
10. `Destroyed`, then GC: `BeginDestroy` -> `IsReadyForFinishDestroy` -> `FinishDestroy`

Do not assume ordering *between* actors in `BeginPlay`. If A needs B initialised, either
have B publish a delegate, or defer with a next-tick timer
(`GetWorldTimerManager().SetTimerForNextTick`).

## UObject lifecycle

| Stage | Hook |
|---|---|
| Constructed | Constructor (CDO and instances) |
| Properties loaded/initialised | `PostInitProperties` |
| Loaded from disk | `PostLoad` |
| Edited in the editor | `PostEditChangeProperty` (`WITH_EDITOR`) |
| Marked garbage | `MarkAsGarbage()`; `IsValid()` returns false |
| Being collected | `BeginDestroy` -> `FinishDestroy` |

`BeginDestroy` may run on any object at any collection point; other objects it references
may already be gone. Release only your own resources there.

## Keeping objects alive

| Holder | Keeps alive | Use for |
|---|---|---|
| `UPROPERTY() TObjectPtr<UFoo>` | yes | Normal ownership from a UObject |
| `TStrongObjectPtr<UFoo>` | yes | Ownership from a non-UObject (e.g. an `FSubsystem`-adjacent struct) |
| `FGCObject::AddReferencedObjects` | yes | Non-UObject C++ class holding UObjects |
| `AddToRoot()` / `RemoveFromRoot()` | yes | Process-lifetime globals only |
| `TWeakObjectPtr<UFoo>` | no | Back-references, caches, observers |
| Raw `UFoo*` | no | Locals within a single stack frame only |

Containers count: `UPROPERTY() TArray<TObjectPtr<UFoo>>` is tracked; a plain
`TArray<UFoo*>` member is not.

## Common UPROPERTY specifiers

| Specifier | Effect |
|---|---|
| `EditDefaultsOnly` | Editable on the class defaults / Blueprint, not per instance |
| `EditInstanceOnly` | Editable per placed instance only |
| `EditAnywhere` | Both |
| `VisibleAnywhere` | Read-only in the details panel |
| `BlueprintReadOnly` / `BlueprintReadWrite` | Blueprint access |
| `Category="Foo\|Bar"` | Details panel grouping (required for editability) |
| `meta=(AllowPrivateAccess="true")` | Expose a private member to Blueprint |
| `Transient` | Not serialised; zeroed on load |
| `SaveGame` | Included by `FObjectAndNameAsStringProxyArchive` save patterns |
| `Instanced` | Subobject is instanced per owner rather than shared |
| `Replicated` / `ReplicatedUsing=OnRep_Foo` | See `unreal-networking-replication` |
| `meta=(ClampMin/ClampMax/UIMin/UIMax)` | Designer-facing value limits |

## Common UFUNCTION specifiers

| Specifier | Effect |
|---|---|
| `BlueprintCallable` | Callable from Blueprint graphs |
| `BlueprintPure` | No exec pins; must be side-effect free and cheap |
| `BlueprintImplementableEvent` | Declared in C++, implemented only in Blueprint |
| `BlueprintNativeEvent` | C++ `_Implementation` default, overridable in Blueprint |
| `CallInEditor` | Button in the details panel |
| `Server` / `Client` / `NetMulticast` | RPCs (`Reliable`/`Unreliable`, `WithValidation`) |
| `Exec` | Console command (on PlayerController, Pawn, GameMode, HUD, GameInstance) |

## Gameplay Framework ownership

| Class | Exists on | Replicated | Put here |
|---|---|---|---|
| `AGameModeBase` | Server only | No | Rules, spawning, match flow |
| `AGameStateBase` | Server + all clients | Yes | Match state, shared scores, world-level data |
| `APlayerState` | Server + all clients | Yes | Per-player data everyone needs (name, score, team) |
| `APlayerController` | Server + owning client | Partly | Input, UI, camera management, client commands |
| `APawn` / `ACharacter` | Everywhere (relevancy permitting) | Yes | Physical representation, movement |
| `AHUD` | Owning client only | No | Legacy canvas drawing, debug HUD |
| `UGameInstance` | Per process | No | Session-lifetime state across level loads |
| `ULocalPlayer` | Client only | No | Per-local-player (split screen) state |

`AGameMode` (as opposed to `AGameModeBase`) adds match state handling
(`WaitingToStart`/`InProgress`/`WaitingPostMatch`); prefer `AGameModeBase` unless you
need that state machine.

## Subsystems

| Base class | Lifetime | `GetSubsystem` from |
|---|---|---|
| `UGameInstanceSubsystem` | Game instance (survives level loads) | `GameInstance` |
| `UWorldSubsystem` | One per world (recreated per level) | `UWorld` |
| `ULocalPlayerSubsystem` | Per local player | `ULocalPlayer` |
| `UEngineSubsystem` | Process | `GEngine` |
| `UEditorSubsystem` | Editor only | `GEditor` |

```cpp
UCLASS()
class UMyWorldSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()
public:
    virtual bool ShouldCreateSubsystem(UObject* Outer) const override;
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;
};
```

`ShouldCreateSubsystem` is the hook for "only in game worlds, not editor preview worlds"
- check `Cast<UWorld>(Outer)->IsGameWorld()`.

## Delegates

```cpp
// Blueprint-assignable: parameters must be reflected types, handlers need UFUNCTION().
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnHealthChanged, float, NewHealth);

UPROPERTY(BlueprintAssignable, Category="Health")
FOnHealthChanged OnHealthChanged;

// C++ only: faster, no reflection, supports lambdas and non-UObject payloads.
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHealthChangedNative, float);
```

| Binding | Safety |
|---|---|
| `AddDynamic(this, &UMyClass::Handler)` | Dynamic delegates only; `UFUNCTION()` required |
| `AddUObject(this, &UMyClass::Handler)` | Auto-unbinds when the UObject dies |
| `AddSP(SharedThis, ...)` | For `TSharedFromThis` types |
| `AddRaw(this, ...)` | No lifetime safety - avoid in gameplay code |
| `AddLambda([]{})` | No lifetime safety; capture a `TWeakObjectPtr` and check it |

Store the returned `FDelegateHandle` when you need `Remove(Handle)`.

## Tick groups

| Group | Runs |
|---|---|
| `TG_PrePhysics` | Default; before the physics step |
| `TG_StartPhysics` / `TG_DuringPhysics` | Alongside the async physics step |
| `TG_EndPhysics` | After physics, before post-physics work |
| `TG_PostPhysics` | After physics results are available |
| `TG_PostUpdateWork` | Last; camera and final adjustments |

```cpp
PrimaryActorTick.bCanEverTick = true;
PrimaryActorTick.bStartWithTickEnabled = false;   // enable on demand
PrimaryActorTick.TickInterval = 0.2f;             // 5 Hz instead of per frame
PrimaryActorTick.TickGroup = TG_PostPhysics;
```

Use `SetActorTickEnabled(bool)` at runtime, and prefer `FTimerManager` for anything
periodic that does not need frame granularity.
