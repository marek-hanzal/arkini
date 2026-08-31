import { z } from "zod";

import { ProjectCatalogEntrySchema } from "./ProjectCatalogEntrySchema";

/** Global main-process catalog used only to discover project directories. */
export const ProjectCatalogSchema = z
	.object({
		projects: z.array(ProjectCatalogEntrySchema),
	})
	.strict()
	.superRefine(({ projects }, context) => {
		const roots = new Set<string>();
		for (const [index, project] of projects.entries()) {
			if (roots.has(project.root)) {
				context.addIssue({
					code: "custom",
					message: "Project roots must be unique.",
					path: [
						"projects",
						index,
						"root",
					],
				});
			}
			roots.add(project.root);
		}
	})
	.meta({
		id: "EditorProjectCatalogSchema",
		description: "The global projects.json file stored below Arkini user data.",
	});

export type ProjectCatalogSchema = typeof ProjectCatalogSchema;

export namespace ProjectCatalogSchema {
	export type Type = z.infer<ProjectCatalogSchema>;
}
