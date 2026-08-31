# Roblox remote audit reference

Checklist tables, validation patterns and report formats for `roblox-security`.
Every concrete limit here is current-behaviour at the time of writing; Roblox
ships a rolling engine, so confirm quotas and API shapes against
`create.roblox.com/docs` before depending on them.

## Remote inventory table

Build this first. One row per remote. An audit without a complete table has not
happened.

| Remote | Class | Created in | Handled in | Args (declared) | Class | Validated | Rate limited | Finding |
|---|---|---|---|---|---|---|---|---|
| `BuyItem` | RemoteEvent | `ServerScriptService/Shop/init` | same | `slotId: number` | economic | type+range+membership | 1/s token bucket | — |
| `RequestStats` | RemoteFunction | `ReplicatedStorage/Remotes` | `ServerScriptService/Stats` | none | informational | n/a | 2/s | — |
| `SetNickname` | RemoteEvent | … | … | `name: string` | stateful | **none** | none | S1: unbounded string, no filter |

`Class` is the bucket from Workflow step 2: *informational*, *stateful*,
*economic*. Anything economic gets the full column set filled in or it is a
finding by default.

## Audit checklist

Walk every row of the inventory against every line here. `n/a` is an acceptable
answer; blank is not.

| # | Check | Passing looks like | Severity if failed |
|---|---|---|---|
| 1 | Handler exists and is server-side | `OnServerEvent`/`OnServerInvoke` bound in a `Script` under `ServerScriptService` | S1 if a remote has no handler and is still reachable |
| 2 | Player identity comes from the signal | first parameter is used; no `userId`/`playerName` argument | S1 — privilege escalation |
| 3 | Every argument type-checked before use | `typeof(x) == "number"` etc. as the first statements | S1 on economic, S2 elsewhere |
| 4 | Numbers are finite and in range | `x == x`, `x ~= math.huge`, `x ~= -math.huge`, explicit min/max | S1 — `math.huge` and `nan` defeat naive comparisons |
| 5 | Integers where integers are meant | `x % 1 == 0` **and** a range check | S1 — negative or fractional quantities invert economy maths |
| 6 | Strings bounded and never used as a path | length cap; lookup in a server table, not `Folder[name]` | S2, S1 if it indexes the DataModel |
| 7 | Tables bounded in element count and depth | explicit `#t <= N` and a key whitelist | S2 — unbounded tables are a memory DoS |
| 8 | `Instance` arguments re-validated | `:IsA(class)` **and** ancestry check **and** ownership check | S1 — the client may pass any replicated instance |
| 9 | Economic values recomputed server-side | price, item id, quantity, reward looked up from a server table | S1 — free purchases, infinite currency |
| 10 | Ownership proven | server-side inventory says this player holds it | S1 — duplication and theft |
| 11 | Cooldown enforced server-side by server clock | `os.clock()`/`os.time()` compared against a server-held timestamp | S2, S1 if it gates a grant |
| 12 | Rate limit present, keyed on the `Player` | token bucket or per-player timestamp map | S2, S1 if the handler yields or writes |
| 13 | Business rules rechecked at execution time | shop open, player alive, trade still pending | S2 |
| 14 | Handler is cheap under attack | no DataStore write per call, no unbounded allocation, no `FireAllClients` per call | S2 — self-inflicted DoS |
| 15 | Rejections are logged with player and remote | one `warn` line per rejection, rate-limited itself | S3 — no detection signal without it |
| 16 | Persistence path is atomic | `UpdateAsync` transform, not `GetAsync`+`SetAsync` | S1 — duplication |
| 17 | Session lock present on the player profile | lock field + heartbeat + stale-lock takeover | S1 — rollback duplication |
| 18 | `ProcessReceipt` assigned exactly once and idempotent | keyed on `receiptInfo.PurchaseId` | S1 — double grant or paid-for-nothing |
| 19 | No authoritative logic disclosed to clients | drop rates, prices, admin ids, webhook URLs not in `ReplicatedStorage` | S3 |
| 20 | Character-position trust is bounded | proximity checks re-validated against plausible movement | S2 |

