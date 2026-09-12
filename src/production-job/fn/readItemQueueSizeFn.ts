import { Option } from "effect";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";

/** Reads accepted work capacity only when the item owns production lines. */
export const readItemQueueSizeFn = ({ item }: { readonly item: ItemSchema.Type }) => {
	const owner = Option.getOrUndefined(narrowLineOwnerItemFn(item));
	return owner === undefined ? undefined : owner.type === "blueprint" ? 1 : owner.maxQueueSize;
};
