---
name: unreal-enhanced-input
description: Wire player input with Enhanced Input - Input Actions, Input Mapping Contexts and their priority stack, modifiers and triggers, binding to ETriggerEvent in C++ and Blueprint, per-player mapping through the Enhanced Input local player subsystem, and migrating a project off the legacy action/axis mappings. Use when adding or changing controls, when input fires at the wrong time or not at all, when UI and gameplay fight over the same key, or when a project still uses the deprecated legacy input path.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: unreal
  uad-domain: gamedev
  uad-version: "1.0.0"
  uad-requires: "input-systems"
  uad-tags: "enhanced input, input action, input mapping context, triggers, modifiers, rebinding, legacy input migration"
  uad-maturity: stable
---

# Enhanced Input

## Purpose

Enhanced Input replaced the UE4 action/axis mapping system and is the default
input path from UE 5.1. It moves input from "a name in an ini file" to assets:
an `UInputAction` describes *what* the player wants, an `UInputMappingContext`
maps keys to actions with modifiers and triggers, and contexts are pushed and
popped on a priority stack per local player. Done right, remapping, context
switching (on foot / in vehicle / in menu) and analogue processing become data
rather than code. Done wrong, it produces the classic symptoms: input that fires
twice, input that stops working after opening a menu, or a `Triggered` event
that never arrives.

## When to use

- Adding a new control, or changing what an existing key does.
- Input does not fire, fires on the wrong frame, or fires repeatedly when it
  should fire once.
- A menu opens and gameplay input keeps running underneath it (or vice versa).
- Implementing key rebinding, gamepad support, or per-device sensitivity.
- A project still declares `+ActionMappings=` / `+AxisMappings=` in
  `Config/DefaultInput.ini` and needs to move forward.
- Abilities or vehicle controls need a different set of bindings on the same keys.

## When NOT to use

- What the input *does* once received - `unreal-cpp-gameplay`, or
  `unreal-gameplay-ability-system` when the input activates an ability.
- Widget focus, navigation and UI input routing between UMG and the game -
  `unreal-umg-ui` (the two overlap; `SetInputMode*` and CommonUI live there).
- Replicating player intent to the server - `unreal-networking-replication`.
- AI "input" - `unreal-ai-behavior-trees`.

## Required context

- **Engine version** from the `.uproject` (`unreal-project-conventions`).
  Enhanced Input became default in 5.1 and the rebinding API changed in 5.3.
- **Is the plugin enabled and default?** `EnhancedInput` in the `.uproject`
  plugins, and in `Config/DefaultEngine.ini` under `[/Script/Engine.InputSettings]`:
  `DefaultPlayerInputClass=/Script/EnhancedInput.EnhancedPlayerInput` and
  `DefaultInputComponentClass=/Script/EnhancedInput.EnhancedInputComponent`.
  Without those two lines, `CastChecked<UEnhancedInputComponent>` fails at
  `SetupPlayerInputComponent`.
- **Existing input assets.** Find `IA_*` (`UInputAction`) and `IMC_*`
  (`UInputMappingContext`) in `Content/`. Match the project's naming and
  folder layout rather than inventing a new one.
- **Where contexts are added.** Search for `AddMappingContext` - usually
  `APlayerController::BeginPlay` or the character's `PawnClientRestart`. That is
  the list of contexts you are joining.
- **Whether legacy mappings still exist** in `Config/DefaultInput.ini`. Both
  systems can run simultaneously, which is how "the key does two things" bugs
  appear.
- **Local multiplayer / split screen.** Contexts are per `ULocalPlayer`, so
  anything global-looking is a bug in a split-screen project.

## Version constraints

Read `EngineAssociation` from the `.uproject` first; a GUID means a source build,
so resolve it and read `Engine/Build/Build.version`.

- **UE 5.0** - Enhanced Input shipped as a plugin, off by default.
- **UE 5.1** - becomes the default input system. Legacy action/axis mappings
  still function and are deprecated. Any tutorial using
  `PlayerInputComponent->BindAxis("MoveForward", ...)` is pre-5.1 material.
