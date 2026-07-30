import { z } from "zod";

import { EditorProjectFileSchema } from "./EditorProjectFile";
import { EditorProjectIdSchema } from "./EditorProjectIdSchema";

/** One complete editor project snapshot rooted below the canonical editor directory. */
export const EditorProjectRecordSchema = z
	.object({
		projectId: EditorProjectIdSchema.describe("The contained editor workspace identity."),
		files: z
			.array(EditorProjectFileSchema)
			.min(1)
			.describe("The complete project snapshot to publish or read."),
	})
	.strict()
	.meta({
		id: "EditorProjectRecordSchema",
		description: "One complete editor project crossing the trusted preload boundary.",
	});

export type EditorProjectRecord = z.infer<typeof EditorProjectRecordSchema>;
