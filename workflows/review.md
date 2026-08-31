---
name: review
description: Review a change adversarially before it is merged or reported as done - verify the claims, hunt defect classes deliberately, and rank findings. Use on a diff, a pull request, or over work an agent just produced, which reads plausibly whether or not it is correct.
metadata:
  uad-workflow: review
  uad-version: "1.0.0"
  uad-skills: "code-review-method, testing-strategy, secure-coding, client-server-trust"
---

# /review

```
INTENT -> READ -> VERIFY CLAIMS -> CHECK VERSION -> HUNT DEFECTS -> TRACE A PATH -> RANK
```

**A review whose goal is approval finds nothing.** Try to break the change.

## Steps

### 1. Establish intent

What is this supposed to do? If you cannot say it in one sentence, that is
finding one: an unreviewable change.

### 2. Read the whole diff once, without judging

Build a model of what changed before commenting on anything. Reviews that start
at line three miss everything structural.

### 3. Verify every claim

Tests pass, the bug is fixed, performance improved, the API exists — find the
evidence for each. Run the tests yourself. **An unverified claim is a finding.**

### 4. Check the version

```bash
python tools/uad.py detect . --verbose
```

Then check the code against the version the project actually targets. Code
written for the wrong version often compiles and is invisible to a reviewer who
skipped this.

### 5. Hunt these classes deliberately

Do not wait for something to look wrong.

| Class | The question |
|---|---|
| **Absences** | Missing test, caller not updated, migration, error path, empty case |
| Boundaries | Empty, one, maximum, zero, negative, overflow, duplicate |
| Error paths | What on failure? Partial state left behind? |
| Trust | Is external input validated server-side? |
| Lifetime | Use after destroy, leaked handle, listener never removed |
| Concurrency | Shared mutable state, assumed ordering, reentrancy |
| Invariants | What did surrounding code assume that this breaks? |
| Data | Does existing saved data still load? |

The strongest findings are usually absences.

### 6. Trace one realistic path end to end

With concrete values. This finds what pattern-matching misses.

### 7. Check the tests test the change

A test that would pass on the old code is not a test of the new code.

### 8. Rank and report

```
[BLOCKER]  path/to/file.ext:42
  Trigger    : the input or state that causes it
  Consequence: what goes wrong
  Fix        : what would resolve it

[MAJOR] / [MINOR] / [QUESTION]
```

**BLOCKER** — data loss, security hole, crash, silently wrong results, or the
change does not do what it claims. **MAJOR** — a real defect on a reachable
path, or a missing test for significant new behaviour. **MINOR** — genuine but
low impact. **QUESTION** — could not verify; the author must answer.

## Done means

- [ ] Intent stated in one sentence.
- [ ] Every changed file read.
- [ ] Every claim in the description verified or flagged as unverified.
- [ ] The version was checked, and the code matches it.
- [ ] Each defect class considered; non-applicable ones dismissed knowingly.
- [ ] At least one realistic path traced with concrete values.
- [ ] Findings ranked, each with file, trigger and consequence.

Do not report style a linter enforces. Finding nothing is a valid outcome — but
only after this procedure ran, and say what you checked so the conclusion can be
judged. If the diff was too large to review honestly, say so; that is an
important finding, not an excuse.
