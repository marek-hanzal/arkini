import { z } from "zod";

import { EditorMcpPortSchema } from "./EditorMcpPortSchema";

export const EditorMcpStatusSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("inactive"),
		})
		.strict(),
	z
		.object({
			type: z.literal("ready"),
			port: EditorMcpPortSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("unavailable"),
			message: z.string().min(1),
		})
		.strict(),
]);

export type EditorMcpStatus = z.infer<typeof EditorMcpStatusSchema>;
