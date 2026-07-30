import { z } from "zod";

import { NonEmptyStringSchema } from "~/engine/common/schema/NonEmptyStringSchema";
import { VersionEnumSchema } from "~/engine/schema/VersionEnumSchema";
import { EditorProjectIdSchema } from "./EditorProjectIdSchema";
import { EditorSourceFileSchema } from "./EditorSourceFileSchema";

export const EditorProjectPlanSchema = z
	.object({
		projectId: EditorProjectIdSchema,
		title: NonEmptyStringSchema,
		version: VersionEnumSchema,
		files: z.array(EditorSourceFileSchema).min(1),
	})
	.strict()
	.meta({
		id: "EditorProjectPlanSchema",
		description: "The complete atomic filesystem plan for one imported editor project.",
	});

export type EditorProjectPlanSchema = typeof EditorProjectPlanSchema;

export namespace EditorProjectPlanSchema {
	export type Type = z.infer<EditorProjectPlanSchema>;
}
