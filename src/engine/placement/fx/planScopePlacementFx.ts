import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { PositionSchema } from "~/engine/grid/schema/PositionSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { isSameGridLocationFn } from "~/engine/location/fn/isSameGridLocationFn";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { mergePlacementPlansFn } from "~/engine/placement/fn/mergePlacementPlansFn";
import { orderStackItemsFn } from "~/engine/placement/fn/orderStackItemsFn";
import { planStackPlacementFn } from "~/engine/placement/fn/planStackPlacementFn";
import { readEmptyLocationsFn } from "~/engine/placement/fn/readEmptyLocationsFn";
import { readPlacementPlanQuantityFn } from "~/engine/placement/fn/readPlacementPlanQuantityFn";
import type { PlacementPlan } from "~/engine/placement/PlacementPlan";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { planSpawnPlacementFx } from "./planSpawnPlacementFx";
import { readAvailableStackItemsFx } from "./readAvailableStackItemsFx";

export namespace planScopePlacementFx {
	export interface Props {
		excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
		item: ItemSchema.Type;
		locations: ReadonlyArray<GridLocationSchema.Type>;
		origin?: PositionSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Plans stack-first placement within one concrete runtime scope. */
export const planScopePlacementFx = Effect.fn("planScopePlacementFx")(function* ({
	excludedLocations = [],
	item,
	locations,
	origin,
	quantity,
	runtime,
}: planScopePlacementFx.Props) {
	const eligibleLocations: GridLocationSchema.Type[] = [];
	for (const location of locations) {
		let excluded = false;
		for (const excludedLocation of excludedLocations) {
			if (
				isSameGridLocationFn({
					left: location,
					right: excludedLocation,
				})
			) {
				excluded = true;
				break;
			}
		}
		if (!excluded) eligibleLocations.push(location);
	}
	const availableStacks = yield* readAvailableStackItemsFx({
		itemId: item.id,
		locations: eligibleLocations,
		runtime,
	});
	const orderedStacks = orderStackItemsFn({
		items: availableStacks,
		origin,
	});
	const stack = planStackPlacementFn({
		items: orderedStacks,
		quantity,
	});
	const stackPlan = {
		remove: [],
		spawn: [],
		stack,
	} satisfies PlacementPlan;
	const stackedQuantity = readPlacementPlanQuantityFn({
		plan: stackPlan,
	});
	const remainingQuantity = quantity - stackedQuantity;
	if (remainingQuantity === 0) {
		return stackPlan;
	}

	const emptyLocations = readEmptyLocationsFn({
		locations: eligibleLocations,
		runtime,
	});
	const spawn = yield* planSpawnPlacementFx({
		item,
		locations: emptyLocations,
		quantity: remainingQuantity,
	});

	return mergePlacementPlansFn({
		plans: [
			stackPlan,
			{
				remove: [],
				spawn,
				stack: [],
			},
		],
	});
});
