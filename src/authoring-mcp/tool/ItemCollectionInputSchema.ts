import { z } from "zod";

export const ItemCollectionInputSchema = z
	.object({
		page: z.number().int().min(1).default(1).describe("One-based page number."),
		limit: z
			.number()
			.int()
			.min(1)
			.max(100)
			.default(25)
			.describe("Maximum items per page; defaults to 25 and is capped at 100."),
		query: z
			.string()
			.optional()
			.describe("Optional fuzzy search across item title, ID, and description."),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:item-collection-input",
		title: "Item collection tool input",
		description: "Pagination, filtering, and search for the item collection tool.",
	});

export type ItemCollectionInput = z.output<typeof ItemCollectionInputSchema>;
