import { z } from "zod";

export const EditorMcpCommandSchema = z.enum([
	"start-local",
	"stop-local",
	"start-remote",
	"stop-remote",
	"reset-remote-auth",
]);

export type EditorMcpCommandSchema = typeof EditorMcpCommandSchema;

export namespace EditorMcpCommandSchema {
	export type Type = z.infer<EditorMcpCommandSchema>;
}
