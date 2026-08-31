---
name: render-debugging
description: Diagnosing visual artifacts by isolating which stage of the frame produces them - missing or black objects, z-fighting, flickering, wrong colours, shadow acne, sorting errors, and platform-specific visual differences. Use when something looks wrong and it is not obvious why, and before changing settings hoping the artifact disappears.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: graphics
  uad-version: "1.0.0"
  uad-requires: "rendering-fundamentals, root-cause-debugging"
  uad-tags: "rendering bug, artifact, z-fighting, flicker, sorting, shadow acne, frame debugger, gpu capture, black object"
  uad-maturity: stable
---

# Render Debugging

## Purpose

Visual artifacts are debugged the same way as any other defect — by isolating
the stage where reality diverges from intent — but the tools are different: the
frame debugger, the GPU capture, and the renderer's debug views.

The failure mode this skill prevents is toggling settings until the artifact
goes away. That frequently hides the artifact somewhere else, and it teaches
nothing about the cause.

## When to use

- An object is invisible, black, white, magenta, or the wrong colour.
- Surfaces flicker or z-fight.
- Transparent objects render in the wrong order or vanish behind others.
- Shadows are missing, detached, acne-striped, or in the wrong place.
- The image differs between editor and build, or between platforms.
- Something appears only at certain distances, angles, or resolutions.

## When NOT to use

- The image is technically correct but artistically unsatisfying. Use
  `lighting-design`, `materials-and-shaders` or `post-processing`.
- The problem is cost rather than appearance. Use `gpu-optimization`.

## Required context

| Fact | Why it matters |
|---|---|
| A screenshot or capture of the artifact | "Looks wrong" cannot be diagnosed |
| Whether it reproduces in the editor, a build, or both | Narrows the cause dramatically |
| Whether it is platform-specific | Points at precision, feature support, or compression |
| What changed recently | Rendering regressions usually have a first bad commit |
| Renderer, pipeline and version | Determines available tools and likely causes |
| Whether it depends on distance, angle or resolution | Each implies a different class of cause |

## Version constraints

Debug view names, frame debugger capabilities and capture tooling change between
engine versions. More importantly, rendering behaviour itself changes: an engine
upgrade can alter defaults, deprecate a feature, or change a shading model, and
"it looked right before the upgrade" is a strong signal pointing there. Establish
the version and check the release notes for the subsystem involved.

## Workflow

1. **Capture the artifact.** A screenshot or video, with the conditions:
   distance, angle, resolution, platform, build configuration. Precision here
   determines whether the rest of the process converges.

2. **Classify it**, because the class determines where to look:

   | Symptom | Usual class of cause |
   |---|---|
   | Magenta / pink surface | Shader failed to compile or is missing for this platform |
   | Black object | No lighting reaching it, wrong shader, or failed texture |
   | Object invisible | Culled (bounds, frustum, occlusion), scaled to zero, or behind a depth write |
   | Z-fighting | Coplanar geometry, or an excessive near/far plane ratio |
   | Flickering in motion | Temporal effect instability, LOD popping, or shadow cascade transition |
   | Wrong order / vanishing transparency | Transparent sorting; inherent, not a bug to fix |
   | Shadow acne or peter-panning | Shadow bias and normal offset settings |
   | Wrong colours everywhere | Colour space or texture sRGB flags |
   | Only in a build, not the editor | Stripped shader variant, missing asset, different quality setting |
   | Only on one platform | Precision, compression format, or unsupported feature |

3. **Isolate by bisection**, the same discipline as any debugging:
   - Disable post-processing entirely. Still wrong? The cause is upstream.
   - Disable shadows. Disable GI. Disable each effect one at a time.
   - Replace the material with a default one. Still wrong? It is not the material.
   - Move the object to an empty scene. Still wrong? It is the asset, not the scene.
   Each step should halve the search space.

4. **Use the debug views.** Every renderer can display albedo, normals,
   roughness, depth, overdraw, shader complexity and light counts in isolation.
   These answer directly what staring at the composed image cannot — a normal
   map problem is invisible in the final image and obvious in the normals view.

5. **Use the frame debugger.** Step through draw calls to find where the object
   is, or is not, drawn. If the draw call is absent, it is a culling or
   submission problem, not a shading one — which redirects the entire
   investigation.

6. **Compare against a known-good reference.** A default primitive with a
   default material in the same scene separates "this asset is wrong" from "the
   scene setup is wrong" in one step.

7. **Prove the cause** by turning the artifact on and off through the claimed
   mechanism, then fix it at that level.

## Best practices

- **Bisect rather than tweak.** Systematic isolation converges; toggling does not.
- **Check the simple causes first**: import settings, scale, material assignment,
  layer and culling mask, and whether the object is actually where you think.
- **Always test in a build** when the artifact might be shader-stripping or
  quality-setting related; the editor compiles everything and hides these.
- **Keep a diagnostic scene** with reference primitives, a colour chart and a
  grey sphere. It makes calibration problems obvious immediately.
- **Check the log.** Shader compilation errors and missing asset warnings are
  frequently already reported and unread.
- **Suspect an engine upgrade** when a regression coincides with one.
- **Record the finding.** Rendering artifacts recur, and the diagnosis is worth
  more than the fix.

## Common mistakes

- **Changing settings until it looks right.** Moves the artifact rather than
  removing it, and often costs frame time permanently.
- **Blaming the shader** when the draw call was never submitted.
- **Ignoring texture import settings.** The most common cause of subtle
  colour and normal problems.
- **Only testing in the editor.** Build-only artifacts are a distinct and common
  class.
- **Expecting transparency sorting to be correct.** It cannot be in general;
  the fix is to design around it.
- **Fixing z-fighting by moving geometry** when the near plane is the cause.
- **Increasing shadow bias until acne disappears**, creating peter-panning
  instead.
- **Not checking the log.**
- **Not testing on the affected platform** when the artifact is platform-specific.

## Validation

- The cause is stated as a mechanism, not as "changing X fixed it".
- The artifact can be turned on and off by manipulating the claimed cause.
- The fix is verified in a **build**, on the affected platform, not only in the
  editor.
- No new artifact was introduced — check the neighbouring cases, particularly
  other distances, angles and quality settings.
- Frame cost re-checked if the fix involved enabling something.
- A note is recorded describing the symptom, the cause and the fix, since
  rendering artifacts recur across projects.

## References

- Related core skills: `rendering-fundamentals`, `root-cause-debugging`,
  `materials-and-shaders`, `lighting-design`, `post-processing`
- Platform applications: `unreal-rendering-features`, `unity-render-pipelines`,
  `godot-shaders`
