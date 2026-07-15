import { Effect } from "effect";

import { distanceFx } from "~/v1/distance/fx/distanceFx";
import type { BoardLocationSchema } from "~/v1/location/schema/BoardLocationSchema";
import type { QueryBoardSchema } from "~/v1/query/schema/QueryBoardSchema";
import { getItemsFx } from "~/v1/runtime/read/getItemsFx";
import { isBoardRuntimeItem } from "~/v1/runtime/read/isBoardRuntimeItem";
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
	const selected = yield* queryItemsFx({
		items: items
			.filter(isBoardRuntimeItem)
			.filter((item) => item.location.space === origin.space),
		selector: query.selector,
	});

	return yield* Effect.filter(selected.filter(isBoardRuntimeItem), (item) => {
		return distanceFx({
			distance: query.distance,
			item: item.location.position,
			origin: origin.position,
		});
	});
});
