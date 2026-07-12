# Arkini v1 deep review follow-up tasks

Baseline review: `6bb12839`
Implementation baseline: `538dd642`
Updated through: `05401c80`

## Verified complete

- [x] Start commits the exact sequentially validated runtime.
- [x] Repeated start entries preserve quantity and current Arkini start boots.
- [x] Completed validation proves start bootability through the production start builder.
- [x] Resource descriptors are compiled from exact PNG basename IDs.
- [x] Duplicate, missing, and unused resources produce diagnostics.
- [x] Current missing prospector T2 PNG was resolved.
- [x] Shared blueprint resource is explicit as `[blueprint, target-resource]`.
- [x] Same-ID swaps fail with a typed error.
- [x] Every public write uses `modifyRuntimeFx`.
- [x] Public writes cannot import other public writes.
- [x] Owner-local duplicate line IDs are rejected.
- [x] Empty material tag selectors are rejected.
- [x] One canonical `IdSchema` is enforced architecturally.
- [x] Job start is atomic, queue-safe, persisted, and validated with reservations.
- [x] Limited deposits distinguish obvious guaranteed, stochastic, and impossible recreation.
- [x] `chance: 0` does not count as recreation.
- [x] Stochastic-only recreation produces `deposit:stochastic-softlock`.
- [x] Malformed JSON and invalid source fragments produce source-aware diagnostics.
- [x] Multiple malformed source files are collected in one read pass.
- [x] Source errors remain blocking and stop pack through `GameValidationError`.

## Final project decisions

### Nested ownership

Do not add further lifecycle handling. The existing offline input-acceptance cycle validation covers the intended A/B configuration mistakes. No runtime graph paranoia or recursive ownership policy is wanted.

### Reserved-material return

Reserved material remembers only its owning `jobId`.

When completion or cancellation releases it, emit it through the ordinary drop-placement path. Do not retain or reconstruct:

- original input slot;
- original grid position;
- original runtime instance ID;
- source item or stack reference.

A reserved item is detached from the input buffer while its job is active, so the buffer may be refilled for queued work.

## Required before job completion/cancel

- [ ] Add one shared helper that releases reserved items through standard drop placement.
- [ ] Completion must resolve the exact live job by ID + revision inside one transaction.
- [ ] Completion must remove reservations, place outputs, and remove/update the job atomically.
- [ ] Cancel must release reservations through standard drop placement and remove the job atomically.
- [ ] Define owner removal/move behavior while jobs are active.
- [ ] Add architecture tests if new public write commands appear.

## Deep-review guardrails

- Do not add runtime graph-cycle detection for input acceptance.
- Do not add nested ownership handling beyond current offline cycle validation.
- Do not add a global runtime revision.
- Do not nest public write commands.
- Do not create a second validation path for pack.
- Do not infer blueprint resources from target IDs; explicit tuples stay authoritative.
- Do not create domain-specific ID schemas or aliases. Everything exact uses `IdSchema`.
- Do not add reservation return metadata to runtime state.
