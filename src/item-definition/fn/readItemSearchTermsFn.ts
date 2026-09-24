import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

/** Shared item search corpus for catalogs, item pickers and MCP. */
export const readItemSearchTermsFn = (item: ItemSchema.Type) => ({
	terms: [
		item.title,
	],
	identityTerms: [
		item.uid,
	],
	descriptionTerms:
		item.description === undefined
			? []
			: [
					item.description,
				],
	keywordTerms:
		item.keywords === undefined
			? []
			: [
					item.keywords,
				],
});
