import { Effect } from "effect";

import type { PlannerActiveItemDemand } from "~/editor/planner/PlannerActiveItemDemand";
import type {
	PlannerAcquisitionRequirement,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerSearchPriorityPlan } from "~/editor/planner/PlannerSearchPriorityPlan";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readRequirementClauseId = (routeId: string, clauseIndex: number) =>
	JSON.stringify([
		"route-requirement-clause",
		routeId,
		clauseIndex,
	]);

interface PlannerSearchPriorityRuntimeFacts {
	readonly chargeCapacityByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly quantityByItemId: ReadonlyMap<IdSchema.Type, number>;
}

const indexRuntimeItemFacts = (runtime: RuntimeSchema.Type): PlannerSearchPriorityRuntimeFacts => {
	const chargeCapacityByItemId = new Map<IdSchema.Type, number>();
	const quantityByItemId = new Map<IdSchema.Type, number>();
	for (const item of runtime.items) {
		const itemId = item.item.id;
		quantityByItemId.set(itemId, (quantityByItemId.get(itemId) ?? 0) + item.quantity);
		const fullCapacity = item.item.charges?.amount;
		if (fullCapacity !== undefined)
			chargeCapacityByItemId.set(
				itemId,
				(chargeCapacityByItemId.get(itemId) ?? 0) +
					(item.remainingCharges ?? fullCapacity) * item.quantity,
			);
	}
	return {
		chargeCapacityByItemId,
		quantityByItemId,
	};
};

const readIndexedRuntimeQuantity = (
	runtimeFacts: PlannerSearchPriorityRuntimeFacts,
	itemId: IdSchema.Type,
) => runtimeFacts.quantityByItemId.get(itemId) ?? 0;

const readIndexedRuntimeChargeCapacity = (
	runtimeFacts: PlannerSearchPriorityRuntimeFacts,
	itemId: IdSchema.Type,
) => runtimeFacts.chargeCapacityByItemId.get(itemId) ?? 0;

interface MutablePlannerActiveItemDemand {
	bootstrapQuantity: number;
	projectedQuantity: number;
	quantity: number;
	requiredCharges: number;
}

interface RequirementDemand {
	charges: number;
	consumed: number;
	retained: number;
}

interface RouteExpansionRuns {
	readonly bootstrap: number;
	readonly total: number;
}

