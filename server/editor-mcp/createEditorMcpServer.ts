import { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";

import { ArkiniAppVersion } from "../../shared/ArkiniAppMetadata";
import type { EditorProject } from "../../src/editor/EditorProject";
import type { EditorProjectRepositoryService } from "../../src/editor/EditorProjectRepository";
import { createEditorAcquisitionGraphFx } from "../../src/editor/createEditorAcquisitionGraphFx";
import type {
	EditorItemEstimate,
	EditorItemEstimateDiagnostic,
	EditorItemEstimateRouteStep,
} from "../../src/editor/estimator/EditorItemEstimate";
import { estimateEditorItemFx } from "../../src/editor/estimator/estimateEditorItemFx";
import { EditorItemEstimateQuantitySchema } from "../../src/editor/estimator/EditorItemEstimateQuantitySchema";
import type {
	EditorItemOriginOutputOccurrence,
	EditorItemOriginRelationRole,
	EditorItemOriginRelationSubgraph,
	EditorItemOriginSource,
} from "../../src/editor/EditorItemOriginSource";
import { readEditorItemOriginRelationSubgraphFx } from "../../src/editor/readEditorItemOriginRelationSubgraphFx";
import { readEditorItemOriginSourcesFx } from "../../src/editor/readEditorItemOriginSourcesFx";
import { searchEditorItems } from "../../src/editor/searchEditorItems";
import { IdSchema } from "../../src/engine/common/schema/IdSchema";
import { ItemEnumSchema } from "../../src/engine/item/schema/ItemEnumSchema";

const EditorMcpItemTypeSchema = z
	.enum(ItemEnumSchema.options)
	.describe(
		"A canonical Arkini item type: deposit, blueprint, simple, producer, craft, stash, temporary, or inventory.",
	);

const avatarResourceIds = (project: EditorProject) =>
	Object.entries(project.config.resources)
		.filter(([role]) => role.startsWith("avatar-"))
		.map(([, resourceId]) => resourceId);

const projectText = (project: EditorProject) =>
	[
		`Title: ${project.title}`,
		`Project ID: ${project.projectId}`,
		`Game ID: ${project.config.meta.id}`,
		`Config version: ${project.game}`,
		`Revision: ${project.revision}`,
		`Board: ${project.config.meta.board.width} × ${project.config.meta.board.height}`,
		`Toolbar: ${project.config.meta.toolbarSize === undefined || project.config.meta.toolbarSize === 0 ? "disabled" : `${project.config.meta.toolbarSize} slots`}`,
		`Inventory: ${project.config.meta.inventory.width} × ${project.config.meta.inventory.height}`,
		`Hero asset: ${project.config.resources.hero}`,
		...(avatarResourceIds(project).length === 0
			? []
			: [
					`About avatars: ${avatarResourceIds(project).join(", ")}`,
				]),
		`Items: ${Object.keys(project.config.items).length}`,
		`Resources: ${project.resources.length}`,
	].join("\n");

const indentText = (value: string, indentation = "    ") =>
	value
		.split("\n")
		.map((line) => `${indentation}${line}`)
		.join("\n");

const readItemCollectionPage = (
	project: EditorProject,
	{
		itemTypes,
		page,
		pageSize,
		query,
	}: {
		readonly itemTypes?: ReadonlyArray<ItemEnumSchema.Type>;
		readonly page: number;
		readonly pageSize: number;
		readonly query?: string;
	},
) => {
	const items = Object.values(project.config.items).sort((left, right) =>
		left.title.localeCompare(right.title),
	);
	const allowedTypes = itemTypes === undefined ? undefined : new Set(itemTypes);
	const typeFilteredItems =
		allowedTypes === undefined ? items : items.filter((item) => allowedTypes.has(item.type));
	const matches =
		query === undefined ? typeFilteredItems : searchEditorItems(typeFilteredItems, query);
	const totalPages = Math.ceil(matches.length / pageSize);
	const pageItems = matches.slice((page - 1) * pageSize, page * pageSize);
	const hasPreviousPage = page > 1;
	const hasNextPage = page * pageSize < matches.length;
	return {
		hasNextPage,
		hasPreviousPage,
		items: pageItems,
		itemTypes,
		matchedItems: matches.length,
		nextPage: hasNextPage ? page + 1 : undefined,
		page,
		pageSize,
		previousPage: hasPreviousPage ? page - 1 : undefined,
		projectItems: items.length,
		returnedItems: pageItems.length,
		totalPages,
		typeFilteredItems: typeFilteredItems.length,
	};
};

const itemCollectionText = (collection: ReturnType<typeof readItemCollectionPage>) => {
	const renderedItems = collection.items
		.map((item) =>
			[
				`- ${item.title}`,
				`  ID: ${item.id}`,
				`  Type: ${item.type}`,
				"  Description:",
				indentText(item.description),
			].join("\n"),
		)
		.join("\n\n");
	return [
		"Item collection",
		`Project items: ${collection.projectItems}`,
		...(collection.itemTypes === undefined
			? []
			: [
					`Item type filter (OR): ${collection.itemTypes.join(", ")}`,
				]),
		`Type-filtered items: ${collection.typeFilteredItems}`,
		`Matched items: ${collection.matchedItems}`,
		`Page: ${collection.page}`,
		`Total pages: ${collection.totalPages}`,
		`Page size: ${collection.pageSize}`,
		`Returned items: ${collection.returnedItems}`,
		`Has previous page: ${collection.hasPreviousPage}`,
		`Has next page: ${collection.hasNextPage}`,
		...(collection.previousPage === undefined
			? []
			: [
					`Previous page: ${collection.previousPage}`,
				]),
		...(collection.nextPage === undefined
			? []
			: [
					`Next page: ${collection.nextPage}`,
				]),
		"",
		"Items:",
		renderedItems || "- none",
	].join("\n");
};

const itemMetaText = (project: EditorProject) => {
	const counts = new Map<string, number>();
	for (const item of Object.values(project.config.items))
		counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
	return [
		`Total: ${Object.keys(project.config.items).length}`,
		...[
			...counts.entries(),
		]
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([type, count]) => `${type}: ${count}`),
	].join("\n");
};

