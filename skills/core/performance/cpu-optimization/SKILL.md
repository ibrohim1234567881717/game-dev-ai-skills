---
name: cpu-optimization
description: Reducing CPU cost once profiling has shown the frame is CPU-bound - algorithmic complexity, per-frame work, allocation and garbage pressure, cache behaviour, and threading. Use after performance-profiling-method has identified a CPU bottleneck, when frame time is dominated by game logic or script execution, or when garbage collection causes periodic hitches.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: performance
  uad-version: "1.0.0"
  uad-requires: "performance-profiling-method"
  uad-tags: "cpu, optimization, allocation, garbage collection, cache, complexity, tick, update, threading"
  uad-maturity: stable
---

# CPU Optimization

## Purpose

Once profiling shows the frame is CPU-bound, this skill supplies the techniques
worth applying, in the order that usually pays. The ordering matters: doing less
work beats doing the same work faster, and both beat parallelising work that
should not exist.

**Do not use this skill before profiling.** It assumes a measured bottleneck.

## When to use

- `performance-profiling-method` has established the frame is CPU-bound.
- Frame time is dominated by game logic, scripts, or engine tick work.
- Periodic hitches correlate with garbage collection or allocation spikes.
- Cost grows non-linearly with entity, item, or object count.
- Load or save time is dominated by computation rather than I/O.

## When NOT to use

- Before profiling. Guessing at CPU costs is how effort is wasted.
- The frame is GPU-bound. Use `gpu-optimization`; CPU work will change nothing.
- The problem is memory footprint rather than time. Use `memory-optimization`.
- The problem is streaming or asset loading. Use `loading-and-streaming`.

## Required context

| Fact | Why it matters |
|---|---|
| The profile showing CPU dominance | Everything here depends on it |
| Which thread is saturated | Main, render, worker, or script thread need different responses |
| Whether it is steady cost or spikes | Steady cost is throughput; spikes are usually allocation, GC, or I/O |
| How cost scales with count | Distinguishes an algorithmic problem from a constant one |
| The language's memory model | Managed languages have GC; native code has allocator cost |
| Build configuration | Editor and debug builds have different hot spots |

## Version constraints

Version-independent as technique. Two version-sensitive details: garbage
collector behaviour (incremental versus stop-the-world, and their tuning) changes
between runtime versions, and engine job or task systems change API and
capability between releases. Confirm both against the project's version before
relying on specific behaviour.

## Workflow

Work down this list. Each step is cheaper and safer than the next.

1. **Eliminate the work.** The fastest code is code that does not run. Is this
   computed every frame when it changes rarely? Computed for objects that are
   off-screen, asleep, or irrelevant? Recomputed when it could be cached and
   invalidated? Most large wins in game code come from here.

2. **Fix the complexity.** Look at how cost scales with count. An O(n²) pass
   over entities -- every entity checking every other -- is the classic case,
   and it is fixed with spatial partitioning, not with micro-optimisation.
   Nested loops over collections and repeated linear searches are the usual
   shapes.

3. **Reduce frequency.** Not everything needs to run every frame. Time-slice
   across frames, run distant or low-importance entities at a lower rate, use
   event-driven updates instead of polling. Halving update frequency for
   background entities is often invisible and halves their cost.

4. **Cut allocation.** In managed runtimes, allocation is the usual cause of
   periodic hitches, because it drives collection. Pool reusable objects, avoid
   allocating in hot loops, reuse buffers, and watch for hidden allocations:
   string concatenation, boxing, closures capturing variables, iterators over
   interfaces, and API calls that return new collections.

5. **Improve memory access patterns.** Sequential access over contiguous memory
   is dramatically faster than pointer-chasing. Structure-of-arrays for hot data,
   contiguity for iterated collections, and smaller working sets. This matters
   most when thousands of items are iterated per frame -- the case that motivates
   data-oriented designs.

6. **Move work off the critical path.** Do it at load time, in the editor, at
   build time, or on a worker thread. Precomputation is free at runtime.

7. **Parallelise, last.** Threading adds races, nondeterminism and debugging
   cost. Use the engine's job system rather than raw threads, keep tasks pure
   and data-parallel, and only after the work is genuinely irreducible.

8. **Re-profile.** Confirm the bottleneck moved, and to where.

## Best practices

- **Measure between every step.** Optimisations that should help sometimes do
  not, and occasionally hurt.
- **Prefer structural change over micro-optimisation.** Removing a per-frame
  update beats tightening its inner loop by 10%.
- **Cache with an explicit invalidation rule.** A cache without one is a bug
  that appears later as stale data.
- **Batch instead of iterating one-at-a-time** where an API supports it;
  per-item overhead often dominates.
- **Keep hot data small and together**, cold data elsewhere.
- **Use the engine's job system**, which understands the frame's dependencies.
- **Guard against regression** with a benchmark in CI once a cost has been
  fixed. CPU regressions creep back with new content.

## Common mistakes

- **Optimising before profiling.** Covered above; still the most common mistake.
- **Micro-optimising an O(n²) algorithm.** The constant factor is irrelevant.
- **Assuming allocation is free** because a single allocation is fast. The cost
  arrives later, as a collection pause, in a different frame.
- **Hidden allocations in hot loops.** Especially string building, boxing, LINQ
  or equivalent chained-query APIs, and closures.
- **Caching without invalidation.** Trades a performance bug for a correctness bug.
- **Threading to avoid removing work.** Now the wrong work happens in parallel,
  with new race conditions.
- **Optimising editor-only cost.** Frequently absent in a shipped build.
- **Blanket object pooling.** Pooling everything adds complexity and lifetime
  bugs; pool what the profile shows is churning.
- **Ignoring the worst frame.** Sustained improvement with unchanged spikes does
  not fix the felt experience.

## Validation

- A profile before and after, under identical conditions, showing the targeted
  cost reduced.
- The overall frame time improved -- a subsystem getting faster while frame time
  does not is a sign the bottleneck was elsewhere.
- Allocation rate measured before and after where GC was implicated, and the
  collection pauses reduced or eliminated.
- Behaviour unchanged: the relevant tests pass, and gameplay is verified.
- Any cache added has a stated invalidation rule, exercised by a test.
- Scaling re-checked: measure at 1x, 2x and 4x entity count and confirm the
  curve is now linear-ish where it was quadratic.

## References

- Related core skills: `performance-profiling-method`, `memory-optimization`,
  `gpu-optimization`, `loading-and-streaming`
- Platform applications: `unreal-performance-profiling`,
  `unity-performance-profiling`, `godot-performance-profiling`,
  `roblox-performance`, `minecraft-performance`, `web-performance`
