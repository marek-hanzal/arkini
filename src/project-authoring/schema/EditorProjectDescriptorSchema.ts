import { z } from "zod";

import { IdSchema } from "~/game-config/schema/IdSchema";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

/** Stable repository-backed identity used by editor discovery and navigation. */
export const EditorProjectDescriptorSchema = z
	.object({
		projectId: IdSchema,
		title: z.string(),
		version: GameVersionSchema,
		createdAtMs: z.number().int().nonnegative(),
		updatedAtMs: z.number().int().nonnegative(),
	})
	.strict()
	.meta({
		id: "EditorProjectDescriptorSchema",
		description: "Stable repository-backed identity used by editor discovery and navigation.",
	});

export type EditorProjectDescriptor = z.infer<typeof EditorProjectDescriptorSchema>;
