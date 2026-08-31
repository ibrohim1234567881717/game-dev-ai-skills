---
name: roblox-datastore-persistence
description: Saving player data in Roblox without losing or duplicating it - UpdateAsync versus SetAsync, session locking, request budgets and throttling, retries with backoff, schema versioning and migration, MemoryStoreService for cross-server state, and BindToClose. Use when building or fixing persistence, when players report lost progress, or when investigating item duplication.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: roblox
  uad-domain: production
  uad-version: "1.0.0"
  uad-requires: "save-systems, client-server-trust, roblox-security"
  uad-tags: "roblox, datastore, updateasync, session lock, duplication, data loss, memorystore, bindtoclose, persistence"
  uad-maturity: stable
---

# Roblox DataStore Persistence

## Purpose

Two failure modes dominate Roblox persistence, and both are data-layer bugs
rather than gameplay bugs:

- **Lost progress** — the server shut down before the save completed, or a
  failed request was never retried.
- **Item duplication** — the same record was read by two servers, both modified
  their copy, and both wrote it back.

Duplication in particular is almost never a flaw in the shop code. It is
non-atomic read-modify-write on the data store. Fixing the shop will not fix it.

## When to use

- Building player data persistence.
- Players report lost progress, rollbacks, or reset inventories.
- Investigating item or currency duplication.
- Adding a field to already-shipped player data.
- Sharing state across servers — trading, global leaderboards, matchmaking.

## When NOT to use

- Designing the save format itself. Use `save-systems` for what to persist,
  versioning and migration; this skill is Roblox's storage semantics.
- Purchases. Use `roblox-monetization`, where `ProcessReceipt` and exactly-once
  granting dominate.
- Auditing the remote boundary. Use `roblox-security`.

## Required context

| Fact | Why it matters | Where to find it |
|---|---|---|
| Rojo project or Studio-only | Decides whether file edits are usable | `default.project.json` |
| Whether the game has shipped | Shipped data can only be migrated, never reshaped | Release history |
| Current save shape and whether it is versioned | Migration is impossible without a version | The save module |
| Whether data is written from more than one place | Multiple writers is where duplication lives | Grep for the store name |
| Expected concurrent players | Drives request budget pressure | Analytics |
| Whether trading or cross-server features exist | Those need session locking and MemoryStore | The design |

## Version constraints

Roblox is a rolling release with no version to pin. What changes without notice
and must be confirmed against `create.roblox.com/docs` rather than assumed:

- **Request budgets and rate limits.** Any specific number is a starting point.
- **Available APIs.** `DataStoreService` has gained versioned and ordered
  variants over time; older tutorials predate them.
- **Deprecated patterns.** Code using `SetAsync` for player data, or `wait()`
  loops around retries, is following an old tutorial — and old tutorials teach
  exactly the patterns that cause duplication.

The one genuine gate is workflow: in a Studio-only place you cannot grep for
writers, so the inventory must be built by walking the Explorer.

## Workflow

1. **Enable Studio access to data stores** before testing anything, and know
   that Studio and live games can behave differently under load. A persistence
   system that has only been tested in Studio has not been tested.

2. **Use `UpdateAsync` for everything that matters.** `SetAsync` overwrites
   unconditionally: it discards whatever it did not know about, which is how one
   server's stale copy erases another's purchase. `UpdateAsync` gives you the
   current value in a transform function and writes the result atomically.

   ```lua
   store:UpdateAsync(key, function(current)
       local profile = current or Profile.new()
       profile.coins += amount            -- decided from the stored value
       return profile
   end)
   ```

   The rule: **derive the new value from the value the transform receives**,
   never from a copy you read earlier or hold in memory.

3. **Session lock.** A player can be on two servers briefly — during a teleport,
   a rejoin, or a server migration. Without a lock, both load, both modify, and
   the later write wins. Store an owning job id and a heartbeat timestamp in the
   profile; on load, refuse if another session holds the lock and its heartbeat
   is recent, and steal it if the heartbeat is stale enough to mean that server
   is gone. Release the lock explicitly on leave.

   This is the single mechanism that prevents most duplication.

