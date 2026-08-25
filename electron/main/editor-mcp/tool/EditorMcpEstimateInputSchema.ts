import { z } from "zod";

import { EditorItemEstimateSortSchema } from "~/editor/EditorItemEstimateSortSchema";

export const EditorMcpEstimateInputSchema = z
	.object({
		incomplete: z
			.boolean()
			.default(false)
			.describe("Return only partial and unreachable item estimates."),
		page: z.number().int().min(1).default(1).describe("One-based page number."),
		pageSize: z
			.number()
			.int()
			.min(1)
			.max(100)
			.default(25)
			.describe("Estimate rows per page; defaults to 25 and is capped at 100."),
		query: z
			.string()
			.optional()
			.describe("Optional fuzzy search across item title, ID, description, and type."),
		sort: EditorItemEstimateSortSchema.default("fastest").describe(
			"Global Estimate ordering: fastest, slowest, or highest aggregate demand first.",
		),
	})
	.strict();

export type EditorMcpEstimateInput = z.output<typeof EditorMcpEstimateInputSchema>;
