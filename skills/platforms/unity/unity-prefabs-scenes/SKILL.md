---
name: unity-prefabs-scenes
description: Work correctly with Unity prefabs, prefab variants, nested prefabs and overrides, and with scene composition including additive loading and multi-scene setups. Use when structuring content so a team can work in parallel, when prefab overrides are being lost or unexpectedly applied, when a nested prefab change does not propagate, when scenes conflict in version control, or when deciding what belongs in a scene versus a prefab versus an additively loaded chunk.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: unity
  uad-domain: production
  uad-version: "1.0.0"
  uad-requires: "game-architecture, version-control-workflow, level-design-and-environment"
  uad-tags: "prefab, variant, nested prefab, overrides, additive scene, merge conflict, scene organisation"
  uad-maturity: stable
---

# Unity Prefabs and Scenes

## Purpose

Prefabs and scenes are Unity's content units, and both are YAML files that a
team edits concurrently. Getting their structure right decides whether five
people can work on a level at once or whether every pull request is a merge
conflict. Getting override semantics right decides whether a designer's tuning
survives the next prefab edit. This skill covers prefab identity and override
rules, nested and variant prefabs, and additive scene composition.

## When to use

- Deciding what becomes a prefab, a prefab variant, or a separate additive scene.
- Prefab overrides disappear, or an edit to a prefab fails to reach instances.
- Two people cannot work on the same level without conflicts.
- A `.unity` or `.prefab` file conflicts in a merge.
- Structuring a scene for additive loading, streaming or per-team ownership.
- `Instantiate` at runtime produces an object missing inspector-assigned data.

## When NOT to use

- Loading content by address, memory ownership and unload timing -
  `unity-addressables-assets`.
- The scripts on the prefab and their lifecycle - `unity-csharp-patterns`.
- Configuration data that has no scene presence - `unity-scriptable-objects`.
- Build inclusion of scenes and player settings - `unity-build-pipeline`.

## Required context

- **Editor version** - `ProjectSettings/ProjectVersion.txt`. Nested prefabs and
  variants exist from 2018.3 onwards; every currently supported LTS has them.
- **Serialization mode** - `ProjectSettings/EditorSettings.asset`,
  `m_SerializationMode: 2` (Force Text). Anything else means scenes are binary
  and cannot be merged or reviewed.
- **Build scene list** - `ProjectSettings/EditorBuildSettings.asset`. This, not
  the folder layout, is what ships and what `SceneManager.LoadScene(int)` indexes.
- **Whether scenes load additively** - grep for `LoadSceneMode.Additive`,
  `SceneManager.LoadSceneAsync`, and Addressables `LoadSceneAsync`.
- **Merge tooling** - is `UnityYAMLMerge` configured in `.gitattributes` /
  git config? Without it, scene merges are line-based and unsafe.
- **Prefab GUID references** - the `.meta` of every prefab. Missing `.meta`
  files are how instances become "Missing Prefab".

## Version constraints

- Prefab variants, nested prefabs and Prefab Mode (with context) are stable from
  2018.3 through Unity 6; the concepts here apply to every supported LTS.
- Unity 6 changed some editor menus and added Build Profiles, which can carry
  their own scene lists - if `Assets/Settings/Build Profiles/` exists, check the
  active profile as well as `EditorBuildSettings.asset`.
- `PrefabUtility` API names have been stable since 2018.3
  (`SavePrefabAsset`, `ApplyPrefabInstance`, `RevertPrefabInstance`,
  `InstantiatePrefab`, `GetOutermostPrefabInstanceRoot`), but check the exact
  overload against the installed editor before relying on it in tooling.
- Scene and prefab YAML layout is a serialization format, not a public API. Do
  not hand-edit it except to resolve a merge, and never generate it.

## Workflow

1. **Decide the unit.** A thing that repeats or is edited independently is a
   **prefab**. A family of things differing by a few values is a **variant** (or,
   better, one prefab plus a `ScriptableObject` for the data). A region of a
   level owned by one person is an **additive scene**.
2. **Design the prefab root deliberately.** The root GameObject's components and
   name are the stable identity. Adding a new root later to reparent everything
   breaks every instance's overrides.
3. **Keep instance overrides intentional and few.** Position/rotation/scale
   overrides are normal; a dozen component-value overrides on every instance is
   a sign the data belongs in a `ScriptableObject` or a variant.
4. **Prefer composition over deep variant chains.** A variant of a variant of a
   variant is legal and unmaintainable: a change three levels up reaches through
   in ways nobody predicts.
5. **For scene composition, split by ownership and by load boundary.** A
   persistent bootstrap scene (managers, camera rig, UI root) plus additive
   content scenes lets several people edit at once and gives loading a natural
   unit.
6. **Wire cross-scene references through an intermediary,** never directly.
   Unity does not serialize references between scenes at edit time (cross-scene
   references are blocked in the editor). Use a `ScriptableObject` registry, a
   service locator, or a scene-loaded callback that resolves references.
