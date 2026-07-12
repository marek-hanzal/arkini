import { z } from "zod";
import { IdSchema } from "~/v1/common/schema/IdSchema";
export const JobLineMissingIssueSchema = z
	.object({
		jobId: IdSchema,
		ownerItemId: IdSchema,
		lineId: IdSchema,
		type: z.literal("job:line-missing"),
	})
	.strict()
	.meta({
		id: "JobLineMissingIssueSchema",
		description: "An active job references a missing owner line.",
	});
export type JobLineMissingIssueSchema = typeof JobLineMissingIssueSchema;
export namespace JobLineMissingIssueSchema {
	export type Type = z.infer<JobLineMissingIssueSchema>;
}
