import { Array, Effect } from "effect";

import type { UniverseSchema } from "~/engine/query/schema/UniverseSchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { queryItemsFx } from "./queryItemsFx";

export namespace queryUniverseFx {
	export interface Props {
		query: UniverseSchema.Type;
	}
}

/** Selects matching items from every board space plus both passive storage surfaces. */
export const queryUniverseFx = Effect.fn("queryUniverseFx")(function* ({
	query,
}: queryUniverseFx.Props) {
	const items = yield* getItemsFx();
	const gridItems = Array.getSomes(yield* Effect.forEach(items, isGridRuntimeItemFx));

	return yield* queryItemsFx({
		items: gridItems,
		selector: query.selector,
	});
});