const itemDetailText = (item: EditorProject["config"]["items"][string]) =>
	[
		`Item: ${item.title}`,
		`ID: ${item.id}`,
		`UID: ${item.uid}`,
		`Type: ${item.type}`,
		"Description:",
		indentText(item.description, "  "),
		`Storage: ${item.scope}`,
		`Stack capacity: ${item.maxStackSize}`,
		...(item.maxCount === undefined
			? []
			: [
					`Game limit: ${item.maxCount}`,
				]),
	].join("\n");

const itemReference = (project: EditorProject, itemId: string) => {
	const item = project.config.items[itemId];
	return item === undefined ? `${itemId} [missing]` : `${item.id} [${item.title}; ${item.type}]`;
};

const outputAnnotation = (output: EditorItemOriginOutputOccurrence) =>
	[
		`quantity ${formatQuantity(output.quantity)}`,
		output.selectionKind,
		...(output.weightedSet
			? [
					"alternative set",
				]
			: []),
		...(output.placement === undefined
			? []
			: [
					`placement ${output.placement}`,
				]),
	].join(", ");

const outputRequirementLines = (
	project: EditorProject,
	output: EditorItemOriginOutputOccurrence,
) => [
	...output.requirements.allOf.map(
		(requirement) =>
			`      requires all: ${itemReference(project, requirement.itemId)} (quantity ${formatQuantity(requirement.quantity)}, ${requirement.usage}, ${requirement.sources.join(", ")}${requirement.identity === "distinct" ? ", distinct identity" : ""})`,
	),
	...output.requirements.anyOf.flatMap((clause, clauseIndex) => [
		`      requires one of #${clauseIndex + 1}:`,
		...clause.map(
			(requirement) =>
				`        - ${itemReference(project, requirement.itemId)} (quantity ${formatQuantity(requirement.quantity)}, ${requirement.usage}, ${requirement.sources.join(", ")}${requirement.identity === "distinct" ? ", distinct identity" : ""})`,
		),
	]),
	...(output.requirements.unsupported ?? []).map(
		(requirement) =>
			`      unsupported requirement: ${itemReference(project, requirement.itemId)} (${requirement.reason}, ${requirement.source})`,
	),
];

