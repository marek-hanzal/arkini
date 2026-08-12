import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionRequirement,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import { readPlannerRuntimeQuantity } from "~/editor/planner/readPlannerRuntimeQuantity";
import type { PlannerSearchScope } from "~/editor/planner/PlannerSearchScope";
import { resolvePlannerRouteReachability } from "~/editor/planner/resolvePlannerRouteReachability";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export interface PlannerSearchPriority {
	readonly preferredProgressByDepth: ReadonlyArray<number>;
	readonly scopeProgress: number;
}

export interface PlannerSearchPriorityPlan {
	readonly depthByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly witnessRouteByItemId: ReadonlyMap<IdSchema.Type, PlannerAcquisitionRoute>;
}

const compareIds = (left: string, right: string) => left.localeCompare(right);

interface RequirementDemand {
	consumed: number;
	retained: number;
}

const addRequirementDemand = (
	demandByItemId: Map<IdSchema.Type, RequirementDemand>,
	requirement: PlannerAcquisitionRequirement,
	runCount: number,
) => {
	const demand = demandByItemId.get(requirement.itemId) ?? {
		consumed: 0,
		retained: 0,
	};
	if (requirement.usage === "consume") demand.consumed += requirement.minimumQuantity * runCount;
	else demand.retained = Math.max(demand.retained, requirement.minimumQuantity);
	demandByItemId.set(requirement.itemId, demand);
};

const compareRequirements = (
	depthByItemId: ReadonlyMap<IdSchema.Type, number>,
	left: PlannerAcquisitionRequirement,
	right: PlannerAcquisitionRequirement,
) =>
	(depthByItemId.get(left.itemId) ?? Number.POSITIVE_INFINITY) -
		(depthByItemId.get(right.itemId) ?? Number.POSITIVE_INFINITY) ||
	compareIds(left.itemId, right.itemId);

const readChargeDepletionProgress = ({
	route,
	runtime,
}: {
	readonly route: Extract<
		PlannerAcquisitionRoute,
		{
			readonly kind: "line-charge-depletion";
		}
	>;
	readonly runtime: RuntimeSchema.Type;
}) => {
	let progress = 0;
	for (const item of runtime.items) {
		if (item.item.id !== route.chargedItemId) continue;
		const amount = item.item.charges?.amount;
		if (amount === undefined) continue;
		const remaining = item.remainingCharges ?? amount;
		const spentRatio = Math.min(1, Math.max(0, (amount - remaining) / amount));
		progress = Math.max(progress, spentRatio);
	}
	return progress;
};

const readClauseRequirement = ({
	clause,
	depthByItemId,
	runtime,
}: {
	readonly clause: ReadonlyArray<PlannerAcquisitionRequirement>;
	readonly depthByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly runtime: RuntimeSchema.Type;
}) => {
	const reachable = clause
		.filter((requirement) => depthByItemId.has(requirement.itemId))
		.sort((left, right) => compareRequirements(depthByItemId, left, right));
	return (
		reachable.find(
			(requirement) =>
				readPlannerRuntimeQuantity(runtime, requirement.itemId) >=
				requirement.minimumQuantity,
		) ?? reachable[0]
	);
};

/** Creates the deterministic preferred witness used only to order forward-search states. */
export const readPlannerSearchPriorityPlan = ({
	graph,
	scope,
}: {
	readonly graph: PlannerAcquisitionGraph;
	readonly scope: PlannerSearchScope;
}): PlannerSearchPriorityPlan => {
	const scopeRouteIds = new Set(scope.routeIds);
	const scopeReachability = resolvePlannerRouteReachability({
		rootItemIds: graph.rootItemIds,
		routes: graph.routes.filter((route) => scopeRouteIds.has(route.id)),
	});
	return {
		depthByItemId: scopeReachability.depthByItemId,
		witnessRouteByItemId: scopeReachability.witnessRouteByItemId,
	};
};

/**
 * Reads only demands that are still active on the preferred route in this concrete runtime.
 *
 * Once a deeper witness item exists, already-consumed prerequisites below it disappear from the
 * score. This prevents best-first search from replenishing obsolete stone or logs merely because
 * an earlier construction step once needed them.
 */
