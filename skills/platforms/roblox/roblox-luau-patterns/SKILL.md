---
name: roblox-luau-patterns
description: Writing idiomatic typed Luau for Roblox. Use when creating or refactoring any .luau module, adding type annotations, deciding between a plain table module and a metatable class, or fixing luau-lsp diagnostics. Covers --!strict and the language modes, type aliases and exported types, generics and type packs, the metatable class idiom with correct self typing, Instance typing and the nil-safety that strict mode forces, the differences between Luau and Lua 5.1 that break copied code (continue, compound assignment, string interpolation, no goto, no setfenv, bit32 instead of bitwise operators), and the performance-relevant idioms around allocation, iteration and the task library.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: roblox
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "software-architecture, code-review-method"
  uad-tags: "roblox, luau, strict, types, generics, metatable, oop, modulescript, task library, idioms"
  uad-maturity: stable
---

# Roblox Luau Patterns

## Purpose

Luau is not Lua 5.1 with a new name. It has a gradual type system, its own
syntax additions (`continue`, `+=`, backtick string interpolation, `if-then-else`
expressions), deliberate removals (`setfenv`, `getfenv`, `goto`, bitwise
operators, `loadstring` off by default), and a compiler that optimises specific
shapes and pessimises others.

Code copied from a Lua tutorial usually runs, then fails in a way the author did
not expect: `--!strict` rejects it, `getfenv` deoptimises the whole enclosing
function, or a class written with `self` untyped produces no completion and no
type checking at any call site. This skill is the set of idioms that make a Luau
module type-check cleanly, read like the rest of the ecosystem, and stay cheap.

## When to use

- Writing a new `ModuleScript`, or converting an untyped one to `--!strict`.
- Deciding how to model something: plain table of functions, metatable class,
  closure-based object, or just data.
- Fixing `luau-lsp` or Studio script-analysis diagnostics you do not understand.
- Reviewing Luau for correctness or for allocation in a hot path.
- Porting code written for Lua 5.1, LÖVE, or another Lua host.

## When NOT to use

- Deciding *where* the module lives in the DataModel, or whether the project is
  Rojo or Studio-only — use `roblox-project-conventions` first.
- Designing the boundary between client and server — use
  `roblox-client-server-architecture`.
- Validating attacker-controlled input — types are a development aid, not a
  runtime guard. Use `roblox-security`.
- Profiling a slow frame — use `roblox-performance`; only return here once the
  profiler names a specific script.

## Required context

- **The language mode already in use.** Read `.luaurc` for
  `"languageMode": "strict" | "nonstrict" | "nocheck"`, then check the first
  line of neighbouring files for a `--!strict` / `--!nonstrict` / `--!nocheck`
  comment, which overrides it per file. Match the file you are editing; do not
  flip a whole codebase to strict as a side effect of a feature change.
- **Whether types are actually checked.** Types are erased at runtime and only
  enforced by the analyser. Confirm `luau-lsp` or Studio script analysis runs
  here, otherwise annotations are documentation only.
- **The existing class idiom.** Grep for `__index` and `setmetatable`. A
  codebase that uses plain function tables everywhere should not gain one
  metatable class for a single module.
- **`.luaurc` aliases.** An `aliases` block enables `require("@Shared/Module")`
  style requires. Without it, requires are DataModel instance references.
- **Whether the source is roblox-ts output.** A `package.json` naming
  `roblox-ts` means the `.luau` is generated; edit the TypeScript.

## Version constraints

Roblox ships one rolling engine, so there is no Luau version to pin — but the
language does gain features continuously and the analyser gets stricter. Three
things stand in for a version gate:

1. **Workflow gate.** In a Rojo project, write `.luau` files. In a Studio-only
   place, files are unusable output; deliver the module as a code block plus its
   instance path and class. See `roblox-project-conventions`.
2. **Deprecated calls are the reliable smell of old copied code.** Replace on
   sight: `wait`/`spawn`/`delay` → `task.wait`/`task.spawn`/`task.delay`;
   `Humanoid:LoadAnimation` → `Animator:LoadAnimation`;
   `Model:SetPrimaryPartCFrame` → `Model:PivotTo`; `Instance:Remove` →
   `Instance:Destroy`; `print` used for control flow → real logging.
   `getfenv`/`setfenv` are worse than deprecated: their presence disables
   several compiler optimisations for the enclosing function.
3. **Verify newer language features before relying on them.** Native code
   generation (`--!native`), the `buffer` library, `SharedTable`, and additions
   to `Random` and `table` have all arrived at different times and some behave
   differently under Parallel Luau. If a feature is load-bearing for the task,
   confirm it at `create.roblox.com/docs` and in the Luau documentation
   (`luau.org`) rather than assuming.

## Workflow

