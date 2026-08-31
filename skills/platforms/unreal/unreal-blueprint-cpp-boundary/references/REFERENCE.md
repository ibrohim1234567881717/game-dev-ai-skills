# Blueprint exposure reference

Specifier availability changes between engine versions. Confirm anything unfamiliar
against `Runtime/CoreUObject/Public/UObject/ObjectMacros.h` in the engine the project
actually builds with.

## Choosing the override mechanism

| Mechanism | C++ body | Blueprint may override | Use when |
|---|---|---|---|
| `UFUNCTION(BlueprintImplementableEvent)` | none allowed | yes (only place it can be implemented) | Pure designer hook, no default behaviour |
| `UFUNCTION(BlueprintNativeEvent)` | `Foo_Implementation()` | yes | Default behaviour in C++, designers may replace |
| `UFUNCTION(BlueprintCallable)` | normal | no | Designers call it, cannot change it |
| plain `virtual` | normal | no | C++-only extension point (cheapest dispatch) |

For `BlueprintNativeEvent`, C++ subclasses override `Foo_Implementation`, and callers
call `Foo()`. Overriding `Foo()` itself silently does nothing.

```cpp
UFUNCTION(BlueprintNativeEvent, Category="Combat")
void OnDamaged(float Amount);
virtual void OnDamaged_Implementation(float Amount);   // C++ default

UFUNCTION(BlueprintImplementableEvent, Category="Combat")
void OnCosmeticHitReaction(const FHitResult& Hit);      // no C++ body
```

## UFUNCTION specifiers that matter at the boundary

| Specifier | Effect |
|---|---|
| `BlueprintCallable` | Exec-pin node in graphs |
| `BlueprintPure` | No exec pins; **re-runs per output pin read** - must be cheap and side-effect free |
| `BlueprintAuthorityOnly` | Node compiles out where there is no authority |
| `BlueprintCosmetic` | Skipped on dedicated servers |
| `meta=(DisplayName="...")` | Node title designers see |
| `meta=(WorldContext="WorldContextObject")` | Lets a static/library function resolve the world |
| `meta=(DefaultToSelf="Target")` | Auto-wires `self` into a pin |
| `meta=(ExpandEnumAsExecs="ReturnValue")` | Turns an enum result into multiple exec outputs |
| `meta=(DeterminesOutputType="Class")` | Returns a typed pin from a class input, avoiding a cast |
| `meta=(AutoCreateRefTerm="Tags")` | Lets a by-ref parameter be left unconnected |
| `meta=(AdvancedDisplay="3")` | Hides pins past index 3 behind the arrow |
| `meta=(DeprecatedFunction, DeprecationMessage="...")` | Compile warning in every Blueprint still calling it |
| `meta=(BlueprintProtected)` | Callable only from subclasses' graphs |

## UPROPERTY exposure ladder

Widen only when there is a reason.

| Declaration | Designer can |
|---|---|
| `UPROPERTY()` | nothing (reflection/GC only) |
| `UPROPERTY(VisibleAnywhere, BlueprintReadOnly)` | inspect |
| `UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)` | tune on the class/Blueprint defaults |
| `UPROPERTY(EditInstanceOnly)` | tune per placed instance only |
| `UPROPERTY(EditAnywhere, BlueprintReadWrite)` | change anything, any time |

Useful metadata: `meta=(ClampMin="0.0", ClampMax="1.0", UIMin, UIMax)`,
`meta=(AllowPrivateAccess="true")`, `meta=(EditCondition="bUseFalloff")`,
`meta=(AllowedClasses="StaticMesh")`, `meta=(Categories="Ability.Damage")` on
`FGameplayTag` properties.

## Class-level exposure

| Specifier | Effect |
|---|---|
| `UCLASS(Blueprintable)` | Blueprint subclasses may be created |
| `UCLASS(BlueprintType)` | Usable as a variable/pin type |
| `UCLASS(Abstract)` | Cannot be placed or instantiated directly |
| `UCLASS(meta=(BlueprintSpawnableComponent))` | Component appears in the Add Component list |
| `USTRUCT(BlueprintType)` | Struct usable in graphs; members need `UPROPERTY` |
| `UENUM(BlueprintType)` | Enum usable in graphs; must be `uint8`-based |

## Events instead of polling

```cpp
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnHealthChanged, float, NewHealth);

UPROPERTY(BlueprintAssignable, Category="Health")
FOnHealthChanged OnHealthChanged;
```

Designers bind this in the Event Graph instead of comparing a value on Tick. Most
Blueprint tick graphs exist only because no event was exposed.

## Cost model, roughly

| Operation | Relative cost |
|---|---|
| C++ call | baseline |
| Blueprint node (VM instruction) | ~an order of magnitude worse per node |
| Blueprint -> C++ `BlueprintCallable` call | VM dispatch + the function's own cost |
| `BlueprintPure` node read N output pins | N executions |
| `Cast<>` node | reflection type check, plus a hard asset reference |

Numbers vary by engine version and platform - measure with Unreal Insights rather than
quoting a multiplier. The structural points (per-node overhead, pure re-evaluation,
casts creating references) do not change.

## Source control reality

| Artifact | Diffable | Mergeable |
|---|---|---|
| `.h` / `.cpp` | yes | yes |
| `.uasset` (Blueprint) | in-editor Diff tool only | only trivial cases, via the editor Merge tool |
| `.umap` | in-editor only | no - use One File Per Actor (`unreal-world-partition-streaming`) |

Blueprint diffs cannot be reviewed in a pull request. Anything that needs code review
needs to be code.

## Migrating a Blueprint to C++

1. Create the C++ class deriving from the Blueprint's *current* parent.
2. Move variables first, as `UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)`, matching
   names exactly.
3. Reparent the Blueprint: *Class Settings > Parent Class*. Values with matching names
   and types carry over; check every one.
4. Move logic one function at a time, replacing the graph with a call to the new C++
   function; test between each step.
5. Keep the Blueprint as the placeable/spawnable class so existing level references and
   designer defaults survive.

Never delete and re-create the Blueprint - every level reference and every placed
instance points at the old asset path.
