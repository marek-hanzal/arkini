# Editor persistence map

One GUI Electron main or Node CLI process owns the physical Editor project repository. The portable current tree is canonical; renderer Atoms, form drafts, versioned Resource URLs, Build descriptors and the Editor Board are projections.

[`CONFIG.md`](../../../CONFIG.md) owns portable layout and authoring semantics. [`VERSION.md`](../../../VERSION.md) owns external payload compatibility. This README maps ownership, I/O and replacement lifecycle.

## Boundaries

| Concern | Owner | Start at |
| --- | --- | --- |
| Project model, failures and repository contract | `src/project-authoring` | [`../../../src/project-authoring/service/ProjectRepository.ts`](../../../src/project-authoring/service/ProjectRepository.ts) |
| Pure renderer/main transport contract | `electron/contract/editor` | [`../../contract/editor/EditorProjectTransport.ts`](../../contract/editor/EditorProjectTransport.ts) |
| Renderer repository proxy and response validation | `src/project-authoring` | [`../../../src/project-authoring/fx/createElectronProjectRepositoryFx.ts`](../../../src/project-authoring/fx/createElectronProjectRepositoryFx.ts) |
| Filesystem repository composition | `src/project-authoring/filesystem` | [`../../../src/project-authoring/filesystem/fx/createFilesystemEditorProjectRepositoryFx.ts`](../../../src/project-authoring/filesystem/fx/createFilesystemEditorProjectRepositoryFx.ts) |
| Discovery, create/open/refresh/delete | `src/project-authoring/filesystem` | [`../../../src/project-authoring/filesystem/fx/createLifecycleOperationsFx.ts`](../../../src/project-authoring/filesystem/fx/createLifecycleOperationsFx.ts) |
| Streamed Arkpack import | `src/arkpack-admission` + `src/project-authoring/filesystem` | [`../../../src/arkpack-admission/fx/extractArkpackFileFx.ts`](../../../src/arkpack-admission/fx/extractArkpackFileFx.ts), [`../../../src/project-authoring/filesystem/fx/createFilesystemEditorProjectRepositoryFx.ts`](../../../src/project-authoring/filesystem/fx/createFilesystemEditorProjectRepositoryFx.ts) |
| Config, Item and Resource commits | `src/project-authoring/filesystem` | [`../../../src/project-authoring/filesystem/fx/createCommitOperationsFx.ts`](../../../src/project-authoring/filesystem/fx/createCommitOperationsFx.ts) |
| Notes and Build | Their `src/*` contracts plus Project Authoring filesystem operations | `src/project-authoring/filesystem/fx/create*OperationsFx.ts` |
| Ordered current-tree writes | `src/project-authoring/filesystem` + mechanical `filesystem-write` | [`../../../src/project-authoring/filesystem/fx/writeProjectFileSetFx.ts`](../../../src/project-authoring/filesystem/fx/writeProjectFileSetFx.ts) |
| IPC authorization and dispatch | `electron/main/editor-project` | [`ipc/registerEditorProjectIpcFx.ts`](ipc/registerEditorProjectIpcFx.ts) |
| CLI MCP lifecycle | `src/arkini-cli` | [`../../../src/arkini-cli/command/EditorMcpCommand.ts`](../../../src/arkini-cli/command/EditorMcpCommand.ts) |
| Mounted renderer projection and replacement guard | `src/authoring-session` | [`../../../src/authoring-session/fx/refreshEditorProjectFx.ts`](../../../src/authoring-session/fx/refreshEditorProjectFx.ts) |

The filesystem repository implements product capabilities; it does not own their schemas or renderer presentation. Renderer code sees no managed project path, file handle, native object or mutable repository state. A browser-selected Resource contributes only its native source path so Electron main can stream or copy it without an IPC byte payload.

## Dependency shape

This island has deliberate cross-process and lifecycle coupling:

- `project-authoring/filesystem → project-authoring` implements the repository contract and consumes Project schemas/errors.
- `electron/main/editor-project → project-authoring + electron/contract/editor` owns GUI IPC authorization and dispatch, not filesystem policy.
- `project-authoring → electron/contract/editor` is the renderer transport edge. It cannot import Electron main.
- `authoring-session ↔ project-authoring` is renderer lifecycle composition: session reads and republishes repository results; product operations publish canonical commits into the mounted projection.
- `project-authoring ↔ project-note` and authoring products cross at exact repository or presentation contracts. No root is a generic Editor superdomain.
- `filesystem-write` stays mechanical and imports none of its product consumers. The Editor repository supplies path ownership, file sets, serialization and error meaning.
- MCP calls the same Project Repository capabilities and revision checks. It never owns a second project store or bypass mutation path.
- Arkpack import is selected in Electron main, stream-extracted through the shared admission owner, and published as one managed portable project. Archive and resource bytes never cross renderer IPC.
- `serakki-cli editor mcp <projectId>` selects one catalog project and composes the same Node-compatible filesystem MCP storage, HTTP server, tools and optional ngrok tunnel as the GUI Editor without starting Electron.

