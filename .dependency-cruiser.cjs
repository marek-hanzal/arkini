/** @type {import('dependency-cruiser').IForbiddenRuleType[]} */
const boundaryRules = [
	{
		name: "engine-no-presentation-imports",
		comment:
			"The standalone engine never depends on UI, route composition, or renderer entrypoints.",
		severity: "error",
		from: {
			path: "^src/engine(?:/|$)",
		},
		to: {
			path: "^src/(?:renderer|ui|@routes)(?:/|$)|^src/(?:main|router|_route)\\.tsx?$",
		},
	},
	{
		name: "engine-compiler-no-pack-imports",
		comment:
			"The completed-config compiler is upstream of binary packing and never depends on pack implementation modules.",
		severity: "error",
		from: {
			path: "^src/engine/compiler(?:/|$)",
		},
		to: {
			path: "^src/engine/pack(?:/|$)",
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
				"^src/engine/game/layer/GameCoreLayerFx[.]ts$",
				"^src/engine/tick/(?:internal/makeTickFx|fx/runTickRuntimeByFx|fx/runTickRuntimeFx)[.]ts$",
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
				"^src/engine/runtime/read/readCommittedTransitionFx[.]ts$",
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
		name: "editor-domain-no-presentation-imports",
		comment:
			"The shared editor domain is platform-neutral and never depends on renderer process ownership, UI, routes, or Electron.",
		severity: "error",
		from: {
			path: "^src/editor(?:/|$)",
		},
		to: {
			path: "^src/(?:renderer|ui|@routes)(?:/|$)|^src/(?:main|router|_route)\\.tsx?$|^electron(?:/|$)|^node_modules/electron(?:/|$)",
		},
	},
	{
		name: "renderer-process-no-presentation-imports",
		comment:
			"Concrete renderer-process lifecycle and transport owners never depend on reusable UI, routes, or renderer entrypoints.",
		severity: "error",
		from: {
			path: "^src/renderer(?:/|$)",
		},
		to: {
			path: "^src/(?:ui|@routes)(?:/|$)|^src/(?:main|router|_route)\\.tsx?$",
		},
	},
	{
		name: "ui-no-route-imports",
		comment:
			"Reusable UI imports exact Engine and Editor owners or concrete renderer-process capabilities directly, but never route registration or route-specific composition.",
		severity: "error",
		from: {
			path: "^src/ui(?:/|$)",
		},
		to: {
			path: "^src/@routes(?:/|$)|^src/(?:main|router|_route)\\.tsx?$",
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
			path: "^src/@routes(?:/|$)|^src/(?:main|router|_route)\\.tsx?$",
			pathNot: [
				"^src/@routes/-resolveLauncherLeaveDestinationFx[.]ts$",
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
			path: "^(?:src/(?:engine|editor|renderer|ui|@routes)|src/(?:main|router|_route)\\.tsx?)(?:/|$)",
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
			path: "^src/(?:renderer|ui|@routes)(?:/|$)|^src/(?:main|router|_route)\\.tsx?$",
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
			"Framework-neutral Engine and Editor domains never depend on Electron transport contracts.",
		severity: "error",
		from: {
			path: "^src/(?:engine|editor)(?:/|$)",
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
			path: "^(?:src/(?:engine|editor|renderer|ui|@routes)|src/(?:main|router|_route)\\.tsx?|electron)(?:/|$)",
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
			path: "^(?:src/(?:engine|editor|renderer|ui|@routes)|src/(?:main|router|_route)\\.tsx?|electron|test)(?:/|$)",
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
				path: "^(?:src/(?:engine|editor|renderer|ui|@routes)|src/(?:main|router|_route)\\.tsx?|electron)(?:/|$)",
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
				path: "^(?:src/(?:engine|editor|renderer|ui|@routes)|src/(?:main|router|_route)\\.tsx?|electron)(?:/|$)",
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
