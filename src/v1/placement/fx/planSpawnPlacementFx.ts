import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { LocationSchema } from "~/v1/location/schema/LocationSchema";
import type { PlacementPlanSchema } from "~/v1/placement/schema/PlacementPlanSchema";
import { createRuntimeItemIdFx } from "~/v1/runtime/fx/createRuntimeItemIdFx";

export namespace planSpawnPlacementFx {
	export interface Props {
		item: ItemSchema.Type;
		locations: ReadonlyArray<LocationSchema.Type>;
		quantity: PositiveIntegerSchema.Type;
	}
}

/**
 * Plans new runtime stacks across ordered empty locations.
 */
export const planSpawnPlacementFx = Effect.fn("planSpawnPlacementFx")(function* ({
	item,
	locations,
	quantity,
}: planSpawnPlacementFx.Props) {
	let remainingQuantity = quantity;
	const spawn: PlacementPlanSchema.Type["spawn"] = [];

	for (const location of locations) {
		if (remainingQuantity === 0) {
			break;
		}

		const placedQuantity = Math.min(remainingQuantity, item.maxStackSize);
		spawn.push({
			item: {
				id: yield* createRuntimeItemIdFx(),
				item,
				location,
				quantity: placedQuantity,
			},
		});
		remainingQuantity -= placedQuantity;
	}

	return spawn;
});
