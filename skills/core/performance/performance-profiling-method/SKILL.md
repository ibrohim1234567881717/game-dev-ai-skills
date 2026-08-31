---
name: performance-profiling-method
description: The measurement discipline for all performance work - establish a baseline, profile, identify the single dominant bottleneck, fix only that, then re-profile to prove the change. Use whenever anything is described as slow, laggy, stuttering, dropping frames, taking too long to load, or using too much memory, and before accepting any optimisation suggestion.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: performance
  uad-version: "1.0.0"
  uad-tags: "profiling, performance, optimization, bottleneck, benchmark, frame time, baseline"
  uad-maturity: stable
---

# Performance Profiling Method

## Purpose

Performance work fails in a specific, predictable way: someone reads the code,
forms a theory about what is slow, changes that thing, and declares victory
without measuring. The change is usually irrelevant and sometimes harmful, and
because nothing was measured, nobody finds out.

This skill defines the loop that prevents that:

```
BASELINE -> PROFILE -> IDENTIFY THE DOMINANT BOTTLENECK -> FIX ONE THING -> RE-PROFILE -> COMPARE
```

Every platform-specific performance skill in this toolkit implements this loop
with its own tools. The loop itself does not change.

## When to use

- Anything is reported as slow, stuttering, hitching, laggy, or dropping frames.
- Load times, build times, or startup times are too long.
- Memory or VRAM use is too high, or the process is being killed for it.
- Someone proposes an optimisation and you need to decide whether it is worth doing.
- Before a performance-related release gate.

## When NOT to use

- The code is functionally wrong rather than slow. Use `root-cause-debugging`;
  a correctness bug that also happens to be slow is still a correctness bug.
- You are designing a system that does not exist yet. Use `software-architecture`
  and choose a shape that admits optimisation later; do not micro-optimise a design.
- The "slowness" has not been reproduced or quantified by anyone. Reproduce and
  quantify first, or you are optimising a rumour.

## Required context

Establish all of these before profiling. Each one changes what the numbers mean:

| Fact | Why it matters | Where to find it |
|---|---|---|
| Target hardware and platform | A frame budget is meaningless without it | Project settings, platform target, the reporter |
| Target frame rate or time budget | 60 fps = 16.67 ms/frame; 30 fps = 33.3 ms | Product requirement |
| Build configuration | Debug/editor builds lie about performance | Build settings |
| Reproduction steps | An unreproducible slowdown cannot be measured | The bug report |
| Whether it is a steady cost or a spike | Sustained low fps and one-off hitches have different causes | The profiler timeline |

The build configuration point is not a formality. Editor and debug builds carry
overhead that does not exist in a shipped build, and optimising against them
routinely produces work that changes nothing for players.

## Version constraints

The method is version-independent. The tools are not: profiler names, capture
formats, counter names and available metrics change between engine and runtime
versions. Before quoting a specific counter or command, confirm it exists in
the version the project actually uses -- consult the matching platform skill
(`unreal-performance-profiling`, `unity-performance-profiling`,
`godot-performance-profiling`, `roblox-performance`, `minecraft-performance`,
`web-performance`) which is scoped to that platform's tooling.

## Workflow

1. **Quantify the problem.** Turn "it's slow" into a number and a threshold:
   "frame time is 28 ms in the market district, budget is 16.67 ms". Without a
   number there is no way to know when you are finished.

2. **Establish a baseline.** Measure the current state under conditions you can
   reproduce exactly: same scene, same build config, same hardware, same input.
   Record it. Everything later is compared against this.

3. **Determine which resource is saturated** before looking at any code. Is the
   frame CPU-bound, GPU-bound, or stalled on I/O or memory? This single question
   eliminates most of the search space, and answering it wrong wastes all
   subsequent effort. Optimising draw calls on a CPU-bound-by-gameplay-logic
   frame changes nothing.

