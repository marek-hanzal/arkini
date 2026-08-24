import { z } from "zod";

import { EditorProjectRecordSchema } from "~/editor/EditorProjectRecordSchema";

/** Decodes one physical SQLite project row into the canonical editor record. */
export const SqliteEditorProjectRowSchema = z
	.object({
		project_id: z.string(),
		config_json: z.string(),
		arkpack_version: z.string(),
		revision: z.number(),
		created_at_ms: z.number(),
		updated_at_ms: z.number(),
	})
	.strict()
	.transform((row) => ({
		projectId: row.project_id,
		config: JSON.parse(row.config_json) as unknown,
		version: row.arkpack_version,
		revision: row.revision,
		createdAtMs: row.created_at_ms,
		updatedAtMs: row.updated_at_ms,
	}))
	.pipe(EditorProjectRecordSchema)
	.meta({
		id: "SqliteEditorProjectRowSchema",
		description: "One physical SQLite row decoded into a canonical editor project record.",
	});

export type SqliteEditorProjectRowSchema = typeof SqliteEditorProjectRowSchema;

export namespace SqliteEditorProjectRowSchema {
	export type Type = z.infer<SqliteEditorProjectRowSchema>;
}
