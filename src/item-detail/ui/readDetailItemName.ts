import type { ItemCatalogView } from "~/item/view/ItemCatalogViewSchema";

export const readDetailItemName = ({ itemId, items }: { itemId: string; items: ItemCatalogView }) =>
	items[itemId]?.name ?? itemId;
