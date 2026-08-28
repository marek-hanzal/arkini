import { z } from "zod";

/** Declares whether Arkini or the user owns the project directory lifecycle. */
export const EditorProjectOwnershipSchema = z
	.enum({
		Managed: "managed",
		External: "external",
	})
	.meta({
		id: "EditorProjectOwnershipSchema",
		description: "The lifecycle owner of one cataloged Editor project directory.",
	});

export type EditorProjectOwnershipSchema = typeof EditorProjectOwnershipSchema;

export namespace EditorProjectOwnershipSchema {
	export type Type = z.infer<EditorProjectOwnershipSchema>;
}
