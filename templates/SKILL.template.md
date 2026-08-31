---
name: example-skill-name
description: One or two sentences stating what this skill does AND when an agent should reach for it. Include the concrete words a developer would use, because this string is the only thing the agent sees before deciding to load the skill. Max 1024 characters.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: ""
  uad-tags: "keyword, another-keyword"
  uad-maturity: stable
---

# Example Skill Name

<!--
  Copy this file to skills/<layer>/<domain>/<skill-name>/SKILL.md.
  The directory name MUST equal the `name` field: the Agent Skills spec
  requires it, and skills that break the rule silently fail to load.

  Every `## ` heading below is required and validated by `uad validate`.
  Keep the whole file under 500 lines; push depth into references/.
-->

## Purpose

What problem this solves, in two or three sentences. Write for an agent that
has just loaded this file and has no other context about the task.

## When to use

- A concrete trigger, phrased the way the situation actually presents itself.
- Another trigger.
- A third trigger.

## When NOT to use

- The neighbouring case that belongs to a different skill, naming that skill.
- A case where this approach is actively wrong.

## Required context

State what must be known before acting, and how to obtain it from the project
rather than by asking:

- Fact to establish, and the file that answers it.
- Another fact, and where it lives.

## Version constraints

Which versions this guidance holds for, what changed across versions, and what
to verify in the project before relying on any of it. If the guidance is
version-independent, say so explicitly and explain why.

## Workflow

1. **Step name.** What to do and what evidence to collect.
2. **Step name.** The next action, with the decision that gates it.
3. **Step name.** Continue until the task is genuinely done.

## Best practices

- A practice, with the reason it matters.
- Another practice.

## Common mistakes

- **The mistake.** Why it is tempting, what it breaks, and what to do instead.
- **Another mistake.** Same shape.

## Validation

How to confirm the work is correct. Prefer checks that can actually be run:
a command, a profiler reading, a test, an observable behaviour. State what a
passing result looks like.

## References

<!--
  Link bundled files as `[name](references/REFERENCE.md)` — but only once the
  file exists. A broken relative link fails validation.
-->

- Bundled deep-dive: `references/REFERENCE.md`
- Related skills, by name: `some-core-skill`, `another-skill`
- Upstream documentation: https://example.com/docs
