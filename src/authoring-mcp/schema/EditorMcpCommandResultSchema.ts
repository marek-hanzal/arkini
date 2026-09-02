import { z } from "zod";

import { EditorMcpOverviewSchema } from "./EditorMcpOverviewSchema";

export const EditorMcpCommandResultSchema = z
	.object({
		overview: EditorMcpOverviewSchema,
	})
	.strict();

export type EditorMcpCommandResultSchema = typeof EditorMcpCommandResultSchema;

export namespace EditorMcpCommandResultSchema {
	export type Type = z.infer<EditorMcpCommandResultSchema>;
}
