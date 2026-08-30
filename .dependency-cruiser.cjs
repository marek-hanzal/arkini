const activeCodePattern = "^(?:src|electron|shared|scripts)(?:/|$)";
const activeCodeAndTestsPattern = "^(?:src|electron|shared|scripts|test)(?:/|$)";
const productionCodePattern = "^(?:src|electron|shared)(?:/|$)";
const applicationEntrypointPattern = "^src/(?:main|createArkiniRouterFx|_route)[.]tsx?$";
const fnOperationPattern = "^src/[^\\n]*(?:/fn/|Fn[.]tsx?$)";
const fxOperationPattern = "^src/[^\\n]*(?:/fx/|Fx[.]tsx?$)";
const uiModulePattern = "^src/(?:ui|[^\\n]*/ui)(?:/|$)";
const routeModulePattern = "^src/@routes(?:/|$)";
const routeCompositionPattern = "^(?:src/@routes(?:/|$)|src/_route[.]ts$)";
const electronContractPattern = "^electron/contract(?:/|$)";
const electronPreloadPattern = "^electron/preload(?:/|$)";
const filesystemWritePattern = "^src/filesystem-write(?:/|$)";

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
			name: "filesystem-write-stays-mechanical",
			comment:
				"The shared Node-only write capability owns lock and durable single-file mechanics without importing its product consumers.",
			severity: "error",
			from: {
				path: filesystemWritePattern,
			},
			to: {
				path: "^(?:src|electron|shared)(?:/|$)",
				pathNot: [
					filesystemWritePattern,
				],
			},
		},
		{
			name: "tick-lifecycle-owners-stay-upstream",
			comment:
				"Production delivery/jobs and temporary-item lifecycle provide behavior to Game Tick and never import its clock, replay, or loop implementation.",
			severity: "error",
			from: {
				path: "^src/(?:production-(?:delivery|job)|engine/item/temporary)(?:/|$)",
			},
			to: {
				path: "^src/game-tick(?:/|$)",
			},
		},
		{
			name: "game-session-stays-upstream-of-playable-game",
			comment:
				"The canonical session lifecycle provides runtime execution to playable and installed Game capabilities without importing their renderer/package ownership.",
			severity: "error",
			from: {
				path: "^src/game-session(?:/|$)",
			},
			to: {
				path: "^src/(?:playable-game|installed-game)(?:/|$)",
			},
		},
		{
			name: "playable-game-stays-package-independent",
			comment:
				"Package-independent live Game capabilities provide behavior to installed-game bootstrap and lifecycle without importing Arkpack/save ownership.",
			severity: "error",
			from: {
				path: "^src/playable-game(?:/|$)",
			},
			to: {
				path: "^src/installed-game(?:/|$)",
			},
		},
		{
			name: "item-detail-reads-stay-upstream",
			comment:
				"Shared Item Detail reads and projections provide facts to Frame, Lines, and presentation owners without importing those consumers.",
			severity: "error",
			from: {
				path: "^src/item-detail-read(?:/|$)",
			},
			to: {
				path: "^src/item-(?:detail|detail-frame|line-detail)(?:/|$)",
			},
		},
		{
			name: "runtime-and-tick-stay-upstream-of-game-cheat",
			comment:
				"Canonical Runtime and Tick consume persisted cheat facts directly; Game Cheat commands may compose them, but the dependency never reverses.",
			severity: "error",
			from: {
				path: "^src/(?:game-runtime|game-tick)(?:/|$)",
			},
			to: {
				path: "^src/game-cheat(?:/|$)",
			},
		},
		{
			name: "item-query-dependencies-stay-upstream",
			comment:
				"Canonical Runtime, authored Item selection, and Location semantics provide facts to Item Query without importing query execution.",
			severity: "error",
			from: {
				path: "^src/(?:game-runtime|item-definition|item-location)(?:/|$)",
			},
			to: {
				path: "^src/item-query(?:/|$)",
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
			name: "estimate-demand-does-not-import-consumers",
			comment:
				"Estimate demand grouping is the lowest pure policy and never imports witness, projection, or orchestration owners.",
			severity: "error",
			from: {
				path: "^src/estimate-demand(?:/|$)",
			},
			to: {
				path: "^src/(?:estimate(?:/|$)|estimate-(?:projection|witness)(?:/|$))",
			},
		},
		{
			name: "estimate-witness-does-not-import-consumers",
			comment:
				"Estimate witness vocabulary may consume demand semantics but never projection or orchestration owners.",
			severity: "error",
			from: {
				path: "^src/estimate-witness(?:/|$)",
			},
			to: {
				path: "^src/(?:estimate(?:/|$)|estimate-projection(?:/|$))",
			},
		},
		{
			name: "estimate-projection-does-not-import-orchestration",
			comment:
				"Estimate projection consumes stable witnesses and owns its output contract without importing orchestration.",
			severity: "error",
			from: {
				path: "^src/estimate-projection(?:/|$)",
			},
			to: {
				path: "^src/estimate(?:/|$)",
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
					routeModulePattern,
					applicationEntrypointPattern,
				],
			},
			to: {
				path: uiModulePattern,
			},
		},
		{
			name: "non-routes-do-not-import-routes",
			comment:
				"Routes are terminal application composition. Active code provides behavior to routes and never imports route registration or route-private helpers.",
			severity: "error",
			from: {
				path: activeCodePattern,
				pathNot: [
					routeCompositionPattern,
				],
			},
			to: {
				path: routeModulePattern,
			},
		},
		{
			name: "renderer-code-only-imports-electron-contract",
			comment:
				"Renderer code consumes the pure Electron transport contract directly and never imports Electron process implementation or the Electron package.",
			severity: "error",
			from: {
				path: "^src(?:/|$)",
			},
			to: {
				path: "^(?:electron(?:/|$)|node_modules/electron(?:/|$))",
				pathNot: [
					electronContractPattern,
				],
			},
		},
		{
			name: "electron-contract-is-pure",
			comment:
				"The shared Electron contract owns schemas, transport types, and channel names without importing application or Electron runtime implementation.",
			severity: "error",
			from: {
				path: electronContractPattern,
			},
			to: {
				path: "^(?:src|electron)(?:/|$)|^node_modules/electron(?:/|$)",
				pathNot: [
					electronContractPattern,
				],
			},
		},
		{
			name: "electron-preload-is-transport-only",
			comment:
				"Electron preload may consume its own modules, the pure transport contract, and the Electron bridge API, but no application or backend implementation.",
			severity: "error",
			from: {
				path: electronPreloadPattern,
			},
			to: {
				path: activeCodePattern,
				pathNot: [
					electronContractPattern,
					electronPreloadPattern,
				],
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
