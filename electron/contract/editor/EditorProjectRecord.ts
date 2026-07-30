import { z } from "zod";

import { EditorProjectFileSchema } from "./EditorProjectFile";
import { EditorProjectIdSchema } from "./EditorProjectIdSchema";

/** One complete editor project snapshot rooted below the canonical editor directory. */
export const EditorProjectRecordSchema = z
	.object({
		projectId: EditorProjectIdSchema,
		files: z.array(EditorProjectFileSchema).min(1),
	})
	.strict();

export type EditorProjectRecord = z.infer<typeof EditorProjectRecordSchema>;
