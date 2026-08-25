import { z } from "zod";

export const EditorMcpPortSchema = z.number().int().min(1024).max(65_535);
export type EditorMcpPortSchema = typeof EditorMcpPortSchema;

export namespace EditorMcpPortSchema {
	export type Type = z.infer<EditorMcpPortSchema>;
}
