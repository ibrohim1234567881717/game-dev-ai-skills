# Adding an engine adapter

Adding a new engine — Bevy, Three.js, Phaser, GameMaker, Blender — means adding
**one directory**. There is no code to change: detection, skill selection and
installation are all driven by the manifest you write.

```
skills/platforms/bevy/
├── platform.yaml                      the adapter
└── bevy-project-conventions/
    └── SKILL.md                       the entry skill
```

## 1. Find the detection signals

Look at several real projects of that kind and answer:

- **What file exists in every one of them, and in nothing else?** That is your
  definitive marker.
- **What else is usually present?** Those are supporting signals.
- **What file might it share with another ecosystem?** Those need care.

For a Rust/Bevy project: `Cargo.toml` is Rust but not necessarily Bevy — it
needs a `contains` check for the dependency. `src/main.rs` is weaker still.
There is no single unambiguous marker, so detection must combine them.

## 2. Write `platform.yaml`

```yaml
platform: bevy                 # must equal the directory name
title: Bevy
aliases: [bevy, rust-game]     # words in a request that name this platform
languages: [rust]
entry_skills: [bevy-project-conventions]

detect:
  signals:
    - glob: 'Cargo.toml'
      weight: 70
      depth: 2
      contains: '^\s*bevy\s*='
      note: 'Cargo manifest depending on bevy'
    - glob: 'Cargo.lock'
      weight: 20
      depth: 2
      contains: 'name = "bevy"'
    - dir: 'assets'
      weight: 10
      depth: 2

  version:
    - label: engine
      file: 'Cargo.toml'
      depth: 2
      pattern: 'bevy\s*=\s*"([^"]+)"'
    - label: rust_edition
      file: 'Cargo.toml'
      depth: 2
      pattern: 'edition\s*=\s*"(\d+)"'

  required_facts: [engine]

version_gate:
  ask_if_unresolved:
    - 'Which Bevy version does this project target?'
  notes: |
    Bevy has no stability guarantee between minor versions and its ECS API
    changes substantially. Read the pinned version from Cargo.toml, and prefer
    Cargo.lock where it exists.

knowledge:
  reference: ../../../knowledge/version-matrix.yaml
```

### Signal fields

| Field | Meaning |
|---|---|
| `glob` | Filename pattern. Without `/` it matches the basename at any depth. |
| `dir` | Directory name pattern, matched the same way. |
| `weight` | 1–100. Contribution to confidence; the total is capped at 100. |
| `depth` | Maximum path depth. **Use this on any common filename.** |
| `contains` | Regex the file's contents must match. Bounded read. |
| `note` | Shown in `detect --verbose`. Explain what the signal means. |

### Choosing weights

The threshold is 25, and a platform whose top rival is within 20 points is
reported as ambiguous. So:

- **A definitive marker gets 90–100.** It should identify the platform alone.
- **A strong supporting signal gets 30–60.** Meaningful, not conclusive.
- **A weak signal gets 10–25.** Must not clear the threshold by itself.

Getting this wrong is the main way an adapter causes harm. A `dir: src` signal
at weight 40 would match half the projects in existence.

### The `depth` field is not optional in practice

Without it, `glob: package.json` matches Unity's embedded package manifests at
`Packages/com.x/package.json` and misdetects every Unity project as a web
project. That exact bug is why the field exists. Anchor any signal whose marker
filename appears inside other ecosystems' vendored or generated directories.

### Version extraction

Each entry needs a `file` and either a `pattern` with **at least one capture
group**, or a `value` for facts asserted by a file's mere existence:

```yaml
    - label: loader
      file: 'fabric.mod.json'
      value: 'fabric'          # the file existing IS the fact
```

Entries are evaluated in order and the first to resolve wins a label, so put the
most specific pattern first.

Use **single quotes** in YAML for regexes. Double quotes process escapes and
will mangle `\s` and `\d`.

List anything in `required_facts` that must be known before generating
version-sensitive code. The detector reports missing ones as `UNRESOLVED`, and
agents are instructed not to proceed past them.

## 3. Write the entry skill

`entry_skills` are loaded whenever the platform is detected, even on a vague
request. The entry skill must teach:

- **How to establish the version**, from which file — this is its main job.
- The project layout and where things live.
- The conventions an agent must follow to produce code that fits.
- What differs between major versions.

Follow [skill-format.md](skill-format.md). Copy the structure of an existing
entry skill such as `godot-project-conventions`.

## 4. Add a fixture and tests

**Required.** An adapter without a false-positive test is a liability.

In `tests/make_fixtures.py`, add a fixture reproducing the marker files a real
project carries:

```python
    "bevy-sample": {
        "Cargo.toml": '[package]\nname = "game"\nedition = "2021"\n\n'
                      '[dependencies]\nbevy = "0.15"\n',
        "Cargo.lock": '[[package]]\nname = "bevy"\nversion = "0.15.0"\n',
        "src/main.rs": "use bevy::prelude::*;\nfn main() { App::new().run(); }\n",
        "assets/sprite.png": "binary-placeholder",
    },
```

In `tests/test_detect.py`, add:

1. The platform is identified.
2. The version facts are extracted correctly.
3. `test_no_fixture_detects_a_platform_it_is_not` includes your fixture — this
   is the cross-check that catches an over-weighted signal.

Then verify your adapter did not break the existing ones:

```bash
python tests/make_fixtures.py
python -m pytest tests/ -q
python tools/uad.py validate --strict
```

The whole suite must pass, not just your new tests. A new signal that misdetects
an existing platform will show up there.

## 5. Grow the pack

Start with the entry skill and add depth as it proves useful. Prefer requiring
core skills over restating them:

```yaml
uad-requires: "performance-profiling-method, gpu-optimization"
```

That is what keeps a new platform pack small: it inherits the whole core library
and adds only what is genuinely specific to the engine.

## Checklist

- [ ] `platform.yaml` with `platform` equal to the directory name
- [ ] A definitive signal that identifies the platform alone
- [ ] `depth` on every signal with a common filename
- [ ] Version extraction with capture groups, single-quoted regexes
- [ ] `required_facts` for anything that gates code generation
- [ ] At least one entry skill, teaching version resolution first
- [ ] A fixture in `make_fixtures.py`
- [ ] Detection, version and false-positive tests
- [ ] Full suite green, `validate --strict` clean
- [ ] The platform added to the README table and the roadmap
