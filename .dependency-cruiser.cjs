const activeCodePattern = "^(?:src|electron|shared|scripts)(?:/|$)";
const activeCodeAndTestsPattern = "^(?:src|electron|shared|scripts|test)(?:/|$)";
const productionCodePattern = "^(?:src|electron|shared)(?:/|$)";
const applicationEntrypointPattern = "^src/(?:main|createArkiniRouterFx|_route)[.]tsx?$";
const applicationDiagnosticsPattern = "^src/application-diagnostics(?:/|$)";
const applicationRuntimePattern = "^src/application-runtime(?:/|$)";
const applicationSettingsPattern = "^src/application-settings(?:/|$)";
const applicationShellPattern = "^src/application-shell(?:/|$)";
const chatGptAssetAuthoringPattern = "^src/chatgpt-asset-authoring(?:/|$)";
const authoringFormPattern = "^src/authoring-form(?:/|$)";
const applicationSettingsAllowedSourceDependencyPattern =
	"(?:application-settings(?:/|$)|application-diagnostics/(?:fn/readExactCauseFailureFn|fx/openDiagnosticDirectoryFx)[.]ts$|renderer/window/(?:WindowModeAtom|setWindowModeAtom)[.]ts$|ui/button/Button[.]tsx$)";
const applicationSettingsRetainedConsumerPattern =
	"^src/(?:main[.]tsx$|launcher/atom/LauncherStartupAtom[.]ts$|@routes/(?:_launcher/settings(?:[.]tsx$|/(?:common|dev|game)[.]tsx$)|game/[$]packageId/cheats[.]tsx$)|game-cheat/ui/useCheatItemSpotlightController[.]ts$|game-menu/ui/GameMenu[.]tsx$)";
const applicationShellAllowedSourceDependencyPattern =
	"(?:application-shell(?:/|$)|application-diagnostics/(?:fn/toDiagnosticValueFn|fx/(?:openDiagnosticDirectoryFx|writeDiagnosticRecordFx))[.]ts$|application-runtime/(?:fx/readRendererLifecycleFx|service/RendererRuntime)[.]ts$|ui/(?:button/Button|canvas/Canvas)[.]tsx$)";
const applicationShellRetainedConsumerPattern =
	"^src/(?:createArkiniRouterFx[.]tsx$|@routes/(?:__root[.]tsx$|action/-runActionRouteFx[.]ts$)|launcher/ui/LauncherScene[.]tsx$|game-cheat/ui/Cheats[.]tsx$|game-shell/ui/GameShell[.]tsx$)";
const chatGptAssetAuthoringAllowedSourceDependencyPattern =
	"(?:chatgpt-asset-authoring(?:/|$)|application-runtime/service/RendererRuntime[.]ts$|asset-authoring/(?:domain/fn/readEditorAssetResourceIdFn|session/saveEditorAssetFx|validation/validateEditorAssetFileFx)[.]ts$|authoring-session/ui/(?:useEditorProject|useEditorUnsavedChangesRegistration)[.]ts$|project-authoring/service/EditorProjectRepository[.]ts$|ui/(?:button/Button[.]tsx$|form/EditorInputClassName[.]ts$|reactivity/readSettledAsyncResultErrorFx[.]ts$))";
const authoringFormAllowedSourceDependencyPattern =
	"(?:authoring-form(?:/|$)|asset-authoring/ui/(?:EditorAssetAutocompleteField|EditorResourceUrlSession)[.]tsx$|authoring-session/ui/useEditorProject[.]ts$|item-definition/schema/ItemSchema[.]ts$|ui/(?:form/(?:EditorBooleanToggleBadge|EditorDurationHint|EditorFormContexts|EditorInfoTooltip|EditorInputClassName|EditorSearchCombobox|SelectableStateClassName)[.]tsx?$|form/fn/readEditorFieldErrorFn[.]ts$|item/ItemArtwork[.]tsx$))";
const authoringFormRetainedConsumerPattern =
	"^src/(?:asset-authoring/ui/EditorAssetDeleteSection[.]tsx$|estimate/ui/EditorItemEstimateListRow[.]tsx$|flow-canvas/ui/EditorGameFlow[.]tsx$|item-authoring/ui/(?:EditorItemArtworkDetail|EditorItemArtworkSection|EditorItemArtworkTimeline|EditorItemDeleteSection|EditorItemDetailReference|EditorItemListRow|EditorItemMergesSection|EditorItemProductionSection|EditorMergeField|useEditorItemFormController)[.]tsx?$|production-line-authoring/ui/(?:EditorLineField|EditorLineInputsControl|EditorOutputControl|EditorRollSetControl|EditorSelectorControl)[.]tsx$|project-authoring/ui/(?:EditorProjectStartGrid|EditorProjectStartGridSlot|EditorProjectStartItemPicker|useEditorProjectFormController)[.]tsx?$)";
const applicationRuntimeLowerCapabilityPattern =
	"^src/(?:renderer(?:/|$)|arkpack/renderer/ArkpackCatalogOwnerAtom[.]ts$|authoring-session/(?:service/EditorUnsavedChanges|atom/EditorUnsavedChangesOwnerAtom|fx/createEditorUnsavedChangesOwnerFx)[.]ts$|board-scenario/session/(?:EditorBoardGameResourceOwnerAtom|createEditorBoardGameResourceFx)[.]ts$|editor-build/domain/EditorBuildRepository[.]ts$|editor-build/renderer/createElectronEditorBuildRepositoryFx[.]ts$|game-persistence/(?:service/GameSaveStorage[.]ts$|fx/createElectronGameSaveStorageFx[.]ts$)|project-authoring/(?:service/EditorProjectRepository|fx/createElectronEditorProjectRepositoryFx)[.]ts$)";
const applicationRuntimeAllowedDependencyPattern =
	"src/(?:application-runtime(?:/|$)|application-diagnostics/fn/readExactCauseFailureFn[.]ts$|arkpack/renderer/ArkpackCatalogOwnerAtom[.]ts$|authoring-session/(?:service/EditorUnsavedChanges|atom/EditorUnsavedChangesOwnerAtom|fx/createEditorUnsavedChangesOwnerFx)[.]ts$|board-scenario/session/(?:EditorBoardGameResourceOwnerAtom|createEditorBoardGameResourceFx)[.]ts$|editor-build/domain/EditorBuildRepository[.]ts$|editor-build/renderer/createElectronEditorBuildRepositoryFx[.]ts$|game-persistence/(?:service/GameSaveStorage[.]ts$|fx/createElectronGameSaveStorageFx[.]ts$)|project-authoring/(?:service/EditorProjectRepository|fx/createElectronEditorProjectRepositoryFx)[.]ts$|renderer/game/(?:createGameFx[.]ts$|resource/(?:acquireGameEngineResourceFx|GameEngineResourceFx|GameEngineResourceLayer)[.]ts$))";
const gameEventPattern = "^src/game-event(?:/|$)";
const gameConfigPattern = "^src/game-config(?:/|$)";
const gameRuntimePattern = "^src/game-runtime(?:/|$)";
const gamePersistencePattern = "^src/game-persistence(?:/|$)";
const gameTickPattern = "^src/game-tick(?:/|$)";
const itemInteractionPattern = "^src/item-interaction(?:/|$)";
const itemDetailPattern = "^src/item-detail(?:/|$)";
const itemLineDetailPattern = "^src/item-line-detail(?:/|$)";
const tilePresentationPattern = "^src/tile-presentation(?:/|$)";
const tileRenderingPattern = "^src/tile-rendering(?:/|$)";
const tileMotionPattern = "^src/tile-motion(?:/|$)";
const tileInteractionPattern = "^src/tile-interaction(?:/|$)";
const gameScenePattern = "^src/game-scene(?:/|$)";
const gamePresentationPattern = "^src/game-presentation(?:/|$)";
const gameShellPattern = "^src/game-shell(?:/|$)";
const gameMenuPattern = "^src/game-menu(?:/|$)";
const gameAudioPattern = "^src/game-audio(?:/|$)";
const gameCheatPattern = "^src/game-cheat(?:/|$)";
const itemLineDetailReadPattern =
	"^src/item-line-detail/(?:fx/(?:readItemDetailInputsFx|readItemDetailLinesFx|readItemDetailMaterialAutofillAvailabilityFx|readItemDetailOutputFx)[.]ts$|type/ItemDetailLines[.]ts$)";
const itemLineDetailPresentationPattern =
	"^src/item-line-detail/(?:fx/projectItemDetailLinesFx[.]ts$|type/ItemDetailLinesProjection[.]ts$|ui(?:/|$))";
