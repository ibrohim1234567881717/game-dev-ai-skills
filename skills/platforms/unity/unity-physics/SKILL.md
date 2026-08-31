---
name: unity-physics
description: Make Unity's built-in PhysX rigidbody simulation behave - fixed timestep and FixedUpdate, interpolation, kinematic versus dynamic bodies, collider and trigger rules, the layer collision matrix, raycasts and overlap queries, continuous collision detection for fast movers, and the classic bugs like jitter, tunnelling and stale query results. Use when objects pass through walls, when collisions or triggers do not fire, when physics jitters or drifts with frame rate, when a character controller fights the simulation, or when the physics step dominates the profiler.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: unity
  uad-domain: gamedev
  uad-version: "1.0.0"
  uad-requires: "gameplay-systems, root-cause-debugging"
  uad-tags: "rigidbody, collider, fixedupdate, fixed timestep, interpolation, layer matrix, raycast, continuous collision, tunnelling, jitter"
  uad-maturity: stable
---

# Unity Physics

## Purpose

Unity's 3D physics is PhysX driven on a fixed timestep that is decoupled from
the render frame rate, and almost every physics bug in a Unity project is a
consequence of that one fact - work done in the wrong callback, transforms
written instead of forces applied, or queries run against a simulation state
that has not been synchronised. This skill covers the built-in `Rigidbody`
simulation and its 2D counterpart. It does not cover the DOTS Unity Physics
package, which is a different solver with different semantics.

## When to use

- Objects pass through geometry at speed, or only at high frame rates.
- `OnCollisionEnter` / `OnTriggerEnter` never fires, or fires twice.
- Movement jitters, stutters, or changes speed when the frame rate changes.
- A player controller feels like it is fighting the simulation.
- Raycasts hit nothing, hit the caster, or hit stale positions.
- `FixedUpdate` or `Physics.Processing` dominates the CPU profile.
- Designing a layer collision matrix or a query layer mask scheme.

## When NOT to use

- DOTS / ECS physics (`com.unity.physics`) - different API, different threading
  model, and none of the advice below transfers.
- Animation-driven motion and root motion - `unity-animation`.
- Vehicle, cloth, ragdoll or joint *authoring* as a content problem - those need
  tuning workflows beyond this skill's scope, though the timestep rules still
  apply.
- Frame-time analysis method - `unity-performance-profiling` has the method,
  this skill has the physics-specific causes.

## Required context

- **Editor version** - `ProjectSettings/ProjectVersion.txt`. Unity 6 renamed
  several `Rigidbody` members (see Version constraints); code written for one
  line does not compile on the other.
- **Fixed timestep and max allowed timestep** -
  `ProjectSettings/TimeManager.asset` (`Fixed Timestep`, default `0.02` = 50 Hz;
  `Maximum Allowed Timestep`, default `0.3333`).
- **Physics settings** - `ProjectSettings/DynamicsManager.asset`: gravity,
  default solver iterations, `m_DefaultMaxDepenetrationVelocity`,
  Queries Hit Triggers, Auto Sync Transforms, Simulation Mode, and the
  serialised **layer collision matrix**.
- **Layer names** - `ProjectSettings/TagManager.asset`. Layer masks in code are
  meaningless without the name-to-index mapping.
- **2D or 3D** - `Physics2DSettings.asset` and `Rigidbody2D` usage. The two
  systems are separate: `Physics.Raycast` never hits a 2D collider.
- **Existing movement code** - grep for `transform.position =`,
  `MovePosition`, `AddForce`, `CharacterController.Move`. Mixed strategies on
  one object are the usual root cause.

## Version constraints

- **Unity 6 (`6000.x.y`) renamed rigidbody members.** `Rigidbody.velocity` is
  now `linearVelocity`, `drag` is `linearDamping`, `angularDrag` is
  `angularDamping`; `Rigidbody2D.velocity` is likewise `linearVelocity`. The old
  names remain as deprecated aliases in the 6000.0 line but produce warnings and
  are being removed - write the new names on Unity 6, the old ones on 2022.3 and
  earlier.
- **`PhysicMaterial` was renamed `PhysicsMaterial`** in Unity 6. Assets keep
  working; the type name in code changes.
- **`Physics.simulationMode`** (`SimulationMode.FixedUpdate` / `Update` /
  `Script`) replaced the older `Physics.autoSimulation` boolean in 2022.2.
  Manual stepping is `Physics.Simulate(step)`.
- **`Physics.autoSyncTransforms` defaults to `false`** in all currently
  supported versions. This is the single most surprising default: a transform
  written this frame is not visible to a query until the next physics step or an
  explicit `Physics.SyncTransforms()`.
- Collision detection modes are Discrete, Continuous, Continuous Dynamic and
  Continuous Speculative. Continuous Speculative is the only continuous mode
  available to kinematic bodies.
