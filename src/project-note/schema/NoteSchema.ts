import { z } from "zod";

import { IdSchema } from "~/game-config/schema/IdSchema";

export const NoteContentMaxLength = 20_000;

export const NoteContentSchema = z.string().trim().min(1).max(NoteContentMaxLength);

export const NoteSchema = z
	.object({
		noteId: IdSchema,
		projectId: IdSchema,
		content: NoteContentSchema,
		createdAtMs: z.number().int().nonnegative(),
		updatedAtMs: z.number().int().nonnegative(),
	})
	.strict();

export type NoteSchema = typeof NoteSchema;

export namespace NoteSchema {
	export type Type = z.infer<NoteSchema>;
}
