---
name: client-server-trust
description: The trust boundary rule for any system where code runs on hardware someone else controls - game clients, browsers, mobile apps, mod clients. Use when designing or auditing anything involving player actions, currency, items, scores, purchases, matchmaking, or multiplayer state, and whenever deciding which side of a connection computes a result. Covers server authority, input validation, rate limiting, information disclosure, and the difference between authentication and authorization.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: security
  uad-version: "1.0.0"
  uad-requires: "threat-modeling"
  uad-tags: "security, authority, cheating, exploit, validation, trust boundary, multiplayer, anti-cheat"
  uad-maturity: stable
---

# Client-Server Trust

## Purpose

A client is a program running on a machine the operator controls completely.
They can read its memory, modify its code, intercept and forge its network
traffic, and run it at any speed. Nothing the client says is evidence of
anything.

This is the single most violated rule in game and web development, and its
violations are not stylistic -- they are duplication exploits, infinite
currency, wallhacks, and account takeover. This skill states the rule, the
reasoning, and the audit procedure, so that platform skills
(`roblox-security`, `web-security`, `multiplayer-networking`,
`minecraft-networking`) can apply it without restating it.

**The rule: the client is a rendering and input surface. The server is the
source of truth. A client message states an *intent*, never a *result*.**

## When to use

- Designing or reviewing any client-server feature: movement, combat, economy,
  inventory, progression, matchmaking, chat, purchases.
- Auditing an existing codebase for exploitability.
- Deciding where a computation belongs.
- Investigating suspected cheating, duplication, or currency inflation.
- Any time a message from a client contains a number that matters.

## When NOT to use

- Purely single-player, offline software with no shared state and no
  purchasable content. Save-file editing is a different (usually acceptable)
  threat model.
- Trusted server-to-server communication inside one security domain -- though
  be sure it really is one.
- Cryptographic protocol design. Use vetted libraries and specialist review;
  this skill is about authority placement, not primitives.

## Required context

| Fact | Why it matters |
|---|---|
| Which processes run on attacker-controlled hardware | Defines the boundary |
| What crosses the boundary, in both directions | Defines the attack surface |
| Which state is authoritative, and where it lives | Defines what can be forged |
| What a successful attack would be worth | Sets the depth of defence |
| Whether state is persisted, and how atomically | Duplication bugs live here |
| Whether the product is monetised | Real money raises every stake |

## Version constraints

Version-independent: this follows from who owns the hardware, not from any API.
What changes is the *transport* -- RemoteEvents, RPCs, replicated properties,
HTTP endpoints, WebSocket frames, custom packets. The boundary is the same in
every one of them. Consult the platform skill for the transport's specifics.

## Workflow

1. **Draw the boundary.** List every process and mark which run on hardware you
   do not control. Everything on the far side is hostile input, including data
   you sent it a moment ago.

2. **Inventory every crossing.** Every endpoint, remote, packet and message,
   with its arguments and its handler. An unlisted crossing is an unaudited one.

3. **Classify by consequence.** *Informational* (presentation only),
   *stateful* (mutates server state), *economic* (currency, items, purchases,
   ranking). Audit depth scales with the class; every economic crossing gets the
   full treatment.

4. **Place authority.** For each decision, ask: *if the client lied about this,
   what would it gain?* Anything with a valuable answer is computed server-side
   from server state. Non-negotiable examples: currency balances and prices,
   item identity and quantity, damage and health, cooldown expiry, score,
   progression, loot outcomes, matchmaking rating, purchase entitlement.

5. **Validate every argument at the boundary**, in this order:
   - **Type and shape** -- reject anything not matching the expected schema.
   - **Range and domain** -- quantities positive and bounded, enums in set,
     strings length-capped, floats finite.
   - **Reference validity** -- the id exists.
   - **Ownership** -- the caller may act on that object.
   - **State legality** -- the action is legal *now* (alive, in range, not on
     cooldown, has the item, has the funds).
   - **Business rules** -- recompute the outcome from server state; never accept
     a client-supplied result.
   Failing any check: reject, log, do not partially apply.

