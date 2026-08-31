---
name: unreal-networking-replication
description: Building networked gameplay in Unreal - property replication, RPCs and their authority rules, relevancy and net culling, the Push Model, client prediction, and the difference between listen and dedicated servers. Use when adding multiplayer, when replicated state does not arrive or arrives wrong, when movement rubber-bands, or when network bandwidth is too high.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: unreal
  uad-domain: gamedev
  uad-version: "1.0.0"
  uad-requires: "multiplayer-networking, client-server-trust, unreal-cpp-gameplay"
  uad-tags: "unreal, replication, rpc, multiplayer, authority, relevancy, push model, dedicated server, netcode, rubber banding"
  uad-maturity: stable
---

# Unreal Networking and Replication

## Purpose

Unreal has one of the more capable built-in networking models, and that is
precisely what makes it easy to misuse: a great deal replicates by writing one
specifier, so people write specifiers until it works rather than deciding where
authority lives.

The general design — authority, prediction, reconciliation, bandwidth — is in
`multiplayer-networking`. This skill covers Unreal's mechanisms and the rules
that decide whether your code runs at all on a given machine.

## When to use

- Adding multiplayer to an Unreal project, or designing one.
- A replicated property does not arrive, or arrives with the wrong value.
- An RPC does not execute, or executes on the wrong machine.
- Movement rubber-bands or corrects visibly.
- Bandwidth or server cost is too high.
- Behaviour differs between Play-In-Editor and a dedicated server.

## When NOT to use

- Single-player only. None of this applies and it adds real cost.
- General netcode design questions. Use `multiplayer-networking` first.
- Auditing for exploitability. Use `client-server-trust` and the `security` agent.
- Gameplay Ability System replication specifically. Use
  `unreal-gameplay-ability-system`, where replication modes and prediction have
  their own rules.

## Required context

| Fact | Why it matters | Where to find it |
|---|---|---|
| Engine version | Replication features have changed across 5.x | `EngineAssociation` |
| Dedicated or listen server | Listen server hands one player zero latency and local authority | Project setup |
| Expected player count | Relevancy and bandwidth strategy scale with it | The design |
| Whether the project is competitive | Decides how much prediction abuse matters | The design |
| Current authority placement | Whether this is a redesign or an extension | `HasAuthority()` usage |

## Version constraints

The core model — `Replicated` properties, `Server`/`Client`/`NetMulticast` RPCs,
`GetLifetimeReplicatedProps` — has been stable for a long time. What has moved
across 5.x is the surrounding machinery: the Push Model, iris/replication system
work, and the defaults around them.

Confirm against the project's engine version before relying on any of it, and
be aware that a project upgraded from an earlier engine may still be configured
for the older path.

## Workflow

1. **Decide authority before writing any specifier.** For each piece of state
   and each decision, ask what a client could gain by lying. Health, damage,
   score, inventory, currency and progression are server-computed, always. See
   `client-server-trust`.

2. **Know where your code is running.** This is the single most common source of
   Unreal networking confusion:

   ```cpp
   if (HasAuthority())        // server (or listen-server host)
   if (IsLocallyControlled()) // this machine's own pawn
   if (GetNetMode() == NM_DedicatedServer)
   ```

   A dedicated server has no local player and does not render. Code that assumes
   a viewport, a camera, or a local controller will crash or silently do nothing
   there — and Play-In-Editor with one player hides it completely.

3. **Replicate properties for state, use RPCs for events.** A property is
   *what is true*; an RPC is *something happened*. Replicated properties are
   eventually consistent, arrive in order, and a late-joining client receives
   the current value. An RPC is fire-and-forget and a late joiner never sees it.
   Using an RPC to establish state is why late joiners see a broken world.

   ```cpp
   UPROPERTY(ReplicatedUsing = OnRep_Health)
   float Health;

   void AMyChar::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& Out) const
   {
       Super::GetLifetimeReplicatedProps(Out);
       DOREPLIFETIME(AMyChar, Health);
   }
   ```

   Forgetting `GetLifetimeReplicatedProps` is the most common reason a property
   marked `Replicated` never arrives — the specifier alone does nothing.

4. **Understand RPC direction and its authority rule.**

   | Specifier | Called on | Executes on |
   |---|---|---|
   | `Server` | Client (owning) | Server |
   | `Client` | Server | The owning client |
   | `NetMulticast` | Server | Server and all relevant clients |

   `Server` RPCs require the calling client to **own** the actor. Calling one
   from a client that does not own the actor silently does nothing — another
   frequent source of "my RPC does not fire".

   Mark `Server` RPCs `WithValidation` and actually validate: the parameters are
   attacker-controlled, exactly as in any other client-server system.

