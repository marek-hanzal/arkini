import { z } from "zod";

import { EditorProjectCatalogEntrySchema } from "./EditorProjectCatalogEntrySchema";

export const EditorProjectCatalogFormatVersion = 1;

/** Global main-process catalog used only to discover project directories. */
export const EditorProjectCatalogSchema = z
	.object({
		formatVersion: z.literal(EditorProjectCatalogFormatVersion),
		projects: z.array(EditorProjectCatalogEntrySchema),
	})
	.strict()
	.meta({
		id: "EditorProjectCatalogSchema",
		description: "The global projects.json file stored below Arkini user data.",
	});

export type EditorProjectCatalogSchema = typeof EditorProjectCatalogSchema;

export namespace EditorProjectCatalogSchema {
	export type Type = z.infer<EditorProjectCatalogSchema>;
}
