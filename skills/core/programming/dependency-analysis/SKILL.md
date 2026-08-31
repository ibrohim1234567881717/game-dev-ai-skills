---
name: dependency-analysis
description: Understanding and controlling what a codebase depends on - internal module coupling and cycles, and external package risk, versions, and upgrade cost. Use before adding a dependency, when an upgrade breaks things, when build times or binary sizes grow, when modules cannot be built or tested in isolation, and when auditing a project you did not write.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "software-architecture"
  uad-tags: "dependencies, coupling, cycles, packages, upgrade, versions, lockfile, supply chain, build time"
  uad-maturity: stable
---

# Dependency Analysis

## Purpose

Dependencies are the main determinant of how expensive a codebase is to change.
They come in two kinds, and both need attention:

- **Internal**: which module may reference which. Cycles and excessive coupling
  make code untestable, unbuildable in isolation, and resistant to change.
- **External**: third-party packages and plugins. They are code you ship without
  having reviewed, carrying versions, vulnerabilities, licences, and their own
  dependencies.

## When to use

- Before adding any external dependency.
- Orienting in an unfamiliar codebase — the dependency graph is the fastest map.
- When a small change requires edits in many unrelated places.
- When modules cannot be tested without instantiating the world.
- When an upgrade breaks the build, or an upgrade is being avoided out of fear.
- When build times, package sizes, or cook/asset sizes grow unexpectedly.
- During a security review, since vulnerabilities are version-specific.

## When NOT to use

- Designing the boundaries themselves. Use `software-architecture`; this skill
  analyses the graph, that one decides what it should be.
- Runtime performance. Use `performance-profiling-method`.
- Restructuring for its own sake, with no cost being paid.

## Required context

| Fact | Why it matters |
|---|---|
| The module or assembly boundaries | Defines the internal graph's nodes |
| The manifest **and** the lockfile | The manifest states ranges; the lockfile states what is installed |
| Transitive dependencies | Most of the risk is in dependencies you never chose |
| Which parts are engine or platform provided | Those are not free to swap |
| Asset reference graphs, in game projects | A reference can pull hundreds of megabytes into a build |

In game engines, asset references are dependencies too, and they are usually the
ones that cause build bloat. A hard reference from a commonly loaded object to a
large asset drags the entire chain into memory and into the package.

## Version constraints

Version-independent in method. Everything about the *findings* is
version-specific: a vulnerability applies to a version range, a breaking change
belongs to a major, and an API removal happens in a release. Always analyse the
versions actually installed — read the lockfile, not the range in the manifest.
Where no lockfile exists, that is itself a finding: builds are not reproducible.

## Workflow

1. **Build the internal graph.** List modules and their dependencies, using the
   platform's own mechanism where one exists (assembly definitions, module
   dependency lists, package manifests, import analysis).

2. **Find the cycles.** Any cycle is a defect: the modules in it cannot be built,
   tested, understood or reused separately, and they will drift into one module
   with extra ceremony. Break cycles by extracting the shared piece, or by
   inverting the weaker direction behind an interface.

3. **Check direction against stability.** Dependencies should point toward the
   stable. A stable core depending on a volatile feature module means every
   feature change destabilises the core.

4. **Look for hubs.** A module everything depends on is a change-amplifier;
   a module that depends on everything is a god object. Both are worth splitting.

5. **Inventory external dependencies** from the lockfile: name, installed
   version, licence, transitive count, last release date, and what it is used for.

6. **Judge each one against its cost.** Ask: how much of it do we use, what
   would it cost to replace, how many transitive dependencies does it bring, is
   it maintained, and is the licence compatible with shipping. A package used for
   one small function is usually worth inlining.

7. **Audit for known vulnerabilities** with the ecosystem's tool, against the
   lockfile. Triage by whether the vulnerable path is actually reachable in your
   usage rather than by severity alone.

8. **Plan upgrades deliberately.** Read the changelog for breaking changes,
   upgrade one major at a time, run the test suite between steps. Batching an
   upgrade of six packages produces a failure nobody can attribute.

9. **Prune.** Remove what is unused. Every removed dependency removes an entire
   subtree of risk.

## Best practices

- **Prefer the standard library and the engine's own facilities** before adding
  a package.
- **Commit the lockfile.** Without it, two machines build different software.
- **Keep the graph acyclic and enforce it** in CI, so violations fail the build
  rather than accumulating.
- **Isolate volatile third-party APIs behind a thin interface** at the points
  you will need to swap or test them — not everywhere.
- **Upgrade continuously in small steps.** The cost of an upgrade grows
  superlinearly with how long it was deferred.
- **Record why each dependency exists**, so a future reader can tell whether it
  is still needed.
- **Watch the transitive count.** A package with sixty transitive dependencies
  is sixty maintainers you are trusting.
- **In game projects, prefer soft/lazy asset references** for optional content
  so the reference graph does not cascade into memory and package size.

## Common mistakes

- **Adding a large dependency for one function.** All of its risk, almost none
  of its value.
- **Never upgrading.** The project accumulates unpatched vulnerabilities and an
  eventual migration too large to attempt.
- **Upgrading everything at once.** Unattributable failures.
- **Ignoring transitive dependencies.** That is where most vulnerabilities live.
- **Ignoring licences** until legal review before ship, when it is expensive.
- **Tolerating "temporary" cycles.** They become permanent.
- **Analysing the manifest instead of the lockfile.** You audited a range, not
  the software you ship.
- **Hard references to heavy assets** in commonly loaded objects, in game
  projects. Silent memory and package bloat.
- **Deleting a dependency without checking transitive usage**, breaking a
  package that relied on it being present.

## Validation

- The module dependency graph is acyclic; a cycle detector runs in CI and passes.
- Every module can be compiled or tested without the whole system present.
- A lockfile exists and is committed.
- A vulnerability audit against the lockfile is clean, or every remaining
  finding has a written, dated triage decision.
- Every external dependency has a stated reason for existing.
- Licences of all shipped dependencies are compatible with the product.
- No unused dependency remains — verify with the ecosystem's unused-dependency
  check, not by reading.
- In game projects, the asset reference report shows no unexpected heavy chains
  from frequently loaded objects.

## References

- Related core skills: `software-architecture`, `secure-coding`,
  `ci-cd-pipelines`, `refactoring-safely`, `asset-optimization`
