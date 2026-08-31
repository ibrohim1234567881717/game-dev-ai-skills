---
name: release-management
description: Getting a build from the repository to players safely - versioning, release branches, build reproducibility, staged rollout, rollback, and the checks that must pass before shipping. Use when preparing a release, setting up a release process, when a bad build reached players, or when nobody can reproduce which commit a shipped build came from.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: production
  uad-version: "1.0.0"
  uad-requires: "testing-strategy, version-control-workflow"
  uad-tags: "release, versioning, rollback, staged rollout, reproducible build, hotfix, changelog, shipping"
  uad-maturity: stable
---

# Release Management

## Purpose

A release process exists to answer three questions under pressure: *what exactly
is in this build*, *how do we know it works*, and *what do we do when it does
not*. Teams without answers discover them during an incident, which is the worst
possible time.

## When to use

- Preparing a release, patch or hotfix.
- Setting up a release process for a project.
- A bad build reached players and the response was slower than it should have been.
- Nobody can say which commit a shipped build came from.
- Deciding whether to ship with known issues.

## When NOT to use

- Verifying a specific build's readiness. Use the `/release-check` workflow,
  which is the checklist; this skill is the process around it.
- Build automation mechanics. Use `ci-cd-pipelines`.
- Deciding which bugs block. Use `bug-triage`.

## Required context

| Fact | Why it matters |
|---|---|
| Distribution channel | A store submission, a server deploy and a patch have different constraints |
| Whether rollback is possible at all | Store releases often cannot be withdrawn quickly |
| Whether the release changes saved data or server state | Determines whether rollback is even meaningful |
| Certification or review requirements | Adds days or weeks of lead time |
| Player-facing impact of a bad build | Sets how much verification is warranted |

## Version constraints

Version-independent as process. Platform-specific: store submission rules,
certification requirements and rollback capabilities change, and they differ per
platform. Confirm the current requirements before planning a schedule around
them — a rejected submission usually costs a release window.

## Workflow

1. **Version deliberately and visibly.** Pick a scheme and apply it
   consistently. The build must be able to state its own version and the commit
   it came from, visible in-game or in logs. Without this, a crash report from
   a player cannot be matched to source, and the whole investigation stalls.

2. **Cut a release branch or tag** and stabilise there. Only fixes go in;
   features continue on the main line. This is what keeps a release from
   sliding indefinitely as new work lands.

3. **Make the build reproducible.** Same commit, same toolchain, same
   dependencies (lockfile committed), same result. A build that only works on
   one machine is a build you cannot rebuild during an incident.

4. **Run the release checks.** Use `/release-check`: fresh clone, shipping
   configuration, full test suite, budgets measured on target hardware, saved
   data from the previous release loads, security findings closed. Every item
   verified by running something.

5. **Write the changelog as you go**, not from the commit log at the end.
   Player-facing changes in player-facing language; known issues listed
   deliberately.

6. **Stage the rollout where the channel allows it.** A percentage rollout, a
   beta branch, or an internal ring first. Most bad releases are detectable in
   the first small cohort, and catching one there is the difference between an
   incident and a footnote.

7. **Watch after shipping.** Crash rate, error rate, key gameplay or business
   metrics, and player reports. Decide the thresholds that trigger a rollback
   *before* you ship, because deciding under pressure produces bad decisions.

8. **Be able to roll back.** The previous release still builds, the procedure is
   written down, and it has been tested at least once. Where the new version
   writes data the old one cannot read, rollback is not sufficient on its own
   and you need a forward-fix plan instead — know which situation you are in
   before shipping.

9. **Hold a short post-release review** when something went wrong: what
   happened, what the process missed, what check would have caught it. Add the
   check.

## Best practices

- **Ship smaller, more often.** Small releases are easier to verify, easier to
  diagnose, and easier to roll back. Large infrequent releases concentrate risk.
- **Never ship an unreproducible build.** If it cannot be rebuilt from a commit,
  it cannot be debugged or patched.
- **Automate the release path** so that shipping is not a sequence of manual
  steps someone remembers. Manual steps get skipped under time pressure.
- **List known issues deliberately.** Shipping with known defects is a decision;
  discovering them afterwards is a failure.
- **Decide rollback thresholds before shipping.**
- **Treat the previous release as a supported artifact**, not history.
- **Keep a release checklist with evidence**, not ticks — the number that was
  measured, the output that was seen.
- **Do not ship on a Friday** unless someone is available to respond, and say so
  as a policy rather than as folklore.

## Common mistakes

- **Shipping a build nobody can rebuild.** Every subsequent problem becomes
  harder.
- **No version and commit visible in the build.** Crash reports cannot be
  matched to source.
- **Skipping the fresh-clone build.** The most common cause of "it built for me"
  releases that fail for everyone else.
- **Not testing migration from the previous version's saved data.** The release
  blocker that is discovered by players.
- **No staged rollout when the channel supports one.** Full exposure to a defect
  that a small cohort would have revealed.
- **No rollback plan**, or one that has never been tested.
- **Rolling back after a data-format change** without realising the old version
  cannot read the new data.
- **Changelog written from commit messages at the last minute.** Neither
  accurate nor useful to players.
- **Features merged into a release branch** while it stabilises.
- **Treating certification lead time as optional.**

## Validation

- The build reports its version and source commit, and that commit exists.
- A fresh clone of the release tag builds in the shipping configuration on every
  target platform.
- The full `/release-check` list is complete, with measured evidence rather than
  ticks.
- Saved data from the previous released version loads in this build.
- The changelog matches what actually changed, and known issues are listed.
- The rollback procedure is documented and has been executed at least once, in a
  drill if not in anger.
- Post-release monitoring is in place with thresholds decided in advance.
- Where the data format changed, the forward-fix plan is written down.

## References

- Workflow: `/release-check`
- Related core skills: `ci-cd-pipelines`, `testing-strategy`, `bug-triage`,
  `version-control-workflow`