- **UE 5.3** - **Enhanced Input User Settings** (`UEnhancedInputUserSettings`,
  `FPlayerMappableKeySettings` on the Input Action) is the supported rebinding
  path. The older `UPlayerMappableInputConfig` asset and
  `AddPlayerMappedKey`-style APIs were deprecated. Rebinding code written for
  5.0-5.2 will compile with warnings, then stop compiling. Verify the exact
  class names against the engine you build - this area is the most volatile part
  of the plugin.
- **UE 5.3+** also added the Combo trigger and further trigger types; do not
  assume a trigger exists without checking the Input Action's dropdown in the
  project's editor.
- **UE 5.7** is current at time of writing. The Input Action / Mapping Context /
  priority model described here has been stable since 5.1; the rebinding and
  user-settings surface is the part to verify per version.

## Workflow

1. **Model actions by intent, not by key.** `IA_Move` (Axis2D), `IA_Look`
   (Axis2D), `IA_Jump` (Digital bool), `IA_Interact` (Digital). The Value Type on
   the Input Action must match what you read in the handler - a `Digital` action
   read as `Get<FVector2D>()` returns zero forever with no error.
2. **Create one context per input mode.** `IMC_Default` for on-foot,
   `IMC_Vehicle`, `IMC_Menu`. A context is the unit you push and pop; splitting
   by mode is what makes mode switching a one-line operation.
3. **Add the context through the local player subsystem**, not the player
   controller:
   ```cpp
   if (auto* Sub = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(
           GetController<APlayerController>()->GetLocalPlayer()))
   {
       Sub->AddMappingContext(DefaultContext, /*Priority=*/0);
   }
   ```
   Higher priority wins when two contexts map the same key. Push the menu context
   at a higher priority than gameplay rather than removing the gameplay context.
4. **Bind in `SetupPlayerInputComponent`** on the pawn, or in the controller:
   ```cpp
   auto* EIC = CastChecked<UEnhancedInputComponent>(PlayerInputComponent);
   EIC->BindAction(MoveAction, ETriggerEvent::Triggered, this, &AMyChar::Move);
   EIC->BindAction(JumpAction, ETriggerEvent::Started,   this, &AMyChar::StartJump);
   EIC->BindAction(JumpAction, ETriggerEvent::Completed, this, &AMyChar::StopJump);
   ```
   Handlers take `const FInputActionValue&` (or `const FInputActionInstance&`
   when you need elapsed time).
5. **Pick the right `ETriggerEvent`.** `Triggered` for continuous movement,
   `Started` for "the moment the player pressed it", `Completed` for release,
   `Ongoing`/`Canceled` for held actions that may fail their trigger. Binding
   movement to `Started` gives one frame of motion; binding a jump to `Triggered`
   gives a jump every frame the key is held.
6. **Put processing in modifiers, not in the handler.** `Negate` for inverted
   axes, `Swizzle Input Axis Values` to map W/S onto Y, `Dead Zone` for sticks,
   `Scalar` for sensitivity, `FOV Scaling` for aim. Modifiers are ordered and
   applied top to bottom - the order changes the result.
7. **Use triggers for timing semantics.** `Hold` (with duration), `Tap`,
   `Pressed`, `Released`, `Pulse`, `Chorded Action`. A trigger on the *action*
   applies everywhere; a trigger on the *mapping* applies to that key only.
8. **Switch modes by context, never by unbinding.** Opening a menu: add
   `IMC_Menu` at a higher priority (and, if gameplay must be fully suppressed,
   remove the gameplay context or use the menu context to consume the keys).
   Closing it: `RemoveMappingContext(IMC_Menu)`.
9. **Migrating from legacy input:** create the actions and one context that
   reproduces the current `DefaultInput.ini`, replace `BindAxis`/`BindAction`
   call sites, then delete the legacy entries from `DefaultInput.ini` in the same
   commit. Leaving both live is what causes double-fire.

## Best practices

- Reference Input Actions and Contexts as `UPROPERTY(EditDefaultsOnly,
  Category="Input")` on the pawn or controller so designers can swap them per
  Blueprint, rather than hard-coding asset paths with `LoadObject`.
- Keep priorities as named constants, not magic numbers scattered through the
  code. Three contexts with priorities `0`, `1`, `2` and no explanation becomes
  unmaintainable the moment a fourth appears.
