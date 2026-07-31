import { z } from "zod";

import { EditorProjectFileSchema } from "./EditorProjectFile";
import { EditorProjectIdSchema } from "./EditorProjectIdSchema";

/** Exact persisted delta returned after one canonical editor project write. */
export const EditorProjectWriteResultSchema = z
	.object({
		projectId: EditorProjectIdSchema,
		file: EditorProjectFileSchema.describe("The exact content file persisted by the writer."),
		manifest: EditorProjectFileSchema.refine(({ path }) => path === "editor.json", {
			message: "The canonical writer result manifest must be editor.json.",
		}),
		revision: z
			.string()
			.regex(/^[a-f0-9]{64}$/)
			.describe("The revision of the in-memory project index after applying this delta."),
	})
	.strict()
	.meta({
		id: "EditorProjectWriteResultSchema",
		description: "One persisted editor project delta crossing the trusted preload boundary.",
	});

export type EditorProjectWriteResult = z.infer<typeof EditorProjectWriteResultSchema>;
