# Luau reference for Roblox

Current behaviour at the time of writing. Luau evolves continuously with the
rolling engine; confirm anything load-bearing at `luau.org` and
`create.roblox.com/docs/luau`.

## Language modes

| Mode | How to set | What it does |
|---|---|---|
| `--!strict` | first line of the file | Full inference and checking; unannotated values must still be consistent |
| `--!nonstrict` | first line | Checks only what it can infer; unknown becomes `any` |
| `--!nocheck` | first line | No type checking at all |
| project default | `"languageMode"` in `.luaurc` | Applies where a file has no `--!` comment |
| `--!native` | first line | Requests native code generation for the script (server-side; verify current support and caveats) |
| `--!optimize 2` | first line | Requests the higher optimisation level for this script |

Types are **erased at runtime**. Nothing in the type system validates data
arriving from a client.

## Luau vs Lua 5.1

| Feature | Lua 5.1 | Luau |
|---|---|---|
| `continue` | no | **yes** |
| `goto` / labels | no (5.2+) | **no** |
| Compound assignment `+= -= *= /= //= %= ^= ..=` | no | **yes** |
| String interpolation `` `a {b} c` `` | no | **yes** |
| `if cond then a else b` as an expression | no | **yes** |
| Floor division `//` | no | **yes** |
| Bitwise operators `& | ~ << >>` | no | **no** — use `bit32` |
| Integer subtype | no | no (all numbers are doubles) |
| `setfenv` / `getfenv` | yes | present but deoptimising; treat as forbidden |
| `_ENV` | no (5.2+) | **no** |
| `loadstring` | yes | disabled by default in Roblox |
| `os.exit`, `io`, `os.execute` | yes | **not available** |
| Generalised iteration `for k, v in t do` | no | **yes** |
| `#` on tables with holes | undefined | undefined — same trap |
| Type annotations | no | **yes**, gradual |

Additional Luau-only libraries and functions worth knowing: `task`, `buffer`,
`bit32`, `table.create`, `table.clone`, `table.freeze`, `table.isfrozen`,
`table.move`, `table.find`, `string.split`, `math.round`, `math.clamp`,
`math.sign`, `os.clock`, `debug.profilebegin`/`profileend`,
`debug.setmemorycategory`.

## Type syntax cheat sheet

```lua
--!strict

-- aliases and exports
type Vector = { x: number, y: number }
export type Entity = { id: string, position: Vector, tags: { string } }

-- optional, union, intersection
type MaybeName = string?                       -- string | nil
type Shape = "circle" | "square"               -- singleton union
type Both = { a: number } & { b: number }

-- functions
type Handler = (player: Player, amount: number) -> boolean
type Varargs = (...string) -> ()

-- indexers
type Lookup = { [string]: number }
type Grid = { { number } }                     -- array of arrays

-- generics and type packs
local function first<T>(list: { T }): T?
    return list[1]
end

local function retry<T..., R...>(fn: (T...) -> R..., ...: T...): R...
    return fn(...)
end

-- type assertion (an assertion, not a conversion)
local part = instance :: BasePart

-- typeof at the type level and at runtime
type Config = typeof(DEFAULT_CONFIG)           -- type level
if typeof(value) == "Vector3" then end         -- runtime, Roblox datatypes too
```

`typeof()` at runtime returns Roblox datatype names (`"Vector3"`, `"CFrame"`,
`"Instance"`, `"EnumItem"`) where `type()` would only say `"userdata"`. Always
use `typeof` in Roblox code.

## The metatable class idiom, three ways

### Preferred: `typeof(setmetatable(...))`

```lua
--!strict
local Queue = {}
Queue.__index = Queue

export type Queue<T> = typeof(setmetatable(
    {} :: { items: { T }, head: number },
    Queue
))

function Queue.new<T>(): Queue<T>
    return setmetatable({ items = {}, head = 1 }, Queue)
end

function Queue.push<T>(self: Queue<T>, value: T)
    table.insert(self.items, value)
end

function Queue.pop<T>(self: Queue<T>): T?
    local value = self.items[self.head]
    if value == nil then return nil end
    self.items[self.head] = nil
    self.head += 1
    return value
end

return Queue
```

### Explicit impl type (verbose, most precise)

```lua
type QueueImpl = {
    __index: QueueImpl,
    new: () -> Queue,
    push: (self: Queue, value: string) -> (),
}
type Queue = typeof(setmetatable({} :: { items: { string } }, {} :: QueueImpl))
```

Use this when the class is part of a published package API and you want the
method table itself typed.

