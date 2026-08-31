---
name: unity-animation
description: Drive characters and objects with Unity's animation stack - Animator controllers and state machines, blend trees, layers and avatar masks, humanoid retargeting, root motion versus scripted motion, Timeline and the Playables API, and animation performance including culling and transform hierarchy optimisation. Use when a state will not transition or feels unresponsive, when Write Defaults produces inconsistent poses, when root motion and a character controller fight each other, when authoring cutscenes, or when Animator.Update dominates the profiler.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: unity
  uad-domain: gamedev
  uad-version: "1.0.0"
  uad-requires: "gameplay-systems, game-architecture"
  uad-tags: "animator, mecanim, blend tree, avatar mask, root motion, timeline, playables, humanoid, animation performance"
  uad-maturity: stable
---

# Unity Animation

## Purpose

Unity animation is three stacked systems: the `Animator` state machine
(Mecanim) that most gameplay uses, the Playables graph underneath it that
actually evaluates clips, and Timeline as an authoring layer on top of
Playables. Most animation bugs come from not knowing which layer owns a value -
a transform written by both a script and a clip, a state that will not exit
because of Exit Time, or a pose that changes depending on which state you
entered from because Write Defaults is inconsistent. This skill covers all
three plus the performance characteristics of skinned meshes.

## When to use

- Building or debugging an `AnimatorController`, its parameters and transitions.
- Controls feel laggy or a state change is visibly delayed.
- A pose differs depending on the path taken through the state machine.
- Locomotion blending, aim offsets, or upper-body/lower-body layering.
- Deciding between root motion and code-driven movement.
- Authoring a cutscene, a scripted sequence, or a cinematic camera move.
- `Animator.Update`, `MeshSkinning.Update` or `Animators.Update` is heavy in the
  profiler.

## When NOT to use

- Rigidbody motion, character controllers and collision response -
  `unity-physics`. Root motion versus physics is covered here; the physics side
  is there.
- UI transitions and tweens - `unity-ui-systems`.
- Particle and VFX driven effects - `unity-shaders-vfx`.
- The DOTS animation stack, which is a different evaluation model entirely.

## Required context

- **Editor version** - `ProjectSettings/ProjectVersion.txt`. Playables and
  Animation Rigging APIs have moved across versions; verify anything unusual
  against the installed version.
- **Packages** - `Packages/manifest.json`: `com.unity.timeline`,
  `com.unity.animation.rigging` (runtime IK constraints),
  `com.unity.cinemachine` (Cinemachine 3.x on Unity 6 changed namespaces from
  `Cinemachine` to `Unity.Cinemachine`).
- **Rig type per model** - the model importer's Rig tab: `Humanoid`, `Generic`
  or `Legacy`. Humanoid enables retargeting and IK but goes through the muscle
  system, which loses non-humanoid bone motion.
- **Avatar and avatar masks** - which `Avatar` asset each character uses, and
  which `AvatarMask` assets exist for layers.
- **Write Defaults state** - open the controller and check whether states have
  Write Defaults on or off. Mixed values within a layer are a defect.
- **Who moves the character** - grep for `applyRootMotion`, `OnAnimatorMove`,
  `CharacterController.Move`, `Rigidbody.MovePosition`.
- **Animation events** - clips carry `AnimationEvent`s that call methods by
  name string; grep the clip assets or inspect them before renaming methods.

## Version constraints

- Unity 6 (`6000.x.y`) still uses Mecanim as the runtime animation system. There
  is no drop-in replacement in the current LTS - be sceptical of advice claiming
  otherwise and verify against the installed version.
- **Cinemachine 3.x** (Unity 6) is a breaking change from 2.x: types moved into
  the `Unity.Cinemachine` namespace and `CinemachineVirtualCamera` became
  `CinemachineCamera`. Check `manifest.json` before writing camera code.
- **Timeline** ships as `com.unity.timeline` and is required for
  `PlayableDirector` and `TimelineAsset`. It is present by default in most
  templates but is not part of the engine.
- **Animation Rigging** (`com.unity.animation.rigging`) is a separate package
  and its constraints run in the animation job system - its ordering relative to
  `OnAnimatorMove` differs from hand-written IK in `OnAnimatorIK`.
- `Animator.StringToHash` and the hash-based `SetFloat`/`Play` overloads have
  been stable for many versions and are safe on every supported line.

## Workflow

