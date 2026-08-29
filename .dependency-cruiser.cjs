const activeCodePattern = "^(?:src|electron|shared|scripts)(?:/|$)";
const activeCodeAndTestsPattern = "^(?:src|electron|shared|scripts|test)(?:/|$)";
const productionCodePattern = "^(?:src|electron|shared)(?:/|$)";
const applicationEntrypointPattern = "^src/(?:main|createArkiniRouterFx|_route)[.]tsx?$";
const applicationDiagnosticsPattern = "^src/application-diagnostics(?:/|$)";
const gameEventPattern = "^src/game-event(?:/|$)";
const gameConfigPattern = "^src/game-config(?:/|$)";
const gameRuntimePattern = "^src/game-runtime(?:/|$)";
const gamePersistencePattern = "^src/game-persistence(?:/|$)";
const gameTickPattern = "^src/game-tick(?:/|$)";
const itemInteractionPattern = "^src/item-interaction(?:/|$)";
const itemLineDetailPattern = "^src/item-line-detail(?:/|$)";
const itemLineDetailReadPattern = "^src/item-line-detail/read(?:/|$)";
const itemLineDetailPresentationPattern = "^src/item-line-detail/ui(?:/|$)";
const itemInteractionAllowedSourceDependencyPattern =
	"(?:item-interaction(?:/|$)|engine/(?:common/schema/(?:IdSchema|NonNegativeIntegerSchema|PositiveIntegerSchema)[.]ts$|game/context/GameConfigFx[.]ts$|item/(?:error/(?:ItemNotFoundError|ItemNotOnBoardError|ItemNotOnGridError|ItemStatefulError)[.]ts$|fn/isItemPureFn[.]ts$)|revision/(?:fx/assertRevisionFx|schema/RevisionSchema)[.]ts$)|game-event/(?:readOutputPlacementItemEventsFx[.]ts$|schema/(?:GameEventEnumSchema|GameEventSchema)[.]ts$)|game-runtime/(?:error/(?:ItemJobScopedError|ItemLocationConflictError)[.]ts$|fx/(?:removeRuntimeItemFx|removeRuntimeItemIdentityFx|reviseRuntimeItemFx)[.]ts$|internal/modifyRuntimeFx[.]ts$|read/(?:fn/(?:isBoardRuntimeItemFn|isGridRuntimeItemFn)[.]ts$|(?:readRuntimeFx|readRuntimeItemByIdFx)[.]ts$)|schema/(?:BoardRuntimeItemSchema|GridRuntimeItemSchema|RuntimeItemSchema|RuntimeSchema)[.]ts$)|item-definition/schema/TypeSchema[.]ts$|item-location/(?:error/CrossSpaceBoardOperationError[.]ts$|fn/(?:isItemLocationScopeAllowedFn|isSameGridLocationFn|readGridLocationClaimAtFn|readGridLocationClaimsFn)[.]ts$|schema/(?:BoardLocationSchema|GridLocationSchema|InventoryLocationSchema|LocationScopeEnumSchema)[.]ts$)|item-merge/(?:fx/resolveMergeRuleFx[.]ts$|schema/(?:SourceActionSchema|TargetEffectSchema)[.]ts$|write/mergeItemsFx[.]ts$)|item-placement/(?:PlacementPlan[.]ts$|error/PlacementUnavailableError[.]ts$|fn/(?:readBoardLocationsFn|readEmptyLocationsFn|readInventoryLocationsFn)[.]ts$|fx/(?:applyOutputPlacementFx|applyPlacementPlanFx|assertPlacementPlanCompleteFx|placeRuntimeItemFx|planInventoryPlacementFx)[.]ts$|schema/PlacementSchema[.]ts$)|production-input/(?:fn/resolveLineInputStoreFn[.]ts$|write/storeInputMaterialFx[.]ts$)|production-job/(?:fx/assertOwnerIdleFx[.]ts$|fx/read/resolveJobQueueFx[.]ts$)|production-line/fn/(?:isLineOwnerItemFn|readEffectiveDefaultLineFn)[.]ts$)";
const itemLineDetailReadAllowedSourceDependencyPattern =
	"(?:item-line-detail/read(?:/|$)|engine/(?:common/schema/(?:IdSchema|NonNegativeIntegerSchema|TimeSchema)[.]ts$|game/context/GameConfigFx[.]ts$|item-detail/read/readItemDetailSourcesFx[.]ts$|item/fn/readItemRemainingChargesFn[.]ts$|query/fx/queryFx[.]ts$)|game-runtime/(?:context/RuntimeFx[.]ts$|read/readBoardRuntimeItemByIdFx[.]ts$|schema/RuntimeSchema[.]ts$)|item-definition/(?:fn/matchesItemSelectorFn[.]ts$|schema/SelectorSchema[.]ts$)|item-location/schema/(?:BoardLocationSchema|DistanceSchema|LocationScopeEnumSchema)[.]ts$|production-condition/schema/WhenSchema[.]ts$|production-delivery/fn/readLineInputDeliveryClaimsFn[.]ts$|production-input/(?:InputRun[.]ts$|read/(?:fn/isMaterialInputEligibleFn|isLineInputAutofillSourceLocationFn)[.]ts$|schema/(?:ChargeSourceSchema|DepositSchema|InputSchema|ModeSchema|TypeSchema)[.]ts$)|production-job/(?:fx/(?:resolveActiveJobStatusFx|read/(?:resolveLineStartFx|resolveStartOutputCapacityFx))[.]ts$|schema/read/JobStatusEnumSchema[.]ts$)|production-line/(?:LineRun[.]ts$|fn/(?:isLineOwnerItemFn|readEffectiveDefaultLineFn|readLineOwnerLinesFn)[.]ts$|schema/(?:LineSchema|rule/TypeSchema)[.]ts$)|production-output/(?:fx/dropRulesFx[.]ts$|roll/schema/(?:RollSchema|TypeSchema)[.]ts$|schema/DropSchema[.]ts$))";
