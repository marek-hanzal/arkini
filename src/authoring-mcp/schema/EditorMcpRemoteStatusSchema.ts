import { z } from "zod";

export const EditorMcpRemoteStatusSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("inactive"),
		})
		.strict(),
	z
		.object({
			type: z.literal("starting"),
		})
		.strict(),
	z
		.object({
			type: z.literal("ready"),
			url: z.url(),
		})
		.strict(),
	z
		.object({
			type: z.literal("unavailable"),
			message: z.string().min(1),
		})
		.strict(),
]);

export type EditorMcpRemoteStatusSchema = typeof EditorMcpRemoteStatusSchema;

export namespace EditorMcpRemoteStatusSchema {
	export type Type = z.infer<EditorMcpRemoteStatusSchema>;
}
