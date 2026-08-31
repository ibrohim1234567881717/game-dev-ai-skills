# Testing instructions

How agents verify work. The rule underneath all of it: **a claim about behaviour
requires evidence produced by running something.**

## The three claims, kept distinct

| Claim | What it requires |
|---|---|
| "I wrote it" | The code exists |
| "I inspected it" | You read it and reasoned about it |
| "I verified it" | You ran it and read the output |

These are routinely blurred, and blurring them is how unverified work reaches
production. Label which one you are making.

## What to run, in order

1. **Build.** In the configuration that matters. A change that does not build is
   not testable, and this is the fastest way to find out.
2. **The existing test suite.** Note failures, and check whether they are
   pre-existing — an inherited red suite is a finding, not your failure.
3. **The new tests.** For a bug fix, confirm the regression test **fails on the
   unfixed code** before it passes on the fixed one. A test that passes both
   ways tests nothing.
4. **The edge cases**, manually if not automatable: empty, one, many, maximum,
   zero, negative, duplicate, out of order, interrupted, first run with no saved
   state, and existing saved data from before the change.

## Use the project's own commands

Take them from `package.json` scripts, the Makefile, the CI configuration, or
the contributor documentation. They are the authoritative statement of how this
project builds and tests. Do not substitute a command you remember from a
similar project.

## Reporting

Paste the output. Not a summary of the output.

```
Build   : <command>
          <result>
Tests   : <command>
          <pass/fail counts; pre-existing failures listed separately>
Covered : what the new tests actually exercise
Manual  : what you checked by hand, and what happened
Not run : what you could not run, and why
```

## When you cannot run anything

This is common and legitimate — no engine installed, no device, no toolchain,
no credentials. Handle it explicitly:

- **Say so, prominently.** Not in a closing aside.
- **State what you would run**, with the exact commands, so the developer can.
- **State what a passing result looks like**, so they can judge it.
- **Do not imply verification.** "This should work" and "this works" are
  different claims and only one of them is available to you.

An honest report with an unverified section is useful and normal. A confident
report that turns out to be wrong destroys trust in everything else in the
session.

## Platform-specific realities

| Platform | What you can usually run | What you usually cannot |
|---|---|---|
| Unreal | Nothing without the engine installed | Compilation, play-in-editor, packaging |
| Unity | Nothing without the editor | Compilation, play mode, builds |
| Godot | Headless runs if the binary is present | Editor-dependent workflows |
| Roblox | `selene`, `stylua`, `luau-lsp` type checks | Running the game at all |
| Minecraft | `./gradlew build`, `runClient`, `runServer` | Nothing much, if the toolchain is set up |
| Web | Everything — build, test, typecheck, lint, axe, lighthouse | Little |

For Minecraft specifically, **always test a dedicated server** for anything
touching common code. Client-only class references crash a dedicated server on
load and are invisible in a client run — the single most common modding defect.

## Performance claims

A performance claim needs a measurement, not a reading of the code. Baseline and
after, under identical stated conditions, in milliseconds. If you cannot
measure, give a ranked list of things to measure and label them as hypotheses.

See `performance-profiling-method`.
