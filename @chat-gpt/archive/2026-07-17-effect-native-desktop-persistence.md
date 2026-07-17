# Effect-native desktop persistence

GitHub review task: #238 under #236.

## Problem closed

Arkpack and gameplay-save persistence crossed several competing execution grammars:

```text
bridge Effect
→ Promise storage class
→ preload Promise transport
→ Electron handler
→ Effect runtime
→ Promise filesystem repository class
```

Project-owned classes, repeated Effect/Promise conversion, constructor-owned repositories, and no-op `close()` contracts increased mental load without owning real resources.

## Stable contract

Promise exists only at the typed Electron IPC transport seam.

```text
renderer domain Effect
→ one typed preload transport adapter
→ ipcRenderer.invoke Promise
→ trusted Electron IPC handler
→ one ElectronMainRuntime execution
→ Effect-native filesystem capability
```

Arkini-owned reusable capabilities use object + factory composition:

- explicit same-name `*Fx` factory;
- narrow readonly object;
- concrete domain operations returning Effect;
- no project-owned persistence/storage/repository classes;
- no constructor-injected managers/services/adapters;
- no fake `close()` lifecycle where no resource is owned.

Package catalog and gameplay-save persistence remain separate domains.

## Renderer ownership

- `createArkpackStorageFx` adapts the typed preload Arkpack Promise transport exactly once through `invokeArkpackTransportFx`.
- `createGameSaveStorageFx` adapts the typed preload save Promise transport exactly once through `invokeGameSaveTransportFx`.
- Bridge operations consume `listFx`, `readFx`, `writeFx`, `removeFx`, and `clearFx` directly.
- `createGameFx` no longer wraps save calls or closes a fake storage resource.
- Injectable in-memory test capabilities use the same factory/object grammar.

## Electron-main ownership

- `createFilesystemArkpackCatalogFx` returns an Effect-native catalog over `@effect/platform` `FileSystem`.
- `createFilesystemGameSaveFilesFx` returns an Effect-native save capability over the same runtime service.
- Authorized IPC handlers run the selected Effect operation once through `ElectronMainRuntime`.
- Filesystem bytes are normalized to plain `Uint8Array` before crossing IPC.

Preserved behavior:

- imported catalog listing reads descriptor metadata only;
- exact Arkpack read fully validates package identity and payload;
- package install and removal remain isolated from saves;
- save write uses synced pending-file replacement and preserves the previous committed save after failure;
- save clear targets one exact `packageId + contentHash` key;
- product transport failures retain typed operation context.

## Architecture direction

Object + factory composition is an active project rule documented in `CODE_GUIDE.md` and current project memory. Do not add a bespoke source scanner merely to enforce the convention. Observable persistence behavior remains protected through focused integration tests; broader source-text architecture-test cleanup belongs to #240.

## Verification

- format: 1,180 files passed;
- Dependency Cruiser: 954 modules / 4,188 dependencies, zero violations;
- source, test, and Electron typechecks passed;
- game validation passed;
- production Electron build passed;
- focused persistence/bridge/IPC/game-owner suite: 12 files / 45 tests passed;
- permanent suite: all ten canonical shards passed, 211 files / 661 tests.

The aggregate sequential shard runner remains unreliable in this environment, so each canonical Vitest shard was executed as its own process.
