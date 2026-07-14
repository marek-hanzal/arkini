/** @type {import('dependency-cruiser').IForbiddenRuleType[]} */
const boundaryRules = [
	{
		name: "engine-core-no-ui-imports",
		comment:
			"The engine remains standalone. UI adapters depend on public engine services, never the other way around.",
		severity: "error",
		from: {
			path: "^src/v1/(?!ui(?:/|$))",
		},
		to: {
			path: "^src/v1/ui(?:/|$)",
		},
	},
	{
		name: "ui-no-engine-internal-imports",
		comment:
			"UI is a thin adapter over public engine services. Internal modules stay behind their owning domain boundaries.",
		severity: "error",
		from: {
			path: "^src/v1/ui(?:/|$)",
		},
		to: {
			path: "^src/v1/(?!ui(?:/|$)).+/internal(?:/|$)",
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
			name: "not-to-dev-dep-from-src",
			comment:
				"Production source must not import devDependencies unless the import is type-only or test-only.",
			severity: "error",
			from: {
				path: "^src(?:/|$)",
				pathNot: [
					"[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
					"^src/vite-env\\.d\\.ts$",
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
				"Production code must not import tests or fixtures. Tests may depend on production, never the reverse.",
			severity: "error",
			from: {
				pathNot: [
					"[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
					"^src/vite-env\\.d\\.ts$",
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
