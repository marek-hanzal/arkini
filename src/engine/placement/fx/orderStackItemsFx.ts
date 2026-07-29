import { Effect } from "effect";

import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import { createBoardRectangleFx } from "~/engine/grid/fx/createBoardRectangleFx";
import { readBoardRectangleManhattanGapFx } from "~/engine/grid/fx/readBoardRectangleManhattanGapFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { BoardRectangleSchema } from "~/engine/grid/schema/BoardRectangleSchema";

export namespace orderStackItemsFx {
	export interface Props {
		items: ReadonlyArray<GridRuntimeItemSchema.Type>;
		origin?: BoardRectangleSchema.Type;
	}
}

/**
 * Orders stack candidates by origin distance or deterministic scan order.
 */
export const orderStackItemsFx = Effect.fn("orderStackItemsFx")(function* ({
	items,
	origin,
}: orderStackItemsFx.Props) {
	const candidates = yield* Effect.forEach(items, (item) =>
		Effect.gen(function* () {
			let distance = 0;
			if (
				origin !== undefined &&
				item.location.scope === LocationScopeEnumSchema.enum.Board
			) {
				distance = yield* readBoardRectangleManhattanGapFx({
					left: yield* createBoardRectangleFx({
						anchor: item.location,
						footprint: item.item.footprint,
					}),
					right: origin,
				});
			} else if (origin !== undefined) {
				return yield* Effect.die(
					new Error("Rectangle-origin stack ordering requires Board items."),
				);
			}
			return {
				distance,
				item,
			};
		}),
	);
	return candidates
		.sort((leftCandidate, rightCandidate) => {
			const left = leftCandidate.item;
			const right = rightCandidate.item;
			const scanOrder =
				left.location.position.y - right.location.position.y ||
				left.location.position.x - right.location.position.x ||
				left.id.localeCompare(right.id);
			if (origin === undefined) {
				return scanOrder;
			}

			return leftCandidate.distance - rightCandidate.distance || scanOrder;
		})
		.map(({ item }) => item);
});
