import { z } from "zod";

/** Keeps structurally large authoring payloads out of the MCP tool catalog. */
export const JsonToolInputSchema = z
	.object({
		input: z
			.string()
			.min(1)
			.describe(
				"A JSON object serialized as text. Read the tool description for its exact schema ID, then resolve that schema and every referenced schema through schema_detail.",
			),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:json-tool-input",
		title: "JSON authoring tool input",
		description:
			"One serialized JSON object whose exact schema is named by the authoring tool.",
	});

export type JsonToolInputSchema = typeof JsonToolInputSchema;

export namespace JsonToolInputSchema {
	export type Type = z.infer<JsonToolInputSchema>;
}