The top-level domain graph is cyclic; the process authority is not. Physical mutation terminates in this filesystem repository.

## Repository state

One process-lifetime repository owns:

- A serialized operation semaphore.
- The catalog of managed/external roots and discovery metadata.
- One in-memory `ProjectState` per opened project, derived from disk.
- Current Project, Note and Build operations.

The catalog never copies canonical project identity or mutable project fields. `game.json.meta.id` remains project/package identity. Invalid catalog entries stay independently visible with their concrete error until explicitly dismissed by exact root. Dismissal preserves files and persists in the catalog so managed discovery does not restore the row. Explicitly reopening a repaired folder clears dismissal and retains its catalog ownership.

Managed roots may be deleted only by explicit managed-project deletion. External roots are edited in place; deletion only unregisters them. Arkini writes only allowlisted owned paths and preserves `.git` plus unrelated files.

## Current-tree writes

Writers share `editor.lock` and apply their already validated file plan in order.

```text
validate the authored result
→ compute exact changed writes and removals
→ replace each owned file
→ apply exact removals
→ verify the resulting metadata
→ publish the fresh Project projection
```

Path containment and owned-file validation remain immediate write contracts. There is no aggregate journal, rollback or crash recovery: a failed multi-file write may leave a partial tree, and reopening or repeating the operation is the repair path. Item/config commits reconcile Note links against the final item UIDs; resource rename/delete rewrites Note resource IDs in the same ordered plan. Single-file mechanics belong to `src/filesystem-write`.

## Resource bodies and incremental saves

Project projections carry resource ID, semantic type, byte size and a filesystem version token, never binary bodies or MIME. Open/Refresh reads file metadata. Item/config saves compare authored objects in memory and publish only changed JSON files plus the revision marker; they do not read, compare or serialize unchanged resource bodies. Resource import, replacement and explicit optimization supply only changed bodies or native source paths. Audio import keeps canonical Ogg/Opus unchanged or analyzes and streams one conversion at a time through a PATH-visible FFmpeg, trimming only silent edges without buffering the track in application memory. Renames read only the affected disk file. New resource metadata is verified after its ordered file write and before repository publication.

[`../../../src/project-authoring/filesystem/fx/writeProjectChangesFx.ts`](../../../src/project-authoring/filesystem/fx/writeProjectChangesFx.ts) owns those deltas; `writeProjectFilesFx` remains the complete initial create/import writer. Both use the same ordered write owner and Note reconciliation.

[`../../main/createEditorResourceProtocolFx.ts`](../../main/createEditorResourceProtocolFx.ts) serves requested versioned Resource URLs to image and audio consumers, including Editor Board and Music preview. It admits the URL against the registered resource, checks the contained path and streams the native file response without retaining its body in Electron main. Audio byte ranges are forwarded to the native file request. Unrequested resources are not opened; ordinary saves do not touch them. Replacement changes only that resource's URL. Build validates typed resources and streams their bodies into Arkpack, filtering Music to the explicit global playlist.

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

Item and Project saves, and Item deletion, finish admitted persistence and canonical publication even after their initiating UI leaves. Terminal save/delete navigation belongs only to the originating mounted entity session; late completion must not redirect a successor route. The exact UI owners are [`useFormController`](../../../src/item-authoring/ui/useFormController.ts), [`useProjectFormController`](../../../src/project-authoring/ui/useProjectFormController.ts), and [`useDeleteController`](../../../src/item-authoring/ui/useDeleteController.ts).

Resource **Optimize** follows this same write path. The renderer passes exact IDs and one semantic resource type. Main holds the repository semaphore while it processes one resource at a time through temporary files, then copies only changed files through one ordered write plan and publishes one fresh Project projection. Artwork is losslessly normalized; SFX is scanned for silent edges and re-encoded only when trimming is needed. Resource bodies are not accumulated in JavaScript memory. Optimization does not invoke Arkpack Build or its 256 px Artwork bake; general `image/` and Music resources are not optimized.
The filesystem operation reports completed resources over a dedicated renderer event. One project-scoped, process-lifetime Atom owns the command and its latest progress, so route changes neither interrupt optimization nor erase its pending or settled presentation.

