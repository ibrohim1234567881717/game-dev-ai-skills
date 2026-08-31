---
name: threat-modeling
description: Structured analysis of what an attacker would target in a system and which defences are worth building. Use before designing a feature that handles money, accounts, player data, user content, or competitive state, when scoping a security review, or when deciding whether a reported weakness matters. Produces a ranked list of threats with concrete mitigations rather than a generic security checklist.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: security
  uad-version: "1.0.0"
  uad-tags: "security, threat model, attack surface, risk, STRIDE, abuse cases, review"
  uad-maturity: stable
---

# Threat Modeling

## Purpose

Security work without a threat model is a checklist applied uniformly: much
effort spent on things nobody would attack, and the actual valuable target left
open. A threat model asks four questions in order -- *what are we building,
what can go wrong, what will we do about it, did we do a good enough job* --
and produces a **ranked** list, so that effort follows value.

## When to use

- Designing any feature involving money, accounts, personal data, user-generated
  content, or competitive standing.
- Scoping a security review, so the review has a target list rather than a mood.
- Triaging a reported weakness: deciding whether it matters and how much.
- Before launch, as a release gate for anything that handles value.
- When adding a new external interface, integration, or dependency.

## When NOT to use

- Implementing a specific defence you have already decided on. Use
  `secure-coding` or the platform's security skill.
- Responding to an in-progress incident. Contain first; model afterwards.
- Cryptographic design. Use vetted primitives and specialist review.
- Trivial internal tooling with no valuable target -- say so explicitly and move
  on rather than performing the ceremony.

## Required context

| Fact | Why it matters |
|---|---|
| What the system does, and its data flows | You cannot model what you cannot describe |
| Trust boundaries | Where hostile input enters (see `client-server-trust`) |
| What is valuable, to whom | Ranks everything |
| Who the plausible attackers are | A bored player and a funded actor justify different spend |
| What already exists as defence | Avoids duplicating and reveals gaps |
| Regulatory or contractual duties | Some mitigations are non-negotiable |

## Version constraints

Version-independent as a method. Two version-sensitive inputs: the *dependency
set* (known vulnerabilities are version-specific -- check the versions actually
installed, per the lockfile or manifest) and *platform defaults*, which change
between releases and can silently remove a mitigation you were relying on.

## Workflow

1. **Describe the system as data flows.** Processes, data stores, external
   entities, and the flows between them. Draw the trust boundaries as lines
   flows cross. A one-page diagram beats a document.

2. **List the assets.** What has value: currency, items, accounts, personal
   data, source content, competitive integrity, availability, reputation. Name
   who values each -- that is who will attack or defend it.

3. **Enumerate threats per element**, using a prompt list so you do not only
   think of what you already fear. STRIDE works well:

   | Prompt | Question |
   |---|---|
   | **S**poofing | Can someone claim to be another identity? |
   | **T**ampering | Can data be altered in transit or at rest? |
   | **R**epudiation | Can someone deny an action they took? |
   | **I**nformation disclosure | Can someone read what they should not? |
   | **D**enial of service | Can someone make it unavailable or unusably slow? |
   | **E**levation of privilege | Can someone do something they are not entitled to? |

   Apply it to each flow that crosses a trust boundary. Write threats as
   sentences with an actor and an outcome: "a player forges a purchase-complete
   message and receives an item without paying" -- not "purchases".

4. **Rank by realistic risk.** Impact if it happens, multiplied by how easy it
   is. Rank honestly: a trivially exploitable currency duplication outranks a
   theoretical timing attack requiring privileged network position.

5. **Decide a response per threat**, and record it: *mitigate* (build the
   defence), *eliminate* (remove the feature or the data), *transfer* (delegate
   to a provider whose job it is), or *accept* (with a written reason and an
   owner). Accepting is legitimate. Accepting silently is not.

6. **Specify each mitigation concretely** -- which check, in which component,
   verified how. "Validate input" is not a mitigation; "server recomputes price
   from the catalogue and ignores the client-supplied amount" is.

7. **Verify.** Each mitigation gets a test or an audit step. An unverified
   mitigation is an assumption.

8. **Revisit on change.** New feature, new integration, new dependency, changed
   trust boundary: revisit the affected part.

## Best practices

- **Model the system you have**, not the one in the design document. Where they
  differ, that gap is itself a finding.
- **Follow the value.** Attackers do; a model that ignores what is worth
  stealing is theatre.
- **Include abuse by legitimate users**, not just outside attackers. Most
  economy exploitation is by ordinary players who found something.
- **Prefer structural elimination to detection.** Data you do not store cannot
  leak; authority the client never holds cannot be abused.
- **Write threats as scenarios.** Specific enough to test.
- **Keep it one page and current.** A thorough model nobody updates is worse
  than a modest one that is maintained.
- **Record accepted risks with an owner and a date.** That is what makes
  acceptance a decision rather than an oversight.

## Common mistakes

- **Generic checklists instead of analysis.** They miss the threat specific to
  your design, which is the one that will be used.
- **Modelling only outsiders.** Insiders, compromised accounts and ordinary
  users abusing a mechanic are the common cases.
- **Ranking by novelty.** The interesting attack is rarely the likely one.
- **Stopping at the list.** A threat list with no decisions changes nothing.
- **Vague mitigations.** Unimplementable and unverifiable.
- **Ignoring availability and integrity** because attention defaults to
  confidentiality. In games, integrity is usually the asset.
- **Treating the model as one-time.** Systems change; the model must too.
- **Confusing compliance with security.** Passing an audit is not the same as
  being hard to attack.

## Validation

The model is usable when:

- A data-flow diagram exists with trust boundaries marked.
- Assets are listed with their value and who values them.
- Every flow crossing a boundary has been run through the prompt list.
- Threats are written as actor-plus-outcome scenarios.
- Each threat has a ranked risk and a recorded decision.
- Each mitigation names a component, a check, and a verification.
- Accepted risks have a stated reason, an owner, and a date.

Then test it: pick the three highest-ranked threats and try to carry them out
against the running system. If a mitigation cannot be shown to stop its threat,
it does not count as done.

```
Threat  : <actor> can <action> resulting in <impact>
Boundary: <which trust boundary it crosses>
Risk    : impact <H/M/L> x ease <H/M/L>
Decision: mitigate | eliminate | transfer | accept (reason, owner, date)
Mitigation: <component> <check> 
Verified by: <test or audit step>
```

## References

- Related core skills: `client-server-trust`, `secure-coding`,
  `code-review-method`, `software-architecture`
- Platform applications: `roblox-security`, `web-security`