4. **Retry with backoff, and never silently give up.** Data store calls fail —
   throttling, transient errors. Wrap every call in `pcall`, retry a bounded
   number of times with increasing delay, and if it ultimately fails, log it
   loudly. A save that failed and was not retried is lost progress the player
   will notice and you will not.

5. **Respect the request budget.** Roblox meters requests per server, scaled by
   player count. Saving every player every few seconds will exhaust it and start
   throttling, which turns into failed saves. Save on meaningful events — a
   purchase, a level, leaving — plus a periodic autosave measured in minutes,
   not seconds.

6. **Handle `BindToClose`.** When a server shuts down it gives you a short
   window to finish writing. Without it, everything not yet saved is gone. Save
   all remaining sessions there, and keep it bounded — the window is short.

7. **Version the schema and migrate on load**, following `save-systems`. A
   version field from the first release, and a migration chain rather than one
   branching loader.

8. **Use `MemoryStoreService` for cross-server coordination**, not
   `DataStoreService`. Trading locks, matchmaking queues and global counters
   need low latency and expiry, which is what MemoryStore is for. Data stores
   are for durable state.

9. **Validate what you load.** Stored data is input: it may be from an older
   version, partially written by a buggy release, or shaped in a way the current
   code does not expect. Validate and repair rather than assuming.

## Best practices

- **One writer per profile.** All mutations go through one module with one save
  path. Several scripts writing the same key is how the "impossible" bugs start.
- **Keep the profile in memory during the session** and write it on events —
  but always derive the write from `UpdateAsync`'s current value, not from the
  in-memory copy alone.
- **Save before any irreversible grant is reported to the player**, so a crash
  cannot leave them told they received something they did not.
- **Never store more than needed.** Large profiles are slower and closer to size
  limits; derive what you can.
- **Log every failed save with the player and the error.** Silent failure is
  indistinguishable from success until a player complains.
- **Keep the previous profile version** where feasible, so a bad migration can
  be recovered rather than only regretted.
- **Test with two servers.** Duplication is invisible with one.

## Common mistakes

- **`SetAsync` for player data.** Overwrites whatever it did not know about.
- **Read, modify in memory, write back later.** The classic duplication window:
  two servers read the same balance, both add, both write.
- **No session lock**, so a teleport or fast rejoin runs two sessions at once.
- **No `BindToClose`**, so a shutdown discards unsaved progress.
- **No retries**, so a single throttled call is permanent data loss.
- **Saving on a tight timer**, exhausting the budget and causing the throttling
  that then causes the loss.
- **Not `pcall`-ing data store calls.** An unhandled error stops the script and
  every subsequent save with it.
- **No version field.** Adding a field later becomes guesswork about shape.
- **Trusting loaded data blindly**, then erroring on a profile written by an
  older release.
- **Using a data store for cross-server coordination**, where latency and
  contention make it unsuitable.

## Validation

- **Two-server duplication test.** Join from two clients on separate servers,
  perform the same currency-spending action on both at once, and confirm the
  balance is correct afterwards. This is the test that finds duplication, and it
  cannot be done with one server.
- **Shutdown test.** Make a change, then shut the server down immediately.
  Rejoin and confirm the change survived — that verifies `BindToClose`.
- **Old-profile test.** Load a profile stored in the previous schema version and
  confirm migration produces correct current-shape data. Keep such profiles as
  fixtures.
- **Failure-path test.** Force save failures (an invalid key, or a stubbed
  failing call) and confirm the retry runs, the failure is logged, and the
  player is not silently told everything is fine.
- **Budget check.** With a full server, confirm request volume stays inside the
  budget — watch for throttling warnings in the output.
- **Single-writer check.** `grep -rn "GetDataStore\|UpdateAsync\|SetAsync" src/`
  should show one module doing the writing.
- Static checks clean: `selene`, `stylua --check`, `luau-lsp`.

## References

- Related platform skills: `roblox-security`, `roblox-monetization`,
  `roblox-client-server-architecture`
- Related core skills: `save-systems`, `client-server-trust`
- Roblox documentation for current budgets and limits: https://create.roblox.com/docs
