# Speed cheat closeout

Task 07 is complete.

## Canonical model

```text
runtime.session.speedMode
→ normal | accelerated

newly observed wall-clock delta
→ 1× or 30× simulation milliseconds
→ existing 200 ms fixed-step Tick
```

The root session mode is engine-visible and committed with runtime mutations, but it is not serialized gameplay state. Hydration always initializes `normal`.

`toggleSpeedModeFx()` is item-independent. It first advances elapsed wall time under the old mode and then atomically changes the root mode and emits `speed-mode:changed`. It never rewrites item, job, or temporary-duration state. Explicit simulation advancement remains unscaled.

The authored speed item is presentation only. Its ordered assets represent accelerated and normal mode and will be projected from engine-owned root state in tasks 10 and 13. Audio consumes the committed event in task 15.

Historical timestamp retiming and item-owned toggle state are rejected. The old tree remains only where current UI/audio tasks still name concrete presentation intent.
