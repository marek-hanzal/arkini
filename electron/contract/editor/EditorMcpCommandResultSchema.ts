import { z } from "zod";

import { EditorMcpOverviewSchema } from "./EditorMcpOverviewSchema";

export const EditorMcpCommandResultSchema = z
	.object({
		overview: EditorMcpOverviewSchema,
		secret: z.string().min(1).max(256).optional(),
	})
	.strict();

export type EditorMcpCommandResultSchema = typeof EditorMcpCommandResultSchema;

export namespace EditorMcpCommandResultSchema {
	export type Type = z.infer<EditorMcpCommandResultSchema>;
}
