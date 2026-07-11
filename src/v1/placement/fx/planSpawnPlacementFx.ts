import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import type { PlacementPlanSchema } from "~/v1/placement/schema/PlacementPlanSchema";
import { createRuntimeItemFx } from "~/v1/runtime/fx/createRuntimeItemFx";
import { createRuntimeItemIdFx } from "~/v1/runtime/fx/createRuntimeItemIdFx";

export namespace planSpawnPlacementFx {
	export interface Props {
		item: ItemSchema.Type;
		locations: ReadonlyArray<GridLocationSchema.Type>;
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
	const stackCount = Math.min(locations.length, Math.ceil(quantity / item.maxStackSize));

	return yield* Effect.forEach(locations.slice(0, stackCount), (location, index) => {
		return Effect.gen(function* () {
			const runtimeItem = yield* createRuntimeItemFx({
				id: yield* createRuntimeItemIdFx(),
				item,
				location,
				quantity: Math.min(item.maxStackSize, quantity - index * item.maxStackSize),
			});

			return {
				item: runtimeItem,
			} satisfies PlacementPlanSchema.Type["spawn"][number];
		});
	});
});
