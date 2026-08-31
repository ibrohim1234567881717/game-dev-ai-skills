---
name: roblox-client-server-architecture
description: Structuring the client-server boundary in Roblox - RemoteEvents, RemoteFunctions, UnreliableRemoteEvents and BindableEvents, what replicates automatically and what does not, request-response patterns, ownership of state, and network ownership of parts. Use when designing any feature where the client and server must both participate, when replication behaves unexpectedly, or when deciding which side computes a result.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: roblox
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "client-server-trust, multiplayer-networking, game-architecture"
  uad-tags: "roblox, remoteevent, remotefunction, replication, network ownership, client server, bindableevent, luau"
  uad-maturity: stable
---

# Roblox Client-Server Architecture

## Purpose

`roblox-security` gives the procedure for auditing a boundary. This skill gives
the design that passes that audit: how to structure client-server communication
so that a client message is a **request the server validates**, never a result
the server accepts.

Roblox makes this harder than it looks, because a great deal replicates
automatically. That convenience hides where the boundary actually is, and code
written without noticing it is the usual source of both exploits and
"works in Studio, breaks in a live game".

## When to use

- Designing any feature where client and server both participate.
- Deciding which side computes a result.
- Replication behaves unexpectedly: a change on one side does not appear on the
  other, or appears and then reverts.
- Physics behaves differently in a live game than in Studio.
- Reviewing or refactoring existing remote usage.

## When NOT to use

- Auditing existing code for exploitability. Use `roblox-security`, which is the
  audit procedure; this skill is the design.
- Saving player data. Use `roblox-datastore-persistence`.
- Purchases. Use `roblox-monetization`, where exactly-once semantics dominate.
- Project layout and services generally. Use `roblox-project-conventions`.

## Required context

| Fact | Why it matters | Where to find it |
|---|---|---|
| Rojo project or Studio-only | Decides whether file edits are usable at all | `default.project.json` |
| Which remotes already exist | The current boundary; an unlisted one is unaudited | `ReplicatedStorage`, or grep for `:FireServer` |
| Where authority currently sits | Whether this is a redesign or an extension | Server handlers that assign from arguments |
| Whether the feature is economic | Currency and items get the strictest treatment | The design |
| Expected call rate | Decides rate limits and whether reliability is needed | The design |

## Version constraints

Roblox is a single rolling release, so there is no engine version to pin and no
version-gated API table. Two things are version-sensitive in practice:

- **New instance types appear without notice.** `UnreliableRemoteEvent` is a
  relatively recent addition; older code and tutorials predate it. Confirm
  availability rather than assuming.
- **Deprecated APIs signal old copied code.** `wait()`, `spawn()` and
  `Humanoid:LoadAnimation` indicate a codebase following old tutorials — and old
  tutorials almost always teach client authority. Treat their presence as a
  reason to look harder at the surrounding logic.

Verify limits — payload sizes, rate behaviour — against current documentation at
`create.roblox.com/docs`; any number here is a starting point, not a constant.

## Workflow

1. **Decide what actually needs a remote.** A great deal replicates by itself:
   instances parented under replicated containers, most property changes made on
   the server, and character movement. If the server changes a property on a
   replicated instance, clients see it — no remote required. Adding one anyway
   is duplicated state that can disagree with itself.

2. **Choose the right instrument.**

   | Instrument | Direction | Use for |
   |---|---|---|
   | `RemoteEvent` | either way, no reply | Most things. Client states intent; server notifies. |
   | `UnreliableRemoteEvent` | either way, no reply, may drop | High-frequency, disposable data where the next update supersedes the last |
   | `RemoteFunction` | caller waits for a reply | Rarely. See the warning below. |
   | `BindableEvent` / `BindableFunction` | within one side | Decoupling inside the server or inside a client. Never crosses the boundary. |

   **Prefer `RemoteEvent` over `RemoteFunction`.** A `RemoteFunction` invoked by
   the server on a client blocks on a machine the attacker controls: they can
   delay indefinitely or never return, and your server code is left waiting.
   Server-to-client invocation should be treated as unavailable for anything
   that matters. Client-to-server invocation is safer but still couples the
   caller to a round trip; a request event plus a response event is usually
   better and is trivially rate-limited.

3. **Model the message as an intent, not a result.** `BuyItem(itemId)`, not
   `GrantItem(itemId, price, quantity)`. The server looks up the price, checks
   the balance, decides the outcome. Every value the client could have chosen is
   a value it can lie about.

