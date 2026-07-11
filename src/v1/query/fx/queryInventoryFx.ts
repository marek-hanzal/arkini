import { Effect, Ref } from "effect";

import type { QueryInventorySchema } from "~/v1/query/schema/QueryInventorySchema";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
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
	const runtimeRef = yield* RuntimeFx;
	const runtime = yield* Ref.get(runtimeRef);

	return yield* queryItemsFx({
		items: runtime.items.filter((item) => {
			return item.location.scope === "inventory";
		}),
		selector: query.selector,
	});
});
