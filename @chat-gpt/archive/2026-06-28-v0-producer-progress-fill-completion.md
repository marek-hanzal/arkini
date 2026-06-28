# Producer progress button fill completion

Adjusted the shared progress-button presentation so active producer product-line buttons visually fill to 100% by their current remaining time.

## Why

The producer runtime state was correct, but UI snapshots can stop rendering the running state just before completion. With debug 1s durations this made the button background progress often end slightly short of the full button width, which looked broken even though the backend finished correctly. Tiny visual lies are still lies, because human eyes are unfortunately shipped enabled by default.

## Change

- `UiProgressButton` now renders a full-width absolute fill layer and uses `scaleX` instead of dynamic width.
- Active, unpaused producer lines pass `progressAutoCompleteMs` from `readProducerProductLineRunState` based on live `remainingMs`.
- The fill animates from the current sampled progress to full width over the remaining time.
- Paused and queued states stay frozen and do not auto-complete.

## Guardrails

Keep progress semantics runtime-owned. UI may interpolate the already-reported active progress for presentation, but it must not invent running progress for paused, queued, or delivery-blocked jobs.
