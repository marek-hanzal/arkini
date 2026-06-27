/** @type {import('dependency-cruiser').IForbiddenRuleType[]} */
const boundaryRules = [
	{
		name: "tile-engine-no-arkini-domain-imports",
		comment:
			"TileEngine is generic interaction infrastructure. Inject Arkini behavior through props/adapters instead of importing game domains.",
		severity: "error",
		from: {
			path: "^src/v0/tile-engine(?:/|$)",
		},
		to: {
			path: [
				"^src/v0/(?:activation|board|craft|database|debug|game|inventory|item|item-instance|manifest|play|upgrade)(?:/|$)",
			],
		},
	},
	{
		name: "tile-engine-public-api-only",
		comment:
			"Code outside TileEngine must import the public ~/v0/tile-engine barrel instead of reaching into package internals.",
		severity: "error",
		from: {
			path: "^src/v0/(?!tile-engine(?:/|$)).+",
		},
		to: {
			path: "^src/v0/tile-engine/.+",
			pathNot: [
				"^src/v0/tile-engine/index\\.ts$",
			],
		},
	},
	{
		name: "manifest-no-runtime-imports",
		comment:
			"Manifest owns static game definitions only. Runtime state, UI and persistence must not leak back into game data.",
		severity: "error",
		from: {
			path: "^src/v0/manifest(?:/|$)",
		},
		to: {
			path: [
				"^src/v0/(?:activation|board|craft|database|inventory|item|item-instance|play|tile-engine|upgrade)(?:/|$)",
			],
		},
	},
	{
		name: "domain-fx-no-react-imports",
		comment:
			"Domain Fx roots are durable use-cases. React belongs in action/query hooks and components, not in Effect/persistence roots.",
		severity: "error",
		from: {
			path: "^src/v0/(?:activation|board|craft|inventory|item|upgrade)/fx(?:/|$)",
		},
		to: {
			path: "^node_modules/(?:@tanstack/react-query|react|react-dom)(?:/|$)",
		},
	},
	{
		name: "game-domain-no-runtime-ui-imports",
		comment:
			"The game domain is pure gameplay state/Effect logic. UI, Play runtime, Debug and TileEngine depend on it, never the other way around.",
		severity: "error",
		from: {
			path: "^src/v0/game(?:/|$)",
		},
		to: {
			path: [
				"^src/v0/(?:board|debug|inventory|item|play|producer|tile-engine|ui)(?:/|$)",
				"^node_modules/(?:@tanstack/react-query|react|react-dom)(?:/|$)",
			],
		},
	},
	{
		name: "diagnostics-no-feature-imports",
		comment:
			"Diagnostics is low-level instrumentation. Feature layers may record to it, but it must not import feature/UI/game modules back.",
		severity: "error",
		from: {
			path: "^src/v0/diagnostics(?:/|$)",
		},
		to: {
			path: [
				"^src/v0/(?:activation|board|craft|database|debug|game|inventory|item|item-instance|manifest|play|producer|tile-engine|upgrade)(?:/|$)",
			],
		},
	},
	{
		name: "play-drop-no-legacy-resolve-wrapper",
		comment:
			"Use ~/v0/play/drop/resolveDrop directly. The old ~/v0/play/resolveDrop wrapper is intentionally not a public API.",
		severity: "error",
		from: {
			path: "^src/v0(?:/|$)",
		},
		to: {
			path: "^src/v0/play/resolveDrop\\.ts$",
		},
	},
];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
	forbidden: [
		{
			name: "no-circular",
			comment:
				"Circular imports make ownership unclear. Extract shared types/helpers instead of making modules shake hands behind the shed.",
			severity: "error",
			from: {},
			to: {
				circular: true,
			},
		},
		{
			name: "not-to-unresolvable",
			comment:
				"This module depends on a module that cannot be found. If it is an npm module, add it to package.json; otherwise fix the import path.",
			severity: "error",
			from: {},
			to: {
				couldNotResolve: true,
			},
		},
		{
			name: "no-non-package-json",
			comment:
				"Runtime imports must be declared in package.json. Hidden dependency roulette is somehow still frowned upon.",
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
			name: "not-to-dev-dep-from-src",
			comment:
				"Production src code must not import devDependencies unless the import is type-only or test-only.",
			severity: "error",
			from: {
				path: "^src(?:/|$)",
				pathNot: [
					"[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
					"^src/vite-env\.d\.ts$",
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
				],
			},
		},
		{
			name: "not-to-test-from-production",
			comment:
				"Production code must not import test files or fixtures. Tests can depend on production; not the other way around.",
			severity: "error",
			from: {
				pathNot: [
					"[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
					"^src/vite-env\.d\.ts$",
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
			fileName: "tsconfig.json",
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
