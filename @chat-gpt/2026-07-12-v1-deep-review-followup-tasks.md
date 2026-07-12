# Arkini v1 deep review follow-up tasks

Baseline review: `6bb12839`
Implementation baseline: `538dd642`
Updated through: `86d158a8`

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

When completion releases it, emit it through the ordinary drop-placement path. Do not retain or reconstruct:

- original input slot;
- original grid position;
- original runtime instance ID;
- source item or stack reference.

A reserved item is detached from the input buffer while its job is active, so the buffer may be refilled for queued work.

## Required before job completion

- [ ] Add one internal helper that releases all reserved items through standard drop placement over one evolving runtime draft.
- [ ] Completion must resolve the exact live job by ID + revision inside one transaction.
- [ ] Completion must release every reservation, place outputs, and remove the job atomically all-or-nothing.
- [ ] Failed completion placement must preserve the job and every reservation unchanged.
- [x] Generic remove and quantity mutation reject job-scoped reservations through `assertNonJobScopeFx`.
- [x] Define owner movement semantics: board movement is live; inventory is a hard pause; permanent removal with active or queued work is invalid. Implementation of permanent-owner removal policy remains in the runtime-invariant block.
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
- Do not add job cancellation.
- Do not allow partial reservation release.
