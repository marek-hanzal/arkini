import { Array, Effect, Option, pipe } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { resolveItemFx } from "~/v1/item/fx/resolveItemFx";
import { readGridLocationOccupantsFx } from "~/v1/location/read/readGridLocationOccupantsFx";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import { assertPlacementMaxCountFx } from "~/v1/placement/fx/assertPlacementMaxCountFx";
import { ItemAlreadyExistsError } from "~/v1/runtime/error/ItemAlreadyExistsError";
import { LocationOccupiedError } from "~/v1/runtime/error/LocationOccupiedError";
import { createRuntimeItemFx } from "~/v1/runtime/fx/createRuntimeItemFx";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import { isGridRuntimeItem } from "~/v1/runtime/read/isGridRuntimeItem";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace spawnItemFx {
	export interface Props {
		id: IdSchema.Type;
		itemId: IdSchema.Type;
		location: GridLocationSchema.Type;
		quantity: PositiveIntegerSchema.Type;
	}
}

/**
 * Atomically creates one new live item at an unoccupied location.
 */
export const spawnItemFx = Effect.fn("spawnItemFx")(function* ({
	id,
	itemId,
	location,
	quantity,
}: spawnItemFx.Props) {
	const item = yield* resolveItemFx({
		itemId,
	});
	const runtimeItem = yield* createRuntimeItemFx({
		id,
		item,
		location,
		quantity,
	});
	return yield* modifyRuntimeFx((runtime) => {
		return Effect.gen(function* () {
			const duplicate = pipe(
				runtime.items,
				Array.findFirst((candidate) => candidate.id === id),
				Option.getOrUndefined,
			);
			if (duplicate !== undefined) {
				return yield* Effect.fail(
					new ItemAlreadyExistsError({
						itemId: id,
					}),
				);
			}

			const [occupants] = yield* readGridLocationOccupantsFx({
				items: runtime.items.filter(isGridRuntimeItem),
				locations: [
					location,
				],
			});
			const occupant = occupants?.items[0];
			if (occupant !== undefined) {
				return yield* Effect.fail(
					new LocationOccupiedError({
						itemId: occupant.id,
						location,
					}),
				);
			}

			yield* assertPlacementMaxCountFx({
				drop: {
					itemId,
					placement: "drop",
					quantity,
				},
				item,
				runtime,
			});

			const nextRuntime = {
				...runtime,
				items: [
					...runtime.items,
					runtimeItem,
				],
			} satisfies RuntimeSchema.Type;

			return [
				runtimeItem,
				nextRuntime,
			] as const;
		});
	});
});
