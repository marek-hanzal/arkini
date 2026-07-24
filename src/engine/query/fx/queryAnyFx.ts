import { Array, Effect } from "effect";

import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { QueryAnySchema } from "~/engine/query/schema/QueryAnySchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { queryItemsFx } from "./queryItemsFx";

export namespace queryAnyFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		query: QueryAnySchema.Type;
	}
}

/** Selects both passive storage surfaces plus board items from the origin space. */
export const queryAnyFx = Effect.fn("queryAnyFx")(function* ({ origin, query }: queryAnyFx.Props) {
	const items = yield* getItemsFx();
	const gridItems = Array.getSomes(yield* Effect.forEach(items, isGridRuntimeItemFx));

	return yield* queryItemsFx({
		items: gridItems.filter((item) => {
			return (
				item.location.scope !== LocationScopeEnumSchema.enum.Board ||
				item.location.space === origin.space
			);
		}),
		selector: query.selector,
	});
});
