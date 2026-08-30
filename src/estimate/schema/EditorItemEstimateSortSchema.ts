import { z } from "zod";

export const EditorItemEstimateSortSchema = z.enum([
	"fastest",
	"slowest",
	"demand",
]);

export type EditorItemEstimateSortSchema = typeof EditorItemEstimateSortSchema;

export namespace EditorItemEstimateSortSchema {
	export type Type = z.infer<EditorItemEstimateSortSchema>;
}
