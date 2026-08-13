import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionRequirement,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import { readPlannerExpectedIndependentRuns } from "~/editor/planner/readPlannerExpectedIndependentRuns";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export namespace readPlannerStructuralRuntimeIndex {
	export interface Props {
		readonly config: GameConfigSchema.Type;
		readonly graph: PlannerAcquisitionGraph;
	}
}

interface RequirementDemand {
	chargeCostPerRun: number;
	consumeQuantityPerRun: number;
	presenceQuantity: number;
	reserveQuantity: number;
}

const quantityEpsilon = 1e-9;

const readItemLines = (item: ItemSchema.Type): ReadonlyArray<LineSchema.Type> => {
	switch (item.type) {
		case "blueprint":
		case "craft":
		case "stash":
			return [
				item.line,
			];
		case "deposit":
		case "producer":
			return item.lines ?? [];
		case "inventory":
		case "simple":
		case "temporary":
			return [];
	}
};

const readActionRuntimeMs = (config: GameConfigSchema.Type, route: PlannerAcquisitionRoute) => {
	switch (route.action.kind) {
		case "line": {
			const { lineId, ownerItemId } = route.action;
			const owner = config.items[ownerItemId];
			const line =
				owner === undefined
					? undefined
					: readItemLines(owner).find(({ id }) => id === lineId);
			return line?.runtimeMs;
		}
		case "merge":
			return 0;
		case "temporary-expiry": {
			const item = config.items[route.action.itemId];
			return item?.type === "temporary" ? item.durationMs : undefined;
		}
	}
};

const makeRequirementDemand = (): RequirementDemand => ({
	chargeCostPerRun: 0,
	consumeQuantityPerRun: 0,
	presenceQuantity: 0,
	reserveQuantity: 0,
});

const addRequirement = (
	demandByItemId: Map<IdSchema.Type, RequirementDemand>,
	requirement: PlannerAcquisitionRequirement,
) => {
	const demand = demandByItemId.get(requirement.itemId) ?? makeRequirementDemand();
	switch (requirement.usage) {
		case "charge":
			// `charged-item` is the canonical charge-cost fact. Deposit/payer facts may repeat the
			// same input for structural reachability, so only the canonical fact contributes cost.
			if (requirement.source === "charged-item")
				demand.chargeCostPerRun += requirement.chargeCost ?? 0;
			break;
		case "consume":
			demand.consumeQuantityPerRun += requirement.minimumQuantity;
			break;
		case "presence":
			demand.presenceQuantity = Math.max(
				demand.presenceQuantity,
				requirement.minimumQuantity,
			);
			break;
		case "reserve":
			demand.reserveQuantity += requirement.minimumQuantity;
			break;
	}
	demandByItemId.set(requirement.itemId, demand);
};

const readChargedItemCount = ({
	actionRuns,
	config,
	demand,
	itemId,
	route,
	witnessRuns,
}: {
	readonly actionRuns: number;
	readonly config: GameConfigSchema.Type;
	readonly demand: RequirementDemand;
	readonly itemId: IdSchema.Type;
	readonly route: PlannerAcquisitionRoute;
	readonly witnessRuns: number;
}) => {
	if (route.kind === "line-charge-depletion" && route.chargedItemId === itemId)
		return witnessRuns;
	if (demand.chargeCostPerRun <= quantityEpsilon) return demand.presenceQuantity > 0 ? 1 : 0;
	const charges = config.items[itemId]?.charges?.amount;
	if (charges === undefined || charges <= 0) return 1;
	return (actionRuns * demand.chargeCostPerRun) / charges;
};

