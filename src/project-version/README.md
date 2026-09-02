# Project Versions map

Project Versions are immutable logical snapshots of one portable Editor project. `src/project-version` owns the model, compatibility policy and renderer checkout orchestration; Electron main owns physical object and publication I/O.

[`VERSION.md`](../../VERSION.md) owns external payload and compatibility guarantees. [`electron/main/editor-project/README.md`](../../electron/main/editor-project/README.md) maps the repository transaction boundary.

## Owners and entrypoints

| Concern | Owner | Start at |
| --- | --- | --- |
| Version graph, status, diff and repository capability | `src/project-version` | [`type/ProjectVersion.ts`](type/ProjectVersion.ts) |
| Semantic compatibility and Arkpack bump policy | `src/project-version` | [`fn/analyzeProjectCompatibilityFn.ts`](fn/analyzeProjectCompatibilityFn.ts), [`fn/bumpArkpackVersionFn.ts`](fn/bumpArkpackVersionFn.ts) |
| Version diff projection | `src/project-version` | [`fn/createProjectVersionDiffFn.ts`](fn/createProjectVersionDiffFn.ts) |
| Renderer history/status read | `src/project-version` | [`fx/readProjectVersionHistoryFx.ts`](fx/readProjectVersionHistoryFx.ts) |
| Renderer checkout handshake | `src/project-version` | [`fx/checkoutProjectVersionFx.ts`](fx/checkoutProjectVersionFx.ts) |
| Snapshot planning and object writes | `electron/main/editor-project` | [`../../electron/main/editor-project/filesystem/fx/planVersionSnapshotFx.ts`](../../electron/main/editor-project/filesystem/fx/planVersionSnapshotFx.ts), [`../../electron/main/editor-project/filesystem/fx/createVersionSnapshotFx.ts`](../../electron/main/editor-project/filesystem/fx/createVersionSnapshotFx.ts) |
| Version create/list/diff/tag/checkout I/O | `electron/main/editor-project` | [`../../electron/main/editor-project/filesystem/fx/createVersionOperationsFx.ts`](../../electron/main/editor-project/filesystem/fx/createVersionOperationsFx.ts) |

## Dependency shape

- `project-version ↔ project-authoring` is a real cross-domain workflow, not recursive storage. The renderer uses the Project Repository capability to read and checkout Versions; project mutation uses Version compatibility policy and exposes the Version UI at product boundaries.
- `project-version → authoring-session + board-scenario` owns the terminal checkout handshake: release the Editor Board, replace persisted state, discard drafts, republish one fresh Project and recreate the Board session.
- Project Version schemas compose Game Value identity, Board Scenario names, content hashes, Game Version and Application Version contracts.
- Electron's snapshot planner consumes the full Game Config, Item, Resource and Scenario payloads to create immutable objects and the Version manifest. That is persistence behavior, not Version-schema composition.
- Electron main implements `ProjectVersionRepositoryService`; renderer code never sees paths, hashes as filesystem authority, locks or native objects.

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

Create:

```text
read one current project + scenario snapshot
→ plan canonical manifest and fingerprint
→ durably publish missing immutable objects (maximum concurrency 4)
→ write version descriptor + manifest
→ publish versions/head.json last
```

Readers cannot observe a new Version until `head.json` names it. Existing object bytes must match their content hash; an object collision or damaged artifact fails closed.

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

## Important invariants

- `versions/head.json` is the only publication point for Version visibility.
- Current project tree is canonical authoring state; Version objects are immutable history, not a second live store.
- Checkout uses the same recoverable current-tree transaction as ordinary project replacement.
- Fingerprints cover the complete logical versioned set, including scenario identity; metadata-only edits do not invent content changes.
- Matching-major reader admission comes from [`VERSION.md`](../../VERSION.md). Minor or patch never selects a reader or migration.

## Changing this island?

Likely affected:

- Project Repository capability and Electron transport.
- Current-tree transaction recovery and project locking.
- Board Scenario inclusion and Editor Board replacement.
- Unsaved-change confirmation, project publication and Version UI.
- External Version schemas and compatibility guarantees.

Usually not affected:

- Runtime autosave or installed-game save recovery.
- Config compiler and Arkpack packing when the versioned portable file set is unchanged.
- Notes, which deliberately remain outside Version snapshots.
- Flow/Estimate calculations except when checkout publishes a different Project revision.
