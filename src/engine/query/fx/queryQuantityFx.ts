import { Effect } from "effect";

import type { QueryResultSchema } from "~/engine/query/schema/QueryResultSchema";

export namespace queryQuantityFx {
	export interface Props {
		items: QueryResultSchema.Type;
	}
}

/**
 * Aggregates the total quantity represented by runtime query results.
 */
export const queryQuantityFx = Effect.fn("queryQuantityFx")(function* ({
	items,
}: queryQuantityFx.Props) {
	return items.reduce((quantity, item) => {
		return quantity + item.quantity;
	}, 0);
});
