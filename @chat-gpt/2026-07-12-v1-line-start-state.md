# V1 explicit line-start state

Implemented after `a3ce0424`.

## Mental model

- Filling a line is passive and never starts work by itself.
- `LineStartResolutionSchema` declares the current line run and owner queue state.
- `readLineStartFx` is the read boundary for UI and future automation.
- A user click or automation invokes the same explicit `startLineFx` command.
- `startLineFx` never accepts a caller-created plan. It re-resolves the full start state from the locked runtime snapshot before mutation.

## Current declaration

`LineStartResolutionSchema` contains:

- the current `LineRunResolutionSchema`;
- active owner jobs in persisted queue order;
- queue usage and capacity;
- queue availability;
- final `ready`, which requires both a run plan and queue capacity.

## Guardrails

- Do not auto-start from line/input resolution.
- Do not create a second automation-specific start command.
- Do not pass preview plans into write commands.
- Future schedulers consume declared runtime/job state and invoke explicit commands.
