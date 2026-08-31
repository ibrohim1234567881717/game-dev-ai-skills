---
name: godot-csharp-integration
description: Using C# in Godot 4 - the .NET editor build, partial classes and source generators, the Export, Signal, GlobalClass and Tool attributes, Variant marshalling cost across the engine boundary, calling between C# and GDScript, and the platform export limits that C# imposes. Use when a project has a .csproj beside project.godot, when deciding whether a system is worth writing in C# rather than GDScript, or when diagnosing build, marshalling or export failures specific to the .NET build.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: godot
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "godot-project-conventions, godot-gdscript-patterns, software-architecture"
  uad-tags: "csharp, dotnet, mono, marshalling, variant, source generators, interop, export"
  uad-maturity: stable
---

# Godot C# Integration

## Purpose

C# in Godot is not a drop-in replacement for GDScript. It needs a different
engine binary, a different export template, a build step before the game will
run, and every call that crosses into the engine pays a marshalling cost that
GDScript does not. Used where it fits — heavy simulation, existing .NET
libraries, teams with C# depth — it is a real win. Used everywhere by reflex, it
buys a slower iteration loop and a narrower list of platforms you can ship to.
This skill covers the setup, the interop rules, and the decision.

## When to use

- A `.csproj` sits beside `project.godot`, or `project.godot` contains a
  `dotnet/project/assembly_name` key.
- Writing or reviewing `.cs` files in a Godot project.
- Deciding whether a new system should be GDScript or C#.
- A C# node "does nothing", an `[Export]` does not appear in the inspector, or a
  signal will not connect.
- Diagnosing an export that works from the editor and fails as a build, or a
  target platform that refuses the .NET template.

## When NOT to use

- GDScript idioms and syntax — `godot-gdscript-patterns`.
- Native extensions in C++ or Rust — that is GDExtension, not C#, and is out of
  scope for this pack.
- Frame-time investigation once the language choice is settled —
  `godot-performance-profiling`.
- Export presets and platform packaging in general — `godot-export-deployment`;
  this skill covers only the C#-specific export constraints.

## Required context

- **Engine build.** C# requires the **.NET build** of Godot (labelled ".NET" in
  4.x, "Mono" in 3.x). The standard build cannot run C# at all. Check
  `Help > About` or run `godot --version`; .NET builds report a `.mono` suffix
  in older releases and are downloaded as a separate archive in every release.
- **Engine major version.** `config_version` in `project.godot`. Godot 3.x C# is
  a different API surface (`Godot.Object`, `Spatial`, string-based signals).
- **Target framework.** `<TargetFramework>` in the `.csproj`. Godot 4.2 and
  later target `net8.0`; 4.0 and 4.1 targeted `net6.0`. The installed .NET SDK
  must satisfy it — `dotnet --list-sdks`.
- **Which languages are in play.** `grep -rl 'class_name' --include='*.gd'`
  against `find . -name '*.cs'` tells you whether this is a C#-only project or a
  mixed one. Mixed projects need the interop rules below.
- **Target platforms.** Read `export_presets.cfg`. C# narrows this list; confirm
  before promising a build.

## Version constraints

- **Godot 4.x C# is assumed.** Methods and properties are PascalCase
  (`QueueFree()`, `Position`, `GetNode<T>()`), the base object type is
  `GodotObject`, and signals are generated from `[Signal]` delegates.
- **Godot 3.x (Mono)** used `Godot.Object`, `Spatial`, `KinematicBody`, and
  emitted signals with `EmitSignal(nameof(MySignal))` against a plain delegate.
  Do not carry 3.x C# samples into a 4.x project.
- `[GlobalClass]`, which registers a C# type by name for the inspector and for
  GDScript, requires **4.1+**.
- .NET **Android and iOS** export landed in **4.2**. Before that, mobile was not
  available to C# projects at all.
- **Web export for C# has been unsupported or experimental through most of the
  4.x line.** Do not promise a web build without checking the release notes for
  the exact engine version and confirming the option exists in the export
  dialog.
- Console exports have never had official C# support; they go through
  third-party porting houses.
- Newer 4.x releases generate typed helpers such as `EmitSignalHealthChanged(…)`
  alongside `EmitSignal(SignalName.HealthChanged, …)`. The `SignalName` form
  works everywhere in 4.x; prefer it unless you have confirmed the project's
  version generates the typed variant.

## Workflow