const formatQuantity = ({ max, min }: { readonly max: number; readonly min: number }) =>
	min === max ? String(min) : `${min}–${max}`;

const formatRuntime = (runtimeMs: number) => `${runtimeMs / 1_000} s`;

const formatEstimateNumber = (value: number) =>
	Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, "");

const estimateDiagnosticText = (diagnostic: EditorItemEstimateDiagnostic) => {
	switch (diagnostic.kind) {
		case "quantity-limit-exceeded":
			return `${diagnostic.factId} x ${formatEstimateNumber(diagnostic.quantity)} exceeds the static estimate limit of ${diagnostic.maximumQuantity} (${diagnostic.source})`;
		case "joint-output-accounting-unsupported":
			return `correlated output demand on ${diagnostic.routeId} exceeds the bounded static state space`;
		case "cycle":
			return `cycle on ${diagnostic.routeId}: ${diagnostic.factIds.join(" -> ")}`;
		case "unreachable":
			return `${diagnostic.factId} x ${formatEstimateNumber(diagnostic.quantity)} has no complete route${diagnostic.routeId === undefined ? "" : ` through ${diagnostic.routeId}`}`;
		case "zero-yield":
			return `${diagnostic.routeId} has zero yield for ${diagnostic.factId}`;
	}
};

const estimateLimitationText = (limitation: EditorItemEstimate["limitations"][number]) => {
	switch (limitation) {
		case "conditional-runtime-adjustments-ignored":
			return "rules and conditional runtime adjustments are ignored";
		case "negative-availability-constraints-ignored":
			return "enable, disable, and availability conditions are ignored";
		case "spatial-requirements-approximated":
			return "scope, distance, board capacity, and concrete placement are ignored";
	}
};

const estimateRouteLines = (
	project: EditorProject,
	routeSteps: ReadonlyArray<EditorItemEstimateRouteStep>,
): ReadonlyArray<string> => {
	const routeByFactId = new Map(
		routeSteps.map((route) => [
			route.factId,
			route,
		]),
	);
	return routeSteps.flatMap((route) => [
		`  - ${itemReference(project, route.factId)} x ${formatEstimateNumber(route.quantity)} via ${route.routeId} (${formatRuntime(route.durationMs)})`,
		...(route.rootQuantity > 0
			? [
					`    authored start contribution: ${formatEstimateNumber(route.rootQuantity)}`,
				]
			: []),
		...route.requirements.map((requirement) => {
			const acquisition =
				requirement.acquisitionFactId === undefined
					? undefined
					: routeByFactId.get(requirement.acquisitionFactId);
			return `    ${requirement.usage}: ${itemReference(project, requirement.factId)} x ${formatEstimateNumber(requirement.quantity)} [${requirement.sources.join(", ")}]${acquisition === undefined ? "" : ` -> ${acquisition.routeId}`}`;
		}),
	]);
};

