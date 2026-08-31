import { z } from "zod";

import { EditorProjectDescriptorSchema } from "~/project-authoring/schema/EditorProjectDescriptorSchema";
import { EditorProjectOwnershipSchema } from "~/project-authoring/schema/EditorProjectOwnershipSchema";

/** One fully admitted project or one cataloged directory blocked by complete validation. */
export const EditorProjectCandidateSchema = z
	.discriminatedUnion("type", [
		z
			.object({
				type: z.literal("valid"),
				ownership: EditorProjectOwnershipSchema,
				project: EditorProjectDescriptorSchema,
			})
			.strict(),
		z
			.object({
				type: z.literal("invalid"),
				root: z.string().min(1),
				title: z.string().min(1),
				validationError: z.string().min(1),
			})
			.strict(),
	])
	.meta({
		id: "EditorProjectCandidateSchema",
		description: "One valid or blocked Editor project directory discovered by the catalog.",
	});

export type EditorProjectCandidate = z.infer<typeof EditorProjectCandidateSchema>;
export type EditorProjectOwnership = EditorProjectOwnershipSchema.Type;