## Validation patterns by argument type

These are shapes to copy, not a library to import. Every one of them **rejects**
rather than clamps, and rejects *before* any state is touched.

```lua
-- Numbers: type, finiteness, integrality, range. Order matters -- `nan` and
-- `math.huge` pass a bare `> 0`, and `nan ~= nan` is the only reliable test.
local function isCount(value: any, maxCount: number): boolean
    return typeof(value) == "number"
        and value == value                -- rejects nan
        and value ~= math.huge
        and value ~= -math.huge
        and value % 1 == 0                -- rejects 1.5 and 1e308
        and value >= 1
        and value <= maxCount
end
```

```lua
-- Strings: bounded length first, then membership in a server-side set.
-- Never use a client string to index the DataModel.
local ALLOWED_EMOTES = { wave = true, dance = true, cheer = true }

local function isEmote(value: any): boolean
    return typeof(value) == "string"
        and #value <= 32
        and ALLOWED_EMOTES[value] == true
end
```

```lua
-- Ids: the client sends an index or a key, never a value. The server owns the
-- table that turns it into a price and an item.
local function resolveShopSlot(slotId: any): ShopEntry?
    if typeof(slotId) ~= "number" or slotId % 1 ~= 0 then
        return nil
    end
    return SHOP_TABLE[slotId]   -- server-only module, ServerStorage
end
```

```lua
-- Instances: class, ancestry and ownership. A client can pass any instance that
-- exists on its side, including another player's character or a UI element.
local function isOwnedTool(player: Player, value: any): boolean
    if typeof(value) ~= "Instance" or not value:IsA("Tool") then
        return false
    end
    local character = player.Character
    return (character ~= nil and value.Parent == character)
        or value.Parent == player:FindFirstChildOfClass("Backpack")
end
```

```lua
-- Vectors: finite on every component, and inside the world. Position arguments
-- are almost always a design smell -- prefer sending an intent and letting the
-- server read the character's own position.
local function isSaneVector(value: any, maxMagnitude: number): boolean
    if typeof(value) ~= "Vector3" then
        return false
    end
    local x, y, z = value.X, value.Y, value.Z
    if x ~= x or y ~= y or z ~= z then
        return false                       -- any nan component
    end
    return value.Magnitude <= maxMagnitude -- Magnitude of huge components is inf
end
```

```lua
-- Tables: cap the element count and whitelist the keys. Never `pairs` an
-- attacker table into a state update, and never trust `#t` alone -- a table with
-- a nil hole reports a shorter length than it carries.
local function isLoadout(value: any): boolean
    if typeof(value) ~= "table" then
        return false
    end
    local count = 0
    for key, slot in pairs(value) do
        count += 1
        if count > 6 then return false end
        if typeof(key) ~= "number" or key % 1 ~= 0 or key < 1 or key > 6 then
            return false
        end
        if typeof(slot) ~= "string" or not ITEM_IDS[slot] then
            return false
        end
    end
    return true
end
```

## Rate limiter sketch

A per-player token bucket. Keyed on the `Player` instance the signal supplies,
cleaned up on `PlayerRemoving` so it cannot grow without bound.

```lua
--!strict
local Players = game:GetService("Players")

export type Bucket = { tokens: number, lastRefill: number }

local RateLimiter = {}
RateLimiter.__index = RateLimiter

export type RateLimiter = typeof(setmetatable(
    {} :: { capacity: number, refillPerSecond: number, buckets: { [Player]: Bucket } },
    RateLimiter
))

function RateLimiter.new(capacity: number, refillPerSecond: number): RateLimiter
    local self = setmetatable({
        capacity = capacity,
        refillPerSecond = refillPerSecond,
        buckets = {},
    }, RateLimiter)

    Players.PlayerRemoving:Connect(function(player)
        self.buckets[player] = nil
    end)

    return self
