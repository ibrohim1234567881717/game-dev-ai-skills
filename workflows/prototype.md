---
name: prototype
description: Answer a design or feasibility question quickly with disposable code. Use when the question is "would this be fun" or "is this possible", not "how should this be built". Optimises for speed of learning and explicitly suspends the quality bar - then requires the result to be thrown away or rewritten.
metadata:
  uad-workflow: prototype
  uad-version: "1.0.0"
  uad-skills: "game-architecture, gameplay-systems"
---

# /prototype

```
QUESTION -> CONSTRAIN -> BUILD THE CHEAPEST THING -> EVALUATE -> DECIDE -> DISCARD OR REBUILD
```

A prototype exists to **answer one question**. It is not an early version of the
real thing, and treating it as one is how prototype code ends up shipped.

## Steps

### 1. State the question

One sentence, answerable: "Does grappling feel good with this movement speed?"
"Can we render 500 units at 60 fps on the target device?" "Will players
understand this UI without a tutorial?"

If you cannot state it, you are not prototyping — you are building, and
`/build-feature` applies instead.

### 2. Decide what a convincing answer looks like

Before writing anything: what result would make you say yes, and what would make
you say no? Deciding this afterwards is how prototypes get talked into
succeeding.

### 3. Set a time budget

Prototypes expand indefinitely without one. State the budget and stop at it,
answer or no answer — "we spent two days and still cannot tell" is itself a
useful result.

### 4. Suspend the quality bar, deliberately and explicitly

For this workflow only, and only in a throwaway location:

- Hard-code values. No data-driven configuration.
- Skip error handling, edge cases and tests.
- Copy-paste rather than abstract.
- Placeholder art, engine primitives, debug text.
- No architecture. Structure it to be **deleted**, not extended.

Applying `software-architecture` to a prototype delays the answer, which is the
only thing the prototype is for.

### 5. Build only what the question needs

If the question is about feel, the enemy can be a cube. If it is about
rendering throughput, gameplay can be absent entirely. Anything not serving the
question is not in the prototype.

### 6. Evaluate against the criteria from step 2

Honestly. Get someone else to try it — you cannot evaluate feel on something you
just built, and you cannot evaluate clarity on something you designed.

### 7. Decide, and record the decision

- **Yes** → the prototype has done its job. Now build it properly with
  `/build-feature`, from scratch. Reusing prototype code is how hard-coded
  values and missing error handling reach production.
- **No** → record what you learned and why it failed. A negative result that is
  written down stops the idea being re-proposed in six months.
- **Unclear** → say what a better experiment would be.

### 8. Discard or quarantine

Delete it, or keep it clearly marked as a prototype, outside the production
code path, excluded from builds. Prototype code that is merely "not called yet"
gets called eventually.

## Done means

- [ ] The question is answered, or explicitly answered as "still unclear".
- [ ] The answer was evaluated against criteria set **before** building.
- [ ] Someone other than the author tried it, where the question is about feel
      or clarity.
- [ ] The decision and the reasoning are written down.
- [ ] The prototype is deleted, or quarantined outside the production path.
- [ ] Nobody is under the impression this code is production-ready.

## The one rule

**Never let prototype code become production code by default.** It has no error
handling, no tests, hard-coded values and no structure — by design. Shipping it
because it works is how projects acquire their worst modules.
