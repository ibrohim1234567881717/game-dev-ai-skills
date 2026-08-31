---
name: unity-csharp-patterns
description: Write C# that behaves correctly inside Unity's player loop - MonoBehaviour lifecycle and execution order, coroutines vs async/await vs the Awaitable API, allocation and GC pressure, struct vs class, keeping Update cheap, and choosing between MonoBehaviour and ScriptableObject. Use when writing or reviewing gameplay scripts, when init order bugs appear (null references in Awake/Start), when the profiler shows GC.Alloc spikes or long Update markers, or when deciding how to schedule per-frame and asynchronous work in Unity.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: unity
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "software-architecture, cpu-optimization, memory-optimization"
  uad-tags: "monobehaviour, lifecycle, coroutines, async, awaitable, gc, allocation, update loop"
  uad-maturity: stable
---

# Unity C# Patterns

## Purpose

Unity runs C# inside a fixed player loop with its own object lifetime rules, a
non-generational-until-recently garbage collector, and a serialization system
that ignores most of what C# considers normal. Code that is idiomatic .NET is
frequently wrong here: a `null` check that lies, a `Task` that outlives the
scene, a LINQ chain that allocates 4 KB every frame. This skill covers the
Unity-specific half; the general design reasoning lives in the core skills.

## When to use

- Writing or reviewing any `MonoBehaviour`, especially `Awake`/`OnEnable`/`Start`
  initialisation.
- A `NullReferenceException` during startup that depends on scene load order or
  component order.
- The Profiler shows `GC.Alloc` per frame, or periodic `GC.Collect` spikes.
- Choosing between a coroutine, `async`/`await`, `Awaitable`, or `Update`.
- Deciding whether a piece of data should be a `MonoBehaviour`, a plain C#
  class, a `struct`, or a `ScriptableObject`.

## When NOT to use

- Data-driven asset architecture and event channels - `unity-scriptable-objects`.
- Diagnosing a specific frame-time regression with the Profiler -
  `unity-performance-profiling` has the method; this skill has the causes.
- DOTS/ECS (`com.unity.entities`) authoring - a different programming model
  entirely; do not mix its idioms into MonoBehaviour code.
- Editor-only scripting - `unity-editor-tooling`.

## Required context

- **Editor version** - `ProjectSettings/ProjectVersion.txt`. `Awaitable` exists
  from Unity 2023.1/Unity 6 onwards; on 2022.3 and earlier, coroutines or a
  third-party library are the only options.
- **Scripting backend and API level** - `ProjectSettings/ProjectSettings.asset`
  (`scriptingBackend`, `apiCompatibilityLevel`). IL2CPP has no runtime JIT, so
  reflection-heavy and `System.Reflection.Emit` code fails in builds.
- **Enter Play Mode settings** - `ProjectSettings/EditorSettings.asset`. If
  domain reload is disabled, static state survives play sessions.
- **Whether `com.unity.burst`/`com.unity.collections` are present** -
  `Packages/manifest.json`. Their presence signals jobified code with different
  rules (no managed references inside jobs).
- **Existing execution order overrides** - `ProjectSettings/ProjectSettings.asset`
  (`m_ExecutionOrder`) and any `[DefaultExecutionOrder]` attributes in the code.

## Version constraints

- **Unity 6 (`6000.x`)**: `UnityEngine.Awaitable` is the first-party
  awaitable type (`Awaitable.NextFrameAsync()`, `Awaitable.WaitForSecondsAsync()`,
  `Awaitable.EndOfFrameAsync()`, `Awaitable.MainThreadAsync()`,
  `Awaitable.BackgroundThreadAsync()`). It is allocation-light and integrates
  with `destroyCancellationToken`.
- **`MonoBehaviour.destroyCancellationToken`** exists from Unity 2022.2. Before
  that, cancel manually in `OnDestroy`.
- **Incremental GC** is available from 2019.x and enabled by default in recent
  versions (Player Settings > "Use incremental GC"). It shortens individual GC
  pauses; it does not remove allocation cost.
