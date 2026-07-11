import { Effect } from "effect";

import type { LocationSchema } from "~/v1/location/schema/LocationSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace readEmptyLocationsFx {
	export interface Props {
		locations: ReadonlyArray<LocationSchema.Type>;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Filters concrete locations down to currently unoccupied cells.
 */
export const readEmptyLocationsFx = Effect.fn("readEmptyLocationsFx")(function* ({
	locations,
	runtime,
}: readEmptyLocationsFx.Props) {
	return locations.filter((location) => {
		return !runtime.items.some((item) => {
			return (
				item.location.scope === location.scope &&
				item.location.position.x === location.position.x &&
				item.location.position.y === location.position.y
			);
		});
	});
});
