# Roblox container, script and toolchain reference

Everything here is current-behaviour at the time of writing. Roblox ships a
rolling engine with no version gates, so confirm anything load-bearing against
`create.roblox.com/docs` before depending on it.

## Container matrix

| Container | Replicated to client | Scripts run | Typical contents |
|---|---|---|---|
| `ServerScriptService` | no | `Script` (server) | Server systems, remote handlers, authoritative game logic |
| `ServerStorage` | no | none (storage) | Server-only modules, drop tables, prefabs the client must not see |
| `ReplicatedStorage` | yes (source readable) | `ModuleScript` on require | Remotes, shared types, shared constants, client-visible assets |
| `ReplicatedFirst` | yes, before everything else | `LocalScript` | Loading screen, `ReplicatedFirst:RemoveDefaultLoadingScreen()` |
| `StarterPlayer/StarterPlayerScripts` | copied into `PlayerScripts` once | `LocalScript` | Client controllers, input, camera |
| `StarterPlayer/StarterCharacterScripts` | copied into the character each spawn | `LocalScript` | Per-character client logic |
| `StarterGui` | copied into `PlayerGui` per spawn | `LocalScript` | UI |
| `Workspace` | yes | `Script` (server) | The physical world |
| `Players` | yes | none | `Player` objects, `Backpack`, `PlayerGui`, `PlayerScripts` |
| `Lighting`, `SoundService`, `Teams` | yes | none | Configuration and assets |

`StarterGui` and `StarterPack` contents are copied per spawn; edits to the
copies in `PlayerGui`/`Backpack` do not persist across respawn unless
`ResetOnSpawn` is false on the `ScreenGui`.

## Script classes

| Class | Runs where | Started by | Notes |
|---|---|---|---|
| `Script` | server (`RunContext = Legacy` or `Server`) | engine, when in a runnable container | With `RunContext = Client` it runs on the client from containers a `LocalScript` cannot reach |
| `LocalScript` | client only | engine, only from client-reachable containers | Silently does nothing anywhere else |
| `ModuleScript` | wherever it is required | `require()` | Result cached per side; never runs on its own |

`require` caching is per side and per script-context: a module required by both
the server and a client is two independent instances with independent state.

## Rojo project file shape

```json
{
  "name": "my-game",
  "tree": {
    "$className": "DataModel",
    "ReplicatedStorage": {
      "Shared":   { "$path": "src/shared" },
      "Packages": { "$path": "Packages" }
    },
    "ServerScriptService": {
      "Server": { "$path": "src/server" }
    },
    "StarterPlayer": {
      "StarterPlayerScripts": { "$path": "src/client" }
    },
    "Workspace": { "$properties": { "StreamingEnabled": true } }
  }
}
```

- `$path` mounts a directory or file.
- `$className` names the instance class for a synthetic folder.
- `$properties` sets properties on the instance.
- `$ignoreUnknownInstances` controls whether Rojo deletes instances it did not
  create in that container. Default differs between mounted and synthetic
  instances — check before assuming Studio-side additions survive a sync.

File-to-instance rules: `Foo.luau` → `ModuleScript` named `Foo`;
`Foo.server.luau` → `Script`; `Foo.client.luau` → `LocalScript`;
`init.luau` in a directory makes the directory itself the ModuleScript;
`init.server.luau` / `init.client.luau` do the same for Script/LocalScript;
`Foo.model.json` and `Foo.rbxmx` inject non-script instances.

## Detecting the workflow

```
default.project.json OR *.project.json with "tree"   -> Rojo filesystem project
src/ tree of .luau + a .rbxlx used only as a build    -> Rojo filesystem project
only .rbxl / .rbxlx, no source tree, no project.json  -> Studio-only place
package.json containing "roblox-ts"                   -> TypeScript source, Luau is generated
```

For a Studio-only place, deliverables are code blocks plus an explicit instance
path and script class, for example:

```
ServerScriptService
  └── Systems (Folder)
        └── ShopService (ModuleScript)   <- paste here
```

## Toolchain

| Tool | File | Role |
|---|---|---|
| `rokit` | `rokit.toml` | Pins and installs the other tools. Successor to `aftman`, which succeeded `foreman`. |
| `rojo` | `*.project.json` | Filesystem ↔ DataModel sync, `build`, `serve`, `sourcemap` |
| `wally` | `wally.toml`, `wally.lock` | Package manager; installs to `Packages/`, `ServerPackages/`, `DevPackages/` |
| `selene` | `selene.toml` | Linter; needs `std = "roblox"` and a generated Roblox standard library |
| `stylua` | `stylua.toml` | Formatter |
| `luau-lsp` | `.luaurc`, `sourcemap.json` | Type checking and editor intelligence |

Typical bootstrap:

```bash
rokit install
wally install
rojo sourcemap default.project.json --output sourcemap.json
rojo serve            # live sync into an open Studio place
rojo build default.project.json -o build/game.rbxlx
```

## Service access

```lua
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players           = game:GetService("Players")
local RunService        = game:GetService("RunService")
```

`RunService:IsServer()`, `IsClient()`, `IsStudio()` and `IsRunMode()` are the
supported way for shared code to branch on side. Prefer designing modules that
do not need to branch at all.

## Upstream documentation

- Data model: https://create.roblox.com/docs/projects/data-model
- Scripts: https://create.roblox.com/docs/scripting/scripts
- Rojo project format: https://rojo.space/docs/v7/project-format/
- Wally: https://wally.run/
