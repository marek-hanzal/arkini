# Persistence retry safety

Status: done in current block.

## Change

`connectGameRuntimeSavePersistence` now keeps the latest pending save after a storage write failure instead of dropping it before `onError`.

## Contract

- A failed write requeues the same save only when no newer pending save exists.
- A newer pending save wins over an older failed write.
- Normal debounced persistence retries a requeued failed save on the next debounce tick.
- `debounceMs <= 0` does not auto-loop retries.

## Files

- `src/v0/play/runtime/connectGameRuntimeSavePersistence.ts`
- `src/v0/play/runtime/connectGameRuntimeSavePersistence.test.ts`
