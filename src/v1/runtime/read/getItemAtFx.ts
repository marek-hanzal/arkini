import { Array, Effect, Option, pipe } from "effect";

import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import { isSameGridLocation } from "~/v1/location/read/isSameGridLocation";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import { isGridRuntimeItem } from "./isGridRuntimeItem";
import { getItemsFx } from "./getItemsFx";

export namespace getItemAtFx {
	export interface Props {
		location: GridLocationSchema.Type;
	}
}

/**
 * Reads one live item at a concrete location.
 */
export const getItemAtFx = Effect.fn("getItemAtFx")(function* ({ location }: getItemAtFx.Props) {
	const items = yield* getItemsFx();
	const item = pipe(
		items,
		Array.findFirst(
			(item) => isGridRuntimeItem(item) && isSameGridLocation(item.location, location),
		),
		Option.getOrUndefined,
	);

	if (item === undefined) {
		return yield* Effect.fail(
			new ItemNotFoundError({
				location,
			}),
		);
	}

	return item;
});
