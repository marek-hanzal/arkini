import { Effect } from "effect";

import type { BoardLocationSchema } from "~/v1/location/schema/BoardLocationSchema";
import type { QueryAnySchema } from "~/v1/query/schema/QueryAnySchema";
import { getItemsFx } from "~/v1/runtime/read/getItemsFx";
import { isBoardRuntimeItem } from "~/v1/runtime/read/isBoardRuntimeItem";
import { isGridRuntimeItem } from "~/v1/runtime/read/isGridRuntimeItem";
import { queryItemsFx } from "./queryItemsFx";

export namespace queryAnyFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		query: QueryAnySchema.Type;
	}
}

/** Selects global inventory plus board items from the origin space. */
export const queryAnyFx = Effect.fn("queryAnyFx")(function* ({ origin, query }: queryAnyFx.Props) {
	const items = yield* getItemsFx();

	return yield* queryItemsFx({
		items: items.filter(isGridRuntimeItem).filter((item) => {
			return !isBoardRuntimeItem(item) || item.location.space === origin.space;
		}),
		selector: query.selector,
	});
});
