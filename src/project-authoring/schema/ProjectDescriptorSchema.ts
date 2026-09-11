import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { VersionPartsSchema } from "~/game-version/schema/VersionPartsSchema";

/** Stable repository-backed identity used by editor discovery and navigation. */
export const ProjectDescriptorSchema = z
	.object({
		projectId: IdSchema,
		title: z.string(),
		version: VersionPartsSchema,
		createdAtMs: z.number().int().nonnegative(),
		updatedAtMs: z.number().int().nonnegative(),
	})
	.strict()
	.meta({
		id: "EditorProjectDescriptorSchema",
		description: "Stable repository-backed identity used by editor discovery and navigation.",
	});

export type ProjectDescriptor = z.infer<typeof ProjectDescriptorSchema>;