end

-- Returns true if the call is allowed and consumes a token.
function RateLimiter.consume(self: RateLimiter, player: Player): boolean
    local now = os.clock()
    local bucket = self.buckets[player]
    if bucket == nil then
        bucket = { tokens = self.capacity, lastRefill = now }
        self.buckets[player] = bucket
    end

    bucket.tokens = math.min(
        self.capacity,
        bucket.tokens + (now - bucket.lastRefill) * self.refillPerSecond
    )
    bucket.lastRefill = now

    if bucket.tokens < 1 then
        return false
    end
    bucket.tokens -= 1
    return true
end

return RateLimiter
```

Use it as the first line of the handler, before any allocation:

```lua
local buyLimiter = RateLimiter.new(3, 1)   -- burst 3, sustained 1/s

buyRemote.OnServerEvent:Connect(function(player, slotId)
    if not buyLimiter:consume(player) then
        warn(`rate limit: {player.UserId} BuyItem`)
        return
    end
    local entry = resolveShopSlot(slotId)
    if entry == nil then
        warn(`rejected: {player.UserId} BuyItem bad slot`)
        return
    end
    Shop.purchase(player, entry)           -- price comes from `entry`, never the client
end)
```

Notes: `os.clock()` is a monotonic process clock and is the right choice for
intervals; `os.time()` is wall clock and is the right choice for anything
persisted. Never key a limiter on a value the client sends. A limiter that
allocates a table per call is itself the DoS.

## DataStore session lock sketch

Session locking is what stops the same profile being open on two servers, which
is the mechanism behind most "my items came back after I spent them" reports.
The lock lives inside the profile and is taken and released through the same
`UpdateAsync` transform that reads the data, so the read and the lock are one
atomic operation.

For production, prefer a maintained library (ProfileStore / ProfileService)
rather than hand-rolling this — it handles the cases below plus more.

```lua
--!strict
local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")

local store = DataStoreService:GetDataStore("PlayerProfiles_v1")

local LOCK_TTL = 60          -- seconds a lock stays valid without a heartbeat
local JOB = game.JobId ~= "" and game.JobId or "studio"

type Profile = {
    schemaVersion: number,
    coins: number,
    inventory: { [string]: number },
    processedReceipts: { [string]: boolean },
    lockJobId: string?,
    lockExpiry: number?,
}

local function acquire(userId: number): Profile?
    local key = `player_{userId}`
    local claimed: Profile? = nil

    local ok, err = pcall(function()
        store:UpdateAsync(key, function(old: Profile?): Profile?
            local profile: Profile = old or {
                schemaVersion = 1,
                coins = 0,
                inventory = {},
                processedReceipts = {},
            }

            local now = os.time()
            local heldBySomeoneElse = profile.lockJobId ~= nil
                and profile.lockJobId ~= JOB
                and (profile.lockExpiry or 0) > now

            if heldBySomeoneElse then
                return nil          -- returning nil cancels the write: lock not taken
            end

            profile.lockJobId = JOB
            profile.lockExpiry = now + LOCK_TTL
            claimed = profile
            return profile
        end)
    end)

    if not ok then
        warn(`profile load failed for {userId}: {err}`)
        return nil
    end
    return claimed
