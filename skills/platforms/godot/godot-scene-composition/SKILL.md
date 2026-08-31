---
name: godot-scene-composition
description: Designing Godot scene trees - scenes as reusable components, instancing with PackedScene and instantiate, composition over inheritance, node ownership and the owner property, scene-unique names, editable children and inherited scenes, and how a node should reach its collaborators. Use when adding nodes or scenes, when a scene tree has grown deep and brittle, when deciding between an inherited scene and a component node, or when runtime-built subtrees fail to save or serialise.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: godot
  uad-domain: gamedev
  uad-version: "1.0.0"
  uad-requires: "godot-project-conventions, game-architecture, software-architecture"
  uad-tags: "scene tree, packedscene, instancing, composition, owner, unique names, nodes"
  uad-maturity: stable
---

# Godot Scene Composition

## Purpose

In Godot the scene is the unit of reuse, the unit of version control and the
unit of instantiation all at once. A `.tscn` is a prefab, a component, a level
and a UI panel depending on how you use it, and there is no separate prefab
system to fall back on. That flexibility means the architecture of a Godot game
*is* the shape of its scene trees. This skill covers how to shape them so that a
feature can be moved, reused and deleted without a search-and-replace across
node paths.

## When to use

- Adding a new scene, or deciding whether something should be a scene at all.
- A scene has grown past a screenful of nodes, or several scenes share a
  copy-pasted subtree.
- Choosing between inheritance (an inherited scene, or `extends BaseEnemy`) and
  composition (a component node dropped into three unrelated scenes).
- Nodes built at runtime do not appear when the scene is saved with
  `PackedScene.pack()`.
- `$Path/To/Node` returns null after someone reorganised the tree.
- Scene transitions crash with "Parent node is busy" or free a node mid-frame.

## When NOT to use

- The syntax of a script attached to a node — `godot-gdscript-patterns`.
- Communication topology between nodes once the tree shape is decided —
  `godot-signals-events`.
- Data assets that are not nodes — `godot-resources-data`.
- Control node layout inside a UI scene — `godot-ui-control-nodes`.

## Required context

- **Major version.** `config_version` in `project.godot`. `instantiate()` is
  4.x; `instance()` is 3.x. Establish this first via
  `godot-project-conventions`.
- **The existing tree shape.** Open the main scene and one representative
  gameplay scene. Count depth and look for repeated subtrees.
- **The project's reuse convention.** Does it already use component nodes
  (`HealthComponent`, `HurtBox`), inherited scenes, or `class_name` base
  scripts? Match it rather than introducing a third style.
- **Autoloads.** `[autoload]` in `project.godot`. These are nodes too; they sit
  above the current scene in the tree at `/root/Name`.
- **Main scene and transition mechanism.** `run/main_scene`, plus whatever the
  project uses for scene changes — `change_scene_to_file`, a loader autoload, or
  manual `add_child`.

## Version constraints

- **Godot 4.x is assumed.** `PackedScene.instantiate()`,
  `get_tree().change_scene_to_file(path)`,
  `get_tree().change_scene_to_packed(packed)`, `Node3D`, `SubViewport`.
- **Godot 3.x** used `PackedScene.instance()`, `get_tree().change_scene(path)`,
  `change_scene_to(packed)`, `Spatial`, and a `Viewport` node as a child.
  `Position2D`/`Position3D` became `Marker2D`/`Marker3D`; `YSort` became the
  `y_sort_enabled` property on `Node2D`.
- Scene-unique names (`%Name`, the `unique_name_in_owner` property) are **4.x
  only**. There is no 3.x equivalent; 3.x code uses exported `NodePath`s.
- `Node.add_sibling()` and `Node.reparent()` are 4.x conveniences; in 3.x you
  do `remove_child` then `add_child` by hand.
- `.uid` sidecars for scripts and `uid://` references inside `.tscn` files
  appear in **4.4+**; older projects reference scripts by `res://` path only.

## Workflow

1. **Confirm the version**, then decide whether the thing you are adding is a
   scene or a node. If it will ever be instanced more than once, or configured
   differently in two places, it is a scene.
2. **Give the scene one root that names its responsibility**, with the script on
   the root and the same base filename as the `.tscn`.
