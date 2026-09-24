import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

/** Shared item search corpus for catalogs, item pickers and MCP. */
export const readItemSearchTermsFn = (item: ItemSchema.Type): readonly string[] => [
	item.uid,
	item.title,
	item.description ?? "",
	item.keywords ?? "",
];
