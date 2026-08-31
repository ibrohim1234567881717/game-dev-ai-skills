---
name: godot-signals-events
description: Godot signals as first-class objects - declaring custom signals, connect and emit in Godot 4, Callable binding, connection flags, editor connections stored in the .tscn, awaiting a signal, and when an event bus autoload helps versus when it hides the call graph. Use when wiring nodes together, when a handler fires twice or never, when connections leak across scene reloads, or when a codebase has become impossible to trace because everything talks through a global bus.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: godot
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "godot-project-conventions, godot-gdscript-patterns, software-architecture"
  uad-tags: "signals, callable, event bus, connect, emit, decoupling, observer"
  uad-maturity: stable
---

# Godot Signals and Events

## Purpose

Signals are Godot's observer implementation and the main tool for decoupling a
node from whatever cares about it. In Godot 4 they stopped being strings and
became objects: `damaged` is a property of type `Signal`, `damaged.emit(10)` is
a method call, and `damaged.connect(_on_damaged)` takes a `Callable`. That
change removed a whole class of typo bugs and introduced a new one — a
connection is now a reference between two objects, with lifetime rules. This
skill covers the mechanics, the flags that matter, and the architectural
question of how much should travel through signals at all.

## When to use

- Wiring a node to something that reacts to it.
- A handler runs twice, or stops running after a scene reload.
- Deciding between a direct method call, a signal, and a global event bus.
- Porting `connect("sig", self, "_method")` from Godot 3.
- Chasing "Attempt to call function on a previously freed instance" inside a
  signal callback.
- A codebase where finding what handles an event requires a full-text search.

## When NOT to use

- Scene tree shape and node ownership — `godot-scene-composition`.
- General GDScript syntax and lifecycle — `godot-gdscript-patterns`.
- Input events specifically, which have their own propagation chain —
  `godot-ui-control-nodes` covers the `_input` / `_gui_input` /
  `_unhandled_input` ordering.
- Network replication, which is not a signal problem — `godot-multiplayer`.

## Required context

- **Major version.** `config_version` in `project.godot`. The entire syntax
  below differs between 3.x and 4.x.
- **Existing wiring style.** Are connections made in the editor (visible as
  `[connection …]` lines at the bottom of `.tscn` files) or in `_ready`? Mixing
  both in one project is the main reason a handler appears to fire twice.
- **Whether an event bus already exists.** Check `[autoload]` in
  `project.godot` for a name like `EventBus`, `Events` or `Signals`. If one
  exists, extend it rather than adding a second.
- **Scene lifetime.** Nodes that are removed and re-added (pooled bullets, UI
  panels) need connection guards that one-shot nodes do not.

## Version constraints

- **Godot 4.x is assumed.** Declaration `signal damaged(amount: int)`, emission
  `damaged.emit(10)`, connection `damaged.connect(_on_damaged)`, disconnection
  `damaged.disconnect(_on_damaged)`, test `damaged.is_connected(_on_damaged)`.
- **Godot 3.x** used `emit_signal("damaged", 10)` and
  `connect("damaged", self, "_on_damaged")` with an optional `binds` array and
  `CONNECT_*` flags as the fourth argument. Neither the object-plus-string form
  nor `binds` exists in 4.x.
- The string form `emit_signal("damaged", 10)` still works in 4.x for dynamic
  cases, but the object form is checked at parse time and should be the default.
- `Callable.bind()` (4.x) appends arguments at the *end* of the call;
  `Callable.unbind(n)` drops the last `n`. Godot 3's `binds` array behaved
  differently and ported code often has arguments in the wrong order.
- **Signal argument types are not enforced.** `signal damaged(amount: int)`
  documents intent and drives editor autocompletion; emitting a `String` is not
  blocked at the emit site in any 4.x release.
- Connections made in the editor are stored in the `.tscn` as
  `[connection signal="pressed" from="Button" to="." method="_on_button_pressed"]`
  and are re-established every time the scene is instanced.

## Workflow

1. **Confirm the version.** Everything below is 4.x.
2. **Ask whether a signal is the right tool.** A parent calling a method on its
   own child is a direct call. A child telling the world something happened is a
   signal. Do not invert this — signals pointing downward are indirection with
   no payoff.
