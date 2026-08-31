---
name: roblox-security
description: Entry skill and audit procedure for Roblox exploit resistance. Use when reviewing or writing any code that crosses the client-server boundary, grants currency or items, persists player data, or handles purchases. Gives a concrete walkthrough for auditing every RemoteEvent and RemoteFunction for type, range, ownership, rate and business-rule validation, for finding client-authoritative decisions, duplication exploits caused by non-atomic DataStore access, missing session locks and non-idempotent ProcessReceipt handlers, plus a checklist to walk a codebase against and a format for reporting findings. The governing rule is that the client is a rendering and input surface, never a source of truth.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: roblox
  uad-domain: security
  uad-version: "1.0.0"
  uad-requires: "client-server-trust, threat-modeling, secure-coding, code-review-method"
  uad-tags: "roblox, exploit, remote validation, server authority, duplication, rate limit, anti-cheat, processreceipt, session locking"
  uad-maturity: stable
---

# Roblox Security Audit

## Purpose

Every Roblox client runs on hardware the attacker controls. Exploit executors
inject Luau into the client context, so an attacker can read every LocalScript
and every ModuleScript in `ReplicatedStorage`, call any `RemoteEvent` or
`RemoteFunction` with any arguments at any rate, and change any value the
client owns. Nothing the client sends is evidence of anything.

**The governing rule: the client is a rendering and input surface, never a
source of truth.** It may say "the player pressed the buy button on slot 3". It
may never say "the player bought item 3 for 0 coins". This skill is the
procedure for auditing a codebase against that rule and reporting what it finds.

## When to use

- Reviewing or writing any handler bound to `OnServerEvent` or `OnServerInvoke`.
- Anything that grants currency, items, XP, badges or products.
- Anything that reads or writes player data through `DataStoreService`.
- A report of duplicated items, impossible currency balances, rolled-back
  inventories or free purchases.
- Before shipping an update, as a standing pre-release pass.
- Any request phrased as "add an anti-cheat" — the answer is almost always
  server authority, not detection.

## When NOT to use

- Designing the remote surface in the first place — use
  `roblox-client-server-architecture`, then audit it with this skill.
- DataStore mechanics, retries and schema migration for their own sake — use
  `roblox-datastore-persistence`.
- Writing the purchase flow — use `roblox-monetization`; return here to audit it.
- Performance investigations, unless the finding is a denial-of-service caused
  by unbounded remote traffic.

## Required context

- **Every remote in the place.** Grep the whole source tree for
  `RemoteEvent`, `RemoteFunction`, `UnreliableRemoteEvent`, `OnServerEvent`,
  `OnServerInvoke`, `FireServer`, `InvokeServer`. In a Studio-only place, walk
  `ReplicatedStorage` in the Explorer instead. This list is the attack surface;
  an audit that misses one remote has not happened.
- **Where authority currently lives.** For each gameplay decision (damage,
  currency, item grant, teleport, shop price), which side computes it? Grep for
  server handlers that assign from an argument without recomputing.
- **The persistence path.** Which store, which key format, `SetAsync` or
  `UpdateAsync`, is there a session lock, is there a `BindToClose`.
- **The purchase path.** Is `MarketplaceService.ProcessReceipt` assigned, in how
  many scripts, and does the grant happen inside the same write as the receipt
  record.
- **What is in `ReplicatedStorage`.** Anything there is readable by the
  attacker, including ModuleScript source. Drop tables, prices, cooldown
  constants and validation thresholds sitting there are already disclosed.

## Version constraints

Roblox is a rolling release with no engine version to pin, so this guidance is
not version-gated. Three consequences matter for an audit:

- **The attack surface changes without warning.** New engine features arrive
  weekly. Re-run the remote inventory each audit rather than trusting a previous
  pass.
- **Deprecated APIs are the usual smell.** `wait()`, `spawn()`,
  `Humanoid:LoadAnimation`, `PlayerOwnsAsset` for game passes, and
  `PromptProductPurchaseFinished` used as a grant trigger all indicate code
  copied from an old tutorial — and old tutorials teach client authority. Treat
  their presence as a signal to look harder at the surrounding logic.
- **Verify limits against current documentation.** DataStore quotas, remote
  payload ceilings and subscription APIs change. Any number in this skill is a
  starting point to confirm at `create.roblox.com/docs`, not a constant.

There is one genuine workflow gate: in a Studio-only place you cannot grep, so
the inventory must be built by walking the Explorer, and findings must be
reported as instance paths rather than file paths.

## Workflow

Work through these in order. Each step produces evidence; do not move on
without it.

