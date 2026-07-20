import { Effect } from "effect";

import type { ToolbarSizeSchema } from "~/engine/meta/schema/ToolbarSizeSchema";
import type { ToolbarLocationSchema } from "~/engine/location/schema/ToolbarLocationSchema";

export namespace readToolbarLocationsFx {
	export interface Props {
		size: ToolbarSizeSchema.Type;
	}
}

/** Enumerates every passive toolbar slot from left to right. */
export const readToolbarLocationsFx = Effect.fn("readToolbarLocationsFx")(function* ({
	size,
}: readToolbarLocationsFx.Props) {
	const locations: ToolbarLocationSchema.Type[] = [];
	for (let x = 0; x < size; x += 1) {
		locations.push({
			scope: "toolbar",
			position: {
				x,
				y: 0,
			},
		});
	}
	return locations;
});
