---
name: post-processing
description: Configuring screen-space effects - tonemapping and exposure, colour grading, bloom, ambient occlusion, anti-aliasing, motion blur and depth of field - for look and for cost. Use when setting up a post-processing stack, when the image looks washed out, crushed, over-bloomed or aliased, or when full-screen effects are consuming too much of the frame.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: graphics
  uad-version: "1.0.0"
  uad-requires: "rendering-fundamentals"
  uad-tags: "post processing, tonemapping, colour grading, bloom, anti-aliasing, ambient occlusion, depth of field, exposure"
  uad-maturity: stable
---

# Post Processing

## Purpose

Post-processing is applied to the finished image, which makes it the easiest
place to change the look and the easiest place to hide problems that should have
been fixed earlier. Both facts matter.

The correct order of work is: fundamentals, then lighting, then materials, then
post. Grading applied to compensate for bad lighting produces a muddy image and
has to be redone when the lighting is eventually fixed.

Post-processing is also full-screen work: every effect costs the whole screen,
every frame, which makes it a frequent and under-examined performance cost.

## When to use

- Setting up the post-processing stack for a project or an area.
- The image looks washed out, crushed, over-bloomed, oversaturated or flat.
- Aliasing, shimmering or ghosting is visible in motion.
- Full-screen effects are consuming an unacceptable share of the frame.
- Establishing a consistent look across areas.

## When NOT to use

- The lighting is wrong. Use `lighting-design` — post cannot fix it, only mask it.
- Surface response is wrong. Use `materials-and-shaders`.
- Fundamentals are unestablished. Use `rendering-fundamentals`.

## Required context

| Fact | Why it matters |
|---|---|
| Renderer, pipeline and version | Stacks and effect implementations differ entirely |
| Whether HDR rendering and output are enabled | Changes tonemapping and bloom completely |
| Tonemapping curve in use | Determines how highlights roll off |
| Target platform and frame budget | Full-screen effects are expensive, especially on mobile |
| Target display range | SDR and HDR output need different grading |
| Whether players can disable effects | Motion blur and depth of field cause discomfort for some |

## Version constraints

Post-processing stacks are pipeline- and version-specific, including the
tonemapping curve, which changes the image everywhere when it is altered.
Upgrading an engine can change the default curve and shift the entire look of a
project. Establish the pipeline and version, and treat any specific effect
setting as something to verify rather than recall.

## Workflow

1. **Set tonemapping and exposure first.** Everything downstream depends on how
   HDR values are mapped to display range. Choose the curve deliberately and
   keep it fixed; changing it later invalidates all grading work.

2. **Fix the image before grading it.** If the scene is too dark, light it
   properly rather than lifting it in post. Grading is for intent, not repair.

3. **Add anti-aliasing appropriate to the pipeline.** Temporal methods give the
   best edge quality but can ghost and blur in motion, and interact badly with
   thin geometry, transparency and fast movement. Check in motion, not on a
   static screenshot — this is where temporal artifacts hide.

4. **Use bloom for what it is.** Bloom represents light scattering in the eye
   and lens for genuinely bright sources. Driven from correct HDR values it is
   subtle and convincing; used as a general glow it washes the image out and
   destroys contrast.

5. **Add ambient occlusion carefully.** It grounds objects in contact shadow.
   Excessive strength or radius produces dark halos around everything, which
   reads as dirty rather than as depth.

6. **Grade for intent, and grade last.** Colour grading sets mood and unifies an
   area. Apply it after lighting and materials are settled, and check that
   gameplay-critical elements remain readable through it.

7. **Treat depth of field and motion blur as opt-out.** Both cost frame time,
   both reduce clarity, and both cause discomfort for some players. If they are
   used, provide settings to disable them.

8. **Measure the cost of the stack.** Disable it entirely and compare frame
   time. It is common for post-processing to consume a surprising share of the
   frame, particularly on mobile where it is also bandwidth-heavy.

## Best practices

- **Fix causes upstream; use post for intent.**
- **Set the tonemapping curve once, early**, and treat changing it as a
  project-wide decision.
- **Keep bloom subtle** and driven by real HDR values rather than by a threshold
  tuned to make things glow.
- **Verify anti-aliasing in motion**, including with thin geometry and
  transparent surfaces.
- **Check gameplay readability through the grade**, not just the mood.
- **Provide accessibility settings** for motion blur, depth of field, chromatic
  aberration, film grain and screen shake.
- **Keep the stack consistent between areas** unless a change is deliberate;
  inconsistent grading reads as a bug.
- **Budget post-processing explicitly** as a share of the frame.
- **Review on the target display and on an uncalibrated one.**

## Common mistakes

- **Grading to fix lighting.** Muddy result, and the work is wasted when the
  lighting is corrected.
- **Excessive bloom.** Destroys contrast and detail, and hides highlight
  information.
- **Crushed blacks or blown highlights** from over-contrasted grading; detail is
  lost irrecoverably.
- **Heavy temporal anti-aliasing** producing ghosting and smearing, evaluated
  only on still screenshots.
- **Ambient occlusion too strong or too wide**, giving dark halos.
- **Forced motion blur and depth of field with no way to disable them.**
- **Chromatic aberration and film grain applied heavily** as a substitute for
  art direction; they also make text and UI harder to read.
- **Ignoring the cost of the stack**, particularly on mobile.
- **Different grading per area with no intent**, making the game look
  inconsistent.

## Validation

- Frame time measured with the stack enabled and disabled; the delta is known
  and within budget on the target device.
- Anti-aliasing evaluated in motion, including thin geometry and transparency.
- Highlights and shadows retain detail; check the histogram or a waveform rather
  than judging by eye.
- Gameplay-critical elements — enemies, interactables, UI, telegraphs — remain
  clearly readable through the grade at gameplay distance.
- Accessibility settings exist for motion blur, depth of field and other
  comfort-affecting effects, and actually disable them.
- The look is consistent across areas, or differences are deliberate.
- Checked on the target display and on a default, uncalibrated one.

## References

- Related core skills: `rendering-fundamentals`, `lighting-design`,
  `gpu-optimization`, `render-debugging`
- Platform applications: `unreal-rendering-features`, `unity-render-pipelines`