1. **Set the mode first.** Put `--!strict` on the first line of new modules.
   Strict is the mode where the analyser actually reports mistakes; `nonstrict`
   only checks what it can infer, `nocheck` checks nothing. If the surrounding
   files are `nonstrict`, match them and say so rather than silently mixing.

2. **Model the data before the behaviour.** Write the `type` aliases first —
   they are the interface, and they make the rest of the module fall out. Export
   the ones callers need:

   ```lua
   export type ItemId = string
   export type Stack = { id: ItemId, count: number }
   export type Inventory = { slots: { Stack }, capacity: number }
   ```

3. **Choose the module shape deliberately.**
   - *Plain table of functions* — stateless helpers, pure logic, anything you
     want testable headless. The default; prefer it.
   - *Metatable class* — many instances each with their own state and lifetime
     (a projectile, an NPC brain, a connection wrapper). Use the typed idiom
     below or the type checker sees nothing.
   - *Singleton service table* — exactly one instance with an `init`. Fine, but
     keep the state in an upvalue table, not in module-level loose variables.

4. **Write the class with the full typed idiom.** The three-part shape is what
   makes `self` typed at every call site:

   ```lua
   --!strict
   local Cooldown = {}
   Cooldown.__index = Cooldown

   export type Cooldown = typeof(setmetatable(
       {} :: { duration: number, readyAt: number },
       Cooldown
   ))

   function Cooldown.new(duration: number): Cooldown
       return setmetatable({ duration = duration, readyAt = 0 }, Cooldown)
   end

   function Cooldown.tryUse(self: Cooldown, now: number): boolean
       if now < self.readyAt then
           return false
       end
       self.readyAt = now + self.duration
       return true
   end

   return Cooldown
   ```

   Declare methods with `function Cooldown.method(self: Cooldown, ...)` and call
   them with `instance:method(...)`. The explicit `self` parameter is what gives
   the analyser something to check; `function Cooldown:method()` leaves `self`
   inferred and usually untyped.

5. **Type the boundary with the DataModel.** `WaitForChild` returns `Instance`,
   `FindFirstChild` returns `Instance?`. Strict mode will not let you use either
   as a `Part` until you narrow it:

   ```lua
   local remotes = ReplicatedStorage:WaitForChild("Remotes") :: Folder
   local buyEvent = remotes:WaitForChild("BuyItem") :: RemoteEvent

   local hitPart = model:FindFirstChild("Hitbox")
   if hitPart and hitPart:IsA("BasePart") then
       hitPart.CanCollide = false      -- narrowed by IsA, no cast needed
   end
   ```

   Prefer `:IsA()` narrowing over a `::` cast: a cast is an assertion the
   analyser believes without evidence, and it is wrong the moment an artist
   renames an instance.

6. **Use generics where a function is genuinely shape-agnostic**, not
   everywhere:

   ```lua
   local function map<T, U>(source: { T }, transform: (T) -> U): { U }
       local out = table.create(#source)
       for index, value in source do
           out[index] = transform(value)
       end
       return out
   end
   ```

   Type packs (`<T...>`, `(...)  -> T...`) exist for wrappers that forward
   arbitrary arguments — a `pcall` helper, a signal. Reach for them only there.

7. **Handle failure explicitly.** Luau has no exceptions worth catching across a
   module boundary. Return `(ok: boolean, resultOrError)`, or a `Result`-shaped
   table, and reserve `error()` for programmer mistakes that should crash in
   development. Wrap every yielding engine call that can fail (`DataStore`,
   `MarketplaceService`, `HttpService`) in `pcall`.

8. **Run the analyser before you call it done.** `luau-lsp analyze` with a
   current sourcemap, plus `selene` and `stylua --check`. See
   `roblox-testing-tooling`.

## Best practices

- **`--!strict` at the top of every new module.** It is the only mode where a
  typo in a field name is an error rather than a `nil` at runtime three systems
  away.
- **`export type` the shapes callers pass in or receive back.** A caller that
  has to re-declare your table shape will get it subtly wrong.
- **Cache services and hot module references at the top of the file.**
  `local Players = game:GetService("Players")` once, never inside a loop.
  Globals are a hash lookup; upvalues and locals are not.
- **Prefer `local function name()` over `local name = function()`.** It is
  self-recursive, and the compiler treats it better.
- **Use generalised iteration.** `for index, value in list do` and
  `for key, value in dict do` are Luau's own form and are faster than the
  `ipairs`/`pairs` calls they replace. Keep `ipairs` only when you deliberately
  want the stop-at-first-nil behaviour.
- **Use compound assignment and string interpolation.** `count += 1` and
  `` warn(`bad slot {slotId} from {player.UserId}`) `` are the ecosystem's
  idiom, and the interpolation form avoids the `..` chain allocations.