const itemInteractionAllowedSourceDependencyPattern =
	"(?:item-interaction(?:/|$)|engine/(?:common/schema/(?:IdSchema|NonNegativeIntegerSchema|PositiveIntegerSchema)[.]ts$|game/context/GameConfigFx[.]ts$|item/(?:error/(?:ItemNotFoundError|ItemNotOnBoardError|ItemNotOnGridError|ItemStatefulError)[.]ts$|fn/isItemPureFn[.]ts$)|revision/(?:fx/assertRevisionFx|schema/RevisionSchema)[.]ts$)|game-event/(?:fx/readOutputPlacementItemEventsFx[.]ts$|schema/(?:GameEventEnumSchema|GameEventSchema)[.]ts$)|game-runtime/(?:error/(?:ItemJobScopedError|ItemLocationConflictError)[.]ts$|fx/(?:removeRuntimeItemFx|removeRuntimeItemIdentityFx|reviseRuntimeItemFx)[.]ts$|internal/modifyRuntimeFx[.]ts$|read/(?:fn/(?:isBoardRuntimeItemFn|isGridRuntimeItemFn)[.]ts$|(?:readRuntimeFx|readRuntimeItemByIdFx)[.]ts$)|schema/(?:BoardRuntimeItemSchema|GridRuntimeItemSchema|RuntimeItemSchema|RuntimeSchema)[.]ts$)|item-definition/schema/TypeSchema[.]ts$|item-location/(?:error/CrossSpaceBoardOperationError[.]ts$|fn/(?:isItemLocationScopeAllowedFn|isSameGridLocationFn|readGridLocationClaimAtFn|readGridLocationClaimsFn)[.]ts$|schema/(?:BoardLocationSchema|GridLocationSchema|InventoryLocationSchema|LocationScopeEnumSchema)[.]ts$)|item-merge/(?:fx/(?:mergeItemsFx|resolveMergeRuleFx)[.]ts$|schema/(?:SourceActionSchema|TargetEffectSchema)[.]ts$)|item-placement/(?:error/PlacementUnavailableError[.]ts$|fn/(?:readBoardLocationsFn|readEmptyLocationsFn|readInventoryLocationsFn)[.]ts$|fx/(?:applyOutputPlacementFx|applyPlacementPlanFx|assertPlacementPlanCompleteFx|placeRuntimeItemFx|planInventoryPlacementFx)[.]ts$|schema/PlacementSchema[.]ts$|type/PlacementPlan[.]ts$)|production-input/(?:fn/resolveLineInputStoreFn[.]ts$|write/storeInputMaterialFx[.]ts$)|production-job/(?:fx/assertOwnerIdleFx[.]ts$|fx/read/resolveJobQueueFx[.]ts$)|production-line/fn/(?:isLineOwnerItemFn|readEffectiveDefaultLineFn)[.]ts$)";
const itemLineDetailReadAllowedSourceDependencyPattern =
	"(?:item-line-detail/(?:fx/(?:readItemDetailInputsFx|readItemDetailLinesFx|readItemDetailMaterialAutofillAvailabilityFx|readItemDetailOutputFx)[.]ts$|type/ItemDetailLines[.]ts$)|engine/(?:common/schema/(?:IdSchema|NonNegativeIntegerSchema|TimeSchema)[.]ts$|game/context/GameConfigFx[.]ts$|item-detail/read/readItemDetailSourcesFx[.]ts$|item/fn/readItemRemainingChargesFn[.]ts$|query/fx/queryFx[.]ts$)|game-runtime/(?:context/RuntimeFx[.]ts$|read/readBoardRuntimeItemByIdFx[.]ts$|schema/RuntimeSchema[.]ts$)|item-definition/(?:fn/matchesItemSelectorFn[.]ts$|schema/SelectorSchema[.]ts$)|item-location/schema/(?:BoardLocationSchema|DistanceSchema|LocationScopeEnumSchema)[.]ts$|production-condition/schema/WhenSchema[.]ts$|production-delivery/fn/readLineInputDeliveryClaimsFn[.]ts$|production-input/(?:type/InputRun[.]ts$|read/(?:fn/isMaterialInputEligibleFn|isLineInputAutofillSourceLocationFn)[.]ts$|schema/(?:ChargeSourceSchema|DepositSchema|InputSchema|ModeSchema|TypeSchema)[.]ts$)|production-job/(?:fx/(?:resolveActiveJobStatusFx|read/(?:resolveLineStartFx|resolveStartOutputCapacityFx))[.]ts$|schema/read/JobStatusEnumSchema[.]ts$)|production-line/(?:type/LineRun[.]ts$|fn/(?:isLineOwnerItemFn|readEffectiveDefaultLineFn|readLineOwnerLinesFn)[.]ts$|schema/(?:LineSchema|rule/TypeSchema)[.]ts$)|production-output/(?:fx/dropRulesFx[.]ts$|roll/schema/(?:RollSchema|TypeSchema)[.]ts$|schema/DropSchema[.]ts$))";
const itemLineDetailPresentationAllowedSourceDependencyPattern =
	"(?:item-line-detail(?:/|$)|item-detail-frame(?:/|$)|application-runtime/service/RendererRuntime[.]ts$|engine/(?:common/schema/(?:IdSchema|NonNegativeIntegerSchema)[.]ts$|item/fx/resolveItemFx[.]ts$)|game-presentation/ui/(?:useGameEngine|useRuntimeSelector)[.]ts$|game-runtime/schema/RuntimeSchema[.]ts$|item-definition/schema/SelectorSchema[.]ts$|item-location/schema/DistanceSchema[.]ts$|production-condition/schema/(?:TypeSchema|WhenSchema)[.]ts$|production-input/(?:schema/(?:ChargeSourceSchema|ModeSchema)[.]ts$|write/(?:withdrawLineInputFx|withdrawLineInputsFx)[.]ts$)|production-job/(?:schema/read/JobStatusEnumSchema[.]ts$|ui/(?:ProductionJobRuntime[.]tsx|readActiveJobRuntimeFn[.]ts$)|write/enqueueLineFx[.]ts$)|production-line/write/(?:setDefaultLineFx|unsetDefaultLineFx)[.]ts$|renderer/game/GameEngine[.]ts$|ui/(?:button/(?:Button|LinkButton)[.]tsx$|fn/formatDurationFn[.]ts$|scrollable/Scrollable[.]tsx$|search/useFuseSearch[.]ts$))";
const itemDetailAllowedSourceDependencyPattern =
	"(?:item-detail(?:/|$)|application-runtime/service/RendererRuntime[.]ts$|engine/(?:common/schema/IdSchema[.]ts$|item-detail/(?:fn/(?:readItemDetailInfoFn|readItemDetailTabsFn)[.]ts$|read/(?:readItemDetailIdentityFx|readItemDetailQueueFx|readItemDetailSourcesFx)[.]ts$|schema/ItemDetailTabEnumSchema[.]ts$))|game-presentation/ui/(?:useGameEngine|useRuntimeSelector)[.]ts$|game-runtime/schema/RuntimeSchema[.]ts$|item-definition/(?:schema/(?:StorageSchema|TypeSchema)[.]ts$|ui/ItemDefinitionLabels[.]ts$)|item-detail-frame/(?:fx/projectItemDetailReferenceFx[.]ts$|type/ItemDetailControl[.]ts$|ui/(?:ItemDetailHeader|ItemDetailMotion|useCloseItemDetail|useItemDetailControl|useItemDetailPendingCommand|useRetainedItemDetailProjection)[.]tsx?$)|item-line-detail/(?:type/ItemDetailLinesProjection[.]ts$|ui/(?:ItemLinesTab|ItemLineSummary|useItemDetailLines)[.]tsx?$)|production-job/(?:ui/(?:ProductionJobRuntime|readActiveJobRuntimeFn)[.]tsx?$|write/clearItemJobQueueFx[.]ts$)|renderer/game/GameEngine[.]ts$|ui/(?:badge/BadgeCount[.]tsx$|button/LinkButton[.]tsx$|fact/FactList[.]tsx$|focus/(?:dialogFocusableSelector|useDialogFocusContainment)[.]tsx?$|form/SelectableStateClassName[.]ts$|item/ItemIdentity[.]tsx$|scrollable/Scrollable[.]tsx$))";
