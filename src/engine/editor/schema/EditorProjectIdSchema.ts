import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

/** One stable URL- and IndexedDB-safe editor project identity. */
export const EditorProjectIdSchema = IdSchema.regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/)
	.refine((value) => value !== "." && value !== ".." && !value.endsWith("."))
	.meta({
		id: "EditorProjectIdSchema",
		description: "A stable URL- and IndexedDB-safe editor project identity.",
	});

export type EditorProjectIdSchema = typeof EditorProjectIdSchema;

export namespace EditorProjectIdSchema {
	export type Type = z.infer<EditorProjectIdSchema>;
}
