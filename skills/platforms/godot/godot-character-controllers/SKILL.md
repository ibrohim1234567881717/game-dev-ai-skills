---
name: godot-character-controllers
description: Building and debugging character movement in Godot with CharacterBody2D and CharacterBody3D - move_and_slide, floor detection, slopes and steps, movement state machines, and the frame-rate and collision bugs that controllers commonly have. Use when creating a player controller, when movement feels wrong, or when a character sticks, slides, jitters or falls through geometry.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: godot
  uad-domain: gamedev
  uad-version: "1.0.0"
  uad-requires: "input-systems, gameplay-systems, root-cause-debugging"
  uad-tags: "godot, characterbody, move_and_slide, movement, controller, slope, floor, jitter, physics process, jump"
  uad-maturity: stable
---

# Godot Character Controllers

## Purpose

The character controller is usually the first substantial thing built in a Godot
project and the first place the Godot 3 / Godot 4 split causes real damage:
almost every tutorial and answer online predates Godot 4, and the movement API
changed shape entirely.

This skill covers building one correctly for the version the project actually
uses, and diagnosing the specific bugs controllers get.

## When to use

- Building a player or NPC movement controller.
- Movement feels wrong — floaty, sticky, unresponsive, or inconsistent.
- The character jitters, sticks on slopes, snags on steps, or falls through
  geometry.
- Behaviour differs between machines or frame rates.
- Refactoring a controller that has become a pile of boolean flags.

## When NOT to use

- Physics bodies that should be simulated rather than driven. A
  `CharacterBody` is *kinematic*: you move it, physics does not. Use
  `godot-physics` for `RigidBody` behaviour.
- Input mapping and rebinding. Use `godot-project-conventions` and
  `input-systems`.
- Navigation-driven AI movement. Use `godot-navigation-ai`.
- Networked movement authority. Use `godot-multiplayer` and
  `client-server-trust`.

## Required context

| Fact | Why it matters | Where to find it |
|---|---|---|
| **Godot major version** | The movement API is completely different between 3.x and 4.x | `config_version` in `project.godot` |
| Minor version within 4.x | Physics behaviour has changed; Jolt became the default 3D engine in 4.6 | `config/features` |
| 2D or 3D | Different node types and different floor semantics | The scene |
| Intended feel | "Wrong" is only definable against an intent | The design |
| Whether movement is networked | Constrains where it may be simulated | The architecture |

## Version constraints

**This is the skill where mixing versions does the most damage.** The two APIs
look similar enough to blend and do not work when blended:

| Concern | Godot 3.x | Godot 4.x |
|---|---|---|
| Node | `KinematicBody` / `KinematicBody2D` | `CharacterBody3D` / `CharacterBody2D` |
| Velocity | A local variable you pass in | A `velocity` **property** on the node |
| Move call | `move_and_slide(velocity, UP)` | `move_and_slide()` — **no arguments** |
| Result | Returns the resulting velocity | Returns a `bool`; reads `velocity` |
| Floor check | `is_on_floor()` | `is_on_floor()` (same name, different setup) |
| Up direction | Passed per call | `up_direction` property, or the inspector |
| Coroutine | `yield()` | `await` |
| Export | `export var speed = 300` | `@export var speed: float = 300.0` |

Read `config_version` from `project.godot` first: **5 means Godot 4.x, 4 means
Godot 3.x**. If a code sample passes a velocity argument to `move_and_slide()`,
it is Godot 3 code and will not work in a Godot 4 project.

Within 4.x, physics behaviour on slopes and steps has changed across minor
versions, and 4.6 made Jolt the default 3D physics engine. Check
`config/features` before assuming a specific behaviour.

## Workflow

1. **Establish the version.** `config_version` in `project.godot`. Everything
   below assumes Godot 4.x; for 3.x, use the 3.x column above and say so
   explicitly in anything you write.

2. **Move in `_physics_process`, never `_process`.** `_physics_process` runs at
   a fixed timestep, which is what physics queries and collision resolution
   expect. Movement in `_process` is frame-rate dependent: the character moves
   faster on a faster machine, and collision behaviour becomes inconsistent.
   This is the most common cause of "it behaves differently on my friend's PC".

3. **Structure the controller as a state machine**, not a set of booleans.
   Idle, walking, falling, jumping, dashing, stunned — with defined transitions.
   `is_grounded and not is_dashing and not is_stunned` is an undesigned state
   machine, every combination is reachable, and most were never considered. See
   `gameplay-systems`.

