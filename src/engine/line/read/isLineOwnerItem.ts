import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

type LineOwnerItem = Extract<
	ItemSchema.Type,
	{
		readonly type:
			| typeof ItemEnumSchema.enum.Blueprint
			| typeof ItemEnumSchema.enum.Craft
			| typeof ItemEnumSchema.enum.Producer
			| typeof ItemEnumSchema.enum.Stash;
	}
>;

/** Identifies canonical items that expose the shared product-line contract. */
export const isLineOwnerItem = (item: ItemSchema.Type): item is LineOwnerItem =>
	item.type === ItemEnumSchema.enum.Producer ||
	item.type === ItemEnumSchema.enum.Blueprint ||
	item.type === ItemEnumSchema.enum.Craft ||
	item.type === ItemEnumSchema.enum.Stash;
