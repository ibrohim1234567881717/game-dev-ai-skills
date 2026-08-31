---
name: unreal-performance-profiling
description: Measuring performance in Unreal Engine - stat commands, Unreal Insights traces, ProfileGPU, and diagnosing whether a frame is game-thread, draw-thread, RHI or GPU bound. Use when an Unreal project drops frames, hitches, or misses its frame budget, and before proposing any optimisation. Supplies the Unreal tooling for the measurement loop; the loop itself is in performance-profiling-method.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: unreal
  uad-domain: performance
  uad-version: "1.0.0"
  uad-requires: "performance-profiling-method, cpu-optimization, gpu-optimization"
  uad-tags: "unreal, profiling, stat unit, insights, profilegpu, frame time, hitch, game thread, render thread, rhi"
  uad-maturity: stable
---

# Unreal Performance Profiling

## Purpose

This skill supplies Unreal's measurement tooling. The method — baseline,
profile, fix the dominant bottleneck, re-measure — lives in
`performance-profiling-method` and is not repeated here.

Unreal's specific contribution is that it renders across several threads, so
"the game is slow" has four quite different answers with four different fixes.
Determining which thread is the limit takes one console command, and skipping it
is how people spend a week optimising something that was never the constraint.

## When to use

- An Unreal project misses its frame budget, stutters, or hitches.
- Before proposing any Unreal optimisation.
- Deciding whether a rendering feature is affordable.
- Investigating a hitch that appears at a specific moment — level transition,
  spawning, first sight of an effect.

## When NOT to use

- The problem is a visual artifact rather than cost. Use `render-debugging`.
- The problem is memory footprint rather than time. Use `memory-optimization`.
- You have already identified the bottleneck and need the technique for fixing
  it. Use `cpu-optimization` or `gpu-optimization`.
- Editor-only slowness that does not reproduce in a build — worth noting, but it
  is a different investigation.

## Required context

| Fact | Why it matters | Where to find it |
|---|---|---|
| Engine version | Tooling and counter names change across 5.x | `EngineAssociation` in `.uproject` |
| Build configuration | Development or Shipping; editor numbers are a different program | Build settings |
| Target platform and hardware | Defines the budget | Project settings |
| Frame budget | 60 fps is 16.67 ms | Product requirement |
| Which rendering features are on | Nanite, Lumen, VSM and MegaLights have very different costs | `Config/DefaultEngine.ini` |
| Steady cost or hitch | Different causes entirely | The `stat unit` graph |

**Profile a packaged Development build, not the editor.** The editor runs
additional systems, renders extra viewports and does not strip editor-only code.
Optimising against editor numbers routinely produces work that changes nothing
for players. Use the editor only to locate a suspect, then confirm in a build.

## Version constraints

Console command names are among the more stable parts of Unreal, but the
tooling around them is not: Unreal Insights has gained and renamed channels
across 5.x, and counters appear and disappear with rendering features. Confirm
against the engine version in the `.uproject` — and remember that a GUID there
means a source build, where `Engine/Build/Build.version` is authoritative.

Feature status also moves. In 5.7 Nanite Foliage is experimental, MegaLights is
beta, and PCG and Substrate are production-ready; in an earlier 5.x release each
of those is different or absent, and their profiling characteristics with it.
Do not carry a cost assumption across versions.

## Workflow

1. **Establish the budget and reproduce.** A number, a threshold, and a
   repeatable scenario: same level, same route, same build, same hardware.

2. **Run `stat unit`.** This is the single most important command in Unreal
   performance work, and it answers the only question that matters first:

   | Line | Meaning |
   |---|---|
   | **Frame** | Total frame time — the number your budget is about |
   | **Game** | Game thread: gameplay, ticks, Blueprints, animation updates |
   | **Draw** | Render thread: preparing and submitting draw calls |
   | **GPU** | Time the GPU spent |
   | **RHIT** | RHI thread: driver-level submission |

   Whichever of Game, Draw, GPU or RHIT is closest to Frame is your constraint.
   **Everything you do next depends on reading this correctly.** Optimising
   materials on a Game-bound frame changes nothing.

   `stat unitgraph` plots it over time, which separates a steady cost from a
   spike far better than watching numbers scroll.

3. **Follow the bound thread.**

   - **Game-bound** → `stat game` for a breakdown of tick categories. Common
     causes: too many ticking actors, expensive Blueprint tick, animation
     update cost, physics, and per-frame work that could be event-driven.
     Then `cpu-optimization`.
   - **Draw-bound** → `stat scenerendering` for draw call counts and primitive
     counts. This is a *CPU* problem despite sounding graphical: too many
     unique meshes, materials or components to submit. Merge, instance, reduce
     material variety.
   - **GPU-bound** → `ProfileGPU` (or the GPU Visualizer) breaks the frame into
     passes. Then `gpu-optimization`.
   - **RHIT-bound** → usually driver or submission overhead, often a symptom of
     the same causes as draw-bound.

