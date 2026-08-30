import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

/** The single publication pointer to the currently checked-out version. */
export const EditorVersionHeadFileSchema = z
	.object({
		current: IdSchema,
		versions: z.array(IdSchema).min(1),
	})
	.strict()
	.superRefine(({ current, versions }, context) => {
		const seen = new Set<string>();
		for (const [index, candidate] of versions.entries()) {
			if (seen.has(candidate)) {
				context.addIssue({
					code: "custom",
					message: `Duplicate published versionId ${candidate}.`,
					path: [
						"versions",
						index,
					],
				});
			}
			seen.add(candidate);
		}
		if (!seen.has(current)) {
			context.addIssue({
				code: "custom",
				message: "The current version must be present in versions.",
				path: [
					"current",
				],
			});
		}
	})
	.meta({
		id: "EditorVersionHeadFileSchema",
		description: "The versions/head.json index published after every listed snapshot exists.",
	});

export type EditorVersionHeadFileSchema = typeof EditorVersionHeadFileSchema;

export namespace EditorVersionHeadFileSchema {
	export type Type = z.infer<EditorVersionHeadFileSchema>;
}