Resource import checks the same renderer write admission and finishes an admitted native commit through Project publication even if its caller unmounts. Native source transfers serialize import preparation, conversion, commit and cleanup with source export. Idle waits acquire the transfer permit before awaiting repository operations, so Refresh also drains imports that have not reached their repository write yet.

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

Project Write Admission serializes accepted renderer writes. Save, delete, import and optimization commands hold admission through preparation, native commit and canonical publication; nested repository writes reuse the same fiber-owned admission. Refresh closes admission to new writes and drains accepted commands before rereading disk or discarding drafts. Waiting commands remain interruptible before execution, and revision checks still reject stale content.

Project Write Admission rejects replacement during an already pending route transition, reading current router state before taking the lock. Once acquired, it excludes ordinary writes and route changes until this replacement handshake finishes, including hard Refresh. Navigation reads the live admission before and after any asynchronous draft decision, so replacement cannot discard drafts or resynchronize a Board belonging to a successor route.

An identity rename first resolves the current draft leave decision, then holds the same admission authority from its revision-pinned write through navigation to the new project ID. This excludes replacement and unrelated navigation; ordinary writes keep repository revision checks. Only the rename's terminal route bypasses the navigation guard while its lease is live. Failure releases admission and remains visible in the rename dialog.

Project and Item save command state belongs to the mounted form, so explicit Refresh clears rejected-save errors together with the draft. Revision conflicts carry a typed `revision-conflict` transport reason; form banners offer the same hard Refresh as the sidebar. A failed disk refresh keeps the draft; Refresh failures are exposed in that banner.

Application diagnostics record successful IPC revision transitions (operation, project, expected/previous/result revision), MCP invalidation reads, and renderer Refresh start/completion/failure with its last stage. These records contain identities and revision tokens, never authored config or resource bodies.

External authored JSON and resource catalog changes are ignored while mounted. Requested image and audio bodies come directly from their registered disk paths; already mounted resource/Board projections are not watched and Refresh rebuilds them. Refresh is explicit; there is no watcher, merge, repair mode, partial load or second renderer store.

## Output version and Build admission

Output version settings live as structured `game.json.version` fields. Ordinary authoring preserves them. Build saves a validated choice without changing authoring revision, then builds that exact saved version and content revision. Saving and updating the renderer metadata settle together even when compilation fails; this metadata update never publishes or resets the live Board.

Build and CLI pack publish compiled JSON and validated staged resource bytes. Image and audio sources are copied before validation; Artwork is normalized into an owned staged file. Packing reads those same files, so external source edits cannot invalidate admitted resource lengths or bytes. Invalid staged resources leave the previous build intact. The build descriptor carries its actual formatted version, revision and content hash. Installation derives compatibility from that artifact, not from mutable output settings. There are no history, object-store or scenario operations.

## IPC and MCP

- Main validates the registered Arkini renderer, exact main frame, trusted URL and request schema before dispatch.
- Renderer validates every result again through the pure transport contract.
- Repository failure is serialized as the exact project operation plus bounded message, not leaked native state.
- Editor persistence may fail independently without preventing gameplay boot; Editor channels report unavailable state.
- MCP uses the same schema, expected revision, reference checks and repository mutation operations. Note edits, relationship removal and deletes use the exact `updatedAtMs` returned by the last read as their freshness token. Notes MCP collection composes Item UID, Resource ID and content filters before pagination; collection/detail resolve current Item and Resource presentation.
- Item line authoring reads one canonical line through `item_line_config` and replaces that complete line through `replace_item_line`; the owning item, sibling order and sibling lines remain untouched. Project validation can suppress warning details while retaining their count.
- Successful MCP mutation emits invalidation; the renderer rereads canonical repository state. Notes also refresh after a local project revision changes. They preserve a local draft across refresh, reject a stale save and leave edit mode when its note disappears from the active global, Item, or Artwork collection.
- GUI Editor and CLI MCP access are mutually unsupported by contract. No process lock or runtime detection enforces that restriction.

## Changing this island?

Likely affected:

- Project Repository contract, Electron transport schemas and IPC tests.
- Catalog/open/refresh/delete lifecycle and managed-versus-external ownership.
- Ordered current-tree writes and native filesystem portability tests.
- Authoring Session replacement, unsaved changes and Editor Board teardown/recreation.
- MCP mutation and invalidation when a repository command changes.
- Notes or Build when their repository operation or portable file set changes.
- Build/CLI admission when saved source or output metadata changes.

Usually not affected:

- Installed-game Runtime saves and recovery; they use separate Game Persistence ownership.
- Gameplay Runtime, Tick and production behavior.
- Flow/Estimate algorithms and Pixi presentation.
- Arkpack catalog selection unless Build/install or portable source semantics change.
