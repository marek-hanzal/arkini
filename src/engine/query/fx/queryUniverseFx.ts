import { Array, Effect } from "effect";

import type { UniverseSchema } from "~/engine/query/schema/UniverseSchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isGridRuntimeItemFn } from "~/engine/runtime/read/fn/isGridRuntimeItemFn";
import { queryItemsFx } from "./queryItemsFx";

export namespace queryUniverseFx {
	export interface Props {
		query: UniverseSchema.Type;
	}
}

/** Selects matching items from every board space plus both passive storage surfaces. */
export const queryUniverseFx = Effect.fn("queryUniverseFx")(function* ({
	query,
}: queryUniverseFx.Props) {
	const items = yield* getItemsFx();
	const gridItems = Array.getSomes(items.map(isGridRuntimeItemFn));

	return yield* queryItemsFx({
		items: gridItems,
		selector: query.selector,
	});
});
