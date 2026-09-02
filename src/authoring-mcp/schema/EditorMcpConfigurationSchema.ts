import { z } from "zod";

import { EditorMcpNgrokDomainSchema } from "./EditorMcpNgrokDomainSchema";
import { EditorMcpPortSchema } from "./EditorMcpPortSchema";

export const EditorMcpNgrokSettingsSchema = z
	.object({
		authtoken: z.string().trim().min(1).max(2_048),
		domain: EditorMcpNgrokDomainSchema,
	})
	.strict();

export namespace EditorMcpNgrokSettingsSchema {
	export type Type = z.infer<typeof EditorMcpNgrokSettingsSchema>;
}

export const EditorMcpConfigurationSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("port"),
			port: EditorMcpPortSchema,
		})
		.strict(),
	EditorMcpNgrokSettingsSchema.extend({
		type: z.literal("ngrok"),
	}).strict(),
]);

export type EditorMcpConfigurationSchema = typeof EditorMcpConfigurationSchema;

export namespace EditorMcpConfigurationSchema {
	export type Type = z.infer<EditorMcpConfigurationSchema>;
}
