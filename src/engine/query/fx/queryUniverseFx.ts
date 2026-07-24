import { Array, Effect } from "effect";

import type { QueryUniverseSchema } from "~/engine/query/schema/QueryUniverseSchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { queryItemsFx } from "./queryItemsFx";

export namespace queryUniverseFx {
	export interface Props {
		query: QueryUniverseSchema.Type;
	}
}

/** Selects matching items from every board space plus both passive storage surfaces. */
export const queryUniverseFx = Effect.fn("queryUniverseFx")(function* ({
	query,
}: queryUniverseFx.Props) {
	const items = yield* getItemsFx();
	const gridItems = Array.getSomes(yield* Effect.forEach(items, isGridRuntimeItemFx));

	return yield* queryItemsFx({
		items: gridItems,
		selector: query.selector,
	});
});
