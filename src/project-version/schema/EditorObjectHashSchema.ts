import { z } from "zod";

/** Lowercase SHA-256 address of one immutable full version object. */
export const EditorObjectHashSchema = z
	.string()
	.regex(/^[a-f0-9]{64}$/, "Expected a lowercase SHA-256 content hash.")
	.meta({
		id: "EditorObjectHashSchema",
		description: "The content address of one immutable full Editor version object.",
	});

export type EditorObjectHashSchema = typeof EditorObjectHashSchema;

export namespace EditorObjectHashSchema {
	export type Type = z.infer<EditorObjectHashSchema>;
}
