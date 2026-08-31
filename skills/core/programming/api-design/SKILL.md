---
name: api-design
description: Designing interfaces others depend on - naming, parameters, error signalling, invariants, and versioning without breaking callers. Use when adding a public function, module, service or plugin interface, when an API is confusing or misused, or when a change would break existing callers. Covers making correct use easy and incorrect use hard.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "software-architecture"
  uad-tags: "api, interface, naming, contracts, errors, versioning, breaking change, deprecation, library"
  uad-maturity: stable
---

# API Design

## Purpose

An API is a promise. Once something depends on it, changing it costs everyone
who depends on it, which is why interface decisions are among the most expensive
to reverse.

The measure of a good API is not elegance. It is that the obvious way to use it
is the correct way, and that misuse is difficult or impossible.

## When to use

- Adding a public function, class, module, service endpoint, or plugin interface.
- Designing a boundary between subsystems or between teams.
- An existing API is consistently misused — which is an API problem, not a user
  problem.
- A change would break existing callers and needs a migration path.
- Designing data that content authors or modders will write against.

## When NOT to use

- Internal code with one caller that you control. Design it directly; an
  interface for a single implementation is usually overhead.
- Deciding module boundaries themselves. Use `software-architecture` — that
  decides *where* the boundary goes; this decides *what it looks like*.
- HTTP-specific concerns. Use `web-rest-api-design`.

## Required context

| Fact | Why it matters |
|---|---|
| Who the callers are, and their expertise | An API for your team differs from one for modders |
| Whether it is public or internal | Determines how expensive a change will be |
| Existing conventions in the codebase | Consistency beats individual perfection |
| Whether callers can be updated in lockstep | Decides whether breaking changes are affordable |
| The language's idioms | An API that fights its language is unpleasant to use |

## Version constraints

Version-independent in principle. The mechanisms for evolving an API without
breaking callers — deprecation attributes, default parameters, optional fields,
overloads — are language- and platform-specific. Where the platform has a
supported deprecation mechanism, use it: a compiler warning reaches every caller,
and a changelog entry does not.

## Workflow

1. **Write the calling code first.** Before implementing anything, write the
   code you wish a caller could write. If it reads awkwardly, the API is wrong,
   and you have learned that before building it.

2. **Name for the caller's mental model**, not the implementation. Names are the
   documentation people actually read. Be consistent: if it is `Get` here, it is
   not `Fetch` there.

3. **Make the common case simple and the rare case possible.** Required
   parameters for what is genuinely required; optional configuration for the
   rest. An API where every call needs eight arguments is one where seven have
   an obvious default.

4. **Make illegal states unrepresentable** where the type system allows.
   A dedicated type beats a validated primitive; an enum beats a magic string;
   a constructor that cannot produce an invalid object beats a validate method
   that callers must remember.

5. **Decide error signalling once**, and apply it consistently: exceptions,
   result types, or error codes. Mixed strategies in one API guarantee that some
   failures are ignored. Make failures visible — an error that is easy to ignore
   will be ignored.

6. **State the contract explicitly.** What must be true before the call, what
   will be true after, what is guaranteed about ordering, threading, nullability
   and lifetime. Unstated invariants become the caller's assumptions, and then
   your compatibility obligations.

7. **Keep the surface minimal.** Every exposed member is a promise. It is easy to
   add later and painful to remove. When in doubt, leave it out.

8. **Plan for change.** Additive changes are safe; removals and signature changes
   are not. Deprecate with a compiler-visible marker, keep the old path working
   for a stated period, and document the migration.

## Best practices

- **Consistency over local perfection.** A slightly worse name matching the
  codebase's convention beats a better one that breaks it.
- **Prefer explicit over clever.** APIs are read far more than they are written.
- **Take and return the narrowest useful type.** Accept the general, return the
  specific.
- **Avoid boolean parameters.** `Update(true, false)` is unreadable at the call
  site; use enums or separate methods.
- **Design the failure path with the same care as the success path.**
- **Document with examples.** One correct usage example is worth several
  paragraphs of prose.
- **Version data formats from the first release**, including a version field.
  Retrofitting one onto shipped data is painful.
- **Test the API by using it** in a real scenario before finalising it.

## Common mistakes

- **Designing from the implementation outward.** Produces APIs that leak internal
  structure and cannot be changed.
- **Leaking implementation types** across the boundary, which freezes the
  implementation.
- **Inconsistent naming and error handling** within one API.
- **Boolean and stringly-typed parameters.** Unreadable and unvalidated.
- **Exposing everything "in case someone needs it".** Every member is a promise.
- **Silent failure** — returning null or a default where the caller cannot tell
  something went wrong.
- **Unstated threading or lifetime rules.** Callers guess, and their guesses
  become your compatibility burden.
- **Breaking changes without deprecation.** Everyone finds out at build time.
- **No version field in a persisted or transmitted data format.**
- **Ignoring the language's idioms**, producing something technically fine and
  unpleasant to use.

## Validation

- Sample calling code for the three most common uses reads clearly to someone
  who did not design the API.
- Every parameter and return value has an obvious meaning from its name and type.
- Invalid states are unrepresentable, or validated at construction with a clear
  error.
- Error signalling is consistent throughout, and failures cannot be silently
  ignored.
- Preconditions, postconditions, nullability, threading and lifetime are stated
  in documentation.
- Every public member has a caller; unused ones are removed before release.
- Data formats carry a version field.
- A test exercises the API as a consumer would, not through internals.
- Any breaking change has a deprecation path and a documented migration.

## References

- Related core skills: `software-architecture`, `technical-documentation`,
  `dependency-analysis`, `refactoring-safely`, `code-review-method`
- Platform applications: `web-rest-api-design`
