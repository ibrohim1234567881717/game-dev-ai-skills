# Godot version reference

Companion to `godot-project-conventions`. Read on demand.

Everything here is verifiable against the project itself or against the upstream
migration guide. When a row matters to code you are about to write, confirm it
in the project's own source before relying on it.

---

## 1. Reading the version out of `project.godot`

```ini
config_version=5

[application]
config/name="My Game"
run/main_scene="res://scenes/main.tscn"
config/features=PackedStringArray("4.3", "Forward Plus")

[autoload]
EventBus="*res://autoload/event_bus.gd"
SaveManager="*res://autoload/save_manager.gd"

[rendering]
renderer/rendering_method="forward_plus"
renderer/rendering_method.mobile="gl_compatibility"
```

| Key | Meaning |
|---|---|
| `config_version=5` | Godot 4.x |
| `config_version=4` | Godot 3.x |
| `config_version=3` | Godot 2.x, unsupported |
| `config/features` first element | Minor version last used to save (4.x only) |
| `config/features` other elements | Renderer label, `C#`, `Double Precision` |
| `[autoload]` `Name="*path"` | The leading `*` means the node is enabled |
| `renderer/rendering_method` | `forward_plus`, `mobile`, `gl_compatibility` |
| `renderer/rendering_method.mobile` | Per-platform override; `.web`, `.android` etc. also exist |

Godot 3.x uses `[rendering] quality/driver/driver_name="GLES3"` instead of
`renderer/rendering_method`. Its absence is itself a 3.x signal.

---

## 2. Godot 3.x to 4.x renames that change what code compiles

This is the subset that most often produces wrong code. It is not exhaustive —
the upstream migration guide and the `--convert-3to4` tool are authoritative.

### Nodes and classes

