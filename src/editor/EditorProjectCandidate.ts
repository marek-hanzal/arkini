import { z } from "zod";

import { EditorProjectDescriptorSchema } from "./EditorProjectDescriptor";

/** One fully admitted project or one cataloged directory blocked by complete validation. */
export const EditorProjectCandidateSchema = z
	.discriminatedUnion("type", [
		z
			.object({
				type: z.literal("valid"),
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