- **Preallocate with `table.create(n)`** when the size is known, and `table.clone`
  rather than a manual copy loop. `table.freeze` config tables so an accidental
  write is an error instead of a silent behaviour change.
- **`task.*` for everything time-related.** `task.wait`, `task.spawn`,
  `task.delay`, `task.defer`, `task.cancel`. `task.wait()` with no argument
  resumes next frame; `task.wait(0)` does not mean "immediately".
- **Disconnect what you connect.** Keep connections in a table and disconnect
  them in a `destroy` method. A connection to an event on an instance that is
  destroyed is cleaned up; a connection *from* a long-lived service *to* a
  short-lived object is a leak that keeps the object alive.
- **Keep pure logic free of the DataModel.** A module that takes numbers and
  tables and returns numbers and tables is testable headless. One that reaches
  for `workspace` inside its maths is not.

## Common mistakes

- **`function Class:method()` with no typed `self`.** The analyser infers
  `self` as the empty table or `any`, so field typos inside the method go
  unreported and callers get no completion. Use the explicit
  `function Class.method(self: Class, ...)` form.
- **`::` casting away a real problem.** `(part :: any).Whatever = 1` silences
  the analyser and keeps the bug. Every `:: any` in a diff needs a justification.
- **Believing types are enforced.** Types are erased. A `RemoteEvent` handler
  annotated `(player: Player, slotId: number)` still receives whatever the
  attacker sent. Runtime `typeof` checks are mandatory on the boundary — see
  `roblox-security`.
- **`wait()` and `spawn()`.** `wait()` is throttled and imprecise, and `spawn()`
  adds a variable delay before the thread starts, which produces bugs that only
  appear on a loaded server. Use `task.wait` and `task.spawn`.
- **A `while true do end` with no yield.** It never yields, so the script's
  thread never returns to the scheduler. On the server this stalls whatever
  shares that thread and can hang the place. Every loop that is not bounded and
  short needs a `task.wait()` or an event to wait on.
- **`getfenv`/`setfenv` anywhere in a function.** Their presence forces the
  compiler to assume any global may be rewritten, disabling optimisations for
  the entire enclosing function. There is no legitimate use in new code.
- **`goto`, `#!/usr/bin/lua` shebangs, `os.exit`, bitwise `&`/`|`/`~`.** These
  are Lua 5.2+/5.4 constructs Luau does not have. Use `continue`, and the
  `bit32` library for bit operations.
- **String building in a loop with `..`.** Each concatenation allocates a new
  string. Collect into a table and `table.concat` once.
- **`pairs` iteration order treated as stable.** It is not, in any Lua. Anything
  that must be deterministic — procedural generation, replay, hashing — must
  iterate an array or a sorted key list. See `roblox-procedural-generation`.
- **Module-level side effects.** `require` caches per side, so code at the top
  level of a `ModuleScript` runs exactly once, in whatever order the first
  requirer happens to load. Export an `init()` and call it from a script that
  owns the ordering.
- **Shared mutable state in a module required by both sides.** The server and
  each client get independent copies of the module and its upvalues; treating a
  module table as shared state produces a bug that only appears in a real
  multi-client test.

## Validation

- **Analyser is clean.** `rojo sourcemap default.project.json --output
  sourcemap.json && luau-lsp analyze --sourcemap sourcemap.json src/` exits 0.
  Passing looks like zero new diagnostics — not "the same number as before".
- **Strict mode is real.** `grep -L '^--!strict' src/**/*.luau` lists files not
  in strict mode; confirm each one is deliberate. A new module in the list is a
  finding.
- **Lint and format.** `selene .` reports no warnings, `stylua --check .` exits
  0. `selene` catches shadowed variables, unused locals and `wait()` usage when
  configured with the Roblox standard library.
- **No deprecated calls.** `grep -rn '\bwait(\|\bspawn(\|\bdelay(\|getfenv\|setfenv\|:Remove()\|SetPrimaryPartCFrame\|Humanoid:LoadAnimation' src/`
  returns nothing. Passing is an empty result, not a justification.
- **Headless test of the pure logic.** Pure modules run under `lune` or a plain
  Luau CLI with no DataModel. Passing looks like the module's behaviour proven
  without opening Studio; a module that cannot be loaded headlessly is coupled
  to the engine and probably should not be.
- **Runtime smoke test.** Require the module from a `Script` and a `LocalScript`
  and confirm both sides behave. Passing looks like no `attempt to index nil`
  in either output, and no error about `Players.LocalPlayer` on the server.

## References

- [Typed Luau patterns, class idioms and Lua-vs-Luau table](references/REFERENCE.md)
- [Luau language reference](https://luau.org/)
- [Luau type checking](https://luau.org/typecheck)
- [Roblox Luau documentation](https://create.roblox.com/docs/luau)
- [task library](https://create.roblox.com/docs/reference/engine/libraries/task)
