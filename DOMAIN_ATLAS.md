# Arkini domain atlas

This is an on-demand navigation index, not another global semantic contract. Search for the exact domain, then open its local map or the smallest owning contract. The source graph and [`.dependency-cruiser.cjs`](.dependency-cruiser.cjs) remain the authority for exact imports.

## How to read an edge

| Label | Meaning |
| --- | --- |
| behavior | The importer executes a function, Effect, service, Atom, component, or other live operation from the target. |
| contract | The importer composes a runtime schema, error, constant, or other value-level contract from the target. |
| type | The import is erased by TypeScript. It can still expose ownership friction, but adds no runtime dependency. |

Top-level domains are ownership labels, not a DAG. Dependency Cruiser rejects concrete module cycles, while different files in two domains may legally import in both directions. Never infer `upstream` from directory names alone; inspect the edge kind and exact modules.

The densest islands have local maps:

| Island | Domains | Map |
| --- | --- | --- |
| Runtime and session | Runtime, events, Tick, persistence, playable and installed Game | [`src/game-runtime/README.md`](src/game-runtime/README.md) |
| Production | Action, condition, input, line, job, delivery and output | [`src/production-line/README.md`](src/production-line/README.md) |
| Retained scene | Game Scene, Tile Presentation, Rendering, Motion and Interaction | [`src/game-scene/README.md`](src/game-scene/README.md) |
| Authored config | Foundational values, completed Config, source, resources, diagnostics, validation and compiler | [`src/game-config/README.md`](src/game-config/README.md) |
| Flow and Estimate | Acquisition graph, layout, Canvas and optimistic analysis | [`src/estimate/README.md`](src/estimate/README.md) |
| Versions | Immutable logical snapshots, commit compatibility and checkout | [`src/project-version/README.md`](src/project-version/README.md) |
| Editor persistence | Project Authoring filesystem repository, transactions, renderer projection, MCP and Electron IPC | [`electron/main/editor-project/README.md`](electron/main/editor-project/README.md) |

## Change impact

The tables answer “I need behavior X; where do I start?” Each local map also answers the reverse question: “I am changing owner Y; what is likely affected?”

Use both kinds of evidence:

- Exact reverse imports identify current mechanical consumers and can be collected from the source graph.
- The local `Changing this island?` section records semantic blast radius and explicit non-impact that imports cannot prove.
- A schema, persisted field, event or public capability change overrides the usual non-impact defaults; follow the changed contract to every reader and writer.

The Atlas deliberately does not duplicate exhaustive `used by` lists. A mirrored hand-maintained graph would be large, noisy and stale; source owns exact edges, while these maps own navigation and meaning.

### Automation boundary

A future read-only domain-impact command should derive direct consumers, mutual domain pairs and edge kinds from the TypeScript graph, then print the source modules that justify each edge. It may use grammar paths such as `schema/`, `error/` and `constant/` to separate value contracts from executable imports, but mixed imports must be classified per binding.

Do not commit its exhaustive output into this Atlas. Generated edges answer “who imports this now?”; local maps still own role, invariants, semantic blast radius and “usually not affected,” because those facts cannot be inferred safely from imports alone.

## Gameplay truth and execution

