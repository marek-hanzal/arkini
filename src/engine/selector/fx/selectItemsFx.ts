import { Effect } from "effect";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";
import { matchesItemSelectorFx } from "./matchesItemSelectorFx";

export namespace selectItemsFx {
	export interface Props {
		items: ReadonlyArray<ItemSchema.Type>;
		selector: SelectorSchema.Type;
	}
}

/** Selects canonical items through the one exhaustive selector grammar. */
export const selectItemsFx = Effect.fn("selectItemsFx")(function* ({
	items,
	selector,
}: selectItemsFx.Props) {
	const matches: ItemSchema.Type[] = [];
	for (const item of items) {
		if (
			yield* matchesItemSelectorFx({
				item,
				selector,
			})
		) {
			matches.push(item);
		}
	}
	return matches;
});
