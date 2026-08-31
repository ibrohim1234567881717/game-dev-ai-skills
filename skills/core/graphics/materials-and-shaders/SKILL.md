---
name: materials-and-shaders
description: Authoring materials and shaders that look right and cost what you expect - PBR inputs, texture channel packing, shader variants and permutations, node graphs versus hand-written code, and instancing. Use when creating or debugging materials, writing shader code, when a surface does not respond correctly to light, or when shader cost or build times have grown.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: graphics
  uad-version: "1.0.0"
  uad-requires: "rendering-fundamentals"
  uad-tags: "materials, shaders, pbr, textures, shader graph, variants, permutations, instancing, roughness"
  uad-maturity: stable
---

# Materials and Shaders

## Purpose

Materials decide how surfaces respond to light. Most material problems are one
of three things: physically implausible inputs, textures interpreted in the
wrong colour space, or a shader that costs far more than its author realised.

This skill covers authoring and diagnosing them, engine-neutrally. Shader
languages and node systems are platform-specific; the platform skills cover
those.

## When to use

- Authoring materials for a new asset or environment.
- A surface looks wrong under light — plastic when it should be metal, flat when
  it should have depth, wrong colour under some lighting but not others.
- Writing or modifying shader code.
- Shader compilation or build times have grown unreasonably.
- Draw calls are high because of material variety.

## When NOT to use

- The scene's lighting is the problem. Use `lighting-design`. Distinguish them
  by checking whether the material is wrong under *all* lighting or only this one.
- Fundamentals are unestablished. Use `rendering-fundamentals` first.
- Full-screen effects. Use `post-processing`.
- Particle and effect authoring. Use `vfx-and-particles`.

## Required context

| Fact | Why it matters |
|---|---|
| Renderer, pipeline and version | Shaders do not port between pipelines |
| Shading model in use | Standard PBR, or something custom, changes every input's meaning |
| Texture import settings | sRGB versus linear is the most common source of subtle wrongness |
| Target platform | Mobile has hard limits on samples, instructions and precision |
| Whether the project uses node graphs or hand-written shaders | Do not introduce the other without reason |

## Version constraints

Shader code is the least portable thing in a game project. It does not port
between renderers, and frequently not between major versions of the same
renderer: node libraries change, shading models are added or replaced, and
included helper files move. Establish the pipeline and version, and expect any
shader to need rework when either changes.

## Workflow

1. **Check the inputs before blaming the shader.** In a PBR workflow most
   "broken material" reports are input problems:
   - **Albedo** is base colour with no lighting, shadow or ambient occlusion
     baked in. Real-world values rarely fall below about 0.03 or above 0.9.
   - **Metallic** is effectively binary. Values in between exist only for
     genuinely mixed surfaces at a texel level, such as dirt over metal.
   - **Roughness** carries most of the perceived material character. If a
     surface reads as the wrong material, roughness is the first thing to check.
   - **Normal** maps must be imported as linear data, never sRGB, and must match
     the renderer's expected handedness — an inverted green channel makes
     lighting appear to come from the wrong side.

2. **Verify colour space per texture.** Colour textures are sRGB; data textures
   — normal, roughness, metallic, masks, height — are linear. This single
   setting silently ruins materials and is easy to miss because the texture
   still looks fine in the browser.

3. **Pack channels.** Roughness, metallic, occlusion and similar single-channel
   data belong in the channels of one texture rather than three separate ones.
   This reduces samples, memory and bandwidth, and it is nearly free to do at
   authoring time and expensive to retrofit.

4. **Prefer instances over unique materials.** A parameterised parent material
   with instances that vary values keeps batching effective and shader
   permutations down. Dozens of near-identical unique materials is a common and
   avoidable cause of high draw calls.

5. **Watch the variant explosion.** Every keyword, toggle and feature
   combination multiplies the number of shaders compiled. This is the usual
   cause of long build times, large packages, and runtime hitches when a shader
   compiles on first use. Strip unused variants and prefer numeric parameters
   over compile-time toggles where the cost allows.

6. **Measure shader cost.** Use the shader complexity view and the platform's
   instruction or cycle count. Texture samples and dependent texture reads are
   usually more expensive than arithmetic; dynamic branching can be worse than
   computing both sides.

7. **Test under multiple lighting conditions.** A material tuned under one
   dramatic light will be wrong everywhere else. Check under neutral, bright,
   dark and coloured light.

## Best practices

- **Author against a reference.** Real photographs or a material reference chart
  beat memory for what a surface should look like.
- **One parameterised parent, many instances.**
- **Name and organise texture channels consistently** across the project, and
  write the convention down. Inconsistent packing is a permanent tax.
- **Keep mobile shaders simple**, and check instruction counts on the target
  rather than assuming.
- **Precompile or warm shaders** before they are needed, so first-use
  compilation does not appear as a hitch in gameplay.
- **Comment shader code with intent.** Shader maths is unusually hard to read
  later, and the reason for a magic constant is never recoverable.
- **Version shader changes carefully.** A change to a shared parent material
  affects every instance, which is exactly what makes them efficient and exactly
  what makes a careless edit expensive.

## Common mistakes

- **Normal or roughness maps imported as sRGB.** Subtly wrong everywhere,
  frequently undiagnosed for months.
- **Ambient occlusion or shadow painted into albedo.** Double-darkened under
  real lighting.
- **Partial metallic values** on surfaces that are simply not metal.
- **Albedo too dark or too bright** to be a real material, making lighting
  impossible to tune.
- **Inverted normal map green channel.** Lighting appears to come from the wrong
  direction; extremely common when mixing assets from different sources.
- **A unique material per object.** Destroys batching.
- **Uncontrolled shader keywords.** Build times and package size grow until
  someone investigates.
- **Tuning a material under one light only.**
- **Copying a shader between pipelines** and expecting it to work. It will not.
- **Complex shaders on mobile without measuring.**

## Validation

- Albedo values fall within a plausible range — check with the albedo debug view,
  not by eye on the final image.
- Metallic is 0 or 1 except where genuinely justified.
- Every texture's colour space setting matches its role; spot-check normal and
  roughness maps specifically.
- Normal map orientation verified against a reference sphere or a known-good asset.
- The material reads correctly under neutral, bright, dark and coloured lighting.
- Shader complexity is within budget for the target platform, measured with the
  engine's view.
- Shader variant count is known and bounded; build time and package size checked
  after adding a keyword.
- Draw calls checked after material changes, confirming batching still works.

## References

- Related core skills: `rendering-fundamentals`, `lighting-design`,
  `vfx-and-particles`, `render-debugging`, `gpu-optimization`,
  `asset-optimization`
- Platform applications: `unreal-materials-shading`, `unity-shaders-vfx`,
  `godot-shaders`
