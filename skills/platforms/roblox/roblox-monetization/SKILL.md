---
name: roblox-monetization
description: Handling Robux purchases correctly - developer products, game passes, subscriptions, ProcessReceipt and its exactly-once semantics, MarketplaceService checks, and granting items without duplicating or losing them. Use when implementing or auditing any purchase flow, when players report paying without receiving, or when investigating duplicated purchased items.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: roblox
  uad-domain: security
  uad-version: "1.0.0"
  uad-requires: "roblox-security, roblox-datastore-persistence, client-server-trust"
  uad-tags: "roblox, monetization, robux, processreceipt, developer product, game pass, purchase, idempotency, receipt"
  uad-maturity: stable
---

# Roblox Monetization

## Purpose

Purchases involve real money, which makes every failure mode expensive in a way
gameplay bugs are not. A player who pays and receives nothing files a complaint;
a duplication bug in a purchase flow is an unbounded loss.

Roblox's purchase API has one subtlety that causes most of these problems:
**`ProcessReceipt` may be called more than once for the same purchase**, and it
is your handler's job to make that harmless. Treating it as a
"purchase happened, grant the item" callback is the defect.

Treat this skill with the same rigour as `roblox-security`. It is a security
skill that happens to be about money.

## When to use

- Implementing developer products, game passes, or subscriptions.
- Auditing an existing purchase flow.
- Players report paying and not receiving.
- Investigating duplicated purchased items or currency.
- Adding a new purchasable, into a flow that already exists.

## When NOT to use

- Auditing the general remote boundary. Use `roblox-security`.
- General player data storage. Use `roblox-datastore-persistence`, which this
  skill depends on — a purchase flow is only as safe as the write underneath it.
- In-game economies with no real money, where the stakes and mechanisms differ.

## Required context

| Fact | Why it matters | Where to find it |
|---|---|---|
| Which product types are used | One-time passes and consumable products behave differently | The design |
| Whether `ProcessReceipt` is already assigned, and where | It may be assigned in only one place | Grep for `ProcessReceipt` |
| How the grant is persisted | The grant and the receipt record must commit together | The data module |
| Whether purchases can stack | Decides what a repeat receipt should mean | The design |
| Whether the game already shipped | Live purchases constrain any change to the flow | Release history |

## Version constraints

Roblox is a rolling release. Subscriptions and some marketplace APIs are more
recent additions than the core product and pass APIs, so confirm availability
and current semantics at `create.roblox.com/docs` rather than assuming.

One specific deprecation matters here: checking pass ownership with
`Player:PlayerOwnsAsset` for a game pass is a legacy pattern that appears in old
tutorials. Use the pass-specific ownership check. Its presence usually indicates
code copied from a source that also predates correct receipt handling.

## Workflow

1. **Know which mechanism fits.** A **game pass** is a permanent one-time
   entitlement: ownership is checked, not granted. A **developer product** is
   consumable and repeatable: each purchase produces a receipt you must process.
   A **subscription** is recurring and its state must be re-checked, not
   remembered. Choosing wrong here produces a flow that cannot be made correct
   later.

2. **Assign `ProcessReceipt` exactly once, in one server script.** Roblox allows
   one handler. Two scripts assigning it means one silently wins, and purchases
   routed through the other are lost. Grep before writing.

3. **Make the handler idempotent.** This is the core requirement. Roblox may
   call it again for the same `PurchaseId` — after a retry, a server restart, or
   a network hiccup. The handler must:

   - Look up whether this `PurchaseId` has already been recorded for this player.
   - If it has, return the "granted" result **without granting again**.
   - If it has not, grant and record the id **in the same atomic write**.

4. **Grant and record together, atomically.** This is where duplication and loss
   actually happen:

   - Grant, then record → a failure between them means a repeat call grants
     again. **Duplication.**
   - Record, then grant → a failure between them means the player paid and
     received nothing, and the recorded id prevents a retry from fixing it.
     **Loss.**

   Both operations belong inside one `UpdateAsync` transform, so they commit or
   fail together. See `roblox-datastore-persistence`.

