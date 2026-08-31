---
name: root-cause-debugging
description: Evidence-driven debugging that finds the actual cause of a defect instead of changing code until symptoms disappear. Use when something crashes, throws, returns wrong results, behaves inconsistently, works on one machine but not another, or fails intermittently. Also use to review a proposed fix that has no stated cause.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: programming
  uad-version: "1.0.0"
  uad-tags: "debugging, bug, crash, root cause, reproduce, regression, investigation"
  uad-maturity: stable
---

# Root Cause Debugging

## Purpose

The failure mode this skill exists to prevent is *symptom suppression*: adding a
null check where the crash happens, wrapping the call in try/catch, adding a
frame of delay, reordering initialisation until it works. The symptom goes away,
the cause remains, and the bug returns later wearing a different mask -- usually
in a build that ships.

This skill enforces a rule: **no fix without a stated cause.** The cause must
explain every observed symptom, including the ones that seem incidental.

## When to use

- Any crash, exception, assertion, hang, or corrupted state.
- Wrong output, wrong values, wrong visuals, wrong ordering.
- "It works on my machine", or works in the editor but not in a build.
- Intermittent or timing-dependent failures.
- A regression: something that used to work.
- Reviewing a fix whose description does not name a cause.

## When NOT to use

- The behaviour is correct but too slow. Use `performance-profiling-method`.
- The code is correct but badly structured. Use `refactoring-safely`.
- The requirement itself is wrong or ambiguous. That is a specification problem;
  resolve what the behaviour *should* be before debugging what it *is*.
- You are hunting for defects that have not been reported. Use `code-review-method`.

## Required context

| Fact | Why it matters | Where to find it |
|---|---|---|
| Exact symptom | "Broken" is not a symptom | Reporter, screenshot, video |
| Exact error text and stack trace | Names the failing frame | Logs, console, crash dump |
| Reproduction steps | Without these you cannot verify a fix | Reporter; derive if absent |
| Frequency | Always / sometimes / once | Reporter, telemetry |
| Environment | Platform, build config, version, hardware | Build metadata |
| Last known good | Converts a search of all code into a search of a diff | Version control, release notes |
| Recent changes | Regressions have a first bad commit | `git log`, `git bisect` |

If the defect is a regression and version control is available, the last known
good version is the highest-value fact in this table. It usually turns an
open-ended investigation into reading one diff.

## Version constraints

The method is version-independent. What is version-dependent is the *behaviour
you are debugging*: an API that changed semantics between versions is a frequent
root cause, and one that is easy to miss because the code still compiles.

Before concluding that code is wrong, confirm which version of the engine,
runtime, framework or loader the project actually targets, and whether the API
in question behaved differently in an earlier one. "This worked before the
upgrade" is a strong signal for exactly this class of cause.

## Workflow

1. **Reproduce it.** Deterministically if possible. An unreproducible bug cannot
   be verified as fixed -- you will only ever know that it stopped happening
   while you were watching. If it is intermittent, find the conditions that
   raise the rate: load, timing, ordering, concurrency, cold cache, specific
   data. Reproduction is not a formality; it is the instrument.

2. **Collect evidence before forming theories.** Read the *whole* stack trace,
   not the top frame. Read the log lines before the failure, which usually
   matter more than the failure line. Record actual values, not assumed ones.

3. **State the symptom precisely.** "Save file loads with the player at the
   origin instead of the saved position, every time, only on the console build"
   is a specification for the investigation. "Saves are broken" is not.

4. **Bisect the search space.** Narrow along whichever axis is cheapest:
   - *Time*: `git bisect` between last known good and first known bad.
   - *Data*: which inputs trigger it, which do not.
   - *Code path*: verify the value at points between the source and the failure
     to find where correct becomes incorrect.
   - *Environment*: what differs between the machine that works and the one that does not.
   Each bisection should roughly halve the space. If it does not, pick a
   different axis.

