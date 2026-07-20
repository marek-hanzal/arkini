import type { ItemSchema } from "~/engine/item/schema/ItemSchema";

type LineOwnerItem = Extract<
	ItemSchema.Type,
	{
		readonly type: "blueprint" | "craft" | "producer" | "stash";
	}
>;

/** Identifies canonical items that expose the shared product-line contract. */
export const isLineOwnerItem = (item: ItemSchema.Type): item is LineOwnerItem =>
	item.type === "producer" ||
	item.type === "blueprint" ||
	item.type === "craft" ||
	item.type === "stash";
