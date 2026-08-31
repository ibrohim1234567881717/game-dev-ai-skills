# Research instructions

How agents establish facts before acting. The governing principle: **the project
is the primary source.** Documentation describes what an API is supposed to do;
the project tells you which version you are actually using.

## Order of sources

1. **The project's own files.** Version manifests, build scripts, lockfiles,
   configuration, and the code itself. Authoritative for anything about *this*
   project.
2. **The project's documentation.** README, `AGENTS.md`, `CLAUDE.md`, decision
   records, contributor guides. Authoritative for conventions, though it may be
   stale — where it contradicts the code, the code wins and the gap is worth
   reporting.
3. **Official upstream documentation**, for the version the project uses. Not
   the latest version's documentation, which is a common and quiet error.
4. **The engine or library source**, where available. Decompiled sources and
   mappings are the ground truth for Minecraft modding, and engine source is
   available for Unreal and Godot.
5. **Community sources.** Useful for orientation, frequently outdated. Never
   cite a forum answer as authority for a version-specific API without checking.

## Where the version facts live

| Platform | File | What it tells you |
|---|---|---|
| Unreal | `*.uproject` | `EngineAssociation` — a version, or a GUID meaning a source build |
| Unity | `ProjectSettings/ProjectVersion.txt` | `m_EditorVersion` |
| Unity | `Packages/manifest.json` | Render pipeline, input system, netcode, addressables |
| Godot | `project.godot` | `config_version` (5 = 4.x, 4 = 3.x), `config/features`, renderer |
| Roblox | `default.project.json`, `rokit.toml`, `.luaurc` | Rojo vs Studio workflow, toolchain, Luau mode |
| Minecraft | `gradle.properties` | Minecraft version, loader version, mappings, mod id, Java |
| Minecraft | `fabric.mod.json` / `META-INF/neoforge.mods.toml` | Which loader |
| Web | `package.json` **and the lockfile** | Framework majors, package manager, test runner |

The lockfile, not the manifest, records what is actually installed. Auditing a
version range is not the same as auditing the software that ships.

Run the detector rather than doing this by hand:

```bash
python tools/uad.py detect . --verbose
```

## Rules

- **Do not ask the user for something the files answer.** Look first.
- **Do ask when the files genuinely do not say** and the answer changes the
  work — particularly the Minecraft loader/version/mappings triple, and the
  Unity render pipeline. One focused question beats a wrong assumption.
- **Read enough, not everything.** Targeted reading of the relevant module beats
  loading the whole codebase into context.
- **Prefer running something to reading about it.** Executing a command, reading
  a version string, or printing a value gives a fact; reading documentation
  gives an expectation.
- **Record where a fact came from.** "UE 5.7, from EngineAssociation in
  MyGame.uproject" is checkable. "UE 5.7" is a claim.
- **Distinguish established from assumed** in everything you report.

## When you cannot establish something

Say so, and say what you did instead:

- State the assumption explicitly and prominently.
- Prefer the approach that is correct across the plausible range of versions,
  where one exists.
- Say how the reader can confirm it in their project.
- Do not silently pick the newest version. That is the assumption most likely to
  be wrong on a real project, because real projects lag.

## Handling stale knowledge

Your knowledge of specific API signatures has a cutoff and the ecosystem moves.
This is expected, and handling it honestly is a requirement rather than an
apology:

- Teach the shape of the solution and the architectural rule, which are stable.
- When giving a concrete signature, say which version it is from.
- Point at how to verify it in the project's own sources.

A confidently stated wrong signature costs a developer more time than an honest
"verify this against your mappings" ever will.