4. **Validate at the handler**, in this order: type and shape, range and domain,
   the referenced id exists, the caller owns or may act on it, the action is
   legal in the current state, and finally the business rule recomputed from
   server state. Reject rather than clamp, and log the rejection with the
   player. See `client-server-trust`.

5. **Rate limit every remote, server-side.** A per-player token bucket keyed by
   the `Player` argument that Roblox supplies — never by anything the client
   sends. Missing limits turn correct logic into a denial of service, and often
   into an economy exploit through races.

6. **Decide ownership of each piece of state**, and let one side own it. The
   server owns anything authoritative. The client may own purely presentational
   state — camera, local UI, particle timing — that no one else needs to trust.
   State owned by both, kept in sync by remotes, will eventually disagree.

7. **Understand network ownership of parts.** Roblox assigns physics simulation
   of unanchored parts to a client when a player is near, for responsiveness.
   That client is then computing that part's physics — and can manipulate it.
   For anything gameplay-critical, set ownership to the server explicitly.
   This is also the usual explanation for "physics works in Studio, breaks
   live": in Studio one machine is both.

8. **Keep the shared contract in one place.** A ModuleScript in
   `ReplicatedStorage` defining remote names and payload types, required by both
   sides. Typed Luau makes the contract checkable rather than conventional.
   Remember that anything in `ReplicatedStorage` is readable by the attacker,
   so the contract may hold names and shapes but never thresholds or secrets.

## Best practices

- **One remote per concern**, with a small, explicit payload. A single
  general-purpose remote taking an action name and an arbitrary table is one
  validation mistake away from being a scripting interface for attackers.
- **Send input, not state.** An input is a request you validate; a state is a
  claim you would have to trust.
- **Fire to the specific client** with `FireClient` when only one needs it, and
  reserve `FireAllClients` for genuinely broadcast information. Broadcasting
  reveals data to everyone, including players who should not have it.
- **Batch high-frequency updates** rather than firing per frame.
- **Use `UnreliableRemoteEvent` for superseded data** — positions, cosmetic
  effects — and never for anything whose loss matters.
- **Type the payloads** with typed Luau and validate at runtime anyway. Types
  are for you; validation is for the attacker.
- **Give client feedback immediately and let the server confirm**, rather than
  making the player wait a round trip. That is prediction, and it is
  presentation only — the server's answer is the outcome.

## Common mistakes

- **Accepting a client-supplied price, quantity, damage or position.** The
  canonical Roblox exploit.
- **`RemoteFunction` invoked from server to client.** The client can hang your
  server code indefinitely.
- **One catch-all remote** taking an action string and a table of arguments.
- **Hiding a UI button instead of denying the action.** The remote is still
  callable by anything the attacker writes; hidden is not disabled.
- **Trusting a `Player` argument sent by the client.** Roblox already supplies
  the true caller as the first argument to a server handler; anything the client
  sends about identity is a claim.
- **No rate limit**, because "the UI only allows one click per second".
- **Firing a remote per frame** and then wondering about performance.
- **Leaving unanchored gameplay-critical parts under client network ownership.**
- **Putting thresholds, drop tables or prices in `ReplicatedStorage`**, which is
  fully readable by the attacker, including ModuleScript source.
- **Using a `BindableEvent` and expecting it to cross the boundary.** It does
  not; it is same-side only.

## Validation

- **Inventory every remote** and confirm each has a server-side handler, in a
  `Script` and not a `LocalScript`. `grep -rn "FireServer\|InvokeServer\|OnServerEvent\|OnServerInvoke" src/`
  in a Rojo project; walk `ReplicatedStorage` in the Explorer otherwise.
- **No handler assigns a consequential value directly from an argument.** Read
  each one and check the outcome is recomputed.
- **Adversarial test.** From a `LocalScript` in a test place, call each remote
  with hostile arguments: negative and fractional quantities, another player's
  object ids, ids that do not exist, oversized strings, `nil`, wrong types, and
  a thousand calls per second. Server state must remain correct and each call
  must be rejected. This is the test that matters.
- **Static checks run clean:** `selene`, `stylua --check`, and `luau-lsp` type
  checking where the project configures them.
- **Two-client test.** Run two players in Studio and confirm state that should
  be private stays private, and shared state agrees between them.
- **Network ownership verified** for gameplay-critical unanchored parts.

## References

- [Remote design reference](references/REFERENCE.md)
- Related platform skills: `roblox-security`, `roblox-project-conventions`,
  `roblox-datastore-persistence`
- Related core skills: `client-server-trust`, `multiplayer-networking`