3. **Keep the tree shallow.** Children exist to be positioned, drawn or
   collided; they are not a namespace. Three or four levels inside one scene is
   usually the ceiling before a subtree should become its own scene.
4. **Choose reach-in mechanism, in this order:** an `@export` reference wired in
   the inspector, then `%UniqueName` inside the same scene, then `$Path` for
   immediate children, and only then a group lookup or an autoload.
5. **Instance with `preload` for a fixed dependency, `load` for a dynamic one.**
   `const BULLET := preload("res://scenes/bullet.tscn")` resolves at parse time
   and fails loudly if the path is wrong.
6. **Add the child at the right moment.** Build the subtree fully, then
   `add_child`, so `@onready` and `_ready` see a complete node.
7. **Set `owner`** on any node you create at runtime and intend to serialise.
8. **Verify by instancing the scene twice in a throwaway test scene** and
   confirming the two copies do not share state (see Validation).

## Composition over inheritance

Godot supports both. Prefer composition, and know exactly what each buys you.

| Mechanism | Use it for | Cost |
|---|---|---|
| **Component node** — a scene or script node added as a child (`HealthComponent`, `StateMachine`, `HurtBox`) | Behaviour shared by unrelated things | One extra node per behaviour; the parent must wire signals |
| **Inherited scene** — `Scene > New Inherited Scene` | Variants of one thing: three enemy types with the same rig | Changes to the base ripple; overrides are stored as diffs and can conflict on merge |
| **Script inheritance** — `extends BaseEnemy` | Shared *code* with no shared node structure | Deep hierarchies get rigid fast; no editor visibility |
| **Group** — `add_to_group("enemies")` | Cross-cutting queries and broadcasts | Untyped, no compile-time check, `get_nodes_in_group` is a scan |

A component node beats a base class whenever the behaviour is optional or
combinable. `HealthComponent` on a player, a crate and a door is trivial;
`Damageable` as a base class forces those three into one hierarchy.

## Node ownership and the `owner` property

`owner` is what `PackedScene.pack()` walks. A node whose `owner` is not the
scene root is simply not written to the `.tscn`.

```gdscript
var turret := TURRET_SCENE.instantiate()
add_child(turret)
turret.owner = self          # only needed if this tree will be packed/saved
```

- In the editor, `owner` is set for you when you add a node in the dock.
- At runtime it is `null` unless you set it, which is correct and cheap for
  gameplay — set it only when saving a scene, in a `@tool` script, or in a level
  editor.
- `owner` also scopes `%UniqueName`: a unique name resolves against the node's
  owner, so it works inside the scene that declared it and not from outside.

## Best practices

- **One scene, one responsibility, one root script.** If the root script needs
  to know about grandchildren of a sibling, the boundary is in the wrong place.
- **Signals up, method calls down.** A parent may call methods on its own
  children. A child must not call `get_parent().do_thing()`; it emits a signal
  and lets whoever owns it decide. This is what makes a scene reusable in a
  second context.
- **Use `%UniqueName` instead of long `$A/B/C` chains.** Mark the node "Access as
  Unique Name" in the dock; the reference then survives reparenting inside the
  scene. Deep `$` paths break silently the moment someone drags a node.
- **Export the collaborators you cannot reach.** `@export var target: Node3D`
  wired in the inspector is typed, refactor-safe and visible to a designer.
  `get_node("../../Player")` is none of those.
- **`add_child(node, true)`** when the readable name matters (debugging, remote
  tree inspection); the second argument forces a human-readable unique name.
- **Defer structural changes made during physics or signal callbacks.**
  `add_child.call_deferred(node)` and `queue_free()` avoid mutating the tree
  while the engine is iterating it.
- **Use `queue_free()`, and null your own references to freed nodes.** A freed
  node's variable is dangling, not null; guard with `is_instance_valid()`.
- **Keep `_ready` order in mind:** children are ready before their parent, and
  `_enter_tree` fires top-down while `_ready` fires bottom-up. Anything that
  needs the whole tree belongs in the parent's `_ready`, not the child's.
- **Instance heavy scenes off the main thread** where the hitch matters — see
  `godot-resources-data` for `load_threaded_request`.
