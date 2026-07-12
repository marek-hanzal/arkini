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
- Do not add a cancel-job path.
- Completion will be a separate explicit write command. A scheduler may discover ready jobs, but it must call the same completion command rather than implement a second completion path.

## Next implementation step

Add explicit job completion:

1. resolve one current job by ID and revision;
2. require derived status `ready`;
3. collect every item owned by the job through `location.scope === "job"`;
4. release every reservation through the standard drop-placement path over one evolving runtime draft;
5. resolve and place output through the standard output placement path;
6. remove the completed job only after every release and output placement succeeds;
7. commit the entire completion all-or-nothing, leaving the job and every reservation unchanged on failure;
8. leave later queued jobs scheduled by their persisted timing;
9. provide a read operation for discovering ready jobs without mutating runtime.

## Reserved-resource authority

- A job-scoped item is an exclusive resource lock owned by its job.
- Generic item commands must reject `location.scope === "job"`; `assertNonJobScopeFx` is the shared command-boundary guard.
- Reservations remain job-scoped until successful completion.
- Completion releases all reservations through ordinary drop placement in one transaction.
- Partial release is forbidden. If any reservation or output cannot be placed, nothing is committed.
- No original slot, position, instance identity, or source stack is retained.
