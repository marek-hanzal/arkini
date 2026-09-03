import { z } from "zod";

import { ItemEstimateViewSchema } from "~/estimate/schema/ItemEstimateViewSchema";

export const EstimateInputSchema = z
	.object({
		page: z.number().int().min(1).default(1).describe("One-based page number."),
		limit: z
			.number()
			.int()
			.min(1)
			.max(100)
			.default(25)
			.describe("Maximum estimate rows per page; defaults to 25 and is capped at 100."),
		query: z
			.string()
			.optional()
			.describe("Optional fuzzy search across item title, ID, description, and type."),
		view: ItemEstimateViewSchema.default("fastest").describe(
			"Global Estimate view: fastest, slowest, highest aggregate demand, or incomplete items only.",
		),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:estimate-input",
		title: "Estimate tool input",
		description: "Pagination, search, and display mode for the global Estimate tool.",
	});

export type EstimateInput = z.output<typeof EstimateInputSchema>;
