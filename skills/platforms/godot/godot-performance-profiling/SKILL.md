---
name: godot-performance-profiling
description: Measuring performance in Godot - the profiler, the monitors, frame time breakdown, draw calls, physics cost, GDScript hot paths and memory. Use when a Godot project drops frames, stutters, takes too long to load, or uses too much memory, and before proposing any optimisation. Supplies Godot's tooling for the measurement loop; the loop itself is in performance-profiling-method.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: godot
  uad-domain: performance
  uad-version: "1.0.0"
  uad-requires: "performance-profiling-method, cpu-optimization, gpu-optimization"
  uad-tags: "godot, profiler, monitors, frame time, draw calls, physics, gdscript, memory, optimization, performance"
  uad-maturity: stable
---

# Godot Performance Profiling

## Purpose

This skill supplies Godot's measurement tooling. The method — baseline, profile,
fix the dominant bottleneck, re-measure — lives in
`performance-profiling-method` and is not repeated here.

Godot's specific contribution is that its profiler is in the editor and measures
the editor-hosted run, which means the numbers include editor overhead. Knowing
what that overhead is, and confirming conclusions in an exported build, is the
difference between useful measurement and a plausible-looking waste of time.

## When to use

- A Godot project misses its frame budget, stutters, or hitches.
- Before proposing any Godot optimisation.
- Load times or scene transitions are too slow.
- Memory grows over a session.
- Deciding whether an approach is affordable before committing to it.

## When NOT to use

- The problem is a visual artifact rather than cost. Use `render-debugging`.
- You already know the bottleneck and need the fixing technique. Use
  `cpu-optimization` or `gpu-optimization`.
- Editor slowness that does not reproduce in an exported build. Worth noting,
  but it is a different investigation.

## Required context

| Fact | Why it matters | Where to find it |
|---|---|---|
| **Godot major version** | 3.x and 4.x differ in renderer and profiling tools | `config_version` in `project.godot` |
| Minor version within 4.x | Renderer and physics behaviour changed across 4.x | `config/features` |
| Renderer in use | Forward+, Mobile and Compatibility have different costs | `renderer/rendering_method` |
| Target platform | Defines the budget, and mobile behaves very differently | Export presets |
| Frame budget | 60 fps is 16.67 ms | Product requirement |
| Editor run or exported build | Editor numbers include editor overhead | How you launched it |

## Version constraints

Godot 4 replaced the renderer entirely, so 3.x profiling advice does not
transfer: the rendering monitors, the pipeline and the costs are different.
Read `config_version` from `project.godot` — 5 means 4.x, 4 means 3.x.

Within 4.x, the profiler has gained capability across minor releases and the
ObjectDB debugger gained snapshot comparison in 4.6, which is the most direct
way to find what is leaking. Check `config/features` before relying on a
specific tool being present.

## Workflow

1. **Establish the budget and a repeatable scenario.** Same scene, same route,
   same settings.

2. **Read the monitors first.** *Debug → Monitors* gives the cheapest possible
   orientation, and it answers which resource is saturated before you open the
   profiler:

   | Monitor | Tells you |
   |---|---|
   | **Frame Time / FPS** | The number your budget is about |
   | **Process / Physics Process** | CPU time in your scripts, split by loop |
   | **Draw Calls** | Submission cost — a CPU-side rendering number |
   | **Objects / Nodes / Orphan Nodes** | Growth, and leaks |
   | **Video Memory / Texture Memory** | VRAM pressure |
   | **Static / Dynamic Memory** | CPU memory, and growth over time |

   **Orphan Nodes rising and never falling is a leak**, and it is the single
   most useful thing on this panel. Nodes removed from the tree but never freed
   accumulate until the project degrades.

3. **Determine which resource is saturated** before touching code. High Process
   time means script cost; high Physics Process means physics; high draw calls
   with low script time points at rendering submission; flat CPU with poor frame
   time points at the GPU.

