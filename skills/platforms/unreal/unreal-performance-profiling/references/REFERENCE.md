# Stat commands and Insights reference

Command names are among the more stable parts of Unreal, but availability and
output do change across 5.x, and some counters exist only when a feature is
enabled. **Confirm against the engine version in the project's `.uproject`.**

## The commands worth knowing

| Command | Answers |
|---|---|
| `stat unit` | Which thread is the constraint. **Always first.** |
| `stat unitgraph` | The same over time — separates steady cost from spikes |
| `stat fps` | Frame rate. Use `stat unit` instead; fps is non-linear |
| `stat game` | Game-thread breakdown by tick category |
| `stat scenerendering` | Draw calls, primitives, mesh batches — render-thread work |
| `stat gpu` | GPU time by category |
| `stat rhi` | RHI counts and render-target memory |
| `stat anim` | Animation update and blend cost |
| `stat physics` | Physics simulation cost |
| `stat streaming` | Texture streaming pool and requests |
| `stat levels` | Streaming level states |
| `stat memory` | Memory by category |
| `ProfileGPU` | One-frame GPU capture broken down by pass |
| `stat startfile` / `stat stopfile` | Capture a stats file over a window |
| `stat none` | Turn overlays off — they cost time themselves |

## Reading `stat unit`

```
Frame:  28.41 ms
Game:   27.88 ms      <-- closest to Frame: this is the constraint
Draw:    9.12 ms
GPU:    11.23 ms
RHIT:    3.40 ms
```

The line closest to **Frame** is your bottleneck. Frame is roughly the maximum
of the others, not their sum — the threads run in parallel and pipeline.

| Bound | Meaning | Go to |
|---|---|---|
| **Game** | Gameplay, ticks, Blueprints, animation | `stat game`, then `cpu-optimization` |
| **Draw** | Render-thread **CPU** cost: submitting draws | `stat scenerendering` |
| **GPU** | The GPU itself | `ProfileGPU`, then `gpu-optimization` |
| **RHIT** | Driver-level submission overhead | Usually the same causes as Draw |

The most common misreading is treating **Draw** as a GPU problem. It is CPU work
on the render thread, and it responds to *fewer submissions* — merging meshes,
instancing, fewer unique materials — not to fewer triangles.

## Is the cost per-pixel?

```
r.ScreenPercentage 50
```

Frame time drops a lot → fill-rate or shading limited: overdraw, expensive
materials, post-processing, shadow resolution.

Frame time barely moves → per-object or setup cost: draw calls, geometry
submission, culling, CPU.

Set it back to `100` afterwards.

## Unreal Insights

Launch the packaged build with tracing:

```
MyGame.exe -trace=cpu,gpu,frame,loadtime,file
```

Then open the resulting `.utrace` in the Insights application.

Useful channels:

| Channel | For |
|---|---|
| `cpu` | Thread timelines and named scopes |
| `gpu` | GPU work aligned to the frame |
| `frame` | Frame boundaries — needed to see hitches at all |
| `loadtime` | Asset loading and streaming |
| `file` | File I/O, which is behind many hitches |
| `memory` | Allocation tracking (heavier; enable when investigating memory) |

Insights is the tool for **hitches specifically**. `stat unit` tells you a spike
happened; only a trace tells you what ran during it.

## Hitch causes, by signature

| What the trace shows | Usual cause | Direction |
|---|---|---|
| A long stall on first sight of an effect or material | Shader compilation | Warm shaders ahead of time; check the PSO cache |
| Stall correlated with movement into a new area | Level streaming or asset loading | Streaming distances, async loading, soft references |
| Periodic stalls unrelated to content | Garbage collection | Reduce object churn; check GC settings |
| Stall on spawning many actors | Construction and registration cost | Pool, stagger across frames |
| Stall on file I/O | Synchronous load | Move to async |

Shader compilation is the one most often misdiagnosed as a general performance
problem. It is a first-encounter cost, it is much worse in the editor and in a
fresh build, and it does not respond to any of the optimisations people reach
for first. Confirm or eliminate it before going further.

## Instrumenting your own code

Named scopes make your systems visible in Insights and in `stat game` rather
than disappearing into a generic bucket:

```cpp
DECLARE_CYCLE_STAT(TEXT("MyGame Inventory Update"), STAT_InventoryUpdate, STATGROUP_Game);

void UInventoryComponent::TickComponent(float DeltaTime, ...)
{
    SCOPE_CYCLE_COUNTER(STAT_InventoryUpdate);
    // ...
}
```

`TRACE_CPUPROFILER_EVENT_SCOPE(MyEventName)` is the lighter-weight equivalent
for Insights timelines. Confirm the exact macros available in your engine
version — instrumentation macros have changed across 5.x.

## Blueprint tick cost

A frequent Game-bound cause, and often the cheapest fix in an Unreal project.
Check how many actors tick and whether they need to:

```cpp
PrimaryActorTick.bCanEverTick = false;
```

For actors that must tick, consider a reduced interval rather than every frame:

```cpp
PrimaryActorTick.TickInterval = 0.1f;
```

In Blueprints the equivalent is unchecking *Start with Tick Enabled* in Class
Defaults, and driving behaviour from events or timers instead. Hundreds of
actors each running a small amount of Blueprint tick logic add up to a Game-bound
frame with no single expensive function to point at — which is exactly the
"flat profile" case that `performance-profiling-method` describes as a design
cost rather than a bottleneck.

## Rendering feature costs to check first

When GPU-bound, look at these before micro-optimising anything:

- **Shadows** — frequently the largest single pass. Cascade count, distance,
  resolution, and which lights cast at all.
- **Lumen** — quality settings, and whether hardware ray tracing is in use.
- **Virtual Shadow Maps** — page count and invalidation cost.
- **Translucency and overdraw** — particles and foliage.
- **Post-processing** — full-screen cost every frame.

Each of these is a setting, not a code change, and each can dominate a frame on
its own. Establishing their cost is faster than any optimisation you could write.
