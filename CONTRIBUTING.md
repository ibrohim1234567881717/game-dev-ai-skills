# Contributing

The most valuable contributions to this project are, in order:

1. **Corrections.** Engine APIs move and this repository will drift. If a skill
   states something that is wrong for a current version, fixing it is worth more
   than any new skill.
2. **Filling gaps in existing platforms.** See the [roadmap](docs/roadmap.md) for
   what is planned and missing.
3. **New engine adapters** — Bevy, Three.js, Phaser, GameMaker, Blender.
4. **Better detection signals**, especially ones that eliminate a false positive.
5. **New core skills**, where a real gap exists.

## The bar

**A skill must make an agent measurably better at a real task.**

Before writing one, answer: *what does an agent do wrong today that this would
fix?* If the honest answer is "it would have more information", that is not
enough. Fifty skills that change behaviour beat five hundred that restate
documentation, and every skill that does not earn its place costs context in
every session that loads it.

A skill is likely worth writing if it encodes:

- A procedure that prevents a specific expensive mistake.
- Version-specific knowledge that is easy to get wrong.
- A validation step that turns a guess into a check.
- Domain knowledge an assistant reliably lacks or misremembers.

It is likely **not** worth writing if it:

- Restates official documentation without adding judgement.
- Lists API names with no procedure around them.
- Duplicates a core skill with an engine's vocabulary substituted.
- Exists to make a list look complete.

## Getting set up

Python 3.9+, nothing else.

```bash
git clone https://github.com/ibrohim1234567881717/game-dev-ai-skills.git
cd game-dev-ai-skills
python tools/uad.py doctor
python -m pytest tests/ -q
```

## Adding a skill

```bash
mkdir -p skills/core/programming/my-skill
cp templates/SKILL.template.md skills/core/programming/my-skill/SKILL.md
```

Then, in order:

1. **Set `name` to exactly the directory name.** The Agent Skills specification
   requires it, and skills that break the rule silently fail to load.
2. **Write the description last**, once you know what the skill does. It is the
   only thing an agent sees before deciding to load the skill, so it must state
   *what it does* and *when to use it*, in the words a developer would use.
3. **Fill all ten sections.** They are validated. `When NOT to use`,
   `Required context` and `Version constraints` are the three that do the real
   work — filling them with hand-waving makes the skill worse than absent.
4. **Compose.** If the reasoning is engine-agnostic, put it in a core skill and
   `uad-requires` it. Do not restate it.
5. **Keep it under 500 lines.** Depth goes in `references/`.
6. **Validate.**

```bash
python tools/uad.py validate --strict
```

Full format contract: [docs/skill-format.md](docs/skill-format.md).
Worked walkthrough: [docs/adding-a-skill.md](docs/adding-a-skill.md).

### Naming

| Kind | Pattern | Example |
|---|---|---|
| Core skill | `<topic>` or `<topic>-<qualifier>` | `root-cause-debugging` |
| Platform skill | `<platform>-<topic>` | `unity-render-pipelines` |
| Agent | `<role>` or `<platform>-specialist` | `reviewer`, `godot-specialist` |
| Workflow | `<verb>-<noun>` | `fix-bug`, `release-check` |

Platform prefixes are not decoration — skills are installed into a single flat
directory, so names must be globally unique.

## Adding an engine adapter

One directory, no code changes:

```
skills/platforms/bevy/
├── platform.yaml
└── bevy-project-conventions/SKILL.md
```

`platform.yaml` carries the detection signals, version extraction rules, and the
entry skills to load. Detection, selection and install are all driven from it.

Detection signals need care. Weight them so a definitive marker (a project
manifest) clears the threshold alone and a weak one (a common folder name) does
not, and add a `depth` limit to any signal whose marker file appears inside
other ecosystems' vendored directories.

**Every new adapter needs a fixture and a false-positive test.** See
[docs/adding-a-platform.md](docs/adding-a-platform.md).

## Testing

```bash
python -m pytest tests/ -q
python tools/uad.py validate --strict
```

What a change needs:

| You changed | Add |
|---|---|
| Detection | A fixture in `tests/make_fixtures.py`, a case in `test_detect.py`, and a false-positive assertion |
| Selection | A case in `test_scenarios.py` |
| The validator | A **negative** test proving it rejects the defect |
| Install | A case in `test_install.py` |
| A skill | Nothing automated, but the validator must pass |

CI runs both commands on every pull request.

## Pull requests

Keep them focused: one skill, one adapter, or one fix. A pull request adding
twelve skills cannot be reviewed properly, and skills are exactly the thing that
needs reviewing properly.

In the description, state:

- What an agent does wrong today that this changes.
- Which versions you verified against, and how.
- Anything you were **not** sure about. This is a feature, not a weakness — a
  flagged uncertainty is far better than a confident error, and reviewers can
  check it.

## Reviewing

Reviewers should be adversarial about correctness, in this order:

1. **Is it true?** For the version it claims. Check one specific technical claim
   properly rather than skimming all of them.
2. **Is it version-honest?** Does `Version constraints` name what changed and
   send the agent to the project's files?
3. **Is it composed or duplicated?** Should this be a core skill plus a thin
   platform skill?
4. **Is `Validation` runnable?** Or is it "make sure it works"?
5. **Does it earn its context?** Would an agent behave differently with it loaded?

## Style

- British or American spelling — be consistent within a file.
- Second person for the agent reading the skill ("read the manifest first").
- Concrete over abstract. Real names, real commands, real paths.
- No filler. If a section has nothing to say, the skill probably should not exist.
- Prefer tables for anything that is a lookup.

## Code of conduct

Be straightforward and assume good faith. Technical disagreements are settled by
evidence — a version number, a documentation link, a reproduction — not by
seniority or emphasis.

## License

Contributions are made under the [MIT License](LICENSE).
