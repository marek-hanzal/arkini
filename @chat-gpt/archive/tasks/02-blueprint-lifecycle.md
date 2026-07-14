# 02 — Blueprint lifecycle


> **Task 04 normalization:** finite item lifetime now comes from generic item charges and input charge costs. `afterCompletion` and output `replace` no longer exist. This file is historical only; root documentation and `@chat-gpt/CURRENT.md` own current behavior.
**Status:** Done

> **Later normalization:** Task 03 replaced the item-type completion branches and specialized output contracts described below with one `line.output` + item-level `afterCompletion` lifecycle. This file remains a historical decision record; current behavior is owned by root documentation and `@chat-gpt/CURRENT.md`.

## Goal

Complete construction by atomically replacing the blueprint owner with its configured `targetId` and placing any authored additional output.

## Final decisions

- Blueprint and completed target are different runtime identities.
- Completion order is fixed: exact-cell target replacement, top-level blueprint by-products, blueprint-owned state removal, then job reservation return.
- The completed job is detached before its output is placed, so its own worst-case `maxCount` reservation is spent during completion.
- Every active job reserves the worst possible future quantity of each canonical output item. Quantity ranges reserve `max`, chance rolls reserve success, repeated weighted selections reserve the repeatable worst candidate, and alternative roll sets reserve the per-item maximum.
- Queued requests reserve no future output until their FIFO head authoritatively dispatches into an active job. A max-count-blocked head remains queued and cannot be overtaken.
- Ordinary placement, direct spawn, and direct quantity replacement cannot consume capacity already promised to active jobs.
- Blueprint target and by-product output are both included in the start-time reservation. A missing target therefore fails during start resolution rather than after the player waits for completion.
- Blueprint removal and public item removal share `removeRuntimeItemFx`. The helper releases buffered inputs, removes the item, and discards queued requests bound to that identity; public removal still applies its stricter idle guard.
- No configuration schema changed.

## Implemented lifecycle

```text
resolve start against the live pre-command runtime
→ create candidate job
→ apply the input run plan
→ reserve worst-case future maxCount for all possible job output
→ commit active job atomically

ready blueprint completion
→ detach completed job and reservations in the candidate
→ create a new target identity at the exact blueprint cell
→ resolve and place top-level by-products
→ release buffered owner inputs and remove blueprint identity
→ discard queue bound to the vanished blueprint
→ return reservations through standard placement
→ validate and commit everything atomically
```

Any placement or return failure leaves the original ready job, blueprint, queue, buffered inputs, reservations, and world unchanged. Deterministic completion randomness makes retries stable.

## Verification

Covered by focused and flow tests for:

- target-only completion with a new identity at the exact owner location;
- target plus top-level by-products plus reservation return;
- by-product blockage rollback;
- final reservation blockage rollback after target and by-products were provisionally created;
- singleton target reservation across concurrent blueprint jobs;
- direct drop, direct spawn, and direct quantity replacement respecting promised capacity;
- quantity range `1..5` reserving five;
- weighted and chance worst-case calculation;
- FIFO successor remaining blocked without disappearing or overtaking;
- stale queue removal at replacement boundary;
- active construction state round-trip.

Repository gate at closeout:

- format passed;
- dependency graph passed with 516 modules and 2138 dependencies;
- source and test typechecks passed;
- 137 test files and 374 tests passed across four deterministic Vitest shards;
- game validation passed;
- `git diff --check` passed.

## Historical cleanup

Deleted `src/v0/producer/applyGameActionProducerFx.blueprint.test.ts` after its max-count and reservation scenarios were captured by current flow tests.

The shared historical world replacement diagnostics remain assigned to task 17 because they also describe non-blueprint corruption checks. Blueprint detail, animation, and audio material remains linked through coverage to tasks 13–15.
