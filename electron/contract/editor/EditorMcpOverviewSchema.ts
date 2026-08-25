import { z } from "zod";

import { EditorMcpPortSchema } from "./EditorMcpPortSchema";
import { EditorMcpRemoteStatusSchema } from "./EditorMcpRemoteStatusSchema";
import { EditorMcpStatusSchema } from "./EditorMcpStatusSchema";

export const EditorMcpOverviewSchema = z
	.object({
		port: EditorMcpPortSchema,
		ngrokConfigured: z.boolean(),
		ngrokDomain: z.string().min(1).optional(),
		authConfigured: z.boolean(),
		local: EditorMcpStatusSchema,
		remote: EditorMcpRemoteStatusSchema,
	})
	.strict();

export type EditorMcpOverviewSchema = typeof EditorMcpOverviewSchema;

export namespace EditorMcpOverviewSchema {
	export type Type = z.infer<EditorMcpOverviewSchema>;
}
