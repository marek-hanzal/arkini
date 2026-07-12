import { z } from "zod";
import { IdSchema } from "~/v1/common/schema/IdSchema";
import { TimestampSchema } from "~/v1/common/schema/TimestampSchema";
export const JobTimeInvalidIssueSchema = z
	.object({
		jobId: IdSchema,
		startedAtMs: TimestampSchema,
		dueAtMs: TimestampSchema,
		type: z.literal("job:time-invalid"),
	})
	.strict()
	.meta({
		id: "JobTimeInvalidIssueSchema",
		description: "One job is due before it starts.",
	});
export type JobTimeInvalidIssueSchema = typeof JobTimeInvalidIssueSchema;
export namespace JobTimeInvalidIssueSchema {
	export type Type = z.infer<JobTimeInvalidIssueSchema>;
}
