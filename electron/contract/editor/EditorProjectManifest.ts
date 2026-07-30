import { z } from "zod";

import { EditorProjectIdSchema } from "./EditorProjectIdSchema";

/** Canonical editor-project metadata stored as editor.json at the project root. */
export const EditorProjectManifestSchema = z
	.object({
		projectId: EditorProjectIdSchema,
		title: z.string().trim().min(1),
		game: z.string().trim().min(1).optional(),
		createdAtMs: z.number().int().nonnegative().max(8_640_000_000_000_000),
		updatedAtMs: z.number().int().nonnegative().max(8_640_000_000_000_000),
	})
	.strict()
	.refine(({ createdAtMs, updatedAtMs }) => updatedAtMs >= createdAtMs, {
		message: "updatedAtMs must not precede createdAtMs.",
		path: ["updatedAtMs"],
	})
	.meta({
		id: "EditorProjectManifestSchema",
		description: "The canonical editor.json manifest used to discover and open editor projects.",
	});

export type EditorProjectManifest = z.infer<typeof EditorProjectManifestSchema>;
