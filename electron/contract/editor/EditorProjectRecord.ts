import { z } from "zod";

import { EditorProjectFileSchema } from "./EditorProjectFile";
import { EditorProjectIdSchema } from "./EditorProjectIdSchema";

/** One complete project accepted only for initial atomic workspace creation. */
export const EditorProjectCreateSchema = z
	.object({
		projectId: EditorProjectIdSchema.describe("The contained editor workspace identity."),
		files: z
			.array(EditorProjectFileSchema)
			.min(1)
			.describe("The complete project snapshot to publish or read."),
	})
	.strict()
	.meta({
		id: "EditorProjectCreateSchema",
		description: "One new editor project crossing the trusted preload boundary.",
	});

/** One persisted project snapshot with its mandatory compare-and-swap revision. */
export const EditorProjectRecordSchema = EditorProjectCreateSchema.extend({
	revision: z
		.string()
		.regex(/^[a-f0-9]{64}$/)
		.describe("Stable revision returned for persisted project snapshots."),
})
	.strict()
	.meta({
		id: "EditorProjectRecordSchema",
		description: "One persisted editor project crossing the trusted preload boundary.",
	});

export type EditorProjectCreate = z.infer<typeof EditorProjectCreateSchema>;
export type EditorProjectRecord = z.infer<typeof EditorProjectRecordSchema>;
