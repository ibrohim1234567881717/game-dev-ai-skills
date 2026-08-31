# Skill format

Every skill in this toolkit is a valid [Agent Skills](https://agentskills.io)
skill. That is a deliberate architectural choice: the format is an open
standard stewarded by the Agentic AI Foundation and implemented by dozens of
agent products, so a skill written here loads in Claude Code, Codex, Cursor,
Copilot, Gemini CLI, Goose, OpenHands and the rest **without a translation
layer**. The toolkit adds conventions on top of the standard; it does not
invent a competing one.

## The two layers

```
┌─────────────────────────────────────────────┐
│  Agent Skills specification (portable)      │  name, description, license,
│  agentskills.io/specification               │  compatibility, metadata,
└─────────────────────────────────────────────┘  allowed-tools
                    ▲
┌─────────────────────────────────────────────┐
│  UAD conventions (this repository)          │  routing metadata + a fixed
│  carried inside `metadata`, ignored by      │  body structure
│  runtimes that do not know about them       │
└─────────────────────────────────────────────┘
```

Spec-compliant runtimes ignore frontmatter keys they do not recognise, and the
spec explicitly reserves `metadata` for exactly this. So the routing
information the toolkit needs travels *inside* the standard rather than beside
it, and nothing breaks in a client that has never heard of this project.

## Frontmatter

```yaml
---
name: unreal-performance-profiling          # required
description: What it does AND when to use it # required
license: MIT                                 # optional
metadata:                                    # optional per spec, required here
  uad-layer: platform
  uad-platform: unreal
  uad-domain: performance
  uad-version: "1.0.0"
  uad-requires: "performance-profiling-method"
  uad-tags: "profiling, gpu, frame time"
  uad-maturity: stable
---
```

### Specification rules (enforced by `uad validate`)

| Field | Rule |
|---|---|
| `name` | 1–64 chars, lowercase `a-z0-9` and single hyphens, no leading/trailing hyphen, **must equal the parent directory name** |
| `description` | 1–1024 chars, states what *and* when |
| `compatibility` | ≤ 500 chars, only if the skill has real environment requirements |
| `metadata` | a map of **string → string** only — numbers and lists must be quoted strings |
| top-level keys | only the six the spec defines; anything else is an error |

The string-only rule for `metadata` is the one that catches people out. Lists
travel as comma-separated strings:

```yaml
uad-requires: "performance-profiling-method, root-cause-debugging"
uad-version: "1.0.0"    # quoted — 1.0.0 is not a YAML number
```

### UAD routing fields

| Key | Required | Meaning |
|---|---|---|
| `uad-layer` | yes | `core` (engine-agnostic), `platform` (engine-specific), or `meta` (about the toolkit itself) |
| `uad-platform` | yes | `any` for core skills, otherwise the adapter key (`unreal`, `unity`, `godot`, `roblox`, `minecraft`, `web`) |
| `uad-domain` | yes | `programming`, `gamedev`, `graphics`, `performance`, `production`, `security`, … |
| `uad-version` | yes | semver, quoted |
| `uad-requires` | no | skills that must be loaded alongside this one; resolved transitively and exempt from the selection budget |
| `uad-tags` | no | extra keywords for the selector |
| `uad-maturity` | no | `stable` or `draft` |

`uad-requires` is what makes composition work instead of copy-paste. A platform
skill states the engine-specific part and requires the core skill holding the
reasoning, so the method is written once and specialised six times rather than
duplicated six times.

## Body structure

Ten `##` sections, all required, all validated:

| Section | What belongs in it |
|---|---|
| `Purpose` | The problem, for an agent with no other context |
| `When to use` | Concrete triggers, phrased as the situation presents itself |
| `When NOT to use` | The neighbouring skill and the actively-wrong case |
| `Required context` | Facts to establish first, **and the file that answers each** |
| `Version constraints` | What changed across versions and what to verify in the project |
| `Workflow` | Numbered steps with the evidence that gates each one |
| `Best practices` | Practice + the reason it matters |
| `Common mistakes` | The mistake, why it is tempting, what it breaks, what to do instead |
| `Validation` | A check that can actually be run, and what passing looks like |
| `References` | Bundled files and upstream documentation |

`Required context` and `Version constraints` are not decoration. They are the
mechanism that stops an agent writing Godot 3 code into a Godot 4 project, or
Fabric code into a NeoForge mod. A skill that fills them with hand-waving is
worse than no skill at all.

## Size

Keep `SKILL.md` under 500 lines. The spec recommends the activated body stay
under roughly 5 000 tokens, because it enters context whole. Depth belongs in
`references/`, which loads only when the agent decides it needs it:

```
skills/platforms/unreal/unreal-performance-profiling/
├── SKILL.md              # the method, always loaded on activation
├── references/
│   └── REFERENCE.md      # stat command tables, read on demand
└── scripts/              # optional executables
```

## Directory layout

```
skills/
├── core/                        # uad-layer: core, uad-platform: any
│   ├── programming/
│   ├── gamedev/
│   ├── graphics/
│   ├── performance/
│   ├── production/
│   └── security/
└── platforms/
    ├── <key>/
    │   ├── platform.yaml        # the adapter: detection + routing
    │   └── <skill-name>/SKILL.md
    └── web/frameworks/          # framework specifics kept out of core web skills
```

Layer and location must agree; `uad validate` warns when they drift.

## Validating

```bash
python tools/uad.py validate --strict
```

See [adding-a-skill.md](adding-a-skill.md) for the contribution workflow and
[adding-a-platform.md](adding-a-platform.md) for new engine adapters.
