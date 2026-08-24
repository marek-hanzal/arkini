import { z } from "zod";

import { EditorBoardScenarioSchema } from "~/editor/board/EditorBoardScenarioSchema";

/** Decodes one physical SQLite Board-scenario row and detaches its mutable BLOB bytes. */
export const SqliteEditorBoardScenarioRowSchema = z
	.object({
		project_id: z.string(),
		name: z.string(),
		project_revision: z.number(),
		arkpack_version: z.string(),
		save_bytes: z.instanceof(Uint8Array),
		created_at_ms: z.number(),
		updated_at_ms: z.number(),
	})
	.strict()
	.transform((row) => ({
		projectId: row.project_id,
		name: row.name,
		projectRevision: row.project_revision,
		version: row.arkpack_version,
		bytes: Uint8Array.from(row.save_bytes),
		createdAtMs: row.created_at_ms,
		updatedAtMs: row.updated_at_ms,
	}))
	.pipe(EditorBoardScenarioSchema)
	.meta({
		id: "SqliteEditorBoardScenarioRowSchema",
		description: "One physical SQLite row decoded into a canonical Board scenario.",
	});

export type SqliteEditorBoardScenarioRowSchema = typeof SqliteEditorBoardScenarioRowSchema;

export namespace SqliteEditorBoardScenarioRowSchema {
	export type Type = z.infer<SqliteEditorBoardScenarioRowSchema>;
}