| Domain | Role | First read |
| --- | --- | --- |
| `game-runtime` | Canonical live Runtime, validation, identity and atomic publication | [`src/game-runtime/README.md`](src/game-runtime/README.md) |
| `game-event` | Ordered facts emitted by an already committed transition | [`src/game-event/schema/GameEventSchema.ts`](src/game-event/schema/GameEventSchema.ts) |
| `simulation-time` | Immutable fixed simulation quantum | [`src/simulation-time/constant/SimulationStepMs.ts`](src/simulation-time/constant/SimulationStepMs.ts) |
| `game-tick` | Fixed-step budget, replay and lifecycle advancement | [`src/game-tick/fx/advanceRuntimeStepFx.ts`](src/game-tick/fx/advanceRuntimeStepFx.ts) |
| `temporary-item` | Temporary duration advancement and expiry transition | [`src/temporary-item/fx/attemptTemporaryItemExpiryFx.ts`](src/temporary-item/fx/attemptTemporaryItemExpiryFx.ts) |
| `game-persistence` | Serializable State, hydration, save codec and autosave | [`src/game-persistence/schema/StateSchema.ts`](src/game-persistence/schema/StateSchema.ts) |
| `game-session` | One Runtime/Tick/save execution scope and fail-stop lifecycle | [`src/game-session/fx/createGameSessionFx.ts`](src/game-session/fx/createGameSessionFx.ts) |
| `playable-game` | Package-independent live Game capability and resource URLs | [`src/playable-game/type/PlayableGame.ts`](src/playable-game/type/PlayableGame.ts) |
| `installed-game` | Arkpack/save bootstrap, leases, diagnostics and finalization | [`src/installed-game/fx/createGameEngineResourceServiceFx.ts`](src/installed-game/fx/createGameEngineResourceServiceFx.ts) |
| `game-incident` | Failed-session diagnostic model and text rendering | [`src/game-incident/fx/readGameIncidentTextFx.ts`](src/game-incident/fx/readGameIncidentTextFx.ts) |
| `game-start` | Initial placement plan and atomic empty-runtime start | [`src/game-start/fx/planStartFx.ts`](src/game-start/fx/planStartFx.ts) |
| `item-revision` | Opaque live Item revision and stale-write rejection | [`src/item-revision/fx/assertRevisionFx.ts`](src/item-revision/fx/assertRevisionFx.ts) |
| `item-definition` | Immutable authored Item vocabulary and selectors | [`src/item-definition/schema/ItemSchema.ts`](src/item-definition/schema/ItemSchema.ts) |
| `item-location` | Runtime locations, grid claims, distances and location rejection | [`src/item-location/schema/LocationSchema.ts`](src/item-location/schema/LocationSchema.ts) |
| `item-resolution` | Canonical configured Item lookup | [`src/item-resolution/fx/resolveItemFx.ts`](src/item-resolution/fx/resolveItemFx.ts) |
| `item-query` | Authored query contracts and pinned-Runtime execution | [`src/item-query/fx/queryFx.ts`](src/item-query/fx/queryFx.ts) |
| `item-placement` | Scope-aware stack, spawn and existing-item placement | [`src/item-placement/fx/planScopePlacementFx.ts`](src/item-placement/fx/planScopePlacementFx.ts) |
| `item-merge` | Directional merge admission and atomic lifecycle | [`src/item-merge/fx/mergeItemsFx.ts`](src/item-merge/fx/mergeItemsFx.ts) |
| `item-state-isolation` | Identity-bound owner isolation and remainder placement | [`src/item-state-isolation/fx/isolateGridStatefulOwnerTransitionFx.ts`](src/item-state-isolation/fx/isolateGridStatefulOwnerTransitionFx.ts) |
| `item-interaction` | Drop preview/commit, release, split, removal and click policy | [`src/item-interaction/fx/dropItemFx.ts`](src/item-interaction/fx/dropItemFx.ts) |
| `space-action` | Space activation, charge settlement and navigation | [`src/space-action/fx/activateSpaceItemFx.ts`](src/space-action/fx/activateSpaceItemFx.ts) |

[`GAME.MD`](GAME.MD) owns gameplay meaning. The Runtime map owns state and lifecycle navigation.

## Production

| Domain | Role | First read |
| --- | --- | --- |
| `production-condition` | Authored runtime condition evaluation | [`src/production-condition/fx/whenFx.ts`](src/production-condition/fx/whenFx.ts) |
| `production-output` | Output/drop/roll contracts and resolution | [`src/production-output/fx/outputFx.ts`](src/production-output/fx/outputFx.ts) |
| `production-action` | Immediate action admission, inputs and charge settlement | [`src/production-action/fx/resolveActionRuleFx.ts`](src/production-action/fx/resolveActionRuleFx.ts) |
| `production-input` | Material planning, buffers, autofill and withdrawal | [`src/production-input/fx/resolveInputRunFx.ts`](src/production-input/fx/resolveInputRunFx.ts) |
| `production-line` | Line definitions, rules, reads and run planning | [`src/production-line/README.md`](src/production-line/README.md) |
| `production-job` | Queue, reservation, start, completion and cancellation | [`src/production-job/fx/enqueueLineFx.ts`](src/production-job/fx/enqueueLineFx.ts) |
| `production-delivery` | Outbound allocation, travel, reconciliation and settlement | [`src/production-delivery/fx/advanceDeliveriesRuntimeFx.ts`](src/production-delivery/fx/advanceDeliveriesRuntimeFx.ts) |
| `production-authoring` | Shared Line/Input/Rule/Output Editor controls | [`src/production-authoring/ui/LineFields.tsx`](src/production-authoring/ui/LineFields.tsx) |

