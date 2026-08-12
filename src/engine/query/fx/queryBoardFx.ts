import { Array, Effect } from "effect";

import { matchesSpatialRelationFx } from "~/engine/distance/fx/matchesSpatialRelationFx";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { QueryBoardSchema } from "~/engine/query/schema/QueryBoardSchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isBoardRuntimeItemFx } from "~/engine/runtime/read/isBoardRuntimeItemFx";
import { queryItemsFx } from "./queryItemsFx";

export namespace queryBoardFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		query: QueryBoardSchema.Type;
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
	const boardItems = Array.getSomes(yield* Effect.forEach(items, isBoardRuntimeItemFx));
	const selected = yield* queryItemsFx({
		items: boardItems.filter((item) => item.location.space === origin.space),
		selector: query.selector,
	});
	const selectedBoardItems = Array.getSomes(
		yield* Effect.forEach(selected, isBoardRuntimeItemFx),
	);

	return yield* Effect.filter(selectedBoardItems, (item) => {
		return matchesSpatialRelationFx({
			distance: query.distance,
			item: item.location.position,
			origin: origin.position,
		});
	});
});
