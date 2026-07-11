import { Effect } from "effect";

import type { QueryAnySchema } from "~/v1/query/schema/QueryAnySchema";
import { getItemsFx } from "~/v1/runtime/read/getItemsFx";
import { isGridRuntimeItem } from "~/v1/runtime/read/isGridRuntimeItem";
import { queryItemsFx } from "./queryItemsFx";

export namespace queryAnyFx {
	export interface Props {
		query: QueryAnySchema.Type;
	}
}

/**
 * Selects matching items across every runtime location without a distance rule.
 */
export const queryAnyFx = Effect.fn("queryAnyFx")(function* ({ query }: queryAnyFx.Props) {
	const items = yield* getItemsFx();

	return yield* queryItemsFx({
		items: items.filter(isGridRuntimeItem),
		selector: query.selector,
	});
});
