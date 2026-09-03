import { z } from "zod";

import { MetaSchema } from "~/game-config/schema/MetaSchema";
import { RolesSchema } from "~/game-config/schema/RolesSchema";
import { StartSchema } from "~/game-start/schema/StartSchema";

export const EditProjectInputSchemaId = "urn:arkini:schema:mcp:edit-project-input";

export const EditProjectInputSchema = z
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
				resources: RolesSchema.optional().describe(
					"Complete replacement of every named non-item resource role.",
				),
				start: StartSchema.optional().describe(
					"Complete replacement of the initial board, inventory, and toolbar state.",
				),
			})
			.strict()
			.meta({
				minProperties: 1,
				description: "At least one complete project section to replace.",
			}),
	})
	.strict()
	.refine(({ patch }) => Object.keys(patch).length > 0, {
		message: "Patch must replace at least one project section.",
		path: [
			"patch",
		],
	})
	.meta({
		id: EditProjectInputSchemaId,
		$id: EditProjectInputSchemaId,
		title: "Edit project tool input",
		description:
			"A revision-guarded replacement patch for the editable non-item project configuration.",
	});

export type EditProjectInput = z.infer<typeof EditProjectInputSchema>;
