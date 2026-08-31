---
name: security-review
description: Audit a system for exploitable weaknesses - map the trust boundary, inventory every crossing, check authority placement and validation, and rank findings by realistic risk. Use for games with economies or competitive state, web applications handling accounts or payments, and any code where a client sends something that matters.
metadata:
  uad-workflow: security-review
  uad-version: "1.0.0"
  uad-skills: "threat-modeling, client-server-trust, secure-coding, code-review-method"
---

# /security-review

```
SCOPE -> MAP THE BOUNDARY -> INVENTORY CROSSINGS -> AUTHORITY -> VALIDATION -> PERSISTENCE -> RANK -> REPORT
```

**The governing rule: code running on hardware you do not control is not
trustworthy, and nothing it sends is evidence of anything.**

## Steps

### 1. Scope it, and say so

What is in scope and what is not. An audit with unstated scope gets read as
coverage it never had — that is itself a way to cause harm.

### 2. Detect the platform

```bash
python tools/uad.py detect . --verbose
```

Load the platform's security skill: `roblox-security` or `web-security`.
Dependency vulnerabilities are version-specific, so read the lockfile, not the
manifest.

### 3. Map the trust boundary

List every process and mark which run on hardware the operator controls.
Everything crossing inward from those is hostile input — including data you sent
out a moment ago and expect back unchanged.

### 4. Inventory every crossing

Every endpoint, remote, packet, message: its arguments, and its handler.
Produce a table. **An uninventoried crossing is an unaudited one**, and it is
usually where the finding is.

Classify each as *informational*, *stateful*, or *economic*. Every economic
crossing gets the full treatment.

### 5. Check authority placement

For each decision ask: **if the client lied about this, what would it gain?**

These may only ever be computed server-side, from server state: currency
balances and prices, item identity and quantity, inventory contents, damage and
health, cooldown expiry, score and progression, loot outcomes, purchase
entitlement.

Look for handlers that assign a consequential value directly from an argument.
That is the canonical finding.

### 6. Check validation on every argument

Type and shape, range and domain, reference validity, ownership, state legality,
and the business rule **recomputed** rather than accepted. Rejection rather than
clamping. Rejections logged with the caller.

### 7. Check rate limiting

Every crossing, server-enforced, per caller. A valid request repeated ten
thousand times a second is an attack, and missing limits frequently turn correct
logic into an economy exploit through races.

### 8. Check persistence atomicity

Non-atomic read-modify-write on shared state is the mechanism behind nearly
every duplication exploit. Look for session locking where concurrent sessions
can touch one record, and for grants that happen before the write commits.

### 9. Check disclosure

Anything sent to a client is public: hidden entity positions, unopened loot,
drop tables, thresholds, and any secret in client-readable storage.

### 10. Rank and report

Impact times ease. Rank honestly — a trivially exploitable currency duplication
outranks a theoretical attack requiring privileged network position.

## Report format

```
[CRITICAL] <component>
  Threat     : <actor> can <action> resulting in <impact>
  Trigger    : the concrete request or sequence
  Evidence   : file:line, or observed behaviour
  Mitigation : the specific change, in the specific component
  Verify by  : the test that proves it closed
```

## Done means

- [ ] Scope is stated, including what was **not** examined.
- [ ] Every boundary crossing is inventoried with handler and arguments.
- [ ] Every economic crossing has been checked for authority, validation, rate
      limiting and atomicity.
- [ ] Findings are ranked by realistic risk, each with a concrete trigger.
- [ ] Each finding has a specific mitigation and a way to verify it.
- [ ] The highest-ranked findings were tested against the running system, not
      only reasoned about.

## Rules

- Do not produce exploit tooling. Findings, reproduction steps for the owner's
  own system, and fixes are the deliverable.
- Do not invent cryptography. Use vetted libraries and say which.
- "Validate input" is not a mitigation. Name the check, the component, and the
  verification.
