import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import { resolveItemFx } from "~/v1/item/fx/resolveItemFx";
import type { DropResultSchema } from "~/v1/output/schema/DropResultSchema";
import type { PlacementPlanSchema } from "~/v1/placement/schema/PlacementPlanSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { applyPlacementPlanFx } from "./applyPlacementPlanFx";
import { assertPlacementMaxCountFx } from "./assertPlacementMaxCountFx";
import { mergePlacementPlansFx } from "./mergePlacementPlansFx";
import { planDropScopePlacementFx } from "./planDropScopePlacementFx";
import { planReplacePlacementFx } from "./planReplacePlacementFx";
import { readPlacementPlanQuantityFx } from "./readPlacementPlanQuantityFx";

export namespace planDropPlacementFx {
	export interface Props {
		drop: DropResultSchema.Type;
		excludedStackItemIds?: ReadonlyArray<IdSchema.Type>;
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

/**
 * Orchestrates one complete all-or-nothing placement plan for a resolved drop.
 */
export const planDropPlacementFx = Effect.fn("planDropPlacementFx")(function* ({
	drop,
	excludedStackItemIds,
	origin,
	originItemId,
	runtime,
}: planDropPlacementFx.Props) {
	const item = yield* resolveItemFx({
		itemId: drop.itemId,
	});
	yield* assertPlacementMaxCountFx({
		drop,
		item,
		removeItemId: drop.placement === "replace" ? originItemId : undefined,
		runtime,
	});

	const replacePlan =
		drop.placement === "replace"
			? yield* planReplacePlacementFx({
					drop,
					item,
					origin,
					originItemId,
					quantity: drop.quantity,
					runtime,
				})
			: emptyPlan;

	const replaceQuantity = yield* readPlacementPlanQuantityFx({
		plan: replacePlan,
	});
	const remainingQuantity = drop.quantity - replaceQuantity;
	if (remainingQuantity === 0) {
		return replacePlan;
	}

	const [, draft] = yield* applyPlacementPlanFx({
		plan: replacePlan,
		runtime,
	});
	const scopePlan = yield* planDropScopePlacementFx({
		drop,
		excludedStackItemIds,
		item,
		origin,
		quantity: remainingQuantity,
		runtime: draft,
	});

	return yield* mergePlacementPlansFx({
		plans: [
			replacePlan,
			scopePlan,
		],
	});
});
