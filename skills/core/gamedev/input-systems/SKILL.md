---
name: input-systems
description: Structuring player input - separating raw device events from game actions, supporting multiple device types and rebinding, handling context switches between gameplay and UI, and input buffering and responsiveness. Use when setting up input for a project, adding controller or touch support, implementing rebinding, or when controls feel unresponsive or fire in the wrong context.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: gamedev
  uad-version: "1.0.0"
  uad-requires: "game-architecture"
  uad-tags: "input, controls, rebinding, controller, gamepad, touch, input buffering, action mapping, accessibility"
  uad-maturity: stable
---

# Input Systems

## Purpose

Input is where players touch the game, and it is routinely built as the most
throwaway part of a codebase: raw key checks scattered through gameplay code.
That structure makes controller support a rewrite, rebinding impossible, and
context bugs — the pause menu accepting a jump input — inevitable.

The fix is one idea: **gameplay code responds to *actions*, never to devices.**

## When to use

- Setting up input at the start of a project.
- Adding controller, touch, or a second device type to something built for one.
- Implementing rebinding or accessibility options.
- Controls feel unresponsive, or inputs are dropped.
- Input fires in the wrong context — gameplay reacting while a menu is open.

## When NOT to use

- Camera control specifically, beyond input reading. That is a gameplay and
  feel problem in its own right.
- Networked input transmission. Use `multiplayer-networking`; a client sends
  input as a request, and the server validates it.
- Engine-specific configuration. Use the platform skill —
  `unreal-enhanced-input`, `unity-input-system`, `godot-project-conventions`,
  `roblox-character-systems`.

## Required context

| Fact | Why it matters |
|---|---|
| Which devices must be supported | Keyboard, gamepad, touch and motion have different shapes |
| Whether rebinding is required | If yes, the action layer is mandatory rather than merely wise |
| Platform certification requirements | Consoles have mandatory input and accessibility requirements |
| Whether the game is networked | Input becomes a request to validate rather than a local truth |
| The engine's input system and version | Legacy and modern systems coexist in most engines |

## Version constraints

Most engines carry two input systems: an older direct-polling API and a newer
action-based one, both present and both documented. Which one a project uses is
a project fact to establish, not a preference — mixing them causes inputs to be
consumed twice or not at all. Check what the project already uses before writing
any input code, and check the engine version, since the newer systems have
changed API across releases.

## Workflow

1. **Define actions, not keys.** `Jump`, `Interact`, `MoveHorizontal`,
   `ConfirmMenu`. Gameplay code asks whether `Jump` was triggered; it never asks
   whether the space bar is down. This single separation is what makes
   everything else possible.

2. **Map devices to actions in data**, outside code. A binding table that can be
   edited, serialised and replaced is what makes rebinding, control schemes and
   per-platform defaults possible without touching gameplay.

3. **Model input contexts as an explicit stack.** Gameplay, menu, dialogue,
   cutscene, vehicle. Only the top context receives input, and each declares
   what it consumes. This is the fix for the entire class of bug where a menu is
   open and the character still moves — and doing it with scattered boolean
   checks never fully works.

4. **Distinguish the event shapes.** Pressed, released, held, and analogue value
   are different queries and must not be conflated. Double-tap, hold-to-confirm
   and charge inputs are compositions built on top, ideally in the input layer
   rather than in each gameplay system.

5. **Handle device switching.** Players change device mid-session, and the UI
   must follow: prompts showing keyboard keys while the player holds a gamepad
   is a common and cheap-to-fix failure. Detect the active device and drive
   prompt glyphs from it.

6. **Buffer input for responsiveness.** An input arriving a few frames before an
   action becomes legal — a jump pressed just before landing — should usually be
   honoured. Input buffering and coyote time are what separate controls that
   feel tight from controls that feel like they drop inputs. This is a
   *feel* feature, and it is worth deliberate tuning.

7. **Support rebinding properly**, including conflict detection, a reset to
   defaults, and persistence. Provide accessibility options: toggle versus hold,
   sensitivity, dead zones, and no input requiring simultaneous presses that
   cannot be rebound.

8. **Validate on the server if networked.** Client input is a request. See
   `client-server-trust`.

## Best practices

- **Never read a device directly in gameplay code.** If a gameplay script names
  a key, the abstraction has already been bypassed and the next device is a
  rewrite.
- **Keep the binding data serialisable** so it can be saved, shipped per
  platform, and edited by players.
- **Drive UI prompts from the active device**, automatically.
- **Set dead zones deliberately** and let players adjust them; controllers vary
  and drift.
- **Test with each supported device**, including hot-swapping mid-session.
- **Tune buffering and coyote time by feel**, with real playtesting; the right
  values are small and make a large perceptual difference.
- **Treat accessibility options as requirements**, not extras. Several are
  mandatory for console certification.
- **Handle focus loss.** A held key when the window loses focus must not stay
  held forever.

## Common mistakes

- **Raw key checks scattered through gameplay code.** Guarantees that controller
  support, rebinding and context handling all become rewrites.
- **Booleans instead of an input context stack.** Menus and gameplay receive
  input simultaneously; every combination is a bug.
- **Hard-coded bindings** with no data layer.
- **Ignoring device switching**, leaving prompts showing the wrong glyphs.
- **No input buffering.** Players report dropped inputs and unresponsive
  controls, and the cause is rarely identified as buffering.
- **Mixing the engine's legacy and modern input systems.** Inputs consumed
  twice, or silently not at all.
- **No dead zone handling.** Drifting controllers move the character
  continuously.
- **Rebinding without conflict detection**, letting players create unusable
  configurations with no reset.
- **Not handling focus loss**, leaving inputs stuck.
- **Trusting client input in a networked game.**

## Validation

- Grep the gameplay code for direct device or key references; there should be
  none outside the input layer. This is the single most informative check.
- Every action is reachable on every supported device.
- Rebinding works, detects conflicts, persists across sessions, and can be reset.
- Opening a menu stops gameplay input immediately and completely; test by
  holding a movement input while opening it.
- Hot-swapping device mid-session updates prompts without a restart.
- Input buffering verified by pressing an action slightly early — it should be
  honoured within the buffer window and ignored outside it.
- Losing and regaining window focus while holding an input leaves no stuck state.
- Dead zones adjustable; a drifting controller does not move the character.
- Accessibility options present: toggle/hold, sensitivity, and no unrebindable
  simultaneous-press requirement.

## References

- Related core skills: `game-architecture`, `gameplay-systems`,
  `game-ui-architecture`, `multiplayer-networking`, `client-server-trust`
- Platform applications: `unreal-enhanced-input`, `unity-input-system`
