import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { PlacementPlan } from "~/item-placement/type/PlacementPlan";
import { createRuntimeItemFx } from "~/game-runtime/fx/createRuntimeItemFx";
import { createRuntimeItemIdFx } from "~/game-runtime/fx/createRuntimeItemIdFx";

interface PlanSpawnPlacementProps {
	readonly item: ItemSchema.Type;
	readonly locations: ReadonlyArray<GridLocationSchema.Type>;
	readonly quantity: PositiveIntegerSchema.Type;
}

/**
 * Plans new runtime stacks across ordered empty locations.
 */
export const planSpawnPlacementFx = Effect.fn("planSpawnPlacementFx")(function* ({
	item,
	locations,
	quantity,
}: PlanSpawnPlacementProps) {
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
			} satisfies PlacementPlan["spawn"][number];
		});
	});
});