const itemEstimateText = (project: EditorProject, estimate: EditorItemEstimate) => {
	const target = project.config.items[estimate.factId];
	if (target === undefined)
		throw new Error(`Item ${estimate.factId} does not exist in the open project.`);
	const header = [
		"Item estimate",
		`Item ID: ${target.id}`,
		`Title: ${target.title}`,
		`Quantity: ${formatEstimateNumber(estimate.quantity)}`,
		"Method: static authored dependency graph",
		"Timing: optimistic sequential",
		"Start facts: authored board, inventory, and toolbar",
		"Random output occurrences: expected-run economics",
		"Ignored: rules and conditions, scope and placement, charge capacity and renewal, finite resource capacity",
		"Limitations:",
		...(estimate.limitations.length === 0
			? [
					"  - none",
				]
			: estimate.limitations.map(
					(limitation) => `  - ${estimateLimitationText(limitation)}`,
				)),
	];
	if (!estimate.obtainable)
		return [
			...header,
			`Status: ${estimate.status}`,
			estimate.status === "partial"
				? "The authored path exceeds a bounded static-analysis limit; duration is indeterminate."
				: "No complete acquisition route reaches the target from the authored start facts.",
			"Diagnostics:",
			...(estimate.diagnostics.length === 0
				? [
						"  - target has no acquisition route",
					]
				: estimate.diagnostics.map(
						(diagnostic) => `  - ${estimateDiagnosticText(diagnostic)}`,
					)),
		].join("\n");

	return [
		...header,
		"Status: complete",
		`Sequential duration: ${formatRuntime(estimate.durationMs)}`,
		`Selected route: ${estimate.route.routeId}`,
		`Expected action runs: ${formatEstimateNumber(estimate.route.actionRuns)}`,
		`Expected output samples: ${formatEstimateNumber(estimate.route.outputRuns)}`,
		"Selected route graph:",
		...estimateRouteLines(project, estimate.routeSteps),
		"Diagnostics:",
		...(estimate.diagnostics.length === 0
			? [
					"  - none",
				]
			: estimate.diagnostics.map(
					(diagnostic) => `  - ${estimateDiagnosticText(diagnostic)}`,
				)),
	].join("\n");
};

interface ItemRelationView {
	readonly itemId: string;
	readonly level: number;
	readonly project: EditorProject;
	readonly role: EditorItemOriginRelationRole;
	readonly subgraph: EditorItemOriginRelationSubgraph;
}

const readItemRelationViewFx = Effect.fn("createEditorMcpServer.readItemRelationViewFx")(function* (
	project: EditorProject,
	{
		itemId,
		level,
		role,
	}: {
		readonly itemId: string;
		readonly level: number;
		readonly role: EditorItemOriginRelationRole;
	},
): Effect.fn.Return<ItemRelationView, Error> {
	if (project.config.items[itemId] === undefined)
		return yield* Effect.fail(new Error(`Item ${itemId} does not exist in the open project.`));
	const graph = yield* createEditorAcquisitionGraphFx(project.config);
	const sources = yield* readEditorItemOriginSourcesFx(graph);
	return {
		itemId,
		level,
		project,
		role,
		subgraph: yield* readEditorItemOriginRelationSubgraphFx({
			level,
			role,
			sources,
			targetItemId: itemId,
		}),
	};
});

const sourceReferenceLines = (project: EditorProject, source: EditorItemOriginSource) => [
	`  Source item: ${itemReference(project, source.ownerItemId)}`,
	...(() => {
		switch (source.reference.type) {
			case "line":
				return [
					`  Line ID: ${source.reference.lineId}`,
				];
			case "charges":
				return [
					"  Relationship: charge depletion",
				];
			case "expiry":
				return [
					"  Relationship: expiry",
				];
			case "merge":
				return [
					`  Merge rule: ${source.reference.ruleNumber}`,
				];
		}
	})(),
];

