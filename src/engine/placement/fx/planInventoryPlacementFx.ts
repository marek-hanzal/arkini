import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { planScopePlacementFx } from "./planScopePlacementFx";
import { readInventoryLocationsFx } from "./readInventoryLocationsFx";

export namespace planInventoryPlacementFx {
	export interface Props {
		item: ItemSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Plans stack-first placement in the universe-wide passive inventory. */
export const planInventoryPlacementFx = Effect.fn("planInventoryPlacementFx")(function* ({
	item,
	quantity,
	runtime,
}: planInventoryPlacementFx.Props) {
	const config = yield* GameConfigFx;
	const inventoryLocations = yield* readInventoryLocationsFx({
		size: config.meta.inventory,
	});

	return yield* planScopePlacementFx({
		item,
		locations: inventoryLocations,
		quantity,
		runtime,
	});
});
