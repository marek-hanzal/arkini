import { Array, Effect } from "effect";

import { distanceFx } from "~/engine/distance/fx/distanceFx";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { QueryBoardSchema } from "~/engine/query/schema/QueryBoardSchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isBoardRuntimeItemFx } from "~/engine/runtime/read/isBoardRuntimeItemFx";
import { queryItemsFx } from "./queryItemsFx";
import { createBoardRectangleFx } from "~/engine/grid/fx/createBoardRectangleFx";
import { readBoardRuntimeItemRectangleFx } from "~/engine/grid/fx/readBoardRuntimeItemRectangleFx";
import type { BoardRectangleSchema } from "~/engine/grid/schema/BoardRectangleSchema";

export namespace queryBoardFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		originRectangle?: BoardRectangleSchema.Type;
		query: QueryBoardSchema.Type;
	}
}

/**
 * Selects board items matching both the configured selector and distance rule.
 */
export const queryBoardFx = Effect.fn("queryBoardFx")(function* ({
	origin,
	originRectangle,
	query,
}: queryBoardFx.Props) {
	const items = yield* getItemsFx();
	const boardItems = Array.getSomes(yield* Effect.forEach(items, isBoardRuntimeItemFx));
	const selected = yield* queryItemsFx({
		items: boardItems.filter((item) => item.location.space === origin.space),
		selector: query.selector,
	});
	const selectedBoardItems = Array.getSomes(
		yield* Effect.forEach(selected, isBoardRuntimeItemFx),
	);
	const originItem = boardItems.find(
		(item) =>
			item.location.space === origin.space &&
			item.location.position.x === origin.position.x &&
			item.location.position.y === origin.position.y,
	);
	const resolvedOriginRectangle =
		originRectangle ??
		(originItem === undefined
			? yield* createBoardRectangleFx({
					anchor: origin,
					footprint: {
						width: 1,
						height: 1,
					},
				})
			: yield* readBoardRuntimeItemRectangleFx({
					item: originItem,
				}));

	return yield* Effect.filter(selectedBoardItems, (item) => {
		return Effect.gen(function* () {
			return yield* distanceFx({
				distance: query.distance,
				item: yield* readBoardRuntimeItemRectangleFx({
					item,
				}),
				origin: resolvedOriginRectangle,
			});
		});
	});
});
