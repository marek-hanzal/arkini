import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { PlacementPlanSchema } from "~/engine/placement/schema/PlacementPlanSchema";
import { createRuntimeItemFx } from "~/engine/runtime/fx/createRuntimeItemFx";
import { createRuntimeItemIdFx } from "~/engine/runtime/fx/createRuntimeItemIdFx";
import { readGridItemLocationsFx } from "~/engine/location/read/readGridItemLocationsFx";
import { readGridLocationKey } from "~/engine/location/read/readGridLocationKey";

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
	const stackCount = Math.ceil(quantity / item.maxStackSize);
	const reservedLocationKeys = new Set<string>();
	const selectedLocations: GridLocationSchema.Type[] = [];
	for (const location of locations) {
		const occupiedLocations = yield* readGridItemLocationsFx({
			item,
			location,
		});
		const occupiedLocationKeys = occupiedLocations.map(readGridLocationKey);
		if (occupiedLocationKeys.some((key) => reservedLocationKeys.has(key))) continue;
		selectedLocations.push(location);
		for (const key of occupiedLocationKeys) reservedLocationKeys.add(key);
		if (selectedLocations.length === stackCount) break;
	}

	return yield* Effect.forEach(selectedLocations, (location, index) => {
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
