# Editor persistence map

Electron main owns the physical Editor project repository. The portable current tree is canonical; renderer Atoms, form drafts, object URLs, Build descriptors and the Editor Board are projections.

[`CONFIG.md`](../../../CONFIG.md) owns portable layout and authoring semantics. [`VERSION.md`](../../../VERSION.md) owns external payload compatibility. This README maps ownership, I/O and replacement lifecycle.

## Boundaries

| Concern | Owner | Start at |
| --- | --- | --- |
| Project model, failures and repository contract | `src/project-authoring` | [`../../../src/project-authoring/service/ProjectRepository.ts`](../../../src/project-authoring/service/ProjectRepository.ts) |
| Pure renderer/main transport contract | `electron/contract/editor` | [`../../contract/editor/EditorProjectTransport.ts`](../../contract/editor/EditorProjectTransport.ts) |
| Renderer repository proxy and response validation | `src/project-authoring` | [`../../../src/project-authoring/fx/createElectronProjectRepositoryFx.ts`](../../../src/project-authoring/fx/createElectronProjectRepositoryFx.ts) |
| Main repository composition | `electron/main/editor-project` | [`filesystem/fx/createFilesystemEditorProjectRepositoryFx.ts`](filesystem/fx/createFilesystemEditorProjectRepositoryFx.ts) |
| Discovery, create/open/refresh/delete | `electron/main/editor-project` | [`filesystem/fx/createLifecycleOperationsFx.ts`](filesystem/fx/createLifecycleOperationsFx.ts) |
| Config, Item and Resource commits | `electron/main/editor-project` | [`filesystem/fx/createCommitOperationsFx.ts`](filesystem/fx/createCommitOperationsFx.ts) |
| Board Scenarios, Notes, Version commit I/O and Build | Their `src/*` contracts plus Electron repository operations | `filesystem/fx/create*OperationsFx.ts` |
| Current-tree lock, journal and recovery | `electron/main/editor-project` + mechanical `filesystem-write` | [`filesystem/fx/writeProjectFileSetFx.ts`](filesystem/fx/writeProjectFileSetFx.ts), [`filesystem/fx/recoverProjectFileTransactionFx.ts`](filesystem/fx/recoverProjectFileTransactionFx.ts) |
| IPC authorization and dispatch | `electron/main/editor-project` | [`ipc/registerEditorProjectIpcFx.ts`](ipc/registerEditorProjectIpcFx.ts) |
| Mounted renderer projection and replacement guard | `src/authoring-session` | [`../../../src/authoring-session/fx/refreshEditorProjectFx.ts`](../../../src/authoring-session/fx/refreshEditorProjectFx.ts) |
| Version semantics, snapshot planning, saved-HEAD proof and checkout handshake | `src/project-version` | [`../../../src/project-version/README.md`](../../../src/project-version/README.md) |

Electron main implements product capabilities; it does not own their schemas or renderer presentation. Renderer code sees no physical path, file handle, native object or mutable repository state.

## Dependency shape

This island has deliberate cross-process and lifecycle coupling:

- `electron/main/editor-project → project-authoring` implements the repository contract and consumes Project schemas/errors.
- `project-authoring → electron/contract/editor` is the renderer transport edge. It cannot import Electron main.
- `authoring-session ↔ project-authoring` is renderer lifecycle composition: session reads and republishes repository results; product operations publish canonical commits into the mounted projection.
- `project-authoring ↔ project-version`, `board-scenario`, `project-note` and authoring products cross at exact repository or presentation contracts. No root is a generic Editor superdomain.
- `project-version → game-config-compiler + game-config-resource` proves a saved portable tree matches its published HEAD for Build/CLI admission. Electron main supplies physical commit and object publication.
- `filesystem-write` stays mechanical and imports none of its product consumers. The Editor repository supplies path ownership, file sets, serialization and error meaning.
- MCP calls the same Project Repository capabilities and revision checks. It never owns a second project store or bypass mutation path.