const itemLineDetailPresentationAllowedSourceDependencyPattern =
	"(?:item-line-detail(?:/|$)|item-detail-frame(?:/|$)|engine/(?:common/schema/(?:IdSchema|NonNegativeIntegerSchema)[.]ts$|item/fx/resolveItemFx[.]ts$)|game-runtime/schema/RuntimeSchema[.]ts$|item-definition/schema/SelectorSchema[.]ts$|item-location/schema/DistanceSchema[.]ts$|production-condition/schema/(?:TypeSchema|WhenSchema)[.]ts$|production-input/(?:schema/(?:ChargeSourceSchema|ModeSchema)[.]ts$|write/(?:withdrawLineInputFx|withdrawLineInputsFx)[.]ts$)|production-job/(?:schema/read/JobStatusEnumSchema[.]ts$|ui/(?:ProductionJobRuntime[.]tsx|readActiveJobRuntimeFn[.]ts$)|write/enqueueLineFx[.]ts$)|production-line/write/(?:setDefaultLineFx|unsetDefaultLineFx)[.]ts$|renderer/(?:RendererRuntime[.]ts$|game/GameEngine[.]ts$)|ui/(?:button/(?:Button|LinkButton)[.]tsx$|formatDurationFn[.]ts$|game/(?:useGameEngine|useRuntimeSelector)[.]ts$|scrollable/Scrollable[.]tsx$|search/useFuseSearch[.]ts$))";
const gameRuntimeAllowedSourceDependencyPattern =
	"(?:game-runtime(?:/|$)|game-config/GameConfigSchema[.]ts$|engine/(?:cheat/schema/CheatStateSchema[.]ts$|common/schema/(?:IdSchema|NonNegativeIntegerSchema|PositiveIntegerSchema|TimeSchema)[.]ts$|game/context/GameConfigFx[.]ts$|item/(?:error/(?:ItemNotFoundError|ItemNotOnBoardError)[.]ts$|fn/(?:isItemPureWithIndexFn|readItemPurityIndexFn)[.]ts$|fx/resolveItemFx[.]ts$)|revision/(?:fx/createRevisionFx|schema/RevisionSchema)[.]ts$)|game-event/schema/GameEventSchema[.]ts$|item-definition/schema/(?:ItemSchema|StorageSchema|TypeSchema)[.]ts$|item-location/(?:fn/(?:indexGridLocationClaimsFn|isItemLocationScopeAllowedFn|readGridLocationClaimsFn)[.]ts$|schema/(?:BoardLocationSchema|DeliveryLocationSchema|GridLocationSchema|InputLocationSchema|JobLocationSchema|LocationSchema|LocationScopeEnumSchema|ReservedLocationSchema)[.]ts$)|production-delivery/(?:check/checkRuntimeDeliveriesFn|fx/reconcileOutboundDeliveriesRuntimeFx|schema/check/DeliveryTargetIssueSchema)[.]ts$|production-input/(?:check/checkRuntimeInputLocationsFn|fx/releaseOwnerInputsFx|schema/check/(?:InputCapacityExceededIssueSchema|InputLineMissingIssueSchema|InputOwnerMissingIssueSchema|InputSelectorMismatchIssueSchema|InputSlotInvalidIssueSchema))[.]ts$|production-job/(?:check/checkRuntimeJobsFn|error/JobOwnerBusyError|fn/readReservedJobOutputQuantitiesFn|schema/(?:JobQueueRequestSchema|JobSchema|DuplicateJobIdIssueSchema|JobConsumedMaterialStateIssueSchema|JobLineMissingIssueSchema|JobMaterialOrphanIssueSchema|JobOwnerMissingIssueSchema|JobOwnerMultipleActiveIssueSchema|JobOwnerNotOnGridIssueSchema|JobQueueExceededIssueSchema|JobTimeInvalidIssueSchema))[.]ts$|production-line/(?:fn/checkRuntimeDefaultLinesFn|schema/(?:DefaultLineByOwnerItemIdSchema|check/(?:DefaultLineIssueSchema|LineInputClosedIssueSchema)))[.]ts$)";
const gamePersistenceAllowedSourceDependencyPattern =
	"(?:game-persistence(?:/|$)|game-config/source/encodeGameProjectFileStemFn[.]ts$|game-runtime/(?:check/assertRuntimeFx|context/(?:CommittedTransitionsFx|RuntimeFx)|schema/(?:RuntimeItemSchema|RuntimeSchema))[.]ts$|engine/(?:cheat/schema/CheatStateSchema[.]ts$|common/schema/(?:IdSchema|NonNegativeIntegerSchema|PositiveIntegerSchema|TimeSchema)[.]ts$|filesystem/(?:FilesystemWrite|createFilesystemWriteFx)[.]ts$|item/fx/resolveItemFx[.]ts$|revision/fx/createRevisionFx[.]ts$|version/(?:ArkiniVersionAdmission|schema/(?:ArkiniVersionSchema|ArkpackVersionSchema))[.]ts$)|item-definition/schema/TypeSchema[.]ts$|item-location/schema/LocationSchema[.]ts$|production-job/schema/(?:JobQueueRequestSchema|JobSchema)[.]ts$|production-line/schema/DefaultLineByOwnerItemIdSchema[.]ts$)";
const gameTickAllowedSourceDependencyPattern =
	"(?:game-tick(?:/|$)|game-runtime/(?:context/RuntimeFx|internal/modifyRuntimeFx|schema/RuntimeSchema)[.]ts$|engine/(?:cheat/read/isInstantGameplayEnabledFx|common/schema/(?:IdSchema|TimeSchema|TimestampSchema)|item/temporary/fx/(?:advanceTemporaryItemDurationsFx|attemptTemporaryItemExpiryFx))[.]ts$|game-event/schema/(?:GameEventEnumSchema|GameEventSchema)[.]ts$|item-definition/schema/TypeSchema[.]ts$|item-location/(?:fn/isPassiveStorageLocationFn|schema/LocationScopeEnumSchema)[.]ts$|production-delivery/write/settleItemDeliveryRuntimeFx[.]ts$|production-job/(?:fx/(?:attemptJobCompletionFx|attemptQueuedLineStartFx|resolveJobRunnableFx)|schema/JobSchema)[.]ts$)";
