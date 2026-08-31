# Gameplay Ability System reference

GAS is a plugin and its API moves faster than the engine core. Verify signatures
against `Plugins/Runtime/GameplayAbilities/Source/GameplayAbilities/Public/` in the
engine the project builds with.

## Module setup

```csharp
// <Module>.Build.cs
PublicDependencyModuleNames.AddRange(new[] {
    "GameplayAbilities", "GameplayTags", "GameplayTasks"
});
```

`GameplayAbilities` must also be enabled in the `.uproject` `Plugins` array, and
`UAbilitySystemGlobals::Get().InitGlobalData()` must be called once at startup - the
conventional place is an override of `UAssetManager::StartInitialLoading()`.

## Core types

| Type | Role |
|---|---|
| `UAbilitySystemComponent` (ASC) | Owns abilities, effects, tags and attribute sets |
| `UAttributeSet` | Declares attributes; one per conceptual group |
| `FGameplayAttributeData` | Base value + current value for one attribute |
| `UGameplayAbility` | One ability: activation, cost, cooldown, tags |
| `FGameplayAbilitySpec` | A granted instance of an ability on an ASC |
| `UGameplayEffect` | The only sanctioned way to change an attribute |
| `FGameplayEffectSpec` | An instantiated effect with level, context and set-by-caller data |
| `FGameplayTag` / `FGameplayTagContainer` | The control vocabulary |
| `UGameplayCueNotify_Static` | Burst cosmetic (fire-and-forget) |
| `AGameplayCueNotify_Actor` | Looping/persistent cosmetic with lifetime |
| `IAbilitySystemInterface` | `GetAbilitySystemComponent()` - implement it on the ASC owner |

## ASC placement and replication mode

| Case | ASC lives on | `SetReplicationMode` |
|---|---|---|
| Player character, MP | `APlayerState` | `Mixed` |
| AI / minion, MP | the `APawn` | `Minimal` |
| Single-player | anywhere | `Full` |

| Mode | Effects replicated to | Tags/cues replicated to |
|---|---|---|
| `Full` | everyone | everyone |
| `Mixed` | owning client only | everyone |
| `Minimal` | nobody | everyone |

`Mixed` requires the ASC owner's ownership chain to resolve to the owning connection;
a PlayerState-owned ASC satisfies this. Set the mode in `BeginPlay`/`PostInitializeComponents`
before any effect is applied.

## Initialisation call sites (ASC on PlayerState)

```cpp
// Server
void AMyCharacter::PossessedBy(AController* NewController)
{
    Super::PossessedBy(NewController);
    if (AMyPlayerState* PS = GetPlayerState<AMyPlayerState>())
    {
        PS->GetAbilitySystemComponent()->InitAbilityActorInfo(PS, this);
    }
}

// Owning client
void AMyCharacter::OnRep_PlayerState()
{
    Super::OnRep_PlayerState();
    if (AMyPlayerState* PS = GetPlayerState<AMyPlayerState>())
    {
        PS->GetAbilitySystemComponent()->InitAbilityActorInfo(PS, this);
    }
}
```

Both are required. Re-run them after respawn/possession changes.

## Attribute set skeleton

```cpp
UCLASS()
class UMyAttributeSet : public UAttributeSet
{
    GENERATED_BODY()
public:
    UPROPERTY(BlueprintReadOnly, ReplicatedUsing=OnRep_Health, Category="Vitals")
    FGameplayAttributeData Health;
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, Health)   // project-local macro

    virtual void PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue) override;
    virtual void PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& Out) const override;

protected:
    UFUNCTION() void OnRep_Health(const FGameplayAttributeData& Old)
    { GAMEPLAYATTRIBUTE_REPNOTIFY(UMyAttributeSet, Health, Old); }
};
```

`ATTRIBUTE_ACCESSORS` is copied from Epic's samples into the project, not provided by
the plugin. Find the project's definition before using the name.

| Hook | Runs | Use for |
|---|---|---|
| `PreAttributeChange` | before any current-value change | clamping the current value |
| `PreAttributeBaseChange` | before a base-value change | clamping the base |
| `PostGameplayEffectExecute` | after an **instant** effect executes | reacting: death, consuming meta attributes |
| `PreGameplayEffectExecute` | before an instant effect executes | vetoing (`return false`) |