4. **For a GPU-bound frame, run `ProfileGPU`.** It gives per-pass timings —
   base pass, shadow depths, Lumen, post-processing, translucency. One pass
   usually dominates. Shadows and Lumen are frequent surprises.

   `r.ScreenPercentage 50` is the fastest test of whether cost is per-pixel: if
   frame time drops sharply, you are fill-rate or shading limited; if it barely
   moves, the cost is per-object or setup.

5. **For hitches, capture with Unreal Insights.** `stat unit` tells you a spike
   happened; Insights tells you what happened during it. Launch with tracing
   enabled and open the trace in Insights:

   ```
   -trace=cpu,gpu,frame,loadtime,file
   ```

   Hitches in Unreal are usually one of: shader compilation on first use,
   level streaming or asset loading, garbage collection, or a large spawn.
   The Insights timeline distinguishes them, and each has a different fix.

6. **Check specific suspects with targeted stats.** `stat gpu` for GPU
   categories, `stat rhi` for counts and memory, `stat streaming` for texture
   streaming, `stat levels` for streaming levels, `stat anim` for animation.
   Use these to confirm a hypothesis, not to browse.

7. **Change one thing, re-measure with the same commands under the same
   conditions, and report in milliseconds.**

## Best practices

- **`stat unit` before anything else, every time.** It costs seconds and
  eliminates most of the search space.
- **Profile in a packaged Development build.** Development keeps the stat
  commands and Insights instrumentation that Shipping strips, while behaving far
  more like Shipping than the editor does.
- **Use `stat startfile` / `stat stopfile`** to capture a stats file for a
  specific window rather than eyeballing a live overlay.
- **Watch the worst frame.** Players feel the spike, not the average.
- **Check Blueprint tick cost specifically.** Many actors ticking Blueprint
  logic every frame is one of the most common Game-bound causes in Unreal
  projects, and often the cheapest to fix — disable tick where it is not needed
  and move to events or timers.
- **Suspect shader compilation for first-encounter hitches**, particularly in
  the editor and in a fresh build. Confirm before optimising anything else.
- **Re-check after enabling a rendering feature.** Nanite, Lumen and Virtual
  Shadow Maps change where the cost is, not just how much there is.
- **Keep the trace files.** They are the evidence, and the comparison point when
  a regression appears later.

## Common mistakes

- **Skipping `stat unit`** and optimising the wrong thread. The defining Unreal
  performance mistake.
- **Profiling in the editor** and shipping the conclusions.
- **Treating "Draw" as a GPU problem.** It is render-thread CPU work; reducing
  triangle counts will not help if the count of *submissions* is the issue.
- **Reducing polygon counts on a Game-bound frame.** Art time spent for nothing.
- **Using `stat fps` as the metric.** Non-linear and misleading; use frame time.
- **Ignoring hitches because the average is fine.** The average is not what is
  being complained about.
- **Optimising before Nanite, Lumen or VSM settings have been examined**, when
  a single setting is often the dominant cost.
- **Assuming a cost carries across engine versions.** Feature performance
  changes materially between 5.x releases.
- **Leaving `stat` overlays on while measuring.** They cost time themselves.

## Validation

The work is complete when:

- `stat unit` output exists from before and after, under identical conditions,
  in the same packaged build configuration.
- The bound thread was identified **before** any change, and the change targeted
  it.
- Frame time is reported in milliseconds against the budget, with the worst
  frame as well as the average.
- For a GPU fix, `ProfileGPU` output before and after shows the targeted pass
  reduced.
- For a hitch fix, an Insights trace shows the spike gone, not merely a better
  average.
- Behaviour and visuals are unchanged, or the difference is documented and
  accepted.

A report that cannot fill this in is not finished:

```
Build         : Development, packaged, <platform/hardware>
Scenario      : <level, route, conditions>
stat unit before : Frame 28.4  Game 27.9  Draw 9.1  GPU 11.2
Bound thread  : Game
Cause         : <what stat game / Insights showed>
Change        : <one thing>
stat unit after  : Frame 15.9  Game 15.1  Draw 9.0  GPU 11.1
Delta         : -12.5 ms (-44%)
Worst frame   : before / after
```

## References

- [Stat command and Insights reference](references/REFERENCE.md)
- Related platform skills: `unreal-project-conventions`, `unreal-cpp-gameplay`,
  `unreal-blueprint-cpp-boundary`
- Related core skills: `performance-profiling-method`, `cpu-optimization`,
  `gpu-optimization`, `memory-optimization`