4. **Write the movement loop in the shape Godot 4 expects:**

   ```gdscript
   extends CharacterBody2D

   @export var speed: float = 300.0
   @export var jump_velocity: float = -400.0

   func _physics_process(delta: float) -> void:
       if not is_on_floor():
           velocity += get_gravity() * delta

       if Input.is_action_just_pressed("jump") and is_on_floor():
           velocity.y = jump_velocity

       var direction := Input.get_axis("move_left", "move_right")
       if direction:
           velocity.x = direction * speed
       else:
           velocity.x = move_toward(velocity.x, 0.0, speed)

       move_and_slide()
   ```

   Note what is happening: `velocity` is a property that persists between
   frames, `move_and_slide()` takes no arguments and updates `velocity` itself,
   and gravity is applied per-frame scaled by `delta`.

   Confirm the gravity accessor in your minor version — how gravity is obtained
   has changed across 4.x releases, and this is exactly the kind of detail worth
   checking rather than assuming.

5. **Configure floor behaviour deliberately.** `floor_max_angle` decides what
   counts as ground rather than a wall — a character sliding down a ramp that
   should be walkable usually means this is too low. `floor_snap_length` keeps
   the character attached when going down slopes, which is what stops the
   "launching off the top of a ramp" effect. `floor_stop_on_slope` decides
   whether the character slides when standing still on an incline.

6. **Give jumping the forgiveness players expect.** Coyote time (a short window
   after leaving ground where a jump still works) and jump buffering (a jump
   pressed slightly before landing is honoured). Without these, players report
   the game "eating inputs" and the controls feeling unresponsive — and the
   cause is almost never actual input latency. See `input-systems`.

7. **Set collision layers and masks explicitly.** Defaults put everything on
   layer 1, which means everything collides with everything, and this surfaces
   later as a character catching on things it should ignore.

8. **Debug with the visible collision shapes on.** *Debug → Visible Collision
   Shapes* answers most controller questions immediately: a capsule that is
   wider than expected, a shape offset from the sprite, or a floor collider with
   a gap.

## Best practices

- **Type your GDScript.** Typed code catches real errors and runs faster; in a
  controller that runs every physics frame, both matter.
- **Export the tuning values** so movement can be tuned in the inspector without
  a code change. Speed, acceleration, friction, jump height, coyote time.
- **Prefer a capsule collider** for characters; boxes catch on step edges and
  produce most "snagging" reports.
- **Separate intent from motion.** Read input into a direction, then apply it.
  It makes the controller reusable for AI and testable without input.
- **Keep the state machine inspectable** — a debug label showing the current
  state and last transition pays for itself immediately.
- **Tune by playing**, not by reasoning. Controller feel is not derivable.
- **Test at several frame rates**, including a deliberately capped low one.

## Common mistakes

- **Mixing Godot 3 and Godot 4 movement code.** The single most damaging
  mistake here, and the most common, because the internet is full of 3.x
  answers. Passing a velocity to `move_and_slide()` is the giveaway.
- **Moving in `_process`.** Frame-rate dependent movement and inconsistent
  collisions.
- **Forgetting `delta` on gravity or acceleration**, making behaviour
  frame-rate dependent in a subtler way.
- **Boolean soup instead of a state machine.**
- **`floor_max_angle` too low**, so walkable slopes are treated as walls.
- **No floor snapping**, so the character launches off downward slopes.
- **A box collider on a character**, catching on every step edge.
- **No coyote time or jump buffering**, then hunting for input latency that is
  not there.
- **Default collision layers**, so everything collides with everything.
- **Calling `move_and_slide()` more than once per physics frame**, which
  double-applies motion.
- **Client-authoritative movement in a networked game.**

## Validation

- **Version check:** `grep -n "config_version" project.godot` → 5 for Godot 4.
  Then confirm the controller uses the matching API: `grep -rn "move_and_slide"`
  should show no arguments passed.
- **Frame-rate independence:** run with the frame rate capped low
  (`Engine.max_fps`) and uncapped, and confirm the character covers the same
  distance in the same time. Failing this means `delta` is missing somewhere or
  movement is in `_process`.
- **Slope test:** walk up and down slopes at and around `floor_max_angle`.
  No sliding on walkable ground, no launching at the crest.
- **Step test:** walk into steps at the intended maximum height — no snagging.
- **Geometry test:** run at full speed into thin walls and corners; the
  character must not pass through. If it does, check the collision shape and
  consider the physics engine's continuous detection options.
- **Jump feel:** press jump one frame after leaving a ledge (coyote time) and
  one frame before landing (buffering) — both should work.
- **State machine:** the debug display shows exactly one state at a time, and no
  illegal transition is reachable.
- Visible Collision Shapes on, and the shape matches the visual.

## References

- Related platform skills: `godot-project-conventions`, `godot-physics`,
  `godot-gdscript-patterns`, `godot-navigation-ai`
- Related core skills: `input-systems`, `gameplay-systems`,
  `root-cause-debugging`
