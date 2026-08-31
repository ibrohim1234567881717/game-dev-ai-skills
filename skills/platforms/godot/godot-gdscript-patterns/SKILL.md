---
name: godot-gdscript-patterns
description: Idiomatic GDScript 2.0 for Godot 4 - static typing, the @export, @onready and @tool annotations, node lifecycle callbacks, signals as first-class objects, await, class_name registration, lambdas and typed collections. Use when writing or reviewing .gd files, when porting Godot 3 GDScript, or when deciding between get_node, @onready and dependency injection. Explicitly separates Godot 4 syntax from the Godot 3 forms that look similar and fail.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: godot
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "godot-project-conventions, software-architecture, refactoring-safely"
  uad-tags: "gdscript, static typing, annotations, await, signals, lifecycle, class_name"
  uad-maturity: stable
---

# GDScript Patterns

## Purpose

GDScript 2.0 shipped with Godot 4 and is a different language from GDScript 1.x
in Godot 3: annotations replaced keyword exports, `await` replaced `yield`,
signals became objects rather than strings, and the static type system became
strong enough to change performance. This skill gives the idioms that make
GDScript fast, refactorable and diff-friendly, and marks every place where a 3.x
form would look plausible and be wrong.

## When to use

- Writing any new `.gd` file, or editing an existing one.
- Reviewing GDScript for typing, lifecycle or signal-handling problems.
- Porting a tutorial, snippet or Godot 3 script into a Godot 4 project.
- Deciding how a node should reach its collaborators.
- Chasing "Invalid call. Nonexistent function" or "Cannot call method on a null
  value" errors that appear only at runtime.

## When NOT to use

- Scene-tree architecture and node ownership questions — `godot-scene-composition`.
- Signal topology, event buses and decoupling strategy — `godot-signals-events`.
- C# equivalents and cross-language interop — `godot-csharp-integration`.
- `@tool` scripts intended to extend the editor UI — `godot-editor-plugins`.
  (`@tool` basics are covered here; editor plugin structure is not.)

## Required context

- **Major version.** `config_version` in `project.godot`. Everything below is
  Godot 4 unless labelled `3.x`. Establish this via `godot-project-conventions`
  first.
- **Minor version.** `config/features`. Typed dictionaries need 4.4+.
- **Existing style.** Read two or three `.gd` files in the project. Does it use
  static types everywhere, on function signatures only, or nowhere? Match it;
  a half-typed codebase is worse than a consistently untyped one.
- **Class registrations.** `grep -rn '^class_name' --include='*.gd' .` lists
  the project's global types. Reuse them rather than duplicating.
- **Whether `debug/gdscript/warnings/untyped_declaration` is raised** in
  `project.godot`; some projects enforce typing as an error.

## Version constraints

- **GDScript 2.0 (Godot 4.x) is assumed.** Annotations (`@export`, `@onready`,
  `@tool`) all carry the `@`. `await` replaces `yield`. Signals are objects:
  `hit.emit(x)`, `hit.connect(callable)`.
- **Godot 3.x GDScript 1.x** uses `export(int) var`, `onready var`, bare `tool`,
  `yield(obj, "sig")`, `emit_signal("sig", x)`, and
  `connect("sig", self, "_method")`. None of it parses in 4.x. Do not mix.
- `Dictionary[String, int]` typed dictionaries require **4.4+**; typed arrays
  `Array[int]` work from **4.0**.
- Lambdas (`var f := func(x): return x * 2`) exist in 4.x only, and cannot
  contain `await` in some early 4.x releases — verify against the project
  version if you need a suspending lambda.
- `static var` on a class requires **4.1+**.
- `@abstract` / abstract classes are a late-4.x addition; check
  `config/features` before using them, and otherwise emulate with
  `push_error()` in a base method.

## Workflow

1. **Confirm the major version** before typing a single line (see Required
   context). If it is 3.x, switch to 3.x syntax throughout and say so.
2. **Declare the class shape first**: `@tool` if needed, then `class_name`,
   then `extends`, then signals, then enums and constants, then `@export`
   variables, then `@onready` variables, then plain state.
