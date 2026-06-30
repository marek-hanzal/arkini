# Action pipeline instant craft review

Status: DONE

## Finding

`applyGameActionFx` only processed completed producer jobs after player actions. It did not run due item spawn jobs or completed craft jobs, even though `runGameTickFx` processes the full runtime pipeline.

That meant `durationMs: 0` craft recipes could start during an action and remain pending until the next tick. It also meant an instant craft result that creates a passive effect source could not affect already-running producer jobs until later, even though the runtime contract says craft completions are followed by another producer realtime pass.

## Fix

After every action, the engine now runs the same due-job family order as a tick:

1. item spawn jobs
2. producer completions
3. craft completions
4. producer completions again after craft results may create/move effect sources
5. expired active effects

`processItemSpawnJobsFx` now returns the original save when there are no due spawn jobs, so the broader action pipeline does not clone saves for no-op spawn passes.

## Coverage

Added expectation tests for:

- zero-duration craft completing in the same action result
- instant craft creating a local duration effect source and causing an already-running producer to resync and complete in the same action result

This protects the effect/craft/producer timing boundary instead of merely checking that individual modules are adorably self-confident in isolation.
