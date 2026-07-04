# Job removal boundary pass

Commit: `Centralize job removal boundaries`.

## What changed

Centralized direct producer/craft/item-spawn job removals behind named Fx boundaries:

- `src/producer/removeProducerJobFromSaveFx.ts`
- `src/craft/removeCraftJobFromSaveFx.ts`
- `src/job/removeItemSpawnJobFromSaveFx.ts`

Rewired producer completion, craft completion, and item-spawn processing to call those boundaries instead of deleting job-map entries inline.

## Guardrail

`audit:current` now rejects raw deletes against `producerJobs`, `craftJobs`, and `itemSpawnJobs` outside the named removal boundaries. `removeBoardItemRuntimeStateFx` remains the explicit cascade exception for board item removal cleanup.

## Rationale

Job-map deletion is low-level lifecycle mutation, not orchestration trivia. Keeping it behind named Fx boundaries makes completion paths easier to grep and prevents another parallel deletion route from appearing inside producer/craft/job flows.
