import { Effect } from "effect";

import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { createBoardRectangleFx } from "~/engine/grid/fx/createBoardRectangleFx";
import { readBoardRectangleManhattanGapFx } from "~/engine/grid/fx/readBoardRectangleManhattanGapFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { BoardRectangleSchema } from "~/engine/grid/schema/BoardRectangleSchema";

export namespace orderBoardLocationsFx {
	export interface Props {
		locations: ReadonlyArray<GridLocationSchema.Type>;
		origin: BoardRectangleSchema.Type;
		item: ItemSchema.Type;
	}
}

const compareByScanOrder = (left: GridLocationSchema.Type, right: GridLocationSchema.Type) => {
	return left.position.y - right.position.y || left.position.x - right.position.x;
};

/** Orders board locations by Manhattan distance from one resolved placement origin. */
export const orderBoardLocationsFx = Effect.fn("orderBoardLocationsFx")(function* ({
	locations,
	origin,
	item,
}: orderBoardLocationsFx.Props) {
	const candidates = yield* Effect.forEach(locations, (location) =>
		Effect.gen(function* () {
			if (location.scope !== LocationScopeEnumSchema.enum.Board) {
				return yield* Effect.die(
					new Error("Board placement ordering requires Board locations."),
				);
			}
			const candidateRectangle = yield* createBoardRectangleFx({
				anchor: location,
				footprint: item.footprint,
			});
			return {
				distance: yield* readBoardRectangleManhattanGapFx({
					left: origin,
					right: candidateRectangle,
				}),
				location,
			};
		}),
	);
	return candidates
		.sort((left, right) => {
			return (
				left.distance - right.distance || compareByScanOrder(left.location, right.location)
			);
		})
		.map(({ location }) => location);
});
