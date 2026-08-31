---
name: rendering-fundamentals
description: The concepts every rendering task depends on - the frame pipeline, colour space and gamma, physically based shading inputs, transparency and sorting, depth and precision, and units and scale. Use before working on lighting, materials, shaders or post-processing, and when diagnosing visuals that look subtly wrong everywhere rather than in one asset.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: graphics
  uad-version: "1.0.0"
  uad-tags: "rendering, pipeline, colour space, gamma, linear, pbr, transparency, depth, sorting, scale"
  uad-maturity: stable
---

# Rendering Fundamentals

## Purpose

Most rendering problems that resist fixing are not bugs in the thing being
worked on. They are violations of a fundamental: colour handled in the wrong
space, a scene built at the wrong scale, transparency sorted incorrectly, or
material inputs that are not physically plausible.

This skill covers the concepts the other graphics skills assume. It is
deliberately engine-neutral: every renderer implements these, with different
names.

## When to use

- Before lighting, material, shader or post-processing work, if the
  fundamentals have not been established for the project.
- When everything looks subtly wrong — washed out, too dark, oddly saturated —
  rather than one asset looking wrong.
- When transparent objects render in the wrong order or disappear.
- When distant geometry flickers or z-fights.
- When lighting cannot be made to look right no matter how it is tuned.
- When onboarding to an unfamiliar renderer.

## When NOT to use

- A specific artifact in a specific asset. Use `render-debugging`.
- Frame cost. Use `gpu-optimization`.
- Engine-specific feature configuration. Use the platform's rendering skill.

## Required context

| Fact | Why it matters |
|---|---|
| The renderer and its version | Determines defaults and available features |
| Colour space setting | Linear versus gamma changes every subsequent decision |
| Working units and world scale | Physically based lighting assumes real-world units |
| Whether HDR is enabled | Affects exposure, bloom and the meaning of colour values |
| Forward or deferred shading | Constrains transparency, lighting count and material features |

## Version constraints

The physics is stable. Everything else is renderer- and version-specific:
default colour space, tonemapping curve, exposure model, and which shading
model is used. Confirm each against the project's renderer rather than assuming;
a project that was upgraded may carry legacy settings that contradict the
version's defaults.

## Workflow

1. **Establish the colour space.** Rendering must happen in linear space; only
   the final output is converted for display. Getting this wrong produces
   lighting that cannot be tuned into looking right, because light is being
   added in the wrong space. Check that colour textures (albedo, UI) are treated
   as sRGB and that data textures (normal, roughness, metallic, masks) are
   **not** — treating a normal map as sRGB is a common and destructive error.

2. **Establish scale.** Physically based lighting assumes real-world units.
   A scene built at ten times scale has light falling off over the wrong
   distances and cannot be lit convincingly. Confirm what one unit means and
   check that a character-height reference object matches it.

3. **Establish exposure.** Many "the lighting is wrong" reports are exposure.
   Decide whether auto-exposure is on, and if so, note that it makes lighting
   comparisons between shots unreliable — turn it off while authoring.

4. **Understand the frame's passes.** Broadly: depth, shadow maps, opaque
   shading, transparent shading, then post-processing. Knowing which pass an
   effect happens in explains most "why can't I do X" questions — for example,
   why transparent surfaces often cannot receive the same effects as opaque ones.

5. **Get material inputs physically plausible.** In a PBR workflow: albedo is
   the base colour with no lighting baked in, and real-world albedo rarely goes
   below about 0.03 or above 0.9; metallic is effectively binary — a surface is
   metal or it is not; roughness carries almost all of the perceived material
   character. Implausible inputs cannot be rescued by lighting.

6. **Handle transparency deliberately.** Transparent surfaces are sorted per
   object and blended in order, which cannot be correct for interpenetrating or
   concave geometry. Prefer opaque or alpha-cutout where the art allows; where
   true transparency is needed, accept that sorting artifacts are inherent and
   design around them.

7. **Respect depth precision.** Z-fighting on distant geometry is almost always
   an excessive near-to-far plane ratio. Raising the near plane helps far more
   than lowering the far plane, because precision is distributed non-linearly.

## Best practices

- **Author under neutral, known lighting**, then light the scene. Materials
  authored under a dramatic light are wrong everywhere else.
- **Keep a calibration reference** — a grey sphere, a colour chart, a
  known-height figure — in the scene while authoring.
- **Fix fundamentals before tuning.** Time spent grading a scene with the wrong
  colour space is time spent twice.
- **Know which pipeline the project uses** before proposing anything; forward
  and deferred differ in transparency, light count and material support.
- **Use the debug views.** Every renderer can show albedo, normals, roughness,
  overdraw and complexity in isolation. They answer questions that staring at
  the final image cannot.
- **Prefer fewer, better-placed lights** to many weak ones.

## Common mistakes

- **Working in gamma space and fighting the lighting.** The lighting was never
  the problem.
- **Marking data textures as sRGB.** Normal maps and roughness maps become
  subtly and unfixably wrong.
- **Building at the wrong world scale.** Everything about lighting and physics
  becomes approximate.
- **Albedo with lighting or ambient occlusion painted into it.** Double-shading
  under real lighting.
- **Partial metallic values** on surfaces that are not genuinely mixed.
- **Relying on transparency sorting to be correct.** It cannot be, in general.
- **A near plane of 0.01 with a far plane of 100 000.** Guaranteed z-fighting.
- **Tuning with auto-exposure on**, then wondering why nothing is consistent.
- **Copying settings between renderers.** They mean different things.

## Validation

- Colour space is set to linear, and texture import settings correctly classify
  colour versus data textures — spot-check a normal map.
- A known-height reference object matches the intended world scale.
- A neutral grey surface under neutral light reads as neutral grey on screen.
- Albedo values sit within a plausible range; check with the albedo debug view.
- Metallic is 0 or 1 except where genuinely justified.
- Transparent objects are inspected from several angles for sorting errors.
- No z-fighting at the far end of the view distance; near/far ratio is sane.
- The same scene viewed on a second display or device still reads correctly.

## References

- Related core skills: `lighting-design`, `materials-and-shaders`,
  `post-processing`, `render-debugging`, `gpu-optimization`
- Platform applications: `unity-render-pipelines`, `unreal-rendering-features`
