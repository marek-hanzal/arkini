import { Effect } from "effect";
import { match } from "ts-pattern";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";

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
	const matchesSelector = (item: ItemSchema.Type) => {
		return match(selector)
			.with(
				{
					type: "item",
				},
				({ itemId }) => itemId === item.id,
			)
			.with(
				{
					type: "tag",
				},
				({ tag }) => item.tags.includes(tag),
			)
			.exhaustive();
	};

	return items.filter(matchesSelector);
});