const itemRelationText = ({ itemId, level, project, role, subgraph }: ItemRelationView) => {
	const direction = role === "output" ? "income" : "outcome";
	const item = project.config.items[itemId];
	if (item === undefined) throw new Error(`Item ${itemId} does not exist in the open project.`);
	const groups = new Map<
		string,
		{
			readonly level: number;
			readonly relations: typeof subgraph.relations;
		}
	>();
	for (const relation of subgraph.relations) {
		const key = `${relation.level}:${relation.source.id}`;
		const group = groups.get(key);
		groups.set(key, {
			level: relation.level,
			relations:
				group === undefined
					? [
							relation,
						]
					: [
							...group.relations,
							relation,
						],
		});
	}
	return [
		`Item ${direction}`,
		`Item ID: ${item.id}`,
		`Title: ${item.title}`,
		`Type: ${item.type}`,
		`Level: ${level}`,
		"",
		"Operations:",
		...(groups.size === 0
			? [
					"- none",
				]
			: [
					...groups.values(),
				].flatMap((group) => {
					const source = group.relations[0]?.source;
					if (source === undefined) return [];
					const inputs = [
						...source.inputs,
					].sort((left, right) => left.itemId.localeCompare(right.itemId));
					return [
						`- Level ${group.level}: ${source.kind} "${source.label}"`,
						...sourceReferenceLines(project, source),
						...(source.runtimeMs === undefined
							? []
							: [
									`  Runtime: ${formatRuntime(source.runtimeMs)}`,
								]),
						"  Traversed:",
						...group.relations.map(
							(relation) =>
								`    - ${itemReference(project, relation.fromItemId)} -> ${itemReference(project, relation.toItemId)}`,
						),
						...(inputs.length === 0
							? [
									"  Inputs: none",
								]
							: [
									"  Inputs:",
									...inputs.map(
										(input) =>
											`    - ${itemReference(project, input.itemId)} (quantity ${formatQuantity(input.quantity)})`,
									),
								]),
						"  Outputs:",
						...source.outputs.flatMap((output) => [
							`    - ${itemReference(project, output.itemId)} (${outputAnnotation(output)})`,
							...outputRequirementLines(project, output),
						]),
					];
				})),
	].join("\n");
};

const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const withProjectContext = <Value>(
	readProjectContext: () => string | undefined,
	run: (projectId: string) => Effect.Effect<Value, unknown>,
) =>
	Effect.try({
		try: () => {
			const projectId = readProjectContext();
			if (projectId === undefined)
				throw new Error(
					"No editor project is currently open. Open a project in Arkini before using editor tools.",
				);
			return projectId;
		},
		catch: (cause) => cause,
	}).pipe(Effect.flatMap(run));

const readCurrentProjectFx = (
	repository: EditorProjectRepositoryService,
	readProjectContext: () => string | undefined,
) =>
	withProjectContext(readProjectContext, (projectId) =>
		repository
			.readProjectFx(projectId)
			.pipe(
				Effect.flatMap((project) =>
					project === null
						? Effect.fail(
								new Error(`The open editor project ${projectId} no longer exists.`),
							)
						: Effect.succeed(project),
				),
			),
	);

const runTool = async <Value>(
	effect: Effect.Effect<Value, unknown>,
	format: (value: Value) => string,
) => {
	try {
		const value = await Effect.runPromise(effect);
		return {
			content: [
				{
					type: "text" as const,
					text: format(value),
				},
			],
		};
	} catch (cause) {
		return {
			isError: true,
			content: [
				{
					type: "text" as const,
					text: `Editor operation failed: ${errorText(cause)}`,
				},
			],
		};
	}
};

