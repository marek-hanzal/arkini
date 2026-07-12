import { z } from "zod";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { JobQueueRequestSchema } from "~/v1/job/schema/JobQueueRequestSchema";
import { JobSchema } from "~/v1/job/schema/JobSchema";
export const JobQueueResolutionSchema = z
	.object({
		jobs: z.array(JobSchema),
		requests: z.array(JobQueueRequestSchema),
		used: z.number().int().nonnegative(),
		capacity: PositiveIntegerSchema,
		available: z.boolean(),
	})
	.strict()
	.meta({
		id: "JobQueueResolutionSchema",
		description: "Current active job and queued request capacity.",
	});
export type JobQueueResolutionSchema = typeof JobQueueResolutionSchema;
export namespace JobQueueResolutionSchema {
	export type Type = z.infer<JobQueueResolutionSchema>;
}
