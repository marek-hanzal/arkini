import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";

export const readDetailItemName = ({ itemId, items }: { itemId: string; items: ItemCatalogView }) =>
	items[itemId]?.name ??
	itemId
		.replace(/^item:/, "")
		.replace(/^producer:/, "")
		.replaceAll("-", " ");