### Closure-based object (no metatable)

```lua
local function makeCounter(start: number)
    local value = start
    return {
        increment = function(by: number): number
            value += by
            return value
        end,
    }
end
```

Cheapest to reason about, no `self`, truly private state, but allocates one
closure per method per instance. Fine for a handful of objects, wrong for
thousands.

## Instance typing

```lua
local ReplicatedStorage = game:GetService("ReplicatedStorage")

-- WaitForChild returns Instance; narrow with a cast when you control the tree
local remotes = ReplicatedStorage:WaitForChild("Remotes") :: Folder

-- FindFirstChild returns Instance?; narrow with IsA, which the analyser trusts
local hitbox = model:FindFirstChild("Hitbox")
if hitbox and hitbox:IsA("BasePart") then
    hitbox.CanQuery = false
end

-- FindFirstChildOfClass / FindFirstAncestorOfClass return the typed class
local humanoid = character:FindFirstChildOfClass("Humanoid")   -- Humanoid?

-- WaitForChild with a timeout returns Instance? and is the honest form when a
-- missing child is a real failure
local gui = playerGui:WaitForChild("HUD", 10)
if gui == nil then
    warn("HUD never replicated")
    return
end
```

`luau-lsp` needs `sourcemap.json` (from `rojo sourcemap`) plus a generated
`globalTypes.d.luau` definitions file to know the Roblox API and the shape of
your DataModel. Without them, every `Instance` is opaque.

## Error handling shapes

```lua
-- 1. pcall around anything that yields to a web service
local ok, result = pcall(function()
    return store:GetAsync(key)
end)
if not ok then
    warn(`GetAsync failed: {result}`)
    return nil
end

-- 2. (ok, value) return convention for internal APIs
local function withdraw(profile: Profile, amount: number): (boolean, string?)
    if profile.coins < amount then
        return false, "insufficient funds"
    end
    profile.coins -= amount
    return true
end

-- 3. error() only for programmer mistakes that should surface loudly
local function requirePositive(n: number): number
    if n <= 0 then
        error(`expected a positive number, got {n}`, 2)   -- level 2 blames the caller
    end
    return n
end
```

`xpcall(fn, debug.traceback)` preserves the stack, which plain `pcall` loses.
Use it when the failure is going to a log rather than to a retry.

## Allocation and hot-path idioms

| Instead of | Write | Why |
|---|---|---|
| `local t = {}` then `t[i] = v` in a sized loop | `table.create(n)` | one allocation instead of repeated growth |
| deep-copy loop | `table.clone(t)` (shallow) | native, no interpreter loop |
| `s = s .. part` in a loop | collect, then `table.concat(parts)` | avoids O(n²) string allocation |
| `ipairs(t)` / `pairs(t)` | `for i, v in t do` | generalised iteration, no iterator call |
| `game.Players` | `game:GetService("Players")` cached in a local | correctness plus one lookup |
| `Instance.new("Part", parent)` | create, set properties, set `Parent` last | parenting first replicates each subsequent property change |
| a table allocated per frame | reuse a module-level scratch table | garbage collection pressure is a real frame-time cost |
| `tick()` | `os.clock()` for intervals, `os.time()` for wall clock | `tick()` is deprecated and epoch-relative |

Measure before restructuring for any of these: `debug.profilebegin("label")` /
`debug.profileend()` puts a named scope in the MicroProfiler. See
`roblox-performance`.

## Connection lifetime

```lua
--!strict
local Bin = {}
Bin.__index = Bin

export type Bin = typeof(setmetatable({} :: { items: { RBXScriptConnection } }, Bin))

function Bin.new(): Bin
    return setmetatable({ items = {} }, Bin)
end

function Bin.add(self: Bin, connection: RBXScriptConnection): RBXScriptConnection
    table.insert(self.items, connection)
    return connection
end

function Bin.destroy(self: Bin)
    for _, connection in self.items do
        connection:Disconnect()
    end
    table.clear(self.items)
end

return Bin
```

`:Once()` self-disconnects after one fire and is the right choice for
`CharacterAdded`-style one-shots. `Instance:Destroy()` disconnects connections
to *that instance's* events, which is why a leak is almost always a connection
held by a long-lived service to a short-lived object, not the other way round.

## Upstream documentation

- Luau language: https://luau.org/
- Luau type checking: https://luau.org/typecheck
- Roblox Luau guide: https://create.roblox.com/docs/luau
- `task` library: https://create.roblox.com/docs/reference/engine/libraries/task
- `table` library: https://create.roblox.com/docs/reference/engine/libraries/table
