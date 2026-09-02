import { z } from "zod";

import { TypeSchema } from "~/item-definition/schema/TypeSchema";

const ItemTypeSchema = z.enum(TypeSchema.options).meta({
	id: "ItemTypeSchema",
	description:
		"A canonical Arkini item type: deposit, blueprint, simple, space, producer, craft, stash, temporary, or inventory.",
});

export const ItemCollectionInputSchema = z
	.object({
		itemTypes: ItemTypeSchema.array()
			.min(1)
			.optional()
			.describe(
				"Optional item types combined with OR; the fuzzy query is applied within this filtered set.",
			),
		page: z.number().int().min(1).default(1).describe("One-based page number."),
		pageSize: z
			.number()
			.int()
			.min(1)
			.max(100)
			.default(25)
			.describe("Items per page; defaults to 25 and is capped at 100."),
		query: z
			.string()
			.optional()
			.describe("Optional fuzzy search across item title, ID, description, and type."),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:item-collection-input",
		title: "Item collection tool input",
		description: "Pagination, filtering, and search for the item collection tool.",
	});

export type ItemCollectionInput = z.output<typeof ItemCollectionInputSchema>;