6. **Rate limit every crossing.** A valid request repeated ten thousand times a
   second is an attack. Per-caller token buckets or cooldowns, enforced
   server-side. Missing rate limits turn correct logic into a denial-of-service
   and often into an economy exploit through race conditions.

7. **Make state changes atomic.** Read-modify-write on shared state without
   atomicity is the mechanism behind almost every duplication exploit. Use the
   platform's atomic update primitive, and hold a session lock where concurrent
   sessions can touch the same record.

8. **Audit what the client can see.** Anything sent to the client is disclosed:
   positions of hidden enemies, contents of unopened loot, other players' cards,
   answer keys, drop tables, validation thresholds. Send what the player is
   entitled to know, not what is convenient to filter client-side.

9. **Separate authentication from authorization.** Knowing *who* is calling does
   not establish *what they may do*. Check permission per action, against
   server-side state, every time.

10. **Prefer prediction over authority for responsiveness.** Where latency
    demands instant feedback, let the client *predict* and the server
    *reconcile*. Prediction is a presentation technique; it never grants the
    client authority over the outcome.

## Best practices

- **Design so that a lie is impossible, not merely detected.** Detection is a
  fallback for what cannot be structurally prevented.
- **Validate at the boundary, once, thoroughly** -- then treat data as trusted
  inside. Scattered re-validation drifts and leaves gaps.
- **Reject rather than clamp.** Silently clamping a hostile value hides an
  attack; rejection is observable and logs a signal.
- **Log rejections with the caller identity.** The pattern of failures is how
  exploitation is discovered.
- **Assume the client is a hand-written program.** Not your client with a
  modified variable -- an arbitrary program that sends whatever it wants.
- **Keep secrets server-side.** Constants shipped to the client are public.
- **Fail closed.** On error or ambiguity, deny.
- **Make grants idempotent.** Purchases and rewards must be safe to replay;
  retries are normal and duplicate grants are money.

## Common mistakes

- **Trusting a client-sent price, quantity, damage, position or currency
  amount.** The canonical exploit. Recompute from server state.
- **Validating in the client only.** Client-side validation is a user-experience
  feature. The attacker does not run it.
- **Hiding a UI control instead of denying the action.** The remote is still
  callable. Hidden is not disabled.
- **Filtering sensitive data on the client.** If it reached the client, it is
  disclosed, however it is rendered.
- **Non-atomic read-modify-write on persisted state.** Two concurrent requests
  read the same balance, both succeed, the item is duplicated.
- **Granting before persisting.** A crash between grant and save yields either a
  lost purchase or a free item.
- **Trusting a "signed" or "encrypted" client payload.** The client holds the
  key; it can sign anything.
- **No rate limit because "the UI only allows one per second".** The UI is not
  in the threat model.
- **Treating obfuscation as security.** It raises effort slightly and changes
  nothing structurally.
- **Confusing authentication with authorization.** A logged-in user is not an
  authorised one.

## Validation

Audit an implementation against these. Each must be answerable with evidence,
not with intent:

- [ ] Every boundary crossing is inventoried, with handler and arguments.
- [ ] No server handler assigns a consequential value directly from an argument.
- [ ] Every argument is type-, range-, ownership- and state-validated server-side.
- [ ] Every economic action recomputes its outcome from server state.
- [ ] Every crossing has a server-enforced rate limit.
- [ ] Persisted mutations are atomic; concurrent sessions cannot interleave.
- [ ] Grants are idempotent and persisted before being reported as complete.
- [ ] No secret, threshold or hidden-state value is sent to a client that is not
      entitled to it.
- [ ] Authorization is checked per action, not implied by authentication.
- [ ] Rejections are logged with caller identity.

A practical test: write a script that calls each endpoint with hostile
arguments -- negative quantities, other players' object ids, values beyond
range, ten thousand calls per second, out-of-order sequences. Server state must
remain correct and the calls must be rejected. If any test changes state in the
attacker's favour, that is a confirmed finding.

## References

- Platform applications: `roblox-security`, `web-security`, `web-authentication`,
  `multiplayer-networking`, `minecraft-networking`
- Related core skills: `threat-modeling`, `secure-coding`, `code-review-method`
