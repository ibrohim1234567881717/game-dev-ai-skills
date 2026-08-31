# AGENTS.md

Instructions for AI coding agents working **on this repository**. (For what the
repository *provides* to agents working on other projects, see the
[README](README.md).)

## What this project is

A toolkit of Agent Skills, agent definitions and workflows for game and software
development, plus zero-dependency Python tooling that detects a project's
platform and version, selects which skills to load, validates the repository,
and installs into AI coding clients.

It is content-heavy and code-light. Most contributions are Markdown; the Python
under `tools/` exists to make the Markdown routable and verifiable.

## Setup, build, test

Python 3.9+ is the only requirement. There are no dependencies to install —
`tools/uad/miniyaml.py` is a deliberate reimplementation of the YAML subset the
toolkit needs, so the toolkit runs on a bare Python install.

```bash
python tools/uad.py doctor           # environment + repository health
python tools/uad.py validate --strict # structural validity
python tools/audit.py --strict        # skill quality (heuristic)
python tools/check_links.py           # relative links across all Markdown
python -m pytest tests/ -q
```

`validate` asks whether a skill is well-formed; `audit` asks whether it is any
good. Both run in CI.

`pytest` is needed only for the test suite. Fixtures are generated, not
committed:

```bash
python tests/make_fixtures.py
```

On Windows, set `PYTHONIOENCODING=utf-8` if your console uses a legacy code page;
the CLI reconfigures its own streams, but pytest output can still trip over
non-ASCII paths.

## Repository layout

```
skills/core/<domain>/<skill-name>/SKILL.md      engine-agnostic
skills/platforms/<key>/platform.yaml            detection + routing manifest
skills/platforms/<key>/<skill-name>/SKILL.md    engine-specific
agents/{core,platforms}/<name>.md               agent definitions
workflows/<name>.md                             procedures / slash commands
instructions/*.md                               cross-cutting agent rules
knowledge/version-matrix.yaml                   version reference
tools/uad/                                      detect, select, validate, install
tests/                                          89 tests
```

## Conventions that are enforced

`python tools/uad.py validate --strict` must pass, and CI runs it. It enforces:

- **Agent Skills spec**: `name` 1–64 chars, lowercase `a-z0-9` with single
  hyphens, **equal to the parent directory name**; `description` ≤ 1024 chars;
  `metadata` values are **strings only** (quote `"1.0.0"`); no top-level
  frontmatter keys outside the six the spec defines.
- **UAD conventions**: all ten `##` sections present, required routing metadata,
  semver versions, `uad-requires` resolving to real skills, unique names across
  the repository, working relative links.

Read [docs/skill-format.md](docs/skill-format.md) before writing a skill.

## Writing rules for skills

- **Compose, do not duplicate.** If the reasoning is engine-agnostic it belongs
  in a core skill, and the platform skill requires it via `uad-requires`. Six
  copies of the same profiling method is the failure mode this project exists to
  avoid.
- **Version-awareness is the point.** `Version constraints` must say what changed
  across versions and instruct reading the project's own files. Never write
  "always do X" for something version-dependent.
- **`Validation` must be runnable.** A command, a profiler reading, a test — and
  what a passing result looks like. Not "make sure it works".
- **Be specific.** Real class names, real commands, real file paths. A skill an
  experienced developer would not endorse should not ship.
- **Say when you are unsure.** If an API detail may be stale, say so in the text
  and point at how to verify it in the project. A confidently wrong signature is
  the worst thing this repository can contain.
- **Keep `SKILL.md` under 500 lines.** Depth goes in `references/`, which loads
  on demand.
- **No placeholders.** No `TODO`, no stub section.

## Things that will break if you are careless

- **Renaming a skill directory** without updating its `name` field, and every
  `uad-requires` and `entry_skills` entry that names it. The validator catches
  it; run it.
- **Unquoted `uad-version: 1.0.0`** — YAML reads it as a number, and the spec
  requires strings.
- **Linking to `references/REFERENCE.md` without creating the file.**
- **Editing `platform.yaml` regexes without a capture group** in a `version`
  pattern.
- **Adding a detection signal without a `depth` limit** where the marker file is
  common — an unanchored `package.json` signal matches Unity's embedded package
  manifests and misdetects every Unity project as web.

## Testing changes

- Changing detection → add or update a fixture in `tests/make_fixtures.py` and a
  case in `tests/test_detect.py`, including a false-positive check.
- Changing selection → add a case to `tests/test_scenarios.py`.
- Changing the validator → add a **negative** test proving it rejects the defect.
  A validator that cannot fail is worse than none.
- Changing install → `tests/test_install.py`.

## What not to do

- Do not add a runtime dependency. Zero-dependency is a design constraint.
- Do not couple the core to one AI provider. Skills are portable by construction.
- Do not create a skill to fill a gap in a list. Quality over count is the stated
  standard, and an empty skill costs context for nothing.
- Do not claim a platform, client or path is supported without having checked it.
  `uad doctor` marks unverified install targets, and the README has an honest
  status section — keep both accurate.