4. **Profile and find the dominant cost.** Capture with a real profiler, not
   with timing printouts. Sort by inclusive cost, then exclusive cost. Identify
   the single largest contributor. If the top item is 4% of the frame, you do
   not have one bottleneck -- you have diffuse cost, which is a design problem,
   not an optimisation problem.

5. **Form a falsifiable hypothesis.** "Frame time is dominated by 3 000
   per-frame allocations in the inventory tick" is falsifiable. "The code is
   inefficient" is not. Write down what you expect the fix to save.

6. **Change one thing.** One change per measurement cycle. Batched changes make
   it impossible to attribute the result, and one of them is usually a
   regression hiding behind another's win.

7. **Re-profile under identical conditions** and compare against the baseline.
   Report the delta honestly, including when it is zero or negative.

8. **Decide: stop or repeat.** If the budget is met, stop -- further
   optimisation is unpaid work that adds risk. Otherwise return to step 3; the
   bottleneck has moved.

## Best practices

- **Profile a build that resembles what ships.** Release or development
  configuration, on representative hardware. Editor-only numbers are a
  different measurement of a different program.
- **Measure the worst case, not the average.** Players feel the 99th percentile
  frame. A good mean with periodic 80 ms spikes is a bad experience.
- **Keep the baseline capture.** It is the only evidence that the work helped,
  and it is what catches a later regression.
- **Prefer algorithmic and architectural wins over micro-optimisation.** Removing
  work beats doing the same work faster. An O(n²) loop over entities is not
  fixed by a faster inner loop.
- **Optimise for the budget, not for infinity.** Hitting the target is success.
- **Automate the measurement** once the same thing has been measured three
  times. A repeatable benchmark makes regressions visible in CI.
- **Record the environment with every number.** A measurement without its
  conditions cannot be compared to anything.

## Common mistakes

- **Optimising without profiling.** The most common and most expensive mistake.
  Intuition about performance is unreliable in almost every codebase.
- **Profiling the wrong build.** Debug builds have different hot spots; work
  done against them frequently helps nothing in shipping.
- **Fixing the second-largest cost.** Amdahl's law is not negotiable: halving
  something that is 5% of the frame buys 2.5%.
- **Changing several things at once.** You lose attribution, and regressions
  hide inside net wins.
- **Trusting an average.** Averages hide the spikes that players actually notice.
- **Optimising a cold path.** Code that is slow but runs once at load is not the
  problem. Code that is fast but runs 10 000 times per frame is.
- **Not re-profiling.** An unverified fix is a hypothesis, not a result. Some
  "optimisations" measurably make things worse.
- **Reporting a win without conditions.** "30% faster" with no build config,
  hardware or scene is unfalsifiable and therefore worthless.

## Validation

The work is done when all of these hold:

- A baseline measurement exists, with its conditions recorded.
- A post-change measurement exists, taken under identical conditions.
- The delta is stated as a number, with the metric that matters
  (frame time in ms, not fps -- fps is non-linear and hides the truth about
  small changes at high frame rates).
- The target budget is met, or the remaining gap is quantified and the next
  bottleneck named.
- Correctness is unaffected: the relevant tests still pass, and the visual or
  behavioural result is unchanged, or the change is documented and accepted.

A report that cannot fill in this template is not finished:

```
Metric        : frame time, market district, release build, target hardware
Baseline      : 28.4 ms  (target 16.67 ms)
Bottleneck    : <what the profiler showed was dominant>
Change        : <the single change made>
After         : 15.9 ms
Delta         : -12.5 ms (-44%)
Correctness   : <tests run / behaviour verified>
```

## References

- [Profiling report template](references/REPORT-TEMPLATE.md)
- Platform implementations of this loop: `unreal-performance-profiling`,
  `unity-performance-profiling`, `godot-performance-profiling`,
  `roblox-performance`, `minecraft-performance`, `web-performance`
- Related core skills: `cpu-optimization`, `gpu-optimization`,
  `memory-optimization`, `asset-optimization`, `loading-and-streaming`