| Godot 3.x | Godot 4.x |
|---|---|
| `Spatial` | `Node3D` |
| `KinematicBody` / `KinematicBody2D` | `CharacterBody3D` / `CharacterBody2D` |
| `RigidBody` | `RigidBody3D` |
| `Area` | `Area3D` |
| `MeshInstance` | `MeshInstance3D` |
| `Camera` | `Camera3D` |
| `Particles` / `CPUParticles` | `GPUParticles3D` / `CPUParticles3D` |
| `Navigation` / `Navigation2D` | removed; use `NavigationServer3D`/`2D` + `NavigationRegion3D`/`2D` |
| `NetworkedMultiplayerENet` | `ENetMultiplayerPeer` |
| `Tween` (a Node) | `Tween` (a RefCounted, made by `create_tween()`) |
| `File` / `Directory` | `FileAccess` / `DirAccess` |
| `Reference` | `RefCounted` |
| `Object` (C#: `Godot.Object`) | `GodotObject` |
| `VisualShader` node types with `Visual*` prefixes | renamed en masse; open in the editor |
| `ARVR*` | `XR*` |
| `Viewport` as a child node | `SubViewport` (`Viewport` is now the root abstraction) |
| `YSort` | `Node2D.y_sort_enabled` property |
| `Position2D` / `Position3D` | `Marker2D` / `Marker3D` |

### GDScript syntax

| Godot 3.x | Godot 4.x |
|---|---|
| `export(int) var hp` | `@export var hp: int` |
| `export(int, 0, 100) var hp` | `@export_range(0, 100) var hp: int` |
| `export(Resource) var cfg` | `@export var cfg: MyConfig` |
| `onready var s = $Sprite` | `@onready var s: Sprite2D = $Sprite2D` |
| `tool` (first line) | `@tool` (first line) |
| `yield(obj, "signal")` | `await obj.signal` |
| `yield(get_tree(), "idle_frame")` | `await get_tree().process_frame` |
| `connect("pressed", self, "_on_pressed")` | `pressed.connect(_on_pressed)` |
| `emit_signal("hit", dmg)` | `hit.emit(dmg)` (the string form still works) |
| `disconnect("pressed", self, "_on_pressed")` | `pressed.disconnect(_on_pressed)` |
| `PoolVector3Array` | `PackedVector3Array` |
| `.instance()` | `.instantiate()` |
| `OS.get_ticks_msec()` | `Time.get_ticks_msec()` |
| `OS.window_size` | `DisplayServer.window_get_size()` |
| `rand_range(a, b)` | `randf_range(a, b)` / `randi_range(a, b)` |
| `is_network_master()` | `is_multiplayer_authority()` |
| `remote func` / `master func` / `puppet func` | `@rpc("any_peer")` / `@rpc("authority")` |
| `ResourceSaver.save(path, res)` | `ResourceSaver.save(res, path)` — argument order flipped |
| `.gdshader` did not exist; shaders lived in `.shader` | `.gdshader` |

### Control node properties

| Godot 3.x | Godot 4.x |
|---|---|
| `rect_position` | `position` |
| `rect_size` | `size` |
| `rect_min_size` | `custom_minimum_size` |
| `rect_rotation` | `rotation` (radians, not degrees) |
| `add_font_override("font", f)` | `add_theme_font_override("font", f)` |
| `margin_left` etc. | `offset_left` etc. |
| `set_anchors_and_margins_preset` | `set_anchors_and_offsets_preset` |

### Angles

Godot 4 exposes rotation in **radians** on the script side and degrees in the
inspector, via paired properties: `rotation` (radians) and `rotation_degrees`.
Godot 3 mixed the two more freely. Ported code that sets `rotation = 90`
produces a 90-radian rotation.

---

## 3. `--convert-3to4` and what it does not fix

Godot 4 ships a one-shot converter:

```bash
godot --headless --path . --convert-3to4
```

It rewrites syntax it can match textually. It **does not** fix:

- Physics behaviour differences (`move_and_slide` semantics, layer defaults).
- Rendering: 3.x GLES3 materials, `SCREEN_TEXTURE`, environment settings.
- Navigation, which was fully redesigned.
- Multiplayer, which was fully redesigned.
- Anything depending on node paths that changed shape.

Treat its output as a starting point that still needs a full pass, and run it on
a branch you can throw away.

---

## 4. Minor-version boundaries inside Godot 4

Verify each against `config/features` before use. These are the boundaries this
skill pack flags; the upstream release notes are authoritative.

| Version | Change this pack depends on |
|---|---|
| 4.1 | `SceneMultiplayer` exposed; navigation avoidance reworked |
| 4.2 | `AnimationMixer` introduced as the base class of `AnimationPlayer` and `AnimationTree`; `EditorInterface` usable as a direct singleton; .NET target moved to net8.0; .NET Android and iOS export |
| 4.3 | `get_gravity()` on `CharacterBody2D`/`CharacterBody3D`; 2D physics interpolation; web export option that does not require thread support |
| 4.4 | Script `.uid` sidecar files; typed dictionaries `Dictionary[String, int]`; Jolt available as an in-engine 3D physics option |
| 4.6 | Jolt becomes the **default** 3D physics engine |

If the project's `config/features` predates the version a feature landed in, the
feature does not exist there. Say so rather than writing code that will fail.

---

## 5. Recommended `.gitignore` starting point (Godot 4.x)

```gitignore
# Godot 4 editor and import cache
.godot/

# Mono / .NET build output
.mono/
bin/
obj/

# Generated Android build template
android/

# Export output
builds/
*.pck
*.zip
```

Keep `*.import` and `*.gd.uid` **tracked**. For Godot 3.x, replace `.godot/`
with `.import/`.

---

## 6. Upstream sources

- <https://docs.godotengine.org/en/stable/tutorials/migrating/upgrading_to_godot_4.html>
- <https://docs.godotengine.org/en/stable/tutorials/best_practices/project_organization.html>
- <https://docs.godotengine.org/en/stable/tutorials/io/data_paths.html>
- <https://docs.godotengine.org/en/stable/classes/class_projectsettings.html>
- <https://github.com/github/gitignore/blob/main/Godot.gitignore>
