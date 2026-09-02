import { z } from "zod";

import { EditorMcpNgrokDomainSchema } from "./EditorMcpNgrokDomainSchema";
import { EditorMcpPortSchema } from "./EditorMcpPortSchema";
import { EditorMcpRemoteStatusSchema } from "./EditorMcpRemoteStatusSchema";
import { EditorMcpStatusSchema } from "./EditorMcpStatusSchema";

export const EditorMcpOverviewSchema = z
	.object({
		port: EditorMcpPortSchema,
		ngrokDomain: EditorMcpNgrokDomainSchema.optional(),
		remotePassword: z.string().min(1).max(256),
		local: EditorMcpStatusSchema,
		remote: EditorMcpRemoteStatusSchema,
	})
	.strict();

export type EditorMcpOverviewSchema = typeof EditorMcpOverviewSchema;

export namespace EditorMcpOverviewSchema {
	export type Type = z.infer<EditorMcpOverviewSchema>;
}
