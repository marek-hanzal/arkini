import { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";

import { ArkiniAppVersion } from "../../shared/ArkiniAppMetadata";
import type { EditorProject } from "../../src/editor/EditorProject";
import type { EditorProjectRepositoryService } from "../../src/editor/EditorProjectRepository";
import type { EditorItemSimulation } from "../../src/editor/simulator/EditorItemSimulation";
import { simulateEditorItemFx } from "../../src/editor/simulator/simulateEditorItemFx";
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

const formatQuantity = ({ max, min }: { readonly max: number; readonly min: number }) =>
	min === max ? String(min) : `${min}–${max}`;

const formatRuntime = (runtimeMs: number) => `${runtimeMs / 1_000} s`;

const formatEstimateNumber = (value: number) =>
	Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, "");

const formatEstimateProbability = (probability: number) => {
	const percentage = probability * 100;
	if (percentage === 0 || percentage >= 0.01)
		return `${formatEstimateNumber(Number(percentage.toFixed(2)))}%`;
	return `${percentage.toPrecision(2)}%`;
};

type EngineBackedEstimatePlanner = NonNullable<EditorItemSimulation["planner"]>;
type PlannerSearchDiagnostics = NonNullable<EngineBackedEstimatePlanner["diagnostics"]>;

const formatPlannerActionId = (actionId: string) => {
	try {
		const parsed: unknown = JSON.parse(actionId);
		if (Array.isArray(parsed)) {
			const label = parsed.at(-1);
			if (typeof label === "string") return label;
		}
	} catch {
		// Future or human-authored action IDs remain useful without parsing.
	}
	return actionId;
};

const formatPlannerActionIds = (actionIds: ReadonlyArray<string>, limit = 8) => {
	const visible = actionIds.slice(0, limit).map(formatPlannerActionId);
	return `${visible.join(", ")}${actionIds.length > visible.length ? `, +${actionIds.length - visible.length} more` : ""}`;
};

const plannerRoutePlanOutcomeText = (
	outcome: PlannerSearchDiagnostics["routePlans"][number]["outcome"],
) => {
	switch (outcome) {
		case "completed":
			return "completed";
		case "non-quiescent-runtime":
			return "non-quiescent-runtime";
		case "search-budget":
			return "search-budget";
		case "search-exhausted":
			return "search-exhausted";
	}
};

const plannerRoutePlanDetourText = (
	detour: PlannerSearchDiagnostics["routePlans"][number]["detours"][number],
) => {
	const alternative = `${detour.alternativeIndex + 1}/${detour.alternativeCount}`;
	const depth = `depth excess ${detour.depthExcess}`;
	switch (detour.type) {
		case "acquisition-route":
			return `acquisition ${detour.itemId}; alternative ${alternative}; ${depth}; route ${detour.routeId}`;
		case "renewal-route":
			return `renewal ${detour.itemId}; alternative ${alternative}; ${depth}; route ${detour.routeId}`;
		case "requirement":
			return `any-of requirement ${detour.itemId}; alternative ${alternative}; ${depth}; ${detour.usage} ${detour.source}; clause ${detour.clauseId}`;
	}
};

const readVisibleRoutePlanAttempts = (
	attempts: PlannerSearchDiagnostics["routePlans"],
	winner: number | undefined,
) => {
	if (attempts.length <= 8) return attempts;
	const selected = new Map<number, (typeof attempts)[number]>();
	for (const attempt of attempts.slice(0, 3)) selected.set(attempt.index, attempt);
	for (const attempt of attempts.slice(-3)) selected.set(attempt.index, attempt);
	if (winner !== undefined) {
		const winningAttempt = attempts.find(({ index }) => index === winner);
		if (winningAttempt !== undefined) selected.set(winningAttempt.index, winningAttempt);
	}
	return [
		...selected.values(),
	].sort((left, right) => left.index - right.index);
};

