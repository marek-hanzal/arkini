# Runtime Effect runner/codeguide pass

Follow-up after `8413008b`, focused on applying the repo codeguide to the runtime startup/persistence slice instead of doing another random broom pass.

## Done

- Added `runGameRuntimeEffect` as the UI/runtime edge runner for runtime-facing Effect programs. React provider startup now runs `createPersistentGameRuntimeStoreFx` through that runner instead of calling a plain async orchestration helper.
- Converted `createPersistentGameRuntimeStore` into `createPersistentGameRuntimeStoreFx` and wrapped config load, config hashing, storage load/save, adapter creation, and store creation behind Effect programs.
- Added `GameRuntimeStartupError` tagged errors for startup/config/storage/adapter/store failures.
- Runtime persistence save retries now execute the storage save Effect through the named runtime runner instead of calling `Effect.runPromise` ad hoc.
- Added audit coverage that rejects `Effect.runPromise` in production source outside named runner files.
- Tightened logic-folder audits to reject top-level non-Fx pure values inside `src/**/logic` and converted debug inventory capacity readiness to an internal Fx boundary.
- Added startup failure tests that inspect the Effect failure channel and assert tagged storage load/save errors.

## Guardrails left in place

- `src/**/logic` exported values must be Fx boundaries.
- `src/**/logic` top-level values must be Fx boundaries or move out of `logic`.
- Production Effect programs must be run through explicit runner utilities, not sprinkled `Effect.runPromise` calls.
