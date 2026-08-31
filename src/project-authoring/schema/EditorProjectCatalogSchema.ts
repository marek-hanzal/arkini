import { z } from "zod";

import { EditorProjectCatalogEntrySchema } from "./EditorProjectCatalogEntrySchema";

/** Global main-process catalog used only to discover project directories. */
export const EditorProjectCatalogSchema = z
	.object({
		projects: z.array(EditorProjectCatalogEntrySchema),
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

export type EditorProjectCatalogSchema = typeof EditorProjectCatalogSchema;

export namespace EditorProjectCatalogSchema {
	export type Type = z.infer<EditorProjectCatalogSchema>;
}
