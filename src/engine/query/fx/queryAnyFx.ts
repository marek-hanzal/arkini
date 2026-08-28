import { Array, Effect } from "effect";

import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { QueryAnySchema } from "~/engine/query/schema/QueryAnySchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { queryItemsFx } from "./queryItemsFx";

export namespace queryAnyFx {
	export interface Props {
		query: QueryAnySchema.Type;
		space: NonNegativeIntegerSchema.Type;
	}
}

/** Selects both passive storage surfaces plus board items from the origin space. */
export const queryAnyFx = Effect.fn("queryAnyFx")(function* ({ query, space }: queryAnyFx.Props) {
	const items = yield* getItemsFx();
	const gridItems = Array.getSomes(yield* Effect.forEach(items, isGridRuntimeItemFx));

	return yield* queryItemsFx({
		items: gridItems.filter((item) => {
			return (
				item.location.scope !== LocationScopeEnumSchema.enum.Board ||
				item.location.space === space
			);
		}),
		selector: query.selector,
	});
});
