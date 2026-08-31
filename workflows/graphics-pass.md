---
name: graphics-pass
description: Improve the visual quality of a scene or area in the order that avoids rework - fundamentals, then lighting, then materials, then post-processing, measuring cost as you go. Use when a scene looks flat, muddy, or wrong, when establishing a look for an area, or when visual quality must improve without breaking the frame budget.
metadata:
  uad-workflow: graphics-pass
  uad-version: "1.0.0"
  uad-skills: "rendering-fundamentals, lighting-design, materials-and-shaders, post-processing, render-debugging, gpu-optimization"
---

# /graphics-pass

```
DETECT PIPELINE -> FUNDAMENTALS -> LIGHTING -> MATERIALS -> POST -> MEASURE -> COMPARE
```

**The order is the point.** Grading a badly lit scene, or authoring materials
under the wrong colour space, produces work that has to be redone. Each stage
depends on the one before it being right.

## Steps

### 1. Detect the pipeline

```bash
python tools/uad.py detect . --verbose
```

Rendering advice does not port. Establish:

- **Unity** — URP, HDRP, or Built-in, from `Packages/manifest.json`.
- **Unreal** — engine version from `EngineAssociation`, features from
  `Config/DefaultEngine.ini`.
- **Godot** — `renderer/rendering_method` in `project.godot`.

State which pipeline you are working against. Everything below depends on it.

### 2. Capture the starting point

Screenshots from the actual gameplay camera, at the actual field of view, in the
locations that matter. Plus a frame-time measurement. These are your before.

### 3. Check the fundamentals

Before touching anything visual, confirm with `rendering-fundamentals`:

- Colour space is linear, and textures are correctly flagged sRGB (colour) or
  linear (normal, roughness, metallic, masks).
- World scale is correct — a character-height reference matches.
- Exposure is understood; auto-exposure **off** while authoring.

If any of these is wrong, fix it first. Everything downstream is invalid until
they are right, and this is the step that gets skipped.

### 4. Lighting

Key light first, until the scene reads correctly with only that. Then fill, then
accents. Check readability before mood: can a player find the path and see
what matters? Configure shadows for the actual gameplay distance, not the
maximum.

### 5. Materials

With lighting settled, check that surfaces respond plausibly: albedo in a real
range, metallic binary, roughness carrying the material character, normal maps
oriented correctly. Use the debug views rather than judging from the final image.

### 6. Post-processing

Tonemapping and exposure first, then bloom driven by real HDR values, then
grading for intent. Grade last, and check that gameplay-critical elements remain
readable through it.

### 7. Measure the cost

```
Frame time before / after, on the target device.
Cost of the post-processing stack, measured by disabling it.
The shadow pass specifically — usually the largest single lighting cost.
```

Visual quality trades against frame time. An improvement that breaks the budget
is not an improvement; hand it to `/optimize`.

### 8. Compare

Side-by-side screenshots from the same camera positions as step 2. Review at
gameplay distance, not from a close free camera, and on the target display.

## Done means

- [ ] The pipeline is stated and the work was done against it.
- [ ] Fundamentals verified before any tuning: colour space, texture flags, scale.
- [ ] The scene reads — a player unfamiliar with it can navigate and identify
      what matters.
- [ ] Before and after screenshots from identical cameras.
- [ ] Frame time measured before and after on the target device, within budget.
- [ ] Checked on a non-calibrated display as well as the development one.
- [ ] No artifact introduced — sorting, z-fighting, shadow acne, temporal
      ghosting all checked in motion.

## Common failure

Doing this in the wrong order. If you find yourself grading in post to fix
darkness, stop and go back to lighting. If you find yourself adjusting lights to
fix a material that looks like plastic, stop and check the roughness map's
colour space setting.
