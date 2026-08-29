import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { PositionSchema } from "~/engine/grid/schema/PositionSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { orderGridLocationsFn } from "~/engine/placement/fn/orderGridLocationsFn";
import { readInventoryLocationsFn } from "~/engine/placement/fn/readInventoryLocationsFn";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { planScopePlacementFx } from "./planScopePlacementFx";

export namespace planInventoryPlacementFx {
	export interface Props {
		excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
		item: ItemSchema.Type;
		origin?: PositionSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Plans stack-first placement in the universe-wide passive inventory. */
export const planInventoryPlacementFx = Effect.fn("planInventoryPlacementFx")(function* ({
	excludedLocations,
	item,
	origin,
	quantity,
	runtime,
}: planInventoryPlacementFx.Props) {
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