3. **Type everything.** Function parameters, return types, variables. Use `:=`
   inference where the right-hand side makes the type obvious, explicit
   annotations where it does not.
4. **Wire dependencies in `_ready`, not `_init`.** Children do not exist during
   `_init`, and `@onready` assignments run just before `_ready`.
5. **Choose the right process callback.** `_physics_process` for anything that
   moves a physics body or queries the physics space; `_process` for visuals
   and UI; neither, plus `set_process(false)`, for nodes that are idle.
6. **Prefer signals outward, calls inward.** A node may call methods on its own
   children; it should emit a signal rather than reach up to a parent.
7. **Run the headless parse check** in Validation before declaring the change
   done.

## Canonical file shape (Godot 4)

```gdscript
@tool
class_name HealthComponent
extends Node

## Emitted whenever current health changes, including on heal.
signal health_changed(current: int, maximum: int)
signal died

enum State { ALIVE, DOWNED, DEAD }

const REGEN_TICK := 1.0

@export var max_health: int = 100:
    set(value):
        max_health = maxi(1, value)
        _current = mini(_current, max_health)
        health_changed.emit(_current, max_health)
@export_range(0.0, 10.0, 0.1) var regen_per_second: float = 0.0
@export var damage_profile: DamageProfile          ## a custom Resource

@onready var _hurt_box: Area3D = $HurtBox
@onready var _timer: Timer = %RegenTimer           ## scene-unique name

var _current: int = 100
var _state: State = State.ALIVE


func _ready() -> void:
    if Engine.is_editor_hint():
        return                                     # @tool guard
    _current = max_health
    _hurt_box.body_entered.connect(_on_body_entered)


func apply_damage(amount: int) -> void:
    if _state == State.DEAD:
        return
    _current = maxi(0, _current - amount)
    health_changed.emit(_current, max_health)
    if _current == 0:
        _state = State.DEAD
        died.emit()


func _on_body_entered(body: Node3D) -> void:
    if body.has_method(&"get_contact_damage"):
        apply_damage(body.get_contact_damage())
```

## Best practices

- **Static-type everything you can.** In Godot 4 the compiler emits specialised
  instructions for typed operations, so typed GDScript is measurably faster
  than untyped in hot loops, and typing is what makes editor autocompletion and
  "Go to definition" work. Type function signatures even when you skip locals.
- **Use `:=` for inference, `: Type =` when the literal lies.** `var hp := 100`
  infers `int`; if you want a float, write `var hp: float = 100`.
- **Use `class_name` for anything another script needs to type against.** It
  registers a global type usable in `@export var x: MyType` and in `is`
  checks, and it appears in the Create Node dialog.
- **Prefer `%UniqueName` over deep `$A/B/C` paths.** Scene-unique names survive
  reparenting inside the scene; `$` paths break silently the moment someone
  drags a node.
- **Cache node references in `@onready`, never call `get_node` in a loop.**
  `get_node`/`$` walks the tree by string on every call.
- **Use `StringName` literals (`&"name"`) for repeated string keys** — signal
  names, animation names, input actions, `has_method` arguments. `StringName`
  comparison is pointer comparison; `String` comparison is not.
- **Guard `@tool` scripts with `Engine.is_editor_hint()`** in every callback
  that has runtime side effects. A `@tool` script's `_ready` and `_process` run
  inside the editor.
- **Use `await` for sequencing, not as a substitute for state.** `await
  get_tree().create_timer(1.0).timeout` is fine; awaiting inside `_process` is
  a bug factory because the function re-enters before the previous call
  resumed.
- **Check `is_instance_valid(node)` after any `await`** that spans frames if the
  node could have been freed meanwhile. This is the single most common source
  of "Attempt to call function on a previously freed instance".
- **Use `assert()` for invariants that must hold in development.** `assert` is
  stripped from release exports, so it costs nothing shipped — and that is
  also why it must never contain a side effect.