- **Enable "Editable Children" sparingly.** It is the right tool for tweaking one
  instance, and a trap when used to restructure the instance: the diff stored in
  the parent scene grows and base-scene changes stop propagating cleanly.

## Common mistakes

- **`get_parent()` calls in a reusable scene.** It works until the scene is
  instanced somewhere else, then it silently addresses the wrong node or errors.
  Emit a signal instead.
- **Building a subtree after adding the parent to the tree.** `@onready var x =
  $Child` runs just before the parent's `_ready`. If you `add_child(parent)` and
  *then* add the children, `x` is null forever. Assemble first, add last.
- **Forgetting `owner` on runtime-created nodes, then wondering why
  `PackedScene.pack()` saves an empty scene.** No error is raised; the nodes are
  simply skipped.
- **Freeing the current scene from inside its own callback.**
  `get_tree().change_scene_to_file()` is already deferred for this reason;
  calling `free()` on the current scene root from a button handler crashes.
- **Using an autoload as a scene-graph shortcut.** `Global.player.position` binds
  every system to a global. It survives until you need two players, a replay, or
  a test that runs one scene in isolation.
- **Deep inheritance chains of scenes.** An inherited scene of an inherited scene
  stores overrides at each level; a change to the base can silently fail to
  reach the leaf because an intermediate level overrode the property.
- **Renaming a node in the dock and not updating `$` paths in code.** The editor
  updates paths stored in the scene file and in exported `NodePath`s; it does
  **not** rewrite string paths inside GDScript.
- **Instancing the same `PackedScene` and mutating its exported `Resource`.**
  Two instances share the resource object unless it is marked local to scene —
  see `godot-resources-data`. Presents as "damaging one enemy damages them all".
- **Using groups as the primary architecture.** Fine for "all enemies, take a
  pause signal". Bad as the way a player finds its own weapon.

## Validation

```bash
# 1. Every scene file loads and every referenced resource resolves.
godot --headless --path . --quit

# 2. Fragile upward references in reusable scenes. Review each hit.
grep -rn 'get_parent()\.' --include='*.gd' .

# 3. Deep node paths that would break on a reparent. Candidates for %UniqueName.
grep -rnE '\$[A-Za-z_][A-Za-z0-9_]*(/[A-Za-z_][A-Za-z0-9_]*){2,}' --include='*.gd' .

# 4. Godot 3 instancing left in a Godot 4 project. Expect no output.
grep -rn '\.instance()' --include='*.gd' .

# 5. Structural changes made without deferring, inside physics callbacks.
grep -rn -A15 'func _physics_process' --include='*.gd' . | grep -E 'add_child\(|remove_child\(|\.free\(\)'

# 6. Scenes that reference a script path that no longer exists.
grep -rhoE 'path="res://[^"]+\.gd"' --include='*.tscn' . | sort -u \
  | sed 's/path="res:\/\///;s/"$//' | while read -r f; do [ -f "$f" ] || echo "missing: $f"; done
```

**Passing looks like:** check 1 exits 0 with no `ERROR: Failed to load` or
`Cannot open file` lines; check 4 prints nothing in a 4.x project; check 6
prints nothing. Checks 2, 3 and 5 are review prompts, not hard failures — each
hit should be a deliberate decision you can defend.

Then the reuse test: instance the scene twice in an empty scene, run, and
confirm that changing state on one instance leaves the other untouched, and
that neither instance logs a null-node error.

## References

- [Godot 3.x to 4.x rename table](../godot-project-conventions/references/REFERENCE.md)
- [Godot docs: nodes and scenes](https://docs.godotengine.org/en/stable/getting_started/step_by_step/nodes_and_scenes.html)
- [Godot docs: scene organization](https://docs.godotengine.org/en/stable/tutorials/best_practices/scene_organization.html)
- [Godot docs: when to use scenes versus scripts](https://docs.godotengine.org/en/stable/tutorials/best_practices/scenes_versus_scripts.html)
- [Godot docs: instancing](https://docs.godotengine.org/en/stable/getting_started/step_by_step/instancing.html)
- [Godot docs: class Node](https://docs.godotengine.org/en/stable/classes/class_node.html)
