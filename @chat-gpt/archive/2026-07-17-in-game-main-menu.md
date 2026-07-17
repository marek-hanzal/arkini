# In-game main menu

Issue #243 adds the first game-only Escape menu at the `GameShell` boundary.

## UI ownership

- `GameMenuProvider` exists only inside the active game shell and owns only `isOpen`, `open`, `close`, and `toggle`.
- One shell-level Escape listener toggles the overlay; board components own no competing keyboard listener.
- The menu is an overlay, not a route, global store, modal framework, or engine pause model.
- Focus enters the dialog, remains trapped while open, and returns to the prior game control or shell after close.

## Async command grammar

TanStack Query owns transient async UI command status only. It never owns runtime reads or gameplay truth.

Each command is standalone:

- `saveGameMutationOptions` + `useSaveGameMutation` directly run `Game.flushSaveFx`;
- `saveAndExitGameMutationOptions` + `useSaveAndExitGameMutation` request trusted native controlled close; the registered `GameOwner.shutdownFx` listener performs the final save;
- `hardResetGameMutationOptions` + `useHardResetGameMutation` directly run `GameOwner.hardResetFx`.

Every options declaration owns its complete stable key, native Fx connection, and retry setting. There is no central mutation-key object, callback injection, generic mutation factory, lifecycle hook, or project-specific mutation-state helper. Caller-specific navigation and menu close behavior remain in `GameMenu`.

## Lifecycle seams

- Save and exit is whole-application controlled shutdown, not route release. Native close waits for `GameOwner.shutdownFx`; failure rejects the mutation and leaves the same retryable Game and menu error. Route release remains a separate route-ownership operation.
- Failed owner state exposes the still-owned Game when one exists, without exposing the save key.
- Hard reset records private discard/clear progress. Retry resumes after the last successful destructive phase rather than repeating discard or clear.
- During a failed reset after disposal, the old Game may identify the mutation while the menu remains mounted, but it is never supplied through `GameProvider` as a live gameplay root.

## Validation

- formatting: 1,192 files;
- source, test, and Electron typechecks;
- game validation;
- production Electron build from generated official Arkpack;
- Dependency Cruiser: 968 modules / 4,266 dependencies;
- executable clean-checkout desktop build;
- focused menu/mutation/GameOwner tests;
- all ten permanent shards: 201 files / 632 tests.
