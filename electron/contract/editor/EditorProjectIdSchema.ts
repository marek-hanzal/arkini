import { z } from "zod";

export const EditorProjectIdSchema = z
	.string()
	.regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/)
	.refine((value) => value !== "." && value !== "..");

export type EditorProjectIdSchema = typeof EditorProjectIdSchema;

export namespace EditorProjectIdSchema {
	export type Type = z.infer<EditorProjectIdSchema>;
}