const gameStartPattern = "^src/game-start(?:/|$)";
const itemDetailFramePattern = "^src/item-detail-frame(?:/|$)";
const itemDefinitionPattern = "^src/item-definition(?:/|$)";
const arkpackArtifactPattern = "^src/arkpack/(?:ArkpackDescriptor[.]ts$|artifact(?:/|$))";
const productionPipelinePattern =
	"^src/(?:production-action|production-condition|production-delivery|production-input|production-job|production-line|production-output)(?:/|$)";
const productDomainPattern =
	"^src/(?:asset-authoring|item-authoring|flow|estimate|editor-build)/domain(?:/|$)";
const productRendererPattern =
	"^src/(?:arkpack|editor-build)/renderer(?:/|$)|^src/asset-authoring/(?:session|validation)(?:/|$)";
const productionJobPresentationPattern = "^src/production-job/ui(?:/|$)";
const boardSpatialPattern = "^src/(?:item-location|item-placement|item-merge|space-action)(?:/|$)";
const productPresentationPattern = `^src/(?:asset-authoring|item-authoring|flow|estimate)/(?:ui|worker)(?:/|$)|^src/(?:arkpack|editor-build)/ui(?:/|$)|${itemDetailFramePattern}|${itemLineDetailPresentationPattern}|${productionJobPresentationPattern}`;
const authoringProductPattern =
	"^src/(?:project-authoring|board-scenario|project-version|project-note|authoring-mcp|authoring-session|authoring-shell)(?:/|$)";
const authoringProductCorePattern =
	"^src/(?:board-scenario/(?!session(?:/|$)|toolbar(?:/|$))|project-version/(?!workspace(?:/|$))|project-note/(?!workspace(?:/|$))|project-authoring/(?!configuration(?:/|$)|export(?:/|$)|welcome(?:/|$)|repository/(?:createElectronEditorProjectRepositoryFx|invokeEditorProjectTransportFx)[.]ts$))";
const authoringProductRuntimePattern =
	"^src/(?:board-scenario/session(?:/|$)|project-authoring/repository/(?:createElectronEditorProjectRepositoryFx|invokeEditorProjectTransportFx)[.]ts$|authoring-session/(?:EditorProjectAtom|EditorProjectReplacementEpochAtom|EditorUnsavedChanges|EditorUnsavedChangesOwnerAtom|createEditorUnsavedChangesOwnerFx|publishEditorProjectFx|refreshEditorProjectFx)[.]ts$)";
const authoringProductPresentationPattern =
	"^src/(?:authoring-mcp|authoring-shell)(?:/|$)|^src/(?:board-scenario/toolbar|project-version/workspace|project-note/workspace|project-authoring/(?:configuration|export|welcome))(?:/|$)|^src/authoring-session/(?:EditorProjectProvider[.]tsx|EditorProjectReplacementBoundary[.]tsx|useEditorProject[.]ts|useEditorProjectRefreshController[.]ts|useEditorUnsavedChangesRegistration[.]ts)$";
const reusablePresentationPattern = `^src/ui(?:/|$)|${productPresentationPattern}|${authoringProductPresentationPattern}`;

