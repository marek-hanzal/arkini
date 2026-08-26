import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

/** The single publication pointer to the currently checked-out version. */
export const EditorVersionHeadFileSchema = z
	.object({
		versionId: IdSchema,
		versionIds: z.array(IdSchema).min(1),
	})
	.strict()
	.superRefine(({ versionId, versionIds }, context) => {
		const seen = new Set<string>();
		for (const [index, candidate] of versionIds.entries()) {
			if (seen.has(candidate)) {
				context.addIssue({
					code: "custom",
					message: `Duplicate published versionId ${candidate}.`,
					path: [
						"versionIds",
						index,
					],
				});
			}
			seen.add(candidate);
		}
		if (!seen.has(versionId)) {
			context.addIssue({
				code: "custom",
				message: "The current versionId must be present in versionIds.",
				path: [
					"versionId",
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
