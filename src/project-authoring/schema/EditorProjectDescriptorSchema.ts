import { z } from "zod";

import { IdSchema } from "~/game-config/schema/IdSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

/** Stable repository-backed identity used by editor discovery and navigation. */
export const EditorProjectDescriptorSchema = z
	.object({
		projectId: IdSchema,
		title: z.string(),
		version: ArkpackVersionSchema,
		createdAtMs: z.number().int().nonnegative(),
		updatedAtMs: z.number().int().nonnegative(),
	})
	.strict()
	.meta({
		id: "EditorProjectDescriptorSchema",
		description: "Stable repository-backed identity used by editor discovery and navigation.",
	});

export type EditorProjectDescriptor = z.infer<typeof EditorProjectDescriptorSchema>;