- C# language level follows the editor: Unity 2021.3+ targets C# 9, and Unity 6
  targets a newer level. Verify before using recent language features rather
  than assuming - the compiler error appears only when the file is imported.

## Workflow

1. **Establish the lifecycle contract for the script.** Decide, explicitly, what
   belongs in each callback: `Awake` for self-contained setup (`GetComponent` on
   itself), `OnEnable` for subscriptions, `Start` for cross-object wiring that
   requires every `Awake` to have run, `OnDisable` for unsubscription,
   `OnDestroy` for teardown. `Awake`/`OnEnable` fire before `Start` for **all**
   objects being activated in the same pass, which is the only reliable ordering
   guarantee between different components.
2. **Do not fight order with `[DefaultExecutionOrder]` first.** Restructure so
   the dependency is explicit: serialize the reference, or fetch it lazily. Use
   execution order only for genuine framework-level singletons (input polling,
   time scaling) and document why on the attribute.
3. **Choose the asynchrony model.** Per-frame stateful logic → `Update`.
   Sequenced gameplay tied to a GameObject's lifetime → coroutine. Work that
   awaits I/O, addressable loads, or must hop threads → `Awaitable` (Unity 6) or
   `async Task` with an explicit `CancellationToken`.
4. **Bind every async operation to a cancellation token.** Pass
   `destroyCancellationToken` into `Awaitable` calls and `Task` APIs. An
   `async void` method with no token keeps running after the object is
   destroyed and throws on the first Unity API call.
5. **Budget the per-frame work.** Anything in `Update` runs at frame rate times
   instance count. Prefer event-driven updates, a shared manager that iterates a
   list, or a staggered schedule (`if (Time.frameCount % 4 != index) return;`)
   over hundreds of `Update` methods - each one also costs a native→managed call
   even when empty.
6. **Eliminate per-frame allocation.** Cache component lookups; use the
   `NonAlloc`/buffer overloads; avoid `foreach` over interfaces, LINQ, string
   concatenation, boxing into `object`, and lambdas that capture. Confirm with
   the Profiler's `GC.Alloc` column, not by eye.
7. **Reconsider the container.** Data with no scene presence should not be a
   `MonoBehaviour`. Use a plain C# class owned by a system, a `struct` for small
   immutable values, and a `ScriptableObject` when designers must edit it as an
   asset.
8. **Re-profile.** A change is only an optimisation once the marker moved.

## Best practices

- **Cache `GetComponent`, `Camera.main` and `transform` results in `Awake`.**
  `Camera.main` searches by tag; `GetComponent` walks the component list. Both
  are cheap once and expensive per frame.
- **Use `CompareTag("X")` instead of `gameObject.tag == "X"`.** The property
  allocates a managed string; `CompareTag` does not.
- **Never use `==` semantics from C# on destroyed objects casually.** Unity
  overloads `==` so a destroyed `UnityEngine.Object` compares equal to `null`,
  but the C# object still exists. `?.` and `??` bypass the overload and will
  happily call into a destroyed object - avoid null-conditional operators on
  `UnityEngine.Object` types.
- **Serialize dependencies with `[SerializeField] private`** rather than making
  fields public. It keeps the inspector wiring while preserving encapsulation.
- **Prefer `struct` for small, short-lived, copy-semantics data** (grid coords,
  damage packets) to keep it off the heap - but keep it small and immutable, or
  copying costs more than it saves.
- **Subscribe in `OnEnable`, unsubscribe in `OnDisable`.** Doing it in
  `Awake`/`OnDestroy` leaks subscriptions across disable/enable cycles and keeps
  destroyed objects alive through the delegate reference.
- **Use `Time.deltaTime` in `Update` and `Time.fixedDeltaTime` in
  `FixedUpdate`.** `Time.deltaTime` inside `FixedUpdate` returns the fixed step
  in current Unity versions, which hides the mistake until timing changes.
