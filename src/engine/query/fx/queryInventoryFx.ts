import { Array, Effect } from "effect";

import type { QueryInventorySchema } from "~/engine/query/schema/QueryInventorySchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { QueryScopeEnumSchema } from "~/engine/query/schema/QueryScopeEnumSchema";

import { queryItemsFx } from "./queryItemsFx";

export namespace queryInventoryFx {
	export interface Props {
		query: QueryInventorySchema.Type;
	}
}

/**
 * Selects inventory items matching the configured selector.
 */
export const queryInventoryFx = Effect.fn("queryInventoryFx")(function* ({
	query,
}: queryInventoryFx.Props) {
	const items = yield* getItemsFx();
	const gridItems = Array.getSomes(yield* Effect.forEach(items, isGridRuntimeItemFx));

	return yield* queryItemsFx({
		items: gridItems.filter((item) => {
			return item.location.scope === QueryScopeEnumSchema.enum.Inventory;
		}),
		selector: query.selector,
	});
});
