import { Effect } from "effect";

import type { PlannerActiveItemDemand } from "~/editor/planner/PlannerActiveItemDemand";
import type { PlannerAcquisitionRoute } from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerSearchPriority } from "~/editor/planner/PlannerSearchPriority";
import type { PlannerSearchPriorityPlan } from "~/editor/planner/PlannerSearchPriorityPlan";
import type { PlannerSearchScope } from "~/editor/planner/PlannerSearchScope";
import { readPlannerActiveDemandFx } from "~/editor/planner/readPlannerActiveDemandFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

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

/**
 * Reads lexicographic progress toward the preferred witness plus a broad scope tie-breaker.
 *
 * Partial charge spend counts as progress toward a depletion output. Without it, a shallower fuel
 * producer could outrank the real spender forever once enough consumables already exist.
 */
const readPlannerSearchPriority = ({
	activeDemand,
	plan,
	quantityByItemId,
	runtime,
	scope,
}: {
	readonly activeDemand: ReadonlyMap<IdSchema.Type, PlannerActiveItemDemand>;
	readonly plan: PlannerSearchPriorityPlan;
	readonly quantityByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly runtime: RuntimeSchema.Type;
	readonly scope: PlannerSearchScope;
}): PlannerSearchPriority => {
	const preferredHeadroomByDepth: number[] = [];
	const preferredProgressByDepth: number[] = [];
	const demandByItemId = activeDemand;
	for (const [candidateItemId, demand] of demandByItemId) {
		if (demand.quantity <= 0) continue;
		const availableQuantity = Math.min(
			(quantityByItemId.get(candidateItemId) ?? 0) + demand.projectedQuantity,
			demand.quantity,
		);
		const witnessRoute = plan.witnessRouteByItemId.get(candidateItemId);
		const route =
			witnessRoute?.output.itemId === candidateItemId
				? witnessRoute
				: plan.renewalRouteByItemId.get(candidateItemId);
		const lifecycleQuantity =
			availableQuantity < demand.quantity && route?.kind === "line-charge-depletion"
				? Math.min(
						demand.quantity - availableQuantity,
						route.output.maximumQuantity *
							readChargeDepletionProgress({
								route,
								runtime,
							}),
					)
				: 0;
		const progress = (availableQuantity + lifecycleQuantity) / demand.quantity;
		const depth = plan.depthByItemId.get(candidateItemId) ?? 0;
		preferredProgressByDepth[depth] = (preferredProgressByDepth[depth] ?? 0) + progress;

		const maximumSingleActionOutput =
			plan.maximumSingleActionOutputByItemId.get(candidateItemId) ?? 0;
		const headroomCapacity = Math.max(0, maximumSingleActionOutput - demand.quantity);
		if (headroomCapacity > 0) {
			const headroom =
				Math.min(
					headroomCapacity,
					Math.max(0, (quantityByItemId.get(candidateItemId) ?? 0) - demand.quantity),
				) / headroomCapacity;
			preferredHeadroomByDepth[depth] = (preferredHeadroomByDepth[depth] ?? 0) + headroom;
		}
	}

	let scopeProgress = 0;
	for (const candidateItemId of scope.itemIds) {
		if ((quantityByItemId.get(candidateItemId) ?? 0) <= 0) continue;
		scopeProgress += plan.depthByItemId.get(candidateItemId) ?? 0;
	}
	return {
		preferredHeadroomByDepth,
		preferredProgressByDepth,
		scopeProgress,
	};
};

export const readPlannerSearchPriorityFx = Effect.fn("readPlannerSearchPriorityFx")(function* ({
	activeDemand,
	itemId,
	plan,
	quantity,
	runtime,
	scope,
}: {
	readonly activeDemand?: ReadonlyMap<IdSchema.Type, PlannerActiveItemDemand>;
	readonly itemId: IdSchema.Type;
	readonly plan: PlannerSearchPriorityPlan;
	readonly quantity: number;
	readonly runtime: RuntimeSchema.Type;
	readonly scope: PlannerSearchScope;
}) {
	const demand =
		activeDemand ??
		(yield* readPlannerActiveDemandFx({
			itemId,
			plan,
			quantity,
			runtime,
		}));
	const quantityByItemId = new Map<IdSchema.Type, number>();
	for (const item of runtime.items)
		quantityByItemId.set(
			item.item.id,
			(quantityByItemId.get(item.item.id) ?? 0) + item.quantity,
		);
	return readPlannerSearchPriority({
		activeDemand: demand,
		plan,
		quantityByItemId,
		runtime,
		scope,
	});
});
