import { z } from "zod";

import { ArtworkCollectionFilterSchema } from "~/artwork-authoring/schema/ArtworkCollectionFilterSchema";

export const ArtworkCollectionInputSchema = z
	.object({
		filter: ArtworkCollectionFilterSchema.default("all").describe(
			"The Editor Artwork library usage filter; defaults to all artwork.",
		),
		page: z.number().int().min(1).default(1).describe("One-based page number."),
		limit: z
			.number()
			.int()
			.min(1)
			.max(100)
			.default(25)
			.describe("Maximum artwork per page; defaults to 25 and is capped at 100."),
		query: z.string().optional().describe("Optional fuzzy search across artwork IDs."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:artwork-collection-input",
		title: "Artwork collection tool input",
		description: "Pagination, usage filtering, and search for Artwork resources.",
	});

export type ArtworkCollectionInput = z.output<typeof ArtworkCollectionInputSchema>;
