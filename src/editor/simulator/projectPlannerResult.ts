import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerAction } from "~/editor/planner/PlannerAction";
import type { PlannerResult } from "~/editor/planner/PlannerResult";
import type {
	PlannerSearchBudgetLimit,
	PlannerSearchDiagnostics,
} from "~/editor/planner/PlannerSearch";
import type {
	EditorItemSimulation,
	EditorItemSimulationBlocker,
	EditorItemSimulationOperation,
} from "~/editor/simulator/EditorItemSimulation";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

type BestFirstPlannerResult = PlannerResult<"best-first", PlannerSearchDiagnostics>;

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readLineTitle = (
	config: GameConfigSchema.Type,
	action: Extract<
		PlannerAction,
		{
			readonly kind: "line";
		}
	>,
) => {
	const owner = config.items[action.ownerItemId];
	if (owner === undefined || !("lines" in owner)) return action.lineId;
	return owner.lines?.find(({ id }) => id === action.lineId)?.title || action.lineId;
};

const readOperationProjection = (
	config: GameConfigSchema.Type,
	operation: Extract<
		BestFirstPlannerResult,
		{
			readonly type: "completed";
		}
	>["economics"]["operations"][number],
): EditorItemSimulationOperation => {
	const base = {
		id: operation.actionId,
		runs: operation.expectedRuns,
		runtimeMs: operation.expectedElapsedMs,
	};
	switch (operation.action.kind) {
		case "line":
			return {
				...base,
				label: readLineTitle(config, operation.action),
				lineId: operation.action.lineId,
				ownerItemId: operation.action.ownerItemId,
			};
		case "merge": {
			const sourceTitle =
				config.items[operation.action.sourceItemId]?.title ?? operation.action.sourceItemId;
			const targetTitle =
				config.items[operation.action.targetItemId]?.title ?? operation.action.targetItemId;
			return {
				...base,
				label: `Merge ${sourceTitle} into ${targetTitle}`,
				lineId: operation.actionId,
				ownerItemId: operation.action.sourceItemId,
			};
		}
		case "temporary-expiry": {
			const title = config.items[operation.action.itemId]?.title ?? operation.action.itemId;
			return {
				...base,
				label: `Expire ${title}`,
				lineId: operation.actionId,
				ownerItemId: operation.action.itemId,
			};
		}
	}
};

const readInfrastructureItemIds = (
	graph: PlannerAcquisitionGraph,
	result: Extract<
		BestFirstPlannerResult,
		{
			readonly type: "completed";
		}
	>,
) => {
	const routeById = new Map(
		graph.routes.map((route) => [
			route.id,
			route,
		]),
	);
	const itemIds = new Set<string>();
	const addRequirement = (
		requirement: PlannerAcquisitionRoute["requirements"]["allOf"][number],
	) => {
		if (requirement.usage === "presence" || requirement.usage === "reserve")
			itemIds.add(requirement.itemId);
	};
	for (const entry of result.execution.trace) {
		if (entry.action.kind === "line") itemIds.add(entry.action.ownerItemId);
		for (const routeId of entry.routeIds) {
			const route = routeById.get(routeId);
			if (route === undefined) continue;
			for (const requirement of route.requirements.allOf) addRequirement(requirement);
			for (const clause of route.requirements.anyOf)
				for (const requirement of clause) addRequirement(requirement);
		}
	}
	return itemIds;
};

const readNoFinitePathBlockers = (
	graph: PlannerAcquisitionGraph,
	result: Extract<
		BestFirstPlannerResult,
		{
			readonly type: "no-finite-path";
		}
	>,
): ReadonlyArray<EditorItemSimulationBlocker> => {
	if (result.proof.type === "target-missing")
		return [
			{
				code: "missing-source",
				itemId: result.itemId,
				message: "The target item is missing from the authored game configuration.",
				path: [
					result.itemId,
				],
			},
		];

	const blockers: EditorItemSimulationBlocker[] = result.proof.sourceLessItemIds.map(
		(itemId) => ({
			code: "missing-source",
			itemId,
			message: "No authored start item or acquisition route can produce this dependency.",
			path: [
				result.itemId,
				itemId,
			],
		}),
	);
	for (const componentId of result.proof.cycleComponentIds) {
		const component = graph.components.find(({ id }) => id === componentId);
		const itemIds = component?.itemIds ?? [];
		const itemId = itemIds[0];
		if (itemId === undefined) continue;
		blockers.push({
			code: "dependency-cycle",
			itemId,
			message: "This dependency cycle has no reachable authored root.",
			path: itemIds,
		});
	}
	if (blockers.length === 0)
		blockers.push({
			code: "operation-blocked",
			itemId: result.itemId,
			message: "Every optimistic authored acquisition route is structurally blocked.",
			path: result.proof.unreachableItemIds,
		});
	return blockers.sort(
		(left, right) => compareIds(left.itemId, right.itemId) || compareIds(left.code, right.code),
	);
};