4. **Use the profiler for the CPU breakdown.** *Debug → Profiler*, start it,
   reproduce, stop it. It shows time per function per frame, split into script
   and engine categories.

   Read the **self time** to find the expensive function, and the **total time**
   to find the responsible subsystem. Sorting by self time is usually where the
   answer is.

5. **For rendering cost, watch draw calls and the renderer.** Godot batches
   where it can, and unique materials defeat batching just as they do elsewhere.
   Reducing the number of distinct materials usually matters more than reducing
   node count. In 3D, check that culling is doing something: compare rendered
   primitives in an enclosed space against an open one.

6. **For GDScript hot paths, look for the usual costs**: work done every frame
   that could be event-driven, `get_node` in a loop rather than cached,
   allocations per frame, and `_process` doing what belongs in `_physics_process`
   or in a signal handler. Typed GDScript is also faster than untyped, which
   makes typing hot code a real optimisation rather than only a correctness one.

7. **For memory growth, use the ObjectDB debugger** and compare snapshots over
   time. What grows between two snapshots is what leaks. Combined with the
   Orphan Nodes monitor, this identifies most Godot leaks quickly.

   The usual causes: nodes removed with `remove_child` but never `queue_free`d,
   signals connected and never disconnected, and references held in autoloads
   that only grow.

8. **Confirm in an exported build.** The editor adds overhead the shipped game
   does not have. Locate a suspect in the editor if that is convenient, but do
   not report a conclusion without confirming it in an export on the target
   platform.

9. **Change one thing, re-measure identically, and report in milliseconds.**

## Best practices

- **Check Orphan Nodes on every profiling session.** It is nearly free and finds
  a whole class of problem.
- **Profile an exported build for anything you will report.**
- **Use `queue_free()` rather than `free()`** in normal gameplay, and make sure
  something frees every node you detach.
- **Disconnect signals when you disconnect nodes**, symmetrically. Signal
  connections keep objects alive.
- **Type hot GDScript.** It is both faster and safer.
- **Prefer signals to polling.** Checking a condition every frame in `_process`
  is the most common avoidable script cost in Godot projects.
- **Cache node references** in `_ready` with `@onready` instead of calling
  `get_node` repeatedly.
- **Measure on the target device**, especially for mobile, where the Mobile and
  Compatibility renderers behave very differently from Forward+.
- **Keep the monitor screenshots** from before and after — they are the evidence.

## Common mistakes

- **Reporting editor profiler numbers as the game's performance.**
- **Optimising script cost when the frame is GPU-bound**, or the reverse. Read
  the monitors first.
- **Ignoring Orphan Nodes**, so a leak grows for weeks before anyone notices.
- **`remove_child` without `queue_free`.** The node is gone from the tree and
  still in memory.
- **Never disconnecting signals**, keeping objects alive indefinitely.
- **Polling in `_process`** what a signal would deliver.
- **`get_node` in a per-frame loop** rather than a cached `@onready` reference.
- **Untyped GDScript in hot paths.**
- **Applying Godot 3 advice to a Godot 4 project.** The renderer is different
  and the costs are different.
- **Optimising draw calls when the profiler shows script cost dominating.**

## Validation

- Monitor readings from before and after, under identical conditions, in an
  **exported build** on the target platform.
- Frame time reported in milliseconds against the budget, with the worst frame
  as well as the average.
- Profiler capture before and after showing the targeted function reduced.
- For a leak fix: Orphan Nodes stays flat across a session that repeatedly
  creates and destroys the relevant objects, and two ObjectDB snapshots taken
  minutes apart show no growth.
- For a rendering fix: draw calls measured before and after.
- Behaviour unchanged — the relevant scenes still run correctly.
- Scaling re-checked: measure with 1x, 2x and 4x the entity count and confirm
  the curve is what you expect.

## References

- Related platform skills: `godot-project-conventions`,
  `godot-gdscript-patterns`, `godot-physics`, `godot-scene-composition`
- Related core skills: `performance-profiling-method`, `cpu-optimization`,
  `gpu-optimization`, `memory-optimization`
