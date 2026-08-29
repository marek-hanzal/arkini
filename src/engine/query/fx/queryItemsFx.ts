import { Effect } from "effect";

import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { selectItemsFn } from "~/engine/selector/fn/selectItemsFn";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";

export namespace queryItemsFx {
	export interface Props {
		items: ReadonlyArray<RuntimeItemSchema.Type>;
		selector: SelectorSchema.Type;
	}
}

/** Selects matching runtime items from one already scoped collection. */
export const queryItemsFx = Effect.fn("queryItemsFx")(function* ({
	items,
	selector,
}: queryItemsFx.Props) {
	const selected = selectItemsFn({
		items: items.map((item) => item.item),
		selector,
	});
	const selectedItemIds = new Set(selected.map((item) => item.id));

	return items.filter((item) => selectedItemIds.has(item.item.id));
});