1. **Inventory the boundary.** List every remote, the script that creates it,
   the script that handles it, and the arguments it accepts. Produce a table.
   Any remote with no server-side handler, or a handler in a `LocalScript`, is
   a finding on its own.

2. **Classify each remote by what it can cause.** Three buckets: *informational*
   (client tells the server about intent or presentation), *stateful* (server
   mutates player state), *economic* (currency, items, purchases, trades). The
   audit depth scales with the bucket; every economic remote gets full
   treatment.

3. **Check server authority per decision.** For each remote, ask what the server
   would have to believe to be wrong. These may only ever be decided
   server-side: currency amounts and prices, item identity and quantity,
   inventory contents, damage dealt and health, cooldown expiry, quest and
   achievement completion, loot and random rolls, ownership and permission,
   teleport destinations, and whether a purchase happened. If any of these is
   read from an argument rather than recomputed, that is a critical finding.

4. **Validate every argument.** Every parameter after `player` in
   `OnServerEvent` is attacker-controlled, including its *type*. Check, in this
   order, and reject rather than clamp when the value is impossible:
   - **Type.** `typeof(x) == "number"`, `"string"`, `"Vector3"`, `"Instance"`.
     A table where a number was expected crashes naive handlers; `nan` and
     `math.huge` pass `> 0` checks that a real value would fail.
   - **Range and sanity.** Integers where integers are meant
     (`x % 1 == 0`), finite (`x == x and x ~= math.huge`), bounded length on
     strings, bounded element count on tables.
   - **Membership.** Item ids and slot names must be looked up in a
     server-side table, never used to index a client-supplied path.
   - **Ownership.** Does *this* player own the item, occupy that slot, have the
     tool equipped, stand near that object? Recheck `Instance` arguments for
     parentage and class — a client can pass any replicated instance, including
     another player's.
   - **Rate.** See step 5.
   - **Business rule.** Is the shop open, is the player alive, is the trade
     still pending, has the cooldown elapsed by server clock.

5. **Check rate limiting.** Assume every remote is called in a tight loop.
   For each: is there a per-player cooldown or token bucket, keyed by the
   `Player` argument the server supplies (never by anything the client sends)?
   What happens under a 10 000 calls per second attack — does the handler
   allocate, yield, write to a DataStore, or fire other remotes? A handler that
   calls `UpdateAsync` per invocation is both a duplication risk and a
   self-inflicted denial of service, because DataStore budget is per server.

6. **Audit persistence atomicity.** Duplication exploits are almost always
   persistence bugs, not remote bugs. Look for read-modify-write split across
   `GetAsync` then `SetAsync`; for the same profile written from two code paths;
   for grants that happen in memory and are only persisted later; and for a
   missing session lock allowing the same player's profile to be open on two
   servers after a fast rejoin or teleport. See
   `roblox-datastore-persistence` for the mechanics.

7. **Audit `ProcessReceipt`.** Exactly one assignment in the place. Must be
   idempotent, keyed on `receiptInfo.PurchaseId`. Must return
   `Enum.ProductPurchaseDecision.PurchaseGranted` only after the grant is
   durably written, and `NotProcessedYet` on any failure or uncertainty. See
   `roblox-monetization`.

8. **Look for disclosed logic.** Anything in `ReplicatedStorage` or a
   `LocalScript` that the client should not know: drop rates, prices used for
   validation, admin user id lists, webhook URLs, thresholds an anti-cheat
   compares against. Disclosure is not itself exploitable, but it converts a
   guess into a targeted attack.

9. **Check the character trust hole.** Character parts are network-owned by the
   player, so position, velocity and `WalkSpeed` are client-authoritative by
   engine design. Any logic that trusts character position (proximity checks,
   region rewards, "touched the coin") must be validated server-side against
   plausible movement, or restructured. See `roblox-character-systems`.

10. **Report.** Each finding as its own entry in the format below. Sort by
    severity. Do not bury a critical duplication bug under a list of style
    notes.

## Best practices

- **Validate, then act — never clamp silently on economic paths.** Clamping a
  quantity to a legal range converts an attack into a slightly smaller
  successful attack. Reject the request, and log it.
- **Pass indices and intents, not values.** `FireServer("buy", shopSlotId)` is
  auditable; `FireServer("buy", itemId, price, quantity)` hands the attacker
  three levers. The server looks up price and item from its own table.
- **Derive the player from the signal, never from an argument.**
  `OnServerEvent` supplies the `Player`; a `userId` argument is a
  privilege-escalation vector.
- **Keep a single grant function.** One server-side `Inventory.Grant(player,
  itemId, count)` that all paths go through means the atomicity fix happens
  once. Scattered grants are how duplication bugs survive review.
