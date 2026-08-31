---
name: gpu-optimization
description: Reducing GPU cost once profiling has shown the frame is GPU-bound - draw calls and batching, overdraw and transparency, shader complexity, resolution and fill rate, texture bandwidth, and shadow cost. Use after performance-profiling-method has identified a GPU bottleneck, when frame time scales with resolution, or when heavy visual effects cost more than they are worth.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: performance
  uad-version: "1.0.0"
  uad-requires: "performance-profiling-method"
  uad-tags: "gpu, draw calls, overdraw, fill rate, shader complexity, batching, shadows, vram, bandwidth"
  uad-maturity: stable
---

# GPU Optimization

## Purpose

Once profiling shows the frame is GPU-bound, this skill supplies the techniques
worth applying and the order that usually pays. GPU cost has a small number of
recurring causes, and identifying which one you have is most of the work.

**Do not use this skill before profiling.** CPU-bound frames do not get faster
when you reduce GPU work, and the two are routinely confused.

## When to use

- `performance-profiling-method` has established the frame is GPU-bound.
- Frame time scales with rendering resolution — the defining symptom of a
  fill-rate or shading bottleneck.
- Frame time worsens sharply when looking at particular content: foliage,
  particles, transparent surfaces, many lights.
- VRAM pressure causes stutter, streaming hitches, or texture pop-in.
- A visual feature is being considered and its cost needs judging.

## When NOT to use

- The frame is CPU-bound. Use `cpu-optimization`. Reducing triangles when the
  CPU is submitting too many draw calls is the classic wasted effort — though
  note that *draw call submission* is CPU cost, even though it feels like a
  rendering problem.
- The problem is a visual artifact rather than cost. Use `render-debugging`.
- Memory footprint rather than frame time. Use `memory-optimization`.

## Required context

| Fact | Why it matters |
|---|---|
| A GPU capture showing per-pass cost | Everything here depends on knowing which pass is expensive |
| Target GPU and resolution | Mobile, console and desktop have very different limits |
| Render pipeline and version | Batching, shadows and lighting differ per pipeline |
| Whether cost scales with resolution | Distinguishes fill rate from geometry or setup cost |
| Target frame budget | Defines done |

## Version constraints

The categories of GPU cost are stable hardware facts. Everything about *how you
reduce them* is engine- and pipeline-specific and changes between versions:
batching rules, instancing support, shadow techniques, and whether features like
virtualised geometry or software rasterisation apply. Establish the engine
version and render pipeline first, then consult the platform skill.

## Workflow

1. **Confirm GPU-bound, and find the expensive pass.** A GPU capture breaks the
   frame into passes — depth, shadows, opaque, transparent, post-processing.
   One usually dominates, and that determines everything you do next.

2. **Test whether it scales with resolution.** Drop the render resolution by
   half. If frame time falls substantially, the cost is per-pixel: fill rate,
   overdraw, or shader complexity. If it barely moves, the cost is per-object or
   per-vertex: draw calls, geometry, or state changes.

3. **For per-pixel cost:**
   - **Overdraw** is the usual culprit. Transparent surfaces do not write depth,
     so every layer shades every pixel beneath it. Stacked particles, foliage
     cards and full-screen transparent UI are the common offenders. Use the
     overdraw visualisation, then reduce layers, shrink quads to fit their
     content, and use cutout or opaque where the effect allows.
   - **Shader complexity** — expensive instructions, many texture samples, long
     loops, dynamic branching. Use the shader complexity view to find the
     materials worth simplifying.
   - **Resolution and post-processing.** Full-screen effects cost the whole
     screen every frame; several stacked can dominate a frame on their own.
     Dynamic resolution or upscaling trades sharpness for headroom.

4. **For per-object cost:**
   - **Draw calls and state changes.** Each is CPU submission plus GPU state
     setup. Reduce by batching, instancing, sharing materials, and merging
     meshes that are always drawn together. Fewer unique materials matters more
     than fewer objects.
   - **Geometry.** LODs so distant objects use fewer triangles; culling so
     off-screen and occluded objects are not submitted at all. Culling beats
     LOD: the cheapest triangle is the one never submitted.

5. **Check shadows separately.** Shadow rendering re-renders geometry per light
   per cascade and is frequently the largest single pass. Reduce cascade count
   and distance, lower shadow resolution, limit which lights cast, and turn off
   shadow casting on small objects that contribute nothing.

6. **Check lighting cost.** Each dynamic light shading each pixel is
   multiplicative with overdraw. Bake what is static, limit the number of
   dynamic lights, and constrain their range.

7. **Check texture bandwidth and VRAM.** Oversized textures cost sampling
   bandwidth as well as memory. Correct resolution for on-screen size, correct
   compression for the platform, mipmaps enabled.

8. **Re-capture and compare** under identical conditions.

## Best practices

- **Cull before you optimise what is drawn.** Frustum and occlusion culling
  remove entire objects.
- **Fewer unique materials.** Material variety costs more than object count in
  most pipelines.
- **Treat transparency as expensive by default**, and budget it deliberately.
- **Bake what does not move.**
- **Set the LOD and culling policy as a project convention**, not per asset —
  otherwise it is applied inconsistently and quietly regresses.
- **Profile on the target device.** A desktop GPU hides mobile problems
  completely; mobile is usually bandwidth- and fill-rate-limited where desktop
  is not.
- **Measure the cost of a visual feature before committing art to it.**

## Common mistakes

- **Reducing triangle counts when the bottleneck is draw calls or overdraw.**
  Common, and it wastes art time for no measurable gain.
- **Assuming GPU-bound because the visuals are heavy.** Measure.
- **Ignoring shadows**, often the single largest pass.
- **Full-screen post-processing on mobile** without measuring the bandwidth cost.
- **Particles with large transparent quads.** Enormous overdraw for effects that
  are barely visible.
- **Unbounded dynamic lights.** Cost multiplies with overdraw.
- **Uncompressed or oversized textures.** Bandwidth and VRAM, for no visual gain.
- **Optimising in the editor.** Editor rendering overhead is not shipped
  rendering.
- **Optimising a pass that is not the dominant one.**

## Validation

- A GPU capture before and after, under identical conditions, showing the
  targeted pass reduced.
- Overall frame time improved, measured in milliseconds.
- The resolution-scaling test re-run, confirming the bottleneck class changed or
  the cost fell as intended.
- Visual result verified — a screenshot comparison, since GPU optimisation
  frequently changes appearance subtly.
- Measured on the target device, not only on a development machine.
- VRAM checked where texture or buffer changes were made.

## References

- Related core skills: `performance-profiling-method`, `cpu-optimization`,
  `memory-optimization`, `render-debugging`, `asset-optimization`,
  `rendering-fundamentals`
- Platform applications: `unreal-rendering-features`, `unity-render-pipelines`,
  `unity-mobile-optimization`, `godot-performance-profiling`
