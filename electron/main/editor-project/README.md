# Editor persistence map

One GUI Electron main or Node CLI process owns the physical Editor project repository. The portable current tree is canonical; renderer Atoms, form drafts, object URLs, Build descriptors and the Editor Board are projections.

[`CONFIG.md`](../../../CONFIG.md) owns portable layout and authoring semantics. [`VERSION.md`](../../../VERSION.md) owns external payload compatibility. This README maps ownership, I/O and replacement lifecycle.

## Boundaries

| Concern | Owner | Start at |
| --- | --- | --- |
| Project model, failures and repository contract | `src/project-authoring` | [`../../../src/project-authoring/service/ProjectRepository.ts`](../../../src/project-authoring/service/ProjectRepository.ts) |
| Pure renderer/main transport contract | `electron/contract/editor` | [`../../contract/editor/EditorProjectTransport.ts`](../../contract/editor/EditorProjectTransport.ts) |
| Renderer repository proxy and response validation | `src/project-authoring` | [`../../../src/project-authoring/fx/createElectronProjectRepositoryFx.ts`](../../../src/project-authoring/fx/createElectronProjectRepositoryFx.ts) |
| Filesystem repository composition | `src/project-authoring/filesystem` | [`../../../src/project-authoring/filesystem/fx/createFilesystemEditorProjectRepositoryFx.ts`](../../../src/project-authoring/filesystem/fx/createFilesystemEditorProjectRepositoryFx.ts) |
| Discovery, create/open/refresh/delete | `src/project-authoring/filesystem` | [`../../../src/project-authoring/filesystem/fx/createLifecycleOperationsFx.ts`](../../../src/project-authoring/filesystem/fx/createLifecycleOperationsFx.ts) |
| Config, Item and Resource commits | `src/project-authoring/filesystem` | [`../../../src/project-authoring/filesystem/fx/createCommitOperationsFx.ts`](../../../src/project-authoring/filesystem/fx/createCommitOperationsFx.ts) |
| Notes and Build | Their `src/*` contracts plus Project Authoring filesystem operations | `src/project-authoring/filesystem/fx/create*OperationsFx.ts` |
| Current-tree lock, journal and recovery | `src/project-authoring/filesystem` + mechanical `filesystem-write` | [`../../../src/project-authoring/filesystem/fx/writeProjectFileSetFx.ts`](../../../src/project-authoring/filesystem/fx/writeProjectFileSetFx.ts), [`../../../src/project-authoring/filesystem/fx/recoverProjectFileTransactionFx.ts`](../../../src/project-authoring/filesystem/fx/recoverProjectFileTransactionFx.ts) |
| IPC authorization and dispatch | `electron/main/editor-project` | [`ipc/registerEditorProjectIpcFx.ts`](ipc/registerEditorProjectIpcFx.ts) |
| CLI MCP lifecycle | `src/arkini-cli` | [`../../../src/arkini-cli/command/EditorMcpCommand.ts`](../../../src/arkini-cli/command/EditorMcpCommand.ts) |
| Mounted renderer projection and replacement guard | `src/authoring-session` | [`../../../src/authoring-session/fx/refreshEditorProjectFx.ts`](../../../src/authoring-session/fx/refreshEditorProjectFx.ts) |

The filesystem repository implements product capabilities; it does not own their schemas or renderer presentation. Renderer code sees no physical path, file handle, native object or mutable repository state.

## Dependency shape

This island has deliberate cross-process and lifecycle coupling:

- `project-authoring/filesystem → project-authoring` implements the repository contract and consumes Project schemas/errors.
- `electron/main/editor-project → project-authoring + electron/contract/editor` owns GUI IPC authorization and dispatch, not filesystem policy.
- `project-authoring → electron/contract/editor` is the renderer transport edge. It cannot import Electron main.
- `authoring-session ↔ project-authoring` is renderer lifecycle composition: session reads and republishes repository results; product operations publish canonical commits into the mounted projection.
- `project-authoring ↔ project-note` and authoring products cross at exact repository or presentation contracts. No root is a generic Editor superdomain.
- `filesystem-write` stays mechanical and imports none of its product consumers. The Editor repository supplies path ownership, file sets, serialization and error meaning.
- MCP calls the same Project Repository capabilities and revision checks. It never owns a second project store or bypass mutation path.
- `arkini-cli editor mcp <projectId>` selects one catalog project and composes the same Node-compatible filesystem MCP storage, HTTP server, tools and optional ngrok tunnel as the GUI Editor without starting Electron.

The top-level domain graph is cyclic; the process authority is not. Physical mutation terminates in this filesystem repository.

## Repository state

One process-lifetime repository owns:

- A serialized operation semaphore.
- The catalog of managed/external roots and discovery metadata.
- One in-memory `ProjectState` per opened project, derived from disk.
- Current Project, Note and Build operations.

