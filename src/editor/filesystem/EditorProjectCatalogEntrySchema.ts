import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { EditorProjectOwnershipSchema } from "./EditorProjectOwnershipSchema";

/** Main-owned discovery record pointing at one canonical project root. */
export const EditorProjectCatalogEntrySchema = z
	.object({
		projectId: IdSchema,
		root: z.string().min(1),
		ownership: EditorProjectOwnershipSchema,
		createdAtMs: z.number().int().nonnegative(),
	})
	.strict()
	.meta({
		id: "EditorProjectCatalogEntrySchema",
		description: "One Editor project discovered through the global user-data catalog.",
	});

export type EditorProjectCatalogEntrySchema = typeof EditorProjectCatalogEntrySchema;

export namespace EditorProjectCatalogEntrySchema {
	export type Type = z.infer<EditorProjectCatalogEntrySchema>;
}
