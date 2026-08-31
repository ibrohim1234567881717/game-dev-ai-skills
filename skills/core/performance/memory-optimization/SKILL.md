---
name: memory-optimization
description: Reducing memory and VRAM footprint and eliminating leaks - measuring what is actually resident, finding retention, budgeting per platform, and reducing asset memory. Use when a build runs out of memory, is killed by the OS, degrades over a session, exceeds a platform certification budget, or when VRAM pressure causes stutter and texture pop-in.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: performance
  uad-version: "1.0.0"
  uad-requires: "performance-profiling-method"
  uad-tags: "memory, vram, leak, footprint, allocation, retention, budget, out of memory, pooling"
  uad-maturity: stable
---

# Memory Optimization

## Purpose

Memory problems present in three distinct forms, and confusing them wastes
effort:

- **Footprint** -- too much resident at once. Fix by budgeting and reducing.
- **Leak / growth** -- rises over a session and never returns. Fix by finding
  what retains it.
- **Churn** -- constant allocation and release. Costs *time*, not space; belongs
  to `cpu-optimization`.

Diagnose which one you have before doing anything else.

## When to use

- A build crashes with an out-of-memory error or is killed by the OS.
- Memory rises across a session, or across level transitions, without returning.
- The build exceeds a platform's memory budget or certification requirement.
- VRAM pressure shows as texture pop-in, streaming stutter, or hard hitches.
- Loading a level takes memory that is never released after leaving it.

## When NOT to use

- Frame time is the problem and memory is comfortable. Use `cpu-optimization` or
  `gpu-optimization`.
- The symptom is periodic GC hitches with stable footprint -- that is allocation
  churn, and it is a CPU problem.
- Load times are the problem. Use `loading-and-streaming`.

## Required context

| Fact | Why it matters |
|---|---|
| The platform's memory budget | Defines what "too much" means; consoles and mobile are hard limits |
| A memory snapshot, by category | Without it you are guessing at what is resident |
| Growth over time | Distinguishes footprint from leak |
| What is resident that should not be | The actual finding |
| Whether it is CPU memory or VRAM | Different causes, different fixes |
| Build configuration | Editor and debug builds hold far more |

Assets almost always dominate. In most games, textures, meshes, audio and
animation outweigh code and gameplay data by an order of magnitude, so start
there rather than in the gameplay code.

## Version constraints

Version-independent in method. Memory profiler tooling, snapshot formats and
per-category naming change between engine versions, as do texture compression
formats supported per platform. Confirm both against the project's version and
target platform via the platform performance skill.

## Workflow

1. **Establish the budget.** Total available, minus the OS and engine reserve,
   split across categories: assets, gameplay, rendering, audio, scratch. Without
   a budget there is no definition of done.

2. **Take a snapshot in a shipping-like build.** Editor memory is a different
   measurement of a different program. Capture at a representative moment --
   deep into gameplay, not on the menu.

3. **Sort by category, then by size.** Fix the largest first. A single
   uncompressed 4K texture set can outweigh every gameplay allocation combined.

4. **Determine footprint versus growth.** Snapshot at start, after one level,
   and after cycling through several levels and returning. If returning to the
   start state does not return to the start footprint, you have retention.

5. **For retention, find what holds the reference.** Use the tool's reference or
   retention path. The usual causes are event handlers never unsubscribed,
   static or singleton caches that only grow, pooled objects never released,
   closures capturing large objects, and asset references held past their scope.

6. **For footprint, reduce the largest categories.** Textures: correct
   resolution for on-screen size, platform-appropriate compression, mipmaps,
   no alpha channel where unused. Audio: streaming for long clips, compression
   settings, sample rate. Meshes: LODs, vertex attribute pruning. Duplicates:
   the same asset imported twice under different names is common and free to fix.

7. **Load less at once.** Stream by area, unload on transition, use soft
   references so that referencing an object does not drag its whole dependency
   chain into memory. In engines with asset reference graphs, one hard reference
   can pull in hundreds of megabytes transitively.

8. **Re-measure against the budget**, and cycle levels again to confirm
   retention is gone.

## Best practices

- **Budget per category, and enforce it in CI** where the engine can report
  footprint on a build.
- **Measure in a shipping build on the target device.** Desktop headroom hides
  console and mobile failures.
- **Unsubscribe wherever you subscribe**, symmetrically. Event handlers are the
  most common managed-memory leak in game code.
- **Prefer soft or lazy references** for optional content, so that reference
  graphs do not cascade.
- **Check asset import settings**, not just asset content. A texture is often
  four times larger than it needs to be because of one setting.
- **Watch the reference graph, not just the file sizes.** What pulls an asset in
  matters more than the asset.
- **Set a hard cap on caches**, with eviction. An unbounded cache is a leak with
  good intentions.
- **Test the level-cycle case** explicitly; it is where retention appears and
  where players eventually crash.

## Common mistakes

- **Optimising gameplay allocations while assets dominate.** Effort in the wrong
  order of magnitude.
- **Measuring in the editor.** Systematically misleading.
- **Confusing churn with footprint.** Fixing allocation rate does not reduce
  resident memory.
- **Assuming a managed runtime cannot leak.** It cannot leak unreachable memory;
  it happily retains reachable memory forever.
- **Subscribing without unsubscribing.** The canonical leak.
- **Unbounded caches and pools.** Grow until the process dies.
- **Hard references to optional content.** Pulls entire dependency trees into
  memory at load.
- **Uncompressed or oversized textures.** The most common single cause of
  blowing a memory budget.
- **Only testing a fresh launch.** Leaks are found by playing for an hour, or by
  cycling levels twenty times.

## Validation

- A snapshot from a shipping-like build on the target platform, by category,
  under the budget.
- A cycle test: start → several levels → back to start returns to within a small
  delta of the starting footprint. A persistent rise is retention, not noise.
- A soak test: run a representative session for an extended period and confirm
  memory plateaus rather than climbing.
- VRAM measured separately where relevant, and streaming stutter re-checked.
- Before and after numbers recorded with build config and device.
- Behaviour unchanged: assets still load, nothing was unloaded that is still needed.

## References

- Related core skills: `performance-profiling-method`, `asset-optimization`,
  `loading-and-streaming`, `cpu-optimization`
- Platform applications: `unity-performance-profiling`,
  `unreal-performance-profiling`, `unity-mobile-optimization`,
  `roblox-performance`