const plannerRoutePlanLines = (planner: EditorItemSimulation["planner"]): ReadonlyArray<string> => {
	if (planner === undefined || planner.diagnostics === null) return [];
	const diagnostics = planner.diagnostics;
	if (diagnostics.attemptedRoutePlans === 0)
		return [
			"Route-plan search:",
			"  Plans tried: 0",
			`  Resolution: ${
				planner.type === "no-finite-path"
					? "acquisition graph resolved the target before engine search"
					: planner.type === "completed"
						? "target already satisfied before engine search"
						: "search stopped before an engine route-plan pass executed"
			}`,
		];

	const visible = readVisibleRoutePlanAttempts(
		diagnostics.routePlans,
		diagnostics.winningRoutePlanIndex,
	);
	return [
		"Route-plan search:",
		`  Plans tried: ${diagnostics.attemptedRoutePlans}`,
		`  Winning plan: ${diagnostics.winningRoutePlanIndex ?? "none"}`,
		...visible.flatMap((attempt) => {
			const furthestAction = attempt.bestTraceActionIds.at(-1);
			const visibleDetours = attempt.detours.slice(0, 8);
			return [
				`  - Plan ${attempt.index}: ${plannerRoutePlanOutcomeText(attempt.outcome)}; ${attempt.expandedStates} expanded; ${attempt.visitedStates} visited; frontier ${attempt.frontierSize}; best target ${formatEstimateNumber(attempt.bestAvailableQuantity)}; ${attempt.actionCount} actions; ${attempt.routeCount} routes; depth discrepancy ${attempt.depthDiscrepancy}; route discrepancy ${attempt.routeDiscrepancy}; maximum detour ${attempt.maximumDetourDepth}`,
				...(attempt.targetRouteId === undefined
					? []
					: [
							`    Preferred target route: ${attempt.targetRouteId}`,
						]),
				...(furthestAction === undefined
					? []
					: [
							`    Furthest trace action: ${formatPlannerActionId(furthestAction)}`,
						]),
				...(attempt.budgetLimit === undefined
					? []
					: [
							`    Budget limit: ${attempt.budgetLimit}`,
						]),
				...(attempt.blockedActionIds.length === 0
					? []
					: [
							`    Blocked actions: ${formatPlannerActionIds(attempt.blockedActionIds)}`,
						]),
				...(attempt.unsupportedActionIds.length === 0
					? []
					: [
							`    Unsupported actions: ${formatPlannerActionIds(attempt.unsupportedActionIds)}`,
						]),
				...(attempt.detours.length === 0
					? []
					: [
							"    Selected detours:",
							...visibleDetours.map(
								(detour) => `      - ${plannerRoutePlanDetourText(detour)}`,
							),
							...(visibleDetours.length === attempt.detours.length
								? []
								: [
										`      - ${attempt.detours.length - visibleDetours.length} more detours omitted`,
									]),
						]),
			];
		}),
		...(visible.length === diagnostics.routePlans.length
			? []
			: [
					`  Omitted plans: ${diagnostics.routePlans.length - visible.length}`,
				]),
	];
};

const plannerStrategyLines = (planner: EditorItemSimulation["planner"]): ReadonlyArray<string> => {
	if (planner === undefined) return [];
	const { budget, invocations } = planner.sessionDiagnostics;
	const strategyIds = [
		...new Set(invocations.map(({ strategyId }) => strategyId)),
	];
	return [
		"Strategy session:",
		`  Root strategy: ${planner.strategyId}`,
		`  Invocations: ${invocations.length}`,
		`  Engine transitions: ${budget.snapshot.engineTransitions}/${budget.limits.maximumEngineTransitions}`,
		`  Strategy invocations: ${budget.snapshot.strategyInvocations}/${budget.limits.maximumStrategyInvocations}`,
		...(strategyIds.length === 0
			? []
			: [
					`  Algorithms used: ${strategyIds.join(" -> ")}`,
				]),
	];
};

const plannerReasonText = (
	reason: Extract<
		NonNullable<EditorItemSimulation["planner"]>,
		{
			readonly type: "inconclusive";
		}
	>["reason"],
) => {
	switch (reason) {
		case "action-unsupported":
			return "an engine transition in the selected closure is not supported by planner search";
		case "non-quiescent-runtime":
			return "an action left the candidate runtime in a non-quiescent state";
		case "search-budget":
			return "the bounded search exhausted its configured budget";
		case "search-exhausted":
			return "the bounded candidate frontier was exhausted without a witness";
		case "session-budget":
			return "the shared planner session exhausted its global budget";
		case "unsupported-routes":
			return "the target closure contains authored routes not represented by planner search";
	}
};

