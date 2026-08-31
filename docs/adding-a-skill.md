# Adding a skill

A worked walkthrough. The format contract is in [skill-format.md](skill-format.md);
this is the process.

## Before you write anything

Answer one question: **what does an agent do wrong today that this skill would
fix?**

If the honest answer is "it would have more information", stop. Information is
not the constraint — assistants already know a great deal about Unity. What they
lack is procedure: check the pipeline before writing a shader, profile before
optimising, never trust the client.

Good reasons to write a skill:

- It prevents a specific expensive mistake.
- It encodes version-specific knowledge that is easy to get wrong.
- It turns a guess into a runnable check.
- It supplies a procedure that keeps an agent honest.

Bad reasons:

- The roadmap lists it and the list should be complete.
- The documentation exists and could be summarised.
- Another engine has an equivalent skill.

## 1. Decide where it goes

| It applies to | Location | `uad-layer` | `uad-platform` |
|---|---|---|---|
| Any engine or stack | `skills/core/<domain>/` | `core` | `any` |
| One platform | `skills/platforms/<key>/` | `platform` | the platform key |

**If in doubt, it is a core skill.** The test: strip out the engine-specific
names. If what remains is still useful, that residue is the core skill, and the
platform skill should require it rather than restate it.

Domains: `programming`, `gamedev`, `graphics`, `performance`, `production`,
`security`.

## 2. Create it from the template

```bash
mkdir -p skills/core/gamedev/save-systems
cp templates/SKILL.template.md skills/core/gamedev/save-systems/SKILL.md
```

**The directory name must equal the `name` field.** The specification requires
it, and a mismatch makes the skill silently fail to load in every client. The
validator catches it.

## 3. Fill in the frontmatter

```yaml
---
name: save-systems
description: Designing save and load systems that survive version changes - what to persist, serialisation format choice, schema versioning and migration, corruption resistance, and autosave timing. Use when building or changing persistence, when saves break after an update, or when players report lost progress.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: gamedev
  uad-version: "1.0.0"
  uad-requires: "game-architecture"
  uad-tags: "save, load, persistence, serialisation, migration, versioning, autosave"
  uad-maturity: stable
---
```

Two things people get wrong:

- **`uad-version: 1.0.0` unquoted.** YAML reads it as a number; the spec allows
  only strings in `metadata`.
- **`uad-requires` as a YAML list.** Same reason — it is a comma-separated
  string.

**Write the description last**, once you know what the skill does. It is the
only thing an agent sees before deciding to load it, so it must state what the
skill does *and* when to reach for it, in the words a developer would actually
use. "Helps with saves" is useless; the example above is not.

## 4. Write the body

Ten sections, all required, all validated. Three of them do the real work:

### `When NOT to use`

Name the neighbouring skill and the actively-wrong case. This is what stops an
agent loading five overlapping skills and getting five overlapping answers.

### `Required context`

Not a vague list — a table of facts *and the file that answers each*:

| Fact | Why it matters | Where to find it |
|---|---|---|
| Engine version | Serialisation APIs differ | `ProjectVersion.txt` |

This is the mechanism that stops an agent asking the user for something the
project already states.

### `Version constraints`

Say what changed across versions and instruct reading the project's files.
If the guidance genuinely is version-independent, say so **and why** — that is
information too.

Never write "always do X" for something version-dependent.

### The rest

- **`Workflow`** — numbered steps, each with the evidence or decision that gates
  it. Not a description of the topic; a procedure.
- **`Common mistakes`** — the mistake, why it is tempting, what it breaks, what
  to do instead. Real mistakes people make, not hypotheticals.
- **`Validation`** — **runnable**. A command, a profiler reading, a test, an
  observable behaviour, and what a passing result looks like. "Make sure it
  works" fails review.

## 5. Compose, don't duplicate

If you find yourself writing a paragraph that is true for every engine, it
belongs in a core skill:

```yaml
uad-requires: "performance-profiling-method"
```

Then the platform skill says "profile using Unreal Insights, reading these
counters" and lets the core skill carry "profile before optimising, change one
thing, re-measure".

## 6. Keep it under 500 lines

The whole `SKILL.md` enters context on activation. Depth goes in `references/`,
which loads only when the agent decides it needs it:

```
save-systems/
├── SKILL.md
└── references/
    └── MIGRATION-PATTERNS.md
```

**If you link to a reference file, create it.** A broken relative link fails
validation.

## 7. Validate

```bash
python tools/uad.py validate --strict
python tools/uad.py select "how should I handle saved games" --path tests/fixtures/unity-sample
```

The second command shows whether the selector actually reaches your skill for
the requests it should. If it does not, the description and `uad-tags` need the
words a developer would use.

## 8. Self-review

Before opening a pull request:

- Would an experienced developer in this domain endorse every claim?
- Is every version-specific claim marked as such?
- Is `Validation` something you could actually run?
- Does `Common mistakes` describe real mistakes with real consequences?
- Is there any filler — a sentence that restates its heading?
- Would an agent behave *differently* with this loaded? If not, it does not earn
  its context.
- Is anything you were unsure about flagged in the text? Flagging beats guessing.

## Full example

`skills/core/performance/performance-profiling-method/SKILL.md` is a good model
for a core skill with a bundled reference, and
`skills/platforms/roblox/roblox-security/SKILL.md` for a platform skill that is
an audit procedure rather than a description.