const tilePresentationAllowedSourceDependencyPattern =
	"(?:tile-presentation(?:/|$)|engine/item/fn/readItemRemainingChargesFn[.]ts$|game-event/schema/(?:GameEventEnumSchema|GameEventSchema)[.]ts$|game-runtime/(?:read/fn/isGridRuntimeItemFn[.]ts$|schema/(?:CommittedTransitionSchema|GridRuntimeItemSchema|RuntimeItemSchema|RuntimeSchema)[.]ts$)|item-definition/schema/(?:AssetSchema|ItemSchema|TypeSchema)[.]ts$|item-interaction/fx/(?:readRuntimeInventoryOpenerFx|readRuntimeItemPrimaryActionFx)[.]ts$|item-location/(?:fn/isSameGridLocationFn[.]ts$|schema/(?:GridLocationSchema|LocationScopeEnumSchema)[.]ts$)|item-merge/schema/(?:SourceActionSchema|TargetEffectSchema)[.]ts$|production-job/(?:fx/resolveActiveJobStatusFx[.]ts$|schema/(?:JobSchema|read/JobStatusEnumSchema)[.]ts$)|production-line/fn/readRuntimeLineFillProgressFn[.]ts$|renderer/game/GameEngine[.]ts$)";
const tileRenderingAllowedSourceDependencyPattern =
	"(?:tile-rendering(?:/|$)|application-runtime/service/RendererRuntime[.]ts$|item-interaction/(?:fx/readDropItemPreviewFx|type/DropItemResult)[.]ts$|tile-presentation/type/TileActorItem[.]ts$)";
const tileMotionAllowedSourceDependencyPattern =
	"(?:tile-motion(?:/|$)|application-runtime/service/RendererRuntime[.]ts$|game-scene/(?:service/MainSurface|type/ActorPose)[.]ts$|item-location/schema/LocationScopeEnumSchema[.]ts$|tile-presentation/type/(?:TileActorItem|TileMotionCue)[.]ts$|tile-rendering/(?:fn/readTravelDurationMsFn[.]ts$|fx/(?:burstFeedbackParticlesFx|createRetargetablePoseSamplerFx|createTextureStoreFx|createTileActorFx|destroyTileActorFx|restoreActorExitFx|startActorEnterFx|startActorExitFx|startRemainderFeedbackFx|updateTileActorFx)[.]ts$|service/(?:ActorAnimator|AnimationDriver|MainActorStore|PixiApplicationOwner)[.]ts$|type/(?:PixiScenePalette|PixiTileActor)[.]ts$))";
const tileInteractionAllowedSourceDependencyPattern =
	"(?:tile-interaction(?:/|$)|application-diagnostics/(?:fn/toDiagnosticValueFn|fx/writeDiagnosticRecordFx)[.]ts$|application-runtime/service/RendererRuntime[.]ts$|engine/cheat/write/removeCheatItemFx[.]ts$|game-presentation/fx/(?:makeExactGameAtomFamilyFx|settleRendererCommandFailureFx)[.]ts$|game-scene/(?:service/InventoryActorStore|type/SceneLayout)[.]ts$|item-interaction/(?:fx/(?:dropItemFx|readDropItemPreviewFx|releaseInventoryItemFx|splitBoardItemStackFx)[.]ts$|type/DropItemResult[.]ts$)|item-location/schema/LocationScopeEnumSchema[.]ts$|production-job/write/(?:enqueueDefaultLineFx|fillDefaultLineQueueFx)[.]ts$|renderer/game/GameEngine[.]ts$|space-action/fx/activateSpaceItemFx[.]ts$|tile-motion/(?:fn/readSettleDurationMsFn[.]ts$|service/(?:MagneticField|MotionRuntime)[.]ts$|type/MotionTarget[.]ts$)|tile-presentation/type/(?:TileActorFeedbackCue|TileActorItem)[.]ts$|tile-rendering/(?:fn/(?:isSameTileActorLocationFn|readActorCursorFn)[.]ts$|fx/(?:animateRetargetablePoseFx|burstFeedbackParticlesFx|createRetargetablePoseSamplerFx|flashConsumedSourceFx|restoreActorExitFx|startActorExitFx)[.]ts$|service/(?:ActorAnimator|AnimationDriver|DemandFrameLoop|MainActorStore|PixiApplicationOwner)[.]ts$|type/PixiTileActor[.]ts$)|ui/drag/PointerDragThreshold[.]ts$)";
const gameSceneAllowedSourceDependencyPattern =
	"(?:game-scene(?:/|$)|application-runtime/service/RendererRuntime[.]ts$|game-event/schema/GameEventEnumSchema[.]ts$|game-menu/ui/GameMenuProvider[.]tsx$|game-presentation/ui/useGameEngine[.]ts$|game-runtime/(?:read/fn/isDeliveryRuntimeItemFn|schema/RuntimeSchema)[.]ts$|game-shell/ui/useInventoryShortcutKey[.]ts$|item-definition/schema/TypeSchema[.]ts$|item-detail-frame/ui/useItemDetailControl[.]ts$|item-interaction/type/DropItemResult[.]ts$|item-location/schema/(?:GridLocationSchema|LocationScopeEnumSchema)[.]ts$|renderer/game/(?:GameEngine|session/GameSession)[.]ts$|tile-interaction/(?:atom/(?:TileDefaultLineCommandAtom|runInventoryReleaseAtom|runSpaceActivationAtom|runTileDropAtom|runTileSplitAtom)[.]ts$|fx/(?:createCursorGrabMotionFx|createDropPresentationFx|createDropSubmissionFx|createGameInteractionControlFx|createInventoryDragControllerFx|createMainDragControllerFx|readTileDropPreviewFx)[.]ts$|type/(?:InventoryInteractionSurface|MainActivationIntent|MainInteractionSurface)[.]ts$)|tile-motion/(?:fn/(?:projectMotionItemFn|readSettleDurationMsFn)[.]ts$|fx/(?:chaseTargetFx|createLiveContactPoseReaderFx|createMagneticFieldFx|createMagneticProjectorFx|createMotionRuntimeFx|flashMotionTargetFx)[.]ts$|service/(?:MagneticField|MotionRuntime)[.]ts$)|tile-presentation/(?:fn/(?:readCommittedTileSwapMotionCueFn|readTileActorAssetSourceIdsFn|readTileActorBadgeCountFn|readTileActorFeedbackCuesFn)[.]ts$|fx/(?:readCommittedTileReplacementsFx|readTileActorVisualFx|readTileActorsFx|readTileMotionCuesFx)[.]ts$|type/(?:TileActorFeedbackCue|TileActorItem)[.]ts$)|tile-rendering/(?:fn/(?:isSameTileActorLocationFn|readCrowdAlphaFn)[.]ts$|fx/(?:animateRetargetablePoseFx|burstFeedbackParticlesFx|createActorAnimatorFx|createAnimationDriverFx|createApplicationOwnerFx|createMainActorStoreFx|createParticleTexturesFx|createTextureStoreFx|createTileActorFx|destroyTileActorFx|flashConsumedSourceFx|readScenePaletteFx|restoreActorExitFx|runActivityParticlesFx|runActorLifecycleFx|startActivityParticlesFx|startActorEnterFx|startActorExitFx|startRemainderFeedbackFx|stopActivityParticlesFx|transitionActorVisualFx|updateActorProgressFx|updateTileActorFx)[.]ts$|service/(?:ActorAnimator|AnimationDriver|MainActorStore|ParticleTextures|PixiApplicationOwner)[.]ts$|type/(?:PixiScenePalette|PixiTileActor)[.]ts$))";
const tileMotionRetainedConsumerPattern = `${tileInteractionPattern}|^src/game-scene/fx/(?:createDeliveryRuntimeFx|createMainReconcilerFx|createMainRuntimeFx)[.]ts$`;
const tileInteractionRetainedConsumerPattern =
	"^src/game-scene/(?:fx/(?:createDeliveryRuntimeFx|createInventoryRuntimeFx|createInventorySurfaceFx|createMainReconcilerFx|createMainRuntimeFx|createMainSurfaceFx)[.]ts$|service/(?:InventorySurface|MainSurface)[.]ts$|ui/(?:PixiBoardToolbarSurface|PixiGameRuntime|PixiInventorySurface)[.]tsx$)";
const gamePresentationAllowedSourceDependencyPattern =
	"(?:game-presentation(?:/|$)|application-diagnostics/fn/readExactCauseFailureFn[.]ts$|game-event/schema/GameEventBatchSchema[.]ts$|game-runtime/schema/RuntimeSchema[.]ts$|launcher/ui/ActionErrorPage[.]tsx$|renderer/game/(?:GameEngine|GameSaveBootstrapError|PlayableGame)[.]ts$|renderer/game/resource/CriticalGameLifecycleError[.]ts$|ui/button/Button[.]tsx$)";
