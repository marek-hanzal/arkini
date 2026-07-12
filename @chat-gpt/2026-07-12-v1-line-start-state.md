# V1 explicit line-start state

## Mental model

- Filling a line is passive and never starts work by itself.
- `LineStartResolutionSchema` declares the current line run plus active-job and queued-request capacity.
- `readLineStartFx` is the read boundary for UI and automation.
- A user click or automation invokes the same explicit `startLineFx` command.
- `startLineFx` never accepts a caller-created plan and re-resolves from the locked runtime snapshot.

## Start behavior

- With no active owner job, `startLineFx` calls `startLineRuntimeFx`, consumes/reserves current inputs, and creates one active job.
- With an active owner job, `startLineFx` records one FIFO `JobQueueRequestSchema` without consuming or reserving inputs.
- Queue capacity counts the active job and queued requests together.
- A queued request is dispatched later through the same `startLineRuntimeFx` pipeline and is revalidated against current state.

## Guardrails

- Do not auto-start from line or input resolution.
- Do not create automation-specific or queue-specific start commands.
- Do not model queued requests as future active jobs.
- Do not put time fields on queued requests.
