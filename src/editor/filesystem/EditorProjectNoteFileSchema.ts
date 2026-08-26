import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { EditorNoteContentSchema } from "~/editor/note/EditorNoteSchema";

/** Portable note body whose project identity is owned by its containing directory. */
export const EditorProjectNoteFileSchema = z
	.object({
		noteId: IdSchema,
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
		description: "One notes/<noteId>.json file in a portable Editor project.",
	});

export type EditorProjectNoteFileSchema = typeof EditorProjectNoteFileSchema;

export namespace EditorProjectNoteFileSchema {
	export type Type = z.infer<EditorProjectNoteFileSchema>;
}
