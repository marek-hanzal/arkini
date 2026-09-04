import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { NoteContentSchema } from "~/project-note/schema/NoteSchema";

/** Portable note body whose project identity is owned by its containing directory. */
export const NoteFileSchema = z
	.object({
		content: NoteContentSchema,
		createdAtMs: NonNegativeIntegerSchema,
		updatedAtMs: NonNegativeIntegerSchema,
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

export type NoteFileSchema = typeof NoteFileSchema;

export namespace NoteFileSchema {
	export type Type = z.infer<NoteFileSchema>;
}
