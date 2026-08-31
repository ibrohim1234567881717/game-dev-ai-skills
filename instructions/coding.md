# Coding instructions

How agents in this toolkit write code. These sit under
[master-agent.md](master-agent.md) and add detail for implementation work.

## Before writing

1. **Establish the version.** Read it from the project, and write code for that
   version. This is the single most common way generated code fails: it is
   written against a remembered or newest API, looks right, and does not match
   the project.

2. **Read the surrounding code.** How does this codebase name things, handle
   errors, structure modules, write tests? Match it.

3. **Look for the existing solution.** If a helper, pattern or system already
   exists for this, use it. A second parallel mechanism is worse than a slightly
   awkward reuse of the first.

## While writing

- **Implement the requested scope.** Not narrowed, not expanded.
- **Handle the error paths.** The failure case is where defects live and where
  generated code is weakest. Every external call can fail; decide what happens.
- **Validate at the boundary.** Anything from a client, file, network or user is
  hostile until checked. Reject rather than clamp.
- **Prefer clarity to cleverness.** Code is read far more than it is written.
- **Keep functions doing one thing**, and name them for what they do rather than
  how.
- **Do not leave placeholders.** No `TODO` in place of code you could write, no
  stub reported as finished. If something genuinely cannot be completed, name
  the part and the reason.
- **Comment intent, not mechanics.** The code says what it does; the comment
  should say why it does it that way, particularly for anything non-obvious or
  version-specific.
- **Write the test alongside.** For a bug fix, the test must fail on the unfixed
  code — verify that it does.

## Comment density

Match the file you are editing. A codebase with sparse comments does not want a
newly commented function every three lines, and a heavily documented one should
not receive bare code. Consistency reads as belonging; deviation reads as
foreign.

## What not to do

- Do not reformat or restructure code unrelated to your change. It buries the
  real diff and makes review impossible.
- Do not mix a refactor with a behaviour change in one commit.
- Do not add a dependency without saying why and what it costs.
- Do not rename anything the engine serialises — classes, fields, assets — without
  checking scene, prefab and save references first. That is silent data loss.
- Do not catch and ignore exceptions.
- Do not build queries, commands, paths or markup by concatenating values.

## Before reporting

Run things.

```bash
# build it, test it — with the project's own commands, from its scripts or docs
```

Then report:

```
Changed    : files, and what each change does
Version    : the platform version this targets, and where that came from
Built      : command and result, or "not run" with the reason
Tests      : command and result, or "not run" with the reason
Not done   : anything outstanding, and why
Uncertain  : any API detail you could not verify, and how to confirm it
```

If you could not build or test — no toolchain, no engine, no device — say so
explicitly. Unverified code presented as working is the failure this toolkit
exists to prevent.