/** Builds one per-request MCP server scoped to the project currently visible in the editor. */
export const createEditorMcpServer = (
	repository: EditorProjectRepositoryService,
	readProjectContext: () => string | undefined,
) => {
	const server = new McpServer(
		{
			name: "arkini-editor",
			version: ArkiniAppVersion,
		},
		{
			instructions:
				"Every tool reads only the project currently open in the Arkini editor. Tool results mirror the relevant editor UI as concise text and never dump the complete game config.",
		},
	);
	server.registerTool(
		"project",
		{
			description:
				"Summarize the project currently open in Arkini, including its identity, version, layouts, and collection sizes.",
		},
		async () => runTool(readCurrentProjectFx(repository, readProjectContext), projectText),
	);
	server.registerTool(
		"item_meta",
		{
			description: "Count items in the open project by their canonical item type.",
		},
		async () => runTool(readCurrentProjectFx(repository, readProjectContext), itemMetaText),
	);
	server.registerTool(
		"item_collection",
		{
			description:
				"List one page of items with collection metadata, title, ID, complete description, and type, optionally filtered by item types and the editor's fuzzy search.",
			inputSchema: z
				.object({
					itemTypes: EditorMcpItemTypeSchema.array()
						.min(1)
						.optional()
						.describe(
							"Optional item types combined with OR; the fuzzy query is applied within this filtered set.",
						),
					page: z.number().int().min(1).default(1).describe("One-based page number."),
					pageSize: z
						.number()
						.int()
						.min(1)
						.max(100)
						.default(25)
						.describe("Items per page; defaults to 25 and is capped at 100."),
					query: z
						.string()
						.optional()
						.describe(
							"Optional fuzzy search across item title, ID, description, and type.",
						),
				})
				.strict(),
		},
		async ({ itemTypes, page, pageSize, query }) =>
			runTool(
				readCurrentProjectFx(repository, readProjectContext).pipe(
					Effect.map((project) =>
						readItemCollectionPage(project, {
							itemTypes,
							page,
							pageSize,
							query,
						}),
					),
				),
				itemCollectionText,
			),
	);
	server.registerTool(
		"item_detail",
		{
			description:
				"Read the simplified identity and storage detail of one item in the open project.",
			inputSchema: z
				.object({
					id: IdSchema.describe("The exact item ID returned by item_collection."),
				})
				.strict(),
		},
		async ({ id }) =>
			runTool(
				readCurrentProjectFx(repository, readProjectContext).pipe(
					Effect.flatMap((project) => {
						const item = project.config.items[id];
						return item === undefined
							? Effect.fail(
									new Error(`Item ${id} does not exist in the open project.`),
								)
							: Effect.succeed(item);
					}),
				),
				itemDetailText,
			),
	);
	server.registerTool(
		"item_income",
		{
			description:
				"Read what leads to obtaining one item. Level 1 returns every operation that directly produces it; higher levels continue upstream through operations that produce each reached operation owner. Every operation lists its owner, Runtime when authored, Inputs, and all possible Outputs.",
			inputSchema: z
				.object({
					itemId: IdSchema.describe(
						"The exact root item ID returned by item_collection.",
					),
					level: z
						.number()
						.int()
						.positive()
						.default(1)
						.describe("Relationship-hop depth; defaults to 1."),
				})
				.strict(),
		},
		async ({ itemId, level }) =>
			runTool(
				readCurrentProjectFx(repository, readProjectContext).pipe(
					Effect.flatMap((project) =>
						readItemRelationViewFx(project, {
							itemId,
							level,
							role: "output",
						}),
					),
				),
				itemRelationText,
			),
	);
	server.registerTool(
		"item_outcome",
		{
			description:
				"Read where one item leads. Level 1 returns every operation that directly uses it as an input; higher levels continue downstream through operations that use each reached operation owner. Every operation lists its owner, Runtime when authored, Inputs, and all possible Outputs.",
			inputSchema: z
				.object({
					itemId: IdSchema.describe(
						"The exact root item ID returned by item_collection.",
					),
					level: z
						.number()
						.int()
						.positive()
						.default(1)
						.describe("Relationship-hop depth; defaults to 1."),
				})
				.strict(),
		},
		async ({ itemId, level }) =>
			runTool(
				readCurrentProjectFx(repository, readProjectContext).pipe(
					Effect.flatMap((project) =>
						readItemRelationViewFx(project, {
							itemId,
							level,
							role: "input",
						}),
					),
				),
				itemRelationText,
			),
	);
	server.registerTool(
		"item_estimate",
		{
			description:
				"Analyze one item against the authored dependency graph. Returns an optimistic sequential acquisition route with quantities, expected random-output economics, hard materials, owners, infrastructure, and deposit acquisition. Runtime rules, placement, charges, renewal, and finite capacity are ignored.",
			inputSchema: z
				.object({
					itemId: IdSchema.describe(
						"The exact target item ID returned by item_collection.",
					),
					quantity: EditorItemEstimateQuantitySchema.default(1),
				})
				.strict(),
		},
		async ({ itemId, quantity }) =>
			runTool(
				readCurrentProjectFx(repository, readProjectContext).pipe(
					Effect.flatMap((project) =>
						Effect.gen(function* () {
							const graph = yield* createEditorAcquisitionGraphFx(project.config);
							const estimate = yield* estimateEditorItemFx({
								factId: itemId,
								graph,
								quantity,
							});
							return {
								estimate,
								project,
							};
						}),
					),
				),
				({ estimate, project }) => itemEstimateText(project, estimate),
			),
	);
	return server;
};