The top-level domain graph is cyclic; the process authority is not. Physical mutation terminates in this Electron-main repository.

## Repository state

One process-lifetime repository owns:

- A serialized operation semaphore.
- The catalog of managed/external roots and discovery metadata.
- One in-memory `ProjectState` per opened project, derived from disk.
- Current Project, Scenario, Note, Version and Build operations.

The catalog never copies canonical project identity or mutable project fields. `game.json.meta.id` remains project/package identity. Invalid catalog entries stay independently visible with their concrete error.

Managed roots may be deleted only by explicit managed-project deletion. External roots are edited in place; deletion only unregisters them. Arkini writes only allowlisted owned paths and preserves `.git` plus unrelated files.

## Current-tree transaction

All readers, writers and recovery share `editor.lock`.

```text
recover any prior journal
→ validate root, containment and target types
→ compute exact changed writes and removals
→ write and sync transaction record
→ preserve replaced/removed bytes in the journal
→ mark writing
→ atomically replace each owned file
→ apply exact removals
→ mark committed
→ recover/clean the exact journal
```

Unowned, ambiguous, escaped or missing durable artifacts fail closed. Recovery restores an old-or-new complete portable tree; it never guesses a partial state. Single-file mechanics belong to `src/filesystem-write`; the multi-file journal belongs here.

## Renderer replacement flow

Ordinary product save:

```text
capture expected revision
→ validate complete owning entity
→ serialize through ProjectWriteAdmission and repository semaphore
→ commit disk
→ return one ProjectCommit
→ publish it to the still-mounted project Atom
```

Hard Refresh, Version checkout, project replacement and scenario restore use a stronger boundary:

```text
acquire replacement admission
→ await repository idle
→ release current Editor Board Game
→ replace/reread canonical disk state
→ discard renderer drafts
→ publish one fresh Project
→ recreate Editor Board Game
```

External changes are ignored while mounted. Refresh is explicit; there is no watcher, merge, repair mode, partial load or second renderer store.

## Version commit and Build admission

Ordinary Project, Item and Resource commits update the canonical current tree but leave gameplay version and Version HEAD unchanged. Version preview compares that saved tree with the current HEAD and derives exactly one strongest major/minor/noop result.

Electron main publishes missing immutable objects and the Version descriptor/manifest before atomically applying any derived gameplay-version/scenario change together with `versions/head.json`. A major commit removes current scenarios; scenario-only commits keep the gameplay version. The first explicit commit preserves the starting version, while Arkpack import may create the root commit during project creation.

Editor Build and CLI pack both reread the saved portable tree and require its fingerprint plus gameplay version to match the published HEAD. Validation remains allowed on an uncommitted working tree.

## IPC and MCP

- Main validates the registered Arkini renderer, exact main frame, trusted URL and request schema before dispatch.
- Renderer validates every result again through the pure transport contract.
- Repository failure is serialized as the exact project operation plus bounded message, not leaked native state.
- Editor persistence may fail independently without preventing gameplay boot; Editor channels report unavailable state.
- MCP uses the same schema, expected revision, reference checks and repository mutation operations. Successful external mutation emits invalidation; renderer rereads disk.

## Changing this island?

Likely affected:

- Project Repository contract, Electron transport schemas and IPC tests.
- Catalog/open/refresh/delete lifecycle and managed-versus-external ownership.
- Current-tree transaction, recovery and native filesystem portability tests.
- Authoring Session replacement, unsaved changes and Editor Board teardown/recreation.
- MCP mutation and invalidation when a repository command changes.
- Versions, Scenarios, Notes or Build only when their repository operation or portable file set changes.
- Version commit preview/publication and Build/CLI admission when HEAD identity changes.

Usually not affected:

- Installed-game Runtime saves and recovery; they use separate Game Persistence ownership.
- Gameplay Runtime, Tick and production behavior.
- Flow/Estimate algorithms and Pixi presentation.
- Arkpack catalog selection unless Build/install or portable source semantics change.