const addRequirementDemand = (
	demandByItemId: Map<IdSchema.Type, RequirementDemand>,
	requirement: PlannerAcquisitionRequirement,
	runCount: number,
) => {
	const demand = demandByItemId.get(requirement.itemId) ?? {
		charges: 0,
		consumed: 0,
		retained: 0,
	};
	if (requirement.usage === "consume") demand.consumed += requirement.minimumQuantity * runCount;
	else demand.retained = Math.max(demand.retained, requirement.minimumQuantity);
	if (requirement.usage === "charge") demand.charges += (requirement.chargeCost ?? 0) * runCount;
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

const readClauseRequirement = ({
	clause,
	depthByItemId,
	preferred,
	runtimeFacts,
}: {
	readonly clause: ReadonlyArray<PlannerAcquisitionRequirement>;
	readonly depthByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly preferred?: PlannerAcquisitionRequirement;
	readonly runtimeFacts: PlannerSearchPriorityRuntimeFacts;
}) => {
	const reachable = clause
		.filter((requirement) => depthByItemId.has(requirement.itemId))
		.sort((left, right) => compareRequirements(depthByItemId, left, right));
	return (
		reachable.find(
			(requirement) =>
				readIndexedRuntimeQuantity(runtimeFacts, requirement.itemId) >=
				requirement.minimumQuantity,
		) ??
		(preferred === undefined
			? undefined
			: reachable.find((requirement) => requirement === preferred)) ??
		reachable[0]
	);
};

const readAcquisitionRoute = (
	plan: PlannerSearchPriorityPlan,
	itemId: IdSchema.Type,
): PlannerAcquisitionRoute | undefined => {
	const witnessRoute = plan.witnessRouteByItemId.get(itemId);
	return witnessRoute?.output.itemId === itemId
		? witnessRoute
		: plan.renewalRouteByItemId.get(itemId);
};

const readRouteActionRunCount = (route: PlannerAcquisitionRoute, outputRunCount: number) =>
	route.kind === "line-charge-depletion"
		? outputRunCount * route.minimumRunsLowerBound
		: outputRunCount;

const readRouteRequirementDemand = ({
	plan,
	route,
	runCount,
	runtimeFacts,
}: {
	readonly plan: PlannerSearchPriorityPlan;
	readonly route: PlannerAcquisitionRoute;
	readonly runCount: number;
	readonly runtimeFacts: PlannerSearchPriorityRuntimeFacts;
}) => {
	const demandByItemId = new Map<IdSchema.Type, RequirementDemand>();
	if (runCount <= 0) return demandByItemId;
	for (const requirement of route.requirements.allOf)
		addRequirementDemand(demandByItemId, requirement, runCount);
	for (const [clauseIndex, clause] of route.requirements.anyOf.entries()) {
		const requirement = readClauseRequirement({
			clause,
			depthByItemId: plan.depthByItemId,
			preferred: plan.preferredRequirementByClauseId.get(
				readRequirementClauseId(route.id, clauseIndex),
			),
			runtimeFacts,
		});
		if (requirement !== undefined) addRequirementDemand(demandByItemId, requirement, runCount);
	}
	return demandByItemId;
};

const readProjectedLifecycleQuantity = ({
	itemId,
	plan,
	requiredQuantity,
	renewedItemId,
	renewedQuantity,
}: {
	readonly itemId: IdSchema.Type;
	readonly plan: PlannerSearchPriorityPlan;
	readonly requiredQuantity: number;
	readonly renewedItemId: IdSchema.Type;
	readonly renewedQuantity: number;
}) => {
	const route = plan.witnessRouteByItemId.get(itemId);
	if (
		route?.kind !== "line-charge-depletion" ||
		route.chargedItemId !== renewedItemId ||
		route.output.stochastic
	)
		return 0;
	return Math.min(requiredQuantity, renewedQuantity * route.output.maximumQuantity);
};

/**
 * Reads the still-live preferred demand, including finite charge capacity and renewal bootstrap.
 *
 * Renewal prerequisites are activated before the final charge spend. A deterministic lifecycle
 * output produced by that spend is represented as projected quantity, so the scheduler prepares
 * the other prerequisites without trying to manufacture the lifecycle token prematurely.
 */
const readPlannerActiveDemand = ({
	itemId,
	plan,
	quantity,
	runtimeFacts,
}: {
	readonly itemId: IdSchema.Type;
	readonly plan: PlannerSearchPriorityPlan;
	readonly quantity: number;
	readonly runtimeFacts: PlannerSearchPriorityRuntimeFacts;
}): ReadonlyMap<IdSchema.Type, PlannerActiveItemDemand> => {
	const demandByItemId = new Map<IdSchema.Type, MutablePlannerActiveItemDemand>();
	const pendingItemIds: IdSchema.Type[] = [];
	const pendingItemIdSet = new Set<IdSchema.Type>();
	const routeExpansionRunsByKey = new Map<string, RouteExpansionRuns>();
	const chargeDemandByExpansionKey = new Map<string, ReadonlyMap<IdSchema.Type, number>>();
	const normalPlannedQuantityByItemId = new Map<IdSchema.Type, number>();
	const renewalPlannedQuantityByItemId = new Map<IdSchema.Type, number>();
	const renewalQuantityByItemId = new Map<IdSchema.Type, number>();

	const queueItem = (candidateItemId: IdSchema.Type) => {
		if (pendingItemIdSet.has(candidateItemId)) return;
		pendingItemIdSet.add(candidateItemId);
		pendingItemIds.push(candidateItemId);
	};
	const addGoal = ({
		bootstrapQuantity = 0,
		candidateItemId,
		projectedQuantity = 0,
		requiredQuantity,
	}: {
		readonly bootstrapQuantity?: number;
		readonly candidateItemId: IdSchema.Type;
		readonly projectedQuantity?: number;
		readonly requiredQuantity: number;
	}) => {
		const current = demandByItemId.get(candidateItemId) ?? {
			bootstrapQuantity: 0,
			projectedQuantity: 0,
			quantity: 0,
			requiredCharges: 0,
		};
		const nextQuantity = Math.max(current.quantity, requiredQuantity);
		const nextBootstrapQuantity = Math.min(
			nextQuantity,
			Math.max(current.bootstrapQuantity, bootstrapQuantity),
		);
		const nextProjectedQuantity = Math.max(current.projectedQuantity, projectedQuantity);
		if (
			nextQuantity === current.quantity &&
			nextBootstrapQuantity === current.bootstrapQuantity &&
			nextProjectedQuantity === current.projectedQuantity
		)
			return;
		demandByItemId.set(candidateItemId, {
			...current,
			bootstrapQuantity: nextBootstrapQuantity,
			projectedQuantity: nextProjectedQuantity,
			quantity: nextQuantity,
		});
		queueItem(candidateItemId);
	};

	const expandRoute = ({
		bootstrapRunCount,
		expansionKey,
		renewedItemId,
		renewedQuantity = 0,
		route,
		runCount,
	}: {
		readonly bootstrapRunCount: number;
		readonly expansionKey: string;
		readonly renewedItemId?: IdSchema.Type;
		readonly renewedQuantity?: number;
		readonly route: PlannerAcquisitionRoute;
		readonly runCount: number;
	}) => {
		const previous = routeExpansionRunsByKey.get(expansionKey);
		if (
			previous !== undefined &&
			previous.total >= runCount &&
			previous.bootstrap >= bootstrapRunCount
		)
			return;
		routeExpansionRunsByKey.set(expansionKey, {
			bootstrap: Math.max(previous?.bootstrap ?? 0, bootstrapRunCount),
			total: Math.max(previous?.total ?? 0, runCount),
		});
		const totalDemand = readRouteRequirementDemand({
			plan,
			route,
			runCount,
			runtimeFacts,
		});
		const bootstrapDemand = readRouteRequirementDemand({
			plan,
			route,
			runCount: bootstrapRunCount,
			runtimeFacts,
		});
		const chargeDemandByItemId = new Map<IdSchema.Type, number>();
		for (const [requirementItemId, demand] of totalDemand) {
			const requiredQuantity = demand.consumed + demand.retained;
			const bootstrap = bootstrapDemand.get(requirementItemId);
			const bootstrapQuantity = (bootstrap?.consumed ?? 0) + (bootstrap?.retained ?? 0);
			const projectedQuantity =
				renewedItemId === undefined
					? 0
					: readProjectedLifecycleQuantity({
							itemId: requirementItemId,
							plan,
							renewedItemId,
							renewedQuantity,
							requiredQuantity,
						});
			addGoal({
				bootstrapQuantity,
				candidateItemId: requirementItemId,
				projectedQuantity,
				requiredQuantity,
			});
			if (demand.charges > 0) chargeDemandByItemId.set(requirementItemId, demand.charges);
		}
		chargeDemandByExpansionKey.set(expansionKey, chargeDemandByItemId);
	};

	addGoal({
		candidateItemId: itemId,
		requiredQuantity: quantity,
	});

	const maximumRenewalRounds = Math.max(
		64,
		(plan.witnessRouteByItemId.size + plan.renewalRouteByItemId.size) * 4,
	);
	for (let renewalRound = 0; renewalRound < maximumRenewalRounds; renewalRound += 1) {
		while (pendingItemIds.length > 0) {
			const candidateItemId = pendingItemIds.shift();
			if (candidateItemId === undefined) continue;
			pendingItemIdSet.delete(candidateItemId);
			const demand = demandByItemId.get(candidateItemId);
			if (demand === undefined) continue;
			const route = readAcquisitionRoute(plan, candidateItemId);
			if (route === undefined || route.output.maximumQuantity <= 0) continue;
			const availableQuantity =
				readIndexedRuntimeQuantity(runtimeFacts, candidateItemId) +
				demand.projectedQuantity;
			const missingQuantity = Math.max(0, demand.quantity - availableQuantity);
			const missingBootstrapQuantity = Math.max(
				0,
				demand.bootstrapQuantity - availableQuantity,
			);
			const outputRunCount = Math.ceil(missingQuantity / route.output.maximumQuantity);
			const bootstrapOutputRunCount = Math.min(
				outputRunCount,
				Math.ceil(missingBootstrapQuantity / route.output.maximumQuantity),
			);
			const actionRunCount = readRouteActionRunCount(route, outputRunCount);
			const bootstrapActionRunCount = readRouteActionRunCount(route, bootstrapOutputRunCount);
			normalPlannedQuantityByItemId.set(
				candidateItemId,
				outputRunCount * route.output.maximumQuantity,
			);
			if (actionRunCount > 0)
				expandRoute({
					bootstrapRunCount: bootstrapActionRunCount,
					expansionKey: `normal:${candidateItemId}`,
					route,
					runCount: actionRunCount,
				});
		}

		const requiredChargesByItemId = new Map<IdSchema.Type, number>();
		for (const chargeDemand of chargeDemandByExpansionKey.values())
			for (const [chargedItemId, charges] of chargeDemand)
				requiredChargesByItemId.set(
					chargedItemId,
					(requiredChargesByItemId.get(chargedItemId) ?? 0) + charges,
				);

		let renewalExpanded = false;
		for (const [chargedItemId, requiredCharges] of requiredChargesByItemId) {
			const demand = demandByItemId.get(chargedItemId);
			if (demand !== undefined) demand.requiredCharges = requiredCharges;
			const fullCapacity = plan.chargeCapacityByItemId.get(chargedItemId);
			if (fullCapacity === undefined || fullCapacity <= 0) continue;
			const route = readAcquisitionRoute(plan, chargedItemId);
			if (route === undefined || route.output.maximumQuantity <= 0) continue;
			const currentCapacity = readIndexedRuntimeChargeCapacity(runtimeFacts, chargedItemId);
			const normalPlannedCapacity =
				(normalPlannedQuantityByItemId.get(chargedItemId) ?? 0) * fullCapacity;
			const projectedCapacity = (demand?.projectedQuantity ?? 0) * fullCapacity;
			const alreadyPlannedRenewalCapacity =
				(renewalPlannedQuantityByItemId.get(chargedItemId) ?? 0) * fullCapacity;
			const availableCapacity =
				currentCapacity +
				normalPlannedCapacity +
				projectedCapacity +
				alreadyPlannedRenewalCapacity;
			if (requiredCharges <= availableCapacity) continue;
			const additionalRenewalQuantity = Math.ceil(
				(requiredCharges - availableCapacity) / fullCapacity,
			);
			const nextRenewalQuantity =
				(renewalQuantityByItemId.get(chargedItemId) ?? 0) + additionalRenewalQuantity;
			renewalQuantityByItemId.set(chargedItemId, nextRenewalQuantity);
			const renewalOutputRunCount = Math.ceil(
				nextRenewalQuantity / route.output.maximumQuantity,
			);
			const renewalActionRunCount = readRouteActionRunCount(route, renewalOutputRunCount);
			const plannedRenewalQuantity = renewalOutputRunCount * route.output.maximumQuantity;
			renewalPlannedQuantityByItemId.set(chargedItemId, plannedRenewalQuantity);
			expandRoute({
				bootstrapRunCount: renewalActionRunCount,
				expansionKey: `renewal:${chargedItemId}`,
				renewedItemId: chargedItemId,
				renewedQuantity: nextRenewalQuantity,
				route,
				runCount: renewalActionRunCount,
			});
			renewalExpanded = true;
		}
		if (!renewalExpanded && pendingItemIds.length === 0) break;
	}

	return new Map(
		[
			...demandByItemId,
		].map(([candidateItemId, demand]) => [
			candidateItemId,
			{
				bootstrapQuantity: demand.bootstrapQuantity,
				projectedQuantity: demand.projectedQuantity,
				quantity: demand.quantity,
				requiredCharges: demand.requiredCharges,
			} satisfies PlannerActiveItemDemand,
		]),
	);
};

export const readPlannerActiveDemandFx = Effect.fn("readPlannerActiveDemandFx")(
	(args: {
		readonly itemId: IdSchema.Type;
		readonly plan: PlannerSearchPriorityPlan;
		readonly quantity: number;
		readonly runtime: RuntimeSchema.Type;
	}) =>
		Effect.sync(() =>
			readPlannerActiveDemand({
				...args,
				runtimeFacts: indexRuntimeItemFacts(args.runtime),
			}),
		),
);
