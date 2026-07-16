import { Effect } from "effect";

import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { QueryAnySchema } from "~/engine/query/schema/QueryAnySchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isBoardRuntimeItem } from "~/engine/runtime/read/isBoardRuntimeItem";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
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
