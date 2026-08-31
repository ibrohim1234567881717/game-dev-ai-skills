---
name: level-design-and-environment
description: Building levels that play well and run well - blockout before art, readability and player guidance, metrics and scale, modularity and reuse, and the streaming and occlusion structure that keeps a level affordable. Use when creating or revising a level or environment, when players get lost or stuck, or when a level is over budget on frame time or memory.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: graphics
  uad-version: "1.0.0"
  uad-requires: "game-architecture"
  uad-tags: "level design, environment art, blockout, metrics, readability, modularity, occlusion, streaming, whitebox"
  uad-maturity: stable
---

# Level Design and Environment

## Purpose

Levels fail in two ways that are both decided early and expensive to fix late:
players cannot read them, and they cannot be made to run within budget because
their structure does not permit culling or streaming.

Both are addressed at blockout, before any art exists. A level that is fun as
untextured grey boxes will be fun when finished; one that is not, will not be
rescued by art.

## When to use

- Starting a new level or area.
- Players get lost, miss objectives, or fail to see the intended path.
- Combat spaces play badly — no cover, unclear sightlines, unfair encounters.
- A level exceeds frame time or memory budget.
- Establishing modular kit and metrics conventions for a project.

## When NOT to use

- Lighting a level that is already built. Use `lighting-design`.
- Purely technical rendering cost with no layout component. Use
  `gpu-optimization`.
- Procedural generation of layouts. Use `procedural-generation`, then apply this
  skill's readability criteria to the output.

## Required context

| Fact | Why it matters |
|---|---|
| Player metrics | Everything is measured against them; without them nothing is buildable |
| Camera and field of view | Determines what the player can see and therefore what reads |
| Core gameplay verbs | A level supports specific actions, not "gameplay" generally |
| Performance budget | Structure must permit meeting it |
| Whether the world streams | Streaming imposes structural requirements from the start |
| Modular kit and grid | Consistent snapping is what makes reuse possible |

**Player metrics are the foundation.** Character height, walk and run speed,
jump height and distance, crouch height, cover height, reach, and how far the
character travels in a second. Every dimension in the level derives from them.
Building before they are fixed guarantees rework.

## Version constraints

Layout and readability principles are version-independent. The technical
structure is not: streaming systems, occlusion culling, level partitioning and
LOD/HLOD generation differ per engine and change across versions. Establish the
engine version and consult the platform skill before committing to a structure,
because restructuring a finished level for streaming is close to rebuilding it.

## Workflow

1. **Fix the metrics first**, and build a metrics reference block-out — a set of
   marked boxes at character height, cover height, jump distance, maximum step.
   Every designer on the project uses the same one.

2. **Blockout in grey boxes.** Layout, scale, sightlines and flow only. Play it.
   Iterate on the layout while it costs nothing to change. This is the single
   most valuable practice in level design and the most frequently skipped.

3. **Design the player's path deliberately.** Where should they go, and what
   tells them? Use composition — framing, converging lines, landmarks visible
   from a distance, contrast — rather than relying on a marker or a quest arrow
   to do the work.

4. **Give the space a legible shape.** Players build a mental map from
   landmarks, distinct silhouettes and clear connections. Corridors that all look
   alike, symmetrical layouts, and repeated geometry without landmarks are how
   players get lost.

5. **Structure encounters against the metrics.** Sightline lengths that match
   weapon ranges, cover spacing that matches movement speed, approach options,
   and space to retreat. A combat space is a set of distances.

6. **Build occlusion into the layout.** Long open sightlines mean everything is
   drawn. Corners, elevation changes, and interior spaces let the renderer cull.
   This is a layout decision with a rendering consequence, and it must be made at
   blockout — you cannot add occlusion to a finished open plan.

7. **Plan streaming boundaries early** if the world streams. Cells or areas need
   natural transitions — corridors, doorways, elevation changes — where loading
   can happen unnoticed. Retrofitting these is a rebuild.

8. **Then art-pass.** Modular kit pieces snapped to a consistent grid, reused
   aggressively, with variation from decals, props, lighting and material
   variants rather than from unique geometry.

9. **Measure cost as you build**, not at the end. Track frame time and memory at
   milestones so a regression is attributable to what was just added.

## Best practices

- **Grey box, play, iterate — before any art.**
- **Keep the metrics block visible in the level file** while building.
- **Snap to a grid.** Consistent snapping is what makes a modular kit reusable
  and what stops seams and light leaks.
- **Guide with composition, not markers.** A level that needs an arrow to be
  navigable has a layout problem.
- **Use landmarks.** Something distinctive and visible from multiple areas is the
  cheapest orientation aid there is.
- **Vary with props and lighting, not unique geometry.** Unique geometry costs
  memory, build time and reuse.
- **Design vertical sightlines carefully** — players read horizontally far more
  readily than vertically, and things above and below them are routinely missed.
- **Test with someone who has not seen the level.** You cannot evaluate
  readability of a space you built.
- **Budget per area** and check as you go.

## Common mistakes

- **Art-passing before the layout plays well.** The most expensive mistake in
  level production, because the art has to be redone.
- **Building before the metrics are fixed.** Everything is the wrong size.
- **Long open sightlines everywhere.** Nothing culls; the level cannot hit budget.
- **Repeated geometry with no landmarks.** Players cannot build a mental map.
- **Symmetrical layouts.** Read as confusing rather than elegant; players lose
  orientation.
- **Relying on quest markers for navigation.** Masks a layout that does not work.
- **Unique geometry where a kit piece would do.** Memory and time.
- **Ignoring streaming structure until late.** Effectively a rebuild.
- **Only testing as the designer who built it.** You already know the way.
- **Leaving performance measurement to the end**, when attributing a regression
  is no longer possible.

## Validation

- A player who has not seen the level completes the intended path without
  direction, and can describe the layout afterwards. Run this with a real person.
- The level plays well in grey box, before art.
- All dimensions derive from the metrics; spot-check cover heights, jump gaps
  and door widths against the reference block.
- Frame time and memory measured per area against budget, on the target platform.
- Occlusion is effective: check the rendered-object count in enclosed spaces
  versus open ones, and confirm culling is actually happening.
- If streaming, transitions are checked at speed for pop-in and hitches.
- No unreachable geometry, no places the player can leave the level or become
  stuck; test the edges deliberately.
- Modular pieces snap cleanly with no seams or light leaks.

## References

- Related core skills: `game-architecture`, `lighting-design`,
  `loading-and-streaming`, `asset-optimization`, `gpu-optimization`,
  `procedural-generation`
- Platform applications: `unreal-world-partition-streaming`
