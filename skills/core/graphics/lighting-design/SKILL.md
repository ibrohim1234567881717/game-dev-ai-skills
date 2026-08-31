---
name: lighting-design
description: Lighting a scene for readability and mood while staying within budget - key/fill/rim structure, direct versus indirect light, baked versus dynamic, shadow configuration, and exposure. Use when setting up lighting for a level, when a scene reads poorly or players cannot navigate it, when lighting looks flat or blown out, or when lighting cost is too high.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: graphics
  uad-version: "1.0.0"
  uad-requires: "rendering-fundamentals"
  uad-tags: "lighting, shadows, global illumination, baked, dynamic, exposure, mood, readability, light bake"
  uad-maturity: stable
---

# Lighting Design

## Purpose

Lighting does two jobs at once: it tells the player where to go and what
matters, and it sets the mood. When they conflict, readability wins — a
beautiful scene the player cannot navigate is a failed scene.

This skill covers the structure and the technical decisions. It is
engine-neutral; the platform skills cover each engine's specific systems.

## When to use

- Lighting a new level or area.
- Players get lost, miss the path, or fail to notice interactive objects.
- The scene looks flat, muddy, blown out, or uniformly lit.
- Lighting cost is over budget, or bake times have become unworkable.
- Moving between renderers or pipelines, where lighting must be reworked.

## When NOT to use

- Fundamentals are not established. Fix colour space, scale and exposure first
  with `rendering-fundamentals`; lighting cannot be tuned around them.
- The problem is material response rather than light. Use
  `materials-and-shaders`.
- Colour grading and screen effects. Use `post-processing` — and grade after
  lighting, never instead of it.

## Required context

| Fact | Why it matters |
|---|---|
| Renderer, pipeline and version | Determines which lighting systems exist |
| Whether GI is baked, dynamic, or both | The central decision; changes the whole workflow |
| Whether the scene or time of day changes | Rules out baking if geometry or lighting moves |
| Target platform and budget | Mobile and console constrain light counts and shadows |
| Intended mood and readability goals | Lighting without intent is just illumination |
| Exposure model | Auto-exposure makes comparisons unreliable while authoring |

## Version constraints

Lighting systems change substantially between engine versions — real-time GI
solutions, shadow techniques and light types have all been added, promoted from
experimental, and changed defaults across recent releases of every major engine.
Establish the engine version and pipeline before configuring anything, and treat
any specific setting name as something to verify.

## Workflow

1. **Decide what the lighting must communicate.** Where should the player look?
   Where should they go? What must be legible? Write it down before placing
   lights; this is the difference between lighting design and light placement.

2. **Establish exposure and turn auto-exposure off while authoring.** Otherwise
   every change is compensated for and nothing can be compared.

3. **Light in a hierarchy.** Establish the dominant light source first — sun,
   sky, or the main practical — and get the scene reading correctly with only
   that. Then add fill to control how dark shadows go, and only then accents and
   rim light to separate important objects from their background. Placing many
   lights before the key light reads correctly produces a scene nobody can tune.

4. **Choose baked versus dynamic deliberately.** Baked indirect light is far
   cheaper and usually better looking, but requires static geometry and a bake
   step that costs iteration time. Dynamic solutions cost frame time but allow
   changing time of day and destructible or movable geometry. Most projects are
   a hybrid: bake the static world, keep characters and key gameplay lights
   dynamic.

5. **Use indirect light deliberately.** Bounce is what makes a scene read as
   real. A scene lit only by direct light looks like a diorama, with black
   shadows and no colour transfer between surfaces.

6. **Configure shadows for cost and quality.** Shadow rendering is frequently
   the most expensive lighting cost. Set cascade count and distance to the
   actual gameplay distance, not the maximum; disable casting on small props
   that contribute nothing; and check for peter-panning and shadow acne, which
   are bias settings rather than lighting problems.

7. **Control contrast for readability.** Guide the eye with brightness contrast
   and colour temperature contrast — warm key against cool shadow is the
   long-standing default because it works. Keep the intended path brighter or
   more saturated than its surroundings.

8. **Check on the target display and device.** A scene tuned on a bright,
   calibrated monitor is often unreadable on a phone in daylight or on a
   television with default settings.

## Best practices

- **Readability first, mood second.** Both are achievable; when they conflict,
  the player must still be able to play.
- **Fewer, better-placed lights.** Each dynamic light costs, and many weak
  lights produce a flat, muddy result.
- **Motivate lights.** A light with a visible source reads as real; one without
  reads as a mistake, even when the viewer cannot say why.
- **Use light to separate.** A rim or back light that separates a character from
  the background does more for readability than raising overall brightness.
- **Set light range and attenuation tightly.** Oversized ranges cost frame time
  and light things they should not.
- **Bake early and often** if baking, so bake time does not become a surprise
  at the end of production.
- **Keep a lighting reference scene** — grey spheres, a colour chart, a
  character-height figure — to check calibration across areas.
- **Review at the game's actual camera distance and field of view**, not from a
  free camera up close.

## Common mistakes

- **Tuning lighting before fixing colour space or scale.** The work has to be
  redone.
- **Adding lights to fix darkness instead of raising fill or ambient.** Produces
  an unmanageable pile of lights.
- **Pure black shadows.** Real shadows are filled by bounce and sky; pure black
  reads as broken.
- **Blowing out highlights** so surface detail is lost.
- **Uniform lighting everywhere.** No contrast means no readability and no mood.
- **Baking with movable geometry**, giving shadows that stay behind when objects
  move.
- **Shadow distance set to the maximum** because it looks better in a
  screenshot, at large and unnecessary cost.
- **Unmotivated lights** floating with no visible source.
- **Only checking on the development monitor.**
- **Grading in post to rescue bad lighting.** It suppresses the symptom and
  usually makes the scene muddier.

## Validation

- A player unfamiliar with the level can find the intended path without
  direction. This is the real test, and it is worth running with an actual person.
- Important interactive objects are distinguishable from set dressing at
  gameplay distance.
- No area is unreadably dark or blown out; check the histogram or the
  luminance debug view rather than trusting your adapted eye.
- Shadows are inspected for acne and peter-panning at the near and far cascade
  boundaries.
- Lighting cost is measured and within the budget; check the shadow pass
  specifically, since it is usually the largest.
- The scene is checked on the target device and on a non-calibrated display.
- If baked, the bake completes and is committed; movable objects are excluded
  from the bake correctly.

## References

- Related core skills: `rendering-fundamentals`, `materials-and-shaders`,
  `post-processing`, `render-debugging`, `gpu-optimization`,
  `level-design-and-environment`
- Platform applications: `unreal-rendering-features`, `unity-render-pipelines`
