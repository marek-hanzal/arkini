import { Array, Effect } from "effect";

import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { AnySchema } from "~/engine/query/schema/AnySchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isGridRuntimeItemFn } from "~/engine/runtime/read/fn/isGridRuntimeItemFn";
import { queryItemsFx } from "./queryItemsFx";

export namespace queryAnyFx {
	export interface Props {
		query: AnySchema.Type;
		space: NonNegativeIntegerSchema.Type;
	}
}

/** Selects both passive storage surfaces plus board items from the origin space. */
export const queryAnyFx = Effect.fn("queryAnyFx")(function* ({ query, space }: queryAnyFx.Props) {
	const items = yield* getItemsFx();
	const gridItems = Array.getSomes(items.map(isGridRuntimeItemFn));

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
