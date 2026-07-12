# Arkini v1 deep review follow-up tasks

Baseline review: `6bb12839`
Reviewed snapshot: `84e5bc82`

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

## Remaining from the original review

### P2: Limited-deposit certainty

- [ ] Replace presence-only output scanning with certainty-aware recreation analysis.
- [ ] `chance: 0` must not count as recreation.
- [ ] Probabilistic and weighted-only recreation should produce a stochastic soft-lock warning.
- [ ] One guaranteed recreation path should suppress weaker stochastic warnings.
- [ ] Keep reachability/economic-cycle solving outside this pass.

### P2: Structured source diagnostics

- [ ] Convert malformed JSON into source-aware diagnostics instead of raw defects.
- [ ] Convert invalid `GameSourceSchema` fragments into source-aware diagnostics.
- [ ] Collect multiple malformed source failures in one validation pass where practical.
- [ ] Keep parsing policy in source/compiler domain, not CLI rendering.

## Required before job completion/cancel/withdraw

### Input ownership policy

- [ ] Decide whether an item with buffered child inputs may itself be stored as material.
- [ ] Preferred simple policy: reject loaded owners as material before nested ownership becomes observable.
- [ ] Add runtime and authoring tests around the chosen policy.

### Reserved-material return policy

- [ ] Define cancel/return behavior when the original input slot is occupied by the split remainder.
- [ ] Preferred order: merge into compatible remainder, deterministic fallback placement, typed capacity failure/retained reservation.
- [ ] Implement the policy once in a shared domain helper, not independently per command.

### Job lifecycle integrity

- [ ] Completion must resolve the exact live job by id + revision inside one transaction.
- [ ] Completion must remove/consume reservations and place output atomically.
- [ ] Cancel must restore reserved materials according to the shared return policy and remove the job atomically.
- [ ] Owner removal/move rules while jobs are active must be explicit.
- [ ] Add architecture tests if new public write commands appear.

## Deep-review guardrails

- Do not add runtime graph-cycle detection for input acceptance.
- Do not add a global runtime revision.
- Do not nest public write commands.
- Do not create a second validation path for pack.
- Do not infer blueprint resources from target IDs; explicit tuples stay authoritative.
- Do not create domain-specific ID schemas or aliases. Everything exact uses `IdSchema`.