const gamePresentationConsumerPattern =
	"^src/(?:game-audio|game-cheat|game-menu|game-shell|tile-interaction)(?:/|$)|^src/(?:item-detail|item-detail-frame|item-line-detail)(?:/|$)|^src/game-scene/ui/(?:PixiBoardToolbarSurface|PixiInventorySurface)[.]tsx$|^src/@routes/(?:action/load-game/[$]packageId|editor/[$]projectId/board|game/[$]packageId(?:/cheats)?)[.]tsx$";
const gameShellAllowedSourceDependencyPattern =
	"(?:game-shell(?:/|$)|application-runtime/service/RendererRuntime[.]ts$|application-shell/ui/RouteBackdrop[.]tsx$|game-audio/ui/GameAudio[.]tsx$|game-cheat/ui/(?:CheatItemSpawnProvider|CheatItemSpotlight)[.]tsx$|game-menu/ui/(?:GameMenu|GameMenuProvider)[.]tsx$|game-presentation/ui/useGameEngine[.]ts$|game-scene/ui/(?:PixiBoardToolbarSurface|PixiGameRuntime|PixiInventorySurface)[.]tsx$|item-detail/ui/ItemDetailModal[.]tsx$|item-detail-frame/ui/(?:ItemDetailHeader|ItemDetailProvider|useCloseItemDetail|useItemDetailControl)[.]tsx?$|item-line-detail/ui/ItemLineSummary[.]tsx$)";
const gameShellConsumerPattern =
	"^src/(?:@routes/(?:editor/[$]projectId/board(?:/(?:index|inventory))?|game/[$]packageId/(?:cheats|_scene(?:/(?:board|inventory))?))[.]tsx$|game-scene/ui/PixiBoardToolbarSurface[.]tsx$)";
const gameMenuAllowedSourceDependencyPattern =
	"(?:game-menu(?:/|$)|application-diagnostics/fn/readExactCauseFailureFn[.]ts$|application-runtime/fx/readRendererLifecycleFx[.]ts$|application-settings/ui/useCheatAvailability[.]ts$|game-persistence/service/RuntimeSaveFx[.]ts$|game-presentation/fx/makeExactGameAtomFamilyFx[.]ts$|renderer/game/Game[.]ts$|ui/button/Button[.]tsx$|ui/focus/(?:dialogFocusableSelector|useDialogFocusContainment)[.]tsx?$)";
const gameMenuConsumerPattern =
	"^src/(?:game-cheat|game-shell)(?:/|$)|^src/game-scene/ui/PixiBoardToolbarSurface[.]tsx$";
const gameAudioAllowedSourceDependencyPattern =
	"(?:game-audio(?:/|$)|application-diagnostics/fn/readExactCauseFailureFn[.]ts$|game-event/schema/GameEventEnumSchema[.]ts$|game-presentation/ui/(?:useGameEngine|useGameEvents)[.]ts$)";
const gameCheatAllowedSourceDependencyPattern =
	"(?:game-cheat(?:/|$)|application-settings/ui/useCheatAvailability[.]ts$|application-shell/ui/RouteBackdrop[.]tsx$|engine/cheat/(?:read/readCheatItemCatalogFx|write/(?:setCheatEnabledFx|setInstantGameplayFx|spawnCheatItemFx))[.]ts$|game-menu/ui/GameMenuProvider[.]tsx$|game-presentation/(?:fx/(?:makeExactGameAtomFamilyFx|settleRendererCommandFailureFx)[.]ts$|ui/useRuntimeSelector[.]ts$)|game-runtime/schema/RuntimeSchema[.]ts$|item-detail-frame/ui/useItemDetailControl[.]ts$|renderer/game/PlayableGame[.]ts$|ui/(?:button/Button[.]tsx$|search/(?:SpotlightSearchInput[.]tsx$|useFuseSearch[.]ts$)))";
const gameCheatConsumerPattern =
	"^src/game-shell(?:/|$)|^src/@routes/game/[$]packageId/cheats[.]tsx$";
const gameRuntimeAllowedSourceDependencyPattern =
	"(?:game-runtime(?:/|$)|game-config/schema/GameConfigSchema[.]ts$|engine/(?:cheat/schema/CheatStateSchema[.]ts$|common/schema/(?:IdSchema|NonNegativeIntegerSchema|PositiveIntegerSchema|TimeSchema)[.]ts$|game/context/GameConfigFx[.]ts$|item/(?:error/(?:ItemNotFoundError|ItemNotOnBoardError)[.]ts$|fn/(?:isItemPureWithIndexFn|readItemPurityIndexFn)[.]ts$|fx/resolveItemFx[.]ts$)|revision/(?:fx/createRevisionFx|schema/RevisionSchema)[.]ts$)|game-event/schema/GameEventSchema[.]ts$|item-definition/schema/(?:ItemSchema|StorageSchema|TypeSchema)[.]ts$|item-location/(?:fn/(?:indexGridLocationClaimsFn|isItemLocationScopeAllowedFn|readGridLocationClaimsFn)[.]ts$|schema/(?:BoardLocationSchema|DeliveryLocationSchema|GridLocationSchema|InputLocationSchema|JobLocationSchema|LocationSchema|LocationScopeEnumSchema|ReservedLocationSchema)[.]ts$)|production-delivery/(?:check/checkRuntimeDeliveriesFn|fx/reconcileOutboundDeliveriesRuntimeFx|schema/check/DeliveryTargetIssueSchema)[.]ts$|production-input/(?:check/checkRuntimeInputLocationsFn|fx/releaseOwnerInputsFx|schema/check/(?:InputCapacityExceededIssueSchema|InputLineMissingIssueSchema|InputOwnerMissingIssueSchema|InputSelectorMismatchIssueSchema|InputSlotInvalidIssueSchema))[.]ts$|production-job/(?:check/checkRuntimeJobsFn|error/JobOwnerBusyError|fn/readReservedJobOutputQuantitiesFn|schema/(?:JobQueueRequestSchema|JobSchema|DuplicateJobIdIssueSchema|JobConsumedMaterialStateIssueSchema|JobLineMissingIssueSchema|JobMaterialOrphanIssueSchema|JobOwnerMissingIssueSchema|JobOwnerMultipleActiveIssueSchema|JobOwnerNotOnGridIssueSchema|JobQueueExceededIssueSchema|JobTimeInvalidIssueSchema))[.]ts$|production-line/(?:fn/checkRuntimeDefaultLinesFn|schema/(?:DefaultLineByOwnerItemIdSchema|check/(?:DefaultLineIssueSchema|LineInputClosedIssueSchema)))[.]ts$)";
const gamePersistenceAllowedSourceDependencyPattern =
	"(?:game-persistence(?:/|$)|game-config/source/encodeGameProjectFileStemFn[.]ts$|game-runtime/(?:check/assertRuntimeFx|context/(?:CommittedTransitionsFx|RuntimeFx)|schema/(?:RuntimeItemSchema|RuntimeSchema))[.]ts$|engine/(?:cheat/schema/CheatStateSchema[.]ts$|common/schema/(?:IdSchema|NonNegativeIntegerSchema|PositiveIntegerSchema|TimeSchema)[.]ts$|filesystem/(?:FilesystemWrite|createFilesystemWriteFx)[.]ts$|item/fx/resolveItemFx[.]ts$|revision/fx/createRevisionFx[.]ts$|version/(?:ArkiniVersionAdmission|schema/(?:ArkiniVersionSchema|ArkpackVersionSchema))[.]ts$)|item-definition/schema/TypeSchema[.]ts$|item-location/schema/LocationSchema[.]ts$|production-job/schema/(?:JobQueueRequestSchema|JobSchema)[.]ts$|production-line/schema/DefaultLineByOwnerItemIdSchema[.]ts$)";
const gameTickAllowedSourceDependencyPattern =
	"(?:game-tick(?:/|$)|game-runtime/(?:context/RuntimeFx|internal/modifyRuntimeFx|schema/RuntimeSchema)[.]ts$|engine/(?:cheat/read/isInstantGameplayEnabledFx|common/schema/(?:IdSchema|TimeSchema|TimestampSchema)|item/temporary/fx/(?:advanceTemporaryItemDurationsFx|attemptTemporaryItemExpiryFx))[.]ts$|game-event/schema/(?:GameEventEnumSchema|GameEventSchema)[.]ts$|item-definition/schema/TypeSchema[.]ts$|item-location/(?:fn/isPassiveStorageLocationFn|schema/LocationScopeEnumSchema)[.]ts$|production-delivery/write/settleItemDeliveryRuntimeFx[.]ts$|production-job/(?:fx/(?:attemptJobCompletionFx|attemptQueuedLineStartFx|resolveJobRunnableFx)|schema/JobSchema)[.]ts$)";
