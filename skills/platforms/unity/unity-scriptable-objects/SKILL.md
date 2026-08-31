---
name: unity-scriptable-objects
description: Use ScriptableObject assets as the backbone of a data-driven Unity architecture - shared configuration, event channels, runtime sets and injectable references - without falling into the mutable-asset trap. Use when designers need to author data outside scenes, when singletons and static managers are creating coupling, when replacing hard references between scenes or prefabs, or when a ScriptableObject "remembers" values between play sessions or resets unexpectedly in a build.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: unity
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "game-architecture, software-architecture"
  uad-tags: "scriptableobject, data driven, event channel, runtime set, domain reload, configuration"
  uad-maturity: stable
---

# Unity ScriptableObjects

## Purpose

A `ScriptableObject` is a serializable object that lives as an asset rather than
in a scene. That single property makes it the cleanest way in Unity to share
data between scenes, decouple prefabs that must not reference each other, and
give designers editable content without touching code. It is also the most
commonly misused type in Unity, because an asset that can be mutated at runtime
behaves differently in the editor than in a build. This skill covers both.

## When to use

- Configuration and tuning data that designers edit and that several scenes or
  prefabs share (weapon stats, enemy definitions, difficulty curves).
- Decoupling: two prefabs in different scenes need to communicate but must not
  hold direct references to each other.
- Replacing a `static` manager or `MonoBehaviour` singleton whose only job is to
  hold shared state.
- A registry of "all currently active X" that systems can query without
  scene searches.
- Strategy/policy objects: swappable behaviour selected in the inspector.

## When NOT to use

- Per-instance runtime state that must be unique per object - that belongs on
  the `MonoBehaviour` or in a plain C# object. A ScriptableObject is shared by
  every referencing instance.
- Save data. ScriptableObject changes do not persist in a player build; see
  `unity-build-pipeline` and a real serialization layer for saves.
- Very large data sets loaded all at once - see `unity-addressables-assets` for
  loading and memory ownership.
- Lifecycle-heavy logic that needs the player loop - that is a `MonoBehaviour`
  (`unity-csharp-patterns`).

## Required context

- **Editor version** - `ProjectSettings/ProjectVersion.txt`. Serialization
  behaviour and Enter Play Mode options differ across LTS lines.
- **Enter Play Mode settings** - `ProjectSettings/EditorSettings.asset`. Whether
  domain reload is disabled decides whether static caches and runtime-mutated SO
  state survive between play sessions.
- **Existing SO conventions in the project** - grep for
  `: ScriptableObject` and `[CreateAssetMenu`. Match the established menu path
  and folder layout rather than inventing a second scheme.
- **Whether the project uses Addressables** - `Packages/manifest.json`. It
  changes how SO assets get loaded and, critically, when they are unloaded.
- **Build inclusion path** - an SO asset only ships if something referenced in a
  built scene, a `Resources/` folder, or an Addressables group points at it.

## Version constraints

- The `ScriptableObject` API itself is stable across Unity 2019 through Unity 6;
  the guidance here is largely version-independent.
- What **is** version-sensitive: Enter Play Mode Options (configurable domain and
  scene reload) reached general use in 2019.3+ and is commonly enabled in Unity 6
  projects. With domain reload disabled, `static` fields and event subscriptions
  on ScriptableObjects are not cleared between play sessions.
- `OnEnable`/`OnDisable` on a ScriptableObject fire on load/unload, which is not
  a play-session boundary. Do not treat them as "start of game".
- `ScriptableObject.CreateInstance<T>()` produces a runtime instance that is not
  an asset; it is garbage-collected like any object and must not be created per
  frame.

## Workflow

1. **Classify the data.** Is it (a) read-only configuration, (b) shared mutable
   runtime state, (c) a message channel, or (d) a registry? Each has a different
   correct implementation, and conflating (a) with (b) is the root of most
   ScriptableObject bugs.
2. **For configuration, make it read-only in practice.** Fields are
   `[SerializeField] private` with public getters. Nothing writes to it at
   runtime. This is the safe, boring, correct 80% case.
3. **For shared runtime state, do not store it on the asset.** Store it in a
   runtime instance the asset creates or points to, or reset it explicitly at a
   known point. If you must mutate the asset, implement
   `ISerializationCallbackReceiver` or an explicit `Initialize()` invoked at
   session start, and be able to state exactly when it resets.
4. **For event channels**, define an SO with a `UnityEvent`/`Action` and a
   `Raise()` method. Listeners subscribe in `OnEnable` and unsubscribe in
   `OnDisable` - always both, or subscriptions leak across domain reloads and
   accumulate duplicate handlers.
5. **For runtime sets**, keep a `List<T>` on the asset that objects add
   themselves to in `OnEnable` and remove themselves from in `OnDisable`. Clear
   the list on session start; a stale entry from the previous play session is
   the classic symptom.
