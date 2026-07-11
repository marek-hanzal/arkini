import { Effect } from "effect";

import type { QueryInventorySchema } from "~/v1/query/schema/QueryInventorySchema";
import { getItemsFx } from "~/v1/runtime/read/getItemsFx";
import { isGridRuntimeItem } from "~/v1/runtime/read/isGridRuntimeItem";
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

	return yield* queryItemsFx({
		items: items.filter(isGridRuntimeItem).filter((item) => {
			return item.location.scope === "inventory";
		}),
		selector: query.selector,
	});
});
