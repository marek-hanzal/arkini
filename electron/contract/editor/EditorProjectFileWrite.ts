import { z } from "zod";

import { EditorProjectFileSchema } from "./EditorProjectFile";
import { EditorProjectIdSchema } from "./EditorProjectIdSchema";

/** One compare-and-swap mutation against a previously validated project snapshot. */
export const EditorProjectFileWriteSchema = z
	.object({
		projectId: EditorProjectIdSchema,
		file: EditorProjectFileSchema,
		expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
		mode: z.enum([
			"create",
			"replace",
		]),
	})
	.strict()
	.meta({
		id: "EditorProjectFileWriteSchema",
		description: "A revision-guarded editor source-file mutation.",
	});

export type EditorProjectFileWrite = z.infer<typeof EditorProjectFileWriteSchema>;
