# Project Versions map

Project Versions are immutable logical snapshots of one portable Editor project. `src/project-version` owns the model, compatibility policy, portable object admission and renderer checkout orchestration; Project Authoring owns physical object writes and publication I/O.

[`VERSION.md`](../../VERSION.md) owns external payload and compatibility guarantees. [`electron/main/editor-project/README.md`](../../electron/main/editor-project/README.md) maps the repository transaction boundary.

## Owners and entrypoints

| Concern | Owner | Start at |
| --- | --- | --- |
| Version graph, status, diff and repository capability | `src/project-version` | [`type/ProjectVersion.ts`](type/ProjectVersion.ts) |
| Semantic compatibility and Arkpack bump policy | `src/project-version` | [`fn/analyzeProjectCompatibilityFn.ts`](fn/analyzeProjectCompatibilityFn.ts), [`fn/bumpArkpackVersionFn.ts`](fn/bumpArkpackVersionFn.ts) |
| Commit preview and strongest-bump projection | `src/project-version` | [`fn/createProjectVersionCommitPreviewFn.ts`](fn/createProjectVersionCommitPreviewFn.ts) |
| Version diff projection | `src/project-version` | [`fn/createProjectVersionDiffFn.ts`](fn/createProjectVersionDiffFn.ts) |
| Searchable current/Version comparison controls | `src/project-version` | [`ui/EditorVersionReferenceSelect.tsx`](ui/EditorVersionReferenceSelect.tsx), [`ui/useVersionComparison.ts`](ui/useVersionComparison.ts) |
| Renderer history/status read | `src/project-version` | [`fx/readProjectVersionHistoryFx.ts`](fx/readProjectVersionHistoryFx.ts) |
| Renderer checkout handshake | `src/project-version` | [`fx/checkoutProjectVersionFx.ts`](fx/checkoutProjectVersionFx.ts) |
| Immutable snapshot plan, object-store admission and saved-HEAD proof | `src/project-version` | [`fx/planVersionSnapshotFx.ts`](fx/planVersionSnapshotFx.ts), [`fx/readVersionSnapshotFx.ts`](fx/readVersionSnapshotFx.ts), [`fx/readCommittedProjectHeadFx.ts`](fx/readCommittedProjectHeadFx.ts) |
| Object writes and Version create/list/diff/tag/checkout I/O | `src/project-authoring/filesystem` | [`../project-authoring/filesystem/fx/createVersionSnapshotFx.ts`](../project-authoring/filesystem/fx/createVersionSnapshotFx.ts), [`../project-authoring/filesystem/fx/createVersionOperationsFx.ts`](../project-authoring/filesystem/fx/createVersionOperationsFx.ts) |

## Dependency shape

- `project-version ↔ project-authoring` is a real cross-domain workflow, not recursive storage. The renderer uses the Project Repository capability to read and checkout Versions; project mutation uses Version compatibility policy and exposes the Version UI at product boundaries.
- `project-version → authoring-session + board-scenario` owns the terminal checkout handshake: release the Editor Board, replace persisted state, discard drafts, republish one fresh Project and recreate the Board session.
- Project Version schemas compose Game Value identity, Board Scenario names, content hashes, Game Version and Application Version contracts.
- Project Version snapshot planning consumes the full Game Config, Item, Resource and Scenario payloads to derive immutable object values, hashes and the manifest without writing them.
- Project Authoring filesystem writes those objects and publishes commits. It implements `ProjectVersionRepositoryService`; renderer code never sees paths, hashes as filesystem authority, locks or native objects.

## Storage model

```text
versions/head.json
versions/<versionId>/version.json
versions/<versionId>/manifest.json
objects/<sha256>.json
objects/<sha256>.png
```

- A Version is a complete logical snapshot, not a property delta.
- The manifest addresses the game root, every Item, Asset, package resource and Board scenario by content hash.
- Content-addressed objects are immutable and deduplicated across Versions.
- Notes stay outside Versions. The live Editor Board is not persisted; explicit scenarios are.
- The directory owns `versionId`; payloads own only non-derivable metadata and hashes.

## Publication and checkout

Commit:

```text
read one saved current project + scenario snapshot and parent HEAD
→ diff current against parent and derive one strongest major/minor/noop result
→ apply the derived gameplay version; remove current scenarios for a major commit
→ plan canonical manifest and fingerprint
→ durably publish missing immutable objects (maximum concurrency 4)
→ write version descriptor + manifest
→ atomically publish changed current source/scenarios and versions/head.json
```

Readers and Build/CLI admission verify every object named by the published manifest and fail closed on missing, malformed or hash-mismatched bytes. Publication leaves an existing correct object untouched and atomically replaces a corrupted object from the canonical planned bytes before publishing the commit.

Ordinary non-identity Project, Item and Resource saves leave gameplay version and Version HEAD unchanged. A package-ID rename instead preserves gameplay version and current scenarios while removing the published Version HEAD because the renamed project is a different game namespace. Its next explicit commit becomes a new root; old immutable files remain unlisted. The first explicit commit preserves the current gameplay version; an Arkpack import creates that root commit automatically. Later commits bump once by the strongest classified change. Scenario-only commits keep the version, while a major commit deletes every current Board scenario after previewing that consequence. Version ID owns graph identity, so siblings and no-op parent/child commits may share one gameplay version.

Checkout:

```text
settle repository writes
→ compare expected current fingerprint
→ require explicit discard confirmation when dirty
→ release Editor Board session
→ atomically replace current tree + scenarios + Version head
→ discard renderer drafts
→ reread and publish one fresh Project
→ recreate Editor Board session
```

A failure before persisted replacement leaves the prior project authoritative. If persisted checkout succeeds but renderer refresh cannot recover, the renderer reloads rather than publishing a split projection.

Project Write Admission rejects checkout while an already accepted route transition is pending; the three renderer replacement entrypoints pass a live router-state reader into the synchronous acquisition. Once acquired, admission excludes route changes for the complete checkout handshake. The navigation guard reads that authority when a transition is requested and again after an asynchronous draft decision. MCP checkout therefore finishes disk and renderer replacement in its admitted project; its final history navigation runs after replacement admission is released.

## Important invariants

- `versions/head.json` is the only publication point for Version visibility.
- Current project tree is canonical authoring state; Version objects are immutable history, not a second live store.
- History refresh preserves explicit comparison references and an unchanged selected Version's tag draft; working-copy comparison follows the current HEAD until the user overrides its base.
- An accepted Version commit survives leaving its screen. Its completion may navigate only while that screen remains mounted at the originating router location.
- Checkout uses the same recoverable current-tree transaction as ordinary project replacement.
- Fingerprints cover the complete logical versioned set, including scenario identity; metadata-only edits do not invent content changes.
- Editor Build and CLI pack require the saved current tree to match the published HEAD exactly; validation may still inspect an uncommitted tree.
- Matching-major reader admission comes from [`VERSION.md`](../../VERSION.md). Minor or patch never selects a reader or migration.

## Changing this island?

Likely affected:

- Project Repository capability and Electron transport.
- Current-tree transaction recovery and project locking.
- Board Scenario inclusion and Editor Board replacement.
- Unsaved-change confirmation, project publication and Version UI.
- Editor Build and CLI pack admission when committed-HEAD identity changes.
- External Version schemas and compatibility guarantees.

Usually not affected:

- Runtime autosave or installed-game save recovery.
- Config compiler and Arkpack packing when the versioned portable file set is unchanged.
- Notes, which deliberately remain outside Version snapshots.
- Flow/Estimate calculations except when checkout publishes a different Project revision.