## Gameplay presentation

| Domain | Role | First read |
| --- | --- | --- |
| `tile-presentation` | Semantic actor values, feedback and motion intents | [`src/tile-presentation/fx/readTileActorsFx.ts`](src/tile-presentation/fx/readTileActorsFx.ts) |
| `tile-rendering` | Pixi application, native actors, visuals and animation channels | [`src/tile-rendering/fx/createApplicationOwnerFx.ts`](src/tile-rendering/fx/createApplicationOwnerFx.ts) |
| `tile-motion` | Cue lanes, choreography, magnetic response and playback | [`src/tile-motion/fx/createMotionRuntimeFx.ts`](src/tile-motion/fx/createMotionRuntimeFx.ts) |
| `tile-interaction` | Pointer gestures, drop execution and command admission | [`src/tile-interaction/fx/createMainDragControllerFx.ts`](src/tile-interaction/fx/createMainDragControllerFx.ts) |
| `game-scene` | Concrete retained Board, Toolbar and Inventory scenes | [`src/game-scene/README.md`](src/game-scene/README.md) |
| `item-detail-read` | Shared framework-neutral detail reads | [`src/item-detail-read/fx/readItemDetailIdentityFx.ts`](src/item-detail-read/fx/readItemDetailIdentityFx.ts) |
| `item-detail-frame` | Visible detail target, command settlement and frame | [`src/item-detail-frame/fx/createItemDetailControllerFx.ts`](src/item-detail-frame/fx/createItemDetailControllerFx.ts) |
| `item-line-detail` | Item Line reads, projections and presentation | [`src/item-line-detail/fx/readItemDetailLinesFx.ts`](src/item-line-detail/fx/readItemDetailLinesFx.ts) |
| `item-detail` | Concrete Item Detail dialog and tabs | [`src/item-detail/ui/ItemDetailModal.tsx`](src/item-detail/ui/ItemDetailModal.tsx) |
| `game-presentation` | Mounted-Game React capability and command settlement | [`src/game-presentation/ui/GameEngineProvider.tsx`](src/game-presentation/ui/GameEngineProvider.tsx) |
| `game-audio` | Committed-event audio cues and Web Audio lifecycle | [`src/game-audio/ui/GameAudio.tsx`](src/game-audio/ui/GameAudio.tsx) |
| `game-menu` | Menu overlay, save/close command and navigation intent | [`src/game-menu/ui/GameMenu.tsx`](src/game-menu/ui/GameMenu.tsx) |
| `game-cheat` | Save-scoped cheats, catalog and command UI | [`src/game-cheat/ui/Cheats.tsx`](src/game-cheat/ui/Cheats.tsx) |
| `game-shell` | Board/Inventory leaves and gameplay overlay composition | [`src/game-shell/ui/GameShell.tsx`](src/game-shell/ui/GameShell.tsx) |

## Authored source and artifacts