3. **Declare the signal on the node that owns the fact**, with typed arguments
   and a `##` doc comment describing when it fires.
4. **Connect once, in `_ready`, on the node that owns the relationship** — the
   parent scene, not the emitter and not a global.
5. **Pick the flags deliberately.** `CONNECT_ONE_SHOT` for a connection that
   should fire exactly once; `CONNECT_DEFERRED` when the handler mutates the
   scene tree during a physics step.
6. **Guard re-entry** on nodes that can re-enter the tree — check
   `is_connected` or connect from the parent rather than in the child's
   `_ready`.
7. **Trace the graph before adding a bus.** If you cannot name the three
   listeners of a proposed global event, it is not a global event.

## The mechanics

```gdscript
class_name Enemy
extends CharacterBody2D

## Emitted when this enemy's health reaches zero, before it is freed.
signal died(enemy: Enemy, score_value: int)
## Emitted on every damage application, including lethal ones.
signal damaged(amount: int, remaining: int)

@export var score_value: int = 10
var _health: int = 30


func take_damage(amount: int) -> void:
    _health = maxi(0, _health - amount)
    damaged.emit(amount, _health)
    if _health == 0:
        died.emit(self, score_value)
        queue_free()
```

```gdscript
# The spawner owns the relationship, so the spawner connects.
func _spawn_enemy() -> void:
    var enemy: Enemy = ENEMY_SCENE.instantiate()
    enemy.died.connect(_on_enemy_died)
    # bind() appends: _on_enemy_died_at(enemy, score, spawn_point) 
    enemy.died.connect(_on_enemy_died_at.bind(current_spawn_point))
    add_child(enemy)


func _on_enemy_died(enemy: Enemy, score_value: int) -> void:
    _score += score_value
```

Useful forms:

| Form | Meaning |
|---|---|
| `sig.connect(cb)` | Standard connection, lives as long as both objects |
| `sig.connect(cb, CONNECT_ONE_SHOT)` | Disconnects itself after the first emission |
| `sig.connect(cb, CONNECT_DEFERRED)` | Handler runs at idle time, not inside the emit |
| `sig.connect(cb.bind(extra))` | Extra arguments appended after the signal's own |
| `sig.connect(cb.unbind(1))` | Drop the last signal argument the handler does not want |
| `await sig` | Suspend until the next emission; a one-shot with no bookkeeping |
| `sig.emit(args)` | Synchronous — every handler runs before `emit` returns |

Connections are removed automatically when either the emitter or the object
holding the `Callable` is freed. They are **not** removed when a node merely
leaves the tree.

## Event bus: when it earns its place

An `EventBus` autoload holding project-wide signals is a legitimate pattern with
a narrow remit.

**Good candidates:** the player died; the game was paused; a language change;
a settings value changed; an achievement unlocked. Genuinely global facts with
several unrelated listeners that must not know about each other.

**Bad candidates:** anything with exactly one listener; anything carrying a node
reference from one gameplay system into another; anything ordered, where
listener A must run before listener B. Those want a direct reference or an
explicit service.

If you use one:

- Declare every signal explicitly on the bus with typed arguments. A bus with a
  generic `emit_event(name: String, payload: Dictionary)` is a message queue with
  no type checking and no way to find the listeners.
- Name signals in the past tense after facts, not commands: `player_died`, not
  `kill_player`.
- Disconnect in `_exit_tree` for listeners whose lifetime is shorter than the
  bus — otherwise the bus holds the only reference keeping a dead scene's
  handlers reachable.
- Keep it to one file so the whole event vocabulary is readable at once.

## Best practices

- **Emit facts, not instructions.** `door_opened` lets three systems react;
  `play_door_sound` puts the audio decision inside the door.
- **Connect from the object that owns the relationship.** Usually the parent
  scene. It keeps setup in one readable place and avoids children reaching out.
- **Prefer `await sig` over a one-shot connection for sequencing.**
  `await animation_player.animation_finished` reads as a sequence and cleans up
  after itself.
- **Check `is_instance_valid()` after any `await`** that spans frames. The
  emitter may have been freed while you were suspended; this is the single most
  common signal-related crash.
- **Use `CONNECT_DEFERRED` when a handler adds or frees nodes** in response to a
  physics signal such as `body_entered`. Mutating the tree inside a physics
  callback is how "Can't change this state while flushing queries" appears.