/** @type {import('dependency-cruiser').IForbiddenRuleType[]} */
const boundaryRules = [
	{
		name: "application-diagnostics-is-independent-application-policy",
		comment:
			"Shared renderer-side diagnostic normalization and transport policy may depend only on Effect and the pure Electron diagnostics contract, never lifecycle, product, platform, or presentation owners.",
		severity: "error",
		from: {
			path: applicationDiagnosticsPattern,
		},
		to: {
			path: "^(?!src/application-diagnostics(?:/|$)|electron/contract/diagnostics/DiagnosticRecord[.]ts$|node_modules/effect(?:/|$))",
		},
	},
	{
		name: "application-diagnostics-has-concrete-consumers",
		comment:
			"Only installed-game, authoring, root UI, and application command boundaries consume the shared diagnostics policy.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				applicationDiagnosticsPattern,
				"^src/(?:@routes|authoring-mcp|item-detail-frame|project-authoring/welcome|renderer/game|ui)(?:/|$)",
			],
		},
		to: {
			path: applicationDiagnosticsPattern,
		},
	},
	{
		name: "engine-no-presentation-imports",
		comment:
			"The remaining Engine owners never depend on UI, route composition, or renderer entrypoints.",
		severity: "error",
		from: {
			path: "^src/engine(?:/|$)",
		},
		to: {
			path: `^src/(?:renderer|ui|@routes)(?:/|$)|${productRendererPattern}|${productPresentationPattern}|${authoringProductPattern}`,
		},
	},
	{
		name: "game-runtime-is-a-framework-neutral-live-aggregate",
		comment:
			"Game Runtime owns canonical live state, validation, identity and atomic publication; presentation, platform, Item Interaction, Game Tick and persistence may depend on it, never the reverse.",
		severity: "error",
		from: {
			path: gameRuntimePattern,
		},
		to: {
			path: `^src/(?!${gameRuntimeAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!@paralleldrive/cuid2(?:/|$)|effect(?:/|$)|ts-pattern(?:/|$)|zod(?:/|$))`,
			pathNot: [
				gameTickPattern,
			],
		},
	},
	{
		name: "game-runtime-stays-upstream-of-game-tick",
		comment: "Game Runtime cannot import its downstream fixed-step consumer or loop.",
		severity: "error",
		from: {
			path: gameRuntimePattern,
		},
		to: {
			path: gameTickPattern,
		},
	},
	{
		name: "game-runtime-stays-upstream-of-game-persistence",
		comment:
			"Game Runtime cannot import persisted State, hydration, save codecs, storage, or transport adapters.",
		severity: "error",
		from: {
			path: gameRuntimePattern,
		},
		to: {
			path: gamePersistencePattern,
		},
	},
	{
		name: "game-persistence-is-a-runtime-dependent-durable-state-owner",
		comment:
			"Game Persistence owns serializable State, hydration, save codecs, autosave coordination, and exact transport adapters while depending only on explicit Runtime and durable-data leaves.",
		severity: "error",
		from: {
			path: gamePersistencePattern,
		},
		to: {
			path: `^src/(?!${gamePersistenceAllowedSourceDependencyPattern})|^electron(?:/|$)|^shared(?:/|$)|^scripts(?:/|$)|^node_modules/(?!@msgpack/msgpack(?:/|$)|effect(?:/|$)|zod(?:/|$))`,
			pathNot: [
				"^shared/ArkiniAppMetadata[.]ts$",
			],
		},
	},
	{
		name: "game-persistence-has-explicit-composition-consumers",
		comment:
			"Only Game Session, installed-game, Board scenario, game-menu, and Electron-main composition consume persistence; lower gameplay domains never do.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				gamePersistencePattern,
				"^src/board-scenario/session/EditorBoardGameResource[.]ts$",
				"^src/board-scenario/session/createEditorBoardGameFx[.]ts$",
				"^src/board-scenario/session/createEditorBoardGameResourceFx[.]ts$",
				"^src/board-scenario/session/restoreEditorBoardScenarioFx[.]ts$",
				"^src/board-scenario/session/saveEditorBoardScenarioFx[.]ts$",
				"^src/engine/game/layer/GameSessionLayerFx[.]ts$",
				"^src/renderer/RendererRuntime[.]ts$",
				"^src/renderer/game/Game[.]ts$",
				"^src/renderer/game/GameSaveBootstrapError[.]ts$",
				"^src/renderer/game/createGameFx[.]ts$",
				"^src/renderer/game/resource/createGameEngineResourceServiceFx[.]ts$",
				"^src/renderer/game/resource/internal/createFailedSaveRecoveryCapabilityFx[.]ts$",
				"^src/renderer/game/resource/internal/createGameEngineFinalizationCapabilityFx[.]ts$",
				"^src/renderer/game/session/GameSession[.]ts$",
				"^src/renderer/game/session/createGameSessionFx[.]ts$",
				"^src/ui/game-menu/gameMenuCommandAtom[.]ts$",
				"^electron/main/registerArkiniElectronIpcFx[.]ts$",
			],
		},
		to: {
			path: gamePersistencePattern,
		},
	},
	{
		name: "game-tick-is-a-runtime-dependent-fixed-step-owner",
		comment:
			"Game Tick owns fixed-step scheduling and advancement over Game Runtime without session, persistence, renderer, platform, or presentation dependencies.",
		severity: "error",
		from: {
			path: gameTickPattern,
		},
		to: {
			path: `^src/(?!${gameTickAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!effect(?:/|$)|zod(?:/|$))`,
		},
	},
	{
		name: "item-interaction-is-a-framework-neutral-runtime-consumer",
		comment:
			"Item Interaction may consume only its exact Game Runtime, spatial, production and Engine leaves; Game Runtime's own allowlist forbids the reverse dependency.",
		severity: "error",
		from: {
			path: itemInteractionPattern,
		},
		to: {
			path: `^src/(?!${itemInteractionAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!effect(?:/|$)|ts-pattern(?:/|$))`,
		},
	},
	{
		name: "item-line-detail-reads-are-framework-neutral-projections",
		comment:
			"Item Line Detail reads project canonical Runtime and exact production facts without presentation, frame, authoring, platform, or command ownership.",
		severity: "error",
		from: {
			path: itemLineDetailReadPattern,
		},
		to: {
			path: `^src/(?!${itemLineDetailReadAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!effect(?:/|$)|ts-pattern(?:/|$))`,
		},
	},
	{
		name: "item-line-detail-ui-consumes-only-its-exact-owners",
		comment:
			"Item Lines UI projects its read contract, admits exact production commands through Item Detail Frame, and consumes only concrete renderer and reusable UI leaves.",
		severity: "error",
		from: {
			path: itemLineDetailPresentationPattern,
		},
		to: {
			path: `^src/(?!${itemLineDetailPresentationAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!effect(?:/|$)|lucide-react(?:/|$)|motion(?:/|$)|react(?:/|$)|ts-pattern(?:/|$))`,
		},
	},
	{
		name: "item-line-detail-has-concrete-production-consumers",
		comment:
			"Only dialog composition, shell identity wiring, Board Scenario identity, and Item Authoring output reuse consume the Item Line Detail product outside its own root.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				itemLineDetailPattern,
				"^src/ui/item-detail/ItemDetailModal[.]tsx$",
				"^src/ui/shell/GameShell[.]tsx$",
				"^src/board-scenario/toolbar/EditorBoardProductionLineLink[.]tsx$",
				"^src/item-authoring/ui/EditorProductionLineOutputs[.]tsx$",
			],
		},
		to: {
			path: itemLineDetailPattern,
		},
	},
	{
		name: "item-definition-is-authored-vocabulary",
		comment:
			"Item Definition owns immutable authored item, query, selector, quantity, and storage contracts plus explicit-input selection policy; it may compose only exact schema leaves and never live Runtime, product, platform, or presentation ownership.",
		severity: "error",
		from: {
			path: itemDefinitionPattern,
		},
		to: {
			path: "^src/(?!item-definition(?:/|$)|engine/common/schema/(?:DescriptionSchema|IdSchema|PositiveIntegerSchema|TimeSchema|TitleSchema)[.]ts$|item-location/schema/DistanceSchema[.]ts$|item-merge/schema/MergeSchema[.]ts$|space-action/schema/SpaceSchema[.]ts$|production-line/schema/LineSchema[.]ts$|production-output/schema/OutputSchema[.]ts$)|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)",
		},
	},
	{
		name: "game-start-is-a-framework-neutral-domain",
		comment:
			"Game Start schemas, exact placement planning, and atomic runtime initialization depend only on their own owner, spatial placement/location owners, and exact Engine capabilities, never another product, presentation, routes, or Electron.",
		severity: "error",
		from: {
			path: gameStartPattern,
		},
		to: {
			path: "^src/(?!engine(?:/|$)|game-runtime(?:/|$)|game-start(?:/|$)|item-location(?:/|$)|item-placement(?:/|$))|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)",
		},
	},
	{
		name: "game-event-is-a-downstream-framework-neutral-projection",
		comment:
			"Committed Game Events may project exact Engine value results but never own Runtime/State/Tick/save authority, production decisions, delivery products, renderer lifecycle, presentation, routes, or Electron.",
		severity: "error",
		from: {
			path: gameEventPattern,
		},
		to: {
			path: "^src/(?!game-event(?:/|$))|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)",
			pathNot: [
				"^src/engine/common/schema/(?:IdSchema|NonNegativeIntegerSchema|PositiveIntegerSchema)[.]ts$",
				"^src/game-runtime/read/fn/isGridRuntimeItemFn[.]ts$",
				"^src/item-location/schema/(?:BoardLocationSchema|GridLocationSchema|InputLocationSchema|InventoryLocationSchema|LocationSchema|ReservedLocationSchema)[.]ts$",
				"^src/item-merge/schema/(?:SourceActionSchema|TargetEffectSchema)[.]ts$",
				"^src/item-placement/fx/applyOutputPlacementFx[.]ts$",
			],
		},
	},
	{
		name: "game-event-only-types-output-placement-application",
		comment:
			"Game Event may describe an already-applied output placement result but never execute placement itself.",
		severity: "error",
		from: {
			path: gameEventPattern,
		},
		to: {
			path: "^src/item-placement/fx/applyOutputPlacementFx[.]ts$",
			dependencyTypesNot: [
				"type-only",
			],
		},
	},
	{
		name: "board-spatial-owners-are-framework-neutral",
		comment:
			"Location, placement, merge, and Space actions own canonical gameplay semantics and never depend on authoring, delivery products, renderer ownership, presentation, routes, or Electron.",
		severity: "error",
		from: {
			path: boardSpatialPattern,
		},
		to: {
			path: `^src/(?:game-config|arkpack|editor-build|editor|item-authoring|flow|estimate|renderer|ui|@routes)(?:/|$)|${productRendererPattern}|${productPresentationPattern}|${authoringProductPattern}|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)`,
		},
	},
	{
		name: "item-location-stays-upstream",
		comment:
			"Location identity, grid, and distance contracts never depend on placement, merge, or Space action operations.",
		severity: "error",
		from: {
			path: "^src/item-location(?:/|$)",
		},
		to: {
			path: "^src/(?:item-placement|item-merge|space-action)(?:/|$)",
		},
	},
	{
		name: "item-placement-stays-upstream-of-commands",
		comment:
			"Placement policy may depend on location identity but never reaches into merge or Space action commands.",
		severity: "error",
		from: {
			path: "^src/item-placement(?:/|$)",
		},
		to: {
			path: "^src/(?:item-merge|space-action)(?:/|$)",
		},
	},
	{
		name: "item-merge-stays-out-of-space-actions",
		comment:
			"Directional merge composes location and placement owners without taking over Space activation.",
		severity: "error",
		from: {
			path: "^src/item-merge(?:/|$)",
		},
		to: {
			path: "^src/space-action(?:/|$)",
		},
	},
	{
		name: "space-actions-stay-out-of-placement-and-merge",
		comment:
			"Space activation composes location and production action policy without owning placement or merge.",
		severity: "error",
		from: {
			path: "^src/space-action(?:/|$)",
		},
		to: {
			path: "^src/(?:item-placement|item-merge)(?:/|$)",
		},
	},
	{
		name: "production-pipeline-is-framework-neutral",
		comment:
			"Production actions, conditions, inputs, lines, outputs, jobs, and deliveries depend only on exact gameplay owners, never authoring, delivery products, renderer ownership, presentation, routes, or Electron.",
		severity: "error",
		from: {
			path: productionPipelinePattern,
			pathNot: [
				productionJobPresentationPattern,
			],
		},
		to: {
			path: `^src/(?:game-config|arkpack|asset-authoring|editor-build|item-authoring|flow|estimate|renderer|ui|@routes)(?:/|$)|${productRendererPattern}|${productPresentationPattern}|${authoringProductPattern}|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)`,
		},
	},
	{
		name: "production-owners-stay-upstream-of-item-line-detail",
		comment:
			"Production schemas, reads, commands, and job presentation never import the downstream Item Line Detail projection or UI.",
		severity: "error",
		from: {
			path: productionPipelinePattern,
		},
		to: {
			path: itemLineDetailPattern,
		},
	},
	{
		name: "production-job-presentation-is-read-only",
		comment:
			"Active-job UI presents public job status through shared frame/UI policy and never imports public gameplay command surfaces.",
		severity: "error",
		from: {
			path: productionJobPresentationPattern,
		},
		to: {
			path: "^src/(?:production-input|production-job|production-line)/write(?:/|$)",
		},
	},
	{
		name: "item-detail-frame-owns-visible-orchestration-only",
		comment:
			"Item Detail Frame owns target lifecycle, command settlement, retained presentation, and reference navigation without importing dialog areas or public gameplay command surfaces.",
		severity: "error",
		from: {
			path: itemDetailFramePattern,
		},
		to: {
			path: "^src/(?:ui/item-detail|item-line-detail)(?:/|$)|^src/(?:item-interaction|production-input|production-job|production-line)/write(?:/|$)",
		},
	},
	{
		name: "production-condition-stays-upstream",
		comment:
			"Production conditions query Engine truth and never depend on a downstream production action, input, line, output, job, or delivery owner.",
		severity: "error",
		from: {
			path: "^src/production-condition(?:/|$)",
		},
		to: {
			path: "^src/(?:production-action|production-delivery|production-input|production-job|production-line|production-output)(?:/|$)",
		},
	},
	{
		name: "production-output-stays-upstream-of-execution",
		comment:
			"Output and roll policy may evaluate production conditions but never reaches into action, input, line, job, or delivery execution.",
		severity: "error",
		from: {
			path: "^src/production-output(?:/|$)",
		},
		to: {
			path: "^src/(?:production-action|production-delivery|production-input|production-job|production-line)(?:/|$)",
		},
	},
	{
		name: "production-action-stays-out-of-line-lifecycle",
		comment:
			"Immediate action admission may consume input, output, and condition policy but never owns line, job, or delivery lifecycle.",
		severity: "error",
		from: {
			path: "^src/production-action(?:/|$)",
		},
		to: {
			path: "^src/(?:production-delivery|production-job|production-line)(?:/|$)",
		},
	},
	{
		name: "production-delivery-settles-through-line-inputs",
		comment:
			"Delivery may validate and settle through line/input policy, but never starts actions or jobs and never produces outputs or conditions.",
		severity: "error",
		from: {
			path: "^src/production-delivery(?:/|$)",
		},
		to: {
			path: "^src/(?:production-action|production-condition|production-job|production-output)(?:/|$)",
		},
	},
	{
		name: "production-input-stays-out-of-output-and-job-ownership",
		comment:
			"Input planning may consult action, line, and delivery owners but never owns output policy, condition evaluation, or job lifecycle.",
		severity: "error",
		from: {
			path: "^src/production-input(?:/|$)",
		},
		to: {
			path: "^src/(?:production-condition|production-job|production-output)(?:/|$)",
		},
	},
	{
		name: "production-line-stays-upstream-of-job-and-delivery",
		comment:
			"Line definition and run planning compose action, condition, input, and output policy without taking over downstream job or delivery lifecycle.",
		severity: "error",
		from: {
			path: "^src/production-line(?:/|$)",
		},
		to: {
			path: "^src/(?:production-delivery|production-job)(?:/|$)",
		},
	},
	{
		name: "production-job-does-not-evaluate-conditions-directly",
		comment:
			"Job admission and completion sequence exact production owners and consume line decisions instead of bypassing them to evaluate authored conditions directly.",
		severity: "error",
		from: {
			path: "^src/production-job(?:/|$)",
		},
		to: {
			path: "^src/production-condition(?:/|$)",
		},
	},
	{
		name: "game-config-is-upstream-of-gameplay-and-delivery",
		comment:
			"Authored config, source, diagnostics, validation, resources, and compilation stay platform-neutral and upstream of committed Game Events, Arkpack delivery, and Editor Build.",
		severity: "error",
		from: {
			path: gameConfigPattern,
		},
		to: {
			path: `^src/(?:game-event|arkpack|editor-build|renderer|ui|@routes)(?:/|$)|${productRendererPattern}|${productPresentationPattern}|${authoringProductPattern}|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)`,
		},
	},
	{
		name: "game-config-source-stays-upstream",
		comment:
			"Canonical source reading and schema emission never depend on semantic validation or completed-config compilation.",
		severity: "error",
		from: {
			path: "^src/game-config/source(?:/|$)",
		},
		to: {
			path: "^src/game-config/(?:compiler|validation)(?:/|$)",
		},
	},
	{
		name: "game-config-validation-stays-upstream-of-compilation",
		comment:
			"Validation owns semantic diagnostics and never reaches into the compiler that sequences it.",
		severity: "error",
		from: {
			path: "^src/game-config/validation(?:/|$)",
		},
		to: {
			path: "^src/game-config/compiler(?:/|$)",
		},
	},
	{
		name: "arkpack-artifact-stays-upstream-of-runtime-and-build",
		comment:
			"Arkpack bytes, signing, provenance, and artifact schemas never depend on catalog/runtime, presentation, or Editor Build.",
		severity: "error",
		from: {
			path: arkpackArtifactPattern,
		},
		to: {
			path: `^src/arkpack/(?:renderer|ui)(?:/|$)|^src/editor-build(?:/|$)|^src/(?:renderer|ui|@routes)(?:/|$)|${productRendererPattern}|${productPresentationPattern}|${authoringProductPattern}|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)`,
		},
	},
	{
		name: "arkpack-renderer-stays-upstream-of-build-and-presentation",
		comment:
			"The Arkpack renderer catalog and load lifecycle never depend on Editor Build, presentation, or route composition.",
		severity: "error",
		from: {
			path: "^src/arkpack/renderer(?:/|$)",
		},
		to: {
			path: `^src/editor-build(?:/|$)|^src/(?:ui|@routes)(?:/|$)|${productPresentationPattern}`,
		},
	},
	{
		name: "runtime-store-has-one-owner-boundary",
		comment:
			"The mutable runtime store is owned only by its layer, factory, and transaction helper.",
		severity: "error",
		from: {
			path: "^(?:src|electron)(?:/|$)",
			pathNot: [
				"^src/game-runtime/layer/GameRuntimeLayerFx[.]ts$",
				"^src/game-runtime/internal/(?:makeRuntimeStoreFx|modifyRuntimeWithTransitionFx)[.]ts$",
			],
		},
		to: {
			path: "^src/game-runtime/internal/RuntimeStoreFx[.]ts$",
		},
	},
	{
		name: "game-loop-has-concrete-owners",
		comment:
			"The mutable game loop is wired by Game Tick and consumed only by the renderer game-session lifecycle.",
		severity: "error",
		from: {
			path: "^(?:src|electron)(?:/|$)",
			pathNot: [
				"^src/game-tick/GameLoopLayerFx[.]ts$",
				"^src/renderer/game/session/createGameSessionFx[.]ts$",
			],
		},
		to: {
			path: "^src/game-tick/GameLoopFx[.]ts$",
		},
	},
	{
		name: "tick-has-concrete-game-tick-owners",
		comment: "Tick mutation stays inside the Game Tick layer and scoped production loop.",
		severity: "error",
		from: {
			path: "^(?:src|electron)(?:/|$)",
			pathNot: [
				"^src/game-tick/(?:GameLoopLayerFx|TickLayerFx)[.]ts$",
			],
		},
		to: {
			path: "^src/game-tick/TickFx[.]ts$",
		},
	},
	{
		name: "committed-transitions-have-concrete-owners",
		comment:
			"Writable committed-transition state is wired and read only by exact Engine and renderer-session lifecycle owners.",
		severity: "error",
		from: {
			path: "^(?:src|electron)(?:/|$)",
			pathNot: [
				"^src/game-runtime/layer/GameRuntimeLayerFx[.]ts$",
				"^src/game-persistence/RuntimeSaveLayerFx[.]ts$",
				"^src/renderer/game/session/(?:createGameSessionFx|createGameSessionTransitionSubscriptionsFx)[.]ts$",
			],
		},
		to: {
			path: "^src/game-runtime/context/CommittedTransitionsFx[.]ts$",
		},
	},
	{
		name: "engine-no-react-dependencies",
		comment:
			"The engine is framework-neutral. React and React-specific packages belong to the UI boundary.",
		severity: "error",
		from: {
			path: "^src/engine(?:/|$)",
		},
		to: {
			path: "^node_modules/(?:react|react-dom|@tanstack/react-router|@vitejs/plugin-react|@types/react|@types/react-dom)(?:/|$)",
		},
	},
	{
		name: "product-domain-no-presentation-imports",
		comment:
			"Asset Authoring, Item Authoring, Flow, Estimate, and Editor Build domain subtrees stay platform-neutral and never import product UI/workers, shared UI, renderer ownership, routes, or Electron.",
		severity: "error",
		from: {
			path: productDomainPattern,
		},
		to: {
			path: `^src/(?:renderer|ui|@routes)(?:/|$)|${productRendererPattern}|${productPresentationPattern}|${authoringProductRuntimePattern}|${authoringProductPresentationPattern}|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)`,
		},
	},
	{
		name: "authoring-products-no-route-or-electron-runtime-imports",
		comment:
			"Project Authoring, Board Scenario, Project Version, Project Note, Authoring MCP, Authoring Session, and Authoring Shell own renderer-safe product semantics; route registration and privileged Electron runtime stay outside them.",
		severity: "error",
		from: {
			path: authoringProductPattern,
		},
		to: {
			path: "^src/@routes(?:/|$)|^electron(?:/|$)|^node_modules/electron(?:/|$)",
			pathNot: [
				"^electron/contract(?:/|$)",
			],
		},
	},
	{
		name: "authoring-product-core-no-presentation-imports",
		comment:
			"Portable authoring schemas, policies, and repository contracts remain framework-neutral even when their product root also owns an explicit workspace, session, toolbar, configuration, import, export, or welcome surface.",
		severity: "error",
		from: {
			path: authoringProductCorePattern,
		},
		to: {
			path: `^src/(?:renderer|ui|@routes)(?:/|$)|${productPresentationPattern}|${authoringProductRuntimePattern}|${authoringProductPresentationPattern}|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)`,
		},
	},
	{
		name: "renderer-process-no-presentation-imports",
		comment:
			"Concrete renderer-process lifecycle, validation, session, and transport owners never depend on reusable UI, routes, or renderer entrypoints.",
		severity: "error",
		from: {
			path: `^src/renderer(?:/|$)|${productRendererPattern}`,
		},
		to: {
			path: `^src/(?:ui|@routes)(?:/|$)|${productPresentationPattern}|${authoringProductPresentationPattern}`,
		},
	},
	{
		name: "presentation-no-route-imports",
		comment:
			"Shared and product-owned presentation imports exact domain/process owners directly, but never route registration or route-specific composition.",
		severity: "error",
		from: {
			path: reusablePresentationPattern,
		},
		to: {
			path: "^src/@routes(?:/|$)",
		},
	},
	{
		name: "application-entrypoints-have-no-incoming-runtime-imports",
		comment:
			"Application entrypoints compose the renderer and generated routes; ordinary active code may reference their types but never their runtime implementations.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				applicationEntrypointPattern,
			],
		},
		to: {
			path: applicationEntrypointPattern,
			dependencyTypesNot: [
				"type-only",
			],
		},
	},
	{
		name: "pixi-motion-only-through-animation-driver",
		comment:
			"Pixi domains consume Arkini animation capabilities; only the animation driver may import Motion directly.",
		severity: "error",
		from: {
			path: "^src/ui/pixi(?:/|$)",
			pathNot: [
				"^src/ui/pixi/animation/createAnimationDriverFx[.]ts$",
			],
		},
		to: {
			path: "^node_modules/(?:motion|framer-motion)(?:/|$)",
		},
	},
	{
		name: "pixi-animation-driver-no-react-motion",
		comment:
			"The Pixi animation driver uses Motion's framework-neutral runtime and never its React entrypoint.",
		severity: "error",
		from: {
			path: "^src/ui/pixi/animation/createAnimationDriverFx[.]ts$",
		},
		to: {
			path: "^node_modules/(?:framer-motion(?:/|$)|motion/(?:react(?:[-/]|$)|dist/(?:es/)?react(?:[./-]|$)))",
		},
	},
	{
		name: "routes-enter-direct-owners",
		comment:
			"File routes own TanStack registration, lifecycle, and route-specific composition through reusable UI and direct domain/process owners. They may share only ignored route-private helpers and never import other route modules or application entrypoints.",
		severity: "error",
		from: {
			path: "^src/@routes(?:/|$)",
		},
		to: {
			path: "^src/@routes(?:/|$)",
			pathNot: [
				"^src/@routes/-launcher/fn/resolveLauncherLeaveDestinationFn[.]ts$",
				"^src/@routes/action/-GameLeaveDestinationSchema[.]ts$",
				"^src/@routes/action/-runActionRouteFx[.]ts$",
				"^src/@routes/editor/[$]projectId/editor/items/[$]itemUid/-parseEditorItemSectionIdFx[.]ts$",
				"^src/@routes/editor/[$]projectId/mcp/-parseEditorMcpSectionIdFx[.]ts$",
				"^src/@routes/editor/[$]projectId/project/-parseEditorProjectSectionIdFx[.]ts$",
			],
		},
	},

	{
		name: "renderer-code-only-imports-electron-contract",
		comment:
			"Renderer-process code, UI, and routes may consume the pure Electron transport contract directly, but never Electron runtime adapters or the Electron package.",
		severity: "error",
		from: {
			path: "^src(?:/|$)",
		},
		to: {
			path: "^(?:electron(?:/|$)|node_modules/electron(?:/|$))",
			pathNot: [
				"^electron/contract(?:/|$)",
			],
		},
	},
	{
		name: "active-code-no-unpacked-game-resource-imports",
		comment:
			"Application code consumes authored Game resources only through validated arkpacks, never through direct source-tree imports.",
		severity: "error",
		from: {
			path: "^(?:src|electron)(?:/|$)",
		},
		to: {
			path: "^game/[^/]+/(?:assets|resources)(?:/|$)",
		},
	},
	{
		name: "electron-main-no-renderer-imports",
		comment:
			"Electron main is the application backend and composition root: it may consume editor and engine owners, but never renderer-process ownership, presentation, routes, or renderer entrypoints.",
		severity: "error",
		from: {
			path: "^electron/main(?:/|$)",
		},
		to: {
			path: `^src/(?:renderer|ui|@routes)(?:/|$)|${productRendererPattern}|${productPresentationPattern}|${authoringProductRuntimePattern}|${authoringProductPresentationPattern}`,
		},
	},
	{
		name: "electron-support-no-application-imports",
		comment:
			"Electron support modules outside main and the pure contract stay platform-owned and never reach into application domains.",
		severity: "error",
		from: {
			path: "^electron(?:/|$)",
			pathNot: [
				"^electron/(?:contract|main)(?:/|$)",
			],
		},
		to: {
			path: "^src(?:/|$)|^electron/main(?:/|$)",
		},
	},
	{
		name: "electron-preload-is-transport-only",
		comment:
			"Electron preload exposes the pure transport contract and never reaches into application, backend, or renderer domains.",
		severity: "error",
		from: {
			path: "^electron/preload(?:/|$)",
		},
		to: {
			path: "^(?:src|electron)(?:/|$)",
			pathNot: [
				"^electron/(?:contract|preload)(?:/|$)",
			],
		},
	},
	{
		name: "domain-code-does-not-import-electron-contract",
		comment:
			"Framework-neutral Engine, Game Event facts, authored Game configuration, Arkpack artifacts, and product domains never depend on Electron transport contracts.",
		severity: "error",
		from: {
			path: `^src/(?:engine|editor)(?:/|$)|${gameRuntimePattern}|${gamePersistencePattern}|${gameStartPattern}|${gameEventPattern}|${itemDefinitionPattern}|${boardSpatialPattern}|${gameConfigPattern}|${arkpackArtifactPattern}|${productDomainPattern}|${authoringProductCorePattern}`,
		},
		to: {
			path: "^electron/contract(?:/|$)",
		},
	},
	{
		name: "electron-contract-is-pure",
		comment:
			"The shared Electron contract contains schemas, transport types, and channel names only; it never imports renderer, engine, or Electron runtime implementation code.",
		severity: "error",
		from: {
			path: "^electron/contract(?:/|$)",
		},
		to: {
			path: "^(?:src|electron)(?:/|$)|^node_modules/electron(?:/|$)",
			pathNot: [
				"^electron/contract(?:/|$)",
			],
		},
	},
	{
		name: "active-code-no-test-imports",
		comment:
			"Production and tooling code never import test support; tests may depend on active code, never the reverse.",
		severity: "error",
		from: {
			path: activeCodePattern,
		},
		to: {
			path: "^test(?:/|$)",
		},
	},
	{
		name: "active-code-no-archive-imports",
		comment:
			"The historical tree is a read-only oracle outside every active source root and may never be imported by production or tests.",
		severity: "error",
		from: {
			path: activeCodeAndTestsPattern,
		},
		to: {
			path: "^src/_archive(?:/|$)",
		},
	},
];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
	forbidden: [
		{
			name: "no-orphans",
			comment:
				"Active modules must participate in the dependency graph unless they are explicit execution or declaration roots.",
			severity: "error",
			from: {
				orphan: true,
				pathNot: [
					applicationEntrypointPattern,
					"^src/engine/cli/arkini[.]ts$",
					"^electron/(?:main|preload)/index[.]ts$",
					"^scripts/[^/]+[.]ts$",
					"^test/setup[.]ts$",
					"^(?:electron[.]vite|vitest)[.]config[.]ts$",
					"[.]worker[.]tsx?$",
					"[.]d[.](?:c|m)?ts$",
				],
			},
			to: {},
		},
		{
			name: "no-circular",
			comment:
				"Circular imports make ownership unclear. Extract the owning concept instead of making modules shake hands behind the shed.",
			severity: "error",
			from: {},
			to: {
				circular: true,
			},
		},
		{
			name: "not-to-unresolvable",
			comment:
				"This module depends on a module that cannot be found. Add a declared package or fix the import path.",
			severity: "error",
			from: {},
			to: {
				couldNotResolve: true,
			},
		},
		{
			name: "no-non-package-json",
			comment:
				"Runtime imports must be declared in package.json. Hidden dependency roulette remains frowned upon.",
			severity: "error",
			from: {},
			to: {
				dependencyTypes: [
					"npm-no-pkg",
					"npm-unknown",
				],
			},
		},
		{
			name: "not-to-dev-dep-from-active-src",
			comment:
				"Active production source must not import devDependencies unless the import is type-only or test-only.",
			severity: "error",
			from: {
				path: productionCodePattern,
				pathNot: [
					"[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
				],
			},
			to: {
				dependencyTypes: [
					"npm-dev",
				],
				dependencyTypesNot: [
					"type-only",
				],
				pathNot: [
					"node_modules/@types/",
					"node_modules/electron(?:/|$)",
				],
			},
		},
		{
			name: "not-to-test-from-production",
			comment:
				"Production code must not import tests or fixtures. Tests may depend on production, never the reverse.",
			severity: "error",
			from: {
				path: productionCodePattern,
				pathNot: [
					"[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
				],
			},
			to: {
				path: "[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
			},
		},
		...boundaryRules,
	],
	options: {
		doNotFollow: {
			path: [
				"node_modules",
			],
		},
		detectProcessBuiltinModuleCalls: true,
		prefix: `vscode://file/${process.cwd()}/`,
		tsPreCompilationDeps: true,
		tsConfig: {
			fileName: "tsconfig.test.json",
		},
		enhancedResolveOptions: {
			exportsFields: [
				"exports",
			],
			conditionNames: [
				"import",
				"require",
				"browser",
				"node",
				"default",
				"types",
			],
			mainFields: [
				"module",
				"main",
				"browser",
				"types",
				"typings",
			],
		},
		skipAnalysisNotInRules: true,
		reporterOptions: {
			dot: {
				collapsePattern: "node_modules/(?:@[^/]+/[^/]+|[^/]+)",
			},
			archi: {
				collapsePattern: "^(?:src|test|tests)/[^/]+|node_modules/(?:@[^/]+/[^/]+|[^/]+)",
			},
			text: {
				highlightFocused: true,
			},
		},
	},
};
