import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { PositionSchema } from "~/engine/grid/schema/PositionSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { PlacementPlanSchema } from "~/engine/placement/schema/PlacementPlanSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { mergePlacementPlansFx } from "./mergePlacementPlansFx";
import { orderStackItemsFx } from "./orderStackItemsFx";
import { planSpawnPlacementFx } from "./planSpawnPlacementFx";
import { planStackPlacementFx } from "./planStackPlacementFx";
import { readAvailableStackItemsFx } from "./readAvailableStackItemsFx";
import { readEmptyLocationsFx } from "./readEmptyLocationsFx";
import { readPlacementPlanQuantityFx } from "./readPlacementPlanQuantityFx";

export namespace planScopePlacementFx {
	export interface Props {
		item: ItemSchema.Type;
		locations: ReadonlyArray<GridLocationSchema.Type>;
		origin?: PositionSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Plans stack-first placement within one concrete runtime scope. */
export const planScopePlacementFx = Effect.fn("planScopePlacementFx")(function* ({
	item,
	locations,
	origin,
	quantity,
	runtime,
}: planScopePlacementFx.Props) {
	const availableStacks = yield* readAvailableStackItemsFx({
		itemId: item.id,
		locations,
		runtime,
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