- **Do not emit from `_process` per frame.** A signal with five listeners at 144
  Hz is 720 dynamic dispatches per second doing work a direct call would do
  cheaper; more importantly it hides a per-frame dependency.
- **Keep editor connections for UI, code connections for gameplay.** Editor
  connections are visible in the scene and survive designer edits; code
  connections are visible to grep. Choosing one per domain avoids the
  double-connection class of bug.
- **Name handlers `_on_<emitter>_<signal>`**, matching the editor's own
  convention, so a grep for the signal name finds the handler.

## Common mistakes

- **Connecting in a child's `_ready` on a node that re-enters the tree.**
  `_ready` runs again after `remove_child` followed by `add_child` (unless the
  node was freed), producing a duplicate connection and a handler that fires
  twice. In 4.x the second `connect` also pushes an error. Guard with
  `is_connected`, or connect from the parent.
- **Connecting in the editor *and* in `_ready`.** Same double-fire, but split
  across two files, so neither one looks wrong on its own. Check the
  `[connection]` lines in the `.tscn` before adding a code connection.
- **Porting `connect("pressed", self, "_on_pressed")` unchanged.** In 4.x
  `Object.connect` takes `(signal_name, callable, flags)`, so the 3.x call
  raises a runtime argument error rather than a parse error — it survives a
  syntax sweep and fails at the moment the button is first wired.
- **Assuming `bind` prepends.** It appends. Porting 3.x `binds` arrays without
  reordering gives handlers whose parameters are silently swapped when the types
  happen to be compatible.
- **Freeing the emitter inside its own handler chain.** `died.emit(self)` then
  `queue_free()` is fine because `queue_free` is deferred; `free()` in the same
  place destroys the object while the engine is still iterating its
  connections.
- **A global bus as the default.** Every event on the bus removes a compile-time
  edge from the codebase. Past a few dozen, "who reacts to this?" has no answer
  short of a full-text search, and the answer changes per scene.
- **Long chains of signal forwarding.** A signal re-emitted through four parents
  to reach the HUD is worse than one exported reference. If you are writing
  `func _on_child_x(): x.emit()`, collapse the chain.
- **Leaking listeners into a bus.** A UI panel that connects to `EventBus` in
  `_ready` and never disconnects keeps working after its scene is gone if
  something else holds a reference — and errors on a freed instance if not.

## Validation

```bash
# 1. Project loads and all connections resolve.
godot --headless --path . --quit

# 2. Godot 3 connection syntax left behind. Expect no output in a 4.x project.
grep -rn 'connect(\s*"' --include='*.gd' .
grep -rn 'emit_signal(' --include='*.gd' .

# 3. Editor connections per scene - cross-check against code connections.
grep -rn '^\[connection ' --include='*.tscn' .

# 4. Signals connected in _ready without a re-entry guard. Review each.
grep -rn -A20 'func _ready' --include='*.gd' . | grep '\.connect('

# 5. Awaits that could resume on a freed node. Each should be followed by a
#    validity check.
grep -rn -A3 'await ' --include='*.gd' . | grep -B1 -A2 'await '

# 6. Bus signal vocabulary in one place, if the project has a bus.
grep -rn '^signal ' --include='*.gd' . | grep -i 'autoload\|event_bus\|events'
```

**Passing looks like:** check 1 exits 0 with no `Signal '…' is already connected`
or `Nonexistent signal` errors; check 2 prints nothing in a 4.x project (the
string `emit_signal` form is legal but should be rare and deliberate); no node
appears in both check 3 and check 4 for the same signal.

At runtime, the Debugger's **Errors** tab is authoritative: duplicate
connections and emissions to freed objects both report there, and both are easy
to miss in the console scrollback.

## References

- [Godot 3.x to 4.x rename table](../godot-project-conventions/references/REFERENCE.md)
- [Godot docs: using signals](https://docs.godotengine.org/en/stable/getting_started/step_by_step/signals.html)
- [Godot docs: class Signal](https://docs.godotengine.org/en/stable/classes/class_signal.html)
- [Godot docs: class Callable](https://docs.godotengine.org/en/stable/classes/class_callable.html)
- [Godot docs: Object.connect and connect flags](https://docs.godotengine.org/en/stable/classes/class_object.html)