1. **Decide what owns motion before touching the controller.** Either the
   animation drives position (root motion) or code does. A hybrid is legitimate
   only when explicitly designed - for example root motion for attacks and code
   for locomotion - and the switch point must be a single flag
   (`animator.applyRootMotion`) flipped in one place.
2. **Model states as gameplay states, not as clips.** A state machine with one
   state per clip becomes unmaintainable at about thirty clips. Use blend trees
   for variation within a state and parameters for the axes that vary.
3. **Build locomotion as a blend tree,** not as transitions between walk and
   run. 1D on speed for simple cases; 2D Freeform Directional for strafing
   locomotion. Set the thresholds from the clips' actual root speed, or the
   character will foot-slide.
4. **Use layers with avatar masks for additive body regions.** An upper-body
   layer with a mask covering the spine and arms, blending mode Override,
   weight driven by gameplay, is the standard shape for "aim while running".
   Additive blending is for offsets (breathing, lean, recoil), not for whole
   poses.
5. **Set Write Defaults consistently across an entire layer** - and prefer off
   for gameplay controllers, so that a property is only written by states that
   actually animate it. On is acceptable only if every state in that layer is on
   and every animated property appears in every state.
6. **Configure transitions for responsiveness.** For player-driven actions,
   uncheck Has Exit Time, set a short Transition Duration, and set the
   Interruption Source deliberately. Has Exit Time on an attack state is the
   most common cause of "the game ignores my input".
7. **Cache parameter hashes.** `static readonly int Speed =
   Animator.StringToHash("Speed");` then `animator.SetFloat(Speed, v)`. String
   overloads hash every call.
8. **Reach for Playables directly when the state machine is the wrong shape.**
   `PlayableGraph`, `AnimationMixerPlayable` and `AnimationClipPlayable` let a
   system play arbitrary clips with explicit weights and no controller asset -
   the right tool for a data-driven ability system with hundreds of clips. It is
   more code and no visual authoring; do not use it where a blend tree suffices.
9. **Use Timeline for authored sequences.** A `TimelineAsset` played by a
   `PlayableDirector`, with Animation, Activation, Audio and Signal tracks.
   Bind tracks through the director's binding list, not by hard-coded lookups,
   so the same timeline works on different instances.
10. **Return control cleanly after a sequence.** When a Timeline animation track
    ends, the `Animator` resumes from whatever state it was in. Decide
    explicitly what state that is and force it with `Animator.Play`, or the
    character T-poses or snaps.
11. **Optimise last.** Enable Optimize Game Objects on the model importer to
    strip the exposed bone hierarchy, set `Animator.cullingMode` to
    `CullUpdateTransforms` or `CullCompletely` for background characters, and
    verify with the profiler markers listed in `Validation`.

## Best practices

- **Name parameters and states in a convention and never rename casually.**
  Animator parameter and state names are strings resolved at runtime; a rename
  fails silently as "the animation just does not play".
- **Drive the Animator from one place.** A single component that reads gameplay
  state and writes parameters is far easier to debug than five scripts each
  setting a trigger.
- **Prefer bools and floats over triggers.** Triggers queue and can be consumed
  by an unexpected transition or survive across states, producing an action that
  fires a second late. If a trigger is right, reset it explicitly
  (`ResetTrigger`).
- **Keep clips at their authored frame rate and let Unity resample.** Editing
  import frame rate to "fix" timing detaches the clip from its source and breaks
  the next re-export.
- **Use `CrossFadeInFixedTime` rather than `CrossFade`** when the blend duration
  should be a real duration - the non-fixed version is in normalised time of the
  target state, so it varies with clip length.
- **Delete unused layers instead of setting their weight to zero.** A layer is
  evaluated work; a zero weight is a design statement, not a performance one.
- **Attach animation events to a dedicated receiver component** on the same
  object as the `Animator`, with methods that exist only to be called by events,
  so the string coupling is contained and greppable.
- **Bake root motion into the clip correctly at import.** The Animation tab's
  Root Transform Rotation / Position (Y) / Position (XZ) "Bake Into Pose" and
  "Based Upon" settings decide whether the character drifts. Get these right at
  import rather than compensating in code.
- **Budget skinned meshes explicitly.** Bone count, mesh vertex count and the
  number of visible skinned renderers drive `MeshSkinning.Update`. LOD the
  skeleton, not just the mesh.

## Common mistakes

- **Mixed Write Defaults within a layer.** It is invisible in the editor and
  looks like random pose corruption at runtime - a property keeps the last
  value written by whichever state set it. The fix is uniformity, decided once
  per project.
