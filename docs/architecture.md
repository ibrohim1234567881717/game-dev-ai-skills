# Architecture

The design decisions behind the toolkit, and why each was made.

## The problem

An AI assistant given a game project fails in characteristic ways: it writes
Godot 3 code into a Godot 4 project, produces Fabric code for a NeoForge mod,
ships a Built-in-pipeline shader into a URP project, "optimises" something it
never profiled, and reports tests as passing without running them.

These are not intelligence failures. They are **missing procedure and missing
project facts**. So the architecture is built around two mechanisms: establish
the facts from the project, and load the procedure that applies.

## The pipeline

```
request
   │
   ▼
DETECT ──────── read the project's own files
   │            → platform, version, loader, pipeline, and the file each came from
   ▼
SELECT ──────── gate by platform, score by relevance, close over dependencies
   │            → a small set of skills; every other platform explicitly excluded
   ▼
EXECUTE ─────── agents follow the loaded skills
   │
   ▼
REVIEW ──────── an independent adversarial pass
```

Each stage is a separate module under `tools/uad/` and is independently tested.

## Layering

```
┌─────────────────────────────────────────────────────────┐
│  Agent Skills specification            (portable)       │
│  name · description · license · compatibility           │
│  metadata · allowed-tools                               │
├─────────────────────────────────────────────────────────┤
│  UAD conventions                       (this project)   │
│  routing metadata inside `metadata`, ten fixed sections │
├─────────────────────────────────────────────────────────┤
│  Content                                                │
│  core skills  ←── uad-requires ──  platform skills      │
└─────────────────────────────────────────────────────────┘
```

### Why the Agent Skills standard

It is an open specification stewarded by the Agentic AI Foundation and
implemented across the ecosystem. Writing to it means a skill loads in Claude
Code, Codex, Cursor, Copilot, Gemini CLI and dozens of others **with no
translation layer** — portability by construction rather than by adapter.

The alternative — inventing a format and writing an exporter per client — would
have meant maintaining N exporters and being wrong in N ways.

### Why routing metadata lives inside `metadata`

The spec reserves `metadata` for exactly this and requires runtimes to ignore
frontmatter keys they do not recognise. So `uad-platform`, `uad-requires` and
the rest travel *inside* the standard. A client that has never heard of this
project loads the skill and ignores the routing fields; nothing breaks.

The spec restricts `metadata` values to **strings**, which is why lists travel
comma-separated and versions are quoted. The validator enforces it, and there is
a test asserting that an unquoted `1.0` is rejected.

## Composition over duplication

The core failure mode for a project like this is six copies of the same
profiling advice with the engine's vocabulary substituted. That is unmaintainable
and it is how a repository becomes a prompt dump.

Instead:

```
performance-profiling-method          (core: baseline → profile → fix → re-profile)
        ▲              ▲
        │              │  uad-requires
unreal-performance-    unity-performance-
profiling              profiling
(Insights, stat cmds)  (Profiler, deep profiling)
```

The method is written once. Platform skills state only what is
platform-specific and declare the dependency. The selector closes over
`uad-requires` transitively and **exempts dependencies from the selection
budget**, because a skill is incomplete without them.

## Detection

Data-driven: every rule lives in `skills/platforms/<key>/platform.yaml`, so
adding an engine adds a manifest, not code.

**Multi-signal with weights.** A single file is never proof. Signals carry
weights; a platform must clear a confidence threshold. A definitive marker
(`*.uproject`) scores alone; a weak one (`Content/`) cannot.

**Depth anchoring.** Signals can require a marker to be near the project root.
This exists because of a real bug: Unity ships a `package.json` inside every
embedded package, so an unanchored web signal misdetected every Unity project.
The fixture and test for that case are still in the suite.

**Version extraction is the point.** Detection that only names the engine is
half useless. Each adapter declares patterns that pull out the facts that change
what is correct — Unity's render pipeline, Godot's `config_version`, Minecraft's
loader and mappings — and reports the file each came from, so the claim is
auditable.

**`required_facts`** marks what must be known before code generation. Missing
ones are reported as `UNRESOLVED`, and agents are instructed not to proceed.

## Selection

Four passes:

1. **Gate by platform.** Only core skills and detected platforms are eligible.
   The excluded platforms are *reported*, which is what makes the
   context-isolation claim testable rather than aspirational.
2. **Score by relevance.** Weighted keyword overlap against name, tags, domain
   and description, with a synonym table so "lag", "fps" and "stutter" all reach
   performance skills.
3. **Seed entry skills.** A detected platform always contributes its adapter's
   entry skills, so even a vague request gets the platform's ground rules.
4. **Close over dependencies**, transitively, exempt from the budget.

A platform named in the request but absent from the files is added with a note
saying so — "start a Godot project" in an empty folder still routes, and the
agent is told the platform came from wording rather than evidence.

## Zero dependencies

`tools/uad/miniyaml.py` implements the YAML subset the toolkit needs. This was
deliberate: a toolkit whose purpose is to be cloned and used immediately should
not fail at `pip install`, and the machine this was built on had no PyYAML.

PyYAML is used when importable, since it is more robust on files we did not
author. The parser has its own 14 tests.

## Validation

Two rule families:

- **Specification compliance** — what makes a skill load at all in the 40+ tools
  implementing the standard.
- **UAD conventions** — the ten sections, resolvable dependencies, unique names,
  working links, layer/location agreement.

Names must be globally unique because installers flatten every skill into one
directory. The validator enforces it; `--namespace` handles collisions with
skills a user already has, rewriting the `name` field to match the renamed
directory so the result stays spec-compliant.

**The validator has 19 negative tests** asserting it rejects each defect class.
A validator that cannot fail is worse than none, because it manufactures
confidence.

## Agents

Markdown with frontmatter, following the widely-adopted subagent convention.
Each has one responsibility and rules that constrain it: the `performance` agent
may not propose an optimisation before profiling; the `security` agent treats
every client as hostile; the `minecraft-specialist` will not write code until
loader, version and mappings are known.

The **reviewer is deliberately independent**. Reviewing your own work is not the
same operation, and the failure this defends against is specific: model-generated
code reads plausibly whether or not it is correct. The reviewer's instructions
tell it to verify rather than recognise.

## Honesty as an architectural requirement

`instructions/master-agent.md` makes these binding on every agent:

- Never claim a command was run that was not. Show the output.
- Never claim tests pass without the output.
- Never present an assumption as a detected fact.
- When an API detail is uncertain, say so and say how to verify it.
- Report partial completion as partial.

This is architecture, not etiquette. Every other guarantee here is worthless if
the agent reports unverified work as verified — a wrong answer delivered
confidently costs more than no answer.

## What is deliberately not here

- **No runtime.** The toolkit ships knowledge and tooling; the AI client is the
  runtime.
- **No provider coupling.** Nothing in the core depends on a specific vendor.
- **No generated skills.** Every skill is written and reviewed. Generating a
  hundred from an API reference would produce exactly the prompt dump this
  design avoids.
- **No mirroring of official documentation.** Skills encode judgement and
  procedure; where documentation is the right answer, they link to it.
