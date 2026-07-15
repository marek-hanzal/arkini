import { Effect } from "effect";

import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import { readGridLocationOccupantsFx } from "~/v1/location/read/readGridLocationOccupantsFx";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import { isGridRuntimeItem } from "./isGridRuntimeItem";
import { getItemsFx } from "./getItemsFx";

export namespace getItemAtFx {
	export interface Props {
		location: GridLocationSchema.Type;
	}
}

/** Reads one live item at a concrete location. */
export const getItemAtFx = Effect.fn("getItemAtFx")(function* ({ location }: getItemAtFx.Props) {
	const items = yield* getItemsFx();
	const [occupants] = yield* readGridLocationOccupantsFx({
		items: items.filter(isGridRuntimeItem),
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
