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
	const stackCount = Math.min(locations.length, Math.ceil(quantity / item.maxStackSize));

	return yield* Effect.forEach(locations.slice(0, stackCount), (location, index) => {
		return createRuntimeItemIdFx().pipe(
			Effect.map((id) => {
				return {
					item: {
						id,
						item,
						location,
						quantity: Math.min(item.maxStackSize, quantity - index * item.maxStackSize),
					},
				} satisfies PlacementPlanSchema.Type["spawn"][number];
			}),
		);
	});
});
