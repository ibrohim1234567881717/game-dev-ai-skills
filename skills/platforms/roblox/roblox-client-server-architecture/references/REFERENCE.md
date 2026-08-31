# Remote design reference

Detail that would bloat `SKILL.md`. Roblox is a rolling release, so confirm any
specific limit against `create.roblox.com/docs` rather than treating a number
here as fixed.

## Choosing an instrument

| Need | Use |
|---|---|
| Client asks the server to do something | `RemoteEvent`, client → server |
| Server tells clients something happened | `RemoteEvent`, server → client(s) |
| High-frequency data where the newest value supersedes the last | `UnreliableRemoteEvent` |
| Client needs a value back from the server | `RemoteEvent` request + `RemoteEvent` response, or `RemoteFunction` if you accept the coupling |
| Server needs a value from a client | **Nothing.** Do not block on a client. Have the client push it. |
| Decoupling two systems on the same side | `BindableEvent` / `BindableFunction` |

## What already replicates, without a remote

Adding a remote for any of these creates a second copy of state that can
disagree with the first:

- Instances parented into replicated containers (`Workspace`, `ReplicatedStorage`,
  and the player-facing containers) by the server.
- Property changes made **on the server** to replicated instances.
- Character movement and `Humanoid` state for the owning player.
- Attributes set on the server.

What does **not** replicate:

- Changes made on a **client** — they are local to that client and invisible to
  the server and to everyone else. This surprises people constantly. A client
  moving a part sees it move; nobody else does.
- Anything in `ServerStorage` or `ServerScriptService`, which clients cannot see
  at all. This is where secrets belong.
- `ReplicatedFirst` contents after the initial load.

## A validated handler, in shape

```lua
--!strict
local Players = game:GetService("Players")

local COOLDOWN_SECONDS = 0.5
local lastCall: { [Player]: number } = {}

local function onBuyItem(player: Player, itemId: unknown)
    -- 1. rate limit, keyed by the Player the engine gives us
    local now = os.clock()
    local previous = lastCall[player]
    if previous and now - previous < COOLDOWN_SECONDS then
        return
    end
    lastCall[player] = now

    -- 2. type and shape
    if typeof(itemId) ~= "string" then
        warn(("rejected buy from %s: itemId not a string"):format(player.Name))
        return
    end

    -- 3. the referenced thing exists (server-side catalogue, never client-sent)
    local item = Catalogue.get(itemId)
    if not item then
        return
    end

    -- 4. state legality and business rule, recomputed from server state
    local profile = Profiles.get(player)
    if not profile or profile.coins < item.price then
        return
    end

    -- 5. atomic mutation, then persist, then tell the client
    Profiles.purchase(player, item)
end

Players.PlayerRemoving:Connect(function(player)
    lastCall[player] = nil       -- do not leak per-player state
end)
```

Note what the client sent: an item id, and nothing else. Not the price, not the
quantity, not the player. Those are looked up or supplied by the engine.

## A token bucket, when a fixed cooldown is too blunt

```lua
--!strict
type Bucket = { tokens: number, updated: number }

local buckets: { [Player]: Bucket } = {}

local CAPACITY = 5        -- burst allowance
local REFILL_PER_SECOND = 2

local function allow(player: Player): boolean
    local now = os.clock()
    local bucket = buckets[player]
    if not bucket then
        bucket = { tokens = CAPACITY, updated = now }
        buckets[player] = bucket
    end

    bucket.tokens = math.min(
        CAPACITY,
        bucket.tokens + (now - bucket.updated) * REFILL_PER_SECOND
    )
    bucket.updated = now

    if bucket.tokens < 1 then
        return false
    end
    bucket.tokens -= 1
    return true
end
```

Clear the entry on `PlayerRemoving`. A per-player table that is never cleaned is
a slow memory leak on a long-running server.

## Network ownership

Roblox hands physics simulation of unanchored parts to a nearby client so that
movement feels responsive. That client computes the physics, which means it can
influence the result.

```lua
part:SetNetworkOwner(nil)        -- server simulates it
part:SetNetworkOwner(player)     -- that client simulates it
```

Set ownership to the server (`nil`) for anything gameplay-critical: objectives,
hazards, anything whose position determines an outcome. Leave it with the client
for the player's own character and purely local props, where responsiveness
matters more than trust.

This also explains a common confusion: in Studio's single-player test, one
machine is both server and client, so ownership problems are invisible. Test
with two players before concluding physics behaves correctly.

## Payload discipline

- Keep payloads small and flat. Deeply nested tables cost more to serialise and
  are harder to validate.
- Never send a function, an instance you do not intend the client to hold, or a
  reference to server-only state.
- Instances sent through a remote must be visible to the receiving side, or they
  arrive as `nil`.
- Validate the **length** of every string and the **size** of every table. An
  attacker will send a megabyte if you let them.

## Rejection logging

Log rejections with the player and the reason, and never with the payload
verbatim if it could be large:

```lua
warn(("rejected %s from %s: %s"):format(remoteName, player.Name, reason))
```

The pattern of rejections is how exploitation gets noticed. A silent rejection
is safe but invisible.
