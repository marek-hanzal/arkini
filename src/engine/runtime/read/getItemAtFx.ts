import { Array, Effect } from "effect";

import { ItemNotFoundError } from "~/engine/item/error/ItemNotFoundError";
import { readGridLocationOccupantsFx } from "~/engine/location/read/readGridLocationOccupantsFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { isGridRuntimeItemFx } from "./isGridRuntimeItemFx";
import { getItemsFx } from "./getItemsFx";

export namespace getItemAtFx {
	export interface Props {
		location: GridLocationSchema.Type;
	}
}

/** Reads one live item at a concrete location. */
export const getItemAtFx = Effect.fn("getItemAtFx")(function* ({ location }: getItemAtFx.Props) {
	const items = yield* getItemsFx();
	const gridItems = Array.getSomes(yield* Effect.forEach(items, isGridRuntimeItemFx));
	const [occupants] = yield* readGridLocationOccupantsFx({
		items: gridItems,
		locations: [
			location,
		],
	});
	const item = occupants?.items[0];

	if (item === undefined) {
		return yield* Effect.fail(
			new ItemNotFoundError({
				location,
			}),
		);
	}

	return item;
});
