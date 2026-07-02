/** @type {import('dependency-cruiser').IForbiddenRuleType[]} */
const boundaryRules = [
	{
		name: "tile-engine-no-arkini-domain-imports",
		comment:
			"TileEngine is generic interaction infrastructure. Inject Arkini behavior through props/adapters instead of importing gameplay domains.",
		severity: "error",
		from: {
			path: "^src/tile-engine(?:/|$)",
		},
		to: {
			path: [
				"^src/(?:action|activation|board|cheat|config|craft|debug|effects|engine|event|inventory|item|job|limit|loot|merge|placement|play|producer|quantity|remove|save|selector|stash|storage|world)(?:/|$)",
			],
		},
	},
	{
		name: "domain-fx-no-react-imports",
		comment:
			"Domain Fx roots are durable use-cases. React belongs in action/query hooks and components, not in Effect/persistence roots.",
		severity: "error",
		from: {
			path: "^src/(?:activation|board|craft|inventory|item|producer)/fx(?:/|$)",
		},
		to: {
			path: "^node_modules/(?:@tanstack/react-query|react|react-dom)(?:/|$)",
		},
	},
	{
		name: "gameplay-domain-no-runtime-ui-imports",
		comment:
			"Gameplay domains are pure state/Effect logic. UI, Play runtime and TileEngine depend on them, never the other way around.",
		severity: "error",
		from: {
			path: "^src/(?:action|activation|cheat|config|craft|effects|engine|event|job|limit|loot|placement|quantity|remove|save|selector|stash|storage|world)(?:/|$)",
		},
		to: {
			path: [
				"^src/(?:item|play|tile-engine|ui)(?:/|$)",
				"^node_modules/(?:@tanstack/react-query|react|react-dom)(?:/|$)",
			],
		},
	},
	{
		name: "no-local-index-barrel-imports",
		comment:
			"Import concrete modules directly. Barrel/index files hide ownership and are not a domain boundary.",
		severity: "error",
		from: {
			path: "^src(?:/|$)",
		},
		to: {
			path: "^src/.+/index\\.ts$",
		},
	},
	{
		name: "play-drop-no-legacy-resolve-wrapper",
		comment:
			"Use ~/play/drop/resolveDrop directly. The old ~/play/resolveDrop wrapper is intentionally not a public API.",
		severity: "error",
		from: {
			path: "^src(?:/|$)",
		},
		to: {
			path: "^src/play/resolveDrop\\.ts$",
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