- If a specific API's presence in the project's version is uncertain, check
  against the editor version rather than assuming - PhysX-facing APIs have moved
  more than most of `UnityEngine`.

## Workflow

1. **Classify every moving object.** Each one is exactly one of: a dynamic
   `Rigidbody` moved by forces, a kinematic `Rigidbody` moved by
   `MovePosition`/`MoveRotation`, a `CharacterController` moved by `Move`, or a
   non-physics transform that must not carry a collider that things collide
   with. Write the classification down; most bugs are an object that is secretly
   two of these.
2. **Put physics writes in `FixedUpdate` and only there.** `AddForce`,
   `MovePosition`, `linearVelocity` assignment and torque all belong in
   `FixedUpdate`, scaled by `Time.fixedDeltaTime` where a rate is implied.
   Input capture stays in `Update`; store it and consume it in `FixedUpdate`.
3. **Never write `transform.position` on a body with a collider that should
   collide.** It teleports past the solver: no sweep, no contacts, no
   depenetration. Use `MovePosition` for kinematic bodies and forces or velocity
   for dynamic ones. Direct transform writes are for spawning and respawning
   only, and even then follow with `Physics.SyncTransforms()` if a query runs in
   the same frame.
4. **Turn on interpolation for what the camera watches.** `Rigidbody.interpolation
   = RigidbodyInterpolation.Interpolate` smooths the render pose between physics
   steps. Set it on the player and on anything held or followed; leave it off on
   the hundreds of background props, because it costs memory and CPU per body.
5. **Set the collision detection mode by speed.** Discrete for everything by
   default; Continuous or Continuous Dynamic for projectiles and fast vehicles;
   Continuous Speculative when the fast mover is kinematic. Continuous modes are
   materially more expensive - apply them per object, never project-wide.
6. **Design the layer collision matrix deliberately.** Project Settings >
   Physics > Layer Collision Matrix. Unchecking a pair removes the broadphase
   work entirely, which is both a correctness tool and the cheapest performance
   win available. Mirror the same layers into query masks so that
   `Physics.Raycast(..., layerMask)` agrees with what actually collides.
7. **Write queries with explicit masks and buffers.** Always pass a
   `layerMask` and a `QueryTriggerInteraction`; never rely on the global
   defaults. In hot paths use the non-allocating overloads
   (`Physics.RaycastNonAlloc`, `Physics.OverlapSphereNonAlloc`,
   `Physics.SphereCastNonAlloc`) with a pre-allocated array, and remember they
   return a count and do not sort by distance.
8. **Keep colliders cheap and correct.** Primitive colliders (box, sphere,
   capsule) are far cheaper than mesh colliders. A `MeshCollider` on a moving
   object must be `convex`, is limited to a modest polygon count, and should be
   a simplified collision mesh rather than the render mesh.
9. **Tune the timestep last, and consciously.** A smaller fixed timestep means a
   more stable simulation and proportionally more CPU. A larger one is cheaper
   and lets fast objects tunnel. Change it only after the movement code is
   correct, and re-test every tuned value that was authored against the old
   rate.
10. **Verify against the profiler and the physics debugger,** not by feel. See
    `Validation`.

## Best practices

- **One authority per object.** If a script writes velocity and another writes
  position on the same body, the result is frame-order dependent and
  unreproducible. Give each body a single owner.
- **Scale forces by mass intentionally.** `ForceMode.Force` and `Acceleration`
  differ by whether mass is applied; `Impulse` and `VelocityChange` are their
  instantaneous equivalents. Picking the wrong one is why "the same force"
  behaves differently on two objects.
- **Keep mass ratios within roughly two orders of magnitude.** A 0.01 kg body
  jointed to a 1000 kg body is numerically unstable no matter how many solver
  iterations you add.
- **Prefer scaling colliders through their own size fields.** Non-uniform
  `transform.localScale` on capsules and mesh colliders produces shapes PhysX
  approximates badly, and scale changes at runtime force collider re-cooking.
- **Cache `GetComponent<Rigidbody>()` in `Awake`.** Physics code runs 50 times a
  second by default; component lookups there are pure waste.
- **Use `Rigidbody.Sleep` semantics rather than disabling components.** Bodies
  sleep automatically below `sleepThreshold`; toggling a `Rigidbody` component's
  enabled state or re-parenting it forces expensive re-registration.
- **Use `ContactPoint` data instead of re-raycasting** in collision callbacks.
  The contact normal and point are already there in `Collision.GetContact(0)`.
- **Reduce `Collision` allocation** by consuming `collisionInfo` in the callback
  rather than storing it; the object is reused by the engine and its contents
  are only valid inside the call.
- **Prefer layers over tag comparisons in physics callbacks.** Layer checks are
  an integer test the broadphase already did; tag comparison happens after the
  contact is generated and paid for.

## Common mistakes