- **Prefer composition nodes over deep inheritance.** A `HealthComponent` node
  attached to three unrelated scenes beats a `DamageableEntity` base class that
  four scenes must inherit.

## Common mistakes

- **`@onready var x = $Child` in a node that is added to the tree
  programmatically before its children exist.** `@onready` runs once, just
  before `_ready`. If you `add_child` the node and then immediately add its
  children, `x` is null forever. Build the subtree first, then add the parent.
- **Connecting a signal in `_ready` on a node that is re-added to the tree.**
  `_ready` runs again after `remove_child` + `add_child` unless the node was
  freed, producing a duplicate connection and double-fired handlers. Guard with
  `if not sig.is_connected(cb): sig.connect(cb)`, or connect with
  `CONNECT_ONE_SHOT` where appropriate.
- **Using `_process` for movement.** Physics runs at a fixed tick
  (`physics/common/physics_ticks_per_second`, default 60) while `_process` runs
  as fast as the display allows. Moving a body from `_process` produces
  frame-rate-dependent behaviour and fights the physics solver.
- **`free()` instead of `queue_free()`.** `free()` deletes the object
  immediately; if the engine is mid-signal-emission or mid-physics-step on that
  node, it crashes or corrupts iteration. `queue_free()` defers to the end of
  the frame. Use `free()` only on objects never added to the tree.
- **Comparing a freed node to `null`.** A freed `Node` variable is not `null`,
  it is a dangling reference. `if node:` is true; the next method call errors.
  Use `is_instance_valid(node)`.
- **Shadowing a built-in member.** `var position` on a `Node2D` silently
  shadows the node's own property in some contexts and raises a warning in
  others. Read the warnings panel; the project may have promoted it to an error.
- **Porting `yield(get_tree(), "idle_frame")` to `await get_tree().idle_frame`.**
  The signal was renamed as well as the keyword: it is
  `await get_tree().process_frame` (or `physics_frame`) in Godot 4.
- **Treating `signal foo(x: int)` argument types as enforced.** They are
  documentation and editor hints; emitting the wrong type is not blocked at the
  emit site. Validate in the handler where it matters.
- **Assuming integer division.** `5 / 2` is `2` when both operands are `int`
  and `2.5` when either is `float`. Untyped code makes this depend on runtime
  values. Type the variables.

## Validation

```bash
# 1. Every script parses and every class_name resolves. Exits non-zero on
#    script errors. (Godot 3.x: use --no-window instead of --headless.)
godot --headless --path . --quit 2>&1 | grep -E 'SCRIPT ERROR|Parse Error'

# 2. No Godot 3 syntax survives in a Godot 4 project. Expect no output.
grep -rnE '\b(yield\(|^\s*tool\s*$|export\(|onready var)' --include='*.gd' .

# 3. String-based signal connections that should be Callables. Expect no output.
grep -rn 'connect(\s*"' --include='*.gd' .

# 4. get_node/$ inside a per-frame callback: candidates to cache in @onready.
grep -rn -A20 'func _process\|func _physics_process' --include='*.gd' . \
  | grep -E 'get_node\(|\$'
```

Enable the strict warnings in `Project Settings > Debug > GDScript` — in
particular `Untyped Declaration`, `Unsafe Method Access`, `Unsafe Property
Access`, `Shadowed Variable` and `Return Value Discarded` — and read the
Warnings section of the script editor.

**Passing looks like:** check 1 prints nothing; checks 2 and 3 print nothing in
a 4.x project; the script editor shows zero warnings on files you touched; the
game runs and the Debugger panel's Errors tab stays empty through the changed
code path.

## References

- [Godot 3.x to 4.x syntax table](../godot-project-conventions/references/REFERENCE.md)
- [Godot docs: GDScript reference](https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_basics.html)
- [Godot docs: static typing in GDScript](https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/static_typing.html)
- [Godot docs: GDScript exported properties](https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_exports.html)
- [Godot docs: GDScript style guide](https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_styleguide.html)
- [Godot docs: node lifecycle and notifications](https://docs.godotengine.org/en/stable/tutorials/scripting/overridable_functions.html)
