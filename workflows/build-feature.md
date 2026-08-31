---
name: build-feature
description: Build a new feature end to end - understand the request, detect the platform and version, load the right skills, design, implement, test, and review. Use for any new functionality that is more than a one-line change.
metadata:
  uad-workflow: build-feature
  uad-version: "1.0.0"
  uad-skills: "software-architecture, testing-strategy, code-review-method"
---

# /build-feature

Build a new feature without skipping the steps that prevent expensive mistakes.

```
UNDERSTAND -> INSPECT -> DETECT -> LOAD SKILLS -> DESIGN -> IMPLEMENT -> TEST -> REVIEW
```

## Steps

### 1. Understand

State in one sentence what will be true when this is done. List the acceptance
criteria. If the request is ambiguous in a way that changes the work, ask **one**
focused question — not a list.

Do not start building on an interpretation you are not confident in.

### 2. Inspect the project

Read before writing. How does this codebase already do things like this? Is
there an existing system to extend rather than a new one to add? What are its
naming, error-handling and testing conventions?

### 3. Detect the platform and version

```bash
python tools/uad.py detect . --verbose
```

Record the platform and the version facts, with the file each came from. If any
required fact is unresolved — loader and Minecraft version, Unity render
pipeline, Godot major version — resolve it now. Everything after this depends on
being right here.

### 4. Load skills

```bash
python tools/uad.py select "<the request>" --path .
```

Load what it selects. Do not load other platforms' skills.

### 5. Design

For anything touching more than one system, produce a short design first:
modules involved, where the new code belongs, dependency direction, what is data
versus code, and the trade-off you accepted. Delegate to `architect` if the
design is non-trivial.

**Show the plan before implementing it** when the work is more than a few steps.

### 6. Implement

Write the code, matching the project's conventions and targeting the detected
version. Handle the error paths. Validate external input at the boundary. Leave
no placeholders — if something cannot be completed, name it rather than stubbing
it and moving on.

### 7. Test

Write tests for the new behaviour, including the edge cases: empty, one, many,
maximum, and the failure path. Run the build and the test suite. **Paste the
output.** If you cannot run them, say so explicitly.

### 8. Review

Run an independent pass with `reviewer`. Its job is to find problems, not to
confirm the work. Address blockers before reporting.

## Done means

- [ ] Every acceptance criterion is met, or the gap is stated.
- [ ] The code targets the version detected in step 3.
- [ ] The build ran and its result is shown.
- [ ] Tests ran, cover the new behaviour, and their output is shown.
- [ ] The reviewer pass ran and blockers are resolved.
- [ ] Anything not done is named, with the reason.

## Report

```
Feature    : one sentence
Platform   : detected platform and version, and the file it came from
Design     : the approach, and the trade-off accepted
Changed    : files, and what each does
Tests      : command, result, what they cover
Review     : findings, and how each was resolved
Not done   : anything outstanding
```
