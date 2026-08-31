---
name: release-check
description: Verify a build is actually ready to ship - it builds clean from a fresh clone, tests pass, budgets are met, saved data migrates, security findings are closed, and rollback is possible. Use before tagging a release or submitting to a platform. Produces a go or no-go decision with evidence, not an impression.
metadata:
  uad-workflow: release-check
  uad-version: "1.0.0"
  uad-skills: "release-management, testing-strategy, bug-triage, threat-modeling, performance-profiling-method"
---

# /release-check

```
FRESH BUILD -> TESTS -> BUDGETS -> DATA MIGRATION -> SECURITY -> PLATFORM -> ROLLBACK -> DECIDE
```

Every item below is verified by **running something and reading the output**.
"Should be fine" is not a check, and a release checklist filled in from memory
is worse than none because it manufactures confidence.

## Steps

### 1. Build from a fresh clone

Not from your working directory. Clone to a clean location, follow the
documented setup, and build. This catches the uncommitted file, the missing
dependency, and the undocumented step — the three things that break a release
for everyone except the person who prepared it.

Build in the **shipping configuration**, for every target platform.

### 2. Run the tests

Full suite, in CI, on the release commit. Paste the output. Any failure is a
no-go until triaged and explicitly accepted with a reason.

### 3. Check the budgets

On target hardware, in the shipping build:

- Frame time in the worst realistic case, not the average, against the budget.
- Memory and VRAM against the platform's limit.
- Load times.
- Package size against any platform ceiling.

Numbers, with conditions. See `performance-profiling-method`.

### 4. Verify data migration

**The check that most often reveals a release-blocking defect.** Take saved data
produced by the *previous released version* and load it in this build. It must
work, or a migration must exist and be verified.

Players losing progress is the failure with the least forgiveness and no
workaround.

### 5. Close out security

Run `/security-review` if anything touching the trust boundary, accounts,
payments or persistence changed. Every critical and high finding must be closed
or explicitly accepted, with an owner and a date.

Check that no secret is in the build, and no debug endpoint, verbose logging, or
default credential survived.

### 6. Check the bug queue

No open critical defects. Every high-severity one either fixed and **verified on
this build**, or explicitly deferred with a reason. Fixed-but-unverified is not
fixed. See `bug-triage`.

### 7. Platform requirements

Where applicable: certification requirements, required accessibility options,
age rating, licences of shipped dependencies, and required legal notices.

### 8. Confirm rollback is possible

If this release is bad, what happens? A tagged previous release that still
builds, a documented rollback procedure, and — where server state or saved data
format changed — a plan for data written by the new version.

A release you cannot roll back is a bet, not a release.

### 9. Decide

## Report

```
Release      : version / tag / commit
Fresh build  : platforms built, result
Tests        : command, pass/fail, output attached
Budgets      : frame time / memory / size, measured vs target, on which hardware
Migration    : previous-version save loaded successfully: yes / no
Security     : findings open by severity; accepted ones with owner and date
Bugs         : open critical / high, each with a decision
Platform     : requirements met
Rollback     : procedure, and whether it was tested
DECISION     : GO / NO-GO
Known issues : shipping with these, deliberately
```

## Done means

- [ ] A fresh clone builds in the shipping configuration on every target.
- [ ] The full test suite ran on the release commit, with output shown.
- [ ] Every budget measured on target hardware, not asserted.
- [ ] Saved data from the previous released version loads.
- [ ] No open critical security finding or defect.
- [ ] Rollback procedure exists and has been tested at least once.
- [ ] The decision is recorded with its evidence, and known issues are listed
      deliberately rather than discovered later.

A NO-GO with clear reasons is a successful outcome of this workflow. Shipping on
an unverified checklist is not.
