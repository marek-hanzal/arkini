import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";

/** One owner has more than one active runtime job. */
export const JobOwnerMultipleActiveIssueSchema = z
	.object({
		ownerItemId: IdSchema,
		jobIds: z.array(IdSchema).min(2),
		type: RuntimeCheckIssueEnumSchema.extract([
			"JobOwnerMultipleActive",
		]),
	})
	.strict()
	.meta({
		id: "JobOwnerMultipleActiveIssueSchema",
		description: "One owner has more than one active runtime job.",
	});

export type JobOwnerMultipleActiveIssueSchema = typeof JobOwnerMultipleActiveIssueSchema;

export namespace JobOwnerMultipleActiveIssueSchema {
	export type Type = z.infer<JobOwnerMultipleActiveIssueSchema>;
}