- Bind `Started` and `Completed` as a pair for anything held; the missing
  `Completed` binding is why characters keep sprinting after key release.
- For rebinding, drive everything through `UEnhancedInputUserSettings` (5.3+) and
  mark the actions player-mappable in `FPlayerMappableKeySettings`; do not build
  a parallel remap table.
- Consume input at the right layer: gameplay bindings on the pawn (they die with
  the pawn), persistent bindings (pause, screenshot) on the player controller.
- Set the Input Action's Value Type deliberately and give the action a
  description; the type is invisible at the binding site and mismatches fail
  silently.
- For gamepad and keyboard on the same action, add both key mappings to one
  context rather than duplicating actions - modifiers can differ per mapping.
- Where input drives abilities, bind the action to an ability *input ID* or send
  a gameplay event rather than calling ability code directly
  (`unreal-gameplay-ability-system`).

## Common mistakes

- **Adding the mapping context to the pawn's `BeginPlay` when the pawn is
  possessed later.** The subsystem lookup goes through the controller's local
  player; at `BeginPlay` there may be no controller yet. Use
  `PawnClientRestart`/`SetupPlayerInputComponent`, or the controller's
  `OnPossess`/`BeginPlay`.
- **Reading the wrong value type.** `Value.Get<FVector2D>()` on a Digital action,
  or `Get<bool>()` on an Axis2D. Returns a zero/false with no warning, so it
  reads as "input not firing".
- **Binding movement to `ETriggerEvent::Started`.** The character moves for
  exactly one frame per press. The reverse - a jump on `Triggered` - fires every
  frame the button is held.
- **Leaving legacy `+ActionMappings` in `DefaultInput.ini` during migration.**
  Both systems deliver the input and every action happens twice; the second
  source is invisible in the new assets.
- **Removing the gameplay context to open a menu, then failing to re-add it** on
  every exit path (including death, level transition and controller
  re-possession). The player ends up unable to move with no error anywhere.
- **Assuming contexts are global.** They are per local player. In split screen,
  adding a context for "the player" adds it for one of them.
- **Putting sensitivity multiplication in the handler.** It bypasses the
  modifier stack, so rebinding UI and per-device settings do not see it, and the
  value is applied twice once someone adds a `Scalar` modifier.
- **Forgetting `DefaultInputComponentClass`.** The project runs until the first
  `CastChecked<UEnhancedInputComponent>`, which then crashes with a cast
  assertion that does not mention input settings.

## Validation

- **`showdebug enhancedinput`** in PIE (verify the exact category name in the
  project's engine version - `showdebug` lists available categories). Passing =
  the expected mapping contexts appear in priority order and the action you are
  testing shows a changing value while you hold the key.
- **Context stack check in code:** log the result of
  `UEnhancedInputLocalPlayerSubsystem::HasMappingContext(Context)` when entering
  and leaving each input mode. Passing = the set is exactly what the mode
  requires, and returns to the gameplay-only set on exit.
- **Double-fire check:** put a `UE_LOG` in one handler and press the key once.
  Passing = exactly one log line per press for `Started`, and one per frame only
  for `Triggered`. Two lines per press means either a duplicate mapping or a
  surviving legacy binding.
- **Legacy residue:** `grep -n "ActionMappings\|AxisMappings" Config/DefaultInput.ini`.
  Passing = no results after migration.
- **Rebinding round-trip:** change a key through the user settings, quit PIE,
  relaunch. Passing = the new key persists (settings are saved through
  `UEnhancedInputUserSettings`, not through the mapping context asset).
- **Gamepad parity:** run the same test with a controller. Passing = every action
  reachable on keyboard is reachable on gamepad, and dead zones apply (a
  released stick produces exactly `0`, not a residual drift value).

## References

- [Actions, triggers, modifiers and migration reference](references/REFERENCE.md)
- [Enhanced Input](https://dev.epicgames.com/documentation/en-us/unreal-engine/enhanced-input-in-unreal-engine)
- [Input in Unreal Engine](https://dev.epicgames.com/documentation/en-us/unreal-engine/input-in-unreal-engine)