- **Has Exit Time left on for interactive actions.** The default is on, so it
  arrives by accident. Input is queued until the current clip finishes,
  producing an unresponsive character that reviewers describe as "floaty".
- **Root motion enabled on a character also moved by code.** The two motions add
  and the character drifts, accelerates or slides. Pick one owner per state.
- **Root motion on a `Rigidbody` character without handling it in
  `OnAnimatorMove`.** Applying `animator.deltaPosition` directly to the
  transform bypasses collision. Feed it into `MovePosition` or the
  `CharacterController`.
- **Renaming a method that an `AnimationEvent` calls.** Nothing errors at
  compile time; the event logs a warning at runtime, once, and the footstep
  sounds are simply gone. Search clips for the method name before renaming.
- **Assuming humanoid retargeting is free of artefacts.** Muscle-space
  retargeting normalises proportions, so weapons, props and precise contact
  points drift between characters. Verify contact-critical animations per
  character rather than trusting the rig.
- **A separate Animator per small object.** Every `Animator` has fixed
  per-instance overhead and appears in `Animators.Update`. For hundreds of
  simple objects, drive them with code, a single Timeline, or the Playables API.
- **Leaving culling mode at Always Animate for every character.** Off-screen
  characters cost full evaluation. Culling requires a `Renderer` on or under the
  Animator's GameObject to determine visibility - if there is none, culling
  silently does nothing.
- **Optimize Game Objects enabled while scripts look up bone transforms.**
  The bone GameObjects no longer exist, so `transform.Find("Hand_R")` returns
  null in a build. Expose only the bones you need through the importer's Extra
  Transforms list.
- **Scaling an animated object's parent.** Root motion and blend tree thresholds
  are authored in metres of clip motion; a scaled parent silently rescales them.
- **Timeline tracks bound in the scene but not in the prefab.** The director's
  bindings are scene references, so an instantiated prefab has empty bindings
  and the timeline plays nothing. Bind at runtime with
  `director.SetGenericBinding` or use a `ControlTrack` on a self-contained
  prefab.

## Validation

1. **State machine reachability.** Open the Animator window in play mode. Every
   state the design requires should be reachable and every state should be
   exitable. Passing looks like the blue progress bar moving through the
   expected states as you play, with no state you cannot leave.
2. **Write Defaults uniformity.** Select every state in a layer and confirm the
   Write Defaults checkbox has the same value. Passing is one value per layer,
   with no exceptions.
3. **Responsiveness measurement.** Record the game at 60 fps and count frames
   between the input and the first frame of the action. Passing is a number the
   design signed off on - typically under 100 ms for an action game - not "it
   feels alright".
4. **Root motion consistency.** Play the locomotion blend tree at each blend
   threshold and confirm the feet do not slide. Passing is visually planted feet
   at the tested thresholds; if not, the thresholds do not match the clips'
   actual speeds.
5. **Profiler animation cost.** Window > Analysis > Profiler, CPU module. Watch
   `Animators.Update`, `Animator.Update`, `MeshSkinning.Update` and
   `PlayableDirector` markers, and the Timeline view's animation job threads.
   Passing is animation cost proportional to the number of *visible* characters,
   not to the number spawned - if the two match, culling is not working.
6. **Culling proof.** Enter play mode, move every character off-screen and
   confirm the animation cost drops. Passing is a measurable drop; no drop means
   the `Animator` has no renderer to cull against.
7. **Build-only bone check.** If Optimize Game Objects is enabled, make a build
   and confirm no `NullReferenceException` from bone lookups. Passing is a clean
   player log.

## References

- [Unity Manual - Animation system overview](https://docs.unity3d.com/Manual/AnimationOverview.html)
- [Unity Manual - Animator Controller](https://docs.unity3d.com/Manual/class-AnimatorController.html)
- [Unity Manual - Blend Trees](https://docs.unity3d.com/Manual/class-BlendTree.html)
- [Unity Manual - Animator layers and avatar masks](https://docs.unity3d.com/Manual/AnimationLayers.html)
- [Unity Manual - Root motion](https://docs.unity3d.com/Manual/RootMotion.html)
- [Unity Manual - Playables API](https://docs.unity3d.com/Manual/Playables.html)
- [Timeline package documentation](https://docs.unity3d.com/Packages/com.unity.timeline@latest)
- [Unity Manual - Performance and optimisation for animation](https://docs.unity3d.com/Manual/MecanimPeformanceandOptimization.html)