- **Make `RemoteFunction` the exception.** A `RemoteFunction` yields the server
  thread for the request; prefer `RemoteEvent` in both directions with a
  request-id. Never `InvokeClient` — a malicious client can simply not return,
  and the server thread waits.
- **Do not put trust in obscurity, but do reduce disclosure.** Moving drop
  tables to `ServerStorage` costs nothing and removes a free map of the economy.
- **Log rejections with the player and the remote name.** Repeated rejections
  from one account are the highest-signal exploit detector you will get, and
  they cost nothing.

## Common mistakes

- **Trusting a client-sent price or currency amount.** `buyRemote.OnServerEvent
  = function(player, itemId, price)` and then deducting `price`. An attacker
  sends `price = 0`, or a negative price, and gains currency. Look up the price
  server-side.
- **Trusting a client-sent quantity.** A negative quantity in a "sell" handler
  adds items. `math.floor` on an attacker value still permits `-5`; require
  `count >= 1` and an integer.
- **Client-side cooldowns.** The LocalScript debounces the button, so the
  server has none. The exploiter fires the remote directly, at whatever rate
  they like, and the ability fires every frame.
- **Validating the item id by indexing a client string into a table path.**
  `Items[name]` is fine; `ReplicatedStorage[folder][name]` with client-supplied
  `folder` lets the attacker reach instances you never intended.
- **Granting before persisting.** Item appears in memory, the server crashes or
  the player teleports, and the write never lands — or worse, the grant lands
  twice because the retry re-runs the grant. Write the grant and the
  idempotency record in the same `UpdateAsync` transform.
- **`GetAsync` then `SetAsync` for player data.** Two servers, or one server and
  a retry, interleave and one write wins. This is the mechanism behind almost
  every "items duplicated when I rejoined fast" report. Use `UpdateAsync`.
- **No session lock.** The player joins server B while server A still holds
  their profile; both save; the last writer wins and can restore a pre-spend
  state, duplicating whatever was spent.
- **`ProcessReceipt` assigned in two scripts.** Only one callback exists per
  place; the second assignment replaces the first, and one product's handler
  silently stops running — players pay and receive nothing.
- **Returning `PurchaseGranted` on error.** Roblox stops retrying, the receipt
  is consumed, and the player paid for nothing. Return `NotProcessedYet`.
- **Anti-cheat as detection instead of authority.** Measuring how far the
  character moved and kicking on a threshold is a heuristic an attacker tunes
  around. It is a supplement, never the control.
- **Assuming `UnreliableRemoteEvent` is less dangerous.** It is unordered and
  lossy, not less trusted. Every validation rule still applies.

## Validation

- **Remote inventory is complete and each entry has a validation clause.**
  `grep -rn "OnServerEvent\|OnServerInvoke" src/` — every hit maps to a handler
  whose first statements check types and ownership. Passing looks like zero
  handlers that use a parameter before validating it.
- **No client-supplied economic values reach state.** `grep -rn "OnServerEvent"
  -A 15 src/` and read each. Passing looks like every price, item and quantity
  being looked up or recomputed server-side.
- **Persistence is atomic.** `grep -rn "SetAsync\|UpdateAsync\|GetAsync" src/`.
  Passing looks like player-profile mutations going through `UpdateAsync` only,
  with `SetAsync` reserved for non-contended data.
- **Exactly one `ProcessReceipt`.** `grep -rn "ProcessReceipt" src/` returns one
  assignment. Passing looks like that handler checking a stored `PurchaseId`
  set before granting.
- **Adversarial run in Studio.** Start a local server with 2 clients. From the
  client console, fire each remote with wrong types (`nil`, a table, `math.huge`,
  a negative number, a string where a number is expected), with another
  player's instances, and in a 1000-iteration loop. Passing looks like the
  server rejecting each call, staying up, and player state being unchanged.
- **Duplication probe.** Grant an item, spend it, and force a rejoin within a
  second (or a `TeleportService` round trip). Passing looks like the item gone
  in both the new session and after a subsequent rejoin.
- **Disclosure check.** List every ModuleScript that Rojo maps into
  `ReplicatedStorage`. Passing looks like none of them containing drop rates,
  authoritative prices, admin id lists or webhook URLs.

## References

- [Audit checklist, validation helpers and finding format](references/REFERENCE.md)
- [Roblox security tactics for developers](https://create.roblox.com/docs/scripting/security)
- [Remote events and callbacks](https://create.roblox.com/docs/scripting/events/remote)
- [ProcessReceipt and developer products](https://create.roblox.com/docs/production/monetization/developer-products)
