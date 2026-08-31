# Examples

Real output, captured from the commands shown. Nothing here is illustrative or
invented — you can reproduce every block by running the command against the
fixtures in `tests/fixtures/` after generating them:

```bash
python tests/make_fixtures.py
```

- [detection.md](detection.md) — what the detector reads and reports
- [routing.md](routing.md) — which skills load for each kind of request, and
  which platforms are kept out

## Why these two

They demonstrate the two claims the whole toolkit rests on:

1. **Version facts come from the project, not from assumption.** Detection
   reports the file each fact came from, so the claim is auditable.
2. **Only relevant skills load.** Every request reports the platforms it
   excluded, which is what makes "progressive disclosure" a testable behaviour
   rather than a slogan.

Both are also asserted in the test suite — see `tests/test_detect.py` and
`tests/test_scenarios.py`.