const gameStartPattern = "^src/game-start(?:/|$)";
const itemDetailFramePattern = "^src/item-detail-frame(?:/|$)";
const itemDefinitionPattern = "^src/item-definition(?:/|$)";
const itemAuthoringValuePattern = "^src/item-authoring/(?:fn|schema|type)(?:/|$)";
const itemAuthoringEffectPattern = "^src/item-authoring/fx(?:/|$)";
const itemAuthoringCorePattern = "^src/item-authoring/(?:fn|fx|schema|type)(?:/|$)";
const productionLineAuthoringPattern = "^src/production-line-authoring(?:/|$)";
const itemAuthoringValueAllowedDependencyPattern =
	"(?:item-authoring/(?:fn|schema|type)(?:/|$)|game-config/(?:diagnostic/schema/(?:DiagnosticCodeEnumSchema|DiagnosticRecordEntityEnumSchema)[.]ts$|schema/GameConfigSchema[.]ts$|validation/rule/fn/validateConfigReferencesFn[.]ts$)|item-definition/schema/(?:BaseSchema|ItemSchema|TypeSchema)[.]ts$|item-merge/schema/MergeSchema[.]ts$|production-action/schema/(?:InputSchema|RuleSchema)[.]ts$|production-input/schema/InputSchema[.]ts$|production-line/(?:fn/readAuthoredItemLinesFn[.]ts$|schema/LineSchema[.]ts$)|production-output/schema/OutputSchema[.]ts$)";
const itemAuthoringEffectAllowedDependencyPattern =
	"(?:item-authoring/(?:fn|fx|schema|type)(?:/|$)|authoring-session/fx/publishEditorProjectFx[.]ts$|engine/editor/error/EditorProjectError[.]ts$|game-config/(?:diagnostic/schema/(?:DiagnosticCodeEnumSchema|DiagnosticRecordEntityEnumSchema)[.]ts$|schema/GameConfigSchema[.]ts$|validation/rule/fn/validateConfigReferencesFn[.]ts$)|item-definition/schema/ItemSchema[.]ts$|project-authoring/service/EditorProjectRepository[.]ts$)";
const productionLineAuthoringAllowedSourceDependencyPattern =
	"(?:production-line-authoring(?:/|$)|authoring-form/ui/(?:EditorForm|EditorItemAutocompleteField|useEditorItemSearchOptions)[.]tsx?$|authoring-session/ui/useEditorProject[.]ts$|item-definition/(?:query/schema/QuerySchema|schema/(?:QuantitySchema|SelectorSchema))[.]ts$|production-action/schema/RuleSchema[.]ts$|production-condition/schema/WhenSchema[.]ts$|production-input/schema/InputSchema[.]ts$|production-line/schema/(?:LineSchema|rule/RuleSchema)[.]ts$|production-output/(?:schema/(?:DropSchema|OutputSchema|drop/rule/RuleSchema)[.]ts$|roll/schema/(?:RollSchema|SetSchema|WeightedDropSchema)[.]ts$)|ui/(?:button/Button[.]tsx$|form/(?:EditorCapabilityStatus|EditorCollectionSelector|EditorFormCard|EditorFormSectionDivider|EditorValueControls)[.]tsx$|overlay/Tooltip[.]tsx$))";
const launcherPattern = "^src/launcher(?:/|$)";
const launcherAllowedSourceDependencyPattern =
	"(?:launcher(?:/|$)|application-diagnostics/fn/readExactCauseFailureFn[.]ts$|application-runtime/(?:atom/(?:RendererAtomRegistry|RendererLifecycleOwnerAtom)[.]ts$|fx/readRendererLifecycleFx[.]ts$|service/RendererRuntime[.]ts$)|application-settings/(?:atom/AppearanceAtom|fx/(?:applyCheatAvailabilityFx|readAppearanceAccentFx|readAppearanceThemeFx|readCheatAvailabilityFx))[.]ts$|application-shell/ui/RouteBackdrop[.]tsx$|arkpack/(?:artifact/schema/PayloadSchema[.]ts$|renderer/(?:ArkpackCatalogOwnerAtom|loadArkpackFx)[.]ts$)|renderer/(?:launcher/readLastPackageIdFx[.]ts$|window/(?:WindowModeAtom|WindowModeReadyAtom|readWindowModeFx)[.]ts$)|ui/(?:action/useExclusiveAction[.]ts$|button/(?:BackButton|Button)[.]tsx$|cursor/CursorSemantic[.]ts$))";
const launcherRetainedConsumerPattern =
	"^src/(?:main[.]tsx$|@routes/(?:index[.]tsx$|_launcher/(?:about|arkpacks|main-menu|settings)[.]tsx$|action/-runActionRouteFx[.]ts$|action/(?:discard-failed-game|recover-game-save)[.]tsx$|action/load-game/[$]packageId[.]tsx$|editor/welcome[.]tsx$|game/[$]packageId/action/(?:exit|leave|reset)[.]tsx$)|game-presentation/ui/GameEngineErrorView[.]tsx$|project-version/ui/EditorVersionRestoreAction[.]tsx$)";
const arkpackArtifactPattern = "^src/arkpack/(?:type/ArkpackDescriptor[.]ts$|artifact(?:/|$))";
const productionPipelinePattern =
	"^src/(?:production-action|production-condition|production-delivery|production-input|production-job|production-line|production-output)(?:/|$)";
const flowPattern = "^src/flow(?:/|$)";
const flowLayoutPattern = "^src/flow-layout(?:/|$)";
const flowCanvasPattern = "^src/flow-canvas(?:/|$)";
const productDomainPattern = `^src/(?:asset-authoring|estimate|editor-build)/domain(?:/|$)|${flowPattern}`;
const productRendererPattern =
	"^src/(?:arkpack|editor-build)/renderer(?:/|$)|^src/asset-authoring/(?:session|validation)(?:/|$)";
const productionJobPresentationPattern = "^src/production-job/ui(?:/|$)";
const boardSpatialPattern = "^src/(?:item-location|item-placement|item-merge|space-action)(?:/|$)";
const productPresentationPattern = `^src/(?:asset-authoring|item-authoring|estimate)/(?:ui|worker)(?:/|$)|${productionLineAuthoringPattern}|${launcherPattern}|${applicationSettingsPattern}|${applicationShellPattern}|${gamePresentationPattern}|${gameShellPattern}|${gameMenuPattern}|${gameAudioPattern}|${gameCheatPattern}|${chatGptAssetAuthoringPattern}|${authoringFormPattern}|^src/(?:flow-layout|flow-canvas)(?:/|$)|^src/(?:arkpack|editor-build)/ui(?:/|$)|${itemDetailPattern}|${itemDetailFramePattern}|${itemLineDetailPresentationPattern}|${tilePresentationPattern}|${tileRenderingPattern}|${tileMotionPattern}|${tileInteractionPattern}|${gameScenePattern}|${productionJobPresentationPattern}`;
const authoringProductPattern =
	"^src/(?:project-authoring|board-scenario|project-version|project-note|authoring-mcp|authoring-session|authoring-shell)(?:/|$)";
const authoringProductCorePattern =
	"^src/(?:board-scenario/(?!session(?:/|$)|toolbar(?:/|$))|project-version/(?:fn|schema|type)(?:/|$)|project-version/fx/readEditorProjectVersionHistoryFx[.]ts$|project-note/schema(?:/|$)|project-authoring/(?:error|fn|schema|service|type)(?:/|$)|project-authoring/fx/(?:createFreshEditorProjectFx|readEditorProjectFx)[.]ts$)";
const authoringProductRuntimePattern =
	"^src/(?:board-scenario/session(?:/|$)|project-authoring/fx/(?:createElectronEditorProjectRepositoryFx|invokeEditorProjectTransportFx)[.]ts$|authoring-session/(?:atom|fx|service)(?:/|$))";