- **Guard `Debug.Log` in hot paths.** String interpolation allocates and the log
  call itself is expensive even when the console is closed; wrap in
  `[Conditional("UNITY_EDITOR")]` helpers or a compile-time flag.

## Common mistakes

- **Cross-object work in `Awake`.** It feels like "the constructor", so people
  wire references there. Another object's `Awake` may not have run yet, so the
  reference is null on some runs and not others. Do cross-object wiring in
  `Start`, or use explicit initialisation called by an owner.
- **Coroutines silently dying.** `StartCoroutine` is bound to the
  `MonoBehaviour`; disabling the component (not just the GameObject) stops every
  coroutine it started, and they do not resume on re-enable. Long-lived
  sequences belong on an object that stays enabled.
- **`async void` with no cancellation.** It cannot be awaited, its exceptions are
  unobserved, and it outlives the scene. Every Unity API call after the object
  died throws `MissingReferenceException`, usually blamed on the wrong system.
- **Assuming `Task.Run` work can touch Unity APIs.** Almost all of `UnityEngine`
  is main-thread-only. Marshal back with `Awaitable.MainThreadAsync()` or a
  main-thread queue before touching transforms, components or assets.
- **LINQ and `foreach` in `Update`.** They read cleanly and allocate an
  enumerator plus closures every frame. At 60 fps that is thousands of small
  allocations per second and a periodic GC spike. Use indexed `for` loops over
  `List<T>` in hot paths.
- **`Instantiate`/`Destroy` per frame for bullets, hit effects or UI rows.**
  Each pair allocates and eventually triggers a collection, and `Destroy` is
  deferred to end-of-frame so the cost is not where the profiler first points.
  Pool them.
- **`FindObjectOfType` / `GameObject.Find` at runtime.** They scan the scene and
  scale with scene size. Acceptable in editor tooling, never in gameplay
  per-frame code. (Unity 6 renames these to `FindFirstObjectByType` /
  `FindAnyObjectByType`; the cost argument is unchanged.)
- **Static state assumed to reset on play.** With "Reload Domain" disabled in
  Enter Play Mode settings, statics keep their values from the previous session.
  Reset them from a
  `[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]`
  method.
- **Empty `Update()` methods left on prefabs.** Unity still pays the interop cost
  per instance per frame. Delete them.

## Validation

1. **Allocation check.** Window > Analysis > Profiler, CPU module, Hierarchy
   view, `GC.Alloc` column, while the suspect systems run. Passing looks like
   **0 B per frame** in steady state for gameplay code; any repeating non-zero
   value is a leak of allocation into the frame loop.
2. **Update cost.** In the same view, sort by Time ms and confirm no single
   `Update` marker dominates and that the `BehaviourUpdate` marker is
   proportionate to the number of active scripts you expect.
3. **Lifetime safety.** Enter play mode, destroy the object mid-operation
   (delete it in the Hierarchy) and confirm no `MissingReferenceException` or
   `NullReferenceException` appears in the Console. Passing is a clean console.
4. **Domain-reload independence.** With Enter Play Mode Options enabled and
   Reload Domain disabled, enter and exit play mode three times consecutively.
   Passing is identical behaviour every time.
5. **Build-only failure check.** Make a development build with IL2CPP if that is
   the shipping backend. Reflection or `dynamic` code that works in the editor
   commonly fails only here.

## References

- [Unity Manual - Order of execution for event functions](https://docs.unity3d.com/Manual/ExecutionOrder.html)
- [Unity Manual - Coroutines](https://docs.unity3d.com/Manual/Coroutines.html)
- [Unity Scripting API - Awaitable](https://docs.unity3d.com/ScriptReference/Awaitable.html)
- [Unity Manual - Understanding the managed heap](https://docs.unity3d.com/Manual/performance-managed-memory.html)
- [Unity Manual - Enter Play Mode settings](https://docs.unity3d.com/Manual/ConfigurableEnterPlayMode.html)
