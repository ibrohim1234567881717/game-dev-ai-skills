# Unreal project layout reference

Verify anything version-sensitive against the engine version resolved from the
`.uproject`. Enum values in particular gain new entries every release.

## `.uproject` shape

```json
{
  "FileVersion": 3,
  "EngineAssociation": "5.7",
  "Category": "",
  "Description": "",
  "Modules": [
    { "Name": "MyGame", "Type": "Runtime", "LoadingPhase": "Default" },
    { "Name": "MyGameEditor", "Type": "Editor", "LoadingPhase": "PostEngineInit" }
  ],
  "Plugins": [
    { "Name": "GameplayAbilities", "Enabled": true },
    { "Name": "OnlineSubsystemSteam", "Enabled": false }
  ]
}
```

`EngineAssociation` values:

| Value | Meaning | Where the version really lives |
|---|---|---|
| `"5.7"` | Launcher/binary install | The string itself |
| `"{GUID}"` | Registered source build | `Engine/Build/Build.version` in that engine tree |
| `""` (empty) | Project sits inside the engine tree | `Engine/Build/Build.version` of the parent tree |

## Module types and loading phases

| `Type` | Included in | Typical content |
|---|---|---|
| `Runtime` | All targets | Gameplay code |
| `RuntimeNoCommandlet` | All but commandlets | Rare |
| `Editor` | Editor targets only | Asset actions, details customisations, commandlets |
| `Developer` | Non-shipping | Debug tooling (semantics tightened in UE5 - check) |
| `Program` | Standalone programs | Tools built on the engine |

| `LoadingPhase` | Loads |
|---|---|
| `EarliestPossible` | Before engine init, minimal engine available |
| `PostConfigInit` | After config, before most subsystems - needed to hook config |
| `PreDefault` | Before default modules |
| `Default` | Normal gameplay modules |
| `PostEngineInit` | After the engine is up - typical for editor modules |

## `.Build.cs` skeleton

```csharp
using UnrealBuildTool;

public class MyGame : ModuleRules
{
    public MyGame(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[] {
            "Core", "CoreUObject", "Engine", "InputCore", "EnhancedInput"
        });

        PrivateDependencyModuleNames.AddRange(new string[] {
            "Slate", "SlateCore", "UMG", "GameplayTags"
        });
    }
}
```

- `Public*` dependencies are inherited by dependents; `Private*` are not. Default to private.
- Adding a plugin module here is not enough - the plugin must also be enabled in the
  `.uproject` (or be a dependency of an enabled plugin).
- `bUseUnityBuild = false` on a module surfaces missing includes that unity builds hide.
  Slow, but the only reliable way to find them.

## `.Target.cs` skeleton

```csharp
using UnrealBuildTool;

public class MyGameTarget : TargetRules
{
    public MyGameTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;                       // Game | Client | Server | Editor | Program
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("MyGame");
    }
}
```

Pinning `BuildSettingsVersion`/`EngineIncludeOrderVersion` to a specific value rather
than `Latest` is the safer choice when upgrading engines: it keeps old semantics while
you migrate. The available enum entries differ per engine version - read
`Engine/Source/Programs/UnrealBuildTool/Configuration/TargetRules.cs` in the installed
engine rather than guessing.

## Directory map

| Path | Committed | Notes |
|---|---|---|
| `Source/` | yes | C++ modules, `.Build.cs`, `.Target.cs` |
| `Content/` | yes | `.uasset`, `.umap` - binary, unmergeable |
| `Config/` | yes | `Default*.ini`; platform overrides in `Config/<Platform>/` |
| `Plugins/` | yes | Project plugins (each with its own `Source/`, `Content/`) |
| `Binaries/` | no | Compiled DLLs/exes; delete freely to force a rebuild |
| `Intermediate/` | no | Generated headers (`*.generated.h`), obj files, IDE projects |
| `Saved/` | no | Logs (`Saved/Logs/`), autosaves, crash dumps, cooked staging |
| `DerivedDataCache/` | no | Local DDC |

`Saved/Logs/<Project>.log` is the first place to look for any startup or runtime failure.

## Naming conventions

| Prefix | Applies to |
|---|---|
| `U` | `UObject` subclasses that are not actors |
| `A` | `AActor` subclasses |
| `F` | Plain structs and classes, delegates |
| `I` | Interfaces (the `IFoo` half of the `UFoo`/`IFoo` pair) |
| `E` | Enums |
| `T` | Templates (`TArray`, `TSubclassOf`) |
| `S` | Slate widgets |
| `b` | Boolean variables (`bIsAlive`) |

Assets: `BP_` blueprint, `WBP_` widget blueprint, `ABP_` animation blueprint,
`SM_` static mesh, `SK_` skeletal mesh, `M_` material, `MI_` material instance,
`MF_` material function, `T_` texture, `NS_` Niagara system, `NE_` Niagara emitter,
`DA_` data asset, `DT_` data table, `GA_` gameplay ability, `GE_` gameplay effect.

## Commands worth knowing

| Purpose | Command |
|---|---|
| Regenerate IDE project files | `Engine/Build/BatchFiles/Build.bat -projectfiles -project="<abs>.uproject" -game -engine` |
| Build editor target | `Engine/Build/BatchFiles/Build.bat <Project>Editor Win64 Development -Project="<abs>.uproject" -WaitMutex` |
| Run a commandlet | `UnrealEditor-Cmd.exe "<abs>.uproject" -run=<Commandlet> -unattended -nopause` |
| Open project from CLI | `UnrealEditor.exe "<abs>.uproject" -log` |

`-log` opens a separate log window and is worth adding to every manual editor launch.
