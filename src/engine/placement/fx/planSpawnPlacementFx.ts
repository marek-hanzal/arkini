import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { PlacementPlanSchema } from "~/engine/placement/schema/PlacementPlanSchema";
import { createRuntimeItemFx } from "~/engine/runtime/fx/createRuntimeItemFx";
import { createRuntimeItemIdFx } from "~/engine/runtime/fx/createRuntimeItemIdFx";

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
