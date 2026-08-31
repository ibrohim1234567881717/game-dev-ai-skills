# Architecture decision record

One file per decision, numbered, in `docs/decisions/`. Written when the decision
is made, never edited afterwards -- a decision that changes gets a new record
that supersedes the old one. The value is the reasoning, not the conclusion.

```markdown
# ADR-0007: Inventory items are data assets, not subclasses

- Status   : accepted            (proposed | accepted | superseded by ADR-00XX)
- Date     : 2026-03-14
- Deciders : <names or roles>

## Context

<The forces. What must be true, what is likely to change, what constrains the
choice. Include the concrete pain if there is one. Someone reading this in a
year should understand the situation without asking anyone.>

## Decision

<The decision, stated in the active voice. One paragraph.>

## Alternatives considered

### <Alternative A>
- Why it was attractive :
- Why it was rejected :

### <Alternative B>
- Why it was attractive :
- Why it was rejected :

## Consequences

### Accepted costs
<What becomes harder. Be honest; a record with no downsides was not a decision.>

### Benefits
<What becomes easier.>

### What would change this decision
<The observation that should make a future reader reopen it.>
```

## When a decision deserves a record

Write one when the decision is **expensive to reverse** and **not obvious from
the code**:

- Module boundaries and dependency direction
- Data format, schema, or serialisation strategy
- Choosing a framework, engine feature, or third-party dependency
- Where authority lives across a trust boundary
- Concurrency and threading model
- Anything the team argued about for more than an hour
- Anything a future reader would otherwise assume was an accident

Do not write one for naming, formatting, or anything a linter enforces.

## Why the rejected alternatives matter most

The common failure is a record that states only what was chosen. Six months
later someone proposes the alternative that was already rejected, and nobody
remembers why. Recording *what was considered and why it lost* is what stops
the same discussion recurring — and it is what lets a future reader recognise
when the reason has expired and the decision genuinely should be revisited.
