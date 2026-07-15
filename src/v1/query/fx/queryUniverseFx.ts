import { Effect } from "effect";

import type { QueryUniverseSchema } from "~/v1/query/schema/QueryUniverseSchema";
import { getItemsFx } from "~/v1/runtime/read/getItemsFx";
import { isGridRuntimeItem } from "~/v1/runtime/read/isGridRuntimeItem";
import { queryItemsFx } from "./queryItemsFx";

export namespace queryUniverseFx {
	export interface Props {
		query: QueryUniverseSchema.Type;
	}
}

/** Selects matching items from every board space plus the shared inventory. */
export const queryUniverseFx = Effect.fn("queryUniverseFx")(function* ({
	query,
}: queryUniverseFx.Props) {
	const items = yield* getItemsFx();

	return yield* queryItemsFx({
		items: items.filter(isGridRuntimeItem),
		selector: query.selector,
	});
});
