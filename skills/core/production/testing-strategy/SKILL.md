---
name: testing-strategy
description: Deciding what to test, at which level, and what a test must prove to be worth its maintenance cost. Use when adding tests to new work, when a bug escapes to production, when a suite is slow or flaky, or when deciding whether something is testable at all. Covers the test levels, testing behaviour rather than implementation, testing game and interactive systems, and flake control.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: production
  uad-version: "1.0.0"
  uad-tags: "testing, tests, unit, integration, end to end, regression, flaky, coverage, qa"
  uad-maturity: stable
---

# Testing Strategy

## Purpose

Tests are not free: they are code that must be maintained, and a bad test is a
liability that breaks on every refactor while catching nothing. This skill is
about choosing which tests are worth writing, at what level, and what each must
prove.

The measure of a test is simple: **would it fail if the behaviour it describes
broke?** A test that cannot fail is decoration, and coverage that counts it is
misleading.

## When to use

- Adding tests alongside new work.
- After a defect escapes -- the regression test is part of the fix.
- When a suite is slow, flaky, or routinely ignored.
- When deciding whether a design is testable, which is a design question.
- Setting up CI gates.

## When NOT to use

- Diagnosing a specific failure. Use `root-cause-debugging`.
- Measuring performance. A test asserts correctness; use
  `performance-profiling-method` for speed, and be wary of timing assertions in
  functional tests -- they are the main source of flake.
- Exploratory or usability testing of a game's feel. That is human playtesting
  and no automated suite replaces it.

## Required context

| Fact | Why it matters |
|---|---|
| What the code is supposed to do | Tests encode intent; without it they encode current behaviour |
| The existing test setup and conventions | A second incompatible framework is a cost |
| What is genuinely risky | Effort follows risk, not uniformity |
| How the code is built and run in CI | A test that cannot run in CI protects nothing |
| Which parts are deterministic | Determinism decides what can be asserted |

## Version constraints

Method is version-independent. Test runners, assertion APIs and engine test
frameworks are not -- check the project's configured runner rather than
introducing a familiar one. Engine-specific harnesses (play-mode tests, headless
server runs, in-editor suites) have their own constraints; consult the platform
skill.

## Workflow

1. **Identify the risk.** What would be worst if it broke: data loss, currency
   or economy errors, save corruption, security checks, or the core loop. Write
   tests there first. Uniform coverage targets spread effort evenly across
   unequal risk.

2. **Choose the level deliberately.**

   | Level | Tests | Use when | Cost |
   |---|---|---|---|
   | Unit | One unit, no I/O | Logic, rules, calculations, state machines | Cheap, fast, precise |
   | Integration | Several units together, real boundaries | Persistence, serialisation, API contracts, wiring | Moderate |
   | End-to-end | The whole system as a user meets it | A handful of critical journeys | Expensive, slow, flake-prone |

   Prefer the cheapest level that can actually catch the defect. Pushing a rule
   into a unit-testable function so it need not be tested through the UI is a
   design improvement, not a workaround.

3. **Test observable behaviour, not implementation.** Assert on outputs and
   state transitions, not on which private method was called. Tests coupled to
   implementation break on every refactor and are why teams stop trusting suites.

4. **Write the failing test first when fixing a bug.** It must fail on the
   unfixed code. A regression test that passes before the fix tests nothing.

5. **Make it deterministic.** Inject the clock, seed the random generator, avoid
   real network and real sleeps, control ordering. Nondeterminism is the cause of
   flake, and flake destroys the suite's value faster than missing tests do.

6. **Cover the boundaries.** Empty, one, many, maximum, zero, negative,
   duplicate, out-of-order, and the error path. The happy path is the case least
   likely to be broken.

7. **Name tests as statements of behaviour.** `refuses_purchase_when_balance_is_insufficient`
   documents the rule; `test_buy_2` documents nothing.

8. **Run them in CI on every change**, and treat a failure as a stop. A suite
   that is allowed to stay red stops being a signal.

## Best practices

- **One reason to fail per test.** Multi-assert tests obscure what broke.
- **Arrange-act-assert, visibly.** Readable structure survives; clever helpers
  hide what is under test.
- **Keep tests independent and order-agnostic.** Shared mutable fixtures cause
  failures that depend on run order.
- **Use real objects where cheap; mock only at genuine boundaries** -- network,
  clock, filesystem, third-party service. Over-mocking tests the mocks.
- **Delete tests that no longer describe required behaviour.** Keeping them
  because deleting feels wrong is how suites rot.
- **Extract game rules from engine callbacks** so they can be unit tested
  without a running engine. This is usually the single highest-value change to
  a game codebase's testability.
- **Treat a flaky test as broken.** Fix or quarantine with an owner; never
  "just re-run it".
- **Test the data too** where content is data-driven: schema validity,
  referential integrity, required fields. Content errors are as shipping-fatal
  as code errors.

## Common mistakes

- **Chasing a coverage percentage.** Coverage measures execution, not assertion.
  100% coverage with weak assertions catches nothing.
- **Tests that assert current behaviour, written after the fact.** They lock in
  bugs and block refactors.
- **Testing private implementation.** Guarantees churn.
- **Only testing the happy path.** Failures live in the error paths.
- **Sleeping to fix a race.** It converts a fast failure into a slow flaky one.
- **A shared, mutable global fixture.** Cross-contamination and order dependence.
- **End-to-end tests for logic that could be unit tested.** Slow, fragile, and
  vague about what broke.
- **Not running tests in CI**, or letting the suite stay red.
- **Fixing a bug without adding a regression test.** The bug is free to return.

## Validation

The strategy is working when:

- Every bug fix ships with a test that failed before it.
- The highest-risk behaviours (data persistence, economy, security checks, core
  loop) have direct tests.
- The suite runs in CI on every change and is green.
- No test in the suite is known-flaky and tolerated.
- Tests survive a refactor that preserves behaviour.
- A failure message identifies what broke without needing a debugger.

Two checks that expose a weak suite quickly:

- **Mutation check by hand:** deliberately break one rule in the code (invert a
  comparison, drop a validation). If no test fails, that rule is untested,
  whatever coverage reports.
- **Refactor check:** rename an internal method or restructure a class without
  changing behaviour. Tests that fail were testing implementation.

## References

- Related core skills: `root-cause-debugging`, `code-review-method`,
  `bug-triage`, `ci-cd-pipelines`
- Platform applications: `roblox-testing-tooling`, `web-testing`
