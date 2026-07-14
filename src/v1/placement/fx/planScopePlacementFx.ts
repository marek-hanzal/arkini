import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import type { PlacementPlanSchema } from "~/v1/placement/schema/PlacementPlanSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { mergePlacementPlansFx } from "./mergePlacementPlansFx";
import { orderStackItemsFx } from "./orderStackItemsFx";
import { planSpawnPlacementFx } from "./planSpawnPlacementFx";
import { planStackPlacementFx } from "./planStackPlacementFx";
import { readAvailableStackItemsFx } from "./readAvailableStackItemsFx";
import { readEmptyLocationsFx } from "./readEmptyLocationsFx";
import { readPlacementPlanQuantityFx } from "./readPlacementPlanQuantityFx";

export namespace planScopePlacementFx {
	export interface Props {
		excludedStackItemIds?: ReadonlyArray<IdSchema.Type>;
		item: ItemSchema.Type;
		locations: ReadonlyArray<GridLocationSchema.Type>;
		origin?: PositionSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
		scope: GridLocationSchema.Type["scope"];
	}
}

/**
 * Plans stack-first placement within one concrete runtime scope.
 */
export const planScopePlacementFx = Effect.fn("planScopePlacementFx")(function* ({
	excludedStackItemIds,
	item,
	locations,
	origin,
	quantity,
	runtime,
	scope,
}: planScopePlacementFx.Props) {
	const availableStacks = yield* readAvailableStackItemsFx({
		excludedStackItemIds,
		itemId: item.id,
		runtime,
		scope,
	});
	const orderedStacks = yield* orderStackItemsFx({
		items: availableStacks,
		origin,
	});
	const stack = yield* planStackPlacementFx({
		items: orderedStacks,
		quantity,
	});
	const stackPlan = {
		remove: [],
		spawn: [],
		stack,
	} satisfies PlacementPlanSchema.Type;
	const stackedQuantity = yield* readPlacementPlanQuantityFx({
		plan: stackPlan,
	});
	const remainingQuantity = quantity - stackedQuantity;
	if (remainingQuantity === 0) {
		return stackPlan;
	}

	const emptyLocations = yield* readEmptyLocationsFx({
		locations,
		runtime,
	});
	const spawn = yield* planSpawnPlacementFx({
		item,
		locations: emptyLocations,
		quantity: remainingQuantity,
	});

	return yield* mergePlacementPlansFx({
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
