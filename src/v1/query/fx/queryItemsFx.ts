import { Effect } from "effect";

import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import { selectorFx } from "~/v1/selector/fx/selectorFx";
import type { SelectorSchema } from "~/v1/selector/schema/SelectorSchema";

export namespace queryItemsFx {
	export interface Props {
		items: ReadonlyArray<RuntimeItemSchema.Type>;
		selector: SelectorSchema.Type;
	}
}

/**
 * Selects matching runtime items from one already scoped collection.
 */
export const queryItemsFx = Effect.fn("queryItemsFx")(function* ({
	items,
	selector,
}: queryItemsFx.Props) {
	return yield* Effect.filter(items, (item) => {
		return selectorFx({
			item: item.item,
			selector,
		});
	});
});