6. **Add `[CreateAssetMenu(fileName = "...", menuName = "Project/Category/Name")]`**
   so designers can create instances, and place assets under a predictable
   folder that build/Addressables rules can target.
7. **Verify build inclusion.** Trace a reference chain from a scene in
   `EditorBuildSettings.asset`, a `Resources/` folder, or an Addressables group
   to the asset. An SO referenced only by editor code does not ship.
8. **Validate the reset story.** Enter play mode, mutate, exit, re-enter. State
   what the values should be and confirm they are.

## Best practices

- **Treat SO assets as immutable at runtime unless you have designed the reset.**
  The mental model that works: an SO is a design-time document, not a variable.
- **Use `OnValidate` for authoring-time constraints** (clamp ranges, warn about
  invalid combinations). It runs in the editor when a value changes and catches
  bad data before it reaches a build.
- **Prefer many small typed assets over one giant settings object.** They diff
  cleanly, merge cleanly, and can be loaded independently.
- **Give event-channel and runtime-set SOs an explicit reset entry point** and
  call it from a bootstrapping scene, so behaviour is identical with or without
  domain reload.
- **Use `[SerializeReference]` for polymorphic data inside an SO** when you need
  interface-typed fields; plain `[SerializeField]` cannot serialize polymorphism
  and silently stores the base type.
- **Keep behaviour in the SO where it makes it swappable** (an `AbilityDefinition`
  with an abstract `Execute`), but keep per-cast state out of it.
- **Reference SOs directly in the inspector rather than loading by path.**
  Direct references are validated at build time; `Resources.Load` string paths
  fail at runtime.

## Common mistakes

- **Assuming runtime edits are discarded.** In the editor, writing to an SO
  asset during play mode persists to disk after exiting play mode - designers
  lose tuning values, or gain values they never meant to save. In a **build**,
  the same writes are lost when the app closes. The two environments disagree,
  which is why the bug reaches production.
- **Using an SO as save data.** It looks like it works in the editor (see
  above), then ships and loses everything on app restart. Use `Application.persistentDataPath`
  with real serialization.
- **Subscribing in `Awake` and never unsubscribing.** Because the SO outlives
  scenes, its delegate list accumulates dead listeners across scene loads,
  keeping destroyed objects alive and firing into them. Always
  `OnEnable`/`OnDisable`.
- **Expecting `OnEnable` on the SO to mean "game start".** It fires when the
  asset is loaded, which may be during the previous scene, may be at build-time
  import in the editor, and may be never for an unreferenced asset.
- **Relying on domain reload to clear an SO's runtime set.** It works on the
  developer's machine with reload enabled, then breaks for whoever turned Enter
  Play Mode Options on for faster iteration. Clear explicitly.
- **Creating instances with `CreateInstance` per frame** (for damage packets or
  messages). Each is a full managed object with serialization overhead; use a
  plain class or struct.
- **Two ScriptableObject assets of the same type where the code assumed one.**
  Nothing in Unity enforces a singleton asset. If exactly one must exist,
  validate it in an editor check rather than assuming.
- **Putting an SO inside `Resources/` "so it always loads".** Everything in
  `Resources/` ships and is loaded into memory at startup by the resource
  system's index; it is a build-size and load-time cost that Addressables or a
  direct reference avoids.

## Validation

1. **Play-mode round trip.** Enter play mode, change values through gameplay,
   exit, and inspect the asset in the Inspector. Passing means the on-disk
   values are exactly what you designed for - either unchanged (config) or
   deliberately persisted with a documented reason.
2. **Domain-reload parity.** Toggle Edit > Project Settings > Editor > Enter Play
   Mode Settings (Reload Domain off) and repeat the scenario twice without
   restarting the editor. Passing is identical behaviour both times, and no
   duplicate event firing.
3. **Listener leak check.** Load and unload the same scene three times, then
   inspect the channel's subscriber count (log it from a debug method). Passing
   is a constant count, not one that grows by scene load.
4. **Build inclusion.** Make a development build and confirm the SO's data is
   present at runtime (log a known field). Passing means the value matches the
   asset; a default/zero value means it was never included.
5. **Editor validation pass.** With `OnValidate` implemented, deliberately enter
   an out-of-range value and confirm the console warns or the value clamps.

## References

- [Unity Manual - ScriptableObject](https://docs.unity3d.com/Manual/class-ScriptableObject.html)
- [Unity Scripting API - ScriptableObject](https://docs.unity3d.com/ScriptReference/ScriptableObject.html)
- [Unity Manual - Script serialization](https://docs.unity3d.com/Manual/script-Serialization.html)
- [Unity Manual - Enter Play Mode settings](https://docs.unity3d.com/Manual/ConfigurableEnterPlayMode.html)