5. **Find where the invariant first breaks.** The crash site is usually the
   victim, not the culprit. Walk backwards: the null was dereferenced here, but
   where was it *supposed* to be assigned, and why was that skipped? Keep going
   until you reach the first point where reality diverges from intent.

6. **State the cause as a testable claim.** "`OnLoad` runs before `Awake` on
   objects instantiated during scene load, so `_config` is still null when
   `ApplyPosition` reads it." A cause you cannot test is a guess.

7. **Prove it.** Make the bug appear and disappear on demand by manipulating the
   claimed cause. If you cannot, the claim is wrong. This step is what separates
   a diagnosis from a story that fits the evidence.

8. **Fix the cause, at the right level.** Ask whether the same cause can produce
   other symptoms elsewhere; if so, fix it where it is general rather than
   patching this one call site.

9. **Add a regression test** that fails before the fix and passes after. If the
   bug was worth finding, it is worth keeping found.

10. **Check for siblings.** The same mistake is usually made more than once.
    Search the codebase for the pattern that caused it.

## Best practices

- **Read the entire error.** Stack traces, inner exceptions, and the lines
  before the failure carry most of the information and are routinely skimmed.
- **Prefer observation to inference.** Print or breakpoint the actual value.
  Assumptions about what a variable contains are how bugs are made.
- **Change one thing at a time while investigating**, for the same reason as in
  profiling: attribution.
- **Keep a written log** on anything that takes more than a few minutes: what
  you tried, what you observed, what it ruled out. It prevents re-testing the
  same hypothesis and is the handover if someone else picks it up.
- **Trust the machine over the documentation.** Observed behaviour wins.
- **Treat "impossible" as a signal.** When something cannot happen but did, an
  assumption is wrong -- and locating that assumption is the fastest route to
  the cause.
- **Revert before layering.** If several speculative changes are in flight,
  revert to a known state before continuing; debugging on top of unexplained
  edits multiplies the search space.

## Common mistakes

- **Fixing the crash site.** A null check where it crashed hides the fact that
  something failed to initialise. The data is still wrong; now it is silently wrong.
- **Swallowing the exception.** `catch {}` converts a loud bug into a quiet one.
- **Shotgun debugging.** Changing plausible-looking things and re-running. It
  occasionally works, teaches nothing, and leaves unexplained changes behind.
- **Stopping at the first plausible explanation.** Plausible is not proven.
  Verify by making the bug come and go.
- **Ignoring the parts that "don't matter".** A cause must explain every symptom.
  The leftover detail is usually the actual mechanism.
- **Not reproducing before fixing.** You cannot verify a fix for a bug you
  cannot trigger.
- **Blaming the platform, compiler or engine first.** It is occasionally right
  and usually wrong; exhaust your own code first, and if you do conclude it is
  upstream, prove it with a minimal reproduction.
- **Fixing without a regression test.** The bug is now free to come back
  unnoticed.

## Validation

A defect is genuinely resolved when:

- The root cause is stated in one or two sentences and explains **all** observed
  symptoms.
- The original reproduction steps no longer produce the failure.
- A test exists that fails on the pre-fix code and passes on the post-fix code.
- Nothing was added that merely suppresses the symptom (no defensive null check,
  swallowed exception, or timing delay standing in for a fix).
- The surrounding test suite still passes.
- The codebase has been searched for the same mistake elsewhere.

Fill this in; if the cause line is empty, the work is not finished:

```
Symptom      : <precise, with conditions>
Reproduction : <steps, and reliability>
Root cause   : <the invariant that broke, and why>
Evidence     : <how the cause was proven>
Fix          : <what changed, and at what level>
Test         : <the regression test>
Siblings     : <other places checked for the same mistake>
```

## References

- [Investigation log template](references/INVESTIGATION-LOG.md)
- Related core skills: `code-review-method`, `testing-strategy`, `bug-triage`,
  `refactoring-safely`
