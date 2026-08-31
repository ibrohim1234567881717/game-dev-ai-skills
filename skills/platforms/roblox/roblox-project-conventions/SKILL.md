---
name: roblox-project-conventions
description: Entry skill for any Roblox Studio codebase. Establishes whether the project is a Rojo filesystem project or a Studio-only place (which decides whether writing .luau files produces usable work at all), where code belongs across ServerScriptService, ServerStorage, ReplicatedStorage, ReplicatedFirst and StarterPlayer, when to use a Script, a LocalScript or a ModuleScript, and how the rokit and wally toolchain is wired. Use this before writing any Roblox code, before deciding where a new file goes, and before adding a dependency.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: roblox
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "software-architecture, client-server-trust"
  uad-tags: "roblox, luau, rojo, wally, rokit, datamodel, services, modulescript, project layout"
  uad-maturity: stable
---

# Roblox Project Conventions

## Purpose

A Roblox game is not a program with a `main`. It is a live object tree — the
DataModel — in which the *container* an instance sits in determines who can see
it, who can run it, and whether an exploiter can read it. Getting placement
wrong is not a style issue: putting a script in `ReplicatedStorage` ships its
source to every client, and putting a `LocalScript` in `Workspace` means it
never runs at all.

This skill establishes the two facts that gate every other Roblox task: the
shape of the DataModel this project uses, and whether the project is edited as
files on disk (Rojo) or only inside Studio. The second question decides whether
file edits are even usable output.

## When to use

- First contact with a repository that contains `.luau`, `.rbxlx`, `.rbxl` or `default.project.json`.
- Deciding which container a new script, module or asset belongs in.
- The task says "add a system" and you need to know where its server half, client half and shared half go.
- Adding or auditing a dependency (`wally.toml`, `Packages/`).
- Before invoking any other `roblox-*` skill — this one and `roblox-security` are the entry points.

## When NOT to use

- Auditing trust boundaries or validating remote traffic — use `roblox-security`.
- Writing typed Luau, classes or module internals — use `roblox-luau-patterns`.
- Designing the remote surface between client and server — use `roblox-client-server-architecture`.
- Setting up linting, tests or CI — use `roblox-testing-tooling`.

## Required context

Establish all of these from the repository before writing code. Do not ask the
user for what the files already answer.

- **Workflow, Rojo or Studio-only.** Look for `default.project.json` or any
  `*.project.json` containing a `"tree"` key. Present means a Rojo filesystem
  project: source lives in `.luau`/`.lua` files and file edits sync into Studio.
  Absent, with only a `.rbxl`/`.rbxlx` and no source tree, means a Studio-only
  place: **file edits cannot reach the game**. See Version constraints.
- **DataModel mapping.** Read the `tree` block of the project file. It states
  which directory maps to `ReplicatedStorage`, `ServerScriptService`,
  `StarterPlayer/StarterPlayerScripts` and so on. Never guess this from folder
  names — `src/shared` maps wherever the project file says it maps.
- **Toolchain.** `rokit.toml` (current), `aftman.toml` or `foreman.toml`
  (older, same role) pin `rojo`, `wally`, `selene`, `stylua`, `luau-lsp`.
- **Packages.** `wally.toml` lists dependencies; `wally install` writes
  `Packages/`, `ServerPackages/` and `DevPackages/`. Those directories are
  generated — never hand-edit them, and check whether they are gitignored.
- **Luau mode.** `.luaurc` may set `"languageMode"` to `strict`, `nonstrict` or
  `nocheck`, plus `aliases` used by `require("@alias/Module")`.
- **Source language.** A `package.json` mentioning `roblox-ts` means the `.luau`
  is compiled output; edit the TypeScript, never the generated Luau.

## Version constraints

**Roblox has no engine version to pin.** It ships one rolling version to every
client and server, and updates ship weekly without opt-in. There is therefore
no "Roblox 5.2 vs 5.3" question, and any guidance that invents an engine
version number is wrong. Three things take the place of a version gate:

1. **Workflow, not version, is the gate.** In a Rojo project, produce files. In
   a Studio-only place, producing files is producing garbage the developer
   cannot use — deliver the code as a snippet plus the exact instance path
   (`ServerScriptService > Systems > ShopService`, ModuleScript) and say so
   plainly. If you cannot tell which kind of project it is, ask before writing.
2. **Deprecation, not versioning, is how the API moves.** Roblox rarely removes
   an API; it marks it deprecated and leaves it working, so deprecated calls
   linger in old code and in tutorials. Replace on sight: `wait`/`spawn`/`delay`
   → `task.wait`/`task.spawn`/`task.delay`; `Humanoid:LoadAnimation` →
   `Animator:LoadAnimation`; `Model:SetPrimaryPartCFrame` → `Model:PivotTo`;
   `BodyVelocity`/`BodyPosition`/`BodyGyro` → `LinearVelocity`/`AlignPosition`/
   `AlignOrientation`; `PhysicsService:CreateCollisionGroup` →
   `RegisterCollisionGroup`. `aftman` is superseded by `rokit`.
3. **Verify before relying on a specific limit or signature.** Because the
   platform changes continuously and without gates, check any concrete number
   (DataStore quotas, remote payload size, subscription API shape) against
   `create.roblox.com/docs` at the time of the task rather than trusting a
   number written here or in a tutorial.

Rojo project files exist in a versioned format; Rojo 7 reads Rojo 6 projects.
Check the pinned `rojo` version in `rokit.toml` before using newer project-file
syntax such as `$path` globs.

## Workflow

1. **Classify the project.** Rojo or Studio-only, per Required context. Record
   the answer and state it in your first response — everything downstream
   depends on it.
