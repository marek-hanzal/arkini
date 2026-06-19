# v0 Dexie destructive refresh policy

Status: DONE
Date: 2026-06-18

## Decision

During the prototype phase Arkini does not migrate stored browser saves. If the persisted save/database shape is incompatible with the current runtime, the storage layer drops the Dexie save database and lets the runtime rebuild a fresh initial save.

This keeps storage simple while `GameSave` and `GameConfigLayer` are still actively changing. Anything smarter here would be fake product maturity wearing a tiny migration hat.

## Implementation

`DexieGameSaveStorage` now wipes the save database when `loadActiveSave` finds an existing active save with any of these incompatibilities:

- stale `schemaVersion`,
- stale `saveVersion`,
- mismatched `gameId`,
- mismatched `configHash`,
- invalid `GameSaveSchema` payload,
- parsed save with a mismatched `gameId`.

The storage also catches recoverable Dexie schema/open errors (`VersionError`, `UpgradeError`), wipes the database, recreates the Dexie wrapper and retries the operation.

`createPersistentGameRuntimeStore` already handles `null` from storage by creating an initial save and immediately persisting it, so the refresh flow is:

```txt
load active save
  compatible -> use it
  incompatible / corrupt / stale -> wipe Dexie DB -> return null
runtime creates initial save
persist initial save
```

## Tests

`DexieGameSaveStorage.test.ts` now verifies that config-hash mismatch, storage-schema mismatch and corrupt save payloads all return `null` and physically empty the Dexie `saves` table.

## Follow-up

Do not introduce per-version IndexedDB migrations until the save format is stable enough to justify preserving old user progress. For now, config/hash/schema mismatch means destructive refresh.
