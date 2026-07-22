import { Effect } from "effect";

import type { QueryToolbarSchema } from "~/engine/query/schema/QueryToolbarSchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
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

	return yield* queryItemsFx({
		items: items.filter(isGridRuntimeItem).filter((item) => {
			return item.location.scope === QueryScopeEnumSchema.enum.Toolbar;
		}),
		selector: query.selector,
	});
});
