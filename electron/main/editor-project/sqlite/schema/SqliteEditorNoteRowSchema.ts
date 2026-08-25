import { z } from "zod";

import { EditorNoteSchema } from "~/editor/note/EditorNoteSchema";

/** Decodes one physical SQLite row into a canonical project note. */
export const SqliteEditorNoteRowSchema = z
	.object({
		note_id: z.string(),
		project_id: z.string(),
		content: z.string(),
		created_at_ms: z.number(),
		updated_at_ms: z.number(),
	})
	.strict()
	.transform((row) => ({
		noteId: row.note_id,
		projectId: row.project_id,
		content: row.content,
		createdAtMs: row.created_at_ms,
		updatedAtMs: row.updated_at_ms,
	}))
	.pipe(EditorNoteSchema)
	.meta({
		id: "SqliteEditorNoteRowSchema",
		description: "One SQLite row decoded into a canonical editor project note.",
	});

export type SqliteEditorNoteRowSchema = typeof SqliteEditorNoteRowSchema;

export namespace SqliteEditorNoteRowSchema {
	export type Type = z.infer<SqliteEditorNoteRowSchema>;
}