const readInconclusiveWarning = (
	result: Extract<
		BestFirstPlannerResult,
		{
			readonly type: "inconclusive";
		}
	>,
) => {
	const reason = (() => {
		switch (result.reason) {
			case "action-unsupported":
				return "the selected route reached an engine transition the planner does not support";
			case "non-quiescent-runtime":
				return "an action left the candidate runtime in a non-quiescent state";
			case "search-budget":
				return `the search exhausted ${result.budgetLimit ?? "its configured budget"}`;
			case "search-exhausted":
				return "the bounded search exhausted its candidate frontier without a proof of impossibility";
			case "unsupported-routes":
				return "the target closure contains authored routes not represented by planner search";
		}
	})();
	return `Feasibility is inconclusive because ${reason}.`;
};

/** Projects a best-first planner result into the editor's stable estimate facade. */
export const projectPlannerResult = ({
	config,
	graph,
	result,
}: {
	readonly config: GameConfigSchema.Type;
	readonly graph: PlannerAcquisitionGraph;
	readonly result: BestFirstPlannerResult;
}): EditorItemSimulation => {
	switch (result.type) {
		case "completed": {
			const cost = result.economics.expectedConsumedItems.map(({ itemId, quantity }) => ({
				itemId,
				quantity,
			}));
			return {
				blockers: [],
				cost,
				infrastructureItemIds: readInfrastructureItemIds(graph, result),
				itemId: result.itemId,
				operations: result.economics.operations.map((operation) =>
					readOperationProjection(config, operation),
				),
				planner: {
					assumptions: result.economics.assumptions,
					diagnostics: result.strategyDiagnostics,
					expectedActionRuns: result.economics.expectedActionRuns,
					expectedSpentCharges: result.economics.expectedSpentCharges,
					expandedStates: result.strategyMetrics.expandedNodes,
					method: "engine-backed-search",
					observedActionRuns: result.economics.observedActionRuns,
					observedRuntimeMs: result.execution.elapsedMs,
					outputCertainty: result.execution.outputCertainty,
					selectedWitnessProbability: result.execution.selectedWitnessProbability,
					type: "completed",
					visitedStates: result.strategyMetrics.visitedNodes,
				},
				quantity: result.quantity,
				runtimeMs: result.economics.expectedElapsedMs,
				status: "estimated",
				totalCostQuantity: result.economics.totalExpectedConsumedQuantity,
				warnings:
					result.execution.outputCertainty === "possible"
						? [
								"Feasibility uses a positive-probability output witness; expected time and cost include repeated stochastic attempts.",
							]
						: [],
			};
		}
		case "no-finite-path":
			return {
				blockers: readNoFinitePathBlockers(graph, result),
				cost: [],
				infrastructureItemIds: new Set(),
				itemId: result.itemId,
				operations: [],
				planner: {
					diagnostics: result.strategyDiagnostics,
					method: "engine-backed-search",
					proofType: result.proof.type,
					type: "no-finite-path",
				},
				quantity: result.quantity,
				status: "no-finite-path",
				totalCostQuantity: 0,
				warnings: [],
			};
		case "inconclusive":
			return {
				blockers: [],
				cost: [],
				infrastructureItemIds: new Set(),
				itemId: result.itemId,
				operations: [],
				planner: {
					bestAvailableQuantity: result.bestAvailableQuantity,
					...(result.budgetLimit === undefined
						? {}
						: {
								budgetLimit: result.budgetLimit as PlannerSearchBudgetLimit,
							}),
					expandedStates: result.strategyMetrics.expandedNodes,
					diagnostics: result.strategyDiagnostics,
					method: "engine-backed-search",
					reason: result.reason,
					type: "inconclusive",
					visitedStates: result.strategyMetrics.visitedNodes,
				},
				quantity: result.quantity,
				status: "inconclusive",
				totalCostQuantity: 0,
				warnings: [
					readInconclusiveWarning(result),
				],
			};
	}
};
