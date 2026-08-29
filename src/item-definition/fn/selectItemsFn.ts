import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";
import { matchesItemSelectorFn } from "./matchesItemSelectorFn";

interface Props {
	readonly items: ReadonlyArray<ItemSchema.Type>;
	readonly selector: SelectorSchema.Type;
}

/** Selects canonical items through the one exhaustive selector grammar. */
export const selectItemsFn = ({ items, selector }: Props) => {
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