const itemEstimateText = (project: EditorProject, estimate: EditorItemSimulation) => {
	const target = project.config.items[estimate.itemId];
	if (target === undefined)
		throw new Error(`Item ${estimate.itemId} does not exist in the open project.`);
	const planner = estimate.planner;
	const header = [
		"Item estimate",
		`Item ID: ${target.id}`,
		`Title: ${target.title}`,
		`Quantity: ${estimate.quantity}`,
		"Scheduling: sequential",
		"Start state: authored new-game runtime",
		"Planner: real engine transitions under optimistic spatial and placement policies",
		"Board model: coordinates and physical capacity are relaxed; item existence, scope, inputs, charges, lifecycle, and authored rules remain engine-backed",
	];
	if (estimate.status === "inconclusive") {
		const diagnostic = planner?.type === "inconclusive" ? planner : undefined;
		return [
			...header,
			"Estimate: Inconclusive",
			"Status: inconclusive",
			...(diagnostic === undefined
				? []
				: [
						`Reason: ${plannerReasonText(diagnostic.reason)}`,
						`Best available target quantity: ${formatEstimateNumber(diagnostic.bestAvailableQuantity)}`,
						`Search: ${diagnostic.expandedStates} expanded states; ${diagnostic.visitedStates} visited states${diagnostic.budgetLimit === undefined ? "" : `; budget limit ${diagnostic.budgetLimit}`}`,
					]),
			...plannerStrategyLines(planner),
			...plannerRoutePlanLines(planner),
			"This is not proof that the item cannot be produced.",
			"Warnings:",
			...(estimate.warnings.length === 0
				? [
						"  - bounded search returned no final verdict",
					]
				: estimate.warnings.map((warning) => `  - ${warning}`)),
		].join("\n");
	}

	const completedPlanner = planner?.type === "completed" ? planner : undefined;
	return [
		...header,
		`Estimate: ${estimate.status === "estimated" ? "Completed" : "No finite path"}`,
		`Status: ${estimate.status}`,
		...(completedPlanner === undefined
			? []
			: [
					`Engine-backed feasibility: ${completedPlanner.outputCertainty}`,
					`Concrete witness: ${formatEstimateNumber(completedPlanner.observedActionRuns)} actions; ${formatRuntime(completedPlanner.observedRuntimeMs)}`,
					`Expected replay: ${formatEstimateNumber(completedPlanner.expectedActionRuns)} actions${estimate.runtimeMs === undefined ? "" : `; ${formatRuntime(estimate.runtimeMs)}`}`,
					...(completedPlanner.outputCertainty === "possible"
						? [
								`Selected witness probability: ${formatEstimateProbability(completedPlanner.selectedWitnessProbability)}`,
							]
						: []),
					`Search: ${completedPlanner.expandedStates} expanded states; ${completedPlanner.visitedStates} visited states`,
				]),
		...plannerStrategyLines(planner),
		...plannerRoutePlanLines(planner),
		...(estimate.runtimeMs === undefined
			? []
			: [
					`Sequential runtime: ${formatRuntime(estimate.runtimeMs)}`,
				]),
		"Production blockers:",
		...(estimate.blockers.length === 0
			? [
					"  - none",
				]
			: estimate.blockers.map(
					(blocker) =>
						`  - ${blocker.code}: ${itemReference(project, blocker.itemId)}; ${blocker.message}${blocker.operationId === undefined ? "" : `; operation ${blocker.operationId}`}`,
				)),
		`Total item cost: ${formatEstimateNumber(estimate.totalCostQuantity)}`,
		"Item cost breakdown:",
		...(estimate.cost.length === 0
			? [
					"  - none",
				]
			: estimate.cost.map(
					({ itemId, quantity }) =>
						`  - ${itemReference(project, itemId)}: ${formatEstimateNumber(quantity)}`,
				)),
		"Expected charge spend:",
		...(completedPlanner === undefined || completedPlanner.expectedSpentCharges.length === 0
			? [
					"  - none",
				]
			: completedPlanner.expectedSpentCharges.map(
					({ charges, itemId }) =>
						`  - ${itemReference(project, itemId)}: ${formatEstimateNumber(charges)} charges`,
				)),
		"Infrastructure and reserved inputs:",
		...(estimate.infrastructureItemIds.size === 0
			? [
					"  - none",
				]
			: [
					...[
						...estimate.infrastructureItemIds,
					]
						.sort((left, right) => left.localeCompare(right))
						.map((itemId) => `  - ${itemReference(project, itemId)}`),
				]),
		"Operations:",
		...(estimate.operations.length === 0
			? [
					"  - none",
				]
			: estimate.operations.map(
					(operation) =>
						`  - ${operation.label} [${operation.lineId}] × ${formatEstimateNumber(operation.runs)}; ${formatRuntime(operation.runtimeMs)}; owner ${itemReference(project, operation.ownerItemId)}`,
				)),
		"Warnings:",
		...(estimate.warnings.length === 0
			? [
					"  - none",
				]
			: estimate.warnings.map((warning) => `  - ${warning}`)),
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
	const sourceGroups = yield* Effect.forEach(
		Object.values(project.config.items).sort((left, right) => left.id.localeCompare(right.id)),
		readEditorItemOriginSourcesFx,
	);
	const sources = sourceGroups.flat().sort((left, right) => left.id.localeCompare(right.id));
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
						...source.outputs.map(
							(output) =>
								`    - ${itemReference(project, output.itemId)} (${outputAnnotation(output)})`,
						),
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
				"Run the real engine-backed planner for one item from the authored new-game state. Returns a concrete feasibility witness when found, a graph-certified no-finite-path result when proven, or inconclusive when bounded search cannot decide. Reported time and costs are expected values for the selected route; geometry and physical capacity are optimistic.",
			inputSchema: z
				.object({
					itemId: IdSchema.describe(
						"The exact target item ID returned by item_collection.",
					),
					quantity: z
						.number()
						.int()
						.positive()
						.default(1)
						.describe("Target quantity; defaults to 1."),
				})
				.strict(),
		},
		async ({ itemId, quantity }) =>
			runTool(
				readCurrentProjectFx(repository, readProjectContext).pipe(
					Effect.flatMap((project) =>
						simulateEditorItemFx(project.config, itemId, quantity).pipe(
							Effect.map((estimate) => ({
								estimate,
								project,
							})),
						),
					),
				),
				({ estimate, project }) => itemEstimateText(project, estimate),
			),
	);
	return server;
};
