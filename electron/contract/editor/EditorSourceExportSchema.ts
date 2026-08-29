import { z } from "zod";

/** Serializable result of one completed Editor JSON source export. */
export const EditorSourceExportSchema = z
	.object({
		json: z.number().int().positive(),
		resources: z.number().int().nonnegative(),
		revision: z.number().int().nonnegative(),
		root: z.string().min(1),
	})
	.strict();

export type EditorSourceExportSchema = typeof EditorSourceExportSchema;

export namespace EditorSourceExportSchema {
	export type Type = z.infer<EditorSourceExportSchema>;
}
