const activeCodePattern = "^(?:src|electron|shared|scripts)(?:/|$)";
const activeCodeAndTestsPattern = "^(?:src|electron|shared|scripts|test)(?:/|$)";
const productionCodePattern = "^(?:src|electron|shared)(?:/|$)";
const applicationEntrypointPattern = "^src/(?:main|createArkiniRouterFx|_route)[.]tsx?$";
const gameConfigPattern = "^src/game-config(?:/|$)";
const gameStartPattern = "^src/game-start(?:/|$)";
const arkpackArtifactPattern = "^src/arkpack/(?:ArkpackDescriptor[.]ts$|artifact(?:/|$))";
const productionPipelinePattern =
	"^src/(?:production-action|production-condition|production-delivery|production-input|production-job|production-line|production-output)(?:/|$)";
const productDomainPattern =
	"^src/(?:asset-authoring|item-authoring|flow|estimate|editor-build)/domain(?:/|$)";
const productRendererPattern =
	"^src/(?:arkpack|editor-build)/renderer(?:/|$)|^src/asset-authoring/(?:session|validation)(?:/|$)";
const productPresentationPattern =
	"^src/(?:asset-authoring|item-authoring|flow|estimate)/(?:ui|worker)(?:/|$)|^src/(?:arkpack|editor-build)/ui(?:/|$)";
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
		name: "game-start-is-a-framework-neutral-domain",
		comment:
			"Game Start schemas, exact placement planning, and atomic runtime initialization depend only on their own owner and exact Engine capabilities, never another product, presentation, routes, or Electron.",
		severity: "error",
		from: {
			path: gameStartPattern,
		},
		to: {
			path: "^src/(?!engine(?:/|$)|game-start(?:/|$))|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)",
		},
	},
	{
		name: "production-pipeline-is-framework-neutral",
		comment:
			"Production actions, conditions, inputs, lines, outputs, jobs, and deliveries depend only on exact gameplay owners, never authoring, delivery products, renderer ownership, presentation, routes, or Electron.",
		severity: "error",
		from: {
			path: productionPipelinePattern,
		},
		to: {
			path: `^src/(?:game-config|arkpack|asset-authoring|editor-build|item-authoring|flow|estimate|renderer|ui|@routes)(?:/|$)|${productRendererPattern}|${productPresentationPattern}|${authoringProductPattern}|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)`,
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
		name: "game-config-is-upstream-of-delivery",
		comment:
			"Authored config, source, diagnostics, validation, resources, and compilation stay platform-neutral and upstream of Arkpack delivery and Editor Build.",
		severity: "error",
		from: {
			path: gameConfigPattern,
		},
		to: {
			path: `^src/(?:arkpack|editor-build|renderer|ui|@routes)(?:/|$)|${productRendererPattern}|${productPresentationPattern}|${authoringProductPattern}|^electron(?:/|$)|^node_modules/(?:electron|react|react-dom|@tanstack/react-router)(?:/|$)`,
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
				"^src/engine/game/layer/GameCoreLayerFx[.]ts$",
				"^src/engine/runtime/internal/(?:makeRuntimeStoreFx|modifyRuntimeWithTransitionFx)[.]ts$",
			],
		},
		to: {
			path: "^src/engine/runtime/internal/RuntimeStoreFx[.]ts$",
		},
	},
	{
		name: "game-loop-has-concrete-owners",
		comment:
			"The mutable game loop is wired by its Engine layer and consumed only by the renderer game-session lifecycle.",
		severity: "error",
		from: {
			path: "^(?:src|electron)(?:/|$)",
			pathNot: [
				"^src/engine/game/layer/GameLoopLayerFx[.]ts$",
				"^src/renderer/game/session/createGameSessionFx[.]ts$",
			],
		},
		to: {
			path: "^src/engine/game/context/GameLoopFx[.]ts$",
		},
	},
	{
		name: "tick-has-concrete-engine-owners",
		comment:
			"Tick mutation stays inside the Engine core, its factory, and explicit tick operations.",
		severity: "error",
		from: {
			path: "^(?:src|electron)(?:/|$)",
			pathNot: [
				"^src/engine/game/layer/(?:GameCoreLayerFx|GameLoopLayerFx)[.]ts$",
			],
		},
		to: {
			path: "^src/engine/tick/context/TickFx[.]ts$",
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
				"^src/engine/game/layer/GameCoreLayerFx[.]ts$",
				"^src/engine/save/RuntimeSaveLayerFx[.]ts$",
				"^src/renderer/game/session/(?:createGameSessionFx|createGameSessionTransitionSubscriptionsFx)[.]ts$",
			],
		},
		to: {
			path: "^src/engine/runtime/context/CommittedTransitionsFx[.]ts$",
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
			"Framework-neutral Engine, authored Game configuration, Arkpack artifacts, and product domains never depend on Electron transport contracts.",
		severity: "error",
		from: {
			path: `^src/engine(?:/|$)|${gameStartPattern}|${gameConfigPattern}|${arkpackArtifactPattern}|${productDomainPattern}|${authoringProductCorePattern}`,
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
