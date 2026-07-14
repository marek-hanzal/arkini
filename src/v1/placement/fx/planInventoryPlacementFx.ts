import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { planScopePlacementFx } from "./planScopePlacementFx";
import { readGridLocationsFx } from "./readGridLocationsFx";

export namespace planInventoryPlacementFx {
	export interface Props {
		item: ItemSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Plans stack-first inventory placement in deterministic slot order. */
export const planInventoryPlacementFx = Effect.fn("planInventoryPlacementFx")(function* ({
	item,
	quantity,
	runtime,
}: planInventoryPlacementFx.Props) {
	const config = yield* GameConfigFx;
	const inventoryLocations = yield* readGridLocationsFx({
		scope: "inventory",
		size: config.meta.inventory,
	});

	return yield* planScopePlacementFx({
		item,
		locations: inventoryLocations,
		quantity,
		runtime,
		scope: "inventory",
	});
});
