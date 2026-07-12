# V1 job queue execution state

## Implemented

- Jobs are created only by the explicit `startLineFx` command.
- A queued job is scheduled after the current owner queue tail rather than starting concurrently.
- `resolveOwnerJobQueueFx` derives `queued`, `running`, and `ready` from persisted job timing and the supplied current timestamp.
- `readOwnerJobQueueFx` exposes that declarative state without mutating runtime.
- Queue order remains the persisted owner-job order; each resolution exposes its queue index and previous job ID.

## Fixed semantic decisions

- Product lines only declare readiness. They never start work by themselves.
- UI and future automation may both read state and invoke the same explicit start command.
- Started jobs cannot be cancelled. Starting a job semantically commits its inputs to irreversible work.
- Do not add reservation-return or cancel-job paths.
- Completion will be a separate explicit write command. A scheduler may discover ready jobs, but it must call the same completion command rather than implement a second completion path.

## Next implementation step

Add explicit job completion:

1. resolve one current job by ID and revision;
2. require derived status `ready`;
3. resolve and place output through the standard output placement path;
4. remove the completed job and its reserved input items atomically;
5. leave later queued jobs scheduled by their persisted timing;
6. provide a read operation for discovering ready jobs without mutating runtime.
