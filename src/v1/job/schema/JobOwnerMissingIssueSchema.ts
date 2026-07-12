import { z } from "zod";
import { IdSchema } from "~/v1/common/schema/IdSchema";
export const JobOwnerMissingIssueSchema = z
	.object({
		jobId: IdSchema,
		ownerItemId: IdSchema,
		type: z.literal("job:owner-missing"),
	})
	.strict()
	.meta({
		id: "JobOwnerMissingIssueSchema",
		description: "An active job references a missing owner item.",
	});
export type JobOwnerMissingIssueSchema = typeof JobOwnerMissingIssueSchema;
export namespace JobOwnerMissingIssueSchema {
	export type Type = z.infer<JobOwnerMissingIssueSchema>;
}
