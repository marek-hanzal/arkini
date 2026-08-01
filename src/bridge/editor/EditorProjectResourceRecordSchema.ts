import { z } from "zod";

import { EditorProjectIdSchema } from "~/engine/editor/schema/EditorProjectIdSchema";
import { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";

/** One project-owned resource row persisted separately from the project config. */
export const EditorProjectResourceRecordSchema = ResourceSchema.extend({
	projectId: EditorProjectIdSchema,
})
	.strict()
	.meta({
		id: "EditorProjectResourceRecordSchema",
		description: "One canonical editor project resource persisted in IndexedDB.",
	});

export type EditorProjectResourceRecordSchema = typeof EditorProjectResourceRecordSchema;

export namespace EditorProjectResourceRecordSchema {
	export type Type = z.infer<EditorProjectResourceRecordSchema>;
}
