import { z } from "zod";

import { EditorBoardScenarioDescriptorSchema } from "~/editor/board/EditorBoardScenarioSchema";

/** Decodes one physical SQLite Board-scenario descriptor row. */
export const SqliteEditorBoardScenarioDescriptorRowSchema = z
	.object({
		project_id: z.string(),
		name: z.string(),
		project_revision: z.number(),
		arkpack_version: z.string(),
		created_at_ms: z.number(),
		updated_at_ms: z.number(),
	})
	.strict()
	.transform((row) => ({
		projectId: row.project_id,
		name: row.name,
		projectRevision: row.project_revision,
		version: row.arkpack_version,
		createdAtMs: row.created_at_ms,
		updatedAtMs: row.updated_at_ms,
	}))
	.pipe(EditorBoardScenarioDescriptorSchema)
	.meta({
		id: "SqliteEditorBoardScenarioDescriptorRowSchema",
		description: "One SQLite row decoded into canonical Board scenario metadata.",
	});

export type SqliteEditorBoardScenarioDescriptorRowSchema =
	typeof SqliteEditorBoardScenarioDescriptorRowSchema;

export namespace SqliteEditorBoardScenarioDescriptorRowSchema {
	export type Type = z.infer<SqliteEditorBoardScenarioDescriptorRowSchema>;
}
