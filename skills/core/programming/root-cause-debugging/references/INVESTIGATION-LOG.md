# Investigation log template

Keep this for any defect that survives the first few minutes. It stops you
re-testing hypotheses you already eliminated, and it is the handover document
if the investigation changes hands.

```markdown
## Bug: <one-line symptom>

### Facts
- Symptom (precise) :
- Error / stack :
- Reproduction :                (steps + how reliably it fires)
- Frequency :                   always / N in M / once
- Environment :                 platform, build config, engine or runtime version
- Last known good :
- Suspect changes :

### Hypotheses
| # | Hypothesis | Test | Result | Verdict |
|---|---|---|---|---|
| 1 |  |  |  | ruled out / supported |
| 2 |  |  |  |  |

### Narrowing
- Axis used :                   time / data / code path / environment
- Space before :
- Space after :

### Root cause
<The invariant that broke, where it broke, and why it was allowed to break.>

### Proof
<How the bug was made to appear and disappear on demand.>

### Fix
- Change :
- Level :                       (this call site / the general mechanism)
- Regression test :
- Siblings searched :
```

## Choosing a narrowing axis

| Situation | Best axis | Method |
|---|---|---|
| Worked in an earlier build | Time | `git bisect run <script>` |
| Only some inputs fail | Data | Shrink the failing input to the minimum that still fails |
| Value is wrong by the time it is used | Code path | Check the value at points between assignment and use |
| Fails on one machine only | Environment | Diff versions, settings, hardware, locale, filesystem case |
| Fails under load or intermittently | Concurrency | Look for shared mutable state, ordering assumptions, missing synchronisation |

## Signals that point at a class of cause

| Observation | Usual class of cause |
|---|---|
| Works in editor, fails in a packaged build | Something stripped, not included, or initialised differently; asset or reference not packaged |
| Works on one platform only | Endianness, path case sensitivity, filesystem, precision, API availability |
| Fails only on the first run | Missing initialisation masked by leftover state; cold cache |
| Fails only after a while | Leak, accumulation, overflow, unbounded growth, handle exhaustion |
| Fails intermittently under load | Race condition, ordering assumption, timing dependency |
| Fails only with real data | An assumption about size, encoding, nullability, or uniqueness |
| Started after an upgrade | Changed API semantics, changed defaults, removed behaviour |
| Off by exactly one | Boundary condition, inclusive/exclusive range, index base |
| Wrong only after saving and loading | Serialisation, versioning, or migration defect |

These are starting points, not conclusions. Each still has to be proven by
making the bug appear and disappear on demand.
