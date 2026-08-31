import { z } from "zod";

import { ProjectDescriptorSchema } from "~/project-authoring/schema/ProjectDescriptorSchema";
import { ProjectOwnershipSchema } from "~/project-authoring/schema/ProjectOwnershipSchema";

/** One fully admitted project or one cataloged directory blocked by complete validation. */
export const ProjectCandidateSchema = z
	.discriminatedUnion("type", [
		z
			.object({
				type: z.literal("valid"),
				ownership: ProjectOwnershipSchema,
				project: ProjectDescriptorSchema,
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

export type ProjectCandidate = z.infer<typeof ProjectCandidateSchema>;
export type ProjectOwnership = ProjectOwnershipSchema.Type;
