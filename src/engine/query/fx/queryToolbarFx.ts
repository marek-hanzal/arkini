import { Array, Effect } from "effect";

import type { QueryToolbarSchema } from "~/engine/query/schema/QueryToolbarSchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { QueryScopeEnumSchema } from "~/engine/query/schema/QueryScopeEnumSchema";

import { queryItemsFx } from "./queryItemsFx";

export namespace queryToolbarFx {
	export interface Props {
		query: QueryToolbarSchema.Type;
	}
}

/** Selects toolbar items matching the configured selector. */
export const queryToolbarFx = Effect.fn("queryToolbarFx")(function* ({
	query,
}: queryToolbarFx.Props) {
	const items = yield* getItemsFx();
	const gridItems = Array.getSomes(yield* Effect.forEach(items, isGridRuntimeItemFx));

	return yield* queryItemsFx({
		items: gridItems.filter((item) => {
			return item.location.scope === QueryScopeEnumSchema.enum.Toolbar;
		}),
		selector: query.selector,
	});
});
