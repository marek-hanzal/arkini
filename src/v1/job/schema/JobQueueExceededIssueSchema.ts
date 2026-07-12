import { z } from "zod";
import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
export const JobQueueExceededIssueSchema = z
	.object({
		ownerItemId: IdSchema,
		jobIds: z.array(IdSchema).min(1),
		maxQueueSize: PositiveIntegerSchema,
		queueSize: PositiveIntegerSchema,
		type: z.literal("job:queue-exceeded"),
	})
	.strict()
	.meta({
		id: "JobQueueExceededIssueSchema",
		description: "One owner has more active jobs than its queue permits.",
	});
export type JobQueueExceededIssueSchema = typeof JobQueueExceededIssueSchema;
export namespace JobQueueExceededIssueSchema {
	export type Type = z.infer<JobQueueExceededIssueSchema>;
}
