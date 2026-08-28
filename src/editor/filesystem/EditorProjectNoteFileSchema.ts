import { z } from "zod";

import { EditorNoteContentSchema } from "~/editor/note/EditorNoteSchema";

/** Portable note body whose project identity is owned by its containing directory. */
export const EditorProjectNoteFileSchema = z
	.object({
		content: EditorNoteContentSchema,
		createdAtMs: z.number().int().nonnegative(),
		updatedAtMs: z.number().int().nonnegative(),
	})
	.strict()
	.refine(({ createdAtMs, updatedAtMs }) => updatedAtMs >= createdAtMs, {
		message: "updatedAtMs must not precede createdAtMs.",
		path: [
			"updatedAtMs",
		],
	})
	.meta({
		id: "EditorProjectNoteFileSchema",
		description: "One note body stored below its ID-owned notes/<noteId>.json path.",
	});

export type EditorProjectNoteFileSchema = typeof EditorProjectNoteFileSchema;

export namespace EditorProjectNoteFileSchema {
	export type Type = z.infer<EditorProjectNoteFileSchema>;
}
