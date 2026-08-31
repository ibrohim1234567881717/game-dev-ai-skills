---
name: vfx-and-particles
description: Authoring visual effects that read clearly and cost what you expect - particle system structure, overdraw and fill rate, timing and readability, pooling and lifetime, and CPU versus GPU simulation. Use when creating effects for abilities, impacts, weather or ambience, when effects tank frame rate, or when an effect does not read at gameplay distance.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: graphics
  uad-version: "1.0.0"
  uad-requires: "rendering-fundamentals"
  uad-tags: "vfx, particles, effects, overdraw, fill rate, timing, readability, gpu simulation, pooling"
  uad-maturity: stable
---

# VFX and Particles

## Purpose

Visual effects have two failure modes that dominate everything else: they cost
far more than expected, and they do not read at the distance and speed players
actually see them. Both are avoidable, and both are usually decided at authoring
time rather than fixable later.

The dominant cost is almost never particle count. It is **overdraw** — large
transparent quads stacked on top of each other, each shading every pixel beneath.

## When to use

- Authoring effects: impacts, abilities, muzzle flashes, weather, ambience.
- Frame rate collapses during combat or in effect-heavy areas.
- An effect is invisible, ambiguous, or misread at gameplay distance.
- Effects feel unresponsive or mistimed relative to the action.
- An effect leaks, persists after its owner is destroyed, or accumulates.

## When NOT to use

- Surface appearance. Use `materials-and-shaders`.
- Full-screen effects. Use `post-processing`.
- Scene lighting. Use `lighting-design`.
- General GPU cost outside effects. Use `gpu-optimization`.

## Required context

| Fact | Why it matters |
|---|---|
| Engine, pipeline and version | Effect systems differ completely between engines |
| Target platform and fill-rate budget | Mobile is fill-rate limited; effects are the first casualty |
| Gameplay camera distance and field of view | Determines what actually reads |
| Whether the effect conveys gameplay information | Readability requirements are much stricter if so |
| Expected concurrent count | One is cheap; forty simultaneous is a different problem |

## Version constraints

Effect systems are among the fastest-changing engine subsystems, and they differ
so much between engines that concepts barely transfer. GPU simulation
availability, data interfaces and authoring tools all change between versions.
Establish the engine version and use the platform skill for specifics.

## Workflow

1. **Decide what the effect must communicate.** Gameplay-critical effects — a
   telegraph, a hit confirmation, an area of danger — have readability
   requirements that decorative effects do not, and they should be authored
   differently and be harder to disable in quality settings.

2. **Author for the real viewing conditions.** Check at the actual gameplay
   camera distance, at the actual speed, against the actual backgrounds. An
   effect authored close-up in an empty grey scene routinely disappears in a
   real environment.

3. **Get the timing right first.** Effects that convey information must be
   immediate — a delayed hit spark reads as a missed hit. Effects generally want
   a fast attack and a slower decay; uniform timing feels lifeless.

4. **Control overdraw from the start.** This is the cost decision:
   - Fit the quad to the visible content. Large mostly-empty quads pay for every
     transparent pixel, including the invisible ones.
   - Reduce the number of overlapping layers. Five stacked semi-transparent
     sprites is five full shading passes over the same pixels.
   - Use alpha cutout or opaque where the look permits — they write depth and
     stop the stacking.
   - Watch big, close, screen-filling particles; a single one can cost more than
     hundreds of small ones.

5. **Choose CPU or GPU simulation deliberately.** GPU simulation handles very
   high counts cheaply but usually cannot interact with gameplay — no reliable
   collision events, no gameplay callbacks. CPU simulation is the reverse. Pick
   by whether gameplay needs to read the particles.

6. **Set bounds correctly.** Incorrect bounds cause effects to be culled while
   visible, or to defeat culling entirely and render when off-screen. Both are
   common and both are quiet.

7. **Manage lifetime and pooling.** Effects must terminate, be poolable, and
   detach or stop cleanly when their owner is destroyed. An effect that
   outlives its emitter, or that accumulates because nothing releases it, is a
   leak that shows up as gradually worsening frame time.

8. **Budget concurrency.** Author for the worst realistic case — a busy fight,
   not one cast in isolation — and set caps so that the worst case degrades
   rather than collapses.

## Best practices

- **Measure with the overdraw view.** It is the single most useful tool here and
  it is available in every engine.
- **Fewer, better particles.** Perceived quality comes from timing, motion and
  contrast, not count.
- **Use motion and secondary motion.** Sub-emitters, trails and slight variation
  read as quality far more than raw density.
- **Vary per instance** — slight randomisation of scale, rotation and lifetime
  removes the repetitive look cheaply.
- **Set an explicit cap** on concurrent instances of an effect.
- **Keep gameplay-critical effects distinguishable** from decorative ones in
  colour and shape, and ensure quality settings cannot remove them.
- **Test against bright and dark backgrounds.** An effect readable against a
  dark wall may vanish against sky.
- **Author with a performance budget in mind** and check it as you go, not after
  the effect is finished.

## Common mistakes

- **Optimising particle count when overdraw is the cost.** The most common error
  in effects performance work.
- **Oversized quads** with mostly transparent content.
- **Screen-filling transparent effects on mobile.** Frequently unaffordable.
- **Authoring close-up in isolation.** Looks great, disappears in the game.
- **Effects that persist after their owner dies.** Visual bug and slow leak.
- **Wrong bounds.** Culled when visible, or never culled at all.
- **No concurrency cap.** Frame rate falls off a cliff in the fight that matters.
- **Gameplay-critical information carried only by an effect that quality
  settings can disable.**
- **Uniform, symmetrical timing.** Reads as artificial.
- **Relying on transparency sorting to be correct** between overlapping effects.

## Validation

- Viewed at gameplay camera distance and speed, the effect reads and its meaning
  is unambiguous.
- The overdraw view shows no unexpected hot spots; large empty quads have been
  trimmed.
- Frame time measured with the worst realistic concurrent count, not one
  instance, and within budget on the target device.
- Bounds verified: the effect is not culled while visible, and is culled when
  off-screen.
- The effect terminates and is released; spawning and destroying it repeatedly
  shows no growth in instance count or memory.
- Destroying the owner mid-effect leaves nothing behind.
- Checked against bright and dark backgrounds.
- Gameplay-critical effects remain visible at the lowest supported quality setting.

## References

- Related core skills: `rendering-fundamentals`, `materials-and-shaders`,
  `gpu-optimization`, `render-debugging`
- Platform applications: `unreal-niagara-vfx`, `unity-shaders-vfx`
