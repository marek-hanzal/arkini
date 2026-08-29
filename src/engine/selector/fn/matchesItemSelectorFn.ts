import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";

/** Tests one canonical item against the exhaustive selector grammar. */
export const matchesItemSelectorFn = ({
	item,
	selector,
}: {
	readonly item: ItemSchema.Type;
	readonly selector: SelectorSchema.Type;
}) => selector.itemId === item.id;
