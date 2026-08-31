---
name: save-systems
description: Designing save and load systems that survive shipping - deciding what to persist, choosing a format, versioning the schema and migrating old saves, resisting corruption, and timing autosaves. Use when building or changing persistence, when saves break after an update, when players report lost progress, or when deciding what belongs in a save file at all.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: gamedev
  uad-version: "1.0.0"
  uad-requires: "game-architecture"
  uad-tags: "save, load, persistence, serialisation, migration, schema version, corruption, autosave, data loss"
  uad-maturity: stable
---

# Save Systems

## Purpose

Losing a player's progress is the defect with the least forgiveness in games.
There is no workaround, no "restart and try again", and a player who loses hours
of progress usually does not come back.

Two decisions cause most of that loss, and both are made early and cheaply:
**no version field in the save format**, and **overwriting the only copy while
writing**. This skill covers those and the rest of the persistence design.

## When to use

- Building persistence for the first time in a project.
- Changing what is saved, or the shape of what is saved.
- Saves written by a previous version fail to load after an update.
- Players report lost or reset progress.
- Deciding whether something belongs in the save at all.
- Preparing a release — loading a previous version's save is a release gate.

## When NOT to use

- Server-authoritative persistence on a specific platform, where the platform's
  storage semantics dominate. Use `roblox-datastore-persistence` or the
  equivalent, which requires this skill for the general design.
- Configuration and settings, which are simpler and rarely need migration.
- Networked state synchronisation. Use `multiplayer-networking`.

## Required context

| Fact | Why it matters | Where to find it |
|---|---|---|
| What must survive a restart | Defines the save's scope | The design, not the code |
| Whether saves are local or server-side | Server-side means concurrency and trust concerns | Architecture |
| Whether the game has already shipped | A shipped format cannot be changed, only migrated | Release history |
| Whether saves are player-visible | Local files invite editing; decide if that matters | Platform |
| Expected save size and frequency | Decides format and write strategy | Gameplay design |
| Platform storage constraints | Consoles and mobile have quotas and certification rules | Platform docs |

## Version constraints

The design is version-independent. Engine serialisation is not, and this is a
frequent source of silent data loss: engines serialise by **field name**, so
renaming a field or class in code breaks every existing save that references it.
Before renaming anything that is persisted, check what the engine serialises and
plan a migration. Engine serialisers also differ in what they support at all —
dictionaries, interfaces and polymorphic types often need explicit handling.

## Workflow

1. **Decide what is saved and what is derived.** Save the minimum from which
   everything else can be recomputed. Saving derived state doubles the surface
   that can become inconsistent, and inconsistent state is harder to recover
   from than missing state.

2. **Put a version field in the format from the very first release.** This is
   the single decision that cannot be retrofitted: once saves exist in the wild
   without a version, you are guessing at their shape forever. One integer, at
   the top of the file, before anything else.

3. **Separate the save model from the runtime model.** A dedicated serialisable
   type per saved concept, mapped to and from the live objects. Persisting live
   objects directly couples your file format to your class layout, so every
   refactor becomes a migration.

4. **Choose the format deliberately.** Text (JSON) is debuggable, diffable and
   easy to support; binary is smaller and faster and hides nothing meaningful
   from a determined player. Choose for debuggability unless size or load time
   is measured to be a problem.

5. **Write atomically.** Never overwrite the only copy:

   ```
   write to a temporary file
   flush and close
   atomically replace the real file
   ```

   A crash or power loss mid-write must leave the previous save intact. Keeping
   one prior save as a backup costs almost nothing and converts "progress lost"
   into "lost the last few minutes".

6. **Write migration as a chain, not as a special case.** Each version knows how
   to become the next: `v1 → v2 → v3`. Loading a v1 save runs both steps. The
   alternative — one loader that handles every historical shape — becomes
   unmaintainable by the third version.

7. **Validate on load, and fail loudly to the player, not silently.** A save
   that fails validation should say so and offer the backup, rather than
   loading half of it and letting the player discover the damage an hour later.

8. **Decide autosave timing from the player's perspective.** Save at points
   where losing progress is cheap — after a checkpoint, on level transition,
   after a meaningful gain — and never mid-transaction, where a crash could
   leave an item removed and its replacement not yet granted.

9. **Test loading old saves as a release gate**, using saves written by the
   previously *released* build. See `/release-check`.

## Best practices

- **Version from day one**, even in a prototype that "will not ship".
- **Keep a backup of the previous save**, and make restoring it a player-visible
  option rather than a support request.
- **Never save mid-transaction.** Grant and deduct in one atomic step, then save.
- **Make migrations pure and testable** — a function from old shape to new,
  with a test per step using a real old save as the input.
- **Keep saves small.** Large saves are slow to write, and a long write is a
  bigger window for corruption.
- **Log the save version on load.** When a player reports a problem, the first
  question is which version wrote the file.
- **Treat a server-side save as untrusted input** on read, and see
  `client-server-trust` for who is allowed to write it.
- **Store real timestamps** rather than relying on file modification times,
  which are unreliable across platforms and cloud sync.

## Common mistakes

- **No version field.** The mistake that cannot be undone once saves exist in
  the wild.
- **Serialising live game objects directly.** Every rename or refactor becomes a
  breaking format change, usually discovered after release.
- **Overwriting the save in place.** A crash mid-write destroys the only copy.
- **Silently discarding a save that fails to load** and starting a new game.
  From the player's side this is indistinguishable from the game deleting their
  progress.
- **Saving derived state**, which then disagrees with the source of truth.
- **One monolithic loader** with branches for every historical version.
- **Saving mid-transaction**, producing duplicated or vanished items on a crash.
- **Renaming a serialised field or class** without a migration — silent data
  loss, and the engine gives no warning.
- **Not testing with saves from the previous release.** The most common
  release-blocking persistence bug, and the cheapest to catch.
- **Trusting a client-supplied save in a networked game.** It is attacker-authored.

## Validation

- A save written by the **previously released build** loads correctly in the
  current build. Keep such files in the repository as test fixtures.
- Every migration step has a test: a real old-format save in, the expected new
  shape out.
- Killing the process during a write leaves the previous save loadable. Test
  this deliberately — it is the scenario the atomic write exists for.
- A deliberately corrupted save produces a clear message and an offer to restore
  the backup, never a silent new game and never a crash.
- A round trip is lossless: save, load, save again, and the two files match.
- Save and load time measured with a realistic late-game save, not an empty one.
- The save's version field is logged on load.

## References

- Related core skills: `game-architecture`, `gameplay-systems`,
  `client-server-trust`, `testing-strategy`
- Workflow: `/release-check`, which gates on loading a previous version's save
- Platform applications: `roblox-datastore-persistence`
