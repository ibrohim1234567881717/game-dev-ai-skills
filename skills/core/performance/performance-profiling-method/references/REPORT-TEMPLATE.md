# Profiling report template

Copy this into the issue, pull request, or commit message. A performance change
without these fields cannot be reviewed, reproduced, or defended later.

```markdown
## Performance change: <short title>

### Conditions
- Platform / hardware :
- Build configuration :
- Scene / route / workload :
- Input or reproduction steps :
- Profiler and version :

### Baseline
- Metric :                      (use frame time in ms, not fps)
- Value :
- Capture :                     (path or link to the trace)
- Worst case (p99) :

### Diagnosis
- Resource saturated :          CPU / GPU / memory / I/O
- Dominant cost :               (what the profiler showed, with its share)
- Hypothesis :                  (falsifiable, with an expected saving)

### Change
- What changed :                (one thing)
- Why it should help :

### Result
- Value after :
- Delta :                       (absolute and percent)
- Worst case after :
- Capture :

### Correctness
- Tests run :
- Behaviour verified :
- Visual difference :           none / described and accepted

### Remaining
- Budget met :                  yes / no
- Next bottleneck :             (named, with its share)
```

## Why frame time rather than fps

Frames per second is the reciprocal of frame time, so equal fps deltas represent
wildly unequal amounts of work:

| From | To | fps gain | Time saved per frame |
|---|---|---|---|
| 30 fps | 40 fps | +10 | 8.3 ms |
| 60 fps | 70 fps | +10 | 2.4 ms |
| 120 fps | 130 fps | +10 | 0.6 ms |

The same "+10 fps" ranges from a major win to noise. Frame time in milliseconds
is linear, is what the budget is expressed in, and is what is comparable across
captures. Report it.

## Interpreting a capture

- **Inclusive time** (a function plus everything it calls) locates the subsystem
  responsible.
- **Exclusive time** (a function excluding its callees) locates the line to change.

Read inclusive first to find the area, then exclusive to find the work.

- A flat profile with no item above roughly 5% means there is no bottleneck to
  fix. That is a design cost, spread across the system, and it is addressed by
  doing less work overall -- fewer entities, fewer updates, coarser tick rates --
  not by optimising any single function.
- A spiky timeline with a good average points at allocation, garbage collection,
  streaming, shader compilation, or synchronous I/O. Look at what happens
  *between* the good frames.
