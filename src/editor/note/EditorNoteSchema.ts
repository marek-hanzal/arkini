import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

export const EditorNoteContentMaxLength = 20_000;

export const EditorNoteContentSchema = z.string().trim().min(1).max(EditorNoteContentMaxLength);

export const EditorNoteSchema = z
	.object({
		noteId: IdSchema,
		projectId: IdSchema,
		content: EditorNoteContentSchema,
		createdAtMs: z.number().int().nonnegative(),
		updatedAtMs: z.number().int().nonnegative(),
	})
	.strict();

export type EditorNoteSchema = typeof EditorNoteSchema;

export namespace EditorNoteSchema {
	export type Type = z.infer<EditorNoteSchema>;
}
