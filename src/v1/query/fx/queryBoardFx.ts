import { Effect } from "effect";

import { distanceFx } from "~/v1/distance/fx/distanceFx";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import type { QueryBoardSchema } from "~/v1/query/schema/QueryBoardSchema";
import { getItemsFx } from "~/v1/runtime/read/getItemsFx";
import { isGridRuntimeItem } from "~/v1/runtime/read/isGridRuntimeItem";
import { queryItemsFx } from "./queryItemsFx";

export namespace queryBoardFx {
	export interface Props {
		origin: PositionSchema.Type;
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
	const selected = yield* queryItemsFx({
		items: items.filter(isGridRuntimeItem).filter((item) => {
			return item.location.scope === "board";
		}),
		selector: query.selector,
	});

	return yield* Effect.filter(selected.filter(isGridRuntimeItem), (item) => {
		return distanceFx({
			distance: query.distance,
			item: item.location.position,
			origin,
		});
	});
});
