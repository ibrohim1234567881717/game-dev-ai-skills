---
name: unreal-rendering-features
description: Choosing and configuring Unreal's rendering features - Nanite, Lumen, Virtual Shadow Maps, TSR, MegaLights and Substrate - knowing what each costs and when it is the wrong choice. Use when deciding whether to enable a feature, when a feature is on and performance or quality is unacceptable, or when moving a project between engine versions changes how it looks.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: unreal
  uad-domain: graphics
  uad-version: "1.0.0"
  uad-requires: "rendering-fundamentals, gpu-optimization, lighting-design"
  uad-tags: "unreal, nanite, lumen, virtual shadow maps, tsr, megalights, substrate, global illumination, rendering"
  uad-maturity: stable
---

# Unreal Rendering Features

## Purpose

Unreal's headline rendering features are powerful and expensive, and each has
cases where it is actively the wrong choice. They are also the features whose
status changes most across engine versions, which makes advice about them stale
faster than anything else in the engine.

This skill is about **deciding and configuring**, with costs stated. It is not a
substitute for measuring: every claim here should be confirmed with
`unreal-performance-profiling` on your content and your target hardware.

## When to use

- Deciding whether to enable Nanite, Lumen, Virtual Shadow Maps or MegaLights.
- A feature is enabled and the frame budget or the visual result is unacceptable.
- Moving a project between engine versions and the look or cost changed.
- Targeting hardware where these features may not be affordable at all.
- Auditing an inherited project to understand why it renders the way it does.

## When NOT to use

- Lighting a scene artistically. Use `lighting-design`.
- Diagnosing a visual artifact. Use `render-debugging`.
- Material authoring. Use `unreal-materials-shading`.
- General GPU cost reduction once the bottleneck is known. Use
  `gpu-optimization`.

## Required context

| Fact | Why it matters | Where to find it |
|---|---|---|
| **Engine version** | Feature status and behaviour change materially across 5.x | `EngineAssociation` in `.uproject` |
| Which features are currently enabled | Determines the baseline | `Config/DefaultEngine.ini` |
| Target hardware and platform | Decides what is affordable at all | Project settings |
| Frame budget | Defines "too expensive" | Product requirement |
| Whether the project ships on lower-end hardware | Some features have no cheap fallback | The design |
| Content style | Nanite suits dense static geometry; it is not universal | The art direction |

## Version constraints

**This is the most version-sensitive skill in the Unreal pack.** Feature status
moves between experimental, beta and production-ready across minor versions, and
with it the performance characteristics and the settings that exist at all.

As of 5.7: Nanite Foliage is experimental, MegaLights is beta, PCG and Substrate
are production-ready, and Lumen has been converging on hardware ray tracing as
its single path. In 5.3 or 5.4 each of those statements is different.

**Read `EngineAssociation` from the `.uproject` before saying anything specific**
— and remember a GUID means a source build, where `Engine/Build/Build.version`
is authoritative. If you are unsure whether a setting exists in the project's
version, say so and tell the developer to check, rather than asserting it.

## Workflow

1. **Establish the version and the current configuration** before proposing
   anything. Read the enabled features from `Config/DefaultEngine.ini`.

2. **Decide per feature, against your content — not by default.**

   **Nanite** — virtualised geometry. Removes the LOD authoring problem for
   dense static meshes and makes triangle count largely irrelevant. Costs a
   fixed overhead per frame that small scenes do not earn back, and it has real
   constraints: it suits opaque static geometry best, and masked or translucent
   materials, and world-position-offset effects, complicate it. A stylised game
   with low-poly meshes may pay Nanite's overhead for no benefit.

   **Lumen** — dynamic global illumination and reflections. Removes the light
   bake step, which is a substantial iteration win, and makes changing time of
   day and destructible geometry possible. It is expensive, and its software and
   hardware ray tracing paths differ in both cost and quality. On lower-end
   targets, baked lighting still produces a better result for less.

   **Virtual Shadow Maps** — high-resolution shadows that pair with Nanite.
   Better quality than cascades, with a cost that depends heavily on how much
   invalidates each frame. Lots of moving geometry and lots of shadow-casting
   lights makes it expensive.

   **TSR** — temporal super resolution. Renders below native resolution and
   reconstructs, which is often the single largest frame-time saving available.
   Costs temporal artifacts: ghosting behind fast motion, and instability on
   thin geometry and transparency. Judge it in motion, never on a screenshot.

   **MegaLights** — many shadow-casting dynamic lights at tractable cost. Beta
   in 5.7; confirm status and behaviour in your version before relying on it.

   **Substrate** — a more expressive material model. Production-ready in 5.7.
   Changes how materials are authored, so adopting it mid-project has a content
   cost as well as a rendering one.

