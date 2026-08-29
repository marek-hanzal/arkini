import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { PositionSchema } from "~/engine/grid/schema/PositionSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { orderGridLocationsFn } from "~/engine/placement/fn/orderGridLocationsFn";
import { readToolbarLocationsFn } from "~/engine/placement/fn/readToolbarLocationsFn";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { planScopePlacementFx } from "./planScopePlacementFx";

export namespace planToolbarPlacementFx {
	export interface Props {
		excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
		item: ItemSchema.Type;
		origin?: PositionSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Plans stack-first placement in the universe-wide passive toolbar. */
export const planToolbarPlacementFx = Effect.fn("planToolbarPlacementFx")(function* ({
	excludedLocations,
	item,
	origin,
	quantity,
	runtime,
}: planToolbarPlacementFx.Props) {
	const config = yield* GameConfigFx;
	const locations = readToolbarLocationsFn({
		size: config.meta.toolbarSize ?? 0,
	});
	const orderedLocations =
		origin === undefined
			? locations
			: orderGridLocationsFn({
					locations,
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
