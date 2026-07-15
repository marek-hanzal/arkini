import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";

export const JobConsumedMaterialStateIssueSchema = z
	.object({
		itemId: IdSchema,
		jobId: IdSchema,
		ownedItemIds: z.array(IdSchema),
		ownedJobIds: z.array(IdSchema),
		requestIds: z.array(IdSchema),
		type: z.literal("job:consumed-material-state"),
	})
	.strict()
	.meta({
		id: "JobConsumedMaterialStateIssueSchema",
		description: "One consumed job root still owns runtime state that start must destroy.",
	});

export type JobConsumedMaterialStateIssueSchema = typeof JobConsumedMaterialStateIssueSchema;

export namespace JobConsumedMaterialStateIssueSchema {
	export type Type = z.infer<JobConsumedMaterialStateIssueSchema>;
}
