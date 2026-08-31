---
name: fix-bug
description: Diagnose and fix a defect by proving its root cause rather than suppressing the symptom. Use for crashes, wrong behaviour, corrupted state, regressions, and intermittent failures. Ends with a regression test that fails on the unfixed code.
metadata:
  uad-workflow: fix-bug
  uad-version: "1.0.0"
  uad-skills: "root-cause-debugging, testing-strategy, code-review-method"
---

# /fix-bug

```
REPRODUCE -> COLLECT EVIDENCE -> NARROW -> PROVE THE CAUSE -> FIX -> REGRESSION TEST -> REVIEW
```

**No fix without a stated, proven cause.** If you cannot say why it broke, you
do not yet know whether your change fixes it or merely moves it.

## Steps

### 1. Reproduce

Get it to happen, deterministically if possible. Record the exact steps.

If it is intermittent, find what raises the rate — load, ordering, specific
data, cold start, concurrency. If you genuinely cannot reproduce it, say so
before going further: you will not be able to verify any fix.

### 2. Collect evidence

- The **full** stack trace, not the top frame.
- The log lines *before* the failure — usually more informative than the failure.
- Actual observed values, not assumed ones.
- Environment: platform, build configuration, engine or runtime version.
- Last known good version, if it is a regression. This is the highest-value fact
  available, because it converts an open search into reading a diff.

### 3. Detect the version

```bash
python tools/uad.py detect . --verbose
```

An API whose behaviour changed between versions is a frequent root cause, and it
is invisible if you assume the newest. "It broke after the upgrade" points
directly here.

### 4. Narrow the search space

Pick the cheapest axis and halve repeatedly:

- **Time** — `git bisect` between last known good and first known bad.
- **Data** — shrink the failing input to the minimum that still fails.
- **Code path** — check the value at points between where it is set and where it
  is used, to find where correct becomes incorrect.
- **Environment** — diff the working machine against the broken one.

### 5. Prove the cause

Walk backwards from the crash site — usually the victim, not the culprit — to
where the invariant first broke. State the cause as a testable claim, then prove
it by making the bug appear and disappear on demand.

If you cannot make it appear and disappear, the claim is wrong.

### 6. Fix at the right level

Ask whether the same cause produces other symptoms elsewhere. If so, fix the
general mechanism rather than patching this call site.

**Do not** add a null check at the crash site, swallow the exception, or insert
a delay. Those hide the defect and leave the data wrong.

### 7. Regression test

Write a test that **fails on the unfixed code** and passes after. Verify it
fails first — a regression test that passes before the fix tests nothing.

### 8. Check for siblings

Search the codebase for the same mistake made elsewhere. It usually was.

### 9. Review

Independent pass with `reviewer`.

## Done means

- [ ] The root cause is stated in one or two sentences and explains **all**
      observed symptoms, including the incidental ones.
- [ ] The cause was proven, not inferred.
- [ ] The original reproduction no longer fails.
- [ ] A regression test exists and was confirmed to fail before the fix.
- [ ] No symptom-suppressing defensive code was added.
- [ ] The codebase was searched for the same mistake.
- [ ] The surrounding test suite still passes, with output shown.

## Report

```
Symptom      : precise, with conditions
Reproduction : steps, and reliability
Root cause   : the invariant that broke, where, and why
Evidence     : how it was proven
Fix          : what changed, at what level
Test         : the regression test; confirmed failing before the fix
Siblings     : other places checked
```
