---
name: multiplayer-networking
description: Designing networked gameplay - authority model, state replication, client prediction and reconciliation, latency compensation, bandwidth budgeting, and handling disconnects. Use when adding multiplayer, when networked movement or combat feels wrong, when players desynchronise, or when deciding between listen server, dedicated server and peer-to-peer.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: gamedev
  uad-version: "1.0.0"
  uad-requires: "client-server-trust, game-architecture"
  uad-tags: "multiplayer, networking, replication, authority, prediction, reconciliation, lag compensation, desync, bandwidth"
  uad-maturity: stable
---

# Multiplayer Networking

## Purpose

Networked gameplay is constrained by three facts that cannot be engineered away:
latency exists, bandwidth is finite, and clients are not trustworthy. Every
design decision here is a trade between responsiveness, consistency and security.

The most expensive mistake is architectural and made early: building
single-player and adding multiplayer later. Authority has to be designed in from
the start, because retrofitting it is close to a rewrite.

## When to use

- Adding multiplayer to a game, or designing one from the start.
- Networked movement, combat or interaction feels laggy, rubber-bandy, or unfair.
- Clients disagree about game state.
- Bandwidth or server cost is too high.
- Choosing a topology: dedicated server, listen server, or peer-to-peer.

## When NOT to use

- Local or split-screen multiplayer, which has none of these problems.
- Pure security auditing of an existing implementation. Use `client-server-trust`
  and the `security` agent.
- Turn-based games with no latency sensitivity, where a much simpler
  request/response model is sufficient and this complexity is unwarranted.

## Required context

| Fact | Why it matters |
|---|---|
| Topology | Determines where authority can live and what is attackable |
| Player count per session | Two and sixty-four are different problems |
| Latency-sensitivity of the core loop | A shooter and a strategy game need different techniques |
| Whether the game is competitive | Competition means cheating is worth the attacker's time |
| Target platforms and their network conditions | Mobile networks change every assumption |
| The engine's networking model | Constrains what is practical (see the platform skill) |

## Version constraints

The principles are version-independent physics and economics. Engine networking
frameworks are not: replication systems, RPC mechanisms and transport layers
change API and capability between versions, and some have been replaced entirely.
Establish the engine version and consult the platform skill —
`unreal-networking-replication`, `unity-netcode-multiplayer`,
`godot-multiplayer`, `roblox-client-server-architecture`,
`minecraft-networking` — before choosing a mechanism.

## Workflow

1. **Choose the topology, knowing the trade.** A dedicated server gives the best
   authority and the worst cost. A listen server is cheap but hands one player
   authority and zero latency, which is a competitive advantage and an attack
   surface. Peer-to-peer removes server cost and removes authority with it — it
   is not viable for competitive games.

2. **Put authority on the server, without exception, for anything that
   matters.** Health, damage, currency, items, scoring, progression, hit
   registration. See `client-server-trust`. If the request is for
   client-authoritative combat, say plainly that it is exploitable.

3. **Decide what replicates, and how often.** Not all state needs to be
   networked, and not at the same rate. Categorise: continuously replicated
   (positions), event-driven (an ability fired), and never replicated (purely
   cosmetic local state). This categorisation is the main determinant of
   bandwidth.

4. **Add client prediction for responsiveness.** The client simulates the local
   player immediately rather than waiting for a round trip, because input that
   waits for the server feels broken. Prediction is a *presentation* technique:
   the client never gains authority, it only guesses ahead.

5. **Implement reconciliation.** When the server's authoritative state arrives
   and disagrees with the prediction, the client corrects. Done well this is
   invisible; done badly it is rubber-banding. This requires the client to keep
   a buffer of unacknowledged inputs and re-simulate from the corrected state.

6. **Interpolate remote entities.** Other players' states arrive at discrete
   intervals and in the past. Render them interpolated and slightly delayed
   rather than snapping to each update.

7. **Decide the lag compensation policy explicitly.** Rewinding the world to
   validate a shot against what the shooter saw favours the shooter; not doing
   so favours the target. Neither is objectively correct — but the choice must be
   deliberate and consistent, because it defines how the game feels in a fight.

8. **Budget bandwidth.** Measure bytes per second per player at realistic player
   counts. Reduce with relevancy (do not send what a player cannot perceive),
   lower update rates for distant entities, quantisation, and delta compression.

9. **Handle failure as a normal case.** Disconnects, reconnects, timeouts,
   packet loss and host migration are the common path, not the exception. Decide
   what happens to a disconnected player's character and state before shipping.

## Best practices

- **Design authority first.** Everything else can be adjusted; this cannot.
- **Test under realistic conditions.** Use a network simulator with latency,
  jitter and packet loss. A game tested only on a LAN is untested.
- **Make the simulation deterministic** where prediction and reconciliation
  require it — same inputs, same result, no frame-timing or iteration-order
  dependence.
- **Separate simulation from presentation.** Prediction and interpolation are
  impossible when gameplay logic is embedded in rendering callbacks.
- **Send input, not state, from clients.** An input is a request the server
  validates; a state is a claim you would have to trust.
- **Use relevancy aggressively.** The largest bandwidth wins come from not
  sending things.
- **Log desyncs with enough context to reconstruct them.** They are extremely
  hard to reproduce after the fact.
- **Prototype the netcode early.** A game that plays well locally and badly at
  120 ms has an architectural problem, and later is worse.

## Common mistakes

- **Building single-player first and adding multiplayer later.** Effectively a
  rewrite.
- **Client-authoritative anything that matters.** Instantly exploitable in any
  game worth exploiting.
- **Testing only on a LAN or in the editor.** Every latency problem is invisible.
- **Replicating everything at full rate.** Bandwidth cost with no gameplay value.
- **No prediction.** Input feels unresponsive and players describe it as laggy.
- **Prediction without reconciliation.** Rubber-banding.
- **Snapping remote entities to each update.** Jittery motion; interpolate.
- **Ignoring disconnects.** Ghost characters, lost progress, stuck sessions.
- **Trusting client-reported hits or positions.**
- **Non-deterministic simulation** where prediction requires determinism —
  produces desyncs nobody can reproduce.

## Validation

- Play-test with a network simulator at realistic latency (100–200 ms), with
  jitter and 1–5% packet loss. This is the test that matters and the one usually
  skipped.
- Local player movement feels immediate at target latency.
- Remote players move smoothly, without jitter or teleporting.
- Corrections from reconciliation are not visible in normal play.
- Bandwidth measured in bytes per second per player at maximum player count,
  within budget.
- A client that sends hostile input — impossible positions, forged damage,
  repeated actions — cannot affect authoritative state. Test this explicitly.
- Disconnect and reconnect mid-session behaves as specified, with no ghost
  entities or lost state.
- No desync after an extended session with many players; log and check.

## References

- Related core skills: `client-server-trust`, `game-architecture`,
  `gameplay-systems`, `threat-modeling`, `performance-profiling-method`
- Platform applications: `unreal-networking-replication`,
  `unity-netcode-multiplayer`, `godot-multiplayer`,
  `roblox-client-server-architecture`, `minecraft-networking`
