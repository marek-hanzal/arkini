import { z } from "zod";

import { EditorProjectFileSchema } from "./EditorProjectFile";
import { EditorProjectIdSchema } from "./EditorProjectIdSchema";

/** One compare-and-swap project commit against a previously validated snapshot. */
export const EditorProjectWriteSchema = z
	.object({
		projectId: EditorProjectIdSchema,
		file: EditorProjectFileSchema.describe(
			"The canonical content file to create or replace; editor.json is updated by the writer.",
		),
		expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
		mode: z.enum([
			"create",
			"replace",
		]),
	})
	.strict()
	.meta({
		id: "EditorProjectWriteSchema",
		description:
			"A revision-guarded editor project commit that also updates editor.json.",
	});

export type EditorProjectWrite = z.infer<typeof EditorProjectWriteSchema>;