end
```

The rest of the protocol, and the parts that are easy to get wrong:

- **Retry the acquire**, do not fail the join. The previous server usually
  releases within a second or two. Retry with backoff for `LOCK_TTL` and only
  then either kick with a clear message or force-take a demonstrably stale lock.
- **Heartbeat the lock** while the session is open — push `lockExpiry` forward
  on the same schedule you autosave on. A lock that never refreshes expires
  mid-session and lets a second server in.
- **Release on the way out**: on `PlayerRemoving` and inside `BindToClose`,
  write the final state and clear `lockJobId`/`lockExpiry` in the same
  `UpdateAsync`. A save that does not clear the lock costs the player a
  `LOCK_TTL` wait on their next join.
- **Never write outside the lock.** Any code path that writes the profile
  without holding the lock defeats the whole mechanism.
- **`BindToClose` is a bounded window**, not unlimited. Save every open profile
  in parallel with `task.spawn` and wait for them, rather than looping
  sequentially — a sequential loop over a full server will not finish.
- **Grant and record in the same transform.** The currency change and the
  idempotency record must be one `UpdateAsync` return value, or a crash between
  them leaves the two disagreeing.

## Findings report format

One block per finding, sorted by severity, critical first. No style notes above
a duplication bug.

```markdown
### S1 — Client-supplied price accepted in the shop purchase handler

**Location:** `src/server/Shop/init.server.luau:42`
  (Studio-only place: `ServerScriptService > Shop`, Script)
**Remote:** `BuyItem` (RemoteEvent), `ReplicatedStorage/Remotes/BuyItem`

**What is wrong**
The handler signature is `function(player, itemId, price)` and line 47 deducts
`price` from the player's balance, then grants `itemId`.

**How it is exploited**
An executor calls `BuyItem:FireServer("legendary_sword", -1000000)`. The
deduction of a negative price adds currency, and the item is granted. One call
produces unbounded currency and a free item.

**Impact**
Economy destroyed for the whole experience, not just the attacker: currency
reaches the trade and marketplace systems. Not detectable after the fact
without per-transaction logs.

**Fix**
Send the shop slot index only. Look the entry up in a `ServerStorage` table,
read the price from it, check `balance >= entry.price`, then deduct and grant
inside a single `UpdateAsync` transform.

**Verification**
From a client console, `BuyItem:FireServer("legendary_sword", -1000000)` and
`BuyItem:FireServer(1, math.huge)`. Passing looks like both rejected, a warn
line naming the player and the remote, and an unchanged balance after rejoin.
```

Severity scale used above:

| Level | Meaning |
|---|---|
| **S1 critical** | Currency, items or purchases can be created, duplicated or stolen; player data can be lost or rolled back; another player's account can be acted on |
| **S2 high** | Gameplay integrity broken (damage, cooldowns, progression) or the server can be denied service by one client |
| **S3 medium** | Information disclosure, missing rejection logging, unbounded but non-economic input |
| **S4 low** | Deprecated API, defensive-depth suggestion, style |

## Test payload set

Fire every remote with each of these before signing off. The server must reject
all of them, stay up, and leave player state unchanged.

| Payload | What it breaks when unhandled |
|---|---|
| `nil` for every parameter | `attempt to index nil`, handler error, sometimes a partially-applied state change |
| a table where a scalar is expected | naive `tonumber`/comparison errors |
| `math.huge`, `-math.huge` | passes `> 0` and `< max` written the lazy way |
| `0/0` (`nan`) | fails **every** comparison including `>= 0`, so a `not (x < 0)` guard lets it through |
| `-1`, `-999999` | negative quantity inverts a subtraction into a grant |
| `1.5`, `1e308` | fractional counts, currency that becomes `inf` |
| a 1 MB string | memory pressure, log flooding, slow serialisation |
| another player's `Character` / `Tool` | acting on someone else's state |
| an `Instance` of the wrong class | `:IsA` gap, error inside the handler |
| the same valid call 1 000 times in a loop | missing rate limit, DataStore budget exhaustion, server-wide lag |
| two valid calls in the same frame | non-atomic read-modify-write, double spend |

## Upstream documentation

- Security tactics: https://create.roblox.com/docs/scripting/security
- Remote events and callbacks: https://create.roblox.com/docs/scripting/events/remote
- Data stores: https://create.roblox.com/docs/cloud-services/data-stores
- Developer products and `ProcessReceipt`: https://create.roblox.com/docs/production/monetization/developer-products
