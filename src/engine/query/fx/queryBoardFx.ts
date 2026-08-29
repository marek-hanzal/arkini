import { Array, Effect } from "effect";

import { distanceFx } from "~/engine/distance/fx/distanceFx";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { queryItemsFn } from "~/engine/query/fn/queryItemsFn";
import type { BoardSchema } from "~/engine/query/schema/BoardSchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isBoardRuntimeItemFn } from "~/engine/runtime/read/fn/isBoardRuntimeItemFn";

export namespace queryBoardFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		query: BoardSchema.Type;
	}
}

/**
 * Selects board items matching both the configured selector and distance rule.
 */
export const queryBoardFx = Effect.fn("queryBoardFx")(function* ({
	origin,
	query,
}: queryBoardFx.Props) {
	const items = yield* getItemsFx();
	const boardItems = Array.getSomes(items.map(isBoardRuntimeItemFn));
	const selected = queryItemsFn({
		items: boardItems.filter((item) => item.location.space === origin.space),
		selector: query.selector,
	});
	const selectedBoardItems = Array.getSomes(selected.map(isBoardRuntimeItemFn));

	return yield* Effect.filter(selectedBoardItems, (item) => {
		return distanceFx({
			distance: query.distance,
			item: item.location.position,
			origin: origin.position,
		});
	});
});