Duration and infinite effects do not call `PostGameplayEffectExecute`; they modify the
current value each frame the aggregator re-evaluates.

## GameplayEffect duration types

| Type | Behaviour | Typical use |
|---|---|---|
| `Instant` | changes the **base** value once | damage, healing, resource spend |
| `HasDuration` | modifies the **current** value for N seconds | timed buffs, cooldowns |
| `Infinite` | modifies the current value until removed | equipment, auras, stances |

Periodic effects (`Period > 0`) execute like instants on each tick, so they *do* hit
`PostGameplayEffectExecute`. Stacking is configured per effect
(`Aggregate by Source` / `Aggregate by Target`, stack limit, duration refresh policy).

## Ability configuration

| Setting | Options / meaning |
|---|---|
| `InstancingPolicy` | `InstancedPerActor` (default choice), `InstancedPerExecution`; `NonInstanced` deprecated in UE 5.5 |
| `NetExecutionPolicy` | `LocalOnly`, `LocalPredicted`, `ServerInitiated`, `ServerOnly` |
| `NetSecurityPolicy` | Controls which side may request activation/cancellation |
| `AbilityTags` | Identity of this ability |
| `CancelAbilitiesWithTag` | Cancels others on activation |
| `BlockAbilitiesWithTag` | Blocks others while active |
| `ActivationOwnedTags` | Tags the owner has while this is active |
| `ActivationRequiredTags` / `ActivationBlockedTags` | Gate activation |
| `CostGameplayEffectClass` / `CooldownGameplayEffectClass` | Resource and cooldown effects |

## Ability tasks

| Task | Waits for |
|---|---|
| `UAbilityTask_PlayMontageAndWait` | montage completion/blend-out/interrupt |
| `UAbilityTask_WaitDelay` | a timer |
| `UAbilityTask_WaitGameplayEvent` | a `FGameplayEventData` sent via `SendGameplayEventToActor` |
| `UAbilityTask_WaitTargetData` | a targeting actor to produce target data |
| `UAbilityTask_WaitAttributeChange` | an attribute crossing a value |
| `UAbilityTask_WaitGameplayTagAdded/Removed` | a tag change |

Tasks are cancelled automatically when the ability ends - which is why every exit path
must call `EndAbility`.

## Prediction, briefly

`LocalPredicted` abilities run immediately on the owning client under a
`FPredictionKey`, and the server replays them. Predicted work that the server rejects is
rolled back. Predictable: ability activation, applying predicted gameplay effects,
playing montages, firing cues, spawning predicted projectiles via the appropriate
targeting path. Not predictable: anything derived from server-only state, authoritative
random rolls, or spawning actors that must be authoritative.

`FScopedPredictionWindow` is used inside the ability/ASC when applying changes that must
share a prediction key. If you find yourself constructing prediction keys by hand,
re-read the flow first - most needs are covered by ability tasks.

## Native tags

```cpp
// Header
UE_DECLARE_GAMEPLAY_TAG_EXTERN(TAG_State_Stunned);
// Source
UE_DEFINE_GAMEPLAY_TAG(TAG_State_Stunned, "State.Debuff.Stunned");
```

Tags added through the editor land in `Config/DefaultGameplayTags.ini`. Cue notify search
paths live in `Config/DefaultGame.ini` under
`[/Script/GameplayAbilities.AbilitySystemGlobals]` as `+GameplayCueNotifyPaths`.

## Debugging

| Tool | What it shows |
|---|---|
| `showdebug abilitysystem` | granted abilities, active effects, owned tags, attribute values |
| `Page Up` / `Page Down` | cycle the debug pages while `showdebug` is active |
| `AbilitySystem.Debug.NextTarget` / `PrevTarget` | switch the inspected actor (verify names per version) |
| Gameplay Debugger (`'`) | category view including abilities on the selected actor |
| `NetEmulation.PktLag 150` | expose prediction and rollback problems |
| PIE Net Mode "Play As Client" | the only mode that catches missing client-side init |
