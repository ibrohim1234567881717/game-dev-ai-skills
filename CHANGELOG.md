# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versioning applies to the toolkit as a whole. Individual skills carry their own
`uad-version` in frontmatter, so a skill can be revised without a repository
release.

## [Unreleased]

Nothing yet.

## [0.1.0] — 2026-08-30

First release. The architecture, tooling and test suite are complete; skill
coverage is partial and tracked in [docs/roadmap.md](docs/roadmap.md).

### Added — architecture

- Skill format built on the [Agent Skills](https://agentskills.io) open
  standard, so skills load unmodified in any spec-compliant client. Routing
  metadata travels inside the spec's `metadata` field, which conforming
  runtimes ignore.
- Ten mandatory body sections per skill, including `When NOT to use`,
  `Required context` and `Version constraints` — the three that carry the
  version-awareness guarantee.
- Composition via `uad-requires`: platform skills state only what is
  platform-specific and depend on core skills for the reasoning, instead of
  duplicating it per engine.

### Added — content

- **60 skills**: 28 engine-agnostic core skills across programming, gamedev,
  graphics, performance, production and security; 32 platform skills.
- **6 platform adapters**: Unreal, Unity, Godot, Roblox, Minecraft, Web — each
  with detection signals, version extraction and routing.
- **15 agents**: orchestrator, architect, programmer, debugger, reviewer, QA,
  performance, graphics, security, plus one specialist per platform.
- **8 workflows**: `build-feature`, `fix-bug`, `optimize`, `review`,
  `prototype`, `graphics-pass`, `security-review`, `release-check`.
- **5 instruction files** binding every agent, centred on honesty about what was
  and was not verified.
- `knowledge/version-matrix.yaml` recording the platform version landscape as of
  August 2026, explicitly as orientation rather than authority.

### Added — tooling

- `uad detect` — multi-signal platform detection with version extraction,
  reporting the file each fact came from.
- `uad select` — skill selection with platform gating, relevance scoring,
  entry-skill seeding and transitive dependency closure.
- `uad validate` — specification and convention checking, with `--strict`.
- `uad install` — installation into five verified client targets, with platform
  filtering, namespacing, symlink or copy, dry run and uninstall.
- `uad list`, `uad doctor`.
- `tools/check_links.py` — relative link checking across all Markdown.
- Zero runtime dependencies: `tools/uad/miniyaml.py` implements the YAML subset
  the toolkit needs, so it runs on a bare Python 3.9+ install.

### Added — verification

- **108 tests**: YAML parser (14), detection (23), scenarios (19), selector
  precision (19), validation (19), installation (14).
- The validator has negative tests asserting it rejects each defect class it
  claims to catch.
- Detection has false-positive tests asserting no fixture matches a platform it
  is not.
- GitHub Actions CI across Linux, macOS and Windows on Python 3.9 and 3.12,
  running validation, tests, an install smoke test and the link check.

### Fixed during development

These were found by running the acceptance scenarios by hand and are covered by
regression tests:

- **Unity projects were detected as web projects.** Unity ships a `package.json`
  inside every embedded package, which an unanchored signal matched. Detection
  signals gained a `depth` limit.
- **NeoForge mappings resolved to the wrong value**, because a generic
  `parchment_*version` pattern matched `parchment_minecraft_version` before
  `parchment_mappings_version`. Version patterns are now ordered most-specific
  first.
- **Naming a platform ranked every skill of that platform.** "Unreal" in a
  performance request gave Enhanced Input and the ability system a name match.
  Platform vocabulary is now excluded from relevance scoring, since detection
  has already established the platform.
- **Synonym folding was applied to skill vocabulary**, so
  `multiplayer-networking` — tagged "lag compensation", where lag means latency
  — matched frame-rate questions. Folding now applies to the request only.
- **A single common word in a description selected a skill.** Descriptions run
  to 1024 characters, so this ranked by verbosity. A description-only match now
  needs two terms or one term that is specific across the library, measured by
  document frequency.
- **Tab-indented YAML was accepted** by the built-in parser, because `lstrip(" ")`
  does not see tabs.
- **A `platform.yaml` version pattern had no capture group**, which the
  validator caught.

### Known limitations

- Platform skill coverage is uneven: Unity and Minecraft have 7 skills each,
  Roblox has 3. See the roadmap.
- Several planned core skills are absent, including save systems, inventory,
  quests, dialogue, game AI, procedural generation, audio, animation, asset
  optimisation, loading and streaming, CI/CD and technical documentation.
- The `gemini-cli` install path follows the documented convention but was not
  verified; `uad doctor` marks it as such.
- Claude Code plugin packaging is not included. The nested `skills/` layout was
  not verified against the plugin format, and unverified support is not claimed.
- The toolkit's own tests pass, but "these skills improve an assistant's output"
  is not something this repository measures.

[Unreleased]: https://github.com/ibrohim1234567881717/game-dev-ai-skills/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ibrohim1234567881717/game-dev-ai-skills/releases/tag/v0.1.0
