import { z } from "zod";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { TimeSchema } from "~/engine/common/schema/TimeSchema";
export const JobTimeInvalidIssueSchema = z
	.object({
		type: z.literal("job:time-invalid"),
		jobId: IdSchema,
		durationMs: TimeSchema,
		remainingMs: z.number(),
	})
	.strict();
export type JobTimeInvalidIssueSchema = typeof JobTimeInvalidIssueSchema;
export namespace JobTimeInvalidIssueSchema {
	export type Type = z.infer<JobTimeInvalidIssueSchema>;
}