2. **Read the tree.** Open the project file and build the directory →
   DataModel-container map. Note whether `$ignoreUnknownInstances` is set on
   containers you will write into; if it is false, Rojo will not delete
   instances Studio adds there.
3. **Place the code by trust, not by convenience.** Server-authoritative logic →
   `ServerScriptService`. Server-only assets and data → `ServerStorage`. Code and
   data both sides need → `ReplicatedStorage`. Client logic → `StarterPlayer/
   StarterPlayerScripts`. Loading-screen code that must run before anything
   replicates → `ReplicatedFirst`. UI → `StarterGui`, which is copied into each
   player's `PlayerGui`.
4. **Pick the script class deliberately.** `Script` runs on the server.
   `LocalScript` runs on the client and only in client-reachable containers
   (`StarterPlayerScripts`, `StarterCharacterScripts`, `StarterGui`/`PlayerGui`,
   `ReplicatedFirst`, a tool in the `Backpack`). `ModuleScript` runs nowhere by
   itself; it returns a value to whoever `require`s it, on whichever side does
   the requiring. A `Script` also has a `RunContext` property (`Legacy`,
   `Server`, `Client`) that lets it run from containers a `LocalScript` cannot
   reach — useful, but state the intent explicitly when you use it.
5. **Wire dependencies through the DataModel, not globals.** Get services once
   at the top of a module with `game:GetService("ReplicatedStorage")`. Never
   use `game.ReplicatedStorage` dot-access (it breaks if the service is renamed
   or not yet replicated) and never rely on `_G` or `shared`.
6. **Add packages through wally.** Append to `wally.toml`, run `wally install`,
   and require from the generated folder. Do not vendor a copy into `src/` and
   do not commit `Packages/` unless the repo already does.
7. **Confirm the sync surface.** For a Rojo project, `rojo build` must succeed
   before you consider the change done; a file in a directory the project tree
   does not cover is invisible to the game even though it exists on disk.

## Best practices

- **One module, one responsibility, returned as a table.** A `ModuleScript`
  should `return` a table of functions or a class, never perform side effects at
  require time — `require` is cached per side, so side effects run once and in
  an order you do not control.
- **Shared code must be side-agnostic.** Anything in `ReplicatedStorage` may be
  required by both sides; if it calls `Players.LocalPlayer` it will error on the
  server. Split into `Shared`, `Server`, `Client` folders and keep the boundary
  honest.
- **Treat `ReplicatedStorage` as public.** Its contents, including ModuleScript
  source, are readable by any client. Secrets, drop tables, prices and
  server-only algorithms belong in `ServerStorage` or `ServerScriptService`.
- **Use `WaitForChild` on the client, direct indexing on the server.** Client
  scripts can run before replication finishes; server scripts see the whole tree
  at once. `WaitForChild` with no timeout warns after 5 seconds but never
  errors, so pass a timeout when a missing child is a real failure.
- **Name instances the way the code indexes them.** Rojo derives instance names
  from filenames; a rename on disk silently rewires `WaitForChild` lookups.
- **Prefer `init.luau` folders for modules with children** so the module and its
  submodules stay a single unit in both filesystem and DataModel.

## Common mistakes

- **Writing files into a Studio-only place.** The developer opens Studio, sees
  none of the work, and the session is wasted. Classify the project first; if
  it is Studio-only, hand over code with explicit instance paths instead.
- **Putting server logic in `ReplicatedStorage` "so both sides can use it".**
  The client can now read the exact logic — including item values, cooldown
  windows and validation thresholds — and write an exploit against it. Shared
  *types* and *constants that are already visible in the UI* are fine; decision
  logic is not.
- **Using a `LocalScript` in `Workspace` or `ServerScriptService`.** It simply
  never runs, and the symptom is silence rather than an error. Use
  `StarterPlayerScripts` or a `Script` with `RunContext = Client`.
- **`game.Players` instead of `game:GetService("Players")`.** Works until it
  does not — `GetService` is the only form guaranteed to create or fetch the
  service, and it is what every Roblox code review expects.
- **Editing generated `Packages/` or roblox-ts output.** The next
  `wally install` or `rbxtsc` run erases the change. Fix the source or fork the
  package properly.
- **Assuming the folder name is the container.** `src/shared` maps to whatever
  the project file says, which in real repositories is sometimes
  `ReplicatedStorage/Common` and sometimes `ReplicatedStorage`.

## Validation

- **Rojo project builds.** `rojo build default.project.json -o /tmp/test.rbxlx`
  exits 0. Passing means every file you added is inside the mapped tree; a file
  outside the tree produces no error but also no instance, so also confirm the
  new path appears in `rojo sourcemap --output sourcemap.json`.
- **Sourcemap contains the new module.** `rojo sourcemap` output includes an
  entry whose `filePaths` lists your new file. This is the direct proof that the
  file reaches the DataModel.
- **Static analysis is clean.** `selene .` and `luau-lsp analyze --sourcemap
  sourcemap.json src/` report no new diagnostics. `luau-lsp` catches
  `Players.LocalPlayer` used from a server path when types are strict.
- **Container check.** Grep the diff for new files under any path the project
  maps to `ReplicatedStorage` and confirm none of them contain pricing, drop
  rates, validation thresholds or admin lists.
- **Runtime check in Studio.** Start a local server with 2 players (Test →
  Clients and Servers). Server scripts appear in the server output, client
  scripts in each client's; a script that produces neither is in the wrong
  container.

## References

- [Container and script placement tables](references/REFERENCE.md)
- [Roblox DataModel and services](https://create.roblox.com/docs/projects/data-model)
- [Rojo documentation](https://rojo.space/docs/)
- [Wally package manager](https://wally.run/)
- [Rokit toolchain manager](https://github.com/rojo-rbx/rokit)
