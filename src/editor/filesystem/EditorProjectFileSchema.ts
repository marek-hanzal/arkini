import { z } from "zod";

import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

export const EditorProjectFormat = "arkini-editor";
export const EditorProjectFormatVersion = 1;

/** Root marker required before a directory can be opened as an Editor project. */
export const EditorProjectFileSchema = z
	.object({
		format: z.literal(EditorProjectFormat),
		formatVersion: z.literal(EditorProjectFormatVersion),
		arkpackVersion: ArkpackVersionSchema,
		updatedAtMs: z.number().int().nonnegative(),
	})
	.strict()
	.meta({
		id: "EditorProjectFileSchema",
		description: "The minimal root marker for one portable Editor project directory.",
	});

export type EditorProjectFileSchema = typeof EditorProjectFileSchema;

export namespace EditorProjectFileSchema {
	export type Type = z.infer<EditorProjectFileSchema>;
}
