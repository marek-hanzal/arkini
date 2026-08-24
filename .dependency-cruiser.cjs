/** @type {import('dependency-cruiser').IForbiddenRuleType[]} */
const boundaryRules = [
	{
		name: "engine-no-presentation-imports",
		comment:
			"The standalone engine never depends on UI, page composition, routes, or renderer entrypoints.",
		severity: "error",
		from: {
			path: "^src/engine(?:/|$)",
		},
		to: {
			path: "^src/(?:bridge|ui|page|@routes)(?:/|$)|^src/(?:main|router|_route)\\.tsx?$",
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
			path: "^src/engine(?:/|$)",
			pathNot: [
				"^src/engine/game/layer/GameCoreLayerFx[.]ts$",
				"^src/engine/runtime/internal/(?:makeRuntimeStoreFx|modifyRuntimeFx)[.]ts$",
			],
		},
		to: {
			path: "^src/engine/runtime/internal/RuntimeStoreFx[.]ts$",
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
			"The shared editor domain is platform-neutral and never depends on bridge, UI, pages, routes, renderer entrypoints, or Electron.",
		severity: "error",
		from: {
			path: "^src/editor(?:/|$)",
		},
		to: {
			path: "^src/(?:bridge|ui|page|@routes)(?:/|$)|^src/(?:main|router|_route)\\.tsx?$|^electron(?:/|$)|^node_modules/electron(?:/|$)",
		},
	},
	{
		name: "bridge-no-presentation-imports",
		comment:
			"Bridge domains connect UI to public engine contracts and never depend on reusable UI, pages, routes, or renderer entrypoints.",
		severity: "error",
		from: {
			path: "^src/bridge(?:/|$)",
		},
		to: {
			path: "^src/(?:ui|page|@routes)(?:/|$)|^src/(?:main|router|_route)\\.tsx?$",
		},
	},
	{
		name: "bridge-no-engine-internal-imports",
		comment:
			"The bridge may consume public engine modules but never bypass a domain through engine internals.",
		severity: "error",
		from: {
			path: "^src/bridge(?:/|$)",
		},
		to: {
			path: "^src/engine/.+/internal(?:/|$)",
		},
	},
	{
		name: "ui-only-enters-engine-through-bridge",
		comment:
			"Reusable UI consumes game truth only through bridge domains and never imports the engine directly.",
		severity: "error",
		from: {
			path: "^src/ui(?:/|$)",
		},
		to: {
			path: "^src/engine(?:/|$)",
		},
	},
	{
		name: "ui-no-page-or-route-imports",
		comment:
			"Reusable UI may depend on bridge domains but never on route-level page composition or router registration.",
		severity: "error",
		from: {
			path: "^src/ui(?:/|$)",
		},
		to: {
			path: "^src/(?:page|@routes)(?:/|$)|^src/(?:main|router|_route)\\.tsx?$",
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
				"^src/ui/pixi/animation/createPixiAnimationDriverFx[.]ts$",
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
			path: "^src/ui/pixi/animation/createPixiAnimationDriverFx[.]ts$",
		},
		to: {
			path: "^node_modules/(?:framer-motion(?:/|$)|motion/(?:react(?:[-/]|$)|dist/(?:es/)?react(?:[./-]|$)))",
		},
	},
	{
		name: "page-only-composes-ui",
		comment:
			"Pages compose UI and router layout only; engine and bridge access stays inside reusable UI boundaries.",
		severity: "error",
		from: {
			path: "^src/page(?:/|$)",
		},
		to: {
			path: "^src/(?:engine|bridge|@routes)(?:/|$)|^src/(?:main|router|_route)\\.tsx?$",
		},
	},
	{
		name: "routes-enter-public-renderer-seams",
		comment:
			"File routes own TanStack registration and lifecycle orchestration through pages, reusable UI contracts, and public bridge capabilities, but never engine internals or other route modules.",
		severity: "error",
		from: {
			path: "^src/@routes(?:/|$)",
		},
		to: {
			path: "^src/(?:engine|@routes)(?:/|$)|^src/(?:main|router|_route)\\.tsx?$",
		},
	},

	{
		name: "renderer-only-imports-electron-contract",
		comment:
			"Renderer code may consume the pure Electron transport contract through bridge domains, but never Electron runtime adapters or the Electron package.",
		severity: "error",
		from: {
			path: "^(?:src/(?:engine|bridge|ui|page|@routes)|src/(?:main|router|_route)\\.tsx?)(?:/|$)",
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
			"Electron main is the application backend and composition root: it may consume public editor and engine modules, but never renderer bridges, presentation, pages, routes, or renderer entrypoints.",
		severity: "error",
		from: {
			path: "^electron/main(?:/|$)",
		},
		to: {
			path: "^src/(?:bridge|ui|page|@routes)(?:/|$)|^src/(?:main|router|_route)\\.tsx?$",
		},
	},
	{
		name: "electron-main-only-imports-public-engine-modules",
		comment:
			"Electron main may compose public engine capabilities but never reach through a domain's internal implementation boundary.",
		severity: "error",
		from: {
			path: "^electron/main(?:/|$)",
		},
		to: {
			path: "^src/engine/.+/internal(?:/|$)",
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
		name: "electron-contract-only-through-bridge-or-electron",
		comment:
			"The shared Electron contract is consumed only by renderer bridge domains and Electron platform adapters, never by engine, UI, pages, or renderer entrypoints.",
		severity: "error",
		from: {
			path: "^(?:src/(?:engine|ui|page|@routes)|src/(?:main|router|_route)\\.tsx?)(?:/|$)",
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
			path: "^(?:src/(?:engine|bridge|ui|page|@routes)|src/(?:main|router|_route)\\.tsx?|electron)(?:/|$)",
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
			path: "^(?:src/(?:engine|bridge|ui|page|@routes)|src/(?:main|router|_route)\\.tsx?|electron|test)(?:/|$)",
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
				path: "^(?:src/(?:engine|bridge|ui|page|@routes)|src/(?:main|router|_route)\\.tsx?|electron)(?:/|$)",
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
				path: "^(?:src/(?:engine|bridge|ui|page|@routes)|src/(?:main|router|_route)\\.tsx?|electron)(?:/|$)",
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
