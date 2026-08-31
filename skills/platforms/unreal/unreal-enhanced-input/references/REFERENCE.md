# Enhanced Input reference

Detail that would bloat `SKILL.md`. Everything here is version-sensitive:
Enhanced Input has changed across UE 5.x releases, and class names, defaults and
available trigger types are not guaranteed to match your engine. **Confirm
against the engine version in your `.uproject` before relying on any specific
name below.**

## The object model

| Object | What it is |
|---|---|
| **Input Action** (`UInputAction`) | An abstract action — `IA_Jump`, `IA_Move`. Carries a value type, not a key. |
| **Input Mapping Context** (`UInputMappingContext`) | A set of key-to-action bindings, added to a player with a priority. |
| **Trigger** | Decides *when* an action fires from a raw input. |
| **Modifier** | Transforms the raw value *before* triggers evaluate it. |
| **Enhanced Input Subsystem** | Per-local-player subsystem that owns the active context stack. |

The value type on an Input Action is the part most often set wrong. It must
match how gameplay consumes it:

| Value type | Use for |
|---|---|
| `Digital (bool)` | Buttons: jump, interact, fire |
| `Axis1D (float)` | Triggers, single-axis movement, scroll |
| `Axis2D (Vector2D)` | Stick movement, mouse look, WASD composed into one action |
| `Axis3D (Vector)` | Rare; motion controls, 3D directional input |

A 2D movement action bound to WASD needs the keys composed into one Axis2D
binding rather than four separate actions — that composition is what makes
gamepad and keyboard produce the same action shape.

## Mapping contexts and priority

Contexts are added to the subsystem with an integer priority. A higher-priority
context can consume an input so lower ones never see it, which is the mechanism
that replaces scattered `bIsInMenu` checks.

A workable structure:

| Context | Priority | Added when |
|---|---|---|
| `IMC_Gameplay` | 0 | Player possesses a pawn |
| `IMC_Vehicle` | 1 | Entering a vehicle |
| `IMC_Menu` | 10 | A menu opens |
| `IMC_Cutscene` | 20 | A cutscene starts |

Add and remove contexts as state changes rather than adding everything at
startup and gating with booleans. If input reaches gameplay while a menu is
open, the usual cause is a context that was never removed, or a menu context
whose priority does not exceed gameplay's.

Contexts live on the **local player subsystem**, so in split-screen each local
player has an independent stack. Adding a context to the wrong local player is a
common split-screen bug.

## Triggers

Triggers decide when an action fires. Several on one binding are evaluated
together; the exact combination semantics have varied between engine versions,
so verify behaviour rather than assuming.

| Trigger | Fires when |
|---|---|
| **Down** | The input is held (fires continuously) |
| **Pressed** | On the transition to actuated |
| **Released** | On the transition to released |
| **Hold** | After being held for a configured duration |
| **Hold And Release** | On release, if held long enough |
| **Tap** | On release, if released within a short window |
| **Pulse** | Repeatedly at an interval while held |
| **Chorded Action** | Only while another action is active — modifier-key combinations |

With no explicit trigger, a digital action behaves as **Down**, firing every
frame while held. This surprises people who expected a single fire on press and
is a frequent cause of "my ability triggers dozens of times".

Triggers report a state — `Triggered`, `Started`, `Ongoing`, `Completed`,
`Canceled` — and binding to the wrong one is the other common source of
double-fire and never-fire bugs. `Triggered` is what most gameplay wants;
`Started` and `Completed` are for beginning and ending a continuous action.

## Modifiers

Modifiers transform the raw value before triggers see it. Order matters — they
apply in sequence.

| Modifier | Effect |
|---|---|
| **Negate** | Inverts. Used to build a −1/+1 axis from two keys (S negated against W). |
| **Swizzle Input Axis Values** | Reorders axes, e.g. mapping a 1D input onto Y instead of X |
| **Dead Zone** | Removes stick drift near centre; configurable shape |
| **Scalar** | Multiplies — sensitivity |
| **Smooth** | Smooths values over time |
| **Response Curve (Exponential)** | Non-linear response for finer control near centre |
| **FOV Scaling** | Scales look input by field of view, for aim consistency when zoomed |

Building WASD movement as a single Axis2D action typically means four bindings
on one action: W plain, S with Negate, A with Swizzle + Negate, D with Swizzle.
Getting the swizzle or negate order wrong produces movement that is rotated or
mirrored — check this first when movement goes the wrong way.

## Migrating from the legacy input system

The legacy system used project-settings Action and Axis Mappings bound by name
in `SetupPlayerInputComponent`. Do not run both systems for the same input:
inputs get consumed twice or not at all, and the resulting bugs are hard to
attribute.

A workable order:

1. Enable the Enhanced Input plugin and set the Enhanced Input classes as the
   default input classes in project settings. Confirm the exact setting names in
   your engine version.
2. Create Input Actions for each legacy mapping, choosing the correct value type.
   Legacy axis pairs usually collapse into one Axis2D action.
3. Create a mapping context per input state; do not put everything in one.
4. Add the context in the pawn or controller when the player takes control, via
   the local player subsystem.
5. Rebind in `SetupPlayerInputComponent` using the Enhanced Input component,
   binding to `Triggered` unless you specifically need another event.
6. Remove the legacy mappings and the old bindings once each action is migrated.
7. Test with keyboard and gamepad, and test hot-swapping between them.

Migrate one action at a time and verify each, rather than converting everything
and debugging the result — the failure modes are hard to tell apart.

## Diagnosing common failures

| Symptom | Usual cause |
|---|---|
| Action fires every frame | No explicit trigger (defaults to Down), or bound to `Ongoing` |
| Action never fires | Context not added, priority too low, or input consumed by a higher context |
| Fires twice | Legacy and Enhanced Input both bound, or bound to two trigger events |
| Movement rotated or mirrored | Swizzle or Negate modifiers in the wrong order |
| Works on keyboard, not gamepad | Missing gamepad binding, or dead zone consuming the input |
| Stick drifts the character | No Dead Zone modifier |
| Input works in editor, not in a packaged build | Plugin not enabled for the build, or context added in editor-only code |
| Only player 1 responds in split-screen | Context added to the wrong local player subsystem |

## Verifying at runtime

- `showdebug enhancedinput` displays the active contexts and actions. Confirm the
  command exists in your engine version; console command names change.
- The Enhanced Input debug view shows which context consumed an input, which is
  the fastest way to diagnose a priority problem.
- Log the action value on trigger while diagnosing value-type or modifier issues —
  a value that is a bool when you expected a Vector2D is immediately visible.
