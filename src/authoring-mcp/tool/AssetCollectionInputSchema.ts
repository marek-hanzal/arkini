import { z } from "zod";

import { AssetCollectionFilterSchema } from "~/asset-authoring/schema/AssetCollectionFilterSchema";

const AssetTypeSchema = z
	.enum([
		"image",
	])
	.meta({
		id: "AssetTypeSchema",
		description: "A canonical Arkini asset type. Only images are currently supported.",
	});

export const AssetCollectionInputSchema = z
	.object({
		filter: AssetCollectionFilterSchema.default("all").describe(
			"The Editor Asset library usage filter; defaults to all assets.",
		),
		page: z.number().int().min(1).default(1).describe("One-based page number."),
		limit: z
			.number()
			.int()
			.min(1)
			.max(100)
			.default(25)
			.describe("Maximum assets per page; defaults to 25 and is capped at 100."),
		query: z.string().optional().describe("Optional fuzzy search across asset ID and type."),
		type: AssetTypeSchema.describe("The asset type to list."),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:asset-collection-input",
		title: "Asset collection tool input",
		description: "Pagination, usage filtering, type filtering, and search for assets.",
	});

export type AssetCollectionInput = z.output<typeof AssetCollectionInputSchema>;
