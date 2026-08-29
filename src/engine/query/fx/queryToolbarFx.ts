import { Array, Effect } from "effect";

import type { ToolbarSchema } from "~/engine/query/schema/ToolbarSchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isGridRuntimeItemFn } from "~/engine/runtime/read/fn/isGridRuntimeItemFn";
import { ScopeSchema } from "~/engine/query/schema/ScopeSchema";

import { queryItemsFx } from "./queryItemsFx";

export namespace queryToolbarFx {
	export interface Props {
		query: ToolbarSchema.Type;
	}
}

/** Selects toolbar items matching the configured selector. */
export const queryToolbarFx = Effect.fn("queryToolbarFx")(function* ({
	query,
}: queryToolbarFx.Props) {
	const items = yield* getItemsFx();
	const gridItems = Array.getSomes(items.map(isGridRuntimeItemFn));

	return yield* queryItemsFx({
		items: gridItems.filter((item) => {
			return item.location.scope === ScopeSchema.enum.Toolbar;
		}),
		selector: query.selector,
	});
});