The catalog never copies canonical project identity or mutable project fields. `game.json.meta.id` remains project/package identity. Invalid catalog entries stay independently visible with their concrete error until explicitly dismissed by exact root. Dismissal preserves files and persists in the catalog so managed discovery does not restore the row. Explicitly reopening a repaired folder clears dismissal and retains its catalog ownership.

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

Unowned, ambiguous, escaped or missing durable artifacts fail closed. Recovery restores an old-or-new complete portable tree; it never guesses a partial state. Item/config commits reconcile Note links against the final item UIDs; resource rename/delete rewrites Note resource IDs. Each operation includes affected Note files in the same transaction, and a failed Note rewrite rolls back the project tree plus every earlier Note rewrite before repository state is published. Single-file mechanics belong to `src/filesystem-write`; the multi-file journal belongs here.

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

Assets **Optimize** follows this same write path. The renderer passes the exact resource IDs selected by the current Assets search and usage filter. Main holds the repository semaphore while it losslessly normalizes only those current `assets/` and `resources/` PNGs, then publishes all changed bytes through one current-tree transaction and one fresh Project projection. The same repository operation can optimize one resource by receiving one ID. It does not invoke Arkpack Build or its 256 px Item-artwork bake.
The filesystem operation reports completed PNGs over a dedicated renderer event. One project-scoped, process-lifetime Atom owns the command and its latest progress, so route changes neither interrupt optimization nor erase its pending or settled presentation.

Hard Refresh and project replacement use a stronger boundary:

```text
acquire replacement admission
→ await repository idle
→ release current Editor Board Game
→ replace/reread canonical disk state
→ discard renderer drafts
→ publish one fresh Project
→ recreate Editor Board Game
```

Project Write Admission rejects replacement during an already pending route transition, reading current router state before taking the lock. Once acquired, it excludes ordinary writes and route changes until this replacement handshake finishes, including hard Refresh. Navigation reads the live admission before and after any asynchronous draft decision, so replacement cannot discard drafts or resynchronize a Board belonging to a successor route.

An identity rename first resolves the current draft leave decision, then holds the same admission authority from its revision-pinned write through navigation to the new project ID. This excludes replacement and unrelated navigation; ordinary writes keep repository revision checks. Only the rename's terminal route bypasses the navigation guard while its lease is live. Failure releases admission and remains visible in the rename dialog.

External changes are ignored while mounted. Refresh is explicit; there is no watcher, merge, repair mode, partial load or second renderer store.

## Output version and Build admission

Output version settings live as structured `game.json.version` fields. Ordinary authoring preserves them. Build saves a validated choice without changing authoring revision, then builds that exact saved version and content revision. Saving and updating the renderer metadata settle together even when compilation fails; this metadata update never publishes or resets the live Board.

Build and CLI pack verify the current source set and bytes before publishing the staged artifact. The build descriptor carries its actual formatted version, revision and content hash. Installation derives compatibility from that artifact, not from mutable output settings. There are no history, object-store or scenario operations.

## IPC and MCP

- Main validates the registered Arkini renderer, exact main frame, trusted URL and request schema before dispatch.
- Renderer validates every result again through the pure transport contract.
- Repository failure is serialized as the exact project operation plus bounded message, not leaked native state.
- Editor persistence may fail independently without preventing gameplay boot; Editor channels report unavailable state.
- MCP uses the same schema, expected revision, reference checks and repository mutation operations. Note edits, relationship removal and deletes use the exact `updatedAtMs` returned by the last read as their freshness token. Notes MCP collection composes item UID, asset resource ID and content filters before pagination; collection/detail resolve current item and asset presentation.
- Successful MCP mutation emits invalidation; the renderer rereads canonical repository state. Notes also refresh after a local project revision changes. They preserve a local draft across refresh, reject a stale save and leave edit mode when its note disappears from the active global/item/asset collection.
- GUI Editor and CLI MCP access are mutually unsupported by contract. No process lock or runtime detection enforces that restriction.

## Changing this island?

Likely affected:

- Project Repository contract, Electron transport schemas and IPC tests.
- Catalog/open/refresh/delete lifecycle and managed-versus-external ownership.
- Current-tree transaction, recovery and native filesystem portability tests.
- Authoring Session replacement, unsaved changes and Editor Board teardown/recreation.
- MCP mutation and invalidation when a repository command changes.
- Notes or Build when their repository operation or portable file set changes.
- Build/CLI admission when saved source or output metadata changes.

Usually not affected:

- Installed-game Runtime saves and recovery; they use separate Game Persistence ownership.
- Gameplay Runtime, Tick and production behavior.
- Flow/Estimate algorithms and Pixi presentation.
- Arkpack catalog selection unless Build/install or portable source semantics change.
