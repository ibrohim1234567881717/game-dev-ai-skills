---
name: optimize
description: Fix a performance problem by measuring first - baseline, profile, find the dominant bottleneck, change one thing, re-measure and compare. Use for low frame rate, hitching, long load times, or memory and VRAM pressure. Never proposes an optimisation before profiling.
metadata:
  uad-workflow: optimize
  uad-version: "1.0.0"
  uad-skills: "performance-profiling-method, cpu-optimization, memory-optimization"
---

# /optimize

```
BASELINE -> PROFILE -> BOTTLENECK -> OPTIMIZE -> BENCHMARK -> COMPARE
```

**Do not propose a change before profiling.** Intuition about what is slow is
unreliable in almost every codebase, and unprofiled optimisation is how effort
gets spent on things that change nothing.

## Steps

### 1. Quantify the problem

Turn "it's slow" into a number and a threshold: "frame time is 28 ms in the
market district; the budget is 16.67 ms". Without a number there is no way to
know when you are finished.

Establish the target hardware, the frame or time budget, and the build
configuration. Editor and debug builds have different hot spots, and optimising
against them frequently helps nothing in a shipped build.

### 2. Baseline

Measure under conditions you can reproduce exactly — same scene, same build,
same hardware, same input. Record all of them alongside the number. Keep the
capture; it is the only evidence the work helped.

### 3. Find the saturated resource

Before looking at any code, answer: is this CPU-bound, GPU-bound, memory-bound,
or stalled on I/O?

Getting this wrong wastes everything after it. Optimising draw calls on a frame
that is CPU-bound in gameplay logic changes nothing.

### 4. Profile and find the dominant cost

Use the platform's real profiler, not timing printouts. Sort by inclusive cost
to find the subsystem, then exclusive cost to find the work.

If the largest item is a few percent of the frame, stop: there is no bottleneck.
That is diffuse cost — a design problem, fixed by doing less work overall
(fewer entities, lower update rates, coarser simulation), not by optimising any
single function.

### 5. Hypothesise, falsifiably

"Frame time is dominated by 3 000 per-frame allocations in the inventory tick,
and pooling them should save about 4 ms." Write down the expected saving.

### 6. Change one thing

One change per measurement cycle. Batched changes cannot be attributed, and one
of them is usually a regression hiding inside another's win.

Work in this order — each is cheaper and safer than the next:
eliminate the work, fix the algorithmic complexity, reduce the frequency, cut
allocation, improve memory access patterns, move work off the critical path,
and only then parallelise.

### 7. Re-profile and compare

Identical conditions. Report the delta as **frame time in milliseconds**, not
fps: equal fps deltas represent wildly unequal work, and fps hides what small
changes actually did.

### 8. Verify correctness

An optimisation that changes behaviour is a bug. Run the tests; check the
visual or gameplay result.

### 9. Decide: stop or repeat

Budget met → stop. Further optimisation is unpaid risk. Otherwise return to
step 3; the bottleneck has moved.

## Done means

- [ ] A baseline exists with its conditions recorded.
- [ ] The saturated resource was identified before any code was changed.
- [ ] The change targeted the dominant cost, not a smaller one.
- [ ] An after-measurement exists under identical conditions.
- [ ] The delta is reported in milliseconds, with the worst case as well as the average.
- [ ] Correctness is verified.
- [ ] The budget is met, or the remaining gap and next bottleneck are named.

## Report

```
Metric        : what, where, which build, which hardware
Baseline      : value   (target: value)
Bottleneck    : what the profiler showed, and its share
Change        : the one thing
After         : value
Delta         : absolute and percent; worst case too
Correctness   : tests run, behaviour verified
Remaining     : budget met, or next bottleneck named
```

Report honest results including zero and negative ones. An optimisation that did
not help is worth recording so nobody tries it again.