const authoringProductPresentationPattern =
	"^src/(?:authoring-mcp|authoring-shell)(?:/|$)|^src/(?:board-scenario/toolbar|project-version/(?:atom|error|ui)|project-version/fx/checkoutEditorProjectVersionFx[.]ts$|project-note/(?:atom|fx|ui)|project-authoring/(?:atom|ui)|project-authoring/fx/(?:importEditorArkpackFileFx|refreshEditorServiceStatusFx|saveEditorProjectConfigFx)[.]ts$|authoring-session/ui)(?:/|$)";
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
			"Only Application Runtime, installed-game, authoring, root UI, and application command boundaries consume the shared diagnostics policy.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				applicationDiagnosticsPattern,
				applicationRuntimePattern,
				gameAudioPattern,
				gameMenuPattern,
				gamePresentationPattern,
				applicationSettingsPattern,
				applicationShellPattern,
				"^src/(?:@routes|authoring-mcp|item-detail-frame|project-authoring/atom|renderer/game|ui)(?:/|$)",
				"^src/tile-interaction/atom/TileDefaultLineCommandAtom[.]ts$",
				"^src/launcher/atom/MainMenuExitCommandAtom[.]ts$",
			],
		},
		to: {
			path: applicationDiagnosticsPattern,
		},
	},
	{
		name: "application-runtime-has-exact-composition-dependencies",
		comment:
			"Application Runtime may depend only on its own modules, the exact lower capabilities it composes, the native lifecycle contract, diagnostics normalization, and Effect Atom infrastructure.",
		severity: "error",
		from: {
			path: applicationRuntimePattern,
		},
		to: {
			path: `^(?!${applicationRuntimeAllowedDependencyPattern}|electron/contract/ArkiniElectronApi[.]ts$|node_modules/(?:@effect/atom-react|effect)(?:/|$))`,
		},
	},
	{
		name: "application-runtime-composition-is-one-way",
		comment:
			"Installed Game, persistence, catalog, repository, Board-session and unsaved-change capabilities may be composed by Application Runtime but never import that process root back.",
		severity: "error",
		from: {
			path: applicationRuntimeLowerCapabilityPattern,
		},
		to: {
			path: applicationRuntimePattern,
		},
	},
	{
		name: "application-settings-has-exact-dependencies",
		comment:
			"Application Settings owns Appearance, Cheat availability, and Settings command state through exact diagnostics, window, Electron-contract, and primitive UI leaves.",
		severity: "error",
		from: {
			path: applicationSettingsPattern,
		},
		to: {
			path: `^src/(?!${applicationSettingsAllowedSourceDependencyPattern})|^electron/(?!contract/(?:appearance/(?:AppearanceAccentSchema|AppearanceThemeSchema)|cheat/CheatAvailabilitySchema|cli/(?:CompletionStatus|InstallationStatus)|window/WindowModeSchema)[.]ts$)|^(?:shared|scripts)(?:/|$)|^node_modules/(?!@effect/atom-react(?:/|$)|effect(?:/|$)|react(?:/|$)|ts-pattern(?:/|$))`,
		},
	},
	{
		name: "application-settings-has-concrete-consumers",
		comment:
			"Only renderer startup, Settings and Cheat routes, Launcher startup, and exact cheat presentation leaves consume application-owned settings state and commands.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				applicationSettingsPattern,
				applicationSettingsRetainedConsumerPattern,
			],
		},
		to: {
			path: applicationSettingsPattern,
		},
	},
	{
		name: "application-shell-has-exact-dependencies",
		comment:
			"Application Shell owns root context, fatal presentation, and shared route transition behavior through exact runtime, diagnostics, and UI leaves.",
		severity: "error",
		from: {
			path: applicationShellPattern,
		},
		to: {
			path: `^src/(?!${applicationShellAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!@tanstack/react-router(?:/|$)|effect(?:/|$)|react(?:/|$)|ts-pattern(?:/|$))`,
		},
	},
	{
		name: "application-shell-has-concrete-consumers",
		comment:
			"Only renderer/router entrypoints and exact Launcher or shared shell leaves consume the application-shell boundary.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				applicationShellPattern,
				applicationShellRetainedConsumerPattern,
			],
		},
		to: {
			path: applicationShellPattern,
		},
	},
	{
		name: "game-presentation-is-the-low-level-react-game-capability",
		comment:
			"Game Presentation owns exact mounted-Game context, subscriptions, selectors, command settlement, and failure projection without absorbing scene, menu, audio, cheat, route, or gameplay authority.",
		severity: "error",
		from: {
			path: gamePresentationPattern,
		},
		to: {
			path: `^src/(?!${gamePresentationAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!@effect/atom-react(?:/|$)|@tanstack/react-router(?:/|$)|effect(?:/|$)|react(?:/|$))`,
		},
	},
	{
		name: "game-presentation-has-exact-consumers",
		comment:
			"Only exact game routes and the concrete shell, menu, audio, cheat, detail, tile-command, and retained Pixi consumers use mounted-Game presentation capabilities.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				gamePresentationPattern,
				gamePresentationConsumerPattern,
			],
		},
		to: {
			path: gamePresentationPattern,
		},
	},
	{
		name: "game-shell-composes-only-concrete-game-surfaces",
		comment:
			"Game Shell owns Board, Inventory, overlay precedence, route-resource composition, and shared shell interaction over explicit presentation owners without implementing gameplay or platform lifecycle.",
		severity: "error",
		from: {
			path: gameShellPattern,
		},
		to: {
			path: `^src/(?!${gameShellAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!lucide-react(?:/|$)|react(?:/|$))`,
		},
	},
	{
		name: "game-shell-has-exact-consumers",
		comment:
			"Only exact installed-game and Editor Board routes plus the concrete Board toolbar consume Game Shell surfaces or interaction policy.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				gameShellPattern,
				gameShellConsumerPattern,
			],
		},
		to: {
			path: gameShellPattern,
		},
	},
	{
		name: "chatgpt-asset-authoring-has-exact-dependencies",
		comment:
			"ChatGPT Asset Authoring owns the foreign surface lifecycle and confirmed asset insertion through exact authoring, runtime, Electron-contract, and UI leaves.",
		severity: "error",
		from: {
			path: chatGptAssetAuthoringPattern,
		},
		to: {
			path: `^src/(?!${chatGptAssetAuthoringAllowedSourceDependencyPattern})|^electron/(?!contract/chatgpt/ChatGptSurfaceSchema[.]ts$)|^(?:shared|scripts)(?:/|$)|^node_modules/(?!@effect/atom-react(?:/|$)|effect(?:/|$)|react(?:/|$))`,
		},
	},
	{
		name: "chatgpt-asset-authoring-has-one-route-consumer",
		comment:
			"Only the project-scoped ChatGPT route composes the ChatGPT Asset Authoring surface.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				chatGptAssetAuthoringPattern,
				"^src/@routes/editor/[$]projectId/chatgpt[.]tsx$",
			],
		},
		to: {
			path: chatGptAssetAuthoringPattern,
		},
	},
	{
		name: "authoring-form-has-exact-dependencies",
		comment:
			"Authoring Form owns the shared Editor form registry and canonical Item-reference controls through exact authoring data and reusable form primitives.",
		severity: "error",
		from: {
			path: authoringFormPattern,
		},
		to: {
			path: `^src/(?!${authoringFormAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!@tanstack/react-form(?:/|$)|lucide-react(?:/|$)|react(?:/|$)|tailwind-merge(?:/|$))`,
		},
	},
	{
		name: "authoring-form-has-concrete-consumers",
		comment:
			"Only exact Asset, Item, Project, Production Line, Estimate, and Flow authoring views consume the shared Authoring Form boundary.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				authoringFormPattern,
				authoringFormRetainedConsumerPattern,
			],
		},
		to: {
			path: authoringFormPattern,
		},
	},
	{
		name: "game-menu-owns-only-overlay-and-menu-commands",
		comment:
			"Game Menu owns its overlay lifecycle, exact save/close commands, and navigation intent without absorbing shell composition, audio, cheats, or canonical gameplay state.",
		severity: "error",
		from: {
			path: gameMenuPattern,
		},
		to: {
			path: `^src/(?!${gameMenuAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!@effect/atom-react(?:/|$)|@tanstack/react-router(?:/|$)|effect(?:/|$)|motion(?:/|$)|react(?:/|$)|ts-pattern(?:/|$))`,
		},
	},
	{
		name: "game-menu-has-concrete-overlay-consumers",
		comment:
			"Only Game Shell, Game Cheat spotlight precedence, and the retained Board surface consume Game Menu control.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				gameMenuPattern,
				gameMenuConsumerPattern,
			],
		},
		to: {
			path: gameMenuPattern,
		},
	},
	{
		name: "game-audio-is-event-only-presentation",
		comment:
			"Game Audio projects committed events into one failure-isolated route resource and never owns gameplay truth, shell composition, menu, cheats, or platform transport.",
		severity: "error",
		from: {
			path: gameAudioPattern,
		},
		to: {
			path: `^src/(?!${gameAudioAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!@effect/atom-react(?:/|$)|effect(?:/|$)|react(?:/|$)|ts-pattern(?:/|$))`,
		},
	},
	{
		name: "game-audio-has-one-route-resource-composer",
		comment: "Only the playable Game route resource boundary mounts Game Audio.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				gameAudioPattern,
				"^src/game-shell/ui/PlayableGameRoute[.]tsx$",
			],
		},
		to: {
			path: gameAudioPattern,
		},
	},
	{
		name: "game-cheat-owns-save-scoped-cheat-presentation",
		comment:
			"Game Cheat owns exact-Game cheat commands, screen model, and spawn spotlight lifecycle while consuming application cheat availability without taking ownership of that preference.",
		severity: "error",
		from: {
			path: gameCheatPattern,
		},
		to: {
			path: `^src/(?!${gameCheatAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!@effect/atom-react(?:/|$)|@tanstack/react-hotkeys(?:/|$)|effect(?:/|$)|react(?:/|$)|ts-pattern(?:/|$))`,
		},
	},
	{
		name: "game-cheat-has-concrete-shell-and-route-consumers",
		comment: "Only Game Shell and the exact installed-game Cheats route consume Game Cheat UI.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				gameCheatPattern,
				gameCheatConsumerPattern,
			],
		},
		to: {
			path: gameCheatPattern,
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
			path: `^src/(?:application-runtime|renderer|ui|@routes)(?:/|$)|${productRendererPattern}|${productPresentationPattern}|${authoringProductPattern}`,
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
			"Only Application Runtime, Game Session, installed-game, Board scenario, game-menu, and Electron-main composition consume persistence; lower gameplay domains never do.",
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
				"^src/application-runtime/service/RendererRuntime[.]ts$",
				"^src/renderer/game/Game[.]ts$",
				"^src/renderer/game/GameSaveBootstrapError[.]ts$",
				"^src/renderer/game/createGameFx[.]ts$",
				"^src/renderer/game/resource/createGameEngineResourceServiceFx[.]ts$",
				"^src/renderer/game/resource/internal/createFailedSaveRecoveryCapabilityFx[.]ts$",
				"^src/renderer/game/resource/internal/createGameEngineFinalizationCapabilityFx[.]ts$",
				"^src/renderer/game/session/GameSession[.]ts$",
				"^src/renderer/game/session/createGameSessionFx[.]ts$",
				"^src/game-menu/atom/gameMenuCommandAtom[.]ts$",
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
				"^src/item-detail/ui/ItemDetailModal[.]tsx$",
				"^src/game-shell/ui/GameShell[.]tsx$",
				"^src/board-scenario/toolbar/EditorBoardProductionLineLink[.]tsx$",
				"^src/item-authoring/ui/EditorProductionLineDetail[.]tsx$",
			],
		},
		to: {
			path: itemLineDetailPattern,
		},
	},
	{
		name: "item-detail-dialog-has-exact-presentation-dependencies",
		comment:
			"Item Detail dialog composition consumes only its exact frame, line, runtime-read, production-status, renderer and reusable UI leaves without routes, Electron, Pixi or gameplay authority.",
		severity: "error",
		from: {
			path: itemDetailPattern,
		},
		to: {
			path: `^src/(?!${itemDetailAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!effect(?:/|$)|lucide-react(?:/|$)|motion(?:/|$)|react(?:/|$)|ts-pattern(?:/|$))`,
		},
	},
	{
		name: "item-detail-dialog-has-one-production-composer",
		comment:
			"Only Game Shell composes the Item Detail dialog; Frame and Item Lines remain upstream exact owners rather than an umbrella dependency.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				itemDetailPattern,
				"^src/game-shell/ui/GameShell[.]tsx$",
			],
		},
		to: {
			path: itemDetailPattern,
		},
	},
	{
		name: "tile-presentation-is-a-framework-neutral-projection",
		comment:
			"Semantic tile actors, feedback, asset selection, and committed motion cues project exact runtime facts without taking ownership of retained Pixi objects, React, routes, platform, or gameplay mutation.",
		severity: "error",
		from: {
			path: tilePresentationPattern,
		},
		to: {
			path: `^src/(?!${tilePresentationAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!effect(?:/|$)|ts-pattern(?:/|$))`,
		},
	},
	{
		name: "tile-presentation-has-concrete-retained-consumers",
		comment:
			"Only Tile Rendering, Tile Motion, Tile Interaction, and retained Pixi scene execution consume semantic Tile Presentation contracts.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				tilePresentationPattern,
				tileRenderingPattern,
				tileMotionPattern,
				tileInteractionPattern,
				gameScenePattern,
			],
		},
		to: {
			path: tilePresentationPattern,
		},
	},
	{
		name: "tile-rendering-owns-retained-actor-capabilities",
		comment:
			"Tile Rendering owns native actor allocation, visuals, readiness, particles, animation channels, and palette projection without importing concrete scene composition, gameplay mutation, React, routes, or Electron.",
		severity: "error",
		from: {
			path: tileRenderingPattern,
		},
		to: {
			path: `^src/(?!${tileRenderingAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!effect(?:/|$)|motion(?:/|$)|pixi[.]js(?:/|$)|ts-pattern(?:/|$))`,
		},
	},
	{
		name: "tile-rendering-has-concrete-retained-consumers",
		comment:
			"Only Tile Motion, Tile Interaction, and retained Pixi scene execution consume Tile Rendering capabilities.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				tileRenderingPattern,
				tileMotionPattern,
				tileInteractionPattern,
				gameScenePattern,
			],
		},
		to: {
			path: tileRenderingPattern,
		},
	},
	{
		name: "tile-motion-owns-retained-playback-policy",
		comment:
			"Tile Motion owns deterministic playback policy and lifecycle over Tile Presentation plus exact retained Pixi capabilities, without React, routes, Electron, or gameplay mutation.",
		severity: "error",
		from: {
			path: tileMotionPattern,
		},
		to: {
			path: `^src/(?!${tileMotionAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!effect(?:/|$)|ts-pattern(?:/|$))`,
		},
	},
	{
		name: "tile-motion-has-concrete-retained-consumers",
		comment:
			"Only Tile Interaction plus retained Pixi delivery and scene composition consume Tile Motion playback contracts.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				tileMotionPattern,
				tileMotionRetainedConsumerPattern,
			],
		},
		to: {
			path: tileMotionPattern,
		},
	},
	{
		name: "tile-interaction-owns-retained-gesture-execution",
		comment:
			"Tile Interaction owns pointer, drag, drop, command admission, and cancellation policy over exact gameplay and retained-renderer capabilities without importing concrete scene composition.",
		severity: "error",
		from: {
			path: tileInteractionPattern,
		},
		to: {
			path: `^src/(?!${tileInteractionAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!effect(?:/|$)|pixi[.]js(?:/|$)|ts-pattern(?:/|$))`,
		},
	},
	{
		name: "tile-interaction-has-concrete-retained-consumers",
		comment:
			"Only concrete retained Pixi surfaces, scene runtimes, reconciliation, delivery, and the route-local provider consume Tile Interaction capabilities.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				tileInteractionPattern,
				tileInteractionRetainedConsumerPattern,
			],
		},
		to: {
			path: tileInteractionPattern,
		},
	},
	{
		name: "game-scene-has-exact-dependencies",
		comment:
			"Concrete retained Game scenes compose only exact runtime facts, installed-Game controls, retained tile capabilities, and reusable Game UI leaves.",
		severity: "error",
		from: {
			path: gameScenePattern,
		},
		to: {
			path: `^src/(?!${gameSceneAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!@effect/atom-react(?:/|$)|effect(?:/|$)|pixi[.]js(?:/|$)|react(?:/|$)|ts-pattern(?:/|$))`,
		},
	},
	{
		name: "game-scene-has-concrete-composers-and-capability-consumers",
		comment:
			"Only the installed Game shell composes Game Scene; Tile Motion and Tile Interaction may import its exact capability leaves under their own stricter dependency rules.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				gameScenePattern,
				tileMotionPattern,
				tileInteractionPattern,
				"^src/game-shell/ui/(?:GameShell|Inventory|PlayableBoard)[.]tsx$",
			],
		},
		to: {
			path: gameScenePattern,
		},
	},
	{
		name: "game-scene-reverse-capability-imports-are-type-only",
		comment:
			"Tile Motion and Tile Interaction may describe exact scene capabilities but cannot execute or compose concrete Game Scene modules.",
		severity: "error",
		from: {
			path: `(?:${tileMotionPattern}|${tileInteractionPattern})`,
		},
		to: {
			path: gameScenePattern,
			dependencyTypesNot: [
				"type-only",
			],
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
			path: `^src/(?:game-config|arkpack|editor-build|editor|item-authoring|flow|flow-layout|flow-canvas|estimate|application-runtime|renderer|ui|@routes)(?:/|$)|${productRendererPattern}|${productPresentationPattern}|${authoringProductPattern}|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)`,
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
			path: `^src/(?:game-config|arkpack|asset-authoring|editor-build|item-authoring|flow|flow-layout|flow-canvas|estimate|application-runtime|renderer|ui|@routes)(?:/|$)|${productRendererPattern}|${productPresentationPattern}|${authoringProductPattern}|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)`,
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
			path: "^src/(?:item-detail|item-line-detail)(?:/|$)|^src/item-interaction/fx/(?:dropItemFx|releaseInventoryItemFx|splitBoardItemStackFx)[.]ts$|^src/(?:production-input|production-job|production-line)/write(?:/|$)",
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
			path: `^src/(?:game-event|arkpack|editor-build|application-runtime|renderer|ui|@routes)(?:/|$)|${productRendererPattern}|${productPresentationPattern}|${authoringProductPattern}|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)`,
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
			path: `^src/arkpack/(?:renderer|ui)(?:/|$)|^src/editor-build(?:/|$)|^src/(?:application-runtime|renderer|ui|@routes)(?:/|$)|${productRendererPattern}|${productPresentationPattern}|${authoringProductPattern}|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)`,
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
				"^src/game-tick/layer/GameLoopLayerFx[.]ts$",
				"^src/renderer/game/session/createGameSessionFx[.]ts$",
			],
		},
		to: {
			path: "^src/game-tick/service/GameLoopFx[.]ts$",
		},
	},
	{
		name: "tick-has-concrete-game-tick-owners",
		comment: "Tick mutation stays inside the Game Tick layer and scoped production loop.",
		severity: "error",
		from: {
			path: "^(?:src|electron)(?:/|$)",
			pathNot: [
				"^src/game-tick/layer/(?:GameLoopLayerFx|TickLayerFx)[.]ts$",
			],
		},
		to: {
			path: "^src/game-tick/service/TickFx[.]ts$",
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
				"^src/game-persistence/layer/RuntimeSaveLayerFx[.]ts$",
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
			"Asset Authoring, Flow core, Estimate, and Editor Build domain owners stay platform-neutral and never import product UI/workers, shared UI, renderer ownership, routes, or Electron.",
		severity: "error",
		from: {
			path: productDomainPattern,
		},
		to: {
			path: `^src/(?:application-runtime|renderer|ui|@routes)(?:/|$)|${productRendererPattern}|${productPresentationPattern}|${authoringProductRuntimePattern}|${authoringProductPresentationPattern}|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)`,
		},
	},
	{
		name: "item-authoring-values-have-exact-dependencies",
		comment:
			"Item Authoring functions, schemas, and types own explicit value policy and never depend on presentation, routes, Electron, renderer lifecycle, or unrelated product capabilities.",
		severity: "error",
		from: {
			path: itemAuthoringValuePattern,
		},
		to: {
			path: `^src/(?!${itemAuthoringValueAllowedDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!fuse[.]js(?:/|$)|ts-pattern(?:/|$)|zod(?:/|$))`,
		},
	},
	{
		name: "item-authoring-effects-have-exact-dependencies",
		comment:
			"Item Authoring Effects own repository mutation and mounted-project publication through exact capabilities without importing UI, routes, Electron, or renderer composition.",
		severity: "error",
		from: {
			path: itemAuthoringEffectPattern,
		},
		to: {
			path: `^src/(?!${itemAuthoringEffectAllowedDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!effect(?:/|$))`,
		},
	},
	{
		name: "production-line-authoring-has-exact-presentation-dependencies",
		comment:
			"Production Line Authoring controls Line, Input, Rule, and Output contracts through exact schemas, the mounted authoring read, and reusable UI without importing Item Authoring, routes, runtime, renderer, or platform ownership.",
		severity: "error",
		from: {
			path: productionLineAuthoringPattern,
		},
		to: {
			path: `^src/(?!${productionLineAuthoringAllowedSourceDependencyPattern})|^(?:electron|shared|scripts)(?:/|$)|^node_modules/(?!lucide-react(?:/|$)|react(?:/|$)|ts-pattern(?:/|$))`,
		},
	},
	{
		name: "production-line-authoring-has-concrete-consumers",
		comment:
			"Only Item Authoring composition and the Board Scenario line link consume the controlled production-line authoring surface.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				productionLineAuthoringPattern,
				"^src/board-scenario/toolbar/EditorBoardProductionLineLink[.]tsx$",
				"^src/item-authoring/ui/(?:EditorItemChargesSection|EditorItemProductionSection|EditorMergeField|EditorProductionLineDetail|EditorSpaceActionSection)[.]tsx$",
			],
		},
		to: {
			path: productionLineAuthoringPattern,
		},
	},
	{
		name: "launcher-has-exact-renderer-shell-dependencies",
		comment:
			"Launcher owns renderer-session bootstrap, Hero/About resources, splash coordination, and shell/action presentation through exact current capabilities without absorbing Settings, Appearance, routes, Game, or Electron runtime.",
		severity: "error",
		from: {
			path: launcherPattern,
		},
		to: {
			path: `^src/(?!${launcherAllowedSourceDependencyPattern})|^electron/(?!contract/(?:appearance/(?:AppearanceAccentSchema|AppearanceThemeSchema)|window/WindowModeSchema)[.]ts$)|^shared/(?!ArkiniAppMetadata[.]ts$)|^scripts(?:/|$)|^node_modules/(?!@effect/atom-react(?:/|$)|@tanstack/react-router(?:/|$)|effect(?:/|$)|motion(?:/|$)|react(?:/|$)|ts-pattern(?:/|$))`,
		},
	},
	{
		name: "launcher-has-concrete-shell-consumers",
		comment:
			"Only the renderer root, exact route leaves, Project Version restore, and Game failure projection consume Launcher startup or full-shell surfaces.",
		severity: "error",
		from: {
			path: activeCodePattern,
			pathNot: [
				launcherPattern,
				launcherRetainedConsumerPattern,
			],
		},
		to: {
			path: launcherPattern,
		},
	},
	{
		name: "flow-layout-stays-upstream-of-flow-canvas",
		comment:
			"Flow Layout owns geometry and worker lifecycle consumed by Flow Canvas; it never imports canvas projection, painters, hooks, or React UI back.",
		severity: "error",
		from: {
			path: flowLayoutPattern,
		},
		to: {
			path: flowCanvasPattern,
		},
	},
	{
		name: "flow-core-stays-upstream-of-layout-and-canvas",
		comment:
			"Canonical authored acquisition truth never imports the layout worker or product Canvas consumers.",
		severity: "error",
		from: {
			path: flowPattern,
		},
		to: {
			path: `(?:${flowLayoutPattern}|${flowCanvasPattern})`,
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
			"Portable authoring schemas, policies, types, and repository contracts remain framework-neutral even when their product root also owns explicit UI, Atom, and renderer Effect layers.",
		severity: "error",
		from: {
			path: authoringProductCorePattern,
		},
		to: {
			path: `^src/(?:application-runtime|renderer|ui|@routes)(?:/|$)|${productPresentationPattern}|${authoringProductRuntimePattern}|${authoringProductPresentationPattern}|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)`,
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
		name: "retained-rendering-motion-only-through-animation-driver",
		comment:
			"Retained rendering owners consume Arkini animation capabilities; only the Tile Rendering animation driver may import Motion directly.",
		severity: "error",
		from: {
			path: "^src/(?:game-scene|tile-rendering)(?:/|$)",
			pathNot: [
				"^src/tile-rendering/fx/createAnimationDriverFx[.]ts$",
			],
		},
		to: {
			path: "^node_modules/(?:motion|framer-motion)(?:/|$)",
		},
	},
	{
		name: "tile-rendering-animation-driver-no-react-motion",
		comment:
			"The Tile Rendering animation driver uses Motion's framework-neutral runtime and never its React entrypoint.",
		severity: "error",
		from: {
			path: "^src/tile-rendering/fx/createAnimationDriverFx[.]ts$",
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
			path: `^src/(?:application-runtime|renderer|ui|@routes)(?:/|$)|${productRendererPattern}|${productPresentationPattern}|${authoringProductRuntimePattern}|${authoringProductPresentationPattern}`,
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
			path: `^src/(?:engine|editor)(?:/|$)|${gameRuntimePattern}|${gamePersistencePattern}|${gameStartPattern}|${gameEventPattern}|${itemDefinitionPattern}|${boardSpatialPattern}|${gameConfigPattern}|${arkpackArtifactPattern}|${itemAuthoringCorePattern}|${productDomainPattern}|${authoringProductCorePattern}`,
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