7. **When merging a conflicted scene**, prefer re-doing the smaller change over
   hand-merging YAML. If you must merge, use `UnityYAMLMerge`; verify by opening
   the scene and checking the Hierarchy, not by reading the diff.
8. **Verify propagation.** After editing a prefab, open a scene containing
   instances and confirm the change arrived and that no override silently
   blocked it.

## Best practices

- **One prefab, one responsibility.** A prefab that contains the player, the
  camera, the HUD and the audio manager cannot be reused or owned by one person.
- **Use Prefab Mode (double-click the asset) for prefab edits**, and the
  Overrides dropdown on an instance to review what differs before applying.
  "Apply All" without reading the list is how one designer's local tweak becomes
  everyone's default.
- **Apply overrides at the right level.** The Overrides dropdown lets you apply
  a single modified property to the base prefab or to an intermediate variant -
  choose the level that owns the concept.
- **Name additive scenes by role** (`Level_01_Geometry`, `Level_01_Lighting`,
  `Level_01_Gameplay`) so ownership and merge risk are obvious.
- **Bake lighting per scene deliberately.** Lightmap data is stored per scene;
  additively loaded scenes each carry their own lighting data and the active
  scene's lighting settings win. Set the active scene explicitly with
  `SceneManager.SetActiveScene` after an additive load.
- **Keep scenes small and prefabs deep.** Content inside a prefab conflicts far
  less than content laid out directly in the scene, because a prefab instance is
  a handful of YAML lines.
- **Use `.gitattributes` to route `.unity`, `.prefab`, `.asset`, `.controller`
  and `.mat` through `UnityYAMLMerge`** so semantic merging is even possible.

## Common mistakes

- **Renaming or restructuring a prefab's child hierarchy.** Overrides and
  references are stored against the child's `fileID` path; restructuring orphans
  them, and the editor reports them as removed components or lost overrides on
  every instance, sometimes only after a reimport.
- **Editing an instance and forgetting to apply.** The change works in that
  scene and nowhere else, and then someone reverts the instance and it
  evaporates. Check the Overrides dropdown before committing.
- **"Apply All" from an instance that carried a deliberate local tweak.** It
  pushes the tweak to the base prefab and to every other instance. Review the
  override list first; apply single properties.
- **Cross-scene references.** Dragging an object from one open scene onto a
  field in another looks like it works in the editor and cannot be serialized;
  the reference is null after a reload or in a build.
- **Assuming `Instantiate` copies inspector wiring from the scene.** It copies
  the prefab asset's serialized state. Fields that were only set on a particular
  scene instance are not in the prefab.
- **A `Missing Prefab` placeholder committed to the repository.** It means the
  prefab's `.meta` (GUID) was lost or the asset was deleted outside Unity.
  Restore the `.meta` from history rather than re-creating the prefab, which
  produces a new GUID and breaks all other references.
- **Multi-scene setups where every scene has its own audio listener, event
  system or main camera.** Additive loading brings them all in; Unity warns
  about duplicate `AudioListener` and `EventSystem` objects and input behaviour
  becomes non-deterministic.
- **Nested prefab edits made in the outer prefab's context** without noticing
  the change targets the inner asset. Prefab Mode shows the context breadcrumb;
  read it.

## Validation

1. **Override review.** Select each modified prefab instance and open the
   Overrides dropdown. Passing means every listed override is deliberate and
   nothing you intended to apply is still local.
2. **Propagation test.** Change one property in Prefab Mode, save, then open a
   scene with two instances. Passing means both instances show the new value
   except where an override deliberately shadows it.
3. **Additive load test.** Enter play mode from the bootstrap scene, load and
   unload a content scene twice. Passing is: no duplicate `AudioListener`
   warnings, no `EventSystem` conflicts, no growing object count in the
   Hierarchy, and lighting that matches the single-scene case.
4. **Merge safety.** `git config --get merge.unityyamlmerge.driver` returns the
   configured driver and `.gitattributes` lists the Unity asset extensions.
   Passing is both present.
5. **Clean reimport.** Delete `Library/` and reopen the project. Passing is a
   Console with no `Missing Prefab`, no missing script warnings, and scenes that
   open with the expected Hierarchy.

## References

- [Unity Manual - Prefabs](https://docs.unity3d.com/Manual/Prefabs.html)
- [Unity Manual - Prefab variants](https://docs.unity3d.com/Manual/PrefabVariants.html)
- [Unity Manual - Nested prefabs](https://docs.unity3d.com/Manual/NestedPrefabs.html)
- [Unity Manual - Multi-scene editing](https://docs.unity3d.com/Manual/MultiSceneEditing.html)
- [Unity Manual - Smart merge](https://docs.unity3d.com/Manual/SmartMerge.html)