| Domain | Role | First read |
| --- | --- | --- |
| `game-value` | Foundational immutable identity, text, quantity and time schemas | [`src/game-value/schema/IdSchema.ts`](src/game-value/schema/IdSchema.ts) |
| `game-config` | Completed authored aggregate and loaded-config capability | [`src/game-config/README.md`](src/game-config/README.md) |
| `game-config-source` | Portable project layout, source schemas and discovery | [`src/game-config-source/schema/ProjectSchema.ts`](src/game-config-source/schema/ProjectSchema.ts) |
| `game-config-resource` | Embedded PNG/source descriptors, discovery and usage | [`src/game-config-resource/schema/ResourceSchema.ts`](src/game-config-resource/schema/ResourceSchema.ts) |
| `game-config-diagnostic` | Provenance-aware validation diagnostics | [`src/game-config-diagnostic/schema/GameDiagnosticsSchema.ts`](src/game-config-diagnostic/schema/GameDiagnosticsSchema.ts) |
| `game-config-validation` | Completed-config semantic validation | [`src/game-config-validation/fx/validateGameConfigFx.ts`](src/game-config-validation/fx/validateGameConfigFx.ts) |
| `game-config-compiler` | Deterministic source assembly and blocking gate | [`src/game-config-compiler/fx/compileGameDirectoryFx.ts`](src/game-config-compiler/fx/compileGameDirectoryFx.ts) |
| `application-version` | Arkini writer provenance and major-only admission | [`src/application-version/fn/readArkiniVersionIncompatibilityFn.ts`](src/application-version/fn/readArkiniVersionIncompatibilityFn.ts) |
| `game-version` | Project-owned gameplay compatibility | [`src/game-version/schema/VersionSchema.ts`](src/game-version/schema/VersionSchema.ts) |
| `filesystem-write` | Shared Node-only lock and durable write mechanics | [`src/filesystem-write/fx/createFilesystemWriteFx.ts`](src/filesystem-write/fx/createFilesystemWriteFx.ts) |
| `arkpack-artifact` | Package bytes, envelope, compression, signing and provenance | [`src/arkpack-artifact/fx/packDirectoryFx.ts`](src/arkpack-artifact/fx/packDirectoryFx.ts) |
| `arkpack-admission` | Bounded decode and semantic package admission | [`src/arkpack-admission/fx/readArkpackFx.ts`](src/arkpack-admission/fx/readArkpackFx.ts) |
| `arkpack-catalog` | Renderer catalog state, storage and mutation lifecycle | [`src/arkpack-catalog/service/ArkpackCatalog.ts`](src/arkpack-catalog/service/ArkpackCatalog.ts) |
| `arkpack-selector` | Catalog commands and package-list presentation | [`src/arkpack-selector/ui/ArkpackCatalogList.tsx`](src/arkpack-selector/ui/ArkpackCatalogList.tsx) |
| `arkini-cli` | Product CLI, replay, diagnostic slicing and Node root | [`src/arkini-cli/arkini.ts`](src/arkini-cli/arkini.ts) |

[`CONFIG.md`](CONFIG.md) owns portable authoring semantics. [`VERSION.md`](VERSION.md) owns compatibility and external envelopes.

## Editor and analysis

| Domain | Role | First read |
| --- | --- | --- |
| `project-authoring` | Project model, repository contract and catalog workflows | [`src/project-authoring/service/ProjectRepository.ts`](src/project-authoring/service/ProjectRepository.ts) |
| `authoring-session` | Mounted project projection, replacement and unsaved guard | [`src/authoring-session/ui/useEditorProject.ts`](src/authoring-session/ui/useEditorProject.ts) |
| `authoring-shell` | Cross-product Editor shell and navigation | [`src/authoring-shell/ui/EditorShell.tsx`](src/authoring-shell/ui/EditorShell.tsx) |
| `authoring-form` | Shared form registry and reference controls | [`src/authoring-form/ui/EditorForm.tsx`](src/authoring-form/ui/EditorForm.tsx) |
| `editor-control` | Reusable Editor fields, sections, selection and search | [`src/editor-control/ui/EditorFormSection.tsx`](src/editor-control/ui/EditorFormSection.tsx) |
| `asset-authoring` | Asset catalog, validation, edit/import/delete and UI | [`src/asset-authoring/ui/EditorAssetManager.tsx`](src/asset-authoring/ui/EditorAssetManager.tsx) |
| `item-authoring` | Item forms, delete/rename policy and UI | [`src/item-authoring/ui/Detail.tsx`](src/item-authoring/ui/Detail.tsx) |
| `chatgpt-asset-authoring` | Project-scoped ChatGPT view and confirmed Asset insertion | [`src/chatgpt-asset-authoring/ui/useEditorChatGptController.ts`](src/chatgpt-asset-authoring/ui/useEditorChatGptController.ts) |
| `board-scenario` | Scenario snapshots and Editor Board Game lifecycle | [`src/board-scenario/fx/createEditorBoardGameResourceFx.ts`](src/board-scenario/fx/createEditorBoardGameResourceFx.ts) |
| `editor-build` | Build descriptor, command identity, publication and UI | [`src/editor-build/service/EditorBuildRepository.ts`](src/editor-build/service/EditorBuildRepository.ts) |
| `project-note` | Ordered Notes outside Version snapshots | [`src/project-note/schema/NoteFileSchema.ts`](src/project-note/schema/NoteFileSchema.ts) |
| `project-version` | Immutable snapshots, commit compatibility, saved-HEAD proof and checkout | [`src/project-version/README.md`](src/project-version/README.md) |
| `authoring-mcp` | MCP schemas, storage, HTTP/tools/tunnel lifecycle and Editor presentation | [`src/authoring-mcp/fx/createFilesystemEditorMcpOwnershipFx.ts`](src/authoring-mcp/fx/createFilesystemEditorMcpOwnershipFx.ts) |
| `flow` | Authored acquisition graph and relation semantics | [`src/flow/fn/createAcquisitionGraphFn.ts`](src/flow/fn/createAcquisitionGraphFn.ts) |
| `flow-layout` | Deterministic graph layout and worker lifecycle | [`src/flow-layout/fx/layoutInWorkerFx.ts`](src/flow-layout/fx/layoutInWorkerFx.ts) |
| `flow-canvas` | Flow projections, Canvas painting and interaction | [`src/flow-canvas/ui/EditorGameFlow.tsx`](src/flow-canvas/ui/EditorGameFlow.tsx) |
| `estimate` | Optimistic acquisition witnesses, index, cache and worker | [`src/estimate/README.md`](src/estimate/README.md) |

