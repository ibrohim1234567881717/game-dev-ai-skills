---
name: code-review-method
description: Adversarial review that tries to find real defects in a change rather than confirming it looks fine. Use when reviewing a diff, pull request, or generated code before accepting it, and as the independent final pass over any work an agent produced. Covers what to read first, the defect classes worth hunting, how to rank findings by severity, and how to report them so they can be acted on.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: programming
  uad-version: "1.0.0"
  uad-tags: "review, code review, quality, defects, pull request, verification, correctness"
  uad-maturity: stable
---

# Code Review Method

## Purpose

A review whose goal is approval finds nothing. The reviewer's job is to try to
break the change: to look for the input that makes it wrong, the case it did not
consider, the invariant it quietly violated.

This matters more when reviewing work produced by an AI agent, which reliably
produces code that *reads* correct. Plausibility is exactly what review must not
be fooled by, so the method is built on evidence rather than impression.

## When to use

- Reviewing any diff or pull request before it is merged.
- As the final independent pass over agent-generated code, before reporting it
  as done.
- Before a release, over the accumulated changes.
- When accepting a contribution from outside the team.

## When NOT to use

- Investigating a known failure. Use `root-cause-debugging`.
- Assessing performance. Use `performance-profiling-method`; reading code does
  not establish what is slow.
- Evaluating a design that is not yet code. Use `software-architecture`.
- Style and formatting. That belongs to a linter and a formatter; a human or
  agent spending review attention on it is wasting the scarce resource.

## Required context

| Fact | Why it matters |
|---|---|
| What the change is supposed to do | Correctness is relative to intent |
| The full diff, not a summary | Defects hide in the parts nobody highlighted |
| What is *not* in the diff | Missing test, missing migration, missing call site |
| Whether tests were run, and their output | "Tests pass" without output is a claim |
| The version and platform targeted | Version-inappropriate API use is a real defect class |
| Prior conventions in the touched files | Inconsistency is a maintenance cost |

## Version constraints

Version-independent as a method. One version-specific defect class deserves
explicit attention: **code written against the wrong version of an API.** It
often compiles, and it is invisible to a reviewer who does not check which
version the project targets. For engine and modding work, confirm the target
version (`.uproject`, `ProjectVersion.txt`, `project.godot`,
`gradle.properties`, `package.json` plus lockfile) and check the change against
*that* version, not the newest one.

## Workflow

1. **Establish intent.** Read the description and the linked issue. If you
   cannot state what the change is meant to do in one sentence, that is finding
   number one -- an unreviewable change.

2. **Read the diff completely, once, without judging.** Build a model of what
   changed. Reviews that start commenting on line 3 miss everything structural.

3. **Ask what is missing.** The strongest findings are usually absences: no test
   for the new branch, a caller not updated, an error path not handled, a
   migration for the changed data shape, documentation contradicting the new
   behaviour.

4. **Hunt defect classes deliberately.** Do not wait for something to look
   wrong; go looking:

   | Class | The question to ask |
   |---|---|
   | Boundaries | Empty, single, maximum, zero, negative, null, overflow? |
   | Error paths | What happens when this fails? Is partial state left behind? |
   | Concurrency | Shared mutable state? Assumed ordering? Reentrancy? |
   | Lifetime | Use after free/destroy, leaked handle, dangling reference, listener never removed |
   | Trust | Is external input validated server-side? (`client-server-trust`) |
   | Version | Does this API exist and behave this way in the targeted version? |
   | Invariants | What did the surrounding code assume that this change breaks? |
   | Loops | Termination, off-by-one, mutation during iteration, accidental O(n²) |
   | Data | Migration for existing saved data? Backward compatibility? |

5. **Trace one realistic path end to end**, with concrete values. Following one
   real input through the change finds what pattern-matching misses.

6. **Check the tests test the change.** A test that would pass on the old code
   is not a test of the new code. Look for a test that would fail without the fix.

7. **Verify claims.** If the description says tests pass, look at the output. If
   it says performance improved, look at the measurement. Unverified claims are
   findings.

8. **Rank findings by severity** and report them so each can be acted on
   without a conversation.

## Best practices

- **Try to break it, not to approve it.** The mindset determines the outcome.
- **Prioritise correctness, security, and data loss** over structure, and
  structure over style. Reviewer attention is finite and should follow risk.
- **Be specific: file, line, input, consequence.** "This could be cleaner" is
  not actionable; "with an empty inventory this indexes element 0 and throws" is.
- **Distinguish blocking from optional.** A review that ranks everything equally
  gets everything ignored equally.
- **Say what would convince you.** "Add a test with an empty list" resolves a
  finding; "are you sure?" does not.
- **Review the change, not the author.** Comment on code and consequences.
- **Prefer small diffs**, and say so when one is too large to review honestly --
  claiming to have reviewed 3 000 lines carefully is usually false.
- **Acknowledge what is genuinely good**, briefly. It calibrates the rest.

## Common mistakes

- **Reviewing for plausibility.** Code that reads well is the default output of
  a language model. It proves nothing.
- **Skimming the large or generated parts.** Defects concentrate where attention
  does not.
- **Only reading added lines.** Deletions and unchanged callers matter.
- **Accepting "tests pass" without output.**
- **Nitpicking style while missing a data-loss bug.**
- **Assuming the author checked the version.** They usually did not.
- **Approving because it is urgent.** Deadline pressure is when defects merge.
- **Producing a finding list with no severity.** Unprioritised feedback is noise.
- **Reviewing your own work as if it were someone else's.** It is not the same;
  where possible, have an independent pass — that is why this toolkit runs a
  separate reviewer agent.

## Validation

A review is complete when:

- The change's purpose is stated in one sentence.
- Every changed file was read.
- Each defect class in the table above was considered, and non-applicable ones
  dismissed knowingly.
- At least one realistic execution path was traced with concrete values.
- Missing tests, callers, migrations and documentation were checked for.
- Every claim in the description was verified or flagged as unverified.
- Findings are ranked, each with file, line, trigger, and consequence.

Report findings in this shape:

```
[BLOCKER]  path/to/file.ext:42
  Trigger    : <the input or state that causes it>
  Consequence: <what goes wrong>
  Fix        : <what would resolve it>

[MAJOR]    ...
[MINOR]    ...
[QUESTION] ...
```

Finding nothing is a legitimate outcome — but only after this procedure ran. A
review that finds nothing in a large change without having traced a path or
checked for missing tests has not happened.

## References

- Related core skills: `root-cause-debugging`, `testing-strategy`,
  `secure-coding`, `software-architecture`, `refactoring-safely`
- Agent that applies this skill independently: `reviewer`
