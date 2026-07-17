# Essential GameOwner lifecycle

Review task #242 replaces the Queue/Intent/Deferred GameOwner scheduler with one explicit serialized resource lifecycle.

## Final shape

`createGameOwnerFx` owns:

- one current published `Game | undefined`;
- one private failed-save recovery identity;
- synchronous external-store state and isolated listeners;
- one Effect semaphore;
- direct `selectPackageFx`, `releaseRouteGameFx`, `shutdownFx`, `hardResetFx`, and `clearFailedSaveAndRetryFx` operations.

There is no generic command ADT, intent interpreter, latest-wins coalescing, Queue drain, checkpoint logic, or per-command Deferred list. Sequential package transitions are deliberate. Duplicate identical selections become no-ops after serialization.

## Ownership semantics

- Current final save completes before another package starts. A failed save retains the same frozen game for retry.
- Route release and application shutdown publish distinct failure operations. Only actual shutdown failure opens exit UI.
- Force close is native process policy. It does not run renderer best-effort discard.
- A bootstrap that never reaches publication is not a save owner and is finalized only through `disposeWithoutSaveFx`.
- Hard reset remains destructive discard → exact save clear → fresh bootstrap.
- Invalid-save identity stays private; public state exposes only `canRecoverSave`. A successful clear followed by bootstrap failure retries without clearing twice.

## Router binding

`GameOwnerProvider` lives at the stable root and declaratively maps the active `/game/$packageId` match to package selection; non-game routes request route release. Effect cleanup is not used as a desired-game signal, so StrictMode does not manufacture `A → null → A`. `GameShell` renders only the published game matching its route package.
