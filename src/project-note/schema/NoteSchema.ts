import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";

export const NoteContentMaxLength = 20_000;

export const NoteContentSchema = z.string().trim().min(1).max(NoteContentMaxLength).meta({
	id: "NoteContentSchema",
	description: "One non-empty project note written as Markdown.",
});

export const NoteSchema = z
	.object({
		noteId: IdSchema,
		projectId: IdSchema,
		content: NoteContentSchema,
		itemUids: IdSchema.array().refine((uids) => new Set(uids).size === uids.length, {
			message: "Each linked item UID must be unique.",
		}),
		resourceIds: IdSchema.array().refine((ids) => new Set(ids).size === ids.length, {
			message: "Each linked resource ID must be unique.",
		}),
		createdAtMs: NonNegativeIntegerSchema,
		updatedAtMs: NonNegativeIntegerSchema,
	})
	.strict();

export type NoteSchema = typeof NoteSchema;

export namespace NoteSchema {
	export type Type = z.infer<NoteSchema>;
}