- **Moving a collider by `transform.position` and expecting collisions.** It is
  the most direct-looking code and it looks fine in the editor because the
  object visually stops sometimes. Objects pass through walls, contacts are
  missed and pushing does nothing. Use kinematic `MovePosition` or dynamic
  forces.
- **Applying force in `Update` scaled by `Time.deltaTime`.** Force accumulates
  per physics step, not per frame, so behaviour changes with frame rate and
  differs between the editor and a build. Move it to `FixedUpdate`.
- **Expecting trigger events between two objects with no `Rigidbody`.** Unity
  needs at least one `Rigidbody` (kinematic counts) in the pair for
  `OnTriggerEnter` and `OnCollisionEnter` to fire. Two static colliders generate
  nothing, and this is the single most common "my trigger does not work".
- **Raycasting immediately after writing a transform.** With
  `autoSyncTransforms` off, the query runs against the last synced pose, so the
  ray misses or hits the old position. Call `Physics.SyncTransforms()` or
  restructure so queries run after the physics step.
- **Fast projectiles on Discrete detection.** Bullets tunnel through thin walls,
  and worse, they tunnel only on slower machines where more distance is covered
  per step. Use a continuous mode, or replace the projectile with a raycast
  along the travel segment each step.
- **Lowering the fixed timestep to fix jitter.** It is tempting because it
  appears to work, and it multiplies physics cost across the whole game. Jitter
  is nearly always missing interpolation or a transform write; fix the cause.
- **Interpolation on every rigidbody in the scene.** It hides a symptom and
  costs per-body memory and CPU. It also makes objects render a step behind,
  which is wrong for anything used as a precise reference frame.
- **Using `Time.deltaTime` inside `FixedUpdate`.** In current Unity versions it
  returns the fixed step, so the code is accidentally right and stays wrong in
  the reader's mental model. Write `Time.fixedDeltaTime` so intent is explicit.
- **Parenting a rigidbody to a moving transform.** The parent's motion is
  applied outside the solver, so the child accumulates impossible velocities or
  jitters. Use joints, or move the child explicitly.
- **A single "Default" layer for everything.** Every collider pair is tested
  against every other, the matrix cannot help, and query masks become
  impossible. Layers cost nothing and are the first thing to get right.
- **Assuming `OnCollisionStay` runs every frame.** It runs per physics step, and
  not at all once the bodies sleep. Frame-rate-linked logic there is subtly
  wrong.

## Validation

1. **Physics Debugger visual check.** Window > Analysis > Physics Debugger.
   Enable it in play mode and confirm each object's collider, layer and
   sleep state are what you think. Passing looks like no unexpected colliders,
   no colliders on objects that should be visual-only, and bodies going to sleep
   when at rest.
2. **Frame-rate independence test.** Run the same movement at
   `Application.targetFrameRate` of 30, 60 and 144 with vsync off. Passing looks
   like the same distance travelled and the same jump height at all three. Any
   divergence means physics work is happening in `Update`.
3. **Tunnelling test.** Fire the fastest projectile in the game at the thinnest
   wall in the game, 50 times, including with the frame rate artificially
   lowered. Passing is 50 hits.
4. **Trigger coverage test.** Enter every trigger volume from every approach
   direction, including at maximum speed. Passing is one `OnTriggerEnter` per
   entry, with the matching `OnTriggerExit`.
5. **Profiler physics cost.** Window > Analysis > Profiler, CPU module. Look for
   `FixedUpdate.PhysicsFixedUpdate`, `Physics.Processing`,
   `Physics.ProcessReports` and `Physics.SyncColliderTransforms`. Passing is a
   physics cost that stays proportional to the number of active bodies and does
   not grow when nothing is moving - growth at rest means bodies are not
   sleeping.
6. **Step-count sanity.** Log the number of `FixedUpdate` calls per second under
   load. Passing is `1 / fixedDeltaTime` (50 by default). A number that climbs
   above it under load means the simulation is trying to catch up and is
   approaching the Maximum Allowed Timestep clamp - a physics death spiral.
7. **Layer matrix audit.** Read the matrix and confirm every enabled pair is
   intentional. Passing is a matrix where you can state why each checked cell is
   checked.

## References

- [Unity Manual - Physics](https://docs.unity3d.com/Manual/PhysicsSection.html)
- [Unity Manual - Rigidbody component](https://docs.unity3d.com/Manual/class-Rigidbody.html)
- [Unity Manual - Continuous collision detection](https://docs.unity3d.com/Manual/ContinuousCollisionDetection.html)
- [Unity Manual - Layer-based collision detection](https://docs.unity3d.com/Manual/LayerBasedCollision.html)
- [Unity Manual - Time and frame rate management](https://docs.unity3d.com/Manual/TimeFrameManagement.html)
- [Unity Manual - Physics Debug visualisation](https://docs.unity3d.com/Manual/PhysicsDebugVisualization.html)
- [Unity Scripting API - Physics](https://docs.unity3d.com/ScriptReference/Physics.html)
