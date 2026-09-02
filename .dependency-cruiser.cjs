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
const authoringMcpTransportSchemaPattern =
	"^src/authoring-mcp/schema/EditorMcp(?:CommandResult|Command|Configuration|Overview)Schema[.]ts$";
const filesystemWritePattern = "^src/filesystem-write(?:/|$)";
const gameValuePattern = "^src/game-value(?:/|$)";
const itemRevisionPattern = "^src/item-revision(?:/|$)";
const rendererBootstrapPattern = "^src/renderer-bootstrap(?:/|$)";

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
					"^src/arkini-cli/arkini[.]ts$",
					"^electron/(?:main|preload)/index[.]ts$",
					"^electron/builder/beforeBuild[.]mjs$",
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
			name: "application-version-does-not-import-game-version",
			comment:
				"Application writer admission is independent from project-owned gameplay compatibility.",
			severity: "error",
			from: {
				path: "^src/application-version(?:/|$)",
			},
			to: {
				path: "^src/game-version(?:/|$)",
			},
		},
		{
			name: "game-version-does-not-import-application-version",
			comment:
				"Project-owned gameplay compatibility does not depend on Arkini application releases.",
			severity: "error",
			from: {
				path: "^src/game-version(?:/|$)",
			},
			to: {
				path: "^src/application-version(?:/|$)",
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
			name: "game-value-stays-foundational",
			comment:
				"Game Value owns immutable scalar schemas without importing aggregate, runtime, authoring, or platform owners.",
			severity: "error",
			from: {
				path: gameValuePattern,
			},
			to: {
				path: activeCodePattern,
				pathNot: [
					gameValuePattern,
				],
			},
		},
		{
			name: "item-revision-stays-upstream",
			comment:
				"Item Revision owns opaque optimistic-concurrency tokens and stale-write rejection without importing its Runtime or command consumers.",
			severity: "error",
			from: {
				path: itemRevisionPattern,
			},
			to: {
				path: activeCodePattern,
				pathNot: [
					itemRevisionPattern,
					"^src/game-value/schema/IdSchema[.]ts$",
				],
			},
		},
		{
			name: "item-revision-uses-id-schema-as-type-only",
			comment:
				"Revision conflict payloads share exact entity identity as a type contract without a runtime dependency on Game Value.",
			severity: "error",
			from: {
				path: itemRevisionPattern,
			},
			to: {
				path: "^src/game-value/schema/IdSchema[.]ts$",
				dependencyTypesNot: [
					"type-only",
				],
			},
		},
		{
			name: "tick-lifecycle-owners-stay-upstream",
			comment:
				"Production delivery/jobs and temporary-item lifecycle provide behavior to Game Tick and never import its clock, replay, or loop implementation.",
			severity: "error",
			from: {
				path: "^src/(?:production-(?:delivery|job)|temporary-item)(?:/|$)",
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
			name: "item-resolution-dependencies-stay-upstream",
			comment:
				"Loaded config, authored Item definitions, and Location values provide facts to Item Resolution without importing its lookup operation or failure.",
			severity: "error",
			from: {
				path: "^src/(?:game-config|item-definition|item-location)(?:/|$)",
			},
			to: {
				path: "^src/item-resolution(?:/|$)",
			},
		},
		{
			name: "item-state-isolation-stays-upstream-of-production",
			comment:
				"Shared stateful-owner stack isolation provides candidate transitions to production without importing its consumers.",
			severity: "error",
			from: {
				path: "^src/item-state-isolation(?:/|$)",
			},
			to: {
				path: "^src/production-(?:action|delivery|input|job|line)(?:/|$)",
			},
		},
		{
			name: "renderer-bootstrap-is-terminal",
			comment:
				"Only the physical renderer entrypoint starts the explicit downstream bootstrap owner.",
			severity: "error",
			from: {
				path: activeCodePattern,
				pathNot: [
					rendererBootstrapPattern,
					"^src/main[.]tsx$",
				],
			},
			to: {
				path: rendererBootstrapPattern,
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
			name: "authoring-mcp-backend-does-not-import-electron-contract",
			comment:
				"The Node-compatible MCP backend owns its semantic contracts without depending on the Electron transport seam.",
			severity: "error",
			from: {
				path: "^src/authoring-mcp/(?:auth|fx|http|schema|storage|tool|tunnel|type)(?:/|$)",
			},
			to: {
				path: electronContractPattern,
			},
		},
		{
			name: "electron-contract-is-pure",
			comment:
				"The shared Electron contract owns transport types and channel names without importing application behavior or Electron runtime implementation.",
			severity: "error",
			from: {
				path: electronContractPattern,
			},
			to: {
				path: "^(?:src|electron)(?:/|$)|^node_modules/electron(?:/|$)",
				pathNot: [
					electronContractPattern,
					authoringMcpTransportSchemaPattern,
				],
			},
		},
		{
			name: "electron-contract-uses-authoring-mcp-schemas-as-types-only",
			comment:
				"Electron transport refers to MCP-owned payloads without executing or re-owning their schemas.",
			severity: "error",
			from: {
				path: electronContractPattern,
			},
			to: {
				path: authoringMcpTransportSchemaPattern,
				dependencyTypesNot: [
					"type-only",
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