5. **Return the correct result, and only after the write succeeded.** Returning
   the granted result tells Roblox to finalise the purchase. Return it only once
   the data write has actually committed. If the write failed, return the
   not-processed result so Roblox retries — that is the mechanism that makes the
   system self-healing, and returning granted on a failed write defeats it.

6. **Never trust the client about a purchase.** A client may prompt a purchase,
   but the fact that a purchase occurred comes from `ProcessReceipt`, never from
   a remote. A `RemoteEvent` named `PurchaseComplete` fired by the client is a
   free-items exploit.

7. **Check pass ownership server-side, every session.** Ownership can change —
   refunds happen. Cache it for the session if you like, but establish it from
   the server, not from a client-sent claim.

8. **Handle the prompt-closed case honestly.** The purchase prompt closing does
   not mean a purchase happened. Only the receipt does.

9. **Log every receipt.** Player, product, `PurchaseId`, outcome. When a player
   says they paid and received nothing, this log is the only way to answer.

## Best practices

- **One purchase module.** All product handling in one place, with one receipt
  handler and one grant path.
- **Store processed `PurchaseId`s with the player's profile**, so the
  idempotency check and the grant share one atomic write.
- **Bound the stored receipt history** — keep enough to cover any plausible
  retry window rather than growing it forever.
- **Grant the effect of the product, not a currency shortcut**, where the two
  can diverge.
- **Make the grant path work when the player has left.** Receipts can arrive at
  awkward times; a handler that assumes a live character will fail.
- **Test with real purchases in a test place.** The flow cannot be fully
  exercised any other way.
- **Treat a failed grant as an incident**, not a warning. It is money.
- **Never expose prices or product ids as authoritative from the client.** The
  server decides what a product grants.

## Common mistakes

- **Treating `ProcessReceipt` as "grant the item".** Not idempotent; repeat
  calls duplicate.
- **Granting before persisting**, or persisting before granting. Both are wrong;
  they must be one atomic write.
- **Returning the granted result before the write commits.** Roblox finalises
  the purchase and stops retrying, so a failed write becomes permanent loss.
- **Assigning `ProcessReceipt` in two scripts.** One silently wins.
- **A client-fired "purchase complete" remote.** Free items for anyone who
  writes one line of Luau.
- **Using the prompt-closed signal as proof of purchase.** It is not.
- **Never recording `PurchaseId`s**, leaving no way to detect a repeat.
- **Unbounded receipt history** in the profile, growing until it hits size limits.
- **Checking pass ownership on the client.**
- **No logging**, so a paid-and-not-received report cannot be investigated.

## Validation

- **Idempotency test.** Call your receipt-processing function twice with the
  same `PurchaseId` and confirm the item is granted **once**. Structure the
  handler so this is callable in a test — if it cannot be tested without a real
  purchase, that is a design problem worth fixing.
- **Failure-path test.** Force the data write to fail and confirm the handler
  returns the not-processed result, so Roblox retries. Then let it succeed and
  confirm the grant happens exactly once.
- **Single-handler check.** `grep -rn "ProcessReceipt" src/` returns exactly one
  assignment.
- **No client authority.** `grep -rn "FireServer" src/` — no remote grants a
  purchase, and no handler grants based on a client claim.
- **Live purchase test** in a test place: buy a product, confirm the grant, and
  confirm the receipt log entry exists.
- **Leave-during-purchase test.** Trigger a purchase and leave immediately;
  confirm the grant survives and applies on the next join.
- **Ownership test.** Confirm pass ownership is established server-side each
  session, not remembered from a client.
- Static checks clean: `selene`, `stylua --check`, `luau-lsp`.

## References

- Related platform skills: `roblox-security`, `roblox-datastore-persistence`,
  `roblox-client-server-architecture`
- Related core skills: `client-server-trust`, `threat-modeling`
- Roblox documentation for current marketplace APIs: https://create.roblox.com/docs
