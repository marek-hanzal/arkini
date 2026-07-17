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
		name: "cli-no-presentation-imports",
		comment:
			"CLI tooling may use the engine but never bridge, UI, page, route, or renderer entrypoint code.",
		severity: "error",
		from: {
			path: "^cli(?:/|$)",
		},
		to: {
			path: "^src/(?:bridge|ui|page|@routes)(?:/|$)|^src/(?:main|router|_route)\\.tsx?$",
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
		name: "routes-only-compose-pages",
		comment:
			"File routes are registration seams. Active application code enters them through standalone page components.",
		severity: "error",
		from: {
			path: "^src/@routes(?:/|$)",
		},
		to: {
			path: "^src/(?:engine|bridge|ui|@routes)(?:/|$)|^src/(?:main|router|_route)\\.tsx?$",
		},
	},

	{
		name: "renderer-no-electron-imports",
		comment:
			"Renderer, engine, bridge, page, and routes stay independent from Electron and its platform source root.",
		severity: "error",
		from: {
			path: "^(?:src/(?:engine|bridge|ui|page|@routes)|src/(?:main|router|_route)\\.tsx?)(?:/|$)",
		},
		to: {
			path: "^(?:electron(?:/|$)|node_modules/electron(?:/|$))",
		},
	},
	{
		name: "cli-no-electron-runtime-imports",
		comment:
			"CLI tooling may reuse explicit Electron build verification, but never Electron main/preload runtime adapters.",
		severity: "error",
		from: {
			path: "^cli(?:/|$)",
		},
		to: {
			path: "^electron/(?:main|preload)(?:/|$)|^node_modules/electron(?:/|$)",
		},
	},
	{
		name: "electron-platform-no-renderer-imports",
		comment:
			"Electron main/preload are thin platform adapters and never import engine, bridge, React UI, pages, routes, or renderer entrypoints.",
		severity: "error",
		from: {
			path: "^electron(?:/|$)",
		},
		to: {
			path: "^src/(?:engine|bridge|ui|page|@routes)(?:/|$)|^src/(?:main|router|_route)\\.tsx?$",
		},
	},
	{
		name: "desktop-contract-only-through-bridge-or-electron",
		comment:
			"The shared desktop contract is consumed only by the renderer bridge and Electron platform adapters, never by engine, UI, pages, routes, or CLI.",
		severity: "error",
		from: {
			path: "^(?:src/(?:engine|ui|page|@routes)|src/(?:main|router|_route)\\.tsx?|cli)(?:/|$)",
		},
		to: {
			path: "^desktop(?:/|$)",
		},
	},
	{
		name: "desktop-contract-is-pure",
		comment:
			"The shared desktop contract contains types and channel names only; it never imports renderer, engine, Electron, or CLI implementation code.",
		severity: "error",
		from: {
			path: "^desktop(?:/|$)",
		},
		to: {
			path: "^(?:src|electron|cli)(?:/|$)|^node_modules/electron(?:/|$)",
		},
	},
	{
		name: "active-code-no-test-imports",
		comment:
			"Production and tooling code never import test support; tests may depend on active code, never the reverse.",
		severity: "error",
		from: {
			path: "^(?:src/(?:engine|bridge|ui|page|@routes)|src/(?:main|router|_route)\\.tsx?|electron|desktop|cli)(?:/|$)",
		},
		to: {
			path: "^test(?:/|$)",
		},
	},
	{
		name: "active-code-no-archive-imports",
		comment:
			"The historical tree is a read-only oracle outside every active source root and may never be imported by production, CLI, or tests.",
		severity: "error",
		from: {
			path: "^(?:src/(?:engine|bridge|ui|page|@routes)|src/(?:main|router|_route)\\.tsx?|electron|desktop|cli|test)(?:/|$)",
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
				path: "^(?:src/(?:engine|bridge|ui|page|@routes)|src/(?:main|router|_route)\\.tsx?|electron|desktop)(?:/|$)",
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
				path: "^(?:src/(?:engine|bridge|ui|page|@routes)|src/(?:main|router|_route)\\.tsx?|electron|desktop|cli)(?:/|$)",
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
