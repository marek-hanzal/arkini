import { Effect } from "effect";

import { createBoardRectangleFx } from "~/engine/grid/fx/createBoardRectangleFx";
import { readBoardRectangleLocationsFx } from "~/engine/grid/fx/readBoardRectangleLocationsFx";
import { readEffectiveGridFootprintFx } from "~/engine/grid/fx/readEffectiveGridFootprintFx";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace readGridItemLocationsFx {
	export interface Props {
		item: ItemSchema.Type;
		location: GridLocationSchema.Type;
	}
}

/** Projects one item anchor to the concrete grid cells it owns on that surface. */
export const readGridItemLocationsFx = Effect.fn("readGridItemLocationsFx")(function* ({
	item,
	location,
}: readGridItemLocationsFx.Props) {
	const footprint = yield* readEffectiveGridFootprintFx({
		authored: item.footprint,
		location,
	});
	if (location.scope !== LocationScopeEnumSchema.enum.Board) {
		return [
			location,
		];
	}

	return yield* readBoardRectangleLocationsFx({
		rectangle: yield* createBoardRectangleFx({
			anchor: location,
			footprint,
		}),
	});
});
