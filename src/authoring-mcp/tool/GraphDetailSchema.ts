import { z } from "zod";

export const GraphDetailSchema = z
	.enum([
		"summary",
		"full",
	])
	.meta({
		id: "mcp.GraphDetailSchema",
		description:
			"Summary retains typed relationships and operation identities; full includes authored operation configuration and context. Defaults to full.",
	});
export type GraphDetailSchema = typeof GraphDetailSchema;
export namespace GraphDetailSchema {
	export type Type = z.infer<GraphDetailSchema>;
}
