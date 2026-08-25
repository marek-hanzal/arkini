import { z } from "zod";

import { MetaSchema } from "~/engine/meta/schema/MetaSchema";
import { ResourceConfigSchema } from "~/engine/resource/schema/ResourceConfigSchema";
import { StartSchema } from "~/engine/start/schema/StartSchema";

export const EditorMcpEditProjectInputSchema = z
	.object({
		revision: z
			.number()
			.int()
			.nonnegative()
			.optional()
			.describe(
				"Optional optimistic concurrency guard copied from project_config. A stale revision rejects the edit; when omitted, the current snapshot is patched.",
			),
		patch: z
			.object({
				meta: MetaSchema.omit({
					id: true,
				})
					.optional()
					.describe(
						"Complete replacement metadata. The stable game ID cannot be changed.",
					),
				resources: ResourceConfigSchema.optional().describe(
					"Complete replacement of every named non-item resource role.",
				),
				start: StartSchema.optional().describe(
					"Complete replacement of the initial board, inventory, and toolbar state.",
				),
			})
			.strict(),
	})
	.strict()
	.refine(({ patch }) => Object.keys(patch).length > 0, {
		message: "Patch must replace at least one project section.",
		path: [
			"patch",
		],
	});

export type EditorMcpEditProjectInput = z.infer<typeof EditorMcpEditProjectInputSchema>;
