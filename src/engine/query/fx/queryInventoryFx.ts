import { Array, Effect } from "effect";

import type { InventorySchema } from "~/engine/query/schema/InventorySchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { ScopeSchema } from "~/engine/query/schema/ScopeSchema";

import { queryItemsFx } from "./queryItemsFx";

export namespace queryInventoryFx {
	export interface Props {
		query: InventorySchema.Type;
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
			return item.location.scope === ScopeSchema.enum.Inventory;
		}),
		selector: query.selector,
	});
});