1. **Confirm the .NET build and the SDK.** `godot --version` plus
   `dotnet --list-sdks`. If the editor is the standard build, stop: nothing else
   in this skill applies until the .NET build is installed.
2. **Confirm the target framework** in the `.csproj` matches the engine's
   expectation for its minor version.
3. **Build before running.** `dotnet build` from the directory containing the
   `.csproj`. The editor builds on play, but a headless CI run does not, and a
   compile error means the game will not start at all — including scenes that do
   not use C#.
4. **Write the class with `partial`.** Every Godot-derived C# class needs it;
   the source generators emit the other half.
5. **Decide the boundary.** Keep hot loops inside C# data structures; cross into
   engine types once per frame, not once per element.
6. **Wire signals and node references in `_Ready()`**, not in the constructor —
   children do not exist yet when the constructor runs.
7. **Export and run the exported binary** before calling the work done; the
   editor is not a proxy for the export path (see Validation).

## Canonical class shape (Godot 4, C#)

```csharp
using Godot;

[GlobalClass]                                   // 4.1+; visible to GDScript
public partial class HealthComponent : Node
{
    [Signal]
    public delegate void HealthChangedEventHandler(int current, int maximum);

    [Signal]
    public delegate void DiedEventHandler();

    [Export] public int MaxHealth { get; set; } = 100;
    [Export(PropertyHint.Range, "0,10,0.1")] public float RegenPerSecond { get; set; }
    [Export] public Node3D HurtBox { get; set; }

    private int _current;

    public override void _Ready()
    {
        _current = MaxHealth;
        if (HurtBox is Area3D area)
        {
            area.BodyEntered += OnBodyEntered;      // C# event syntax
        }
    }

    public void ApplyDamage(int amount)
    {
        _current = Mathf.Max(0, _current - amount);
        EmitSignal(SignalName.HealthChanged, _current, MaxHealth);
        if (_current == 0)
        {
            EmitSignal(SignalName.Died);
        }
    }

    private void OnBodyEntered(Node3D body)
    {
        if (body.HasMethod("get_contact_damage"))    // GDScript method, snake_case
        {
            ApplyDamage(body.Call("get_contact_damage").AsInt32());
        }
    }
}
```

## Interop with GDScript

- **Neither language can inherit from the other.** A C# class cannot `extends` a
  GDScript class and a GDScript class cannot extend a C# type by script path.
  Share behaviour through composition or through a common engine base class.
- **C# calling GDScript** is duck-typed: `node.Call("method_name", arg)`,
  `node.Get("property")`, `node.Set("property", value)`. All of it returns
  `Variant`; convert with `.AsInt32()`, `.AsString()`, `.As<Node3D>()`. There is
  no compile-time check, so guard with `HasMethod`.
- **GDScript calling C#** works by name once the type is registered with
  `[GlobalClass]`, or duck-typed against any instance. Remember the case
  difference: a C# method `ApplyDamage` is called from GDScript as
  `ApplyDamage(...)`, not `apply_damage(...)`. Engine built-ins keep their
  snake_case names in GDScript and PascalCase in C#, but *your* methods keep
  whatever case you wrote.
- **Signals cross freely.** A GDScript node can connect to a C# `[Signal]` using
  the snake_case form of the delegate name (`health_changed`), and C# can
  connect to a GDScript signal with
  `node.Connect("health_changed", Callable.From((int c, int m) => { }))`.
- **Collections.** `Godot.Collections.Array<T>` and
  `Godot.Collections.Dictionary` wrap the engine's own containers and are what
  cross the boundary. `System.Collections.Generic.List<T>` is a pure .NET type
  and must be converted, which copies.

## Best practices

- **Choose C# for computation, GDScript for glue.** A pathfinding solver, an
  economy simulation, or a large deterministic tick loop benefits from the JIT
  and real generics. A node that reads three inputs and plays an animation does
  not, and pays the marshalling cost for nothing.
- **Do not mix languages inside one subsystem.** Cross-language calls are
  untyped and unrefactorable. Draw the boundary at a system edge with a small,
  explicit surface, not through the middle of a feature.
- **Batch across the boundary.** Reading `GetChildren()` and touching each
  child's `Position` in a loop marshals once per access. Pull the data into a
  `Vector3[]`, compute, then write back once.
