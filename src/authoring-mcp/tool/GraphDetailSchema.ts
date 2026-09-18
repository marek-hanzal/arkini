import { z } from "zod";

export const GraphDetailSchema = z
	.enum([
		"summary",
		"full",
	])
	.meta({
		id: "mcp.GraphDetailSchema",
		description:
			"Summary retains every discovered operation or requirement; full includes dependency witnesses and diagnostics. Defaults to full.",
	});
export type GraphDetailSchema = typeof GraphDetailSchema;
export namespace GraphDetailSchema {
	export type Type = z.infer<GraphDetailSchema>;
}