const readActiveDemand = ({
	itemId,
	plan,
	quantity,
	runtime,
}: {
	readonly itemId: IdSchema.Type;
	readonly plan: PlannerSearchPriorityPlan;
	readonly quantity: number;
	readonly runtime: RuntimeSchema.Type;
}) => {
	const demandByItemId = new Map<IdSchema.Type, number>();
	const processedQuantityByItemId = new Map<IdSchema.Type, number>();
	const pending: Array<{
		readonly itemId: IdSchema.Type;
		readonly quantity: number;
	}> = [
		{
			itemId,
			quantity,
		},
	];

	for (let index = 0; index < pending.length; index += 1) {
		const goal = pending[index];
		if (goal === undefined) continue;
		demandByItemId.set(
			goal.itemId,
			Math.max(demandByItemId.get(goal.itemId) ?? 0, goal.quantity),
		);
		if (readPlannerRuntimeQuantity(runtime, goal.itemId) >= goal.quantity) continue;

		const processedQuantity = processedQuantityByItemId.get(goal.itemId) ?? 0;
		if (processedQuantity >= goal.quantity) continue;
		processedQuantityByItemId.set(goal.itemId, goal.quantity);
		const route = plan.witnessRouteByItemId.get(goal.itemId);
		if (route === undefined || route.output.maximumQuantity <= 0) continue;
		const missingQuantity = Math.max(
			0,
			goal.quantity - readPlannerRuntimeQuantity(runtime, goal.itemId),
		);
		const outputRunCount = Math.max(
			1,
			Math.ceil(missingQuantity / route.output.maximumQuantity),
		);
		const runCount =
			route.kind === "line-charge-depletion"
				? outputRunCount * route.minimumRunsLowerBound
				: outputRunCount;
		const requirementDemandByItemId = new Map<IdSchema.Type, RequirementDemand>();
		for (const requirement of route.requirements.allOf)
			addRequirementDemand(requirementDemandByItemId, requirement, runCount);
		for (const [requirementItemId, demand] of requirementDemandByItemId)
			pending.push({
				itemId: requirementItemId,
				quantity: demand.consumed + demand.retained,
			});
		for (const clause of route.requirements.anyOf) {
			const requirement = readClauseRequirement({
				clause,
				depthByItemId: plan.depthByItemId,
				runtime,
			});
			if (requirement !== undefined)
				pending.push({
					itemId: requirement.itemId,
					quantity: requirement.minimumQuantity,
				});
		}
	}

	return demandByItemId;
};

/**
 * Reads lexicographic progress toward the preferred witness plus a broad scope tie-breaker.
 *
 * Partial charge spend counts as progress toward a depletion output. Without it, a shallower fuel
 * producer could outrank the real spender forever once enough consumables already exist.
 */
export const readPlannerSearchPriority = ({
	itemId,
	plan,
	quantity,
	runtime,
	scope,
}: {
	readonly itemId: IdSchema.Type;
	readonly plan: PlannerSearchPriorityPlan;
	readonly quantity: number;
	readonly runtime: RuntimeSchema.Type;
	readonly scope: PlannerSearchScope;
}): PlannerSearchPriority => {
	const preferredProgressByDepth: number[] = [];
	for (const [candidateItemId, demand] of readActiveDemand({
		itemId,
		plan,
		quantity,
		runtime,
	})) {
		if (demand <= 0) continue;
		const availableQuantity = Math.min(
			readPlannerRuntimeQuantity(runtime, candidateItemId),
			demand,
		);
		const route = plan.witnessRouteByItemId.get(candidateItemId);
		const lifecycleQuantity =
			availableQuantity < demand && route?.kind === "line-charge-depletion"
				? Math.min(
						demand - availableQuantity,
						route.output.maximumQuantity *
							readChargeDepletionProgress({
								route,
								runtime,
							}),
					)
				: 0;
		const progress = (availableQuantity + lifecycleQuantity) / demand;
		const depth = plan.depthByItemId.get(candidateItemId) ?? 0;
		preferredProgressByDepth[depth] = (preferredProgressByDepth[depth] ?? 0) + progress;
	}

	let scopeProgress = 0;
	for (const candidateItemId of scope.itemIds) {
		if (readPlannerRuntimeQuantity(runtime, candidateItemId) <= 0) continue;
		scopeProgress += plan.depthByItemId.get(candidateItemId) ?? 0;
	}
	return {
		preferredProgressByDepth,
		scopeProgress,
	};
};

/** Sorts higher preferred depth progress first, then broader target-scope progress. */
export const comparePlannerSearchPriority = (
	left: PlannerSearchPriority,
	right: PlannerSearchPriority,
) => {
	const maximumDepth = Math.max(
		left.preferredProgressByDepth.length,
		right.preferredProgressByDepth.length,
	);
	for (let depth = maximumDepth - 1; depth >= 0; depth -= 1) {
		const difference =
			(right.preferredProgressByDepth[depth] ?? 0) -
			(left.preferredProgressByDepth[depth] ?? 0);
		if (difference !== 0) return difference;
	}
	return right.scopeProgress - left.scopeProgress;
};
