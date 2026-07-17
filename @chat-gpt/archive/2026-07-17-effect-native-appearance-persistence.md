# Effect-native appearance persistence closeout

GitHub task: #238 under review epic #236.

## Result

- Electron appearance preferences now use one class-free `AppearancePreferences` capability created by `createFilesystemAppearancePreferencesFx`.
- Startup reads and trusted IPC writes share the same capability instance.
- Main-process persistence uses `@effect/platform` `FileSystem`; the previous `node:fs/promises` / `Effect.tryPromise` branch is removed.
- Renderer Promise adaptation remains only at the typed preload transport seam.
- Missing or malformed committed data still resolves to `dark`.
- Writes retain atomic `appearance.pending → appearance.theme` replacement and remove pending output after success or failure.
- A failed replacement preserves the previous committed preference.

## Validation

- format: 1,175 files
- source, test, and Electron typechecks passed
- game validation passed
- production Electron build passed
- Dependency Cruiser: 950 modules / 4,187 dependencies, no violations
- focused appearance / trusted IPC suite: 3 files / 6 tests
- ten permanent shards: 200 files / 629 tests

## Continuation

Review epic #236 remains open at P2. Continue with #240, then #242.