const readRequirementsRuntimeMs = ({
	actionRuns,
	config,
	requirements,
	route,
	runtimeByItemId,
	witnessRuns,
}: {
	readonly actionRuns: number;
	readonly config: GameConfigSchema.Type;
	readonly requirements: ReadonlyArray<PlannerAcquisitionRequirement>;
	readonly route: PlannerAcquisitionRoute;
	readonly runtimeByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly witnessRuns: number;
}) => {
	const demandByItemId = new Map<IdSchema.Type, RequirementDemand>();
	for (const requirement of requirements) addRequirement(demandByItemId, requirement);

	let runtimeMs = 0;
	for (const [itemId, demand] of demandByItemId) {
		const itemRuntimeMs = runtimeByItemId.get(itemId);
		if (itemRuntimeMs === undefined) return undefined;
		const consumedQuantity = demand.consumeQuantityPerRun * actionRuns;
		const retainedQuantity = Math.max(
			demand.presenceQuantity,
			demand.reserveQuantity,
			readChargedItemCount({
				actionRuns,
				config,
				demand,
				itemId,
				route,
				witnessRuns,
			}),
		);
		runtimeMs += itemRuntimeMs * (consumedQuantity + retainedQuantity);
	}
	return runtimeMs;
};

const readRouteRuntimeMs = ({
	config,
	route,
	runtimeByItemId,
}: {
	readonly config: GameConfigSchema.Type;
	readonly route: PlannerAcquisitionRoute;
	readonly runtimeByItemId: ReadonlyMap<IdSchema.Type, number>;
}) => {
	const actionRuntimeMs = readActionRuntimeMs(config, route);
	if (actionRuntimeMs === undefined) return undefined;
	const witnessRuns = readPlannerExpectedIndependentRuns({
		distribution: route.output.quantityDistribution,
		quantity: 1,
	});
	if (!Number.isFinite(witnessRuns)) return undefined;
	const actionRuns =
		route.kind === "line-charge-depletion"
			? witnessRuns * route.minimumRunsLowerBound
			: witnessRuns;
	const allOfRuntimeMs = readRequirementsRuntimeMs({
		actionRuns,
		config,
		requirements: route.requirements.allOf,
		route,
		runtimeByItemId,
		witnessRuns,
	});
	if (allOfRuntimeMs === undefined) return undefined;

	let anyOfRuntimeMs = 0;
	for (const clause of route.requirements.anyOf) {
		let cheapest = Number.POSITIVE_INFINITY;
		for (const requirement of clause) {
			const candidate = readRequirementsRuntimeMs({
				actionRuns,
				config,
				requirements: [
					requirement,
				],
				route,
				runtimeByItemId,
				witnessRuns,
			});
			if (candidate !== undefined) cheapest = Math.min(cheapest, candidate);
		}
		if (!Number.isFinite(cheapest)) return undefined;
		anyOfRuntimeMs += cheapest;
	}

	return actionRuntimeMs * actionRuns + allOfRuntimeMs + anyOfRuntimeMs;
};

/**
 * Computes one cheap optimistic runtime projection for every structurally reachable item.
 *
 * This is deliberately not a gameplay simulator. It relaxes concrete identities, finite stock,
 * route ordering, shared infrastructure and dynamic runtime rules. The detailed estimate remains
 * the engine-backed source of truth; this projection exists only to keep the all-item list fast.
 */
export const readPlannerStructuralRuntimeIndex = ({
	config,
	graph,
}: readPlannerStructuralRuntimeIndex.Props): ReadonlyMap<IdSchema.Type, number> => {
	const runtimeByItemId = new Map<IdSchema.Type, number>(
		[
			...graph.rootItemIds,
		].map((itemId) => [
			itemId,
			0,
		]),
	);
	const maximumPasses = Math.max(1, graph.itemIds.size * 2);

	for (let pass = 0; pass < maximumPasses; pass += 1) {
		let changed = false;
		for (const route of graph.routes) {
			if (!graph.reachableRouteIds.has(route.id)) continue;
			const candidate = readRouteRuntimeMs({
				config,
				route,
				runtimeByItemId,
			});
			if (candidate === undefined || !Number.isFinite(candidate)) continue;
			const current = runtimeByItemId.get(route.output.itemId);
			if (current !== undefined && current <= candidate + quantityEpsilon) continue;
			runtimeByItemId.set(route.output.itemId, candidate);
			changed = true;
		}
		if (!changed) break;
	}

	return runtimeByItemId;
};
