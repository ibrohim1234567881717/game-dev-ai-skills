---
name: software-architecture
description: Designing system structure - module boundaries, dependency direction, layering, and the decisions that are expensive to reverse later. Use before implementing a feature that spans more than one system, when a codebase has become hard to change, when deciding where new code belongs, or when reviewing a design. Covers coupling and cohesion, dependency inversion, choosing what to make extensible, and recording decisions.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: programming
  uad-version: "1.0.0"
  uad-tags: "architecture, design, modularity, coupling, dependencies, boundaries, scalability, maintainability"
  uad-maturity: stable
---

# Software Architecture

## Purpose

Architecture is the set of decisions that are expensive to change once code
depends on them: where the boundaries are, which direction dependencies point,
what is allowed to know about what. Everything else is implementation and can be
rewritten cheaply.

The goal is not elegance. It is to keep the cost of the *next* change roughly
constant instead of growing with the size of the system.

## When to use

- Before implementing anything that touches more than one system.
- When deciding where a new piece of code belongs.
- When a codebase has become slow to change, or a small change requires edits in
  many unrelated places.
- When reviewing a design proposal.
- Before adding a dependency between two subsystems that were previously independent.
- When a system needs to support variation (platforms, content types, rules) that
  it currently hard-codes.

## When NOT to use

- Prototyping to answer a question. Prototype code should be structured to be
  *deleted*, not extended. Applying architecture to a throwaway is waste.
- Fixing a defect. Use `root-cause-debugging`; do not redesign under a bug fix.
- Reorganising code that is not causing pain. Restructuring has cost and risk;
  "it feels untidy" does not pay for it.
- Performance work. Use `performance-profiling-method`.

## Required context

| Fact | Why it matters |
|---|---|
| What the system must do now | Architecture serves requirements, not aesthetics |
| What is likely to change | Boundaries belong on the axes of change |
| What is fixed | Do not build flexibility for what will never vary |
| Team size and shape | Boundaries are also coordination boundaries |
| Existing structure and its conventions | New code that fights the codebase costs more than it saves |
| The actual pain being solved | Without it there is no way to judge a design |

The most valuable question is the second: **what is likely to change?** Put
boundaries there. A system that hard-codes what varies and abstracts what does
not is worse than one with no abstraction at all.

## Version constraints

Version-independent. The vocabulary differs per platform -- modules, assemblies,
packages, plugins, autoloads, services -- but the underlying question does not:
what may depend on what. Where a platform enforces boundaries mechanically
(assembly definitions, module dependency lists, package boundaries), use that
mechanism: a boundary a compiler enforces is real, and one that exists only in a
document is a suggestion.

## Workflow

1. **State the problem and the forces.** What must be true, what may change,
   what constraints exist. A design cannot be evaluated without them.

2. **Identify the things that change independently.** These are your candidate
   boundaries. Two pieces of code that always change together belong together;
   code that changes for different reasons belongs apart.

3. **Define modules by responsibility**, and write each one's responsibility in
   one sentence. If the sentence needs "and", it is probably two modules.

4. **Decide dependency direction, and make it acyclic.** Depend on the stable,
   not the volatile. Where a stable module needs behaviour from a volatile one,
   invert: the stable module declares the interface, the volatile one implements
   it. Cycles are the single strongest predictor of a codebase that resists change.

5. **Choose the narrowest interface that does the job.** Interfaces are
   promises. Every exposed member is a future constraint.

6. **Decide what is data and what is code.** Content, tuning and rules that
   change often belong in data, edited without a rebuild. Deciding this late is
   expensive.

7. **Check the change scenarios.** Take three plausible future changes and trace
   what each would touch. If a likely change touches many modules, the boundary
   is in the wrong place.

8. **Write down the decision and why**, including what was rejected. Six months
   later the reasoning is what is missing, not the diagram.

9. **Make the boundary enforceable.** Use the platform's mechanism so violations
   fail the build rather than being noticed in review, or not.

## Best practices

- **Depend on abstractions at boundaries that will vary; use concrete types
  everywhere else.** Blanket interface-per-class adds indirection without
  buying anything.
- **Keep the dependency graph acyclic and shallow.** Cycles make everything
  untestable and unbuildable in isolation.
- **Push policy up, mechanism down.** Low-level modules should not know the
  rules; high-level ones should not know the plumbing.
- **Make illegal states unrepresentable** where the type system allows it.
  Structure beats runtime checking.
- **Prefer composition to inheritance**, particularly in game code where deep
  hierarchies calcify quickly.
- **Isolate third-party and platform APIs behind your own thin interface** at
  the points you will need to swap or test them -- not everywhere.
- **Design for deletion.** A feature that can be removed cleanly was well bounded.
- **Choose boring, reversible options** when uncertain, and record what would
  change your mind.

## Common mistakes

- **Speculative generality.** Building extensibility for variation that never
  arrives. It costs indirection now and is usually the wrong shape when the real
  requirement appears.
- **Abstracting the wrong axis.** An interface over what is stable, while what
  actually varies is hard-coded.
- **Layering everything.** Ceremony that adds hops without adding boundaries.
- **Circular dependencies introduced "temporarily".** They are never removed.
- **God objects.** A GameManager that knows everything is not architecture; it is
  the absence of it.
- **Singletons as the default communication mechanism.** Global mutable state
  makes dependencies invisible and testing impossible.
- **Designing for a scale that will not happen**, at the cost of the system that
  has to work now.
- **Undocumented decisions.** The next person cannot tell a deliberate choice
  from an accident, so they treat both as accidents.
- **Refactoring architecture during a bug fix or a deadline.** Two risky changes
  entangled; neither reviewable.

## Validation

A design is sound when these can be answered concretely:

- Each module's responsibility fits in one sentence without "and".
- The dependency graph is acyclic — check it, do not assume it.
- Three plausible future changes each touch a small, predictable set of modules.
- Each module can be tested without instantiating the whole system.
- A new team member can be told where a given piece of code belongs, by rule.
- Every abstraction has at least one real, existing reason to exist.
- The decision and its rejected alternatives are written down.

Practical checks: run a dependency-cycle detector over the module graph; try to
write a unit test for one module in isolation, and treat difficulty as a design
signal rather than a testing problem.

## References

- [Architecture decision record template](references/ADR-TEMPLATE.md)
- Related core skills: `api-design`, `dependency-analysis`, `refactoring-safely`,
  `game-architecture`, `code-review-method`
