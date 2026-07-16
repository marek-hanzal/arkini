import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

/** One owner has more than one active runtime job. */
export const JobOwnerMultipleActiveIssueSchema = z
	.object({
		ownerItemId: IdSchema,
		jobIds: z.array(IdSchema).min(2),
		type: z.literal("job:owner:multiple-active"),
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
