import { z } from "zod";

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
		page: z.number().int().min(1).default(1).describe("One-based page number."),
		pageSize: z
			.number()
			.int()
			.min(1)
			.max(100)
			.default(25)
			.describe("Assets per page; defaults to 25 and is capped at 100."),
		query: z.string().optional().describe("Optional fuzzy search across asset ID and type."),
		type: AssetTypeSchema.describe("The asset type to list."),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:asset-collection-input",
		title: "Asset collection tool input",
		description: "Pagination, type filtering, and search for the asset collection tool.",
	});

export type AssetCollectionInput = z.output<typeof AssetCollectionInputSchema>;
