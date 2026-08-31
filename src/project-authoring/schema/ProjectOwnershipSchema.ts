import { z } from "zod";

/** Declares whether Arkini or the user owns the project directory lifecycle. */
export const ProjectOwnershipSchema = z
	.enum({
		Managed: "managed",
		External: "external",
	})
	.meta({
		id: "EditorProjectOwnershipSchema",
		description: "The lifecycle owner of one cataloged Editor project directory.",
	});

export type ProjectOwnershipSchema = typeof ProjectOwnershipSchema;

export namespace ProjectOwnershipSchema {
	export type Type = z.infer<ProjectOwnershipSchema>;
}
