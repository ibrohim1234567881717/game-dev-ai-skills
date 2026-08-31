---
name: version-control-workflow
description: Working with version control on projects that include large binary assets - branching, commit hygiene, merge conflict handling, LFS and file locking, and what belongs in the repository. Use when setting up a repository, when merges keep destroying work, when the repository has grown unmanageably large, or when deciding what to commit in an engine project.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: production
  uad-version: "1.0.0"
  uad-tags: "git, version control, branching, merge, conflicts, lfs, binary assets, repository size, gitignore"
  uad-maturity: stable
---

# Version Control Workflow

## Purpose

Version control on a software project is well-trodden. On a *game* project it is
not: repositories contain gigabytes of binary assets that cannot be merged, and
engine projects generate files that must be committed and files that must never
be. Getting this wrong produces destroyed work, repositories too large to clone,
and merges that silently lose a day of level design.

## When to use

- Setting up a repository for an engine project.
- When merges repeatedly lose work, or conflicts in scenes and prefabs are routine.
- When the repository has become slow to clone or fetch.
- When deciding whether a generated file belongs in version control.
- Before onboarding contributors to a project with binary assets.

## When NOT to use

- Release tagging and shipping process. Use `release-management`.
- Build and test automation. Use `ci-cd-pipelines`.
- Ordinary text-only projects with an established convention — follow the
  project's convention rather than importing another.

## Required context

| Fact | Why it matters |
|---|---|
| Engine and project type | Determines what is generated and what must be committed |
| Whether binary assets are involved | Decides whether LFS and locking are needed |
| Team size and concurrency | Decides how much branch isolation costs versus buys |
| Existing branching convention | Do not introduce a second one |
| Whether artists and designers use the repository | Non-programmers need a workflow that does not require the command line |

## Version constraints

Version-independent in principle. Two version-sensitive specifics: the correct
`.gitignore` for an engine changes between engine versions as generated folders
are added or renamed — take it from the engine vendor's current template rather
than from memory — and file-locking support depends on the hosting provider.

## Workflow

1. **Decide what is source and what is generated.** Source is committed;
   generated is ignored. In engine projects this is subtler than it looks:
   Unity's `.meta` files are source and losing them breaks every reference,
   while `Library/` is a cache; Unreal's `Content/` and `Config/` are source
   while `Intermediate/`, `Binaries/`, `Saved/` and `DerivedDataCache/` are not;
   Godot's `.import` files are generated but `project.godot` and `.tres`/`.tscn`
   are source. Start from the engine's official ignore template.

2. **Set up large-file handling before the first big commit.** Git stores every
   version of every binary forever; a texture committed a hundred times is a
   hundred copies in every clone, permanently. Configure LFS for binary types up
   front — retrofitting it means rewriting history.

3. **Enable file locking for unmergeable files** if the team includes artists or
   designers. Scenes, prefabs, models and textures cannot be merged in any
   meaningful sense; the only workable protocol is exclusive checkout. Where
   locking is unavailable, use a social protocol and make it explicit.

4. **Choose the simplest branching model that fits.** Short-lived branches off a
   trunk, merged quickly, suit most teams. Long-lived parallel branches are
   expensive with binary assets because divergence cannot be reconciled.

5. **Keep commits small and coherent**, with a message stating *why*. The diff
   already shows what. Do not mix a refactor with a behaviour change — it makes
   both unreviewable and bisection useless.

6. **Rebase or merge consistently**, per the project's convention, and never
   rewrite history that others have pulled.

7. **Handle conflicts by type.** Text merges normally. Binary conflicts have no
   merge — one version wins, so decide which and re-apply the other's intent by
   hand. Engine-specific merge tools exist for some scene formats; use them
   where available rather than trusting a text merge of a YAML scene, which can
   produce a file that loads but is subtly corrupt.

8. **Protect the main branch.** Require review and a green build. On a project
   where a broken commit costs everyone a re-import, this matters more than usual.

## Best practices

- **Commit the lockfile and the engine version.** A repository that does not
  record which engine version opens it is a trap.
- **Never commit secrets.** Once committed they are disclosed and must be
  rotated, not deleted. Scan history, not just the working tree.
- **Set up `.gitattributes`** for line endings and for marking binary types.
  Cross-platform teams otherwise get whole-file diffs from line-ending churn.
- **Keep the repository small.** Large media belongs in LFS or an asset store,
  not in history.
- **Write the branching and locking protocol in the README**, in language a
  non-programmer can follow.
- **Tag releases**, so a shipped build can be reproduced.
- **Prefer many small merges to one large one**, especially with binaries.
- **Verify after a binary merge.** Open the scene, run the game. A merged scene
  file that parses is not necessarily correct.

## Common mistakes

- **Committing binaries without LFS**, then discovering the repository is 40 GB
  and every clone takes an hour. Fixing it requires rewriting history.
- **Ignoring Unity `.meta` files.** Every asset reference breaks for everyone
  else. This is the single most destructive engine-project mistake.
- **Committing generated caches** (`Library/`, `Intermediate/`, `node_modules/`).
  Enormous, conflict-ridden, and useless to others.
- **Text-merging a scene or prefab file.** Frequently produces a file that opens
  but is broken in ways nobody notices for weeks.
- **Long-lived feature branches with asset changes.** The merge is not feasible.
- **Force-pushing shared branches.** Destroys others' work.
- **Committing secrets and then deleting them in a later commit.** Still in
  history; still disclosed.
- **Not recording the engine version.** A new contributor opens the project in a
  newer version, the engine upgrades every asset, and the diff is unreviewable.
- **Vague commit messages.** "fixes", "update", "wip" — worthless during a
  bisect, which is exactly when you need them.

## Validation

- A fresh clone opens and builds without manual steps beyond documented setup.
- `.gitignore` matches the engine's current official template plus project needs.
- No file over a chosen size threshold is stored outside LFS; check history, not
  just the current tree.
- A secret scan over full history reports nothing.
- The engine version is recorded in the repository and matches what the team uses.
- The main branch is protected and requires a passing build.
- The branching and locking protocol is documented where non-programmers see it.
- A test merge of two branches that both touched a scene is verified by opening
  the result, not just by a clean merge exit code.

## References

- Related core skills: `ci-cd-pipelines`, `release-management`,
  `code-review-method`, `dependency-analysis`
