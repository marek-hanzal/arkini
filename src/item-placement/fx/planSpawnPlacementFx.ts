import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { PlacementPlan } from "~/item-placement/type/PlacementPlan";
import { createRuntimeItemFx } from "~/game-runtime/fx/createRuntimeItemFx";
import { createRuntimeItemIdFx } from "~/game-runtime/fx/createRuntimeItemIdFx";

interface PlanSpawnPlacementProps {
	readonly item: ItemSchema.Type;
	readonly locations: ReadonlyArray<BoardLocationSchema.Type>;
	readonly quantity: PositiveIntegerSchema.Type;
}

/**
 * Plans new runtime identities across ordered empty locations.
 */
export const planSpawnPlacementFx = Effect.fn("planSpawnPlacementFx")(function* ({
	item,
	locations,
	quantity,
}: PlanSpawnPlacementProps) {
	const itemCount = Math.min(locations.length, quantity);

	return yield* Effect.forEach(locations.slice(0, itemCount), (location) => {
		return Effect.gen(function* () {
			const runtimeItem = yield* createRuntimeItemFx({
				id: yield* createRuntimeItemIdFx(),
				item,
				location,
			});

			return {
				item: runtimeItem,
			} satisfies PlacementPlan["spawn"][number];
		});
	});
});
