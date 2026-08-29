import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { PositionSchema } from "~/item-location/schema/PositionSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { orderGridLocationsFn } from "~/item-placement/fn/orderGridLocationsFn";
import { readInventoryLocationsFn } from "~/item-placement/fn/readInventoryLocationsFn";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { planScopePlacementFx } from "./planScopePlacementFx";

interface PlanInventoryPlacementProps {
	readonly excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
	readonly item: ItemSchema.Type;
	readonly origin?: PositionSchema.Type;
	readonly quantity: PositiveIntegerSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

/** Plans stack-first placement in the universe-wide passive inventory. */
export const planInventoryPlacementFx = Effect.fn("planInventoryPlacementFx")(function* ({
	excludedLocations,
	item,
	origin,
	quantity,
	runtime,
}: PlanInventoryPlacementProps) {
	const config = yield* GameConfigFx;
	const inventoryLocations = readInventoryLocationsFn({
		size: config.meta.inventory,
	});
	const orderedLocations =
		origin === undefined
			? inventoryLocations
			: orderGridLocationsFn({
					locations: inventoryLocations,
					origin,
				});

	return yield* planScopePlacementFx({
		excludedLocations,
		item,
		locations: orderedLocations,
		origin,
		quantity,
		runtime,
	});
});
