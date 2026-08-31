# Unity project reference

## Directory map

| Path | Committed? | What it is |
|---|---|---|
| `Assets/` | yes | All source assets and scripts. Everything here gets a `.meta`. |
| `Assets/**/*.meta` | yes | GUID + importer settings. Identity of the asset. Never ignore. |
| `Packages/manifest.json` | yes | Declared package dependencies, registries, scoped registries. |
| `Packages/packages-lock.json` | yes | Resolved versions including transitive dependencies. |
| `Packages/<name>/` | yes | Embedded packages - editable, take priority over the registry copy. |
| `ProjectSettings/` | yes | All project settings assets, including `ProjectVersion.txt`. |
| `Library/` | no | Import cache, artifacts, resolved package cache. Regenerated. |
| `Temp/` | no | Live editor scratch. Present only while the editor runs. |
| `Logs/` | no | Editor and package manager logs. |
| `UserSettings/` | no | Per-user editor layout and preferences. |
| `obj/`, `*.csproj`, `*.sln` | no | Generated IDE project files. |
| `Build/`, `Builds/` | no | Player output. |
| `MemoryCaptures/`, `Recordings/` | no | Profiler captures, Recorder output. |

## Special folder names (Unity treats these differently)

| Folder | Behaviour |
|---|---|
| `Editor/` | Contents compile only in the editor, into an editor assembly. Excluded from builds. |
| `Editor Default Resources/` | Editor-only assets loadable via `EditorGUIUtility.Load`. |
| `Resources/` | Everything inside ships in the build and loads by path with `Resources.Load`. **Always included, never stripped** - a common source of build bloat. |
| `StreamingAssets/` | Copied verbatim into the build; read with `Application.streamingAssetsPath`. On Android it lives inside the APK/AAB and needs `UnityWebRequest`, not `File.IO`. |
| `Plugins/` | Native and managed plugins; platform subfolders (`Android`, `iOS`, `x86_64`) control inclusion. |
| `Gizmos/` | Textures used by `Gizmos.DrawIcon`. |
| `Standard Assets/` | Legacy first-pass compilation folder. |
| Any folder starting with `.` or ending `~` | Ignored by the asset importer - the standard way to park files Unity must not import. |

## Predefined assembly order (code with no `.asmdef`)

1. `Assembly-CSharp-firstpass` - `Standard Assets/`, `Plugins/`
2. `Assembly-CSharp-Editor-firstpass` - `Editor/` inside the above
3. `Assembly-CSharp` - everything else
4. `Assembly-CSharp-Editor` - remaining `Editor/` folders

Later assemblies can reference earlier ones, never the reverse. Nothing that
lives in an `.asmdef` assembly can reference `Assembly-CSharp` at all. That
one-way edge is why moving code into assemblies is a migration, not a rename.

## `.asmdef` fields worth knowing

| Field | Meaning |
|---|---|
| `name` | Assembly name. Must be unique. Convention: `Company.Feature[.Editor|.Tests]`. |
| `rootNamespace` | Namespace the editor puts in newly created scripts here. |
| `references` | Other assemblies, by name or by `GUID:<guid>`. GUID form survives renames. |
| `includePlatforms` / `excludePlatforms` | `["Editor"]` in `includePlatforms` makes it editor-only. |
| `allowUnsafeCode` | Enables `unsafe` blocks for this assembly. |
| `autoReferenced` | When `false`, `Assembly-CSharp` does **not** see it - forces explicit references. |
| `defineConstraints` | Compile this assembly only when these defines exist, e.g. `UNITY_INCLUDE_TESTS`, `UNITY_EDITOR`. |
| `versionDefines` | Define a symbol when a package/version range is present - the correct way to write code that adapts to an optional package. |
| `noEngineReferences` | Compile without `UnityEngine` - for pure C# libraries. |

`.asmref` files attach a folder to an assembly defined elsewhere, which is how
you split an assembly's sources across the tree without a second assembly.

## Minimal Unity `.gitignore`

```gitignore
[Ll]ibrary/
[Tt]emp/
[Oo]bj/
[Bb]uild/
[Bb]uilds/
[Ll]ogs/
[Uu]serSettings/
[Mm]emoryCaptures/
[Rr]ecordings/
/[Aa]ssets/AssetStoreTools*
.vs/
.idea/
*.csproj
*.unityproj
*.sln
*.suo
*.user
*.booproj
*.pidb
*.svd
*.pdb
*.mdb
*.apk
*.aab
*.unitypackage
sysinfo.txt
crashlytics-build.properties
```

Never add `*.meta`, `ProjectSettings/`, `Packages/manifest.json` or
`Packages/packages-lock.json` to this file.

## Smart merge (UnityYAMLMerge)

Configure Git to route `.unity`, `.prefab`, `.asset`, `.controller` and
`.mat` through Unity's semantic merge tool. In `.gitattributes`:

```gitattributes
*.unity      merge=unityyamlmerge eol=lf
*.prefab     merge=unityyamlmerge eol=lf
*.asset      merge=unityyamlmerge eol=lf
*.controller merge=unityyamlmerge eol=lf
*.mat        merge=unityyamlmerge eol=lf
```

and in `.git/config` or the global config, point `merge.unityyamlmerge.driver`
at `<UnityInstall>/Editor/Data/Tools/UnityYAMLMerge` with the arguments
`merge -p %O %B %A %A`. The exact executable name is platform-dependent
(`UnityYAMLMerge.exe` on Windows) - verify against the installed editor.

## Version strings

| `m_EditorVersion` | Line |
|---|---|
| `6000.3.x` | Unity 6.3 (current LTS) |
| `6000.2.x` | Unity 6.2 |
| `6000.1.x` | Unity 6.1 |
| `6000.0.x` | Unity 6.0 |
| `2023.x` | Pre-6 tech stream, superseded by Unity 6 |
| `2022.3.x` | Previous LTS |
| `2021.3.x` | Older LTS |

Suffixes: `f` release, `b` beta, `a` alpha. `6000.0.23f1` is release build 23
of Unity 6.0.
