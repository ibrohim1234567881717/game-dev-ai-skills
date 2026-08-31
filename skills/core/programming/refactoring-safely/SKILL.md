---
name: refactoring-safely
description: Changing code structure without changing behaviour - establishing a safety net first, making small reversible steps, and verifying equivalence at each one. Use when code is hard to change or test, before adding a feature to a tangled area, or when cleaning up after a fix. Distinguishes refactoring from rewriting and from behaviour change, which need different handling.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "testing-strategy"
  uad-tags: "refactoring, cleanup, technical debt, restructure, rewrite, safety net, behaviour preserving"
  uad-maturity: stable
---

# Refactoring Safely

## Purpose

Refactoring means changing structure while behaviour stays identical. The word
is routinely used for two other things — rewriting, and changing behaviour while
tidying — and conflating them is how refactoring earns its reputation for
breaking things.

The discipline is simple and non-negotiable: **have a way to detect behaviour
change before you start, then make small steps that each preserve it.**

## When to use

- Code is hard to understand, test, or extend, and you are about to work in it.
- Before adding a feature to a tangled area — restructure first, then add, as
  two separate changes.
- After a bug fix, to remove the conditions that allowed the bug.
- Duplication has reached the point where changes must be made in several places.
- A module cannot be tested without instantiating the whole system.

## When NOT to use

- There is no safety net and you cannot build one. Add characterisation tests
  first, or do not refactor.
- Under deadline pressure alongside a behaviour change. Entangling them makes
  both unreviewable, and it is how "the refactor broke it" happens.
- The code is untidy but stable and nobody needs to change it. Restructuring has
  cost and risk; aesthetic discomfort does not pay for it.
- The design is wrong at the architectural level. Use `software-architecture`
  first; refactoring within a wrong structure polishes the wrong thing.

## Required context

| Fact | Why it matters |
|---|---|
| The concrete pain being solved | Without it there is no way to know when to stop |
| Existing test coverage of the area | Determines whether you have a safety net |
| Who else is working in these files | Large refactors create merge conflicts, especially with binary assets |
| Whether behaviour is genuinely specified | Sometimes the current behaviour *is* the specification |
| Whether the code is called externally | Public API changes are not refactoring; see `api-design` |

## Version constraints

Version-independent. One practical note: automated refactoring tools vary in
reliability by language and version, and a rename that a tool applies confidently
can miss reflection-based, string-based, or serialised references. In engine
projects this matters especially — renaming a class or field can break scene
files, prefabs and saved data that reference it by name. Check what the engine
serialises before renaming anything it touches.

## Workflow

1. **Name the pain.** "I cannot test this", "the same change must be made in
   four places", "adding a case requires editing five files". A refactor without
   a stated problem has no definition of done and will not stop.

2. **Establish the safety net before changing anything.**
   - If tests exist and cover the behaviour, run them and confirm they are green.
   - If they do not, write **characterisation tests**: tests that capture what
     the code currently does, correct or not. They are not testing correctness;
     they are detecting change.
   - If the behaviour cannot be captured in tests, define a manual verification
     procedure and follow it at each step. Slower, but the alternative is
     changing code with no way to know whether you broke it.

3. **Commit the safety net separately**, before the refactor begins.

4. **Make one small transformation at a time.** Extract a function. Rename.
   Inline. Move. Introduce a parameter object. Each step is individually
   reversible and individually verifiable.

5. **Verify after each step.** Run the tests. Green means continue; red means
   revert that step, not debug it — that is the advantage small steps buy.

6. **Commit each verified step.** Frequent commits make it possible to bisect
   which transformation broke something, and to abandon the tail of a refactor
   without losing the head.

7. **Never mix behaviour changes in.** If you notice a bug while refactoring,
   write it down and fix it in a separate commit, before or after. A diff that
   both moves code and changes it cannot be reviewed.

8. **Stop when the stated pain is gone.** Not when the code is perfect.

## Best practices

- **Separate refactoring commits from behaviour commits**, always. The reviewer
  needs to be able to trust that a refactoring diff changes nothing.
- **Prefer many small merges** to one large one, particularly in projects with
  binary assets where divergence cannot be reconciled.
- **Use automated tool support where reliable**, but verify what it missed —
  reflection, strings, serialised references, editor bindings.
- **Refactor toward a concrete goal**, such as making a specific test possible.
- **Leave the code better in the area you are working**, rather than scheduling
  a project-wide cleanup that never happens.
- **Check what the engine serialises** before renaming anything referenced from
  scenes, prefabs, or saved data.
- **Communicate large refactors.** Files being restructured under someone else
  are a source of avoidable conflict.

## Common mistakes

- **Refactoring without tests.** The most common way to break working software.
- **Mixing behaviour change into a refactor.** Unreviewable; blame lands on the
  refactor.
- **Large steps.** When something breaks, the cause is somewhere in a thousand
  lines.
- **Calling a rewrite a refactor.** A rewrite discards the accumulated fixes
  encoded in the old code and reintroduces bugs that were solved years ago.
  If you are rewriting, say so and plan for it.
- **Refactoring code nobody needs to change.** Cost and risk with no return.
- **Not committing intermediate steps.** No bisection, no partial retreat.
- **Renaming serialised names in an engine project** without checking scene,
  prefab and save references. Silent data loss.
- **Not stopping.** Refactoring can absorb unlimited time; the stated pain is
  the stop condition.
- **Refactoring a shared file during a release.**

## Validation

- The tests that existed before are green after, unchanged. **If a test had to
  change, the behaviour changed, and it was not a refactor.**
- The stated pain is measurably gone — the thing you could not test is now
  tested, the change that needed four edits now needs one.
- The diff contains no behaviour change; a reviewer can confirm this by reading it.
- Each commit in the sequence builds and passes on its own.
- In engine projects, scenes, prefabs and saved data still load, and existing
  save files from before the change still work.
- Performance is unchanged, or the change is measured and accepted.

## References

- Related core skills: `testing-strategy`, `software-architecture`,
  `code-review-method`, `api-design`, `root-cause-debugging`
