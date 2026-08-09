import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";

/** One project-owned resource row persisted separately from the project config. */
export const EditorProjectResourceRecordSchema = ResourceSchema.extend({
	projectId: IdSchema,
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