- **Cache `NodePath` and `StringName`.** The generated `PropertyName`,
  `MethodName` and `SignalName` classes exist so you can pass a pre-interned
  `StringName` instead of allocating one per call.
- **Prefer `[Export]` over `GetNode<T>("Some/Path")`.** An exported `Node3D`
  wired in the inspector survives reparenting; a string path does not.
- **Unsubscribe C# events on nodes you keep alive across scenes**, or connect
  with `Connect(..., (uint)GodotObject.ConnectFlags.OneShot)`. A `+=`
  subscription holds a delegate that keeps the target reachable.
- **Avoid allocating per frame.** The .NET GC in Godot is not incremental in the
  way the engine's own allocator is; garbage created every `_Process` shows up
  as periodic frame spikes. Reuse buffers.
- **Keep `assert`-style invariants in `Debug.Assert` or `#if DEBUG`** so release
  builds do not pay for them.
- **Commit the `.csproj` and `.sln`; never commit `bin/` or `obj/`.** See
  `godot-project-conventions` for the full table.

## Common mistakes

- **Omitting `partial`.** The source generators emit a second half of the class
  containing the `SignalName`/`PropertyName` tables and the export metadata.
  Without `partial` you get a compile error at best, and at worst a class where
  `[Export]` silently never reaches the inspector.
- **Running the standard editor build on a C# project.** The project opens, the
  scenes load, and every C# script is simply absent. Nodes report a missing
  script rather than an obvious "C# not supported" error.
- **Assuming the game runs after editing a `.cs` file.** The assembly is rebuilt
  on play in the editor, but a build failure blocks the whole project. Always
  read the MSBuild output panel, not just the Godot console.
- **`GD.Print` in a hot loop.** Every call marshals a string into the engine and
  writes to the debugger channel. It is far more expensive than
  `Console.WriteLine`, which in turn does not appear in the Godot output panel.
- **Treating `Variant` as free.** `node.Get("position")` allocates a `Variant`,
  copies the value, and returns it untyped. In a per-frame loop over hundreds of
  nodes this dominates the profile.
- **Calling engine API from a background `Task`.** Most of the scene tree is not
  thread-safe. Marshal back with `CallDeferred` before touching nodes.
- **Comparing a freed node against `null`.** As in GDScript, a freed
  `GodotObject` is not null. Use `GodotObject.IsInstanceValid(node)`.
- **Promising a web build.** C# and the Web export have not been a supported
  combination for most of the 4.x line. Check the specific version before
  committing to it; the failure surfaces at export time, late.
- **Naming a `[Signal]` delegate without the `EventHandler` suffix.** The
  generator requires `…EventHandler`; without it the signal is not created and
  the error message points at the generated file, not yours.

## Validation

```bash
# 1. The editor is the .NET build and the SDK matches the csproj.
godot --version
dotnet --list-sdks
grep -m1 '<TargetFramework>' *.csproj

# 2. The assembly compiles standalone. This is what CI will do.
dotnet build --nologo

# 3. The project loads headless with the C# assembly attached.
godot --headless --path . --quit

# 4. Every Godot-derived class is partial. Expect no output.
grep -rn 'class .*: *\(Node\|Control\|Resource\|Character\|Rigid\|Area\|Static\)' \
  --include='*.cs' . | grep -v 'partial'

# 5. Signal delegates carry the required suffix. Expect no output.
grep -rn -A2 '\[Signal\]' --include='*.cs' . | grep 'delegate' | grep -v 'EventHandler'

# 6. Build output is not tracked.
git ls-files | grep -E '^(bin|obj)/' || echo "clean"
```

**Passing looks like:** `godot --version` names a .NET build; `dotnet build`
reports `0 Error(s)`; the headless load exits 0 with no `SCRIPT ERROR` or
"Cannot load C# assembly" lines; checks 4, 5 and 6 print nothing (or `clean`).
Then export to one real target and run the produced binary — an assembly that
builds in the editor can still be missing from an export whose template is not
the .NET one.

## References

- [Godot 3.x to 4.x rename table](../godot-project-conventions/references/REFERENCE.md)
- [Godot docs: C# basics](https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/c_sharp_basics.html)
- [Godot docs: C# API differences to GDScript](https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/c_sharp_differences.html)
- [Godot docs: C# exports](https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/c_sharp_exports.html)
- [Godot docs: C# signals](https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/c_sharp_signals.html)
- [Godot docs: C# platform support and known limitations](https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/index.html)