The filesystem Project Repository and Electron IPC composition are mapped in [`electron/main/editor-project/README.md`](electron/main/editor-project/README.md).

## Application and platform

| Domain | Role | First read |
| --- | --- | --- |
| `application-data` | Canonical system-user Arkini data root and complete path tree | [`src/application-data/fn/createArkiniUserDataPathsFn.ts`](src/application-data/fn/createArkiniUserDataPathsFn.ts) |
| `application-diagnostics` | Shared failure extraction, bounded formatting and transport | [`src/application-diagnostics/fn/formatApplicationDiagnosticTextFn.ts`](src/application-diagnostics/fn/formatApplicationDiagnosticTextFn.ts) |
| `application-runtime` | Renderer ManagedRuntime, Atom bridge and native lifecycle | [`src/application-runtime/service/RendererRuntime.ts`](src/application-runtime/service/RendererRuntime.ts) |
| `application-settings` | Appearance, Cheat availability and Settings | [`src/application-settings/atom/SettingsCommandAtom.ts`](src/application-settings/atom/SettingsCommandAtom.ts) |
| `application-shell` | Root context, fatal surface and route transitions | [`src/application-shell/ui/renderRendererFx.tsx`](src/application-shell/ui/renderRendererFx.tsx) |
| `renderer-bootstrap` | Ordered renderer startup and React root composition | [`src/renderer-bootstrap/ui/bootstrapRendererFx.tsx`](src/renderer-bootstrap/ui/bootstrapRendererFx.tsx) |
| `launcher` | Session startup, Hero/About resources and shell surfaces | [`src/launcher/ui/LauncherScene.tsx`](src/launcher/ui/LauncherScene.tsx) |
| `window-mode` | Native window-mode state and confirmed synchronization | [`src/window-mode/fx/bootstrapWindowModeSyncFx.ts`](src/window-mode/fx/bootstrapWindowModeSyncFx.ts) |
| `translation` | Locale catalogs, negotiation, translator and Markdown | [`src/translation/fx/bootstrapTranslationFx.ts`](src/translation/fx/bootstrapTranslationFx.ts) |
| `fuzzy-search` | App-wide exact-first Fuse search over explicit domain terms | [`src/fuzzy-search/fn/createFuzzySearchFn.ts`](src/fuzzy-search/fn/createFuzzySearchFn.ts) |
| `ui` | Cross-product presentation primitives only | [`src/ui/ui`](src/ui/ui) |
| `@routes` | Route registration, loaders, actions and leaf composition | [`src/@routes`](src/@routes) |
| `electron/contract` | Pure typed renderer/main transport seam | [`electron/contract/ArkiniElectronApi.ts`](electron/contract/ArkiniElectronApi.ts) |
| `electron/main` | Native window, protocol, GUI composition and privileged IPC authority | [`electron/main/electronMainFx.ts`](electron/main/electronMainFx.ts) |
| `electron/preload` | Transport-only context bridge | [`electron/preload/index.ts`](electron/preload/index.ts) |
| `electron/security` | Trusted URL, frame and renderer admission | [`electron/security`](electron/security) |
| `shared` | Immutable cross-process metadata and hard limits | [`shared`](shared) |
| `game/arkini` | Official portable game project | [`game/arkini`](game/arkini) |
| `test` | Focused regression proofs mirroring production owners | [`test`](test) |