5. **Use `OnRep_` functions for reactions, not for authority.** They run on
   clients when a value arrives, which makes them the right place for effects,
   UI updates and sounds. They do **not** run on the server by default, so
   server-side consequences must be triggered explicitly where the value is set.

6. **Control relevancy and update frequency.** Bandwidth is finite and largely
   determined by how much you choose not to send:

   - `NetCullDistanceSquared` — actors beyond it are not replicated to a client.
   - `NetUpdateFrequency` / `MinNetUpdateFrequency` — how often an actor is
     considered. Distant or unimportant actors do not need the default rate.
   - `bAlwaysRelevant` — use sparingly; it defeats culling entirely.
   - `bOnlyRelevantToOwner` — for per-player state nobody else should see.

   Relevancy is also a **security** control: an actor a client never receives is
   an actor that client cannot read positions from.

7. **Consider the Push Model.** By default Unreal compares properties every
   update to detect changes. The Push Model instead has you mark a property
   dirty when it changes, removing that comparison cost. On projects with many
   replicated properties this is a substantial saving. Confirm the setup and
   macros for your engine version.

8. **For movement, use the Character Movement Component's prediction** rather
   than writing your own. It already implements client prediction with server
   reconciliation. Custom movement replicated by hand is where rubber-banding
   comes from, and matching what CMC does correctly is a large piece of work.

9. **Test with simulated latency, and on a real dedicated server.**

## Best practices

- **Test on a dedicated server from early on**, not just Play-In-Editor with
  two windows. Listen-server-only testing hides an entire class of bug, because
  the host has zero latency and full authority locally.
- **Prefer replicated properties to multicast RPCs** for anything a late joiner
  must see.
- **Validate every `Server` RPC parameter.** `WithValidation` exists for this.
- **Replicate the minimum.** Cosmetic state can often be derived on the client
  from something already replicated.
- **Quantise where precision is not needed** — full-precision vectors and
  rotators cost more than the gameplay requires.
- **Set net cull distances deliberately** rather than leaving defaults on
  actors that will never matter at range.
- **Use `net.PktLag` and related console commands** to simulate latency and
  loss; a build tested only on a LAN is untested.
- **Log on both sides while debugging**, with the net mode in the message. Half
  of networking debugging is discovering the code ran somewhere you did not
  expect.

## Common mistakes

- **Marking a property `Replicated` and forgetting `GetLifetimeReplicatedProps`.**
  Silently never replicates.
- **Using a multicast RPC to establish state.** Late joiners never see it.
- **Calling a `Server` RPC from a client that does not own the actor.** Silently
  does nothing.
- **Assuming `OnRep_` runs on the server.** It does not, by default.
- **Client-authoritative gameplay** because it was easier to make responsive.
  Instantly exploitable, and retrofitting authority is close to a rewrite.
- **Testing only as a listen-server host**, who has no latency and local
  authority — the one player whose experience proves nothing.
- **Referencing a local player controller, camera or viewport in code that runs
  on a dedicated server.** Crash or silent no-op, invisible in PIE.
- **Everything `bAlwaysRelevant`**, defeating culling and inflating bandwidth.
- **Hand-rolled character movement replication** instead of the Character
  Movement Component, then fighting rubber-banding.
- **Not validating `Server` RPC parameters**, treating the specifier as if it
  were a security boundary. It is a routing rule, not a validator.

## Validation

- **Dedicated server test.** Package and run a dedicated server with at least
  two clients. Anything that works in PIE and breaks here is a net-mode
  assumption, and finding it early is the point.
- **Late joiner test.** Have a client join after state has changed and confirm
  it sees the correct world. This is the test that catches state established by
  multicast RPCs.
- **Latency test.** `net.PktLag 150`, plus jitter and loss, and play. Movement
  should stay responsive locally and smooth for observers.
- **Hostile client test.** Confirm a client cannot affect authoritative state by
  calling `Server` RPCs with invalid parameters, or by calling ones it does not
  own. Server state must remain correct.
- **Bandwidth measurement.** Use the networking stats to measure bytes per
  second per client at maximum player count, against a budget.
- **Relevancy check.** Confirm a distant client does not receive actors it
  should not — both a bandwidth and an information-disclosure check.

## References

- Related platform skills: `unreal-cpp-gameplay`,
  `unreal-gameplay-ability-system`, `unreal-performance-profiling`
- Related core skills: `multiplayer-networking`, `client-server-trust`,
  `game-architecture`
