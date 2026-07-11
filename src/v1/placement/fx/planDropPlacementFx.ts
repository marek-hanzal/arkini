import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import { resolveItemFx } from "~/v1/item/fx/resolveItemFx";
import type { DropResultSchema } from "~/v1/output/schema/DropResultSchema";
import { PlacementUnavailableError } from "~/v1/placement/error/PlacementUnavailableError";
import type { PlacementFailureReasonEnumSchema } from "~/v1/placement/schema/PlacementFailureReasonEnumSchema";
import type { PlacementPlanSchema } from "~/v1/placement/schema/PlacementPlanSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { applyPlacementPlanFx } from "./applyPlacementPlanFx";
import { assertPlacementMaxCountFx } from "./assertPlacementMaxCountFx";
import { mergePlacementPlansFx } from "./mergePlacementPlansFx";
import { planBoardPlacementFx } from "./planBoardPlacementFx";
import { planInventoryPlacementFx } from "./planInventoryPlacementFx";
import { planReplacePlacementFx } from "./planReplacePlacementFx";
import { readPlacementPlanQuantityFx } from "./readPlacementPlanQuantityFx";

export namespace planDropPlacementFx {
	export interface Props {
		drop: DropResultSchema.Type;
		origin: PositionSchema.Type;
		originItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

const emptyPlan = {
	remove: [],
	spawn: [],
	stack: [],
} satisfies PlacementPlanSchema.Type;

const failPlacementFx = ({
	drop,
	reason,
	remainingQuantity,
}: {
	drop: DropResultSchema.Type;
	reason: PlacementFailureReasonEnumSchema.Type;
	remainingQuantity: number;
}) => {
	return Effect.fail(
		new PlacementUnavailableError({
			itemId: drop.itemId,
			placement: drop.placement,
			quantity: drop.quantity,
			reason,
			remainingQuantity,
		}),
	);
};

/**
 * Builds one complete all-or-nothing placement plan for a resolved drop.
 */
export const planDropPlacementFx = Effect.fn("planDropPlacementFx")(function* ({
	drop,
	origin,
	originItemId,
	runtime,
}: planDropPlacementFx.Props) {
	const item = yield* resolveItemFx({
		itemId: drop.itemId,
	});
	const replace = drop.placement === "replace";
	const replacePlan = replace
		? yield* planReplacePlacementFx({
				drop,
				item,
				origin,
				originItemId,
				quantity: drop.quantity,
				runtime,
			})
		: emptyPlan;
	yield* assertPlacementMaxCountFx({
		drop,
		item,
		removeItemId: replace ? originItemId : undefined,
		runtime,
	});

	let plans: PlacementPlanSchema.Type[] = [
		replacePlan,
	];
	let [, draft] = yield* applyPlacementPlanFx({
		plan: replacePlan,
		runtime,
	});
	let placedQuantity = yield* readPlacementPlanQuantityFx({
		plan: replacePlan,
	});
	let remainingQuantity = drop.quantity - placedQuantity;

	const boardAllowed = item.scope === "board" || item.scope === "any";
	if (remainingQuantity > 0 && boardAllowed) {
		const boardPlan = yield* planBoardPlacementFx({
			item,
			origin,
			placement: drop.placement === "random" ? "random" : "drop",
			quantity: remainingQuantity,
			runtime: draft,
		});
		plans.push(boardPlan);
		[, draft] = yield* applyPlacementPlanFx({
			plan: boardPlan,
			runtime: draft,
		});
		placedQuantity = yield* readPlacementPlanQuantityFx({
			plan: boardPlan,
		});
		remainingQuantity -= placedQuantity;
	}

	const inventoryAllowed = item.scope === "inventory" || item.scope === "any";
	if (remainingQuantity > 0 && inventoryAllowed) {
		const inventoryPlan = yield* planInventoryPlacementFx({
			item,
			quantity: remainingQuantity,
			runtime: draft,
		});
		plans.push(inventoryPlan);
		placedQuantity = yield* readPlacementPlanQuantityFx({
			plan: inventoryPlan,
		});
		remainingQuantity -= placedQuantity;
	}

	if (remainingQuantity > 0) {
		return yield* failPlacementFx({
			drop,
			reason: inventoryAllowed ? "inventory:full" : "board:full",
			remainingQuantity,
		});
	}

	plans = plans.filter((plan) => {
		return plan.remove.length > 0 || plan.spawn.length > 0 || plan.stack.length > 0;
	});

	return yield* mergePlacementPlansFx({
		plans,
	});
});