3. **Enable one feature at a time and measure.** These interact: Nanite changes
   what Virtual Shadow Maps cost, Lumen's cost depends on geometry
   representation, and TSR changes the resolution everything else runs at.
   Enabling several at once makes attribution impossible.

   Use `unreal-performance-profiling`: `stat unit` to confirm you are GPU-bound,
   then `ProfileGPU` to see which pass the feature added.

4. **Tune with scalability settings, not by disabling wholesale.** Each feature
   has quality levels and console variables. The useful question is rarely
   "on or off" but "at what quality, at what distance, for which platform".

5. **Check the low end.** If the project ships on hardware where these are not
   affordable, the scalability path must be a real, tested configuration — not
   an assumption that low settings will work out.

6. **Verify in motion and in a build.** Temporal features in particular look
   fine in a screenshot and reveal themselves in movement, and editor
   performance is not shipped performance.

## Best practices

- **Decide by measurement on your content.** These features' costs vary
  enormously with content; general advice, including this skill's, is a starting
  point.
- **One feature at a time**, with a measurement between each.
- **Judge temporal features in motion**, with fast camera movement, thin
  geometry and transparency in frame.
- **Treat shadows as a first-class cost.** They are frequently the largest pass
  regardless of which shadow technique is in use.
- **Do not enable Nanite reflexively.** It is not free and it is not universal;
  measure whether your geometry earns it.
- **Keep baked lighting as an option** for lower-end targets. Dynamic GI is not
  strictly better, it is a different trade.
- **Record which features are on and why**, as a decision record. An inherited
  project where nobody knows why a feature is enabled is common and expensive.
- **Re-measure after an engine upgrade.** These features change between
  versions, sometimes substantially.

## Common mistakes

- **Enabling everything because it is the modern path**, then discovering the
  frame budget on target hardware.
- **Assuming Nanite makes geometry free.** It changes the cost model; it does
  not remove cost, and it has a fixed overhead.
- **Using Lumen on hardware that cannot afford it** when baked lighting would
  look better and cost less.
- **Judging TSR on a screenshot.** Its artifacts are temporal by definition.
- **Enabling several features at once** and being unable to attribute the cost.
- **Carrying a cost assumption across engine versions.** The most common way to
  be confidently wrong about these features.
- **Ignoring the low-end scalability path** until certification.
- **Adopting Substrate mid-project** without accounting for the material
  authoring cost.
- **Testing in the editor only.**

## Validation

- The engine version is stated, and every feature claim was checked against it.
- `stat unit` confirms whether the frame is GPU-bound before any rendering
  feature is blamed or tuned.
- `ProfileGPU` output before and after enabling a feature, showing which pass it
  added and how much.
- Frame time measured **on target hardware in a packaged build**, against budget,
  at the intended quality level — and at the lowest supported one.
- Temporal features evaluated in motion, with fast camera movement, thin
  geometry and transparency present.
- The scalability path for lower-end targets is a tested configuration, not an
  assumption.
- The decision and its reasoning are recorded, so the next person inheriting the
  project knows why the configuration is what it is.

## References

- Related platform skills: `unreal-performance-profiling`,
  `unreal-materials-shading`, `unreal-project-conventions`
- Related core skills: `rendering-fundamentals`, `lighting-design`,
  `gpu-optimization`, `post-processing`
- Version status is recorded in `knowledge/version-matrix.yaml`, as orientation
  rather than authority — confirm against the project's engine version.
