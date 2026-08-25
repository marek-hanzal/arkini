import { z } from "zod";

import { EditorMcpPortSchema } from "./EditorMcpPortSchema";

export const EditorMcpConfigurationSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("port"),
			port: EditorMcpPortSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("ngrok-authtoken"),
			authtoken: z.string().trim().min(1).max(2_048),
		})
		.strict(),
]);

export type EditorMcpConfigurationSchema = typeof EditorMcpConfigurationSchema;

export namespace EditorMcpConfigurationSchema {
	export type Type = z.infer<EditorMcpConfigurationSchema>;
}
