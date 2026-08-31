import { z } from "zod";

import { ProjectOwnershipSchema } from "./ProjectOwnershipSchema";

/** Main-owned discovery record pointing at one canonical project root. */
export const ProjectCatalogEntrySchema = z
	.object({
		root: z.string().min(1),
		ownership: ProjectOwnershipSchema,
		createdAtMs: z.number().int().nonnegative(),
	})
	.strict()
	.meta({
		id: "EditorProjectCatalogEntrySchema",
		description: "One Editor project discovered through the global user-data catalog.",
	});

export type ProjectCatalogEntrySchema = typeof ProjectCatalogEntrySchema;

export namespace ProjectCatalogEntrySchema {
	export type Type = z.infer<ProjectCatalogEntrySchema>;
}
