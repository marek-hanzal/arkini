import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";
import { matchesItemSelectorFn } from "./matchesItemSelectorFn";

export namespace selectItemsFn {
	export interface Props {
		items: ReadonlyArray<ItemSchema.Type>;
		selector: SelectorSchema.Type;
	}
}

/** Selects canonical items through the one exhaustive selector grammar. */
export const selectItemsFn = ({ items, selector }: selectItemsFn.Props) => {
	const matches: ItemSchema.Type[] = [];
	for (const item of items) {
		if (
			matchesItemSelectorFn({
				item,
				selector,
			})
		) {
			matches.push(item);
		}
	}
	return matches;
};
