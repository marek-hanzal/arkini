const activeCodePattern = "^(?:src|electron|shared|scripts)(?:/|$)";
const activeCodeAndTestsPattern = "^(?:src|electron|shared|scripts|test)(?:/|$)";
const productionCodePattern = "^(?:src|electron|shared)(?:/|$)";
const applicationEntrypointPattern = "^src/(?:main|createArkiniRouterFx|_route)[.]tsx?$";
const fnOperationPattern = "^src/[^\\n]*(?:/fn/|Fn[.]tsx?$)";
const fxOperationPattern = "^src/[^\\n]*(?:/fx/|Fx[.]tsx?$)";
const uiModulePattern = "^src/(?:ui|[^\\n]*/ui)(?:/|$)";

/**
 * Dependency rules state the forbidden import directly: `from` must not import `to`.
 * Keep this file limited to stable graph-wide invariants. Product ownership belongs in
 * ARCHITECTURE.md unless it can be expressed as one small direction that remains useful
 * when modules and consumers change.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
	forbidden: [
		{
			name: "no-orphans",
			comment:
				"Active modules participate in the graph unless they are explicit execution, worker, configuration, or declaration roots.",
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
			comment: "Module cycles hide ownership and make change impact harder to reason about.",
			severity: "error",
			from: {},
			to: {
				circular: true,
			},
		},
		{
			name: "not-to-unresolvable",
			comment: "Every import resolves to a declared module.",
			severity: "error",
			from: {},
			to: {
				couldNotResolve: true,
			},
		},
		{
			name: "no-non-package-json",
			comment: "Runtime package imports are declared in package.json.",
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
			name: "not-to-dev-dep-from-production",
			comment: "Production code does not execute packages installed only for development.",
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
			name: "active-code-does-not-import-tests",
			comment:
				"Tests may consume active code; active code never consumes tests or test support.",
			severity: "error",
			from: {
				path: activeCodePattern,
			},
			to: {
				path: "(?:^test(?:/|$)|[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$)",
			},
		},
		{
			name: "active-code-does-not-import-archive",
			comment: "The historical source archive is not an active dependency.",
			severity: "error",
			from: {
				path: activeCodeAndTestsPattern,
			},
			to: {
				path: "^src/_archive(?:/|$)",
			},
		},
		{
			name: "active-code-does-not-import-unpacked-game-resources",
			comment:
				"Application code consumes authored Game resources only through validated Arkpacks.",
			severity: "error",
			from: {
				path: "^(?:src|electron)(?:/|$)",
			},
			to: {
				path: "^game/[^/]+/(?:assets|resources)(?:/|$)",
			},
		},
		{
			name: "fn-does-not-import-runtime-fx",
			comment:
				"Fn provides total value operations to Fx. A Fn never imports runtime Fx composition; type-only references do not execute an Fx.",
			severity: "error",
			from: {
				path: fnOperationPattern,
			},
			to: {
				path: fxOperationPattern,
				dependencyTypesNot: [
					"type-only",
				],
			},
		},
		{
			name: "non-ui-does-not-import-ui",
			comment:
				"UI consumes non-UI providers. Modules outside UI and application composition never import UI implementation.",
			severity: "error",
			from: {
				path: activeCodePattern,
				pathNot: [
					uiModulePattern,
					"^src/@routes(?:/|$)",
					applicationEntrypointPattern,
				],
			},
			to: {
				path: uiModulePattern,
			},
		},
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
