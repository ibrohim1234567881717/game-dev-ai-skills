---
name: bug-triage
description: Turning a stream of reports into a ranked, actionable queue - writing reports that can be acted on, reproducing and confirming, assessing severity by impact rather than annoyance, and deciding what will not be fixed. Use when handling incoming bug reports, preparing a release, or when a backlog has grown unmanageable.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: production
  uad-version: "1.0.0"
  uad-requires: "root-cause-debugging"
  uad-tags: "bug triage, severity, priority, regression, backlog, reproduction, release, defect management"
  uad-maturity: stable
---

# Bug Triage

## Purpose

Triage decides what gets fixed and in what order. Done badly, engineering time
goes to whoever complained most recently, data-loss bugs sit behind cosmetic
ones, and a backlog grows until nobody reads it.

Triage is a decision process, not a labelling exercise. Every report leaves it
with an outcome: fix now, fix later, or will not fix — the last being a
legitimate and necessary decision.

## When to use

- Processing incoming bug reports.
- Preparing a release and deciding what blocks it.
- A backlog has grown to the point where nobody triages it any more.
- Deciding whether a specific report is worth engineering time.
- Setting up a defect process for a team.

## When NOT to use

- Diagnosing a specific defect. Use `root-cause-debugging`. Triage decides
  whether and when to investigate; it does not investigate.
- Verifying a fix. Use `testing-strategy` and the `qa` agent.
- Live incident response. Contain first, triage afterwards.

## Required context

| Fact | Why it matters |
|---|---|
| The report, with reproduction steps | An unreproducible report cannot be fixed or verified |
| Environment: platform, version, build | Determines who is affected |
| Frequency and reach | Distinguishes an edge case from a widespread failure |
| Whether it is a regression | Regressions rank higher: it worked, and shipping it back is worse |
| Whether a workaround exists | Changes urgency, not severity |
| Release stage | The bar for accepting a change rises near release |

## Version constraints

Version-independent as a process. One version-specific rule matters: **always
record the build the report came from**, and confirm whether the defect still
exists on the current build before assigning it. A meaningful fraction of any
backlog is already fixed, and triaging without checking spends time on ghosts.

## Workflow

1. **Make the report actionable, or send it back.** A usable report needs: what
   happened, what was expected, exact steps, environment, and frequency. If it
   lacks reproduction steps, getting them is the first task — nothing downstream
   works without them.

2. **Check for duplicates** before anything else. Link rather than re-triage; a
   duplicate also raises the frequency evidence on the original.

3. **Reproduce, on the current build.** Three outcomes: reproduces (proceed);
   does not reproduce (ask for more detail, or close as unreproducible with a
   note — reopening is cheap); already fixed (close and note the fix).

4. **Assess severity by impact**, independently of who reported it:

   | Severity | Meaning |
   |---|---|
   | **Critical** | Data loss, save corruption, security hole, crash on a common path, progression blocker, or anything involving real money |
   | **High** | Core feature broken or wrong, frequent crash on an uncommon path, significant performance failure |
   | **Medium** | A feature works incorrectly in a specific case, with a workaround |
   | **Low** | Cosmetic, rare, or trivially avoidable |

   Severity is about consequence. It is not about how irritating the reporter
   found it, and not about how interesting the bug is.

5. **Assess reach separately.** All platforms or one, all players or a specific
   configuration, every session or once. Severity times reach gives priority;
   a medium bug affecting everyone usually outranks a high bug affecting a rare
   hardware configuration.

6. **Flag regressions explicitly.** Something that used to work and now does not
   ranks above a defect that was always present, and it usually has a findable
   first bad commit, which makes it cheap to fix.

7. **Decide, and record the decision.** Fix now, fix in a named milestone, or
   will not fix — with a reason. An undecided report is backlog rot.

8. **Re-triage at milestones.** Priorities change as a release approaches, and a
   backlog that is never revisited is not a queue, it is an archive.

## Best practices

- **Reproduction steps are non-negotiable.** Without them nobody can fix or
  verify anything.
- **Rank by impact on the player**, not by who reported it or how loudly.
- **Prioritise data loss above everything.** A player who loses progress
  usually does not come back, and it is the one defect class with no workaround.
- **Treat regressions as more urgent than equivalent long-standing bugs.**
- **Close things deliberately.** "Will not fix" with a stated reason is an
  honest outcome; leaving it open forever is not.
- **Attach evidence** — video, log, save file, crash dump. It saves the
  investigation more time than triage spends collecting it.
- **Track the fix through verification.** Fixed-but-unverified is not fixed.
- **Watch the shape of the backlog.** Many reports in one area point at a design
  or architectural problem, not at a run of unrelated bugs.

## Common mistakes

- **Accepting reports without reproduction steps.** They become permanent
  backlog nobody can act on.
- **Confusing severity with priority.** Severity is consequence; priority is
  what to do next given reach, cost and timing.
- **Triaging by who reported it.**
- **Never closing anything.** The backlog stops being read, which is worse than
  a smaller honest one.
- **Not checking the current build.** Time spent on already-fixed defects.
- **Ignoring frequency.** A rare critical and a constant medium need comparing
  honestly.
- **No verification step**, so fixes that did not work ship as fixed.
- **Treating each report in isolation**, missing that twelve of them share a
  cause.
- **Fixing symptoms because triage was under time pressure.** That is where
  `root-cause-debugging` applies.

## Validation

A triage process is working when:

- Every report has reproduction steps, or an explicit action to obtain them.
- Every triaged report has an owner and a decision, including "will not fix"
  with a reason.
- Severity is assigned by consequence and is consistent across reports — spot
  check by comparing two similar ones triaged weeks apart.
- Regressions are flagged and ranked accordingly.
- No critical severity report is unassigned.
- Fixed reports are verified before closing, on the build that contains the fix.
- The backlog is re-triaged at each milestone rather than accumulating.
- Clusters are noticed: several reports in one area trigger a look at the design.

## References

- Related core skills: `root-cause-debugging`, `testing-strategy`,
  `release-management`, `version-control-workflow`
