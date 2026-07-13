# Arkini v1 deep review follow-up tasks

Baseline review: `6bb12839`
Implementation baseline: `538dd642`
Updated through: fixed-step Tick / FIFO / session review closeout

## Review cycle status

Closed. The fixed-step Tick, FIFO queue, completion, owner lifecycle, committed-transition, save, and session-lifecycle findings from the follow-up reviews are implemented and covered. The remaining unchecked architecture-test item below is a conditional future guardrail, not pending work.

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

- [x] Completion releases all reserved items through standard drop placement over one evolving runtime draft.
- [x] Completion accepts only the stable job ID, resolves the exact live job inside the current runtime draft, and rejects missing or still-running jobs before mutation. Revision is deliberately not accepted as detached caller state.
- [x] Completion releases every reservation, places outputs, and removes the job atomically all-or-nothing.
- [x] Failed completion placement preserves the job and every reservation unchanged.
- [x] Generic remove and quantity mutation reject job-scoped reservations through `assertNonJobScopeFx`.
- [x] Define owner movement semantics: board movement is live; inventory is a hard pause; permanent removal with active or queued work is invalid. Permanent removal now rejects active or queued work and atomically releases buffered inputs for idle owners.
- [x] Queue dispatch accepts only `ownerItemId`, resolves the live FIFO head internally, and cannot start a detached request.
- [x] Completion randomness is created through strict `makeJobCompletionRandomFx`; core has no pure-helper exception.
- [x] Runtime and transient events commit through one `CommittedTransition`; no separate event PubSub or ordering bridge exists.
- [x] Session and save process the initial transition emission instead of dropping it. Duplicate notifications and saves are acceptable.
- [x] External reporters and listeners are isolated so one throwing callback cannot terminate Tick, autosave, or the session transition bridge.
- [x] Concurrent `dispose()` callers share one cleanup Promise and observe the same completion or failure.
- [x] Runtime validation reports orphan reservations with `job:reservation-orphan`; reverse reservation reconstruction remains deliberately unsupported.
- [x] Tick sub-step remainder and retained failed-budget loss on session disposal are documented as intentional transient adapter behavior.
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
