# Installation

## Requirements

**Python 3.9 or newer.** Nothing else. The toolkit ships its own YAML subset
parser (`tools/uad/miniyaml.py`) so it runs on a bare Python install; if PyYAML
happens to be present it is used instead.

`pytest` is needed only to run the test suite.

## Get the repository

```bash
git clone https://github.com/ibrohim1234567881717/game-dev-ai-skills.git
cd game-dev-ai-skills
python tools/uad.py doctor
```

`doctor` prints the environment, the repository contents, the validation result,
and which install targets are verified. If it runs clean, everything works.

## Install into a client

```bash
python tools/uad.py install --target claude-code --platforms unreal web
```

**Choose your platforms.** Installing all six puts skills for engines you never
touch into every session's skill index. Core skills always install regardless —
they apply everywhere.

Preview first if you like:

```bash
python tools/uad.py install --target claude-code --platforms godot --dry-run --verbose
```

### Targets

| Target | Destination (user scope) | Installs | Verified |
|---|---|---|---|
| `claude-code` | `~/.claude/` | skills, agents, commands | yes |
| `codex` | `~/.codex/skills/` | skills | yes |
| `copilot` | `~/.copilot/skills/` (project: `.github/skills/`) | skills | yes |
| `cursor` | `~/.cursor/skills/` | skills | yes |
| `gemini-cli` | `~/.gemini/skills/` | skills | **no** |
| `generic` | `~/.agent-skills/skills/` or `--dest` | skills | yes |

"Verified" means the destination layout was checked against the client's
documented convention when this was written. It does **not** mean every client
was installed and driven end to end — see the honest status section in the
[README](../README.md). For any client not listed, use `--target generic
--dest <path the client scans>`; skills here are standard
[Agent Skills](https://agentskills.io), so any spec-compliant client loads them.

### Options

| Flag | Effect |
|---|---|
| `--platforms a b c` | Which platform packs to install. Omit for all. |
| `--scope project` | Install into the current project instead of your home directory |
| `--project-dir PATH` | Which project, with `--scope project` |
| `--dest PATH` | Explicit destination, overriding the target's default |
| `--namespace uad-` | Prefix every skill name, avoiding collisions with skills you already have |
| `--link` | Symlink instead of copying, so `git pull` updates in place |
| `--no-agents`, `--no-commands` | Skip those components |
| `--dry-run` | Show what would happen |
| `--uninstall` | Remove a previous install matching the same options |
| `--verbose` | List every action |

### Copy or symlink

Copying is the default. `--link` symlinks instead, so pulling updates in the
repository updates the installed skills with no reinstall.

On Windows, symlinks require Developer Mode or an elevated shell. If `--link`
cannot create one, the installer says so and copies instead rather than failing.

### Name collisions

If you already have a skill called `code-review` or `api-design`, install with a
namespace:

```bash
python tools/uad.py install --target claude-code --namespace uad-
```

Every skill becomes `uad-<name>`. The installer rewrites the `name` field in
each `SKILL.md` to match its new directory, because the Agent Skills
specification requires them to be equal — a namespaced install that skipped this
would produce skills that silently fail to load.

## After installing

**Restart your assistant** so it re-reads the skill index.

Then confirm it worked. Ask something that should trigger a skill:

```
What version of Godot is this project, and how do you know?
```

A correctly installed toolkit answers with the value **and the file it came
from**.

## Updating

```bash
git pull
python tools/uad.py install --target claude-code --platforms unreal web
```

Re-running install overwrites the previous install of the same skills. With
`--link`, `git pull` alone is enough.

## Uninstalling

```bash
python tools/uad.py install --target claude-code --uninstall
```

Pass the same `--platforms` and `--namespace` you installed with, so it removes
the same set.

## Per-project instead of per-user

To scope the toolkit to one project — useful when different projects use
different engines:

```bash
cd /path/to/your/game
python /path/to/game-dev-ai-skills/tools/uad.py install \
    --target claude-code --scope project --platforms godot
```

This writes into `.claude/` inside that project. Add it to the project's
`.gitignore` unless you want the whole team to get the same set, which is a
reasonable thing to want.

## Using it without installing

Every command works against any directory, so you can use the tooling without
installing skills anywhere:

```bash
python tools/uad.py detect /path/to/project --verbose
python tools/uad.py select "why is this slow" --path /path/to/project
```

## Troubleshooting

**`could not locate the universal-ai-dev repository root`** — run from inside the
cloned repository, or pass `--repo /path/to/game-dev-ai-skills`.

**`UnicodeEncodeError` in test output on Windows** — set
`PYTHONIOENCODING=utf-8`. The CLI reconfigures its own streams; pytest does not.

**Skills do not activate after installing** — restart the client; confirm the
destination is where that client actually scans (`uad doctor` lists them);
check for a name collision with an existing skill and reinstall with
`--namespace uad-`.

**`symlink unavailable` on Windows** — expected without Developer Mode. The
installer copies instead; everything works, updates just need a reinstall.

**Detection finds nothing** — the directory may not contain project markers at
the scanned depth. Try `--depth 8`, or name the platform in your request.
